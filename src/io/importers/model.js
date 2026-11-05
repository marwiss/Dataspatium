// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Importer for building models and drawings (dataset kind "model"): IFC (.ifc, or one .ifc in an .ifczip) and DXF
 * (.dxf). The preview shows the file's facts and counts per type; the import keeps the original file in the dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/model', ['data/model', 'data/ifc-step', 'data/dxf', 'platform/storage/zip'], (model, step, dxf, zip) => {
    const EXT = /\.(ifc|ifczip|dxf)$/i;
    function detect(file) { return EXT.test(String((file && file.name) || '')); }
    const baseName = (name) => String(name || D.t('model.name.default')).replace(/\.[^.]+$/, '');

    /** The file's bytes and format; an .ifczip gives its first .ifc. */
    async function open(file) {
      const name = String(file.name || '');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.dxf$/i.test(name)) return { format: 'dxf', fileName: name, bytes };
      if (/\.ifczip$/i.test(name)) {
        const entries = await zip.readZip(bytes);
        const inner = Object.keys(entries).find((n) => /\.ifc$/i.test(n));
        if (!inner) throw new Error(D.t('model.err.notifc'));
        return { format: 'ifc', fileName: inner.split('/').pop(), bytes: entries[inner] };
      }
      return { format: 'ifc', fileName: name, bytes };
    }
    const typeRows = (list) => (list || []).map((x) => [x.name, x.count]);

    /** Preview for Inhämta: the facts, with the counts per type as the table. */
    async function preview(file) {
      const f = await open(file);
      let summary; let drawing = null;
      if (f.format === 'dxf') { const read = await dxf.read(new TextDecoder('utf-8').decode(f.bytes)); summary = read.summary; drawing = read.svg; } else summary = await step.summary(f.bytes);
      const rows = typeRows(f.format === 'dxf' ? summary.types : summary.elementTypes);
      const datasetName = f.format === 'ifc' ? (summary.project && !/^(default|project|projekt)$/i.test(summary.project) ? summary.project : baseName(f.fileName)) : baseName(f.fileName);
      return { kind: 'model', format: 'model', model: summary, drawing, header: true, columns: ['typ', 'antal'], declaredTypes: ['text', 'integer'], dataRows: rows.slice(0, 100), totalRows: rows.length, datasetName };
    }
    /** The counts per type as a plain table (when someone insists on a table). */
    async function parse(file) {
      const p = await preview(file);
      return { columns: p.columns, rows: p.dataRows, meta: { format: 'model', declaredTypes: p.declaredTypes } };
    }
    /** One file → one model dataset with the original kept. */
    async function importFile(file, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: file.name });
      const f = await open(file);
      const source = { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null };
      const title = name || baseName(f.fileName);
      if (f.format === 'dxf') return model.createDxfDataset({ name: title, fileName: f.fileName, bytes: f.bytes, source });
      return model.createIfcDataset({ name: title, fileName: f.fileName, bytes: f.bytes, source, onProgress: (share) => { if (progress) progress({ step: 'read', file: file.name, share }); } });
    }
    return { id: 'model', kind: 'model', detect, preview, parse, importFile };
  });
})();
