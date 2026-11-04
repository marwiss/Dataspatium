// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for digital plans (dataset kind "plan"): Boverket's embedded Planbestämmelsekatalogen, the readers for
 * Lantmäteriet's NGP reference objects and the national specification's GeoJSON exchange model, SWEREF 99 zones,
 * the importer through io/import (sniffed JSON, ÖP-model GeoPackage), the plan view in Bearbeta with Boverket's
 * colours and designations, and the Plan tab in Analysera. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const catalog = D.require('data/plan-catalog');
  const plan = D.require('data/plan');
  const geo = D.require('data/geo');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const sqlite = D.require('engines/sqlite');
  const t = D.require('ui/i18n').t;
  const B_UUID = 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  // A small plan in SWEREF 99 TM: a block near Örebro (east ~ 512 000, north ~ 6 571 000).
  const sq = (x, y, w, hgt) => ({ type: 'Polygon', coordinates: [[[x, y], [x + w, y], [x + w, y + hgt], [x, y + hgt], [x, y]]] });
  const PLAN_ID = '2ca2ef06-0a48-4d34-ae53-29730f29d498';
  function ngpItem(id, geometry, typ, extra) {
    return { stac_version: '0.9.0', id, type: 'Feature', geometry, bbox: [0, 0, 0, 0], collection: '1880',
      properties: Object.assign({ datetime: '2024-01-31T17:01:45Z', providers: [{ name: 'Testköpings kommun', roles: ['producer'], kod: '1880' }], title: 'Test', feature: { typ, etikett: 'DP 2024:1' },
        detaljplan: { objektidentitet: PLAN_ID, beteckning: 'DP 2024:1', namn: 'Detaljplan för Testkvarteret', status: 'laga kraft', typ: 'detaljplan', datumPaborjat: '2022-03-01', datumLagakraft: '2024-01-15', anvandbarhet: 'god', kvalitet: { korrigeradeGranser: false, kontrolleratPlaneringsunderlag: true } } }, extra || {}),
      links: [], assets: {} };
  }
  function ngpCollection() {
    return { type: 'FeatureCollection', features: [
      ngpItem(PLAN_ID, sq(512000, 6571000, 200, 200), 'detaljplan', { title: 'Detaljplan för Testkvarteret' }),
      ngpItem('a1', sq(512000, 6571000, 100, 200), 'användningsbestämmelse', { title: 'Bostäder', planbestammelse: { planbestammelsekatalogreferens: B_UUID, bestammelseformulering: 'Bostäder', anvandningsform: 'Kvartersmark', kategori: 'Bostäder' } }),
      ngpItem('a2', sq(512100, 6571000, 100, 200), 'användningsbestämmelse', { title: 'Gata', planbestammelse: { planbestammelsekatalogreferens: '00000000-0000-4000-8000-000000000001', bestammelseformulering: 'Gata', anvandningsform: 'Allmän plats', kategori: 'Gata' } }),
      ngpItem('e1', sq(512010, 6571010, 80, 80), 'egenskapsbestämmelse', { title: 'Högsta nockhöjd är 12 meter', planbestammelse: { planbestammelsekatalogreferens: '00000000-0000-4000-8000-000000000002', bestammelseformulering: 'Högsta nockhöjd är 12 meter', bestammelsevarde: { variabelvarde: 12, vardetyp: 'max', enhet: 'meter' }, anvandningsform: 'Kvartersmark', kategori: 'Höjd på byggnadsverk', underkategori: 'Högsta höjd på byggnadsverk' } }),
    ] };
  }
  /** The national specification's exchange model: geometries inside the properties (plangeometri/bestammelsegeometri) in a local zone. */
  function specCollection() {
    const plangeo = (g) => [{ geometri: Object.assign({ koordinatsystemPlan: 'EPSG:3010', dimension: 2 }, g), geometrimetadata: { lagesbestamningsmetodPlan: 'lägesplacering, i digital karta' } }];
    return { type: 'FeatureCollection', 'feature:mediatyp': 'application/vnd.lm.detaljplan.v4+json', features: [
      { type: 'Feature', id: 'p1', geometry: null, properties: { 'feature:typ': 'detaljplan', objektidentitet: 'p1', versionGiltigFran: '2024-01-15', kommun: 'Testköping', beteckning: 'DP 2024:2', namn: 'Detaljplan för Zonen', syfte: 'Bostäder och park', status: 'laga kraft', typ: 'detaljplan', anvandbarhet: 'god', plangeometri: plangeo(sq(150000, 6571000, 300, 300)) } },
      { type: 'Feature', id: 'b1', geometry: null, properties: { 'feature:typ': 'beslutsinformation', detaljplan: 'p1', diarienummerKommun: 'SBN 2022/12', beslutstyp: 'antagande av ny detaljplan', datumPaborjat: '2022-01-10', datumAntagande: '2023-12-01', datumLagakraft: ['2024-01-15'], genomforandetid: 60 } },
      { type: 'Feature', id: 'u1', geometry: null, properties: { 'feature:typ': 'anvandningsbestammelse', detaljplan: 'p1', planbestammelsekatalogreferens: B_UUID, bestammelseformulering: 'Bostäder', bestammelsegeometri: plangeo(sq(150000, 6571000, 150, 300)) } },
      { type: 'Feature', id: 'u2', geometry: null, properties: { 'feature:typ': 'anvandningsbestammelse', detaljplan: 'p1', planbestammelsekatalogreferens: '00000000-0000-4000-8000-000000000003', bestammelseformulering: 'Park', bestammelsegeometri: plangeo(sq(150150, 6571000, 150, 300)) } },
      { type: 'Feature', id: 'e1', geometry: null, properties: { 'feature:typ': 'egenskapsbestammelse', detaljplan: 'p1', planbestammelsekatalogreferens: '00000000-0000-4000-8000-000000000004', bestammelseformulering: 'Största takvinkel är 30 grader', bestammelsevarde: [{ datatyp: 'decimaltal', variabelvarde: 30, vardetyp: 'max', enhet: 'grader' }], sekundarEgenskapsgrans: false, bestammelsegeometri: plangeo(sq(150020, 6571020, 100, 100)) } },
      { type: 'Feature', id: 'd1', geometry: null, properties: { 'feature:typ': 'planbestammelsebeskrivning', planbestammelse: 'e1', motiv: 'Anpassning till omgivande bebyggelse.' } },
    ] };
  }

  test('plan: the embedded Planbestämmelsekatalogen resolves provisions, designations, replacements, colours and search', async (assert) => {
    const cat = await catalog.load();
    assert.ok(cat.rows.length >= 3700, 'rows: ' + cat.rows.length);
    assert.ok(/^\d{8}$/.test(cat.release), 'release ' + cat.release);
    const b = await catalog.get(B_UUID);
    assert.ok(b && b.beteckning === 'B' && b.farg === 'Gul' && b.form === 'Kvartersmark' && b.kod === 'DP_KM_B2' && b.typ === 'anvandning', 'B: ' + JSON.stringify(b));
    assert.ok(catalog.isCurrent(b), 'B is in force');
    assert.equal(catalog.colorFor(b), '#f4e07a'); assert.equal(catalog.colorFor('ljusgrå'), '#dadde1'); assert.equal(catalog.colorFor('Ofärgad'), null);
    const byB = await catalog.byDesignation('B', { form: 'Kvartersmark' });
    assert.ok(byB.some((r) => r.uuid === B_UUID), 'B found by designation');
    const gata = await catalog.byDesignation('GATA', { form: 'Allmän plats' });
    assert.ok(gata.length && gata.every((r) => r.farg === 'Ljusgrå'), 'GATA is light grey');
    const hits = await catalog.search('nockhöjd', { typ: 'egenskap', current: true });
    assert.ok(hits.length > 5 && hits.every((r) => r.typ === 'egenskap' && catalog.isCurrent(r)), 'search: ' + hits.length);
    const replaced = cat.rows.find((r) => !catalog.isCurrent(r) && r.ersattsAv && cat.byId.get(r.ersattsAv));
    assert.ok(replaced, 'an expired provision with a successor exists');
    const followed = await catalog.resolve(replaced.uuid, { follow: true });
    assert.ok(followed && followed.uuid !== replaced.uuid, 'follow leads to the successor');
    assert.equal(catalog.designationKey('e1'), 'e'); assert.equal(catalog.designationKey('GATA#'), 'gata');
    return `${cat.rows.length} bestämmelser, release ${cat.release}`;
  });

  test('plan: NGP reference objects and the national specification GeoJSON become plan rows in WGS 84 with colours, summaries and a catalogue check', async (assert) => {
    assert.equal(plan.detect(ngpCollection()), 'ngp'); assert.equal(plan.detect(specCollection()), 'detaljplan');
    assert.equal(plan.detect({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { a: 1 } }] }), null);
    const ngp = plan.fromNgp(ngpCollection());
    await plan.decorate(ngp.rows);
    assert.equal(ngp.plan.beteckning, 'DP 2024:1'); assert.equal(ngp.plan.kommun, 'Testköpings kommun'); assert.equal(ngp.plan.kommunkod, '1880'); assert.equal(ngp.plan.datumLagakraft, '2024-01-15');
    assert.deepEqual(ngp.rows.map((r) => r.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap']);
    const b = ngp.rows[1];
    assert.equal(b.farg, 'Gul'); assert.equal(b.kod, 'DP_KM_B2'); assert.equal(b.beteckning, 'B'); assert.equal(plan.fillOf(b), '#f4e07a');
    const gata = ngp.rows[2];
    assert.equal(gata.farg, 'Ljusgrå', 'unknown reference, colour from the formulation: ' + gata.farg); assert.equal(plan.fillOf(gata), '#dadde1');
    assert.equal(plan.fillOf(ngp.rows[3]), null, 'property provisions are outlines');
    assert.equal(ngp.rows[3].varde, '12'); assert.equal(ngp.rows[3].enhet, 'meter');
    const g = geo.parseGeometry(ngp.rows[0].geometri);
    assert.ok(g && g.type === 'Polygon' && g.coordinates[0][0][0] > 15 && g.coordinates[0][0][0] < 16 && g.coordinates[0][0][1] > 59 && g.coordinates[0][0][1] < 60, 'SWEREF 99 TM -> WGS 84: ' + JSON.stringify(g.coordinates[0][0]));
    const legend = plan.legend(ngp.rows);
    assert.deepEqual(legend.map((e) => e.beteckning), ['B', 'GATA'], 'legend: the unknown reference got its designation from the catalogue by formulation');
    assert.equal(gata.kod, 'DP_AP_Gata');
    const areas = plan.areasByUse(ngp.rows, 'detaljplan');
    assert.equal(areas.length, 2); assert.ok(Math.abs(areas[0].area - 20000) < 50, 'area ~ 20 000 m²: ' + areas[0].area); assert.ok(Math.abs(areas[0].share - 0.5) < 0.01);
    const check = await plan.checkCatalog(ngp.rows);
    assert.deepEqual(check.counts, { ok: 1, okand: 2 }, JSON.stringify(check.counts));
    // The exchange model: geometries under the properties in a local zone (EPSG:3010, central meridian 16.5°).
    const spec = plan.fromDetaljplan(specCollection());
    await plan.decorate(spec.rows);
    assert.equal(spec.plan.namn, 'Detaljplan för Zonen'); assert.equal(spec.plan.kommun, 'Testköping'); assert.equal(spec.plan.datumLagakraft, '2024-01-15'); assert.equal(spec.plan.genomforandetid, '60'); assert.equal(spec.plan.crs, 'EPSG:3010');
    assert.deepEqual(spec.rows.map((r) => r.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap']);
    assert.equal(spec.rows[3].etikett, 'Anpassning till omgivande bebyggelse.', 'the motive joined from planbestammelsebeskrivning');
    assert.equal(spec.rows[2].farg, 'Ljusgrön', 'Park: colour from the formulation');
    const p = geo.parseGeometry(spec.rows[0].geometri);
    assert.ok(p && Math.abs(p.coordinates[0][0][0] - 16.5) < 0.3 && p.coordinates[0][0][1] > 59, 'EPSG:3010 near its central meridian: ' + JSON.stringify(p.coordinates[0][0]));
    assert.equal(geo.swerefZone('EPSG:3007'), 3007); assert.equal(geo.swerefZone('SWEREF99 13 30'), 3008); assert.equal(geo.swerefZone('urn:ogc:def:crs:EPSG::3006'), 3006); assert.equal(geo.swerefZone(''), 3006);
    const merc = geo.toWgs84({ type: 'Point', coordinates: [1669792.36, 8060000] }, 'EPSG:3857');
    assert.ok(Math.abs(merc.coordinates[0] - 15) < 0.001 && merc.coordinates[1] > 58 && merc.coordinates[1] < 59, 'Web Mercator -> WGS 84: ' + JSON.stringify(merc.coordinates));
    // Flattened API answers (api/parsers) read back as reference objects.
    const table = { columns: ['id', 'feature.typ', 'detaljplan.beteckning', 'detaljplan.namn', 'detaljplan.status', 'planbestammelse.planbestammelsekatalogreferens', 'planbestammelse.bestammelseformulering', 'planbestammelse.anvandningsform', 'geometri'],
      rows: [['x1', 'detaljplan', 'DP 1', 'Plan', 'laga kraft', null, null, null, JSON.stringify(sq(17, 59, 0.01, 0.01))], ['x2', 'användningsbestämmelse', 'DP 1', 'Plan', 'laga kraft', B_UUID, 'Bostäder', 'Kvartersmark', JSON.stringify(sq(17, 59, 0.005, 0.01))]] };
    assert.ok(plan.detectTable(table.columns), 'table recognised');
    const fromTable = plan.fromReferenceTable(table.columns, table.rows);
    assert.deepEqual(fromTable.rows.map((r) => r.objekttyp), ['planomrade', 'anvandning']); assert.equal(fromTable.plan.beteckning, 'DP 1');
    assert.ok(plan.templateMatches('Högsta nockhöjd är [siffra] meter', 'Högsta nockhöjd är 12 meter') && !plan.templateMatches('Högsta nockhöjd är [siffra] meter', 'Minsta takvinkel är 12 grader'));
    const md = plan.provisionsMarkdown(ngp.plan, ngp.rows, { plan: 'Plan', beteckning: 'Beteckning', kommun: 'Kommun', status: 'Status', lagakraft: 'Laga kraft', anvandning: 'Användning', egenskap: 'Egenskap' });
    assert.ok(/^# Detaljplan för Testkvarteret/.test(md) && /## Användning/.test(md) && /\*\*B\*\* Bostäder/.test(md), md.slice(0, 200));
    return 'ok';
  });

  test('plan: a plan file imports through io/import as a plan dataset, opens as a plan map in Bearbeta with Boverket colours and designations, and the Plan tab lists provisions', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const tabByText = (text) => /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === text));
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const file = new File([JSON.stringify(ngpCollection())], 'dp-2024-1.geojson', { type: 'application/geo+json' });
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'detaljplan', 'sniffed as a plan'); assert.equal(p.kind, 'plan'); assert.equal(p.plan.beteckning, 'DP 2024:1'); assert.equal(p.totalRows, 4);
      meta = await importer.run(file, {}, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.name, 'Detaljplan för Testkvarteret'); assert.equal(meta.rowCount, 4);
      const ds = await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'dataset in store');
      assert.ok(ds.plan && ds.plan.slag === 'detaljplan' && ds.plan.beteckning === 'DP 2024:1', 'plan facts on the dataset: ' + JSON.stringify(ds.plan));
      const files = await D.require('data/dataset-files').list(meta.id);
      assert.ok(files.some((f) => f.name === 'dp-2024-1.geojson' && f.kind === 'original'), 'the original kept');
      // Bearbeta: the plan map with filled uses, outlines, labels and the legend in the inspector.
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('.dm-plan-view.leaflet-container .leaflet-overlay-pane canvas'), 10000, 'plan map');
      await waitFor(() => root.querySelectorAll('.dm-plan-label').length >= 2, 5000, 'designation labels');
      const labels = Array.from(root.querySelectorAll('.dm-plan-label')).map((e) => e.textContent);
      assert.ok(labels.includes('B'), 'label B: ' + labels.join(','));
      await waitFor(() => root.querySelectorAll('.dm-right .dm-plan-legend li').length === 2, 5000, 'legend with two uses');
      const swatch = /** @type {HTMLElement} */ (root.querySelector('.dm-right .dm-plan-legend li .dm-map-legend-swatch'));
      assert.ok(swatch && /244, 224, 122|f4e07a/i.test(swatch.style.background), 'B is yellow: ' + swatch.style.background);
      assert.equal(root.querySelectorAll('.dm-right .dm-plan-layers dm-switch').length, 3, 'layer switches for plan area, uses and property provisions');
      assert.ok(buttonByText(t('bearbeta.view.table')), 'table button');
      buttonByText(t('bearbeta.view.table')).click();
      await waitFor(() => root.querySelectorAll('dm-table .dm-tr').length === 4, 5000, 'four rows in the table');
      // Hantera shows the plan with its button; Analysera gets the Plan tab with the tools.
      shell.activate('hantera');
      await waitFor(() => buttonByText(t('hantera.view.plan')), 5000, 'Visa plan button');
      shell.activate('analysera');
      await waitFor(() => tabByText(t('analysera.tabs.plan')), 5000, 'Plan tab');
      tabByText(t('analysera.tabs.plan')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length >= 8, 10000, 'summary rows');
      tabByText(t('plan.tool.provisions')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 3, 10000, 'three provisions');
      tabByText(t('plan.tool.areas')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 2, 10000, 'two uses with areas');
      return 'ok';
    } finally {
      if (meta) await datasets.remove(meta.id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('plan: an ÖP-model GeoPackage imports whole as a comprehensive plan with its themes', async (assert) => {
    // Build a small GeoPackage with sql.js: one land-use layer and the plan table, geometry as GPB (SWEREF 99 TM).
    const wkbPolygon = (rings) => {
      const n = 9 + rings.reduce((s, r) => s + 4 + r.length * 16, 0);
      const buf = new ArrayBuffer(n); const dv = new DataView(buf); let pos = 0;
      dv.setUint8(pos++, 1); dv.setUint32(pos, 3, true); pos += 4; dv.setUint32(pos, rings.length, true); pos += 4;
      for (const r of rings) { dv.setUint32(pos, r.length, true); pos += 4; for (const c of r) { dv.setFloat64(pos, c[0], true); dv.setFloat64(pos + 8, c[1], true); pos += 16; } }
      return new Uint8Array(buf);
    };
    const gpb = (geometry, srs) => { const wkb = wkbPolygon(geometry.coordinates); const out = new Uint8Array(8 + wkb.length); out[0] = 0x47; out[1] = 0x50; out[2] = 0; out[3] = 0x01; new DataView(out.buffer).setInt32(4, srs, true); out.set(wkb, 8); return out; };
    const engine = new sqlite.SqliteEngine();
    await engine.start(); await engine.open();
    await engine.exec("create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text); insert into gpkg_spatial_ref_sys values ('SWEREF99 TM', 3006, 'EPSG', 3006, ''); create table gpkg_contents (table_name text primary key, data_type text, identifier text, srs_id integer); create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer);");
    await engine.exec("create table innehall_op_markochvattenanvandning_polygon (fid integer primary key, geom blob, objektidentitet text, namn text, innehallstyp_varde text, precisering text, anvandningsstatus text, kompletterandeInnehallstyp text, utbyggnadsordning text, planhandelse_varde text, planhandelse_datum text, beslut text); insert into gpkg_contents values ('innehall_op_markochvattenanvandning_polygon', 'features', 'Mark- och vattenanvändning', 3006); insert into gpkg_geometry_columns values ('innehall_op_markochvattenanvandning_polygon', 'geom', 'MULTIPOLYGON', 3006, 0, 0);");
    await engine.exec("create table oversiktsplan (OBJECTID integer primary key, objektidentitet text, kommunkod text, planens_titel text, planhandelse_varde text, planhandelse_datum text, datum_paborjat text); insert into oversiktsplan values (1, 'op-1', '1880', 'Översiktsplan Testköping 2040', 'Antagen', '2025-06-10', '2022-01-01'); insert into gpkg_contents values ('oversiktsplan', 'attributes', 'Översiktsplan', null); create table innehall_op_markochvattenanvandning_lookup (fid integer primary key, innehallstyp_varde text); insert into gpkg_contents values ('innehall_op_markochvattenanvandning_lookup', 'attributes', 'lookup', null);");
    await engine.run('insert into innehall_op_markochvattenanvandning_polygon (fid, geom, objektidentitet, namn, innehallstyp_varde, precisering, anvandningsstatus, planhandelse_varde, planhandelse_datum) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, gpb(sq(512000, 6571000, 1000, 1000), 3006), 'o-1', 'Centrum', 'Bostadsbebyggelse', 'Flerbostadshus', 'Pågående', 'Antagen', '2025-06-10']);
    await engine.run('insert into innehall_op_markochvattenanvandning_polygon (fid, geom, objektidentitet, namn, innehallstyp_varde, precisering, anvandningsstatus, planhandelse_varde, planhandelse_datum) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', [2, gpb(sq(513000, 6571000, 500, 1000), 3006), 'o-2', 'Ängen', 'Grönområde', '', 'Ny', 'Antagen', '2025-06-10']);
    const bytes = await engine.export();
    engine.terminate();
    const file = new File([bytes], 'op-testkoping.gpkg', { type: 'application/geopackage+sqlite3' });
    let meta = null;
    try {
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'sqlite'); assert.ok(p.oversiktsplan, 'recognised as an ÖP-model GeoPackage');
      meta = await importer.run(file, { plan: true }, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 2); assert.equal(meta.name, 'Översiktsplan Testköping 2040');
      assert.ok(meta.plan && meta.plan.slag === 'oversiktsplan' && meta.plan.kommunkod === '1880' && meta.plan.status === 'Antagen', JSON.stringify(meta.plan));
      const cols = await datasets.columns(meta.id);
      assert.deepEqual(cols.map((c) => c.name), plan.OP_COLUMNS.map((c) => c.name));
      const rows = await D.require('viz/data').fetchRows(meta.id, { fields: cols.map((c) => c.name), limit: 10 });
      assert.deepEqual(rows.rows.map((r) => [r.tema, r.innehallstyp, r.namn]), [['markochvattenanvandning', 'Bostadsbebyggelse', 'Centrum'], ['markochvattenanvandning', 'Grönområde', 'Ängen']]);
      const g = geo.parseGeometry(rows.rows[0].geometri);
      assert.ok(g && g.type === 'Polygon' && g.coordinates[0][0][0] > 15 && g.coordinates[0][0][1] > 59, 'GPB decoded and converted to WGS 84');
      assert.equal(plan.opFillOf(rows.rows[0]), plan.OP_USE_COLORS.bostadsbebyggelse);
      const areas = plan.areasByUse(rows.rows, 'oversiktsplan');
      assert.equal(areas.length, 2); assert.ok(Math.abs(areas[0].area - 1e6) < 2000, 'about 100 ha: ' + areas[0].area);
      // The same file as one table when the plan switch is off.
      const tableMeta = await importer.run(file, { table: 'innehall_op_markochvattenanvandning_polygon' }, null, 'ÖP som tabell');
      try { assert.equal(tableMeta.kind, 'table'); assert.equal(tableMeta.rowCount, 2); } finally { await datasets.remove(tableMeta.id).catch(() => {}); }
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  }, 60000);
})();
