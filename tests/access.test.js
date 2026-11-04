// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the Access importer (io/importers/access): mdb-reader loaded as a vendored module graph, tables offered, the chosen table imported with its types. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');

  test('access: an Access database is read in the browser; its tables are offered and the chosen one imported with its types', async (assert) => {
    const bytes = await D.assets.load('tests/fixtures/test.accdb');
    const file = new File([bytes], 'test.accdb', { type: 'application/msaccess' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'access');
    assert.deepEqual(p.tables, ['Kommuner']);
    assert.equal(p.table, 'Kommuner');
    assert.deepEqual(p.columns, ['Id', 'Kod', 'Namn', 'Folkmangd', 'Andel', 'Datum', 'Aktiv']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['integer', 'text', 'text', 'integer', 'number', 'datetime', 'boolean'], p.inferred.map((c) => c.type).join(','));
    assert.equal(p.totalRows, 3);
    let meta = null;
    try {
      meta = await importer.run(file, { format: 'access', table: 'Kommuner' }, null, 'Access-test');
      assert.equal(meta.rowCount, 3);
      assert.equal(meta.source.format, 'access');
      const cols = await datasets.columns(meta.id);
      assert.deepEqual(cols.map((c) => c.name + ':' + c.type), ['Id:integer', 'Kod:text', 'Namn:text', 'Folkmangd:integer', 'Andel:number', 'Datum:datetime', 'Aktiv:boolean'], cols.map((c) => c.name + ':' + c.type).join(','));
      const rows = await datasets.query(meta.id, { orderBy: 'Folkmangd', dir: 'desc', limit: 3 });
      assert.equal(rows[0][2], 'Stockholm');
      assert.equal(rows[0][3], 984748);
      assert.equal(rows[0][1], '0180', 'codes stay text');
      assert.ok(String(rows[0][5]).startsWith('2024-12-31'), 'date kept: ' + rows[0][5]);
      // The graph is imported once and reused.
      const again = await importer.preview(file, { table: 'Kommuner', previewRows: 1 });
      assert.equal(again.dataRows.length, 1);
      return 'ok';
    } finally {
      if (meta) await datasets.remove(meta.id);
    }
  }, 60000);
})();
