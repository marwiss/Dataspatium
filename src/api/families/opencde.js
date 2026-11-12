// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * OpenCDE servers as a source: buildingSMART's Foundation API 1.0 (discovery, OAuth2 authorization code with PKCE),
 * BCF API 3.0 or 2.1 (projects, topics, comments, viewpoints with their components, events) and Documents API 1.0 (the
 * user picks documents on the server's own page; the files are then downloaded and imported). A connector speaks the BCF version in
 * family.bcfVersion, the newest the server offers unless the user chose; a server of 2.1 alone has neither the Foundation API nor the
 * Documents API, so discovery does without them and the views leave out what needs them. The connector
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
    /** The versions of the BCF API this source speaks, the newest first. */
    const BCF_VERSIONS = ['3.0', '2.1'];
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };

    /** The family entry for the dialog: address and client id; the token comes from signing in. */
    const FAMILY = {
      id: 'opencde', name: 'OpenCDE (BCF, Documents)', docs: 'https://github.com/buildingSMART/foundation-API',
      // The client id is optional: left empty, the dialog registers the app with the server (RFC 7591) when the server allows it.
      fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://cde.example.org' }, { name: 'clientId', type: 'text' }, { name: 'clientSecret', type: 'secret' },
        { name: 'bcfVersion', type: 'select', advanced: true, options: [{ value: 'auto', labelKey: 'families.bcfVersion.auto' }].concat(BCF_VERSIONS.map((v) => ({ value: v, label: 'BCF API ' + v }))) }],
      auth: (v) => ({ type: 'oauth2_pkce', clientId: String(v.clientId || '').trim(), scope: SCOPES }),
      secrets: (v) => (v.clientSecret ? { clientSecret: v.clientSecret } : null),
      idHint: (v) => hostOf(v.baseUrl),
      endpoints: () => [],
      family: (v) => ({ type: 'opencde', clientId: String(v.clientId || '').trim(), bcfVersion: BCF_VERSIONS.includes(v.bcfVersion) ? v.bcfVersion : '' }),
      /** The dialog asks the server where to sign in, so that the connector can do so later; a failure is shown there. */
      async discover(v, connector) {
        learn(connector, await discover(v.baseUrl, { bcfVersion: v.bcfVersion }));
        return [];
      },
    };
    if (!databases.FAMILIES.some((f) => f.id === 'opencde')) databases.FAMILIES.push(FAMILY);
    /** True when a connector is an OpenCDE source. */
    const isOpenCde = (connector) => !!(connector && connector.family && connector.family.type === 'opencde');
    /** The version of the BCF API a connector speaks. One saved before there was a choice speaks 3.0, as does one still to learn what the server offers. @param {any} connector */
    function bcfVersion(connector) {
      const chosen = connector && connector.family && connector.family.bcfVersion;
      return BCF_VERSIONS.includes(chosen) ? chosen : '3.0';
    }
    /** Where a connector's version of the BCF API lives: the server's own address for it when it named one. @param {any} connector */
    function bcfBase(connector) {
      const version = bcfVersion(connector);
      const bases = (connector && connector.family && connector.family.bcfBases) || {};
      return bases[version] || `/bcf/${version}`;
    }
    /** Whether the server has the Documents API. A connector that has not been told otherwise is assumed to. @param {any} connector */
    const hasDocuments = (connector) => !(connector && connector.family && connector.family.documents === false);
    /**
     * The versions of the BCF API to choose between on a connector: what discovery found, or what the capabilities say for a source saved
     * before there was a choice. @param {any} connector @param {any} [caps]
     */
    function bcfVersionsOf(connector, caps) {
      const known = (connector && connector.family && connector.family.bcfVersions) || (caps && caps.present && caps.bcfVersions) || [bcfVersion(connector)];
      return BCF_VERSIONS.filter((v) => known.includes(v));
    }
    /** Keep what discovery found on the connector. @param {any} connector @param {any} found the answer of `discover` */
    function learn(connector, found) {
      Object.assign(connector.auth, { authUrl: found.authUrl, tokenUrl: found.tokenUrl, revocationUrl: found.revocationUrl });
      Object.assign(connector.family, { bcfVersion: found.bcfVersion || '', bcfVersions: found.bcfVersions, bcfBases: found.bcfBases, documents: !!found.apis.documents });
      // OAuth2 makes an unknown scope an error and no scope no error. The names are the Foundation API's, so a server without it gets none.
      if (!found.foundation) connector.auth.scope = '';
    }
    /** Speak another version of the BCF API on this connector. @param {any} connector @param {string} version */
    async function setBcfVersion(connector, version) {
      if (!BCF_VERSIONS.includes(version)) throw new Error(t('opencde.err.bcf.version', { host: hostOf(connector.baseUrl), version, offered: BCF_VERSIONS.join(', ') }));
      connector.family.bcfVersion = version;
      if (connector.id) await connectors.save(connector);
      return connector;
    }

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
    /**
     * The path of an API under a connector's address, from the `api_base_url` the server names; null when that is where it would be anyway.
     * The same machine keeps the address the user gave, since a server behind a proxy or a test stack knows itself by another name; another
     * machine is taken at its word, as the specification says. @param {any} entry @param {string} base @param {string} usual
     */
    function basePath(entry, base, usual) {
      if (!entry || !entry.api_base_url) return null;
      const machine = (host) => (host === '127.0.0.1' || host === '[::1]' ? 'localhost' : host);
      try {
        const given = new URL(entry.api_base_url, base + '/');
        const mine = new URL(base);
        const path = given.pathname.replace(/\/+$/, '');
        if (machine(given.hostname) !== machine(mine.hostname)) return given.href.replace(/\/+$/, '');
        const prefix = mine.pathname.replace(/\/+$/, '');
        if (prefix && !path.startsWith(prefix + '/')) return mine.origin + path;
        const own = path.slice(prefix.length);
        return own === usual ? null : own;
      } catch (_e) { return null; }
    }
    /**
     * The APIs the server offers and where to sign in: from the Foundation API, or on a server of BCF API 2.1 alone from what that version
     * has in its place. `apis` has the newest version of each API, `bcfVersions` the versions of the BCF API both sides speak, `bcfVersion`
     * the one to speak (`options.bcfVersion` if it names one, otherwise the newest), and `bcfBases` where a version lives when the server
     * says it is somewhere else than usual.
     * @param {string} baseUrl @param {{bcfVersion?: string}} [options]
     */
    async function discover(baseUrl, options = {}) {
      const base = trimUrl(baseUrl);
      await consent.require('opencde', { host: hostOf(base) });
      let foundation = true;
      let versions = null;
      try { versions = await getJson(base + '/foundation/versions'); } catch (first) {
        // A server of 2.1 alone answers 404, or nothing the browser may read if only its APIs have CORS headers. The first error says more.
        foundation = false;
        try { versions = await getJson(base + '/bcf/versions'); } catch (_second) { throw first; }
      }
      const entries = (Array.isArray(versions) ? versions : (versions && versions.versions) || []).map((v) => Object.assign({ api_id: 'bcf' }, v));
      const apis = {};
      for (const v of entries) if (!(v.api_id in apis)) apis[v.api_id] = v.version_id;
      if (!apis.bcf && !apis.documents) throw new Error(t('opencde.err.not.opencde', { host: hostOf(base) }));
      const bcfEntries = entries.filter((v) => v.api_id === 'bcf');
      const bcfVersions = BCF_VERSIONS.filter((id) => bcfEntries.some((v) => v.version_id === id));
      if (bcfEntries.length && !bcfVersions.length) throw new Error(t('opencde.err.bcf.unsupported', { host: hostOf(base), offered: bcfEntries.map((v) => v.version_id).join(', '), ours: BCF_VERSIONS.join(', ') }));
      if (bcfVersions.length) apis.bcf = bcfVersions[0];
      const wanted = options.bcfVersion && options.bcfVersion !== 'auto' ? options.bcfVersion : '';
      if (wanted && !bcfVersions.includes(wanted)) throw new Error(t('opencde.err.bcf.version', { host: hostOf(base), version: wanted, offered: bcfVersions.join(', ') || '–' }));
      const chosen = wanted || bcfVersions[0] || null;
      const bcfBases = {};
      for (const id of bcfVersions) { const path = basePath(bcfEntries.find((v) => v.version_id === id), base, `/bcf/${id}`); if (path) bcfBases[id] = path; }
      // A client of 2.1 reads what 2.1 says about signing in: its registration address is another, and it promises nothing about PKCE.
      const authBase = bcfBases['2.1'] && !/^[a-z][a-z0-9+.-]*:/i.test(bcfBases['2.1']) ? base + bcfBases['2.1'] : (bcfBases['2.1'] || `${base}/bcf/2.1`);
      const auth = await getJson(chosen === '2.1' || !foundation ? authBase + '/auth' : base + '/foundation/1.0/auth');
      if (!auth || !auth.oauth2_auth_url || !auth.oauth2_token_url) throw new Error(t('opencde.err.no.oauth'));
      return { apis, foundation, bcfVersions, bcfVersion: chosen, bcfBases, authUrl: auth.oauth2_auth_url, tokenUrl: auth.oauth2_token_url, revocationUrl: auth.oauth2_revocation_url || '', registrationUrl: auth.oauth2_dynamic_client_reg_url || null, pkceRequired: auth.oauth2_pkce_required !== false };
    }

    // ---------------------------------------------------------------------------- signing in
    /** A connector made while the server did not answer learns the addresses now, and keeps them. */
    async function ensureAuthUrls(connector) {
      const auth = connector.auth || (connector.auth = { type: 'oauth2_pkce' });
      if (auth.authUrl && auth.tokenUrl) return connector;
      learn(connector, await discover(connector.baseUrl, { bcfVersion: connector.family && connector.family.bcfVersion }));
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
    /** The popup flows waiting for a callback page, so that the user can stop waiting (an isolated app cannot see a closed popup). */
    const pendingPopups = new Set();
    /** Stops every waiting popup flow: the popup is closed and the flow fails with `opencde.err.cancelled`. Returns how many. */
    function cancelPopup() {
      const flows = Array.from(pendingPopups);
      for (const flow of flows) flow.cancel();
      return flows.length;
    }
    /** Whether a popup flow is waiting for the user. */
    const popupPending = () => pendingPopups.size > 0;
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
    /**
     * Dataregium renders the pages it opens in a popup (sign-in, upload, document selection) in the app's language when asked with
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
      const params = { response_type: 'code', client_id: auth.clientId, redirect_uri: redirect, scope: auth.scope === '' ? '' : (auth.scope || SCOPES), state, code_challenge: await challenge(v), code_challenge_method: 'S256' };
      for (const [k, val] of Object.entries(params)) if (val) url.searchParams.set(k, val);
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
      const params = { response_type: 'code', client_id: auth.clientId, redirect_uri: redirect, scope: auth.scope === '' ? '' : (auth.scope || SCOPES), state, code_challenge: await challenge(v), code_challenge_method: 'S256' };
      for (const [k, val] of Object.entries(params)) if (val) url.searchParams.set(k, val);
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
     * Dataregium describes its extensions in GET /.well-known/dataregium (no sign-in, outside the specifications): the server's version, the
     * enabled extensions (dynamic_client_registration, request_log, admin_api, ifcgraph, graph_query), limits and links. A server from
     * before the name change (Kontroll, up to 3.0.0) only answers on /.well-known/kontroll, which is asked when the first address gives
     * no document. A server without the document has no extensions; unknown keys count as absent. Cached a few minutes per connector.
     * @param {any} connector @param {{force?: boolean}} [options]
     * @returns {Promise<{present: boolean, server: any, apis: any, scopes: string[], extensions: Record<string, any>, limits: any, links: any}>}
     */
    async function capabilities(connector, options = {}) {
      const key = trimUrl(connector.baseUrl);
      const hit = capsCache.get(key);
      if (hit && !options.force && Date.now() - hit.at < CAPS_TTL) return hit.caps;
      let caps = EMPTY_CAPS;
      try {
        const ask = (path) => send(connector, { url: trimUrl(connector.baseUrl) + path, method: 'GET', headers: { Accept: 'application/json' }, retries: 0, rateKey: connector.id });
        let res = await ask('/.well-known/dataregium');
        if (!res.ok) res = await ask('/.well-known/kontroll');
        if (res.ok) {
          const data = JSON.parse(res.text || '{}') || {};
          caps = { present: true, server: data.server || null, apis: data.apis || {}, bcfVersions: Array.isArray(data.bcf_versions) ? data.bcf_versions : null, scopes: Array.isArray(data.scopes) ? data.scopes : [], extensions: data.extensions && typeof data.extensions === 'object' ? data.extensions : {}, limits: data.limits || {}, links: data.links || {} };
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
      if (!res.ok) throw failure(connector, res, url);
      if (options.responseType === 'arraybuffer') return res.buffer;
      const text = (res.text || '').trim();
      const data = text ? JSON.parse(text) : null;
      return req.method === 'GET' && Array.isArray(data) ? rest(connector, req, res, data) : data;
    }
    /** The error of an answer that is not OK, with the server's code, report and conflicts when it gives them. */
    function failure(connector, res, url) {
      let data = null;
      try { data = JSON.parse(res.text); } catch (_e) { /* not JSON */ }
      const { code, message, text } = describeError(data);
      return new http.ApiError(`${connector.name}: ${http.describeStatus(res.status)}${text ? ' ' + text : ''}`, { kind: 'http', status: res.status, url, detail: message, code, report: data && typeof data.report === 'string' ? data.report : undefined, conflicts: data && Array.isArray(data.conflicts) ? data.conflicts.map(String) : undefined, conflictDetails: data && Array.isArray(data.conflict_details) ? data.conflict_details : undefined });
    }
    const MAX_LINK_PAGES = 200;
    /**
     * The rest of a list the server has capped (Dataregium at 1000 items): its answer says where the next part is with
     * Link rel="next" until the last. Only addresses on the same server are followed, so the token never goes elsewhere.
     */
    async function rest(connector, req, res, first) {
      const origin = new URL(req.url).origin;
      const seen = new Set([req.url]);
      let all = first; let last = res;
      for (let n = 0; n < MAX_LINK_PAGES; n++) {
        const link = http.linkHeader(last.headers && last.headers.get ? last.headers.get('Link') : null, 'next');
        if (!link) break;
        const next = new URL(link, req.url);
        if (next.origin !== origin || seen.has(next.href)) break;
        seen.add(next.href);
        last = await send(connector, Object.assign({}, req, { url: next.href }), { kind: 'json' });
        if (!last.ok) throw failure(connector, last, next.href);
        const page = JSON.parse((last.text || '').trim() || '[]');
        if (!Array.isArray(page)) break;
        all = all.concat(page);
      }
      return all;
    }
    const bcf = (connector, path, options) => api(connector, bcfBase(connector) + path, options);
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

    /** 3.0 leaves the signed-in user to the Foundation API; 2.1 has a service of its own. */
    const currentUser = (connector) => (bcfVersion(connector) === '2.1' ? bcf(connector, '/current-user') : api(connector, '/foundation/1.0/current-user'));
    const projects = (connector) => bcf(connector, '/projects');
    /** The project's allowed values. 2.1 calls the list of users `user_id_type`, and the rest of the app reads `users`. */
    async function extensions(connector, projectId) {
      const ext = await bcf(connector, `/projects/${encode(projectId)}/extensions`);
      return ext && ext.user_id_type && !ext.users ? Object.assign({}, ext, { users: ext.user_id_type }) : ext;
    }
    const topics = (connector, projectId, params) => bcf(connector, `/projects/${encode(projectId)}/topics${odata(params)}`);
    /** Every topic of a project, page by page. Paging is optional in 2.1, so a page that starts over ends the reading. */
    async function allTopics(connector, projectId, options = {}) {
      const all = [];
      for (let skip = 0; ; skip += 500) {
        const page = await topics(connector, projectId, Object.assign({ $top: 500, $skip: skip }, options.filter ? { $filter: options.filter } : {}));
        if (page.length && all.length && page[0].guid === all[0].guid) break;
        all.push(...page);
        if (page.length < 500 || all.length >= 20000) break;
      }
      return all;
    }
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
    const COMMENT_COLUMNS = ['topic_guid', 'topic', 'guid', 'date', 'author', 'comment', 'viewpoint_guid', 'modified_date', 'modified_author', 'reply_to_comment_guid'];
    function commentsTable(list) { return table(COMMENT_COLUMNS, list, (c) => c); }
    const COMPONENT_COLUMNS = ['topic', 'topic_guid', 'viewpoint_guid', 'role', 'ifc_guid', 'color', 'originating_system', 'authoring_tool_id', 'snapshot'];
    function componentsTable(list) { return table(COMPONENT_COLUMNS, list, (c) => c); }
    const EVENT_COLUMNS = ['topic_guid', 'date', 'author', 'type', 'value'];
    function eventsTable(list) { return table(EVENT_COLUMNS, list, (e) => e); }
    const FILE_COLUMNS = ['filename', 'ifc_project', 'date', 'reference', 'source'];

    /** Every topic of a project (all pages of 500) as a table. */
    async function fetchTopics(connector, projectId, options = {}) {
      return topicsTable(await allTopics(connector, projectId, options));
    }
    /** All comments of all topics (or of the given topics) as one table. */
    async function fetchComments(connector, projectId, topicList) {
      const list = topicList || (await allTopics(connector, projectId));
      const out = [];
      for (const tp of list) for (const c of await comments(connector, projectId, tp.guid)) out.push(Object.assign({ topic: tp.title }, c));
      return commentsTable(out);
    }
    /** The components of every viewpoint (selection and coloring) as one table: one row per component. */
    async function fetchComponents(connector, projectId, topicList) {
      const list = topicList || (await allTopics(connector, projectId));
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
      if (bcfVersion(connector) === '2.1') {
        // 2.1 has no files information. Its documents are the files it can name, and a server may have none.
        const documents = await bcfDocuments(connector, projectId).catch((err) => { if (err && err.status === 404) return []; throw err; });
        return documents.map((d) => { const name = String(d.filename || d.file_name || 'document'); return { filename: name, ifcProject: null, date: null, reference: `${bcfBase(connector)}/projects/${encode(projectId)}/documents/${encode(d.guid)}`, source: 'BCF', documentId: null, versionIndex: null, model: /\.(ifc|ifczip)$/i.test(name) }; });
      }
      const info = await filesInformation(connector, projectId);
      return info.map((entry) => {
        const f = entry.file || {};
        const shown = (name) => { const d = (entry.display_information || []).find((x) => x.field_display_name === name); return d ? String(d.field_value || '') : ''; };
        // Dataregium names the document and the version in display fields; other servers may only give the address.
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
    const versionPath = (documentId, versionIndex) => `/documents/1.0/documents/${encode(documentId)}/versions/${encode(String(versionIndex))}`;
    /**
     * A document version's metadata (Documents API): the entries given at upload and, on Dataregium from 3.0.0, the server's
     * check of an IFC file (`ifc_validation_*`).
     * @param {any} connector @param {string} documentId @param {number} versionIndex @returns {Promise<any[]>} DocumentMetadataEntry objects
     */
    async function versionMetadata(connector, documentId, versionIndex) {
      const out = await api(connector, versionPath(documentId, versionIndex) + '/metadata');
      return (out && Array.isArray(out.metadata)) ? out.metadata : [];
    }
    /**
     * The server's report of its check of an IFC version, an extension of Dataregium's; null when the version was never checked.
     * The address is built here and never taken from the metadata, so the token goes to the source's own server only.
     * @param {any} connector @param {string} documentId @param {number} versionIndex @returns {Promise<any|null>}
     */
    async function validationReport(connector, documentId, versionIndex) {
      try { return await api(connector, versionPath(documentId, versionIndex) + '/ifc-validation'); }
      catch (err) { if (err && err.status === 404) return null; throw err; }
    }
    /**
     * A capability's address on the server, its placeholders filled in. Only a path is taken from the capabilities, never a whole
     * address, so the token stays with the source's own server.
     */
    function capPath(caps, name, field, fallback, values) {
      const raw = caps && caps.extensions && caps.extensions[name] ? caps.extensions[name][field] : null;
      let path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback;
      for (const [k, v] of Object.entries(values)) path = path.split('{' + k + '}').join(encode(String(v)));
      return path;
    }
    const PUBLICATION = '/documents/1.0/documents/{document_id}/versions/{version_index}/publication';
    /**
     * How a version is published (Dataregium's publication): {published_at, published_by, file_name, size_in_bytes, sha256}, or null
     * when it is not published or the server has no publication. Every member may ask.
     * @param {any} connector @param {string} documentId @param {number} versionIndex
     */
    async function publication(connector, documentId, versionIndex) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'publication')) return null;
      try { return await api(connector, capPath(caps, 'publication', 'url', PUBLICATION, { document_id: documentId, version_index: versionIndex })); }
      catch (err) { if (err && err.status === 404) return null; throw err; }
    }
    /** Whether the server can publish versions at all. @param {any} connector */
    async function canPublish(connector) { return hasExtension(await capabilities(connector), 'publication'); }
    /**
     * Publish a version, as a manager of the project: once, and not while the version is checked or after its check found
     * errors (409). @param {any} connector @param {string} documentId @param {number} versionIndex
     */
    async function publish(connector, documentId, versionIndex) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'publication')) throw new Error(t('cde.publication.unsupported'));
      return api(connector, capPath(caps, 'publication', 'url', PUBLICATION, { document_id: documentId, version_index: versionIndex }), { method: 'POST' });
    }
    /** The published archive (.ifczip, or .zip for another file) as a File. */
    async function publicationFile(connector, documentId, versionIndex, fileName) {
      const caps = await capabilities(connector);
      const got = await binary(connector, capPath(caps, 'publication', 'url', PUBLICATION, { document_id: documentId, version_index: versionIndex }) + '/download', '*/*');
      return new File([got.buffer], fileName || 'publicering.zip', { type: got.contentType || 'application/zip' });
    }
    /**
     * Ask the server to propose removing what no GlobalId reaches in a version (Dataregium's ifc-unreachable): a topic whose change
     * set deletes those instances, tried and approved like any other. Null when the server has no such proposal; 409 when nothing
     * is out of reach, 404 when the version has no converted model.
     * @returns {Promise<{topic_guid: string, title: string, changes: number, proposal_url: string}|null>}
     */
    async function proposeUnreachable(connector, projectId, documentId, versionIndex) {
      const caps = await capabilities(connector);
      const changes = caps && caps.extensions && caps.extensions.ifc_changes;
      if (!changes || !changes.enabled || !changes.unreachable_url) return null;
      const path = capPath(caps, 'ifc_changes', 'unreachable_url', '/documents/1.0/projects/{project_id}/ifc-unreachable', { project_id: projectId, id: projectId });
      return api(connector, path, { method: 'POST', json: { document_id: documentId, version_index: Number(versionIndex) } });
    }
    /**
     * An address the server hands out for a job or a report, used only when it is on the server itself (else the path the app
     * builds), so that the token never goes elsewhere. Behind a proxy the server may name another host than the connector's; then
     * the app's own path is the one that holds. @param {any} connector @param {string} url @param {string} path
     */
    function ownUrl(connector, url, path) {
      const base = trimUrl(connector.baseUrl);
      try { const u = new URL(String(url || ''), base + '/'); if (url && u.origin === new URL(base).origin) return u.href; } catch (_e) { /* not an address */ }
      return base + path;
    }
    /**
     * Ask again until a job is over: `done`, `failed`, `conflict` or `expired` end it, `queued` and `running` go on. The wait
     * grows from one to five seconds, and ends with an error after `timeoutMs` (ten minutes).
     * @param {() => Promise<any>} once @param {{timeoutMs?: number, onState?: (job: any) => void, signal?: AbortSignal}} [options]
     */
    async function untilOver(once, options = {}) {
      const end = Date.now() + (options.timeoutMs || 600000);
      for (let wait = 1000; ; wait = Math.min(5000, wait + 1000)) {
        const job = await once();
        if (options.onState) options.onState(job);
        if (!job || !['queued', 'running', 'pending'].includes(String(job.state))) return job;
        if (Date.now() > end) throw new Error(t('opencde.job.timeout'));
        if (options.signal && options.signal.aborted) throw new http.ApiError('Avbrutet.', { kind: 'aborted' });
        await http.sleep(wait, options.signal);
      }
    }
    const CLASH = '/documents/1.0/projects/{project_id}/ifc-clash';
    const GEOMETRY = '/documents/1.0/documents/{document_id}/versions/{version_index}/ifc-geometry';
    const QUERIES = '/documents/1.0/documents/{document_id}/versions/{version_index}/ifc-queries';
    /** Whether the server gives a version's geometry as binary glTF (Dataregium's ifc_geometry). @param {any} connector */
    async function canGeometry(connector) { return hasExtension(await capabilities(connector), 'ifc_geometry'); }
    /**
     * A version's geometry as binary glTF (Dataregium's ifc_geometry, step 4): `lod` full or box, `classes` IFC classes comma-separated,
     * `storey` a GlobalId. The server answers 404 when it has no geometry for the version and 409 while it converts.
     * @param {any} connector @param {string} documentId @param {number} versionIndex @param {{lod?: string, classes?: string, storey?: string}} [options]
     * @returns {Promise<ArrayBuffer>}
     */
    async function ifcGeometry(connector, documentId, versionIndex, options = {}) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_geometry')) throw new Error(t('large.err.unsupported'));
      const q = new URLSearchParams();
      q.set('lod', options.lod === 'box' ? 'box' : 'full');
      if (options.classes) q.set('classes', String(options.classes));
      if (options.storey) q.set('storey', String(options.storey));
      const path = capPath(caps, 'ifc_geometry', 'url', GEOMETRY, { document_id: documentId, version_index: versionIndex });
      return api(connector, path + '?' + q.toString(), { responseType: 'arraybuffer', headers: { Accept: 'model/gltf-binary' } });
    }
    /**
     * A named query of a version's model (Dataregium's ifc_queries): {name, columns, rows, truncated}.
     * @param {any} connector @param {string} documentId @param {number} versionIndex @param {string} name @param {Record<string, any>} [params]
     */
    async function ifcQuery(connector, documentId, versionIndex, name, params = {}) {
      const caps = await capabilities(connector);
      const base = capPath(caps, 'ifc_queries', 'url', QUERIES, { document_id: documentId, version_index: versionIndex });
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      const qs = q.toString();
      return api(connector, base + '/' + encode(String(name)) + (qs ? '?' + qs : ''));
    }
    /** Whether the server checks for clashes itself (Dataregium's ifc_clash). @param {any} connector */
    async function canClash(connector) { return hasExtension(await capabilities(connector), 'ifc_clash'); }
    /**
     * The server's clash check between two versions of the project: started, waited for, and its report with the clashes.
     * @param {any} connector @param {string} projectId
     * @param {{a: {document_id: string, version_index: number, types?: string[]}, b: any, mode: string, tolerance?: number, clearance?: number}} body
     * @param {{onState?: (job: any) => void, signal?: AbortSignal, timeoutMs?: number}} [options]
     */
    async function serverClash(connector, projectId, body, options = {}) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_clash')) throw new Error(t('clash.server.unsupported'));
      const path = capPath(caps, 'ifc_clash', 'url', CLASH, { project_id: projectId });
      const job = await api(connector, path, { method: 'POST', json: body });
      const url = ownUrl(connector, job && job.url, path + '/' + encode(String(job && job.id)));
      const report = await untilOver(() => api(connector, url), options);
      return Object.assign({ id: job.id }, report);
    }
    /** Topics of chosen clashes of a server report, a hundred at a time, each with its viewpoint. @returns {Promise<any[]>} */
    async function serverClashTopics(connector, projectId, clashId, indices) {
      const caps = await capabilities(connector);
      const path = capPath(caps, 'ifc_clash', 'url', CLASH, { project_id: projectId }) + '/' + encode(String(clashId)) + '/topics';
      const out = [];
      for (let i = 0; i < indices.length; i += 100) out.push(...((await api(connector, path, { method: 'POST', json: { clashes: indices.slice(i, i + 100) } })) || []));
      return out;
    }
    const MERGE = '/documents/1.0/projects/{project_id}/ifc-merge';
    /** Whether the server can bring a building of one model into another (Dataregium's ifc_merge). @param {any} connector */
    async function canMerge(connector) { return hasExtension(await capabilities(connector), 'ifc_merge'); }
    async function mergePaths(connector, projectId) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_merge')) throw new Error(t('merge.unsupported'));
      const values = { project_id: projectId };
      const url = capPath(caps, 'ifc_merge', 'url', MERGE, values);
      return { url, report: capPath(caps, 'ifc_merge', 'report_url', MERGE + '/report', values), prepare: capPath(caps, 'ifc_merge', 'prepare_url', MERGE + '/prepare', values) };
    }
    /**
     * What bringing B's building into A's model would do: `objects`, `instances`, `collisions` [{global_id, ifc_class, same,
     * choice}], `left_out`, `contexts` and `placements`. 422 when it cannot be done, such as for another schema or unit.
     * @param {any} connector @param {string} projectId @param {any} body {base, other, building, site?, choices?, default?}
     */
    async function mergeReport(connector, projectId, body) {
      return api(connector, (await mergePaths(connector, projectId)).report, { method: 'POST', json: body });
    }
    /**
     * The merge itself, as a manager of A's project: a job that ends `done` with the new `version_index` of A's document,
     * `conflict` with what still lacks a choice, or `failed`. 412 when A's version is not the latest.
     */
    async function merge(connector, projectId, body, options = {}) {
      const paths = await mergePaths(connector, projectId);
      const job = await api(connector, paths.url, { method: 'POST', json: body });
      return untilOver(() => api(connector, ownUrl(connector, job && job.url, paths.url + '/' + encode(String(job && job.merge_id)))), options);
    }
    /** A copy of B migrated to A's schema and unit, for a day: the job, whose `merge_id` goes into `other.prepared`. */
    async function prepareMerge(connector, projectId, body, options = {}) {
      const paths = await mergePaths(connector, projectId);
      // A copy made earlier is not named when preparing again: the server refuses `prepared` here (400).
      const other = Object.assign({}, body.other);
      delete other.prepared;
      const job = await api(connector, paths.prepare, { method: 'POST', json: { base: body.base, other } });
      return untilOver(() => api(connector, ownUrl(connector, job && job.url, paths.url + '/' + encode(String(job && job.merge_id)))), options);
    }
    // ---------------------------------------------------------------------------- writing
    const createTopic = (connector, projectId, body) => bcf(connector, `/projects/${encode(projectId)}/topics`, { method: 'POST', json: body });
    const updateTopic = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}`, { method: 'PUT', json: body });
    const deleteTopic = (connector, projectId, topicGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}`, { method: 'DELETE' });
    const createComment = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/comments`, { method: 'POST', json: body });
    const updateComment = (connector, projectId, topicGuid, commentGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/comments/${encode(commentGuid)}`, { method: 'PUT', json: body });
    /** A viewpoint as the version wants it: a camera's aspect ratio came with 3.0, and a server of 2.1 may refuse what it does not know. */
    function viewpointFor(connector, body) {
      if (bcfVersion(connector) !== '2.1') return body;
      const out = Object.assign({}, body);
      for (const key of ['perspective_camera', 'orthogonal_camera']) if (out[key]) { out[key] = Object.assign({}, out[key]); delete out[key].aspect_ratio; }
      return out;
    }
    const createViewpoint = (connector, projectId, topicGuid, body) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints`, { method: 'POST', json: viewpointFor(connector, body) });
    /** Deleting a viewpoint came with 3.0, so a connector of 2.1 says so instead of getting a 405 from the server. */
    async function deleteViewpoint(connector, projectId, topicGuid, vpGuid) {
      if (bcfVersion(connector) === '2.1') throw new Error(t('opencde.err.bcf21.deleteviewpoint'));
      return bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/viewpoints/${encode(vpGuid)}`, { method: 'DELETE' });
    }
    /**
     * A file as a BCF document of the project (3.8.2): the body is the file, its media type (octet-stream when the file has none) in
     * Content-Type, the name in Content-Disposition. @param {any} connector @param {string} projectId @param {File} file
     * @param {{signal?: AbortSignal}} [options] @returns {Promise<any>} the document {guid, filename}
     */
    async function uploadBcfDocument(connector, projectId, file, options = {}) {
      const name = String(file.name || 'document').replace(/["\\\r\n]/g, '_');
      return bcf(connector, `/projects/${encode(projectId)}/documents`, { method: 'POST', body: await file.arrayBuffer(), signal: options.signal, headers: { 'Content-Type': String(file.type || '').split(';')[0].trim() || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}` } });
    }
    /**
     * A document reference on a topic (3.7.2): `{document_guid, description}` for a document of the project, `{url, description}` for an
     * address elsewhere; a server of 2.1 takes `{referenced_document, description}` with an address (4.7.2). The body goes as given.
     * @param {any} connector @param {string} projectId @param {string} topicGuid @param {any} body @param {{signal?: AbortSignal}} [options]
     */
    const createDocumentReference = (connector, projectId, topicGuid, body, options = {}) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/document_references`, { method: 'POST', json: body, signal: options.signal });

    // ---------------------------------------------------------------------------- a topic's model file and documents
    /**
     * Whether the signed-in person may do something with a topic: the topic's own `authorization` when it has one, the project's
     * defaults in its extensions otherwise (BCF 3.2.8). @param {any} ext the project's extensions @param {any} topic @param {string} action
     */
    function topicMay(ext, topic, action) {
      const own = topic && topic.authorization && Array.isArray(topic.authorization.topic_actions) ? topic.authorization.topic_actions : null;
      return (own || (ext && Array.isArray(ext.topic_actions) ? ext.topic_actions : [])).includes(action);
    }
    /** Whether the project's extensions allow an action on the project (BCF 3.1.5), such as createDocument. */
    const projectMay = (ext, action) => !!(ext && Array.isArray(ext.project_actions) && ext.project_actions.includes(action));
    /** The model files in a topic's header (3.3.2). */
    const topicFiles = (connector, projectId, topicGuid) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/files`);
    /**
     * Files in the form the connector's version takes: 3.0 names the file `filename`, 2.1 `file_name`; empty values are left out.
     * @param {any} connector @param {any[]} files @returns {any[]}
     */
    function filesBody(connector, files) {
      const nameKey = bcfVersion(connector) === '2.1' ? 'file_name' : 'filename';
      return (files || []).filter(Boolean).map((f) => {
        const out = {};
        for (const key of ['ifc_project', 'ifc_spatial_structure_element', 'date', 'reference']) if (f[key] !== undefined && f[key] !== null && f[key] !== '') out[key] = f[key];
        const name = f.filename || f.file_name;
        if (name) out[nameKey] = name;
        return out;
      });
    }
    /** The topic's header files replaced (3.3.3); the server allows it with `updateFiles`. */
    const setTopicFiles = (connector, projectId, topicGuid, files) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/files`, { method: 'PUT', json: filesBody(connector, files) });
    /**
     * The model file a topic is about: the project's own entry (files_information, 3.3.1) for the document version the model dataset
     * came from, which the server must take, with the IfcProject added when the entry has none; otherwise `fallback`, the file's own
     * header facts (data/bcf-xml.headerOf). Null when there is neither.
     * @param {any} connector @param {string} projectId @param {any} cde the model dataset's `source.cde` @param {any} [fallback]
     */
    async function modelFile(connector, projectId, cde, fallback) {
      if (cde && bcfVersion(connector) !== '2.1' && cde.connectorId === connector.id && cde.projectId === projectId && (cde.reference || cde.documentId)) {
        const info = await filesInformation(connector, projectId).catch(() => []);
        const sameVersion = (ref) => { const m = /\/documents\/([^/]+)\/versions\/(\d+)\/download/.exec(String(ref || '')); return !!m && decodeURIComponent(m[1]) === cde.documentId && Number(m[2]) === Number(cde.versionIndex); };
        const hit = (Array.isArray(info) ? info : []).map((e) => e && e.file).filter(Boolean).find((f) => (cde.reference && f.reference === cde.reference) || (cde.documentId && sameVersion(f.reference)));
        if (hit) return Object.assign({}, hit, { filename: hit.filename || hit.file_name || (fallback && fallback.filename) || undefined }, !hit.ifc_project && fallback && fallback.ifc_project ? { ifc_project: fallback.ifc_project } : {});
      }
      return fallback || null;
    }
    /**
     * Ties a topic to its model file (3.3.3) when the person may (`updateFiles`). Returns the files the server keeps, or null when it does
     * not offer it or there is no file. @param {any} connector @param {string} projectId @param {any} topic @param {any} ext @param {any} file
     */
    async function linkTopic(connector, projectId, topic, ext, file) {
      if (!file || !topic || !topic.guid || !topicMay(ext, topic, 'updateFiles')) return null;
      return setTopicFiles(connector, projectId, topic.guid, [file]);
    }
    /**
     * A file attached to a topic as a document of the project (3.8.2) and a document reference to it (3.7.2), when the person may do
     * both (`createDocument`, `updateDocumentReferences`) and the server speaks 3.0. Null when not, so that the caller can do otherwise.
     * @param {any} connector @param {string} projectId @param {string} topicGuid @param {File} file @param {string} description @param {any} ext
     * @returns {Promise<{document: any, reference: any}|null>}
     */
    async function attachDocument(connector, projectId, topicGuid, file, description, ext) {
      if (bcfVersion(connector) === '2.1' || !projectMay(ext, 'createDocument') || !topicMay(ext, null, 'updateDocumentReferences')) return null;
      const document = await uploadBcfDocument(connector, projectId, file);
      if (!document || !document.guid) throw new Error(t('api.err.service', { message: connector.name }));
      const reference = await createDocumentReference(connector, projectId, topicGuid, Object.assign({ document_guid: document.guid }, description ? { description } : {}));
      return { document, reference };
    }
    /** The signed-in person's id on the server, for the author of a BCF file; null when not signed in or the server does not say. */
    async function identity(connector) {
      if (!connector || !signedIn(connector)) return null;
      try { const me = await currentUser(connector); const id = me && (me.id || me.email || me.name); return id ? String(id) : null; } catch (_e) { return null; }
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
      // Dataregium's extension: the version this upload builds on; the completion answers 412 version_conflict when a newer one exists.
      if (options.documentId && options.baseVersionIndex !== undefined && options.baseVersionIndex !== null) entry.base_version_index = Number(options.baseVersionIndex);
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
      const finished = await api(connector, todo.upload_completion.url, { method: 'POST' });
      // Dataregium's OB-28: a project may refuse a file with validation errors at the completion (422 ifc_validation_failed with the
      // report's address). A check that took long comes as 200 with the same code in the body, so the code decides, not the status.
      if (finished && typeof finished.code === 'string' && finished.code === 'ifc_validation_failed') {
        const d = describeError(finished);
        throw new http.ApiError(`${connector.name}: ${d.text || d.message}`, { kind: 'http', status: 422, url: todo.upload_completion.url, detail: d.message, code: d.code, report: typeof finished.report === 'string' ? finished.report : undefined });
      }
      return finished;
    }
    /**
     * Dataregium's precheck (OB-28): the server checks an IFC file against the schema, buildingSMART's rules and the project's IDS
     * without making it a version. The report has the form of a version's validation report with `status` pending, passed, warnings,
     * issues or unknown; this polls until it is done. Null when the server has no precheck.
     * @param {any} connector @param {string} projectId @param {Uint8Array|ArrayBuffer} bytes @param {string} fileName
     * @param {{signal?: AbortSignal, pollMs?: number, timeoutMs?: number, onStatus?: (status: string) => void}} [options]
     */
    async function precheck(connector, projectId, bytes, fileName, options = {}) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_precheck')) return null;
      const path = String(caps.extensions.ifc_precheck.url || '/documents/1.0/projects/{project_id}/ifc-precheck').replace('{project_id}', encode(projectId));
      const safe = String(fileName || 'model.ifc').replace(/["\\\r\n]/g, '_');
      let report = await api(connector, path, { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${safe}"` }, signal: options.signal });
      const t0 = Date.now();
      while (report && report.status === 'pending' && report.url && Date.now() - t0 < (options.timeoutMs || 180000)) {
        if (options.onStatus) options.onStatus('pending');
        await new Promise((resolve) => setTimeout(resolve, options.pollMs || 2000));
        if (options.signal && options.signal.aborted) break;
        report = await api(connector, report.url, { signal: options.signal });
      }
      return report;
    }
    /**
     * Dataregium's change proposal (its OB-25/OB-26): a BCF topic whose bim_snippet is a change set of the type
     * DataregiumIfcChangeSet, held to the schema the capabilities name (`ifc_changes`). The snippet is uploaded after the topic;
     * when the server refuses it (400 with what is wrong) the topic is removed again. Null when the server has no `ifc_changes`.
     * @param {any} connector @param {string} projectId
     * With `ops` (the write tools' operations, `ai/write-tools.toWheel`) and a server whose capability names `ops_form`
     * "dataspatium-tools/1", the snippet also carries `ops_form` and `ops`, so that created elements, deletions and relationships
     * are part of the proposal; `changes` then may be empty.
     * @param {any} connector @param {string} projectId
     * @param {{title: string, description?: string, topicType?: string, changeSet: {base: any, provenance: any, changes: any[]}, ops?: any[]}} options
     * @returns {Promise<{topic: any, schemaUrl: string, snippetType: string, tried: boolean, proposalUrl: string|null, approveUrl: string|null, changeSet: any, opsForm: string|null}|null>}
     */
    async function proposeChanges(connector, projectId, options) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_changes')) return null;
      const ext = caps.extensions.ifc_changes;
      const schemaPath = String(ext.schema || '/documents/1.0/ifc-changes/schema');
      const schemaUrl = /^[a-z][a-z0-9+.-]*:/i.test(schemaPath) ? schemaPath : trimUrl(connector.baseUrl) + schemaPath;
      const changes = options.changeSet && Array.isArray(options.changeSet.changes) ? options.changeSet.changes : [];
      // A server that announces the write tools' own form takes their operations as well (decision F43 b, step 5): created
      // elements, deletions and relationships reach the proposal, and the server applies them to the base with the same code.
      const ops = ext.ops_form === OPS_FORM && Array.isArray(options.ops) && options.ops.length ? options.ops : null;
      if (!changes.length && !ops) throw new Error(t('opencde.err.changes.none'));
      const max = Number(ext.max_changes) || 10000;
      if (changes.length > max || (ops && ops.length > max)) throw new Error(t('opencde.err.changes.max', { n: String(max) }));
      const changeSet = ops ? Object.assign({}, options.changeSet, { ops_form: OPS_FORM, ops }) : options.changeSet;
      const snippetType = String(ext.snippet_type || 'DataregiumIfcChangeSet');
      const body = { title: String(options.title || '').trim() || snippetType, description: options.description || '', bim_snippet: { snippet_type: snippetType, is_external: false, reference: 'changes.json', reference_schema: schemaUrl } };
      if (options.topicType) body.topic_type = options.topicType;
      const topic = await createTopic(connector, projectId, body);
      try {
        await putChangeSet(connector, projectId, topic.guid, schemaUrl, changeSet);
      } catch (err) {
        await deleteTopic(connector, projectId, topic.guid).catch(() => {});
        throw err;
      }
      const fill = (template) => (template ? String(template).replace('{project_id}', encode(projectId)).replace('{topic_guid}', encode(topic.guid)) : null);
      const proposalUrl = fill(ext.proposal_url);
      return { topic, schemaUrl, snippetType, tried: !!ext.tried && !!proposalUrl, proposalUrl, approveUrl: fill(ext.approve_url), changeSet, opsForm: ops ? OPS_FORM : null };
    }
    /**
     * The change set of a proposal's topic, uploaded as its snippet; a new one replaces the server's trial (Dataregium's OB-26).
     * @param {any} connector @param {string} projectId @param {string} topicGuid @param {string} schemaUrl
     * @param {{base: any, provenance: any, changes: any[]}} changeSet
     */
    /**
     * Whether the signed-in person may propose changes in a project: Dataregium's floor is the role editor (its decision F35 a), which
     * the BCF project's `authorization.project_actions` shows as "createDocument" (contributor has only "createTopic"). True when the
     * server says nothing about it, so that an older server's own answer decides.
     * @param {any} connector @param {string} projectId @returns {Promise<boolean>}
     */
    async function canPropose(connector, projectId) {
      const project = await bcf(connector, `/projects/${encode(projectId)}`);
      const actions = project && project.authorization && Array.isArray(project.authorization.project_actions) ? project.authorization.project_actions : null;
      return actions === null ? true : actions.includes('createDocument');
    }
    /**
     * A project's AI policy on Dataregium (its decision F29 a): "local" (only a model on the person's own computer) or "cloud", read at
     * the capability's template `extensions.ai_policy.url` ({project_id}; also `extensions.mcp.ai_policy_url`), where an unknown or
     * missing value reads as local; the capability's default (local) when the endpoint fails; null when the server announces no
     * policy, so that only the app's own policy applies.
     * @param {any} connector @param {string} projectId @returns {Promise<'local'|'cloud'|null>}
     */
    async function aiPolicy(connector, projectId) {
      const caps = await capabilities(connector);
      const ext = (caps && caps.extensions) || {};
      const own = ext.ai_policy && ext.ai_policy.enabled !== false && ext.ai_policy.url ? ext.ai_policy : null;
      const mcp = ext.mcp && ext.mcp.ai_policy_url ? ext.mcp : null;
      if (!own && !mcp) return null;
      const url = own ? own.url : mcp.ai_policy_url;
      const fallback = (own ? own.default : mcp.default_ai_policy) === 'cloud' ? 'cloud' : 'local';
      try {
        const got = await api(connector, String(url).replace('{project_id}', encode(projectId)));
        return got && got.ai_policy === 'cloud' ? 'cloud' : 'local';
      } catch (err) {
        D.log('opencde', 'the AI policy could not be read', err);
        return fallback;
      }
    }
    /** The form of the write tools' operations a proposal can carry, when the server's capability names it (`ifc_changes.ops_form`). */
    const OPS_FORM = 'dataspatium-tools/1';
    /** OPS_FORM when the server takes the operations in a proposal, otherwise null. @param {any} connector */
    async function opsForm(connector) {
      const caps = await capabilities(connector);
      return hasExtension(caps, 'ifc_changes') && caps.extensions.ifc_changes.ops_form === OPS_FORM ? OPS_FORM : null;
    }
    const putChangeSet = (connector, projectId, topicGuid, schemaUrl, changeSet) => bcf(connector, `/projects/${encode(projectId)}/topics/${encode(topicGuid)}/snippet`, { method: 'PUT', body: JSON.stringify(Object.assign({ schema: schemaUrl }, changeSet)), headers: { 'Content-Type': 'application/json' } });
    /**
     * A manager makes a clean proposal the document's next version (Dataregium's OB-27): POST at the capability's approve_url. The
     * answer is the new version in the Documents API's form, with base_version_index, change_set_id, proposed_by and approved_by in its
     * metadata. 403 for other roles, 409 when the trial is not clean or was approved already. Against a stale base (OB-17 there) the
     * server tries the changes again on the latest version in the same call and approves against it when clean; when they collide with
     * what came between it answers 412 version_conflict with `conflicts`, keys like "#123.Name" or "<guid>/<path>.Name", or ["*"] when a
     * whole file was uploaded in between; the error carries them, and `conflictDetails` with the value in the base (`base`), in the
     * latest version (`theirs`) and in the proposal (`ours`) for each key the person decides (OB-19 d).
     * @param {any} connector @param {string} approveUrl from proposeChanges
     */
    const approveProposal = (connector, approveUrl) => api(connector, approveUrl, { method: 'POST' });
    /**
     * The change proposals the server holds against a document (Dataregium's list): one row per topic with a proposal against the
     * document, newest first: topic_guid, title, description, state (queued, running, clean, issues, failed, approved),
     * base_version_index, change_count, author, checked_at, version_index when approved, proposal_url and approve_url. The address is
     * the capability's template `ifc_changes.ifc_proposals_url` ({project_id}, {document_id}); null when the server has no list.
     * @param {any} connector @param {string} projectId @param {string} documentId
     * @returns {Promise<any[]|null>}
     */
    async function ifcProposals(connector, projectId, documentId) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_changes') || !caps.extensions.ifc_changes.ifc_proposals_url) return null;
      const url = String(caps.extensions.ifc_changes.ifc_proposals_url).replace('{project_id}', encode(projectId)).replace('{document_id}', encode(documentId));
      const got = await api(connector, url);
      return Array.isArray(got) ? got : (got && Array.isArray(got.proposals) ? got.proposals : []);
    }
    /**
     * The server's trial of a change proposal (Dataregium's OB-26): after the snippet is uploaded the server applies the changes to
     * the base version's file and checks the result. The report has state queued, running, clean, issues or failed, `applied` of
     * `change_count`, and `issues` in the form of the validation report (kind "proposal" for a change that could not be applied,
     * with the reason); this polls until the state is final. Null when the server does not try proposals.
     * @param {any} connector @param {string|null} proposalUrl from proposeChanges
     * @param {{signal?: AbortSignal, pollMs?: number, timeoutMs?: number, onStatus?: (state: string) => void}} [options]
     */
    async function proposalTrial(connector, proposalUrl, options = {}) {
      if (!proposalUrl) return null;
      const t0 = Date.now();
      let report = await api(connector, proposalUrl, { signal: options.signal });
      while (report && (report.state === 'queued' || report.state === 'running') && Date.now() - t0 < (options.timeoutMs || 180000)) {
        if (options.onStatus) options.onStatus(report.state);
        await new Promise((resolve) => setTimeout(resolve, options.pollMs || 2000));
        if (options.signal && options.signal.aborted) break;
        report = await api(connector, proposalUrl, { signal: options.signal });
      }
      return report;
    }
    /**
     * The change set a document version was approved from (Dataregium's OB-23): change_set_id (the topic), base, proposed_by,
     * approved_by and the changes in the change set's form. Null for a version uploaded as a whole file (404).
     * @param {any} connector @param {string} documentId @param {number} versionIndex
     */
    async function versionChanges(connector, documentId, versionIndex) {
      try {
        return await api(connector, `/documents/1.0/documents/${encode(documentId)}/versions/${encode(String(versionIndex))}/ifc-changes`);
      } catch (err) {
        if (err && err.status === 404) return null;
        throw err;
      }
    }
    /**
     * Dataregium's diff of two document versions (its OB-30): added (only in the other), removed (only in this one) and changed
     * elements by GlobalId with the attributes that differ (`path`, `old`, `new`), `same` unchanged rooted entities and `truncated`.
     * Null when the server has no `ifc_diff`; 400 for the same version or a file that is not IFC.
     * @param {any} connector @param {string} documentId @param {number} versionIndex @param {number} otherIndex
     * @param {{otherDocumentId?: string, signal?: AbortSignal}} [options]
     */
    async function versionDiff(connector, documentId, versionIndex, otherIndex, options = {}) {
      const caps = await capabilities(connector);
      if (!hasExtension(caps, 'ifc_diff')) return null;
      const path = String(caps.extensions.ifc_diff.url || '/documents/1.0/documents/{document_id}/versions/{version_index}/ifc-diff/{other_index}')
        .replace('{document_id}', encode(documentId)).replace('{version_index}', encode(String(versionIndex))).replace('{other_index}', encode(String(otherIndex)));
      const query = options.otherDocumentId ? '?other_document_id=' + encode(options.otherDocumentId) : '';
      return api(connector, path + query, { signal: options.signal });
    }
    /**
     * Register this app as a client (Foundation API 2.2.3, RFC 7591) when the server allows it; the answer holds the client id
     * and, for a confidential client, the secret, which the caller keeps in api/secrets.
     * @param {string} baseUrl @param {{redirectUri: string, name?: string, bcfVersion?: string}} options
     */
    async function register(baseUrl, options) {
      const found = await discover(baseUrl, { bcfVersion: options.bcfVersion });
      if (!found.registrationUrl) throw new Error(t('opencde.err.noregistration'));
      const body = { client_name: options.name || 'Dataspatium', client_url: 'https://github.com/marwiss/Dataspatium', software_id: 'dataspatium', software_version: D.version, redirect_uris: [options.redirectUri], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] };
      const res = await send(null, { url: found.registrationUrl, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), retries: 0 });
      if (!res.ok) {
        // The server's error in the app's language when it has a code, its message otherwise, and the raw text only as a last resort.
        let refusal = null;
        try { refusal = JSON.parse(res.text); } catch (_err) { refusal = null; }
        const detail = describeError(refusal).text || String(res.text || '').replace(/\s+/g, ' ').slice(0, 160);
        throw new http.ApiError(t('opencde.err.registration', { detail }), { kind: 'http', status: res.status });
      }
      const data = JSON.parse(res.text);
      return { clientId: data.client_id, clientSecret: data.client_secret || '', found };
    }

    /** The project's files (BCF documents and Documents API files) as a table. */
    async function fetchFiles(connector, projectId) {
      if (bcfVersion(connector) === '2.1') {
        const files = await filesList(connector, projectId);
        return table(FILE_COLUMNS, files.map((f) => ({ filename: f.filename, ifc_project: f.ifcProject, date: f.date, reference: f.reference, source: f.source })), (r) => r);
      }
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
    return { ifcProposals, opsForm, OPS_FORM, canPropose, aiPolicy, canGeometry, ifcGeometry, ifcQuery, canClash, serverClash, serverClashTopics, canMerge, mergeReport, merge, prepareMerge, untilOver, ownUrl, publication, canPublish, publish, publicationFile, proposeUnreachable, FAMILY, BCF_VERSIONS, bcfVersion, bcfBase, bcfVersionsOf, setBcfVersion, hasDocuments, allTopics, viewpointFor, isOpenCde, discover, capabilities, hasExtension, describeError, describeOAuthError, ensureAuthUrls, redirectUri, cancelPopup, popupPending, binary, filesList, rights, downloadFile, importFile, documentVersions, newerVersion, versionMetadata, validationReport, createTopic, updateTopic, deleteTopic, createComment, updateComment, createViewpoint, deleteViewpoint, uploadBcfDocument, uploadDocument, precheck, proposeChanges, putChangeSet, proposalTrial, approveProposal, versionChanges, versionDiff, register, tables, login, manualStart, manualFinish, signedIn, ensureToken, logout, api, currentUser, projects, extensions, topics, comments, viewpoints, topicEvents, bcfDocuments, filesInformation, fetchTopics, fetchComments, fetchComponents, fetchEvents, fetchFiles, FETCHERS, refetch, selectDocuments, downloadVersion, topicsTable, commentsTable, componentsTable, eventsTable, parseCallback, verifier, challenge, describe, hostOf, SCOPES, CALLBACK_PAGE, popupFlow, CALLBACK_CHANNEL, CALLBACK_KEY, createDocumentReference,
      topicMay, projectMay, topicFiles, filesBody, setTopicFiles, modelFile, linkTopic, attachDocument, identity };
  });
})();
