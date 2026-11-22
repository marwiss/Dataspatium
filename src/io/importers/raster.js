// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * GeoTIFF and cloud-optimised GeoTIFF files as rasters (the kind raster, decision B-64): one or more files become one dataset
 * with a row per file. The importer is small and in the start list, so that a TIFF file is known for what it is; the reading
 * (data/raster and its worker, engines/raster) loads with the group `raster` on the first file. GeoTIFF files are read in every
 * tier, as IFC files are: below BIM och GIS the raster is its table of files.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/raster', [], () => {
    const EXT = /\.(tiff?|gtiff)$/i;
    /** data/raster, with its group loaded the first time. @returns {Promise<any>} */
    const lib = () => D.ensure(['raster'], () => D.require('data/raster'));
    /** A TIFF by its name or its type. @param {File} file */
    function detect(file) { return EXT.test((file && file.name) || '') || /^image\/tiff\b/i.test((file && file.type) || ''); }
    /** Inhämta's preview of one file (data/raster preview). @param {File} file */
    async function preview(file) { return (await lib()).preview(file); }
    /** The file's row as a table. @param {File} file */
    async function parse(file) {
      const p = await (await lib()).preview(file);
      return { columns: p.columns, rows: p.dataRows, meta: { format: 'raster' } };
    }
    /** One raster from the files (data/raster importFiles). @param {File[]} files @param {any} options @param {string} [name] @param {Function} [progress] */
    async function importFiles(files, options, name, progress) { return (await lib()).importFiles(files, options, name, progress); }
    return { id: 'raster', kind: 'raster', collection: true, detect, accepts: detect, preview, parse, importFiles };
  });
})();
