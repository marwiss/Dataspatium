// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for create_spaces, the write tool that makes the rooms the walls enclose into IfcSpace (decision B-57.1, Dataregium's F37 a):
 * a call with listed rooms lands as one step with a ref per room after the earlier creates, the checks refuse what the wheel could not
 * place, rooms null gets no refs and the person's word for a room, remove_last gives the refs back, and the description names the
 * rooms in all seven languages. With the real Pyodide (`?python=1` or cached components) the wheel builds a 12 × 8 m box with an inner
 * wall and a door in it on the fixture model, names the rooms Kök and Vardagsrum by a point inside each, and the preview has the two
 * spaces among the created, a boundary from each to its four walls and to the door (external where the wall is), and no schema error.
 * The boundaries are first level with their faces (PLAN.md item 5): in IFC4X3, IFC4 and IFC2X3 every one has an IfcCurveBoundedPlane in
 * the space's coordinates whose area is the wall's face inside the room between the floor's top and the ceiling's underside (the door's
 * and the window's their openings', the slabs' the outline inside the walls), which IfcOpenShell's kernel builds and whose normal points
 * away from the room; a wall made after the rooms bounds them with its door and opening, and a deleted wall's boundaries go with it while
 * the others keep their GlobalIds.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const i18n = D.require('ui/i18n');
  const writeTools = D.require('ai/write-tools');
  const agent = D.require('ai/agent');
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
  const WALLS = [['Syd', [0, 0], [12, 0]], ['Öst', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]], ['Väst', [0, 8], [0, 0]], ['Mitt', [6, 0], [6, 8]]];
  const ROOMS = [{ at: [3, 4], index: null, name: 'Kök', long_name: null }, { at: [9, 4], index: null, name: 'Vardagsrum', long_name: 'Vardagsrum med matplats' }];
  /** A change set with the box, the inner wall and a door in it (refs new-1 to new-6), then the rooms by point. */
  function box(datasetId) {
    const cs = writeTools.create(datasetId);
    writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: { x_spacing: 6, x_count: 2, y_spacing: 8, y_count: 1 } });
    for (const [name, start, end] of WALLS) writeTools.call(cs, 'create_wall', { storey: 'Plan 3', start, end, thickness: 0.2, height: 3, name });
    writeTools.call(cs, 'create_opening', { wall_id: 'new-5', offset: 3, width: 0.9, height: 2.1, sill: 0, fill: 'door', name: 'Dörr' });
    return { cs, out: writeTools.call(cs, 'create_spaces', { storey: 'Plan 3', rooms: ROOMS, height: null }) };
  }

  test('ai spaces: create_spaces lands as one step with a ref per listed room, rooms null gets none, and remove_last gives the refs back', async (assert) => {
    assert.ok(writeTools.has('create_spaces') && writeTools.CREATES.includes('create_spaces'), 'a write tool that creates');
    const tool = writeTools.TOOLS.find((x) => x.name === 'create_spaces');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['storey', 'rooms', 'height']);
    assert.deepEqual(tool.parameters.properties.rooms.items.required, ['at', 'index', 'name', 'long_name', 'number', 'room_type'], 'every field of a room is required, null for not given (number and room_type: tests/ai-names.test.js)');
    const { cs, out } = box('spaces-test');
    assert.ok(out.ok && !out.ref, JSON.stringify(out));
    assert.deepEqual(out.refs, ['new-7', 'new-8'], 'one ref per room, after the walls and the door');
    assert.equal(cs.refs, 8);
    assert.deepEqual(cs.ops[7], { tool: 'create_spaces', storey: 'Plan 3', rooms: ROOMS, height: null, default_name: null, refs: ['new-7', 'new-8'] });
    assert.ok(writeTools.call(cs, 'set_properties', { ids: ['new-8'], pset: 'Pset_SpaceCommon', properties: [{ name: 'IsExternal', value: false }] }).ok, 'a later step names a space by its ref');
    assert.ok(writeTools.toWheel(cs).every((op) => !('ref' in op) && !('refs' in op)), 'the wheel counts the refs itself');
    assert.equal(writeTools.call(cs, 'manage_changeset', { action: 'list' }).steps[7].ref, 'new-7, new-8');
    writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }); writeTools.call(cs, 'manage_changeset', { action: 'remove_last' });
    assert.equal(cs.refs, 6, 'removing the step gives both refs back');
    const all = writeTools.call(cs, 'create_spaces', { storey: null, rooms: null, height: 2.6 });
    assert.ok(all.ok && !all.refs && cs.refs === 6, 'every room: no refs: ' + JSON.stringify(all));
    assert.equal(cs.ops[7].default_name, t('ai.change.spaces.name'), 'the person\'s word for a room, with {n} for the wheel');
    assert.ok(cs.ops[7].default_name.includes('{n}'));
    assert.ok(/create_spaces after the walls and before the slabs\./.test(agent.SYSTEM_BUILD), 'the build text says when');
    return 'ok';
  });

  test('ai spaces: create_spaces refuses rooms it could not place: an empty list, neither or both of at and index, no name, a bad index, rooms without a storey', async (assert) => {
    const room = (o) => Object.assign({ at: null, index: null, name: 'A', long_name: null }, o);
    const refused = (args, label) => { const cs = writeTools.create('x'); const out = writeTools.call(cs, 'create_spaces', Object.assign({ storey: 'Plan 1', rooms: null, height: null }, args)); assert.ok(out.error && cs.ops.length === 0, label + ': ' + JSON.stringify(out)); return out.error || ''; };
    assert.ok(refused({ rooms: [] }, 'an empty list').includes('rooms must be a list'));
    assert.ok(refused({ rooms: [room({})] }, 'neither').includes('needs either at'));
    assert.ok(refused({ rooms: [room({ at: [1, 1], index: 1 })] }, 'both').includes('needs either at'));
    assert.ok(refused({ rooms: [room({ at: [1, 1], name: null })] }, 'no name').includes('needs a name'));
    assert.ok(refused({ rooms: [room({ index: 0 })] }, 'index 0').includes('whole number from 1'));
    assert.ok(refused({ rooms: [room({ index: 2 }), room({ index: 2 })] }, 'an index twice').includes('listed twice'));
    assert.ok(refused({ rooms: [room({ at: [1] })] }, 'a point with one number').includes('[x, y]'));
    assert.ok(refused({ storey: null, rooms: [room({ index: 1 })] }, 'rooms without a storey').includes('name the storey'));
    assert.ok(refused({ height: -1 }, 'a negative height').includes('height'));
    return 'ok';
  });

  test('ai spaces: the description names the rooms in all seven languages', async (assert) => {
    const { cs } = box('spaces-languages');
    const every = { tool: 'create_spaces', storey: null, rooms: null, height: 2.5, default_name: null, refs: [] };
    const codes = i18n.LANGUAGES.map((l) => l.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const listed = []; const all = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const text = writeTools.describe(cs.ops[7]);
        assert.ok(text.includes('new-7') && text.includes('new-8') && text.includes('Kök') && text.includes('Vardagsrum') && text.includes('Plan 3') && text.includes('(3, 4)'), code + ': ' + text);
        const each = writeTools.describe(every);
        assert.ok(each.includes(t('ai.change.spaces.name', { n: 1 })) && each.includes('2.5'), code + ': ' + each);
        for (const s of [text, each]) assert.ok(!/\{\w+\}/.test(s), code + ': every placeholder filled: ' + s);
        listed.push(text); all.push(each);
      }
      // Bokmål and nynorsk may say the short form alike ("Rom i Plan 3: Kök ved (3, 4)"); the long one differs in every language.
      assert.ok(new Set(listed).size >= 6 && new Set(all).size === 7, 'translated texts: ' + listed.concat(all).join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai spaces: Python makes the rooms of a 12 × 8 m box with an inner wall and a door into Kök and Vardagsrum, with boundaries to the walls and the door', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Rumsprov');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { cs, out } = box(meta.id);
    assert.ok(out.ok, JSON.stringify(out));
    const preview = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    const report = preview.report;
    assert.equal(report.errors, 0, 'no schema errors: ' + JSON.stringify(report.findings));
    const byClass = (cls) => (report.created || []).filter((e) => e.ifc_class === cls);
    const spaces = byClass('IfcSpace');
    assert.deepEqual(spaces.map((e) => [e.name, e.ref, e.storey]), [['Kök', 'new-7', 'Plan 3'], ['Vardagsrum', 'new-8', 'Plan 3']], 'the two spaces with the refs the panel gave');
    const wall = {};
    for (const e of byClass('IfcWall')) wall[e.name] = e.id;
    const door = byClass('IfcDoor')[0];
    assert.ok(door && door.ref === 'new-6', 'the door: ' + JSON.stringify(byClass('IfcDoor')));
    // The space boundaries as the file has them (first level, IFC4: IfcRelSpaceBoundary1stLevel with its ParentBoundary last):
    // RelatingSpace, RelatedBuildingElement, PHYSICAL, INTERNAL or EXTERNAL.
    const text = new TextDecoder().decode(preview.bytes);
    const found = Array.from(text.matchAll(/^#\d+=IFCRELSPACEBOUNDARY1STLEVEL\('[^']*',(?:#\d+|\$),(?:\$|'[^']*'),(?:\$|'[^']*'),#(\d+),#(\d+),(?:\$|#\d+),\.(\w+)\.,\.(\w+)\.,(?:\$|#\d+)\);$/gm))
      .map((m) => ({ space: Number(m[1]), element: Number(m[2]), physical: m[3], side: m[4] }));
    assert.equal(found.length, 10, 'five boundaries per room: ' + JSON.stringify(found));
    const of = (space) => found.filter((b) => b.space === space.id).map((b) => [b.element, b.side]).sort((a, b) => a[0] - b[0]);
    const expect = (names, inside) => names.map((n) => [n === 'door' ? door.id : wall[n], inside.includes(n) ? 'INTERNAL' : 'EXTERNAL']).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(of(spaces[0]), expect(['Syd', 'Norr', 'Väst', 'Mitt', 'door'], ['Mitt', 'door']), 'Kök: its four walls and the door, external where the wall is');
    assert.deepEqual(of(spaces[1]), expect(['Syd', 'Norr', 'Öst', 'Mitt', 'door'], ['Mitt', 'door']), 'Vardagsrum: its four walls and the door');
    assert.ok(found.every((b) => b.physical === 'PHYSICAL'), 'physical boundaries');
    assert.ok(text.includes("'Qto_SpaceBaseQuantities'") && text.includes("IFCQUANTITYAREA('NetFloorArea'"), 'the rooms\' quantities');
    assert.ok(text.includes('IFCRELAGGREGATES(') && /IFCSPACE\('[^']*',#\d+,'K\\X2\\00F6\\X0\\k',\$,\$,#\d+,#\d+,\$,\.ELEMENT\.,\.INTERNAL\./.test(text), 'Kök as an internal space of composition ELEMENT');
    return 'ok';
  }, 900000);

  const stdoutOf = (out) => out.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  const near = (a, b, eps = 1e-4) => typeof a === 'number' && Math.abs(a - b) <= eps;
  /** Every space boundary of a written IFC, read back with IfcOpenShell in the app's Python: its class, Name, space, element (names; the
   * door, window and opening are named by the test), PhysicalOrVirtual, InternalOrExternal, the parent's element and GlobalId, and of its
   * face (an IfcCurveBoundedPlane in the space's coordinates) the polylines' dimension, whether the outer one closes on its own first
   * point and runs counter-clockwise about the plane's normal, the area less the holes (m²), the bounding box of the corners in the world
   * through the space's placement and the normal in the world, the plane's height in the space's coordinates (m), and the area of the mesh
   * IfcOpenShell's geometry kernel makes of the face. Also the counts of connection geometries and bounded planes in the file. */
  async function boundariesOf(bytes) {
    await bridge.writeFile('/data/step/spaces-bounds.ifc', bytes.slice());  // the engine transfers, and a browser detaches, the buffer
    const out = await bridge.run([
      'import json', 'import ifcopenshell', 'import ifcopenshell.geom', 'import ifcopenshell.util.unit', 'import ifcopenshell.util.placement as pl',
      'm = ifcopenshell.open("/data/step/spaces-bounds.ifc")', 'scale = ifcopenshell.util.unit.calculate_unit_scale(m)',
      'matrix = getattr(pl, "get_placement", None) or pl.get_local_placement',  // get_placement since IfcOpenShell 0.9.1
      'settings = ifcopenshell.geom.settings()',
      'def signed(pts):',
      '    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2',
      'def mesh_area(item):',
      '    try:',
      '        shape = ifcopenshell.geom.create_shape(settings, item)',
      '    except Exception as exc:',
      '        return str(exc)',
      '    v, f = list(shape.verts), list(shape.faces)',
      '    total = 0.0',
      '    for k in range(0, len(f), 3):',
      '        a, b, c = [v[3 * f[k + j]:3 * f[k + j] + 3] for j in range(3)]',
      '        u = [b[i] - a[i] for i in range(3)]',
      '        w = [c[i] - a[i] for i in range(3)]',
      '        n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]',
      '        total += sum(x * x for x in n) ** 0.5 / 2',
      '    return round(total, 4)',
      'rows = []',
      'for b in m.by_type("IfcRelSpaceBoundary"):',
      '    sp = b.RelatingSpace',
      '    parent = getattr(b, "ParentBoundary", None)',
      '    rec = {"cls": b.is_a(), "name": b.Name, "guid": b.GlobalId, "space": sp.Name, "el": b.RelatedBuildingElement.Name, "pv": b.PhysicalOrVirtualBoundary,',
      '           "side": b.InternalOrExternalBoundary, "parent": parent.RelatedBuildingElement.Name if parent else None, "parent_guid": parent.GlobalId if parent else None}',
      '    g = b.ConnectionGeometry',
      '    if g is not None and g.is_a("IfcConnectionSurfaceGeometry") and g.SurfaceOnRelatingElement.is_a("IfcCurveBoundedPlane"):',
      '        s = g.SurfaceOnRelatingElement',
      '        P = s.BasisSurface.Position',
      '        o = [float(c) for c in P.Location.Coordinates]',
      '        z = [float(c) for c in P.Axis.DirectionRatios]',
      '        x = [float(c) for c in P.RefDirection.DirectionRatios]',
      '        y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]',
      '        ring = s.OuterBoundary.Points',
      '        outer = [[float(c) for c in p.Coordinates] for p in ring]',
      '        inner = [[[float(c) for c in p.Coordinates] for p in c.Points][:-1] for c in s.InnerBoundaries]',
      '        M = matrix(sp.ObjectPlacement)',
      '        world = []',
      '        for u, v in outer[:-1]:',
      '            q = [o[i] + u * x[i] + v * y[i] for i in range(3)]',
      '            world.append([(sum(M[r][c] * q[c] for c in range(3)) + M[r][3]) * scale for r in range(3)])',
      '        rec.update({"dim": len(outer[0]), "closed": ring[0].id() == ring[-1].id(), "ccw": signed(outer[:-1]) > 0,',
      '                    "area": round((abs(signed(outer[:-1])) - sum(abs(signed(h)) for h in inner)) * scale * scale, 6),',
      '                    "box": [round(f(w[i] for w in world), 4) + 0.0 for i in range(3) for f in (min, max)],',
      '                    "normal": [round(sum(M[r][c] * z[c] for c in range(3)), 6) + 0.0 for r in range(3)], "local_z": round(o[2] * scale, 4), "mesh": mesh_area(s)})',
      '    rows.append(rec)',
      'print(json.dumps({"rows": rows, "geometries": len(m.by_type("IfcConnectionSurfaceGeometry")), "planes": len(m.by_type("IfcCurveBoundedPlane"))}))',
    ].join('\n'));
    const error = out.entries.find((e) => e.kind === 'error');
    if (error) throw new Error(String(error.text));
    return JSON.parse(stdoutOf(out).trim().split('\n').pop() || 'null');
  }
  const OUTLINE = [[-0.1, -0.1], [12.1, -0.1], [12.1, 8.1], [-0.1, 8.1]];
  /** The box on Plan 3 (6 m) under Plan 4 (9 m) of a new model: the walls new-1 to new-5, a door in Mitt and a window in Syd, the rooms
   * Kök and Vardagsrum, the floor on Plan 3 and the ceiling on Plan 4 (0.25 m, so its underside at 8.75 m). */
  function boxWithSlabs(datasetId) {
    const cs = writeTools.create(datasetId);
    writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }, { name: 'Plan 4', elevation: 9 }], grid: null });
    for (const [name, start, end] of WALLS) writeTools.call(cs, 'create_wall', { storey: 'Plan 3', start, end, thickness: 0.2, height: 3, name });
    writeTools.call(cs, 'create_opening', { wall_id: 'new-5', offset: 3, width: 0.9, height: 2.1, sill: 0, fill: 'door', name: 'Dörr' });
    writeTools.call(cs, 'create_opening', { wall_id: 'new-1', offset: 2, width: 1.2, height: 1.2, sill: 0.9, fill: 'window', name: 'Fönster' });
    writeTools.call(cs, 'create_spaces', { storey: 'Plan 3', rooms: ROOMS, height: null });
    writeTools.call(cs, 'create_slab', { storey: 'Plan 3', outline: OUTLINE, thickness: 0.25, name: 'Golv' });
    writeTools.call(cs, 'create_slab', { storey: 'Plan 4', outline: OUTLINE, thickness: 0.25, name: 'Tak' });
    return cs;
  }

  test('ai spaces: Python gives every boundary its face in the space\'s coordinates in IFC4X3, IFC4 and IFC2X3: the walls\' faces between the floor and the ceiling, the door, the window and the slabs, with their areas', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const h = 8.75 - 6;  // from the floor's top to the ceiling's underside; the walls reach 9 m, into the ceiling slab
    // Per room and element: the area (m²), the world box [x0, x1, y0, y1, z0, z1], the world normal (away from the room), the side.
    const KOK = {
      'Syd': [5.8 * h, [0.1, 5.9, 0.1, 0.1, 6, 8.75], [0, -1, 0], 'EXTERNAL'], 'Norr': [5.8 * h, [0.1, 5.9, 7.9, 7.9, 6, 8.75], [0, 1, 0], 'EXTERNAL'],
      'Väst': [7.8 * h, [0.1, 0.1, 0.1, 7.9, 6, 8.75], [-1, 0, 0], 'EXTERNAL'], 'Mitt': [7.8 * h, [5.9, 5.9, 0.1, 7.9, 6, 8.75], [1, 0, 0], 'INTERNAL'],
      'Dörr': [0.9 * 2.1, [5.9, 5.9, 3, 3.9, 6, 8.1], [1, 0, 0], 'INTERNAL', 'Mitt'], 'Fönster': [1.2 * 1.2, [2, 3.2, 0.1, 0.1, 6.9, 8.1], [0, -1, 0], 'EXTERNAL', 'Syd'],
      'Golv': [5.8 * 7.8, [0.1, 5.9, 0.1, 7.9, 6, 6], [0, 0, -1], 'INTERNAL'], 'Tak': [5.8 * 7.8, [0.1, 5.9, 0.1, 7.9, 8.75, 8.75], [0, 0, 1], 'INTERNAL'],
    };
    const VARDAGSRUM = {
      'Syd': [5.8 * h, [6.1, 11.9, 0.1, 0.1, 6, 8.75], [0, -1, 0], 'EXTERNAL'], 'Norr': [5.8 * h, [6.1, 11.9, 7.9, 7.9, 6, 8.75], [0, 1, 0], 'EXTERNAL'],
      'Öst': [7.8 * h, [11.9, 11.9, 0.1, 7.9, 6, 8.75], [1, 0, 0], 'EXTERNAL'], 'Mitt': [7.8 * h, [6.1, 6.1, 0.1, 7.9, 6, 8.75], [-1, 0, 0], 'INTERNAL'],
      'Dörr': [0.9 * 2.1, [6.1, 6.1, 3, 3.9, 6, 8.1], [-1, 0, 0], 'INTERNAL', 'Mitt'],
      'Golv': [5.8 * 7.8, [6.1, 11.9, 0.1, 7.9, 6, 6], [0, 0, -1], 'INTERNAL'], 'Tak': [5.8 * 7.8, [6.1, 11.9, 0.1, 7.9, 8.75, 8.75], [0, 0, 1], 'INTERNAL'],
    };
    for (const schema of ['IFC4X3_ADD2', 'IFC4', 'IFC2X3']) {
      const { dataset } = await ifcNew.create({ name: 'Rumsgränser ' + schema, schema, storey: 'Plan 1' });
      created.push(dataset.id);
      const preview = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(boxWithSlabs(dataset.id)));
      assert.equal(preview.report.errors, 0, schema + ': no schema errors: ' + JSON.stringify(preview.report.findings));
      assert.ok(!(preview.report.notes || []).some((n) => /boundar/.test(n)), schema + ': no note on the boundaries: ' + JSON.stringify(preview.report.notes));
      const facts = await boundariesOf(preview.bytes);
      const rows = facts.rows;
      assert.equal(rows.length, 15, schema + ': eight boundaries of Kök and seven of Vardagsrum: ' + JSON.stringify(rows.map((r) => [r.space, r.el])));
      assert.ok(facts.geometries === 15 && facts.planes === 15, schema + ': one face per boundary, none left over: ' + JSON.stringify([facts.geometries, facts.planes]));
      const first = schema !== 'IFC2X3';
      for (const [room, expected] of [['Kök', KOK], ['Vardagsrum', VARDAGSRUM]]) {
        const mine = rows.filter((r) => r.space === room);
        assert.deepEqual(mine.map((r) => r.el).sort(), Object.keys(expected).sort(), schema + ' ' + room + ': its walls, door, window and slabs');
        for (const r of mine) {
          const [area, box, normal, side, parent] = expected[r.el];
          const label = schema + ' ' + room + ' ' + r.el + ': ';
          assert.equal(r.cls, first ? 'IfcRelSpaceBoundary1stLevel' : 'IfcRelSpaceBoundary', label + 'first level');
          if (!first) assert.equal(r.name, '1stLevel', label + 'IFC2X3 names the level');
          assert.ok(r.pv === 'PHYSICAL' && r.side === side, label + JSON.stringify([r.pv, r.side]));
          assert.ok(r.dim === 2 && r.closed && r.ccw, label + 'a closed 2D outline on its own first point, counter-clockwise about the normal: ' + JSON.stringify(r));
          assert.ok(near(r.area, area), label + 'the area of the face ' + r.area + ' m², not ' + area);
          assert.ok(near(r.mesh, area, 1e-3), label + 'IfcOpenShell\'s kernel builds the face: ' + r.mesh);
          assert.ok(r.box.every((v, i) => near(v, box[i])), label + 'in the world through the space\'s placement: ' + JSON.stringify(r.box) + ' not ' + JSON.stringify(box));
          assert.deepEqual(r.normal, normal, label + 'the normal points away from the room');
          assert.equal(r.parent, first ? (parent || null) : null, label + 'the wall the door or window lies in (IFC4 and later)');
        }
        // The plane lies in the space's coordinates, which start at the storey's 6 m: the floor at 0 there, the ceiling at 2.75.
        assert.ok(near(mine.find((r) => r.el === 'Golv').local_z, 0) && near(mine.find((r) => r.el === 'Tak').local_z, h), schema + ' ' + room + ': in the space\'s coordinates');
        const walls = mine.filter((r) => !['Dörr', 'Fönster', 'Golv', 'Tak'].includes(r.el)).reduce((s, r) => s + r.area, 0);
        assert.ok(near(walls, 2 * (5.8 + 7.8) * h), schema + ' ' + room + ': the walls\' faces are the outline inside the walls times the height: ' + walls);
      }
    }
    return 'ok';
  }, 900000);

  test('ai spaces: Python bounds the rooms by a wall made after them, with its door and an opening, and removes a wall\'s boundaries with it', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset } = await ifcNew.create({ name: 'Senare vägg', schema: 'IFC4X3_ADD2', storey: 'Plan 1' });
    created.push(dataset.id);
    const cs = writeTools.create(dataset.id);
    for (const [name, start, end] of WALLS) writeTools.call(cs, 'create_wall', { storey: 'Plan 1', start, end, thickness: 0.2, height: 3, name });
    writeTools.call(cs, 'create_opening', { wall_id: 'new-5', offset: 3, width: 0.9, height: 2.1, sill: 0, fill: 'door', name: 'Dörr' });
    writeTools.call(cs, 'create_spaces', { storey: 'Plan 1', rooms: ROOMS, height: null });
    const first = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
    assert.equal(first.report.errors, 0, 'no errors: ' + JSON.stringify(first.report.findings));
    const before = (await boundariesOf(first.bytes)).rows;
    assert.equal(before.length, 10, 'the walls and the door bound both rooms: ' + JSON.stringify(before.map((r) => [r.space, r.el])));
    const mitt = first.report.created.find((e) => e.name === 'Mitt');
    const guidOf = (rows, room, el) => (rows.find((r) => r.space === room && r.el === el) || {}).guid;

    // Deleting the inner wall takes its boundaries and its door's with it; the others stay as they were.
    const second = await importer.run(new File([first.bytes], 'senare-vagg-2.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Senare vägg 2');
    created.push(second.id);
    const del = writeTools.create(second.id);
    assert.ok(writeTools.call(del, 'delete_elements', { ids: [mitt.guid], confirm: true }).ok);
    const removed = await ifcOps.previewChangeset(second.id, writeTools.toWheel(del));
    assert.equal(removed.report.errors, 0, 'no errors after the delete: ' + JSON.stringify(removed.report.findings));
    const without = await boundariesOf(removed.bytes);
    assert.deepEqual(without.rows.map((r) => r.space + ' ' + r.el).sort(), ['Kök Norr', 'Kök Syd', 'Kök Väst', 'Vardagsrum Norr', 'Vardagsrum Syd', 'Vardagsrum Öst'], 'no boundary to the wall or its door');
    assert.ok(without.geometries === 6 && without.planes === 6, 'their faces went too: ' + JSON.stringify([without.geometries, without.planes]));
    assert.ok(without.rows.every((r) => r.guid === guidOf(before, r.space, r.el)), 'the other boundaries keep their GlobalIds');
    const syd = without.rows.find((r) => r.space === 'Kök' && r.el === 'Syd');
    assert.ok(near(syd.area, 5.9 * 3) && near(syd.box[1], 6), 'the south wall\'s face in Kök now reaches the room\'s edge where the wall stood: ' + JSON.stringify(syd));

    // A wall made after the rooms, with a door and an opening without one, bounds both rooms on the faces toward each.
    const third = await importer.run(new File([removed.bytes], 'senare-vagg-3.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Senare vägg 3');
    created.push(third.id);
    const add = writeTools.create(third.id);
    writeTools.call(add, 'create_wall', { storey: 'Plan 1', start: [6, 0], end: [6, 8], thickness: 0.2, height: 3, name: 'Ny' });
    writeTools.call(add, 'create_opening', { wall_id: 'new-1', offset: 5, width: 1, height: 2.1, sill: 0, fill: 'door', name: 'Ny dörr' });
    writeTools.call(add, 'create_opening', { wall_id: 'new-1', offset: 1, width: 0.8, height: 2, sill: 0, fill: null, name: 'Hål' });
    const later = await ifcOps.previewChangeset(third.id, writeTools.toWheel(add));
    assert.equal(later.report.errors, 0, 'no errors: ' + JSON.stringify(later.report.findings));
    const rows = (await boundariesOf(later.bytes)).rows;
    for (const [room, x, normal] of [['Kök', 5.9, [1, 0, 0]], ['Vardagsrum', 6.1, [-1, 0, 0]]]) {
      const ny = rows.find((r) => r.space === room && r.el === 'Ny');
      assert.ok(ny && near(ny.area, 7.8 * 3) && near(ny.box[0], x) && near(ny.box[1], x) && near(ny.box[2], 0.1) && near(ny.box[3], 7.9), room + ': the new wall\'s face: ' + JSON.stringify(ny));
      assert.ok(ny.side === 'INTERNAL' && ny.pv === 'PHYSICAL' && JSON.stringify(ny.normal) === JSON.stringify(normal), room + ': ' + JSON.stringify(ny));
      const door = rows.find((r) => r.space === room && r.el === 'Ny dörr');
      assert.ok(door && near(door.area, 2.1) && door.pv === 'PHYSICAL' && door.parent_guid === ny.guid && near(door.box[2], 5) && near(door.box[3], 6), room + ': the door in its face: ' + JSON.stringify(door));
      const hole = rows.find((r) => r.space === room && r.el === 'Hål');
      assert.ok(hole && near(hole.area, 1.6) && hole.pv === 'VIRTUAL' && hole.parent_guid === ny.guid, room + ': the opening as a virtual boundary of the IfcOpeningElement: ' + JSON.stringify(hole));
      for (const el of room === 'Kök' ? ['Syd', 'Norr', 'Väst'] : ['Syd', 'Norr', 'Öst']) {
        assert.equal(guidOf(rows, room, el), guidOf(before, room, el), room + ' ' + el + ': the boundary keeps its GlobalId');
      }
    }
    assert.equal(rows.length, 12, 'three walls and the new wall, its door and its opening per room: ' + JSON.stringify(rows.map((r) => [r.space, r.el])));
    return 'ok';
  }, 900000);

  test('ai spaces: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
