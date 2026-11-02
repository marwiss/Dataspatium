// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Dokument tab in Exportera: pick or write a template, see a live preview for the selected
 * dataset, download the document in one of five formats, run a batch per group, and share templates.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/docs/document-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'docgen/documents', 'docgen/generate', 'platform/files', 'data/datasets'], (base, basic, overlays, documents, generate, files, datasets) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {any} ctx shell context
     */
    function create(ctx) {
      const { store, shell } = ctx;
      const el = h('div', { class: 'dm-stack' });
      const state = { templates: [], doc: null, dirty: false, format: 'html', busy: false, error: '' };
      let previewEl = null; let previewTimer = 0; let previewSeq = 0; let editor = null; let nameInput = null;
      const unsubDocs = documents.subscribe(() => reload());
      function selectedDataset() { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; }

      async function reload() {
        state.templates = await documents.list();
        if (!state.doc) state.doc = Object.assign({}, state.templates[0]);
        render();
      }
      function pick(id) {
        const tpl = state.templates.find((x) => x.id === id);
        if (!tpl) return;
        state.doc = Object.assign({}, tpl); state.dirty = false; render();
      }

      function render() {
        if (!state.doc) { replace(el, h('p', { class: 'dm-help', text: t('common.loading') })); return; }
        const doc = state.doc;
        const sel = /** @type {any} */ (h('dm-select', { label: t('doc.template') }));
        sel.options = state.templates.map((x) => ({ value: x.id, label: x.name + (x.builtin ? ' (' + t('doc.builtin') + ')' : '') }));
        sel.value = doc.id || '';
        sel.addEventListener('change', () => pick(sel.value));
        nameInput = /** @type {any} */ (h('dm-input', { label: t('doc.name') }));
        nameInput.value = doc.name || '';
        nameInput.addEventListener('input', () => { doc.name = nameInput.value; state.dirty = true; });
        editor = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '18', label: t('doc.body'), mono: true }));
        editor.value = doc.body || '';
        editor.addEventListener('input', () => { doc.body = editor.value; state.dirty = true; schedulePreview(); });
        const formatSel = /** @type {any} */ (h('dm-select', { label: t('doc.format') }));
        formatSel.options = generate.FORMATS.map((f) => ({ value: f.id, label: f.label }));
        formatSel.value = state.format;
        formatSel.addEventListener('change', () => { state.format = formatSel.value; });
        previewEl = h('div', { class: 'dm-doc-preview' }, h('p', { class: 'dm-help', text: t('doc.preview.empty') }));
        const ds = selectedDataset();
        replace(el,
          h('div', { class: 'dm-form-grid' }, sel, nameInput),
          doc.description ? h('p', { class: 'dm-help', text: doc.description }) : null,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: doc.builtin ? t('doc.save.copy') : t('doc.save'), icon: 'save', onClick: () => saveTemplate(false) }),
            !doc.builtin ? basic.button({ label: t('doc.save.copy'), icon: 'copy', variant: 'ghost', onClick: () => saveTemplate(true) }) : null,
            !doc.builtin && doc.id ? basic.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: removeTemplate }) : null,
            basic.button({ label: t('doc.export.template'), icon: 'file-output', variant: 'ghost', onClick: () => files.download(new Blob([documents.exportJson(doc)], { type: 'application/json' }), files.safeName(doc.name || 'mall', 'doc.json')) }),
            basic.button({ label: t('doc.import.template'), icon: 'upload', variant: 'ghost', onClick: importTemplate })),
          h('div', { class: 'dm-doc-layout' },
            h('div', { class: 'dm-stack-sm dm-doc-editor' }, editor),
            h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('doc.preview') + (ds ? ': ' + ds.name : '') }), previewEl)),
          h('div', { class: 'dm-row-wrap dm-doc-actions' },
            formatSel,
            basic.button({ label: t('doc.create'), icon: 'download', variant: 'primary', disabled: !ds, onClick: createDocument }),
            basic.button({ label: t('doc.batch'), icon: 'layers', disabled: !ds, onClick: batchDocuments })),
          ds ? null : h('p', { class: 'dm-help', text: t('doc.no.dataset') }));
        schedulePreview(0);
      }

      function schedulePreview(delay = 500) { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, delay); }
      async function renderPreview() {
        const ds = selectedDataset();
        if (!previewEl || !state.doc) return;
        if (!ds) { replace(previewEl, h('p', { class: 'dm-help', text: t('doc.preview.empty') })); return; }
        const seq = ++previewSeq;
        previewEl.classList.add('dm-rendering');
        try {
          const res = await generate.preview(state.doc, ds.id, { maxRows: 200 });
          if (seq !== previewSeq) return;
          replace(previewEl, res.el);
        } catch (err) {
          if (seq === previewSeq) replace(previewEl, h('p', { class: 'dm-error dm-small', text: t('doc.error', { message: (err && err.message) || String(err) }) }));
        } finally { previewEl.classList.remove('dm-rendering'); }
      }

      async function saveTemplate(asCopy) {
        const doc = state.doc;
        const record = Object.assign({}, doc, { id: asCopy || doc.builtin ? null : doc.id, name: nameInput ? nameInput.value.trim() : doc.name, body: editor ? editor.value : doc.body, builtin: false });
        if (doc.builtin && record.name === doc.name) record.name = doc.name + ' (kopia)';
        const saved = await documents.save(record);
        state.doc = Object.assign({}, saved); state.dirty = false;
        shell.log(t('doc.saved', { name: saved.name }), 'ok'); overlays.toast.show(t('doc.saved', { name: saved.name }), { kind: 'ok' });
        await reload();
      }
      async function removeTemplate() {
        if (!(await overlays.dialog.confirm(t('doc.delete.confirm', { name: state.doc.name }), { danger: true, okLabel: t('common.delete') }))) return;
        await documents.remove(state.doc.id);
        state.doc = null;
        shell.log(t('doc.deleted'), 'ok');
        await reload();
      }
      async function importTemplate() {
        const [file] = await files.pick({ accept: '.json' });
        if (!file) return;
        try { const saved = await documents.importJson(await file.text()); shell.log(t('doc.imported', { name: saved.name }), 'ok'); await reload(); pick(saved.id); } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      async function createDocument() {
        const ds = selectedDataset();
        if (!ds || state.busy) return;
        state.busy = true;
        try {
          const doc = Object.assign({}, state.doc, { body: editor ? editor.value : state.doc.body, name: nameInput ? nameInput.value.trim() || state.doc.name : state.doc.name });
          const result = await generate.generate(doc, ds.id, state.format);
          files.download(result.blob, result.filename);
          shell.log(t('doc.created', { name: result.filename }) + ` (${i18n.formatBytes(result.blob.size)})`, 'ok');
          overlays.toast.show(t('doc.created', { name: result.filename }), { kind: 'ok' });
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); overlays.toast.show(t('doc.error', { message: (err && err.message) || String(err) }), { kind: 'error', timeout: 10000 }); }
        state.busy = false;
      }

      async function batchDocuments() {
        const ds = selectedDataset();
        if (!ds) return;
        const columns = await datasets.columns(ds.id);
        const column = /** @type {any} */ (h('dm-select', { label: t('viz.batch.column') }));
        column.options = columns.filter((c) => c.type !== 'number').map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` }));
        const preferred = columns.find((c) => /^(kommun|region|lan|län|ar|år|year|grupp)$/i.test(c.name));
        column.value = preferred ? preferred.name : (column.options[0] ? column.options[0].value : '');
        const formatSel = /** @type {any} */ (h('dm-select', { label: t('doc.format') }));
        formatSel.options = generate.FORMATS.map((f) => ({ value: f.id, label: f.label })); formatSel.value = state.format;
        const pattern = /** @type {any} */ (h('dm-input', { label: t('viz.batch.pattern'), help: t('doc.batch.pattern.help') })); pattern.value = '{dokument}-{grupp}';
        const limit = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.batch.limit'), min: '1', max: '5000' })); limit.value = '200';
        const ok = await overlays.dialog.open({ title: t('doc.batch.title'), body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('doc.batch.help') }), h('div', { class: 'dm-form-grid' }, column, formatSel, pattern, limit)), size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('viz.batch.run'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true || !column.value) return;
        const abort = new AbortController();
        const toast = overlays.toast.show(t('viz.batch.progress', { done: 0, total: '?', value: '' }), { kind: 'info', timeout: 0, action: { label: t('api.cancel'), onClick: () => abort.abort() } });
        try {
          const doc = Object.assign({}, state.doc, { body: editor ? editor.value : state.doc.body });
          const result = await generate.batch(doc, ds.id, { groupColumn: column.value, format: formatSel.value, pattern: pattern.value, limit: Number(limit.value) || 200, signal: abort.signal, onProgress: (p) => { const el2 = toast.querySelector('.dm-toast-text'); if (el2) el2.textContent = t('viz.batch.progress', { done: p.done, total: p.total, value: p.value }); } });
          const name = files.safeName(`${doc.name} per ${column.value}`, 'zip');
          files.download(result.blob, name);
          overlays.toast.show(t('doc.batch.done', { n: result.count, name }) + (result.errors.length ? ' ' + t('viz.batch.errors', { n: result.errors.length }) : ''), { kind: result.errors.length ? 'warn' : 'ok', timeout: 10000 });
        } catch (err) { if (!(err && err.kind === 'aborted')) overlays.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); }
        finally { toast.remove(); }
      }

      /** Help for the inspector. */
      function helpNodes() {
        const items = ['datamangd', 'beskrivning', 'antal_rader', 'antal_kolumner', 'kalla', 'datum', 'tid', 'app', 'grupp', 'gruppkolumn', 'summor.kolumn', 'medel.kolumn', 'minsta.kolumn', 'storsta.kolumn'];
        return [
          h('h4', { text: t('doc.help.title') }),
          h('p', { class: 'dm-help', text: t('doc.help.vars') }),
          h('ul', { class: 'dm-stack-sm dm-doc-help' }, items.map((k) => h('li', null, h('code', { text: '{{' + k + '}}' })))),
          h('p', { class: 'dm-help', text: t('doc.help.loops') }),
          h('pre', { class: 'dm-doc-help-pre', text: '{{#rader}}\n- {{kommun}}: {{folkmangd}}\n{{/rader}}' }),
          h('p', { class: 'dm-help', text: t('doc.help.table') }),
          h('pre', { class: 'dm-doc-help-pre', text: '{{#tabell}}kolumner: kommun, folkmangd;\nsortera: folkmangd fallande; topp: 10;\nfilter: lan = Skåne län; rubrik: Störst{{/tabell}}' }),
          h('p', { class: 'dm-help', text: t('doc.help.chart') }),
          h('pre', { class: 'dm-doc-help-pre', text: '{{diagram "Folkmängd per län" | bredd: 600}}' }),
          h('p', { class: 'dm-help', text: t('doc.help.markdown') }),
        ];
      }

      function onDatasetChange() { if (state.doc) { render(); } }
      function destroy() { unsubDocs(); clearTimeout(previewTimer); }
      reload();
      return { el, render, helpNodes, onDatasetChange, destroy, state };
    }
    return { create };
  });
})();
