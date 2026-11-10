// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the review before sharing: findings and the transformed copy (hashed or dropped columns). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const review = D.require('ui/share/review');
  const query = D.require('data/query');

  test('review: identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays', async (assert) => {
    const csv = 'personnummer;epost;telefon;ort\n19121212-1212;a@example.se;070-1234567;Umeå\n19900101-0017;c@example.se;08-123456;Luleå\n';
    const ds = await D.require('io/import').run(new File([csv], 'granskning.csv', { type: 'text/csv' }), {}, null, 'Granskningstest');
    let copy = null;
    try {
      const found = await review.findings(ds.id);
      const kinds = Object.fromEntries(found.map((f) => [f.column, f.kind]));
      assert.equal(kinds.personnummer, 'identifier', 'identity numbers found: ' + JSON.stringify(found));
      assert.equal(kinds.epost, 'email');
      assert.equal(kinds.telefon, 'phone');
      assert.ok(!kinds.ort, 'a place name is not flagged');
      const scanned = await review.scan([ds.id]);
      assert.equal(scanned.get(ds.id).columns.length, 3);
      assert.ok(review.summary({ [ds.id]: { hash: ['personnummer'], drop: ['epost'] } }).length > 0, 'summary text');

      const bytes = await datasets.exportBytesTransformed(ds.id, { drop: ['epost'], hash: ['personnummer'], salt: 'testsalt' });
      copy = await datasets.importBytes(bytes, { name: 'Granskningskopia' });
      const copyCols = (await datasets.columns(copy.id)).map((c) => c.name);
      assert.deepEqual(copyCols, ['personnummer', 'telefon', 'ort'], 'e-mail column dropped, order kept');
      const rows = await query.select(copy.id, 'select personnummer, telefon, ort from data order by rowid', { limit: 10 });
      assert.equal(rows.values.length, 2);
      assert.ok(rows.values.every((r) => /^[0-9a-f]{16}$/.test(String(r[0]))), 'identity numbers hashed: ' + rows.values.map((r) => r[0]).join(','));
      assert.ok(rows.values[0][0] !== rows.values[1][0], 'different inputs give different codes');
      assert.equal(rows.values[0][1], '070-1234567', 'phone kept as chosen');
      assert.equal(rows.values[1][2], 'Luleå');
      const again = await datasets.importBytes(await datasets.exportBytesTransformed(ds.id, { hash: ['personnummer'], salt: 'testsalt' }), { name: 'Kopia 2' });
      const rows2 = await query.select(again.id, 'select personnummer from data order by rowid', { limit: 10 });
      assert.deepEqual(rows2.values.map((r) => r[0]), rows.values.map((r) => r[0]), 'same salt gives the same codes');
      await datasets.remove(again.id);
      // The original is untouched.
      const original = await query.select(ds.id, 'select personnummer, epost from data order by rowid', { limit: 10 });
      assert.equal(original.values[0][0], '19121212-1212');
      assert.equal(original.values[0][1], 'a@example.se');
      assert.equal((await datasets.columns(ds.id)).length, 4);
      const unchanged = await datasets.exportBytesTransformed(ds.id, {});
      assert.ok(unchanged.byteLength > 0, 'no choices: plain export');
      return 'ok';
    } finally {
      if (copy) await datasets.remove(copy.id);
      await datasets.remove(ds.id);
    }
  });

  test('review: columns that name people, as the observers in species data, are proposed to be pseudonymised', async (assert) => {
    const csv = 'scientificName;recordedBy;Reported_By;antal\nBarbarea vulgaris;Kim Ek;Kim Ek;1\nParthenocissus;Alex Berg;Alex Berg;2\n';
    const ds = await D.require('io/import').run(new File([csv], 'fynd.csv', { type: 'text/csv' }), {}, null, 'Artfynd');
    try {
      const found = await review.findings(ds.id);
      const kinds = Object.fromEntries(found.map((f) => [f.column, f.kind]));
      const cols = (await datasets.columns(ds.id)).map((c) => c.name);
      const recorded = cols.find((c) => /recorded/i.test(c)); const reported = cols.find((c) => /reported/i.test(c));
      assert.equal(kinds[recorded], 'person', 'the observer: ' + JSON.stringify(found));
      assert.equal(kinds[reported], 'person', 'the reporter');
      assert.ok(!kinds.scientificName && !Object.keys(kinds).some((k) => /scientific/i.test(k)), 'a species name is no person');
      const offer = D.require('data/share-scan').columnChoices({ column: recorded, kind: 'person' });
      assert.equal(offer.start, 'hash', 'pseudonymised unless the user chooses otherwise');
      return 'ok';
    } finally { await datasets.remove(ds.id); }
  });

  test('review: a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned', async (assert) => {
    const imports = D.require('io/import');
    const charts = D.require('viz/charts');
    const notebooks = D.require('analysis/notebooks');
    const workspace = D.require('data/workspace');
    const shareScan = D.require('data/share-scan');
    const zip = D.require('platform/storage/zip');
    const csv = 'ort;antal\nUmeå;3\nLuleå;4\n';
    const chosen = await imports.run(new File([csv], 'kontakt anna@example.se.csv', { type: 'text/csv' }), {}, null, 'Lista till anna@example.se');
    const other = await imports.run(new File([csv], 'annan.csv', { type: 'text/csv' }), {}, null, 'Annan lista');
    const made = { charts: [], notebooks: [] };
    try {
      const mine = await charts.save(Object.assign(charts.create('vega', await datasets.get(chosen.id), 'Fråga sven@example.se'), {}));
      const theirs = await charts.save(Object.assign(charts.create('vega', await datasets.get(other.id), 'Annat diagram'), {}));
      made.charts.push(mine.id, theirs.id);
      const book = notebooks.create('Anteckningar', await datasets.get(chosen.id));
      book.cells = [{ type: 'text', source: 'Ring Kim', outputs: [] }, { type: 'sql', source: 'select 1', outputs: [{ kind: 'text', text: 'svar från kim@example.se' }] }];
      const savedBook = await notebooks.save(book);
      made.notebooks.push(savedBook.id);
      const include = { charts: true, dashboards: true, documents: true, notebooks: true, scripts: true };
      // The review lists what would follow: the chart and the notebook of the chosen dataset, not the other chart.
      const found = await shareScan.extras([chosen.id], include);
      const paths = found.map((x) => x.path);
      assert.ok(paths.includes(`charts/${mine.id}.viz.json`), 'the chart with an e-mail address: ' + paths.join(', '));
      assert.ok(paths.includes(`notebooks/${savedBook.id}.nb.json`), 'the notebook with an address in its output');
      assert.ok(!paths.some((x) => x.includes(theirs.id)), 'a chart of a dataset not chosen is not part of the bundle');
      const nb = found.find((x) => x.kind === 'notebook');
      assert.deepEqual(nb.choices, ['mask', 'strip', 'omit', 'keep']);
      assert.equal(nb.start, 'mask', 'masked unless the user chooses otherwise');
      // The name and the file name of the chosen dataset hold an address too.
      const inspected = await shareScan.inspect(chosen.id);
      assert.ok(inspected.parts.some((x) => x.kind === 'filename'), 'the name is flagged: ' + JSON.stringify(inspected.parts.map((x) => x.kind)));
      const extras = { [`charts/${mine.id}.viz.json`]: 'mask', [`notebooks/${savedBook.id}.nb.json`]: 'strip' };
      const res = await workspace.bundle({ name: 'Granskat paket', datasetIds: [chosen.id], include, author: '', message: '', transform: { [chosen.id]: { drop: [], hash: [], mask: [], side: {}, filename: true } }, extras });
      const files = await zip.readZip(new Uint8Array(await res.blob.arrayBuffer()));
      const text = (name) => new TextDecoder().decode(files[name]);
      const chartText = text(`charts/${mine.id}.viz.json`);
      assert.ok(!chartText.includes('sven@example.se') && chartText.includes('[***]'), 'the chart title masked');
      assert.ok(!Object.keys(files).some((x) => x.includes(theirs.id)), 'the other chart stayed behind');
      const bookOut = JSON.parse(text(`notebooks/${savedBook.id}.nb.json`));
      assert.ok(bookOut.cells.every((c) => !c.outputs.length), 'the saved outputs removed');
      const manifest = JSON.parse(text('manifest.json'));
      assert.ok(manifest.datasets.every((d) => !String(d.name).includes('anna@example.se')), 'the name masked in the list: ' + manifest.datasets.map((d) => d.name).join(', '));
      const dsFile = Object.keys(files).find((x) => x.startsWith('datasets/'));
      const back = await datasets.importBytes(files[dsFile].slice().buffer, { name: 'Tillbaka' }, { quiet: true });
      const meta = await datasets.get(back.id);
      assert.ok(!JSON.stringify(meta.source || {}).includes('anna@example.se'), 'the file name masked in the copy: ' + JSON.stringify(meta.source));
      await datasets.remove(back.id, { quiet: true });
      // Leaving a notebook out takes it out of the bundle.
      const res2 = await workspace.bundle({ name: 'Utan bok', datasetIds: [chosen.id], include, author: '', message: '', transform: {}, extras: { [`notebooks/${savedBook.id}.nb.json`]: 'omit' } });
      const files2 = await zip.readZip(new Uint8Array(await res2.blob.arrayBuffer()));
      assert.ok(!Object.keys(files2).some((x) => x.startsWith('notebooks/')), 'the notebook left out');
      assert.ok(Object.keys(files2).some((x) => x.startsWith('charts/')), 'the chart kept as it was');
      return 'ok';
    } finally {
      for (const id of made.charts) await charts.remove(id).catch(() => {});
      for (const id of made.notebooks) await notebooks.remove(id).catch(() => {});
      await datasets.remove(chosen.id);
      await datasets.remove(other.id);
    }
  }, 60000);
})();
