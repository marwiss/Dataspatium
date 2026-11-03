// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the operations and rules added in 1.12: rounding, padding, character cleaning, recoding, filling,
 * sorting, top rows, samples, empty rows and columns, copying and cleaning names, text and date parts, date
 * differences, classes, shares, ranks, running totals, changes, standardisation, and the new rule types.
 * Identity numbers are synthetic: the check digits are computed here.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const rulesMod = D.require('data/rules');
  const created = [];

  async function make(name, columns, rows) {
    const meta = await datasets.create({ name, columns: columns.map(([n, type]) => ({ name: n, type, label: n })), rows });
    created.push(meta.id);
    return meta.id;
  }
  const rowsOf = async (id) => datasets.query(id, { limit: 1000 });
  const col = async (id, name) => { const h = await datasets.ensureOpen(id); const i = h.columns.findIndex((c) => c.name === name); return (await rowsOf(id)).map((r) => r[i]); };
  const typeOf = async (id, name) => (await datasets.ensureOpen(id)).columns.find((c) => c.name === name).type;

  test('operations2: rounding, padding with zeros, removing characters, recoding and filling gaps', async (assert) => {
    const id = await make('Värden', [['tal', 'number'], ['kod', 'integer'], ['telefon', 'text'], ['kon', 'text'], ['varde', 'number']], [
      [2.5, 114, '070-123 45 67', 'K', 10], [-2.5, 2180, '+46 (0)8 555', 'M', null], [1.005, 1, 'Tel: 12', 'X', 30], [1234, null, null, null, null],
    ]);
    await recipes.apply(id, 'round_numbers', { columns: ['tal'], decimals: 0, mode: 'round' });
    assert.deepEqual(await col(id, 'tal'), [3, -3, 1, 1234], 'half away from zero');
    await recipes.undo(id);
    await recipes.apply(id, 'round_numbers', { columns: ['tal'], decimals: 2, mode: 'round' });
    assert.deepEqual(await col(id, 'tal'), [2.5, -2.5, 1.01, 1234], '1.005 rounds to 1.01');
    await recipes.apply(id, 'round_numbers', { columns: ['tal'], decimals: -1, mode: 'floor' });
    assert.deepEqual(await col(id, 'tal'), [0, -10, 0, 1230], 'negative decimals round to tens');
    const pad = await recipes.apply(id, 'pad_text', { columns: ['kod'], length: 4, fill: '0', side: 'left' });
    assert.equal(await typeOf(id, 'kod'), 'text', 'a number column becomes text');
    assert.deepEqual(await col(id, 'kod'), ['0114', '2180', '0001', null]);
    assert.equal(pad.rows, 2);
    await recipes.apply(id, 'clean_chars', { columns: ['telefon'], mode: 'digits' });
    assert.deepEqual(await col(id, 'telefon'), ['0701234567', '4608555', '12', null]);
    await recipes.apply(id, 'recode_values', { column: 'kon', mapping: 'K = Kvinnor\nM = Män\n# kommentar', others: 'empty' });
    assert.deepEqual(await col(id, 'kon'), ['Kvinnor', 'Män', null, null], 'other values become empty');
    await recipes.apply(id, 'fill_missing', { column: 'varde', mode: 'next' });
    assert.deepEqual(await col(id, 'varde'), [10, 30, 30, null], 'next fills upwards');
    await recipes.apply(id, 'fill_missing', { column: 'varde', mode: 'median' });
    assert.deepEqual(await col(id, 'varde'), [10, 30, 30, 30]);
    const r = recipes.describe('pad_text', { columns: ['kod'], length: 4 }, { rows: 2 });
    assert.ok(r.includes('kod') && r.includes('4'), r);
    return 'ok';
  });

  test('operations2: sorting, top rows per group, samples, empty rows and columns, copies and clean names', async (assert) => {
    const id = await make('Rader', [['lan', 'text'], ['kommun', 'text'], ['Folkmängd 2024', 'integer'], ['tom', 'text'], ['2024', 'integer']], [
      ['A', 'a1', 300, null, 1], ['A', 'a2', 100, null, 2], ['B', 'b1', 500, null, 3], ['B', 'b2', 50, null, 4], ['A', 'a3', 200, null, 5], [null, null, null, null, null],
    ]);
    const empty = await recipes.apply(id, 'remove_empty', { emptyRows: true, emptyColumns: true });
    assert.equal(empty.rows, 1);
    assert.deepEqual(empty.columns, ['tom']);
    await recipes.apply(id, 'sort_rows', { column: 'Folkmängd 2024', direction: 'desc' });
    assert.deepEqual(await col(id, 'kommun'), ['b1', 'a1', 'a3', 'a2', 'b2']);
    await recipes.undo(id);
    assert.deepEqual(await col(id, 'kommun'), ['a1', 'a2', 'b1', 'b2', 'a3'], 'undo restores the order');
    await recipes.apply(id, 'keep_top', { column: 'Folkmängd 2024', count: 1, which: 'largest', group: 'lan' });
    assert.deepEqual((await col(id, 'kommun')).sort(), ['a1', 'b1']);
    await recipes.undo(id);
    await recipes.apply(id, 'duplicate_column', { column: 'kommun', name: 'kommun_kopia' });
    assert.deepEqual(await col(id, 'kommun_kopia'), await col(id, 'kommun'));
    const cleaned = await recipes.apply(id, 'clean_names', {});
    const handle = await datasets.ensureOpen(id);
    assert.deepEqual(handle.columns.map((c) => c.name), ['lan', 'kommun', 'folkmangd_2024', 'x2024', 'kommun_kopia']);
    assert.equal(handle.columns.find((c) => c.name === 'folkmangd_2024').label, 'Folkmängd 2024', 'the label keeps the original name');
    assert.equal(cleaned.columns, 2);
    // Samples: the same seed gives the same rows; percent of the rows.
    const big = await make('Urval', [['n', 'integer']], Array.from({ length: 200 }, (_, i) => [i + 1]));
    await recipes.apply(big, 'sample_rows', { count: 20, unit: 'rows', seed: 7 });
    const first = await col(big, 'n');
    await recipes.undo(big);
    await recipes.apply(big, 'sample_rows', { count: 10, unit: 'percent', seed: 7 });
    assert.deepEqual(await col(big, 'n'), first, 'same seed, same sample');
    assert.equal(first.length, 20);
    const sql = await recipes.toSQL(id); const r = await recipes.toR(id);
    assert.ok(sql.includes('RENAME COLUMN "Folkmängd 2024" TO "folkmangd_2024"'), 'SQL export renames from the original names');
    assert.ok(r.includes('dplyr::rename(df, "folkmangd_2024" = "Folkmängd 2024"'), 'R export too');
    return 'ok';
  });

  test('operations2: text parts, date parts, date differences and classes', async (assert) => {
    const id = await make('Datum', [['kommunkod', 'text'], ['datum', 'date'], ['fodd', 'date'], ['alder', 'integer']], [
      ['0114', '2024-12-30', '1990-05-20', 5], ['1480', '2024-11-03', '2000-02-29', 17], ['2580', '2025-03-31', '1950-01-01', 18], ['0380', null, null, 70],
    ]);
    await recipes.apply(id, 'substring', { column: 'kommunkod', from: 'start', start: 1, length: 2, name: 'lanskod' });
    assert.deepEqual(await col(id, 'lanskod'), ['01', '14', '25', '03']);
    await recipes.apply(id, 'substring', { column: 'kommunkod', from: 'end', length: 2, name: 'slut' });
    assert.deepEqual(await col(id, 'slut'), ['14', '80', '80', '80']);
    await recipes.apply(id, 'date_part', { column: 'datum', part: 'week', name: 'vecka' });
    assert.deepEqual(await col(id, 'vecka'), [1, 44, 14, null], 'ISO weeks: 30 December 2024 is week 1 of 2025');
    await recipes.apply(id, 'date_part', { column: 'datum', part: 'weekday', name: 'veckodag' });
    assert.deepEqual(await col(id, 'veckodag'), [1, 7, 1, null], 'Monday is 1, Sunday is 7');
    await recipes.apply(id, 'date_part', { column: 'datum', part: 'yearmonth', name: 'manad' });
    assert.deepEqual(await col(id, 'manad'), ['2024-12', '2024-11', '2025-03', null]);
    await recipes.apply(id, 'date_part', { column: 'datum', part: 'quarter', name: 'kvartal' });
    assert.deepEqual(await col(id, 'kvartal'), [4, 4, 1, null]);
    await recipes.apply(id, 'date_diff', { start: 'fodd', end: 'datum', unit: 'years', name: 'ar' });
    assert.deepEqual(await col(id, 'ar'), [34, 24, 75, null], 'whole years, as an age');
    await recipes.apply(id, 'date_diff', { start: 'fodd', end: 'datum', unit: 'months', name: 'manader' });
    assert.equal((await col(id, 'manader'))[0], 415);
    await recipes.apply(id, 'date_diff', { start: 'datum', end: 'datum', unit: 'days', name: 'noll' });
    assert.deepEqual(await col(id, 'noll'), [0, 0, 0, null]);
    await recipes.apply(id, 'bin_numeric', { column: 'alder', method: 'breaks', breaks: '0, 18, 65', name: 'aldersgrupp' });
    assert.deepEqual(await col(id, 'aldersgrupp'), ['0–17', '0–17', '18–64', '65–'], 'integer classes name their last value');
    await recipes.apply(id, 'bin_numeric', { column: 'alder', method: 'breaks', breaks: '10;20', name: 'grov' });
    assert.deepEqual(await col(id, 'grov'), ['<10', '10–19', '10–19', '20–']);
    await recipes.apply(id, 'bin_numeric', { column: 'alder', method: 'quantiles', count: 2, name: 'halva' });
    assert.deepEqual(await col(id, 'halva'), [1, 1, 2, 2]);
    await recipes.apply(id, 'bin_numeric', { column: 'alder', method: 'equal', count: 2, name: 'lika' });
    const lika = await col(id, 'lika');
    assert.equal(new Set(lika).size, 2, 'two equal-width classes: ' + lika.join(', '));
    return 'ok';
  });

  test('operations2: shares, ranks, running totals, changes and standardised values per group', async (assert) => {
    const id = await make('Beräkningar', [['lan', 'text'], ['ar', 'integer'], ['folk', 'integer']], [
      ['A', 2022, 100], ['A', 2023, 110], ['A', 2024, 121], ['B', 2022, 300], ['B', 2023, 270], ['B', 2024, 270],
    ]);
    await recipes.apply(id, 'share_of_total', { column: 'folk', group: 'lan', percent: true, name: 'andel' });
    const andel = await col(id, 'andel');
    assert.ok(Math.abs(andel.slice(0, 3).reduce((a, b) => a + b, 0) - 100) < 1e-9, 'shares per group add up to 100');
    await recipes.apply(id, 'rank_values', { column: 'folk', which: 'largest', method: 'min', name: 'rang' });
    assert.deepEqual(await col(id, 'rang'), [6, 5, 4, 1, 2, 2], 'ties share a rank');
    await recipes.apply(id, 'running_total', { column: 'folk', order: 'ar', group: 'lan', name: 'kumulativ' });
    assert.deepEqual(await col(id, 'kumulativ'), [100, 210, 331, 300, 570, 840]);
    await recipes.apply(id, 'change_previous', { column: 'folk', order: 'ar', group: 'lan', mode: 'percent', name: 'tillvaxt' });
    const growth = (await col(id, 'tillvaxt')).map((v) => (v === null ? null : Math.round(v * 10) / 10));
    assert.deepEqual(growth, [null, 10, 10, null, -10, 0]);
    await recipes.apply(id, 'standardize', { column: 'folk', method: 'zscore', name: 'z' });
    const z = await col(id, 'z');
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const sd = Math.sqrt(z.reduce((a, b) => a + (b - mean) ** 2, 0) / (z.length - 1));
    assert.ok(Math.abs(mean) < 1e-9 && Math.abs(sd - 1) < 1e-9, 'mean 0 and standard deviation 1');
    await recipes.apply(id, 'standardize', { column: 'folk', method: 'minmax', name: 'skala' });
    assert.deepEqual([Math.min(...await col(id, 'skala')), Math.max(...await col(id, 'skala'))], [0, 1]);
    const r = await recipes.toR(id);
    assert.ok(r.includes('dplyr::lag') && r.includes('cumsum') && r.includes('scale('), 'R code for the calculations');
    return 'ok';
  });

  // Synthetic identity numbers with correct check digits.
  const luhnDigit = (s) => { let sum = 0; for (let i = 0; i < s.length; i++) { let v = Number(s[s.length - 1 - i]) * (i % 2 ? 1 : 2); if (v > 9) v -= 9; sum += v; } return String((10 - (sum % 10)) % 10); };
  function norwegian(base) {
    const n = base.split('').map(Number);
    let k1 = 11 - ([3, 7, 6, 1, 8, 9, 4, 5, 2].reduce((a, w, i) => a + w * n[i], 0) % 11); if (k1 === 11) k1 = 0;
    let k2 = 11 - ([5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, w, i) => a + w * (i < 9 ? n[i] : k1), 0) % 11); if (k2 === 11) k2 = 0;
    return k1 === 10 || k2 === 10 ? null : base + k1 + k2;
  }
  const finnish = (ddmmyy, sign, ind) => ddmmyy + sign + ind + '0123456789ABCDEFHJKLMNPRSTUVWXY'[Number(ddmmyy + ind) % 31];
  function icelandic(first8, century) {
    const k = first8.split('').map(Number);
    const c = 11 - ([3, 2, 7, 6, 5, 4, 3, 2].reduce((a, w, i) => a + w * k[i], 0) % 11);
    return c === 10 ? null : first8 + (c === 11 ? 0 : c) + century;
  }

  test('operations2: Nordic identity numbers are checked with their check digits and dates', async (assert) => {
    let nb = null; for (let i = 100; !nb; i++) nb = norwegian('010190' + i);
    let kt = null; for (let i = 20; !kt; i++) kt = icelandic('120160' + i, 9);
    const rows = [
      ['se_pnr', '811218-987' + luhnDigit('811218987'), '811218-9870'],
      ['se_pnr', '19811278-987' + luhnDigit('811278987'), '19811332-9871'],
      ['se_orgnr', '556000-000' + luhnDigit('556000000'), '551000-0000'],
      ['no_fnr', nb, nb.slice(0, 10) + ((Number(nb[10]) + 1) % 10)],
      ['fi_hetu', finnish('131052', '-', '308'), '131052-308X'],
      ['dk_cpr', '0101901234', '3102901234'],
      ['is_kt', kt, kt.slice(0, 8) + ((Number(kt[8]) + 1) % 10) + kt[9]],
    ];
    const id = await make('Nummer', [['slag', 'text'], ['giltigt', 'text'], ['ogiltigt', 'text']], rows);
    const results = [];
    for (const kind of rulesMod.ID_KINDS) {
      const good = await rulesMod.run(id, [{ id: 'g' + kind, type: 'sql', expression: `slag != '${kind}' or dm_valid_id(giltigt, '${kind}') = 1` }]);
      const bad = await rulesMod.run(id, [{ id: 'b' + kind, type: 'sql', expression: `slag != '${kind}' or dm_valid_id(ogiltigt, '${kind}') = 0` }]);
      assert.ok(good.results[0].ok, kind + ' accepts a valid number');
      assert.ok(bad.results[0].ok, kind + ' rejects an invalid number');
      results.push(kind);
    }
    // The rule type itself: one failing row among the Swedish personal numbers.
    const rule = await rulesMod.run(id, [{ id: 'r1', type: 'identifier', column: 'ogiltigt', kind: 'se_pnr' }]);
    assert.ok(rule.results[0].failures >= 2, 'invalid numbers fail the rule');
    return results.join(', ');
  });

  test('operations2: suggested identity number and postcode rules follow the values, not only the column name', async (assert) => {
    const norw = []; for (let i = 100; norw.length < 3; i++) { const n = norwegian('010190' + i); if (n) norw.push(n); }
    const kts = []; for (let i = 20; kts.length < 3; i++) { const k = icelandic('120160' + i, 9); if (k) kts.push(k); }
    const id = await make('Förslag', [['personnummer', 'text'], ['kennitala', 'text'], ['postnummer', 'text']],
      norw.map((n, i) => [n, kts[i], ['0150', '5003', '9008'][i]]));
    const suggestions = await rulesMod.suggest(id);
    const kindOf = (column) => (suggestions.find((s) => s.type === 'identifier' && s.column === column) || {}).kind;
    assert.equal(kindOf('personnummer'), 'no_fnr', 'Norwegian numbers in a column called personnummer');
    assert.equal(kindOf('kennitala'), 'is_kt', 'a kennitala is preferred over a CPR date that also fits');
    assert.equal((suggestions.find((s) => s.type === 'format' && s.column === 'postnummer') || {}).format, 'postnr4', 'four-digit postcodes');
    return 'ok';
  });

  test('operations2: forbidden values, formats, whitespace, types, comparisons, references, completeness and outliers', async (assert) => {
    const id = await make('Regler', [['kod', 'text'], ['epost', 'text'], ['postnr', 'text'], ['namn', 'text'], ['tal', 'text'], ['start', 'date'], ['slut', 'date'], ['varde', 'number']], [
      ['01', 'a@b.se', '123 45', 'Anna', '12', '2024-01-01', '2024-02-01', 10],
      ['99', 'fel@', '12345', ' Bo', '1,5', '2024-03-01', '2024-02-01', 11],
      ['03', null, '1234', 'Cecilia  Ek', 'x', '2024-01-01', null, 9],
      ['04', 'c@d.dk', null, null, null, null, null, 10],
      ['05', 'e@f.no', '999 99', 'Dan', '7', null, null, 500],
    ]);
    const ref = await make('Referens', [['kod', 'text']], [['01'], ['03'], ['04'], ['05']]);
    const run = async (rule) => (await rulesMod.run(id, [Object.assign({ id: 'x' + Math.random().toString(36).slice(2) }, rule)])).results[0];
    assert.equal((await run({ type: 'not_in', column: 'kod', values: '99; 98' })).failures, 1, 'forbidden value');
    assert.equal((await run({ type: 'format', column: 'epost', format: 'email' })).failures, 1, 'e-mail format, empty values pass');
    assert.equal((await run({ type: 'format', column: 'postnr', format: 'se_postnr' })).failures, 1, 'Swedish postcode with or without space');
    assert.equal((await run({ type: 'whitespace', column: 'namn' })).failures, 2, 'leading and double spaces');
    assert.equal((await run({ type: 'parsable', column: 'tal', target: 'number' })).failures, 1, 'x is not a number');
    assert.equal((await run({ type: 'parsable', column: 'tal', target: 'integer' })).failures, 2, '1,5 is not an integer');
    const cmp = await run({ type: 'compare', column: 'start', operator: 'le', column2: 'slut' });
    assert.equal(cmp.failures, 1, 'start after end');
    assert.deepEqual(cmp.sampleColumns, ['start', 'slut']);
    const refRule = { type: 'reference', column: 'kod', dataset: ref, datasetName: 'Referens', refColumn: 'kod' };
    assert.equal((await run(refRule)).failures, 1, '99 is not in the reference dataset');
    const failing = await rulesMod.failingRows(id, Object.assign({ id: 'refx' }, refRule), 'Saknas i referensen');
    created.push(failing.id);
    assert.equal(failing.rowCount, 1);
    const complete = await run({ type: 'completeness', column: 'epost', minShare: 80 });
    assert.ok(complete.ok && complete.failures === 1, '4 of 5 filled in meets 80 %');
    assert.ok(!(await run({ type: 'completeness', column: 'start', minShare: 80 })).ok, '3 of 5 does not');
    assert.equal((await run({ type: 'outliers', column: 'varde', method: 'iqr', factor: 1.5 })).failures, 1, '500 is an outlier');
    assert.equal((await run({ type: 'outliers', column: 'varde', method: 'sd', factor: 1.5 })).failures, 1);
    for (const ty of rulesMod.TYPES) assert.ok(D.t('rules.type.' + ty) !== 'rules.type.' + ty, 'label for ' + ty);
    const text = rulesMod.describe({ type: 'compare', column: 'start', operator: 'le', column2: 'slut' });
    assert.ok(text.includes('≤'), text);
    return 'ok';
  });

  test('operations2: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_e) { /* already gone */ } }
    return created.length + ' datasets removed';
  });
})();
