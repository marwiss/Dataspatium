// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for create_spaces, the write tool that makes the rooms the walls enclose into IfcSpace (decision B-57.1, Dataregium's F37 a):
 * a call with listed rooms lands as one step with a ref per room after the earlier creates, the checks refuse what the wheel could not
 * place, rooms null gets no refs and the person's word for a room, remove_last gives the refs back, and the description names the
 * rooms in all seven languages. With the real Pyodide (`?python=1` or cached components) the wheel builds a 12 × 8 m box with an inner
 * wall and a door in it on the fixture model, names the rooms Kök and Vardagsrum by a point inside each, and the preview has the two
 * spaces among the created, a boundary from each to its four walls and to the door (external where the wall is), and no schema error.
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
    assert.deepEqual(tool.parameters.properties.rooms.items.required, ['at', 'index', 'name', 'long_name'], 'every field of a room is required, null for not given');
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
    // The space boundaries as the file has them: RelatingSpace, RelatedBuildingElement, PHYSICAL, INTERNAL or EXTERNAL.
    const text = new TextDecoder().decode(preview.bytes);
    const found = Array.from(text.matchAll(/^#\d+=IFCRELSPACEBOUNDARY\('[^']*',(?:#\d+|\$),(?:\$|'[^']*'),(?:\$|'[^']*'),#(\d+),#(\d+),(?:\$|#\d+),\.(\w+)\.,\.(\w+)\.\);$/gm))
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

  test('ai spaces: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
