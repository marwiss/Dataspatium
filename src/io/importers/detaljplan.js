// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Importer for digital plans (dataset kind "plan"): detailed development plans and comprehensive plans as GeoJSON
 * per the national specification or as Lantmäteriet's NGP reference objects, and Boverket's ÖP-model GeoPackage.
 * The file is never picked by extension (every GeoJSON would be a plan): io/import sniffs the head of JSON files
 * for the exchange model's markers and hands the file here; the GeoPackage path is chosen in Inhämta's options.
 * One file becomes one plan dataset: rows per plan area and provision (data/plan), the original kept in `_files`,
 * and the plan's facts in `_meta.plan`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/detaljplan', ['data/plan', 'data/dataset-files', 'data/encoding', 'io/importers/sqlite'], (plan, dsFiles, encoding, sqliteImp) => {
    // Swedish markers, then the Nordic ones: Plandata.dk (planid + komnr), Ryhti's kaavatietomalli (planObjects),
    // Skipulagsstofnun (skipnr with audkenni/skipStig/byggTeg/flokkur).
    const MARKERS = /"feature:typ"|"feature:mediatyp"|"planbestammelsekatalogreferens"|"stac_version"|"innehallOP"|"innehallstyp"|"planid"|"planObjects"|"skipnr"/;
    const WORDS = /detaljplan|planbestammelse|oversiktsplan|innehallOP|innehallstyp|"komnr"|planRegulationGroups|geographicalArea|audkenni|skipStig|byggTeg|flokkur/i;
    const uiLang = () => { try { return D.require('ui/i18n').language(); } catch (_e) { return 'sv'; } };

    /** How many plans each NGP file read so far holds (io/import asks while choosing the importer, the preview after it). */
    const counted = new WeakMap();
    /**
     * How many plans a file of NGP reference objects holds, 0 for any other file; kept per file. A file with several is read as a
     * map of the plans (io/import), as an API answer of many plans is (FU-3230). @param {File} file @returns {Promise<number>}
     */
    async function plansIn(file) {
      if (counted.has(file)) return counted.get(file);
      let n = 0;
      try {
        if (/"stac_version"/.test(await file.slice(0, 65536).text())) {
          const data = JSON.parse((await encoding.readText(file)).text);
          n = plan.detect(data) === 'ngp' ? plan.planCount(data) : 0;
        }
      } catch (_err) { n = 0; }
      counted.set(file, n);
      return n;
    }
    /** The count plansIn() found for a file, or 0 when it has not been asked. @param {File} file */
    const plansCounted = (file) => counted.get(file) || 0;

    /** Never by extension; io/import calls sniff() on the file head instead. */
    function detect() { return false; }
    /** True when the first kilobytes of a JSON file look like a plan in one of the read formats. */
    function sniff(head) { return MARKERS.test(head) && WORDS.test(head); }

    /** Parse a plan file: {format, plan, rows} with catalogue facts filled in for detailed plans. */
    async function read(file, options = {}) {
      const text = typeof file === 'string' ? file : (await encoding.readText(file, { encoding: options.encoding })).text;
      let data;
      try { data = JSON.parse(text); } catch (_err) { throw new Error(D.t('plan.err.json')); }
      const format = plan.detect(data);
      if (!format) throw new Error(D.t('plan.err.format'));
      // Reference objects of several plans (a municipality's plan areas) are a map of plans, not one plan: io/import reads such a
      // file as a map, and a plan is not made of it with the first plan's facts.
      if (format === 'ngp') { const n = plan.planCount(data); if (n > 1) throw new Error(D.t('plan.err.many', { n })); }
      const swedish = format === 'ngp' || format === 'detaljplan' || format === 'oversiktsplan';
      const parsed = format === 'ngp' ? plan.fromNgp(data, options) : format === 'detaljplan' ? plan.fromDetaljplan(data, options) : format === 'oversiktsplan' ? plan.fromOversiktsplanGeoJson(data, options) : await plan.nordic.read(format, data, Object.assign({ lang: uiLang() }, options));
      if (swedish && parsed.plan.slag === 'detaljplan') await plan.decorate(parsed.rows);
      // The national specification names the municipality by its code: its name comes from the boundaries that ship with the app.
      if (swedish && parsed.plan.kommunkod && (!parsed.plan.kommun || parsed.plan.kommun === parsed.plan.kommunkod)) {
        try {
          const hit = (await D.require('data/boundaries').features('kommuner')).find((f) => String(f.code) === parsed.plan.kommunkod);
          if (hit && hit.name) parsed.plan.kommun = String(hit.name);
        } catch (err) { D.log('detaljplan', 'municipality name', err); }
      }
      return Object.assign({ format }, parsed);
    }
    const columnsFor = (info) => (info.slag === 'oversiktsplan' ? plan.OP_COLUMNS : plan.DP_COLUMNS);
    function defaultName(info, file) {
      return info.namn || info.beteckning || (file && file.name ? String(file.name).replace(/\.[^.]+$/, '') : D.t('plan.name.default'));
    }

    /** Preview for Inhämta: the plan's facts and the rows as a table. */
    async function preview(file, options = {}) {
      const r = await read(file, options);
      const columns = columnsFor(r.plan);
      return { kind: 'plan', format: 'detaljplan', plan: r.plan, planFormat: r.format, header: true, columns: columns.map((c) => c.name), declaredTypes: columns.map((c) => c.type), dataRows: plan.toRows(r.rows, columns).slice(0, options.previewRows || 100), totalRows: r.rows.length, datasetName: defaultName(r.plan, file) };
    }
    /** Rows parsed as a table (for the generic column step when someone insists on a table). */
    async function parse(file, options = {}) {
      const r = await read(file, options);
      const columns = columnsFor(r.plan);
      return { columns: columns.map((c) => c.name), rows: plan.toRows(r.rows, columns), meta: { format: 'detaljplan', plan: r.plan, declaredTypes: columns.map((c) => c.type) } };
    }

    /** Create the plan dataset. */
    async function createPlanDataset(info, rows, name, source, files) {
      const columns = columnsFor(info);
      return dsFiles.createDataset({ name, kind: 'plan', columns, rows: plan.toRows(rows, columns), files: files || [], source, meta: { plan: info } });
    }
    /**
     * One plan file (GeoJSON per the specification or NGP reference objects) → one plan dataset. `options.source` adds to the
     * dataset's source (a plan fetched from a service, api/ngp-plans).
     */
    async function importFile(file, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: file.name });
      const r = await read(file, options);
      // An översiktsplan's rows name the file they came in (OP_COLUMNS `fil`); a GeoJSON file has no layers.
      if (r.plan.slag === 'oversiktsplan') for (const row of r.rows) row.fil = file.name;
      const original = { name: file.name, kind: 'original', type: file.type || 'application/geo+json', bytes: new Uint8Array(await file.arrayBuffer()) };
      const source = Object.assign({ kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'detaljplan', planFormat: r.format }, options.source || {});
      return createPlanDataset(r.plan, r.rows, name || defaultName(r.plan, file), source, [original]);
    }
    /** An API answer (flattened columns) with NGP reference objects or a Nordic plan layer → one plan dataset. */
    async function importTable(columns, rows, name, source) {
      const format = plan.tableFormat(columns);
      if (!format) throw new Error(D.t('plan.err.format'));
      let parsed;
      if (format === 'ngp') { parsed = plan.fromReferenceTable(columns, rows); await plan.decorate(parsed.rows); }
      else parsed = await plan.nordic.read(format, plan.nordic.featuresFromTable(columns, rows), { crs: 'EPSG:4326', lang: uiLang() });
      return importParsed(Object.assign({ format }, parsed), name, source);
    }
    /** A parsed plan ({format, plan, rows}, e.g. fetched from a service) → one plan dataset. */
    async function importParsed(parsed, name, source) {
      return createPlanDataset(parsed.plan, parsed.rows, name || parsed.plan.namn || parsed.plan.beteckning || D.t('plan.name.default'), Object.assign({ planFormat: parsed.format }, source || {}), []);
    }

    const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
    const cellOf = (v) => (v instanceof Uint8Array || (v && typeof v === 'object' && v.buffer) ? null : v);
    /** The tables of Boverket's ÖP model (0.4) the plan is read from, besides the content: the plan, its decisions and links. */
    const OP_TABLES = ['oversiktsplan', 'beslut_op', 'beslut_op_handelse', 'beslut_op_dokumentreferens', 'dokumentavsnitt', 'avsnittsbokmärke', 'avsnittsbokmarke', 'dokumentreferens_op', 'oversiktsplan_underlag', 'oversiktsplan_underlag_underlag'];
    /** The tables of Rita Detaljplan's GeoPackage that make up the plan (the helper layers and the plug-in's own table are left out). */
    const DP_TABLES = ['detaljplan', 'anvandning_yta', 'egenskap_yta', 'egenskap_linje', 'egenskap_punkt', 'bestammelse', 'beslutsinformation', 'dokument'];
    /** Which plan a GeoPackage holds, by its table names: 'oversiktsplan', 'detaljplan' (Rita Detaljplan), a Nordic kind or null. */
    function gpkgKind(names) { return plan.isOpGeoPackage(names) ? 'oversiktsplan' : plan.isDpGeoPackage(names) ? 'detaljplan' : plan.nordic.gpkgKind(names); }
    /**
     * A plan GeoPackage → one plan dataset with every layer: Boverket's ÖP model (`innehall_op_*` tables, as Rita Översiktsplan
     * writes it), a detaljplan in Rita Detaljplan's model, a Norwegian reguleringsplan or kommuneplan (Rp and Kp tables per the
     * SOSI product specifications) or an Icelandic stafrænt deiliskipulag (the Skipulagsstofnun template).
     */
    async function importGeoPackage(file, options = {}, name, progress) {
      const { parsed } = await readGeoPackage(file, options, progress);
      const original = options.keepOriginal === false ? [] : [{ name: file.name, kind: 'original', type: file.type || 'application/geopackage+sqlite3', bytes: new Uint8Array(await file.arrayBuffer()) }];
      return createPlanDataset(parsed.plan, parsed.rows, name || parsed.plan.namn || String(file.name).replace(/\.[^.]+$/, ''), { kind: 'file', fileName: file.name, size: file.size, format: 'geopackage', planFormat: parsed.plan.format || 'oversiktsplan-gpkg' }, original);
    }
    /** Read a plan GeoPackage without making a dataset: {kind, parsed} with parsed = {plan, rows}, catalogue facts filled in. */
    async function readGeoPackage(file, options = {}, progress) {
      const { engine } = await sqliteImp.openFile(file);
      try {
        const all = (await engine.exec("select name from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name"));
        const names = (all[0] ? all[0].values : []).map((r) => String(r[0]));
        const kind = gpkgKind(names);
        if (!kind) throw new Error(D.t('plan.err.notop'));
        const info = await sqliteImp.describe(engine);
        const tables = [];
        const wanted = kind === 'oversiktsplan'
          ? names.filter((n) => /^innehall_op_/i.test(n) || OP_TABLES.includes(n.toLowerCase())).filter((n) => !/_lookup$/i.test(n))
          : kind === 'detaljplan' ? names.filter((n) => DP_TABLES.includes(n.toLowerCase()))
            : names.filter((n) => info.geometryColumns.has(n) || /^(rp|kp|rb)/i.test(n));
        let done = 0;
        for (const t of wanted) {
          const pragma = await engine.exec(`pragma table_info(${q(t)})`);
          const cols = (pragma[0] ? pragma[0].values : []).map((r) => String(r[1]));
          const geomCol = info.geometryColumns.get(t) || cols.find((c) => /^(geom|shape)$/i.test(c)) || null;
          // In batches, so that a large layer leaves the main thread free between them.
          const rows = [];
          await sqliteImp.readRows(engine, t, { columns: cols, geometryColumn: geomCol, onRows: (batch) => { for (const r of batch) rows.push(r.map(cellOf)); } });
          tables.push({ name: t, columns: cols, rows, crs: info.crs.get(t) || '' });
          done++;
          if (progress) progress({ step: 'table', done, total: wanted.length, table: t });
        }
        const parsed = kind === 'oversiktsplan' ? plan.fromOpTables(tables, Object.assign({ fileName: file.name }, options)) : kind === 'detaljplan' ? plan.fromDpTables(tables, options) : await plan.nordic.readTables(kind, tables, options);
        // Tables without a single row: most often a copy made while QGIS had the project open, with the edits still in the -wal file.
        if (!parsed.rows.length) throw new Error(D.t(tables.length && tables.every((x) => !x.rows.length) ? 'plan.err.empty.gpkg' : 'plan.err.empty'));
        if (kind === 'detaljplan') await plan.decorate(parsed.rows);
        return { kind, parsed };
      } finally { engine.terminate(); }
    }
    /** Kept for callers of the 2.9.0 name. */
    const importOpGeoPackage = importGeoPackage;

    return { id: 'detaljplan', kind: 'plan', detect, sniff, plansIn, plansCounted, read, preview, parse, importFile, importTable, importParsed, importGeoPackage, importOpGeoPackage, readGeoPackage, gpkgKind, columnsFor, createPlanDataset, defaultName };
  });
})();
