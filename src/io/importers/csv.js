// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Delimited text importer (CSV, TSV, TXT) built on PapaParse. Handles Swedish conventions: semicolon
 * delimiters, Windows-1252 encoding and decimal commas (the latter is resolved in data/types).
 * `preview()` reads the first 2 MB; `parse()` reads the whole file.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/csv', ['data/encoding'], (encoding) => {
    const EXT = /\.(csv|tsv|txt|tab|dat)$/i;
    const GUESS = [';', ',', '\t', '|'];
    const DELIMITERS = [
      { value: 'auto', key: 'import.delimiter.auto' },
      { value: ';', key: 'import.delimiter.semicolon' },
      { value: ',', key: 'import.delimiter.comma' },
      { value: '\t', key: 'import.delimiter.tab' },
      { value: '|', key: 'import.delimiter.pipe' },
    ];

    async function papa() {
      await D.assets.loadVendorScript('vendor/papaparse/papaparse.min.js');
      return /** @type {any} */ (globalThis).Papa;
    }

    /** @param {File} file */
    function detect(file) { return EXT.test(file.name) || /^text\/(csv|plain|tab-separated-values)/.test(file.type || ''); }

    /** Header heuristic: the first row is a header when it looks less numeric than the second. */
    function guessHeader(rows) {
      if (rows.length < 2) return true;
      const numeric = (v) => { const s = String(v === null || v === undefined ? '' : v).trim(); return s !== '' && /^[+-]?[\d.,  ]+$/.test(s) && /\d/.test(s); };
      const first = rows[0].filter(numeric).length;
      const second = rows[1].filter(numeric).length;
      return first === 0 || first < second;
    }

    function normalise(rows, width) {
      return rows.map((r) => (r.length === width ? r : (r.length > width ? r.slice(0, width) : r.concat(new Array(width - r.length).fill('')))));
    }

    function split(parsed, header) {
      const rows = parsed.data.filter((r) => !(r.length === 1 && String(r[0]).trim() === ''));
      const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const columns = header && rows.length ? rows[0].map((c) => String(c === null || c === undefined ? '' : c)) : Array.from({ length: width }, (_, i) => `kolumn_${i + 1}`);
      const dataRows = normalise(header ? rows.slice(1) : rows, columns.length);
      return { columns, dataRows };
    }

    /**
     * @param {File} file
     * @param {{encoding?: string, delimiter?: string, header?: boolean, previewRows?: number}} [options]
     */
    async function preview(file, options = {}) {
      const Papa = await papa();
      const read = await encoding.readText(file, { encoding: options.encoding, maxBytes: 2 * 1024 * 1024 });
      const parsed = Papa.parse(read.text, {
        delimiter: options.delimiter && options.delimiter !== 'auto' ? options.delimiter : '',
        delimitersToGuess: GUESS, skipEmptyLines: 'greedy', preview: (options.previewRows || 100) + 1,
      });
      const header = options.header === undefined ? guessHeader(parsed.data) : !!options.header;
      const { columns, dataRows } = split(parsed, header);
      return {
        kind: 'csv', columns, dataRows: dataRows.slice(0, options.previewRows || 100), header,
        encoding: read.encoding, encodingDetected: read.detected, delimiter: parsed.meta.delimiter, truncated: read.truncated,
        errors: parsed.errors.slice(0, 5),
      };
    }

    /**
     * @param {File} file
     * @param {{encoding?: string, delimiter?: string, header?: boolean}} options
     * @returns {Promise<{columns: string[], rows: any[][], meta: any}>}
     */
    async function parse(file, options) {
      const Papa = await papa();
      const read = await encoding.readText(file, { encoding: options.encoding });
      const parsed = Papa.parse(read.text, {
        delimiter: options.delimiter && options.delimiter !== 'auto' ? options.delimiter : '',
        delimitersToGuess: GUESS, skipEmptyLines: 'greedy',
      });
      const header = options.header === undefined ? guessHeader(parsed.data) : !!options.header;
      const { columns, dataRows } = split(parsed, header);
      return { columns, rows: dataRows, meta: { format: 'csv', encoding: read.encoding, delimiter: parsed.meta.delimiter, header } };
    }

    /** Parse pasted text (tab- or delimiter-separated). */
    async function parseText(text, options = {}) {
      const Papa = await papa();
      const parsed = Papa.parse(text.replace(/^﻿/, ''), { delimiter: options.delimiter && options.delimiter !== 'auto' ? options.delimiter : '', delimitersToGuess: ['\t', ';', ',', '|'], skipEmptyLines: 'greedy' });
      const header = options.header === undefined ? guessHeader(parsed.data) : !!options.header;
      const { columns, dataRows } = split(parsed, header);
      return { columns, rows: dataRows, meta: { format: 'text', delimiter: parsed.meta.delimiter, header } };
    }

    return { id: 'csv', detect, preview, parse, parseText, DELIMITERS, guessHeader };
  });
})();
