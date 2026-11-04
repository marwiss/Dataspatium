// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for document and image collections: PDF (pdf.js in a shimmed worker), Word, OpenDocument, text and Markdown
 * become paragraph rows with their originals; JPEG EXIF gives date, camera and position; previews and thumbnails are
 * kept in the dataset and survive the bundle round trip.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const dsFiles = D.require('data/dataset-files');
  const exif = D.require('data/exif');
  const zip = D.require('platform/storage/zip');
  const created = [];

  async function makePdf(pages, lines = 12) {
    const JsPdf = await D.require('viz/export').ensurePdfLibs();
    const doc = new JsPdf();
    for (let p = 1; p <= pages; p++) {
      if (p > 1) doc.addPage();
      doc.setFontSize(16); doc.text(`Kapitel ${p}`, 20, 20);
      doc.setFontSize(11);
      for (let l = 0; l < lines; l++) doc.text(`Sida ${p} rad ${l + 1}: Stockholm 984 748 invånare, Göteborg 596 841, Malmö 362 133.`, 20, 32 + l * 6);
    }
    return new File([doc.output('arraybuffer')], `test-${pages}.pdf`, { type: 'application/pdf' });
  }
  async function makeDocx() {
    const office = D.require('docgen/builders-office');
    const ast = { blocks: [
      { type: 'heading', level: 1, runs: [{ text: 'Rapport om kommuner' }] },
      { type: 'paragraph', runs: [{ text: 'Första stycket handlar om Stockholm och Göteborg.' }] },
      { type: 'paragraph', runs: [{ text: 'Andra stycket nämner Malmö.' }] },
      { type: 'table', columns: ['kommun', 'befolkning'], rows: [['Stockholm', '984 748'], ['Malmö', '362 133']], numeric: [false, true] },
    ] };
    const out = await office.toDocx(ast, { title: 'Rapport' });
    const blob = out instanceof Blob ? out : (out && out.blob) || new Blob([out]);
    return new File([blob], 'rapport.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  async function makeOdt() {
    const content = '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:text>'
      + '<text:h text:outline-level="1">Inledning</text:h><text:p>Ett stycke<text:s text:c="2"/>med mellanslag och <text:span>fetstil</text:span>.</text:p>'
      + '<text:p>Andra stycket<text:soft-page-break/> fortsätter på nästa sida.</text:p><text:p>Tredje stycket på sida två.</text:p>'
      + '<table:table><table:table-row><table:table-cell><text:p>Kommun</text:p></table:table-cell><table:table-cell><text:p>Antal</text:p></table:table-cell></table:table-row></table:table>'
      + '</office:text></office:body></office:document-content>';
    const meta = '<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"><office:meta><dc:title>Odt-test</dc:title><meta:initial-creator>Testaren</meta:initial-creator><meta:creation-date>2024-05-01T10:00:00</meta:creation-date></office:meta></office:document-meta>';
    const blob = await zip.createZip({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': content, 'meta.xml': meta }, { level: 0 });
    return new File([blob], 'anteckning.odt', { type: 'application/vnd.oasis.opendocument.text' });
  }
  async function makeJpeg(name, width, height, fields) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0, 0, width, height); g.addColorStop(0, '#0072B2'); g.addColorStop(1, '#E69F00'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
    let bytes = new Uint8Array(await blob.arrayBuffer());
    if (fields) bytes = exif.insertApp1(bytes, exif.buildApp1(fields));
    return new File([bytes], name, { type: 'image/jpeg' });
  }

  test('exif: a built APP1 segment reads back with date, camera, description and position', (assert) => {
    const seg = exif.buildApp1({ dateTimeOriginal: '2024-06-01 12:30:00', make: 'Testkamera', model: 'X1', description: 'Stockholm från Söder', lat: 59.3293, lon: 18.0686, altitude: 12.5 });
    const jpeg = exif.insertApp1(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]), seg);
    const e = exif.parse(jpeg);
    assert.ok(e, 'parsed');
    assert.equal(e.dateTimeOriginal, '2024-06-01 12:30:00'); assert.equal(e.dateTime, '2024-06-01 12:30:00');
    assert.equal(e.make, 'Testkamera'); assert.equal(e.model, 'X1'); assert.equal(e.description, 'Stockholm från Söder');
    assert.ok(Math.abs(e.lat - 59.3293) < 0.0001 && Math.abs(e.lon - 18.0686) < 0.0001, `position ${e.lat}, ${e.lon}`);
    assert.ok(Math.abs(e.altitude - 12.5) < 0.01, 'altitude ' + e.altitude);
    const south = exif.parse(exif.insertApp1(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]), exif.buildApp1({ lat: -33.8688, lon: -70.6693 })));
    assert.ok(south.lat < 0 && south.lon < 0, 'southern and western hemispheres');
    assert.equal(exif.parse(new Uint8Array([0x89, 0x50, 0x4E, 0x47])), null, 'not a JPEG');
    return 'ok';
  });

  test('documents: PDF, Word, OpenDocument, text and Markdown become paragraph rows with pages, headings and their originals', async (assert) => {
    const pdf = await makePdf(3);
    const docx = await makeDocx();
    const odt = await makeOdt();
    const txt = new File(['Första stycket i textfilen.\n\nAndra stycket\nsom fortsätter på två rader.\n'], 'notis.txt', { type: 'text/plain' });
    const md = new File(['# Rubrik ett\n\nEtt stycke under rubriken.\n\n## Rubrik två\n- punkt a\n- punkt b\n'], 'readme.md', { type: 'text/markdown' });
    assert.equal(importer.collectionFor([pdf, docx, odt, txt, md]).id, 'documents', 'all five are documents');
    assert.equal(importer.collectionFor([pdf, txt, new File([''], 'x.csv')]), null, 'a CSV is not a document');
    const meta = await importer.runFiles([pdf, docx, odt, txt, md], { format: 'documents' }, 'Dokumentsamling');
    created.push(meta.id);
    assert.equal(meta.kind, 'document');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['dokument', 'sida', 'stycke', 'typ', 'text', 'tecken']);
    const rows = await datasets.query(meta.id);
    const byDoc = (name) => rows.filter((r) => r[0] === name);
    const pdfRows = byDoc('test-3.pdf');
    assert.ok(pdfRows.length >= 6, 'pdf paragraphs ' + pdfRows.length);
    assert.deepEqual(Array.from(new Set(pdfRows.map((r) => r[1]))), [1, 2, 3], 'pdf page numbers');
    assert.ok(pdfRows.some((r) => r[3] === 'rubrik' && /Kapitel 2/.test(r[4])), 'pdf heading by size: ' + JSON.stringify(pdfRows.slice(0, 4)));
    assert.ok(pdfRows.some((r) => /Sida 3 rad 1/.test(r[4])), 'pdf text of page 3');
    const docxRows = byDoc('rapport.docx');
    assert.ok(docxRows.some((r) => r[3] === 'rubrik' && r[4] === 'Rapport om kommuner'), 'docx heading: ' + JSON.stringify(docxRows));
    assert.ok(docxRows.some((r) => r[3] === 'tabell' && /Stockholm \| 984 748/.test(r[4])), 'docx table rows');
    const odtRows = byDoc('anteckning.odt');
    assert.ok(odtRows.some((r) => r[3] === 'rubrik' && r[4] === 'Inledning'), 'odt heading');
    assert.ok(odtRows.some((r) => r[4] === 'Ett stycke med mellanslag och fetstil.'), 'odt spaces and spans: ' + JSON.stringify(odtRows));
    assert.ok(odtRows.some((r) => r[1] === 2 && /Tredje stycket/.test(r[4])), 'odt soft page break counts pages');
    assert.ok(odtRows.some((r) => r[3] === 'tabell' && r[4] === 'Kommun | Antal'), 'odt table');
    assert.deepEqual(byDoc('notis.txt').map((r) => r[4]), ['Första stycket i textfilen.', 'Andra stycket som fortsätter på två rader.']);
    const mdRows = byDoc('readme.md');
    assert.deepEqual(mdRows.map((r) => r[3] + ':' + r[4]), ['rubrik:Rubrik ett', 'stycke:Ett stycke under rubriken.', 'rubrik:Rubrik två', 'stycke:• punkt a • punkt b']);
    assert.ok(rows.every((r) => r[5] === r[4].length), 'character counts');
    const files = await dsFiles.list(meta.id);
    assert.deepEqual(files.map((f) => f.name).sort(), ['anteckning.odt', 'notis.txt', 'rapport.docx', 'readme.md', 'test-3.pdf']);
    assert.ok(files.every((f) => f.kind === 'original' && f.size > 0), 'originals stored');
    const full = await datasets.get(meta.id);
    assert.equal(full.documents.length, 5);
    const odtMeta = full.documents.find((d) => d.name === 'anteckning.odt');
    assert.equal(odtMeta.title, 'Odt-test'); assert.equal(odtMeta.author, 'Testaren'); assert.equal(odtMeta.pages, 2);
    assert.equal(full.documents.find((d) => d.name === 'test-3.pdf').pages, 3);
    // The round trip through bytes (bundles, GitHub, devices) keeps kind, documents and files.
    const copy = await datasets.importBytes(await datasets.exportBytes(meta.id), { name: 'Dokumentsamling kopia' });
    created.push(copy.id);
    assert.equal(copy.kind, 'document');
    assert.equal((await dsFiles.list(copy.id)).length, 5, 'files survive the round trip');
    const original = await dsFiles.read(copy.id, 'test-3.pdf');
    assert.ok(original && original.type === 'application/pdf' && original.bytes.length === pdf.size, 'pdf bytes intact');
    // The wizard preview of a single document shows its first paragraphs with the declared types.
    const pv = await importer.preview(docx, {});
    assert.equal(pv.importer, 'documents');
    assert.deepEqual(pv.inferred.map((c) => c.type), ['text', 'integer', 'integer', 'text', 'text', 'integer']);
    return `${rows.length} paragraphs from 5 files`;
  }, 180000);

  test('documents: a 200-page PDF is read in the worker in under 30 seconds and a page renders on a canvas', async (assert) => {
    const pdf = await makePdf(200, 30);
    const t0 = performance.now();
    const meta = await importer.runFiles([pdf], {}, 'Stor PDF');
    created.push(meta.id);
    const ms = performance.now() - t0;
    assert.ok(ms < 30000, 'import took ' + Math.round(ms) + ' ms');
    assert.ok(meta.rowCount >= 400, 'rows ' + meta.rowCount);
    const last = await datasets.query(meta.id, { limit: 1, orderBy: 'sida', dir: 'desc' });
    assert.equal(last[0][1], 200, 'last page number');
    const engine = D.require('engines/pdf');
    const file = await dsFiles.read(meta.id, 'test-200.pdf');
    const doc = await engine.open(file.bytes);
    const canvas = document.createElement('canvas');
    const info = await engine.render(doc, 2, canvas, { width: 400 });
    assert.equal(info.pages, 200);
    const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let dark = 0; for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
    assert.ok(dark > 500, 'rendered page has text pixels: ' + dark);
    await doc.destroy();
    return `${meta.rowCount} paragraphs in ${Math.round(ms)} ms`;
  }, 180000);

  test('images: JPEG with EXIF gives date, camera and position; previews and thumbnails are stored', async (assert) => {
    const jpg = await makeJpeg('foto.jpg', 2400, 1600, { dateTimeOriginal: '2024-06-01 12:30:00', make: 'Testkamera', model: 'X1', lat: 59.3293, lon: 18.0686, altitude: 12.5, description: 'Stockholm' });
    const plain = await makeJpeg('liten.jpg', 300, 200, null);
    const pngBlob = await new Promise((resolve) => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; c.getContext('2d').fillStyle = '#009E73'; c.getContext('2d').fillRect(0, 0, 64, 48); c.toBlob(resolve, 'image/png'); });
    const png = new File([pngBlob], 'ikon.png', { type: 'image/png' });
    assert.equal(importer.collectionFor([jpg, plain, png]).id, 'images');
    const meta = await importer.runFiles([jpg, plain, png], {}, 'Bilder');
    created.push(meta.id);
    assert.equal(meta.kind, 'images');
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.name), ['fil', 'typ', 'storlek', 'bredd', 'hojd', 'datum', 'kamera', 'lon', 'lat', 'altitud', 'beskrivning']);
    assert.deepEqual(cols.map((c) => c.type), ['text', 'text', 'integer', 'integer', 'integer', 'datetime', 'text', 'number', 'number', 'number', 'text']);
    const rows = await datasets.query(meta.id);
    const foto = rows.find((r) => r[0] === 'foto.jpg');
    assert.deepEqual(foto.slice(1, 5), ['jpeg', jpg.size, 2400, 1600]);
    assert.equal(foto[5], '2024-06-01 12:30:00'); assert.equal(foto[6], 'Testkamera X1');
    assert.ok(Math.abs(foto[7] - 18.0686) < 0.0001 && Math.abs(foto[8] - 59.3293) < 0.0001, 'position ' + foto[7] + ', ' + foto[8]);
    assert.ok(Math.abs(foto[9] - 12.5) < 0.01 && foto[10] === 'Stockholm');
    const liten = rows.find((r) => r[0] === 'liten.jpg');
    assert.equal(liten[5], null); assert.equal(liten[6], null);
    assert.equal(rows.find((r) => r[0] === 'ikon.png')[1], 'png');
    const thumbs = await dsFiles.list(meta.id, 'thumb');
    assert.equal(thumbs.length, 3, 'one thumbnail per image');
    const previews = await dsFiles.list(meta.id, 'preview');
    assert.equal(previews.length, 3);
    const bigPreview = await dsFiles.read(meta.id, 'foto.jpg', 'preview');
    const bmp = await createImageBitmap(new Blob([bigPreview.bytes], { type: bigPreview.type }));
    assert.equal(bmp.width, 1600, 'preview scaled to the long side 1600'); assert.equal(bmp.height, 1067);
    bmp.close();
    const thumb = await dsFiles.read(meta.id, 'foto.jpg', 'thumb');
    const tb = await createImageBitmap(new Blob([thumb.bytes], { type: thumb.type }));
    assert.equal(tb.width, 320); tb.close();
    const smallPreview = await dsFiles.read(meta.id, 'liten.jpg', 'preview');
    assert.equal(smallPreview.bytes.length, plain.size, 'a small JPEG is kept as it is');
    const url = await dsFiles.url(meta.id, 'foto.jpg', 'thumb');
    assert.ok(url && url.startsWith('blob:'), 'object url');
    assert.equal(await dsFiles.url(meta.id, 'foto.jpg', 'thumb'), url, 'cached');
    dsFiles.clearUrls(meta.id);
    const full = await datasets.get(meta.id);
    assert.equal(full.images.count, 3);
    return `${rows.length} images`;
  }, 60000);

  test('documents: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id);
    assert.ok(true);
  });
})();
