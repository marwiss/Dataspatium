// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Fixed-width text importer (columns at fixed character positions, as in older register extracts and
 * mainframe exports). Column breaks are detected from runs of spaces shared by every line and can be given
 * by hand as a list of start positions (0-based). Chosen from the format list in the import wizard; files
 * named .fwf or .prn are picked up automatically.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/fixed-width', ['data/encoding', 'io/importers/csv'], (encoding, csv) => {
    const EXT = /\.(fwf|prn)$/i;
    function detect(file) { return EXT.test(file.name); }

    /** Column start positions: a new column begins after every run of spaces present in all sample lines. */
    function detectBreaks(lines) {
      const sample = lines.filter((l) => l.trim()).slice(0, 200);
      if (!sample.length) return [0];
      const width = Math.max(...sample.map((l) => l.length));
      const spaceAll = new Array(width).fill(true);
      for (const l of sample) for (let i = 0; i < width; i++) if (i < l.length && l[i] !== ' ') spaceAll[i] = false;
      const breaks = [0];
      let inGap = false;
      for (let i = 0; i < width; i++) {
        if (spaceAll[i]) inGap = true;
        else if (inGap) { breaks.push(i); inGap = false; }
      }
      return breaks;
    }
    function parseBreaks(text, lines) {
      if (text === undefined || text === null || String(text).trim() === '') return detectBreaks(lines);
      const nums = String(text).split(/[,;\s]+/).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 0).map((n) => Math.floor(n));
      const list = Array.from(new Set(nums)).sort((a, b) => a - b);
      if (!list.length) return detectBreaks(lines);
      if (list[0] !== 0) list.unshift(0);
      return list;
    }
    function sliceRows(lines, breaks) {
      return lines.map((l) => breaks.map((b, i) => l.slice(b, breaks[i + 1] === undefined ? undefined : breaks[i + 1]).trim()));
    }
    function table(text, options = {}) {
      const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
      const breaks = parseBreaks(options.breaks, lines);
      const rows = sliceRows(lines, breaks);
      const header = options.header === undefined ? csv.guessHeader(rows) : !!options.header;
      const columns = header && rows.length ? rows[0].map((c, i) => c || `kolumn_${i + 1}`) : breaks.map((_, i) => `kolumn_${i + 1}`);
      return { columns, rows: header ? rows.slice(1) : rows, breaks, header };
    }

    /** @param {File} file @param {{encoding?: string, breaks?: string, header?: boolean, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const read = await encoding.readText(file, { encoding: options.encoding, maxBytes: 2 * 1024 * 1024 });
      const t = table(read.text, options);
      return { kind: 'fixed', columns: t.columns, dataRows: t.rows.slice(0, options.previewRows || 100), totalRows: t.rows.length, header: t.header, encoding: read.encoding, encodingDetected: read.detected, truncated: read.truncated, breaks: t.breaks, breaksText: t.breaks.join(', ') };
    }
    /** @param {File} file @param {{encoding?: string, breaks?: string, header?: boolean}} options */
    async function parse(file, options = {}) {
      const read = await encoding.readText(file, { encoding: options.encoding });
      const t = table(read.text, options);
      return { columns: t.columns, rows: t.rows, meta: { format: 'fixed', encoding: read.encoding, breaks: t.breaks, header: t.header } };
    }

    return { id: 'fixed', detect, preview, parse, detectBreaks, table };
  });
})();
