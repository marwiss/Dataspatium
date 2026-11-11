// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Facts from a dataset for a building brief (decision F43 b): the rows of a table (a field form's measurements, a schedule of rooms)
 * and the corners of its geometries in metres, so that a building footprint from the map or a measured outline reaches the AI as
 * plain text with real dimensions. Each geometry is given relative to its south-west corner, so that the agent can place walls from
 * (0, 0), together with that corner's place on earth (the map projection's eastings and northings and WGS 84), which the write tool
 * set_site needs (step 1). Geometries in WGS 84 are projected to SWEREF 99 TM; a projected geometry keeps the dataset's system when
 * it is a metric one, and Web Mercator is projected anew. Ground heights at the corners come from Lantmäteriet's terrain model only
 * when the caller asks (`heights: true`, a button press), through api/heights with its consent; nothing else here calls the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/build-input', ['data/datasets', 'data/geo'], (datasets, geo) => {
    const MAX_ROWS = 40;
    const MAX_POINTS = 60;
    const MAX_CHARS = 12000;
    /** At most this many corners are looked up in the terrain model for one brief. */
    const MAX_HEIGHTS = 400;
    const GEOMETRY_NAME = /^(geometry|geom|wkt|shape|the_geom|geometri)$/i;
    const round = (v) => Math.round(v * 100) / 100;

    /** The EPSG code the outline's metres are in: the dataset's metric system, SWEREF 99 TM otherwise. */
    function metricCode(crs) {
      const code = geo.crsCode(crs);
      if (!code) return 3006;
      if (geo.SWEREF_ZONES[code] || geo.TM_ZONES[code] || code === 3057 || code === 3021) return code;
      return null;
    }

    /**
     * The outline of a geometry as corners in metres relative to its south-west corner, or null; with that corner in the map
     * projection (`origin`, `epsg`) and in WGS 84 (`lat`, `lon`) when the system is known.
     * @param {any} value @param {string} [crs] the dataset's coordinate system ('' for unnamed: SWEREF 99 TM when projected)
     */
    function outline(value, crs) {
      const g = geo.parseGeometry(value);
      if (!g) return null;
      const projected = geo.isProjected([g]);
      let code = projected ? metricCode(crs) : 3006;
      let source = g;
      // Web Mercator and other non-metric projections: through WGS 84 to SWEREF 99 TM, so that the metres are true.
      if (projected && code === null) {
        const wgs = geo.toWgs84(g, crs);
        if (!wgs) return null;
        source = wgs; code = 3006;
      }
      const fromDegrees = source !== g || !projected;
      const toXY = (c) => (fromDegrees ? geo.wgs84ToSweref(Number(c[0]), Number(c[1])) : [Number(c[0]), Number(c[1])]);
      let ring = null;
      const take = (type, coords) => {
        if (ring) return;
        if (type === 'Polygon') ring = coords[0];
        else if (type === 'MultiPolygon') ring = coords[0] && coords[0][0];
        else if (type === 'LineString') ring = coords;
        else if (type === 'MultiLineString') ring = coords[0];
        else if (type === 'Point') ring = [coords];
      };
      if (source.type === 'GeometryCollection') (source.geometries || []).forEach((x) => take(x.type, x.coordinates || []));
      else take(source.type, source.coordinates || []);
      if (!ring || !ring.length) return null;
      const pts = ring.map(toXY).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (!pts.length) return null;
      const minX = Math.min(...pts.map((p) => p[0])); const minY = Math.min(...pts.map((p) => p[1]));
      const rel = pts.map((p) => [round(p[0] - minX), round(p[1] - minY)]);
      const closed = rel.length > 2 && rel[0][0] === rel[rel.length - 1][0] && rel[0][1] === rel[rel.length - 1][1];
      const corners = (closed ? rel.slice(0, -1) : rel).slice(0, MAX_POINTS);
      // The south-west corner on earth: back through the projection the metres are in.
      let lat = null; let lon = null;
      try {
        const back = code === 3006 ? { type: 'Point', coordinates: geo.swerefToWgs84(minX, minY, 3006) } : geo.toWgs84({ type: 'Point', coordinates: [minX, minY] }, 'EPSG:' + code);
        if (back && Array.isArray(back.coordinates) && Number.isFinite(back.coordinates[0]) && Number.isFinite(back.coordinates[1])) { lon = back.coordinates[0]; lat = back.coordinates[1]; }
      } catch (_e) { lat = null; lon = null; }
      return { corners, width: round(Math.max(...pts.map((p) => p[0])) - minX), depth: round(Math.max(...pts.map((p) => p[1])) - minY), origin: [round(minX), round(minY)], epsg: code, lat, lon, projected };
    }

    /**
     * The ground heights (RH 2000) at an outline's corners from Lantmäteriet's terrain model, or null when the corners are not in
     * SWEREF 99 TM. Throws what api/heights throws (no source, consent refused, the net).
     * @param {Array<{origin: number[], corners: number[][], epsg: number|null}>} outlines
     * @returns {Promise<Array<Array<number|null>|null>>}
     */
    async function groundHeights(outlines) {
      const points = []; const index = [];
      outlines.forEach((o, k) => {
        if (!o || o.epsg !== 3006) { index.push(null); return; }
        const at = [];
        for (const c of o.corners) { if (points.length >= MAX_HEIGHTS) break; at.push(points.length); points.push([o.origin[0] + c[0], o.origin[1] + c[1]]); }
        index.push(at);
      });
      if (!points.length) return outlines.map(() => null);
      const { heights } = await D.require('api/heights').at(points);
      return index.map((at) => (at ? at.map((i) => (heights[i] === undefined ? null : heights[i])) : null));
    }

    /**
     * The dataset's facts as text for the brief: the first rows with their columns, geometries as corners in metres with the
     * south-west corner's place, and with `heights` the ground height at each corner.
     * @param {string} datasetId @param {{limit?: number, heights?: boolean}} [options]
     * @returns {Promise<{text: string, rows: number, geometries: number, name: string, heights: number, heightsError: string}>}
     */
    async function facts(datasetId, options = {}) {
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const crs = geo.crsOfMeta(meta);
      const limit = Math.max(1, Math.min(MAX_ROWS, Number(options.limit) || MAX_ROWS));
      const columns = await datasets.columns(datasetId);
      const rows = await datasets.query(datasetId, { limit });
      const geomCols = new Set(columns.filter((c) => c.type === 'text' && GEOMETRY_NAME.test(c.name)).map((c) => c.name));
      const isGeometry = (c, v) => geomCols.has(c.name) || (c.type === 'text' && /^\s*(POLYGON|MULTIPOLYGON|LINESTRING|POINT)\b/i.test(String(v)));
      // First the outlines of every row, so that the terrain model is asked once for all their corners.
      const outlines = [];
      const perRow = rows.map((row) => columns.map((c, i) => {
        const v = row[i];
        if (v === null || v === undefined || v === '' || !isGeometry(c, v)) return null;
        const o = outline(v, crs);
        if (o) outlines.push(o);
        return o;
      }));
      let heightsOf = new Map(); let heightsError = ''; let looked = 0;
      if (options.heights && outlines.length) {
        try {
          const got = await groundHeights(outlines);
          outlines.forEach((o, k) => { if (got[k]) { heightsOf.set(o, got[k]); looked += got[k].filter((x) => x !== null).length; } });
        } catch (err) { heightsError = String((err && err.message) || err); heightsOf = new Map(); }
      }
      const lines = [D.t('ai.build.facts.block', { name: meta.name, n: rows.length })];
      let geometries = 0;
      rows.forEach((row, r) => {
        const parts = [];
        columns.forEach((c, i) => {
          const v = row[i];
          if (v === null || v === undefined || v === '') return;
          if (isGeometry(c, v)) {
            const o = perRow[r][i];
            if (!o) return;
            geometries++;
            let text = D.t('ai.build.facts.geometry', { column: c.name, width: o.width, depth: o.depth, points: o.corners.map((p) => `(${p[0]}, ${p[1]})`).join(' ') });
            if (o.epsg && o.lat !== null && o.lon !== null) text += '; ' + D.t('ai.build.facts.origin', { epsg: String(o.epsg), e: String(o.origin[0]), n: String(o.origin[1]), lat: o.lat.toFixed(6), lon: o.lon.toFixed(6) });
            const hs = heightsOf.get(o);
            if (hs && hs.some((x) => x !== null)) {
              const known = hs.filter((x) => x !== null);
              text += '; ' + D.t('ai.build.facts.heights', { heights: hs.map((x) => (x === null ? '–' : String(x))).join(', '), low: String(Math.min(...known)), high: String(Math.max(...known)) });
            }
            parts.push(text);
            return;
          }
          parts.push(`${c.name}: ${String(v).slice(0, 200)}`);
        });
        if (parts.length) lines.push('- ' + parts.join('; '));
      });
      let text = lines.join('\n');
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + ' …';
      return { text, rows: rows.length, geometries, name: meta.name, heights: looked, heightsError };
    }
    return { facts, outline, groundHeights, MAX_ROWS, MAX_POINTS, MAX_HEIGHTS };
  });
})();
