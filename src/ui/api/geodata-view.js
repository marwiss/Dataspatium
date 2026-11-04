// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for a geodata source (WFS, OGC API Features, ArcGIS REST) in Inhämta: the layers of the service as a
 * filterable list (read from the service when the source has none yet, and again on request), and for the chosen
 * layer the ordinary endpoint form with area (bbox), filter and column choices. Results are GeoJSON tables that
 * open as maps.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/geodata-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/api/endpoint-form', 'api/families/geodata', 'api/families/databases', 'data/plan-nordic', 'io/importers/detaljplan'], (base, basic, icons, endpointForm, geodata, databases, nordic, detaljplanImp) => {
    const { h, t, i18n, replace } = base;
    const MAX_LIST = 400;

    /** @param {{connector: any, runFetch: Function, log?: Function, onDataset?: Function}} api */
    function create(api) {
      const { connector } = api;
      const state = { filter: '', selected: null, loading: '', error: '', refreshed: false, fetching: false, planMsg: '', planErr: false, planId: '' };
      /** The plan-fetch kind this source offers (Plandata.dk, Skipulagsstofnun), or ''. */
      const planKind = () => (connector.family && nordic.FETCH_KINDS.includes(connector.family.plans) ? connector.family.plans : '');

      /** Fetch one whole plan (all its layers) by its number and keep it as a plan dataset. */
      async function fetchPlan(id) {
        const kind = planKind();
        if (!kind || !id || state.fetching) return;
        state.fetching = true; state.planMsg = ''; state.planErr = false; state.planId = id; render();
        try {
          const parsed = await nordic.fetchPlan(kind, connector.baseUrl, id, (url) => databases.getJson(connector, url));
          const meta = await detaljplanImp.importParsed(parsed, parsed.plan.namn || parsed.plan.beteckning || id, { kind: 'api', connector: connector.id, connectorName: connector.name, planId: id, fetchedAt: new Date().toISOString() });
          state.planMsg = t('plan.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) });
          if (api.log) api.log(state.planMsg, 'ok');
          if (api.onDataset) api.onDataset(meta);
        } catch (err) {
          state.planMsg = (err && err.message) || String(err); state.planErr = true;
          if (api.log) api.log(`${connector.name}: ${state.planMsg}`, 'error');
        }
        state.fetching = false; render();
      }
      function planCard() {
        const kind = planKind();
        if (!kind) return null;
        const input = /** @type {any} */ (h('dm-input', { label: t('plan.fetch.id.' + kind), placeholder: t('plan.fetch.placeholder.' + kind), inline: true }));
        input.value = state.planId;
        input.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') fetchPlan(input.value.trim()); });
        return h('div', { class: 'dm-card dm-stack-sm dm-geo-plan' },
          h('strong', { text: t('plan.fetch.title') }),
          h('p', { class: 'dm-help dm-small', text: t('plan.fetch.hint.' + kind) }),
          h('div', { class: 'dm-row-wrap' }, input, basic.button({ label: t('plan.fetch'), icon: 'layers', variant: 'primary', loading: state.fetching, title: t('plan.fetch.button.hint'), onClick: () => fetchPlan(input.value.trim()) })),
          state.planMsg ? h('p', { class: state.planErr ? 'dm-error dm-small' : 'dm-success', text: state.planMsg }) : null);
      }
      const el = h('div', { class: 'dm-stack' });
      let listEl = null; let formEl = null;

      const layers = () => geodata.layerEndpoints(connector);
      const generic = () => geodata.genericEndpoint(connector);
      function filtered() {
        const q = state.filter.trim().toLowerCase();
        const all = layers();
        return q ? all.filter((e) => `${e.name} ${e.description || ''} ${e.id}`.toLowerCase().includes(q)) : all;
      }
      function selectedEndpoint() {
        return (connector.endpoints || []).find((e) => e.id === state.selected) || null;
      }

      /** Read the layer list from the service (GetCapabilities, /collections or the service directory). */
      async function discover() {
        if (state.loading) return;
        state.loading = t('geodata.loading'); state.error = ''; render();
        try {
          const res = await geodata.refresh(connector);
          state.refreshed = true;
          const msg = t('geodata.refreshed', { name: connector.name, n: res.entities.length });
          if (api.log) api.log(msg, 'ok');
        } catch (err) {
          state.error = t('geodata.err.discover', { message: (err && err.message) || String(err) });
          if (api.log) api.log(`${connector.name}: ${state.error}`, 'error');
        }
        state.loading = ''; state.selected = null; render();
      }

      function item(ep) {
        const kind = connector.family && connector.family.kind;
        const sub = ep.description || (kind === 'ogcapi' ? t('geodata.kind.collection') : t('geodata.kind.layer'));
        return h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'aria-current': state.selected === ep.id ? 'true' : null, onclick: () => { state.selected = state.selected === ep.id ? null : ep.id; renderList(); renderForm(); } },
          icons.icon(kind === 'arcgis' ? 'layers' : 'map', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: ep.name }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      function renderList() {
        if (!listEl) return;
        const all = layers(); const shown = filtered();
        const nodes = [];
        if (state.loading) nodes.push(h('p', { class: 'dm-help' }, h('dm-progress', { indeterminate: true, label: state.loading })));
        else if (!all.length) nodes.push(h('p', { class: 'dm-help', text: state.error ? '' : t('geodata.layers.none') }));
        else if (!shown.length) nodes.push(h('p', { class: 'dm-help', text: t('geodata.layers.nomatch') }));
        nodes.push(h('div', { class: 'dm-list dm-geo-layers' }, shown.slice(0, MAX_LIST).map(item)));
        if (shown.length > MAX_LIST) nodes.push(h('p', { class: 'dm-help dm-xs', text: t('geodata.layers.more', { n: i18n.formatNumber(shown.length - MAX_LIST) }) }));
        const g = generic();
        if (g) nodes.push(h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'aria-current': state.selected === g.id ? 'true' : null, onclick: () => { state.selected = state.selected === g.id ? null : g.id; renderList(); renderForm(); } },
          icons.icon('braces', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: g.name }), h('span', { class: 'dm-list-sub dm-truncate', text: t('geodata.generic.hint') }))));
        replace(listEl, nodes);
      }
      function renderForm() {
        if (!formEl) return;
        const ep = selectedEndpoint();
        if (!ep) { replace(formEl, h('p', { class: 'dm-help', text: layers().length ? t('geodata.pick') : '' })); return; }
        // The form for one endpoint: the connector with only this layer, so that the form shows its name, not a list.
        const form = endpointForm.create({ connector: Object.assign({}, connector, { endpoints: [ep] }), runFetch: api.runFetch });
        replace(formEl, h('div', { class: 'dm-card dm-stack dm-geo-form' }, form.el, h('p', { class: 'dm-help dm-xs', text: t('geodata.result.hint') })));
      }
      function render() {
        const filter = /** @type {any} */ (h('dm-input', { label: t('geodata.filter'), placeholder: t('geodata.filter.placeholder'), inline: true }));
        filter.value = state.filter;
        filter.addEventListener('input', () => { state.filter = filter.value; renderList(); });
        const n = layers().length;
        listEl = h('div', { class: 'dm-stack-sm' });
        formEl = h('div');
        replace(el,
          planCard(),
          h('div', { class: 'dm-row-wrap dm-geo-head' },
            filter,
            n ? h('dm-badge', { text: t('geodata.layers.count', { n: i18n.formatNumber(n) }) }) : null,
            basic.button({ label: t('geodata.refresh'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', title: t('geodata.refresh.hint'), loading: !!state.loading, onClick: discover })),
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null,
          listEl,
          formEl);
        renderList();
        renderForm();
      }
      /** Presets ship without layers: the first visit reads them from the service. */
      function start() { render(); if (!layers().length && !state.refreshed && !state.error) discover(); }
      return { el, start, state, discover, fetchPlan };
    }
    return { create };
  });
})();
