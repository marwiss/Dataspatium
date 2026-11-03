// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for chunked import of large delimited files and the backup reminder. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const csv = D.require('io/importers/csv');
  const workspace = D.require('data/workspace');
  const created = [];
  const ROWS = 20000;
  function bigCsv(n, bom) {
    const lines = ['kommunkod;kommun;ar;andel;datum'];
    for (let i = 0; i < n; i++) lines.push(`${String(100 + (i % 290)).padStart(4, '0')};Kommun ${i % 290};${2000 + (i % 25)};${i % 100},${i % 10};2024-01-${String(1 + (i % 28)).padStart(2, '0')}`);
    return (bom ? '﻿' : '') + lines.join('\r\n') + '\r\n';
  }

  test('stream: a delimited file is parsed chunk by chunk with header, delimiter and BOM handled', async (assert) => {
    const file = new File([bigCsv(ROWS, true)], 'stor.csv', { type: 'text/csv' });
    const chunks = []; let last = 0;
    const result = await csv.parseStream(file, { chunkSize: 32 * 1024 }, (rows, info) => { chunks.push(rows.length); assert.ok(info.total > last, 'running total grows'); last = info.total; assert.deepEqual(info.columns, ['kommunkod', 'kommun', 'ar', 'andel', 'datum']); });
    assert.ok(chunks.length > 5, 'several chunks: ' + chunks.length);
    assert.equal(chunks.reduce((s, n) => s + n, 0), ROWS);
    assert.equal(result.rows, ROWS);
    assert.deepEqual(result.columns, ['kommunkod', 'kommun', 'ar', 'andel', 'datum'], 'BOM stripped from the first header');
    assert.equal(result.meta.delimiter, ';'); assert.equal(result.meta.header, true); assert.equal(result.meta.encoding, 'utf-8'); assert.ok(result.meta.streamed);
    // Backpressure: a failing chunk handler aborts the stream with that error.
    await assert.throws(() => csv.parseStream(file, { chunkSize: 32 * 1024 }, () => { throw new Error('stopp'); }), /stopp/);
    return chunks.length + ' chunks';
  }, 30000);

  test('stream: importing a large file in chunks gives the same dataset as reading it whole', async (assert) => {
    const text = bigCsv(ROWS, false);
    const file = new File([text], 'stor.csv', { type: 'text/csv' });
    const progress = [];
    const streamed = await importer.run(file, { stream: true, chunkSize: 64 * 1024 }, null, 'Strömmad', (p) => progress.push(p.rows));
    created.push(streamed.id);
    const whole = await importer.run(new File([text], 'stor2.csv', { type: 'text/csv' }), {}, null, 'Hel');
    created.push(whole.id);
    assert.equal(streamed.rowCount, ROWS); assert.equal(whole.rowCount, ROWS);
    assert.ok(progress.length > 3 && progress[progress.length - 1] === ROWS, 'progress reported per chunk: ' + progress.length);
    const c1 = await datasets.columns(streamed.id); const c2 = await datasets.columns(whole.id);
    assert.deepEqual(c1.map((c) => c.name + ':' + c.type), c2.map((c) => c.name + ':' + c.type));
    assert.deepEqual(c1.map((c) => c.type), ['text', 'text', 'integer', 'number', 'date'], 'types inferred from the first chunk');
    const r1 = await datasets.query(streamed.id, { limit: 3 }); const r2 = await datasets.query(whole.id, { limit: 3 });
    assert.deepEqual(r1, r2, 'first rows identical');
    assert.deepEqual(r1[0], ['0100', 'Kommun 0', 2000, 0, '2024-01-01']);
    const handle = await datasets.ensureOpen(streamed.id);
    const log = await handle.engine.exec("select details from _log where action = 'import'");
    assert.ok(/"streamed":true/.test(String(log[0].values[0][0])), 'the log notes the chunked import');
    assert.equal((await datasets.get(streamed.id)).importOptions.delimiter, ';', 'import options recorded');
    // Column specs from the wizard are honoured too.
    const typed = await importer.run(new File([text], 'stor3.csv'), { stream: true, chunkSize: 64 * 1024 }, [{ name: 'kommunkod', type: 'text', include: true }, { name: 'kommun', type: 'text', include: false }, { name: 'ar', type: 'text', include: true }, { name: 'andel', type: 'number', include: true, decimal: 'comma' }, { name: 'datum', type: 'date', include: true }], 'Typad');
    created.push(typed.id);
    assert.deepEqual((await datasets.columns(typed.id)).map((c) => c.name + ':' + c.type), ['kommunkod:text', 'ar:text', 'andel:number', 'datum:date']);
    return streamed.rowCount + ' rows in ' + progress.length + ' chunks';
  }, 60000);

  test('stream: Windows-1252 text and header-only files stream correctly', async (assert) => {
    const bytes = new Uint8Array([...new TextEncoder().encode('namn;varde\r\n'), 0xC5, 0x73, 0x61, 0x3B, 0x31, 0x0D, 0x0A, 0xD6, 0x72, 0x65, 0x62, 0x72, 0x6F, 0x3B, 0x32, 0x0D, 0x0A]);
    const meta = await importer.run(new File([bytes], 'ansi.csv'), { stream: true, chunkSize: 8 }, null, 'ANSI');
    created.push(meta.id);
    const rows = await datasets.query(meta.id);
    assert.deepEqual(rows, [['Åsa', 1], ['Örebro', 2]], 'decoded as Windows-1252 chunk by chunk');
    const empty = await importer.run(new File(['a;b\r\n'], 'tom.csv'), { stream: true }, null, 'Tom');
    created.push(empty.id);
    assert.equal(empty.rowCount, 0);
    assert.deepEqual((await datasets.columns(empty.id)).map((c) => c.name), ['a', 'b']);
    return rows.length + ' rows';
  }, 30000);

  test('stream: the backup reminder follows the interval setting and the last backup', async (assert) => {
    const day = 86400000; const now = Date.now();
    assert.equal(workspace.isBackupDue({ lastAt: null, remindDays: 30, datasetCount: 2, now }), true, 'never backed up');
    assert.equal(workspace.isBackupDue({ lastAt: null, remindDays: 30, datasetCount: 0, now }), false, 'nothing to back up');
    assert.equal(workspace.isBackupDue({ lastAt: null, remindDays: 0, datasetCount: 2, now }), false, 'reminders off');
    assert.equal(workspace.isBackupDue({ lastAt: new Date(now - 2 * day).toISOString(), remindDays: 7, datasetCount: 2, now }), false, 'recent');
    assert.equal(workspace.isBackupDue({ lastAt: new Date(now - 40 * day).toISOString(), remindDays: 30, datasetCount: 2, now }), true, 'overdue');
    await workspace.setRemindDays(7);
    await workspace.backup();
    const st = await workspace.backupStatus();
    assert.equal(st.remindDays, 7); assert.equal(st.due, false); assert.equal(st.daysSince, 0);
    assert.ok(st.lastAt && Date.now() - Date.parse(st.lastAt) < 60000, 'last backup recorded');
    await workspace.setRemindDays(30);
    return 'ok';
  }, 60000);

  test('stream: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
