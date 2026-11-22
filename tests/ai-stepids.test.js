// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests that the IFC modelling keeps the STEP ids (PLAN 0a): Dataregium merges IFC versions with ifcmerge, which merges three ways on
 * the #ids, so every program that writes a model must keep the ids of what it does not delete, change it in place and never give an
 * id twice. Without Python: the model's facts keep the highest id any version had (`maxId`), also when a version's own is lower and
 * when an undo brings back an earlier file; a
 * STEP id guard in the file (decision F70 d: a loose IfcDocumentReference named StepIdGuard whose Identification is the protected id)
 * counts in the facts and shows in no table, no review before sharing and no comparison of versions; and a CDE version's metadata
 * `ifc_max_step_id` (a mocked server, no network) raises the facts.
 * With the real Pyodide (`?python=1` or cached components) every write tool is applied to the hand-written fixture (ids from #1000)
 * by the wheel's _ifc_changeset, the same call as the approval, and the written STEP text is compared with the base: every base
 * instance that is still there keeps its id and its class, and every new id is above the base's highest. A sequence of approved
 * change sets (build, edit, delete what was built, build again), each opened from the version before, never gives an id that an
 * earlier version had, and the version that deleted the highest ids carries a guard, so that the file alone, opened without the
 * dataset, numbers above it. The guard's form, its schema and EXPRESS check and buildingSMART's rules are tried in IFC2X3, IFC4 and
 * IFC4X3; a server's guard is kept as it is, two reduce to the highest, and the CDE's highest id holds the new ones. A new model
 * (ifc-new) is a whole new file, numbered from #1, and is documented as such.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const model = D.require('data/model');
  const step = D.require('data/ifc-step');
  const modelDiff = D.require('data/model-diff');
  const recipes = D.require('data/recipes');
  const writeTools = D.require('ai/write-tools');
  const ifcOps = D.require('data/ifc-ops');
  const ifcNew = D.require('data/ifc-new');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
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
  /** The STEP id guards of a STEP text's instances (IFC4 and IFC4X3 end with two more `$`), lowest first. */
  function guardsOf(step) {
    const out = [];
    for (const [id, v] of step) {
      const m = v.cls === 'IFCDOCUMENTREFERENCE' ? /^\$,'(\d+)','StepIdGuard'(?:,\$,\$)?\)$/.exec(v.text) : null;
      if (m) out.push({ id, protected: Number(m[1]), text: v.text });
    }
    return out.sort((a, b) => a.id - b.id);
  }
  /** A STEP text with guard lines added at its end (as a server would have written them). */
  const withGuards = (text, guards) => text.replace(/ENDSEC;\s*END-ISO-10303-21;\s*$/, guards.map(([id, p]) => `#${id}=IFCDOCUMENTREFERENCE($,'${p}','StepIdGuard',$,$);`).join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n');
  /** @param {string|Uint8Array} data @param {string} name */
  const fileOf = (data, name) => new File([data], name, { type: 'application/octet-stream' });
  /**
   * F70 d between the file a change was opened from and the one written, with the highest id the document had: one guard at most;
   * when nothing but a new guard reaches that id, a new guard of it one above it; otherwise no new guard, and the highest guard
   * before kept exactly as it was (never edited or moved), the lower ones removed. @returns {any[]} the guards written
   */
  function guardRule(assert, before, out, high, label) {
    const gs = guardsOf(out); const old = guardsOf(before); const oldIds = new Set(old.map((g) => g.id));
    const fresh = gs.filter((g) => !oldIds.has(g.id));
    const rest = Math.max(0, ...Array.from(out.keys()).filter((id) => !fresh.some((g) => g.id === id)));
    if (rest < high) assert.deepEqual(gs.map((g) => [g.id, g.protected]), [[high + 1, high]], label + `: the highest id #${high} is gone, so one guard of it at #${high + 1}`);
    else {
      assert.deepEqual(fresh, [], label + `: no new guard where the file reaches #${high} itself`);
      assert.deepEqual(gs, old.slice(-1), label + ': the highest guard before kept as it was, the others removed');
    }
    return gs;
  }
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
  async function countWhere(id, table, ids) {
    const handle = await datasets.ensureOpen(id);
    const r = await handle.engine.exec(`select count(*) from ${table} where id in (${ids.map(Number).join(', ')})`);
    return Number(r[0].values[0][0]);
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

  // ---- a mocked CDE whose versions say the highest STEP id their document has had (Dataregium's ifc_max_step_id) ----
  const BASE = 'dataspatium-asset://tests/stepids';
  const PROJECT = '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  let tokens = 0;
  D.net.virtual('tests/stepids/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    const doc = (id) => `/documents/1.0/documents/${id}/versions/1`;
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', oauth2_pkce_required: true }));
    if (path === '/foundation/oauth2/token') { tokens++; return Promise.resolve(json({ access_token: 's' + tokens, refresh_token: 'r' + tokens, expires_in: 3600, token_type: 'bearer' })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'modeller', name: 'Modelleraren' }));
    for (const id of ['doc-max', 'doc-plain', 'doc-none']) if (path === doc(id) + '/download') return Promise.resolve({ kind: 'text', data: fixtures.ifcText({ walls: 2 }) });
    if (path === doc('doc-max') + '/metadata') return Promise.resolve(json({ metadata: [{ name: 'file_name', value: ['hus.ifc'], data_type: 'string' }, { name: 'ifc_max_step_id', value: ['9000'], data_type: 'integer' }] }));
    if (path === doc('doc-plain') + '/metadata') return Promise.resolve(json({ metadata: [{ name: 'file_name', value: ['hus.ifc'], data_type: 'string' }] }));
    return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null;
  /** The dataset fetched from the version whose document has had ids up to #9000. */
  let fromCde = null;

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

  test('ai stepids: an undo that brings back an earlier file keeps the highest STEP id the undone version had', async (assert) => {
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'STEP-id ångra');
    created.push(meta.id);
    const before = (await factsOf(meta.id)).maxId;
    const higher = new Uint8Array(await fixtures.ifcFile({ walls: 4 }).arrayBuffer());
    const top = maxOf(stepOf(higher));
    assert.ok(top > before, `a later version with more instances (#${top} over #${before})`);
    const real = bridge.runIfcChangeset;
    try {
      bridge.runIfcChangeset = async (changes) => ({ bytes: higher.slice(), info: { elements: 9, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [], changed: [], deleted: [], findings: [], errors: 0 }, log: [] });
      await recipes.apply(meta.id, 'ifc_changeset', { changes: '[]' });
    } finally { bridge.runIfcChangeset = real; }
    assert.equal((await factsOf(meta.id)).maxId, top, 'the later version raised the highest id');
    await recipes.undo(meta.id);
    assert.equal(maxOf(stepOf((await model.original(meta.id)).bytes)), before, 'the undo brought back the earlier file');
    assert.equal((await factsOf(meta.id)).maxId, top, 'and the highest id stays the undone version\'s in the dataset\'s file');
    assert.equal((await datasets.get(meta.id)).model.maxId, top, 'and in its record');
    return 'ok';
  }, 30000);

  test('ai stepids: a guard in the file counts in the facts and shows in no table, no review before sharing and no comparison of versions', async (assert) => {
    const plainText = fixtures.ifcText({ walls: 2 });
    const top = maxOf(stepOf(plainText));
    // As after a merge that renumbered: two guards, the second protecting more than its own id.
    const guards = [[top + 1, top], [top + 2, top + 50]];
    const text = withGuards(plainText, guards);
    assert.equal(guardsOf(stepOf(text)).length, 2, 'the test file has its two guards');
    const plain = await importer.run(fileOf(plainText, 'utan.ifc'), { format: 'model' }, null, 'STEP-id utan vakt');
    const meta = await importer.run(fileOf(text, 'med.ifc'), { format: 'model' }, null, 'STEP-id med vakt');
    created.push(plain.id, meta.id);
    const facts = await factsOf(meta.id); const before = await factsOf(plain.id);
    assert.equal(facts.maxId, top + 50, 'the facts take the highest protected id');
    assert.equal(facts.entities, before.entities, 'the guards are not counted as the model\'s entities');
    assert.ok(!facts.types.some((x) => /DocumentReference/i.test(x.name)), 'nor listed among its entity types: ' + JSON.stringify(facts.types.slice(0, 5)));
    assert.deepEqual(facts.types, before.types, 'the types are those of the file without guards');
    const ids = guards.map(([id]) => id);
    assert.equal(await countWhere(meta.id, 'data', ids), 0, 'no guard in the element table');
    assert.equal(await countWhere(meta.id, '_entities', ids), 0, 'nor in the entity table');
    const personal = await step.personal(new TextEncoder().encode(text));
    assert.ok(!/StepIdGuard/.test(JSON.stringify(personal)) && !JSON.stringify(personal).includes(`"id":${top + 1}`), 'the review before sharing finds nothing in a guard');
    assert.deepEqual(personal, await step.personal(new TextEncoder().encode(plainText)), 'and the same as in the file without guards');
    const a = await datasets.ensureOpen(meta.id); const b = await datasets.ensureOpen(plain.id);
    const diff = await modelDiff.compare(a.engine, b.engine);
    assert.deepEqual([diff.counts.onlyHere, diff.counts.onlyThere, diff.counts.changed], [0, 0, 0], 'comparing the versions shows no difference: ' + JSON.stringify(diff.counts));
    return 'ok';
  }, 30000);

  test('ai stepids: a model fetched from a CDE takes the version\'s ifc_max_step_id into its facts, and does without it', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-stepids', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const fetch = (id) => opencde.importFile(connector, { project_id: PROJECT, name: 'Idna' }, { filename: 'hus.ifc', reference: `${BASE}/documents/1.0/documents/${id}/versions/1/download`, documentId: id, versionIndex: 1, ifcProject: null, source: 'Documents API' }, { name: 'STEP-id ' + id });
    const top = maxOf(stepOf(fixtures.ifcText({ walls: 2 })));
    fromCde = await fetch('doc-max');
    const plain = await fetch('doc-plain');
    const none = await fetch('doc-none');
    created.push(fromCde.id, plain.id, none.id);
    assert.equal((await factsOf(fromCde.id)).maxId, 9000, 'the server\'s highest id raises the facts');
    assert.equal((await datasets.get(fromCde.id)).model.maxId, 9000, 'in the dataset\'s record too');
    assert.equal((await factsOf(plain.id)).maxId, top, 'a version without the entry keeps the file\'s own');
    assert.equal((await factsOf(none.id)).maxId, top, 'and so does one whose metadata cannot be read');
    assert.equal(await opencde.seedStepIds(connector, plain.id, 'doc-max', 1), true, 'raising works on its own');
    assert.equal(await opencde.seedStepIds(connector, plain.id, 'doc-max', 1), false, 'and never twice or downwards');
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
      const out = stepOf(res.bytes);
      const f = keeps(assert, base, out, label);
      const gs = guardRule(assert, base, out, maxOf(base), label);
      if (label === 'delete_elements') assert.ok(f.gone.includes(walls[3]), 'the deleted wall is gone');
      else assert.ok(!f.gone.some((id) => walls.includes(id) || id === slab || id === door), label + ': no element is removed');
      said.push(label + ': ' + brief(f) + (gs.length ? `, guard #${gs[0].id}` : ''));
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
      const gs = guardRule(assert, prev, out, high, label);
      for (const id of f.gone) removed.add(id);
      said.push(`${label}: ${brief(f)}, highest #${maxOf(out)}` + (gs.length ? `, guard #${gs[0].id} of #${gs[0].protected}` : ''));
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
    const own = Math.max(...Array.from(prev.keys()).filter((id) => !guardsOf(prev).some((g) => g.id === id)));
    assert.ok(own < before, `the delete took the highest ids (#${own} < #${before}), so the next version is the case that matters`);
    assert.ok(guardsOf(prev).length === 1 && guardsOf(prev)[0].protected === before && maxOf(prev) === before + 1, `and the version carries a guard of #${before}, its highest id`);
    // The file leaves the app: opened as a dataset of its own, without the history of this one, it numbers above the guard.
    const guard = guardsOf(prev)[0].id;
    const away = await importer.run(fileOf((await model.original(meta.id)).bytes, 'ut.ifc'), { format: 'model' }, null, 'STEP-id utanför');
    created.push(away.id);
    assert.equal((await factsOf(away.id)).maxId, guard, 'the file alone says its highest id: the guard\'s');
    const elsewhere = await ifcOps.previewChangeset(away.id, changesOf([['create_wall', { storey: 'Plan 3', start: [0, 0], end: [3, 0], thickness: null, height: 3, name: 'Borta', type: null }]], away.id));
    const fresh = keeps(assert, prev, stepOf(elsewhere.bytes), 'the file opened without the dataset');
    assert.ok(fresh.added.length && fresh.added[0] > guard, `its new ids are above the guard #${guard}: #${fresh.added[0]}`);
    await approve('build again', [['create_wall', { storey: 'Plan 3', start: [0, 0], end: [0, 8], thickness: null, height: 3, name: 'Ny 1', type: null }], ['create_wall', { storey: 'Plan 3', start: [0, 0], end: [6, 0], thickness: null, height: 3, name: 'Ny', type: null }]]);
    return 'ok: ' + said.join('; ');
  }, 900000);

  test('ai stepids: the guard\'s form, schema, EXPRESS and buildingSMART checks in IFC2X3, IFC4 and IFC4X3, the next id after reopening, and two guards', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await startPython();
    await bridge.ensurePackages(['ifcopenshell', 'pytest']);
    const code = [
      'import ifcopenshell, ifcopenshell.validate, json, os',
      'D = _dataspatium',
      'os.makedirs("/tmp/guard", exist_ok=True)',
      'def errors(m):',
      '    lg = ifcopenshell.validate.json_logger()',
      '    ifcopenshell.validate.validate(m, lg, express_rules=True)',
      '    return [s for s in lg.statements if isinstance(s, dict) and str(s.get("level", "")).lower() == "error"]',
      'res = {}',
      'for schema in ("IFC2X3", "IFC4", "IFC4X3_ADD2"):',
      '    path = "/tmp/guard/%s.ifc" % schema',
      '    D._ifc_new_model(schema, "{}", path)',
      '    m = ifcopenshell.open(path); top = m.get_max_id(); r = {"top": top}',
      '    D._ifc_keep_guard(D._ifc_hold_ids(m, top)); r["unneeded"] = len(D._ifc_guards(m))',
      '    m = ifcopenshell.open(path); D._ifc_keep_guard(D._ifc_hold_ids(m, top + 5)); m.write(path + ".g")',
      '    r["lines"] = [l.strip() for l in open(path + ".g", encoding="latin-1") if "StepIdGuard" in l]',
      '    g = ifcopenshell.open(path + ".g"); plain = errors(ifcopenshell.open(path)); guarded = errors(g)',
      '    r["errors"] = [len(plain), len(guarded)]',
      '    r["on_guard"] = [str(s.get("message", ""))[:200] for s in guarded if s.get("instance") is not None and s["instance"].is_a() == "IfcDocumentReference"]',
      '    r["rules"] = [f for f in D._Rules(g).run().values() if f.get("ifc_class") == "IfcDocumentReference"]',
      '    r["next"] = g.createIfcCartesianPoint((0.0, 0.0, 0.0)).id()',
      '    two = ifcopenshell.open(path)',
      '    two.create_entity("IfcDocumentReference", None, str(top), "StepIdGuard", id=top + 1)',
      '    two.create_entity("IfcDocumentReference", None, str(top + 2), "StepIdGuard", id=top + 3)',
      '    D._ifc_keep_guard(D._ifc_hold_ids(two, 0)); r["two"] = [[e.id(), n] for e, n in D._ifc_guards(two)]',
      '    res[schema] = r',
      'print(json.dumps(res))',
    ].join('\n');
    const ran = await bridge.run(code);
    const out = ran.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
    let res = null;
    try { res = JSON.parse(out); } catch (_e) { throw new Error('the Python check failed: ' + JSON.stringify(ran.entries.map((e) => String(e.text || '').slice(0, 600)))); }
    const said = [];
    for (const [schema, r] of Object.entries(res)) {
      const h = r.top + 5;
      assert.equal(r.unneeded, 0, schema + ': no guard where the file has its highest id');
      const tail = schema === 'IFC2X3' ? '' : ',$,$';
      assert.deepEqual(r.lines, [`#${h + 1}=IFCDOCUMENTREFERENCE($,'${h}','StepIdGuard'${tail});`], schema + ': the guard in Dataregium\'s form');
      assert.equal(r.errors[1], r.errors[0], schema + ': the guard adds no error to the schema and EXPRESS check');
      assert.deepEqual(r.on_guard, [], schema + ': the check says nothing of the guard');
      assert.deepEqual(r.rules, [], schema + ': nor do buildingSMART\'s rules');
      assert.equal(r.next, h + 2, schema + ': reopened alone, the next new instance is above the guard');
      assert.deepEqual(r.two, [[r.top + 3, r.top + 2]], schema + ': of two guards the highest stays');
      said.push(`${schema}: guard #${h + 1}, next #${r.next}, errors ${r.errors[0]}`);
    }
    assert.deepEqual(Object.keys(res), ['IFC2X3', 'IFC4', 'IFC4X3_ADD2']);
    return 'ok: ' + said.join('; ');
  }, 900000);

  test('ai stepids: a server\'s guard is kept as it is, two reduce to the highest, and the CDE\'s highest id holds the new ones', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await startPython();
    const two = fixtures.ifcText({ walls: 2 }); const T2 = maxOf(stepOf(two)); const T3 = maxOf(stepOf(fixtures.ifcText({ walls: 3 })));
    const said = [];
    /** Previews of an edit in place and of a new wall on a dataset, each held to the ids and the guard rule. */
    async function both(id, label) {
      const base = stepOf((await model.original(id)).bytes);
      const high = Math.max(maxOf(base), (await factsOf(id)).maxId);
      const [wall] = idsOf(base, 'IFCWALL');
      for (const [what, steps] of [['edit', [['edit_element', { id: wall, name: 'Omdopt' }]]], ['wall', [['create_wall', { storey: 'Plan 1', start: [0, 0], end: [4, 0], thickness: null, height: 3, name: 'Ny', type: null }]]]]) {
        const out = stepOf((await ifcOps.previewChangeset(id, changesOf(steps, id))).bytes);
        const f = keeps(assert, base, out, `${label}, ${what}`);
        const fresh = f.added.filter((n) => !guardsOf(out).some((g) => g.id === n));
        assert.deepEqual(fresh.filter((n) => n <= high).slice(0, 10), [], `${label}, ${what}: every new id is above #${high}`);
        const gs = guardRule(assert, base, out, high, `${label}, ${what}`);
        said.push(`${label}, ${what}: new ${fresh.length}` + (gs.length ? `, guard #${gs[0].id} of #${gs[0].protected}` : ''));
      }
    }
    const one = await importer.run(fileOf(withGuards(two, [[T3 + 1, T3]]), 'server.ifc'), { format: 'model' }, null, 'STEP-id servervakt');
    const merged = await importer.run(fileOf(withGuards(two, [[T2 + 1, T2], [T3 + 1, T3]]), 'merged.ifc'), { format: 'model' }, null, 'STEP-id två vakter');
    created.push(one.id, merged.id);
    assert.equal((await factsOf(one.id)).maxId, T3 + 1, 'the server\'s guard is the file\'s highest');
    await both(one.id, 'a server\'s guard');
    await both(merged.id, 'two guards after a merge');
    assert.ok(fromCde, 'the CDE test ran first');
    await both(fromCde.id, 'the CDE\'s ifc_max_step_id 9000');
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
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
