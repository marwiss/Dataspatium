// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Import pipeline: pick an importer for a file, preview with inferred column types, let the user
 * adjust names and types, then parse everything and create a dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/import', ['io/importers/csv', 'io/importers/excel', 'io/importers/json', 'io/importers/xml', 'io/importers/sqlite', 'io/importers/r-formats', 'io/importers/shapefile', 'data/types', 'data/datasets'], (csv, excel, json, xml, sqliteImp, rFormats, shapefile, types, datasets) => {
    const importers = [excel, json, xml, sqliteImp, shapefile, rFormats, csv];

    /** @param {File} file @param {string} [forced] importer id */
    function importerFor(file, forced) {
      if (forced) { const found = importers.find((i) => i.id === forced); if (found) return found; }
      return importers.find((i) => i.detect(file)) || csv;
    }

    function baseName(fileName) { return String(fileName || 'Datamängd').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Datamängd'; }

    /**
     * Preview a file: columns, sample rows and inferred types.
     * @param {File} file
     * @param {Record<string, any>} [options] format, encoding, delimiter, header, sheet, path, decimal
     */
    async function preview(file, options = {}) {
      const importer = importerFor(file, options.format);
      const p = await importer.preview(file, options);
      const columns = types.cleanColumnNames(p.columns);
      const inferred = types.inferColumns(columns, p.dataRows, { decimal: options.decimal });
      // Declared types (SQLite schemas) win over inference for empty or ambiguous columns.
      if (p.declaredTypes) inferred.forEach((c, i) => { if (p.declaredTypes[i] && (p.declaredTypes[i] !== 'text' || c.type === 'text')) c.type = p.declaredTypes[i]; });
      return Object.assign(p, { importer: importer.id, columns, inferred: inferred.map((c, i) => Object.assign({ include: true, label: columns[i], sourceName: p.columns[i] }, c)) });
    }

    /**
     * Turn parsed table + column specs into typed rows.
     * @param {{columns: string[], rows: any[][]}} table
     * @param {Array<{name: string, type: string, include?: boolean, decimal?: string, label?: string}>} specs one per source column
     * @param {{decimal?: string}} [options]
     */
    function materialize(table, specs, options = {}) {
      const included = specs.map((s, i) => Object.assign({ index: i }, s)).filter((s) => s.include !== false);
      const rows = new Array(table.rows.length);
      for (let r = 0; r < table.rows.length; r++) {
        const src = table.rows[r];
        const out = new Array(included.length);
        for (let c = 0; c < included.length; c++) {
          const spec = included[c];
          out[c] = types.parseValue(src[spec.index], spec.type, { decimal: spec.decimal || options.decimal });
        }
        rows[r] = out;
      }
      return { columns: included.map((s) => ({ name: s.name, type: s.type, label: s.label || s.name, sourceName: table.columns[s.index] })), rows };
    }

    /**
     * Full import.
     * @param {File} file
     * @param {Record<string, any>} options importer options (format, encoding, delimiter, header, sheet, path, decimal)
     * @param {Array<any>|null} specs column specs from the wizard, or null to use inferred types
     * @param {string} [name]
     */
    async function run(file, options, specs, name) {
      const importer = importerFor(file, options.format);
      if (importer.viaR) return importer.importViaR(file, name || baseName(file.name), options);
      if (importer.id === 'sqlite') {
        // A Dataspatium file is restored with its metadata, log and versions intact.
        const info = await sqliteImp.preview(file, Object.assign({}, options, { previewRows: 1 }));
        if (info.dataspatium) return datasets.importBytes(await file.arrayBuffer(), name ? { name } : {});
      }
      const table = await importer.parse(file, options);
      table.columns = types.cleanColumnNames(table.columns);
      const columnSpecs = specs || types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, columnSpecs, options);
      return datasets.create({
        name: name || baseName(file.name),
        columns, rows,
        source: { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: table.meta.format },
        importOptions: Object.assign({}, options, table.meta),
      });
    }

    /** Import pasted text as a dataset. */
    async function runText(text, options, specs, name) {
      const table = await csv.parseText(text, options);
      table.columns = types.cleanColumnNames(table.columns);
      const columnSpecs = specs || types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, columnSpecs, options);
      return datasets.create({ name: name || 'Inklistrad tabell', columns, rows, source: { kind: 'paste', format: 'text' }, importOptions: Object.assign({}, options, table.meta) });
    }

    /**
     * Import one of the bundled example datasets (see presets/presets.js).
     * @param {{id: string, name: string, asset: string, options?: any, source?: any, description?: string}} preset
     */
    async function runPreset(preset) {
      const text = await D.assets.loadText(preset.asset);
      const options = Object.assign({ header: true }, preset.options || {});
      const table = await csv.parseText(text, options);
      table.columns = types.cleanColumnNames(table.columns);
      const specs = types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, specs, options);
      return datasets.create({ name: preset.name, description: preset.description || '', columns, rows, source: Object.assign({ kind: 'preset', preset: preset.id }, preset.source || {}), importOptions: Object.assign({}, options, table.meta) });
    }

    async function previewText(text, options = {}) {
      const table = await csv.parseText(text, options);
      const columns = types.cleanColumnNames(table.columns);
      const inferred = types.inferColumns(columns, table.rows, { decimal: options.decimal });
      return { kind: 'text', columns, dataRows: table.rows.slice(0, 100), header: table.meta.header, delimiter: table.meta.delimiter, totalRows: table.rows.length, importer: 'csv', inferred: inferred.map((c, i) => Object.assign({ include: true, label: columns[i], sourceName: table.columns[i] }, c)) };
    }

    return { importers, importerFor, preview, run, runText, runPreset, previewText, materialize, baseName };
  });
})();
