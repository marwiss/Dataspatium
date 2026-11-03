// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Statistics Denmark (Danmarks Statistik) Statistikbanken API, https://api.statbank.dk/v1:
 *   subjects (tree, GET) -> tables per subject (GET, includeTables) -> tableinfo (variables with
 *   values, GET) -> data as JSON-stat 1.x (GET with the selection in the query string, or POST with a
 *   JSON body when the URL would be long). Browsed with the PxWeb view; the family exposes the same
 *   interface as api/families/pxweb (version 1 subset). Selections above the cell limit are split on
 *   the largest variable with pxweb.chunk().
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/statbank', ['api/http', 'api/auth', 'api/jsonstat', 'api/secrets', 'api/families/pxweb', 'ui/i18n'], (http, auth, jsonstat, secrets, pxweb, i18n) => {
    const DEFAULT_MAX_CELLS = 100000;
    const MAX_URL = 6000;

    function base(connector) { return String(connector.baseUrl).replace(/\/+$/, ''); }
    function version() { return 1; }
    /** `lang` query parameter: the app's language when the service offers it (da, en), else `family.lang`. */
    function lang(connector) {
      const langs = connector.family && connector.family.langs;
      const ui = i18n.language();
      if (Array.isArray(langs) && langs.includes(ui)) return ui;
      if (langs && typeof langs === 'object' && !Array.isArray(langs) && langs[ui]) return String(langs[ui]);
      return (connector.family && connector.family.lang) || 'da';
    }
    function maxCells(connector) { return (connector.family && connector.family.maxCells) || DEFAULT_MAX_CELLS; }

    async function getJson(connector, url, options = {}) {
      const req = await auth.apply(connector, { url, method: 'GET', headers: { Accept: 'application/json' } });
      const res = await http.request(Object.assign(req, { rateKey: connector.id, rateLimit: connector.rateLimit, signal: options.signal }));
      if (!res.ok) throw http.httpError(res, connector.name);
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(D.t('api.err.notjson', { name: connector.name })); }
    }
    async function postJson(connector, url, body, options = {}) {
      const req = await auth.apply(connector, { url, method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const res = await http.request(Object.assign(req, { rateKey: connector.id, rateLimit: connector.rateLimit, signal: options.signal }));
      if (!res.ok) throw http.httpError(res, connector.name);
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(D.t('api.err.notjson', { name: connector.name })); }
    }

    /** Subject tree: the root lists the main subjects; a subject lists its sub-subjects and tables. */
    async function listFolder(connector, path = [], options) {
      const l = lang(connector);
      if (!path.length) {
        const data = await getJson(connector, `${base(connector)}/subjects?lang=${encodeURIComponent(l)}`, options);
        return (Array.isArray(data) ? data : []).map((s) => ({ id: String(s.id), type: 'folder', text: String(s.description || s.id).trim(), updated: null }));
      }
      const id = path[path.length - 1];
      const data = await getJson(connector, `${base(connector)}/subjects/${encodeURIComponent(id)}?lang=${encodeURIComponent(l)}&includeTables=true`, options);
      const node = Array.isArray(data) ? data[0] : data;
      const subjects = ((node && node.subjects) || []).map((s) => ({ id: String(s.id), type: 'folder', text: String(s.description || s.id).trim(), updated: null }));
      const tables = ((node && node.tables) || []).map((t) => ({ id: String(t.id), type: 'table', text: `${t.id}: ${String(t.text || '').trim()}`, updated: t.updated || null, unit: t.unit || null, firstPeriod: t.firstPeriod, latestPeriod: t.latestPeriod }));
      return subjects.concat(tables);
    }

    /** tableinfo -> PxWeb-style variables. Variables that can be left out are marked `elimination`. */
    function normalizeTableInfo(info) {
      return {
        title: info.text ? `${info.id}: ${info.text}` : String(info.id || ''),
        unit: info.unit || null,
        updated: info.updated || null,
        variables: (info.variables || []).map((v) => ({
          code: v.id, text: v.text || v.id, elimination: !!v.elimination, time: !!v.time, metric: false,
          values: (v.values || []).map((x) => ({ code: String(x.id), text: x.text === undefined ? String(x.id) : String(x.text) })),
        })),
      };
    }
    async function tableMetaV1(connector, path, options) {
      const id = path[path.length - 1];
      return normalizeTableInfo(await getJson(connector, `${base(connector)}/tableinfo/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang(connector))}`, options));
    }

    /**
     * Variable selections for the data call. "Top n" picks the n last codes from the table's value list
     * (the service's own nth rules are avoided so that the request is reproducible).
     */
    function buildRequest(connector, tableId, variables, selection) {
      const vars = [];
      for (const v of variables) {
        const sel = selection[v.code];
        let values = null;
        if (!sel || sel.filter === 'none') { if (!v.elimination) values = ['*']; }
        else if (sel.filter === 'all') values = ['*'];
        else if (sel.filter === 'top') values = v.values.slice(-Math.max(1, sel.n || 1)).map((x) => x.code);
        else if (sel.values && sel.values.length) values = sel.values.slice();
        else if (!v.elimination) values = ['*'];
        if (values) vars.push({ code: v.code, values });
      }
      const u = new URL(`${base(connector)}/data/${encodeURIComponent(tableId)}/JSONSTAT`);
      u.searchParams.set('lang', lang(connector));
      for (const v of vars) u.searchParams.set(v.code, v.values.join(','));
      return { url: u.toString(), postUrl: `${base(connector)}/data`, body: { table: tableId, format: 'JSONSTAT', lang: lang(connector), variables: vars } };
    }

    /**
     * Fetch a table for a selection, merging chunks. Same contract as pxweb.fetchData.
     * @param {any} connector @param {{path?: string[], id?: string, title?: string}} table
     * @param {Array<any>} variables @param {Record<string, any>} selection
     * @param {{signal?: AbortSignal, onProgress?: Function, codes?: string}} [options]
     */
    async function fetchData(connector, table, variables, selection, options = {}) {
      const chunks = pxweb.chunk(variables, selection, maxCells(connector));
      const acc = { columns: [], rows: [], types: {}, meta: {} };
      const requests = [];
      for (let i = 0; i < chunks.length; i++) {
        const built = buildRequest(connector, table.id, variables, chunks[i]);
        const data = built.url.length > MAX_URL ? await postJson(connector, built.postUrl, built.body, options) : await getJson(connector, built.url, options);
        const t = jsonstat.toTable(data, { codes: options.codes || 'both' });
        requests.push({ url: secrets.mask(built.url, connector.id), status: 200, rows: t.rows.length });
        if (!acc.columns.length) { acc.columns = t.columns; acc.types = t.types; acc.meta = t.meta; acc.rows = t.rows; }
        else { const idx = t.columns.map((c) => acc.columns.indexOf(c)); for (const r of t.rows) { const out = new Array(acc.columns.length).fill(null); idx.forEach((j, k) => { if (j >= 0) out[j] = r[k]; }); acc.rows.push(out); } }
        if (options.onProgress) options.onProgress({ pages: i + 1, total: chunks.length, rows: acc.rows.length, url: secrets.mask(built.url, connector.id) });
      }
      acc.meta = Object.assign({}, acc.meta, { pages: chunks.length, requests, truncated: false });
      return acc;
    }

    function describeSource(connector, table, variables, selection, result) {
      return {
        kind: 'api', family: 'statbank', connectorId: connector.id, connectorName: connector.name, publisher: connector.publisher || null,
        version: 1, table: { path: table.path || null, id: table.id || null, title: table.title || '' },
        selection, variables: variables.map((v) => ({ code: v.code, text: v.text, elimination: v.elimination, time: v.time, metric: v.metric, count: v.values.length })),
        rows: result ? result.rows.length : null, pages: result && result.meta ? result.meta.pages : null, fetchedAt: new Date().toISOString(), license: connector.license ? connector.license.name : null,
        url: result && result.meta && result.meta.requests && result.meta.requests[0] ? result.meta.requests[0].url : null,
      };
    }
    async function refetch(connector, source, options = {}) {
      const meta = await tableMetaV1(connector, source.table.path || [source.table.id], options);
      return fetchData(connector, Object.assign({}, source.table, { title: meta.title }), meta.variables, source.selection, options);
    }

    return { version, lang, maxCells, listFolder, tableMetaV1, normalizeTableInfo, buildRequest, cellCount: pxweb.cellCount, chunk: pxweb.chunk, fetchData, describeSource, refetch };
  });
})();
