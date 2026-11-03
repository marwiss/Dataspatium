// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for comments on datasets and columns (kept in the SQLite file), the readable history, and shared bundles
 * with a message, the sender's name and a change log; opening a bundle can replace datasets that already exist.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const comments = D.require('data/comments');
  const changelog = D.require('data/changelog');
  const workspace = D.require('data/workspace');
  const zip = D.require('platform/storage/zip');
  const t = D.require('ui/i18n').t;
  const created = [];
  let savedAuthor = '';
  const make = async (name) => {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text', label: 'kommun' }, { name: 'folk', type: 'integer', label: 'folk' }], rows: [['Uppsala', 242140], ['Lund', 128487]] });
    created.push(meta.id);
    return meta.id;
  };

  test('comments: on the dataset and its columns, resolved and removed, kept in the file and in the history', async (assert) => {
    savedAuthor = await comments.author();
    await comments.setAuthor('Testare');
    const id = await make('Kommentarer');
    const first = await comments.add(id, { text: 'Kontrollera källan', column: null });
    const second = await comments.add(id, { text: 'Lund ser lågt ut', column: 'folk' });
    assert.equal(first.author, 'Testare', 'the saved name is used');
    let list = await comments.list(id);
    assert.deepEqual(list.map((c) => [c.text, c.column, c.resolved]), [['Kontrollera källan', null, false], ['Lund ser lågt ut', 'folk', false]]);
    await comments.setResolved(id, second.id, true);
    await datasets.save(id); datasets.close(id);
    list = await comments.list(id);
    assert.ok(list[1].resolved, 'kept after reopening from IndexedDB');
    await comments.remove(id, first.id);
    assert.equal((await comments.list(id)).length, 1);
    let error = '';
    try { await comments.add(id, { text: '   ' }); } catch (err) { error = err.message; }
    assert.equal(error, t('comments.err.empty'));
    try { await comments.add(id, { text: 'x', column: 'saknas' }); } catch (err) { error = err.message; }
    assert.equal(error, t('op.err.unknown.column', { name: 'saknas' }));
    // The history reads as text: the import and the two comments.
    const log = await datasets.log(id);
    const texts = log.map((e) => changelog.describe(e));
    assert.ok(texts.includes(t('log.comment', { author: 'Testare', text: 'Lund ser lågt ut' })), texts.join(' | '));
    assert.equal(changelog.actionLabel('comment'), t('log.action.comment'));
    assert.equal(changelog.actionLabel('ny-sort'), 'ny-sort', 'unknown kinds stay as they are');
    return list.length + ' comments';
  }, 30000);

  test('bundles: a message, the sender and the change log travel along; opening one can replace an existing dataset', async (assert) => {
    const id = await make('Paketdata');
    await recipes.apply(id, 'set_label', { column: 'folk', label: 'Folkmängd' });
    await comments.add(id, { text: 'Uppgifterna gäller 2024', column: 'folk' });
    const { blob } = await workspace.bundle({ name: 'Veckans paket', datasetIds: [id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false }, message: 'Jag har satt etiketter.', author: 'Testare' });
    const opened = await workspace.inspect(blob);
    assert.equal(opened.manifest.kind, 'bundle');
    assert.equal(opened.manifest.author, 'Testare');
    assert.equal(opened.manifest.message, 'Jag har satt etiketter.');
    const steps = opened.manifest.changes.find((c) => c.id === id).entries.map((e) => e.text);
    assert.ok(steps.some((s) => s.includes('Folkmängd')), 'the label step is listed: ' + steps.join(' | '));
    assert.ok(steps.some((s) => s.includes('Uppgifterna gäller 2024')), 'the comment is listed');
    const md = zip.text(opened.entries['CHANGELOG.md']);
    assert.ok(md.startsWith('# Veckans paket') && md.includes('Jag har satt etiketter.') && md.includes('Uppgifterna gäller 2024'), md);
    assert.deepEqual(opened.existing.map((d) => d.id), [id], 'the dataset is already here');
    // Sharing is noted, so the next change log starts after it.
    let log = await datasets.log(id);
    assert.equal(log[log.length - 1].action, 'shared');
    assert.deepEqual((await changelog.forDatasets([id]))[0].entries, [], 'nothing new since sharing');
    // A local change after sharing; opening the bundle without replacing keeps it, with replacing restores the bundle's version.
    await recipes.apply(id, 'set_label', { column: 'folk', label: 'Ändrad här' });
    let res = await workspace.restore(opened);
    assert.equal(res.existing, 1, 'skipped by default');
    assert.equal((await datasets.columns(id))[1].label, 'Ändrad här');
    res = await workspace.restore(opened, { replaceIds: [id] });
    assert.equal(res.replaced.length, 1, 'replaced; skipped: ' + JSON.stringify(res.skipped));
    assert.equal((await datasets.columns(id))[1].label, 'Folkmängd', 'the version in the bundle');
    assert.equal((await comments.list(id))[0].text, 'Uppgifterna gäller 2024', 'comments come with it');
    const versions = await datasets.listVersions(id);
    assert.ok(versions.some((v) => v.label === t('bundle.replaced.version', { name: 'Veckans paket' })), 'the local version is kept: ' + versions.map((v) => v.label).join(', '));
    log = await datasets.log(id);
    const last = log[log.length - 1];
    assert.equal(last.action, 'received');
    assert.equal(changelog.describe(last), t('log.received', { name: 'Veckans paket', author: 'Testare' }));
    return steps.length + ' steps';
  }, 30000);

  test('comments: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    await comments.setAuthor(savedAuthor);
    assert.ok(true);
  });
})();
