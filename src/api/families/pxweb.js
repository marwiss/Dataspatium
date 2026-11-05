// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * PxWeb family: SCB, Folkhälsomyndigheten and other PxWeb installations.
 *   version 1: folder navigation (GET), table metadata (GET), data by POST query -> JSON-stat 2
 *   version 2: table search (GET /tables), metadata (GET /tables/{id}/metadata, JSON-stat 2 form),
 *              data by GET /tables/{id}/data with valueCodes[...] (POST selection when the URL is long)
 * Selections above the service's cell limit are split into several requests on the largest variable.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/pxweb', ['api/http', 'api/auth', 'api/jsonstat', 'api/secrets', 'ui/i18n', 'api/families/common'], (http, auth, jsonstat, secrets, i18n, common) => {
    const DEFAULT_MAX_CELLS = 150000;
    const MAX_URL = 6000;

    /**
     * Service root. API v1 puts the language in the URL, so a preset may list one root per language
     * (`family.urls`); the app's language is used when the service offers it, else `baseUrl`.
     */
    function base(connector) {
      const urls = connector.family && connector.family.urls;
      const ui = i18n.language();
      const url = urls && urls[ui] ? urls[ui] : connector.baseUrl;
      return String(url).replace(/\/+$/, '');
    }
    function version(connector) { return (connector.family && connector.family.version) || 1; }
    /**
     * Language parameter (API v2): the app's language when the service accepts it (`family.langs`, a list
     * of UI codes or a map from UI code to the service's code, e.g. {"nb": "no"}), else `family.lang`.
     */
    function lang(connector) {
      const langs = connector.family && connector.family.langs;
      const ui = i18n.language();
      if (Array.isArray(langs) && langs.includes(ui)) return ui;
      if (langs && typeof langs === 'object' && !Array.isArray(langs) && langs[ui]) return String(langs[ui]);
      return (connector.family && connector.family.lang) || 'sv';
    }
    const maxCells = (connector) => common.maxCells(connector, DEFAULT_MAX_CELLS);

    const getJson = common.getJson;
    async function postJson(connector, url, body, options = {}) {
      // PxWeb API v1 answers CORS preflights without Access-Control-Allow-Headers, so a JSON content type
      // is blocked by browsers; the service accepts the same body as text/plain, which needs no preflight.
      return common.postJson(connector, url, body, Object.assign({ contentType: version(connector) === 2 ? 'application/json' : 'text/plain;charset=UTF-8' }, options));
    }

    // ---- v1 ----
    /** @param {string[]} path folder ids from the root */
    async function listFolder(connector, path = [], options) {
      // The database root needs a trailing slash; folders are addressed without one.
      const data = await getJson(connector, base(connector) + (path.length ? '/' + path.map(encodeURIComponent).join('/') : '/'), options);
      // A root above the databases (Statistics Iceland) lists {dbid, text} entries; they behave as folders.
      return (Array.isArray(data) ? data : []).map((e) => ({ id: e.id !== undefined ? e.id : e.dbid, type: e.type === 't' ? 'table' : 'folder', text: String(e.text || '').trim(), updated: e.updated || null }));
    }
    function normalizeV1(meta) {
      return {
        title: meta.title,
        variables: (meta.variables || []).map((v) => ({
          code: v.code, text: v.text, elimination: !!v.elimination, time: !!v.time, metric: v.code === 'ContentsCode',
          values: (v.values || []).map((code, i) => ({ code, text: v.valueTexts && v.valueTexts[i] !== undefined ? v.valueTexts[i] : code })),
        })),
      };
    }
    async function tableMetaV1(connector, path, options) {
      return normalizeV1(await getJson(connector, base(connector) + '/' + path.map(encodeURIComponent).join('/'), options));
    }
    /** v1 POST body from a selection {code: {filter, values}}. */
    function buildQuery(variables, selection) {
      const query = [];
      for (const v of variables) {
        const sel = selection[v.code];
        if (!sel || sel.filter === 'none') { if (!v.elimination) query.push({ code: v.code, selection: { filter: 'all', values: ['*'] } }); continue; }
        if (sel.filter === 'all') query.push({ code: v.code, selection: { filter: 'all', values: ['*'] } });
        else if (sel.filter === 'top') query.push({ code: v.code, selection: { filter: 'top', values: [String(sel.n || 1)] } });
        else if (sel.values && sel.values.length) query.push({ code: v.code, selection: { filter: 'item', values: sel.values.slice() } });
        else if (!v.elimination) query.push({ code: v.code, selection: { filter: 'all', values: ['*'] } });
      }
      return { query, response: { format: 'json-stat2' } };
    }

    // ---- v2 ----
    async function searchTables(connector, query, page = 1, pageSize = 50, options) {
      const u = new URL(base(connector) + '/tables');
      u.searchParams.set('lang', lang(connector));
      if (query) u.searchParams.set('query', query);
      u.searchParams.set('pageSize', String(pageSize));
      u.searchParams.set('pageNumber', String(page));
      const data = await getJson(connector, u.toString(), options);
      return {
        tables: (data.tables || []).map((t) => ({ id: t.id, text: t.label, updated: t.updated || null, firstPeriod: t.firstPeriod, lastPeriod: t.lastPeriod, variableNames: t.variableNames || [], path: (t.paths && t.paths[0] ? t.paths[0].map((p) => p.label).join(' › ') : '') })),
        page: data.page ? { number: data.page.pageNumber, size: data.page.pageSize, totalElements: data.page.totalElements, totalPages: data.page.totalPages } : { number: 1, totalPages: 1 },
      };
    }
    function normalizeV2(meta) {
      return { title: meta.label, variables: jsonstat.dimensions(meta).map((d) => ({ code: d.code, text: d.text, values: d.values, elimination: d.elimination, time: d.time, metric: d.metric, codeLists: d.codeLists })) };
    }
    async function tableMetaV2(connector, tableId, options) {
      return normalizeV2(await getJson(connector, `${base(connector)}/tables/${encodeURIComponent(tableId)}/metadata?lang=${encodeURIComponent(lang(connector))}`, options));
    }
    function valueExpr(sel) {
      if (!sel || sel.filter === 'none') return null;
      if (sel.filter === 'all') return ['*'];
      if (sel.filter === 'top') return [`TOP(${sel.n || 1})`];
      return sel.values && sel.values.length ? sel.values.slice() : null;
    }
    /** v2 GET URL (and POST body) for a selection. */
    function buildV2(connector, tableId, variables, selection) {
      const u = new URL(`${base(connector)}/tables/${encodeURIComponent(tableId)}/data`);
      u.searchParams.set('lang', lang(connector));
      u.searchParams.set('outputFormat', 'json-stat2');
      const body = { selection: [] };
      for (const v of variables) {
        let expr = valueExpr(selection[v.code]);
        if (!expr && !v.elimination) expr = ['*'];
        if (!expr) continue;
        u.searchParams.set(`valueCodes[${v.code}]`, expr.join(','));
        body.selection.push({ variableCode: v.code, valueCodes: expr });
      }
      return { url: u.toString(), body, postUrl: `${base(connector)}/tables/${encodeURIComponent(tableId)}/data?lang=${encodeURIComponent(lang(connector))}&outputFormat=json-stat2` };
    }

    // ---- common ----
    /** Number of cells a selection will produce. */
    function cellCount(variables, selection) {
      let n = 1;
      for (const v of variables) {
        const sel = selection[v.code];
        const total = v.values.length || 1;
        if (!sel || sel.filter === 'none') n *= v.elimination ? 1 : total;
        else if (sel.filter === 'all') n *= total;
        else if (sel.filter === 'top') n *= Math.min(sel.n || 1, total);
        else n *= Math.max(1, (sel.values || []).length);
      }
      return n;
    }
    /** Split a selection into chunks that respect the cell limit (on the largest item-selected variable). */
    function chunk(variables, selection, limit) {
      const total = cellCount(variables, selection);
      if (total <= limit) return [selection];
      let best = null;
      for (const v of variables) {
        const sel = selection[v.code];
        const values = sel && sel.filter === 'all' ? v.values.map((x) => x.code) : (sel && sel.filter === 'item' ? sel.values : null);
        if (values && values.length > 1 && (!best || values.length > best.values.length)) best = { v, values };
      }
      if (!best) throw new Error(D.t('api.err.toomany.cells', { total, limit }));
      const perChunk = Math.max(1, Math.floor(best.values.length / Math.ceil(total / limit)));
      const chunks = [];
      for (let i = 0; i < best.values.length; i += perChunk) chunks.push(Object.assign({}, selection, { [best.v.code]: { filter: 'item', values: best.values.slice(i, i + perChunk) } }));
      return chunks;
    }

    /**
     * Fetch data for a table and selection as a table (merging chunks).
     * @param {any} connector @param {{path?: string[], id?: string, title?: string}} table
     * @param {Array<any>} variables @param {Record<string, any>} selection
     * @param {{signal?: AbortSignal, onProgress?: Function, codes?: string}} [options]
     */
    async function fetchData(connector, table, variables, selection, options = {}) {
      const chunks = chunk(variables, selection, maxCells(connector));
      const acc = { columns: [], rows: [], types: {}, meta: {} };
      const requests = [];
      for (let i = 0; i < chunks.length; i++) {
        let data; let url;
        if (version(connector) === 2) {
          const built = buildV2(connector, table.id, variables, chunks[i]);
          url = built.url;
          data = built.url.length > MAX_URL ? await postJson(connector, built.postUrl, built.body, options) : await getJson(connector, built.url, options);
        } else {
          url = base(connector) + '/' + table.path.map(encodeURIComponent).join('/');
          data = await postJson(connector, url, buildQuery(variables, chunks[i]), options);
        }
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
        kind: 'api', family: 'pxweb', connectorId: connector.id, connectorName: connector.name, publisher: connector.publisher || null,
        version: version(connector), table: { path: table.path || null, id: table.id || null, title: table.title || '' },
        selection, variables: variables.map((v) => ({ code: v.code, text: v.text, elimination: v.elimination, time: v.time, metric: v.metric, count: v.values.length })),
        rows: result ? result.rows.length : null, pages: result && result.meta ? result.meta.pages : null, fetchedAt: new Date().toISOString(), license: connector.license ? connector.license.name : null,
        url: result && result.meta && result.meta.requests && result.meta.requests[0] ? result.meta.requests[0].url : null,
      };
    }
    async function refetch(connector, source, options = {}) {
      const meta = version(connector) === 2 ? await tableMetaV2(connector, source.table.id, options) : await tableMetaV1(connector, source.table.path, options);
      return fetchData(connector, Object.assign({}, source.table, { title: meta.title }), meta.variables, source.selection, options);
    }

    return { base, version, lang, maxCells, listFolder, tableMetaV1, tableMetaV2, searchTables, buildQuery, buildV2, normalizeV1, normalizeV2, cellCount, chunk, fetchData, describeSource, refetch };
  });
})();
