// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for changing elements in place (recommendation 7 of the Praxi study, 17 of the native IFC study): edit_element is a write
 * tool without a ref whose step holds only the fields given, checked per kind of element and against the change set's refs and
 * types; the step list describes it in all seven languages; and the change text tells the AI to edit elements instead of deleting
 * and recreating them; the read tool get_parameters never starts Python. With the real Pyodide (`?python=1` or cached components)
 * get_parameters reads a box's walls from their axes, its door, window, slab and roof, and the wheel moves an inner wall, gives an outer wall a
 * thicker type, widens a door, lowers a window, enlarges a slab and steepens a roof in a second change set, keeping every GlobalId,
 * with the joins, layers and base quantities made anew and no point left unused (rule IFC106); and transform_elements moves a window
 * with its opening and a wall with its joins, while it refuses a storey, as edit_element refuses what does not fit.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const writeTools = D.require('ai/write-tools');
  const tools = D.require('ai/model-tools');
  const agent = D.require('ai/agent');
  const i18n = D.require('ui/i18n');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const ifcNew = D.require('data/ifc-new');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
  const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;
  const layer = (material, thickness, category, role) => ({ material, thickness, category, role });
  /** Every field of edit_element null, as a provider in strict mode sends it. */
  const BLANK = { id: null, name: null, start: null, end: null, thickness: null, height: null, type: null, outline: null, offset: null, width: null, sill: null, pitch: null, overhang: null, base: null };
  const edit = (cs, patch) => writeTools.call(cs, 'edit_element', Object.assign({}, BLANK, patch));
  const YV1 = { kind: 'wall', name: 'YV1', layers: [layer('Puts', 0.02, null, 'outer_finish'), layer('Lättbetong', 0.25, 'block', 'load_bearing'), layer('Puts', 0.03, null, 'inner_finish')], predefined_type: 'SOLIDWALL' };
  const IV1 = { kind: 'wall', name: 'IV1', layers: [layer('Gips', 0.0125, 'gypsum', 'inner_finish'), layer('Regel', 0.07, 'wood', null), layer('Gips', 0.0125, 'gypsum', 'inner_finish')], predefined_type: 'PARTITIONING' };
  const BJ1 = { kind: 'slab', name: 'BJ1', layers: [layer('Betong', 0.25, 'concrete', 'load_bearing')], predefined_type: null };
  const TAK1 = { kind: 'roof', name: 'TAK1', layers: [layer('Takpannor', 0.05, null, 'outer_finish'), layer('Takstol', 0.2, 'wood', 'load_bearing')], predefined_type: null };
  const YV2 = { kind: 'wall', name: 'YV2', layers: [layer('Betong', 0.4, 'concrete', 'load_bearing')], predefined_type: null };
  /** The outer walls of a 12 × 8 m box, counter-clockwise, and an inner wall across it. */
  const BOX = [['Syd', [0, 0], [12, 0]], ['Öst', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]], ['Väst', [0, 8], [0, 0]]];
  const stdoutOf = (out) => out.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  async function factsOf(bytes, code) {
    await bridge.writeFile('/data/step/edit-facts.ifc', bytes.slice());  // the engine transfers, and a browser detaches, the buffer
    const out = await bridge.run(['import json', 'import ifcopenshell', 'import ifcopenshell.util.element as el', 'import ifcopenshell.util.placement as pl',
      'import ifcopenshell.util.unit', 'm = ifcopenshell.open("/data/step/edit-facts.ifc")', 'scale = ifcopenshell.util.unit.calculate_unit_scale(m)'].concat(code).join('\n'));
    const error = out.entries.find((e) => e.kind === 'error');
    if (error) throw new Error(String(error.text));
    return JSON.parse(stdoutOf(out).trim().split('\n').pop() || 'null');
  }
  /** The walls by name (GlobalId, body length and thickness, axis in metres, type, the usage's offset, Qto_WallBaseQuantities), the joins,
   * the walls' footprints (summed, united, and the rooms inside them), every other element by class and name (GlobalId, where it stands,
   * its quantities, whether it is placed in its opening), the storeys' GlobalIds and the resources that nothing uses. */
  const FACTS = [
    'from shapely.geometry import Polygon',
    'from shapely.ops import unary_union',
    'QTO = {"IfcDoor": "Qto_DoorBaseQuantities", "IfcWindow": "Qto_WindowBaseQuantities", "IfcSlab": "Qto_SlabBaseQuantities", "IfcRoof": "Qto_RoofBaseQuantities", "IfcWall": "Qto_WallBaseQuantities"}',
    'def qto(e):',
    '    for r in e.IsDefinedBy or ():',
    '        d = r.RelatingPropertyDefinition if r.is_a("IfcRelDefinesByProperties") else None',
    '        if d is not None and d.is_a("IfcElementQuantity") and d.Name == QTO.get(e.is_a()):',
    '            return {q.Name: round(float(q[3]), 6) for q in d.Quantities}',
    '    return {}',
    'def at(e, x=0.0, y=0.0):',
    '    M = (getattr(pl, "get_placement", None) or pl.get_local_placement)(e.ObjectPlacement)',
    '    return [round((M[0][0] * x + M[0][1] * y + M[0][3]) * scale, 6), round((M[1][0] * x + M[1][1] * y + M[1][3]) * scale, 6), round(M[2][3] * scale, 6)]',
    'walls, feet, others = {}, [], {}',
    'for w in m.by_type("IfcWall"):',
    '    reps = {r.RepresentationIdentifier: r for r in w.Representation.Representations}',
    '    p = reps["Body"].Items[0].SweptArea',
    '    cx, cy = [float(c) for c in p.Position.Location.Coordinates][:2]',
    '    hx, hy = p.XDim / 2, p.YDim / 2',
    '    feet.append(Polygon([at(w, cx - hx, cy - hy)[:2], at(w, cx + hx, cy - hy)[:2], at(w, cx + hx, cy + hy)[:2], at(w, cx - hx, cy + hy)[:2]]))',
    '    t, u = el.get_type(w), el.get_material(w, should_skip_usage=False)',
    '    walls[w.Name] = {"guid": w.GlobalId, "length": round(p.XDim * scale, 6), "thickness": round(p.YDim * scale, 6), "axis": [at(w, *q.Coordinates[:2])[:2] for q in reps["Axis"].Items[0].Points],',
    '                     "type": t.Name if t else None, "offset": round(float(u.OffsetFromReferenceLine) * scale, 6) if u is not None and u.is_a("IfcMaterialLayerSetUsage") else None, "qto": qto(w)}',
    'for e in m.by_type("IfcElement"):',
    '    if not e.is_a("IfcWall"):',
    '        o = e.FillsVoids[0].RelatingOpeningElement if getattr(e, "FillsVoids", None) else None',
    '        others["%s %s" % (e.is_a(), e.Name)] = {"guid": e.GlobalId, "at": at(e), "qto": qto(e), "in_opening": o is not None and e.ObjectPlacement.PlacementRelTo.id() == o.ObjectPlacement.id()}',
    'close = unary_union([f.buffer(1e-7, join_style="mitre") for f in feet])',
    'whole = close.geom_type == "Polygon"',
    'unused = [x.is_a() for c in ("IfcCartesianPoint", "IfcDirection", "IfcAxis2Placement3D", "IfcAxis2Placement2D", "IfcPolyline", "IfcArbitraryClosedProfileDef", "IfcRectangleProfileDef", "IfcExtrudedAreaSolid", "IfcMaterialLayerSetUsage") for x in m.by_type(c) if m.get_total_inverses(x) == 0]',
    'facts = {"walls": walls, "others": others, "joins": sorted([r.RelatingElement.Name, r.RelatingConnectionType, r.RelatedElement.Name, r.RelatedConnectionType] for r in m.by_type("IfcRelConnectsPathElements")),',
    '         "sum": round(sum(f.area for f in feet), 6), "union": round(unary_union(feet).area, 6), "whole": whole, "holes": sorted(round(Polygon(h).area, 4) for h in close.interiors) if whole else None,',
    '         "storeys": {s.Name: s.GlobalId for s in m.by_type("IfcBuildingStorey")}, "unused": unused}',
    'print(json.dumps(facts))',
  ];

  test('ai edit: edit_element is a write tool without a ref that keeps only the fields given and checks them per kind of element', async (assert) => {
    assert.ok(writeTools.has('edit_element') && !writeTools.CREATES.includes('edit_element'), 'a write tool that creates nothing');
    const tool = writeTools.TOOLS.find((x) => x.name === 'edit_element');
    assert.deepEqual(Object.keys(tool.parameters.properties), Object.keys(BLANK), 'the flat schema, every field nullable');
    assert.deepEqual(writeTools.EDITS, { wall: ['start', 'end', 'thickness', 'height', 'type'], slab: ['outline', 'thickness', 'type'], opening: ['offset', 'width', 'height', 'sill'], roof: ['pitch', 'overhang', 'base'] }, 'the fields per kind, as the wheel takes them');
    assert.ok(tool.description.includes('keeping its GlobalId') && tool.description.includes('instead of deleting and recreating them') && tool.description.includes('null to keep it'), 'the tool says what it is for');
    const cs = writeTools.create('edit-test');
    assert.ok(writeTools.call(cs, 'define_type', YV2).ok);
    assert.ok(writeTools.call(cs, 'create_wall', { storey: null, start: [0, 0], end: [5, 0], thickness: 0.2, height: 3, name: 'A', type: null, partition: null }).ok);
    assert.ok(writeTools.call(cs, 'create_roof', { storey: null, shape: 'gable', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null, type: null }).ok);
    const moved = edit(cs, { id: '2O2Fr$t4X7Zf8NOew3FLOH', start: [7, 0], end: [7, 8], name: ' Mitt ' });
    assert.ok(moved.ok && moved.step === 4 && !moved.ref, 'no ref: the element keeps its own: ' + JSON.stringify(moved));
    assert.deepEqual(cs.ops[3], { tool: 'edit_element', id: '2O2Fr$t4X7Zf8NOew3FLOH', name: 'Mitt', start: [7, 0], end: [7, 8] }, 'only the fields given, by GlobalId');
    assert.ok(edit(cs, { id: 77, type: 'new-1' }).ok);
    assert.deepEqual(cs.ops[4], { tool: 'edit_element', id: 77, thickness: 0.4, type: 'new-1' }, 'a type of the change set gives its layers\' thickness');
    const differs = edit(cs, { id: 'new-2', type: 'new-1', thickness: 0.3 });
    assert.ok(String(differs.error).includes('0.4 m') && String(differs.error).includes('leave thickness null'), JSON.stringify(differs));
    const roofThick = edit(cs, { id: 'new-3', thickness: 0.3 });
    assert.ok(String(roofThick.error).includes('create_roof') && String(roofThick.error).includes('pitch, overhang, base or name'), 'an element of this change set takes its own kind\'s fields: ' + JSON.stringify(roofThick));
    assert.ok(edit(cs, { id: 'new-3', pitch: 45, overhang: 0.5, base: 3 }).ok, 'the roof\'s pitch, overhang and base');
    assert.ok(writeTools.call(cs, 'define_type', { kind: 'slab', name: 'BJ9', layers: [layer('Betong', 0.22, 'concrete', null)], predefined_type: null }).ok);
    assert.ok(String(edit(cs, { id: 'new-2', type: 'new-4' }).error).includes('slab type'), 'a slab type on a wall');
    assert.ok(String(edit(cs, { id: 12, type: 'new-2' }).error).includes('not a type'), 'a wall is no type');
    const refused = (patch, label, part) => { const out = edit(cs, patch); assert.ok(out.error && String(out.error).includes(part), label + ': ' + JSON.stringify(out)); };
    refused({ id: 12, start: [0, 0], pitch: 30 }, 'a wall\'s and a roof\'s fields together', 'do not go together');
    refused({ id: 12 }, 'nothing to change', 'nothing to change');
    refused({ id: null, name: 'x' }, 'no id', 'id is required');
    refused({ id: 12, name: '  ' }, 'an empty name', 'name must not be empty');
    refused({ id: 12, pitch: 80 }, 'too steep', 'at most 75');
    refused({ id: 12, overhang: -1 }, 'a negative overhang', 'zero or more');
    refused({ id: 12, width: 0 }, 'no width', 'greater than zero');
    refused({ id: 12, start: [1, 1], end: [1, 1] }, 'a wall without length', 'same point');
    refused({ id: 12, outline: [[0, 0], [1, 0], [0, 0]] }, 'an outline of two corners', 'three');
    refused({ id: 'new-9', name: 'x' }, 'a ref that does not exist', 'not a ref');
    assert.ok(edit(cs, { id: 12, offset: 3, width: 1.2, height: 1.2, sill: 0.9 }).ok, 'an opening\'s fields');
    assert.ok(edit(cs, { id: 13, outline: [[0, 0], [12, 0], [12, 10], [0, 10], [0, 0]], thickness: 0.3 }).ok, 'a slab\'s fields');
    assert.deepEqual(cs.ops[cs.ops.length - 1].outline, [[0, 0], [12, 0], [12, 10], [0, 10]], 'the repeated first corner left out (GEM111)');
    assert.ok(edit(cs, { id: 'new-1', name: 'YV2b' }).ok, 'a type takes a name');
    assert.ok(String(edit(cs, { id: 'new-1', thickness: 0.5 }).error).includes('only name'), 'and nothing else');
    assert.deepEqual(writeTools.summary(cs), { steps: cs.ops.length, creates: 4, deletes: 0 }, 'an edit creates and deletes nothing');
    const refs = cs.refs;
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }).ok); assert.equal(cs.refs, refs, 'removing an edit gives no ref back');
    const guids = writeTools.withGuids(writeTools.toWheel(cs), (id) => (id === 77 ? '3Ax9uWVqb0cOdn1mH3x6Zn' : null));
    assert.deepEqual(guids.filter((op) => op.tool === 'edit_element').slice(0, 2).map((op) => op.id), ['2O2Fr$t4X7Zf8NOew3FLOH', '3Ax9uWVqb0cOdn1mH3x6Zn'], 'a server gets the element by its GlobalId');
    assert.equal(guids[4].type, 'new-1', 'and a ref stays a ref');
    return 'ok';
  });

  test('ai edit: the step list describes edit_element in all seven languages', async (assert) => {
    const cs = writeTools.create('edit-languages');
    assert.ok(edit(cs, { id: 21, name: 'Mitt', start: [7, 0], end: [7, 8] }).ok && edit(cs, { id: 22, pitch: 45, overhang: 0.5, base: 3 }).ok && edit(cs, { id: 23, offset: 3, width: 1.2, height: 2.1, sill: 0 }).ok && edit(cs, { id: 24, outline: [[0, 0], [1, 0], [1, 1]], thickness: 0.3 }).ok);
    const codes = i18n.LANGUAGES.map((x) => x.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const [wall, roof, door, slab] = cs.ops.map((op) => writeTools.describe(op));
        assert.ok(wall.includes('21') && wall.includes('Mitt') && wall.includes('(7, 0)') && wall.includes('(7, 8)'), code + ': ' + wall);
        assert.ok(roof.includes('45°') && roof.includes('0.5') && roof.includes('3'), code + ': ' + roof);
        assert.ok(door.includes('1.2') && door.includes('2.1') && door.includes(i18n.t('ai.change.edit.offset', { value: '3' })), code + ': ' + door);
        assert.ok(slab.includes(i18n.t('ai.change.edit.outline', { n: '3' })) && slab.includes('0.3'), code + ': ' + slab);
        for (const line of [wall, roof, door, slab]) assert.ok(!/\{\w+\}/.test(line) && !line.includes('ai.change.'), code + ': every placeholder filled: ' + line);
        seen.push(door);
      }
      assert.equal(new Set(seen).size, 7, 'seven different texts: ' + seen.join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai edit: the change text tells the AI to edit elements instead of recreating them, and transform_elements says what it moves', async (assert) => {
    assert.ok(agent.SYSTEM_CHANGE.includes('Change an existing element with edit_element') && agent.SYSTEM_CHANGE.includes('so that its GlobalId stays') && agent.SYSTEM_CHANGE.includes('delete only when the person asks for it'), 'edit, keep the GlobalId, delete only when asked');
    assert.ok(agent.SYSTEM_CHANGE.includes('get_parameters reads its current measures'), 'and read the measures first');
    const move = writeTools.TOOLS.find((x) => x.name === 'transform_elements').description;
    assert.ok(move.includes('A door or window moves with its opening') && move.includes('The site, the building and the storeys are never moved'), move);
    return 'ok';
  });

  test('ai edit: get_parameters is a read tool that reads the measures through the app\'s Python and never starts it', async (assert) => {
    const tool = tools.TOOLS.find((x) => x.name === 'get_parameters');
    assert.ok(tool && Object.keys(tool.parameters.properties).join() === 'ids' && tool.description.includes('Works only when the app\'s Python is already running'), 'a read tool of ids');
    assert.ok(!writeTools.has('get_parameters'), 'not a write tool');
    const state = bridge.state;
    try {
      bridge.state = 'idle';
      const off = await tools.call('no-such-dataset', 'get_parameters', { ids: [12] });
      assert.ok(off.error && off.error.includes('Python'), 'Python is not started: ' + JSON.stringify(off));
      bridge.state = 'ready';
      const none = await tools.call('no-such-dataset', 'get_parameters', { ids: ['not an id', -3] });
      assert.ok(none.error && none.error.includes('give ids'), 'ids that are neither STEP ids nor GlobalIds: ' + JSON.stringify(none));
    } finally { bridge.state = state; }
    return 'ok';
  });

  /** A 12 × 8 m box of YV1 walls in a new IFC4X3 model with an IV1 wall at x = 6, a BJ1 slab, a door in Syd, a window in Öst and a TAK1
   * gable roof, written once and imported as a model of its own for the two tests that change it. */
  let built = null;
  function buildBox() {
    if (!built) {
      built = (async () => {
        await bridge.start();
        await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
        const { dataset } = await ifcNew.create({ name: 'Ändra på plats', schema: 'IFC4X3_ADD2', storey: 'Plan 3' });
        created.push(dataset.id);
        const cs = writeTools.create(dataset.id);
        const steps = [['define_type', YV1], ['define_type', IV1], ['define_type', BJ1], ['define_type', TAK1]];
        for (const [name, start, end] of BOX) steps.push(['create_wall', { storey: 'Plan 3', start, end, thickness: null, height: 3, name, type: 'new-1' }]);
        steps.push(['create_wall', { storey: 'Plan 3', start: [6, 0], end: [6, 8], thickness: null, height: 3, name: 'Mitt', type: 'new-2' }],
          ['create_slab', { storey: 'Plan 3', outline: [[0, 0], [12, 0], [12, 8], [0, 8]], thickness: null, name: 'Bjälklag', type: 'new-3' }],
          ['create_opening', { wall_id: 'new-5', offset: 2, width: 1, height: 2.1, sill: 0, fill: 'door', name: 'Dörr' }],
          ['create_opening', { wall_id: 'new-6', offset: 3, width: 1.2, height: 1.2, sill: 0.9, fill: 'window', name: 'Fönster' }],
          ['create_roof', { storey: 'Plan 3', shape: 'gable', outline: null, pitch: 30, overhang: 0.4, thickness: null, ridge: null, base: null, name: 'Tak', type: 'new-4' }]);
        for (const [name, args] of steps) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
        const first = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
        if (first.report.errors) throw new Error('the box has errors: ' + JSON.stringify(first.report.findings));
        const meta = await importer.run(new File([first.bytes], 'andra-pa-plats.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Ändra på plats 2');
        created.push(meta.id);
        const guid = {};
        for (const e of first.report.created || []) guid[e.ifc_class + ' ' + e.name] = e.guid;
        return { meta, guid, facts: await factsOf(first.bytes, FACTS) };
      })();
    }
    return built;
  }

  test('ai edit: Python reads the measures edit_element changes from the walls\' axes and the bodies, and says why a roof slab and a storey have none', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const { meta, guid, facts } = await buildBox();
    const keys = ['IfcWall Mitt', 'IfcWall Syd', 'IfcDoor Dörr', 'IfcWindow Fönster', 'IfcSlab Bjälklag', 'IfcRoof Tak', 'IfcSlab Tak 1'];
    const out = await tools.call(meta.id, 'get_parameters', { ids: keys.map((k) => guid[k]).concat([facts.storeys['Plan 3'], 'AAAAAAAAAAAAAAAAAAAAAA']) });
    assert.ok(out && Array.isArray(out.elements) && out.elements.length === 9, JSON.stringify(out));
    const [mitt, syd, door, win, slab, roof, part, storey, missing] = out.elements;
    const pick = (o, names) => names.reduce((x, n) => Object.assign(x, { [n]: o[n] }), {});
    assert.deepEqual(pick(mitt, ['kind', 'name', 'start', 'end', 'thickness', 'height', 'type']), { kind: 'wall', name: 'Mitt', start: [6, 0], end: [6, 8], thickness: 0.095, height: 3, type: 'IV1' }, 'the inner wall from its axis, not its cut body');
    assert.deepEqual(pick(syd, ['start', 'end', 'thickness', 'type']), { start: [0, 0], end: [12, 0], thickness: 0.3, type: 'YV1' }, 'the south wall');
    assert.ok(door.kind === 'opening' && door.ifc_class === 'IfcDoor' && Number.isInteger(door.wall) && near(door.offset, 2) && near(door.width, 1) && near(door.height, 2.1) && near(door.sill, 0), 'the door by its opening: ' + JSON.stringify(door));
    assert.ok(win.kind === 'opening' && near(win.offset, 3) && near(win.width, 1.2) && near(win.height, 1.2) && near(win.sill, 0.9), 'the window: ' + JSON.stringify(win));
    assert.deepEqual(pick(slab, ['kind', 'outline', 'thickness', 'type']), { kind: 'slab', outline: [[0, 0], [12, 0], [12, 8], [0, 8]], thickness: 0.25, type: 'BJ1' }, 'the slab');
    assert.deepEqual(pick(roof, ['kind', 'shape', 'pitch', 'overhang', 'base']), { kind: 'roof', shape: 'gable', pitch: 30, overhang: 0.4, base: 3 }, 'the roof from its slabs\' faces');
    assert.ok(part.kind === null && String(part.note).includes('edit the roof'), 'a roof slab points to its roof: ' + JSON.stringify(part));
    assert.ok(storey.kind === null && String(storey.note).includes('only the name'), 'a storey takes only a name: ' + JSON.stringify(storey));
    assert.ok(missing.error && String(missing.error).includes('no element with GlobalId'), 'an unknown GlobalId: ' + JSON.stringify(missing));
    return 'ok';
  }, 900000);

  test('ai edit: Python changes walls, a door, a window, a slab and a roof in place, keeping their GlobalIds, with joins, layers and quantities made anew', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const { meta, guid, facts: was } = await buildBox();
    assert.deepEqual(was.unused, [], 'the box leaves nothing unused');
    const cs = writeTools.create(meta.id);
    const steps = [['define_type', YV2],
      ['edit_element', { id: guid['IfcWall Mitt'], start: [7, 0], end: [7, 8] }],
      ['edit_element', { id: guid['IfcWall Öst'], type: 'new-1' }],
      ['edit_element', { id: guid['IfcDoor Dörr'], offset: 3, width: 1.2 }],
      ['edit_element', { id: guid['IfcWindow Fönster'], sill: 1, height: 1 }],
      ['edit_element', { id: guid['IfcSlab Bjälklag'], outline: [[0, 0], [12, 0], [12, 10], [0, 10]] }],
      ['edit_element', { id: guid['IfcRoof Tak'], pitch: 45, overhang: 0.5, name: 'Huvudtak' }]];
    for (const [name, args] of steps) { const out = name === 'edit_element' ? edit(cs, args) : writeTools.call(cs, name, args); assert.ok(out.ok, name + ': ' + JSON.stringify(out)); }
    const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    assert.deepEqual((res.report.notes || []).filter((n) => !String(n).startsWith('GRF003')), [], 'nothing left out (the note that the model has no CRS yet, GRF003, aside)');
    assert.deepEqual((res.report.created || []).map((e) => [e.ref, e.ifc_class, e.name]), [['new-1', 'IfcWallType', 'YV2']], 'only the new type is created');
    assert.deepEqual(res.report.deleted || [], [], 'nothing is deleted');
    const changed = new Set((res.report.changed || []).map((e) => e.guid));
    for (const key of ['IfcWall Mitt', 'IfcWall Öst', 'IfcWall Syd', 'IfcWall Norr', 'IfcDoor Dörr', 'IfcWindow Fönster', 'IfcSlab Bjälklag', 'IfcRoof Tak', 'IfcSlab Tak 1', 'IfcSlab Tak 2']) assert.ok(changed.has(guid[key]), key + ' is changed, by its GlobalId');
    const f = await factsOf(res.bytes, FACTS);
    assert.deepEqual(f.unused, [], 'no point, direction, placement, curve, profile, solid or usage is left unused (IFC106)');
    for (const [name] of BOX.concat([['Mitt']])) assert.equal(f.walls[name].guid, was.walls[name].guid, name + ' keeps its GlobalId');
    for (const key of ['IfcDoor Dörr', 'IfcWindow Fönster', 'IfcSlab Bjälklag', 'IfcSlab Tak 1', 'IfcSlab Tak 2']) assert.equal(f.others[key].guid, was.others[key].guid, key + ' keeps its GlobalId');
    assert.equal(f.others['IfcRoof Huvudtak'].guid, was.others['IfcRoof Tak'].guid, 'the renamed roof keeps its GlobalId');
    // Mitt moved 1 m east and joined anew; Öst of 0.4 m now goes past the corners, so Syd and Norr stop 0.2 m short of them.
    assert.deepEqual(f.walls.Mitt.axis, [[7, 0], [7, 8]], 'the inner wall\'s axis from start to end');
    assert.ok(near(f.walls.Mitt.length, 7.7) && f.walls.Mitt.type === 'IV1', 'and stopped at the faces: ' + JSON.stringify(f.walls.Mitt));
    assert.ok(f.walls['Öst'].type === 'YV2' && near(f.walls['Öst'].thickness, 0.4) && near(f.walls['Öst'].offset, -0.2) && near(f.walls['Öst'].length, 8.3), 'the new type, its thickness and its layers centred: ' + JSON.stringify(f.walls['Öst']));
    assert.ok(near(f.walls.Syd.length, 11.95) && near(f.walls.Norr.length, 11.95) && near(f.walls['Väst'].length, 7.7), 'the corners cut for the thicker wall: ' + JSON.stringify([f.walls.Syd.length, f.walls.Norr.length]));
    assert.deepEqual(f.joins, [['Mitt', 'ATEND', 'Norr', 'ATPATH'], ['Mitt', 'ATSTART', 'Syd', 'ATPATH'], ['Norr', 'ATEND', 'Väst', 'ATSTART'], ['Syd', 'ATSTART', 'Väst', 'ATEND'], ['Öst', 'ATEND', 'Norr', 'ATSTART'], ['Öst', 'ATSTART', 'Syd', 'ATEND']], 'the joins made anew, the thicker wall relating');
    assert.ok(near(f.sum, f.union, 1e-6) && f.whole, 'no overlap and no gap: ' + JSON.stringify([f.sum, f.union, f.whole]));
    assert.deepEqual(f.holes, [36.5942, 52.3792], 'two rooms inside the walls: (11.8 − 7.0475) and (6.9525 − 0.15) × 7.7 m');
    // The door 1 m on and 0.2 m wider, the window 0.1 m higher and 0.2 m lower, each in its opening, and the walls less them.
    assert.ok(f.others['IfcDoor Dörr'].in_opening && near(f.others['IfcDoor Dörr'].at[0], 3) && near(f.others['IfcOpeningElement Dörr'].at[0], 3), 'the door and its opening at 3 m: ' + JSON.stringify(f.others['IfcDoor Dörr']));
    const q = (key) => f.others[key].qto;
    assert.ok(near(q('IfcDoor Dörr').Width, 1.2) && near(q('IfcDoor Dörr').Height, 2.1) && near(q('IfcDoor Dörr').Area, 2.52), 'the door\'s quantities: ' + JSON.stringify(q('IfcDoor Dörr')));
    assert.ok(near(f.others['IfcWindow Fönster'].at[2], 1) && near(q('IfcWindow Fönster').Height, 1) && near(q('IfcWindow Fönster').Area, 1.2), 'the window: ' + JSON.stringify(f.others['IfcWindow Fönster']));
    assert.ok(near(f.walls.Syd.qto.NetSideArea, 11.95 * 3 - 2.52, 1e-6) && near(f.walls['Öst'].qto.NetSideArea, 8.3 * 3 - 1.2, 1e-6) && near(f.walls.Syd.qto.Length, 11.95), 'the walls\' net sides less the openings: ' + JSON.stringify([f.walls.Syd.qto, f.walls['Öst'].qto]));
    assert.ok(near(q('IfcSlab Bjälklag').GrossArea, 120) && near(q('IfcSlab Bjälklag').Perimeter, 44) && near(q('IfcSlab Bjälklag').Width, 0.25), 'the slab of 12 × 10 m: ' + JSON.stringify(q('IfcSlab Bjälklag')));
    const projected = (12.3 + 1) * (8.3 + 1);
    assert.ok(near(q('IfcRoof Huvudtak').ProjectedArea, projected, 1e-4) && near(q('IfcRoof Huvudtak').GrossArea, projected / Math.cos(Math.PI / 4), 1e-4), 'the roof over the same rectangle at 45° with 0.5 m overhang: ' + JSON.stringify(q('IfcRoof Huvudtak')));
    const topology = res.report.topology && res.report.topology[0];
    assert.ok(topology && topology.closed && topology.rooms.map((r) => r.area).sort((a, b) => a - b).join(',') === '40,56', 'the topology reads the moved axis: ' + JSON.stringify(topology));
    const moves = (res.report.proposal && res.report.proposal.changes || []).filter((c) => c.guid === guid['IfcWall Mitt'] && c.attribute === 'Coordinates');
    assert.ok(moves.length && JSON.stringify(moves[0].new) === '[7,0,0]', 'a server gets the move as a change of the wall\'s placement: ' + JSON.stringify(moves));
    return 'ok';
  }, 900000);

  test('ai edit: Python moves a window with its opening and a wall with its joins, renames a storey, and refuses a storey and what does not fit', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const { meta, guid, facts: was } = await buildBox();
    const storey = was.storeys['Plan 3'];
    assert.ok(storey, 'the storey: ' + JSON.stringify(was.storeys));
    const cs = writeTools.create(meta.id);
    assert.ok(writeTools.call(cs, 'transform_elements', { ids: [guid['IfcWindow Fönster']], dx: 0, dy: 1, dz: 0 }).ok);
    assert.ok(writeTools.call(cs, 'transform_elements', { ids: [guid['IfcWall Mitt']], dx: -1, dy: 0, dz: 0 }).ok);
    assert.ok(edit(cs, { id: storey, name: 'Plan 3a' }).ok);
    const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    const f = await factsOf(res.bytes, FACTS);
    assert.deepEqual(f.unused, [], 'no point left unused after the moves (IFC106)');
    const win = f.others['IfcWindow Fönster']; const hole = f.others['IfcOpeningElement Fönster'];
    assert.ok(win.in_opening && near(win.at[1], 4) && near(hole.at[1], 4) && near(hole.at[0], 12), 'the window moved 1 m along Öst with its opening: ' + JSON.stringify([win, hole]));
    assert.deepEqual(f.walls.Mitt.axis, [[5, 0], [5, 8]], 'the inner wall 1 m west');
    assert.ok(f.walls.Mitt.guid === was.walls.Mitt.guid && near(f.walls.Mitt.length, 7.7), 'with its GlobalId, stopped at the faces: ' + JSON.stringify(f.walls.Mitt));
    assert.deepEqual(f.joins.filter((j) => j[0] === 'Mitt'), [['Mitt', 'ATEND', 'Norr', 'ATPATH'], ['Mitt', 'ATSTART', 'Syd', 'ATPATH']], 'and joined anew');
    assert.ok(near(f.sum, f.union, 1e-6) && f.whole && f.holes.length === 2, 'no gap or overlap: ' + JSON.stringify([f.sum, f.union, f.holes]));
    assert.equal(f.storeys['Plan 3a'], storey, 'the storey renamed, with its GlobalId');
    assert.ok((res.report.changed || []).some((e) => e.guid === storey && e.name === 'Plan 3a'), 'and in the changed list with its new name');
    // What the wheel refuses, with what to do instead.
    const refusal = async (ops, part, label) => {
      const cs2 = writeTools.create(meta.id);
      for (const [name, args] of ops) { const out = name === 'edit_element' ? edit(cs2, args) : writeTools.call(cs2, name, args); assert.ok(out.ok, label + ': the write tool takes it: ' + JSON.stringify(out)); }
      let message = '';
      try { await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs2)); } catch (err) { message = String((err && err.message) || err); }
      assert.ok(message.includes(part), label + ': ' + message);
    };
    await refusal([['transform_elements', { ids: [storey], dx: 1, dy: 0, dz: 0 }]], 'change only by agreement', 'a storey is not moved');
    await refusal([['edit_element', { id: guid['IfcWall Syd'], thickness: 0.25 }]], "comes from its type 'YV1'", 'a typed wall\'s thickness');
    await refusal([['edit_element', { id: guid['IfcDoor Dörr'], offset: 11.5 }]], 'would reach beyond wall', 'a door beyond its wall');
    await refusal([['edit_element', { id: guid['IfcSlab Tak 1'], pitch: 20 }]], 'edit the roof', 'a roof slab');
    return 'ok';
  }, 900000);

  test('ai edit: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
