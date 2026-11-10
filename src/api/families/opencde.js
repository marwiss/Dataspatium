// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * OpenCDE source for the 1 series: a buildingSMART OpenCDE server (Dataregium) through its Foundation API (where to sign in,
 * who is signed in) and its Documents API (choose documents on the server's own page and fetch them as datasets; send a
 * file or a dataset as a new document or a new version through the server's upload page). No BCF in this series.
 * The user signs in with OAuth2 authorization code and PKCE (RFC 7636) in a popup; the callback page oauth-callback.html
 * reports the result to the app. Under file:// the app cannot receive a callback, so the user pastes the address instead.
 * The server's extensions are read from /.well-known/dataregium (older servers: /.well-known/kontroll). Every request goes
 * through api/cde-log, which gives it an X-Request-Id the server echoes in its request log.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/opencde', ['api/http', 'api/secrets', 'platform/consent', 'api/connectors', 'api/cde-log'], (http, secrets, consent, connectors, cdeLog) => {
    const t = (k, p) => D.t(k, p);
    const SCOPES = 'profile documents';
    const CALLBACK_PAGE = 'oauth-callback.html';
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    /** True when a connector is an OpenCDE source. */
    const isOpenCde = (connector) => !!(connector && connector.family && connector.family.type === 'opencde');

    // ---------------------------------------------------------------------------- PKCE helpers
    const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    /** 64 URL-safe random characters (RFC 7636 §4.1). */
    function verifier() { return b64url(crypto.getRandomValues(new Uint8Array(48))); }
    /** BASE64URL(SHA-256(verifier)), method S256 (RFC 7636 §4.2). */
    async function challenge(v) { return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))); }
    function randomState() { return b64url(crypto.getRandomValues(new Uint8Array(24))); }
    /** The redirect URI of this app: its own callback page at the app's root, when served over http(s); null under file://. */
    function redirectUri() {
      if (!/^https?:$/.test(location.protocol)) return null;
      return new URL(CALLBACK_PAGE, new URL(globalThis.DATASPATIUM_BASE || './', location.href.split('#')[0].split('?')[0])).href;
    }

    // ---------------------------------------------------------------------------- requests
    /** Every request to a server goes through here, so the request log sees it and gives it an X-Request-Id. */
    async function send(connector, req, extra) {
      const done = cdeLog.begin(connector, req, extra);
      try { const res = await http.request(req); done(res); return res; } catch (err) {
        done(null, err);
        // A server whose CORS refuses the header makes the request fail before it leaves: once more without it.
        if (connector && req.headers && req.headers['X-Request-Id'] && err && err.kind === 'network') {
          delete req.headers['X-Request-Id'];
          connector.requestId = false;
          const again = cdeLog.begin(connector, req, extra);
          try { const res = await http.request(req); again(res); return res; } catch (err2) { again(null, err2); throw err2; }
        }
        throw err;
      }
    }
    async function getJson(url, headers) {
      const res = await send(null, { url, method: 'GET', headers: Object.assign({ Accept: 'application/json' }, headers || {}), retries: 1 });
      if (!res.ok) throw http.httpError(res, hostOf(url));
      try { return JSON.parse(res.text); } catch (_e) { throw new http.ApiError(t('api.err.json', { text: String(res.text || '').slice(0, 120) }), { kind: 'parse', url }); }
    }
    /** The server's error in the user's words when it has a known `code`, otherwise its message. */
    function describeError(data) {
      const code = data && typeof data.code === 'string' ? data.code : '';
      const message = (data && data.message) || '';
      if (code) {
        const key = 'opencde.err.code.' + code;
        const text = t(key, { detail: message });
        if (text !== key) return { code, message, text };
      }
      return { code, message, text: message };
    }
    /** RFC 6749's error at the token endpoint, in the user's words when the error is one of the standard's. */
    function describeOAuthError(text) {
      let data = null;
      try { data = JSON.parse(text); } catch (_e) { /* not JSON */ }
      const error = data && typeof data.error === 'string' ? data.error : '';
      const description = (data && data.error_description) || String(text || '').replace(/\s+/g, ' ').slice(0, 200);
      if (error) { const key = 'opencde.err.oauth.' + error; const translated = t(key); if (translated !== key) return { code: error, message: description, text: translated }; }
      return { code: error, message: description, text: description };
    }
    /** GET or POST JSON with the bearer token; absolute addresses (links the server hands out) are used as they are. */
    async function api(connector, path, options = {}) {
      const token = await ensureToken(connector);
      const url = /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : trimUrl(connector.baseUrl) + path;
      const headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, options.headers || {});
      const req = { url, method: options.method || 'GET', headers, retries: 1, rateKey: connector.id, responseType: options.responseType };
      if (options.json !== undefined) { headers['Content-Type'] = 'application/json'; req.body = JSON.stringify(options.json); }
      const res = await send(connector, req, { kind: options.responseType === 'arraybuffer' ? 'binary' : 'json' });
      if (!res.ok) {
        let data = null;
        try { data = JSON.parse(res.text); } catch (_e) { /* not JSON */ }
        const { code, message, text } = describeError(data);
        throw new http.ApiError(`${connector.name}: ${http.describeStatus(res.status)}${text ? ' ' + text : ''}`, { kind: 'http', status: res.status, url, detail: message, code });
      }
      if (options.responseType === 'arraybuffer') return res.buffer;
      const text = (res.text || '').trim();
      return text ? JSON.parse(text) : null;
    }

    // ---------------------------------------------------------------------------- discovery and registration
    /**
     * The APIs the server offers and where to sign in, from the Foundation API. This series needs the Documents API.
     * @param {string} baseUrl
     * @returns {Promise<{apis: Record<string, string>, authUrl: string, tokenUrl: string, revocationUrl: string, registrationUrl: string|null}>}
     */
    async function discover(baseUrl) {
      const base = trimUrl(baseUrl);
      await consent.require('opencde', { host: hostOf(base) });
      const versions = await getJson(base + '/foundation/versions');
      const entries = (Array.isArray(versions) ? versions : (versions && versions.versions) || []);
      const apis = {};
      for (const v of entries) if (v && v.api_id && !(v.api_id in apis)) apis[v.api_id] = v.version_id;
      if (!apis.documents) throw new Error(t('opencde.err.no.documents', { host: hostOf(base) }));
      const auth = await getJson(base + '/foundation/1.0/auth');
      if (!auth || !auth.oauth2_auth_url || !auth.oauth2_token_url) throw new Error(t('opencde.err.no.oauth'));
      return { apis, authUrl: auth.oauth2_auth_url, tokenUrl: auth.oauth2_token_url, revocationUrl: auth.oauth2_revocation_url || '', registrationUrl: auth.oauth2_dynamic_client_reg_url || null };
    }
    /**
     * Register this app as a public client (Foundation API 2.2.3, RFC 7591) when the server allows it.
     * @param {string} baseUrl @param {{redirectUri: string}} options @returns {Promise<{clientId: string, clientSecret: string, found: any}>}
     */
    async function register(baseUrl, options) {
      const found = await discover(baseUrl);
      if (!found.registrationUrl) throw new Error(t('opencde.err.noregistration'));
      const body = { client_name: 'Dataspatium', client_url: 'https://github.com/marwiss/Dataspatium', software_id: 'dataspatium', software_version: D.version, redirect_uris: [options.redirectUri], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: SCOPES };
      const res = await send(null, { url: found.registrationUrl, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), retries: 0 });
      if (!res.ok) {
        let refusal = null;
        try { refusal = JSON.parse(res.text); } catch (_err) { refusal = null; }
        const detail = describeError(refusal).text || String(res.text || '').replace(/\s+/g, ' ').slice(0, 160);
        throw new http.ApiError(t('opencde.err.registration', { detail }), { kind: 'http', status: res.status });
      }
      const data = JSON.parse(res.text);
      return { clientId: data.client_id, clientSecret: data.client_secret || '', found };
    }
    /** An id for the source, from the server's host. */
    const idFor = (baseUrl) => ('opencde-' + hostOf(baseUrl).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'opencde-server';
    /**
     * A source for a server: asks the server where to sign in and, when the client id is left empty, registers the app with it
     * (the server must allow that). The connector is saved; a client secret goes to api/secrets, never to the connector.
     * @param {{baseUrl: string, clientId?: string, clientSecret?: string}} values @param {{redirectUri?: string}} [options]
     * @returns {Promise<any>} the saved connector
     */
    async function createConnector(values, options = {}) {
      const baseUrl = trimUrl(values.baseUrl);
      if (!/^https?:\/\//i.test(baseUrl) && !/^dataspatium-asset:\/\//.test(baseUrl)) throw new Error(t('opencde.err.address'));
      let clientId = String(values.clientId || '').trim();
      let clientSecret = String(values.clientSecret || '');
      let found;
      if (!clientId) {
        const redirect = options.redirectUri || redirectUri();
        if (!redirect) throw new Error(t('opencde.err.register.file'));
        const reg = await register(baseUrl, { redirectUri: redirect });
        clientId = reg.clientId; clientSecret = reg.clientSecret || clientSecret; found = reg.found;
      } else found = await discover(baseUrl);
      const connector = {
        format: D.require('api/schema').FORMAT_ID, id: idFor(baseUrl), name: hostOf(baseUrl), baseUrl, description: t('opencde.source.desc'),
        auth: { type: 'oauth2_pkce', clientId, scope: SCOPES, authUrl: found.authUrl, tokenUrl: found.tokenUrl, revocationUrl: found.revocationUrl },
        family: { type: 'opencde', clientId, documents: true }, endpoints: [],
      };
      const saved = await connectors.save(connector);
      if (clientSecret) secrets.set(saved.id, { clientSecret });
      return saved;
    }
    /** A connector made while the server did not answer learns the addresses now, and keeps them. */
    async function ensureAuthUrls(connector) {
      const auth = connector.auth || (connector.auth = { type: 'oauth2_pkce' });
      if (auth.authUrl && auth.tokenUrl) return connector;
      const found = await discover(connector.baseUrl);
      Object.assign(auth, { authUrl: found.authUrl, tokenUrl: found.tokenUrl, revocationUrl: found.revocationUrl });
      if (connector.id) { try { await connectors.save(connector); } catch (err) { D.log('opencde', 'could not keep the addresses', err); } }
      return connector;
    }

    // ---------------------------------------------------------------------------- the popup and the callback page
    const CALLBACK_CHANNEL = 'dataspatium-oauth';
    const CALLBACK_KEY = 'dataspatium.oauth.callback';
    /** The popup flows waiting for a callback page, so that the user can stop waiting (an isolated app cannot see a closed popup). */
    const pendingPopups = new Set();
    /** Stops every waiting popup flow: the popup is closed and the flow fails with `opencde.err.cancelled`. Returns how many. */
    function cancelPopup() { const flows = Array.from(pendingPopups); for (const flow of flows) flow.cancel(); return flows.length; }
    /** Whether a popup flow is waiting for the user. */
    const popupPending = () => pendingPopups.size > 0;
    /**
     * Default popup: open the page and wait for the callback page (oauth-callback.html) to report its address: through
     * window.opener when the browser lets the two talk, or through a BroadcastChannel (with a storage event as reserve) when the
     * app is cross-origin isolated and the popup lands in another browsing context group, where `win` looks closed and the page
     * has no opener. The app acknowledges on the channel so that the page may close itself.
     */
    function popupFlow(url) {
      return new Promise((resolve, reject) => {
        try { localStorage.removeItem(CALLBACK_KEY); } catch (_e) { /* storage blocked */ }
        const win = window.open(url, 'dataspatium-opencde-login', 'popup,width=520,height=760');
        if (!win) { reject(new Error(t('opencde.err.popup'))); return; }
        const isolated = !!globalThis.crossOriginIsolated;
        let channel = null;
        const flow = { cancel: () => { cleanup(); try { win.close(); } catch (_e) { /* already gone */ } reject(new Error(t('opencde.err.cancelled'))); } };
        pendingPopups.add(flow);
        const cleanup = () => {
          pendingPopups.delete(flow);
          clearTimeout(timer); clearInterval(poll);
          window.removeEventListener('message', onMessage); window.removeEventListener('storage', onStorage);
          if (channel) { const c = channel; channel = null; setTimeout(() => c.close(), 2000); }
        };
        const finish = (href, id) => {
          if (id && channel) { try { channel.postMessage({ type: 'dataspatium-oauth-ack', id }); } catch (_e) { /* the page closes anyway */ } }
          cleanup();
          try { win.close(); } catch (_e) { /* the popup may already be gone */ }
          resolve(String(href));
        };
        const timer = setTimeout(() => { cleanup(); reject(new Error(t('opencde.err.timeout'))); }, 300000);
        // An isolated opener sees the popup as closed as soon as it leaves our origin, so that signal counts only when not isolated.
        const poll = setInterval(() => { if (!isolated && win.closed) { cleanup(); reject(new Error(t('opencde.err.closed'))); } }, 500);
        const onMessage = (ev) => { if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'dataspatium-oauth-callback') return; finish(ev.data.url, ev.data.id); };
        const onStorage = (ev) => {
          if (ev.key !== CALLBACK_KEY || !ev.newValue) return;
          try { const data = JSON.parse(ev.newValue); localStorage.removeItem(CALLBACK_KEY); finish(data.url, data.id); } catch (_e) { /* not ours */ }
        };
        window.addEventListener('message', onMessage);
        window.addEventListener('storage', onStorage);
        try { channel = new BroadcastChannel(CALLBACK_CHANNEL); channel.onmessage = (ev) => { if (ev.data && ev.data.type === 'dataspatium-oauth-callback') finish(ev.data.url, ev.data.id); }; } catch (_e) { channel = null; }
      });
    }
    /** Dataregium renders the pages it opens in a popup in the app's language when asked with `lang=`; other servers are left alone. */
    function withLang(connector, url) {
      try {
        const hit = capsCache.get(trimUrl(connector.baseUrl));
        if (!hit || !hit.caps || !hit.caps.present) return url;
        const u = new URL(url);
        u.searchParams.set('lang', D.require('ui/i18n').language());
        return u.href;
      } catch (_e) { return url; }
    }
    /** The code of a callback address; refuses a wrong state or an error from the server. */
    function parseCallback(url, state) {
      let q;
      try { q = new URL(String(url).trim()).searchParams; } catch (_e) { throw new Error(t('opencde.err.callback')); }
      if (q.get('error')) throw new Error(t('opencde.err.denied', { error: q.get('error_description') || q.get('error') }));
      if (q.get('state') !== state) throw new Error(t('opencde.err.state'));
      const code = q.get('code');
      if (!code) throw new Error(t('opencde.err.callback'));
      return code;
    }

    // ---------------------------------------------------------------------------- signing in
    async function tokenRequest(connector, body) {
      const auth = connector.auth || {};
      const creds = secrets.get(connector.id) || {};
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
      const params = new URLSearchParams(body);
      if (creds.clientSecret) headers.Authorization = 'Basic ' + btoa(`${auth.clientId}:${creds.clientSecret}`);
      else params.set('client_id', auth.clientId);
      const res = await send(connector, { url: auth.tokenUrl, method: 'POST', headers, body: params.toString(), retries: 0, rateKey: connector.id }, { kind: 'token' });
      if (!res.ok) { const e = describeOAuthError(res.text); throw new http.ApiError(t('opencde.err.token', { detail: e.text }), { kind: 'auth', status: res.status, code: e.code, detail: e.message }); }
      const data = JSON.parse(res.text);
      const ttl = Number(data.expires_in) > 0 ? Number(data.expires_in) * 1000 : 3600000;
      const stored = Object.assign({}, creds, { token: data.access_token, refreshToken: data.refresh_token || creds.refreshToken || '', expiresAt: String(Date.now() + ttl), scope: data.scope || '' });
      secrets.set(connector.id, stored);
      return stored;
    }
    /** The authorization address for a connector, with a fresh verifier and state. */
    async function authorizeUrl(connector, redirect) {
      const auth = connector.auth || {};
      const v = verifier(); const state = randomState();
      const url = new URL(auth.authUrl);
      const params = { response_type: 'code', client_id: auth.clientId, redirect_uri: redirect, scope: auth.scope || SCOPES, state, code_challenge: await challenge(v), code_challenge_method: 'S256' };
      for (const [k, val] of Object.entries(params)) if (val) url.searchParams.set(k, val);
      return { url: url.href, state, verifier: v, redirect };
    }
    /**
     * Sign in with the authorization code flow and PKCE. `options.popup(url)` must resolve with the callback address (the default
     * opens a popup and listens for the callback page); `options.redirectUri` overrides the app's own.
     */
    async function login(connector, options = {}) {
      await consent.require('opencde', { host: hostOf(connector.baseUrl) });
      await ensureAuthUrls(connector);
      const auth = connector.auth || {};
      if (!auth.authUrl || !auth.tokenUrl) throw new Error(t('opencde.err.no.oauth'));
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file'));
      const started = await authorizeUrl(connector, redirect);
      const callback = await (options.popup || popupFlow)(withLang(connector, started.url));
      const code = parseCallback(callback, started.state);
      return tokenRequest(connector, { grant_type: 'authorization_code', code, code_verifier: started.verifier, redirect_uri: redirect });
    }
    /** The authorization address and state for the manual flow (file://): the user opens it and pastes the result. */
    async function manualStart(connector, redirect) {
      await consent.require('opencde', { host: hostOf(connector.baseUrl) });
      await ensureAuthUrls(connector);
      return authorizeUrl(connector, redirect);
    }
    async function manualFinish(connector, started, callbackUrl) {
      const code = parseCallback(callbackUrl, started.state);
      return tokenRequest(connector, { grant_type: 'authorization_code', code, code_verifier: started.verifier, redirect_uri: started.redirect });
    }
    function signedIn(connector) { const c = secrets.get(connector.id); return !!(c && c.token); }
    /** A valid access token: refreshed when it is about to expire. */
    async function ensureToken(connector) {
      const creds = secrets.get(connector.id);
      if (!creds || !creds.token) throw new http.ApiError(t('opencde.err.signin.first', { name: connector.name }), { kind: 'auth' });
      if (Number(creds.expiresAt) - Date.now() > 60000) return creds.token;
      if (!creds.refreshToken) throw new http.ApiError(t('opencde.err.expired'), { kind: 'auth' });
      try { return (await tokenRequest(connector, { grant_type: 'refresh_token', refresh_token: creds.refreshToken })).token; } catch (err) { secrets.set(connector.id, { clientSecret: creds.clientSecret || '' }); throw new http.ApiError(t('opencde.err.expired'), { kind: 'auth', cause: err }); }
    }
    /** Revoke the refresh token (RFC 7009) and forget the tokens. */
    async function logout(connector) {
      const creds = secrets.get(connector.id);
      const auth = connector.auth || {};
      if (creds && creds.refreshToken && auth.revocationUrl) {
        const params = new URLSearchParams({ token: creds.refreshToken, token_type_hint: 'refresh_token' });
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (creds.clientSecret) headers.Authorization = 'Basic ' + btoa(`${auth.clientId}:${creds.clientSecret}`); else params.set('client_id', auth.clientId);
        try { await send(connector, { url: auth.revocationUrl, method: 'POST', headers, body: params.toString(), retries: 0, rateKey: connector.id }, { kind: 'token' }); } catch (_e) { /* best effort */ }
      }
      secrets.set(connector.id, creds && creds.clientSecret ? { clientSecret: creds.clientSecret } : {});
    }
    const currentUser = (connector) => api(connector, '/foundation/1.0/current-user');

    // ---------------------------------------------------------------------------- what the server offers beyond the specifications
    /** @type {Map<string, {at: number, caps: any}>} */
    const capsCache = new Map();
    const CAPS_TTL = 5 * 60 * 1000;
    const EMPTY_CAPS = { present: false, server: null, apis: {}, scopes: [], extensions: {}, limits: {}, links: {} };
    /**
     * Dataregium describes its extensions in GET /.well-known/dataregium (no sign-in, outside the specifications). A server from
     * before the name change (Kontroll) only answers on /.well-known/kontroll, which is asked when the first address gives no
     * document. A server without the document has no extensions; unknown keys count as absent. Cached a few minutes per server.
     * @param {any} connector @param {{force?: boolean}} [options]
     */
    async function capabilities(connector, options = {}) {
      const key = trimUrl(connector.baseUrl);
      const hit = capsCache.get(key);
      if (hit && !options.force && Date.now() - hit.at < CAPS_TTL) return hit.caps;
      let caps = EMPTY_CAPS;
      try {
        const ask = (path) => send(connector, { url: key + path, method: 'GET', headers: { Accept: 'application/json' }, retries: 0, rateKey: connector.id });
        let res = await ask('/.well-known/dataregium');
        if (!res.ok) res = await ask('/.well-known/kontroll');
        if (res.ok) {
          const data = JSON.parse(res.text || '{}') || {};
          caps = { present: true, server: data.server || null, apis: data.apis || {}, scopes: Array.isArray(data.scopes) ? data.scopes : [], extensions: data.extensions && typeof data.extensions === 'object' ? data.extensions : {}, limits: data.limits || {}, links: data.links || {} };
        }
      } catch (err) { D.log('opencde', 'capabilities', err); }
      capsCache.set(key, { at: Date.now(), caps });
      return caps;
    }
    /** Whether an extension is enabled in a capabilities answer. */
    const hasExtension = (caps, name) => !!(caps && caps.extensions && caps.extensions[name] && caps.extensions[name].enabled);

    // ---------------------------------------------------------------------------- Documents API
    /**
     * Start a selection; the user picks on the server's page (popup) and the callback page reports back.
     * @returns {Promise<{documents: any[]}|null>} the server's answer with the chosen DocumentVersions, or null when the user cancelled
     */
    async function selectDocuments(connector, options = {}) {
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file'));
      const started = await api(connector, '/documents/1.0/select-documents', { method: 'POST', json: { callback: { url: redirect, expires_in: 600 } } });
      const callback = await (options.popup || popupFlow)(withLang(connector, started.select_documents_url));
      const q = new URL(callback).searchParams;
      if (q.get('user_cancelled_selection') === 'true') return null;
      const url = q.get('selected_documents_url');
      if (!url) throw new Error(t('opencde.err.callback'));
      return api(connector, url);
    }
    /** Download a DocumentVersion's file as a File named as on the server. */
    async function downloadVersion(connector, version) {
      const buffer = await api(connector, version.links.document_version_download.url, { responseType: 'arraybuffer', headers: { Accept: '*/*' } });
      const name = (version.file_description && version.file_description.name) || version.title || 'document';
      return new File([buffer], name, { type: 'application/octet-stream' });
    }
    /**
     * A document version as a dataset, which remembers where it came from (`source.cde`), so that the app can tell later whether
     * the server has a newer version. @param {any} connector @param {any} version a DocumentVersion @returns {Promise<any>} the dataset
     */
    async function importVersion(connector, version) {
      const file = await downloadVersion(connector, version);
      const importer = D.require('io/import');
      const datasets = D.require('data/datasets');
      const meta = await importer.run(file, {}, null, (version.title || file.name).replace(/\.[^.]+$/, ''));
      const cde = { connectorId: connector.id, connectorName: connector.name, host: hostOf(connector.baseUrl), kind: 'document', documentId: version.document_id || null, versionIndex: Number(version.version_index) || null, versionNumber: version.version_number || null, title: version.title || '', fetchedAt: new Date().toISOString() };
      await datasets.updateMeta(meta.id, { source: Object.assign({}, meta.source || { kind: 'file', fileName: file.name }, { cde }) });
      return datasets.get(meta.id);
    }
    /** The latest versions the server has of some documents (Documents API `POST document-versions`). */
    async function documentVersions(connector, documentIds) {
      const out = await api(connector, '/documents/1.0/document-versions', { method: 'POST', json: { document_ids: documentIds } });
      return (out && out.versions) || [];
    }
    /** Whether the server has a newer version of the document a dataset came from. */
    async function newerVersion(connector, ds) {
      const cde = ds.source && ds.source.cde;
      if (!cde || !cde.documentId) return { newer: false, version: null, have: null };
      const versions = await documentVersions(connector, [cde.documentId]);
      const latest = versions.find((v) => v.document_id === cde.documentId) || versions[0] || null;
      return { newer: !!(latest && Number(latest.version_index) > Number(cde.versionIndex || 0)), version: latest, have: cde.versionIndex };
    }
    /**
     * Upload a file through the Documents API (1.0 upload flow): the server's own page asks the user for title, version and
     * project in a popup; then the parts go up and the version is completed. `documentId` makes it a new version of that document.
     * @param {any} connector @param {File} file
     * @param {{documentId?: string|null, redirectUri?: string, popup?: Function, onProgress?: (p: {done: number, total: number}) => void}} [options]
     * @returns {Promise<any|null>} the DocumentVersion, or null when the user cancelled on the page
     */
    async function uploadDocument(connector, file, options = {}) {
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file'));
      const entry = { file_name: file.name, session_file_id: 'f1' };
      if (options.documentId) entry.document_id = options.documentId;
      const started = await api(connector, '/documents/1.0/upload-documents', { method: 'POST', json: { callback: { url: redirect, expires_in: 600 }, files: [entry] } });
      if (Number(started.max_size_in_bytes) > 0 && file.size > Number(started.max_size_in_bytes)) throw new Error(t('opencde.err.toolarge', { max: D.require('ui/i18n').formatBytes(Number(started.max_size_in_bytes)) }));
      const callback = await (options.popup || popupFlow)(withLang(connector, started.upload_ui_url));
      const q = new URL(callback).searchParams;
      if (q.get('user_cancelled_upload') === 'true') return null;
      const instructionsUrl = q.get('upload_documents_url');
      if (!instructionsUrl) throw new Error(t('opencde.err.callback'));
      const plan = await api(connector, instructionsUrl, { method: 'POST', json: { files: [{ session_file_id: 'f1', size_in_bytes: file.size }] } });
      const todo = (plan.documents_to_upload || [])[0];
      if (!todo) throw new Error(t('opencde.err.callback'));
      const bytes = await file.arrayBuffer();
      let done = 0;
      const token = await ensureToken(connector);
      for (const part of todo.upload_file_parts || []) {
        const start = Number(part.content_range_start) || 0; const end = Number(part.content_range_end);
        let chunk = bytes.slice(start, end + 1);
        const form = part.multipart_form_data;
        if (form) chunk = new Blob([String(form.prefix || ''), chunk, String(form.suffix || '')]);
        const headers = { 'Content-Type': 'application/octet-stream' };
        for (const hv of ((part.additional_headers || {}).values || [])) headers[hv.name] = hv.value;
        if (part.include_authorization !== false) headers.Authorization = 'Bearer ' + token;
        const res = await send(connector, { url: part.url, method: part.http_method || 'PUT', headers, body: chunk, retries: 1, rateKey: connector.id, timeoutMs: 600000 }, { kind: 'part' });
        if (!res.ok) throw new http.ApiError(`${connector.name}: ${http.describeStatus(res.status)}`, { kind: 'http', status: res.status, url: part.url });
        done += (end - start + 1);
        if (options.onProgress) options.onProgress({ done: Math.min(done, file.size), total: file.size });
      }
      return api(connector, todo.upload_completion.url, { method: 'POST' });
    }

    return {
      SCOPES, CALLBACK_CHANNEL, CALLBACK_KEY, isOpenCde, hostOf, redirectUri, discover, register, createConnector, ensureAuthUrls, popupFlow, cancelPopup,
      popupPending, login, manualStart, manualFinish, signedIn, logout, currentUser, capabilities, hasExtension, describeError, describeOAuthError, api,
      selectDocuments, downloadVersion, importVersion, documentVersions, newerVersion, uploadDocument,
    };
  });
})();
