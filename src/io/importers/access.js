// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Microsoft Access importer (.mdb, .accdb) with mdb-reader, loaded as a vendored ES module graph
 * (Dataspatium.assets.importGraph('mdb-reader')); nothing leaves the browser. The file's tables are offered and
 * the chosen one is imported with the column types Access declares (text, numbers, dates, yes/no); binary
 * fields become base64 text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/access', [], () => {
    const EXT = /\.(mdb|accdb)$/i;
    /** mdb-reader column types -> dataset types. */
    const TYPES = { boolean: 'boolean', byte: 'integer', integer: 'integer', long: 'integer', bigint: 'integer', currency: 'number', float: 'number', double: 'number', numeric: 'number', datetime: 'datetime', datetimextended: 'datetime', text: 'text', memo: 'text', repid: 'text', binary: 'text', ole: 'text', complex: 'text' };
    let libPromise = null;

    function detect(file) { return EXT.test(file.name) || /msaccess|x-msaccess/i.test(file.type || ''); }

    /** The reader class and the Buffer polyfill from the same graph (mdb-reader reads Node Buffers). */
    function lib() {
      if (!libPromise) {
        libPromise = Promise.all([D.assets.importGraph('mdb-reader'), D.assets.importGraph('mdb-reader', '/node/buffer.mjs')])
          .then(([mod, buf]) => ({ MDBReader: mod.default || mod.MDBReader, Buffer: buf.Buffer || (buf.default && buf.default.Buffer) || null }))
          .catch((err) => { libPromise = null; throw err; });
      }
      return libPromise;
    }
    async function open(file) {
      const { MDBReader, Buffer } = await lib();
      const bytes = new Uint8Array(await file.arrayBuffer());
      try { return new MDBReader(Buffer ? Buffer.from(bytes) : bytes); } catch (err) { throw new Error(D.t('import.err.access', { message: (err && err.message) || String(err) })); }
    }
    function toBase64(u8) {
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
      return btoa(s);
    }
    function convert(value, type) {
      if (value === null || value === undefined) return null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 19);
      if (typeof value === 'bigint') return Number(value);
      if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
      if (value && typeof value === 'object' && typeof value.length === 'number' && (type === 'binary' || type === 'ole')) return toBase64(value instanceof Uint8Array ? value : Uint8Array.from(value));
      if (value && typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    function tableNames(reader) {
      try { return reader.getTableNames({ normalTables: true, systemTables: false, linkedTables: true }); } catch (_e) { return reader.getTableNames(); }
    }
    function readTable(reader, name) {
      const table = reader.getTable(name);
      const cols = table.getColumns();
      const kinds = cols.map((c) => String(c.type || '').toLowerCase());
      const columns = cols.map((c) => c.name);
      const declaredTypes = kinds.map((k) => TYPES[k] || 'text');
      const rows = table.getData().map((rec) => cols.map((c, i) => convert(rec[c.name], kinds[i])));
      return { columns, rows, declaredTypes };
    }
    /** @param {File} file @param {{table?: string}} [options] */
    async function parse(file, options = {}) {
      const reader = await open(file);
      const tables = tableNames(reader);
      if (!tables.length) throw new Error(D.t('import.err.notables'));
      const table = options.table && tables.includes(options.table) ? options.table : tables[0];
      const t = readTable(reader, table);
      return { columns: t.columns, rows: t.rows, meta: { format: 'access', table, tables, declaredTypes: t.declaredTypes } };
    }
    /** @param {File} file @param {{table?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const table = await parse(file, options);
      return { kind: 'access', columns: table.columns, dataRows: table.rows.slice(0, options.previewRows || 100), totalRows: table.rows.length, header: true, tables: table.meta.tables, table: table.meta.table, declaredTypes: table.meta.declaredTypes };
    }
    return { id: 'access', detect, preview, parse, TYPES };
  });
})();
