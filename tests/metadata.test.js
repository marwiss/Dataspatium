// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for column metadata: description and unit per column, migration of older files, codebook and exports. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const exporter = D.require('io/export');
  const template = D.require('docgen/template');
  const created = [];
  const META = { column: 'folkmangd', label: 'Folkmängd', description: 'Folkmängd den 31 december', unit: 'personer' };

  test('metadata: description and unit are stored per column, survive reopening and migrate older files', async (assert) => {
    const meta = await importer.run(new File(['kommun;folkmangd\nStockholm;984748\nMalmö;362133\n'], 'meta.csv'), {}, null, 'Metadata');
    created.push(meta.id);
    await recipes.apply(meta.id, 'set_label', META);
    let cols = await datasets.columns(meta.id);
    assert.equal(cols[1].label, 'Folkmängd'); assert.equal(cols[1].description, 'Folkmängd den 31 december'); assert.equal(cols[1].unit, 'personer');
    assert.equal(cols[0].description, null);
    await datasets.save(meta.id); datasets.close(meta.id);
    cols = await datasets.columns(meta.id);
    assert.equal(cols[1].unit, 'personer', 'kept after reopening from IndexedDB');
    await recipes.apply(meta.id, 'set_label', { column: 'folkmangd', label: 'Antal' });
    cols = await datasets.columns(meta.id);
    assert.equal(cols[1].label, 'Antal'); assert.equal(cols[1].description, 'Folkmängd den 31 december', 'a label-only change keeps the rest');
    await recipes.apply(meta.id, 'set_label', { column: 'folkmangd', label: 'Antal', description: '', unit: '' });
    cols = await datasets.columns(meta.id);
    assert.equal(cols[1].description, null, 'empty text clears'); assert.equal(cols[1].unit, null);
    // A file from an older version (or written by dm_write in R) lacks the columns and is migrated when opened.
    const handle = await datasets.ensureOpen(meta.id);
    await handle.engine.run('alter table _columns drop column description');
    await handle.engine.run('alter table _columns drop column unit');
    await datasets.save(meta.id); datasets.close(meta.id);
    cols = await datasets.columns(meta.id);
    assert.equal(cols[1].label, 'Antal'); assert.equal(cols[1].description, null, 'migrated with empty metadata');
    await recipes.apply(meta.id, 'set_label', META);
    const r = await recipes.toR(meta.id);
    assert.ok(/attr\(df\$folkmangd, "unit"\) <- "personer"/.test(r) && /"description"\) <- "Folkmängd den 31 december"/.test(r), r);
    const log = await datasets.log(meta.id);
    assert.ok(log.some((e) => /enhet: personer/.test(typeof e.details === 'string' ? e.details : JSON.stringify(e.details))), 'the log describes the step');
    return cols.length + ' columns';
  }, 30000);

  test('metadata: the codebook, the column table and the XML export carry description and unit', async (assert) => {
    const id = created[0];
    assert.ok(id, 'dataset from the previous test');
    const ctx = await template.codebookContext(id);
    const k = ctx.kolumner.find((c) => c.namn === 'folkmangd');
    assert.equal(k.beskrivning, 'Folkmängd den 31 december'); assert.equal(k.enhet, 'personer');
    assert.equal(ctx.kolumner[0].beskrivning, '', 'empty for columns without metadata');
    const md = (await template.renderTemplate('{{#kolumner}}{{namn}}|{{beskrivning}}|{{enhet}};{{/kolumner}}', ctx)).text;
    assert.ok(/folkmangd\|Folkmängd den 31 december\|personer;/.test(md) && /kommun\|\|;/.test(md), md);
    const docs = D.require('docgen/documents');
    const all = docs.BUILTINS || (typeof docs.builtins === 'function' ? docs.builtins() : (typeof docs.list === 'function' ? await docs.list() : []));
    const codebook = (all || []).find((d) => d.codebook);
    assert.ok(codebook, 'built-in codebook template found');
    const text = (await template.renderTemplate(codebook.body, ctx)).text;
    assert.ok(/Enhet: personer/.test(text) && /Beskrivning: Folkmängd den 31 december/.test(text), 'codebook lists the metadata: ' + text.slice(0, 400));
    const tbl = await template.resolveTable({ kalla: 'kolumner', rubrik: 'Kolumner', kolumner: [] }, ctx);
    assert.deepEqual(tbl.columns, ['namn', 'typ', 'etikett', 'beskrivning', 'enhet']);
    const xml = await (await exporter.toXml(id)).text();
    assert.ok(/enhet="personer"/.test(xml) && /beskrivning="Folkmängd den 31 december"/.test(xml), 'XML attributes');
    return 'ok';
  }, 30000);

  test('metadata: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
