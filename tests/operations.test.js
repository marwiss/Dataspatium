// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for cleaning operations, recipes with undo, versions, derived datasets and the profile. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const derive = D.require('data/derive');
  const profile = D.require('data/profile');
  const created = [];
  let id = null;

  const CSV = 'kommun;kod;befolkning;andel;datum;text\n Stockholm ;0180;984 748;9,37;31/12/2024;Göteborg\nGöteborg;1480;596 841;5,68;31/12/2024;Ã–rebro\ngöteborg;1480;596 841;5,68;31/12/2024;\nMalmö;1280;362 133;3,45;2024-12-31;malmö\n';

  test('operations: trim, case, replace, type change, add/rename/drop columns with undo', async (assert) => {
    const meta = await importer.run(new File([CSV], 'ops.csv'), { decimal: 'comma' }, [
      { name: 'kommun', type: 'text', include: true }, { name: 'kod', type: 'text', include: true }, { name: 'befolkning', type: 'text', include: true },
      { name: 'andel', type: 'text', include: true }, { name: 'datum', type: 'text', include: true }, { name: 'text', type: 'text', include: true },
    ], 'Operationstest');
    id = meta.id; created.push(id);
    const prev = await recipes.preview(id, 'trim', { columns: ['kommun'], squish: true });
    assert.equal(prev.rows, 1, 'trim preview');
    await recipes.apply(id, 'trim', { columns: ['kommun'], squish: true });
    assert.deepEqual((await datasets.query(id, { limit: 1 }))[0][0], 'Stockholm');
    await recipes.apply(id, 'change_case', { columns: ['kommun'], mode: 'title' });
    assert.deepEqual((await datasets.query(id)).map((r) => r[0]), ['Stockholm', 'Göteborg', 'Göteborg', 'Malmö'], 'Swedish title case');
    const rp = await recipes.preview(id, 'replace_text', { columns: ['kommun'], find: 'borg', replace: 'BORG', regex: false, caseInsensitive: false });
    assert.equal(rp.rows, 2); assert.equal(rp.samples[0].after, 'GöteBORG');
    await recipes.apply(id, 'replace_text', { columns: ['kommun'], find: '^G(.*)$', replace: 'g$1', regex: true });
    assert.equal((await datasets.query(id))[1][0], 'göteborg');
    assert.ok(recipes.canUndo(id));
    await recipes.undo(id);
    assert.equal((await datasets.query(id))[1][0], 'Göteborg', 'undo restores');
    const typed = await recipes.apply(id, 'set_type', { column: 'befolkning', type: 'integer', decimal: 'comma' });
    assert.equal(typed.rows, 4); assert.equal(typed.lost, 0);
    await recipes.apply(id, 'set_type', { column: 'andel', type: 'number', decimal: 'comma' });
    await recipes.apply(id, 'set_type', { column: 'datum', type: 'date' });
    const cols = await datasets.columns(id);
    assert.deepEqual(cols.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'text']);
    const row = (await datasets.query(id, { limit: 1 }))[0];
    assert.deepEqual(row.slice(2, 5), [984748, 9.37, '2024-12-31']);
    const stats = await datasets.columnStats(id, 'befolkning');
    assert.equal(stats.sum, 984748 + 596841 * 2 + 362133);
    await recipes.apply(id, 'add_column', { name: 'tusental', type: 'number', expression: 'round(befolkning / 1000.0, 1)' });
    assert.equal((await datasets.query(id, { limit: 1 }))[0][6], 984.7);
    await recipes.apply(id, 'rename_column', { column: 'tusental', name: 'tusen' });
    await recipes.apply(id, 'fix_encoding', { columns: ['text'] });
    assert.equal((await datasets.query(id))[1][5], 'Örebro', 'mojibake repaired');
    await recipes.apply(id, 'replace_value', { column: 'text', fromEmpty: true, toEmpty: false, to: 'okänd' });
    assert.equal((await datasets.query(id))[2][5], 'okänd');
    await recipes.apply(id, 'drop_columns', { columns: ['text'] });
    assert.deepEqual((await datasets.columns(id)).map((c) => c.name), ['kommun', 'kod', 'befolkning', 'andel', 'datum', 'tusen']);
    const steps = await recipes.steps(id);
    assert.ok(steps.length >= 9, 'steps logged: ' + steps.length);
    const r = await recipes.toR(id);
    assert.ok(r.includes('trimws') && r.includes('as.integer') && r.includes('dm_write'), r.slice(0, 200));
    const sql = await recipes.toSQL(id);
    assert.ok(sql.includes('UPDATE data SET') && sql.includes('ALTER TABLE'), sql.slice(0, 200));
    return steps.length + ' steps';
  }, 60000);

  test('operations: duplicates, delete rows, combine/split, pivot and edit cell', async (assert) => {
    const dup = await recipes.preview(id, 'remove_duplicates', { columns: ['kod'] });
    assert.equal(dup.rows, 1);
    await recipes.apply(id, 'remove_duplicates', { columns: ['kod'] });
    assert.equal(await datasets.count(id), 3);
    await recipes.apply(id, 'combine_columns', { columns: ['kod', 'kommun'], separator: ' ', name: 'kodnamn' });
    const combined = await datasets.query(id, { limit: 1 });
    assert.equal(combined[0][combined[0].length - 1], '0180 Stockholm', 'columns: ' + (await datasets.columns(id)).map((c) => c.name).join(','));
    await recipes.apply(id, 'split_column', { column: 'kodnamn', delimiter: ' ', parts: 2 });
    const names = (await datasets.columns(id)).map((c) => c.name);
    assert.ok(names.includes('kodnamn_1') && names.includes('kodnamn_2'), names.join(','));
    await recipes.apply(id, 'drop_columns', { columns: ['kodnamn', 'kodnamn_1', 'kodnamn_2'] });
    const rows = await datasets.query(id, { withRowId: true, limit: 1 });
    await recipes.apply(id, 'edit_cell', { rowid: rows[0][0], column: 'kommun', value: 'Stockholms stad' });
    assert.equal((await datasets.query(id, { limit: 1 }))[0][0], 'Stockholms stad');
    await recipes.apply(id, 'delete_rows', { where: "kommun = 'Malmö'" });
    assert.equal(await datasets.count(id), 2);
    await recipes.apply(id, 'pivot_longer', { columns: ['befolkning', 'tusen'], namesTo: 'matt', valuesTo: 'varde' });
    assert.equal(await datasets.count(id), 4);
    assert.deepEqual((await datasets.columns(id)).map((c) => c.name), ['kommun', 'kod', 'andel', 'datum', 'matt', 'varde']);
    await recipes.apply(id, 'pivot_wider', { names: 'matt', values: 'varde' });
    assert.equal(await datasets.count(id), 2);
    assert.ok((await datasets.columns(id)).some((c) => c.name === 'befolkning'), 'wide again');
    await recipes.apply(id, 'sql', { statement: "update data set kommun = upper(kommun) where kod = '1480'" });
    assert.ok((await datasets.query(id)).some((r) => r[0] === 'GöTEBORG' || r[0] === 'GÖTEBORG'));
  }, 60000);

  test('versions, derived datasets (aggregate, join, append), clusters and profile', async (assert) => {
    const v = await datasets.snapshot(id, 'Före test');
    assert.equal(v.n, 1);
    await recipes.apply(id, 'delete_rows', { where: '1 = 1' });
    assert.equal(await datasets.count(id), 0);
    const cmp = await datasets.compareVersion(id, 1);
    assert.equal(cmp.rowsThen, 2); assert.equal(cmp.rowsNow, 0);
    await datasets.restoreVersion(id, 1);
    assert.equal(await datasets.count(id), 2, 'restored');
    const agg = await derive.aggregate(id, { groupBy: ['datum'], aggregations: [{ column: 'befolkning', fn: 'sum', as: 'summa' }, { fn: 'count', as: 'antal' }], name: 'Agg' });
    created.push(agg.id);
    const aggRows = await datasets.query(agg.id);
    assert.equal(aggRows.length, 1); assert.equal(aggRows[0][2], 2);
    const lookup = await importer.runText('kod\tlan\n0180\tStockholm\n1480\tVästra Götaland\n', {}, null, 'Lan');
    created.push(lookup.id);
    const joined = await derive.join(id, lookup.id, { keys: [['kod', 'kod']], type: 'left', name: 'Kopplad' });
    created.push(joined.id);
    const jcols = (await datasets.columns(joined.id)).map((c) => c.name);
    assert.ok(jcols.includes('lan'), jcols.join(','));
    assert.deepEqual((await datasets.query(joined.id, { orderBy: 'kod' })).map((r) => r[r.length - 1]), ['Stockholm', 'Västra Götaland']);
    const appended = await derive.append([id, id], 'Dubbel');
    created.push(appended.id);
    assert.equal(await datasets.count(appended.id), 4);
    const cl = await importer.runText('ort\nUmeå\numeå\nUMEÅ \nLuleå\nLuleå\n', {}, null, 'Kluster');
    created.push(cl.id);
    const clusters = await derive.clusters(cl.id, 'ort');
    assert.equal(clusters.length, 1); assert.equal(clusters[0].values.length, 3); assert.equal(clusters[0].total, 3);
    const prof = await profile.profile(cl.id);
    assert.equal(prof.rows, 5); assert.equal(prof.duplicates, 1);
    const ort = prof.columns[0];
    assert.ok(ort.warnings.some((w) => w.kind === 'whitespace') && ort.warnings.some((w) => w.kind === 'case_variants'), JSON.stringify(ort.warnings));
  }, 60000);

  test('operations: cleanup', async (assert) => {
    for (const x of created) await datasets.remove(x);
    assert.ok(true);
  });
})();
