// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for validation rules: definitions, running, suggestions, failing rows, the report and persistence. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const rules = D.require('data/rules');
  const markdown = D.require('docgen/markdown');
  const builders = D.require('docgen/builders');
  const created = [];

  test('rules: add, run, suggest, failing rows, report and persistence in the dataset file', async (assert) => {
    const csv = 'kommunkod;kommun;befolkning;lan\n0180;Stockholm;984748;Stockholms län\n1480;Göteborg;596841;Västra Götalands län\n1480;Göteborg;-5;Västra Götalands län\n;Okänd;100;Skåne län\n';
    const meta = await importer.run(new File([csv], 'rules.csv', { type: 'text/csv' }), {}, null, 'Regeltest');
    created.push(meta.id);
    const first = await rules.add(meta.id, { type: 'notnull', column: 'kommunkod' });
    await rules.add(meta.id, { type: 'unique', columns: ['kommunkod'] });
    await rules.add(meta.id, { type: 'range', column: 'befolkning', min: 0 });
    await rules.add(meta.id, { type: 'inset', column: 'lan', values: 'Stockholms län, Västra Götalands län' });
    await rules.add(meta.id, { type: 'regex', column: 'kommunkod', pattern: '^\\d{4}$' });
    await rules.add(meta.id, { type: 'length', column: 'kommun', min: 2, max: 20 });
    await rules.add(meta.id, { type: 'sql', expression: "befolkning > 50 or kommun = 'Göteborg'" });
    const stored = await rules.list(meta.id);
    assert.equal(stored.length, 7);
    assert.equal((await datasets.get(meta.id)).rules.length, 7, 'rules live in the dataset metadata');
    const run = await rules.run(meta.id);
    const byType = Object.fromEntries(run.results.map((r) => [r.rule.type, r.failures]));
    assert.deepEqual(byType, { notnull: 1, unique: 2, range: 1, inset: 1, regex: 0, length: 0, sql: 0 }, JSON.stringify(byType));
    assert.equal(run.summary.failed, 4); assert.equal(run.summary.passed, 3); assert.equal(run.total, 4);
    const unique = run.results.find((r) => r.rule.type === 'unique');
    assert.equal(unique.sample.length, 2, 'examples of failing rows');
    assert.ok(Math.abs(unique.share - 0.5) < 1e-9);
    assert.ok((await datasets.log(meta.id)).some((e) => e.action === 'validate'), 'run logged');
    const failing = await rules.failingRows(meta.id, stored[1]);
    created.push(failing.id);
    assert.equal(failing.rowCount, 2, 'failing rows become a dataset');
    assert.ok(/bryter mot/.test(failing.name), failing.name);
    const md = rules.toMarkdown(run, meta);
    assert.ok(md.includes('# Datakvalitetsrapport: Regeltest'), 'report title');
    assert.ok(md.includes('| kommunkod får inte saknas | Bryts | 1 |'), md.slice(0, 500));
    const html = builders.toHtml(markdown.parse(md), { title: 'Rapport' });
    assert.ok(html.includes('<table') && html.includes('Bryts') && html.includes('<h2>Exempel: kommunkod ska vara unik</h2>'), 'html report');
    const bytes = await datasets.exportBytes(meta.id);
    const copy = await datasets.importBytes(bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    created.push(copy.id);
    assert.equal((await rules.list(copy.id)).length, 7, 'rules travel with the SQLite file');
    const clean = await importer.run(new File(['kod;namn\n0180;Stockholm\n1480;Göteborg\n'], 'clean.csv', { type: 'text/csv' }), {}, null, 'Regelförslag');
    created.push(clean.id);
    const suggestions = await rules.suggest(clean.id);
    assert.ok(suggestions.some((s) => s.type === 'notnull' && s.column === 'kod'), 'notnull suggested');
    assert.ok(suggestions.some((s) => s.type === 'unique' && s.columns[0] === 'namn'), 'unique suggested');
    assert.ok(suggestions.some((s) => s.type === 'regex' && s.column === 'kod' && s.pattern === '^\\d{4}$'), 'code pattern suggested: ' + JSON.stringify(suggestions));
    const left = await rules.remove(meta.id, first.id);
    assert.equal(left.length, 6);
    const bad = await rules.run(meta.id, [{ id: 'x', type: 'sql', expression: 'no_such_column > 1' }]);
    assert.ok(bad.results[0].error && !bad.results[0].ok, 'a broken rule reports its error');
    return JSON.stringify(byType);
  }, 30000);

  test('rules: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
