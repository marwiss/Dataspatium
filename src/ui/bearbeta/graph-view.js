// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph view in Bearbeta for graph datasets (data/graph): an overview where every label is a collapsed group
 * (Cytoscape with expand-collapse), opened on double-click; a focus view that grows step by step from a search hit
 * or a tapped node (neighbourhood expansion); and a whole-graph drawing with sigma (WebGL) for tens of thousands
 * of elements. Cytoscape never holds more than the current view (data/graph.MAX_VIEW elements); the graph itself
 * may be far larger. Layouts fCoSE, dagre and grid; positions can be kept in the dataset (`_layout`). The
 * inspector shows the legend of labels, the search, and the selected node or edge with its properties. The node
 * table is always one click away. Libraries are vendored (cytoscape, sigma, graphology; MIT) and loaded on first use.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/graph-view', ['ui/base', 'data/datasets', 'data/graph'], (base, datasets, graph) => {
    const { h, t, i18n, replace } = base;
    const CY_SCRIPTS = ['vendor/cytoscape/cytoscape.min.js', 'vendor/layout-base/layout-base.js', 'vendor/cose-base/cose-base.js', 'vendor/cytoscape-fcose/cytoscape-fcose.js', 'vendor/cytoscape-dagre/cytoscape-dagre.js', 'vendor/cytoscape-expand-collapse/cytoscape-expand-collapse.js'];
    const SIGMA_SCRIPTS = ['vendor/graphology/graphology.umd.min.js', 'vendor/sigma/sigma.min.js'];
    const LAYOUTS = ['fcose', 'dagre', 'grid', 'circle', 'concentric'];
    const FOCUS_LIMIT = 2000;
    let cyLoading = null; let sigmaLoading = null;
    /** Load the Cytoscape scripts in order and register the extensions once. */
    function ensureCytoscape() {
      if (globalThis.cytoscape && globalThis.cytoscape.__dmReady) return Promise.resolve(globalThis.cytoscape);
      if (!cyLoading) {
        cyLoading = CY_SCRIPTS.reduce((p, path) => p.then(() => D.assets.loadVendorScript(path)), Promise.resolve()).then(() => {
          const cy = globalThis.cytoscape;
          if (!cy) throw new Error(D.t('graph.err.load'));
          if (globalThis.cytoscapeFcose) cy.use(globalThis.cytoscapeFcose);
          if (globalThis.cytoscapeDagre) cy.use(globalThis.cytoscapeDagre);
          if (globalThis.cytoscapeExpandCollapse) cy.use(globalThis.cytoscapeExpandCollapse);
          cy.__dmReady = true;
          return cy;
        }).catch((err) => { cyLoading = null; throw err; });
      }
      return cyLoading;
    }
    function ensureSigma() {
      if (globalThis.Sigma && globalThis.graphology) return Promise.resolve(true);
      if (!sigmaLoading) sigmaLoading = SIGMA_SCRIPTS.reduce((p, path) => p.then(() => D.assets.loadVendorScript(path)), Promise.resolve()).then(() => { if (!globalThis.Sigma || !globalThis.graphology) throw new Error(D.t('graph.err.load')); return true; }).catch((err) => { sigmaLoading = null; throw err; });
      return sigmaLoading;
    }
    /** The app's categorical palette from the design tokens. */
    function palette() {
      const cs = getComputedStyle(document.documentElement); const out = [];
      for (let i = 1; i <= 12; i++) { const v = cs.getPropertyValue(`--dm-cat-${i}`).trim(); if (!v) break; out.push(v); }
      return out.length ? out : ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#56b4e9', '#cc79a7', '#f0e442', '#999999'];
    }
    const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    /**
     * @param {any} ctx shell context @param {{onTable: () => void, onChanged?: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, mode: 'overview', layout: 'fcose', labels: true, selected: null, focus: [], search: '', hits: [], info: null, colors: new Map(), busy: '', error: '', count: { nodes: 0, edges: 0 } };
      let ds = null; let slots = null; let cy = null; let ec = null; let sigma = null; let canvasEl = null; let seq = 0;

      const colorOf = (label) => { const key = label || ''; if (!s.colors.has(key)) { const p = palette(); s.colors.set(key, p[s.colors.size % p.length]); } return s.colors.get(key); };
      function destroyDrawing() { if (cy) { try { cy.destroy(); } catch (_e) { /* ignore */ } cy = null; ec = null; } if (sigma) { try { sigma.kill(); } catch (_e) { /* ignore */ } sigma = null; } }
      function destroy() { seq++; destroyDrawing(); canvasEl = null; slots = null; }

      async function load(dataset) {
        if (s.id !== dataset.id) { s.id = dataset.id; s.mode = 'overview'; s.selected = null; s.focus = []; s.search = ''; s.hits = []; s.colors = new Map(); s.error = ''; }
        ds = dataset;
        s.info = await graph.summary(dataset.id);
        s.count = { nodes: s.info.nodes || dataset.rowCount || 0, edges: s.info.edges || 0 };
        for (const l of s.info.labels || []) colorOf(l.name);
      }

      /** @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        await load(dataset);
        if (my !== seq || !slots) return;
        const layoutSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('graph.layout'), inline: true }));
        layoutSel.options = LAYOUTS.map((l) => ({ value: l, label: t('graph.layout.' + l) }));
        layoutSel.value = s.layout;
        layoutSel.addEventListener('change', () => { s.layout = layoutSel.value; runLayout(); });
        const labels = /** @type {any} */ (h('dm-switch', { label: t('graph.labels.show') }));
        labels.checked = s.labels;
        labels.addEventListener('change', () => { s.labels = labels.checked; if (cy) cy.style().selector('node').style('label', s.labels ? 'data(namn)' : '').update(); if (sigma) sigma.setSetting('renderLabels', s.labels); });
        const modeSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('graph.mode'), inline: true }));
        modeSel.options = [{ value: 'overview', label: t('graph.mode.overview') }, { value: 'focus', label: t('graph.mode.focus') }, { value: 'whole', label: t('graph.mode.whole') }];
        modeSel.value = s.mode;
        modeSel.addEventListener('change', () => { s.mode = modeSel.value; draw(); });
        canvasEl = h('div', { class: 'dm-graph-view dm-center-fill', 'aria-label': t('graph.view') }, h('div', { class: 'dm-graph-canvas' }));
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('share-2', 20), dataset.name, ' ', h('dm-badge', { text: t('graph.nodes.n', { n: i18n.formatNumber(s.count.nodes) }) }), h('dm-badge', { text: t('graph.edges.n', { n: i18n.formatNumber(s.count.edges) }) }), s.info && s.info.directed === false ? h('dm-badge', { kind: 'accent', text: t('graph.undirected') }) : null),
            h('div', { class: 'dm-toolbar' }, modeSel, layoutSel, labels,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('graph.fit.hint'), onClick: fit }),
              ui.button({ label: t('graph.layout.save'), icon: 'save', title: t('graph.layout.save.hint'), onClick: saveLayout }),
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('graph.table.hint'), onClick: options.onTable }))),
          canvasEl);
        renderInspector();
        await draw();
      }

      // ---- drawing ------------------------------------------------------------------------------------------------
      const canvas = () => (canvasEl ? canvasEl.querySelector('.dm-graph-canvas') : null);
      function setEmpty(text) { const el = canvas(); if (!el) return; replace(el, text ? h('div', { class: 'dm-graph-empty', text }) : null); }
      async function draw() {
        const my = seq;
        destroyDrawing();
        s.error = ''; s.busy = t('common.loading'); renderInspector();
        try {
          if (s.mode === 'whole') await drawWhole();
          else if (s.mode === 'focus') await drawFocus();
          else await drawOverview();
        } catch (err) { s.error = String((err && err.message) || err); setEmpty(s.error); shell.log(s.error, 'error'); }
        if (my !== seq) return;
        s.busy = ''; renderInspector();
      }
      const nodeEl = (n) => ({ data: { id: n.id, namn: n.name || n.id, etikett: n.label || '', egenskaper: n.properties, kind: 'node' }, classes: 'dm-node' });
      const edgeEl = (e) => ({ data: { id: 'e:' + e.id, source: e.source, target: e.target, typ: e.type || '', egenskaper: e.properties, kind: 'edge' } });
      function styleSheet() {
        const text = token('--dm-text', '#222'); const border = token('--dm-border', '#999'); const surface = token('--dm-surface', '#fff'); const accent = token('--dm-accent', '#0072b2');
        return [
          { selector: 'node', style: { 'background-color': (ele) => colorOf(ele.data('etikett')), 'label': s.labels ? 'data(namn)' : '', 'font-size': 10, 'color': text, 'text-wrap': 'ellipsis', 'text-max-width': '120px', 'text-valign': 'bottom', 'text-margin-y': 4, 'width': 22, 'height': 22, 'border-width': 1, 'border-color': border, 'min-zoomed-font-size': 8 } },
          { selector: 'node:parent', style: { 'background-opacity': 0.08, 'background-color': (ele) => colorOf(ele.data('etikett')), 'border-color': (ele) => colorOf(ele.data('etikett')), 'border-width': 1.5, 'label': 'data(namn)', 'text-valign': 'top', 'font-weight': 600, 'font-size': 12 } },
          { selector: 'node.cy-expand-collapse-collapsed-node', style: { 'shape': 'round-rectangle', 'width': 'label', 'height': 34, 'padding': '10px', 'background-color': (ele) => colorOf(ele.data('etikett')), 'background-opacity': 0.9, 'color': surface, 'label': 'data(namn)', 'text-valign': 'center', 'font-size': 12, 'font-weight': 600, 'border-width': 0 } },
          { selector: 'node.dm-group', style: { 'shape': 'round-rectangle', 'width': 'label', 'height': 34, 'padding': '10px', 'background-color': (ele) => colorOf(ele.data('etikett')), 'background-opacity': 0.9, 'color': surface, 'label': 'data(namn)', 'text-valign': 'center', 'font-size': 12, 'font-weight': 600, 'border-width': 0 } },
          { selector: 'edge', style: { 'width': (ele) => Math.min(8, 1 + Math.log2(1 + (Number(ele.data('antal')) || 1))), 'line-color': border, 'target-arrow-color': border, 'target-arrow-shape': s.info && s.info.directed === false ? 'none' : 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier', 'label': s.labels ? 'data(typ)' : '', 'font-size': 8, 'color': text, 'text-rotation': 'autorotate', 'text-background-color': surface, 'text-background-opacity': 0.8, 'text-background-padding': '1px', 'min-zoomed-font-size': 9 } },
          { selector: ':selected', style: { 'border-width': 3, 'border-color': accent, 'line-color': accent, 'target-arrow-color': accent } },
        ];
      }
      async function mountCy(elements) {
        await ensureCytoscape();
        const el = canvas(); if (!el) return null;
        replace(el);
        cy = globalThis.cytoscape({ container: el, elements, style: styleSheet(), wheelSensitivity: 0.3, minZoom: 0.05, maxZoom: 6 });
        cy.on('tap', 'node, edge', (ev) => { const d = ev.target.data(); if (d.kind) { s.selected = { kind: d.kind, id: d.kind === 'edge' ? String(d.id).slice(2) : d.id, data: d }; renderInspector(); } });
        cy.on('tap', (ev) => { if (ev.target === cy) { s.selected = null; renderInspector(); } });
        return cy;
      }
      function layoutOptions() {
        if (s.layout === 'fcose') return { name: 'fcose', quality: 'default', animate: false, randomize: true, nodeRepulsion: 6000, idealEdgeLength: 70, nodeSeparation: 100 };
        if (s.layout === 'dagre') return { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 60, animate: false };
        return { name: s.layout, animate: false, avoidOverlap: true, padding: 20 };
      }
      async function runLayout() {
        if (!cy) { if (sigma) await drawWhole(); return; }
        const cached = await graph.layoutGet(s.id).catch(() => new Map());
        const movable = cy.nodes().filter((n) => !n.isParent());
        let used = 0;
        if (s.layout === 'fcose' && cached.size) { movable.forEach((n) => { const p = cached.get(n.id()); if (p) { n.position({ x: p[0], y: p[1] }); used++; } }); }
        if (used && used === movable.length) { cy.fit(undefined, 30); return; }
        try { cy.layout(layoutOptions()).run(); } catch (_e) { cy.layout({ name: 'grid', animate: false }).run(); }
        cy.fit(undefined, 30);
      }
      function fit() { if (cy) cy.fit(undefined, 30); if (sigma) sigma.getCamera().animatedReset(); }
      /** Overview: every label as a group; up to MAX_VIEW nodes are members (opened on double-click), larger graphs show group counts and label-pair edges. */
      async function drawOverview() {
        const small = s.count.nodes + s.count.edges <= graph.MAX_VIEW;
        if (small) {
          const g = await graph.whole(s.id);
          const labels = Array.from(new Set(g.nodes.map((n) => n.label || '')));
          const elements = labels.map((l) => ({ data: { id: 'grp:' + l, namn: `${l || t('graph.nolabel')} (${i18n.formatNumber(g.nodes.filter((n) => (n.label || '') === l).length)})`, etikett: l, kind: 'group' } }))
            .concat(g.nodes.map((n) => Object.assign(nodeEl(n), { data: Object.assign(nodeEl(n).data, { parent: 'grp:' + (n.label || '') }) })))
            .concat(g.edges.map(edgeEl));
          await mountCy(elements);
          if (!cy) return;
          ec = cy.expandCollapse({ layoutBy: layoutOptions(), fisheye: false, animate: false, undoable: false, cueEnabled: false, expandCollapseCuePosition: 'top-left', groupEdgesOfSameTypeOnCollapse: true, allowNestedEdgeCollapse: false, zIndex: 999 });
          cy.layout(layoutOptions()).run();
          if (labels.length > 1 || g.nodes.length > 60) ec.collapseAll();
          cy.on('dbltap', 'node', (ev) => { const n = ev.target; if (ec.isCollapsible(n)) ec.collapse(n); else if (ec.isExpandable(n)) { ec.expand(n); } });
          cy.fit(undefined, 30);
          return;
        }
        // Large graph: one node per label with counts; edges per label pair with counts (read in SQL).
        const handle = await datasets.ensureOpen(s.id);
        const res = await handle.engine.exec("select coalesce(a.etikett, '') as fran, coalesce(b.etikett, '') as till, count(*) as antal from _edges e join data a on a.id = e.kalla join data b on b.id = e.mal group by 1, 2 order by antal desc limit 400");
        const pairs = res[0] ? res[0].values : [];
        const elements = (s.info.labels || []).map((l) => ({ data: { id: 'grp:' + (l.name || ''), namn: `${l.name || t('graph.nolabel')} (${i18n.formatNumber(l.count)})`, etikett: l.name || '', kind: 'label', count: l.count }, classes: 'dm-group' }))
          .concat(pairs.map((p, i) => ({ data: { id: 'pe:' + i, source: 'grp:' + p[0], target: 'grp:' + p[1], typ: i18n.formatNumber(p[2]), antal: p[2], kind: 'pair' } })));
        await mountCy(elements);
        if (!cy) return;
        cy.on('dbltap', 'node', async (ev) => { const label = ev.target.data('etikett'); const nodes = await graph.nodes(s.id, { label, limit: FOCUS_LIMIT }); s.focus = nodes.map((n) => n.id); s.mode = 'focus'; await draw(); });
        cy.layout({ name: 'circle', animate: false, padding: 30 }).run();
        cy.fit(undefined, 30);
      }
      /** Focus: the chosen node ids and the edges among them; "Visa grannar" grows the set. */
      async function drawFocus() {
        if (!s.focus.length) { setEmpty(t('graph.focus.empty')); return; }
        const sub = await graph.subgraph(s.id, s.focus.slice(0, FOCUS_LIMIT));
        await mountCy(sub.nodes.map(nodeEl).concat(sub.edges.map(edgeEl)));
        if (!cy) return;
        cy.on('dbltap', 'node', (ev) => expandNeighbours([ev.target.id()]));
        await runLayout();
      }
      async function expandNeighbours(ids) {
        const before = s.focus.length;
        const more = await graph.neighborhood(s.id, ids, 1, FOCUS_LIMIT);
        s.focus = Array.from(new Set(s.focus.concat(more))).slice(0, FOCUS_LIMIT);
        if (s.focus.length === before) { ui.toast.show(t('graph.focus.nomore'), { kind: 'info' }); return; }
        s.mode = 'focus';
        await draw();
      }
      /** Whole graph with sigma: positions from _layout, else a quick circular-by-label placement that is then kept. */
      async function drawWhole() {
        await ensureSigma();
        const el = canvas(); if (!el) return;
        replace(el);
        const g = await graph.whole(s.id);
        const cached = await graph.layoutGet(s.id).catch(() => new Map());
        const G = new globalThis.graphology.Graph({ multi: true, type: g.directed ? 'directed' : 'undirected' });
        const labels = Array.from(new Set(g.nodes.map((n) => n.label || '')));
        const perLabel = new Map(); const counts = new Map();
        for (const n of g.nodes) counts.set(n.label || '', (counts.get(n.label || '') || 0) + 1);
        const fresh = [];
        g.nodes.forEach((n) => {
          const key = n.label || '';
          let p = cached.get(n.id);
          if (!p) {
            // Deterministic placement: labels on a ring, members in a disc around their label's centre.
            const li = labels.indexOf(key); const k = perLabel.get(key) || 0; perLabel.set(key, k + 1);
            const total = counts.get(key) || 1; const R = 100 + 60 * Math.sqrt(labels.length); const r = 10 + 4 * Math.sqrt(total);
            const ang = (2 * Math.PI * li) / Math.max(1, labels.length); const a2 = k * 2.399963; const rr = r * Math.sqrt(k / Math.max(1, total));
            p = [R * Math.cos(ang) + rr * Math.cos(a2), R * Math.sin(ang) + rr * Math.sin(a2)];
            fresh.push([n.id, p[0], p[1]]);
          }
          G.addNode(n.id, { x: p[0], y: p[1], size: 3, label: n.name || n.id, color: colorOf(key) });
        });
        for (const e of g.edges) { if (G.hasNode(e.source) && G.hasNode(e.target)) G.addEdgeWithKey('e:' + e.id, e.source, e.target, { label: e.type || '', color: token('--dm-border', '#bbb'), size: 0.6 }); }
        if (fresh.length) graph.layoutSet(s.id, fresh).catch(() => {});
        sigma = new globalThis.Sigma(G, el, { renderLabels: s.labels, labelRenderedSizeThreshold: 8, labelDensity: 0.1, labelFont: token('--dm-font-sans', 'sans-serif'), labelColor: { color: token('--dm-text', '#222') }, defaultEdgeType: g.directed ? 'arrow' : 'line', minCameraRatio: 0.02, maxCameraRatio: 20 });
        sigma.on('clickNode', ({ node }) => { const n = g.nodes.find((x) => x.id === node); if (n) { s.selected = { kind: 'node', id: n.id, data: { id: n.id, namn: n.name, etikett: n.label, egenskaper: n.properties } }; renderInspector(); } });
        sigma.on('clickStage', () => { s.selected = null; renderInspector(); });
      }
      async function saveLayout() {
        if (!cy) { ui.toast.show(t('graph.layout.saved.whole'), { kind: 'info' }); return; }
        const positions = cy.nodes().filter((n) => !n.isParent() && n.data('kind') === 'node').map((n) => [n.id(), Math.round(n.position('x') * 100) / 100, Math.round(n.position('y') * 100) / 100]);
        await graph.layoutSet(s.id, positions);
        ui.toast.show(t('graph.layout.saved', { n: i18n.formatNumber(positions.length) }), { kind: 'ok' });
      }

      // ---- inspector ------------------------------------------------------------------------------------------------
      function renderInspector() {
        if (!slots) return;
        const items = [];
        if (s.busy) items.push(h('dm-progress', { indeterminate: true, label: s.busy }));
        if (s.error) items.push(h('p', { class: 'dm-error dm-small', text: s.error }));
        // Search: nodes by name, id or property text → focus on the hits.
        const search = /** @type {any} */ (h('dm-input', { label: t('graph.search'), placeholder: t('graph.search.placeholder') }));
        search.value = s.search;
        search.addEventListener('input', () => { s.search = search.value; });
        search.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') doSearch(); });
        items.push(h('h4', { text: t('graph.search') }), h('div', { class: 'dm-row' }, search, ui.button({ label: t('common.search'), icon: 'search', size: 'sm', onClick: doSearch })));
        if (s.hits.length) items.push(h('div', { class: 'dm-list dm-graph-hits' }, s.hits.slice(0, 50).map((n) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => { s.focus = [n.id]; s.mode = 'focus'; s.selected = { kind: 'node', id: n.id, data: { id: n.id, namn: n.name, etikett: n.label, egenskaper: n.properties } }; draw(); } }, h('span', { class: 'dm-graph-swatch', style: { background: colorOf(n.label) } }), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: n.name || n.id }), h('span', { class: 'dm-list-sub dm-truncate', text: n.label || t('graph.nolabel') }))))));
        if (s.mode === 'focus') items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('graph.focus.expand'), icon: 'plus', size: 'sm', disabled: !s.focus.length, title: t('graph.focus.expand.hint'), onClick: () => expandNeighbours(s.selected && s.selected.kind === 'node' ? [s.selected.id] : s.focus.slice(0, 50)) }), ui.button({ label: t('graph.focus.clear'), icon: 'x', size: 'sm', onClick: () => { s.focus = []; s.mode = 'overview'; draw(); } }), h('span', { class: 'dm-help dm-xs', text: t('graph.focus.n', { n: i18n.formatNumber(s.focus.length) }) })));
        // Selected element.
        if (s.selected) {
          const d = s.selected.data;
          const kv = /** @type {any} */ (h('dm-kv'));
          const props = graph.parseProps(d.egenskaper);
          kv.items = (s.selected.kind === 'node'
            ? [{ label: t('graph.field.id'), value: d.id }, { label: t('graph.field.label'), value: d.etikett || t('graph.nolabel') }, { label: t('common.name'), value: d.namn || '' }]
            : [{ label: t('graph.field.id'), value: s.selected.id }, { label: t('graph.field.type'), value: d.typ || t('graph.notype') }, { label: t('graph.field.source'), value: d.source }, { label: t('graph.field.target'), value: d.target }])
            .concat(Object.entries(props).map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) })));
          items.push(h('h4', { text: t(s.selected.kind === 'node' ? 'graph.selected.node' : 'graph.selected.edge') }), kv);
          if (s.selected.kind === 'node') items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('graph.focus.here'), icon: 'circle-dot', size: 'sm', onClick: () => { s.focus = [s.selected.id]; s.mode = 'focus'; expandNeighbours([s.selected.id]); } })));
        }
        // Legend: labels with colours and counts; click a label to focus on its nodes.
        if (s.info && s.info.labels) {
          items.push(h('h4', { text: t('graph.labels') }), h('ul', { class: 'dm-map-legend-list dm-graph-legend' }, s.info.labels.slice(0, 40).map((l) => h('li', null, h('span', { class: 'dm-graph-swatch', style: { background: colorOf(l.name) } }), h('button', { type: 'button', class: 'dm-link', text: `${l.name || t('graph.nolabel')} · ${i18n.formatNumber(l.count)}`, onclick: async () => { const nodes = await graph.nodes(s.id, { label: l.name, limit: FOCUS_LIMIT }); s.focus = nodes.map((n) => n.id); s.mode = 'focus'; draw(); } })))));
          if (s.info.types && s.info.types.length) items.push(h('h4', { text: t('graph.types') }), h('ul', { class: 'dm-map-legend-list dm-graph-legend' }, s.info.types.slice(0, 40).map((l) => h('li', null, h('span', { class: 'dm-truncate', text: `${l.name || t('graph.notype')} · ${i18n.formatNumber(l.count)}` })))));
        }
        items.push(h('p', { class: 'dm-help dm-xs', text: t(s.mode === 'whole' ? 'graph.help.whole' : s.mode === 'focus' ? 'graph.help.focus' : 'graph.help.overview') }));
        replace(slots.right, h('div', { class: 'dm-inspector dm-stack' }, items));
      }
      async function doSearch() {
        const text = s.search.trim();
        if (!text) { s.hits = []; renderInspector(); return; }
        s.hits = await graph.nodes(s.id, { search: text, limit: 50 });
        if (!s.hits.length) ui.toast.show(t('graph.search.none'), { kind: 'info' });
        renderInspector();
      }

      return { render, destroy, state: s, ensureCytoscape, ensureSigma };
    }
    return { create, ensureCytoscape, ensureSigma, LAYOUTS };
  });
})();
