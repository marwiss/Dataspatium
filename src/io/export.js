// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Exporters: CSV (Swedish Excel profile or standard), Excel (xlsx via SheetJS), JSON and the raw
 * SQLite file. Every format can be re-imported; SQLite keeps types and metadata exactly.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/export', ['data/datasets', 'platform/files', 'data/geo'], (datasets, files, geo) => {
    const FORMATS = [
      { id: 'csv', key: 'export.format.csv', ext: 'csv' },
      { id: 'xlsx', key: 'export.format.xlsx', ext: 'xlsx' },
      { id: 'ods', key: 'export.format.ods', ext: 'ods' },
      { id: 'json', key: 'export.format.json', ext: 'json' },
      { id: 'geojson', key: 'export.format.geojson', ext: 'geojson' },
      { id: 'xml', key: 'export.format.xml', ext: 'xml' },
      { id: 'sqlite', key: 'export.format.sqlite', ext: 'sqlite' },
      { id: 'parquet', key: 'export.format.parquet', ext: 'parquet', viaR: true },
      { id: 'sav', key: 'export.format.sav', ext: 'sav', viaR: true },
      { id: 'dta', key: 'export.format.dta', ext: 'dta', viaR: true },
      { id: 'rds', key: 'export.format.rds', ext: 'rds', viaR: true },
    ];
    const R_WRITERS = {
      parquet: (out) => `nanoparquet::write_parquet(df, ${out})`,
      // SPSS and Stata have no logical type; haven expects numbers.
      sav: (out) => `df[] <- lapply(df, function(x) if (is.logical(x)) as.integer(x) else x); haven::write_sav(df, ${out})`,
      dta: (out) => `df[] <- lapply(df, function(x) if (is.logical(x)) as.integer(x) else x); names(df) <- make.unique(substr(gsub("[^A-Za-z0-9_]", "_", iconv(names(df), to = "ASCII//TRANSLIT", sub = "_")), 1, 32)); haven::write_dta(df, ${out})`,
      rds: (out) => `saveRDS(df, ${out})`,
    };
    const R_PACKAGES = { parquet: 'nanoparquet', sav: 'haven', dta: 'haven' };
    const xmlName = (s) => { const n = String(s).replace(/[^A-Za-z0-9_.-]/g, '_'); return /^[A-Za-z_]/.test(n) ? n : '_' + n; };
    const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function csvEscape(value, delimiter) {
      const s = String(value);
      return (s.includes(delimiter) || /["\r\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function csvValue(v, col, options) {
      if (v === null || v === undefined) return '';
      if (col.type === 'number' || col.type === 'integer') return options.decimal === 'comma' ? String(v).replace('.', ',') : String(v);
      if (col.type === 'boolean') return v ? 'true' : 'false';
      return String(v);
    }

    /**
     * @param {string} id
     * @param {{delimiter?: string, decimal?: 'comma'|'point', bom?: boolean, newline?: string}} [options]
     */
    async function toCsv(id, options = {}) {
      const cols = await datasets.columns(id);
      const rows = await datasets.allRows(id);
      const delimiter = options.delimiter || ';';
      const newline = options.newline || '\r\n';
      const lines = [cols.map((c) => csvEscape(c.name, delimiter)).join(delimiter)];
      for (const r of rows) lines.push(r.map((v, i) => csvEscape(csvValue(v, cols[i], options), delimiter)).join(delimiter));
      const text = lines.join(newline) + newline;
      return new Blob(options.bom ? ['﻿', text] : [text], { type: 'text/csv;charset=utf-8' });
    }

    async function toJson(id) {
      const cols = await datasets.columns(id);
      const rows = await datasets.allRows(id);
      const records = rows.map((r) => { const o = {}; cols.forEach((c, i) => { o[c.name] = c.type === 'boolean' && r[i] !== null ? !!r[i] : r[i]; }); return o; });
      return new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    }

    function excelValue(v, col) {
      if (v === null || v === undefined) return null;
      if (col.type === 'date') { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : v; }
      if (col.type === 'datetime') { const d = new Date(String(v).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? v : d; }
      if (col.type === 'boolean') return !!v;
      return v;
    }

    async function toXlsx(id, options = {}) {
      await D.assets.loadVendorScript('vendor/sheetjs/xlsx.full.min.js');
      const XLSX = /** @type {any} */ (globalThis).XLSX;
      const cols = await datasets.columns(id);
      const rows = await datasets.allRows(id);
      const aoa = [cols.map((c) => c.name)];
      for (const r of rows) aoa.push(r.map((v, i) => excelValue(v, cols[i])));
      const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, String(options.sheetName || 'Data').slice(0, 31));
      const ods = options.bookType === 'ods';
      const out = XLSX.write(wb, { bookType: ods ? 'ods' : 'xlsx', type: 'array', cellDates: true });
      return new Blob([out], { type: ods ? 'application/vnd.oasis.opendocument.spreadsheet' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    async function toOds(id, options = {}) { return toXlsx(id, Object.assign({}, options, { bookType: 'ods' })); }

    /** XML with one <rad> per row; element names are sanitised and the original kept in `namn`. */
    async function toXml(id) {
      const meta = await datasets.get(id);
      const cols = await datasets.columns(id);
      const rows = await datasets.allRows(id);
      const names = cols.map((c) => xmlName(c.name));
      const parts = [`<?xml version="1.0" encoding="UTF-8"?>\n<dataspatium datamangd="${escXml(meta ? meta.name : '')}" skapad="${new Date().toISOString()}">\n`];
      parts.push('  <kolumner>' + cols.map((c, i) => `<kolumn namn="${escXml(c.name)}" element="${names[i]}" typ="${c.type}"${c.label && c.label !== c.name ? ` etikett="${escXml(c.label)}"` : ''}${c.description ? ` beskrivning="${escXml(c.description)}"` : ''}${c.unit ? ` enhet="${escXml(c.unit)}"` : ''}/>`).join('') + '</kolumner>\n  <rader>\n');
      for (const r of rows) {
        parts.push('    <rad>' + r.map((v, i) => (v === null || v === undefined ? `<${names[i]}/>` : `<${names[i]}>${escXml(cols[i].type === 'boolean' ? (v ? 'true' : 'false') : v)}</${names[i]}>`)).join('') + '</rad>\n');
      }
      parts.push('  </rader>\n</dataspatium>\n');
      return new Blob(parts, { type: 'application/xml;charset=utf-8' });
    }

    /** Formats written by R packages (haven, nanoparquet, base): the dataset is mirrored into R first. */
    async function toViaR(id, format) {
      const writer = R_WRITERS[format];
      if (!writer) throw new Error('Okänt R-format: ' + format);
      const meta = await datasets.get(id);
      const bridge = D.require('data/r-bridge').bridge;
      const dir = '/tmp/dataspatium-export';
      const out = `${dir}/${Date.now().toString(36)}.${format}`;
      await bridge.mkdir(dir);
      // library() goes through webR's shim, which installs a bundled package on first use; `pkg::` alone does not.
      const pkg = R_PACKAGES[format];
      const libs = pkg ? `suppressPackageStartupMessages(library(${pkg}))\n` : '';
      const code = `${libs}df <- dm_read(${JSON.stringify(meta.id)})\n${writer(JSON.stringify(out))}\ncat("ok\\n")`;
      const res = await bridge.run(code);
      const error = res.entries.find((e) => e.kind === 'error');
      if (error) throw new Error(error.text);
      const bytes = await bridge.readFile(out);
      await bridge.removeFile(out);
      const type = format === 'parquet' ? 'application/vnd.apache.parquet' : 'application/octet-stream';
      return new Blob([bytes], { type });
    }

    async function toSqlite(id) {
      const bytes = await datasets.exportBytes(id);
      return new Blob([bytes], { type: 'application/vnd.sqlite3' });
    }

    /**
     * @param {string} id
     * @param {string} format one of FORMATS ids
     * @param {Record<string, any>} [options]
     * @returns {Promise<{blob: Blob, filename: string}>}
     */
    async function exportDataset(id, format, options = {}) {
      const meta = await datasets.get(id);
      const fmt = FORMATS.find((f) => f.id === format) || FORMATS[0];
      const filename = options.filename || files.safeName(meta ? meta.name : 'dataspatium', fmt.ext);
      let blob;
      if (fmt.id === 'csv') blob = await toCsv(id, options);
      else if (fmt.id === 'xlsx') blob = await toXlsx(id, options);
      else if (fmt.id === 'ods') blob = await toOds(id, options);
      else if (fmt.id === 'json') blob = await toJson(id);
      else if (fmt.id === 'geojson') blob = await toGeoJson(id);
      else if (fmt.id === 'xml') blob = await toXml(id);
      else if (fmt.viaR) blob = await toViaR(id, fmt.id);
      else blob = await toSqlite(id);
      return { blob, filename };
    }

    /**
     * GeoJSON FeatureCollection from a dataset with a geometry column (GeoJSON or WKT text, found by
     * name or by parsing the first non-empty value); the other columns become feature properties.
     */
    async function toGeoJson(id) {
      const cols = await datasets.columns(id);
      const rows = await datasets.allRows(id);
      const textCols = cols.map((c, i) => ({ c, i })).filter((x) => x.c.type === 'text');
      const firstGeometry = (i) => { const r = rows.find((row) => row[i] !== null && row[i] !== undefined && row[i] !== ''); const g = r ? geo.parseGeometry(r[i]) : null; return g && g.type ? g : null; };
      const named = textCols.find((x) => /^(geometry|geom|wkt|shape|the_geom|geometri)$/i.test(x.c.name));
      const found = named || textCols.find((x) => firstGeometry(x.i));
      if (!found) throw new Error('Datamängden har ingen geometrikolumn (GeoJSON eller WKT som text). Importera från GeoJSON, shapefile eller GeoPackage, eller lägg till en kolumn med WKT.');
      const skip = new Set([found.i, cols.findIndex((c) => c.name === 'geometry_type')]);
      const features = rows.map((r) => {
        const properties = {};
        cols.forEach((c, i) => { if (!skip.has(i)) properties[c.name] = r[i] === undefined ? null : (c.type === 'boolean' && r[i] !== null ? !!r[i] : r[i]); });
        const g = geo.parseGeometry(r[found.i]);
        return { type: 'Feature', properties, geometry: g && g.type ? g : null };
      });
      return new Blob([JSON.stringify({ type: 'FeatureCollection', features })], { type: 'application/geo+json' });
    }

    return { FORMATS, toCsv, toJson, toGeoJson, toXlsx, toOds, toXml, toSqlite, toViaR, exportDataset };
  });
})();
