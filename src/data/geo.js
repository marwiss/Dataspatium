// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geometry helpers shared by importers, exporters and the map charts: parse a geometry cell (GeoJSON
 * text or object, WKT such as POLYGON((...)) with optional Z/M and SRID prefix), tell projected
 * coordinates from longitude/latitude, and convert between SWEREF 99 TM (EPSG:3006, the projection
 * of Swedish geodata) and WGS 84 with Lantmäteriet's Gauss-Krüger formulas.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/geo', [], () => {
    /** Nested parentheses of a WKT body into nested arrays of [x, y]. */
    function parseNested(str) {
      let i = 0;
      const skipWs = () => { while (i < str.length && /\s/.test(str[i])) i++; };
      function list() {
        if (str[i] !== '(') throw new Error('WKT: förväntade (');
        i++;
        const items = [];
        for (;;) {
          skipWs();
          if (str[i] === '(') items.push(list());
          else {
            const start = i;
            while (i < str.length && str[i] !== ',' && str[i] !== ')') i++;
            const nums = str.slice(start, i).trim().split(/\s+/).map(Number);
            if (nums.length < 2 || nums.slice(0, 2).some((n) => !Number.isFinite(n))) throw new Error('WKT: ogiltig koordinat');
            items.push([nums[0], nums[1]]);
          }
          skipWs();
          if (str[i] === ',') { i++; continue; }
          if (str[i] === ')') { i++; return items; }
          throw new Error('WKT: oväntat tecken');
        }
      }
      skipWs();
      return list();
    }
    const isPoint = (v) => Array.isArray(v) && typeof v[0] === 'number';

    /** WKT text -> GeoJSON geometry, or null when the text is not WKT. */
    function wktToGeoJson(text) {
      const s = String(text || '').trim().replace(/^SRID=\d+\s*;\s*/i, '');
      const m = /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*(ZM|Z|M)?\s*(EMPTY|\(.*\))\s*$/is.exec(s);
      if (!m) return null;
      const type = m[1].toUpperCase();
      if (m[3].toUpperCase() === 'EMPTY') return null;
      let items;
      try { items = parseNested(m[3]); } catch (_err) { return null; }
      switch (type) {
        case 'POINT': return isPoint(items[0]) ? { type: 'Point', coordinates: items[0] } : null;
        case 'LINESTRING': return { type: 'LineString', coordinates: items };
        case 'POLYGON': return { type: 'Polygon', coordinates: items };
        case 'MULTIPOINT': return { type: 'MultiPoint', coordinates: items.map((it) => (isPoint(it) ? it : it[0])) };
        case 'MULTILINESTRING': return { type: 'MultiLineString', coordinates: items };
        case 'MULTIPOLYGON': return { type: 'MultiPolygon', coordinates: items };
        default: return null;
      }
    }

    /** A geometry cell (object, GeoJSON text, Feature text or WKT) -> GeoJSON geometry or null. */
    function parseGeometry(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'object') return value.type === 'Feature' ? value.geometry || null : value;
      const s = String(value).trim();
      if (!s) return null;
      if (s[0] === '{') {
        try { const g = JSON.parse(s); return g && g.type === 'Feature' ? g.geometry || null : g; } catch (_err) { return null; }
      }
      return wktToGeoJson(s);
    }

    function firstCoordinate(c) { let v = c; while (Array.isArray(v) && Array.isArray(v[0])) v = v[0]; return Array.isArray(v) && typeof v[0] === 'number' ? v : null; }
    /** True when the first coordinate found cannot be longitude/latitude (projected metres such as SWEREF99 TM). */
    function isProjected(geometries) {
      for (const g of geometries || []) {
        const c = g && g.coordinates ? firstCoordinate(g.coordinates) : null;
        if (c) return Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
      }
      return false;
    }

    /** Bounding box {minX, minY, maxX, maxY} over geometries (or anything with `coordinates`); null when empty. */
    function bounds(geometries) {
      let b = null;
      const visit = (c) => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
          if (!b) b = { minX: c[0], minY: c[1], maxX: c[0], maxY: c[1] };
          else { b.minX = Math.min(b.minX, c[0]); b.minY = Math.min(b.minY, c[1]); b.maxX = Math.max(b.maxX, c[0]); b.maxY = Math.max(b.maxY, c[1]); }
        } else for (const x of c) visit(x);
      };
      for (const g of geometries || []) {
        if (!g) continue;
        if (g.type === 'GeometryCollection') (g.geometries || []).forEach((gg) => visit(gg && gg.coordinates));
        else visit(g.coordinates);
      }
      return b;
    }

    // GRS 80 and SWEREF 99 TM (EPSG:3006): Gauss-Krüger series as published by Lantmäteriet, millimetre accuracy.
    const A = 6378137;
    const F = 1 / 298.257222101;
    const K0 = 0.9996;
    const LON0 = 15;
    const FALSE_E = 500000;
    const FALSE_N = 0;
    const DEG = Math.PI / 180;
    function tmConstants() {
      const e2 = F * (2 - F);
      const n = F / (2 - F);
      const aHat = (A / (1 + n)) * (1 + (n ** 2) / 4 + (n ** 4) / 64);
      return { e2, n, aHat };
    }

    /** SWEREF 99 TM easting/northing in metres -> [longitude, latitude] in degrees. */
    function swerefToWgs84(x, y) {
      const { e2, n, aHat } = tmConstants();
      const xi = (y - FALSE_N) / (K0 * aHat);
      const eta = (x - FALSE_E) / (K0 * aHat);
      const d1 = n / 2 - (2 * n ** 2) / 3 + (37 * n ** 3) / 96 - (n ** 4) / 360;
      const d2 = (n ** 2) / 48 + (n ** 3) / 15 - (437 * n ** 4) / 1440;
      const d3 = (17 * n ** 3) / 480 - (37 * n ** 4) / 840;
      const d4 = (4397 * n ** 4) / 161280;
      const xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta) - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
      const etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta) - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
      const phiStar = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
      const dLon = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
      const aS = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
      const bS = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
      const cS = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
      const dS = -(4279 * e2 ** 4) / 1260;
      const s = Math.sin(phiStar);
      const phi = phiStar + s * Math.cos(phiStar) * (aS + bS * s ** 2 + cS * s ** 4 + dS * s ** 6);
      return [LON0 + dLon / DEG, phi / DEG];
    }

    /** [longitude, latitude] in degrees -> SWEREF 99 TM [easting, northing] in metres. */
    function wgs84ToSweref(lon, lat) {
      const { e2, n, aHat } = tmConstants();
      const phi = lat * DEG;
      const aC = e2;
      const bC = (5 * e2 ** 2 - e2 ** 3) / 6;
      const cC = (104 * e2 ** 3 - 45 * e2 ** 4) / 120;
      const dC = (1237 * e2 ** 4) / 1260;
      const s = Math.sin(phi);
      const phiStar = phi - s * Math.cos(phi) * (aC + bC * s ** 2 + cC * s ** 4 + dC * s ** 6);
      const dLon = (lon - LON0) * DEG;
      const xiP = Math.atan(Math.tan(phiStar) / Math.cos(dLon));
      const etaP = Math.atanh(Math.cos(phiStar) * Math.sin(dLon));
      const b1 = n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16 + (41 * n ** 4) / 180;
      const b2 = (13 * n ** 2) / 48 - (3 * n ** 3) / 5 + (557 * n ** 4) / 1440;
      const b3 = (61 * n ** 3) / 240 - (103 * n ** 4) / 140;
      const b4 = (49561 * n ** 4) / 161280;
      const north = K0 * aHat * (xiP + b1 * Math.sin(2 * xiP) * Math.cosh(2 * etaP) + b2 * Math.sin(4 * xiP) * Math.cosh(4 * etaP) + b3 * Math.sin(6 * xiP) * Math.cosh(6 * etaP) + b4 * Math.sin(8 * xiP) * Math.cosh(8 * etaP)) + FALSE_N;
      const east = K0 * aHat * (etaP + b1 * Math.cos(2 * xiP) * Math.sinh(2 * etaP) + b2 * Math.cos(4 * xiP) * Math.sinh(4 * etaP) + b3 * Math.cos(6 * xiP) * Math.sinh(6 * etaP) + b4 * Math.cos(8 * xiP) * Math.sinh(8 * etaP)) + FALSE_E;
      return [east, north];
    }

    /** New geometry with every position replaced by fn([x, y]) -> [x, y]. */
    function mapCoordinates(geometry, fn) {
      if (!geometry) return geometry;
      const walk = (c) => (Array.isArray(c) && typeof c[0] === 'number' ? fn(c) : (Array.isArray(c) ? c.map(walk) : c));
      if (geometry.type === 'GeometryCollection') return Object.assign({}, geometry, { geometries: (geometry.geometries || []).map((g) => mapCoordinates(g, fn)) });
      return Object.assign({}, geometry, { coordinates: walk(geometry.coordinates || []) });
    }

    /** Projected geometry (assumed SWEREF 99 TM, the Swedish standard) -> WGS 84; degrees pass through. */
    function toWgs84(geometry) {
      return isProjected([geometry]) ? mapCoordinates(geometry, (c) => swerefToWgs84(c[0], c[1])) : geometry;
    }

    return { parseGeometry, wktToGeoJson, firstCoordinate, isProjected, bounds, swerefToWgs84, wgs84ToSweref, mapCoordinates, toWgs84 };
  });
})();
