// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for Socialstyrelsen's statistics database: subject, then variables with values in the
 * shared variable picker, then fetch (paged results joined with value texts).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/sos-view', ['ui/base', 'ui/basic', 'ui/api/variable-picker', 'api/families/socialstyrelsen'], (base, basic, _picker, sos) => {
    const { h, t, i18n, replace } = base;

    /** @param {{connector: any, runFetch: Function}} api */
    function create(api) {
      const { connector } = api;
      const state = { subjects: [], subject: '', variables: null, loading: '', error: '' };
      const el = h('div', { class: 'dm-stack' });
      let picker = null;

      async function loadSubjects() {
        state.loading = t('common.loading'); render();
        try { state.subjects = await sos.subjects(connector); } catch (err) { state.error = (err && err.message) || String(err); }
        state.loading = ''; render();
      }
      async function loadVariables() {
        state.variables = null; state.error = ''; state.loading = t('common.loading'); render();
        try {
          state.variables = await sos.variables(connector, state.subject, { onProgress: (p) => { state.loading = t('api.sos.loading', { loaded: p.loaded, total: p.total }); renderStatus(); } });
        } catch (err) { state.error = (err && err.message) || String(err); }
        state.loading = ''; render();
      }
      let statusEl = null;
      function renderStatus() { if (statusEl) statusEl.textContent = state.loading; }

      function render() {
        const sel = /** @type {any} */ (h('dm-select', { label: t('api.sos.subject') }));
        sel.options = [{ value: '', label: '–' }].concat(state.subjects.map((s) => ({ value: s.id, label: s.text })));
        sel.value = state.subject;
        sel.addEventListener('change', () => { state.subject = sel.value; if (state.subject) loadVariables(); else { state.variables = null; render(); } });
        statusEl = h('p', { class: 'dm-help', text: state.loading });
        const nodes = [h('div', { class: 'dm-form-grid' }, sel), statusEl];
        if (state.variables) {
          picker = /** @type {any} */ (h('dm-variable-picker'));
          picker.variables = state.variables;
          const subjectText = (state.subjects.find((s) => s.id === state.subject) || {}).text || state.subject;
          nodes.push(h('p', { class: 'dm-help', text: t('api.sos.help') }), picker,
            h('div', { class: 'dm-row' }, basic.button({ label: t('api.fetch'), icon: 'download', variant: 'primary', onClick: () => {
              const vars = state.variables; const selection = picker.selection; const subject = state.subject;
              api.runFetch({
                label: subjectText,
                run: async (progress, signal) => {
                  const result = await sos.fetchData(connector, subject, vars, selection, { signal, onProgress: progress });
                  return { table: result, name: `${connector.publisher ? 'Socialstyrelsen' : connector.name}: ${subjectText}`, source: sos.describeSource(connector, subject, subjectText, vars, selection, result) };
                },
              });
            } })));
        }
        if (state.error) nodes.push(h('p', { class: 'dm-error dm-small', text: state.error }));
        replace(el, nodes);
      }
      function start() { loadSubjects(); }
      return { el, start, state, formatNumber: i18n.formatNumber };
    }
    return { create };
  });
})();
