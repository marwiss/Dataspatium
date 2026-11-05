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
  D.define('api/families/opencde', ['api/families/databases', 'api/http', 'api/secrets', 'platform/consent', 'api/connectors'], (databases, http, secrets, consent, connectors) => {
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
      const res = await http.request({ url, method: 'GET', headers: Object.assign({ Accept: 'application/json' }, headers || {}), retries: 1 });
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
      return { apis, authUrl: auth.oauth2_auth_url, tokenUrl: auth.oauth2_token_url, revocationUrl: auth.oauth2_revocation_url || null, pkceRequired: auth.oauth2_pkce_required !== false };
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
    /** Default popup: open the authorization page and wait for the callback page to post its address back. */
    function popupFlow(url) {
      return new Promise((resolve, reject) => {
        const win = window.open(url, 'dataspatium-opencde-login', 'popup,width=520,height=760');
        if (!win) { reject(new Error(t('opencde.err.popup'))); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error(t('opencde.err.timeout'))); }, 300000);
        const poll = setInterval(() => { if (win.closed) { cleanup(); reject(new Error(t('opencde.err.closed'))); } }, 500);
        const onMessage = (ev) => {
          if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'dataspatium-oauth-callback') return;
          cleanup(); try { win.close(); } catch (_e) { /* the popup may already be gone */ }
          resolve(String(ev.data.url));
        };
        const cleanup = () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener('message', onMessage); };
        window.addEventListener('message', onMessage);
      });
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
      const res = await http.request({ url: auth.tokenUrl, method: 'POST', headers, body: params.toString(), retries: 0, rateKey: connector.id });
      if (!res.ok) throw new http.ApiError(t('opencde.err.token', { detail: String(res.text || '').replace(/\s+/g, ' ').slice(0, 200) }), { kind: 'auth', status: res.status });
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
      const callback = await (options.popup || popupFlow)(url.href);
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
        try { await http.request({ url: auth.revocationUrl, method: 'POST', headers, body: params.toString(), retries: 0, rateKey: connector.id }); } catch (_e) { /* best effort */ }
      }
      secrets.set(connector.id, creds && creds.clientSecret ? { clientSecret: creds.clientSecret } : {});
    }

    // ---------------------------------------------------------------------------- API calls
    /** GET or POST JSON with the bearer token; absolute addresses (links the server hands out) are used as they are. */
    async function api(connector, path, options = {}) {
      const token = await ensureToken(connector);
      const url = /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : trimUrl(connector.baseUrl) + path;
      const headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, options.headers || {});
      const req = { url, method: options.method || 'GET', headers, signal: options.signal, retries: 1, rateKey: connector.id, responseType: options.responseType };
      if (options.json !== undefined) { headers['Content-Type'] = 'application/json'; req.body = JSON.stringify(options.json); }
      const res = await http.request(req);
      if (!res.ok) {
        let message = '';
        try { message = JSON.parse(res.text).message || ''; } catch (_e) { /* not JSON */ }
        throw new http.ApiError(`${connector.name}: ${http.describeStatus(res.status)}${message ? ' ' + message : ''}`, { kind: 'http', status: res.status, url, detail: message });
      }
      if (options.responseType === 'arraybuffer') return res.buffer;
      const text = (res.text || '').trim();
      return text ? JSON.parse(text) : null;
    }
    const bcf = (connector, path, options) => api(connector, '/bcf/3.0' + path, options);
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
      const callback = await (options.popup || popupFlow)(started.select_documents_url);
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
      const fetcher = FETCHERS[spec.kind];
      if (!fetcher || !spec.projectId) throw new Error(t('api.err.nosource'));
      const out = await fetcher(connector, spec.projectId);
      return Object.assign(out, { meta: {} });
    }

    return { FAMILY, isOpenCde, discover, ensureAuthUrls, redirectUri, login, manualStart, manualFinish, signedIn, ensureToken, logout, api, currentUser, projects, extensions, topics, comments, viewpoints, topicEvents, bcfDocuments, filesInformation, fetchTopics, fetchComments, fetchComponents, fetchEvents, fetchFiles, FETCHERS, refetch, selectDocuments, downloadVersion, topicsTable, commentsTable, componentsTable, eventsTable, parseCallback, verifier, challenge, describe, hostOf, SCOPES, CALLBACK_PAGE };
  });
})();
