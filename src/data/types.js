// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Column type inference and value parsing with Swedish conventions.
 *
 * Types: text, integer, number, date (YYYY-MM-DD), datetime (YYYY-MM-DD HH:MM:SS), boolean (0/1).
 * Rules of thumb: a column is numeric only if every non-empty value parses; values with leading zeros
 * (postal codes, municipality codes, personal identity numbers) stay text; decimal comma wins over
 * decimal point when both are plausible unless the user chooses otherwise.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/types', [], () => {
    const TYPES = ['text', 'integer', 'number', 'date', 'datetime', 'boolean'];
    const RE = {
      int: /^[+-]?\d{1,15}$/,
      numComma: /^[+-]?(\d{1,3}([   .]\d{3})+|\d+)(,\d+)?$/,
      numPoint: /^[+-]?(\d{1,3}([   ,]\d{3})+|\d+)(\.\d+)?$/,
      sci: /^[+-]?\d+([.,]\d+)?[eE][+-]?\d+$/,
      isoDate: /^\d{4}-\d{2}-\d{2}$/,
      isoDateTime: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
      dmy: /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/,
      leadingZero: /^[+-]?0\d/,
    };
    /** @type {Record<string, number>} */
    const BOOL = { true: 1, false: 0, ja: 1, nej: 0, yes: 1, no: 0, sant: 1, falskt: 0, j: 1, n: 0 };

    function isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }

    /**
     * Infer a type from sample values (strings from CSV, or typed values from Excel/JSON).
     * @param {any[]} values
     * @param {{decimal?: 'auto'|'comma'|'point'}} [options]
     * @returns {{type: string, decimal?: string, reason?: string}}
     */
    function detectType(values, options = {}) {
      let n = 0; let ints = 0; let nums = 0; let dates = 0; let datetimes = 0; let bools = 0; let leadingZero = 0;
      let commaDecimals = 0; let pointDecimals = 0;
      for (const raw of values) {
        if (isBlank(raw)) continue;
        n++;
        if (typeof raw === 'number') { if (Number.isInteger(raw)) ints++; else { nums++; pointDecimals++; } continue; }
        if (typeof raw === 'boolean') { bools++; continue; }
        if (raw instanceof Date) { if (raw.getHours() || raw.getMinutes() || raw.getSeconds()) datetimes++; else dates++; continue; }
        const s = String(raw).trim();
        if (RE.int.test(s)) { if (RE.leadingZero.test(s) && s.replace(/^[+-]/, '').length > 1) leadingZero++; ints++; continue; }
        if (RE.sci.test(s)) { nums++; pointDecimals++; continue; }
        const comma = RE.numComma.test(s); const point = RE.numPoint.test(s);
        if (comma || point) {
          nums++;
          if (comma && /,\d+$/.test(s)) commaDecimals++;
          if (point && /\.\d+$/.test(s)) pointDecimals++;
          continue;
        }
        if (RE.isoDate.test(s) || RE.dmy.test(s)) { dates++; continue; }
        if (RE.isoDateTime.test(s)) { datetimes++; continue; }
        if (Object.prototype.hasOwnProperty.call(BOOL, s.toLowerCase())) { bools++; continue; }
        return { type: 'text' };
      }
      if (n === 0) return { type: 'text' };
      if (leadingZero > 0 && ints === n) return { type: 'text', reason: 'leading-zero' };
      if (ints === n) return { type: 'integer' };
      if (ints + nums === n) {
        const decimal = options.decimal && options.decimal !== 'auto' ? options.decimal : (commaDecimals >= pointDecimals ? 'comma' : 'point');
        return { type: 'number', decimal };
      }
      if (dates === n) return { type: 'date' };
      if (dates + datetimes === n) return { type: 'datetime' };
      if (bools === n) return { type: 'boolean' };
      return { type: 'text' };
    }

    /** @param {any} raw @param {'comma'|'point'} decimal @returns {number|null} */
    function parseNumber(raw, decimal = 'comma') {
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
      let s = String(raw).trim();
      if (!s) return null;
      if (RE.sci.test(s)) s = s.replace(',', '.');
      else if (decimal === 'comma') s = s.replace(/[   .]/g, '').replace(',', '.');
      else s = s.replace(/[   ,]/g, '');
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }

    const pad = (x) => String(x).padStart(2, '0');
    function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function isoDateTime(d) { return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

    /** @returns {string|null} ISO date */
    function parseDate(raw) {
      if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : isoDate(raw);
      const s = String(raw).trim();
      if (RE.isoDate.test(s)) return s;
      const m = RE.dmy.exec(s);
      if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
      if (RE.isoDateTime.test(s)) return s.slice(0, 10);
      return null;
    }
    /** @returns {string|null} ISO date time */
    function parseDateTime(raw) {
      if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : isoDateTime(raw);
      const s = String(raw).trim();
      if (RE.isoDateTime.test(s)) { const core = s.replace('T', ' ').replace(/(Z|[+-]\d{2}:?\d{2})$/, ''); return core.length === 16 ? core + ':00' : core.slice(0, 19); }
      const d = parseDate(s);
      return d ? d + ' 00:00:00' : null;
    }

    /**
     * Convert a raw value to the storage representation for a type (null when blank or unparsable).
     * @param {any} raw @param {string} type @param {{decimal?: string}} [options]
     */
    function parseValue(raw, type, options = {}) {
      if (isBlank(raw)) return null;
      const decimal = /** @type {'comma'|'point'} */ (options.decimal === 'point' ? 'point' : 'comma');
      switch (type) {
        case 'integer': { const n = parseNumber(raw, decimal); return n === null ? null : Math.trunc(n); }
        case 'number': return parseNumber(raw, decimal);
        case 'date': return parseDate(raw);
        case 'datetime': return parseDateTime(raw);
        case 'boolean': {
          if (typeof raw === 'boolean') return raw ? 1 : 0;
          if (typeof raw === 'number') return raw ? 1 : 0;
          const k = String(raw).trim().toLowerCase();
          return Object.prototype.hasOwnProperty.call(BOOL, k) ? BOOL[k] : null;
        }
        default:
          if (raw instanceof Date) return isoDateTime(raw);
          return typeof raw === 'string' ? raw : String(raw);
      }
    }

    function sqlType(type) {
      if (type === 'integer' || type === 'boolean') return 'INTEGER';
      if (type === 'number') return 'REAL';
      return 'TEXT';
    }

    /**
     * Infer a type for every column from a sample of rows.
     * @param {string[]} names
     * @param {any[][]} rows
     * @param {{decimal?: string, sample?: number}} [options]
     * @returns {Array<{name: string, type: string, decimal?: string, reason?: string}>}
     */
    function inferColumns(names, rows, options = {}) {
      const sampleSize = options.sample || 2000;
      const step = Math.max(1, Math.floor(rows.length / sampleSize));
      return names.map((name, c) => {
        const values = [];
        for (let r = 0; r < rows.length && values.length < sampleSize; r += step) values.push(rows[r][c]);
        const det = detectType(values, { decimal: /** @type {any} */ (options.decimal || 'auto') });
        return Object.assign({ name }, det);
      });
    }

    /** Make column names unique, non-empty and free of control characters. */
    function cleanColumnNames(names) {
      const seen = new Map();
      return names.map((raw, i) => {
        let name = String(raw === null || raw === undefined ? '' : raw).replace(/[\u0000-\u001f]/g, ' ').trim();
        if (!name) name = `kolumn_${i + 1}`;
        const key = name.toLowerCase();
        const count = seen.get(key) || 0;
        seen.set(key, count + 1);
        return count ? `${name}_${count + 1}` : name;
      });
    }

    return { TYPES, detectType, parseValue, parseNumber, parseDate, parseDateTime, sqlType, inferColumns, cleanColumnNames, isBlank };
  });
})();
