// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the sources made in Inhämta's Skapa källor (PLAN 12 e): a new table (data/field-collect, filled with add_row and
 * edit_cell in Bearbeta), a new map layer (data/layer-new, drawn on the map with ui/bearbeta/layer-draw and simulated clicks, in
 * the layer's own coordinate system) and a new detailed plan (data/plan-new createDetailed, provisions from data/plan-catalog,
 * the area operations of data/plan-edit, the plan editor's bar, and io/exporters/detaljplan read back by the importer into the same
 * plan). Every change is undone with the app's undo. The forms are found in the group Skapa källor and by deep links. Nothing is
 * fetched and nothing is asked.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const geo = D.require('data/geo');
  const collect = D.require('data/field-collect');
  const layerNew = D.require('data/layer-new');
  const catalog = D.require('data/plan-catalog');
  const planEdit = D.require('data/plan-edit');
  const made = [];
  const keep = (meta) => { made.push(meta.id); return meta; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, ms, label) { const t0 = performance.now(); for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(40); } }
  const rowsOf = async (id, sql) => { const hd = await datasets.ensureOpen(id); const r = await hd.engine.exec(sql); return r[0] ? r[0].values : []; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const B = 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36';
  const NOCK = 'ee5f8de3-89b0-479a-a5cb-7439d40623e8';
  /** A square in SWEREF 99 TM as WGS 84, as a plan keeps its areas. */
  const square = (e, n, side) => geo.toWgs84({ type: 'Polygon', coordinates: [[[e, n], [e + side, n], [e + side, n + side], [e, n + side], [e, n]]] }, 'EPSG:3006');
  /** A host for a view in Bearbeta: the centre and the inspector. */
  function host() {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:800px; display:flex;';
    const center = document.createElement('div'); center.style.cssText = 'width:680px; height:700px; display:flex; flex-direction:column;';
    const right = document.createElement('div'); right.style.cssText = 'width:320px;';
    el.append(center, right); document.body.appendChild(el);
    return { el, center, right };
  }
  const click = (el) => /** @type {any} */ (el).click();

  test('create sources: a new table takes its columns and types per line, is filled with Ny rad and cells, and the steps are undone', async (assert) => {
    assert.deepEqual(collect.parseColumns('plats\nantal: heltal\n\ndatum: date\nnot: vad: text'), [{ name: 'plats', type: 'text' }, { name: 'antal', type: 'integer' }, { name: 'datum', type: 'date' }, { name: 'not: vad', type: 'text' }], 'name, or name: type in the UI\'s words or the internal ones');
    await assert.throws(() => collect.createEmpty('Tom', '  \n'), new RegExp(t('field.err.nocolumns').slice(0, 12)));
    const meta = keep(await collect.createEmpty('Ny inventering', 'plats\nantal: heltal', { source: { kind: 'new', format: 'tabell' } }));
    assert.equal(meta.rowCount, 0); assert.equal(meta.source.format, 'tabell');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => [c.name, c.type]), [['plats', 'text'], ['antal', 'integer']]);
    const first = await recipes.apply(meta.id, 'add_row', { values: '{}' });
    await recipes.apply(meta.id, 'edit_cell', { rowid: first.rowid, column: 'plats', value: 'Ån' });
    await recipes.apply(meta.id, 'edit_cell', { rowid: first.rowid, column: 'antal', value: '3' });
    const second = await recipes.apply(meta.id, 'add_row', { values: JSON.stringify({ plats: 'Bron', antal: '7' }) });
    assert.equal(second.rowid, first.rowid + 1, 'the next rowid');
    assert.deepEqual(await rowsOf(meta.id, 'select plats, antal from data order by rowid'), [['Ån', 3], ['Bron', 7]]);
    await assert.throws(() => recipes.apply(meta.id, 'add_row', { values: JSON.stringify({ okand: 1 }) }), /okand/);
    // A row removed comes back with its values and its rowid; a row added goes again.
    await recipes.apply(meta.id, 'delete_row', { rowid: first.rowid });
    assert.deepEqual(await rowsOf(meta.id, 'select plats from data order by rowid'), [['Bron']]);
    await recipes.undo(meta.id);
    assert.deepEqual(await rowsOf(meta.id, 'select rowid, plats, antal from data order by rowid'), [[first.rowid, 'Ån', 3], [second.rowid, 'Bron', 7]], 'put back where it was');
    await recipes.undo(meta.id);
    assert.deepEqual(await rowsOf(meta.id, 'select plats from data'), [['Ån']], 'the second row undone');
    await datasets.flushSaves();
    return 'ok';
  }, 30000);

  test('create sources: a new map layer keeps its features in its own system, and its changes are steps that are undone', async (assert) => {
    const s = layerNew.settings({});
    assert.deepEqual([s.crs, s.geometry, s.name, s.columns], ['EPSG:3006', 'point', t('newlayer.default.name.point'), []], 'SWEREF 99 TM, points');
    assert.equal(layerNew.settings({ crs: 'EPSG:4326' }).crs, 'EPSG:4326', 'WGS 84');
    assert.equal(layerNew.settings({ crs: 'SWEREF99 18 00' }).crs, 'EPSG:3011', 'a local zone by its name');
    await assert.throws(() => layerNew.settings({ crs: 'EPSG:3021' }), /3021/);
    assert.deepEqual(layerNew.settings({ columns: 'namn\ngeometri\nantal: heltal' }).columns.map((c) => c.name), ['namn', 'antal'], 'the geometry column is the layer\'s own');
    const meta = keep(await layerNew.create({ name: 'Träd', geometry: 'point', columns: 'art\nhöjd: decimaltal' }));
    assert.ok(layerNew.isLayer(meta) && layerNew.kindOf(meta) === 'point' && meta.importOptions.crs === 'EPSG:3006');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => [c.name, c.type]), [['art', 'text'], ['höjd', 'number'], ['geometri', 'text']]);
    assert.ok(D.require('viz/leaflet').mapDefault(await datasets.columns(meta.id)) && await D.require('viz/leaflet').drawable(meta.id), 'opens as a map');
    const rowid = await layerNew.addFeature(meta.id, { type: 'Point', coordinates: [18.07, 59.33] }, { art: 'Ek' });
    const [g0, art] = (await rowsOf(meta.id, 'select geometri, art from data'))[0];
    const want = geo.wgs84ToSweref(18.07, 59.33, 3006);
    const p0 = JSON.parse(g0).coordinates;
    assert.ok(near(p0[0], want[0], 0.001) && near(p0[1], want[1], 0.001) && art === 'Ek', 'metres in SWEREF 99 TM: ' + g0);
    await assert.throws(() => layerNew.addFeature(meta.id, { type: 'LineString', coordinates: [[18, 59], [18.1, 59.1]] }), new RegExp(t('newlayer.geometry.point')));
    await layerNew.setGeometry(meta.id, rowid, { type: 'Point', coordinates: [18.08, 59.34] });
    await layerNew.deleteFeature(meta.id, rowid);
    assert.equal((await datasets.get(meta.id)).rowCount, 0);
    await layerNew.undo(meta.id);
    assert.deepEqual(await rowsOf(meta.id, 'select art from data'), [['Ek']], 'the removed feature is back');
    await layerNew.undo(meta.id);
    assert.equal((await rowsOf(meta.id, 'select geometri from data'))[0][0], g0, 'the place before the move');
    // WGS 84 keeps degrees, a local zone its own metres.
    const wgs = keep(await layerNew.create({ geometry: 'polygon', crs: 'EPSG:4326' }));
    await layerNew.addFeature(wgs.id, { type: 'Polygon', coordinates: [[[18, 59], [18.01, 59], [18.01, 59.01], [18, 59]]] });
    assert.deepEqual(JSON.parse((await rowsOf(wgs.id, 'select geometri from data'))[0][0]).coordinates[0][1], [18.01, 59]);
    await datasets.flushSaves();
    return 'ok';
  }, 30000);

  test('create sources: a map layer drawn with simulated clicks gets its line, point and move in the system chosen', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const consent = D.require('platform/consent');
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false, remember: false }; });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const box = host();
    let view = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const L = () => /** @type {any} */ (globalThis).L;
      const open = async (meta) => {
        if (view) view.destroy();
        view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {}, tileFactory: () => L().layerGroup() });
        await view.render(await datasets.get(meta.id), { center: box.center, right: box.right });
        click(await waitFor(() => box.center.querySelector('[data-layer-edit="start"]'), 5000, 'Rita i lagret'));
        await waitFor(() => box.center.querySelector('[data-layer-edit-bar]') && view.handle && view.handle.map.pm, 10000, 'the drawing bar');
      };
      // A line in SWEREF 99 18 00: three clicks and Avsluta formen.
      const line = keep(await layerNew.create({ name: 'Stig', geometry: 'line', crs: 'EPSG:3011' }));
      await open(line);
      const bar = box.center.querySelector('[data-layer-edit-bar]');
      assert.deepEqual(Array.from(bar.querySelectorAll('[data-layer-draw]')).map((b) => b.getAttribute('data-layer-draw')), ['line'], 'the layer\'s kind only');
      click(bar.querySelector('[data-layer-draw="line"]'));
      await waitFor(() => view.handle.map.pm.globalDrawModeEnabled(), 3000, 'drawing');
      const at = [[59.33, 18.05], [59.335, 18.06], [59.332, 18.07]];
      for (const [lat, lon] of at) view.handle.map.fire('click', { latlng: L().latLng(lat, lon) });
      click(await waitFor(() => box.center.querySelector('[data-layer-draw-finish]'), 3000, 'Avsluta formen'));
      await waitFor(async () => (await datasets.get(line.id)).rowCount === 1, 10000, 'the line saved');
      const g = JSON.parse((await rowsOf(line.id, 'select geometri from data'))[0][0]);
      assert.equal(g.type, 'LineString');
      assert.equal(g.coordinates.length, 3, 'three points');
      at.forEach(([lat, lon], i) => { const w = geo.wgs84ToSweref(lon, lat, 3011); assert.ok(near(g.coordinates[i][0], w[0], 0.002) && near(g.coordinates[i][1], w[1], 0.002), `point ${i + 1} in SWEREF 99 18 00: ${g.coordinates[i]}`); });
      await waitFor(() => box.right.querySelector('[data-layer-feature]'), 8000, 'the new feature chosen');
      // A point with one click, then moved and the move undone.
      const point = keep(await layerNew.create({ name: 'Brunnar', geometry: 'point', columns: 'namn' }));
      await open(point);
      click(box.center.querySelector('[data-layer-draw="point"]'));
      await waitFor(() => view.handle.map.pm.globalDrawModeEnabled(), 3000, 'drawing a point');
      view.handle.map.fire('click', { latlng: L().latLng(57.7, 11.97) });
      await waitFor(async () => (await datasets.get(point.id)).rowCount === 1, 10000, 'the point saved');
      const before = (await rowsOf(point.id, 'select geometri from data'))[0][0];
      const w0 = geo.wgs84ToSweref(11.97, 57.7, 3006);
      assert.ok(near(JSON.parse(before).coordinates[0], w0[0], 0.002), 'in SWEREF 99 TM: ' + before);
      const feature = await waitFor(() => box.right.querySelector('[data-layer-feature]'), 8000, 'the point chosen');
      assert.ok(feature.querySelector('[data-layer-value="namn"]') || await waitFor(() => feature.querySelector('[data-layer-value="namn"]'), 3000, 'its values'), 'its values to change');
      click(await waitFor(() => box.right.querySelector('[data-layer-shape-edit="move"]'), 3000, 'Flytta'));
      await waitFor(() => view.editor.copy, 3000, 'the copy to move');
      view.editor.copy.eachLayer((lyr) => lyr.setLatLng(L().latLng(57.71, 11.98)));
      click(await waitFor(() => box.right.querySelector('[data-layer-shape-save]'), 3000, 'Spara formen'));
      await waitFor(async () => (await rowsOf(point.id, 'select geometri from data'))[0][0] !== before, 10000, 'the point moved');
      const moved = JSON.parse((await rowsOf(point.id, 'select geometri from data'))[0][0]).coordinates;
      const w1 = geo.wgs84ToSweref(11.98, 57.71, 3006);
      assert.ok(near(moved[0], w1[0], 0.002) && near(moved[1], w1[1], 0.002), 'moved in SWEREF 99 TM: ' + moved);
      click(await waitFor(() => { const b = box.center.querySelector('[data-layer-edit-undo] button'); return b && !b.disabled ? b : null; }, 8000, 'Ångra'));
      await waitFor(async () => (await rowsOf(point.id, 'select geometri from data'))[0][0] === before, 10000, 'the move undone');
      click(await waitFor(() => box.center.querySelector('[data-layer-edit="done"]'), 5000, 'Klar'));
      await waitFor(() => !box.center.querySelector('[data-layer-edit-bar]'), 5000, 'out of drawing mode');
      assert.ok(!asked.length, 'nothing asked');
    } finally {
      if (view) view.destroy();
      consent.setAsker(null);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      box.el.remove(); root.remove();
    }
    return 'ok';
  }, 90000);

  test('create sources: a new detailed plan gets its boundary and provisions from the catalogue, and its export reads back the same plan', async (assert) => {
    const planNew = D.require('data/plan-new');
    const exporter = D.require('io/exporters/detaljplan');
    const importer = D.require('io/importers/detaljplan');
    assert.equal(planNew.detailedSettings({}).crs, 'EPSG:3006');
    await assert.throws(() => planNew.detailedSettings({ crs: 'EPSG:4326' }), /4326/);
    // The common provisions ship with the app, in force.
    const uses = await catalog.common('anvandning'); const props = await catalog.common('egenskap');
    assert.equal(uses.length, catalog.COMMON.anvandning.length, 'every common use is in the catalogue'); assert.equal(props.length, catalog.COMMON.egenskap.length);
    assert.ok(uses.concat(props).every(catalog.isCurrent), 'all in force'); assert.ok(uses.every((e) => e.typ === 'anvandning') && props.every((e) => e.typ === 'egenskap'));
    const meta = keep(await planNew.createDetailed({ name: 'Strandängen', beteckning: 'DP 2026:9', kommunkod: '1880', crs: 'EPSG:3010', syfte: 'Bostäder vid stranden' }));
    const info = meta.plan;
    assert.deepEqual([meta.kind, info.slag, info.kommun, info.kommunkod, info.crs, info.typ, info.format, meta.rowCount], ['plan', 'detaljplan', 'Örebro', '1880', 'EPSG:3010', 'detaljplan', 'detaljplan-ny', 0]);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), D.require('data/plan').DP_COLUMNS.map((c) => c.name), 'the columns a detailed plan is read into');
    const ex = D.require('io/export');
    assert.ok(ex.formatsFor(await datasets.get(meta.id)).some((f) => f.id === 'plan-detaljplan'), 'offered for a detailed plan');
    assert.ok(!ex.formatsFor({ kind: 'plan', plan: { slag: 'oversiktsplan' } }).some((f) => f.id === 'plan-detaljplan') && !ex.formatsFor({ kind: 'plan', plan: { slag: 'detaljplan', land: 'DK' } }).some((f) => f.id === 'plan-detaljplan'), 'not for a comprehensive or a Danish plan');
    await assert.throws(() => exporter.build(meta.id), new RegExp(t('plan.dp.export.err.boundary').slice(0, 16)));
    const boundary = await planEdit.addProvision(meta.id, { objekttyp: 'planomrade', geometry: square(512000, 6571000, 300) });
    assert.equal(boundary, info.objektid, 'the plan area is the plan\'s own object');
    const use = await planEdit.addProvision(meta.id, { objekttyp: 'anvandning', geometry: square(512000, 6571000, 200), entry: await catalog.get(B), etikett: 'Nya bostäder nära stranden.' });
    const nock = await planEdit.addProvision(meta.id, { objekttyp: 'egenskap', geometry: square(512020, 6571020, 80), entry: await catalog.get(NOCK), values: { 'höjd': '12' } });
    const bEntry = await catalog.get(B);
    await assert.throws(() => planEdit.addProvision(meta.id, { objekttyp: 'anvandning', geometry: { type: 'LineString', coordinates: [[15.2, 59.27], [15.21, 59.28]] }, entry: bEntry }), new RegExp(t('layers.mark.polygon')));
    const byId = async (id) => { const hd = await datasets.ensureOpen(meta.id); const r = await hd.engine.exec('select beteckning, formulering, katalogreferens, farg, varde, vardetyp, enhet, egenskaper, etikett from data where objektid = ?', [id]); return r[0].values[0]; };
    assert.deepEqual((await byId(use)).slice(0, 4), ['B', 'Bostäder', B, 'Gul'], 'Bostäder from the catalogue');
    const n = await byId(nock);
    assert.deepEqual(n.slice(0, 7), ['h', 'Högsta nockhöjd är 12 meter.', NOCK, null, '12', 'max', 'meter'], 'the variable filled in');
    assert.equal(JSON.parse(n[7]).formuleringsmall, 'Högsta nockhöjd är [höjd:decimaltal] meter.', 'the template kept');
    assert.deepEqual(planEdit.valuesIn(JSON.parse(n[7]).formuleringsmall, n[1]), { 'höjd': '12' }, 'and read back from the text');
    // The value changed, then undone; an area removed and put back.
    const entry = await catalog.get(NOCK);
    await planEdit.editArea(meta.id, nock, planEdit.provisionFields(entry, { 'höjd': '9,5' }, JSON.parse(n[7])));
    assert.equal((await byId(nock))[1], 'Högsta nockhöjd är 9,5 meter.');
    await planEdit.undo(meta.id);
    assert.equal((await byId(nock))[1], 'Högsta nockhöjd är 12 meter.', 'the change undone');
    await planEdit.deleteArea(meta.id, use);
    assert.equal((await datasets.get(meta.id)).rowCount, 2);
    await planEdit.undo(meta.id);
    assert.deepEqual((await byId(use)).slice(0, 3), ['B', 'Bostäder', B], 'the area put back');
    assert.deepEqual((await datasets.ensureOpen(meta.id)).meta.plan.antal, { anvandning: 1, egenskap: 1, planomrade: 1 }, 'the counts per object type');
    // Exported in the plan's system and read back: the same plan.
    const built = await exporter.build(meta.id);
    assert.equal(built['feature:mediatyp'], exporter.MEDIA_TYPE);
    assert.deepEqual(built.features.map((f) => f.properties['feature:typ']), ['detaljplan', 'användningsbestämmelse', 'egenskapsbestämmelse']);
    const planGeom = built.features[0].properties.plangeometri[0].geometri;
    assert.equal(planGeom.koordinatsystemPlan, 'EPSG:3010');
    const corner = square(512000, 6571000, 300).coordinates[0][0]; const inZone = geo.wgs84ToSweref(corner[0], corner[1], 3010);
    assert.ok(near(planGeom.position.coordinates[0][0][0], inZone[0], 0.001) && near(planGeom.position.coordinates[0][0][1], inZone[1], 0.001), 'metres in SWEREF 99 16 30: ' + planGeom.position.coordinates[0][0]);
    assert.deepEqual(built.features[2].properties.bestammelsevarde, [{ datatyp: 'decimaltal', variabelvarde: '12', beskrivning: 'höjd', vardetyp: 'max', enhet: 'meter' }]);
    const file = new File([await exporter.toBlob(meta.id)], 'strandangen.geojson', { type: 'application/geo+json' });
    const back = keep(await importer.importFile(file, {}, 'Strandängen igen'));
    for (const k of ['slag', 'objektid', 'beteckning', 'namn', 'syfte', 'kommun', 'kommunkod', 'typ', 'datumPaborjat', 'crs']) assert.equal(back.plan[k], info[k], 'the plan\'s ' + k);
    const cols = ['objektid', 'objekttyp', 'beteckning', 'formulering', 'katalogreferens', 'kod', 'kategori', 'underkategori', 'anvandningsform', 'varde', 'vardetyp', 'enhet', 'underkant', 'overkant', 'farg', 'status', 'etikett', 'egenskaper', 'geometri'];
    const all = async (id) => (await rowsOf(id, `select ${cols.join(', ')} from data order by objektid`)).map((r) => {
      const o = {}; cols.forEach((c, i) => { o[c] = r[i] === null || r[i] === undefined ? '' : r[i]; });
      const e = o.egenskaper ? JSON.parse(o.egenskaper) : {}; delete e.objektversion; delete e.versionGiltigFran; o.egenskaper = e;
      return o;
    });
    const a = await all(meta.id); const b = await all(back.id);
    assert.equal(b.length, a.length, 'as many objects');
    a.forEach((x, i) => {
      const y = b[i];
      for (const c of cols) if (c !== 'geometri' && c !== 'egenskaper') assert.equal(y[c], x[c], `${x.objekttyp} ${c}`);
      assert.deepEqual(y.egenskaper, x.egenskaper, x.objekttyp + ' facts');
      const p = JSON.parse(x.geometri).coordinates[0]; const q = JSON.parse(y.geometri).coordinates[0];
      assert.ok(p.length === q.length && p.every((c, j) => near(c[0], q[j][0], 1e-7) && near(c[1], q[j][1], 1e-7)), x.objekttyp + ' geometry within a centimetre');
    });
    await datasets.flushSaves();
    return 'ok';
  }, 60000);

  test('create sources: the detailed plan\'s bar draws its boundary and a use with a common provision, and the step is undone', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const planNew = D.require('data/plan-new');
    const consent = D.require('platform/consent');
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false, remember: false }; });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const box = host();
    let view = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const L = () => /** @type {any} */ (globalThis).L;
      const meta = keep(await planNew.createDetailed({ name: 'Ritad detaljplan' }));
      view = D.require('ui/bearbeta/plan-view').create(shell.ctx, { onTable() {}, tileFactory: () => L().layerGroup() });
      await view.render(await datasets.get(meta.id), { center: box.center, right: box.right });
      click(await waitFor(() => box.center.querySelector('[data-plan-edit="start"]'), 8000, 'Redigera planen'));
      assert.ok(box.center.querySelector('[data-plan-export="detaljplan"]'), 'Exportera som detaljplan');
      const bar = await waitFor(() => box.center.querySelector('[data-plan-edit-bar]') && view.handle && view.handle.map.pm ? box.center.querySelector('[data-plan-edit-bar]') : null, 10000, 'the edit bar');
      assert.equal(/** @type {any} */ (bar.querySelector('[data-plan-edit-target]')).value, 'dp:planomrade', 'the boundary first');
      assert.ok(bar.querySelector('[data-plan-draw="line"] button').disabled, 'a boundary is an area');
      const drawSquare = async (lat, lon, d) => {
        click(box.center.querySelector('[data-plan-draw="polygon"]'));
        await waitFor(() => view.handle.map.pm.globalDrawModeEnabled(), 3000, 'drawing');
        for (const [y, x] of [[lat, lon], [lat, lon + d], [lat + d, lon + d], [lat + d, lon]]) view.handle.map.fire('click', { latlng: L().latLng(y, x) });
        click(await waitFor(() => box.center.querySelector('[data-plan-draw-finish]'), 3000, 'Avsluta formen'));
      };
      await drawSquare(59.27, 15.2, 0.01);
      await waitFor(async () => (await datasets.get(meta.id)).rowCount === 1, 10000, 'the boundary');
      assert.deepEqual(await rowsOf(meta.id, 'select objekttyp, objektid from data'), [['planomrade', meta.plan.objektid]]);
      // The bar moves on to the uses, with the common provisions to choose from.
      const pick = /** @type {any} */ (await waitFor(() => { const el = /** @type {any} */ (box.center.querySelector('[data-plan-dp-provision]')); return el && el.options && el.options.length >= 10 ? el : null; }, 10000, 'the common provisions'));
      assert.equal(/** @type {any} */ (box.center.querySelector('[data-plan-edit-target]')).value, 'dp:anvandning');
      assert.equal(pick.value, B, 'Bostäder first');
      await drawSquare(59.272, 15.202, 0.004);
      await waitFor(async () => (await datasets.get(meta.id)).rowCount === 2, 10000, 'the use area');
      assert.deepEqual(await rowsOf(meta.id, "select beteckning, formulering, katalogreferens from data where objekttyp = 'anvandning'"), [['B', 'Bostäder', B]]);
      const edit = await waitFor(() => box.right.querySelector('[data-plan-area-edit]'), 10000, 'the use in the inspector');
      await waitFor(() => edit.querySelector('[data-plan-area-provision]') && edit.querySelector('[data-plan-area-motive]'), 5000, 'its provision and motive');
      assert.ok(edit.querySelector('[data-plan-area-delete]') && edit.querySelector('[data-plan-shape-edit="vertices"]'), 'its shape and Ta bort');
      click(await waitFor(() => { const b = box.center.querySelector('[data-plan-edit-undo] button'); return b && !b.disabled ? b : null; }, 8000, 'Ångra'));
      await waitFor(async () => (await datasets.get(meta.id)).rowCount === 1, 10000, 'the use undone');
      assert.ok(!asked.length, 'nothing asked');
    } finally {
      if (view) view.destroy();
      consent.setAsker(null);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      box.el.remove(); root.remove();
    }
    return 'ok';
  }, 90000);

  test('create sources: Skapa källor holds the three new sources, deep links open their forms, and the forms make them', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search + '#/inhamta/newtable');
      const shell = await D.require('app').start(root);
      const center = root.querySelector('.dm-center');
      await waitFor(() => center.querySelector('[data-newtable-form]'), 8000, 'Ny tabell from the link at the start');
      const groups = D.require('ui/modes/inhamta').GROUPS;
      assert.deepEqual(groups.find((g) => g.id === 'create').items.map((i) => i.id), ['newmodel', 'newplan', 'newdetailplan', 'newlayer', 'newtable'], 'Skapa källor');
      // Ny tabell: name and columns, then Fyll i tabellen opens it in Bearbeta, where Ny rad adds a row.
      const field = (sel) => /** @type {any} */ (center.querySelector(sel));
      field('[data-newtable="name"]').value = 'Formulärtabell'; field('[data-newtable="name"]').dispatchEvent(new Event('input'));
      field('[data-newtable="columns"]').value = 'plats\nantal: heltal'; field('[data-newtable="columns"]').dispatchEvent(new Event('input'));
      click(center.querySelector('[data-newtable-create]'));
      const done = await waitFor(() => center.querySelector('[data-newtable-done]'), 8000, 'the table made');
      const table = (await datasets.list()).find((m) => m.name === 'Formulärtabell'); made.push(table.id);
      assert.deepEqual((await datasets.columns(table.id)).map((c) => c.type), ['text', 'integer']);
      click(done.querySelector('[data-newtable-open]'));
      click(await waitFor(() => center.querySelector('[data-row-add]'), 8000, 'Ny rad in Bearbeta'));
      await waitFor(async () => (await datasets.get(table.id)).rowCount === 1, 8000, 'a row added');
      // The other two by deep link: their forms, and the map layer made from its form.
      await shell.openRoute({ mode: 'inhamta', object: 'newdetailplan' });
      await shell.activate('inhamta');
      await waitFor(() => center.querySelector('[data-newdetailplan-form] [data-newdetailplan="crs"]'), 8000, 'Ny detaljplan');
      assert.equal(field('[data-newdetailplan="crs"]').value, 'EPSG:3006', 'SWEREF 99 TM by default');
      await shell.openRoute({ mode: 'inhamta', object: 'newlayer' });
      await waitFor(() => center.querySelector('[data-newlayer-form]'), 8000, 'Nytt kartlager');
      assert.equal(field('[data-newlayer="crs"]').value, 'EPSG:3006');
      field('[data-newlayer="geometry"]').value = 'polygon'; field('[data-newlayer="geometry"]').dispatchEvent(new Event('change'));
      field('[data-newlayer="name"]').value = 'Formulärlager'; field('[data-newlayer="name"]').dispatchEvent(new Event('input'));
      click(center.querySelector('[data-newlayer-create]'));
      const doneLayer = await waitFor(() => center.querySelector('[data-newlayer-done]'), 8000, 'the layer made');
      const layer = (await datasets.list()).find((m) => m.name === 'Formulärlager'); made.push(layer.id);
      assert.equal(layerNew.kindOf(layer), 'polygon');
      assert.ok(doneLayer.querySelector('[data-newlayer-draw]') && doneLayer.querySelector('[data-newlayer-open]'), 'Rita i lagret and Öppna i Bearbeta');
      const cmds = await shell.palette.collect();
      for (const id of ['newdetailplan', 'newlayer', 'newtable']) assert.ok(cmds.some((c) => c.id === 'source:' + id), 'in the palette: ' + id);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
    return 'ok';
  }, 60000);

  test('create sources: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of made) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 30000);
})();
