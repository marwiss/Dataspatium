// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the shared glossary (2.34): presets/i18n-shared.json is embedded, lists six languages, and every value is what the app's own
 * translation says, so Kontroll can compare its files against it. Also the deep link that hands a server to Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');

  test('glossary: the shared glossary is embedded, complete in six languages, and equal to the translations', async (assert) => {
    const data = JSON.parse(await D.assets.loadText('presets/i18n-shared.json'));
    assert.deepEqual(data.languages, ['sv', 'en', 'da', 'nb', 'fi', 'is']);
    const keys = Object.keys(data.keys);
    assert.ok(keys.length >= 40, 'keys: ' + keys.length);
    assert.ok(keys.includes('issues.title') && keys.includes('opencde.signin') && keys.includes('cdelog.title'));
    let checked = 0;
    for (const key of keys) {
      for (const lang of data.languages) {
        const expected = i18n.tIn(lang, key);
        assert.equal(data.keys[key][lang], expected, `${lang}:${key}`);
        checked++;
      }
    }
    return `${checked} values`;
  });

  test('glossary: the deep link #/inhamta/opencde?server=… lands in the store for Inhämta to open the dialog with the server', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search + '#/inhamta/' + encodeURIComponent('opencde?server=https://cde.example.org'));
      const shell = await D.require('app').start(root);
      // The route is consumed on start: either the dialog is open with the server filled in, or the pending source waits for Inhämta.
      const t0 = performance.now();
      let dialog = null;
      while (performance.now() - t0 < 5000) {
        dialog = document.querySelector('dialog[open]');
        if (dialog && dialog.textContent.includes('cde.example.org')) break;
        if (dialog) { const input = Array.from(dialog.querySelectorAll('dm-input')).find((x) => /** @type {any} */ (x).value === 'https://cde.example.org'); if (input) break; }
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(dialog, 'the source dialog opened');
      const input = Array.from(dialog.querySelectorAll('dm-input')).find((x) => String(/** @type {any} */ (x).value || '').includes('cde.example.org'));
      assert.ok(input, 'the server address is filled in');
      assert.equal(shell.store.get().pendingSource, null, 'consumed once');
      /** @type {any} */ (dialog).close();
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
    return 'ok';
  }, 30000);
})();
