// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for regular expressions: the SQLite functions, the time-limited matching worker, the pattern
 * profile, the pattern library, the regex recipe steps with their SQL and R export, find and replace with
 * case-insensitive patterns, saved scripts in backups and bundles, and the Regex tab in Analysera.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const regex = D.require('analysis/regex');
  const t = D.require('ui/i18n').t;
  const created = [];

  async function make(name, columns, rows) {
    const meta = await datasets.create({ name, columns: columns.map(([n, type]) => ({ name: n, type, label: n })), rows });
    created.push(meta.id);
    return meta.id;
  }
  const col = async (id, name) => { const h = await datasets.ensureOpen(id); const i = h.columns.findIndex((c) => c.name === name); return (await datasets.query(id, { limit: 1000 })).map((r) => r[i]); };
  const sql = async (id, text) => (await (await datasets.ensureOpen(id)).engine.exec(text))[0].values;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      if (fn()) return;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  test('regex: SQLite functions test, extract, collect, count, split and shape values; (?i) and \\p{L} work', async (assert) => {
    const id = await make('Regex SQL', [['text', 'text']], [['Stockholms län (01)'], ['Västra Götalands län (14)'], ['Gotland'], [null]]);
    const [row] = await sql(id, `select
      dm_regex_test('Malmö', '^\\p{L}+$', ''),
      regexp('(?i)^malmö$', 'MALMÖ'),
      dm_regex_extract('Stockholms län (01)', '\\((\\d+)\\)', 1, ''),
      dm_regex_extract('Folkmängd 2024', '(?<ar>\\d{4})', 'ar', ''),
      dm_regex_all('a1 b22 c333', '\\d+', 0, '|', ''),
      dm_regex_count('a1 b22 c333', '\\d+', ''),
      dm_regex_split('a, b; c, d', '[,;] ?', 2, 3, ''),
      dm_regex_split('a, b; c, d', '[,;] ?', 3, 3, ''),
      dm_regex_split('enkel', ',', 2, 2, ''),
      dm_shape('Ab 12-x', 0), dm_shape('Stockholm 114 55', 1),
      regexp('a\\-b', 'xa-by')`);
    assert.deepEqual(row, [1, 1, '01', '2024', '1|22|333', 3, 'b', 'c, d', null, 'Aa 99-a', 'Aa+ 9+ 9+', 1]);
    const codes = await sql(id, `select dm_regex_extract("text", '\\((\\d+)\\)', 1, '') from data order by rowid`);
    assert.deepEqual(codes.map((r) => r[0]), ['01', '14', null, null], 'per row, missing groups are empty');
    return 'ok';
  });

  test('regex: the matching worker stops a catastrophic pattern within the time limit and starts again', async (assert) => {
    const hits = await regex.run({ op: 'test', pattern: '^\\d{3} ?\\d{2}$', flags: '', values: ['114 55', '11455', '1145', null] });
    assert.deepEqual(hits, [1, 1, 0, null]);
    const spans = await regex.run({ op: 'match', pattern: '(\\d+)', flags: '', values: ['a1 b22'] });
    assert.deepEqual(spans[0], [[1, 1, ['1']], [4, 2, ['22']]], 'index, length and groups');
    const replaced = await regex.run({ op: 'replace', pattern: '(\\w+)@(\\w+)', flags: 'i', values: ['Anna@SCB'], replacement: '$2:$1' });
    assert.deepEqual(replaced, ['SCB:Anna']);
    const t0 = performance.now();
    let error = null;
    try { await regex.run({ op: 'test', pattern: '^(a+)+$', flags: '', values: ['a'.repeat(34) + '!'] }, 800); } catch (err) { error = err; }
    const ms = performance.now() - t0;
    assert.ok(error instanceof regex.RegexTimeout, 'timeout error: ' + (error && error.message));
    assert.ok(ms < 3000, 'stopped after ' + Math.round(ms) + ' ms');
    assert.deepEqual(await regex.run({ op: 'test', pattern: 'b', flags: '', values: ['abc'] }), [1], 'a new worker answers');
    return Math.round(ms) + ' ms';
  });

  test('regex: library patterns, groups, shapes and the R form of patterns and replacements', async (assert) => {
    for (const item of regex.LIBRARY) {
      const c = regex.compile(item.pattern);
      assert.ok(!c.error && c.unicode, item.id + ' compiles with the Unicode flag');
      assert.ok(c.re.test(item.yes), item.id + ' matches ' + item.yes);
      assert.ok(!c.re.test(item.no), item.id + ' does not match ' + item.no);
    }
    assert.deepEqual(regex.compile('(\\d+)-(?<lan>\\d{2})(?:x)').groups, ['1', 'lan']);
    assert.deepEqual(regex.compile('[(]\\((a)\\)').groups, ['1'], 'parentheses in classes and escapes are not groups');
    assert.ok(regex.compile('(?i)abc').re.test('ABC'), 'a leading (?i) becomes a flag');
    assert.ok(regex.compile('a\\-b').error === '' && !regex.compile('a\\-b').unicode, 'patterns valid only without Unicode still work');
    assert.ok(regex.compile('(').error, 'invalid pattern reported');
    const shape = regex.patternFromShape('AAA 99A');
    assert.equal(shape, '^\\p{Lu}{3} \\d{2}\\p{Lu}$');
    assert.ok(regex.compile(shape).re.test('ABC 12D'));
    assert.equal(regex.patternFromShape('Aa+ 9+-9+'), '^\\p{Lu}\\p{Ll}+ \\d+-\\d+$');
    assert.equal(regex.rReplacement('$2 ($<lan>) $& $$1 a\\b', '(\\d+)-(?<lan>\\d{2})'), '\\2 (\\2) \\0 $1 a\\\\b');
    assert.equal(regex.rRegex('abc', 'is'), 'stringr::regex("abc", ignore_case = TRUE, dotall = TRUE)');
    return regex.LIBRARY.length + ' library patterns';
  });

  test('regex: column statistics, pattern profile and the guard before changes', async (assert) => {
    const id = await make('Regex profil', [['postnr', 'text']], [['114 55'], ['114 55'], ['41107'], ['postbox'], [null]]);
    const st = await regex.stats(id, 'postnr', '^\\d{3} ?\\d{2}$', '');
    assert.deepEqual([st.rows, st.filled, st.matching, st.distinct, st.sampled], [5, 4, 3, 3, false]);
    const shapes = await regex.profile(id, 'postnr', false);
    assert.deepEqual(shapes.map((s) => [s.shape, s.count]), [['999 99', 2], ['99999', 1], ['aaaaaaa', 1]]);
    await regex.guard(id, 'postnr', '\\d', '');
    const slow = await make('Regex långsam', [['v', 'text']], [['a'.repeat(34) + '!'], ['ok']]);
    let error = null;
    try { await recipes.apply(slow, 'regex_filter', { column: 'v', pattern: '^(a+)+$', keep: 'matching' }); } catch (err) { error = err; }
    assert.ok(error instanceof regex.RegexTimeout, 'the step stops at the guard: ' + (error && error.message));
    assert.equal((await col(slow, 'v')).length, 2, 'nothing was removed');
    let invalid = null;
    try { await recipes.apply(id, 'regex_flag', { column: 'postnr', pattern: '(', name: 'x' }); } catch (err) { invalid = err; }
    assert.ok(invalid, 'an invalid pattern is refused');
    return 'ok';
  });

  test('regex: filter, extract, flag, count and split as recipe steps with SQL and R export', async (assert) => {
    const id = await make('Regex steg', [['namn', 'text'], ['kod', 'integer']], [
      ['Stockholms län (01)', 1], ['Uppsala län (03)', 3], ['Gotland', 9], ['Skåne län (12), Malmö', 12],
    ]);
    const pre = await recipes.preview(id, 'regex_filter', { column: 'namn', pattern: 'län', keep: 'matching' });
    assert.equal(pre.rows, 1, 'preview: one row would be removed');
    await recipes.apply(id, 'regex_extract', { column: 'namn', pattern: '^(?<lan>[^(]+?) län \\((?<lanskod>\\d{2})\\)', names: '' });
    assert.deepEqual(await col(id, 'lan'), ['Stockholms', 'Uppsala', null, 'Skåne']);
    assert.deepEqual(await col(id, 'lanskod'), ['01', '03', null, '12']);
    await recipes.apply(id, 'regex_extract', { column: 'namn', pattern: '\\p{Lu}\\p{Ll}+', which: 'all', sep: '+', names: 'versalord' });
    assert.deepEqual(await col(id, 'versalord'), ['Stockholms', 'Uppsala', 'Gotland', 'Skåne+Malmö']);
    await recipes.apply(id, 'regex_flag', { column: 'kod', pattern: '^\\d$', whole: false, name: 'ensiffrig' });
    assert.deepEqual(await col(id, 'ensiffrig'), [1, 1, 1, 0], 'integer column read as text');
    await recipes.apply(id, 'regex_count', { column: 'namn', pattern: 'l', caseInsensitive: true, name: 'antal_l' });
    assert.deepEqual(await col(id, 'antal_l'), [2, 2, 1, 2]);
    await recipes.apply(id, 'regex_split', { column: 'namn', pattern: ' ?[(),] ?', parts: 3, name: 'del' });
    assert.deepEqual(await col(id, 'del_1'), ['Stockholms län', 'Uppsala län', 'Gotland', 'Skåne län']);
    assert.deepEqual(await col(id, 'del_3'), ['', '', null, ', Malmö'], 'the last part keeps the rest');
    await recipes.apply(id, 'regex_filter', { column: 'namn', pattern: 'gotland', caseInsensitive: true, keep: 'other' });
    assert.deepEqual(await col(id, 'kod'), [1, 3, 12]);
    const steps = (await recipes.steps(id)).map((s) => s.op);
    assert.deepEqual(steps.filter((s) => s.startsWith('regex_')), ['regex_extract', 'regex_extract', 'regex_flag', 'regex_count', 'regex_split', 'regex_filter']);
    const sqlText = await recipes.toSQL(id);
    for (const fn of ['dm_regex_extract', 'dm_regex_all', 'dm_regex_test', 'dm_regex_count', 'dm_regex_split']) assert.ok(sqlText.includes(fn), 'SQL uses ' + fn);
    const r = await recipes.toR(id);
    for (const fn of ['stringr::str_match(', 'stringr::str_match_all(', 'stringr::str_detect(', 'stringr::str_count(', 'stringr::str_split_fixed(', 'ignore_case = TRUE']) assert.ok(r.includes(fn), 'R uses ' + fn);
    // A replay on a copy gives the same columns.
    const copy = await make('Regex kopia', [['namn', 'text'], ['kod', 'integer']], [['Uppsala län (03)', 3]]);
    await recipes.replay(copy, (await recipes.steps(id)).filter((s) => s.op.startsWith('regex_')));
    assert.deepEqual(await col(copy, 'lanskod'), ['03']);
    return steps.length + ' steps';
  });

  test('regex: find and replace with a case-insensitive pattern and its R export', async (assert) => {
    const id = await make('Regex ersätt', [['namn', 'text']], [['Anna Berg'], ['ANNA LIND'], ['Bo Ek']]);
    const res = await recipes.apply(id, 'replace_text', { columns: ['namn'], find: '^anna (\\p{L}+)$', replace: '$1, A.', regex: true, caseInsensitive: true });
    assert.equal(res.rows, 2, 'both spellings replaced');
    assert.deepEqual(await col(id, 'namn'), ['Berg, A.', 'LIND, A.', 'Bo Ek']);
    const r = await recipes.toR(id);
    assert.ok(r.includes('gsub("^anna (\\\\p{L}+)$", "\\\\1, A.", df$"namn", ignore.case = TRUE, perl = TRUE)'), r);
    return 'ok';
  });

  test('regex: saved scripts and patterns travel in backups and bundles', async (assert) => {
    const idb = D.require('platform/storage/idb');
    const workspace = D.require('data/workspace');
    const zip = D.require('platform/storage/zip');
    const now = new Date().toISOString();
    const pattern = { id: 'sc_regex_test', name: 'Testmönster postnummer', language: 'regex', code: '^\\d{3} ?\\d{2}$', options: { caseInsensitive: false, whole: false, dotAll: false }, createdAt: now, updatedAt: now };
    const rScript = { id: 'sc_r_test', name: 'Testskript R', language: 'r', code: 'summary(df)', createdAt: now, updatedAt: now };
    await idb.putScript(pattern); await idb.putScript(rScript);
    try {
      const { files } = await workspace.collect({ datasetIds: [] });
      assert.ok(files['scripts/sc_regex_test.script.json'] && files['scripts/sc_r_test.script.json'], 'script files in the backup');
      assert.ok(JSON.parse(String(files['manifest.json'])).scripts.some((s) => s.id === 'sc_regex_test'), 'listed in the manifest');
      const entries = {};
      for (const [path, data] of Object.entries(files)) if (path.startsWith('scripts/') || path === 'manifest.json') entries[path] = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const again = await workspace.restoreEntries(entries, { dedupe: true });
      assert.equal(again.scripts.length, 0, 'a bundle skips scripts that exist');
      await idb.deleteScript(pattern.id);
      const back = await workspace.restoreEntries(entries, { dedupe: true });
      assert.ok(back.scripts.some((s) => s.name === pattern.name && s.code === pattern.code && s.options.whole === false), 'the pattern is restored');
      let bad = null;
      try { await workspace.restoreEntries({ 'scripts/x.script.json': new TextEncoder().encode('{"kind":"other"}') }); } catch (err) { bad = err; }
      assert.ok(!bad, 'a broken file is skipped, not fatal');
      assert.ok(zip, 'zip module present');
    } finally {
      await idb.deleteScript(pattern.id); await idb.deleteScript(rScript.id);
    }
    return 'ok';
  });

  test('regex: the Regex tab in Analysera marks matches as a pattern is typed and applies an extraction', async (assert) => {
    D.require('ui/components');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    try {
      const shell = await D.require('app').start(root);
      const file = new File(['kommun;postnr\nStockholm;114 55\nGöteborg;411 07\nMalmö;okänt\n'], 'regex.csv', { type: 'text/csv' });
      meta = await shell.ctx.services.importer.run(file, {}, null, 'Regexflik');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('analysera');
      await waitFor(() => root.querySelectorAll('dm-tabs [role="tab"]').length === 5, 5000, 'five tabs');
      /** @type {HTMLElement} */ (root.querySelectorAll('dm-tabs [role="tab"]')[3]).click(); // R, Python, SQL, Regex, Anteckningsbok
      await waitFor(() => root.querySelector('.dm-regex-preview'), 5000, 'regex preview');
      const selects = () => Array.from(root.querySelectorAll('.dm-center dm-select, dm-select')).filter((s) => s.closest('.dm-page-head') === null);
      await waitFor(() => selects().some((s) => /** @type {any} */ (s).options.some((o) => o.value === 'postnr')), 5000, 'column choices');
      const colSelect = /** @type {any} */ (selects().find((s) => s.options.some((o) => o.value === 'postnr')));
      colSelect.value = 'postnr';
      colSelect.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
      const input = /** @type {any} */ (Array.from(root.querySelectorAll('dm-input')).find((el) => el.getAttribute('label') === t('regex.pattern')));
      assert.ok(input, 'pattern field');
      input.value = '(\\d{3}) ?(\\d{2})';
      input.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => root.querySelectorAll('.dm-regex-preview mark.dm-regex-hit').length === 2, 5000, 'two values marked');
      assert.ok(/2/.test(root.querySelector('[role="status"]').textContent), 'summary counts the matches');
      // Library: a click puts the pattern in the field.
      const lib = Array.from(root.querySelectorAll('.dm-list-item')).find((b) => b.textContent.includes(t('regex.lib.iso_date')));
      assert.ok(lib, 'library item');
      // Extract into new columns with the primary button.
      const action = /** @type {any} */ (selects().find((s) => s.options.some((o) => o.value === 'extract')));
      action.value = 'extract';
      action.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
      const apply = Array.from(root.querySelectorAll('.dm-page-head dm-button')).find((b) => b.getAttribute('label') === t('regex.apply'));
      assert.ok(apply && !apply.hidden, 'apply button shown');
      apply.querySelector('button').click();
      let cols = [];
      for (let i = 0; i < 60; i++) { cols = (await datasets.ensureOpen(meta.id)).columns.map((c) => c.name); if (cols.includes('postnr_2')) break; await wait(100); }
      assert.ok(cols.includes('postnr_1') && cols.includes('postnr_2'), 'extracted columns: ' + cols.join(', '));
      assert.deepEqual(await col(meta.id, 'postnr_2'), ['55', '07', null]);
      // A library item puts its pattern in the field.
      const patternField = () => /** @type {any} */ (Array.from(root.querySelectorAll('dm-input')).find((el) => el.getAttribute('label') === t('regex.pattern')));
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-list-item')).find((b) => b.textContent.includes(t('regex.lib.iso_date')))).click();
      await waitFor(() => patternField() && String(patternField().value).includes('\\d{4}-'), 5000, 'library pattern in the field');
      return 'ok';
    } finally {
      for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
      if (meta) await datasets.remove(meta.id);
      root.remove();
    }
  }, 60000);

  test('regex: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_e) { /* already gone */ } }
    return created.length + ' datasets removed';
  });
})();
