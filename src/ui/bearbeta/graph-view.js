// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph view in Bearbeta for graph datasets: the drawing of viz/graph-draw (overview per label, focus that grows by
 * neighbourhoods, whole graph with sigma) with the toolbar (view, layout, labels, fit, save layout, save as chart,
 * table), the inspector (search, legend, the selected node or edge) and editing: add, change and remove nodes and
 * edges, connect two nodes, merge nodes, relabel. Every edit is a recipe step (data/graph-ops through data/recipes),
 * logged and undoable; the view redraws when the dataset changes.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/graph-view', ['ui/base', 'data/datasets', 'data/graph', 'viz/graph-draw', 'data/recipes', 'viz/charts', 'data/graph-ops'], (base, datasets, graph, draw, recipes, charts) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {any} ctx shell context @param {{onTable: () => void, onChanged?: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, def: null, selected: null, search: '', hits: [], info: null, busy: '', error: '', count: { nodes: 0, edges: 0 }, picked: [] };
      let ds = null; let slots = null; let handle = null; let canvasEl = null; let seq = 0;

      async function load(dataset) {
        if (s.id !== dataset.id) { s.id = dataset.id; s.def = draw.defaultDef(dataset); s.selected = null; s.search = ''; s.hits = []; s.picked = []; s.error = ''; }
        ds = dataset; s.def.datasetName = dataset.name;
        s.info = await graph.summary(dataset.id);
        s.count = { nodes: s.info.nodes || dataset.rowCount || 0, edges: s.info.edges || 0 };
      }
      function destroy() { seq++; if (handle) { handle.destroy(); handle = null; } canvasEl = null; slots = null; }

      /** @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        await load(dataset);
        if (my !== seq || !slots) return;
        const modeSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('graph.mode'), inline: true }));
        modeSel.options = draw.MODES.map((m) => ({ value: m, label: t('graph.mode.' + m) }));
        modeSel.value = s.def.mode;
        modeSel.addEventListener('change', () => { s.def.mode = modeSel.value; redraw(); });
        const layoutSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('graph.layout'), inline: true }));
        layoutSel.options = draw.LAYOUTS.map((l) => ({ value: l, label: t('graph.layout.' + l) }));
        layoutSel.value = s.def.layout;
        layoutSel.addEventListener('change', () => { s.def.layout = layoutSel.value; if (handle && handle.cy) handle.runLayout(s.def.layout); else redraw(); });
        const labels = /** @type {any} */ (h('dm-switch', { label: t('graph.labels.show') }));
        labels.checked = s.def.labels !== false;
        labels.addEventListener('change', () => { s.def.labels = labels.checked; if (handle) handle.setLabels(labels.checked); });
        canvasEl = h('div', { class: 'dm-graph-view dm-center-fill', 'aria-label': t('graph.view') });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('share-2', 20), dataset.name, ' ', h('dm-badge', { text: t('graph.nodes.n', { n: i18n.formatNumber(s.count.nodes) }) }), h('dm-badge', { text: t('graph.edges.n', { n: i18n.formatNumber(s.count.edges) }) }), s.info && s.info.directed === false ? h('dm-badge', { kind: 'accent', text: t('graph.undirected') }) : null),
            h('div', { class: 'dm-toolbar' }, modeSel, layoutSel, labels,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('graph.fit.hint'), onClick: () => handle && handle.fit() }),
              ui.button({ label: t('graph.layout.save'), icon: 'save', title: t('graph.layout.save.hint'), onClick: saveLayout }),
              ui.button({ label: t('viz.save.as.chart'), icon: 'chart-column', title: t('graph.chart.save.hint'), onClick: saveChart }),
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('graph.table.hint'), onClick: options.onTable }))),
          canvasEl);
        renderInspector();
        await redraw();
      }
      async function redraw() {
        const my = seq;
        if (handle) { handle.destroy(); handle = null; }
        if (!canvasEl) return;
        s.error = ''; s.busy = t('common.loading'); renderInspector();
        try {
          handle = await draw.render(canvasEl, s.def, {
            onSelect: (sel) => { s.selected = sel; renderInspector(); },
            onFocus: (ids) => { s.def.focus = ids; s.def.mode = 'focus'; redraw(); },
          });
        } catch (err) { s.error = String((err && err.message) || err); shell.log(s.error, 'error'); }
        if (my !== seq) return;
        s.busy = ''; renderInspector();
      }
      async function expandNeighbours(ids) {
        if (!handle) return;
        const grew = await handle.expandNeighbours(ids);
        if (!grew) ui.toast.show(t('graph.focus.nomore'), { kind: 'info' });
      }
      async function saveLayout() {
        if (!handle) return;
        const positions = handle.positions();
        if (!positions.length) { ui.toast.show(t('graph.layout.saved.whole'), { kind: 'info' }); return; }
        await graph.layoutSet(s.id, positions);
        ui.toast.show(t('graph.layout.saved', { n: i18n.formatNumber(positions.length) }), { kind: 'ok' });
      }
      /** The current view as a graph chart in Visualisera (dashboards, Publicera, export). */
      async function saveChart() {
        const record = charts.create('graph', ds, `${ds.name}: ${t('viz.kind.badge.graph')}`);
        record.graph = Object.assign({}, s.def, { focus: (s.def.focus || []).slice(0, draw.FOCUS_LIMIT) });
        if (handle && handle.cy) await graph.layoutSet(s.id, handle.positions()).catch(() => {});
        await charts.save(record);
        shell.log(t('viz.saved.toast', { name: record.name }), 'ok');
        ui.toast.show(t('viz.saved.toast', { name: record.name }), { kind: 'ok', action: { label: t('map.open.visualisera'), onClick: () => { store.set({ openChartId: record.id }); shell.activate('visualisera'); } } });
      }

      // ---- editing -------------------------------------------------------------------------------------------------
      async function applyOp(op, params) {
        try {
          const r = await recipes.apply(s.id, op, params);
          shell.log(t('graph.edit.done', { op: t('op.' + op), n: i18n.formatNumber((r && r.rows) || 0) }), 'ok');
          if (options.onChanged) options.onChanged();
          return r;
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 8000 }); return null; }
      }
      const field = (label, value, attrs = {}) => { const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs))); el.value = value === undefined || value === null ? '' : String(value); return el; };
      const propsArea = (label, props) => { const el = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: 4, label, placeholder: 'nyckel: värde' })); el.value = Object.entries(props || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n'); return el; };
      /** A small form in a dialog; resolves with the values or null. */
      function formDialog(title, fields, okLabel) {
        let done = null;
        const body = h('div', { class: 'dm-stack-sm' }, fields.map((f) => f.el), h('div', { class: 'dm-row' }, ui.button({ label: okLabel, icon: 'check', variant: 'primary', onClick: () => { const out = {}; for (const f of fields) out[f.name] = f.el.value; if (done) done(out); } })));
        return ui.dialog.open({ title, help: 'grafer#redigera-grafen', body: (finish) => { done = finish; return body; }, actions: [{ label: t('common.cancel'), value: null }] }).then((v) => (v && typeof v === 'object' ? v : null));
      }
      async function addNode() {
        const v = await formDialog(t('graph.edit.addnode'), [{ name: 'id', el: field(t('graph.field.id'), '') }, { name: 'etikett', el: field(t('graph.field.label'), (s.info.labels[0] || {}).name || '') }, { name: 'namn', el: field(t('common.name'), '') }, { name: 'egenskaper', el: propsArea(t('graph.field.props'), {}) }], t('common.add'));
        if (!v) return;
        const id = v.id.trim() || ('n' + Date.now().toString(36));
        const r = await applyOp('graph_add_node', { id, etikett: v.etikett.trim(), namn: v.namn.trim(), egenskaper: v.egenskaper });
        if (r) { s.def.focus = Array.from(new Set((s.def.focus || []).concat([id]))); s.def.mode = 'focus'; s.selected = { kind: 'node', id, data: { id, namn: v.namn.trim() || id, etikett: v.etikett.trim(), egenskaper: {} } }; }
      }
      async function editSelected() {
        const sel = s.selected; if (!sel) return;
        const props = graph.parseProps(sel.data.egenskaper);
        if (sel.kind === 'node') {
          const v = await formDialog(t('graph.edit.node'), [{ name: 'etikett', el: field(t('graph.field.label'), sel.data.etikett) }, { name: 'namn', el: field(t('common.name'), sel.data.namn) }, { name: 'egenskaper', el: propsArea(t('graph.field.props'), props) }], t('common.save'));
          if (!v) return;
          const newProps = D.require('data/graph-ops').linesToProps(v.egenskaper);
          const removed = Object.keys(props).filter((k) => !(k in newProps));
          await applyOp('graph_set_node', { ids: [sel.id], etikett: v.etikett.trim(), namn: v.namn.trim(), egenskaper: JSON.stringify(newProps), remove: removed.join('\n') });
        } else {
          const v = await formDialog(t('graph.edit.edge'), [{ name: 'typ', el: field(t('graph.field.type'), sel.data.typ) }, { name: 'egenskaper', el: propsArea(t('graph.field.props'), props) }], t('common.save'));
          if (!v) return;
          const newProps = D.require('data/graph-ops').linesToProps(v.egenskaper);
          const removed = Object.keys(props).filter((k) => !(k in newProps));
          await applyOp('graph_set_edge', { ids: [sel.id], typ: v.typ.trim(), egenskaper: JSON.stringify(newProps), remove: removed.join('\n') });
        }
      }
      async function deleteSelected() {
        const sel = s.selected; if (!sel) return;
        const ok = await ui.dialog.confirm(t(sel.kind === 'node' ? 'graph.edit.delete.node.confirm' : 'graph.edit.delete.edge.confirm', { name: sel.kind === 'node' ? (sel.data.namn || sel.id) : (sel.data.typ || sel.id) }), { okLabel: t('common.delete') });
        if (!ok) return;
        if (sel.kind === 'node') { await applyOp('graph_delete_nodes', { ids: [sel.id], detach: true }); s.def.focus = (s.def.focus || []).filter((id) => id !== sel.id); }
        else await applyOp('graph_delete_edges', { ids: [sel.id] });
        s.selected = null;
      }
      /** Pick the selected node as the start of a connection or a merge; the next pick completes it. */
      function pick() { if (s.selected && s.selected.kind === 'node' && !s.picked.includes(s.selected.id)) { s.picked.push(s.selected.id); renderInspector(); } }
      async function connectPicked() {
        const target = s.selected && s.selected.kind === 'node' ? s.selected.id : null;
        if (s.picked.length !== 1 || !target || target === s.picked[0]) { ui.toast.show(t('graph.edit.connect.pick'), { kind: 'info' }); return; }
        const v = await formDialog(t('graph.edit.connect'), [{ name: 'typ', el: field(t('graph.field.type'), (s.info.types[0] || {}).name || '') }, { name: 'egenskaper', el: propsArea(t('graph.field.props'), {}) }], t('common.add'));
        if (!v) return;
        await applyOp('graph_add_edge', { kalla: s.picked[0], mal: target, typ: v.typ.trim(), egenskaper: v.egenskaper });
        s.picked = [];
      }
      async function mergePicked() {
        const target = s.selected && s.selected.kind === 'node' ? s.selected.id : null;
        const others = s.picked.filter((id) => id !== target);
        if (!target || !others.length) { ui.toast.show(t('graph.edit.merge.pick'), { kind: 'info' }); return; }
        const ok = await ui.dialog.confirm(t('graph.edit.merge.confirm', { n: i18n.formatNumber(others.length), name: s.selected.data.namn || target }), { okLabel: t('graph.edit.merge') });
        if (!ok) return;
        await applyOp('graph_merge_nodes', { ids: others, into: target });
        s.def.focus = (s.def.focus || []).filter((id) => !others.includes(id));
        s.picked = [];
      }

      // ---- inspector ------------------------------------------------------------------------------------------------
      function renderInspector() {
        if (!slots) return;
        const items = [];
        if (s.busy) items.push(h('dm-progress', { indeterminate: true, label: s.busy }));
        if (s.error) items.push(h('p', { class: 'dm-error dm-small', text: s.error }));
        const search = /** @type {any} */ (h('dm-input', { label: t('graph.search'), placeholder: t('graph.search.placeholder') }));
        search.value = s.search;
        search.addEventListener('input', () => { s.search = search.value; });
        search.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') doSearch(); });
        items.push(h('h4', { text: t('graph.search') }), h('div', { class: 'dm-row' }, search, ui.button({ label: t('common.search'), icon: 'search', size: 'sm', onClick: doSearch })));
        const colorOf = (label) => (handle ? handle.colors.of(label) : '#999');
        if (s.hits.length) items.push(h('div', { class: 'dm-list dm-graph-hits' }, s.hits.slice(0, 50).map((n) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => { s.def.focus = [n.id]; s.def.mode = 'focus'; s.selected = { kind: 'node', id: n.id, data: { id: n.id, namn: n.name, etikett: n.label, egenskaper: n.properties } }; redraw(); } }, h('span', { class: 'dm-graph-swatch', style: { background: colorOf(n.label) } }), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: n.name || n.id }), h('span', { class: 'dm-list-sub dm-truncate', text: n.label || t('graph.nolabel') }))))));
        if (s.def.mode === 'focus') items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('graph.focus.expand'), icon: 'plus', size: 'sm', disabled: !(s.def.focus || []).length, title: t('graph.focus.expand.hint'), onClick: () => expandNeighbours(s.selected && s.selected.kind === 'node' ? [s.selected.id] : (s.def.focus || []).slice(0, 50)) }), ui.button({ label: t('graph.focus.clear'), icon: 'x', size: 'sm', onClick: () => { s.def.focus = []; s.def.mode = 'overview'; redraw(); } }), h('span', { class: 'dm-help dm-xs', text: t('graph.focus.n', { n: i18n.formatNumber((s.def.focus || []).length) }) })));
        // Editing: add a node always; change, remove, connect and merge from the selection.
        items.push(h('h4', { text: t('graph.edit.title') }), h('div', { class: 'dm-row-wrap dm-graph-edit' },
          ui.button({ label: t('graph.edit.addnode'), icon: 'plus', size: 'sm', onClick: addNode }),
          ui.button({ label: t('common.edit'), icon: 'pencil', size: 'sm', disabled: !s.selected, onClick: editSelected }),
          ui.button({ label: t('common.delete'), icon: 'trash-2', size: 'sm', variant: 'danger', disabled: !s.selected, onClick: deleteSelected }),
          ui.button({ label: t('graph.edit.pick'), icon: 'circle-dot', size: 'sm', disabled: !(s.selected && s.selected.kind === 'node'), title: t('graph.edit.pick.hint'), onClick: pick }),
          ui.button({ label: t('graph.edit.connect'), icon: 'git-branch', size: 'sm', disabled: s.picked.length !== 1 || !(s.selected && s.selected.kind === 'node'), title: t('graph.edit.connect.hint'), onClick: connectPicked }),
          ui.button({ label: t('graph.edit.merge'), icon: 'layers', size: 'sm', disabled: !s.picked.length || !(s.selected && s.selected.kind === 'node'), title: t('graph.edit.merge.hint'), onClick: mergePicked })));
        if (s.picked.length) items.push(h('p', { class: 'dm-help dm-xs', text: t('graph.edit.picked', { ids: s.picked.join(', ') }) }));
        if (s.selected) {
          const d = s.selected.data;
          const kv = /** @type {any} */ (h('dm-kv'));
          const props = graph.parseProps(d.egenskaper);
          kv.items = (s.selected.kind === 'node'
            ? [{ label: t('graph.field.id'), value: d.id }, { label: t('graph.field.label'), value: d.etikett || t('graph.nolabel') }, { label: t('common.name'), value: d.namn || '' }]
            : [{ label: t('graph.field.id'), value: s.selected.id }, { label: t('graph.field.type'), value: d.typ || t('graph.notype') }, { label: t('graph.field.source'), value: d.source }, { label: t('graph.field.target'), value: d.target }])
            .concat(Object.entries(props).map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) })));
          items.push(h('h4', { text: t(s.selected.kind === 'node' ? 'graph.selected.node' : 'graph.selected.edge') }), kv);
          if (s.selected.kind === 'node') items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('graph.focus.here'), icon: 'circle-dot', size: 'sm', onClick: () => { s.def.focus = [s.selected.id]; s.def.mode = 'focus'; redraw().then(() => expandNeighbours([s.selected.id])); } })));
        }
        if (s.info && s.info.labels) {
          items.push(h('h4', { text: t('graph.labels') }), h('ul', { class: 'dm-map-legend-list dm-graph-legend' }, s.info.labels.slice(0, 40).map((l) => h('li', null, h('span', { class: 'dm-graph-swatch', style: { background: colorOf(l.name) } }), h('button', { type: 'button', class: 'dm-link', text: `${l.name || t('graph.nolabel')} · ${i18n.formatNumber(l.count)}`, onclick: async () => { const nodes = await graph.nodes(s.id, { label: l.name, limit: draw.FOCUS_LIMIT }); s.def.focus = nodes.map((n) => n.id); s.def.mode = 'focus'; redraw(); } })))));
          if (s.info.types && s.info.types.length) items.push(h('h4', { text: t('graph.types') }), h('ul', { class: 'dm-map-legend-list dm-graph-legend' }, s.info.types.slice(0, 40).map((l) => h('li', null, h('span', { class: 'dm-truncate', text: `${l.name || t('graph.notype')} · ${i18n.formatNumber(l.count)}` })))));
        }
        items.push(h('p', { class: 'dm-help dm-xs', text: t(s.def.mode === 'whole' ? 'graph.help.whole' : s.def.mode === 'focus' ? 'graph.help.focus' : 'graph.help.overview') }));
        replace(slots.right, h('div', { class: 'dm-inspector dm-stack' }, items));
      }
      async function doSearch() {
        const text = s.search.trim();
        if (!text) { s.hits = []; renderInspector(); return; }
        s.hits = await graph.nodes(s.id, { search: text, limit: 50 });
        if (!s.hits.length) ui.toast.show(t('graph.search.none'), { kind: 'info' });
        renderInspector();
      }

      return { render, destroy, state: s, ensureCytoscape: draw.ensureCytoscape, ensureSigma: draw.ensureSigma, applyOp };
    }
    return { create, ensureCytoscape: draw.ensureCytoscape, ensureSigma: draw.ensureSigma, LAYOUTS: draw.LAYOUTS };
  });
})();
