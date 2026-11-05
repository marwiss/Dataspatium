// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The visual query (the Fråga tab in Söka): a small model of a question over one or several datasets that
 * compiles to the SQL the SQL console would run (data/query resolves other datasets by their short names). The
 * generated SQL is shown to the user and can be opened in Analysera, so everything here produces plain, readable
 * SQLite with literals inlined.
 *
 * spec = {
 *   from: { datasetId },
 *   joins: [{ datasetId, type: 'inner'|'left', on: [{ left: column, right: column }] }],
 *   columns: [{ source: 0, column, agg: null|'count'|'count_distinct'|'sum'|'avg'|'min'|'max', alias }],
 *   where: { op: 'and'|'or', items: [{ source, column, cmp, value } | { op, items }] },
 *   orderBy: [{ alias, dir: 'asc'|'desc' }],
 *   limit: 1000
 * }
 * source 0 is the primary dataset (`data`), source n the n-th join.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/querybuilder', ['data/datasets', 'data/query'], (datasets, query) => {
    const q = datasets.quoteIdent;
    const AGGS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'];
    const AGG_SQL = { count: 'count', count_distinct: 'count(distinct', sum: 'sum', avg: 'avg', min: 'min', max: 'max' };
    const CMP = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'startswith', 'in', 'between', 'empty', 'notempty'];
    const NUMERIC = /^(integer|number|float|real)$/;
    const DEFAULT_LIMIT = 1000;
    const MAX_STEPS = 6;

    function literal(value) {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
      if (typeof value === 'boolean') return value ? '1' : '0';
      return "'" + String(value).replace(/'/g, "''") + "'";
    }
    /** A typed literal: numbers stay numbers for numeric columns when the text parses as one. */
    function typed(value, type) {
      if (value === null || value === undefined || value === '') return 'null';
      if (NUMERIC.test(type || '')) { const n = Number(String(value).replace(',', '.').replace(/\s/g, '')); if (Number.isFinite(n)) return String(n); }
      if (type === 'boolean') { const s = String(value).toLowerCase(); if (['1', 'true', 'ja', 'yes', 'sant'].includes(s)) return '1'; if (['0', 'false', 'nej', 'no', 'falskt'].includes(s)) return '0'; }
      return literal(typeof value === 'number' ? value : String(value));
    }
    function likePattern(value, mode) {
      const escaped = String(value === undefined || value === null ? '' : value).replace(/[\\%_]/g, (ch) => '\\' + ch);
      return literal(mode === 'startswith' ? escaped + '%' : '%' + escaped + '%') + " escape '\\'";
    }

    /** Metadata the compiler needs: short names and columns of the primary and joined datasets. */
    async function metasFor(spec) {
      const ids = [spec.from && spec.from.datasetId].concat((spec.joins || []).map((j) => j.datasetId)).filter(Boolean);
      const out = new Map();
      for (const id of ids) {
        if (out.has(id)) continue;
        const meta = await datasets.get(id);
        if (!meta) throw new Error(D.t('fraga.err.missing'));
        out.set(id, { id, name: meta.name, shortName: meta.shortName || '', columns: await datasets.columns(id) });
      }
      return out;
    }

    /** Problems a spec has before it can run; an empty list means it compiles. */
    function validate(spec, metas) {
      const errors = [];
      if (!spec || !spec.from || !metas.get(spec.from.datasetId)) { errors.push(D.t('fraga.err.nofrom')); return errors; }
      const sources = [metas.get(spec.from.datasetId)].concat((spec.joins || []).map((j) => metas.get(j.datasetId)));
      (spec.joins || []).forEach((j, i) => {
        if (!sources[i + 1]) errors.push(D.t('fraga.err.missing'));
        else if (!sources[i + 1].shortName) errors.push(D.t('fraga.err.shortname', { name: sources[i + 1].name }));
        if (!j.on || !j.on.length || j.on.some((o) => !o.left || !o.right)) errors.push(D.t('fraga.err.join', { name: sources[i + 1] ? sources[i + 1].name : '' }));
      });
      const has = (c) => { const s = sources[c.source || 0]; return !!s && s.columns.some((x) => x.name === c.column); };
      if (!spec.columns || !spec.columns.length) errors.push(D.t('fraga.err.nocolumns'));
      for (const c of spec.columns || []) if (!has(c)) errors.push(D.t('fraga.err.column', { column: c.column }));
      const walk = (g) => { for (const it of (g && g.items) || []) { if (it.items) walk(it); else if (!it.special && !has(it)) errors.push(D.t('fraga.err.column', { column: it.column })); } };
      walk(spec.where);
      return errors;
    }

    /** The nodes a text points at: its id, or its name. */
    const nodesNamed = (text) => `(select id from data where id = ${literal(String(text))} or namn = ${literal(String(text))})`;
    /**
     * A condition that belongs to a kind of dataset, on the main table.
     * property: an element with a value in a property set; neighbour: a node one step from another; within: a node some steps
     * away; place: a row inside an area, whose rows `prepare` has found.
     * @param {any} it @returns {string}
     */
    function specialCondition(it) {
      switch (it.special) {
        case 'property': {
          const v = it.value === undefined || it.value === null ? '' : String(it.value);
          const numeric = v !== '' && Number.isFinite(Number(v.replace(',', '.')));
          const test = it.cmp === 'contains' ? `varde like ${likePattern(v, 'contains')}`
            : it.cmp === '>' || it.cmp === '<' || it.cmp === '>=' || it.cmp === '<=' ? `tal ${it.cmp} ${numeric ? Number(v.replace(',', '.')) : 'null'}`
              : it.cmp === '!=' ? `varde != ${literal(v)}` : `varde = ${literal(v)}`;
          return `t0.${q('id')} in (select id from _properties where uppsattning = ${literal(String(it.set || ''))} and namn = ${literal(String(it.name || ''))} and ${test})`;
        }
        case 'neighbour': {
          const nodes = nodesNamed(it.of);
          return `t0.${q('id')} in (select mal from _edges where kalla in ${nodes} union select kalla from _edges where mal in ${nodes})`;
        }
        case 'within': {
          const steps = Math.max(1, Math.min(MAX_STEPS, Math.trunc(Number(it.steps) || 1)));
          return `t0.${q('id')} in (with recursive narhet(id, steg) as (select id, 0 from data where id = ${literal(String(it.of))} or namn = ${literal(String(it.of))} union select case when e.kalla = n.id then e.mal else e.kalla end, n.steg + 1 from _edges e join narhet n on e.kalla = n.id or e.mal = n.id where n.steg < ${steps}) select id from narhet)`;
        }
        case 'place': return `t0.rowid in (${(it.rowids || []).map(Number).join(',')})`;
        default: return '';
      }
    }
    /**
     * Find the rows of the conditions that need more than SQL. Done on a copy, so that the rows are not kept in a saved list.
     * @param {any} spec @returns {Promise<any>} the spec to compile
     */
    async function prepare(spec) {
      const copy = JSON.parse(JSON.stringify(spec));
      const walk = async (g) => {
        for (const it of (g && g.items) || []) {
          if (it.items) await walk(it);
          else if (it.special === 'place') {
            const area = D.require('ui/soka/place-form').areaOf(it.place || {});
            it.rowids = (await D.require('data/spatial-search').rowsWithin(spec.from.datasetId, area)) || [];
          }
        }
      };
      await walk(copy.where);
      return copy;
    }

    /** The SQL of a spec. Column references use t0 (data) and t1… (joined short names). */
    function compile(spec, metas) {
      const errors = validate(spec, metas);
      if (errors.length) throw new Error(errors[0]);
      const sources = [metas.get(spec.from.datasetId)].concat((spec.joins || []).map((j) => metas.get(j.datasetId)));
      const ref = (c) => `t${c.source || 0}.${q(c.column)}`;
      const typeOf = (c) => { const s = sources[c.source || 0]; const col = s && s.columns.find((x) => x.name === c.column); return col ? col.type : 'text'; };
      const anyAgg = (spec.columns || []).some((c) => c.agg);
      const used = new Set();
      const aliasOf = (c) => {
        let base = c.alias || (c.agg ? `${c.agg}_${c.column}` : c.column);
        let alias = base; let n = 2;
        while (used.has(alias)) alias = `${base}_${n++}`;
        used.add(alias);
        return alias;
      };
      const selectParts = []; const groupParts = []; const aliases = [];
      for (const c of spec.columns || []) {
        const alias = aliasOf(c);
        aliases.push(alias);
        if (c.agg) {
          const fn = AGG_SQL[c.agg] || 'count';
          selectParts.push(`${fn}(${ref(c)}${c.agg === 'count_distinct' ? ')' : ''}) as ${q(alias)}`);
        } else {
          selectParts.push(`${ref(c)} as ${q(alias)}`);
          if (anyAgg) groupParts.push(ref(c));
        }
      }
      const fromParts = [`${q('data')} t0`];
      (spec.joins || []).forEach((j, i) => {
        const s = sources[i + 1];
        const on = j.on.map((o) => `t0.${q(o.left)} = t${i + 1}.${q(o.right)}`).join(' and ');
        fromParts.push(`${j.type === 'left' ? 'left join' : 'join'} ${q(s.shortName)} t${i + 1} on ${on}`);
      });
      const cond = (it) => {
        if (it.special) return specialCondition(it);
        if (it.items) { const inner = it.items.map(cond).filter(Boolean); return inner.length ? '(' + inner.join(it.op === 'or' ? ' or ' : ' and ') + ')' : ''; }
        const r = ref(it); const ty = typeOf(it); const v = it.value;
        switch (it.cmp) {
          case 'empty': return `(${r} is null or cast(${r} as text) = '')`;
          case 'notempty': return `(${r} is not null and cast(${r} as text) != '')`;
          case 'contains': return `cast(${r} as text) like ${likePattern(v, 'contains')}`;
          case 'startswith': return `cast(${r} as text) like ${likePattern(v, 'startswith')}`;
          case 'in': { const list = (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter((s) => s !== ''); return list.length ? `${r} in (${list.map((s) => typed(s, ty)).join(', ')})` : ''; }
          case 'between': { const pair = Array.isArray(v) ? v : String(v || '').split(/\s*(?:\.\.|,)\s*/); return pair.length >= 2 ? `${r} between ${typed(pair[0], ty)} and ${typed(pair[1], ty)}` : ''; }
          case '!=': return `${r} != ${typed(v, ty)}`;
          case '>': case '>=': case '<': case '<=': return `${r} ${it.cmp} ${typed(v, ty)}`;
          default: return `${r} = ${typed(v, ty)}`;
        }
      };
      const where = spec.where ? cond(spec.where) : '';
      const order = (spec.orderBy || []).filter((o) => aliases.includes(o.alias)).map((o) => `${q(o.alias)} ${o.dir === 'desc' ? 'desc' : 'asc'}`);
      let sql = `select ${selectParts.join(', ')}\nfrom ${fromParts.join('\n  ')}`;
      if (where) sql += `\nwhere ${where}`;
      if (groupParts.length) sql += `\ngroup by ${groupParts.join(', ')}`;
      if (order.length) sql += `\norder by ${order.join(', ')}`;
      const limit = spec.limit === null || spec.limit === undefined ? DEFAULT_LIMIT : Number(spec.limit);
      if (limit > 0) sql += `\nlimit ${Math.floor(limit)}`;
      return { sql, aliases, sources: sources.map((s) => s.id) };
    }

    /** Compile and run; the result has the same shape as data/query.select plus the SQL. */
    async function run(spec, options = {}) {
      const metas = await metasFor(spec);
      const { sql, aliases } = compile(await prepare(spec), metas);
      const res = await query.select(spec.from.datasetId, sql, { limit: options.limit || Math.max(DEFAULT_LIMIT, Number(spec.limit) || 0) });
      return Object.assign({ sql, aliases }, res);
    }
    /** The result as a new dataset. */
    async function toDataset(spec, name) {
      const metas = await metasFor(spec);
      const { sql } = compile(await prepare(spec), metas);
      return query.createDataset(spec.from.datasetId, sql, { name, source: { kind: 'derived', op: 'query', sql, spec } });
    }
    /** Readable one-liner: "befolkning + kommuner: region, summa; antal > 1". */
    function describe(spec, metas) {
      const names = [spec.from && metas.get(spec.from.datasetId)].concat((spec.joins || []).map((j) => metas.get(j.datasetId))).filter(Boolean).map((m) => m.shortName || m.name);
      const cols = (spec.columns || []).map((c) => (c.agg ? `${c.agg}(${c.column})` : c.column));
      const conds = [];
      const walk = (g) => { for (const it of (g && g.items) || []) { if (it.items) walk(it); else if (it.special) conds.push(D.t('fraga.special.' + it.special)); else conds.push(`${it.column} ${it.cmp}${it.value === undefined || it.value === null || it.value === '' || /empty/.test(it.cmp) ? '' : ' ' + (Array.isArray(it.value) ? it.value.join(', ') : it.value)}`); } };
      walk(spec.where);
      return `${names.join(' + ')}: ${cols.join(', ')}${conds.length ? '; ' + conds.join(', ') : ''}`;
    }
    /** An empty spec for a dataset. */
    function empty(datasetId) { return { from: { datasetId }, joins: [], columns: [], where: { op: 'and', items: [] }, orderBy: [], limit: DEFAULT_LIMIT }; }

    return { AGGS, CMP, DEFAULT_LIMIT, MAX_STEPS, prepare, compile, validate, metasFor, run, toDataset, describe, empty, literal, typed };
  });
})();
