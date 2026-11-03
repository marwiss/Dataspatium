// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the shapefile importer, the map chart type and re-fetching every API dataset. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const builder = D.require('viz/vega-builder');
  const charts = D.require('viz/charts');
  const render = D.require('viz/render');
  const zip = D.require('platform/storage/zip');
  const runner = D.require('api/runner');
  const created = [];

  /** A polygon shapefile (type 5) with one outer ring per record. */
  function buildShp(rings) {
    const records = rings.map((ring, i) => {
      const contentLen = 4 + 32 + 4 + 4 + 4 + ring.length * 16;
      const buf = new ArrayBuffer(8 + contentLen); const dv = new DataView(buf);
      dv.setInt32(0, i + 1, false); dv.setInt32(4, contentLen / 2, false);
      let p = 8; dv.setInt32(p, 5, true); p += 4;
      const xs = ring.map((c) => c[0]); const ys = ring.map((c) => c[1]);
      dv.setFloat64(p, Math.min(...xs), true); dv.setFloat64(p + 8, Math.min(...ys), true); dv.setFloat64(p + 16, Math.max(...xs), true); dv.setFloat64(p + 24, Math.max(...ys), true); p += 32;
      dv.setInt32(p, 1, true); p += 4; dv.setInt32(p, ring.length, true); p += 4; dv.setInt32(p, 0, true); p += 4;
      for (const [x, y] of ring) { dv.setFloat64(p, x, true); dv.setFloat64(p + 8, y, true); p += 16; }
      return new Uint8Array(buf);
    });
    const total = 100 + records.reduce((s, r) => s + r.length, 0);
    const out = new Uint8Array(total); const dv = new DataView(out.buffer);
    dv.setInt32(0, 9994, false); dv.setInt32(24, total / 2, false); dv.setInt32(28, 1000, true); dv.setInt32(32, 5, true);
    let off = 100; for (const r of records) { out.set(r, off); off += r.length; }
    return out;
  }
  /** A dBASE III table. */
  function buildDbf(fields, rows) {
    const recordLength = 1 + fields.reduce((s, f) => s + f.length, 0);
    const headerLength = 32 + fields.length * 32 + 1;
    const out = new Uint8Array(headerLength + rows.length * recordLength + 1); const dv = new DataView(out.buffer);
    out[0] = 0x03; dv.setUint32(4, rows.length, true); dv.setUint16(8, headerLength, true); dv.setUint16(10, recordLength, true);
    fields.forEach((f, i) => { const o = 32 + i * 32; for (let k = 0; k < f.name.length && k < 11; k++) out[o + k] = f.name.charCodeAt(k); out[o + 11] = f.type.charCodeAt(0); out[o + 16] = f.length; out[o + 17] = f.decimals || 0; });
    out[32 + fields.length * 32] = 0x0D;
    const enc = new TextEncoder();
    rows.forEach((row, r) => {
      let o = headerLength + r * recordLength; out[o] = 0x20; o += 1;
      fields.forEach((f, i) => {
        const s = String(row[i] === null || row[i] === undefined ? '' : row[i]);
        const bytes = enc.encode(f.type === 'N' ? s.padStart(f.length, ' ') : s);
        out.fill(0x20, o, o + f.length); out.set(bytes.subarray(0, f.length), o); o += f.length;
      });
    });
    out[out.length - 1] = 0x1A;
    return out;
  }
  // Two clockwise squares in SWEREF99 TM metres; the second has a collinear point that simplification removes.
  const SQ1 = [[600000, 6500000], [600000, 6501000], [601000, 6501000], [601000, 6500000], [600000, 6500000]];
  const SQ2 = [[602000, 6500000], [602000, 6500500], [602000, 6501000], [603000, 6501000], [603000, 6500000], [602000, 6500000]];
  const FIELDS = [{ name: 'KnKod', type: 'C', length: 4 }, { name: 'KnNamn', type: 'C', length: 20 }, { name: 'Folkmangd', type: 'N', length: 10, decimals: 0 }, { name: 'Andel', type: 'N', length: 8, decimals: 2 }, { name: 'Datum', type: 'D', length: 8 }, { name: 'Aktiv', type: 'L', length: 1 }];
  const ROWS = [['0180', 'Stockholm', '984748', '9.37', '20241231', 'T'], ['1280', 'Malmö', '362133', '3.45', '20241231', 'F']];

  test('maps: a zipped shapefile imports with typed attributes and GeoJSON geometry, optionally simplified', async (assert) => {
    const shp = buildShp([SQ1, SQ2]);
    const dbf = buildDbf(FIELDS, ROWS);
    const prj = new TextEncoder().encode('PROJCS["SWEREF99_TM",GEOGCS["GCS_SWEREF99",DATUM["D_SWEREF99",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],UNIT["Meter",1.0]]');
    const blob = await zip.createZip({ 'kommuner/Kommun_Sweref99TM.shp': shp, 'kommuner/Kommun_Sweref99TM.dbf': dbf, 'kommuner/Kommun_Sweref99TM.prj': prj }, { level: 0 });
    const file = new File([blob], 'kommuner.zip', { type: 'application/zip' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'shapefile');
    assert.deepEqual(p.layers, ['Kommun_Sweref99TM']);
    assert.equal(p.crs, 'SWEREF99_TM');
    assert.deepEqual(p.columns, ['KnKod', 'KnNamn', 'Folkmangd', 'Andel', 'Datum', 'Aktiv', 'geometry_type', 'geometry']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'boolean', 'text', 'text'], 'types from the dbf schema');
    assert.equal(p.totalRows, 2);
    assert.equal(p.points, 11);
    const meta = await importer.run(file, {}, p.inferred.map((c) => ({ name: c.name, type: c.type, include: true })), 'Kommungränser');
    created.push(meta.id);
    const rows = await datasets.query(meta.id);
    assert.equal(rows[1][1], 'Malmö', 'UTF-8 attributes without a cpg file');
    assert.equal(rows[0][2], 984748); assert.equal(rows[0][3], 9.37); assert.equal(rows[0][4], '2024-12-31'); assert.equal(rows[0][5], 1); assert.equal(rows[1][5], 0);
    assert.equal(rows[0][6], 'Polygon');
    const g = JSON.parse(rows[0][7]);
    assert.equal(g.type, 'Polygon'); assert.equal(g.coordinates[0].length, 5); assert.deepEqual(g.coordinates[0][0], [600000, 6500000]);
    const simplified = await importer.preview(file, { simplify: 10 });
    assert.equal(simplified.points, 10, 'the collinear point is removed');
    const bare = await importer.preview(new File([shp], 'bare.shp'), {});
    assert.deepEqual(bare.columns, ['geometry_type', 'geometry'], 'a bare .shp has only geometry');
    assert.equal(bare.crs, '');
    await assert.throws(() => importer.preview(new File([new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'tom.zip'), {}), /shapefile/);
    return `${p.columns.length} columns, ${p.points} points`;
  }, 30000);

  test('maps: the map chart type picks geometry and value, builds a geoshape spec with the right projection and renders', async (assert) => {
    const id = created[0];
    assert.ok(id, 'dataset from the previous test');
    const columns = await datasets.columns(id);
    const state = builder.defaultState('map', columns);
    assert.equal(state.x.field, 'geometry');
    assert.equal(state.y.field, 'KnNamn');
    assert.equal(state.color.field, 'Folkmangd');
    assert.deepEqual(builder.validate(state), []);
    assert.ok(builder.needsRawRows(state), 'maps never aggregate');
    const req = builder.dataRequest(state, columns, 10000000);
    assert.ok(!req.groupBy && req.fields.includes('geometry'), JSON.stringify(req));
    const chart = charts.create('vega', { id, name: 'Kommungränser' }, 'Karta');
    chart.vega.state = state;
    const prep = await render.prepareVega(chart, { width: 400 });
    assert.equal(prep.spec.mark.type, 'geoshape');
    assert.deepEqual(prep.spec.projection, { type: 'identity', reflectY: true }, 'projected metres are drawn as-is');
    assert.deepEqual(prep.spec.encoding.shape, { field: 'geometry', type: 'geojson' });
    assert.equal(prep.spec.encoding.color.field, 'Folkmangd');
    assert.equal(prep.spec.encoding.color.scale.scheme, 'dataspatium-seq');
    assert.equal(prep.spec.data.values.length, 2);
    assert.equal(prep.spec.data.values[0].geometry.type, 'Polygon', 'geometry text parsed for Vega');
    assert.equal(prep.spec.encoding.tooltip.length, 2);
    const svg = await (await render.toBlob(chart, 'svg', { width: 400 })).text();
    assert.ok(svg.includes('<path'), 'rendered paths');
    const lonlat = builder.toSpec(state, columns, { values: [{ geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[18, 59], [18, 60], [19, 60], [19, 59], [18, 59]]] }), Folkmangd: 1, KnNamn: 'x' }] });
    assert.equal(lonlat.projection.type, 'mercator', 'longitude/latitude uses Mercator');
    const problems = builder.validate(Object.assign({}, state, { color: null }));
    assert.equal(problems.length, 1);
    return prep.spec.projection.type;
  }, 60000);

  test('maps: refreshAll re-fetches every API dataset through the runner', async (assert) => {
    const meta = await datasets.create({ name: 'API-omhämtning', columns: [{ name: 'a', type: 'integer', label: 'a' }], rows: [[1], [2], [3]], source: { kind: 'api', connectorId: 'test', connectorName: 'Test', endpointId: 'x', params: {} } });
    created.push(meta.id);
    const seen = [];
    const results = await runner.refreshAll({ fetch: async (source) => { seen.push(source.connectorId); return { columns: ['a'], rows: [[10], [20]] }; } });
    const mine = results.find((r) => r.id === meta.id);
    assert.ok(mine && mine.ok, JSON.stringify(results));
    assert.deepEqual(seen.filter((s) => s === 'test'), ['test']);
    const rows = await datasets.query(meta.id);
    assert.deepEqual(rows.map((r) => r[0]), [10, 20], 'rows replaced');
    const updated = await datasets.get(meta.id);
    assert.ok(updated.source.fetchedAt, 'fetchedAt recorded');
    const failing = await runner.refreshAll({ fetch: async () => { throw new Error('nere'); } });
    assert.ok(failing.find((r) => r.id === meta.id && !r.ok && /nere/.test(r.error)), 'errors are reported per dataset');
    return results.length + ' datasets';
  }, 30000);

  test('maps: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
