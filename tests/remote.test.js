// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Styrning utifrån (api/remote, F30 a): the page tells a fake bridge its commands and polls for queued ones, a reading
 * command runs at once, a writing command waits for the person's approval and a refusal goes back, a plan runs once as a flow with
 * its files kept in the app, a plan with a step the app lacks is refused, a bridge without --allow-commands is told, and the switch
 * off stops the polling. Nothing touches the net: the bridge is a transport function.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const bridge = D.require('api/bridge');
  const remote = D.require('api/remote');
  const commands = D.require('data/commands');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  /** A bridge with the command queue of tools/db_bridge.py 2.5.0, answering a poll at once (as the PowerShell bridge does). */
  function fakeBridge(options = {}) {
    const srv = { token: 'hemlig-token', commands: options.commands !== false, catalog: null, queue: [], items: new Map(), calls: [], seq: 0 };
    const json = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: async () => obj });
    srv.enqueue = (name, args) => { const id = 'c' + (++srv.seq); srv.items.set(id, { id, name, args, state: 'queued' }); srv.queue.push(id); return id; };
    srv.transport = async (url, init) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(init.body) : {};
      srv.calls.push({ path: u.pathname, body });
      if ((init.headers || {}).Authorization !== 'Bearer ' + srv.token) return json(401, { error: 'Fel eller saknad token' });
      if (u.pathname === '/') return json(200, { name: 'Dataspatium-databasbrygga', version: '2.5.0', platform: 'linux', allowWrite: false, kinds: ['sqlite'], maxRows: 100000, fetch: true, commands: srv.commands });
      if (u.pathname.startsWith('/commands') && !srv.commands) return json(403, { error: 'Bryggan startades utan --allow-commands' });
      if (u.pathname === '/commands/catalog') { if (init.method === 'POST') { srv.catalog = body.commands; return json(200, { registered: srv.catalog.length }); } return json(200, { connected: !!srv.catalog, commands: srv.catalog || [], queued: srv.queue.length }); }
      if (u.pathname === '/commands/next') { const id = srv.queue.shift(); if (!id) return json(200, {}); const it = srv.items.get(id); it.state = 'running'; return json(200, { id, name: it.name, args: it.args }); }
      const result = /^\/commands\/([^/]+)\/result$/.exec(u.pathname);
      if (result && init.method === 'POST') { const it = srv.items.get(decodeURIComponent(result[1])); if (!it) return json(404, { error: 'Okänt kommando' }); Object.assign(it, { state: 'done', ok: body.ok, result: body.result, error: body.error }); return json(200, { id: it.id, state: 'done' }); }
      return json(404, { error: 'Okänd sökväg ' + u.pathname });
    };
    srv.done = (id) => { const it = srv.items.get(id); return it && it.state === 'done' ? it : null; };
    return srv;
  }
  async function table(name) {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Ale', 10], ['Borås', 3]] });
    created.push(meta.id);
    return meta;
  }

  test('remote: with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once', async (assert) => {
    const srv = fakeBridge();
    bridge.setTransport(srv.transport);
    const asked = []; let approveAnswer = false; let confirmed = 0;
    remote.setAsker({ confirm: async () => { confirmed++; return true; }, approve: async (cmd, args, options) => { asked.push([cmd.name, args.operation || args.name || '', options && options.source]); return approveAnswer; }, log: () => {} });
    try {
      await bridge.connect('http://127.0.0.1:1', srv.token);
      assert.equal(remote.status().on, false, 'off at the start');
      assert.equal(await remote.setOn(true), true, 'turned on after the confirmation');
      assert.equal(confirmed, 1, 'asked once');
      await waitFor(() => remote.status().connected, 5000, 'connected to the bridge');
      assert.ok(Array.isArray(srv.catalog) && srv.catalog.length >= 20 && srv.catalog.some((c) => c.name === 'run_plan' && c.writes === true), 'the commands registered: ' + (srv.catalog || []).length);
      const meta = await table('Styrningsprov');
      // A command that reads runs at once.
      const id1 = srv.enqueue('read_rows', { dataset: meta.id, columns: ['kommun'], filters: null, order_by: 'kommun', descending: null, limit: null, offset: null });
      const r1 = await waitFor(() => srv.done(id1), 8000, 'the reading command answered');
      assert.ok(r1.ok, r1.error);
      assert.deepEqual(r1.result.rows, [['Ale'], ['Borås']], 'the rows back through the bridge');
      assert.deepEqual(asked, [], 'nothing asked for a reading command');
      // A command that writes waits for the person; a refusal goes back as the error.
      const id2 = srv.enqueue('apply_operation', { dataset: meta.id, operation: 'rename_column', params: JSON.stringify({ column: 'antal', name: 'n' }) });
      const r2 = await waitFor(() => srv.done(id2), 8000, 'the writing command answered');
      assert.equal(r2.ok, false); assert.ok(/rename_column|apply_operation/.test(r2.error), 'the refusal: ' + r2.error);
      assert.deepEqual(asked, [['apply_operation', 'rename_column', 'bridge']], 'asked once, naming the bridge as the source');
      assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'antal'], 'nothing changed');
      // A plan runs once as a flow when approved, and its file stays in the app until fetched.
      approveAnswer = true;
      const steps = [{ type: 'command', id: 'n', params: { command: 'list_datasets', args: {} } }, { type: 'if', params: { condition: 'n.datasets.length > 0' }, steps: [{ type: 'command', params: { command: 'export_dataset', args: { dataset: meta.id, format: 'csv' } } }], otherwise: [{ type: 'stop', params: { message: 'inga' } }] }];
      const id3 = srv.enqueue('run_plan', { name: 'Utifrån', steps: JSON.stringify(steps) });
      const r3 = await waitFor(() => srv.done(id3), 10000, 'the plan answered');
      assert.ok(r3.ok, r3.error);
      assert.ok(r3.result.ok && r3.result.files.length === 1 && /\.csv$/.test(r3.result.files[0]), 'the plan ran and made a file: ' + JSON.stringify(r3.result));
      assert.deepEqual(r3.result.steps.map((s) => s.path), ['1', '2', '2.1'], 'the steps as the flow logged them');
      assert.ok(commands.take(r3.result.files[0]), 'the file is in the app');
      assert.ok(!(await datasets.list()).some((d) => d.name === 'Utifrån'), 'nothing saved as a flow or dataset');
      // A plan with a step the app lacks is refused before anything runs.
      const id4 = srv.enqueue('run_plan', { name: 'Fel', steps: JSON.stringify([{ type: 'format_disk', params: {} }]) });
      const r4 = await waitFor(() => srv.done(id4), 8000, 'the bad plan answered');
      assert.equal(r4.ok, false); assert.equal(r4.error, t('flows.err.step.type', { type: 'format_disk' }));
      assert.equal(remote.status().count, 4, 'four commands counted');
      // Off: the polling stops, and what is queued afterwards stays in the queue.
      await remote.setOn(false);
      assert.equal(remote.status().on, false);
      await wait(700);
      const polls = srv.calls.filter((c) => c.path === '/commands/next').length;
      srv.enqueue('list_datasets', {});
      await wait(800);
      assert.equal(srv.calls.filter((c) => c.path === '/commands/next').length, polls, 'no more polling');
      assert.equal(srv.queue.length, 1, 'left in the queue');
      // A refused confirmation leaves it off.
      remote.setAsker({ confirm: async () => false, approve: async () => false, log: () => {} });
      assert.equal(await remote.setOn(true), false, 'not turned on without the confirmation');
    } finally {
      await remote.setOn(false);
      remote.setAsker(null);
      await bridge.disconnect().catch(() => {});
      bridge.setTransport(null);
    }
    return 'ok';
  }, 40000);

  test('remote: a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst', async (assert) => {
    const srv = fakeBridge({ commands: false });
    bridge.setTransport(srv.transport);
    remote.setAsker({ confirm: async () => true, approve: async () => false, log: () => {} });
    try {
      await bridge.connect('http://127.0.0.1:1', srv.token);
      await remote.setOn(true);
      await waitFor(() => remote.status().reason === 'flag', 5000, 'the flag told');
      assert.equal(remote.status().connected, false);
      const card = await D.require('ui/settings/network').networkCard({ ui: { icon: () => document.createElement('span'), toast: { show() {} }, button: D.require('ui/basic').button }, shell: { log() {} } }, () => {});
      assert.equal(card.querySelector('[data-remote-state]').getAttribute('data-remote-state'), 'flag', 'the state shown');
      assert.equal(card.querySelector('[data-remote-state]').textContent, t('remote.state.flag'));
      assert.ok(/** @type {any} */ (card.querySelector('[data-remote]')).checked, 'the switch on');
      await remote.setOn(false);
      const off = await D.require('ui/settings/network').networkCard({ ui: { icon: () => document.createElement('span'), toast: { show() {} }, button: D.require('ui/basic').button }, shell: { log() {} } }, () => {});
      assert.equal(off.querySelector('[data-remote-state]').getAttribute('data-remote-state'), 'off');
    } finally {
      await remote.setOn(false);
      remote.setAsker(null);
      await bridge.disconnect().catch(() => {});
      bridge.setTransport(null);
    }
    return 'ok';
  });

  test('remote: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
