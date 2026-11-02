// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for pseudonymisation: salted hashing, masking, running numbers, the profile warning and salt redaction. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const recipes = D.require('data/recipes');
  const profile = D.require('data/profile');
  const created = [];
  const CSV = 'personnummer;namn;kommun\n19800101-1234;Anna;Stockholm\n19751231-2345;Bo;Göteborg\n19800101-1234;Anna;Malmö\n';
  async function fresh(name) { const meta = await importer.run(new File([CSV], 'pnr.csv'), {}, null, name); created.push(meta.id); return meta.id; }
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  test('pseudonymize: the profile flags personal identity numbers and dm_hash matches SHA-256', async (assert) => {
    const id = await fresh('Pseudonymtest');
    const prof = await profile.profile(id);
    const col = prof.columns.find((c) => c.name === 'personnummer');
    assert.ok(col && col.warnings.some((w) => w.kind === 'personal_id' && w.op === 'pseudonymize'), JSON.stringify(col && col.warnings));
    const handle = await datasets.ensureOpen(id);
    const vec = await handle.engine.exec("select dm_hash('abc', '', 64), dm_hash('abc', 'salt', 8), dm_mask('19800101-1234', 6, 0, '*'), dm_hash(null, 'x', 8)");
    assert.equal(vec[0].values[0][0], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 test vector');
    assert.equal(vec[0].values[0][1], (await sha256Hex('salt|abc')).slice(0, 8), 'salted prefix');
    assert.equal(vec[0].values[0][2], '198001**-****');
    assert.equal(vec[0].values[0][3], null);
    return vec[0].values[0][0].slice(0, 16);
  });

  test('pseudonymize: hashing is deterministic and salted; the salt is redacted in the log and blocks replay', async (assert) => {
    const id = await fresh('Pseudonym hash');
    const res = await recipes.apply(id, 'pseudonymize', { columns: ['personnummer'], method: 'hash', salt: 'hemligt', length: 16 });
    assert.equal(res.rows, 3);
    const rows = await datasets.query(id);
    assert.ok(/^[0-9a-f]{16}$/.test(rows[0][0]), 'hex of length 16: ' + rows[0][0]);
    assert.equal(rows[0][0], rows[2][0], 'same input, same pseudonym');
    assert.ok(rows[0][0] !== rows[1][0], 'different inputs differ');
    assert.equal(rows[0][0], (await sha256Hex('hemligt|19800101-1234')).slice(0, 16), 'matches Web Crypto');
    const log = await datasets.log(id);
    const step = log.filter((e) => e.action === 'op').pop();
    assert.equal(step.details.params.salt, '***', 'salt redacted in the log');
    assert.ok(/Pseudonymisera personnummer \(hash\)/.test(step.details.description), step.details.description);
    const sql = await recipes.toSQL(id);
    assert.ok(sql.includes('dm_hash(cast("personnummer" as text)') && !sql.includes('hemligt'), 'SQL export has no salt: ' + sql);
    const r = await recipes.toR(id);
    assert.ok(r.includes('digest::digest') && !r.includes('hemligt'), 'R export has no salt');
    const target = await fresh('Pseudonym replay');
    const done = await recipes.replay(target, await recipes.steps(id));
    assert.equal(done[0].ok, false);
    assert.ok(/hemligt värde/.test(done[0].error), done[0].error);
    assert.equal((await datasets.query(target))[0][0], '19800101-1234', 'target untouched');
    return rows[0][0];
  });

  test('pseudonymize: masking keeps the chosen ends and separators; running numbers follow sorted order', async (assert) => {
    const masked = await fresh('Pseudonym mask');
    await recipes.apply(masked, 'pseudonymize', { columns: ['personnummer'], method: 'mask', keepStart: 6, keepEnd: 0 });
    assert.deepEqual((await datasets.query(masked)).map((r) => r[0]), ['198001**-****', '197512**-****', '198001**-****']);
    const seq = await fresh('Pseudonym sequence');
    await recipes.apply(seq, 'pseudonymize', { columns: ['personnummer', 'namn'], method: 'sequence', prefix: 'P', length: 4 });
    const rows = await datasets.query(seq);
    assert.deepEqual(rows.map((r) => r[0]), ['P0002', 'P0001', 'P0002'], 'numbered in sorted order of the original values');
    assert.deepEqual(rows.map((r) => r[1]), ['P0001', 'P0002', 'P0001']);
    assert.equal((await datasets.columns(seq)).find((c) => c.name === 'personnummer').type, 'text');
    const undone = await recipes.undo(seq);
    assert.ok(undone, 'undo available');
    assert.equal((await datasets.query(seq))[1][0], '19751231-2345', 'undo restores the values');
    return rows.map((r) => r[0]).join(',');
  });

  test('pseudonymize: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
