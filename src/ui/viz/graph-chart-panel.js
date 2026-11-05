// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph charts in Visualisera: a graph dataset drawn by viz/graph-draw with the chosen view (overview per label,
 * focus on chosen nodes, whole graph), layout and labels; the live drawing on the right, the legend and the selected
 * node in the inspector. Export and thumbnails are SVGs drawn headless from the node positions.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/graph-chart-panel', ['ui/base', 'ui/basic', 'viz/graph-draw', 'data/graph', 'data/datasets', 'viz/export'], (base, basic, draw, graph, datasets, vizExport) => {
    const { h, t, i18n, replace } = base;

    const select = basic.select;
    function toggle(label, checked, onChange) { const el = /** @type {any} */ (h('dm-switch', { label })); el.checked = checked; el.addEventListener('change', () => onChange(el.checked)); return el; }

    /**
     * @param {{chart: any, onChange: (def: any) => void, log: Function, onInspect?: () => void}} options
     */
    function create(options) {
      const { chart } = options;
      if (!chart.graph) chart.graph = draw.defaultDef({ id: chart.datasetId, name: chart.datasetName });
      const def = chart.graph;
      if (!def.datasetId) def.datasetId = chart.datasetId;
      const el = h('div', { class: 'dm-viz-layout' });
      const side = h('div', { class: 'dm-viz-side dm-stack' });
      const preview = h('div', { class: 'dm-chart-preview dm-graph-view dm-graph-preview' });
      const info = h('p', { class: 'dm-help' });
      replace(el, side, h('div', { class: 'dm-viz-main' }, preview, info));
      let handle = null; let seq = 0; let timer = 0; let selected = null; let search = ''; let hits = [];
      let graphs = [];
      datasets.list().then((list) => { graphs = list.filter((d) => d.kind === 'graph'); renderSide(); }).catch(() => {});

      const changed = (redraw = true) => { options.onChange(def); if (redraw) schedule(); };
      function schedule(delay = 300) { clearTimeout(timer); timer = setTimeout(drawNow, delay); }
      async function drawNow() {
        const my = ++seq;
        if (handle) { handle.destroy(); handle = null; }
        if (!def.datasetId) { replace(preview, h('p', { class: 'dm-help', text: t('graph.chart.pick') })); return; }
        preview.replaceChildren();
        try {
          const hd = await draw.render(preview, def, { onSelect: (sel) => { selected = sel; if (options.onInspect) options.onInspect(); }, onFocus: (ids) => { def.focus = ids; def.mode = 'focus'; changed(); } });
          if (my !== seq) { hd.destroy(); return; }
          handle = hd;
          info.textContent = `${t('graph.nodes.n', { n: i18n.formatNumber(hd.info.nodes || 0) })} · ${t('graph.edges.n', { n: i18n.formatNumber(hd.info.edges || 0) })}`;
          if (options.onInspect) options.onInspect();
        } catch (err) { replace(preview, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); options.log(String((err && err.message) || err), 'error'); }
      }
      function renderSide() {
        const nodes = [];
        nodes.push(select(t('graph.chart.dataset'), [{ value: '', label: '–' }].concat(graphs.map((g) => ({ value: g.id, label: g.name }))), def.datasetId || '', (v) => { def.datasetId = v; const g = graphs.find((x) => x.id === v); def.datasetName = g ? g.name : ''; def.focus = []; chart.datasetId = v; chart.datasetName = def.datasetName; changed(); }));
        nodes.push(select(t('graph.mode'), draw.MODES.map((m) => ({ value: m, label: t('graph.mode.' + m) })), def.mode || 'overview', (v) => { def.mode = v; changed(); renderSide(); }));
        nodes.push(select(t('graph.layout'), draw.LAYOUTS.map((l) => ({ value: l, label: t('graph.layout.' + l) })), def.layout || 'fcose', (v) => { def.layout = v; changed(); }));
        nodes.push(toggle(t('graph.labels.show'), def.labels !== false, (v) => { def.labels = v; changed(false); if (handle) handle.setLabels(v); }));
        if (def.mode === 'focus') {
          const inp = /** @type {any} */ (h('dm-input', { label: t('graph.search'), placeholder: t('graph.search.placeholder') }));
          inp.value = search; inp.addEventListener('input', () => { search = inp.value; });
          inp.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') findNodes(); });
          nodes.push(h('div', { class: 'dm-row' }, inp, basic.button({ label: t('common.search'), icon: 'search', size: 'sm', onClick: findNodes })));
          if (hits.length) nodes.push(h('div', { class: 'dm-list' }, hits.slice(0, 20).map((n) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => { def.focus = Array.from(new Set((def.focus || []).concat([n.id]))); hits = []; changed(); renderSide(); } }, h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: n.name || n.id }), h('span', { class: 'dm-list-sub dm-truncate', text: n.label || t('graph.nolabel') }))))));
          nodes.push(h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-xs', text: t('graph.focus.n', { n: i18n.formatNumber((def.focus || []).length) }) }), basic.button({ label: t('graph.focus.expand'), icon: 'plus', size: 'sm', disabled: !(def.focus || []).length, onClick: async () => { if (handle) { const grew = await handle.expandNeighbours((def.focus || []).slice(0, 50)); if (!grew) options.log(t('graph.focus.nomore'), 'info'); } } }), basic.button({ label: t('graph.focus.clear'), icon: 'x', size: 'sm', onClick: () => { def.focus = []; changed(); renderSide(); } })));
        }
        nodes.push(basic.button({ label: t('graph.layout.save'), icon: 'save', size: 'sm', title: t('graph.layout.save.hint'), onClick: async () => { if (!handle) return; const pos = handle.positions(); if (pos.length) { await graph.layoutSet(def.datasetId, pos); options.log(t('graph.layout.saved', { n: i18n.formatNumber(pos.length) }), 'ok'); } } }));
        nodes.push(h('p', { class: 'dm-help dm-xs', text: t('graph.chart.hint') }));
        replace(side, nodes);
      }
      async function findNodes() { if (!def.datasetId || !search.trim()) { hits = []; renderSide(); return; } hits = await graph.nodes(def.datasetId, { search: search.trim(), limit: 20 }); renderSide(); }

      /** Export the chart: SVG from the live positions when drawn, else headless. */
      async function exportBlob(format, opts = {}) {
        if (handle && handle.cy) { const svgText = await handle.svg(); if (format === 'png') return vizExport.svgToPng(svgText, { scale: opts.scale || 2 }); if (format === 'pdf') return vizExport.svgToPdf(svgText, { title: chart.name }); return vizExport.svgBlob(await vizExport.svgWithFonts(svgText)); }
        return draw.toBlob(chart, format, opts);
      }
      async function thumbnail() {
        try {
          const blob = await exportBlob('png', { scale: 0.5 });
          return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
        } catch (_e) { return chart.thumbnail || null; }
      }
      function inspector() {
        const items = [h('h4', { text: t('graph.labels') })];
        if (handle) items.push(h('ul', { class: 'dm-map-legend-list dm-graph-legend' }, handle.legend.slice(0, 40).map((l) => h('li', null, h('span', { class: 'dm-graph-swatch', style: { background: l.color } }), h('span', { class: 'dm-truncate', text: `${l.label || t('graph.nolabel')} · ${i18n.formatNumber(l.count)}` })))));
        if (selected) {
          const d = selected.data; const kv = /** @type {any} */ (h('dm-kv')); const props = graph.parseProps(d.egenskaper);
          kv.items = (selected.kind === 'node' ? [{ label: t('graph.field.id'), value: d.id }, { label: t('graph.field.label'), value: d.etikett || t('graph.nolabel') }, { label: t('common.name'), value: d.namn || '' }] : [{ label: t('graph.field.type'), value: d.typ || t('graph.notype') }, { label: t('graph.field.source'), value: d.source }, { label: t('graph.field.target'), value: d.target }]).concat(Object.entries(props).map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) })));
          items.push(h('h4', { text: t(selected.kind === 'node' ? 'graph.selected.node' : 'graph.selected.edge') }), kv);
        }
        return h('div', { class: 'dm-stack' }, items);
      }
      renderSide();
      schedule(0);
      return { el, exportBlob, thumbnail, inspector, destroy: () => { clearTimeout(timer); seq++; if (handle) { handle.destroy(); handle = null; } }, redraw: () => schedule(0) };
    }
    return { create };
  });
})();
