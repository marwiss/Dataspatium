// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for value labels: codes with names per column, the two operations, exports, the codebook and R. */
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
  const CSV = 'id;kon;lan;niva\n1;1;01;1,0\n2;2;14;2,0\n3;1;01;1,5\n4;3;14;2,0\n';
  const KON = '1 = Man\n2 = Kvinna';
  const LAN = '01 = Stockholms län\n14 = Västra Götalands län';
  const column = async (id, name) => (await datasets.columns(id)).find((c) => c.name === name);
  const values = async (id, name) => (await datasets.query(id, { orderBy: 'id' })).map((r) => r[(['id', 'kon', 'lan', 'niva']).indexOf(name)]);

  async function labelled(name) {
    const meta = await importer.run(new File([CSV], 'etiketter.csv'), {}, null, name);
    created.push(meta.id);
    await recipes.apply(meta.id, 'set_value_labels', { column: 'kon', labels: KON });
    await recipes.apply(meta.id, 'set_value_labels', { column: 'lan', labels: LAN });
    await recipes.apply(meta.id, 'set_value_labels', { column: 'niva', labels: '1 = Låg\n2 = Hög' });
    return meta;
  }

  test('value labels: stored per column without changing the values, kept after reopening, removed with empty text', async (assert) => {
    const meta = await labelled('Värdeetiketter');
    let kon = await column(meta.id, 'kon');
    assert.equal(kon.type, 'integer');
    assert.deepEqual(kon.valueLabels, { values: 'codes', labels: [[1, 'Man'], [2, 'Kvinna']] });
    const lan = await column(meta.id, 'lan');
    assert.equal(lan.type, 'text', 'codes with a leading zero stay text');
    assert.deepEqual(lan.valueLabels.labels, [['01', 'Stockholms län'], ['14', 'Västra Götalands län']]);
    assert.deepEqual(await values(meta.id, 'kon'), [1, 2, 1, 3], 'the values are unchanged');
    await datasets.save(meta.id); datasets.close(meta.id);
    kon = await column(meta.id, 'kon');
    assert.deepEqual(kon.valueLabels.labels, [[1, 'Man'], [2, 'Kvinna']], 'kept after reopening from IndexedDB');
    await recipes.apply(meta.id, 'set_value_labels', { column: 'kon', labels: '' });
    assert.equal((await column(meta.id, 'kon')).valueLabels, null, 'empty text removes the labels');
    await recipes.apply(meta.id, 'set_value_labels', { column: 'kon', labels: '1 = Man\n2 = Kvinna\n# kommentar\n9 =' });
    assert.deepEqual((await column(meta.id, 'kon')).valueLabels.labels, [[1, 'Man'], [2, 'Kvinna']], 'comments and empty labels are skipped');
    const log = await datasets.log(meta.id);
    assert.ok(log.some((e) => JSON.stringify(e.details).includes(D.t('recipe.set_value_labels', { column: 'kon' }))), 'the log describes the step');
    // A file from an older version lacks the column and is migrated when opened.
    const handle = await datasets.ensureOpen(meta.id);
    await handle.engine.run('alter table _columns drop column value_labels');
    await datasets.save(meta.id); datasets.close(meta.id);
    assert.equal((await column(meta.id, 'kon')).valueLabels, null, 'migrated without labels');
    return 'ok';
  }, 30000);

  test('value labels: codes become labels and back, numbers stay numbers and unknown values stay', async (assert) => {
    const meta = await labelled('Värdeetiketter byte');
    const ops = D.require('data/operations');
    const handle = await datasets.ensureOpen(meta.id);
    const preview = await ops.get('apply_value_labels').preview(ops.makeContext(handle.engine, handle.columns), { column: 'kon', direction: 'labels' });
    assert.equal(preview.rows, 3, 'three rows have a code with a label');
    let res = await recipes.apply(meta.id, 'apply_value_labels', { column: 'kon', direction: 'labels' });
    assert.equal(res.rows, 3);
    let kon = await column(meta.id, 'kon');
    assert.equal(kon.type, 'text');
    assert.equal(kon.valueLabels.values, 'labels');
    assert.deepEqual(await values(meta.id, 'kon'), ['Man', 'Kvinna', 'Man', '3'], 'a code without a label stays');
    res = await recipes.apply(meta.id, 'apply_value_labels', { column: 'kon', direction: 'codes' });
    kon = await column(meta.id, 'kon');
    assert.equal(kon.type, 'integer', 'back to whole numbers');
    assert.equal(kon.valueLabels.values, 'codes');
    assert.deepEqual(await values(meta.id, 'kon'), [1, 2, 1, 3]);
    // Text codes keep their leading zeros.
    await recipes.apply(meta.id, 'apply_value_labels', { column: 'lan', direction: 'labels' });
    assert.deepEqual(await values(meta.id, 'lan'), ['Stockholms län', 'Västra Götalands län', 'Stockholms län', 'Västra Götalands län']);
    await recipes.apply(meta.id, 'apply_value_labels', { column: 'lan', direction: 'codes' });
    assert.equal((await column(meta.id, 'lan')).type, 'text');
    assert.deepEqual(await values(meta.id, 'lan'), ['01', '14', '01', '14']);
    // Decimal numbers compare as numbers (2,0 is code 2), and the column becomes decimal again.
    await recipes.apply(meta.id, 'apply_value_labels', { column: 'niva', direction: 'labels' });
    assert.deepEqual(await values(meta.id, 'niva'), ['Låg', 'Hög', '1.5', 'Hög']);
    await recipes.apply(meta.id, 'apply_value_labels', { column: 'niva', direction: 'codes' });
    assert.equal((await column(meta.id, 'niva')).type, 'number');
    assert.deepEqual(await values(meta.id, 'niva'), [1, 2, 1.5, 2]);
    // A column without value labels gives an error that names it.
    let error = '';
    try { await recipes.apply(meta.id, 'apply_value_labels', { column: 'id', direction: 'labels' }); } catch (err) { error = String(err.message || err); }
    assert.equal(error, D.t('op.err.no.value.labels', { name: 'id' }));
    // Recipe export: SQL with CASE and R with dm_value_labels().
    const sql = await recipes.toSQL(meta.id);
    assert.ok(/UPDATE data SET "kon" = case "kon" when 1 then 'Man' when 2 then 'Kvinna' else "kon" end;/.test(sql), sql);
    const r = await recipes.toR(meta.id);
    assert.ok(r.includes('df$"kon" <- dm_value_labels(df$"kon", c("Man" = 1, "Kvinna" = 2))'), r);
    assert.ok(r.includes('df$"kon" <- dm_value_labels(df$"kon", c("Man" = 1, "Kvinna" = 2), to = "labels")'), r);
    assert.ok(r.includes('df$"lan" <- dm_value_labels(df$"lan", c("Stockholms län" = "01", "Västra Götalands län" = "14"), to = "codes")'), r);
    return 'ok';
  }, 30000);

  test('value labels: shown in the codebook, the profile and the XML export', async (assert) => {
    const meta = await labelled('Värdeetiketter kodbok');
    const ctx = await template.codebookContext(meta.id);
    const kon = ctx.kolumner.find((c) => c.namn === 'kon');
    assert.equal(kon.vardeetiketter, '1 = Man; 2 = Kvinna');
    assert.equal(ctx.kolumner.find((c) => c.namn === 'id').vardeetiketter, '', 'empty for columns without labels');
    const docs = D.require('docgen/documents');
    const all = docs.BUILTINS || (typeof docs.builtins === 'function' ? docs.builtins() : (typeof docs.list === 'function' ? await docs.list() : []));
    const codebook = (all || []).find((d) => d.codebook);
    const text = (await template.renderTemplate(codebook.body, ctx)).text;
    assert.ok(text.includes(': 1 = Man; 2 = Kvinna'), 'the built-in codebook lists the value labels: ' + text.slice(0, 600));
    const tbl = await template.resolveTable({ kalla: 'kolumner', rubrik: '', kolumner: [] }, ctx);
    assert.deepEqual(tbl.columns, ['namn', 'typ', 'etikett', 'beskrivning', 'enhet', 'vardeetiketter'], 'the column table gets a value label column');
    const prof = await D.require('data/profile').profile(meta.id);
    assert.deepEqual(prof.columns.find((c) => c.name === 'kon').valueLabels.labels, [[1, 'Man'], [2, 'Kvinna']]);
    const xml = await (await exporter.toXml(meta.id)).text();
    assert.ok(xml.includes('vardeetiketter="1 = Man; 2 = Kvinna"'), xml.slice(0, 600));
    return 'ok';
  }, 30000);

  test('value labels: the dialog fills in the labels of the chosen column and saves the edited text', async (assert) => {
    const meta = await labelled('Värdeetiketter dialog');
    const opDialog = D.require('ui/op-dialog');
    const columns = await datasets.columns(meta.id);
    const done = opDialog.open({ datasetId: meta.id, opId: 'set_value_labels', preset: { column: 'kon' }, columns });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let dialog = null;
    for (let i = 0; i < 100 && !dialog; i++) { await wait(30); dialog = Array.from(document.querySelectorAll('dialog[open]')).pop() || null; }
    assert.ok(dialog, 'the dialog opened');
    const input = /** @type {any} */ (dialog.querySelector('dm-input[type="textarea"]'));
    assert.equal(input.value, KON, 'filled in from the column');
    input.value = '1 = Pojke\n2 = Flicka';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const buttons = dialog.querySelectorAll('.dm-dialog-actions dm-button button');
    /** @type {HTMLElement} */ (buttons[buttons.length - 1]).click();
    const result = await done;
    assert.ok(result, 'applied');
    assert.deepEqual((await column(meta.id, 'kon')).valueLabels.labels, [[1, 'Pojke'], [2, 'Flicka']]);
    return 'ok';
  }, 30000);

  test('value labels: R gets haven::labelled, dm_value_labels() and dm_write() keep them, SPSS round trip', async (assert) => {
    const { bridge } = D.require('data/r-bridge');
    const out = (res) => res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim();
    const errors = (res) => JSON.stringify(res.entries.filter((e) => e.kind === 'error').map((e) => e.text));
    const meta = await labelled('Etikettest');
    await bridge.start();
    const read = await bridge.run('df <- dm_read("Etikettest"); cat(inherits(df$kon, "haven_labelled"), paste(names(attr(df$kon, "labels")), collapse = ","), inherits(df$lan, "haven_labelled"), unname(attr(df$lan, "labels"))[1], sep = "|")');
    assert.equal(out(read), 'TRUE|Man,Kvinna|TRUE|01', errors(read));
    const swapped = await bridge.run('y <- dm_value_labels(df$kon, c("Man" = 1, "Kvinna" = 2), to = "labels"); z <- dm_value_labels(y, c("Man" = 1, "Kvinna" = 2), to = "codes"); cat(paste(y, collapse = ","), paste(z, collapse = ","), inherits(z, "haven_labelled"), sep = "|")');
    assert.equal(out(swapped), 'Man,Kvinna,Man,3|1,2,1,3|TRUE', errors(swapped));
    const written = await bridge.run('df$kon <- dm_value_labels(df$kon, c("Man" = 1, "Kvinna" = 2), to = "labels"); dm_write(df, "Etiketter från R")');
    const ds = written.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds, 'dataset entry: ' + errors(written));
    created.push(ds.meta.id);
    const kon = await column(ds.meta.id, 'kon');
    assert.equal(kon.type, 'text');
    assert.deepEqual(kon.valueLabels, { values: 'labels', labels: [[1, 'Man'], [2, 'Kvinna']] }, 'labels as text keep their codes');
    assert.deepEqual((await column(ds.meta.id, 'lan')).valueLabels, { values: 'codes', labels: [['01', 'Stockholms län'], ['14', 'Västra Götalands län']] });
    // SPSS: the labels are written as such; importing shows them (default) or keeps the codes.
    const { blob, filename } = await exporter.exportDataset(meta.id, 'sav');
    const asLabels = await importer.run(new File([blob], filename), {}, null, 'Etiketter SPSS');
    created.push(asLabels.id);
    const k1 = await column(asLabels.id, 'kon');
    assert.equal(k1.valueLabels.values, 'labels');
    assert.deepEqual(k1.valueLabels.labels, [[1, 'Man'], [2, 'Kvinna']]);
    assert.deepEqual((await datasets.query(asLabels.id, { orderBy: 'id' })).map((r) => r[1]), ['Man', 'Kvinna', 'Man', '3']);
    // Exported again from labels as text, the codes come back.
    const again = await exporter.exportDataset(asLabels.id, 'sav');
    const asCodes = await importer.run(new File([again.blob], again.filename), { valueLabels: 'codes' }, null, 'Etiketter SPSS koder');
    created.push(asCodes.id);
    const k2 = await column(asCodes.id, 'kon');
    assert.equal(k2.valueLabels.values, 'codes');
    assert.deepEqual((await datasets.query(asCodes.id, { orderBy: 'id' })).map((r) => Number(r[1])), [1, 2, 1, 3]);
    return 'ok';
  }, 300000);

  test('value labels: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
