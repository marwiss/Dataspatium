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
   * a feature layer when it has a geometry (its column `geom` first), an attribute table otherwise (with no fid of its own when `plain`).
   */
  async function geoPackage(tables) {
    const engine = new sqlite.SqliteEngine();
    await engine.start(); await engine.open();
    try {
      await engine.run('pragma application_id = 1196444487');
      await engine.exec("create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text); insert into gpkg_spatial_ref_sys values ('SWEREF99 TM', 3006, 'EPSG', 3006, ''); create table gpkg_contents (table_name text primary key, data_type text, identifier text, srs_id integer); create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer);");
      for (const tb of tables) {
        const cols = (tb.geometry ? [['fid', 'integer primary key'], ['geom', 'blob']] : tb.plain ? [] : [['fid', 'integer primary key']]).concat(tb.columns);
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

  // ---- links in the shapes other tools and AI-made files take (data/plan-links) --------------------------------------
  /**
   * A test plan in the shape an AI wrote for Karlskrona (no ÖP model): ten feature layers whose areas carry objekt_id, plan_id,
   * stallning_id, stallning_uuid, namn, kategori, status, textfil, bokmarke and kalla; a table stallningstagande with each
   * statement's text; planmetadata as keys and values; kartobjekt mapping each area to its layer and feature; and objektreferens
   * with 23 links many to many from areas to the Word file's bookmarks ST_01–ST_10. The names and ids are the fictitious ones of
   * that test plan; the geometries are made up here.
   */
  const KK_DOC = 'Karlskrona_stallningstaganden.docx';
  const KK_PLAN = '8564f678-51c8-4c01-b726-e4e405a1cda6';
  /** The statements: bookmark, uuid, the layer whose areas carry it, its heading after the id, its text. */
  const KK_ST = [
    ['ST_01', '7fc8a3b9-842f-46b9-83cd-d8545653b1c8', 'utvecklingsinriktning', 'Utvecklingsinriktning', 'Koncentrera utveckling till befintliga serviceorter och kollektivtrafiknära lägen.'],
    ['ST_02', '89c18937-d657-4d7d-9f9e-fbadcdec497b', 'mangfunktionell_bebyggelse', 'Mångfunktionell bebyggelse', 'Prioritera blandade stadsmiljöer, gång och cykel samt tillgång till service.'],
    ['ST_03', 'b05fd8d7-a5eb-462d-8ea5-d9903575e6fa', 'sammanhangande_bostadsbebyggelse', 'Sammanhängande bostadsbebyggelse', 'Komplettera bostäder nära befintlig infrastruktur.'],
    ['ST_04', '295ea17e-4509-4a2b-9f90-5bf0a1546456', 'verksamheter', 'Verksamheter', 'Pröva verksamhetsmark nära befintliga transportstråk.'],
    ['ST_05', '329a86c1-2941-486b-b206-ea799a369c86', 'landsbygd', 'Landsbygd', 'Stärk lokal service och bevara brukningsvärd jordbruksmark.'],
    ['ST_06', '76f74dfc-dd41-4c20-8992-171b96985e96', 'natur_friluftsliv', 'Natur och friluftsliv', 'Bevara gröna samband och tillgänglighet till natur.'],
    ['ST_07', '0b092442-3909-45af-8a3b-01b99ba7930e', 'vatten', 'Vatten', 'Prioritera god vattenmiljö.'],
    ['ST_08', 'ca3725d3-9a61-40c3-9a5b-5e0a5ac179d5', 'transport', 'Transportinfrastruktur', 'Utred säkra gång- och cykelförbindelser.'],
    ['ST_09', '017e1065-023e-49d9-bdf1-5a4c90db0a16', 'riksintresse', 'Riksintressen och hänsyn', 'Pröva påverkan på kulturmiljön.'],
    ['ST_10', 'e9d024e2-4c76-4d05-ab6f-92803a107693', 'risk_klimat', 'Klimatrisk och miljökvalitet', 'Utred översvämning, erosion och skyfall.'],
  ];
  /** The areas: layer, objekt_id, namn. */
  const KK_AREAS = [
    ['utvecklingsinriktning', '296cfcda-5eb9-410b-846a-bfc588332294', 'Karlskrona centrum'], ['utvecklingsinriktning', 'c33b2457-e009-4da9-bc6f-d718ff2bd433', 'Rödeby'],
    ['mangfunktionell_bebyggelse', 'f11c3dbd-281a-41e1-bc08-db0e786cc033', 'Trossö'], ['mangfunktionell_bebyggelse', '680d89a5-aaf3-47e4-8c10-c3bdadb36df5', 'Lyckeby'],
    ['sammanhangande_bostadsbebyggelse', 'a814a366-1ded-499f-832a-20b6ba6395d4', 'Nättraby'], ['sammanhangande_bostadsbebyggelse', 'e17cbb74-8411-4885-b0d5-037022e1c6a3', 'Jämjö'],
    ['verksamheter', '41e4eb0d-e8e7-4001-9e3c-cfbc7f484d7c', 'Karlskrona norra'],
    ['landsbygd', '33b16b3e-ca75-43c1-ba82-3490568dd186', 'Holmsjö'], ['landsbygd', '6898e640-2a7e-4920-b2ee-90f99ff925fc', 'Fridlevstad'],
    ['natur_friluftsliv', '3df8815e-0ad8-4590-8f6b-cc0e9148fd40', 'Skärva'], ['natur_friluftsliv', '9e91983e-cee4-4cbf-8f19-64acc57464fa', 'Torhamn'],
    ['vatten', '35e634c2-a3bd-4bff-8520-dbcda485ecfb', 'Östra fjärden'], ['vatten', 'c49acc83-7ca9-45a3-916a-0fc99b950549', 'Yttre skärgården'],
    ['transport', '1b82d6d4-3944-47e5-82b2-a38a4d794fbb', 'Lyckeby–Jämjö'],
    ['riksintresse', 'c6bc73bd-039d-4cd3-a494-fc5c8e1bd585', 'Trossö kulturmiljö'],
    ['risk_klimat', 'cdbaf789-fae1-41ad-bdbd-a7bcc091c046', 'Kustnära Karlskrona'], ['risk_klimat', '3889b413-85cd-4f74-9881-2d2b8f40c7b2', 'Nättrabyån'],
  ];
  /** objektreferens: an area (by name) and a bookmark, many to many, in the file's order. */
  const KK_REFS = [['Karlskrona centrum', 'ST_01'], ['Karlskrona centrum', 'ST_02'], ['Rödeby', 'ST_01'], ['Trossö', 'ST_02'], ['Trossö', 'ST_09'], ['Trossö', 'ST_10'],
    ['Lyckeby', 'ST_02'], ['Lyckeby', 'ST_08'], ['Nättraby', 'ST_03'], ['Nättraby', 'ST_10'], ['Jämjö', 'ST_03'], ['Jämjö', 'ST_08'], ['Karlskrona norra', 'ST_04'],
    ['Holmsjö', 'ST_05'], ['Fridlevstad', 'ST_05'], ['Skärva', 'ST_06'], ['Torhamn', 'ST_06'], ['Östra fjärden', 'ST_07'], ['Yttre skärgården', 'ST_07'],
    ['Lyckeby–Jämjö', 'ST_08'], ['Trossö kulturmiljö', 'ST_09'], ['Kustnära Karlskrona', 'ST_10'], ['Nättrabyån', 'ST_10']];
  const kkId = (namn) => KK_AREAS.find((a) => a[2] === namn)[1];
  function karlskronaGeoPackage() {
    const cols = ['objekt_id', 'plan_id', 'stallning_id', 'stallning_uuid', 'namn', 'kategori', 'status', 'textfil', 'bokmarke', 'kalla'].map((c) => [c, 'text']);
    const layers = KK_ST.map(([st, uuid, layer, kategori]) => ({ name: layer, title: layer, geometry: 'POLYGON', columns: cols, rows: KK_AREAS.filter((a) => a[0] === layer).map(([, id, namn]) => {
      const k = KK_AREAS.findIndex((a) => a[1] === id);
      return [gpb('Polygon', square(532000 + k * 1200, 6215000 + (k % 5) * 3000, 900, 900)), id, KK_PLAN, st, uuid, namn, kategori, 'FIKTIVT', KK_DOC, st, 'Syntetisk demogeometri; ej myndighetsdata'];
    }) }));
    const fidOf = (id) => { const a = KK_AREAS.find((x) => x[1] === id); return KK_AREAS.filter((x) => x[0] === a[0]).indexOf(a) + 1; };
    return geoPackage(layers.concat([
      { name: 'stallningstagande', plain: true, columns: [['stallning_id', 'text'], ['uuid', 'text'], ['text', 'text'], ['bokmarke', 'text'], ['textfil', 'text']], rows: KK_ST.map(([st, uuid, , , text]) => [st, uuid, text, st, KK_DOC]) },
      { name: 'planmetadata', plain: true, columns: [['nyckel', 'text'], ['varde', 'text']], rows: [['plan_id', KK_PLAN], ['kommunkod', '1080'], ['kommun', 'Karlskrona'], ['status', 'Fiktiv demonstration; ej antagen'], ['referenssystem', 'EPSG:3006'], ['modell', 'Lokal demonstrationsmodell; ej validerad mot Test 5'], ['datum', '2026-11-24']] },
      { name: 'kartobjekt', plain: true, columns: [['objekt_id', 'text'], ['lager', 'text'], ['objekt_fid', 'integer'], ['namn', 'text']], rows: KK_AREAS.map(([layer, id, namn]) => [id, layer, fidOf(id), namn]) },
      { name: 'objektreferens', plain: true, columns: [['id', 'integer primary key'], ['objekt_id', 'text'], ['identitet_i_dokument', 'text'], ['dokument', 'text']], rows: KK_REFS.map(([namn, st], i) => [i + 1, kkId(namn), st, KK_DOC]) },
    ]));
  }
  /** The Word file: a title, two paragraphs, and per statement a bookmark over its heading, its text and the line Kopplade områden. */
  const KK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>`
    + `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${run('Karlskrona 2050')}</w:p><w:p>${run('Digital översiktsplan • demonstrationsversion 2. Fiktiva ställningstaganden och syntetiska områden.')}</w:p>`
    + `<w:p>${run('Bokmärken omfattar respektive ställningstagande. Kopplade områden redovisas nedan.')}</w:p>`
    + KK_ST.map(([st, , , heading, text], i) => `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:bookmarkStart w:id="${i}" w:name="${st}"/>${run(`${st} – ${heading}`)}</w:p>`
      + `<w:p>${run(text)}</w:p><w:p>${run('Kopplade områden: ' + KK_REFS.filter((r) => r[1] === st).map((r) => r[0]).join(', '))}<w:bookmarkEnd w:id="${i}"/></w:p>`).join('')
    + '</w:body></w:document>';

  test('plan delivery: a GeoPackage outside the ÖP model that links its areas to the Word file in tables of its own (an AI-made test plan) becomes a plan: Karlskrona centrum has ST_01 and ST_02, and ST_02 covers Karlskrona centrum, Trossö and Lyckeby', async (assert) => {
    const gpkg = await karlskronaGeoPackage();
    const files = [fileOf(gpkg, 'Karlskrona_demo.gpkg', 'Karlskrona'), fileOf(await docx(KK_XML), KK_DOC, 'Karlskrona')];
    const offered = await delivery.candidate(files);
    assert.ok(offered && offered.op, 'offered as one plan, on by default');
    const meta = keep(await delivery.importDelivery(files, {}));
    assert.deepEqual([meta.kind, meta.plan.slag, meta.rowCount], ['plan', 'oversiktsplan', 17]);
    assert.deepEqual([meta.plan.objektid, meta.plan.kommunkod, meta.plan.kommun], [KK_PLAN, '1080', 'Karlskrona'], 'the plan\'s facts from planmetadata');
    const rows = await rowsOf(meta.id, 'select objektid, namn from data');
    assert.ok(rows.length === 17 && rows.every(([id, namn]) => id === kkId(namn)), 'each area\'s objektid is its objekt_id');
    assert.deepEqual((await dsFiles.list(meta.id)).map((f) => [f.name, f.kind]).sort(), [[KK_DOC, 'textdokument'], ['Karlskrona_demo.gpkg', 'plankarta']].sort());
    const sections = await delivery.sectionsOf(meta.id);
    assert.deepEqual(sections.map((s) => s.avsnitt), KK_ST.map((s) => s[0]), 'a section per bookmark');
    assert.ok(sections.every((s) => s.typ === 'Ställningstagande' && s.dokument === KK_DOC), 'ställningstaganden, as the table stallningstagande says');
    assert.ok(sections[1].rubrik === 'ST_02 – Mångfunktionell bebyggelse' && /Prioritera blandade stadsmiljöer/.test(sections[1].text), JSON.stringify(sections[1]));
    assert.deepEqual((await delivery.sectionsForObject(meta.id, kkId('Karlskrona centrum'))).map((s) => [s.avsnitt, s.kalla]), [['ST_01', 'tabell'], ['ST_02', 'tabell']], 'Karlskrona centrum: ST_01 and ST_02, from objektreferens');
    assert.deepEqual((await delivery.objectsForSection(meta.id, 'ST_02')).sort(), ['Karlskrona centrum', 'Trossö', 'Lyckeby'].map(kkId).sort(), 'ST_02: three areas');
    const k = meta.plan.leverans.kopplingar;
    assert.deepEqual([k.antal, k.omradenUtan, k.stallningstagandenUtan], [23, 0, 0], JSON.stringify(k));
    assert.deepEqual(k.kallor.filter((x) => x.antal).map((x) => [x.kalla, x.fran, x.antal]), [['tabell', 'objektreferens', 23]], 'all from the table of links; the areas\' own columns add nothing to it');
    assert.ok(meta.plan.leverans.varningar.includes(t('plan.links.warn.read', { n: 23, sources: t('plan.links.source.tabell', { n: 23, name: 'objektreferens' }) })), meta.plan.leverans.varningar.join(' | '));
    // Without the Word file the table stallningstagande's text stands in, and the missing file is named.
    const alone = keep(await delivery.importDelivery([fileOf(gpkg, 'Karlskrona_demo.gpkg')], {}));
    assert.equal(alone.kind, 'plan');
    const st02 = (await delivery.sectionsOf(alone.id)).find((s) => s.avsnitt === 'ST_02');
    assert.ok(st02 && /Prioritera blandade stadsmiljöer/.test(st02.text) && st02.typ === 'Ställningstagande' && st02.objekt.length === 3, JSON.stringify(st02));
    assert.ok(alone.plan.leverans.varningar.includes(t('plan.delivery.warn.doc.missing', { file: KK_DOC })), alone.plan.leverans.varningar.join(' | '));
    return 'ok';
  }, 60000);

  test('plan delivery: in the plan view, clicking Karlskrona centrum lists ST_01 and ST_02, and choosing ST_02 marks Karlskrona centrum, Trossö and Lyckeby', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const meta = keep(await delivery.importDelivery([fileOf(await karlskronaGeoPackage(), 'Karlskrona_demo.gpkg'), fileOf(await docx(KK_XML), KK_DOC)], {}));
    const consent = D.require('platform/consent');
    const idb = D.require('platform/storage/idb');
    const memory = D.require('ui/viz/basemap-memory');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn, ms, label) => { const t0 = performance.now(); for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(30); } };
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:800px; display:flex;';
    const center = document.createElement('div'); center.style.cssText = 'width:680px; height:700px; display:flex; flex-direction:column;';
    const right = document.createElement('div'); right.style.cssText = 'width:320px;';
    host.append(center, right);
    document.body.appendChild(host);
    const keptMemory = await idb.getSetting(memory.SETTING, null);
    consent.setAsker(async () => ({ allow: false, remember: false }));
    let view = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      view = D.require('ui/bearbeta/plan-view').create(shell.ctx, { onTable() {}, tileFactory: () => /** @type {any} */ (globalThis).L.layerGroup() });
      await view.render(await datasets.get(meta.id), { center, right });
      await waitFor(() => view.handle && center.querySelector('.dm-plan-view[data-plan-layers-drawn]'), 10000, 'the plan map');
      assert.ok(center.querySelector('[data-plan-split] [data-plan-text]'), 'the text beside the map');
      const layerOf = (namn) => { let hit = null; view.handle.map.eachLayer((l) => { const p = l.feature && l.feature.properties; if (p && p._i !== undefined && view.state.rows[p._i].objektid === kkId(namn)) hit = l; }); return hit; };
      layerOf('Karlskrona centrum').fire('click');
      const listed = await waitFor(() => { const l = Array.from(right.querySelectorAll('[data-plan-object-sections] [data-plan-object-section]')); return l.length ? l : null; }, 5000, 'the statements of the area');
      assert.deepEqual(listed.map((li) => li.getAttribute('data-plan-object-section')), ['ST_01', 'ST_02'], 'ST_01 and ST_02');
      assert.ok(listed.every((li) => li.querySelector('dm-badge').textContent === 'Ställningstagande' && !li.querySelector('[data-plan-link-text]')), 'ställningstaganden, linked by the file');
      /** @type {any} */ (center.querySelector('[data-plan-section-map="ST_02"]')).click();
      await waitFor(() => center.querySelector('.dm-plan-view').getAttribute('data-plan-marked') === '3', 5000, 'three areas marked');
      assert.deepEqual(view.state.marked.slice().sort(), ['Karlskrona centrum', 'Trossö', 'Lyckeby'].map(kkId).sort(), 'Karlskrona centrum, Trossö and Lyckeby');
      const chosen = await waitFor(() => right.querySelector('[data-plan-chosen="ST_02"] [data-plan-chosen-areas]'), 3000, 'the chosen statement\'s areas');
      assert.ok(['Karlskrona centrum', 'Trossö', 'Lyckeby'].every((n) => chosen.textContent.includes(n)), chosen.textContent);
      // Shift-click Trossö too: the union, and what covers which.
      layerOf('Trossö').fire('click', { originalEvent: { shiftKey: true } });
      await waitFor(() => right.querySelector('[data-plan-picked="2"]'), 3000, 'two areas');
      const union = Array.from(right.querySelectorAll('[data-plan-object-section]')).map((li) => li.getAttribute('data-plan-object-section'));
      assert.deepEqual(union, ['ST_01', 'ST_02', 'ST_09', 'ST_10'], 'the union of their statements');
      assert.ok(right.querySelector('[data-plan-object-section="ST_02"] [data-plan-covers]').textContent.includes('Trossö'), 'ST_02 covers both');
    } finally {
      if (view) view.destroy();
      consent.setAsker(null);
      if (keptMemory === null) await idb.deleteSetting(memory.SETTING); else await idb.setSetting(memory.SETTING, keptMemory);
      memory.reset();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      host.remove(); root.remove();
    }
    return 'ok';
  }, 60000);

  test('plan delivery: links in other shapes are read: ids in other case and braces, id and bookmark columns of other names, a heading for a bookmark, bookmarks named in a column on the areas, and a row without objektidentitet', async (assert) => {
    const A = 'AAAAAAAA-0000-4000-8000-0000000000A1';
    const gpkg = await geoPackage([
      { name: 'innehall_op_omrade', title: 'Område', geometry: 'POLYGON', columns: [['objekt_id', 'text'], ['namn', 'text'], ['stallningstaganden', 'text']], rows: [
        [gpb('Polygon', square(512000, 6571000, 500, 500)), A.toLowerCase(), 'Hamnen', null],
        [gpb('Polygon', square(513000, 6571000, 500, 500)), 'area-b', 'Torget', ''],
        [gpb('Polygon', square(514000, 6571000, 500, 500)), null, 'Ängen', 'st_3; OP_ST_1']] },
      { name: 'dokumentavsnitt', columns: [['avsnittstyp_varde', 'text'], ['bokmarke', 'text'], ['omrade_id', 'text']], rows: [['Ställningstagande', 'OP_ST_1', `{${A}}`], ['Ställningstagande', 'Bostäder i norr', ' AREA-B ']] },
    ]);
    const section = (id, name, heading, text) => `<w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr><w:bookmarkStart w:id="${id}" w:name="${name}"/>${run(heading)}</w:p><w:p>${run(text)}<w:bookmarkEnd w:id="${id}"/></w:p>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${section(0, 'op_st_1', 'Hamnen', 'Hamnen blir en stadsdel.')}${section(1, 'op_st_2', 'Bostäder i norr', 'Torget får fler bostäder.')}${section(2, 'op_st_3', 'Grönt', 'Ängen sparas.')}</w:body></w:document>`;
    const meta = keep(await delivery.importDelivery([fileOf(gpkg, 'op.gpkg'), fileOf(await docx(xml), 'text.docx')], {}));
    const of = async (id) => (await delivery.sectionsForObject(meta.id, id)).map((s) => [s.avsnitt, s.kalla]);
    assert.deepEqual(await of(A), [['op_st_1', 'modell']], 'an id in braces and upper case; a bookmark in other case');
    assert.deepEqual(await of('AREA-B'), [['op_st_2', 'modell']], 'the heading in place of the bookmark');
    const rows = await rowsOf(meta.id, 'select objektid from data order by ordning');
    assert.deepEqual(rows.map((r) => r[0]), [A.toLowerCase(), 'area-b', 'innehall_op_omrade:3'], 'a row without an id is <layer>:<fid>');
    assert.deepEqual(await of('innehall_op_omrade:3'), [['op_st_1', 'attribut'], ['op_st_3', 'attribut']], 'its column names two bookmarks, one without its prefix');
    const k = meta.plan.leverans.kopplingar;
    assert.deepEqual(k.kallor.filter((x) => x.antal).map((x) => [x.kalla, x.fran, x.antal]), [['modell', 'dokumentavsnitt', 2], ['attribut', 'stallningstaganden', 2]], JSON.stringify(k.kallor));
    assert.ok((await delivery.sectionsOf(meta.id)).every((s) => s.typ === 'Ställningstagande'), 'every section a ställningstagande');
    return 'ok';
  }, 60000);

  test('plan delivery: with no link in the GeoPackage, the areas the text names are linked as inferred (kalla text); with no names either, the plan says why it has no links', async (assert) => {
    const gpkg = await geoPackage([{ name: 'omraden', title: 'Områden', geometry: 'POLYGON', columns: [['objekt_id', 'text'], ['namn', 'text']],
      rows: [['o-b1', 'B1'], ['o-a2', 'A2'], ['o-a3', 'A3'], ['o-hamn', 'Hamnen'], ['o-ovr', 'Övrigt område']].map(([id, namn], i) => [gpb('Polygon', square(512000 + i * 1000, 6571000, 500, 500)), id, namn]) }]);
    const para = (i, name, text) => `<w:p><w:bookmarkStart w:id="${i}" w:name="${name}"/>${run(text)}<w:bookmarkEnd w:id="${i}"/></w:p>`;
    const body = (parts) => `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${parts}</w:body></w:document>`;
    const xml = body(para(0, 'avsnitt_1', 'Område B1 ska utvecklas.') + para(1, 'avsnitt_2', 'Ställningstagandet gäller områdena A2 och A3.') + para(2, 'avsnitt_3', 'Hamnen behålls som den är.') + para(3, 'avsnitt_4', 'Inget särskilt område nämns här.'));
    const meta = keep(await delivery.importDelivery([fileOf(gpkg, 'omraden.gpkg'), fileOf(await docx(xml), 'beskrivning.docx')], {}));
    assert.equal(meta.kind, 'plan');
    const of = async (id) => (await delivery.sectionsForObject(meta.id, id)).map((s) => [s.avsnitt, s.kalla]);
    assert.deepEqual(await of('o-b1'), [['avsnitt_1', 'text']], '"Område B1"');
    assert.deepEqual([await of('o-a2'), await of('o-a3')], [[['avsnitt_2', 'text']], [['avsnitt_2', 'text']]], '"gäller områdena A2 och A3"');
    assert.deepEqual(await of('o-hamn'), [['avsnitt_3', 'text']], 'an area\'s name');
    assert.deepEqual(await of('o-ovr'), [], 'a name the text lacks');
    const lev = meta.plan.leverans;
    assert.deepEqual([lev.kopplingar.antal, lev.kopplingar.omradenUtan, lev.kopplingar.kallor.map((x) => x.kalla).join()], [4, 1, 'text']);
    assert.ok(lev.varningar.includes(t('plan.links.warn.text')), 'the warnings say they are inferred');
    // The same map with a text that names none of its areas: no links, and why.
    const none = keep(await delivery.importDelivery([fileOf(gpkg, 'omraden.gpkg'), fileOf(await docx(body(para(0, 'avsnitt_4', 'Inget särskilt område nämns här.'))), 'beskrivning.docx')], {}));
    const k = none.plan.leverans.kopplingar;
    assert.deepEqual([k.antal, k.orsaker], [0, ['notable', 'nocolumn', 'nomention']]);
    assert.ok(none.plan.leverans.varningar.includes(t('plan.links.warn.none', { why: ['notable', 'nocolumn', 'nomention'].map((r) => t('plan.links.why.' + r)).join(' ') })), none.plan.leverans.varningar.join(' | '));
    // Read again (Läs kopplingarna igen), the plan stays as it was and says the same.
    const again = await delivery.relink(none.id);
    assert.deepEqual([again.links, again.kopplingar.antal], [0, 0]);
    return 'ok';
  }, 60000);

  test('plan delivery: cleanup', async (assert) => {
    if (datasets.flushSaves) await datasets.flushSaves();
    for (const id of made) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
