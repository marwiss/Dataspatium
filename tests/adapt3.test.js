// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Inhämta and Hantera following the kind of dataset: saying what a file is, the questions worth asking, mixed
 * folders, a picture per dataset, batch actions by common ability and versions in the kind's own units. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const sense = D.require('io/file-sense');
  const geo = D.require('data/geo');
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
  const csvFile = (text, name = 'platser.csv') => new File([text], name, { type: 'text/csv' });
  const previewOf = (text) => importer.preview(csvFile(text));
  const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
  const NET = () => ({
    directed: true,
    nodes: [{ id: 'a', labels: ['X'], name: 'A', properties: {} }, { id: 'b', labels: ['X'], name: 'B', properties: {} }, { id: 'c', labels: ['X'], name: 'C', properties: {} }],
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'K', properties: {} }, { id: 'e2', source: 'b', target: 'c', type: 'K', properties: {} }],
  });
  async function photo(name) {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d').fillRect(0, 0, 80, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return new File([await blob.arrayBuffer()], name, { type: 'image/jpeg' });
  }
  async function makePdf() {
    const JsPdf = await D.require('viz/export').ensurePdfLibs();
    const doc = new JsPdf();
    doc.text('Forsta sidan', 20, 20);
    return new File([doc.output('arraybuffer')], 'sida.pdf', { type: 'application/pdf' });
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

  test('file sense: coordinates in degrees, swapped, in Swedish order and small numbers that are not coordinates', async (assert) => {
    const plain = await previewOf('namn,lon,lat\nUmeå,20.26,63.83\nLuleå,22.15,65.58\n');
    assert.equal(sense.coordinates(plain).state, 'degrees');
    assert.equal(sense.describe(plain).key, 'import.sense.places');
    assert.deepEqual(sense.questions(plain), [], 'nothing to ask');
    assert.equal(await sense.placeName(sense.mapTable(plain).rows.slice(0, 1)), 'Umeå', 'says where they are');
    const comma = await previewOf('namn;lon;lat\nUmeå;20,26;63,83\nLuleå;22,15;65,58\n');
    assert.equal(sense.coordinates(comma).state, 'degrees', 'with a decimal comma');
    const swapped = await previewOf('namn,lon,lat\nUmeå,63.83,20.26\nLuleå,65.58,22.15\n');
    assert.equal(sense.coordinates(swapped).state, 'swapped');
    assert.deepEqual(sense.questions(swapped).map((q) => q.id), ['swap']);
    assert.deepEqual(sense.mapTable(swapped, { swap: true }).rows[0], [20.26, 63.83], 'the map follows the answer');
    const impossible = await previewOf('lon,lat\n59,150\n60,151\n');
    assert.equal(sense.coordinates(impossible).state, 'swapped', 'a latitude of 150 cannot be one');
    const sweden = await previewOf('x;y\n7087000;757000\n7088000;758000\n');
    const state = sense.coordinates(sweden);
    assert.equal(state.state, 'projected-swapped', 'X is north');
    assert.equal(state.system, '3006');
    assert.deepEqual(sense.questions(sweden).map((q) => q.id), ['swap', 'crs']);
    const rows = sense.mapTable(sweden, { swap: true }).rows;
    assert.ok(near(rows[0][0], 20.26, 0.1) && near(rows[0][1], 63.83, 0.1), rows[0].join(','));
    assert.equal(await sense.placeName(rows.slice(0, 1)), 'Umeå');
    const small = await previewOf('x,y\n1,2\n3,4\n');
    assert.equal(sense.coordinates(small), null, 'small numbers under x and y');
    assert.equal(sense.describe(small).key, 'import.sense.table');
    const nowhere = await previewOf('lon,lat\n-30,40\n-31,41\n');
    assert.equal(await sense.placeName(sense.mapTable(nowhere).rows), null, 'out in the Atlantic');
    // The names change places and back.
    const specs = sweden.inferred.map((c) => Object.assign({}, c));
    sense.swapNames(specs, 'x', 'y');
    assert.deepEqual(specs.map((c) => c.name), ['y', 'x']);
    sense.swapNames(specs, 'x', 'y');
    assert.deepEqual(specs.map((c) => c.name), ['x', 'y']);
    return 'ok';
  }, 20000);

  test('file sense: another coordinate system gives columns in degrees and keeps the originals', async (assert) => {
    for (const s of sense.SYSTEMS) assert.ok(geo.knownCrs(s.value), 'the app can read ' + s.label);
    const stockholm = geo.toWgs84({ type: 'Point', coordinates: [1628000, 6580822] }, '3021').coordinates;
    assert.ok(near(stockholm[0], 18.07, 0.05) && near(stockholm[1], 59.33, 0.05), 'RT 90 in Stockholm: ' + stockholm.join(','));
    const text = 'namn;ost;norr\nStockholm;1628000;6580822\nUtan;;\n';
    const p = await previewOf(text);
    assert.equal(sense.coordinates(p).system, '3021', 'east of a million is RT 90');
    assert.deepEqual(sense.reprojectOption(p, {}), { east: 'ost', north: 'norr', crs: '3021' });
    assert.equal(sense.reprojectOption(p, { crs: '3006' }), null, 'SWEREF 99 TM needs nothing');
    const specs = p.inferred.map((c) => Object.assign({ include: true }, c));
    const meta = track(await importer.run(csvFile(text), { format: 'csv', reproject: sense.reprojectOption(p, {}) }, specs, 'RT 90-platser'));
    const columns = await datasets.columns(meta.id);
    assert.deepEqual(columns.map((c) => c.name), ['namn', 'ost_original', 'norr_original', 'lon', 'lat']);
    const row = (await datasets.query(meta.id))[0];
    assert.equal(row[1], 1628000, 'the original stays');
    assert.ok(near(row[3], 18.07, 0.05) && near(row[4], 59.33, 0.05), row.join(','));
    const empty = (await datasets.query(meta.id))[1];
    assert.equal(empty[3], null, 'a row without coordinates stays empty');
    const leaflet = D.require('viz/leaflet');
    assert.deepEqual(leaflet.coordinateColumns(columns), { lon: 'lon', lat: 'lat' }, 'the map finds the degrees');
    assert.ok(await D.require('data/facets').has(meta.id, 'spatial'));
    // A UTM zone, chosen by the user, with columns that already were called lon and lat.
    const utmText = 'lon;lat\n674000;6580000\n';
    const utm = await previewOf(utmText);
    const answer = sense.reprojectOption(utm, { crs: '25833' });
    const made = track(await importer.run(csvFile(utmText), { format: 'csv', reproject: answer }, utm.inferred.map((c) => Object.assign({ include: true }, c)), 'UTM-platser'));
    assert.deepEqual((await datasets.columns(made.id)).map((c) => c.name), ['lon_original', 'lat_original', 'lon', 'lat']);
    const utmRow = (await datasets.query(made.id))[0];
    assert.ok(near(utmRow[2], 18.07, 0.1) && near(utmRow[3], 59.33, 0.1), utmRow.join(','));
    return 'ok';
  }, 20000);

  test('file sense: each kind of file is said in its own words, and a list of links can become a graph', async (assert) => {
    const links = await previewOf('from,to,typ\nA,B,x\nB,C,y\n');
    assert.equal(sense.describe(links).key, 'import.sense.network');
    assert.deepEqual(sense.questions(links), [{ id: 'graph', params: { from: 'from', to: 'to' }, hint: 'import.q.graph.hint' }]);
    const text = 'from,to,typ\nA,B,x\nB,C,y\n';
    const table = await importer.run(csvFile(text, 'kopplingar.csv'), { format: 'csv' }, null, 'Kopplingar');
    const net = track(await sense.toGraph(table, { from: 'from', to: 'to' }));
    assert.equal(net.kind, 'graph');
    assert.equal(net.rowCount, 3, 'the nodes are made from the values');
    assert.equal(net.graph.edges, 2);
    assert.ok(!(await datasets.get(table.id)), 'the table is not kept beside it');
    const fixtures = D.require('tests/fixtures/ifc');
    const ifc = await importer.preview(fixtures.ifcFile({ walls: 3 }));
    assert.equal(sense.describe(ifc).key, 'import.sense.ifc');
    assert.ok(sense.describe(ifc).params.n > 0, 'with its elements');
    assert.deepEqual(sense.questions(ifc), [], 'no questions about a model');
    const dxf = await importer.preview(fixtures.dxfFile());
    assert.equal(sense.describe(dxf).key, 'import.sense.dxf');
    assert.ok(dxf.drawing.includes('<svg'), 'the drawing is there to be seen');
    const shapes = await previewOf('namn;geometri\nA;{"type":"Point","coordinates":[15,60]}\n');
    assert.equal(sense.describe(shapes).key, 'import.sense.shapes');
    assert.ok(sense.mapTable(shapes), 'shapes can be drawn');
    const notShapes = await previewOf('namn;geometri\nA;inte en form\n');
    assert.equal(sense.describe(notShapes).key, 'import.sense.table', 'the values decide, not the name');
    const graphFile = new File([JSON.stringify({ nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] })], 'natverk.json', { type: 'application/json' });
    const g = await importer.preview(graphFile);
    assert.equal(sense.describe(g).key, 'import.sense.graph');
    assert.deepEqual(g.sample.edges, [['a', 'b']]);
    const scanned = await (async () => { const JsPdf = await D.require('viz/export').ensurePdfLibs(); const doc = new JsPdf(); return new File([doc.output('arraybuffer')], 'skannad.pdf', { type: 'application/pdf' }); })();
    assert.equal(sense.describe(await importer.preview(scanned)).key, 'import.sense.document.notext', 'a page without text says so');
    assert.ok(sense.mapTable({ kind: 'plan', importer: 'detaljplan', columns: ['geometri'], inferred: [{ name: 'geometri', type: 'text' }], dataRows: [[JSON.stringify({ type: 'Point', coordinates: [15, 60] })]] }), 'a plan can be drawn before it is read');
    const picture = await photo('en.jpg');
    const img = await importer.preview(picture);
    assert.equal(sense.describe(img, { files: [picture, picture] }).params.n, 2);
    return 'ok';
  }, 30000);

  test('import wizard: what the file is comes first, the map follows the answer and the import keeps it', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone');
      const text = 'plats;x;y\nUmeå;7087000;757000\nUmeå 2;7088000;758000\n';
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [csvFile(text, 'svenska.csv')] }, bubbles: true }));
      const card = await waitFor(() => root.querySelector('.dm-sense'), 5000, 'the sentence');
      assert.ok(card.textContent.includes(t('import.sense.places', { lon: 'x', lat: 'y' })), card.textContent);
      const swap = /** @type {any} */ (card.querySelector('dm-switch'));
      assert.ok(swap && !swap.checked, 'asked, not assumed');
      swap.checked = true;
      swap.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelector('.dm-sense dm-switch') && /** @type {any} */ (root.querySelector('.dm-sense dm-switch')).checked, 2000, 'the answer stays');
      await waitFor(() => root.querySelector('.dm-api-map svg'), 3000, 'the map');
      await waitFor(() => Array.from(root.querySelectorAll('.dm-center .dm-help')).some((p) => p.textContent === t('import.sense.where', { name: 'Umeå' })), 5000, 'the name of the place');
      const drawn = root.querySelector('.dm-api-map svg').getBoundingClientRect();
      assert.ok(drawn.width > 200 && drawn.height > 80, `the map has a size on the page: ${drawn.width} x ${drawn.height}`);
      assert.ok(root.querySelector('.dm-table-preview').getBoundingClientRect().height > 200, 'and leaves room for the rows');
      click(button(root, t('common.next')));
      await waitFor(() => button(root, t('common.import')), 3000, 'the column step');
      click(button(root, t('common.import')));
      await waitFor(() => root.querySelector('.dm-success'), 8000, 'the result');
      const made = await waitFor(() => shell.store.get().datasets.find((d) => d.name === 'svenska'), 3000, 'the dataset');
      created.push(made.id);
      const columns = await datasets.columns(made.id);
      assert.deepEqual(columns.map((c) => c.name), ['plats', 'y', 'x'], 'the names changed places');
      assert.ok(await D.require('viz/leaflet').drawable(made.id));
      assert.equal((await D.require('data/spatial-search').rowsWithin(made.id, { type: 'near', lat: 63.83, lon: 20.26, km: 20 })).length, 2, 'and the places are where they should be');
      // A table of links, read as a graph through the wizard.
      click(button(root, t('import.another')));
      const again = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone again');
      again.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [csvFile('from,to\nA,B\nB,C\n', 'lankar.csv')] }, bubbles: true }));
      const sw = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-sense dm-switch'), 5000, 'the question'));
      sw.checked = true;
      sw.dispatchEvent(new Event('change', { bubbles: true }));
      click(await waitFor(() => button(root, t('common.next')), 2000, 'next'));
      click(await waitFor(() => button(root, t('common.import')), 3000, 'import'));
      await waitFor(() => root.querySelector('.dm-success'), 8000, 'the second result');
      const net = await waitFor(() => shell.store.get().datasets.find((d) => d.name === 'lankar' && d.kind === 'graph'), 3000, 'the graph');
      created.push(net.id);
      await waitFor(() => shell.store.get().datasets.filter((d) => d.name === 'lankar').length === 1, 3000, 'only the graph');
    });
    return 'ok';
  }, 45000);

  test('import wizard: a mixed choice is sorted, a folder can be dropped, and one failure does not stop the rest', async (assert) => {
    const pics = [await photo('a.jpg'), await photo('b.jpg')];
    const sorted = await importer.sortFiles([csvFile('x\n1\n', 'tal.csv'), pics[0], new File(['# R\n\nText\n'], 'text.md', { type: 'text/markdown' }), pics[1], new File(['x'], 'Thumbs.db'), new File(['x'], 'program.exe')]);
    assert.deepEqual(sorted.groups.map((g) => [g.importer, g.files.length]), [['images', 2], ['documents', 1], ['csv', 1]]);
    assert.deepEqual(sorted.skipped.map((f) => f.name), ['program.exe'], 'junk is silent, the unknown is said');
    const broken = new File(['{ inte json'], 'trasig.json', { type: 'application/json' });
    const results = await importer.runSorted([{ importer: 'json', collection: false, files: [broken] }, { importer: 'csv', collection: false, files: [csvFile('x\n1\n', 'hel.csv')] }]);
    assert.ok(results[0].error, 'the broken one says so');
    assert.ok(results[1].meta, 'the next one goes on');
    created.push(results[1].meta.id);
    // A dropped folder, with a reader that gives its entries in parts.
    const fileEntry = (file) => ({ isFile: true, isDirectory: false, name: file.name, file: (ok) => ok(file) });
    const reader = (parts) => { let i = 0; return { readEntries: (ok) => ok(parts[i++] || []) }; };
    const inner = { isFile: false, isDirectory: true, name: 'under', createReader: () => reader([[fileEntry(await0())]]) };
    function await0() { return new File(['y\n2\n'], 'djup.csv', { type: 'text/csv' }); }
    const dir = { isFile: false, isDirectory: true, name: 'Fältdata', createReader: () => reader([[fileEntry(pics[0])], [fileEntry(pics[1]), inner]]) };
    const zone = document.createElement('dm-dropzone');
    zone.setAttribute('multiple', '');
    document.body.appendChild(zone);
    try {
      const got = new Promise((resolve) => zone.addEventListener('dm-files', (e) => resolve(/** @type {any} */ (e).detail.files), { once: true }));
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: { files: [], items: [{ webkitGetAsEntry: () => dir }] } });
      zone.dispatchEvent(drop);
      const files = await got;
      assert.deepEqual(files.map((f) => f.name), ['a.jpg', 'b.jpg', 'djup.csv'], 'everything in the folder, in parts and below');
      assert.equal(files[2].dmPath, 'Fältdata/under/djup.csv');
      const onlyPictures = await importer.sortFiles(files.slice(0, 2));
      assert.equal(onlyPictures.groups[0].name, 'Fältdata', 'a collection from a folder has the name of the folder');
    } finally { zone.remove(); }
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const dz = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone');
      dz.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [csvFile('x\n1\n', 'blandad.csv'), csvFile('y\n2\n', 'bortvald.csv'), pics[0], pics[1], new File(['x'], 'program.exe')] }, bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-sort-row').length === 3, 5000, 'three rows');
      assert.ok(root.textContent.includes('program.exe'), 'what is skipped is said');
      const rows = Array.from(root.querySelectorAll('.dm-sort-row'));
      const off = /** @type {any} */ (rows.find((r) => r.textContent.includes('bortvald.csv')).querySelector('dm-switch'));
      off.checked = false;
      off.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.textContent.includes(t('import.sort.help', { n: 3 })), 2000, 'the count follows');
      click(button(root, t('import.sort.run')));
      const success = await waitFor(() => root.querySelector('.dm-success'), 10000, 'the result');
      assert.ok(success.textContent.includes(t('import.sort.done', { n: 2 })), success.textContent);
      const table = await waitFor(() => shell.store.get().datasets.find((d) => d.name === 'blandad'), 3000, 'the table');
      const album = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'images' && d.name === t('import.collection.images', { n: 2 })), 3000, 'the collection');
      const state = shell.store.get().datasets;
      assert.ok(!state.some((d) => d.name === 'bortvald'), 'what was turned off is not read');
      created.push(table.id, album.id);
      assert.ok(Array.from(success.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('hantera.view.images')), 'each with its way on');
    });
    return 'ok';
  }, 45000);

  test('import wizard: pictures and a first page are shown before anything is read', async (assert) => {
    const pics = [await photo('forhand-1.jpg'), await photo('forhand-2.jpg')];
    const pdf = await makePdf();
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const dz = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone');
      dz.dispatchEvent(new CustomEvent('dm-files', { detail: { files: pics }, bubbles: true }));
      const shown = await waitFor(() => { const l = root.querySelectorAll('.dm-import-photo'); return l.length === 2 ? l : null; }, 8000, 'the pictures');
      await waitFor(() => /** @type {any} */ (shown[0]).naturalWidth > 0, 3000, 'decoded');
      assert.ok(shown[0].getBoundingClientRect().width > 80, 'a picture one can see');
      click(button(root, t('common.back')));
      const again = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'back');
      again.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [pdf] }, bubbles: true }));
      const page = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-ds-picture img.dm-ds-page'), 15000, 'the first page'));
      await waitFor(() => page.naturalWidth > 0, 3000, 'the page is an image');
    });
    return 'ok';
  }, 45000);

  test('pdf: a document can be opened while another is being closed', async (assert) => {
    const pdf = D.require('engines/pdf');
    const bytes = new Uint8Array(await (await makePdf()).arrayBuffer());
    for (let i = 0; i < 3; i++) {
      const first = await pdf.open(bytes.slice());
      const closing = first.destroy();
      const second = await pdf.open(bytes.slice());
      assert.equal((await second.getPage(1)).pageNumber, 1, 'the next one opens');
      await closing;
      await second.destroy();
    }
    return 'ok';
  }, 20000);

  test('hantera: a picture per dataset, in its own form', async (assert) => {
    const picture = D.require('ui/kinds/dataset-picture');
    const fixtures = D.require('tests/fixtures/ifc');
    const net = track(await graph.createGraphDataset({ name: 'Bildgraf', graph: NET() }));
    const netPicture = await picture.draw(net);
    assert.equal(netPicture.querySelectorAll('circle').length, 3, 'its nodes');
    assert.equal(netPicture.querySelectorAll('line').length, 2, 'its edges');
    const places = await make('Bildplatser', [['lon', 'number'], ['lat', 'number']], [[15, 60], [16, 61]]);
    const mapPicture = await picture.draw(places);
    assert.equal(mapPicture.tagName.toLowerCase(), 'svg');
    assert.equal(mapPicture.getAttribute('role'), 'img');
    const years = await make('Bildserie', [['ar', 'integer'], ['tal', 'number']], [[2020, 1], [2021, 3], [2022, 2]]);
    const line = await picture.draw(years);
    const points = line.querySelector('polyline').getAttribute('points').split(' ');
    assert.equal(points.length, 3, 'one point per period');
    assert.ok(line.textContent.includes(t('datasets.picture.line', { value: 'tal', period: 'ar' })), 'and says what it shows');
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Bildhus'));
    const bars = await picture.draw(house);
    assert.ok(bars.textContent.includes('IfcWall'), bars.textContent);
    const drawing = track(await importer.run(fixtures.dxfFile(), { format: 'model' }, null, 'Bildritning'));
    const img = /** @type {any} */ (await picture.draw(drawing));
    assert.equal(img.tagName.toLowerCase(), 'img', 'a drawing cannot run anything');
    const notes = track(await importer.runFiles([new File(['# Rubrik\n\nEn rad att läsa.\n'], 'text.md', { type: 'text/markdown' })], { format: 'documents' }, 'Bildtext'));
    assert.ok((await picture.draw(notes)).textContent.includes('En rad att läsa'), 'the start of the text');
    const book = track(await importer.runFiles([await makePdf()], { format: 'documents' }, 'Bildbok'));
    const first = /** @type {any} */ (await picture.draw(book));
    assert.equal(first.tagName.toLowerCase(), 'img', 'the first page of a PDF');
    assert.ok(first.src.startsWith('data:image/png'), first.src.slice(0, 30));
    const plain = await make('Bildlös', [['namn', 'text']], [['a']]);
    assert.equal(await picture.draw(plain), null, 'a plain table has none');
    const plan = await make('Bildplan', [['objekttyp', 'text'], ['geometri', 'text']], [['Bestämmelse', JSON.stringify({ type: 'Polygon', coordinates: [[[15, 60], [15.1, 60], [15.1, 60.1], [15, 60]]] })]], { kind: 'plan' });
    assert.equal((await picture.draw(plan)).tagName.toLowerCase(), 'svg', 'a plan is a map');
    const album = track(await importer.runFiles([await photo('x.jpg')], { format: 'images' }, 'Bildalbum'));
    assert.equal(await picture.draw(album), null, 'the page shows the pictures anyway');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      shell.store.set({ selectedId: net.id });
      shell.activate('hantera');
      const onPage = await waitFor(() => root.querySelector('.dm-ds-picture svg'), 5000, 'the picture on the page');
      assert.ok(onPage.getBoundingClientRect().width > 200 && onPage.querySelector('circle'), 'a size on the page');
      shell.store.set({ selectedId: plain.id });
      await waitFor(() => Array.from(root.querySelectorAll('h1')).some((x) => x.textContent.includes('Bildlös')), 3000, 'the next page');
      await waitFor(() => !root.querySelector('.dm-ds-picture'), 3000, 'no empty frame');
    });
    return 'ok';
  }, 60000);

  test('batch: what the chosen can do together, and each exported in its own form', async (assert) => {
    const batch = D.require('ui/batch-actions');
    const ids = (list) => list.map((a) => a.id);
    const a = await make('Lista A', [['lon', 'number'], ['lat', 'number']], [[15, 60]]);
    const b = await make('Lista B', [['lon', 'number'], ['lat', 'number']], [[16, 61]]);
    const other = await make('Annan form', [['namn', 'text']], [['x']]);
    assert.deepEqual(ids(await batch.abilities([a, b])), ['map', 'append']);
    assert.deepEqual(ids(await batch.abilities([a, other])), [], 'nothing in common');
    assert.deepEqual(ids(await batch.abilities([a])), [], 'one is not together');
    const album1 = track(await importer.runFiles([await photo('samma.jpg')], { format: 'images' }, 'Album 1'));
    const album2 = track(await importer.runFiles([await photo('samma.jpg'), await photo('annan.jpg')], { format: 'images' }, 'Album 2'));
    assert.deepEqual(ids(await batch.abilities([album1, album2])), ['merge']);
    const net = track(await graph.createGraphDataset({ name: 'Batchgraf', graph: NET() }));
    assert.deepEqual(ids(await batch.abilities([album1, net])), [], 'pictures and a graph have nothing in common here');
    await withApp(async (shell, root) => {
      await waitFor(() => [a, b, album1, album2].every((m) => shell.store.get().datasets.some((d) => d.id === m.id)), 5000, 'datasets');
      const ctx = shell.ctx;
      const dialogButton = async (text) => waitFor(() => Array.from(document.querySelectorAll('dialog[open] dm-button')).find((x) => x.textContent.trim() === text), 5000, text);
      // One table.
      const opened = batch.open(ctx, [a.id, b.id]);
      click(await dialogButton(t('datasets.batch.append')));
      await opened;
      const joined = await waitFor(() => shell.store.get().datasets.find((d) => d.name === t('datasets.batch.append.name', { n: 2 })), 3000, 'the new table');
      created.push(joined.id);
      assert.equal(joined.rowCount, 2);
      assert.equal(shell.store.get().selectedId, joined.id, 'and it is chosen');
      // One collection, where the same file name in both is kept apart.
      const merging = batch.open(ctx, [album1.id, album2.id]);
      click(await dialogButton(t('datasets.batch.merge.images')));
      await merging;
      const merged = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'images' && d.name === t('import.collection.images', { n: 3 })), 8000, 'the new collection');
      created.push(merged.id);
      const names = (await D.require('data/dataset-files').list(merged.id, 'preview')).map((f) => f.name).sort();
      assert.deepEqual(names, ['annan.jpg', 'samma (2).jpg', 'samma.jpg']);
      assert.deepEqual((await datasets.query(merged.id)).map((r) => r[0]).sort(), names, 'the rows and the files say the same');
      assert.ok(await D.require('data/dataset-files').url(merged.id, 'samma (2).jpg', 'thumb'), 'with its thumbnail');
      assert.equal((await datasets.get(album1.id)).rowCount, 1, 'the ones chosen stay as they are');
      // One map, opened in Visualisera.
      const mapping = batch.open(ctx, [a.id, b.id]);
      click(await dialogButton(t('datasets.batch.map')));
      await mapping;
      const charts = D.require('viz/charts');
      const chart = await waitFor(async () => (await charts.list()).find((c) => c.name === t('datasets.batch.map.name', { n: 2 })), 3000, 'the map view');
      assert.equal(chart.map.layers.filter((l) => l.kind === 'dataset').length, 2);
      await waitFor(() => shell.store.get().mode === 'visualisera' || root.querySelector('.dm-map-preview'), 5000, 'opened');
      await charts.remove(chart.id);
    });
    // Documents keep their list, with the names kept apart as well.
    const book1 = track(await importer.runFiles([new File(['# A\n\nEtt\n'], 'samma.md', { type: 'text/markdown' })], { format: 'documents' }, 'Bok 1'));
    const book2 = track(await importer.runFiles([new File(['# B\n\nTva\n'], 'samma.md', { type: 'text/markdown' })], { format: 'documents' }, 'Bok 2'));
    assert.deepEqual(ids(await batch.abilities([book1, book2])), ['merge']);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === book2.id), 3000, 'the books');
      const opening = batch.open(shell.ctx, [book1.id, book2.id]);
      click(await waitFor(() => Array.from(document.querySelectorAll('dialog[open] dm-button')).find((x) => x.textContent.trim() === t('datasets.batch.merge.documents')), 5000, 'the button'));
      await opening;
      const both = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'document' && d.name === t('import.collection.documents', { n: 2 })), 5000, 'the new collection');
      created.push(both.id);
      assert.deepEqual(both.documents.map((d) => d.name), ['samma.md', 'samma (2).md']);
      const textOf = async (name) => new TextDecoder().decode((await D.require('data/dataset-files').read(both.id, name, 'original')).bytes);
      const texts = [await textOf('samma.md'), await textOf('samma (2).md')].sort();
      assert.ok(texts[0].includes('Ett') && texts[1].includes('Tva'), 'both files, each under its own name: ' + texts.join(' / '));
    });
    // A format that cannot work for one does not stop the rest.
    const bare = await make('Plan utan former', [['objekttyp', 'text'], ['geometri', 'text']], [['Bestämmelse', null]], { kind: 'plan' });
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === bare.id), 3000, 'the plan');
      const realDownload = shell.ctx.services.files.download;
      const got = [];
      shell.ctx.services.files.download = (blob, name) => { got.push(name); };
      try {
        const opening = batch.open(shell.ctx, [bare.id, a.id]);
        click(await waitFor(() => Array.from(document.querySelectorAll('dialog[open] dm-button')).find((x) => x.textContent.trim() === t('datasets.batch.export')), 5000, 'the export'));
        await opening;
        assert.equal(got.length, 1, 'the archive is made');
      } finally { shell.ctx.services.files.download = realDownload; }
    });
    // Each in its own form rather than a table about it.
    const exporter = D.require('io/export');
    const kinds = D.require('data/kinds');
    for (const [meta, ending] of [[album2, '.zip'], [net, '.graphml'], [a, '.csv']]) {
      const res = await exporter.exportDataset(meta.id, kinds.of(meta).wholeFormat || 'csv');
      assert.ok(res.filename.endsWith(ending), res.filename);
    }
    return 'ok';
  }, 60000);

  test('versions: a version says what it holds in the kind\'s units, and what came and went', async (assert) => {
    const kinds = D.require('data/kinds');
    const recipes = D.require('data/recipes');
    const net = track(await graph.createGraphDataset({ name: 'Versionsgraf', graph: NET() }));
    const version = await datasets.snapshot(net.id, 'Före');
    assert.equal(kinds.summary(version.facts), kinds.summary(await datasets.get(net.id)), 'in nodes and edges');
    assert.ok(kinds.summary(version.facts).includes(t('graph.edges.n', { n: 2 })));
    await recipes.apply(net.id, 'graph_add_node', { id: 'd', etikett: 'X', namn: 'D', egenskaper: '' });
    await recipes.apply(net.id, 'graph_delete_nodes', { ids: ['c'] });
    const cmp = await datasets.compareVersion(net.id, version.n);
    const nodes = cmp.own.find((x) => x.label === 'versions.own.nodes');
    assert.deepEqual([nodes.added, nodes.removed], [['d'], ['c']]);
    assert.equal(nodes.then, 3);
    assert.equal(nodes.now, 3);
    const edges = cmp.own.find((x) => x.label === 'versions.own.edges');
    assert.deepEqual([edges.then, edges.now, edges.removed], [2, 1, ['e2']], 'the edge went with its node');
    const album = track(await importer.runFiles([await photo('v1.jpg')], { format: 'images' }, 'Versionsalbum'));
    const first = await datasets.snapshot(album.id, 'Ett');
    const handle = await datasets.ensureOpen(album.id);
    await handle.engine.run("update data set fil = 'v2.jpg'");
    const pictures = (await datasets.compareVersion(album.id, first.n)).own[0];
    assert.deepEqual([pictures.label, pictures.added, pictures.removed], ['versions.own.pictures', ['v2.jpg'], ['v1.jpg']]);
    const plain = await make('Versionstabell', [['a', 'integer']], [[1]]);
    const v = await datasets.snapshot(plain.id, 'Ett');
    assert.deepEqual((await datasets.compareVersion(plain.id, v.n)).own, [], 'a table has rows, as before');
    // Many are named up to a limit, and the rest counted.
    const many = await D.require('data/version-diff').compare({ kind: 'graph' }, { exec: async (sql) => (/sqlite_master/.test(sql) ? [{ values: [[1]] }] : [{ values: Array.from({ length: 30 }, (_, i) => [`n${i}`]) }]) }, { exec: async (sql) => (/sqlite_master/.test(sql) ? [{ values: [[1]] }] : [{ values: [] }]) });
    assert.equal(many[0].added.length, 20);
    assert.equal(many[0].moreAdded, 10);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      const dialogs = D.require('ui/dialogs');
      const opened = dialogs.versionsDialog({ datasetId: net.id, columns: [], onApplied() {} });
      const dialog = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
      await waitFor(() => dialog.textContent.includes(t('graph.edges.n', { n: 2 })), 3000, 'in nodes and edges');
      const compare = Array.from(dialog.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('versions.compare'));
      click(compare);
      await waitFor(() => Array.from(document.querySelectorAll('dialog[open]')).some((d) => d.textContent.includes(t('versions.own.added', { list: 'd' }))), 3000, 'what came');
      for (const el of Array.from(document.querySelectorAll('dialog[open]')).reverse()) /** @type {any} */ (el).close();
      await Promise.race([opened, wait(200)]);
    });
    return 'ok';
  }, 45000);

  test('adapt3: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
