// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for analysis/querybuilder: a visual query over two datasets equals the SQL it generates; lists of kind query. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const qb = D.require('analysis/querybuilder');
  const query = D.require('data/query');
  const datasets = D.require('data/datasets');
  const lists = D.require('data/lists');

  test('querybuilder: join, aggregate, conditions and order compile to SQL that gives the same rows as the hand-written query', async (assert) => {
    const imp = D.require('io/import');
    const a = await imp.run(new File(['kommun;lan;antal\nUmeå;Västerbotten;3\nSkellefteå;Västerbotten;2\nLuleå;Norrbotten;4\nKiruna;Norrbotten;1\nMalmö;Skåne;9\n'], 'a.csv', { type: 'text/csv' }), {}, null, 'Fråga A');
    const b = await imp.run(new File(['lan;region\nVästerbotten;Norr\nNorrbotten;Norr\nSkåne;Syd\n'], 'b.csv', { type: 'text/csv' }), {}, null, 'Fråga B');
    let made = null;
    try {
      const metaB = await datasets.get(b.id);
      const spec = {
        from: { datasetId: a.id },
        joins: [{ datasetId: b.id, type: 'inner', on: [{ left: 'lan', right: 'lan' }] }],
        columns: [{ source: 1, column: 'region' }, { source: 0, column: 'antal', agg: 'sum', alias: 'summa' }, { source: 0, column: 'kommun', agg: 'count' }],
        where: { op: 'and', items: [{ source: 0, column: 'antal', cmp: '>', value: '1' }, { op: 'or', items: [{ source: 1, column: 'region', cmp: '=', value: 'Norr' }, { source: 1, column: 'region', cmp: 'contains', value: 'yd' }] }] },
        orderBy: [{ alias: 'summa', dir: 'desc' }],
        limit: 100,
      };
      const metas = await qb.metasFor(spec);
      assert.deepEqual(qb.validate(spec, metas), [], 'valid spec');
      const { sql, aliases } = qb.compile(spec, metas);
      assert.deepEqual(aliases, ['region', 'summa', 'count_kommun']);
      assert.ok(sql.includes(`join "${metaB.shortName}" t1 on t0."lan" = t1."lan"`), 'join on the short name: ' + sql);
      assert.ok(sql.includes('t0."antal" > 1'), 'numeric literal for a numeric column');
      assert.ok(sql.includes("like '%yd%' escape '\\'"), 'contains as like');
      assert.ok(sql.includes('group by t1."region"'), 'grouping on the plain column');
      assert.ok(sql.includes('order by "summa" desc') && sql.includes('limit 100'));
      const res = await qb.run(spec);
      const expected = await query.select(a.id, `select t1.region, sum(t0.antal) as summa, count(t0.kommun) as c from data t0 join "${metaB.shortName}" t1 on t0.lan = t1.lan where t0.antal > 1 and (t1.region = 'Norr' or t1.region like '%yd%') group by t1.region order by summa desc`);
      assert.deepEqual(res.values, expected.values, 'same rows as the hand-written SQL: ' + JSON.stringify(res.values));
      assert.deepEqual(res.values.map((r) => r[0]), ['Syd', 'Norr'], 'Syd 9 before Norr 3+2+4');
      assert.equal(res.values[1][1], 9, 'Norr: 3 + 2 + 4');
      assert.equal(res.values[1][2], 3, 'three municipalities above 1 in Norr');
      assert.ok(qb.describe(spec, metas).includes('sum(antal)'), 'description: ' + qb.describe(spec, metas));
      // Other operators and a left join.
      const spec2 = { from: { datasetId: a.id }, joins: [{ datasetId: b.id, type: 'left', on: [{ left: 'lan', right: 'lan' }] }], columns: [{ source: 0, column: 'kommun' }, { source: 1, column: 'region' }], where: { op: 'and', items: [{ source: 0, column: 'kommun', cmp: 'in', value: 'Umeå, Kiruna, Okänd' }, { source: 0, column: 'antal', cmp: 'between', value: [1, 3] }, { source: 1, column: 'region', cmp: 'notempty' }] }, orderBy: [{ alias: 'kommun', dir: 'asc' }] };
      const res2 = await qb.run(spec2);
      assert.deepEqual(res2.values, [['Kiruna', 'Norr'], ['Umeå', 'Norr']], JSON.stringify(res2.values));
      assert.ok(res2.sql.includes('left join'), 'left join');
      // Validation catches a missing column and a join without keys.
      const bad = { from: { datasetId: a.id }, joins: [{ datasetId: b.id, type: 'inner', on: [] }], columns: [{ source: 0, column: 'finnsinte' }], where: { op: 'and', items: [] }, orderBy: [] };
      const errs = qb.validate(bad, metas);
      assert.equal(errs.length, 2, 'two problems: ' + errs.join(' | '));
      // Saved as a list of kind query: runs again and becomes a dataset.
      const rec = await lists.save({ name: 'Summa per region', datasetId: a.id, kind: 'query', spec, sql });
      assert.equal(rec.kind, 'query');
      const again = await lists.run(rec);
      assert.deepEqual(again.values, res.values, 'list runs the query');
      assert.equal(rec.hits, 2);
      assert.ok(lists.describe(rec).includes('sum(antal)') || lists.describe(rec).includes('summa'), lists.describe(rec));
      made = await lists.toDataset(rec, 'Region summor');
      assert.equal(made.rowCount, 2);
      assert.deepEqual((await datasets.columns(made.id)).map((c) => c.name), ['region', 'summa', 'count_kommun']);
      await lists.remove(rec.id);
      return 'ok';
    } finally {
      if (made) await datasets.remove(made.id);
      await datasets.remove(a.id); await datasets.remove(b.id);
    }
  });
})();
