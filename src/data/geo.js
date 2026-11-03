// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geometry helpers shared by importers and the map chart: parse a geometry cell (GeoJSON text or object,
 * WKT such as POLYGON((...)) with optional Z/M and SRID prefix) and tell projected coordinates from
 * longitude/latitude.
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

    return { parseGeometry, wktToGeoJson, firstCoordinate, isProjected };
  });
})();
