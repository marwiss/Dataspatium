// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Spreadsheet importer built on SheetJS Community Edition: Excel (xlsx, xlsm, xls, xlsb and the 2003 XML
 * format), OpenDocument (ods, fods), dBASE (dbf), SYLK, DIF, Lotus 1-2-3 (wk1, wk3, wk4, wks) and Quattro Pro.
 * Dates are returned as JS Date objects (cellDates) and typed by data/types.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/excel', ['io/importers/csv'], (csv) => {
    const EXT = /\.(xlsx|xlsm|xls|xlsb|ods|fods|dbf|slk|sylk|dif|wk1|wk3|wk4|wks|wq1|wq2|wb1|wb2|wb3|qpw)$/i;
    /** @type {WeakMap<File, Promise<any>>} parsed workbooks per file (reused between preview and parse) */
    const cache = new WeakMap();

    async function xlsx() {
      await D.assets.loadVendorScript('vendor/sheetjs/xlsx.full.min.js');
      return /** @type {any} */ (globalThis).XLSX;
    }
    /** @param {File} file */
    function detect(file) { return EXT.test(file.name); }

    function workbook(file) {
      let p = cache.get(file);
      if (!p) {
        p = (async () => {
          const XLSX = await xlsx();
          const buffer = await file.arrayBuffer();
          return XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
        })();
        cache.set(file, p);
      }
      return p;
    }

    async function sheetRows(wb, name, limit) {
      const XLSX = await xlsx();
      const ws = wb.Sheets[name];
      if (!ws) return [];
      const opts = { header: 1, raw: true, defval: null, blankrows: false };
      const rows = XLSX.utils.sheet_to_json(ws, opts);
      return limit ? rows.slice(0, limit) : rows;
    }

    function split(rows, header) {
      const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const columns = header && rows.length ? rows[0].map((c, i) => (c === null || c === undefined || String(c).trim() === '' ? `kolumn_${i + 1}` : String(c))) : Array.from({ length: width }, (_, i) => `kolumn_${i + 1}`);
      const body = (header ? rows.slice(1) : rows).map((r) => (r.length === columns.length ? r : (r.length > columns.length ? r.slice(0, columns.length) : r.concat(new Array(columns.length - r.length).fill(null)))));
      return { columns, dataRows: body };
    }

    /** @param {File} file @param {{sheet?: string, header?: boolean, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const wb = await workbook(file);
      const sheets = wb.SheetNames;
      const sheet = options.sheet && sheets.includes(options.sheet) ? options.sheet : sheets[0];
      const rows = await sheetRows(wb, sheet, (options.previewRows || 100) + 1);
      const header = options.header === undefined ? csv.guessHeader(rows) : !!options.header;
      const { columns, dataRows } = split(rows, header);
      return { kind: 'excel', sheets, sheet, header, columns, dataRows: dataRows.slice(0, options.previewRows || 100) };
    }

    /** @param {File} file @param {{sheet?: string, header?: boolean}} options */
    async function parse(file, options) {
      const wb = await workbook(file);
      const sheet = options.sheet && wb.SheetNames.includes(options.sheet) ? options.sheet : wb.SheetNames[0];
      const rows = await sheetRows(wb, sheet);
      const header = options.header === undefined ? csv.guessHeader(rows) : !!options.header;
      const { columns, dataRows } = split(rows, header);
      return { columns, rows: dataRows, meta: { format: 'excel', sheet, header } };
    }

    return { id: 'excel', detect, preview, parse };
  });
})();
