// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Performance measurements (tests/perf.html): a large dataset is created in chunks, then paging, SQL
 * aggregation and dm_read() in R are timed. Targets from the plan are reported, not enforced, except for
 * correctness; the numbers end up in docs/utveckling.md.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const params = new URLSearchParams(location.search);
  const ROWS = Math.max(1000, Number(params.get('rows')) || 1000000);
  const COLS = 20;
  const GROUPS = 290;
  const CHUNK = 50000;
  const fmt = (ms) => `${(ms / 1000).toFixed(1)} s`;
  const target = (ms, limit) => (ms <= limit ? `inom målet ${fmt(limit)}` : `ÖVER MÅLET ${fmt(limit)}`);
  const columns = ['kommun', 'kod', 'ar'].concat(Array.from({ length: COLS - 3 }, (_, i) => `v${i + 1}`));
  const types = columns.map((n, i) => (i < 2 ? 'text' : i === 2 || i % 2 === 1 ? 'integer' : 'number'));
  function makeRow(i) {
    const k = i % GROUPS;
    const row = new Array(COLS);
    row[0] = 'Kommun ' + String(k + 1).padStart(3, '0');
    row[1] = String(100 + k).padStart(4, '0');
    row[2] = 2000 + (i % 25);
    for (let c = 3; c < COLS; c++) row[c] = c % 2 === 1 ? (i * 7919 + c * 104729) % 100000 : ((i * 31 + c) % 10000) / 100;
    return row;
  }
  let id = null;

  /**
   * Runs `work` while a 10 ms timer ticks on the main thread; the longest gap beyond the timer's own 10 ms is
   * how long the page was blocked (the target in CLAUDE.md is 50 ms).
   */
  async function blocking(work) {
    let last = performance.now(); let max = 0; let running = true;
    const tick = () => { const now = performance.now(); max = Math.max(max, now - last); last = now; if (running) setTimeout(tick, 10); };
    setTimeout(tick, 10);
    const t0 = performance.now();
    try { await work(); } finally { running = false; }
    return { ms: performance.now() - t0, blocked: Math.max(0, Math.round(max - 10)) };
  }

  // The import runs first, before the large dataset, R and the undo snapshots fill the memory.
  test(`perf: importera en CSV-fil med ${ROWS} rader (mål 60 s)`, async (assert) => {
    const parts = [columns.join(';') + '\n'];
    for (let start = 0; start < ROWS; start += CHUNK) {
      let s = '';
      for (let i = start; i < Math.min(start + CHUNK, ROWS); i++) s += makeRow(i).join(';') + '\n';
      parts.push(s);
    }
    const file = new File(parts, 'prestanda.csv', { type: 'text/csv' });
    let meta = null;
    const r = await blocking(async () => { meta = await D.require('io/import').run(file, {}, null, 'Prestanda CSV'); });
    try {
      assert.equal(await datasets.count(meta.id), ROWS);
    } finally { if (meta) await datasets.remove(meta.id); }
    return `${(file.size / 1048576).toFixed(0)} MB på ${fmt(r.ms)} (${target(r.ms, 60000)}), längsta blockering ${r.blocked} ms`;
  }, 1800000);


  test(`perf: skapa ${ROWS} rader × ${COLS} kolumner i omgångar om ${CHUNK} (mål 60 s)`, async (assert) => {
    const t0 = performance.now();
    const first = [];
    for (let i = 0; i < Math.min(CHUNK, ROWS); i++) first.push(makeRow(i));
    const meta = await datasets.create({ name: `Prestanda ${ROWS}`, columns: columns.map((n, i) => ({ name: n, type: types[i], label: n })), rows: first, source: { kind: 'perf' } });
    id = meta.id;
    for (let start = CHUNK; start < ROWS; start += CHUNK) {
      const rows = [];
      for (let i = start; i < Math.min(start + CHUNK, ROWS); i++) rows.push(makeRow(i));
      await datasets.appendRows(id, { columns, rows }, { mode: 'append' });
    }
    const inserted = performance.now() - t0;
    await datasets.flushSaves();
    const total = performance.now() - t0;
    const count = await datasets.count(id);
    assert.equal(count, ROWS);
    const size = (await datasets.get(id)).byteSize || 0;
    return `insättning ${fmt(inserted)}, inkl. sparning ${fmt(total)} (${target(total, 60000)}); fil ${(size / 1048576).toFixed(0)} MB`;
  }, 900000);

  test('perf: bläddra djupt in i tabellen, osorterat och sorterat (mål 0,2 s per sida)', async (assert) => {
    const t0 = performance.now();
    const page = await datasets.query(id, { offset: Math.floor(ROWS / 2), limit: 100 });
    const plain = performance.now() - t0;
    assert.equal(page.length, 100);
    const t1 = performance.now();
    const sorted = await datasets.query(id, { offset: Math.floor(ROWS / 2), limit: 100, orderBy: 'v1', dir: 'desc' });
    const sortedMs = performance.now() - t1;
    assert.equal(sorted.length, 100);
    const t2 = performance.now();
    const n = await datasets.count(id, { search: 'Kommun 007' });
    const searchMs = performance.now() - t2;
    assert.ok(n > 0, 'search hits');
    return `sida ${fmt(plain)} (${target(plain, 200)}), sorterad sida ${fmt(sortedMs)}, textfilter ${fmt(searchMs)}`;
  }, 300000);

  test('perf: SQL-aggregering över alla rader (mål 2 s)', async (assert) => {
    const handle = await datasets.ensureOpen(id);
    const t0 = performance.now();
    const res = await handle.engine.exec('select kommun, count(*) as n, sum(v1) as s, avg(v2) as m from data group by kommun order by s desc');
    const ms = performance.now() - t0;
    assert.equal(res[0].values.length, GROUPS);
    return `${fmt(ms)} (${target(ms, 2000)})`;
  }, 300000);

  test('perf: dm_read() av hela tabellen i R (mål 30 s)', async (assert) => {
    const { bridge } = D.require('data/r-bridge');
    const t0 = performance.now();
    await bridge.start();
    const started = performance.now() - t0;
    const t1 = performance.now();
    const res = await bridge.run(`df <- dm_read(${JSON.stringify(id)}); cat(nrow(df), ncol(df))`);
    const ms = performance.now() - t1;
    const out = res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim();
    assert.equal(out, `${ROWS} ${COLS}`, JSON.stringify(res.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 160))));
    return `R-start ${fmt(started)}; spegling + dm_read ${fmt(ms)} (${target(ms, 30000)})`;
  }, 900000);

  test(`perf: åtgärder i Bearbeta och reguljära uttryck på ${ROWS} rader`, async (assert) => {
    const recipes = D.require('data/recipes');
    const regex = D.require('analysis/regex');
    const parts = [];
    const step = async (label, fn) => { const r = await blocking(fn); parts.push(`${label} ${fmt(r.ms)} (blockering ${r.blocked} ms)`); };
    await step('rangordna', () => recipes.apply(id, 'rank_values', { column: 'v1', which: 'largest', method: 'min', name: 'rang' }));
    await step('andel av summan per kommun', () => recipes.apply(id, 'share_of_total', { column: 'v1', group: 'kommun', percent: true, name: 'andel' }));
    await step('klassindela', () => recipes.apply(id, 'bin_numeric', { column: 'v2', method: 'equal', count: 5, name: 'klass' }));
    await step('regex: räkna träffar', async () => { const s = await regex.stats(id, 'kommun', '^Kommun 0\\d\\d$', ''); assert.ok(s.matching > 0, 'matches'); });
    await step('regex: extrahera', () => recipes.apply(id, 'regex_extract', { column: 'kommun', pattern: '(\\d+)$', names: 'nummer' }));
    await step('sortera rader', () => recipes.apply(id, 'sort_rows', { column: 'v3', direction: 'desc' }));
    const handle = await datasets.ensureOpen(id);
    assert.equal(handle.columns.filter((c) => ['rang', 'andel', 'klass', 'nummer'].includes(c.name)).length, 4, 'new columns');
    return parts.join('; ');
  }, 1800000);

  test('perf: städa', async (assert) => {
    if (id) await datasets.remove(id);
    assert.ok(true);
    return 'datamängden borttagen';
  }, 120000);
})();
