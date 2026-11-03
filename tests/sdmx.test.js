// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for SDMX-JSON: recorded responses from the ECB (version 1.0 at the top level) and the OECD (1.0 under
 * `data` and 2.0 with `structures`), flat observations, file import, the ECB and OECD presets against a
 * virtual service, and retries of passing server errors.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const sdmx = D.require('api/sdmx');
  const fx = D.require('tests/fixtures/sdmx');
  const runner = D.require('api/runner');
  const connectors = D.require('api/connectors');
  const BASE = 'dataspatium-asset://tests/sdmx';
  const col = (table, name) => { const i = table.columns.indexOf(name); return table.rows.map((r) => r[i]); };

  test('sdmx: ECB exchange rates (SDMX-JSON 1.0) become one row per observation with codes, names and attributes', (assert) => {
    assert.ok(sdmx.isSdmxJson(fx.ecbExr), 'recognised');
    const t = sdmx.toTable(fx.ecbExr);
    assert.equal(t.rows.length, 6, 'two currencies, three months');
    assert.ok(t.columns.includes('Currency_kod') && t.columns.includes('Currency'), 'code and name: ' + t.columns.join(', '));
    assert.deepEqual(Array.from(new Set(col(t, 'Currency_kod'))).sort(), ['NOK', 'SEK']);
    const time = t.columns.find((c) => /time/i.test(c));
    assert.ok(time && !t.columns.includes(time + '_kod'), 'the time dimension has codes only');
    assert.ok(col(t, time).every((p) => /^\d{4}-\d{2}$/.test(p)), 'monthly periods');
    assert.ok(col(t, 'varde').every((v) => typeof v === 'number' && v > 5 && v < 20), 'kronor per euro');
    assert.equal(t.types.varde, 'number');
    assert.ok(t.columns.some((c) => /status/i.test(c)), 'observation status attribute');
    assert.equal(t.meta.label, 'Exchange Rates');
    return t.columns.length + ' columns';
  });

  test('sdmx: OECD 1.0 under data and 2.0 with structures give the same table', (assert) => {
    assert.ok(sdmx.isSdmxJson(fx.oecd1) && sdmx.isSdmxJson(fx.oecd2), 'both recognised');
    const a = sdmx.toTable(fx.oecd1); const b = sdmx.toTable(fx.oecd2);
    const key = (t) => { const area = t.columns.indexOf('Reference area_kod'); const time = t.columns.findIndex((c) => /time/i.test(c)); const v = t.columns.indexOf('varde'); return t.rows.map((r) => `${r[area]}|${r[time]}|${r[v]}`).sort(); };
    assert.equal(a.rows.length, 4);
    assert.deepEqual(key(a), key(b));
    assert.deepEqual(Array.from(new Set(col(a, 'Reference area'))).sort(), ['Norway', 'Sweden']);
    return 'ok';
  });

  test('sdmx: flat observations (dimensionAtObservation=AllDimensions) and missing values', (assert) => {
    const msg = {
      dataSets: [{ observations: { '0:0': [1.5], '0:1': [2], '1:0': ['NaN'], '1:1': [null] } }],
      structure: { name: 'Test', dimensions: { observation: [
        { id: 'REF_AREA', name: 'Area', values: [{ id: 'SE', name: 'Sweden' }, { id: 'NO', name: 'Norway' }] },
        { id: 'TIME_PERIOD', name: 'Time', role: 'time', values: [{ id: '2024' }, { id: '2025' }] },
      ] } },
    };
    const t = sdmx.toTable(msg);
    assert.deepEqual(t.columns, ['Area_kod', 'Area', 'Time', 'varde']);
    assert.deepEqual(t.rows, [['SE', 'Sweden', '2024', 1.5], ['SE', 'Sweden', '2025', 2], ['NO', 'Norway', '2024', null], ['NO', 'Norway', '2025', null]]);
    let err = null;
    try { sdmx.toTable({ hello: 1 }); } catch (e) { err = e; }
    assert.ok(err, 'other JSON is refused');
    return 'ok';
  });

  test('sdmx: an SDMX-JSON file is imported as a long table', async (assert) => {
    const json = D.require('io/importers/json');
    const file = new File([JSON.stringify(fx.oecd2)], 'oecd.json', { type: 'application/json' });
    const preview = await json.preview(file, {});
    assert.equal(preview.statFormat, 'sdmx-json');
    const parsed = await json.parse(file, {});
    assert.equal(parsed.meta.format, 'sdmx-json');
    assert.equal(parsed.rows.length, 4);
    return 'ok';
  });

  test('sdmx: the ECB and OECD presets build SDMX addresses and read the answers', async (assert) => {
    const presets = await connectors.loadPresets();
    const ecb = presets.find((p) => p.id === 'ecb'); const oecd = presets.find((p) => p.id === 'oecd');
    assert.ok(ecb && oecd, 'presets');
    assert.equal(ecb.country, 'EU'); assert.equal(oecd.country, 'INT');
    const request = D.require('api/request');
    const urls = []; const names = [];
    /** Serve `data` at the exact address the runner will build for these values. */
    const serveFor = (conn, ep, values, data) => {
      const url = request.build(conn, ep, request.normalizeParams(ep, values)).url;
      const name = D.net.assetName(url);
      names.push(name);
      D.net.virtual(name, (u) => { urls.push(u); return Promise.resolve({ kind: 'text', data: JSON.stringify(data) }); });
      return url;
    };
    try {
      const ecbLocal = Object.assign({}, ecb, { baseUrl: BASE + '/ecb' });
      const exEp = ecb.endpoints.find((e) => e.id === 'exchange');
      const exValues = { freq: 'M', currency: ['SEK', 'NOK'], lastNObservations: 3 };
      const exUrl = serveFor(ecbLocal, exEp, exValues, fx.ecbExr);
      assert.ok(/\/EXR\/M\.SEK(%2B|\+)NOK\.EUR\.SP00\.A\?/.test(exUrl), 'ECB address: ' + exUrl);
      assert.ok(/format=jsondata/.test(exUrl) && /lastNObservations=3/.test(exUrl), 'query');
      const ex = await runner.fetchTable(ecbLocal, exEp, exValues);
      assert.equal(ex.rows.length, 6, 'ECB rows');
      const oecdLocal = Object.assign({}, oecd, { baseUrl: BASE + '/oecd' });
      const unEp = oecd.endpoints.find((e) => e.id === 'unemployment');
      const unValues = { countries: ['SWE', 'NOR'], lastNObservations: 2 };
      const unUrl = serveFor(oecdLocal, unEp, unValues, fx.oecd1);
      assert.ok(decodeURIComponent(unUrl).includes('/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/SWE+NOR..._Z.Y._T.Y_GE15..M'), 'OECD address: ' + unUrl);
      const un = await runner.fetchTable(oecdLocal, unEp, unValues);
      assert.equal(un.rows.length, 4, 'OECD rows');
      assert.equal(urls.length, 2, 'both services called once');
    } finally { for (const n of names) D.net.unvirtual(n); }
    return 'ok';
  });

  test('sdmx: a GET that fails with a passing server error is retried', async (assert) => {
    const http = D.require('api/http');
    let calls = 0;
    D.net.virtual('tests/flaky', () => { calls++; return Promise.resolve(calls === 1 ? { kind: 'text', data: 'oops', status: 500 } : { kind: 'text', data: '{"ok":true}' }); });
    try {
      const res = await http.request({ url: 'dataspatium-asset://tests/flaky', retries: 2 });
      assert.equal(res.status, 200, 'second attempt succeeded');
      assert.equal(calls, 2);
    } finally { D.net.unvirtual('tests/flaky'); }
    return calls + ' calls';
  });
})();
