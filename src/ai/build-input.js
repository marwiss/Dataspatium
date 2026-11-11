// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Facts from a dataset for a building brief (decision F43 b): the rows of a table (a field form's measurements, a schedule of rooms)
 * and the corners of its geometries in metres, so that a building footprint from the map or a measured outline reaches the AI as
 * plain text with real dimensions. Geometries in WGS 84 or SWEREF 99 TM are read with data/geo; each is given relative to its
 * south-west corner, so that the agent can place walls from (0, 0). Nothing here calls the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/build-input', ['data/datasets', 'data/geo'], (datasets, geo) => {
    const MAX_ROWS = 40;
    const MAX_POINTS = 60;
    const MAX_CHARS = 12000;
    const GEOMETRY_NAME = /^(geometry|geom|wkt|shape|the_geom|geometri)$/i;
    const round = (v) => Math.round(v * 100) / 100;

    /** The outline of a geometry as corners in metres relative to its south-west corner, or null. @param {any} value */
    function outline(value) {
      const g = geo.parseGeometry(value);
      if (!g) return null;
      const projected = geo.isProjected([g]);
      const toXY = (c) => (projected ? [Number(c[0]), Number(c[1])] : geo.wgs84ToSweref(Number(c[0]), Number(c[1])));
      let ring = null;
      const take = (type, coords) => {
        if (ring) return;
        if (type === 'Polygon') ring = coords[0];
        else if (type === 'MultiPolygon') ring = coords[0] && coords[0][0];
        else if (type === 'LineString') ring = coords;
        else if (type === 'MultiLineString') ring = coords[0];
        else if (type === 'Point') ring = [coords];
      };
      if (g.type === 'GeometryCollection') (g.geometries || []).forEach((x) => take(x.type, x.coordinates || []));
      else take(g.type, g.coordinates || []);
      if (!ring || !ring.length) return null;
      const pts = ring.map(toXY).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (!pts.length) return null;
      const minX = Math.min(...pts.map((p) => p[0])); const minY = Math.min(...pts.map((p) => p[1]));
      const rel = pts.map((p) => [round(p[0] - minX), round(p[1] - minY)]);
      const closed = rel.length > 2 && rel[0][0] === rel[rel.length - 1][0] && rel[0][1] === rel[rel.length - 1][1];
      const corners = (closed ? rel.slice(0, -1) : rel).slice(0, MAX_POINTS);
      return { corners, width: round(Math.max(...pts.map((p) => p[0])) - minX), depth: round(Math.max(...pts.map((p) => p[1])) - minY), origin: [round(minX), round(minY)], projected };
    }

    /**
     * The dataset's facts as text for the brief: the first rows with their columns, geometries as corners in metres.
     * @param {string} datasetId @param {{limit?: number}} [options]
     * @returns {Promise<{text: string, rows: number, geometries: number, name: string}>}
     */
    async function facts(datasetId, options = {}) {
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const limit = Math.max(1, Math.min(MAX_ROWS, Number(options.limit) || MAX_ROWS));
      const columns = await datasets.columns(datasetId);
      const rows = await datasets.query(datasetId, { limit });
      const geomCols = new Set(columns.filter((c) => c.type === 'text' && GEOMETRY_NAME.test(c.name)).map((c) => c.name));
      const lines = [D.t('ai.build.facts.block', { name: meta.name, n: rows.length })];
      let geometries = 0;
      for (const row of rows) {
        const parts = [];
        columns.forEach((c, i) => {
          const v = row[i];
          if (v === null || v === undefined || v === '') return;
          if (geomCols.has(c.name) || (c.type === 'text' && /^\s*(POLYGON|MULTIPOLYGON|LINESTRING|POINT)\b/i.test(String(v)))) {
            const o = outline(v);
            if (o) { geometries++; parts.push(D.t('ai.build.facts.geometry', { column: c.name, width: o.width, depth: o.depth, points: o.corners.map((p) => `(${p[0]}, ${p[1]})`).join(' ') })); }
            return;
          }
          parts.push(`${c.name}: ${String(v).slice(0, 200)}`);
        });
        if (parts.length) lines.push('- ' + parts.join('; '));
      }
      let text = lines.join('\n');
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + ' …';
      return { text, rows: rows.length, geometries, name: meta.name };
    }
    return { facts, outline, MAX_ROWS, MAX_POINTS };
  });
})();
