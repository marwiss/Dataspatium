// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Visualisera following the kind of dataset: suggestions drawn for real, filters across a dashboard's charts and
 * tags for a dataset's own picture in document templates. No network: maps draw without a background map.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const suggest = D.require('viz/suggest');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function make(name, columns, rows, extra = {}) {
    const meta = await datasets.create(Object.assign({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows }, extra));
    created.push(meta.id);
    return meta;
  }
  const track = (meta) => { created.push(meta.id); return meta; };
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  const button = (root, text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button')).click();
  const NET = () => ({
    directed: true,
    nodes: ['a', 'b', 'c'].map((id) => ({ id, labels: ['X'], name: id, properties: {} })),
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'K', properties: {} }, { id: 'e2', source: 'b', target: 'c', type: 'L', properties: {} }],
  });
  const keysOf = (list) => list.map((x) => x.key);

  test('suggestions: each kind gets what fits, and each one really draws', async (assert) => {
    const fixtures = D.require('tests/fixtures/ifc');
    const series = await make('Förslag serie', [['ar', 'integer'], ['tal', 'number']], [[2020, 1], [2021, 2], [2022, 4]]);
    const groups = await make('Förslag grupper', [['region', 'text'], ['tal', 'number'], ['annat', 'number']], [['A', 1, 2], ['A', 3, 1], ['B', 2, 5]]);
    const names = await make('Förslag namn', [['namn', 'text']], [['a'], ['b'], ['a']]);
    const places = await make('Förslag platser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['A', 20.26, 63.83], ['B', 22.15, 65.58]]);
    const empty = await make('Förslag tomt', [['id', 'text']], Array.from({ length: 40 }, (_, i) => ['x' + i]));
    const net = track(await graph.createGraphDataset({ name: 'Förslag graf', graph: NET() }));
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Förslag hus'));
    const drawing = track(await importer.run(fixtures.dxfFile(), { format: 'model' }, null, 'Förslag ritning'));
    const doc = track(await importer.runFiles([new File(['# R\n\nEn rad.\n'], 'a.md', { type: 'text/markdown' })], { format: 'documents' }, 'Förslag dokument'));
    const of = async (m) => suggest.forDataset(await datasets.get(m.id));
    assert.deepEqual(keysOf(await of(series)), ['viz.suggest.series'], 'a series is a line');
    assert.deepEqual(keysOf(await of(groups)), ['viz.suggest.sum', 'viz.suggest.scatter', 'viz.suggest.histogram']);
    assert.deepEqual(keysOf(await of(names)), ['viz.suggest.count'], 'something to count');
    assert.ok(keysOf(await of(places)).includes('viz.suggest.map'), 'places are a map');
    assert.deepEqual(keysOf(await of(empty)), [], 'nothing fits a list of unique names');
    assert.deepEqual(keysOf(await of(net)), ['viz.suggest.graph', 'viz.suggest.edges']);
    assert.deepEqual(keysOf(await of(house)), ['viz.suggest.model', 'viz.suggest.types', 'viz.suggest.quantities']);
    assert.deepEqual(keysOf(await of(drawing)), ['viz.suggest.layers']);
    assert.deepEqual(keysOf(await of(doc)), ['viz.suggest.documents']);
    for (const m of [series, groups, names, places, net, house, drawing, doc]) {
      for (const item of await of(m)) {
        assert.ok(D.require('ui/i18n').has(item.key), item.key);
        const text = await suggest.preview(item.chart);
        if (item.chart.kind === 'model') { assert.equal(text, null, 'a model is too slow to draw just to choose it'); continue; }
        const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        assert.equal(svg.tagName.toLowerCase(), 'svg', `${m.name}: ${item.key}`);
        assert.ok(svg.querySelectorAll('path, circle, rect, line').length > 0, `shapes in ${item.key}`);
      }
    }
    const edges = await of(net);
    const edgesText = await suggest.preview(edges[1].chart);
    assert.ok(edgesText.includes('K') && edgesText.includes('L'), 'the edge types are on the axis');
    return 'ok';
  }, 90000);

  test('suggestions: shown as pictures in the dialog, and a click opens the chart', async (assert) => {
    const groups = await make('Dialoggrupper', [['region', 'text'], ['tal', 'number']], [['A', 1], ['B', 2]]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === groups.id), 3000, 'dataset');
      shell.store.set({ selectedId: groups.id });
      shell.activate('visualisera');
      click(await waitFor(() => Array.from(root.querySelectorAll('.dm-left dm-button')).find((b) => b.textContent.trim() === t('viz.new')), 5000, 'new chart'));
      const dialog = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
      assert.ok(dialog.querySelector('.dm-op-tile[data-kind="vega"]'), 'the kinds of chart are still there');
      const tile = /** @type {any} */ (await waitFor(() => Array.from(dialog.querySelectorAll('.dm-suggest')).find((b) => b.textContent.includes(t('viz.suggest.sum', { value: 'tal', by: 'region' }))), 8000, 'the suggestion'));
      const img = /** @type {any} */ (await waitFor(() => tile.querySelector('img'), 8000, 'its picture'));
      await waitFor(() => img.naturalWidth > 0, 3000, 'decoded');
      assert.ok(img.getBoundingClientRect().width > 50, 'one that can be seen');
      tile.click();
      await waitFor(() => !document.querySelector('dialog[open]'), 3000, 'the dialog closes');
      await waitFor(() => root.querySelector('.dm-chart-preview canvas, .dm-chart-preview svg'), 8000, 'the chart');
    });
    return 'ok';
  }, 45000);

  test('dashboard: a click on a bar narrows the other charts, and again undoes it', async (assert) => {
    const charts = D.require('viz/charts');
    const builder = D.require('viz/vega-builder');
    const dashboards = D.require('viz/dashboards');
    const meta = await make('Korsfilter', [['region', 'text'], ['tal', 'number']], [['Stor', 100], ['Stor', 100], ['Liten', 1]]);
    const columns = await datasets.columns(meta.id);
    const chartOf = (name, type, column) => {
      const c = charts.create('vega', meta, name);
      const state = builder.defaultState(type, columns);
      state.x = builder.channel(column);
      state.y = builder.channel(columns[1], { aggregate: 'sum' });
      c.vega.type = type; c.vega.state = state;
      return charts.save(c);
    };
    const a = await chartOf('Korsfilter a', 'bar', columns[0]);
    const b = await chartOf('Korsfilter b', 'bar', columns[0]);
    const dash = await dashboards.save(Object.assign(dashboards.create('Korstavla'), { items: [{ chartId: a.id }, { chartId: b.id }] }));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      let cleanup = () => {};
      const view = D.require('ui/viz/dashboard-view').create({ dashboard: dash, onOpenChart() {}, onDeleted() {}, log() {} });
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute; left:-10000px; width:1200px; height:800px;';
      document.body.appendChild(host);
      host.appendChild(view.el);
      try {
        const render = D.require('viz/render');
        const realInto = render.renderInto;
        const drawn = [];
        render.renderInto = (chart, holder, options) => { drawn.push({ id: chart.id, filters: options.extraFilters || [] }); return realInto(chart, holder, options); };
        cleanup = () => { render.renderInto = realInto; };
        if (view.start) await view.start();
        const canvases = await waitFor(() => { const l = host.querySelectorAll('canvas'); return l.length === 2 ? l : null; }, 8000, 'two charts');
        // Vega finds the mark under the pointer on its own, so the pointer goes over the first chart until a bar answers.
        const canvas = canvases[0];
        const box = canvas.getBoundingClientRect();
        let badge = null;
        for (const fx of [0.3, 0.2, 0.4, 0.25, 0.35, 0.5, 0.6, 0.7]) {
          const opts = { bubbles: true, cancelable: true, clientX: box.left + box.width * fx, clientY: box.top + box.height * 0.65, view: window };
          for (const type of ['pointermove', 'mousemove', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) canvas.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, opts) : new MouseEvent(type, opts));
          await wait(150);
          badge = host.querySelector('.dm-cross-filter');
          if (badge) break;
        }
        assert.ok(badge, 'a bar answered');
        assert.ok(badge.textContent.includes('region'), badge.textContent);
        const last = drawn.slice(-2);
        assert.equal(last.find((x) => x.id === a.id).filters.length, 0, 'the chart that was clicked stays whole');
        assert.equal(last.find((x) => x.id === b.id).filters[0].field, 'region', 'the other one is narrowed');
        assert.ok(!view.el.querySelector('.dm-dashboard-filters').hidden, 'and the bar says so');
        const clear = await waitFor(() => host.querySelector('.dm-cross-filter dm-button'), 2000, 'the way back');
        click(clear);
        await waitFor(() => !host.querySelector('.dm-cross-filter'), 3000, 'cleared');
      } finally { cleanup(); view.destroy(); host.remove(); }
    });
    await dashboards.remove(dash.id);
    await charts.remove(a.id);
    await charts.remove(b.id);
    return 'ok';
  }, 45000);

  test('document templates: a dataset\'s own picture without a saved chart', async (assert) => {
    const template = D.require('docgen/template');
    const places = await make('Mallplatser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['A', 20.26, 63.83], ['B', 22.15, 65.58]]);
    const net = track(await graph.createGraphDataset({ name: 'Mallgraf', graph: NET() }));
    const plain = await make('Malltabell', [['namn', 'text']], [['a']]);
    const ctx = { _filters: [] };
    const body = '{{karta "Mallplatser" | bredd: 400}}\n{{graf "Mallgraf"}}\n{{karta "Malltabell"}}\n{{graf "Mallplatser"}}\n{{plan "Finns inte"}}';
    const out = await template.renderTemplate(body, ctx);
    assert.equal(out.images.length, 5);
    assert.ok(out.images[0].png && out.images[0].png.byteLength > 1000, 'a map: ' + (out.images[0].error || ''));
    assert.ok(out.images[1].png && out.images[1].png.byteLength > 1000, 'a graph: ' + (out.images[1].error || ''));
    assert.equal(out.images[2].error, t('doc.err.dataset.kind', { name: 'Malltabell' }), 'a table without places');
    assert.equal(out.images[3].error, t('doc.err.dataset.kind', { name: 'Mallplatser' }), 'a table is not a graph');
    assert.equal(out.images[4].error, t('doc.err.dataset.gone', { name: 'Finns inte' }));
    assert.ok(!out.text.includes('{{karta'), 'no tag is left in the text');
    const short = (await datasets.get(places.id)).shortName;
    assert.ok((await template.renderTemplate(`{{karta "${short}"}}`, ctx)).images[0].png, 'by the short name as well');
    assert.ok(plain.id && net.id);
    return 'ok';
  }, 60000);

  test('adapt6: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
