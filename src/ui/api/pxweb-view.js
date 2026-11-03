// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for PxWeb services (SCB, Folkhälsomyndigheten): folder navigation (API v1) or table search
 * (API v2), then a variable picker with a live cell count, then fetch as JSON-stat 2.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/pxweb-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/api/variable-picker', 'api/families/pxweb'], (base, basic, icons, _picker, pxwebFamily) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {{connector: any, runFetch: Function, log: Function}} api
     * @param {any} [family] family module with the PxWeb browsing interface (listFolder, tableMetaV1,
     *   cellCount, maxCells, fetchData, describeSource, version); Statistics Denmark and FHI reuse this view.
     */
    function create(api, family) {
      const pxweb = family || pxwebFamily;
      const { connector } = api;
      const v2 = pxweb.version(connector) === 2;
      const state = { path: [], crumbs: [], entries: [], filter: '', loading: false, error: '', query: '', results: [], page: { number: 1, totalPages: 1, totalElements: 0 }, table: null, meta: null };
      const el = h('div', { class: 'dm-stack' });
      let picker = null; let cellsEl = null;

      async function loadFolder() {
        state.loading = true; state.error = ''; state.table = null; state.meta = null; render();
        try { state.entries = await pxweb.listFolder(connector, state.path); } catch (err) { state.error = (err && err.message) || String(err); }
        state.loading = false; render();
      }
      async function search(page = 1) {
        state.loading = true; state.error = ''; state.table = null; state.meta = null; render();
        try {
          const res = await pxweb.searchTables(connector, state.query, page, 50);
          state.results = page === 1 ? res.tables : state.results.concat(res.tables);
          state.page = res.page;
        } catch (err) { state.error = (err && err.message) || String(err); }
        state.loading = false; render();
      }
      async function openTable(entry) {
        state.loading = true; state.error = ''; render();
        try {
          if (v2) { state.meta = await pxweb.tableMetaV2(connector, entry.id); state.table = { id: entry.id, title: state.meta.title || entry.text }; }
          else { const path = state.path.concat([entry.id]); state.meta = await pxweb.tableMetaV1(connector, path); state.table = { path, id: entry.id, title: state.meta.title || entry.text }; }
        } catch (err) { state.error = (err && err.message) || String(err); }
        state.loading = false; render();
      }

      function render() {
        const nodes = [];
        if (state.table && state.meta) nodes.push(renderTable()); else nodes.push(v2 ? renderSearch() : renderFolder());
        if (state.error) nodes.push(h('p', { class: 'dm-error dm-small', text: state.error }));
        replace(el, nodes);
      }

      function renderFolder() {
        const crumbs = h('nav', { class: 'dm-crumbs', 'aria-label': t('api.pxweb.path') },
          h('button', { type: 'button', class: 'dm-crumb', onclick: () => { state.path = []; state.crumbs = []; loadFolder(); } }, t('api.pxweb.start')),
          state.crumbs.map((c, i) => [h('span', { class: 'dm-crumb-sep', text: '›' }), h('button', { type: 'button', class: 'dm-crumb', 'aria-current': i === state.crumbs.length - 1 ? 'page' : null, onclick: () => { state.path = state.path.slice(0, i + 1); state.crumbs = state.crumbs.slice(0, i + 1); loadFolder(); } }, c.text)]));
        const filter = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('api.pxweb.filter'), 'aria-label': t('common.filter'), inline: true }));
        filter.value = state.filter;
        let timer = 0;
        filter.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.filter = filter.value.trim().toLowerCase(); renderList(); }, 200); });
        const list = h('div', { class: 'dm-list dm-api-list' });
        const renderList = () => {
          const entries = state.entries.filter((e) => !state.filter || e.text.toLowerCase().includes(state.filter) || e.id.toLowerCase().includes(state.filter));
          replace(list, state.loading ? h('p', { class: 'dm-help', text: t('common.loading') }) : (entries.length ? entries.map((e) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => (e.type === 'folder' ? (state.path.push(e.id), state.crumbs.push(e), loadFolder()) : openTable(e)) },
            icons.icon(e.type === 'folder' ? 'folder-open' : 'table', 16),
            h('span', { class: 'dm-list-main' }, h('span', { text: e.text }), h('span', { class: 'dm-list-sub', text: e.type === 'folder' ? e.id : [e.id, e.updated ? t('api.pxweb.updated', { date: i18n.formatDateTime(e.updated) }) : ''].filter(Boolean).join(' · ') })))) : h('p', { class: 'dm-help', text: t('api.pxweb.empty') })));
        };
        renderList();
        return h('div', { class: 'dm-stack' }, crumbs, h('div', { class: 'dm-row' }, filter, h('span', { class: 'dm-help', text: t('api.pxweb.count', { n: i18n.formatNumber(state.entries.length) }) })), list);
      }

      function renderSearch() {
        const input = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('api.pxweb.search.placeholder'), 'aria-label': t('api.pxweb.search'), inline: true }));
        input.value = state.query;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.query = input.value.trim(); search(1); } });
        const list = h('div', { class: 'dm-list dm-api-list' }, state.loading && !state.results.length ? h('p', { class: 'dm-help', text: t('common.loading') }) : state.results.map((r) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => openTable(r) },
          icons.icon('table', 16), h('span', { class: 'dm-list-main' }, h('span', { text: r.text }), h('span', { class: 'dm-list-sub', text: [r.id, r.path, r.firstPeriod && r.lastPeriod ? t('api.pxweb.period', { from: r.firstPeriod, to: r.lastPeriod }) : ''].filter(Boolean).join(' · ') })))));
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-row' }, input, basic.button({ label: t('common.search'), icon: 'search', variant: 'primary', onClick: () => { state.query = input.value.trim(); search(1); } })),
          state.page.totalElements ? h('p', { class: 'dm-help', text: t('api.pxweb.results', { n: i18n.formatNumber(state.page.totalElements) }) }) : h('p', { class: 'dm-help', text: t('api.pxweb.search.hint') }),
          list,
          state.page.number < state.page.totalPages ? h('div', null, basic.button({ label: t('api.pxweb.more'), onClick: () => search(state.page.number + 1), loading: state.loading })) : null);
      }

      function renderTable() {
        const meta = state.meta;
        picker = /** @type {any} */ (h('dm-variable-picker'));
        picker.variables = meta.variables;
        cellsEl = h('p', { class: 'dm-help' });
        picker.addEventListener('dm-change', updateCells);
        const fetchBtn = basic.button({ label: t('api.fetch'), icon: 'download', variant: 'primary', onClick: fetchData });
        const out = h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-row' }, basic.button({ label: t('api.pxweb.back'), icon: 'chevron-left', onClick: () => { state.table = null; state.meta = null; render(); } }), h('h3', { class: 'dm-grow', text: meta.title }), h('dm-badge', { text: state.table.id })),
          h('p', { class: 'dm-help', text: t('api.pxweb.pick.help') }),
          picker, cellsEl,
          h('div', { class: 'dm-row' }, fetchBtn));
        setTimeout(updateCells, 0);
        return out;
      }
      function updateCells() {
        if (!cellsEl || !picker || !state.meta) return;
        const n = pxweb.cellCount(state.meta.variables, picker.selection);
        const max = pxweb.maxCells(connector);
        cellsEl.textContent = n > max ? t('api.pxweb.cells.split', { n: i18n.formatNumber(n), k: Math.ceil(n / max), max: i18n.formatNumber(max) }) : t('api.pxweb.cells.ok', { n: i18n.formatNumber(n) });
        cellsEl.className = n > max ? 'dm-warn dm-small' : 'dm-help';
      }
      function fetchData() {
        const table = state.table; const meta = state.meta; const selection = picker.selection;
        api.runFetch({
          label: meta.title,
          run: async (progress, signal) => {
            const result = await pxweb.fetchData(connector, table, meta.variables, selection, { signal, onProgress: progress });
            return { table: result, name: meta.title, source: pxweb.describeSource(connector, table, meta.variables, selection, result) };
          },
        });
      }

      function start() { if (v2) render(); else loadFolder(); }
      return { el, start, state };
    }
    return { create };
  });
})();
