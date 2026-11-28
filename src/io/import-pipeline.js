// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Import pipeline: pick an importer for a file, preview with inferred column types, let the user
 * adjust names and types, then parse everything and create a dataset. It loads with the importers as the group 'import'
 * (src/boot.js); the start reaches it through io/import, which waits for the group.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/import-pipeline', ['io/import', 'io/importers/csv', 'io/importers/excel', 'io/importers/json', 'io/importers/xml', 'io/importers/sqlite', 'io/importers/r-formats', 'io/importers/shapefile', 'io/importers/fixed-width', 'io/importers/tables', 'io/importers/geo', 'io/importers/gml', 'io/importers/access', 'io/importers/documents', 'io/importers/images', 'io/importers/raster', 'io/importers/detaljplan', 'io/importers/graph', 'io/importers/model', 'io/importers/plan-delivery', 'io/sniff', 'data/plan-delivery', 'data/plan', 'data/types', 'data/datasets', 'platform/tier'], (thin, csv, excel, json, xml, sqliteImp, rFormats, shapefile, fixedWidth, tables, geo, gml, access, documents, images, raster, detaljplanImp, graphImp, modelImp, deliveryImp, sniffer, delivery, plan, types, datasets, tier) => {
    // Documents go before the table-in-document importer: a Word or Markdown file is a document unless "tables" is chosen.
    // A TIFF is a raster before it is a picture (the browsers cannot draw TIFF files).
    // The plan importer never detects by extension (resolveImporter sniffs JSON heads for it); it is listed for forced formats.
    const importers = [excel, documents, raster, images, tables, geo, gml, json, xml, sqliteImp, access, shapefile, rFormats, fixedWidth, csv, detaljplanImp, graphImp, modelImp];
    /** Importers that turn one or several files into one dataset of their own kind (documents, rasters, images). */
    const collections = [documents, raster, images];

    /** Whether an importer (or the BCF or QGIS reader) knows the extension of a name; the file's type is not looked at. */
    function knownName(name) {
      const bare = { name: String(name || ''), type: '' };
      return /\.(bcf|bcfzip|qgs|qgz)$/i.test(bare.name) || importers.some((i) => i.detect(bare));
    }
    /** Files renamed by their contents, with what they were recognised as; and the recognitions under way. */
    const recognised = new WeakMap();
    const pending = new WeakMap();
    /**
     * The file as the importers see it (decision F83 a). A name with an extension an importer knows decides, as before.
     * Otherwise the start of the file is read (io/sniff), and a sure signature gives the file the extension and type of what it
     * is: the same file under its own name with the extension added (a nameless one under the default name). An unsure one is
     * returned as it is, and keeps today's way (the person's choice, CSV by default).
     * @param {File} file @returns {Promise<File>}
     */
    function recognise(file) {
      if (!file || typeof file.slice !== 'function' || recognised.has(file) || knownName(file.name)) return Promise.resolve(file);
      if (!pending.has(file)) {
        pending.set(file, (async () => {
          let found = null;
          try { found = await sniffer.sniff(file); } catch (err) { D.log('import', err); }
          // No sure signature: a text is read as a text document, paragraph by paragraph, rather than guessed as a table (decision
          // F119 a), and anything else is not read at all; the name is not changed for a guess (F120 a).
          if (!found) {
            let text = false;
            try { text = await sniffer.isText(file); } catch (err) { D.log('import', err); }
            if (!text) { recognised.set(file, { unknown: true }); return file; }
            found = { ext: 'txt', format: D.t('import.recognised.text.format'), type: 'text/plain', document: true };
          }
          const renamed = new File([file], `${file.name || D.t('datasets.default.name')}.${found.ext}`, { type: found.type || file.type, lastModified: file.lastModified });
          const path = /** @type {any} */ (file).webkitRelativePath || /** @type {any} */ (file).dmPath;
          if (path) /** @type {any} */ (renamed).dmPath = `${path}.${found.ext}`;
          recognised.set(renamed, found);
          return renamed;
        })());
      }
      return pending.get(file);
    }
    /** What a file's contents were recognised as ({ext, format, type}), or null when its name decided. @param {File} file */
    function recognisedAs(file) { const found = recognised.get(file); return found && !found.unknown ? found : null; }

    /** @param {File} file @param {string} [forced] importer id */
    function importerFor(file, forced) {
      if (forced) { const found = importers.find((i) => i.id === forced); if (found) return found; }
      // A file without a known extension that no signature knows (recognise): a text is a document, anything else is not read.
      const guess = recognised.get(file);
      if (guess && guess.document) return documents;
      if (guess && guess.unknown) throw new Error(D.t('import.err.unrecognised', { name: file.name || D.t('datasets.default.name') }));
      return importers.find((i) => i.detect(file)) || csv;
    }

    /**
     * Like importerFor, but looks at the start of the file where the extension is ambiguous: a TopoJSON
     * topology saved as .json goes to the map importer, an Excel 2003 XML workbook saved as .xml to the
     * spreadsheet importer.
     * @param {File} file @param {string} [forced] importer id
     */
    async function resolveImporter(file, forced) {
      if (forced === 'datapackage') return D.require('io/datapackage');
      if (forced === 'bcf' || (!forced && /\.(bcf|bcfzip)$/i.test(file.name || ''))) {
        // The BCF importer loads with the group 'families' (src/boot.js); a tier that reads no BCF files refuses them before that.
        tier.guard('import:bcf');
        return D.ensure(['families'], () => D.require('io/importers/bcf'));
      }
      if (!forced && /\.zip$/i.test(file.name) && await D.require('io/datapackage').sniff(file)) return D.require('io/datapackage');
      // An archive package of a plan (metadata/PREMIS.xml with the plan in content/), zipped as a whole.
      if (forced === 'planarchive' || (!forced && /\.zip$/i.test(file.name) && await D.require('io/importers/plan-archive').sniff(file))) return D.require('io/importers/plan-archive');
      // A digital översiktsplan delivered as a ZIP: GeoPackages with their Word files, a manifest.xml or a metadata.xml.
      if (forced === 'opdelivery' || (!forced && /\.zip$/i.test(file.name) && await deliveryImp.sniff(file))) return deliveryImp;
      const importer = importerFor(file, forced);
      if (forced || (importer !== json && importer !== xml && importer !== geo)) return importer;
      const head = await file.slice(0, 65536).text();
      // Digital plans (national specification, NGP reference objects, ÖP exchange model) are GeoJSON with markers.
      if ((importer === json || importer === geo) && detaljplanImp.sniff(head)) return detaljplanImp;
      // Graphs: node-link JSON, GraphML and GEXF (XML) are recognised by their contents.
      if ((importer === json || importer === xml) && graphImp.sniff(head)) return graphImp;
      if (importer === json && /"type"\s*:\s*"Topology"/.test(head)) return geo;
      if (importer === xml && /urn:schemas-microsoft-com:office:spreadsheet/.test(head)) return excel;
      // GML saved as .xml (a WFS answer, an INSPIRE download) goes to the GML reader.
      if (importer === xml && gml.sniff(head)) return gml;
      return importer;
    }

    /** Parse a file to a raw table with the importer its options name (a linked file read again keeps its options). */
    async function parse(file, options = {}) {
      file = await recognise(file);
      const importer = await resolveImporter(file, options.format);
      if (importer.viaR) throw new Error(D.t('linked.err.viar'));
      return importer.parse(file, options);
    }
    // The pure helpers live in io/import at start, so that the start reaches them without the importers.
    const { baseName, materialize, folderOf } = thin;

    /**
     * Preview a file: columns, sample rows and inferred types.
     * @param {File} file
     * @param {Record<string, any>} [options] format, encoding, delimiter, header, sheet, path, decimal
     */
    async function preview(file, options = {}) {
      file = await recognise(file);
      const importer = await resolveImporter(file, options.format);
      // A file that only a feature of a higher tier reads (platform/tier, `import:<id>`: BCF files) is refused before it is read.
      tier.guard('import:' + importer.id);
      const p = await importer.preview(file, options);
      // A GeoPackage in Boverket's ÖP model can be imported whole as a comprehensive plan.
      if (importer === sqliteImp && p.gpkg && plan.isOpGeoPackage(p.tables)) { p.oversiktsplan = true; p.planGpkg = 'oversiktsplan'; }
      // A detaljplan in Rita Detaljplan's GeoPackage, and the Nordic plan GeoPackages (Norwegian reguleringsplan/kommuneplan,
      // Icelandic stafrænt deiliskipulag) likewise.
      else if (importer === sqliteImp && p.gpkg && plan.isDpGeoPackage(p.tables)) p.planGpkg = 'detaljplan';
      else if (importer === sqliteImp && p.gpkg && plan.nordic.gpkgKind(p.tables)) p.planGpkg = plan.nordic.gpkgKind(p.tables);
      // Any GeoPackage with several feature layers can also be imported whole, as one dataset of the kind layers.
      if (importer === sqliteImp && p.gpkg) p.layerCount = (p.featureTables || []).length;
      // A coordinate system the app cannot convert: the places are kept as they are, but not drawn (Inhämta says so).
      const named = p.crs || (p.plan && p.plan.crs) || '';
      if (named && D.require('data/geo').crsUnknown(named)) p.crsUnknown = String(named);
      const columns = types.cleanColumnNames(p.columns);
      const inferred = types.inferColumns(columns, p.dataRows, { decimal: options.decimal });
      // Declared types (SQLite schemas) win over inference for empty or ambiguous columns.
      if (p.declaredTypes) inferred.forEach((c, i) => { if (p.declaredTypes[i] && (p.declaredTypes[i] !== 'text' || c.type === 'text')) c.type = p.declaredTypes[i]; });
      // A file recognised by its contents says so in the preview, with the format it was recognised as.
      const found = recognisedAs(file);
      if (found) p.recognised = found.format;
      if (found && found.document) p.recognisedText = true;
      return Object.assign(p, { importer: importer.id, columns, inferred: inferred.map((c, i) => Object.assign({ include: true, label: columns[i], sourceName: p.columns[i] }, c)) });
    }

    /** Delimited files at least this large are streamed in chunks instead of being read as one string. */
    const STREAM_BYTES = 64 * 1024 * 1024;

    /** Files that come along with a folder and hold no data. */
    const JUNK = /^(thumbs\.db|desktop\.ini|\.ds_store)$|^\._/i;
    /**
     * A mixed choice of files, sorted: pictures become one collection, documents another, and every other file a dataset of
     * its own. What the app cannot read is listed, not guessed at. When the choice holds one or more GeoPackages with Word files,
     * a manifest.xml or a metadata.xml, `delivery` offers all of them as one digital översiktsplan (data/plan-delivery); `op`
     * says whether a GeoPackage follows the ÖP model, which makes it the choice by default.
     * @param {File[]} files
     * @returns {Promise<{groups: Array<{importer: string, collection: boolean, files: File[], name?: string}>, skipped: File[], delivery: {importer: string, collection: boolean, files: File[], op: boolean, name: string}|null}>}
     */
    async function sortFiles(files) {
      files = Array.from(files);
      const collected = new Map(); const singles = []; const skipped = [];
      // An archive package of a plan (a folder with metadata/PREMIS.xml) is read whole: its files are one plan, not a mix.
      const packages = [];
      const archive = D.require('io/importers/plan-archive');
      while (archive.isPackage(files)) {
        const { map, root } = archive.byPath(files);
        const inPackage = new Set(map.values());
        packages.push({ importer: 'planarchive', collection: false, files: Array.from(inPackage), name: root });
        files = files.filter((f) => !inPackage.has(f));
      }
      // A shapefile's parts go with its .shp (io/importers/shapefile bundle). The other files by their contents where their names
      // say nothing; a package keeps its paths for its checksums.
      files = await Promise.all(shapefile.bundle(files).map(recognise));
      for (const file of files) {
        if (JUNK.test(file.name)) continue;
        if (!importers.some((i) => i.detect(file)) && !(await D.require('io/datapackage').sniff(file))) { skipped.push(file); continue; }
        const importer = await resolveImporter(file);
        if (importer.collection) {
          if (!collected.has(importer.id)) collected.set(importer.id, { importer: importer.id, collection: true, files: [] });
          collected.get(importer.id).files.push(file);
        } else singles.push({ importer: importer.id, collection: false, files: [file] });
      }
      const groups = Array.from(collected.values());
      const folder = folderOf(files);
      for (const g of groups) g.name = groups.length === 1 && folder ? folder : D.t('import.collection.' + g.importer, { n: g.files.length });
      return { groups: packages.concat(groups, singles), skipped, delivery: files.length > 1 ? await delivery.candidate(files) : null };
    }
    /**
     * Read the groups one at a time. A file that fails does not stop the others.
     * @param {any[]} groups @param {Function} [progress] @returns {Promise<Array<{group: any, meta: any, error: string|null}>>}
     */
    async function runSorted(groups, progress) {
      const out = [];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (progress) progress({ index: i, total: groups.length, file: group.files[0].name });
        try {
          const meta = group.importer === 'planarchive' ? await D.require('io/importers/plan-archive').importFiles(group.files, {})
            : group.importer === 'opdelivery' ? await delivery.importDelivery(group.files, { folder: folderOf(group.files) })
            : group.collection ? await runFiles(group.files, { format: group.importer }, group.name) : await run(group.files[0], { format: group.importer }, null, group.name);
          out.push({ group, meta, error: null });
        } catch (err) { out.push({ group, meta: null, error: String((err && err.message) || err) }); }
      }
      return out;
    }

    /**
     * Full import.
     * @param {File} file
     * @param {Record<string, any>} options importer options (format, encoding, delimiter, header, sheet, path, decimal)
     * @param {Array<any>|null} specs column specs from the wizard, or null to use inferred types
     * @param {string} [name]
     */
    /** The collection importer that takes every one of the files (all documents, or all images), or null. */
    function collectionFor(files, forced) {
      if (!files || !files.length) return null;
      if (forced) { const found = collections.find((i) => i.id === forced); return found || null; }
      return collections.find((i) => files.every((f) => i.accepts(f))) || null;
    }

    /**
     * Import several files as one dataset of a collection kind (documents or images).
     * @param {File[]} files @param {any} options @param {string} [name] @param {Function} [progress]
     */
    async function runFiles(files, options = {}, name, progress) {
      files = await Promise.all(Array.from(files || []).map(recognise));
      const importer = collectionFor(files, options.format);
      if (!importer) throw new Error(D.t('import.err.collection'));
      return importer.importFiles(files, options, name, progress);
    }

    async function run(file, options, specs, name, progress) {
      file = await recognise(file);
      const importer = await resolveImporter(file, options.format);
      tier.guard('import:' + importer.id);
      // A document or image keeps its kind and its files; the column step does not apply to it.
      if (importer.collection) return importer.importFiles([file], options, name, progress);
      // A digital plan becomes a plan dataset (rows per provision, the original kept); so does an ÖP-model GeoPackage when asked.
      if (importer.id === 'detaljplan' || importer.id === 'planarchive' || importer.id === 'opdelivery' || importer.id === 'graph' || importer.id === 'model' || importer.id === 'datapackage' || importer.id === 'bcf') return importer.importFile(file, options, name, progress);
      // A plan GeoPackage whole: an ÖP-model one through data/plan-delivery (a delivery of one file, with its sections and
      // links), the others as their plan (data/plan-delivery hands them to the plan importer).
      if (importer.id === 'sqlite' && options.plan) return delivery.importDelivery([file], options, name, progress);
      // Any GeoPackage whole: every feature layer in one dataset of the kind layers.
      if (importer.id === 'sqlite' && options.layers) return delivery.importLayers(file, options, name, progress);
      if (importer.viaR) return importer.importViaR(file, name || baseName(file.name), options);
      if (importer.id === 'sqlite') {
        // A Dataspatium file is restored with its metadata, log and versions intact.
        const info = await sqliteImp.preview(file, Object.assign({}, options, { previewRows: 1 }));
        if (info.dataspatium) return datasets.importBytes(await file.arrayBuffer(), name ? { name } : {});
      }
      if (importer.id === 'csv' && (options.stream || file.size >= STREAM_BYTES)) return runStream(file, options, specs, name, progress);
      const table = await importer.parse(file, options);
      table.columns = types.cleanColumnNames(table.columns);
      const columnSpecs = specs || types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, columnSpecs, options);
      // A pasted text read as the format it was recognised as (Klistra in in Inhämta) is still a pasted text.
      return datasets.create({
        name: name || baseName(file.name),
        columns, rows,
        source: options.pasted ? { kind: 'paste', format: table.meta.format } : { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: table.meta.format, linked: !!options.linked },
        importOptions: Object.assign({}, options, table.meta),
      });
    }

    /**
     * Chunked import of a large delimited file: PapaParse streams the File, each chunk is typed and
     * inserted into the new dataset's engine, and the text never sits in memory as a whole. Column types
     * come from the wizard (specs) or are inferred from the first chunk. `progress({rows})` after each chunk.
     */
    async function runStream(file, options, specs, name, progress) {
      let handle = null; let names = null; let columnSpecs = specs;
      try {
        const result = await csv.parseStream(file, options, async (rows, info) => {
          if (!handle) {
            names = types.cleanColumnNames(info.columns);
            // Without specs from the wizard the types are inferred from the first chunk that has rows.
            if (!columnSpecs && !rows.length) return;
            if (!columnSpecs) columnSpecs = types.inferColumns(names, rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
            const first = materialize({ columns: names, rows }, columnSpecs, options);
            handle = await datasets.createEmpty({
              name: name || baseName(file.name), columns: first.columns,
              source: { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'csv', linked: !!options.linked },
              importOptions: Object.assign({}, options),
            });
            await datasets.appendImportRows(handle, first.rows);
          } else {
            await datasets.appendImportRows(handle, materialize({ columns: names, rows }, columnSpecs, options).rows);
          }
          if (progress) progress({ rows: info.total, bytes: file.size });
        });
        if (!handle) {
          // An empty file: create the dataset from the header alone.
          if (!result.columns.length) throw new Error(D.t('import.err.nocolumns'));
          names = types.cleanColumnNames(result.columns);
          columnSpecs = columnSpecs || names.map((n) => ({ name: n, type: 'text', include: true }));
          handle = await datasets.createEmpty({ name: name || baseName(file.name), columns: materialize({ columns: names, rows: [] }, columnSpecs, options).columns, source: { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'csv', linked: !!options.linked }, importOptions: Object.assign({}, options) });
        }
        return await datasets.finishImport(handle, { importOptions: Object.assign({}, options, result.meta), streamed: true });
      } catch (err) {
        if (handle) datasets.abortImport(handle);
        throw err;
      }
    }

    /** Import pasted text as a dataset. */
    async function runText(text, options, specs, name) {
      const table = await csv.parseText(text, options);
      table.columns = types.cleanColumnNames(table.columns);
      const columnSpecs = specs || types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, columnSpecs, options);
      return datasets.create({ name: name || D.t('import.paste.name'), columns, rows, source: { kind: 'paste', format: 'text' }, importOptions: Object.assign({}, options, table.meta) });
    }

    /** The formats of bundled examples that are read by their importer as the file itself would be: plans, models, graphs, JSON. */
    const PRESET_FILES = new Set(['detaljplan', 'model', 'graph', 'json']);
    /**
     * Import one of the bundled example datasets (see presets/presets.js). A plan, a model, a graph or a JSON file goes through its
     * importer as the file would, and keeps the example's short name, description and origin.
     * @param {{id: string, name: string, asset: string, format?: string, options?: any, source?: any, description?: string}} preset
     */
    async function runPreset(preset) {
      const text = await D.assets.loadText(preset.asset);
      if (preset.format && PRESET_FILES.has(preset.format)) {
        const fileName = String(preset.asset).split('/').pop() || preset.id;
        const title = preset.nameKey ? D.t(preset.nameKey) : preset.name;
        const meta = await run(new File([text], fileName), Object.assign({ format: preset.format }, preset.options || {}), null, title);
        return datasets.updateMeta(meta.id, {
          shortName: await datasets.uniqueShortName(preset.shortName || title, meta.id),
          description: preset.descriptionKey ? D.t(preset.descriptionKey) : (preset.description || ''),
          source: Object.assign({}, meta.source || {}, { kind: 'preset', preset: preset.id }, preset.source || {}),
        });
      }
      const options = Object.assign({ header: true }, preset.options || {});
      let table;
      if (preset.format === 'geojson') {
        // Bundled boundaries: a FeatureCollection becomes one row per feature with a geometry text column.
        table = Object.assign(json.tabulate(json.toRecords(json.parseJsonText(text), '')), { meta: { format: 'geojson' } });
      } else {
        table = await csv.parseText(text, options);
      }
      table.columns = types.cleanColumnNames(table.columns);
      const specs = types.inferColumns(table.columns, table.rows, { decimal: options.decimal }).map((c) => Object.assign({ include: true }, c));
      const { columns, rows } = materialize(table, specs, options);
      const name = preset.nameKey ? D.t(preset.nameKey) : preset.name;
      const description = preset.descriptionKey ? D.t(preset.descriptionKey) : (preset.description || '');
      return datasets.create({ name, shortName: preset.shortName, description, columns, rows, source: Object.assign({ kind: 'preset', preset: preset.id }, preset.source || {}), importOptions: Object.assign({}, options, table.meta) });
    }

    async function previewText(text, options = {}) {
      const table = await csv.parseText(text, options);
      const columns = types.cleanColumnNames(table.columns);
      const inferred = types.inferColumns(columns, table.rows, { decimal: options.decimal });
      return { kind: 'text', columns, dataRows: table.rows.slice(0, 100), header: table.meta.header, delimiter: table.meta.delimiter, totalRows: table.rows.length, importer: 'csv', inferred: inferred.map((c, i) => Object.assign({ include: true, label: columns[i], sourceName: table.columns[i] }, c)) };
    }

    return { importers, importerFor, resolve: resolveImporter, recognise, recognisedAs, preview, parse, run, runText, runFiles, collectionFor, sortFiles, runSorted, runPreset, previewText };
  });
})();
