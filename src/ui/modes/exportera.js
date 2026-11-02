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
  D.define('ui/modes/exportera', ['ui/base', 'io/export', 'viz/charts', 'ui/viz/export-dialog', 'ui/docs/document-panel'], (base, exporter, charts, exportDialog, documentPanel) => {
    const { h, t, i18n, replace } = base;

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubscribe = null; let unsubCharts = null;
      const form = { format: 'csv', profile: 'excel-sv', filename: '' };
      let chartList = [];
      let tab = 'data';
      let docPanel = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) { render(); } });
        unsubCharts = charts.subscribe(() => charts.list().then((l) => { chartList = l; if (tab === 'charts') render(); }));
        charts.list().then((l) => { chartList = l; if (tab === 'charts') render(); });
        render();
      }
      function deactivate() { slots = null; if (unsubscribe) unsubscribe(); if (unsubCharts) unsubCharts(); if (docPanel) { docPanel.destroy(); docPanel = null; } }

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
        return h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('export.charts.saved') }),
          chartList.length ? h('div', { class: 'dm-list' }, chartList.map((c) => h('div', { class: 'dm-list-item', style: { cursor: 'default' } },
            ui.icon(c.kind === 'r' ? 'terminal' : 'chart-column', 16),
            h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.name }), h('span', { class: 'dm-list-sub dm-truncate', text: [t('viz.kind.badge.' + c.kind), c.datasetName].filter(Boolean).join(' · ') })),
            h('span', { class: 'dm-row' },
              c.kind !== 'r' ? ui.button({ label: t('viz.export'), icon: 'download', size: 'sm', onClick: () => exportDialog.exportChart(c) }) : null,
              c.kind !== 'r' ? ui.button({ label: t('viz.batch'), icon: 'layers', size: 'sm', onClick: () => exportDialog.batchChart(c) }) : null,
              c.kind === 'r' ? ui.button({ label: t('export.charts.open'), size: 'sm', onClick: () => shell.activate('visualisera') }) : null))))
            : h('p', { class: 'dm-help', text: t('export.charts.none') }));
      }

      function dataForm(ds) {
        const fmt = exporter.FORMATS.find((f) => f.id === form.format) || exporter.FORMATS[0];
        const formatSel = /** @type {any} */ (h('dm-select', { label: t('export.format') }));
        formatSel.options = exporter.FORMATS.map((f) => ({ value: f.id, label: t(f.key) }));
        formatSel.value = form.format;
        formatSel.addEventListener('change', () => { form.format = formatSel.value; form.filename = ''; render(); });
        const profileSel = /** @type {any} */ (h('dm-select', { label: t('export.profile') }));
        profileSel.options = [{ value: 'excel-sv', label: t('export.csv.excel') }, { value: 'standard', label: t('export.csv.standard') }];
        profileSel.value = form.profile;
        profileSel.addEventListener('change', () => { form.profile = profileSel.value; });
        const filename = /** @type {any} */ (h('dm-input', { label: t('export.filename'), value: form.filename || services.files.safeName(ds.name, fmt.ext) }));
        filename.addEventListener('input', () => { form.filename = filename.value; });
        const runBtn = ui.button({ label: t('export.run'), icon: 'download', variant: 'primary', onClick: async () => {
          runBtn.loading = true;
          try {
            const options = form.format === 'csv' ? (form.profile === 'excel-sv' ? { delimiter: ';', decimal: 'comma', bom: true } : { delimiter: ',', decimal: 'point', bom: false }) : {};
            const { blob, filename: name } = await services.exporter.exportDataset(ds.id, form.format, Object.assign(options, { filename: filename.value.trim() || undefined }));
            services.files.download(blob, name);
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

      return { id: 'exportera', activate, deactivate };
    }
    return { createMode };
  });
})();
