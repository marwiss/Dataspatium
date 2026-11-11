// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Visualisera": Vega-Lite builder, D3 templates and R scripts with live preview, saved charts
 * (shareable viz files), export to SVG/PNG/PDF, batch generation per group and a gallery/panel view.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/visualisera', ['ui/base', 'ui/viz/vega-controls', 'ui/viz/d3-controls', 'ui/viz/r-panel', 'ui/viz/python-panel', 'ui/viz/map-panel', 'ui/viz/graph-chart-panel', 'ui/viz/model-chart-panel', 'ui/viz/gallery', 'ui/viz/export-dialog', 'viz/charts', 'viz/render', 'viz/vega-builder', 'viz/leaflet', 'platform/files', 'ui/theme', 'ui/viz/dashboard-view', 'viz/dashboards'],
    (base, vegaControls, d3Controls, rPanel, pyPanel, mapPanel, graphChartPanel, modelChartPanel, galleryMod, exportDialog, charts, vizRender, builder, leaflet, files, uiTheme, dashboardView, dashboards) => {
      /** Charts drawn by code (R, Python) have their own panel instead of the controls and the live preview. */
      const isCode = (kind) => kind === 'r' || kind === 'python';
      /** Kinds with a panel of their own (code charts and maps); the others use the builder controls and the preview. */
      const isPanel = (kind) => isCode(kind) || kind === 'map' || kind === 'graph' || kind === 'model';
      const kindIcon = (kind) => (kind === 'r' ? 'terminal' : kind === 'python' ? 'code' : kind === 'd3' ? 'trending-up' : kind === 'map' ? 'map' : kind === 'graph' ? 'share-2' : kind === 'model' ? 'box' : 'chart-column');
      const { h, t, i18n, replace } = base;

      function createMode(ctx) {
        const { ui, services, store, shell } = ctx;
        let slots = null; let unsubStore = null; let unsubCharts = null; let unsubTheme = null;
        let view = 'gallery';
        let chart = null; let dirty = false; let columns = [];
        let controls = null; let rpanel = null; let gallery = null; let handle = null; let renderTimer = 0; let renderSeq = 0;
        let list = [];
        let previewEl = null; let infoEl = null; let nameInput = null;
        let dashList = []; let dashView = null; let dashboard = null; let unsubDash = null;

        async function activate(s) {
          slots = s;
          unsubStore = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) renderLeft(); if (changed.includes('openChartId')) takeOpenChart(); });
          unsubCharts = charts.subscribe(async () => { list = await charts.list(); renderLeft(); if (view === 'gallery' && gallery) gallery.update(list); if (view === 'dashboard' && dashView) dashView.reload(); });
          unsubDash = dashboards.subscribe(async () => { dashList = await dashboards.list(); renderLeft(); });
          unsubTheme = uiTheme.onChange(() => { if (view === 'chart' && chart && !isPanel(chart.kind)) schedulePreview(0); if (view === 'chart' && rpanel && rpanel.redraw) rpanel.redraw(); if (view === 'dashboard' && dashView) dashView.reload(); });
          list = await charts.list();
          dashList = await dashboards.list();
          render();
          // A chart opened before the lists finished loading (command palette) needs its preview drawn again.
          if (view === 'chart' && chart && !isPanel(chart.kind)) schedulePreview(0);
          takeOpenChart();
          takeOpenDashboard();
        }
        /** A dashboard handed over through the store (Härkomst). */
        async function takeOpenDashboard() {
          const id = store.get().openDashboardId;
          if (!id || !slots) return;
          store.set({ openDashboardId: null });
          const record = (await dashboards.list()).find((d) => d.id === id);
          if (record) await openDashboard(record);
        }
        /** A chart handed over through the store (the beginner's course) is opened in the builder. */
        async function takeOpenChart() {
          const id = store.get().openChartId;
          if (!id || !slots) return;
          store.set({ openChartId: null });
          const record = await charts.get(id);
          if (record) await openChart(record);
        }
        function deactivate() {
          slots = null;
          if (unsubStore) unsubStore(); if (unsubCharts) unsubCharts(); if (unsubTheme) unsubTheme(); if (unsubDash) unsubDash();
          disposePreview(); if (rpanel) { rpanel.destroy(); rpanel = null; } if (gallery) { gallery.destroy(); gallery = null; } if (dashView) { dashView.destroy(); dashView = null; }
        }
        function disposePreview() { if (handle) { try { handle.finalize(); } catch (_e) { /* ignore */ } handle = null; } }
        function selectedDataset() { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; }

        function render() { if (!slots) return; renderLeft(); renderCenter(); renderRight(); }

        // ---- left: datasets, new chart, saved charts ----
        function renderLeft() {
          if (!slots) return;
          const st = store.get();
          ui.datasetList.render(slots.left, { datasets: st.datasets, selectedId: st.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
          slots.left.appendChild(h('hr'));
          slots.left.appendChild(h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('viz.saved') }), ui.button({ label: t('viz.new'), icon: 'plus', size: 'sm', variant: 'primary', 'data-course': 'new-chart', onClick: newChart })));
          slots.left.appendChild(h('div', { class: 'dm-list' },
            h('button', { type: 'button', class: 'dm-list-item', 'aria-current': view === 'gallery' ? 'true' : null, onclick: () => openGallery() }, ui.icon('layout-grid', 16), h('span', { class: 'dm-list-main' }, h('span', { text: t('viz.gallery') }), h('span', { class: 'dm-list-sub', text: t('viz.count', { n: list.length }) }))),
            list.map((c) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': view === 'chart' && chart && chart.id === c.id ? 'true' : null, onclick: () => openChart(c) },
              ui.icon(kindIcon(c.kind), 16),
              h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.name }), h('span', { class: 'dm-list-sub dm-truncate', text: c.datasetName || '' }))))));
          slots.left.appendChild(h('div', { class: 'dm-row' }, ui.button({ label: t('viz.import'), icon: 'upload', size: 'sm', onClick: importChart })));
          slots.left.appendChild(h('hr'));
          slots.left.appendChild(h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('dash.title') }), ui.button({ label: t('dash.new'), icon: 'plus', size: 'sm', onClick: newDashboard })));
          slots.left.appendChild(h('div', { class: 'dm-list' }, dashList.map((d) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': view === 'dashboard' && dashboard && dashboard.id === d.id ? 'true' : null, onclick: () => openDashboard(d) },
            ui.icon('layout-grid', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: d.name }), h('span', { class: 'dm-list-sub dm-truncate', text: t('viz.count', { n: (d.items || []).length }) }))))));
          slots.left.appendChild(h('div', { class: 'dm-row' }, ui.button({ label: t('dash.import'), icon: 'upload', size: 'sm', onClick: importDashboard })));
        }

        async function newDashboard() {
          if (dirty && !(await confirmDiscard())) return;
          const name = await ui.dialog.prompt(t('dash.new.prompt'), { title: t('dash.new'), value: '' });
          if (!name || !name.trim()) return;
          const saved = await dashboards.save(dashboards.create(name.trim()));
          shell.log(t('dash.saved', { name: saved.name }), 'ok');
          await openDashboard(saved, true);
        }
        async function openDashboard(record, fresh = false) {
          if (!fresh && dirty && !(await confirmDiscard())) return;
          view = 'dashboard'; chart = null; dirty = false; dashboard = record;
          disposePreview(); if (rpanel) { rpanel.destroy(); rpanel = null; }
          render();
        }
        async function importDashboard() {
          const [file] = await services.files.pick({ accept: '.json' });
          if (!file) return;
          try { const d = await dashboards.importJson(await file.text()); shell.log(t('dash.imported', { name: d.name }), 'ok'); await openDashboard(d); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }

        async function newChart() {
          const ds = selectedDataset();
          if (!ds) { ui.toast.show(t('shell.select.dataset'), { kind: 'warn' }); return; }
          if (dirty && !(await confirmDiscard())) return;
          let kind = null;
          const all = store.get().datasets;
          const facetsMod = D.require('data/facets');
          const onMap = await facetsMod.has(ds.id, 'spatial').catch(() => false);
          /** A chart of its own kind needs a dataset of that kind; the panel can pick another one than the selected. */
          const stands = (k) => (k === 'graph' || k === 'model') && ds.kind !== k && !all.some((d) => d.kind === k);
          const fits = (k) => k === D.require('data/kinds').of(ds).chart || (k === 'map' && onMap);
          // A height profile along the lines of a geometry column (F37 c) is offered where a geometry is likely.
          const profiles = ds.kind !== 'graph' && ds.kind !== 'model' && await D.require('viz/profile').likely(ds.id).catch(() => false);
          const order = ['vega', 'map', 'graph', 'model', 'd3', 'r', 'python'].concat(profiles ? ['profile'] : []).sort((a, b) => (Number(stands(a)) - Number(stands(b))) || (Number(fits(b)) - Number(fits(a))));
          // What fits this dataset comes first, as real pictures, drawn one at a time while the dialog is open.
          let suggested = null;
          let closeDialog = null;
          const suggestions = h('div', { class: 'dm-suggest-grid' });
          const suggestHead = h('h4', { text: t('viz.suggest.title'), hidden: '' });
          const suggest = D.require('viz/suggest');
          suggest.forDataset(ds).then(async (list) => {
            if (list.length) suggestHead.hidden = false;
            for (const item of list) {
              const picture = h('div', { class: 'dm-suggest-picture' });
              suggestions.appendChild(h('button', { type: 'button', class: 'dm-suggest', onclick: () => { suggested = item.chart; if (closeDialog) closeDialog(false); } }, picture, h('span', { class: 'dm-small', text: t(item.key, item.params) })));
              const text = await suggest.preview(item.chart).catch((err) => { D.log('suggest', err); return null; });
              if (text) picture.appendChild(D.require('ui/kinds/sketches').imageOfSvg(text, t(item.key, item.params)));
              else picture.appendChild(ui.icon(D.require('data/kinds').of(ds).icon, 32));
            }
          }).catch((err) => D.log('suggest', err));
          const body = (finish) => { closeDialog = finish; return h('div', { class: 'dm-stack' }, suggestHead, suggestions, h('h4', { text: t('viz.suggest.own') }), kindTiles); };
          const kindTiles = h('div', { class: 'dm-stack-sm' }, order.map((k) => h('button', { type: 'button', class: 'dm-op-tile', 'data-kind': k, disabled: stands(k) ? '' : null, onclick: () => { kind = k; if (closeDialog) closeDialog(false); } },
            h('strong', { text: t('viz.kind.' + k) }), h('span', { class: 'dm-help', text: stands(k) ? t('viz.kind.need.' + k) : t('viz.kind.' + k + '.help') }))));
          await ui.dialog.open({ title: t('viz.new.title'), help: 'visualisera#skapa-ett-diagram', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }] });
          if (suggested) { await openChart(suggested, true); return; }
          if (!kind) return;
          if (kind === 'profile') { const made = await D.require('ui/viz/profile-dialog').open({ shell }, ds); if (made) await openChart(made.chart); return; }
          // A graph or model chart starts from a dataset it can draw.
          const source = (kind === 'graph' || kind === 'model') && ds.kind !== kind ? store.get().datasets.find((d) => d.kind === kind) : ds;
          const record = charts.create(kind, source, `${source.name}: ${t('viz.kind.badge.' + kind)}`);
          // A chart of a time series starts as one.
          if (kind === 'vega' && await facetsMod.has(source.id, 'timeseries').catch(() => false)) record.vega.type = 'timeseries';
          await openChart(record, true);
        }
        async function importChart() {
          const [file] = await services.files.pick({ accept: '.json' });
          if (!file) return;
          try { const c = await charts.importJson(await file.text()); shell.log(t('viz.imported', { name: c.name }), 'ok'); await openChart(c); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }
        async function confirmDiscard() { return ui.dialog.confirm(t('viz.unsaved'), { okLabel: t('common.ok') }); }

        async function openGallery() {
          if (dirty && !(await confirmDiscard())) return;
          view = 'gallery'; chart = null; dirty = false; dashboard = null;
          disposePreview(); if (rpanel) { rpanel.destroy(); rpanel = null; }
          render();
        }
        async function openChart(record, fresh = false) {
          if (!fresh && dirty && !(await confirmDiscard())) return;
          view = 'chart'; chart = JSON.parse(JSON.stringify(record)); dirty = fresh; dashboard = null;
          disposePreview(); if (rpanel) { rpanel.destroy(); rpanel = null; } controls = null;
          columns = chart.datasetId ? await D.require('viz/data').columnsOf(chart.datasetId, chart.kind === 'vega' && chart.vega ? chart.vega.table : null).catch(() => []) : [];
          if (chart.kind === 'vega' && !chart.vega.state) chart.vega.state = builder.defaultState(chart.vega.type || 'bar', columns);
          if (chart.kind === 'map' && !chart.map) chart.map = leaflet.defaultMap(columns, { id: chart.datasetId, name: chart.datasetName, shortName: chart.datasetShort });
          render();
          if (!isPanel(chart.kind)) schedulePreview(0);
        }

        // ---- centre ----
        function renderCenter() {
          if (view !== 'dashboard' && dashView) { dashView.destroy(); dashView = null; }
          if (view === 'dashboard' && dashboard) {
            if (dashView) dashView.destroy();
            dashView = dashboardView.create({ dashboard, onOpenChart: (c) => openChart(c), onDeleted: () => openGallery(), log: (m, k) => shell.log(m, k) });
            replace(slots.center, dashView.el);
            dashView.start().then(() => renderRight()).catch((err) => shell.log(String((err && err.message) || err), 'error'));
            return;
          }
          if (view === 'gallery') {
            if (gallery) gallery.destroy();
            gallery = galleryMod.create({ charts: list, onOpen: (c) => openChart(c), onExport: (c) => exportDialog.exportChart(c), onDelete: (c) => removeChart(c) });
            replace(slots.center, gallery.el);
            return;
          }
          if (!chart) return;
          const missing = !columns.length;
          nameInput = /** @type {any} */ (h('dm-input', { 'aria-label': t('viz.name'), placeholder: t('viz.name'), inline: true }));
          nameInput.value = chart.name || '';
          nameInput.addEventListener('input', () => { chart.name = nameInput.value; dirty = true; });
          const saveBtn = ui.button({ label: t('viz.save'), icon: 'save', variant: 'primary', onClick: saveChart });
          // A graph's edges and a model's quantities can be charted as well as its main table.
          const chartTables = chart.kind === 'vega' ? (D.require('data/kinds').of(store.get().datasets.find((d) => d.id === chart.datasetId)).chartTables || []) : [];
          const tableSel = chartTables.length ? /** @type {any} */ (h('dm-select', { label: t('viz.table'), inline: true })) : null;
          if (tableSel) {
            tableSel.options = [{ value: '', label: t('viz.table.data') }].concat(chartTables.map((x) => ({ value: x, label: t('viz.table.' + x) })));
            tableSel.value = chart.vega.table || '';
            tableSel.addEventListener('change', () => { chart.vega.table = tableSel.value || null; chart.vega.state = null; chart.vega.customSpec = null; dirty = true; openChart(chart, true).catch((err) => shell.log(String((err && err.message) || err), 'error')); });
          }
          const head = h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon(kindIcon(chart.kind), 20), nameInput, h('dm-badge', { text: t('viz.kind.badge.' + chart.kind) })),
            h('div', { class: 'dm-row-wrap' },
              tableSel,
              saveBtn,
              ui.button({ label: t('viz.export'), icon: 'download', onClick: () => exportDialog.exportChart(chart, { rExport: rpanel ? rpanel.exportBlob : undefined }) }),
              ui.button({ label: t('viz.batch'), icon: 'layers', onClick: () => exportDialog.batchChart(chart, { rExport: rpanel ? rpanel.exportBlob : undefined }) }),
              ui.button({ label: t('api.export'), icon: 'file-output', variant: 'ghost', onClick: () => files.download(new Blob([charts.exportJson(chart)], { type: 'application/json' }), files.safeName(chart.name || 'diagram', 'viz.json')) }),
              chart.id ? ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: () => removeChart(chart) }) : null));
          if (missing) { replace(slots.center, head, h('div', { class: 'dm-card' }, h('p', { class: 'dm-error', text: t('viz.dataset.missing') }))); return; }
          previewEl = h('div', { class: 'dm-chart-preview' }, h('p', { class: 'dm-help', text: t('viz.preview.empty') }));
          infoEl = h('p', { class: 'dm-help' });
          let controlsEl;
          if (chart.kind === 'vega') {
            controls = vegaControls.create({ columns, datasetId: chart.datasetId, state: chart.vega.state, customSpec: chart.vega.customSpec || null, onChange: (state, customSpec) => { chart.vega.state = state; chart.vega.customSpec = customSpec; dirty = true; schedulePreview(); } });
            controlsEl = controls.el;
          } else if (chart.kind === 'd3') {
            controls = d3Controls.create({ columns, template: chart.d3.template, params: chart.d3.params, filters: (chart.options && chart.options.filters) || [], onChange: (template, params, filters) => { chart.d3.template = template; chart.d3.params = params; chart.options = Object.assign({}, chart.options, { filters }); dirty = true; schedulePreview(); } });
            controlsEl = controls.el;
          } else if (chart.kind === 'python') {
            rpanel = pyPanel.create({ chart, columns, onChange: (code, plotly) => { chart.python.code = code; chart.python.plotly = plotly; dirty = true; }, log: (m, k) => shell.log(m, k) });
            controlsEl = null;
          } else if (chart.kind === 'map') {
            rpanel = mapPanel.create({ chart, columns, onChange: (def) => { chart.map = def; dirty = true; }, log: (m, k) => shell.log(m, k), onInspect: () => renderRight() });
            controlsEl = null;
          } else if (chart.kind === 'model') {
            rpanel = modelChartPanel.create({ chart, onChange: (def) => { chart.model = def; dirty = true; }, log: (m, k) => shell.log(m, k), onInspect: () => renderRight() });
            controlsEl = null;
          } else if (chart.kind === 'graph') {
            rpanel = graphChartPanel.create({ chart, onChange: (def) => { chart.graph = def; dirty = true; }, log: (m, k) => shell.log(m, k), onInspect: () => renderRight() });
            controlsEl = null;
          } else {
            rpanel = rPanel.create({ chart, columns, onChange: (code) => { chart.r.code = code; dirty = true; }, log: (m, k) => shell.log(m, k) });
            controlsEl = null;
          }
          replace(slots.center, head,
            isPanel(chart.kind) ? rpanel.el : h('div', { class: 'dm-viz-layout' }, h('div', { class: 'dm-viz-side' }, controlsEl), h('div', { class: 'dm-viz-main' }, previewEl, infoEl)));
        }

        function schedulePreview(delay = 300) { clearTimeout(renderTimer); renderTimer = setTimeout(renderPreview, delay); }
        async function renderPreview() {
          if (!previewEl || !chart || isPanel(chart.kind)) return;
          const seq = ++renderSeq;
          if (chart.kind === 'vega' && !chart.vega.customSpec) {
            const problems = builder.validate(chart.vega.state);
            if (problems.length) { replace(previewEl, h('p', { class: 'dm-help', text: t('viz.problem', { text: problems.join(' ') }) })); infoEl.textContent = ''; return; }
          }
          previewEl.classList.add('dm-rendering');
          try {
            disposePreview();
            const hd = await vizRender.renderInto(chart, previewEl, {});
            if (seq !== renderSeq) { hd.finalize(); return; }
            handle = hd;
            const info = hd.info || {};
            infoEl.textContent = [t('viz.rows.used', { rows: i18n.formatNumber(info.rows || 0), total: i18n.formatNumber(info.total || 0) }), info.aggregated ? t('viz.rows.aggregated') : '', info.truncated && !info.aggregated ? t('viz.rows.truncated', { rows: i18n.formatNumber(info.rows || 0) }) : ''].filter(Boolean).join(' · ');
            renderRight();
          } catch (err) {
            if (seq === renderSeq) replace(previewEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          } finally { previewEl.classList.remove('dm-rendering'); }
        }

        async function saveChart() {
          if (!chart) return;
          chart.name = nameInput ? nameInput.value.trim() || chart.name : chart.name;
          if (chart.kind === 'vega' && !chart.vega.customSpec) { const problems = builder.validate(chart.vega.state); if (problems.length) { ui.toast.show(problems.join(' '), { kind: 'warn' }); return; } }
          try {
            chart.thumbnail = isPanel(chart.kind) ? (rpanel ? await rpanel.thumbnail() : chart.thumbnail) : await vizRender.thumbnail(chart);
            const saved = await charts.save(chart);
            chart.id = saved.id; chart.createdAt = saved.createdAt; chart.updatedAt = saved.updatedAt; dirty = false;
            shell.log(t('viz.saved.toast', { name: saved.name }), 'ok'); ui.toast.show(t('viz.saved.toast', { name: saved.name }), { kind: 'ok' });
            renderLeft();
          } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }
        async function removeChart(c) {
          if (!c.id) return;
          if (!(await ui.dialog.confirm(t('viz.delete.confirm', { name: c.name }), { okLabel: t('common.delete'), danger: true }))) return;
          await charts.remove(c.id);
          shell.log(t('viz.deleted'), 'ok');
          if (chart && chart.id === c.id) { dirty = false; await openGallery(); }
        }

        // ---- right ----
        function renderRight() {
          if (!slots) return;
          if (view === 'dashboard' && dashView) { replace(slots.right, dashView.inspector()); return; }
          if (view === 'gallery' || !chart) { replace(slots.right, h('p', { class: 'dm-help', text: t('mode.visualisera.desc') })); return; }
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [{ label: t('shell.datasets'), value: chart.datasetName || '–' }, { label: t('common.type'), value: t('viz.kind.' + chart.kind) }, chart.updatedAt ? { label: t('common.updated'), value: i18n.formatDateTime(chart.updatedAt) } : null].filter(Boolean);
          const spec = handle && handle.info && handle.info.spec ? JSON.stringify(Object.assign({}, handle.info.spec, { data: { values: '…' } }), null, 2) : null;
          replace(slots.right,
            h('h4', { text: chart.name || t('viz.name') }), kv,
            h('p', { class: 'dm-help', text: t('viz.kind.' + chart.kind + '.help') }),
            rpanel && rpanel.inspector ? rpanel.inspector() : null,
            spec ? h('details', { class: 'dm-more' }, h('summary', { text: t('viz.spec') }), h('pre', { class: 'dm-viz-spec', text: spec })) : null);
        }

        // Command palette: new chart, gallery, every saved chart and every dashboard.
        if (ctx.palette) {
          ctx.palette.register(async () => {
            const ds = selectedDataset();
            const cmds = [];
            if (ds) cmds.push({ id: 'viz:new', label: t('viz.new'), hint: ds.name, group: t('palette.group.charts'), icon: 'plus', run: async () => { shell.activate('visualisera'); await newChart(); } });
            cmds.push({ id: 'viz:gallery', label: t('viz.gallery'), group: t('palette.group.charts'), icon: 'layout-grid', run: async () => { shell.activate('visualisera'); await openGallery(); } });
            for (const c of await charts.list()) cmds.push({ id: 'chart:' + c.id, label: t('palette.chart.open', { name: c.name }), hint: c.datasetName || '', group: t('palette.group.charts'), icon: kindIcon(c.kind), run: async () => { shell.activate('visualisera'); await openChart(c); } });
            cmds.push({ id: 'dash:new', label: t('dash.new'), group: t('palette.group.dashboards'), icon: 'plus', run: async () => { shell.activate('visualisera'); await newDashboard(); } });
            for (const d of await dashboards.list()) cmds.push({ id: 'dash:' + d.id, label: t('palette.dash.open', { name: d.name }), hint: t('viz.count', { n: (d.items || []).length }), group: t('palette.group.dashboards'), icon: 'layout-grid', run: async () => { shell.activate('visualisera'); await openDashboard(d); } });
            for (const d of await dashboards.list()) cmds.push({ id: 'present:' + d.id, label: t('present.palette', { name: d.name }), group: t('palette.group.dashboards'), icon: 'monitor', run: async () => { const fresh = await dashboards.get(d.id); if (fresh) await D.require('ui/viz/present').open(fresh, { log: (m, k) => shell.log(m, k) }); } });
            return cmds;
          });
        }

        return { id: 'visualisera', activate, deactivate };
      }
      return { createMode };
    });
})();
