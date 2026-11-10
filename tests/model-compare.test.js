// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Jämför versioner: two versions of a model differ by element (GlobalId) and property, answered in the ids of each file;
 * a snapshot of the same dataset is identical; the panel lists the differences, colours the model, draws the other version and
 * marks the elements.
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

  test('model compare: cleanup', async () => {
    selection.clear();
    if (a) await datasets.remove(a.id);
    if (b) await datasets.remove(b.id);
    return 'ok';
  });
})();
