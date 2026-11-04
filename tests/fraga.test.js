// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the Fråga tab in Söka: build a query over two datasets, run it, save it as a list and open its SQL in Analysera. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;

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

  test('soka: the Fråga tab runs a visual query over two datasets, saves it as a list and opens the SQL in Analysera', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const imp = shell.ctx.services.importer;
    const datasets = shell.ctx.services.datasets;
    const lists = D.require('data/lists');
    const a = await imp.run(new File(['kommun;lan;antal\nUmeå;Västerbotten;3\nLuleå;Norrbotten;4\nMalmö;Skåne;9\n'], 'fa.csv', { type: 'text/csv' }), {}, null, 'Flik A');
    const b = await imp.run(new File(['lan;region\nVästerbotten;Norr\nNorrbotten;Norr\nSkåne;Syd\n'], 'fb.csv', { type: 'text/csv' }), {}, null, 'Flik B');
    let saved = null; let made = null;
    try {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === b.id), 3000, 'datasets in store');
      shell.store.set({ selectedId: a.id });
      shell.activate('soka');
      const tabEl = await waitFor(() => Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((el) => el.textContent.trim() === t('soka.tabs.fraga')), 5000, 'Fråga tab');
      /** @type {HTMLElement} */ (tabEl).click();
      const mode = shell.modes.get('soka');
      const qt = await waitFor(() => mode.queryTab, 5000, 'query tab');
      await waitFor(() => qt.state.spec && qt.state.metas.size > 0, 5000, 'spec with metadata');
      assert.equal(qt.state.spec.from.datasetId, a.id, 'starts from the selected dataset');
      assert.ok(root.textContent.includes(t('fraga.datasets')) && root.textContent.includes(t('fraga.columns')), 'cards rendered');
      const spec = {
        from: { datasetId: a.id }, joins: [{ datasetId: b.id, type: 'inner', on: [{ left: 'lan', right: 'lan' }] }],
        columns: [{ source: 1, column: 'region' }, { source: 0, column: 'antal', agg: 'sum', alias: 'summa' }],
        where: { op: 'and', items: [{ source: 0, column: 'antal', cmp: '>=', value: '3' }] }, orderBy: [{ alias: 'summa', dir: 'desc' }], limit: 50,
      };
      await qt.setSpec(spec);
      const res = await qt.run();
      assert.deepEqual(res.values, [['Syd', 9], ['Norr', 7]], JSON.stringify(res.values));
      await waitFor(() => root.querySelector('.dm-center .dm-fraga-sql'), 3000, 'SQL shown');
      assert.ok(root.querySelector('.dm-center .dm-fraga-sql').textContent.includes('group by'), 'generated SQL visible');
      assert.ok(root.querySelector('.dm-center dm-table'), 'results table');
      // Save as a list (kind query) and run it from the Listor tab.
      saved = await qt.saveAsList('Summa per region');
      assert.equal(saved.kind, 'query');
      assert.equal(saved.hits, 2);
      const listsTab = Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((el) => el.textContent.trim() === t('soka.tabs.listor'));
      /** @type {HTMLElement} */ (listsTab).click();
      const card = await waitFor(() => root.querySelector(`.dm-center [data-list="${saved.id}"]`), 5000, 'list card');
      assert.ok(card.textContent.includes('select'), 'query lists show their SQL');
      const runBtn = Array.from(card.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === t('soka.lists.run'));
      /** @type {HTMLElement} */ (runBtn.querySelector('button')).click();
      await waitFor(() => mode.queryTab.state.list && mode.queryTab.state.list.id === saved.id && mode.queryTab.state.result, 8000, 'back in Fråga with the list run');
      assert.ok(root.querySelector('.dm-center .dm-fraga-sql'), 'SQL shown again');
      assert.deepEqual(mode.queryTab.state.result.values, [['Syd', 9], ['Norr', 7]], 'same rows from the list');
      // Save as a dataset.
      made = await qt.saveAsDataset('Regionsumma');
      assert.equal(made.rowCount, 2);
      // Open in Analysera: the SQL arrives in the SQL console.
      qt.openInAnalysera();
      await waitFor(() => shell.store.get().mode === 'analysera', 3000, 'Analysera active');
      await waitFor(() => shell.store.get().pendingCode === null, 5000, 'code consumed by Analysera');
      return 'ok';
    } finally {
      shell.activate('hantera');
      if (saved) await lists.remove(saved.id).catch(() => {});
      if (made) await datasets.remove(made.id);
      await datasets.remove(a.id); await datasets.remove(b.id);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 40000);
})();
