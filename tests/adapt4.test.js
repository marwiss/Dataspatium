// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Bearbeta following the kind of dataset: comments on objects, a picture's place and labels, a document's text and
 * labels, masking, a graph's duplicates, a model's classification, a plan's status, repairing geometries, coordinates from
 * another system, what is chosen on the map and a table row's pictures. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const comments = D.require('data/comments');
  const block = D.require('ui/kinds/comment-block');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function make(name, columns, rows, extra = {}) {
    const meta = await datasets.create(Object.assign({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows }, extra));
    created.push(meta.id);
    return meta;
  }
  const track = (meta) => { created.push(meta.id); return meta; };
  async function photo(name) {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d').fillRect(0, 0, 80, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return new File([await blob.arrayBuffer()], name, { type: 'image/jpeg' });
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
  const button = (root, text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button')).click();
  const fill = (el, value) => { /** @type {any} */ (el).value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const inputOf = (root, label) => Array.from(root.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === label);
  async function rejects(assert, fn, label) {
    let failed = false;
    try { await fn(); } catch (_err) { failed = true; }
    assert.ok(failed, label);
  }
  const dialogButton = (text) => waitFor(() => Array.from(document.querySelectorAll('dialog[open] dm-button')).find((x) => x.textContent.trim() === text), 5000, text);
  const NET = () => ({
    directed: true,
    nodes: [{ id: 'a', labels: ['Person'], name: 'Åsa Berg', properties: {} }, { id: 'b', labels: ['Person'], name: 'asa  berg', properties: {} }, { id: 'c', labels: ['Person'], name: 'Bo', properties: {} }, { id: 'd', labels: ['Stad'], name: 'Bo', properties: {} }],
    edges: [{ id: 'e1', source: 'b', target: 'c', type: 'KANNER', properties: {} }, { id: 'e2', source: 'a', target: 'b', type: 'KANNER', properties: {} }],
  });

  test('comments: on an object, kept with the way back, also in files from before', async (assert) => {
    const meta = await make('Kommentarer', [['a', 'integer']], [[1]]);
    const handle = await datasets.ensureOpen(meta.id);
    await handle.engine.run('create table _comments (id text primary key, ts text, author text, text text, column_name text, resolved integer default 0)');
    await handle.engine.run("insert into _comments (id, ts, author, text) values ('old', '2020-01-01', 'A', 'Äldre')");
    // The status bar and a view can ask at the same moment; both would add the missing column, and the second would fail.
    const together = await Promise.all([comments.list(meta.id), comments.list(meta.id), comments.list(meta.id)]);
    assert.equal(together[2][0].text, 'Äldre', 'several at once on a file from before');
    const before = await comments.list(meta.id);
    assert.equal(before[0].text, 'Äldre', 'a file from before can be read');
    assert.equal(before[0].target, null);
    const target = { key: 'row:1', label: 'Rad ett', open: { openMapRow: { datasetId: 'gammalt', rowid: 1 } } };
    await comments.add(meta.id, { text: 'Om raden', target });
    const after = await comments.list(meta.id);
    assert.deepEqual(after[1].target, target, 'comes back as it was');
    assert.deepEqual(after.filter((c) => c.target && c.target.key === 'row:1').map((c) => c.text), ['Om raden']);
    // The way back works after a bundle has given the dataset a new id.
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      block.openTarget(shell.ctx, { id: meta.id }, target);
      const state = shell.store.get();
      assert.equal(state.selectedId, meta.id);
      assert.equal(state.openMapRow.datasetId, meta.id, 'not the old id');
      shell.store.set({ openMapRow: null });
    });
    return 'ok';
  }, 20000);

  test('comments: from an object\'s inspector to the list in Hantera and back', async (assert) => {
    const net = track(await graph.createGraphDataset({ name: 'Kommenterad graf', graph: NET() }));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      const ds = shell.store.get().datasets.find((d) => d.id === net.id);
      const inspector = document.createElement('div');
      root.appendChild(inspector);
      const data = { id: 'c', etikett: 'Person', namn: 'Bo', egenskaper: '{}' };
      const target = block.targetOf(ds, 'node:c', 'Bo', (col) => data[col]);
      assert.equal(target.open.openNode.id, 'c', 'the kind says how to find it');
      const el = block.create(shell.ctx, ds, target);
      inspector.appendChild(el);
      const box = await waitFor(() => el.querySelector('dm-input'), 3000, 'the field');
      fill(box, 'Vem är det här?');
      click(button(el, t('comments.add')));
      await waitFor(() => el.textContent.includes('Vem är det här?'), 3000, 'the comment');
      shell.store.set({ selectedId: net.id });
      shell.activate('hantera');
      const commentsTab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"], dm-tabs button')).find((b) => b.textContent.trim() === t('comments.title')), 5000, 'the tab');
      /** @type {HTMLElement} */ (commentsTab).click();
      const show = await waitFor(() => button(root, t('comments.show')), 5000, 'the way back');
      assert.ok(root.textContent.includes('Vem är det här?') && root.textContent.includes('Bo'), 'says what it is about');
      click(show);
      await waitFor(() => shell.store.get().mode === 'bearbeta' || root.querySelector('.dm-graph-view, canvas'), 5000, 'in Bearbeta');
    });
    return 'ok';
  }, 45000);

  test('pictures: a label makes a column when needed, a place makes the picture a place, half a place is refused', async (assert) => {
    const album = track(await importer.runFiles([await photo('plats.jpg')], { format: 'images' }, 'Platslösa bilder'));
    const facets = D.require('data/facets');
    assert.equal(await facets.has(album.id, 'spatial'), false);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
      shell.store.set({ selectedId: album.id });
      shell.activate('bearbeta');
      const item = await waitFor(() => root.querySelector('.dm-photos-item, .dm-gallery-item'), 8000, 'the picture');
      /** @type {HTMLElement} */ (item).click();
      const right = root.querySelector('.dm-right');
      await waitFor(() => inputOf(right, t('gallery.labels')), 5000, 'the form');
      fill(inputOf(right, t('gallery.labels')), 'fasad, tak');
      fill(inputOf(right, t('soka.place.lat')), '63,83');
      click(button(right, t('common.save')));
      await waitFor(() => Array.from(document.querySelectorAll('dm-toast, .dm-toast')).some((x) => x.textContent.includes(t('gallery.place.err'))), 3000, 'half a place is refused');
      assert.ok(!(await datasets.columns(album.id)).some((c) => c.name === 'etiketter'), 'nothing was saved');
      fill(inputOf(right, t('soka.place.lon')), '20.26');
      click(button(right, t('common.save')));
      await waitFor(async () => (await datasets.columns(album.id)).some((c) => c.name === 'etiketter'), 5000, 'the column');
      await waitFor(async () => { const r = await (await datasets.ensureOpen(album.id)).engine.exec('select lat, lon, etiketter from data'); const v = r[0].values[0]; return v[0] === 63.83 && v[1] === 20.26 && v[2] === 'fasad, tak'; }, 5000, 'the values');
      assert.ok(await facets.has(album.id, 'spatial'), 'now it can be on the map');
      const search = D.require('analysis/search');
      assert.equal((await search.searchDataset(album.id, 'fasad', [])).count, 1, 'and the label can be searched');
      // Saving again changes nothing, so no step is added.
      const steps = (await recipes.steps(album.id)).length;
      click(button(right, t('common.save')));
      await wait(300);
      assert.equal((await recipes.steps(album.id)).length, steps, 'nothing new to save');
    });
    return 'ok';
  }, 45000);

  test('documents: corrected text, labels that last, and masking that says what it does not touch', async (assert) => {
    const dsFiles = D.require('data/dataset-files');
    const source = '# Rubrik\n\nKontakta anna.andersson@example.se eller se sidan.\n\nEn felstavd rad.\n';
    const doc = track(await importer.runFiles([new File([source], 'brev.md', { type: 'text/markdown' })], { format: 'documents' }, 'Brev'));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === doc.id), 3000, 'dataset');
      shell.store.set({ selectedId: doc.id });
      shell.activate('bearbeta');
      const para = await waitFor(() => Array.from(root.querySelectorAll('[data-rowid]')).find((x) => x.textContent.includes('felstavd')), 8000, 'the paragraph');
      /** @type {HTMLElement} */ (para).click();
      const right = root.querySelector('.dm-right');
      const box = await waitFor(() => inputOf(right, t('document.text')), 3000, 'the text field');
      assert.ok(right.textContent.includes(t('document.text.note')), 'says the original stays');
      fill(box, 'En rättad rad.');
      const save = Array.from(right.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('common.save'));
      click(save);
      await waitFor(async () => { const r = await (await datasets.ensureOpen(doc.id)).engine.exec("select count(*) from data where text = 'En rättad rad.'"); return Number(r[0].values[0][0]) === 1; }, 5000, 'the corrected text');
      await waitFor(() => root.textContent.includes('En rättad rad.'), 3000, 'on the page');
      const original = await dsFiles.read(doc.id, 'brev.md', 'original');
      assert.ok(new TextDecoder().decode(original.bytes).includes('felstavd'), 'the file is untouched');
      // Labels.
      const labels = inputOf(right, t('gallery.labels'));
      fill(labels, 'brev, 2026');
      await waitFor(async () => { const d = await datasets.get(doc.id); return d.documents[0].labels && d.documents[0].labels.length === 2; }, 3000, 'the labels');
      // Masking asks first, and is one step that can be undone.
      click(button(right, t('document.mask')));
      click(await dialogButton(t('document.mask')));
      await waitFor(async () => { const r = await (await datasets.ensureOpen(doc.id)).engine.exec("select count(*) from data where text like '%anna.andersson%'"); return Number(r[0].values[0][0]) === 0; }, 5000, 'the masked text');
      await waitFor(() => Array.from(document.querySelectorAll('dm-toast, .dm-toast')).some((x) => x.textContent.includes(t('document.masked', { n: 1 }))), 3000, 'what it says');
      await recipes.undo(doc.id);
      const back = await (await datasets.ensureOpen(doc.id)).engine.exec("select count(*) from data where text like '%anna.andersson%'");
      assert.equal(Number(back[0].values[0][0]), 1, 'undone');
    });
    // The labels last through a copy of the file.
    const bytes = await datasets.exportBytes(doc.id);
    const copy = track(await datasets.importBytes(bytes, { name: 'Brevkopia' }));
    assert.deepEqual((await datasets.get(copy.id)).documents[0].labels, ['brev', '2026']);
    return 'ok';
  }, 45000);

  test('graph: suggests duplicates and merges only when asked', async (assert) => {
    const ops = D.require('data/graph-ops');
    const net = track(await graph.createGraphDataset({ name: 'Dubbletter', graph: NET() }));
    const found = await ops.duplicates(net.id);
    assert.deepEqual(found.map((g) => g.ids), [['a', 'b']], 'case, accents and spaces do not count, and a label does');
    assert.equal((await datasets.get(net.id)).rowCount, 4, 'nothing is merged yet');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      shell.store.set({ selectedId: net.id });
      shell.activate('bearbeta');
      click(await waitFor(() => button(root, t('graph.dupes')), 10000, 'the button'));
      click(await dialogButton(t('graph.dupes.merge')));
      await waitFor(async () => (await datasets.get(net.id)).rowCount === 3, 5000, 'merged');
      const handle = await datasets.ensureOpen(net.id);
      const edges = (await handle.engine.exec('select kalla, mal from _edges'))[0].values;
      assert.deepEqual(edges, [['a', 'c']], 'the edges follow and a loop goes');
      await wait(100);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      click(await waitFor(() => button(root, t('graph.dupes')), 5000, 'the button again'));
      await waitFor(() => Array.from(document.querySelectorAll('dm-toast, .dm-toast')).some((x) => x.textContent.includes(t('graph.dupes.none'))), 3000, 'none left');
    });
    return 'ok';
  }, 45000);

  test('model: a classification on what shows, undone as one step', async (assert) => {
    const fixtures = D.require('tests/fixtures/ifc');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Klassat hus'));
    const handle = await datasets.ensureOpen(house.id);
    const count = async (where) => Number((await handle.engine.exec(`select count(*) from data where ${where}`))[0].values[0][0]);
    const walls = await count("typ = 'IfcWall'");
    const res = await recipes.apply(house.id, 'set_on_rows', { column: 'klassificering', value: '27.B', where: "typ = 'IfcWall'" });
    assert.equal(res.rows, walls);
    assert.equal(await count("klassificering = '27.B'"), walls);
    await recipes.undo(house.id);
    assert.equal(await count("klassificering = '27.B'"), 0, 'undone');
    await rejects(assert, () => recipes.apply(house.id, 'set_on_rows', { column: 'finns_inte', value: 'x', where: '1 = 1' }), 'an unknown column');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === house.id), 3000, 'dataset');
      shell.store.set({ selectedId: house.id });
      shell.activate('bearbeta');
      click(await waitFor(() => button(root, t('model.classify')), 30000, 'the button'));
      const box = await waitFor(() => document.querySelector('dialog[open] input, dialog[open] dm-input'), 3000, 'the question');
      assert.ok(document.querySelector('dialog[open]').textContent.includes(t('model.classify.prompt', { n: await count('1 = 1') })), 'says how many');
      fill(box, 'Stomme');
      click(await dialogButton(t('common.ok')));
      await waitFor(async () => (await count("klassificering = 'Stomme'")) > 0, 5000, 'set');
    });
    const drawing = track(await importer.run(fixtures.dxfFile(), { format: 'model' }, null, 'Klasslös ritning'));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === drawing.id), 3000, 'dataset');
      shell.store.set({ selectedId: drawing.id });
      shell.activate('bearbeta');
      await waitFor(() => root.querySelector('.dm-dxf-svg'), 8000, 'the drawing');
      assert.ok(!button(root, t('model.classify')), 'a drawing has no such column');
    });
    return 'ok';
  }, 60000);

  test('plan: status and a note last, and show on the plan', async (assert) => {
    const plan = await make('Statusplan', [['objektid', 'text'], ['objekttyp', 'text'], ['geometri', 'text']], [['o1', 'anvandning', JSON.stringify({ type: 'Point', coordinates: [15, 60] })]], { kind: 'plan' });
    const handle = await datasets.ensureOpen(plan.id);
    handle.meta.plan = { slag: 'detaljplan', status: 'Samråd' };
    await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(handle.meta.plan)]);
    await datasets.save(plan.id);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === plan.id), 3000, 'dataset');
      shell.store.set({ selectedId: plan.id });
      shell.activate('bearbeta');
      click(await waitFor(() => button(root, t('plan.status.edit')), 10000, 'the button'));
      const dialog = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
      fill(inputOf(dialog, t('plan.field.status')), 'Antagen');
      fill(inputOf(dialog, t('plan.field.note')), 'Överklagad, se beslut.');
      click(await dialogButton(t('common.save')));
      await waitFor(async () => (await datasets.get(plan.id)).plan.status === 'Antagen', 3000, 'saved');
      assert.equal((await datasets.get(plan.id)).plan.anteckning, 'Överklagad, se beslut.');
      assert.equal((await datasets.get(plan.id)).plan.slag, 'detaljplan', 'the rest stays');
      await waitFor(() => root.querySelector('.dm-right').textContent.includes('Överklagad'), 3000, 'on the page');
    });
    return 'ok';
  }, 30000);

  test('geometry: repaired where it can be, emptied where it cannot, and undone as one step', async (assert) => {
    const kindsOps = D.require('data/operations-kinds');
    const repaired = kindsOps.repairGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 0], [1, 1], [0, 1]]] });
    assert.deepEqual(repaired.coordinates[0], [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], 'repeats go, and the ring closes');
    assert.equal(kindsOps.repairGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] }), null, 'too little to be an area');
    assert.deepEqual(kindsOps.repairGeometry({ type: 'LineString', coordinates: [[0, 0], [0, 0], [1, 1]] }).coordinates, [[0, 0], [1, 1]], 'a line stays open');
    assert.equal(kindsOps.repairGeometry({ type: 'Point', coordinates: ['x', 1] }), null);
    assert.equal(kindsOps.repairGeometry({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 1] }, { type: 'Point', coordinates: [] }] }).geometries.length, 1);
    const good = JSON.stringify({ type: 'Point', coordinates: [15, 60] });
    const wkt = 'POINT (15 60)';
    const ring = JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] });
    const meta = await make('Trasiga former', [['namn', 'text'], ['geometri', 'text']], [['bra', good], ['wkt', wkt], ['ring', ring], ['trasig', 'inte en form'], ['tom', null]]);
    const res = await recipes.apply(meta.id, 'geo_repair', { column: 'geometri' });
    assert.deepEqual([res.repaired, res.removed], [1, 1]);
    const rows = (await datasets.query(meta.id)).map((r) => r[1]);
    assert.equal(rows[0], good, 'a good one is not touched');
    assert.equal(rows[1], wkt, 'nor one in another form');
    assert.equal(JSON.parse(rows[2]).coordinates[0].length, 5);
    assert.equal(rows[3], null);
    await recipes.undo(meta.id);
    assert.equal((await datasets.query(meta.id))[3][1], 'inte en form', 'undone');
    assert.equal(D.require('data/operations').get('geo_repair').group, 'geo');
    return 'ok';
  }, 20000);

  test('coordinates: from another system through a step, chosen in the dialog by name', async (assert) => {
    const meta = await make('RT 90-steg', [['ost', 'number'], ['norr', 'number']], [[1628000, 6580822], [null, null]]);
    const res = await recipes.apply(meta.id, 'geo_from_system', { xColumn: 'ost', yColumn: 'norr', crs: '3021', xName: 'lon', yName: 'lat' });
    assert.equal(res.rows, 1);
    const row = (await datasets.query(meta.id))[0];
    assert.ok(Math.abs(row[2] - 18.05) < 0.05 && Math.abs(row[3] - 59.33) < 0.05, row.join(','));
    assert.ok((await recipes.steps(meta.id)).some((x) => x.description), 'the step is described');
    await rejects(assert, () => recipes.apply(meta.id, 'geo_from_system', { xColumn: 'ost', yColumn: 'norr', crs: '3021', xName: 'lon', yName: 'lat' }), 'the columns exist');
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      const dialogs = D.require('ui/dialogs');
      const opened = dialogs.run({ datasetId: meta.id, columns: await datasets.columns(meta.id), onApplied() {} }, 'geo_from_system');
      const dialog = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
      const pick = /** @type {any} */ (await waitFor(() => Array.from(dialog.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('op.geo_from_system.crs')), 3000, 'the systems'));
      assert.ok(pick.options.some((o) => o.value === '3021' && o.label.includes('RT 90')), 'by name, not by number');
      /** @type {any} */ (dialog).close();
      await Promise.race([opened, wait(200)]);
    });
    return 'ok';
  }, 30000);

  test('map: what is chosen is marked, a place can be commented on and a saved view forgets the rows', async (assert) => {
    const selection = D.require('data/selection');
    const meta = await make('Märkta platser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.83], ['Luleå', 22.15, 65.58]]);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      const ds = shell.store.get().datasets.find((d) => d.id === meta.id);
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
      const center = document.createElement('div'); center.style.height = '700px';
      const right = document.createElement('div');
      host.append(center, right);
      document.body.appendChild(host);
      selection.set({ datasetId: meta.id, rowids: [2] });
      const view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {} });
      try {
        await view.render(ds, { center, right });
        await waitFor(() => view.handle, 5000, 'the map');
        const marked = await waitFor(() => view.marks && view.marks.getLayers().length === 1 && view.marks, 3000, 'one mark');
        assert.ok(Math.abs(marked.getLayers()[0].getLatLng().lat - 65.58) < 0.001, 'on the chosen place');
        selection.clear();
        const dots = [];
        view.handle.map.eachLayer((l) => { if (l.feature && l.getLatLng && l.feature.properties.namn === 'Umeå') dots.push(l); });
        dots[0].fire('click');
        const box = await waitFor(() => right.querySelector('.dm-object-comments dm-input'), 3000, 'the comment field');
        assert.ok(!right.textContent.includes('_rowid'), 'the row number is not a column to show');
        fill(box, 'Kontrollera läget');
        click(button(right, t('comments.add')));
        await waitFor(async () => (await comments.list(meta.id)).some((c) => c.target && c.target.key === 'row:1'), 3000, 'kept with its row');
        const saved = (await comments.list(meta.id)).find((c) => c.target);
        assert.deepEqual(saved.target.open.openMapRow, { datasetId: meta.id, rowid: 1 });
        const realPrompt = shell.ctx.ui.dialog.prompt;
        shell.ctx.ui.dialog.prompt = async () => 'Sparad vy';
        try {
          click(button(center, t('map.save.chart')));
          const charts = D.require('viz/charts');
          const chart = await waitFor(async () => (await charts.list()).find((c) => c.name === 'Sparad vy'), 5000, 'the saved view');
          assert.equal(chart.map.layers[0].withRowid, undefined, 'a saved view does not carry row numbers');
          await charts.remove(chart.id);
        } finally { shell.ctx.ui.dialog.prompt = realPrompt; }
      } finally { view.destroy(); host.remove(); selection.clear(); }
    });
    return 'ok';
  }, 30000);

  test('table: a row that names pictures shows them', async (assert) => {
    const album = track(await importer.runFiles([await photo('radbild.jpg')], { format: 'images' }, 'Radbilder'));
    const rows = await make('Rader med bilder', [['plats', 'text'], ['foto', 'text']], [['A', 'radbild.jpg'], ['B', null]]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === rows.id), 3000, 'dataset');
      shell.store.set({ selectedId: rows.id });
      shell.activate('bearbeta');
      const table = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-table-wrap dm-table'), 5000, 'the table'));
      const cell = await waitFor(() => Array.from(table.querySelectorAll('[role="gridcell"]')).find((c) => c.textContent === 'radbild.jpg'), 5000, 'the row');
      /** @type {HTMLElement} */ (cell).click();
      const picture = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-right .dm-photos-item img'), 5000, 'the picture'));
      await waitFor(() => picture.naturalWidth > 0, 3000, 'decoded');
      /** @type {HTMLElement} */ (root.querySelector('.dm-right .dm-photos-item')).click();
      await waitFor(() => shell.store.get().selectedId === album.id, 3000, 'goes to the collection');
    });
    return 'ok';
  }, 30000);

  test('table: a number typed in a cell means what it looks like, and undo gives the same number back', async (assert) => {
    const meta = await make('Celler', [['tal', 'number']], [[1.5]]);
    const value = async () => (await datasets.query(meta.id))[0][0];
    const typed = async (text) => { await recipes.apply(meta.id, 'edit_cell', { rowid: 1, column: 'tal', value: text }); return value(); };
    assert.equal(await typed('3.14'), 3.14, 'a point that cannot be thousands');
    assert.equal(await typed('3,14'), 3.14, 'a decimal comma');
    assert.equal(await typed('1 234,5'), 1234.5, 'thousands with a space');
    assert.equal(await typed('63.123456'), 63.123456, 'many decimals');
    assert.equal(await typed('1.234'), 1234, 'in Swedish a thousands point');
    const i18n = D.require('ui/i18n');
    const language = i18n.language();
    i18n.setLanguage('en');
    try {
      assert.equal(await typed('1.234'), 1.234, 'in English a decimal point');
      assert.equal(await typed('1,234'), 1234, 'and a thousands comma');
    } finally { i18n.setLanguage(language); }
    await typed('2,5');
    await typed('7');
    await recipes.undo(meta.id);
    assert.equal(await value(), 2.5, 'undo gives the same number back');
    return 'ok';
  }, 15000);

  test('adapt4: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
