// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Norwegian Institute of Public Health (FHI) Statistikk Open API, https://statistikk-data.fhi.no/api/open/v1:
 *   Common/source (sources) -> {source}/Table (tables) -> {source}/Table/{id}/dimension (dimensions with
 *   hierarchical categories) -> POST {source}/Table/{id}/data with {dimensions, response} -> JSON-stat 2.
 * Browsed with the PxWeb view (sources as folders, one level of tables); same interface as
 * api/families/pxweb (version 1 subset). Measures live in the dimension MEASURE_TYPE.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/fhi', ['api/http', 'api/auth', 'api/jsonstat', 'api/secrets', 'api/families/pxweb', 'api/families/common'], (http, auth, jsonstat, secrets, pxweb, common) => {
    const DEFAULT_MAX_CELLS = 100000;

    function base(connector) { return String(connector.baseUrl).replace(/\/+$/, ''); }
    function version() { return 1; }
    function lang() { return 'nb'; }
    const maxCells = (connector) => common.maxCells(connector, DEFAULT_MAX_CELLS);

    const { getJson, postJson } = common;

    /** Root: the registers and statistics banks (sources); inside a source: its tables. */
    async function listFolder(connector, path = [], options) {
      if (!path.length) {
        const data = await getJson(connector, `${base(connector)}/Common/source`, options);
        return (Array.isArray(data) ? data : []).map((s) => ({ id: String(s.id), type: 'folder', text: String(s.title || s.id).trim(), description: s.description || '', updated: null }));
      }
      const source = path[0];
      const data = await getJson(connector, `${base(connector)}/${encodeURIComponent(source)}/Table`, options);
      return (Array.isArray(data) ? data : []).map((t) => ({ id: String(t.tableId), type: 'table', text: String(t.title || t.tableId).trim(), updated: t.modifiedAt || t.publishedAt || null }));
    }

    /** Flatten hierarchical categories (GEO: country > county > municipality > district) depth first. */
    function flattenCategories(categories, depth = 0, out = []) {
      for (const c of categories || []) {
        out.push({ code: String(c.value), text: (depth ? ' '.repeat(Math.min(depth, 3)) : '') + String(c.label === undefined ? c.value : c.label) });
        if (Array.isArray(c.children) && c.children.length) flattenCategories(c.children, depth + 1, out);
      }
      return out;
    }
    /** dimension endpoint -> PxWeb-style variables. Every dimension is mandatory in a query. */
    function normalizeDimensions(data) {
      const dims = (data && data.dimensions) || [];
      return {
        title: '',
        variables: dims.map((d) => ({
          code: d.code, text: d.label || d.code, elimination: false,
          time: /^(AAR|PERIODE|TID|YEAR)$/i.test(String(d.code)), metric: String(d.code) === 'MEASURE_TYPE',
          values: flattenCategories(d.categories),
        })),
      };
    }
    async function tableMetaV1(connector, path, options) {
      const [source, tableId] = path;
      return normalizeDimensions(await getJson(connector, `${base(connector)}/${encodeURIComponent(source)}/Table/${encodeURIComponent(tableId)}/dimension`, options));
    }

    /** Query body from a selection {code: {filter, values, n}}. */
    function buildQuery(variables, selection) {
      const dimensions = [];
      for (const v of variables) {
        const sel = selection[v.code];
        if (!sel || sel.filter === 'none' || sel.filter === 'all') dimensions.push({ code: v.code, filter: 'all', values: ['*'] });
        else if (sel.filter === 'top') dimensions.push({ code: v.code, filter: 'top', values: [String(Math.max(1, sel.n || 1))] });
        else if (sel.values && sel.values.length) dimensions.push({ code: v.code, filter: 'item', values: sel.values.slice() });
        else dimensions.push({ code: v.code, filter: 'all', values: ['*'] });
      }
      return { dimensions, response: { format: 'json-stat2' } };
    }

    /**
     * Fetch a table for a selection, merging chunks. Same contract as pxweb.fetchData.
     * @param {any} connector @param {{path?: string[], id?: string, title?: string}} table
     * @param {Array<any>} variables @param {Record<string, any>} selection
     * @param {{signal?: AbortSignal, onProgress?: Function, codes?: string}} [options]
     */
    async function fetchData(connector, table, variables, selection, options = {}) {
      const path = table.path || [];
      const source = path[0];
      const tableId = table.id || path[1];
      const url = `${base(connector)}/${encodeURIComponent(source)}/Table/${encodeURIComponent(tableId)}/data`;
      const chunks = pxweb.chunk(variables, selection, maxCells(connector));
      const acc = { columns: [], rows: [], types: {}, meta: {} };
      const requests = [];
      for (let i = 0; i < chunks.length; i++) {
        const data = await postJson(connector, url, buildQuery(variables, chunks[i]), options);
        const t = jsonstat.toTable(data, { codes: options.codes || 'both' });
        requests.push({ url: secrets.mask(url, connector.id), status: 200, rows: t.rows.length });
        if (!acc.columns.length) { acc.columns = t.columns; acc.types = t.types; acc.meta = t.meta; acc.rows = t.rows; }
        else { const idx = t.columns.map((c) => acc.columns.indexOf(c)); for (const r of t.rows) { const out = new Array(acc.columns.length).fill(null); idx.forEach((j, k) => { if (j >= 0) out[j] = r[k]; }); acc.rows.push(out); } }
        if (options.onProgress) options.onProgress({ pages: i + 1, total: chunks.length, rows: acc.rows.length, url: secrets.mask(url, connector.id) });
      }
      acc.meta = Object.assign({}, acc.meta, { pages: chunks.length, requests, truncated: false });
      return acc;
    }

    function describeSource(connector, table, variables, selection, result) {
      return {
        kind: 'api', family: 'fhi', connectorId: connector.id, connectorName: connector.name, publisher: connector.publisher || null,
        version: 1, table: { path: table.path || null, id: table.id || null, title: table.title || '' },
        selection, variables: variables.map((v) => ({ code: v.code, text: v.text, elimination: v.elimination, time: v.time, metric: v.metric, count: v.values.length })),
        rows: result ? result.rows.length : null, pages: result && result.meta ? result.meta.pages : null, fetchedAt: new Date().toISOString(), license: connector.license ? connector.license.name : null,
        url: result && result.meta && result.meta.requests && result.meta.requests[0] ? result.meta.requests[0].url : null,
      };
    }
    async function refetch(connector, source, options = {}) {
      const meta = await tableMetaV1(connector, source.table.path, options);
      return fetchData(connector, Object.assign({}, source.table, { title: source.table.title || meta.title }), meta.variables, source.selection, options);
    }

    return { version, lang, maxCells, listFolder, tableMetaV1, normalizeDimensions, flattenCategories, buildQuery, cellCount: pxweb.cellCount, chunk: pxweb.chunk, fetchData, describeSource, refetch };
  });
})();
