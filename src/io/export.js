// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Exporters: CSV (Swedish Excel profile or standard), Excel (xlsx via SheetJS), JSON and the raw
 * SQLite file. Every format can be re-imported; SQLite keeps types and metadata exactly.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/export', ['data/datasets', 'platform/files', 'data/geo', 'data/graph'], (datasets, files, geo, graph) => {
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
      // Graph datasets: the whole graph (nodes and edges) in the exchange formats of data/graph.
      { id: 'graphml', key: 'export.format.graphml', ext: 'graphml', kind: 'graph' },
      { id: 'gexf', key: 'export.format.gexf', ext: 'gexf', kind: 'graph' },
      { id: 'graph-json', key: 'export.format.graph-json', ext: 'json', kind: 'graph' },
      { id: 'cypher', key: 'export.format.cypher', ext: 'cypher', kind: 'graph' },
      // Model datasets: the original file, the long tables of an IFC model, the drawing of a DXF file.
      { id: 'model-original', key: 'export.format.model-original', ext: 'ifc', kind: 'model' },
      { id: 'model-properties', key: 'export.format.model-properties', ext: 'csv', kind: 'model', modelFormat: 'ifc' },
      { id: 'model-quantities', key: 'export.format.model-quantities', ext: 'csv', kind: 'model', modelFormat: 'ifc' },
      { id: 'model-svg', key: 'export.format.model-svg', ext: 'svg', kind: 'model', modelFormat: 'dxf' },
    ];
    /** The formats offered for a dataset: graph and model formats only for those kinds; tables for every dataset. */
    function formatsFor(meta, facts = {}) {
      const dxf = !!(meta && meta.model && meta.model.format === 'dxf');
      return FORMATS.filter((f) => !f.kind || (meta && meta.kind === f.kind && (!f.modelFormat || f.modelFormat === (dxf ? 'dxf' : 'ifc'))))
        .map((f) => (f.id === 'model-original' && dxf ? Object.assign({}, f, { ext: 'dxf' }) : f))
        // A format that cannot work stays visible and says what it needs.
        .map((f) => (f.id === 'geojson' && facts.geometry === false ? Object.assign({}, f, { unavailable: 'export.needs.geometry' }) : f));
    }
    /** The column GeoJSON can be written from: a geometry, found by name or by its first value, or else coordinates. */
    async function geometrySource(id) {
      const cols = await datasets.columns(id);
      const text = cols.filter((c) => c.type === 'text');
      const named = text.find((c) => /^(geometry|geom|wkt|shape|the_geom|geometri)$/i.test(c.name));
      if (named) return { column: named.name };
      const handle = await datasets.ensureOpen(id);
      for (const c of text) {
        const name = '"' + c.name.replace(/"/g, '""') + '"';
        const r = await handle.engine.exec(`select ${name} from data where ${name} is not null and ${name} != '' limit 1`);
        const value = r[0] && r[0].values[0] ? r[0].values[0][0] : null;
        const parsed = value === null ? null : geo.parseGeometry(value);
        if (parsed && parsed.type) return { column: c.name };
      }
      const coords = D.require('viz/leaflet').coordinateColumns(cols);
      return coords && await D.require('viz/leaflet').drawable(id) ? { lon: coords.lon, lat: coords.lat } : null;
    }
    /** A model dataset: the original file, its long tables as CSV, or a DXF drawing as SVG. */
    async function toModel(id, format, options = {}) {
      const model = D.require('data/model');
      if (format === 'model-original') {
        const file = await model.original(id);
        if (!file) throw new Error(D.t('model.err.nofile'));
        return { blob: new Blob([file.bytes], { type: 'application/octet-stream' }), filename: file.name };
      }
      if (format === 'model-svg') {
        const meta = await datasets.get(id);
        const blob = await D.require('viz/model-draw').toBlob({ kind: 'model', datasetId: id, name: meta ? meta.name : '' }, 'svg', { width: 1600, height: 1200 });
        return { blob };
      }
      const properties = format === 'model-properties';
      const sql = properties
        ? 'select d.id, d.guid, d.typ, d.namn as element, d.vaning, p.uppsattning, p.namn, p.varde, p.enhet, p.kalla from _properties p join data d on d.id = p.id order by d.id, p.uppsattning, p.namn'
        : 'select d.id, d.guid, d.typ, d.namn as element, d.vaning, q.uppsattning, q.namn, q.varde, q.enhet, q.slag from _quantities q join data d on d.id = q.id order by d.id, q.uppsattning, q.namn';
      const res = await (await datasets.ensureOpen(id)).engine.exec(sql);
      const delimiter = options.delimiter || ';';
      const decimal = options.decimal || 'comma';
      const cols = res[0] ? res[0].columns : [];
      const lines = [cols.map((c) => csvEscape(c, delimiter)).join(delimiter)];
      for (const row of res[0] ? res[0].values : []) lines.push(row.map((v) => (v === null || v === undefined ? '' : csvEscape(typeof v === 'number' && decimal === 'comma' ? String(v).replace('.', ',') : String(v), delimiter))).join(delimiter));
      return { blob: new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }) };
    }
    /** A graph dataset in GraphML, GEXF, node-link JSON or a Cypher script. */
    async function toGraph(id, format) {
      const g = await graph.whole(id);
      const text = graph.write(format === 'graph-json' ? 'nodelink' : format, g);
      const type = format === 'graph-json' ? 'application/json' : format === 'cypher' ? 'text/plain' : 'application/xml';
      return new Blob([text], { type });
    }
    const R_WRITERS = {
      parquet: (out) => `nanoparquet::write_parquet(df, ${out})`,
      // SPSS and Stata have no logical type; haven expects numbers. Value labels are written as such: columns
      // that hold the labels as text get their codes back first (see .dm_labels_for_export in r/dataspatium.R).
      sav: (out) => `df <- .dm_labels_for_export(df); df[] <- lapply(df, function(x) if (is.logical(x)) as.integer(x) else x); haven::write_sav(df, ${out})`,
      dta: (out) => `df <- .dm_labels_for_export(df); df[] <- lapply(df, function(x) if (is.logical(x)) as.integer(x) else x); names(df) <- make.unique(substr(gsub("[^A-Za-z0-9_]", "_", iconv(names(df), to = "ASCII//TRANSLIT", sub = "_")), 1, 32)); haven::write_dta(df, ${out})`,
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
      parts.push('  <kolumner>' + cols.map((c, i) => `<kolumn namn="${escXml(c.name)}" element="${names[i]}" typ="${c.type}"${c.label && c.label !== c.name ? ` etikett="${escXml(c.label)}"` : ''}${c.description ? ` beskrivning="${escXml(c.description)}"` : ''}${c.unit ? ` enhet="${escXml(c.unit)}"` : ''}${c.valueLabels ? ` vardeetiketter="${escXml(datasets.valueLabelsText(c.valueLabels))}"` : ''}/>`).join('') + '</kolumner>\n  <rader>\n');
      for (const r of rows) {
        parts.push('    <rad>' + r.map((v, i) => (v === null || v === undefined ? `<${names[i]}/>` : `<${names[i]}>${escXml(cols[i].type === 'boolean' ? (v ? 'true' : 'false') : v)}</${names[i]}>`)).join('') + '</rad>\n');
      }
      parts.push('  </rader>\n</dataspatium>\n');
      return new Blob(parts, { type: 'application/xml;charset=utf-8' });
    }

    /** Formats written by R packages (haven, nanoparquet, base): the dataset is mirrored into R first. */
    async function toViaR(id, format) {
      const writer = R_WRITERS[format];
      if (!writer) throw new Error(D.t('export.err.rformat', { format }));
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
      if (fmt.kind === 'model') {
        const out = await toModel(id, fmt.id, options);
        return { blob: out.blob, filename: options.filename || out.filename || filename };
      }
      if (fmt.kind === 'graph') blob = await toGraph(id, fmt.id);
      else if (fmt.id === 'csv') blob = await toCsv(id, options);
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
      const source = await geometrySource(id);
      if (!source) throw new Error(D.t('export.err.nogeometry'));
      const at = (name) => cols.findIndex((c) => c.name === name);
      const skip = new Set(source.column ? [at(source.column), at('geometry_type')] : [at('geometry_type')]);
      const features = rows.map((r) => {
        const properties = {};
        cols.forEach((c, i) => { if (!skip.has(i)) properties[c.name] = r[i] === undefined ? null : (c.type === 'boolean' && r[i] !== null ? !!r[i] : r[i]); });
        let geometry = null;
        if (source.column) { const g = geo.parseGeometry(r[at(source.column)]); geometry = g && g.type ? g : null; }
        else if (typeof r[at(source.lon)] === 'number' && typeof r[at(source.lat)] === 'number') { const point = { type: 'Point', coordinates: [r[at(source.lon)], r[at(source.lat)]] }; geometry = geo.toWgs84(point); }
        return { type: 'Feature', properties, geometry };
      });
      return new Blob([JSON.stringify({ type: 'FeatureCollection', features })], { type: 'application/geo+json' });
    }

    return { FORMATS, formatsFor, geometrySource, toModel, toGraph, toCsv, toJson, toGeoJson, toXlsx, toOds, toXml, toSqlite, toViaR, exportDataset };
  });
})();
