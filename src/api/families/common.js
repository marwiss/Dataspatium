// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What the HTTP source families share: a JSON request with the connector's authentication, rate limit and abort signal, and the
 * cell limit per fetch. PxWeb, Statistics Denmark, FHI and Socialstyrelsen build on these.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/common', ['api/http', 'api/auth'], (http, auth) => {
    /**
     * Sends a request with the connector's authentication, rate limit and signal; answers with the parsed JSON or throws an error
     * in the user's words.
     * @param {any} connector @param {any} req {url, method, headers, body?} @param {{signal?: AbortSignal}} options
     */
    async function jsonRequest(connector, req, options) {
      const prepared = await auth.apply(connector, req);
      const res = await http.request(Object.assign(prepared, { rateKey: connector.id, rateLimit: connector.rateLimit, signal: options.signal }));
      if (!res.ok) throw http.httpError(res, connector.name);
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(D.t('api.err.notjson', { name: connector.name })); }
    }
    /** GET as JSON. @param {any} connector @param {string} url @param {{signal?: AbortSignal}} [options] */
    function getJson(connector, url, options = {}) {
      return jsonRequest(connector, { url, method: 'GET', headers: { Accept: 'application/json' } }, options);
    }
    /**
     * POST a JSON body. `options.contentType` is for services whose CORS preflight refuses application/json (PxWeb v1 takes the
     * same body as text/plain, which needs no preflight).
     * @param {any} connector @param {string} url @param {any} body @param {{signal?: AbortSignal, contentType?: string}} [options]
     */
    function postJson(connector, url, body, options = {}) {
      return jsonRequest(connector, { url, method: 'POST', headers: { Accept: 'application/json', 'Content-Type': options.contentType || 'application/json' }, body: JSON.stringify(body) }, options);
    }
    /** The cell limit per fetch: the connector's own, or the family's default. @param {any} connector @param {number} fallback */
    function maxCells(connector, fallback) { return (connector.family && connector.family.maxCells) || fallback; }
    return { getJson, postJson, maxCells };
  });
})();
