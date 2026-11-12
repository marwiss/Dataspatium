// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the clash check (analysis/clash-core, analysis/clash, the tool Kollisioner in Analysera): the core on boxes with
 * known answers, the whole way through web-ifc in the IFC worker on a small file (a beam through a wall, a slab that only
 * touches it, a wall far away), the BCF file read back, the mark in the model and the latest result on the card. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const core = D.require('analysis/clash-core').create();
  const clash = D.require('analysis/clash');
  const datasets = D.require('data/datasets');
  const selection = D.require('data/selection');
  const validation = D.require('data/ifc-validation');
  const idb = D.require('platform/storage/idb');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  /** A box as a closed mesh: eight corners, twelve triangles. */
  function box(x0, y0, z0, x1, y1, z1) {
    const pos = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    return core.part(new Float64Array(pos), new Uint32Array(idx));
  }
  const el = (id, ...parts) => Object.assign(core.element(id, parts), { key: 'm:' + id, model: 0 });
  const near = (v, want, eps) => Math.abs(v - want) <= eps;

  test('clash: the core finds a beam through a wall, and not faces that only touch', async (assert) => {
    const wall = el(1, box(-2.5, -0.1, 0, 2.5, 0.1, 3));
    const beam = el(2, box(-0.15, -1, 1, 0.15, 1, 1.4));
    const slab = el(3, box(-3, -3, -0.2, 3, 3, 0));
    const far = el(4, box(10, 10, 0, 12, 10.2, 3));
    const res = core.clash([wall, slab, far], [beam, slab, far], { mode: 'intersection', tolerance: 0.002 });
    assert.equal(res.clashes.length, 1, JSON.stringify(res.clashes.map((c) => [c.a, c.b, c.kind, c.depth])));
    const c = res.clashes[0];
    assert.deepEqual([c.a, c.b].sort(), [1, 2]);
    assert.equal(c.kind, 'intersection');
    assert.ok(near(c.depth, 0.1, 0.002), 'the depth is half the wall: ' + c.depth);
    assert.ok(c.point[1] >= -0.1 && c.point[1] <= 0.1 && c.point[2] >= 1 && c.point[2] <= 1.4, 'the point is where they meet: ' + c.point);
    assert.ok(res.pairs >= 2, 'the slab and the wall were a pair, and only touch');
    return `${res.pairs} pairs`;
  });

  test('clash: the tolerance, a box inside another, the clearance and an element of two parts', async (assert) => {
    const a = el(1, box(0, 0, 0, 1, 1, 1));
    const shallow = el(2, box(0.999, 0.2, 0.2, 2, 0.8, 0.8));
    assert.equal(core.pair(a, shallow, { tolerance: 0.002 }), null, 'one millimetre of overlap is below two');
    const hit = core.pair(a, shallow, { tolerance: 0.0005 });
    assert.ok(hit && near(hit.depth, 0.001, 0.0002), 'and above half a millimetre: ' + JSON.stringify(hit));
    const inner = el(3, box(0.4, 0.4, 0.4, 0.6, 0.6, 0.6));
    const inside = core.pair(a, inner, { tolerance: 0.002 });
    assert.equal(inside && inside.kind, 'contained');
    assert.ok(near(inside.depth, 0.4, 0.002), 'every corner of the inner box lies 0.4 from the outer surface: ' + inside.depth);
    const gap = el(4, box(1.03, 0, 0, 2, 1, 1));
    assert.equal(core.pair(a, gap, { mode: 'intersection' }), null, 'a gap is no intersection');
    const close = core.pair(a, gap, { mode: 'clearance', clearance: 0.05 });
    assert.ok(close && close.kind === 'clearance' && near(close.distance, 0.03, 1e-6), JSON.stringify(close));
    assert.equal(core.pair(a, gap, { mode: 'clearance', clearance: 0.02 }), null, 'further than the clearance');
    // Two overlapping parts of one element: a point inside both is still inside the element.
    const window = el(5, box(0, 0, 0, 1, 0.2, 1), box(0.5, 0, 0, 1.5, 0.2, 1));
    const pin = el(6, box(0.7, -0.5, 0.45, 0.8, 0.7, 0.55));
    const through = core.pair(window, pin, { tolerance: 0.002 });
    assert.ok(through && through.kind === 'intersection' && near(through.depth, 0.1, 0.002), JSON.stringify(through));
    // An open mesh (a box without its top) around a small closed box: "inside" is not defined, and a ray out through the gap
    // says outside, so no clash is made up. A closed element still finds a beam through it when the beam's mesh is open.
    const openBox = box(-1, -1, -1, 1, 1, 1);
    const lidless = el(7, core.part(openBox.pos, new Uint32Array(Array.from(openBox.idx).slice(0, 6).concat(Array.from(openBox.idx).slice(12)))));
    assert.equal(core.pair(lidless, el(8, box(0.4, 0.4, 0.4, 0.6, 0.6, 0.6)), { tolerance: 0.002 }), null, 'nothing inside an open mesh');
    const wall2 = el(9, box(-2.5, -0.1, 0, 2.5, 0.1, 3));
    const beamBox = box(-0.15, -1, 1, 0.15, 1, 1.4);
    const openBeam = el(10, core.part(beamBox.pos, new Uint32Array(Array.from(beamBox.idx).slice(0, 6).concat(Array.from(beamBox.idx).slice(12)))));
    const open = core.pair(wall2, openBeam, { tolerance: 0.002 });
    assert.ok(open && near(open.depth, 0.1, 0.002), 'the open beam still pierces the closed wall: ' + JSON.stringify(open));
    // Sets that share elements: each pair once, never an element against itself.
    const list = core.candidates([a, shallow, inner], [a, shallow, inner], 0);
    assert.equal(list.length, 2, list.map((p) => p[0].id + '-' + p[1].id).join(' '));
    return 'ok';
  });

  /** A small IFC file in metres: a wall, a beam through it, a slab under it that only touches, and a wall far away. */
  function crashFile() {
    const lines = []; let next = 1;
    const add = (s) => { const id = next++; lines.push(`#${id}=${s};`); return id; };
    const g = (n) => ('0Clash' + String(n).padStart(16, '0')).slice(0, 22);
    const origin = add('IFCCARTESIANPOINT((0.,0.,0.))'); const zDir = add('IFCDIRECTION((0.,0.,1.))'); const xDir = add('IFCDIRECTION((1.,0.,0.))');
    const world = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${xDir})`);
    const ctx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${world},$)`);
    const units = add(`IFCUNITASSIGNMENT((#${add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')}))`);
    const project = add(`IFCPROJECT('${g(1)}',$,'Krockprov',$,$,$,$,(#${ctx}),#${units})`);
    const site = add(`IFCSITE('${g(2)}',$,'Tomt',$,$,$,$,$,.ELEMENT.,$,$,$,$,$)`);
    const building = add(`IFCBUILDING('${g(3)}',$,'Hus',$,$,$,$,$,.ELEMENT.,$,$,$)`);
    const storey = add(`IFCBUILDINGSTOREY('${g(4)}',$,'Plan 1',$,$,$,$,$,.ELEMENT.,0.)`);
    add(`IFCRELAGGREGATES('${g(5)}',$,$,$,#${project},(#${site}))`);
    add(`IFCRELAGGREGATES('${g(6)}',$,$,$,#${site},(#${building}))`);
    add(`IFCRELAGGREGATES('${g(7)}',$,$,$,#${building},(#${storey}))`);
    const solid = (x, y, z, dx, dy, h) => {
      const at = add(`IFCAXIS2PLACEMENT3D(#${add(`IFCCARTESIANPOINT((${x},${y},${z}))`)},#${zDir},#${xDir})`);
      const place = add(`IFCLOCALPLACEMENT($,#${at})`);
      const prof = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${add(`IFCAXIS2PLACEMENT2D(#${add('IFCCARTESIANPOINT((0.,0.))')},$)`)},${dx},${dy})`);
      const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${add(`IFCAXIS2PLACEMENT3D(#${origin},$,$)`)},#${zDir},${h})`);
      const rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${add(`IFCSHAPEREPRESENTATION(#${ctx},'Body','SweptSolid',(#${ext}))`)}))`);
      return { place, rep };
    };
    const w = solid('0.', '0.', '0.', '5.', '0.2', '3.');
    const wall = add(`IFCWALL('${g(10)}',$,'Vagg 1',$,$,#${w.place},#${w.rep},$,$)`);
    const b = solid('0.', '0.', '1.', '0.3', '2.', '0.4');
    const beam = add(`IFCBEAM('${g(11)}',$,'Balk 1',$,$,#${b.place},#${b.rep},$,$)`);
    const s = solid('0.', '0.', '-0.2', '6.', '6.', '0.2');
    const slab = add(`IFCSLAB('${g(12)}',$,'Platta 1',$,$,#${s.place},#${s.rep},$,$)`);
    const f = solid('20.', '20.', '0.', '5.', '0.2', '3.');
    const farWall = add(`IFCWALL('${g(13)}',$,'Vagg 2',$,$,#${f.place},#${f.rep},$,$)`);
    add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${g(14)}',$,$,$,(#${wall},#${beam},#${slab},#${farWall}),#${storey})`);
    const head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');", "FILE_NAME('krock.ifc','2026-11-07T12:00:00',(''),(''),'Prov','Prov','');", "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;'];
    return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n');
  }
  let modelDs = null;
  const guids = { wall: ('0Clash' + '10'.padStart(16, '0')).slice(0, 22), beam: ('0Clash' + '11'.padStart(16, '0')).slice(0, 22) };

  test('clash: through web-ifc in the worker, a beam through a wall in a small file', async (assert) => {
    const importer = D.require('io/import');
    modelDs = await importer.run(new File([crashFile()], 'krock.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Krockprov');
    created.push(modelDs.id);
    assert.equal(modelDs.kind, 'model');
    const all = await clash.run({ a: { datasetId: modelDs.id }, b: { datasetId: modelDs.id }, mode: 'intersection', tolerance: 0.002 });
    assert.equal(all.setA, 4, 'four building parts');
    assert.equal(all.clashes.length, 1, JSON.stringify(all.clashes.map((c) => [c.a.typ, c.b.typ, c.kind, c.depth])));
    const c = all.clashes[0];
    assert.deepEqual([c.a.guid, c.b.guid].sort(), [guids.wall, guids.beam].sort());
    assert.ok(near(c.depth, 0.1, 0.005), 'half the wall: ' + c.depth);
    assert.ok(Math.abs(c.point[1]) <= 0.1 + 1e-6 && c.point[2] >= 1 - 1e-6 && c.point[2] <= 1.4 + 1e-6, 'in the model\'s coordinates, Z up: ' + c.point);
    const typed = await clash.run({ a: { datasetId: modelDs.id, types: ['IfcSlab'] }, b: { datasetId: modelDs.id, types: ['IfcWall'] }, mode: 'intersection' });
    assert.equal(typed.clashes.length, 0, 'the slab only touches the walls');
    const clear = await clash.run({ a: { datasetId: modelDs.id, types: ['IfcSlab'] }, b: { datasetId: modelDs.id, types: ['IfcWall'] }, mode: 'clearance', clearance: 0.01 });
    assert.equal(clear.clashes.length, 1, 'but it is closer than a centimetre to the near wall');
    const table = clash.tableOf(all);
    assert.deepEqual(table.columns.map((x) => x.name), clash.COLUMNS.map((x) => x.name));
    assert.ok(near(table.rows[0][9], 100, 5), 'the depth in millimetres: ' + table.rows[0][9]);
    const vp = clash.viewpointOf(c, { a: 'C0392B', b: '8F5A0B' });
    const cam = vp.perspective_camera;
    const to = [c.point[0] - cam.camera_view_point.x, c.point[1] - cam.camera_view_point.y, c.point[2] - cam.camera_view_point.z];
    const len = Math.hypot(to[0], to[1], to[2]);
    assert.ok(Math.abs(to[0] / len - cam.camera_direction.x) < 0.01 && Math.abs(to[2] / len - cam.camera_direction.z) < 0.01, 'the camera looks at the point');
    assert.ok(cam.camera_up_vector.z > 0.5, 'Z is up, as in IFC');
    assert.equal(vp.components.selection.length, 2);
    assert.equal(vp.components.coloring.length, 2);
    return `${all.pairs} pairs, ${all.seconds} s`;
  }, 120000);

  test('clash: the tool in Analysera runs, saves a BCF file that reads back, marks the elements and leaves its result on the card', async (assert) => {
    const files = D.require('platform/files');
    const saved = [];
    const original = files.download;
    files.download = (blob, name) => { saved.push({ blob, name }); };
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === modelDs.id), 3000, 'dataset');
        shell.store.set({ selectedId: modelDs.id, openModelTool: { datasetId: modelDs.id, tool: 'clash' } });
        shell.activate('analysera');
        const run = await waitFor(() => root.querySelector('[data-clash-run]'), 8000, 'the clash tool');
        assert.ok(root.textContent.includes(t('clash.hint')), 'nothing runs before the button');
        /** @type {any} */ (run).click();
        const result = await waitFor(() => root.querySelector('[data-clash-result]'), 60000, 'the result');
        assert.ok(result.textContent.includes(t('clash.note.one', { a: '4', b: '4', pairs: '', s: '' }).split('.')[0]), result.textContent);
        /** @type {any} */ (root.querySelector('[data-clash-bcf]')).click();
        const file = await waitFor(() => saved[0], 5000, 'the BCF file');
        assert.ok(/\.bcfzip$/.test(file.name), file.name);
        const read = await D.require('data/bcf-xml').read(await file.blob.arrayBuffer());
        assert.equal(read.topics.length, 1, JSON.stringify(Object.keys(read)));
        const invalid = await D.require('tests/bcf-schema-check').checkBlob(file.blob);
        if (invalid) assert.deepEqual(invalid, [], 'the clash file is valid BCF 3.0');
        const vps = read.viewpoints.filter((v) => v.topic_guid === read.topics[0].guid);
        assert.ok(vps.length === 1 && vps[0].perspective_camera, 'one viewpoint with a camera');
        const sel = (vps[0].components && vps[0].components.selection) || [];
        assert.deepEqual(sel.map((x) => x.ifc_guid).sort(), [guids.wall, guids.beam].sort());
        assert.ok(read.topics[0].title.includes('IfcWall') && read.topics[0].title.includes('IfcBeam'), read.topics[0].title);
        /** @type {any} */ (root.querySelector('[data-clash-mark]')).click();
        await waitFor(() => shell.store.get().mode === 'bearbeta', 5000, 'Bearbeta');
        const chosen = selection.get();
        assert.ok(chosen && chosen.datasetId === modelDs.id && chosen.rowids.length === 2, 'the wall and the beam are marked');
        selection.clear();
        const kept = await validation.results(modelDs.id);
        assert.ok(kept.clash && kept.clash.count === 1 && kept.clash.mode === 'intersection', JSON.stringify(kept.clash));
        shell.activate('hantera');
        // The card reads the results after it is drawn.
        const card = await waitFor(() => { const c = root.querySelector('[data-card="validation"]'); return c && c.querySelector('[data-validation-clash]') && c.textContent.includes(t('clash.mode.intersection')) ? c : null; }, 5000, 'the card with the result');
        assert.ok(card.textContent.includes(t('validation.local.clash')), card.textContent);
      });
    } finally { files.download = original; }
    return 'ok';
  }, 120000);

  test('clash: a point of the 3D view in the model\'s own coordinates, as BCF cameras need it', async (assert) => {
    const draw = D.require('viz/model-draw');
    // web-ifc moved a model at SWEREF 99 TM coordinates near the origin; its coordination matrix holds the move (Y up).
    const moved = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -649998, -13, 6599999, 1];
    assert.deepEqual(draw.toIfc(moved, [0, 0, 0]), [649998, 6599999, 13], 'moved back, and Z up');
    assert.deepEqual(draw.toIfc(moved, [2, 3, -1]), [650000, 6600000, 16]);
    assert.deepEqual(draw.toIfc(null, [1, 2, 3]), [1, -3, 2], 'without a matrix only the axes turn');
    return 'ok';
  });

  test('clash: cleanup', async () => {
    for (const id of created) { await idb.deleteSetting(validation.PREFIX + id).catch(() => {}); await datasets.remove(id).catch(() => {}); }
    return 'ok';
  });
})();
