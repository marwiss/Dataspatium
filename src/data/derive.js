// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Operations that produce a new dataset from one or two existing ones: aggregate, join, append and
 * category clustering helpers. In-place operations live in operations.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/derive', ['data/datasets', 'data/operations', 'data/types'], (datasets, ops, types) => {
    const { q, lit } = ops;
    const AGG_FUNCTIONS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct', 'median'];

    function aggExpr(fn, column) {
      const c = q(column);
      switch (fn) {
        case 'count': return column ? `count(${c})` : 'count(*)';
        case 'count_distinct': return `count(distinct ${c})`;
        case 'median': return `(select avg(v) from (select ${c} as v from data order by ${c} limit 2 - (select count(*) from data) % 2 offset (select (count(*) - 1) / 2 from data)))`;
        default: return `${fn}(${c})`;
      }
    }

    /**
     * Group and aggregate into a new dataset.
     * @param {string} id
     * @param {{groupBy: string[], aggregations: Array<{column?: string, fn: string, as?: string}>, name: string}} spec
     */
    async function aggregate(id, spec) {
      const groupBy = spec.groupBy || [];
      const aggs = (spec.aggregations || []).filter((a) => AGG_FUNCTIONS.includes(a.fn));
      if (!aggs.length) throw new Error('Välj minst en beräkning.');
      const handle = await datasets.ensureOpen(id);
      const typeOf = (name) => { const c = handle.columns.find((x) => x.name === name); return c ? c.type : 'text'; };
      const selects = groupBy.map(q);
      const outTypes = {};
      for (const g of groupBy) outTypes[g] = typeOf(g);
      for (const a of aggs) {
        const alias = a.as || `${a.fn}_${a.column || 'rader'}`;
        selects.push(`${aggExpr(a.fn, a.column)} as ${q(alias)}`);
        outTypes[alias] = a.fn === 'count' || a.fn === 'count_distinct' ? 'integer' : (a.fn === 'avg' || a.fn === 'median' ? 'number' : typeOf(a.column || ''));
      }
      const sql = `select ${selects.join(', ')} from data${groupBy.length ? ' group by ' + groupBy.map(q).join(', ') : ''} order by ${groupBy.length ? groupBy.map(q).join(', ') : '1'}`;
      return datasets.createFromQuery(id, sql, { name: spec.name || 'Aggregering', types: outTypes, source: { kind: 'aggregate', from: id, groupBy, aggregations: aggs } });
    }

    /**
     * Join two datasets on key pairs into a new dataset.
     * @param {string} leftId @param {string} rightId
     * @param {{keys: Array<[string, string]>, type: 'left'|'inner', rightColumns?: string[], name: string}} spec
     */
    async function join(leftId, rightId, spec) {
      if (!spec.keys || !spec.keys.length) throw new Error('Välj minst ett nyckelpar.');
      const left = await datasets.ensureOpen(leftId);
      const rightCols = await datasets.copyInto(left, rightId, 'dm_right');
      try {
        const leftNames = left.columns.map((c) => c.name);
        const chosen = (spec.rightColumns && spec.rightColumns.length ? spec.rightColumns : rightCols.map((c) => c.name)).filter((n) => !spec.keys.some(([, r]) => r === n));
        const selects = leftNames.map((n) => `a.${q(n)} as ${q(n)}`);
        const outTypes = Object.fromEntries(left.columns.map((c) => [c.name, c.type]));
        for (const n of chosen) {
          const alias = leftNames.includes(n) ? `${n}_2` : n;
          selects.push(`b.${q(n)} as ${q(alias)}`);
          const rc = rightCols.find((c) => c.name === n);
          outTypes[alias] = rc ? rc.type : 'text';
        }
        const on = spec.keys.map(([l, r]) => `a.${q(l)} = b.${q(r)}`).join(' and ');
        const sql = `select ${selects.join(', ')} from data a ${spec.type === 'inner' ? 'inner' : 'left'} join dm_right b on ${on}`;
        return await datasets.createFromQuery(leftId, sql, { name: spec.name || 'Kopplad datamängd', types: outTypes, source: { kind: 'join', left: leftId, right: rightId, keys: spec.keys, type: spec.type } });
      } finally {
        await left.engine.run('drop table if exists dm_right');
      }
    }

    /** Append rows of other datasets to a copy of the first (columns matched by name). */
    async function append(ids, name) {
      if (!ids || ids.length < 2) throw new Error('Välj minst två datamängder.');
      const base = await datasets.ensureOpen(ids[0]);
      const baseNames = base.columns.map((c) => c.name);
      const unions = [`select ${baseNames.map(q).join(', ')} from data`];
      const temps = [];
      try {
        for (let i = 1; i < ids.length; i++) {
          const tmp = `dm_append_${i}`;
          const cols = await datasets.copyInto(base, ids[i], tmp);
          temps.push(tmp);
          const names = cols.map((c) => c.name);
          unions.push(`select ${baseNames.map((n) => (names.includes(n) ? q(n) : 'NULL as ' + q(n))).join(', ')} from ${q(tmp)}`);
        }
        const sql = unions.join(' union all ');
        return await datasets.createFromQuery(ids[0], sql, { name: name || 'Sammanslagen datamängd', types: Object.fromEntries(base.columns.map((c) => [c.name, c.type])), source: { kind: 'append', from: ids } });
      } finally {
        for (const t of temps) await base.engine.run(`drop table if exists ${q(t)}`);
      }
    }

    /**
     * Cluster similar values of a text column (OpenRefine-style key collision on fingerprints).
     * @returns {Promise<Array<{key: string, values: Array<{value: string, count: number}>, suggested: string, total: number}>>}
     */
    async function clusters(id, column, limit = 50) {
      const handle = await datasets.ensureOpen(id);
      const res = await handle.engine.exec(`select ${q(column)}, count(*) as n, dm_fingerprint(${q(column)}) as k from data where ${q(column)} is not null and cast(${q(column)} as text) != '' group by ${q(column)} order by k, n desc`);
      const groups = new Map();
      for (const [value, n, key] of (res[0] ? res[0].values : [])) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ value: String(value), count: Number(n) });
      }
      const out = [];
      for (const [key, values] of groups) {
        if (values.length < 2) continue;
        const suggested = values.slice().sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'sv'))[0].value;
        out.push({ key, values, suggested, total: values.reduce((s, v) => s + v.count, 0) });
      }
      out.sort((a, b) => b.total - a.total);
      return out.slice(0, limit);
    }

    return { aggregate, join, append, clusters, AGG_FUNCTIONS, lit };
  });
})();
