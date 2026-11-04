// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Statistik tab in Analysera: forms for descriptive statistics, crosstabs, correlation, hypothesis tests, regression
 * and clustering. The form writes the code while it is filled in; running it gives tables, key figures, plots and a
 * sentence on what the result says. The code can be taken to the console. Regressions can be kept as models that the
 * recipe step Prediktion applies. The logic lives in analysis/stats and data/models.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/stats-panel', ['ui/base', 'data/datasets', 'analysis/stats', 'data/models'], (base, datasets, stats, models) => {
    const { h, t, i18n, replace } = base;
    const NUMERIC = ['integer', 'number'];
    const TOOLS = stats.TOOLS.concat(['models']);
    const PREVIEW_ROWS = 2000;

    /** @param {any} ctx shell context @param {{rerenderRight?: () => void}} [options] */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'describe', lang: 'r', params: {}, columnsFor: null, columns: [], result: null, running: false, error: '' };
      let fieldsEl = null; let codeEl = null; let resultEl = null; let seq = 0;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const paramsOf = () => { if (!s.params[s.tool]) s.params[s.tool] = {}; return s.params[s.tool]; };

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('chart-column', 20), t('stats.title')));
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('stats.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; s.result = null; s.error = ''; draw(); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        codeEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-stack' });
        draw();
        return { head, body: [tabs, fieldsEl, codeEl, resultEl] };
      }
      async function draw() {
        if (!fieldsEl) return;
        const my = ++seq;
        const ds = selected();
        if (s.tool === 'models') { replace(fieldsEl); replace(codeEl); await drawModels(); return; }
        if (!ds) { replace(fieldsEl, h('p', { class: 'dm-help', text: t('stats.needs') })); replace(codeEl); replace(resultEl); return; }
        if (s.columnsFor !== ds.id) { s.columns = await datasets.columns(ds.id); s.columnsFor = ds.id; s.params = {}; }
        if (my !== seq || !fieldsEl) return;
        renderFields();
        renderCode();
        renderResult();
      }

      // ---- the form -------------------------------------------------------------------------------------------
      const numeric = () => s.columns.filter((c) => NUMERIC.includes(c.type));
      const optionsOf = (list) => list.map((c) => ({ value: c.name, label: c.name }));
      function select(key, label, opts, fallback) {
        const p = paramsOf();
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = opts;
        if (p[key] === undefined) p[key] = fallback !== undefined ? fallback : (opts[0] ? opts[0].value : '');
        el.value = p[key];
        el.addEventListener('change', () => { p[key] = el.value; afterChange(key); });
        return el;
      }
      /** Several columns: one switch each. */
      function pick(key, label, list, startAll) {
        const p = paramsOf();
        if (!p[key]) p[key] = startAll ? list.slice(0, 6).map((c) => c.name) : [];
        const boxes = list.map((c) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: c.name }));
          sw.checked = p[key].includes(c.name);
          sw.addEventListener('change', () => { p[key] = list.map((x) => x.name).filter((n) => (n === c.name ? sw.checked : p[key].includes(n))); renderCode(); });
          return sw;
        });
        return h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: label }), h('div', { class: 'dm-columns-pick' }, boxes));
      }
      function input(key, label, type, fallback) {
        const p = paramsOf();
        const el = /** @type {any} */ (h('dm-input', { label, type }));
        if (p[key] === undefined) p[key] = fallback;
        el.value = String(p[key] === undefined ? '' : p[key]);
        el.addEventListener('input', () => { p[key] = type === 'number' ? Number(el.value) : el.value; renderCode(); });
        return el;
      }
      function toggle(key, label, fallback) {
        const p = paramsOf();
        const el = /** @type {any} */ (h('dm-switch', { label }));
        if (p[key] === undefined) p[key] = fallback;
        el.checked = !!p[key];
        el.addEventListener('change', () => { p[key] = el.checked; afterChange(key); });
        return el;
      }
      const afterChange = (key) => { if (key === 'test' || key === 'save' || key === 'tool') renderFields(); renderCode(); };
      function renderFields() {
        if (!fieldsEl) return;
        const num = optionsOf(numeric()); const all = optionsOf(s.columns);
        const none = [{ value: '', label: t('op.column.none') }];
        const p = paramsOf();
        const parts = [];
        switch (s.tool) {
          case 'describe':
            parts.push(pick('columns', t('stats.field.columns'), numeric(), true), select('group', t('stats.field.group'), none.concat(all), ''));
            break;
          case 'crosstab':
            parts.push(h('div', { class: 'dm-row-wrap' }, select('row', t('stats.field.row'), all), select('column', t('stats.field.column'), all, all[1] ? all[1].value : (all[0] && all[0].value)),
              select('percent', t('stats.field.percent'), ['none', 'row', 'column'].map((x) => ({ value: x, label: t('stats.percent.' + x) })), 'none')));
            break;
          case 'correlation':
            parts.push(pick('columns', t('stats.field.columns'), numeric(), true), select('method', t('stats.field.method'), ['pearson', 'spearman'].map((x) => ({ value: x, label: t('stats.method.' + x) })), 'pearson'));
            break;
          case 'test': {
            const row = [select('test', t('stats.field.test'), stats.TESTS.map((x) => ({ value: x, label: t('stats.test.' + x) })), 't_two'), select('value', t('stats.field.value'), num)];
            if (p.test === 't_one') row.push(input('mu', t('stats.field.mu'), 'number', 0));
            else if (p.test === 't_paired') row.push(select('value2', t('stats.field.value2'), num, num[1] ? num[1].value : (num[0] && num[0].value)));
            else row.push(select('group', t('stats.field.group.required'), all, (s.columns.find((c) => !NUMERIC.includes(c.type)) || s.columns[0] || {}).name));
            parts.push(h('div', { class: 'dm-row-wrap' }, row));
            parts.push(h('p', { class: 'dm-help dm-small', text: t('stats.test.' + (p.test || 't_two') + '.help') }));
            break;
          }
          case 'regression':
            parts.push(h('div', { class: 'dm-row-wrap' }, select('kind', t('stats.field.kind'), ['linear', 'logistic'].map((x) => ({ value: x, label: t('stats.kind.' + x) })), 'linear'), select('target', t('stats.field.target'), all, (numeric()[0] || s.columns[0] || {}).name)),
              pick('predictors', t('stats.field.predictors'), s.columns, false));
            break;
          case 'cluster':
            parts.push(pick('columns', t('stats.field.columns'), numeric(), true), h('div', { class: 'dm-row-wrap' }, input('k', t('stats.field.k'), 'number', 3), toggle('scale', t('stats.field.scale'), true), toggle('save', t('stats.field.save'), false)));
            if (p.save) parts.push(input('saveName', t('stats.field.savename'), 'text', t('stats.savename.default', { name: selected() ? selected().name : '' })));
            break;
          default: break;
        }
        parts.push(h('div', { class: 'dm-row-wrap' },
          select('lang', t('stats.field.lang'), [{ value: 'r', label: 'R' }, { value: 'python', label: 'Python' }], s.lang),
          ui.button({ label: t('stats.run'), icon: 'play', variant: 'primary', loading: s.running, title: t('stats.run.hint'), onClick: run })));
        replace(fieldsEl, ...parts);
        // The language is one for all tools.
        const langEl = fieldsEl.querySelectorAll('dm-select');
        const last = /** @type {any} */ (langEl[langEl.length - 1]);
        last.value = s.lang;
        last.addEventListener('change', () => { s.lang = last.value; renderCode(); });
      }
      function renderCode() {
        if (!codeEl) return;
        const ds = selected();
        let text = '';
        try { text = stats.code(s.tool, paramsOf(), ds, s.lang); } catch (_err) { replace(codeEl, h('p', { class: 'dm-help dm-small', text: t('stats.code.waiting') })); return; }
        const editor = /** @type {any} */ (h('dm-code', { language: s.lang === 'python' ? 'python' : 'r', readonly: '', class: 'dm-stats-code' }));
        replace(codeEl, h('details', { class: 'dm-more', open: true },
          h('summary', { text: t('stats.code', { lang: s.lang === 'python' ? 'Python' : 'R' }) }), editor,
          h('div', { class: 'dm-row' }, ui.button({ label: t('stats.code.open'), icon: 'terminal', size: 'sm', title: t('stats.code.open.hint'), onClick: () => { store.set({ pendingCode: { lang: s.lang, code: text } }); } }))));
        requestAnimationFrame(() => { if (editor.isConnected) editor.value = text; else editor.value = text; });
      }

      // ---- running --------------------------------------------------------------------------------------------
      async function run() {
        const ds = selected();
        if (!ds || s.running) return;
        s.running = true; s.error = ''; s.result = null;
        const my = ++seq;
        renderFields();
        replace(resultEl, h('dm-progress', { indeterminate: true, label: t('stats.running', { lang: s.lang === 'python' ? 'Python' : 'R' }) }));
        try {
          const params = JSON.parse(JSON.stringify(paramsOf()));
          const out = await stats.run(s.tool, params, ds, s.lang);
          s.result = Object.assign(out, { tool: s.tool, params, datasetName: ds.name, datasetId: ds.id });
          for (const meta of out.datasets) shell.log(t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount || 0) }), 'ok');
        } catch (err) {
          s.error = String((err && err.message) || err);
          shell.log(s.error, 'error');
        }
        s.running = false;
        if (my !== seq) return;
        renderFields();
        renderResult();
      }
      const pText = (p) => (p < 0.001 ? t('stats.p.small') : t('stats.p.value', { p: i18n.formatNumber(Math.round(p * 1000) / 1000) }));
      /** One sentence on what the result says, in plain language. */
      function sentence(r) {
        const v = r.values || {};
        const pct = (x) => i18n.formatNumber(Math.round(x * 1000) / 10);
        if (r.tool === 'regression' && typeof v.r2 === 'number') return t('stats.say.r2', { r2: pct(v.r2), n: i18n.formatNumber(v.n || 0) });
        if (r.tool === 'regression') return t('stats.say.logistic', { n: i18n.formatNumber(v.n || 0), level: Array.isArray(v.nivaer) ? String(v.nivaer[v.nivaer.length - 1]) : '' });
        if (r.tool === 'cluster' && typeof v.forklarad === 'number') return t('stats.say.cluster', { share: pct(v.forklarad), n: i18n.formatNumber(v.n || 0) });
        if (typeof v.p === 'number') return `${t(v.p < 0.05 ? 'stats.say.sig' : 'stats.say.nonsig', { p: pText(v.p) })} ${t('stats.say.caution')}`;
        return '';
      }
      function renderResult() {
        if (!resultEl) return;
        if (s.error) { replace(resultEl, h('p', { class: 'dm-error', text: s.error })); return; }
        const r = s.result;
        if (!r) { replace(resultEl, h('p', { class: 'dm-help', text: t('stats.tool.about.' + s.tool) })); return; }
        const table = /** @type {any} */ (h('dm-table'));
        const say = sentence(r);
        const round = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v);
        const figures = Object.entries(r.values || {}).filter(([k, v]) => typeof v === 'number' && i18n.has('stats.value.' + k));
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = figures.map(([k, v]) => ({ label: t('stats.value.' + k), value: k === 'p' ? pText(v) : i18n.formatNumber(round(v)) }));
        replace(resultEl,
          say ? h('p', { class: 'dm-stats-say', text: say }) : null,
          figures.length ? kv : null,
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-grow' }),
            r.tool === 'regression' ? ui.button({ label: t('stats.model.save'), icon: 'save', title: t('stats.model.save.hint'), onClick: () => saveModel(r) }) : null,
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !r.table.rows.length, onClick: () => createDataset(r) })),
          h('div', { class: 'dm-table-wrap dm-stats-table' }, table),
          r.plots.length ? h('div', { class: 'dm-stack-sm' }, r.plots.map(plotNode)) : null,
          r.output ? h('details', { class: 'dm-more' }, h('summary', { text: t('stats.output') }), h('pre', { class: 'dm-console-stdout', text: r.output })) : null);
        requestAnimationFrame(() => {
          if (!table.isConnected) return;
          table.setData({ columns: r.table.columns.map((c) => ({ key: c.name, label: i18n.has('stats.col.' + c.name) ? t('stats.col.' + c.name) : c.name, type: c.type })), rowCount: Math.min(r.table.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => r.table.rows.slice(start, start + count).map((row) => row.map(round)) });
        });
      }
      function plotNode(e) {
        if (e.canvas) { e.canvas.classList.add('dm-console-plot'); return e.canvas; }
        if (e.svg) { const doc = new DOMParser().parseFromString(e.svg, 'image/svg+xml'); const node = document.importNode(doc.documentElement, true); node.classList.add('dm-console-plot'); return node; }
        return h('p', { class: 'dm-help', text: t('stats.plot.none') });
      }
      async function createDataset(r) {
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: `${r.datasetName}: ${t('stats.tool.' + r.tool)}` });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: r.table.columns.map((c) => ({ name: c.name, type: c.type })), rows: r.table.rows, description: r.code, source: { kind: 'derived' } });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok', action: { label: t('import.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function saveModel(r) {
        const name = await ui.dialog.prompt(t('stats.model.name'), { title: t('stats.model.save'), value: t('stats.model.default', { target: r.params.target }) });
        if (!name) return;
        try {
          const model = models.fromResult({ name, kind: r.params.kind === 'logistic' ? 'logistic' : 'linear', target: r.params.target, predictors: r.params.predictors, table: r.table, values: r.values, lang: r.lang });
          await models.save(r.datasetId, model);
          const msg = t('stats.model.saved', { name: model.name });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function drawModels() {
        const all = await models.list();
        if (!resultEl) return;
        if (!all.length) { replace(resultEl, h('dm-empty-state', { icon: 'chart-column', heading: t('stats.models.empty'), text: t('stats.models.empty.hint') })); return; }
        replace(resultEl, h('p', { class: 'dm-help', text: t('stats.models.about') }), all.map((m) => h('div', { class: 'dm-card dm-stack-sm', 'data-model': m.id },
          h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: m.name }), h('dm-badge', { text: t('stats.kind.' + m.kind) }),
            ui.button({ label: t('stats.model.remove'), icon: 'trash-2', 'icon-only': true, variant: 'ghost', size: 'sm', title: t('stats.model.remove'), onClick: async () => { await models.remove(m.datasetId, m.id); drawModels(); } })),
          h('p', { class: 'dm-small', text: models.describe(m) }),
          h('p', { class: 'dm-help dm-small', text: t('stats.model.from', { name: m.datasetName, when: i18n.formatDateTime(m.createdAt) }) }))));
      }

      function inspector() {
        const items = [h('h4', { text: t('stats.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('stats.tool.about.' + s.tool) })];
        if (s.tool !== 'models') items.push(h('p', { class: 'dm-help dm-small', text: t('stats.about') }));
        return items;
      }
      function datasetChanged() { const ds = selected(); if (ds && ds.id !== s.columnsFor) { s.result = null; s.error = ''; } if (fieldsEl && !s.running) draw(); }
      function destroy() { seq++; fieldsEl = null; codeEl = null; resultEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s, run };
    }
    return { create };
  });
})();
