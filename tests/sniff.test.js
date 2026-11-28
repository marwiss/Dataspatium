// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for recognising a file by its contents (io/sniff and io/import recognise, decision F83 a): one test per signature, made
 * here from bytes, and then that a known extension still decides, that an unsure text is not taken over, and that a file
 * without a name goes to the right importer, also in Inhämta. No network and no files from outside the repo.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const sniffer = D.require('io/sniff');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const zip = D.require('platform/storage/zip');
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];

  /** Bytes from strings (one byte per character), numbers and byte arrays. */
  function bytes(...parts) {
    const out = [];
    for (const part of parts) {
      if (typeof part === 'string') for (let i = 0; i < part.length; i++) out.push(part.charCodeAt(i) & 0xff);
      else if (typeof part === 'number') out.push(part);
      else for (const b of part) out.push(b);
    }
    return new Uint8Array(out);
  }
  const zeros = (n) => new Array(n).fill(0);
  const le32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const be32 = (n) => le32(n).reverse();
  const utf8 = (s) => new TextEncoder().encode(s);
  const zipOf = async (entries) => new Uint8Array(await (await zip.createZip(entries)).arrayBuffer());
  /** An OpenDocument ZIP: the mimetype first and stored, as the standard says. */
  async function odf(mime) {
    await D.assets.loadVendorScript('vendor/fflate/fflate.min.js');
    const f = /** @type {any} */ (globalThis).fflate;
    return f.zipSync({ mimetype: [f.strToU8(mime), { level: 0 }], 'content.xml': f.strToU8('<office:document-content/>') });
  }
  /** An OLE2 compound file whose first directory sector names these streams. */
  function ole(...streams) {
    const head = zeros(512);
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].forEach((b, i) => { head[i] = b; });
    head[0x18] = 0x3e; head[0x1a] = 3; head[0x1c] = 0xfe; head[0x1d] = 0xff; head[0x1e] = 9; head[0x20] = 6;
    const dir = zeros(512);
    ['Root Entry'].concat(streams).forEach((name, e) => {
      for (let i = 0; i < name.length; i++) dir[e * 128 + i * 2] = name.charCodeAt(i);
      dir[e * 128 + 0x40] = (name.length + 1) * 2;
    });
    return bytes(head, dir);
  }
  const GEOJSON = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { namn: 'Umeå' }, geometry: { type: 'Point', coordinates: [20.26, 63.83] } }] });
  const TOPOJSON = JSON.stringify({ type: 'Topology', transform: { scale: [0.001, 0.001], translate: [17, 59] }, arcs: [[[0, 0], [1000, 0], [0, 1000], [-1000, 0], [0, -1000]]],
    objects: { lan: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]], id: '03', properties: { namn: 'Uppsala län' } }] } } });
  const CSV = 'kommun;kod;befolkning\r\nStockholm;0180;984748\r\nMalmö;1280;362133\r\n';
  const PROSE = 'Hej!\nDet här är en anteckning, inget annat.\nMed vänlig hälsning';
  const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], 'JFIF', 0, zeros(40));
  const big = JSON.stringify(Array.from({ length: 800 }, (_, i) => ({ id: i, namn: 'rad ' + i, varde: i * 1.5 })));

  /** [what, the bytes or text, the extension or null when nothing is sure, the format the preview names]. */
  const CASES = [
    ['SQLite', () => bytes('SQLite format 3', 0, zeros(84)), 'sqlite', 'SQLite'],
    ['GeoPackage by its application id', () => bytes('SQLite format 3', 0, zeros(52), 'GPKG', zeros(28)), 'gpkg', 'GeoPackage'],
    ['PDF', () => bytes('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n'), 'pdf', 'PDF'],
    ['TIFF in Intel order', () => bytes([0x49, 0x49, 0x2a, 0], le32(8), zeros(16)), 'tif', 'TIFF'],
    ['TIFF in Motorola order', () => bytes([0x4d, 0x4d, 0, 0x2a], be32(8), zeros(16)), 'tif', 'TIFF'],
    ['PNG', () => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), 'IHDR', zeros(17)), 'png', 'PNG'],
    ['JPEG', () => JPEG, 'jpg', 'JPEG'],
    ['GIF', () => bytes('GIF89a', zeros(20)), 'gif', 'GIF'],
    ['WebP', () => bytes('RIFF', le32(30), 'WEBPVP8 ', zeros(22)), 'webp', 'WebP'],
    ['BMP', () => bytes('BM', le32(70), zeros(4), le32(54), le32(40), zeros(56)), 'bmp', 'BMP'],
    ['AVIF', () => bytes(be32(28), 'ftypavif', zeros(4), 'avifmif1miaf', zeros(8)), 'avif', 'AVIF'],
    ['XLSX by its workbook', () => zipOf({ '[Content_Types].xml': '<Types/>', 'xl/workbook.xml': '<workbook/>' }), 'xlsx', 'XLSX'],
    ['DOCX by its document', () => zipOf({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' }), 'docx', 'DOCX'],
    ['ODS by its mimetype', () => odf('application/vnd.oasis.opendocument.spreadsheet'), 'ods', 'ODS'],
    ['ODT by its mimetype', () => odf('application/vnd.oasis.opendocument.text'), 'odt', 'ODT'],
    ['a data package', () => zipOf({ 'datapackage.json': '{}', 'data.csv': 'a\n1\n' }), 'zip', 'ZIP'],
    ['an archive package of a plan', () => zipOf({ 'paket/metadata/PREMIS.xml': '<premis/>', 'paket/content/plan.json': '{}' }), 'zip', 'ZIP'],
    ['a delivery of an översiktsplan', () => zipOf({ 'op.gpkg': bytes('SQLite format 3', 0), 'Planbeskrivning.docx': bytes('PK') }), 'zip', 'ZIP'],
    ['shapefiles in a ZIP', () => zipOf({ 'lager.shp': bytes(zeros(100)), 'lager.dbf': bytes(zeros(33)) }), 'zip', 'Shapefile (ZIP)'],
    ['BCF in a ZIP', () => zipOf({ 'bcf.version': '<Version/>', '0a1b/markup.bcf': '<Markup/>' }), 'bcfzip', 'BCF'],
    ['a QGIS project in a ZIP', () => zipOf({ 'projekt.qgs': '<qgis/>' }), 'qgz', 'QGIS'],
    ['IFC in a ZIP', () => zipOf({ 'hus.ifc': 'ISO-10303-21;' }), 'ifczip', 'IFCZIP'],
    ['KMZ', () => zipOf({ 'doc.kml': '<kml/>' }), 'kmz', 'KMZ'],
    ['a ZIP the app has no reader for', () => zipOf({ 'readme.txt': 'hej' }), null, ''],
    ['Excel 97-2003 by its Workbook stream', () => ole('Workbook', 'SummaryInformation'), 'xls', 'XLS'],
    ['an OLE2 file without a workbook (Word)', () => ole('WordDocument', '1Table'), null, ''],
    ['Access (Jet)', () => bytes([0, 1, 0, 0], 'Standard Jet DB', 0, zeros(80)), 'mdb', 'Access (MDB)'],
    ['Access (ACE)', () => bytes([0, 1, 0, 0], 'Standard ACE DB', 0, zeros(80)), 'accdb', 'Access (ACCDB)'],
    ['a shapefile', () => bytes(be32(9994), zeros(20), be32(64), le32(1000), le32(1), zeros(64), be32(1), be32(10), le32(1), zeros(16)), 'shp', 'Shapefile'],
    ['a shapefile index is not a shapefile', () => bytes(be32(9994), zeros(20), be32(54), le32(1000), le32(1), zeros(64), be32(50), be32(10)), null, ''],
    ['SPSS', () => bytes('$FL2@(#) SPSS DATA FILE', zeros(40)), 'sav', 'SPSS'],
    ['Stata', () => bytes('<stata_dta><header><release>118</release>'), 'dta', 'Stata'],
    ['SAS', () => bytes(zeros(12), [0xc2, 0xea, 0x81, 0x60, 0xb3, 0x14, 0x11, 0xcf, 0xbd, 0x92, 0x08, 0x00, 0x09, 0xc7, 0x31, 0x8c, 0x18, 0x1f, 0x10, 0x11], zeros(64)), 'sas7bdat', 'SAS'],
    ['SAS transport', () => bytes('HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!000000000000000000000000000000  '), 'xpt', 'SAS XPORT'],
    ['Parquet, at both ends', () => bytes('PAR1', zeros(24), 'PAR1'), 'parquet', 'Parquet'],
    ['Parquet only at the start is not sure', () => bytes('PAR1', zeros(28)), null, ''],
    ['RData', () => bytes('RDX3\nX\n', zeros(20)), 'rdata', 'RData'],
    ['IFC with its FILE_SCHEMA', () => fixtures.ifcText(), 'ifc', 'IFC (IFC4)'],
    ['STEP in another schema is not IFC', () => "ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\n", null, ''],
    ['DXF', () => fixtures.dxfText(), 'dxf', 'DXF'],
    ['a JSON object', () => '{"rader": [{"a": 1}, {"a": 2}]}', 'json', 'JSON'],
    ['a JSON list, after a byte order mark and space', () => '﻿  \n[{"a": 1}, {"a": null}, {"a": true}]', 'json', 'JSON'],
    ['JSON longer than the head, by its start', () => big, 'json', 'JSON'],
    ['a broken start of a long JSON file', () => '[{"a": 1}, {"b": 2,, ' + big, null, ''],
    ['broken JSON', () => '{ inte json', null, ''],
    ['JSON Lines', () => '{"a":1}\n{"a":2}\n{"a":3}\n', 'ndjson', 'NDJSON'],
    ['GeoJSON', () => GEOJSON, 'geojson', 'GeoJSON'],
    ['TopoJSON', () => TOPOJSON, 'topojson', 'TopoJSON'],
    ['the app\'s own format', () => JSON.stringify({ format: 'dataspatium-viz/1', name: 'Diagram' }), 'json', 'JSON (dataspatium-viz/1)'],
    ['XML by its declaration', () => '<?xml version="1.0" encoding="UTF-8"?>\n<!-- lista -->\n<rader><rad a="1"/></rader>', 'xml', 'XML (rader)'],
    ['KML', () => '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>', 'kml', 'KML'],
    ['GPX', () => '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="1" lon="2"/></gpx>', 'gpx', 'GPX'],
    ['GraphML', () => '<?xml version="1.0"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><graph/></graphml>', 'graphml', 'GraphML'],
    ['GEXF', () => '<?xml version="1.0"?><gexf xmlns="http://gexf.net/1.3" version="1.3"><graph/></gexf>', 'gexf', 'GEXF'],
    ['a QGIS project', () => '<!DOCTYPE qgis PUBLIC \'http://mrcc.com/qgis.dtd\' \'SYSTEM\'>\n<qgis version="3.34.0" projectname="">', 'qgs', 'QGIS'],
    ['HTML', () => '<!DOCTYPE html>\n<html lang="sv"><body><table><tr><td>1</td></tr></table></body></html>', 'html', 'HTML'],
    ['Excel 2003 XML', () => '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"></Workbook>', 'xml', 'Excel 2003 XML'],
    ['FODS', () => '<?xml version="1.0"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:mimetype="application/vnd.oasis.opendocument.spreadsheet"></office:document>', 'fods', 'FODS'],
    ['GML', () => '<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"></wfs:FeatureCollection>', 'gml', 'GML'],
    ['WFS capabilities are XML, not GML', () => '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" version="2.0.0"></wfs:WFS_Capabilities>', 'xml', 'XML (WFS_Capabilities)'],
    ['IDS', () => '<?xml version="1.0"?><ids:ids xmlns:ids="http://standards.buildingsmart.org/IDS"></ids:ids>', 'xml', 'IDS'],
    ['SVG is no table', () => '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>', null, ''],
    ['a tag without declaration or namespace is not sure', () => '<b>fet</b> text', null, ''],
    ['a SQL script', () => 'PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\nCREATE TABLE t(a INTEGER, b TEXT);\nINSERT INTO t VALUES(1,\'x\');\nCOMMIT;\n', 'sql', 'SQL'],
    ['LaTeX', () => '% rapport\n\\documentclass{article}\n\\begin{document}\n', 'tex', 'LaTeX'],
    ['PC-Axis', () => 'CHARSET="ANSI";\nAXIS-VERSION="2010";\nMATRIX="BE0101";\nSTUB="region";\nHEADING="år";\nDATA=\n1 2;\n', 'px', 'PC-Axis (PX)'],
    ['Cypher', () => 'CREATE (:Person {namn: "A"});\nCREATE (:Person {namn: "B"});\n', 'cypher', 'Cypher'],
    ['Markdown with a heading and a paragraph', () => '# Rubrik\n\nEtt stycke text.\n', 'md', 'Markdown'],
    ['Markdown with a pipe table', () => 'Län | Folkmängd\n--- | ---:\nUppsala | 400 000\n', 'md', 'Markdown'],
    ['Markdown by its marks', () => 'Inledning med **fet** text.\n\n- en punkt\n- en [länk](https://example.invalid)\n', 'md', 'Markdown'],
    ['a script with comments is not Markdown', () => '# Läs in data\nx <- read.csv("a.csv")\n# Rita\nplot(x)\n', null, ''],
    ['CSV', () => CSV, 'csv', 'CSV'],
    ['TSV', () => 'a\tb\n1\t2\n3\t4\n', 'tsv', 'TSV'],
    ['TSV of two lines, as copied from a spreadsheet', () => 'namn\tvärde\nA\t1\n', 'tsv', 'TSV'],
    ['two lines with one comma are not sure', () => 'namn,värde\nA,1\n', null, ''],
    ['CSV in UTF-16 with a byte order mark', () => bytes([0xff, 0xfe], Array.from('a;b\n1;2\n3;4\n').flatMap((c) => [c.charCodeAt(0), 0])), 'csv', 'CSV'],
    ['an unsure text', () => PROSE, null, ''],
    ['bytes that are not text', () => bytes([1, 2, 0, 0, 7, 255, 3, 0], zeros(40)), null, ''],
  ];
  for (const [what, make, ext, format] of CASES) {
    test(`sniff: ${what}`, async (assert) => {
      const made = await make();
      const got = await sniffer.sniff(new Blob([typeof made === 'string' ? utf8(made) : made]));
      if (ext === null) { assert.equal(got, null, JSON.stringify(got)); return 'null'; }
      assert.ok(got, 'recognised');
      assert.equal(got.ext, ext);
      assert.equal(got.format, format);
      return got.ext;
    });
  }

  test('sniff: Klistra in names the formats a text is recognised as, and each pasted text goes to the importer of its format', async (assert) => {
    const formats = D.require('io/formats');
    const pipeline = D.require('io/import-pipeline');
    const qgis = D.require('io/importers/qgis');
    const pasted = formats.pasted();
    const ids = pasted.map((f) => f.id);
    assert.deepEqual(sniffer.TEXT.filter((id) => !ids.includes(id)), [], 'recognised by io/sniff but not named by Klistra in');
    // The others are found by the pipeline in the JSON that io/sniff recognises (a plan, JSON-stat, SDMX, a graph).
    assert.deepEqual(pasted.filter((f) => !sniffer.TEXT.includes(f.id) && !(f.content && f.ext.includes('json'))).map((f) => f.id), [], 'named but recognised by nothing');
    const sample = (what) => { const c = CASES.find((x) => x[0] === what); return /** @type {string} */ (c[1]()); };
    const TEXTS = {
      ifc: sample('IFC with its FILE_SCHEMA'), dxf: sample('DXF'), ndjson: sample('JSON Lines'), topojson: TOPOJSON, geojson: GEOJSON,
      json: sample('a JSON object'), html: sample('HTML'), kml: sample('KML'), gpx: sample('GPX'), graphml: sample('GraphML'), gexf: sample('GEXF'),
      qgs: sample('a QGIS project'), fods: sample('FODS'), excelxml: sample('Excel 2003 XML'), gml: sample('GML'), xml: sample('XML by its declaration'),
      sql: sample('a SQL script'), tex: sample('LaTeX'), px: sample('PC-Axis'), cypher: sample('Cypher'), md: sample('Markdown with a heading and a paragraph'),
      csv: CSV, tsv: sample('TSV'),
      planjson: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { 'feature:typ': 'detaljplan', beteckning: 'DP 1' }, geometry: null }] }),
      jsonstat: JSON.stringify({ version: '2.0', class: 'dataset', id: ['region'], size: [2], dimension: { region: { category: { index: { '0180': 0, '1280': 1 }, label: { '0180': 'Stockholm', 1280: 'Malmö' } } } }, value: [984748, 362133] }),
      sdmx: JSON.stringify(D.require('tests/fixtures/sdmx').ecbExr),
      nodelink: JSON.stringify({ nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] }),
    };
    for (const f of pasted) {
      assert.ok(TEXTS[f.id], 'a text for ' + f.id);
      const file = await importer.recognise(new File([TEXTS[f.id]], t('import.paste.file')));
      const found = importer.recognisedAs(file);
      assert.ok(found && !found.document, f.id + ': recognised');
      if (sniffer.TEXT.includes(f.id)) assert.equal(found.id, f.id, f.id + ': by io/sniff');
      const got = f.importer === 'qgis' ? (qgis.detect(file) ? 'qgis' : file.name) : (await pipeline.resolve(file)).id;
      assert.equal(got, f.importer, f.id + ': read by its importer');
      if (f.id === 'jsonstat') assert.ok((await importer.preview(file, {})).jsonStat, 'as JSON-stat');
      if (f.id === 'sdmx') assert.equal((await importer.preview(file, {})).statFormat, 'sdmx-json', 'as SDMX-JSON');
    }
    // Text that is none of them is a text document.
    const other = await importer.recognise(new File([PROSE], t('import.paste.file')));
    assert.ok(importer.recognisedAs(other).document, 'other text is a text document');
    return pasted.length + ' formats';
  }, 30000);

  test('recognise: a known extension still decides, as before', async (assert) => {
    const pdfAsCsv = new File([bytes('%PDF-1.7\n')], 'tabell.csv', { type: 'text/csv' });
    assert.equal(await importer.recognise(pdfAsCsv), pdfAsCsv, 'the same file, not renamed');
    const jsonAsText = new File(['[{"a": 1},\n{"a": 2}]\n'], 'punkter.txt', { type: 'text/plain' });
    const p = await importer.preview(jsonAsText, {});
    assert.equal(p.importer, 'csv', 'a .txt is read as text, as today');
    assert.equal(p.recognised, undefined, 'and says nothing about its contents');
    return p.importer;
  });

  test('recognise: a text no signature knows is read as a text document, not as a table, and anything else is not read (F119 a)', async (assert) => {
    const note = new File([PROSE], 'anteckning');
    const renamed = await importer.recognise(note);
    assert.equal(renamed.name, 'anteckning.txt', 'a text is a text, for certain');
    const p = await importer.preview(note, {});
    assert.equal(p.importer, 'documents', 'read as a text document, paragraph by paragraph');
    assert.ok(p.recognisedText, 'and the preview says so');
    const sorted = await importer.sortFiles([note]);
    assert.deepEqual(sorted.groups.map((g) => [g.importer, g.files[0].name]), [['documents', 'anteckning.txt']], 'in a mixed choice it is a document');
    // Bytes that are not text and that no signature knows are not read, with a message.
    const junk = new File([bytes([1, 2, 0, 0, 7, 9])], 'okänt');
    assert.equal(await importer.recognise(junk), junk, 'its name is not changed for a guess (F120 a)');
    const err = await importer.preview(junk, {}).catch((e) => e);
    assert.ok(err instanceof Error && err.message === t('import.err.unrecognised', { name: 'okänt' }), 'refused in words: ' + (err && err.message));
    // A .txt is still read as before: its extension decides.
    assert.equal((await importer.preview(new File([PROSE], 'anteckning.txt', { type: 'text/plain' }), {})).importer, 'csv', 'a named .txt as today');
    // A web address without an extension and with a vague content type keeps a name without one, so that the contents decide.
    const urlImport = D.require('io/url-import');
    assert.equal(urlImport.fileName('https://example.invalid/data/export', 'application/octet-stream'), 'export');
    assert.equal(urlImport.fileName('https://example.invalid/data/export', 'application/json'), 'export.json', 'a content type that says the format still names it');
    return 'ok';
  });

  test('recognise: files without a known name go to the right importer', async (assert) => {
    const geo = new File([GEOJSON], '');
    const p = await importer.preview(geo, {});
    assert.equal(p.importer, 'json');
    assert.equal(p.recognised, 'GeoJSON');
    assert.ok(p.columns.includes('geometry'), 'read as GeoJSON');
    const renamed = await importer.recognise(geo);
    assert.equal(renamed.name, t('datasets.default.name') + '.geojson', 'a nameless file gets the default name');
    assert.equal(renamed.type, 'application/geo+json');
    assert.equal(await importer.recognise(geo), renamed, 'recognised once');
    assert.equal((await importer.preview(new File([TOPOJSON], 'gränser'), {})).importer, 'geo', 'TopoJSON to the map reader');
    const ifc = await importer.preview(new File([fixtures.ifcText()], 'modell.export'), {});
    assert.equal(ifc.importer, 'model', 'an unknown extension counts as none');
    assert.equal(ifc.recognised, 'IFC (IFC4)');
    const dxf = await importer.preview(new File([fixtures.dxfText()], 'ritning'), {});
    assert.equal(dxf.importer, 'model');
    assert.ok(dxf.drawing, 'read as DXF, with its drawing');
    // A Dataspatium file without its name is restored as one.
    const meta = await datasets.create({ name: 'Igenkänd', columns: [{ name: 'a', type: 'integer' }], rows: [[1], [2]] });
    created.push(meta.id);
    const copy = await importer.preview(new File([await datasets.exportBytes(meta.id)], 'kopia'), {});
    assert.equal(copy.importer, 'sqlite');
    assert.equal(copy.recognised, 'SQLite');
    assert.ok(copy.dataspatium, 'a Dataspatium file');
    // The import itself, and a mixed choice.
    const table = await importer.run(new File([CSV], 'befolkning'), {}, null);
    created.push(table.id);
    assert.equal(table.name, 'befolkning');
    assert.equal(table.rowCount, 2);
    const sorted = await importer.sortFiles([new File([CSV], 'tabell'), new File([JPEG], 'bild'), new File([bytes([1, 2, 0, 0])], 'skräp')]);
    assert.deepEqual(sorted.groups.map((g) => [g.importer, g.files[0].name]), [['images', 'bild.jpg'], ['csv', 'tabell.csv']]);
    assert.deepEqual(sorted.skipped.map((f) => f.name), ['skräp']);
    return 'ok';
  }, 30000);

  test('recognise: Inhämta says in the preview what the contents were recognised as', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const t0 = performance.now();
      const until = async (fn, label) => { for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > 8000) throw new Error('timeout waiting for ' + label); await new Promise((r) => setTimeout(r, 30)); } };
      const dz = await until(() => root.querySelector('dm-dropzone'), 'the drop zone');
      dz.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [new File([GEOJSON], 'punkter')] }, bubbles: true }));
      const line = await until(() => root.querySelector('[data-import-recognised]'), 'the line');
      assert.equal(line.textContent, t('import.recognised', { format: 'GeoJSON' }));
      assert.ok(root.textContent.includes('punkter.geojson'), 'the file is shown with the extension it got');
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 30000);

  test('sniff: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
