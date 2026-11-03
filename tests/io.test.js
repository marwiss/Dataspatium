// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for importers, the dataset service, exporters (round trips) and workspace backup. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const datasets = D.require('data/datasets');
  const workspace = D.require('data/workspace');
  const zip = D.require('platform/storage/zip');

  const CSV = 'kommun;kod;befolkning;andel;datum;aktiv\r\nStockholm;0180;984748;9,37;2024-12-31;ja\r\nGöteborg;1480;596841;5,68;2024-12-31;nej\r\nMalmö;1280;362133;3,45;2024-12-31;ja\r\n';
  const created = [];

  test('import: CSV preview infers Swedish types and keeps municipality codes as text', async (assert) => {
    const file = new File([CSV], 'befolkning.csv', { type: 'text/csv' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'csv');
    assert.equal(p.delimiter, ';');
    assert.equal(p.header, true);
    assert.deepEqual(p.columns, ['kommun', 'kod', 'befolkning', 'andel', 'datum', 'aktiv']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'boolean']);
    assert.equal(p.inferred[3].decimal, 'comma');
    return p.inferred.map((c) => c.type).join(',');
  });

  test('import: CSV to dataset, query, stats, save and reopen', async (assert) => {
    const file = new File([CSV], 'befolkning.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Testbefolkning');
    created.push(meta.id);
    assert.equal(meta.rowCount, 3);
    assert.equal(meta.columnCount, 6);
    const rows = await datasets.query(meta.id, { orderBy: 'befolkning', dir: 'desc' });
    assert.deepEqual(rows.map((r) => r[0]), ['Stockholm', 'Göteborg', 'Malmö']);
    assert.equal(rows[0][1], '0180', 'kod keeps its leading zero');
    assert.equal(rows[0][3], 9.37);
    assert.equal(rows[0][5], 1);
    assert.equal(await datasets.count(meta.id, { search: 'malm' }), 1);
    const stats = await datasets.columnStats(meta.id, 'befolkning');
    assert.equal(stats.total, 3); assert.equal(stats.min, 362133); assert.equal(stats.max, 984748);
    const listed = await datasets.list();
    assert.ok(listed.some((d) => d.id === meta.id), 'listed in IndexedDB');
    datasets.close(meta.id);
    // Two callers that open the dataset at the same time (a scheduled save and a view) share one handle.
    const [first, second] = await Promise.all([datasets.ensureOpen(meta.id), datasets.ensureOpen(meta.id)]);
    assert.ok(first === second, 'one handle for concurrent opens');
    const again = await datasets.query(meta.id, { limit: 1 });
    assert.equal(again[0][0], 'Stockholm');
    const log = await datasets.log(meta.id);
    assert.equal(log[0].action, 'import');
    await datasets.updateMeta(meta.id, { name: 'Testbefolkning 2' });
    assert.equal((await datasets.get(meta.id)).name, 'Testbefolkning 2');
  }, 30000);

  test('export: CSV (Excel profile) and JSON round trip', async (assert) => {
    const id = created[0];
    assert.ok(id, 'dataset from previous test');
    const csvBlob = await exporter.toCsv(id, { delimiter: ';', decimal: 'comma', bom: true });
    const head = new Uint8Array(await csvBlob.slice(0, 3).arrayBuffer());
    assert.deepEqual(Array.from(head), [0xef, 0xbb, 0xbf], 'UTF-8 BOM');
    const text = await csvBlob.text(); // Blob.text() strips the BOM
    assert.ok(text.startsWith('kommun;kod;'), 'header');
    assert.ok(text.includes('Stockholm;0180;984748;9,37;2024-12-31;true'), text.split('\r\n')[1]);
    const back = await importer.run(new File([csvBlob], 'export.csv'), {}, null, 'Återimport');
    created.push(back.id);
    const rows = await datasets.query(back.id, { orderBy: 'kommun' });
    const cols = await datasets.columns(back.id);
    assert.deepEqual(cols.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'boolean']);
    assert.deepEqual(rows[2], ['Stockholm', '0180', 984748, 9.37, '2024-12-31', 1]);
    const json = JSON.parse(await (await exporter.toJson(id)).text());
    assert.equal(json.length, 3); assert.equal(json[0].aktiv, true); assert.equal(json[0].kod, '0180');
  }, 30000);

  test('export: Excel round trip keeps numbers, dates and booleans', async (assert) => {
    const id = created[0];
    const blob = await exporter.toXlsx(id);
    assert.ok(blob.size > 2000, 'xlsx size ' + blob.size);
    const file = new File([blob], 'export.xlsx');
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'excel');
    assert.deepEqual(p.sheets, ['Data']);
    const meta = await importer.run(file, {}, null, 'Excel-återimport');
    created.push(meta.id);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'boolean']);
    const rows = await datasets.query(meta.id, { orderBy: 'kommun' });
    assert.deepEqual(rows[2], ['Stockholm', '0180', 984748, 9.37, '2024-12-31', 1]);
  }, 30000);

  test('import: JSON records, nested objects and NDJSON', async (assert) => {
    const records = JSON.stringify({ meta: { x: 1 }, data: [{ kommun: 'Umeå', info: { kod: '2480', andel: 1.3 }, taggar: ['a', 'b'] }, { kommun: 'Luleå', info: { kod: '2580', andel: 0.8 } }] });
    const p = await importer.preview(new File([records], 'data.json'), {});
    assert.deepEqual(p.columns, ['kommun', 'info.kod', 'info.andel', 'taggar']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'integer', 'number', 'text']);
    const nd = '{"a":1,"b":"x"}\n{"a":2,"b":"y"}\n';
    const p2 = await importer.preview(new File([nd], 'data.ndjson'), {});
    assert.equal(p2.dataRows.length, 2);
    assert.deepEqual(p2.columns, ['a', 'b']);
  });

  test('import: pasted tab-separated text', async (assert) => {
    const meta = await importer.runText('namn\tvärde\nA\t1,5\nB\t2', {}, null, 'Inklistrat');
    created.push(meta.id);
    const rows = await datasets.query(meta.id);
    assert.deepEqual(rows, [['A', 1.5], ['B', 2]]);
  });

  test('presets: the bundled example dataset imports with the right types', async (assert) => {
    const preset = D.require('presets').examples[0];
    const meta = await importer.runPreset(preset);
    created.push(meta.id);
    assert.equal(meta.rowCount, 290);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => [c.name, c.type]), [['kommunkod', 'text'], ['kommun', 'text'], ['lanskod', 'text'], ['lan', 'text'], ['ar', 'integer'], ['folkmangd', 'integer']]);
    const stats = await datasets.columnStats(meta.id, 'folkmangd');
    assert.equal(stats.sum, 10587710);
    assert.equal(meta.source.publisher.slice(0, 3), 'SCB');
  }, 30000);

  test('workspace: backup to ZIP and restore adds the datasets back', async (assert) => {
    const before = (await datasets.list()).length;
    const { blob, count } = await workspace.backup();
    assert.equal(count, before);
    const entries = await zip.readZip(blob);
    assert.ok(entries['manifest.json'], 'manifest present');
    const manifest = JSON.parse(zip.text(entries['manifest.json']));
    assert.equal(manifest.datasets.length, before);
    const result = await workspace.restore(blob);
    assert.equal(result.imported.length, before);
    for (const m of result.imported) created.push(m.id);
    assert.equal((await datasets.list()).length, before * 2);
  }, 60000);

  test('cleanup: remove test datasets', async (assert) => {
    for (const id of created) await datasets.remove(id);
    const left = (await datasets.list()).filter((d) => created.includes(d.id));
    assert.equal(left.length, 0);
    return created.length + ' removed';
  });
})();
