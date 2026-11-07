// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Visualisera: theme from tokens, the Vega-Lite builder, chart data with SQL aggregation,
 * headless Vega rendering, D3 templates, export helpers (SVG, PNG, PDF), saved charts and viz files,
 * batch generation to ZIP, workspace backup with charts, and the Visualisera UI.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const theme = D.require('viz/theme');
  const builder = D.require('viz/vega-builder');
  const vizData = D.require('viz/data');
  const vegaRender = D.require('viz/vega-render');
  const d3t = D.require('viz/d3-templates');
  const vizExport = D.require('viz/export');
  const charts = D.require('viz/charts');
  const render = D.require('viz/render');
  const batch = D.require('viz/batch');
  const zip = D.require('platform/storage/zip');
  const t = D.require('ui/i18n').t;
  const created = []; const chartIds = [];
  let id = null; let columns = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { if (fn()) return; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const CSV = 'kommun;lan;ar;befolkning;kon\nStockholm;Stockholms län;2023;984748;T\nGöteborg;Västra Götalands län;2023;596841;T\nMalmö;Skåne län;2023;362133;T\nStockholm;Stockholms län;2024;995574;T\nGöteborg;Västra Götalands län;2024;608993;T\nMalmö;Skåne län;2024;365644;T\n';

  test('viz: theme config, locale and colour helpers come from the design tokens', (assert) => {
    const cfg = theme.vegaConfig();
    assert.equal(cfg.range.category.length, 8);
    assert.ok(/^#[0-9a-f]{6}$/i.test(cfg.range.category[0]), 'palette colour ' + cfg.range.category[0]);
    assert.ok(String(cfg.font).includes('Inter'));
    assert.equal(cfg.range.heatmap.scheme, 'dataspatium-seq');
    assert.equal(theme.interpolateHex('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(theme.diverging('#ff0000', '#ffffff', '#0000ff')(0), '#ff0000');
    const style = theme.d3Style();
    assert.ok(style.palette.length === 8 && style.text && style.background);
    const locale = D.require('viz/locale');
    assert.equal(locale.numberLocale.decimal, ','); assert.equal(locale.timeLocale.months[0], 'januari');
  });

  test('viz: test dataset', async () => {
    const meta = await importer.run(new File([CSV], 'viz.csv'), {}, [
      { name: 'kommun', type: 'text', include: true }, { name: 'lan', type: 'text', include: true }, { name: 'ar', type: 'integer', include: true },
      { name: 'befolkning', type: 'integer', include: true }, { name: 'kon', type: 'text', include: true }], 'Viztest');
    id = meta.id; created.push(id);
    columns = await datasets.columns(id);
    return columns.map((c) => c.name + ':' + c.type).join(',');
  });

  test('viz: builder defaults, specs, type switching and data requests', (assert) => {
    const st = builder.defaultState('bar', columns);
    assert.equal(st.x.field, 'kommun'); assert.equal(st.y.field, 'befolkning', 'year column is not the default measure'); assert.equal(st.y.aggregate, 'sum');
    const spec = builder.toSpec(st, columns, { values: [] });
    assert.equal(spec.mark.type, 'bar'); assert.equal(spec.encoding.x.field, 'kommun'); assert.equal(spec.encoding.y.aggregate, 'sum'); assert.equal(spec.encoding.x.sort, '-y');
    const line = builder.defaultState('line', columns);
    assert.equal(line.x.field, 'ar'); assert.equal(line.x.type, 'ordinal', 'year on a line chart is ordinal');
    const hist = builder.defaultState('histogram', columns);
    assert.ok(hist.x.bin && hist.y.aggregate === 'count' && !hist.y.field);
    const hspec = builder.toSpec(hist, columns, { values: [] });
    assert.ok(hspec.encoding.x.bin && hspec.encoding.y.aggregate === 'count' && !hspec.encoding.y.field, JSON.stringify(hspec.encoding));
    const pie = builder.toSpec(builder.defaultState('pie', columns), columns, { values: [] });
    assert.equal(pie.mark.type, 'arc'); assert.ok(pie.encoding.theta && pie.encoding.color);
    const heat = builder.defaultState('heatmap', columns);
    assert.ok(heat.color && heat.color.field === 'befolkning');
    const raw = builder.dataRequest(st, columns, 6);
    assert.ok(!raw.aggregates && raw.fields.includes('befolkning') && raw.fields.includes('kommun'));
    const big = builder.dataRequest(st, columns, 1000000);
    assert.deepEqual(big.groupBy, ['kommun']); assert.equal(big.aggregates[0].as, 'sum_befolkning'); assert.equal(big.aliases.y, 'sum_befolkning');
    const aggSpec = builder.toSpec(st, columns, { values: [], aliases: big.aliases });
    assert.equal(aggSpec.encoding.y.field, 'sum_befolkning'); assert.ok(!aggSpec.encoding.y.aggregate, 'pre-aggregated data keeps no aggregate');
    assert.equal(builder.validate(Object.assign({}, st, { x: null })).length, 1);
    const sw = builder.switchType(st, 'barh', columns);
    assert.equal(sw.x.field, 'kommun'); assert.equal(builder.toSpec(sw, columns, { values: [] }).encoding.y.field, 'kommun', 'horizontal swaps axes');
    const byValue = Object.assign({}, sw, { x: Object.assign({}, sw.x, { sort: '-y' }) });
    assert.equal(builder.toSpec(byValue, columns, { values: [] }).encoding.y.sort, '-x', 'sorting by value follows the value axis in horizontal bars');
    assert.equal(builder.toSpec(Object.assign({}, st, { x: Object.assign({}, st.x, { sort: '-y' }) }), columns, { values: [] }).encoding.x.sort, '-y', 'vertical bars keep -y');
    const stacked = Object.assign({}, st, { color: builder.channel(columns.find((c) => c.name === 'lan')), stack: 'normalize' });
    assert.equal(builder.toSpec(stacked, columns, { values: [] }).encoding.y.stack, 'normalize');
    const labelled = Object.assign({}, st, { labels: true });
    assert.ok(builder.toSpec(labelled, columns, { values: [] }).layer.length === 2, 'value labels add a text layer');
  });

  test('viz: axis limits, scales, label angle, gridlines, opacity, reference and trend lines', (assert) => {
    const bar = Object.assign(builder.defaultState('bar', columns), { yMin: 100, yMax: 1000, yScale: 'log', labelAngle: -45, grid: false });
    const spec = builder.toSpec(bar, columns, { values: [] });
    assert.deepEqual(spec.encoding.y.scale, { domainMin: 100, domainMax: 1000, type: 'log', zero: false }, 'limits and a log scale without zero');
    assert.equal(spec.encoding.x.axis.labelAngle, -45);
    assert.equal(spec.encoding.y.axis.grid, false);
    assert.equal(spec.mark.clip, true, 'bars outside the limits are clipped');
    const zeroOff = builder.toSpec(Object.assign(builder.defaultState('line', columns), { yZero: false }), columns, { values: [] });
    assert.equal(zeroOff.encoding.y.scale.zero, false);
    const withRef = builder.toSpec(Object.assign({}, bar, { refValue: 500, refLabel: 'Mål' }), columns, { values: [] });
    assert.ok(Array.isArray(withRef.layer) && !withRef.encoding && !withRef.mark, 'the layers carry the encodings');
    assert.equal(withRef.layer[0].encoding.x.field, bar.x.field, 'the bars keep their encoding');
    assert.deepEqual([withRef.layer[1].mark.type, withRef.layer[1].encoding.y.datum], ['rule', 500]);
    assert.equal(withRef.layer[2].encoding.text.value, 'Mål');
    const labelled = builder.toSpec(Object.assign({}, bar, { labels: true, refValue: 500 }), columns, { values: [] });
    assert.equal(labelled.layer.length, 3, 'bars, value labels and the reference line');
    const ar = columns.find((c) => c.name === 'ar'); const bef = columns.find((c) => c.name === 'befolkning');
    const scatter = Object.assign(builder.defaultState('point', columns), { x: builder.channel(ar, { type: 'quantitative' }), y: builder.channel(bef), trend: 'linear', opacity: 0.4, xMin: 2020 });
    const ss = builder.toSpec(scatter, columns, { values: [] });
    const trend = ss.layer.find((l) => l.transform);
    assert.deepEqual(trend.transform[0], { regression: 'befolkning', on: 'ar', method: 'linear' });
    assert.equal(ss.layer[0].mark.opacity, 0.4);
    assert.equal(ss.layer[0].encoding.x.scale.domainMin, 2020);
    const loess = builder.toSpec(Object.assign({}, scatter, { trend: 'loess' }), columns, { values: [] });
    assert.equal(loess.layer.find((l) => l.transform).transform[0].loess, 'befolkning');
    const barh = Object.assign(builder.switchType(bar, 'barh', columns), { yMax: 50, refValue: 10 });
    const hs = builder.toSpec(barh, columns, { values: [] });
    assert.equal(hs.layer[0].encoding.x.scale.domainMax, 50, 'horizontal bars: the value axis is x');
    assert.equal(hs.layer[1].encoding.x.datum, 10);
    return 'ok';
  });

  test('viz: chart data with filters, SQL aggregation and distinct values', async (assert) => {
    const raw = await vizData.fetchRows(id, { fields: ['kommun', 'befolkning'], filters: [{ field: 'ar', op: '=', value: '2024' }] });
    assert.equal(raw.rows.length, 3); assert.equal(raw.total, 3); assert.deepEqual(Object.keys(raw.rows[0]), ['kommun', 'befolkning']);
    const agg = await vizData.fetchRows(id, { groupBy: ['kommun'], aggregates: [{ field: 'befolkning', fn: 'sum', as: 'sum_befolkning' }, { field: null, fn: 'count', as: 'antal' }] });
    assert.equal(agg.rows.length, 3); assert.ok(agg.aggregated);
    const sthlm = agg.rows.find((r) => r.kommun === 'Stockholm');
    assert.equal(sthlm.sum_befolkning, 984748 + 995574); assert.equal(sthlm.antal, 2);
    assert.equal((await vizData.fetchRows(id, { filters: [{ field: 'lan', op: 'contains', value: 'Skåne' }] })).rows.length, 2);
    assert.equal((await vizData.fetchRows(id, { filters: [{ field: 'kommun', op: 'in', value: 'Malmö, Göteborg' }] })).rows.length, 4);
    assert.equal((await vizData.fetchRows(id, { filters: [{ field: 'befolkning', op: '>=', value: '600000' }] })).rows.length, 3);
    assert.deepEqual(await vizData.distinctValues(id, 'kommun'), ['Göteborg', 'Malmö', 'Stockholm']);
  });

  test('viz: Vega-Lite renders headless to SVG and PNG with the palette and Swedish numbers', async (assert) => {
    const st = builder.defaultState('bar', columns); st.title = 'Testdiagram'; st.yFormat = ',.0f';
    const data = await vizData.fetchRows(id, builder.dataRequest(st, columns, 6));
    const spec = builder.toSpec(st, columns, { values: data.rows, width: 400, height: 200 });
    const view = await vegaRender.headless(spec, { width: 400 });
    const svg = await vegaRender.toSvg(view);
    assert.ok(svg.startsWith('<svg') && svg.includes('Testdiagram'), 'svg with title');
    assert.ok(svg.includes('Stockholm') && svg.includes('Göteborg'), 'category labels');
    assert.ok(svg.includes(' '), 'Swedish thousands separator (narrow space) in axis labels');
    assert.ok(svg.toLowerCase().includes(theme.tokens().palette[0].toLowerCase()), 'first palette colour used');
    const png = await vegaRender.toPng(view, 1);
    assert.equal(png.type, 'image/png'); assert.ok(png.size > 1000, 'png bytes ' + png.size);
    // Axis limits, a reference line with text and a trend line render as well.
    const guided = Object.assign(builder.defaultState('bar', columns), { yMax: 2000000, refValue: 500000, refLabel: 'Referensvärde', labelAngle: -45 });
    const gData = await vizData.fetchRows(id, builder.dataRequest(guided, columns, 6));
    const gSvg = await vegaRender.toSvg(await vegaRender.headless(builder.toSpec(guided, columns, { values: gData.rows, width: 400, height: 200 }), { width: 400 }));
    assert.ok(gSvg.includes('Referensvärde'), 'reference text');
    assert.ok(gSvg.replace(/[  ]/g, ' ').includes('2 000 000'), 'the axis reaches its maximum');
    const ar = columns.find((c) => c.name === 'ar'); const bef = columns.find((c) => c.name === 'befolkning');
    const scatter = Object.assign(builder.defaultState('point', columns), { x: builder.channel(ar, { type: 'quantitative' }), y: builder.channel(bef), trend: 'linear' });
    const sData = await vizData.fetchRows(id, builder.dataRequest(scatter, columns, 6));
    const sSvg = await vegaRender.toSvg(await vegaRender.headless(builder.toSpec(scatter, columns, { values: sData.rows, width: 400, height: 200 }), { width: 400 }));
    assert.ok((sSvg.match(/stroke-dasharray/g) || []).length >= 1, 'a dashed trend line is drawn');
    const heat = builder.defaultState('heatmap', columns);
    const hdata = await vizData.fetchRows(id, builder.dataRequest(heat, columns, 6));
    const hsvg = await vegaRender.toSvg(await vegaRender.headless(builder.toSpec(heat, columns, { values: hdata.rows, width: 300, height: 200 }), { width: 300 }));
    assert.ok(hsvg.includes('<rect') || hsvg.includes('<path'), 'heatmap marks');
  }, 30000);

  test('viz: D3 templates render SVG from rows', async (assert) => {
    const holder = document.createElement('div');
    const data = await vizData.fetchRows(id, { fields: ['kommun', 'befolkning', 'ar', 'kon'] });
    const svg = await d3t.render('lollipop', holder, data.rows, { category: 'kommun', value: 'befolkning', aggregate: 'sum', top: 10, order: 'desc', format: ',.0f', title: 'Rangordning' }, { width: 600 });
    assert.equal(svg.tagName.toLowerCase(), 'svg'); assert.equal(svg.querySelectorAll('circle').length, 3);
    const text = d3t.svgString(svg);
    assert.ok(text.includes('Stockholm') && text.includes('xmlns="http://www.w3.org/2000/svg"') && text.includes('Rangordning'));
    const slope = await d3t.render('slopegraph', holder, data.rows, { category: 'kommun', period: 'ar', from: '2023', to: '2024', value: 'befolkning', top: 10, format: ',.0f' }, { width: 600 });
    assert.equal(slope.querySelectorAll('line').length, 3, 'one slope per municipality');
    const rows = data.rows.map((r) => Object.assign({}, r, { kon: r.ar === 2023 ? 'K' : 'M' }));
    const pyr = await d3t.render('pyramid', holder, rows, { group: 'kommun', side: 'kon', value: 'befolkning', left: 'K', right: 'M', format: '~s' }, { width: 600 });
    assert.equal(pyr.querySelectorAll('rect').length, 7, 'background plus two bars per group');
    let missing = '';
    try { await d3t.render('lollipop', holder, data.rows, { category: 'kommun' }, {}); } catch (err) { missing = err.message; }
    assert.ok(missing.includes('Fyll i'), missing);
  }, 20000);

  test('viz: export helpers produce SVG with fonts, PNG and PDF', async (assert) => {
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#0072b2"/><text x="10" y="50" font-family="Inter" fill="#fff">Hej åäö</text></svg>';
    assert.deepEqual(vizExport.svgSize(svgText), { width: 200, height: 100 });
    const withFonts = await vizExport.svgWithFonts(svgText);
    assert.ok(withFonts.includes('@font-face') && withFonts.includes('data:font/woff2;base64,'), 'Inter embedded');
    const png = await vizExport.svgToPng(svgText, { scale: 1 });
    assert.equal(png.type, 'image/png'); assert.ok(png.size > 200, 'png bytes ' + png.size);
    const pdf = await vizExport.svgToPdf(svgText, { title: 'Test' });
    assert.equal(pdf.type, 'application/pdf'); assert.ok(pdf.size > 500, 'pdf bytes ' + pdf.size);
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer())), '%PDF-');
  }, 30000);

  test('viz: saved charts, viz files, rendering by chart, thumbnails, batch ZIP and backup', async (assert) => {
    const ds = await datasets.get(id);
    const chart = charts.create('vega', ds, 'Befolkning per kommun');
    chart.vega.state = builder.defaultState('bar', columns);
    const saved = await charts.save(chart); chartIds.push(saved.id);
    assert.ok(saved.id && (await charts.list()).some((c) => c.id === saved.id));
    const json = charts.exportJson(saved);
    assert.ok(json.includes('"format": "dataspatium-viz/1"') && !json.includes('thumbnail'), 'viz file');
    const imported = await charts.importJson(json); chartIds.push(imported.id);
    assert.equal(imported.datasetId, id, 'dataset matched by name');
    const blob = await render.toBlob(saved, 'svg', { width: 500 });
    assert.equal(blob.type.split(';')[0], 'image/svg+xml'); assert.ok((await blob.text()).includes('<svg'));
    const pdf = await render.toBlob(saved, 'pdf', { width: 500 });
    assert.equal(pdf.type, 'application/pdf');
    const thumb = await render.thumbnail(saved);
    assert.ok(thumb && thumb.startsWith('data:image/png'), 'thumbnail');
    const d3chart = charts.create('d3', ds, 'Rangordning');
    d3chart.d3 = { template: 'lollipop', params: { category: 'kommun', value: 'befolkning', aggregate: 'sum', top: 10, order: 'desc', format: ',.0f' } };
    const savedD3 = await charts.save(d3chart); chartIds.push(savedD3.id);
    assert.equal((await render.toBlob(savedD3, 'png', { width: 500, scale: 1 })).type, 'image/png');
    const result = await batch.run(saved, { groupColumn: 'kommun', formats: ['svg', 'png'], pattern: '{diagram}-{grupp}', width: 400 });
    assert.equal(result.count, 6);
    const entries = await zip.readZip(result.blob);
    assert.equal(Object.keys(entries).length, 7, 'six charts plus manifest');
    assert.ok(Object.keys(entries).some((n) => n.includes('Stockholm') && n.endsWith('.svg')), Object.keys(entries).join(','));
    assert.equal(JSON.parse(zip.text(entries['manifest.json'])).groups, 3);
    const bk = await D.require('data/workspace').backup();
    assert.ok(bk.charts >= 3, 'backup counts charts: ' + bk.charts);
    const files = await zip.readZip(bk.blob);
    assert.ok(Object.keys(files).some((n) => n.startsWith('charts/') && n.endsWith('.viz.json')), 'charts in backup');
    await charts.remove(imported.id);
    assert.ok(!(await charts.list()).some((c) => c.id === imported.id));
    return `${result.count} files in batch ZIP`;
  }, 60000);

  test('app: Visualisera builds and saves a chart, shows it in the gallery and lists it in Exportera', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const button = (scope, label) => Array.from(root.querySelectorAll(scope + ' dm-button')).find((b) => b.getAttribute('label') === label);
    let savedId = null;
    try {
      const shell = await D.require('app').start(root);
      shell.store.set({ selectedId: id });
      shell.activate('visualisera');
      await waitFor(() => root.querySelector('.dm-gallery, dm-empty-state'), 5000, 'gallery');
      button('.dm-left', t('viz.new')).querySelector('button').click();
      await waitFor(() => document.querySelector('dialog .dm-op-tile[data-kind="vega"]'), 3000, 'kind dialog');
      /** @type {HTMLElement} */ (document.querySelector('dialog .dm-op-tile[data-kind="vega"]')).click();
      await waitFor(() => root.querySelector('.dm-viz-controls'), 5000, 'builder controls');
      await waitFor(() => root.querySelector('.dm-chart-preview canvas'), 20000, 'vega preview');
      const tileFor = (label) => Array.from(root.querySelectorAll('.dm-viz-type')).find((b) => b.textContent.includes(label));
      /** @type {HTMLElement} */ (tileFor('Linje')).click();
      // The controls re-render on a type switch, so query the tile again instead of keeping the old element.
      await waitFor(() => tileFor('Linje') && tileFor('Linje').getAttribute('aria-checked') === 'true', 3000, 'type switched');
      await waitFor(() => root.querySelector('.dm-chart-preview canvas'), 20000, 'line preview');
      const nameInput = /** @type {any} */ (root.querySelector('.dm-page-head h1 dm-input'));
      nameInput.value = 'UI-diagram'; nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      button('.dm-page-head', t('viz.save')).querySelector('button').click();
      let list = [];
      for (let i = 0; i < 100; i++) { list = await charts.list(); if (list.some((c) => c.name === 'UI-diagram')) break; await wait(100); }
      const saved = list.find((c) => c.name === 'UI-diagram');
      assert.ok(saved, 'chart saved'); savedId = saved.id; chartIds.push(saved.id);
      assert.equal(saved.kind, 'vega'); assert.equal(saved.vega.state.type, 'line'); assert.ok(saved.thumbnail, 'thumbnail stored');
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-left .dm-list-item')).find((b) => b.textContent.includes(t('viz.gallery')))).click();
      await waitFor(() => root.querySelector('.dm-gallery-card'), 5000, 'gallery cards');
      await waitFor(() => Array.from(root.querySelectorAll('.dm-gallery-card')).some((c) => c.textContent.includes('UI-diagram')), 5000, 'chart in gallery');
      shell.activate('exportera');
      await waitFor(() => root.querySelectorAll('dm-tabs [role="tab"]').length === 3, 5000, 'export tabs');
      /** @type {HTMLElement} */ (root.querySelectorAll('dm-tabs [role="tab"]')[1]).click();
      await waitFor(() => Array.from(root.querySelectorAll('.dm-list-item')).some((b) => b.textContent.includes('UI-diagram')), 5000, 'chart listed in Exportera');
      return 'ok';
    } finally {
      for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 60000);

  test('viz: cleanup', async () => {
    for (const cid of chartIds) { try { await charts.remove(cid); } catch (_e) { /* ignore */ } }
    for (const did of created) { try { await datasets.remove(did); } catch (_e) { /* ignore */ } }
    return `${chartIds.length} charts, ${created.length} datasets removed`;
  });
})();
