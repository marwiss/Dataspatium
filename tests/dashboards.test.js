// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for dashboards (model, shared filters, live view, HTML/JSON/PowerPoint export) and the workspace files. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const charts = D.require('viz/charts');
  const dashboards = D.require('viz/dashboards');
  const dashboardView = D.require('ui/viz/dashboard-view');
  const builder = D.require('viz/vega-builder');
  const render = D.require('viz/render');
  const workspace = D.require('data/workspace');
  const zip = D.require('platform/storage/zip');
  const created = []; const chartIds = []; const dashIds = [];
  function waitFor(fn, ms, what) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      (function tick() { let v; try { v = fn(); } catch (_e) { v = null; } if (v) return resolve(v); if (performance.now() - t0 > ms) return reject(new Error('timeout: ' + what)); setTimeout(tick, 100); })();
    });
  }

  test('dashboards: charts, shared filters, live view, exports and workspace files', async (assert) => {
    const csv = 'kommun;lan;ar;befolkning\nStockholm;Stockholms län;2023;980000\nStockholm;Stockholms län;2024;984748\nMalmö;Skåne län;2023;360000\nMalmö;Skåne län;2024;362133\nLund;Skåne län;2023;128000\nLund;Skåne län;2024;130000\n';
    const meta = await importer.run(new File([csv], 'dash.csv', { type: 'text/csv' }), {}, null, 'Dashboardtest');
    created.push(meta.id);
    const columns = await datasets.columns(meta.id);
    const c1 = charts.create('vega', meta, 'Befolkning per kommun'); c1.vega.state = builder.defaultState('bar', columns);
    const c2 = charts.create('vega', meta, 'Befolkning per år'); c2.vega.state = builder.defaultState('line', columns);
    const s1 = await charts.save(c1); const s2 = await charts.save(c2);
    chartIds.push(s1.id, s2.id);
    let dash = await dashboards.save(Object.assign(dashboards.create('Testpanel'), { items: [{ chartId: s1.id, span: 2 }, { chartId: s2.id, span: 1 }], filters: [{ column: 'lan' }] }));
    dashIds.push(dash.id);
    assert.equal(dash.columns, 2);
    assert.ok((await dashboards.list()).some((d) => d.id === dash.id), 'listed');
    const shared = await dashboards.sharedColumns(dash);
    assert.ok(shared.some((c) => c.name === 'lan') && shared.some((c) => c.name === 'kommun') && shared.some((c) => c.name === 'ar'), JSON.stringify(shared));
    assert.deepEqual(dashboards.toExtraFilters({ lan: 'Skåne län', kommun: '' }), [{ field: 'lan', op: '=', value: 'Skåne län' }]);

    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; width:1200px;';
    document.body.appendChild(host);
    const view = dashboardView.create({ dashboard: dash, onOpenChart: () => {}, onDeleted: () => {}, log: () => {} });
    host.appendChild(view.el);
    try {
      await view.start();
      await waitFor(() => view.rendered() === 2, 20000, 'two charts rendered');
      assert.equal(host.querySelectorAll('.dm-dashboard-filters dm-select').length, 1, 'one filter select');
      assert.equal(host.querySelectorAll('.dm-dashboard-grid article').length, 2);
      view.setFilter('lan', 'Skåne län');
      await waitFor(() => view.rendered() === 2, 20000, 're-rendered with the filter');
      assert.deepEqual(view.filters(), [{ field: 'lan', op: '=', value: 'Skåne län' }]);
      const prep = await render.prepareVega(s1, { extraFilters: view.filters() });
      assert.equal(prep.data.rows.length, 4, 'only the four Skåne rows reach the chart: ' + JSON.stringify(prep.data.rows));
      assert.ok(prep.data.rows.every((r) => r.kommun === 'Malmö' || r.kommun === 'Lund'), 'filter applied to the rows');
      assert.ok(view.inspector().length >= 4, 'inspector nodes');
    } finally { view.destroy(); host.remove(); }

    const html = await (await dashboards.toHtml(dash, { extraFilters: [{ field: 'lan', op: '=', value: 'Skåne län' }], generatedText: 'Test', filtersLabel: 'Filter:' })).text();
    assert.ok(html.includes('<title>Testpanel</title>'), 'title');
    assert.equal((html.match(/<svg/g) || []).length, 2, 'two inline svgs');
    assert.ok(html.includes('Filter: lan = Skåne län'), 'filters in the meta line');

    const json = await dashboards.exportJson(dash);
    const parsed = JSON.parse(json);
    assert.equal(parsed.format, 'dataspatium-dash/1');
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0].chart.format, 'dataspatium-viz/1');
    await charts.remove(s2.id); chartIds.splice(chartIds.indexOf(s2.id), 1);
    const imported = await dashboards.importJson(json);
    dashIds.push(imported.id);
    assert.equal(imported.items.length, 2);
    const recreated = (await charts.list()).find((c) => c.name === 'Befolkning per år');
    assert.ok(recreated, 'the missing chart is recreated from the file');
    chartIds.push(recreated.id);
    assert.equal(imported.items[0].chartId, s1.id, 'the existing chart is matched by name');

    const deck = await dashboards.toPptx(imported, {});
    assert.equal(deck.count, 2);
    assert.ok(deck.blob.size > 10000, 'pptx size ' + deck.blob.size);
    const entries = await zip.readZip(deck.blob);
    const slides = Object.keys(entries).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
    assert.equal(slides.length, 3, 'title slide + two charts: ' + slides.join(','));
    assert.ok(Object.keys(entries).some((p) => /^ppt\/media\/image/.test(p)), 'images embedded');
    assert.ok(Object.keys(entries).includes('[Content_Types].xml'));

    const { files } = await workspace.collect({ datasetIds: [] });
    assert.ok(files[`dashboards/${imported.id}.dash.json`], 'dashboard file in the workspace');
    return `${slides.length} slides, ${deck.blob.size} bytes`;
  }, 120000);

  test('dashboards: cleanup', async (assert) => {
    for (const id of dashIds) { try { await dashboards.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of chartIds) { try { await charts.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
