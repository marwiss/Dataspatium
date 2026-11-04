// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the import formats added in 1.12: tables in HTML, Markdown, Word and LaTeX documents, map files
 * (KML, KMZ, GPX, TopoJSON), more spreadsheet formats read by SheetJS (SYLK, DIF, DBF, FODS, Lotus, Excel 2003
 * XML) and SQL scripts.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const zip = D.require('platform/storage/zip');
  const t = D.require('ui/i18n').t;
  const file = (content, name, type) => new File([content], name, { type: type || '' });
  const values = (p) => p.dataRows.map((r) => r.map((v) => (v === null || v === undefined ? null : v)));

  test('formats3: HTML tables are listed by caption and heading, merged cells repeat and th marks the header', async (assert) => {
    const html = `<!doctype html><html><body>
      <h2>Befolkning</h2>
      <table><caption>Folkmängd per län</caption>
        <thead><tr><th rowspan="2">Län</th><th colspan="2">Folkmängd</th></tr><tr><th>2023</th><th>2024</th></tr></thead>
        <tbody><tr><td>Uppsala</td><td>400 116</td><td>404 589</td></tr><tr><td>Skåne</td><td>1 414 659</td><td>1 428 626</td></tr></tbody>
      </table>
      <h2>Kommuner</h2>
      <table><tr><td>Uppsala</td><td>245000</td></tr><tr><td colspan="2">Summa saknas</td></tr></table>
    </body></html>`;
    const f = file(html, 'tabeller.html', 'text/html');
    const p = await importer.preview(f, {});
    assert.equal(p.importer, 'tables');
    assert.equal(p.tables.length, 2);
    assert.ok(p.tables[0].includes('Folkmängd per län') && p.tables[1].includes('Kommuner'), 'labels from caption and heading: ' + p.tables.join(' | '));
    assert.ok(p.header, 'th row is the header');
    assert.deepEqual(p.columns, ['Län', 'Folkmängd', 'Folkmängd_2'], 'colspan repeats the header; repeated names get a suffix');
    // The first header row names the columns; the second header row stays as the first data row.
    assert.deepEqual(values(p)[0], ['Län', '2023', '2024'], 'rowspan repeats "Län" into the second header row');
    assert.deepEqual(values(p)[1], ['Uppsala', '400 116', '404 589']);
    const second = await importer.preview(f, { table: p.tables[1] });
    assert.ok(!second.header, 'no th, no header');
    assert.deepEqual(values(second)[1], ['Summa saknas', 'Summa saknas'], 'colspan repeats the text');
    return p.tables.join(' | ');
  });

  test('formats3: Markdown pipe tables with headings, alignment rows, escaped pipes and inline markup', async (assert) => {
    const md = '# Rapport\n\nText före.\n\n## Län\n\n| Län | Folkmängd |\n|:----|----:|\n| **Uppsala** | 404 589 |\n| Skåne \\| syd | 1 428 626 |\n\nEn rad med | tecken men ingen tabell.\n\n### Källor\n\nKälla | Länk\n--- | ---\nSCB | [Statistikdatabasen](https://www.statistikdatabasen.scb.se)\n';
    const f = file(md, 'rapport.md', 'text/markdown');
    const p = await importer.preview(f, { format: 'tables' });
    assert.equal(p.importer, 'tables');
    assert.equal(p.tables.length, 2);
    assert.ok(p.tables[0].includes('Län') && p.tables[1].includes('Källor'), p.tables.join(' | '));
    assert.deepEqual(p.columns, ['Län', 'Folkmängd']);
    assert.deepEqual(values(p), [['Uppsala', '404 589'], ['Skåne | syd', '1 428 626']]);
    const meta = await importer.run(f, { format: 'tables', table: p.tables[0] }, null, 'Markdown-test');
    try {
      const handle = await datasets.ensureOpen(meta.id);
      const cols = handle.columns.map((c) => c.name + ':' + c.type);
      assert.ok(cols[0] === 'Län:text' && /^Folkmängd:(integer|number)$/.test(cols[1]), 'Swedish thousands separators give a numeric column: ' + cols.join(', '));
      const first = await handle.engine.exec('select "Folkmängd" from data order by rowid limit 1');
      assert.equal(Number(first[0].values[0][0]), 404589);
    } finally { await datasets.remove(meta.id); }
    const second = await importer.preview(f, { format: 'tables', table: p.tables[1] });
    assert.deepEqual(values(second), [['SCB', 'Statistikdatabasen']], 'link text without the URL');
    return 'ok';
  });

  test('formats3: Word documents give their tables with merged cells, captions and headings', async (assert) => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const p = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
    const tc = (text, pr) => `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ''}${p(text)}</w:tc>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>
      ${p('Befolkning', 'Heading1')}${p('Tabell 1. Folkmängd', 'Caption')}
      <w:tbl><w:tr>${tc('Län')}${tc('År', '<w:gridSpan w:val="2"/>')}</w:tr>
        <w:tr>${tc('Uppsala', '<w:vMerge w:val="restart"/>')}${tc('2023')}${tc('400116')}</w:tr>
        <w:tr>${tc('', '<w:vMerge/>')}${tc('2024')}${tc('404589')}</w:tr></w:tbl>
      ${p('Kommuner', 'Heading2')}
      <w:tbl><w:tr>${tc('Kommun')}${tc('Folkmängd')}</w:tr><w:tr>${tc('Uppsala')}${tc('245000')}</w:tr></w:tbl>
    </w:body></w:document>`;
    const blob = await zip.createZip({ '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', 'word/document.xml': xml });
    const f = file(blob, 'rapport.docx');
    const pr = await importer.preview(f, { format: 'tables' });
    assert.equal(pr.importer, 'tables');
    assert.equal(pr.tables.length, 2);
    assert.ok(pr.tables[0].includes('Tabell 1. Folkmängd') && pr.tables[1].includes('Kommuner'), pr.tables.join(' | '));
    assert.deepEqual(pr.columns, ['Län', 'År', 'År_2'], 'gridSpan repeats the header');
    assert.deepEqual(values(pr), [['Uppsala', '2023', '400116'], ['Uppsala', '2024', '404589']], 'vMerge repeats Uppsala, gridSpan covers two columns');
    const bad = file(await zip.createZip({ 'x.txt': 'hej' }), 'tom.docx');
    let message = '';
    try { await importer.preview(bad, {}); } catch (err) { message = err.message; }
    assert.equal(message, t('import.err.docx'));
    return pr.tables.join(' | ');
  });

  test('formats3: LaTeX tabular environments with booktabs, captions, multicolumn and escapes', async (assert) => {
    const tex = String.raw`\documentclass{article}\usepackage{booktabs}
\begin{document}
\begin{table}[h]\centering
\caption{Befolkning per län}
\begin{tabular}{lrr}
\toprule
Län & 2023 & 2024 \\
\midrule
Uppsala & \num{400116} & \num{404589} \\ % kommentar
\textbf{Skåne} & 1\,414\,659 & 1\,428\,626 \\
Andel \% \& kvot & \multicolumn{2}{c}{\$5 -- 7} \\
\bottomrule
\end{tabular}
\end{table}
\begin{tabular}{|l|l|}\hline a & b \\ \hline c & d \\ \hline\end{tabular}
\end{document}`;
    const f = file(tex, 'tabeller.tex', 'application/x-tex');
    const p = await importer.preview(f, {});
    assert.equal(p.importer, 'tables');
    assert.equal(p.tables.length, 2);
    assert.ok(p.tables[0].includes('Befolkning per län'), p.tables[0]);
    assert.ok(p.header, 'midrule after the first row marks the header');
    assert.deepEqual(p.columns, ['Län', '2023', '2024']);
    assert.deepEqual(values(p), [['Uppsala', '400116', '404589'], ['Skåne', '1 414 659', '1 428 626'], ['Andel % & kvot', '$5 – 7', '$5 – 7']]);
    const second = await importer.preview(f, { table: p.tables[1] });
    assert.deepEqual([second.columns, values(second)], [['a', 'b'], [['c', 'd']]]);
    return 'ok';
  });

  const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Utflykter</name><Folder><name>Uppland</name>
  <Placemark><name>Domkyrkan</name><description><![CDATA[<b>Uppsala</b> domkyrka]]></description>
    <ExtendedData><Data name="byggd"><value>1435</value></Data><SchemaData><SimpleData name="kommun">Uppsala</SimpleData></SchemaData></ExtendedData>
    <Point><coordinates>17.6343,59.8581,0</coordinates></Point></Placemark>
  <Placemark><name>Promenad</name><LineString><coordinates>17.63,59.85 17.64,59.86 17.65,59.86</coordinates></LineString></Placemark>
  <Placemark><name>Park</name><Polygon><outerBoundaryIs><LinearRing><coordinates>17.6,59.8 17.7,59.8 17.7,59.9 17.6,59.8</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>Öar</name><MultiGeometry><Point><coordinates>18,59</coordinates></Point><Point><coordinates>18.1,59.1</coordinates></Point></MultiGeometry></Placemark>
