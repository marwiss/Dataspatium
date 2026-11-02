// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the command palette: scoring, built-in and mode commands, filtering and running from the shell. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const paletteMod = D.require('ui/command-palette');
  function waitFor(fn, ms, what) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      (function tick() { let v; try { v = fn(); } catch (_e) { v = null; } if (v) return resolve(v); if (performance.now() - t0 > ms) return reject(new Error('timeout: ' + what)); setTimeout(tick, 50); })();
    });
  }

  test('palette: scoring prefers prefixes, then word starts, then substrings and keywords', (assert) => {
    const s = paletteMod.score;
    assert.ok(s({ label: 'Hantera' }, 'han') > s({ label: 'Gå till Hantera' }, 'han'), 'prefix beats word start');
    assert.ok(s({ label: 'Gå till Hantera' }, 'han') > s({ label: 'Behandla' }, 'han'), 'word start beats substring');
    assert.ok(s({ label: 'Behandla' }, 'han') > s({ label: 'Diagram', keywords: ['hantering'] }, 'han'), 'substring beats keyword');
    assert.equal(s({ label: 'Exportera' }, 'xyz'), 0);
    assert.ok(s({ label: 'Gå till Visualisera' }, 'gå vis') > 0, 'several words all have to match');
    assert.equal(s({ label: 'Gå till Visualisera' }, 'gå xyz'), 0);
    assert.equal(s({ label: 'Allt' }, ''), 1, 'empty query matches everything');
  });

  test('palette: lists modes, datasets, operations, charts and dashboards; filters and runs commands', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      assert.ok(shell.palette && typeof shell.palette.open === 'function', 'palette on the shell');
      const file = new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\n'], 'palette.csv', { type: 'text/csv' });
      meta = await shell.ctx.services.importer.run(file, {}, null, 'Palettest');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      const cmds = await shell.palette.collect();
      const ids = cmds.map((c) => c.id);
      assert.ok(ids.includes('mode:hantera') && ids.includes('dataset:' + meta.id), 'modes and datasets: ' + ids.slice(0, 12).join(','));
      assert.ok(ids.includes('op:pseudonymize') && ids.includes('op:trim'), 'operations for the selected dataset');
      assert.ok(ids.includes('viz:new') && ids.includes('dash:new') && ids.includes('export:data') && ids.includes('workspace'), 'mode commands');

      await shell.palette.open();
      await waitFor(() => document.querySelector('dialog.dm-palette'), 2000, 'palette dialog');
      const input = /** @type {HTMLInputElement} */ (document.querySelector('dialog.dm-palette .dm-palette-input'));
      input.value = 'gå till hantera';
      input.dispatchEvent(new Event('input'));
      await waitFor(() => shell.palette.current()[0] && shell.palette.current()[0].id === 'mode:hantera', 2000, 'filtered to Hantera');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitFor(() => shell.store.get().mode === 'hantera', 3000, 'mode switched');
      assert.ok(!shell.palette.isOpen(), 'closed after running');

      shell.onKey(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
      await waitFor(() => shell.palette.isOpen(), 2000, 'opened with Ctrl+K');
      const first = shell.palette.current()[0];
      assert.equal(first && first.id, 'mode:hantera', 'the last command comes first: ' + (first && first.id));
      shell.palette.close();
      assert.ok(!document.querySelector('dialog.dm-palette'), 'dialog removed');

      shell.store.set({ selectedId: null });
      const dsCmd = (await shell.palette.collect()).find((c) => c.id === 'dataset:' + meta.id);
      await dsCmd.run();
      assert.equal(shell.store.get().selectedId, meta.id, 'dataset command selects the dataset');
      return ids.length + ' commands';
    } finally {
      if (meta) await D.require('data/datasets').remove(meta.id);
      root.remove();
    }
  }, 60000);
})();
