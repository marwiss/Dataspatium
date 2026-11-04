// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Full-text search across datasets (Söka). Every column is matched as text, case-insensitively including
 * non-ASCII letters (the regex function registered in the SQLite worker), every word of the query must occur
 * somewhere in the row, and facet filters (column = value) narrow the hits. Results come per dataset with the
 * count, the first rows and facets: the most common values of low-cardinality columns among the hits.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/search', ['data/datasets', 'data/kinds'], (datasets, kinds) => {
    const q = datasets.quoteIdent;
    /** Rows returned per dataset. */
    const ROWS = 100;
    /** At most this many facet columns per dataset, values per facet, and distinct values for a column to be a facet. */
    const FACET_COLUMNS = 6;
    const FACET_VALUES = 8;
    const FACET_DISTINCT = 24;

    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

    /** The row as one text: every column cast to text, nulls empty, space-separated. */
    function rowText(columns) { return columns.map((c) => `coalesce(cast(${q(c.name)} as text), '')`).join(" || ' ' || "); }

    /**
     * WHERE clause (without the keyword) for a query text and facet filters.
     * @param {Array<{name: string}>} columns
     * @param {string} text
     * @param {Array<{column: string, value: any}>} [filters]
     * @returns {{sql: string, params: any[]}}
     */
    function where(columns, text, filters = [], side = null) {
      const clauses = []; const params = [];
      const ws = words(text);
      if (ws.length) {
        const expr = rowText(columns);
        // A word may also be in the side table of a graph or a model; the row it belongs to is then the hit.
        const sideExpr = side ? rowText(side.columns.map((name) => ({ name }))) : null;
        for (const w of ws) {
          const own = `dm_regex_test(${expr}, ?, 'i') = 1`;
          params.push(escapeRegex(w));
          if (!side) { clauses.push(own); continue; }
          const subs = side.keys.map((key) => `${q(side.on)} in (select ${q(key)} from ${q(side.table)} where dm_regex_test(${sideExpr}, ?, 'i') = 1)`);
          side.keys.forEach(() => params.push(escapeRegex(w)));
          clauses.push(`(${own} or ${subs.join(' or ')})`);
        }
      }
      for (const f of filters) {
        if (!columns.some((c) => c.name === f.column)) continue;
        if (f.value === null || f.value === undefined) clauses.push(`${q(f.column)} is null`);
        else { clauses.push(`cast(${q(f.column)} as text) = ?`); params.push(String(f.value)); }
      }
      return { sql: clauses.length ? clauses.join(' and ') : '1 = 1', params };
    }

    /**
     * Facets: low-cardinality text and boolean columns among the hits with their most common values. A column
     * where every hit has its own value (an identifier, a name) narrows nothing and is left out.
     */
    async function facetsOf(handle, w, filters, count) {
      const out = [];
      const used = new Set(filters.map((f) => f.column));
      for (const col of handle.columns) {
        if (out.length >= FACET_COLUMNS) break;
        if (used.has(col.name) || !(col.type === 'text' || col.type === 'boolean')) continue;
        const d = await handle.engine.exec(`select count(distinct ${q(col.name)}) from data where ${w.sql}`, w.params);
        const distinct = d[0] ? Number(d[0].values[0][0]) : 0;
        if (distinct < 2 || distinct > FACET_DISTINCT || distinct >= count) continue;
        const v = await handle.engine.exec(`select ${q(col.name)}, count(*) as n from data where ${w.sql} group by ${q(col.name)} order by n desc, ${q(col.name)} limit ${FACET_VALUES}`, w.params);
        out.push({ column: col.name, label: col.label || col.name, values: (v[0] ? v[0].values : []).map((r) => ({ value: r[0], n: Number(r[1]) })) });
      }
      return out;
    }

    /** The side table a dataset's kind searches, when the dataset really has it. */
    async function sideOf(handle) {
      const side = kinds.of(handle.meta).sideSearch;
      if (!side) return null;
      const r = await handle.engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [side.table]);
      return r[0] && Number(r[0].values[0][0]) ? side : null;
    }

    /**
     * Search one dataset.
     * @param {string} id
     * @param {string} text
     * @param {Array<{column: string, value: any}>} [filters]
     * @param {{limit?: number, facets?: boolean}} [options]
     * @returns {Promise<{id: string, count: number, columns: any[], rows: any[][], facets: any[], truncated: boolean}>} rows carry the rowid first
     */
    async function searchDataset(id, text, filters = [], options = {}) {
      const handle = await datasets.ensureOpen(id);
      const cols = handle.columns;
      const w = where(cols, text, filters, await sideOf(handle));
      // Rows already chosen, by a list or by where they are.
      if (options.rowids) w.sql = `(${w.sql}) and rowid in (${options.rowids.map(Number).join(',')})`;
      const limit = Math.max(1, options.limit || ROWS);
      const c = await handle.engine.exec(`select count(*) from data where ${w.sql}`, w.params);
      const count = c[0] ? Number(c[0].values[0][0]) : 0;
      let rows = [];
      if (count) {
        const r = await handle.engine.exec(`select rowid, ${cols.map((col) => q(col.name)).join(', ')} from data where ${w.sql} order by rowid limit ${limit}`, w.params);
        rows = r[0] ? r[0].values : [];
      }
      const facets = count && options.facets !== false ? await facetsOf(handle, w, filters, count) : [];
      return { id, count, columns: cols, rows, facets, truncated: count > rows.length };
    }

    /**
     * Search several datasets in order. A dataset that fails (removed meanwhile) is skipped and logged.
     * @param {string[]} ids
     * @param {string} text
     * @param {{filters?: Record<string, Array<{column: string, value: any}>>, limit?: number, signal?: AbortSignal}} [options]
     */
    async function search(ids, text, options = {}) {
      const results = [];
      for (const id of ids) {
        if (options.signal && options.signal.aborted) break;
        // Searching by place: only datasets with places take part.
        const place = options.rowidsFor ? options.rowidsFor.get(id) : undefined;
        if (options.rowidsFor && !place) continue;
        try { results.push(await searchDataset(id, text, (options.filters && options.filters[id]) || [], place ? Object.assign({}, options, { rowids: place }) : options)); }
        catch (err) { D.log('search', 'skipped', id, err); }
      }
      return results;
    }

    /**
     * The condition for a search in a dataset, side table included.
     * @param {string} id @param {string} text @param {any[]} [filters] @returns {Promise<{sql: string, params: any[]}>}
     */
    async function whereIn(id, text, filters = []) {
      const handle = await datasets.ensureOpen(id);
      return where(handle.columns, text, filters, await sideOf(handle));
    }

    /** SQL selecting the hits of one dataset (used to turn a list into a dataset). */
    function hitsSql(columns, text, filters, side = null) {
      const w = where(columns, text, filters, side);
      return { sql: `select ${columns.map((c) => q(c.name)).join(', ')} from data where ${w.sql}`, params: w.params };
    }

    return { search, searchDataset, where, whereIn, hitsSql, escapeRegex, words, ROWS };
  });
})();
