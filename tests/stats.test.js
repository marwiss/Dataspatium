// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for statistics without code, time series and model steps: the forms' code with names that need quoting, results
 * from R checked against values worked out by hand, saved models as recipe steps (in SQL, without an engine), period
 * parsing, change, index, moving averages and seasonal adjustment, the chart types, and the tab. Python is only exercised
 * with the real runtime (?python=1). Own test data only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const stats = D.require('analysis/stats');
  const models = D.require('data/models');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const ops = D.require('data/operations');
  const builder = D.require('viz/vega-builder');
  const rb = D.require('data/r-bridge').bridge;
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  async function make(name, columns, rows) {
    const meta = await datasets.create({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows });
    created.push(meta.id);
    return meta;
  }
  const rowsOf = async (id) => datasets.query(id, {});
  const col = (r, name) => r.table.columns.findIndex((c) => c.name === name);

  test('stats: the forms write readable code in R and Python, with names that need care', async (assert) => {
    const ds = { name: 'Min tabell', shortName: 'min_tabell' };
    const code = stats.code('regression', { kind: 'linear', target: 'pris kr', predictors: ['yta m2', 'typ'] }, ds, 'r');
    assert.ok(code.includes('dm_read("min_tabell")'), code);
    assert.ok(code.includes('`pris kr` ~ `yta m2` + `typ`'), code);
    assert.ok(!code.includes('@@'), 'no plumbing in what the user reads');
    const py = stats.code('regression', { kind: 'logistic', target: 'utfall', predictors: ['a'] }, ds, 'python');
    assert.ok(py.includes('sm.Logit') && py.includes('dm_read("min_tabell")'), py);
    for (const tool of stats.TOOLS) {
      if (tool === 'trend') { assert.ok(stats.code(tool, { period: 'a', value: 'b', fn: 'mean' }, ds, 'r').length > 20); assert.ok(stats.code(tool, { period: 'a', value: 'b', fn: 'sum' }, ds, 'python').length > 20); continue; }
      const p = { columns: ['a', 'b'], row: 'a', column: 'b', value: 'a', group: 'b', test: 't_two', target: 'a', predictors: ['b'], k: 2 };
      assert.ok(stats.code(tool, p, ds, 'r').length > 20, tool);
      assert.ok(stats.code(tool, p, ds, 'python').length > 20, tool);
    }
    for (const kind of stats.TESTS) assert.ok(stats.code('test', { test: kind, value: 'a', value2: 'b', group: 'c', mu: 5 }, ds, 'r').includes('test') || kind === 'anova', kind);
    let message = '';
    try { stats.code('crosstab', { row: '' }, ds, 'r'); } catch (err) { message = err.message; }
    assert.equal(message, t('stats.err.field'));
    message = '';
    try { stats.code('correlation', { columns: ['a'] }, ds, 'r'); } catch (err) { message = err.message; }
    assert.equal(message, t('stats.err.two.columns'));
    return 'ok';
  });

  test('stats: R gives the values one can work out by hand, for each tool', async (assert) => {
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push([i, 2 * i + 1, i % 2 ? 'udda' : 'jämn', i <= 5 ? 'låg' : 'hög']);
    const meta = await make('Statdata', [['x', 'integer'], ['y', 'integer'], ['paritet', 'text'], ['niva', 'text']], rows);
    await rb.start();
    // Descriptive: mean 5.5, median 5.5, min 1, max 10 and 0 missing.
    const d = await stats.run('describe', { columns: ['x'] }, meta);
    const r0 = d.table.rows[0];
    assert.equal(r0[col(d, 'medel')], 5.5); assert.equal(r0[col(d, 'median')], 5.5); assert.equal(r0[col(d, 'min')], 1); assert.equal(r0[col(d, 'max')], 10); assert.equal(r0[col(d, 'saknas')], 0);
    assert.ok(near(r0[col(d, 'sd')], 3.0276503541, 1e-6), 'sd: ' + r0[col(d, 'sd')]);
    assert.ok(d.plots.length === 1, 'a histogram for one column');
    assert.ok(!d.output.includes('@@'), 'no plumbing in the printout');
    const byGroup = await stats.run('describe', { columns: ['x', 'y'], group: 'niva' }, meta);
    assert.equal(byGroup.table.rows.length, 4, 'two columns in two groups');
    assert.equal(byGroup.table.rows.find((row) => row[0] === 'hög' && row[1] === 'x')[col(byGroup, 'medel')], 8);
    // Crosstab: five odd and five even in each direction; chi² on a table of counts.
    const c = await stats.run('crosstab', { row: 'paritet', column: 'niva', percent: 'none' }, meta);
    assert.equal(c.table.rows.length, 2);
    assert.ok(typeof c.values.p === 'number' && c.values.frihetsgrader === 1, JSON.stringify(c.values));
    // Correlation: y is a straight line in x.
    const corr = await stats.run('correlation', { columns: ['x', 'y'], method: 'pearson' }, meta);
    assert.ok(near(corr.table.rows[0][col(corr, 'y')], 1, 1e-9), 'perfect correlation');
    // A t-test: the groups differ by 5 with a small spread; a p-value well under 0.01.
    const tt = await stats.run('test', { test: 't_two', value: 'x', group: 'niva' }, meta);
    assert.ok(tt.values.p < 0.01, 'p: ' + tt.values.p);
    assert.ok(near(Math.abs(tt.table.rows[0][col(tt, 'skattning')] - tt.table.rows[0][col(tt, 'skattning2')]), 5), 'estimates 3 and 8');
    const one = await stats.run('test', { test: 't_one', value: 'x', mu: 5.5 }, meta);
    assert.ok(near(one.values.p, 1, 1e-9), 'the mean equals the value: ' + one.values.p);
    const paired = await stats.run('test', { test: 't_paired', value: 'y', value2: 'x' }, meta);
    assert.ok(paired.values.p < 0.001, 'paired: ' + paired.values.p);
    const anova = await stats.run('test', { test: 'anova', value: 'x', group: 'niva' }, meta);
    assert.ok(near(anova.values.p, tt.values.p, 0.01), 'anova with two groups agrees with the t-test');
    assert.equal(anova.table.rows.length, 2);
    let message = '';
    try { await stats.run('test', { test: 't_two', value: 'x', group: 'y' }, meta); } catch (err) { message = err.message; }
    assert.equal(message, t('stats.err.two.groups'), 'too many groups gets advice');
    // Clustering: two groups far apart are found, whatever their numbers.
    const far = await make('Klusterdata', [['a', 'number'], ['b', 'number']], [[1, 1], [1.1, 1], [0.9, 1.1], [50, 50], [50.1, 50], [49.9, 50.1]]);
    const k = await stats.run('cluster', { columns: ['a', 'b'], k: 2, scale: true, save: true, saveName: 'Med kluster' }, far);
    assert.deepEqual(k.table.rows.map((row) => row[col(k, 'antal')]).sort(), [3, 3]);
    assert.ok(k.values.forklarad > 0.99, 'explained: ' + k.values.forklarad);
    assert.equal(k.datasets[0].name, 'Med kluster');
    created.push(k.datasets[0].id);
    assert.ok((await datasets.columns(k.datasets[0].id)).some((c2) => c2.name === 'kluster'), 'the dataset has the cluster');
    return 'ok';
  }, 180000);

  test('stats: a regression becomes a model, and Prediktion applies it in SQL on other data, with undo and the codebook', async (assert) => {
    const rows = [];
    for (let i = 1; i <= 12; i++) rows.push([i, i % 2 ? 'a' : 'b', 3 + 2 * i + (i % 2 ? 0 : 10)]);
    const meta = await make('Modelldata', [['x', 'integer'], ['grupp', 'text'], ['y', 'number']], rows);
    const res = await stats.run('regression', { kind: 'linear', target: 'y', predictors: ['x', 'grupp'] }, meta);
    assert.ok(near(res.values.r2, 1, 1e-9), 'an exact line: ' + res.values.r2);
    const model = models.fromResult({ name: 'Priset', kind: 'linear', target: 'y', predictors: ['x', 'grupp'], table: res.table, values: res.values });
    assert.ok(near(model.intercept, 3, 1e-6), 'intercept: ' + model.intercept);
    assert.ok(near(model.terms.find((x) => x.column === 'x').coefficient, 2, 1e-6));
    const dummy = model.terms.find((x) => x.column === 'grupp');
    assert.equal(dummy.level, 'b'); assert.ok(near(dummy.coefficient, 10, 1e-6));
    assert.ok(models.describe(model).startsWith('y = 3 + 2 × x + 10 × (grupp = b)'), models.describe(model));
    assert.deepEqual(models.missing(model, [{ name: 'x' }]), ['grupp']);
    // Kept in the dataset, and it follows the file.
    await models.save(meta.id, model);
    assert.ok((await models.list()).some((m) => m.id === model.id && m.datasetId === meta.id));
    await datasets.flushSaves();
    datasets.close(meta.id);
    assert.equal((await datasets.ensureOpen(meta.id)).meta.models[0].name, 'Priset');
    // On another dataset, a level it has not seen counts as the reference.
    const other = await make('Nya data', [['x', 'integer'], ['grupp', 'text']], [[100, 'a'], [100, 'b'], [100, 'c'], [null, 'a']]);
    await recipes.apply(other.id, 'predict_model', { model, name: 'pris' });
    const out = await rowsOf(other.id);
    assert.deepEqual(out.map((r) => r[2]), [203, 213, 203, null]);
    const column = (await datasets.columns(other.id)).find((c) => c.name === 'pris');
    assert.ok(column.description.includes('Priset') && column.description.includes('R²'), 'the codebook describes the model: ' + column.description);
    assert.ok((await recipes.toSQL(other.id)).includes('grupp'), 'readable in the SQL');
    assert.ok((await recipes.toR(other.id)).includes('df[["x"]]'), 'and in R');
    await recipes.undo(other.id);
    assert.ok(!(await datasets.columns(other.id)).some((c) => c.name === 'pris'), 'undo');
    // A recipe carries the model and replays without the dataset that fitted it.
    await recipes.apply(other.id, 'predict_model', { model, name: 'pris' });
    const steps = await recipes.steps(other.id);
    const third = await make('Tredje', [['x', 'integer'], ['grupp', 'text']], [[1, 'b']]);
    await recipes.replay(third.id, steps);
    assert.equal((await rowsOf(third.id))[0][2], 15);
    let message = '';
    const lacking = await make('Saknar', [['z', 'integer']], [[1]]);
    try { await recipes.apply(lacking.id, 'predict_model', { model, name: 'pris' }); } catch (err) { message = err.message; }
    assert.equal(message, t('predict.err.columns', { columns: 'x, grupp' }));
    // Logistic: predictions are probabilities.
    const logit = await make('Utfall', [['x', 'number'], ['ja', 'text']], [[1, 'nej'], [2, 'nej'], [3, 'ja'], [4, 'nej'], [5, 'ja'], [6, 'ja'], [2.5, 'ja'], [3.5, 'nej']]);
    const lr = await stats.run('regression', { kind: 'logistic', target: 'ja', predictors: ['x'] }, logit);
    assert.deepEqual(lr.values.nivaer, ['ja', 'nej']);
    const lm = models.fromResult({ name: 'Sannolikhet', kind: 'logistic', target: 'ja', predictors: ['x'], table: lr.table, values: lr.values });
    assert.equal(lm.positive, 'nej');
    await recipes.apply(logit.id, 'predict_model', { model: lm, name: 'p' });
    const ps = (await rowsOf(logit.id)).map((r) => r[2]);
    assert.ok(ps.every((v) => v > 0 && v < 1), JSON.stringify(ps));
    await models.remove(meta.id, model.id);
    assert.ok(!(await models.list()).some((m) => m.id === model.id));
    return 'ok';
  }, 120000);

  test('timeseries: periods are understood in the formats of SDMX, PxWeb and dates', async (assert) => {
    const meta = await make('Perioder', [['tid', 'text']], [['2024M03'], ['2024M3'], ['2024-03'], ['202403'], ['2024K1'], ['2024Q1'], ['2024-Q1'], ['Q1 2024'], ['2024'], ['2024-03-15'], ['nonsens'], ['2024M13']]);
    await recipes.apply(meta.id, 'ts_period', { column: 'tid', frequency: 'auto', name: 'period' });
    const rows = await rowsOf(meta.id);
    assert.deepEqual(rows.map((r) => r[1]), ['2024-03', '2024-03', '2024-03', '2024-03', '2024-Q1', '2024-Q1', '2024-Q1', '2024-Q1', '2024', '2024-03', null, null]);
    assert.deepEqual(rows.slice(0, 1).concat(rows.slice(4, 5), rows.slice(8, 9)).map((r) => r[2]), ['2024-03-01', '2024-01-01', '2024-01-01']);
    assert.equal((await datasets.columns(meta.id)).find((c) => c.name === 'period_datum').type, 'date');
    const engine = (await datasets.ensureOpen(meta.id)).engine;
    const one = async (sql) => (await engine.exec('select ' + sql))[0].values[0][0];
    assert.equal(await one("dm_period('2024M03', 'quarter')"), '2024-Q1');
    assert.equal(await one("dm_period('2024M11', 'year')"), '2024');
    assert.equal(await one("dm_period('2024', 'month')"), null);
    assert.equal(await one("dm_period_shift('2024-Q2', -1)"), '2023-Q2');
    assert.equal(await one("dm_period(2024, 'auto')"), '2024', 'years as numbers');
    assert.ok(near(await one('dm_logistic(0)'), 0.5));
    let message = '';
    try { await recipes.apply(meta.id, 'ts_period', { column: 'tid', frequency: 'auto', name: 'period' }); } catch (err) { message = err.message; }
    assert.equal(message, t('op.err.column.exists', { name: 'period' }));
    assert.ok((await recipes.toR(meta.id)).includes('dm_period('), 'R has the same helper');
    return 'ok';
  });

  test('timeseries: change, index, moving average and rolling up, per series and out of order', async (assert) => {
    // Two series, out of order: A grows 10 a month from 100, B doubles.
    const rows = [];
    for (let m = 1; m <= 14; m++) {
      const p = `${m <= 12 ? 2023 : 2024}M${String(m <= 12 ? m : m - 12).padStart(2, '0')}`;
      rows.push([p, 'A', 100 + (m - 1) * 10]); rows.push([p, 'B', 2 ** (m - 1)]);
    }
    rows.reverse();
    const meta = await make('Serier', [['tid', 'text'], ['serie', 'text'], ['varde', 'number']], rows);
    await recipes.apply(meta.id, 'ts_change', { column: 'varde', period: 'tid', groups: ['serie'], compare: 'previous', mode: 'absolute', name: 'skillnad' });
    await recipes.apply(meta.id, 'ts_change', { column: 'varde', period: 'tid', groups: ['serie'], compare: 'previous', mode: 'percent', name: 'procent' });
    await recipes.apply(meta.id, 'ts_change', { column: 'varde', period: 'tid', groups: ['serie'], compare: 'year', mode: 'percent', name: 'arstakt' });
    await recipes.apply(meta.id, 'ts_index', { column: 'varde', period: 'tid', groups: ['serie'], base: '2023-01', name: 'index' });
    await recipes.apply(meta.id, 'ts_moving', { column: 'varde', period: 'tid', groups: ['serie'], window: 3, name: 'glidande' });
    await recipes.apply(meta.id, 'ts_moving', { column: 'varde', period: 'tid', groups: ['serie'], window: 3, centered: true, name: 'centrerad' });
    const read = async (tid, serie) => { const cols = (await datasets.columns(meta.id)).map((c) => c.name); const r = (await rowsOf(meta.id)).find((x) => x[0] === tid && x[1] === serie); return Object.fromEntries(cols.map((c, i) => [c, r[i]])); };
    const first = await read('2023M01', 'A');
    assert.equal(first.skillnad, null, 'nothing before the first period');
    assert.equal(first.glidande, null, 'only full windows');
    assert.equal(first.index, 100);
    const third = await read('2023M03', 'A');
    assert.equal(third.skillnad, 10); assert.ok(near(third.procent, 100 * 10 / 110)); assert.equal(third.glidande, 110); assert.equal(third.index, 120);
    assert.equal((await read('2023M02', 'A')).centrerad, 110, 'centred on the month');
    assert.equal((await read('2023M01', 'A')).centrerad, null);
    assert.equal(third.arstakt, null, 'no year before');
    const year = await read('2024M01', 'A');
    assert.ok(near(year.arstakt, (220 - 100) / 100 * 100), 'a year on: ' + year.arstakt);
    const b = await read('2024M02', 'B');
    assert.ok(near(b.skillnad, 2 ** 13 - 2 ** 12), 'series do not mix: ' + b.skillnad);
    let message = '';
    try { await recipes.apply(meta.id, 'ts_index', { column: 'varde', period: 'tid', groups: ['serie'], base: '1999', name: 'x' }); } catch (err) { message = err.message; }
    assert.equal(message, t('op.ts.err.base.missing', { base: '1999' }));
    // A year as base takes the mean of its months.
    await recipes.apply(meta.id, 'ts_index', { column: 'varde', period: 'tid', groups: ['serie'], base: '2023', name: 'arsindex' });
    assert.ok(near((await read('2023M01', 'A')).arsindex, 100 / 155 * 100, 1e-6), 'mean of 100..210 is 155');
    // Rolling up replaces the table, and can be undone.
    const before = (await rowsOf(meta.id)).length;
    await recipes.apply(meta.id, 'ts_aggregate', { period: 'tid', to: 'quarter', columns: ['varde'], how: 'sum', groups: ['serie'] });
    const q = await rowsOf(meta.id);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['tid', 'serie', 'varde']);
    assert.equal(q.length, 10, 'five quarters in two series');
    assert.equal(q.find((r) => r[0] === '2023-Q1' && r[1] === 'A')[2], 100 + 110 + 120);
    await recipes.undo(meta.id);
    assert.equal((await rowsOf(meta.id)).length, before, 'undo');
    await recipes.apply(meta.id, 'ts_aggregate', { period: 'tid', to: 'year', columns: ['varde'], how: 'last', groups: ['serie'] });
    assert.equal((await rowsOf(meta.id)).find((r) => r[0] === '2023' && r[1] === 'A')[2], 210, 'the last value of the year');
    await recipes.undo(meta.id);
    assert.ok((await recipes.toR(meta.id)).includes('dplyr::lag'));
    assert.ok((await recipes.toSQL(meta.id)).includes('dm_period'));
    return 'ok';
  }, 60000);

  test('timeseries: seasonal adjustment through R, and the chart types', async (assert) => {
    const rows = [];
    for (let y = 2020; y <= 2023; y++) for (let m = 1; m <= 12; m++) rows.push([`${y}-${String(m).padStart(2, '0')}`, 100 + (y - 2020) * 12 + m + (m === 7 ? 30 : 0)]);
    rows.push(['2024-01', 150]);
    const meta = await make('Säsong', [['tid', 'text'], ['varde', 'number']], rows);
    await recipes.apply(meta.id, 'ts_seasonal', { column: 'varde', period: 'tid', groups: [], frequency: '12', name: 'rensad' });
    const cols = (await datasets.columns(meta.id)).map((c) => c.name);
    assert.ok(['rensad', 'rensad_trend', 'rensad_sasong'].every((c) => cols.includes(c)), cols.join());
    const out = await rowsOf(meta.id);
    const get = (tid, c) => out.find((r) => r[0] === tid)[cols.indexOf(c)];
    assert.ok(get('2021-07', 'rensad_sasong') > 15, 'July stands out: ' + get('2021-07', 'rensad_sasong'));
    assert.ok(Math.abs(get('2021-07', 'rensad') - get('2021-06', 'rensad')) < 8, 'and the adjusted series does not');
    await recipes.undo(meta.id);
    const sparse = await make('Kort', [['tid', 'text'], ['varde', 'number']], [['2024-01', 1], ['2024-02', 2]]);
    await recipes.apply(sparse.id, 'ts_seasonal', { column: 'varde', period: 'tid', groups: [], frequency: '12', name: 'rensad' });
    assert.equal((await rowsOf(sparse.id))[0][2], null, 'too short: empty, not wrong');
    assert.ok(builder.CHART_TYPES.some((c) => c.id === 'timeseries') && builder.CHART_TYPES.some((c) => c.id === 'smallmultiples'));
    const columns = [{ name: 'tid', type: 'date' }, { name: 'serie', type: 'text' }, { name: 'varde', type: 'number' }];
    const ts = builder.defaultState('timeseries', columns);
    assert.equal(ts.x.field, 'tid'); assert.equal(ts.y.field, 'varde'); assert.equal(ts.color.field, 'serie');
    const small = builder.defaultState('smallmultiples', columns);
    assert.equal(small.facet.field, 'serie');
    assert.equal(ops.get('ts_change').group, 'timeseries');
    return 'ok';
  }, 120000);

  test('ui: the Statistik tab writes the code, runs it and keeps a regression as a model', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const tabs = () => Array.from(root.querySelectorAll('.dm-center [role="tab"], .dm-center dm-tabs button'));
    const tabByText = (text) => tabs().find((b) => b.textContent.trim() === text);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const rows = [];
      for (let i = 1; i <= 8; i++) rows.push([i, 2 * i, i <= 4 ? 'a' : 'b']);
      const meta = await make('Fliktabell', [['x', 'integer'], ['y', 'integer'], ['g', 'text']], rows);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'dataset');
      shell.store.set({ selectedId: meta.id });
      shell.activate('analysera');
      const tab = await waitFor(() => tabByText(t('analysera.tabs.stats')), 5000, 'the tab');
      const names = tabs().map((b) => b.textContent.trim());
      assert.ok(names.indexOf(t('analysera.tabs.stats')) === names.indexOf(t('analysera.tabs.regex')) + 1, 'right after Regex');
      assert.ok(names.indexOf(t('analysera.tabs.stats')) < names.indexOf(t('analysera.tabs.notebook')), 'before the notebook');
      tab.click();
      await waitFor(() => tabByText(t('stats.tool.regression')), 5000, 'the tools');
      assert.ok(await waitFor(() => { const c = root.querySelector('.dm-stats-code'); return c && /dm_read/.test(c.value || c.textContent || ''); }, 5000, 'the code in the form'));
      await waitFor(() => buttonByText(t('stats.run')), 3000, 'run');
      buttonByText(t('stats.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length >= 2, 60000, 'the result table');
      assert.ok(root.querySelector('.dm-tool-result').textContent.includes(t('stats.col.medel')), 'translated headings');
      // A regression that can be saved as a model.
      tabByText(t('stats.tool.regression')).click();
      await waitFor(() => Array.from(root.querySelectorAll('dm-switch')).some((x) => x.getAttribute('label') === 'x'), 3000, 'the predictors');
      const target = Array.from(root.querySelectorAll('dm-select')).find((e) => e.getAttribute('label') === t('stats.field.target'));
      /** @type {any} */ (target).value = 'y';
      target.dispatchEvent(new Event('change', { bubbles: true }));
      const sw = Array.from(root.querySelectorAll('dm-switch')).find((x) => x.getAttribute('label') === 'x');
      /** @type {any} */ (sw).checked = true;
      sw.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => { const c = root.querySelector('.dm-stats-code'); return c && /lm\(`y` ~ `x`/.test(c.value || ''); }, 3000, 'the formula in the code');
      buttonByText(t('stats.run')).click();
      await waitFor(() => buttonByText(t('stats.model.save')), 60000, 'the model button');
      assert.ok(root.querySelector('.dm-stats-say').textContent.includes('100'), 'a perfect line is said in plain words: ' + root.querySelector('.dm-stats-say').textContent);
      // Taking the code to the console.
      buttonByText(t('stats.code.open')).click();
      await waitFor(() => { const r = shell.store.get().pendingCode; return r === null || r === undefined; }, 3000, 'the code taken');
      return 'ok';
    } finally { root.remove(); }
  }, 180000);

  test('stats: Python gives the same results when the runtime is there', async (assert) => {
    const params = new URLSearchParams(location.search);
    const catalog = D.require('engines/python/catalog');
    if (params.get('python') !== '1' && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached';
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push([i, 2 * i + 1, i <= 5 ? 'a' : 'b']);
    const meta = await make('Pystat', [['x', 'integer'], ['y', 'integer'], ['g', 'text']], rows);
    const d = await stats.run('describe', { columns: ['x'] }, meta, 'python');
    assert.equal(d.table.rows[0][col(d, 'medel')], 5.5);
    const r = await stats.run('regression', { kind: 'linear', target: 'y', predictors: ['x'] }, meta, 'python');
    assert.ok(near(r.values.r2, 1, 1e-9), JSON.stringify(r.values));
    const model = models.fromResult({ name: 'Py', kind: 'linear', target: 'y', predictors: ['x'], table: r.table, values: r.values, lang: 'python' });
    assert.ok(near(model.intercept, 1, 1e-6) && near(model.terms[0].coefficient, 2, 1e-6), JSON.stringify(model));
    const tt = await stats.run('test', { test: 't_two', value: 'x', group: 'g' }, meta, 'python');
    assert.ok(tt.values.p < 0.01);
    const dummy = await stats.run('regression', { kind: 'linear', target: 'y', predictors: ['g'] }, meta, 'python');
    const dm = models.fromResult({ name: 'Py2', kind: 'linear', target: 'y', predictors: ['g'], table: dummy.table, values: dummy.values, lang: 'python' });
    assert.equal(dm.terms[0].column, 'g'); assert.equal(dm.terms[0].level, 'b');
    return 'ok';
  }, 240000);

  test('recipes: every operation reads as a sentence or its name, never as its id', async (assert) => {
    const ops = D.require('data/operations');
    const raw = ops.list().map((op) => op.id).filter((id) => {
      try { return recipes.describe(id, { columns: ['a'], column: 'a', name: 'b' }, { rows: 1 }) === id; } catch (_e) { return false; }
    });
    assert.equal(raw.join(', '), '', 'no raw ids');
    const text = recipes.describe('ts_change', { column: 'varde', period: 'tid', groups: ['serie', 'kon'], compare: 'year', mode: 'percent', name: 'arstakt' });
    assert.ok(text.includes('arstakt') && text.includes('varde') && text.includes('serie, kon') && !text.includes('{'), text);
    const roll = recipes.describe('ts_aggregate', { period: 'tid', to: 'quarter', how: 'sum', columns: ['varde'] }, { rows: 4 });
    assert.ok(roll.includes('varde') && roll.includes('4') && !roll.includes('{') && !roll.includes('op.'), roll);
    assert.ok(recipes.describe('predict_model', { model: { name: 'Modell A' }, name: 'p' }).includes('Modell A'));
    assert.equal(recipes.describe('graph_add_node', { id: 'n1' }), D.t('op.graph_add_node'));
    return 'ok';
  });
  test('op-dialog: every option and field of every operation has a text in the UI language', async (assert) => {
    const ops = D.require('data/operations');
    const dialog = D.require('ui/op-dialog');
    const raw = [];
    for (const op of ops.list()) {
      for (const p of op.params || []) {
        if (dialog.paramLabel(op.id, p) === p.name) raw.push(`${op.id}.${p.name}`);
        for (const v of Array.isArray(p.options) ? p.options : []) {
          if (/[a-z]/i.test(String(v)) && dialog.optionLabel(p, v, op.id) === String(v)) raw.push(`${op.id}.${p.name}=${v}`);
        }
      }
    }
    assert.equal(raw.join(', '), '', 'no raw names');
    const to = ops.get('ts_aggregate').params.find((p) => p.name === 'to');
    assert.equal(dialog.optionLabel(to, 'quarter', 'ts_aggregate'), D.t('op.ts_aggregate.to.quarter'));
    const mode = ops.get('ts_change').params.find((p) => p.name === 'mode');
    assert.equal(dialog.optionLabel(mode, 'absolute', 'ts_change'), D.t('op.ts_change.mode.absolute'));
    return 'ok';
  });
  test('op-dialog: the step Prediction picks a saved model in the real dialog, and the options read as text', async (assert) => {
    const opDialog = D.require('ui/op-dialog');
    const meta = await make('Dialogmodell', [['x', 'integer'], ['grupp', 'text']], [[10, 'a'], [20, 'b']]);
    const model = { id: 'dialog-model', name: 'Dialogens modell', kind: 'linear', target: 'y', predictors: ['x'], intercept: 1, terms: [{ column: 'x', level: null, coefficient: 2 }], metrics: { n: 2, r2: 1, aic: null } };
    await models.save(meta.id, model);
    const opened = async () => {
      let dialog = null;
      for (let i = 0; i < 100 && !dialog; i++) { await wait(30); dialog = Array.from(document.querySelectorAll('dialog[open]')).pop() || null; }
      assert.ok(dialog, 'the dialog opened');
      return dialog;
    };
    const press = (dialog, last) => {
      const buttons = dialog.querySelectorAll('.dm-dialog-actions dm-button button');
      /** @type {HTMLElement} */ (buttons[last ? buttons.length - 1 : 0]).click();
    };
    const columns = await datasets.columns(meta.id);
    const done = opDialog.open({ datasetId: meta.id, opId: 'predict_model', columns });
    const dialog = await opened();
    const pick = /** @type {any} */ (dialog.querySelector('dm-select'));
    await waitFor(() => pick.options && pick.options.length > 1, 5000, 'the saved models');
    assert.ok(pick.options.some((o) => o.label.includes('Dialogens modell')), 'the model is listed');
    pick.value = model.id;
    pick.dispatchEvent(new Event('change', { bubbles: true }));
    press(dialog, true);
    assert.ok(await done, 'applied');
    assert.deepEqual((await rowsOf(meta.id)).map((r) => r[2]), [21, 41], 'calculated');
    const steps = await recipes.steps(meta.id);
    const step = steps[steps.length - 1];
    assert.equal(step.op, 'predict_model');
    assert.equal(step.params.model.name, 'Dialogens modell', 'the step carries a copy');
    assert.equal(step.params.model.datasetId, undefined, 'without the dataset that fitted it');
    assert.ok(step.description.includes('Dialogens modell') && step.description !== 'predict_model', step.description);
    const again = opDialog.open({ datasetId: meta.id, opId: 'ts_aggregate', columns });
    const roll = await opened();
    const labels = Array.from(roll.querySelectorAll('dm-select')).flatMap((sel) => (/** @type {any} */ (sel).options || []).map((o) => o.label));
    assert.ok(labels.includes(t('op.ts_aggregate.to.quarter')) && labels.includes(t('op.ts_aggregate.how.sum')), 'option texts: ' + labels.join(', '));
    assert.ok(!labels.includes('quarter') && !labels.includes('sum'), 'no raw values');
    press(roll, false);
    await again;
    return 'ok';
  });
  test('viz: the chart types Tidsserie and Små multipler really draw one line per series', async (assert) => {
    const render = D.require('viz/render');
    const rows = [];
    for (const serie of ['Alfa', 'Beta', 'Gamma']) for (let m = 1; m <= 6; m++) rows.push([`2024-0${m}-01`, serie, m * (serie === 'Alfa' ? 1 : serie === 'Beta' ? 2 : 3)]);
    const columns = [['tid', 'date'], ['serie', 'text'], ['varde', 'number']];
    const meta = await make('Diagramserier', columns, rows);
    const cols = columns.map(([name, type]) => ({ name, type }));
    const lines = (svg) => (svg.match(/mark-line role-mark/g) || []).length;
    const size = (svg) => Number((svg.match(/<svg[^>]*[ ]width="([0-9.]+)"/) || [])[1] || 0);
    const line = await (await render.toBlob({ kind: 'vega', datasetId: meta.id, vega: { state: builder.defaultState('timeseries', cols) } }, 'svg', { width: 600 })).text();
    assert.equal(lines(line), 3, 'one line per series');
    assert.ok(size(line) > 100, 'has a size: ' + size(line));
    assert.ok(['Alfa', 'Beta', 'Gamma'].every((name) => line.includes(name)), 'the legend names the series');
    const small = await (await render.toBlob({ kind: 'vega', datasetId: meta.id, vega: { state: builder.defaultState('smallmultiples', cols) } }, 'svg', { width: 800 })).text();
    assert.equal(lines(small), 3, 'one small chart per series');
    assert.ok(['Alfa', 'Beta', 'Gamma'].every((name) => small.includes(name)), 'each panel is named');
    assert.ok(size(small) > 100, 'has a size: ' + size(small));
    return 'ok';
  }, 60000);
  test('stats: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
