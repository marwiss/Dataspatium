// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Pagination strategies: page number, offset/limit, next URL in the body, cursor in the body, RFC 8288
 * Link header and STAC/HAL-style link arrays. `start` prepares the first request, `next` returns the
 * following request or null when the last page has been read.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/pagination', ['api/parsers', 'api/http'], (parsers, http) => {
    function setParam(url, name, value) { const u = new URL(url); u.searchParams.set(name, String(value)); return u.toString(); }

    /** @returns {{page: number, offset: number, seen: Set<string>, size: number}} */
    /** The offset and page size as values for a request body (`in: "body"`). */
    const bodyPage = (spec, state) => Object.assign({ [spec.param]: state.offset }, spec.sizeParam && spec.size ? { [spec.sizeParam]: spec.size } : {});
    /**
     * @param {any} spec @param {any} req the first request, changed in place
     * @param {(extra: Record<string, any>) => any} [rebuild] builds the request again with extra values: an offset in the body
     *   (`in: "body"`, as Trafikverket's skip and limit) cannot be set in the address
     */
    function start(spec, req, rebuild) {
      const state = { page: spec.start === undefined ? 1 : spec.start, offset: spec.start || 0, size: spec.size || 0, seen: new Set([req.url]), rebuild: rebuild || null };
      if (spec.type === 'offset' && spec.in === 'body') {
        if (!rebuild) throw new Error('pagination: an offset in the body needs rebuild');
        Object.assign(req, rebuild(bodyPage(spec, state)));
        return state;
      }
      if (spec.type === 'page') {
        req.url = setParam(req.url, spec.param, state.page);
        if (spec.sizeParam && spec.size) req.url = setParam(req.url, spec.sizeParam, spec.size);
      } else if (spec.type === 'offset') {
        req.url = setParam(req.url, spec.param, state.offset);
        if (spec.sizeParam && spec.size) req.url = setParam(req.url, spec.sizeParam, spec.size);
      }
      return state;
    }

    function upgrade(url, from) {
      // Some APIs (Socialstyrelsen) return http:// links although they are served over https.
      if (/^http:\/\//.test(url) && /^https:\/\//.test(from)) return 'https://' + url.slice('http://'.length);
      return url;
    }

    /**
     * @param {any} spec pagination spec
     * @param {any} state from start()
     * @param {{request: any, response: any, data: any, table: {rows: any[][]}}} last
     * @returns {any|null} next request (same shape as the last) or null
     */
    function next(spec, state, last) {
      const type = spec.type || 'none';
      const rows = last.table ? last.table.rows.length : 0;
      let url = null;
      if (type === 'none') return null;
      if (type === 'page') {
        const totalPages = spec.totalPagesPath ? Number(parsers.resolvePath(last.data, spec.totalPagesPath)) : NaN;
        if (rows === 0 || (state.size && rows < state.size) || (Number.isFinite(totalPages) && state.page >= totalPages)) return null;
        state.page++;
        url = setParam(last.request.url, spec.param, state.page);
      } else if (type === 'offset') {
        const total = spec.totalPath ? Number(parsers.resolvePath(last.data, spec.totalPath)) : NaN;
        state.offset += state.size || rows;
        if (rows === 0 || (state.size && rows < state.size) || (Number.isFinite(total) && state.offset >= total)) return null;
        if (spec.in === 'body') return state.rebuild(bodyPage(spec, state));
        url = setParam(last.request.url, spec.param, state.offset);
      } else if (type === 'next-url') {
        const v = parsers.resolvePath(last.data, spec.path);
        if (!v || typeof v !== 'string') return null;
        url = upgrade(new URL(v, last.request.url).toString(), last.request.url);
      } else if (type === 'cursor') {
        const v = parsers.resolvePath(last.data, spec.path);
        if (v === undefined || v === null || v === '' || rows === 0) return null;
        url = setParam(last.request.url, spec.param, v);
      } else if (type === 'link-header') {
        const v = http.linkHeader(last.response && last.response.headers ? last.response.headers.get('Link') : null, spec.rel || 'next');
        if (!v) return null;
        url = new URL(v, last.request.url).toString();
      } else if (type === 'link-rel') {
        const links = parsers.resolvePath(last.data, spec.path);
        const link = Array.isArray(links) ? links.find((l) => l && l.rel === (spec.rel || 'next') && l.href) : null;
        if (!link) return null;
        url = new URL(link.href, last.request.url).toString();
      }
      if (!url || state.seen.has(url)) return null;
      state.seen.add(url);
      return Object.assign({}, last.request, { url });
    }

    return { start, next, setParam };
  });
})();
