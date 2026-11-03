// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * SQLite importer. A Dataspatium file (tables data, _columns, _meta) is restored with its metadata;
 * any other SQLite database offers its tables and imports the chosen one with types from the schema.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/sqlite', ['engines/sqlite'], (sqlite) => {
    const EXT = /\.(sqlite|sqlite3|db|s3db|gpkg)$/i;
    function detect(file) { return EXT.test(file.name) || /sqlite|geopackage/.test(file.type || ''); }

    // ---- GeoPackage: geometry blobs (GPB header + WKB) become GeoJSON text like the GeoJSON importer ----
    function readWkb(dv, cur) {
      const little = dv.getUint8(cur.pos) === 1; cur.pos += 1;
      let type = dv.getUint32(cur.pos, little); cur.pos += 4;
      let hasZ = false; let hasM = false;
      if (type & 0x80000000) { hasZ = true; type &= 0x7fffffff; }
      if (type & 0x40000000) { hasM = true; type &= 0x3fffffff; }
      if (type & 0x20000000) { type &= 0x1fffffff; cur.pos += 4; } // EWKB SRID
      if (type >= 3000) { hasZ = true; hasM = true; type -= 3000; } else if (type >= 2000) { hasM = true; type -= 2000; } else if (type >= 1000) { hasZ = true; type -= 1000; }
      const dims = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);
      const point = () => { const x = dv.getFloat64(cur.pos, little); const y = dv.getFloat64(cur.pos + 8, little); cur.pos += 8 * dims; return [x, y]; };
      const line = () => { const n = dv.getUint32(cur.pos, little); cur.pos += 4; const pts = []; for (let i = 0; i < n; i++) pts.push(point()); return pts; };
      switch (type) {
        case 1: return { type: 'Point', coordinates: point() };
        case 2: return { type: 'LineString', coordinates: line() };
        case 3: { const n = dv.getUint32(cur.pos, little); cur.pos += 4; const rings = []; for (let i = 0; i < n; i++) rings.push(line()); return { type: 'Polygon', coordinates: rings }; }
        case 4: case 5: case 6: case 7: {
          const n = dv.getUint32(cur.pos, little); cur.pos += 4; const parts = [];
          for (let i = 0; i < n; i++) parts.push(readWkb(dv, cur));
          if (type === 7) return { type: 'GeometryCollection', geometries: parts };
          return { type: { 4: 'MultiPoint', 5: 'MultiLineString', 6: 'MultiPolygon' }[type], coordinates: parts.map((p) => p.coordinates) };
        }
        default: throw new Error(D.t('import.err.wkb', { type }));
      }
    }
    /** GeoPackage binary (GPB) blob -> GeoJSON text, or null for empty geometries. */
    function gpbToGeoJson(blob) {
      if (!(blob instanceof Uint8Array) || blob.length < 8 || blob[0] !== 0x47 || blob[1] !== 0x50) return null;
      const flags = blob[3];
      const envelopeBytes = [0, 32, 48, 48, 64][(flags >> 1) & 7] || 0;
      if ((flags >> 4) & 1) return null;
      const start = 8 + envelopeBytes;
      const dv = new DataView(blob.buffer, blob.byteOffset + start, blob.byteLength - start);
      try { const geom = readWkb(dv, { pos: 0 }); return geom ? JSON.stringify(geom) : null; } catch (_err) { return null; }
    }

    async function openFile(file) {
      const bytes = await file.arrayBuffer();
      const head = new TextDecoder('latin1').decode(new Uint8Array(bytes.slice(0, 15)));
      if (head !== 'SQLite format 3') throw new Error(D.t('import.err.notsqlite'));
      const engine = new sqlite.SqliteEngine();
      await engine.start();
      await engine.open(bytes);
      return { engine, bytes };
    }
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    function sqlType(decl) {
      const d = String(decl || '').toUpperCase();
      if (/INT/.test(d)) return 'integer';
      if (/REAL|FLOA|DOUB|NUM|DEC/.test(d)) return 'number';
      if (/BOOL/.test(d)) return 'boolean';
      if (/DATE|TIME/.test(d)) return 'text';
      return 'text';
    }
    const cell = (v) => (v instanceof Uint8Array || ArrayBuffer.isView(v) ? `[blob ${v.byteLength} B]` : v);

    async function describe(engine) {
      const res = await engine.exec("select name from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name");
      const tables = (res[0] ? res[0].values : []).map((r) => String(r[0]));
      const dataspatium = ['data', '_columns', '_meta'].every((n) => tables.includes(n));
      const geometryColumns = new Map(); const crs = new Map();
      let gpkg = false;
      if (tables.includes('gpkg_contents') && tables.includes('gpkg_geometry_columns')) {
        gpkg = true;
        const feats = await engine.exec("select c.table_name, g.column_name, s.srs_name from gpkg_contents c left join gpkg_geometry_columns g on g.table_name = c.table_name left join gpkg_spatial_ref_sys s on s.srs_id = g.srs_id where c.data_type in ('features', 'attributes') order by c.table_name");
        const names = [];
        for (const [table, column, srs] of (feats[0] ? feats[0].values : [])) {
          if (!tables.includes(String(table))) continue;
          names.push(String(table));
          if (column) geometryColumns.set(String(table), String(column));
          if (srs) crs.set(String(table), String(srs));
        }
        return { tables: names, dataspatium: false, gpkg, geometryColumns, crs };
      }
      return { tables: tables.filter((n) => !n.startsWith('_') || !dataspatium), dataspatium, gpkg, geometryColumns, crs };
    }
    async function tableColumns(engine, table) {
      const info = await engine.exec(`pragma table_info(${q(table)})`);
      return (info[0] ? info[0].values : []).map((r) => ({ name: String(r[1]), type: sqlType(r[2]) }));
    }

    /** @param {File} file @param {{table?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const { engine } = await openFile(file);
      try {
        const { tables, dataspatium, gpkg, geometryColumns, crs } = await describe(engine);
        let name = '';
        if (dataspatium) { const m = await engine.exec("select value from _meta where key = 'name'"); name = m[0] && m[0].values[0] ? String(m[0].values[0][0]) : ''; }
        const table = dataspatium ? 'data' : (options.table && tables.includes(options.table) ? options.table : tables[0]);
        if (!table) throw new Error(D.t('import.err.notables'));
        const cols = dataspatium ? (await engine.exec('select name, type from _columns order by position'))[0].values.map((r) => ({ name: String(r[0]), type: String(r[1]) })) : await tableColumns(engine, table);
        const geomCol = gpkg ? geometryColumns.get(table) : null;
        const count = await engine.exec(`select count(*) from ${q(table)}`);
        const res = await engine.exec(`select * from ${q(table)} limit ${Math.max(1, options.previewRows || 100)}`);
        const rows = (res[0] ? res[0].values : []).map((r) => r.map((v, i) => (geomCol && cols[i] && cols[i].name === geomCol ? gpbToGeoJson(v) : cell(v))));
        return { kind: 'sqlite', columns: cols.map((c) => c.name), dataRows: rows, totalRows: Number(count[0].values[0][0]), header: true, tables, table, dataspatium, datasetName: name, declaredTypes: cols.map((c) => (geomCol && c.name === geomCol ? 'text' : c.type)), gpkg, geometryColumn: geomCol || null, crs: gpkg ? crs.get(table) || '' : '' };
      } finally { engine.terminate(); }
    }
    /** @param {File} file @param {{table?: string}} options */
    async function parse(file, options = {}) {
      const { engine } = await openFile(file);
      try {
        const { tables, dataspatium, gpkg, geometryColumns, crs } = await describe(engine);
        const table = dataspatium ? 'data' : (options.table && tables.includes(options.table) ? options.table : tables[0]);
        if (!table) throw new Error(D.t('import.err.notables'));
        const cols = await tableColumns(engine, table);
        const geomCol = gpkg ? geometryColumns.get(table) : null;
        const res = await engine.exec(`select * from ${q(table)}`);
        const rows = (res[0] ? res[0].values : []).map((r) => r.map((v, i) => (geomCol && cols[i] && cols[i].name === geomCol ? gpbToGeoJson(v) : cell(v))));
        return { columns: cols.map((c) => c.name), rows, meta: { format: gpkg ? 'geopackage' : 'sqlite', table, declaredTypes: cols.map((c) => (geomCol && c.name === geomCol ? 'text' : c.type)), geometryColumn: geomCol || null, crs: gpkg ? crs.get(table) || '' : '' } };
      } finally { engine.terminate(); }
    }
    return { id: 'sqlite', detect, preview, parse, openFile, describe, gpbToGeoJson };
  });
})();
