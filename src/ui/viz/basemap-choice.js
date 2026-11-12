// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The orthophotos in the maps' choice of background map (decision B-64), shared by the map in Bearbeta, the map views in
 * Visualisera, the plan map and the place of a new building: the choices for a grid and an area, and the key that a provider
 * asks for, entered in the credentials panel (ui/api/auth-panel) and kept in api/secrets. Choosing an orthophoto contacts
 * nothing; the map asks the consent for background maps before its first tile.
 * Sweden's orthophoto (Lantmäteriet's files, api/orthophoto-cog) is one image over what the map shows: `drawView` reads it when
 * the person chose it or asked for the view, after the consent for API fetches and with the key of the connector
 * lantmateriet-stac, and lays it under the features; a map drawn again over the same view takes the image read before.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/basemap-choice', ['ui/base', 'ui/overlays', 'ui/api/auth-panel', 'viz/orthophotos', 'api/connectors', 'api/orthophoto-cog', 'platform/text'], (base, overlays, authPanel, orthophotos, connectors, cog, text) => {
    const { h, t } = base;

    /**
     * The orthophoto choices {value, label} for a map: those that can be drawn in its grid (an EPSG code, 0 or missing for
     * Web Mercator) and, when a box {minX, minY, maxX, maxY} in degrees is given, those that cover it.
     * @param {{grid?: number, box?: any}} [where] @returns {Promise<Array<{value: string, label: string}>>}
     */
    async function options(where = {}) {
      let list = [];
      try { list = await orthophotos.list(); } catch (err) { D.log('basemaps', err); return []; }
      const code = where.grid || 3857;
      return orthophotos.covering(list, where.box || null).filter((b) => orthophotos.sourceFor(b, code)).map((b) => ({ value: b.id, label: t('map.basemap.' + b.id) }));
    }

    /**
     * Make a chosen background map ready: an orthophoto that needs a key asks for it once per session (or unlocks a saved
     * one). Resolves true when the map can be drawn with it, false when the person cancelled.
     * @param {string} id the background map's id
     */
    async function ensure(id) {
      if (!orthophotos.isPreset(id)) return true;
      const preset = await orthophotos.get(id);
      if (!preset) return false;
      if (orthophotos.ready(preset)) return true;
      let connector;
      if (preset.key.connector) {
        // Sweden: the client credentials of the Lantmäteriet connector, the same key as the height model's.
        const own = await connectors.get(preset.key.connector);
        if (!own) return false;
        connector = Object.assign({}, own, { auth: Object.assign({}, own.auth, { help: t('ortho.se.key.help', { hosts: hostsOf(own).join(', ') }), signupUrl: preset.key.signupUrl }) });
      } else connector = orthophotos.connector(preset, t('map.basemap.key.help', { name: preset.name, publisher: preset.publisher, host: hostOf(preset) }));
      let panel = null;
      const done = await overlays.dialog.open({
        title: t('map.basemap.key', { name: t('map.basemap.' + preset.id) }),
        help: 'kartor#ortofoton',
        body: (finish) => {
          panel = authPanel.create(connector, { onChange: () => { if (orthophotos.ready(preset)) finish(true); } });
          return h('div', { class: 'dm-stack-sm', 'data-basemap-key': preset.id }, panel.el,
            h('p', { class: 'dm-help dm-xs', text: t('map.basemap.licence', { attribution: orthophotos.attributionText(preset) }) }));
        },
        actions: [{ label: t('common.cancel'), value: false }],
      });
      if (panel) panel.destroy();
      return done === true && orthophotos.ready(preset);
    }
    function hostOf(preset) { try { return new URL(orthophotos.sourceFor(preset, 3857).url).host; } catch (_e) { return ''; } }
    /** The hosts a connector's key goes to: the token's and the file host's. */
    function hostsOf(connector) {
      const out = [];
      try { if (connector.auth && connector.auth.tokenUrl) out.push(new URL(connector.auth.tokenUrl).host); } catch (_e) { /* no token address */ }
      return out.concat((connector.files && connector.files.hosts) || []);
    }

    /** A sentence for a map that drew without its orthophoto because the key is missing (`info.basemapKey`), or ''. */
    function keyNotice(info) {
      return info && info.basemapKey ? t('map.basemap.key.missing', { name: t('map.basemap.' + info.basemapKey) }) : '';
    }

    /**
     * Tell the person that a map drew without its orthophoto for want of a key, with a button that asks for the key and then
     * calls `redraw`. Does nothing when the key was not missing.
     * @param {any} info the map's info @param {() => any} redraw
     */
    function notifyKey(info, redraw) {
      const id = info && info.basemapKey;
      if (!id) return;
      overlays.toast.show(keyNotice(info), { kind: 'warn', timeout: 12000, action: { label: t('map.basemap.key.enter'), onClick: () => { ensure(id).then((ok) => { if (ok) redraw(); }).catch((err) => D.log('basemaps', err)); } } });
    }

    // ---- Sweden: one image for the view ---------------------------------------------------------------------
    /** True when a background map id is drawn as one image over the view (Sweden's files), not as tiles. @param {string} id */
    function isView(id) { return orthophotos.isView(orthophotos.cached().find((b) => b.id === id)); }
    /** Images read in this session by grid and box, so that a map drawn again over the same view reads nothing anew. */
    const images = new Map();
    const KEEP = 4;
    function remember(key, result) {
      images.set(key, result);
      while (images.size > KEEP) { const first = images.keys().next().value; cog.release(images.get(first)); images.delete(first); }
    }
    /** The image layer on each map, so that a new view replaces the old one. */
    const layers = new WeakMap();
    /**
     * The box to read for a map's view, in degrees [west, south, east, north]: the view, widened around its centre to at least
     * `minSide` metres a side (the place of a building is read with its surroundings).
     */
    function viewBox(map, minSide) {
      const b = map.getBounds();
      let box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      if (minSide > 0) {
        const lat = (box[1] + box[3]) / 2; const lon = (box[0] + box[2]) / 2;
        const dLat = minSide / 2 / 111320; const dLon = minSide / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
        box = [Math.min(box[0], lon - dLon), Math.min(box[1], lat - dLat), Math.max(box[2], lon + dLon), Math.max(box[3], lat + dLat)];
      }
      return box;
    }
    const boxKey = (grid, box) => grid + ':' + box.map((v) => v.toFixed(5)).join(',');

    /**
     * Sweden's orthophoto under the features of a map whose background map is it (`handle.info.basemapView`). An image read
     * before for the same view and grid is laid again without contacting anything; a new one is read only with `load` (the
     * person chose the orthophoto or asked for the view). Problems are told in a toast: a missing key with the button that asks
     * for it (then `redraw`), a view that is too large or outside Sweden, a refused consent or file.
     * @param {any} handle viz/leaflet's handle
     * @param {{load?: boolean, minSide?: number, redraw?: () => any, quiet?: boolean}} [opts] quiet: no toasts (the caller says it)
     * @returns {Promise<string>} 'drawn', 'kept', 'idle' (not read without the person's action), 'key', 'large', 'outside', 'none',
     *   'denied', 'failed', or '' when the map's background is no such orthophoto
     */
    async function drawView(handle, opts = {}) {
      const id = handle && handle.info && handle.info.basemapView;
      if (!id) return '';
      const preset = await orthophotos.get(id);
      if (!preset) return '';
      const map = handle.map;
      const grid = handle.crs === 3006 ? 3006 : 3857;
      const box = viewBox(map, opts.minSide || 0);
      const key = boxKey(grid, box);
      let result = images.get(key) || null;
      let status = result ? 'kept' : 'drawn';
      const say = (text, kind, action) => { if (!opts.quiet) overlays.toast.show(text, Object.assign({ kind, timeout: 9000 }, action ? { action } : {})); };
      if (!result) {
        if (!opts.load) return orthophotos.ready(preset) ? 'idle' : 'key';
        // Without the key nothing is contacted; the map's own drawing has already said so when it knew (`info.basemapKey`).
        if (!orthophotos.ready(preset)) {
          if (!opts.quiet && handle.info.basemapKey !== id) notifyKey({ basemapKey: id }, opts.redraw || (() => drawView(handle, Object.assign({}, opts, { load: true }))));
          return 'key';
        }
        // The output as large as the box on the screen, in the screen's own pixels.
        const nw = map.latLngToContainerPoint([box[3], box[0]]); const se = map.latLngToContainerPoint([box[1], box[2]]);
        const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
        const busy = opts.quiet ? null : overlays.toast.show(t('ortho.se.loading'), { kind: 'info', timeout: 0 });
        try {
          result = await cog.load(box, { grid, width: Math.abs(se.x - nw.x) * dpr, height: Math.abs(se.y - nw.y) * dpr });
        } catch (err) {
          const code = err && err.name === 'ConsentError' ? 'denied' : (err && err.code) || 'failed';
          if (code === 'denied') say(t('ortho.se.denied'), 'warn');
          else say(String((err && err.message) || err), code === 'failed' || code === 'file' ? 'error' : 'warn');
          D.log('basemaps', err);
          return code === 'file' ? 'failed' : code;
        } finally { if (busy) busy.remove(); }
        if (result.needsKey) { if (!opts.quiet) notifyKey({ basemapKey: id }, opts.redraw || (() => drawView(handle, Object.assign({}, opts, { load: true })))); return 'key'; }
        remember(key, result);
      }
      // The map may have been closed while the image was read.
      if (!map._mapPane || !map.getContainer().isConnected) return status;
      const L = /** @type {any} */ (globalThis).L;
      const old = layers.get(map);
      if (old) map.removeLayer(old);
      // Lantmäteriet's terms: the product, © Lantmäteriet, the year, that the image was processed (resampled and placed on the
      // map) and the licence.
      const attribution = `${orthophotos.attributionHtml(Object.assign({}, preset, { attribution: result.attribution }))}, ${text.escapeHtml(t('ortho.se.processed'))}`;
      const layer = L.imageOverlay(result.url, L.latLngBounds(result.bounds[0], result.bounds[1]), { pane: 'tilePane', interactive: false, alt: t('map.basemap.' + id), attribution, className: 'dm-ortho-image' });
      layer.addTo(map);
      layers.set(map, layer);
      handle.info.basemapImage = { years: result.years, resolution: result.resolution, items: result.items.length };
      return status;
    }

    return { options, ensure, keyNotice, notifyKey, isView, drawView, viewBox };
  });
})();
