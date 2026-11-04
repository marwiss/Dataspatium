// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Rows for charts: filters become SQL, and when a chart only needs aggregates the grouping happens in
 * SQLite so that datasets with a million rows still render quickly. Rows are returned as objects
 * keyed by column name, the form Vega-Lite and D3 expect.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/data', ['data/datasets', 'data/types', 'data/lists', 'analysis/search', 'data/kinds'], (datasets, types, lists, search, kinds) => {
    const q = datasets.quoteIdent;
    const OPERATORS = [
      { id: '=', label: D.t('viz.op.eq') }, { id: '!=', label: D.t('viz.op.ne') }, { id: '>', label: D.t('viz.op.gt') }, { id: '>=', label: D.t('viz.op.ge') },
      { id: '<', label: D.t('viz.op.lt') }, { id: '<=', label: D.t('viz.op.le') }, { id: 'contains', label: D.t('viz.op.contains') }, { id: 'in', label: D.t('viz.op.in') },
      { id: 'empty', label: D.t('viz.op.empty') }, { id: 'notempty', label: D.t('viz.op.notempty') },
    ];
    const AGG_SQL = { sum: 'sum', mean: 'avg', average: 'avg', min: 'min', max: 'max', count: 'count', distinct: 'count(distinct', median: null };

    function coerce(value, type) {
      if (value === null || value === undefined) return null;
      if (type === 'integer' || type === 'number') { const n = types.parseNumber(String(value), String(value).includes(',') ? 'comma' : 'point'); return n === null ? value : n; }
      if (type === 'boolean') return types.parseValue(value, 'boolean');
      return String(value);
    }

    /** WHERE clause from filter rows [{field, op, value}]; unknown fields are ignored. */
    function whereClause(filters = [], columns = []) {
      const parts = []; const params = [];
      for (const f of filters) {
        if (!f || !f.field) continue;
        const col = columns.find((c) => c.name === f.field);
        if (!col) continue;
        const ident = q(col.name);
        if (f.op === 'empty') parts.push(`(${ident} is null or cast(${ident} as text) = '')`);
        else if (f.op === 'notempty') parts.push(`(${ident} is not null and cast(${ident} as text) != '')`);
        else if (f.op === 'contains') { parts.push(`cast(${ident} as text) like ?`); params.push('%' + String(f.value === undefined ? '' : f.value) + '%'); }
        else if (f.op === 'in') {
          const list = String(f.value || '').split(',').map((s) => s.trim()).filter(Boolean).map((v) => coerce(v, col.type));
          if (list.length) { parts.push(`${ident} in (${list.map(() => '?').join(', ')})`); params.push(...list); }
        } else if (['=', '!=', '>', '>=', '<', '<='].includes(f.op)) {
          if (f.value === undefined || f.value === null || f.value === '') continue;
          parts.push(`${ident} ${f.op} ?`); params.push(coerce(f.value, col.type));
        }
      }
      return { sql: parts.join(' and '), params };
    }

    function toObjects(names, rows) {
      return rows.map((r) => { const o = {}; for (let i = 0; i < names.length; i++) o[names[i]] = r[i]; return o; });
    }

    /** A side table a chart may read: only those its kind offers, so a name from a saved chart cannot reach anything else. */
    function sideTable(handle, name) {
      if (!name) return null;
      return (kinds.of(handle.meta).chartTables || []).includes(name) ? name : null;
    }
    /** The columns of a side table, in the same form as a dataset's. */
    async function tableColumns(handle, table) {
      const r = await handle.engine.exec(`pragma table_info(${q(table)})`);
      return (r[0] ? r[0].values : []).map((row) => ({ name: String(row[1]), label: String(row[1]), type: /int|real|num/i.test(String(row[2] || '')) ? 'number' : 'text' }));
    }
    /**
     * The columns a chart can use: the dataset's own, or those of a side table.
     * @param {string} datasetId @param {string|null} [table] @returns {Promise<any[]>}
     */
    async function columnsOf(datasetId, table) {
      const handle = await datasets.ensureOpen(datasetId);
      const side = sideTable(handle, table);
      return side ? tableColumns(handle, side) : handle.columns;
    }

    /**
     * Fetch rows for a chart.
     * @param {string} datasetId
     * @param {{fields?: string[], filters?: any[], limit?: number, groupBy?: string[], aggregates?: Array<{field: string|null, fn: string, as: string}>, orderBy?: string}} request
     * @returns {Promise<{columns: string[], rows: Record<string, any>[], total: number, truncated: boolean, aggregated: boolean, sql: string}>}
     */
    async function fetchRows(datasetId, request = {}) {
      const handle = await datasets.ensureOpen(datasetId);
      const table = sideTable(handle, request.table);
      const columns = table ? await tableColumns(handle, table) : handle.columns;
      const from = table ? q(table) : 'data';
      const where = whereClause(request.filters || [], columns);
      // A saved list from Söka narrows the rows first; only search lists of this very dataset apply.
      if (request.listId) {
        const rec = await lists.get(request.listId);
        if (rec && rec.datasetId === datasetId && (rec.kind || 'search') !== 'query') {
          const lw = lists.whereOf(rec, columns, kinds.of(handle.meta).sideSearch || null);
          where.sql = where.sql ? `(${where.sql}) and (${lw.sql})` : lw.sql;
          where.params = where.params.concat(lw.params);
        }
      }
      const whereSql = where.sql ? ' where ' + where.sql : '';
      const limit = Math.max(1, Number(request.limit) || 50000);
      const countRes = await handle.engine.exec(`select count(*) from ${from}${whereSql}`, where.params);
      const total = Number(countRes[0].values[0][0]);
      if (request.aggregates && request.aggregates.length) {
        const groupBy = (request.groupBy || []).filter((g) => columns.some((c) => c.name === g));
        const selects = groupBy.map((g) => q(g));
        const names = groupBy.slice();
        for (const a of request.aggregates) {
          const fn = AGG_SQL[a.fn];
          if (fn === undefined || fn === null) continue;
          const expr = a.fn === 'count' && !a.field ? 'count(*)' : (a.fn === 'distinct' ? `count(distinct ${q(a.field)})` : `${fn}(${q(a.field)})`);
          selects.push(`${expr} as ${q(a.as)}`); names.push(a.as);
        }
        const sql = `select ${selects.join(', ')} from ${from}${whereSql}${groupBy.length ? ' group by ' + groupBy.map(q).join(', ') : ''} order by ${groupBy.length ? groupBy.map(q).join(', ') : '1'} limit ${limit}`;
        const res = await handle.engine.exec(sql, where.params);
        const rows = res[0] ? res[0].values : [];
        return { columns: names, rows: toObjects(names, rows), total, truncated: rows.length >= limit, aggregated: true, sql };
      }
      const fields = (request.fields && request.fields.length ? request.fields : columns.map((c) => c.name)).filter((f) => columns.some((c) => c.name === f));
      const orderBy = request.orderBy && columns.some((c) => c.name === request.orderBy) ? `${q(request.orderBy)} ${request.orderDir === 'desc' ? 'desc' : 'asc'} nulls last, rowid` : 'rowid';
      const sql = `select ${fields.map(q).join(', ')} from ${from}${whereSql} order by ${orderBy} limit ${limit}`;
      const res = await handle.engine.exec(sql, where.params);
      const rows = res[0] ? res[0].values : [];
      return { columns: fields, rows: toObjects(fields, rows), total, truncated: total > rows.length, aggregated: false, sql };
    }

    /** Distinct values of a column (for batch generation and filter suggestions). */
    async function distinctValues(datasetId, column, limit = 1000) {
      const handle = await datasets.ensureOpen(datasetId);
      if (!handle.columns.some((c) => c.name === column)) return [];
      const res = await handle.engine.exec(`select distinct ${q(column)} from data where ${q(column)} is not null order by 1 limit ${Math.max(1, limit | 0)}`);
      return (res[0] ? res[0].values : []).map((r) => r[0]);
    }

    return { fetchRows, columnsOf, whereClause, distinctValues, coerce, OPERATORS, AGG_SQL };
  });
})();
