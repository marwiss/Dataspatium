// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for dataset short names and SQL across datasets (joins by short name). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const query = D.require('data/query');
  const recipes = D.require('data/recipes');
  const charts = D.require('viz/charts');
  const idb = D.require('platform/storage/idb');
  const created = [];
  async function fails(fn, re) { try { await fn(); } catch (e) { return re.test(String(e && e.message || e)) ? null : 'wrong error: ' + e.message; } return 'did not throw'; }

  test('shortnames: datasets get unique SQL-safe short names derived from their names', async (assert) => {
    assert.equal(datasets.shortNameFrom('Befolkning per kommun 2024'), 'befolkning_per_kommun_2024');
    assert.equal(datasets.shortNameFrom('Länsgränser (SCB)'), 'lansgranser_scb');
    assert.equal(datasets.shortNameFrom('Ö Ä Å é ü ø æ'), 'o_a_a_e_u_o_ae');
    assert.equal(datasets.shortNameFrom('2024 data'), 'd_2024_data');
    assert.equal(datasets.shortNameFrom('data'), 'data_1', 'reserved words get a suffix');
    assert.equal(datasets.shortNameFrom('   '), 'datamangd');
    assert.equal(datasets.shortNameFrom('x'.repeat(50)).length, 32);
    assert.equal(datasets.validateShortName(' Kommuner '), 'kommuner');
    assert.equal(await fails(async () => datasets.validateShortName('1abc'), /Kortnamnet/), null);
    const a = await importer.run(new File(['kommunkod;befolkning\n0180;984748\n1480;596841\n'], 'a.csv'), {}, null, 'Befolkning test');
    created.push(a.id);
    const b = await importer.run(new File(['kommunkod;kommun;lan\n0180;Stockholm;Stockholms län\n1480;Göteborg;Västra Götalands län\n1280;Malmö;Skåne län\n'], 'b.csv'), {}, null, 'Befolkning test');
    created.push(b.id);
    assert.equal(a.shortName, 'befolkning_test'); assert.equal(b.shortName, 'befolkning_test_2', 'suffix when the name is taken');
    assert.equal((await datasets.list()).find((d) => d.id === a.id).shortName, 'befolkning_test', 'short name in the record');
    await datasets.updateMeta(b.id, { shortName: 'Kommuner' });
    assert.equal((await datasets.get(b.id)).shortName, 'kommuner', 'normalised to lower case');
    assert.equal(await fails(() => datasets.updateMeta(a.id, { shortName: 'kommuner' }), /används redan/), null, 'duplicates rejected');
    assert.equal(await fails(() => datasets.updateMeta(a.id, { shortName: 'select' }), /reserverat/), null, 'reserved words rejected');
    // Records from versions without short names are completed at start.
    const rec = await idb.getDataset(a.id); delete rec.shortName; await idb.putDataset(rec); datasets.close(a.id);
    assert.ok(!(await datasets.get(a.id)).shortName);
    assert.equal(await datasets.ensureShortNames(), 1);
    assert.equal((await datasets.get(a.id)).shortName, 'befolkning_test');
    // The SQLite file carries the short name; a restored copy gets a free one.
    const restored = await datasets.importBytes(await datasets.bytesOf(b.id), { name: 'Kommuner kopia' });
    created.push(restored.id);
    assert.equal(restored.shortName, 'kommuner_2');
    return a.shortName + ', ' + b.shortName;
  }, 30000);

  test('shortnames: one SQL statement can join several datasets by short name', async (assert) => {
    const [a, b] = created;
    const r = await query.select(a, 'select k.kommun, k.lan, b.befolkning from befolkning_test b join kommuner k on k.kommunkod = b.kommunkod order by b.befolkning desc');
    assert.deepEqual(r.columns, ['kommun', 'lan', 'befolkning']);
    assert.deepEqual(r.values, [['Stockholm', 'Stockholms län', 984748], ['Göteborg', 'Västra Götalands län', 596841]]);
    assert.deepEqual(r.others, ['kommuner']);
    assert.ok(query.identifiers("select x from \"Kommuner\" where y = 'kommuner_2' -- data").has('kommuner') && !query.identifiers("select 'kommuner'").has('kommuner'), 'identifiers skip strings and comments');
    const same = await query.select(a, 'select (select count(*) from data) = (select count(*) from befolkning_test) as lika');
    assert.equal(same.values[0][0], 1, 'data and the own short name are the same table');
    const missing = await query.select(a, 'select count(*) as n from kommuner k left join data d on d.kommunkod = k.kommunkod where d.kommunkod is null');
    assert.equal(missing.values[0][0], 1, 'Malmö has no population row');
    assert.ok(await fails(() => query.select(a, "update kommuner set lan = 'x'"), /./) === null, 'other datasets are read-only views');
    // A modifying recipe step may read other datasets: they are attached after the undo snapshot.
    const res = await recipes.apply(a, 'sql', { statement: "update data set befolkning = befolkning + (select count(*) from kommuner) where kommunkod = '0180'" });
    assert.equal(res.rows, 1);
    assert.equal((await datasets.query(a))[0][1], 984751);
    await recipes.undo(a);
    assert.equal((await datasets.query(a))[0][1], 984748, 'undo works across the attachment');
    // Edits in the other dataset are seen by the next query, saved or not.
    await recipes.apply(b, 'sql', { statement: "update data set lan = 'Testlän' where kommunkod = '0180'" });
    const fresh = await query.select(a, "select lan from kommuner where kommunkod = '0180'");
    assert.equal(fresh.values[0][0], 'Testlän');
    const meta = await query.createDataset(a, 'select k.kommun, b.befolkning from befolkning_test b join kommuner k on k.kommunkod = b.kommunkod', { name: 'Koppling' });
    created.push(meta.id);
    assert.equal(meta.rowCount, 2); assert.equal(meta.shortName, 'koppling');
    // Exports and saves of the primary dataset keep working with attachments around.
    await datasets.save(a);
    const again = await query.select(a, 'select count(*) from kommuner');
    assert.equal(again.values[0][0], 3, 'attachments are restored after the connection is reopened');
    return r.values.length + ' rows joined';
  }, 60000);

  test('shortnames: chart files re-link to a dataset by short name when the name differs', async (assert) => {
    const a = created[0];
    const ds = await datasets.get(a);
    const chart = charts.create('vega', ds, 'Kortnamnstest');
    assert.equal(chart.datasetShort, 'befolkning_test');
    const json = JSON.parse(charts.exportJson(chart));
    assert.equal(json.datasetShort, 'befolkning_test');
    json.datasetName = 'Ett annat namn';
    const imported = await charts.importJson(JSON.stringify(json));
    assert.equal(imported.datasetId, a, 'matched by short name');
    await charts.remove(imported.id);
    return 'ok';
  });

  test('shortnames: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
