// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for sort indexes on demand: created on the first sorted page of a large table, dropped before column rebuilds. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const created = [];
  async function indexNames(id) {
    const handle = await datasets.ensureOpen(id);
    const res = await handle.engine.exec("select name from sqlite_master where type = 'index' and name like '_idx_%'");
    return (res[0] ? res[0].values : []).map((r) => String(r[0]));
  }

  test('indexes: a sorted page of a large table creates an index that column rebuilds drop again', async (assert) => {
    const original = datasets.indexing.threshold;
    datasets.indexing.threshold = 2;
    try {
      const meta = await importer.run(new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\nMalmö;362133\n'], 'idx.csv'), {}, null, 'Indextest');
      created.push(meta.id);
      assert.deepEqual(await indexNames(meta.id), [], 'no index before sorting');
      const rows = await datasets.query(meta.id, { orderBy: 'befolkning', dir: 'desc', limit: 2, offset: 0 });
      assert.equal(rows[0][0], 'Stockholm');
      assert.deepEqual(await indexNames(meta.id), ['_idx_befolkning'], 'index created on the sort column');
      await datasets.query(meta.id, { orderBy: 'befolkning', limit: 2 });
      assert.deepEqual(await indexNames(meta.id), ['_idx_befolkning'], 'created only once');
      // A type change rebuilds the column (ALTER TABLE DROP COLUMN), which an index would block.
      await recipes.apply(meta.id, 'set_type', { column: 'befolkning', type: 'text' });
      assert.equal((await datasets.columns(meta.id)).find((c) => c.name === 'befolkning').type, 'text');
      assert.deepEqual(await indexNames(meta.id), [], 'indexes dropped before the operation');
      const again = await datasets.query(meta.id, { orderBy: 'kommun', limit: 3 });
      assert.equal(again.length, 3);
      assert.deepEqual(await indexNames(meta.id), ['_idx_kommun'], 'recreated on the next sort');
      // Small tables never get indexes.
      datasets.indexing.threshold = 200000;
      const small = await importer.run(new File(['a;b\n1;2\n'], 'small.csv'), {}, null, 'Indextest liten');
      created.push(small.id);
      await datasets.query(small.id, { orderBy: 'a' });
      assert.deepEqual(await indexNames(small.id), []);
      return 'ok';
    } finally { datasets.indexing.threshold = original; }
  });

  test('indexes: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
