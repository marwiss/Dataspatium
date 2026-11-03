// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Regex tab in Analysera: a regular expression is tried on a column of the selected dataset as it is
 * typed. The distinct values are shown with their matches marked, together with the result of the chosen
 * action (filter, extract, replace, split, flag, count, rule) or, for the pattern profile, the shapes of
 * the values. Applying an action runs a recipe step (data/operations-regex.js, replace_text) or adds a
 * quality rule. The object panel lists saved patterns (scripts with language 'regex') and a library of
 * common patterns; the inspector gives a syntax summary and the pattern as SQL and R code.
 *
 * Matching happens in the time-limited worker of analysis/regex.js, so a slow pattern stops with a
 * message instead of freezing the app.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/regex-panel', ['ui/base', 'analysis/regex', 'data/recipes', 'data/rules', 'data/operations-regex'], (base, regex, recipes, rules, regexOps) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_DISTINCT = 500;
    const PREVIEW_SHOWN = 500;
    const COUNT_DISTINCT = 20000;
    const ACTIONS = ['test', 'profile', 'filter', 'extract', 'replace', 'split', 'flag', 'count', 'rule'];
    const CHANGES = new Set(['filter', 'extract', 'replace', 'split', 'flag', 'count', 'rule']);
    const SYNTAX = [
      ['.', 'any'], ['\\d', 'digit'], ['\\p{L}', 'letter'], ['\\p{Lu}', 'upper'], ['\\s', 'space'], ['\\w', 'word'],
      ['[abc]', 'class'], ['[^abc]', 'notclass'], ['a|b', 'or'], ['*  +  ?', 'repeat'], ['{2,4}', 'count'],
      ['^  $', 'anchors'], ['(…)', 'group'], ['(?<namn>…)', 'named'], ['(?:…)', 'nocapture'],
      ['(?=…)  (?!…)', 'ahead'], ['(?<=…)  (?<!…)', 'behind'], ['\\.', 'escape'], ['(?i)', 'inline'],
    ];

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{openTab: (lang: string, code: string) => void}} options
     */
    function create(ctx, options) {
      const { ui, services, store, shell } = ctx;
      const s = {
        column: '', pattern: '', caseInsensitive: false, whole: false, dotAll: false,
        action: 'test', replacement: '', which: 'first', sep: ', ', names: '', keep: 'matching', name: '', parts: 2,
        collapse: false, show: 'all',
      };
      let saved = []; let current = { id: null, name: '', createdAt: null };
      let columns = []; let columnsFor = null;
      let summaryEl = null; let previewEl = null; let applyBtn = null; let actionFieldsEl = null; let patternInput = null;
      let timer = 0; let seq = 0; let defaultName = '';
      let onLeftChange = () => {};

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const step = () => ({ pattern: s.pattern, caseInsensitive: s.caseInsensitive, whole: s.whole, dotAll: s.dotAll });
      const fullPattern = () => regex.fullPattern(step());
      const flags = () => regex.flagsOf(step());
      const columnType = () => { const c = columns.find((x) => x.name === s.column); return c ? c.type : ''; };

      async function loadSaved() { saved = await services.idb.listScripts('regex'); onLeftChange(); }
      loadSaved();

      /** Columns of the selected dataset; keeps the chosen column when it still exists. */
      async function loadColumns() {
        const ds = selected();
        if (!ds) { columns = []; columnsFor = null; return; }
        try { columns = await services.datasets.columns(ds.id); } catch (_err) { columns = []; }
        columnsFor = ds.id;
        if (!columns.some((c) => c.name === s.column)) {
          const text = columns.find((c) => c.type === 'text');
          s.column = text ? text.name : (columns[0] ? columns[0].name : '');
        }
        updateDefaultName();
      }
      /** Suggested name of the new column; follows the column until the user types a name of their own. */
      function updateDefaultName() {
        const next = s.action === 'flag' ? t('regex.flag.default', { column: s.column }) : s.action === 'count' ? t('regex.count.default', { column: s.column }) : s.column;
        if (!s.name || s.name === defaultName) s.name = next;
        defaultName = next;
      }

      // ---- object panel ---------------------------------------------------------------------------
      /** Saved patterns and the library, below the dataset list. */
      function left(container, onChange) {
        onLeftChange = onChange || (() => {});
        container.appendChild(h('hr'));
        container.appendChild(h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('regex.saved') }), ui.button({ label: t('regex.new'), icon: 'plus', size: 'sm', 'icon-only': true, variant: 'ghost', onClick: () => { current = { id: null, name: '', createdAt: null }; setPattern('', {}); } })));
        container.appendChild(saved.length ? h('div', { class: 'dm-list' }, saved.map((sc) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': sc.id === current.id ? 'true' : null, onclick: () => { current = { id: sc.id, name: sc.name, createdAt: sc.createdAt }; setPattern(sc.code, sc.options || {}); } },
          ui.icon('regex', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: sc.name }), h('code', { class: 'dm-list-code dm-truncate', text: sc.code })))))
          : h('p', { class: 'dm-help', text: t('regex.saved.empty') }));
        container.appendChild(h('h4', { text: t('regex.library') }));
        for (const group of ['se', 'nordic', 'general']) {
          container.appendChild(h('p', { class: 'dm-faint dm-xs', text: t('regex.lib.group.' + group) }));
          container.appendChild(h('div', { class: 'dm-list' }, regex.LIBRARY.filter((x) => x.group === group).map((x) => h('button', { type: 'button', class: 'dm-list-item', title: x.pattern, onclick: () => setPattern(x.pattern, {}) },
            h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: t('regex.lib.' + x.id) }), h('code', { class: 'dm-list-code dm-truncate', text: x.pattern }))))));
        }
      }

      /** Use a pattern (from the library, a saved pattern or a shape) and show it. */
      function setPattern(pattern, opts) {
        s.pattern = pattern;
        s.caseInsensitive = !!opts.caseInsensitive; s.whole = !!opts.whole; s.dotAll = !!opts.dotAll;
        if (s.action === 'profile') s.action = 'test';
        onLeftChange();
        if (options.rerender) options.rerender();
      }

      // ---- centre ---------------------------------------------------------------------------------
      function center() {
        const ds = selected();
        applyBtn = ui.button({ label: s.action === 'rule' ? t('regex.apply.rule') : t('regex.apply'), icon: s.action === 'rule' ? 'circle-check' : 'play', variant: 'primary', onClick: apply });
        applyBtn.hidden = !CHANGES.has(s.action);
        const head = h('div', { class: 'dm-page-head' },
          h('h1', null, ui.icon('regex', 20), t('regex.title'), ' ', h('dm-badge', { text: ds ? ds.name : t('sql.no.dataset'), kind: ds ? null : 'warn' })),
          h('div', { class: 'dm-row' },
            applyBtn,
            ui.button({ label: t('regex.save'), icon: 'save', onClick: save }),
            current.id ? ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: remove }) : null));
        if (!ds) return { head, body: [h('dm-empty-state', { heading: t('regex.no.dataset'), text: t('regex.intro') })] };

        const colSelect = /** @type {any} */ (h('dm-select', { label: t('regex.column') }));
        colSelect.options = columns.map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` }));
        colSelect.value = s.column;
        colSelect.addEventListener('change', () => { s.column = colSelect.value; updateDefaultName(); renderActionFields(); schedule(0); });

        patternInput = /** @type {any} */ (h('dm-input', { label: t('regex.pattern'), mono: true, placeholder: t('regex.pattern.placeholder'), help: t('regex.pattern.help') }));
        patternInput.value = s.pattern;
        patternInput.addEventListener('input', () => { s.pattern = patternInput.value; schedule(); });

        const sw = (key, label) => {
          const el = /** @type {any} */ (h('dm-switch', { label }));
          el.checked = !!s[key];
          el.addEventListener('change', () => { s[key] = el.checked; schedule(0); });
          return el;
        };
        const actionSelect = /** @type {any} */ (h('dm-select', { label: t('regex.action') }));
        actionSelect.options = ACTIONS.map((a) => ({ value: a, label: t('regex.action.' + a) }));
        actionSelect.value = s.action;
        actionSelect.addEventListener('change', () => {
          s.action = actionSelect.value; updateDefaultName();
          applyBtn.hidden = !CHANGES.has(s.action);
          applyBtn.label = s.action === 'rule' ? t('regex.apply.rule') : t('regex.apply');
          renderActionFields(); schedule(0);
        });
        actionFieldsEl = h('div', { class: 'dm-form-grid' });
        renderActionFields();
        summaryEl = h('p', { class: 'dm-help', role: 'status', 'aria-live': 'polite' });
        previewEl = h('div', { class: 'dm-regex-preview' });
        schedule(0);
        return {
          head,
          body: [
            h('div', { class: 'dm-form-grid' }, colSelect, patternInput),
            h('div', { class: 'dm-row-wrap' }, sw('caseInsensitive', t('regex.case')), sw('whole', t('regex.whole')), sw('dotAll', t('regex.dotall'))),
            h('div', { class: 'dm-form-grid' }, actionSelect),
            actionFieldsEl, summaryEl, previewEl,
          ],
        };
      }

      /** The fields of the chosen action. */
      function renderActionFields() {
        if (!actionFieldsEl) return;
        const input = (key, label, extra = {}) => {
          const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, extra)));
          el.value = s[key] === undefined || s[key] === null ? '' : String(s[key]);
          el.addEventListener('input', () => { s[key] = extra.type === 'number' ? Number(el.value) : el.value; schedule(); });
          return el;
        };
        const select = (key, label, values, prefix) => {
          const el = /** @type {any} */ (h('dm-select', { label }));
          el.options = values.map((v) => ({ value: v, label: t(prefix + v) }));
          el.value = s[key];
          el.addEventListener('change', () => { s[key] = el.value; renderActionFields(); schedule(0); });
          return el;
        };
        const fields = [];
        if (s.action === 'test') fields.push(select('show', t('regex.show'), ['all', 'match', 'nomatch'], 'regex.show.'));
        if (s.action === 'profile') {
          const el = /** @type {any} */ (h('dm-switch', { label: t('regex.profile.collapse') }));
          el.checked = s.collapse;
          el.addEventListener('change', () => { s.collapse = el.checked; schedule(0); });
          fields.push(el, h('p', { class: 'dm-help', text: t('regex.profile.help') }));
        }
        if (s.action === 'filter') fields.push(select('keep', t('regex.keep'), ['matching', 'other'], 'regex.keep.'));
        if (s.action === 'extract') {
          fields.push(select('which', t('regex.which'), ['first', 'all'], 'regex.which.'));
          if (s.which === 'all') fields.push(input('sep', t('regex.sep')));
          let plan = [];
          try { plan = regexOps.extractPlan({ column: s.column, pattern: s.pattern, caseInsensitive: s.caseInsensitive, names: '' }); } catch (_err) { plan = []; }
          fields.push(input('names', t('regex.names'), { placeholder: plan.map((x) => x.name).join(', '), help: t('regex.names.help') }));
        }
        if (s.action === 'replace') {
          fields.push(input('replacement', t('regex.replacement'), { mono: true, help: t('regex.replacement.help') }));
          if (columnType() && columnType() !== 'text') fields.push(h('p', { class: 'dm-warn dm-small', text: t('regex.replace.text.only') }));
        }
        if (s.action === 'split') fields.push(input('parts', t('regex.parts'), { type: 'number', min: '2', max: '20' }), input('name', t('regex.prefix')));
        if (s.action === 'flag' || s.action === 'count') fields.push(input('name', t('regex.name')));
        if (s.action === 'rule') fields.push(h('p', { class: 'dm-help', text: t('regex.rule.help') }));
        replace(actionFieldsEl, ...fields);
      }

      // ---- preview --------------------------------------------------------------------------------
      function schedule(delay = 250) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          preview().catch((err) => {
            // The dataset may have been removed while the preview waited; anything else is shown.
            const ds = selected();
            if (!ds || !store.get().datasets.some((d) => d.id === ds.id)) return;
            if (summaryEl) { summaryEl.className = 'dm-error dm-small'; summaryEl.textContent = (err && err.message) || String(err); }
            D.log('regex', 'preview failed', err);
          });
        }, delay);
      }

      async function preview() {
        const my = ++seq;
        const ds = selected();
        if (!previewEl || !ds) return;
        if (columnsFor !== ds.id) { await loadColumns(); if (my !== seq) return; if (options.rerender) { options.rerender(); return; } }
        if (!s.column) { summaryEl.textContent = t('regex.no.column'); replace(previewEl); return; }
        if (s.action === 'profile') return previewProfile(my, ds);
        const compiled = s.pattern ? regex.compile(fullPattern(), flags()) : null;
        if (patternInput) patternInput.error = compiled && compiled.error ? t('regex.err.invalid', { message: compiled.error }) : '';
        const values = await regex.distinct(ds.id, s.column, PREVIEW_DISTINCT);
        if (my !== seq) return;
        if (!s.pattern || !compiled || compiled.error) {
          summaryEl.className = compiled && compiled.error ? 'dm-error dm-small' : 'dm-help';
          summaryEl.textContent = compiled && compiled.error ? t('regex.err.invalid', { message: compiled.error }) : t('regex.enter.pattern');
          renderValues(values, null, null);
          return;
        }
        try {
          const texts = values.map((v) => v[0]);
          const matches = await regex.run({ op: 'match', pattern: fullPattern(), flags: flags(), values: texts, limit: 50 });
          const replaced = s.action === 'replace' ? await regex.run({ op: 'replace', pattern: fullPattern(), flags: flags(), values: texts, replacement: s.replacement }) : null;
          const st = await regex.stats(ds.id, s.column, fullPattern(), flags(), COUNT_DISTINCT);
          if (my !== seq) return;
          const share = st.filled ? i18n.formatNumber(Math.round((st.matching / st.filled) * 1000) / 10) + ' %' : '–';
          summaryEl.className = 'dm-help';
          summaryEl.textContent = t('regex.summary', { matching: i18n.formatNumber(st.matching), filled: i18n.formatNumber(st.filled), share })
            + (st.sampled ? ' ' + t('regex.summary.sampled', { n: i18n.formatNumber(COUNT_DISTINCT), distinct: i18n.formatNumber(st.distinct) }) : '')
            + (compiled.unicode ? '' : ' ' + t('regex.summary.nounicode'));
          renderValues(values, matches, replaced);
        } catch (err) {
          if (my !== seq) return;
          summaryEl.className = err instanceof regex.RegexTimeout ? 'dm-warn dm-small' : 'dm-error dm-small';
          summaryEl.textContent = (err && err.message) || String(err);
          renderValues(values, null, null);
        }
      }

      /** A value with its matches marked. */
      function marked(value, ms) {
        if (!ms || !ms.length) return [value];
        const out = []; let at = 0;
        for (const [index, length] of ms) {
          if (!length) continue;
          if (index > at) out.push(value.slice(at, index));
          out.push(h('mark', { class: 'dm-regex-hit', text: value.slice(index, index + length) }));
          at = index + length;
        }
        if (at < value.length) out.push(value.slice(at));
        return out;
      }

      /** Parts of a value split at its matches, as dm_regex_split gives them. */
      function splitParts(value, ms, n) {
        const cuts = (ms || []).filter(([index, length]) => !(length === 0 && (index === 0 || index >= value.length))).slice(0, n - 1);
        const parts = []; let at = 0;
        for (const [index, length] of cuts) { parts.push(value.slice(at, index)); at = index + length; }
        parts.push(value.slice(at));
        while (parts.length < n) parts.push(null);
        return parts;
      }

      function renderValues(values, matches, replaced) {
        if (!previewEl) return;
        const yes = t('common.yes'); const no = t('common.no');
        let plan = [];
        if (s.action === 'extract' && matches) { try { plan = regexOps.extractPlan({ column: s.column, pattern: s.pattern, caseInsensitive: s.caseInsensitive, names: s.names }); } catch (_err) { plan = []; } }
        const parts = Math.max(2, Math.min(20, Math.trunc(Number(s.parts) || 2)));
        const heads = [t('regex.col.value'), t('regex.col.count')];
        if (matches) {
          if (s.action === 'test') heads.push(t('regex.col.hits'));
          if (s.action === 'filter') heads.push(t('regex.col.result'));
          if (s.action === 'extract') for (const x of plan) heads.push(x.name);
          if (s.action === 'replace') heads.push(t('regex.col.after'));
          if (s.action === 'split') for (let i = 1; i <= parts; i++) heads.push(`${s.name || s.column}_${i}`);
          if (s.action === 'flag' || s.action === 'count') heads.push(s.name || '');
          if (s.action === 'rule') heads.push(t('regex.col.passes'));
        }
        const rows = [];
        values.forEach(([value, n], i) => {
          const ms = matches ? matches[i] : null;
          const hit = !!(ms && ms.length);
          if (s.action === 'test' && matches && ((s.show === 'match' && !hit) || (s.show === 'nomatch' && hit))) return;
          if (rows.length >= PREVIEW_SHOWN) return;
          const cells = [h('td', { class: 'dm-regex-value' }, ...marked(value, ms)), h('td', { class: 'dm-num', text: i18n.formatNumber(n) })];
          if (matches) {
            const text = (v) => h('td', { class: 'dm-regex-value', text: v === null || v === undefined ? '' : String(v) });
            if (s.action === 'test') cells.push(h('td', { class: 'dm-num', text: i18n.formatNumber(ms.filter((m) => m[1] > 0).length) }));
            if (s.action === 'filter') cells.push(h('td', { text: (s.keep === 'other' ? !hit : hit) ? t('regex.result.keep') : t('regex.result.remove') }));
            if (s.action === 'extract') {
              plan.forEach((x, gi) => {
                const pick = (m) => (x.group === '0' ? value.substr(m[0], m[1]) : m[2][gi]);
                const found = s.which === 'all' ? ms.map(pick).filter((v) => v !== null && v !== '').join(s.sep) : (ms[0] ? pick(ms[0]) : null);
                cells.push(text(found || null));
              });
            }
            if (s.action === 'replace') cells.push(text(replaced ? replaced[i] : ''));
            if (s.action === 'split') for (const part of splitParts(value, ms, parts)) cells.push(text(part));
            if (s.action === 'flag' || s.action === 'rule') cells.push(h('td', { text: hit ? yes : no }));
            if (s.action === 'count') cells.push(h('td', { class: 'dm-num', text: i18n.formatNumber(ms.filter((m) => m[1] > 0).length) }));
          }
          rows.push(h('tr', null, ...cells));
        });
        const numeric = new Set([t('regex.col.count'), t('regex.col.hits')].concat(s.action === 'count' ? [s.name || ''] : []));
        replace(previewEl, rows.length
          ? h('table', { class: 'dm-columns-table' }, h('thead', null, h('tr', null, ...heads.map((x, i) => h('th', { class: i > 0 && numeric.has(x) ? 'dm-num' : null, text: x })))), h('tbody', null, ...rows))
          : h('p', { class: 'dm-help dm-console-empty', text: t('regex.preview.empty') }));
      }

      async function previewProfile(my, ds) {
        try {
          const shapes = await regex.profile(ds.id, s.column, s.collapse);
          if (my !== seq) return;
          const total = shapes.reduce((a, x) => a + x.count, 0);
          summaryEl.className = 'dm-help';
          summaryEl.textContent = t('regex.profile.summary', { n: i18n.formatNumber(shapes.length) });
          replace(previewEl, h('table', { class: 'dm-columns-table' },
            h('thead', null, h('tr', null, ...[t('regex.col.shape'), t('regex.col.count'), t('regex.col.share'), t('regex.col.example'), ''].map((x, i) => h('th', { class: i === 1 || i === 2 ? 'dm-num' : null, text: x })))),
            h('tbody', null, ...shapes.map((x) => h('tr', null,
              h('td', { class: 'dm-regex-value', text: x.shape }),
              h('td', { class: 'dm-num', text: i18n.formatNumber(x.count) }),
              h('td', { class: 'dm-num', text: total ? i18n.formatNumber(Math.round((x.count / total) * 1000) / 10) + ' %' : '' }),
              h('td', { class: 'dm-regex-value', text: x.example }),
              h('td', null, ui.button({ label: t('regex.use'), size: 'sm', onClick: () => setPattern(regex.patternFromShape(x.shape), {}) })))))));
        } catch (err) {
          summaryEl.className = 'dm-error dm-small';
          summaryEl.textContent = (err && err.message) || String(err);
        }
      }

      // ---- actions --------------------------------------------------------------------------------
      /** The recipe step of the chosen action, or null for actions that only look. */
      function stepOf() {
        const base = { column: s.column, pattern: s.pattern, caseInsensitive: s.caseInsensitive };
        switch (s.action) {
          case 'filter': return ['regex_filter', Object.assign(base, { whole: s.whole, keep: s.keep })];
          case 'extract': return ['regex_extract', Object.assign(base, { which: s.which, sep: s.sep, names: s.names })];
          case 'flag': return ['regex_flag', Object.assign(base, { whole: s.whole, name: String(s.name || '').trim() })];
          case 'count': return ['regex_count', Object.assign(base, { name: String(s.name || '').trim() })];
          case 'split': return ['regex_split', Object.assign(base, { parts: Math.max(2, Math.min(20, Math.trunc(Number(s.parts) || 2))), name: String(s.name || s.column).trim() })];
          case 'replace': return ['replace_text', { columns: [s.column], find: (s.dotAll ? '(?s)' : '') + fullPattern(), replace: s.replacement, regex: true, caseInsensitive: s.caseInsensitive }];
          default: return null;
        }
      }

      async function apply() {
        const ds = selected();
        if (!ds || !s.column) return;
        const compiled = regex.compile(fullPattern(), flags());
        if (!s.pattern || compiled.error) { ui.toast.show(compiled.error ? t('regex.err.invalid', { message: compiled.error }) : t('regex.enter.pattern'), { kind: 'warn' }); return; }
        applyBtn.loading = true;
        try {
          if (s.action === 'rule') {
            await regex.guard(ds.id, s.column, fullPattern(), flags());
            await rules.add(ds.id, { type: 'regex', column: s.column, pattern: (s.caseInsensitive ? '(?i)' : '') + fullPattern() });
            shell.log(t('regex.rule.added', { column: s.column }), 'ok');
            ui.toast.show(t('regex.rule.added', { column: s.column }), { kind: 'ok' });
            return;
          }
          const op = stepOf();
          if (!op) return;
          const [opId, params] = op;
          const result = await recipes.apply(ds.id, opId, params);
          const text = recipes.describe(opId, params, result);
          shell.log(text, 'ok');
          ui.toast.show(text, { kind: 'ok', action: { label: t('analysera.open.bearbeta'), onClick: () => { store.set({ selectedId: ds.id }); shell.activate('bearbeta'); } } });
          columnsFor = null;
          await loadColumns();
          if (options.rerender) options.rerender();
        } catch (err) {
          const message = (err && err.message) || String(err);
          shell.log(message, 'error');
          ui.toast.show(message, { kind: err instanceof regex.RegexTimeout ? 'warn' : 'error', timeout: 10000 });
        } finally { applyBtn.loading = false; }
      }

      async function save() {
        if (!s.pattern) { ui.toast.show(t('regex.enter.pattern'), { kind: 'warn' }); return; }
        const name = await ui.dialog.prompt(t('regex.save.name'), { title: t('regex.save'), value: current.name || t('analysera.script.untitled') });
        if (!name || !name.trim()) return;
        const now = new Date().toISOString();
        const record = { id: current.id || ('sc_' + Date.now().toString(36)), name: name.trim(), language: 'regex', code: s.pattern, options: { caseInsensitive: s.caseInsensitive, whole: s.whole, dotAll: s.dotAll }, updatedAt: now, createdAt: current.createdAt || now };
        await services.idb.putScript(record);
        current = { id: record.id, name: record.name, createdAt: record.createdAt };
        await loadSaved();
        shell.log(t('regex.saved.done', { name: record.name }), 'ok');
        ui.toast.show(t('regex.saved.done', { name: record.name }), { kind: 'ok' });
        if (options.rerender) options.rerender();
      }

      async function remove() {
        if (!current.id) return;
        if (!(await ui.dialog.confirm(t('regex.delete.confirm', { name: current.name }), { okLabel: t('common.delete'), danger: true }))) return;
        await services.idb.deleteScript(current.id);
        current = { id: null, name: '', createdAt: null };
        await loadSaved();
        if (options.rerender) options.rerender();
      }

      // ---- inspector ------------------------------------------------------------------------------
      /** SQL and R code that does the chosen action with the current pattern. */
      function snippets() {
        const ds = selected();
        const col = s.column || 'kolumn';
        const qc = /^[a-z_][a-z0-9_]*$/i.test(col) ? col : '"' + col.replace(/"/g, '""') + '"';
        const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
        const p = lit(fullPattern()); const f = lit(flags());
        const short = ds ? (ds.shortName || 'data') : 'data';
        const sql = s.action === 'extract' ? `select ${qc}, dm_regex_extract(${qc}, ${p}, 1, ${f}) as del\nfrom data` :
          s.action === 'replace' ? `select ${qc}, regexp_replace(${qc}, ${p}, ${lit(s.replacement)}, ${lit(flags() + 'g')}) as efter\nfrom data` :
          s.action === 'count' ? `select ${qc}, dm_regex_count(${qc}, ${p}, ${f}) as antal\nfrom data` :
          s.action === 'split' ? `select ${qc}, dm_regex_split(${qc}, ${p}, 1, 2, ${f}) as del_1,\n  dm_regex_split(${qc}, ${p}, 2, 2, ${f}) as del_2\nfrom data` :
          `select * from data\nwhere dm_regex_test(${qc}, ${p}, ${f}) = 1`;
        const rcol = `df[[${JSON.stringify(col)}]]`;
        const rx = regex.rRegex(fullPattern(), flags());
        const r = `df <- dm_read(${JSON.stringify(short)})\n` + (s.action === 'extract' ? `stringr::str_match(${rcol}, ${rx})` :
          s.action === 'replace' ? `stringr::str_replace_all(${rcol}, ${rx}, ${JSON.stringify(regex.rReplacement(s.replacement, fullPattern()))})` :
          s.action === 'count' ? `stringr::str_count(${rcol}, ${rx})` :
          s.action === 'split' ? `stringr::str_split_fixed(${rcol}, ${rx}, 2)` :
          `df[stringr::str_detect(${rcol}, ${rx}) %in% TRUE, ]`);
        return { sql, r };
      }

      function inspector() {
        const code = s.pattern ? snippets() : null;
        return h('div', { class: 'dm-stack' },
          h('h4', { text: t('regex.syntax') }),
          h('dl', { class: 'dm-regex-syntax' }, ...SYNTAX.flatMap(([syntax, key]) => [h('dt', { text: syntax }), h('dd', { text: t('regex.syntax.' + key) })])),
          h('p', { class: 'dm-help', text: t('regex.help') }),
          code ? h('h4', { text: t('regex.code') }) : null,
          code ? h('pre', { class: 'dm-regex-snippet', text: code.sql }) : null,
          code ? ui.button({ label: t('regex.code.sql'), icon: 'database', size: 'sm', onClick: () => options.openTab('sql', code.sql) }) : null,
          code ? h('pre', { class: 'dm-regex-snippet', text: code.r }) : null,
          code ? ui.button({ label: t('regex.code.r'), icon: 'terminal', size: 'sm', onClick: () => options.openTab('r', code.r) }) : null);
      }

      /** The selected dataset changed: reload its columns and the preview. */
      function datasetChanged() { columnsFor = null; schedule(0); }
      function destroy() { clearTimeout(timer); seq++; summaryEl = null; previewEl = null; patternInput = null; actionFieldsEl = null; }

      return { center, left, inspector, datasetChanged, destroy, setPattern, state: s, reload: loadSaved };
    }
    return { create, ACTIONS };
  });
})();
