// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Jämför versioner: two versions of a model differ by element (GlobalId) and property, answered in the ids of each file;
 * a snapshot of the same dataset is identical; the panel lists the differences, colours the model, draws the other version and
 * marks the elements; for a model fetched from Dataregium the panel shows the server's change set of the fetched version.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const selection = D.require('data/selection');
  const modelDiff = D.require('data/model-diff');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  let a = null; let b = null; let diff = null;

  test('model compare: two versions differ by element and property, in the ids of each file, and a snapshot is identical to its dataset', async (assert) => {
    a = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Jämför A');
    // The same building with a property changed, a wall renamed and the slab replaced by one with another GlobalId.
    const text = fixtures.ifcText({ walls: 2 }).replace("IFCLABEL('EI60')", "IFCLABEL('EI30')").replace("'Vägg 2.1'", "'Vägg 2.1 ny'").replace(/IFCSLAB\('([^']+)'/, (m, g) => `IFCSLAB('${g.slice(0, -1)}Z'`);
    b = await importer.run(new File([text], 'testhus.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Jämför B');
    diff = await modelDiff.diff(a.id, { datasetId: b.id });
    assert.equal(diff.counts.here, 10, 'elements and spatial structure'); assert.equal(diff.counts.there, 10);
    assert.equal(diff.counts.onlyHere, 1, 'the slab only in A'); assert.equal(diff.counts.onlyThere, 1, 'the other slab only in B');
    assert.equal(diff.counts.changed, 2, 'the wall with EI30 and the renamed wall: ' + JSON.stringify(diff.changed));
    const fire = diff.changed.find((e) => e.fields.some((f) => f.name === 'Pset_WallCommon.FireRating'));
    assert.ok(fire && fire.fields[0].here === 'EI60' && fire.fields[0].there === 'EI30', 'the property that differs, here and there');
    const renamed = diff.changed.find((e) => e.fields.some((f) => f.name === 'namn'));
    assert.ok(renamed && renamed.namn === 'Vägg 2.1' && renamed.fields.find((f) => f.name === 'namn').there === 'Vägg 2.1 ny', 'the attribute that differs');
    assert.ok(diff.onlyThere[0].id > 0 && diff.onlyThere[0].typ === 'IfcSlab' && diff.onlyHere[0].typ === 'IfcSlab' && diff.changed.every((e) => e.idThere > 0), 'ids of each file');
    assert.ok(diff.other.bytes && diff.other.bytes.byteLength > 1000 && diff.other.label === 'Jämför B', 'the other file for the 3D view');
    assert.equal(diff.truncated, false);
    const v = await datasets.snapshot(a.id, 'Före');
    const same = await modelDiff.diff(a.id, { datasetId: a.id, snapshot: v.n });
    assert.equal(same.counts.changed + same.counts.onlyHere + same.counts.onlyThere, 0, 'a snapshot of the same dataset');
    assert.ok(same.other.bytes && same.other.label === 'Före', 'with its file and label');
    const choices = await modelDiff.choices(a.id);
    assert.ok(choices[0].snapshot === v.n && choices.some((c) => c.datasetId === b.id && !c.snapshot), 'snapshots first, then the other models');
    const bad = await modelDiff.diff(a.id, { datasetId: a.id, snapshot: 99 }).catch((e) => e);
    assert.ok(bad instanceof Error, 'a version that is gone');
    return 'ok';
  }, 30000);

  test('model compare: the panel lists the differences, colours the model, draws the other version and marks the elements', async (assert) => {
    const previews = [];
    const panel = D.require('ui/bearbeta/model-compare').create({ shell: { log: () => {} } }, a, { preview: (p) => { previews.push(p); } });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.choices.length, 3000, 'the choices loaded');
      panel.state.choice = b.id;
      await panel.run();
      assert.ok(panel.el.querySelector('[data-compare-counts]') && panel.el.querySelector('[data-compare-counts]').textContent.includes('Jämför B'), 'the counts name the other version');
      assert.equal(panel.el.querySelectorAll('[data-compare-only-there] > ul > li').length, 1); assert.equal(panel.el.querySelectorAll('[data-compare-changed] > ul > li').length, 2);
      assert.equal(panel.el.querySelectorAll('[data-compare-only-here] > ul > li').length, 1, 'the slab only here');
      assert.ok(panel.el.querySelector('[data-compare-changed]').textContent.includes('EI30'), 'the changed property shown');
      assert.ok(previews[0] && !previews[0].bytes && previews[0].colors.length === 2, 'green and yellow on this version');
      assert.deepEqual(previews[0].colors.map((g) => g.ids.length), [1, 2], 'the slab green, the changed walls yellow');
      await panel.toggleOther();
      const other = previews[previews.length - 1];
      assert.ok(other.bytes && other.bytes.byteLength === diff.other.bytes.byteLength && other.colors.length === 2, 'the other version drawn with red and yellow');
      assert.deepEqual(other.colors.map((g) => g.ids.length), [1, 2], 'the other slab red, the changed walls yellow');
      await panel.toggleOther();
      assert.ok(!previews[previews.length - 1].bytes, 'back to this version');
      selection.clear();
      await panel.mark();
      await waitFor(() => selection.get(), 3000, 'the selection');
      assert.equal(selection.get().rowids.length, 3, 'the slab and the changed walls marked'); assert.equal(selection.get().label, t('compare.selection.label'));
      panel.destroy();
      assert.equal(previews[previews.length - 1], null, 'the preview ends with the panel');
    } finally { panel.el.remove(); }
    return 'ok';
  }, 20000);

  test('model compare: the server\'s change set of the fetched version is a third source, and a whole-file version has none', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const families = D.require('api/families/databases');
    const connectors = D.require('api/connectors');
    const CDE = 'dataspatium-asset://tests/compare-cde';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
    const set = { change_set_id: 't-9', base: { document_id: 'doc-1', version_index: 1 }, proposed_by: 'anna', approved_by: 'bo', changes: [{ step_id: 170, attribute: 'NominalValue', op: 'set', old: { type: 'IfcLabel', value: 'EI60' }, new: { type: 'IfcLabel', value: 'EI90' } }, { guid: '1Xezbq735AdBO_4DerG66G', path: 'ObjectPlacement.RelativePlacement.Location', attribute: 'Coordinates', op: 'set', old: [0, 0, 0], new: [0, 0, 100], copy: true }] };
    D.net.virtual('tests/compare-cde/', (url) => {
      const path = (url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname).split('?')[0];
      if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', documents: '1.0' }, extensions: {} }));
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/documents/1.0/documents/doc-1/versions/2/ifc-changes') return Promise.resolve(json(set));
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const { connector } = await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' });
    const source = (versionIndex) => ({ kind: 'file', cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', documentId: 'doc-1', versionIndex } });
    let panel = null;
    try {
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      panel = D.require('ui/bearbeta/model-compare').create({ shell: { log: () => {} } }, Object.assign({}, a, { source: source(2) }), { preview: () => {} });
      document.body.appendChild(panel.el);
      await waitFor(() => panel.el.querySelector('[data-compare-server-load]'), 3000, 'the server block');
      await panel.loadServer();
      const result = panel.el.querySelector('[data-compare-server-result]');
      assert.ok(result && result.getAttribute('data-compare-server-result') === '2', 'two changes');
      assert.ok(result.textContent.includes('anna') && result.textContent.includes('bo') && result.textContent.includes('t-9'), 'who proposed and approved, and the topic: ' + result.textContent);
      const items = result.querySelectorAll('li');
      assert.ok(items[0].textContent.includes('#170 NominalValue') && items[0].textContent.includes('EI60 (IfcLabel)') && items[0].textContent.includes('EI90'), 'a typed value by step id: ' + items[0].textContent);
      assert.ok(items[1].textContent.includes('1Xezbq735AdBO_4DerG66G/ObjectPlacement.RelativePlacement.Location Coordinates') && items[1].textContent.includes('0, 0, 100') && items[1].textContent.includes('(copy)'), 'a copy by guid and path: ' + items[1].textContent);
      assert.ok(panel.el.querySelector('[data-compare-server-mark]'), 'the mark button');
      panel.destroy(); panel.el.remove();
      panel = D.require('ui/bearbeta/model-compare').create({ shell: { log: () => {} } }, Object.assign({}, a, { source: source(3) }), { preview: () => {} });
      document.body.appendChild(panel.el);
      await panel.loadServer();
      assert.ok(panel.el.querySelector('[data-compare-server-none]') && !panel.el.querySelector('[data-compare-server-result]'), 'a whole-file version has no change set');
      assert.equal(panel.state.serverError, '', 'and that is not an error');
    } finally {
      if (panel) { panel.destroy(); panel.el.remove(); }
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id);
    }
    return 'ok';
  }, 20000);

  test('model compare: cleanup', async () => {
    selection.clear();
    if (a) await datasets.remove(a.id);
    if (b) await datasets.remove(b.id);
    return 'ok';
  });
})();
