// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * SQLite importer. A Dataspatium file (tables data, _columns, _meta) is restored with its metadata;
 * any other SQLite database offers its tables and imports the chosen one with types from the schema.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/sqlite', ['engines/sqlite'], (sqlite) => {
    const EXT = /\.(sqlite|sqlite3|db|s3db)$/i;
    function detect(file) { return EXT.test(file.name) || /sqlite/.test(file.type || ''); }

    async function openFile(file) {
      const bytes = await file.arrayBuffer();
      const head = new TextDecoder('latin1').decode(new Uint8Array(bytes.slice(0, 15)));
      if (head !== 'SQLite format 3') throw new Error('Filen är inte en SQLite-databas.');
      const engine = new sqlite.SqliteEngine();
      await engine.start();
      await engine.open(bytes);
      return { engine, bytes };
    }
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    function sqlType(decl) {
      const d = String(decl || '').toUpperCase();
      if (/INT/.test(d)) return 'integer';
      if (/REAL|FLOA|DOUB|NUM|DEC/.test(d)) return 'number';
      if (/BOOL/.test(d)) return 'boolean';
      if (/DATE|TIME/.test(d)) return 'text';
      return 'text';
    }
    const cell = (v) => (v instanceof Uint8Array || ArrayBuffer.isView(v) ? `[blob ${v.byteLength} B]` : v);

    async function describe(engine) {
      const res = await engine.exec("select name from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name");
      const tables = (res[0] ? res[0].values : []).map((r) => String(r[0]));
      const dataspatium = ['data', '_columns', '_meta'].every((n) => tables.includes(n));
      return { tables: tables.filter((n) => !n.startsWith('_') || !dataspatium), dataspatium };
    }
    async function tableColumns(engine, table) {
      const info = await engine.exec(`pragma table_info(${q(table)})`);
      return (info[0] ? info[0].values : []).map((r) => ({ name: String(r[1]), type: sqlType(r[2]) }));
    }

    /** @param {File} file @param {{table?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const { engine } = await openFile(file);
      try {
        const { tables, dataspatium } = await describe(engine);
        let name = '';
        if (dataspatium) { const m = await engine.exec("select value from _meta where key = 'name'"); name = m[0] && m[0].values[0] ? String(m[0].values[0][0]) : ''; }
        const table = dataspatium ? 'data' : (options.table && tables.includes(options.table) ? options.table : tables[0]);
        if (!table) throw new Error('Databasen innehåller inga tabeller.');
        const cols = dataspatium ? (await engine.exec('select name, type from _columns order by position'))[0].values.map((r) => ({ name: String(r[0]), type: String(r[1]) })) : await tableColumns(engine, table);
        const count = await engine.exec(`select count(*) from ${q(table)}`);
        const res = await engine.exec(`select * from ${q(table)} limit ${Math.max(1, options.previewRows || 100)}`);
        const rows = (res[0] ? res[0].values : []).map((r) => r.map(cell));
        return { kind: 'sqlite', columns: cols.map((c) => c.name), dataRows: rows, totalRows: Number(count[0].values[0][0]), header: true, tables, table, dataspatium, datasetName: name, declaredTypes: cols.map((c) => c.type) };
      } finally { engine.terminate(); }
    }
    /** @param {File} file @param {{table?: string}} options */
    async function parse(file, options = {}) {
      const { engine } = await openFile(file);
      try {
        const { tables, dataspatium } = await describe(engine);
        const table = dataspatium ? 'data' : (options.table && tables.includes(options.table) ? options.table : tables[0]);
        if (!table) throw new Error('Databasen innehåller inga tabeller.');
        const cols = await tableColumns(engine, table);
        const res = await engine.exec(`select * from ${q(table)}`);
        const rows = (res[0] ? res[0].values : []).map((r) => r.map(cell));
        return { columns: cols.map((c) => c.name), rows, meta: { format: 'sqlite', table, declaredTypes: cols.map((c) => c.type) } };
      } finally { engine.terminate(); }
    }
    return { id: 'sqlite', detect, preview, parse, openFile, describe };
  });
})();
