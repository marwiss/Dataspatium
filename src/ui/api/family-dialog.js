// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * "Lägg till databaskälla" and "Lägg till geodatakälla" in Inhämta: pick a family (api/families/databases or
 * api/families/geodata), enter its address and key, and get a connector with one endpoint per discovered table or
 * layer plus a generic one. The geodata dialog also lists the ready-made open geodata services (presets/geodata/
 * services.json, all verified to allow requests from the browser): a preset opens, any other is added with one click.
 * The CORS requirement and the documentation link of the family are shown; keys stay in the session (api/secrets).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/family-dialog', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'api/families/databases', 'api/families/geodata', 'api/connectors'], (base, basic, overlays, icons, families, geodata, connectors) => {
    const { h, t, i18n, replace } = base;
    const SERVICES_ASSET = 'presets/geodata/services.json';
    /** Both groups of families share the dialog: databases (tables) and geodata services (layers with geometry). */
    const ALL = () => families.FAMILIES.concat(geodata.FAMILIES);
    const byId = (id) => families.byId(id) || geodata.byId(id);
    const createFor = (id, values) => (geodata.byId(id) ? geodata.createConnector(id, values) : families.createConnector(id, values));
    /** @type {Promise<any[]>|null} */ let servicesLoading = null;
    let servicesOverride = null;
    /** The ready-made geodata services (tests may replace the list with setServices). */
    function services() {
      if (servicesOverride) return Promise.resolve(servicesOverride);
      if (!servicesLoading) servicesLoading = D.assets.loadText(SERVICES_ASSET).then((text) => JSON.parse(text).services || []).catch((err) => { servicesLoading = null; D.log('geodata', 'services list unavailable', err); return []; });
      return servicesLoading;
    }
    function setServices(list) { servicesOverride = Array.isArray(list) ? list : null; }
    const aboutOf = (svc) => { const a = svc.about || {}; return a[i18n.language()] || a.sv || ''; };

    /**
     * @param {any} ctx the mode context (shell for the log)
     * @param {{family?: string, values?: Record<string, string>, group?: 'databases'|'geodata'}} [options]
     * @returns {Promise<any|null>} the saved connector, or null when cancelled
     */
    function open(ctx, options = {}) {
      const group = options.group || (geodata.byId(options.family || '') ? 'geodata' : 'databases');
      const list = () => (group === 'geodata' ? geodata.FAMILIES : families.FAMILIES);
      const state = { family: options.family || list()[0].id, values: Object.assign({}, options.values || {}), busy: false, error: '', filter: '', services: null, adding: '' };
      const body = h('div', { class: 'dm-stack' });
      let finish = null;

      function render() {
        const fam = byId(state.family) || list()[0];
        const sel = /** @type {any} */ (h('dm-select', { label: t('families.family') }));
        sel.options = list().map((f) => ({ value: f.id, label: f.name }));
        sel.value = fam.id;
        sel.addEventListener('change', () => { state.family = sel.value; state.values = {}; state.error = ''; render(); });
        const fieldEl = (f) => {
          if (f.type === 'select') {
            const choice = /** @type {any} */ (h('dm-select', { label: t('families.field.' + f.name), 'data-family-field': f.name }));
            choice.options = f.options.map((o) => ({ value: o.value, label: o.labelKey ? t(o.labelKey) : o.label }));
            choice.value = state.values[f.name] || f.options[0].value;
            choice.addEventListener('change', () => { state.values[f.name] = choice.value; });
            return choice;
          }
          const inp = /** @type {any} */ (h('dm-input', { label: t('families.field.' + f.name), type: f.type === 'secret' ? 'password' : 'text', placeholder: f.placeholder || '' }));
          inp.value = state.values[f.name] || '';
          inp.addEventListener('input', () => { state.values[f.name] = inp.value; });
          inp.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') create(); });
          return inp;
        };
        const fields = fam.fields.filter((f) => !f.advanced).map(fieldEl);
        const advanced = fam.fields.filter((f) => f.advanced).map(fieldEl);
        replace(body,
          group === 'geodata' ? readyServices() : null,
          group === 'geodata' ? h('h3', { class: 'dm-small', text: t('geodata.own.title') }) : null,
          sel,
          h('p', { class: 'dm-help', text: t('families.' + fam.id + '.desc') }),
          h('div', { class: 'dm-form-grid' }, fields),
          advanced.length ? h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }), h('div', { class: 'dm-form-grid' }, advanced)) : null,
          h('p', { class: 'dm-help' }, h('strong', { text: t('families.cors.title') + ' ' }), t('families.' + fam.id + '.cors'), fam.docs ? [' ', h('a', { href: fam.docs, target: '_blank', rel: 'noopener', text: t('families.docs') })] : null),
          h('p', { class: 'dm-help', text: t('families.secrets.hint') }),
          state.error ? h('p', { class: 'dm-error', text: state.error }) : null,
          h('div', { class: 'dm-row' }, basic.button({ label: t('families.add'), icon: 'plus', variant: 'primary', loading: state.busy, onClick: create })));
      }
      /** The list of verified open geodata services: presets open, the others are added with one click. */
      function readyServices() {
        const box = h('div', { class: 'dm-stack-sm dm-geodata-ready' });
        const filter = /** @type {any} */ (h('dm-input', { label: t('geodata.ready.filter'), placeholder: t('geodata.ready.filter.placeholder'), inline: true }));
        filter.value = state.filter;
        filter.addEventListener('input', () => { state.filter = filter.value; renderList(); });
        const listEl = h('div', { class: 'dm-list dm-geodata-ready-list' });
        const renderList = () => {
          const all = state.services || [];
          const q = state.filter.trim().toLowerCase();
          const shown = q ? all.filter((s) => `${s.name} ${s.publisher} ${aboutOf(s)} ${t('country.' + s.country)} ${s.kind}`.toLowerCase().includes(q)) : all;
          replace(listEl, shown.length ? shown.map(serviceItem) : h('p', { class: 'dm-help dm-small', text: state.services ? t('geodata.ready.none') : t('common.loading') }));
        };
        replace(box, h('h3', { class: 'dm-small', text: t('geodata.ready.title') }), h('p', { class: 'dm-help dm-xs', text: t('geodata.ready.hint') }), filter, listEl);
        if (!state.services) services().then((svcs) => { state.services = svcs; renderList(); });
        else renderList();
        return box;
      }
      function serviceItem(svc) {
        const busy = state.adding === svc.id;
        const sub = [t('country.' + svc.country), svc.publisher, t('geodata.badge.' + svc.kind) || svc.kind, svc.key ? t('api.level2') : null].filter(Boolean).join(' · ');
        return h('div', { class: 'dm-list-item dm-list-item-static dm-geodata-ready-item' },
          icons.icon(svc.kind === 'geoportal' ? 'search' : svc.kind === 'arcgis' ? 'layers' : 'map', 16),
          h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: svc.name }), h('span', { class: 'dm-list-sub dm-truncate', text: sub }), aboutOf(svc) ? h('span', { class: 'dm-list-sub', text: aboutOf(svc) }) : null),
          basic.button({ label: t(svc.preset ? 'geodata.ready.open' : 'geodata.ready.add'), icon: svc.preset ? 'arrow-right' : 'plus', size: 'sm', variant: svc.preset ? 'ghost' : 'default', loading: busy, title: svc.url, onClick: () => useService(svc) }));
      }
      /** A preset opens as it is; another service becomes a connector of its family with the address filled in. */
      async function useService(svc) {
        if (state.busy || state.adding) return;
        if (svc.preset) {
          const existing = await connectors.get(svc.preset);
          if (existing) { if (finish) finish(existing); return; }
        }
        if (!geodata.byId(svc.kind)) { state.error = t('geodata.ready.unsupported'); render(); return; }
        state.adding = svc.id; state.error = ''; render();
        try {
          const res = await createFor(svc.kind, { baseUrl: svc.url, name: svc.name });
          announce(res);
          if (finish) finish(res.connector);
        } catch (err) { state.adding = ''; state.error = (err && err.message) || String(err); render(); }
      }
      function announce(res) {
        const msg = res.entities.length ? t('families.created', { name: res.connector.name, n: res.entities.length }) : t('families.created.plain', { name: res.connector.name });
        if (ctx && ctx.shell) ctx.shell.log(msg, 'ok');
        overlays.toast.show(msg, { kind: 'ok' });
        if (res.discoveryError) {
          // Families that discover something other than tables say so in their own words.
          const key = `families.${res.connector.family && res.connector.family.type}.discover.failed`;
          const warn = t(D.require('ui/i18n').has(key) ? key : 'families.discover.failed', { message: res.discoveryError });
          if (ctx && ctx.shell) ctx.shell.log(warn, 'warn');
          overlays.toast.show(warn, { kind: 'warn', timeout: 10000 });
        }
      }
      async function create() {
        if (state.busy) return;
        state.busy = true; state.error = ''; render();
        try {
          // An OpenCDE server that allows it registers the app itself, so no administrator has to hand out a client id.
          if (state.family === 'opencde' && !String(state.values.clientId || '').trim()) {
            const opencde = D.require('api/families/opencde');
            const redirect = opencde.redirectUri();
            if (!redirect) throw new Error(t('families.err.register.file'));
            const reg = await opencde.register(state.values.baseUrl, { redirectUri: redirect, bcfVersion: state.values.bcfVersion });
            state.values = Object.assign({}, state.values, { clientId: reg.clientId, clientSecret: reg.clientSecret || '' });
          }
          const res = await createFor(state.family, state.values);
          announce(res);
          if (finish) finish(res.connector);
        } catch (err) { state.busy = false; state.error = (err && err.message) || String(err); render(); }
      }
      render();
      return overlays.dialog.open({ title: t(group === 'geodata' ? 'geodata.add.title' : 'families.title'), help: group === 'geodata' ? 'kallor#öppna-geodata' : 'kallor', size: 'lg', body: (done) => { finish = done; return body; }, actions: [{ label: t('common.cancel'), value: null }] })
        .then((result) => (result && typeof result === 'object' ? result : null));
    }
    return { open, ALL, byId, services, setServices, SERVICES_ASSET };
  });
})();
