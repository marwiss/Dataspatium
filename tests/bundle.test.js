// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for sharing bundles: selective export and restore that skips what already exists. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const charts = D.require('viz/charts');
  const builder = D.require('viz/vega-builder');
  const workspace = D.require('data/workspace');
  const zip = D.require('platform/storage/zip');
  const created = []; const chartIds = [];

  test('bundle: a package holds the chosen datasets and objects; restoring skips what exists and brings back what is missing', async (assert) => {
    const a = await importer.run(new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\n'], 'a.csv'), {}, null, 'Paket A');
    const b = await importer.run(new File(['x;y\n1;2\n'], 'b.csv'), {}, null, 'Paket B');
    created.push(a.id, b.id);
    const chart = charts.create('vega', a, 'Paketdiagram');
    chart.vega.state = builder.defaultState('bar', await datasets.columns(a.id));
    const savedChart = await charts.save(chart);
    chartIds.push(savedChart.id);
    const res = await workspace.bundle({ name: 'Testpaket', datasetIds: [a.id], include: { charts: true, dashboards: false, documents: false, notebooks: false } });
    assert.equal(res.counts.datasets, 1);
    const entries = await zip.readZip(res.blob);
    const paths = Object.keys(entries);
    assert.ok(paths.includes(`datasets/${a.id}.sqlite`), 'chosen dataset included');
    assert.ok(!paths.includes(`datasets/${b.id}.sqlite`), 'other dataset left out');
    assert.ok(paths.includes(`charts/${savedChart.id}.viz.json`), 'chart included');
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    assert.equal(manifest.kind, 'bundle');
    assert.equal(manifest.name, 'Testpaket');
    assert.equal(manifest.datasets.length, 1, 'manifest lists only the chosen dataset');
    // Restoring into the same workspace: everything exists already.
    const r1 = await workspace.restore(res.blob);
    assert.equal(r1.imported.length, 0, 'no duplicate dataset');
    assert.equal(r1.charts.length, 0, 'no duplicate chart');
    assert.ok(r1.existing >= 2, 'existing counted: ' + r1.existing);
    // After deleting the dataset and the chart, the package brings both back with the same dataset id.
    await datasets.remove(a.id); created.splice(created.indexOf(a.id), 1);
    await charts.remove(savedChart.id); chartIds.splice(chartIds.indexOf(savedChart.id), 1);
    const r2 = await workspace.restore(res.blob);
    assert.equal(r2.imported.length, 1);
    assert.equal(r2.imported[0].id, a.id, 'same dataset id as before');
    created.push(a.id);
    assert.equal(r2.charts.length, 1);
    chartIds.push(r2.charts[0].id);
    assert.equal(r2.charts[0].datasetId, a.id, 'chart re-linked to the dataset by name');
    assert.equal((await datasets.query(a.id)).length, 2);
    return paths.join(', ');
  }, 60000);

  test('bundle: charts and notebooks of datasets that are not chosen stay behind', async (assert) => {
    const notebooks = D.require('analysis/notebooks');
    const a = await importer.run(new File(['ort;antal\nUmeå;3\n'], 'valt.csv'), {}, null, 'Valt paket');
    const b = await importer.run(new File(['ort;antal\nLuleå;4\n'], 'annat.csv'), {}, null, 'Annat paket');
    created.push(a.id, b.id);
    const mine = await charts.save(Object.assign(charts.create('vega', a, 'Valt diagram'), {}));
    const theirs = await charts.save(Object.assign(charts.create('vega', b, 'Annat diagram'), {}));
    chartIds.push(mine.id, theirs.id);
    const book = await notebooks.save(notebooks.create('Annan bok', await datasets.get(b.id)));
    try {
      const res = await workspace.bundle({ name: 'Avgränsat', datasetIds: [a.id], include: { charts: true, dashboards: true, documents: false, notebooks: true, scripts: false } });
      const paths = Object.keys(await zip.readZip(res.blob));
      assert.ok(paths.includes(`charts/${mine.id}.viz.json`), 'the chart of the chosen dataset');
      assert.ok(!paths.includes(`charts/${theirs.id}.viz.json`), 'not the chart of the other one');
      assert.ok(!paths.includes(`notebooks/${book.id}.nb.json`), 'not the notebook of the other one');
      return 'ok';
    } finally { await notebooks.remove(book.id).catch(() => {}); }
  });

  test('bundle: the review finds identity numbers and phone numbers, and only the copy in the package changes', async (assert) => {
    const review = D.require('ui/share/review');
    const { SqliteEngine } = D.require('engines/sqlite');
    const csv = 'namn;personnummer;anteckning\nAnna;19121212-1212;Ring 070-123 45 67\nBo;19640823-3234;Inget att säga\n';
    const a = await importer.run(new File([csv], 'personer.csv'), {}, null, 'Personer');
    created.push(a.id);
    // The dialog answered at once with what it proposes: the identity number hashed, the phone number masked.
    const ctx = { store: { get: () => ({ datasets: [{ id: a.id, name: 'Personer' }] }) }, ui: { dialog: { open: async () => true } } };
    const checked = await review.review(ctx, [a.id], { include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false } });
    const tr = checked.transform[a.id];
    assert.ok(tr && tr.hash.includes('personnummer'), 'the identity number is hashed: ' + JSON.stringify(tr));
    assert.ok(tr.mask.includes('anteckning'), 'the phone number in the note is masked');
    const res = await workspace.bundle({ name: 'Granskat', datasetIds: [a.id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false }, transform: checked.transform, extras: checked.extras });
    const entries = await zip.readZip(res.blob);
    const engine = new SqliteEngine(); await engine.start(); await engine.open(entries[`datasets/${a.id}.sqlite`].slice().buffer);
    try {
      const rows = (await engine.exec('select personnummer, anteckning from data order by rowid'))[0].values;
      assert.ok(rows.every((r) => !String(r[0]).includes('1212') && !String(r[0]).includes('3234')), 'no identity number in the copy: ' + JSON.stringify(rows));
      assert.ok(String(rows[0][1]).includes('[***]') && !String(rows[0][1]).includes('070'), 'the phone number masked: ' + rows[0][1]);
      assert.equal(String(rows[1][1]), 'Inget att säga', 'other text untouched');
    } finally { engine.terminate(); }
    const own = await datasets.query(a.id);
    assert.ok(String(own[0][1]).includes('1212') && String(own[0][2]).includes('070'), 'the dataset itself is unchanged');
    assert.ok(review.summary(checked.transform), 'a line for the log');
    return 'ok';
  }, 60000);

  test('bundle: cleanup', async (assert) => {
    for (const id of chartIds) { try { await charts.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
