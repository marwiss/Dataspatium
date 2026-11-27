// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the harness's choice of tests: ?files=, ?shard=, ?serial= and ?only=, and the split by time. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test, partition, pick } = D.require('tests/harness');

  const ALL = [
    { name: 'a: one', file: 'a.test.js', serial: false },
    { name: 'a: two', file: 'a.test.js', serial: false },
    { name: 'b: one', file: 'b.test.js', serial: true },
    { name: 'b: two', file: 'b.test.js', serial: false },
    { name: 'c: one', file: 'c.test.js', serial: false },
    { name: 'd: one', file: 'd.test.js', serial: false },
  ];
  const names = (params, weights = {}) => pick(ALL, new URLSearchParams(params), weights).tests.map((t) => t.name);

  test('harness: the parts of the suite hold every file once, keep its order and come out the same each time', (assert) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const weights = { a: 50, b: 5, c: 20, d: 20, e: 1, f: 1 };
    const parts = partition(files, weights, 3);
    assert.deepEqual(parts.flat().sort(), files, 'every file once');
    assert.deepEqual(partition(files, weights, 3), parts, 'the same split again');
    for (const p of parts) assert.deepEqual(p, files.filter((f) => p.includes(f)), 'in the order of the suite');
    const load = parts.map((p) => p.reduce((s, f) => s + (weights[f] === undefined ? 1 : weights[f]), 0));
    assert.deepEqual(load, [50, 25, 23], 'the heaviest alone, the rest evened out (g counts as one second)');
    assert.deepEqual(partition(files, weights, 1), [files], 'one part is the suite');
    assert.equal(partition(['a'], {}, 4).filter((p) => p.length).length, 1, 'more parts than files leaves some empty');
  });

  test('harness: ?files= and ?only= choose tests, ?serial= keeps the files that measure time apart, and the parts of ?shard= add up', (assert) => {
    assert.deepEqual(names('files=a,c.test.js'), ['a: one', 'a: two', 'c: one'], 'with or without .test.js');
    assert.deepEqual(names('files=tests/b.test.js&only=two'), ['b: two'], 'both together');
    assert.deepEqual(names('serial=only'), ['b: one', 'b: two'], 'the whole file of a serial test');
    assert.deepEqual(names('serial=skip'), ['a: one', 'a: two', 'c: one', 'd: one']);
    const weights = { 'a.test.js': 10, 'c.test.js': 1, 'd.test.js': 1 };
    const parts = [1, 2].map((i) => names(`serial=skip&shard=${i}/2`, weights));
    assert.deepEqual(parts, [['a: one', 'a: two'], ['c: one', 'd: one']], 'split by time');
    assert.deepEqual(parts.flat().sort(), names('serial=skip').sort(), 'the parts together are the whole');
    const bad = pick(ALL, new URLSearchParams('files=zz&shard=3/2&serial=maybe'), {}).errors;
    assert.equal(bad.length, 3, 'an unknown file, a part that does not exist and a wrong serial are errors: ' + bad.join('; '));
  });
})();
