// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the commands (data/commands, F30 a): the registry and its schemas in the providers' strict form, the checks of the
 * arguments, reading datasets, SQL that may only read, operations that need approval and can be undone, references by name, the
 * steps of flows as commands with their files kept in the app, and a name that is not a command. Own test data only; nothing
 * touches the net, and no R or Python starts.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const commands = D.require('data/commands');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const created = [];
  const yes = async () => true;
  async function table(name) {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Ale', 10], ['Bollebygd', 20], ['Ale', 5], ['Borås', null]] });
    created.push(meta.id);
    return meta;
  }
  /** Every object in a schema lists all its fields as required and allows no others, as the strict modes want. */
  function strict(schema, path, out) {
    const types = [].concat(schema.type || []);
    if (!types.length) out.push(path + ': no type');
    if (types.includes('object')) {
      const props = Object.keys(schema.properties || {});
      if (schema.additionalProperties !== false) out.push(path + ': additionalProperties');
      if (JSON.stringify((schema.required || []).slice().sort()) !== JSON.stringify(props.slice().sort())) out.push(path + ': required');
      for (const p of props) strict(schema.properties[p], path + '.' + p, out);
    }
    if (types.includes('array')) { if (!schema.items) out.push(path + ': items'); else strict(schema.items, path + '[]', out); }
    return out;
  }

  test('commands: every command has a snake_case name, a description and a strict schema; the AI sees which ones write', async (assert) => {
    const all = commands.list();
    assert.ok(all.length >= 20, 'commands: ' + all.length);
    for (const c of all) {
      assert.ok(/^[a-z][a-z0-9_]*$/.test(c.name), c.name);
      assert.ok(c.description.length > 20, 'description of ' + c.name);
      assert.deepEqual(strict(c.parameters, c.name, []), [], 'strict schema');
    }
    const reads = commands.list({ writes: false }).map((c) => c.name);
    for (const n of ['list_datasets', 'describe_dataset', 'read_rows', 'column_stats', 'run_sql', 'list_operations', 'describe_operation', 'list_items', 'list_files']) assert.ok(reads.includes(n), n + ' reads');
    const writes = commands.list({ writes: true }).map((c) => c.name);
    for (const n of ['apply_operation', 'undo', 'refresh_dataset', 'export_dataset', 'run_flow', 'run_r', 'run_python']) assert.ok(writes.includes(n), n + ' writes');
    const tool = commands.tools().find((x) => x.name === 'apply_operation');
    assert.ok(/approves/.test(tool.description), 'the AI is told a writing command is approved');
    return all.length + ' commands';
  });

  test('commands: arguments are checked against the schema, and a name outside the registry is refused', async (assert) => {
    assert.ok(commands.validate('read_rows', {}).some((m) => /dataset/.test(m)), 'missing dataset');
    assert.ok(commands.validate('read_rows', { dataset: 1, columns: null, filters: null, order_by: null, descending: null, limit: null, offset: null }).some((m) => /dataset/.test(m)), 'wrong type');
    assert.ok(commands.validate('export_dataset', { dataset: 'x', format: 'exe' }).some((m) => /format/.test(m)), 'outside the enum');
    assert.ok(commands.validate('list_datasets', { extra: 1 }).some((m) => /extra/.test(m)), 'unknown argument');
    assert.deepEqual(commands.validate('read_rows', { dataset: 'x', columns: null, filters: [{ column: 'a', op: '=', value: 1 }], order_by: null, descending: null, limit: 5, offset: null }), [], 'nulls for what is left out');
    assert.ok(commands.validate('read_rows', { dataset: 'x', columns: null, filters: [{ column: 'a', op: 'like', value: 1 }], order_by: null, descending: null, limit: null, offset: null }).some((m) => /filters\[0\]\.op/.test(m)), 'nested enum with its path');
    const r = await commands.run('drop_everything', {});
    assert.equal(r.ok, false); assert.ok(/drop_everything/.test(r.error));
    const bad = await commands.run('describe_dataset', { dataset: 'x', more: true });
    assert.equal(bad.ok, false); assert.ok(/more/.test(bad.error), bad.error);
    return 'ok';
  });

  test('commands: reading datasets by id or name, rows with filters and order, column summaries', async (assert) => {
    const meta = await table('Kommandoprov läsning');
    const listed = await commands.run('list_datasets', {});
    assert.ok(listed.ok && listed.result.datasets.some((d) => d.id === meta.id && d.rows === 4 && d.kind === 'table'), 'listed');
    const byName = await commands.run('describe_dataset', { dataset: 'kommandoprov LÄSNING' });
    assert.ok(byName.ok, byName.error);
    assert.equal(byName.result.id, meta.id, 'found by its name');
    assert.deepEqual(byName.result.columns.map((c) => c.name + ':' + c.type), ['kommun:text', 'antal:integer']);
    const rows = await commands.run('read_rows', { dataset: meta.id, columns: ['kommun', 'antal'], filters: [{ column: 'kommun', op: '=', value: 'Ale' }], order_by: 'antal', descending: true, limit: 1, offset: null });
    assert.ok(rows.ok, rows.error);
    assert.deepEqual(rows.result.rows, [['Ale', 10]], 'filtered, sorted, cut');
    assert.equal(rows.result.total, 2); assert.equal(rows.result.truncated, true);
    const nulls = await commands.run('read_rows', { dataset: meta.id, columns: null, filters: [{ column: 'antal', op: 'is_null', value: null }], order_by: null, descending: null, limit: null, offset: null });
    assert.deepEqual(nulls.result.rows, [['Borås', null]], 'is_null');
    const contains = await commands.run('read_rows', { dataset: meta.id, columns: ['kommun'], filters: [{ column: 'kommun', op: 'starts_with', value: 'Bo' }], order_by: 'kommun', descending: null, limit: null, offset: null });
    assert.deepEqual(contains.result.rows, [['Bollebygd'], ['Borås']], 'starts_with');
    const injected = await commands.run('read_rows', { dataset: meta.id, columns: null, filters: [{ column: 'kommun" = kommun; --', op: '=', value: 'x' }], order_by: null, descending: null, limit: null, offset: null });
    assert.equal(injected.ok, false, 'a column that does not exist never reaches the statement');
    const stats = await commands.run('column_stats', { dataset: meta.id, column: 'antal' });
    assert.ok(stats.ok, stats.error);
    assert.equal(stats.result.sum, 35); assert.equal(stats.result.missing, 1);
    return 'ok';
  });

  test('commands: SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing', async (assert) => {
    const meta = await table('Kommandoprov SQL');
    const r = await commands.run('run_sql', { dataset: meta.id, sql: 'select kommun, sum(antal) as s from data group by kommun order by kommun;' });
    assert.ok(r.ok, r.error);
    assert.deepEqual(r.result.rows[0], ['Ale', 15]);
    const commented = await commands.run('run_sql', { dataset: meta.id, sql: '-- the sum\nselect count(*) from data' });
    assert.ok(commented.ok, 'a comment first is fine: ' + commented.error);
    for (const sql of ['select 1; delete from data', 'with x as (select 1) delete from data', 'delete from data', 'update data set antal = 0', 'drop table data', 'pragma query_only = 0', 'attach database \':memory:\' as x']) {
      const res = await commands.run('run_sql', { dataset: meta.id, sql });
      assert.equal(res.ok, false, 'refused: ' + sql);
    }
    assert.equal(await datasets.count(meta.id), 4, 'all rows are left');
    // The lock is lifted afterwards: the person's own operations still write.
    await recipes.apply(meta.id, 'delete_rows', { where: "kommun = 'Borås'" });
    assert.equal(await datasets.count(meta.id), 3, 'writes work again after a refused statement');
    return 'ok';
  });

  test('commands: an operation needs approval unless the person runs it, is checked against its own schema and can be undone', async (assert) => {
    const meta = await table('Kommandoprov åtgärd');
    const args = { dataset: meta.id, operation: 'rename_column', params: JSON.stringify({ column: 'antal', name: 'invånare' }) };
    const none = await commands.run('apply_operation', args);
    assert.equal(none.ok, false); assert.equal(none.refused, true, 'no approver: refused');
    const asked = [];
    const no = await commands.run('apply_operation', args, { approve: async (cmd, a) => { asked.push([cmd.name, a.operation]); return false; } });
    assert.equal(no.refused, true, 'the person said no');
    assert.deepEqual(asked, [['apply_operation', 'rename_column']], 'the approver sees the command and its arguments');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'antal'], 'nothing changed');
    const wrong = await commands.run('apply_operation', { dataset: meta.id, operation: 'rename_column', params: JSON.stringify({ column: 'antal' }) }, { approve: yes });
    assert.equal(wrong.ok, false); assert.ok(/name/.test(wrong.error), 'the operation\'s own required parameter: ' + wrong.error);
    const notJson = await commands.run('apply_operation', { dataset: meta.id, operation: 'rename_column', params: '{column: antal' }, { approve: yes });
    assert.equal(notJson.ok, false);
    const unknownOp = await commands.run('apply_operation', { dataset: meta.id, operation: 'format_disk', params: '{}' }, { approve: yes });
    assert.equal(unknownOp.ok, false);
    const done = await commands.run('apply_operation', args, { approve: yes });
    assert.ok(done.ok, done.error);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'invånare'], 'renamed');
    assert.ok((await recipes.steps(meta.id)).some((s) => s.op === 'rename_column'), 'a recipe step');
    const undone = await commands.run('undo', { dataset: meta.id }, { trusted: true });
    assert.ok(undone.ok, undone.error);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'antal'], 'undone');
    const ops = await commands.run('list_operations', { group: 'column' });
    assert.ok(ops.result.operations.some((o) => o.id === 'rename_column' && o.for === 'table'), 'listed with its group');
    const described = await commands.run('describe_operation', { operation: 'rename_column' });
    assert.deepEqual(described.result.parameters.required, ['column', 'name'], 'its schema');
    return 'ok';
  });

  test('commands: names that fit several are refused, a flow step makes a file that stays in the app until taken', async (assert) => {
    const a = await table('Kommandoprov tvilling');
    await table('Kommandoprov tvilling');
    const twice = await commands.run('describe_dataset', { dataset: 'Kommandoprov tvilling' });
    assert.equal(twice.ok, false); assert.ok(/id/.test(twice.error), 'asks for the id');
    const missing = await commands.run('describe_dataset', { dataset: 'Finns inte' });
    assert.equal(missing.ok, false);
    const exported = await commands.run('export_dataset', { dataset: a.id, format: 'csv' }, { trusted: true });
    assert.ok(exported.ok, exported.error);
    const name = exported.result.files[0];
    assert.ok(/\.csv$/.test(name), name);
    assert.ok((await commands.run('list_files', {})).result.files.some((f) => f.name === name), 'listed');
    const file = commands.take(name);
    assert.ok(file && /kommun/.test(await file.blob.text()), 'the CSV');
    assert.equal(commands.take(name), null, 'handed over once');
    return 'ok';
  });

  test('conditions: comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code', async (assert) => {
    const c = D.require('data/conditions');
    const scope = { kontroll: { total: 12, rows: [['Ale', 15], ['Borås', 3]] }, tom: { rows: [] }, namn: 'Göteborg', item: 'Ale' };
    assert.equal(c.test('kontroll.total > 0', scope), true);
    assert.equal(c.test('kontroll.total >= 13 or not tom.rows', scope), true, 'an empty list is false');
    assert.equal(c.test("kontroll.rows[0][0] = 'Ale' and kontroll.rows[1][1] < 5", scope), true, 'indexes');
    assert.equal(c.test('kontroll.rows.length == 2', scope), true, 'length');
    assert.equal(c.test("namn contains 'göte'", scope), true, 'contains ignores case');
    assert.equal(c.test('saknas.helt = null', scope), true, 'a missing answer is null, not an error');
    assert.equal(c.test("'10' > 9", scope), true, 'a number written as text compares as a number');
    assert.equal(c.test('(kontroll.total > 20 or item = "Ale") and true', scope), true, 'parentheses');
    assert.equal(c.test('kontroll.constructor = null', scope), true, 'nothing from the prototype');
    for (const bad of ['kontroll.total >', 'alert(1)', 'a; b', '(a = 1', "'open", 'x = -', 'a.', 'a[b]']) assert.ok(c.check(bad), 'refused: ' + bad);
    assert.ok(c.check('x'.repeat(c.MAX_LENGTH + 1)), 'too long');
    assert.ok(c.check('('.repeat(30) + '1' + ')'.repeat(30)), 'too deep');
    assert.deepEqual(c.fill({ dataset: '{{item}}', n: '{{kontroll.total}}', text: 'Antal: {{kontroll.total}} i {{namn}}', list: ['{{tom.rows}}'] }, scope),
      { dataset: 'Ale', n: 12, text: 'Antal: 12 i Göteborg', list: [[]] }, 'a whole reference keeps its type');
    return 'ok';
  });

  test('commands: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
