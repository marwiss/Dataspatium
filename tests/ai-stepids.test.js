// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests that the IFC modelling keeps the STEP ids (PLAN 0a): Dataregium merges IFC versions with ifcmerge, which merges three ways on
 * the #ids, so every program that writes a model must keep the ids of what it does not delete, change it in place and never give an
 * id twice. Without Python: the model's facts keep the highest id any version had (`maxId`), also when a version's own is lower.
 * With the real Pyodide (`?python=1` or cached components) every write tool is applied to the hand-written fixture (ids from #1000)
 * by the wheel's _ifc_changeset, the same call as the approval, and the written STEP text is compared with the base: every base
 * instance that is still there keeps its id and its class, and every new id is above the base's highest. A sequence of approved
 * change sets (build, edit, delete what was built, build again), each opened from the version before, never gives an id that an
 * earlier version had. A new model (ifc-new) is a whole new file, numbered from #1, and is documented as such.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const model = D.require('data/model');
  const recipes = D.require('data/recipes');
  const writeTools = D.require('ai/write-tools');
  const ifcOps = D.require('data/ifc-ops');
  const ifcNew = D.require('data/ifc-new');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';

  /** The instances of a STEP text: id → {cls, text} (IfcOpenShell and the fixture write one instance per line). @param {Uint8Array|string} data */
  function stepOf(data) {
    const text = typeof data === 'string' ? data : new TextDecoder('latin1').decode(data);
    const out = new Map();
    for (const m of text.matchAll(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*);\s*$/gm)) out.set(Number(m[1]), { cls: m[2].toUpperCase(), text: m[3] });
    return out;
  }
  const maxOf = (step) => Math.max(0, ...step.keys());
  const idsOf = (step, cls) => Array.from(step).filter(([, v]) => v.cls === cls).map(([id]) => id).sort((a, b) => a - b);
  /**
   * The ifcmerge rule between a base and the file written from it: every base instance still there has its id and its class, every
   * new id is above the base's highest. @returns {{kept: number, edited: number, gone: number[], added: number[]}}
   */
  function keeps(assert, base, out, label) {
    const top = maxOf(base);
    let kept = 0; let edited = 0; const gone = []; const moved = [];
    for (const [id, b] of base) {
      const o = out.get(id);
      if (!o) { gone.push(id); continue; }
      kept++;
      if (o.cls !== b.cls) moved.push(`#${id} ${b.cls} → ${o.cls}`);
      else if (o.text !== b.text) edited++;
    }
    const added = Array.from(out.keys()).filter((id) => !base.has(id)).sort((a, b) => a - b);
    const low = added.filter((id) => id <= top);
    assert.deepEqual(moved, [], label + ': every base instance kept keeps its class');
    assert.deepEqual(low.slice(0, 10), [], label + `: every new id is above the base's highest #${top}`);
    return { kept, edited, gone, added };
  }
  const brief = (f) => `kept ${f.kept} (edited ${f.edited}), removed ${f.gone.length}, new ${f.added.length}` + (f.added.length ? ` #${f.added[0]}–#${f.added[f.added.length - 1]}` : '');
  async function factsOf(id) {
    const handle = await datasets.ensureOpen(id);
    const r = await handle.engine.exec("select value from _meta where key = 'model'");
    return JSON.parse(r[0].values[0][0]);
  }
  const layer = (material, thickness, category, role) => ({ material, thickness, category, role });
  const rect = (x, y, depth) => ({ profile: 'rectangle', x, y, radius: null, outline: null, depth, along: null });
  /** Every field of edit_element null, as a provider in strict mode sends it. */
  const BLANK = { id: null, name: null, start: null, end: null, thickness: null, height: null, type: null, outline: null, offset: null, width: null, sill: null, pitch: null, overhang: null, base: null };
  const BOX = [['Syd', [0, 0], [12, 0]], ['Ost', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]], ['Vast', [0, 8], [0, 0]]];
  /** Every tool that creates, in one change set: a storey with a grid, a wall type and a box of walls (new-2 … new-5) with its rooms,
   * a slab, a door, a window, a roof and a column. */
  const BUILD = [['create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: { x_spacing: 6, x_count: 2, y_spacing: 8, y_count: 1 } }],
    ['define_type', { kind: 'wall', name: 'YV1', layers: [layer('Betong', 0.2, 'concrete', 'load_bearing')], predefined_type: null }]]
    .concat(BOX.map(([name, start, end]) => ['create_wall', { storey: 'Plan 3', start, end, thickness: null, height: 3, name, type: 'new-1' }]))
    .concat([['create_spaces', { storey: 'Plan 3', rooms: null, height: null }],
      ['create_slab', { storey: 'Plan 3', outline: [[0, 0], [12, 0], [12, 8], [0, 8]], thickness: 0.25, name: 'Golv' }],
      ['create_opening', { wall_id: 'new-2', offset: 2, width: 1, height: 2.1, sill: 0, fill: 'door', name: 'Dorr', type: null, side: null }],
      ['create_opening', { wall_id: 'new-3', offset: 3, width: 1.2, height: 1.2, sill: 0.9, fill: 'window', name: 'Fonster', type: null, side: null }],
      ['create_roof', { storey: 'Plan 3', shape: 'gable', outline: null, pitch: 30, overhang: 0.4, thickness: null, ridge: null, base: null, name: 'Tak', type: null }],
      ['create_element', { storey: 'Plan 3', ifc_class: 'IfcColumn', predefined_type: null, object_type: null, type: null, name: 'Pelare', at: [6, 4], z: null, rotation: null, shape: rect(0.3, 0.3, 3), stair: null, part_of: null, host: null }]]);
  function changesOf(steps, datasetId) {
    const cs = writeTools.create(datasetId);
    for (const [name, args] of steps) {
      const out = writeTools.call(cs, name, name === 'edit_element' ? Object.assign({}, BLANK, args) : args);
      if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out));
    }
    return writeTools.toWheel(cs);
  }
  async function startPython() {
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
  }

  test('ai stepids: the model\'s facts keep the highest STEP id any version had, also when the new version\'s own is lower', async (assert) => {
    const meta = await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'STEP-id fakta');
    created.push(meta.id);
    const base = stepOf((await model.original(meta.id)).bytes);
    assert.equal(Math.min(...base.keys()), 1000, 'the fixture numbers from #1000');
    assert.equal((await factsOf(meta.id)).maxId, maxOf(base), 'the import notes the file\'s highest id');
    const lower = new Uint8Array(await fixtures.ifcFile({ walls: 2 }).arrayBuffer());
    assert.ok(maxOf(stepOf(lower)) < maxOf(base), 'a version whose last entities are gone');
    const real = bridge.runIfcChangeset;
    try {
      bridge.runIfcChangeset = async (changes) => ({ bytes: lower.slice(), info: { elements: 5, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [], changed: [], deleted: [], findings: [], errors: 0 }, log: [] });
      await recipes.apply(meta.id, 'ifc_changeset', { changes: '[]' });
    } finally { bridge.runIfcChangeset = real; }
    assert.equal(maxOf(stepOf((await model.original(meta.id)).bytes)), maxOf(stepOf(lower)), 'the new version is the model');
    assert.equal((await factsOf(meta.id)).maxId, maxOf(base), 'and the highest id stays the one the version before had, which the wheel gives no new entity');
    return 'ok';
  }, 30000);

  test('ai stepids: Python applies every write tool to the fixture keeping the base\'s STEP ids and classes, every new id above the base\'s highest', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'STEP-id verktyg');
    created.push(meta.id);
    await startPython();
    const base = stepOf((await model.original(meta.id)).bytes);
    const walls = idsOf(base, 'IFCWALL'); const [slab] = idsOf(base, 'IFCSLAB'); const [door] = idsOf(base, 'IFCDOOR');
    assert.ok(walls.length === 4 && slab && door && Math.min(...base.keys()) === 1000, 'the fixture: four walls, a slab and a door, ids from #1000');
    const SETS = [
      ['create_storeys_and_grid, define_type, create_wall, create_spaces, create_slab, create_opening, create_roof, create_element', BUILD],
      ['set_properties', [['set_properties', { ids: [walls[0]], pset: 'Pset_WallCommon', properties: [{ name: 'FireRating', value: 'EI90' }, { name: 'AcousticRating', value: 'R40' }] }]]],
      ['set_classification', [['set_classification', { ids: [walls[0], slab], system: 'CoClass', name: 'Vagg', code: 'NCB', uri: null, edition: null, source: null, dictionary_uri: null }]]],
      ['assign', [['assign', { ids: [walls[1]], storey: 'Plan 2', material: 'Tegel', category: 'brick' }]]],
      ['edit_element', [['edit_element', { id: walls[2], name: 'Vagg omdopt' }]]],
      ['transform_elements', [['transform_elements', { ids: [slab, door], dx: 0.5, dy: 0.25, dz: 0 }]]],
      ['delete_elements', [['delete_elements', { ids: [walls[3]], confirm: true }]]],
      ['set_site', [['set_site', { latitude: 59.33, longitude: 18.06, elevation: 20, crs: 'EPSG:3006', eastings: 674000, northings: 6580000, rotation: 0, site_name: null, vertical_datum: null }]]],
      ['set_responsible_party', [['set_responsible_party', { organization: 'Exempel Konsult AB', role: 'ARCHITECT', user_role: null, designation: 'A', contact_role: null }]]],
    ];
    const said = [];
    for (const [label, steps] of SETS) {
      const res = await ifcOps.previewChangeset(meta.id, changesOf(steps, meta.id));
      const f = keeps(assert, base, stepOf(res.bytes), label);
      if (label === 'delete_elements') assert.ok(f.gone.includes(walls[3]), 'the deleted wall is gone');
      else assert.ok(!f.gone.some((id) => walls.includes(id) || id === slab || id === door), label + ': no element is removed');
      said.push(label + ': ' + brief(f));
    }
    // The dataset is untouched by the previews.
    assert.equal(maxOf(stepOf((await model.original(meta.id)).bytes)), maxOf(base));
    return 'ok: ' + said.join('; ');
  }, 900000);

  test('ai stepids: approved change sets, each opened from the version before, keep the ids and never give one an earlier version had', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'STEP-id följd');
    created.push(meta.id);
    await startPython();
    let prev = stepOf((await model.original(meta.id)).bytes);
    let high = maxOf(prev); const removed = new Set(); const said = [];
    /** Approve a change set as the panel does, then hold the new version against the one before and against every earlier one. */
    async function approve(label, steps) {
      const result = await recipes.apply(meta.id, 'ifc_changeset', { changes: JSON.stringify(changesOf(steps, meta.id)) });
      const out = stepOf((await model.original(meta.id)).bytes);
      const f = keeps(assert, prev, out, label);
      const again = f.added.filter((id) => id <= high || removed.has(id));
      assert.deepEqual(again.slice(0, 10), [], label + `: no new id is one an earlier version had (up to #${high})`);
      for (const id of f.gone) removed.add(id);
      said.push(`${label}: ${brief(f)}, highest #${maxOf(out)}`);
      prev = out; high = Math.max(high, maxOf(out));
      assert.equal((await factsOf(meta.id)).maxId, high, label + ': the facts keep the highest id');
      return result.report || {};
    }
    const one = await approve('build', BUILD.slice(0, 6).concat([BUILD[7], BUILD[8]]));
    const by = (name) => (one.created || []).find((e) => e.name === name);
    const [syd, ost, norr, vast, golv, dorr] = ['Syd', 'Ost', 'Norr', 'Vast', 'Golv', 'Dorr'].map((n) => by(n));
    assert.ok(syd && ost && norr && vast && golv && dorr, 'the box, its slab and its door: ' + JSON.stringify((one.created || []).map((e) => e.name)));
    await approve('edit', [['edit_element', { id: dorr.guid || dorr.id, offset: 4 }], ['edit_element', { id: ost.guid || ost.id, name: 'Ost ny' }],
      ['transform_elements', { ids: [golv.guid || golv.id], dx: 0, dy: 0.5, dz: 0 }], ['set_properties', { ids: [syd.guid || syd.id], pset: 'Pset_WallCommon', properties: [{ name: 'FireRating', value: 'EI60' }] }]]);
    const before = maxOf(prev);
    await approve('delete what was built', [['delete_elements', { ids: [syd, ost, norr, vast, golv].map((e) => e.guid || e.id), confirm: true }]]);
    assert.ok(maxOf(prev) < before, `the delete took the highest ids (#${maxOf(prev)} < #${before}), so the next version is the case that matters`);
    await approve('build again', [['create_wall', { storey: 'Plan 3', start: [0, 0], end: [0, 8], thickness: null, height: 3, name: 'Ny 1', type: null }], ['create_wall', { storey: 'Plan 3', start: [0, 0], end: [6, 0], thickness: null, height: 3, name: 'Ny', type: null }]]);
    return 'ok: ' + said.join('; ');
  }, 900000);

  test('ai stepids: a new model is a whole new file numbered from #1, and a change set on it keeps its ids', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await startPython();
    const { dataset } = await ifcNew.create({ name: 'STEP-id ny modell', schema: 'IFC4X3_ADD2', storey: 'Plan 1' });
    created.push(dataset.id);
    const base = stepOf((await model.original(dataset.id)).bytes);
    assert.equal(Math.min(...base.keys()), 1, 'written by IfcOpenShell from scratch: a new file, not a version of another');
    const res = await ifcOps.previewChangeset(dataset.id, changesOf([['create_wall', { storey: 'Plan 1', start: [0, 0], end: [5, 0], thickness: 0.2, height: 3, name: 'A', type: null }]], dataset.id));
    const f = keeps(assert, base, stepOf(res.bytes), 'a wall in the new model');
    assert.equal(f.gone.length, 0, 'nothing of the new model is removed');
    return 'ok: ' + brief(f);
  }, 900000);

  test('ai stepids: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
