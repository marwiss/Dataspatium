// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for set_site, the write tool that places the model on earth (F43 b, step 1): a valid call lands as one step with its numbers
 * and no ref, the checks refuse a latitude out of range, a missing longitude, a crs without eastings and northings and eastings without
 * a crs, the description names the latitude and the crs, the summary counts it as a change and the wheel keeps every field.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const writeTools = D.require('ai/write-tools');
  const ARGS = { latitude: 59.3293, longitude: 18.0686, elevation: 12.5, crs: 'EPSG:3006', eastings: 674032, northings: 6580822, rotation: 15, site_name: 'Kvarteret' };

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
})();
