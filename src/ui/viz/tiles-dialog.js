// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dialog that picks map tiles from an OGC API – Tiles service, for a map view's background or a layer: the person gives
 * the landing page, reads the service (after consent "basemaps"), picks a collection and a tile set, and gets the tile
 * definition that viz/leaflet draws (`def.tiles`, a layer of kind "tiles"). Sets the map cannot draw (vector tiles, grids
 * other than Web Mercator) are listed with the reason.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/tiles-dialog', ['ui/base', 'ui/basic', 'ui/overlays', 'api/ogc-tiles', 'viz/leaflet'], (base, basic, overlays, ogcTiles, leaflet) => {
    const { h, t, replace } = base;

    /** One line about a tile definition for the map views' settings: service, collection and tile set. */
    function summary(tiles) {
      if (!tiles || !tiles.template) return '';
      return [tiles.serviceTitle || tiles.url, tiles.collectionTitle || tiles.collection, tiles.tileset].filter(Boolean).join(' · ');
    }

    /**
     * Open the dialog; resolves with the tile definition {url, collection, collectionTitle, serviceTitle, tileset, title, template,
     * format, minNativeZoom, maxNativeZoom, attribution}, or null when cancelled or nothing drawable was chosen.
     * @param {any} [current] the definition to start from
     * @param {{fetch?: Function}} [options] tests may pass their own fetch
     */
    async function open(current, options = {}) {
      const cur = current || {};
      const state = { service: null, source: null, sets: [], set: null, resolved: null, busy: null };
      /** @type {any} */ let reader = null;
      const field = (label, value, attrs) => { const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs || {}))); el.value = value || ''; return el; };
      const url = field(t('map.tiles.url'), cur.url, { placeholder: 'https://…/ogcapi', help: t('map.tiles.url.help'), 'data-tiles-url': '' });
      const attribution = field(t('map.custom.attribution'), cur.attribution, { 'data-tiles-attribution': '' });
      const sources = h('div', { 'data-tiles-sources': '' });
      const sets = h('div', { 'data-tiles-sets': '' });
      const note = h('p', { class: 'dm-help dm-small', 'data-tiles-note': '', 'aria-live': 'polite' });
      const say = (text, error) => { note.textContent = text || ''; note.className = error ? 'dm-error dm-small' : 'dm-help dm-small'; };
      const message = (err) => String((err && err.message) || err);

      /** Resolve the chosen tile set into a template, or say why it cannot be drawn. */
      async function pickSet(set) {
        state.set = set; state.resolved = null;
        if (!set) { say(''); return; }
        say(t('common.loading'));
        try {
          const r = await ogcTiles.resolve(set, state.service, reader);
          if (state.set !== set) return;
          state.resolved = r;
          if (!attribution.value && r.attribution) attribution.value = r.attribution;
          say(t('map.tiles.ready', { tms: set.id, min: r.minNativeZoom, max: r.maxNativeZoom }));
        } catch (err) { if (state.set === set) say(message(err), true); }
      }
      /** List a source's tile sets; the first one the map can draw is chosen. */
      async function pickSource(src) {
        state.source = src; state.sets = []; state.resolved = null; replace(sets); say('');
        if (!src) return;
        say(t('common.loading'));
        try {
          const list = await ogcTiles.tilesets(src, reader);
          if (state.source !== src) return;
          state.sets = list;
          const sel = basic.select(t('map.tiles.set'), list.map((s, i) => ({ value: String(i), label: s.webMercator ? s.title : t('map.tiles.set.other', { name: s.title }) })), '0', (v) => { state.busy = pickSet(list[Number(v)]); }, { 'data-tiles-set': '' });
          const start = Math.max(0, list.findIndex((s) => s.id === cur.tileset));
          sel.value = String(start);
          replace(sets, sel);
          await pickSet(list[start]);
        } catch (err) { if (state.source === src) say(message(err), true); }
      }
      /** Read the service from its landing page: the sources of tiles in a list, the collection the address named first. */
      async function read() {
        if (!url.value.trim()) return;
        readBtn.setAttribute('loading', '');
        replace(sources); replace(sets); say('');
        state.service = null; state.source = null; state.set = null; state.resolved = null;
        reader = ogcTiles.client({ fetch: options.fetch });
        try {
          const service = await ogcTiles.discover(url.value.trim(), reader);
          state.service = service;
          const list = service.sources;
          const label = (s) => (s.id ? s.title : t('map.tiles.whole', { name: s.title })) + (s.kind === 'vector' ? ' ' + t('map.tiles.vector') : '');
          const wanted = cur.collection || service.collection;
          let start = list.findIndex((s) => s.id === wanted && s.kind !== 'vector');
          if (start < 0) start = Math.max(0, list.findIndex((s) => s.kind !== 'vector'));
          const sel = basic.select(t('map.tiles.collection'), list.map((s, i) => ({ value: String(i), label: label(s) })), String(start), (v) => { state.busy = pickSource(list[Number(v)]); }, { 'data-tiles-collection': '' });
          replace(sources, sel);
          await pickSource(list[start]);
        } catch (err) {
          say(message(err), true);
        }
        readBtn.removeAttribute('loading');
      }
      const readBtn = /** @type {any} */ (basic.button({ label: t('map.tiles.read'), icon: 'refresh-cw', size: 'sm', title: t('map.tiles.read.hint'), 'data-tiles-read': '', onClick: () => { state.busy = read(); } }));
      url.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') { e.preventDefault(); state.busy = read(); } });
      const ok = await overlays.dialog.open({
        title: t('map.tiles.title'),
        help: 'kartor#kartvyer-i-visualisera',
        body: h('div', { class: 'dm-stack', 'data-tiles-dialog': '' }, h('p', { class: 'dm-help', text: t('map.tiles.dialog.hint') }), h('div', { class: 'dm-row-end' }, url, readBtn), sources, sets, note, attribution),
        actions: [{ label: t('common.cancel'), value: false }, { label: t('common.ok'), variant: 'primary', value: true, primary: true }],
      });
      if (!ok) return null;
      // A choice still being read is waited for.
      await state.busy;
      const r = state.resolved;
      const out = r && state.service && state.source ? {
        url: state.service.landing, serviceTitle: state.service.title, collection: state.source.id, collectionTitle: state.source.id ? state.source.title : '',
        tileset: r.tileset, title: state.source.title, template: r.template, format: r.format, minNativeZoom: r.minNativeZoom, maxNativeZoom: r.maxNativeZoom,
        attribution: String(attribution.value || '').trim(),
      } : null;
      if (!out || !leaflet.tilesSource(out)) {
        // Unchanged: the dialog was confirmed without reading the service again.
        if (cur.template && url.value.trim() === (cur.url || '') && !state.service) return Object.assign({}, cur, { attribution: String(attribution.value || '').trim() });
        overlays.toast.show(t('map.tiles.incomplete'), { kind: 'warn' });
        return null;
      }
      return out;
    }
    return { open, summary };
  });
})();
