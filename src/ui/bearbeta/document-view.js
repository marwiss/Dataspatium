// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Document view in Bearbeta for datasets of kind "document": one document at a time, page by page, with the
 * paragraphs as text (headings, paragraphs and table rows) or, for PDF files, the rendered page from pdf.js.
 * A search lists hits across the whole collection; the inspector shows the document's metadata and lets the
 * user download the original. The table view stays one click away.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/document-view', ['ui/base', 'data/datasets', 'data/dataset-files', 'platform/files', 'analysis/text'], (base, datasets, dsFiles, files, textAnalysis) => {
    const { h, t, i18n, replace } = base;
    const SEARCH_LIMIT = 200;

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell } = ctx;
      /** Per-dataset state: the open document, page and view (text or page image). */
      const s = { id: null, doc: '', page: 1, view: 'text', search: '', selected: null };
      let full = null; let columns = []; let idx = null; let documents = [];
      let bodyEl = null; let navEl = null; let slots = null; let ds = null;
      /** Open pdf.js documents by file name, destroyed when the dataset changes. */
      const pdfDocs = new Map();
      let seq = 0; let searchTimer = 0;

      function docInfo(name) { return documents.find((d) => d.name === name) || null; }
      function pagesOf(name) { const d = docInfo(name); return d && d.pages ? d.pages : 1; }
      const isPdf = (name) => /\.pdf$/i.test(name || '') || (docInfo(name) && docInfo(name).type === 'pdf');

      async function load(dataset) {
        ds = dataset;
        if (s.id !== dataset.id) {
          await closePdfs();
          Object.assign(s, { id: dataset.id, doc: '', page: 1, view: 'text', search: '', selected: null });
        }
        full = await datasets.get(dataset.id);
        columns = await datasets.columns(dataset.id);
        idx = textAnalysis.indexes(columns);
        documents = (full && Array.isArray(full.documents) ? full.documents : []).slice();
        if (!documents.length) {
          // Older or hand-made datasets: the document names come from the rows.
          const names = await datasets.query(dataset.id, { limit: 5000 });
          const seen = new Map();
          for (const r of names) { const n = r[idx.docIndex]; if (!seen.has(n)) seen.set(n, { name: n, pages: 0 }); seen.get(n).pages = Math.max(seen.get(n).pages, Number(r[idx.pageIndex]) || 1); }
          documents = Array.from(seen.values());
        }
        if (!documents.some((d) => d.name === s.doc)) { s.doc = documents.length ? documents[0].name : ''; s.page = 1; }
      }
      async function closePdfs() {
        for (const p of pdfDocs.values()) { try { await p.destroy(); } catch (_err) { /* ignore */ } }
        pdfDocs.clear();
      }

      /**
       * Draw the view into the slots.
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target
       */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        await load(dataset);
        if (my !== seq || !slots) return;
        const docSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('document.select'), inline: true }));
        docSel.options = documents.map((d) => ({ value: d.name, label: d.pages > 1 ? `${d.name} (${t('document.pages.n', { n: d.pages })})` : d.name }));
        docSel.value = s.doc;
        docSel.addEventListener('change', () => { s.doc = docSel.value; s.page = 1; s.selected = null; renderBody(); renderNav(); renderInspector(); });
        const searchInput = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('document.search.placeholder'), 'aria-label': t('common.search'), inline: true }));
        searchInput.value = s.search;
        searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { s.search = searchInput.value.trim(); renderBody(); }, 300); });
        navEl = h('div', { class: 'dm-row dm-document-nav' });
        bodyEl = h('div', { class: 'dm-document dm-center-fill', tabindex: '0', 'aria-label': t('document.view') });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('file-text', 20), dataset.name, ' ', h('dm-badge', { text: t('document.files.n', { n: documents.length }) })),
            h('div', { class: 'dm-toolbar' },
              documents.length > 1 ? docSel : null, searchInput,
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          navEl, bodyEl);
        renderNav(); renderBody(); renderInspector();
      }

      function renderNav() {
        if (!navEl) return;
        const pages = pagesOf(s.doc);
        const pdf = isPdf(s.doc);
        const pageLabel = h('span', { class: 'dm-help', text: pages > 1 ? t('document.page.of', { page: s.page, pages }) : '' });
        const go = (p) => { s.page = Math.min(pages, Math.max(1, p)); s.selected = null; renderNav(); renderBody(); };
        const pageInput = /** @type {any} */ (h('dm-input', { type: 'number', min: '1', max: String(pages), 'aria-label': t('document.page'), inline: true, class: 'dm-document-page-input' }));
        pageInput.value = String(s.page);
        pageInput.addEventListener('change', () => go(Number(pageInput.value) || 1));
        replace(navEl,
          pages > 1 ? ui.button({ label: t('document.prev'), icon: 'chevron-left', 'icon-only': true, size: 'sm', disabled: s.page <= 1, onClick: () => go(s.page - 1) }) : null,
          pages > 1 ? pageInput : null, pageLabel,
          pages > 1 ? ui.button({ label: t('document.next'), icon: 'chevron-right', 'icon-only': true, size: 'sm', disabled: s.page >= pages, onClick: () => go(s.page + 1) }) : null,
          h('span', { class: 'dm-grow' }),
          pdf ? ui.button({ label: s.view === 'text' ? t('document.view.page') : t('document.view.text'), icon: s.view === 'text' ? 'image' : 'text-search', size: 'sm', title: t('document.view.toggle.hint'), onClick: () => { s.view = s.view === 'text' ? 'page' : 'text'; renderNav(); renderBody(); } }) : null);
      }

      async function renderBody() {
        if (!bodyEl || !ds) return;
        const my = ++seq;
        if (s.search) { await renderSearch(my); return; }
        if (!s.doc) { replace(bodyEl, h('dm-empty-state', { icon: 'file-text', heading: t('document.empty'), text: t('document.empty.hint') })); return; }
        if (s.view === 'page' && isPdf(s.doc)) { await renderPage(my); return; }
        let rows;
        try {
          rows = await datasets.query(ds.id, { where: { sql: `${datasets.quoteIdent(columns[idx.docIndex].name)} = ? and ${datasets.quoteIdent(columns[idx.pageIndex].name)} = ?`, params: [s.doc, s.page] }, limit: 5000, withRowId: true });
        } catch (err) { replace(bodyEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); return; }
        if (my !== seq) return;
        const nodes = rows.map((r) => paragraphNode(r.slice(1), r[0]));
        replace(bodyEl, nodes.length ? h('article', { class: 'dm-document-text' }, nodes) : h('p', { class: 'dm-help', text: t('document.page.empty') }));
      }
      /** A paragraph as text: headings as h3, table rows in a monospace line, everything else as a paragraph. */
      function paragraphNode(row, rowid) {
        const type = row[idx.typeIndex]; const text = String(row[idx.textIndex] || '');
        const tag = type === 'rubrik' ? 'h3' : 'p';
        const el = h(tag, { class: type === 'tabell' ? 'dm-document-table' : null, tabindex: '0', 'data-rowid': String(rowid), 'aria-current': s.selected && s.selected.rowid === rowid ? 'true' : null, text });
        const select = () => { s.selected = { rowid, row }; for (const other of bodyEl.querySelectorAll('[aria-current]')) other.removeAttribute('aria-current'); el.setAttribute('aria-current', 'true'); renderInspector(); };
        el.addEventListener('click', select);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
        return el;
      }
      async function renderSearch(my) {
        const result = textAnalysis.kwic(await datasets.query(ds.id, { search: s.search, limit: 20000 }), s.search, { textIndex: idx.textIndex, docIndex: idx.docIndex, pageIndex: idx.pageIndex, width: 80, limit: SEARCH_LIMIT });
        if (my !== seq || !bodyEl) return;
        const items = result.hits.map((hit) => h('button', { type: 'button', class: 'dm-list-item dm-document-hit', onclick: () => { s.search = ''; s.doc = hit.document; s.page = Number(hit.page) || 1; s.view = 'text'; const input = slots && slots.center.querySelector('dm-input[type="search"]'); if (input) /** @type {any} */ (input).value = ''; renderNav(); renderBody(); renderInspector(); } },
          ui.icon('file-text', 14), h('span', { class: 'dm-list-main' },
            h('span', { class: 'dm-document-kwic' }, h('span', { class: 'dm-muted', text: hit.left }), h('mark', { text: hit.match }), h('span', { class: 'dm-muted', text: hit.right })),
            h('span', { class: 'dm-list-sub', text: `${hit.document}${pagesOf(hit.document) > 1 ? ' · ' + t('document.page.n', { n: hit.page }) : ''}` }))));
        replace(bodyEl,
          h('p', { class: 'dm-help', text: result.total > result.hits.length ? t('document.search.hits.limited', { shown: i18n.formatNumber(result.hits.length), total: i18n.formatNumber(result.total) }) : t('document.search.hits', { n: i18n.formatNumber(result.total) }) }),
          items.length ? h('div', { class: 'dm-list' }, items) : null);
      }
      async function renderPage(my) {
        const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'dm-document-canvas', role: 'img', 'aria-label': t('document.page.of', { page: s.page, pages: pagesOf(s.doc) }) }));
        replace(bodyEl, h('p', { class: 'dm-help', text: t('common.loading') }), canvas);
        try {
          let doc = pdfDocs.get(s.doc);
          if (!doc) {
            const file = await dsFiles.read(ds.id, s.doc, 'original');
            if (!file) throw new Error(t('document.original.missing'));
            doc = await D.require('engines/pdf').open(file.bytes);
            pdfDocs.set(s.doc, doc);
          }
          if (my !== seq || !bodyEl) return;
          const width = Math.max(320, Math.min(1200, bodyEl.clientWidth - 32));
          await D.require('engines/pdf').render(doc, s.page, canvas, { width });
          if (my !== seq || !bodyEl) return;
          replace(bodyEl, canvas);
        } catch (err) {
          if (my !== seq || !bodyEl) return;
          replace(bodyEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
        }
      }

      function renderInspector() {
        if (!slots) return;
        const d = docInfo(s.doc);
        const items = [];
        if (d) {
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.name'), value: d.name },
            d.title ? { label: t('document.title'), value: d.title } : null,
            d.author ? { label: t('document.author'), value: d.author } : null,
            { label: t('common.type'), value: d.type || '' },
            d.size ? { label: t('common.size'), value: i18n.formatBytes(d.size) } : null,
            { label: t('document.pages'), value: i18n.formatNumber(d.pages || 1) },
            d.paragraphs !== undefined ? { label: t('document.paragraphs'), value: i18n.formatNumber(d.paragraphs) } : null,
            d.words !== undefined ? { label: t('document.words'), value: i18n.formatNumber(d.words) } : null,
            d.created ? { label: t('common.created'), value: formatDate(d.created) } : null,
            d.modified ? { label: t('common.updated'), value: formatDate(d.modified) } : null,
          ].filter(Boolean);
          items.push(h('h4', { text: t('document.inspector') }), kv,
            h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('document.download'), icon: 'download', size: 'sm', title: t('document.download.hint'), onClick: () => downloadOriginal(d.name) })));
        }
        if (s.selected) {
          const row = s.selected.row;
          const kv2 = /** @type {any} */ (h('dm-kv'));
          kv2.items = [
            { label: t('document.page'), value: String(row[idx.pageIndex]) },
            { label: t('document.paragraph'), value: String(row[idx.paragraphIndex]) },
            { label: t('common.type'), value: i18n.has('document.type.' + row[idx.typeIndex]) ? t('document.type.' + row[idx.typeIndex]) : String(row[idx.typeIndex]) },
            { label: t('document.characters'), value: i18n.formatNumber(String(row[idx.textIndex] || '').length) },
          ];
          items.push(h('h4', { text: t('document.selected') }), kv2,
            h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('common.copy'), icon: 'copy', size: 'sm', onClick: () => navigator.clipboard.writeText(String(row[idx.textIndex] || '')).then(() => ui.toast.show(t('document.copied'), { kind: 'ok' })).catch(() => {}) })));
        }
        if (!items.length) items.push(h('p', { class: 'dm-help', text: t('document.help') }));
        replace(slots.right, items);
      }
      function formatDate(v) { try { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : i18n.formatDateTime(d); } catch (_e) { return String(v); } }
      async function downloadOriginal(name) {
        try {
          const file = await dsFiles.read(ds.id, name, 'original');
          if (!file) throw new Error(t('document.original.missing'));
          files.download(new Blob([file.bytes], { type: file.type }), name);
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function destroy() { seq++; clearTimeout(searchTimer); bodyEl = null; navEl = null; slots = null; closePdfs(); }
      return { render, destroy, state: s };
    }
    return { create };
  });
})();
