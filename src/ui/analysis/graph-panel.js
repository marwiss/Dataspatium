// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph tools in Analysera for graph datasets. Two tabs share this module: Cypher (mode 'cypher': a query in the
 * Cypher subset of analysis/cypher, run as SQL on the dataset with the SQL shown; results saved as datasets) and
 * Graf (mode 'tools': summary measures, degrees, components and shortest paths from the worker in analysis/graph,
 * subgraphs by label and type as new graph datasets, nodes and edges as tables). The dialog that builds a graph
 * from two tables (nodes and edges) is exported for Hantera. Pure logic lives in data/graph, analysis/cypher and
 * analysis/graph.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/graph-panel', ['ui/base', 'ui/overlays', 'data/datasets', 'data/graph', 'analysis/cypher', 'analysis/graph', 'platform/files', 'analysis/cypher-write', 'api/graph-source'], (base, overlays, datasets, graph, cypher, measures, files, cypherWrite, graphSource) => {
    const { h, t, i18n, replace } = base;
    const TOOLS = ['summary', 'degrees', 'components', 'pagerank', 'communities', 'centrality', 'path', 'pattern', 'subgraph', 'layout', 'tables'];
    const PREVIEW_ROWS = 2000;

    /**
     * @param {any} ctx shell context @param {{mode?: 'cypher'|'tools', rerenderRight?: () => void}} [options]
     */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const mode = options.mode === 'cypher' ? 'cypher' : 'tools';
      const s = { tool: 'summary', query: '', showSql: true, onServer: false, server: null, result: null, error: '', busy: false, from: '', to: '', undirected: false, labels: new Set(), types: new Set(), info: null, infoFor: '', pattern: { a: '', type: '', b: '', direction: 'out', key: '', op: '=', value: '', limit: 200 }, iterations: 60 };
      let editor = null; let fieldsEl = null; let resultEl = null; let seq = 0;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'graph';
      async function infoOf(ds) {
        const key = ds.id + ':' + ds.updatedAt;
        if (s.infoFor !== key) { s.info = await graph.summary(ds.id); s.infoFor = key; }
        return s.info;
      }

      function center() {
        const ds = selected();
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon(mode === 'cypher' ? 'git-branch' : 'share-2', 20), t(mode === 'cypher' ? 'graph.cypher.title' : 'graph.tool.title'), ' ', ds ? h('dm-badge', { kind: 'accent', text: ds.name }) : null));
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        if (mode === 'cypher') { renderCypher(); return { head, body: [fieldsEl, resultEl] }; }
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('graph.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; s.result = null; s.error = ''; renderFields(); renderResult(); if (options.rerenderRight) options.rerenderRight(); });
        renderFields(); renderResult();
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      // ---- Cypher ---------------------------------------------------------------------------------------------------
      function renderCypher() {
        if (!fieldsEl) return;
        const ds = selected();
        if (!usable(ds)) { replace(fieldsEl, h('p', { class: 'dm-help', text: t('graph.pick') })); replace(resultEl); return; }
        editor = /** @type {any} */ (h('dm-code', { language: 'sql', placeholder: t('graph.cypher.placeholder') }));
        editor.value = s.query;
        editor.addEventListener('input', () => { s.query = editor.value; });
        const exampleSel = /** @type {any} */ (h('dm-select', { label: t('graph.cypher.examples'), inline: true }));
        infoOf(ds).then((info) => { exampleSel.options = [{ value: '', label: '–' }].concat(cypher.examples(info).map((q, i) => ({ value: String(i), label: q.length > 70 ? q.slice(0, 67) + '…' : q }))); exampleSel.value = ''; });
        exampleSel.addEventListener('change', async () => { const info = await infoOf(ds); const q = cypher.examples(info)[Number(exampleSel.value)]; if (q) { s.query = q; editor.value = q; } });
        const sqlSwitch = /** @type {any} */ (h('dm-switch', { label: t('graph.cypher.showsql') }));
        sqlSwitch.checked = s.showSql;
        sqlSwitch.addEventListener('change', () => { s.showSql = sqlSwitch.checked; renderResult(); });
        // A graph saved from a server can ask the server too: all of Cypher against all of the graph, not the subset against the copy.
        const serverBox = h('span', { class: 'dm-row-wrap' });
        graphSource.forDataset(ds).then((way) => {
          s.server = way;
          if (!way) { s.onServer = false; return; }
          const sw = /** @type {any} */ (h('dm-switch', { label: t('graph.cypher.server', { host: way.host }), title: t('graph.cypher.server.hint'), 'data-cypher-server': '' }));
          sw.checked = s.onServer;
          sw.addEventListener('change', () => { s.onServer = sw.checked; });
          replace(serverBox, sw);
        }).catch((err) => D.log('graph-panel', err));
        replace(fieldsEl,
          h('div', { class: 'dm-card dm-stack-sm' }, editor,
            h('div', { class: 'dm-row-wrap' },
              ui.button({ label: t('common.run'), icon: 'play', variant: 'primary', loading: s.busy, title: t('graph.cypher.run.hint'), onClick: runCypher }),
              exampleSel, sqlSwitch, serverBox,
              h('span', { class: 'dm-help dm-xs', text: t('graph.cypher.hint') }))));
        renderResult();
      }
      async function runCypher() {
        const ds = selected(); if (!usable(ds) || s.busy) return;
        const text = (editor ? editor.value : s.query).trim();
        if (!text) return;
        s.query = text; s.busy = true; s.error = ''; renderCypher();
        const my = ++seq;
        try {
          if (s.onServer && s.server) {
            const out = await s.server.run(text, {});
            if (my !== seq) return;
            s.result = { columns: out.columns, rows: out.rows, sql: '', params: [], name: t('graph.cypher.dataset', { name: ds.name }), note: t('graph.cypher.server.note', { n: i18n.formatNumber(out.rows.length), host: s.server.host }) };
            s.resultKey = contentKey();
            shell.log(t('graph.cypher.ran', { n: i18n.formatNumber(out.rows.length) }), 'ok');
          } else if (cypherWrite.isWrite(text)) {
            // CREATE, MERGE, SET, REMOVE and DELETE become recipe steps on the dataset (logged, undoable).
            const w = await cypherWrite.execute(ds.id, text);
            if (my !== seq) return;
            s.result = { columns: ['steg', 'noder', 'kanter', 'matchade'], rows: [[w.steps, w.nodes, w.edges, w.matched]], sql: w.ops.map((o) => `${o.op} ${JSON.stringify(o.params)}`).join('\n'), params: [], name: '', note: t('graph.cypher.wrote', { steps: i18n.formatNumber(w.steps) }) };
            s.resultKey = contentKey();
            shell.log(t('graph.cypher.wrote', { steps: i18n.formatNumber(w.steps) }), 'ok');
            s.infoFor = '';
          } else {
            const out = await cypher.run(ds.id, text);
            if (my !== seq) return;
            s.result = { columns: out.columns, rows: out.rows, sql: out.sql, params: out.params, name: t('graph.cypher.dataset', { name: ds.name }), note: t('graph.cypher.note', { n: i18n.formatNumber(out.rows.length), limit: i18n.formatNumber(out.info.limit) }) };
            s.resultKey = contentKey();
            shell.log(t('graph.cypher.ran', { n: i18n.formatNumber(out.rows.length) }), 'ok');
          }
        } catch (err) {
          s.result = null; s.error = String((err && err.message) || err);
        }
        s.busy = false; renderCypher();
      }

      // ---- tools ----------------------------------------------------------------------------------------------------
      function renderFields() {
        if (!fieldsEl) return;
        const ds = selected();
        if (!usable(ds)) { replace(fieldsEl, h('p', { class: 'dm-help', text: t('graph.pick') })); return; }
        const nodes = [];
        if (s.tool === 'path') {
          const from = /** @type {any} */ (h('dm-input', { label: t('graph.path.from'), placeholder: t('graph.path.placeholder') })); from.value = s.from; from.addEventListener('input', () => { s.from = from.value; });
          const to = /** @type {any} */ (h('dm-input', { label: t('graph.path.to'), placeholder: t('graph.path.placeholder') })); to.value = s.to; to.addEventListener('input', () => { s.to = to.value; });
          const und = /** @type {any} */ (h('dm-switch', { label: t('graph.path.undirected') })); und.checked = s.undirected; und.addEventListener('change', () => { s.undirected = und.checked; });
          nodes.push(h('div', { class: 'dm-row-wrap' }, from, to, und, ui.button({ label: t('graph.path.find'), icon: 'git-branch', variant: 'primary', loading: s.busy, onClick: () => runTool() })));
        } else if (s.tool === 'subgraph') {
          const box = h('div', { class: 'dm-row-wrap' });
          infoOf(ds).then((info) => {
            const group = (title, list, set) => h('div', { class: 'dm-stack-sm' }, h('strong', { text: title }), h('div', { class: 'dm-row-wrap' }, list.slice(0, 40).map((l) => { const sw = /** @type {any} */ (h('dm-switch', { label: `${l.name || t('graph.nolabel')} (${i18n.formatNumber(l.count)})` })); sw.checked = set.has(l.name || ''); sw.addEventListener('change', () => { if (sw.checked) set.add(l.name || ''); else set.delete(l.name || ''); }); return sw; })));
            replace(box, group(t('graph.labels'), info.labels || [], s.labels), group(t('graph.types'), info.types || [], s.types));
          });
          nodes.push(box, h('p', { class: 'dm-help dm-small', text: t('graph.subgraph.hint') }), h('div', { class: 'dm-row' }, ui.button({ label: t('graph.subgraph.create'), icon: 'share-2', variant: 'primary', loading: s.busy, onClick: () => runTool() })));
        } else if (s.tool === 'pattern') {
          // Query without code: label – relationship – label, direction, one filter on the first node.
          const pt = s.pattern; const box = h('div', { class: 'dm-stack-sm' });
          infoOf(ds).then((info) => {
            const labelOpts = [{ value: '', label: t('graph.pattern.any') }].concat((info.labels || []).map((l) => ({ value: l.name || '', label: l.name || t('graph.nolabel') })));
            const typeOpts = [{ value: '', label: t('graph.pattern.any') }].concat((info.types || []).map((l) => ({ value: l.name || '', label: l.name || t('graph.notype') })));
            const sel = (label, opts, value, key) => { const el = /** @type {any} */ (h('dm-select', { label, inline: true })); el.options = opts; el.value = value; el.addEventListener('change', () => { pt[key] = el.value; }); return el; };
            const inp = (label, value, key, attrs = {}) => { const el = /** @type {any} */ (h('dm-input', Object.assign({ label, inline: true }, attrs))); el.value = String(value); el.addEventListener('input', () => { pt[key] = attrs.type === 'number' ? Number(el.value) : el.value; }); return el; };
            replace(box,
              h('div', { class: 'dm-row-wrap' }, sel(t('graph.pattern.a'), labelOpts, pt.a, 'a'), sel(t('graph.pattern.direction'), [{ value: 'out', label: '\u2192' }, { value: 'in', label: '\u2190' }, { value: 'both', label: '\u2014' }], pt.direction, 'direction'), sel(t('graph.pattern.type'), typeOpts, pt.type, 'type'), sel(t('graph.pattern.b'), labelOpts, pt.b, 'b')),
              h('div', { class: 'dm-row-wrap' }, inp(t('graph.pattern.key'), pt.key, 'key', { placeholder: 'name' }), sel(t('graph.pattern.op'), ['=', '<>', '<', '<=', '>', '>=', 'CONTAINS', 'STARTS WITH'].map((o) => ({ value: o, label: o })), pt.op, 'op'), inp(t('graph.pattern.value'), pt.value, 'value'), inp(t('graph.pattern.limit'), pt.limit, 'limit', { type: 'number', min: '1' })),
              h('p', { class: 'dm-help dm-xs', text: t('graph.pattern.hint') }));
          });
          nodes.push(box, h('div', { class: 'dm-row' }, ui.button({ label: t('common.run'), icon: 'play', variant: 'primary', loading: s.busy, onClick: () => runTool() })));
        } else if (s.tool === 'layout') {
          const it = /** @type {any} */ (h('dm-input', { type: 'number', label: t('graph.layout.iterations'), min: '10', max: '500', inline: true })); it.value = String(s.iterations); it.addEventListener('input', () => { s.iterations = Number(it.value) || 60; });
          nodes.push(h('p', { class: 'dm-help dm-small', text: t('graph.layout.compute.hint') }), h('div', { class: 'dm-row-wrap' }, it, ui.button({ label: t('graph.layout.compute'), icon: 'play', variant: 'primary', loading: s.busy, onClick: () => runTool() })));
        } else if (s.tool === 'tables') {
          nodes.push(h('p', { class: 'dm-help dm-small', text: t('graph.tables.hint') }), h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('graph.tables.nodes'), icon: 'table', variant: 'primary', loading: s.busy, onClick: () => saveTable('nodes') }), ui.button({ label: t('graph.tables.edges'), icon: 'table', loading: s.busy, onClick: () => saveTable('edges') })));
        } else {
          nodes.push(h('p', { class: 'dm-help dm-small', text: t('graph.tool.about.' + s.tool) }), h('div', { class: 'dm-row' }, ui.button({ label: t('common.run'), icon: 'play', variant: 'primary', loading: s.busy, onClick: () => runTool() })));
        }
        replace(fieldsEl, h('div', { class: 'dm-card dm-stack-sm' }, nodes));
      }
      async function runTool() {
        const ds = selected(); if (!usable(ds) || s.busy) return;
        s.busy = true; s.error = ''; renderFields();
        const my = ++seq;
        try {
          const out = await compute(ds);
          if (my !== seq) return;
          s.result = out;
          s.resultKey = contentKey();
        } catch (err) { s.result = null; s.error = String((err && err.message) || err); }
        s.busy = false; renderFields(); renderResult();
      }
      async function compute(ds) {
        const col = (name) => name;
        if (s.tool === 'summary') {
          const m = await measures.summary(ds.id);
          const rows = [[t('graph.nodes'), i18n.formatNumber(m.nodes)], [t('graph.edges'), i18n.formatNumber(m.edges)], [t('graph.directed'), m.directed ? t('common.yes') : t('common.no')], [t('graph.m.density'), i18n.formatNumber(Math.round(m.density * 1e5) / 1e5)], [t('graph.m.avgdegree'), i18n.formatNumber(Math.round(m.avgDegree * 100) / 100)], [t('graph.m.maxdegree'), i18n.formatNumber(m.maxDegree)], [t('graph.m.isolated'), i18n.formatNumber(m.isolated)], [t('graph.m.selfloops'), i18n.formatNumber(m.selfLoops)], [t('graph.m.components'), i18n.formatNumber(m.components)], [t('graph.m.largest'), i18n.formatNumber(m.largestComponent)]]
            .concat(m.degreeBuckets.map((b) => [t('graph.m.bucket', { from: b.from, to: b.to === Infinity || b.to === null ? '∞' : b.to }), i18n.formatNumber(b.count)]))
            .concat(m.top.map(([id, d], i) => [t('graph.m.top', { n: i + 1 }), `${id} (${i18n.formatNumber(d)})`]));
          return { columns: [col('matt'), col('varde')], rows, name: '', note: t('graph.m.note') };
        }
        if (s.tool === 'degrees') {
          const deg = await measures.degrees(ds.id);
          const names = new Map((await graph.nodes(ds.id)).map((n) => [n.id, [n.name, n.label]]));
          const rows = deg.sort((a, b) => b[3] - a[3]).map((r) => [r[0], (names.get(r[0]) || ['', ''])[0], (names.get(r[0]) || ['', ''])[1], r[1], r[2], r[3]]);
          return { columns: ['id', 'namn', 'etikett', 'utgrad', 'ingrad', 'grad'], rows, types: { utgrad: 'integer', ingrad: 'integer', grad: 'integer' }, name: t('graph.degrees.dataset', { name: ds.name }), note: t('graph.degrees.note', { n: i18n.formatNumber(rows.length) }) };
        }
        if (s.tool === 'components') {
          const c = await measures.components(ds.id);
          const names = new Map((await graph.nodes(ds.id)).map((n) => [n.id, n.name]));
          const rows = c.members.sort((a, b) => a[1] - b[1]).map((r) => [r[0], names.get(r[0]) || '', r[1], c.sizes[r[1] - 1] || 0]);
          return { columns: ['id', 'namn', 'komponent', 'storlek'], rows, types: { komponent: 'integer', storlek: 'integer' }, name: t('graph.components.dataset', { name: ds.name }), note: t('graph.components.note', { n: i18n.formatNumber(c.count), largest: i18n.formatNumber(c.sizes[0] || 0) }) };
        }
        if (s.tool === 'pagerank') {
          const pr = await measures.pagerank(ds.id);
          const names = new Map((await graph.nodes(ds.id)).map((n) => [n.id, n.name]));
          const rows = pr.sort((a, b) => b[1] - a[1]).map((r) => [r[0], names.get(r[0]) || '', Math.round(r[1] * 1e6) / 1e6]);
          return { columns: ['id', 'namn', 'pagerank'], rows, types: { pagerank: 'number' }, name: t('graph.pagerank.dataset', { name: ds.name }), note: t('graph.pagerank.note') };
        }
        if (s.tool === 'communities') {
          const c = await measures.communities(ds.id);
          const names = new Map((await graph.nodes(ds.id)).map((n) => [n.id, n.name]));
          const rows = c.members.sort((a, b) => a[1] - b[1]).map((r) => [r[0], names.get(r[0]) || '', r[1], c.sizes[r[1] - 1] || 0]);
          return { columns: ['id', 'namn', 'samhalle', 'storlek'], rows, types: { samhalle: 'integer', storlek: 'integer' }, name: t('graph.communities.dataset', { name: ds.name }), note: t('graph.communities.note', { n: i18n.formatNumber(c.count), largest: i18n.formatNumber(c.sizes[0] || 0) }) };
        }
        if (s.tool === 'centrality') {
          const ce = await measures.centrality(ds.id);
          const names = new Map((await graph.nodes(ds.id)).map((n) => [n.id, n.name]));
          const rows = ce.sort((a, b) => b[2] - a[2]).map((r) => [r[0], names.get(r[0]) || '', Math.round(r[1] * 1e4) / 1e4, Math.round(r[2] * 100) / 100]);
          return { columns: ['id', 'namn', 'narhet', 'mellanliggande'], rows, types: { narhet: 'number', mellanliggande: 'number' }, name: t('graph.centrality.dataset', { name: ds.name }), note: t('graph.centrality.note') };
        }
        if (s.tool === 'pattern') {
          const pt = s.pattern; const ident = (x) => (/^[A-Za-z_]\w*$/.test(x) ? x : '`' + x + '`');
          const lbl = (l) => (l ? ':' + ident(l) : ''); const rel = pt.type ? ':' + ident(pt.type) : '';
          const arrow = pt.direction === 'in' ? `<-[r${rel}]-` : pt.direction === 'both' ? `-[r${rel}]-` : `-[r${rel}]->`;
          const value = /^-?\d+(\.\d+)?$/.test(String(pt.value).trim()) ? String(pt.value).trim() : JSON.stringify(String(pt.value));
          const where = pt.key ? ` WHERE a.${ident(pt.key)} ${pt.op} ${value}` : '';
          const text = `MATCH (a${lbl(pt.a)})${arrow}(b${lbl(pt.b)})${where} RETURN a.name AS fran, labels(a) AS fran_etikett, type(r) AS relation, b.name AS till, labels(b) AS till_etikett, id(a) AS fran_id, id(b) AS till_id LIMIT ${Math.max(1, Number(pt.limit) || 200)}`;
          const out = await cypher.run(ds.id, text);
          return { columns: out.columns, rows: out.rows, sql: text, name: t('graph.pattern.dataset', { name: ds.name }), note: t('graph.cypher.note', { n: i18n.formatNumber(out.rows.length), limit: i18n.formatNumber(Number(pt.limit) || 200) }) };
        }
        if (s.tool === 'layout') {
          const positions = await measures.layout(ds.id, { iterations: s.iterations, save: true });
          return { columns: ['id', 'x', 'y'], rows: positions, types: { x: 'number', y: 'number' }, name: '', note: t('graph.layout.computed', { n: i18n.formatNumber(positions.length) }) };
        }
        if (s.tool === 'path') {
          const find = async (text) => { const q = String(text || '').trim(); if (!q) throw new Error(t('graph.path.need')); const exact = await graph.nodes(ds.id, { ids: [q], limit: 1 }); if (exact.length) return exact[0]; const hits = await graph.nodes(ds.id, { search: q, limit: 1 }); if (!hits.length) throw new Error(t('graph.path.notfound', { text: q })); return hits[0]; };
          const a = await find(s.from); const b = await find(s.to);
          const r = await measures.shortestPath(ds.id, a.id, b.id, s.undirected);
          if (!r.found) return { columns: ['steg', 'id', 'namn'], rows: [], name: '', note: t('graph.path.none', { from: a.name || a.id, to: b.name || b.id }) };
          const names = new Map((await graph.nodes(ds.id, { ids: r.path })).map((n) => [n.id, n.name]));
          return { columns: ['steg', 'id', 'namn'], rows: r.path.map((id, i) => [i, id, names.get(id) || '']), types: { steg: 'integer' }, name: t('graph.path.dataset', { from: a.name || a.id, to: b.name || b.id }), note: t('graph.path.found', { n: i18n.formatNumber(r.length) }) };
        }
        if (s.tool === 'subgraph') {
          const g = await graph.whole(ds.id);
          const keepLabel = (n) => !s.labels.size || s.labels.has(n.label || '');
          const keepType = (e) => !s.types.size || s.types.has(e.type || '');
          const nodes = g.nodes.filter(keepLabel); const ids = new Set(nodes.map((n) => n.id));
          const edges = g.edges.filter((e) => keepType(e) && ids.has(e.source) && ids.has(e.target));
          if (!nodes.length) throw new Error(t('graph.subgraph.empty'));
          const meta = await graph.createGraphDataset({ name: t('graph.subgraph.name', { name: ds.name }), graph: { nodes, edges, directed: g.directed }, source: { kind: 'derived', from: ds.id, labels: Array.from(s.labels), types: Array.from(s.types) } });
          shell.log(t('graph.subgraph.done', { name: meta.name, nodes: i18n.formatNumber(nodes.length), edges: i18n.formatNumber(edges.length) }), 'ok');
          return { columns: ['namn', 'noder', 'kanter'], rows: [[meta.name, nodes.length, edges.length]], name: '', note: t('graph.subgraph.done', { name: meta.name, nodes: i18n.formatNumber(nodes.length), edges: i18n.formatNumber(edges.length) }), created: meta.id };
        }
        throw new Error('unknown tool');
      }
      async function saveTable(kind) {
        const ds = selected(); if (!usable(ds) || s.busy) return;
        s.busy = true; renderFields();
        try {
          const items = kind === 'edges' ? await graph.edges(ds.id) : await graph.nodes(ds.id);
          const table = graph.toTable(items, kind);
          const meta = await datasets.create({ name: t(kind === 'edges' ? 'graph.tables.edges.name' : 'graph.tables.nodes.name', { name: ds.name }), columns: graph.typedColumns(table), rows: table.rows, source: { kind: 'derived', from: ds.id, part: kind } });
          shell.log(t('graph.tables.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) }), 'ok');
          ui.toast.show(t('graph.tables.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) }), { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        s.busy = false; renderFields();
      }

      // ---- results ----------------------------------------------------------------------------------------------------
      function renderResult() {
        if (!resultEl) return;
        const r = s.result;
        if (s.error) { replace(resultEl, h('div', { class: 'dm-card' }, h('p', { class: 'dm-error', text: s.error }))); return; }
        if (!r) { replace(resultEl); return; }
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
        const rows = r.rows.slice(0, PREVIEW_ROWS);
        const nameInput = /** @type {any} */ (h('dm-input', { label: t('api.name'), inline: true })); nameInput.value = r.name || '';
        replace(resultEl, h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: t('api.result', { rows: i18n.formatNumber(r.rows.length), cols: r.columns.length }) }), r.note ? h('span', { class: 'dm-help', text: r.note }) : null),
          (mode === 'cypher' ? s.showSql : s.tool === 'pattern') && r.sql ? h('pre', { class: 'dm-graph-sql', text: r.sql + (r.params && r.params.length ? '\n-- ' + t('graph.cypher.params') + ': ' + JSON.stringify(r.params) : '') }) : null,
          h('div', { class: 'dm-table-wrap' }, table),
          r.name ? h('div', { class: 'dm-row-wrap dm-api-save' }, nameInput, ui.button({ label: t('graph.result.save'), icon: 'save', onClick: () => saveResult(nameInput.value.trim()) }), ui.button({ label: t('graph.result.download'), icon: 'download', onClick: () => download(r) })) : null));
        requestAnimationFrame(() => table.setData({ columns: r.columns.map((c) => ({ key: c, label: c, type: (r.types && r.types[c]) || 'text' })), rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count) }));
      }
      async function saveResult(name) {
        const r = s.result; const ds = selected(); if (!r || !ds) return;
        try {
          const columns = graph.typedColumns({ columns: r.columns, rows: r.rows }).map((c) => Object.assign(c, r.types && r.types[c.name] ? { type: r.types[c.name] } : {}));
          const meta = await datasets.create({ name: name || r.name || ds.name, columns, rows: r.rows, source: { kind: 'derived', from: ds.id, cypher: mode === 'cypher' ? s.query : undefined, tool: mode === 'tools' ? s.tool : undefined } });
          shell.log(t('graph.tables.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) }), 'ok');
          ui.toast.show(t('graph.tables.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) }), { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      function download(r) {
        const esc = (v) => { const sv = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(sv) ? '"' + sv.replace(/"/g, '""') + '"' : sv; };
        const text = [r.columns.map(esc).join(';')].concat(r.rows.map((row) => row.map(esc).join(';'))).join('\n');
        files.download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), files.safeName(r.name || 'graf', 'csv'));
      }

      function inspector() {
        const ds = selected();
        const items = [h('h4', { text: t(mode === 'cypher' ? 'graph.cypher.title' : 'graph.tool.title') })];
        if (!usable(ds)) { items.push(h('p', { class: 'dm-help', text: t('graph.pick') })); return h('div', { class: 'dm-inspector dm-stack' }, items); }
        const box = h('div', { class: 'dm-stack-sm' });
        infoOf(ds).then((info) => replace(box,
          h('p', { class: 'dm-help dm-small', text: `${t('graph.nodes.n', { n: i18n.formatNumber(info.nodes) })} · ${t('graph.edges.n', { n: i18n.formatNumber(info.edges) })} · ${info.directed === false ? t('graph.undirected') : t('graph.directed')}` }),
          h('h4', { text: t('graph.labels') }), h('ul', { class: 'dm-map-legend-list' }, (info.labels || []).slice(0, 30).map((l) => h('li', null, h('span', { class: 'dm-truncate', text: `${l.name || t('graph.nolabel')} · ${i18n.formatNumber(l.count)}` })))),
          h('h4', { text: t('graph.types') }), h('ul', { class: 'dm-map-legend-list' }, (info.types || []).slice(0, 30).map((l) => h('li', null, h('span', { class: 'dm-truncate', text: `${l.name || t('graph.notype')} · ${i18n.formatNumber(l.count)}` }))))));
        items.push(box, h('p', { class: 'dm-help dm-xs', text: t(mode === 'cypher' ? 'graph.cypher.about' : 'graph.tool.about') }));
        return h('div', { class: 'dm-inspector dm-stack' }, items);
      }
      /** What the result on screen was computed from; a save of the same content must not clear it. */
      const contentKey = () => { const ds = selected(); return ds ? `${ds.id}#${datasets.contentMarker(ds.id)}` : ''; };
      function datasetChanged() { if (s.result && s.resultKey === contentKey()) return; s.result = null; s.error = ''; s.labels = new Set(); s.types = new Set(); if (fieldsEl) { if (mode === 'cypher') renderCypher(); else { renderFields(); renderResult(); } } }
      function destroy() { seq++; fieldsEl = null; resultEl = null; editor = null; }
      return { center, inspector, datasetChanged, destroy, state: s, runCypher, runTool };
    }

    /**
     * Dialog: build a graph dataset from two tables (nodes with an id column, edges with source and target columns).
     * @param {any} ctx shell context @param {string|null} edgesId a preselected table for the edges
     */
    async function fromTablesDialog(ctx, edgesId) {
      const list = (await datasets.list()).filter((d) => !d.kind || d.kind === 'table');
      if (!list.length) { ctx.ui.toast.show(t('graph.from.notables'), { kind: 'warn' }); return null; }
      const columnsOf = new Map();
      const cols = async (id) => { if (!columnsOf.has(id)) columnsOf.set(id, (await datasets.columns(id)).map((c) => c.name)); return columnsOf.get(id); };
      const sel = (label, opts, value) => { const el = /** @type {any} */ (h('dm-select', { label })); el.options = opts; el.value = value; return el; };
      const dsOpts = [{ value: '', label: '–' }].concat(list.map((d) => ({ value: d.id, label: d.name })));
      const edgesSel = sel(t('graph.from.edges'), dsOpts.slice(1), edgesId || list[0].id);
      const sourceSel = sel(t('graph.from.source'), [], ''); const targetSel = sel(t('graph.from.target'), [], ''); const typeSel = sel(t('graph.from.type'), [], '');
      const nodesSel = sel(t('graph.from.nodes'), dsOpts, '');
      const idSel = sel(t('graph.from.id'), [], ''); const labelSel = sel(t('graph.from.label'), [], ''); const nameSel = sel(t('graph.from.name'), [], '');
      const nameInput = /** @type {any} */ (h('dm-input', { label: t('import.name') }));
      const directed = /** @type {any} */ (h('dm-switch', { label: t('graph.directed') })); directed.checked = true;
      const errEl = h('p', { class: 'dm-error dm-small' });
      const colOpts = (names, none) => (none ? [{ value: '', label: '–' }] : []).concat(names.map((n) => ({ value: n, label: n })));
      const guess = (names, re) => names.find((n) => re.test(n)) || '';
      async function fillEdges() { const names = await cols(edgesSel.value); sourceSel.options = colOpts(names, false); targetSel.options = colOpts(names, false); typeSel.options = colOpts(names, true); sourceSel.value = guess(names, /^(source|from|kalla|k[äa]lla|fran|från|start|a|src)$/i) || names[0] || ''; targetSel.value = guess(names, /^(target|to|mal|m[åa]l|till|slut|b|dst)$/i) || names[1] || names[0] || ''; typeSel.value = guess(names, /^(type|typ|relation|rel|label)$/i); const ds = list.find((d) => d.id === edgesSel.value); if (!nameInput.value) nameInput.value = ds ? ds.name : ''; }
      async function fillNodes() { if (!nodesSel.value) { idSel.options = []; labelSel.options = []; nameSel.options = []; return; } const names = await cols(nodesSel.value); idSel.options = colOpts(names, false); labelSel.options = colOpts(names, true); nameSel.options = colOpts(names, true); idSel.value = guess(names, /^(id|node_?id|nodeid|key|kod)$/i) || names[0] || ''; labelSel.value = guess(names, /^(label|labels|etikett|type|typ|kind|slag)$/i); nameSel.value = guess(names, /^(name|namn|title|titel|label)$/i); }
      edgesSel.addEventListener('change', fillEdges); nodesSel.addEventListener('change', fillNodes);
      await fillEdges(); await fillNodes();
      let done = null;
      const body = h('div', { class: 'dm-stack' },
        h('p', { class: 'dm-help', text: t('graph.from.hint') }),
        h('div', { class: 'dm-card dm-stack-sm' }, h('strong', { text: t('graph.from.edges.title') }), h('div', { class: 'dm-row-wrap' }, edgesSel, sourceSel, targetSel, typeSel)),
        h('div', { class: 'dm-card dm-stack-sm' }, h('strong', { text: t('graph.from.nodes.title') }), h('div', { class: 'dm-row-wrap' }, nodesSel, idSel, labelSel, nameSel), h('p', { class: 'dm-help dm-xs', text: t('graph.from.nodes.hint') })),
        h('div', { class: 'dm-row-wrap' }, nameInput, directed),
        errEl,
        h('div', { class: 'dm-row' }, ctx.ui.button({ label: t('graph.from.create'), icon: 'share-2', variant: 'primary', onClick: async () => {
          try {
            errEl.textContent = '';
            const g = await graph.fromTables({ edgesId: edgesSel.value, edgeSource: sourceSel.value, edgeTarget: targetSel.value, edgeType: typeSel.value || null, nodesId: nodesSel.value || null, nodeId: idSel.value || null, nodeLabel: labelSel.value || null, nodeName: nameSel.value || null, directed: directed.checked, createMissing: true });
            const meta = await graph.createGraphDataset({ name: nameInput.value.trim() || t('graph.from.name.default'), graph: g, source: { kind: 'derived', from: edgesSel.value, nodes: nodesSel.value || null, edgeSource: sourceSel.value, edgeTarget: targetSel.value } });
            ctx.shell.log(t('graph.from.done', { name: meta.name, nodes: i18n.formatNumber(g.nodes.length), edges: i18n.formatNumber(g.edges.length) }), 'ok');
            if (done) done(meta);
          } catch (err) { errEl.textContent = String((err && err.message) || err); }
        } })));
      return overlays.dialog.open({ title: t('graph.from.title'), help: 'grafer#graf-av-två-tabeller', size: 'lg', body: (finish) => { done = finish; return body; }, actions: [{ label: t('common.cancel'), value: null }] });
    }

    return { create, fromTablesDialog, TOOLS };
  });
})();
