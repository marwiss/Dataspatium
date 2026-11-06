// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the loading progress (2.33): the asset loader reports which file is in flight, the R bridge turns that into a progress
 * state, and the status bar names big loads and hides again.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }

  test('loading: the asset loader reports load and done for an asset not yet in memory', async (assert) => {
    const names = D.assets.names('').filter((n) => !D.assets.peek(n));
    // The smallest asset still on disk whose wrapper is a file of its own (a bundle would load megabytes for a tiny asset): cheap
    // to load, and it proves the events.
    const sizes = names.map((n) => ({ n, size: (D.assets.info(n) || {}).size || 0, file: (D.assets.info(n) || {}).file || '' })).filter((x) => x.size > 0 && !/\.bundle\.js$/.test(x.file)).sort((a, b) => a.size - b.size);
    assert.ok(sizes.length >= 1, 'an asset not yet decoded');
    const pick = sizes[0].n;
    const events = [];
    const off = D.assets.onProgress((ev, active) => events.push({ ev, active: active.length }));
    try {
      await D.assets.decode(pick);
    } finally { off(); }
    const mine = events.filter((e) => e.ev.name === pick);
    // Over http the loader also reports progress ticks while the file arrives; the phases are what matters.
    const phases = mine.map((e) => e.ev.phase).filter((p, i, a) => i === 0 || p !== a[i - 1]);
    assert.deepEqual(phases, ['load', 'done'], JSON.stringify(mine));
    assert.equal(mine[0].ev.size, sizes[0].size, 'the size comes from the manifest');
    assert.ok(mine[0].active >= 1, 'in flight while loading'); assert.ok(mine[mine.length - 1].active < mine[0].active, 'and gone when done');
    return pick;
  });

  test('loading: the status bar names a big load and hides again; the R bridge keeps a progress state', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const el = await waitFor(() => root.querySelector('[data-loading]'), 3000, 'the loading element');
      assert.ok(el.hidden, 'hidden at rest');
      shell.showLoading([{ name: 'webr/R.wasm', size: 16 * 1024 * 1024 }, { name: 'lucide/icons/x.svg', size: 500 }]);
      assert.ok(!el.hidden, 'shown for a big load');
      assert.equal(el.children[1].textContent, t('shell.loading', { name: 'webr', size: D.require('ui/i18n').formatBytes(16 * 1024 * 1024) }), 'the text span (the abort button comes after it)');
      shell.showLoading([{ name: 'lucide/icons/x.svg', size: 500 }]);
      assert.ok(el.hidden, 'small loads do not show');
      const bridge = D.require('data/r-bridge').bridge;
      assert.equal(bridge.progress, null, 'no progress before a start');
      assert.ok('unsubProgress' in bridge, 'the bridge subscribes when it starts');
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      root.remove();
    }
    return 'ok';
  }, 30000);
})();
