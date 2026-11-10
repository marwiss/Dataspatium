// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Map view with Leaflet 1.9 (vendored, BSD-2-Clause): a chart of kind "map" is a list of layers, each a dataset
 * with a geometry column (GeoJSON or WKT text) or longitude/latitude columns, or one of the bundled boundary sets,
 * drawn with the app's palette (one colour, by category or graduated) over an optional background map. Tiles come
 * from the net only after consent for the purpose "basemaps"; without a background map nothing leaves the browser.
 * Export (SVG, PNG, PDF) is drawn headless in Web Mercator by this module, without tiles; published HTML gets the
 * library inlined and the features as GeoJSON with their styles.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/leaflet', ['viz/theme', 'viz/export', 'viz/data', 'data/datasets', 'data/geo', 'data/boundaries', 'platform/consent'], (theme, vizExport, vizData, datasets, geo, boundaries, consent) => {
    const VENDOR = 'vendor/leaflet/';
    const BASEMAPS = ['none', 'osm', 'custom', 'wms'];
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
    /** Default map definition for a dataset: its one layer, no background map, fit to the layers. */
    function defaultMap(columns, dataset) {
      const layer = dataset ? layerFor(columns, dataset, 0) : null;
      return { layers: layer ? [layer] : [], basemap: 'none', custom: { url: '', attribution: '' }, wms: Object.assign({}, WMS_DEFAULTS), view: null, legend: true, height: 480 };
    }

    // ---- colours -------------------------------------------------------------------------------------------
    const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); return m ? '#' + m[1].toLowerCase() : null; };
    const lerp = (a, b, t) => {
      const pa = hex(a) || '#dbe9f6'; const pb = hex(b) || '#08306b';
      const ch = (i) => Math.round(parseInt(pa.slice(1 + i * 2, 3 + i * 2), 16) * (1 - t) + parseInt(pb.slice(1 + i * 2, 3 + i * 2), 16) * t);
      return '#' + [ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    const fmt = (v) => (typeof v === 'number' ? D.require('ui/i18n').formatNumber(v, { maximumFractionDigits: 2 }) : String(v));
    /**
     * Style function and legend for a layer over its features.
     * @returns {{styleOf: (props: any) => any, legend: Array<{color: string, label: string}>}}
     */
    function styling(layer, features) {
      const tk = theme.tokens();
      const st = Object.assign({ color: tk.palette[0], weight: 1.5, fillOpacity: 0.45, opacity: 0.9, radius: 6 }, layer.style || {});
      const base = (fill) => ({ color: st.color, fillColor: fill || st.fillColor || st.color, weight: st.weight, opacity: st.opacity, fillOpacity: st.fillOpacity, radius: st.radius });
      const by = layer.colorBy || {};
      if (!by.column || by.mode === 'none' || !by.mode) return { styleOf: () => base(null), legend: [{ color: st.fillColor || st.color, label: layer.name || '' }] };
      const values = features.map((f) => (f.properties || {})[by.column]);
      if (by.mode === 'graduated') {
        const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
        let ranges = Array.isArray(by.ranges) && by.ranges.length ? by.ranges.map((r) => Object.assign({}, r)) : null;
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
        if (layer.visible === false || layer.kind === 'wms') continue;
        const data = await featuresOf(layer, options);
        const st = styling(layer, data.features);
        out.push({ layer, features: data.features, styleOf: st.styleOf, legend: st.legend, truncated: data.truncated, total: data.total, crsUnknown: data.crsUnknown || '' });
        rows += data.features.length;
      }
      return { layers: out, rows, bounds: geo.bounds(out.flatMap((l) => l.features.map((f) => f.geometry))) };
    }

    // ---- tiles ---------------------------------------------------------------------------------------------
    /** Tile source of a definition, or null: OSM, the user's own XYZ template or a WMS (consent "basemaps" in every case). */
    function tileSource(def) {
      if (!def || def.basemap === 'osm') return { url: OSM.url, attribution: D.t(OSM.attributionKey), maxZoom: OSM.maxZoom };
      if (def.basemap === 'custom' && def.custom && /^https?:\/\/.+\{x\}.*\{y\}|\{y\}.*\{x\}/i.test(def.custom.url || '')) return { url: def.custom.url, attribution: def.custom.attribution || '', maxZoom: 19 };
      if (def.basemap === 'wms') return wmsSource(def.wms);
      return null;
    }
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
     * address or the layer list is missing. The result's `wms` holds the GetMap parameters for L.tileLayer.wms.
     */
    function wmsSource(w) {
      if (!w || !/^(https?|dataspatium-asset):\/\//i.test(String(w.url || '')) || !String(w.layers || '').trim()) return null;
      return { url: wmsUrl(w.url), attribution: w.attribution || '', maxZoom: 19, wms: { layers: String(w.layers).trim(), format: w.format || 'image/png', transparent: !!w.transparent, version: w.version || '1.3.0' } };
    }
    const hostOf = (url) => { try { return new URL(String(url).replace(/\{[sxyzr-]+\}/g, '0')).host; } catch (_e) { return String(url); } };
    /** Leaflet's tile layer, or its WMS layer when the options carry WMS parameters (the shape the test factories get). */
    const defaultFactory = (url, opts) => (opts.layers ? globalThis.L.tileLayer.wms(url, opts) : globalThis.L.tileLayer(url, opts));
    const tileOptions = (src, extra) => Object.assign({ attribution: src.attribution, maxZoom: src.maxZoom || 19 }, src.wms || {}, extra || {});
    /**
     * The tile layer after consent, or null when there is none or consent was refused (info.basemapDenied is set). On a map in a
     * grid of its own only a WMS can be the background, requested in that grid with WMS 1.1.1 (x before y, whatever the system's
     * axis order); OpenStreetMap and XYZ templates exist in Web Mercator only (info.basemapProjection is set).
     */
    async function tileLayer(def, options, info, grid) {
      if (!def || !def.basemap || def.basemap === 'none' || options.noTiles) return null;
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
    /** The visible WMS overlay layers of a definition as tile layers, after consent for each (refusals set info.basemapDenied). */
    async function overlayLayers(def, options, info, grid) {
      const out = [];
      if (!def || options.noTiles) return out;
      for (const layer of def.layers || []) {
        if (layer.kind !== 'wms' || layer.visible === false) continue;
        const src = wmsSource(layer.wms);
        if (!src) continue;
        try { await consent.require('basemaps', { host: hostOf(src.url), url: src.url }); } catch (err) {
          if (err && err.name === 'ConsentError') { info.basemapDenied = true; continue; }
          throw err;
        }
        const factory = options.tileFactory || defaultFactory;
        out.push({ layer, tiles: factory(src.url, tileOptions(src, Object.assign({ opacity: layer.style && layer.style.opacity !== undefined ? layer.style.opacity : 0.8 }, grid ? { version: '1.1.1' } : {}))) });
      }
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
     * tileFactory (tests), noTiles. `def.crs` (an EPSG code or name of a projected system the app reads) draws the map in
     * that grid instead of Web Mercator, with a WMS background in the same grid. Returns a handle with the Leaflet map,
     * legend, info, the map's EPSG code, export functions and finalize().
     */
    async function render(el, chart, options = {}) {
      const def = chart.map || {};
      const L = def.crs && geo.proj4Def(def.crs) ? await ensureProj() : await ensure();
      const grid = def.crs ? gridCrs(def.crs) : null;
      const prepared = await prepare(chart, options);
      el.classList.add('dm-map');
      if (options.height) el.style.height = options.height + 'px';
      else if (def.height && !el.style.height) el.style.height = def.height + 'px';
      const interactive = options.interactive !== false;
      const map = L.map(el, Object.assign({ preferCanvas: true, zoomControl: interactive, dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive, touchZoom: interactive, attributionControl: true },
        grid ? { crs: grid, minZoom: 0, maxZoom: GRID_RESOLUTIONS.length - 1 } : {}));
      // The map on its element, for the tests (as Cytoscape's graphs carry theirs).
      /** @type {any} */ (el)._dmMap = map;
      // A scale bar in metres on every interactive map: plans and maps are read to scale.
      if (interactive) L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
      const info = { rows: prepared.rows, layers: prepared.layers.length, total: prepared.layers.reduce((n, l) => n + l.total, 0), truncated: prepared.layers.some((l) => l.truncated), basemapDenied: false, basemapProjection: false, crsUnknown: Array.from(new Set(prepared.layers.map((l) => l.crsUnknown).filter(Boolean))) };
      const tiles = await tileLayer(def, options, info, !!grid);
      if (tiles) tiles.addTo(map);
      // WMS overlays live in the tile pane: under every feature, whatever their place in the layer list.
      const overlays = await overlayLayers(def, options, info, !!grid);
      for (const o of overlays) o.tiles.addTo(map);
      const groups = [];
      for (const item of prepared.layers) {
        const group = L.geoJSON({ type: 'FeatureCollection', features: item.features }, {
          style: (f) => { const s = item.styleOf(f.properties || {}); return { color: s.color, fillColor: s.fillColor, weight: s.weight, opacity: s.opacity, fillOpacity: s.fillOpacity }; },
          pointToLayer: (f, latlng) => { const s = item.styleOf(f.properties || {}); return L.circleMarker(latlng, { radius: s.radius, color: s.color, fillColor: s.fillColor, weight: s.weight, opacity: s.opacity, fillOpacity: Math.max(0.6, s.fillOpacity) }); },
          onEachFeature: (f, lyr) => {
            const label = item.layer.label ? (f.properties || {})[item.layer.label] : null;
            if (label !== null && label !== undefined && label !== '') lyr.bindTooltip(String(label), { sticky: true, direction: 'top' });
            if (options.onSelect) lyr.on('click', () => options.onSelect({ layer: item.layer, properties: f.properties || {}, geometry: f.geometry }));
          },
        });
        group.addTo(map);
        groups.push({ layer: item.layer, group, legend: item.legend });
      }
      const fit = () => {
        // A saved view is in Web Mercator's zoom levels; a map in a grid of its own fits its features instead.
        if (!grid && def.view && def.view.center && def.view.zoom) { map.setView(def.view.center, def.view.zoom); return; }
        const b = prepared.bounds;
        if (b) map.fitBounds([[b.minY, b.minX], [b.maxY, b.maxX]], { padding: [16, 16], maxZoom: grid ? 12 : 14 });
        else map.setView(DEFAULT_VIEW.center, grid ? 2 : DEFAULT_VIEW.zoom);
      };
      fit();
      const legend = prepared.layers.filter((l) => l.layer.visible !== false).map((l) => ({ name: l.layer.name, entries: l.legend }));
      return {
        kind: 'map', map, groups, legend, info, overlays, crs: grid ? geo.crsCode(def.crs) : 3857,
        fit, refresh: () => map.invalidateSize(),
        view: () => ({ center: [round(map.getCenter().lat), round(map.getCenter().lng)], zoom: map.getZoom() }),
        svg: async () => drawSvg(prepared, def, { width: el.clientWidth || 800, height: el.clientHeight || 480 }),
        png: async (scale = 2) => drawPng(prepared, def, { width: el.clientWidth || 800, height: el.clientHeight || 480, scale }),
        finalize: () => { try { map.remove(); } catch (_err) { /* already gone */ } },
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
        + entries.map((e, i) => `<rect x="${x + 8}" y="${y + 8 + i * lineH}" width="12" height="12" rx="2" fill="${e.color}" stroke="${tk.border}"/><text x="${x + 26}" y="${y + 18 + i * lineH}">${esc(e.label.length > 34 ? e.label.slice(0, 33) + '…' : e.label)}</text>`).join('')
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
          for (const poly of sh.rings) parts.push(`<path d="${poly.map((ring) => 'M' + ring.map((p) => num(p[0]) + ' ' + num(p[1])).join('L') + 'Z').join('')}" fill="${s.fillColor}" fill-opacity="${s.fillOpacity}" stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${s.weight}" fill-rule="evenodd"/>`);
          for (const line of sh.lines) parts.push(`<path d="M${line.map((p) => num(p[0]) + ' ' + num(p[1])).join('L')}" fill="none" stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${s.weight}"/>`);
          for (const p of sh.points) parts.push(`<circle cx="${num(p[0])}" cy="${num(p[1])}" r="${s.radius}" fill="${s.fillColor}" fill-opacity="${Math.max(0.6, s.fillOpacity)}" stroke="${s.color}" stroke-width="${s.weight}"/>`);
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
      const src = def.basemap && def.basemap !== 'none' ? tileSource(def) : null;
      const tileJs = (s, extra) => (s.wms ? `L.tileLayer.wms(${json(s.url)},${json(tileOptions(s, extra))}).addTo(m);` : `L.tileLayer(${json(s.url)},${json(tileOptions(s, extra))}).addTo(m);`);
      const overlays = (def.layers || []).filter((l) => l.kind === 'wms' && l.visible !== false).map((l) => ({ src: wmsSource(l.wms), opacity: l.style && l.style.opacity !== undefined ? l.style.opacity : 0.8 })).filter((o) => o.src);
      const legend = def.legend === false ? '' : `<div class="dm-map-legend">${prepared.layers.flatMap((l) => (l.legend.length > 1 ? l.legend : l.legend.map((e) => Object.assign({}, e, { label: e.label || l.layer.name })))).slice(0, 24).map((e) => `<div><span style="background:${e.color}"></span>${String(e.label).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('')}</div>`;
      const view = def.view && def.view.center && def.view.zoom ? `m.setView(${json(def.view.center)}, ${json(def.view.zoom)});` : `if (b) m.fitBounds(b, {padding: [16, 16], maxZoom: 14}); else m.setView(${json(DEFAULT_VIEW.center)}, ${DEFAULT_VIEW.zoom});`;
      return `<div class="dm-map-wrap"><div id="${id}" class="dm-map" style="height:${options.height || def.height || 480}px"></div>${legend}</div>`
        + `<script>(function(){var m=L.map(${json(id)},{preferCanvas:true});${src ? tileJs(src) : ''}${overlays.map((o) => tileJs(o.src, { opacity: o.opacity })).join('')}`
        + `var data=${json(data)};var b=null;data.forEach(function(fc){var g=L.geoJSON(fc,{style:function(f){return f.properties.__style},pointToLayer:function(f,ll){return L.circleMarker(ll,f.properties.__style)},onEachFeature:function(f,l){if(f.properties.__label)l.bindTooltip(f.properties.__label,{sticky:true})}}).addTo(m);var bb=g.getBounds();if(bb.isValid())b=b?b.extend(bb):bb});${view}})();</script>`;
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

    return { BASEMAPS, OSM, VENDOR, MAX_ROWS, GRID_RESOLUTIONS, available, ensure, ensureProj, gridCrs, source, geometryColumn, coordinateColumns, mappable, mapDefault, drawable, drawableByValues, layerFor, boundaryLayer, wmsLayer, wmsSource, wmsLayers, defaultMap, styling, featuresOf, prepare, tileSource, render, toBlob, thumbnail, drawSvg, tableSvg, htmlFor, htmlCss, project };
  });
})();
