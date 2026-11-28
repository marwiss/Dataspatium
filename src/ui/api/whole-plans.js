// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Whole detailed plans in a geodata source (F133 a, F137 c): the mode *Hela detaljplaner* of a WFS with the NGP layers or of
 * Lantmäteriet's NGP API. The geodata view (ui/api/geodata-view) owns the search box and places this module's parts: the status
 * line and the list of hits in the work area, the municipality choice (the API) next to the search box, and the chosen plan's card
 * in the inspector. The search runs as the person types: from two characters, after a pause, with the search before it stopped,
 * so the service gets one request per pause and not one per key. Choosing a hit shows its facts in the card; *Hämta hela planen*
 * fetches it with all its provisions (api/ngp-plans), with progress per layer and Avbryt, and keeps it as a detaljplan.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/whole-plans', ['ui/base', 'ui/basic', 'ui/icons', 'api/ngp-plans'], (base, basic, icons, ngp) => {
    const { h, t, i18n, replace } = base;
    /** Characters before the live search starts, and the pause after the last key before it is sent. */
    const MIN_CHARS = 2;
    const PAUSE_MS = 300;

    /**
     * @param {{connector: any, ctx?: any, log?: Function, onDataset?: Function}} api
     * @param {{onChoose?: (hit: any) => void}} [hooks] onChoose: a hit was chosen (the geodata view shows the inspector)
     */
    function create(api, hooks = {}) {
      const { connector } = api;
      const kind = ngp.kindOf(connector);
      const state = { query: '', collection: '', searching: false, plans: null, total: 0, more: false, mode: '', error: '', chosen: null, fetching: '', progress: null, saved: null, skipped: [], fallback: '', fetchError: '' };
      /** @type {AbortController|null} */
      let searchAbort = null;
      /** @type {AbortController|null} */
      let fetchAbort = null;
      let timer = 0;
      /** Counts the searches, so that the answer of a stopped one is never shown. */
      let seq = 0;
      /** A live search that met a refused consent waits for Enter, so that the question is not asked again at every pause. */
      let paused = false;
      const statusEl = h('div', { class: 'dm-geo-status', 'data-plan-whole-status': '', hidden: true });
      const listEl = h('div', { class: 'dm-list dm-geo-list dm-fill-rest', 'data-plan-whole-list': kind });
      const cardEl = h('div', { class: 'dm-stack-sm dm-geo-whole', 'data-plan-whole-card': kind });
      const message = (err) => (err && err.kind === 'aborted' ? t('api.aborted') : (err && err.message) || String(err));
      const logError = (err) => { if (api.log && !(err && err.kind === 'aborted')) api.log(`${connector.name}: ${message(err)}`, 'error'); };
      const searchable = (text) => { const term = String(text || '').trim(); return term.length >= MIN_CHARS || (!term && !!state.collection); };

      function stopSearch() {
        clearTimeout(timer); timer = 0;
        if (searchAbort) searchAbort.abort();
        searchAbort = null; seq++; state.searching = false;
      }
      /** A keystroke: the search before it stops, and a new one is sent after the pause once the term can be searched. @param {string} text */
      function schedule(text) {
        state.query = text;
        stopSearch();
        if (searchable(text)) { if (!paused) timer = setTimeout(search, PAUSE_MS); }
        else { state.plans = null; state.error = ''; }
        renderList();
      }
      /** Search the plans by name or designation now (Enter, a municipality chosen, the pause after typing). */
      async function search() {
        stopSearch();
        const my = seq;
        const ctl = new AbortController(); searchAbort = ctl;
        state.searching = true; state.error = ''; renderList();
        try {
          const res = await ngp.search(connector, state.query, { collection: state.collection, signal: ctl.signal });
          if (my !== seq) return;
          state.plans = res.plans; state.total = res.total; state.more = !!res.more || res.total > res.plans.length; state.mode = res.mode || ''; paused = false;
        } catch (err) {
          if (my !== seq) return;
          state.plans = null; state.error = message(err); logError(err);
          if (err && err.name === 'ConsentError') paused = true;
        }
        state.searching = false; searchAbort = null; renderList();
      }
      /** The municipality (the API): the plans are searched again in it. @param {string} id */
      function setCollection(id) {
        state.collection = id;
        if (searchable(state.query)) search();
        else { stopSearch(); state.plans = null; state.error = ''; renderList(); }
      }
      /** A hit chosen in the list: its card in the inspector. @param {any} hit */
      function choose(hit) {
        if (state.fetching) return;
        state.chosen = hit; state.saved = null; state.skipped = []; state.fallback = ''; state.fetchError = '';
        for (const b of listEl.querySelectorAll('[data-plan-whole-hit]')) { if (b.getAttribute('data-plan-whole-hit') === hit.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
        renderCard();
        if (hooks.onChoose) hooks.onChoose(hit);
      }
      /** Fetch one plan whole and keep it as a detaljplan. @param {any} [hit] the chosen one when left out */
      async function fetchPlan(hit) {
        const p = hit || state.chosen;
        if (!p || state.fetching) return;
        state.chosen = p; state.fetching = p.id; state.fetchError = ''; state.saved = null; state.skipped = []; state.fallback = ''; state.progress = null;
        fetchAbort = new AbortController(); renderCard(); renderList();
        try {
          const res = await ngp.fetchPlan(connector, p, { mode: state.mode, signal: fetchAbort.signal, onProgress: (x) => { state.progress = x; renderCard(); } });
          state.saved = { id: res.meta.id, text: t('plan.saved.detaljplan', { name: res.meta.name, n: i18n.formatNumber(res.meta.rowCount) }) };
          state.skipped = res.skipped; state.fallback = res.fallback;
          if (api.log) api.log(state.saved.text, 'ok');
          if (api.onDataset) api.onDataset(res.meta);
        } catch (err) { state.fetchError = message(err); logError(err); }
        state.fetching = ''; state.progress = null; fetchAbort = null; renderCard(); renderList();
      }
      function cancel() { if (fetchAbort) fetchAbort.abort(); }

      function progressText() {
        const p = state.progress;
        if (!p) return t('plan.whole.progress.start');
        if (p.step === 'asset') return t('plan.whole.progress.asset');
        if (p.step === 'objects') return t('plan.whole.progress.objects', { page: p.page || 1 });
        return t('plan.whole.progress.layer', { layer: p.layer, i: p.index + 1, n: p.total });
      }
      const titleOf = (p) => [p.beteckning, p.namn].filter(Boolean).join(' – ') || p.id;
      /** The municipality of a hit: its own, or the name of its collection (the API). */
      function townOf(p) {
        if (p.kommun) return p.kommun;
        const m = p.collection ? ngp.municipalities(connector).find((x) => x.id === p.collection) : null;
        return m ? m.name : '';
      }
      function hitItem(p) {
        const sub = [p.status, p.datum].filter(Boolean).join(' · ');
        return h('button', { type: 'button', class: 'dm-list-item', 'data-plan-whole-hit': p.id, 'aria-current': state.chosen && state.chosen.id === p.id ? 'true' : null, disabled: !!state.fetching, 'data-tip': t('plan.whole.hit.hint'), onclick: () => choose(p) },
          icons.icon('layers', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: titleOf(p) }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      /** The status line above the list and the list: the hits, or what to do before there are any. */
      function renderList() {
        const status = [];
        if (state.searching) status.push(h('dm-progress', { indeterminate: true, label: t('plan.whole.searching') }));
        else if (state.error) status.push(h('p', { class: 'dm-error dm-small', 'data-plan-whole-error': '', text: state.error }));
        else if (state.plans && state.plans.length) {
          const n = i18n.formatNumber(state.total);
          status.push(h('p', { class: 'dm-help dm-xs', 'data-plan-whole-count': String(state.plans.length), text: state.more ? (state.total > state.plans.length ? t('plan.whole.more', { shown: i18n.formatNumber(state.plans.length), n }) : t('plan.whole.more.some', { shown: i18n.formatNumber(state.plans.length) })) : t('plan.whole.count', { n: state.total }) }));
        }
        replace(statusEl, status);
        statusEl.hidden = !status.length;
        if (state.plans && state.plans.length) replace(listEl, state.plans.map(hitItem));
        else if (state.plans) replace(listEl, h('p', { class: 'dm-help dm-geo-empty', text: t('plan.whole.none') }));
        else replace(listEl, h('div', { class: 'dm-stack-sm dm-geo-empty', 'data-plan-whole-start': '' }, h('p', { class: 'dm-help', text: t('plan.whole.min') }), h('p', { class: 'dm-help dm-small', text: kind === 'api' ? t('plan.whole.hint.api') : t('plan.whole.hint.wfs') })));
      }
      /** The chosen plan's card in the inspector: its facts, Hämta hela planen, the progress and what was kept. */
      function renderCard() {
        const p = state.chosen;
        if (!p) { replace(cardEl, h('p', { class: 'dm-help', 'data-plan-whole-pick': '', text: t('plan.whole.pick') })); return; }
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('plan.field.beteckning'), value: p.beteckning }, { label: t('common.name'), value: p.namn }, { label: t('plan.field.status'), value: p.status },
          { label: t('plan.whole.date'), value: p.datum }, { label: t('plan.field.kommun'), value: townOf(p) },
        ].filter((x) => x.value);
        const busy = !!state.fetching;
        const nodes = [
          h('h3', { text: titleOf(p) }), kv,
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('plan.whole.fetch'), icon: 'layers', variant: state.saved ? undefined : 'primary', loading: busy, title: t('plan.whole.pick.hint'), 'data-plan-whole-fetch': p.id, onClick: () => fetchPlan(p) })),
        ];
        if (busy) nodes.push(h('div', { class: 'dm-stack-sm', 'data-plan-whole-progress': '' },
          state.progress && state.progress.total ? h('dm-progress', { value: String(Math.round((100 * state.progress.index) / state.progress.total)), label: progressText() }) : h('dm-progress', { indeterminate: true, label: progressText() }),
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-small', text: progressText() }),
            basic.button({ label: t('api.cancel'), icon: 'x', size: 'sm', title: t('plan.whole.cancel.hint'), onClick: cancel }))));
        if (state.fetchError) nodes.push(h('p', { class: 'dm-error dm-small', 'data-plan-whole-error': '', text: state.fetchError }));
        if (state.saved) {
          const ctx = api.ctx;
          nodes.push(h('div', { class: 'dm-success', 'data-plan-whole-saved': state.saved.id }, h('span', { text: state.saved.text }),
            ctx && ctx.store && ctx.shell ? h('div', { class: 'dm-row' }, basic.button({ label: t('import.open.bearbeta'), icon: 'pencil', variant: 'primary', title: t('plan.whole.open.hint'), onClick: () => { ctx.store.set({ selectedId: state.saved.id }); ctx.shell.activate('bearbeta'); } })) : null));
        }
        if (state.fallback) nodes.push(h('p', { class: 'dm-warn dm-small', 'data-plan-whole-fallback': '', text: t('plan.whole.asset.fallback', { message: state.fallback }) }));
        for (const layer of state.skipped) nodes.push(h('p', { class: 'dm-help dm-small', 'data-plan-whole-skipped': layer, text: t('plan.whole.skipped', { layer }) }));
        replace(cardEl, nodes);
      }
      /** The municipality choice of the NGP API, next to the search box; null for a WFS. */
      function townSelect() {
        if (kind !== 'api') return null;
        const towns = ngp.municipalities(connector);
        return basic.select(t('plan.whole.kommun'), [{ value: '', label: t('plan.whole.kommun.all') }].concat(towns.map((m) => ({ value: m.id, label: m.name }))), state.collection, setCollection, { inline: true, 'data-plan-whole-kommun': '' });
      }
      function destroy() { stopSearch(); cancel(); }
      renderList(); renderCard();
      return { MIN_CHARS, PAUSE_MS, state, statusEl, listEl, cardEl, townSelect, schedule, search, setCollection, choose, fetchPlan, cancel, renderList, renderCard, destroy };
    }
    return { create, MIN_CHARS, PAUSE_MS };
  });
})();
