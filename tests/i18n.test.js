// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for internationalisation: the dictionaries, the fallback to English and Swedish, persistence and locale formatting. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const vizLocale = D.require('viz/locale');
  const CODES = ['sv', 'da', 'nb', 'nn', 'fi', 'is', 'en'];
  /** The languages that have every key; the others show English (then Swedish) where they lack one (F49 a). */
  const COMPLETE = ['sv', 'en'];
  const placeholders = (s) => (String(s).match(/\{[a-zA-Z_]+\}/g) || []).sort().join(' ');
  const spaces = (s) => String(s).replace(/[  ]/g, ' ');

  test('i18n: Swedish and English with identical key sets, the others without stale keys; no empty texts, matching placeholders', async (assert) => {
    assert.deepEqual(i18n.LANGUAGES.map((l) => l.code), CODES);
    // Only the active language loads at the start (tests/i18n-start.test.js); the others are fetched on demand.
    for (const code of CODES) assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
    const svKeys = i18n.keys('sv');
    assert.ok(svKeys.length > 1200, 'Swedish dictionary has ' + svKeys.length + ' keys');
    const svSet = new Set(svKeys);
    for (const code of CODES) {
      const keys = i18n.keys(code);
      const own = new Set(keys);
      // New texts are written in Swedish and English only (F49 a): those two have every key, the others may lack keys
      // (English shows there) but never have a key Swedish lacks.
      if (COMPLETE.includes(code)) assert.deepEqual(svKeys.filter((k) => !own.has(k)), [], code + ': missing keys');
      assert.deepEqual(keys.filter((k) => !svSet.has(k)), [], code + ': stale keys (not in Swedish)');
      const empty = keys.filter((k) => !String(i18n.tIn(code, k)).trim());
      assert.deepEqual(empty, [], code + ': empty texts');
      const bad = keys.filter((k) => placeholders(i18n.tIn('sv', k)) !== placeholders(i18n.tIn(code, k)));
      assert.deepEqual(bad, [], code + ': placeholder mismatch');
    }
  });

  test('i18n: a key a translation lacks shows English, then Swedish; the singular comes from the same dictionary', async (assert) => {
    for (const code of ['sv', 'en', 'da']) assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
    assert.deepEqual(i18n.chain('da'), ['da', 'en', 'sv']);
    assert.deepEqual(i18n.chain('sv'), ['sv', 'en']);
    assert.deepEqual(i18n.chain('en'), ['en', 'sv']);
    // Test keys put into the loaded dictionaries (the registry hands out the same objects) and taken out again.
    const dicts = { sv: D.require('i18n/sv'), en: D.require('i18n/en'), da: D.require('i18n/da') };
    const added = {
      sv: { 'test.fallback.both': 'Svenska {x}', 'test.fallback.sv': 'Bara svenska', 'test.fallback.pages': '{n} sidor', 'test.fallback.pages.one': '{n} sida', 'test.fallback.own': '{n} filer', 'test.fallback.own.one': '{n} fil' },
      en: { 'test.fallback.both': 'English {x}', 'test.fallback.pages': '{n} pages', 'test.fallback.pages.one': '{n} page', 'test.fallback.own': '{n} files', 'test.fallback.own.one': '{n} file' },
      da: { 'test.fallback.own': '{n} filer' },
    };
    const before = i18n.language();
    try {
      for (const [code, entries] of Object.entries(added)) Object.assign(dicts[code], entries);
      assert.ok(i18n.setLanguage('da', { persist: false }));
      assert.equal(i18n.t('test.fallback.both', { x: 1 }), 'English 1', 'a key only in Swedish and English shows English in Danish');
      assert.equal(i18n.t('test.fallback.sv'), 'Bara svenska', 'a key only in Swedish shows Swedish');
      assert.equal(i18n.t('test.fallback.none'), 'test.fallback.none', 'a key nowhere stays visible');
      assert.equal(i18n.t('test.fallback.pages', { n: 1 }), '1 page', 'the English singular with the English text');
      assert.equal(i18n.t('test.fallback.pages', { n: 3 }), '3 pages');
      assert.equal(i18n.t('test.fallback.own', { n: 1 }), '1 filer', 'Danish without its own singular keeps its own text, not English');
      assert.equal(i18n.t('common.save'), 'Gem', 'a key Danish has stays Danish');
      assert.equal(i18n.has('test.fallback.both'), true);
      assert.equal(i18n.tIn('da', 'test.fallback.both', { x: 2 }), 'English 2', 'tIn falls back the same way');
      assert.equal(i18n.tIn('da', 'test.fallback.sv'), 'Bara svenska');
      assert.equal(i18n.tIn('da', 'test.fallback.pages', { n: 1 }), '1 page', 'tIn takes the singular too');
      assert.ok(i18n.setLanguage('en', { persist: false }));
      assert.equal(i18n.t('test.fallback.sv'), 'Bara svenska', 'English falls back to Swedish');
      assert.ok(i18n.setLanguage('sv', { persist: false }));
      assert.equal(i18n.t('test.fallback.both', { x: 3 }), 'Svenska 3');
    } finally {
      for (const [code, entries] of Object.entries(added)) for (const key of Object.keys(entries)) delete dicts[code][key];
      i18n.setLanguage(before, { persist: false });
    }
  });

  test('i18n: t() translates, substitutes parameters, falls back to Swedish and keeps unknown keys visible', (assert) => {
    const before = i18n.language();
    try {
      assert.ok(i18n.setLanguage('en', { persist: false }));
      assert.equal(i18n.language(), 'en');
      assert.equal(i18n.t('common.save'), 'Save');
      assert.equal(i18n.t('common.rows', { n: 42 }), '42 rows');
      assert.equal(i18n.t('common.rows'), '{n} rows', 'missing parameter stays visible');
      assert.equal(i18n.t('no.such.key'), 'no.such.key');
      assert.equal(i18n.has('common.save'), true);
      assert.equal(i18n.has('no.such.key'), false);
      assert.equal(i18n.tIn('fi', 'common.save'), 'Tallenna');
      assert.equal(i18n.tIn('xx', 'common.save'), 'Save', 'an unknown language falls back to English (loaded here)');
      assert.equal(D.t, i18n.t, 'Dataspatium.t is the shared translator');
      assert.equal(document.documentElement.lang, 'en');
      assert.equal(i18n.locale(), 'en-GB');
      assert.ok(i18n.docsUrl().endsWith('/docs/en/README.md'));
      assert.equal(i18n.setLanguage('xx'), false, 'unknown codes are rejected');
      assert.equal(i18n.language(), 'en');
    } finally {
      i18n.setLanguage(before, { persist: false });
    }
    assert.equal(i18n.t('common.save'), 'Spara');
    assert.ok(i18n.docsUrl().endsWith('#readme'), 'Swedish docs are the repository README');
  });

  test('i18n: the choice is remembered in localStorage and detected on the next start', (assert) => {
    const saved = localStorage.getItem(i18n.KEY);
    try {
      assert.equal(i18n.hasChoice(), true, 'the test page pins a language');
      i18n.setLanguage('is');
      assert.equal(localStorage.getItem(i18n.KEY), 'is');
      assert.equal(i18n.detect(), 'is');
      localStorage.removeItem(i18n.KEY);
      assert.equal(i18n.hasChoice(), false, 'no saved choice means the first-start chooser is shown');
      assert.ok(CODES.includes(i18n.detect()), 'without a choice the browser language picks one of the six');
    } finally {
      if (saved) localStorage.setItem(i18n.KEY, saved); else localStorage.removeItem(i18n.KEY);
      i18n.setLanguage(saved || 'sv', { persist: false });
    }
  });

  test('i18n: numbers follow the language locale', (assert) => {
    const before = i18n.language();
    // Grouping characters differ between browsers' locale data (Icelandic is "1.234,5" in Firefox and
    // "1 234,5" in Edge), so the test checks the decimal separator and that some grouping is applied.
    try {
      for (const code of CODES) {
        i18n.setLanguage(code, { persist: false });
        const s = spaces(i18n.formatNumber(1234.5));
        const m = s.match(/^1(\D)234(\D)5$/);
        assert.ok(m, code + ' groups thousands: ' + s);
        assert.equal(m[2], code === 'en' ? '.' : ',', code + ' decimal separator');
        assert.ok(m[1] !== m[2], code + ' grouping differs from the decimal separator');
      }
      i18n.setLanguage('sv', { persist: false });
      // viz/locale is built once per page load for the language the page started in (Swedish on the test page).
      assert.equal(vizLocale.locale, 'sv-SE');
      assert.equal(vizLocale.numberLocale.decimal, ',', 'decimal separator for charts');
      assert.equal(spaces(vizLocale.numberLocale.thousands), ' ', 'thousands separator for charts');
      assert.equal(vizLocale.timeLocale.months.length, 12, 'month names');
      assert.equal(vizLocale.timeLocale.months[0], 'januari');
      assert.equal(vizLocale.NUMBER_FORMATS[1].label, 'Heltal (1 234)');
      assert.equal(spaces(i18n.formatBytes(1536000)), '1,5 MB');
      assert.equal(i18n.formatBytes(512), '512 B');
      assert.equal(i18n.formatNumber(''), '');
      assert.equal(i18n.formatNumber('abc'), 'abc');
      assert.equal(i18n.formatDateTime('2026-11-03T09:05:00'), '2026-11-03 09:05');
    } finally {
      i18n.setLanguage(before, { persist: false });
    }
  });
})();
