// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The place of a new building on a map (decision B-64, the brief's step 1 in F43 b): the dataset whose facts go into the brief
 * (a footprint from Lantmäteriet's building layer, a point, a plan) drawn close up, with a choice of background map so that
 * the person can switch to an orthophoto and see the building from above while placing it. The map is drawn when the person
 * opens it, and nothing is fetched until a background map is chosen and the consent for background maps is given. In Sweden
 * the choice is Lantmäteriet's orthophoto, read once for the place and SITE_SIDE metres around it (ui/viz/basemap-choice
 * `drawView`, after the consent for API fetches and with the key of the connector lantmateriet-stac).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/site-map', ['ui/base', 'viz/leaflet', 'data/datasets', 'ui/viz/basemap-choice', 'ui/overlays'], (base, leaflet, datasets, basemapChoice, overlays) => {
    const { h, t, replace } = base;
    /** Close enough to see a house on an orthophoto. */
    const FIT_ZOOM = 19;
    const HEIGHT = 260;
    /** Sweden's orthophoto is read for a square of at least this many metres around the place, so the map can be moved a little. */
    const SITE_SIDE = 250;

    /**
     * @param {any} _ctx shell context
     * @param {{tileFactory?: Function}} [options] tileFactory for tests (no tiles are fetched)
     * @returns {{el: HTMLElement, setDataset: (id: string) => void, choose: (id: string) => Promise<boolean>, refresh: () => void, draw: () => Promise<void>, destroy: () => void, state: any, readonly handle: any}}
     */
    function create(_ctx, options = {}) {
      const s = { datasetId: '', basemap: 'none', orthos: [], note: '', drawn: false, load: false, image: '' };
      const el = /** @type {HTMLDetailsElement} */ (h('details', { class: 'dm-more', 'data-site-map': '' }));
      const head = h('summary', { text: t('map.site') });
      const bar = h('div', { class: 'dm-row-wrap' });
      const noteEl = h('p', { class: 'dm-help dm-xs', 'data-site-map-note': '' });
      const mapEl = h('div', { 'aria-label': t('map.site'), 'data-site-map-view': '' });
      el.append(head, h('div', { class: 'dm-stack-xs' }, h('p', { class: 'dm-help dm-xs', text: t('map.site.hint') }), bar, mapEl, noteEl));
      let handle = null; let seq = 0;
      el.addEventListener('toggle', () => { if (el.open && !s.drawn) draw(); });

      function renderBar() {
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true, 'data-site-map-basemap': '' }));
        sel.options = [{ value: 'none', label: t('map.basemap.none') }, { value: 'osm', label: t('map.basemap.osm') }].concat(s.orthos);
        sel.value = s.basemap;
        sel.addEventListener('change', async () => { if (!(await choose(sel.value))) sel.value = s.basemap; });
        replace(bar, sel);
        noteEl.textContent = s.note;
      }
      /** Switch the background map; an orthophoto with a key asks for it first. Resolves false when the person cancelled. */
      async function choose(id) {
        if (!(await basemapChoice.ensure(id))) return false;
        s.basemap = id;
        // Sweden's orthophoto is read because the person chose it.
        s.load = basemapChoice.isView(id);
        await draw();
        return true;
      }
      async function draw() {
        const my = ++seq;
        s.drawn = true;
        if (handle) { handle.finalize(); handle = null; }
        mapEl.replaceChildren();
        s.note = '';
        try {
          const meta = s.datasetId ? await datasets.get(s.datasetId) : null;
          const layer = meta ? leaflet.layerFor(await datasets.columns(meta.id), meta, 0) : null;
          if (my !== seq) return;
          if (!layer) { s.orthos = []; s.note = t('map.site.none'); renderBar(); return; }
          const chart = { kind: 'map', name: meta.name, map: { layers: [layer], basemap: s.basemap, custom: { url: '', attribution: '' }, legend: false, height: HEIGHT } };
          const hd = await leaflet.render(mapEl, chart, { height: HEIGHT, fitMaxZoom: FIT_ZOOM, tileFactory: options.tileFactory });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          // The orthophotos that cover the place; none in Sweden and Norway, whose orthophoto services are not open data.
          const b = hd.map.getBounds();
          s.orthos = await basemapChoice.options({ box: { minX: b.getWest(), minY: b.getSouth(), maxX: b.getEast(), maxY: b.getNorth() } });
          if (my !== seq) return;
          s.image = '';
          if (hd.info.basemapView) {
            const load = s.load; s.load = false;
            s.image = await basemapChoice.drawView(hd, { load, minSide: SITE_SIDE, redraw: () => { s.load = true; draw(); } });
            if (my !== seq) return;
          }
          const notes = [];
          if (!s.orthos.length) notes.push(t('map.site.ortho.none'));
          if (hd.info.basemapDenied) notes.push(t('map.basemap.denied'));
          if (hd.info.basemapKey) notes.push(basemapChoice.keyNotice(hd.info));
          if (hd.info.basemapImage) notes.push(t('ortho.se.shown', { years: hd.info.basemapImage.years.join(', '), resolution: base.i18n.formatNumber(hd.info.basemapImage.resolution) }));
          s.note = notes.join(' ');
          renderBar();
        } catch (err) {
          if (my !== seq) return;
          s.note = String((err && err.message) || err);
          renderBar();
          overlays.toast.show(s.note, { kind: 'error' });
        }
      }
      /** The dataset whose place is shown; a new place starts without a background map, and is drawn when the map is open. @param {string} id */
      function setDataset(id) {
        if ((id || '') === s.datasetId) return;
        s.datasetId = id || ''; s.drawn = false; s.basemap = 'none';
        if (el.open) draw();
      }
      /** After the panel around it was drawn again: the map measures its box anew. */
      function refresh() { if (handle) handle.refresh(); }
      function destroy() { seq++; if (handle) { handle.finalize(); handle = null; } }
      renderBar();
      return { el, setDataset, choose, refresh, draw, destroy, state: s, get handle() { return handle; } };
    }
    return { create };
  });
})();
