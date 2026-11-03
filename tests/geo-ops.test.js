// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the geodata operations: centroids, areas, reprojection and region lookup inside the SQLite engine. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const geo = D.require('data/geo');
  const created = [];
  const SQ_WGS = { type: 'Polygon', coordinates: [[[18, 59], [18, 60], [19, 60], [19, 59], [18, 59]]] };
  const SQ_METRES = { type: 'Polygon', coordinates: [[[600000, 6500000], [600000, 6501000], [601000, 6501000], [601000, 6500000], [600000, 6500000]]] };
  // 10 km × 10 km in SWEREF 99 TM metres with a 2 km × 2 km hole: 96 km².
  const HOLE = { type: 'Polygon', coordinates: [[[500000, 6500000], [500000, 6510000], [510000, 6510000], [510000, 6500000], [500000, 6500000]], [[502000, 6502000], [504000, 6502000], [504000, 6504000], [502000, 6504000], [502000, 6502000]]] };
  const col = (name, type) => ({ name, type, label: name });

  test('geo-ops: centroids and areas from GeoJSON and WKT geometry in degrees or metres', async (assert) => {
    const meta = await datasets.create({ name: 'Geometrier', columns: [col('namn', 'text'), col('geometry', 'text')], rows: [['grader', JSON.stringify(SQ_WGS)], ['meter', JSON.stringify(SQ_METRES)], ['hal', JSON.stringify(HOLE)], ['wkt', 'POINT(18.07 59.33)'], ['tom', null]] });
    created.push(meta.id);
    const r1 = await recipes.apply(meta.id, 'geo_centroid', { column: 'geometry', lonName: 'lon', latName: 'lat' });
    assert.equal(r1.rows, 4);
    const r2 = await recipes.apply(meta.id, 'geo_area', { column: 'geometry', name: 'area_km2' });
    assert.equal(r2.rows, 4);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.name), ['namn', 'geometry', 'lon', 'lat', 'area_km2']);
    assert.equal(cols[2].type, 'number'); assert.equal(cols[4].type, 'number');
    const by = Object.fromEntries((await datasets.query(meta.id)).map((r) => [r[0], r]));
    assert.ok(Math.abs(by.grader[2] - 18.5) < 1e-6 && Math.abs(by.grader[3] - 59.5) < 1e-6, 'centroid of a degree square: ' + by.grader[2] + ', ' + by.grader[3]);
    const expectedArea = 6371.0088 * 6371.0088 * (Math.PI / 180) * (Math.sin(60 * Math.PI / 180) - Math.sin(59 * Math.PI / 180));
    assert.ok(Math.abs(by.grader[4] - expectedArea) / expectedArea < 0.002, 'spherical area ' + by.grader[4] + ' vs ' + expectedArea);
    const [lon, lat] = geo.swerefToWgs84(600500, 6500500);
    assert.ok(Math.abs(by.meter[2] - lon) < 1e-6 && Math.abs(by.meter[3] - lat) < 1e-6, 'metre centroid converted to WGS 84: ' + by.meter[2] + ', ' + by.meter[3]);
    assert.ok(Math.abs(by.meter[4] - 1) < 1e-9, '1 km × 1 km = 1 km²: ' + by.meter[4]);
    assert.ok(Math.abs(by.hal[4] - 96) < 1e-9, 'holes are subtracted: ' + by.hal[4]);
    assert.ok(Math.abs(by.wkt[2] - 18.07) < 1e-9 && Math.abs(by.wkt[3] - 59.33) < 1e-9 && by.wkt[4] === null, 'WKT point: own coordinates, no area');
    assert.equal(by.tom[2], null); assert.equal(by.tom[4], null);
    await assert.throws(() => recipes.apply(meta.id, 'geo_area', { column: 'geometry', name: 'lon' }), /finns redan/);
    const sql = await recipes.toSQL(meta.id); const r = await recipes.toR(meta.id);
    assert.ok(/dm_geo_lon/.test(sql) && /dm_geo_area/.test(sql), 'SQL export names the engine functions');
    assert.ok(/sf::st_centroid/.test(r) && /sf::st_area/.test(r), 'R export uses sf');
    return by.grader[4].toFixed(1) + ' km²';
  }, 30000);

  test('geo-ops: coordinate columns convert between SWEREF 99 TM and WGS 84', async (assert) => {
    const meta = await datasets.create({ name: 'Koordinater', columns: [col('plats', 'text'), col('ost', 'number'), col('norr', 'number')], rows: [['Stockholm', 674032, 6580822], ['Saknas', null, 6580822]] });
    created.push(meta.id);
    const res = await recipes.apply(meta.id, 'geo_reproject', { xColumn: 'ost', yColumn: 'norr', direction: 'to_wgs84', xName: '', yName: '' });
    assert.equal(res.rows, 1);
    let rows = await datasets.query(meta.id);
    const [lon, lat] = geo.swerefToWgs84(674032, 6580822);
    assert.ok(Math.abs(rows[0][3] - lon) < 1e-9 && Math.abs(rows[0][4] - lat) < 1e-9, 'lon/lat columns: ' + rows[0][3] + ', ' + rows[0][4]);
    assert.equal(rows[1][3], null, 'missing coordinates stay empty');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['plats', 'ost', 'norr', 'lon', 'lat']);
    await recipes.apply(meta.id, 'geo_reproject', { xColumn: 'lon', yColumn: 'lat', direction: 'to_sweref', xName: 'ost2', yName: 'norr2' });
    rows = await datasets.query(meta.id);
    assert.ok(Math.abs(rows[0][5] - 674032) < 0.001 && Math.abs(rows[0][6] - 6580822) < 0.001, 'round trip within a millimetre: ' + rows[0][5] + ', ' + rows[0][6]);
    assert.ok(/dm_to_east/.test(await recipes.toSQL(meta.id)) && /st_transform/.test(await recipes.toR(meta.id)), 'exports');
    return rows[0][3].toFixed(5) + ', ' + rows[0][4].toFixed(5);
  }, 30000);

  test('geo-ops: kommun and län are looked up from coordinates with the bundled boundaries', async (assert) => {
    // SCB's boundaries are land areas, so the points must be on land: Hammarbyhöjden in Stockholm, central Göteborg, Kiruna.
    const [east, north] = geo.wgs84ToSweref(18.1, 59.3);
    const meta = await datasets.create({ name: 'Platser', columns: [col('plats', 'text'), col('longitude', 'number'), col('latitude', 'number')], rows: [['Stockholm', 18.1, 59.3], ['Göteborg', 11.97, 57.71], ['Kiruna', 20.22, 67.86], ['Oslo', 10.75, 59.91], ['SWEREF', east, north], ['Saknas', null, null]] });
    created.push(meta.id);
    const res = await recipes.apply(meta.id, 'geo_region', { lonColumn: 'longitude', latColumn: 'latitude', level: 'kommun' });
    assert.equal(res.rows, 5); assert.equal(res.matched, 4);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['plats', 'longitude', 'latitude', 'kommunkod', 'kommun', 'lanskod', 'lan']);
    const by = Object.fromEntries((await datasets.query(meta.id)).map((r) => [r[0], r]));
    assert.deepEqual(by.Stockholm.slice(3), ['0180', 'Stockholm', '01', 'Stockholms län']);
    assert.equal(by['Göteborg'][3], '1480'); assert.equal(by.Kiruna[3], '2584'); assert.equal(by.Kiruna[6], 'Norrbottens län');
    assert.equal(by.Oslo[3], null, 'outside Sweden');
    assert.equal(by.SWEREF[3], '0180', 'metres are converted before the lookup');
    assert.equal(by.Saknas[3], null);
    await assert.throws(() => recipes.apply(meta.id, 'geo_region', { lonColumn: 'longitude', latColumn: 'latitude', level: 'lan' }), /finns redan/);
    const sql = await recipes.toSQL(meta.id);
    assert.ok(/dm_region\("longitude", "latitude", 'kommunkod'\)/.test(sql), sql);
    assert.ok(/st_join/.test(await recipes.toR(meta.id)), 'R export uses sf::st_join');
    await recipes.undo(meta.id);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['plats', 'longitude', 'latitude'], 'undo removes the columns');
    const lan = await datasets.create({ name: 'Platser län', columns: [col('plats', 'text'), col('lon', 'number'), col('lat', 'number')], rows: [['Visby', 18.3, 57.64], ['Luleå', 22.15, 65.58]] });
    created.push(lan.id);
    const r2 = await recipes.apply(lan.id, 'geo_region', { lonColumn: 'lon', latColumn: 'lat', level: 'lan' });
    assert.equal(r2.matched, 2);
    const rows = await datasets.query(lan.id);
    assert.deepEqual(rows.map((r) => r.slice(3)), [['09', 'Gotlands län'], ['25', 'Norrbottens län']]);
    return res.matched + ' av ' + res.rows;
  }, 60000);

  test('geo-ops: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
