// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the building's topology (decision F46 a). With the wheel stubbed: the agent's preview summary carries the topology per
 * storey with walls (rooms, closed, open ends with at most five coordinates, external walls counted by facing), the read tool
 * get_topology answers an error and starts nothing while Python does not run, and the card Topologi in Kontrollera draws a result
 * and an error. With the real Pyodide (`?python=1` or cached components) the wheel computes it: a 12 × 8 m box with an inner wall
 * on the fixture model is one closed storey of two neighbouring rooms with external walls facing S, E, N and W, the box without its
 * west wall is open with two open ends, and the fixture's own walls, which have no Axis, are read from their footprint.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const agent = D.require('ai/agent');
  const tools = D.require('ai/model-tools');
  const writeTools = D.require('ai/write-tools');
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
  /** A topology as the wheel answers it: a closed storey, an open one with six open ends and an unread wall, and one without walls. */
  const CLOSED = { storey: 'Plan 3', elevation: 6, closed: true, walls: 5, unread: 0, tolerance: 0.15, north: 'model', dangles: [],
    rooms: [{ index: 1, area: 48, perimeter: 28, walls: [11, 13, 14, 15], neighbours: [2] }, { index: 2, area: 48, perimeter: 28, walls: [11, 12, 13, 15], neighbours: [1] }],
    external: [{ wall: 13, guid: 'g13', name: 'Norr', facing: 'N', length: 12 }, { wall: 12, guid: 'g12', name: 'Öst', facing: 'E', length: 8 }, { wall: 11, guid: 'g11', name: 'Syd', facing: 'S', length: 12 }, { wall: 14, guid: 'g14', name: 'Väst', facing: 'W', length: 8 }] };
  const OPEN = { storey: 'Plan 4', elevation: 9, closed: false, walls: 3, unread: 1, tolerance: 0.15, north: 'model', rooms: [], external: [], dangles: [[0, 0], [0, 8], [1, 1], [2, 2], [3, 3], [4, 4]] };
  const BARE = { storey: 'Tak', elevation: 12, closed: false, walls: 0, unread: 0, tolerance: 0.15, north: 'model', rooms: [], external: [], dangles: [] };
  const TOPOLOGY = [CLOSED, OPEN, BARE];
  let model = null;
  async function theModel() {
    if (!model) { model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Topologi'); created.push(model.id); }
    return model;
  }

  test('topology: the agent\'s preview summary carries the topology of each storey with walls, and the build text says to mend open ends', async (assert) => {
    const ds = await theModel();
    const cs = writeTools.create(ds.id);
    assert.ok(writeTools.call(cs, 'create_wall', { storey: 'Plan 1', start: [0, 0], end: [12, 0], thickness: 0.2, height: 3, name: 'Syd' }).ok);
    const real = bridge.runIfcChangeset; const state = bridge.state;
    let topology = TOPOLOGY;
    bridge.runIfcChangeset = async () => ({ bytes: new Uint8Array(4), info: { created: [{ id: 900, ifc_class: 'IfcWall', storey: 'Plan 1' }], changed: [], deleted: [], findings: [], errors: 0, topology }, log: [] });
    try {
      bridge.state = 'ready';
      const out = await agent.previewFor(ds.id, cs);
      assert.equal(out.errors, 0); assert.equal(out.created, 1);
      assert.ok(Array.isArray(out.topology) && out.topology.length === 2, 'the storeys with walls: ' + JSON.stringify(out.topology));
      assert.deepEqual(out.topology[0], { storey: 'Plan 3', rooms: 2, closed: true, dangles: 0, open_ends: [], external: { N: 1, E: 1, S: 1, W: 1 } });
      assert.deepEqual(out.topology[1], { storey: 'Plan 4', rooms: 0, closed: false, dangles: 6, open_ends: [[0, 0], [0, 8], [1, 1], [2, 2], [3, 3]], external: {}, unread: 1 }, 'five open ends at most');
      const text = JSON.stringify(out);
      assert.ok(text.includes('"topology":[{"storey":"Plan 3","rooms":2,"closed":true') && text.includes('"dangles":6'), 'the summary the agent reads: ' + text);
      topology = { error: 'the topology reads at most 2000 walls; there are 2400' };
      assert.deepEqual((await agent.previewFor(ds.id, cs)).topology, { error: 'the topology reads at most 2000 walls; there are 2400' }, 'an error stays an error');
      topology = [];
      assert.ok(!('topology' in (await agent.previewFor(ds.id, cs))), 'no storey with walls touched: no topology');
    } finally { bridge.runIfcChangeset = real; bridge.state = state; }
    assert.ok(/preview's topology says whether the storey is closed; mend open ends \(dangles\) by moving or adding walls before the slabs\./.test(agent.SYSTEM_BUILD), 'the build text says to mend open ends');
    assert.ok(agent.PREVIEW_TOOL.description.includes('topology'), 'the preview tool tells of the topology');
    return 'ok';
  }, 20000);

  test('topology: get_topology answers through the app\'s Python only when it runs, and filters by storey', async (assert) => {
    const ds = await theModel();
    const tool = tools.TOOLS.find((x) => x.name === 'get_topology');
    assert.ok(tool && /south façade/.test(tool.description) && /N, NE, E, SE, S, SW, W, NW/.test(tool.description), 'the tool as the providers see it');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['storey']);
    const real = bridge.runIfcTopology; const state = bridge.state;
    let calls = 0;
    bridge.runIfcTopology = async () => { calls++; return TOPOLOGY; };
    try {
      bridge.state = 'idle';
      const off = await tools.call(ds.id, 'get_topology', { storey: null });
      assert.equal(off.error, 'the topology needs the app\'s Python, which is not running; ask the person to press Preview once');
      assert.equal(calls, 0, 'nothing started');
      bridge.state = 'ready';
      const all = await tools.call(ds.id, 'get_topology', { storey: null });
      assert.deepEqual(all.storeys.map((s) => s.storey), ['Plan 3', 'Plan 4', 'Tak']);
      assert.deepEqual(all.storeys[0].external.map((e) => [e.name, e.facing]), [['Norr', 'N'], ['Öst', 'E'], ['Syd', 'S'], ['Väst', 'W']], 'the façades by wall');
      const one = await tools.call(ds.id, 'get_topology', { storey: 'plan 3' });
      assert.deepEqual(one.storeys.map((s) => s.storey), ['Plan 3'], 'a storey by name, in any case');
      const none = await tools.call(ds.id, 'get_topology', { storey: 'Plan 9' });
      assert.ok(none.error && none.error.includes('Plan 9') && none.error.includes('Plan 3, Plan 4, Tak'), none.error);
      assert.equal(calls, 3);
    } finally { bridge.runIfcTopology = real; bridge.state = state; }
    const table = await datasets.create({ name: 'Topologi tabell', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    created.push(table.id);
    let refused = '';
    try { await ifcOps.topologyOf(table.id); } catch (err) { refused = String(err.message); }
    assert.equal(refused, t('op.err.ifc.notmodel'), 'only an IFC model has a topology');
    return 'ok';
  }, 20000);

  test('topology: the card Topologi in Kontrollera reads the model on the button and draws each storey with walls, and an error', async (assert) => {
    const ds = await theModel();
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const real = bridge.runIfcTopology;
    let fail = false;
    bridge.runIfcTopology = async () => { await wait(20); if (fail) throw new Error('IfcOpenShell is not available'); return TOPOLOGY; };
    try {
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === ds.id), 5000, 'model in store');
      shell.store.set({ selectedId: ds.id });
      shell.activate('kontrollera');
      const card = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-model] [data-card="topology"]'), 8000, 'the card');
      assert.ok(card.textContent.includes(t('kontrollera.topology')) && !card.querySelector('[data-topology-storey]'), 'the card waits for the button');
      /** @type {HTMLElement} */ (card.querySelector('[data-topology-run] button') || card.querySelector('[data-topology-run]')).click();
      const closed = await waitFor(() => card.querySelector('[data-topology-storey="Plan 3"]'), 5000, 'the storeys');
      assert.equal(closed.getAttribute('data-topology-closed'), 'true'); assert.equal(closed.getAttribute('data-topology-rooms'), '2'); assert.equal(closed.getAttribute('data-topology-dangles'), '0');
      assert.ok(closed.textContent.includes(t('kontrollera.topology.closed')), 'the badge says closed');
      const names = t('kontrollera.topology.facings').split(',');
      assert.ok([0, 2, 4, 6].every((i) => closed.textContent.includes(names[i] + ' 1')), 'the external walls per facing: ' + closed.textContent);
      const open = card.querySelector('[data-topology-storey="Plan 4"]');
      assert.ok(open && open.getAttribute('data-topology-closed') === 'false' && open.getAttribute('data-topology-dangles') === '6', 'the open storey');
      assert.ok(open.textContent.includes(t('kontrollera.topology.open')) && open.textContent.includes('…'), 'open, with its first ends shown');
      assert.ok(!card.querySelector('[data-topology-storey="Tak"]'), 'a storey without walls is left out');
      assert.ok(card.textContent.includes(t('kontrollera.topology.north.model')), 'where north comes from');
      fail = true;
      /** @type {HTMLElement} */ (card.querySelector('[data-topology-run] button') || card.querySelector('[data-topology-run]')).click();
      const error = await waitFor(() => card.querySelector('[data-topology-error]'), 5000, 'the error');
      assert.ok(error.textContent.includes('IfcOpenShell is not available'), error.textContent);
      return 'ok';
    } finally { bridge.runIfcTopology = real; history.replaceState(null, '', location.pathname + location.search); root.remove(); }
  }, 60000);

  test('topology: Python computes it: a 12 × 8 m box with an inner wall is one closed storey of two rooms facing S, E, N and W; without its west wall it is open', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Topologiprov');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const WALLS = [['Syd', [0, 0], [12, 0]], ['Öst', [12, 0], [12, 8]], ['Norr', [12, 8], [0, 8]], ['Väst', [0, 8], [0, 0]], ['Mitt', [6, 0], [6, 8]]];
    const build = (skip) => {
      const cs = writeTools.create(meta.id);
      assert.ok(writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: { x_spacing: 6, x_count: 2, y_spacing: 8, y_count: 1 } }).ok);
      for (const [name, start, end] of WALLS) if (name !== skip) assert.ok(writeTools.call(cs, 'create_wall', { storey: 'Plan 3', start, end, thickness: 0.2, height: 3, name }).ok);
      return writeTools.toWheel(cs);
    };
    const first = await ifcOps.previewChangeset(meta.id, build(null));
    assert.equal(first.report.errors, 0, 'no errors: ' + JSON.stringify(first.report.findings));
    const topology = first.report.topology;
    assert.ok(Array.isArray(topology) && topology.length === 1 && topology[0].storey === 'Plan 3', 'one storey, the one the walls are on: ' + JSON.stringify(topology));
    const s = topology[0];
    assert.equal(s.closed, true, 'closed: ' + JSON.stringify(s.dangles));
    assert.equal(s.walls, 5); assert.equal(s.unread, 0); assert.equal(s.elevation, 6, 'metres from a millimetre file');
    assert.deepEqual(s.rooms.map((r) => r.area), [48, 48], 'two rooms of 6 × 8 m');
    assert.deepEqual(s.rooms.map((r) => r.neighbours), [[2], [1]], 'which border each other');
    const facing = {};
    for (const e of s.external) facing[e.name] = e.facing;
    assert.deepEqual(facing, { Norr: 'N', 'Öst': 'E', Syd: 'S', 'Väst': 'W' }, 'four external walls, in compass order: ' + JSON.stringify(s.external));
    assert.ok(new TextDecoder().decode(first.bytes).includes("'Axis','Curve2D'"), 'the walls carry their Axis');
    const open = (await ifcOps.previewChangeset(meta.id, build('Väst'))).report.topology[0];
    assert.equal(open.closed, false);
    assert.deepEqual(open.dangles, [[0, 0], [0, 8]], 'two open ends where the west wall is missing');
    // The model as it is: every storey, the fixture's walls (no Axis) through their footprint, 4 m apart and unjoined.
    const own = await ifcOps.topologyOf(meta.id);
    assert.deepEqual(own.map((x) => x.storey), ['Plan 1', 'Plan 2']);
    assert.ok(own.every((x) => x.walls === 2 && x.unread === 0 && x.rooms.length === 0 && !x.closed), JSON.stringify(own));
    assert.deepEqual(own[0].dangles, [[-2, 0], [2, 0], [3, 0], [7, 0]], 'the long axes of the footprints, in metres');
    return 'ok';
  }, 900000);

  test('topology: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
