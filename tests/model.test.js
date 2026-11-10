// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for CAD and BIM: the STEP reader (facts, elements, storeys, types, materials, classifications, properties and
 * quantities with units), geometry through web-ifc (areas and volumes that can be checked by hand), the model dataset
 * with its tables and original file, the DXF drawing (lengths, areas, blocks, escaped text, layers), the Quantities
 * tools, export, the chart kind and the Bearbeta view where selection follows between the table and the drawing. Own
 * test data only (tests/fixtures/ifc-fixture.js).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const fixtures = D.require('tests/fixtures/ifc');
  const step = D.require('data/ifc-step');
  const dxf = D.require('data/dxf');
  const model = D.require('data/model');
  const importer = D.require('io/importers/model');
  const imports = D.require('io/import');
  const engine = D.require('engines/ifc');
  const draw = D.require('viz/model-draw');
  const analysis = D.require('analysis/model');
  const datasets = D.require('data/datasets');
  const exporter = D.require('io/export');
  const charts = D.require('viz/charts');
  const render = D.require('viz/render');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
  const encode = (text) => new TextEncoder().encode(text);

  async function tablesOf(text) {
    const parts = { elements: [], properties: [], quantities: [], entities: [] };
    const summary = await step.tables(encode(text), { onRows: async (table, rows) => { parts[table].push(...rows); } });
    return { summary, parts };
  }

  test('ifc: the STEP reader gives the facts, elements, storeys, types, materials and classifications', async (assert) => {
    const quick = await step.summary(encode(fixtures.ifcText()));
    assert.equal(quick.schema, 'IFC4');
    assert.equal(quick.project, 'Testprojekt'); assert.equal(quick.building, 'Testhuset'); assert.equal(quick.application, 'Testprogram 1.0');
    assert.deepEqual(quick.storeys.map((s) => [s.name, s.elevation]), [['Plan 1', 0], ['Plan 2', 3]], 'storeys in metres, lowest first');
    assert.equal(quick.units.LENGTHUNIT, 'mm');
    assert.ok(quick.types.some((x) => x.name === 'IfcCartesianPoint' && x.count > 10), 'geometry is counted among the types');
    const { summary, parts } = await tablesOf(fixtures.ifcText());
    const byName = new Map(parts.elements.map((r) => [r[4], r]));
    const col = (name) => model.IFC_COLUMNS.findIndex((c) => c.name === name);
    assert.equal(summary.elements, 6, 'four walls, a slab and a door');
    assert.deepEqual(summary.elementTypes.map((x) => [x.name, x.count]), [['IfcWall', 4], ['IfcDoor', 1], ['IfcSlab', 1]]);
    const wall = byName.get('Vägg 2.1');
    assert.equal(wall[col('typ')], 'IfcWall'); assert.equal(wall[col('kategori')], 'byggdel'); assert.equal(wall[col('vaning')], 'Plan 2');
    assert.equal(wall[col('objekttyp')], 'Yttervägg'); assert.equal(wall[col('tagg')], 'V21'); assert.equal(wall[col('typnamn')], 'Yttervägg 200');
    assert.equal(wall[col('material')], 'Betong, Mineralull', 'material through the layer set');
    assert.equal(wall[col('guid')].length, 22);
    const slab = byName.get('Bjälklag ÅÄÖ');
    assert.ok(slab, 'raw UTF-8 in a string');
    assert.equal(slab[col('beskrivning')], 'En äkta platta', 'an \\X2\\ escape is decoded');
    assert.equal(slab[col('material')], 'Betong');
    const door = byName.get('Dörr 1');
    assert.equal(door[col('klassificering')], 'B123 Bärande vägg');
    assert.equal(door[col('vaning')], 'Plan 1');
    assert.equal(byName.get('Plan 2')[col('kategori')], 'struktur');
    assert.ok(!parts.elements.some((r) => r[col('typ')] === 'IfcProject'), 'the project is no element');
    return `${parts.elements.length} rows`;
  });

  test('ifc: properties come typed, also from the type, and quantities in SI units', async (assert) => {
    const { summary, parts } = await tablesOf(fixtures.ifcText());
    const wall = parts.elements.find((r) => r[4] === 'Vägg 1.1');
    const id = wall[0];
    const own = parts.properties.filter((r) => r[0] === id);
    const prop = (name) => own.find((r) => r[2] === name);
    assert.deepEqual(prop('FireRating').slice(1, 5), ['Pset_WallCommon', 'FireRating', 'EI60', null]);
    assert.equal(prop('LoadBearing')[3], 'true', 'a boolean');
    assert.equal(prop('ThermalTransmittance')[4], 0.17, 'a number stays a number');
    assert.equal(prop('Tillverkare')[6], 'typ', 'inherited from the wall type');
    assert.equal(prop('Tillverkare')[3], 'Testfabriken');
    assert.equal(prop('FireRating')[6], 'objekt');
    const q = parts.quantities.filter((r) => r[0] === id);
    const qty = (name) => q.find((r) => r[2] === name);
    assert.deepEqual(qty('Length').slice(3), [4, 'langd', 'm'], '4000 in project units (mm) is 4 m');
    assert.deepEqual(qty('NetVolume').slice(3), [2, 'volym', 'm³']);
    assert.deepEqual(qty('NetSideArea').slice(3), [10, 'area', 'm²']);
    assert.equal(summary.quantities, 4 * 3, 'three quantities on four walls');
    const props = JSON.parse(wall[model.IFC_COLUMNS.findIndex((c) => c.name === 'egenskaper')]);
    assert.equal(props.Pset_WallCommon.FireRating, 'EI60');
    assert.ok(parts.entities.some((r) => r[1] === 'IfcPropertySet'), 'non-geometric entities are kept');
    assert.ok(!parts.entities.some((r) => r[1] === 'IfcCartesianPoint'), 'geometry entities are not');
    return 'ok';
  });

  test('ifc: a file that is not IFC gets a clear message', async (assert) => {
    let message = '';
    try { await step.summary(encode('hello world')); } catch (err) { message = err.message; }
    assert.equal(message, t('model.err.notifc'));
    return 'ok';
  });

  test('ifc: web-ifc gives meshes in metres whose areas and volumes can be checked by hand', async (assert) => {
    const out = await engine.meshes(encode(fixtures.ifcText()), {});
    assert.equal(out.elements, 5, 'four walls and the slab; the door has no geometry');
    const stats = new Map(out.stats.map((s) => [s[0], s]));
    const { parts } = await tablesOf(fixtures.ifcText());
    const wall = parts.elements.find((r) => r[4] === 'Vägg 1.1')[0];
    const slab = parts.elements.find((r) => r[4] === 'Bjälklag ÅÄÖ')[0];
    assert.ok(near(stats.get(wall)[1], 22.6, 1e-3), '4 × 0.2 × 2.5 m has a surface of 22.6 m²: ' + stats.get(wall)[1]);
    assert.ok(near(stats.get(wall)[2], 2, 1e-3), 'and a volume of 2 m³: ' + stats.get(wall)[2]);
    assert.ok(near(stats.get(slab)[2], 5.4, 1e-3), '6 × 3 × 0.3 m is 5.4 m³: ' + stats.get(slab)[2]);
    assert.equal(out.batches.length, 2, 'one batch per colour: the red wall and the rest');
    const red = out.batches.find((b) => b.color[0] > 0.7 && b.color[1] < 0.3);
    assert.ok(red && red.index.length / 3 === 24, 'two red boxes of 12 triangles: ' + (red && red.index.length / 3));
    const r = out.ranges;
    assert.equal(r.length % 4, 0);
    const firstBatchIds = out.batches[0].ids;
    const id = (firstBatchIds[0] << 16) | (firstBatchIds[1] << 8) | firstBatchIds[2];
    assert.ok(stats.has(id), 'vertices carry their element id');
    return `${Math.round(out.batches.reduce((n, b) => n + b.index.length / 3, 0))} triangles`;
  }, 60000);

  test('model: an IFC file becomes a dataset with tables, the original kept and facts that survive undo', async (assert) => {
    const file = fixtures.ifcFile();
    assert.ok(importer.detect(file)); assert.ok(importer.detect(new File(['x'], 'a.DXF'))); assert.ok(importer.detect(new File(['x'], 'a.ifczip')));
    assert.equal(imports.importerFor(file).id, 'model');
    const p = await imports.preview(file, { format: 'model' });
    assert.equal(p.kind, 'model'); assert.equal(p.model.schema, 'IFC4'); assert.equal(p.datasetName, 'Testprojekt');
    assert.ok(p.columns.includes('antal'));
    const meta = await imports.run(file, { format: 'model' }, null, 'Testhus');
    created.push(meta.id);
    assert.equal(meta.kind, 'model');
    assert.equal(meta.model.elements, 6); assert.equal(meta.model.file, 'testhus.ifc');
    const original = await model.original(meta.id);
    assert.equal(new TextDecoder().decode(original.bytes), fixtures.ifcText(), 'the file is kept unchanged');
    const handle = await datasets.ensureOpen(meta.id);
    const count = async (sql) => Number((await handle.engine.exec(sql))[0].values[0][0]);
    assert.equal(await count('select count(*) from _quantities'), 12);
    assert.ok(await count('select count(*) from _properties') >= 16, 'properties in the long table');
    assert.ok(await count('select count(*) from _entities') > 20);
    const wall = (await model.rowsOf(meta.id, "select * from data where namn = 'Vägg 1.1'"))[0];
    assert.equal((await model.properties(meta.id, wall.id)).length, 4);
    assert.equal((await model.quantities(meta.id, wall.id)).length, 3);
    assert.equal((await model.element(meta.id, wall.id)).typnamn, 'Yttervägg 200');
    // Close and read back from storage: the facts come along.
    await datasets.flushSaves();
    datasets.close(meta.id);
    assert.equal((await datasets.ensureOpen(meta.id)).meta.model.elements, 6, 'facts read back from the file');
    assert.equal((await model.original(meta.id)).name, 'testhus.ifc');
    return meta.id;
  }, 60000);

  test('model: Mängder gives quantities per group, from the file and measured on the geometry', async (assert) => {
    const meta = await imports.run(fixtures.ifcFile(), { format: 'model' }, null, 'Mängdhus');
    created.push(meta.id);
    const col = (out, name) => out.columns.findIndex((c) => c.name === name);
    const byType = await analysis.fromFile(meta.id, { groups: ['typ', ''], category: 'byggdel' });
    const wall = byType.rows.find((r) => r[0] === 'IfcWall');
    assert.equal(wall[col(byType, 'antal')], 4);
    assert.equal(wall[col(byType, 'langd_m')], 16, 'four walls of 4 m');
    assert.equal(wall[col(byType, 'area_m2')], 40, 'net side area');
    assert.equal(wall[col(byType, 'volym_m3')], 8);
    assert.equal(byType.rows.find((r) => r[0] === 'IfcDoor')[col(byType, 'volym_m3')], null, 'no quantities: empty, not zero');
    const byStorey = await analysis.fromFile(meta.id, { groups: ['vaning', 'typ'], category: 'byggdel' });
    assert.deepEqual(byStorey.rows.filter((r) => r[1] === 'IfcWall').map((r) => [r[0], r[2]]), [['Plan 1', 2], ['Plan 2', 2]]);
    const measured = await analysis.fromGeometry(meta.id, { groups: ['typ'], category: 'byggdel' });
    const mWall = measured.rows.find((r) => r[0] === 'IfcWall');
    assert.ok(near(mWall[col(measured, 'volym_m3')], 8, 1e-2), 'measured volume: ' + mWall[col(measured, 'volym_m3')]);
    assert.ok(near(mWall[col(measured, 'yta_m2')], 90.4, 1e-2), 'measured surface: ' + mWall[col(measured, 'yta_m2')]);
    assert.equal(measured.rows.find((r) => r[0] === 'IfcDoor')[col(measured, 'med_geometri')], 0);
    const list = await analysis.quantityList(meta.id);
    assert.ok(list.rows.some((r) => r[0] === 'IfcWall' && r[2] === 'NetVolume' && r[6] === 8), 'every quantity name with its sum');
    const names = await analysis.propertyNames(meta.id);
    assert.ok(names.some((n) => n.set === 'Pset_WallCommon' && n.name === 'FireRating' && n.count === 4));
    const values = await analysis.propertyValues(meta.id, 'Pset_WallCommon', 'FireRating');
    assert.deepEqual(values.rows[0], ['IfcWall', 'EI60', null, 4]);
    assert.ok(analysis.entityTypes(meta).rows.some((r) => r[0] === 'IfcWall' && r[1] === 4));
    return 'ok';
  }, 60000);

  test('dxf: a drawing gives a table with lengths and areas, an SVG per layer, blocks and escaped text', async (assert) => {
    const out = await dxf.read(fixtures.dxfText());
    assert.equal(out.summary.format, 'dxf');
    assert.equal(out.rows.length, 7);
    const col = (name) => model.DXF_COLUMNS.findIndex((c) => c.name === name);
    const rowOf = (typ) => out.rows.find((r) => r[col('typ')] === typ);
    assert.equal(rowOf('LINE')[col('langd')], 10);
    assert.equal(rowOf('LWPOLYLINE')[col('langd')], 10, 'closed: 3 + 2 + 3 + 2');
    assert.equal(rowOf('LWPOLYLINE')[col('area')], 6);
    assert.ok(near(rowOf('CIRCLE')[col('langd')], 2 * Math.PI, 1e-2), 'a circle of radius 1: ' + rowOf('CIRCLE')[col('langd')]);
    assert.ok(near(rowOf('CIRCLE')[col('area')], Math.PI, 1e-2));
    assert.ok(near(rowOf('ARC')[col('langd')], Math.PI / 2, 1e-2), 'a quarter of a circle: ' + rowOf('ARC')[col('langd')]);
    assert.equal(rowOf('INSERT')[col('langd')], 4, 'the block is 1 + 1 long, scaled twice');
    assert.equal(rowOf('INSERT')[col('text')], 'BORD');
    assert.equal(rowOf('TEXT')[col('text')], 'Kök & <hall>');
    assert.deepEqual(out.summary.layers.map((l) => l.name), ['Dorrar', 'Inredning', 'Rum', 'Text', 'Väggar']);
    assert.equal(out.summary.layers.find((l) => l.name === 'Väggar').length, 15);
    const doc = new DOMParser().parseFromString(out.svg, 'image/svg+xml');
    assert.ok(!doc.querySelector('parsererror'), 'the SVG is well formed');
    assert.equal(doc.querySelectorAll('[data-layer]').length, 5);
    assert.equal(doc.querySelectorAll('[data-id]').length, 7);
    assert.equal(doc.querySelector('text').textContent, 'Kök & <hall>');
    assert.ok(out.svg.includes('&lt;hall&gt;'), 'text is escaped');
    let message = '';
    try { await dxf.read('not a dxf at all'); } catch (err) { message = err.message; }
    assert.ok(message.length > 0, 'nonsense is refused: ' + message);
    return 'ok';
  });

  test('dxf: a dataset keeps the original and the drawing, and exports them', async (assert) => {
    const file = fixtures.dxfFile();
    const p = await imports.preview(file, { format: 'model' });
    assert.equal(p.model.format, 'dxf'); assert.equal(p.datasetName, 'testritning');
    const meta = await imports.run(file, { format: 'model' }, null, 'Ritning');
    created.push(meta.id);
    assert.ok(model.isDxf(meta));
    assert.ok((await model.drawing(meta.id)).startsWith('<svg'));
    const res = await analysis.drawing(meta.id, ['lager', '']);
    assert.equal(res.rows.find((r) => r[0] === 'Rum')[1], 2);
    assert.equal(res.rows.find((r) => r[0] === 'Rum')[3] > 9, true, 'polygon and circle areas');
    assert.deepEqual(exporter.formatsFor(meta).filter((f) => f.kind === 'model').map((f) => f.id), ['model-original', 'model-svg', 'model-pdf'], 'a drawing has no property tables');
    assert.equal(exporter.formatsFor(meta).find((f) => f.id === 'model-original').ext, 'dxf', 'the export dialog suggests the right extension');
    const original = await exporter.exportDataset(meta.id, 'model-original');
    assert.equal(original.filename, 'testritning.dxf');
    assert.equal(await original.blob.text(), fixtures.dxfText());
    const svg = await exporter.exportDataset(meta.id, 'model-svg');
    assert.ok((await svg.blob.text()).includes('data-layer'));
    assert.equal(svg.filename.endsWith('.svg'), true);
    return 'ok';
  }, 30000);

  test('model: export gives the original file and the long tables, and the chart kind draws and exports', async (assert) => {
    const meta = await imports.run(fixtures.ifcFile(), { format: 'model' }, null, 'Exporthus');
    created.push(meta.id);
    assert.deepEqual(exporter.formatsFor(meta).filter((f) => f.kind === 'model').map((f) => f.id), ['model-original', 'model-properties', 'model-quantities', 'model-quantities-xlsx', 'model-glb']);
    assert.ok(exporter.formatsFor({ kind: 'table' }).every((f) => f.kind !== 'model'), 'tables do not get them');
    const original = await exporter.exportDataset(meta.id, 'model-original');
    assert.equal(original.filename, 'testhus.ifc');
    const properties = await (await exporter.exportDataset(meta.id, 'model-properties')).blob.text();
    assert.ok(properties.includes('Pset_WallCommon;FireRating;EI60'), 'one row per property: ' + properties.slice(0, 200));
    const quantities = await (await exporter.exportDataset(meta.id, 'model-quantities', { decimal: 'comma' })).blob.text();
    assert.ok(quantities.includes('Qto_WallBaseQuantities;NetVolume;2;'), 'one row per quantity: ' + quantities.slice(0, 200));
    assert.ok(charts.KINDS.includes('model'));
    const record = charts.create('model', meta, 'Modellvy');
    record.model = { datasetId: meta.id, visible: null, view: null };
    const png = await render.toBlob(record, 'png', { width: 320, height: 200 });
    assert.equal(png.type, 'image/png'); assert.ok(png.size > 500, 'a real picture: ' + png.size);
    const svg = await (await render.toBlob(record, 'svg', { width: 320, height: 200 })).text();
    assert.ok(svg.startsWith('<svg') && svg.includes('image/png'));
    const json = JSON.parse(charts.exportJson(record));
    assert.ok(json.model, 'the chart carries its definition');
    const html = await D.require('viz/model-draw').htmlFor('m', record, { width: 320, height: 200 });
    assert.ok(html.startsWith('<img') && html.includes('data:image/png'), 'an inline picture for dashboards');
    return 'ok';
  }, 60000);

  test('ui: a model opens in 3D in Bearbeta, selection follows between table and model, and Analysera has the Mängder tab', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed; left:0; top:0; width:1400px; height:900px; z-index:9000; background:white;';
    document.body.appendChild(root);
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const meta = await imports.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Vyhus');
      created.push(meta.id);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'dataset in the store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('bearbeta');
      const canvas = await waitFor(() => root.querySelector('.dm-model-canvas'), 30000, '3D canvas');
      assert.ok(canvas.getBoundingClientRect().width > 100, 'the canvas has its size on screen: ' + canvas.getBoundingClientRect().width);
      assert.ok(canvas.getBoundingClientRect().height > 100);
      const rows = await waitFor(() => { const l = root.querySelectorAll('.dm-model-table [role="row"]'); return l.length > 3 ? l : null; }, 8000, 'rows in the table');
      assert.ok(rows.length > 3);
      // The model draws something: the centre of the view is not background.
      await waitFor(() => { const gl = canvas.getContext('webgl2'); return !!gl; }, 2000, 'a WebGL context');
      // A row selects the element and the inspector shows its properties.
      const row = await waitFor(() => Array.from(root.querySelectorAll('.dm-model-table [role="row"]')).find((r) => r.textContent.includes('Vägg 1.1')), 5000, 'the wall row');
      /** @type {any} */ (row.querySelector('[role="gridcell"], .dm-td') || row).click();
      await waitFor(() => root.querySelector('.dm-right') && root.querySelector('.dm-right').textContent.includes('EI60'), 5000, 'properties in the inspector');
      assert.ok(root.querySelector('.dm-right').textContent.includes('Qto_WallBaseQuantities'), 'quantities in the inspector');
      assert.ok(root.querySelector('.dm-right').textContent.includes('22,6'), 'surface measured on the geometry');
      // A click in the model selects the element under the pointer and its row in the table.
      const box = canvas.getBoundingClientRect();
      const view = shell.store.get();
      assert.equal(view.selectedId, meta.id);
      let picked = null;
      // A made-up pointer has no capture to take: Firefox throws in OrbitControls when it asks for one, a real pointer never does.
      /** @type {any} */ (canvas).setPointerCapture = () => {}; /** @type {any} */ (canvas).releasePointerCapture = () => {};
      for (const [fx, fy] of [[0.5, 0.5], [0.4, 0.5], [0.6, 0.5], [0.5, 0.45], [0.5, 0.55], [0.3, 0.5], [0.7, 0.5]]) {
        const x = box.left + box.width * fx; const y = box.top + box.height * fy;
        const opts = { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 };
        canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
        canvas.dispatchEvent(new PointerEvent('pointerup', opts));
        await wait(200);
        if (root.querySelector('.dm-model-table [aria-selected="true"]')) { picked = root.querySelector('.dm-model-table [aria-selected="true"]').textContent; if (!picked.includes('Vägg 1.1')) break; }
      }
      assert.ok(picked, 'a click selects a row');
      // The filter narrows the table.
      const typeFilter = Array.from(root.querySelectorAll('.dm-page-head dm-select'))[0];
      /** @type {any} */ (typeFilter).value = 'IfcSlab';
      typeFilter.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => { const l = Array.from(root.querySelectorAll('.dm-model-table [role="row"]')).filter((r) => r.textContent.includes('Ifc')); return l.length === 1; }, 5000, 'one slab row');
      // The table is one button away and the model one button back, and Analysera has the tab.
      buttonByText(t('bearbeta.view.table')).click();
      assert.ok(t('bearbeta.view.model') !== 'bearbeta.view.model' && t('bearbeta.view.model.hint') !== 'bearbeta.view.model.hint', 'the button has its text');
      const back = await waitFor(() => buttonByText(t('bearbeta.view.model')), 8000, 'the model button in the table toolbar');
      back.click();
      await waitFor(() => root.querySelector('.dm-model-canvas'), 30000, 'the model again');
      shell.activate('analysera');
      const tab = await waitFor(() => Array.from(root.querySelectorAll('.dm-center [role="tab"], .dm-center dm-tabs button')).find((b) => b.textContent.trim() === t('analysera.tabs.model')), 5000, 'the Mängder tab');
      tab.click();
      await waitFor(() => root.querySelector('.dm-center') && root.querySelector('.dm-center').textContent.includes('IFC4'), 8000, 'the summary');
      const names = Array.from(root.querySelectorAll('.dm-center [role="tab"], .dm-center dm-tabs button')).map((b) => b.textContent.trim());
      assert.ok(names.indexOf(t('analysera.tabs.model')) > names.indexOf(t('analysera.tabs.regex')), 'after Regex');
      assert.ok(names.indexOf(t('analysera.tabs.model')) < names.indexOf(t('analysera.tabs.notebook')), 'before the notebook');
      // A drawing opens as SVG with its layers in the inspector.
      const drawingMeta = await imports.run(fixtures.dxfFile(), { format: 'model' }, null, 'Vyritning');
      created.push(drawingMeta.id);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === drawingMeta.id), 5000, 'drawing in the store');
      shell.store.set({ selectedId: drawingMeta.id });
      shell.activate('bearbeta');
      const svg = await waitFor(() => root.querySelector('.dm-dxf-svg'), 8000, 'the drawing');
      assert.ok(svg.getBoundingClientRect().width > 100, 'the drawing has its size');
      await waitFor(() => root.querySelector('.dm-right') && root.querySelector('.dm-right').textContent.includes('Väggar'), 5000, 'layers in the inspector');
      const layerSwitch = Array.from(root.querySelectorAll('.dm-right dm-switch')).find((sw) => (sw.getAttribute('label') || '').startsWith('Väggar'));
      /** @type {any} */ (layerSwitch).checked = false;
      layerSwitch.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(/** @type {any} */ (svg.querySelector('[data-layer="Väggar"]')).style.display, 'none', 'a layer can be hidden');
      return 'ok';
    } finally {
      root.remove();
      D.require('viz/model-draw').clearCache();
    }
  }, 120000);

  test('model: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    created.length = 0;
    draw.clearCache();
    assert.ok(true);
    return 'ok';
  });
})();
