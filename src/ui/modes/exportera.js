// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Exportera": three tabs. Data: download a dataset as CSV (Swedish Excel profile or standard),
 * Excel, JSON or the SQLite file. Diagram: export saved charts, single or in batch. Dokument: generate
 * documents from templates in HTML, Word, PDF, Markdown or LaTeX, single or in batch.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/exportera', ['ui/base', 'io/export', 'viz/charts', 'ui/viz/export-dialog', 'ui/docs/document-panel', 'viz/dashboards', 'viz/pptx'], (base, exporter, charts, exportDialog, documentPanel, dashboards, pptx) => {
    const { h, t, i18n, replace } = base;

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubscribe = null; let unsubCharts = null;
      const form = { format: 'csv', profile: 'excel-sv', filename: '' };
      let chartList = []; let dashList = []; let unsubDash = null;
      let tab = 'data';
      let docPanel = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) { render(); } });
        unsubCharts = charts.subscribe(() => charts.list().then((l) => { chartList = l; if (tab === 'charts') render(); }));
        unsubDash = dashboards.subscribe(() => dashboards.list().then((l) => { dashList = l; if (tab === 'charts') render(); }));
        charts.list().then((l) => { chartList = l; if (tab === 'charts') render(); });
        dashboards.list().then((l) => { dashList = l; if (tab === 'charts') render(); });
        render();
      }
      function deactivate() { slots = null; if (unsubscribe) unsubscribe(); if (unsubCharts) unsubCharts(); if (unsubDash) unsubDash(); if (docPanel) { docPanel.destroy(); docPanel = null; } }

      function tabs() {
        const el = /** @type {any} */ (h('dm-tabs'));
        el.tabs = [{ id: 'data', label: t('doc.tab.data'), icon: 'table' }, { id: 'charts', label: t('doc.tab.charts'), icon: 'chart-column' }, { id: 'documents', label: t('doc.tab.documents'), icon: 'file-text' }];
        el.active = tab;
        el.addEventListener('dm-change', (e) => { tab = /** @type {any} */ (e).detail.id; render(); });
        return el;
      }

      function render() {
        if (!slots) return;
        const state = store.get();
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        const ds = state.datasets.find((d) => d.id === state.selectedId);
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('file-output', 20), t('export.title'), ' ', ds ? h('dm-badge', { kind: 'accent', text: ds.name }) : null));
        if (tab === 'charts') {
          replace(slots.center, head, tabs(), chartsCard());
          replace(slots.right, h('p', { class: 'dm-help', text: t('export.charts.help') }));
          return;
        }
        if (tab === 'documents') {
          if (!docPanel) docPanel = documentPanel.create(ctx);
          replace(slots.center, head, tabs(), docPanel.el);
          docPanel.render();
          replace(slots.right, docPanel.helpNodes());
          return;
        }
        if (!ds) {
          replace(slots.center, head, tabs(), h('dm-empty-state', { icon: 'file-output', heading: t('export.title'), text: state.datasets.length ? t('shell.select.dataset') : t('shell.no.datasets.hint') }));
          replace(slots.right, h('p', { class: 'dm-help', text: t('mode.exportera.desc') }));
          return;
        }
        replace(slots.center, head, tabs(), dataForm(ds));
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [{ label: t('datasets.rows'), value: i18n.formatNumber(ds.rowCount || 0) }, { label: t('datasets.columns'), value: String(ds.columnCount || 0) }, { label: t('common.size'), value: i18n.formatBytes(ds.byteSize || 0) }];
        replace(slots.right, h('h4', { text: ds.name }), kv);
      }

      /** Saved charts with export and batch actions. */
      function chartsCard() {
        // Every kind exports headless now; R and Python charts run their script in the engine.
        const exportable = chartList;
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-card dm-stack' },
            h('div', { class: 'dm-row' }, h('h3', { class: 'dm-grow', text: t('export.charts.saved') }), exportable.length ? ui.button({ label: t('viz.export.pptx.all'), icon: 'file-output', size: 'sm', onClick: () => allChartsPptx(exportable) }) : null),
            chartList.length ? h('div', { class: 'dm-list' }, chartList.map((c) => h('div', { class: 'dm-list-item dm-list-item-static' },
              ui.icon(c.kind === 'r' ? 'terminal' : c.kind === 'python' ? 'code' : c.kind === 'map' ? 'map' : 'chart-column', 16),
              h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.name }), h('span', { class: 'dm-list-sub dm-truncate', text: [t('viz.kind.badge.' + c.kind), c.datasetName].filter(Boolean).join(' · ') })),
              h('span', { class: 'dm-row' },
                ui.button({ label: t('viz.export'), icon: 'download', size: 'sm', onClick: () => exportDialog.exportChart(c) }),
                ui.button({ label: t('viz.batch'), icon: 'layers', size: 'sm', onClick: () => exportDialog.batchChart(c) })))))
              : h('p', { class: 'dm-help', text: t('export.charts.none') })),
          h('div', { class: 'dm-card dm-stack' },
            h('h3', { text: t('export.dashboards') }),
            dashList.length ? h('div', { class: 'dm-list' }, dashList.map((d) => h('div', { class: 'dm-list-item dm-list-item-static' },
              ui.icon('layout-grid', 16),
              h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: d.name }), h('span', { class: 'dm-list-sub dm-truncate', text: t('viz.count', { n: (d.items || []).length }) })),
              h('span', { class: 'dm-row' },
                ui.button({ label: t('dash.export.html'), icon: 'file-text', size: 'sm', onClick: () => dashExport(d, 'html') }),
                ui.button({ label: t('dash.export.pptx'), icon: 'file-output', size: 'sm', onClick: () => dashExport(d, 'pptx') })))))
              : h('p', { class: 'dm-help', text: t('export.dashboards.none') })));
      }

      async function allChartsPptx(list) {
        const toast = ui.toast.show(t('common.loading'), { kind: 'info', timeout: 0 });
        try {
          const res = await pptx.fromCharts(list, { title: t('export.charts.saved'), subtitle: t('dash.html.generated', { date: i18n.formatDateTime(new Date()) }) });
          const name = services.files.safeName('dataspatium-diagram', 'pptx');
          services.files.download(res.blob, name);
          shell.log(t('viz.export.pptx.done', { name, n: res.count }), 'ok'); ui.toast.show(t('viz.export.pptx.done', { name, n: res.count }), { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); }
        finally { toast.remove(); }
      }

      async function dashExport(d, kind) {
        const toast = ui.toast.show(t('common.loading'), { kind: 'info', timeout: 0 });
        try {
          const opts = { filtersLabel: t('dash.filters.label'), generatedText: t('dash.html.generated', { date: i18n.formatDateTime(new Date()) }) };
          if (kind === 'html') {
            const blob = await dashboards.toHtml(d, opts);
            const name = services.files.safeName(d.name || 'dashboard', 'html');
            services.files.download(blob, name); ui.toast.show(t('dash.exported', { name }), { kind: 'ok' });
          } else {
            const res = await dashboards.toPptx(d, opts);
            const name = services.files.safeName(d.name || 'dashboard', 'pptx');
            services.files.download(res.blob, name); ui.toast.show(t('viz.export.pptx.done', { name, n: res.count }), { kind: 'ok' });
          }
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); }
        finally { toast.remove(); }
      }

      function dataForm(ds) {
        // Whether GeoJSON can be written takes a look at the data, so the form draws again when the answer is in.
        const factsKey = ds.id + ':' + ds.updatedAt;
        if (form.factsFor !== factsKey) {
          form.factsFor = factsKey; form.facts = {};
          exporter.geometrySource(ds.id).then((source) => { if (form.factsFor === factsKey) { form.facts = { geometry: !!source }; render(); } }).catch((err) => D.log('export', 'geometry', err));
        }
        const available = exporter.formatsFor(ds, form.facts);
        if (!available.some((f) => f.id === form.format && !f.unavailable)) form.format = available[0].id;
        const fmt = available.find((f) => f.id === form.format) || available[0];
        const formatSel = /** @type {any} */ (h('dm-select', { label: t('export.format') }));
        formatSel.options = available.map((f) => ({ value: f.id, label: f.unavailable ? `${t(f.key)}: ${t(f.unavailable)}` : t(f.key), disabled: !!f.unavailable }));
        formatSel.value = form.format;
        formatSel.addEventListener('change', () => { form.format = formatSel.value; form.filename = ''; render(); });
        const profileSel = /** @type {any} */ (h('dm-select', { label: t('export.profile') }));
        profileSel.options = [{ value: 'excel-sv', label: t('export.csv.excel') }, { value: 'standard', label: t('export.csv.standard') }];
        profileSel.value = form.profile;
        profileSel.addEventListener('change', () => { form.profile = profileSel.value; });
        const filename = /** @type {any} */ (h('dm-input', { label: t('export.filename'), value: form.filename || services.files.safeName(ds.name, fmt.ext) }));
        filename.addEventListener('input', () => { form.filename = filename.value; });
        const runBtn = ui.button({ label: t('export.run'), icon: 'download', variant: 'primary', 'data-course': 'export', onClick: async () => {
          runBtn.loading = true;
          try {
            const options = form.format === 'csv' ? (form.profile === 'excel-sv' ? { delimiter: ';', decimal: 'comma', bom: true } : { delimiter: ',', decimal: 'point', bom: false }) : {};
            const { blob, filename: name } = await services.exporter.exportDataset(ds.id, form.format, Object.assign(options, { filename: filename.value.trim() || undefined }));
            services.files.download(blob, name);
            store.set({ lastExport: { at: Date.now(), datasetId: ds.id } });
            shell.log(t('export.done', { name }) + ` (${i18n.formatBytes(blob.size)})`, 'ok');
            ui.toast.show(t('export.done', { name }), { kind: 'ok' });
          } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(t('common.error') + ': ' + ((err && err.message) || err), { kind: 'error' }); }
          runBtn.loading = false;
        } });
        return h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-form-grid' }, formatSel, form.format === 'csv' ? profileSel : null, filename),
          fmt.viaR ? h('p', { class: 'dm-help dm-small', text: t('export.viaR.hint') }) : null,
          h('div', null, runBtn));
      }

      // Command palette: export the selected dataset.
      if (ctx.palette) {
        ctx.palette.register(() => {
          const state = store.get();
          const ds = state.datasets.find((d) => d.id === state.selectedId);
          return ds ? [{ id: 'export:data', label: t('palette.export.data', { name: ds.name }), group: t('palette.group.export'), icon: 'file-output', run: () => { tab = 'data'; shell.activate('exportera'); } }] : [];
        });
      }

      return { id: 'exportera', activate, deactivate };
    }
    return { createMode };
  });
})();
