// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for GeoPackage import, fixed-width text import and import from a web address. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const sqlite = D.require('engines/sqlite');
  const builder = D.require('viz/vega-builder');
  const urlImport = D.require('io/url-import');
  const notebooks = D.require('analysis/notebooks');
  const created = []; const nbIds = [];

  /** GeoPackage binary blob for a WKB polygon with one ring (little endian, no envelope). */
  function gpb(ring, srsId = 3006) {
    const wkbLen = 1 + 4 + 4 + 4 + ring.length * 16;
    const out = new Uint8Array(8 + wkbLen); const dv = new DataView(out.buffer);
    out[0] = 0x47; out[1] = 0x50; out[2] = 0; out[3] = 0x01;
    dv.setInt32(4, srsId, true);
    let p = 8; out[p] = 1; p += 1; dv.setUint32(p, 3, true); p += 4; dv.setUint32(p, 1, true); p += 4; dv.setUint32(p, ring.length, true); p += 4;
    for (const [x, y] of ring) { dv.setFloat64(p, x, true); dv.setFloat64(p + 8, y, true); p += 16; }
    return out;
  }
  const square = (x, y) => [[x, y], [x, y + 1000], [x + 1000, y + 1000], [x + 1000, y], [x, y]];

  test('formats2: a GeoPackage imports its feature table with GeoJSON geometry and typed attributes', async (assert) => {
    const engine = new sqlite.SqliteEngine();
    await engine.start();
    await engine.open();
    await engine.run('create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text, description text)');
    await engine.run("insert into gpkg_spatial_ref_sys values ('SWEREF99 TM', 3006, 'EPSG', 3006, 'PROJCS[]', null)");
    await engine.run('create table gpkg_contents (table_name text primary key, data_type text, identifier text, description text, last_change text, min_x real, min_y real, max_x real, max_y real, srs_id integer)');
    await engine.run("insert into gpkg_contents values ('omraden', 'features', 'omraden', '', '2026-01-01', 0, 0, 1, 1, 3006)");
    await engine.run('create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer)');
    await engine.run("insert into gpkg_geometry_columns values ('omraden', 'geom', 'POLYGON', 3006, 0, 0)");
    await engine.run('create table omraden (fid integer primary key, namn text, varde real, geom blob)');
    await engine.run('insert into omraden (namn, varde, geom) values (?, ?, ?)', ['Ruta A', 1.5, gpb(square(600000, 6500000))]);
    await engine.run('insert into omraden (namn, varde, geom) values (?, ?, ?)', ['Ruta B', 2.5, gpb(square(602000, 6500000))]);
    const bytes = await engine.export();
    engine.terminate();
    const file = new File([bytes], 'omraden.gpkg', { type: 'application/geopackage+sqlite3' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'sqlite');
    assert.ok(p.gpkg, 'recognised as GeoPackage');
    assert.deepEqual(p.tables, ['omraden'], 'system tables hidden');
    assert.equal(p.geometryColumn, 'geom');
    assert.equal(p.crs, 'SWEREF99 TM');
    assert.deepEqual(p.columns, ['fid', 'namn', 'varde', 'geom']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['integer', 'text', 'number', 'text']);
    assert.equal(JSON.parse(p.dataRows[0][3]).type, 'Polygon', 'blob converted to GeoJSON');
    const meta = await importer.run(file, {}, p.inferred.map((c) => ({ name: c.name, type: c.type, include: true })), 'Områden');
    created.push(meta.id);
    const rows = await datasets.query(meta.id);
    assert.equal(rows.length, 2);
    const g = JSON.parse(rows[1][3]);
    assert.deepEqual(g.coordinates[0][0], [602000, 6500000]);
    const state = builder.defaultState('map', await datasets.columns(meta.id));
    assert.equal(state.x.field, 'geom', 'map picks the geometry column');
    assert.equal(state.color.field, 'varde');
    assert.equal(state.y.field, 'namn');
    return p.crs;
  }, 30000);

  test('formats2: fixed-width text detects column breaks from shared spaces and accepts manual breaks', async (assert) => {
    const text = 'kommun      kod   befolkning\nStockholm   0180      984748\nGöteborg    1480      596841\nMalmö       1280      362133\n';
    const file = new File([text], 'register.txt', { type: 'text/plain' });
    const p = await importer.preview(file, { format: 'fixed' });
    assert.equal(p.importer, 'fixed');
    assert.deepEqual(p.breaks, [0, 12, 18]);
    assert.equal(p.header, true);
    assert.deepEqual(p.columns, ['kommun', 'kod', 'befolkning']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'text', 'integer']);
    assert.deepEqual(p.dataRows[0], ['Stockholm', '0180', '984748']);
    const meta = await importer.run(file, { format: 'fixed' }, null, 'Fast bredd');
    created.push(meta.id);
    const rows = await datasets.query(meta.id, { orderBy: 'befolkning', dir: 'desc' });
    assert.deepEqual(rows[0], ['Stockholm', '0180', 984748]);
    const manual = await importer.preview(file, { format: 'fixed', breaks: '0, 12, 18', header: false });
    assert.deepEqual(manual.columns, ['kolumn_1', 'kolumn_2', 'kolumn_3']);
    assert.equal(manual.totalRows, 4, 'without a header the first line is data');
    const auto = await importer.preview(new File([text], 'register.fwf'), {});
    assert.equal(auto.importer, 'fixed', '.fwf is picked up automatically');
    return p.breaks.join(',');
  });

  test('formats2: import from a web address: data files enter the wizard, configurations are added directly', async (assert) => {
    D.net.virtual('tests/url/data.csv', () => Promise.resolve({ kind: 'text', data: 'kommun;befolkning\nStockholm;984748\n' }));
    D.net.virtual('tests/url/bok.json', () => Promise.resolve({ kind: 'text', data: JSON.stringify({ format: 'dataspatium-notebook/1', name: 'Fjärrbok', cells: [{ type: 'markdown', source: '# Hej' }] }) }));
    try {
      const file = await urlImport.fetchFile('dataspatium-asset://tests/url/data.csv');
      assert.equal(file.name, 'data.csv');
      assert.equal(urlImport.configFormat(await file.text()), null, 'csv is not a configuration');
      const meta = await importer.run(file, {}, null, 'Från webben');
      created.push(meta.id);
      assert.equal(meta.rowCount, 1);
      const cfg = await urlImport.fetchFile('dataspatium-asset://tests/url/bok.json');
      const text = await cfg.text();
      assert.equal(urlImport.configFormat(text), 'dataspatium-notebook/1');
      const res = await urlImport.importConfig(text);
      nbIds.push(res.record.id);
      assert.equal(res.kind, 'notebook');
      assert.ok((await notebooks.list()).some((n) => n.id === res.record.id), 'notebook added');
      assert.equal(urlImport.fileName('https://example.org/data/export', 'text/csv; charset=utf-8'), 'export.csv');
      assert.equal(urlImport.fileName('https://example.org/x/kommuner.xlsx?dl=1', ''), 'kommuner.xlsx');
      await assert.throws(() => urlImport.fetchFile('ftp://example.org/x.csv'), /http/);
      await assert.throws(() => urlImport.importConfig('{"a":1}'), /konfiguration/);
      return file.name;
    } finally { D.net.unvirtual('tests/url/data.csv'); D.net.unvirtual('tests/url/bok.json'); }
  });

  test('formats2: cleanup', async (assert) => {
    for (const id of nbIds) { try { await notebooks.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
