// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for reading text in pictures. The engine is replaced with a stub, so nothing is fetched. The real engine runs only when
 * the page is opened with `?ocr=1`, which downloads it from its pinned addresses and checks them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const i18n = D.require('ui/i18n');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const dsFiles = D.require('data/dataset-files');
  const health = D.require('data/kind-health');
  const engine = D.require('engines/ocr');
  const ocr = D.require('data/ocr');
  const created = [];
  const track = (meta) => { created.push(meta.id); return meta; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error(`timed out: ${label}`);
      await wait(30);
    }
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
  const buttonIn = (el, text) => Array.from(el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const openDialog = () => document.querySelector('dialog[open]');
  /** Text drawn as a picture, large enough for the real engine too. */
  function drawn(lines, width = 1400, height = 600) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, width, height);
    g.fillStyle = '#000000'; g.font = '48px serif';
    lines.forEach((line, i) => g.fillText(line, 40, 80 + i * 80));
    return canvas;
  }
  const blobOf = (canvas, type = 'image/png') => new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
  /** A PDF whose pages are pictures, with text only on the pages given. */
  async function scanned(name, pages, withText = []) {
    const JsPdf = await D.require('viz/export').ensurePdfLibs();
    const doc = new JsPdf();
    for (let p = 1; p <= pages; p++) {
      if (p > 1) doc.addPage();
      if (withText.includes(p)) doc.text(`Riktig text på sida ${p}`, 20, 20);
      else doc.addImage(drawn([`Kommunerna på sida ${p}`]).toDataURL('image/png'), 'PNG', 10, 20, 190, 80);
    }
    return new File([doc.output('arraybuffer')], name, { type: 'application/pdf' });
  }
  async function photo(name, lines) {
    const blob = await blobOf(drawn(lines), 'image/jpeg');
    return new File([await blob.arrayBuffer()], name, { type: 'image/jpeg' });
  }
  /** A stub engine that says what page it was given, so that each page's text can be told apart. */
  function stub(text = (n) => `Stycke ett, läsning ${n}\nmed en rad till\n\nStycke två är upp-\ndelat`, confidence = 88) {
    const seen = [];
    engine.setEngine(async (image, options) => {
      seen.push({ image, options });
      return { text: text(seen.length), confidence };
    });
    return seen;
  }
  /** Fails the test if anything tries to fetch while `fn` runs. */
  async function offline(fn) {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = (...args) => { calls.push(String(args[0])); return real.apply(globalThis, args); };
    try { return await fn(); } finally {
      globalThis.fetch = real;
      if (calls.length) throw new Error(`fetched: ${calls.join(', ')}`);
    }
  }

  test('ocr: the engine and every language are pinned', async (assert) => {
    for (const spec of [engine.CORE].concat(Object.keys(engine.LANGUAGES).map((code) => engine.languageSpec(code)))) {
      assert.ok(/^[0-9a-f]{64}$/.test(spec.sha256), spec.id);
      assert.ok(spec.size > 1000000, spec.id);
      assert.ok(/@\d+\.\d+\.\d+\//.test(spec.urls[0]), spec.urls[0]);
      assert.ok(spec.urls[0].startsWith('https://cdn.jsdelivr.net/npm/'), spec.urls[0]);
    }
    for (const l of i18n.LANGUAGES) assert.ok(engine.LANGUAGES[l.code], `data for ${l.code}`);
    assert.equal(engine.downloadSize('en'), engine.CORE.size + engine.LANGUAGES.en.size, 'English needs only itself');
    assert.equal(engine.downloadSize('sv'), engine.CORE.size + engine.LANGUAGES.en.size + engine.LANGUAGES.sv.size, 'the others read English alongside');
    return 'ok';
  });

  test('ocr: read text becomes paragraphs and tables', async (assert) => {
    assert.deepEqual(ocr.paragraphsOf('Första raden\nandra raden\n\nNästa stycke\n \n\n'), ['Första raden andra raden', 'Nästa stycke']);
    assert.deepEqual(ocr.paragraphsOf('Kommun-\nerna samar-\nbetar om E-\nHälsa'), ['Kommunerna samarbetar om E- Hälsa'], 'a split word is joined, a capital is not');
    assert.deepEqual(ocr.paragraphsOf(''), []);
    assert.equal(ocr.tableText('kommun    antal\nUmeå      130\n\nLuleå     77\n'), 'kommun;antal\nUmeå;130\nLuleå;77', 'the distance marks the columns');
    assert.equal(ocr.tableText('Övre Norrland    12 345\nUmeå    130'), 'Övre Norrland;12 345\nUmeå;130', 'a single space stays inside a cell');
    assert.equal(ocr.tableText('kommun antal\nUmeå 130\nLuleå 77'), 'kommun;antal\nUmeå;130\nLuleå;77', 'as many words on every line');
    assert.equal(ocr.tableText('En mening om tabellen\nsom är löptext'), 'En mening om tabellen\nsom är löptext', 'running text stays as it is');
    return 'ok';
  });

  test('ocr: the pages of a scanned PDF get their text, and undo takes it back', async (assert) => {
    const seen = stub();
    try {
      const meta = track(await importer.runFiles([await scanned('blandad.pdf', 3, [2])], { format: 'documents' }, 'Skannat'));
      const doc = (await datasets.get(meta.id)).documents[0];
      assert.deepEqual(await ocr.pagesWithoutText(meta.id, doc), [1, 3], 'page 2 has its text');
      assert.ok((await health.check(meta.id)).some((f) => f.key === 'health.document.pages'), 'the overview says so');
      const steps = [];
      const res = await offline(() => ocr.readDocument(meta.id, doc, { language: 'da', onProgress: (done, total) => steps.push(`${done}/${total}`) }));
      assert.equal(res.pages, 2);
      assert.equal(res.confidence, 88);
      assert.ok(res.words > 8, String(res.words));
      assert.equal(steps.join(' '), '0/2 1/2 2/2');
      assert.equal(seen.length, 2);
      assert.equal(seen[0].image.type, 'image/png', 'a page as a picture');
      assert.ok(seen[0].image.size > 1000, 'with something on it');
      assert.equal(seen[0].options.language, 'da');
      const rows = await datasets.query(meta.id, { orderBy: 'sida' });
      assert.deepEqual(rows.map((r) => r[1]), [1, 1, 2, 3, 3], 'in page order');
      assert.equal(rows[0][4], 'Stycke ett, läsning 1 med en rad till');
      assert.equal(rows[1][4], 'Stycke två är uppdelat');
      assert.equal(rows[0][3], 'stycke');
      assert.equal(rows[0][5], rows[0][4].length, 'tecken');
      assert.equal(new Set(rows.map((r) => r[2])).size, rows.length, 'paragraph numbers stay unique in the document');
      assert.equal((await datasets.get(meta.id)).rowCount, 5);
      const after = (await datasets.get(meta.id)).documents[0];
      assert.deepEqual(after.ocr, { pages: [1, 3], language: 'da', confidence: 88 }, 'the document says what was read by machine');
      assert.equal(after.paragraphs, 5);
      assert.ok(ocr.readingOf(after, 1) && !ocr.readingOf(after, 2), 'page 2 was not');
      assert.deepEqual(await ocr.pagesWithoutText(meta.id, after), []);
      assert.equal((await health.check(meta.id)).length, 0, 'nothing left to tell');
      assert.equal((await ocr.readDocument(meta.id, after)).pages, 0, 'nothing to read twice');
      assert.equal(seen.length, 2);
      assert.ok((await datasets.log(meta.id)).some((e) => e.details && e.details.op === 'ocr_text'), 'in the log');
      await recipes.undo(meta.id);
      const undone = (await datasets.get(meta.id)).documents[0];
      assert.equal(undone.ocr, undefined, 'the mark goes with the text');
      assert.deepEqual(await ocr.pagesWithoutText(meta.id, undone), [1, 3]);
      const signal = { stop: false };
      engine.setEngine(async () => { signal.stop = true; return { text: 'Bara första sidan', confidence: 70 }; });
      const part = await ocr.readDocument(meta.id, undone, { signal });
      assert.equal(part.pages, 1, 'stopped after the page it was on');
      assert.deepEqual(await ocr.pagesWithoutText(meta.id, (await datasets.get(meta.id)).documents[0]), [3], 'and the read page stays');
    } finally { engine.setEngine(null); }
    return 'ok';
  }, 60000);

  test('ocr: a document, a Word file and pictures are not offered as scanned', async (assert) => {
    assert.equal(ocr.isPdf({ name: 'a.PDF' }), true);
    assert.equal(ocr.isPdf({ name: 'a', type: 'pdf' }), true);
    assert.equal(ocr.isPdf({ name: 'a.docx', type: 'docx' }), false);
    assert.equal(ocr.isPdf(null), false);
    const meta = track(await importer.runFiles([new File(['En rad.\n'], 'text.md', { type: 'text/markdown' })], { format: 'documents' }, 'Bara text'));
    assert.deepEqual(await ocr.pagesWithoutText(meta.id, (await datasets.get(meta.id)).documents[0]), []);
    return 'ok';
  }, 20000);

  test('ocr: the document view offers reading and marks what was read', async (assert) => {
    stub();
    try {
      const meta = track(await importer.runFiles([await scanned('vy.pdf', 2)], { format: 'documents' }, 'Skannad vy'));
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
        shell.activate('bearbeta');
        shell.store.set({ selectedId: meta.id });
        const missing = await waitFor(() => root.querySelector('[data-ocr-missing]'), 8000, 'the line about pages without text');
        assert.ok(missing.textContent.includes('2'), missing.textContent);
        assert.ok(!root.querySelector('[data-ocr-note]'), 'nothing is machine read yet');
        buttonIn(root, t('ocr.action')).click();
        const dlg = await waitFor(openDialog, 3000, 'dialog');
        const select = dlg.querySelector('dm-select');
        assert.equal(select.options.length, 7, 'the seven languages');
        assert.ok(dlg.textContent.includes(i18n.formatBytes(engine.downloadSize(select.value))), 'it says what would be fetched');
        await offline(async () => {
          buttonIn(dlg, t('ocr.read')).click();
          await waitFor(() => !openDialog(), 15000, 'the dialog closes when it is done');
        });
        const note = await waitFor(() => root.querySelector('[data-ocr-note]'), 8000, 'the note on the page');
        assert.ok(note.textContent.includes('88'), note.textContent);
        assert.ok(!root.querySelector('[data-ocr-missing]'), 'no pages left');
        await waitFor(() => root.querySelector('.dm-document-text p'), 5000, 'the text');
        assert.ok(root.querySelector('.dm-document-text').textContent.includes('läsning 1'), 'the text of the page');
        buttonIn(root, t('ocr.show.page')).click();
        await waitFor(() => root.querySelector('.dm-document canvas'), 8000, 'the picture of the page');
      });
    } finally { engine.setEngine(null); }
    return 'ok';
  }, 60000);

  test('ocr: a failure stays in the dialog and leaves the document alone', async (assert) => {
    engine.setEngine(async () => { throw new Error('Kan inte läsa'); });
    try {
      const meta = track(await importer.runFiles([await scanned('fel.pdf', 1)], { format: 'documents' }, 'Skannat fel'));
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
        shell.activate('bearbeta');
        shell.store.set({ selectedId: meta.id });
        await waitFor(() => root.querySelector('[data-ocr-missing]'), 8000, 'the line');
        buttonIn(root, t('ocr.action')).click();
        const dlg = await waitFor(openDialog, 3000, 'dialog');
        buttonIn(dlg, t('ocr.read')).click();
        const shown = await waitFor(() => dlg.querySelector('[data-ocr-error]'), 8000, 'the error');
        assert.ok(shown.textContent.includes('Kan inte läsa'), shown.textContent);
      });
      assert.equal((await datasets.get(meta.id)).rowCount, 0);
    } finally { engine.setEngine(null); }
    return 'ok';
  }, 40000);

  test('ocr: pictures become a document collection, and one picture its description', async (assert) => {
    const seen = stub((n) => `Skylt nummer ${n}`);
    try {
      const album = track(await importer.runFiles([await photo('a.jpg', ['A']), await photo('b.jpg', ['B'])], { format: 'images' }, 'Skyltar'));
      const made = track(await ocr.picturesToDocuments(album.id, ['a.jpg', 'b.jpg'], { language: 'sv', name: 'Skyltarnas text' }));
      assert.equal(made.kind, 'document');
      assert.equal(made.name, 'Skyltarnas text');
      assert.equal(seen[0].image.type, 'image/png', 'a JPEG is read as PNG');
      const full = await datasets.get(made.id);
      assert.deepEqual(full.documents.map((d) => d.name), ['a.jpg', 'b.jpg']);
      assert.deepEqual(full.documents[0].ocr, { pages: [1], language: 'sv', confidence: 88 });
      assert.equal(full.rowCount, 2);
      assert.equal(full.source.from, album.id);
      const file = await dsFiles.read(made.id, 'a.jpg', 'original');
      assert.ok(file && file.bytes.length > 100, 'the picture goes with its text');
      assert.equal((await datasets.get(album.id)).kind, 'images', 'the album stays');
      assert.equal((await datasets.get(album.id)).rowCount, 2);
      assert.equal(await ocr.picturesToDocuments(album.id, []), null, 'no pictures, no dataset');
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
        shell.activate('bearbeta');
        shell.store.set({ selectedId: album.id });
        const item = await waitFor(() => root.querySelector('.dm-photos-item'), 8000, 'the gallery');
        item.click();
        const one = await waitFor(() => buttonIn(root, t('ocr.picture')), 5000, 'the button for one picture');
        one.click();
        let dlg = await waitFor(openDialog, 3000, 'dialog');
        await offline(async () => {
          buttonIn(dlg, t('ocr.read')).click();
          await waitFor(() => !openDialog(), 8000, 'done');
        });
        const description = Array.from(root.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('gallery.description'));
        await waitFor(() => /** @type {any} */ (description).value.startsWith('Skylt nummer'), 3000, 'the text in the description');
        buttonIn(root, t('ocr.action')).click();
        dlg = await waitFor(openDialog, 3000, 'dialog');
        assert.ok(dlg.textContent.includes('2'), 'says how many pictures');
        buttonIn(dlg, t('ocr.read')).click();
        await waitFor(() => !openDialog(), 15000, 'done');
        const id = await waitFor(() => { const s = shell.store.get().selectedId; return s && s !== album.id ? s : null; }, 5000, 'the new collection opens');
        created.push(id);
        assert.equal((await datasets.get(id)).kind, 'document');
      });
    } finally { engine.setEngine(null); }
    return 'ok';
  }, 60000);

  test('ocr: a picture of a table lands in the paste box, for the normal import', async (assert) => {
    stub(() => 'kommun     antal\nUmeå       130\nLuleå      77\n');
    try {
      await withApp(async (shell, root) => {
        shell.activate('inhamta');
        const source = await waitFor(() => Array.from(root.querySelectorAll('.dm-list button, .dm-list [role="button"], .dm-list-item')).find((x) => x.textContent.includes(t('import.sources.paste'))), 5000, 'the source');
        source.click();
        const button = await waitFor(() => buttonIn(root, t('import.paste.picture')), 5000, 'the button');
        const box = Array.from(root.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('import.paste.label'));
        button.click();
        const dlg = await waitFor(openDialog, 3000, 'dialog');
        const zone = dlg.querySelector('dm-dropzone');
        assert.ok(zone, 'it asks for a picture');
        const file = new File([await blobOf(drawn(['kommun    antal']))], 'tabell.png', { type: 'image/png' });
        await offline(async () => {
          zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [file] }, bubbles: true }));
          await waitFor(() => !openDialog(), 8000, 'done');
        });
        await waitFor(() => /** @type {any} */ (box).value === 'kommun;antal\nUmeå;130\nLuleå;77', 3000, 'the rows in the box');
        buttonIn(root, t('import.paste.use')).click();
        await waitFor(() => root.textContent.includes('kommun') && root.querySelector('table, dm-table, .dm-table'), 8000, 'the import reads the rows');
      });
    } finally { engine.setEngine(null); }
    return 'ok';
  }, 40000);

  test('ocr: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* already gone */ } }
    return 'ok';
  });

  if (/[?&]ocr=1\b/.test(location.search)) {
    test('ocr live: reads Swedish, a table and a scanned PDF', async (assert) => {
      engine.setEngine(null);
      for (const code of Object.keys(engine.LANGUAGES)) await engine.prepare(code);
      await engine.prepare('sv');
      const page = await engine.read(await blobOf(drawn(['Kommunerna i Västerbotten', 'samarbetar om räddningstjänst'])), { language: 'sv' });
      console.log('DATASPATIUM-LOG: ocr text', JSON.stringify(page.text), page.confidence);
      assert.ok(/Kommunerna/.test(page.text) && /Västerbotten/.test(page.text), page.text);
      assert.ok(/räddningstjänst/.test(page.text), page.text);
      assert.ok(page.confidence > 60, String(page.confidence));
      const canvas = drawn([]);
      const g = canvas.getContext('2d');
      g.fillStyle = '#000000'; g.font = '48px sans-serif';
      [['kommun', 'antal'], ['Umeå', '130'], ['Luleå', '77']].forEach((row, i) => { g.fillText(row[0], 40, 80 + i * 90); g.fillText(row[1], 700, 80 + i * 90); });
      const table = await ocr.readTable(await blobOf(canvas), { language: 'sv' });
      console.log('DATASPATIUM-LOG: ocr table', JSON.stringify(table.text), table.confidence);
      const lines = table.text.split('\n');
      assert.equal(lines.length, 3, table.text);
      assert.ok(/^kommun;antal$/i.test(lines[0]), table.text);
      assert.ok(/;130$/.test(lines[1]), table.text);
      const meta = await importer.runFiles([await scanned('riktig.pdf', 2)], { format: 'documents' }, 'Riktigt skannad');
      const doc = (await datasets.get(meta.id)).documents[0];
      const res = await ocr.readDocument(meta.id, doc, { language: 'sv' });
      assert.equal(res.pages, 2);
      const rows = await datasets.query(meta.id, { orderBy: 'sida' });
      console.log('DATASPATIUM-LOG: ocr pages', JSON.stringify(rows.map((r) => r[4])));
      assert.ok(rows.some((r) => /Kommunerna på sida 1/.test(r[4])), JSON.stringify(rows));
      assert.ok(rows.some((r) => /Kommunerna på sida 2/.test(r[4])), JSON.stringify(rows));
      await datasets.remove(meta.id);
      engine.terminate();
      return 'ok';
    }, 300000);
  }
})();
