// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Socialstyrelsen's statistics database API (sdb.socialstyrelsen.se/api/v1): subjects, variables with
 * values and a result path built from the selected ids. Results are paged (5 000 rows per page) and
 * contain ids only; this module joins the texts back in.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/socialstyrelsen', ['api/http', 'api/auth', 'api/secrets', 'data/types'], (http, auth, secrets, types) => {
    function base(connector) { return String(connector.baseUrl).replace(/\/+$/, ''); }

    async function getJson(connector, url, options = {}) {
      const req = await auth.apply(connector, { url, method: 'GET', headers: { Accept: 'application/json' } });
      const res = await http.request(Object.assign(req, { rateKey: connector.id, rateLimit: connector.rateLimit, signal: options.signal }));
      if (!res.ok) throw http.httpError(res, connector.name);
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(D.t('api.err.notjson', { name: connector.name })); }
    }

    /** Subjects (ämnen): [{id, text}]. */
    async function subjects(connector, options) {
      const data = await getJson(connector, base(connector), options);
      return (Array.isArray(data) ? data : []).map((s) => ({ id: s.namn, text: s.text }));
    }

    /** Variables of a subject with their values, in PxWeb-variable form. */
    async function variables(connector, subject, options = {}) {
      const list = await getJson(connector, `${base(connector)}/${encodeURIComponent(subject)}`, options);
      const out = [];
      for (const v of Array.isArray(list) ? list : []) {
        const values = await getJson(connector, `${base(connector)}/${encodeURIComponent(subject)}/${encodeURIComponent(v.namn)}`, options);
        out.push({
          code: v.namn, text: v.text, info: v.info || '', elimination: true, time: v.namn === 'ar', metric: v.namn === 'matt',
          values: (Array.isArray(values) ? values : []).map((x) => ({ code: String(x.id), text: x.text !== undefined ? String(x.text) : String(x.id), kod: x.kod !== undefined ? String(x.kod) : null })),
        });
        if (options.onProgress) options.onProgress({ loaded: out.length, total: list.length });
      }
      return out;
    }

    /** Result path from a selection {code: {filter, values}}; variables without a selection return all. */
    function buildPath(subject, vars, selection) {
      const parts = [encodeURIComponent(subject), 'resultat'];
      for (const v of vars) {
        const sel = selection[v.code];
        let codes = null;
        if (sel && sel.filter === 'item' && sel.values && sel.values.length) codes = sel.values;
        else if (sel && sel.filter === 'top') codes = v.values.slice(-Math.max(1, sel.n || 1)).map((x) => x.code);
        if (codes && codes.length < v.values.length) parts.push(encodeURIComponent(v.code), codes.join(','));
      }
      return '/' + parts.join('/');
    }

    /** Fetch all pages of a result and join value texts. */
    async function fetchData(connector, subject, vars, selection, options = {}) {
      const path = buildPath(subject, vars, selection);
      const lookup = new Map(vars.map((v) => [v.code, new Map(v.values.map((x) => [x.code, x]))]));
      const columns = []; const rows = []; const requests = [];
      let page = 1; let pages = 1; let keys = null;
      for (;;) {
        const url = `${base(connector)}${path}?sida=${page}`;
        const data = await getJson(connector, url, options);
        const items = Array.isArray(data.data) ? data.data : [];
        requests.push({ url: secrets.mask(url, connector.id), status: 200, rows: items.length });
        if (!keys && items.length) {
          keys = Object.keys(items[0]).map((k) => ({ key: k, variable: k.endsWith('Id') && lookup.has(k.slice(0, -2)) ? k.slice(0, -2) : null }));
          for (const k of keys) {
            if (k.variable) { const v = vars.find((x) => x.code === k.variable); columns.push(v.text); if (v.values.some((x) => x.kod)) columns.push(v.text + '_kod'); columns.push(v.text + '_id'); }
            else columns.push(k.key === 'varde' ? 'varde' : k.key);
          }
        }
        for (const it of items) {
          const row = [];
          for (const k of keys || []) {
            if (k.variable) {
              const v = vars.find((x) => x.code === k.variable);
              const val = lookup.get(k.variable).get(String(it[k.key]));
              row.push(val ? val.text : String(it[k.key]));
              if (v.values.some((x) => x.kod)) row.push(val ? val.kod : null);
              row.push(String(it[k.key]));
            } else if (k.key === 'varde') row.push(it.varde === null || it.varde === undefined || it.varde === '' || /^\.+$/.test(String(it.varde)) ? null : types.parseNumber(String(it.varde), 'point'));
            else row.push(it[k.key]);
          }
          rows.push(row);
        }
        pages = Number(data.sidor) || 1;
        if (options.onProgress) options.onProgress({ pages: page, total: pages, rows: rows.length, url });
        if (page >= pages || !items.length) break;
        page++;
        if (options.maxPages && page > options.maxPages) break;
      }
      const typesMap = {};
      for (const c of columns) typesMap[c] = c === 'varde' || c === 'ar' ? (c === 'ar' ? 'integer' : 'number') : 'text';
      return { columns, rows, types: typesMap, meta: { pages, requests, truncated: false, label: data_label(data_subject(vars), subject) } };
    }
    function data_subject(vars) { return vars; }
    function data_label(_vars, subject) { return subject; }

    function describeSource(connector, subject, subjectText, vars, selection, result) {
      return {
        kind: 'api', family: 'socialstyrelsen', connectorId: connector.id, connectorName: connector.name, publisher: connector.publisher || null,
        subject, table: { id: subject, title: subjectText || subject }, selection,
        variables: vars.map((v) => ({ code: v.code, text: v.text, count: v.values.length })),
        rows: result ? result.rows.length : null, pages: result && result.meta ? result.meta.pages : null, fetchedAt: new Date().toISOString(), license: connector.license ? connector.license.name : null,
        url: result && result.meta && result.meta.requests && result.meta.requests[0] ? result.meta.requests[0].url : null,
      };
    }
    async function refetch(connector, source, options = {}) {
      const vars = await variables(connector, source.subject, options);
      return fetchData(connector, source.subject, vars, source.selection, options);
    }

    return { subjects, variables, buildPath, fetchData, describeSource, refetch };
  });
})();
