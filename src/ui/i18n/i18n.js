// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Internationalisation: `t('key', {n: 3})` looks up a string in the active language, falls back to
 * Swedish (the source language) and finally to the key itself so that gaps stay visible. Six languages
 * ship: Swedish, Danish, Norwegian (bokmål), Finnish, Icelandic and English. The choice is remembered in
 * localStorage; before a choice is made the browser's language picks one of the six (else Swedish).
 * Number and byte formatting follow the language's locale. `Dataspatium.t` is set here so that every
 * layer (data, engines, docgen) can produce user-facing messages in the active language.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/i18n', ['i18n/sv', 'i18n/da', 'i18n/nb', 'i18n/fi', 'i18n/is', 'i18n/en'], (sv, da, nb, fi, is, en) => {
    const LANGUAGES = [
      { code: 'sv', label: 'Svenska', locale: 'sv-SE' },
      { code: 'da', label: 'Dansk', locale: 'da-DK' },
      { code: 'nb', label: 'Norsk (bokmål)', locale: 'nb-NO' },
      { code: 'fi', label: 'Suomi', locale: 'fi-FI' },
      { code: 'is', label: 'Íslenska', locale: 'is-IS' },
      { code: 'en', label: 'English', locale: 'en-GB' },
    ];
    /** @type {Record<string, Record<string, string>>} */
    const languages = { sv, da, nb, fi, is, en };
    const KEY = 'dataspatium.lang';
    const DOCS_BASE = 'https://github.com/marwiss/Dataspatium';
    const numberFormats = new Map();

    /** True when a language has been chosen (by the user or a ?lang= link); false on the very first start. */
    function hasChoice() {
      try { const saved = localStorage.getItem(KEY); return !!(saved && languages[saved]); } catch (_e) { return true; }
    }

    /**
     * The saved language, else the first browser language among the six, else Swedish. A `?lang=xx`
     * query parameter (used by links and tools/screenshot.ps1) wins and is remembered like a choice.
     */
    function detect() {
      try {
        const q = new URLSearchParams(location.search).get('lang');
        if (q && languages[q]) { try { localStorage.setItem(KEY, q); } catch (_e) { /* ignore */ } return q; }
      } catch (_e) { /* no location */ }
      try { const saved = localStorage.getItem(KEY); if (saved && languages[saved]) return saved; } catch (_e) { /* storage may be unavailable */ }
      const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'sv']).map((l) => String(l).toLowerCase());
      for (const p of prefs) {
        const base = p.split('-')[0];
        const code = base === 'no' || base === 'nn' ? 'nb' : base;
        if (languages[code]) return code;
      }
      return 'sv';
    }
    let current = detect();

    /**
     * @param {string} key
     * @param {Record<string, any>} [params]
     */
    function t(key, params) {
      // A key with a `.one` sibling takes the singular when n is exactly one ("1 fil stämmer", not "1 filer stämmer").
      if (params && params.n !== undefined && String(params.n) === '1' && key + '.one' in sv) key += '.one';
      let text = (languages[current] || {})[key];
      if (text === undefined) text = sv[key];
      if (text === undefined) { D.log('i18n', 'missing key', key); text = key; }
      if (params) text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined ? m : String(params[name])));
      return text;
    }

    /** Look a key up in a specific language (used where several languages show at once, e.g. the first-start chooser). */
    function tIn(code, key, params) {
      let text = (languages[code] || {})[key];
      if (text === undefined) text = sv[key];
      if (text === undefined) text = key;
      if (params) text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined ? m : String(params[name])));
      return text;
    }

    function language() { return current; }
    function locale() { return (LANGUAGES.find((l) => l.code === current) || LANGUAGES[0]).locale; }
    function apply() { try { document.documentElement.lang = locale().split('-')[0]; } catch (_e) { /* no DOM */ } }

    /** Number formatting in the active language's locale; thousands grouping as that locale does it. */
    function formatNumber(value, options) {
      if (value === null || value === undefined || value === '') return '';
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return String(value);
      const key = current + '|' + JSON.stringify(options || {});
      let fmt = numberFormats.get(key);
      if (!fmt) {
        fmt = new Intl.NumberFormat(locale(), Object.assign({ maximumFractionDigits: 10 }, options || {}));
        numberFormats.set(key, fmt);
      }
      return fmt.format(n);
    }

    /** Human-readable byte size (kB, MB, GB with the locale's decimal separator). */
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return '';
      const units = ['B', 'kB', 'MB', 'GB'];
      let i = 0; let v = bytes;
      while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
      return formatNumber(v, { maximumFractionDigits: i === 0 ? 0 : 1 }) + ' ' + units[i];
    }

    /** ISO timestamp or Date to "2026-11-02 17:45" (the same in every language). */
    function formatDateTime(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return String(value || '');
      const pad = (x) => String(x).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    /** Switch language (persisted). Modules build their text when they render, so callers reload the page. */
    function setLanguage(code, options = {}) {
      if (!languages[code]) return false;
      current = code;
      numberFormats.clear();
      if (options.persist !== false) { try { localStorage.setItem(KEY, code); } catch (_e) { /* ignore */ } }
      apply();
      return true;
    }
    function has(key) { return Object.prototype.hasOwnProperty.call(languages[current] || {}, key) || Object.prototype.hasOwnProperty.call(sv, key); }
    /** Keys of a language's dictionary (for the completeness test). */
    function keys(code) { return Object.keys(languages[code] || {}); }
    /** The documentation on GitHub in the active language (Swedish lives in docs/, the others in docs/<code>/). */
    function docsUrl(code) {
      const lang = code || current;
      return lang === 'sv' ? DOCS_BASE + '#readme' : DOCS_BASE + '/blob/main/docs/' + lang + '/README.md';
    }

    apply();
    D.t = t;
    return { t, tIn, formatNumber, formatBytes, formatDateTime, setLanguage, language, locale, has, hasChoice, keys, detect, docsUrl, LANGUAGES, KEY };
  });
  // Instantiate right away so that Dataspatium.t exists before any other module's factory runs.
  D.require('ui/i18n');
})();
