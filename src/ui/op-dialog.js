// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dialog that turns an operation's parameter schema into a form, previews the effect when the
 * operation supports it, and applies it as a recipe step.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/op-dialog', ['ui/base', 'ui/overlays', 'ui/basic', 'data/operations', 'data/recipes', 'data/types'], (base, overlays, basic, ops, recipes, types) => {
    const { h, t, i18n, replace } = base;
    const TEXT_ONLY_OPS = new Set(['replace_text', 'trim', 'change_case', 'fix_encoding', 'clean_chars']);

    /** The label of a select option: the operation's own text first, then the shared ones. */
    function optionLabel(param, value, opId) {
      const own = opId ? `op.${opId}.${param.name}.${value}` : '';
      if (own && i18n.has(own)) return t(own);
      if (param.name === 'type') return t('type.' + value);
      const key = `opt.${param.name}.${value}`;
      return i18n.has(key) ? t(key) : (i18n.has('opt.' + value) ? t('opt.' + value) : String(value));
    }
    function paramLabel(opId, param) {
      const specific = `op.${opId}.${param.name}`;
      return i18n.has(specific) ? t(specific) : (i18n.has('param.' + param.name) ? t('param.' + param.name) : param.name);
    }

    /**
     * @param {{datasetId: string, opId: string, preset?: Record<string, any>, columns: any[], onApplied?: (result: any) => void, title?: string}} options
     */
    async function open(options) {
      const op = ops.get(options.opId);
      const columns = options.columns;
      const values = Object.assign({}, options.preset || {});
      for (const p of op.params) if (values[p.name] === undefined && p.default !== undefined) values[p.name] = p.default;
      const fields = [];
      const previewEl = h('div', { class: 'dm-op-preview dm-help' });
      let previewTimer = 0;
      // Fields an operation can fill from the chosen column (op.defaults), until the user edits them.
      const inputs = {}; const touched = new Set();
      function applyDefaults() {
        if (!op.defaults) return;
        const found = op.defaults({ column: (n) => columns.find((c) => c.name === n) || null }, values) || {};
        for (const [k, v] of Object.entries(found)) if (inputs[k] && !touched.has(k) && !(options.preset && options.preset[k])) { inputs[k].value = v; values[k] = v; }
      }

      const textOnly = TEXT_ONLY_OPS.has(op.id);
      for (const p of op.params) {
        if (p.type === 'column') {
          const sel = /** @type {any} */ (h('dm-select', { label: paramLabel(op.id, p) }));
          // Parameters may restrict the column types (kinds) and suggest a default by name (prefer, a RegExp).
          const wanted = p.kinds ? columns.filter((c) => p.kinds.includes(c.type)) : (textOnly ? columns.filter((c) => c.type === 'text') : columns);
          // `labelled`: columns that have value labels come first, so the default is one the operation can use.
          const list = (wanted.length ? wanted : columns).slice().sort((a, b) => (p.labelled ? (b.valueLabels ? 1 : 0) - (a.valueLabels ? 1 : 0) : 0));
          // An optional column (for example "per group") starts empty.
          sel.options = (p.optional ? [{ value: '', label: t('op.column.none') }] : []).concat(list.map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` })));
          const preferred = p.prefer ? list.find((c) => p.prefer.test(c.name)) : null;
          sel.value = values[p.name] !== undefined ? values[p.name] : p.optional ? '' : ((preferred && preferred.name) || (list[0] && list[0].name));
          values[p.name] = sel.value;
          sel.addEventListener('change', () => { values[p.name] = sel.value; applyDefaults(); schedulePreview(); });
          fields.push(sel);
        } else if (p.type === 'columns') {
          const chosen = new Set(values[p.name] || []);
          const boxes = columns.map((c) => {
            const sw = /** @type {any} */ (h('dm-switch', { label: `${c.name} (${t('type.' + c.type)})` }));
            const disabled = textOnly && c.type !== 'text';
            if (disabled) sw.setAttribute('disabled', '');
            sw.checked = chosen.has(c.name) && !disabled;
            sw.addEventListener('change', () => { if (sw.checked) chosen.add(c.name); else chosen.delete(c.name); values[p.name] = columns.map((x) => x.name).filter((n) => chosen.has(n)); schedulePreview(); });
            return sw;
          });
          values[p.name] = columns.map((x) => x.name).filter((n) => chosen.has(n) && !(textOnly && columns.find((c) => c.name === n).type !== 'text'));
          fields.push(h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: paramLabel(op.id, p) }), h('div', { class: 'dm-columns-pick' }, boxes)));
        } else if (p.type === 'model') {
          // A saved model: the recipe step keeps a copy of it, so it replays without the dataset that fitted it.
          const sel = /** @type {any} */ (h('dm-select', { label: paramLabel(op.id, p) }));
          fields.push(sel);
          D.require('data/models').list().then((all) => {
            sel.options = [{ value: '', label: all.length ? t('predict.pick') : t('predict.none') }].concat(all.map((m) => ({ value: m.id, label: `${m.name} (${m.datasetName})` })));
            sel.value = values[p.name] ? values[p.name].id : '';
            sel.addEventListener('change', () => { const m = all.find((x) => x.id === sel.value); if (m) { const copy = Object.assign({}, m); delete copy.datasetId; delete copy.datasetName; values[p.name] = copy; } else values[p.name] = null; schedulePreview(); });
          });
        } else if (p.type === 'dataset') {
          // Another dataset, by id (a table to read from); `kinds` limits the dataset kinds offered.
          const sel = /** @type {any} */ (h('dm-select', { label: paramLabel(op.id, p) }));
          fields.push(sel);
          D.require('data/datasets').list().then((all) => {
            const list = all.filter((d) => d.id !== options.datasetId && (!p.kinds || p.kinds.includes(d.kind || 'table')));
            sel.options = [{ value: '', label: t('op.dataset.pick') }].concat(list.map((d) => ({ value: d.id, label: d.folder ? `${d.folder}/${d.name}` : d.name })));
            sel.value = values[p.name] || '';
            sel.addEventListener('change', () => { values[p.name] = sel.value; schedulePreview(); });
          });
        } else if (p.type === 'select') {
          const sel = /** @type {any} */ (h('dm-select', { label: paramLabel(op.id, p) }));
          // A choice can be a list of its own, with names that need no translation, such as coordinate systems.
          const choices = typeof p.options === 'function' ? p.options() : p.options;
          sel.options = choices.map((v) => (v && typeof v === 'object' ? v : { value: v, label: optionLabel(p, v, op.id) }));
          sel.value = values[p.name] || (choices[0] && typeof choices[0] === 'object' ? choices[0].value : choices[0]);
          values[p.name] = sel.value;
          sel.addEventListener('change', () => { values[p.name] = sel.value; schedulePreview(); });
          fields.push(sel);
        } else if (p.type === 'switch') {
          const sw = /** @type {any} */ (h('dm-switch', { label: paramLabel(op.id, p) }));
          sw.checked = !!values[p.name];
          sw.addEventListener('change', () => { values[p.name] = sw.checked; schedulePreview(); });
          fields.push(sw);
        } else if (p.type === 'lines') {
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '5', label: paramLabel(op.id, p), mono: true, help: i18n.has(`op.${op.id}.${p.name}.help`) ? t(`op.${op.id}.${p.name}.help`) : '' }));
          ta.value = values[p.name] || '';
          ta.addEventListener('input', () => { values[p.name] = ta.value; touched.add(p.name); schedulePreview(); });
          inputs[p.name] = ta;
          fields.push(ta);
        } else if (p.type === 'expression') {
          const help = i18n.has(`op.${op.id}.${p.name}.help`) ? t(`op.${op.id}.${p.name}.help`) : '';
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: paramLabel(op.id, p), mono: true, help: help ? help + ' ' + t('op.columns.available', { columns: columns.map((c) => c.name).join(', ') }) : t('op.columns.available', { columns: columns.map((c) => c.name).join(', ') }) }));
          ta.value = values[p.name] || '';
          ta.addEventListener('input', () => { values[p.name] = ta.value; schedulePreview(); });
          fields.push(ta);
        } else if (p.type === 'code') {
          // A code step: an editor in the parameter's language, starting from the operation's template.
          const editor = /** @type {any} */ (h('dm-code', { language: p.language || 'python', label: paramLabel(op.id, p) }));
          editor.value = values[p.name] || (i18n.has(`op.${op.id}.template`) ? t(`op.${op.id}.template`) : '');
          values[p.name] = editor.value;
          editor.addEventListener('dm-change', () => { values[p.name] = editor.value; });
          inputs[p.name] = editor;
          fields.push(h('div', { class: 'dm-stack-sm' }, i18n.has(`op.${op.id}.${p.name}.help`) ? h('p', { class: 'dm-help', text: t(`op.${op.id}.${p.name}.help`) }) : null, h('div', { class: 'dm-editor-wrap' }, editor)));
        } else if (p.type === 'pattern') {
          // A regular expression: monospace, checked as it is typed.
          const input = /** @type {any} */ (h('dm-input', { label: paramLabel(op.id, p), mono: true, help: t('regex.pattern.help') }));
          input.value = values[p.name] || '';
          input.addEventListener('input', () => {
            values[p.name] = input.value;
            const res = D.require('data/regex-syntax').compile(input.value);
            input.error = input.value && res.error ? t('regex.err.invalid', { message: res.error }) : '';
            schedulePreview();
          });
          fields.push(input);
        } else {
          const input = /** @type {any} */ (h('dm-input', { type: p.type === 'number' ? 'number' : 'text', label: paramLabel(op.id, p), placeholder: i18n.has(`op.${op.id}.${p.name}.placeholder`) ? t(`op.${op.id}.${p.name}.placeholder`) : '' }));
          input.value = values[p.name] === undefined || values[p.name] === null ? (p.default !== undefined ? String(p.default) : '') : values[p.name];
          if (p.default !== undefined && (values[p.name] === undefined || values[p.name] === null)) values[p.name] = p.type === 'number' ? Number(p.default) : String(p.default);
          input.addEventListener('input', () => { values[p.name] = p.type === 'number' ? Number(input.value) : input.value; schedulePreview(); });
          fields.push(input);
        }
      }

      function missing() {
        return op.params.filter((p) => p.required && (values[p.name] === undefined || values[p.name] === null || values[p.name] === '' || (Array.isArray(values[p.name]) && !values[p.name].length))).map((p) => paramLabel(op.id, p));
      }

      const lastLine = (text) => { const lines = String(text).trim().split('\n'); return lines[lines.length - 1] || String(text); };
      async function runPreview() {
        if (!op.preview) { previewEl.textContent = ''; return; }
        if (missing().length) { previewEl.textContent = t('op.preview.incomplete'); return; }
        previewEl.textContent = t('common.loading');
        try {
          const res = await recipes.preview(options.datasetId, op.id, values);
          // A code step previews the resulting table (its first rows); other operations the rows affected.
          const parts = res.columns
            ? [h('span', { text: t('op.preview.result.rows', { n: i18n.formatNumber(res.rows || 0), c: i18n.formatNumber(res.columns.length) }) })]
            : [h('span', { text: t('op.preview.rows', { n: i18n.formatNumber(res.rows || 0) }) })];
          if (res.samples && res.samples.length) parts.push(h('ul', { class: 'dm-op-samples' }, res.samples.map((s) => h('li', null, h('code', { text: String(s.before) }), ' → ', h('code', { text: String(s.after) })))));
          if (res.columns && res.sample) {
            parts.push(h('div', { class: 'dm-table-wrap' }, h('table', { class: 'dm-nb-table' },
              h('thead', null, h('tr', null, res.columns.map((c) => h('th', { text: String(c) })))),
              h('tbody', null, res.sample.map((r) => h('tr', null, r.map((v) => h('td', { text: v === null || v === undefined ? '' : typeof v === 'number' ? i18n.formatNumber(v) : String(v) }))))))));
          }
          // A step on a model says what came out in a sentence of its own.
          if (res.note) parts.push(h('p', { class: 'dm-help', text: String(res.note) }));
          replace(previewEl, parts);
        } catch (err) { previewEl.textContent = t('op.preview.error', { message: lastLine((err && err.message) || String(err)) }); }
      }
      // Operations that run code preview on request only (the engines are slow and the code is being typed).
      function schedulePreview() { if (op.manualPreview) return; clearTimeout(previewTimer); previewTimer = setTimeout(runPreview, 300); }

      const body = h('div', { class: 'dm-stack' },
        i18n.has(`op.${op.id}.help`) ? h('p', { class: 'dm-help', text: t(`op.${op.id}.help`) }) : null,
        h('div', { class: 'dm-stack' }, fields),
        op.manualPreview && op.preview ? h('div', { class: 'dm-row' }, basic.button({ label: i18n.has(`op.${op.id}.preview.run`) ? t(`op.${op.id}.preview.run`) : t('op.preview.run', { n: i18n.formatNumber(D.require('data/code-steps').PREVIEW_ROWS) }), icon: 'eye', onClick: runPreview })) : null,
        previewEl);
      applyDefaults();
      schedulePreview();
      const choice = await overlays.dialog.open({
        title: options.title || t('op.' + op.id),
        help: 'bearbeta#åtgärder',
        body,
        size: 'lg',
        actions: [{ label: t('common.cancel'), value: false }, { label: t('op.apply'), variant: 'primary', value: true, primary: true }],
      });
      if (choice !== true) return null;
      const lacking = missing();
      if (lacking.length) { overlays.toast.show(t('op.missing', { fields: lacking.join(', ') }), { kind: 'warn' }); return open(Object.assign({}, options, { preset: values })); }
      const guard = D.require('data/protected-columns');
      const handle = await D.require('data/datasets').ensureOpen(options.datasetId);
      const guarded = guard.list(handle.meta, handle.columns);
      const hits = guard.touched(op.id, values).filter((c) => guarded.includes(c));
      if (hits.length && !(await overlays.dialog.confirm(t('protected.confirm', { columns: hits.join(', ') }), { danger: true }))) return open(Object.assign({}, options, { preset: values }));
      try {
        const result = await recipes.apply(options.datasetId, op.id, values);
        const description = recipes.describe(op.id, values, result);
        overlays.toast.show(description, { kind: 'ok' });
        if (options.onApplied) options.onApplied(result, description);
        return result;
      } catch (err) {
        overlays.toast.show(t('op.failed', { message: (err && err.message) || String(err) }), { kind: 'error' });
        return open(Object.assign({}, options, { preset: values }));
      }
    }

    return { open, paramLabel, optionLabel, TEXT_ONLY_OPS };
  });
})();
