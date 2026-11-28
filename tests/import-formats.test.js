// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Filer and Klistra in in Inhämta (PLAN 12 c and d): the formats by group under the drop zone from the table of formats
 * (io/formats), Välj mapp under Fler alternativ, folders dropped with a stubbed webkitGetAsEntry (a folder with folders in it and a
 * shapefile with its parts), the list of Klistra in by group, and pasted JSON, XML, HTML, STEP and Markdown read as the format and
 * kind they are. tests/io.test.js keeps the table with the importers, tests/sniff.test.js the list of Klistra in with io/sniff.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const formats = D.require('io/formats');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const kinds = D.require('data/kinds');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
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
  const button = (root, text) => Array.from(root.querySelectorAll('.dm-center dm-button')).find((b) => b.textContent.trim() === text);
  const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();
  /** The groups and formats of a dm-kv list as the person reads them. */
  const listed = (kv) => ({ groups: Array.from(kv.querySelectorAll('dt')).map((e) => e.textContent), formats: Array.from(kv.querySelectorAll('dd')).map((e) => e.textContent) });
  const expected = (groups) => ({ groups: groups.map((g) => t('import.formats.group.' + g.group)), formats: groups.map((g) => g.formats.map(formats.nameOf).join(', ')) });

  /** A polygon shapefile (type 5) with one ring, and a dBASE III table (as in tests/maps.test.js). */
  function buildShp(ring) {
    const contentLen = 4 + 32 + 4 + 4 + 4 + ring.length * 16;
    const out = new Uint8Array(100 + 8 + contentLen); const dv = new DataView(out.buffer);
    dv.setInt32(0, 9994, false); dv.setInt32(24, out.length / 2, false); dv.setInt32(28, 1000, true); dv.setInt32(32, 5, true);
    let p = 100; dv.setInt32(p, 1, false); dv.setInt32(p + 4, contentLen / 2, false); p += 8;
    dv.setInt32(p, 5, true); p += 4;
    const xs = ring.map((c) => c[0]); const ys = ring.map((c) => c[1]);
    dv.setFloat64(p, Math.min(...xs), true); dv.setFloat64(p + 8, Math.min(...ys), true); dv.setFloat64(p + 16, Math.max(...xs), true); dv.setFloat64(p + 24, Math.max(...ys), true); p += 32;
    dv.setInt32(p, 1, true); dv.setInt32(p + 4, ring.length, true); dv.setInt32(p + 8, 0, true); p += 12;
    for (const [x, y] of ring) { dv.setFloat64(p, x, true); dv.setFloat64(p + 8, y, true); p += 16; }
    return out;
  }
  function buildDbf(name, value) {
    const length = 10; const headerLength = 32 + 32 + 1; const recordLength = 1 + length;
    const out = new Uint8Array(headerLength + recordLength + 1); const dv = new DataView(out.buffer);
    out[0] = 0x03; dv.setUint32(4, 1, true); dv.setUint16(8, headerLength, true); dv.setUint16(10, recordLength, true);
    for (let k = 0; k < name.length; k++) out[32 + k] = name.charCodeAt(k);
    out[32 + 11] = 'C'.charCodeAt(0); out[32 + 16] = length; out[64] = 0x0d;
    out.fill(0x20, headerLength, headerLength + recordLength);
    out.set(new TextEncoder().encode(value), headerLength + 1);
    out[out.length - 1] = 0x1a;
    return out;
  }
  const PRJ = 'PROJCS["SWEREF99_TM",GEOGCS["GCS_SWEREF99",DATUM["D_SWEREF99",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],UNIT["Meter",1.0]]';
  const RING = [[600000, 6500000], [600000, 6501000], [601000, 6501000], [601000, 6500000], [600000, 6500000]];

  test('import formats: Inhämta lists what it reads by group under the drop zone, and Välj mapp is under Fler alternativ', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      assert.equal(zone.getAttribute('accept'), formats.accept(), 'the picker offers the table of formats');
      assert.ok(zone.textContent.includes(t('import.drop')), 'files and folders can be dropped');
      const list = await waitFor(() => root.querySelector('.dm-center [data-import-formats]'), 3000, 'the formats');
      const groups = formats.grouped();
      assert.deepEqual(groups.map((g) => g.group), ['models', 'plans', 'geo', 'tables', 'databases', 'stats', 'documents', 'images', 'graphs'], 'by purpose, in order');
      assert.deepEqual(listed(list), expected(groups));
      const shown = listed(list).formats;
      assert.ok(['IFC', 'IFCZIP', 'DXF'].every((n) => shown[0].includes(n)), 'the building models: ' + shown[0]);
      assert.ok(['GeoJSON', 'KML', 'GPX', 'GeoPackage', 'GeoTIFF'].every((n) => shown[2].includes(n)), 'geodata and maps: ' + shown[2]);
      // Välj mapp is there for the keyboard, under Fler alternativ only.
      const more = /** @type {HTMLDetailsElement} */ (root.querySelector('.dm-center details.dm-more[data-import-more]'));
      assert.ok(more && more.querySelector('summary').textContent === t('common.more'), 'Fler alternativ');
      const folders = Array.from(root.querySelectorAll('.dm-center dm-button')).filter((b) => b.textContent.trim() === t('import.folder'));
      assert.equal(folders.length, 1, 'one Välj mapp');
      assert.ok(more.contains(folders[0]), 'under Fler alternativ');
      assert.ok(!more.open, 'folded until it is opened');
    });
    return 'ok';
  }, 30000);

  test('import formats: dropped folders are read whole with the folders in them, and a shapefile\'s parts go with its .shp', async (assert) => {
    const fileEntry = (file) => ({ isFile: true, isDirectory: false, name: file.name, file: (ok) => ok(file) });
    /** A folder whose reader gives its entries in two parts, then an empty one. */
    const dirEntry = (name, children) => ({ isFile: false, isDirectory: true, name, createReader: () => { const parts = [children.slice(0, 1), children.slice(1)]; let i = 0; return { readEntries: (ok) => ok(parts[i++] || []) }; } });
    const karta = dirEntry('karta', [new File([buildShp(RING)], 'rutor.shp'), new File([buildDbf('NAMN', 'Ruta')], 'rutor.dbf'), new File([PRJ], 'rutor.prj'), new File([new Uint8Array(100)], 'rutor.shx'), new File(['UTF-8'], 'rutor.cpg')].map(fileEntry));
    const texter = dirEntry('texter', [fileEntry(new File(['# Anteckning\n\nText om rutan.\n'], 'anteckning.md'))]);
    const folder = dirEntry('Undersökning', [fileEntry(new File(['kommun;antal\nLund;1\nUmeå;2\n'], 'punkter.csv')), karta, texter]);
    const loose = new File(['x;y\n1;2\n3;4\n'], 'extra.csv');
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      const got = new Promise((resolve) => zone.addEventListener('dm-files', (e) => resolve(/** @type {any} */ (e).detail.files), { once: true }));
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: { files: [loose], items: [{ webkitGetAsEntry: () => folder }, { webkitGetAsEntry: () => fileEntry(loose) }] } });
      zone.dispatchEvent(drop);
      const files = await got;
      assert.deepEqual(files.map((f) => f.dmPath), ['Undersökning/punkter.csv', 'Undersökning/karta/rutor.shp', 'Undersökning/karta/rutor.dbf', 'Undersökning/karta/rutor.prj',
        'Undersökning/karta/rutor.shx', 'Undersökning/karta/rutor.cpg', 'Undersökning/texter/anteckning.md', 'extra.csv'], 'every file, in the folders below too');
      // Inhämta sorts them: the shapefile with its parts as one, each table and the document.
      await waitFor(() => root.querySelectorAll('.dm-center .dm-sort-row').length === 4, 8000, 'four rows');
      assert.ok(!root.textContent.includes('rutor.prj') && !root.textContent.includes('rutor.dbf'), 'the parts are neither datasets nor unread');
      const sorted = await importer.sortFiles(files);
      assert.deepEqual(sorted.groups.map((g) => [g.importer, g.files.map((f) => f.name).join(' ')]), [['documents', 'anteckning.md'], ['csv', 'punkter.csv'], ['shapefile', 'rutor.shp'], ['csv', 'extra.csv']]);
      assert.deepEqual(sorted.skipped.map((f) => f.name), [], 'nothing left unread');
      const p = await importer.preview(sorted.groups[2].files[0], {});
      assert.deepEqual(p.columns, ['NAMN', 'geometry_type', 'geometry'], 'the attributes of the dbf beside it');
      assert.equal(p.crs, 'SWEREF99_TM', 'the coordinate system of the prj beside it');
      assert.equal(p.dataRows[0][0], 'Ruta');
    });
    return 'ok';
  }, 30000);

  test('import formats: Klistra in names what it recognises by group, and a pasted text goes on as the format it is', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      click(await waitFor(() => root.querySelector('.dm-left [data-source="paste"]'), 5000, 'Klistra in'));
      const list = await waitFor(() => root.querySelector('.dm-center [data-paste-formats]'), 5000, 'the list');
      const groups = formats.grouped((f) => !!f.text);
      assert.deepEqual(listed(list), expected(groups), 'the formats a text is recognised as, by group');
      const all = listed(list).formats.join(', ');
      assert.ok(['JSON', 'XML', 'IFC', 'Markdown', 'TSV', 'GeoJSON', 'GraphML'].every((n) => all.includes(n)), all);
      const paste = async (text) => {
        const box = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-center dm-input[type="textarea"]'), 5000, 'the text box'));
        box.value = text;
        click(await waitFor(() => button(root, t('import.paste.use')), 3000, 'Använd texten'));
        return waitFor(() => root.querySelector('.dm-center [data-paste-recognised]'), 8000, 'what the text is');
      };
      // JSON is read as JSON, and the dataset says it was pasted.
      let line = await paste('{"rader": [{"kommun": "Lund", "antal": 1}, {"kommun": "Umeå", "antal": 2}]}');
      assert.equal(line.textContent, t('import.paste.recognised', { format: 'JSON' }));
      assert.ok(!root.querySelector(`.dm-center dm-select[label="${t('import.encoding')}"]`), 'no encoding for a pasted text');
      const before = new Set(shell.store.get().datasets.map((d) => d.id));
      click(await waitFor(() => button(root, t('common.next')), 3000, 'Nästa'));
      click(await waitFor(() => button(root, t('common.import')), 3000, 'Importera'));
      await waitFor(() => root.querySelector('.dm-center .dm-success'), 10000, 'the result');
      const meta = await waitFor(() => shell.store.get().datasets.find((d) => !before.has(d.id) && d.name === t('import.paste.file')), 3000, 'the dataset');
      created.push(meta.id);
      const ds = await datasets.get(meta.id);
      assert.equal(kinds.of(ds), kinds.PROFILES.table, 'a table');
      assert.equal(ds.source.kind, 'paste', 'pasted');
      assert.equal(ds.rowCount, 2);
      // A table keeps its delimiter to choose.
      click(button(root, t('import.another')));
      line = await paste('kommun;antal\nLund;1\nUmeå;2\n');
      assert.equal(line.textContent, t('import.paste.recognised', { format: 'CSV' }));
      assert.ok(root.querySelector(`.dm-center dm-select[label="${t('import.delimiter')}"]`), 'the delimiter');
      // Other text is a text document.
      click(button(root, t('common.back')));
      line = await paste('Hej!\nDet här är en anteckning, inget annat.\nMed vänlig hälsning');
      assert.equal(line.textContent, t('import.paste.recognised.text'));
    });
    return 'ok';
  }, 45000);

  test('import formats: pasted JSON, XML, HTML, STEP and Markdown become datasets of the kinds of their formats', async (assert) => {
    const ifc = D.require('tests/fixtures/ifc');
    const CASES = [
      ['json', '[{"kommun": "Lund", "antal": 1}, {"kommun": "Umeå", "antal": 2}]', 'table'],
      ['xml', '<?xml version="1.0" encoding="UTF-8"?>\n<kommuner><kommun namn="Lund" antal="1"/><kommun namn="Umeå" antal="2"/></kommuner>', 'table'],
      ['html', '<!DOCTYPE html>\n<html><body><table><tr><th>kommun</th><th>antal</th></tr><tr><td>Lund</td><td>1</td></tr><tr><td>Umeå</td><td>2</td></tr></table></body></html>', 'table'],
      ['ifc', ifc.ifcText(), 'model'],
      ['md', '# Anteckning\n\nEtt stycke om **kommunen**.\n\n- en punkt\n', 'document'],
    ];
    const got = [];
    for (const [id, text, kind] of CASES) {
      const file = await importer.recognise(new File([text], t('import.paste.file')));
      assert.equal(importer.recognisedAs(file).id, id, 'recognised as ' + id);
      assert.equal(formats.byId(id).kind, kind, 'the table says ' + kind);
      const meta = await importer.run(file, { pasted: true }, null, 'Inklistrat ' + id);
      created.push(meta.id);
      const ds = await datasets.get(meta.id);
      assert.equal(kinds.of(ds), kinds.PROFILES[kind], id + ' becomes ' + kind);
      if (kind === 'table') assert.equal(ds.source.kind, 'paste', id + ': pasted');
      got.push(id + ':' + (ds.kind || 'table'));
    }
    return got.join(', ');
  }, 60000);

  test('import formats: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return created.length + ' removed';
  });
})();
