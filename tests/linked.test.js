// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for linked files (data/linked): a dataset from a linked file is read again from disk with its recipe replayed; the handle is a test double. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const runner = D.require('api/runner');
  const linked = D.require('data/linked');
  const t = D.require('ui/i18n').t;

  test('linked: a dataset from a linked file is read again from disk with its recipe replayed', async (assert) => {
    let csv = 'kommun;antal\nUmeå;3\nLuleå;4\nKiruna;5\n';
    let stamp = Date.now() - 60000;
    const handle = { kind: 'file', name: 'lankad.csv', getFile: async () => new File([csv], 'lankad.csv', { type: 'text/csv', lastModified: stamp }), queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
    const first = await handle.getFile();
    const meta = await importer.run(first, { linked: true }, null, 'Länkad');
    try {
      assert.ok(linked.isLinked(meta), 'marked as linked');
      assert.equal(meta.source.linked, true);
      assert.equal(meta.source.fileName, 'lankad.csv');
      await linked.link(meta.id, handle);
      assert.equal(await linked.handleFor(meta.id), handle);
      assert.equal(await linked.changed(meta.id), false, 'unchanged right after the import');
      await recipes.apply(meta.id, 'rename_column', { column: 'kommun', name: 'namn' });
      csv = 'kommun;antal\nUmeå;3\nLuleå;4\nKiruna;5\nPiteå;2\n';
      stamp = Date.now();
      assert.equal(await linked.changed(meta.id), true, 'the file on disk differs');
      const res = await runner.refreshDataset(meta.id);
      assert.equal(res.rows, 4);
      assert.equal(res.steps, 1, 'the rename step was replayed');
      const cols = await datasets.columns(meta.id);
      assert.deepEqual(cols.map((c) => c.name), ['namn', 'antal']);
      const after = await datasets.get(meta.id);
      assert.equal(after.rowCount, 4);
      assert.equal(after.source.size, new Blob([csv]).size, 'size follows the file');
      assert.ok(after.source.linked, 'still linked');
      // Without the handle (a new browser profile) the refresh explains what to do.
      await linked.unlink(meta.id);
      let err = null;
      try { await runner.refreshDataset(meta.id); } catch (e) { err = e; }
      assert.equal(err && err.message, t('linked.err.nohandle'));
      // A denied permission is reported too.
      await linked.link(meta.id, Object.assign({}, handle, { queryPermission: async () => 'prompt', requestPermission: async () => 'denied' }));
      err = null;
      try { await linked.file(meta.id); } catch (e) { err = e; }
      assert.equal(err && err.message, t('linked.err.denied'));
      return 'ok';
    } finally {
      await linked.unlink(meta.id).catch(() => {});
      await datasets.remove(meta.id);
    }
  }, 30000);
})();
