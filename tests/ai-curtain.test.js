// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for glass façades (recommendation 4 of the native IFC study): create_element's IfcCurtainWall goes along its axis as a wall
 * does, on an even grid of bays and rows given as counts or spacings, and define_type's curtain_wall type gives its parts' materials
 * and sizes; the op carries curtain and part_names only for a curtain wall, and the step list says it in all seven languages. With
 * the real Pyodide (`?python=1` or cached components) the wheel makes, in an IFC4.3 model, a typed façade that closes a storey and an
 * untyped glass partition across it: the curtain walls contained in the storey with an Axis and no body, their mullions and transoms
 * (IfcMember MULLION) and panels (IfcPlate CURTAIN_PANEL) aggregated in them and placed relative to them on the grid, the parts'
 * types and their layer and profile set usages, the typed members' 'Axis' (IFC4.3, PLAN.md item 6), IsExternal from the topology,
 * the quantities of the curtain walls and of their parts (Qto_MemberBaseQuantities, Qto_PlateBaseQuantities) and no rule failures,
 * and the model passes the app's own IDS Avfallshantering (PLAN.md item 7); a second change set takes the type by its GlobalId and its
 * sizes from the types' material sets; IFC4 and IFC2X3 make the same with the schemas' differences (IFC4 passes the IDS too, IFC2X3
 * gets the quantity sets with IFC4's names and, without profile sets, no Axis), and deleting a curtain wall takes its parts with it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const writeTools = D.require('ai/write-tools');
  const agent = D.require('ai/agent');
  const modelTools = D.require('ai/model-tools');
  const i18n = D.require('ui/i18n');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const ifcNew = D.require('data/ifc-new');
  const presets = D.require('analysis/ids-presets');
  const WASTE = 'presets/ids/SE-Dataspatium_Avfallshantering.ids';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
  const near = (a, b, eps = 1e-4) => typeof a === 'number' && Math.abs(a - b) <= eps;
  const nearAll = (a, b, eps = 1e-4) => Array.isArray(a) && a.length === b.length && a.every((v, i) => near(v, b[i], eps));
  const curtain = (patch) => Object.assign({ start: [12, 8], end: [0, 8], height: 3, base: null, bays: null, bay_width: 1.5, rows: 2, row_height: null }, patch);
  /** A create_element call for a curtain wall with every field, null where not given. */
  const facade = (patch) => Object.assign({ storey: 'Plan 1', ifc_class: 'IfcCurtainWall', predefined_type: null, object_type: null, type: null, name: 'Fasad', at: null, z: null, rotation: null, shape: null, stair: null, curtain: curtain(), part_of: null, host: null }, patch);
  const cwType = (patch) => Object.assign({ kind: 'curtain_wall', name: 'GF1', layers: null, predefined_type: null, material: 'Stål', material_category: 'steel', operation: null, partitioning: null, width: null, height: null, lining_depth: null,
    panel_material: 'Glas', member_width: 0.06, member_depth: 0.2, panel_thickness: 0.04 }, patch);
  const wall = (start, end, name) => ['create_wall', { storey: 'Plan 1', start, end, thickness: 0.3, height: 3, name, type: null, partition: null, load_bearing: null, status: null }];
  /** Plan 1 of the Python tests: three walls and the typed façade close a 12 × 8 m box, and an untyped glass partition halves it. */
  const STEPS = [
    wall([0, 0], [12, 0], 'Syd'), wall([12, 0], [12, 8], 'Öst'), wall([0, 8], [0, 0], 'Väst'),
    ['define_type', cwType()],
    ['create_element', facade({ type: 'new-4' })],
    ['create_element', facade({ name: 'Glasvägg', curtain: curtain({ start: [6, 0], end: [6, 8], height: 2.5, base: 0.2, bays: 2, bay_width: null, rows: null }) })],
  ];
  /** The walls' material with its category, which the app's IDS Avfallshantering asks of every wall (AH-01). */
  const WALLS = ['assign', { ids: ['new-1', 'new-2', 'new-3'], storey: null, material: 'Betong', category: 'concrete' }];
  const stdoutOf = (out) => out.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  /** Facts of a written IFC, read back with IfcOpenShell in the app's Python: the code ends by printing one line of JSON. */
  async function factsOf(bytes, code) {
    await bridge.writeFile('/data/step/curtain-facts.ifc', bytes.slice());  // the engine transfers, and a browser detaches, the buffer
    const out = await bridge.run(['import json', 'import ifcopenshell', 'import ifcopenshell.util.element as el', 'import ifcopenshell.util.placement as pl', 'import ifcopenshell.util.unit',
      'm = ifcopenshell.open("/data/step/curtain-facts.ifc")', 'scale = ifcopenshell.util.unit.calculate_unit_scale(m)',
      'matrix = getattr(pl, "get_placement", None) or pl.get_local_placement',
      'def world(e, items):',
      '    M = matrix(e.ObjectPlacement)',
      '    return [[(M[k][0] * p[0] + M[k][1] * p[1] + M[k][2] * p[2] + M[k][3]) * scale for k in range(3)] for i in items for p in _dataspatium._cs_item_points(i)]',
      'def box(points):',
      '    return [round(min(p[k] for p in points), 4) for k in range(3)] + [round(max(p[k] for p in points), 4) for k in range(3)] if points else None',
      'def items(e):',
      '    return [i for r in (e.Representation.Representations if e.Representation else ()) if r.RepresentationIdentifier == "Body" for i in r.Items]',
      'def frame(e):',
      '    M = matrix(e.ObjectPlacement)',
      '    return {"origin": [round(M[k][3] * scale, 4) for k in range(3)], "x": [round(M[k][0], 4) + 0.0 for k in range(3)], "z": [round(M[k][2], 4) + 0.0 for k in range(3)]}',
    ].concat(code).join('\n'));
    const error = out.entries.find((e) => e.kind === 'error');
    if (error) throw new Error(String(error.text));
    return JSON.parse(stdoutOf(out).trim().split('\n').pop() || 'null');
  }
  /** Per curtain wall by name: storey, representations, type, IsExternal, quantities (metres), part kinds, parts by name with their
   * box, frame, materials, quantity sets (metres), representations and the points of their 'Axis' in the world (metres). */
  const CURTAINS = [
    'def qtos(e):',
    '    per = {"IfcQuantityLength": scale, "IfcQuantityArea": scale * scale, "IfcQuantityVolume": scale ** 3}',
    '    return {d.Name: dict({q.Name: round(float(q[3]) * per.get(q.is_a(), 1.0), 6) for q in d.Quantities}, method=d.MethodOfMeasurement)',
    '            for r in e.IsDefinedBy or () if r.is_a("IfcRelDefinesByProperties") for d in [r.RelatingPropertyDefinition] if d.is_a("IfcElementQuantity")}',
    'def axis(e):',
    '    M = matrix(e.ObjectPlacement)',
    '    return [[round((M[k][0] * c[0] + M[k][1] * c[1] + M[k][2] * c[2] + M[k][3]) * scale, 4) + 0.0 for k in range(3)]',
    '            for r in e.Representation.Representations if r.RepresentationIdentifier == "Axis" for i in r.Items for c in [(list(p.Coordinates) + [0.0])[:3] for p in i.Points]]',
    'facts = {"walls": {w.Name: el.get_pset(w, "Pset_WallCommon", "IsExternal") for w in m.by_type("IfcWall")}, "curtains": {},',
    '         "types": sorted("%s %s %s" % (t.is_a(), t.Name, t.PredefinedType) for t in m.by_type("IfcPlateType") + m.by_type("IfcMemberType"))}',
    'for cw in m.by_type("IfcCurtainWall"):',
    '    t = el.get_type(cw)',
    '    c = el.get_container(cw, should_get_direct=True)',
    '    parts = [p for r in cw.IsDecomposedBy for p in r.RelatedObjects]',
    '    kinds, named = {}, {}',
    '    for p in parts:',
    '        pt, pty, mat = el.get_predefined_type(p), el.get_type(p), el.get_material(p)',
    '        key = "%s %s %s %s" % (p.is_a(), pt, "%s %s" % (pty.is_a(), pty.Name) if pty else None, mat.is_a() if mat else None)',
    '        kinds[key] = kinds.get(key, 0) + 1',
    '        named[p.Name] = {"box": box(world(p, items(p))), "frame": frame(p), "contained": bool(p.ContainedInStructure), "own_pt": getattr(p, "PredefinedType", None),',
    '                         "materials": [[x.Name, getattr(x, "Category", None)] for x in el.get_materials(p)], "rel": p.ObjectPlacement.PlacementRelTo == cw.ObjectPlacement,',
    '                         "qto": qtos(p), "rep": [[r.RepresentationIdentifier, r.RepresentationType] for r in p.Representation.Representations], "axis": axis(p)}',
    '    q = el.get_pset(cw, "Qto_CurtainWallQuantities") or {}',
    '    per = {"Length": scale, "Height": scale, "Width": scale, "GrossSideArea": scale * scale, "NetSideArea": scale * scale}',
    '    facts["curtains"][cw.Name] = {"storey": c.Name if c else None, "rep": [[r.RepresentationIdentifier, r.RepresentationType] for r in cw.Representation.Representations],',
    '        "type": "%s %s" % (t.is_a(), t.Name) if t else None, "pt": getattr(cw, "PredefinedType", None), "external": el.get_pset(cw, "Pset_CurtainWallCommon", "IsExternal"),',
    '        "qto": {k: round(v * per[k], 6) for k, v in q.items() if k in per}, "aggregates": len(cw.IsDecomposedBy), "kinds": kinds, "parts": named,',
    '        "box": box([x for p in parts for x in world(p, items(p))]), "frame": frame(cw)}',
    'print(json.dumps(facts))',
  ];
  /** The wheel's notes other than those every new change set may carry: IsExternal left out on an open storey, no CRS yet. */
  const ownNotes = (notes) => (notes || []).filter((n) => !/^IsExternal was left out|^GRF003/.test(String(n)));
  /** The base quantities of a member w by d metres and `length` long, and of a panel a by b metres and t thick, as the wheel computes them. */
  const memberQto = (length, w, d) => { const side = 2 * (w + d) * length; return { Length: length, CrossSectionArea: w * d, OuterSurfaceArea: side, GrossSurfaceArea: side + 2 * w * d, NetSurfaceArea: side + 2 * w * d, GrossVolume: w * d * length, NetVolume: w * d * length, method: 'BaseQuantities' }; };
  const panelQto = (a, b, t) => ({ Width: t, Perimeter: 2 * (a + b), GrossArea: a * b, NetArea: a * b, GrossVolume: a * b * t, NetVolume: a * b * t, method: 'BaseQuantities' });
  /** That a quantity set has exactly the quantities wanted, each within a micrometre (or cubic micrometre). */
  const sameQto = (assert, got, want, label) => {
    assert.ok(got && Object.keys(got).sort().join() === Object.keys(want).sort().join(), label + ': ' + JSON.stringify(got));
    for (const [k, v] of Object.entries(want)) assert.ok(typeof v === 'string' ? got[k] === v : near(got[k], v, 1e-6), label + ' ' + k + ': ' + JSON.stringify(got));
  };
  const refused = (cs, name, args, assert, label) => { const out = writeTools.call(cs, name, args); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return String(out.error || ''); };

  test('ai curtain: create_element makes an IfcCurtainWall along its axis on an even grid of bays and rows, and checks its curtain, type and fields', async (assert) => {
    assert.ok(writeTools.ELEMENT_CLASSES.includes('IfcCurtainWall'), 'a class of create_element');
    const tool = writeTools.TOOLS.find((x) => x.name === 'create_element');
    assert.deepEqual(tool.parameters.properties.curtain.required, ['start', 'end', 'height', 'base', 'bays', 'bay_width', 'rows', 'row_height'], 'every field of the curtain is required, null when not given');
    assert.ok(['IfcCurtainWall for a glass façade', 'curtain is the façade', 'IfcMember MULLION', 'IfcPlate CURTAIN_PANEL', 'define_type curtain_wall', 'meet the walls on their lines'].every((w) => tool.description.includes(w)), 'the tool says how');
    const cs = writeTools.create('curtain-test');
    for (const [name, args] of STEPS) { const out = writeTools.call(cs, name, args); assert.ok(out.ok, name + ': ' + JSON.stringify(out)); }
    const words = { panel: i18n.t('ai.change.curtain.panel'), mullion: i18n.t('ai.change.curtain.mullion'), transom: i18n.t('ai.change.curtain.transom') };
    assert.deepEqual(cs.ops[4], { tool: 'create_element', storey: 'Plan 1', ifc_class: 'IfcCurtainWall', predefined_type: null, object_type: null, name: 'Fasad', at: null, z: null, rotation: null, shape: null, stair: null, part_of: null, host: null, type: 'new-4',
      curtain: { start: [12, 8], end: [0, 8], height: 3, base: 0, bays: null, bay_width: 1.5, rows: 2, row_height: null }, part_names: words, ref: 'new-5' }, 'the façade as the wheel reads it, with the parts\' words in the person\'s language');
    assert.deepEqual(cs.ops[5].curtain, { start: [6, 0], end: [6, 8], height: 2.5, base: 0.2, bays: 2, bay_width: null, rows: null, row_height: 1.5 }, 'a count, and the default spacing up');
    assert.ok(writeTools.call(cs, 'create_element', facade({ name: 'Noll', z: 0, rotation: 0, curtain: curtain({ bay_width: null, rows: null }) })).ok, 'z and rotation 0 are as null');
    assert.deepEqual([cs.ops[6].curtain.bay_width, cs.ops[6].curtain.row_height, cs.ops[6].z], [1.5, 1.5, null], 'both null: 1.5 m bays and rows');
    assert.ok(!('curtain' in cs.ops[1]) && !('part_names' in cs.ops[1]), 'another create keeps its form');
    const no = (args, label) => refused(cs, 'create_element', args, assert, label);
    assert.ok(no(facade({ shape: { profile: 'rectangle', x: 1, y: 1, radius: null, outline: null, depth: 1, along: null } }), 'a shape').includes('takes curtain'));
    assert.ok(no(facade({ at: [0, 0] }), 'at').includes('along its axis'));
    assert.ok(no(facade({ z: 1 }), 'z').includes('curtain.base'));
    assert.ok(no(facade({ part_of: 'new-1' }), 'part_of').includes('part_of and host must be null'));
    assert.ok(no(facade({ curtain: null }), 'no curtain').includes('needs curtain'));
    assert.ok(no(facade({ curtain: curtain({ end: [12, 8] }) }), 'one point').includes('0.3 m apart'));
    assert.ok(no(facade({ curtain: curtain({ bays: 8 }) }), 'a count and a spacing').includes('not both'));
    assert.ok(no(facade({ curtain: curtain({ bay_width: null, bays: 2.5 }) }), 'half a bay').includes('whole number from 1 to 100'));
    assert.ok(no(facade({ curtain: curtain({ bay_width: 0.05 }) }), 'a spacing too small').includes('at most 100'));
    assert.ok(no(facade({ curtain: curtain({ bay_width: 0.2, rows: 20 }) }), 'too many panels').includes('at most 200'));
    assert.ok(no(facade({ curtain: curtain({ start: [0, 0], end: [1, 0], bay_width: null, bays: 10 }) }), 'panels too narrow').includes('give fewer bays or rows'));
    assert.ok(writeTools.call(cs, 'create_element', facade({ name: 'Smal', curtain: curtain({ start: [0, 0], end: [1.1, 0], bay_width: null, bays: 10 }) })).ok, '10 bays over 1.1 m between members of 0.05 m');
    assert.ok(no(facade({ type: 'new-4', curtain: curtain({ start: [0, 0], end: [1.1, 0], bay_width: null, bays: 10 }) }), 'but not between the type\'s of 0.06 m').includes('members 0.06 m wide'));
    assert.ok(no(facade({ predefined_type: 'MULLION' }), 'a part\'s PredefinedType').includes('NOTDEFINED'));
    assert.ok(writeTools.call(cs, 'create_element', facade({ predefined_type: 'USERDEFINED', object_type: 'Strukturell glasfasad' })).ok, 'USERDEFINED with object_type');
    assert.ok(no(facade({ type: 'new-1' }), 'a wall as type').includes('not a type'));
    assert.ok(writeTools.call(cs, 'define_type', { kind: 'column', name: 'P1', layers: null, predefined_type: null, material: null, material_category: null }).ok);
    assert.ok(no(facade({ type: `new-${cs.refs}` }), 'a column type').includes('curtain_wall type'));
    assert.ok(no({ storey: 'Plan 1', ifc_class: 'IfcColumn', predefined_type: null, object_type: null, type: null, name: null, at: [0, 0], z: null, rotation: null, shape: { profile: 'circle', x: null, y: null, radius: 0.1, outline: null, depth: 3, along: null }, stair: null, curtain: curtain(), part_of: null, host: null }, 'a column with a curtain').includes('curtain is for IfcCurtainWall'));
    const theirs = writeTools.call(cs, 'create_element', facade({ type: 77 }));
    assert.ok(theirs.ok && cs.ops[cs.ops.length - 1].type === 77, 'a type of the model by id, which the wheel checks');
    const guids = writeTools.withGuids(writeTools.toWheel(cs), (id) => (id === 77 ? '3cUkl32yn9qRSPvBJVyWYp' : null));
    assert.ok(guids[guids.length - 1].type === '3cUkl32yn9qRSPvBJVyWYp' && guids[4].type === 'new-4' && !('ref' in guids[4]), 'the type goes to a server by its GlobalId, a ref stays a ref');
    return 'ok';
  });

  test('ai curtain: define_type makes a curtain wall type with its frame\'s and glass\'s materials and sizes, NOTDEFINED', async (assert) => {
    assert.ok(writeTools.TYPE_KINDS.includes('curtain_wall'), 'a kind of define_type');
    assert.deepEqual(writeTools.CURTAIN_SIZES, { member_width: 0.05, member_depth: 0.15, panel_thickness: 0.03 });
    const tool = writeTools.TOOLS.find((x) => x.name === 'define_type');
    assert.ok(['panel_material', 'member_width', 'member_depth', 'panel_thickness'].every((k) => k in tool.parameters.properties), 'the new fields');
    assert.ok(['IfcCurtainWallType', 'IfcPlateType CURTAIN_PANEL', 'IfcMemberType MULLION'].every((w) => tool.description.includes(w)), 'the tool names the types');
    const cs = writeTools.create('curtain-types');
    assert.ok(writeTools.call(cs, 'define_type', cwType()).ok);
    assert.deepEqual(cs.ops[0], { tool: 'define_type', kind: 'curtain_wall', name: 'GF1', layers: null, predefined_type: null, material: 'Stål', material_category: 'steel', panel_material: 'Glas', member_width: 0.06, member_depth: 0.2, panel_thickness: 0.04, ref: 'new-1' }, 'the type with its materials and sizes');
    assert.ok(writeTools.call(cs, 'define_type', cwType({ name: 'GF2', material: null, material_category: null, panel_material: null, member_width: null, member_depth: null, panel_thickness: null, predefined_type: 'notdefined' })).ok);
    assert.deepEqual(cs.ops[1], { tool: 'define_type', kind: 'curtain_wall', name: 'GF2', layers: null, predefined_type: 'NOTDEFINED', member_width: 0.05, member_depth: 0.15, panel_thickness: 0.03, ref: 'new-2' }, 'the default sizes, and the materials left to the wheel');
    const no = (args, label) => refused(cs, 'define_type', args, assert, label);
    assert.ok(no(cwType({ name: 'X', layers: [{ material: 'Glas', thickness: 0.03, category: 'glass', role: null }] }), 'layers').includes('no layers'));
    assert.ok(no(cwType({ name: 'X', predefined_type: 'MULLION' }), 'a part\'s PredefinedType').includes('leave predefined_type null'));
    assert.ok(no(cwType({ name: 'X', panel_thickness: 0.2 }), 'a panel as deep as the members').includes('less than member_depth'));
    assert.ok(no(cwType({ name: 'X', member_width: 0.01 }), 'a member of 1 cm').includes('0.02 to 0.5 m'));
    assert.ok(no(cwType({ name: 'X', material_category: 'timber' }), 'a category outside the list').includes('material_category'));
    assert.ok(no(cwType({ name: 'gf1' }), 'a curtain wall type of the same name').includes('new-1'));
    return 'ok';
  });

  test('ai curtain: the step list describes the curtain wall with its grid and the curtain wall type with its sizes in all seven languages', async (assert) => {
    const cs = writeTools.create('curtain-languages');
    for (const [name, args] of STEPS) assert.ok(writeTools.call(cs, name, args).ok, name);
    const codes = i18n.LANGUAGES.map((x) => x.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = [new Set(), new Set()];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const lines = cs.ops.map((op) => writeTools.describe(op));
        for (const line of lines) assert.ok(line && !/\{\w+\}/.test(line) && !/ai\.change\./.test(line), code + ': every placeholder and key filled: ' + line);
        const [type, facadeLine, partition] = [lines[3], lines[4], lines[5]];
        assert.ok(type.startsWith('new-4 ' + i18n.t('ai.change.type.curtain_wall') + ' GF1') && type.includes('0.06 × 0.2') && type.includes('0.04') && type.includes('Stål') && type.includes('Glas'), code + ': ' + type);
        assert.ok(facadeLine.startsWith('new-5 IfcCurtainWall Fasad') && facadeLine.includes('(12, 8)') && facadeLine.includes('(0, 8)') && facadeLine.includes('8 × 2') && facadeLine.endsWith(i18n.t('ai.change.typed', { type: 'new-4' })), code + ': the façade of 8 bays by 2 rows: ' + facadeLine);
        assert.ok(partition.includes('2 × 2') && partition.includes(i18n.t('ai.change.curtain.base', { base: '0.2' })), code + ': the partition, 2 by 2 from 0.2 m: ' + partition);
        seen[0].add(facadeLine); seen[1].add(type);
      }
      for (const lines of seen) assert.ok(lines.size >= 2, 'Swedish and English differ (the other five may show English, F49 a): ' + Array.from(lines).join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai curtain: the build and change texts make glass façades with create_element, and the class search points there', async (assert) => {
    for (const [label, text] of [['build', agent.SYSTEM_BUILD], ['change', agent.SYSTEM_CHANGE]]) {
      assert.ok(/glass façade[^.]*IfcCurtainWall of create_element/i.test(text) && text.includes('curtain_wall type of define_type') && text.includes('meeting the walls on their lines'), label + ': a glass façade as a curtain wall');
    }
    const search = modelTools.TOOLS.find((x) => x.name === 'search_ifc_class').description;
    assert.ok(/straight stair or curtain wall/.test(search), 'the class search names curtain walls among create_element\'s');
    return 'ok';
  });

  test('ai curtain: Python makes a typed façade and an untyped glass partition in an IFC4.3 model: classes, types, aggregation, grid, placements, materials, IsExternal, quantities, no rule failures and the app\'s IDS passed', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset } = await ifcNew.create({ name: 'Glasfasadprov', schema: 'IFC4X3_ADD2', storey: 'Plan 1' });
    created.push(dataset.id);
    const waste = await presets.load(WASTE);
    const cs = writeTools.create(dataset.id);
    for (const [name, args] of STEPS.concat([WALLS])) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
    const res = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs), { ids: { name: waste.name, text: waste.text } });
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings).slice(0, 2000));
    assert.ok(res.report.rules && res.report.rules.errors === 0 && res.report.rules.warnings === 0, 'no rule failures (IFC102, GEM111, OJT001, SPS007, PSE001, QTY001 …): ' + JSON.stringify(res.report.rules));
    assert.deepEqual(ownNotes(res.report.notes), [], 'nothing left out');
    const ids = res.report.ids;
    assert.ok(ids && !ids.error && ids.file === 'SE-Dataspatium_Avfallshantering.ids' && ids.specifications >= 4 && Array.isArray(ids.failed) && ids.failed.length === 0,
      'the AI\'s preview: the app\'s own IDS Avfallshantering passes the model: ' + JSON.stringify(ids));
    const refs = (res.report.created || []).filter((e) => e.ref).map((e) => [e.ref, e.ifc_class, e.name]);
    assert.deepEqual(refs.slice(3), [['new-4', 'IfcCurtainWallType', 'GF1'], ['new-5', 'IfcCurtainWall', 'Fasad'], ['new-6', 'IfcCurtainWall', 'Glasvägg']], 'one ref per curtain wall and type, as the panel counts');
    assert.equal((res.report.created || []).filter((e) => !e.ref && ['IfcPlate', 'IfcMember'].includes(e.ifc_class)).length, 33 + 16 + 9 + 4, 'the parts among the created, without refs');
    const top = Array.isArray(res.report.topology) ? res.report.topology[0] : null;
    assert.ok(top && top.closed && top.rooms.length === 2 && top.external.some((x) => x.name === 'Fasad'), 'the topology reads the curtain walls as walls: closed, two rooms, the façade outside: ' + JSON.stringify(top).slice(0, 600));
    const f = await factsOf(res.bytes, CURTAINS);
    assert.deepEqual(f.types, ['IfcMemberType GF1 MULLION', 'IfcPlateType GF1 CURTAIN_PANEL'], 'the parts\' types of the curtain wall type\'s name');
    assert.deepEqual(f.walls, { Syd: true, 'Öst': true, 'Väst': true }, 'the walls external');
    const w = { mullion: i18n.t('ai.change.curtain.mullion'), transom: i18n.t('ai.change.curtain.transom'), panel: i18n.t('ai.change.curtain.panel') };
    const F = f.curtains.Fasad;
    assert.ok(F && F.storey === 'Plan 1' && F.type === 'IfcCurtainWallType GF1' && F.pt === 'NOTDEFINED' && F.external === true && F.aggregates === 1, 'the façade in the storey, typed, external, one aggregation: ' + JSON.stringify(Object.assign({}, F, { parts: undefined })));
    assert.deepEqual(F.rep, [['Axis', 'Curve2D']], 'its axis and no body of its own');
    assert.deepEqual(F.qto, { Length: 12, Height: 3, Width: 0.2, GrossSideArea: 36, NetSideArea: 36 }, 'Qto_CurtainWallQuantities');
    assert.deepEqual(F.kinds, { 'IfcMember MULLION IfcMemberType GF1 IfcMaterialProfileSetUsage': 33, 'IfcPlate CURTAIN_PANEL IfcPlateType GF1 IfcMaterialLayerSetUsage': 16 },
      '9 mullions and 3 × 8 transoms, 8 × 2 panels, typed, with their profile and layer set usages: ' + JSON.stringify(F.kinds));
    const parts = Object.values(F.parts);
    assert.ok(parts.every((p) => !p.contained && p.rel && p.own_pt === null), 'every part aggregated, not contained, placed relative to the façade, its kind on its type (OJT001, SPS007)');
    assert.ok(nearAll(F.box, [0, 7.9, 0, 12, 8.1, 3]), 'the parts fill the façade from (12, 8) to (0, 8), 3 m high and 0.2 m deep: ' + JSON.stringify(F.box));
    const P1 = F.parts[`Fasad ${w.mullion} 1`]; const P9 = F.parts[`Fasad ${w.mullion} 9`];
    assert.ok(P1 && nearAll(P1.box, [11.94, 7.9, 0, 12, 8.1, 3]) && nearAll(P1.frame.z, [0, 0, 1]), 'the first mullion flush with the start, 0.06 × 0.2 m, standing: ' + JSON.stringify(P1));
    assert.ok(P9 && nearAll(P9.box, [0, 7.9, 0, 0.06, 8.1, 3]), 'the ninth flush with the end: ' + JSON.stringify(P9));
    assert.deepEqual(P1.materials, [['Stål', 'steel']], 'the frame\'s material through the profile set');
    const T11 = F.parts[`Fasad ${w.transom} 1.1`]; const T83 = F.parts[`Fasad ${w.transom} 8.3`];
    assert.ok(T11 && nearAll(T11.box, [10.5075, 7.9, 0, 11.94, 8.1, 0.06]) && nearAll(T11.frame.z, [-1, 0, 0]), 'the lowest transom of the first bay between its mullions, on the base, along the axis: ' + JSON.stringify(T11));
    assert.ok(T83 && nearAll(T83.box, [0.06, 7.9, 2.94, 1.4925, 8.1, 3]), 'the highest of the last bay under the top: ' + JSON.stringify(T83));
    const G11 = F.parts[`Fasad ${w.panel} 1.1`]; const G82 = F.parts[`Fasad ${w.panel} 8.2`];
    assert.ok(G11 && nearAll(G11.box, [10.5075, 7.98, 0.06, 11.94, 8.02, 1.47]) && nearAll(G11.frame.z, [0, 1, 0]) && nearAll(G11.frame.x, [-1, 0, 0]),
      'the first panel between the members, 0.04 m in the middle of their depth, its z through its thickness: ' + JSON.stringify(G11));
    assert.ok(G82 && nearAll(G82.box, [0.06, 7.98, 1.53, 1.4925, 8.02, 2.94]), 'the last panel at the top of the last bay: ' + JSON.stringify(G82));
    assert.deepEqual(G11.materials, [['Glas', 'glass']], 'the glass through the layer set');
    // The parts' base quantities from their bodies, one set each: the mullions 3 m, the transoms between them, the panels in the fields.
    sameQto(assert, P1.qto.Qto_MemberBaseQuantities, memberQto(3, 0.06, 0.2), 'the first mullion\'s Qto_MemberBaseQuantities');
    sameQto(assert, T11.qto.Qto_MemberBaseQuantities, memberQto(1.4325, 0.06, 0.2), 'the first transom\'s');
    sameQto(assert, G11.qto.Qto_PlateBaseQuantities, panelQto(1.4325, 1.41, 0.04), 'the first panel\'s Qto_PlateBaseQuantities');
    assert.ok(Object.entries(F.parts).every(([name, p]) => Object.keys(p.qto).join() === (name.startsWith(`Fasad ${w.panel} `) ? 'Qto_PlateBaseQuantities' : 'Qto_MemberBaseQuantities')),
      'every part has its own one set: ' + JSON.stringify(Object.entries(F.parts).map(([name, p]) => [name, Object.keys(p.qto)])));
    // A member with IfcMaterialProfileSetUsage has an 'Axis' (IFC4.3), after its Body: the line it is extruded along, through the profile's centre.
    const reps = (parts, prefix) => Object.entries(parts).map(([name, p]) => (name.startsWith(prefix) ? 'panel ' : 'member ') + JSON.stringify(p.rep));
    assert.deepEqual(Array.from(new Set(reps(F.parts, `Fasad ${w.panel} `))).sort(), ['member [["Body","SweptSolid"],["Axis","Curve3D"]]', 'panel [["Body","SweptSolid"]]'], 'the typed members\' Body and Axis, the panels\' Body');
    assert.ok(nearAll(P1.axis.flat(), [11.97, 8, 0, 11.97, 8, 3]) && nearAll(T11.axis.flat(), [11.94, 8, 0.03, 10.5075, 8, 0.03]), 'the first mullion\'s axis up its middle, the first transom\'s along the façade: ' + JSON.stringify([P1.axis, T11.axis]));
    const G = f.curtains['Glasvägg'];
    assert.ok(G && G.type === null && G.pt === 'NOTDEFINED' && G.external === false, 'the partition untyped and internal: ' + JSON.stringify(Object.assign({}, G, { parts: undefined })));
    assert.deepEqual(G.kinds, { 'IfcMember MULLION None IfcMaterial': 9, 'IfcPlate CURTAIN_PANEL None IfcMaterial': 4 }, 'its parts\' kinds on themselves, 3 + 3 × 2 members and 2 × 2 panels: ' + JSON.stringify(G.kinds));
    assert.ok(nearAll(G.box, [5.925, 0, 0.2, 6.075, 8, 2.7]), 'from (6, 0) to (6, 8), 0.15 m deep, from 0.2 to 2.7 m: ' + JSON.stringify(G.box));
    const g1 = G.parts[`Glasvägg ${w.panel} 1.1`];
    assert.ok(g1 && g1.own_pt === 'CURTAIN_PANEL' && JSON.stringify(g1.materials) === '[["Glass","glass"]]' && JSON.stringify(G.parts[`Glasvägg ${w.mullion} 1`].materials) === '[["Aluminium","aluminium"]]', 'Glass and Aluminium without a type: ' + JSON.stringify(g1));
    sameQto(assert, G.parts[`Glasvägg ${w.mullion} 1`].qto.Qto_MemberBaseQuantities, memberQto(2.5, 0.05, 0.15), 'the partition\'s first mullion, 0.05 × 0.15 m without a type');
    sameQto(assert, g1.qto.Qto_PlateBaseQuantities, panelQto(3.925, 1.175, 0.03), 'its first panel');
    assert.deepEqual(Array.from(new Set(reps(G.parts, `Glasvägg ${w.panel} `))).sort(), ['member [["Body","SweptSolid"]]', 'panel [["Body","SweptSolid"]]'], 'the untyped parts, without a profile set, have their Body alone');
    // The written model as a model of its own: a second change set adds a façade of the type by its GlobalId.
    const typeGuid = (res.report.created || []).find((e) => e.ifc_class === 'IfcCurtainWallType' && e.name === 'GF1');
    const again = await importer.run(new File([res.bytes], 'glasfasadprov-2.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Glasfasadprov 2');
    created.push(again.id);
    // IDS-kontroll on the written model, element by element: every wall, mullion, transom and panel has its material with a category
    // (AH-01) and its volume (AH-02), and both curtain walls their area (AH-03).
    await bridge.writeFile('/data/ids/' + waste.name, waste.bytes.slice());
    const checked = await bridge.ifcTool(again.id, 'ids', { ids: '/data/ids/' + waste.name });
    const passed = (spec, cls) => checked.rows.filter((r) => r[0] === spec && r[4] === cls && r[2] === 'godkänd').length;
    assert.ok(!checked.rows.some((r) => r[2] === 'underkänd'), 'nothing fails: ' + JSON.stringify(checked.rows.filter((r) => r[2] === 'underkänd').slice(0, 5)));
    assert.deepEqual([['Material med kategori', 'IfcWall'], ['Material med kategori', 'IfcMember'], ['Material med kategori', 'IfcPlate'], ['Basmängd: volym', 'IfcWall'], ['Basmängd: volym', 'IfcMember'], ['Basmängd: volym', 'IfcPlate'], ['Basmängd: area', 'IfcCurtainWall']].map(([s, c]) => passed(s, c)),
      [3, 42, 20, 3, 42, 20, 2], 'the walls, the 33 + 9 members, the 16 + 4 panels and the two curtain walls passed: ' + JSON.stringify(checked.summary));
    const cs2 = writeTools.create(again.id);
    assert.ok(writeTools.call(cs2, 'create_element', facade({ name: 'Fasad 2', type: typeGuid.guid, curtain: curtain({ start: [14, 0], end: [14, 6], bay_width: null, bays: 4, rows: 1 }) })).ok);
    const second = await ifcOps.previewChangeset(again.id, writeTools.toWheel(cs2));
    assert.equal(second.report.errors, 0, 'no errors the second time: ' + JSON.stringify(second.report.findings).slice(0, 2000));
    assert.deepEqual(ownNotes(second.report.notes), [], 'the part types found by the type\'s name');
    const g = await factsOf(second.bytes, CURTAINS);
    const F2 = g.curtains['Fasad 2'];
    assert.deepEqual(g.types, ['IfcMemberType GF1 MULLION', 'IfcPlateType GF1 CURTAIN_PANEL'], 'no new part types');
    assert.deepEqual(F2.kinds, { 'IfcMember MULLION IfcMemberType GF1 IfcMaterialProfileSetUsage': 5 + 4 * 2, 'IfcPlate CURTAIN_PANEL IfcPlateType GF1 IfcMaterialLayerSetUsage': 4 }, 'typed by the same part types: ' + JSON.stringify(F2.kinds));
    assert.ok(nearAll(F2.parts[`Fasad 2 ${w.mullion} 1`].box, [13.9, 0, 0, 14.1, 0.06, 3]), 'the members 0.06 × 0.2 m from the profile set, along +y: ' + JSON.stringify(F2.parts[`Fasad 2 ${w.mullion} 1`]));
    assert.ok(nearAll(F2.parts[`Fasad 2 ${w.mullion} 1`].axis.flat(), [14, 0.03, 0, 14, 0.03, 3]), 'and their Axis: ' + JSON.stringify(F2.parts[`Fasad 2 ${w.mullion} 1`].axis));
    assert.ok(near(F2.parts[`Fasad 2 ${w.panel} 1.1`].box[3] - F2.parts[`Fasad 2 ${w.panel} 1.1`].box[0], 0.04), 'the panels 0.04 m from the layer set: ' + JSON.stringify(F2.parts[`Fasad 2 ${w.panel} 1.1`]));
    return 'ok';
  }, 900000);

  test('ai curtain: Python makes the same curtain walls in IFC4 and IFC2X3, the parts\' kinds on their types where IFC2X3 has none on the parts, and their quantities', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const waste = await presets.load(WASTE);
    const want = {
      IFC4: { typed: { 'IfcMember MULLION IfcMemberType GF1 IfcMaterialProfileSetUsage': 33, 'IfcPlate CURTAIN_PANEL IfcPlateType GF1 IfcMaterialLayerSetUsage': 16 },
        untyped: { 'IfcMember MULLION None IfcMaterial': 9, 'IfcPlate CURTAIN_PANEL None IfcMaterial': 4 }, notes: [] },
      IFC2X3: { typed: { 'IfcMember MULLION IfcMemberType GF1 IfcMaterial': 33, 'IfcPlate CURTAIN_PANEL IfcPlateType GF1 IfcMaterialLayerSetUsage': 16 },
        untyped: { 'IfcMember None None IfcMaterial': 9, 'IfcPlate None None IfcMaterial': 4 }, notes: [/^type GF1: IFC2X3 has no material categories/, /^IFC2X3 has no PredefinedType on IfcPlate and IfcMember/] },
    };
    for (const schema of ['IFC4', 'IFC2X3']) {
      const { dataset } = await ifcNew.create({ name: 'Glasfasad ' + schema, schema, storey: 'Plan 1' });
      created.push(dataset.id);
      const cs = writeTools.create(dataset.id);
      // IFC2X3 has no material categories, so its walls keep no material and the app's IDS, for IFC4 and IFC4.3, is tried in IFC4.
      for (const [name, args] of schema === 'IFC4' ? STEPS.concat([WALLS]) : STEPS) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
      const res = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs), schema === 'IFC4' ? { ids: { name: waste.name, text: waste.text } } : {});
      assert.equal(res.report.errors, 0, schema + ': no errors: ' + JSON.stringify(res.report.findings).slice(0, 2000));
      assert.ok(res.report.rules && res.report.rules.errors === 0 && res.report.rules.warnings === 0, schema + ': no rule failures: ' + JSON.stringify(res.report.rules));
      const notes = ownNotes(res.report.notes);
      assert.ok(notes.length === want[schema].notes.length && want[schema].notes.every((re, i) => re.test(notes[i])), schema + ': the notes: ' + JSON.stringify(notes));
      if (schema === 'IFC4') assert.ok(res.report.ids && !res.report.ids.error && res.report.ids.specifications === 8 && res.report.ids.failed.length === 0, 'IFC4: the app\'s IDS Avfallshantering passes in the preview: ' + JSON.stringify(res.report.ids));
      const f = await factsOf(res.bytes, CURTAINS);
      assert.deepEqual(f.curtains.Fasad.kinds, want[schema].typed, schema + ': the typed façade\'s parts: ' + JSON.stringify(f.curtains.Fasad.kinds));
      assert.deepEqual(f.curtains['Glasvägg'].kinds, want[schema].untyped, schema + ': the untyped partition\'s parts: ' + JSON.stringify(f.curtains['Glasvägg'].kinds));
      assert.ok(f.curtains.Fasad.external === true && f.curtains['Glasvägg'].external === false && nearAll(f.curtains.Fasad.box, [0, 7.9, 0, 12, 8.1, 3]), schema + ': IsExternal and the grid: ' + JSON.stringify(Object.assign({}, f.curtains.Fasad, { parts: undefined })));
      assert.ok(Object.values(f.curtains.Fasad.parts).every((p) => !p.contained && p.rel), schema + ': the parts aggregated and placed relative to the façade');
      // The same quantity sets in both, IFC2X3 with IFC4's names, as its walls have them (IFC2X3 has no templates of its own).
      const words = { mullion: i18n.t('ai.change.curtain.mullion'), panel: i18n.t('ai.change.curtain.panel') };
      sameQto(assert, f.curtains.Fasad.parts[`Fasad ${words.mullion} 1`].qto.Qto_MemberBaseQuantities, memberQto(3, 0.06, 0.2), schema + ': the first mullion');
      sameQto(assert, f.curtains['Glasvägg'].parts[`Glasvägg ${words.panel} 1.1`].qto.Qto_PlateBaseQuantities, panelQto(3.925, 1.175, 0.03), schema + ': the partition\'s first panel');
      // IFC4's typed members have their profile set usage and so an Axis; IFC2X3's, of the material alone, have neither.
      const typedReps = Object.entries(f.curtains.Fasad.parts).filter(([name]) => !name.startsWith(`Fasad ${words.panel} `)).map(([, p]) => JSON.stringify(p.rep));
      assert.ok(typedReps.length === 33 && typedReps.every((r) => r === (schema === 'IFC2X3' ? '[["Body","SweptSolid"]]' : '[["Body","SweptSolid"],["Axis","Curve3D"]]')), schema + ': the typed members\' representations: ' + Array.from(new Set(typedReps)).join(' | '));
      if (schema !== 'IFC4') continue;
      // Deleting the partition takes its parts with it, so that none is left in no storey and no whole (SPS007).
      const partition = (res.report.created || []).find((e) => e.ifc_class === 'IfcCurtainWall' && e.name === 'Glasvägg');
      const again = await importer.run(new File([res.bytes], 'glasfasad-ifc4.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Glasfasad IFC4 2');
      created.push(again.id);
      const cs2 = writeTools.create(again.id);
      assert.ok(writeTools.call(cs2, 'delete_elements', { ids: [partition.guid], confirm: true }).ok);
      const gone = await ifcOps.previewChangeset(again.id, writeTools.toWheel(cs2));
      assert.ok(gone.report.errors === 0 && gone.report.rules.errors === 0, 'deleted without errors: ' + JSON.stringify(gone.report.findings).slice(0, 2000));
      assert.equal((gone.report.deleted || []).length, 1 + 9 + 4, 'the partition with its 13 parts: ' + JSON.stringify(gone.report.deleted).slice(0, 600));
      const g = await factsOf(gone.bytes, CURTAINS);
      assert.ok(Object.keys(g.curtains).join() === 'Fasad' && Object.keys(g.curtains.Fasad.parts).length === 49, 'the façade and its 49 parts stay: ' + Object.keys(g.curtains).join());
    }
    return 'ok';
  }, 900000);

  test('ai curtain: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
