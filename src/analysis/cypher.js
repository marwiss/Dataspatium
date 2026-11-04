// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A Cypher subset translated to SQL over a graph dataset (data/graph: nodes in `data`, edges in `_edges`, properties
 * as JSON): MATCH and OPTIONAL MATCH with node and relationship patterns (labels, types, property maps, direction,
 * variable length with a bound), WHERE (comparisons, AND/OR/NOT, IN, IS NULL, STARTS WITH, ENDS WITH, CONTAINS,
 * arithmetic), RETURN with DISTINCT, aliases and aggregates (count, sum, avg, min, max, collect) with Cypher's
 * implicit grouping, ORDER BY, SKIP and LIMIT, and the functions id(), labels(), type(), toLower(), toUpper(),
 * size(), coalesce(), exists(). The SQL is shown to the user, so the translation stays readable. Writing clauses
 * (CREATE, MERGE, SET, DELETE) are not part of this subset; they belong to graph editing.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/cypher', ['data/graph', 'data/datasets'], (graph, datasets) => {
    const KEYWORDS = new Set(['MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'DISTINCT', 'ORDER', 'BY', 'ASC', 'ASCENDING', 'DESC', 'DESCENDING', 'SKIP', 'LIMIT', 'AND', 'OR', 'NOT', 'XOR', 'IN', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'STARTS', 'ENDS', 'WITH', 'CONTAINS', 'UNWIND', 'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'CALL', 'UNION', 'WITH']);
    const MAX_DEPTH = 10;
    const DEFAULT_LIMIT = 10000;
    const AGGREGATES = new Set(['count', 'sum', 'avg', 'min', 'max', 'collect']);

    // ---- tokenizer -----------------------------------------------------------------------------------------------
    function tokenize(text) {
      const out = []; let i = 0; const s = String(text);
      const push = (type, value, pos) => out.push({ type, value, pos });
      while (i < s.length) {
        const ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
        if (ch === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); i = j < 0 ? s.length : j + 2; continue; }
        if (ch === '"' || ch === "'") { let j = i + 1; let v = ''; while (j < s.length && s[j] !== ch) { if (s[j] === '\\' && j + 1 < s.length) { v += s[j + 1]; j += 2; continue; } v += s[j++]; } if (j >= s.length) throw error('cypher.err.string', { pos: i }); push('string', v, i); i = j + 1; continue; }
        if (ch === '`') { const j = s.indexOf('`', i + 1); if (j < 0) throw error('cypher.err.string', { pos: i }); push('name', s.slice(i + 1, j), i); i = j + 1; continue; }
        const numm = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(i));
        if (numm && !(s[i - 1] && /[\p{L}_]/u.test(s[i - 1]))) { push('number', Number(numm[0]), i); i += numm[0].length; continue; }
        const idm = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(s.slice(i));
        if (idm) { const up = idm[0].toUpperCase(); push(KEYWORDS.has(up) ? 'kw' : 'name', KEYWORDS.has(up) ? up : idm[0], i); i += idm[0].length; continue; }
        const two = s.slice(i, i + 2);
        if (['<=', '>=', '<>', '!=', '->', '<-', '..', '=~'].includes(two)) { push('op', two, i); i += 2; continue; }
        if ('()[]{}:,.=<>+-*/%|$'.includes(ch)) { push('op', ch, i); i++; continue; }
        throw error('cypher.err.char', { ch, pos: i });
      }
      push('eof', '', s.length);
      return out;
    }
    function error(key, vars) { const e = new Error(D.t(key, vars || {})); e.cypher = true; return e; }

    // ---- parser --------------------------------------------------------------------------------------------------
    function parse(text) {
      const toks = tokenize(text); let p = 0;
      const peek = (o = 0) => toks[p + o];
      const isKw = (v, o = 0) => peek(o).type === 'kw' && peek(o).value === v;
      const isOp = (v, o = 0) => peek(o).type === 'op' && peek(o).value === v;
      const next = () => toks[p++];
      const expectOp = (v) => { if (!isOp(v)) throw error('cypher.err.expected', { what: v, pos: peek().pos }); return next(); };
      const expectKw = (v) => { if (!isKw(v)) throw error('cypher.err.expected', { what: v, pos: peek().pos }); return next(); };
      const name = () => { const t = peek(); if (t.type !== 'name') throw error('cypher.err.expected', { what: D.t('cypher.name'), pos: t.pos }); return next().value; };

      const query = { matches: [], where: [], returns: null, orderBy: [], skip: null, limit: null, distinct: false };
      while (peek().type !== 'eof') {
        if (isKw('OPTIONAL') || isKw('MATCH')) {
          const optional = isKw('OPTIONAL'); if (optional) next();
          expectKw('MATCH');
          const patterns = [patternPath()];
          while (isOp(',')) { next(); patterns.push(patternPath()); }
          const where = isKw('WHERE') ? (next(), expression()) : null;
          query.matches.push({ optional, patterns, where });
        } else if (isKw('WHERE')) {
          next(); query.where.push(expression());
        } else if (isKw('RETURN')) {
          next();
          if (isKw('DISTINCT')) { next(); query.distinct = true; }
          const items = [returnItem()];
          while (isOp(',')) { next(); items.push(returnItem()); }
          query.returns = items;
          if (isKw('ORDER')) { next(); expectKw('BY'); query.orderBy.push(orderItem()); while (isOp(',')) { next(); query.orderBy.push(orderItem()); } }
          if (isKw('SKIP')) { next(); query.skip = intLiteral(); }
          if (isKw('LIMIT')) { next(); query.limit = intLiteral(); }
        } else if (peek().type === 'kw' && ['CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'CALL', 'UNWIND', 'WITH', 'UNION'].includes(peek().value)) {
          throw error('cypher.err.unsupported', { what: peek().value });
        } else throw error('cypher.err.unexpected', { what: String(peek().value), pos: peek().pos });
      }
      if (!query.returns) throw error('cypher.err.noreturn');
      return query;

      function intLiteral() { const t = next(); if (t.type !== 'number') throw error('cypher.err.expected', { what: D.t('cypher.number'), pos: t.pos }); return Math.max(0, Math.floor(t.value)); }
      function patternPath() {
        let pathVar = null;
        if (peek().type === 'name' && isOp('=', 1)) { pathVar = next().value; next(); }
        if (peek().type === 'name' && /^shortestpath$/i.test(peek().value)) throw error('cypher.err.unsupported', { what: 'shortestPath' });
        const elements = [nodePattern()];
        while (isOp('-') || isOp('<-')) { elements.push(relPattern()); elements.push(nodePattern()); }
        return { pathVar, elements };
      }
      function nodePattern() {
        expectOp('(');
        const node = { kind: 'node', variable: null, labels: [], props: null };
        if (peek().type === 'name') node.variable = next().value;
        while (isOp(':')) { next(); node.labels.push(name()); }
        if (isOp('{')) node.props = mapLiteral();
        expectOp(')');
        return node;
      }
      function relPattern() {
        const rel = { kind: 'rel', variable: null, types: [], props: null, direction: 'both', min: 1, max: 1, variableLength: false };
        const left = next(); // '-' or '<-'
        if (left.value === '<-') rel.direction = 'in';
        if (isOp('[')) {
          next();
          if (peek().type === 'name') rel.variable = next().value;
          if (isOp(':')) { next(); rel.types.push(name()); while (isOp('|')) { next(); if (isOp(':')) next(); rel.types.push(name()); } }
          if (isOp('*')) {
            next(); rel.variableLength = true; rel.min = 1; rel.max = MAX_DEPTH;
            if (peek().type === 'number') { rel.min = next().value; rel.max = rel.min; }
            if (isOp('..')) { next(); rel.max = peek().type === 'number' ? next().value : MAX_DEPTH; }
            if (rel.max > MAX_DEPTH) rel.max = MAX_DEPTH;
          }
          if (isOp('{')) rel.props = mapLiteral();
          expectOp(']');
        }
        const right = next();
        if (right.value === '->') { if (rel.direction === 'in') throw error('cypher.err.direction'); rel.direction = 'out'; }
        else if (right.value !== '-') throw error('cypher.err.expected', { what: '->', pos: right.pos });
        return rel;
      }
      function mapLiteral() {
        expectOp('{');
        const entries = [];
        while (!isOp('}')) { const key = name(); expectOp(':'); entries.push({ key, value: expression() }); if (isOp(',')) next(); else break; }
        expectOp('}');
        return entries;
      }
      function returnItem() { const expr = expression(); let alias = null; if (isKw('AS')) { next(); alias = name(); } return { expr, alias }; }
      function orderItem() { const expr = expression(); let dir = 'asc'; if (isKw('ASC') || isKw('ASCENDING')) { next(); } else if (isKw('DESC') || isKw('DESCENDING')) { next(); dir = 'desc'; } return { expr, dir }; }
      // Expressions: OR > XOR > AND > NOT > comparison > additive > multiplicative > unary > primary.
      function expression() { return orExpr(); }
      function orExpr() { let left = andExpr(); while (isKw('OR') || isKw('XOR')) { const op = next().value; left = { type: 'binary', op, left, right: andExpr() }; } return left; }
      function andExpr() { let left = notExpr(); while (isKw('AND')) { next(); left = { type: 'binary', op: 'AND', left, right: notExpr() }; } return left; }
      function notExpr() { if (isKw('NOT')) { next(); return { type: 'not', expr: notExpr() }; } return comparison(); }
      function comparison() {
        let left = additive();
        for (;;) {
          if (peek().type === 'op' && ['=', '<>', '!=', '<', '<=', '>', '>='].includes(peek().value)) { const op = next().value; left = { type: 'binary', op: op === '!=' ? '<>' : op, left, right: additive() }; continue; }
          if (isKw('IS')) { next(); let neg = false; if (isKw('NOT')) { next(); neg = true; } expectKw('NULL'); left = { type: 'isnull', neg, expr: left }; continue; }
          if (isKw('IN')) { next(); left = { type: 'in', expr: left, list: additive() }; continue; }
          if (isKw('STARTS')) { next(); expectKw('WITH'); left = { type: 'text', op: 'starts', expr: left, arg: additive() }; continue; }
          if (isKw('ENDS')) { next(); expectKw('WITH'); left = { type: 'text', op: 'ends', expr: left, arg: additive() }; continue; }
          if (isKw('CONTAINS')) { next(); left = { type: 'text', op: 'contains', expr: left, arg: additive() }; continue; }
          if (isOp('=~')) throw error('cypher.err.unsupported', { what: '=~' });
          return left;
        }
      }
      function additive() { let left = multiplicative(); while (isOp('+') || isOp('-')) { const op = next().value; left = { type: 'arith', op, left, right: multiplicative() }; } return left; }
      function multiplicative() { let left = unary(); while (isOp('*') || isOp('/') || isOp('%')) { const op = next().value; left = { type: 'arith', op, left, right: unary() }; } return left; }
      function unary() { if (isOp('-')) { next(); return { type: 'neg', expr: unary() }; } if (isOp('+')) { next(); return unary(); } return primary(); }
      function primary() {
        const t = peek();
        if (t.type === 'string') { next(); return { type: 'literal', value: t.value }; }
        if (t.type === 'number') { next(); return { type: 'literal', value: t.value }; }
        if (isKw('TRUE')) { next(); return { type: 'literal', value: true }; }
        if (isKw('FALSE')) { next(); return { type: 'literal', value: false }; }
        if (isKw('NULL')) { next(); return { type: 'literal', value: null }; }
        if (isOp('$')) { next(); return { type: 'param', name: name() }; }
        if (isOp('(')) { next(); const e = expression(); expectOp(')'); return e; }
        if (isOp('[')) { next(); const items = []; while (!isOp(']')) { items.push(expression()); if (isOp(',')) next(); else break; } expectOp(']'); return { type: 'list', items }; }
        if (isKw('COUNT') || (t.type === 'name' && isOp('(', 1))) {
          const fn = next().value.toLowerCase(); expectOp('(');
          let distinct = false; if (isKw('DISTINCT')) { next(); distinct = true; }
          const args = [];
          if (isOp('*')) { next(); args.push({ type: 'star' }); } else if (!isOp(')')) { args.push(expression()); while (isOp(',')) { next(); args.push(expression()); } }
          expectOp(')');
          return { type: 'call', fn, args, distinct };
        }
        if (t.type === 'name') {
          next();
          let node = { type: 'var', name: t.value };
          while (isOp('.')) { next(); node = { type: 'prop', expr: node, key: name() }; }
          return node;
        }
        throw error('cypher.err.unexpected', { what: String(t.value || t.type), pos: t.pos });
      }
    }

    // ---- SQL generation ------------------------------------------------------------------------------------------
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const sqlString = (s) => "'" + String(s).replace(/'/g, "''") + "'";
    const likeEscape = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);
    /**
     * Translate a Cypher query to SQL for a graph dataset. Returns {sql, params, columns, info}.
     * @param {string} text @param {{params?: Record<string, any>, limit?: number}} [options]
     */
    function translate(text, options = {}) {
      const ast = parse(text);
      const params = [];
      // Values are inlined as SQL literals: positional parameters would be reordered by the OPTIONAL MATCH subqueries.
      const addParam = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'null') : typeof v === 'boolean' ? (v ? '1' : '0') : v === null || v === undefined ? 'null' : sqlString(String(v)));
      const vars = new Map(); // name → {kind, alias, optional, cols(name) → sql}
      const from = []; // base FROM items: {sql}
      const joins = []; // 'join ... on ...' strings
      const whereParts = [];
      const ctes = [];
      let aliasN = 0; let cteN = 0; let optN = 0;
      const newAlias = (prefix) => `${prefix}${++aliasN}`;
      const col = (alias, kind) => (name) => {
        if (kind === 'node') { if (name === 'id') return `${alias}.id`; if (name === 'etikett' || name === 'labels') return `${alias}.etikett`; if (name === 'namn') return `${alias}.namn`; if (name === 'name') return `coalesce(json_extract(${alias}.egenskaper, '$.name'), ${alias}.namn)`; return `json_extract(${alias}.egenskaper, ${sqlString('$.' + name)})`; }
        if (name === 'id') return `${alias}.id`; if (name === 'typ' || name === 'type') return `${alias}.typ`; if (name === 'kalla') return `${alias}.kalla`; if (name === 'mal') return `${alias}.mal`;
        return `json_extract(${alias}.egenskaper, ${sqlString('$.' + name)})`;
      };
      const literalSql = (v) => (v === null ? 'null' : typeof v === 'boolean' ? (v ? '1' : '0') : addParam(v));

      // Pattern → table references and conditions. Variables already bound are reused; others get an alias.
      function bindNode(node, target) {
        const key = node.variable;
        let v = key ? vars.get(key) : null;
        let fresh = false;
        if (!v) { const alias = newAlias('n'); v = { kind: 'node', alias, optional: !!target.optional, col: col(alias, 'node'), fromSql: `data as ${alias}` }; if (key) vars.set(key, v); target.items.push(v); fresh = true; }
        else if (v.kind !== 'node') throw error('cypher.err.kind', { name: key });
        if (fresh || node.labels.length || node.props) {
          for (const l of node.labels) target.conds.push(`${v.col('etikett')} = ${addParam(l)}`);
          for (const e of node.props || []) target.conds.push(`${v.col(e.key)} = ${exprSql(e.value, target)}`);
        }
        return v;
      }
      function bindRel(rel, a, b, target) {
        if (rel.variableLength) {
          const cte = `walk${++cteN}`;
          const typeCond = rel.types.length ? ` and e.typ in (${rel.types.map((t) => sqlString(t)).join(', ')})` : '';
          const sel = (a, b) => `select e.${a} as start, e.${b} as finish from _edges as e where 1 = 1${typeCond}`;
          const stepSql = rel.direction === 'out' ? sel('kalla', 'mal') : rel.direction === 'in' ? sel('mal', 'kalla') : sel('kalla', 'mal') + ' union all ' + sel('mal', 'kalla');
          ctes.push(`${cte}(start, finish, depth, path) as (select s.start, s.finish, 1, ',' || s.start || ',' || s.finish || ',' from (${stepSql}) as s union all select w.start, s.finish, w.depth + 1, w.path || s.finish || ',' from ${cte} as w join (${stepSql}) as s on s.start = w.finish where w.depth < ${rel.max} and instr(w.path, ',' || s.finish || ',') = 0)`);
          const alias = newAlias('w');
          const v = { kind: 'walk', alias, optional: !!target.optional, col: (name) => (name === 'depth' || name === 'length' ? `${alias}.depth` : `${alias}.path`), fromSql: `${cte} as ${alias}` };
          target.items.push(v);
          target.conds.push(`${alias}.start = ${a.col('id')}`, `${alias}.finish = ${b.col('id')}`, `${alias}.depth >= ${rel.min}`, `${alias}.depth <= ${rel.max}`);
          if (rel.variable) vars.set(rel.variable, v);
          return v;
        }
        const key = rel.variable;
        let v = key ? vars.get(key) : null;
        if (!v) { const alias = newAlias('e'); v = { kind: 'rel', alias, optional: !!target.optional, col: col(alias, 'rel'), fromSql: `_edges as ${alias}` }; if (key) vars.set(key, v); target.items.push(v); }
        else if (v.kind !== 'rel') throw error('cypher.err.kind', { name: key });
        const ends = rel.direction === 'out' ? `${v.col('kalla')} = ${a.col('id')} and ${v.col('mal')} = ${b.col('id')}` : rel.direction === 'in' ? `${v.col('kalla')} = ${b.col('id')} and ${v.col('mal')} = ${a.col('id')}` : `((${v.col('kalla')} = ${a.col('id')} and ${v.col('mal')} = ${b.col('id')}) or (${v.col('kalla')} = ${b.col('id')} and ${v.col('mal')} = ${a.col('id')}))`;
        target.conds.push(ends);
        if (rel.types.length) target.conds.push(rel.types.length === 1 ? `${v.col('typ')} = ${addParam(rel.types[0])}` : `${v.col('typ')} in (${rel.types.map((t) => addParam(t)).join(', ')})`);
        for (const e of rel.props || []) target.conds.push(`${v.col(e.key)} = ${exprSql(e.value, target)}`);
        return v;
      }
      for (const m of ast.matches) {
        const target = { optional: m.optional, items: [], conds: [] };
        const boundBefore = new Set(vars.keys());
        for (const path of m.patterns) {
          let prev = null;
          for (let i = 0; i < path.elements.length; i++) {
            const el = path.elements[i];
            if (el.kind === 'node') { const v = bindNode(el, target); prev = v; continue; }
            const nextNode = path.elements[i + 1];
            const b = bindNode(nextNode, target);
            bindRel(el, prev, b, target);
            prev = b; i++;
          }
          if (path.pathVar) throw error('cypher.err.unsupported', { what: 'path = (…)' });
        }
        if (m.where) target.conds.push(exprSql(m.where, target));
        if (!m.optional) {
          for (const it of target.items) from.push(it.fromSql);
          whereParts.push(...target.conds);
        } else {
          // OPTIONAL MATCH: the new variables come from a derived table joined on the variables bound before it.
          const shared = Array.from(vars.entries()).filter(([k, v]) => boundBefore.has(k) && target.conds.some((c) => c.includes(v.alias + '.')));
          const opt = `o${++optN}`;
          const selects = [];
          for (const it of target.items) {
            if (it.kind === 'node') selects.push(`${it.alias}.id as ${q(it.alias + '__id')}`, `${it.alias}.etikett as ${q(it.alias + '__etikett')}`, `${it.alias}.namn as ${q(it.alias + '__namn')}`, `${it.alias}.egenskaper as ${q(it.alias + '__egenskaper')}`);
            else if (it.kind === 'rel') selects.push(`${it.alias}.id as ${q(it.alias + '__id')}`, `${it.alias}.kalla as ${q(it.alias + '__kalla')}`, `${it.alias}.mal as ${q(it.alias + '__mal')}`, `${it.alias}.typ as ${q(it.alias + '__typ')}`, `${it.alias}.egenskaper as ${q(it.alias + '__egenskaper')}`);
            else selects.push(`${it.alias}.depth as ${q(it.alias + '__depth')}`, `${it.alias}.path as ${q(it.alias + '__path')}`);
          }
          const keys = shared.map(([k, v]) => ({ key: k, outer: v.col('id'), inner: `${opt}.${q('key_' + v.alias)}` }));
          // The shared variables appear inside the subquery as their own table rows (they were bound outside): include them so the conditions resolve.
          const innerFrom = target.items.map((it) => it.fromSql).concat(shared.map(([, v]) => (v.kind === 'node' ? `data as ${v.alias}` : `_edges as ${v.alias}`)));
          for (const [, v] of shared) selects.push(`${v.col('id')} as ${q('key_' + v.alias)}`);
          const sub = `select ${selects.join(', ')} from ${innerFrom.join(', ')}${target.conds.length ? ' where ' + target.conds.join(' and ') : ''}`;
          joins.push(`left join (${sub}) as ${opt} on ${keys.length ? keys.map((k) => `${k.inner} = ${k.outer}`).join(' and ') : '1 = 1'}`);
          for (const it of target.items) {
            const prefix = `${opt}.${q(it.alias + '__')}`.slice(0, -1); // reuse below
            it.col = (name) => {
              if (it.kind === 'node') { if (name === 'id' || name === 'etikett' || name === 'namn' || name === 'labels') return `${opt}.${q(it.alias + '__' + (name === 'labels' ? 'etikett' : name))}`; if (name === 'name') return `coalesce(json_extract(${opt}.${q(it.alias + '__egenskaper')}, '$.name'), ${opt}.${q(it.alias + '__namn')})`; return `json_extract(${opt}.${q(it.alias + '__egenskaper')}, ${sqlString('$.' + name)})`; }
              if (it.kind === 'rel') { if (['id', 'kalla', 'mal', 'typ'].includes(name) || name === 'type') return `${opt}.${q(it.alias + '__' + (name === 'type' ? 'typ' : name))}`; return `json_extract(${opt}.${q(it.alias + '__egenskaper')}, ${sqlString('$.' + name)})`; }
              return `${opt}.${q(it.alias + '__' + (name === 'length' ? 'depth' : name))}`;
            };
            void prefix;
          }
        }
      }
      if (!from.length) throw error('cypher.err.nomatch');
      for (const w of ast.where) whereParts.push(exprSql(w, null));

      // RETURN: whole variables flatten to their columns; aggregates trigger GROUP BY on the rest.
      const selectItems = []; const groupBy = []; const columns = [];
      let hasAggregate = false;
      const usedNames = new Set();
      const uniqueName = (base) => { let n = base; let k = 2; while (usedNames.has(n)) n = `${base}_${k++}`; usedNames.add(n); return n; };
      for (const item of ast.returns) {
        if (item.expr.type === 'var' && !item.alias) {
          const v = vars.get(item.expr.name);
          if (!v) throw error('cypher.err.unbound', { name: item.expr.name });
          const fields = v.kind === 'node' ? ['id', 'etikett', 'namn', 'egenskaper'] : v.kind === 'rel' ? ['id', 'kalla', 'mal', 'typ', 'egenskaper'] : ['depth', 'path'];
          for (const f of fields) { const name = uniqueName(`${item.expr.name}_${f}`); const sql = f === 'egenskaper' ? (v.optional ? v.col('egenskaper').replace(/json_extract\((.*), '\$\.egenskaper'\)/, '$1') : `${v.alias}.egenskaper`) : v.col(f); selectItems.push(`${sql} as ${q(name)}`); groupBy.push(sql); columns.push(name); }
          continue;
        }
        const agg = containsAggregate(item.expr);
        if (agg) hasAggregate = true;
        const sql = exprSql(item.expr, null);
        const name = uniqueName(item.alias || exprName(item.expr));
        selectItems.push(`${sql} as ${q(name)}`); columns.push(name);
        if (!agg) groupBy.push(sql);
      }
      const orderSql = ast.orderBy.map((o) => { const alias = o.expr.type === 'var' && columns.includes(o.expr.name) && !vars.has(o.expr.name) ? q(o.expr.name) : exprSql(o.expr, null); return `${alias} ${o.dir}`; });
      const limit = ast.limit !== null ? ast.limit : (options.limit || DEFAULT_LIMIT);
      let sql = `select ${ast.distinct ? 'distinct ' : ''}${selectItems.join(', ')}\nfrom ${from.join(', ')}`;
      if (joins.length) sql += '\n' + joins.join('\n');
      if (whereParts.length) sql += `\nwhere ${whereParts.join('\n  and ')}`;
      if (hasAggregate && groupBy.length) sql += `\ngroup by ${groupBy.join(', ')}`;
      if (orderSql.length) sql += `\norder by ${orderSql.join(', ')}`;
      sql += `\nlimit ${limit}`;
      if (ast.skip) sql += ` offset ${ast.skip}`;
      if (ctes.length) sql = `with recursive ${ctes.join(',\n')}\n${sql}`;
      return { sql, params, columns, info: { variables: Array.from(vars.keys()), aggregate: hasAggregate, variableLength: ctes.length > 0, limit } };

      function containsAggregate(e) {
        if (!e || typeof e !== 'object') return false;
        if (e.type === 'call' && AGGREGATES.has(e.fn)) return true;
        return Object.values(e).some((v) => (Array.isArray(v) ? v.some(containsAggregate) : v && typeof v === 'object' && containsAggregate(v)));
      }
      function exprName(e) {
        if (e.type === 'prop') return `${exprName(e.expr)}.${e.key}`;
        if (e.type === 'var') return e.name;
        if (e.type === 'call') return `${e.fn}(${e.args.map((a) => (a.type === 'star' ? '*' : exprName(a))).join(', ')})`;
        if (e.type === 'literal') return String(e.value);
        return 'uttryck';
      }
      function resolveVar(name) { const v = vars.get(name); if (!v) throw error('cypher.err.unbound', { name }); return v; }
      function exprSql(e, target) {
        switch (e.type) {
          case 'literal': return literalSql(e.value);
          case 'param': { const v = options.params && options.params[e.name]; if (v === undefined) throw error('cypher.err.param', { name: e.name }); return literalSql(v); }
          case 'var': { const v = resolveVar(e.name); return v.col(v.kind === 'walk' ? 'depth' : 'id'); }
          case 'prop': { if (e.expr.type !== 'var') throw error('cypher.err.unsupported', { what: '.' + e.key }); const v = resolveVar(e.expr.name); return v.col(e.key); }
          case 'binary': {
            if (e.op === 'AND' || e.op === 'OR') return `(${exprSql(e.left, target)} ${e.op.toLowerCase()} ${exprSql(e.right, target)})`;
            if (e.op === 'XOR') return `((${exprSql(e.left, target)}) <> (${exprSql(e.right, target)}))`;
            return `${exprSql(e.left, target)} ${e.op} ${exprSql(e.right, target)}`;
          }
          case 'not': return `not (${exprSql(e.expr, target)})`;
          case 'neg': return `-(${exprSql(e.expr, target)})`;
          case 'arith': return `(${exprSql(e.left, target)} ${e.op} ${exprSql(e.right, target)})`;
          case 'isnull': return `${exprSql(e.expr, target)} is ${e.neg ? 'not ' : ''}null`;
          case 'in': { if (e.list.type !== 'list') throw error('cypher.err.unsupported', { what: 'IN ' + D.t('cypher.list') }); return `${exprSql(e.expr, target)} in (${e.list.items.map((it) => exprSql(it, target)).join(', ')})`; }
          case 'text': {
            if (e.arg.type !== 'literal' || typeof e.arg.value !== 'string') throw error('cypher.err.unsupported', { what: 'STARTS WITH ' + D.t('cypher.expr') });
            const v = likeEscape(e.arg.value);
            const pattern = e.op === 'starts' ? v + '%' : e.op === 'ends' ? '%' + v : '%' + v + '%';
            return `${exprSql(e.expr, target)} like ${addParam(pattern)} escape '\\'`;
          }
          case 'list': return `json_array(${e.items.map((it) => exprSql(it, target)).join(', ')})`;
          case 'call': return callSql(e, target);
          default: throw error('cypher.err.unsupported', { what: e.type });
        }
      }
      function callSql(e, target) {
        const a = (i) => exprSql(e.args[i], target);
        const arg0 = e.args[0];
        switch (e.fn) {
          case 'count': return e.args.length && arg0.type === 'star' ? 'count(*)' : `count(${e.distinct ? 'distinct ' : ''}${e.args.length ? a(0) : '*'})`;
          case 'sum': case 'avg': case 'min': case 'max': return `${e.fn}(${e.distinct ? 'distinct ' : ''}${a(0)})`;
          case 'collect': return `json_group_array(${e.distinct ? 'distinct ' : ''}${a(0)})`;
          case 'id': { const v = resolveVar(arg0.name); return v.col('id'); }
          case 'labels': { const v = resolveVar(arg0.name); return v.col('etikett'); }
          case 'type': { const v = resolveVar(arg0.name); return v.col('typ'); }
          case 'length': { const v = resolveVar(arg0.name); if (v.kind !== 'walk') throw error('cypher.err.unsupported', { what: 'length()' }); return v.col('depth'); }
          case 'tolower': return `lower(${a(0)})`;
          case 'toupper': return `upper(${a(0)})`;
          case 'tostring': return `cast(${a(0)} as text)`;
          case 'tointeger': return `cast(${a(0)} as integer)`;
          case 'tofloat': return `cast(${a(0)} as real)`;
          case 'size': return arg0.type === 'list' ? String(arg0.items.length) : `length(${a(0)})`;
          case 'coalesce': return `coalesce(${e.args.map((_, i) => a(i)).join(', ')})`;
          case 'exists': return `${a(0)} is not null`;
          case 'round': return `round(${e.args.map((_, i) => a(i)).join(', ')})`;
          case 'abs': return `abs(${a(0)})`;
          case 'trim': return `trim(${a(0)})`;
          case 'keys': { const v = resolveVar(arg0.name); return `(select json_group_array(key) from json_each(${v.alias}.egenskaper))`; }
          case 'properties': { const v = resolveVar(arg0.name); return `${v.alias}.egenskaper`; }
          default: throw error('cypher.err.function', { name: e.fn });
        }
      }
    }

    /**
     * Run a Cypher query on a graph dataset: {columns, rows, sql, params, info}. Rows are arrays; node and edge
     * property JSON stays as text.
     * @param {string} datasetId @param {string} text @param {{params?: any, limit?: number}} [options]
     */
    async function run(datasetId, text, options = {}) {
      const tr = translate(text, options);
      const handle = await datasets.ensureOpen(datasetId);
      if (!graph.isGraph(handle.meta)) throw error('graph.err.notgraph');
      await graph.nodes(datasetId, { limit: 1 }); // makes sure _edges exists
      const res = await handle.engine.exec(tr.sql, tr.params);
      return { columns: res[0] ? res[0].columns : tr.columns, rows: res[0] ? res[0].values : [], sql: tr.sql, params: tr.params, info: tr.info };
    }

    /** Example queries for the editor's placeholder and help, built from the dataset's labels and types. */
    function examples(summary) {
      const label = summary && summary.labels && summary.labels[0] && summary.labels[0].name;
      const type = summary && summary.types && summary.types[0] && summary.types[0].name;
      const L = label ? `:${/^[A-Za-z_]\w*$/.test(label) ? label : '`' + label + '`'}` : '';
      const T = type ? `:${/^[A-Za-z_]\w*$/.test(type) ? type : '`' + type + '`'}` : '';
      return [
        `MATCH (n${L}) RETURN n.namn AS namn, labels(n) AS etikett LIMIT 25`,
        `MATCH (a${L})-[r${T}]->(b) RETURN a.namn, type(r), b.namn LIMIT 50`,
        `MATCH (a)-[r]->(b) RETURN labels(a) AS fran, type(r) AS relation, labels(b) AS till, count(*) AS antal ORDER BY antal DESC`,
        `MATCH (n${L}) OPTIONAL MATCH (n)-[r]->() RETURN n.namn, count(r) AS utgrad ORDER BY utgrad DESC LIMIT 20`,
        `MATCH (a${L})-[*1..3]-(b${L}) WHERE a.namn STARTS WITH 'A' RETURN DISTINCT b.namn LIMIT 50`,
      ];
    }

    return { tokenize, parse, translate, run, examples, MAX_DEPTH, DEFAULT_LIMIT };
  });
})();
