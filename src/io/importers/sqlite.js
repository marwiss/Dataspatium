// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * SQLite importer. A Dataspatium file (tables data, _columns, _meta) is restored with its metadata;
 * any other SQLite database, GeoPackage or SQL script offers its tables and imports the chosen one with
 * types from the schema.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/sqlite', ['engines/sqlite', 'data/encoding'], (sqlite, encoding) => {
    const EXT = /\.(sqlite|sqlite3|db|s3db|gpkg|sql)$/i;
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

    /**
     * An SQL script in SQLite's dialect (for example from `sqlite3 .dump`). Statements in simple MySQL dumps
     * that SQLite cannot run (SET, LOCK TABLES, version comments, table options) are left out.
     * @param {string} text
     */
    function cleanScript(text) {
      return text.replace(/^﻿/, '')
        .replace(/\/\*![\s\S]*?\*\/\s*;?/g, '')
        .replace(/^\s*(SET|LOCK TABLES|UNLOCK TABLES|USE|DELIMITER)\b[^;]*;\s*$/gim, '')
        .replace(/\)\s*(ENGINE|DEFAULT CHARSET|CHARSET|COLLATE|AUTO_INCREMENT|ROW_FORMAT)\s*=[^;]*;/gi, ');');
    }
    async function openScript(file) {
      const { text } = await encoding.readText(file);
      const engine = new sqlite.SqliteEngine();
      await engine.start();
      await engine.open();
      try { await engine.exec(cleanScript(text)); } catch (err) { engine.terminate(); throw new Error(D.t('import.err.sqlscript', { message: (err && err.message) || String(err) })); }
      return { engine, bytes: null };
    }

    async function openFile(file) {
      if (/\.sql$/i.test(file.name)) return openScript(file);
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
        const feats = await engine.exec("select c.table_name, g.column_name, s.srs_name, c.data_type from gpkg_contents c left join gpkg_geometry_columns g on g.table_name = c.table_name left join gpkg_spatial_ref_sys s on s.srs_id = g.srs_id where c.data_type in ('features', 'attributes') order by c.table_name");
        const names = [];
        // The map layers; value lists and link tables are 'attributes'.
        const features = [];
        for (const [table, column, srs, type] of (feats[0] ? feats[0].values : [])) {
          if (!tables.includes(String(table))) continue;
          names.push(String(table));
          if (type === 'features') features.push(String(table));
          if (column) geometryColumns.set(String(table), String(column));
          if (srs) crs.set(String(table), String(srs));
        }
        return { tables: names, features, dataspatium: false, gpkg, geometryColumns, crs };
      }
      return { tables: tables.filter((n) => !n.startsWith('_') || !dataspatium), features: [], dataspatium, gpkg, geometryColumns, crs };
    }
    async function tableColumns(engine, table) {
      const info = await engine.exec(`pragma table_info(${q(table)})`);
      return (info[0] ? info[0].values : []).map((r) => ({ name: String(r[1]), type: sqlType(r[2]) }));
    }

    /** @param {File} file @param {{table?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const { engine } = await openFile(file);
      try {
        const { tables, features, dataspatium, gpkg, geometryColumns, crs } = await describe(engine);
        let name = '';
        if (dataspatium) { const m = await engine.exec("select value from _meta where key = 'name'"); name = m[0] && m[0].values[0] ? String(m[0].values[0][0]) : ''; }
        const table = dataspatium ? 'data' : (options.table && tables.includes(options.table) ? options.table : tables[0]);
        if (!table) throw new Error(D.t('import.err.notables'));
        const cols = dataspatium ? (await engine.exec('select name, type from _columns order by position'))[0].values.map((r) => ({ name: String(r[0]), type: String(r[1]) })) : await tableColumns(engine, table);
        const geomCol = gpkg ? geometryColumns.get(table) : null;
        const count = await engine.exec(`select count(*) from ${q(table)}`);
        const res = await engine.exec(`select * from ${q(table)} limit ${Math.max(1, options.previewRows || 100)}`);
        const rows = (res[0] ? res[0].values : []).map((r) => r.map((v, i) => (geomCol && cols[i] && cols[i].name === geomCol ? gpbToGeoJson(v) : cell(v))));
        return { kind: 'sqlite', columns: cols.map((c) => c.name), dataRows: rows, totalRows: Number(count[0].values[0][0]), header: true, tables, featureTables: features, table, dataspatium, datasetName: name, declaredTypes: cols.map((c) => (geomCol && c.name === geomCol ? 'text' : c.type)), gpkg, geometryColumn: geomCol || null, crs: gpkg ? crs.get(table) || '' : '' };
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
    /** A pause for the main thread between batches (messages from the worker and the person's input get their turn). */
    const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
    /**
     * Every row of a table, read from the worker in batches so that the main thread decodes one batch at a time and pauses between
     * them: `onRows(rows, done)` gets each batch (values in column order, a GeoPackage geometry decoded to GeoJSON text when
     * `geometryColumn` names it, other blobs as null unless `blobs`). Batches go by rowid, or by offset for a table without one.
     * @param {any} engine @param {string} table
     * @param {{columns?: string[], geometryColumn?: string|null, batch?: number, blobs?: boolean, onRows: (rows: any[][], done: number) => any}} options
     * @returns {Promise<{columns: string[], count: number}>}
     */
    async function readRows(engine, table, options) {
      const columns = options.columns || (await tableColumns(engine, table)).map((c) => c.name);
      const batch = Math.max(1, options.batch || 2000);
      const gi = options.geometryColumn ? columns.indexOf(options.geometryColumn) : -1;
      const list = columns.map(q).join(', ') || '*';
      const decode = (r) => r.map((v, i) => (i === gi ? gpbToGeoJson(v) : (v instanceof Uint8Array || ArrayBuffer.isView(v)) && !options.blobs ? null : v));
      let done = 0;
      let byRowid = true;
      let last = -Infinity;
      for (;;) {
        let res;
        if (byRowid) {
          try { res = await engine.exec(`select rowid, ${list} from ${q(table)} where rowid > ? order by rowid limit ${batch}`, [last === -Infinity ? -9e15 : last]); } catch (_err) { byRowid = false; }
        }
        if (!byRowid) res = await engine.exec(`select ${list} from ${q(table)} limit ${batch} offset ${done}`);
        const values = res && res[0] ? res[0].values : [];
        if (!values.length) break;
        const rows = byRowid ? values.map((r) => { last = Number(r[0]); return decode(r.slice(1)); }) : values.map(decode);
        done += rows.length;
        await options.onRows(rows, done);
        if (values.length < batch) break;
        await breathe();
      }
      return { columns, count: done };
    }
    /**
     * The feature layers of a GeoPackage (gpkg_contents with data_type 'features'; value lists and link tables are 'attributes'):
     * table, its name for people (identifier, else the table), geometry column and type, coordinate system ('EPSG:<n>' when the
     * file says so, else the system's name), the feature id column and the number of features.
     * @param {any} engine
     * @returns {Promise<Array<{table: string, title: string, geometryColumn: string|null, geometryType: string, crs: string, idColumn: string|null, count: number}>>}
     */
    async function featureLayers(engine) {
      const names = await engine.exec("select name from sqlite_master where type in ('table', 'view') and name in ('gpkg_contents', 'gpkg_geometry_columns', 'gpkg_spatial_ref_sys')");
      if (!names[0] || names[0].values.length < 2) return [];
      const hasSrs = names[0].values.some((r) => r[0] === 'gpkg_spatial_ref_sys');
      const res = await engine.exec(`select c.table_name, c.identifier, g.column_name, g.geometry_type_name, ${hasSrs ? 's.srs_name, s.organization, s.organization_coordsys_id' : 'null, null, null'}, coalesce(g.srs_id, c.srs_id)
        from gpkg_contents c left join gpkg_geometry_columns g on g.table_name = c.table_name ${hasSrs ? 'left join gpkg_spatial_ref_sys s on s.srs_id = coalesce(g.srs_id, c.srs_id)' : ''}
        where lower(c.data_type) = 'features' order by c.table_name`);
      const out = [];
      for (const [table, identifier, column, type, srsName, org, orgId, srsId] of (res[0] ? res[0].values : [])) {
        const name = String(table);
        let cols;
        try { cols = await engine.exec(`pragma table_info(${q(name)})`); } catch (_err) { continue; }
        const info = cols[0] ? cols[0].values : [];
        if (!info.length) continue;
        const pk = info.find((r) => Number(r[5]) === 1);
        const count = await engine.exec(`select count(*) from ${q(name)}`);
        const epsg = org && /^epsg$/i.test(String(org)) && Number(orgId) > 0 ? 'EPSG:' + Number(orgId) : '';
        out.push({ table: name, title: String(identifier || '').trim() || name, geometryColumn: column ? String(column) : null, geometryType: String(type || ''), crs: epsg || (Number(srsId) > 0 && srsName ? String(srsName) : ''), idColumn: pk ? String(pk[1]) : null, count: Number(count[0].values[0][0]) || 0 });
      }
      return out;
    }
    return { id: 'sqlite', detect, preview, parse, openFile, describe, gpbToGeoJson, readRows, featureLayers, tableColumns };
  });
})();
