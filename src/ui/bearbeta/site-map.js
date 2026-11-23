// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The place of a new building on a map (decision B-64, the brief's step 1 in F43 b): the dataset whose facts go into the brief
 * (a footprint from Lantmäteriet's building layer, a point, a plan) drawn close up, with a choice of background map so that
 * the person can switch to an orthophoto and see the building from above while placing it. The map is drawn when the person
 * opens it, and nothing is fetched until a background map is chosen and the consent for background maps is given. In Sweden
 * the choice is Lantmäteriet's orthophoto, read once for the place and SITE_SIDE metres around it (ui/viz/basemap-choice
 * `drawView`, after the consent for API fetches and with the key of the connector lantmateriet-stac); the image shown can be kept
 * as a raster (*Spara ortofotot*). A raster of the workspace that covers the place (a saved orthophoto, a drone's picture) is a
 * background of its own, drawn from its own pictures without the net: nothing is asked or fetched. The background chosen for a
 * place is remembered for its dataset (ui/viz/basemap-memory) and is there again when the person comes back to it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/site-map', ['ui/base', 'viz/leaflet', 'data/datasets', 'ui/viz/basemap-choice', 'ui/viz/basemap-memory', 'ui/overlays'], (base, leaflet, datasets, basemapChoice, memory, overlays) => {
    const { h, t, replace } = base;
    /** Close enough to see a house on an orthophoto. */
    const FIT_ZOOM = 19;
    const HEIGHT = 260;
    /** Sweden's orthophoto is read for a square of at least this many metres around the place, so the map can be moved a little. */
    const SITE_SIDE = 250;
    /** A raster's attribution with its licence, as its facts say it. */
    const creditOf = (raster) => {
      const licence = raster && raster.license && raster.license.name ? String(raster.license.name) : '';
      const text = raster && raster.attribution ? String(raster.attribution) : '';
      return text ? text + (licence ? ` (${licence})` : '') : licence;
    };

    /**
     * @param {any} ctx shell context (its store and shell open a saved raster; neither is needed)
     * @param {{tileFactory?: Function}} [options] tileFactory for tests (no tiles are fetched)
     * @returns {{el: HTMLElement, setDataset: (id: string) => void, choose: (id: string) => Promise<boolean>, refresh: () => void, draw: () => Promise<void>, destroy: () => void, state: any, readonly handle: any}}
     */
    function create(ctx, options = {}) {
      const s = { datasetId: '', basemap: 'none', orthos: [], rasters: [], note: '', drawn: false, load: false, image: '' };
      const el = /** @type {HTMLDetailsElement} */ (h('details', { class: 'dm-more', 'data-site-map': '' }));
      const head = h('summary', { text: t('map.site') });
      const bar = h('div', { class: 'dm-row-wrap' });
      const noteEl = h('p', { class: 'dm-help dm-xs', 'data-site-map-note': '' });
      const mapEl = h('div', { 'aria-label': t('map.site'), 'data-site-map-view': '' });
      el.append(head, h('div', { class: 'dm-stack-xs' }, h('p', { class: 'dm-help dm-xs', text: t('map.site.hint') }), bar, mapEl, noteEl));
      let handle = null; let seq = 0;
      /**
       * The background map remembered for the place, read when the dataset is set and awaited by the drawing; `picks` counts the
       * datasets set and the choices made, so that one read late does not undo a choice. `restored`: checked against the
       * choices that cover the place once they are known.
       */
      let restoring = null; let picks = 0; let restored = false;
      el.addEventListener('toggle', () => { if (el.open && !s.drawn) draw(); });
      /** A saved raster opens in Bearbeta, when the panel lives in the app. */
      const onOpen = ctx && ctx.store && ctx.shell ? (meta) => { ctx.store.set({ selectedId: meta.id }); ctx.shell.activate('bearbeta'); } : undefined;

      function renderBar() {
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true, 'data-site-map-basemap': '' }));
        sel.options = [{ value: 'none', label: t('map.basemap.none') }, { value: 'osm', label: t('map.basemap.osm') }].concat(s.orthos, s.rasters);
        sel.value = s.basemap;
        sel.addEventListener('change', async () => { if (!(await choose(sel.value))) sel.value = s.basemap; });
        // The orthophoto read for the place can be kept as a raster, from the image shown.
        const shownImage = s.image === 'drawn' || s.image === 'kept';
        replace(bar, sel, shownImage ? basemapChoice.saveButton(() => handle, { size: 'sm', onOpen }) : null);
        noteEl.textContent = s.note;
      }
      /** Switch the background map; an orthophoto with a key asks for it first. Resolves false when the person cancelled. */
      async function choose(id) {
        // A raster of the workspace needs no key and no consent: its pictures are in its own file.
        if (!String(id).startsWith(basemapChoice.RASTER) && !(await basemapChoice.ensure(id))) return false;
        picks++; restored = false;
        s.basemap = id;
        memory.remember('site', s.datasetId, { basemap: id });
        // Sweden's orthophoto is read because the person chose it.
        s.load = basemapChoice.isView(id);
        await draw();
        return true;
      }
      /** The raster chosen as the background, or null (and the background back to none when it is gone). */
      async function backgroundRaster() {
        if (!s.basemap.startsWith(basemapChoice.RASTER)) return null;
        const meta = await datasets.get(s.basemap.slice(basemapChoice.RASTER.length)).catch(() => null);
        if (meta && meta.raster) return meta;
        s.basemap = 'none';
        return null;
      }
      async function draw() {
        const my = ++seq;
        s.drawn = true;
        if (handle) { handle.finalize(); handle = null; }
        mapEl.replaceChildren();
        s.note = '';
        try {
          if (restoring) await restoring;
          const meta = s.datasetId ? await datasets.get(s.datasetId) : null;
          const layer = meta ? leaflet.layerFor(await datasets.columns(meta.id), meta, 0) : null;
          const raster = layer ? await backgroundRaster() : null;
          if (my !== seq) return;
          if (!layer) { s.orthos = []; s.rasters = []; s.image = ''; s.note = t('map.site.none'); renderBar(); return; }
          // Under the place: a raster's pictures with no background map, or the background map chosen.
          const layers = raster ? [leaflet.rasterLayer(raster), layer] : [layer];
          const chart = { kind: 'map', name: meta.name, map: { layers, basemap: raster ? 'none' : s.basemap, custom: { url: '', attribution: '' }, legend: false, height: HEIGHT } };
          const hd = await leaflet.render(mapEl, chart, { height: HEIGHT, fitMaxZoom: FIT_ZOOM, tileFactory: options.tileFactory });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          // The orthophotos that cover the place (none in Sweden and Norway, whose orthophoto services are not open data), and the
          // rasters of the workspace that do.
          const b = hd.map.getBounds();
          const box = { minX: b.getWest(), minY: b.getSouth(), maxX: b.getEast(), maxY: b.getNorth() };
          s.orthos = await basemapChoice.options({ box });
          s.rasters = await basemapChoice.rasterChoices(box);
          if (my !== seq) return;
          // A remembered background that does not cover the place (or is gone) gives way to none.
          if (restored) {
            restored = false;
            if (memory.within(s.basemap, [{ value: 'osm' }].concat(s.orthos, s.rasters)) !== s.basemap) { s.basemap = 'none'; return draw(); }
          }
          s.image = '';
          if (hd.info.basemapView) {
            const load = s.load; s.load = false;
            s.image = await basemapChoice.drawView(hd, { load, minSide: SITE_SIDE, redraw: () => { s.load = true; draw(); } });
            if (my !== seq) return;
          }
          const notes = [];
          if (raster) notes.push(t('raster.shown', { name: raster.name, attribution: creditOf(raster.raster) }).trim());
          else if (!s.orthos.length) notes.push(t('map.site.ortho.none'));
          if (hd.info.basemapDenied) notes.push(t('map.basemap.denied'));
          if (hd.info.basemapKey) notes.push(basemapChoice.keyNotice(hd.info));
          if (hd.info.basemapImage) notes.push(t('ortho.se.shown', { years: hd.info.basemapImage.years.join(', '), resolution: base.i18n.formatNumber(hd.info.basemapImage.resolution, { maximumFractionDigits: 2 }) }));
          s.note = notes.join(' ');
          renderBar();
        } catch (err) {
          if (my !== seq) return;
          s.note = String((err && err.message) || err);
          renderBar();
          overlays.toast.show(s.note, { kind: 'error' });
        }
      }
      /**
       * The dataset whose place is shown, drawn when the map is open; a place starts with the background map it had last, or
       * none (ui/viz/basemap-memory asks nothing). @param {string} id
       */
      function setDataset(id) {
        if ((id || '') === s.datasetId) return;
        s.datasetId = id || ''; s.drawn = false; s.basemap = 'none'; s.image = ''; restored = false;
        const mine = ++picks; const datasetId = s.datasetId;
        restoring = datasetId ? memory.recall('site', datasetId).then((kept) => { if (kept && mine === picks) { s.basemap = kept.basemap; restored = kept.basemap !== 'none'; } }).catch((err) => D.log('basemaps', err)) : null;
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
