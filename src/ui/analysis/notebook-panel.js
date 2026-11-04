// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Notebook panel for Analysera: cells of Markdown, R and SQL in order, each with its own editor, run
 * button and outputs; a toolbar for running everything, adding cells and exporting; and an inspector with
 * the dataset binding. Changes are saved automatically.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/notebook-panel', ['ui/base', 'ui/basic', 'ui/icons', 'ui/overlays', 'analysis/notebooks', 'platform/files'], (base, basic, icons, overlays, notebooks, files) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 50;

    /**
     * @param {any} ctx shell context (store, shell)
     * @param {{notebook: any, onDeleted: () => void, onSaved?: (nb: any) => void, log: (message: string, kind?: string) => void}} options
     */
    function create(ctx, options) {
      const { store, shell } = ctx;
      let nb = JSON.parse(JSON.stringify(options.notebook));
      let saveTimer = 0; let running = false;
      const editors = new Map();
      const headEl = h('div', { class: 'dm-page-head' });
      const cellsEl = h('div', { class: 'dm-nb-cells' });
      const bodyEl = h('div', { class: 'dm-stack dm-nb' }, cellsEl);

      function destroy() { clearTimeout(saveTimer); editors.clear(); }
      function syncSources() { for (const c of nb.cells) { const ed = editors.get(c.id); if (ed) c.source = ed.value; } }

      /** Persist shortly after a change (immediately after runs and structural edits). */
      function changed(immediate = false) {
        clearTimeout(saveTimer);
        const doSave = async () => {
          syncSources();
          try { const saved = await notebooks.save(nb); nb.id = saved.id; nb.updatedAt = saved.updatedAt; nb.createdAt = saved.createdAt; if (options.onSaved) options.onSaved(saved); }
          catch (err) { options.log(String((err && err.message) || err), 'error'); }
        };
        if (immediate) return doSave();
        saveTimer = setTimeout(doSave, 600);
        return Promise.resolve();
      }

      function start() { renderHead(); renderCells(); }

      function renderHead() {
        const nameInput = /** @type {any} */ (h('dm-input', { 'aria-label': t('viz.name'), placeholder: t('nb.new.prompt'), inline: true }));
        nameInput.value = nb.name || '';
        nameInput.addEventListener('change', () => { nb.name = nameInput.value.trim() || nb.name; changed(); });
        replace(headEl,
          h('h1', null, icons.icon('file-text', 20), nameInput, h('dm-badge', { text: t('nb.cells', { n: nb.cells.length }) })),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('nb.run.all'), icon: 'play', variant: 'primary', onClick: runAll }),
            basic.button({ label: t('nb.add.markdown'), icon: 'plus', onClick: () => addCell('markdown') }),
            basic.button({ label: t('nb.add.r'), icon: 'plus', onClick: () => addCell('r') }),
            basic.button({ label: t('nb.add.python'), icon: 'plus', onClick: () => addCell('python') }),
            basic.button({ label: t('nb.add.sql'), icon: 'plus', onClick: () => addCell('sql') }),
            basic.button({ label: t('nb.export'), icon: 'file-output', onClick: exportDialog }),
            basic.button({ label: t('nb.share'), icon: 'upload', variant: 'ghost', onClick: shareJson }),
            basic.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: removeNb })));
      }

      function renderCells() {
        editors.clear();
        replace(cellsEl, nb.cells.length ? nb.cells.map((c, i) => cellEl(c, i)) : h('dm-empty-state', { icon: 'file-text', heading: nb.name || t('nb.title'), text: t('nb.empty') }, basic.button({ label: t('nb.add.markdown'), icon: 'plus', onClick: () => addCell('markdown') })));
      }

      function cellEl(c, index) {
        const typeSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('nb.cell.type'), inline: true }));
        typeSel.options = notebooks.CELL_TYPES.map((ty) => ({ value: ty, label: t('nb.cell.' + ty) }));
        typeSel.value = c.type;
        typeSel.addEventListener('change', () => { syncSources(); c.type = typeSel.value; c.outputs = []; changed(true); renderCells(); });
        const outputEl = h('div', { class: 'dm-nb-output' }, outputNodes(c));
        const head = h('div', { class: 'dm-nb-cell-head' },
          h('dm-badge', { text: String(index + 1) }), typeSel, h('span', { class: 'dm-grow' }),
          c.type === 'markdown' ? null : basic.button({ label: t('nb.run'), icon: 'play', size: 'sm', onClick: () => runOne(c) }),
          basic.button({ label: t('nb.cell.up'), icon: 'arrow-up', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index === 0, onClick: () => moveCell(index, -1) }),
          basic.button({ label: t('nb.cell.down'), icon: 'arrow-down', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index === nb.cells.length - 1, onClick: () => moveCell(index, 1) }),
          basic.button({ label: t('nb.cell.delete'), icon: 'trash-2', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => deleteCell(index) }));
        let editor; let preview = null;
        if (c.type === 'markdown') {
          editor = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: String(Math.min(16, Math.max(3, String(c.source || '').split('\n').length + 1))), 'aria-label': t('nb.cell.markdown'), placeholder: t('nb.cell.placeholder.markdown') }));
          editor.value = c.source || '';
          preview = h('div', { class: 'dm-nb-md dm-prose' }, notebooks.renderMarkdown(c.source || ''));
          editor.addEventListener('input', () => { c.source = editor.value; replace(preview, notebooks.renderMarkdown(c.source)); changed(); });
        } else {
          editor = /** @type {any} */ (h('dm-code', { language: c.type, placeholder: t('nb.cell.placeholder.' + c.type) }));
          editor.value = c.source || '';
          editor.addEventListener('dm-change', () => { c.source = editor.value; changed(); });
          editor.addEventListener('dm-run', () => runOne(c));
        }
        editors.set(c.id, editor);
        const section = h('section', { class: 'dm-nb-cell dm-card', 'data-type': c.type, 'data-cell': c.id }, head, editor, preview || outputEl);
        return section;
      }

      function outputNodes(c) {
        const nodes = [];
        for (const o of c.outputs || []) {
          if (o.kind === 'text') nodes.push(h('pre', { class: 'dm-console-stdout', text: o.text }));
          else if (o.kind === 'error') nodes.push(h('pre', { class: 'dm-console-error', text: o.text }));
          else if (o.kind === 'image') nodes.push(h('img', { class: 'dm-nb-plot', src: o.dataUrl, alt: '' }));
          else if (o.kind === 'dataset') nodes.push(h('div', { class: 'dm-console-dataset' }, icons.icon('table', 14), h('span', { text: t('nb.output.dataset', { name: o.name, rows: i18n.formatNumber(o.rows || 0) }) }), basic.button({ label: t('analysera.open.bearbeta'), size: 'sm', onClick: () => { store.set({ selectedId: o.id }); shell.activate('bearbeta'); } })));
          else if (o.kind === 'table') {
            const rows = (o.rows || []).slice(0, PREVIEW_ROWS);
            const numeric = o.columns.map((_, i) => rows.some((r) => typeof r[i] === 'number'));
            nodes.push(h('div', { class: 'dm-table-wrap' }, h('table', { class: 'dm-nb-table' },
              h('thead', null, h('tr', null, o.columns.map((name, i) => h('th', { class: numeric[i] ? 'num' : null, text: name })))),
              h('tbody', null, rows.map((r) => h('tr', null, r.map((v, i) => h('td', { class: numeric[i] ? 'num' : null, text: v === null || v === undefined ? '' : typeof v === 'number' ? i18n.formatNumber(v) : String(v) }))))))));
            nodes.push(h('div', { class: 'dm-console-meta', text: t('nb.output.rows', { n: i18n.formatNumber((o.rows || []).length) + (o.truncated ? '+' : ''), more: (o.rows || []).length > PREVIEW_ROWS ? t('nb.output.truncated', { n: PREVIEW_ROWS }) : '' }) }));
          }
        }
        if (c.ran) nodes.push(h('div', { class: 'dm-console-meta', text: t('nb.cell.ran', { time: i18n.formatDateTime(c.ran), ms: i18n.formatNumber(c.ms || 0) }) }));
        return nodes;
      }

      function refreshCell(c) {
        const section = cellsEl.querySelector(`[data-cell="${c.id}"]`);
        if (!section) return;
        const out = section.querySelector('.dm-nb-output');
        if (out) replace(out, outputNodes(c));
        section.removeAttribute('data-running');
      }

      async function runOne(c) {
        if (running || c.type === 'markdown') return;
        running = true;
        syncSources();
        const section = cellsEl.querySelector(`[data-cell="${c.id}"]`);
        if (section) section.setAttribute('data-running', 'true');
        try { await notebooks.runCell(nb, c); } finally { running = false; refreshCell(c); }
        await changed(true);
      }
      async function runAll() {
        if (running) return;
        for (const c of nb.cells) { if (c.type !== 'markdown') await runOne(c); }
        options.log(t('nb.saved', { name: nb.name }), 'ok');
      }

      function addCell(type, at) {
        syncSources();
        const c = notebooks.cell(type, '');
        const index = at === undefined ? nb.cells.length : at;
        nb.cells.splice(index, 0, c);
        changed(true);
        renderHead(); renderCells();
        const ed = editors.get(c.id);
        if (ed && typeof ed.focus === 'function') ed.focus();
      }
      function moveCell(index, delta) {
        const j = index + delta;
        if (j < 0 || j >= nb.cells.length) return;
        syncSources();
        [nb.cells[index], nb.cells[j]] = [nb.cells[j], nb.cells[index]];
        changed(true); renderCells();
      }
      function deleteCell(index) {
        syncSources();
        nb.cells.splice(index, 1);
        changed(true); renderHead(); renderCells();
      }

      async function exportDialog() {
        syncSources();
        const format = /** @type {any} */ (h('dm-select', { label: t('nb.export.format') }));
        format.options = notebooks.EXPORT_FORMATS.map((f) => ({ value: f.id, label: f.label }));
        format.value = 'html';
        const code = /** @type {any} */ (h('dm-switch', { label: t('nb.export.code') }));
        code.checked = true;
        const ok = await overlays.dialog.open({ title: t('nb.export.title'), help: 'anteckningsbok#exportera-och-dela', body: h('div', { class: 'dm-stack' }, h('div', { class: 'dm-form-grid' }, format), code), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.download'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        try {
          const res = await notebooks.exportNotebook(nb, format.value, { includeCode: code.checked });
          files.download(res.blob, res.filename);
          overlays.toast.show(t('nb.export.done', { name: res.filename }), { kind: 'ok' });
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); }
      }
      function shareJson() {
        syncSources();
        const name = files.safeName(nb.name || t('nb.default.name').toLowerCase(), 'nb.json');
        files.download(new Blob([notebooks.exportJson(nb)], { type: 'application/json' }), name);
        overlays.toast.show(t('nb.export.done', { name }), { kind: 'ok' });
      }
      async function removeNb() {
        if (!(await overlays.dialog.confirm(t('nb.delete.confirm', { name: nb.name }), { okLabel: t('common.delete'), danger: true }))) return;
        clearTimeout(saveTimer);
        if (nb.id) await notebooks.remove(nb.id);
        options.log(t('nb.deleted'), 'ok');
        options.onDeleted();
      }

      /** Right-panel nodes: dataset for SQL cells and a summary. */
      function inspector() {
        const state = store.get();
        const sel = /** @type {any} */ (h('dm-select', { label: t('nb.dataset') }));
        sel.options = [{ value: '', label: t('nb.dataset.none') }].concat(state.datasets.map((d) => ({ value: d.id, label: d.name })));
        sel.value = nb.datasetId && state.datasets.some((d) => d.id === nb.datasetId) ? nb.datasetId : '';
        sel.addEventListener('change', () => { const d = state.datasets.find((x) => x.id === sel.value); nb.datasetId = d ? d.id : null; nb.datasetName = d ? d.name : ''; changed(); });
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('nb.cells.label'), value: String(nb.cells.length) },
          nb.updatedAt ? { label: t('common.updated'), value: i18n.formatDateTime(nb.updatedAt) } : null,
        ].filter(Boolean);
        return [h('h4', { text: nb.name || t('nb.title') }), sel, kv, h('p', { class: 'dm-help', text: t('nb.help') })];
      }

      return {
        headEl, bodyEl, start, destroy, inspector, runAll, runCell: runOne,
        get notebook() { syncSources(); return nb; },
      };
    }
    return { create };
  });
})();