</Folder></Document></kml>`;

  test('formats3: KML and KMZ placemarks become rows with folder, extended data and GeoJSON geometry', async (assert) => {
    const p = await importer.preview(file(KML, 'utflykter.kml'), {});
    assert.equal(p.importer, 'geo');
    assert.deepEqual(p.layers, [t('import.geo.layer.placemarks')]);
    assert.deepEqual(p.columns, ['name', 'description', 'folder', 'byggd', 'kommun', 'geometry_type', 'geometry']);
    const rows = values(p);
    assert.deepEqual(rows[0].slice(0, 6), ['Domkyrkan', 'Uppsala domkyrka', 'Utflykter / Uppland', '1435', 'Uppsala', 'Point']);
    assert.deepEqual(JSON.parse(rows[0][6]), { type: 'Point', coordinates: [17.6343, 59.8581] });
    assert.deepEqual(rows.map((r) => r[5]), ['Point', 'LineString', 'Polygon', 'MultiPoint']);
    assert.equal(JSON.parse(rows[3][6]).coordinates.length, 2);
    const kmz = file(await zip.createZip({ 'doc.kml': KML, 'files/ikon.png': new Uint8Array([1, 2, 3]) }), 'utflykter.kmz');
    const pk = await importer.preview(kmz, {});
    assert.equal(pk.importer, 'geo');
    assert.equal(pk.totalRows, 4);
    const meta = await importer.run(kmz, {}, null, 'KMZ-test');
    try {
      const handle = await datasets.ensureOpen(meta.id);
      assert.equal(handle.meta.rowCount, 4);
      assert.ok(handle.columns.some((c) => c.name === 'geometry'), 'geometry column');
    } finally { await datasets.remove(meta.id); }
    return 'ok';
  });

  test('formats3: GPX waypoints, routes, tracks and track points are separate layers', async (assert) => {
    const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
      <wpt lat="59.8581" lon="17.6343"><ele>25</ele><name>Domkyrkan</name><sym>Church</sym></wpt>
      <wpt lat="59.8586" lon="17.6389"><name>Slottet</name></wpt>
      <rte><name>Stadsvandring</name><rtept lat="59.85" lon="17.63"/><rtept lat="59.86" lon="17.64"/><rtept lat="59.86" lon="17.65"/></rte>
      <trk><name>Löprunda</name><type>running</type>
        <trkseg><trkpt lat="59.0" lon="18.0"><ele>10</ele><time>2026-05-01T08:00:00Z</time></trkpt><trkpt lat="59.01" lon="18.0"><ele>12</ele><time>2026-05-01T08:05:00Z</time></trkpt></trkseg>
        <trkseg><trkpt lat="59.02" lon="18.0"/><trkpt lat="59.03" lon="18.0"/></trkseg></trk></gpx>`;
    const f = file(gpx, 'runda.gpx');
    const p = await importer.preview(f, {});
    assert.equal(p.importer, 'geo');
    assert.deepEqual(p.layers, ['waypoints', 'routes', 'tracks', 'trackpoints'].map((k) => t('import.geo.layer.' + k)));
    assert.equal(p.totalRows, 2, 'two waypoints');
    const tracks = await importer.preview(f, { layer: t('import.geo.layer.tracks') });
    const tr = Object.fromEntries(tracks.columns.map((c, i) => [c, tracks.dataRows[0][i]]));
    assert.equal(tr.name, 'Löprunda');
    assert.equal(tr.segments, 2);
    assert.equal(tr.points, 4);
    assert.ok(Math.abs(tr.length_km - 2.224) < 0.01, 'length over both segments: ' + tr.length_km);
    assert.equal(JSON.parse(tr.geometry).type, 'MultiLineString');
    const pts = await importer.preview(f, { layer: t('import.geo.layer.trackpoints') });
    assert.deepEqual(pts.columns, ['track', 'segment', 'point', 'lon', 'lat', 'ele', 'time']);
    assert.equal(pts.totalRows, 4);
    assert.deepEqual(values(pts)[1], ['Löprunda', 1, 2, 18, 59.01, 12, '2026-05-01T08:05:00Z']);
    return p.layers.join(', ');
  });

  test('formats3: TopoJSON objects become layers, quantized arcs are decoded, and a .json topology is recognised', async (assert) => {
    const topo = {
      type: 'Topology',
      transform: { scale: [0.001, 0.001], translate: [17, 59] },
      arcs: [[[0, 0], [1000, 0], [0, 1000], [-1000, 0], [0, -1000]]],
      objects: {
        lan: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]], id: '03', properties: { namn: 'Uppsala län' } }] },
        orter: { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [634, 858], properties: { namn: 'Uppsala' } }] },
      },
    };
    const p = await importer.preview(file(JSON.stringify(topo), 'karta.topojson'), {});
    assert.equal(p.importer, 'geo');
    assert.deepEqual(p.layers, ['lan', 'orter']);
    assert.deepEqual(p.columns, ['id', 'namn', 'geometry_type', 'geometry']);
    const ring = JSON.parse(values(p)[0][3]).coordinates[0];
    assert.deepEqual(ring.map((c) => c.map((v) => Math.round(v * 1000) / 1000)), [[17, 59], [18, 59], [18, 60], [17, 60], [17, 59]]);
    const asJson = await importer.preview(file(JSON.stringify(topo), 'karta.json', 'application/json'), { layer: 'orter' });
    assert.equal(asJson.importer, 'geo', 'a topology in a .json file goes to the map importer');
    assert.deepEqual(JSON.parse(values(asJson)[0][2]).coordinates.map((v) => Math.round(v * 1000) / 1000), [17.634, 59.858]);
    const plain = await importer.preview(file('{"rader": [{"a": 1}]}', 'vanlig.json', 'application/json'), {});
    assert.equal(plain.importer, 'json', 'ordinary JSON stays with the JSON importer');
    return 'ok';
  });

  test('formats3: SYLK, DIF, DBF, FODS, Lotus and Excel 2003 XML open as spreadsheets', async (assert) => {
    await D.assets.loadVendorScript('vendor/sheetjs/xlsx.full.min.js');
    const XLSX = /** @type {any} */ (globalThis).XLSX;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['kommun', 'folkmangd', 'andel'], ['Uppsala', 245000, 2.5], ['Gnosjo', 9600, 0.1]]), 'Blad1');
    const done = [];
    for (const [bookType, ext] of [['sylk', 'slk'], ['dif', 'dif'], ['dbf', 'dbf'], ['fods', 'fods'], ['wk1', 'wk1'], ['wk3', 'wk3'], ['xlml', 'xml']]) {
      const bytes = XLSX.write(wb, { bookType, type: 'array' });
      const p = await importer.preview(file(bytes, 'kommuner.' + ext), {});
      assert.equal(p.importer, 'excel', ext + ' uses the spreadsheet importer');
      assert.deepEqual(p.columns.map((c) => c.toLowerCase()), ['kommun', 'folkmangd', 'andel'], ext + ' columns');
      assert.deepEqual(values(p)[0].slice(0, 2), ['Uppsala', 245000], ext + ' values');
      done.push(ext);
    }
    return done.join(', ');
  });

  test('formats3: SQL scripts run in a new database and offer their tables, also simple MySQL dumps', async (assert) => {
    const sql = "CREATE TABLE lan (kod TEXT PRIMARY KEY, namn TEXT);\nINSERT INTO lan VALUES ('01', 'Stockholms län'), ('03', 'Uppsala län');\nCREATE TABLE kommun (kod TEXT, namn TEXT, folkmangd INTEGER);\nINSERT INTO kommun VALUES ('0380', 'Uppsala', 245000);\nCREATE VIEW stora AS SELECT * FROM kommun WHERE folkmangd > 100000;\n";
    const p = await importer.preview(file(sql, 'kommuner.sql', 'application/sql'), {});
    assert.equal(p.importer, 'sqlite');
    assert.deepEqual(p.tables, ['kommun', 'lan', 'stora']);
    const lan = await importer.preview(file(sql, 'kommuner.sql'), { table: 'lan' });
    assert.deepEqual(values(lan), [['01', 'Stockholms län'], ['03', 'Uppsala län']], 'codes keep their leading zeros');
    const mysql = "-- MySQL dump\n/*!40101 SET NAMES utf8mb4 */;\nSET time_zone = '+00:00';\nDROP TABLE IF EXISTS `matning`;\nCREATE TABLE `matning` (\n  `id` int(11) NOT NULL,\n  `varde` decimal(6,2) DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\nLOCK TABLES `matning` WRITE;\nINSERT INTO `matning` VALUES (1,2.50),(2,3.75);\nUNLOCK TABLES;\n";
    const m = await importer.preview(file(mysql, 'dump.sql'), {});
    assert.deepEqual(m.tables, ['matning']);
    assert.deepEqual(values(m), [[1, 2.5], [2, 3.75]]);
    let message = '';
    try { await importer.preview(file('CREATE TABLE x (a int);\nINSERT INTO saknas VALUES (1);', 'fel.sql'), {}); } catch (err) { message = err.message; }
    assert.ok(message.startsWith(t('import.err.sqlscript', { message: '' }).trim().replace(/:$/, '')), message);
    return 'ok';
  });
})();
