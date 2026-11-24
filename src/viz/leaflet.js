// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Map view with Leaflet 1.9 (vendored, BSD-2-Clause): a chart of kind "map" is a list of layers, each a dataset
 * with a geometry column (GeoJSON or WKT text) or longitude/latitude columns, or one of the bundled boundary sets,
 * drawn with the app's palette (one colour, by category or graduated) over an optional background map, and pictures from a
 * WMS or an OGC API – Tiles service as background or as layers under the features. Tiles come
 * from the net only after consent for the purpose "basemaps"; without a background map nothing leaves the browser. The
 * orthophotos (viz/orthophotos) are background maps too, each with its provider's attribution and, where asked, a key; Sweden's,
 * read from files for a view, is drawn by ui/viz/basemap-choice once the map is there (`info.basemapView`). A raster (the kind
 * raster, B-64) is a layer of its own: each file's preview from the dataset's `_files`, at its place in the tile pane above the
 * background maps and the service layers and under the features, with its attribution; nothing is fetched for it.
 * Export (SVG, PNG, PDF) is drawn headless in Web Mercator by this module, without tiles or rasters; published HTML gets the
 * library inlined and the features as GeoJSON with their styles.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/leaflet', ['viz/theme', 'viz/export', 'viz/data', 'data/datasets', 'data/geo', 'data/boundaries', 'platform/consent', 'viz/orthophotos', 'platform/tier', 'data/dataset-files'], (theme, vizExport, vizData, datasets, geo, boundaries, consent, orthophotos, tier, dsFiles) => {
    const VENDOR = 'vendor/leaflet/';
    const BASEMAPS = ['none', 'osm', 'custom', 'wms', 'tiles'];
    const WMS_DEFAULTS = { url: '', layers: '', format: 'image/png', transparent: false, attribution: '', version: '1.3.0' };
    const OSM = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attributionKey: 'map.attribution.osm', maxZoom: 19 };
    const DEFAULT_VIEW = { center: [62, 15], zoom: 4 };
    const MAX_ROWS = 50000;
    const GEOMETRY_NAMES = /^(geometry|geom|wkt|shape|the_geom|geometri)$/i;
    const LON_NAMES = /^(lon|long|lng|longitude|longitud|x|e|east|easting|ost|öst|x_koord|xkoord|lon_wgs84|longitude_wgs84)$/i;
    const LAT_NAMES = /^(lat|latitude|latitud|y|n|north|northing|nord|y_koord|ykoord|lat_wgs84|latitude_wgs84)$/i;
    /** Words in a column name that mean a coordinate: `ost_koord` does, `kostnad` does not. */
    const LON_TOKENS = new Set(['lon', 'long', 'lng', 'longitude', 'longitud', 'east', 'easting', 'ost', 'öst']);
    const LAT_TOKENS = new Set(['lat', 'latitude', 'latitud', 'north', 'northing', 'nord', 'norr']);
    const hasToken = (name, set) => String(name).replace(/([a-zåäöæø])([A-ZÅÄÖÆØ])/g, '$1 $2').toLowerCase().split(/[^a-zåäöæø0-9]+/).some((word) => set.has(word));
    /** @type {Promise<any>|null} */ let loading = null;
    let cssLinked = false;
    const newId = () => 'ly_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // ---- library ------------------------------------------------------------------------------------------
    function available() { return !!globalThis.L; }
    /**
     * Leaflet's canvas renderer can be asked to draw after its map is gone (a layer removed after the renderer, a move that ends
     * late) and then throws on the deleted context. The vendored file stays as it is; the renderer's prototype skips drawing
     * without a context.
     */
    function guardCanvas(L) {
      const proto = L && L.Canvas && L.Canvas.prototype;
      if (!proto || proto._dmGuarded) return;
      for (const name of ['_redraw', '_update', '_updatePaths', '_draw', '_clear']) {
        const original = proto[name];
        if (typeof original !== 'function') continue;
        proto[name] = function (...args) { if (!this._ctx) { if (name === '_redraw') this._redrawRequest = null; return undefined; } return original.apply(this, args); };
      }
      proto._dmGuarded = true;
    }
    /** Load leaflet.js and leaflet.css from the vendored files (classic script and stylesheet). */
    function ensure() {
      if (!cssLinked && typeof document !== 'undefined') {
        document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: (globalThis.DATASPATIUM_BASE || '') + VENDOR + 'leaflet.css' }));
        cssLinked = true;
      }
      if (globalThis.L) return Promise.resolve(globalThis.L);
      if (!loading) {
        loading = D.assets.loadVendorScript(VENDOR + 'leaflet.js').then(() => {
          if (!globalThis.L) throw new Error(D.t('map.err.load'));
          guardCanvas(globalThis.L);
          return globalThis.L;
        }).catch((err) => { loading = null; throw err; });
      }
      return loading;
    }
    /** @type {Promise<any>|null} */ let projLoading = null;
    /** Load proj4 and Proj4Leaflet (vendored classic scripts) for a map in a grid of its own, on first use. */
    function ensureProj() {
      const g = /** @type {any} */ (globalThis);
      if (g.L && g.L.Proj && g.proj4) return Promise.resolve(g.L);
      if (!projLoading) {
        projLoading = ensure()
          .then(() => (g.proj4 ? null : D.assets.loadVendorScript('vendor/proj4/proj4.js')))
          .then(() => (g.L.Proj ? null : D.assets.loadVendorScript('vendor/proj4leaflet/proj4leaflet.js')))
          .then(() => { if (!g.L.Proj || !g.proj4) throw new Error(D.t('map.err.load')); return g.L; })
          .catch((err) => { projLoading = null; throw err; });
      }
      return projLoading;
    }
    /** Zoom levels of a map in a projected grid: 8192 metres per pixel down to an eighth of a metre, one level per halving. */
    const GRID_RESOLUTIONS = Array.from({ length: 17 }, (_, i) => 8192 / 2 ** i);
    /** The grid's origin (top left), west and north of every coordinate in the Nordic grids the app reads. */
    const GRID_ORIGIN = [-5000000, 10000000];
    /**
     * A Leaflet CRS (L.Proj.CRS) for a projected system the app reads (SWEREF 99 TM and its zones, RT 90 2,5 gon V, the Nordic
     * grids), built from the same parameters as the app's own conversion; null for Web Mercator, degrees and unknown systems.
     * Needs `ensureProj()` first.
     */
    function gridCrs(crs) {
      const def = geo.proj4Def(crs);
      if (!def) return null;
      return new (/** @type {any} */ (globalThis)).L.Proj.CRS('EPSG:' + geo.crsCode(crs), def, { resolutions: GRID_RESOLUTIONS, origin: GRID_ORIGIN });
    }
    /** The library's script and stylesheet as text, for standalone HTML (Publicera). */
    async function source() {
      return { js: await D.assets.loadText('leaflet/leaflet-inline.js'), css: await D.assets.loadText('leaflet/leaflet-inline.css') };
    }

    // ---- definitions -------------------------------------------------------------------------------------
    const numeric = (c) => c.type === 'integer' || c.type === 'number';
    /** Name of the geometry column of a table, or null. */
    function geometryColumn(columns) {
      const text = columns.filter((c) => c.type === 'text');
      const exact = text.find((c) => GEOMETRY_NAMES.test(c.name));
      return exact ? exact.name : ((text.find((c) => /geom|wkt/i.test(c.name)) || {}).name || null);
    }
    /** Longitude and latitude columns of a table, or null. */
    function coordinateColumns(columns) {
      const nums = columns.filter(numeric);
      const lon = nums.find((c) => LON_NAMES.test(c.name)) || nums.find((c) => hasToken(c.name, LON_TOKENS) && !hasToken(c.name, LAT_TOKENS));
      const lat = nums.find((c) => LAT_NAMES.test(c.name)) || nums.find((c) => hasToken(c.name, LAT_TOKENS));
      return lon && lat && lon !== lat ? { lon: lon.name, lat: lat.name } : null;
    }
    /**
     * Whether a table can really be drawn. The names only promise something; the values decide. A geometry column must hold
     * a geometry, and coordinates must lie in degrees or in the range of a projected system. Columns called only x and y
     * count as coordinates when they are projected, because small numbers under those names are usually something else.
     * @param {string} id @returns {Promise<boolean>}
     */
    async function drawable(id) {
      const handle = await datasets.ensureOpen(id);
      const said = handle.meta.facets ? handle.meta.facets.spatial : undefined;
      if (said === false) return false;
      if (said === true && mappable(handle.columns)) return true;
      return drawableByValues(handle);
    }
    /** What the values say, whatever the user has decided. @param {any} handle @returns {Promise<boolean>} */
    async function drawableByValues(handle) {
      const columns = handle.columns;
      const q = (c) => '"' + String(c).replace(/"/g, '""') + '"';
      const named = geometryColumn(columns);
      if (named) {
        const r = await handle.engine.exec(`select ${q(named)} from data where ${q(named)} is not null and ${q(named)} != '' limit 1`);
        const value = r[0] && r[0].values[0] ? r[0].values[0][0] : null;
        if (value === null || geo.parseGeometry(value)) return true;
      }
      const coords = coordinateColumns(columns);
      if (!coords) return false;
      const r = await handle.engine.exec(`select min(${q(coords.lon)}), max(${q(coords.lon)}), min(${q(coords.lat)}), max(${q(coords.lat)}), count(${q(coords.lon)}) from data`);
      const [lonMin, lonMax, latMin, latMax, n] = r[0] ? r[0].values[0] : [null, null, null, null, 0];
      if (!n) return mapDefault(columns);
      const projected = lonMin >= 1e4 && lonMax <= 2e6 && latMin >= 1e6 && latMax <= 1e7;
      const degrees = lonMin >= -180 && lonMax <= 180 && latMin >= -90 && latMax <= 90;
      const onlyLetters = /^[xyen]$/i.test(coords.lon) || /^[xyen]$/i.test(coords.lat);
      return projected || (degrees && !onlyLetters);
    }
    /** True when a table can be drawn on a map (geometry or coordinate columns). */
    function mappable(columns) { return !!(geometryColumn(columns) || coordinateColumns(columns)); }
    function labelColumn(columns, exclude = []) {
      const text = columns.filter((c) => c.type === 'text' && !exclude.includes(c.name) && !GEOMETRY_NAMES.test(c.name));
      return (text.find((c) => /namn|name|kommun|lan|region|titel|title|plats|ort/i.test(c.name) && !/kod|code|nr|nummer/i.test(c.name)) || text[0] || {}).name || null;
    }
    /**
     * A layer for a dataset, or null when it has no geometry.
     * @param {any[]} columns @param {{id: string, name: string, shortName?: string}} dataset @param {number} [index] position for the palette
     */
    function layerFor(columns, dataset, index = 0) {
      const geometry = geometryColumn(columns);
      const coords = geometry ? null : coordinateColumns(columns);
      if (!geometry && !coords) return null;
      const tk = theme.tokens();
      return {
        id: newId(), kind: 'dataset', datasetId: dataset.id, datasetName: dataset.name, datasetShort: dataset.shortName || '', name: dataset.name,
        geometry, lon: coords ? coords.lon : null, lat: coords ? coords.lat : null,
        style: { color: tk.palette[index % tk.palette.length], weight: geometry ? 1.5 : 1, fillOpacity: 0.45, opacity: 0.9, radius: 6 },
        colorBy: { column: null, mode: 'none' }, label: labelColumn(columns, [geometry].filter(Boolean)), popup: [], filters: [], listId: null, visible: true, maxRows: MAX_ROWS,
      };
    }
    /** A layer with one of the bundled boundary sets (data/boundaries). */
    function boundaryLayer(id) {
      const def = boundaries.get(id);
      if (!def) return null;
      const tk = theme.tokens();
      return { id: newId(), kind: 'boundary', boundary: id, name: D.t(def.key), style: { color: tk.muted, weight: 1, fillOpacity: 0.04, opacity: 0.8, radius: 4 }, colorBy: { column: null, mode: 'none' }, label: 'namn', popup: ['namn', 'kod'], visible: true };
    }
    /**
     * An overlay of images from a WMS service (OGC Web Map Service), drawn under the features after consent
     * "basemaps". It has no features: nothing to click, no legend, and it is left out of SVG/PNG/PDF export.
     * @param {{url: string, layers?: string, format?: string, transparent?: boolean, attribution?: string}} wms @param {string} [name]
     */
    function wmsLayer(wms, name) {
      const w = Object.assign({}, WMS_DEFAULTS, { transparent: true }, wms || {});
      w.url = wmsUrl(w.url);
      return { id: newId(), kind: 'wms', name: name || w.layers || 'WMS', wms: w, style: { opacity: 0.8 }, visible: true };
    }
    /**
     * An overlay of raster tiles from an OGC API – Tiles service (api/ogc-tiles resolves the service into the address
     * template), drawn under the features after consent "basemaps" like a WMS layer, in Web Mercator only.
     * @param {{template: string, url?: string, collection?: string, title?: string, attribution?: string}} tiles @param {string} [name]
     */
    function tilesLayer(tiles, name) {
      return { id: newId(), kind: 'tiles', name: name || tiles.title || tiles.collection || 'OGC API – Tiles', tiles: Object.assign({}, tiles), style: { opacity: 1 }, visible: true };
    }
    /** True for the layers of pictures from a service (WMS, OGC API – Tiles): no features, no legend, no export. */
    const imagery = (layer) => layer.kind === 'wms' || layer.kind === 'tiles';
    /**
     * A layer with a raster's pictures (the kind raster, data/raster): each file's preview in Web Mercator at its place, in the
     * tile pane above the background maps and the service layers and under the features. Like a WMS layer it has no features:
     * nothing to click, no legend, and it is left out of SVG/PNG/PDF export, thumbnails and published HTML. Nothing is fetched.
     * @param {{id: string, name: string, shortName?: string}} dataset
     */
    function rasterLayer(dataset) {
      return { id: newId(), kind: 'raster', datasetId: dataset.id, datasetName: dataset.name, datasetShort: dataset.shortName || '', name: dataset.name, style: { opacity: 1 }, visible: true };
    }
    /**
     * Default map definition for a dataset: its one layer, no background map, fit to the layers. A raster gets its pictures and,
     * above them, the outlines of its files (unfilled, named by file).
     */
    function defaultMap(columns, dataset) {
      const rest = { basemap: 'none', custom: { url: '', attribution: '' }, wms: Object.assign({}, WMS_DEFAULTS), view: null, legend: true, height: 480 };
      // data/kinds comes later in the start list than this module, so it is asked for when a map is made.
      if (dataset && D.require('data/kinds').of(dataset).mapLayer === 'raster') {
        const outline = Array.isArray(columns) && columns.some((c) => c.name === 'geometri') ? layerFor(columns, dataset, 0) : null;
        if (outline) { Object.assign(outline, { geometry: 'geometri', lon: null, lat: null, label: 'fil' }); Object.assign(outline.style, { fillOpacity: 0, weight: 1 }); }
        return Object.assign({ layers: [rasterLayer(dataset)].concat(outline ? [outline] : []) }, rest);
      }
      const layer = dataset ? layerFor(columns, dataset, 0) : null;
      return Object.assign({ layers: layer ? [layer] : [] }, rest);
    }

    // ---- colours -------------------------------------------------------------------------------------------
    const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); return m ? '#' + m[1].toLowerCase() : null; };
    const lerp = (a, b, t) => {
      const pa = hex(a) || '#dbe9f6'; const pb = hex(b) || '#08306b';
      const ch = (i) => Math.round(parseInt(pa.slice(1 + i * 2, 3 + i * 2), 16) * (1 - t) + parseInt(pb.slice(1 + i * 2, 3 + i * 2), 16) * t);
      return '#' + [ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    const fmt = (v) => (typeof v === 'number' ? D.require('ui/i18n').formatNumber(v, { maximumFractionDigits: 2 }) : String(v));
    /** A number from a definition, held within lo and hi, or the fallback when it is not a number. */
    const numberIn = (v, lo, hi, fallback) => {
      const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
    };
    /** A map's height in pixels from a definition or an option: a number, never text that reaches a style attribute. */
    const heightOf = (v) => Math.round(numberIn(v, 50, 4000, 480));
    /** The colour of a layer's swatch in the layer list: its fill, else its line, when that is a colour; '' otherwise. */
    const swatchColor = (layer) => { const st = (layer && layer.style) || {}; return theme.cssColor(st.fillColor) || theme.cssColor(st.color) || ''; };
    /**
     * Style function and legend for a layer over its features. Colours from the definition are kept only when they are colours
     * (theme.cssColor), and weights, opacities and radii only as numbers: an imported chart could otherwise put a url() into the
     * page's CSS, an element into the exported SVG or markup into published HTML.
     * @returns {{styleOf: (props: any) => any, legend: Array<{color: string, label: string}>}}
     */
    function styling(layer, features) {
      const tk = theme.tokens();
      const raw = layer.style && typeof layer.style === 'object' ? layer.style : {};
      const st = {
        color: theme.cssColor(raw.color) || tk.palette[0], fillColor: theme.cssColor(raw.fillColor),
        weight: numberIn(raw.weight, 0, 50, 1.5), opacity: numberIn(raw.opacity, 0, 1, 0.9), fillOpacity: numberIn(raw.fillOpacity, 0, 1, 0.45), radius: numberIn(raw.radius, 0, 100, 6),
      };
      const base = (fill) => ({ color: st.color, fillColor: fill || st.fillColor || st.color, weight: st.weight, opacity: st.opacity, fillOpacity: st.fillOpacity, radius: st.radius });
      const by = layer.colorBy || {};
      if (!by.column || by.mode === 'none' || !by.mode) return { styleOf: () => base(null), legend: [{ color: st.fillColor || st.color, label: layer.name || '' }] };
      const values = features.map((f) => (f.properties || {})[by.column]);
      if (by.mode === 'graduated') {
        const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
        let ranges = Array.isArray(by.ranges) && by.ranges.length ? by.ranges.map((r) => Object.assign({}, r, { color: theme.cssColor(r && r.color) })) : null;
        if (!ranges) {
          const classes = Math.max(2, Math.min(9, Number(by.classes) || 5));
          ranges = [];
          if (nums.length) {
            for (let i = 0; i < classes; i++) {
              const lower = nums[Math.floor(i * (nums.length - 1) / classes)]; const upper = nums[Math.floor((i + 1) * (nums.length - 1) / classes)];
              if (ranges.length && ranges[ranges.length - 1].upper === upper) continue;
              ranges.push({ lower, upper, color: lerp(tk.sequential[0], tk.sequential[1], classes === 1 ? 1 : i / (classes - 1)) });
            }
          }
        }
        ranges.forEach((r, i) => { if (!r.color) r.color = lerp(tk.sequential[0], tk.sequential[1], ranges.length === 1 ? 1 : i / (ranges.length - 1)); if (!r.label) r.label = `${fmt(r.lower)} – ${fmt(r.upper)}`; });
        const colorFor = (v) => { if (typeof v !== 'number') return null; const r = ranges.find((x, i) => v >= x.lower && (v < x.upper || (i === ranges.length - 1 && v <= x.upper))) || (v > ranges[ranges.length - 1].upper ? ranges[ranges.length - 1] : null); return r ? r.color : null; };
        return { styleOf: (props) => { const c = colorFor(props[by.column]); return Object.assign(base(c || tk.grid), c ? {} : { fillOpacity: Math.min(st.fillOpacity, 0.2) }); }, legend: ranges.map((r) => ({ color: r.color, label: r.label })) };
      }
      // Categories in order of appearance, with fixed colours (QGIS) where given and the palette otherwise.
      const fixed = by.values && typeof by.values === 'object' ? by.values : {};
      const order = []; const colors = new Map();
      for (const v of values) { const k = v === null || v === undefined ? '' : String(v); if (!colors.has(k)) { order.push(k); colors.set(k, hex(fixed[k]) || tk.palette[order.length - 1 - 0] || tk.palette[(order.length - 1) % tk.palette.length]); } }
      order.forEach((k, i) => { if (!hex(fixed[k])) colors.set(k, tk.palette[i % tk.palette.length]); });
      return { styleOf: (props) => { const v = props[by.column]; return base(colors.get(v === null || v === undefined ? '' : String(v)) || tk.grid); }, legend: order.map((k) => ({ color: colors.get(k), label: k === '' ? D.t('map.legend.empty') : k })) };
    }

    // ---- data ----------------------------------------------------------------------------------------------
    /**
     * Features of a layer as GeoJSON (WGS 84), with the row's other columns as properties.
     * @returns {Promise<{features: any[], total: number, truncated: boolean, columns: string[]}>}
     */
    async function featuresOf(layer, options = {}) {
      if (layer.kind === 'boundary') {
        const feats = await boundaries.features(layer.boundary);
        return { features: feats.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: Object.assign({ namn: f.name, kod: f.code }, f.props) })), total: feats.length, truncated: false, columns: ['namn', 'kod'] };
      }
      const meta = await datasets.get(layer.datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const columns = await datasets.columns(layer.datasetId);
      const names = new Set(columns.map((c) => c.name));
      const popup = Array.isArray(layer.popup) && layer.popup.length ? layer.popup : columns.filter((c) => c.name !== layer.geometry).map((c) => c.name).slice(0, 12);
      const fields = Array.from(new Set([layer.geometry, layer.lon, layer.lat, layer.label, layer.colorBy && layer.colorBy.column].concat(popup).filter((n) => n && names.has(n))));
      // Shared filters (dashboards, batch groups) apply to the layers that have the column.
      const extra = (options.extraFilters || []).filter((f) => f && names.has(f.field));
      const data = await vizData.fetchRows(layer.datasetId, { fields, filters: (layer.filters || []).concat(extra), listId: layer.listId || undefined, limit: layer.maxRows || MAX_ROWS, rowid: !!layer.withRowid });
      const features = [];
      for (const row of data.rows) {
        let geometry = null;
        if (layer.geometry) geometry = geo.parseGeometry(row[layer.geometry]);
        else if (typeof row[layer.lon] === 'number' && typeof row[layer.lat] === 'number') geometry = { type: 'Point', coordinates: [row[layer.lon], row[layer.lat]] };
        if (!geometry || !geometry.type) continue;
        const properties = {};
        for (const k of Object.keys(row)) if (k !== layer.geometry) properties[k] = row[k];
        features.push({ type: 'Feature', geometry, properties });
      }
      // Metres become degrees in the dataset's own system (SWEREF 99 TM when the file named none), so that every layer shares
      // one projection. A system the app cannot convert leaves the layer without features and is named in `crsUnknown`.
      const crs = geo.crsOfMeta(meta);
      const projected = features.length && geo.isProjected(features.map((f) => f.geometry));
      if (projected) for (const f of features) f.geometry = geo.toWgs84(f.geometry, crs || undefined);
      const placed = projected ? features.filter((f) => f.geometry) : features;
      return { features: placed, total: data.total, truncated: data.truncated, columns: fields, crsUnknown: projected && geo.crsUnknown(crs) ? crs : '' };
    }
    /**
     * Everything needed to draw or export a map: per visible layer its features, style function and legend.
     * @returns {Promise<{layers: Array<{layer: any, features: any[], styleOf: Function, legend: any[], truncated: boolean, total: number}>, rows: number, bounds: any}>}
     */
    async function prepare(chart, options = {}) {
      const def = chart.map || {};
      const out = []; let rows = 0;
      for (const layer of def.layers || []) {
        // Pictures from services and rasters have no features: they are drawn on the live map only.
        if (layer.visible === false || imagery(layer) || layer.kind === 'raster') continue;
        const data = await featuresOf(layer, options);
        const st = styling(layer, data.features);
        out.push({ layer, features: data.features, styleOf: st.styleOf, legend: st.legend, truncated: data.truncated, total: data.total, crsUnknown: data.crsUnknown || '' });
        rows += data.features.length;
      }
      return { layers: out, rows, bounds: geo.bounds(out.flatMap((l) => l.features.map((f) => f.geometry))) };
    }

    // ---- tiles ---------------------------------------------------------------------------------------------
    /**
     * Tile source of a definition, or null: OSM, the user's own XYZ template, a WMS or OGC API – Tiles (consent "basemaps" in every
     * case). A template must be an http(s) address with {x} and {y}; its attribution, like every attribution from a definition,
     * is escaped, because Leaflet shows attributions as HTML.
     */
    function tileSource(def) {
      if (!def || def.basemap === 'osm') return { url: OSM.url, attribution: D.t(OSM.attributionKey), maxZoom: OSM.maxZoom };
      if (def.basemap === 'custom' && def.custom && /^https?:\/\/[^/?#\s]+\S*(?:\{x\}\S*\{y\}|\{y\}\S*\{x\})/i.test(def.custom.url || '')) return { url: def.custom.url, attribution: escAttr(def.custom.attribution), maxZoom: 19 };
      if (def.basemap === 'wms') return wmsSource(def.wms);
      if (def.basemap === 'tiles') return tilesSource(def.tiles);
      return null;
    }
    const escAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    /**
     * Tile parameters of an OGC API – Tiles definition {template, attribution, minNativeZoom, maxNativeZoom}, or null when the
     * template is not an http(s) address with {z}, {x} and {y}. The attribution is the service's text, escaped: Leaflet shows
     * attributions as HTML.
     */
    function tilesSource(tl) {
      const url = String((tl && tl.template) || '');
      if (!/^(https?|dataspatium-asset):\/\//i.test(url) || !/\{z\}/.test(url) || !/\{x\}/.test(url) || !/\{y\}/.test(url)) return null;
      const native = {};
      for (const k of ['minNativeZoom', 'maxNativeZoom']) if (Number.isInteger(tl[k])) native[k] = tl[k];
      return { url, attribution: escAttr(tl.attribution), maxZoom: 19, native };
    }
    /** The tile source of an overlay layer (WMS or OGC API – Tiles), or null. */
    const overlaySource = (layer) => (layer.kind === 'tiles' ? tilesSource(layer.tiles) : wmsSource(layer.wms));
    /** A WMS address without request parameters (capabilities links are often pasted whole); other parameters stay. */
    function wmsUrl(input) {
      const s = String(input || '').trim();
      try {
        const u = new URL(s);
        for (const k of Array.from(u.searchParams.keys())) if (/^(service|request|version|layers|styles|format|transparent|crs|srs|bbox|width|height)$/i.test(k)) u.searchParams.delete(k);
        u.hash = '';
        return u.toString().replace(/\?$/, '');
      } catch (_e) { return s; }
    }
    /**
     * Tile parameters of a WMS definition {url, layers, format, transparent, version, attribution}, or null when the
     * address or the layer list is missing. The result's `wms` holds the GetMap parameters for L.tileLayer.wms; the attribution
     * is escaped (Leaflet shows it as HTML).
     */
    function wmsSource(w) {
      if (!w || !/^(https?|dataspatium-asset):\/\//i.test(String(w.url || '')) || !String(w.layers || '').trim()) return null;
      return { url: wmsUrl(w.url), attribution: escAttr(w.attribution), maxZoom: 19, wms: { layers: String(w.layers).trim(), format: w.format || 'image/png', transparent: !!w.transparent, version: w.version || '1.3.0' } };
    }
    const hostOf = (url) => { try { return new URL(String(url).replace(/\{[sxyzr-]+\}/g, '0')).host; } catch (_e) { return String(url); } };
    /** Leaflet's tile layer, or its WMS layer when the options carry WMS parameters (the shape the test factories get). */
    const defaultFactory = (url, opts) => (opts.layers ? globalThis.L.tileLayer.wms(url, opts) : globalThis.L.tileLayer(url, opts));
    const tileOptions = (src, extra) => Object.assign({ attribution: src.attribution, maxZoom: src.maxZoom || 19 }, src.wms || {}, src.native || {}, extra || {});
    /**
     * The tile layer after consent, or null when there is none or consent was refused (info.basemapDenied is set). On a map in a
     * grid of its own only a WMS can be the background, requested in that grid with WMS 1.1.1 (x before y, whatever the system's
     * axis order); OpenStreetMap and XYZ templates exist in Web Mercator only (info.basemapProjection is set).
     */
    async function tileLayer(def, options, info, grid) {
      // Background maps from services belong to the tier BIM och GIS (platform/tier); below it a map draws its own features only.
      if (!def || !def.basemap || def.basemap === 'none' || options.noTiles || !tier.shows('map.basemap')) return null;
      if (orthophotos.isPreset(def.basemap)) return presetLayer(def.basemap, options, info, grid);
      const src = tileSource(def);
      if (!src) return null;
      if (grid && !src.wms) { info.basemapProjection = true; return null; }
      try { await consent.require('basemaps', { host: hostOf(src.url), url: src.url }); } catch (err) {
        if (err && err.name === 'ConsentError') { info.basemapDenied = true; return null; }
        throw err;
      }
      const factory = options.tileFactory || defaultFactory;
      return factory(src.url, tileOptions(src, grid ? { version: '1.1.1' } : null));
    }
    /**
     * The tile layer of an orthophoto preset in the map's grid (an EPSG code, 0 for Web Mercator), or null: a grid the service
     * does not offer sets info.basemapProjection, a missing key sets info.basemapKey (nothing is contacted then), and a refused
     * consent sets info.basemapDenied. The key goes into the image addresses only, never into the consent's address.
     */
    async function presetLayer(id, options, info, grid) {
      const preset = await orthophotos.get(id);
      if (!preset) return null;
      const src = orthophotos.sourceFor(preset, grid || 3857);
      if (!src) { info.basemapProjection = true; return null; }
      // Sweden's orthophoto has no tiles: it is read for the map's view on the person's action (ui/viz/basemap-choice), so the map
      // only says so here, and nothing is contacted.
      if (orthophotos.isView(preset)) { info.basemapView = preset.id; if (!orthophotos.ready(preset)) info.basemapKey = preset.id; return null; }
      const key = orthophotos.keyOf(preset);
      if (preset.key && !key) { info.basemapKey = preset.id; return null; }
      try { await consent.require('basemaps', { host: hostOf(src.url), url: src.url, label: `${preset.name} · ${preset.publisher} · ${preset.license.name}` }); } catch (err) {
        if (err && err.name === 'ConsentError') { info.basemapDenied = true; return null; }
        throw err;
      }
      const factory = options.tileFactory || defaultFactory;
      const opts = { attribution: orthophotos.attributionHtml(preset), maxZoom: preset.maxZoom || 19 };
      if (src.maxNativeZoom) opts.maxNativeZoom = src.maxNativeZoom;
      if (src.service === 'wms') {
        Object.assign(opts, { layers: src.layers, format: src.format || 'image/png', transparent: false, version: grid ? '1.1.1' : '1.3.0' });
        if (key) opts[preset.key.param] = key;
        return factory(src.url, opts);
      }
      // An XYZ template takes the key as a parameter that Leaflet fills in per tile.
      if (key) opts.dmkey = encodeURIComponent(key);
      return factory(key ? src.url + (src.url.includes('?') ? '&' : '?') + encodeURIComponent(preset.key.param) + '={dmkey}' : src.url, opts);
    }
    /**
     * The visible WMS and OGC API – Tiles overlay layers of a definition as tile layers, after consent for each (refusals set
     * info.basemapDenied). In a grid of its own only WMS layers are drawn; tiles exist in Web Mercator only (info.basemapProjection).
     */
    async function overlayLayers(def, options, info, grid) {
      const out = [];
      if (!def || options.noTiles || !tier.shows('map.basemap')) return out;
      for (const layer of def.layers || []) {
        if (!imagery(layer) || layer.visible === false) continue;
        const src = overlaySource(layer);
        if (!src) continue;
        if (grid && !src.wms) { info.basemapProjection = true; continue; }
        try { await consent.require('basemaps', { host: hostOf(src.url), url: src.url }); } catch (err) {
          if (err && err.name === 'ConsentError') { info.basemapDenied = true; continue; }
          throw err;
        }
        const factory = options.tileFactory || defaultFactory;
        out.push({ layer, tiles: factory(src.url, tileOptions(src, Object.assign({ opacity: layer.style && layer.style.opacity !== undefined ? layer.style.opacity : 0.8 }, grid ? { version: '1.1.1' } : {}))) });
      }
      return out;
    }

    // ---- rasters ----------------------------------------------------------------------------------------------
    /** An opacity between 0 and 1, or the fallback for anything that is not a number. */
    const opacityOf = (v, fallback = 1) => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? fallback : Math.max(0, Math.min(1, n)); };
    /**
     * A raster's attribution as HTML for Leaflet's attribution control (which shows it as HTML): the text from the file or the
     * provider, escaped, and the licence's name, linked when its address is https.
     * @param {{attribution?: string|null, license?: {name?: string, url?: string}|null}} raster `_meta.raster`
     */
    function rasterAttribution(raster) {
      const lic = raster.license && raster.license.name ? escAttr(raster.license.name) : '';
      const url = raster.license && /^https:\/\//i.test(String(raster.license.url || '')) ? String(raster.license.url) : '';
      const licence = lic && url ? `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${lic}</a>` : lic;
      const text = raster.attribution ? escAttr(raster.attribution) : '';
      return text && licence ? `${text} (${licence})` : text || licence;
    }
    /**
     * The pictures of a definition's visible raster layers as image overlays, not yet on the map: every file of the dataset's
     * `_meta.raster` that its table still lists and that has a place, its preview read from the dataset's own file (an object URL;
     * nothing is fetched and no consent is asked). The `i`-th raster layer of the list lies at z-index 2 + i in the tile pane, above the background maps and the
     * service layers (all at 1). Files without a place are named in `info.rasterUnplaced`; a map in a grid of its own draws none
     * (`info.rasterProjection`), and neither does a tier below BIM och GIS (platform/tier, `kind:raster`).
     * @returns {Promise<Array<{layer: any, images: any[]}>>}
     */
    async function rasterImages(L, def, info, grid) {
      const out = [];
      const layers = (def.layers || []).filter((l) => l.kind === 'raster');
      if (!layers.some((l) => l.visible !== false)) return out;
      if (grid) { info.rasterProjection = true; return out; }
      if (!tier.shows('kind:raster')) return out;
      const unplaced = new Set();
      for (const [i, layer] of layers.entries()) {
        if (layer.visible === false) continue;
        const meta = layer.datasetId ? await datasets.get(layer.datasetId).catch(() => null) : null;
        const raster = meta && meta.raster && typeof meta.raster === 'object' ? meta.raster : null;
        if (!raster) continue;
        const attribution = rasterAttribution(raster);
        const opacity = opacityOf(layer.style && layer.style.opacity);
        // The table is the list of files: a row removed there takes its picture off the map.
        const names = await dsFiles.listed(meta.id).catch(() => null);
        const images = [];
        for (const file of Array.isArray(raster.files) ? raster.files : []) {
          if (names && file && !names.has(String(file.name))) continue;
          const bounds = file && file.preview && Array.isArray(file.preview.bounds) && file.preview.bounds.length === 2 ? file.preview.bounds : null;
          if (!bounds) { if (file && file.name) unplaced.add(String(file.name)); continue; }
          const url = await dsFiles.url(meta.id, file.name, 'preview').catch(() => null);
          if (!url) continue;
          images.push(L.imageOverlay(url, L.latLngBounds(bounds[0], bounds[1]), { pane: 'tilePane', zIndex: 2 + i, opacity, interactive: false, alt: String(file.name), className: 'dm-raster-image', attribution }));
        }
        out.push({ layer, images });
      }
      info.rasterUnplaced = Array.from(unplaced);
      return out;
    }
    /**
     * The named layers of a WMS service from its capabilities, after consent "basemaps": [{id, name, abstract}].
     * @param {string} url the service address (a GetCapabilities link works too)
     */
    async function wmsLayers(url) {
      const base = wmsUrl(url);
      if (!/^(https?|dataspatium-asset):\/\//i.test(base)) throw new Error(D.t('families.err.url', { field: D.t('map.wms.url') }));
      await consent.require('basemaps', { host: hostOf(base), url: base });
      const res = await globalThis.fetch(base + (base.includes('?') ? '&' : '?') + 'service=WMS&request=GetCapabilities', { headers: { Accept: 'application/xml, text/xml, */*;q=0.5' } });
      if (!res.ok) throw new Error(D.t('geodata.err.http', { status: res.status }));
      const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('import.err.notxml'));
      const kid = (el, name) => { const k = Array.from(el.children).find((c) => c.localName === name); return k ? String(k.textContent || '').trim() : ''; };
      // The systems a layer can be drawn in: its own CRS (1.3.0) or SRS (1.1.1) and those of the layers around it.
      const systemsOf = (el) => {
        const out = new Set();
        for (let at = el; at && at.localName === 'Layer'; at = at.parentElement) {
          for (const c of Array.from(at.children)) if (c.localName === 'CRS' || c.localName === 'SRS') String(c.textContent || '').split(/\s+/).filter(Boolean).forEach((x) => out.add(x.toUpperCase()));
        }
        return Array.from(out);
      };
      const out = [];
      for (const el of Array.from(doc.getElementsByTagNameNS('*', 'Layer'))) {
        const id = kid(el, 'Name');
        if (id) out.push({ id, name: kid(el, 'Title') || id, abstract: kid(el, 'Abstract'), crs: systemsOf(el) });
      }
      if (!out.length) throw new Error(D.t('geodata.err.nolayers'));
      return out;
    }

    // ---- live map -----------------------------------------------------------------------------------------
    /**
     * Draw a map chart into an element. Options: interactive (default true), height, extraFilters, onSelect(feature),
     * tileFactory (tests), noTiles, fitMaxZoom (the closest zoom when the map fits its features; 14 by default). `def.crs` (an
     * EPSG code or name of a projected system the app reads) draws the map in that grid instead of Web Mercator, with a WMS or
     * orthophoto background in the same grid (and without rasters, which are in Web Mercator). Returns a handle with the Leaflet
     * map, legend, info (`rasters` is the number of raster pictures drawn), the rasters' pictures per layer with
     * setRasterOpacity(), the map's EPSG code, export functions and finalize().
     */
    async function render(el, chart, options = {}) {
      const def = chart.map || {};
      const L = def.crs && geo.proj4Def(def.crs) ? await ensureProj() : await ensure();
      const grid = def.crs ? gridCrs(def.crs) : null;
      const prepared = await prepare(chart, options);
      el.classList.add('dm-map');
      if (options.height) el.style.height = heightOf(options.height) + 'px';
      else if (def.height && !el.style.height) el.style.height = heightOf(def.height) + 'px';
      const interactive = options.interactive !== false;
      const map = L.map(el, Object.assign({ preferCanvas: true, zoomControl: interactive, dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive, touchZoom: interactive, attributionControl: true },
        grid ? { crs: grid, minZoom: 0, maxZoom: GRID_RESOLUTIONS.length - 1 } : {}));
      // The map on its element, for the tests (as Cytoscape's graphs carry theirs).
      /** @type {any} */ (el)._dmMap = map;
      // A scale bar in metres on every interactive map: plans and maps are read to scale.
      if (interactive) L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
      const info = { rows: prepared.rows, layers: prepared.layers.length, total: prepared.layers.reduce((n, l) => n + l.total, 0), truncated: prepared.layers.some((l) => l.truncated), basemapDenied: false, basemapProjection: false, basemapKey: '', basemapView: '', crsUnknown: Array.from(new Set(prepared.layers.map((l) => l.crsUnknown).filter(Boolean))), rasters: 0, rasterUnplaced: [], rasterProjection: false };
      // The grid's EPSG code (0 for Web Mercator): a background map is asked for in that grid, or left out when its service has none.
      const gridCode = grid ? geo.crsCode(def.crs) || -1 : 0;
      const tiles = await tileLayer(def, options, info, gridCode);
      if (tiles) tiles.addTo(map);
      // WMS and tile overlays live in the tile pane: under every feature, whatever their place in the layer list.
      const overlays = await overlayLayers(def, options, info, gridCode);
      for (const o of overlays) o.tiles.addTo(map);
      // A raster's pictures as well, above those (z-index 2 and up) and under the features.
      const rasters = await rasterImages(L, def, info, !!grid);
      for (const r of rasters) for (const image of r.images) image.addTo(map);
      info.rasters = rasters.reduce((n, r) => n + r.images.length, 0);
      const groups = [];
      for (const item of prepared.layers) {
        const group = L.geoJSON({ type: 'FeatureCollection', features: item.features }, {
          style: (f) => { const s = item.styleOf(f.properties || {}); return { color: s.color, fillColor: s.fillColor, weight: s.weight, opacity: s.opacity, fillOpacity: s.fillOpacity }; },
          pointToLayer: (f, latlng) => { const s = item.styleOf(f.properties || {}); return L.circleMarker(latlng, { radius: s.radius, color: s.color, fillColor: s.fillColor, weight: s.weight, opacity: s.opacity, fillOpacity: Math.max(0.6, s.fillOpacity) }); },
          onEachFeature: (f, lyr) => {
            const label = item.layer.label ? (f.properties || {})[item.layer.label] : null;
            // Leaflet writes a string tooltip as HTML; the label is the dataset's value, so it goes in as a text node, made when
            // the tooltip opens.
            if (label !== null && label !== undefined && label !== '') lyr.bindTooltip(() => document.createTextNode(String(label)), { sticky: true, direction: 'top' });
            if (options.onSelect) lyr.on('click', () => options.onSelect({ layer: item.layer, properties: f.properties || {}, geometry: f.geometry }));
          },
        });
        group.addTo(map);
        groups.push({ layer: item.layer, group, legend: item.legend });
      }
      /** The union of the rasters' places, or null. */
      const rasterBounds = () => {
        let box = null;
        for (const r of rasters) for (const image of r.images) { const b = image.getBounds(); box = box ? box.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); }
        return box;
      };
      const fit = () => {
        // A saved view is in Web Mercator's zoom levels; a map in a grid of its own fits its features instead.
        if (!grid && def.view && def.view.center && def.view.zoom) { map.setView(def.view.center, def.view.zoom); return; }
        const b = prepared.bounds;
        const maxZoom = options.fitMaxZoom || (grid ? 12 : 14);
        // The features decide; the rasters' places only when there are none.
        const rb = b ? null : rasterBounds();
        if (b) map.fitBounds([[b.minY, b.minX], [b.maxY, b.maxX]], { padding: [16, 16], maxZoom });
        else if (rb) map.fitBounds(rb, { padding: [16, 16], maxZoom });
        else map.setView(DEFAULT_VIEW.center, grid ? 2 : DEFAULT_VIEW.zoom);
      };
      fit();
      const legend = prepared.layers.filter((l) => l.layer.visible !== false).map((l) => ({ name: l.layer.name, entries: l.legend }));
      return {
        kind: 'map', map, groups, legend, info, overlays, rasters, crs: grid ? geo.crsCode(def.crs) : 3857,
        fit, refresh: () => map.invalidateSize(),
        /**
         * The opacity of a raster layer's pictures, at once and without drawing the map again; the caller keeps it in the
         * definition. @param {string} layerId @param {number} value 0 to 1 @returns {number} the pictures changed
         */
        setRasterOpacity: (layerId, value) => {
          const v = opacityOf(value, NaN);
          if (Number.isNaN(v)) return 0;
          let n = 0;
          for (const r of rasters) if (r.layer.id === layerId) for (const image of r.images) { image.setOpacity(v); n++; }
          return n;
        },
        view: () => ({ center: [round(map.getCenter().lat), round(map.getCenter().lng)], zoom: map.getZoom() }),
        svg: async () => drawSvg(prepared, def, { width: el.clientWidth || 800, height: el.clientHeight || 480 }),
        png: async (scale = 2) => drawPng(prepared, def, { width: el.clientWidth || 800, height: el.clientHeight || 480, scale }),
        // The layers go first, while the canvas renderer is still there: a layer removed after it would ask for a redraw on a
        // context that is gone (Leaflet's clearRect error when a map is closed right after a pan).
        finalize: () => {
          try {
            map.stop();
            // Leaflet 1.9 ends a zoom animation from a 250 ms timer that remove() does not clear; after remove() that timer moves a
            // map whose panes are gone and throws (_leaflet_pos of undefined). End the animation now, while the panes still exist.
            if (/** @type {any} */ (map)._animatingZoom) /** @type {any} */ (map)._onZoomTransitionEnd();
            const layers = []; map.eachLayer((l) => layers.push(l));
            for (const l of layers) map.removeLayer(l);
            map.remove();
          } catch (_err) { /* already gone */ }
        },
      };
    }
    const round = (v) => Math.round(v * 1e5) / 1e5;

    // ---- headless drawing (Web Mercator, no tiles) --------------------------------------------------------
    const R = 6378137;
    const project = (lon, lat) => { const la = Math.max(-85.05, Math.min(85.05, lat)); return [R * lon * Math.PI / 180, -R * Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360))]; };
    /** Pixel transform for the prepared layers (or the saved view) inside width × height with padding. */
    function transform(prepared, def, width, height) {
      let b = prepared.bounds;
      if (def.view && def.view.center && def.view.zoom) {
        // The saved view: metres per pixel at that zoom, centred.
        const mpp = 2 * Math.PI * R / (256 * Math.pow(2, def.view.zoom));
        const c = project(def.view.center[1], def.view.center[0]);
        const s = 1 / mpp;
        return { s, tx: width / 2 - c[0] * s, ty: height / 2 - c[1] * s };
      }
      if (!b) b = { minX: 5, minY: 54, maxX: 25, maxY: 70 };
      const p1 = project(b.minX, b.maxY); const p2 = project(b.maxX, b.minY);
      const pad = 16;
      const dx = Math.max(1, p2[0] - p1[0]); const dy = Math.max(1, p2[1] - p1[1]);
      const s = Math.min((width - 2 * pad) / dx, (height - 2 * pad) / dy);
      return { s, tx: (width - dx * s) / 2 - p1[0] * s, ty: (height - dy * s) / 2 - p1[1] * s };
    }
    /** Walk a geometry into drawing commands: rings (closed), lines and points in pixel coordinates. */
    function shapes(geometry, tr) {
      const px = (c) => { const p = project(c[0], c[1]); return [p[0] * tr.s + tr.tx, p[1] * tr.s + tr.ty]; };
      const out = { rings: [], lines: [], points: [] };
      const visit = (g) => {
        if (!g) return;
        switch (g.type) {
          case 'Point': out.points.push(px(g.coordinates)); break;
          case 'MultiPoint': for (const c of g.coordinates) out.points.push(px(c)); break;
          case 'LineString': out.lines.push(g.coordinates.map(px)); break;
          case 'MultiLineString': for (const l of g.coordinates) out.lines.push(l.map(px)); break;
          case 'Polygon': out.rings.push(g.coordinates.map((ring) => ring.map(px))); break;
          case 'MultiPolygon': for (const poly of g.coordinates) out.rings.push(poly.map((ring) => ring.map(px))); break;
          case 'GeometryCollection': for (const gg of g.geometries || []) visit(gg); break;
          default: break;
        }
      };
      visit(geometry);
      return out;
    }
    const num = (v) => (Math.round(v * 10) / 10).toString();
    function legendSvg(prepared, def, width, tk) {
      if (def.legend === false) return '';
      const entries = prepared.layers.flatMap((l) => (l.legend.length > 1 ? l.legend : l.legend.map((e) => Object.assign({}, e, { label: e.label || l.layer.name })))).slice(0, 24);
      if (!entries.length) return '';
      const lineH = 18; const boxW = Math.min(260, 24 + Math.max(...entries.map((e) => e.label.length)) * 7); const boxH = entries.length * lineH + 12;
      const x = width - boxW - 12; const y = 12;
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<g font-family="${esc(tk.font)}" font-size="12" fill="${tk.text}"><rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="4" fill="${tk.background}" fill-opacity="0.92" stroke="${tk.border}"/>`
        + entries.map((e, i) => `<rect x="${x + 8}" y="${y + 8 + i * lineH}" width="12" height="12" rx="2" fill="${escAttr(e.color)}" stroke="${tk.border}"/><text x="${x + 26}" y="${y + 18 + i * lineH}">${esc(e.label.length > 34 ? e.label.slice(0, 33) + '…' : e.label)}</text>`).join('')
        + '</g>';
    }
    /** The layers as an SVG document (no tiles). */
    function drawSvg(prepared, def, size) {
      const tk = theme.tokens();
      const width = size.width || 800; const height = size.height || 480;
      const tr = transform(prepared, def, width, height);
      const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, `<rect width="${width}" height="${height}" fill="${tk.background}"/>`];
      for (const item of prepared.layers) {
        for (const f of item.features) {
          const s = item.styleOf(f.properties || {});
          const sh = shapes(f.geometry, tr);
          // styling() gives colours and numbers only; the attributes are escaped as well, so that nothing else can enter.
          const fill = escAttr(s.fillColor); const stroke = escAttr(s.color);
          const a = { fo: Number(s.fillOpacity), o: Number(s.opacity), w: Number(s.weight), r: Number(s.radius) };
          for (const poly of sh.rings) parts.push(`<path d="${poly.map((ring) => 'M' + ring.map((p) => num(p[0]) + ' ' + num(p[1])).join('L') + 'Z').join('')}" fill="${fill}" fill-opacity="${a.fo}" stroke="${stroke}" stroke-opacity="${a.o}" stroke-width="${a.w}" fill-rule="evenodd"/>`);
          for (const line of sh.lines) parts.push(`<path d="M${line.map((p) => num(p[0]) + ' ' + num(p[1])).join('L')}" fill="none" stroke="${stroke}" stroke-opacity="${a.o}" stroke-width="${a.w}"/>`);
          for (const p of sh.points) parts.push(`<circle cx="${num(p[0])}" cy="${num(p[1])}" r="${a.r}" fill="${fill}" fill-opacity="${Math.max(0.6, a.fo)}" stroke="${stroke}" stroke-width="${a.w}"/>`);
        }
      }
      parts.push(legendSvg(prepared, def, width, tk), '</svg>');
      return parts.join('\n');
    }
    /** The layers drawn on a canvas as PNG (no tiles). */
    async function drawPng(prepared, def, size) {
      const tk = theme.tokens();
      const width = size.width || 800; const height = size.height || 480; const scale = size.scale || 2;
      const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
      ctx.fillStyle = tk.background; ctx.fillRect(0, 0, width, height);
      const tr = transform(prepared, def, width, height);
      const alpha = (color, a) => { const h6 = hex(color); return h6 ? h6 + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0') : color; };
      for (const item of prepared.layers) {
        for (const f of item.features) {
          const s = item.styleOf(f.properties || {});
          const sh = shapes(f.geometry, tr);
          ctx.lineWidth = s.weight; ctx.strokeStyle = alpha(s.color, s.opacity);
          for (const poly of sh.rings) {
            ctx.beginPath();
            for (const ring of poly) { ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
            ctx.fillStyle = alpha(s.fillColor, s.fillOpacity); ctx.fill('evenodd'); ctx.stroke();
          }
          for (const line of sh.lines) { ctx.beginPath(); line.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
          for (const p of sh.points) { ctx.beginPath(); ctx.arc(p[0], p[1], s.radius, 0, Math.PI * 2); ctx.fillStyle = alpha(s.fillColor, Math.max(0.6, s.fillOpacity)); ctx.fill(); ctx.stroke(); }
        }
      }
      if (def.legend !== false) {
        const legend = legendSvg(prepared, def, width, tk);
        if (legend) await drawSvgOn(ctx, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${legend}</svg>`, width, height);
      }
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'));
    }
    function drawSvgOn(ctx, svgText, width, height) {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => { try { ctx.drawImage(img, 0, 0, width, height); } catch (_e) { /* ignore */ } URL.revokeObjectURL(url); resolve(undefined); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
        img.src = url;
      });
    }
    /**
     * Export without showing the map: svg, png or pdf of the layers (background tiles are not included).
     * @param {any} chart @param {'svg'|'png'|'pdf'} format @param {{width?: number, height?: number, scale?: number, extraFilters?: any[], title?: string}} [options]
     */
    async function toBlob(chart, format, options = {}) {
      const prepared = await prepare(chart, options);
      const width = Number(options.width) || 800; const height = Number(options.height) || Math.round(width * 0.6);
      if (format === 'png') return drawPng(prepared, chart.map || {}, { width, height, scale: options.scale || 2 });
      const svg = drawSvg(prepared, chart.map || {}, { width, height });
      if (format === 'svg') return vizExport.svgBlob(await vizExport.svgWithFonts(svg));
      if (format === 'pdf') return vizExport.svgToPdf(svg, { title: options.title || chart.name });
      throw new Error(D.t('err.unknown.format', { format }));
    }

    /** Small PNG data URL for lists and the gallery (null when the map cannot be drawn). */
    async function thumbnail(chart) {
      try {
        const blob = await toBlob(chart, 'png', { width: 480, height: 270, scale: 1 });
        return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
      } catch (_err) { return null; }
    }

    // ---- standalone HTML (Publicera) -----------------------------------------------------------------------
    /**
     * Markup for one map in standalone HTML: the features with their computed styles inline; the page includes
     * the library (source()) once before it. Tiles are referenced when the chart has a background map.
     */
    async function htmlFor(id, chart, options = {}) {
      const prepared = await prepare(chart, options);
      const def = chart.map || {};
      const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
      const data = prepared.layers.map((item) => ({
        type: 'FeatureCollection',
        features: item.features.map((f) => { const s = item.styleOf(f.properties || {}); const label = item.layer.label ? (f.properties || {})[item.layer.label] : null; return { type: 'Feature', geometry: f.geometry, properties: { __style: { color: s.color, fillColor: s.fillColor, weight: s.weight, opacity: s.opacity, fillOpacity: s.fillOpacity, radius: s.radius }, __label: label === null || label === undefined ? '' : String(label) } }; }),
      }));
      // Background maps and imagery from services belong to the tier BIM och GIS (platform/tier), as on screen (tileLayer, overlayLayers).
      const services = tier.shows('map.basemap');
      const src = services && def.basemap && def.basemap !== 'none' ? (orthophotos.isPreset(def.basemap) ? await publishedPreset(def.basemap) : tileSource(def)) : null;
      const tileJs = (s, extra) => (s.wms ? `L.tileLayer.wms(${json(s.url)},${json(tileOptions(s, extra))}).addTo(m);` : `L.tileLayer(${json(s.url)},${json(tileOptions(s, extra))}).addTo(m);`);
      const overlays = services ? (def.layers || []).filter((l) => imagery(l) && l.visible !== false).map((l) => ({ src: overlaySource(l), opacity: l.style && l.style.opacity !== undefined ? l.style.opacity : 0.8 })).filter((o) => o.src) : [];
      const legend = def.legend === false ? '' : `<div class="dm-map-legend">${prepared.layers.flatMap((l) => (l.legend.length > 1 ? l.legend : l.legend.map((e) => Object.assign({}, e, { label: e.label || l.layer.name })))).slice(0, 24).map((e) => `<div><span style="background:${escAttr(e.color)}"></span>${String(e.label).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('')}</div>`;
      const view = def.view && def.view.center && def.view.zoom ? `m.setView(${json(def.view.center)}, ${json(def.view.zoom)});` : `if (b) m.fitBounds(b, {padding: [16, 16], maxZoom: 14}); else m.setView(${json(DEFAULT_VIEW.center)}, ${DEFAULT_VIEW.zoom});`;
      // The label is a dataset's value: the page gives it to Leaflet as a text node, never as a string Leaflet writes as HTML.
      return `<div class="dm-map-wrap"><div id="${escAttr(id)}" class="dm-map" style="height:${heightOf(options.height || def.height)}px"></div>${legend}</div>`
        + `<script>(function(){var m=L.map(${json(id)},{preferCanvas:true});${src ? tileJs(src) : ''}${overlays.map((o) => tileJs(o.src, { opacity: o.opacity })).join('')}`
        + `var data=${json(data)};var b=null;data.forEach(function(fc){var g=L.geoJSON(fc,{style:function(f){return f.properties.__style},pointToLayer:function(f,ll){return L.circleMarker(ll,f.properties.__style)},onEachFeature:function(f,l){if(f.properties.__label)l.bindTooltip(function(){return document.createTextNode(f.properties.__label)},{sticky:true})}}).addTo(m);var bb=g.getBounds();if(bb.isValid())b=b?b.extend(bb):bb});${view}})();</script>`;
    }
    /**
     * The tile source of an orthophoto in published HTML (Web Mercator), or null for one that needs a key: a key is the
     * person's own and never leaves the app in a page that others read.
     */
    async function publishedPreset(id) {
      const preset = await orthophotos.get(id).catch(() => null);
      const s = preset && !preset.key ? orthophotos.sourceFor(preset, 3857) : null;
      if (!s) return null;
      return Object.assign({ url: s.url, attribution: orthophotos.attributionHtml(preset), maxZoom: preset.maxZoom || 19 }, s.service === 'wms' ? { wms: { layers: s.layers, format: s.format || 'image/png', transparent: false, version: '1.3.0' } } : {});
    }
    /** CSS for maps in standalone HTML (the library's stylesheet is inlined separately). */
    function htmlCss() {
      return '.dm-map{width:100%;border-radius:6px;overflow:hidden}.dm-map-wrap{position:relative}.dm-map-legend{position:absolute;right:12px;top:12px;z-index:800;background:rgba(255,255,255,.92);padding:6px 10px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.2)}.dm-map-legend div{display:flex;align-items:center;gap:6px;line-height:18px}.dm-map-legend span{display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(0,0,0,.2)}';
    }

    /**
     * SVG of an in-memory table (rows as arrays, as api/runner returns them) with a geometry or coordinate column, for
     * previews before the table is saved; null when the table has no geometry. No tiles, no legend.
     * @param {{columns: string[], rows: any[][], types?: Record<string, string>}} table
     * @param {{width?: number, height?: number, limit?: number}} [size]
     */
    function tableSvg(table, size = {}) {
      if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows) || !table.rows.length) return null;
      const sample = table.rows[0];
      const columns = table.columns.map((name, i) => ({ name, type: (table.types && table.types[name]) || (typeof sample[i] === 'number' ? 'number' : 'text') }));
      const geometry = geometryColumn(columns);
      const coords = geometry ? null : coordinateColumns(columns);
      if (!geometry && !coords) return null;
      const gi = geometry ? table.columns.indexOf(geometry) : -1;
      const li = coords ? table.columns.indexOf(coords.lon) : -1; const ai = coords ? table.columns.indexOf(coords.lat) : -1;
      const features = [];
      for (const row of table.rows.slice(0, size.limit || 5000)) {
        let g = null;
        if (gi >= 0) g = geo.parseGeometry(row[gi]);
        else if (typeof row[li] === 'number' && typeof row[ai] === 'number') g = { type: 'Point', coordinates: [row[li], row[ai]] };
        if (g && g.type) features.push({ type: 'Feature', geometry: g, properties: {} });
      }
      if (!features.length) return null;
      if (geo.isProjected(features.map((f) => f.geometry))) for (const f of features) f.geometry = geo.toWgs84(f.geometry);
      const layer = { name: '', style: { color: theme.tokens().palette[0], weight: 1, fillOpacity: 0.4, opacity: 0.9, radius: 3 }, colorBy: { mode: 'none' } };
      const st = styling(layer, features);
      const prepared = { layers: [{ layer, features, styleOf: st.styleOf, legend: [], truncated: false, total: features.length }], rows: features.length, bounds: geo.bounds(features.map((f) => f.geometry)) };
      return drawSvg(prepared, { legend: false }, { width: size.width || 640, height: size.height || 300 });
    }

    /** True when a table should open as a map by default: a geometry column, or columns clearly named longitude and latitude. */
    function mapDefault(columns) {
      if (geometryColumn(columns)) return true;
      const nums = columns.filter(numeric);
      return nums.some((c) => /^(lon|long|lng|longitude|longitud|lon_wgs84|longitude_wgs84)$/i.test(c.name)) && nums.some((c) => /^(lat|latitude|latitud|lat_wgs84|latitude_wgs84)$/i.test(c.name));
    }

    return { BASEMAPS, OSM, VENDOR, MAX_ROWS, GRID_RESOLUTIONS, available, ensure, ensureProj, gridCrs, source, geometryColumn, coordinateColumns, mappable, mapDefault, drawable, drawableByValues, layerFor, boundaryLayer, wmsLayer, wmsSource, wmsLayers, tilesLayer, tilesSource, rasterLayer, rasterAttribution, defaultMap, styling, swatchColor, featuresOf, prepare, tileSource, render, toBlob, thumbnail, drawSvg, tableSvg, htmlFor, htmlCss, project };
  });
})();
