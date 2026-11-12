// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for type-driven modelling, base quantities and wall joins (recommendations 3, 5 and 6 of the native IFC study): define_type
 * is a create with a ref that checks its kind, name, layers (with the optional material category and layer role) and PredefinedType;
 * create_wall, create_slab and create_roof take a type of their own kind and its layers' thickness; the descriptions name the type in
 * all seven languages; and the build and change texts define the types first and let the app join the walls. With the real Pyodide
 * (`?python=1` or cached components) the wheel lays a typed wall's layers centred on its axis with the first on the outside (AXIS2,
 * POSITIVE, −t/2), a slab's down from its top at the storey (AXIS3, NEGATIVE, 0) and a roof slab's up from its underside (AXIS3,
 * POSITIVE, 0); it writes the base quantities with the openings deducted, in the names of the schema's templates; and it joins the
 * L-corners and T-junctions of a 12 × 8 m box with an inner wall, also in a second change set, so that the walls neither gap nor
 * overlap and no volume counts twice while their axes stay as drawn.
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
  const ifcOps = D.require('data/ifc-ops');
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
  const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;
  const layer = (material, thickness, category, role) => ({ material, thickness, category, role });
  /** An outer wall of 0.3 m from the outside in, a partition, a floor from the top down and a roof from the top down. */
  const YV1 = { kind: 'wall', name: 'YV1', layers: [layer('Puts', 0.02, null, 'outer_finish'), layer('Lättbetong', 0.25, 'block', 'load_bearing'), layer('Puts', 0.03, null, 'inner_finish')], predefined_type: 'SOLIDWALL' };
  const IV1 = { kind: 'wall', name: 'IV1', layers: [layer('Gips', 0.0125, 'gypsum', 'inner_finish'), layer('Regel', 0.07, 'wood', null), layer('Gips', 0.0125, 'gypsum', 'inner_finish')], predefined_type: 'PARTITIONING' };
  const BJ1 = { kind: 'slab', name: 'BJ1', layers: [layer('Parkett', 0.015, 'wood', 'inner_finish'), layer('Betong', 0.2, 'concrete', 'load_bearing'), layer('Cellplast', 0.035, 'plastic', 'insulation')], predefined_type: null };
  const TAK1 = { kind: 'roof', name: 'TAK1', layers: [layer('Takpannor', 0.05, null, 'outer_finish'), layer('Råspont', 0.025, 'wood', null), layer('Takstol', 0.175, 'wood', 'load_bearing')], predefined_type: null };
  /** The outer walls of a 12 × 8 m box, counter-clockwise, so that each wall's right side is the outside. */
  const BOX = [['Syd', [0, 0], [12, 0]], ['Öst', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]], ['Väst', [0, 8], [0, 0]]];
  const wall = (cs, name, start, end, type, patch) => writeTools.call(cs, 'create_wall', Object.assign({ storey: 'Plan 3', start, end, thickness: null, height: 3, name, type }, patch || {}));
  const stdoutOf = (out) => out.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  /** Facts of a written IFC, read back with IfcOpenShell in the app's Python: the code ends by printing one line of JSON. */
  async function factsOf(bytes, code) {
    await bridge.writeFile('/data/step/types-facts.ifc', bytes);
    const out = await bridge.run(['import json', 'import math', 'import ifcopenshell', 'import ifcopenshell.util.element as el', 'import ifcopenshell.util.placement as pl',
      'import ifcopenshell.util.unit', 'm = ifcopenshell.open("/data/step/types-facts.ifc")', 'scale = ifcopenshell.util.unit.calculate_unit_scale(m)'].concat(code).join('\n'));
    const error = out.entries.find((e) => e.kind === 'error');
    if (error) throw new Error(String(error.text));
    return JSON.parse(stdoutOf(out).trim().split('\n').pop() || 'null');
  }
  /** Per element (openings left out) by name: its class, type, PredefinedTypes, layer set usage and quantity sets, and for a typed wall the
   * span of its body across the axis and where its first layer lies in the plan (metres), for a typed slab its thickness at right angles
   * to its profile and the height of the profile's plane. */
  const ELEMENTS = [
    'def body(e):',
    '    return [i for r in e.Representation.Representations if r.RepresentationIdentifier == "Body" for i in r.Items][0]',
    'def usage(e):',
    '    u = el.get_material(e, should_skip_usage=False)',
    '    if u is None or not u.is_a("IfcMaterialLayerSetUsage"):',
    '        return None',
    '    return {"direction": u.LayerSetDirection, "sense": u.DirectionSense, "offset": round(float(u.OffsetFromReferenceLine), 6), "layers": [[x.Material.Name, round(float(x.LayerThickness), 6), getattr(x.Material, "Category", None), getattr(x, "Category", None)] for x in u.ForLayerSet.MaterialLayers]}',
    'def qtos(e):',
    '    out = {}',
    '    for r in e.IsDefinedBy or ():',
    '        d = r.RelatingPropertyDefinition if r.is_a("IfcRelDefinesByProperties") else None',
    '        if d is not None and d.is_a("IfcElementQuantity"):',
    '            out[d.Name] = dict({q.Name: round(float(q[3]), 6) for q in d.Quantities}, method=d.MethodOfMeasurement)',
    '    return out',
    'facts = {}',
    'for e in m.by_type("IfcElement"):',
    '    if e.is_a("IfcFeatureElement"):',
    '        continue',
    '    t = el.get_type(e)',
    '    rec = {"class": e.is_a(), "type": t.Name if t else None, "type_class": t.is_a() if t else None, "type_pt": getattr(t, "PredefinedType", None) if t else None, "pt": getattr(e, "PredefinedType", None), "usage": usage(e), "qto": qtos(e)}',
    '    if e.is_a("IfcWall") and rec["usage"]:',
    '        p = body(e).SweptArea',
    '        cx, cy = [float(c) for c in p.Position.Location.Coordinates][:2]',
    '        rec["body_y"] = [round(cy - p.YDim / 2, 6), round(cy + p.YDim / 2, 6)]',
    '        M = pl.get_local_placement(e.ObjectPlacement)',
    '        y = rec["usage"]["offset"] + rec["usage"]["layers"][0][1] / 2',
    '        rec["first_at"] = [round((M[0][0] * cx + M[0][1] * y + M[0][3]) * scale, 6), round((M[1][0] * cx + M[1][1] * y + M[1][3]) * scale, 6)]',
    '    if e.is_a("IfcSlab") and rec["usage"]:',
    '        b = body(e)',
    '        d = [float(c) for c in b.ExtrudedDirection.DirectionRatios]',
    '        rec["thick"] = round(float(b.Depth) * d[2] / math.sqrt(sum(c * c for c in d)), 6)',
    '        rec["plane_z"] = round(float(b.Position.Location.Coordinates[2]) if b.Position is not None else 0.0, 6)',
    '    facts[e.Name] = rec',
    'print(json.dumps(facts))',
  ];
  /** The walls by name (body length, axis in the plan in metres, type, Qto_WallBaseQuantities), the joins, and their footprints: summed,
   * united, and united within 0.1 µm (the outline's area and the holes', which are the rooms inside the walls). */
  const JOINS = [
    'from shapely.geometry import Polygon',
    'from shapely.ops import unary_union',
    'walls, feet = {}, []',
    'for w in m.by_type("IfcWall"):',
    '    M = pl.get_local_placement(w.ObjectPlacement)',
    '    def at(x, y):',
    '        return [round((M[0][0] * x + M[0][1] * y + M[0][3]) * scale, 6), round((M[1][0] * x + M[1][1] * y + M[1][3]) * scale, 6)]',
    '    reps = {r.RepresentationIdentifier: r for r in w.Representation.Representations}',
    '    p = reps["Body"].Items[0].SweptArea',
    '    cx, cy = [float(c) for c in p.Position.Location.Coordinates][:2]',
    '    hx, hy = p.XDim / 2, p.YDim / 2',
    '    feet.append(Polygon([at(cx - hx, cy - hy), at(cx + hx, cy - hy), at(cx + hx, cy + hy), at(cx - hx, cy + hy)]))',
    '    q = {}',
    '    for r in w.IsDefinedBy or ():',
    '        d = r.RelatingPropertyDefinition if r.is_a("IfcRelDefinesByProperties") else None',
    '        if d is not None and d.is_a("IfcElementQuantity") and d.Name == "Qto_WallBaseQuantities":',
    '            q = {x.Name: round(float(x[3]), 6) for x in d.Quantities}',
    '    t = el.get_type(w)',
    '    walls[w.Name] = {"length": round(p.XDim * scale, 6), "axis": [at(*pt.Coordinates[:2]) for pt in reps["Axis"].Items[0].Points], "qto": q, "type": t.Name if t else None, "type_pt": t.PredefinedType if t else None}',
    'union = unary_union(feet)',
    'close = unary_union([f.buffer(1e-7, join_style="mitre") for f in feet])',
    'whole = close.geom_type == "Polygon"',
    'facts = {"walls": walls, "joins": sorted([r.RelatingElement.Name, r.RelatingConnectionType, r.RelatedElement.Name, r.RelatedConnectionType] for r in m.by_type("IfcRelConnectsPathElements")),',
    '         "sum": round(sum(f.area for f in feet), 6), "union": round(union.area, 6), "whole": whole,',
    '         "outer": round(Polygon(close.exterior).area, 6) if whole else None, "holes": sorted(round(Polygon(h).area, 6) for h in close.interiors) if whole else None}',
    'print(json.dumps(facts))',
  ];

  test('ai types: define_type is a create with a ref, and checks its kind, name, layers with their category and role, and PredefinedType', async (assert) => {
    assert.ok(writeTools.has('define_type') && writeTools.CREATES.includes('define_type'), 'a write tool that creates');
    const tool = writeTools.TOOLS.find((x) => x.name === 'define_type');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['kind', 'name', 'layers', 'predefined_type']);
    assert.deepEqual(tool.parameters.properties.layers.items.required, ['material', 'thickness', 'category', 'role'], 'every field of a layer is required, null when not known');
    assert.deepEqual(writeTools.MATERIAL_CATEGORIES, ['concrete', 'steel', 'aluminium', 'block', 'brick', 'stone', 'wood', 'glass', 'gypsum', 'plastic', 'earth'], 'the categories IfcOpenShell recommends');
    assert.deepEqual(writeTools.LAYER_ROLES, ['load_bearing', 'insulation', 'inner_finish', 'outer_finish'], 'the roles of IfcMaterialLayer.Category');
    assert.ok(writeTools.MATERIAL_CATEGORIES.concat(writeTools.LAYER_ROLES).every((w) => tool.description.includes(w)), 'the tool names them');
    assert.ok(tool.description.includes('only when known') && tool.description.includes('right side to its left') && tool.description.includes('from the top down'), 'never guessed, and the order of the layers');
    const cs = writeTools.create('types-test');
    const spelled = Object.assign({}, YV1, { kind: 'Wall', predefined_type: 'solidwall', layers: [Object.assign({}, YV1.layers[0], { role: 'outer finish' }), Object.assign({}, YV1.layers[1], { category: 'Block' }), Object.assign({}, YV1.layers[2], { role: 'Inner-finish' })] });
    const made = writeTools.call(cs, 'define_type', spelled);
    assert.ok(made.ok && made.ref === 'new-1' && made.step === 1, JSON.stringify(made));
    assert.deepEqual(cs.ops[0], Object.assign({ tool: 'define_type' }, YV1, { ref: 'new-1' }), 'kind, category and role in lower case with underscores, the PredefinedType in capitals');
    assert.equal(writeTools.call(cs, 'define_type', BJ1).ref, 'new-2');
    assert.equal(writeTools.call(cs, 'define_type', TAK1).ref, 'new-3');
    assert.equal(cs.ops[1].predefined_type, null, 'null: the wheel takes the default (FLOOR for a slab)');
    const refused = (args, label) => { const out = writeTools.call(cs, 'define_type', args); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return String(out.error || ''); };
    const one = (patch) => Object.assign({ kind: 'wall', name: 'X', layers: [layer('Betong', 0.2, null, null)], predefined_type: null }, patch);
    const with1 = (patch) => one({ layers: [Object.assign(layer('Betong', 0.2, null, null), patch)] });
    assert.ok(refused(one({ kind: 'door' }), 'a door type').includes('wall, slab or roof'));
    assert.ok(refused(one({ name: ' ' }), 'no name').includes('name'));
    assert.ok(refused(one({ layers: [] }), 'no layers').includes('layers'));
    assert.ok(refused(with1({ material: '' }), 'a layer without its material').includes('material'));
    assert.ok(refused(with1({ thickness: 0 }), 'a layer without thickness').includes('thickness'));
    assert.ok(refused(with1({ thickness: '0.2' }), 'a thickness as text').includes('thickness'));
    assert.ok(refused(with1({ category: 'betong' }), 'a category outside the list').includes('concrete, steel'));
    assert.ok(refused(with1({ role: 'finish' }), 'a finish without its side').includes('inner_finish, outer_finish'));
    assert.ok(refused(one({ layers: [layer('a', 3, null, null), layer('b', 3, null, null)] }), 'six metres').includes('5 m'));
    assert.ok(refused(one({ predefined_type: 'solid wall' }), 'not a PredefinedType').includes('predefined_type'));
    assert.ok(refused(one({ predefined_type: 'USERDEFINED' }), 'USERDEFINED').includes('USERDEFINED'));
    assert.ok(refused(one({ kind: 'roof', predefined_type: 'FLOOR' }), 'a roof type of floor').includes('ROOF'));
    assert.ok(refused(one({ name: 'yv1' }), 'a wall type of the same name').includes('new-1'));
    assert.ok(refused(one({ kind: 'roof', name: 'bj1' }), 'slab and roof types are both IfcSlabType').includes('new-2'));
    assert.equal(cs.ops.length, 3, 'nothing refused landed'); assert.equal(cs.refs, 3);
    assert.ok(writeTools.call(cs, 'define_type', one({ kind: 'slab', name: 'YV1' })).ok, 'a slab type may have a wall type\'s name');
    assert.deepEqual(writeTools.summary(cs), { steps: 4, creates: 4, deletes: 0 }, 'a type is a create');
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }).ok); assert.equal(cs.refs, 3, 'remove_last gives its ref back');
    return 'ok';
  });

  test('ai types: create_wall, create_slab and create_roof take a type of their own kind and its layers\' thickness, and the wheel and a server get the type', async (assert) => {
    for (const name of ['create_wall', 'create_slab', 'create_roof']) {
      const tool = writeTools.TOOLS.find((x) => x.name === name);
      assert.ok('type' in tool.parameters.properties && tool.description.includes('define_type') && tool.description.includes('leave thickness null'), name + ' takes a type');
    }
    assert.ok(/joined by the app/.test(writeTools.TOOLS.find((x) => x.name === 'create_wall').description), 'the wall tool says that the app joins the walls');
    const cs = writeTools.create('types-test-2');
    for (const def of [YV1, BJ1, TAK1]) assert.ok(writeTools.call(cs, 'define_type', def).ok, def.name);
    const syd = wall(cs, 'Syd', [0, 0], [12, 0], 'new-1');
    assert.ok(syd.ok && syd.ref === 'new-4', JSON.stringify(syd));
    assert.deepEqual(cs.ops[3], { tool: 'create_wall', storey: 'Plan 3', start: [0, 0], end: [12, 0], thickness: 0.3, height: 3, name: 'Syd', type: 'new-1', ref: 'new-4' }, 'the thickness of the layers, 0.02 + 0.25 + 0.03');
    assert.ok(wall(cs, 'Öst', [12, 0], [12, 8], 'new-1', { thickness: 0.3 }).ok, 'a thickness equal to the layers\'');
    const differs = wall(cs, 'Norr', [12, 8], [0, 8], 'new-1', { thickness: 0.25 });
    assert.ok(differs.error && differs.error.includes('0.3 m') && differs.error.includes('leave thickness null'), JSON.stringify(differs));
    assert.ok(String(wall(cs, 'X', [0, 0], [1, 0], 'new-2').error).includes('slab type'), 'a slab type on a wall');
    assert.ok(String(wall(cs, 'X', [0, 0], [1, 0], 'new-4').error).includes('not a type'), 'a wall is no type');
    assert.ok(String(wall(cs, 'X', [0, 0], [1, 0], 'new-99').error).includes('not a ref'), 'a ref that does not exist');
    const theirs = wall(cs, 'Väst', [0, 8], [0, 0], 77);
    assert.ok(theirs.ok, JSON.stringify(theirs));
    assert.equal(cs.ops[5].thickness, null, 'a type of the model: the wheel reads its layers'); assert.equal(cs.ops[5].type, 77);
    assert.ok(wall(cs, 'Y', [0, 0], [1, 0], null).ok && !('type' in cs.ops[6]) && cs.ops[6].thickness === 0.2, 'without a type the step is as before');
    const slab = writeTools.call(cs, 'create_slab', { storey: 'Plan 3', outline: null, thickness: null, name: 'Bjälklag', type: 'new-2' });
    assert.ok(slab.ok, JSON.stringify(slab));
    assert.deepEqual(cs.ops[7], { tool: 'create_slab', storey: 'Plan 3', outline: null, thickness: 0.25, name: 'Bjälklag', type: 'new-2', ref: slab.ref });
    assert.ok(String(writeTools.call(cs, 'create_slab', { storey: 'Plan 3', outline: null, thickness: null, name: null, type: 'new-3' }).error).includes('roof type'), 'a roof type on a slab');
    const roof = writeTools.call(cs, 'create_roof', { storey: null, shape: 'gable', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: 'Tak', type: 'new-3' });
    assert.ok(roof.ok && cs.ops[8].thickness === 0.25 && cs.ops[8].type === 'new-3', JSON.stringify(cs.ops[8]));
    assert.ok(String(writeTools.call(cs, 'create_roof', { storey: null, shape: 'flat', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null, type: 'new-1' }).error).includes('wall type'), 'a wall type on a roof');
    const wheel = writeTools.toWheel(cs);
    assert.ok(wheel.every((op) => !('ref' in op)) && wheel[3].type === 'new-1' && wheel[0].layers.length === 3, 'the wheel gets the types and their layers, and counts the refs itself');
    const guids = writeTools.withGuids(wheel, (id) => (id === 77 ? '2O2Fr$t4X7Zf8NOew3FLOH' : null));
    assert.equal(guids[5].type, '2O2Fr$t4X7Zf8NOew3FLOH', 'a type of the model goes to a server by its GlobalId');
    assert.equal(guids[3].type, 'new-1', 'and a ref stays a ref');
    return 'ok';
  });

  test('ai types: the descriptions name the type, its layers and the typed elements in all seven languages', async (assert) => {
    const cs = writeTools.create('types-languages');
    assert.ok(writeTools.call(cs, 'define_type', YV1).ok && wall(cs, 'Syd', [0, 0], [12, 0], 'new-1').ok && wall(cs, 'Mitt', [6, 0], [6, 8], 77).ok);
    const codes = i18n.LANGUAGES.map((x) => x.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const [type, typed, theirs] = cs.ops.map((op) => writeTools.describe(op));
        assert.ok(type.startsWith('new-1 ' + i18n.tIn(code, 'ai.change.type.wall') + ' YV1 SOLIDWALL: ') && type.includes('Lättbetong 0.25 m') && type.endsWith('(0.3 m)'), code + ': ' + type);
        assert.ok(typed.includes('Syd') && typed.includes('0.3') && typed.endsWith(i18n.t('ai.change.typed', { type: 'new-1' })), code + ': ' + typed);
        assert.ok(theirs.includes('–') && theirs.endsWith(i18n.t('ai.change.typed', { type: '77' })), code + ': the thickness comes from the model\'s type: ' + theirs);
        for (const line of [type, typed, theirs]) assert.ok(!/\{\w+\}/.test(line), code + ': every placeholder filled: ' + line);
        seen.push(typed);
      }
      assert.equal(new Set(seen).size, 7, 'seven different texts: ' + seen.join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai types: the build and change texts define the types first, put materials on them and let the app join the walls', async (assert) => {
    assert.ok(agent.SYSTEM_BUILD.includes('Define the wall, slab and roof types first with define_type') && agent.SYSTEM_BUILD.includes('give every wall, slab and roof its type'), 'types first, and every element its type');
    for (const [label, text] of [['build', agent.SYSTEM_BUILD], ['change', agent.SYSTEM_CHANGE]]) {
      assert.ok(text.includes('define_type') && text.includes('materials and shared properties go on the types'), label + ': materials and properties on the types');
      assert.ok(text.includes('Walls meet on their axes at corners and junctions and the app joins them, so never lengthen or overlap walls to close a corner.'), label + ': the app joins the walls');
    }
    assert.ok(/create_spaces after the walls and before the slabs\.$/.test(agent.SYSTEM_BUILD), 'the rooms still close the build text');
    return 'ok';
  });

  /** The fixture model (IFC4 in millimetres) with Plan 3 at 6 m: a 12 × 8 m box of YV1 walls with a door in the south wall and a window in
   * the east wall, a BJ1 slab and a TAK1 gable roof, previewed once for the two tests that read it. */
  let typedRun = null;
  function typedBuild() {
    if (!typedRun) {
      typedRun = (async () => {
        const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Typprov');
        created.push(meta.id);
        await bridge.start();
        await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
        const cs = writeTools.create(meta.id);
        const steps = [['define_type', YV1], ['define_type', BJ1], ['define_type', TAK1], ['create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null }]];
        for (const [name, start, end] of BOX) steps.push(['create_wall', { storey: 'Plan 3', start, end, thickness: null, height: 3, name, type: 'new-1' }]);
        steps.push(['create_slab', { storey: 'Plan 3', outline: [[0, 0], [12, 0], [12, 8], [0, 8]], thickness: null, name: 'Bjälklag', type: 'new-2' }],
          ['create_opening', { wall_id: 'new-4', offset: 2, width: 1, height: 2.1, sill: 0, fill: 'door', name: 'Dörr' }],
          ['create_opening', { wall_id: 'new-5', offset: 3, width: 1.2, height: 1.2, sill: 0.9, fill: 'window', name: 'Fönster' }],
          ['create_roof', { storey: 'Plan 3', shape: 'gable', outline: null, pitch: 30, overhang: 0.4, thickness: null, ridge: null, base: null, name: 'Tak', type: 'new-3' }]);
        for (const [name, args] of steps) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
        const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
        return { res, facts: await factsOf(res.bytes, ELEMENTS) };
      })();
    }
    return typedRun;
  }

  test('ai types: Python lays the layers of a typed wall centred with the first outside, a slab\'s down from its top and a roof slab\'s up from its underside', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const { res, facts } = await typedBuild();
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    assert.deepEqual((res.report.notes || []).filter((n) => !String(n).startsWith('GRF003')), [], 'nothing left out in IFC4 (the note that the model has no CRS yet, GRF003, aside)');
    const types = (res.report.created || []).filter((e) => /Type$/.test(e.ifc_class));
    assert.deepEqual(types.map((e) => [e.ref, e.ifc_class, e.name]), [['new-1', 'IfcWallType', 'YV1'], ['new-2', 'IfcSlabType', 'BJ1'], ['new-3', 'IfcSlabType', 'TAK1']], 'the types with the refs the panel gave');
    // Millimetres: the 300 mm wall's layers run from −150 mm across its axis, and IFC4 calls both finishes Finish.
    const wallLayers = [['Puts', 20, null, 'Finish'], ['Lättbetong', 250, 'block', 'LoadBearing'], ['Puts', 30, null, 'Finish']];
    for (const [name] of BOX) {
      const w = facts[name];
      assert.ok(w && w.type === 'YV1' && w.type_class === 'IfcWallType' && w.type_pt === 'SOLIDWALL' && w.pt === null, name + ': typed, the PredefinedType on the type alone (OJT001): ' + JSON.stringify(w));
      assert.deepEqual(w.usage, { direction: 'AXIS2', sense: 'POSITIVE', offset: -150, layers: wallLayers }, name + ': the usage');
      assert.deepEqual(w.body_y, [-150, 150], name + ': the body across the axis');
      assert.ok(near(w.usage.offset, w.body_y[0]) && near(w.usage.offset + 300, w.body_y[1]), name + ': the layers fill the body');
      const [x, y] = w.first_at;
      assert.ok(x < 0 || x > 12 || y < 0 || y > 8, name + ': the first layer, the outer finish, lies outside the box: ' + JSON.stringify(w.first_at));
    }
    const slab = facts['Bjälklag'];
    assert.ok(slab && slab.type === 'BJ1' && slab.type_pt === 'FLOOR' && slab.pt === null, 'the slab: ' + JSON.stringify(slab));
    assert.deepEqual(slab.usage, { direction: 'AXIS3', sense: 'NEGATIVE', offset: 0, layers: [['Parkett', 15, 'wood', 'Finish'], ['Betong', 200, 'concrete', 'LoadBearing'], ['Cellplast', 35, 'plastic', 'Insulation']] }, 'the slab\'s usage');
    assert.ok(near(slab.plane_z, -250) && near(slab.thick, 250), 'the body from −250 mm up to the storey, which the layers fill downward from 0: ' + JSON.stringify(slab));
    for (const name of ['Tak 1', 'Tak 2']) {
      const part = facts[name];
      assert.ok(part && part.type === 'TAK1' && part.type_class === 'IfcSlabType' && part.type_pt === 'ROOF' && part.pt === null, name + ': ' + JSON.stringify(part));
      assert.deepEqual(part.usage, { direction: 'AXIS3', sense: 'POSITIVE', offset: 0, layers: [['Takstol', 175, 'wood', 'LoadBearing'], ['Råspont', 25, 'wood', null], ['Takpannor', 50, null, 'Finish']] }, name + ': the layers from the underside up, the tiles last');
      assert.ok(near(part.thick, 250), name + ': 250 mm at right angles to the face, the layers\' sum');
    }
    assert.ok(facts.Tak && facts.Tak.type === null && facts.Tak.class === 'IfcRoof', 'the IfcRoof only aggregates its typed slabs');
    return 'ok';
  }, 900000);

  test('ai types: Python writes the base quantities of the walls, slab, roof, door and window with the openings deducted', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const { facts } = await typedBuild();
    const q = (name, set) => (facts[name] && facts[name].qto[set]) || {};
    const close = (got, want, label) => { for (const [k, v] of Object.entries(want)) assert.ok(typeof v === 'string' ? got[k] === v : near(got[k], v, 1e-4), label + ' ' + k + ': ' + JSON.stringify(got)); };
    // The walls as joined: Syd and Norr reach 0.15 m past the corners (12.3 m), Öst and Väst stop 0.15 m short (7.7 m).
    close(q('Syd', 'Qto_WallBaseQuantities'), { Length: 12300, Width: 300, Height: 3000, GrossFootprintArea: 3.69, NetFootprintArea: 3.69, GrossSideArea: 36.9, NetSideArea: 34.8, GrossVolume: 11.07, NetVolume: 10.44, method: 'BaseQuantities' }, 'Syd, less the 1 × 2.1 m door');
    close(q('Öst', 'Qto_WallBaseQuantities'), { Length: 7700, GrossSideArea: 23.1, NetSideArea: 21.66, GrossVolume: 6.93, NetVolume: 6.498 }, 'Öst, less the 1.2 × 1.2 m window');
    close(q('Norr', 'Qto_WallBaseQuantities'), { Length: 12300, NetSideArea: 36.9, NetVolume: 11.07 }, 'Norr');
    close(q('Väst', 'Qto_WallBaseQuantities'), { Length: 7700, NetSideArea: 23.1, NetVolume: 6.93 }, 'Väst');
    const gross = BOX.reduce((n, [name]) => n + q(name, 'Qto_WallBaseQuantities').GrossVolume, 0);
    assert.ok(near(gross, (12.3 * 8.3 - 11.7 * 7.7) * 3, 1e-6), 'the walls hold the ring once: 12.0 m² × 3 m, not more: ' + gross);
    assert.ok(!('GrossFootPrintArea' in q('Syd', 'Qto_WallBaseQuantities')), 'IFC4 spells GrossFootprintArea');
    close(q('Dörr', 'Qto_DoorBaseQuantities'), { Width: 1000, Height: 2100, Perimeter: 6200, Area: 2.1, method: 'BaseQuantities' }, 'the door');
    close(q('Fönster', 'Qto_WindowBaseQuantities'), { Width: 1200, Height: 1200, Perimeter: 4800, Area: 1.44 }, 'the window');
    close(q('Bjälklag', 'Qto_SlabBaseQuantities'), { Width: 250, Length: 12000, Depth: 8000, Perimeter: 40000, GrossArea: 96, NetArea: 96, GrossVolume: 24, NetVolume: 24, method: 'BaseQuantities' }, 'the slab');
    for (const name of ['Tak 1', 'Tak 2']) close(q(name, 'Qto_SlabBaseQuantities'), { Width: 250, Length: 13100 }, name + ', along its eaves');
    const projected = (12.3 + 0.8) * (8.3 + 0.8);
    close(q('Tak', 'Qto_RoofBaseQuantities'), { ProjectedArea: projected, GrossArea: projected / Math.cos(Math.PI / 6), NetArea: projected / Math.cos(Math.PI / 6), method: 'BaseQuantities' }, 'the roof: its plan with the overhang, and that over cos 30°');
    // The fixture's own walls (their names have raw UTF-8, which IfcOpenShell does not read, so they are found as the walls outside the box).
    const untouched = Object.entries(facts).filter(([name, f]) => f.class === 'IfcWall' && !BOX.some(([own]) => own === name));
    assert.ok(untouched.length > 0, 'the fixture\'s walls: ' + Object.keys(facts).join(', '));
    for (const [name] of untouched) close(q(name, 'Qto_WallBaseQuantities'), { Length: 4000, NetSideArea: 10, NetVolume: 2 }, name + ', which the change set did not touch, keeps its own quantities');
    return 'ok';
  }, 900000);

  test('ai types: Python joins the L-corners and T-junctions of a box with an inner wall, also in a second change set, without gaps or overlaps and with the axes as drawn', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset } = await ifcNew.create({ name: 'Skarvprov', schema: 'IFC4X3_ADD2', storey: 'Plan 3' });
    created.push(dataset.id);
    const cs = writeTools.create(dataset.id);
    assert.ok(writeTools.call(cs, 'define_type', YV1).ok && writeTools.call(cs, 'define_type', IV1).ok);
    for (const [name, start, end] of BOX) assert.ok(wall(cs, name, start, end, 'new-1').ok, name);
    const first = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
    assert.equal(first.report.errors, 0, 'no errors: ' + JSON.stringify(first.report.findings));
    assert.deepEqual((first.report.notes || []).filter((n) => !String(n).startsWith('GRF003')), [], 'every corner resolved (the note that the model has no CRS yet, GRF003, aside)');
    const box = await factsOf(first.bytes, JOINS);
    assert.deepEqual(box.joins, [['Norr', 'ATEND', 'Väst', 'ATSTART'], ['Norr', 'ATSTART', 'Öst', 'ATEND'], ['Syd', 'ATEND', 'Öst', 'ATSTART'], ['Syd', 'ATSTART', 'Väst', 'ATEND']], 'four L-corners, the longer walls relating');
    assert.deepEqual(['Syd', 'Öst', 'Norr', 'Väst'].map((n) => box.walls[n].length), [12.3, 7.7, 12.3, 7.7], 'the long walls reach past the corners and the short ones stop at them');
    assert.deepEqual(BOX.map(([name, start, end]) => [name, box.walls[name].axis]), BOX.map(([name, start, end]) => [name, [start, end]]), 'the axes as drawn');
    assert.ok(near(box.sum, 12, 1e-6) && near(box.union, box.sum, 1e-6), 'no overlap: the footprints add up to their union, 12.3 × 8.3 − 11.7 × 7.7 m²: ' + JSON.stringify([box.sum, box.union]));
    assert.ok(box.whole && near(box.outer, 12.3 * 8.3, 1e-4) && box.holes.length === 1 && near(box.holes[0], 11.7 * 7.7, 1e-4), 'no gap: one ring around one room: ' + JSON.stringify([box.outer, box.holes]));
    assert.ok('GrossFootPrintArea' in box.walls.Syd.qto && 'NetFootPrintArea' in box.walls.Syd.qto && !('GrossFootprintArea' in box.walls.Syd.qto), 'IFC4X3 spells the footprint as its template does: ' + JSON.stringify(box.walls.Syd.qto));
    // The written box as a model of its own: a second change set adds an inner wall of the partition type, by its GlobalId.
    const partition = (first.report.created || []).find((e) => e.ifc_class === 'IfcWallType' && e.name === 'IV1');
    assert.ok(partition && /^[0-9A-Za-z_$]{22}$/.test(partition.guid), 'the partition type among the created: ' + JSON.stringify(partition));
    const again = await importer.run(new File([first.bytes], 'skarvprov-2.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Skarvprov 2');
    created.push(again.id);
    const cs2 = writeTools.create(again.id);
    assert.ok(wall(cs2, 'Mitt', [6, 0], [6, 8], partition.guid).ok, 'the type by its GlobalId');
    const second = await ifcOps.previewChangeset(again.id, writeTools.toWheel(cs2));
    assert.equal(second.report.errors, 0, 'no errors the second time: ' + JSON.stringify(second.report.findings));
    assert.deepEqual((second.report.changed || []).filter((e) => e.ifc_class === 'IfcWall'), [], 'the through walls are not changed');
    const both = await factsOf(second.bytes, JOINS);
    assert.deepEqual(both.joins.filter((j) => j[0] === 'Mitt'), [['Mitt', 'ATEND', 'Norr', 'ATPATH'], ['Mitt', 'ATSTART', 'Syd', 'ATPATH']], 'two T-junctions, the inner wall relating at its ends');
    assert.equal(both.joins.length, 6, 'and the corners kept');
    assert.ok(near(both.walls.Mitt.length, 7.7) && both.walls.Mitt.type === 'IV1' && both.walls.Mitt.type_pt === 'PARTITIONING', 'the inner wall stops at the faces, 0.15 m from the axes: ' + JSON.stringify(both.walls.Mitt));
    assert.deepEqual(both.walls.Mitt.axis, [[6, 0], [6, 8]], 'and its axis meets theirs');
    assert.ok(near(both.walls.Syd.length, 12.3), 'the through wall is as it was');
    const inner = 7.7 * 0.095;
    assert.ok(near(both.sum, 12 + inner, 1e-6) && near(both.union, both.sum, 1e-6), 'no overlap at the T-junctions: ' + JSON.stringify([both.sum, both.union]));
    assert.ok(both.whole && near(both.outer, 12.3 * 8.3, 1e-4) && both.holes.length === 2 && both.holes.every((h) => near(h, (6 - 0.15 - 0.0475) * 7.7, 1e-4)), 'two rooms of 5.8025 × 7.7 m inside the walls: ' + JSON.stringify(both.holes));
    const volume = Object.values(both.walls).reduce((n, w) => n + w.qto.NetVolume, 0);
    assert.ok(near(volume, (12 + inner) * 3, 1e-6), 'no volume counted twice: ' + volume);
    const topology = second.report.topology && second.report.topology[0];
    assert.ok(topology && topology.closed && topology.rooms.map((r) => r.area).join(',') === '48,48', 'the topology reads the axes as before: ' + JSON.stringify(topology));
    return 'ok';
  }, 900000);

  test('ai types: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
