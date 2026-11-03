// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Söka": find and list without code. Tabs: Sök (full text across datasets with facets to narrow by) and
 * Listor (saved selections that run again and can become datasets). Fråga (the visual query builder) is added
 * in 2.2. The inspector shows the selected hit as a record.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/soka', ['ui/base', 'analysis/search', 'data/lists'], (base, search, lists) => {
    const { h, t, i18n, replace } = base;
    const TABS = ['sok', 'listor'];
    const TAB_ICONS = { sok: 'text-search', listor: 'list-checks' };

    /** @param {any} ctx */
    function createMode(ctx) {
      const { store, ui, services, shell } = ctx;
      let slots = null;
      let unsubscribe = null;
      let unsubLists = null;
      let tab = 'sok';
      /** The query: text, scope and facet filters per dataset. */
      let text = '';
      let scope = 'all';
      /** @type {Record<string, Array<{column: string, value: any}>>} */
      let filters = {};
      /** @type {any[]} results of the last search */
      let results = [];
      let searched = false;
      let running = false;
      /** @type {{datasetId: string, columns: any[], row: any[]}|null} */
      let hit = null;
      let queryInput = null;
      const fail = (err) => { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };
      const datasetById = (id) => store.get().datasets.find((d) => d.id === id) || null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => {
          if (changed.includes('pendingSearch') && state.pendingSearch) { consumePending(state); return; }
          if (changed.includes('datasets') || changed.includes('selectedId')) render();
        });
        unsubLists = lists.subscribe(() => { if (tab === 'listor') render(); });
        render();
        consumePending(store.get());
      }

      /** A search handed over by another part of the app (the course): run it in the selected dataset. */
      function consumePending(state) {
        const pending = state.pendingSearch;
        if (!pending) return;
        store.set({ pendingSearch: null });
        text = String(pending.text || '');
        scope = state.selectedId ? 'selected' : 'all';
        tab = 'sok';
        render();
        runSearch();
      }
      function deactivate() { slots = null; if (unsubscribe) { unsubscribe(); unsubscribe = null; } if (unsubLists) { unsubLists(); unsubLists = null; } }

      function render() {
        if (!slots) return;
        const state = store.get();
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        const tabsEl = /** @type {any} */ (h('dm-tabs'));
        tabsEl.tabs = TABS.map((id) => ({ id, label: t('soka.tabs.' + id), icon: TAB_ICONS[id] }));
        tabsEl.active = tab;
        tabsEl.addEventListener('dm-change', (e) => { tab = /** @type {CustomEvent} */ (e).detail.id; render(); });
        const body = h('div', { class: 'dm-stack' });
        replace(slots.center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('text-search', 20), t('soka.title'))), tabsEl, body);
        if (tab === 'sok') renderSearch(body); else renderLists(body).catch(fail);
        renderInspector();
      }

      // ---- Sök ----
      function renderSearch(body) {
        queryInput = /** @type {any} */ (h('dm-input', { label: t('soka.query'), placeholder: t('soka.query.placeholder'), value: text, 'data-course': 'search' }));
        queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
        const scopeSel = /** @type {any} */ (h('dm-select', { label: t('soka.scope') }));
        scopeSel.options = [{ value: 'all', label: t('soka.scope.all') }, { value: 'selected', label: t('soka.scope.selected') }];
        scopeSel.value = scope;
        scopeSel.addEventListener('change', () => { scope = scopeSel.value; });
        const runBtn = ui.button({ label: t('soka.run'), icon: 'text-search', variant: 'primary', loading: running, onClick: () => runSearch() });
        const form = h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-form-grid' }, queryInput, scopeSel),
          h('div', { class: 'dm-row-wrap' }, runBtn, h('span', { class: 'dm-help', text: t('soka.help') })));
        const out = [];
        if (!searched) out.push(h('dm-empty-state', { icon: 'text-search', heading: t('soka.empty.title'), text: t('soka.empty.query') }));
        else if (!results.some((r) => r.count)) out.push(h('p', { class: 'dm-help', text: t('soka.nohits') }));
        else for (const r of results) if (r.count) out.push(resultCard(r));
        replace(body, form, ...out);
      }

      async function runSearch() {
        if (!slots) return;
        text = queryInput ? String(queryInput.value || '') : text;
        const state = store.get();
        const ids = scope === 'selected' && state.selectedId && datasetById(state.selectedId) ? [state.selectedId] : state.datasets.map((d) => d.id);
        const hasFilters = Object.values(filters).some((f) => f && f.length);
        if (!search.words(text).length && !hasFilters) { ui.toast.show(t('soka.empty.query'), { kind: 'info' }); return; }
        running = true; searched = true; hit = null;
        render();
        try { results = await search.search(ids, text, { filters }); }
        catch (err) { fail(err); results = []; }
        running = false;
        store.set({ lastSearch: { text, hits: results.reduce((n, r) => n + r.count, 0), at: Date.now() } });
        render();
      }

      function resultCard(r) {
        const ds = datasetById(r.id);
        const name = ds ? ds.name : r.id;
        const active = filters[r.id] || [];
        const chips = [];
        for (const f of active) {
          chips.push(h('button', { type: 'button', class: 'dm-chip', 'aria-pressed': 'true', title: t('soka.filter.clear'), onclick: () => { filters[r.id] = active.filter((x) => x !== f); runSearch(); } },
            `${f.column} = ${f.value === null ? t('common.missing') : f.value}`, ' ', ui.icon('x', 12)));
        }
        const facetRows = r.facets.map((facet) => h('div', { class: 'dm-facet' },
          h('span', { class: 'dm-facet-label', text: facet.label + ':' }),
          h('div', { class: 'dm-chips' }, facet.values.map((v) => h('button', {
            type: 'button', class: 'dm-chip', onclick: () => { filters[r.id] = active.concat([{ column: facet.column, value: v.value }]); runSearch(); },
          }, `${v.value === null ? t('common.missing') : v.value} (${i18n.formatNumber(v.n)})`)))));
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-search-table', 'aria-label': t('soka.hits', { n: i18n.formatNumber(r.count) }) }));
        table.setData({
          columns: r.columns.map((c) => ({ key: c.name, label: c.label || c.name, type: c.type })),
          rowCount: r.rows.length,
          rowProvider: async (start, count) => r.rows.slice(start, start + count).map((row) => row.slice(1)),
          sort: null,
        });
        table.addEventListener('dm-row', (e) => { const d = /** @type {CustomEvent} */ (e).detail; hit = { datasetId: r.id, columns: r.columns, row: r.rows[d.index] }; renderInspector(); });
        const actions = h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('soka.save.list'), icon: 'list-checks', size: 'sm', onClick: () => saveList(r) }),
          ui.button({ label: t('soka.save.dataset'), icon: 'table', size: 'sm', onClick: () => saveDataset(r) }),
          ui.button({ label: t('soka.open.bearbeta'), icon: 'wand-sparkles', size: 'sm', onClick: () => { store.set({ selectedId: r.id }); shell.activate('bearbeta'); } }));
        return h('div', { class: 'dm-card dm-search-result', 'data-dataset': r.id },
          h('div', { class: 'dm-search-head' }, h('h3', { text: name }), h('dm-badge', { kind: 'accent', text: r.truncated ? t('soka.hits.shown', { shown: i18n.formatNumber(r.rows.length), n: i18n.formatNumber(r.count) }) : t('soka.hits', { n: i18n.formatNumber(r.count) }) })),
          chips.length ? h('div', { class: 'dm-chips' }, chips) : null,
          facetRows.length ? h('div', { class: 'dm-stack-sm' }, facetRows) : null,
          table, actions);
      }

      async function saveList(r) {
        const name = await ui.dialog.prompt(t('soka.list.name'), { title: t('soka.save.list'), value: text || (datasetById(r.id) || {}).name || '' });
        if (name === null) return;
        try {
          const rec = await lists.save({ name, datasetId: r.id, text, filters: filters[r.id] || [], hits: r.count });
          shell.log(t('soka.list.saved', { name: rec.name }), 'ok');
          ui.toast.show(t('soka.list.saved', { name: rec.name }), { kind: 'ok' });
        } catch (err) { fail(err); }
      }

      async function saveDataset(r) {
        const ds = datasetById(r.id);
        const name = await ui.dialog.prompt(t('soka.list.dataset.name'), { title: t('soka.save.dataset'), value: `${ds ? ds.name : ''} ${text}`.trim() });
        if (name === null) return;
        try {
          const rec = { id: null, name, datasetId: r.id, text, filters: filters[r.id] || [] };
          const meta = await lists.toDataset(rec, name);
          shell.log(t('soka.list.dataset.done', { name: meta.name, n: i18n.formatNumber(meta.rowCount || 0) }), 'ok');
          ui.toast.show(t('soka.list.dataset.done', { name: meta.name, n: i18n.formatNumber(meta.rowCount || 0) }), { kind: 'ok' });
        } catch (err) { fail(err); }
      }

      // ---- Listor ----
      async function renderLists(body) {
        const all = await lists.list();
        if (!slots || tab !== 'listor') return;
        if (!all.length) { replace(body, h('dm-empty-state', { icon: 'list-checks', heading: t('soka.tabs.listor'), text: t('soka.lists.empty') })); return; }
        const cards = all.map((rec) => {
          const ds = datasetById(rec.datasetId);
          const meta = [ds ? ds.name : t('soka.lists.missing'), rec.hits === null ? '' : t('soka.lists.hits', { n: i18n.formatNumber(rec.hits) }), i18n.formatDateTime(rec.updatedAt)].filter(Boolean).join(' · ');
          return h('div', { class: 'dm-card dm-stack-sm', 'data-list': rec.id },
            h('div', { class: 'dm-search-head' }, h('h3', { text: rec.name }), h('span', { class: 'dm-help', text: meta })),
            h('p', { class: 'dm-help', text: lists.describe(rec) || t('soka.lists.all') }),
            h('div', { class: 'dm-row-wrap' },
              ui.button({ label: t('soka.lists.run'), icon: 'play', size: 'sm', variant: 'primary', disabled: !ds, onClick: () => runList(rec) }),
              ui.button({ label: t('soka.save.dataset'), icon: 'table', size: 'sm', disabled: !ds, onClick: async () => {
                const name = await ui.dialog.prompt(t('soka.list.dataset.name'), { title: t('soka.save.dataset'), value: rec.name });
                if (name === null) return;
                try { const m = await lists.toDataset(rec, name); shell.log(t('soka.list.dataset.done', { name: m.name, n: i18n.formatNumber(m.rowCount || 0) }), 'ok'); } catch (err) { fail(err); }
              } }),
              ui.button({ label: t('common.delete'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: async () => {
                if (await ui.dialog.confirm(t('soka.lists.delete.confirm', { name: rec.name }), { okLabel: t('common.delete'), danger: true })) { await lists.remove(rec.id); shell.log(t('soka.lists.deleted', { name: rec.name }), 'ok'); }
              } })));
        });
        replace(body, ...cards);
      }

      /** Run a list: show its query and hits in the Sök tab. */
      async function runList(rec) {
        text = rec.text; scope = 'selected'; filters = { [rec.datasetId]: rec.filters.slice() };
        store.set({ selectedId: rec.datasetId });
        tab = 'sok'; searched = true; running = true; hit = null;
        render();
        try { results = [await lists.run(rec)]; } catch (err) { fail(err); results = []; }
        running = false;
        render();
      }

      // ---- inspector ----
      function renderInspector() {
        if (!slots) return;
        if (tab === 'listor') { replace(slots.right, h('p', { class: 'dm-help', text: t('soka.lists.inspector') })); return; }
        if (!hit) { replace(slots.right, h('p', { class: 'dm-help', text: t('soka.inspector.hint') })); return; }
        const ds = datasetById(hit.datasetId);
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = hit.columns.map((c, i) => ({ label: c.label || c.name, value: hit.row[i + 1] }));
        replace(slots.right,
          h('h4', { text: ds ? ds.name : '' }),
          h('p', { class: 'dm-help', text: t('soka.hit.row', { n: i18n.formatNumber(hit.row[0]) }) }),
          kv,
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('soka.open.bearbeta'), icon: 'wand-sparkles', size: 'sm', onClick: () => { store.set({ selectedId: hit.datasetId }); shell.activate('bearbeta'); } })));
      }

      // Command palette: jump to the search field.
      if (ctx.palette) {
        ctx.palette.register(() => [{ id: 'soka:focus', label: t('soka.palette'), hint: t('mode.soka.desc'), group: t('palette.group.actions'), icon: 'text-search', run: () => { tab = 'sok'; shell.activate('soka'); setTimeout(() => { if (queryInput) queryInput.focus(); }, 0); } }]);
      }

      return { id: 'soka', activate, deactivate };
    }
    return { createMode, TABS };
  });
})();
