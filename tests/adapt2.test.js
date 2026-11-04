// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for how the modes follow the kind of dataset, deeper part: charts drawn from side tables, pictures on a map and
 * pictures linked to rows, searching by place and in side tables. No network: maps draw without a background map.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const exif = D.require('data/exif');
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
  const NET = () => ({
    directed: true,
    nodes: [{ id: 'a', labels: ['X'], name: 'Ärlig', properties: {} }, { id: 'b', labels: ['X'], name: 'Bo', properties: {} }, { id: 'c', labels: ['X'], name: 'Ceder', properties: {} }],
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'SAMARBETAR', properties: { vikt: 3 } }, { id: 'e2', source: 'b', target: 'c', type: 'KANNER', properties: { vikt: 7 } }],
  });
  async function photo(name, position) {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 150;
    const g = canvas.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, 200, 150);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return new File([position ? exif.insertApp1(bytes, exif.buildApp1(position)) : bytes], name, { type: 'image/jpeg' });
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
  const painted = (canvas) => { const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; for (let i = 3; i < data.length; i += 4) if (data[i]) return true; return false; };

  test('charts: a graph\'s edges can be drawn, and only the side tables a kind offers can be read', async (assert) => {
    const vizData = D.require('viz/data');
    const render = D.require('viz/render');
    const builder = D.require('viz/vega-builder');
    const net = track(await graph.createGraphDataset({ name: 'Diagramgraf', graph: NET() }));
    const columns = await vizData.columnsOf(net.id, '_edges');
    assert.ok(columns.some((c) => c.name === 'typ') && columns.some((c) => c.name === 'kalla'), columns.map((c) => c.name).join(','));
    const rows = await vizData.fetchRows(net.id, { table: '_edges', fields: ['typ'] });
    assert.deepEqual(rows.rows.map((r) => r.typ).sort(), ['KANNER', 'SAMARBETAR']);
    const counted = await vizData.fetchRows(net.id, { table: '_edges', groupBy: ['typ'], aggregates: [{ field: null, fn: 'count', as: 'n' }] });
    assert.equal(counted.rows.length, 2, 'grouped');
    // A name from a saved chart cannot reach anything but what the kind offers.
    assert.deepEqual((await vizData.columnsOf(net.id, '_log')).map((c) => c.name), (await datasets.columns(net.id)).map((c) => c.name), 'the log is not a chart table');
    const plain = await make('Vanlig', [['a', 'integer']], [[1]]);
    assert.deepEqual((await vizData.columnsOf(plain.id, '_edges')).map((c) => c.name), ['a'], 'a table has no such table');
    // Drawn for real: one bar per type of edge.
    const state = builder.defaultState('bar', columns);
    state.x = builder.channel(columns.find((c) => c.name === 'typ'));
    state.y = { aggregate: 'count', type: 'quantitative' };
    const svg = await (await render.toBlob({ kind: 'vega', datasetId: net.id, vega: { table: '_edges', state } }, 'svg', { width: 500 })).text();
    assert.ok(svg.includes('SAMARBETAR') && svg.includes('KANNER'), 'the edge types are on the axis');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      shell.store.set({ selectedId: net.id });
      shell.activate('visualisera');
      const button = await waitFor(() => Array.from(root.querySelectorAll('.dm-left dm-button')).find((b) => b.textContent.trim() === t('viz.new')), 5000, 'new chart');
      /** @type {HTMLElement} */ (button.querySelector('button')).click();
      /** @type {HTMLElement} */ (await waitFor(() => document.querySelector('dialog[open] .dm-op-tile[data-kind="vega"]'), 3000, 'the dialog')).click();
      const pick = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => /** @type {any} */ (s).options.some((o) => o.value === '_edges')), 5000, 'the choice of table'));
      assert.equal(pick.value, '', 'the main table first');
      pick.value = '_edges';
      pick.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => Array.from(root.querySelectorAll('.dm-viz-controls dm-select')).some((s) => /** @type {any} */ (s).options.some((o) => o.value === 'kalla')), 5000, 'the columns of the edges');
    });
    return 'ok';
  }, 45000);

  test('map: pictures with a position can be seen on a map, and a place shows its picture', async (assert) => {
    const album = track(await importer.runFiles([await photo('umea.jpg', { lat: 63.8258, lon: 20.263 }), await photo('lulea.jpg', { lat: 65.5848, lon: 22.1547 }), await photo('utan.jpg')], { format: 'images' }, 'Kartfoton'));
    const facets = D.require('data/facets');
    assert.ok(await facets.has(album.id, 'spatial'), 'pictures with positions are places');
    assert.equal((await facets.detect(album.id))[0].params.n, 2, 'two of three');
    const noPlaces = track(await importer.runFiles([await photo('x.jpg')], { format: 'images' }, 'Utan platser'));
    assert.equal(await facets.has(noPlaces.id, 'spatial'), false);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
      shell.store.set({ selectedId: album.id });
      shell.activate('bearbeta');
      const mapButton = await waitFor(() => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('gallery.view.map')), 5000, 'the button in the gallery');
      /** @type {HTMLElement} */ (mapButton.querySelector('button')).click();
      const canvas = /** @type {HTMLCanvasElement} */ (await waitFor(() => root.querySelector('.dm-map-view.leaflet-container .leaflet-overlay-pane canvas'), 8000, 'the map'));
      assert.ok(Math.abs(canvas.getBoundingClientRect().width - parseFloat(canvas.style.width)) < 1, 'as wide on screen as its own width');
      await waitFor(() => painted(canvas), 3000, 'painted places');
      const back = await waitFor(() => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('bearbeta.view.images')), 2000, 'the way back');
      /** @type {HTMLElement} */ (back.querySelector('button')).click();
      await waitFor(() => Array.from(root.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('gallery.view.map')), 3000, 'the gallery again');
      // A map view of its own: a click on a place shows the picture.
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute; left:-10000px; width:900px; height:700px;';
      const center = document.createElement('div'); center.style.height = '600px';
      const right = document.createElement('div');
      host.append(center, right);
      document.body.appendChild(host);
      const view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {} });
      try {
        await view.render(shell.store.get().datasets.find((d) => d.id === album.id), { center, right });
        const dots = [];
        await waitFor(() => { view.handle.map.eachLayer((l) => { if (l.feature && l.getLatLng) dots.push(l); }); return dots.length; }, 3000, 'the places');
        dots[0].fire('click');
        const img = /** @type {HTMLImageElement} */ (await waitFor(() => right.querySelector('.dm-photos-item img'), 3000, 'the picture'));
        await waitFor(() => img.naturalWidth > 0, 3000, 'decoded');
      } finally { view.destroy(); host.remove(); }
    });
    // A map chart can have pictures as a layer.
    const leaflet = D.require('viz/leaflet');
    const layer = leaflet.layerFor(await datasets.columns(album.id), album, 0);
    assert.equal(layer.lon, 'lon');
    return 'ok';
  }, 45000);

  test('media: a table that names pictures finds them, and shows them for a row', async (assert) => {
    const media = D.require('data/media');
    const album = track(await importer.runFiles([await photo('rad-1.jpg'), await photo('rad-2.jpg')], { format: 'images' }, 'Radfoton'));
    const rows = await make('Inventering med foton', [['plats', 'text'], ['foto', 'text']], [['A', 'rad-1.jpg; rad-2.jpg'], ['B', null], ['C', 'okand.jpg']]);
    assert.deepEqual(await media.linkOf(rows.id), { column: 'foto', albumId: album.id });
    const pictures = await media.picturesOf(rows.id, (c) => ({ plats: 'A', foto: 'rad-1.jpg; rad-2.jpg' })[c]);
    assert.deepEqual(pictures.map((p) => p.name), ['rad-1.jpg', 'rad-2.jpg']);
    assert.ok(pictures[0].url, 'a thumbnail');
    assert.deepEqual(await media.picturesOf(rows.id, () => null), [], 'a row without any');
    assert.deepEqual(await media.picturesOf(rows.id, () => 'okand.jpg'), [], 'a name nothing has');
    const other = await make('Bara text', [['namn', 'text']], [['inte en bild']]);
    assert.equal(await media.linkOf(other.id), null);
    const lookalike = await make('Filnamn utan album', [['fil', 'text']], [['saknas.jpg']]);
    assert.equal(await media.linkOf(lookalike.id), null, 'a picture name no collection has');
    return 'ok';
  }, 30000);

  test('search: by place, in a municipality or near a point, for coordinates and geometries in any system', async (assert) => {
    const spatial = D.require('data/spatial-search');
    const boundaries = D.require('data/boundaries');
    const features = await boundaries.features('kommuner');
    const umea = features.find((f) => f.name === 'Umeå');
    assert.ok(umea, 'the municipality exists');
    const points = await make('Sökplatser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['I Umeå', 20.26, 63.83], ['I Luleå', 22.15, 65.58], ['Utan plats', null, null]]);
    assert.deepEqual(await spatial.rowsWithin(points.id, { type: 'region', boundary: 'kommuner', code: umea.code }), [1]);
    assert.deepEqual(await spatial.rowsWithin(points.id, { type: 'near', lat: 63.82, lon: 20.26, km: 10 }), [1]);
    assert.deepEqual((await spatial.rowsWithin(points.id, { type: 'near', lat: 63.82, lon: 20.26, km: 400 })).sort(), [1, 2], 'a wider circle');
    assert.deepEqual(await spatial.rowsWithin(points.id, { type: 'box', west: 21, east: 23, south: 65, north: 66 }), [2]);
    const shapes = await make('Sökytor', [['namn', 'text'], ['geometri', 'text']], [['Ruta i Umeå', JSON.stringify({ type: 'Polygon', coordinates: [[[20.25, 63.82], [20.27, 63.82], [20.27, 63.84], [20.25, 63.84], [20.25, 63.82]]] })], ['Trasig', 'inte en form']]);
    assert.deepEqual(await spatial.rowsWithin(shapes.id, { type: 'region', boundary: 'kommuner', code: umea.code }), [1], 'by its middle');
    const sweref = await make('Sökprojicerat', [['e', 'number'], ['n', 'number']], [[757000, 7087000]]);
    assert.deepEqual(await spatial.rowsWithin(sweref.id, { type: 'region', boundary: 'kommuner', code: umea.code }), [1], 'projected coordinates');
    const plain = await make('Utan platser', [['namn', 'text']], [['x']]);
    assert.equal(await spatial.rowsWithin(plain.id, { type: 'near', lat: 60, lon: 15, km: 5 }), null, 'nothing to say about a table without places');
    assert.equal(await spatial.rowsWithin(points.id, { type: 'near', lat: 'x', lon: 15, km: 5 }), null, 'a point that is not one');
    assert.equal(await spatial.rowsWithin(points.id, { type: 'region', boundary: 'kommuner', code: 'finns inte' }), null);
    // Holes count.
    const donut = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    assert.ok(spatial.inGeometry([1, 1], donut));
    assert.ok(!spatial.inGeometry([5, 5], donut), 'in the hole');
    assert.ok(Math.abs(spatial.kmBetween([18.07, 59.33], [20.26, 63.83]) - 519) < 10, 'Stockholm to Umeå');
    // In Söka, with words as well.
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === points.id), 3000, 'dataset');
      shell.activate('soka');
      const details = await waitFor(() => Array.from(root.querySelectorAll('details.dm-more')).find((d) => d.textContent.includes(t('soka.place.more'))), 3000, 'the form');
      details.open = true;
      const kind = /** @type {any} */ (details.querySelector('dm-select'));
      kind.value = 'near';
      kind.dispatchEvent(new Event('change', { bubbles: true }));
      const fill = (label, value) => { const el = /** @type {any} */ (Array.from(details.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === label)); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
      await waitFor(() => details.querySelectorAll('dm-input').length === 3, 2000, 'the fields');
      fill(t('soka.place.lat'), '63,82');
      fill(t('soka.place.lon'), '20.26');
      fill(t('soka.place.km'), '10');
      const run = Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('soka.run'));
      /** @type {HTMLElement} */ (run.querySelector('button')).click();
      const card = await waitFor(() => root.querySelector(`.dm-search-result[data-dataset="${points.id}"]`), 8000, 'the hit, with no words at all');
      assert.ok(card.textContent.includes('I Umeå') && !card.textContent.includes('I Luleå'), card.textContent.slice(0, 200));
      assert.ok(!root.querySelector(`.dm-search-result[data-dataset="${plain.id}"]`), 'only datasets with places');
      const use = Array.from(card.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('selection.use'));
      /** @type {HTMLElement} */ (use.querySelector('button')).click();
      const selection = D.require('data/selection');
      await waitFor(() => selection.get(), 3000, 'the selection');
      assert.deepEqual(selection.get().rowids, [1], 'the selection is what was found');
      selection.clear();
    });
    return 'ok';
  }, 60000);

  test('search: a word on a graph\'s edge finds its nodes, and a word in a model\'s properties finds the element', async (assert) => {
    const search = D.require('analysis/search');
    const lists = D.require('data/lists');
    const net = track(await graph.createGraphDataset({ name: 'Söksidotabell', graph: NET() }));
    const hits = await search.searchDataset(net.id, 'SAMARBETAR', []);
    assert.deepEqual(hits.rows.map((r) => r[1]).sort(), ['a', 'b'], 'the nodes at both ends');
    const byName = await search.searchDataset(net.id, 'Ceder', []);
    assert.equal(byName.count, 1, 'its own columns as well');
    const meta = await make('Sökmodell', [['id', 'integer'], ['typ', 'text']], [[1, 'IfcWall'], [2, 'IfcWall'], [3, 'IfcDoor']], { kind: 'model' });
    const handle = await datasets.ensureOpen(meta.id);
    await handle.engine.run('create table _properties (id integer, uppsattning text, namn text, varde text, tal real, enhet text, kalla text)');
    await handle.engine.insertRows('_properties', ['id', 'uppsattning', 'namn', 'varde'], [[2, 'Pset_WallCommon', 'FireRating', 'EI60'], [3, 'Pset_DoorCommon', 'FireRating', 'EI30']]);
    assert.deepEqual((await search.searchDataset(meta.id, 'EI60', [])).rows.map((r) => r[1]), [2], 'walls with a fire rating');
    assert.equal((await search.searchDataset(meta.id, 'FireRating IfcDoor', [])).count, 1, 'every word has to be found, in either place');
    const w = await search.whereIn(meta.id, 'EI60', []);
    const r = await handle.engine.exec(`select id from data where ${w.sql}`, w.params);
    assert.deepEqual(r[0].values.map((x) => x[0]), [2], 'the same condition for a selection');
    const rec = await lists.save({ name: 'Brandklass', datasetId: meta.id, text: 'EI60', filters: [] });
    assert.equal((await lists.run(rec)).count, 1, 'a saved search');
    const asDataset = track(await lists.toDataset(rec, 'Väggar EI60'));
    assert.equal(asDataset.rowCount, 1, 'and as a dataset');
    await lists.remove(rec.id);
    // A model without the side table still searches.
    const bare = await make('Modell utan tabell', [['id', 'integer'], ['typ', 'text']], [[1, 'IfcWall']], { kind: 'model' });
    assert.equal((await search.searchDataset(bare.id, 'IfcWall', [])).count, 1);
    return 'ok';
  }, 30000);

  test('selection: rows chosen elsewhere are marked in the model, and what a map shows can be chosen', async (assert) => {
    const selection = D.require('data/selection');
    const fixtures = D.require('tests/fixtures/ifc');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Urvalshus'));
    const handle = await datasets.ensureOpen(house.id);
    const walls = await handle.engine.exec("select rowid, id from data where typ = 'IfcWall' order by rowid");
    const rows = walls[0].values.slice(0, 2);
    assert.equal(rows.length, 2, 'two walls');
    selection.set({ datasetId: house.id, rowids: rows.map((r) => Number(r[0])) });
    const points = await make('Syns på kartan', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.83], ['Luleå', 22.15, 65.58]]);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === house.id), 3000, 'dataset');
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
      const center = document.createElement('div'); center.style.height = '700px';
      const right = document.createElement('div');
      host.append(center, right);
      document.body.appendChild(host);
      const view = D.require('ui/bearbeta/model-view').create(shell.ctx, { onTable() {} });
      try {
        await view.render(shell.store.get().datasets.find((d) => d.id === house.id), { center, right });
        await waitFor(() => view.handle, 30000, 'the model');
        await waitFor(() => view.handle.marked().length, 5000, 'marked elements');
        assert.deepEqual(view.handle.marked().slice().sort((a, b) => a - b), rows.map((r) => Number(r[1])).sort((a, b) => a - b), 'the same walls');
      } finally { view.destroy(); host.remove(); selection.clear(); }
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === points.id), 3000, 'the points');
      const mapHost = document.createElement('div');
      mapHost.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
      const mapCenter = document.createElement('div'); mapCenter.style.height = '700px';
      const mapRight = document.createElement('div');
      mapHost.append(mapCenter, mapRight);
      document.body.appendChild(mapHost);
      const mapView = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {} });
      try {
        await mapView.render(shell.store.get().datasets.find((d) => d.id === points.id), { center: mapCenter, right: mapRight });
        await waitFor(() => mapView.handle, 5000, 'the map');
        mapView.handle.map.setView([63.83, 20.26], 11, { animate: false });
        const use = Array.from(mapCenter.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('selection.use.map'));
        /** @type {HTMLElement} */ (use.querySelector('button')).click();
        await waitFor(() => selection.get(), 3000, 'the selection');
        assert.equal(selection.get().datasetId, points.id);
        assert.deepEqual(selection.get().rowids, [1], 'only what the map shows');
        // Nothing in view: nothing is chosen, and that is said.
        selection.clear();
        mapView.handle.map.setView([40, -30], 11, { animate: false });
        /** @type {HTMLElement} */ (use.querySelector('button')).click();
        await wait(300);
        assert.equal(selection.get(), null, 'an empty view chooses nothing');
      } finally { mapView.destroy(); mapHost.remove(); selection.clear(); }
    });
    return 'ok';
  }, 60000);

  test('map chart: tables, picture collections and plans can be layers, documents and graphs cannot', async (assert) => {
    const panel = D.require('ui/viz/map-panel');
    const album = track(await importer.runFiles([await photo('lager.jpg', { lat: 60, lon: 15 })], { format: 'images' }, 'Lagerfoton'));
    const table = await make('Lagertabell', [['lon', 'number'], ['lat', 'number']], [[15, 60]]);
    const plan = await make('Lagerplan', [['objekttyp', 'text'], ['geometri', 'text']], [['Användning', JSON.stringify({ type: 'Point', coordinates: [15, 60] })]], { kind: 'plan' });
    const net = track(await graph.createGraphDataset({ name: 'Lagergraf', graph: NET() }));
    const doc = await make('Lagerdokument', [['text', 'text']], [['x']], { kind: 'document' });
    const columns = await datasets.columns(table.id);
    const mount = document.createElement('div');
    mount.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
    document.body.appendChild(mount);
    const made = panel.create({ chart: { kind: 'map', datasetId: table.id, datasetName: table.name, name: 'Lager' }, columns, onChange() {}, log() {}, onInspect() {} });
    mount.appendChild(made.el);
    try {
      const pick = /** @type {any} */ (await waitFor(() => Array.from(mount.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('map.add.dataset') && /** @type {any} */ (s).options.length), 5000, 'the list'));
      const offered = pick.options.map((o) => o.value);
      assert.ok(offered.includes(table.id), 'the table');
      assert.ok(offered.includes(album.id), 'the pictures');
      assert.ok(offered.includes(plan.id), 'the plan');
      assert.ok(!offered.includes(net.id), 'not a graph');
      assert.ok(!offered.includes(doc.id), 'not documents');
    } finally { made.destroy(); mount.remove(); }
    return 'ok';
  }, 30000);

  test('adapt2: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
