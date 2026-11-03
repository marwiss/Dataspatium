// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for notebooks: Markdown, SQL and R cells, saved outputs, exports and the workspace files. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const notebooks = D.require('analysis/notebooks');
  const workspace = D.require('data/workspace');
  const created = []; const nbIds = [];

  test('notebooks: Markdown and SQL cells run, save, export to HTML, Markdown and Word, and travel in the workspace', async (assert) => {
    const meta = await importer.run(new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\nMalmö;362133\n'], 'nb.csv', { type: 'text/csv' }), {}, null, 'Notebooktest');
    created.push(meta.id);
    const nb = notebooks.create('Testbok', meta);
    assert.equal(nb.cells.length, 3);
    assert.deepEqual(nb.cells.map((c) => c.type), ['markdown', 'r', 'sql']);
    nb.cells[0].source = '# Rapport\n\nEn **test** med *kursiv* text.\n\n- punkt ett\n- punkt två';
    nb.cells.splice(1, 1); // the R cell is covered by the next test
    const sqlCell = nb.cells[1];
    sqlCell.source = 'select kommun, befolkning from data order by befolkning desc';
    await notebooks.runCell(nb, sqlCell);
    assert.equal(sqlCell.outputs.length, 1);
    assert.equal(sqlCell.outputs[0].kind, 'table');
    assert.deepEqual(sqlCell.outputs[0].columns, ['kommun', 'befolkning']);
    assert.equal(sqlCell.outputs[0].rows[0][0], 'Stockholm');
    assert.ok(sqlCell.ran && typeof sqlCell.ms === 'number');
    const mut = notebooks.cell('sql', "update data set kommun = 'Sthlm' where kommun = 'Stockholm'");
    nb.cells.push(mut);
    await notebooks.runCell(nb, mut);
    assert.equal(mut.outputs[0].kind, 'text');
    assert.ok(/1 rader/.test(mut.outputs[0].text), mut.outputs[0].text);
    const log = await datasets.log(meta.id);
    assert.ok(log.some((e) => e.action === 'op' && e.details && e.details.op === 'sql'), 'mutation logged as a recipe step');
    const bad = notebooks.cell('sql', 'select * from nothing_here');
    await notebooks.runCell(nb, bad);
    assert.equal(bad.outputs[0].kind, 'error', 'a failing statement becomes an error output');
    const saved = await notebooks.save(nb);
    nbIds.push(saved.id);
    assert.ok((await notebooks.list()).some((n) => n.id === saved.id), 'listed');
    assert.equal((await notebooks.get(saved.id)).cells[1].outputs[0].rows.length, 3, 'outputs are stored');

    const html = await (await notebooks.exportNotebook(saved, 'html')).blob.text();
    assert.ok(html.includes('<h1>Rapport</h1>'), 'heading');
    assert.ok(html.includes('<strong>test</strong>') && html.includes('<em>kursiv</em>') && html.includes('<li>punkt ett</li>'), 'inline markup and list');
    assert.ok(html.includes('<pre class="code lang-sql"><code>select kommun'), 'code block');
    assert.ok(html.includes('<table') && html.includes('Stockholm'), 'table output');
    assert.ok(html.includes('1 rader påverkade'), 'text output; tail: ' + html.slice(-400).replace(/\s+/g, ' '));
    const noCode = await (await notebooks.exportNotebook(saved, 'html', { includeCode: false })).blob.text();
    assert.ok(!noCode.includes('lang-sql') && noCode.includes('<table'), 'code can be left out');
    const md = await notebooks.exportNotebook(saved, 'md');
    assert.ok(md.filename.endsWith('.md'), md.filename);
    const mdText = await md.blob.text();
    assert.ok(mdText.includes('# Rapport') && mdText.includes('```sql') && mdText.includes('| kommun |'), mdText.slice(0, 300));
    const docx = await notebooks.exportNotebook(saved, 'docx');
    assert.ok(docx.blob.size > 2000 && docx.filename.endsWith('.docx'), 'docx ' + docx.blob.size);
    const tex = await notebooks.exportNotebook(saved, 'tex');
    assert.ok(tex.filename.endsWith('.zip'));

    const json = notebooks.exportJson(saved);
    const parsed = JSON.parse(json);
    assert.equal(parsed.format, 'dataspatium-notebook/1');
    assert.equal(parsed.datasetName, 'Notebooktest');
    const imported = await notebooks.importJson(json);
    nbIds.push(imported.id);
    assert.equal(imported.datasetId, meta.id, 'dataset matched by name');
    assert.equal(imported.cells.length, saved.cells.length);
    assert.equal(imported.cells[1].outputs[0].kind, 'table', 'outputs travel with the file');
    const { files } = await workspace.collect({ datasetIds: [] });
    assert.ok(files[`notebooks/${saved.id}.nb.json`], 'notebook file in the workspace');
    return `${saved.cells.length} cells`;
  }, 60000);

  test('notebooks: an R cell captures text output and plots, and exports to PDF', async (assert) => {
    const nb = notebooks.create('R-bok', null);
    const rCell = notebooks.cell('r', 'cat("hej", 1 + 1, "\\n")\nplot(1:5, main = "Anteckningsbok")');
    nb.cells = [notebooks.cell('markdown', '# R i anteckningsboken'), rCell];
    await notebooks.runCell(nb, rCell);
    const kinds = rCell.outputs.map((o) => o.kind);
    assert.ok(kinds.includes('text') && kinds.includes('image'), JSON.stringify(kinds));
    assert.ok(rCell.outputs.find((o) => o.kind === 'text').text.includes('hej 2'), JSON.stringify(rCell.outputs.filter((o) => o.kind !== 'image')));
    const img = rCell.outputs.find((o) => o.kind === 'image');
    assert.ok(img.dataUrl.startsWith('data:image/png') && img.width > 100, 'png data url');
    const errCell = notebooks.cell('r', 'stop("fel i cellen")');
    await notebooks.runCell(nb, errCell);
    assert.equal(errCell.outputs[0].kind, 'error');
    assert.ok(/fel i cellen/.test(errCell.outputs[0].text), errCell.outputs[0].text);
    const ast = notebooks.toAst(nb);
    assert.ok(ast.blocks.some((b) => b.type === 'image' && b.png.length > 100), 'image block');
    assert.ok(ast.blocks.some((b) => b.type === 'code' && b.language === 'r'), 'code block');
    const pdf = await notebooks.exportNotebook(nb, 'pdf');
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.blob.arrayBuffer()).slice(0, 5)), '%PDF-');
    const saved = await notebooks.save(nb);
    nbIds.push(saved.id);
    return `${kinds.join(',')}; pdf ${pdf.blob.size} bytes`;
  }, 180000);

  test('notebooks: cleanup', async (assert) => {
    for (const id of nbIds) { try { await notebooks.remove(id); } catch (_err) { /* ignore */ } }
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
