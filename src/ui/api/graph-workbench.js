// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A server's graph, live, in Inhämta: a Cypher editor, the answer as a table and as a drawing, and the IFC models on Kontroll with ready-made
 * views. A node's neighbours, properties and issues are fetched from the server when asked for and added to the drawing; what is kept
 * becomes a dataset with "Spara som graf" or "Spara som datamängd". Nothing is stored until then. The transport comes from the caller
 * (`api/graph-source`), so the same view serves a Neo4j source over Bolt and the graph query of an OpenCDE source.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/graph-workbench', ['ui/base', 'ui/basic', 'ui/overlays', 'data/graph', 'data/datasets', 'data/ifc-graph', 'viz/graph-draw', 'api/connectors', 'api/runner', 'api/graph-source', 'api/families/neo4j'], (base, basic, overlays, graph, datasets, ifcGraph, draw, connectors, runner, graphSource, neo4j) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 500;
    /** More nodes than this are not drawn here: the layout would hold the page, and the overview in Bearbeta handles them better. */
    const MAX_DRAWN = 1500;
    /** An answer that names only nodes gets its relationships fetched up to this size, as Neo4j Browser does. */
    const MAX_JOINED = 300;
    const fmt = (n) => i18n.formatNumber(Number(n) || 0);
    const message = (err) => String((err && err.message) || err);

    /**
     * @param {{connector: any, run: (text: string, options?: any) => Promise<any>, via?: 'admin', hint: string, ctx?: any, log?: Function, onDataset?: Function, onInspector?: Function}} api
     */
    function create(api) {
      const { connector } = api;
      const kept = (connector.queries && connector.queries[0] && connector.queries[0].cypher) || 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50';
      const s = { query: kept, busy: false, result: null, error: '', saving: false, saved: '', models: null, waiting: 0, failed: 0, modelId: '', modelsBusy: false, modelsError: '', viewId: '', layout: 'fcose', labels: true, selected: null, acting: '', drawError: '' };
      const el = h('div', { class: 'dm-stack', 'data-graph-workbench': '' });
      const modelsEl = h('div', { class: 'dm-stack-sm', 'data-ifcgraph': '' });
      const buttonsEl = h('div', { class: 'dm-row-wrap' });
      const keptEl = h('div');
      const resultEl = h('div');
      let editor = null; let viewSel = null; let built = false;
      let handle = null; let canvasEl = null; let statusEl = null; let legendEl = null; let saveEl = null; let tableEl = null;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      const model = () => (s.models || []).find((m) => m.id === s.modelId) || null;
      const inspectorChanged = () => { if (api.onInspector) api.onInspector(); };

      // ------------------------------------------------------------------------------------------------- running queries
      /** Run a query and show its answer, in place of what was shown. */
      async function execute(text, options = {}) {
        if (s.busy) return;
        s.query = text; if (editor && editor.value !== text) editor.value = text;
        s.busy = true; s.error = ''; s.saved = ''; s.selected = null; s.drawError = ''; renderButtons(); inspectorChanged();
        try {
          const out = await api.run(text, { maxRows: neo4j.MAX_ROWS });
          await joinNodes(out);
          s.result = Object.assign(out, { name: options.name || `${connector.name}: ${text.slice(0, 40)}` });
          if (options.layout) s.layout = options.layout;
          log(t('neo4j.ran', { n: fmt(out.rows.length) }));
        } catch (err) { s.result = null; s.error = message(err); log(`${connector.name}: ${s.error}`, 'error'); }
        s.busy = false; renderButtons();
        await renderResult();
      }
      /** `RETURN c, w` names no relationships, but the picture is about how the two hang together. Failing here costs only the lines. */
      async function joinNodes(out) {
        if (!out.graph || out.graph.edges.length || out.graph.nodes.length < 2 || out.graph.nodes.length > MAX_JOINED) return;
        const ids = out.graph.nodes.map((n) => n.id);
        const known = new Set(ids);
        try {
          const more = await api.run(ifcGraph.CONNECTING, { maxRows: 2000, params: { ids } });
          if (more.graph) out.graph = graph.normalise({ nodes: out.graph.nodes, edges: more.graph.edges.filter((e) => known.has(e.source) && known.has(e.target)), directed: true });
        } catch (err) { D.log('graph-workbench', 'join', err); }
      }
      /** The editor's query. */
      async function run() {
        if (s.busy) return;
        const text = (editor ? editor.value : s.query).trim();
        if (!text) return;
        s.viewId = ''; if (viewSel) viewSel.value = '';
        await execute(text);
      }
      async function loadModels() {
        if (s.modelsBusy) return;
        s.modelsBusy = true; s.modelsError = ''; renderModels();
        try {
          const list = ifcGraph.modelsOf(await api.run(ifcGraph.MODELS, { maxRows: 5000 }));
          s.models = list.models; s.waiting = list.waiting; s.failed = list.failed;
          if (!model()) { const first = ifcGraph.pickModel(s.models, null); s.modelId = first ? first.id : ''; }
          log(t('ifcgraph.models.loaded', { n: fmt(s.models.length) }));
        } catch (err) { s.models = null; s.modelsError = message(err); log(`${connector.name}: ${s.modelsError}`, 'error'); }
        s.modelsBusy = false; renderModels();
      }
      /** One of the ready-made views of the chosen model. @param {string} viewId */
      async function showView(viewId) {
        const m = model();
        const view = m ? ifcGraph.viewOf(viewId, m.id) : null;
        if (!view) return;
        s.viewId = viewId;
        await execute(view.cypher, { layout: view.layout, name: `${m.file}: ${t('ifcgraph.view.' + viewId)}` });
      }
      /**
       * A model's page asked for its graph: the model it came from, with the element it asked about or the spatial structure.
       * @param {{documentId?: string|null, versionIndex?: number|null, guid?: string|null}} link
       */
      async function follow(link) {
        await loadModels();
        if (!s.models || !s.models.length) return;
        const m = ifcGraph.pickModel(s.models, link);
        s.modelId = m.id; renderModels();
        if (link.guid) await execute(ifcGraph.element(link.guid, m.id), { layout: 'fcose', name: `${m.file}: ${link.guid}` });
        else await showView('spatial');
      }

      // ----------------------------------------------------------------------------------------- growing from one node
      /** Fetch something from the selected node and add it to the drawing. @param {'neighbours'|'properties'|'issues'} step */
      async function act(step) {
        const sel = s.selected;
        if (!sel || sel.kind !== 'node' || s.acting || !s.result) return 0;
        s.acting = step; inspectorChanged();
        let added = 0;
        try {
          const out = await api.run(ifcGraph.stepFrom(step, sel.id), { maxRows: 1000 });
          added = merge(out.graph, sel.id);
          if (added) log(t('ifcgraph.added', { n: fmt(added) }));
          else overlays.toast.show(t(step === 'neighbours' ? 'graph.focus.nomore' : 'ifcgraph.nothing.' + step), { kind: 'info' });
          if (out.truncated) overlays.toast.show(t('ifcgraph.truncated', { n: fmt(out.rows.length) }), { kind: 'warn' });
        } catch (err) { overlays.toast.show(message(err), { kind: 'error', timeout: 8000 }); log(`${connector.name}: ${message(err)}`, 'error'); }
        s.acting = ''; inspectorChanged();
        return added;
      }
      /** The drawing and the graph to save grow together. Returns how many nodes and edges were new. */
      function merge(more, anchor) {
        if (!more || !s.result) return 0;
        const was = s.result.graph || { nodes: [], edges: [] };
        const merged = graph.normalise({ nodes: was.nodes.concat(more.nodes), edges: was.edges.concat(more.edges), directed: true });
        const added = merged.nodes.length + merged.edges.length - was.nodes.length - was.edges.length;
        if (!added) return 0;
        if (merged.nodes.length > MAX_DRAWN) { overlays.toast.show(t('ifcgraph.toobig', { n: fmt(merged.nodes.length) }), { kind: 'warn' }); return 0; }
        s.result.graph = merged;
        if (handle) handle.merge(more, anchor);
        renderStatus(); renderLegend(); renderSave();
        return added;
      }
      /** The selected element in a model of the workspace, the model it came from first. */
      async function showInModel() {
        const guid = s.selected && graph.parseProps(s.selected.data.egenskaper).GlobalId;
        if (!guid || !api.ctx) return false;
        const m = model();
        const list = (await datasets.list()).filter((d) => d.kind === 'model');
        const mine = (d) => (m && d.source && d.source.cde && d.source.cde.documentId === m.document ? 0 : 1);
        for (const ds of list.sort((a, b) => mine(a) - mine(b))) {
          const opened = await datasets.ensureOpen(ds.id);
          const res = await opened.engine.exec('select id from data where guid = ? limit 1', [String(guid)]);
          if (res[0] && res[0].values.length) {
            api.ctx.store.set({ selectedId: ds.id, openElement: { datasetId: ds.id, id: res[0].values[0][0] } });
            api.ctx.shell.activate('bearbeta');
            return true;
          }
        }
        overlays.toast.show(t('ifcgraph.nomodel'), { kind: 'info', timeout: 8000 });
        return false;
      }

      // ------------------------------------------------------------------------------------------------------- saving
      async function saveTable(name) {
        const r = s.result; if (!r || s.saving) return;
        s.saving = true; renderSave();
        try {
          const meta = await runner.toDataset({ columns: r.columns, rows: r.rows, meta: {} }, { name: name || r.name, description: neo4j.describe(connector, s.query), source: graphSource.sourceOf(connector, s.query, api.via) });
          s.saved = t('api.saved', { name: meta.name, rows: fmt(meta.rowCount) });
          log(s.saved);
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { overlays.toast.show(message(err), { kind: 'error' }); }
        s.saving = false; renderSave();
      }
      async function saveGraph(name) {
        const r = s.result; if (!r || !r.graph || s.saving) return;
        s.saving = true; renderSave();
        try {
          const meta = await graph.createGraphDataset({ name: name || r.name, graph: r.graph, description: neo4j.describe(connector, s.query), source: graphSource.sourceOf(connector, s.query, api.via) });
          s.saved = t('graph.from.done', { name: meta.name, nodes: fmt(r.graph.nodes.length), edges: fmt(r.graph.edges.length) });
          log(s.saved);
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { overlays.toast.show(message(err), { kind: 'error' }); }
        s.saving = false; renderSave();
      }
      /** Keep the query on the connector (the user's copy) so it can be run again later. */
      async function keepQuery() {
        const text = (editor ? editor.value : s.query).trim(); if (!text) return;
        const list = (connector.queries || []).filter((q) => q.cypher !== text);
        list.unshift({ name: text.slice(0, 60), cypher: text, savedAt: new Date().toISOString() });
        connector.queries = list.slice(0, 20);
        await connectors.save(connector);
        overlays.toast.show(t('neo4j.query.kept'), { kind: 'ok' });
        renderKept();
      }

      // ------------------------------------------------------------------------------------------------------ the form
      function renderModels() {
        const nodes = [h('div', { class: 'dm-row-wrap' },
          h('strong', { text: t('ifcgraph.models') }),
          basic.button({ label: t(s.models ? 'ifcgraph.models.again' : 'ifcgraph.models.load'), icon: 'layers', size: 'sm', loading: s.modelsBusy, title: t('ifcgraph.models.load.hint'), 'data-ifcgraph-models': '', onClick: loadModels }))];
        if (s.modelsError) nodes.push(h('p', { class: 'dm-error dm-small', text: s.modelsError }));
        if (!s.models) nodes.push(h('p', { class: 'dm-help dm-xs', text: t('ifcgraph.models.hint') }));
        else if (!s.models.length) nodes.push(h('p', { class: 'dm-help dm-small', text: t('ifcgraph.models.none') }));
        else {
          const modelSel = /** @type {any} */ (h('dm-select', { label: t('ifcgraph.model'), inline: true, 'data-ifcgraph-model': '' }));
          modelSel.options = s.models.map((m) => ({ value: m.id, label: t('ifcgraph.model.label', { file: m.file, version: m.version == null ? '–' : String(m.version), entities: fmt(m.entities) }) + (m.project ? ` · ${m.project}` : '') }));
          modelSel.value = s.modelId;
          modelSel.addEventListener('change', () => { s.modelId = modelSel.value; if (s.viewId) showView(s.viewId); });
          viewSel = /** @type {any} */ (h('dm-select', { label: t('ifcgraph.view'), inline: true, 'data-ifcgraph-view': '' }));
          viewSel.options = [{ value: '', label: t('ifcgraph.view.pick') }].concat(ifcGraph.VIEWS.map((v) => ({ value: v.id, label: t('ifcgraph.view.' + v.id) })));
          viewSel.value = s.viewId;
          viewSel.addEventListener('change', () => { if (viewSel.value) showView(viewSel.value); });
          nodes.push(h('div', { class: 'dm-row-wrap' }, modelSel, viewSel));
        }
        if (s.models && (s.waiting || s.failed)) nodes.push(h('p', { class: 'dm-help dm-xs', text: [s.waiting ? t('ifcgraph.models.waiting', { n: fmt(s.waiting) }) : '', s.failed ? t('ifcgraph.models.failed', { n: fmt(s.failed) }) : ''].filter(Boolean).join(' ') }));
        replace(modelsEl, nodes);
      }
      function renderButtons() {
        replace(buttonsEl, basic.button({ label: t('common.run'), icon: 'play', variant: 'primary', loading: s.busy, title: t('neo4j.run.hint'), onClick: run }), basic.button({ label: t('neo4j.query.keep'), icon: 'save', size: 'sm', onClick: keepQuery }));
      }
      function renderKept() {
        const list = connector.queries || [];
        replace(keptEl, list.length ? h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-xs', text: t('neo4j.query.saved') }), list.slice(0, 8).map((q) => basic.button({ label: q.name, size: 'sm', variant: 'ghost', title: q.cypher, onClick: () => { s.query = q.cypher; editor.value = q.cypher; run(); } }))) : null);
      }
      /** Starter queries for Kontroll's IFC graph; choosing one puts it in the editor, to edit and run. */
      function examplesRow() {
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('neo4j.examples'), inline: true, 'data-neo4j-example': '' }));
        sel.options = [{ value: '', label: t('neo4j.examples') }].concat(neo4j.EXAMPLES.map((x) => ({ value: x.id, label: t('neo4j.example.' + x.id) })));
        sel.value = '';
        sel.addEventListener('change', () => {
          const x = neo4j.EXAMPLES.find((e) => e.id === sel.value);
          if (!x) return;
          s.query = x.cypher; if (editor) editor.value = x.cypher;
          sel.value = '';
        });
        return h('div', { class: 'dm-row-wrap' }, sel, h('span', { class: 'dm-help dm-xs', text: t('neo4j.examples.hint') }));
      }
      function build() {
        if (built) return;
        built = true;
        editor = /** @type {any} */ (h('dm-code', { language: 'sql', placeholder: 'MATCH (n) RETURN n LIMIT 25' }));
        editor.value = s.query;
        editor.addEventListener('input', () => { s.query = editor.value; });
        replace(el, h('div', { class: 'dm-card dm-stack-sm' }, h('p', { class: 'dm-help dm-small', text: api.hint }), modelsEl, examplesRow(), editor, buttonsEl, keptEl), resultEl);
        renderModels(); renderButtons(); renderKept();
      }

      // ----------------------------------------------------------------------------------------------------- the answer
      function closeDrawing() { if (handle) { handle.destroy(); handle = null; } canvasEl = null; }
      function renderStatus() {
        if (!statusEl || !s.result) return;
        const r = s.result;
        const limit = ifcGraph.limitOf(s.query);
        replace(statusEl,
          h('strong', { text: t('api.result', { rows: fmt(r.rows.length), cols: r.columns.length }) }),
          r.graph ? h('dm-badge', { kind: 'accent', 'data-graph-count': '', text: `${t('graph.nodes.n', { n: fmt(r.graph.nodes.length) })} · ${t('graph.edges.n', { n: fmt(r.graph.edges.length) })}` }) : null,
          r.truncated ? h('span', { class: 'dm-warn dm-small', 'data-graph-truncated': '', text: t('ifcgraph.truncated', { n: fmt(r.rows.length) }) }) : null,
          !r.truncated && limit && r.rows.length >= limit ? h('span', { class: 'dm-warn dm-small', 'data-graph-limit': '', text: t('ifcgraph.limit', { n: fmt(limit) }) }) : null,
          r.graph && r.graph.nodes.length > MAX_DRAWN ? h('span', { class: 'dm-help dm-small', text: t('ifcgraph.toobig', { n: fmt(r.graph.nodes.length) }) }) : null,
          s.drawError ? h('span', { class: 'dm-error dm-small', text: s.drawError }) : null);
      }
      const legendName = (key) => (key.startsWith('ifc:') ? t('ifcgraph.family.' + key.slice(4)) : (key || t('graph.nolabel')));
      function renderLegend() {
        if (!legendEl) return;
        replace(legendEl, handle ? handle.legend().map((l) => h('span', { class: 'dm-row dm-xs' }, h('span', { class: 'dm-graph-swatch', style: { background: l.color } }), h('span', { text: `${legendName(l.key)} · ${fmt(l.count)}` }))) : null);
      }
      function renderSave() {
        if (!saveEl || !s.result) return;
        const r = s.result;
        if (s.saved) { replace(saveEl, h('p', { class: 'dm-success', text: s.saved })); return; }
        const nameInput = /** @type {any} */ (h('dm-input', { label: t('api.name') })); nameInput.value = r.name;
        replace(saveEl, h('div', { class: 'dm-row-wrap dm-api-save' }, nameInput,
          basic.button({ label: t('api.save'), icon: 'save', variant: r.graph ? undefined : 'primary', loading: s.saving, onClick: () => saveTable(nameInput.value.trim()) }),
          r.graph ? basic.button({ label: t('neo4j.save.graph'), icon: 'share-2', variant: 'primary', loading: s.saving, title: t('neo4j.save.graph.hint'), 'data-graph-save': '', onClick: () => saveGraph(nameInput.value.trim()) }) : null));
      }
      function toolbar() {
        const layoutSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('graph.layout'), inline: true, 'data-graph-layout': '' }));
        layoutSel.options = draw.LAYOUTS.map((l) => ({ value: l, label: t('graph.layout.' + l) }));
        layoutSel.value = s.layout;
        layoutSel.addEventListener('change', () => { s.layout = layoutSel.value; if (handle) handle.runLayout(s.layout); });
        const labels = /** @type {any} */ (h('dm-switch', { label: t('graph.labels.show') }));
        labels.checked = s.labels;
        labels.addEventListener('change', () => { s.labels = labels.checked; if (handle) handle.setLabels(s.labels); });
        return h('div', { class: 'dm-toolbar' }, layoutSel, labels,
          basic.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('graph.fit.hint'), onClick: () => { if (handle) handle.fit(); } }),
          h('span', { class: 'dm-help dm-xs', text: t('ifcgraph.drawing.hint') }));
      }
      async function drawNow() {
        if (!canvasEl || !s.result || !s.result.graph) return;
        const target = canvasEl;
        try {
          const next = await draw.renderLive(target, s.result.graph, {
            layout: s.layout, labels: s.labels, colorKey: ifcGraph.colorKey,
            onSelect: (sel) => { s.selected = sel; inspectorChanged(); },
            onExpand: (id) => { const n = s.result && s.result.graph.nodes.find((x) => x.id === id); if (n) { s.selected = { kind: 'node', id, data: { id, namn: n.name, etikett: n.label, egenskaper: n.properties } }; act('neighbours'); } },
          });
          if (canvasEl !== target) { next.destroy(); return; }
          handle = next;
        } catch (err) { s.drawError = message(err); D.log('graph-workbench', err); }
        renderStatus(); renderLegend();
      }
      async function renderResult() {
        closeDrawing();
        inspectorChanged();
        if (s.error) { replace(resultEl, h('div', { class: 'dm-card' }, h('p', { class: 'dm-error', text: s.error }))); return; }
        const r = s.result;
        if (!r) { replace(resultEl); return; }
        statusEl = h('div', { class: 'dm-row-wrap' });
        legendEl = h('div', { class: 'dm-row-wrap', 'data-graph-legend': '' });
        saveEl = h('div');
        tableEl = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
        const drawable = !!r.graph && r.graph.nodes.length <= MAX_DRAWN;
        canvasEl = drawable ? h('div', { class: 'dm-graph-view dm-graph-live', 'aria-label': t('graph.view'), 'data-graph-canvas': '' }) : null;
        const rows = r.rows.slice(0, PREVIEW_ROWS);
        replace(resultEl, h('div', { class: 'dm-card dm-stack', 'data-graph-result': '' }, statusEl, drawable ? toolbar() : null, canvasEl, drawable ? legendEl : null, h('div', { class: 'dm-table-wrap' }, tableEl), saveEl));
        renderStatus(); renderSave();
        const table = tableEl;
        requestAnimationFrame(() => table.setData({ columns: r.columns.map((c) => ({ key: c, label: c, type: 'text' })), rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count) }));
        // A view that is not on the page has no size to draw in; only a test with a detached view gets here without one.
        if (canvasEl && canvasEl.isConnected) await drawNow();
      }

      // -------------------------------------------------------------------------------------------------- the inspector
      /** The selected node or edge, for the inspector. @returns {HTMLElement|null} */
      function inspector() {
        const sel = s.selected;
        if (!sel) return null;
        const d = sel.data; const props = Object.assign({}, graph.parseProps(d.egenskaper));
        const labels = props.etiketter; delete props.etiketter;
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = (sel.kind === 'node'
          ? [{ label: t('common.name'), value: d.namn || '' }, { label: t('graph.field.label'), value: d.etikett || t('graph.nolabel') }]
          : [{ label: t('graph.field.type'), value: d.typ || t('graph.notype') }, { label: t('graph.field.source'), value: d.source }, { label: t('graph.field.target'), value: d.target }])
          .concat(Object.entries(props).map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) })))
          .concat(Array.isArray(labels) ? [{ label: t('ifcgraph.labels'), value: labels.join(', ') }] : []);
        const product = sel.kind === 'node' && Array.isArray(labels) && labels.includes('IfcProduct');
        const step = (id, icon) => basic.button({ label: t('ifcgraph.act.' + id), icon, size: 'sm', loading: s.acting === id, title: t('ifcgraph.act.' + id + '.hint'), 'data-ifcgraph-act': id, onClick: () => act(/** @type {any} */ (id)) });
        return h('div', { class: 'dm-stack-sm', 'data-graph-selected': sel.id },
          h('h4', { text: t(sel.kind === 'node' ? 'graph.selected.node' : 'graph.selected.edge') }),
          sel.kind === 'node' ? h('div', { class: 'dm-row-wrap' },
            step('neighbours', 'share-2'),
            product ? step('properties', 'list') : null,
            product ? step('issues', 'message-square') : null,
            product && props.GlobalId && api.ctx ? basic.button({ label: t('ifcgraph.act.model'), icon: 'box', size: 'sm', title: t('ifcgraph.act.model.hint'), 'data-ifcgraph-act': 'model', onClick: () => showInModel() }) : null) : null,
          kv);
      }

      function start() { build(); }
      function destroy() { closeDrawing(); }
      return { el, start, destroy, state: s, run, saveGraph, saveTable, loadModels, showView, follow, act, showInModel, inspector, drawing: () => handle };
    }
    return { create, MAX_DRAWN };
  });
})();
