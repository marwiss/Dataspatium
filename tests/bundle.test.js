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

  test('bundle: cleanup', async (assert) => {
    for (const id of chartIds) { try { await charts.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
