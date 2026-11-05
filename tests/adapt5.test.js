// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Söka and Analysera following the kind of dataset: conditions that belong to a kind, code to start from, which is
 * run for every kind, a trend for a time series, counting per area and the side tables in SQL. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const starters = D.require('analysis/starters');
  const qb = D.require('analysis/querybuilder');
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
  async function photo(name) {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d').fillRect(0, 0, 80, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return new File([await blob.arrayBuffer()], name, { type: 'image/jpeg' });
  }
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
  const tabButton = (root, text) => Array.from(root.querySelectorAll('dm-tabs [role="tab"], dm-tabs button')).find((b) => b.textContent.trim() === text);
  const NET = () => ({
    directed: true,
    nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, labels: ['X'], name: 'Namn ' + id, properties: {} })),
    edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['e', 'a']].map(([source, target], i) => ({ id: 'e' + i, source, target, type: i % 2 ? 'K' : 'L', properties: {} })),
  });
  /** One dataset of every kind, and a table of each sort, for code to be run against. */
  async function everyKind(prefix) {
    const fixtures = D.require('tests/fixtures/ifc');
    const out = {};
    out.table = await make(prefix + ' tabell', [['namn', 'text'], ['tal', 'number']], [['a', 1], ['b', 2]]);
    out.series = await make(prefix + ' serie', [['ar', 'integer'], ['tal', 'number']], [[2020, 1], [2021, 2], [2022, 4]]);
    out.places = await make(prefix + ' platser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.83], ['Luleå', 22.15, 65.58]]);
    out.text = await make(prefix + ' text', [['stycke', 'text']], ['x', 'y', 'z'].map((c) => [c.repeat(120)]));
    out.document = track(await importer.runFiles([new File(['# R\n\nEn rad text.\n'], 'a.md', { type: 'text/markdown' })], { format: 'documents' }, prefix + ' dokument'));
    out.images = track(await importer.runFiles([await photo('a.jpg')], { format: 'images' }, prefix + ' bilder'));
    out.plan = await make(prefix + ' plan', [['objektid', 'text'], ['objekttyp', 'text'], ['geometri', 'text']], [['o1', 'anvandning', JSON.stringify({ type: 'Point', coordinates: [15, 60] })]], { kind: 'plan' });
    out.graph = track(await graph.createGraphDataset({ name: prefix + ' graf', graph: NET() }));
    out.model = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, prefix + ' modell'));
    out.drawing = track(await importer.run(fixtures.dxfFile(), { format: 'model' }, null, prefix + ' ritning'));
    return out;
  }

  test('code to start from: every SQL piece runs on every kind, and the kind decides what is offered', async (assert) => {
    const query = D.require('data/query');
    const all = await everyKind('Sql');
    for (const [name, ds] of Object.entries(all)) {
      const pieces = await starters.forDataset(await datasets.get(ds.id), 'sql');
      assert.ok(pieces.length, 'something for ' + name);
      for (const piece of pieces) {
        assert.ok(D.require('ui/i18n').has(piece.key), 'a name for ' + piece.key);
        // A question that cannot be asked throws; one with no answer is fine.
        await query.select(ds.id, piece.code, { limit: 50 });
      }
    }
    const of = async (ds, lang) => (await starters.forDataset(await datasets.get(ds.id), lang)).map((p) => p.key);
    assert.ok((await of(all.graph, 'sql')).includes('starter.graph.degree'));
    assert.ok((await of(all.series, 'sql')).includes('starter.series'), 'a series is asked as one');
    assert.ok((await of(all.places, 'r')).includes('starter.map'), 'places are drawn');
    assert.ok(!(await of(all.table, 'r')).includes('starter.map'), 'a plain table is not');
    assert.ok((await of(all.text, 'sql')).includes('starter.search'), 'running text is searched');
    assert.deepEqual(await of(all.drawing, 'sql'), ['starter.model.layers'], 'a drawing has layers, not properties');
    const op = await make('Översiktsplan', [['objektid', 'text'], ['tema', 'text'], ['geometri', 'text']], [['o', 'Bebyggelse', null]], { kind: 'plan' });
    const handle = await datasets.ensureOpen(op.id);
    handle.meta.plan = { slag: 'oversiktsplan' };
    assert.ok(starters.forKind(handle.meta, 'sql')[0].code.includes('tema'), 'a comprehensive plan by its theme');
    return 'ok';
  }, 60000);

  test('code to start from: every R piece runs on every kind', async (assert) => {
    const bridge = D.require('data/r-bridge').bridge;
    const all = await everyKind('Rkod');
    for (const [name, ds] of Object.entries(all)) {
      for (const piece of await starters.forDataset(await datasets.get(ds.id), 'r')) {
        const res = await bridge.run(piece.code);
        const failed = res.entries.find((e) => e.kind === 'error');
        assert.ok(!failed, `${name}: ${piece.code}: ${failed ? failed.text : ''}`);
      }
    }
    return 'ok';
  }, 240000);

  test('python: code to start from runs on every kind', async (assert) => {
    const catalog = D.require('engines/python/catalog');
    const real = /[?&]python=1\b/.test(location.search) || (await catalog.cachedRuntime());
    if (!real) return 'skipped: Python components not cached';
    const bridge = D.require('data/python-bridge').bridge;
    const all = await everyKind('Pykod');
    for (const [name, ds] of Object.entries(all)) {
      for (const piece of await starters.forDataset(await datasets.get(ds.id), 'python')) {
        const res = await bridge.run(piece.code);
        const failed = res.entries.find((e) => e.kind === 'error');
        assert.ok(!failed, `${name}: ${piece.code}: ${failed ? failed.text : ''}`);
      }
    }
    return 'ok';
  }, 300000);

  test('notebooks: a new one starts from what the dataset is', async (assert) => {
    const notebooks = D.require('analysis/notebooks');
    const net = track(await graph.createGraphDataset({ name: 'Bokgraf', graph: NET() }));
    const book = notebooks.create('Grafbok', await datasets.get(net.id));
    assert.ok(book.cells.some((c) => c.type === 'r' && c.source.includes('dm_read_edges')), 'edges in R');
    assert.ok(book.cells.some((c) => c.type === 'sql' && c.source.includes('_edges')), 'edges in SQL');
    const plain = await make('Boktabell', [['a', 'integer']], [[1]]);
    const other = notebooks.create('Tabellbok', await datasets.get(plain.id));
    assert.ok(other.cells.some((c) => c.type === 'r' && c.source.includes('summary(df)')), 'a table as before');
    assert.equal(notebooks.create('Tom', null).cells[1].source, 'dm_list()', 'none chosen');
    return 'ok';
  }, 60000);

  test('question: a property of an element, a neighbour, some steps away and a place', async (assert) => {
    const fixtures = D.require('tests/fixtures/ifc');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Frågehus'));
    const spec = (id, column, items) => Object.assign(qb.empty(id), { columns: [{ source: 0, column }], where: { op: 'and', items } });
    const rated = await qb.run(spec(house.id, 'id', [{ special: 'property', set: 'Pset_WallCommon', name: 'FireRating', cmp: '=', value: 'EI60' }]));
    assert.ok(rated.values.length > 0, 'walls with a fire rating');
    const handle = await datasets.ensureOpen(house.id);
    const walls = (await handle.engine.exec("select count(*) from data where typ = 'IfcWall'"))[0].values[0][0];
    assert.equal(rated.values.length, Number(walls));
    assert.equal((await qb.run(spec(house.id, 'id', [{ special: 'property', set: 'Pset_WallCommon', name: 'FireRating', cmp: 'contains', value: 'EI' }]))).values.length, Number(walls), 'contains');
    assert.equal((await qb.run(spec(house.id, 'id', [{ special: 'property', set: 'Pset_WallCommon', name: 'FireRating', cmp: '=', value: 'EI30' }]))).values.length, 0, 'another value');
    const net = track(await graph.createGraphDataset({ name: 'Frågegraf', graph: NET() }));
    const idsOf = async (items) => (await qb.run(spec(net.id, 'id', items))).values.map((r) => r[0]).sort();
    assert.deepEqual(await idsOf([{ special: 'neighbour', of: 'a' }]), ['b', 'e'], 'both directions');
    assert.deepEqual(await idsOf([{ special: 'neighbour', of: 'Namn c' }]), ['b', 'd'], 'by name as well');
    assert.deepEqual(await idsOf([{ special: 'within', of: 'a', steps: 2 }]), ['a', 'b', 'c', 'e'], 'two steps');
    assert.deepEqual(await idsOf([{ special: 'within', of: 'a', steps: 99 }]), ['a', 'b', 'c', 'd', 'e'], 'a limit that does not run away');
    assert.deepEqual(await idsOf([{ special: 'neighbour', of: 'finns inte' }]), [], 'a node nobody has');
    assert.deepEqual(await idsOf([{ special: 'neighbour', of: "a' or '1'='1" }]), [], 'a value stays a value');
    // Together with an ordinary condition.
    assert.deepEqual(await idsOf([{ special: 'neighbour', of: 'a' }, { source: 0, column: 'id', cmp: '=', value: 'b' }]), ['b']);
    const places = await make('Frågeplatser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.83], ['Luleå', 22.15, 65.58]]);
    const near = spec(places.id, 'namn', [{ special: 'place', place: { type: 'near', lat: '63,82', lon: '20.26', km: '10' } }]);
    assert.deepEqual((await qb.run(near)).values, [['Umeå']]);
    assert.equal(near.where.items[0].rowids, undefined, 'the rows are not kept in the question');
    assert.ok(qb.describe(near, await qb.metasFor(near)).includes(t('fraga.special.place')), 'says what it is');
    const asDataset = track(await qb.toDataset(near, 'Nära Umeå'));
    assert.equal(asDataset.rowCount, 1, 'and as a dataset');
    return 'ok';
  }, 30000);

  test('question: each kind is offered its own conditions', async (assert) => {
    const fixtures = D.require('tests/fixtures/ifc');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Villkorshus'));
    const net = track(await graph.createGraphDataset({ name: 'Villkorsgraf', graph: NET() }));
    const places = await make('Villkorsplatser', [['lon', 'number'], ['lat', 'number']], [[15, 60]]);
    const plain = await make('Villkorstabell', [['namn', 'text']], [['a']]);
    const offered = (ds) => withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === ds.id), 5000, 'dataset');
      shell.store.set({ selectedId: ds.id });
      shell.activate('soka');
      /** @type {HTMLElement} */ (await waitFor(() => tabButton(root, t('soka.tabs.fraga')), 3000, 'the tab')).click();
      await waitFor(() => button(root, t('fraga.where.add')), 3000, 'the conditions');
      await wait(300);
      const list = ['property', 'neighbour', 'within', 'place'].filter((id) => button(root, t('fraga.special.' + id)));
      if (ds === house) {
        click(button(root, t('fraga.special.property')));
        const select = await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('fraga.special.property.name') && /** @type {any} */ (s).options.some((o) => o.label.includes('FireRating'))), 5000, 'the properties');
        assert.ok(select, 'read from the model');
      }
      return list;
    });
    assert.deepEqual(await offered(house), ['property']);
    assert.deepEqual(await offered(net), ['neighbour', 'within']);
    assert.deepEqual(await offered(places), ['place']);
    assert.deepEqual(await offered(plain), [], 'a plain table has its columns');
    return 'ok';
  }, 60000);

  test('statistics: a time series has a trend, in R, and the panel starts there', async (assert) => {
    const stats = D.require('analysis/stats');
    assert.deepEqual(stats.TOOLS.slice(0, 2), ['describe', 'trend']);
    const series = await make('Trendserie', [['ar', 'integer'], ['tal', 'number']], [[2020, 10], [2020, 12], [2021, 13], [2022, 15], [2023, 17]]);
    const plain = await make('Utan trend', [['namn', 'text'], ['tal', 'number']], [['a', 1], ['b', 2]]);
    const res = await stats.run('trend', { period: 'ar', value: 'tal', fn: 'mean' }, await datasets.get(series.id), 'r');
    assert.deepEqual(res.table.rows.map((r) => r[1]), [11, 13, 15, 17], 'one value per period');
    assert.ok(Math.abs(res.values.lutning - 2) < 1e-6, 'two more per period: ' + res.values.lutning);
    assert.ok(res.values.r2 > 0.99);
    assert.ok(res.plots.length > 0, 'and a picture');
    const total = await stats.run('trend', { period: 'ar', value: 'tal', fn: 'sum' }, await datasets.get(series.id), 'r');
    assert.equal(total.table.rows[0][1], 22, 'or the sum');
    assert.ok(stats.code('trend', { period: 'ar', value: 'tal', fn: 'mean' }, series, 'python').includes('polyfit'), 'the same in Python');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === series.id), 3000, 'dataset');
      shell.store.set({ selectedId: series.id });
      shell.activate('analysera');
      /** @type {HTMLElement} */ (await waitFor(() => tabButton(root, t('analysera.tabs.stats')), 5000, 'the tab')).click();
      await waitFor(() => Array.from(root.querySelectorAll('dm-select')).some((s) => s.getAttribute('label') === t('stats.field.period')), 5000, 'the trend');
      assert.ok(Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('stats.field.period')).value === 'ar', 'the period is found');
      shell.store.set({ selectedId: plain.id });
      await waitFor(() => !Array.from(root.querySelectorAll('dm-select')).some((s) => s.getAttribute('label') === t('stats.field.period')), 5000, 'not for a plain table');
    });
    return 'ok';
  }, 120000);

  test('counting per area: pictures against boundaries, a plan as areas, with density', async (assert) => {
    const geoAnalysis = D.require('analysis/geo');
    await geoAnalysis.ensure();
    const album = track(await importer.runFiles([await photo('p1.jpg'), await photo('p2.jpg')], { format: 'images' }, 'Områdesfoton'));
    const handle = await datasets.ensureOpen(album.id);
    await handle.engine.run('update data set lon = 20.26, lat = 63.83');
    const points = await geoAnalysis.featuresOfDataset(album.id);
    assert.equal(points.features.length, 2, 'pictures are points');
    const municipalities = await geoAnalysis.featuresOfBoundary('kommuner');
    assert.ok(municipalities.features.length > 200, 'the boundaries that come with the app');
    const out = await geoAnalysis.pointsInPolygons(points, municipalities, { density: true, mode: 'count', countName: 'antal' });
    assert.ok(out.columns.some((c) => c.name === 'per_km2'));
    assert.equal(out.columns[out.columns.length - 1].name, 'geometry', 'the shape stays last, so it can be drawn');
    const names = out.columns.map((c) => c.name);
    const umea = out.rows.find((r) => r[names.indexOf('namn')] === 'Umeå');
    assert.equal(umea[names.indexOf('antal')], 2);
    assert.ok(umea[names.indexOf('area_km2')] > 1000, 'the area in square kilometres');
    assert.ok(umea[names.indexOf('per_km2')] > 0);
    const square = { type: 'Polygon', coordinates: [[[20, 63], [21, 63], [21, 64], [20, 64], [20, 63]]] };
    const plan = await make('Områdesplan', [['objektid', 'text'], ['objekttyp', 'text'], ['geometri', 'text']], [['o1', 'anvandning', JSON.stringify(square)]], { kind: 'plan' });
    const inPlan = await geoAnalysis.pointsInPolygons(points, await geoAnalysis.featuresOfDataset(plan.id), { mode: 'count', countName: 'antal' });
    assert.equal(inPlan.rows[0][inPlan.columns.findIndex((c) => c.name === 'antal')], 2, 'a plan can be the areas');
    assert.ok(!inPlan.columns.some((c) => c.name === 'per_km2'), 'density only when asked');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
      shell.store.set({ selectedId: album.id });
      shell.activate('analysera');
      /** @type {HTMLElement} */ (await waitFor(() => tabButton(root, t('analysera.tabs.geo')), 5000, 'the Geo tab for pictures')).click();
      /** @type {HTMLElement} */ (await waitFor(() => tabButton(root, t('geo.tool.points')), 5000, 'the tool')).click();
      const areas = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('geo.points.areas')), 5000, 'the areas'));
      assert.ok(areas.options.some((o) => o.value === 'boundary:kommuner'), 'municipalities to count against');
      assert.ok(areas.options.some((o) => o.value === plan.id), 'and the plan');
      areas.value = 'boundary:lan';
      areas.dispatchEvent(new Event('change', { bubbles: true }));
      click(button(root, t('geo.run')));
      await waitFor(() => root.querySelector('.dm-tool-result dm-table'), 20000, 'the result');
    });
    return 'ok';
  }, 90000);

  test('SQL: side tables are shown and written, and code to start from is inserted', async (assert) => {
    const net = track(await graph.createGraphDataset({ name: 'Sqlgraf', graph: NET() }));
    const query = D.require('data/query');
    assert.equal((await query.select(net.id, 'select * from _edges limit 50', { limit: 50 })).values.length, 4, 'a side table can be read');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      shell.store.set({ selectedId: net.id });
      shell.activate('analysera');
      /** @type {HTMLElement} */ (await waitFor(() => tabButton(root, t('analysera.tabs.sql')), 5000, 'the tab')).click();
      const side = await waitFor(() => Array.from(root.querySelectorAll('.dm-right .dm-list-item')).find((b) => b.textContent.includes('_edges')), 5000, 'the side table');
      assert.ok(side.textContent.includes('kalla'), 'with its columns');
      const editor = /** @type {any} */ (root.querySelector('dm-code'));
      editor.value = '';
      /** @type {HTMLElement} */ (side).click();
      await waitFor(() => String(editor.value).includes('from _edges'), 3000, 'written');
      editor.value = '';
      const picker = /** @type {any} */ (await waitFor(() => { const el = Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('aria-label') === t('starter.title')); return el && el.options.length > 1 ? el : null; }, 5000, 'the choices'));
      assert.ok(picker.options.some((o) => o.label === t('starter.graph.degree')), 'named');
      picker.value = '0';
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => String(editor.value).includes('_edges'), 3000, 'inserted');
      assert.equal(picker.value, '', 'and ready for the next');
    });
    return 'ok';
  }, 30000);

  test('place form: complete, and numbers with a comma', async (assert) => {
    const form = D.require('ui/soka/place-form');
    assert.equal(form.complete({}), false);
    assert.equal(form.complete({ type: 'region' }), false);
    assert.equal(form.complete({ type: 'region', code: '2480' }), true);
    assert.equal(form.complete({ type: 'near', lat: '1', lon: '2' }), false);
    assert.deepEqual(form.areaOf({ type: 'near', lat: '63,5', lon: '20.5', km: '10' }), { type: 'near', lat: 63.5, lon: 20.5, km: 10 });
    assert.deepEqual(form.areaOf({ type: 'region', boundary: 'kommuner', code: '2480' }), { type: 'region', boundary: 'kommuner', code: '2480' });
    const place = {};
    const el = form.create(place);
    assert.equal(place.type, 'region', 'without "anywhere" a kind is chosen');
    assert.ok(el.querySelector('dm-select'));
    const anywhere = {};
    form.create(anywhere, { any: true });
    assert.equal(anywhere.type, undefined);
    return 'ok';
  });

  test('adapt5: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
