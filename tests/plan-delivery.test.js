// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a digital översiktsplan delivered as several files (data/plan-delivery, B-73, B-73.1, F105 a): a GeoPackage in
 * Boverket's ÖP model with its link tables, a Word text document with bookmarks across runs and paragraphs, an appendix, a
 * manifest.xml and a metadata.xml, as a folder, a ZIP and loose files; the kind `layers` from a GeoPackage of three layers;
 * the old single-file paths; and files added to a plan later. Every fixture is built here, with the app's own SQLite engine
 * and fflate. Nothing touches the net, and every dataset made is removed again.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const sqlite = D.require('engines/sqlite');
  const dsFiles = D.require('data/dataset-files');
  const plan = D.require('data/plan');
  const delivery = D.require('data/plan-delivery');
  const importer = D.require('io/import');
  const zip = D.require('platform/storage/zip');

  // ---- fixtures --------------------------------------------------------------------------------------------
  // SWEREF 99 TM near Örebro (east ~ 512 000, north ~ 6 571 000).
  const square = (x, y, w, hgt) => [[[x, y], [x + w, y], [x + w, y + hgt], [x, y + hgt], [x, y]]];
  function wkb(type, coordinates) {
    const parts = [];
    const u8 = (v) => parts.push(new Uint8Array([v]));
    const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); parts.push(b); };
    const xy = (c) => { const b = new Uint8Array(16); const dv = new DataView(b.buffer); dv.setFloat64(0, c[0], true); dv.setFloat64(8, c[1], true); parts.push(b); };
    u8(1);
    if (type === 'Point') { u32(1); xy(coordinates); }
    else if (type === 'LineString') { u32(2); u32(coordinates.length); coordinates.forEach(xy); }
    else { u32(3); u32(coordinates.length); for (const ring of coordinates) { u32(ring.length); ring.forEach(xy); } }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  /** A GeoPackage geometry: the GPB header (no envelope) and WKB. */
  function gpb(type, coordinates, srs = 3006) {
    const body = wkb(type, coordinates);
    const out = new Uint8Array(8 + body.length);
    out.set([0x47, 0x50, 0, 0x01]); new DataView(out.buffer).setInt32(4, srs, true); out.set(body, 8);
    return out;
  }
  /**
   * A GeoPackage with the given tables: {name, title?, geometry?: 'POLYGON'|'LINESTRING'|'POINT', columns: [[name, type]], rows: [[...]]},
   * a feature layer when it has a geometry (its column `geom` first), an attribute table otherwise.
   */
  async function geoPackage(tables) {
    const engine = new sqlite.SqliteEngine();
    await engine.start(); await engine.open();
    try {
      await engine.run('pragma application_id = 1196444487');
      await engine.exec("create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text); insert into gpkg_spatial_ref_sys values ('SWEREF99 TM', 3006, 'EPSG', 3006, ''); create table gpkg_contents (table_name text primary key, data_type text, identifier text, srs_id integer); create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer);");
      for (const tb of tables) {
        const cols = (tb.geometry ? [['fid', 'integer primary key'], ['geom', 'blob']] : [['fid', 'integer primary key']]).concat(tb.columns);
        await engine.run(`create table "${tb.name}" (${cols.map(([n, ty]) => `"${n}" ${ty}`).join(', ')})`);
        await engine.run('insert into gpkg_contents values (?, ?, ?, ?)', [tb.name, tb.geometry ? 'features' : 'attributes', tb.title || null, tb.geometry ? 3006 : null]);
        if (tb.geometry) await engine.run("insert into gpkg_geometry_columns values (?, 'geom', ?, 3006, 0, 0)", [tb.name, tb.geometry]);
        const names = (tb.geometry ? ['geom'] : []).concat(tb.columns.map((c) => c[0]));
        if (tb.rows.length) await engine.insertRows(tb.name, names, tb.rows);
      }
      return new Uint8Array(await engine.export());
    } finally { engine.terminate(); }
  }
  // The plan's ids as the GeoPackage writes them: UUIDs in braces, upper case (38 characters).
  const PLAN = '{6F0C2B1E-4D5A-4C3B-9E8F-112233445566}';
  const AREA = (n) => `{AAAAAAAA-0000-4000-8000-00000000000${n}}`;
  const plain = (id) => id.replace(/[{}]/g, '').toLowerCase();
  const STALL = '56d85084-b9d9-43c4-8243-1fbd3b6d3205';
  /** Boverket's ÖP model 0.4 in small: three areas, a line with the Swedish suffix, an empty layer, the plan and its link tables. */
  async function opGeoPackage() {
    const content = [['objektidentitet', 'text'], ['oversiktsplan', 'text'], ['namn', 'text'], ['innehallstyp_varde', 'text'], ['planhandelse_varde', 'text']];
    return geoPackage([
      { name: 'innehall_op_markochvattenanvandning_polygon', title: 'Mark- och vattenanvändning (yta)', geometry: 'MULTIPOLYGON', columns: content, rows: [
        [gpb('Polygon', square(512000, 6571000, 1000, 1000)), AREA(1), PLAN, 'Centrum', 'Bostadsbebyggelse', 'Antagen'],
        [gpb('Polygon', square(513000, 6571000, 800, 900)), AREA(2), PLAN, 'Norra staden', 'Bostadsbebyggelse', 'Antagen'],
        [gpb('Polygon', square(514000, 6571000, 600, 700)), AREA(3), PLAN, 'Ängen', 'Grönområde', 'Antagen']] },
      { name: 'innehall_op_utvecklingsinriktning_linje', title: 'Utvecklingsinriktning (linje)', geometry: 'LINESTRING', columns: content, rows: [
        [gpb('LineString', [[512000, 6570000], [515000, 6572000]]), '{BBBBBBBB-0000-4000-8000-000000000001}', PLAN, 'Stråket', 'Utvecklingsinriktning', 'Antagen']] },
      { name: 'innehall_op_lis_punkt', title: 'LIS (punkt)', geometry: 'POINT', columns: content, rows: [] },
      { name: 'innehall_op_omrade', title: 'Område', geometry: 'POLYGON', columns: content, rows: [
        [gpb('Polygon', square(511000, 6570000, 5000, 3000)), '{CCCCCCCC-0000-4000-8000-000000000001}', PLAN, 'Tätorten', 'Område', 'Antagen']] },
      { name: 'oversiktsplan', columns: [['objektidentitet', 'text'], ['planens_titel', 'text'], ['kommunkod', 'text'], ['kommunnamn', 'text'], ['planhandelse_varde', 'text']], rows: [[PLAN, 'Översiktsplan Testköping 2040', '1880', 'Testköping', 'Antagen']] },
      { name: 'avsnittsbokmärke', columns: [['avsnittsbokmarke_id', 'text'], ['avsnittsbokmarke_text', 'text']], rows: [['op_stall_bostader', 'Ställningstaganden för bostäder'], ['op_saknas', 'Ett avsnitt som inte finns i texten'], ['op_syfte', 'Syfte']] },
      { name: 'dokumentreferens_op', columns: [['namn', 'text'], ['lank', 'text'], ['dokumentreferens_id', 'text']], rows: [['Planbeskrivning Testköping', 'https://kommun.example/op/Planbeskrivning_Testkoping.docx', 'dr-1']] },
      { name: 'dokumentavsnitt', columns: [['avsnittstyp_varde', 'text'], ['avsnittsbokmarke_id', 'text'], ['dokumentreferens_id', 'text'], ['dokument_id', 'text'], ['objektidentitet', 'text']], rows: [
        // One ställningstagande, three areas; the type once by its name in lower case and once by the catalogue's id.
        ['ställningstagande', 'op_stall_bostader', 'dr-1', null, AREA(1)],
        ['Ställningstagande', 'op_stall_bostader', 'dr-1', null, plain(AREA(2))],
        [STALL, 'op_stall_bostader', 'dr-1', null, AREA(3)],
        ['Beskrivning', 'op_beskr_centrum', 'dr-1', null, AREA(1)],
        // A section about the whole plan (the plan's own id), and one whose bookmark the text document lacks.
        ['Översiktsplanens syfte', 'op_syfte', 'dr-1', null, PLAN],
        ['Beskrivning', 'op_saknas', 'dr-1', null, AREA(2)]] },
      { name: 'innehall_op_markochvattenanvandning_lookup', columns: [['innehallstyp_varde', 'text']], rows: [['Bostadsbebyggelse']] },
    ]);
  }
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const run = (text, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  /** The text document: headings by style and by outline level, bookmarks across runs and paragraphs, an empty one, Word's own, deleted text and a field code. */
  const TEXT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>`
    + `<w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr>${run('Syfte')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="0" w:name="op_syfte"/>${run('Planen visar hur kommunen vill ')}${run('utvecklas', true)}${run('.')}<w:bookmarkEnd w:id="0"/></w:p>`
    + `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:bookmarkStart w:id="1" w:name="op_stall_bostader"/>${run('Ställningstaganden för bostäder')}</w:p>`
    + `<w:p>${run('Nya bostäder byggs ')}${run('nära stationen')}<w:del w:id="9" w:author="x"><w:r><w:delText>inte</w:delText></w:r></w:del>${run('.')}</w:p>`
    + `<w:p>${run('Grönområden &amp; parker bevaras.')}<w:bookmarkEnd w:id="1"/></w:p>`
    + `<w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr>${run('Centrum')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="2" w:name="op_beskr_centrum"/><w:bookmarkEnd w:id="2"/>${run('Centrum är en blandad stadsdel.')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="3" w:name="_GoBack"/><w:bookmarkEnd w:id="3"/><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o </w:instrText></w:r></w:p>`
    + '</w:body></w:document>';
  const APPENDIX_XML = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr>${run('Konsekvenser')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="0" w:name="op_kons"/>${run('Planen ger fler bostäder.')}<w:bookmarkEnd w:id="0"/></w:p></w:body></w:document>`;
  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Rubrik1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  async function docx(documentXml) {
    const blob = await zip.createZip({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      'word/document.xml': documentXml, 'word/styles.xml': STYLES_XML,
    });
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function sha256(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join(''); }
  /** A File, with a path inside a folder when one is given (as a dropped folder gives them). */
  function fileOf(bytes, name, folder) {
    const f = new File([bytes], name);
    if (folder) /** @type {any} */ (f).dmPath = folder + '/' + name;
    return f;
  }
  /** The delivery: plan map, text document, appendix, a manifest with one wrong checksum and ISO 19139 metadata. */
  async function deliveryFiles(folder) {
    const gpkg = await opGeoPackage();
    const text = await docx(TEXT_XML);
    const appendix = await docx(APPENDIX_XML);
    const manifest = `<?xml version="1.0" encoding="UTF-8"?><leverans xmlns="urn:example:leverans"><fil namn="op-testkoping.gpkg" roll="plankarta" sha256="${await sha256(gpkg)}"/>`
      + `<fil namn="Planbeskrivning_Testkoping.docx" roll="textdokument" sha256="${'0'.repeat(64)}"/></leverans>`;
    const metadata = `<?xml version="1.0" encoding="UTF-8"?><gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco"><gmd:fileIdentifier><gco:CharacterString>${PLAN}</gco:CharacterString></gmd:fileIdentifier>`
      + '<gmd:identificationInfo><gmd:MD_DataIdentification><gmd:citation><gmd:CI_Citation><gmd:title><gco:CharacterString>Översiktsplan Testköping 2040</gco:CharacterString></gmd:title></gmd:CI_Citation></gmd:citation></gmd:MD_DataIdentification></gmd:identificationInfo></gmd:MD_Metadata>';
    const enc = new TextEncoder();
    return { gpkg, text, files: [fileOf(gpkg, 'op-testkoping.gpkg', folder), fileOf(text, 'Planbeskrivning_Testkoping.docx', folder), fileOf(appendix, 'Bilaga_1_Konsekvenser.docx', folder), fileOf(enc.encode(manifest), 'manifest.xml', folder), fileOf(enc.encode(metadata), 'metadata.xml', folder), fileOf(new Uint8Array([1, 2, 3]), 'Thumbs.db', folder)] };
  }
  const made = [];
  const keep = (meta) => { made.push(meta.id); return meta; };
  async function rowsOf(id, sql) { const r = await (await datasets.ensureOpen(id)).engine.exec(sql); return r[0] ? r[0].values : []; }

  // ---- tests -----------------------------------------------------------------------------------------------
  test('plan delivery: the bookmarks of a Word file are read across runs and paragraphs with their nearest heading, by both parsers', async (assert) => {
    const styles = delivery.headingStylesOf(STYLES_XML);
    assert.ok(styles.has('Rubrik1') && !styles.has('Normal'), 'a heading style by its name');
    const parsers = [delivery.bookmarksOf(TEXT_XML, styles, { fallback: true })];
    if (typeof DOMParser === 'function') parsers.push(delivery.bookmarksOf(TEXT_XML, styles));
    for (const marks of parsers) {
      const by = (name) => marks.find((m) => m.name === name);
      assert.deepEqual(marks.map((m) => m.name), ['op_syfte', 'op_stall_bostader', 'op_beskr_centrum', '_GoBack']);
      assert.deepEqual([by('op_syfte').text, by('op_syfte').rubrik], ['Planen visar hur kommunen vill utvecklas.', 'Syfte'], 'across runs, under a Rubrik style');
      assert.equal(by('op_stall_bostader').text, 'Ställningstaganden för bostäder\nNya bostäder byggs nära stationen.\nGrönområden & parker bevaras.', 'across paragraphs, without the deleted word');
      assert.equal(by('op_stall_bostader').rubrik, 'Ställningstaganden för bostäder', 'a bookmark on a heading has that heading');
      assert.deepEqual([by('op_beskr_centrum').text, by('op_beskr_centrum').rubrik], ['Centrum är en blandad stadsdel.', 'Centrum'], 'an empty range takes its paragraph; a heading by outline level');
      assert.ok(by('_GoBack').hidden && !by('op_syfte').hidden, 'Word\'s own bookmarks are hidden');
    }
    await assert.throws(async () => delivery.bookmarksOf('<!DOCTYPE x [<!ENTITY a "aaaa">]><w:document/>'), new RegExp(t('plan.delivery.err.doctype').slice(0, 20)));
    assert.deepEqual(delivery.readXmlInfo('<manifest xmlns="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><file-entry full-path="content/plan.gpkg" media-type="application/geopackage+sqlite3"/></manifest>', 'manifest').filer.map((f) => f.namn), ['content/plan.gpkg'], 'an ODF manifest\'s files');
    return 'ok';
  });

  test('plan delivery: a folder with plan map, text document, appendix, manifest and metadata becomes one plan with sections and links', async (assert) => {
    const fx = await deliveryFiles('ÖP Testköping');
    const meta = keep(await delivery.importDelivery(fx.files, {}));
    assert.equal(meta.kind, 'plan'); assert.equal(meta.plan.slag, 'oversiktsplan');
    assert.equal(meta.name, 'Översiktsplan Testköping 2040', 'named after the plan in the GeoPackage');
    assert.equal(meta.rowCount, 5, 'three areas, a line and an area; the empty layer and the link tables are no content');
    assert.equal(meta.plan.objektid, plain(PLAN), 'the plan\'s id without braces, in lower case');
    const cols = (await datasets.columns(meta.id)).map((c) => c.name);
    assert.deepEqual(cols, plan.OP_COLUMNS.map((c) => c.name));
    assert.ok(cols.includes('lager') && cols.includes('fil'));
    const rows = await rowsOf(meta.id, 'select objektid, lager, fil, tema from data order by ordning');
    assert.deepEqual(rows.map((r) => r[0]).slice(0, 3), [1, 2, 3].map((n) => plain(AREA(n))), 'the content ids normalised');
    assert.deepEqual(Array.from(new Set(rows.map((r) => r[1]))), ['innehall_op_markochvattenanvandning_polygon', 'innehall_op_omrade', 'innehall_op_utvecklingsinriktning_linje'], 'the layer of each row, the Swedish suffix too');
    assert.ok(rows.every((r) => r[2] === 'op-testkoping.gpkg'), 'the file of each row');
    assert.deepEqual([rows[3][3], rows[4][3]], ['omrade', 'utvecklingsinriktning']);
    // The files with their roles, Thumbs.db left out.
    const files = (await dsFiles.list(meta.id)).map((f) => [f.name, f.kind]);
    assert.deepEqual(files, [['Bilaga_1_Konsekvenser.docx', 'bilaga'], ['Planbeskrivning_Testkoping.docx', 'textdokument'], ['manifest.xml', 'manifest'], ['metadata.xml', 'metadata'], ['op-testkoping.gpkg', 'plankarta']]);
    const stored = await dsFiles.read(meta.id, 'op-testkoping.gpkg', 'plankarta');
    assert.equal(stored.bytes.byteLength, fx.gpkg.byteLength, 'the original bytes');
    const lev = meta.plan.leverans;
    assert.equal(lev.filer.find((f) => f.namn === 'op-testkoping.gpkg').sha256, await sha256(fx.gpkg));
    assert.deepEqual([lev.manifest.fil, lev.manifest.filer.length, lev.metadata.format, lev.metadata.titel, lev.metadata.id], ['manifest.xml', 2, 'iso19139', 'Översiktsplan Testköping 2040', plain(PLAN)]);
    // The layers with objects, by the names gpkg_contents gives them; the empty LIS layer is left out.
    assert.deepEqual(meta.plan.lager.map((l) => [l.namn, l.titel, l.geometrityp, l.antal]), [['innehall_op_markochvattenanvandning_polygon', 'Mark- och vattenanvändning (yta)', 'MultiPolygon', 3], ['innehall_op_omrade', 'Område', 'Polygon', 1], ['innehall_op_utvecklingsinriktning_linje', 'Utvecklingsinriktning (linje)', 'LineString', 1]]);
    // One ställningstagande linked to three areas, both ways.
    const sections = await delivery.sectionsOf(meta.id);
    const stall = sections.find((s) => s.avsnitt === 'op_stall_bostader');
    assert.deepEqual([stall.typ, stall.dokument, stall.rubrik], ['Ställningstagande', 'Planbeskrivning_Testkoping.docx', 'Ställningstaganden för bostäder']);
    assert.ok(/^Ställningstaganden för bostäder\nNya bostäder byggs nära stationen\./.test(stall.text), stall.text);
    assert.deepEqual(await delivery.objectsForSection(meta.id, 'op_stall_bostader'), [1, 2, 3].map((n) => plain(AREA(n))));
    assert.deepEqual((await delivery.sectionsForObject(meta.id, AREA(1))).map((s) => [s.avsnitt, s.typ]), [['op_stall_bostader', 'Ställningstagande'], ['op_beskr_centrum', 'Beskrivning']], 'an object\'s sections, by an id in either form');
    // A section about the whole plan.
    const syfte = sections.find((s) => s.avsnitt === 'op_syfte');
    assert.ok(syfte.helaPlanen && !syfte.objekt.length, 'linked to the whole plan, not to an object');
    assert.deepEqual((await delivery.sectionsForObject(meta.id, '')).map((s) => s.avsnitt), ['op_syfte']);
    assert.deepEqual(await delivery.objectsForSection(meta.id, 'op_syfte'), [''], "'' is the whole plan, as _section_links keeps it");
    assert.equal(syfte.typ, 'Översiktsplanens syfte');
    // The appendix's bookmark is a section too; Word's own is not.
    assert.ok(sections.some((s) => s.avsnitt === 'op_kons' && s.dokument === 'Bilaga_1_Konsekvenser.docx' && s.rubrik === 'Konsekvenser'));
    assert.ok(!sections.some((s) => s.avsnitt === '_GoBack'));
    // A bookmark the text document lacks: a section with the GeoPackage's heading, and a warning.
    const missing = sections.find((s) => s.avsnitt === 'op_saknas');
    assert.deepEqual([missing.text, missing.rubrik, missing.dokument], ['', 'Ett avsnitt som inte finns i texten', 'Planbeskrivning_Testkoping.docx']);
    assert.ok(lev.varningar.includes(t('plan.delivery.warn.bookmark.missing', { name: 'op_saknas', file: 'Planbeskrivning_Testkoping.docx' })), lev.varningar.join(' | '));
    // The manifest's wrong checksum, and nothing said about the right one.
    assert.ok(lev.varningar.includes(t('plan.delivery.warn.checksum', { list: 'manifest.xml', file: 'Planbeskrivning_Testkoping.docx' })), lev.varningar.join(' | '));
    assert.ok(!lev.varningar.includes(t('plan.delivery.warn.checksum', { list: 'manifest.xml', file: 'op-testkoping.gpkg' })));
    const linkRows = await rowsOf(meta.id, 'select count(*) from _section_links');
    assert.equal(linkRows[0][0], 6, 'a link per bookmark and object');
    // Before the plan is shared, the review lists every file of the delivery as an original, whatever its role.
    if (D.has('data/share-scan')) {
      const originals = (await D.require('data/share-scan').inspect(meta.id)).parts.find((p) => p.id === 'originals');
      assert.ok(originals && originals.count === 5, 'the files of the delivery are originals in the review: ' + JSON.stringify(originals));
    }
    return 'ok';
  }, 60000);

  test('plan delivery: the same delivery as a ZIP and as loose files, sorted by their contents', async (assert) => {
    const fx = await deliveryFiles('');
    // A ZIP with the delivery in a folder of its own, through io/import as any file.
    const entries = {};
    for (const f of fx.files) entries['leverans/' + f.name] = new Uint8Array(await f.arrayBuffer());
    const zipped = new File([await (await zip.createZip(entries)).arrayBuffer()], 'op-testkoping.zip', { type: 'application/zip' });
    const p = await importer.preview(zipped, {});
    assert.equal(p.importer, 'opdelivery'); assert.equal(p.kind, 'plan');
    assert.equal(p.totalRows, 5);
    assert.ok(p.plan.leverans.filer.some((f) => f.namn === 'Planbeskrivning_Testkoping.docx' && f.roll === 'textdokument'));
    const fromZip = keep(await importer.run(zipped, {}, null, null));
    assert.deepEqual([fromZip.kind, fromZip.rowCount], ['plan', 5]);
    assert.equal((await delivery.objectsForSection(fromZip.id, 'op_stall_bostader')).length, 3);
    // Loose files, renamed so that only their contents tell them apart.
    const loose = [fileOf(fx.gpkg, 'karta.dat'), fileOf(fx.text, 'text.bin'), fx.files[3]];
    const sorted = await importer.sortFiles(loose);
    assert.ok(sorted.delivery && sorted.delivery.op, 'offered as one plan, on by default for the ÖP model');
    assert.equal(sorted.delivery.files.length, 3);
    const read = await delivery.readDelivery(loose);
    assert.deepEqual(read.items.map((c) => [c.stored, c.role]), [['karta.dat', 'plankarta'], ['text.bin', 'textdokument'], ['manifest.xml', 'manifest']]);
    const results = await importer.runSorted([sorted.delivery]);
    assert.ok(results[0].meta, results[0].error);
    keep(results[0].meta);
    assert.equal(results[0].meta.rowCount, 5);
    // Each file on its own stays possible: the groups are the same as before.
    assert.ok(sorted.groups.some((g) => g.importer === 'documents') || sorted.groups.length >= 2, JSON.stringify(sorted.groups.map((g) => g.importer)));
    // Pictures and tables alone are no delivery.
    assert.equal((await importer.sortFiles([new File(['x\n1\n'], 'a.csv'), new File(['y\n2\n'], 'b.csv')])).delivery, null);
    return 'ok';
  }, 60000);

  test('plan delivery: a GeoPackage of three layers becomes one dataset of the kind layers, the empty layer left out', async (assert) => {
    const attrs = [['namn', 'text'], ['hojd', 'real']];
    const bytes = await geoPackage([
      { name: 'byggnader', title: 'Byggnader', geometry: 'POLYGON', columns: attrs, rows: [[gpb('Polygon', square(512000, 6571000, 20, 30)), 'Hus 1', 12.5], [gpb('Polygon', square(512100, 6571000, 20, 30)), 'Hus 2', 9]] },
      { name: 'vagar', geometry: 'LINESTRING', columns: attrs, rows: [[gpb('LineString', [[512000, 6570900], [512300, 6570900]]), 'Storgatan', null]] },
      { name: 'trad', title: 'Träd', geometry: 'POINT', columns: attrs, rows: [[gpb('Point', [512050, 6571050]), 'Ek', 18], [gpb('Point', [512060, 6571060]), 'Lind', 15], [gpb('Point', [512070, 6571070]), 'Björk', 11]] },
      { name: 'tomt_lager', geometry: 'POINT', columns: attrs, rows: [] },
      { name: 'vardelista', columns: [['kod', 'text']], rows: [['A']] },
    ]);
    const file = new File([bytes], 'stadsdel.gpkg', { type: 'application/geopackage+sqlite3' });
    const p = await importer.preview(file, {});
    assert.equal(p.layerCount, 4, 'four feature layers; the value list is no layer');
    assert.ok(!p.planGpkg);
    const meta = keep(await importer.run(file, { layers: true }, null, 'Stadsdelen'));
    assert.deepEqual([meta.kind, meta.rowCount, meta.name], ['layers', 6, 'Stadsdelen']);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), delivery.LAYER_COLUMNS.map((c) => c.name));
    assert.deepEqual(meta.layers.lager.map((l) => [l.namn, l.titel, l.geometrityp, l.antal, l.crs]), [['byggnader', 'Byggnader', 'Polygon', 2, 'EPSG:3006'], ['trad', 'Träd', 'Point', 3, 'EPSG:3006'], ['vagar', 'vagar', 'LineString', 1, 'EPSG:3006']]);
    assert.deepEqual([meta.layers.filer, meta.layers.tomma], [['stadsdel.gpkg'], ['tomt_lager']]);
    const rows = await rowsOf(meta.id, 'select lager, fil, objektid, geometrityp, geometri, egenskaper from data order by ordning');
    assert.deepEqual(rows[0].slice(0, 4), ['byggnader', 'stadsdel.gpkg', '1', 'Polygon'], 'the feature id as the id');
    assert.deepEqual(JSON.parse(rows[0][5]), { namn: 'Hus 1', hojd: 12.5 }, 'every attribute as JSON');
    const g = JSON.parse(rows[0][4]);
    assert.ok(g.type === 'Polygon' && g.coordinates[0][0][0] > 15 && g.coordinates[0][0][0] < 16 && g.coordinates[0][0][1] > 59, 'in WGS 84');
    assert.ok((await dsFiles.list(meta.id)).some((f) => f.name === 'stadsdel.gpkg' && f.kind === 'original'), 'the original kept');
    const kinds = D.require('data/kinds');
    assert.equal(kinds.of(meta).view, 'layers');
    assert.ok(!kinds.summary(meta).includes('{'), kinds.summary(meta));
    // An ÖP GeoPackage keeps its own choice, a plan, and can also be read as layers.
    const op = new File([await opGeoPackage()], 'op.gpkg');
    const opPreview = await importer.preview(op, {});
    assert.equal(opPreview.planGpkg, 'oversiktsplan');
    const asLayers = keep(await importer.run(op, { layers: true }, null, null));
    assert.deepEqual([asLayers.kind, asLayers.rowCount], ['layers', 5]);
    assert.ok(asLayers.layers.tomma.includes('innehall_op_lis_punkt'));
    return 'ok';
  }, 60000);

  test('plan delivery: the old single-file paths are unchanged: a Word file, one layer as a table and an ÖP GeoPackage as a plan', async (assert) => {
    const word = keep(await importer.run(new File([await docx(TEXT_XML)], 'planbeskrivning.docx'), {}, null, null));
    assert.equal(word.kind, 'document', 'a Word file alone is a document');
    const gpkg = new File([await opGeoPackage()], 'op-testkoping.gpkg', { type: 'application/geopackage+sqlite3' });
    const table = keep(await importer.run(gpkg, { table: 'innehall_op_markochvattenanvandning_polygon' }, null, 'ÖP som tabell'));
    assert.deepEqual([table.kind, table.rowCount], ['table', 3], 'one layer as a table');
    const whole = keep(await importer.run(gpkg, { plan: true }, null, null));
    assert.deepEqual([whole.kind, whole.rowCount, whole.plan.kommunkod, whole.plan.namn], ['plan', 5, '1880', 'Översiktsplan Testköping 2040']);
    assert.deepEqual((await datasets.columns(whole.id)).map((c) => c.name), plan.OP_COLUMNS.map((c) => c.name));
    assert.deepEqual((await dsFiles.list(whole.id)).map((f) => [f.name, f.kind]), [['op-testkoping.gpkg', 'plankarta']]);
    // Without the text document the sections have the GeoPackage's headings, and the missing document is said once.
    const sections = await delivery.sectionsOf(whole.id);
    assert.ok(sections.find((s) => s.avsnitt === 'op_stall_bostader' && s.rubrik === 'Ställningstaganden för bostäder' && s.text === ''));
    assert.equal((await delivery.objectsForSection(whole.id, 'op_stall_bostader')).length, 3);
    // The missing document is the only problem; the other lines say how many links were read and what has none.
    const lev = whole.plan.leverans;
    assert.deepEqual(lev.varningar, [t('plan.links.warn.read', { n: 6, sources: t('plan.links.source.modell', { n: 6, name: 'dokumentavsnitt' }) }), t('plan.links.warn.without', { areas: 2, of: 5, statements: 0, all: 1 }), t('plan.delivery.warn.doc.missing', { file: 'Planbeskrivning_Testkoping.docx' })], lev.varningar.join(' | '));
    assert.deepEqual([lev.kopplingar.antal, lev.kopplingar.omradenUtan, lev.kopplingar.stallningstagandenUtan], [6, 2, 0]);
    return 'ok';
  }, 60000);

  test('plan delivery: a text document and a PDF added to a plan later are linked and kept', async (assert) => {
    const gpkg = new File([await opGeoPackage()], 'op-testkoping.gpkg');
    const meta = keep(await importer.run(gpkg, { plan: true }, null, null));
    const pdf = new File([new TextEncoder().encode('%PDF-1.4\n%%EOF\n')], 'Samradsredogorelse.pdf');
    const res = await delivery.addFiles(meta.id, [new File([await docx(TEXT_XML)], 'Planbeskrivning_Testkoping.docx'), pdf]);
    assert.deepEqual(res.added, [{ namn: 'Planbeskrivning_Testkoping.docx', roll: 'textdokument' }, { namn: 'Samradsredogorelse.pdf', roll: 'bilaga' }]);
    const sections = await delivery.sectionsOf(meta.id);
    const stall = sections.find((s) => s.avsnitt === 'op_stall_bostader');
    assert.ok(stall && /Nya bostäder byggs nära stationen/.test(stall.text) && stall.dokument === 'Planbeskrivning_Testkoping.docx', JSON.stringify(stall));
    assert.equal(stall.objekt.length, 3);
    const after = await datasets.get(meta.id);
    assert.deepEqual(after.plan.leverans.filer.map((f) => [f.namn, f.roll]).sort(), [['Planbeskrivning_Testkoping.docx', 'textdokument'], ['Samradsredogorelse.pdf', 'bilaga'], ['op-testkoping.gpkg', 'plankarta']]);
    assert.ok(after.plan.leverans.varningar.includes(t('plan.delivery.warn.bookmark.missing', { name: 'op_saknas', file: 'Planbeskrivning_Testkoping.docx' })));
    assert.ok(!after.plan.leverans.varningar.some((w) => w === t('plan.delivery.warn.doc.missing', { file: 'Planbeskrivning_Testkoping.docx' })), 'the document is there now');
    assert.equal(after.rowCount, 5, 'the rows are as they were');
    // The text document again, corrected: it replaces the one of the same name.
    await delivery.addFiles(meta.id, [new File([await docx(TEXT_XML.replace('nära stationen', 'vid stationen'))], 'Planbeskrivning_Testkoping.docx')]);
    assert.deepEqual((await dsFiles.list(meta.id)).map((f) => [f.name, f.kind]), [['Planbeskrivning_Testkoping.docx', 'textdokument'], ['Samradsredogorelse.pdf', 'bilaga'], ['op-testkoping.gpkg', 'plankarta']]);
    const again = (await delivery.sectionsOf(meta.id)).find((s) => s.avsnitt === 'op_stall_bostader');
    assert.ok(/byggs vid stationen/.test(again.text), again.text);
    assert.equal((await datasets.get(meta.id)).plan.leverans.filer.length, 3);
    const other = keep(await datasets.create({ name: 'Inte en plan', columns: [{ name: 'x', type: 'integer' }], rows: [[1]] }));
    await assert.throws(async () => delivery.addFiles(other.id, [pdf]), new RegExp(t('plan.delivery.err.notplan').slice(0, 20)));
    return 'ok';
  }, 60000);

  test('plan delivery: Inhämta offers a dropped delivery as one plan, on by default for the ÖP model, and each file on its own when off', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const fx = await deliveryFiles('ÖP Testköping');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn, ms, label) => { const t0 = performance.now(); for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(30); } };
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const dz = await waitFor(() => root.querySelector('dm-dropzone'), 3000, 'the drop zone');
      dz.dispatchEvent(new CustomEvent('dm-files', { detail: { files: fx.files }, bubbles: true }));
      const sw = /** @type {any} */ (await waitFor(() => root.querySelector('[data-import-delivery]'), 10000, 'the delivery switch'));
      assert.ok(sw.checked, 'on by default: the GeoPackage follows the ÖP model');
      assert.equal(root.querySelectorAll('.dm-sort-row').length, 1, 'one row: the plan');
      sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-sort-row').length > 1, 3000, 'each file on its own');
      const again = /** @type {any} */ (root.querySelector('[data-import-delivery]'));
      again.checked = true; again.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-sort-row').length === 1, 3000, 'one plan again');
      const run = Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('import.sort.run'));
      /** @type {HTMLElement} */ (run.querySelector('button')).click();
      await waitFor(() => root.querySelector('.dm-success'), 30000, 'the result');
      const ds = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'plan' && d.name === 'Översiktsplan Testköping 2040' && !made.includes(d.id)), 5000, 'the plan');
      keep(ds);
      assert.equal(ds.rowCount, 5);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 60000);

  test('plan delivery: cleanup', async (assert) => {
    if (datasets.flushSaves) await datasets.flushSaves();
    for (const id of made) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
