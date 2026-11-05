// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Frictionless Data Package: a ZIP with `datapackage.json` (Table Schema) and CSV files, which other tools can read. Written
 * from a dataset with its side tables, and read back as datasets with the types and titles the schema gives.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/datapackage', ['data/datasets', 'data/kinds', 'data/types', 'platform/storage/zip'], (datasets, kinds, types, zip) => {
    const DESCRIPTOR = 'datapackage.json';
    const TO_SCHEMA = { integer: 'integer', number: 'number', boolean: 'boolean', date: 'date', datetime: 'datetime', text: 'string' };
    const FROM_SCHEMA = { integer: 'integer', number: 'number', boolean: 'boolean', date: 'date', datetime: 'datetime', year: 'integer', string: 'text', geojson: 'text', object: 'text', array: 'text', any: 'text' };
    /** Lower case letters, digits and the few signs the standard allows in a name. */
    const slug = (s) => String(s || 'data').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'data';
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

    const cell = (v) => {
      if (v === null || v === undefined) return '';
      const text = v instanceof Uint8Array ? '' : String(v);
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    function csvOf(names, rows) {
      const lines = [names.map(cell).join(',')];
      for (const row of rows) lines.push(row.map(cell).join(','));
      return lines.join('\r\n') + '\r\n';
    }
    /** A resource: its CSV, and a schema that says what the columns are. */
    function resource(name, title, columns, rows) {
      const path = `data/${name}.csv`;
      return {
        path,
        csv: csvOf(columns.map((c) => c.name), rows),
        descriptor: {
          name, path, title, profile: 'tabular-data-resource', format: 'csv', mediatype: 'text/csv', encoding: 'utf-8',
          dialect: { delimiter: ',', header: true },
          schema: { fields: columns.map((c) => {
            const field = { name: c.name, type: TO_SCHEMA[c.type] || 'string' };
            if (c.label && c.label !== c.name) field.title = c.label;
            if (c.description) field.description = c.description;
            if (c.unit) field.unit = c.unit;
            if (c.valueLabels && c.valueLabels.labels) field.enumLabels = Object.fromEntries(c.valueLabels.labels.map(([code, label]) => [String(code), label]));
            return field;
          }), missingValues: [''] },
        },
      };
    }
    /**
     * A dataset as a data package, with its side tables as further resources.
     * @param {string} id @returns {Promise<Blob>}
     */
    async function toZip(id) {
      const meta = await datasets.get(id);
      const handle = await datasets.ensureOpen(id);
      const parts = [resource(slug(meta.name), meta.name, handle.columns, await datasets.allRows(id))];
      for (const table of kinds.of(meta).sideTables || []) {
        const known = await handle.engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [table]);
        if (!known[0] || !Number(known[0].values[0][0])) continue;
        const r = await handle.engine.exec(`select * from ${q(table)}`);
        const info = await handle.engine.exec(`pragma table_info(${q(table)})`);
        const columns = (info[0] ? info[0].values : []).map((row) => ({ name: String(row[1]), type: /int/i.test(String(row[2])) ? 'integer' : /real|num|float|double/i.test(String(row[2])) ? 'number' : 'text' }));
        parts.push(resource(`${slug(meta.name)}${table}`, table, columns, r[0] ? r[0].values : []));
      }
      const dcat = meta.dcat || {};
      const descriptor = {
        profile: 'tabular-data-package', name: slug(meta.name), title: dcat.title || meta.name,
        description: dcat.description || meta.description || undefined, created: meta.createdAt, keywords: dcat.keywords && dcat.keywords.length ? dcat.keywords : undefined,
        licenses: dcat.license ? [{ path: dcat.license, name: dcat.license }] : undefined, resources: parts.map((p) => p.descriptor),
      };
      const encoder = new TextEncoder();
      const files = { [DESCRIPTOR]: encoder.encode(JSON.stringify(descriptor, null, 2)) };
      for (const p of parts) files[p.path] = encoder.encode(p.csv);
      return zip.createZip(files, { level: 6 });
    }
    /** The descriptor's place in a ZIP: at the root, or one folder down, where a folder that was zipped puts it. */
    function descriptorIn(entries) {
      return Object.keys(entries).find((name) => name === DESCRIPTOR || /^[^/]+\/datapackage\.json$/.test(name)) || null;
    }
    /**
     * Whether a file is a data package. Only a ZIP can be.
     * @param {File} file @returns {Promise<boolean>}
     */
    async function sniff(file) {
      if (!/\.zip$/i.test(file.name)) return false;
      try { return !!descriptorIn(await zip.readZip(await file.arrayBuffer())); } catch (_err) { return false; }
    }
    async function open(file) {
      const entries = await zip.readZip(await file.arrayBuffer());
      const at = descriptorIn(entries);
      if (!at) throw new Error(D.t('import.err.datapackage'));
      const root = at.slice(0, at.length - DESCRIPTOR.length);
      const descriptor = JSON.parse(zip.text(entries[at]));
      const resources = (descriptor.resources || []).filter((r) => typeof r.path === 'string' && entries[root + r.path]);
      if (!resources.length) throw new Error(D.t('import.err.datapackage'));
      return { descriptor, resources, bytesOf: (r) => entries[root + r.path] };
    }
    /** A resource's rows, typed as its schema says. */
    async function table(pkg, r) {
      const fields = (r.schema && r.schema.fields) || [];
      const csv = D.require('io/importers/csv');
      const file = new File([pkg.bytesOf(r)], r.path.split('/').pop(), { type: 'text/csv' });
      const dialect = r.dialect || {};
      const parsed = await csv.parse(file, { delimiter: dialect.delimiter || ',', header: dialect.header !== false, encoding: r.encoding || 'utf-8', decimal: 'point' });
      const names = types.cleanColumnNames(parsed.columns);
      const specFor = (name) => fields.find((f) => f.name === name) || {};
      const columns = names.map((name) => {
        const f = specFor(name);
        const labels = f.enumLabels ? { values: 'codes', labels: Object.entries(f.enumLabels) } : null;
        return { name, type: FROM_SCHEMA[f.type] || 'text', label: f.title || name, description: f.description || null, unit: f.unit || null, valueLabels: labels };
      });
      const rows = parsed.rows.map((row) => row.map((v, i) => types.parseValue(v, columns[i].type, { decimal: 'point' })));
      return { columns, rows };
    }
    /** The wizard's look at a package: its first resource. */
    async function preview(file) {
      const pkg = await open(file);
      const first = await table(pkg, pkg.resources[0]);
      return {
        kind: 'package', format: 'datapackage', header: true, columns: first.columns.map((c) => c.name), declaredTypes: first.columns.map((c) => c.type), dataRows: first.rows.slice(0, 100),
        totalRows: first.rows.length, datasetName: pkg.descriptor.title || pkg.descriptor.name, package: { resources: pkg.resources.length, names: pkg.resources.map((r) => r.title || r.name) },
      };
    }
    /**
     * One dataset per resource; the first one is given back, and the others are in the list.
     * @param {File} file @param {any} [options] @param {string} [name] @returns {Promise<any>}
     */
    async function importFile(file, options = {}, name) {
      const pkg = await open(file);
      let first = null;
      for (const r of pkg.resources) {
        const data = await table(pkg, r);
        const meta = await datasets.create({
          name: first ? (r.title || r.name) : (name || pkg.descriptor.title || r.title || r.name), description: pkg.descriptor.description || '',
          columns: data.columns, rows: data.rows, source: { kind: 'file', fileName: file.name, format: 'datapackage' },
        });
        if (!first) first = meta;
      }
      return first;
    }

    return { toZip, sniff, preview, importFile, parse: async (file) => { const pkg = await open(file); const t = await table(pkg, pkg.resources[0]); return { columns: t.columns.map((c) => c.name), rows: t.rows, meta: { format: 'datapackage' } }; }, id: 'datapackage', detect: () => false, slug };
  });
})();
