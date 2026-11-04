// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for code steps in recipes: an R step (R ships with the app) replaces the table, previews, undoes, replays
 * and exports; the Python step shares the code path and is covered with the real Pyodide in python.test.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const ops = D.require('data/operations');
  const created = []; const chartIds = [];

  test('code steps: an R step replaces the table with types, previews on the first rows, undoes and replays', async (assert) => {
    const file = new File(['kommun;befolkning;andel\nStockholm;984748;9,37\nGöteborg;596841;5,68\nMalmö;362133;3,45\n'], 'steg.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Stegtest');
    created.push(meta.id);
    assert.ok(ops.get('r_step') && ops.get('python_step'), 'both steps registered');
    assert.equal(ops.get('r_step').group, 'code');
    const code = 'function(df) {\n  df$tusental <- round(df$befolkning / 1000)\n  df$stor <- df$befolkning > 500000\n  df[order(df$kommun), ]\n}';
    const preview = await recipes.preview(meta.id, 'r_step', { code });
    assert.equal(preview.rows, 3, 'preview rows');
    assert.deepEqual(preview.columns, ['kommun', 'befolkning', 'andel', 'tusental', 'stor']);
    assert.equal(preview.sample.length, 3);
    assert.equal(preview.sample[0][0], 'Göteborg', 'sorted in the preview');
    const result = await recipes.apply(meta.id, 'r_step', { code });
    assert.equal(result.rows, 3);
    const cols = await datasets.columns(meta.id);
    assert.deepEqual(cols.map((c) => c.name), ['kommun', 'befolkning', 'andel', 'tusental', 'stor']);
    assert.deepEqual(cols.map((c) => c.type), ['text', 'integer', 'number', 'number', 'boolean']);
    const rows = await datasets.query(meta.id);
    assert.deepEqual(rows[0], ['Göteborg', 596841, 5.68, 597, 1]);
    const steps = await recipes.steps(meta.id);
    assert.equal(steps[steps.length - 1].op, 'r_step');
    assert.ok(steps[steps.length - 1].description.startsWith(D.t('recipe.r_step', { n: '' })), steps[steps.length - 1].description);
    const r = await recipes.toR(meta.id);
    assert.ok(r.includes('df <- (function(df) {') && r.includes('df$tusental'), 'R export contains the function');
    const sql = await recipes.toSQL(meta.id);
    assert.ok(sql.includes('-- ' + D.t('code.step.sql.note', { lang: 'R' })) && sql.includes('-- function(df) {'), 'SQL export comments the code');
    assert.ok(recipes.canUndo(meta.id), 'undo available');
    await recipes.undo(meta.id);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'befolkning', 'andel'], 'undo restores the table');
    // Replay on a copy of the original dataset.
    const copy = await importer.run(file, {}, null, 'Stegtest kopia');
    created.push(copy.id);
    const done = await recipes.replay(copy.id, [{ op: 'r_step', params: { code } }]);
    assert.ok(done[0].ok, 'replayed: ' + JSON.stringify(done[0]));
    assert.equal((await datasets.columns(copy.id)).length, 5);
    // A function that fails gives R's message and leaves the table as it was.
    const failed = await recipes.replay(copy.id, [{ op: 'r_step', params: { code: 'function(df) stop("stegfel")' } }]);
    assert.equal(failed[0].ok, false);
    assert.ok(/stegfel/.test(failed[0].error), failed[0].error);
    assert.equal((await datasets.query(copy.id)).length, 3);
    const notFn = await recipes.replay(copy.id, [{ op: 'r_step', params: { code: '42' } }]);
    assert.ok(!notFn[0].ok && /function/.test(notFn[0].error), notFn[0].error);
    return 'ok';
  }, 180000);

  test('code charts: an R chart renders headless to PNG and SVG, in a document template and in a batch per group', async (assert) => {
    const charts = D.require('viz/charts'); const render = D.require('viz/render'); const codeCharts = D.require('viz/code-charts');
    const file = new File(['kommun;lan;befolkning\nStockholm;Stockholm;984748\nGöteborg;Västra Götaland;596841\nMalmö;Skåne;362133\n'], 'kodchart.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Kodchart');
    created.push(meta.id);
    assert.deepEqual(codeCharts.filterCode('r', [{ field: 'lan', op: '=', value: 'Skåne' }, { field: 'befolkning', op: '>', value: 100 }]),
      ['df <- df[!is.na(as.character(df[["lan"]]) == "Skåne") & (as.character(df[["lan"]]) == "Skåne"), , drop = FALSE]', 'df <- df[!is.na(df[["befolkning"]] > 100) & (df[["befolkning"]] > 100), , drop = FALSE]']);
    assert.deepEqual(codeCharts.filterCode('python', [{ field: 'lan', op: 'in', value: ['Skåne', 'Halland'] }, { field: 'x', op: 'empty' }]), ['df = df[df["lan"].astype(str).isin(["Skåne", "Halland"])]', 'df = df[(df["x"].isna() | (df["x"].astype(str) == ""))]']);
    assert.equal(codeCharts.prelude('python', 'kodchart', []), 'df = dm_read("kodchart")\n');
    const chart = charts.create('r', meta, 'Kodchart R');
    chart.r.code = 'barplot(df$befolkning, names.arg = df$kommun, main = paste(nrow(df), "kommuner"))';
    const png = await render.toBlob(chart, 'png', { width: 640, height: 400 });
    assert.ok(png.type === 'image/png' && png.size > 1000, 'png ' + png.size);
    const svg = await render.toBlob(chart, 'svg', { width: 640, height: 400, extraFilters: [{ field: 'lan', op: '=', value: 'Skåne' }] });
    assert.ok((await svg.text()).includes('<svg'), 'svg with a filter');
    const saved = await charts.save(chart);
    chartIds.push(saved.id);
    // In a document template the chart becomes a PNG like the other kinds.
    const template = D.require('docgen/template');
    const ctx = await template.buildContext(meta.id);
    const res = await template.renderTemplate('Intro\n{{diagram "Kodchart R" | bredd: 480}}\nSlut', ctx);
    assert.ok(res.images.length === 1 && res.images[0].png && res.images[0].png.byteLength > 1000, 'document image: ' + JSON.stringify(res.images.map((i) => i.error || i.width)));
    // Batch per group without an open panel goes through the engine too.
    const batch = await D.require('viz/batch').run(saved, { groupColumn: 'lan', formats: ['png'], pattern: '{diagram}-{grupp}', width: 400 });
    assert.equal(batch.count, 3, 'one file per county: ' + JSON.stringify(batch.errors));
    return `png ${png.size} bytes; batch ${batch.files.join(', ')}`;
  }, 240000);

  test('code steps: cleanup', async (assert) => {
    for (const id of chartIds) await D.require('viz/charts').remove(id);
    for (const id of created) await datasets.remove(id);
    assert.ok(true);
  });
})();
