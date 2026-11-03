// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of Söka: the search module (words, case, facets), saved lists, and the mode's search flow. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const search = D.require('analysis/search');
  const lists = D.require('data/lists');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }

  test('search: every word must occur somewhere in the row, letters match regardless of case, facets narrow the hits', async (assert) => {
    const a = await importer.run(new File(['kommun;lan;typ\nStockholm;Stockholms län;stad\nGÖTEBORG;Västra Götalands län;stad\nÅre;Jämtlands län;ort\n'], 'sok-a.csv', { type: 'text/csv' }), {}, null, 'Sök A');
    const b = await importer.run(new File(['namn;ort\nAnna;Göteborg\nBo;Malmö\n'], 'sok-b.csv', { type: 'text/csv' }), {}, null, 'Sök B');
    try {
      const res = await search.search([a.id, b.id], 'göteborg');
      assert.equal(res.length, 2);
      assert.equal(res[0].count, 1); assert.equal(res[0].rows[0][1], 'GÖTEBORG', 'upper-case Ö matches');
      assert.equal(res[1].count, 1); assert.equal(res[1].rows[0][2], 'Göteborg');
      assert.equal((await search.searchDataset(a.id, 'åre')).count, 1, 'Å matches å');
      assert.equal((await search.searchDataset(a.id, 'län stad')).count, 2, 'both words must occur');
      const three = await search.searchDataset(a.id, 'län');
      assert.equal(three.count, 3);
      const typ = three.facets.find((f) => f.column === 'typ');
      assert.ok(typ && typ.values[0].value === 'stad' && typ.values[0].n === 2, 'facet typ: ' + JSON.stringify(three.facets));
      assert.ok(!three.facets.some((f) => f.column === 'kommun'), 'a column with only distinct values is no facet');
      const narrowed = await search.searchDataset(a.id, '', [{ column: 'typ', value: 'ort' }]);
      assert.equal(narrowed.count, 1); assert.equal(narrowed.rows[0][1], 'Åre');
      assert.equal((await search.searchDataset(a.id, 'a.c')).count, 0, 'regex characters are literal');
      return 'ok';
    } finally { await datasets.remove(a.id); await datasets.remove(b.id); }
  });

  test('lists: a saved selection runs again, becomes a dataset with the same columns, and is removed', async (assert) => {
    const a = await importer.run(new File(['kommun;typ\nStockholm;stad\nGöteborg;stad\nÅre;ort\n'], 'sok-c.csv', { type: 'text/csv' }), {}, null, 'Sök C');
    let created = null;
    try {
      const rec = await lists.save({ name: 'Städer', datasetId: a.id, text: 'stad', filters: [], hits: 2 });
      assert.ok((await lists.list()).some((l) => l.id === rec.id), 'listed');
      assert.equal(lists.describe(rec), '"stad"');
      const run = await lists.run(rec);
      assert.equal(run.count, 2); assert.ok(rec.lastRunAt, 'run time recorded');
      created = await lists.toDataset(rec, 'Städer som datamängd');
      assert.equal(created.rowCount, 2);
      assert.deepEqual((await datasets.columns(created.id)).map((c) => c.name), ['kommun', 'typ']);
      await lists.remove(rec.id);
      assert.ok(!(await lists.list()).some((l) => l.id === rec.id), 'removed');
      return 'ok';
    } finally { await datasets.remove(a.id); if (created) await datasets.remove(created.id); }
  });

  test('soka: the mode searches, shows facets, narrows by a click and shows the record in the inspector', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const meta = await shell.ctx.services.importer.run(new File(['kommun;lan;typ\nStockholm;Stockholms län;stad\nGöteborg;Västra Götalands län;stad\nÅre;Jämtlands län;ort\n'], 'sok-ui.csv', { type: 'text/csv' }), {}, null, 'Sök UI');
    try {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('soka');
      const input = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-center dm-input'), 3000, 'search field'));
      input.value = 'län';
      const run = /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-button')).find((b) => b.getAttribute('label') === t('soka.run')));
      run.querySelector('button').click();
      const card = await waitFor(() => root.querySelector(`.dm-search-result[data-dataset="${meta.id}"]`), 8000, 'result card');
      assert.ok(card.querySelector('dm-badge').textContent.includes('3'), 'three hits: ' + card.querySelector('dm-badge').textContent);
      const chip = /** @type {HTMLElement} */ (Array.from(card.querySelectorAll('.dm-chip')).find((c) => c.textContent.startsWith('ort')));
      assert.ok(chip, 'facet chip for typ = ort');
      chip.click();
      await waitFor(() => { const c = root.querySelector(`.dm-search-result[data-dataset="${meta.id}"] dm-badge`); return c && c.textContent.includes('1'); }, 8000, 'narrowed to one hit');
      const row = /** @type {HTMLElement} */ (await waitFor(() => root.querySelector('.dm-search-result dm-table .dm-tr'), 5000, 'hit row'));
      row.click();
      await waitFor(() => root.querySelector('.dm-right dm-kv'), 3000, 'record in the inspector');
      assert.ok(root.querySelector('.dm-right').textContent.includes('Åre'), 'the record shows Åre');
      // The active filter can be removed again.
      /** @type {HTMLElement} */ (root.querySelector('.dm-search-result .dm-chip[aria-pressed="true"]')).click();
      await waitFor(() => { const c = root.querySelector(`.dm-search-result[data-dataset="${meta.id}"] dm-badge`); return c && c.textContent.includes('3'); }, 8000, 'back to three hits');
      return 'ok';
    } finally { await shell.ctx.services.datasets.remove(meta.id); root.remove(); }
  });
})();
