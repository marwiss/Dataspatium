// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for more building elements and door and window types (recommendations 4 and 11 of the native IFC study): create_element is a
 * create with a ref for the classes without a tool of their own (never a proxy) that checks its shape, PredefinedType, type, part_of,
 * host and a straight stair; define_type makes covering, column, beam, footing, railing, door and window types; create_opening takes a
 * door or window type with its size and side; the step list describes the new steps in all seven languages; and the build text and
 * the class search point to create_element. With the real Pyodide (`?python=1` or cached components) the wheel makes the elements in
 * an IFC4 model in millimetres, with the stair's flight and landing and its railing as parts, and places typed doors and windows in an
 * IFC4.3 model by the known convention: flush with the wall's left face, a door opening toward it with a LEFT door's hinges toward
 * the wall's start, and turned around with side right; a second change set takes the type by its GlobalId.
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
  const fixtures = D.require('tests/fixtures/ifc');
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
  const rect = (x, y, depth, along) => ({ profile: 'rectangle', x, y, radius: null, outline: null, depth, along: along || null });
  const polygon = (outline, depth) => ({ profile: 'polygon', x: null, y: null, radius: null, outline, depth, along: null });
  const circle = (radius, depth, along) => ({ profile: 'circle', x: null, y: null, radius, outline: null, depth, along: along || null });
  /** A create_element call with every field, null where not given. */
  const element = (patch) => Object.assign({ storey: 'Plan 3', ifc_class: 'IfcColumn', predefined_type: null, object_type: null, type: null, name: null, at: [0, 0], z: null, rotation: null, shape: rect(0.3, 0.3, 3), stair: null, part_of: null, host: null }, patch);
  const STAIR = { risers: 15, riser_height: 0.18, tread_length: 0.25, width: 1, thickness: null, landing: 1.2 };
  const door = (patch) => Object.assign({ kind: 'door', name: 'D1', layers: null, predefined_type: null, material: null, material_category: null, operation: 'SINGLE_SWING_LEFT', partitioning: null, width: 1, height: 2.1, lining_depth: 0.1 }, patch);
  const windowType = (patch) => Object.assign({ kind: 'window', name: 'F1', layers: null, predefined_type: null, material: null, material_category: null, operation: null, partitioning: 'DOUBLE_PANEL_VERTICAL', width: 1.2, height: 1.2, lining_depth: 0.1 }, patch);
  const opening = (patch) => Object.assign({ wall_id: 'new-1', offset: 2, width: null, height: null, sill: 0, fill: null, name: null, type: null, side: null }, patch);
  const WALL = { storey: 'Plan 3', start: [0, 0], end: [12, 0], thickness: 0.3, height: 2.7, name: 'Syd' };
  const layer = (material, thickness, category, role) => ({ material, thickness, category, role });
  /** The elements of the Python test: on Plan 3, new-1 the wall, then the types and elements in the order of their refs. */
  const STEPS = [
    ['create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null }],
    ['create_wall', WALL],
    ['define_type', { kind: 'column', name: 'P1', layers: null, predefined_type: null, material: 'Stål', material_category: 'steel' }],
    ['create_element', element({ name: 'Pelare A', type: 'new-2', at: [3, 4], shape: rect(0.3, 0.3, 3) })],
    ['create_element', element({ ifc_class: 'IfcBeam', predefined_type: 'LINTEL', name: 'Balk', at: [0, 4], z: 2.5, rotation: 90, shape: rect(0.2, 0.4, 6, 'x') })],
    ['create_element', element({ ifc_class: 'IfcFooting', predefined_type: 'STRIP_FOOTING', name: 'Sula', at: null, z: -0.6, shape: polygon([[-0.3, -0.3], [12.3, -0.3], [12.3, 0.3], [-0.3, 0.3]], 0.4) })],
    ['define_type', { kind: 'covering', name: 'Golv1', layers: [layer('Ek', 0.014, 'wood', 'inner_finish'), layer('Underlag', 0.003, 'plastic', null)], predefined_type: 'FLOORING' }],
    ['create_element', element({ ifc_class: 'IfcCovering', name: 'Golv', type: 'new-6', at: null, shape: polygon([[0, 0.15], [12, 0.15], [12, 8], [0, 8]], null) })],
    ['create_element', element({ ifc_class: 'IfcCovering', predefined_type: 'CLADDING', name: 'Panel', at: [6, -0.161], shape: rect(12, 0.022, 2.7), host: 'new-1' })],
    ['create_element', element({ ifc_class: 'IfcStair', name: 'Trappa', at: [8, 2], rotation: 90, shape: null, stair: STAIR })],
    ['create_element', element({ storey: null, ifc_class: 'IfcRailing', predefined_type: 'HANDRAIL', name: 'Ledstång', at: [8.55, 2], z: 0.9, rotation: 90, shape: circle(0.025, 3.5, 'x'), part_of: 'new-9' })],
    ['create_element', element({ ifc_class: 'IfcFurniture', predefined_type: 'TABLE', name: 'Bord', at: [4, 6], shape: rect(1.2, 0.8, 0.72) })],
  ];
  const stdoutOf = (out) => out.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  /** Facts of a written IFC, read back with IfcOpenShell in the app's Python: the code ends by printing one line of JSON. */
  async function factsOf(bytes, code) {
    await bridge.writeFile('/data/step/elements-facts.ifc', bytes);
    const out = await bridge.run(['import json', 'import ifcopenshell', 'import ifcopenshell.util.element as el', 'import ifcopenshell.util.placement as pl', 'import ifcopenshell.util.unit',
      'm = ifcopenshell.open("/data/step/elements-facts.ifc")', 'scale = ifcopenshell.util.unit.calculate_unit_scale(m)',
      'matrix = getattr(pl, "get_placement", None) or pl.get_local_placement',
      'def world(e, items):',
      '    M = matrix(e.ObjectPlacement)',
      '    return [[(M[k][0] * p[0] + M[k][1] * p[1] + M[k][2] * p[2] + M[k][3]) * scale for k in range(3)] for i in items for p in _dataspatium._cs_item_points(i)]',
      'def box(points):',
      '    return [round(min(p[k] for p in points), 4) for k in range(3)] + [round(max(p[k] for p in points), 4) for k in range(3)] if points else None',
      'def items(e):',
      '    out = []',
      '    for r in (e.Representation.Representations if e.Representation else ()):',
      '        for i in r.Items:',
      '            out += list(i.MappingSource.MappedRepresentation.Items) if i.is_a("IfcMappedItem") else [i]',
      '    return out',
      'def frame(e):',
      '    M = matrix(e.ObjectPlacement)',
      '    return {"origin": [round(M[k][3] * scale, 4) for k in range(3)], "x": [round(M[k][0], 4) + 0.0 for k in range(3)], "y": [round(M[k][1], 4) + 0.0 for k in range(3)]}',
    ].concat(code).join('\n'));
    const error = out.entries.find((e) => e.kind === 'error');
    if (error) throw new Error(String(error.text));
    return JSON.parse(stdoutOf(out).trim().split('\n').pop() || 'null');
  }
  /** Per element by name (openings left out): class, PredefinedType, direct storey, whole, type, material, representation, box, frame. */
  const ELEMENTS = [
    'facts = {}',
    'for e in m.by_type("IfcElement"):',
    '    if e.is_a("IfcFeatureElement"):',
    '        continue',
    '    t = el.get_type(e)',
    '    c = el.get_container(e, should_get_direct=True)',
    '    mat = el.get_material(e)',
    '    rec = {"class": e.is_a(), "pt": getattr(e, "PredefinedType", None), "storey": c.Name if c else None, "part_of": e.Decomposes[0].RelatingObject.Name if e.Decomposes else None,',
    '           "type": t.Name if t else None, "type_class": t.is_a() if t else None, "type_pt": getattr(t, "PredefinedType", None) if t else None,',
    '           "material": getattr(mat, "Name", None) if mat is not None else None, "rep": [r.RepresentationType for r in e.Representation.Representations] if e.Representation else [],',
    // IFC4 deprecates IfcRelCoversBldgElements (IFC102): a covering is then part of the element it covers.
    '           "box": box(world(e, items(e))), "frame": frame(e), "covers": [r.RelatingBuildingElement.Name for r in getattr(e, "CoversElements", None) or ()]',
    '                    + [r.RelatingObject.Name for r in getattr(e, "Decomposes", None) or () if e.is_a("IfcCovering") and r.RelatingObject.is_a("IfcElement")]}',
    '    if e.is_a("IfcStairFlight"):',
    '        rec["pset"] = {k: v for k, v in el.get_psets(e).get("Pset_StairFlightCommon", {}).items() if k != "id"}',
    // IFC4 deprecates the flight's own counts (IFC102): they are read from Pset_StairFlightCommon there.
    '        sf = el.get_pset(e, "Pset_StairFlightCommon") or {}',
    '        rec["counts"] = [e.NumberOfRisers if e.NumberOfRisers is not None else sf.get("NumberOfRiser"), e.NumberOfTreads if e.NumberOfTreads is not None else sf.get("NumberOfTreads"),',
    '                         round((e.RiserHeight if e.RiserHeight is not None else sf.get("RiserHeight")) * scale, 6), round((e.TreadLength if e.TreadLength is not None else sf.get("TreadLength")) * scale, 6)]',
    '    facts[e.Name] = rec',
    'print(json.dumps({"scale": scale, "elements": facts}))',
  ];
  /** Per door and window by name: its type and attributes, frame, and the boxes of the type's mapped items: all, the panel, the handles. */
  const FILLS = [
    'facts = {}',
    'for e in m.by_type("IfcDoor") + m.by_type("IfcWindow"):',
    '    t = el.get_type(e)',
    '    parts = [(i, box(world(e, [i]))) for i in items(e)]',
    '    rec = {"type": t.Name if t else None, "type_class": t.is_a() if t else None, "type_pt": getattr(t, "PredefinedType", None) if t else None,',
    '           "operation": getattr(t, "OperationType", None) if t else None, "partitioning": getattr(t, "PartitioningType", None) if t else None,',
    '           "pt": e.PredefinedType, "own_operation": getattr(e, "OperationType", None), "own_partitioning": getattr(e, "PartitioningType", None),',
    '           "rep": [r.RepresentationType for r in e.Representation.Representations], "size": [round(e.OverallWidth * scale, 4), round(e.OverallHeight * scale, 4)],',
    '           "frame": frame(e), "all": box(world(e, items(e))),',
    '           "panel": box([p for i, b in parts if abs(b[3] - b[0] - 0.95) < 1e-3 for p in world(e, [i])]),',
    '           "handles": box([p for i, b in parts if b[3] - b[0] < 0.15 and b[2] - frame(e)["origin"][2] > 0.5 for p in world(e, [i])]),',
    // IFC4.3 deprecates IfcDoorLiningProperties and IfcWindowLiningProperties (IFC102) for the standard sets of the same name.
    '           "lining": ([p.LiningDepth * scale for p in (t.HasPropertySets or ()) if p.is_a("IfcDoorLiningProperties") or p.is_a("IfcWindowLiningProperties")]',
    '                      + [v * scale for v in (el.get_pset(t, "Pset_DoorLiningProperties", "LiningDepth"), el.get_pset(t, "Pset_WindowLiningProperties", "LiningDepth")) if v]) if t else [],',
    '           "qto": {q.Name: round(float(q[3]), 6) for r in e.IsDefinedBy or () if r.is_a("IfcRelDefinesByProperties") and r.RelatingPropertyDefinition.is_a("IfcElementQuantity") for q in r.RelatingPropertyDefinition.Quantities}}',
    '    facts[e.Name] = rec',
    'print(json.dumps({"scale": scale, "fills": facts}))',
  ];

  test('ai elements: create_element is a create with a ref for the classes without a tool of their own, never a proxy, and checks its shape, PredefinedType, type, part_of and host', async (assert) => {
    assert.ok(writeTools.has('create_element') && writeTools.CREATES.includes('create_element'), 'a write tool that creates');
    const tool = writeTools.TOOLS.find((x) => x.name === 'create_element');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['storey', 'ifc_class', 'predefined_type', 'object_type', 'type', 'name', 'at', 'z', 'rotation', 'shape', 'stair', 'part_of', 'host']);
    assert.deepEqual(tool.parameters.properties.shape.required, ['profile', 'x', 'y', 'radius', 'outline', 'depth', 'along'], 'every field of the shape is required, null when not given');
    assert.deepEqual(tool.parameters.properties.stair.required, ['risers', 'riser_height', 'tread_length', 'width', 'thickness', 'landing']);
    assert.deepEqual(writeTools.ELEMENT_CLASSES, ['IfcColumn', 'IfcBeam', 'IfcMember', 'IfcFooting', 'IfcPile', 'IfcCovering', 'IfcRailing', 'IfcChimney', 'IfcShadingDevice', 'IfcSanitaryTerminal', 'IfcFurniture', 'IfcFurnishingElement', 'IfcStair']);
    assert.ok(writeTools.ELEMENT_CLASSES.every((c) => tool.description.includes(c)) && tool.description.includes('never IfcBuildingElementProxy'), 'the tool names its classes and never a proxy');
    assert.ok(['FLOORING', 'CEILING', 'CLADDING', 'ROOFING', 'INSULATION', 'search_ifc_class', 'USERDEFINED only with object_type'].every((w) => tool.description.includes(w)), 'the coverings\' values and how to choose');
    const cs = writeTools.create('elements-test');
    for (const [name, args] of STEPS) { const out = writeTools.call(cs, name, args); assert.ok(out.ok, name + ': ' + JSON.stringify(out)); }
    assert.deepEqual(cs.ops.map((op) => op.ref || null), [null, 'new-1', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6', 'new-7', 'new-8', 'new-9', 'new-10', 'new-11'], 'one ref per create, as the wheel counts them');
    assert.deepEqual(cs.ops[3], { tool: 'create_element', storey: 'Plan 3', ifc_class: 'IfcColumn', predefined_type: null, object_type: null, name: 'Pelare A', at: [3, 4], z: 0, rotation: 0, shape: { profile: 'rectangle', x: 0.3, y: 0.3, radius: null, outline: null, depth: 3, along: 'z' }, stair: null, part_of: null, host: null, type: 'new-2', ref: 'new-3' }, 'the column as the wheel reads it');
    assert.equal(cs.ops[5].at, null, 'a polygon is in the storey\'s plane, without at');
    assert.equal(cs.ops[7].shape.depth, 0.017, 'a typed covering\'s depth is its layers\'');
    assert.ok(cs.ops[8].host === 'new-1' && cs.ops[10].part_of === 'new-9' && cs.ops[10].shape.along === 'x', 'host and part_of');
    assert.deepEqual(cs.ops[9].stair, { risers: 15, riser_height: 0.18, tread_length: 0.25, width: 1, thickness: 0.2, landing: 1.2 }, 'the stair, its thickness 0.2 by default');
    assert.ok(cs.ops[9].shape === null && cs.ops[9].at[0] === 8, 'a stair has no shape');
    const refused = (args, label) => { const out = writeTools.call(cs, 'create_element', args); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return String(out.error || ''); };
    assert.ok(refused(element({ ifc_class: 'IfcBuildingElementProxy' }), 'a proxy').includes('IfcBuildingElementProxy is never used'));
    assert.ok(refused(element({ ifc_class: 'IfcWall' }), 'a wall').includes('tools of their own'));
    assert.ok(writeTools.call(cs, 'create_element', element({ ifc_class: 'ifccolumn' })).ok && cs.ops[cs.ops.length - 1].ifc_class === 'IfcColumn', 'the class in any case');
    assert.ok(refused(element({ predefined_type: 'pad footing' }), 'not a value').includes('predefined_type'));
    assert.ok(refused(element({ predefined_type: 'USERDEFINED' }), 'USERDEFINED without object_type').includes('object_type'));
    assert.ok(writeTools.call(cs, 'create_element', element({ predefined_type: 'USERDEFINED', object_type: 'Stolpe' })).ok, 'USERDEFINED with object_type');
    assert.ok(refused(element({ shape: null }), 'no shape').includes('shape must be'));
    assert.ok(refused(element({ shape: Object.assign(rect(0.3, 0.3, 3), { profile: 'hexagon' }) }), 'another profile').includes('rectangle, circle or polygon'));
    assert.ok(refused(element({ shape: rect(0.3, null, 3) }), 'a rectangle without y').includes('shape.y'));
    assert.ok(refused(element({ shape: rect(0.3, 0.3, null) }), 'no depth').includes('shape.depth'));
    assert.ok(refused(element({ shape: Object.assign(polygon([[0, 0], [1, 0], [1, 1]], 1), { along: 'x' }) }), 'a lying polygon').includes('along must be z'));
    assert.ok(refused(element({ shape: polygon([[0, 0], [1, 0], [0, 0]], 1) }), 'two corners').includes('corners'));
    assert.ok(refused(element({ at: null }), 'a column without at').includes('at must be'));
    assert.ok(refused(element({ type: 'new-6' }), 'a covering type on a column').includes('column type'));
    assert.ok(refused(element({ type: 'new-3' }), 'an element is no type').includes('not a type'));
    assert.ok(refused(element({ ifc_class: 'IfcMember', type: 'new-2' }), 'a member with a define_type ref').includes('define_type makes no type for IfcMember'));
    assert.ok(writeTools.call(cs, 'create_element', element({ ifc_class: 'IfcMember', type: 77 })).ok, 'but a member type of the model by id');
    assert.ok(refused(element({ ifc_class: 'IfcCovering', type: 'new-6', shape: polygon([[0, 0], [1, 0], [1, 1]], 0.02) }), 'a depth other than the layers\'').includes('leave depth null'));
    assert.ok(refused(element({ host: 'new-1' }), 'a host for a column').includes('host is for IfcCovering'));
    assert.ok(refused(element({ ifc_class: 'IfcCovering', host: 'new-2' }), 'a type as host').includes('define_type step'));
    assert.ok(refused(element({ part_of: 'new-1' }), 'part of a wall').includes('create_element or create_roof'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: rect(1, 1, 1), stair: STAIR }), 'a stair with a shape').includes('takes stair'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: null, stair: null }), 'a stair without its flight').includes('stair:'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: null, stair: Object.assign({}, STAIR, { risers: 1 }) }), 'one riser').includes('risers'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: null, stair: Object.assign({}, STAIR, { thickness: 0.1 }) }), 'too thin').includes('at least the riser height'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: null, stair: STAIR, predefined_type: 'SPIRAL_STAIR' }), 'a spiral').includes('STRAIGHT_RUN_STAIR'));
    assert.ok(refused(element({ ifc_class: 'IfcStair', shape: null, stair: STAIR, part_of: 'new-9' }), 'a stair in a stair').includes('part_of and host must be null'));
    assert.ok(refused(element({ stair: STAIR }), 'a column with a stair').includes('stair is for IfcStair'));
    const wheel = writeTools.toWheel(cs);
    assert.ok(wheel.every((op) => !('ref' in op)) && wheel[10].part_of === 'new-9', 'the wheel counts the refs itself');
    const guids = writeTools.withGuids([Object.assign({}, wheel[10], { part_of: 501 }), Object.assign({}, wheel[8], { host: 502 })], (id) => (id === 501 ? '0YvctVUKr0kugbFTf53O9L' : id === 502 ? '1kTvXnbbzCWw8lcMd1dR4o' : null));
    assert.ok(guids[0].part_of === '0YvctVUKr0kugbFTf53O9L' && guids[1].host === '1kTvXnbbzCWw8lcMd1dR4o', 'part_of and host go to a server by their GlobalIds');
    return 'ok';
  });

  test('ai elements: define_type makes covering, column, beam, footing, railing, door and window types, a door with its operation and a window with its partitioning and size', async (assert) => {
    assert.deepEqual(writeTools.TYPE_KINDS, ['wall', 'slab', 'roof', 'covering', 'column', 'beam', 'footing', 'railing', 'door', 'window']);
    const tool = writeTools.TOOLS.find((x) => x.name === 'define_type');
    assert.ok(writeTools.DOOR_OPERATIONS.concat(writeTools.WINDOW_PARTITIONS, ['IfcDoorStyle', 'IfcWindowStyle', 'lining_depth', 'create_element', 'create_opening']).every((w) => tool.description.includes(w)), 'the tool names the operations, partitionings and IFC2X3\'s styles');
    assert.ok(['material', 'material_category', 'operation', 'partitioning', 'width', 'height', 'lining_depth'].every((k) => k in tool.parameters.properties), 'the new fields');
    const cs = writeTools.create('element-types');
    const column = writeTools.call(cs, 'define_type', { kind: 'Column', name: 'P1', layers: null, predefined_type: 'column', material: 'Stål', material_category: 'Steel' });
    assert.ok(column.ok && column.ref === 'new-1', JSON.stringify(column));
    assert.deepEqual(cs.ops[0], { tool: 'define_type', kind: 'column', name: 'P1', layers: null, predefined_type: 'COLUMN', material: 'Stål', material_category: 'steel', ref: 'new-1' }, 'a column type with its material');
    assert.ok(writeTools.call(cs, 'define_type', door({ operation: 'single swing right', width: null, height: null, lining_depth: null })).ok);
    assert.deepEqual(cs.ops[1], { tool: 'define_type', kind: 'door', name: 'D1', layers: null, predefined_type: null, operation: 'SINGLE_SWING_RIGHT', width: 0.9, height: 2.1, lining_depth: 0.05, ref: 'new-2' }, 'a door type with the defaults');
    assert.ok(writeTools.call(cs, 'define_type', windowType({ partitioning: null, width: null, height: null })).ok);
    assert.deepEqual([cs.ops[2].partitioning, cs.ops[2].width, cs.ops[2].height, cs.ops[2].lining_depth], ['SINGLE_PANEL', 1.2, 1.2, 0.1], 'a window type with the defaults');
    for (const kind of ['beam', 'footing', 'railing']) assert.ok(writeTools.call(cs, 'define_type', { kind, name: kind, layers: null, predefined_type: null, material: null, material_category: null }).ok, kind);
    assert.ok(writeTools.call(cs, 'define_type', { kind: 'covering', name: 'Golv1', layers: [layer('Ek', 0.014, 'wood', null)], predefined_type: 'FLOORING' }).ok, 'a covering type is layered');
    assert.deepEqual(Object.keys(cs.ops[6]), ['tool', 'kind', 'name', 'layers', 'predefined_type', 'ref'], 'as a slab type is');
    const refused = (args, label) => { const out = writeTools.call(cs, 'define_type', args); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return String(out.error || ''); };
    assert.ok(refused({ kind: 'stair', name: 'T', layers: null, predefined_type: null }, 'a stair type').includes('wall, slab, roof, covering, column, beam, footing, railing, door or window'));
    assert.ok(refused({ kind: 'column', name: 'X', layers: [layer('Stål', 0.3, null, null)], predefined_type: null }, 'a column with layers').includes('no layers'));
    assert.ok(refused({ kind: 'covering', name: 'X', layers: null, predefined_type: null }, 'a covering without layers').includes('layers'));
    assert.ok(refused({ kind: 'beam', name: 'X', layers: null, predefined_type: null, material: 'Trä', material_category: 'timber' }, 'a category outside the list').includes('material_category'));
    assert.ok(refused({ kind: 'beam', name: 'X', layers: null, predefined_type: 'USERDEFINED' }, 'USERDEFINED').includes('USERDEFINED'));
    assert.ok(refused(door({ name: 'X', operation: 'REVOLVING' }), 'a door IfcOpenShell cannot draw').includes('SINGLE_SWING_LEFT'));
    assert.ok(refused(windowType({ name: 'X', partitioning: 'QUADRUPLE' }), 'a partitioning outside the list').includes('SINGLE_PANEL'));
    assert.ok(refused(door({ name: 'X', lining_depth: 0.03 }), 'a lining thinner than 5 cm').includes('lining_depth'));
    assert.ok(refused(door({ name: 'X', width: 0.2 }), 'a door of 20 cm').includes('0.3 to 20 m'));
    assert.ok(refused(door({ name: 'd1' }), 'a door type of the same name').includes('new-2'));
    assert.ok(writeTools.call(cs, 'define_type', windowType({ name: 'D1' })).ok, 'a window type may have a door type\'s name');
    return 'ok';
  });

  test('ai elements: create_opening takes a door or window type, its size and its side, and the wheel and a server get the type', async (assert) => {
    const tool = writeTools.TOOLS.find((x) => x.name === 'create_opening');
    assert.ok('type' in tool.parameters.properties && 'side' in tool.parameters.properties, 'type and side');
    assert.ok(/flush with the wall's left face/.test(tool.description) && /side right turns it around/.test(tool.description) && /hinges at the opening's side nearest the wall's start/.test(tool.description), 'the convention in the tool');
    const cs = writeTools.create('typed-openings');
    assert.ok(writeTools.call(cs, 'create_wall', WALL).ok && writeTools.call(cs, 'define_type', door()).ok && writeTools.call(cs, 'define_type', windowType()).ok);
    const left = writeTools.call(cs, 'create_opening', opening({ type: 'new-2' }));
    assert.ok(left.ok && left.ref === 'new-4', JSON.stringify(left));
    assert.deepEqual(cs.ops[3], { tool: 'create_opening', wall_id: 'new-1', offset: 2, width: 1, height: 2.1, sill: 0, fill: 'door', name: null, type: 'new-2', side: 'left', ref: 'new-4' }, 'the fill and the size from the type');
    assert.ok(writeTools.call(cs, 'create_opening', opening({ offset: 5, width: 1, height: 2.1, fill: 'door', type: 'new-2', side: 'Right' })).ok && cs.ops[4].side === 'right', 'side right');
    assert.ok(writeTools.call(cs, 'create_opening', opening({ offset: 8, sill: 0.9, type: 'new-3' })).ok && cs.ops[5].fill === 'window' && cs.ops[5].width === 1.2, 'a window type');
    const refused = (args, label) => { const out = writeTools.call(cs, 'create_opening', args); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return String(out.error || ''); };
    assert.ok(refused(opening({ type: 'new-2', width: 0.8 }), 'a width other than the type\'s').includes('leave width and height null'));
    assert.ok(refused(opening({ type: 'new-2', fill: 'window' }), 'a door type as a window').includes('fill must be door'));
    assert.ok(refused(opening({ type: 'new-1' }), 'a wall as a type').includes('not a type'));
    assert.ok(refused(opening({ type: 77 }), 'a type of the model without fill').includes('give fill door or window'));
    assert.ok(refused(opening({ type: 'new-2', side: 'inside' }), 'another side').includes('side must be left or right'));
    const theirs = writeTools.call(cs, 'create_opening', opening({ offset: 10, fill: 'door', type: 77 }));
    assert.ok(theirs.ok && cs.ops[6].width === null && cs.ops[6].height === null && cs.ops[6].type === 77, 'a type of the model: the wheel takes its size: ' + JSON.stringify(cs.ops[6]));
    assert.ok(writeTools.call(cs, 'create_opening', opening({ offset: 1, width: null, fill: 'door', side: 'right' })).ok, 'an untyped door as before');
    assert.deepEqual(cs.ops[7], { tool: 'create_opening', wall_id: 'new-1', offset: 1, width: 0.9, height: 2.1, sill: 0, fill: 'door', name: null, ref: 'new-8' }, 'without a type no type, and side is ignored');
    const guids = writeTools.withGuids(writeTools.toWheel(cs), (id) => (id === 77 ? '2O2Fr$t4X7Zf8NOew3FLOH' : null));
    assert.ok(guids[6].type === '2O2Fr$t4X7Zf8NOew3FLOH' && guids[3].type === 'new-2', 'a type of the model goes to a server by its GlobalId, a ref stays a ref');
    return 'ok';
  });

  test('ai elements: the step list describes the elements, the stair, the new types and the typed openings in all seven languages', async (assert) => {
    const cs = writeTools.create('elements-languages');
    for (const [name, args] of STEPS) assert.ok(writeTools.call(cs, name, args).ok, name);
    assert.ok(writeTools.call(cs, 'define_type', door()).ok && writeTools.call(cs, 'define_type', windowType()).ok, 'door and window types');
    assert.ok(writeTools.call(cs, 'create_opening', opening({ type: 'new-12', side: 'right' })).ok);
    const codes = i18n.LANGUAGES.map((x) => x.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = new Map();
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const lines = cs.ops.map((op) => writeTools.describe(op));
        for (const line of lines) assert.ok(line && !/\{\w+\}/.test(line) && !/ai\.change\./.test(line), code + ': every placeholder and key filled: ' + line);
        const [column, beam, footing, covering, stair, rail, typedDoor, typedOpening] = [lines[3], lines[4], lines[5], lines[7], lines[9], lines[10], lines[12], lines[14]];
        assert.ok(column.startsWith('new-3 IfcColumn Pelare A') && column.includes('(3, 4)') && column.endsWith(i18n.t('ai.change.typed', { type: 'new-2' })), code + ': ' + column);
        assert.ok(beam.includes('IfcBeam LINTEL Balk') && beam.includes('6') && beam.includes('90°'), code + ': ' + beam);
        assert.ok(footing.includes('IfcFooting STRIP_FOOTING') && footing.includes('4') && !footing.includes('(null'), code + ': ' + footing);
        assert.ok(covering.includes('0.017'), code + ': the typed covering\'s depth: ' + covering);
        assert.ok(stair.includes('IfcStair') && stair.includes('15') && stair.includes('0.18') && stair.includes('0.25') && stair.includes('1.2'), code + ': ' + stair);
        assert.ok(rail.includes(i18n.t('ai.change.storey.whole')) && rail.endsWith(i18n.t('ai.change.part_of', { whole: 'new-9' })), code + ': the railing in its whole: ' + rail);
        assert.ok(lines[8].endsWith(i18n.t('ai.change.host', { host: 'new-1' })), code + ': the cladding\'s host: ' + lines[8]);
        assert.ok(typedDoor.startsWith('new-12 ' + i18n.t('ai.change.type.door') + ' D1') && typedDoor.includes('SINGLE_SWING_LEFT') && typedDoor.includes('1×2.1'), code + ': ' + typedDoor);
        assert.ok(lines[2].includes(i18n.t('ai.change.type.column')) && lines[2].endsWith(i18n.t('ai.change.define_type.material', { material: 'Stål' })), code + ': the column type and its material: ' + lines[2]);
        assert.ok(typedOpening.includes(i18n.t('ai.change.typed', { type: 'new-12' })) && typedOpening.endsWith(i18n.t('ai.change.side.right')), code + ': the typed door turned around: ' + typedOpening);
        for (const [i, line] of [stair, typedOpening].entries()) { const key = String(i); seen.set(key, (seen.get(key) || new Set()).add(line)); }
      }
      for (const [key, lines] of seen) assert.equal(lines.size, 7, 'seven different texts (' + key + '): ' + Array.from(lines).join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai elements: the build text makes the elements with create_element and types the doors and windows, and the class search points to create_element', async (assert) => {
    for (const [label, text] of [['build', agent.SYSTEM_BUILD], ['change', agent.SYSTEM_CHANGE]]) {
      assert.ok(text.includes('Make columns, beams, members, footings, piles, stairs, railings, coverings and the other building elements without a tool of their own with create_element') && text.includes('never IfcBuildingElementProxy'), label + ': create_element, never a proxy');
    }
    assert.ok(agent.SYSTEM_BUILD.includes('give every door and window its type in create_opening'), 'typed doors and windows');
    assert.ok(/a stair's railing is part_of the stair, and a covering names what it covers as host/.test(agent.SYSTEM_BUILD), 'parts and hosts');
    const search = modelTools.TOOLS.find((x) => x.name === 'search_ifc_class').description;
    assert.ok(/IfcBuildingElementProxy is the last resort/.test(search) && /create_element/.test(search), 'the class search points to create_element');
    return 'ok';
  });

  test('ai elements: Python makes the column, beam, footing, coverings, stair with its flight, landing and railing, and the furniture in an IFC4 model in millimetres', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Elementprov');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const cs = writeTools.create(meta.id);
    for (const [name, args] of STEPS) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
    const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    assert.deepEqual(res.report.notes || [], [], 'nothing left out in IFC4');
    const refs = (res.report.created || []).filter((e) => e.ref).map((e) => [e.ref, e.ifc_class, e.name]);
    assert.deepEqual(refs.slice(1), [['new-2', 'IfcColumnType', 'P1'], ['new-3', 'IfcColumn', 'Pelare A'], ['new-4', 'IfcBeam', 'Balk'], ['new-5', 'IfcFooting', 'Sula'], ['new-6', 'IfcCoveringType', 'Golv1'],
      ['new-7', 'IfcCovering', 'Golv'], ['new-8', 'IfcCovering', 'Panel'], ['new-9', 'IfcStair', 'Trappa'], ['new-10', 'IfcRailing', 'Ledstång'], ['new-11', 'IfcFurniture', 'Bord']], 'the refs the panel gave');
    const { elements: f } = await factsOf(res.bytes, ELEMENTS);
    const col = f['Pelare A'];
    assert.ok(col && col.class === 'IfcColumn' && col.pt === null && col.type === 'P1' && col.type_class === 'IfcColumnType' && col.type_pt === 'COLUMN' && col.material === 'Stål' && col.storey === 'Plan 3', 'the column typed, its material and PredefinedType on the type: ' + JSON.stringify(col));
    assert.deepEqual(col.rep, ['SweptSolid']);
    assert.ok(nearAll(col.box, [2.85, 3.85, 6, 3.15, 4.15, 9]), 'the column 0.3 × 0.3 m at (3, 4), 3 m up from Plan 3 at 6 m: ' + JSON.stringify(col.box));
    assert.ok(f.Balk.pt === 'LINTEL' && nearAll(f.Balk.box, [-0.1, 4, 8.3, 0.1, 10, 8.7]), 'the beam lies along +y from (0, 4), its axis 2.5 m up: ' + JSON.stringify(f.Balk));
    assert.ok(f.Sula.pt === 'STRIP_FOOTING' && nearAll(f.Sula.box, [-0.3, -0.3, 5.4, 12.3, 0.3, 5.8]), 'the strip footing under the wall: ' + JSON.stringify(f.Sula));
    assert.ok(f.Golv.type === 'Golv1' && f.Golv.type_pt === 'FLOORING' && f.Golv.pt === null && near(f.Golv.box[5] - f.Golv.box[2], 0.017), 'the floor covering 17 mm, its layers\'s sum: ' + JSON.stringify(f.Golv));
    assert.ok(f.Panel.pt === 'CLADDING' && f.Panel.covers.join() === 'Syd', 'the cladding covers the wall: ' + JSON.stringify(f.Panel));
    const stair = f.Trappa;
    assert.ok(stair && stair.class === 'IfcStair' && stair.pt === 'STRAIGHT_RUN_STAIR' && stair.storey === 'Plan 3' && stair.rep.length === 0, 'the stair in the storey, its body in its parts: ' + JSON.stringify(stair));
    const flight = f['Trappa 1'];
    assert.ok(flight && flight.class === 'IfcStairFlight' && flight.pt === 'STRAIGHT' && flight.part_of === 'Trappa' && flight.storey === null, 'the flight aggregated in the stair, not contained: ' + JSON.stringify(flight));
    assert.deepEqual(flight.pset, { NumberOfRiser: 15, NumberOfTreads: 14, RiserHeight: 180, TreadLength: 250 }, 'Pset_StairFlightCommon in millimetres');
    assert.deepEqual(flight.counts, [15, 14, 0.18, 0.25], 'and the flight\'s attributes');
    assert.ok(nearAll(flight.box, [7.5, 2, 6, 8.5, 5.5, 8.52]), 'the flight 1 m wide, rising along +y from (8, 2) over 14 treads to the 14th riser\'s top: ' + JSON.stringify(flight.box));
    const landing = f['Trappa 2'];
    assert.ok(landing && landing.class === 'IfcSlab' && landing.pt === 'LANDING' && landing.part_of === 'Trappa' && nearAll(landing.box, [7.5, 5.5, 8.5, 8.5, 6.7, 8.7]), 'the landing at the top, its edge the last riser: ' + JSON.stringify(landing));
    const rail = f['Ledstång'];
    assert.ok(rail && rail.class === 'IfcRailing' && rail.pt === 'HANDRAIL' && rail.part_of === 'Trappa' && rail.storey === null, 'the handrail a part of the stair: ' + JSON.stringify(rail));
    assert.ok(nearAll(rail.frame.origin, [8.55, 2, 6.9]) && nearAll(rail.frame.x, [0, 1, 0]), 'placed through the stair at the storey\'s (8.55, 2), 0.9 m up, along +y: ' + JSON.stringify(rail.frame));
    assert.ok(f.Bord && f.Bord.class === 'IfcFurniture' && f.Bord.pt === 'TABLE', 'the table: ' + JSON.stringify(f.Bord));
    return 'ok';
  }, 900000);

  test('ai elements: Python places typed doors and windows flush with the wall\'s left face, a LEFT door opening toward it with its hinges toward the wall\'s start, turns one around with side right, and takes a type by its GlobalId', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset } = await ifcNew.create({ name: 'Dörrprov', schema: 'IFC4X3_ADD2', storey: 'Plan 3' });
    created.push(dataset.id);
    const cs = writeTools.create(dataset.id);
    const steps = [['create_wall', WALL], ['define_type', door({ material: 'Trä', material_category: 'wood' })], ['define_type', windowType()],
      ['create_opening', opening({ name: 'Vänster', type: 'new-2' })], ['create_opening', opening({ name: 'Höger', offset: 5, type: 'new-2', side: 'right' })],
      ['create_opening', opening({ name: 'Fönster', offset: 8, sill: 0.9, type: 'new-3' })]];
    for (const [name, args] of steps) { const out = writeTools.call(cs, name, args); if (!out.ok) throw new Error(name + ': ' + JSON.stringify(out)); }
    const res = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    assert.deepEqual(res.report.notes || [], [], 'no notes');
    const { fills: f } = await factsOf(res.bytes, FILLS);
    for (const name of ['Vänster', 'Höger', 'Fönster']) {
      const e = f[name];
      assert.ok(e && e.rep.join() === 'MappedRepresentation' && e.pt === null && e.own_operation === null && e.own_partitioning === null, name + ': the type\'s geometry mapped, nothing of its own (OJT001, BLT001, BLT002): ' + JSON.stringify(e));
    }
    const L = f['Vänster'];
    assert.ok(L.type === 'D1' && L.type_class === 'IfcDoorType' && L.type_pt === 'DOOR' && L.operation === 'SINGLE_SWING_LEFT' && nearAll(L.lining, [0.1]) && nearAll(L.size, [1, 2.1]), 'the door type: ' + JSON.stringify(L));
    assert.ok(nearAll(L.frame.origin, [2, 0.05, 0]) && nearAll(L.frame.x, [1, 0, 0]) && nearAll(L.frame.y, [0, 1, 0]), 'its origin 0.1 m inside the wall\'s left face at y 0.15, its axes the wall\'s: ' + JSON.stringify(L.frame));
    assert.ok(nearAll([L.all[0], L.all[1], L.all[2], L.all[3], L.all[5]], [2, 0.05, 0, 3, 2.1]), 'across the opening from 2 to 3, the lining from y 0.05, floor to 2.1: ' + JSON.stringify(L.all));
    assert.ok(nearAll([L.panel[0], L.panel[1], L.panel[3], L.panel[4]], [2.025, 0.115, 2.975, 0.15]), 'the panel flush with the left face, so it opens toward it: ' + JSON.stringify(L.panel));
    assert.ok(L.handles && L.handles[0] > 2.5, 'the handles away from the hinges, so the hinges are at x 2, toward the wall\'s start: ' + JSON.stringify(L.handles));
    assert.ok(near(L.qto.Width, L.size[0] / 1, 1e-3) || near(L.qto.Width, 1000, 1e-3), 'its quantities from the type\'s size: ' + JSON.stringify(L.qto));
    const R = f['Höger'];
    assert.ok(nearAll(R.frame.origin, [6, -0.05, 0]) && nearAll(R.frame.x, [-1, 0, 0]) && nearAll(R.frame.y, [0, -1, 0]), 'side right: turned around at the opening\'s far side: ' + JSON.stringify(R.frame));
    assert.ok(nearAll([R.panel[1], R.panel[3], R.panel[4]], [-0.15, 5.975, -0.115]), 'the panel flush with the right face, the hinges at x 6, toward the wall\'s end: ' + JSON.stringify(R.panel));
    assert.ok(R.handles && R.handles[3] < 5.5, 'the handles toward the wall\'s start: ' + JSON.stringify(R.handles));
    const W = f['Fönster'];
    assert.ok(W.type === 'F1' && W.type_class === 'IfcWindowType' && W.partitioning === 'DOUBLE_PANEL_VERTICAL' && nearAll(W.size, [1.2, 1.2]), 'the window type: ' + JSON.stringify(W));
    assert.ok(nearAll([W.all[0], W.all[2], W.all[3], W.all[5]], [8, 0.9, 9.2, 2.1]) && W.all[1] >= 0.05 - 1e-4 && W.all[4] <= 0.15 + 1e-4, 'the window at sill 0.9 within the lining at the left face: ' + JSON.stringify(W.all));
    // The written model as a model of its own: a second change set adds a door of the type by its GlobalId, without a size.
    const typeGuid = (res.report.created || []).find((e) => e.ifc_class === 'IfcDoorType' && e.name === 'D1');
    const wallGuid = (res.report.created || []).find((e) => e.ifc_class === 'IfcWall' && e.name === 'Syd');
    assert.ok(typeGuid && wallGuid, 'the type and the wall among the created');
    const again = await importer.run(new File([res.bytes], 'dorrprov-2.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Dörrprov 2');
    created.push(again.id);
    const cs2 = writeTools.create(again.id);
    assert.ok(writeTools.call(cs2, 'create_opening', opening({ wall_id: wallGuid.guid, offset: 10.5, fill: 'door', name: 'Igen', type: typeGuid.guid })).ok);
    const second = await ifcOps.previewChangeset(again.id, writeTools.toWheel(cs2));
    assert.equal(second.report.errors, 0, 'no errors the second time: ' + JSON.stringify(second.report.findings));
    const { fills: g } = await factsOf(second.bytes, FILLS);
    assert.ok(g.Igen && g.Igen.type === 'D1' && nearAll(g.Igen.size, [1, 2.1]) && nearAll(g.Igen.frame.origin, [10.5, 0.05, 0]), 'the size from the type\'s doors and the depth from its lining: ' + JSON.stringify(g.Igen));
    return 'ok';
  }, 900000);

  test('ai elements: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
