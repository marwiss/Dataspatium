// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Internationalisation: `t('key', {n: 3})` looks up a string in the active language, falls back to
 * Swedish (the source language) and finally to the key itself so that gaps stay visible. Seven languages
 * ship: Swedish, Danish, Norwegian (bokmål and nynorsk), Finnish, Icelandic and English. The choice is
 * remembered in localStorage; before a choice is made the browser's language picks one of the seven (else
 * Swedish). Only the active language's dictionary is loaded at the start (src/boot.js); every dictionary has
 * every key, so Swedish is loaded only when a key is missing. Number and byte formatting follow the
 * language's locale. `Dataspatium.t` is set here so that every layer (data, engines, docgen) can produce
 * user-facing messages in the active language.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/i18n', [], () => {
    const LANGUAGES = [
      { code: 'sv', label: 'Svenska', locale: 'sv-SE' },
      { code: 'da', label: 'Dansk', locale: 'da-DK' },
      { code: 'nb', label: 'Norsk (bokmål)', locale: 'nb-NO' },
      { code: 'nn', label: 'Norsk (nynorsk)', locale: 'nn-NO' },
      { code: 'fi', label: 'Suomi', locale: 'fi-FI' },
      { code: 'is', label: 'Íslenska', locale: 'is-IS' },
      { code: 'en', label: 'English', locale: 'en-GB' },
    ];
    const isCode = (code) => LANGUAGES.some((l) => l.code === code);
    /**
     * Dictionaries that are loaded: the active language's from the start (src/boot.js), the others on demand through
     * loadLanguage().
     * @type {Record<string, Record<string, string>>}
     */
    const languages = {};
    for (const l of LANGUAGES) if (D.has('i18n/' + l.code)) languages[l.code] = D.require('i18n/' + l.code);
    /** The first-start chooser's words in every language (src/ui/i18n/languages.js), when the start loaded them. */
    const chooserWords = () => (D.has('i18n/languages') ? D.require('i18n/languages') : {});
    /** Swedish as the fallback: asked for once, on the first key the active dictionary lacks. */
    let fallbackAsked = false;
    function swedish() {
      if (!languages.sv && !fallbackAsked && D.assets) {
        fallbackAsked = true;
        console.info('[i18n] a key is missing in "' + current + '"; loading Swedish as the fallback');
        loadLanguage('sv').catch((err) => console.warn('[i18n] Swedish fallback could not be loaded', err));
      }
      return languages.sv || {};
    }
    const KEY = 'dataspatium.lang';
    const DOCS_BASE = 'https://github.com/marwiss/Dataspatium';
    const numberFormats = new Map();

    /** True when a language has been chosen (by the user or a ?lang= link); false on the very first start. */
    function hasChoice() {
      try { const saved = localStorage.getItem(KEY); return !!(saved && isCode(saved)); } catch (_e) { return true; }
    }

    /**
     * Load a language's dictionary that was not loaded at the start (the script is injected like any other).
     * @param {string} code
     * @returns {Promise<boolean>} true when the dictionary is available
     */
    async function loadLanguage(code) {
      if (!isCode(code)) return false;
      if (languages[code]) return true;
      if (!D.has('i18n/' + code)) await D.assets.loadScript((globalThis.DATASPATIUM_BASE || '') + 'src/ui/i18n/' + code + '.js');
      languages[code] = D.require('i18n/' + code);
      return true;
    }

    /**
     * The first of the browser's languages among the seven ('no' is bokmål), else Swedish: the same rule as src/boot.js,
     * which loads that dictionary at the first start.
     * @param {ReadonlyArray<string>} prefs
     */
    function browserLanguage(prefs) {
      if (D.boot && D.boot.browserLanguage) return D.boot.browserLanguage(prefs);
      for (const p of prefs) {
        const base = String(p).toLowerCase().split('-')[0];
        const code = base === 'no' ? 'nb' : base;
        if (isCode(code)) return code;
      }
      return 'sv';
    }

    /**
     * The saved language, else the first browser language among the seven, else Swedish. A `?lang=xx`
     * query parameter (used by links and tools/screenshot.ps1) wins and is remembered like a choice.
     */
    function detect() {
      try {
        const q = new URLSearchParams(location.search).get('lang');
        if (q && isCode(q)) { try { localStorage.setItem(KEY, q); } catch (_e) { /* ignore */ } return q; }
      } catch (_e) { /* no location */ }
      try { const saved = localStorage.getItem(KEY); if (saved && isCode(saved)) return saved; } catch (_e) { /* storage may be unavailable */ }
      return browserLanguage(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'sv']);
    }
    let current = detect();

    /**
     * @param {string} key
     * @param {Record<string, any>} [params]
     */
    function t(key, params) {
      const own = languages[current] || swedish();
      // A key with a `.one` sibling takes the singular when n is exactly one ("1 sida", not "1 sidor").
      if (params && params.n !== undefined && String(params.n) === '1' && key + '.one' in own) key += '.one';
      let text = own[key];
      if (text === undefined) { D.log('i18n', 'missing key', current, key); text = swedish()[key]; }
      if (text === undefined) text = key;
      if (params) text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined ? m : String(params[name])));
      return text;
    }

    /**
     * Look a key up in a specific language (used where several languages show at once, e.g. the first-start chooser):
     * its dictionary when loaded, else the chooser's words, else Swedish when loaded, else the key.
     */
    function tIn(code, key, params) {
      let text = (languages[code] || {})[key];
      if (text === undefined) text = (chooserWords()[code] || {})[key];
      if (text === undefined) text = (languages.sv || {})[key];
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
      if (!isCode(code)) return false;
      current = code;
      numberFormats.clear();
      if (options.persist !== false) { try { localStorage.setItem(KEY, code); } catch (_e) { /* ignore */ } }
      apply();
      return true;
    }
    /** True when the active language (or Swedish, when it is loaded) has the key; never loads anything. */
    function has(key) { return Object.prototype.hasOwnProperty.call(languages[current] || {}, key) || Object.prototype.hasOwnProperty.call(languages.sv || {}, key); }
    /** Keys of a language's dictionary (for the completeness test). */
    function keys(code) { return Object.keys(languages[code] || {}); }
    /** The languages whose dictionaries are loaded, in LANGUAGES order (the start loads only the active one). */
    function loaded() { return LANGUAGES.map((l) => l.code).filter((code) => !!languages[code]); }
    /** The documentation on GitHub in the active language (Swedish lives in docs/, the others in docs/<code>/). */
    function docsUrl(code) {
      const lang = code || current;
      return lang === 'sv' ? DOCS_BASE + '#readme' : DOCS_BASE + '/blob/main/docs/' + lang + '/README.md';
    }

    apply();
    D.t = t;
    return { t, tIn, formatNumber, formatBytes, formatDateTime, setLanguage, loadLanguage, language, locale, has, hasChoice, keys, loaded, detect, browserLanguage, docsUrl, LANGUAGES, KEY };
  });
  // Instantiate right away so that Dataspatium.t exists before any other module's factory runs.
  D.require('ui/i18n');
})();
