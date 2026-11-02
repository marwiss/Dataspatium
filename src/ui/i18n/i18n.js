// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Minimal i18n: `t('key', {n: 3})` looks up a string in the active language (Swedish by default),
 * substitutes `{n}` placeholders and falls back to the key itself so missing strings are visible.
 * Also exposes Swedish number and date formatting used throughout the UI.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/i18n', ['i18n/sv'], (sv) => {
    /** @type {Record<string, Record<string, string>>} */
    const languages = { sv };
    let current = 'sv';
    const numberFormats = new Map();

    /**
     * @param {string} key
     * @param {Record<string, any>} [params]
     */
    function t(key, params) {
      const table = languages[current] || {};
      let text = table[key];
      if (text === undefined) { D.log('i18n', 'missing key', key); text = key; }
      if (params) text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined ? m : String(params[name])));
      return text;
    }

    /** Swedish number formatting with optional decimals; thousands separated by narrow spaces. */
    function formatNumber(value, options) {
      if (value === null || value === undefined || value === '') return '';
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return String(value);
      const key = JSON.stringify(options || {});
      let fmt = numberFormats.get(key);
      if (!fmt) {
        fmt = new Intl.NumberFormat('sv-SE', Object.assign({ maximumFractionDigits: 10 }, options || {}));
        numberFormats.set(key, fmt);
      }
      return fmt.format(n);
    }

    /** Human-readable byte size (kB, MB, GB with Swedish decimal comma). */
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return '';
      const units = ['B', 'kB', 'MB', 'GB'];
      let i = 0; let v = bytes;
      while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
      return formatNumber(v, { maximumFractionDigits: i === 0 ? 0 : 1 }) + ' ' + units[i];
    }

    /** ISO timestamp or Date to "2026-11-02 17:45". */
    function formatDateTime(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return String(value || '');
      const pad = (x) => String(x).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function setLanguage(code) { if (languages[code]) current = code; }
    function language() { return current; }
    function has(key) { return Object.prototype.hasOwnProperty.call(languages[current] || {}, key); }

    return { t, formatNumber, formatBytes, formatDateTime, setLanguage, language, has };
  });
})();
