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

  test('adapt: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
