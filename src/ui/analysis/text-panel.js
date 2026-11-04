// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Text tab in Analysera, shown when the selected dataset is a document collection: a summary per document,
 * word frequencies with stopword lists, keywords in context (KWIC) and co-occurring words. Every result can
 * become a dataset of its own. The counting is done by analysis/text.js on the dataset's rows.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/text-panel', ['ui/base', 'analysis/text', 'data/datasets'], (base, textAnalysis, datasets) => {
    const { h, t, i18n, replace } = base;
    const TOOLS = ['summary', 'words', 'kwic', 'pairs'];
    const TOPS = [50, 100, 200, 500, 1000];
    const WINDOWS = [0, 3, 5, 10];
    const MAX_ROWS = 200000;

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{rerenderRight?: () => void}} [options]
     */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const uiLang = i18n.language();
      const s = { tool: 'words', lang: textAnalysis.LANGS.includes(uiLang) ? uiLang : 'sv', useStop: true, extra: '', minLength: 2, numbers: false, top: 100, term: '', regex: false, wholeWord: false, caseSensitive: false, window: 0, document: '' };
      let rows = []; let rowsFor = null; let columns = []; let idx = null; let documents = []; let docsKey = '';
      let resultEl = null; let fieldsEl = null; let seq = 0; let timer = 0; let last = null;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'document';

      /** The rows of the selected document dataset, read once per version. */
      async function loadRows() {
        const ds = selected();
        if (!usable(ds)) { rows = []; rowsFor = null; documents = []; return null; }
        const key = ds.id + ':' + ds.updatedAt;
        if (rowsFor === key) return ds;
        columns = await datasets.columns(ds.id);
        idx = textAnalysis.indexes(columns);
        rows = await datasets.query(ds.id, { limit: MAX_ROWS });
        documents = Array.from(new Set(rows.map((r) => r[idx.docIndex])));
        if (s.document && !documents.includes(s.document)) s.document = '';
        rowsFor = key;
        return ds;
      }
      const scope = () => (s.document ? rows.filter((r) => r[idx.docIndex] === s.document) : rows);
      const stopwords = () => textAnalysis.stopwordsFor(s.lang, s.extra, s.useStop);

      // ---- field helpers ----
      function select(label, opts, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = opts; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }
      function toggle(label, checked, onChange) {
        const el = /** @type {any} */ (h('dm-switch', { label }));
        el.checked = checked;
        el.addEventListener('change', () => onChange(el.checked));
        return el;
      }
      function input(label, value, onChange, attrs = {}) {
        const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs)));
        el.value = value;
        el.addEventListener('input', () => onChange(el.value));
        return el;
      }

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('text-search', 20), t('text.title')));
        if (!usable(selected())) return { head, body: [h('dm-empty-state', { icon: 'file-text', heading: t('text.no.dataset'), text: t('text.intro') })] };
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('text.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; renderFields(); schedule(0); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); schedule(0);
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      function renderFields() {
        if (!fieldsEl) return;
        const parts = [];
        if (documents.length > 1) parts.push(select(t('text.document'), [{ value: '', label: t('text.document.all') }].concat(documents.map((d) => ({ value: String(d), label: String(d) }))), s.document, (v) => { s.document = v; schedule(0); }));
        if (s.tool === 'words' || s.tool === 'pairs') {
          parts.push(select(t('text.lang'), textAnalysis.LANGS.map((l) => { const lang = i18n.LANGUAGES.find((x) => x.code === l); return { value: l, label: lang ? lang.label : l }; }), s.lang, (v) => { s.lang = v; schedule(0); }));
          parts.push(toggle(t('text.stopwords'), s.useStop, (v) => { s.useStop = v; schedule(0); }));
          parts.push(input(t('text.stopwords.extra'), s.extra, (v) => { s.extra = v; schedule(); }, { placeholder: t('text.stopwords.extra.placeholder') }));
          parts.push(input(t('text.minlength'), String(s.minLength), (v) => { s.minLength = Math.max(1, Number(v) || 1); schedule(); }, { type: 'number', min: '1', max: '30' }));
          parts.push(toggle(t('text.numbers'), s.numbers, (v) => { s.numbers = v; schedule(0); }));
          parts.push(select(t('text.top'), TOPS.map((n) => ({ value: String(n), label: String(n) })), String(s.top), (v) => { s.top = Number(v); schedule(0); }));
          if (s.tool === 'pairs') parts.push(select(t('text.window'), WINDOWS.map((n) => ({ value: String(n), label: n ? t('text.window.words', { n }) : t('text.window.paragraph') })), String(s.window), (v) => { s.window = Number(v); schedule(0); }));
        }
        if (s.tool === 'kwic') {
          parts.push(input(t('text.term'), s.term, (v) => { s.term = v; schedule(); }, { placeholder: t('text.term.placeholder'), type: 'search' }));
          parts.push(toggle(t('text.wholeword'), s.wholeWord, (v) => { s.wholeWord = v; schedule(0); }));
          parts.push(toggle(t('text.casesensitive'), s.caseSensitive, (v) => { s.caseSensitive = v; schedule(0); }));
          parts.push(toggle(t('text.regex'), s.regex, (v) => { s.regex = v; schedule(0); }));
        }
        replace(fieldsEl, h('p', { class: 'dm-help', text: t('text.hint.' + s.tool) }), parts.length ? h('div', { class: 'dm-tool-fields' }, parts) : null);
      }

      function schedule(delay = 300) { clearTimeout(timer); timer = setTimeout(() => run(), delay); }
      async function run() {
        if (!resultEl) return;
        const my = ++seq;
        replace(resultEl, h('p', { class: 'dm-help', text: t('common.loading') }));
        try {
          const ds = await loadRows();
          if (my !== seq || !resultEl) return;
          if (!ds) { replace(resultEl, h('dm-empty-state', { icon: 'file-text', heading: t('text.no.dataset'), text: t('text.intro') })); return; }
          const key = documents.join('\u0001');
          if (key !== docsKey) { docsKey = key; renderFields(); }
          const rs = scope();
          const base = { textIndex: idx.textIndex, docIndex: idx.docIndex, pageIndex: idx.pageIndex, typeIndex: idx.typeIndex, stopwords: stopwords(), minLength: s.minLength, numbers: s.numbers, top: s.top };
          let out;
          if (s.tool === 'summary') {
            const list = textAnalysis.summary(rs, base);
            out = {
              columns: [col('dokument', 'text'), col('sidor', 'integer'), col('stycken', 'integer'), col('rubriker', 'integer'), col('tabellrader', 'integer'), col('ord', 'integer'), col('tecken', 'integer'), col('olika_ord', 'integer'), col('ordvariation', 'number')],
              rows: list.map((d) => [d.document, d.pages, d.paragraphs, d.headings, d.tables, d.words, d.characters, d.distinct, Math.round(d.ttr * 1000) / 1000]),
              note: t('text.summary.note', { documents: i18n.formatNumber(list.length), paragraphs: i18n.formatNumber(rs.length), words: i18n.formatNumber(list.reduce((n, d) => n + d.words, 0)) }),
            };
          } else if (s.tool === 'words') {
            const r = await textAnalysis.wordFrequencies(rs, base);
            out = { columns: [col('ord', 'text'), col('antal', 'integer'), col('andel', 'number'), col('dokument', 'integer')], rows: r.words.map((w) => [w.word, w.count, Math.round(w.share * 100000) / 100000, w.documents]), note: t('text.words.note', { tokens: i18n.formatNumber(r.tokens), types: i18n.formatNumber(r.types), shown: i18n.formatNumber(r.words.length) }) };
          } else if (s.tool === 'kwic') {
            if (!s.term.trim()) { replace(resultEl, h('p', { class: 'dm-help', text: t('text.kwic.enter') })); return; }
            const r = textAnalysis.kwic(rs, s.term.trim(), { textIndex: idx.textIndex, docIndex: idx.docIndex, pageIndex: idx.pageIndex, regex: s.regex, wholeWord: s.wholeWord, caseSensitive: s.caseSensitive, width: 60, limit: 1000 });
            if (r.error) { replace(resultEl, h('p', { class: 'dm-error dm-small', text: t('text.kwic.error', { message: r.error }) })); return; }
            out = { columns: [col('dokument', 'text'), col('sida', 'integer'), col('vanster', 'text'), col('traff', 'text'), col('hoger', 'text'), col('stycke', 'integer')], rows: r.hits.map((x) => [x.document, x.page, x.left, x.match, x.right, x.row]), note: r.total > r.hits.length ? t('text.kwic.note.limited', { shown: i18n.formatNumber(r.hits.length), total: i18n.formatNumber(r.total) }) : t('text.kwic.note', { total: i18n.formatNumber(r.total) }) };
          } else {
            const r = await textAnalysis.cooccurrences(rs, Object.assign({ window: s.window }, base));
            out = { columns: [col('ord1', 'text'), col('ord2', 'text'), col('antal', 'integer')], rows: r.pairs.map((p) => [p.a, p.b, p.count]), note: t('text.pairs.note', { paragraphs: i18n.formatNumber(r.paragraphs), shown: i18n.formatNumber(r.pairs.length) }) };
          }
          if (my !== seq || !resultEl) return;
          last = out;
          renderResult(out);
        } catch (err) { if (my === seq && resultEl) replace(resultEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); }
      }
      const col = (name, type) => ({ name, type, label: t('text.col.' + name) });

      function renderResult(out) {
        const table = /** @type {any} */ (h('dm-table'));
        replace(resultEl,
          h('div', { class: 'dm-row' }, h('span', { class: 'dm-help dm-grow', text: out.note }),
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, title: t('text.create.dataset.hint'), onClick: () => createDataset(out) })),
          h('div', { class: 'dm-table-wrap' }, table));
        requestAnimationFrame(() => { if (table.isConnected) table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label, type: c.type })), rowCount: out.rows.length, rowProvider: async (start, count) => out.rows.slice(start, start + count) }); });
      }
      async function createDataset(out) {
        const ds = selected();
        if (!ds || !out) return;
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: t('text.dataset.default', { tool: t('text.tool.' + s.tool), name: ds.name }) });
        if (!name) return;
        try {
          const meta = await datasets.create({
            name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label })), rows: out.rows,
            description: t('text.dataset.description', { tool: t('text.tool.' + s.tool), name: ds.name }),
            source: { kind: 'derived', from: ds.id, tool: 'text:' + s.tool, settings: { lang: s.lang, stopwords: s.useStop, extra: s.extra, minLength: s.minLength, numbers: s.numbers, term: s.term, window: s.window, document: s.document } },
          });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function inspector() {
        const ds = selected();
        const items = [h('h4', { text: t('text.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('text.about.' + s.tool) })];
        if (s.tool === 'words' || s.tool === 'pairs') {
          const list = textAnalysis.STOPWORDS[s.lang] ? textAnalysis.STOPWORDS[s.lang].split(' ') : [];
          items.push(h('h4', { text: t('text.stopwords') }), h('p', { class: 'dm-help', text: t('text.stopwords.about', { n: list.length }) }), h('p', { class: 'dm-xs dm-muted', text: list.slice(0, 40).join(', ') + (list.length > 40 ? ' …' : '') }));
        }
        if (usable(ds)) items.push(h('h4', { text: t('text.dataset') }), h('p', { class: 'dm-help', text: t('text.dataset.about', { name: ds.name, rows: i18n.formatNumber(ds.rowCount || 0), documents: i18n.formatNumber(Array.isArray(ds.documents) ? ds.documents.length : documents.length) }) }));
        return items;
      }
      function datasetChanged() { rowsFor = null; if (resultEl) schedule(0); }
      function destroy() { clearTimeout(timer); seq++; resultEl = null; fieldsEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s, lastResult: () => last };
    }
    return { create, TOOLS };
  });
})();
