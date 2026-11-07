// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for coordinate systems: the app's conversions against PROJ, names and codes as files give them, systems the app cannot
 * convert (no place rather than a wrong one, and a warning), the dataset's own system on maps, height systems in plans, and the
 * plan map in the plan's own grid (proj4js and Proj4Leaflet). The reference points were computed outside the app with
 * PROJ 9.8.1 (GDAL 3.13.3, scratch `300/proj_reference.py`). Nothing touches the net: tiles come from stub factories.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const geo = D.require('data/geo');
  const datasets = D.require('data/datasets');

  /** [EPSG code, x, y, longitude, latitude] from PROJ. */
  const PROJ_POINTS = [
    [3006, 674032, 6580822, 18.0591897364, 59.3302312269],
    [3006, 719000, 7536000, 20.2113549074, 67.8556156214],
    [3006, 374000, 6164000, 12.9998997495, 55.6055965369],
    [3006, 917000, 7323000, 24.1262679832, 65.7552744645],
    [3006, 280000, 6470000, 11.24376212, 58.3157094964],
    [3007, 150000, 6200000, 12.0, 55.9230921009],
    [3007, 95000, 6250000, 11.1099762304, 56.368954434],
    [3008, 150000, 6250000, 13.5, 56.3721488299],
    [3008, 205000, 6300000, 14.4006403968, 56.8179238018],
    [3009, 150000, 6300000, 15.0, 56.8211728169],
    [3009, 90000, 6350000, 14.0055737577, 57.266231172],
    [3010, 150000, 6450000, 16.5, 58.1680505886],
    [3010, 210000, 6400000, 17.5067040902, 57.715122143],
    [3011, 150000, 6580000, 18.0, 59.3351129032],
    [3011, 95000, 6600000, 17.0286123399, 59.5110356442],
    [3012, 150000, 6600000, 14.25, 59.5146421566],
    [3012, 210000, 6550000, 15.295822366, 59.0615931959],
    [3013, 150000, 6650000, 15.75, 59.9634436127],
    [3013, 90000, 6700000, 14.6612723729, 60.4077651667],
    [3014, 150000, 6750000, 17.25, 60.860954572],
    [3014, 210000, 6800000, 18.3696956988, 61.3050494211],
    [3015, 150000, 6950000, 18.75, 62.6556168806],
    [3015, 90000, 7000000, 17.5618484375, 63.099231687],
    [3016, 150000, 7100000, 20.25, 64.0013087491],
    [3016, 210000, 7150000, 21.4960930831, 64.4445362334],
    [3017, 150000, 7300000, 21.75, 65.7951752193],
    [3017, 90000, 7350000, 20.4160360572, 66.2378417],
    [3018, 150000, 7350000, 23.25, 66.2435746689],
    [3018, 200000, 7400000, 24.3818243106, 66.687880873],
    [3021, 1628000, 6580822, 18.0539344407, 59.3287761471],
    [3021, 1323000, 6161000, 13.0007664203, 55.5463751566],
    [3021, 1683000, 7535000, 20.1553948602, 67.85034633],
    [25832, 723000, 6175000, 12.5461909536, 55.6695118859],
    [25832, 297000, 6700000, 5.3163489021, 60.3853133294],
    [25833, 264000, 6650000, 10.7772373052, 59.9197086454],
    [25833, 653000, 7734000, 18.9482646752, 69.6698317989],
    [25834, 530000, 7000000, 21.5948845709, 63.1280928424],
    [25835, 386000, 6672000, 24.9454662221, 60.1689464737],
    [32632, 723000, 6175000, 12.5461909536, 55.6695118848],
    [32633, 264000, 6650000, 10.7772373053, 59.9197086443],
    [32634, 530000, 7000000, 21.5948845709, 63.1280928413],
    [32635, 386000, 6672000, 24.9454662222, 60.1689464726],
    [3067, 385000, 6672000, 24.9274577133, 60.1686659998],
    [3067, 443000, 7376000, 25.7190244567, 66.4979578826],
    [3873, 19552000, 6670000, 19.9358675302, 60.1396497661],
    [3879, 25496000, 6672000, 24.9279653582, 60.16088692],
    [3885, 31495000, 6950000, 30.9024749308, 62.6555829673],
    [3057, 356000, 408000, -21.9591669469, 64.1445077242],
    [3057, 600000, 560000, -16.8373900196, 65.5228285151],
    [3857, 2010000, 8255000, 18.0561372108, 59.3434828736],
    [3857, 1116000, 7470000, 10.0251985708, 55.5533028792],
  ];
  /** Metres between two positions in degrees (local plane; fine for differences of millimetres or decimetres). */
  const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(b[1] * Math.PI / 180), (a[1] - b[1]) * 110574);

  test('crs: the conversions agree with PROJ within a millimetre (RT 90 2,5 gon V within 0.3 m, a direct projection)', async (assert) => {
    let worst = 0;
    for (const [code, x, y, lon, lat] of PROJ_POINTS) {
      const g = geo.toWgs84({ type: 'Point', coordinates: [x, y] }, 'EPSG:' + code);
      assert.ok(g, 'converted: EPSG:' + code);
      const d = metres(g.coordinates, [lon, lat]);
      const tolerance = code === 3021 ? 0.3 : 0.001;
      assert.ok(d < tolerance, `EPSG:${code} (${x}, ${y}): ${(d * 1000).toFixed(3)} mm from PROJ`);
      if (code !== 3021) worst = Math.max(worst, d);
    }
    assert.ok(worst < 0.0002, 'within a fifth of a millimetre over all grids but RT 90: ' + (worst * 1000).toFixed(4) + ' mm');
    // SWEREF 99 TM both ways: the forward formula takes PROJ's degrees back to the grid.
    for (const [code, x, y, lon, lat] of PROJ_POINTS.filter((p) => p[0] === 3006)) {
      const [e, n] = geo.wgs84ToSweref(lon, lat);
      assert.ok(Math.abs(e - x) < 0.001 && Math.abs(n - y) < 0.001, `SWEREF 99 TM forward (${x}, ${y}): ${e.toFixed(4)}, ${n.toFixed(4)}`);
    }
    return 'ok';
  });

  test('crs: systems are read from codes, URNs and names as files write them; one the app cannot convert gives no place', async (assert) => {
    const cases = [
      [3006, 3006], ['EPSG:3007', 3007], ['urn:ogc:def:crs:EPSG::3010', 3010], ['http://www.opengis.net/def/crs/EPSG/0/3011', 3011],
      ['SWEREF99 TM', 3006], ['SWEREF99_TM', 3006], ['SWEREF99 15 00', 3009], ['SWEREF99_13_30', 3008], ['SWEREF99 1200', 3007], ['SWEREF 99 23 15', 3018],
      ['RT90 2.5 gon V', 3021], ['RT90_25_gon_W', 3021], ['ETRS89 / UTM zone 33N', 25833], ['ETRS_1989_UTM_Zone_32N', 25832], ['WGS_1984_UTM_Zone_35N', 32635],
      ['ETRS89 / TM35FIN(E,N)', 3067], ['ETRS89 / GK25FIN', 3879], ['ISN93 / Lambert 1993', 3057], ['WGS 84 / Pseudo-Mercator', 3857],
      ['WGS 84', 4326], ['GCS_WGS_1984', 4326], ['urn:ogc:def:crs:OGC:1.3:CRS84', 4326], ['ETRS89', 4258],
    ];
    for (const [given, code] of cases) {
      assert.equal(geo.crsCode(given), code, String(given));
      assert.ok(geo.knownCrs(given) && !geo.crsUnknown(given), 'known: ' + given);
    }
    for (const unknown of ['EPSG:3152', 'RT90 5 gon V', 'Lokalt system Stockholm', 'EPSG:5105']) {
      assert.ok(geo.crsUnknown(unknown), 'unknown: ' + unknown);
      assert.equal(geo.toWgs84({ type: 'Point', coordinates: [150000, 6580000] }, unknown), null, 'no place for ' + unknown);
    }
    for (const nothing of ['', null, undefined, 'Undefined Cartesian SRS', 'Undefined geographic SRS']) {
      assert.ok(!geo.crsUnknown(nothing), 'a file that names no system is not unknown: ' + String(nothing));
      const g = geo.toWgs84({ type: 'Point', coordinates: [674032, 6580822] }, nothing);
      assert.ok(g && Math.abs(g.coordinates[0] - 18.06) < 0.01, 'taken as SWEREF 99 TM: ' + String(nothing));
    }
    assert.equal(geo.toWgs84({ type: 'Point', coordinates: [674032, 6580822] }, 'EPSG:4326'), null, 'degrees declared for metres: no place');
    assert.deepEqual(geo.toWgs84({ type: 'Point', coordinates: [18, 59] }, 'EPSG:3152').coordinates, [18, 59], 'degrees pass through whatever the file says');
    assert.deepEqual([geo.crsLabel(3006), geo.crsLabel('SWEREF99 15 00'), geo.crsLabel(3014), geo.crsText('EPSG:3009'), geo.crsText('EPSG:3152')],
      ['SWEREF 99 TM', 'SWEREF 99 15 00', 'SWEREF 99 17 15', 'SWEREF 99 15 00 (EPSG:3009)', 'EPSG:3152']);
    assert.deepEqual([geo.heightLabel('EPSG:5613'), geo.heightLabel('urn:ogc:def:crs:EPSG::5718'), geo.heightLabel('EPSG:5941'), geo.heightLabel(''), geo.heightLabel('Lokalt')], ['RH 2000', 'RH 70', 'NN2000', '', 'Lokalt']);
    return 'ok';
  });

  test('crs: a map in the plan\'s grid puts every object where the conversion does (proj4js and Proj4Leaflet)', async (assert) => {
    const leaflet = D.require('viz/leaflet');
    const L = await leaflet.ensureProj();
    const proj4 = /** @type {any} */ (globalThis).proj4;
    const grids = [3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018, 3021, 25832, 25833, 3067, 3879, 3057];
    for (const code of grids) {
      const [x, y] = (PROJ_POINTS.find((p) => p[0] === code) || []).slice(1, 3);
      const g = geo.toWgs84({ type: 'Point', coordinates: [x, y] }, code);
      const back = proj4(geo.proj4Def(code)).forward(g.coordinates);
      assert.ok(Math.abs(back[0] - x) < 0.001 && Math.abs(back[1] - y) < 0.001, `EPSG:${code} with proj4js: ${back[0].toFixed(4)}, ${back[1].toFixed(4)}`);
      const crs = leaflet.gridCrs(code);
      const p = crs.project(L.latLng(g.coordinates[1], g.coordinates[0]));
      assert.ok(Math.abs(p.x - x) < 0.001 && Math.abs(p.y - y) < 0.001, `EPSG:${code} in the Leaflet CRS: ${p.x.toFixed(4)}, ${p.y.toFixed(4)}`);
      assert.equal(crs.code, 'EPSG:' + code);
    }
    assert.equal(leaflet.gridCrs(3857), null, 'Web Mercator is Leaflet\'s own');
    assert.equal(leaflet.gridCrs('EPSG:3152'), null, 'no grid for an unknown system');
    return 'ok';
  });

  test('crs: a map in SWEREF 99 takes a WMS background in the same grid (WMS 1.1.1) but not OpenStreetMap', async (assert) => {
    const leaflet = D.require('viz/leaflet');
    const consent = D.require('platform/consent');
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute; left:-10000px; width:800px; height:500px;';
    document.body.appendChild(el);
    const prior = await consent.state('basemaps');
    consent.setAsker(async () => ({ allow: true, remember: false }));
    try {
      const made = [];
      const factory = (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; };
      const wms = { url: 'dataspatium-asset://tests/geo/wms', layers: 'grundkarta', format: 'image/png', transparent: false, attribution: 'Test', version: '1.3.0' };
      const hd = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'wms', wms, crs: 3010 } }, { tileFactory: factory });
      assert.equal(hd.crs, 3010, 'the map is in SWEREF 99 16 30');
      assert.equal(hd.map.options.crs.code, 'EPSG:3010');
      assert.equal(made.length, 1, 'one WMS layer');
      assert.equal(made[0].opts.version, '1.1.1', 'asked for with WMS 1.1.1 (x before y in SWEREF 99)');
      assert.equal(made[0].opts.layers, 'grundkarta');
      hd.finalize();
      made.length = 0;
      const hd2 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'osm', crs: 3006 } }, { tileFactory: factory });
      assert.ok(hd2.info.basemapProjection, 'OpenStreetMap has no tiles in SWEREF 99');
      assert.equal(made.length, 0, 'no tile layer');
      hd2.finalize();
      const hd3 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'wms', wms } }, { tileFactory: factory });
      assert.equal(hd3.crs, 3857, 'without a grid the map is Web Mercator');
      assert.equal(made[0].opts.version, '1.3.0', 'and the WMS version stays as given');
      hd3.finalize();
    } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      el.remove();
    }
    return 'ok';
  }, 30000);

  test('crs: a table in a local SWEREF zone lands in its place; one in a system the app cannot convert is not drawn and is named', async (assert) => {
    const leaflet = D.require('viz/leaflet');
    // A point in SWEREF 99 15 00 (EPSG:3009) and the same point's place from PROJ.
    const [, x, y, lon, lat] = PROJ_POINTS.find((p) => p[0] === 3009);
    const columns = [{ name: 'namn', type: 'text' }, { name: 'geometry', type: 'text' }];
    const rows = [['punkt', JSON.stringify({ type: 'Point', coordinates: [x, y] })]];
    const made = [];
    try {
      const zone = await datasets.create({ name: 'Zon 15 00', columns, rows, importOptions: { format: 'geopackage', crs: 'SWEREF99 15 00' } }); made.push(zone.id);
      const a = await leaflet.featuresOf({ kind: 'dataset', datasetId: zone.id, geometry: 'geometry' });
      assert.equal(a.features.length, 1);
      assert.ok(metres(a.features[0].geometry.coordinates, [lon, lat]) < 0.001, 'in its place: ' + a.features[0].geometry.coordinates.join(', '));
      assert.equal(a.crsUnknown, '');
      const odd = await datasets.create({ name: 'Okänt system', columns, rows, importOptions: { format: 'geopackage', crs: 'RT90 5 gon V' } }); made.push(odd.id);
      const b = await leaflet.featuresOf({ kind: 'dataset', datasetId: odd.id, geometry: 'geometry' });
      assert.equal(b.features.length, 0, 'not drawn in the wrong place');
      assert.equal(b.crsUnknown, 'RT90 5 gon V', 'and the system is named');
      // The GeoJSON export converts from the dataset's own system (RFC 7946 is WGS 84).
      const blob = await D.require('io/export').toGeoJson(zone.id);
      const out = JSON.parse(await blob.text());
      assert.ok(metres(out.features[0].geometry.coordinates, [lon, lat]) < 0.001, 'exported in degrees: ' + out.features[0].geometry.coordinates.join(', '));
    } finally { for (const id of made) await datasets.remove(id).catch(() => {}); }
    return 'ok';
  }, 30000);

  /** A small detaljplan per Detaljplan 4.1 in `crs` (SWEREF 99 12 00 unless given), with a height limit in RH 2000 and a point. */
  function plan41(crs) {
    const g = (typ, position, extra) => [{ geometri: Object.assign({ typ, position, koordinatsystemPlan: crs, dimension: 2 }, extra || {}) }];
    const square = (x0, y0, d, z) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0 + d, y0], [x0 + d, y0 + d], [x0, y0 + d], [x0, y0]].map((c) => (z === undefined ? c : c.concat(z)))] });
    return { type: 'FeatureCollection', 'feature:mediatyp': 'application/vnd.lm.detaljplan.v4+json', features: [
      { type: 'Feature', id: 'p1', geometry: null, properties: { 'feature:typ': 'detaljplan', objektidentitet: 'p1', namn: 'Plan i zonen ' + crs, beteckning: 'DP 1', status: 'laga kraft', kommun: '1280', plangeometri: g('yta', square(150000, 6200000, 200)) } },
      { type: 'Feature', id: 'b1', geometry: null, properties: { 'feature:typ': 'användningsbestämmelse', detaljplan: 'p1', objektidentitet: 'b1', bestammelseformulering: 'Bostäder', planbestammelsekatalogreferens: 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36', bestammelsegeometri: g('yta', square(150000, 6200000, 100)) } },
      { type: 'Feature', id: 'h1', geometry: null, properties: { 'feature:typ': 'egenskapsbestämmelse', detaljplan: 'p1', objektidentitet: 'h1', bestammelseformulering: 'Högsta nockhöjd är 12 meter', vertikalAvgransning: 'nedåt', bestammelsegeometri: g('yta', square(150010, 6200010, 50, 4.5), { dimension: 3, hojdsystem: 'EPSG:5613' }) } },
      { type: 'Feature', id: 'n1', geometry: null, properties: { 'feature:typ': 'egenskapsbestämmelse', detaljplan: 'p1', objektidentitet: 'n1', bestammelseformulering: 'Markens höjd', bestammelsegeometri: g('punkt', { type: 'Point', coordinates: [150060, 6200060] }) } },
    ] };
  }

  test('crs: a plan names its coordinate and height systems; in a system the app cannot convert its objects are kept without a place', async (assert) => {
    const plan = D.require('data/plan');
    const ok = plan.fromDetaljplan(plan41('EPSG:3007'));
    assert.deepEqual([ok.plan.crs, ok.plan.hojdsystem], ['EPSG:3007', 'EPSG:5613']);
    assert.ok(ok.rows.every((r) => r.geometri), 'every object placed');
    const point = JSON.parse(ok.rows.find((r) => r.objektid === 'n1').geometri);
    assert.deepEqual(point.coordinates, geo.toWgs84({ type: 'Point', coordinates: [150060, 6200060] }, 'EPSG:3007').coordinates, 'in SWEREF 99 12 00');
    const odd = plan.fromDetaljplan(plan41('EPSG:3152'));
    assert.equal(odd.rows.length, 4, 'the objects are read');
    assert.ok(odd.rows.every((r) => !r.geometri), 'none in the wrong place');
    assert.ok(geo.crsUnknown(odd.plan.crs), 'the system is known to be unknown');
    const p = await D.require('io/import').preview(new File([JSON.stringify(plan41('EPSG:3152'))], 'okand.json', { type: 'application/json' }), {});
    assert.equal(p.crsUnknown, 'EPSG:3152', 'Inhämta can say so');
    return 'ok';
  });

  test('crs: the plan map in the plan\'s own grid puts objects at their coordinates; the inspector names both systems and an unknown one', async (assert) => {
    const t = D.require('ui/i18n').t;
    const importer = D.require('io/import');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
    }
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const made = [];
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const meta = await importer.run(new File([JSON.stringify(plan41('EPSG:3007'))], 'zonplan.json', { type: 'application/json' }), {}, null, null); made.push(meta.id);
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'the plan in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      const right = () => /** @type {HTMLElement} */ (root.querySelector('.dm-right'));
      await waitFor(() => right() && right().textContent.includes('SWEREF 99 12 00 (EPSG:3007)'), 10000, 'the coordinate system in the inspector');
      assert.ok(right().textContent.includes(t('plan.field.hojdsystem')) && right().textContent.includes('RH 2000'), 'the height system');
      // The map in the plan's grid: north up as on the plan map, every object where its coordinates say.
      const choice = /** @type {any} */ (await waitFor(() => root.querySelector('[data-plan-projection]'), 5000, 'the choice of system'));
      assert.ok(choice.options.some((o) => o.value === 'plan' && o.label === 'SWEREF 99 12 00'), 'offered by name');
      choice.value = 'plan';
      choice.dispatchEvent(new Event('change'));
      const map = await waitFor(() => { const el = /** @type {any} */ (root.querySelector('.dm-plan-view')); return el && el._dmMap && el._dmMap.options.crs.code === 'EPSG:3007' ? el._dmMap : null; }, 10000, 'the map in SWEREF 99 12 00');
      const L = /** @type {any} */ (globalThis).L;
      const point = geo.toWgs84({ type: 'Point', coordinates: [150060, 6200060] }, 'EPSG:3007').coordinates;
      const p = map.options.crs.project(L.latLng(point[1], point[0]));
      assert.ok(Math.abs(p.x - 150060) < 0.001 && Math.abs(p.y - 6200060) < 0.001, `the point at its coordinates: ${p.x.toFixed(4)}, ${p.y.toFixed(4)}`);
      const basemap = /** @type {any} */ (root.querySelector('[data-plan-basemap]'));
      assert.ok(!basemap.options.some((o) => o.value === 'osm'), 'no OpenStreetMap in SWEREF 99');
      assert.ok(basemap.options.some((o) => o.value === 'wms'), 'a WMS can be the background');
      // A plan in a system the app cannot convert: the inspector says so, and the objects are listed without a place.
      const odd = await importer.run(new File([JSON.stringify(plan41('EPSG:3152'))], 'st74.json', { type: 'application/json' }), {}, null, null); made.push(odd.id);
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === odd.id), 5000, 'the second plan in store');
      shell.store.set({ selectedId: odd.id });
      const warning = await waitFor(() => root.querySelector('.dm-right [data-plan-crs-unknown]'), 10000, 'the warning');
      assert.ok(warning.textContent.includes('EPSG:3152'), warning.textContent);
      assert.ok(root.querySelector('.dm-right [data-plan-unplaced]'), 'the objects without a place');
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      for (const id of made) await datasets.remove(id).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('crs: a GeoJSON file names its system in `crs` (the 2008 form); Inhämta says when the app cannot convert it', async (assert) => {
    const importer = D.require('io/import');
    const fc = (name) => JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name } }, features: [{ type: 'Feature', properties: { namn: 'a' }, geometry: { type: 'Point', coordinates: [150000, 6580000] } }] });
    const ok = await importer.preview(new File([fc('urn:ogc:def:crs:EPSG::3011')], 'zon.geojson', { type: 'application/geo+json' }), {});
    assert.equal(ok.crs, 'urn:ogc:def:crs:EPSG::3011');
    assert.ok(!ok.crsUnknown, 'a system the app reads');
    const bad = await importer.preview(new File([fc('urn:ogc:def:crs:EPSG::3152')], 'st74.geojson', { type: 'application/geo+json' }), {});
    assert.equal(bad.crsUnknown, 'urn:ogc:def:crs:EPSG::3152', 'named for the warning');
    const meta = await importer.run(new File([fc('urn:ogc:def:crs:EPSG::3011')], 'zon.geojson', { type: 'application/geo+json' }), {}, null, 'Zon 18 00');
    try {
      assert.equal(geo.crsOfMeta(meta), 'urn:ogc:def:crs:EPSG::3011', 'kept with the dataset');
    } finally { await datasets.remove(meta.id).catch(() => {}); }
    return 'ok';
  }, 30000);
})();
