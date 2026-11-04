// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Search in a geodata catalogue (Geodataportalen, GeoNetwork) in Inhämta: free text, then one card per record with
 * title, organisation, abstract and the services it offers. A WFS, OGC API Features or ArcGIS service becomes a
 * geodata source with one click (api/families/geodata); WMS addresses are copied for the map's background; files
 * and metadata open in a new tab. The hit list itself can be fetched as a table from the Ändpunkter tab.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/geoportal-view', ['ui/base', 'ui/basic', 'ui/overlays', 'api/runner', 'api/families/geodata'], (base, basic, overlays, runner, geodata) => {
    const { h, t, i18n, replace } = base;
    const ABSTRACT_MAX = 280;
    const SERVICES = [
      { column: 'ogc_api', family: 'ogcapi', key: 'geoportal.add.ogcapi' },
      { column: 'wfs', family: 'wfs', key: 'geoportal.add.wfs' },
      { column: 'arcgis', family: 'arcgis', key: 'geoportal.add.arcgis' },
    ];

    /** @param {{connector: any, runFetch: Function, log?: Function, onConnector?: Function}} api */
    function create(api) {
      const { connector } = api;
      const state = { q: '', rows: null, total: 0, loading: false, error: '', adding: '' };
      const el = h('div', { class: 'dm-stack' });
      let abort = null;
      const endpoint = () => (connector.endpoints || []).find((e) => e.response && e.response.format === 'geonetwork') || (connector.endpoints || [])[0] || null;

      async function search() {
        const ep = endpoint();
        const q = state.q.trim();
        if (!ep || !q || state.loading) return;
        if (abort) abort.abort();
        abort = new AbortController();
        state.loading = true; state.error = ''; state.rows = null; render();
        try {
          const table = await runner.fetchTable(connector, ep, { q }, { signal: abort.signal, firstPageOnly: true });
          state.rows = table.rows.map((r) => { const o = {}; table.columns.forEach((c, i) => { o[c] = r[i]; }); return o; });
          state.total = (table.meta && table.meta.total) || state.rows.length;
          if (api.log) api.log(t('geoportal.found', { n: i18n.formatNumber(state.total), q }), 'ok');
        } catch (err) {
          if (!(err && err.kind === 'aborted')) { state.error = (err && err.message) || String(err); if (api.log) api.log(`${connector.name}: ${state.error}`, 'error'); }
        }
        state.loading = false; abort = null; render();
      }

      /** Make a geodata source of a service link and hand it to Inhämta. */
      async function add(rec, svc) {
        const url = rec[svc.column];
        if (!url || state.adding) return;
        state.adding = rec.id + ':' + svc.column; render();
        try {
          const res = await geodata.createConnector(svc.family, { baseUrl: String(url) });
          const msg = t('families.created', { name: res.connector.name, n: res.entities.length });
          if (api.log) api.log(msg, 'ok');
          overlays.toast.show(msg, { kind: 'ok' });
          if (res.discoveryError) {
            const warn = t('geodata.err.discover', { message: res.discoveryError });
            if (api.log) api.log(warn, 'warn');
            overlays.toast.show(warn, { kind: 'warn', timeout: 10000 });
          }
          if (api.onConnector) api.onConnector(res.connector);
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        state.adding = ''; render();
      }
      async function copy(text) {
        try { await navigator.clipboard.writeText(String(text)); overlays.toast.show(t('geoportal.copied'), { kind: 'ok' }); }
        catch (_err) { overlays.toast.show(String(text), { timeout: 15000 }); }
      }
      const open = (url) => window.open(String(url), '_blank', 'noopener');

      function card(rec) {
        const abstract = String(rec.beskrivning || '');
        const buttons = [];
        for (const svc of SERVICES) if (rec[svc.column]) buttons.push(basic.button({ label: t(svc.key), icon: 'plus', size: 'sm', variant: buttons.length ? 'default' : 'primary', title: String(rec[svc.column]), loading: state.adding === rec.id + ':' + svc.column, onClick: () => add(rec, svc) }));
        if (rec.wms) buttons.push(basic.button({ label: t('geoportal.copy.wms'), icon: 'copy', size: 'sm', title: t('geoportal.copy.wms.hint'), onClick: () => copy(rec.wms) }));
        if (rec.nedladdning) buttons.push(basic.button({ label: t('geoportal.download'), icon: 'external-link', size: 'sm', variant: 'ghost', title: String(rec.nedladdning), onClick: () => open(rec.nedladdning) }));
        if (rec.metadata) buttons.push(basic.button({ label: t('geoportal.metadata'), icon: 'external-link', size: 'sm', variant: 'ghost', onClick: () => open(rec.metadata) }));
        let links = [];
        try { links = rec.lankar ? JSON.parse(String(rec.lankar)) : []; } catch (_e) { links = []; }
        const known = new Set([rec.wfs, rec.ogc_api, rec.arcgis, rec.wms, rec.nedladdning].filter(Boolean).map(String));
        const other = links.filter((l) => l && l.url && !known.has(String(l.url)));
        return h('div', { class: 'dm-card dm-stack-sm dm-geoportal-card' },
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: String(rec.titel || rec.id || '') }), rec.typ ? h('dm-badge', { text: String(rec.typ) }) : null),
          rec.organisation ? h('p', { class: 'dm-help dm-xs', text: String(rec.organisation) }) : null,
          abstract ? h('p', { class: 'dm-small', text: abstract.length > ABSTRACT_MAX ? abstract.slice(0, ABSTRACT_MAX - 1) + '…' : abstract }) : null,
          buttons.length ? h('div', { class: 'dm-row-wrap' }, buttons) : h('p', { class: 'dm-help dm-xs', text: t('geoportal.noservice') }),
          other.length ? h('details', { class: 'dm-more' }, h('summary', { text: t('geoportal.links', { n: other.length }) }), h('ul', { class: 'dm-geoportal-links' }, other.slice(0, 20).map((l) => h('li', null, l.protocol ? h('span', { class: 'dm-muted dm-xs', text: String(l.protocol) + ' ' }) : null, h('a', { href: String(l.url), target: '_blank', rel: 'noopener', class: 'dm-break', text: String(l.name || l.url) }))))) : null);
      }

      function render() {
        const input = /** @type {any} */ (h('dm-input', { label: t('geoportal.query'), placeholder: t('geoportal.query.placeholder') }));
        input.value = state.q;
        input.addEventListener('input', () => { state.q = input.value; });
        input.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') search(); });
        const nodes = [
          h('div', { class: 'dm-row-end dm-geoportal-search' }, input, basic.button({ label: t('geoportal.search'), icon: 'search', variant: 'primary', loading: state.loading, onClick: search })),
          h('p', { class: 'dm-help', text: t('geoportal.help') }),
        ];
        if (state.error) nodes.push(h('p', { class: 'dm-error dm-small', text: state.error }));
        if (state.rows) {
          nodes.push(h('p', { class: 'dm-help', text: state.rows.length ? t('geoportal.result', { shown: i18n.formatNumber(state.rows.length), total: i18n.formatNumber(state.total) }) : t('geoportal.empty') }));
          nodes.push(h('div', { class: 'dm-stack-sm dm-geoportal-list' }, state.rows.map(card)));
        }
        replace(el, nodes);
        if (!state.rows && !state.loading) requestAnimationFrame(() => { try { input.focus(); } catch (_e) { /* ignore */ } });
      }
      function start() { render(); }
      return { el, start, state, search };
    }
    return { create };
  });
})();
