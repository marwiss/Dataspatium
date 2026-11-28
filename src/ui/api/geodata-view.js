// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for a geodata source (WFS, OGC API Features, ArcGIS REST) in Inhämta (F137 c). The work area holds, from the top: a
 * mode switch *Lager* / *Hela detaljplaner* (only when the source offers whole plans: a WFS with Lantmäteriet's NGP layers, or the
 * NGP API), one search box that searches in the chosen mode as the person types, *Valfritt lager* (Lager), and the list of layers
 * or plans, which takes the rest of the height and is the only part that scrolls. The chosen layer's form (area, filter,
 * columns, Hämta), or the chosen plan's card (ui/api/whole-plans), is in the inspector above the facts about the service, and the
 * inspector opens as a sheet on narrow windows when something is chosen. The answer of a fetch (ui/api/api-view: the map, the
 * table and saving) takes the list's place, with *Alla lager* to go back; the form stays, so it can be changed and fetched again.
 * The layers are read from the service when the source has none yet, and again on request.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/geodata-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/api/endpoint-form', 'api/families/geodata', 'api/families/databases', 'data/plan-nordic', 'io/importers/detaljplan', 'api/ngp-plans', 'ui/api/whole-plans'], (base, basic, icons, endpointForm, geodata, databases, nordic, detaljplanImp, ngp, wholePlans) => {
    const { h, t, i18n, replace } = base;
    const MAX_LIST = 400;

    /** @param {{connector: any, runFetch: Function, ctx?: any, log?: Function, onDataset?: Function, output?: {progress: HTMLElement, result: HTMLElement}}} api */
    function create(api) {
      const { connector } = api;
      // mode: 'layers' or 'plans'; showing: 'list', or 'result' once a layer has been fetched.
      const state = { mode: 'layers', showing: 'list', filter: '', selected: null, loading: '', error: '', refreshed: false, fetching: false, planMsg: '', planErr: false, planId: '' };
      /** The plan-fetch kind this source offers (Plandata.dk, Skipulagsstofnun), or ''. */
      const planKind = () => (connector.family && nordic.FETCH_KINDS.includes(connector.family.plans) ? connector.family.plans : '');
      /** Whether the source offers whole detailed plans (known once its layers are read). */
      const hasPlans = () => !!ngp.kindOf(connector);

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

      /** The work area's part, and the inspector's (api-view renderRight places it above the facts about the service). */
      const el = h('div', { class: 'dm-geo-view dm-fill-column' });
      const inspectEl = h('div', { class: 'dm-stack dm-geo-inspect' });
      let searchEl = null; let countEl = null;
      const listEl = basic.listKeys(h('div', { class: 'dm-list dm-geo-list dm-geo-layers dm-fill-rest' }), () => focusSearch());
      /** The chosen layer's form, kept while it stays chosen (its values survive a change of mode). */
      let form = null;
      /** Whole plans, made when the mode is first chosen. */
      let whole = null;
      function wholeView() {
        if (!whole) {
          whole = wholePlans.create(api, { onChoose: () => { renderInspector(); reveal(); } });
          basic.listKeys(whole.listEl, () => focusSearch());
        }
        return whole;
      }
      const focusSearch = () => { if (searchEl) searchEl.focus(); };
      /** The inspector is where the chosen item is: shown when it is hidden (a sheet on narrow windows). */
      function reveal() { const shell = api.ctx && api.ctx.shell; if (shell && typeof shell.showInspector === 'function') shell.showInspector(); }

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
        state.loading = ''; state.selected = null; form = null; render();
      }

      /** A layer chosen: its form in the inspector; the list keeps its focus. @param {string} id */
      function chooseLayer(id) {
        state.selected = id;
        for (const b of el.querySelectorAll('[data-geo-layer]')) { if (b.getAttribute('data-geo-layer') === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
        renderInspector();
        reveal();
      }
      function item(ep, icon, sub) {
        return h('button', { type: 'button', class: 'dm-list-item dm-geo-layer', 'data-geo-layer': ep.id, 'aria-current': state.selected === ep.id ? 'true' : null, onclick: () => chooseLayer(ep.id) },
          icons.icon(icon, 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: ep.name }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      function layerItem(ep) {
        const kind = connector.family && connector.family.kind;
        return item(ep, kind === 'arcgis' ? 'layers' : 'map', ep.description || (kind === 'ogcapi' ? t('geodata.kind.collection') : t('geodata.kind.layer')));
      }
      function renderList() {
        const all = layers(); const shown = filtered();
        // The count says how many layers the filter leaves of all of them.
        if (countEl) replace(countEl, all.length ? h('dm-badge', { 'data-geo-count': String(shown.length), text: shown.length === all.length ? t('geodata.layers.count', { n: i18n.formatNumber(all.length) }) : t('geodata.layers.count.of', { shown: i18n.formatNumber(shown.length), n: i18n.formatNumber(all.length) }) }) : null);
        const nodes = [];
        if (state.loading) nodes.push(h('p', { class: 'dm-help dm-geo-empty' }, h('dm-progress', { indeterminate: true, label: state.loading })));
        else if (!all.length) nodes.push(state.error ? null : h('p', { class: 'dm-help dm-geo-empty', text: t('geodata.layers.none') }));
        else if (!shown.length) nodes.push(h('p', { class: 'dm-help dm-geo-empty', text: t('geodata.layers.nomatch') }));
        nodes.push(shown.slice(0, MAX_LIST).map(layerItem));
        if (shown.length > MAX_LIST) nodes.push(h('p', { class: 'dm-help dm-xs dm-geo-empty', text: t('geodata.layers.more', { n: i18n.formatNumber(shown.length - MAX_LIST) }) }));
        replace(listEl, nodes);
      }
      /** The search box: it filters the layers, or searches the plans after a pause; Escape empties it, Down goes to the list. */
      function searchBox(plans) {
        const w = plans ? wholeView() : null;
        const input = /** @type {any} */ (h('dm-input', { type: 'search', label: plans ? t('plan.whole.search') : t('geodata.filter'), placeholder: plans ? t('plan.whole.search.placeholder') : t('geodata.filter.placeholder'), inline: true, 'data-geo-search': plans ? 'plans' : 'layers' }));
        input.value = w ? w.state.query : state.filter;
        const changed = () => { if (w) w.schedule(input.value); else { state.filter = input.value; renderList(); } };
        input.addEventListener('input', changed);
        input.addEventListener('keydown', (e) => {
          const k = /** @type {KeyboardEvent} */ (e).key;
          if (k === 'Enter' && w) { e.preventDefault(); w.state.query = input.value; w.search(); }
          else if (k === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; changed(); }
          else if (k === 'ArrowDown') {
            const first = /** @type {HTMLElement|null} */ ((w ? w.listEl : listEl).querySelector('.dm-list-item:not([disabled])'));
            if (first) { e.preventDefault(); first.focus(); }
          }
        });
        return input;
      }
      function modeTabs() {
        const tabs = /** @type {any} */ (h('dm-tabs', { class: 'dm-geo-modes', 'data-geo-modes': '' }));
        tabs.tabs = [{ id: 'layers', label: t('geodata.mode.layers'), icon: 'map', hint: t('geodata.mode.layers.hint') }, { id: 'plans', label: t('plan.whole.title'), icon: 'layers', hint: t('plan.whole.sub') }];
        tabs.active = state.mode;
        tabs.addEventListener('dm-change', (e) => { state.mode = /** @type {any} */ (e).detail.id === 'plans' ? 'plans' : 'layers'; render(); });
        return tabs;
      }
      /** The list view: the mode switch, the search box, Valfritt lager and the list. */
      function renderBrowse() {
        const plans = state.mode === 'plans';
        const w = plans ? wholeView() : null;
        const g = plans ? null : generic();
        searchEl = searchBox(plans);
        countEl = plans ? null : h('span');
        replace(el,
          planCard(),
          hasPlans() ? modeTabs() : null,
          h('div', { class: 'dm-row-wrap dm-geo-head' }, w ? w.townSelect() : null, searchEl, countEl,
            plans ? null : basic.button({ label: t('geodata.refresh'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', title: t('geodata.refresh.hint'), loading: !!state.loading, onClick: discover })),
          !plans && state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null,
          // Valfritt lager stands above the list, so that it is never scrolled away.
          g ? h('div', { class: 'dm-list dm-geo-generic' }, item(g, 'braces', t('geodata.generic.hint'))) : null,
          w ? w.statusEl : null,
          w ? w.listEl : listEl);
        if (w) w.renderList(); else renderList();
      }
      /** The answer of a fetch in the list's place (api-view's progress and result), with the way back to the list. */
      function renderResult() {
        replace(el,
          h('div', { class: 'dm-row' }, basic.button({ label: t('geodata.back'), icon: 'chevron-left', size: 'sm', variant: 'ghost', title: t('geodata.back.hint'), 'data-geo-back': '', onClick: back })),
          h('div', { class: 'dm-stack dm-fill-rest dm-geo-result' }, api.output.progress, api.output.result));
      }
      /** Back to the list: the focus on the chosen layer, which brings it into view (the list is drawn anew at its top). */
      function back() {
        state.showing = 'list'; render();
        const chosen = /** @type {HTMLElement|null} */ (el.querySelector('[data-geo-layer][aria-current="true"]'));
        if (chosen) chosen.focus(); else focusSearch();
      }
      /** A layer's fetch from its form: the answer is shown in the work area, and a sheet over it closes. @param {any} job */
      function runFetch(job) {
        if (api.output) { state.showing = 'result'; render(); }
        const shell = api.ctx && api.ctx.shell;
        if (shell && typeof shell.closeSheets === 'function') shell.closeSheets();
        return api.runFetch(job);
      }
      /** The inspector's part shows `node`; one already in place stays, with its focus. @param {Node} node */
      function showInInspector(node) { if (inspectEl.childNodes.length !== 1 || inspectEl.firstChild !== node) replace(inspectEl, node); }
      function renderInspector() {
        if (state.mode === 'plans' && hasPlans()) { const w = wholeView(); showInInspector(w.cardEl); return; }
        const ep = selectedEndpoint();
        if (!ep) { form = null; replace(inspectEl, h('p', { class: 'dm-help', 'data-geo-pick': '', text: t('geodata.pick') })); return; }
        if (!form || form.id !== ep.id) {
          // The form for one endpoint: the connector with only this layer, so that the form shows its name, not a list.
          const f = endpointForm.create({ connector: Object.assign({}, connector, { endpoints: [ep] }), runFetch });
          form = { id: ep.id, el: h('div', { class: 'dm-stack dm-geo-form', 'data-geo-form': ep.id }, f.el, h('p', { class: 'dm-help dm-xs', text: t('geodata.result.hint') })) };
        }
        showInInspector(form.el);
      }
      function render() {
        if (state.mode === 'plans' && !hasPlans()) state.mode = 'layers';
        if (state.showing === 'result' && api.output) renderResult(); else renderBrowse();
        renderInspector();
      }
      /** The inspector's part (api-view renderRight): the same element each time, so a form keeps its values and its focus. */
      function inspector() { return inspectEl; }
      /** Presets ship without layers: the first visit reads them from the service. */
      function start() { render(); if (!layers().length && !state.refreshed && !state.error) discover(); }
      function destroy() { if (whole) whole.destroy(); }
      return { el, start, state, discover, fetchPlan, whole: wholeView, inspector, destroy };
    }
    return { create };
  });
})();
