// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * "Lägg till databaskälla" in Inhämta: pick a database family (api/families/databases), enter its address and
 * key, and get a connector with one endpoint per discovered table plus a generic one. The CORS requirement and
 * the documentation link of the family are shown; keys stay in the session (api/secrets).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/family-dialog', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/databases', 'api/families/geodata'], (base, basic, overlays, families, geodata) => {
    const { h, t, replace } = base;
    /** Both groups of families share the dialog: databases (tables) and geodata services (layers with geometry). */
    const ALL = () => families.FAMILIES.concat(geodata.FAMILIES);
    const byId = (id) => families.byId(id) || geodata.byId(id);
    const createFor = (id, values) => (geodata.byId(id) ? geodata.createConnector(id, values) : families.createConnector(id, values));

    /**
     * @param {any} ctx the mode context (shell for the log)
     * @param {{family?: string, values?: Record<string, string>, group?: 'databases'|'geodata'}} [options]
     * @returns {Promise<any|null>} the saved connector, or null when cancelled
     */
    function open(ctx, options = {}) {
      const group = options.group || (geodata.byId(options.family || '') ? 'geodata' : 'databases');
      const list = () => (group === 'geodata' ? geodata.FAMILIES : families.FAMILIES);
      const state = { family: options.family || list()[0].id, values: Object.assign({}, options.values || {}), busy: false, error: '' };
      const body = h('div', { class: 'dm-stack' });
      let finish = null;

      function render() {
        const fam = byId(state.family) || list()[0];
        const sel = /** @type {any} */ (h('dm-select', { label: t('families.family') }));
        sel.options = list().map((f) => ({ value: f.id, label: f.name }));
        sel.value = fam.id;
        sel.addEventListener('change', () => { state.family = sel.value; state.values = {}; state.error = ''; render(); });
        const fields = fam.fields.map((f) => {
          const inp = /** @type {any} */ (h('dm-input', { label: t('families.field.' + f.name), type: f.type === 'secret' ? 'password' : 'text', placeholder: f.placeholder || '' }));
          inp.value = state.values[f.name] || '';
          inp.addEventListener('input', () => { state.values[f.name] = inp.value; });
          inp.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') create(); });
          return inp;
        });
        replace(body,
          sel,
          h('p', { class: 'dm-help', text: t('families.' + fam.id + '.desc') }),
          h('div', { class: 'dm-form-grid' }, fields),
          h('p', { class: 'dm-help' }, h('strong', { text: t('families.cors.title') + ' ' }), t('families.' + fam.id + '.cors'), fam.docs ? [' ', h('a', { href: fam.docs, target: '_blank', rel: 'noopener', text: t('families.docs') })] : null),
          h('p', { class: 'dm-help', text: t('families.secrets.hint') }),
          state.error ? h('p', { class: 'dm-error', text: state.error }) : null,
          h('div', { class: 'dm-row' }, basic.button({ label: t('families.add'), icon: 'plus', variant: 'primary', loading: state.busy, onClick: create })));
      }
      async function create() {
        if (state.busy) return;
        state.busy = true; state.error = ''; render();
        try {
          const res = await createFor(state.family, state.values);
          const msg = t('families.created', { name: res.connector.name, n: res.entities.length });
          if (ctx && ctx.shell) ctx.shell.log(msg, 'ok');
          overlays.toast.show(msg, { kind: 'ok' });
          if (res.discoveryError) {
            const warn = t('families.discover.failed', { message: res.discoveryError });
            if (ctx && ctx.shell) ctx.shell.log(warn, 'warn');
            overlays.toast.show(warn, { kind: 'warn', timeout: 10000 });
          }
          if (finish) finish(res.connector);
        } catch (err) { state.busy = false; state.error = (err && err.message) || String(err); render(); }
      }
      render();
      return overlays.dialog.open({ title: t(group === 'geodata' ? 'geodata.add.title' : 'families.title'), help: group === 'geodata' ? 'kallor#oppna-geodata' : 'kallor', size: 'lg', body: (done) => { finish = done; return body; }, actions: [{ label: t('common.cancel'), value: null }] })
        .then((result) => (result && typeof result === 'object' ? result : null));
    }
    return { open, ALL, byId };
  });
})();
