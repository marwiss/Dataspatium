// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Finding rows by where they are: inside a municipality or county, near a point, or inside a rectangle such as what a map
 * shows. A row counts by one point: its coordinates, or the middle of its geometry's bounding box. That is enough to say
 * which municipality a building is in, and it is stated in the documentation that it is not an exact overlay; the Geo tab
 * does those. Rows are read in small batches, so that a large table does not stop the page.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/spatial-search', ['data/datasets', 'data/geo', 'data/boundaries', 'viz/leaflet'], (datasets, geo, boundaries, leaflet) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const BATCH = 2000;
    const EARTH_KM = 6371;
    const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

    /** The middle of a geometry's bounding box. */
    function centreOf(geometry) {
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      const visit = (c) => {
        if (typeof c[0] === 'number') {
          if (c[0] < minX) minX = c[0];
          if (c[0] > maxX) maxX = c[0];
          if (c[1] < minY) minY = c[1];
          if (c[1] > maxY) maxY = c[1];
          return;
        }
        for (const part of c) visit(part);
      };
      if (geometry.type === 'GeometryCollection') { for (const g of geometry.geometries || []) visit(g.coordinates || []); } else visit(geometry.coordinates || []);
      return minX === Infinity ? null : [(minX + maxX) / 2, (minY + maxY) / 2];
    }
    /** Ray casting on one ring. */
    function inRing(point, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
        if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    /** Inside a polygon or multipolygon, holes taken into account. */
    function inGeometry(point, geometry) {
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      return polygons.some((rings) => rings.length && inRing(point, rings[0]) && !rings.slice(1).some((hole) => inRing(point, hole)));
    }
    function kmBetween(a, b) {
      const rad = (x) => (x * Math.PI) / 180;
      const dLat = rad(b[1] - a[1]); const dLon = rad(b[0] - a[0]);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
      return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
    }

    /** The test for an area. @param {any} area @returns {Promise<((point: number[]) => boolean)|null>} */
    async function testFor(area) {
      if (area.type === 'near') {
        const centre = [Number(area.lon), Number(area.lat)];
        const km = Number(area.km);
        if (!centre.every(Number.isFinite) || !Number.isFinite(km) || km <= 0) return null;
        return (point) => kmBetween(point, centre) <= km;
      }
      if (area.type === 'box') return (point) => point[0] >= area.west && point[0] <= area.east && point[1] >= area.south && point[1] <= area.north;
      if (area.type === 'region') {
        const features = await boundaries.features(area.boundary);
        const hit = features.find((f) => String(f.code) === String(area.code));
        return hit && hit.geometry ? (point) => inGeometry(point, hit.geometry) : null;
      }
      return null;
    }

    /**
     * The rows inside an area, or null when the dataset has no places or the area cannot be used.
     * @param {string} id
     * @param {{type: 'region', boundary: string, code: string}|{type: 'near', lat: number, lon: number, km: number}|{type: 'box', west: number, east: number, south: number, north: number}} area
     * @returns {Promise<number[]|null>}
     */
    async function rowsWithin(id, area) {
      const handle = await datasets.ensureOpen(id);
      if (!(await leaflet.drawable(id))) return null;
      const test = await testFor(area);
      if (!test) return null;
      const geometry = leaflet.geometryColumn(handle.columns);
      const coords = geometry ? null : leaflet.coordinateColumns(handle.columns);
      const columns = geometry ? q(geometry) : `${q(coords.lon)}, ${q(coords.lat)}`;
      const out = [];
      for (let last = 0; ;) {
        const r = await handle.engine.exec(`select rowid, ${columns} from data where rowid > ? order by rowid limit ${BATCH}`, [last]);
        const rows = r[0] ? r[0].values : [];
        if (!rows.length) break;
        for (const row of rows) {
          last = row[0];
          let shape = null;
          if (geometry) { try { shape = geo.parseGeometry(row[1]); } catch (_err) { shape = null; } } else if (typeof row[1] === 'number' && typeof row[2] === 'number') shape = { type: 'Point', coordinates: [row[1], row[2]] };
          if (!shape) continue;
          // Metres in the dataset's own system (SWEREF 99 TM when the file named none); a system the app cannot convert has no place.
          const place = geo.isProjected([shape]) ? geo.toWgs84(shape, geo.crsOfMeta(handle.meta) || undefined) : shape;
          const point = place ? centreOf(place) : null;
          if (point && test(point)) out.push(Number(row[0]));
        }
        await breathe();
      }
      return out;
    }

    return { rowsWithin, centreOf, inGeometry, kmBetween };
  });
})();
