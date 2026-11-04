// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geographic analysis without code, on datasets with a geometry column or coordinate columns: measures (area,
 * length, centroid, extent), points in polygons (count or attach), nearest feature with distance, buffers,
 * overlays (intersection, difference), dissolve by attribute and simplification. Geometry work is done by Turf
 * (vendored, MIT) on the main thread in chunks with a pause between them, so the page stays responsive; every result
 * is a table with a `geometry` column (GeoJSON text) that opens as a map.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/geo', ['data/geo', 'data/datasets', 'viz/leaflet'], (geo, datasets, leaflet) => {
    const VENDOR = 'vendor/turf/turf.min.js';
    const CHUNK = 200;
    const MAX_ROWS = 100000;
    /** @type {Promise<any>|null} */ let loading = null;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

    function available() { return !!globalThis.turf; }
    /** Load the vendored Turf build (classic script, global `turf`). */
    function ensure() {
      if (globalThis.turf) return Promise.resolve(globalThis.turf);
      if (!loading) loading = D.assets.loadVendorScript(VENDOR).then(() => { if (!globalThis.turf) throw new Error(D.t('geo.err.load')); return globalThis.turf; }).catch((err) => { loading = null; throw err; });
      return loading;
    }

    /**
     * Every feature of a dataset in WGS 84 with all other columns as properties.
     * @param {string} id @param {{filters?: any[], listId?: string|null, maxRows?: number}} [options]
     * @returns {Promise<{features: any[], columns: any[], meta: any, geometryColumn: string|null, total: number, truncated: boolean}>}
     */
    async function featuresOfDataset(id, options = {}) {
      const meta = await datasets.get(id);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const columns = await datasets.columns(id);
      const layer = leaflet.layerFor(columns, meta);
      if (!layer) throw new Error(D.t('geo.err.nogeometry', { name: meta.name }));
      layer.popup = columns.filter((c) => c.name !== layer.geometry).map((c) => c.name);
      layer.filters = options.filters || []; layer.listId = options.listId || null; layer.maxRows = options.maxRows || MAX_ROWS;
      const data = await leaflet.featuresOf(layer, {});
      return { features: data.features, columns, meta, geometryColumn: layer.geometry, total: data.total, truncated: data.truncated };
    }
    const bboxOf = (turf, f) => { if (!f.bbox) f.bbox = turf.bbox(f); return f.bbox; };
    const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
    const isPolygon = (f) => f.geometry && /Polygon$/.test(f.geometry.type);
    const isLine = (f) => f.geometry && /LineString$/.test(f.geometry.type);
    const isPoint = (f) => f.geometry && /Point$/.test(f.geometry.type);
    const round = (v, d = 4) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) : null);
    /** A representative point of a feature: the point itself, or the centroid. */
    const pointOf = (turf, f) => (isPoint(f) && f.geometry.type === 'Point' ? f : turf.centroid(f));

    /** Column definitions: the source's property columns (typed) followed by the result's own columns. */
    function columnsFor(sourceColumns, exclude, extra) {
      const base = sourceColumns.filter((c) => !exclude.includes(c.name)).map((c) => ({ name: c.name, type: c.type, label: c.label || c.name }));
      return base.concat(extra.map((e) => (typeof e === 'string' ? { name: e, type: 'text' } : e)));
    }
    /** Prefix a second dataset's column names that clash with the first's. */
    function merged(colsA, colsB, prefix) {
      const names = new Set(colsA.map((c) => c.name));
      return colsB.map((c) => (names.has(c.name) ? Object.assign({}, c, { name: prefix + c.name, label: prefix + (c.label || c.name) }) : c));
    }
    const propsRow = (props, cols) => cols.map((c) => (props[c.name] === undefined ? null : props[c.name]));

    /**
     * Measures per feature: area (km²), length (km), centroid longitude and latitude, extent.
     * @param {{features: any[], columns: any[], geometryColumn: string|null}} src
     */
    async function measure(src, options = {}) {
      const turf = await ensure();
      const cols = columnsFor(src.columns, [], [{ name: 'geometri_typ', type: 'text' }, { name: 'area_km2', type: 'number' }, { name: 'langd_km', type: 'number' }, { name: 'mitt_lon', type: 'number' }, { name: 'mitt_lat', type: 'number' }, { name: 'vast', type: 'number' }, { name: 'syd', type: 'number' }, { name: 'ost', type: 'number' }, { name: 'nord', type: 'number' }, { name: 'geometry', type: 'text' }]);
      const own = cols.slice(0, cols.length - 10);
      const rows = [];
      for (let i = 0; i < src.features.length; i++) {
        if (i && i % CHUNK === 0) { await pause(); if (options.onProgress) options.onProgress(i, src.features.length); }
        const f = src.features[i];
        const c = turf.centroid(f).geometry.coordinates; const b = bboxOf(turf, f);
        rows.push(propsRow(f.properties || {}, own).concat([f.geometry.type, isPolygon(f) ? round(turf.area(f) / 1e6) : null, isLine(f) ? round(turf.length(f, { units: 'kilometers' })) : null, round(c[0], 6), round(c[1], 6), round(b[0], 6), round(b[1], 6), round(b[2], 6), round(b[3], 6), JSON.stringify(f.geometry)]));
      }
      return { columns: cols, rows };
    }

    /**
     * Points in polygons. mode 'count': one row per polygon with the number of points (and the sum of `valueColumn`);
     * mode 'attach': one row per point with the polygon's columns added (prefixed when the names clash).
     */
    async function pointsInPolygons(points, polygons, options = {}) {
      const turf = await ensure();
      const polys = polygons.features.filter(isPolygon);
      for (const p of polys) bboxOf(turf, p);
      const pts = points.features.map((f) => pointOf(turf, f));
      const hits = new Array(points.features.length).fill(-1);
      for (let i = 0; i < pts.length; i++) {
        if (i && i % CHUNK === 0) { await pause(); if (options.onProgress) options.onProgress(i, pts.length); }
        const c = pts[i].geometry.coordinates;
        for (let j = 0; j < polys.length; j++) {
          const b = polys[j].bbox;
          if (c[0] < b[0] || c[0] > b[2] || c[1] < b[1] || c[1] > b[3]) continue;
          if (turf.booleanPointInPolygon(pts[i], polys[j])) { hits[i] = j; break; }
        }
      }
      if (options.mode === 'attach') {
        const polyCols = merged(points.columns, polygons.columns.filter((c) => c.name !== polygons.geometryColumn), options.prefix || 'omrade_');
        const ownPoint = points.columns.filter((c) => c.name !== points.geometryColumn);
        const cols = ownPoint.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat(polyCols.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })), [{ name: 'geometry', type: 'text' }]);
        const rows = points.features.map((f, i) => {
          const poly = hits[i] >= 0 ? polys[hits[i]].properties || {} : {};
          const originalNames = polygons.columns.filter((c) => c.name !== polygons.geometryColumn).map((c) => c.name);
          return propsRow(f.properties || {}, ownPoint).concat(originalNames.map((n) => (hits[i] >= 0 && poly[n] !== undefined ? poly[n] : null)), [JSON.stringify(f.geometry)]);
        });
        return { columns: cols, rows, matched: hits.filter((h) => h >= 0).length };
      }
      const counts = new Array(polys.length).fill(0); const sums = new Array(polys.length).fill(0);
      const vi = options.valueColumn || null;
      for (let i = 0; i < hits.length; i++) if (hits[i] >= 0) { counts[hits[i]]++; if (vi) { const v = Number((points.features[i].properties || {})[vi]); if (Number.isFinite(v)) sums[hits[i]] += v; } }
      const own = polygons.columns.filter((c) => c.name !== polygons.geometryColumn);
      const cols = own.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat([{ name: options.countName || 'antal_punkter', type: 'integer' }], vi ? [{ name: 'summa_' + vi, type: 'number' }] : [], [{ name: 'geometry', type: 'text' }]);
      const rows = polys.map((p, j) => propsRow(p.properties || {}, own).concat([counts[j]], vi ? [round(sums[j], 6)] : [], [JSON.stringify(p.geometry)]));
      return { columns: cols, rows, matched: hits.filter((h) => h >= 0).length };
    }

    /** For every feature in `from`, the nearest feature in `to` (by representative points) with the distance in km. */
    async function nearest(from, to, options = {}) {
      const turf = await ensure();
      const targets = to.features.map((f, i) => { const p = pointOf(turf, f); p.properties = { __i: i }; return p; });
      const tc = turf.featureCollection(targets);
      const toOwn = to.columns.filter((c) => c.name !== to.geometryColumn);
      const prefix = options.prefix || 'narmaste_';
      const fromOwn = from.columns.filter((c) => c.name !== from.geometryColumn);
      const cols = fromOwn.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat(toOwn.map((c) => ({ name: prefix + c.name, type: c.type, label: prefix + (c.label || c.name) })), [{ name: 'avstand_km', type: 'number' }, { name: 'geometry', type: 'text' }]);
      const rows = [];
      for (let i = 0; i < from.features.length; i++) {
        if (i && i % 50 === 0) { await pause(); if (options.onProgress) options.onProgress(i, from.features.length); }
        const f = from.features[i];
        let near = null; let dist = null;
        if (targets.length) { const p = pointOf(turf, f); const n = turf.nearestPoint(p, tc); near = to.features[n.properties.__i]; dist = round(turf.distance(p, n, { units: 'kilometers' }), 3); }
        rows.push(propsRow(f.properties || {}, fromOwn).concat(toOwn.map((c) => (near ? ((near.properties || {})[c.name] === undefined ? null : near.properties[c.name]) : null)), [dist, JSON.stringify(f.geometry)]));
      }
      return { columns: cols, rows };
    }

    /** Buffers of `radius` metres around every feature. */
    async function buffer(src, radius, options = {}) {
      const turf = await ensure();
      const own = src.columns.filter((c) => c.name !== src.geometryColumn);
      const cols = own.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat([{ name: 'buffert_m', type: 'number' }, { name: 'area_km2', type: 'number' }, { name: 'geometry', type: 'text' }]);
      const rows = [];
      for (let i = 0; i < src.features.length; i++) {
        if (i && i % 50 === 0) { await pause(); if (options.onProgress) options.onProgress(i, src.features.length); }
        const f = src.features[i];
        const b = turf.buffer(f, radius / 1000, { units: 'kilometers', steps: options.steps || 16 });
        if (!b) continue;
        rows.push(propsRow(f.properties || {}, own).concat([radius, round(turf.area(b) / 1e6), JSON.stringify(b.geometry)]));
      }
      return { columns: cols, rows };
    }

    /**
     * Overlay of two polygon datasets. 'intersect': one row per overlapping pair with both sets of columns and the
     * common area; 'difference': every feature of `a` with the overlapping parts of `b` removed.
     */
    async function overlay(a, b, options = {}) {
      const turf = await ensure();
      const polysA = a.features.filter(isPolygon); const polysB = b.features.filter(isPolygon);
      for (const p of polysA) bboxOf(turf, p); for (const p of polysB) bboxOf(turf, p);
      const ownA = a.columns.filter((c) => c.name !== a.geometryColumn);
      const ownB = b.columns.filter((c) => c.name !== b.geometryColumn);
      const rows = [];
      if (options.op === 'difference') {
        const cols = ownA.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat([{ name: 'area_km2', type: 'number' }, { name: 'geometry', type: 'text' }]);
        for (let i = 0; i < polysA.length; i++) {
          if (i && i % 20 === 0) { await pause(); if (options.onProgress) options.onProgress(i, polysA.length); }
          let cur = polysA[i];
          for (const q of polysB) { if (!cur || !overlaps(polysA[i].bbox, q.bbox)) continue; cur = turf.difference(turf.featureCollection([cur, q])); }
          if (!cur) continue;
          rows.push(propsRow(polysA[i].properties || {}, ownA).concat([round(turf.area(cur) / 1e6), JSON.stringify(cur.geometry)]));
        }
        return { columns: cols, rows };
      }
      const colsB = merged(a.columns, ownB, options.prefix || 'b_');
      const cols = ownA.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat(colsB.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })), [{ name: 'area_km2', type: 'number' }, { name: 'geometry', type: 'text' }]);
      for (let i = 0; i < polysA.length; i++) {
        if (i && i % 20 === 0) { await pause(); if (options.onProgress) options.onProgress(i, polysA.length); }
        for (const q of polysB) {
          if (!overlaps(polysA[i].bbox, q.bbox)) continue;
          let x = null;
          try { x = turf.intersect(turf.featureCollection([polysA[i], q])); } catch (_err) { x = null; }
          if (!x) continue;
          rows.push(propsRow(polysA[i].properties || {}, ownA).concat(ownB.map((c) => ((q.properties || {})[c.name] === undefined ? null : q.properties[c.name])), [round(turf.area(x) / 1e6), JSON.stringify(x.geometry)]));
        }
      }
      return { columns: cols, rows };
    }

    /** Dissolve: the union of all polygons that share a value in `column` (or all of them), with count and area. */
    async function dissolve(src, column, options = {}) {
      const turf = await ensure();
      const groups = new Map();
      for (const f of src.features.filter(isPolygon)) { const k = column ? String((f.properties || {})[column] ?? '') : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
      const col = column ? src.columns.find((c) => c.name === column) : null;
      const cols = (col ? [{ name: col.name, type: col.type, label: col.label || col.name }] : []).concat([{ name: 'antal', type: 'integer' }, { name: 'area_km2', type: 'number' }, { name: 'geometry', type: 'text' }]);
      const rows = []; let i = 0;
      for (const [k, feats] of groups) {
        if (i++ % 5 === 4) { await pause(); if (options.onProgress) options.onProgress(i, groups.size); }
        let u = feats[0];
        if (feats.length > 1) { try { u = turf.union(turf.featureCollection(feats)); } catch (_err) { u = feats[0]; } }
        if (!u) continue;
        rows.push((col ? [k === '' ? null : (feats[0].properties || {})[column]] : []).concat([feats.length, round(turf.area(u) / 1e6), JSON.stringify(u.geometry)]));
      }
      return { columns: cols, rows };
    }

    /** Simplified geometries (Douglas-Peucker), tolerance in metres, with the vertex counts before and after. */
    async function simplify(src, toleranceM, options = {}) {
      const turf = await ensure();
      const own = src.columns.filter((c) => c.name !== src.geometryColumn);
      const cols = own.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })).concat([{ name: 'punkter_fore', type: 'integer' }, { name: 'punkter_efter', type: 'integer' }, { name: 'geometry', type: 'text' }]);
      const count = (g) => { let n = 0; const visit = (c) => { if (typeof c[0] === 'number') n++; else for (const x of c) visit(x); }; if (g && g.coordinates) visit(g.coordinates); return n; };
      const rows = [];
      for (let i = 0; i < src.features.length; i++) {
        if (i && i % 50 === 0) { await pause(); if (options.onProgress) options.onProgress(i, src.features.length); }
        const f = src.features[i];
        let s = f;
        try { s = turf.simplify(f, { tolerance: toleranceM / 111320, highQuality: false, mutate: false }); } catch (_err) { s = f; }
        rows.push(propsRow(f.properties || {}, own).concat([count(f.geometry), count(s.geometry), JSON.stringify(s.geometry)]));
      }
      return { columns: cols, rows };
    }

    return { available, ensure, featuresOfDataset, measure, pointsInPolygons, nearest, buffer, overlay, dissolve, simplify, MAX_ROWS };
  });
})();
