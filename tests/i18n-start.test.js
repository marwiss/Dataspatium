// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for what the start loads of the languages: the chosen dictionary (with the English texts that the five lack,
 * en-missing.js, F49 a), or the chooser's words and the browser's language; and that the five show those English texts
 * without en.js, which loads only for a key the excerpt lacks too.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const CODES = ['sv', 'da', 'nb', 'nn', 'fi', 'is', 'en'];
  /** The languages that may lack keys and show English there; the start loads the English texts they lack with them. */
  const FALLBACK_EN = ['da', 'nb', 'nn', 'fi', 'is'];
  const withEnglish = (code) => (FALLBACK_EN.includes(code) ? [code, 'en-missing'] : [code]);
  /** The chooser's keys (chooseLanguage in src/ui/shell/shell.js; CHOOSER_KEYS in tools/shared_glossary.py). */
  const CHOOSER_KEYS = ['lang.title', 'lang.first.title', 'lang.first.hint', 'lang.first.keep'];
  const base = () => /** @type {any} */ (globalThis).DATASPATIUM_BASE || '';
  /** The excerpt of English, loaded as a start in one of the five loads it. */
  async function excerpt() {
    if (!D.has('i18n/en-missing')) await D.assets.loadScript(base() + 'src/ui/i18n/en-missing.js');
    return D.require('i18n/en-missing');
  }

  test('i18n start: the first start loads the chooser\'s words and the browser language, a choice its own dictionary, the English excerpt with five', (assert) => {
    const boot = D.boot;
    assert.ok(boot && typeof boot.chosenLanguages === 'function', 'src/boot.js exposes its choice');
    assert.deepEqual(boot.LANGUAGES, CODES);
    assert.deepEqual(boot.FALLBACK_EN, FALLBACK_EN);
    const first = (prefs) => boot.chosenLanguages({ search: '', stored: null, prefs });
    const browser = [
      [['en-US', 'sv'], 'en'], [['sv-SE'], 'sv'], [['sv-FI', 'fi'], 'sv'], [['fi-FI'], 'fi'], [['FI'], 'fi'], [['da-DK'], 'da'],
      [['is'], 'is'], [['no'], 'nb'], [['nb-NO'], 'nb'], [['nn-NO', 'nb'], 'nn'], [['de-DE', 'fr-FR'], 'sv'], [['de-DE', 'da'], 'da'], [[], 'sv'],
    ];
    for (const [prefs, code] of browser) {
      assert.deepEqual(first(prefs), ['languages'].concat(withEnglish(code)), 'no choice, browser ' + prefs.join(','));
      assert.equal(i18n.browserLanguage(prefs), code, 'ui/i18n detects the same language for ' + prefs.join(','));
    }
    // A stored choice loads its own dictionary, and the English texts the five that may lack keys lack; Swedish and English
    // load alone; an unknown stored code counts as no choice. The mobile page loads the same files (src/boot.js MOBILE).
    for (const code of FALLBACK_EN) assert.deepEqual(boot.chosenLanguages({ search: '', stored: code, prefs: ['sv'] }), [code, 'en-missing'], code + ' with the English excerpt');
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'sv', prefs: ['en'] }), ['sv']);
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'en', prefs: ['sv'] }), ['en']);
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'xx', prefs: ['fi'] }), ['languages', 'fi', 'en-missing']);
    // ?lang= wins over the stored choice; an unknown one is ignored.
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=is', stored: 'da', prefs: ['en'] }), ['is', 'en-missing']);
    assert.deepEqual(boot.chosenLanguages({ search: '?course=off&lang=nn', stored: null, prefs: ['en'] }), ['nn', 'en-missing']);
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=en', stored: 'da', prefs: ['da'] }), ['en']);
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=xx', stored: 'fi', prefs: ['en'] }), ['fi', 'en-missing']);
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=xx', stored: null, prefs: ['en'] }), ['languages', 'en']);
    // The test page pins Swedish (tests/setup.js), so its start loaded the Swedish dictionary and nothing else of the languages.
    assert.deepEqual(boot.chosenLanguages(), ['sv']);
    assert.ok(i18n.loaded().includes('sv'), 'Swedish loaded on the test page');
  });

  test('i18n start: languages.js holds exactly the chooser\'s keys in all seven languages, as the dictionaries say them', async (assert) => {
    if (!D.has('i18n/languages')) await D.assets.loadScript(base() + 'src/ui/i18n/languages.js');
    const words = D.require('i18n/languages');
    assert.deepEqual(Object.keys(words), CODES, 'one entry per language, in the chooser\'s order');
    for (const code of CODES) {
      assert.deepEqual(Object.keys(words[code]), CHOOSER_KEYS, code + ': the chooser\'s keys and no others');
      assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
      for (const key of CHOOSER_KEYS) assert.equal(words[code][key], i18n.tIn(code, key), code + ' ' + key + ' (run python tools/shared_glossary.py)');
    }
    // Swedish and English have every key, which lets the start load either alone; the other five may lack keys (the English
    // texts they lack show there, from en-missing.js), but none has a key Swedish lacks.
    const svKeys = new Set(i18n.keys('sv'));
    for (const code of CODES) {
      const keys = i18n.keys(code);
      assert.deepEqual(keys.filter((k) => !svKeys.has(k)), [], code + ': keys Swedish lacks');
      if (!FALLBACK_EN.includes(code)) assert.equal(keys.length, svKeys.size, code + ': as many keys as Swedish');
    }
  });

  test('i18n start: en-missing.js holds the English texts of exactly the keys that one of the five lacks, each with its singular', async (assert) => {
    for (const code of CODES) assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
    const words = await excerpt();
    const en = D.require('i18n/en');
    const enKeys = i18n.keys('en');
    const lacked = new Set(FALLBACK_EN.flatMap((code) => { const own = new Set(i18n.keys(code)); return enKeys.filter((k) => !own.has(k)); }));
    for (const k of Array.from(lacked)) if (k + '.one' in en) lacked.add(k + '.one');
    assert.deepEqual(Object.keys(words), enKeys.filter((k) => lacked.has(k)), 'the keys, in the order of en.js (run python tools/shared_glossary.py)');
    assert.deepEqual(Object.keys(words).filter((k) => words[k] !== en[k]), [], 'the texts of en.js');
    return Object.keys(words).length + ' keys';
  });

  test('i18n start: Danish shows the English texts it lacks from the excerpt without en.js, and a key missing there too loads en.js', async (assert) => {
    for (const code of ['sv', 'da', 'en']) assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
    const words = await excerpt();
    const da = D.require('i18n/da');
    const en = D.require('i18n/en');
    const key = Object.keys(words).find((k) => !(k in da) && !k.endsWith('.one'));
    assert.ok(key, 'a key Danish lacks');
    const before = i18n.language();
    const stale = 'test.excerpt.stale';
    en[stale] = 'Only in en.js';
    try {
      assert.ok(i18n.setLanguage('da', { persist: false }));
      // As a start in Danish: its own dictionary and the excerpt, not en.js.
      i18n.unloadLanguage('en');
      assert.ok(!i18n.loaded().includes('en'), 'en.js not loaded: ' + i18n.loaded().join(','));
      assert.equal(i18n.t(String(key)), words[String(key)], 'the English text from the excerpt: ' + key);
      assert.equal(i18n.has(String(key)), true, 'has() sees the excerpt');
      assert.equal(i18n.tIn('da', String(key)), words[String(key)], 'tIn reads the excerpt too');
      assert.equal(i18n.t('common.save'), 'Gem', 'a key Danish has stays Danish');
      assert.ok(!i18n.loaded().includes('en'), 'and en.js is still not loaded');
      // A key that Danish and the excerpt lack (a new key before the tool has run) loads en.js, which shows it from then on.
      assert.equal(i18n.has(stale), false, 'not in Danish, the excerpt or Swedish');
      assert.equal(i18n.t(stale), stale, 'the key itself until en.js is there');
      const t0 = performance.now();
      while (!i18n.loaded().includes('en') && performance.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 20));
      assert.ok(i18n.loaded().includes('en'), 'en.js loaded for a key the excerpt lacks');
      assert.equal(i18n.t(stale), 'Only in en.js', 'and the key shows in English');
    } finally {
      delete en[stale];
      await i18n.loadLanguage('en');
      i18n.setLanguage(before, { persist: false });
    }
    return key;
  });
})();
