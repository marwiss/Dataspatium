// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for updating API datasets with one click (api/runner refreshDataset): the table is rebuilt from the
 * new rows and the recipe replayed without being logged twice; a step that cannot be replayed leaves the
 * dataset as it was; a recipe with a secret step is refused; and the saved fetches view in Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const rules = D.require('data/rules');
  const runner = D.require('api/runner');
  const t = D.require('ui/i18n').t;
  const created = [];
  const source = { kind: 'api', connectorId: 'test-refresh', connectorName: 'Testkälla', endpointId: 'x', endpointName: 'Data', params: {} };
  const make = async (name, extra) => {
    const meta = await datasets.create(Object.assign({ name, columns: [{ name: 'kommun', type: 'text', label: 'kommun' }, { name: 'folk', type: 'integer', label: 'folk' }], rows: [['Stockholm', 100], ['Malmö', 50]], source, importOptions: { decimal: 'point' } }, extra || {}));
    created.push(meta.id);
    return meta.id;
  };
  const rowsOf = async (id) => datasets.query(id, { limit: 100 });

  test('refresh: an API dataset is fetched again, rebuilt and its recipe replayed once', async (assert) => {
    const id = await make('Uppdatering med recept');
    await recipes.apply(id, 'rename_column', { column: 'kommun', name: 'namn' });
    await recipes.apply(id, 'add_column', { name: 'dubbel', type: 'integer', expression: 'folk * 2' });
    await rules.add(id, { type: 'notnull', column: 'namn' });
    const stepsBefore = (await recipes.steps(id)).length;
    const res = await runner.refreshDataset(id, { fetch: async () => ({ columns: ['kommun', 'folk'], rows: [['Stockholm', '110'], ['Malmö', '55'], ['Uppsala', '30']] }) });
    assert.deepEqual(res, { rows: 3, steps: 2 });
    const handle = await datasets.ensureOpen(id);
    assert.deepEqual(handle.columns.map((c) => c.name), ['namn', 'folk', 'dubbel']);
    assert.deepEqual(await rowsOf(id), [['Stockholm', 110, 220], ['Malmö', 55, 110], ['Uppsala', 30, 60]]);
    assert.equal((await recipes.steps(id)).length, stepsBefore, 'the recipe is not doubled');
    const log = await datasets.log(id);
    assert.equal(log[log.length - 1].action, 'refresh', 'the update is logged');
    assert.equal((await rules.list(id)).length, 1, 'rules kept');
    const meta = await datasets.get(id);
    assert.equal(meta.name, 'Uppdatering med recept');
    assert.ok(meta.source.fetchedAt && meta.source.rows === 3, 'source updated');
    // The same update again gives the same result.
    await runner.refreshDataset(id, { fetch: async () => ({ columns: ['kommun', 'folk'], rows: [['Lund', '20']] }) });
    assert.deepEqual(await rowsOf(id), [['Lund', 20, 40]]);
    return 'ok';
  });

  test('refresh: a recipe step that cannot be replayed leaves the dataset unchanged', async (assert) => {
    const id = await make('Uppdatering som misslyckas');
    await recipes.apply(id, 'rename_column', { column: 'kommun', name: 'namn' });
    let err = null;
    try { await runner.refreshDataset(id, { fetch: async () => ({ columns: ['ort', 'folk'], rows: [['Lund', '1']] }) }); } catch (e) { err = e; }
    assert.ok(err, 'refused');
    assert.ok(err.message.includes(t('recipe.rename_column', { column: 'kommun', name: 'namn' })), 'names the step: ' + err.message);
    const handle = await datasets.ensureOpen(id);
    assert.deepEqual(handle.columns.map((c) => c.name), ['namn', 'folk'], 'columns as before');
    assert.deepEqual(await rowsOf(id), [['Stockholm', 100], ['Malmö', 50]], 'rows as before');
    return 'ok';
  });

  test('refresh: a recipe with a secret step is refused before anything is fetched', async (assert) => {
    const id = await make('Uppdatering med hemlighet');
    await recipes.apply(id, 'pseudonymize', { columns: ['kommun'], method: 'hash', salt: 'hemligt', length: 8 });
    let fetched = false; let err = null;
    try { await runner.refreshDataset(id, { fetch: async () => { fetched = true; return { columns: ['kommun', 'folk'], rows: [] }; } }); } catch (e) { err = e; }
    assert.ok(err && !fetched, 'refused without fetching');
    assert.ok(/secret|hemlig/i.test(err.message) || err.message.includes(t('api.refresh.secret', { step: '' }).slice(0, 12)), err && err.message);
    return 'ok';
  });

  test('refresh: Inhämta lists the saved fetches with one-click updates', async (assert) => {
    const id = await make('Sparad hämtning');
    D.require('ui/components');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      await wait(500);
      const item = Array.from(root.querySelectorAll('.dm-left button.dm-list-item')).find((b) => b.textContent.includes(t('api.saved.title')));
      assert.ok(item, 'source item');
      /** @type {HTMLElement} */ (item).click();
      await wait(400);
      const row = Array.from(root.querySelectorAll('.dm-center tbody tr')).find((tr) => tr.textContent.includes('Sparad hämtning'));
      assert.ok(row, 'dataset listed');
      assert.ok(row.textContent.includes('Testkälla'), 'source shown');
      assert.ok(row.querySelector(`dm-button[label="${t('api.saved.update')}"]`), 'update button');
      assert.ok(root.querySelector(`.dm-page-head dm-button[variant="primary"]`), 'update all');
    } finally {
      for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
      root.remove();
    }
    return 'ok';
  }, 30000);

  test('refresh: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_e) { /* already gone */ } }
    return created.length + ' datasets removed';
  });
})();
