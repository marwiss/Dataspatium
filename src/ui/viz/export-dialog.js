// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dialogs for chart export (SVG, PNG, PDF with size and scale) and batch generation (one chart per
 * group value into a ZIP). Used by Visualisera and Exportera.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/export-dialog', ['ui/base', 'ui/basic', 'ui/overlays', 'viz/render', 'viz/batch', 'platform/files', 'data/datasets', 'viz/pptx'], (base, basic, overlays, render, batch, files, datasets, pptx) => {
    const { h, t, i18n, replace } = base;

    /**
     * Export one chart. `options.rExport(format, {width, height})` handles R charts (returns a Blob).
     * @param {any} chart @param {{rExport?: Function, defaultWidth?: number}} [options]
     */
    async function exportChart(chart, options = {}) {
      const format = /** @type {any} */ (h('dm-select', { label: t('viz.export.format') }));
      format.options = [{ value: 'png', label: 'PNG' }, { value: 'svg', label: 'SVG' }, { value: 'pdf', label: 'PDF' }, { value: 'pptx', label: t('viz.export.pptx') }];
      format.value = 'png';
      const width = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.export.width'), min: '200', max: '4000' }));
      width.value = String(options.defaultWidth || 960);
      const height = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.export.height'), min: '100', max: '4000', help: chart.kind === 'vega' ? t('viz.export.height.vega') : '' }));
      height.value = chart.kind === 'vega' ? String((chart.vega && chart.vega.state && chart.vega.state.height) || 360) : '';
      const scale = /** @type {any} */ (h('dm-select', { label: t('viz.export.scale') }));
      scale.options = [{ value: '1', label: '1×' }, { value: '2', label: t('viz.export.scale.standard') }, { value: '3', label: '3×' }];
      scale.value = '2';
      const filename = /** @type {any} */ (h('dm-input', { label: t('viz.export.filename') }));
      filename.value = files.safeName(chart.name || 'diagram');
      const body = h('div', { class: 'dm-stack' },
        chart.kind === 'r' ? h('p', { class: 'dm-help', text: t('viz.export.r.note') }) : null,
        h('div', { class: 'dm-form-grid' }, format, width, chart.kind === 'r' ? null : height, scale, filename));
      const ok = await overlays.dialog.open({ help: 'visualisera#exportera', title: t('viz.export.title', { name: chart.name || '' }), body, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.download'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return null;
      const fmt = format.value;
      const opts = { width: Number(width.value) || 960, height: Number(height.value) || undefined, scale: Number(scale.value) || 2 };
      try {
        let blob;
        if (fmt === 'pptx') {
          if (chart.kind === 'r') { const png = await options.rExport('png', opts); blob = await pptx.build({ title: chart.name, slides: [{ title: chart.name, png, note: chart.datasetName || '' }] }); }
          else blob = (await pptx.fromCharts([chart], { title: chart.name, subtitle: chart.datasetName || '', width: opts.width })).blob;
        } else {
          blob = chart.kind === 'r' ? await options.rExport(fmt, opts) : await render.toBlob(chart, fmt, opts);
        }
        const name = files.safeName(filename.value.trim() || chart.name || 'diagram', fmt);
        files.download(blob, name);
        overlays.toast.show(t('viz.export.done', { name }), { kind: 'ok' });
        return name;
      } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); return null; }
    }

    /** Batch dialog: group column, formats, naming pattern; runs with progress and downloads the ZIP. */
    async function batchChart(chart, options = {}) {
      const columns = chart.datasetId ? await datasets.columns(chart.datasetId).catch(() => []) : [];
      if (!columns.length) { overlays.toast.show(t('viz.dataset.missing'), { kind: 'warn' }); return null; }
      const column = /** @type {any} */ (h('dm-select', { label: t('viz.batch.column') }));
      column.options = columns.filter((c) => c.type !== 'number').map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` }));
      const preferred = columns.find((c) => /^(kommun|region|lan|län|ar|år|year|grupp)$/i.test(c.name));
      column.value = preferred ? preferred.name : (column.options[0] ? column.options[0].value : '');
      const formats = { png: true, svg: false, pdf: false, pptx: false };
      const formatSwitches = Object.keys(formats).map((f) => { const sw = /** @type {any} */ (h('dm-switch', { label: f === 'pptx' ? 'PowerPoint' : f.toUpperCase() })); sw.checked = formats[f]; sw.addEventListener('change', () => { formats[f] = sw.checked; }); return sw; });
      const pattern = /** @type {any} */ (h('dm-input', { label: t('viz.batch.pattern'), help: t('viz.batch.pattern.help') }));
      pattern.value = '{diagram}-{grupp}';
      const width = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.export.width'), min: '200', max: '4000' }));
      width.value = '960';
      const limit = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.batch.limit'), min: '1', max: '5000' }));
      limit.value = '500';
      const progress = h('div', { class: 'dm-stack-sm' });
      const body = h('div', { class: 'dm-stack' },
        h('p', { class: 'dm-help', text: t('viz.batch.help') }),
        h('div', { class: 'dm-form-grid' }, column, pattern, width, limit),
        h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('viz.batch.formats') }), h('div', { class: 'dm-row-wrap' }, formatSwitches), h('p', { class: 'dm-help dm-xs', text: t('viz.batch.pptx.help') })),
        progress);
      const ok = await overlays.dialog.open({ title: t('viz.batch.title'), help: 'visualisera#batch-per-grupp', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('viz.batch.run'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return null;
      const chosen = Object.keys(formats).filter((f) => formats[f]);
      if (!chosen.length || !column.value) { overlays.toast.show(t('op.missing', { fields: t('viz.batch.formats') }), { kind: 'warn' }); return null; }
      const fileFormats = chosen.filter((f) => f !== 'pptx');
      const abort = new AbortController();
      const toast = overlays.toast.show(t('viz.batch.progress', { done: 0, total: '?', value: '' }), { kind: 'info', timeout: 0, action: { label: t('api.cancel'), onClick: () => abort.abort() } });
      try {
        const common = {
          groupColumn: column.value, width: Number(width.value) || 960, limit: Number(limit.value) || 500, signal: abort.signal,
          onProgress: (p) => { const text = toast.querySelector('.dm-toast-text'); if (text) text.textContent = t('viz.batch.progress', { done: p.done, total: p.total, value: p.value }); },
          renderR: options.rExport ? (c, value, format) => options.rExport(format, { width: Number(width.value) || 960, group: { column: column.value, value } }) : undefined,
        };
        let result = null;
        if (fileFormats.length) {
          result = await batch.run(chart, Object.assign({ formats: fileFormats, pattern: pattern.value }, common));
          const name = files.safeName(t('viz.batch.file', { name: chart.name || t('viz.chart.word').toLowerCase(), column: column.value }), 'zip');
          files.download(result.blob, name);
          overlays.toast.show(t('viz.batch.done', { n: result.count, name }) + (result.errors.length ? ' ' + t('viz.batch.errors', { n: result.errors.length }) : ''), { kind: result.errors.length ? 'warn' : 'ok', timeout: 10000 });
        }
        if (chosen.includes('pptx')) {
          // One presentation with a slide per group rather than one file per group.
          const deck = await batch.deck(chart, common);
          const name = files.safeName(t('viz.batch.file', { name: chart.name || t('viz.chart.word').toLowerCase(), column: column.value }), 'pptx');
          files.download(deck.blob, name);
          overlays.toast.show(t('viz.export.pptx.done', { name, n: deck.count }) + (deck.errors.length ? ' ' + t('viz.batch.errors', { n: deck.errors.length }) : ''), { kind: deck.errors.length ? 'warn' : 'ok', timeout: 10000 });
          if (!result) result = { blob: deck.blob, count: deck.count, files: [name], errors: deck.errors };
        }
        return result;
      } catch (err) {
        if (!(err && err.kind === 'aborted')) overlays.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 });
        return null;
      } finally { toast.remove(); }
    }

    return { exportChart, batchChart, formatNumber: i18n.formatNumber, replace, basic };
  });
})();
