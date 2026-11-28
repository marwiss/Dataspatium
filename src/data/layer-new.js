// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A new, empty map layer (Inhämta's Nytt kartlager): a table with the person's own columns and the geometry column `geometri`,
 * GeoJSON text in the layer's own coordinate system (metres in SWEREF 99 TM or a local SWEREF 99 zone, degrees in WGS 84), of
 * points, lines or areas. The system is kept as `importOptions.crs`, as an import keeps a file's, so that the map, the exports and
 * the spatial tools read the layer in its own system; the kind of geometry is `source.geometry`. The features are drawn on the map
 * in Bearbeta (ui/bearbeta/layer-draw), each change a recipe step that the app's undo takes back: add_row for a new feature,
 * edit_cell on `geometri` for a new shape or place, delete_row for one removed. Nothing is fetched.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/layer-new', ['data/datasets', 'data/geo', 'data/field-collect'], (datasets, geo, collect) => {
    const GEOMETRY = 'geometri';
    /** The kinds of geometry a layer holds, and the GeoJSON types of each. */
    const KINDS = ['point', 'line', 'polygon'];
    const TYPES = { point: ['Point', 'MultiPoint'], line: ['LineString', 'MultiLineString'], polygon: ['Polygon', 'MultiPolygon'] };
    /** The systems offered: SWEREF 99 TM (the default), the twelve local SWEREF 99 zones and WGS 84. */
    const CRS = [3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018, 4326];
    const DEFAULT_CRS = 3006;
    const clean = (v, max = 255) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

    /**
     * The settings of a new layer with the defaults filled in, or an error the person can act on.
     * @param {{name?: string, geometry?: string, crs?: string|number, columns?: string}} input
     * @returns {{name: string, geometry: string, crs: string, columns: Array<{name: string, type: string}>}}
     */
    function settings(input = {}) {
      const code = input.crs === undefined || input.crs === null || input.crs === '' ? DEFAULT_CRS : geo.crsCode(input.crs);
      if (!code || !CRS.includes(code)) throw new Error(D.t('newlayer.err.crs', { crs: String(input.crs) }));
      const geometry = KINDS.includes(String(input.geometry)) ? String(input.geometry) : 'point';
      // The geometry column is the layer's own; a column of the same name among the person's is left out.
      const columns = collect.parseColumns(input.columns || '').filter((c) => c.name.toLowerCase() !== GEOMETRY);
      return { name: clean(input.name) || D.t('newlayer.default.name.' + geometry), geometry, crs: 'EPSG:' + code, columns };
    }

    /**
     * Make the layer as a dataset, with no features yet. Asks nothing and fetches nothing.
     * @param {Parameters<typeof settings>[0]} input @returns {Promise<any>} the dataset's meta
     */
    async function create(input) {
      const s = settings(input);
      return datasets.create({
        name: s.name, rows: [], columns: s.columns.concat([{ name: GEOMETRY, type: 'text' }]),
        source: { kind: 'new', format: 'kartlager', geometry: s.geometry, crs: s.crs, createdAt: new Date().toISOString() },
        importOptions: { crs: s.crs },
        description: D.t('newlayer.description', { kind: D.t('newlayer.geometry.' + s.geometry), crs: geo.crsText(s.crs) }),
      });
    }

    /** True for a layer made here: its features can be drawn on the map. @param {any} meta */
    const isLayer = (meta) => !!(meta && meta.source && meta.source.kind === 'new' && meta.source.format === 'kartlager');
    /** The kind of geometry a layer holds ('point', 'line' or 'polygon'). @param {any} meta */
    const kindOf = (meta) => (meta && meta.source && KINDS.includes(meta.source.geometry) ? meta.source.geometry : 'point');
    /** The layer's coordinate system as EPSG:<code>. @param {any} meta */
    const crsOf = (meta) => 'EPSG:' + (geo.crsCode(geo.crsOfMeta(meta)) || DEFAULT_CRS);

    /**
     * A geometry in WGS 84 (as the map gives it) in the layer's system: SWEREF 99 TM or a zone in metres to the millimetre, WGS 84
     * in degrees to the seventh decimal (about a centimetre).
     * @param {any} geometry @param {string} crs @returns {any}
     */
    function toCrs(geometry, crs) {
      const code = geo.crsCode(crs) || DEFAULT_CRS;
      const round = (v, d) => Math.round(v * d) / d;
      if (code === 4326) return geo.mapCoordinates(geometry, (c) => [round(c[0], 1e7), round(c[1], 1e7)]);
      return geo.mapCoordinates(geometry, (c) => { const p = geo.wgs84ToSweref(c[0], c[1], code); return [round(p[0], 1e3), round(p[1], 1e3)]; });
    }
    const finite = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
    const VALID = {
      Point: finite, MultiPoint: (c) => Array.isArray(c) && c.length > 0 && c.every(finite),
      LineString: (c) => Array.isArray(c) && c.length >= 2 && c.every(finite), MultiLineString: (c) => Array.isArray(c) && c.length > 0 && c.every((l) => VALID.LineString(l)),
      Polygon: (c) => Array.isArray(c) && c.length > 0 && c.every((r) => Array.isArray(r) && r.length >= 4 && r.every(finite)), MultiPolygon: (c) => Array.isArray(c) && c.length > 0 && c.every((p) => VALID.Polygon(p)),
    };
    /**
     * A geometry in WGS 84 for a layer of `kind`: of that kind, with usable positions; else an error the person can read.
     * @param {any} value GeoJSON (object or text) @param {string} kind @returns {any} the geometry
     */
    function check(value, kind) {
      const g = geo.parseGeometry(value);
      if (!g || !VALID[g.type] || !VALID[g.type](g.coordinates)) throw new Error(D.t('newlayer.err.geometry'));
      if (!TYPES[kind].includes(g.type)) throw new Error(D.t('newlayer.err.kind', { kind: D.t('newlayer.geometry.' + kind) }));
      return { type: g.type, coordinates: g.coordinates };
    }
    /** The layer's meta, refused for a dataset that is not a layer made here. */
    async function layerOf(id) {
      const meta = await datasets.get(id);
      if (!isLayer(meta)) throw new Error(D.t('newlayer.err.notlayer'));
      return meta;
    }
    /** Apply an edit as a recipe step and save the layer at once. */
    async function run(id, op, params) {
      const result = await D.require('data/recipes').apply(id, op, params);
      await datasets.flushSaves();
      return result;
    }
    /**
     * A new feature: its geometry (WGS 84, as drawn) written in the layer's system, with values for the other columns.
     * @param {string} id @param {any} geometry @param {Record<string, any>} [values] @returns {Promise<number>} its rowid
     */
    async function addFeature(id, geometry, values = {}) {
      const meta = await layerOf(id);
      const g = toCrs(check(geometry, kindOf(meta)), crsOf(meta));
      const res = await run(id, 'add_row', { values: JSON.stringify(Object.assign({}, values, { [GEOMETRY]: JSON.stringify(g) })) });
      return res.rowid;
    }
    /** A feature's new shape or place (WGS 84). @param {string} id @param {number} rowid @param {any} geometry */
    async function setGeometry(id, rowid, geometry) {
      const meta = await layerOf(id);
      const g = toCrs(check(geometry, kindOf(meta)), crsOf(meta));
      return run(id, 'edit_cell', { rowid: Number(rowid), column: GEOMETRY, value: JSON.stringify(g) });
    }
    /** Remove a feature. @param {string} id @param {number} rowid */
    const deleteFeature = (id, rowid) => run(id, 'delete_row', { rowid: Number(rowid) });
    /** Undo the layer's last change with the app's undo, saved at once. @param {string} id @returns {Promise<string>} its label */
    async function undo(id) {
      const label = await D.require('data/recipes').undo(id);
      await datasets.flushSaves();
      return label;
    }

    return { GEOMETRY, KINDS, TYPES, CRS, DEFAULT_CRS, settings, create, isLayer, kindOf, crsOf, toCrs, check, addFeature, setGeometry, deleteFeature, undo };
  });
})();
