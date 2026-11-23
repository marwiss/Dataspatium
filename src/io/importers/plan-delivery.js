// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Importer for a digital översiktsplan delivered as a ZIP (data/plan-delivery): a ZIP with one or more GeoPackages and Word
 * files, a manifest.xml or a metadata.xml becomes one plan dataset. Never picked by extension: io/import sniffs a ZIP's entries
 * (after the data packages and the archive packages, which have their own readers). A folder or a choice of such files is
 * sorted by io/import's sortFiles, which offers the same delivery as one choice.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/plan-delivery', ['data/plan-delivery', 'platform/storage/zip'], (delivery, zip) => {
    /** Never by extension. */
    function detect() { return false; }
    /** True when a ZIP holds a delivery: a GeoPackage together with a Word file, a manifest.xml or a metadata.xml. */
    async function sniff(file) {
      try {
        const names = (await zip.listZip(file)).map((e) => e.name);
        // An archive package (metadata/PREMIS.xml) and a data package have readers of their own.
        if (names.some((n) => /(^|\/)metadata\/premis\.xml$/i.test(n) || /(^|\/)datapackage\.json$/i.test(n))) return false;
        return names.some((n) => /\.gpkg$/i.test(n)) && names.some((n) => /\.docx$/i.test(n) || /(^|\/)(manifest|metadata)\.xml$/i.test(n));
      } catch (_err) { return false; }
    }
    /** The plan's facts, files and first rows, for Inhämta. */
    async function preview(file, options = {}) { return delivery.previewDelivery(await delivery.filesOfZip(file), options); }
    /** A ZIP with a delivery → one plan dataset. */
    async function importFile(file, options = {}, name, progress) { return delivery.importDelivery(await delivery.filesOfZip(file), options, name, progress); }
    /** The files of a delivery (a folder or a choice) → one plan dataset. */
    async function importFiles(files, options = {}, name, progress) { return delivery.importDelivery(files, options, name, progress); }
    /** Rows as a table, for someone who insists on the column step: the plan's first rows. */
    async function parse(file, options = {}) {
      const p = await preview(file, Object.assign({}, options, { previewRows: 1e9 }));
      return { columns: p.columns, rows: p.dataRows, meta: { format: 'opdelivery', declaredTypes: p.declaredTypes } };
    }

    return { id: 'opdelivery', kind: 'plan', detect, sniff, preview, parse, importFile, importFiles, filesOfZip: delivery.filesOfZip };
  });
})();
