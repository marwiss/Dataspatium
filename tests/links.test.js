// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for deep links: #/<mode>/<object> selects a dataset, opens a search and is what shell.link() builds. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  test('shell: deep links select datasets by short name, open a search, and shell.link builds them', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const csv = new File(['kommun;antal\nStockholm;10\nUppsala;5\n'], 'lank.csv', { type: 'text/csv' });
    const meta = await shell.ctx.services.importer.run(csv, {}, null, 'Länktest');
    try {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      const short = shell.store.get().datasets.find((d) => d.id === meta.id).shortName;
      assert.ok(short, 'short name assigned');
      const link = shell.link('bearbeta', short);
      assert.ok(link.endsWith('#/bearbeta/' + short), 'link ends with the route: ' + link);
      assert.deepEqual(shell.parseRoute(), { mode: shell.store.get().mode, object: '' }, 'route without object');
      shell.activate('hantera');
      shell.store.set({ selectedId: null });
      location.hash = '#/bearbeta/' + short;
      await waitFor(() => shell.store.get().mode === 'bearbeta' && shell.store.get().selectedId === meta.id, 5000, 'mode and dataset from the link');
      assert.equal(location.hash, '#/bearbeta/' + short, 'object kept in the address');
      location.hash = '#/soka/' + encodeURIComponent('Stockholm');
      await waitFor(() => shell.store.get().mode === 'soka' && shell.store.get().lastSearch && shell.store.get().lastSearch.text === 'Stockholm', 8000, 'search from the link');
      assert.ok(shell.store.get().lastSearch.hits >= 1, 'the linked search found the row');
      location.hash = '#/hantera/' + meta.id;
      await waitFor(() => shell.store.get().mode === 'hantera', 3000, 'id works as object too');
      assert.equal(shell.store.get().selectedId, meta.id);
      return 'ok';
    } finally {
      await shell.ctx.services.datasets.remove(meta.id);
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 30000);
})();
