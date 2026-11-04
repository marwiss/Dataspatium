// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the code-free text and image tools (analysis/text, analysis/images), the {{bild}} template tag and
 * the views for document and image collections in Bearbeta and Analysera.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const textAnalysis = D.require('analysis/text');
  const imageAnalysis = D.require('analysis/images');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const exif = D.require('data/exif');
  const template = D.require('docgen/template');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const COLS = ['dokument', 'sida', 'stycke', 'typ', 'text', 'tecken'].map((name) => ({ name }));
  const ROWS = [
    ['a.txt', 1, 1, 'rubrik', 'Kommunens budget', 16],
    ['a.txt', 1, 2, 'stycke', 'Kommunen och regionen delar på kostnaden. Kommunen betalar mest.', 65],
    ['b.md', 1, 1, 'stycke', 'Regionen har en budget för vården och kommunen för skolan.', 58],
    ['b.md', 2, 2, 'tabell', 'Kommun | Budget', 15],
    ['b.md', 2, 3, 'stycke', 'År 2024 och 2025.', 17],
  ];
  async function makeJpeg(name, width, height, draw, fields) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d'); draw(ctx, width, height);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
    let bytes = new Uint8Array(await blob.arrayBuffer());
    if (fields) bytes = exif.insertApp1(bytes, exif.buildApp1(fields));
    return new File([bytes], name, { type: 'image/jpeg' });
  }
  const gradient = (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#000000'); g.addColorStop(1, '#ffffff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#d55e00'; ctx.fillRect(w / 8, h / 8, w / 3, h / 3); };
  const inverse = (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#000000'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#0072b2'; ctx.fillRect(w / 2, h / 2, w / 3, h / 3); };

  test('text: tokens, stopwords, word frequencies, KWIC, co-occurrences and the summary per document', async (assert) => {
    assert.deepEqual(textAnalysis.tokenize("Don't stop e-post 2024, Åland!"), ["don't", 'stop', 'e-post', '2024', 'åland']);
    const sv = textAnalysis.stopwordsFor('sv', 'budget, extra');
    assert.ok(sv.has('och') && sv.has('budget') && sv.has('extra'), 'list plus own words');
    assert.equal(textAnalysis.stopwordsFor('sv', 'bara', false).size, 1, 'own words only when the list is off');
    for (const lang of textAnalysis.LANGS) assert.ok(textAnalysis.STOPWORDS[lang].split(' ').length >= 80, lang + ' list has words');
    const idx = textAnalysis.indexes(COLS);
    assert.deepEqual([idx.docIndex, idx.pageIndex, idx.typeIndex, idx.textIndex], [0, 1, 3, 4]);
    const base = { textIndex: idx.textIndex, docIndex: idx.docIndex, pageIndex: idx.pageIndex, typeIndex: idx.typeIndex };
    const freq = await textAnalysis.wordFrequencies(ROWS, Object.assign({ stopwords: textAnalysis.stopwordsFor('sv'), minLength: 2 }, base));
    assert.deepEqual(freq.words.slice(0, 2).map((w) => [w.word, w.count, w.documents]), [['budget', 3, 2], ['kommunen', 3, 2]], JSON.stringify(freq.words.slice(0, 3)));
    assert.ok(!freq.words.some((w) => w.word === 'och' || w.word === 'på'), 'stopwords removed');
    assert.ok(!freq.words.some((w) => w.word === '2024'), 'numbers skipped by default');
    const withNumbers = await textAnalysis.wordFrequencies(ROWS, Object.assign({ numbers: true, minLength: 1 }, base));
    assert.ok(withNumbers.words.some((w) => w.word === '2024') && withNumbers.words.some((w) => w.word === 'och'), 'numbers and stopwords counted when asked');
    assert.ok(Math.abs(freq.words[0].share - 3 / freq.tokens) < 1e-9, 'share of the counted words');
    const all = textAnalysis.kwic(ROWS, 'kommun', Object.assign({ width: 20 }, base));
    assert.equal(all.total, 5, 'substring hits, any case');
    assert.deepEqual([all.hits[0].document, all.hits[0].page, all.hits[0].left, all.hits[0].match, all.hits[0].right], ['a.txt', 1, '', 'Kommun', 'ens budget']);
    assert.equal(textAnalysis.kwic(ROWS, 'kommun', Object.assign({ wholeWord: true }, base)).total, 1, 'whole word');
    assert.equal(textAnalysis.kwic(ROWS, 'Kommun', Object.assign({ caseSensitive: true }, base)).total, 4, 'case sensitive');
    assert.equal(textAnalysis.kwic(ROWS, 'kommun\\w*', Object.assign({ regex: true }, base)).total, 5, 'regex');
    assert.ok(textAnalysis.kwic(ROWS, '(', Object.assign({ regex: true }, base)).error, 'a bad pattern gives an error, not an exception');
    assert.equal(textAnalysis.kwic(ROWS, 'kommun', Object.assign({ limit: 2 }, base)).hits.length, 2, 'limit keeps the total');
    const pairs = await textAnalysis.cooccurrences(ROWS, Object.assign({ stopwords: textAnalysis.stopwordsFor('sv'), minLength: 2 }, base));
    assert.ok(pairs.pairs.some((p) => p.a === 'budget' && p.b === 'kommunens' && p.count === 1), 'pair in the heading: ' + JSON.stringify(pairs.pairs.slice(0, 5)));
    assert.ok(pairs.pairs.every((p) => p.a < p.b), 'pairs are ordered');
    const near = await textAnalysis.cooccurrences(ROWS, Object.assign({ stopwords: textAnalysis.stopwordsFor('sv'), minLength: 2, window: 1 }, base));
    assert.ok(near.pairs.some((p) => p.a === 'kommunen' && p.b === 'regionen'), 'neighbours within one word');
    assert.ok(!near.pairs.some((p) => p.a === 'betalar' && p.b === 'regionen'), 'distant words are not paired in a small window');
    const sum = textAnalysis.summary(ROWS, base);
    assert.deepEqual(sum.map((d) => [d.document, d.pages, d.paragraphs, d.headings, d.tables]), [['a.txt', 1, 2, 1, 0], ['b.md', 2, 3, 0, 1]]);
    assert.ok(sum[0].words === 11 && sum[0].distinct === 10 && sum[0].ttr > 0.9 && sum[0].ttr <= 1, JSON.stringify(sum[0]));
    return `${freq.types} word types`;
  });

  test('images: average hash, hamming distance, duplicate groups and the summary of a collection', async (assert) => {
    const gray = new Float32Array(64); for (let i = 0; i < 32; i++) gray[i] = 255;
    assert.equal(imageAnalysis.hashOfGray(gray), 'ffffffff00000000');
    assert.equal(imageAnalysis.hamming('ffffffff00000000', '00000000ffffffff'), 64);
    assert.equal(imageAnalysis.hamming('ffffffff00000000', 'ffffffff00000000'), 0);
    assert.equal(imageAnalysis.hamming('0000000000000000', '0000000000000001'), 1);
    const big = document.createElement('canvas'); big.width = 160; big.height = 120; gradient(big.getContext('2d'), 160, 120);
    const small = document.createElement('canvas'); small.width = 40; small.height = 30; gradient(small.getContext('2d'), 40, 30);
    const other = document.createElement('canvas'); other.width = 160; other.height = 120; inverse(other.getContext('2d'), 160, 120);
    const [h1, h2, h3] = await Promise.all([imageAnalysis.aHash(big), imageAnalysis.aHash(small), imageAnalysis.aHash(other)]);
    assert.equal(h1.length, 16);
    assert.ok(imageAnalysis.hamming(h1, h2) <= 4, `scaled copy is near: ${h1} ${h2} ${imageAnalysis.hamming(h1, h2)}`);
    assert.ok(imageAnalysis.hamming(h1, h3) >= 30, `inverse is far: ${imageAnalysis.hamming(h1, h3)}`);
    const jpegBlob = await new Promise((resolve) => big.toBlob(resolve, 'image/jpeg', 0.8));
    assert.ok(imageAnalysis.hamming(h1, await imageAnalysis.aHash(jpegBlob)) <= 4, 'a JPEG blob hashes like its canvas');
    const groups = imageAnalysis.groupDuplicates([{ name: 'a', hash: h1 }, { name: 'b', hash: h2 }, { name: 'c', hash: h3 }, { name: 'd', hash: h1 }], 5);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].map((g) => g.name), ['a', 'b', 'd']);
    assert.equal(groups[0][0].distance, 0);
    assert.equal(imageAnalysis.groupDuplicates([{ name: 'a', hash: h1 }, { name: 'c', hash: h3 }], 5).length, 0, 'no group for lonely pictures');
    const idx = imageAnalysis.indexes(D.require('io/importers/images').COLUMNS);
    const rows = [
      ['a.jpg', 'jpeg', 1000, 100, 50, '2024-06-01 12:00:00', 'Kamera A', 18.1, 59.3, null, null],
      ['b.jpg', 'jpeg', 3000, 200, 100, '2024-07-01 12:00:00', 'Kamera A', null, null, null, 'x'],
      ['c.png', 'png', 500, 10, 10, null, null, null, null, null, null],
    ];
    const sum = imageAnalysis.summarize(rows, idx);
    assert.deepEqual([sum.count, sum.bytes, sum.pixels, sum.withDate, sum.withCamera, sum.withPosition], [3, 4500, 25100, 2, 2, 1]);
    assert.deepEqual(sum.byType.map((e) => [e.value, e.count]), [['jpeg', 2], ['png', 1]]);
    assert.deepEqual(sum.byMonth.map((e) => e.value), ['2024-06', '2024-07']);
    assert.deepEqual(sum.byYear[0], { value: '2024', count: 2 });
    assert.equal(sum.largest[0][0], 'b.jpg');
    return `${h1} vs ${h3}`;
  });

  test('template: {{bild "fil.jpg" | bredd: 300}} puts a picture from an image collection into a document', async (assert) => {
    const jpg = await makeJpeg('foto.jpg', 600, 400, gradient, { make: 'Testkamera', model: 'X1' });
    const meta = await importer.runFiles([jpg], {}, 'Mallbilder');
    created.push(meta.id);
    const ctx = await template.buildContext(meta.id);
    const out = await template.renderTemplate('# Bilder\n\n{{bild "foto.jpg" | bredd: 300}}\n\n{{bild "saknas.jpg"}}\n', ctx);
    assert.equal(out.images.length, 2);
    assert.ok(out.images[0].png && out.images[0].png.byteLength > 1000, 'png bytes');
    assert.deepEqual([out.images[0].width, out.images[0].height, out.images[0].caption], [300, 200, 'foto.jpg']);
    assert.ok(out.images[1].error && out.images[1].error.includes('saknas.jpg'), 'missing picture reported: ' + out.images[1].error);
    assert.ok(out.text.includes(template.TOKEN + 'IMAGE:0' + template.TOKEN) && out.text.includes('IMAGE:1'), 'tokens in the text');
    // Another dataset as the context: the picture is still found in the image collection.
    const table = await datasets.create({ name: 'Tabell för mall', columns: [{ name: 'a', type: 'integer' }], rows: [[1]] });
    created.push(table.id);
    const fromTable = await template.resolveImage({ name: 'foto.jpg', opts: { bredd: 0, hojd: 0 } }, await template.buildContext(table.id));
    assert.deepEqual([fromTable.width, fromTable.height], [600, 400], 'natural size by default');
    return 'ok';
  }, 30000);

  test('ui: a document collection opens as a document, an image collection as a gallery, and Analysera gets the Text and Bilder tabs', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let docMeta = null; let imgMeta = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const md = new File(['# Rubrik\n\nKommunen och regionen delar på kostnaden.\n\nKommunen betalar mest.\n'], 'a.md', { type: 'text/markdown' });
      const txt = new File(['Regionen har en budget.\n\nKommunen har en skola.\n'], 'b.txt', { type: 'text/plain' });
      docMeta = await shell.ctx.services.importer.runFiles([md, txt], {}, 'UI-dokument');
      imgMeta = await shell.ctx.services.importer.runFiles([await makeJpeg('a.jpg', 300, 200, gradient, { make: 'Kamera', model: 'A', dateTimeOriginal: '2024-06-01 12:00:00' }), await makeJpeg('b.jpg', 300, 200, inverse, null)], {}, 'UI-bilder');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === imgMeta.id) && shell.store.get().datasets.some((d) => d.id === docMeta.id), 3000, 'datasets in store');
      const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
      // Bearbeta: document view with heading and paragraphs, search across documents, table one click away and back.
      shell.activate('bearbeta');
      shell.store.set({ selectedId: docMeta.id });
      await waitFor(() => root.querySelector('.dm-document-text h3'), 5000, 'document heading');
      assert.equal(root.querySelector('.dm-document-text h3').textContent, 'Rubrik');
      assert.equal(root.querySelectorAll('.dm-document-text p').length, 2, 'two paragraphs on the page');
      assert.ok(root.querySelector('.dm-left [data-id], .dm-left .dm-list-item'), 'dataset list still in the object panel');
      const search = /** @type {any} */ (root.querySelector('.dm-center dm-input[type="search"]'));
      search.value = 'kommunen'; search.dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-document-hit').length === 3, 5000, 'three search hits across both documents');
      root.querySelector('.dm-document-hit').click();
      await waitFor(() => root.querySelector('.dm-document-text'), 5000, 'back to the text after a hit');
      /** @type {any} */ (root.querySelector('.dm-document-text p')).click();
      await waitFor(() => Array.from(root.querySelectorAll('.dm-right h4')).some((e) => e.textContent === t('document.selected')), 3000, 'selected paragraph in the inspector');
      buttonByText(t('bearbeta.view.table')).click();
      await waitFor(() => root.querySelector('dm-table .dm-tr'), 5000, 'table rows');
      assert.equal(root.querySelectorAll('dm-table .dm-tr').length, 5, 'five paragraph rows');
      buttonByText(t('bearbeta.view.document')).click();
      await waitFor(() => root.querySelector('.dm-document-text'), 5000, 'document view again');
      // Gallery: thumbnails, inspector with the picture's details on click.
      shell.store.set({ selectedId: imgMeta.id });
      await waitFor(() => root.querySelectorAll('.dm-photos-item').length === 2, 8000, 'two thumbnails');
      assert.ok(root.querySelector('.dm-photos-item img[src^="blob:"]'), 'thumbnail from an object url');
      /** @type {any} */ (root.querySelector('.dm-photos-item')).click();
      await waitFor(() => root.querySelector('.dm-right .dm-photos-inspector-preview img'), 5000, 'preview in the inspector');
      assert.ok(Array.from(root.querySelectorAll('.dm-right dm-kv *')).some((e) => /Kamera A/.test(e.textContent || '')), 'camera in the inspector');
      buttonByText(t('bearbeta.view.table')).click();
      await waitFor(() => root.querySelectorAll('dm-table .dm-tr').length === 2, 5000, 'image rows');
      // Analysera: the Bilder tab for the image collection, the Text tab for the documents.
      shell.activate('analysera');
      const tabs = () => { const own = root.querySelector('.dm-center dm-tabs'); return own ? Array.from(own.querySelectorAll('[role="tab"]')).map((e) => e.textContent.trim()) : []; };
      await waitFor(() => tabs().includes(t('analysera.tabs.images')), 5000, 'Bilder tab');
      assert.deepEqual(tabs().slice(-2), [t('analysera.tabs.images'), t('analysera.tabs.notebook')], 'kind tool before the notebook');
      /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === t('analysera.tabs.images'))).click();
      await waitFor(() => root.querySelector('.dm-tool-result dm-kv'), 5000, 'image overview');
      await waitFor(() => root.querySelector('.dm-tool-result dm-table .dm-tr'), 5000, 'breakdown table');
      shell.store.set({ selectedId: docMeta.id });
      await waitFor(() => tabs().includes(t('analysera.tabs.text')) && !tabs().includes(t('analysera.tabs.images')), 5000, 'Text tab replaces Bilder');
      /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === t('analysera.tabs.text'))).click();
      await waitFor(() => root.querySelector('.dm-tool-result dm-table .dm-tr'), 8000, 'word frequency rows');
      // The first cell of a row is the row number; the word is the first column.
      const firstWord = root.querySelector('.dm-tool-result dm-table .dm-tr .dm-td:nth-child(2)').textContent;
      assert.equal(firstWord, 'kommunen', 'kommunen is the most frequent word (stopwords removed)');
      assert.ok(Array.from(root.querySelectorAll('.dm-right h4')).some((e) => e.textContent === t('text.tool.words')), 'inspector explains the tool');
      return 'ok';
    } finally {
      for (const m of [docMeta, imgMeta]) if (m) await datasets.remove(m.id).catch(() => {});
      root.remove();
    }
  }, 90000);

  test('ui: a collection is counted in documents and pictures, opens from Hantera with Läs and Visa bilder, and reads as a whole document', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let docMeta = null; let imgMeta = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const JsPdf = await D.require('viz/export').ensurePdfLibs();
      const pdfDoc = new JsPdf(); pdfDoc.text('Första sidan i rapporten.', 20, 20); pdfDoc.addPage(); pdfDoc.text('Andra sidan i rapporten.', 20, 20);
      const pdf = new File([pdfDoc.output('arraybuffer')], 'rapport.pdf', { type: 'application/pdf' });
      const txt = new File(['Sida ett i notisen.\n\nEtt stycke till.\n'], 'notis.txt', { type: 'text/plain' });
      docMeta = await shell.ctx.services.importer.runFiles([pdf, txt], {}, 'UI-samling');
      imgMeta = await shell.ctx.services.importer.runFiles([await makeJpeg('x.jpg', 200, 150, gradient, null), await makeJpeg('y.jpg', 200, 150, inverse, null)], {}, 'UI-foton');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === imgMeta.id) && shell.store.get().datasets.some((d) => d.id === docMeta.id), 3000, 'datasets in store');
      const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
      // The list, the status bar and Hantera count documents and pages, not rows and columns.
      shell.activate('hantera');
      shell.store.set({ selectedId: docMeta.id });
      const sub = t('datasets.sub.document', { n: '2', pages: '3' });
      await waitFor(() => { const row = root.querySelector(`.dm-left [data-id="${docMeta.id}"]`); return row && row.textContent.includes(sub); }, 5000, 'list counts documents and pages: ' + sub);
      assert.ok(shell.datasetEl && shell.datasetEl.textContent.includes(sub), 'status bar: ' + (shell.datasetEl && shell.datasetEl.textContent));
      await waitFor(() => buttonByText(t('hantera.read')), 5000, 'Läs button');
      assert.ok(Array.from(root.querySelectorAll('.dm-center dm-badge')).some((b) => b.textContent.trim() === t('document.files.n', { n: '2' })), 'badge with the number of documents');
      assert.ok(!Array.from(root.querySelectorAll('.dm-center dm-badge')).some((b) => /kolumner|columns/i.test(b.textContent)), 'no column badge for a collection');
      const entry = await waitFor(() => Array.from(root.querySelectorAll('.dm-center .dm-list-item')).find((b) => b.textContent.includes('notis.txt')), 5000, 'document list on the overview tab');
      /** @type {any} */ (entry).click();
      await waitFor(() => root.querySelector('.dm-document-text'), 5000, 'reading view opened from Hantera');
      assert.equal(shell.store.get().mode, 'bearbeta');
      const docSel = /** @type {any} */ (root.querySelector(`.dm-center dm-select[aria-label="${t('document.select')}"]`));
      assert.equal(docSel.value, 'notis.txt', 'the clicked document is open');
      assert.equal(root.querySelector('.dm-document-text p').textContent, 'Sida ett i notisen.');
      // Whole document: the PDF's two pages in one flow with page markers.
      docSel.value = 'rapport.pdf'; docSel.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelector('.dm-document-text p') && /Första sidan/.test(root.querySelector('.dm-document-text p').textContent), 5000, 'pdf page one');
      const modeSel = /** @type {any} */ (root.querySelector(`.dm-center dm-select[aria-label="${t('document.mode')}"]`));
      assert.deepEqual(Array.from(modeSel.options || []).map((o) => o.value), ['page', 'all', 'image'], 'three views for a PDF');
      modeSel.value = 'all'; modeSel.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-document-whole .dm-document-page-marker').length === 2, 5000, 'two page markers');
      assert.equal(root.querySelectorAll('.dm-document-whole p').length, 2, 'both pages in one flow');
      // Pictures: Visa bilder and the thumbnails on the overview tab; a click opens that picture in the gallery.
      shell.activate('hantera');
      shell.store.set({ selectedId: imgMeta.id });
      await waitFor(() => buttonByText(t('hantera.view.images')), 5000, 'Visa bilder button');
      await waitFor(() => root.querySelectorAll('.dm-photos-preview-grid .dm-photos-item').length === 2, 8000, 'two thumbnails on the overview');
      assert.ok(Array.from(root.querySelectorAll('.dm-center dm-badge')).some((b) => b.textContent.trim() === t('gallery.count', { n: '2' })), 'badge with the number of pictures');
      /** @type {any} */ (root.querySelectorAll('.dm-photos-preview-grid .dm-photos-item')[1]).click();
      await waitFor(() => root.querySelector('.dm-photos.dm-center-fill .dm-photos-item[aria-current="true"]'), 8000, 'gallery with the clicked picture selected');
      assert.ok(root.querySelector('.dm-photos-item[aria-current="true"]').textContent.includes('y.jpg'), 'y.jpg is selected');
      await waitFor(() => root.querySelector('.dm-right .dm-photos-inspector-preview img'), 5000, 'inspector shows the picture');
      return 'ok';
    } finally {
      for (const m of [docMeta, imgMeta]) if (m) await datasets.remove(m.id).catch(() => {});
      root.remove();
    }
  }, 90000);

  test('text-tools: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
