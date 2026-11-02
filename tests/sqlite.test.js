// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the SQLite engine (sql.js in a shimmed worker). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const { SqliteEngine } = D.require('engines/sqlite');

  test('sqlite: create, query, export and reopen', async (assert) => {
    const engine = new SqliteEngine();
    await engine.start();
    await engine.open();
    const version = await engine.version();
    assert.ok(/^3\./.test(version), 'sqlite version ' + version);
    await engine.run('create table t (id integer primary key, namn text, varde real)');
    const changed = await engine.run('insert into t (namn, varde) values (?, ?), (?, ?)', ['å', 1.5, 'ö', -2]);
    assert.equal(changed, 2);
    const rows = await engine.exec('select namn, varde from t order by id');
    assert.deepEqual(rows[0].columns, ['namn', 'varde']);
    assert.deepEqual(rows[0].values, [['å', 1.5], ['ö', -2]]);
    const bytes = await engine.export();
    assert.ok(bytes.byteLength > 1024, 'export size ' + bytes.byteLength);
    const header = new TextDecoder().decode(new Uint8Array(bytes, 0, 15));
    assert.equal(header, 'SQLite format 3');
    const second = new SqliteEngine();
    await second.start();
    await second.open(bytes);
    const count = await second.exec('select count(*) as n from t');
    assert.equal(count[0].values[0][0], 2);
    await assert.throws(() => second.exec('select * from missing_table'), /no such table/);
    engine.terminate();
    second.terminate();
    return 'sqlite ' + version;
  }, 30000);
})();
