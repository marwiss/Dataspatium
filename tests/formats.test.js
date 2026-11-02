// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the phase 7 formats: XML, JSON-stat files, SQLite, ODS, the portable folder (with an in-memory
 * directory standing in for File System Access) and SPSS, Parquet, RDS and PX through R.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const datasets = D.require('data/datasets');
  const workspace = D.require('data/workspace');
  const folder = D.require('platform/storage/folder');
  const sqlite = D.require('engines/sqlite');
  const rFormats = D.require('io/importers/r-formats');
  const created = [];
  const CSV = 'kommun;kod;befolkning;andel;datum;aktiv\r\nStockholm;0180;984748;9,37;2024-12-31;ja\r\nGöteborg;1480;596841;5,68;2024-12-31;nej\r\nMalmö;1280;362133;3,45;2024-12-31;ja\r\n';
  const TYPES = ['text', 'text', 'integer', 'number', 'date', 'boolean'];
  async function baseDataset(name) {
    const meta = await importer.run(new File([CSV], 'formattest.csv', { type: 'text/csv' }), {}, null, name);
    created.push(meta.id);
    return meta;
  }
  const XML = '<?xml version="1.0" encoding="UTF-8"?>\n<kommuner uppdaterad="2025-01-01">\n'
    + '  <kommun kod="0180"><namn>Stockholm</namn><befolkning>984748</befolkning><lage><lan>Stockholms län</lan></lage></kommun>\n'
    + '  <kommun kod="1480"><namn>Göteborg</namn><befolkning>596841</befolkning><lage><lan>Västra Götalands län</lan></lage></kommun>\n'
    + '  <kommun kod="1280"><namn>Malmö</namn><befolkning>362133</befolkning><lage><lan>Skåne län</lan></lage></kommun>\n</kommuner>\n';

  test('formats: XML import finds the repeated element and flattens attributes and nested elements', async (assert) => {
    const file = new File([XML], 'kommuner.xml', { type: 'application/xml' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'xml');
    assert.equal(p.recordTag, 'kommun');
    assert.deepEqual(p.columns, ['kod', 'namn', 'befolkning', 'lage.lan']);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'text', 'integer', 'text']);
    const meta = await importer.run(file, {}, null, 'XML-kommuner');
    created.push(meta.id);
    assert.equal(meta.rowCount, 3);
    const rows = await datasets.query(meta.id, { orderBy: 'befolkning', dir: 'desc' });
    assert.deepEqual(rows[0], ['0180', 'Stockholm', 984748, 'Stockholms län']);
    const root = await importer.preview(file, { recordTag: 'kommuner' });
    assert.equal(root.totalRows, 1, 'the root element can be chosen as the record');
    return p.columns.join(',');
  });

  test('formats: XML export re-imports with identical values and types', async (assert) => {
    const meta = await baseDataset('XML-rundtur');
    const { blob, filename } = await exporter.exportDataset(meta.id, 'xml');
    assert.ok(filename.endsWith('.xml'), filename);
    const text = await blob.text();
    assert.ok(text.startsWith('<?xml') && text.includes('<rad>') && text.includes('<kommun>Göteborg</kommun>'), text.slice(0, 300));
    const p = await importer.preview(new File([text], filename, { type: 'application/xml' }), {});
    assert.equal(p.recordTag, 'rad', 'rows win over the column list: ' + JSON.stringify(p.pathSuggestions));
    const back = await importer.run(new File([text], filename, { type: 'application/xml' }), {}, null, 'XML tillbaka');
    created.push(back.id);
    assert.equal(back.rowCount, 3);
    const cols = await datasets.columns(back.id);
    assert.deepEqual(cols.map((c) => c.name), ['kommun', 'kod', 'befolkning', 'andel', 'datum', 'aktiv']);
    assert.deepEqual(cols.map((c) => c.type), TYPES);
    assert.deepEqual(await datasets.query(back.id, { orderBy: 'kommun' }), await datasets.query(meta.id, { orderBy: 'kommun' }));
  });

  test('formats: ODS export re-imports with identical values and types', async (assert) => {
    const meta = await baseDataset('ODS-rundtur');
    const { blob, filename } = await exporter.exportDataset(meta.id, 'ods');
    assert.ok(filename.endsWith('.ods'), filename);
    assert.equal(blob.type, 'application/vnd.oasis.opendocument.spreadsheet');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'ODS is a ZIP container');
    const back = await importer.run(new File([blob], filename), {}, null, 'ODS tillbaka');
    created.push(back.id);
    assert.equal(back.rowCount, 3);
    const cols = await datasets.columns(back.id);
    assert.deepEqual(cols.map((c) => c.type), TYPES);
    assert.deepEqual(await datasets.query(back.id, { orderBy: 'kommun' }), await datasets.query(meta.id, { orderBy: 'kommun' }));
  }, 40000);

  test('formats: JSON-stat files become one row per cell', async (assert) => {
    const stat = {
      version: '2.0', class: 'dataset', label: 'Folkmängd', id: ['region', 'tid'], size: [2, 2],
      dimension: {
        region: { label: 'region', category: { index: { '0180': 0, '1480': 1 }, label: { '0180': 'Stockholm', '1480': 'Göteborg' } } },
        tid: { label: 'år', category: { index: { 2020: 0, 2021: 1 }, label: { 2020: '2020', 2021: '2021' } } },
      },
      value: [975551, 978770, 583056, 587549],
    };
    const file = new File([JSON.stringify(stat)], 'folkmangd.json', { type: 'application/json' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'json');
    assert.ok(p.jsonStat, 'detected as JSON-stat');
    assert.equal(p.totalRows, 4);
    const meta = await importer.run(file, {}, null, 'JSON-stat');
    created.push(meta.id);
    const rows = await datasets.query(meta.id);
    assert.equal(rows.length, 4);
    const flat = rows.flat().map(String);
    assert.ok(flat.includes('Stockholm') && flat.includes('975551') && flat.includes('2021'), JSON.stringify(rows));
    const plain = await importer.preview(new File([JSON.stringify([{ a: 1 }, { a: 2 }])], 'plain.json'), {});
    assert.ok(!plain.jsonStat, 'a plain array takes the ordinary path');
    return p.columns.join(',');
  });

  test('formats: SQLite import reads a plain table with declared types and restores a Dataspatium file', async (assert) => {
    const engine = new sqlite.SqliteEngine();
    await engine.start();
    await engine.open();
    await engine.run('create table kommuner (kod text, namn text, befolkning integer, andel real)');
    await engine.run('insert into kommuner values (?, ?, ?, ?)', ['0180', 'Stockholm', 984748, 9.37]);
    await engine.run('insert into kommuner values (?, ?, ?, ?)', ['1480', 'Göteborg', 596841, 5.68]);
    await engine.run('insert into kommuner values (?, ?, ?, ?)', ['1280', 'Malmö', 362133, 3.45]);
    const bytes = await engine.export();
    engine.terminate();
    const file = new File([bytes], 'kommuner.db', { type: 'application/vnd.sqlite3' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'sqlite');
    assert.deepEqual(p.tables, ['kommuner']);
    assert.equal(p.dataspatium, false);
    assert.deepEqual(p.inferred.map((c) => c.type), ['text', 'text', 'integer', 'number']);
    const meta = await importer.run(file, {}, null, 'SQLite-tabell');
    created.push(meta.id);
    assert.equal(meta.rowCount, 3);
    assert.deepEqual((await datasets.query(meta.id, { orderBy: 'kod' }))[0], ['0180', 'Stockholm', 984748, 9.37]);
    // A Dataspatium file (tables data, _columns, _meta, _log) comes back with its metadata.
    const own = await baseDataset('SQLite-egen');
    const ownFile = new File([await datasets.exportBytes(own.id)], 'egen.sqlite');
    const p2 = await importer.preview(ownFile, {});
    assert.equal(p2.dataspatium, true);
    assert.equal(p2.datasetName, 'SQLite-egen');
    assert.deepEqual(p2.columns, ['kommun', 'kod', 'befolkning', 'andel', 'datum', 'aktiv']);
    const restored = await importer.run(ownFile, {}, null, 'SQLite-egen kopia');
    created.push(restored.id);
    assert.ok(restored.id !== own.id, 'a new id since the original still exists');
    assert.equal(restored.name, 'SQLite-egen kopia');
    assert.deepEqual((await datasets.columns(restored.id)).map((c) => c.type), TYPES);
    assert.deepEqual(await datasets.query(restored.id, { orderBy: 'kommun' }), await datasets.query(own.id, { orderBy: 'kommun' }));
  }, 40000);

  /** In-memory stand-in for a FileSystemDirectoryHandle (the subset platform/storage/folder uses). */
  function memoryDirectory(name) {
    const files = new Map(); const dirs = new Map();
    const concat = (chunks) => { const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0)); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; };
    return {
      kind: 'directory', name,
      async getDirectoryHandle(n, opts = {}) { if (!dirs.has(n)) { if (!opts.create) throw new DOMException('Not found: ' + n, 'NotFoundError'); dirs.set(n, memoryDirectory(n)); } return dirs.get(n); },
      async getFileHandle(n, opts = {}) {
        if (!files.has(n)) { if (!opts.create) throw new DOMException('Not found: ' + n, 'NotFoundError'); files.set(n, new Uint8Array(0)); }
        return {
          kind: 'file', name: n,
          async getFile() { return new File([files.get(n)], n); },
          async createWritable() {
            const chunks = [];
            return { async write(d) { chunks.push(d instanceof Uint8Array ? d : new Uint8Array(await new Blob([d]).arrayBuffer())); }, async close() { files.set(n, concat(chunks)); } };
          },
        };
      },
      async removeEntry(n) { if (!files.delete(n) && !dirs.delete(n)) throw new DOMException('Not found: ' + n, 'NotFoundError'); },
      async *entries() { for (const [n, d] of dirs) yield [n, d]; for (const [n] of files) yield [n, { kind: 'file', name: n }]; },
      async queryPermission() { return 'granted'; },
    };
  }

  test('formats: portable folder saves the workspace as files, reloads missing datasets and prunes removed ones', async (assert) => {
    const root = memoryDirectory('Dataspatium-mapp');
    const meta = await baseDataset('Mapptest');
    const first = await workspace.saveToFolder(root);
    assert.ok(first.written >= 1, 'wrote ' + first.written);
    const paths = await folder.listFiles(root);
    assert.ok(paths.includes('manifest.json'), paths.join(','));
    assert.ok(paths.includes(`datasets/${meta.id}.sqlite`), paths.join(','));
    const manifest = JSON.parse(new TextDecoder().decode(await folder.readFile(root, 'manifest.json')));
    assert.ok(manifest.datasets.some((d) => d.id === meta.id && d.name === 'Mapptest'), 'manifest lists the dataset');
    const second = await workspace.saveToFolder(root);
    assert.equal(second.written, 0, 'unchanged datasets are not rewritten');
    // Remove the dataset from the workspace and get it back from the folder, with the same id.
    await datasets.remove(meta.id);
    created.splice(created.indexOf(meta.id), 1);
    const loaded = await workspace.loadFromFolder(root);
    assert.equal(loaded.imported.length, 1);
    assert.equal(loaded.imported[0].id, meta.id);
    created.push(meta.id);
    assert.equal((await datasets.query(meta.id)).length, 3);
    const again = await workspace.loadFromFolder(root);
    assert.equal(again.imported.length, 0, 'loading again skips what exists');
    assert.ok(again.existing >= 1);
    // Removing the dataset and saving prunes its file.
    await datasets.remove(meta.id);
    created.splice(created.indexOf(meta.id), 1);
    const pruned = await workspace.saveToFolder(root);
    assert.ok(pruned.removed >= 1, 'removed ' + pruned.removed);
    assert.ok(!(await folder.listFiles(root)).includes(`datasets/${meta.id}.sqlite`), 'file pruned');
    assert.ok(!folder.supported() || typeof globalThis.showDirectoryPicker === 'function');
    return paths.join(', ');
  }, 40000);

  test('formats via R: SPSS, Parquet and RDS round trips keep values and types', async (assert) => {
    const meta = await baseDataset('R-rundtur');
    const results = {};
    for (const fmt of ['sav', 'parquet', 'rds']) {
      const { blob, filename } = await exporter.exportDataset(meta.id, fmt);
      assert.ok(blob.size > 100, `${fmt}: ${blob.size} bytes`);
      const back = await importer.run(new File([blob], filename), {}, null, `R-rundtur ${fmt}`);
      created.push(back.id);
      assert.equal(back.rowCount, 3, fmt + ' rows');
      const cols = await datasets.columns(back.id);
      assert.deepEqual(cols.map((c) => c.name), ['kommun', 'kod', 'befolkning', 'andel', 'datum', 'aktiv'], fmt + ' columns');
      const rows = await datasets.query(back.id, { orderBy: 'kommun' });
      assert.equal(rows[0][0], 'Göteborg', fmt);
      assert.equal(rows[0][1], '1480', fmt + ': kod stays text');
      assert.equal(Number(rows[0][2]), 596841, fmt);
      assert.ok(Math.abs(Number(rows[0][3]) - 5.68) < 1e-9, fmt + ' andel ' + rows[0][3]);
      assert.equal(rows[0][4], '2024-12-31', fmt + ' date');
      results[fmt] = cols.map((c) => c.type).join('/');
    }
    assert.equal(results.parquet, TYPES.join('/'));
    assert.equal(results.rds, TYPES.join('/'));
    // SPSS has no logical type and stores all numbers as doubles.
    assert.ok(/^text\/text\/(integer|number)\/number\/date\/(integer|number)$/.test(results.sav), 'sav types ' + results.sav);
    return JSON.stringify(results);
  }, 300000);

  const PX = ['CHARSET="ANSI";', 'AXIS-VERSION="2000";', 'CODEPAGE="utf-8";', 'LANGUAGE="sv";', 'DECIMALS=0;', 'SUBJECT-AREA="Befolkning";',
    'SUBJECT-CODE="BE";', 'MATRIX="BE0101TEST";', 'TITLE="Folkmängd efter region och år";', 'CONTENTS="Folkmängd";', 'UNITS="antal";',
    'STUB="region";', 'HEADING="år";', 'VALUES("region")="Stockholm","Göteborg";', 'VALUES("år")="2020","2021";', 'DATA=', '975551 978770', '583056 587549;'].join('\r\n') + '\r\n';

  test('formats via R: a PX file (SCB) imports as a long table with Swedish labels intact', async (assert) => {
    const file = new File([PX], 'be0101test.px');
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'r');
    assert.ok(p.viaR && p.pkg === 'pxR', JSON.stringify(p));
    const utf8 = new TextDecoder().decode(rFormats.pxToUtf8(new TextEncoder().encode(PX)));
    assert.ok(/CODEPAGE="utf-8";/.test(utf8) && utf8.includes('Göteborg'), utf8.slice(0, 120));
    const latin = rFormats.pxToUtf8(new Uint8Array([...new TextEncoder().encode('CHARSET="ANSI";\nTITLE="'), 0xe5, 0xe4, 0xf6, ...new TextEncoder().encode('";\n')]));
    assert.ok(new TextDecoder().decode(latin).includes('TITLE="åäö"'), 'ANSI files are decoded as Windows-1252');
    const meta = await importer.run(file, {}, null, 'PX-test');
    created.push(meta.id);
    assert.equal(meta.rowCount, 4);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.name).sort(), ['region', 'value', 'år'].sort());
    const rows = await datasets.query(meta.id, { orderBy: 'value', dir: 'desc' });
    const top = rows[0].map(String);
    assert.ok(top.includes('Stockholm') && top.includes('2021') && top.includes('978770'), JSON.stringify(rows));
    return cols.map((c) => c.name + ':' + c.type).join(', ');
  }, 240000);

  test('formats: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* already removed */ } }
    assert.ok(true);
    return created.length + ' datasets removed';
  });
})();
