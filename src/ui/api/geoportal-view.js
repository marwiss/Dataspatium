// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geodataportalen (PLAN 12 a4): search in a geodata catalogue (GeoNetwork), in Inhämta under Geodatakällor and as the view of
 * the catalogue source. Free text, by default only the posts that have something the app can fetch (the search endpoint
 * `fetchable`, filtered on the links' protocols), then one card per post with its title, organisation, abstract and an action
 * per kind of link:
 * - *Lägg till som geodatakälla* for WFS, OGC API Features and ArcGIS REST: the form that adds a geodata source opens in the
 *   workspace with the address filled in (`actions.add`), and the source asks consent for its host (F102 a, F103 a);
 * - *Hämta filen* for a download (ZIP, GeoPackage, GeoJSON, GML): fetched by io/url-import with consent for its host and handed
 *   to the import wizard (`actions.open`); an INSPIRE ATOM feed is read first and lists its files (and the feeds of its
 *   datasets), each fetched the same way;
 * - *Visa på kartan* for WMS: the service's layers (GetCapabilities, consent for its host) and the chosen one as a WMS layer on
 *   a small map in the card, the way the map views draw WMS overlays (viz/leaflet wmsLayer, consent per host).
 * Posts whose access needs a key or an agreement are marked. A service that does not let the browser read it (CORS) is named,
 * with the bridge's text (api.err.nocors) and a way to the bridge (`actions.bridge`). The hit list itself can be fetched as a
 * table from the Ändpunkter tab.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/geoportal-view', ['ui/base', 'ui/basic', 'ui/overlays', 'api/runner', 'viz/leaflet'], (base, basic, overlays, runner, leaflet) => {
    const { h, t, i18n, replace } = base;
    const ABSTRACT_MAX = 280;
    const SERVICES = [
      { column: 'ogc_api', family: 'ogcapi', key: 'geoportal.add.ogcapi' },
      { column: 'wfs', family: 'wfs', key: 'geoportal.add.wfs' },
      { column: 'arcgis', family: 'arcgis', key: 'geoportal.add.arcgis' },
    ];
    const hostOf = (url) => { try { return new URL(String(url)).host; } catch (_e) { return String(url || ''); } };
    /** True for an error of a request that got no answer: the browser was not let to read it (the catalogue itself answered). */
    const unreachable = (err) => !!err && (err.kind === 'network' || err.name === 'TypeError');

    /**
     * The entries of an ATOM feed (INSPIRE download service): per entry its title, the files it links to and the feeds of its
     * datasets (a service feed links to dataset feeds, a dataset feed to files). Relative addresses are made absolute.
     * @param {string} text @param {string} baseUrl
     * @returns {{title: string, entries: Array<{title: string, files: Array<{url: string, type: string, title: string}>, feeds: Array<{url: string, title: string}>}>}}
     */
    function atomFeed(text, baseUrl) {
      const doc = new DOMParser().parseFromString(String(text || ''), 'application/xml');
      const root = doc.documentElement;
      if (doc.getElementsByTagName('parsererror').length || !root || root.localName !== 'feed') throw new Error(t('geoportal.atom.notfeed'));
      const kids = (el, name) => Array.from(el.children).filter((c) => c.localName === name);
      const textOf = (el, name) => { const k = kids(el, name)[0]; return k ? String(k.textContent || '').trim() : ''; };
      const abs = (href) => { try { return new URL(String(href), baseUrl).toString(); } catch (_e) { return ''; } };
      const FILE = /\.(zip|gpkg|geojson|json|gml|gz|kml|kmz|csv|shp|xml|tif|tiff)(\?|$)/i;
      const entries = kids(root, 'entry').map((e) => {
        const links = kids(e, 'link').map((l) => ({ url: abs(l.getAttribute('href') || ''), rel: l.getAttribute('rel') || 'alternate', type: String(l.getAttribute('type') || '').toLowerCase(), title: l.getAttribute('title') || '' })).filter((l) => l.url);
        const own = links.filter((l) => l.rel === 'alternate' || l.rel === 'section' || l.rel === 'enclosure');
        const feeds = own.filter((l) => /atom\+xml/.test(l.type) && !/\.pdf(\?|$)/i.test(l.url)).map((l) => ({ url: l.url, title: l.title }));
        const files = own.filter((l) => !/atom\+xml|text\/html/.test(l.type) && (l.type || FILE.test(l.url))).map((l) => ({ url: l.url, type: l.type, title: l.title }));
        return { title: textOf(e, 'title') || (files[0] && files[0].url) || '', files, feeds };
      }).filter((e) => e.files.length || e.feeds.length);
      return { title: textOf(root, 'title'), entries };
    }
    /** A short name of a file's format from its type or address: ZIP, GeoPackage, GeoJSON, GML, … */
    function formatOf(file) {
      const s = `${file.type} ${file.url}`.toLowerCase();
      if (/geopackage|\.gpkg/.test(s)) return 'GeoPackage';
      if (/geo\+json|\.geojson/.test(s)) return 'GeoJSON';
      if (/gml|\.gml/.test(s)) return 'GML';
      if (/zip|\.zip/.test(s)) return 'ZIP';
      if (/json/.test(s)) return 'JSON';
      if (/csv/.test(s)) return 'CSV';
      const m = /\.([a-z0-9]{2,5})(\?|$)/.exec(file.url.toLowerCase());
      return m ? m[1].toUpperCase() : t('geoportal.file');
    }

    /**
     * @param {{connector: any, log?: Function, onConnector?: Function, actions?: {add?: (family: string, url: string, rec: any) => void, open?: (file: File, url: string) => void, bridge?: () => void}, tileFactory?: Function}} api
     *   actions: what Inhämta does with a post (the form of a geodata source, the import wizard, the bridge); tileFactory for tests
     */
    function create(api) {
      const { connector } = api;
      const actions = api.actions || {};
      const state = { q: '', fetchable: true, rows: null, total: 0, loading: false, error: '', busy: '', problems: new Map(), feeds: new Map(), maps: new Map() };
      const el = h('div', { class: 'dm-stack dm-geoportal' });
      let abort = null;
      const endpointOf = (id) => (connector.endpoints || []).find((e) => e.id === id) || null;
      const endpoint = () => (state.fetchable && endpointOf('fetchable')) || endpointOf('search') || (connector.endpoints || []).find((e) => e.response && e.response.format === 'geonetwork') || (connector.endpoints || [])[0] || null;
      const log = (m, k) => { if (api.log) api.log(m, k); };
      /** What the post links to that the app can fetch. */
      const fetchable = (rec) => SERVICES.some((s) => rec[s.column]) || !!(rec.nedladdning || rec.atom || rec.wms);

      async function search() {
        const ep = endpoint();
        const q = state.q.trim();
        if (!ep || !q || state.loading) return;
        if (abort) abort.abort();
        abort = new AbortController();
        state.loading = true; state.error = ''; state.rows = null; state.problems.clear(); state.feeds.clear(); closeMaps(); render();
        try {
          const table = await runner.fetchTable(connector, ep, { q }, { signal: abort.signal, firstPageOnly: true });
          let rows = table.rows.map((r) => { const o = {}; table.columns.forEach((c, i) => { o[c] = r[i]; }); return o; });
          // A catalogue without the filtered search is filtered here.
          if (state.fetchable && ep.id !== 'fetchable') rows = rows.filter(fetchable);
          state.rows = rows;
          state.total = (table.meta && table.meta.total) || rows.length;
          log(t('geoportal.found', { n: i18n.formatNumber(state.total), q }), 'ok');
        } catch (err) {
          if (!(err && err.kind === 'aborted')) { state.error = (err && err.message) || String(err); log(`${connector.name}: ${state.error}`, 'error'); }
        }
        state.loading = false; abort = null; render();
      }

      /** Something a post's service or file did: the bridge's text when the browser could not read it, else the error. */
      function problem(rec, url, err) {
        const host = hostOf(url);
        const text = unreachable(err) ? t('api.err.nocors', { host }) : String((err && err.message) || err);
        state.problems.set(rec.id, { text, bridge: unreachable(err) });
        log(`${rec.titel || rec.id}: ${text}`, 'warn');
      }

      /** The form of a geodata source with the address filled in; it asks for the host when it is sent. */
      function add(rec, svc) {
        const url = String(rec[svc.column] || '');
        if (!url) return;
        if (actions.add) { actions.add(svc.family, url, rec); return; }
        D.ensure(['sources'], () => D.require('ui/api/family-dialog')).then((dlg) => dlg.open(null, { group: 'geodata', family: svc.family, values: { baseUrl: url }, perHost: true }))
          .then((c) => { if (c && api.onConnector) api.onConnector(c); })
          .catch((err) => overlays.toast.show(String((err && err.message) || err), { kind: 'error' }));
      }

      /** Fetch a file (consent for its host) and hand it to the import wizard. */
      async function download(rec, url) {
        if (state.busy) return;
        state.busy = rec.id + ':file:' + url; state.problems.delete(rec.id); render();
        try {
          const file = await D.require('io/url-import').fetchFile(url, { perHost: true });
          if (actions.open) actions.open(file, url);
          else window.open(String(url), '_blank', 'noopener');
        } catch (err) {
          if (!(err && err.name === 'ConsentError')) problem(rec, url, err);
        }
        state.busy = ''; render();
      }

      /** Read an ATOM feed (consent for its host) and list its files under the post. */
      async function openFeed(rec, url) {
        if (state.busy) return;
        state.busy = rec.id + ':feed:' + url; state.problems.delete(rec.id); render();
        try {
          const file = await D.require('io/url-import').fetchFile(url, { perHost: true });
          const feed = atomFeed(await file.text(), url);
          state.feeds.set(rec.id, Object.assign({ url }, feed));
        } catch (err) {
          if (!(err && err.name === 'ConsentError')) problem(rec, url, err);
        }
        state.busy = ''; render();
      }

      /** The WMS service's layers (consent for its host), then the first one on a small map in the card. */
      async function showMap(rec) {
        const url = String(rec.wms || '');
        if (!url || state.busy) return;
        state.busy = rec.id + ':map'; state.problems.delete(rec.id); render();
        try {
          const layers = await leaflet.wmsLayers(url, { perHost: true });
          const entry = { url, layers, layer: layers[0].id, handle: null, el: h('div', { class: 'dm-geoportal-map', 'data-geoportal-map': rec.id }) };
          const old = state.maps.get(rec.id);
          if (old && old.handle) old.handle.finalize();
          state.maps.set(rec.id, entry);
          state.busy = ''; render();
          await drawMap(rec, entry);
          return;
        } catch (err) {
          if (!(err && err.name === 'ConsentError')) problem(rec, url, err);
        }
        state.busy = ''; render();
      }
      /** Draw the chosen layer of a post's WMS over the counties (bundled, nothing fetched for them). */
      async function drawMap(rec, entry) {
        if (entry.handle) { entry.handle.finalize(); entry.handle = null; }
        const name = (entry.layers.find((l) => l.id === entry.layer) || {}).name || entry.layer;
        const layers = [leaflet.wmsLayer({ url: entry.url, layers: entry.layer, transparent: true }, name)];
        const lan = leaflet.boundaryLayer('lan');
        if (lan) layers.push(Object.assign(lan, { style: Object.assign({}, lan.style, { fillOpacity: 0 }) }));
        // The address came from the catalogue: the map asks for its host (viz/leaflet `received`), not for background maps at large.
        const chart = { map: { basemap: 'none', layers, legend: false, received: true } };
        try {
          entry.handle = await leaflet.render(entry.el, chart, Object.assign({ height: 280 }, api.tileFactory ? { tileFactory: api.tileFactory } : {}));
          if (entry.handle.info.basemapDenied) { entry.denied = true; render(); }
        } catch (err) { problem(rec, entry.url, err); render(); }
      }
      function closeMaps() { for (const m of state.maps.values()) if (m.handle) m.handle.finalize(); state.maps.clear(); }

      const open = (url) => window.open(String(url), '_blank', 'noopener');
      const busyAt = (key) => state.busy === key;

      function feedList(rec, feed) {
        const items = feed.entries.flatMap((e) => e.files.map((f) => h('li', { class: 'dm-row-wrap', 'data-atom-file': f.url },
          h('span', { class: 'dm-truncate', text: e.title || f.title || f.url }), h('dm-badge', { text: formatOf(f) }),
          basic.button({ label: t('geoportal.download'), icon: 'download', size: 'sm', title: f.url, loading: busyAt(rec.id + ':file:' + f.url), onClick: () => download(rec, f.url) })))
          .concat(e.feeds.map((f) => h('li', { class: 'dm-row-wrap', 'data-atom-feed': f.url },
            h('span', { class: 'dm-truncate', text: e.title || f.title || f.url }),
            basic.button({ label: t('geoportal.atom.open'), icon: 'folder-open', size: 'sm', variant: 'ghost', title: f.url, loading: busyAt(rec.id + ':feed:' + f.url), onClick: () => openFeed(rec, f.url) })))));
        return h('div', { class: 'dm-stack-sm dm-geoportal-feed', 'data-atom': feed.url },
          h('p', { class: 'dm-help dm-xs', text: t('geoportal.atom.title', { title: feed.title || feed.url }) }),
          items.length ? h('ul', { class: 'dm-geoportal-links' }, items) : h('p', { class: 'dm-help dm-xs', text: t('geoportal.atom.empty') }));
      }
      function mapBlock(rec, entry) {
        const sel = /** @type {any} */ (h('dm-select', { label: t('geoportal.map.layer'), inline: true }));
        sel.options = entry.layers.map((l) => ({ value: l.id, label: l.name }));
        sel.value = entry.layer;
        sel.addEventListener('change', () => { entry.layer = sel.value; drawMap(rec, entry); });
        return h('div', { class: 'dm-stack-sm' }, entry.layers.length > 1 ? sel : null, entry.el,
          entry.denied ? h('p', { class: 'dm-help dm-xs', text: t('geoportal.map.denied') }) : null);
      }

      function card(rec) {
        const abstract = String(rec.beskrivning || '');
        const buttons = [];
        for (const svc of SERVICES) if (rec[svc.column]) buttons.push(basic.button({ label: t(svc.key), icon: 'plus', size: 'sm', variant: buttons.length ? 'default' : 'primary', title: t('geoportal.add.hint', { url: String(rec[svc.column]) }), 'data-geoportal-add': svc.family, onClick: () => add(rec, svc) }));
        if (rec.nedladdning) buttons.push(basic.button({ label: t('geoportal.download'), icon: 'download', size: 'sm', title: t('geoportal.download.hint', { url: String(rec.nedladdning) }), 'data-geoportal-download': '', loading: busyAt(rec.id + ':file:' + rec.nedladdning), onClick: () => download(rec, String(rec.nedladdning)) }));
        if (rec.atom) buttons.push(basic.button({ label: t('geoportal.download'), icon: 'download', size: 'sm', title: t('geoportal.atom.hint', { url: String(rec.atom) }), 'data-geoportal-atom': '', loading: busyAt(rec.id + ':feed:' + rec.atom), onClick: () => openFeed(rec, String(rec.atom)) }));
        if (rec.wms) buttons.push(basic.button({ label: t('geoportal.map'), icon: 'map', size: 'sm', title: t('geoportal.map.hint', { url: String(rec.wms) }), 'data-geoportal-map-button': '', loading: busyAt(rec.id + ':map'), onClick: () => showMap(rec) }));
        if (rec.wms) buttons.push(basic.button({ label: t('geoportal.copy.wms'), icon: 'copy', size: 'sm', variant: 'ghost', title: t('geoportal.copy.wms.hint'), onClick: () => copy(rec.wms) }));
        if (rec.metadata) buttons.push(basic.button({ label: t('geoportal.metadata'), icon: 'external-link', size: 'sm', variant: 'ghost', title: t('geoportal.metadata.hint'), onClick: () => open(rec.metadata) }));
        let links = [];
        try { links = rec.lankar ? JSON.parse(String(rec.lankar)) : []; } catch (_e) { links = []; }
        const known = new Set([rec.wfs, rec.ogc_api, rec.arcgis, rec.wms, rec.nedladdning, rec.atom].filter(Boolean).map(String));
        const other = links.filter((l) => l && l.url && !known.has(String(l.url)));
        const trouble = state.problems.get(rec.id);
        const feed = state.feeds.get(rec.id);
        const map = state.maps.get(rec.id);
        const restricted = rec.begransad === true || rec.begransad === 'true' || rec.begransad === 1;
        return h('div', { class: 'dm-card dm-stack-sm dm-geoportal-card', 'data-geoportal-post': String(rec.id || '') },
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: String(rec.titel || rec.id || '') }), rec.typ ? h('dm-badge', { text: String(rec.typ) }) : null,
            restricted ? h('dm-badge', { kind: 'warn', text: t('geoportal.restricted'), 'data-tip': rec.villkor ? String(rec.villkor) : t('geoportal.restricted.hint'), 'data-geoportal-restricted': '' }) : null),
          rec.organisation ? h('p', { class: 'dm-help dm-xs', text: String(rec.organisation) }) : null,
          abstract ? h('p', { class: 'dm-small', text: abstract.length > ABSTRACT_MAX ? abstract.slice(0, ABSTRACT_MAX - 1) + '…' : abstract }) : null,
          restricted && rec.villkor ? h('p', { class: 'dm-help dm-xs', text: t('geoportal.restricted.text', { text: String(rec.villkor).slice(0, 240) }) }) : null,
          buttons.length ? h('div', { class: 'dm-row-wrap' }, buttons) : h('p', { class: 'dm-help dm-xs', text: t('geoportal.noservice') }),
          trouble ? h('div', { class: 'dm-stack-sm', 'data-geoportal-problem': '' }, h('p', { class: 'dm-error dm-small', text: trouble.text }),
            trouble.bridge && actions.bridge ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('geoportal.bridge'), icon: 'hard-drive', size: 'sm', title: t('bridge.hint'), onClick: () => actions.bridge() })) : null) : null,
          feed ? feedList(rec, feed) : null,
          map ? mapBlock(rec, map) : null,
          other.length ? h('details', { class: 'dm-more' }, h('summary', { text: t('geoportal.links', { n: other.length }) }), h('ul', { class: 'dm-geoportal-links' }, other.slice(0, 20).map((l) => h('li', null, l.protocol ? h('span', { class: 'dm-muted dm-xs', text: String(l.protocol) + ' ' }) : null, h('a', { href: String(l.url), target: '_blank', rel: 'noopener', class: 'dm-break', text: String(l.name || l.url) }))))) : null);
      }
      async function copy(text) {
        try { await navigator.clipboard.writeText(String(text)); overlays.toast.show(t('geoportal.copied'), { kind: 'ok' }); }
        catch (_err) { overlays.toast.show(String(text), { timeout: 15000 }); }
      }

      function render() {
        const input = /** @type {any} */ (h('dm-input', { label: t('geoportal.query'), placeholder: t('geoportal.query.placeholder') }));
        input.value = state.q;
        input.addEventListener('input', () => { state.q = input.value; });
        input.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') search(); });
        const only = /** @type {any} */ (h('dm-switch', { label: t('geoportal.fetchable'), title: t('geoportal.fetchable.hint'), 'data-geoportal-fetchable': '' }));
        only.checked = state.fetchable;
        only.addEventListener('change', () => { state.fetchable = !!only.checked; if (state.rows) search(); });
        const nodes = [
          h('div', { class: 'dm-row-end dm-geoportal-search' }, input, basic.button({ label: t('geoportal.search'), icon: 'search', variant: 'primary', loading: state.loading, onClick: search })),
          only,
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
      function destroy() { if (abort) abort.abort(); closeMaps(); }
      return { el, start, destroy, state, search, connector: connector.id };
    }
    return { create, atomFeed };
  });
})();
