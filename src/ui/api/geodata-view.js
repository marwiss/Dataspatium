// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for a geodata source (WFS, OGC API Features, ArcGIS REST) in Inhämta: the layers of the service as a
 * filterable list (read from the service when the source has none yet, and again on request), and for the chosen
 * layer the ordinary endpoint form with area (bbox), filter and column choices. Results are GeoJSON tables that
 * open as maps. A service with Lantmäteriet's NGP layers for detailed plans, and the NGP API itself, has the entry
 * *Detaljplaner (hela planer)* at the top of the list: a search for one plan, fetched whole (ui/api/whole-plans).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/geodata-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/api/endpoint-form', 'api/families/geodata', 'api/families/databases', 'data/plan-nordic', 'io/importers/detaljplan', 'api/ngp-plans', 'ui/api/whole-plans'], (base, basic, icons, endpointForm, geodata, databases, nordic, detaljplanImp, ngp, wholePlans) => {
    const { h, t, i18n, replace } = base;
    const MAX_LIST = 400;
    /** The list entry for whole detailed plans; never a layer's id. */
    const WHOLE = '__plans';

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
          state.planMsg = t('plan.saved.' + (parsed.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan'), { name: meta.name, n: i18n.formatNumber(meta.rowCount) });
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
      let listEl = null; let formEl = null; let countEl = null;
      /** The card for whole plans, made when the entry is first chosen. */
      let whole = null;
      const wholeView = () => whole || (whole = wholePlans.create(api));

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
        return h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'aria-current': state.selected === ep.id ? 'true' : null, onclick: () => { state.selected = state.selected === ep.id ? null : ep.id; renderList(); renderForm(); showForm(); } },
          icons.icon(kind === 'arcgis' ? 'layers' : 'map', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: ep.name }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      /** The layer list may fill the window (.dm-fill), so the chosen layer's form below it is scrolled into view. */
      function showForm() {
        if (state.selected && formEl && typeof formEl.scrollIntoView === 'function') formEl.scrollIntoView({ block: 'nearest' });
      }
      function renderList() {
        if (!listEl) return;
        const all = layers(); const shown = filtered();
        // The count says how many layers the filter leaves of all of them.
        if (countEl) replace(countEl, all.length ? h('dm-badge', { 'data-geo-count': String(shown.length), text: shown.length === all.length ? t('geodata.layers.count', { n: i18n.formatNumber(all.length) }) : t('geodata.layers.count.of', { shown: i18n.formatNumber(shown.length), n: i18n.formatNumber(all.length) }) }) : null);
        const nodes = [];
        // Whole detailed plans first, before the layers they are made of.
        if (ngp.kindOf(connector)) nodes.push(h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'data-plan-whole': ngp.kindOf(connector), 'aria-current': state.selected === WHOLE ? 'true' : null, onclick: () => { state.selected = state.selected === WHOLE ? null : WHOLE; renderList(); renderForm(); showForm(); } },
          icons.icon('layers', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: t('plan.whole.title') }), h('span', { class: 'dm-list-sub dm-truncate', text: t('plan.whole.sub') }))));
        if (state.loading) nodes.push(h('p', { class: 'dm-help' }, h('dm-progress', { indeterminate: true, label: state.loading })));
        else if (!all.length) nodes.push(h('p', { class: 'dm-help', text: state.error ? '' : t('geodata.layers.none') }));
        else if (!shown.length) nodes.push(h('p', { class: 'dm-help', text: t('geodata.layers.nomatch') }));
        nodes.push(h('div', { class: 'dm-list dm-fill dm-geo-layers' }, shown.slice(0, MAX_LIST).map(item)));
        if (shown.length > MAX_LIST) nodes.push(h('p', { class: 'dm-help dm-xs', text: t('geodata.layers.more', { n: i18n.formatNumber(shown.length - MAX_LIST) }) }));
        const g = generic();
        if (g) nodes.push(h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'aria-current': state.selected === g.id ? 'true' : null, onclick: () => { state.selected = state.selected === g.id ? null : g.id; renderList(); renderForm(); showForm(); } },
          icons.icon('braces', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: g.name }), h('span', { class: 'dm-list-sub dm-truncate', text: t('geodata.generic.hint') }))));
        replace(listEl, nodes);
      }
      function renderForm() {
        if (!formEl) return;
        if (state.selected === WHOLE && ngp.kindOf(connector)) { replace(formEl, wholeView().el); wholeView().render(); return; }
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
        listEl = h('div', { class: 'dm-stack-sm' });
        formEl = h('div');
        countEl = h('span');
        replace(el,
          planCard(),
          h('div', { class: 'dm-row-wrap dm-geo-head' },
            filter,
            countEl,
            basic.button({ label: t('geodata.refresh'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', title: t('geodata.refresh.hint'), loading: !!state.loading, onClick: discover })),
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null,
          listEl,
          formEl);
        renderList();
        renderForm();
      }
      /** Presets ship without layers: the first visit reads them from the service. */
      function start() { render(); if (!layers().length && !state.refreshed && !state.error) discover(); }
      function destroy() { if (whole) whole.destroy(); }
      return { el, start, state, discover, fetchPlan, whole: wholeView, destroy };
    }
    return { create };
  });
})();
