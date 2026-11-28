// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Authentication for connectors: API key (header or query), Basic, Bearer and OAuth2 client
 * credentials (used by Lantmäteriet; the secret as a Basic header or, with `auth.clientAuth: 'body'`, in the form body).
 * Credentials come from api/secrets; tokens are cached per connector until they expire.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/auth', ['api/http', 'api/secrets'], (http, secrets) => {
    /** @type {Map<string, {token: string, expiresAt: number}>} */
    const tokens = new Map();

    /** Which credential fields a connector needs. */
    function requiredFields(auth) {
      switch ((auth || {}).type) {
        case 'apiKey': return [{ key: 'apiKey', label: D.t('api.auth.apikey'), secret: true }];
        case 'basic': return [{ key: 'username', label: D.t('api.auth.username'), secret: false }, { key: 'password', label: D.t('api.auth.password'), secret: true }];
        case 'bearer': return [{ key: 'token', label: D.t('api.auth.token'), secret: true }];
        case 'oauth2_client_credentials': return [{ key: 'clientId', label: D.t('api.auth.clientid'), secret: false }, { key: 'clientSecret', label: D.t('api.auth.clientsecret'), secret: true }];
        default: return [];
      }
    }
    function needsCredentials(connector) { return requiredFields(connector.auth).length > 0; }
    function hasCredentials(connector) {
      const values = secrets.get(connector.id);
      return !needsCredentials(connector) || (!!values && requiredFields(connector.auth).every((f) => values[f.key]));
    }

    /**
     * Fetch (or reuse) an OAuth2 client-credentials token. The client id and secret go as a Basic header (client_secret_basic), or
     * with `auth.clientAuth: 'body'` in the form body (client_secret_post, RFC 6749 2.3.1): Lantmäteriet's api.lantmateriet.se/token
     * answers the browser's question before a request with an Authorization header without allowing it, while a plain form post needs
     * no such question. The secret is in the body of that one request and nowhere else.
     */
    async function token(connector, values, options = {}) {
      const cached = tokens.get(connector.id);
      if (cached && cached.expiresAt > Date.now() + 30000 && !options.force) return cached.token;
      const auth = connector.auth;
      const inBody = auth.clientAuth === 'body';
      const body = 'grant_type=client_credentials' + (auth.scope ? '&scope=' + encodeURIComponent(auth.scope) : '')
        + (inBody ? '&client_id=' + encodeURIComponent(values.clientId) + '&client_secret=' + encodeURIComponent(values.clientSecret) : '');
      /** @type {Record<string, string>} */
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
      if (!inBody) headers.Authorization = 'Basic ' + btoa(`${values.clientId}:${values.clientSecret}`);
      const res = await http.request({ url: auth.tokenUrl, method: 'POST', body, signal: options.signal, rateKey: connector.id, ask: options.ask, headers });
      if (!res.ok) throw http.httpError(res, D.t('api.err.token'));
      let data;
      try { data = JSON.parse(res.text); } catch (_e) { throw new http.ApiError(D.t('api.err.token.json'), { kind: 'auth' }); }
      if (!data.access_token) throw new http.ApiError(D.t('api.err.token.missing'), { kind: 'auth' });
      const ttl = Number(data.expires_in) > 0 ? Number(data.expires_in) * 1000 : 3600000;
      tokens.set(connector.id, { token: data.access_token, expiresAt: Date.now() + ttl });
      return data.access_token;
    }
    function clearToken(connectorId) { tokens.delete(connectorId); }

    /**
     * Return a copy of the request with credentials applied.
     * @param {any} connector @param {{url: string, method?: string, headers?: Record<string, string>, body?: any}} req
     * @param {{signal?: AbortSignal, ask?: boolean}} [options] `ask: false` (a flow at start): a token is fetched only with a consent already kept
     */
    async function apply(connector, req, options = {}) {
      const auth = connector.auth || { type: 'none' };
      if (auth.type === 'none') return req;
      const values = secrets.get(connector.id);
      if (auth.type !== 'oauth2_pkce' && (!values || !requiredFields(auth).every((f) => values[f.key]))) throw new http.ApiError(D.t('api.err.key.first', { name: connector.name }), { kind: 'auth' });
      const out = Object.assign({}, req, { headers: Object.assign({}, req.headers || {}) });
      switch (auth.type) {
        case 'apiKey': {
          const value = (auth.prefix || '') + values.apiKey;
          if (auth.in === 'query') { const u = new URL(out.url); u.searchParams.set(auth.name, value); out.url = u.toString(); }
          // In the body (Trafikverket's <LOGIN authenticationkey="{authenticationkey}"/>): the placeholder of that name is filled
          // here, escaped for the body's type, so the key is in the request that is sent and nowhere else.
          else if (auth.in === 'body') {
            const type = String(out.headers['Content-Type'] || '');
            const safe = /xml/i.test(type) ? D.require('platform/text').escapeHtml(value) : (/json/i.test(type) ? JSON.stringify(value).slice(1, -1) : value);
            out.body = String(out.body || '').split('{' + auth.name + '}').join(safe);
          }
          else out.headers[auth.name] = value;
          break;
        }
        case 'basic': out.headers.Authorization = 'Basic ' + btoa(`${values.username}:${values.password}`); break;
        case 'bearer': out.headers.Authorization = 'Bearer ' + values.token; break;
        case 'oauth2_client_credentials': out.headers.Authorization = 'Bearer ' + (await token(connector, values, options)); break;
        // OpenCDE servers: the token comes from the user's own sign-in (api/families/opencde), refreshed there.
        case 'oauth2_pkce': out.headers.Authorization = 'Bearer ' + (await D.ensure(['families'], () => D.require('api/families/opencde').ensureToken(connector))); break;
        default: break;
      }
      return out;
    }

    // ---- the file hosts' own login ---------------------------------------------------------------------------
    /**
     * The file hosts that also take a user name and password (`files.basic`; Lantmäteriet's dl1 takes the Geotorget login when
     * it refuses the key's token). @param {any} connector @returns {string[]}
     */
    function fileLoginHosts(connector) {
      const list = connector && connector.files && connector.files.basic;
      return Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x) : [];
    }
    /** The optional login fields for those hosts, kept beside the key in api/secrets; none when the connector names no such host. */
    function fileLoginFields(connector) {
      return fileLoginHosts(connector).length ? [{ key: 'fileUser', label: D.t('api.auth.username'), secret: false }, { key: 'filePassword', label: D.t('api.auth.password'), secret: true }] : [];
    }
    /** True when the login for the file hosts is entered. @param {any} connector */
    function hasFileLogin(connector) { const v = secrets.get(connector.id); return !!(v && v.fileUser && v.filePassword); }
    /**
     * The Basic header for a file, or null: only for a host in `files.basic` and only when the login is entered, so the user name
     * and password never go anywhere else. UTF-8, so that å, ä and ö survive.
     * @param {any} connector @param {string} url @returns {string|null}
     */
    function fileLogin(connector, url) {
      let host = '';
      try { host = new URL(url).host; } catch (_e) { return null; }
      if (!fileLoginHosts(connector).includes(host) || !hasFileLogin(connector)) return null;
      const v = secrets.get(connector.id);
      const bytes = new TextEncoder().encode(`${v.fileUser}:${v.filePassword}`);
      return 'Basic ' + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    }

    return { apply, token, clearToken, requiredFields, needsCredentials, hasCredentials, fileLoginHosts, fileLoginFields, hasFileLogin, fileLogin };
  });
})();
