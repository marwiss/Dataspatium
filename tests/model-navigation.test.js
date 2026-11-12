// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the navigation in the 3D view (F11 b, package A): the conversion back from the model's own coordinates, the standard
 * views, the orthographic view that keeps the size and goes into BCF, a BCF viewpoint that puts the camera where it stood, the
 * double click that sets the centre to turn about, the keys, the view cube, and Bearbeta's buttons with isolation. Own test data
 * (tests/fixtures/ifc-fixture.js); WebGL as in the model tests.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const fixtures = D.require('tests/fixtures/ifc');
  const imports = D.require('io/import');
  const draw = D.require('viz/model-draw');
  const bcfXml = D.require('data/bcf-xml');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  /** The unit direction from the camera to what it looks at. */
  const lookOf = (v) => { const d = [0, 1, 2].map((k) => v.target[k] - v.position[k]); const l = Math.hypot(d[0], d[1], d[2]) || 1; return d.map((x) => x / l); };
  const distOf = (v) => Math.hypot(v.target[0] - v.position[0], v.target[1] - v.position[1], v.target[2] - v.position[2]);

  let modelId = null;
  async function theModel() {
    if (modelId) return modelId;
    const meta = await imports.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Navigeringshus');
    created.push(meta.id);
    modelId = meta.id;
    return modelId;
  }
  /** A drawing of the test model in a box on the page; the callback gets the handle and the box. */
  async function withView(fn, options = {}) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:0; top:0; width:800px; height:500px; z-index:9000;';
    document.body.appendChild(host);
    let hd = null;
    try {
      hd = await draw.render(host, { datasetId: await theModel() }, Object.assign({ navigation: true, label: 'test' }, options));
      return await fn(hd, host);
    } finally { if (hd) hd.destroy(); host.remove(); }
  }

  test('navigation: fromIfc undoes toIfc, also under a coordination matrix', async (assert) => {
    const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -150000.5, 12.25, 6400000.75, 1];
    for (const p of [[0, 0, 0], [1.5, -2, 3], [150000, -6400000, 40]]) {
      const back = draw.fromIfc(m, draw.toIfc(m, p));
      assert.ok(p.every((v, k) => near(v, back[k], 1e-6)), p.join(',') + ' -> ' + back.join(','));
    }
    const up = draw.fromIfcDir(m, [0, 0, 1]);
    assert.ok(near(up[1], 1, 1e-12) && near(up[0], 0, 1e-12) && near(up[2], 0, 1e-12), 'Z up in the model is Y up in the view');
    const north = draw.fromIfcDir(null, [0, 1, 0]);
    assert.ok(near(north[2], -1, 1e-12), 'north is -Z in the view');
    assert.deepEqual(draw.VIEW_ORDER, ['top', 'front', 'right', 'back', 'left', 'bottom', 'iso']);
    return 'ok';
  });

  test('navigation: the standard views look the right way at what is shown', async (assert) => {
    await withView(async (hd) => {
      assert.ok(hd.standardView('top'));
      let look = lookOf(hd.view());
      assert.ok(look[1] < -0.99, 'top looks down: ' + look.map((x) => x.toFixed(3)).join(','));
      hd.standardView('front');
      look = lookOf(hd.view());
      assert.ok(look[2] < -0.99, 'front looks north from the south: ' + look.join(','));
      hd.standardView('right');
      assert.ok(lookOf(hd.view())[0] < -0.99, 'right looks west from the east');
      hd.standardView('back');
      assert.ok(lookOf(hd.view())[2] > 0.99, 'back looks south');
      hd.standardView('left');
      assert.ok(lookOf(hd.view())[0] > 0.99, 'left looks east');
      hd.standardView('bottom');
      assert.ok(lookOf(hd.view())[1] > 0.99, 'bottom looks up');
      hd.standardView('iso');
      look = lookOf(hd.view());
      assert.ok(look[0] < 0 && look[1] < 0 && look[2] < 0, 'iso looks down from the south-east');
      assert.equal(hd.standardView('nowhere'), false, 'an unknown view does nothing');
      // A filter narrows what the views aim at.
      const one = Array.from(hd.meshes.byElement.keys())[0];
      const s = hd.meshes.stats.get(one);
      hd.setVisible([one]);
      hd.standardView('top');
      const target = hd.view().target;
      assert.ok([0, 1, 2].every((k) => near(target[k], (s.min[k] + s.max[k]) / 2, 1e-6)), 'the views aim at what is shown');
    });
    return 'ok';
  }, 60000);

  test('navigation: the orthographic view keeps the size, survives a saved view and goes into BCF', async (assert) => {
    await withView(async (hd) => {
      hd.standardView('iso');
      const before = hd.view();
      const shown = 2 * distOf(before) * Math.tan(hd.camera.fov * Math.PI / 360);
      assert.equal(hd.setProjection('orthographic'), 'orthographic');
      assert.ok(hd.camera.isOrthographicCamera, 'the camera is orthographic');
      const ortho = hd.view();
      assert.equal(ortho.projection, 'orthographic');
      assert.ok(near(ortho.height, shown, shown * 1e-6), `the same height: ${ortho.height} and ${shown}`);
      assert.ok(lookOf(ortho).every((v, k) => near(v, lookOf(before)[k], 1e-6)), 'the same direction');
      // A BCF viewpoint of the orthographic view.
      const cam = bcfXml.cameraOfView(Object.assign({}, ortho, { position: hd.toIfc(ortho.position), target: hd.toIfc(ortho.target) }), { worldUp: [0, 0, 1] });
      assert.ok(cam.orthogonal_camera && !cam.perspective_camera, 'an orthogonal camera');
      assert.ok(near(cam.orthogonal_camera.view_to_world_scale, ortho.height, 0.001), 'the height as view_to_world_scale');
      assert.equal(cam.orthogonal_camera.field_of_view, undefined);
      assert.ok(near(cam.orthogonal_camera.camera_up_vector.z, 1, 0.2), 'Z up in the model');
      assert.ok(bcfXml.viewpointXml(Object.assign({ guid: 'a' }, cam)).includes('<OrthogonalCamera>'), 'the BCF file writes it');
      assert.ok(bcfXml.cameraOfView(before).perspective_camera, 'a perspective view gives a perspective camera');
      // Back to perspective from the same place and size.
      assert.equal(hd.setProjection('perspective'), 'perspective');
      assert.ok(near(distOf(hd.view()), distOf(before), distOf(before) * 1e-6), 'the same distance again');
      assert.equal(hd.view().projection, 'perspective');
    });
    // A saved orthographic view draws again as it was, and onProjection tells the view.
    const told = [];
    let saved = null;
    await withView(async (hd) => { hd.standardView('top'); hd.setProjection('orthographic'); saved = hd.view(); });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:0; top:0; width:800px; height:500px;';
    document.body.appendChild(host);
    try {
      const hd = await draw.render(host, { datasetId: modelId, view: saved }, { onProjection: (k) => told.push(k) });
      assert.equal(hd.projection(), 'orthographic');
      assert.ok(near(hd.view().height, saved.height, 1e-6), 'the saved height');
      assert.deepEqual(told, ['orthographic']);
      hd.destroy();
    } finally { host.remove(); }
    return 'ok';
  }, 60000);

  test('navigation: a BCF viewpoint puts the camera where it stood, perspective or orthographic', async (assert) => {
    await withView(async (hd) => {
      hd.standardView('iso');
      const v = hd.view();
      const vp = bcfXml.cameraOfView(Object.assign({ fov: 50 }, v, { position: hd.toIfc(v.position), target: hd.toIfc(v.target) }), { worldUp: [0, 0, 1] });
      hd.standardView('top');
      assert.ok(hd.setViewpoint(vp), 'the viewpoint has a camera');
      const after = hd.view();
      assert.ok([0, 1, 2].every((k) => near(after.position[k], v.position[k], 0.01)), 'the same place: ' + after.position.join(',') + ' / ' + v.position.join(','));
      assert.ok(lookOf(after).every((x, k) => near(x, lookOf(v)[k], 0.01)), 'the same direction');
      assert.equal(hd.camera.fov, 50, 'the field of view of the viewpoint');
      const ortho = { orthogonal_camera: { camera_view_point: { x: 2, y: -30, z: 4 }, camera_direction: { x: 0, y: 1, z: 0 }, camera_up_vector: { x: 0, y: 0, z: 1 }, view_to_world_scale: 12, aspect_ratio: 1.6 } };
      assert.ok(hd.setViewpoint(ortho));
      assert.equal(hd.projection(), 'orthographic');
      assert.ok(near(hd.view().height, 12, 1e-6), 'view_to_world_scale is the height');
      assert.ok(lookOf(hd.view())[2] < -0.99, 'looking north as the viewpoint did');
      assert.equal(hd.setViewpoint({ components: {} }), false, 'no camera, no move');
      assert.ok(hd.setViewpoint(vp) && hd.projection() === 'perspective', 'a perspective viewpoint leaves the orthographic view');
    });
    return 'ok';
  }, 60000);

  test('navigation: a double click sets the centre to turn about on the element under the pointer', async (assert) => {
    await withView(async (hd, host) => {
      hd.standardView('front');
      let hit = null;
      for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7]) {
        for (const fy of [0.5, 0.45, 0.55, 0.4, 0.6]) { const id = hd.pickAt(800 * fx, 500 * fy); if (id) { hit = { x: 800 * fx, y: 500 * fy, id }; break; } }
        if (hit) break;
      }
      assert.ok(hit, 'something is under the pointer');
      const canvas = host.querySelector('canvas');
      const box = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: box.left + hit.x, clientY: box.top + hit.y }));
      const target = hd.view().target;
      const s = hd.meshes.stats.get(hit.id);
      assert.ok([0, 1, 2].every((k) => target[k] >= s.min[k] - 0.01 && target[k] <= s.max[k] + 0.01), 'the centre lies on the element: ' + target.join(','));
      assert.equal(hd.pivotAt(1, 1), null, 'the background changes nothing');
    });
    return 'ok';
  }, 60000);

  test('navigation: the keys move the camera while the view has focus', async (assert) => {
    await withView(async (hd, host) => {
      const canvas = host.querySelector('canvas');
      assert.equal(canvas.tabIndex, 0, 'the view can have focus');
      assert.equal(canvas.getAttribute('aria-label'), 'test');
      const key = (k, extra = {}) => canvas.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, code: k, bubbles: true, cancelable: true }, extra)));
      key('1');
      assert.ok(lookOf(hd.view())[1] < -0.99, '1 is the top view');
      key('2');
      assert.ok(lookOf(hd.view())[2] < -0.99, '2 is the front view');
      const d = distOf(hd.view());
      key('+');
      assert.ok(distOf(hd.view()) < d * 0.9, '+ comes closer');
      key('-'); key('-');
      assert.ok(distOf(hd.view()) > d, '- goes away');
      key('o');
      assert.equal(hd.projection(), 'orthographic', 'O changes to orthographic');
      key('O');
      assert.equal(hd.projection(), 'perspective', 'and back');
      const first = Array.from(hd.meshes.byElement.keys())[0];
      hd.select([first]);
      key('f');
      const s = hd.meshes.stats.get(first);
      assert.ok([0, 1, 2].every((k) => near(hd.view().target[k], (s.min[k] + s.max[k]) / 2, 1e-6)), 'F aims at the marked');
      key('Home');
      assert.ok(!near(hd.view().target[0], (s.min[0] + s.max[0]) / 2, 1e-6) || !near(hd.view().target[2], (s.min[2] + s.max[2]) / 2, 1e-6), 'Home shows everything');
      const before = hd.view().position.slice();
      key('1', { ctrlKey: true });
      assert.deepEqual(hd.view().position, before, 'Ctrl with a digit is left to the app');
    });
    return 'ok';
  }, 60000);

  test('navigation: the view cube turns with the camera and sends the standard views', async (assert) => {
    const cube = /** @type {any} */ (document.createElement('dm-viewcube'));
    cube.orientation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    document.body.appendChild(cube);
    try {
      const inner = cube.querySelector('.dm-viewcube-cube');
      assert.equal(inner.style.transform.replace(/\s/g, ''), 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', 'set before it was shown');
      // A quarter turn about X: the y axis flips sign in CSS.
      cube.orientation = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
      assert.equal(inner.style.transform.replace(/\s/g, ''), 'matrix3d(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1)');
      const faces = Array.from(cube.querySelectorAll('[data-view]')).map((b) => b.getAttribute('data-view'));
      assert.deepEqual(faces.sort(), ['back', 'bottom', 'front', 'iso', 'left', 'right', 'top']);
      for (const b of cube.querySelectorAll('[data-view]')) assert.ok(b.getAttribute('data-tip') && b.getAttribute('aria-label') && !/^model\./.test(b.getAttribute('data-tip')), 'a tip: ' + b.getAttribute('data-view'));
      assert.equal(cube.querySelector('[data-view="top"]').textContent, t('model.view.top'));
      const got = [];
      cube.addEventListener('dm-view', (ev) => got.push(ev.detail.view));
      cube.querySelector('[data-view="top"]').click();
      cube.querySelector('[data-view="iso"]').click();
      assert.deepEqual(got, ['top', 'iso']);
    } finally { cube.remove(); }
    return 'ok';
  });

  test('navigation: Bearbeta has the view cube, zoom to the marked, isolation and the orthographic view', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed; left:0; top:0; width:1400px; height:900px; z-index:9000; background:white;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const id = await theModel();
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === id), 5000, 'dataset in the store');
      shell.store.set({ selectedId: id });
      shell.activate('bearbeta');
      const cube = await waitFor(() => root.querySelector('.dm-model-host dm-viewcube'), 30000, 'the view cube');
      const canvas = root.querySelector('.dm-model-canvas');
      assert.equal(canvas.getAttribute('aria-label'), t('model.canvas'));
      await waitFor(() => /matrix3d/.test(cube.querySelector('.dm-viewcube-cube').style.transform), 3000, 'the cube follows the camera');
      for (const sel of ['[data-model-zoom-marked]', '[data-model-isolate]', '[data-model-ortho]']) assert.ok(root.querySelector(sel), sel);
      const ortho = root.querySelector('[data-model-ortho]');
      ortho.querySelector('button').click();
      assert.ok(ortho.hasAttribute('active'), 'the button shows the orthographic view');
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true }));
      assert.ok(!ortho.hasAttribute('active'), 'the key O changes the button too');
      // Isolation needs something marked.
      const isolate = root.querySelector('[data-model-isolate]');
      isolate.querySelector('button').click();
      assert.ok(!isolate.hasAttribute('active'), 'nothing marked, nothing isolated');
      const row = await waitFor(() => Array.from(root.querySelectorAll('.dm-model-table [role="row"]')).find((r) => r.textContent.includes('Vägg 1.1')), 8000, 'the wall row');
      /** @type {any} */ (row.querySelector('[role="gridcell"], .dm-td') || row).click();
      await waitFor(() => root.querySelector('.dm-right') && root.querySelector('.dm-right').textContent.includes('EI60'), 5000, 'the wall in the inspector');
      isolate.querySelector('button').click();
      await waitFor(() => isolate.hasAttribute('active'), 3000, 'isolated');
      root.querySelector('[data-model-zoom-marked] button').click();
      isolate.querySelector('button').click();
      await waitFor(() => !isolate.hasAttribute('active'), 3000, 'shown again');
      cube.querySelector('[data-view="top"]').click();
      return 'ok';
    } finally {
      root.remove();
      draw.clearCache();
    }
  }, 120000);

  test('navigation: a section box cuts the drawing and the picking, travels with the view and goes into BCF', async (assert) => {
    const box = { min: [0, -2, 0], max: [10, 3, 2.5] };
    const planes = draw.boxPlanes(box);
    assert.equal(planes.length, 6);
    assert.deepEqual(planes[0], { location: [0, 0.5, 1.25], direction: [-1, 0, 0] }, 'the side below the box is cut away');
    assert.deepEqual(draw.boxOfPlanes(planes, { min: [-9, -9, -9], max: [9, 9, 9] }), box, 'the box back from its planes');
    assert.deepEqual(draw.boxOfPlanes([planes[5]], { min: [-9, -9, -9], max: [9, 9, 9] }), { min: [-9, -9, -9], max: [9, 9, 2.5] }, 'one plane, the rest from the bounds');
    assert.equal(draw.boxOfPlanes([{ location: [0, 0, 0], direction: [1, 1, 0] }], box), null, 'a plane at an angle is no box');
    let saved = null;
    await withView(async (hd) => {
      hd.standardView('front');
      const hits = () => { let n = 0; for (let fx = 0.1; fx < 0.95; fx += 0.1) for (let fy = 0.1; fy < 0.95; fy += 0.1) if (hd.pickAt(800 * fx, 500 * fy)) n++; return n; };
      const before = hits();
      assert.ok(before > 0, 'something to pick: ' + before);
      const b = hd.boundsIfc();
      assert.ok(b.max[2] > b.min[2] && b.max[0] > b.min[0], 'the bounds in the model\'s coordinates');
      // A box that ends below the model cuts everything away.
      assert.equal(hd.setSection(draw.boxPlanes({ min: [b.min[0] - 1, b.min[1] - 1, b.min[2] - 10], max: [b.max[0] + 1, b.max[1] + 1, b.min[2] - 5] })), 6);
      assert.equal(hits(), 0, 'nothing is picked through a section that hides it');
      assert.equal(hd.view().section.length, 6, 'the view carries the section');
      saved = hd.view();
      // The lower half kept: fewer hits than without the section.
      hd.setSection(draw.boxPlanes({ min: [b.min[0] - 1, b.min[1] - 1, b.min[2] - 1], max: [b.max[0] + 1, b.max[1] + 1, (b.min[2] + b.max[2]) / 2] }));
      const half = hits();
      assert.ok(half > 0 && half <= before, `the lower half: ${half} of ${before}`);
      assert.equal(hd.setSection([]), 0);
      assert.equal(hits(), before, 'without the section everything is there again');
      assert.equal(hd.view().section, undefined);
      // A viewpoint with clipping planes cuts; one without takes the cut away.
      const vp = bcfXml.cameraOfView(Object.assign({}, saved, { position: hd.toIfc(saved.position), target: hd.toIfc(saved.target) }), { worldUp: [0, 0, 1] });
      vp.clipping_planes = saved.section.map((c) => ({ location: { x: c.location[0], y: c.location[1], z: c.location[2] }, direction: { x: c.direction[0], y: c.direction[1], z: c.direction[2] } }));
      assert.ok(hd.setViewpoint(vp));
      assert.equal(hd.section().length, 6, 'the viewpoint\'s section');
      delete vp.clipping_planes;
      hd.setViewpoint(vp);
      assert.equal(hd.section().length, 0, 'a viewpoint without planes shows everything');
    });
    // A saved view draws with its section.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:0; top:0; width:800px; height:500px;';
    document.body.appendChild(host);
    try {
      const told = [];
      const hd = await draw.render(host, { datasetId: modelId, view: saved }, { onSection: (list) => told.push(list.length) });
      assert.equal(hd.section().length, 6, 'the saved section');
      assert.deepEqual(told, [6]);
      hd.destroy();
    } finally { host.remove(); }
    // BCF files write and read the planes.
    const camera = { camera_view_point: { x: 10, y: 2, z: 5 }, camera_direction: { x: -1, y: 0, z: 0 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 45, aspect_ratio: 1.6 };
    const clip = [{ location: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: 1 } }];
    const xml = bcfXml.viewpointXml({ guid: 'a', perspective_camera: camera, clipping_planes: clip });
    assert.ok(xml.indexOf('<ClippingPlanes>') > xml.indexOf('</PerspectiveCamera>'), 'after the camera, as the schema has it');
    const items = [{ topic: { guid: 'c1d2e3f4-0000-4000-8000-0000000000a1', title: 'Snitt' }, comments: [], viewpoints: [{ viewpoint: { guid: 'c1d2e3f4-0000-4000-8000-0000000000a2', perspective_camera: camera, clipping_planes: clip, components: { selection: [] } } }] }];
    const written = await bcfXml.write(items, { projectName: 'Projektet' });
    const read = await bcfXml.read(await written.arrayBuffer());
    assert.deepEqual(read.viewpoints[0].clipping_planes, clip, 'the planes come back');
    const invalid = await D.require('tests/bcf-schema-check').checkBlob(written);
    if (invalid) assert.deepEqual(invalid, [], 'valid BCF 3.0');
    return 'ok';
  }, 60000);

  test('navigation: the panel Snitt in Bearbeta cuts at a storey and takes the section away', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed; left:0; top:0; width:1400px; height:900px; z-index:9000; background:white;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const id = await theModel();
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === id), 5000, 'dataset in the store');
      shell.store.set({ selectedId: id });
      shell.activate('bearbeta');
      await waitFor(() => root.querySelector('.dm-model-host dm-viewcube'), 30000, 'the 3D view');
      const btn = root.querySelector('[data-model-section]');
      btn.querySelector('button').click();
      const panel = await waitFor(() => root.querySelector('.dm-right [data-model-section-panel]'), 5000, 'the panel');
      assert.ok(!btn.hasAttribute('active'), 'opening the panel cuts nothing');
      const z = panel.querySelector('[data-model-section-to-z]');
      assert.ok(z && panel.querySelector('[data-model-section-from-x]'), 'two sliders per axis');
      /** @type {any} */ (z).value = '50';
      z.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
      assert.ok(btn.hasAttribute('active'), 'a slider cuts');
      const storey = panel.querySelector('[data-model-section-storey]');
      if (storey) {
        const opts = Array.from(storey.querySelectorAll('option')).map((o) => o.value).filter(Boolean);
        assert.ok(opts.length > 0, 'the storeys to cut at');
        /** @type {any} */ (storey).value = opts[0];
        storey.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => root.querySelector('.dm-right [data-model-section-panel]') !== panel, 5000, 'the panel drawn again');
      }
      root.querySelector('[data-model-section-clear] button').click();
      await waitFor(() => !btn.hasAttribute('active'), 3000, 'the section taken away');
      return 'ok';
    } finally {
      root.remove();
      draw.clearCache();
    }
  }, 120000);

  test('navigation: a DXF drawing zooms to its rows, pinches and follows the keys', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed; left:0; top:0; width:1400px; height:900px; z-index:9000; background:white;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const meta = await imports.run(fixtures.dxfFile(), { format: 'model' }, null, 'Navigeringsritning');
      created.push(meta.id);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'drawing in the store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('bearbeta');
      const svg = await waitFor(() => root.querySelector('.dm-dxf-svg'), 8000, 'the drawing');
      const host = root.querySelector('.dm-dxf-host');
      const vb = () => svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const home = vb();
      assert.equal(host.tabIndex, 0, 'the drawing can have focus');
      const key = (k) => host.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      key('+');
      assert.ok(vb()[2] < home[2] * 0.9, '+ comes closer');
      key('ArrowLeft');
      const left = vb();
      key('ArrowRight');
      assert.ok(vb()[0] > left[0], 'the arrows move');
      key('Home');
      assert.deepEqual(vb(), home, 'Home shows all');
      // Two pointers that spread zoom in about their middle.
      const r = host.getBoundingClientRect();
      const at = (id, x, type) => host.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, clientX: r.left + x, clientY: r.top + r.height / 2 }));
      at(1, r.width * 0.45, 'pointerdown'); at(2, r.width * 0.55, 'pointerdown');
      at(2, r.width * 0.75, 'pointermove');
      at(1, r.width * 0.45, 'pointerup'); at(2, r.width * 0.75, 'pointerup');
      assert.ok(vb()[2] < home[2] * 0.8, 'a pinch zooms in: ' + vb()[2] + ' < ' + home[2]);
      key('Home');
      // A row in the table zooms to its object.
      const row = await waitFor(() => root.querySelectorAll('.dm-model-table [role="row"]')[1], 5000, 'a row');
      /** @type {any} */ (row.querySelector('[role="gridcell"], .dm-td') || row).click();
      await waitFor(() => vb()[2] < home[2] * 0.999 || vb()[0] !== home[0], 3000, 'the drawing zoomed to the object');
      key('Home');
      root.querySelector('[data-model-zoom-marked] button').click();
      assert.ok(JSON.stringify(vb()) !== JSON.stringify(home), 'Zooma till markerade zooms to the marked object');
      assert.ok(!root.querySelector('[data-model-ortho]') && !root.querySelector('dm-viewcube'), 'no 3D tools on a drawing');
      return 'ok';
    } finally { root.remove(); }
  }, 60000);

  test('navigation: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    created.length = 0;
    modelId = null;
    return 'ok';
  });
})();
