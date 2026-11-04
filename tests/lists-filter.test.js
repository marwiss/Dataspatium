// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for saved lists as filters: the Bearbeta table narrows to a list, and chart data takes a list as its row source. */
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

  test('lists: a saved list narrows the Bearbeta table and the rows a chart fetches', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const datasets = shell.ctx.services.datasets;
    const lists = D.require('data/lists');
    const vizData = D.require('viz/data');
    const ds = await shell.ctx.services.importer.run(new File(['kommun;lan;antal\nUmeå;Västerbotten;3\nLuleå;Norrbotten;4\nKiruna;Norrbotten;1\nMalmö;Skåne;9\n'], 'listfilter.csv', { type: 'text/csv' }), {}, null, 'Listfilter');
    let rec = null;
    try {
      rec = await lists.save({ name: 'Norrbotten', datasetId: ds.id, text: '', filters: [{ column: 'lan', value: 'Norrbotten' }] });
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === ds.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: ds.id });
      shell.activate('bearbeta');
      const sel = await waitFor(() => root.querySelector(`.dm-center dm-select[aria-label="${t('bearbeta.list')}"]`), 5000, 'list select in the toolbar');
      await waitFor(() => root.querySelector('.dm-center dm-table .dm-tr'), 5000, 'table rows');
      assert.equal(root.querySelectorAll('.dm-center dm-table .dm-tr').length, 4, 'all rows before the list');
      /** @type {any} */ (sel).value = rec.id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-center dm-table .dm-tr').length === 2, 5000, 'two rows with the list');
      const badge = root.querySelector('.dm-center .dm-toolbar dm-badge');
      assert.equal(badge.textContent, t('table.rows.shown', { shown: '2', total: '4' }), 'badge shows shown of total');
      /** @type {any} */ (sel).value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-center dm-table .dm-tr').length === 4, 5000, 'all rows again');
      // Leaving and returning rebuilds the table (the shell empties the slots on every mode switch).
      shell.activate('hantera');
      await waitFor(() => !root.querySelector('.dm-center dm-table'), 3000, 'table gone in Hantera');
      shell.activate('bearbeta');
      await waitFor(() => root.querySelectorAll('.dm-center dm-table .dm-tr').length === 4, 5000, 'table back after the round trip');
      assert.ok(root.querySelector(`.dm-center dm-select[aria-label="${t('bearbeta.list')}"]`), 'list select back too');
      // Chart data: the list is the row source; filters still apply on top.
      const all = await vizData.fetchRows(ds.id, { fields: ['kommun', 'antal'] });
      assert.equal(all.total, 4);
      const listed = await vizData.fetchRows(ds.id, { fields: ['kommun', 'antal'], listId: rec.id });
      assert.equal(listed.total, 2, 'list narrows the chart rows');
      assert.deepEqual(listed.rows.map((r) => r.kommun).sort(), ['Kiruna', 'Luleå']);
      const both = await vizData.fetchRows(ds.id, { fields: ['kommun'], listId: rec.id, filters: [{ field: 'antal', op: '>', value: '2' }] });
      assert.deepEqual(both.rows.map((r) => r.kommun), ['Luleå'], 'list and filter combine');
      const agg = await vizData.fetchRows(ds.id, { listId: rec.id, groupBy: ['lan'], aggregates: [{ fn: 'sum', field: 'antal', as: 'summa' }] });
      assert.deepEqual(agg.rows, [{ lan: 'Norrbotten', summa: 5 }], 'aggregation within the list');
      const other = await vizData.fetchRows(ds.id, { fields: ['kommun'], listId: 'list_does_not_exist' });
      assert.equal(other.total, 4, 'an unknown list is ignored');
      return 'ok';
    } finally {
      shell.activate('hantera');
      if (rec) await lists.remove(rec.id).catch(() => {});
      await datasets.remove(ds.id);
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 30000);
})();
