// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for create_roof, the write tool that puts a roof on a storey's walls (F45): the four shapes land as steps with their defaults
 * filled in and a ref each, the checks refuse an unknown shape, a pitch of 80°, a negative thickness and an outline of fewer than three
 * corners, an outline that is not a rectangle is answered with a note, the description names the shape (in the words of the facts
 * form) and the pitch in all seven languages, the summary counts the roof as a create and the wheel keeps every field. With the real
 * Pyodide (`?python=1` or cached components) the wheel builds a gable roof on four new walls of the fixture model: an IfcRoof with the
 * ref, contained in the storey, aggregating two roof slabs.
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
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  /** The written IFC of a preview as text (the bridge answers bytes). */
  const textOf = (res) => (typeof res.bytes === 'string' ? res.bytes : res.bytes ? new TextDecoder().decode(res.bytes) : '');
  const BOX = [[0, 0], [12, 0], [12, 8], [0, 8]];
  const ARGS = { storey: 'Plan 3', shape: 'gable', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null };
  const roof = (cs, patch) => writeTools.call(cs, 'create_roof', Object.assign({}, ARGS, patch));
  /** An op as it lands: the defaults and then the ref. */
  const landed = (patch, ref) => Object.assign({ tool: 'create_roof' }, ARGS, patch, { ref });

  test('ai roof: create_roof is a create, the four shapes land with their defaults and a ref each, and the wheel keeps every field', async (assert) => {
    assert.ok(writeTools.has('create_roof') && writeTools.CREATES.includes('create_roof'), 'a write tool that creates');
    const tool = writeTools.TOOLS.find((x) => x.name === 'create_roof');
    assert.ok(tool && tool.parameters.type === 'object' && tool.description.includes('gable, hip, shed or flat'), 'the tool as the providers see it');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['storey', 'shape', 'outline', 'pitch', 'overhang', 'thickness', 'ridge', 'base', 'name', 'type', 'status'], 'type is a roof type of define_type (tests/ai-types.test.js), status its Status (tests/ai-props.test.js)');
    assert.ok(agent.SYSTEM_BUILD.includes('create_roof') && agent.SYSTEM_BUILD.includes('mansardtak'), 'the build instructions make the roof with create_roof');
    const cs = writeTools.create('roof-test');
    const gable = roof(cs, { outline: BOX });
    assert.ok(gable.ok && gable.step === 1 && gable.ref === 'new-1' && !gable.note, 'a gable roof over a rectangle: ' + JSON.stringify(gable));
    assert.deepEqual(cs.ops[0], landed({ outline: BOX, pitch: 30, overhang: 0.4, thickness: 0.25 }, 'new-1'), 'gable: 30°, 0.4 m overhang, 0.25 m thick');
    assert.ok(roof(cs, { shape: 'hip', storey: null, ridge: 'x' }).ok);
    assert.deepEqual(cs.ops[1], landed({ shape: 'hip', storey: null, pitch: 30, overhang: 0.4, thickness: 0.25 }, 'new-2'), 'hip: the same defaults, and the ridge is ignored');
    assert.ok(roof(cs, { shape: 'shed', ridge: 'X' }).ok);
    assert.deepEqual(cs.ops[2], landed({ shape: 'shed', pitch: 10, overhang: 0.4, thickness: 0.25, ridge: 'x' }, 'new-3'), 'shed: 10°, the fall line kept in lower case');
    assert.ok(roof(cs, { shape: 'flat', pitch: 80, ridge: 'y' }).ok, 'flat ignores the pitch');
    assert.deepEqual(cs.ops[3], landed({ shape: 'flat', pitch: 0, overhang: 0, thickness: 0.25 }, 'new-4'), 'flat: no pitch, no overhang, no ridge');
    const named = roof(cs, { shape: 'GABLE', pitch: 45, overhang: 0.6, thickness: 0.3, ridge: 'y', base: 5.4, name: 'Huvudtak' });
    assert.ok(named.ok && named.ref === 'new-5', JSON.stringify(named));
    assert.deepEqual(cs.ops[4], landed({ pitch: 45, overhang: 0.6, thickness: 0.3, ridge: 'y', base: 5.4, name: 'Huvudtak' }, 'new-5'), 'what is given is kept');
    assert.equal(cs.refs, 5);
    assert.deepEqual(writeTools.summary(cs), { steps: 5, creates: 5, deletes: 0 }, 'every roof is a create');
    const wheel = writeTools.toWheel(cs);
    assert.deepEqual(wheel[0], Object.assign({ tool: 'create_roof' }, ARGS, { outline: BOX, pitch: 30, overhang: 0.4, thickness: 0.25 }), 'the wheel gets every field');
    assert.ok(wheel.every((op) => !('ref' in op)), 'and counts the refs itself');
    const listed = writeTools.call(cs, 'manage_changeset', { action: 'list' });
    assert.equal(listed.steps[0].ref, 'new-1'); assert.equal(listed.steps[0].tool, 'create_roof');
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }).ok); assert.equal(cs.refs, 4);
    return 'ok';
  });

  test('ai roof: the checks refuse an unknown shape, a pitch of 80°, a negative thickness and an outline of fewer than three corners, and a non-rectangle is answered with a note', async (assert) => {
    const cs = writeTools.create('roof-test-2');
    const refused = (patch, label) => { const out = roof(cs, patch); assert.ok(out.error, label + ': ' + JSON.stringify(out)); return out.error || ''; };
    assert.ok(refused({ shape: 'mansard' }, 'mansard').includes('shape'));
    assert.ok(refused({ shape: null }, 'no shape').includes('shape'));
    assert.ok(refused({ pitch: 80 }, 'pitch 80').includes('pitch'));
    assert.ok(refused({ pitch: 0 }, 'a pitched roof without a pitch').includes('flat'));
    assert.ok(refused({ pitch: 'steep' }, 'pitch as text').includes('pitch'));
    assert.ok(refused({ thickness: -0.2 }, 'negative thickness').includes('thickness'));
    assert.ok(refused({ overhang: -1 }, 'negative overhang').includes('overhang'));
    assert.ok(refused({ outline: [[0, 0], [12, 0]] }, 'two corners').includes('outline'));
    assert.ok(refused({ outline: [[0, 0], [12, 0], [12]] }, 'a corner without y').includes('outline'));
    assert.ok(refused({ outline: [[0, 0], [12, 0], [24, 0]] }, 'corners on a line').includes('outline'));
    assert.ok(refused({ ridge: 'z' }, 'ridge z').includes('ridge'));
    assert.ok(refused({ base: 'high' }, 'base as text').includes('base'));
    assert.equal(cs.ops.length, 0, 'nothing landed'); assert.equal(cs.refs, 0);
    const l = roof(cs, { outline: [[0, 0], [12, 0], [12, 8], [6, 8], [6, 4], [0, 4]] });
    assert.ok(l.ok && l.note && l.note.includes('bounding box') && l.note.includes('12 × 8 m'), 'an L-shaped outline is roofed over its bounding box, and the answer says so: ' + JSON.stringify(l));
    const closed = roof(cs, { outline: BOX.concat([[0, 0]]) });
    assert.ok(closed.ok && !closed.note, 'a rectangle with its first corner repeated is a rectangle: ' + JSON.stringify(closed));
    const turned = roof(cs, { outline: [[0, 0], [10, 5], [5, 15], [-5, 10]] });
    assert.ok(turned.ok && turned.note, 'a turned rectangle is not along x and y: ' + JSON.stringify(turned));
    return 'ok';
  });

  test('ai roof: the description names the shape in the words of the facts form and the pitch in all seven languages', async (assert) => {
    const cs = writeTools.create('roof-languages');
    assert.ok(roof(cs, { outline: BOX }).ok && roof(cs, { shape: 'hip', storey: null }).ok && roof(cs, { shape: 'flat' }).ok);
    const codes = i18n.LANGUAGES.map((x) => x.code);
    assert.equal(codes.length, 7, codes.join(','));
    const before = i18n.language();
    const seen = [];
    try {
      for (const code of codes) {
        assert.equal(await i18n.loadLanguage(code), true, 'dictionary loaded: ' + code);
        assert.ok(i18n.setLanguage(code, { persist: false }), 'switched to ' + code);
        const word = (shape) => String(i18n.tIn(code, 'ai.build.roof.' + shape)).toLowerCase();
        const [gable, hip, flat] = cs.ops.map((op) => writeTools.describe(op));
        assert.ok(gable.includes(word('gable')) && gable.includes('30°') && gable.includes('12 × 8 m') && gable.includes('0.4') && gable.startsWith('new-1'), code + ': ' + gable);
        assert.ok(hip.includes(word('hip')) && hip.includes('30°') && hip.includes(i18n.tIn(code, 'ai.change.storey.top')), code + ': ' + hip);
        assert.ok(flat.includes(word('flat')) && !flat.includes('°'), code + ': ' + flat);
        for (const text of [gable, hip, flat]) assert.ok(!/\{\w+\}/.test(text), code + ': every placeholder filled: ' + text);
        seen.push(hip);
      }
      assert.equal(new Set(seen).size, 7, 'seven different texts: ' + seen.join(' | '));
    } finally { i18n.setLanguage(before, { persist: false }); }
    return 'ok';
  });

  test('ai roof: Python builds a gable roof on four new walls of the fixture model: an IfcRoof with the ref in the storey and two roof slabs', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Takprov');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const cs = writeTools.create(meta.id);
    assert.ok(writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null }).ok);
    const corners = [[0, 0], [12, 0], [12, 8], [0, 8]];
    for (let i = 0; i < 4; i++) assert.ok(writeTools.call(cs, 'create_wall', { storey: 'Plan 3', start: corners[i], end: corners[(i + 1) % 4], thickness: 0.2, height: 2.7, name: 'Vägg ' + (i + 1) }).ok);
    const call = roof(cs, { storey: null, name: 'Tak' });
    assert.ok(call.ok && call.ref === 'new-5', JSON.stringify(call));
    const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    const report = res.report;
    assert.equal(report.errors, 0, 'no errors: ' + JSON.stringify(report.findings));
    assert.equal(report.operations, 6);
    const roofs = (report.created || []).filter((e) => e.ifc_class === 'IfcRoof');
    assert.ok(roofs.length === 1 && roofs[0].ref === 'new-5' && roofs[0].name === 'Tak' && roofs[0].storey === 'Plan 3', 'the roof among the created, with the ref, on the top storey: ' + JSON.stringify(report.created));
    const slabs = (report.created || []).filter((e) => e.ifc_class === 'IfcSlab');
    assert.equal(slabs.length, 2, 'two roof slabs: ' + JSON.stringify(report.created));
    assert.ok(slabs.every((e) => !e.ref), 'only the roof gets a ref');
    const text = textOf(res);
    assert.ok(text.includes('IFCROOF(') && text.includes('.GABLE_ROOF.'), 'the file has a gable roof');
    const lines = text.split('\n');
    assert.equal(lines.filter((x) => x.includes('IFCSLAB(') && x.includes('.ROOF.')).length, 2, 'two IfcSlab ROOF');
    const parts = lines.map((x) => x.match(new RegExp('IFCRELAGGREGATES\\(.*,#' + roofs[0].id + ',\\(([^)]*)\\)\\)'))).find(Boolean);
    assert.ok(parts, 'the roof aggregates its parts');
    assert.deepEqual(parts[1].split(',').map((x) => Number(x.replace('#', ''))).sort((a, b) => a - b), slabs.map((e) => e.id).sort((a, b) => a - b), 'and the parts are the two slabs');
    assert.ok(lines.some((x) => x.includes('IFCRELCONTAINEDINSPATIALSTRUCTURE(') && new RegExp('[(,]#' + roofs[0].id + '[,)]').test(x)), 'the roof is contained in a storey');
    return 'ok';
  }, 900000);

  test('ai roof: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
