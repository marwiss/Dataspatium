// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * OpenCDE servers as a source: buildingSMART's Foundation API 1.0 (discovery, OAuth2 authorization code with PKCE),
 * BCF API 3.0 (projects, topics, comments, viewpoints with their components, events) and Documents API 1.0 (the
 * user picks documents on the server's own page; the files are then downloaded and imported). The connector
 * (family {type: 'opencde'}) keeps the server address and the OAuth2 client id the server's administrator issued;
 * tokens live in api/secrets for the session. The family joins the "Lägg till databaskälla" dialog and gets its own
 * browser in Inhämta (ui/api/opencde-view). Signing in happens in a popup when the app is served over http(s);
 * from file:// the user pastes the address the server redirected to.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/opencde', ['api/families/databases', 'api/http', 'api/secrets', 'platform/consent', 'api/connectors', 'api/cde-log'], (databases, http, secrets, consent, connectors, cdeLog) => {
    const t = (k, p) => D.t(k, p);
    const SCOPES = 'profile bcf documents';
    const CALLBACK_PAGE = 'oauth-callback.html';
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };

    /** The family entry for the dialog: address and client id; the token comes from signing in. */
    const FAMILY = {
      id: 'opencde', name: 'OpenCDE (BCF, Documents)', docs: 'https://github.com/buildingSMART/foundation-API',
      fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://cde.example.org' }, { name: 'clientId', type: 'text', required: true }, { name: 'clientSecret', type: 'secret' }],
      auth: (v) => ({ type: 'oauth2_pkce', clientId: String(v.clientId || '').trim(), scope: SCOPES }),
      secrets: (v) => (v.clientSecret ? { clientSecret: v.clientSecret } : null),
      idHint: (v) => hostOf(v.baseUrl),
      endpoints: () => [],
      family: (v) => ({ type: 'opencde', clientId: String(v.clientId || '').trim() }),
      /** The dialog asks the server where to sign in, so that the connector can do so later; a failure is shown there. */
      async discover(v, connector) {
        const found = await discover(v.baseUrl);
        Object.assign(connector.auth, { authUrl: found.authUrl, tokenUrl: found.tokenUrl, revocationUrl: found.revocationUrl });
        return [];
      },
    };
    if (!databases.FAMILIES.some((f) => f.id === 'opencde')) databases.FAMILIES.push(FAMILY);
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

    // ---------------------------------------------------------------------------- discovery
    async function getJson(url, headers) {
      const res = await send(null, { url, method: 'GET', headers: Object.assign({ Accept: 'application/json' }, headers || {}), retries: 1 });
      if (!res.ok) throw http.httpError(res, hostOf(url));
      try { return JSON.parse(res.text); } catch (_e) { throw new http.ApiError(t('api.err.json', { text: String(res.text || '').slice(0, 120) }), { kind: 'parse', url }); }
    }
    /** Foundation API: the APIs the server offers and where to sign in. */
    async function discover(baseUrl) {
      const base = trimUrl(baseUrl);
      await consent.require('opencde', { host: hostOf(base) });
      const [versions, auth] = await Promise.all([getJson(base + '/foundation/versions'), getJson(base + '/foundation/1.0/auth')]);
      const apis = {};
      for (const v of (versions && versions.versions) || []) apis[v.api_id] = v.version_id;
      if (!apis.bcf && !apis.documents) throw new Error(t('opencde.err.not.opencde', { host: hostOf(base) }));
      if (!auth || !auth.oauth2_auth_url || !auth.oauth2_token_url) throw new Error(t('opencde.err.no.oauth'));
      return { apis, authUrl: auth.oauth2_auth_url, tokenUrl: auth.oauth2_token_url, revocationUrl: auth.oauth2_revocation_url || '', registrationUrl: auth.oauth2_dynamic_client_reg_url || null, pkceRequired: auth.oauth2_pkce_required !== false };
    }

    // ---------------------------------------------------------------------------- signing in
    /** A connector made while the server did not answer learns the addresses now, and keeps them. */
    async function ensureAuthUrls(connector) {
      const auth = connector.auth || (connector.auth = { type: 'oauth2_pkce' });
      if (auth.authUrl && auth.tokenUrl) return connector;
      const found = await discover(connector.baseUrl);
      Object.assign(auth, { authUrl: found.authUrl, tokenUrl: found.tokenUrl, revocationUrl: found.revocationUrl });
      if (connector.id) { try { await connectors.save(connector); } catch (err) { D.log('opencde', 'could not keep the addresses', err); } }
      return connector;
    }
    const CALLBACK_CHANNEL = 'dataspatium-oauth';
    const CALLBACK_KEY = 'dataspatium.oauth.callback';
    /**
     * Default popup: open the page and wait for the callback page (oauth-callback.html) to report its address: through
     * window.opener when the browser lets the two talk, or through a BroadcastChannel (with a storage event as reserve) when the
     * app is cross-origin isolated (sw-coi.js on http) and the popup lands in another browsing context group, where `win` looks
     * closed and the page has no opener. The app acknowledges on the channel so that the page may close itself.
     */
    function popupFlow(url) {
      return new Promise((resolve, reject) => {
        try { localStorage.removeItem(CALLBACK_KEY); } catch (_e) { /* storage blocked */ }
        const win = window.open(url, 'dataspatium-opencde-login', 'popup,width=520,height=760');
        if (!win) { reject(new Error(t('opencde.err.popup'))); return; }
        const isolated = !!globalThis.crossOriginIsolated;
        let channel = null;
        const cleanup = () => {
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
    /**
     * Kontroll renders the pages it opens in a popup (sign-in, upload, document selection) in the app's language when asked with
     * `lang=`; the parameter wins over its cookie and an unknown code falls back quietly. Decided from the capabilities the source's
     * view already read (no request of its own, so the log stays as it was); other servers' addresses are left alone.
     */
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
    /**
     * Sign in with the authorization code flow and PKCE. `options.popup(url)` must resolve with the callback address
     * (the default opens a popup and listens for the callback page); `options.redirectUri` overrides the app's own.
     */
    async function login(connector, options = {}) {
      await consent.require('opencde', { host: hostOf(connector.baseUrl) });
      await ensureAuthUrls(connector);
      const auth = connector.auth || {};
      if (!auth.authUrl || !auth.tokenUrl) throw new Error(t('opencde.err.no.oauth'));
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file'));
      const v = verifier(); const state = randomState();
      const url = new URL(auth.authUrl);
      const params = { response_type: 'code', client_id: auth.clientId, redirect_uri: redirect, scope: auth.scope || SCOPES, state, code_challenge: await challenge(v), code_challenge_method: 'S256' };
      for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
      const callback = await (options.popup || popupFlow)(withLang(connector, url.href));
      const code = parseCallback(callback, state);
      return tokenRequest(connector, { grant_type: 'authorization_code', code, code_verifier: v, redirect_uri: redirect });
    }
    /** The authorization address and state for the manual flow (file://): the user opens it and pastes the result. */
    async function manualStart(connector, redirect) {
      await ensureAuthUrls(connector);
      const auth = connector.auth || {};
      const v = verifier(); const state = randomState();
      const url = new URL(auth.authUrl);
      const params = { response_type: 'code', client_id: auth.clientId, redirect_uri: redirect, scope: auth.scope || SCOPES, state, code_challenge: await challenge(v), code_challenge_method: 'S256' };
      for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
      return { url: url.href, state, verifier: v, redirect };
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

    // ---------------------------------------------------------------------------- what the server offers beyond the specifications
    /** @type {Map<string, {at: number, caps: any}>} */
    const capsCache = new Map();
    const CAPS_TTL = 5 * 60 * 1000;
    const EMPTY_CAPS = { present: false, server: null, apis: {}, scopes: [], extensions: {}, limits: {}, links: {} };
    /**
     * Kontroll describes its extensions in GET /.well-known/kontroll (no sign-in, outside the specifications): the server's version, the
     * enabled extensions (dynamic_client_registration, request_log, admin_api, ifcgraph, graph_query), limits and links. A server
     * without the document has no extensions; unknown keys count as absent. Cached a few minutes per connector.
     * @param {any} connector @param {{force?: boolean}} [options]
     * @returns {Promise<{present: boolean, server: any, apis: any, scopes: string[], extensions: Record<string, any>, limits: any, links: any}>}
     */
    async function capabilities(connector, options = {}) {
      const key = trimUrl(connector.baseUrl);
      const hit = capsCache.get(key);
      if (hit && !options.force && Date.now() - hit.at < CAPS_TTL) return hit.caps;
      let caps = EMPTY_CAPS;
      try {
        const res = await send(connector, { url: trimUrl(connector.baseUrl) + '/.well-known/kontroll', method: 'GET', headers: { Accept: 'application/json' }, retries: 0, rateKey: connector.id });
        if (res.ok) {
          const data = JSON.parse(res.text || '{}') || {};
          caps = { present: true, server: data.server || null, apis: data.apis || {}, scopes: Array.isArray(data.scopes) ? data.scopes : [], extensions: data.extensions && typeof data.extensions === 'object' ? data.extensions : {}, limits: data.limits || {}, links: data.links || {} };
        }
      } catch (err) { D.log('opencde', 'capabilities', err); }
      capsCache.set(key, { at: Date.now(), caps });
      return caps;
    }
    /** Whether an extension is enabled in a capabilities answer. @param {any} caps @param {string} name */
    const hasExtension = (caps, name) => !!(caps && caps.extensions && caps.extensions[name] && caps.extensions[name].enabled);
    /** The server's error in the user's words: a known `code` is translated, otherwise the server's message is shown. */
    /** RFC 6749's error at the token endpoint, in the user's words when the error is one of the six the standard names. */
    function describeOAuthError(text) {
      let data = null;
      try { data = JSON.parse(text); } catch (_e) { /* not JSON */ }
      const error = data && typeof data.error === 'string' ? data.error : '';
      const description = (data && data.error_description) || String(text || '').replace(/\s+/g, ' ').slice(0, 200);
      if (error) {
        const key = 'opencde.err.oauth.' + error;
        const translated = t(key);
        if (translated !== key) return { code: error, message: description, text: translated };
      }
      return { code: error, message: description, text: description };
    }
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

    // ---------------------------------------------------------------------------- API calls
    /**
     * Every request to a server goes through here, so the CDE log sees it. A saved connector sends X-Request-Id unless it has been
     * turned off; a server whose CORS refuses the header makes the request fail before it leaves, so one retry goes without the
     * header and the connector remembers (`requestId: false`).
     * @param {any} connector the connector, or null before one exists @param {any} req @param {{kind?: string}} [extra]
     */
    async function send(connector, req, extra) {
      const done = cdeLog.begin(connector, req, extra);
      try { const res = await http.request(req); done(res); return res; } catch (err) {
        done(null, err);
        if (connector && connector.id && req.headers && req.headers['X-Request-Id'] && err && err.kind === 'network') {
          delete req.headers['X-Request-Id'];
          connector.requestId = false;
          try { await connectors.save(connector); } catch (_e) { /* the copy in memory is enough for this session */ }
          const again = cdeLog.begin(connector, req, extra);
          try { const res = await http.request(req); again(res); return res; } catch (err2) { again(null, err2); throw err2; }
        }
        throw err;
      }
    }
    /** GET or POST JSON with the bearer token; absolute addresses (links the server hands out) are used as they are. */
    async function api(connector, path, options = {}) {
      const token = await ensureToken(connector);
      const url = /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : trimUrl(connector.baseUrl) + path;
      const headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, options.headers || {});
      const req = { url, method: options.method || 'GET', headers, signal: options.signal, retries: 1, rateKey: connector.id, responseType: options.responseType, notModifiedOk: !!options.notModifiedOk };
      if (options.json !== undefined) { headers['Content-Type'] = 'application/json'; req.body = JSON.stringify(options.json); }
      else if (options.body !== undefined) req.body = options.body;
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
    const bcf = (connector, path, options) => api(connector, '/bcf/3.0' + path, options);
    /** A file or picture from the server, with its type. @returns {Promise<{buffer: ArrayBuffer, contentType: string}>} */
    async function binary(connector, path, accept) {
      const token = await ensureToken(connector);
      const url = /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : trimUrl(connector.baseUrl) + path;
      const res = await send(connector, { url, method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: accept || '*/*' }, retries: 1, rateKey: connector.id, responseType: 'arraybuffer' }, { kind: 'binary' });
      if (!res.ok) throw new http.ApiError(`${connector.name}: ${http.describeStatus(res.status)}`, { kind: 'http', status: res.status, url });
      return { buffer: res.buffer, contentType: (res.contentType || '').split(';')[0].trim() };
    }
    const encode = encodeURIComponent;
    function odata(params) { const q = new URLSearchParams(); for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); const s = q.toString(); return s ? '?' + s : ''; }

    const currentUser = (connector) => api(connector, '/foundation/1.0/current-user');
    const projects = (connector) => bcf(connector, '/projects');
    const extensions = (connector, projectId) => bcf(connector, `/projects/${encode(projectId)}/extensions`);
    const topics = (connector, projectId, params) => bcf(connector, `/projects/${encode(projectId)}/topics${odata(params)}`);
    const comments = (connector, projectId, topicGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/comments`);
    const viewpoints = (connector, projectId, topicGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints`);
    const selection = (connector, projectId, topicGuid, vpGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints/${encode(vpGuid)}/selection`);
    const coloring = (connector, projectId, topicGuid, vpGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints/${encode(vpGuid)}/coloring`);
    const topicEvents = (connector, projectId, params) => bcf(connector, `/projects/${encode(projectId)}/topics/events${odata(params)}`);
    const bcfDocuments = (connector, projectId) => bcf(connector, `/projects/${encode(projectId)}/documents`);
    const filesInformation = (connector, projectId) => bcf(connector, `/projects/${encode(projectId)}/files_information`);

    // ---------------------------------------------------------------------------- tables
    const cell = (v) => (v === undefined ? null : v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
    function table(columns, items, pick) { return { columns, rows: items.map((it) => columns.map((c) => cell(pick(it)[c]))) }; }
    const TOPIC_COLUMNS = ['server_assigned_id', 'guid', 'title', 'topic_type', 'topic_status', 'priority', 'stage', 'labels', 'assigned_to', 'creation_author', 'creation_date', 'modified_author', 'modified_date', 'due_date', 'description'];
    function topicsTable(list) { return table(TOPIC_COLUMNS, list, (tp) => Object.assign({}, tp, { labels: Array.isArray(tp.labels) ? tp.labels.join(', ') : tp.labels })); }
    const COMMENT_COLUMNS = ['topic_guid', 'topic', 'guid', 'date', 'author', 'comment', 'viewpoint_guid', 'modified_date', 'modified_author'];
    function commentsTable(list) { return table(COMMENT_COLUMNS, list, (c) => c); }
    const COMPONENT_COLUMNS = ['topic', 'topic_guid', 'viewpoint_guid', 'role', 'ifc_guid', 'color', 'originating_system', 'authoring_tool_id', 'snapshot'];
    function componentsTable(list) { return table(COMPONENT_COLUMNS, list, (c) => c); }
    const EVENT_COLUMNS = ['topic_guid', 'date', 'author', 'type', 'value'];
    function eventsTable(list) { return table(EVENT_COLUMNS, list, (e) => e); }
    const FILE_COLUMNS = ['filename', 'ifc_project', 'date', 'reference', 'source'];

    /** Every topic of a project (all pages of 500) as a table. */
    async function fetchTopics(connector, projectId, options = {}) {
      const all = []; let skip = 0;
      for (;;) {
        const page = await topics(connector, projectId, Object.assign({ $top: 500, $skip: skip }, options.filter ? { $filter: options.filter } : {}));
        all.push(...page); if (page.length < 500 || all.length >= 20000) break; skip += 500;
      }
      return topicsTable(all);
    }
    /** All comments of all topics (or of the given topics) as one table. */
    async function fetchComments(connector, projectId, topicList) {
      const list = topicList || (await topics(connector, projectId, { $top: 1000 }));
      const out = [];
      for (const tp of list) for (const c of await comments(connector, projectId, tp.guid)) out.push(Object.assign({ topic: tp.title }, c));
      return commentsTable(out);
    }
    /** The components of every viewpoint (selection and coloring) as one table: one row per component. */
    async function fetchComponents(connector, projectId, topicList) {
      const list = topicList || (await topics(connector, projectId, { $top: 1000 }));
      const out = [];
      for (const tp of list) {
        for (const vp of await viewpoints(connector, projectId, tp.guid)) {
          const base = { topic: tp.title, topic_guid: tp.guid, viewpoint_guid: vp.guid, snapshot: vp.snapshot ? vp.snapshot.snapshot_type : null };
          const [sel, col] = await Promise.all([selection(connector, projectId, tp.guid, vp.guid), coloring(connector, projectId, tp.guid, vp.guid)]);
          for (const c of (sel && sel.selection) || []) out.push(Object.assign({}, base, c, { role: 'selection', color: null }));
          for (const group of (col && col.coloring) || []) for (const c of group.components || []) out.push(Object.assign({}, base, c, { role: 'coloring', color: group.color }));
        }
      }
      return componentsTable(out);
    }
    /** Topic events of the project, one row per action. */
    async function fetchEvents(connector, projectId) {
      const events = await topicEvents(connector, projectId, { $top: 5000 });
      const out = [];
      for (const ev of events) for (const a of ev.actions || []) out.push({ topic_guid: ev.topic_guid, date: ev.date, author: ev.author, type: a.type, value: a.value === undefined ? null : a.value });
      return eventsTable(out);
    }
    /**
     * The project's files as the server lists them (BCF 3.3.1): BCF documents and Documents API files, with the address to fetch
     * each from. A Documents API address names the document and the version, which the version check needs later.
     * @returns {Promise<Array<{filename: string, ifcProject: string|null, date: string|null, reference: string, source: string, documentId: string|null, versionIndex: number|null, model: boolean}>>}
     */
    async function filesList(connector, projectId) {
      const info = await filesInformation(connector, projectId);
      return info.map((entry) => {
        const f = entry.file || {};
        const shown = (name) => { const d = (entry.display_information || []).find((x) => x.field_display_name === name); return d ? String(d.field_value || '') : ''; };
        // Kontroll names the document and the version in display fields; other servers may only give the address.
        const m = /\/documents\/([^/]+)\/versions\/(\d+)\/download/.exec(String(f.reference || ''));
        const fromApi = /documents api/i.test(shown('Source')) || !!m;
        const documentId = fromApi ? (shown('Document id') || (m ? decodeURIComponent(m[1]) : null) || null) : null;
        const versionIndex = fromApi ? (Number(shown('Version index')) || (m ? Number(m[2]) : null) || null) : null;
        return { filename: String(f.filename || shown('File name') || 'document'), ifcProject: f.ifc_project || null, date: f.date || null, reference: String(f.reference || ''), source: shown('Source'), documentId, versionIndex, model: /\.(ifc|ifczip)$/i.test(String(f.filename || '')) };
      });
    }
    /** What the signed-in user may do in a project, from the extensions (BCF 3.1.4). */
    async function rights(connector, projectId) {
      const ext = await extensions(connector, projectId);
      return { project: ext.project_actions || [], topic: ext.topic_actions || [], comment: ext.comment_actions || [] };
    }
    /** One of the project's files as a File named as on the server. */
    async function downloadFile(connector, entry) {
      if (!entry.reference) throw new Error(t('opencde.err.noreference'));
      const got = await binary(connector, entry.reference, '*/*');
      return new File([got.buffer], entry.filename, { type: got.contentType || 'application/octet-stream' });
    }
    /**
     * A file from the project as a dataset of its own kind, which remembers where it came from (`source.cde`), so that Hantera
     * can tell whether a newer version exists and fetch it beside this one.
     * @param {any} connector @param {any} project {project_id, name} @param {any} entry from filesList
     * @param {{name?: string}} [options] @returns {Promise<any>} the dataset
     */
    async function importFile(connector, project, entry, options = {}) {
      const file = await downloadFile(connector, entry);
      const importer = D.require('io/import');
      const datasets = D.require('data/datasets');
      const meta = await importer.run(file, {}, null, options.name || entry.filename.replace(/\.[^.]+$/, ''));
      const cde = { connectorId: connector.id, connectorName: connector.name, host: hostOf(connector.baseUrl), projectId: project.project_id, projectName: project.name || '', kind: entry.documentId ? 'document' : 'bcf-document', reference: entry.reference, documentId: entry.documentId, versionIndex: entry.versionIndex, ifcProject: entry.ifcProject, fetchedAt: new Date().toISOString() };
      const source = Object.assign({}, meta.source || { kind: 'file', fileName: entry.filename }, { cde });
      await datasets.updateMeta(meta.id, { source });
      return datasets.get(meta.id);
    }
    /**
     * The latest versions the server has of some documents (Documents API `POST document-versions`).
     * @param {any} connector @param {string[]} documentIds @returns {Promise<any[]>} DocumentVersion objects
     */
    async function documentVersions(connector, documentIds) {
      const out = await api(connector, '/documents/1.0/document-versions', { method: 'POST', json: { document_ids: documentIds } });
      return (out && out.versions) || [];
    }
    /**
     * Whether the server has a newer version of the document a dataset came from; null when the dataset has no version.
     * @param {any} connector @param {any} ds @returns {Promise<{newer: boolean, version: any|null, have: number|null}>}
     */
    async function newerVersion(connector, ds) {
      const cde = ds.source && ds.source.cde;
      if (!cde || !cde.documentId) return { newer: false, version: null, have: null };
      const versions = await documentVersions(connector, [cde.documentId]);
      const latest = versions.find((v) => v.document_id === cde.documentId) || versions[0] || null;
      return { newer: !!(latest && Number(latest.version_index) > Number(cde.versionIndex || 0)), version: latest, have: cde.versionIndex };
    }
    // ---------------------------------------------------------------------------- writing (BCF 3.0)
    const createTopic = (connector, projectId, body) => bcf(connector, `/projects/${encode(projectId)}/topics`, { method: 'POST', json: body });
    const updateTopic = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}`, { method: 'PUT', json: body });
    const deleteTopic = (connector, projectId, topicGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}`, { method: 'DELETE' });
    const createComment = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/comments`, { method: 'POST', json: body });
    const updateComment = (connector, projectId, topicGuid, commentGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/comments/${encode(commentGuid)}`, { method: 'PUT', json: body });
    const createViewpoint = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints`, { method: 'POST', json: body });
    const deleteViewpoint = (connector, projectId, topicGuid, vpGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints/${encode(vpGuid)}`, { method: 'DELETE' });
    /** A file as a BCF document of the project (3.8.2): the body is the file, the name travels in Content-Disposition. */
    async function uploadBcfDocument(connector, projectId, file) {
      const name = String(file.name || 'document').replace(/["\\\r\n]/g, '_');
      return bcf(connector, `/projects/${encode(projectId)}/documents`, { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}` } });
    }

    // ---------------------------------------------------------------------------- Documents API: upload
    /**
     * Upload a file through the Documents API (1.0 upload flow): the server's own page asks the user for title, version and
     * project in a popup; then the parts go up and the version is completed. `documentId` makes it a new version of that document.
     * @param {any} connector @param {File} file
     * @param {{documentId?: string|null, redirectUri?: string, popup?: Function, onProgress?: (p: {done: number, total: number}) => void}} [options]
     * @returns {Promise<any|null>} the DocumentVersion, or null when the user cancelled on the page
     */
    async function uploadDocument(connector, file, options = {}) {
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file.documents'));
      const entry = { file_name: file.name, session_file_id: 'f1' };
      if (options.documentId) entry.document_id = options.documentId;
      const started = await api(connector, '/documents/1.0/upload-documents', { method: 'POST', json: { callback: { url: redirect, expires_in: 600 }, files: [entry] } });
      if (Number(started.max_size_in_bytes) > 0 && file.size > Number(started.max_size_in_bytes)) throw new Error(t('cde.err.toolarge', { max: D.require('ui/i18n').formatBytes(Number(started.max_size_in_bytes)) }));
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
    /**
     * Register this app as a client (Foundation API 2.2.3, RFC 7591) when the server allows it; the answer holds the client id
     * and, for a confidential client, the secret, which the caller keeps in api/secrets.
     * @param {string} baseUrl @param {{redirectUri: string, name?: string}} options
     */
    async function register(baseUrl, options) {
      const found = await discover(baseUrl);
      if (!found.registrationUrl) throw new Error(t('opencde.err.noregistration'));
      const body = { client_name: options.name || 'Dataspatium', client_url: 'https://github.com/marwiss/Dataspatium', software_id: 'dataspatium', software_version: D.version, redirect_uris: [options.redirectUri], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] };
      const res = await send(null, { url: found.registrationUrl, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), retries: 0 });
      if (!res.ok) throw new http.ApiError(t('opencde.err.registration', { detail: String(res.text || '').replace(/\s+/g, ' ').slice(0, 160) }), { kind: 'http', status: res.status });
      const data = JSON.parse(res.text);
      return { clientId: data.client_id, clientSecret: data.client_secret || '', found };
    }

    /** The project's files (BCF documents and Documents API files) as a table. */
    async function fetchFiles(connector, projectId) {
      const info = await filesInformation(connector, projectId);
      const rows = info.map((entry) => { const f = entry.file || {}; const source = (entry.display_information || []).find((d) => d.field_display_name === 'Source'); return { filename: f.filename, ifc_project: f.ifc_project, date: f.date, reference: f.reference, source: source ? source.field_value : null }; });
      return table(FILE_COLUMNS, rows, (r) => r);
    }

    // ---------------------------------------------------------------------------- Documents API
    /** Start a selection; the user picks on the server's page (popup) and the callback page reports back. */
    async function selectDocuments(connector, options = {}) {
      const redirect = options.redirectUri || redirectUri();
      if (!redirect) throw new Error(t('opencde.err.file'));
      const started = await api(connector, '/documents/1.0/select-documents', { method: 'POST', json: Object.assign({ callback: { url: redirect, expires_in: 600 } }, options.extensions ? { supported_file_extensions: options.extensions } : {}) });
      const callback = await (options.popup || popupFlow)(withLang(connector, started.select_documents_url));
      const q = new URL(callback).searchParams;
      if (q.get('user_cancelled_selection') === 'true') return null;
      const url = q.get('selected_documents_url');
      if (!url) throw new Error(t('opencde.err.callback'));
      return api(connector, url);
    }
    /** Download a DocumentVersion's file as a File (named as on the server). */
    async function downloadVersion(connector, version) {
      const buffer = await api(connector, version.links.document_version_download.url, { responseType: 'arraybuffer', headers: { Accept: '*/*' } });
      const name = (version.file_description && version.file_description.name) || version.title || 'document';
      return new File([buffer], name, { type: 'application/octet-stream' });
    }
    /** A readable description for a dataset's source. */
    function describe(connector, what, projectName) { return t('opencde.source', { host: hostOf(connector.baseUrl), what, project: projectName || '' }); }
    const FETCHERS = { topics: fetchTopics, comments: fetchComments, components: fetchComponents, events: fetchEvents, files: fetchFiles };
    /** Fetch again what a dataset's source recorded (api/runner calls this for family 'opencde'). */
    async function refetch(connector, source) {
      const spec = (source && source.opencde) || {};
      // Administration lists (api/families/opencde-admin) record kind 'admin' and fetch again through their own module.
      if (spec.kind === 'admin' && D.has('api/families/opencde-admin')) return D.require('api/families/opencde-admin').refetch(connector, spec);
      const fetcher = FETCHERS[spec.kind];
      if (!fetcher || !spec.projectId) throw new Error(t('api.err.nosource'));
      const out = await fetcher(connector, spec.projectId);
      return Object.assign(out, { meta: {} });
    }

    const tables = { topics: topicsTable, comments: commentsTable, components: componentsTable, events: eventsTable };
    return { FAMILY, isOpenCde, discover, capabilities, hasExtension, describeError, describeOAuthError, ensureAuthUrls, redirectUri, binary, filesList, rights, downloadFile, importFile, documentVersions, newerVersion, createTopic, updateTopic, deleteTopic, createComment, updateComment, createViewpoint, deleteViewpoint, uploadBcfDocument, uploadDocument, register, tables, login, manualStart, manualFinish, signedIn, ensureToken, logout, api, currentUser, projects, extensions, topics, comments, viewpoints, topicEvents, bcfDocuments, filesInformation, fetchTopics, fetchComments, fetchComponents, fetchEvents, fetchFiles, FETCHERS, refetch, selectDocuments, downloadVersion, topicsTable, commentsTable, componentsTable, eventsTable, parseCallback, verifier, challenge, describe, hostOf, SCOPES, CALLBACK_PAGE, popupFlow, CALLBACK_CHANNEL, CALLBACK_KEY };
  });
})();
