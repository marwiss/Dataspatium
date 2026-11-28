// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for editing a digital comprehensive plan (data/plan-edit, ui/bearbeta/plan-edit) and exporting it as a delivery
 * (io/exporters/plan-delivery): the bookmark name rule, a section's heading and text edited, a new ställningstagande added and
 * one removed with its links, areas added, changed, moved and removed with the plan's counts kept, links made and removed from the
 * area's side and the statement's, every edit undone with the app's undo, and the round trip: the plan exported and imported again
 * through data/plan-delivery has the same areas, sections and links. One test opens the plan view, starts editing, loads the
 * drawing library and draws an area. The delivery is built here, with the app's own SQLite engine and fflate; nothing touches
 * the net, and every dataset made is removed again.
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
  const edit = D.require('data/plan-edit');
  const recipes = D.require('data/recipes');
  const zip = D.require('platform/storage/zip');
  const exporter = D.require('io/exporters/plan-delivery');

  // ---- fixtures: Boverket's ÖP model in small, a text document with bookmarks, an appendix and a manifest -----------------
  const square = (x, y, w, hgt) => [[[x, y], [x + w, y], [x + w, y + hgt], [x, y + hgt], [x, y]]];
  function gpb(type, coordinates) {
    const parts = [];
    const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); parts.push(b); };
    const xy = (c) => { const b = new Uint8Array(16); const dv = new DataView(b.buffer); dv.setFloat64(0, c[0], true); dv.setFloat64(8, c[1], true); parts.push(b); };
    parts.push(new Uint8Array([1]));
    if (type === 'LineString') { u32(2); u32(coordinates.length); coordinates.forEach(xy); } else { u32(3); u32(coordinates.length); for (const ring of coordinates) { u32(ring.length); ring.forEach(xy); } }
    const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0; for (const p of parts) { body.set(p, at); at += p.length; }
    const out = new Uint8Array(8 + body.length);
    out.set([0x47, 0x50, 0, 0x01]); new DataView(out.buffer).setInt32(4, 3006, true); out.set(body, 8);
    return out;
  }
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
        if (tb.rows.length) await engine.insertRows(tb.name, (tb.geometry ? ['geom'] : []).concat(tb.columns.map((c) => c[0])), tb.rows);
      }
      return new Uint8Array(await engine.export());
    } finally { engine.terminate(); }
  }
  const PLAN = '{6F0C2B1E-4D5A-4C3B-9E8F-112233445566}';
  const AREA = (n) => `{AAAAAAAA-0000-4000-8000-00000000000${n}}`;
  const LINE = '{BBBBBBBB-0000-4000-8000-000000000001}';
  const plain = (id) => id.replace(/[{}]/g, '').toLowerCase();
  const DOC = 'Planbeskrivning_Testkoping.docx';
  async function opGeoPackage() {
    const content = [['objektidentitet', 'text'], ['oversiktsplan', 'text'], ['namn', 'text'], ['innehallstyp_varde', 'text'], ['planhandelse_varde', 'text']];
    return geoPackage([
      { name: 'innehall_op_markochvattenanvandning_polygon', title: 'Mark- och vattenanvändning (yta)', geometry: 'MULTIPOLYGON', columns: content, rows: [
        [gpb('Polygon', square(512000, 6571000, 1000, 1000)), AREA(1), PLAN, 'Centrum', 'Bostadsbebyggelse', 'Antagen'],
        [gpb('Polygon', square(513000, 6571000, 800, 900)), AREA(2), PLAN, 'Norra staden', 'Bostadsbebyggelse', 'Antagen'],
        [gpb('Polygon', square(514000, 6571000, 600, 700)), AREA(3), PLAN, 'Ängen', 'Grönområde', 'Antagen']] },
      { name: 'innehall_op_utvecklingsinriktning_linje', title: 'Utvecklingsinriktning (linje)', geometry: 'LINESTRING', columns: content, rows: [
        [gpb('LineString', [[512000, 6570000], [515000, 6572000]]), LINE, PLAN, 'Stråket', 'Utvecklingsinriktning', 'Antagen']] },
      { name: 'innehall_op_omrade', title: 'Område', geometry: 'POLYGON', columns: content, rows: [
        [gpb('Polygon', square(511000, 6570000, 5000, 3000)), '{CCCCCCCC-0000-4000-8000-000000000001}', PLAN, 'Tätorten', 'Område', 'Antagen']] },
      { name: 'oversiktsplan', columns: [['objektidentitet', 'text'], ['planens_titel', 'text'], ['kommunkod', 'text'], ['kommunnamn', 'text'], ['planhandelse_varde', 'text']], rows: [[PLAN, 'Översiktsplan Testköping 2040', '1880', 'Testköping', 'Antagen']] },
      { name: 'avsnittsbokmärke', columns: [['avsnittsbokmarke_id', 'text'], ['avsnittsbokmarke_text', 'text']], rows: [['op_stall_bostader', 'Ställningstaganden för bostäder'], ['op_syfte', 'Syfte']] },
      { name: 'dokumentreferens_op', columns: [['namn', 'text'], ['lank', 'text'], ['dokumentreferens_id', 'text']], rows: [['Planbeskrivning Testköping', 'https://kommun.example/op/' + DOC, 'dr-1']] },
      { name: 'dokumentavsnitt', columns: [['avsnittstyp_varde', 'text'], ['avsnittsbokmarke_id', 'text'], ['dokumentreferens_id', 'text'], ['dokument_id', 'text'], ['objektidentitet', 'text']], rows: [
        ['Ställningstagande', 'op_stall_bostader', 'dr-1', null, AREA(1)], ['Ställningstagande', 'op_stall_bostader', 'dr-1', null, AREA(2)], ['Ställningstagande', 'op_stall_bostader', 'dr-1', null, AREA(3)],
        ['Beskrivning', 'op_beskr_centrum', 'dr-1', null, AREA(1)], ['Översiktsplanens syfte', 'op_syfte', 'dr-1', null, PLAN]] },
      { name: 'innehall_op_markochvattenanvandning_lookup', columns: [['innehallstyp_varde', 'text']], rows: [['Bostadsbebyggelse'], ['Verksamheter'], ['Grönområde']] },
    ]);
  }
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const run = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
  const TEXT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>`
    + `<w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr>${run('Syfte')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="0" w:name="op_syfte"/>${run('Planen visar hur kommunen vill utvecklas.')}<w:bookmarkEnd w:id="0"/></w:p>`
    + `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:bookmarkStart w:id="1" w:name="op_stall_bostader"/>${run('Ställningstaganden för bostäder')}</w:p>`
    + `<w:p>${run('Nya bostäder byggs nära stationen.')}</w:p><w:p>${run('Grönområden &amp; parker bevaras.')}<w:bookmarkEnd w:id="1"/></w:p>`
    + `<w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr>${run('Centrum')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="2" w:name="op_beskr_centrum"/><w:bookmarkEnd w:id="2"/>${run('Centrum är en blandad stadsdel.')}</w:p>`
    + '</w:body></w:document>';
  const APPENDIX_XML = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr>${run('Konsekvenser')}</w:p>`
    + `<w:p><w:bookmarkStart w:id="0" w:name="op_kons"/>${run('Planen ger fler bostäder.')}<w:bookmarkEnd w:id="0"/></w:p></w:body></w:document>`;
  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Rubrik1"><w:name w:val="heading 1"/></w:style></w:styles>`;
  async function docx(documentXml) {
    const blob = await zip.createZip({ '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', 'word/document.xml': documentXml, 'word/styles.xml': STYLES_XML });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
  const fileOf = (bytes, name) => { const f = new File([bytes], name); /** @type {any} */ (f).dmPath = 'ÖP Testköping/' + name; return f; };
  const made = [];
  const keep = (meta) => { made.push(meta.id); return meta; };
  /** The delivery imported as a plan: plan map, text document, an appendix with a section of its own, a PDF and a manifest. */
  async function deliveredPlan() {
    const enc = new TextEncoder();
    const files = [fileOf(await opGeoPackage(), 'op-testkoping.gpkg'), fileOf(await docx(TEXT_XML), DOC), fileOf(await docx(APPENDIX_XML), 'Bilaga_1_Konsekvenser.docx'),
      fileOf(PDF, 'Samradsredogorelse.pdf'), fileOf(enc.encode('<?xml version="1.0"?><leverans xmlns="urn:example:leverans"><fil namn="op-testkoping.gpkg" sha256="00"/></leverans>'), 'manifest.xml')];
    return keep(await delivery.importDelivery(files, {}));
  }
  async function rowsOf(id, sql) { const r = await (await datasets.ensureOpen(id)).engine.exec(sql); return r[0] ? r[0].values : []; }
  /** Everything the edits touch, comparable: the rows, the sections, the links and the plan's counts. */
  async function stateOf(id) {
    const hd = await datasets.ensureOpen(id);
    return {
      rows: await rowsOf(id, `select ${hd.columns.map((c) => '"' + c.name + '"').join(', ')} from data order by objektid`),
      sections: await rowsOf(id, 'select avsnitt, dokument, rubrik, text, typ, ordning from _sections order by avsnitt, dokument'),
      links: await rowsOf(id, "select avsnitt, coalesce(objektid, ''), dokument, typ, coalesce(kalla, '') from _section_links order by avsnitt, objektid, dokument"),
      antal: hd.meta.plan.antal, lager: hd.meta.plan.lager.map((l) => [l.namn, l.fil, l.antal]),
    };
  }
  const near = (a, b) => Math.abs(a - b) < 1e-7;
  const flat = (g) => JSON.stringify(g.coordinates).match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number);
  const sameShape = (a, b) => { const x = flat(a); const y = flat(b); return a.type === b.type && x.length === y.length && x.every((v, i) => near(v, y[i])); };
  const wgsSquare = (x, y, d = 0.004) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });

  // ---- tests -----------------------------------------------------------------------------------------------
  test('plan edit: a bookmark name follows the exchange model\'s rule, made from a heading and unique in the plan', (assert) => {
    for (const ok of ['op_1', 'A', 'op_stall_bostader', 'x'.repeat(40)]) assert.ok(edit.validBookmark(ok), ok);
    for (const bad of ['', '1op', '_Toc123', 'op-1', 'op 1', 'opå', 'x'.repeat(41)]) assert.ok(!edit.validBookmark(bad), bad);
    assert.ok(edit.BOOKMARK_NAME.test('op_a') && String(edit.BOOKMARK_NAME) === String(delivery.BOOKMARK_NAME), 'the same rule as the importer');
    assert.equal(edit.bookmarkName('Ställningstaganden för bostäder'), 'op_stallningstaganden_for_bostader');
    assert.equal(edit.bookmarkName('Ställningstaganden för bostäder', ['OP_stallningstaganden_for_bostader']), 'op_stallningstaganden_for_bostader_2', 'unique, compared without case');
    assert.equal(edit.bookmarkName('', []), 'op_avsnitt');
    const long = edit.bookmarkName('Landsbygdsutveckling i strandnära lägen längs Vätterns östra strand', ['op_landsbygdsutveckling_i_strandnara_lag']);
    assert.ok(edit.validBookmark(long) && long.length <= 40 && long.endsWith('_2'), long);
    assert.ok(edit.validBookmark(edit.bookmarkName('Æble, ørken & þing!')), 'Nordic letters become ASCII');
    assert.equal(edit.cleanText('  Första  stycket \r\n\r\n andra\u0007 stycket  \n'), 'Första stycket\nandra stycket', 'plain text, a line per paragraph');
    const spans = { rubrik: 'Bostäder', text: 'Bostäder\nNya bostäder byggs.' };
    assert.equal(edit.bodyOf(spans), 'Nya bostäder byggs.', 'the heading line is not part of the body');
    assert.equal(edit.composeText(spans, 'Fler bostäder', 'Nya bostäder byggs nära stationen.'), 'Fler bostäder\nNya bostäder byggs nära stationen.', 'and comes back with the new heading');
    assert.equal(edit.composeText({ rubrik: 'Syfte', text: 'Planen visar.' }, 'Syfte', 'Planen visar mer.'), 'Planen visar mer.');
    return 'ok';
  });

  test('plan edit: a section\'s heading and text edited, a new ställningstagande added with its bookmark and links, one removed with its links', async (assert) => {
    const meta = await deliveredPlan();
    const id = meta.id;
    // Edited in place: the heading, the text as plain paragraphs, the type; the links follow the type.
    await edit.editSection(id, { avsnitt: 'op_beskr_centrum', dokument: DOC }, { rubrik: '  Centrum  i  dag ', text: 'Centrum är blandat.\n\n  Det ska växa. ', typ: 'Ställningstagande' });
    let sections = await delivery.sectionsOf(id);
    const centrum = sections.find((s) => s.avsnitt === 'op_beskr_centrum');
    assert.deepEqual([centrum.rubrik, centrum.text, centrum.typ], ['Centrum i dag', 'Centrum är blandat.\nDet ska växa.', 'Ställningstagande']);
    assert.deepEqual((await rowsOf(id, "select distinct typ from _section_links where avsnitt = 'op_beskr_centrum'")).map((r) => r[0]), ['Ställningstagande'], 'the link\'s type follows');
    const facts = JSON.parse((await rowsOf(id, `select egenskaper from data where objektid = '${plain(AREA(1))}'`))[0][0]);
    assert.ok(facts.dokument.includes('Centrum i dag'), 'the area\'s facts name the new heading: ' + JSON.stringify(facts));
    // A new ställningstagande: a bookmark of its own from its heading, in the text document, linked to two areas.
    const added = await edit.addSection(id, { rubrik: 'Verksamheter vid leden', text: 'Nya verksamheter samlas vid leden.', objekt: [plain(AREA(3)), plain(LINE)] });
    assert.deepEqual(added, { avsnitt: 'op_verksamheter_vid_leden', dokument: DOC });
    sections = await delivery.sectionsOf(id);
    const fresh = sections.find((s) => s.avsnitt === added.avsnitt);
    assert.ok(fresh && fresh.typ === 'Ställningstagande' && fresh.text === 'Nya verksamheter samlas vid leden.' && fresh.ordning === Math.max(...sections.map((s) => s.ordning)), JSON.stringify(fresh));
    assert.deepEqual(await delivery.objectsForSection(id, added.avsnitt), [plain(AREA(3)), plain(LINE)].sort());
    assert.ok((await delivery.sectionsForObject(id, LINE)).some((s) => s.avsnitt === added.avsnitt), 'the line names it');
    // A bookmark that breaks the rule or is taken is refused.
    await assert.throws(() => edit.addSection(id, { avsnitt: '9fel', rubrik: 'Fel' }), new RegExp(t('plan.edit.err.bookmark', { name: '9fel' }).slice(0, 18)));
    await assert.throws(() => edit.addSection(id, { avsnitt: 'OP_SYFTE', rubrik: 'Igen' }), /OP_SYFTE/);
    // After another section, and of another type.
    const after = await edit.addSection(id, { rubrik: 'Bakgrund', text: 'Staden växte.', typ: 'Beskrivning', after: 'op_syfte' });
    sections = await delivery.sectionsOf(id);
    assert.equal(sections[sections.findIndex((s) => s.avsnitt === 'op_syfte') + 1].avsnitt, after.avsnitt, 'placed after the section named');
    // Removed with its links, after a confirm in the view.
    await edit.deleteSection(id, { avsnitt: 'op_stall_bostader', dokument: DOC });
    sections = await delivery.sectionsOf(id);
    assert.ok(!sections.some((s) => s.avsnitt === 'op_stall_bostader'));
    assert.equal((await rowsOf(id, "select count(*) from _section_links where avsnitt = 'op_stall_bostader'"))[0][0], 0, 'its links are gone');
    assert.deepEqual((await delivery.sectionsForObject(id, AREA(2))).map((s) => s.avsnitt), [], 'the area keeps no section');
    // Every edit is a logged step with its own words.
    const log = (await datasets.log(id)).filter((e) => e.action === 'op').map((e) => e.details.op);
    assert.deepEqual(log, ['plan_section_set', 'plan_section_add', 'plan_section_add', 'plan_section_delete']);
    assert.equal(recipes.describe('plan_section_add', {}), t('op.plan_section_add'));
    return 'ok';
  }, 60000);

  test('plan edit: areas added, changed, moved and removed through the operations, with the counts and the layers kept', async (assert) => {
    const meta = await deliveredPlan();
    const id = meta.id;
    // Into a layer of the plan map: the theme's layer with that kind of geometry.
    const a = await edit.addArea(id, { tema: 'markochvattenanvandning', geometry: wgsSquare(15.21, 59.27), innehallstyp: 'Verksamheter', namn: 'Hamnen' });
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), 'a new UUID: ' + a);
    let row = (await rowsOf(id, `select tema, innehallstyp, namn, lager, fil, geometrityp from data where objektid = '${a}'`))[0];
    assert.deepEqual(row, ['markochvattenanvandning', 'Verksamheter', 'Hamnen', 'innehall_op_markochvattenanvandning_polygon', 'op-testkoping.gpkg', 'Polygon']);
    // A theme the plan has no layer for gets the theme's table in the plan map's file.
    const p = await edit.addArea(id, { tema: 'lis', geometry: { type: 'Point', coordinates: [15.22, 59.28] }, innehallstyp: 'LIS-område' });
    row = (await rowsOf(id, `select lager, fil, geometrityp from data where objektid = '${p}'`))[0];
    assert.deepEqual(row, ['innehall_op_lis_point', 'op-testkoping.gpkg', 'Point']);
    let info = (await datasets.ensureOpen(id)).meta.plan;
    assert.equal(info.antal.markochvattenanvandning, 4); assert.equal(info.antal.lis, 1);
    assert.ok(info.lager.some((l) => l.namn === 'innehall_op_lis_point' && l.antal === 1 && l.fil === 'op-testkoping.gpkg'), 'the new layer listed');
    assert.equal(info.lager.find((l) => l.namn === 'innehall_op_markochvattenanvandning_polygon').antal, 4);
    assert.equal((await datasets.get(id)).rowCount, 7, 'the row count saved');
    // A line cannot go into a layer of areas, and a shape without usable places is refused.
    await assert.throws(() => edit.addArea(id, { tema: 'markochvattenanvandning', lager: 'innehall_op_markochvattenanvandning_polygon', fil: 'op-testkoping.gpkg', geometry: { type: 'LineString', coordinates: [[15.2, 59.2], [15.3, 59.3]] } }), new RegExp(t('layers.mark.polygon')));
    await assert.throws(() => edit.addArea(id, { tema: 'omrade', geometry: { type: 'Polygon', coordinates: [[[15.2, 59.2], [15.3, 59.3]]] } }), new RegExp(t('plan.edit.err.geometry').slice(0, 20)));
    // Its attributes, its shape and its position.
    await edit.editArea(id, a, { innehallstyp: 'Funktionsblandad bebyggelse', namn: ' Hamnen  syd ', precisering: 'Kontor och bostäder.\n\nInga stora butiker.' });
    row = (await rowsOf(id, `select innehallstyp, namn, precisering from data where objektid = '${a}'`))[0];
    assert.deepEqual(row, ['Funktionsblandad bebyggelse', 'Hamnen syd', 'Kontor och bostäder.\nInga stora butiker.']);
    const moved = { type: 'Polygon', coordinates: [[[15.25, 59.27], [15.255, 59.27], [15.256, 59.276], [15.25, 59.274], [15.25, 59.27]]] };
    await edit.setGeometry(id, a, moved);
    assert.deepEqual(JSON.parse((await rowsOf(id, `select geometri from data where objektid = '${a}'`))[0][0]), moved, 'the new vertices');
    await assert.throws(() => edit.setGeometry(id, plain(LINE), wgsSquare(15.2, 59.2)), new RegExp(t('layers.mark.line')), 'a line stays a line');
    // Removed with its links.
    await edit.link(id, { avsnitt: 'op_syfte', dokument: DOC }, [a]);
    await edit.deleteArea(id, a);
    assert.equal((await rowsOf(id, `select count(*) from data where objektid = '${a}'`))[0][0], 0);
    assert.equal((await rowsOf(id, `select count(*) from _section_links where objektid = '${a}'`))[0][0], 0, 'its links are gone');
    info = (await datasets.ensureOpen(id)).meta.plan;
    assert.equal(info.antal.markochvattenanvandning, 3);
    assert.equal((await datasets.get(id)).rowCount, 6);
    // A detailed plan has no themes to draw into: its objects have object types (tests/create-sources.test.js).
    const dp = keep(await datasets.create({ name: 'DP', kind: 'plan', columns: plan.DP_COLUMNS, rows: [] }));
    await assert.throws(() => edit.addArea(dp.id, { tema: 'omrade', geometry: wgsSquare(15, 59) }), new RegExp(t('plan.edit.err.notdp').slice(0, 20)));
    return 'ok';
  }, 60000);

  test('plan edit: links made and removed from the area\'s side and from the statement\'s', async (assert) => {
    const meta = await deliveredPlan();
    const id = meta.id;
    const statement = { avsnitt: 'op_stall_bostader', dokument: DOC };
    // From the statement's side: the selected areas linked (twice is once), and unlinked.
    let res = await edit.link(id, statement, [plain(LINE), AREA(1), plain(LINE)]);
    assert.equal(res.rows, 1, 'only the line is new');
    assert.deepEqual(await delivery.objectsForSection(id, 'op_stall_bostader'), [1, 2, 3].map((n) => plain(AREA(n))).concat(plain(LINE)).sort());
    assert.deepEqual((await rowsOf(id, `select typ, kalla from _section_links where avsnitt = 'op_stall_bostader' and objektid = '${plain(LINE)}'`))[0], ['Ställningstagande', edit.EDITED], 'the link has the section\'s type and says it was made here');
    assert.equal(edit.EDITED, 'redigerad');
    const lineFacts = JSON.parse((await rowsOf(id, `select egenskaper from data where objektid = '${plain(LINE)}'`))[0][0]);
    assert.deepEqual(lineFacts.dokument, ['Ställningstaganden för bostäder'], 'the line\'s facts name its section');
    res = await edit.unlink(id, statement, [plain(LINE), AREA(2)]);
    assert.equal(res.rows, 2);
    assert.deepEqual(await delivery.objectsForSection(id, 'op_stall_bostader'), [plain(AREA(1)), plain(AREA(3))]);
    // From the area's side: the area's statement list loses one.
    assert.deepEqual((await delivery.sectionsForObject(id, AREA(1))).map((s) => s.avsnitt), ['op_stall_bostader', 'op_beskr_centrum']);
    await edit.unlink(id, { avsnitt: 'op_beskr_centrum', dokument: DOC }, [AREA(1)]);
    assert.deepEqual((await delivery.sectionsForObject(id, AREA(1))).map((s) => s.avsnitt), ['op_stall_bostader']);
    // The whole plan is linked and unlinked as ''.
    await edit.link(id, statement, ['']);
    assert.ok((await delivery.sectionsOf(id)).find((s) => s.avsnitt === 'op_stall_bostader').helaPlanen, 'about the whole plan too');
    await edit.unlink(id, statement, ['']);
    assert.ok(!(await delivery.sectionsOf(id)).find((s) => s.avsnitt === 'op_stall_bostader').helaPlanen);
    await assert.throws(() => edit.link(id, { avsnitt: 'op_finns_inte', dokument: DOC }, [AREA(1)]), /op_finns_inte/);
    return 'ok';
  }, 60000);

  test('plan edit: every edit is undone with the app\'s undo, back to the plan as it was', async (assert) => {
    const meta = await deliveredPlan();
    const id = meta.id;
    const before = await stateOf(id);
    const a = await edit.addArea(id, { tema: 'markochvattenanvandning', geometry: wgsSquare(15.21, 59.27), innehallstyp: 'Verksamheter' });
    await edit.editArea(id, plain(AREA(2)), { namn: 'Norr', precisering: 'Tätare.' });
    await edit.setGeometry(id, plain(AREA(3)), wgsSquare(15.3, 59.3));
    await edit.editSection(id, { avsnitt: 'op_stall_bostader', dokument: DOC }, { rubrik: 'Bostäder', text: 'Bostäder\nFler bostäder.', typ: 'Beskrivning' });
    const s = await edit.addSection(id, { rubrik: 'Hamnen', text: 'Hamnen växer.', objekt: [a, plain(AREA(1))] });
    await edit.link(id, { avsnitt: 'op_syfte', dokument: DOC }, [plain(AREA(2)), plain(LINE)]);
    await edit.unlink(id, { avsnitt: 'op_beskr_centrum', dokument: DOC }, [plain(AREA(1))]);
    await edit.deleteSection(id, { avsnitt: 'op_kons', dokument: 'Bilaga_1_Konsekvenser.docx' });
    await edit.deleteArea(id, plain(AREA(1)));
    assert.ok(recipes.canUndo(id) && recipes.undoLabel(id) === t('op.plan_area_delete'), 'Ångra names the last edit: ' + recipes.undoLabel(id));
    assert.ok(JSON.stringify(await stateOf(id)) !== JSON.stringify(before), 'the plan changed');
    // Undone one at a time: the area comes back with its links, then the section, … and the first area goes.
    await edit.undo(id);
    assert.equal((await rowsOf(id, `select count(*) from data where objektid = '${plain(AREA(1))}'`))[0][0], 1, 'the area is back');
    assert.ok((await delivery.sectionsForObject(id, AREA(1))).some((x) => x.avsnitt === s.avsnitt), 'with its links');
    for (let i = 0; i < 8; i++) await edit.undo(id);
    const after = await stateOf(id);
    assert.deepEqual(after.rows, before.rows, 'the rows as they were, facts and shapes too');
    assert.deepEqual(after.sections, before.sections, 'the sections as they were');
    assert.deepEqual(after.links, before.links, 'the links as they were');
    assert.deepEqual([after.antal, after.lager], [before.antal, before.lager], 'the counts as they were');
    assert.ok(!recipes.canUndo(id), 'nothing left to undo');
    const log = await datasets.log(id);
    assert.equal(log.filter((e) => e.action === 'undo').length, 9, 'each undo is logged');
    // Saved: the stored plan is the one undone.
    assert.equal((await datasets.get(id)).rowCount, before.rows.length);
    return 'ok';
  }, 90000);

  test('plan edit: the plan exported as a delivery and imported again has the same areas, sections and links', async (assert) => {
    const meta = await deliveredPlan();
    const id = meta.id;
    // Edits first: a new area, a new ställningstagande linked to it and to the line, a section's text, one link removed.
    const a = await edit.addArea(id, { tema: 'markochvattenanvandning', geometry: wgsSquare(15.21, 59.27), innehallstyp: 'Verksamheter', namn: 'Hamnen', precisering: 'Kontor.\nLager.' });
    const s = await edit.addSection(id, { rubrik: 'Verksamheter vid hamnen', text: 'Hamnen blir ett verksamhetsområde.\nLeden knyter ihop det.', objekt: [a, plain(LINE)] });
    await edit.editSection(id, { avsnitt: 'op_beskr_centrum', dokument: DOC }, { text: 'Centrum är en blandad stadsdel <b>med</b> & utan "citat".' });
    await edit.unlink(id, { avsnitt: 'op_stall_bostader', dokument: DOC }, [plain(AREA(3))]);
    const want = await stateOf(id);
    const wantInfo = (await datasets.ensureOpen(id)).meta.plan;
    // The delivery's files: the plan map, the text document and the appendix made anew, the PDF as it was, no manifest.
    const built = await exporter.build(id);
    assert.deepEqual(built.files.map((f) => [f.name, f.role]), [['op-testkoping.gpkg', 'plankarta'], [DOC, 'textdokument'], ['Bilaga_1_Konsekvenser.docx', 'bilaga'], ['Samradsredogorelse.pdf', 'bilaga']]);
    const marks = await delivery.readDocx(built.files[1].bytes);
    assert.deepEqual(marks.map((m) => m.name), ['op_syfte', 'op_stall_bostader', 'op_beskr_centrum', s.avsnitt], 'a Word bookmark per section, named by its avsnitt');
    assert.ok(marks.every((m) => delivery.BOOKMARK_NAME.test(m.name) && !m.noEnd));
    // The GeoPackage in Boverket's model: the content tables, the plan, the links, the bookmarks, the documents.
    const { engine } = await D.require('io/importers/sqlite').openFile(new File([built.files[0].bytes], 'op.gpkg'));
    try {
      const names = (await engine.exec("select name from sqlite_master where type = 'table' order by name"))[0].values.map((r) => r[0]);
      for (const n of ['innehall_op_markochvattenanvandning_polygon', 'innehall_op_utvecklingsinriktning_linje', 'innehall_op_omrade', 'oversiktsplan', 'dokumentavsnitt', 'avsnittsbokmärke', 'dokumentreferens_op', 'gpkg_contents', 'gpkg_geometry_columns']) assert.ok(names.includes(n), n + ' in ' + names.join(','));
      const cols = (await engine.exec('pragma table_info("innehall_op_markochvattenanvandning_polygon")'))[0].values.map((r) => r[1]);
      assert.deepEqual(cols.slice(0, 6), ['fid', 'geom', 'objektidentitet', 'oversiktsplan', 'innehallstyp_varde', 'namn'], 'Boverket\'s column names');
      const srs = (await engine.exec("select srs_id from gpkg_geometry_columns where table_name = 'innehall_op_omrade'"))[0].values[0][0];
      assert.equal(srs, 3006, 'in SWEREF 99 TM');
      const ids = (await engine.exec("select objektidentitet from innehall_op_markochvattenanvandning_polygon order by fid"))[0].values.map((r) => r[0]);
      assert.ok(ids.includes(AREA(1)) && ids.includes(`{${a.toUpperCase()}}`), 'UUIDs in braces and capitals: ' + ids.join(','));
      const parts = (await engine.exec('select avsnittstyp_varde, avsnittsbokmarke_id, objektidentitet from dokumentavsnitt order by fid'))[0].values;
      assert.ok(parts.some((r) => r[1] === 'op_syfte' && r[2] === PLAN), 'the whole plan by the plan\'s own id');
      assert.ok(parts.some((r) => r[0] === 'Ställningstagande' && r[1] === s.avsnitt && r[2] === `{${a.toUpperCase()}}`));
    } finally { engine.terminate(); }
    // Imported again through data/plan-delivery.
    const blob = await exporter.toZip(id);
    const back = keep(await delivery.importDelivery([new File([blob], 'leverans.zip', { type: 'application/zip' })], {}));
    const got = await stateOf(back.id);
    assert.equal(back.name, 'Översiktsplan Testköping 2040');
    assert.deepEqual([back.plan.objektid, back.plan.kommunkod, back.plan.kommun, back.plan.status], [wantInfo.objektid, '1880', 'Testköping', 'Antagen'], 'the plan\'s identity');
    const cols = (await datasets.ensureOpen(id)).columns.map((c) => c.name);
    const pick = (rows, names) => rows.map((r) => names.map((n) => r[cols.indexOf(n)]));
    const fields = ['objektid', 'tema', 'innehallstyp', 'namn', 'precisering', 'planhandelse', 'geometrityp', 'lager', 'fil'];
    assert.deepEqual(pick(got.rows, fields), pick(want.rows, fields), 'the same areas');
    const gi = cols.indexOf('geometri');
    assert.ok(got.rows.every((r, i) => sameShape(JSON.parse(r[gi]), JSON.parse(want.rows[i][gi]))), 'in the same places');
    const bySection = (list) => list.map((x) => x.slice(0, 4)).sort();
    assert.deepEqual(bySection(got.sections), bySection(want.sections), 'the same sections: bookmark, document, heading and text');
    const linked = new Set(want.links.map((l) => l[0]));
    assert.deepEqual(got.sections.filter((x) => linked.has(x[0])).map((x) => [x[0], x[4]]).sort(), want.sections.filter((x) => linked.has(x[0])).map((x) => [x[0], x[4]]).sort(), 'the linked sections\' types');
    assert.deepEqual(got.links.map((l) => l.slice(0, 4)), want.links.map((l) => l.slice(0, 4)), 'the same links');
    const order = (list, doc) => list.filter((x) => x[1] === doc).sort((p, q) => p[5] - q[5]).map((x) => x[0]);
    assert.deepEqual(order(got.sections, DOC), order(want.sections, DOC), 'in the same order');
    assert.deepEqual((await dsFiles.list(back.id)).map((f) => [f.name, f.kind]), [['Bilaga_1_Konsekvenser.docx', 'bilaga'], [DOC, 'textdokument'], ['Samradsredogorelse.pdf', 'bilaga'], ['op-testkoping.gpkg', 'plankarta']]);
    // The Exportera mode offers it for a comprehensive plan only.
    if (D.has('io/export')) {
      const ex = D.require('io/export');
      assert.ok(ex.formatsFor(await datasets.get(id)).some((f) => f.id === 'plan-delivery'), 'offered for an översiktsplan');
      assert.ok(!ex.formatsFor({ kind: 'plan', plan: { slag: 'detaljplan' } }).some((f) => f.id === 'plan-delivery'), 'not for a detaljplan');
      const out = await ex.exportDataset(id, 'plan-delivery');
      assert.ok(out.filename.endsWith('.zip') && out.blob.size > 1000, out.filename);
    }
    return 'ok';
  }, 120000);

  test('plan edit: the plan view\'s edit toolbar loads the drawing library, draws an area and leaves edit mode', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const meta = await deliveredPlan();
    const idb = D.require('platform/storage/idb');
    const memory = D.require('ui/viz/basemap-memory');
    const consent = D.require('platform/consent');
    const kept = await idb.getSetting(memory.SETTING, null);
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false, remember: false }; });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:800px; display:flex;';
    const center = document.createElement('div'); center.style.cssText = 'width:680px; height:700px; display:flex; flex-direction:column;';
    const right = document.createElement('div'); right.style.cssText = 'width:320px;';
    host.append(center, right); document.body.appendChild(host);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn, ms, label) => { const t0 = performance.now(); for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(40); } };
    const fetched = [];
    let view = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      view = D.require('ui/bearbeta/plan-view').create(shell.ctx, { onTable() {}, tileFactory: (url) => { fetched.push(url); return /** @type {any} */ (globalThis).L.layerGroup(); } });
      await view.render(await datasets.get(meta.id), { center, right });
      await waitFor(() => view.handle && center.querySelector('.dm-plan-view[data-plan-layers-drawn]'), 10000, 'the plan map');
      const startBtn = /** @type {any} */ (await waitFor(() => center.querySelector('[data-plan-edit="start"]'), 3000, 'Redigera planen'));
      assert.ok(center.querySelector('[data-plan-export]'), 'Exportera som leverans');
      startBtn.click();
      const bar = await waitFor(() => center.querySelector('[data-plan-edit-bar]'), 10000, 'the edit bar');
      const L = /** @type {any} */ (globalThis).L;
      assert.ok(L && L.PM, 'Leaflet-Geoman loaded');
      await waitFor(() => view.handle && view.handle.map.pm, 5000, 'the map\'s pm');
      assert.ok(center.querySelector('[data-plan-edit="done"]'), 'Klar');
      assert.deepEqual(Array.from(bar.querySelectorAll('[data-plan-draw]')).map((b) => b.getAttribute('data-plan-draw')), ['polygon', 'line', 'point']);
      assert.ok(bar.querySelector('[data-plan-edit-target]') && bar.querySelector('[data-plan-edit-undo]'));
      // The text pane's edit buttons.
      assert.ok(center.querySelector('[data-plan-section-add="statement"]') && center.querySelector('[data-plan-section-edit="op_stall_bostader"]'), 'the sections can be edited');
      // Rita yta: Geoman draws; a finished shape becomes an area of the plan.
      const rows = (await datasets.get(meta.id)).rowCount;
      /** @type {any} */ (bar.querySelector('[data-plan-draw="polygon"]')).click();
      await waitFor(() => view.handle.map.pm.globalDrawModeEnabled(), 3000, 'drawing');
      assert.ok(center.querySelector('[data-plan-draw-finish]'), 'Avsluta formen');
      const drawn = L.polygon([[59.27, 15.21], [59.27, 15.215], [59.275, 15.215], [59.27, 15.21]]);
      view.handle.map.fire('pm:create', { shape: 'Polygon', layer: drawn });
      await waitFor(async () => (await datasets.get(meta.id)).rowCount === rows + 1, 10000, 'the new area');
      const added = await waitFor(() => right.querySelector('[data-plan-area-edit]'), 10000, 'the new area in the inspector');
      assert.ok(added.querySelector('[data-plan-area-type]') && added.querySelector('[data-plan-area-delete]') && added.querySelector('[data-plan-shape-edit="vertices"]'), 'its fields and buttons');
      assert.ok(right.querySelector('[data-plan-edit-selection="1"]'), 'selected');
      // Redigera formen shows Geoman's handles on a copy; Avbryt drops it.
      /** @type {any} */ (added.querySelector('[data-plan-shape-edit="vertices"]')).click();
      await waitFor(() => view.handle.map.getContainer().getAttribute('data-plan-edit-shape') === 'vertices', 3000, 'the shape edited');
      /** @type {any} */ (await waitFor(() => right.querySelector('[data-plan-shape-cancel]'), 3000, 'Avbryt')).click();
      // Klar leaves edit mode.
      /** @type {any} */ (await waitFor(() => center.querySelector('[data-plan-edit="done"]'), 5000, 'Klar')).click();
      await waitFor(() => !center.querySelector('[data-plan-edit-bar]') && center.querySelector('[data-plan-edit="start"]'), 5000, 'out of edit mode');
      assert.ok(!fetched.length && !asked.length, 'nothing fetched, nothing asked');
    } finally {
      if (view) view.destroy();
      consent.setAsker(null);
      if (kept === null) await idb.deleteSetting(memory.SETTING); else await idb.setSetting(memory.SETTING, kept);
      memory.reset();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      host.remove(); root.remove();
    }
    return 'ok';
  }, 60000);

  test('plan edit: cleanup', async (assert) => {
    if (datasets.flushSaves) await datasets.flushSaves();
    for (const id of made) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
