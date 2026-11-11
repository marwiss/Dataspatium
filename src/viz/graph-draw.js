// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Drawing of graph datasets, shared by the graph view in Bearbeta and graph charts in Visualisera, dashboards and
 * Publicera. A definition `def` says what to draw: {datasetId, mode: 'overview'|'focus'|'whole', focus: [node ids],
 * layout: 'fcose'|'dagre'|'grid'|'circle'|'concentric', labels: true, height}. The overview groups nodes by label
 * (Cytoscape with expand-collapse) up to data/graph.MAX_VIEW elements, otherwise one node per label with edge counts;
 * the focus draws a subgraph that grows by neighbourhoods; the whole graph is drawn with sigma (WebGL) from the
 * positions in `_layout`. Export draws an SVG from positions (own writer: cytoscape-svg is GPL), headless when
 * needed. The libraries are vendored classic scripts (MIT) loaded on first use.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/graph-draw', ['data/graph', 'data/datasets', 'viz/export'], (graph, datasets, vizExport) => {
    const CY_SCRIPTS = ['vendor/cytoscape/cytoscape.min.js', 'vendor/layout-base/layout-base.js', 'vendor/cose-base/cose-base.js', 'vendor/cytoscape-fcose/cytoscape-fcose.js', 'vendor/cytoscape-dagre/cytoscape-dagre.js', 'vendor/cytoscape-expand-collapse/cytoscape-expand-collapse.js'];
    const SIGMA_SCRIPTS = ['vendor/graphology/graphology.umd.min.js', 'vendor/sigma/sigma.min.js'];
    const LAYOUTS = ['fcose', 'dagre', 'grid', 'circle', 'concentric'];
    const MODES = ['overview', 'focus', 'whole'];
    const FOCUS_LIMIT = 2000;
    let cyLoading = null; let sigmaLoading = null;
    const t = (k, p) => D.t(k, p);
    const fmt = (n) => D.require('ui/i18n').formatNumber(n);

    /** Load the Cytoscape scripts in order and register the extensions once. */
    function ensureCytoscape() {
      if (globalThis.cytoscape && globalThis.cytoscape.__dmReady) return Promise.resolve(globalThis.cytoscape);
      if (!cyLoading) {
        cyLoading = CY_SCRIPTS.reduce((p, path) => p.then(() => D.assets.loadVendorScript(path)), Promise.resolve()).then(() => {
          const cy = globalThis.cytoscape;
          if (!cy) throw new Error(t('graph.err.load'));
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
      if (!sigmaLoading) sigmaLoading = SIGMA_SCRIPTS.reduce((p, path) => p.then(() => D.assets.loadVendorScript(path)), Promise.resolve()).then(() => { if (!globalThis.Sigma || !globalThis.graphology) throw new Error(t('graph.err.load')); return true; }).catch((err) => { sigmaLoading = null; throw err; });
      return sigmaLoading;
    }
    /** The app's categorical palette from the design tokens. */
    function palette() {
      const cs = getComputedStyle(document.documentElement); const out = [];
      for (let i = 1; i <= 12; i++) { const v = cs.getPropertyValue(`--dm-cat-${i}`).trim(); if (!v) break; out.push(v); }
      return out.length ? out : ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#56b4e9', '#cc79a7', '#f0e442', '#999999'];
    }
    const token = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    /** A colour map label → colour, in the order of the summary's labels (largest first). */
    function colorMap(info) {
      const map = new Map(); const p = palette();
      for (const l of (info && info.labels) || []) { const key = l.name || ''; if (!map.has(key)) map.set(key, p[map.size % p.length]); }
      return { colors: map, of: (label) => { const key = label || ''; if (!map.has(key)) map.set(key, p[map.size % p.length]); return map.get(key); } };
    }
    /** Default definition for a graph dataset. */
    function defaultDef(dataset) {
      return { datasetId: dataset.id, datasetName: dataset.name, mode: 'overview', layout: 'fcose', labels: true, focus: [], height: null };
    }

    const nodeEl = (n) => ({ data: { id: n.id, namn: n.name || n.id, etikett: n.label || '', egenskaper: n.properties, kind: 'node' } });
    const edgeEl = (e) => ({ data: { id: 'e:' + e.id, source: e.source, target: e.target, typ: e.type || '', egenskaper: e.properties, kind: 'edge' } });
    function styleSheet(colors, labels, directed) {
      const text = token('--dm-text', '#222'); const border = token('--dm-border', '#999'); const surface = token('--dm-surface', '#fff'); const accent = token('--dm-accent', '#0072b2');
      const groupStyle = { 'shape': 'round-rectangle', 'width': 'label', 'height': 34, 'padding': '10px', 'background-color': (ele) => colors.of(ele.data('etikett')), 'background-opacity': 0.9, 'color': surface, 'label': 'data(namn)', 'text-valign': 'center', 'font-size': 12, 'font-weight': 600, 'border-width': 0, 'min-zoomed-font-size': 0 };
      return [
        { selector: 'node', style: { 'background-color': (ele) => colors.of(ele.data('etikett')), 'label': labels ? 'data(namn)' : '', 'font-size': 10, 'color': text, 'text-wrap': 'ellipsis', 'text-max-width': '120px', 'text-valign': 'bottom', 'text-margin-y': 4, 'width': 22, 'height': 22, 'border-width': 1, 'border-color': border, 'min-zoomed-font-size': 8 } },
        { selector: 'node:parent', style: { 'background-opacity': 0.08, 'background-color': (ele) => colors.of(ele.data('etikett')), 'border-color': (ele) => colors.of(ele.data('etikett')), 'border-width': 1.5, 'label': 'data(namn)', 'text-valign': 'top', 'font-weight': 600, 'font-size': 12 } },
        { selector: 'node.cy-expand-collapse-collapsed-node', style: groupStyle },
        { selector: 'node.dm-group', style: groupStyle },
        { selector: 'edge', style: { 'width': (ele) => Math.min(8, 1 + Math.log2(1 + (Number(ele.data('antal')) || 1))), 'line-color': border, 'target-arrow-color': border, 'target-arrow-shape': directed === false ? 'none' : 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier', 'label': labels ? 'data(typ)' : '', 'font-size': 8, 'color': text, 'text-rotation': 'autorotate', 'text-background-color': surface, 'text-background-opacity': 0.8, 'text-background-padding': '1px', 'min-zoomed-font-size': 9 } },
        { selector: ':selected', style: { 'border-width': 3, 'border-color': accent, 'line-color': accent, 'target-arrow-color': accent } },
      ];
    }
    function layoutOptions(name) {
      if (name === 'fcose') return { name: 'fcose', quality: 'default', animate: false, randomize: true, nodeRepulsion: 6000, idealEdgeLength: 70, nodeSeparation: 100 };
      if (name === 'dagre') return { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 60, animate: false };
      return { name: LAYOUTS.includes(name) ? name : 'grid', animate: false, avoidOverlap: true, padding: 20 };
    }
    /** Deterministic placement for a node without a cached position: labels on a ring, members in a disc. */
    function ringPlacer(labels, counts) {
      const perLabel = new Map(); const R = 100 + 60 * Math.sqrt(labels.length);
      return (label) => { const li = labels.indexOf(label); const k = perLabel.get(label) || 0; perLabel.set(label, k + 1); const total = counts.get(label) || 1; const r = 10 + 4 * Math.sqrt(total); const ang = (2 * Math.PI * li) / Math.max(1, labels.length); const a2 = k * 2.399963; const rr = r * Math.sqrt(k / Math.max(1, total)); return [R * Math.cos(ang) + rr * Math.cos(a2), R * Math.sin(ang) + rr * Math.sin(a2)]; };
    }

    /**
     * Draw a graph definition into a container. Returns a handle with the drawing, legend and export functions.
     * @param {HTMLElement} container @param {any} def
     * @param {{onSelect?: (sel: any) => void, onFocus?: (ids: string[]) => void, onBusy?: (busy: boolean) => void}} [options]
     */
    async function render(container, def, options = {}) {
      const info = await graph.summary(def.datasetId);
      const meta = await datasets.get(def.datasetId);
      const colors = colorMap(info);
      const directed = info.directed !== false;
      const h = { mode: def.mode || 'overview', cy: null, ec: null, sigma: null, info, legend: (info.labels || []).map((l) => ({ label: l.name || '', color: colors.of(l.name), count: l.count })), colors, graphData: null, destroyed: false };
      container.replaceChildren();
      const select = (sel) => { if (options.onSelect) options.onSelect(sel); };
      async function mountCy(elements) {
        await ensureCytoscape();
        if (h.destroyed) return null;
        container.replaceChildren();
        h.cy = globalThis.cytoscape({ container, elements, style: styleSheet(colors, def.labels !== false, directed), wheelSensitivity: 0.3, minZoom: 0.05, maxZoom: 6 });
        h.cy.on('tap', 'node, edge', (ev) => { const d = ev.target.data(); if (d.kind === 'node' || d.kind === 'edge') select({ kind: d.kind, id: d.kind === 'edge' ? String(d.id).slice(2) : d.id, data: d }); });
        h.cy.on('tap', (ev) => { if (ev.target === h.cy) select(null); });
        return h.cy;
      }
      async function runLayout(name) {
        if (!h.cy) return;
        const cached = await graph.layoutGet(def.datasetId).catch(() => new Map());
        const movable = h.cy.nodes().filter((n) => !n.isParent());
        let used = 0;
        if ((name || def.layout) === 'fcose' && cached.size) movable.forEach((n) => { const p = cached.get(n.id()); if (p) { n.position({ x: p[0], y: p[1] }); used++; } });
        if (used && used === movable.length) { h.cy.fit(undefined, 30); return; }
        try { h.cy.layout(layoutOptions(name || def.layout)).run(); } catch (_e) { h.cy.layout({ name: 'grid', animate: false }).run(); }
        h.cy.fit(undefined, 30);
      }
      async function drawOverview() {
        const small = (info.nodes || 0) + (info.edges || 0) <= graph.MAX_VIEW;
        if (small) {
          const g = await graph.whole(def.datasetId); h.graphData = g;
          const labels = Array.from(new Set(g.nodes.map((n) => n.label || '')));
          const elements = labels.map((l) => ({ data: { id: 'grp:' + l, namn: `${l || t('graph.nolabel')} (${fmt(g.nodes.filter((n) => (n.label || '') === l).length)})`, etikett: l, kind: 'group' } }))
            .concat(g.nodes.map((n) => { const el = nodeEl(n); el.data.parent = 'grp:' + (n.label || ''); return el; }))
            .concat(g.edges.map(edgeEl));
          await mountCy(elements);
          if (!h.cy) return;
          // The extension lays out again a moment after a collapse or an expand (setTimeout 0): by then the view may be gone, and a
          // layout on a destroyed core throws from inside cytoscape (seen in Firefox when the person leaves the graph at once).
          const rearrange = () => { if (h.destroyed || !h.cy || h.cy.destroyed()) return; h.cy.layout(layoutOptions(def.layout)).run(); };
          h.ec = h.cy.expandCollapse({ layoutBy: rearrange, fisheye: false, animate: false, undoable: false, cueEnabled: false, groupEdgesOfSameTypeOnCollapse: true, allowNestedEdgeCollapse: false, zIndex: 999 });
          h.cy.layout(layoutOptions(def.layout)).run();
          if (labels.length > 1 || g.nodes.length > 60) h.ec.collapseAll();
          h.cy.on('dbltap', 'node', (ev) => { const n = ev.target; if (h.ec.isCollapsible(n)) h.ec.collapse(n); else if (h.ec.isExpandable(n)) h.ec.expand(n); });
          h.cy.fit(undefined, 30);
          return;
        }
        const handle = await datasets.ensureOpen(def.datasetId);
        const res = await handle.engine.exec("select coalesce(a.etikett, '') as fran, coalesce(b.etikett, '') as till, count(*) as antal from _edges e join data a on a.id = e.kalla join data b on b.id = e.mal group by 1, 2 order by antal desc limit 400");
        const pairs = res[0] ? res[0].values : [];
        const elements = (info.labels || []).map((l) => ({ data: { id: 'grp:' + (l.name || ''), namn: `${l.name || t('graph.nolabel')} (${fmt(l.count)})`, etikett: l.name || '', kind: 'label', count: l.count }, classes: 'dm-group' }))
          .concat(pairs.map((p, i) => ({ data: { id: 'pe:' + i, source: 'grp:' + p[0], target: 'grp:' + p[1], typ: fmt(p[2]), antal: p[2], kind: 'pair' } })));
        await mountCy(elements);
        if (!h.cy) return;
        h.cy.on('dbltap', 'node', async (ev) => { const label = ev.target.data('etikett'); const nodes = await graph.nodes(def.datasetId, { label, limit: FOCUS_LIMIT }); if (options.onFocus) options.onFocus(nodes.map((n) => n.id)); });
        h.cy.layout({ name: 'circle', animate: false, padding: 30 }).run();
        h.cy.fit(undefined, 30);
      }
      async function drawFocus() {
        const ids = (def.focus || []).slice(0, FOCUS_LIMIT);
        if (!ids.length) { container.replaceChildren(Object.assign(document.createElement('div'), { className: 'dm-graph-empty', textContent: t('graph.focus.empty') })); return; }
        const sub = await graph.subgraph(def.datasetId, ids); h.graphData = sub;
        await mountCy(sub.nodes.map(nodeEl).concat(sub.edges.map(edgeEl)));
        if (!h.cy) return;
        h.cy.on('dbltap', 'node', (ev) => h.expandNeighbours([ev.target.id()]));
        await runLayout();
      }
      async function drawWhole() {
        await ensureSigma();
        if (h.destroyed) return;
        container.replaceChildren();
        const g = await graph.whole(def.datasetId); h.graphData = g;
        const cached = await graph.layoutGet(def.datasetId).catch(() => new Map());
        const G = new globalThis.graphology.Graph({ multi: true, type: directed ? 'directed' : 'undirected' });
        const labels = Array.from(new Set(g.nodes.map((n) => n.label || '')));
        const counts = new Map(); for (const n of g.nodes) counts.set(n.label || '', (counts.get(n.label || '') || 0) + 1);
        const place = ringPlacer(labels, counts); const fresh = [];
        for (const n of g.nodes) {
          let p = cached.get(n.id);
          if (!p) { p = place(n.label || ''); fresh.push([n.id, p[0], p[1]]); }
          G.addNode(n.id, { x: p[0], y: p[1], size: 3, label: n.name || n.id, color: colors.of(n.label) });
        }
        for (const e of g.edges) if (G.hasNode(e.source) && G.hasNode(e.target)) G.addEdgeWithKey('e:' + e.id, e.source, e.target, { label: e.type || '', color: token('--dm-border', '#bbb'), size: 0.6 });
        if (fresh.length) graph.layoutSet(def.datasetId, fresh).catch(() => {});
        h.sigma = new globalThis.Sigma(G, container, { renderLabels: def.labels !== false, labelRenderedSizeThreshold: 8, labelDensity: 0.1, labelFont: token('--dm-font-sans', 'sans-serif'), labelColor: { color: token('--dm-text', '#222') }, defaultEdgeType: directed ? 'arrow' : 'line', minCameraRatio: 0.02, maxCameraRatio: 20 });
        h.sigma.on('clickNode', ({ node }) => { const n = g.nodes.find((x) => x.id === node); if (n) select({ kind: 'node', id: n.id, data: { id: n.id, namn: n.name, etikett: n.label, egenskaper: n.properties } }); });
        h.sigma.on('clickStage', () => select(null));
      }
      h.expandNeighbours = async (ids) => {
        const before = (def.focus || []).length;
        const more = await graph.neighborhood(def.datasetId, ids, 1, FOCUS_LIMIT);
        const next = Array.from(new Set((def.focus || []).concat(more))).slice(0, FOCUS_LIMIT);
        if (next.length === before) return false;
        if (options.onFocus) options.onFocus(next);
        return true;
      };
      h.fit = () => { if (h.cy) h.cy.fit(undefined, 30); if (h.sigma) h.sigma.getCamera().animatedReset(); };
      h.setLabels = (on) => { if (h.cy) { h.cy.style().selector('node').style('label', on ? 'data(namn)' : '').update(); h.cy.style().selector('edge').style('label', on ? 'data(typ)' : '').update(); } if (h.sigma) h.sigma.setSetting('renderLabels', on); };
      h.runLayout = runLayout;
      /** Positions of the drawn nodes: [id, x, y]. */
      h.positions = () => {
        if (h.cy) return h.cy.nodes().filter((n) => !n.isParent() && n.data('kind') === 'node').map((n) => [n.id(), Math.round(n.position('x') * 100) / 100, Math.round(n.position('y') * 100) / 100]);
        if (h.sigma) { const G = h.sigma.getGraph(); return G.nodes().map((id) => [id, G.getNodeAttribute(id, 'x'), G.getNodeAttribute(id, 'y')]); }
        return [];
      };
      h.svg = async () => svgFor(h.graphData || await graph.whole(def.datasetId), new Map(h.positions().map((p) => [p[0], [p[1], p[2]]])), colors, { labels: def.labels !== false, directed, title: def.datasetName });
      h.png = async (scale = 2) => vizExport.svgToPng(await h.svg(), { scale });
      h.destroy = () => { h.destroyed = true; if (h.cy) { try { h.cy.destroy(); } catch (_e) { /* ignore */ } h.cy = null; h.ec = null; } if (h.sigma) { try { h.sigma.kill(); } catch (_e) { /* ignore */ } h.sigma = null; } };
      if (options.onBusy) options.onBusy(true);
      try {
        if (h.mode === 'whole') await drawWhole();
        else if (h.mode === 'focus') await drawFocus();
        else await drawOverview();
      } finally { if (options.onBusy) options.onBusy(false); }
      h.meta = meta;
      return h;
    }

    /**
     * Draw a graph held in memory, such as a query's answer from a server, with nothing stored. The nodes are coloured by `colorKey` and the
     * drawing can grow without moving what is already placed more than the layout needs.
     * @param {HTMLElement} container @param {{nodes: any[], edges: any[], directed?: boolean}} g
     * @param {{layout?: string, labels?: boolean, colorKey?: (node: any) => string, onSelect?: (sel: any) => void, onExpand?: (id: string) => void}} [options]
     * @returns {Promise<any>} handle with cy, legend(), merge(g, anchor), fit(), setLabels(on), runLayout(name), destroy()
     */
    async function renderLive(container, g, options = {}) {
      await ensureCytoscape();
      const keyOf = options.colorKey || ((n) => n.label || '');
      const count = new Map();
      const tally = (nodes) => { for (const n of nodes) { const k = keyOf(n); count.set(k, (count.get(k) || 0) + 1); } };
      tally(g.nodes);
      const colors = colorMap({ labels: Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => ({ name })) });
      const liveNode = (n) => { const el = nodeEl(n); el.data.klass = n.label || ''; el.data.etikett = keyOf(n); return el; };
      container.replaceChildren();
      const h = { cy: null, layout: options.layout || 'fcose', destroyed: false };
      h.cy = globalThis.cytoscape({ container, elements: g.nodes.map(liveNode).concat(g.edges.map(edgeEl)), style: styleSheet(colors, options.labels !== false, g.directed !== false), wheelSensitivity: 0.3, minZoom: 0.05, maxZoom: 6 });
      const picked = (d) => (d.kind === 'edge' ? { kind: 'edge', id: String(d.id).slice(2), data: d } : { kind: 'node', id: d.id, data: Object.assign({}, d, { etikett: d.klass }) });
      h.cy.on('tap', 'node, edge', (ev) => { if (options.onSelect) options.onSelect(picked(ev.target.data())); });
      h.cy.on('tap', (ev) => { if (ev.target === h.cy && options.onSelect) options.onSelect(null); });
      h.cy.on('dbltap', 'node', (ev) => { if (options.onExpand) options.onExpand(ev.target.id()); });
      /** Run a layout; a force layout that continues from where the nodes stand keeps the picture recognisable when it grows. */
      h.runLayout = (name, keepPlaces) => {
        if (name) h.layout = name;
        const opts = layoutOptions(h.layout);
        if (keepPlaces && h.layout === 'fcose') opts.randomize = false;
        try { h.cy.layout(opts).run(); } catch (_e) { h.cy.layout({ name: 'grid', animate: false }).run(); }
        h.cy.fit(undefined, 30);
      };
      /** Add what is new in a graph; new nodes start beside the node they were asked from. Returns how many elements were added. */
      h.merge = (more, anchor) => {
        const start = anchor && h.cy.getElementById(anchor).nonempty() ? h.cy.getElementById(anchor).position() : { x: 0, y: 0 };
        const nodes = more.nodes.filter((n) => h.cy.getElementById(n.id).empty());
        const fresh = nodes.map((n, i) => Object.assign(liveNode(n), { position: { x: start.x + 40 * Math.cos(i * 2.399963), y: start.y + 40 * Math.sin(i * 2.399963) } }));
        tally(nodes);
        const links = more.edges.filter((e) => h.cy.getElementById('e:' + e.id).empty()).map(edgeEl);
        if (!fresh.length && !links.length) return 0;
        h.cy.add(fresh.concat(links));
        h.runLayout(null, true);
        return fresh.length + links.length;
      };
      h.legend = () => Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, color: colors.of(key), count: n }));
      h.fit = () => h.cy.fit(undefined, 30);
      h.setLabels = (on) => { h.cy.style().selector('node').style('label', on ? 'data(namn)' : '').update(); h.cy.style().selector('edge').style('label', on ? 'data(typ)' : '').update(); };
      h.destroy = () => { h.destroyed = true; if (h.cy) { try { h.cy.destroy(); } catch (_e) { /* ignore */ } h.cy = null; } };
      h.runLayout();
      return h;
    }

    // ---- SVG from positions (own writer) ---------------------------------------------------------------------------
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    /**
     * SVG of a graph from node positions: circles coloured by label, lines (arrows when directed), labels when asked.
     * @param {{nodes: any[], edges: any[]}} g @param {Map<string, [number, number]>} positions @param {{of: Function}} colors
     * @param {{width?: number, height?: number, labels?: boolean, directed?: boolean, title?: string}} [options]
     */
    function svgFor(g, positions, colors, options = {}) {
      const W = options.width || 960; const Hh = options.height || 640; const pad = 30;
      const pts = g.nodes.map((n) => positions.get(n.id)).filter(Boolean);
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1), minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
      const sx = (W - 2 * pad) / Math.max(1e-9, maxX - minX); const sy = (Hh - 2 * pad) / Math.max(1e-9, maxY - minY); const s = Math.min(sx, sy);
      const X = (x) => pad + (x - minX) * s + ((W - 2 * pad) - (maxX - minX) * s) / 2; const Y = (y) => pad + (y - minY) * s + ((Hh - 2 * pad) - (maxY - minY) * s) / 2;
      const r = Math.max(2, Math.min(9, 400 / Math.sqrt(Math.max(1, g.nodes.length))));
      const text = token('--dm-text', '#222'); const border = token('--dm-border', '#999'); const font = token('--dm-font-sans', 'sans-serif');
      const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="${esc(font)}">`];
      if (options.title) out.push(`<title>${esc(options.title)}</title>`);
      out.push(`<rect width="${W}" height="${Hh}" fill="${esc(token('--dm-surface', '#fff'))}"/>`);
      if (options.directed !== false) out.push(`<defs><marker id="dm-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${esc(border)}"/></marker></defs>`);
      out.push(`<g stroke="${esc(border)}" stroke-width="1" fill="none">`);
      for (const e of g.edges) {
        const a = positions.get(e.source); const b = positions.get(e.target); if (!a || !b) continue;
        const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]);
        const d = Math.hypot(x2 - x1, y2 - y1) || 1; const ex = x2 - ((x2 - x1) / d) * (r + 2); const ey = y2 - ((y2 - y1) / d) * (r + 2);
        out.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"${options.directed !== false ? ' marker-end="url(#dm-arrow)"' : ''}/>`);
      }
      out.push('</g><g>');
      for (const n of g.nodes) { const p = positions.get(n.id); if (!p) continue; out.push(`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${r}" fill="${esc(colors.of(n.label))}" stroke="${esc(border)}" stroke-width="0.8"><title>${esc(n.name || n.id)}</title></circle>`); }
      out.push('</g>');
      if (options.labels !== false && g.nodes.length <= 400) {
        out.push(`<g font-size="10" fill="${esc(text)}" text-anchor="middle">`);
        for (const n of g.nodes) { const p = positions.get(n.id); if (!p) continue; out.push(`<text x="${X(p[0]).toFixed(1)}" y="${(Y(p[1]) + r + 11).toFixed(1)}">${esc(String(n.name || n.id).slice(0, 40))}</text>`); }
        out.push('</g>');
      }
      out.push('</svg>');
      return out.join('');
    }
    /** Positions for a definition without a live drawing: cached layout, else a headless Cytoscape layout (small graphs) or the ring placement. */
    async function headlessPositions(def, g) {
      const cached = await graph.layoutGet(def.datasetId).catch(() => new Map());
      if (g.nodes.every((n) => cached.has(n.id))) return cached;
      if (g.nodes.length + g.edges.length <= graph.MAX_VIEW) {
        try {
          await ensureCytoscape();
          const cy = globalThis.cytoscape({ headless: true, styleEnabled: true, elements: g.nodes.map(nodeEl).concat(g.edges.map(edgeEl)) });
          cy.layout(Object.assign(layoutOptions(def.layout || 'fcose'), { animate: false })).run();
          const out = new Map(); cy.nodes().forEach((n) => out.set(n.id(), [n.position('x'), n.position('y')]));
          cy.destroy();
          return out;
        } catch (_e) { /* fall through to the ring */ }
      }
      const labels = Array.from(new Set(g.nodes.map((n) => n.label || ''))); const counts = new Map(); for (const n of g.nodes) counts.set(n.label || '', (counts.get(n.label || '') || 0) + 1);
      const place = ringPlacer(labels, counts); const out = new Map();
      for (const n of g.nodes) out.set(n.id, cached.get(n.id) || place(n.label || ''));
      return out;
    }
    /** The graph a definition shows: the focus subgraph or the whole graph. */
    async function graphFor(def) {
      if (def.mode === 'focus' && def.focus && def.focus.length) return graph.subgraph(def.datasetId, def.focus.slice(0, FOCUS_LIMIT));
      return graph.whole(def.datasetId);
    }
    /** SVG text for a definition, headless. */
    async function toSvg(def, options = {}) {
      const g = await graphFor(def);
      const info = await graph.summary(def.datasetId);
      const positions = await headlessPositions(def, g);
      return svgFor(g, positions, colorMap(info), { width: options.width, height: options.height, labels: def.labels !== false, directed: info.directed !== false, title: options.title || def.datasetName });
    }
    /** Export a graph chart headless to SVG, PNG or PDF. */
    async function toBlob(chart, format, options = {}) {
      const svgText = await toSvg(chart.graph, { width: options.width || 960, height: options.height || 640, title: chart.name });
      if (format === 'png') return vizExport.svgToPng(svgText, { scale: options.scale || 2 });
      if (format === 'pdf') return vizExport.svgToPdf(svgText, { title: chart.name });
      return vizExport.svgBlob(await vizExport.svgWithFonts(svgText));
    }
    /** HTML for a published page or dashboard: the drawing as inline SVG (no libraries needed). */
    async function htmlFor(id, chart, options = {}) {
      const svg = await toSvg(chart.graph, { width: options.width || 960, height: options.height || 560, title: chart.name });
      return `<div id="${esc(id)}" class="dm-graph-html">${svg}</div>`;
    }

    return { LAYOUTS, MODES, FOCUS_LIMIT, ensureCytoscape, ensureSigma, palette, colorMap, defaultDef, render, renderLive, svgFor, toSvg, toBlob, htmlFor, layoutOptions };
  });
})();
