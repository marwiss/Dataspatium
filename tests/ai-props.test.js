// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for LoadBearing, Status, IsExternal and the checked property sets (recommendation 13 of the native IFC study, 4, 8 and 9 of
 * the Praxi study): create_wall and create_slab take load_bearing and they and create_roof take status, only when given and never
 * guessed; set_properties refuses a number with its unit and advises the guidance's naming for a set of the model's own; assign takes
 * the material's category; the build and change texts say so, and the agent's preview passes the wheel's notes on. With the real
 * Pyodide (`?python=1` or cached components) the wheel writes LoadBearing and Status on the type when every occurrence agrees and on
 * the element otherwise, sets IsExternal from the topology on the walls, their doors and windows and the roof of a closed storey and
 * leaves an open storey alone with a note, checks Pset_ and Qto_ sets against the templates of IFC4X3, IFC4 and IFC2X3 (names,
 * booleans, measures, enumerations, units in values), and writes the material's category.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const writeTools = D.require('ai/write-tools');
  const agent = D.require('ai/agent');
  const i18n = D.require('ui/i18n');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcNew = D.require('data/ifc-new');
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
  const wall = (cs, patch) => writeTools.call(cs, 'create_wall', Object.assign({ storey: 'Plan 1', start: [0, 0], end: [4, 0], thickness: 0.2, height: 3, name: 'A', type: null, partition: null, load_bearing: null, status: null }, patch || {}));
  const props = (cs, pset, list) => writeTools.call(cs, 'set_properties', { ids: [12], pset, properties: list.map(([name, value]) => ({ name, value })) });
  /** The wheel applies change sets to new models of the three schemas in the app's Python and prints one line of JSON with the facts. */
  const PROPS = [
    'import json',
    'import os',
    'import ifcopenshell',
    'import ifcopenshell.util.element as el',
    'D = _dataspatium',
    'os.makedirs("/data/step", exist_ok=True)',
    'L = lambda material, thickness, category=None, role=None: {"material": material, "thickness": thickness, "category": category, "role": role}',
    'BOX = [["Syd", [0, 0], [12, 0], "EXISTING"], ["Öst", [12, 0], [12, 8], "EXISTING"], ["Norr", [12, 8], [0, 8], "EXISTING"], ["Väst", [0, 8], [0, 0], "DEMOLISH"]]',
    'def own(e, pset):',
    '    p = dict(el.get_psets(e, psets_only=True, should_inherit=False).get(pset, {}))',
    '    p.pop("id", None)',
    '    return {k: (v[0] if isinstance(v, list) and len(v) == 1 else v) for k, v in p.items()}',
    'def named(m, cls, name):',
    '    return next(e for e in m.by_type(cls) if e.Name == name)',
    'def fresh(schema, tag):',
    '    path = "/data/step/props-%s-%s.ifc" % (schema, tag)',
    '    D._ifc_new_model(schema, json.dumps({"storey": "Plan 1"}), path)',
    '    return ifcopenshell.open(path)',
    'def ops_for(schema):',
    '    old = schema == "IFC2X3"',
    '    ops = [{"tool": "define_type", "kind": "wall", "name": "YV1", "layers": [L("Puts", 0.02), L("Betong", 0.25, "concrete", "load_bearing"), L("Puts", 0.03)], "predefined_type": None if old else "SOLIDWALL"},',
    '           {"tool": "define_type", "kind": "wall", "name": "IV1", "layers": [L("Gips", 0.0125, "gypsum"), L("Regel", 0.07, "wood"), L("Gips", 0.0125, "gypsum")], "predefined_type": None if old else "PARTITIONING"},',
    '           {"tool": "create_storeys_and_grid", "storeys": [{"name": "Plan 2", "elevation": 3}], "grid": None}]',
    '    for name, a, b, status in BOX:',
    '        ops.append({"tool": "create_wall", "storey": "Plan 1", "start": a, "end": b, "thickness": None, "height": 3, "name": name, "type": "new-1", "load_bearing": True, "status": status})',
    '    ops += [{"tool": "create_wall", "storey": "Plan 1", "start": [6, 0], "end": [6, 8], "thickness": None, "height": 3, "name": "Mitt", "type": "new-2", "load_bearing": False, "status": "NEW"},',
    '            {"tool": "create_wall", "storey": "Plan 2", "start": [0, 0], "end": [5, 0], "thickness": 0.2, "height": 3, "name": "Lös"},',
    '            {"tool": "create_slab", "storey": "Plan 1", "outline": [[0, 0], [12, 0], [12, 8], [0, 8]], "thickness": 0.25, "name": "Platta", "load_bearing": True},',
    '            {"tool": "create_opening", "wall_id": "new-3", "offset": 2, "width": 1, "height": 2.1, "sill": 0, "fill": "door", "name": "Ytterdörr"},',
    '            {"tool": "create_opening", "wall_id": "new-7", "offset": 2, "width": 0.9, "height": 2.1, "sill": 0, "fill": "door", "name": "Innerdörr"},',
    '            {"tool": "create_opening", "wall_id": "new-4", "offset": 3, "width": 1.2, "height": 1.2, "sill": 0.9, "fill": "window", "name": "Fönster"},',
    '            {"tool": "create_roof", "storey": "Plan 1", "shape": "gable", "outline": None, "pitch": 30, "overhang": 0.4, "thickness": 0.25, "ridge": None, "base": None, "name": "Tak", "status": "EXISTING"},',
    '            {"tool": "set_properties", "ids": ["new-3"], "pset": "pset_wallcommon", "properties": {"firerating": "EI60", "IsExternal": False}},',
    '            {"tool": "set_properties", "ids": ["new-12"], "pset": "Pset_WindowCommon", "properties": {"ThermalTransmittance": "0,9", "GlazingAreaFraction": 0.7}},',
    '            {"tool": "set_properties", "ids": ["new-12"], "pset": "Pset_Condition", "properties": {"AssessmentDate": "2026-11-12", "AssessmentCondition": "good"}},',
    '            {"tool": "set_properties", "ids": ["new-1"], "pset": "SE-ACME-42_Acoustics", "properties": {"SoundClass": "B"}},',
    '            {"tool": "assign", "ids": ["new-9"], "storey": None, "material": "Betong C30/37", "category": "concrete"}]',
    '    return ops',
    'out = {}',
    'for schema in ("IFC4X3_ADD2", "IFC4", "IFC2X3"):',
    '    m = fresh(schema, "main")',
    '    cs = D._ChangeSet(m)',
    '    cs.apply(ops_for(schema))',
    '    f = {"notes": cs.notes, "errors": cs.findings()[1]}',
    '    f["types"] = {n: own(named(m, "IfcWallType", n), "Pset_WallCommon") for n in ("YV1", "IV1")}',
    '    f["acoustics"] = own(named(m, "IfcWallType", "YV1"), "SE-ACME-42_Acoustics")',
    '    f["walls"] = {n: own(named(m, "IfcWall", n), "Pset_WallCommon") for n in ("Syd", "Öst", "Norr", "Väst", "Mitt", "Lös")}',
    '    f["doors"] = {n: own(named(m, "IfcDoor", n), "Pset_DoorCommon") for n in ("Ytterdörr", "Innerdörr")}',
    '    window = named(m, "IfcWindow", "Fönster")',
    '    f["window"] = own(window, "Pset_WindowCommon")',
    '    f["condition"] = own(window, "Pset_Condition")',
    '    f["slab"] = own(named(m, "IfcSlab", "Platta"), "Pset_SlabCommon")',
    '    f["roof_slabs"] = [own(e, "Pset_SlabCommon") for e in m.by_type("IfcSlab") if e.Name.startswith("Tak ")]',
    '    f["roof"] = own(named(m, "IfcRoof", "Tak"), "Pset_RoofCommon")',
    '    f["category"] = [getattr(x, "Category", None) for x in m.by_type("IfcMaterial") if x.Name == "Betong C30/37"]',
    '    measure = [p.NominalValue.is_a() for p in m.by_type("IfcPropertySingleValue") if p.Name == "ThermalTransmittance"]',
    '    f["measure"] = measure',
    '    out[schema] = f',
    'def refused(ops, schema="IFC4X3_ADD2"):',
    '    base = [{"tool": "define_type", "kind": "wall", "name": "YV1", "layers": [L("Betong", 0.2)], "predefined_type": None},',
    '            {"tool": "create_wall", "storey": "Plan 1", "start": [0, 0], "end": [4, 0], "thickness": None, "height": 3, "name": "X", "type": "new-1"}]',
    '    try:',
    '        D._ChangeSet(fresh(schema, "refused")).apply(base + ops)',
    '        return None',
    '    except D.DataspatiumError as exc:',
    '        return str(exc)',
    'def props(pset, values):',
    '    return [{"tool": "set_properties", "ids": ["new-2"], "pset": pset, "properties": values}]',
    'out["refused"] = {',
    '    "property": refused(props("Pset_WallCommon", {"UValue": 0.2})),',
    '    "set": refused(props("Pset_WallComon", {"FireRating": "EI60"})),',
    '    "boolean": refused(props("Pset_WallCommon", {"IsExternal": "ja"})),',
    '    "unit": refused(props("Pset_WallCommon", {"ThermalTransmittance": "0.18 W/m²K"})),',
    '    "label_unit": refused(props("Pset_WallCommon", {"AcousticRating": "52 dB"})),',
    '    "enum": refused(props("Pset_WallCommon", {"Status": "gammal"})),',
    '    "number": refused(props("Pset_WallCommon", {"ThermalTransmittance": "low"})),',
    '    "quantity": refused(props("Qto_WallBaseQuantities", {"Lenght": 3})),',
    '    "own_unit": refused(props("SE-ACME-42_Acoustics", {"Rw": "52 dB"})),',
    '    "partition": refused([{"tool": "create_wall", "storey": "Plan 1", "start": [0, 1], "end": [4, 1], "thickness": 0.1, "height": 3, "name": "P", "partition": True, "load_bearing": True}]),',
    '    "status": refused([{"tool": "create_slab", "storey": "Plan 1", "outline": [[0, 0], [4, 0], [4, 4]], "thickness": 0.2, "name": "S", "status": "OLD"}]),',
    '    "category": refused([{"tool": "assign", "ids": ["new-2"], "storey": None, "material": "Trä", "category": "timber"}]),',
    '    "accepted": refused(props("Pset_WallCommon", {"Status": "existing", "ThermalTransmittance": 0.2, "IsExternal": "true"})),',
    '}',
    'print(json.dumps(out, ensure_ascii=False))',
  ];

  test('ai props: create_wall, create_slab and create_roof take load_bearing and status only when given, and the descriptions say them in all seven languages', async (assert) => {
    for (const [name, keys] of [['create_wall', ['load_bearing', 'status']], ['create_slab', ['load_bearing', 'status']], ['create_roof', ['status']]]) {
      const tool = writeTools.TOOLS.find((x) => x.name === name);
      for (const key of keys) assert.ok(key in tool.parameters.properties, name + ' takes ' + key);
      assert.ok(tool.description.includes('NEW, EXISTING, DEMOLISH or TEMPORARY'), name + ': the statuses');
      if (keys.includes('load_bearing')) assert.ok(tool.description.includes('never assumed') && tool.description.includes('as the brief or the person says'), name + ': never guessed');
    }
    assert.ok(!('load_bearing' in writeTools.TOOLS.find((x) => x.name === 'create_roof').parameters.properties), 'the roof takes no load_bearing');
    assert.ok(writeTools.TOOLS.find((x) => x.name === 'create_wall').description.includes('The app sets IsExternal itself'), 'the wall tool leaves IsExternal to the app');
    assert.deepEqual(writeTools.STATUSES, ['NEW', 'EXISTING', 'DEMOLISH', 'TEMPORARY']);
    const cs = writeTools.create('props-test');
    assert.ok(wall(cs, { load_bearing: true, status: 'existing' }).ok);
    assert.deepEqual(cs.ops[0], { tool: 'create_wall', storey: 'Plan 1', start: [0, 0], end: [4, 0], thickness: 0.2, height: 3, name: 'A', load_bearing: true, status: 'EXISTING', ref: 'new-1' }, 'the status in capitals');
    assert.ok(wall(cs, { name: 'B' }).ok && !('load_bearing' in cs.ops[1]) && !('status' in cs.ops[1]), 'null leaves both out: the wheel writes nothing');
    assert.ok(wall(cs, { name: 'C', load_bearing: false, partition: true }).ok && cs.ops[2].load_bearing === false, 'a partition that bears no load');
    const refused = (out, words, label) => { assert.ok(out.error && words.every((w) => out.error.includes(w)), label + ': ' + JSON.stringify(out)); };
    refused(wall(cs, { partition: true, load_bearing: true }), ['partition', 'non-load-bearing'], 'a load-bearing partition');
    refused(wall(cs, { load_bearing: 'yes' }), ['load_bearing must be true, false or null'], 'load_bearing as text');
    refused(wall(cs, { status: 'old' }), ['NEW, EXISTING, DEMOLISH, TEMPORARY'], 'a status outside the list');
    const slab = writeTools.call(cs, 'create_slab', { storey: 'Plan 1', outline: null, thickness: null, name: 'S', type: null, load_bearing: true, status: 'NEW' });
    assert.ok(slab.ok && cs.ops[3].load_bearing === true && cs.ops[3].status === 'NEW', JSON.stringify(cs.ops[3]));
    const roof = writeTools.call(cs, 'create_roof', { storey: null, shape: 'flat', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null, type: null, status: 'Demolish', load_bearing: true });
    assert.ok(roof.ok && cs.ops[4].status === 'DEMOLISH' && !('load_bearing' in cs.ops[4]), 'the roof\'s status, and no load_bearing: ' + JSON.stringify(cs.ops[4]));
    assert.equal(cs.ops.length, 5, 'nothing refused landed');
    const codes = i18n.LANGUAGES.map((x) => x.code);
    const before = i18n.language();
    const seen = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const [bearing, plain, partition, floor, top] = cs.ops.map((op) => writeTools.describe(op));
        assert.ok(bearing.endsWith(i18n.t('ai.change.bearing.true') + i18n.t('ai.change.status.existing')), code + ': ' + bearing);
        assert.ok(!plain.includes(i18n.t('ai.change.bearing.true')) && !plain.includes(i18n.t('ai.change.bearing.false')), code + ': nothing said without a value: ' + plain);
        assert.ok(partition.endsWith(i18n.t('ai.change.wall.partition')), code + ': a partition says it bears no load once: ' + partition);
        assert.ok(floor.endsWith(i18n.t('ai.change.bearing.true') + i18n.t('ai.change.status.new')) && top.endsWith(i18n.t('ai.change.status.demolish')), code + ': ' + floor + ' | ' + top);
        for (const line of [bearing, plain, partition, floor, top]) assert.ok(!/\{\w+\}/.test(line), code + ': every placeholder filled: ' + line);
        seen.push(bearing);
      }
      assert.equal(new Set(seen).size, 7, 'seven different texts: ' + seen.join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai props: set_properties refuses a number with its unit and advises the naming of a set of the model\'s own, and assign takes the material\'s category', async (assert) => {
    const tool = writeTools.TOOLS.find((x) => x.name === 'set_properties');
    for (const words of ['Pset_', 'Qto_', 'templates', '40, not "40 dB"', 'country-origin-project_Name', 'PascalCase', 'Never set IsExternal']) assert.ok(tool.description.includes(words), 'the tool says: ' + words);
    const cs = writeTools.create('props-test-2');
    for (const [value, number] of [['52 dB', '52'], ['0,18 W/m²K', '0.18'], ['40dB', '40'], ['-5 °C', '-5'], ['2.5 m', '2.5'], ['30 %', '30']]) {
      const out = props(cs, 'Pset_WallCommon', [['X', value]]);
      assert.ok(out.error && out.error.includes('give the number only') && out.error.includes(`(${number})`) && !out.error.includes(value) && out.error.startsWith('property 1:'), value + ': the number, by position and without quoting the value: ' + JSON.stringify(out));
    }
    for (const value of ['EI60', '1 A', '12 Main Street', 'R\'w 52', '3']) assert.ok(props(cs, 'Pset_WallCommon', [['X', value]]).ok, 'no unit after a number: ' + value);
    assert.ok(String(props(cs, 'Pset_', [['A', 'b']]).error).includes('no set\'s name'), 'Pset_ alone');
    assert.ok(!('note' in props(cs, 'Pset_WallCommon', [['FireRating', 'EI60']])), 'IFC\'s own set: no advice, the wheel checks it against the template');
    assert.ok(!('note' in props(cs, 'SE-ACME-42_Acoustics', [['SoundClass', 'B']])), 'a set named as the guidance says: no advice');
    const advice = props(cs, 'Ljud', [['ljud klass', 'B'], ['Rating', 'B']]);
    assert.ok(advice.ok && /^advice: /.test(advice.note) && advice.note.includes('SE-ACME-42_Acoustics') && advice.note.includes('rather than Ljud') && advice.note.includes('rather than ljud klass') && !advice.note.includes('Rating,'), 'advice, not a refusal: ' + JSON.stringify(advice));
    assert.ok(props(cs, 'SE-ACME-42_Ljud', [['Ljudklass', 'B']]).ok, 'Swedish words in PascalCase pass');
    assert.ok(String(props(cs, 'SE-ÅÄÖ_Ljud', [['Klass', 'B']]).note).includes('a-z'), 'å, ä and ö are advised against');
    const assignTool = writeTools.TOOLS.find((x) => x.name === 'assign');
    assert.ok('category' in assignTool.parameters.properties && writeTools.MATERIAL_CATEGORIES.every((c) => assignTool.description.includes(c)), 'assign takes the eleven categories');
    assert.ok(writeTools.call(cs, 'assign', { ids: [12], storey: null, material: 'Betong C30/37', category: 'Concrete' }).ok);
    assert.deepEqual(cs.ops[cs.ops.length - 1], { tool: 'assign', ids: [12], storey: null, material: 'Betong C30/37', category: 'concrete' });
    assert.ok(writeTools.describe(cs.ops[cs.ops.length - 1]).includes('Betong C30/37 (concrete)'), 'the description names the category');
    assert.ok(writeTools.call(cs, 'assign', { ids: [12], storey: null, material: 'Gips', category: null }).ok && !('category' in cs.ops[cs.ops.length - 1]), 'null leaves it out');
    assert.ok(String(writeTools.call(cs, 'assign', { ids: [12], storey: null, material: 'Trä', category: 'timber' }).error).includes('concrete, steel'), 'a category outside the list');
    assert.ok(String(writeTools.call(cs, 'assign', { ids: [12], storey: 'Plan 1', material: null, category: 'wood' }).error).includes('goes with a material'), 'a category without a material');
    return 'ok';
  });

  test('ai props: the build and change texts never assume load_bearing, leave IsExternal to the app and give a twin\'s status, and the preview passes the wheel\'s notes on', async (assert) => {
    assert.ok(agent.SYSTEM_BUILD.includes('Give load_bearing on walls and slabs only when the brief or the person says whether they bear load, otherwise null; never assume it.'), 'build: never assumed');
    assert.ok(agent.SYSTEM_BUILD.includes('The app sets IsExternal itself from the topology of the closed storeys'), 'build: IsExternal is the app\'s');
    assert.ok(agent.SYSTEM_BUILD.includes('For a digital twin of an existing building give its walls, slabs and roof status EXISTING, for a new building NEW; leave status null when the brief does not say which.'), 'build: the status');
    assert.ok(agent.SYSTEM_BUILD.includes('never starts with Pset_ or Qto_'), 'build: own sets');
    assert.ok(agent.SYSTEM_CHANGE.includes('never assume them') && agent.SYSTEM_CHANGE.includes('The app sets IsExternal itself'), 'change: the same');
    assert.ok(agent.PREVIEW_TOOL.description.includes('notes on what the app left out'), 'the preview tool tells of the notes');
    const ds = await importer.run(fixtures.ifcFile({ walls: 1 }), { format: 'model' }, null, 'Egenskaper');
    created.push(ds.id);
    const cs = writeTools.create(ds.id);
    assert.ok(wall(cs, {}).ok);
    const real = bridge.runIfcChangeset; const state = bridge.state;
    const notes = ['IsExternal was left out on the walls of storey Plan 2 that the change set made or changed, and on their doors and windows: 2 wall ends stand open, so the app cannot tell outside from inside'];
    let info = { created: [{ id: 900, ifc_class: 'IfcWall', storey: 'Plan 1' }], changed: [], deleted: [], findings: [], errors: 0, notes };
    bridge.runIfcChangeset = async () => ({ bytes: new Uint8Array(4), info, log: [] });
    try {
      bridge.state = 'ready';
      const out = await agent.previewFor(ds.id, cs);
      assert.ok(!out.error, JSON.stringify(out));
      assert.deepEqual(out.notes, notes, 'the notes reach the agent: ' + JSON.stringify(out));
      info = Object.assign({}, info, { notes: [] });
      assert.ok(!('notes' in (await agent.previewFor(ds.id, cs))), 'no notes: no key');
    } finally { bridge.runIfcChangeset = real; bridge.state = state; }
    return 'ok';
  }, 20000);

  test('ai props: Python writes LoadBearing and Status on the type or the element, IsExternal from the topology, checks IFC\'s sets against the templates of IFC4X3, IFC4 and IFC2X3 and writes the material\'s category', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const run = await bridge.run(PROPS.join('\n'));
    const error = run.entries.find((e) => e.kind === 'error');
    assert.ok(!error, 'the snippet ran: ' + (error && error.text));
    const facts = JSON.parse(run.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim().split('\n').pop() || 'null');
    const open = 'IsExternal was left out on the walls of storey Plan 2 that the change set made or changed, and on their doors and windows: 2 wall ends stand open, so the app cannot tell outside from inside';
    for (const schema of ['IFC4X3_ADD2', 'IFC4', 'IFC2X3']) {
      const f = facts[schema];
      const old = schema === 'IFC2X3';
      assert.equal(f.errors, 0, schema + ': no schema errors');
      assert.ok(f.notes.includes(open), schema + ': the open storey is noted: ' + JSON.stringify(f.notes));
      // LoadBearing: YV1's four walls all bear load, so the type says it; IV1's one wall bears none. Status: three EXISTING and one
      // DEMOLISH, so each wall says its own, and IV1's one wall is NEW, so the type says it. IFC2X3 has no Status.
      assert.deepEqual(f.types, { YV1: { LoadBearing: true }, IV1: old ? { LoadBearing: false } : { LoadBearing: false, Status: 'NEW' } }, schema + ': the types: ' + JSON.stringify(f.types));
      for (const [name, status] of [['Syd', 'EXISTING'], ['Öst', 'EXISTING'], ['Norr', 'EXISTING'], ['Väst', 'DEMOLISH']]) {
        const w = f.walls[name];
        assert.ok(w.IsExternal === true && !('LoadBearing' in w) && w.Status === (old ? undefined : status), schema + ' ' + name + ': external, its LoadBearing on the type, its own status: ' + JSON.stringify(w));
      }
      assert.ok(f.walls.Syd.FireRating === 'EI60', schema + ': set_properties spelled the names as the template does');
      assert.deepEqual(f.walls.Mitt, { IsExternal: false }, schema + ': the inner wall is internal, and LoadBearing and Status are on its type');
      assert.deepEqual(f.walls['Lös'], {}, schema + ': nothing guessed on the open storey');
      assert.deepEqual([f.doors['Ytterdörr'].IsExternal, f.doors['Innerdörr'].IsExternal, f.window.IsExternal], [true, false, true], schema + ': the doors and the window follow their walls');
      assert.ok(f.window.ThermalTransmittance === 0.9 && f.window.GlazingAreaFraction === 0.7 && f.measure.every((m) => m === 'IfcThermalTransmittanceMeasure'), schema + ': "0,9" became the measure 0.9: ' + JSON.stringify([f.window, f.measure]));
      assert.deepEqual(f.condition, { AssessmentDate: '2026-11-12', AssessmentCondition: 'good' }, schema + ': Pset_Condition');
      assert.deepEqual(f.acoustics, { SoundClass: 'B' }, schema + ': a set of the model\'s own on the type');
      assert.deepEqual(f.slab, { LoadBearing: true }, schema + ': the untyped slab says it itself');
      assert.ok(f.roof_slabs.length === 2 && f.roof_slabs.every((s) => s.IsExternal === true && s.Status === (old ? undefined : 'EXISTING')), schema + ': the roof slabs: ' + JSON.stringify(f.roof_slabs));
      assert.deepEqual(f.roof, old ? { IsExternal: true } : { Status: 'EXISTING', IsExternal: true }, schema + ': the roof');
      assert.deepEqual(f.category, [old ? null : 'concrete'], schema + ': the material\'s category');
      if (old) {
        for (const note of ['Pset_Condition is not a set of IFC2X3, so it was written as IFC4 defines it', 'Pset_WallCommon has no Status in IFC2X3, so it was left out', 'IFC2X3 has no material categories, so the category concrete of Betong C30/37 was left out']) assert.ok(f.notes.includes(note), 'IFC2X3: ' + note);
      }
    }
    const r = facts.refused;
    const said = (key, words) => assert.ok(typeof r[key] === 'string' && words.every((w) => r[key].includes(w)), key + ': ' + r[key]);
    said('property', ['Pset_WallCommon has no property UValue', 'ThermalTransmittance', 'a set of your own']);
    said('set', ['Pset_WallComon is not a property or quantity set of IFC4X3', 'nearest: Pset_WallCommon', 'must not start with Pset_ or Qto_', 'country-origin-project_Name']);
    said('boolean', ['Pset_WallCommon.IsExternal is true or false']);
    said('unit', ['give the number only', '0.18']);
    said('label_unit', ['AcousticRating', 'give the number only', '52']);
    said('enum', ['Status takes one of', 'EXISTING', 'gammal']);
    said('number', ['ThermalTransmittance is a number (IfcThermalTransmittanceMeasure)']);
    said('quantity', ['Qto_WallBaseQuantities has no property Lenght', 'nearest: Length']);
    said('own_unit', ['SE-ACME-42_Acoustics.Rw', 'give the number only']);
    said('partition', ['partition true makes a non-load-bearing wall']);
    said('status', ['status must be NEW, EXISTING, DEMOLISH, TEMPORARY']);
    said('category', ['category must be one of concrete']);
    assert.equal(r.accepted, null, 'an enumeration in any case, a number and "true" are accepted');
    return 'ok';
  }, 900000);

  test('ai props: Python reports IsExternal left out on an open storey in the preview, which the agent reads', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset } = await ifcNew.create({ name: 'Egenskapsprov', schema: 'IFC4X3_ADD2', storey: 'Plan 1' });
    created.push(dataset.id);
    const cs = writeTools.create(dataset.id);
    for (const [name, start, end] of [['Syd', [0, 0], [12, 0]], ['Öst', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]]]) assert.ok(wall(cs, { name, start, end, load_bearing: true }).ok, name);
    const out = await agent.previewFor(dataset.id, cs);
    assert.ok(!out.error && out.errors === 0, JSON.stringify(out));
    assert.ok(Array.isArray(out.notes) && out.notes.some((n) => n.startsWith('IsExternal was left out on the walls of storey Plan 1') && n.includes('2 wall ends stand open')), 'the agent learns why: ' + JSON.stringify(out.notes));
    assert.ok(out.topology && out.topology[0] && out.topology[0].closed === false, 'and the topology says the storey is open');
    return 'ok';
  }, 900000);

  test('ai props: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
