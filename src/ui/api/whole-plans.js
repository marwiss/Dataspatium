// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Whole detailed plans in a geodata source's layer browser (F133 a): the card behind the entry *Detaljplaner (hela planer)* at the
 * top of the layer list of a WFS with the NGP layers or of Lantmäteriet's NGP API. A search by name or designation (in one
 * municipality or all, for the API) gives a short list of plans; choosing one fetches it with all its provisions (api/ngp-plans),
 * with progress per layer and Avbryt, and keeps it as a detaljplan.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/whole-plans', ['ui/base', 'ui/basic', 'ui/icons', 'api/ngp-plans'], (base, basic, icons, ngp) => {
    const { h, t, i18n, replace } = base;

    /** @param {{connector: any, ctx?: any, log?: Function, onDataset?: Function}} api */
    function create(api) {
      const { connector } = api;
      const kind = ngp.kindOf(connector);
      const state = { query: '', collection: '', searching: false, plans: null, total: 0, more: false, mode: '', error: '', fetching: '', progress: null, saved: null, skipped: [], fallback: '' };
      /** @type {AbortController|null} */
      let abort = null;
      const el = h('div', { class: 'dm-card dm-stack-sm dm-geo-whole', 'data-plan-whole-card': kind });
      const fail = (err) => {
        state.error = err && err.kind === 'aborted' ? t('api.aborted') : (err && err.message) || String(err);
        if (api.log && !(err && err.kind === 'aborted')) api.log(`${connector.name}: ${state.error}`, 'error');
      };

      /** Search the plans by name or designation. */
      async function search() {
        if (state.searching || state.fetching) return;
        state.searching = true; state.error = ''; state.saved = null; state.skipped = []; state.fallback = ''; abort = new AbortController(); render();
        try {
          const res = await ngp.search(connector, state.query, { collection: state.collection, signal: abort.signal });
          state.plans = res.plans; state.total = res.total; state.more = !!res.more || res.total > res.plans.length; state.mode = res.mode || '';
        } catch (err) { state.plans = null; fail(err); }
        state.searching = false; abort = null; render();
      }
      /** Fetch one plan whole and keep it as a detaljplan. @param {any} hit */
      async function fetchPlan(hit) {
        if (state.fetching || state.searching) return;
        state.fetching = hit.id; state.error = ''; state.saved = null; state.skipped = []; state.fallback = ''; state.progress = null; abort = new AbortController(); render();
        try {
          const res = await ngp.fetchPlan(connector, hit, { mode: state.mode, signal: abort.signal, onProgress: (p) => { state.progress = p; render(); } });
          state.saved = { id: res.meta.id, text: t('plan.saved.detaljplan', { name: res.meta.name, n: i18n.formatNumber(res.meta.rowCount) }) };
          state.skipped = res.skipped; state.fallback = res.fallback;
          if (api.log) api.log(state.saved.text, 'ok');
          if (api.onDataset) api.onDataset(res.meta);
        } catch (err) { fail(err); }
        state.fetching = ''; state.progress = null; abort = null; render();
      }
      function cancel() { if (abort) abort.abort(); }

      function progressText() {
        const p = state.progress;
        if (!p) return t('plan.whole.progress.start');
        if (p.step === 'asset') return t('plan.whole.progress.asset');
        if (p.step === 'objects') return t('plan.whole.progress.objects', { page: p.page || 1 });
        return t('plan.whole.progress.layer', { layer: p.layer, i: p.index + 1, n: p.total });
      }
      function hitItem(p) {
        const title = [p.beteckning, p.namn].filter(Boolean).join(' – ') || p.id;
        const sub = [p.status, p.datum].filter(Boolean).join(' · ');
        return h('button', { type: 'button', class: 'dm-list-item', 'data-plan-whole-hit': p.id, 'aria-current': state.fetching === p.id ? 'true' : null, disabled: !!state.fetching, 'data-tip': t('plan.whole.pick.hint'), onclick: () => fetchPlan(p) },
          icons.icon('layers', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: title }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      function render() {
        const input = /** @type {any} */ (h('dm-input', { label: t('plan.whole.search'), placeholder: t('plan.whole.search.placeholder'), inline: true, 'data-plan-whole-query': '' }));
        input.value = state.query;
        input.addEventListener('input', () => { state.query = input.value; });
        input.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') { state.query = input.value; search(); } });
        const towns = kind === 'api' ? ngp.municipalities(connector) : [];
        const town = kind === 'api' ? basic.select(t('plan.whole.kommun'), [{ value: '', label: t('plan.whole.kommun.all') }].concat(towns.map((m) => ({ value: m.id, label: m.name }))), state.collection, (v) => { state.collection = v; }, { inline: true, 'data-plan-whole-kommun': '' }) : null;
        const busy = state.searching || !!state.fetching;
        const nodes = [
          h('strong', { text: t('plan.whole.title') }),
          h('p', { class: 'dm-help dm-small', text: kind === 'api' ? t('plan.whole.hint.api') : t('plan.whole.hint.wfs') }),
          h('div', { class: 'dm-row-wrap' }, town, input,
            basic.button({ label: t('plan.whole.search.button'), icon: 'search', variant: state.saved ? undefined : 'primary', loading: state.searching, disabled: !!state.fetching, title: t('plan.whole.search.hint'), onClick: () => { state.query = input.value; search(); } })),
        ];
        if (busy) nodes.push(h('div', { class: 'dm-stack-xs', 'data-plan-whole-progress': '' },
          state.progress && state.progress.total ? h('dm-progress', { value: String(Math.round((100 * state.progress.index) / state.progress.total)), label: progressText() }) : h('dm-progress', { indeterminate: true, label: state.searching ? t('plan.whole.searching') : progressText() }),
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-small', text: state.searching ? t('plan.whole.searching') : progressText() }),
            basic.button({ label: t('api.cancel'), icon: 'x', size: 'sm', title: t('plan.whole.cancel.hint'), onClick: cancel }))));
        if (state.error) nodes.push(h('p', { class: 'dm-error dm-small', 'data-plan-whole-error': '', text: state.error }));
        if (state.saved) {
          const ctx = api.ctx;
          nodes.push(h('div', { class: 'dm-success', 'data-plan-whole-saved': state.saved.id }, h('span', { text: state.saved.text }),
            ctx && ctx.store && ctx.shell ? h('div', { class: 'dm-row' }, basic.button({ label: t('import.open.bearbeta'), icon: 'pencil', variant: 'primary', title: t('plan.whole.open.hint'), onClick: () => { ctx.store.set({ selectedId: state.saved.id }); ctx.shell.activate('bearbeta'); } })) : null));
        }
        if (state.fallback) nodes.push(h('p', { class: 'dm-warn dm-small', 'data-plan-whole-fallback': '', text: t('plan.whole.asset.fallback', { message: state.fallback }) }));
        for (const layer of state.skipped) nodes.push(h('p', { class: 'dm-help dm-small', 'data-plan-whole-skipped': layer, text: t('plan.whole.skipped', { layer }) }));
        if (state.plans && !state.plans.length) nodes.push(h('p', { class: 'dm-help', text: t('plan.whole.none') }));
        if (state.plans && state.plans.length) {
          const n = i18n.formatNumber(state.total);
          nodes.push(h('p', { class: 'dm-help dm-xs', 'data-plan-whole-count': String(state.plans.length), text: state.more ? (state.total > state.plans.length ? t('plan.whole.more', { shown: i18n.formatNumber(state.plans.length), n }) : t('plan.whole.more.some', { shown: i18n.formatNumber(state.plans.length) })) : t('plan.whole.count', { n: state.total }) }));
          nodes.push(h('div', { class: 'dm-list dm-fill dm-geo-whole-list' }, state.plans.map(hitItem)));
        }
        replace(el, nodes);
      }
      function destroy() { cancel(); }
      render();
      return { el, state, render, search, fetchPlan, cancel, destroy };
    }
    return { create };
  });
})();
