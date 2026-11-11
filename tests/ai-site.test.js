// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for set_site, the write tool that places the model on earth (F43 b, step 1): a valid call lands as one step with its numbers
 * and no ref, the checks refuse a latitude out of range, a missing longitude, a crs without eastings and northings and eastings without
 * a crs, the description names the latitude and the crs in all seven languages, the summary counts it as a change and the wheel keeps
 * every field. With the real Pyodide (`?python=1` or cached components) the op is applied by the wheel on a model: the site is
 * changed, one IfcProjectedCRS and one IfcMapConversion are created, and a second run on the written file updates them instead of
 * doubling them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const writeTools = D.require('ai/write-tools');
  const i18n = D.require('ui/i18n');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  /** The written IFC of a preview as text (the bridge answers bytes). */
  const textOf = (res) => (typeof res.bytes === 'string' ? res.bytes : res.bytes ? new TextDecoder().decode(res.bytes) : '');
  const count = (text, needle) => text.split(needle).length - 1;
  const classes = (list) => (list || []).map((e) => e.ifc_class);
  const ARGS = { latitude: 59.3293, longitude: 18.0686, elevation: 12.5, crs: 'EPSG:3006', eastings: 674032, northings: 6580822, rotation: 15, site_name: 'Kvarteret' };
  const SITE = Object.assign({}, ARGS, { site_name: 'Tomten' });

  test('ai site: set_site lands as one step without a ref, is described with the latitude and the crs, and the wheel keeps its fields', async (assert) => {
    assert.ok(writeTools.has('set_site'), 'set_site is a write tool');
    assert.ok(!writeTools.CREATES.includes('set_site'), 'and not a create');
    const tool = writeTools.TOOLS.find((x) => x.name === 'set_site');
    assert.ok(tool && tool.description.includes('EPSG') && tool.parameters.type === 'object', 'the tool as the providers see it');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['latitude', 'longitude', 'elevation', 'crs', 'eastings', 'northings', 'rotation', 'site_name']);
    const cs = writeTools.create('site-test');
    const out = writeTools.call(cs, 'set_site', ARGS);
    assert.ok(out.ok && out.step === 1 && !out.ref, 'one step, no ref: ' + JSON.stringify(out));
    assert.equal(cs.ops.length, 1); assert.equal(cs.refs, 0);
    const op = cs.ops[0];
    assert.equal(op.tool, 'set_site'); assert.equal(op.latitude, 59.3293); assert.equal(op.longitude, 18.0686); assert.equal(op.elevation, 12.5);
    assert.equal(op.crs, 'EPSG:3006'); assert.equal(op.eastings, 674032); assert.equal(op.northings, 6580822); assert.equal(op.rotation, 15); assert.equal(op.site_name, 'Kvarteret');
    const text = writeTools.describe(op);
    assert.ok(text.includes('59.3293') && text.includes('18.0686') && text.includes('EPSG:3006') && text.includes('674032') && text.includes('Kvarteret'), text);
    assert.equal(out.description, text, 'the answer carries the description');
    assert.deepEqual(writeTools.summary(cs), { steps: 1, creates: 0, deletes: 0 }, 'a change, not a create');
    assert.deepEqual(writeTools.toWheel(cs), [Object.assign({ tool: 'set_site' }, ARGS)], 'the wheel gets every field');
    const plain = writeTools.call(cs, 'set_site', { latitude: -33.9, longitude: -70.6, elevation: null, crs: null, eastings: null, northings: null, rotation: null, site_name: null });
    assert.ok(plain.ok, 'the position alone: ' + JSON.stringify(plain));
    assert.deepEqual(cs.ops[1], { tool: 'set_site', latitude: -33.9, longitude: -70.6, elevation: null, crs: null, eastings: null, northings: null, rotation: 0, site_name: null }, 'rotation 0 when null');
    const south = writeTools.describe(cs.ops[1]);
    assert.ok(south.includes('-33.9') && !south.includes('EPSG'), south);
    assert.equal(writeTools.summary(cs).steps, 2);
    const listed = writeTools.call(cs, 'manage_changeset', { action: 'list' });
    assert.equal(listed.steps.length, 2); assert.equal(listed.steps[0].tool, 'set_site'); assert.equal(listed.steps[0].ref, null);
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }).ok); assert.equal(cs.ops.length, 1); assert.equal(cs.refs, 0);
    return 'ok';
  });

  test('ai site: set_site refuses a latitude out of range, a missing longitude, a crs without eastings and northings, and eastings without a crs', async (assert) => {
    const cs = writeTools.create('site-test-2');
    const base = { latitude: 59.3, longitude: 18.1, elevation: null, crs: null, eastings: null, northings: null, rotation: null, site_name: null };
    const refused = (patch, label) => { const out = writeTools.call(cs, 'set_site', Object.assign({}, base, patch)); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return out.error || ''; };
    assert.ok(refused({ latitude: 91 }, 'latitude 91').includes('latitude'));
    assert.ok(refused({ latitude: -90.5 }, 'latitude -90.5').includes('latitude'));
    assert.ok(refused({ latitude: 'north' }, 'latitude as text').includes('latitude'));
    assert.ok(refused({ longitude: null }, 'no longitude').includes('longitude'));
    assert.ok(refused({ longitude: 181 }, 'longitude 181').includes('longitude'));
    assert.ok(refused({ crs: 'EPSG:3006' }, 'crs without eastings and northings').includes('eastings'));
    assert.ok(refused({ crs: 'EPSG:3006', eastings: 674032 }, 'crs without northings').includes('northings'));
    assert.ok(refused({ eastings: 674032, northings: 6580822 }, 'eastings without crs').includes('crs'));
    assert.ok(refused({ crs: 'EPSG:3006', eastings: 674032, northings: 'far' }, 'northings as text').includes('northings'));
    assert.ok(refused({ crs: 'SWEREF99', eastings: 674032, northings: 6580822 }, 'crs not an EPSG code').includes('EPSG'));
    assert.equal(cs.ops.length, 0, 'nothing landed');
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, base, { crs: 'epsg:3006', eastings: 674032, northings: 6580822 })).ok, 'a lower-case code is taken');
    assert.equal(cs.ops[0].crs, 'EPSG:3006', 'and written in upper case');
    return 'ok';
  });

  test('ai site: the description names the latitude and the crs in all seven languages', async (assert) => {
    const cs = writeTools.create('site-languages');
    assert.ok(writeTools.call(cs, 'set_site', SITE).ok);
    const codes = i18n.LANGUAGES.map((l) => l.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const text = writeTools.describe(cs.ops[0]);
        assert.ok(text.includes('59.3293') && text.includes('18.0686') && text.includes('EPSG:3006') && text.includes('674032') && text.includes('Tomten'), code + ': ' + text);
        assert.ok(!/\{\w+\}/.test(text), code + ': every placeholder filled: ' + text);
        seen.push(text);
      }
      assert.equal(new Set(seen).size, 7, 'seven different texts: ' + seen.join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai site: Python applies set_site on a model: the site is changed, one IfcProjectedCRS and one IfcMapConversion are created, and a second run updates them instead of doubling them', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixtures.ifcFile({ walls: 1 }), { format: 'model' }, null, 'Platsprov');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const cs = writeTools.create(meta.id);
    const call = writeTools.call(cs, 'set_site', SITE);
    assert.ok(call.ok, JSON.stringify(call));
    const first = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    const report = first.report;
    assert.equal(report.errors, 0, 'no errors: ' + JSON.stringify(report.findings));
    assert.equal(report.operations, 1);
    assert.ok((report.changed || []).some((e) => e.ifc_class === 'IfcSite' && e.name === 'Tomten'), 'the site among the changed: ' + JSON.stringify(report.changed));
    assert.ok(classes(report.created).includes('IfcProjectedCRS') && classes(report.created).includes('IfcMapConversion'), 'the CRS and the map conversion among the created: ' + JSON.stringify(report.created));
    assert.ok(report.created.every((e) => !e.ref), 'none of them gets a ref');
    assert.deepEqual(report.notes || [], [], 'nothing skipped in IFC4');
    const text = textOf(first);
    assert.ok(text.length > 1000, 'the preview answers the written IFC');
    assert.ok(text.includes('IFCMAPCONVERSION(') && text.includes('IFCPROJECTEDCRS(') && text.includes("'EPSG:3006'"), 'the file carries the map conversion to EPSG:3006');
    assert.equal(count(text, 'IFCMAPCONVERSION('), 1, 'one map conversion');
    assert.equal(count(text, 'IFCPROJECTEDCRS('), 1, 'one projected CRS');
    assert.ok(text.includes('(59,19,45,480000)') && text.includes('(18,4,6,960000)'), 'the compound plane angles with millionths of a second');
    assert.ok(text.includes("'SWEREF99'") && text.includes("'Transverse Mercator'") && text.includes("'TM'"), 'the datum, projection and zone of EPSG:3006');
    // The written file as a second model: the same op finds the CRS and the conversion and updates them, never doubling them.
    const again = await importer.run(new File([first.bytes], 'platsprov-2.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Platsprov 2');
    created.push(again.id);
    const second = await ifcOps.previewChangeset(again.id, writeTools.toWheel(cs));
    assert.equal(second.report.errors, 0, 'no errors the second time: ' + JSON.stringify(second.report.findings));
    const text2 = textOf(second);
    assert.equal(count(text2, 'IFCMAPCONVERSION('), 1, 'still one map conversion');
    assert.equal(count(text2, 'IFCPROJECTEDCRS('), 1, 'still one projected CRS');
    assert.ok(!classes(second.report.created).includes('IfcMapConversion') && !classes(second.report.created).includes('IfcProjectedCRS'), 'nothing created the second time: ' + JSON.stringify(second.report.created));
    for (const cls of ['IfcSite', 'IfcProjectedCRS', 'IfcMapConversion']) assert.ok(classes(second.report.changed).includes(cls), cls + ' among the changed: ' + JSON.stringify(second.report.changed));
    return 'ok';
  }, 900000);

  test('ai site: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
