// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Generic endpoint form: pick an endpoint, fill its parameters (fields generated from the parameter
 * schema, option lists fetched from other endpoints when `optionsFrom` is set) and fetch.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/endpoint-form', ['ui/base', 'ui/basic', 'ui/api/variable-picker', 'api/runner', 'api/request'], (base, basic, _picker, runner, request) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {{connector: any, runFetch: Function}} api
     */
    function create(api) {
      const { connector } = api;
      const endpoints = (connector.endpoints || []);
      const state = { endpointId: endpoints[0] ? endpoints[0].id : null, values: {}, maxPages: '' };
      const optionState = new Map(); // param name -> {loading, options, error, key}
      const el = h('div', { class: 'dm-stack' });
      let fieldsEl = null;

      function endpoint() { return endpoints.find((e) => e.id === state.endpointId) || endpoints[0]; }
      function visibleParams(ep) { return (ep.params || []).filter((p) => !p.hidden && !p.template); }
      function dependencyKey(p) { const dep = {}; for (const [k, tpl] of Object.entries((p.optionsFrom && p.optionsFrom.params) || {})) dep[k] = request.substitute(tpl, state.values, null); return JSON.stringify(dep); }

      async function loadOptions(p) {
        const key = dependencyKey(p);
        const cur = optionState.get(p.name);
        if (cur && cur.key === key && (cur.options || cur.loading)) return;
        optionState.set(p.name, { loading: true, options: null, error: '', key });
        renderFields();
        try {
          const options = await runner.optionsFor(connector, p, state.values);
          optionState.set(p.name, { loading: false, options, error: '', key });
        } catch (err) { optionState.set(p.name, { loading: false, options: [], error: (err && err.message) || String(err), key }); }
        renderFields();
      }

      function field(p) {
        const label = (p.label || p.name) + (p.required ? ' *' : '');
        const help = [p.help, p.example !== undefined ? `${t('api.example')}: ${Array.isArray(p.example) ? p.example.join(', ') : p.example}` : ''].filter(Boolean).join(' ');
        const onChange = () => { for (const q of visibleParams(endpoint())) if (q.optionsFrom && q.optionsFrom.params && Object.values(q.optionsFrom.params).some((tpl) => String(tpl).includes('{' + p.name + '}'))) { state.values[q.name] = undefined; loadOptions(q); } };
        if (p.optionsFrom) {
          const os = optionState.get(p.name);
          if (!os || os.key !== dependencyKey(p)) { loadOptions(p); }
          if (!os || os.loading) return h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: label }), h('p', { class: 'dm-help', text: t('api.options.loading') }));
          if (os.error) return h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: label }), h('p', { class: 'dm-error dm-small', text: t('api.options.failed', { message: os.error }) }));
          if (p.type === 'multi') return multiField(p, os.options, label);
          const sel = /** @type {any} */ (h('dm-select', { label, help }));
          sel.options = (p.required ? [] : [{ value: '', label: '–' }]).concat(os.options);
          sel.value = state.values[p.name] !== undefined ? String(state.values[p.name]) : (p.required && os.options[0] ? os.options[0].value : '');
          state.values[p.name] = sel.value;
          sel.addEventListener('change', () => { state.values[p.name] = sel.value; onChange(); });
          return sel;
        }
        if (p.type === 'enum' || (p.options && p.options.length && p.type !== 'multi')) {
          const opts = (p.options || (p.enum || []).map((v) => ({ value: v, label: String(v) }))).map((o) => ({ value: String(o.value), label: o.label || String(o.value) }));
          const sel = /** @type {any} */ (h('dm-select', { label, help }));
          sel.options = (p.required ? [] : [{ value: '', label: '–' }]).concat(opts);
          sel.value = state.values[p.name] !== undefined ? String(state.values[p.name]) : (p.default !== undefined ? String(p.default) : (p.required && opts[0] ? opts[0].value : ''));
          state.values[p.name] = sel.value;
          sel.addEventListener('change', () => { state.values[p.name] = sel.value; onChange(); });
          return sel;
        }
        if (p.type === 'multi' && p.options && p.options.length) return multiField(p, p.options.map((o) => ({ value: String(o.value), label: o.label || String(o.value) })), label);
        if (p.type === 'boolean') {
          const sw = /** @type {any} */ (h('dm-switch', { label }));
          sw.checked = state.values[p.name] !== undefined ? !!state.values[p.name] : !!p.default;
          state.values[p.name] = sw.checked;
          sw.addEventListener('change', () => { state.values[p.name] = sw.checked; onChange(); });
          return sw;
        }
        if (p.type === 'text' || p.type === 'querylines') {
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label, help: help || (p.type === 'querylines' ? t('api.querylines.help') : ''), mono: true }));
          ta.value = state.values[p.name] !== undefined ? state.values[p.name] : (p.default || '');
          ta.addEventListener('input', () => { state.values[p.name] = ta.value; });
          return ta;
        }
        const input = /** @type {any} */ (h('dm-input', { type: p.type === 'number' ? 'number' : (p.type === 'date' ? 'date' : 'text'), label, help, placeholder: p.example !== undefined && !Array.isArray(p.example) ? String(p.example) : '' }));
        input.value = state.values[p.name] !== undefined ? state.values[p.name] : (p.default !== undefined ? p.default : '');
        input.addEventListener('input', () => { state.values[p.name] = input.value; });
        input.addEventListener('change', onChange);
        return input;
      }

      function multiField(p, options, label) {
        const picker = /** @type {any} */ (h('dm-variable-picker'));
        picker.variables = [{ code: p.name, text: label, values: options.map((o) => ({ code: o.value, text: o.label })), elimination: !p.required, time: false, metric: false }];
        const current = state.values[p.name];
        if (Array.isArray(current) && current.length) picker.selection = { [p.name]: current.length === options.length ? { filter: 'all' } : { filter: 'item', values: current } };
        else if (!p.required) picker.selection = { [p.name]: { filter: 'none' } };
        const sync = () => { const sel = picker.selection[p.name]; state.values[p.name] = sel.filter === 'all' ? options.map((o) => o.value) : (sel.filter === 'item' ? sel.values : []); };
        sync();
        picker.addEventListener('dm-change', sync);
        return h('div', { class: 'dm-stack-sm' }, p.help ? h('p', { class: 'dm-help', text: p.help }) : null, picker);
      }

      function renderFields() {
        if (!fieldsEl) return;
        const ep = endpoint();
        replace(fieldsEl, visibleParams(ep).map(field));
      }

      function render() {
        const ep = endpoint();
        if (!ep) { replace(el, h('p', { class: 'dm-help', text: t('api.no.endpoints') })); return; }
        const epSelect = /** @type {any} */ (h('dm-select', { label: t('api.endpoint') }));
        epSelect.options = endpoints.map((e) => ({ value: e.id, label: e.name }));
        epSelect.value = ep.id;
        epSelect.addEventListener('change', () => { state.endpointId = epSelect.value; state.values = {}; optionState.clear(); render(); });
        fieldsEl = h('div', { class: 'dm-form-grid dm-api-fields' });
        renderFields();
        const maxPages = /** @type {any} */ (h('dm-input', { type: 'number', label: t('api.maxpages'), min: '1', inline: true, help: t('api.maxpages.help', { n: (ep.pagination && ep.pagination.maxPages) || 100 }) }));
        maxPages.value = state.maxPages;
        maxPages.addEventListener('input', () => { state.maxPages = maxPages.value; });
        const more = h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }), h('div', { class: 'dm-stack-sm' }, maxPages));
        replace(el,
          endpoints.length > 1 ? epSelect : h('h3', { text: ep.name }),
          ep.description ? h('p', { class: 'dm-help', text: ep.description }) : null,
          fieldsEl,
          ep.pagination && ep.pagination.type !== 'none' ? more : null,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('api.fetch'), icon: 'download', variant: 'primary', onClick: () => fetch(false) }),
            ep.pagination && ep.pagination.type !== 'none' ? basic.button({ label: t('api.preview'), icon: 'eye', onClick: () => fetch(true) }) : null));
      }

      function fetch(firstPageOnly) {
        const ep = endpoint();
        const values = Object.assign({}, state.values);
        api.runFetch({
          label: ep.name,
          run: async (progress, signal) => {
            const table = await runner.fetchTable(connector, ep, values, { signal, onProgress: progress, firstPageOnly, maxPages: Number(state.maxPages) > 0 ? Number(state.maxPages) : undefined });
            return { table, name: request.datasetName(connector, ep, table.values, `${connector.name}: ${ep.name}`), source: runner.describeSource(connector, ep, table.values, table), preview: firstPageOnly };
          },
        });
      }

      render();
      return { el, render, state };
    }
    return { create, formatNumber: i18n.formatNumber };
  });
})();
