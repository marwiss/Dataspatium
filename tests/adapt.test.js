// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for how the modes follow the kind of dataset, first part: the review before sharing covers the whole file, a table
 * is only drawn on a map when its values agree with its names, chart kinds and formats say what they need, columns a view
 * needs are guarded, an import ends in the dataset's own terms and a search hit opens where it is. Own test data only;
 * the identity number is the well-known example number that belongs to nobody.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const shareScan = D.require('data/share-scan');
  const leaflet = D.require('viz/leaflet');
  const exif = D.require('data/exif');
  const importer = D.require('io/import');
  const graph = D.require('data/graph');
  const files = D.require('data/dataset-files');
  const guard = D.require('data/protected-columns');
  const exporter = D.require('io/export');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function make(name, columns, rows) {
    const meta = await datasets.create({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows });
    created.push(meta.id);
    return meta;
  }
  const track = (meta) => { created.push(meta.id); return meta; };
  /** The text of a binary file, so that a value left anywhere in it can be found. */
  const asText = (bytes) => new TextDecoder('latin1').decode(bytes);
  async function reopen(bytes) { const meta = await datasets.importBytes(bytes, { name: 'Kopia ' + Math.random() }); created.push(meta.id); return datasets.ensureOpen(meta.id); }
  const rowsOf = async (engine, sql) => { const r = await engine.exec(sql); return r[0] ? r[0].values : []; };
  const PNR = '19121212-1212';
  const MAIL = 'anna.exempel@example.se';

  test('review: running text in a document is found and masked, the originals can stay behind, and nothing is left in the file', async (assert) => {
    const text = `Handläggare ${MAIL} har personnummer ${PNR} i ärendet.\n\nEtt annat stycke utan uppgifter om någon.\n`;
    const meta = track(await importer.runFiles([new File([text], 'ärende.txt', { type: 'text/plain' })], { format: 'documents' }, 'Ärenden'));
    const found = await shareScan.inspect(meta.id);
    const part = found.parts.find((p) => p.id === 'text:text');
    assert.ok(part, 'the running text: ' + JSON.stringify(found.parts));
    assert.equal(part.count, 1);
    assert.equal(part.start, 'mask');
    const originals = found.parts.find((p) => p.id === 'originals');
    assert.ok(originals, 'the original file is listed');
    assert.deepEqual(originals.names, ['ärende.txt']);
    assert.equal(originals.start, 'remove', 'a cleaned table beside the untouched original would be no protection');
    const plain = asText(await shareScan.copy(meta.id, { mask: ['text'] }));
    assert.ok(plain.includes('Handl') && plain.includes(MAIL), 'the original still holds it when it is kept');
    const bytes = await shareScan.copy(meta.id, { mask: ['text'], originals: true });
    const raw = asText(bytes);
    assert.ok(!raw.includes(MAIL) && !raw.includes(PNR), 'nothing left anywhere in the file');
    const copy = await reopen(bytes);
    const rows = await rowsOf(copy.engine, 'select text from data order by rowid');
    assert.ok(rows[0][0].includes('[***]') && rows[0][0].includes('ärendet'), rows[0][0]);
    assert.equal(rows[1][0], 'Ett annat stycke utan uppgifter om någon.', 'other text is left alone');
    assert.equal((await rowsOf(copy.engine, 'select count(*) from _files'))[0][0], 0);
    // The dataset here is what it was.
    const here = await datasets.ensureOpen(meta.id);
    assert.ok((await rowsOf(here.engine, 'select text from data limit 1'))[0][0].includes(MAIL));
    return 'ok';
  }, 30000);

  test('review: the change log and free pages hold no old values in a pseudonymised copy', async (assert) => {
    const secret = '19900101-0017';
    const meta = await make('Loggtest', [['pnr', 'text'], ['ort', 'text']], [[PNR, 'Umeå'], [secret, 'Luleå'], ['19121212-1212', 'Kiruna']]);
    const handle = await datasets.ensureOpen(meta.id);
    await recipes.apply(meta.id, 'edit_cell', { rowid: 2, column: 'pnr', value: PNR });
    const log = await rowsOf(handle.engine, "select details from _log where action = 'op'");
    assert.ok(log.some((r) => String(r[0]).includes(PNR)), 'the log does hold values');
    const bytes = await shareScan.copy(meta.id, { hash: ['pnr'] });
    const raw = asText(bytes);
    assert.ok(!raw.includes(secret) && !raw.includes(PNR), 'neither in the log nor in free pages');
    const copy = await reopen(bytes);
    assert.equal((await rowsOf(copy.engine, 'select count(*) from _log where action = \'op\''))[0][0], 0);
    // Without choices a bundle is still vacuumed: rows deleted earlier do not follow in the file.
    const gone = await make('Raderat', [['namn', 'text']], [['HEMLIGTNAMNXYZ'], ['Annan']]);
    await recipes.apply(gone.id, 'delete_rows', { where: "namn = 'HEMLIGTNAMNXYZ'" });
    const goneHandle = await datasets.ensureOpen(gone.id);
    await goneHandle.engine.run('delete from _log');
    assert.ok(!asText(await shareScan.copy(gone.id)).includes('HEMLIGTNAMNXYZ'), 'a deleted row is really gone');
    return 'ok';
  }, 30000);

  test('review: graph edges and node properties are scanned and masked, and the JSON stays readable', async (assert) => {
    const g = {
      directed: true,
      nodes: [{ id: 'a', labels: ['Person'], name: 'A', properties: { epost: MAIL } }, { id: 'b', labels: ['Person'], name: 'B', properties: {} }],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'KANNER', properties: { kontakt: MAIL } }],
    };
    const meta = track(await graph.createGraphDataset({ name: 'Kontakter', graph: g }));
    const found = await shareScan.inspect(meta.id);
    assert.ok(found.parts.some((p) => p.id === 'side:_edges' && p.start === 'mask'), JSON.stringify(found.parts));
    assert.ok(found.parts.some((p) => p.id === 'text:egenskaper'), 'node properties too');
    const bytes = await shareScan.copy(meta.id, { mask: ['egenskaper'], side: { _edges: 'mask' } });
    assert.ok(!asText(bytes).includes(MAIL));
    const copy = await reopen(bytes);
    const props = JSON.parse((await rowsOf(copy.engine, 'select egenskaper from _edges'))[0][0]);
    assert.equal(props.kontakt, '[***]', 'still valid JSON');
    return 'ok';
  }, 20000);

  /** A real JPEG with position and camera in its EXIF. */
  async function photoWithPosition(name) {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 150;
    const g = canvas.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, 200, 150);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    const bytes = exif.insertApp1(new Uint8Array(await blob.arrayBuffer()), exif.buildApp1({ lat: 63.8258, lon: 20.263, make: 'Testkamera', description: 'Hemlig plats' }));
    return new File([bytes], name, { type: 'image/jpeg' });
  }

  test('review: a picture\'s position goes both from the table and from inside the file', async (assert) => {
    const meta = track(await importer.runFiles([await photoWithPosition('a.jpg')], { format: 'images' }, 'Foton'));
    const before = await files.read(meta.id, 'a.jpg', 'preview');
    assert.ok(exif.parse(before.bytes).lat > 63, 'the stored picture carries its position');
    const found = await shareScan.inspect(meta.id);
    assert.equal(found.parts.find((p) => p.id === 'positions').start, 'remove');
    assert.equal(found.parts.find((p) => p.id === 'pictures').start, 'keep');
    const copy = await reopen(await shareScan.copy(meta.id, { positions: true }));
    assert.deepEqual((await rowsOf(copy.engine, 'select lon, lat from data'))[0], [null, null]);
    const preview = (await rowsOf(copy.engine, "select bytes from _files where kind = 'preview'"))[0][0];
    const left = exif.parse(preview);
    assert.ok(!left || left.lat === undefined, 'no position in the file: ' + JSON.stringify(left));
    assert.ok(!asText(preview).includes('Hemlig plats'), 'nor the description');
    const bitmap = await createImageBitmap(new Blob([preview], { type: 'image/jpeg' }));
    assert.equal(bitmap.width, 200, 'and it is still a picture');
    bitmap.close();
    const noPictures = await reopen(await shareScan.copy(meta.id, { positions: true, pictures: true }));
    assert.equal((await rowsOf(noPictures.engine, 'select count(*) from _files'))[0][0], 0);
    return 'ok';
  }, 20000);

  test('exif: strip leaves the picture and removes the text in JPEG, PNG and WebP', async (assert) => {
    const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const chunk = (type, data) => {
      const body = new TextEncoder().encode(data);
      const out = new Uint8Array(12 + body.length);
      new DataView(out.buffer).setUint32(0, body.length);
      out.set(new TextEncoder().encode(type), 4); out.set(body, 8);
      return Array.from(out);
    };
    const pngBytes = new Uint8Array(png.concat(chunk('IHDR', 'abc'), chunk('tEXt', 'Author Hemlig'), chunk('eXIf', 'gps'), chunk('IDAT', 'xyz'), chunk('IEND', '')));
    const cleanPng = asText(exif.strip(pngBytes));
    assert.ok(cleanPng.includes('IHDR') && cleanPng.includes('IDAT') && cleanPng.includes('IEND'), 'the picture stays');
    assert.ok(!cleanPng.includes('Hemlig') && !cleanPng.includes('eXIf'), 'the text goes');
    const riff = (type, data) => {
      const body = new TextEncoder().encode(data + (data.length % 2 ? ' ' : ''));
      const out = new Uint8Array(8 + body.length);
      out.set(new TextEncoder().encode(type)); new DataView(out.buffer).setUint32(4, data.length, true); out.set(body, 8);
      return Array.from(out);
    };
    const inner = riff('VP8X', 'flagsxxxxx').concat(riff('VP8 ', 'bild'), riff('EXIF', 'Hemlig'), riff('XMP ', 'Hemlig2'));
    const head = new Uint8Array(12); head.set(new TextEncoder().encode('RIFF')); new DataView(head.buffer).setUint32(4, inner.length + 4, true); head.set(new TextEncoder().encode('WEBP'), 8);
    const webp = new Uint8Array(Array.from(head).concat(inner));
    webp[20] |= 0x0C;
    const cleanWebp = exif.strip(webp);
    const webpText = asText(cleanWebp);
    assert.ok(webpText.includes('VP8 ') && !webpText.includes('Hemlig'), webpText);
    assert.equal(new DataView(cleanWebp.buffer, cleanWebp.byteOffset).getUint32(4, true), cleanWebp.length - 8, 'the size follows');
    assert.equal(cleanWebp[20] & 0x0C, 0, 'and the flags');
    const other = new Uint8Array([1, 2, 3]);
    assert.deepEqual(Array.from(exif.strip(other)), [1, 2, 3], 'other files are left alone');
    return 'ok';
  });

  test('review: comments, authors in metadata, originals of other kinds and who collected what are all listed', async (assert) => {
    const meta = await make('Blandat', [['id', 'integer'], ['insamlad_av', 'text'], ['lat', 'number'], ['lon', 'number']], [[1, 'Min telefon', 63.8, 20.2]]);
    const handle = await datasets.ensureOpen(meta.id);
    await files.put(handle, [{ name: 'källa.zip', kind: 'original', type: 'application/zip', bytes: new Uint8Array([1, 2, 3]) }]);
    await D.require('data/comments').add(meta.id, { author: 'Anna', text: `Hör av dig till ${MAIL}` });
    handle.meta.documents = [{ name: 'a.pdf', author: 'Bo Författare' }];
    await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['documents', JSON.stringify(handle.meta.documents)]);
    handle.meta.field = { imports: [{ device: 'Min telefon', rows: 1 }] };
    await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['field', JSON.stringify(handle.meta.field)]);
    const found = await shareScan.inspect(meta.id);
    assert.equal(found.columns.find((f) => f.column === 'insamlad_av').kind, 'collector');
    assert.equal(shareScan.columnChoices(found.columns.find((f) => f.column === 'insamlad_av')).start, 'hash');
    assert.equal(shareScan.columnChoices(found.columns.find((f) => f.column === 'lat')).start, 'keep');
    assert.ok(!shareScan.columnChoices(found.columns.find((f) => f.column === 'lat')).choices.includes('hash'), 'a coded position would mean nothing');
    assert.equal(found.parts.find((p) => p.id === 'originals').start, 'remove');
    const comments = found.parts.find((p) => p.id === 'comments');
    assert.deepEqual(comments.names, ['Anna']);
    assert.equal(comments.start, 'remove', 'a comment with an address in it');
    assert.deepEqual(found.parts.find((p) => p.id === 'authors').names, ['Bo Författare']);
    const bytes = await shareScan.copy(meta.id, { hash: ['insamlad_av'], originals: true, comments: true, authors: true });
    const raw = asText(bytes);
    assert.ok(!raw.includes(MAIL) && !raw.includes('Bo Författare') && !raw.includes('Min telefon'), 'all gone from the file');
    const copy = await reopen(bytes);
    const stored = async (key) => JSON.parse((await rowsOf(copy.engine, `select value from _meta where key = '${key}'`))[0][0]);
    assert.ok(!(await stored('documents'))[0].author, 'no author left');
    assert.equal((await stored('documents'))[0].name, 'a.pdf');
    assert.deepEqual((await stored('field')).imports, []);
    return 'ok';
  }, 20000);

  /** The application as the user has it. */
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
  const pressIn = (scope, label) => {
    const b = Array.from(scope.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === label || x.textContent.trim() === label);
    if (!b) throw new Error('no button: ' + label + ' among ' + Array.from(scope.querySelectorAll('dm-button')).map((x) => x.getAttribute('label') || x.textContent.trim()).join(' | '));
    /** @type {HTMLElement} */ (b.querySelector('button')).click();
  };
  const lastButton = (dlg) => /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button button')).pop());

  test('ui: the share menu goes through the review, for one dataset and for all, and leaves the selection as it was', async (assert) => {
    const meta = await make('Delningsmeny', [['epost', 'text'], ['ort', 'text']], [[MAIL, 'Umeå'], ['bo@example.se', 'Luleå']]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      shell.store.set({ selectedId: meta.id });
      shell.activate('dela');
      const tab = await waitFor(() => Array.from(root.querySelectorAll('[role="tab"]')).find((b) => b.textContent.trim() === t('dela.tabs.share')), 3000, 'the tab');
      tab.click();
      const realShare = navigator.share;
      const platformFiles = D.require('platform/files');
      const realDownload = platformFiles.download;
      const saved = [];
      platformFiles.download = (file, name) => { saved.push({ file, name }); };
      try {
        /** @type {any} */ (navigator).share = undefined;
        await waitFor(() => Array.from(root.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('dela.share.save') || b.textContent.trim() === t('dela.share.button')), 3000, 'the button');
        const button = Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('dela.share.save') || b.textContent.trim() === t('dela.share.button'));
        /** @type {HTMLElement} */ (button.querySelector('button')).click();
        const dlg = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the review');
        assert.ok(dlg.textContent.includes('epost'), 'it asks about the column');
        const pick = /** @type {any} */ (dlg.querySelector('dm-select'));
        pick.value = 'hash';
        pick.dispatchEvent(new Event('change', { bubbles: true }));
        lastButton(dlg).click();
        await waitFor(() => saved.length, 8000, 'the file');
        const text = await saved[0].file.text();
        assert.ok(!text.includes(MAIL) && text.includes('Umeå'), 'the shared file is the reviewed one: ' + text.slice(0, 80));
        await waitFor(() => shell.store.get().selectedId === meta.id, 3000, 'the selection back');
        assert.ok(!shell.store.get().datasets.some((d) => d.name === 'Delningsmeny' && d.id !== meta.id), 'the temporary copy is gone');
      } finally {
        platformFiles.download = realDownload;
        /** @type {any} */ (navigator).share = realShare;
      }
    });
    return 'ok';
  }, 45000);

  test('ui: a push to GitHub cannot pseudonymise, so it says what is going and can be stopped', async (assert) => {
    const review = D.require('ui/share/review');
    const meta = await make('Till GitHub', [['epost', 'text']], [[MAIL], ['bo@example.se']]);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      const asking = review.warn(shell.ctx, [meta.id]);
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the warning');
      assert.ok(dlg.textContent.includes('Till GitHub') && dlg.textContent.includes('epost'), dlg.textContent.slice(0, 120));
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button button')).click();
      assert.equal(await asking, false, 'cancelled');
      const plain = await make('Inget känsligt', [['ort', 'text']], [['Umeå'], ['Luleå']]);
      assert.equal(await review.warn(shell.ctx, [plain.id]), true, 'nothing to say, nothing asked');
    });
    return 'ok';
  }, 30000);

  test('map: a table is only offered as a map when its values agree with its names', async (assert) => {
    const cols = (...names) => names.map((name) => ({ name, type: 'number' }));
    assert.equal(leaflet.coordinateColumns(cols('kostnad', 'population')), null, 'words that only contain the letters');
    assert.equal(leaflet.coordinateColumns(cols('relation', 'longevity', 'platser')), null);
    assert.deepEqual(leaflet.coordinateColumns(cols('lon_wgs84', 'lat_wgs84')), { lon: 'lon_wgs84', lat: 'lat_wgs84' });
    assert.deepEqual(leaflet.coordinateColumns(cols('ost_koord', 'nord_koord')), { lon: 'ost_koord', lat: 'nord_koord' });
    assert.deepEqual(leaflet.coordinateColumns(cols('startLat', 'startLon')), { lon: 'startLon', lat: 'startLat' });
    const degrees = await make('Grader', [['lon', 'number'], ['lat', 'number']], [[20.26, 63.82], [22.15, 65.58]]);
    assert.equal(await leaflet.drawable(degrees.id), true);
    const outside = await make('Utanför', [['lon', 'number'], ['lat', 'number']], [[2000, 63], [3000, 900]]);
    assert.equal(await leaflet.drawable(outside.id), false, 'neither degrees nor a projected system');
    const small = await make('Regression', [['x', 'integer'], ['y', 'integer']], [[1, 2], [3, 4]]);
    assert.equal(await leaflet.drawable(small.id), false, 'x and y are usually something else');
    const sweref = await make('Sweref', [['e', 'number'], ['n', 'number']], [[757000, 7087000], [674000, 6580000]]);
    assert.equal(await leaflet.drawable(sweref.id), true, 'x and y in a projected system are coordinates');
    const empty = await make('Tomma', [['lon', 'number'], ['lat', 'number']], []);
    assert.equal(await leaflet.drawable(empty.id), true, 'no rows yet, the names decide');
    const shape = await make('Form', [['geometri', 'text']], [[JSON.stringify({ type: 'Point', coordinates: [20, 63] })]]);
    assert.equal(await leaflet.drawable(shape.id), true);
    const words = await make('Geometrilektion', [['geometri', 'text']], [['Pythagoras sats'], ['Cirkelns area']]);
    assert.equal(await leaflet.drawable(words.id), false, 'a column called geometry that holds words');
    const money = await make('Budget', [['kostnad', 'number'], ['population', 'number']], [[300, 5000], [200, 7000]]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === money.id), 3000, 'dataset');
      shell.store.set({ selectedId: money.id });
      shell.activate('bearbeta');
      await waitFor(() => Array.from(root.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('bearbeta.profile')), 5000, 'the table');
      assert.ok(!Array.from(root.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('bearbeta.view.map')), 'no map button for a budget');
      shell.activate('analysera');
      await waitFor(() => root.querySelector('dm-tabs [role="tab"]'), 3000, 'tabs');
      await wait(300);
      assert.ok(!Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).some((b) => b.textContent.trim() === t('analysera.tabs.geo')), 'no Geo tab');
      shell.store.set({ selectedId: degrees.id });
      await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).some((b) => b.textContent.trim() === t('analysera.tabs.geo')), 3000, 'the Geo tab for real coordinates');
    });
    return 'ok';
  }, 45000);

  test('ui: new chart puts what fits first, and a chart kind that cannot work says what it needs', async (assert) => {
    const table = await make('Bara tabell', [['a', 'integer']], [[1], [2]]);
    const place = await make('Platser', [['lon', 'number'], ['lat', 'number']], [[20, 63]]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === table.id) && shell.store.get().datasets.some((d) => d.id === place.id), 3000, 'datasets');
      const anyGraph = shell.store.get().datasets.some((d) => d.kind === 'graph');
      const anyModel = shell.store.get().datasets.some((d) => d.kind === 'model');
      const open = async (id) => {
        shell.store.set({ selectedId: id });
        shell.activate('visualisera');
        const left = await waitFor(() => root.querySelector('.dm-left'), 3000, 'left');
        await waitFor(() => Array.from(left.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('viz.new')), 3000, 'new chart');
        pressIn(left, t('viz.new'));
        return waitFor(() => document.querySelector('dialog[open] .dm-op-tile') && document.querySelector('dialog[open]'), 3000, 'the dialog');
      };
      let dlg = await open(table.id);
      const tile = (k) => /** @type {HTMLButtonElement} */ (dlg.querySelector(`.dm-op-tile[data-kind="${k}"]`));
      assert.equal(tile('graph').disabled, !anyGraph, 'a graph chart without any graph');
      assert.equal(tile('model').disabled, !anyModel);
      if (!anyGraph) assert.ok(tile('graph').textContent.includes(t('viz.kind.need.graph')), 'says what it needs');
      assert.equal(tile('vega').disabled, false);
      assert.equal(tile('r').disabled, false);
      lastButton(dlg).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 2000, 'closed');
      dlg = await open(place.id);
      assert.equal(dlg.querySelector('.dm-op-tile').getAttribute('data-kind'), 'map', 'a map first for a table with coordinates');
      lastButton(dlg).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 2000, 'closed');
    });
    return 'ok';
  }, 45000);

  test('export: GeoJSON says what it needs, and points are written from coordinates', async (assert) => {
    assert.ok(exporter.formatsFor({ kind: 'table' }, { geometry: false }).find((f) => f.id === 'geojson').unavailable, 'greyed without a geometry');
    assert.ok(!exporter.formatsFor({ kind: 'table' }, { geometry: true }).find((f) => f.id === 'geojson').unavailable);
    assert.ok(!exporter.formatsFor({ kind: 'table' }).find((f) => f.id === 'geojson').unavailable, 'until it is known');
    const plain = await make('Utan geometri', [['a', 'text']], [['x']]);
    assert.equal(await exporter.geometrySource(plain.id), null);
    const points = await make('Punkter', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.82], ['Tom', null, null]]);
    const out = JSON.parse(await (await exporter.toGeoJson(points.id)).text());
    assert.deepEqual(out.features[0].geometry, { type: 'Point', coordinates: [20.26, 63.82] });
    assert.equal(out.features[0].properties.namn, 'Umeå');
    assert.equal(out.features[0].properties.lat, 63.82, 'the columns stay as properties');
    assert.equal(out.features[1].geometry, null);
    const sweref = await make('Sweref', [['e', 'number'], ['n', 'number']], [[757000, 7087000]]);
    const converted = JSON.parse(await (await exporter.toGeoJson(sweref.id)).text());
    assert.ok(converted.features[0].geometry.coordinates[0] < 30, 'projected points in WGS 84: ' + converted.features[0].geometry.coordinates);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === plain.id), 3000, 'dataset');
      shell.store.set({ selectedId: plain.id });
      shell.activate('exportera');
      const option = await waitFor(() => { const o = /** @type {HTMLOptionElement} */ (root.querySelector('option[value="geojson"]')); return o && o.disabled ? o : null; }, 5000, 'the greyed format');
      assert.ok(option.textContent.includes(t('export.needs.geometry')), option.textContent);
    });
    return 'ok';
  }, 30000);

  test('guard: what a view needs is named, asked about before, and told about after with the way back', async (assert) => {
    const g = { directed: true, nodes: [{ id: 'a', labels: ['X'], name: 'A', properties: {} }, { id: 'b', labels: ['X'], name: 'B', properties: {} }], edges: [{ id: 'e', source: 'a', target: 'b', type: 'T', properties: {} }] };
    const meta = track(await graph.createGraphDataset({ name: 'Skyddad graf', graph: g }));
    const handle = await datasets.ensureOpen(meta.id);
    assert.deepEqual(guard.list(handle.meta, handle.columns), ['id', 'etikett', 'namn', 'egenskaper']);
    assert.deepEqual(guard.list({ kind: 'model', model: { format: 'dxf' } }, [{ name: 'id' }, { name: 'typ' }, { name: 'lager' }, { name: 'farg' }]), ['id', 'typ', 'lager']);
    assert.deepEqual(guard.list({ kind: 'table' }, [{ name: 'ort', type: 'text' }, { name: 'geometri', type: 'text' }]), ['geometri']);
    assert.deepEqual(guard.list({ kind: 'table' }, [{ name: 'ort', type: 'text' }]), [], 'a plain table has nothing to guard');
    assert.deepEqual(guard.touched('drop_columns', { columns: ['a', 'b'] }), ['a', 'b']);
    assert.deepEqual(guard.touched('trim', { columns: ['a'] }), [], 'changing values is not changing the column');
    assert.deepEqual(guard.lost(['id', 'typ'], [{ name: 'id', type: 'text' }, { name: 'typ', type: 'text' }], [{ name: 'id', type: 'integer' }]), ['id', 'typ'], 'gone or of another type');
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      // Asked before: the dialog names the column, and no leaves it.
      const opDialog = D.require('ui/op-dialog');
      const columns = await datasets.columns(meta.id);
      const done = opDialog.open({ datasetId: meta.id, opId: 'drop_columns', preset: { columns: ['etikett'] }, columns });
      const first = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the operation');
      lastButton(first).click();
      const asked = await waitFor(() => Array.from(document.querySelectorAll('dialog[open]')).find((d) => d.textContent.includes(t('protected.confirm', { columns: 'etikett' }))), 3000, 'the question');
      /** @type {HTMLElement} */ (asked.querySelector('.dm-dialog-actions dm-button button')).click();
      const again = await waitFor(() => Array.from(document.querySelectorAll('dialog[open]')).find((d) => !d.textContent.includes(t('protected.confirm', { columns: 'etikett' }))), 3000, 'back at the operation');
      assert.ok(again, 'back in the dialog');
      /** @type {HTMLElement} */ (again.querySelector('.dm-dialog-actions dm-button button')).click();
      await done;
      assert.ok((await datasets.columns(meta.id)).some((c) => c.name === 'etikett'), 'no means no');
      // Told after: SQL no dialog could read.
      const events = [];
      const stop = datasets.subscribe((type, payload) => { if (type === 'protected-lost') events.push(payload); });
      await recipes.apply(meta.id, 'sql', { statement: 'alter table data drop column etikett' }).catch(() => null);
      const dropped = !(await datasets.ensureOpen(meta.id)).columns.some((c) => c.name === 'etikett');
      if (dropped) {
        await waitFor(() => events.length, 2000, 'the notice');
        assert.deepEqual(events[0].columns, ['etikett']);
        const toast = await waitFor(() => Array.from(document.querySelectorAll('.dm-toast')).find((x) => x.textContent.includes('etikett')), 3000, 'the message');
        assert.ok(toast.textContent.includes(t('common.undo')), 'with the way back');
      }
      stop();
      // A plain table is not disturbed.
      const plain = await make('Vanlig', [['a', 'text'], ['b', 'text']], [['1', '2']]);
      const events2 = [];
      const stop2 = datasets.subscribe((type, payload) => { if (type === 'protected-lost') events2.push(payload); });
      await recipes.apply(plain.id, 'drop_columns', { columns: ['a'] });
      stop2();
      assert.equal(events2.length, 0);
    });
    return 'ok';
  }, 45000);

  test('ui: an import ends in the dataset\'s own terms, and a search hit opens where it is', async (assert) => {
    const text = 'Första sidans text om ett unikt ord: blåklint.\n';
    const doc = track(await importer.runFiles([new File([text], 'not.txt', { type: 'text/plain' })], { format: 'documents' }, 'Sökbara dokument'));
    const g = { directed: true, nodes: [{ id: 'n1', labels: ['X'], name: 'Hästkastanj', properties: {} }, { id: 'n2', labels: ['X'], name: 'Annan', properties: {} }], edges: [{ id: 'e', source: 'n1', target: 'n2', type: 'T', properties: {} }] };
    const net = track(await graph.createGraphDataset({ name: 'Sökbar graf', graph: g }));
    const place = await make('Sökbar karta', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Vitsippa', 20.26, 63.82], ['Annan', 22.15, 65.58]]);
    const plain = await make('Sökbar tabell', [['namn', 'text']], [['a'], ['b'], ['Gullviva']]);
    await withApp(async (shell, root) => {
      await waitFor(() => [doc, net, place, plain].every((m) => shell.store.get().datasets.some((d) => d.id === m.id)), 5000, 'datasets');
      // Through the import itself: a Markdown file ends in documents and pages, with the way on being to read it.
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [new File(['# Rubrik\n\nEn rad text.\n'], 'anteckning.md', { type: 'text/markdown' })] }, bubbles: true }));
      for (let i = 0; i < 200 && !root.querySelector('.dm-success'); i++) {
        await wait(50);
        // The result's own primary button opens the dataset, so it must not be clicked here.
        if (root.querySelector('.dm-success')) break;
        const primary = /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-button[variant="primary"]')).pop());
        if (primary && i % 10 === 5 && !primary.hasAttribute('disabled')) /** @type {HTMLElement} */ (primary.querySelector('button')).click();
      }
      const success = await waitFor(() => root.querySelector('.dm-success'), 3000, 'the result');
      const fetched = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'document' && d.name === 'anteckning'), 3000, 'the dataset');
      assert.ok(fetched, 'the dataset');
      created.push(fetched.id);
      assert.ok(success.textContent.includes(D.require('ui/dataset-list').kindSummary(fetched)), 'in documents and pages: ' + success.textContent);
      assert.ok(!success.textContent.includes(t('common.rows', { n: 1 })), 'not in rows');
      assert.ok(Array.from(success.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('hantera.read')), 'the way on is to read it');
      const search = async (id, word) => {
        shell.store.set({ selectedId: id, selectedIds: [] });
        shell.activate('soka');
        const input = /** @type {any} */ (await waitFor(() => root.querySelector('dm-input[data-course="search"]'), 3000, 'the search field'));
        input.value = word;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        pressIn(root, t('soka.run'));
        const row = await waitFor(() => root.querySelector(`.dm-search-result[data-dataset="${id}"] dm-table .dm-tr`), 8000, 'the hit');
        /** @type {HTMLElement} */ (row).click();
        await wait(50);
      };
      await search(doc.id, 'blåklint');
      pressIn(root.querySelector('.dm-right') || root, t('soka.open.document'));
      await waitFor(() => shell.store.get().mode === 'bearbeta', 3000, 'Bearbeta');
      await waitFor(() => root.textContent.includes('blåklint') && !shell.store.get().openDocument, 5000, 'the reading view');
      await search(net.id, 'Hästkastanj');
      pressIn(root.querySelector('.dm-right') || root, t('soka.open.node'));
      await waitFor(() => !shell.store.get().openNode && shell.store.get().mode === 'bearbeta', 5000, 'the graph view');
      await search(place.id, 'Vitsippa');
      pressIn(root.querySelector('.dm-right') || root, t('soka.open.map'));
      await waitFor(() => !shell.store.get().openMapRow && root.querySelector('.dm-map-view.leaflet-container'), 8000, 'the map');
      await search(plain.id, 'Gullviva');
      pressIn(root.querySelector('.dm-right') || root, t('soka.open.row'));
      const chosen = await waitFor(() => !shell.store.get().openRow && root.querySelector('dm-table .dm-tr[aria-selected="true"], dm-table .dm-tr.dm-selected'), 8000, 'the row');
      assert.ok(chosen.textContent.includes('Gullviva'), 'the right row: ' + chosen.textContent);
    });
    return 'ok';
  }, 60000);

  test('ui: every kind of source in Inhämta looks the same, and all ways to add one are in one place', async (assert) => {
    const connectors = D.require('api/connectors');
    const geo = await connectors.save({ format: 'dataspatium-api/1', id: 'test-adapt-geo', name: 'Geotjänst', baseUrl: 'dataspatium-asset://tests/geo', auth: { type: 'none' }, family: { type: 'geodata', kind: 'wfs' }, endpoints: [] });
    try {
      await withApp(async (shell, root) => {
        shell.activate('inhamta');
        const left = await waitFor(() => { const l = root.querySelector('.dm-left .dm-pane-body'); return l && l.querySelector('.dm-list-item') ? l : null; }, 5000, 'the source list');
        const items = await waitFor(() => { const all = Array.from(left.querySelectorAll('.dm-list-item')); return all.some((i) => i.textContent.includes('Geotjänst')) ? all : null; }, 5000, 'the sources');
        for (const item of items) {
          assert.equal(item.querySelectorAll('svg').length, 1, 'one mark: ' + item.textContent);
          assert.ok(item.querySelector('.dm-list-main'), 'a name');
          assert.ok(item.querySelector('.dm-list-sub') && item.querySelector('.dm-list-sub').textContent.trim(), 'and a line under it: ' + item.textContent);
        }
        const heights = new Set(items.map((i) => Math.round(i.getBoundingClientRect().height)));
        assert.equal(heights.size, 1, 'the same height: ' + Array.from(heights).join(', '));
        assert.equal(left.querySelectorAll('dm-button').length, 1, 'one way to add a source');
        assert.equal(left.querySelectorAll('.dm-help').length, 0, 'no notes between the sources');
        const mark = (name) => { const it = items.find((i) => i.textContent.includes(name)); return it ? (it.querySelector('svg') || {}).innerHTML : null; };
        assert.ok(mark('Geotjänst') !== mark('SCB') || !mark('SCB'), 'a geodata source has its own mark');
        pressIn(left, t('import.sources.add'));
        const dlg = await waitFor(() => document.querySelector('dialog[open] .dm-op-tile') && document.querySelector('dialog[open]'), 3000, 'the dialog');
        assert.deepEqual(Array.from(dlg.querySelectorAll('.dm-op-tile')).map((b) => b.getAttribute('data-source')), ['file', 'family', 'geodata']);
        assert.ok(dlg.textContent.includes(t('geodata.add.hint')), 'each says what it is for');
        /** @type {HTMLElement} */ (dlg.querySelector('.dm-op-tile[data-source="geodata"]')).click();
        const next = await waitFor(() => Array.from(document.querySelectorAll('dialog[open]')).find((d) => !d.querySelector('.dm-op-tile')), 3000, 'the geodata dialog');
        /** @type {HTMLElement} */ (next.querySelector('.dm-dialog-actions dm-button button')).click();
      });
    } finally { await connectors.remove(geo.id).catch(() => {}); }
    return 'ok';
  }, 30000);

  test('ui: the log can be dragged up and down within limits, and keeps its height', async (assert) => {
    const idb = D.require('platform/storage/idb');
    await idb.deleteSetting('ui.panel.drawer');
    await withApp(async (shell, root) => {
      shell.toggle('drawer');
      const splitter = /** @type {any} */ (await waitFor(() => root.querySelector('dm-splitter[for="drawer"]'), 3000, 'the handle'));
      const log = root.querySelector('.dm-drawer .dm-log');
      const height = () => Math.round(log.getBoundingClientRect().height);
      await waitFor(() => height() > 0, 2000, 'the open log');
      assert.equal(splitter.getAttribute('aria-orientation'), 'horizontal');
      assert.ok(splitter.getAttribute('aria-label'), 'it has a name');
      const start = height();
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      assert.equal(height(), start + 16, 'up makes it taller');
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
      assert.equal(height(), start - 48, 'down makes it lower');
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      assert.equal(height(), 96, 'not lower than the limit');
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      assert.ok(height() <= Math.round(window.innerHeight * 0.6) && height() > 96, 'not taller than part of the window: ' + height());
      // Dragging: the top edge follows the pointer.
      splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const bottom = log.getBoundingClientRect().bottom;
      const offset = log.getBoundingClientRect().top - splitter.parentElement.getBoundingClientRect().top;
      const y = bottom - offset - 200;
      splitter.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, clientY: bottom - offset - 96, bubbles: true }));
      splitter.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: y, bubbles: true }));
      splitter.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: y, bubbles: true }));
      assert.equal(height(), 200, 'dragged to 200');
      await waitFor(async () => (await idb.getSetting('ui.panel.drawer', null)) === 200, 2000, 'kept');
      shell.toggle('drawer');
      shell.toggle('drawer');
      assert.equal(height(), 200, 'after closing and opening');
      splitter.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      assert.equal(height(), start, 'a double click goes back');
      shell.toggle('drawer');
    });
    await idb.deleteSetting('ui.panel.drawer');
    return 'ok';
  }, 30000);

  test('kinds: every kind says what it is, and the modes do not need to know', async (assert) => {
    const kinds = D.require('data/kinds');
    assert.equal(kinds.of('graph').view, 'graph');
    assert.equal(kinds.of({ kind: 'document' }).tab, 'text');
    assert.equal(kinds.of(null), kinds.of('table'), 'nothing means a table');
    assert.equal(kinds.of('nosuchkind'), kinds.of('table'));
    for (const name of datasets.KINDS) {
      const p = kinds.of(name);
      assert.ok(p.icon, name + ' has a mark');
      assert.equal(typeof p.summary, 'function', name + ' counts itself');
      assert.ok(!p.summary({ kind: name, rowCount: 3, columnCount: 2 }).includes('{'), name + ': ' + p.summary({ kind: name, rowCount: 3, columnCount: 2 }));
      assert.ok(kinds.badges({ kind: name, rowCount: 3, columnCount: 2 }).length > 0);
      if (name !== 'table') {
        assert.ok(p.view && p.open && p.hit, name + ' has a view, a way to open it and a place for hits');
        assert.equal(typeof p.protect, 'function');
        assert.ok(t(p.open.label) !== p.open.label && t(p.open.hint) !== p.open.hint, name + ' has its texts');
        assert.ok(t(p.hit(() => 'x', 'id').label) !== p.hit(() => 'x', 'id').label);
      }
      if (p.loses) assert.ok(t(p.loses) !== p.loses, name + ' says what a table export loses');
    }
    assert.ok(kinds.isDxf({ model: { format: 'dxf' } }));
    assert.deepEqual(kinds.guarded({ kind: 'model', model: { format: 'dxf' } }, [{ name: 'id' }, { name: 'guid' }, { name: 'lager' }]), ['id', 'lager']);
    return 'ok';
  });

  test('facets: a dataset says what it can be used as and why, and the user has the last word', async (assert) => {
    const facets = D.require('data/facets');
    const of = async (id) => Object.fromEntries((await facets.detect(id)).map((f) => [f.id, f]));
    const place = await make('Platsfacett', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.82], ['Luleå', 22.15, 65.58]]);
    const p = (await of(place.id)).spatial;
    assert.ok(p.on && p.auto && !p.forced);
    assert.equal(t(p.reason, p.params), t('facets.reason.coordinates', { lon: 'lon', lat: 'lat' }));
    assert.equal(await facets.startTab(place.id), 'geo');
    assert.deepEqual(await facets.firstGroups(place.id), ['geo']);
    const series = await make('Tidsfacett', [['tid', 'text'], ['varde', 'number']], [['2024M01', 1], ['2024M02', 2], ['2024M03', 3], ['2024M04', 4]]);
    assert.ok((await of(series.id)).timeseries.on);
    assert.deepEqual(await facets.firstGroups(series.id), ['timeseries']);
    const counts = await make('Inga perioder', [['namn', 'text'], ['tal', 'integer']], [['a', 1], ['b', 2], ['c', 3]]);
    assert.deepEqual(await facets.detect(counts.id), [], 'a plain table is just a table');
    assert.equal(await facets.startTab(counts.id), 'stats');
    const net = await make('Nätfacett', [['kalla', 'text'], ['mal', 'text']], [['a', 'b'], ['b', 'c']]);
    assert.ok((await of(net.id)).network.on);
    const prose = 'En lång text om något som behöver sägas med många ord, så att den blir längre än en vanlig cell. ';
    const notes = await make('Textfacett', [['anteckning', 'text']], [[prose], [prose + prose], [prose]]);
    assert.ok((await of(notes.id)).text.on);
    assert.equal(await facets.startTab(notes.id), 'text');
    const region = await make('Regionfacett', [['kommun', 'text'], ['tal', 'integer']], [['Umeå', 1], ['Luleå', 2], ['Kiruna', 3]]);
    const r = (await of(region.id)).region;
    assert.ok(r && r.on, 'names of municipalities: ' + JSON.stringify(r));
    const coded = await make('Kodfacett', [['kommunkod', 'integer'], ['tal', 'integer']], [[180, 1], [1480, 2], [2480, 3]]);
    assert.ok((await of(coded.id)).region, 'codes without their leading zero');
    const wrong = await make('Ingen region', [['kommun', 'text']], [['Atlantis'], ['Narnia'], ['Mordor']]);
    assert.ok(!(await of(wrong.id)).region, 'a column can be called so without being so');
    // The user overrules it, and it lasts.
    const leaflet2 = D.require('viz/leaflet');
    await facets.set(place.id, 'spatial', false);
    const off = (await of(place.id)).spatial;
    assert.ok(!off.on && off.auto && off.forced);
    assert.equal(await leaflet2.drawable(place.id), false, 'the map follows');
    await datasets.flushSaves();
    datasets.close(place.id);
    assert.equal((await of(place.id)).spatial.on, false, 'after a reload');
    const bytes = await datasets.exportBytes(place.id);
    const imported = await datasets.importBytes(bytes, { name: 'Facett kopia' }, { quiet: true });
    assert.equal((await datasets.ensureOpen(imported.id)).meta.facets.spatial, false, 'and in a copy');
    await datasets.remove(imported.id, { quiet: true });
    await facets.set(place.id, 'spatial', null);
    assert.equal((await of(place.id)).spatial.forced, false, 'handed back');
    assert.equal(await leaflet2.drawable(place.id), true);
    // Against what the values say: small numbers in x and y are coordinates if the user says so.
    const small = await make('Lokala', [['x', 'number'], ['y', 'number']], [[1, 2], [3, 4]]);
    assert.equal(await leaflet2.drawable(small.id), false);
    await facets.set(small.id, 'spatial', true);
    assert.equal(await leaflet2.drawable(small.id), true);
    return 'ok';
  }, 45000);

  test('models, the field form and facets all follow a dataset into a bundle and out again', async (assert) => {
    const meta = await make('Följer med', [['a', 'number'], ['b', 'number']], [[1, 2], [3, 4], [5, 6]]);
    const handle = await datasets.ensureOpen(meta.id);
    await D.require('data/models').save(meta.id, { id: 'm1', name: 'Modell', kind: 'linear', target: 'b', predictors: ['a'], intercept: 1, terms: [{ column: 'a', level: null, coefficient: 1 }], metrics: {} });
    await D.require('data/field-collect').save(meta.id, await D.require('data/field-collect').formFor(meta.id));
    await D.require('data/facets').set(meta.id, 'text', true);
    assert.ok(handle.meta.models && handle.meta.field && handle.meta.facets);
    const back = await datasets.importBytes(await shareScan.copy(meta.id), { name: 'Tillbaka' }, { quiet: true });
    const again = await datasets.ensureOpen(back.id);
    assert.equal(again.meta.models[0].name, 'Modell');
    assert.ok(again.meta.field.form);
    assert.equal(again.meta.facets.text, true);
    await datasets.remove(back.id, { quiet: true });
    // A dataset that came from a file keeps what it knows about itself, not a string of it.
    const doc = track(await importer.runFiles([new File(['Ett stycke.\n'], 'paket.txt', { type: 'text/plain' })], { format: 'documents' }, 'Paketdokument'));
    const docBack = await datasets.importBytes(await shareScan.copy(doc.id), { name: 'Dokument tillbaka' }, { quiet: true });
    assert.ok(Array.isArray((await datasets.ensureOpen(docBack.id)).meta.documents), 'the documents are a list');
    assert.equal((await datasets.ensureOpen(docBack.id)).meta.documents[0].name, 'paket.txt');
    await datasets.remove(docBack.id, { quiet: true });
    const g = { directed: true, nodes: [{ id: 'a', labels: ['X'], name: 'A', properties: {} }], edges: [] };
    const net = track(await graph.createGraphDataset({ name: 'Paketgraf', graph: g }));
    const netBack = await datasets.importBytes(await shareScan.copy(net.id), { name: 'Graf tillbaka' }, { quiet: true });
    // What an earlier version stored as text is read as data.
    const idb = D.require('platform/storage/idb');
    const stored = await idb.getDataset(netBack.id);
    await idb.putDataset(Object.assign({}, stored, { graph: JSON.stringify(stored.graph) }));
    assert.equal((await datasets.get(netBack.id)).graph.nodes, 1, 'healed when read');
    assert.equal((await datasets.list()).find((d) => d.id === netBack.id).graph.nodes, 1, 'also in the list');
    assert.equal((await datasets.ensureOpen(netBack.id)).meta.graph.nodes, 1, 'the graph facts too');
    await datasets.remove(netBack.id, { quiet: true });
    return 'ok';
  }, 20000);

  test('ui: Hantera shows what the app sees with its reason, a switch that sticks, and how the dataset is doing', async (assert) => {
    const place = await make('Inblick', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['Umeå', 20.26, 63.82], ['Tom', null, null]]);
    const g = { directed: true, nodes: [{ id: 'a', labels: ['X'], name: 'A', properties: {} }, { id: 'b', labels: ['X'], name: 'B', properties: {} }, { id: 'c', labels: ['X'], name: 'C', properties: {} }], edges: [{ id: 'e', source: 'a', target: 'b', type: 'T', properties: {} }, { id: 'f', source: 'a', target: 'a', type: 'T', properties: {} }] };
    const net = track(await graph.createGraphDataset({ name: 'Hälsograf', graph: g }));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'datasets');
      shell.store.set({ selectedId: place.id });
      shell.activate('hantera');
      const card = await waitFor(() => root.querySelector('[data-card="facets"]'), 5000, 'what the app sees');
      assert.ok(card.textContent.includes(t('facets.reason.coordinates', { lon: 'lon', lat: 'lat' })), 'with its reason');
      const health = await waitFor(() => root.querySelector('[data-health="health.spatial.empty"]'), 3000, 'the place missing');
      assert.equal(health.textContent, t('health.spatial.empty', { n: 1 }));
      const sw = /** @type {any} */ (card.querySelector('dm-switch[data-facet="spatial"]'));
      sw.checked = false;
      sw.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(async () => !(await leaflet.drawable(place.id)), 3000, 'the switch counts');
      await D.require('data/facets').set(place.id, 'spatial', null);
      shell.store.set({ selectedId: net.id });
      const dangling = await waitFor(() => root.querySelector('[data-health="health.graph.isolated"]'), 5000, 'the lonely node');
      assert.equal(dangling.textContent, t('health.graph.isolated', { n: 1 }));
      assert.ok(root.querySelector('[data-health="health.graph.loops"]'), 'and the loop');
    });
    const health = D.require('data/kind-health');
    const plain = await make('Friskt', [['a', 'text']], [['x']]);
    assert.deepEqual(await health.check(plain.id), [], 'nothing to say');
    return 'ok';
  }, 45000);

  test('ui: Analysera opens in the tool of the dataset, until the user has chosen, and R does not start for it', async (assert) => {
    const doc = track(await importer.runFiles([new File(['Ett stycke text.\n'], 'flik.txt', { type: 'text/plain' })], { format: 'documents' }, 'Flikdokument'));
    const place = await make('Flikkarta', [['lon', 'number'], ['lat', 'number']], [[20, 63]]);
    const plain = await make('Fliktabell2', [['a', 'integer']], [[1], [2]]);
    const bridge = D.require('data/r-bridge').bridge;
    await withApp(async (shell, root) => {
      const active = () => { const el = root.querySelector('dm-tabs').querySelector('[role="tab"][aria-selected="true"]'); return el ? el.textContent.trim() : ''; };
      await waitFor(() => [doc, place, plain].every((m) => shell.store.get().datasets.some((d) => d.id === m.id)), 3000, 'datasets');
      const stateBefore = bridge.state;
      shell.store.set({ selectedId: doc.id });
      shell.activate('analysera');
      await waitFor(() => active() === t('analysera.tabs.text'), 5000, 'the text tool');
      shell.store.set({ selectedId: place.id });
      await waitFor(() => active() === t('analysera.tabs.geo'), 5000, 'the geo tool');
      shell.store.set({ selectedId: plain.id });
      await waitFor(() => active() === t('analysera.tabs.stats'), 5000, 'statistics');
      assert.equal(bridge.state, stateBefore, 'R was left alone');
      // The fixed order stays.
      const names = Array.from(root.querySelector('dm-tabs').querySelectorAll('[role="tab"]')).map((b) => b.textContent.trim());
      assert.equal(names[0], t('analysera.tabs.r'));
      assert.equal(names[names.length - 1], t('analysera.tabs.notebook'));
      // The user's choice stays too.
      Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.trim() === t('analysera.tabs.sql')).click();
      await waitFor(() => active() === t('analysera.tabs.sql'), 2000, 'SQL');
      shell.store.set({ selectedId: doc.id });
      await wait(400);
      assert.equal(active(), t('analysera.tabs.sql'), 'not moved after the user has chosen');
    });
    return 'ok';
  }, 45000);

  test('selection: made in one place, used in the next, kept as a list, and gone when the rows change', async (assert) => {
    const selection = D.require('data/selection');
    const lists = D.require('data/lists');
    const vizData = D.require('viz/data');
    const meta = await make('Urvalstest', [['namn', 'text'], ['tal', 'integer']], [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
    const seen = [];
    const stop = selection.subscribe((s) => seen.push(s));
    const made = await selection.setFromWhere(meta.id, 'tal > ?', [2], 'stora');
    assert.deepEqual(made.rowids, [3, 4]);
    assert.equal(seen.length, 1, 'told');
    assert.equal(selection.whereOf(meta.id).sql, 'rowid in (3,4)');
    assert.equal(selection.whereOf('annat'), null, 'only for its own dataset');
    // As a list: Bearbeta and charts use it, and it can be run and turned into a dataset.
    const rec = await selection.toList('Stora');
    assert.equal(rec.kind, 'rows');
    assert.deepEqual(lists.whereOf(rec, []), { sql: 'rowid in (3,4)', params: [] });
    const rows = await vizData.fetchRows(meta.id, { fields: ['namn'], listId: rec.id });
    assert.deepEqual(rows.rows.map((r) => r.namn), ['c', 'd'], 'a chart can use it');
    const run = await lists.run(rec);
    assert.equal(run.count, 2);
    assert.equal(lists.describe(rec), t('selection.list.describe', { n: 2 }));
    const fromList = track(await lists.toDataset(rec, 'Ur listan'));
    assert.equal(fromList.rowCount, 2);
    await lists.remove(rec.id);
    const copy = track(await selection.toDataset('Ur urvalet'));
    assert.equal(copy.rowCount, 2);
    // A copy with only these rows, for export and bundles.
    const only = await reopen(await shareScan.copy(meta.id, { only: [3, 4] }));
    assert.deepEqual((await rowsOf(only.engine, 'select namn from data')).map((r) => r[0]), ['c', 'd']);
    // Rows that change make rowids meaningless, so it goes.
    await recipes.apply(meta.id, 'delete_rows', { where: "namn = 'a'" });
    assert.equal(selection.get(), null, 'gone when the rows change');
    selection.set({ datasetId: meta.id, rowids: [] });
    assert.equal(selection.get(), null, 'no rows, no selection');
    stop();
    return 'ok';
  }, 30000);

  test('ui: the selection shows in the status bar, follows into Bearbeta and Exportera, and can be saved or cleared', async (assert) => {
    const selection = D.require('data/selection');
    const meta = await make('Urval i lägen', [['namn', 'text'], ['tal', 'integer']], [['a', 1], ['b', 2], ['c', 3]]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      shell.store.set({ selectedId: meta.id });
      shell.activate('bearbeta');
      await waitFor(() => Array.from(root.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('selection.use')), 5000, 'the button');
      assert.ok(root.querySelector('.dm-sb-selection').hidden, 'nothing to show yet');
      const search = /** @type {any} */ (root.querySelector('.dm-toolbar dm-input[type="search"]'));
      search.value = 'b';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(400);
      pressIn(root.querySelector('.dm-toolbar'), t('selection.use'));
      await waitFor(() => selection.get(), 3000, 'made');
      assert.deepEqual(selection.get().rowids, [2], 'what the table showed');
      const bar = root.querySelector('.dm-sb-selection');
      await waitFor(() => !bar.hidden, 2000, 'in the status bar');
      assert.ok(bar.textContent.includes('1'), bar.textContent);
      const pick = await waitFor(() => { const s = /** @type {any} */ (Array.from(root.querySelectorAll('.dm-toolbar dm-select')).find((x) => /** @type {any} */ (x).options.some((o) => o.value === '__selection'))); return s; }, 3000, 'the selection in the list');
      pick.value = '__selection';
      pick.dispatchEvent(new Event('change', { bubbles: true }));
      // Exportera: only the selection, by default.
      shell.activate('exportera');
      const scope = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => /** @type {any} */ (s).options.some((o) => o.value === 'selection')), 5000, 'the choice in Exportera'));
      assert.equal(scope.value, 'selection');
      const platformFiles = D.require('platform/files');
      const realDownload = platformFiles.download;
      let saved = null;
      platformFiles.download = (blob, name) => { saved = { blob, name }; };
      try {
        pressIn(root, t('export.run'));
        await waitFor(() => saved, 5000, 'the file');
        const text = await saved.blob.text();
        assert.ok(text.includes('b') && !text.includes('\na;') && !text.includes('c;3'), 'only the selected row: ' + text);
      } finally { platformFiles.download = realDownload; }
      // Cleared from the status bar.
      bar.click();
      const dlg = await waitFor(() => document.querySelector('dialog[open] .dm-op-tile') && document.querySelector('dialog[open]'), 3000, 'the menu');
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-op-tile[data-action="clear"]')).click();
      await waitFor(() => !selection.get() && bar.hidden, 3000, 'cleared');
    });
    return 'ok';
  }, 45000);

  test('export: a dataset that is more than a table says what carries all of it, and the files themselves can be had', async (assert) => {
    const zip = D.require('platform/storage/zip');
    const doc = track(await importer.runFiles([new File(['Rad ett.\n\nRad två.\n'], 'text.txt', { type: 'text/plain' })], { format: 'documents' }, 'Exportdokument'));
    const originals = await exporter.exportDataset(doc.id, 'document-originals');
    assert.ok(originals.filename.endsWith('.zip'));
    assert.ok((await zip.readZip(originals.blob))['text.txt'], 'the original file');
    const text = await (await exporter.exportDataset(doc.id, 'document-text')).blob.text();
    assert.ok(text.includes('# text.txt') && text.includes('Rad ett.') && text.includes('Rad två.'), text);
    const pictures = track(await importer.runFiles([await photoWithPosition('b.jpg')], { format: 'images' }, 'Exportbilder'));
    assert.ok((await zip.readZip((await exporter.exportDataset(pictures.id, 'images-zip')).blob))['b.jpg'], 'the picture');
    const g = { directed: true, nodes: [{ id: 'a', labels: ['X'], name: 'A, B', properties: {} }, { id: 'b', labels: ['X'], name: 'C', properties: {} }], edges: [{ id: 'e', source: 'a', target: 'b', type: 'T', properties: {} }] };
    const net = track(await graph.createGraphDataset({ name: 'Exportgraf', graph: g }));
    const parts = await zip.readZip((await exporter.exportDataset(net.id, 'graph-csv')).blob);
    assert.ok(zip.text(parts['noder.csv']).includes('"A, B"'), 'quoted');
    assert.ok(zip.text(parts['kanter.csv']).includes('kalla') && zip.text(parts['kanter.csv']).includes('a,b'), zip.text(parts['kanter.csv']));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === net.id), 3000, 'dataset');
      shell.store.set({ selectedId: net.id });
      shell.activate('exportera');
      const whole = await waitFor(() => root.querySelector(`optgroup[label="${t('export.group.whole')}"]`), 5000, 'the group');
      assert.ok(whole.querySelector('option[value="graphml"]') && root.querySelector(`optgroup[label="${t('export.group.table')}"] option[value="csv"]`), 'each format in its group');
      const select = whole.closest('dm-select');
      /** @type {any} */ (select).value = 'csv';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const note = await waitFor(() => root.querySelector('[data-loses]'), 2000, 'what is lost');
      assert.equal(note.textContent, t('export.loses.graph'));
    });
    return 'ok';
  }, 45000);

  test('p2p: a hello that gets lost is said again, and only counts once', async (assert) => {
    const p2p = D.require('platform/p2p');
    const a = p2p.offer();
    let b = null;
    try {
      await waitFor(() => a.offerPayload, 10000, 'offer');
      const certB = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' });
      b = p2p.answer(a.offerPayload, { certificate: certB });
      await waitFor(() => b.answerCode, 10000, 'answer');
      // The first hello from each side never leaves.
      for (const session of [a, b]) {
        const real = session.sendJson.bind(session);
        let dropped = false;
        session.sendJson = (obj) => { if (obj.t === 'hello' && !dropped) { dropped = true; return; } real(obj); };
      }
      let hellosA = 0; let hellosB = 0;
      a.on('hello', () => { hellosA++; });
      b.on('hello', () => { hellosB++; });
      await a.acceptAnswer(b.answerCode);
      await waitFor(() => a.peerInfo && b.peerInfo, 8000, 'hello both ways');
      await wait(1500);
      assert.equal(hellosA, 1, 'told once');
      assert.equal(hellosB, 1, 'told once');
      return 'ok';
    } finally { a.close(); if (b) b.close(); for (const peer of await p2p.peers()) await p2p.forget(peer.id); }
  }, 40000);

  test('adapt: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
