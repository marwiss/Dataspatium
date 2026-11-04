// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph datasets (kind "graph"): nodes in the dataset's `data` table (id, etikett = label, namn = display name,
 * egenskaper = properties as JSON text), edges in `_edges` (id, kalla = source, mal = target, typ = relationship
 * type, egenskaper), cached node positions in `_layout`, and the graph's facts in `_meta.graph` (directed, counts,
 * labels and types with counts). Pure logic for the exchange formats (GraphML, GEXF, node-link JSON, the Cypher
 * scripts that APOC exports) in both directions, access to nodes, edges, neighbourhoods and subgraphs through
 * SQL on the dataset, and building a graph from two tables. Heavy measures live in analysis/graph (worker).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/graph', ['data/datasets', 'data/types'], (datasets, types) => {
    /** Columns of the node table. */
    const NODE_COLUMNS = [{ name: 'id', type: 'text' }, { name: 'etikett', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'egenskaper', type: 'text' }];
    /** Columns of the edge table. */
    const EDGE_COLUMNS = ['id', 'kalla', 'mal', 'typ', 'egenskaper'];
    const MAX_VIEW = 5000;
    const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const props = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) if (v !== null && v !== undefined && v !== '') out[k] = v; return out; };
    const propsText = (o) => { const p = props(o); return Object.keys(p).length ? JSON.stringify(p) : null; };
    const parseProps = (text) => { if (!text) return {}; if (typeof text === 'object') return text; try { const o = JSON.parse(text); return o && typeof o === 'object' ? o : {}; } catch (_e) { return {}; } };
    const NAME_KEYS = ['name', 'namn', 'label', 'title', 'titel', 'rubrik', 'id'];
    /** A display name for a node from its properties. */
    function displayName(id, properties, label) {
      for (const k of NAME_KEYS) { const v = properties && properties[k]; if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') return String(v); }
      return label ? `${label} ${id}` : String(id);
    }

    // ---- model helpers -----------------------------------------------------------------------------------------
    /**
     * Normalise a parsed graph: nodes {id, label, name?, properties}, edges {id?, source, target, type, properties};
     * dangling edges are dropped, missing ids made, duplicates kept once.
     */
    function normalise(graph) {
      const nodes = new Map();
      for (const n of graph.nodes || []) {
        const id = str(n.id); if (!id) continue;
        const properties = props(n.properties);
        if (!nodes.has(id)) nodes.set(id, { id, label: str(n.label || n.labels && n.labels[0] || ''), name: str(n.name) || displayName(id, properties, str(n.label || '')), properties });
      }
      const edges = []; let k = 0; const seen = new Set();
      for (const e of graph.edges || []) {
        const source = str(e.source); const target = str(e.target);
        if (!nodes.has(source) || !nodes.has(target)) continue;
        const id = str(e.id) || `e${++k}`;
        if (seen.has(id)) continue; seen.add(id);
        edges.push({ id, source, target, type: str(e.type || e.label || ''), properties: props(e.properties) });
      }
      return { nodes: Array.from(nodes.values()), edges, directed: graph.directed !== false };
    }
    /** Counts per label and per type. */
    function summarise(graph) {
      const labels = new Map(); const typs = new Map();
      for (const n of graph.nodes) labels.set(n.label || '', (labels.get(n.label || '') || 0) + 1);
      for (const e of graph.edges) typs.set(e.type || '', (typs.get(e.type || '') || 0) + 1);
      const sort = (m) => Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return { directed: graph.directed !== false, nodes: graph.nodes.length, edges: graph.edges.length, labels: sort(labels), types: sort(typs) };
    }

    // ---- parsers ------------------------------------------------------------------------------------------------
    const parseXml = (text) => { const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('graph.err.xml')); return doc; };
    const children = (el, name) => Array.from(el.children).filter((c) => c.localName === name);
    const num = (v) => { if (v === null || v === undefined || v === '') return v; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && /^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/.test(String(v)) ? n : v; };
    /** GraphML → graph. Keys name the attributes; the `labels`/`label` attribute (or a node's `labels` key) gives the label. */
    function parseGraphML(text) {
      const doc = parseXml(text);
      const root = doc.documentElement;
      const keys = new Map();
      for (const k of children(root, 'key')) keys.set(k.getAttribute('id'), { name: k.getAttribute('attr.name') || k.getAttribute('id'), type: k.getAttribute('attr.type') || 'string', for: k.getAttribute('for') || 'all' });
      const data = (el) => { const out = {}; for (const d of children(el, 'data')) { const key = keys.get(d.getAttribute('key')) || { name: d.getAttribute('key'), type: 'string' }; const v = (d.textContent || '').trim(); out[key.name] = ['int', 'long', 'float', 'double'].includes(key.type) ? num(v) : key.type === 'boolean' ? v === 'true' : v; } return out; };
      const g = children(root, 'graph')[0];
      if (!g) throw new Error(D.t('graph.err.format'));
      const directed = (g.getAttribute('edgedefault') || 'directed') !== 'undirected';
      const nodes = []; const edges = [];
      const walk = (graphEl) => {
        for (const n of children(graphEl, 'node')) {
          const p = data(n); const id = n.getAttribute('id');
          const label = str(p.labels || p.label || p.etikett || '').replace(/^:/, '').split(':')[0];
          delete p.labels; if (p.label !== undefined && String(p.label) === label) delete p.label;
          nodes.push({ id, label, properties: p });
          for (const sub of children(n, 'graph')) walk(sub);
        }
        for (const e of children(graphEl, 'edge')) { const p = data(e); const type = str(p.label || p.type || p.typ || ''); delete p.label; if (p.type !== undefined && String(p.type) === type) delete p.type; edges.push({ id: e.getAttribute('id') || undefined, source: e.getAttribute('source'), target: e.getAttribute('target'), type, properties: p }); }
      };
      walk(g);
      return normalise({ nodes, edges, directed });
    }
    /** GEXF 1.2/1.3 → graph. */
    function parseGEXF(text) {
      const doc = parseXml(text);
      const g = doc.getElementsByTagName('graph')[0];
      if (!g) throw new Error(D.t('graph.err.format'));
      const directed = (g.getAttribute('defaultedgetype') || 'directed') !== 'undirected';
      const attrs = { node: new Map(), edge: new Map() };
      for (const a of Array.from(g.getElementsByTagName('attributes'))) { const cls = a.getAttribute('class') === 'edge' ? 'edge' : 'node'; for (const at of Array.from(a.getElementsByTagName('attribute'))) attrs[cls].set(at.getAttribute('id'), { name: at.getAttribute('title') || at.getAttribute('id'), type: at.getAttribute('type') || 'string' }); }
      const values = (el, cls) => { const out = {}; for (const v of Array.from(el.getElementsByTagName('attvalue'))) { const a = attrs[cls].get(v.getAttribute('for')) || { name: v.getAttribute('for'), type: 'string' }; const raw = v.getAttribute('value'); out[a.name] = ['integer', 'long', 'float', 'double'].includes(a.type) ? num(raw) : a.type === 'boolean' ? raw === 'true' : raw; } return out; };
      const nodes = Array.from(g.getElementsByTagName('node')).map((n) => { const p = values(n, 'node'); const label = str(p.labels || p.etikett || p.type || p.kind || ''); delete p.labels; return { id: n.getAttribute('id'), label, name: n.getAttribute('label') || '', properties: p }; });
      const edges = Array.from(g.getElementsByTagName('edge')).map((e) => { const p = values(e, 'edge'); if (e.getAttribute('weight')) p.weight = num(e.getAttribute('weight')); return { id: e.getAttribute('id') || undefined, source: e.getAttribute('source'), target: e.getAttribute('target'), type: e.getAttribute('label') || str(p.type || p.typ || ''), properties: p }; });
      return normalise({ nodes, edges, directed });
    }
    /** Node-link JSON ({nodes, edges|links}, D3/networkx/Cytoscape style; also Cytoscape's {elements: {nodes, edges}}) → graph. */
    function parseNodeLink(data) {
      const j = typeof data === 'string' ? JSON.parse(data) : data;
      const el = j && j.elements ? j.elements : j;
      let rawNodes = Array.isArray(el.nodes) ? el.nodes : null;
      let rawEdges = Array.isArray(el.edges) ? el.edges : Array.isArray(el.links) ? el.links : Array.isArray(el.relationships) ? el.relationships : null;
      if (!rawNodes) throw new Error(D.t('graph.err.format'));
      const un = (n) => { const d = n.data && typeof n.data === 'object' ? n.data : n; const p = Object.assign({}, d.properties && typeof d.properties === 'object' ? d.properties : d); for (const k of ['id', 'labels', 'label', 'properties', 'x', 'y', 'position', 'group', 'type']) if (!(d.properties && typeof d.properties === 'object')) delete p[k]; const label = Array.isArray(d.labels) ? d.labels[0] : str(d.label !== undefined && !d.properties ? d.label : (d.type || d.group || (Array.isArray(d.labels) ? d.labels[0] : ''))); return { id: d.id !== undefined ? d.id : n.id, label: str(label), name: d.properties ? '' : str(d.name || ''), properties: p }; };
      const ue = (e) => { const d = e.data && typeof e.data === 'object' ? e.data : e; const p = Object.assign({}, d.properties && typeof d.properties === 'object' ? d.properties : d); if (!(d.properties && typeof d.properties === 'object')) for (const k of ['id', 'source', 'target', 'type', 'label', 'startNode', 'endNode', 'properties']) delete p[k]; const src = d.source !== undefined ? (typeof d.source === 'object' ? d.source.id : d.source) : d.startNode; const tgt = d.target !== undefined ? (typeof d.target === 'object' ? d.target.id : d.target) : d.endNode; return { id: d.id, source: src, target: tgt, type: str(d.type || d.label || d.relationship || ''), properties: p }; };
      return normalise({ nodes: rawNodes.map(un), edges: (rawEdges || []).map(ue), directed: j.directed !== false && j.directed !== 'false' });
    }
    /**
     * Cypher scripts as APOC exports them (`CREATE (:Label {prop: value, `UNIQUE IMPORT ID`: 1});` and
     * `MATCH (n1:... {`UNIQUE IMPORT ID`: 1}), (n2:...) CREATE (n1)-[:TYPE {prop: value}]->(n2);`), also plain
     * `CREATE (a:Person {name: "A"}), (b:Person {name: "B"}), (a)-[:KNOWS]->(b)` scripts.
     */
    function parseCypherScript(text) {
      const nodes = new Map(); const edges = []; const vars = new Map();
      const statements = splitStatements(text);
      // Property maps hold no nested braces in APOC exports; list values ([…]) stay inside the map.
      const nodeRe = /\(\s*([A-Za-z_][\w]*)?\s*((?::(?:`[^`]*`|[^`:{)\s]+))*)\s*(\{[^{}]*\})?\s*\)/g;
      let anon = 0;
      for (const st of statements) {
        const s = st.trim(); if (!s) continue;
        // Constraint statements, transaction markers and the clean-up at the end of an APOC export carry no data.
        if (/^(create|drop)\s+constraint\b/i.test(s) || /^:(begin|commit)/i.test(s) || /\bremove\s+n:/i.test(s)) continue;
        const isMatch = /^match\b/i.test(s);
        // Node patterns.
        const localVars = new Map();
        const scan = s;
        let m;
        while ((m = nodeRe.exec(scan)) !== null) {
          const v = m[1] || ''; const labels = ((m[2] || '').match(/:(?:`[^`]*`|[^`:]+)/g) || []).map((x) => x.slice(1).replace(/`/g, '').trim()).filter(Boolean); const p = m[3] ? parseMap(m[3]) : {};
          const importId = p['UNIQUE IMPORT ID'];
          const realLabels = labels.filter((l) => l !== 'UNIQUE IMPORT LABEL');
          if (isMatch) {
            const key = importId !== undefined ? 'uid:' + importId : (p.id !== undefined ? 'id:' + p.id : null);
            if (v && key && vars.has(key)) localVars.set(v, vars.get(key));
            else if (v && key) localVars.set(v, key.replace(/^uid:|^id:/, ''));
            continue;
          }
          if (!labels.length && !m[3] && v && localVars.has(v)) continue; // a reference like (a)
          if (!labels.length && !m[3] && v && !localVars.has(v)) continue;
          const id = importId !== undefined ? String(importId) : (p.id !== undefined ? String(p.id) : (p.name !== undefined ? String(p.name) : 'n' + (++anon)));
          delete p['UNIQUE IMPORT ID'];
          if (!nodes.has(id)) nodes.set(id, { id, label: realLabels[0] || '', labels: realLabels, properties: p });
          if (v) { localVars.set(v, id); vars.set('uid:' + id, id); vars.set('id:' + id, id); }
        }
        // Relationship patterns (a)-[:TYPE {..}]->(b) or (a)<-[...]-(b).
        const relRe = /\(\s*([A-Za-z_]\w*)\s*(?::[^)]*)?\)\s*(<-|-)\s*\[\s*(?:[A-Za-z_]\w*)?\s*(?::(?:`([^`]*)`|([^`\]{\s]+)))?\s*(\{[\s\S]*?\})?\s*\]\s*(->|-)\s*\(\s*([A-Za-z_]\w*)\s*(?::[^)]*)?\)/g;
        while ((m = relRe.exec(s)) !== null) {
          const a = localVars.get(m[1]); const b = localVars.get(m[7]);
          if (!a || !b) continue;
          const back = m[2] === '<-';
          edges.push({ source: back ? b : a, target: back ? a : b, type: (m[3] || m[4] || '').trim(), properties: m[5] ? parseMap(m[5]) : {} });
        }
      }
      return normalise({ nodes: Array.from(nodes.values()), edges, directed: true });
    }
    function splitStatements(text) {
      const out = []; let cur = ''; let quote = null;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) { cur += ch; if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
        if (ch === ';') { out.push(cur); cur = ''; continue; }
        if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
        cur += ch;
      }
      if (cur.trim()) out.push(cur);
      return out;
    }
    /** A Cypher map literal `{key: value, `quoted key`: "text"}` → object (strings, numbers, booleans, null, lists). */
    function parseMap(text) {
      const out = {};
      let i = 1; const s = text.trim();
      const skip = () => { while (i < s.length && /\s|,/.test(s[i])) i++; };
      const readKey = () => { skip(); if (s[i] === '`') { const j = s.indexOf('`', i + 1); const k = s.slice(i + 1, j); i = j + 1; return k; } const m = /^[A-Za-z_]\w*/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return m[0]; };
      const readValue = () => {
        skip();
        const ch = s[i];
        if (ch === '"' || ch === "'") { let j = i + 1; let v = ''; while (j < s.length && s[j] !== ch) { if (s[j] === '\\' && j + 1 < s.length) { const n = s[j + 1]; v += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; } v += s[j++]; } i = j + 1; return v; }
        if (ch === '[') { const arr = []; i++; for (;;) { skip(); if (s[i] === ']') { i++; break; } arr.push(readValue()); skip(); if (s[i] === ',') i++; } return arr; }
        if (ch === '{') { const start = i; let depth = 0; for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) { i++; break; } } } return parseMap(s.slice(start, i)); }
        const m = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|datetime\([^)]*\)|date\([^)]*\)|[A-Za-z_][\w.]*)/.exec(s.slice(i));
        if (!m) { i++; return null; }
        i += m[0].length;
        const v = m[0];
        if (v === 'true') return true; if (v === 'false') return false; if (v === 'null') return null;
        if (/^-?\d/.test(v)) return Number(v);
        const dm = /^(?:date|datetime)\(\s*["']([^"']*)["']\s*\)$/.exec(v); if (dm) return dm[1];
        return v;
      };
      while (i < s.length - 1) {
        const key = readKey(); if (key === null) break;
        skip(); if (s[i] === ':') i++;
        out[key] = readValue();
        skip();
      }
      return out;
    }

    // ---- writers ------------------------------------------------------------------------------------------------
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function attrKeys(items) { const keys = new Map(); for (const it of items) for (const [k, v] of Object.entries(it.properties || {})) { const t = typeof v === 'number' ? (Number.isInteger(v) ? 'long' : 'double') : typeof v === 'boolean' ? 'boolean' : 'string'; const prev = keys.get(k); keys.set(k, prev && prev !== t ? 'string' : t); } return keys; }
    const valueText = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    /** Graph → GraphML (labels as the `labels` attribute like Neo4j's exporter, types as the edge `label`). */
    function toGraphML(graph) {
      const nk = attrKeys(graph.nodes); const ek = attrKeys(graph.edges);
      const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">'];
      lines.push('<key id="labels" for="node" attr.name="labels" attr.type="string"/>', '<key id="name" for="node" attr.name="name" attr.type="string"/>', '<key id="label" for="edge" attr.name="label" attr.type="string"/>');
      for (const [k, t] of nk) if (k !== 'name') lines.push(`<key id="n_${esc(k)}" for="node" attr.name="${esc(k)}" attr.type="${t}"/>`);
      for (const [k, t] of ek) lines.push(`<key id="e_${esc(k)}" for="edge" attr.name="${esc(k)}" attr.type="${t}"/>`);
      lines.push(`<graph id="G" edgedefault="${graph.directed === false ? 'undirected' : 'directed'}">`);
      for (const n of graph.nodes) {
        const parts = [`<data key="labels">:${esc(n.label || '')}</data>`, `<data key="name">${esc(n.name || '')}</data>`];
        for (const [k, v] of Object.entries(n.properties || {})) if (k !== 'name') parts.push(`<data key="n_${esc(k)}">${esc(valueText(v))}</data>`);
        lines.push(`<node id="${esc(n.id)}">${parts.join('')}</node>`);
      }
      for (const e of graph.edges) {
        const parts = [`<data key="label">${esc(e.type || '')}</data>`];
        for (const [k, v] of Object.entries(e.properties || {})) parts.push(`<data key="e_${esc(k)}">${esc(valueText(v))}</data>`);
        lines.push(`<edge id="${esc(e.id)}" source="${esc(e.source)}" target="${esc(e.target)}">${parts.join('')}</edge>`);
      }
      lines.push('</graph>', '</graphml>');
      return lines.join('\n');
    }
    /** Graph → GEXF 1.3. */
    function toGEXF(graph) {
      const nk = attrKeys(graph.nodes); const ek = attrKeys(graph.edges);
      const typeOf = (t) => (t === 'long' ? 'long' : t === 'double' ? 'double' : t === 'boolean' ? 'boolean' : 'string');
      const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gexf xmlns="http://gexf.net/1.3" version="1.3">', `<graph defaultedgetype="${graph.directed === false ? 'undirected' : 'directed'}">`];
      lines.push('<attributes class="node"><attribute id="labels" title="labels" type="string"/>' + Array.from(nk).map(([k, t], i) => `<attribute id="n${i}" title="${esc(k)}" type="${typeOf(t)}"/>`).join('') + '</attributes>');
      lines.push('<attributes class="edge">' + Array.from(ek).map(([k, t], i) => `<attribute id="e${i}" title="${esc(k)}" type="${typeOf(t)}"/>`).join('') + '</attributes>');
      const nIdx = Array.from(nk.keys()); const eIdx = Array.from(ek.keys());
      lines.push('<nodes>');
      for (const n of graph.nodes) lines.push(`<node id="${esc(n.id)}" label="${esc(n.name || n.id)}"><attvalues><attvalue for="labels" value="${esc(n.label || '')}"/>${Object.entries(n.properties || {}).map(([k, v]) => `<attvalue for="n${nIdx.indexOf(k)}" value="${esc(valueText(v))}"/>`).join('')}</attvalues></node>`);
      lines.push('</nodes>', '<edges>');
      for (const e of graph.edges) lines.push(`<edge id="${esc(e.id)}" source="${esc(e.source)}" target="${esc(e.target)}" label="${esc(e.type || '')}"${typeof (e.properties || {}).weight === 'number' ? ` weight="${e.properties.weight}"` : ''}><attvalues>${Object.entries(e.properties || {}).map(([k, v]) => `<attvalue for="e${eIdx.indexOf(k)}" value="${esc(valueText(v))}"/>`).join('')}</attvalues></edge>`);
      lines.push('</edges>', '</graph>', '</gexf>');
      return lines.join('\n');
    }
    /** Graph → node-link JSON ({directed, nodes: [{id, labels, name, properties}], edges: [{id, source, target, type, properties}]}). */
    function toNodeLink(graph) {
      return JSON.stringify({ directed: graph.directed !== false, nodes: graph.nodes.map((n) => ({ id: n.id, labels: n.label ? [n.label] : [], name: n.name, properties: n.properties || {} })), edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, properties: e.properties || {} })) }, null, 1);
    }
    const cypherValue = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : Array.isArray(v) ? '[' + v.map(cypherValue).join(', ') + ']' : JSON.stringify(String(typeof v === 'object' ? JSON.stringify(v) : v)));
    const cypherKey = (k) => (/^[A-Za-z_]\w*$/.test(k) ? k : '`' + k.replace(/`/g, '``') + '`');
    const cypherMap = (o) => { const parts = Object.entries(o || {}).map(([k, v]) => `${cypherKey(k)}: ${cypherValue(v)}`); return parts.length ? ` {${parts.join(', ')}}` : ''; };
    /** Graph → Cypher script in APOC's style (`UNIQUE IMPORT ID` keeps the node ids; the last statements remove the helper label). */
    function toCypher(graph) {
      const lines = ['CREATE CONSTRAINT UNIQUE_IMPORT_NAME IF NOT EXISTS FOR (node:`UNIQUE IMPORT LABEL`) REQUIRE (node.`UNIQUE IMPORT ID`) IS UNIQUE;'];
      for (const n of graph.nodes) lines.push(`CREATE (:${n.label ? cypherKey(n.label) + ':' : ''}\`UNIQUE IMPORT LABEL\`${cypherMap(Object.assign({}, n.properties, n.name && !(n.properties || {}).name ? { name: n.name } : {}, { 'UNIQUE IMPORT ID': n.id }))});`);
      for (const e of graph.edges) lines.push(`MATCH (n1:\`UNIQUE IMPORT LABEL\` {\`UNIQUE IMPORT ID\`: ${cypherValue(e.source)}}), (n2:\`UNIQUE IMPORT LABEL\` {\`UNIQUE IMPORT ID\`: ${cypherValue(e.target)}}) CREATE (n1)-[:${cypherKey(e.type || 'RELATED')}${cypherMap(e.properties)}]->(n2);`);
      lines.push('MATCH (n:`UNIQUE IMPORT LABEL`) WITH n LIMIT 20000 REMOVE n:`UNIQUE IMPORT LABEL` REMOVE n.`UNIQUE IMPORT ID`;', 'DROP CONSTRAINT UNIQUE_IMPORT_NAME IF EXISTS;');
      return lines.join('\n');
    }

    // ---- datasets -----------------------------------------------------------------------------------------------
    /**
     * Create a graph dataset from a normalised graph.
     * @param {{name: string, graph: any, source?: any, description?: string, layout?: Array<[string, number, number]>, meta?: any}} input
     */
    async function createGraphDataset(input) {
      const graph = normalise(input.graph);
      const handle = await datasets.createEmpty({ name: input.name, columns: NODE_COLUMNS, kind: 'graph', source: input.source || null, description: input.description || '' });
      try {
        const rows = graph.nodes.map((n) => [n.id, n.label || null, n.name || null, propsText(n.properties)]);
        for (let i = 0; i < rows.length; i += 5000) await datasets.appendImportRows(handle, rows.slice(i, i + 5000));
        await ensureTables(handle.engine);
        const erows = graph.edges.map((e) => [e.id, e.source, e.target, e.type || null, propsText(e.properties)]);
        for (let i = 0; i < erows.length; i += 5000) await handle.engine.insertRows('_edges', EDGE_COLUMNS, erows.slice(i, i + 5000));
        if (input.layout && input.layout.length) await handle.engine.insertRows('_layout', ['id', 'x', 'y'], input.layout);
        if (input.files && input.files.length) await D.require('data/dataset-files').put(handle, input.files);
        const info = Object.assign(summarise(graph), input.meta || {});
        handle.meta.graph = info;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['graph', JSON.stringify(info)]);
        return await datasets.finishImport(handle, {});
      } catch (err) { datasets.abortImport(handle); throw err; }
    }
    async function ensureTables(engine) {
      await engine.run('create table if not exists _edges (id text primary key, kalla text, mal text, typ text, egenskaper text)');
      await engine.run('create index if not exists _edges_kalla on _edges (kalla)');
      await engine.run('create index if not exists _edges_mal on _edges (mal)');
      await engine.run('create table if not exists _layout (id text primary key, x real, y real)');
    }
    const isGraph = (meta) => !!meta && meta.kind === 'graph';
    /** The dataset's engine (open handle) after checking it is a graph. */
    async function handleOf(id) {
      const handle = await datasets.ensureOpen(id);
      if (!isGraph(handle.meta)) throw new Error(D.t('graph.err.notgraph'));
      await ensureTables(handle.engine);
      return handle;
    }
    const nodeOf = (r) => ({ id: str(r[0]), label: str(r[1]), name: str(r[2]), properties: parseProps(r[3]) });
    const edgeOf = (r) => ({ id: str(r[0]), source: str(r[1]), target: str(r[2]), type: str(r[3]), properties: parseProps(r[4]) });
    /** Nodes of a graph dataset: all, by ids, by label or matching a text (name or properties), at most `limit`. */
    async function nodes(id, options = {}) {
      const h = await handleOf(id);
      const where = []; const params = [];
      if (options.ids && options.ids.length) { where.push(`id in (${options.ids.map(() => '?').join(',')})`); params.push(...options.ids.map(String)); }
      if (options.label) { where.push('etikett = ?'); params.push(options.label); }
      if (options.search) { where.push('(namn like ? or id like ? or egenskaper like ?)'); const s = '%' + options.search + '%'; params.push(s, s, s); }
      const sql = `select id, etikett, namn, egenskaper from data${where.length ? ' where ' + where.join(' and ') : ''} order by rowid${options.limit ? ' limit ' + Number(options.limit) : ''}`;
      const res = await h.engine.exec(sql, params);
      return (res[0] ? res[0].values : []).map(nodeOf);
    }
    /** Edges of a graph dataset: all, by type, or those touching the given node ids (both ends inside when `inside`). */
    async function edges(id, options = {}) {
      const h = await handleOf(id);
      const where = []; const params = [];
      if (options.type) { where.push('typ = ?'); params.push(options.type); }
      if (options.ids && options.ids.length) {
        const ph = options.ids.map(() => '?').join(',');
        where.push(options.inside ? `(kalla in (${ph}) and mal in (${ph}))` : `(kalla in (${ph}) or mal in (${ph}))`);
        params.push(...options.ids.map(String), ...options.ids.map(String));
      }
      const sql = `select id, kalla, mal, typ, egenskaper from _edges${where.length ? ' where ' + where.join(' and ') : ''} order by rowid${options.limit ? ' limit ' + Number(options.limit) : ''}`;
      const res = await h.engine.exec(sql, params);
      return (res[0] ? res[0].values : []).map(edgeOf);
    }
    /** Node ids within `depth` steps of the given ids (both directions), the start ids included. */
    async function neighborhood(id, ids, depth = 1, limit = MAX_VIEW) {
      const h = await handleOf(id);
      const seen = new Set(ids.map(String)); let frontier = Array.from(seen);
      for (let d = 0; d < depth && frontier.length && seen.size < limit; d++) {
        const next = new Set();
        for (let i = 0; i < frontier.length; i += 500) {
          const chunk = frontier.slice(i, i + 500); const ph = chunk.map(() => '?').join(',');
          const res = await h.engine.exec(`select kalla, mal from _edges where kalla in (${ph}) or mal in (${ph})`, chunk.concat(chunk));
          for (const r of (res[0] ? res[0].values : [])) { for (const v of [str(r[0]), str(r[1])]) if (!seen.has(v)) next.add(v); }
          if (seen.size + next.size >= limit) break;
        }
        frontier = Array.from(next).slice(0, Math.max(0, limit - seen.size));
        for (const v of frontier) seen.add(v);
      }
      return Array.from(seen);
    }
    /** A subgraph (nodes and the edges among them) for a set of node ids. */
    async function subgraph(id, ids) {
      const list = Array.from(new Set(ids.map(String)));
      const out = { nodes: [], edges: [] };
      for (let i = 0; i < list.length; i += 500) out.nodes.push(...await nodes(id, { ids: list.slice(i, i + 500) }));
      const set = new Set(list);
      // Edges with both ends in the set: read those touching the set, filter in memory (ids may be many).
      for (let i = 0; i < list.length; i += 500) for (const e of await edges(id, { ids: list.slice(i, i + 500) })) if (set.has(e.source) && set.has(e.target) && !out.edges.some((x) => x.id === e.id)) out.edges.push(e);
      return out;
    }
    /** The whole graph as {nodes, edges} (for exports, measures and the whole-graph drawing). */
    async function whole(id) {
      const meta = await datasets.get(id);
      return { directed: !(meta && meta.graph && meta.graph.directed === false), nodes: await nodes(id), edges: await edges(id) };
    }
    /** Cached layout positions: Map id → [x, y]. */
    async function layoutGet(id) {
      const h = await handleOf(id);
      const res = await h.engine.exec('select id, x, y from _layout');
      return new Map((res[0] ? res[0].values : []).map((r) => [str(r[0]), [Number(r[1]), Number(r[2])]]));
    }
    /** Store layout positions ([id, x, y]…) without touching the dataset's rows (saved through the dataset's save path). */
    async function layoutSet(id, positions) {
      const h = await handleOf(id);
      if (!positions.length) return;
      await h.engine.run('delete from _layout where id in (' + positions.map(() => '?').join(',') + ')', positions.map((p) => String(p[0])));
      await h.engine.insertRows('_layout', ['id', 'x', 'y'], positions.map((p) => [String(p[0]), p[1], p[2]]));
      datasets.scheduleSave(id);
    }
    /** Facts of a graph dataset (from _meta, recomputed when missing). */
    async function summary(id) {
      const meta = await datasets.get(id);
      if (meta && meta.graph && meta.graph.labels) return meta.graph;
      const g = await whole(id);
      const info = summarise(g);
      await datasets.updateMeta(id, { graph: info });
      return info;
    }
    /**
     * A graph from two tables: nodes (id column, optional label and name columns) and edges (source and target
     * columns, optional type column); the other columns become properties. Node ids missing in the node table are
     * created from the edges when `options.createMissing`.
     */
    async function fromTables(options) {
      const nodeCols = options.nodesId ? await datasets.columns(options.nodesId) : [];
      const nodeRows = options.nodesId ? await datasets.allRows(options.nodesId) : [];
      const edgeCols = await datasets.columns(options.edgesId);
      const edgeRows = await datasets.allRows(options.edgesId);
      const idx = (cols, name) => cols.findIndex((c) => c.name === name);
      const ni = idx(nodeCols, options.nodeId); const nl = options.nodeLabel ? idx(nodeCols, options.nodeLabel) : -1; const nn = options.nodeName ? idx(nodeCols, options.nodeName) : -1;
      const es = idx(edgeCols, options.edgeSource); const et = idx(edgeCols, options.edgeTarget); const ety = options.edgeType ? idx(edgeCols, options.edgeType) : -1;
      if (es < 0 || et < 0) throw new Error(D.t('graph.err.columns'));
      const nodes = []; const have = new Set();
      for (const r of nodeRows) {
        if (ni < 0) break;
        const id = str(r[ni]); if (!id) continue;
        const p = {}; nodeCols.forEach((c, i) => { if (i !== ni && i !== nl && i !== nn && r[i] !== null && r[i] !== undefined && r[i] !== '') p[c.name] = r[i]; });
        nodes.push({ id, label: nl >= 0 ? str(r[nl]) : (options.defaultLabel || ''), name: nn >= 0 ? str(r[nn]) : '', properties: p }); have.add(id);
      }
      const edges = [];
      for (const r of edgeRows) {
        const s = str(r[es]); const t = str(r[et]); if (!s || !t) continue;
        for (const v of [s, t]) if (!have.has(v) && (options.createMissing !== false)) { nodes.push({ id: v, label: options.defaultLabel || '', name: v, properties: {} }); have.add(v); }
        const p = {}; edgeCols.forEach((c, i) => { if (i !== es && i !== et && i !== ety && r[i] !== null && r[i] !== undefined && r[i] !== '') p[c.name] = r[i]; });
        edges.push({ source: s, target: t, type: ety >= 0 ? str(r[ety]) : (options.defaultType || ''), properties: p });
      }
      return normalise({ nodes, edges, directed: options.directed !== false });
    }
    /** Edges (or nodes) of a graph as a plain table {columns, rows} with properties flattened into columns. */
    function toTable(items, kind) {
      const keys = new Map();
      for (const it of items) for (const k of Object.keys(it.properties || {})) keys.set(k, true);
      const extra = Array.from(keys.keys());
      const base = kind === 'edges' ? ['id', 'kalla', 'mal', 'typ'] : ['id', 'etikett', 'namn'];
      const columns = base.concat(extra.map((k) => (base.includes(k) ? 'egenskap_' + k : k)));
      const rows = items.map((it) => (kind === 'edges' ? [it.id, it.source, it.target, it.type] : [it.id, it.label, it.name]).concat(extra.map((k) => { const v = (it.properties || {})[k]; return v === undefined ? null : (typeof v === 'object' ? JSON.stringify(v) : v); })));
      return { columns, rows };
    }
    /** Columns with inferred types for a {columns, rows} table. */
    function typedColumns(table) { return types.inferColumns(table.columns, table.rows.slice(0, 2000), {}).map((c, i) => ({ name: table.columns[i], type: c.type })); }

    /** Detect the format of a text/JSON file: 'graphml', 'gexf', 'cypher', 'nodelink' or null. */
    function detectText(head) {
      const h = String(head || '');
      if (/<graphml[\s>]/i.test(h)) return 'graphml';
      if (/<gexf[\s>]/i.test(h)) return 'gexf';
      if (/^\s*(\/\/[^\n]*\n\s*)*(CREATE|MATCH|MERGE|:begin|BEGIN)\b/i.test(h) && /\(\s*[A-Za-z_]*\s*:/.test(h)) return 'cypher';
      if (/^\s*\{/.test(h) && /"nodes"\s*:/.test(h) && /"(edges|links|relationships)"\s*:/.test(h)) return 'nodelink';
      if (/^\s*\{/.test(h) && /"elements"\s*:\s*\{/.test(h) && /"nodes"\s*:/.test(h)) return 'nodelink';
      return null;
    }
    /** Parse a text in a known format. */
    function parse(format, text) {
      if (format === 'graphml') return parseGraphML(text);
      if (format === 'gexf') return parseGEXF(text);
      if (format === 'cypher') return parseCypherScript(text);
      if (format === 'nodelink') return parseNodeLink(text);
      throw new Error(D.t('graph.err.format'));
    }
    /** Write a graph in a format: 'graphml', 'gexf', 'nodelink' or 'cypher'. */
    function write(format, graph) {
      if (format === 'graphml') return toGraphML(graph);
      if (format === 'gexf') return toGEXF(graph);
      if (format === 'cypher') return toCypher(graph);
      return toNodeLink(graph);
    }

    return { NODE_COLUMNS, EDGE_COLUMNS, MAX_VIEW, normalise, summarise, displayName, parseProps, parseGraphML, parseGEXF, parseNodeLink, parseCypherScript, parseMap, toGraphML, toGEXF, toNodeLink, toCypher, detectText, parse, write, createGraphDataset, isGraph, nodes, edges, neighborhood, subgraph, whole, layoutGet, layoutSet, summary, fromTables, toTable, typedColumns };
  });
})();
