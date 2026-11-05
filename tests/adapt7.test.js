// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Exportera following the kind of dataset. What is written is read back: KML and GPX as XML, GeoPackage through the
 * app's own importer, PDF through pdf.js, Excel through SheetJS, Word as its ZIP and glTF by its own structure. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const own = D.require('io/export-kinds');
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
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
    const g = canvas.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, 120, 80);
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
  async function rejects(assert, fn, label) {
    let failed = false;
    try { await fn(); } catch (_err) { failed = true; }
    assert.ok(failed, label);
  }
  const exported = async (id, format) => (await exporter.exportDataset(id, format)).blob;
  const asXml = async (blob) => new DOMParser().parseFromString(await blob.text(), 'application/xml');
  const SQUARE = { type: 'Polygon', coordinates: [[[15, 60], [15.1, 60], [15.1, 60.1], [15, 60.1], [15, 60]], [[15.02, 60.02], [15.04, 60.02], [15.04, 60.04], [15.02, 60.02]]] };
  const LINE = { type: 'LineString', coordinates: [[15, 60], [16, 61]] };

  async function shapes() {
    return make('Former & namn', [['namn', 'text'], ['tal', 'number'], ['geometri', 'text']], [
      ['Punkt <1>', 1, JSON.stringify({ type: 'Point', coordinates: [15, 60] })], ['Yta', 2.5, JSON.stringify(SQUARE)], ['Linje', 3, JSON.stringify(LINE)],
      ['Flera', 4, JSON.stringify({ type: 'MultiPolygon', coordinates: [SQUARE.coordinates, [[[1, 1], [2, 1], [2, 2], [1, 1]]]] })], ['Utan form', 5, null],
    ]);
  }

  test('places: KML says the same as the table, in degrees, with its text escaped', async (assert) => {
    const meta = await shapes();
    const doc = await asXml(await exported(meta.id, 'kml'));
    assert.equal(doc.querySelector('parsererror'), null, 'valid XML');
    const marks = Array.from(doc.getElementsByTagName('Placemark'));
    assert.equal(marks.length, 4, 'the row without a shape is left out');
    assert.equal(marks[0].getElementsByTagName('name')[0].textContent, 'Punkt <1>', 'escaped and back');
    assert.equal(marks[0].getElementsByTagName('coordinates')[0].textContent, '15,60');
    assert.equal(marks[1].getElementsByTagName('innerBoundaryIs').length, 1, 'a hole stays a hole');
    assert.equal(marks[3].getElementsByTagName('Polygon').length, 2, 'several areas');
    assert.ok(Array.from(marks[1].getElementsByTagName('Data')).some((d) => d.getAttribute('name') === 'tal' && d.textContent === '2.5'), 'the columns follow');
    const projected = await make('Metrar', [['namn', 'text'], ['e', 'number'], ['n', 'number']], [['Umeå', 757000, 7087000]]);
    const text = await (await exported(projected.id, 'kml')).text();
    const c = text.match(/<coordinates>([^<]+)</)[1].split(',').map(Number);
    assert.ok(Math.abs(c[0] - 20.26) < 0.2 && Math.abs(c[1] - 63.83) < 0.2, 'in degrees: ' + c.join(','));
    const plain = await make('Utan platser', [['namn', 'text']], [['a']]);
    await rejects(assert, () => exported(plain.id, 'kml'), 'a table without places says so');
    return 'ok';
  });

  test('places: GPX has waypoints and tracks', async (assert) => {
    const meta = await shapes();
    const doc = await asXml(await exported(meta.id, 'gpx'));
    assert.equal(doc.querySelector('parsererror'), null, 'valid XML');
    const points = doc.getElementsByTagName('wpt');
    assert.equal(points.length, 1);
    assert.equal(points[0].getAttribute('lat'), '60');
    assert.equal(points[0].getAttribute('lon'), '15');
    assert.equal(doc.getElementsByTagName('trk').length, 3, 'lines and outlines');
    assert.equal(doc.getElementsByTagName('trkseg').length, 2 + 1 + 3, 'one segment per ring');
    return 'ok';
  });

  test('places: a GeoPackage is read back by the app itself, with its shapes and columns', async (assert) => {
    const sqliteImporter = D.require('io/importers/sqlite');
    for (const g of [{ type: 'Point', coordinates: [15.5, 60.25] }, LINE, SQUARE, { type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] }, { type: 'MultiLineString', coordinates: [LINE.coordinates] }, { type: 'MultiPolygon', coordinates: [SQUARE.coordinates] }]) {
      assert.deepEqual(JSON.parse(sqliteImporter.gpbToGeoJson(own.geoPackageBlob(g))), g, g.type);
    }
    const meta = await shapes();
    const blob = await exported(meta.id, 'gpkg');
    const file = new File([blob], 'former.gpkg', { type: 'application/geopackage+sqlite3' });
    const preview = await importer.preview(file);
    assert.ok(preview.gpkg, 'recognised as a GeoPackage');
    const back = track(await importer.run(file, { format: 'sqlite' }, null, 'Former tillbaka'));
    assert.equal(back.rowCount, 4);
    const columns = await datasets.columns(back.id);
    assert.ok(columns.some((c) => c.name === 'namn') && columns.some((c) => c.name === 'tal'), columns.map((c) => c.name).join(','));
    const geometry = D.require('viz/leaflet').geometryColumn(columns);
    const rows = await datasets.query(back.id);
    const at = columns.findIndex((c) => c.name === geometry);
    assert.deepEqual(JSON.parse(rows[1][at]), SQUARE, 'the shape with its hole');
    assert.equal(rows[0][columns.findIndex((c) => c.name === 'namn')], 'Punkt <1>');
    return 'ok';
  }, 20000);

  test('formats: each kind is offered its own, and what cannot work says what it needs', async (assert) => {
    const ids = (meta, facts) => exporter.formatsFor(meta, facts).map((f) => f.id);
    assert.ok(ids({ kind: 'images' }).includes('images-sheet'));
    assert.ok(!ids({ kind: 'table' }).includes('images-sheet'));
    const plan = ids({ kind: 'plan' });
    for (const f of ['plan-sheet', 'plan-provisions', 'plan-original']) assert.ok(plan.includes(f), f);
    const ifc = ids({ kind: 'model', model: { format: 'ifc' } });
    assert.ok(ifc.includes('model-glb') && ifc.includes('model-quantities-xlsx') && !ifc.includes('model-pdf'));
    const dxf = ids({ kind: 'model', model: { format: 'dxf' } });
    assert.ok(dxf.includes('model-pdf') && !dxf.includes('model-glb'));
    const without = exporter.formatsFor({ kind: 'table' }, { geometry: false });
    for (const id of ['geojson', 'kml', 'gpx', 'gpkg']) assert.equal(without.find((f) => f.id === id).unavailable, 'export.needs.geometry', id);
    for (const f of exporter.FORMATS) assert.ok(D.require('ui/i18n').has(f.key), f.key);
    return 'ok';
  });

  test('pictures: a contact sheet is pages of pictures with their names', async (assert) => {
    const files = [];
    for (let i = 0; i < 13; i++) files.push(await photo(`foto-${i}.jpg`));
    const album = track(await importer.runFiles(files, { format: 'images' }, 'Kontaktkarta'));
    const blob = await exported(album.id, 'images-sheet');
    const pdf = D.require('engines/pdf');
    const doc = await pdf.open(new Uint8Array(await blob.arrayBuffer()));
    try {
      assert.equal(doc.numPages, 2, 'twelve to a page');
      const page = await doc.getPage(1);
      const text = (await page.getTextContent()).items.map((x) => x.str).join(' ');
      assert.ok(text.includes('foto-0.jpg'), text.slice(0, 120));
      const ops = await page.getOperatorList();
      const lib = /** @type {any} */ (globalThis).pdfjsLib;
      assert.equal(ops.fnArray.filter((f) => f === lib.OPS.paintImageXObject || f === lib.OPS.paintJpegXObject).length, 12, 'the pictures themselves');
    } finally { await doc.destroy(); }
    return 'ok';
  }, 30000);

  test('plans: a sheet, the provisions as Word, and the original', async (assert) => {
    const shape = JSON.stringify(SQUARE);
    const plan = await make('Exportplan', [['objektid', 'text'], ['objekttyp', 'text'], ['beteckning', 'text'], ['formulering', 'text'], ['farg', 'text'], ['geometri', 'text']], [
      ['o1', 'anvandning', 'B', 'Bostäder', 'brun', shape], ['o2', 'egenskap', 'e1', 'Största byggnadsarea är 200 m2', null, shape],
    ], { kind: 'plan' });
    const handle = await datasets.ensureOpen(plan.id);
    handle.meta.plan = { slag: 'detaljplan', namn: 'Provplanen' };
    await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(handle.meta.plan)]);
    await datasets.save(plan.id);
    const map = D.require('viz/plan-map').defOf(await datasets.get(plan.id), await datasets.columns(plan.id));
    assert.equal(map.layers.length, 2, 'land use and outlines');
    assert.equal(map.layers[0].filters[0].value, 'anvandning');
    const sheet = await exported(plan.id, 'plan-sheet');
    assert.equal(await sheet.slice(0, 4).text(), '%PDF');
    const word = await exported(plan.id, 'plan-provisions');
    const zip = await D.require('platform/storage/zip').readZip(new Uint8Array(await word.arrayBuffer()));
    const xml = new TextDecoder().decode(zip['word/document.xml']);
    assert.ok(xml.includes('Största byggnadsarea är 200 m2') && xml.includes('Provplanen'), 'the provisions in the document');
    await rejects(assert, () => exported(plan.id, 'plan-original'), 'no file to give back says so');
    return 'ok';
  }, 45000);

  test('models: quantities in Excel, geometry as glTF, a drawing as PDF, a storey on its own', async (assert) => {
    const fixtures = D.require('tests/fixtures/ifc');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Exporthuset'));
    await D.assets.loadVendorScript('vendor/sheetjs/xlsx.full.min.js');
    const XLSX = /** @type {any} */ (globalThis).XLSX;
    const book = XLSX.read(new Uint8Array(await (await exported(house.id, 'model-quantities-xlsx')).arrayBuffer()), { type: 'array' });
    assert.deepEqual(book.SheetNames, [t('export.quantities.sums'), t('export.quantities.all')]);
    const sums = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
    const walls = sums.find((r) => r.typ === 'IfcWall' && r.namn === 'NetVolume');
    assert.ok(walls && walls.summa > 0 && walls.element > 0, JSON.stringify(sums[0]));
    // glTF, by its own structure.
    const glb = new DataView(await (await exported(house.id, 'model-glb')).arrayBuffer());
    assert.equal(glb.getUint32(0, true), 0x46546c67, 'the magic number');
    assert.equal(glb.getUint32(4, true), 2, 'version 2');
    assert.equal(glb.getUint32(8, true), glb.byteLength, 'says its own length');
    const jsonLength = glb.getUint32(12, true);
    assert.equal(glb.getUint32(16, true), 0x4e4f534a, 'JSON first');
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb.buffer, 20, jsonLength)));
    const bin = 20 + jsonLength;
    assert.equal(glb.getUint32(bin + 4, true), 0x004e4942, 'then the binary chunk');
    assert.equal(glb.getUint32(bin, true), json.buffers[0].byteLength, 'of the length the JSON says');
    assert.ok(json.meshes.length > 0);
    const primitive = json.meshes[0].primitives[0];
    const position = json.accessors[primitive.attributes.POSITION];
    assert.equal(position.min.length, 3, 'the bounds the format asks for');
    assert.equal(json.bufferViews[position.bufferView].byteLength, position.count * 12, 'the data is as long as said');
    assert.ok(json.bufferViews.every((v) => v.byteOffset % 4 === 0), 'aligned');
    const indices = json.accessors[primitive.indices];
    const start = bin + 8 + json.bufferViews[indices.bufferView].byteOffset;
    let top = 0;
    for (let i = 0; i < indices.count; i++) top = Math.max(top, glb.getUint32(start + i * 4, true));
    assert.ok(top < position.count, 'every index points at a vertex');
    // A drawing.
    const drawing = track(await importer.run(fixtures.dxfFile(), { format: 'model' }, null, 'Exportritningen'));
    assert.equal(await (await exported(drawing.id, 'model-pdf')).slice(0, 4).text(), '%PDF');
    // A storey on its own, as a batch per storey draws it.
    const render = D.require('viz/render');
    const chart = { kind: 'model', datasetId: house.id, name: 'Våning' };
    const size = async (options) => (await render.toBlob(chart, 'png', Object.assign({ width: 400, height: 300 }, options))).arrayBuffer();
    const whole = new Uint8Array(await size({}));
    const one = new Uint8Array(await size({ extraFilters: [{ field: 'vaning', op: '=', value: 'Plan 1' }] }));
    assert.ok(whole.length !== one.length || whole.some((v, i) => v !== one[i]), 'another picture for one storey');
    const same = new Uint8Array(await size({ extraFilters: [{ field: 'finns_inte', op: '=', value: 'x' }] }));
    assert.equal(same.length, whole.length, 'a filter on a column it does not have leaves it whole');
    return 'ok';
  }, 90000);

  test('export mode: the new formats are chosen and made through the page', async (assert) => {
    const album = track(await importer.runFiles([await photo('ett.jpg')], { format: 'images' }, 'Sidalbum'));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
      shell.store.set({ selectedId: album.id });
      shell.activate('exportera');
      const select = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('export.format') && s.options.some((o) => o.value === 'images-sheet')), 5000, 'the formats'));
      const group = Array.from(select.querySelectorAll('optgroup')).find((g) => g.querySelector('option[value="images-sheet"]'));
      assert.equal(group.label, t('export.group.whole'), 'among what carries all of it');
    });
    return 'ok';
  }, 20000);

  test('adapt7: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
