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
      assert.equal(scanned.get(ds.id).length, 3);
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
})();
