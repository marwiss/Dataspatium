// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for what the start loads of the languages: the chosen dictionary alone, or the chooser's words and the browser's language. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const CODES = ['sv', 'da', 'nb', 'nn', 'fi', 'is', 'en'];
  /** The chooser's keys (chooseLanguage in src/ui/shell/shell.js; CHOOSER_KEYS in tools/shared_glossary.py). */
  const CHOOSER_KEYS = ['lang.title', 'lang.first.title', 'lang.first.hint', 'lang.first.keep'];

  test('i18n start: the first start loads the chooser\'s words and the browser language, a choice only its own dictionary', (assert) => {
    const boot = D.boot;
    assert.ok(boot && typeof boot.chosenLanguages === 'function', 'src/boot.js exposes its choice');
    assert.deepEqual(boot.LANGUAGES, CODES);
    const first = (prefs) => boot.chosenLanguages({ search: '', stored: null, prefs });
    const browser = [
      [['en-US', 'sv'], 'en'], [['sv-SE'], 'sv'], [['sv-FI', 'fi'], 'sv'], [['fi-FI'], 'fi'], [['FI'], 'fi'], [['da-DK'], 'da'],
      [['is'], 'is'], [['no'], 'nb'], [['nb-NO'], 'nb'], [['nn-NO', 'nb'], 'nn'], [['de-DE', 'fr-FR'], 'sv'], [['de-DE', 'da'], 'da'], [[], 'sv'],
    ];
    for (const [prefs, code] of browser) {
      assert.deepEqual(first(prefs), ['languages', code], 'no choice, browser ' + prefs.join(','));
      assert.equal(i18n.browserLanguage(prefs), code, 'ui/i18n detects the same language for ' + prefs.join(','));
    }
    // A stored choice loads only its own dictionary, Swedish included; an unknown stored code counts as no choice.
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'da', prefs: ['en'] }), ['da']);
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'sv', prefs: ['en'] }), ['sv']);
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'en', prefs: ['sv'] }), ['en']);
    assert.deepEqual(boot.chosenLanguages({ search: '', stored: 'xx', prefs: ['fi'] }), ['languages', 'fi']);
    // ?lang= wins over the stored choice; an unknown one is ignored.
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=is', stored: 'da', prefs: ['en'] }), ['is']);
    assert.deepEqual(boot.chosenLanguages({ search: '?course=off&lang=nn', stored: null, prefs: ['en'] }), ['nn']);
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=xx', stored: 'fi', prefs: ['en'] }), ['fi']);
    assert.deepEqual(boot.chosenLanguages({ search: '?lang=xx', stored: null, prefs: ['en'] }), ['languages', 'en']);
    // The test page pins Swedish (tests/setup.js), so its start loaded the Swedish dictionary and nothing else of the languages.
    assert.deepEqual(boot.chosenLanguages(), ['sv']);
    assert.ok(i18n.loaded().includes('sv'), 'Swedish loaded on the test page');
  });

  test('i18n start: languages.js holds exactly the chooser\'s keys in all seven languages, as the dictionaries say them', async (assert) => {
    if (!D.has('i18n/languages')) await D.assets.loadScript((globalThis.DATASPATIUM_BASE || '') + 'src/ui/i18n/languages.js');
    const words = D.require('i18n/languages');
    assert.deepEqual(Object.keys(words), CODES, 'one entry per language, in the chooser\'s order');
    for (const code of CODES) {
      assert.deepEqual(Object.keys(words[code]), CHOOSER_KEYS, code + ': the chooser\'s keys and no others');
      assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
      for (const key of CHOOSER_KEYS) assert.equal(words[code][key], i18n.tIn(code, key), code + ' ' + key + ' (run python tools/shared_glossary.py)');
    }
    // Every dictionary has every key, which is what lets the start load one of them alone.
    const svKeys = new Set(i18n.keys('sv'));
    for (const code of CODES) {
      const keys = i18n.keys(code);
      assert.deepEqual(keys.filter((k) => !svKeys.has(k)), [], code + ': keys Swedish lacks');
      assert.equal(keys.length, svKeys.size, code + ': as many keys as Swedish');
    }
  });
})();
