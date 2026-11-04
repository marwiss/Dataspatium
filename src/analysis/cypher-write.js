// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Cypher writing clauses as recipe steps: CREATE (nodes and relationships), MERGE (a node), SET (properties and a
 * label), DELETE and DETACH DELETE (nodes or relationships), REMOVE (properties). A statement is split into its
 * reading part (MATCH … WHERE …), which analysis/cypher resolves to node and edge ids, and its writing part, which
 * becomes operations from data/graph-ops applied through data/recipes, so every change is logged, replayed and
 * undone like any other step. Literal values only in the writing part; the subset stays small and readable.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/cypher-write', ['analysis/cypher', 'data/graph-ops', 'data/recipes', 'data/graph'], (cypher, graphOps, recipes, graph) => {
    const WRITE_RE = /^\s*(create|merge)\b|\b(set|delete|remove|detach\s+delete)\b/i;
    const error = (key, vars) => { const e = new Error(D.t(key, vars || {})); e.cypher = true; return e; };
    /** True when a Cypher text contains writing clauses (outside strings). */
    function isWrite(text) { return WRITE_RE.test(String(text).replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''")); }

    /** Split a statement into the reading clauses (MATCH/WHERE/WITH-free) and the writing clauses, by top-level keywords. */
    function splitClauses(text) {
      const toks = cypher.tokenize(text);
      const parts = []; let cur = null;
      const starters = new Set(['MATCH', 'OPTIONAL', 'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'RETURN', 'WITH', 'UNWIND']);
      let depth = 0;
      for (const tk of toks) {
        if (tk.type === 'eof') break;
        if (tk.type === 'op' && '([{'.includes(tk.value)) depth++;
        if (tk.type === 'op' && ')]}'.includes(tk.value)) depth--;
        if (tk.type === 'kw' && starters.has(tk.value) && depth === 0) {
          if (tk.value === 'OPTIONAL' || tk.value === 'DETACH') { cur = { kind: tk.value === 'OPTIONAL' ? 'MATCH' : 'DELETE', optional: tk.value === 'OPTIONAL', detach: tk.value === 'DETACH', tokens: [tk] }; parts.push(cur); continue; }
          if (cur && ((cur.kind === 'MATCH' && tk.value === 'MATCH' && cur.tokens.length === 1) || (cur.kind === 'DELETE' && tk.value === 'DELETE' && cur.tokens.length === 1))) { cur.tokens.push(tk); continue; }
          cur = { kind: tk.value, tokens: [tk] }; parts.push(cur); continue;
        }
        if (!cur) throw error('cypher.err.unexpected', { what: String(tk.value), pos: tk.pos });
        cur.tokens.push(tk);
      }
      return parts.map((p) => Object.assign(p, { text: text.slice(p.tokens[0].pos, p.tokens.length ? endOf(p.tokens[p.tokens.length - 1], text) : p.tokens[0].pos) }));
    }
    function endOf(tk, text) {
      if (tk.type === 'string') { const open = text[tk.pos]; let j = tk.pos + 1; while (j < text.length && text[j] !== open) { if (text[j] === '\\') j++; j++; } return j + 1; }
      if (tk.type === 'name' && text[tk.pos] === '`') return text.indexOf('`', tk.pos + 1) + 1;
      return tk.pos + String(tk.value).length;
    }
    /** The CREATE/MERGE clause's patterns via the reading parser (as a MATCH), giving nodes and relationships with variables. */
    function patternsOf(clauseText) {
      const ast = cypher.parse('MATCH ' + clauseText.replace(/^\s*(create|merge)\b/i, '') + ' RETURN 1');
      return ast.matches[0].patterns;
    }
    const literal = (e) => {
      if (!e) return null;
      if (e.type === 'literal') return e.value;
      if (e.type === 'neg' && e.expr.type === 'literal') return -e.expr.value;
      if (e.type === 'list') return e.items.map(literal);
      throw error('cypher.err.unsupported', { what: D.t('cypher.expr') });
    };
    const mapOf = (entries) => { const o = {}; for (const en of entries || []) o[en.key] = literal(en.value); return o; };
    const propsLines = (o) => JSON.stringify(o);

    /**
     * Plan the operations of a writing statement: {ops: [{op, params}], reads: {vars → ids}}. The reading part is run
     * to resolve the ids the writing part needs.
     */
    async function plan(datasetId, text) {
      const clauses = splitClauses(text);
      const reading = clauses.filter((c) => c.kind === 'MATCH' || c.kind === 'WHERE');
      const writing = clauses.filter((c) => !['MATCH', 'WHERE', 'RETURN'].includes(c.kind));
      if (clauses.some((c) => c.kind === 'WITH' || c.kind === 'UNWIND')) throw error('cypher.err.unsupported', { what: clauses.find((c) => c.kind === 'WITH' || c.kind === 'UNWIND').kind });
      if (!writing.length) throw error('cypher.err.nowrite');
      // Variables bound by the reading part, with their kind, resolved to id lists (one row per match → arrays kept aligned per row).
      let bindings = null; let rows = [];
      if (reading.length) {
        const readText = reading.map((c) => c.text).join(' ');
        const ast = cypher.parse(readText + ' RETURN 1');
        const vars = [];
        for (const m of ast.matches) for (const p of m.patterns) for (const el of p.elements) if (el.variable && !vars.some((v) => v.name === el.variable)) vars.push({ name: el.variable, kind: el.kind });
        if (!vars.length) throw error('cypher.err.unbound', { name: '?' });
        const out = await cypher.run(datasetId, readText + ' RETURN ' + vars.map((v) => `id(${v.name}) AS ${v.name}`).join(', '), { limit: 100000 });
        bindings = vars; rows = out.rows;
      }
      const ops = [];
      const idsOf = (name) => { const i = bindings ? bindings.findIndex((v) => v.name === name) : -1; if (i < 0) throw error('cypher.err.unbound', { name }); return Array.from(new Set(rows.map((r) => r[i]).filter((v) => v !== null && v !== undefined).map(String))); };
      const kindOf = (name) => { const v = bindings && bindings.find((b) => b.name === name); return v ? v.kind : null; };
      const created = new Map(); // variable → id for nodes created in this statement
      let anon = 0;
      for (const c of writing) {
        if (c.kind === 'CREATE' || c.kind === 'MERGE') {
          const patterns = patternsOf(c.text);
          for (const p of patterns) {
            // Nodes first (left to right), then the relationships between them.
            const nodeIds = [];
            for (const el of p.elements) {
              if (el.kind !== 'node') continue;
              if (el.variable && (created.has(el.variable) || kindOf(el.variable) === 'node') && !el.labels.length && !el.props) { nodeIds.push(created.has(el.variable) ? [created.get(el.variable)] : idsOf(el.variable)); continue; }
              const props = mapOf(el.props);
              const id = props.id !== undefined ? String(props.id) : (props.name !== undefined && c.kind === 'MERGE' ? String(props.name) : 'n' + Date.now().toString(36) + (++anon));
              const existing = c.kind === 'MERGE' ? (await graph.nodes(datasetId, { ids: [id], limit: 1 })) : [];
              if (!existing.length) ops.push({ op: 'graph_add_node', params: { id, etikett: el.labels[0] || '', namn: props.name !== undefined ? String(props.name) : '', egenskaper: propsLines(props) } });
              if (el.variable) created.set(el.variable, id);
              nodeIds.push([id]);
            }
            let k = 0;
            for (let i = 0; i < p.elements.length; i++) {
              const el = p.elements[i]; if (el.kind !== 'rel') continue;
              const a = nodeIds[k]; const b = nodeIds[k + 1]; k++;
              if (!a || !b) throw error('cypher.err.unsupported', { what: 'pattern' });
              const props = mapOf(el.props);
              for (const s of a) for (const d of b) ops.push({ op: 'graph_add_edge', params: { kalla: el.direction === 'in' ? d : s, mal: el.direction === 'in' ? s : d, typ: el.types[0] || '', egenskaper: propsLines(props) } });
            }
          }
        } else if (c.kind === 'SET') {
          // SET n.prop = value, n.other = value, n:Label (literal values only), per variable.
          const body = c.text.replace(/^\s*set\b/i, '');
          const items = splitTop(body);
          const perVar = new Map();
          for (const it of items) {
            let m = /^\s*([A-Za-z_]\w*)\s*:\s*`?([^`\s]+)`?\s*$/.exec(it);
            if (m) { entry(perVar, m[1]).label = m[2]; continue; }
            m = /^\s*([A-Za-z_]\w*)\s*\.\s*(`[^`]*`|[A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(it);
            if (!m) throw error('cypher.err.unsupported', { what: it.trim() });
            const key = m[2].replace(/`/g, ''); const value = literal(cypher.parse('MATCH (x) RETURN ' + m[3]).returns[0].expr);
            entry(perVar, m[1]).set[key] = value;
          }
          for (const [name, e] of perVar) {
            const kind = created.has(name) ? 'node' : kindOf(name);
            const ids = created.has(name) ? [created.get(name)] : idsOf(name);
            if (!ids.length) continue;
            if (kind === 'rel') ops.push({ op: 'graph_set_edge', params: { ids, typ: e.label || '', egenskaper: propsLines(e.set) } });
            else ops.push({ op: 'graph_set_node', params: { ids, etikett: e.label || '', namn: e.set.name !== undefined ? String(e.set.name) : '', egenskaper: propsLines(e.set) } });
          }
        } else if (c.kind === 'REMOVE') {
          const items = splitTop(c.text.replace(/^\s*remove\b/i, ''));
          const perVar = new Map();
          for (const it of items) { const m = /^\s*([A-Za-z_]\w*)\s*\.\s*(`[^`]*`|[A-Za-z_]\w*)\s*$/.exec(it); if (!m) throw error('cypher.err.unsupported', { what: it.trim() }); entry(perVar, m[1]).remove.push(m[2].replace(/`/g, '')); }
          for (const [name, e] of perVar) { const ids = idsOf(name); if (!ids.length) continue; ops.push({ op: kindOf(name) === 'rel' ? 'graph_set_edge' : 'graph_set_node', params: { ids, egenskaper: '{}', remove: e.remove.join('\n') } }); }
        } else if (c.kind === 'DELETE') {
          const names = splitTop(c.text.replace(/^\s*(detach\s+)?delete\b/i, '')).map((s) => s.trim()).filter(Boolean);
          for (const name of names) {
            if (!/^[A-Za-z_]\w*$/.test(name)) throw error('cypher.err.unsupported', { what: name });
            const ids = idsOf(name); if (!ids.length) continue;
            if (kindOf(name) === 'rel') ops.push({ op: 'graph_delete_edges', params: { ids } });
            else ops.push({ op: 'graph_delete_nodes', params: { ids, detach: !!c.detach } });
          }
        } else throw error('cypher.err.unsupported', { what: c.kind });
      }
      return { ops, matched: rows.length, bindings: bindings ? bindings.map((b) => b.name) : [] };
    }
    function entry(map, name) { if (!map.has(name)) map.set(name, { set: {}, remove: [], label: '' }); return map.get(name); }
    /** Split on commas outside brackets, braces and strings. */
    function splitTop(text) {
      const out = []; let cur = ''; let depth = 0; let quote = null;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) { cur += ch; if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
        if ('([{'.includes(ch)) depth++; if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
        cur += ch;
      }
      if (cur.trim()) out.push(cur);
      return out;
    }
    /**
     * Execute a writing statement: every operation becomes a recipe step on the dataset. Returns the summary
     * {steps, nodes, edges, matched}.
     */
    async function execute(datasetId, text) {
      const p = await plan(datasetId, text);
      let nodes = 0; let edges = 0;
      for (const step of p.ops) {
        const r = await recipes.apply(datasetId, step.op, step.params, { description: D.t('graph.op.cypher', { text: String(text).trim().slice(0, 80) }) });
        if (/edge/.test(step.op)) edges += r.rows || 0; else nodes += r.rows || 0;
      }
      return { steps: p.ops.length, nodes, edges, matched: p.matched, ops: p.ops };
    }

    return { isWrite, splitClauses, plan, execute, OPS: graphOps.OPS };
  });
})();
