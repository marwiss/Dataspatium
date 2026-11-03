// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the bundled SCB boundaries, SWEREF 99 TM conversion, point maps and GeoJSON export. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const builder = D.require('viz/vega-builder');
  const basemaps = D.require('data/boundaries');
  const charts = D.require('viz/charts');
  const render = D.require('viz/render');
  const geo = D.require('data/geo');
  const presets = D.require('presets');
  const created = [];

  test('geo: SWEREF 99 TM and WGS 84 convert both ways', async (assert) => {
    const [e, n] = geo.wgs84ToSweref(15, 60);
    assert.ok(Math.abs(e - 500000) < 1e-6, 'central meridian is the false easting: ' + e);
    assert.ok(Math.abs(n - 6651411) < 100, 'northing of 60°N: ' + n);
    const [lon, lat] = geo.swerefToWgs84(674032, 6580822);
    assert.ok(Math.abs(lon - 18.06) < 0.05 && Math.abs(lat - 59.33) < 0.05, 'central Stockholm: ' + lon + ', ' + lat);
    const [e2, n2] = geo.wgs84ToSweref(lon, lat);
    assert.ok(Math.abs(e2 - 674032) < 0.001 && Math.abs(n2 - 6580822) < 0.001, 'round trip within a millimetre');
    const g = geo.toWgs84({ type: 'Polygon', coordinates: [[[600000, 6500000], [600000, 6501000], [601000, 6501000], [600000, 6500000]]] });
    assert.ok(g.coordinates[0].every((c) => c[0] > 16 && c[0] < 17.5 && c[1] > 58 && c[1] < 59.2), 'polygon converted: ' + JSON.stringify(g.coordinates[0][0]));
    assert.deepEqual(geo.toWgs84({ type: 'Point', coordinates: [18, 59] }).coordinates, [18, 59], 'degrees pass through');
    assert.deepEqual(geo.bounds([{ type: 'Point', coordinates: [1, 2] }, { type: 'LineString', coordinates: [[3, -1], [0, 5]] }]), { minX: 0, minY: -1, maxX: 3, maxY: 5 });
    assert.equal(geo.bounds([]), null);
    return lon.toFixed(4) + ', ' + lat.toFixed(4);
  });

  test('geo: the bundled SCB boundaries import as datasets with codes and WGS 84 geometry', async (assert) => {
    const lan = presets.examples.find((p) => p.id === 'lan-scb');
    const kommuner = presets.examples.find((p) => p.id === 'kommuner-scb');
    assert.ok(lan && kommuner, 'presets listed');
    const meta = await importer.runPreset(lan);
    created.push(meta.id);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.name), ['lanskod', 'lan', 'geometry_type', 'geometry']);
    assert.equal(cols[0].type, 'text', 'codes with leading zeros stay text');
    const rows = await datasets.query(meta.id);
    assert.equal(rows.length, 21);
    const stockholm = rows.find((r) => r[0] === '01');
    assert.equal(stockholm[1], 'Stockholms län');
    const g = JSON.parse(stockholm[3]);
    assert.ok(g.type === 'Polygon' || g.type === 'MultiPolygon', g.type);
    const b = geo.bounds([g]);
    assert.ok(b.minX > 17 && b.maxX < 20 && b.minY > 58.5 && b.maxY < 60.5, 'Stockholm county in degrees: ' + JSON.stringify(b));
    assert.ok(!geo.isProjected([g]));
    const feats = await basemaps.features('kommuner');
    assert.equal(feats.length, 290);
    assert.ok(feats.some((f) => f.code === '0180' && f.name === 'Stockholm'), 'Stockholm municipality present');
    assert.deepEqual(await basemaps.features('nope'), []);
    const all = geo.bounds(feats.map((f) => f.geometry));
    assert.ok(all.minX > 10.5 && all.maxX < 24.5 && all.minY > 55 && all.maxY < 69.5, 'Sweden extent: ' + JSON.stringify(all));
    assert.ok((await basemaps.features('lan')) === (await basemaps.features('lan')), 'cached');
    return rows.length + ' län, ' + feats.length + ' kommuner';
  }, 30000);

  test('geo: point maps pick coordinates, convert metres, layer over boundaries and render', async (assert) => {
    const columns = [{ name: 'station', type: 'text' }, { name: 'longitude', type: 'number' }, { name: 'latitude', type: 'number' }, { name: 'temp', type: 'number' }];
    const state = builder.defaultState('pointmap', columns);
    assert.equal(state.x.field, 'longitude'); assert.equal(state.y.field, 'latitude'); assert.equal(state.size.field, 'temp'); assert.equal(state.facet.field, 'station'); assert.equal(state.basemap, 'lan');
    assert.deepEqual(builder.validate(state), []);
    assert.equal(builder.basemapOf(state), 'lan');
    assert.equal(builder.basemapOf(Object.assign({}, state, { basemap: 'none' })), null);
    assert.equal(builder.basemapOf(builder.defaultState('bar', columns)), null);
    const basemap = await basemaps.features('lan');
    const spec = builder.toSpec(state, columns, { values: [{ station: 'Stockholm', longitude: 18.06, latitude: 59.33, temp: 4 }, { station: 'Kiruna', longitude: 20.22, latitude: 67.86, temp: -12 }, { station: 'tom', longitude: null, latitude: 59, temp: 1 }], basemap });
    assert.equal(spec.layer.length, 2);
    assert.equal(spec.layer[0].mark.type, 'geoshape'); assert.equal(spec.layer[0].data.values.length, 21);
    assert.equal(spec.layer[1].mark.type, 'circle'); assert.equal(spec.layer[1].data.values.length, 2, 'rows without coordinates are dropped');
    assert.equal(spec.layer[1].encoding.longitude.field, '__lon'); assert.equal(spec.layer[1].encoding.size.field, 'temp');
    assert.equal(spec.layer[1].encoding.tooltip[0].field, 'station');
    assert.equal(spec.projection.type, 'transverseMercator');
    assert.ok(!spec.data, 'layers carry their own data');
    const metres = builder.toSpec(state, columns, { values: [{ station: 'A', longitude: 674032, latitude: 6580822, temp: 1 }] });
    const p = metres.layer[0].data.values[0];
    assert.ok(Math.abs(p.__lon - 18.06) < 0.05 && Math.abs(p.__lat - 59.33) < 0.05, 'SWEREF 99 TM converted: ' + p.__lon + ', ' + p.__lat);
    assert.equal(metres.layer.length, 1, 'no basemap layer without features');
    const world = builder.toSpec(Object.assign({}, state, { basemap: 'none' }), columns, { values: [{ station: 'A', longitude: -74, latitude: 40.7, temp: 1 }] });
    assert.equal(world.projection.type, 'mercator', 'outside Europe: Mercator');
    const named = builder.toSpec(state, columns, { name: 'table' });
    assert.ok(named.data && named.data.name === 'table' && named.layer[0].transform.length === 2, 'named data uses calculate transforms');
    // Through the shared pipeline: the basemap is loaded from the bundled preset and Vega renders the layers.
    const meta = await datasets.create({ name: 'Stationer', columns: columns.map((c) => Object.assign({ label: c.name }, c)), rows: [['Stockholm', 18.06, 59.33, 4], ['Kiruna', 20.22, 67.86, -12]] });
    created.push(meta.id);
    const chart = charts.create('vega', { id: meta.id, name: 'Stationer' }, 'Punktkarta');
    chart.vega.state = state;
    const prep = await render.prepareVega(chart, { width: 400 });
    assert.equal(prep.spec.layer[0].data.values.length, 21, 'county boundaries loaded for the chart');
    assert.equal(prep.spec.layer[1].data.values.length, 2);
    const svg = await (await render.toBlob(chart, 'svg', { width: 400 })).text();
    // (the embedded font is base64 and may contain the letters "NaN", so look at path coordinates only)
    assert.ok(svg.includes('<path') && !/NaN,NaN|MNaN/.test(svg), 'rendered with a fitted projection');
    assert.equal(prep.spec.layer[0].data.values[0].geometry.type, 'Feature', 'boundaries are Features so that the fit sees them');
    // A choropleth of the bundled boundaries renders too (longitude/latitude, transverse Mercator).
    const lanMeta = await datasets.get(created[0]);
    const lanColumns = await datasets.columns(created[0]);
    const choropleth = charts.create('vega', { id: lanMeta.id, name: lanMeta.name }, 'Länskarta');
    choropleth.vega.state = builder.defaultState('map', lanColumns);
    choropleth.vega.state.color = builder.channel({ name: 'lanskod', type: 'text' });
    const lanSvg = await (await render.toBlob(choropleth, 'svg', { width: 400 })).text();
    assert.ok((lanSvg.match(/<path/g) || []).length > 21 && !/NaN,NaN|MNaN/.test(lanSvg), 'county choropleth renders: ' + (lanSvg.match(/<path/g) || []).length + ' paths');
    assert.equal(builder.validate(builder.defaultState('pointmap', [{ name: 'a', type: 'text' }])).length, 1, 'missing coordinates reported');
    const sw = builder.switchType(state, 'bar', columns);
    assert.ok(!sw.facet, 'the label does not become a facet');
    assert.equal(builder.switchType(builder.defaultState('map', [{ name: 'geometry', type: 'text' }, { name: 'v', type: 'number' }]), 'pointmap', [{ name: 'geometry', type: 'text' }, { name: 'v', type: 'number' }]).x, null, 'geometry text is not reused as longitude');
    return spec.projection.type;
  }, 60000);

  test('geo: GeoJSON export writes a FeatureCollection that imports again', async (assert) => {
    const id = created[0];
    assert.ok(id, 'län dataset from the earlier test');
    const out = await exporter.exportDataset(id, 'geojson');
    assert.ok(/\.geojson$/.test(out.filename), out.filename);
    const fc = JSON.parse(await out.blob.text());
    assert.equal(fc.type, 'FeatureCollection'); assert.equal(fc.features.length, 21);
    const f = fc.features.find((x) => x.properties.lanskod === '01');
    assert.equal(f.properties.lan, 'Stockholms län');
    assert.ok(!('geometry' in f.properties) && !('geometry_type' in f.properties), 'geometry columns are not properties');
    assert.ok(f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    const again = await importer.run(new File([out.blob], 'lan.geojson', { type: 'application/geo+json' }), {}, null, 'Återimport');
    created.push(again.id);
    assert.equal((await datasets.query(again.id)).length, 21);
    // WKT geometry columns export too; datasets without geometry are refused with a Swedish message.
    const wkt = await datasets.create({ name: 'WKT', columns: [{ name: 'namn', type: 'text', label: 'namn' }, { name: 'wkt', type: 'text', label: 'wkt' }], rows: [['A', 'POINT(18 59)']] });
    created.push(wkt.id);
    const fc2 = JSON.parse(await (await exporter.exportDataset(wkt.id, 'geojson')).blob.text());
    assert.deepEqual(fc2.features[0].geometry, { type: 'Point', coordinates: [18, 59] });
    assert.deepEqual(fc2.features[0].properties, { namn: 'A' });
    const plain = await datasets.create({ name: 'Utan geometri', columns: [{ name: 'a', type: 'integer', label: 'a' }], rows: [[1]] });
    created.push(plain.id);
    await assert.throws(() => exporter.exportDataset(plain.id, 'geojson'), /geometri/);
    return fc.features.length + ' features';
  }, 30000);

  test('geo: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
