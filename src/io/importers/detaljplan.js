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
    const MARKERS = /"feature:typ"|"feature:mediatyp"|"planbestammelsekatalogreferens"|"stac_version"|"innehallOP"|"innehallstyp"/;
    const WORDS = /detaljplan|planbestammelse|oversiktsplan|innehallOP|innehallstyp/i;

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
      const parsed = format === 'ngp' ? plan.fromNgp(data, options) : format === 'detaljplan' ? plan.fromDetaljplan(data, options) : plan.fromOversiktsplanGeoJson(data, options);
      if (parsed.plan.slag === 'detaljplan') await plan.decorate(parsed.rows);
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
    /** One plan file (GeoJSON per the specification or NGP reference objects) → one plan dataset. */
    async function importFile(file, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: file.name });
      const r = await read(file, options);
      const original = { name: file.name, kind: 'original', type: file.type || 'application/geo+json', bytes: new Uint8Array(await file.arrayBuffer()) };
      return createPlanDataset(r.plan, r.rows, name || defaultName(r.plan, file), { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'detaljplan', planFormat: r.format }, [original]);
    }
    /** An API answer with NGP reference objects (flattened columns) → one plan dataset. */
    async function importTable(columns, rows, name, source) {
      const parsed = plan.fromReferenceTable(columns, rows);
      await plan.decorate(parsed.rows);
      return createPlanDataset(parsed.plan, parsed.rows, name || parsed.plan.namn || parsed.plan.beteckning || D.t('plan.name.default'), Object.assign({ planFormat: 'ngp' }, source || {}), []);
    }

    const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
    const cellOf = (v) => (v instanceof Uint8Array || (v && typeof v === 'object' && v.buffer) ? null : v);
    /** Boverket's ÖP-model GeoPackage (`innehall_op_*` tables) → one plan dataset with every content layer. */
    async function importOpGeoPackage(file, options = {}, name, progress) {
      const { engine } = await sqliteImp.openFile(file);
      try {
        const all = (await engine.exec("select name from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name"));
        const names = (all[0] ? all[0].values : []).map((r) => String(r[0]));
        if (!plan.isOpGeoPackage(names)) throw new Error(D.t('plan.err.notop'));
        const info = await sqliteImp.describe(engine);
        const tables = [];
        const wanted = names.filter((n) => /^innehall_op_/i.test(n) || n.toLowerCase() === 'oversiktsplan').filter((n) => !/_lookup$/i.test(n));
        let done = 0;
        for (const t of wanted) {
          const pragma = await engine.exec(`pragma table_info(${q(t)})`);
          const cols = (pragma[0] ? pragma[0].values : []).map((r) => String(r[1]));
          const geomCol = info.geometryColumns.get(t) || cols.find((c) => /^(geom|shape)$/i.test(c)) || null;
          const res = await engine.exec(`select * from ${q(t)}`);
          const rows = (res[0] ? res[0].values : []).map((r) => r.map((v, i) => (geomCol && cols[i] === geomCol ? sqliteImp.gpbToGeoJson(v) : cellOf(v))));
          tables.push({ name: t, columns: cols, rows, crs: info.crs.get(t) || '' });
          done++;
          if (progress) progress({ step: 'table', done, total: wanted.length, table: t });
        }
        const parsed = plan.fromOpTables(tables, options);
        if (!parsed.rows.length) throw new Error(D.t('plan.err.empty'));
        const original = options.keepOriginal === false ? [] : [{ name: file.name, kind: 'original', type: file.type || 'application/geopackage+sqlite3', bytes: new Uint8Array(await file.arrayBuffer()) }];
        return createPlanDataset(parsed.plan, parsed.rows, name || parsed.plan.namn || String(file.name).replace(/\.[^.]+$/, ''), { kind: 'file', fileName: file.name, size: file.size, format: 'geopackage', planFormat: 'oversiktsplan-gpkg' }, original);
      } finally { engine.terminate(); }
    }

    return { id: 'detaljplan', kind: 'plan', detect, sniff, read, preview, parse, importFile, importTable, importOpGeoPackage, createPlanDataset, defaultName };
  });
})();
