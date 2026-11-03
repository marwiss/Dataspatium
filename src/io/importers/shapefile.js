// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Shapefile importer: a ZIP with .shp, .dbf and optionally .prj and .cpg (the usual download from SCB,
 * Lantmäteriet and others), or a bare .shp. Attributes become typed columns, geometries become GeoJSON in a
 * `geometry` text column (like the GeoJSON importer), optionally simplified with Douglas-Peucker. Point,
 * polyline, polygon and multipoint shapes with or without Z/M are read; coordinates stay in the file's
 * reference system (SWEREF99 TM metres or WGS84 degrees), which the map chart detects.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/shapefile', ['platform/storage/zip'], (zip) => {
    const EXT = /\.(shp|zip)$/i;
    /** @type {WeakMap<File, Promise<any[]>>} layers per file */
    const cache = new WeakMap();

    function detect(file) { return EXT.test(file.name); }

    /** Group the shapefile parts (shp, dbf, prj, cpg) by base name. */
    async function layersOf(file) {
      let p = cache.get(file);
      if (!p) {
        p = (async () => {
          const parts = {};
          if (/\.zip$/i.test(file.name)) {
            const entries = await zip.readZip(file);
            for (const [path, bytes] of Object.entries(entries)) {
              const m = /^(.*?)([^/]+)\.(shp|dbf|prj|cpg)$/i.exec(path);
              if (!m || /(^|\/)__MACOSX\//.test(path)) continue;
              const key = m[1] + m[2];
              (parts[key] = parts[key] || { name: m[2] })[m[3].toLowerCase()] = bytes;
            }
          } else {
            parts[file.name] = { name: file.name.replace(/\.shp$/i, ''), shp: new Uint8Array(await file.arrayBuffer()) };
          }
          const layers = Object.values(parts).filter((l) => l.shp);
          if (!layers.length) throw new Error('Filen innehåller ingen shapefile (.shp).');
          return layers;
        })();
        cache.set(file, p);
      }
      return p;
    }

    // ---- .shp ----
    function parseShp(bytes) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < 100 || dv.getInt32(0, false) !== 9994) throw new Error('Filen är inte en shapefile (fel filkod).');
      const shapeType = dv.getInt32(32, true);
      const geoms = [];
      let pos = 100;
      while (pos + 12 <= bytes.length) {
        const contentLength = dv.getInt32(pos + 4, false) * 2;
        const start = pos + 8;
        if (start + contentLength > bytes.length || contentLength < 4) break;
        const type = dv.getInt32(start, true);
        geoms.push(readShape(dv, start, type));
        pos = start + contentLength;
      }
      return { shapeType, geoms };
    }
    function readShape(dv, p, type) {
      if (type === 0) return null;
      const base = type % 10; // 1 point, 3 polyline, 5 polygon, 8 multipoint; +10 with Z, +20 with M
      if (base === 1) return { type: 'Point', coordinates: [dv.getFloat64(p + 4, true), dv.getFloat64(p + 12, true)] };
      if (base === 8) {
        const n = dv.getInt32(p + 36, true); const pts = [];
        for (let i = 0; i < n; i++) pts.push([dv.getFloat64(p + 40 + i * 16, true), dv.getFloat64(p + 48 + i * 16, true)]);
        return { type: 'MultiPoint', coordinates: pts };
      }
      if (base === 3 || base === 5) {
        const numParts = dv.getInt32(p + 36, true); const numPoints = dv.getInt32(p + 40, true);
        const parts = []; for (let i = 0; i < numParts; i++) parts.push(dv.getInt32(p + 44 + i * 4, true));
        const ptsOff = p + 44 + numParts * 4;
        const rings = parts.map((startIdx, i) => {
          const end = i + 1 < numParts ? parts[i + 1] : numPoints;
          const ring = [];
          for (let k = startIdx; k < end; k++) ring.push([dv.getFloat64(ptsOff + k * 16, true), dv.getFloat64(ptsOff + k * 16 + 8, true)]);
          return ring;
        });
        if (base === 3) return rings.length === 1 ? { type: 'LineString', coordinates: rings[0] } : { type: 'MultiLineString', coordinates: rings };
        return polygonsFromRings(rings);
      }
      return null;
    }
    /** Signed area; shapefiles store outer rings clockwise (negative) and holes counterclockwise. */
    function ringArea(ring) {
      let a = 0;
      for (let i = 0, n = ring.length; i < n; i++) { const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % n]; a += x1 * y2 - x2 * y1; }
      return a / 2;
    }
    function polygonsFromRings(rings) {
      const polys = [];
      for (const ring of rings) {
        if (ring.length < 4) continue;
        if (ringArea(ring) < 0 || !polys.length) polys.push([ring]);
        else polys[polys.length - 1].push(ring);
      }
      if (!polys.length) return null;
      return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
    }

    // ---- simplification (Douglas-Peucker, tolerance in map units) ----
    function perpDistance(pt, a, b) {
      const dx = b[0] - a[0]; const dy = b[1] - a[1];
      if (dx === 0 && dy === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
    }
    function simplifyLine(points, tol) {
      if (points.length <= 2) return points;
      const keep = new Uint8Array(points.length); keep[0] = 1; keep[points.length - 1] = 1;
      const stack = [[0, points.length - 1]];
      while (stack.length) {
        const [s, e] = stack.pop();
        let maxD = 0; let idx = -1;
        for (let i = s + 1; i < e; i++) { const d = perpDistance(points[i], points[s], points[e]); if (d > maxD) { maxD = d; idx = i; } }
        if (idx >= 0 && maxD > tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
      }
      return points.filter((_, i) => keep[i]);
    }
    function simplifyRing(ring, tol) {
      if (ring.length <= 4) return ring;
      const out = simplifyLine(ring, tol);
      return out.length >= 4 ? out : ring;
    }
    function simplifyGeometry(g, tol) {
      if (!g || tol <= 0) return g;
      switch (g.type) {
        case 'LineString': return { type: g.type, coordinates: simplifyLine(g.coordinates, tol) };
        case 'MultiLineString': return { type: g.type, coordinates: g.coordinates.map((l) => simplifyLine(l, tol)) };
        case 'Polygon': return { type: g.type, coordinates: g.coordinates.map((r) => simplifyRing(r, tol)) };
        case 'MultiPolygon': return { type: g.type, coordinates: g.coordinates.map((poly) => poly.map((r) => simplifyRing(r, tol))) };
        default: return g;
      }
    }
    function countPoints(g) {
      if (!g) return 0;
      const walk = (c) => (typeof c[0] === 'number' ? 1 : c.reduce((s, x) => s + walk(x), 0));
      return walk(g.coordinates);
    }

    // ---- .dbf ----
    function encodingLabel(cpg, bytes, headerLength) {
      if (cpg) {
        const text = new TextDecoder('latin1').decode(cpg).trim().toLowerCase();
        if (/utf-?8/.test(text)) return 'utf-8';
        const m = /(\d{3,5})/.exec(text);
        if (m && /^(1250|1251|1252|1253|1254|1257|850|437)$/.test(m[1])) return (m[1].length === 4 ? 'windows-' : 'cp') + m[1];
        if (/8859-?1\b|latin-?1/.test(text)) return 'iso-8859-1';
        if (/8859-?15/.test(text)) return 'iso-8859-15';
      }
      try { new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(headerLength)); return 'utf-8'; } catch (_err) { return 'windows-1252'; }
    }
    function parseDbf(bytes, cpg) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const numRecords = dv.getUint32(4, true); const headerLength = dv.getUint16(8, true); const recordLength = dv.getUint16(10, true);
      const fields = [];
      let off = 32;
      while (off + 32 <= headerLength && bytes[off] !== 0x0D) {
        let name = '';
        for (let i = 0; i < 11 && bytes[off + i]; i++) name += String.fromCharCode(bytes[off + i]);
        fields.push({ name: name.trim(), type: String.fromCharCode(bytes[off + 11]), length: bytes[off + 16], decimals: bytes[off + 17] });
        off += 32;
      }
      let decoder;
      try { decoder = new TextDecoder(encodingLabel(cpg, bytes, headerLength)); } catch (_err) { decoder = new TextDecoder('windows-1252'); }
      const rows = [];
      let pos = headerLength;
      for (let r = 0; r < numRecords && pos + recordLength <= bytes.length; r++, pos += recordLength) {
        if (bytes[pos] === 0x2A) continue; // deleted record
        let fpos = pos + 1; const row = [];
        for (const f of fields) {
          const raw = decoder.decode(bytes.subarray(fpos, fpos + f.length)).replace(/\u0000+$/g, '').trim();
          fpos += f.length;
          row.push(convertField(f, raw));
        }
        rows.push(row);
      }
      return { fields, rows };
    }
    function convertField(f, raw) {
      if (raw === '' || raw === null) return null;
      if (f.type === 'N' || f.type === 'F') { const n = Number(raw.replace(',', '.')); if (!Number.isFinite(n)) return null; return f.decimals === 0 && f.type === 'N' && Number.isInteger(n) ? n : n; }
      if (f.type === 'D') { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; }
      if (f.type === 'L') return /^[TtYyJj]$/.test(raw) ? 1 : (/^[FfNn]$/.test(raw) ? 0 : null);
      return raw;
    }
    function fieldType(f) {
      if (f.type === 'N') return f.decimals === 0 ? 'integer' : 'number';
      if (f.type === 'F') return 'number';
      if (f.type === 'D') return 'date';
      if (f.type === 'L') return 'boolean';
      return 'text';
    }
    /** The projection name from a .prj (WKT), e.g. "SWEREF99_TM"; empty when unknown. */
    function crsName(prj) {
      if (!prj) return '';
      const text = new TextDecoder('latin1').decode(prj);
      const m = /^\s*(PROJCS|GEOGCS|PROJCRS|GEOGCRS)\s*\[\s*"([^"]+)"/i.exec(text);
      return m ? m[2] : '';
    }

    /** @param {File} file @param {{layer?: string, simplify?: number}} [options] */
    async function parse(file, options = {}) {
      const layers = await layersOf(file);
      const layer = (options.layer && layers.find((l) => l.name === options.layer)) || layers[0];
      const shp = parseShp(layer.shp);
      const dbf = layer.dbf ? parseDbf(layer.dbf, layer.cpg) : { fields: [], rows: [] };
      const tol = Math.max(0, Number(options.simplify) || 0);
      const columns = dbf.fields.map((f) => f.name).concat(['geometry_type', 'geometry']);
      let points = 0;
      const rows = shp.geoms.map((g, i) => {
        const geom = tol > 0 ? simplifyGeometry(g, tol) : g;
        points += countPoints(geom);
        const attrs = dbf.rows[i] || dbf.fields.map(() => null);
        return attrs.concat([geom ? geom.type : null, geom ? JSON.stringify(geom) : null]);
      });
      const declaredTypes = dbf.fields.map(fieldType).concat(['text', 'text']);
      return { columns, rows, meta: { format: 'shapefile', layer: layer.name, layers: layers.map((l) => l.name), crs: crsName(layer.prj), simplify: tol, points, declaredTypes } };
    }

    /** @param {File} file @param {{layer?: string, simplify?: number, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const table = await parse(file, options);
      return { kind: 'shapefile', columns: table.columns, dataRows: table.rows.slice(0, options.previewRows || 100), totalRows: table.rows.length, header: true, layers: table.meta.layers, layer: table.meta.layer, crs: table.meta.crs, points: table.meta.points, declaredTypes: table.meta.declaredTypes };
    }

    return { id: 'shapefile', detect, preview, parse, parseShp, parseDbf, simplifyGeometry, polygonsFromRings, countPoints };
  });
})();
