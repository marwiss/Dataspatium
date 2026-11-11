// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the AI in the app with the app's commands (ai/assistant, F30 a, F32 a, F34 a) against a mocked Anthropic Messages
 * server (a virtual dataspatium-asset:// address, no network) that answers by call count: it reads, asks for a writing command
 * that the person approves or refuses, asks the person a question, proposes a plan and answers in words; the conversation is
 * remembered between sessions as a notebook (F37 b). Own test data only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const assistant = D.require('ai/assistant');
  const providers = D.require('ai/providers');
  const datasets = D.require('data/datasets');
  const BASE = 'dataspatium-asset://tests/ai-assistant';
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data), status: 200 });
  const created = [];
  const world = { calls: 0, script: [], bodies: [] };
  const toolUse = (name, input) => ({ id: 'm' + world.calls, content: [{ type: 'tool_use', id: 'tu' + world.calls, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 20 } });
  const words = (text) => ({ id: 'm' + world.calls, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } });
  // The virtual server sees only the address; the bodies are read where the app sends them (api/http).
  const http = D.require('api/http');
  let realRequest = null;
  D.net.virtual('tests/ai-assistant/', async (url) => {
    if (!url.endsWith('/v1/messages')) return { kind: 'text', data: '{}', status: 404 };
    const next = world.script[world.calls] || words('Klart.');
    world.calls++;
    return json(typeof next === 'function' ? next() : next);
  });
  let provider = null;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }

  test('assistant: reads, runs an approved command, asks the person, proposes a plan and answers; the language is in the system text', async (assert) => {
    realRequest = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE) && req.body) world.bodies.push(String(req.body)); return realRequest(req); };
    provider = await providers.save({ id: 'ai-test-assistant', kind: 'anthropic', name: 'Mock assistant', baseUrl: BASE + '/', model: 'claude-test' });
    providers.setKey(provider.id, 'sk-test-assistant');
    await providers.setPolicy('ask');
    const meta = await datasets.create({ name: 'Assistentprov', columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Ale', 10], ['Borås', 3]] });
    created.push(meta.id);
    world.calls = 0; world.bodies = [];
    world.script = [
      () => toolUse('describe_dataset', { dataset: meta.id }),
      () => toolUse('apply_operation', { dataset: meta.id, operation: 'rename_column', params: JSON.stringify({ column: 'antal', name: 'invånare' }) }),
      () => toolUse('ask_person', { question: 'Vill du ha ett diagram?', options: [{ label: 'Ja', description: 'Ett stapeldiagram' }, { label: 'Nej', description: null }], allow_free: null }),
      () => toolUse('propose_plan', { name: 'Varje månad', steps: JSON.stringify([{ type: 'command', id: 'ut', params: { command: 'export_dataset', args: { dataset: meta.id, format: 'csv' } } }]) }),
      () => words('Jag döpte om kolumnen antal till invånare.'),
    ];
    const approvals = []; const questions = []; const events = [];
    const r = await assistant.run({
      provider, task: 'Döp om antal till invånare',
      approve: async (cmd, args) => { approvals.push([cmd.name, args.operation]); return true; },
      ask: async (q) => { questions.push(q); return { answer: 'Ja', index: 0, free: false }; },
      onEvent: (ev) => events.push(ev.type),
    });
    assert.equal(r.stopped, 'answered');
    assert.equal(r.answer, 'Jag döpte om kolumnen antal till invånare.');
    assert.deepEqual(approvals, [['apply_operation', 'rename_column']], 'only the writing command was approved');
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['kommun', 'invånare'], 'applied after approval');
    assert.equal(questions[0].question, 'Vill du ha ett diagram?');
    assert.deepEqual(questions[0].options.map((o) => o.label), ['Ja', 'Nej']);
    assert.ok(r.plan && r.plan.name === 'Varje månad' && r.plan.steps[0].params.command === 'export_dataset', 'the plan as a draft flow');
    assert.ok(events.includes('plan') && events.includes('step'), 'events for the panel');
    assert.deepEqual(r.steps.map((s) => s.command + ':' + s.ok + ':' + s.writes), ['describe_dataset:true:false', 'apply_operation:true:true', 'ask_person:true:false', 'propose_plan:true:false']);
    const flow = assistant.toFlow(r.steps, 'Från AI');
    assert.deepEqual(flow.steps.map((s) => s.params.command), ['apply_operation'], 'the writing steps that ran become a flow');
    const first = JSON.parse(world.bodies[0]);
    assert.ok(/Svenska \(sv\)|\(sv\)/.test(first.system) || /\(en\)/.test(first.system), 'the language in the system text');
    assert.ok(first.tools.some((x) => x.name === 'ask_person') && first.tools.some((x) => x.name === 'run_sql'), 'commands and ask_person as tools');
    const second = JSON.parse(world.bodies[1]);
    assert.ok(JSON.stringify(second.messages).includes('[data from the app]'), 'answers marked as data');
    return 'ok';
  });

  test('assistant: a refused command is not run and the refusal goes back to the AI; a closed question is an answer too', async (assert) => {
    const meta = await datasets.create({ name: 'Assistentprov nej', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    created.push(meta.id);
    world.calls = 0; world.bodies = [];
    world.script = [
      () => toolUse('apply_operation', { dataset: meta.id, operation: 'delete_rows', params: JSON.stringify({ where: '1 = 1' }) }),
      () => toolUse('ask_person', { question: 'Vad vill du göra?', options: [{ label: 'A', description: null }, { label: 'B', description: null }], allow_free: true }),
      () => toolUse('propose_plan', { name: 'Fel', steps: '[{"type": "format_disk"}]' }),
      () => words('Jag gör inget.'),
    ];
    const r = await assistant.run({ provider, task: 'Töm tabellen', approve: async () => false, ask: async () => null });
    assert.equal(await datasets.count(meta.id), 1, 'nothing deleted');
    assert.equal(r.steps[0].refused, true);
    assert.ok(JSON.stringify(JSON.parse(world.bodies[1]).messages).includes('refused'), 'the AI learns it was refused');
    assert.equal(r.steps[1].ok, false, 'a closed question');
    assert.equal(r.steps[2].ok, false, 'a plan with an unknown step is refused');
    assert.equal(r.plan, null);
    assert.deepEqual(assistant.toFlow(r.steps, 'x').steps, [], 'nothing ran that could become a flow');
    return 'ok';
  });

  test('assistant: the budget of turns ends the loop, and cancelling stops it', async (assert) => {
    world.calls = 0;
    world.script = Array.from({ length: 10 }, () => () => toolUse('list_datasets', {}));
    const r = await assistant.run({ provider, task: 'Lista', approve: async () => false, budget: { turns: 3 } });
    assert.equal(r.stopped, 'budget');
    assert.equal(r.steps.length, 3);
    const ctl = new AbortController(); ctl.abort();
    const c = await assistant.run({ provider, task: 'Lista', approve: async () => false, signal: ctl.signal });
    assert.equal(c.stopped, 'cancelled');
    return 'ok';
  });

  test('assistant: the floating panel sends a task, shows the approval dialog and the question, and saves the steps as a flow', async (assert) => {
    const flows = D.require('data/flows');
    const meta = await datasets.create({ name: 'Assistentprov panel', columns: [{ name: 'a', type: 'text' }, { name: 'b', type: 'integer' }], rows: [['x', 1]] });
    created.push(meta.id);
    world.calls = 0;
    world.script = [
      () => toolUse('apply_operation', { dataset: meta.id, operation: 'rename_column', params: JSON.stringify({ column: 'b', name: 'c' }) }),
      () => toolUse('ask_person', { question: '<b>Klar?</b>', options: [{ label: 'Ja', description: null }, { label: 'Nej', description: null }], allow_free: null }),
      () => words('Kolumnen heter nu c.'),
    ];
    const ctx = { shell: { log() {}, openFlows() {} } };
    const ui = D.require('ui/assistant');
    const handle = ui.open(ctx);
    try {
      await waitFor(() => handle.state.providers.length, 3000, 'the providers');
      handle.state.providerId = provider.id;
      handle.state.task = 'Byt namn på b';
      const sent = handle.send();
      const approval = await waitFor(() => document.querySelector('dialog[open] [data-assistant-approve="apply_operation"]'), 5000, 'the approval dialog');
      assert.ok(/rename_column/.test(approval.textContent), 'the real arguments are shown');
      const dlg = approval.closest('dialog');
      /** @type {HTMLElement} */ (dlg.querySelectorAll('.dm-dialog-actions dm-button button')[1]).click();
      const q = await waitFor(() => handle.panel.el.querySelector('[data-ask]'), 5000, 'the question in the panel');
      assert.equal(q.querySelector('b'), null, 'the question is text only');
      /** @type {HTMLElement} */ (q.querySelector('[data-ask-option="0"] button')).click();
      await sent;
      assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['a', 'c'], 'renamed after approval');
      assert.ok(handle.panel.el.textContent.includes('Kolumnen heter nu c.'), 'the answer in the panel');
      const before = (await flows.list()).length;
      const save = Array.from(handle.panel.el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === D.t('assistant.steps.save'));
      assert.ok(save, 'the steps can be saved as a flow');
      /** @type {HTMLElement} */ (save.querySelector('button')).click();
      await waitFor(async () => (await flows.list()).length === before + 1, 3000, 'the saved flow');
      const made = (await flows.list()).find((f) => f.steps.length === 1 && f.steps[0].params.command === 'apply_operation' && f.steps[0].params.args.dataset === meta.id);
      assert.ok(made, 'one command step');
      await flows.remove(made.id);
      assert.equal(ui.open(ctx), handle, 'one panel per page');
    } finally { handle.panel.close(); }
    return 'ok';
  }, 30000);

  test('assistant: the conversation is remembered between sessions as a notebook of the workspace, goes into no bundle, reaches the provider as history, and Nytt samtal forgets it', async (assert) => {
    const notebooks = D.require('analysis/notebooks');
    const workspace = D.require('data/workspace');
    await assistant.forget();
    assert.deepEqual(await assistant.recall(), [], 'nothing remembered at the start');
    await assistant.remember({ task: 'Hur många rader har Assistentprov?', answer: 'Två rader.' });
    await assistant.remember({ task: 'Och  kolumner?', answer: 'Två kolumner: kommun och invånare.\n' });
    const got = await assistant.recall();
    assert.deepEqual(got.map((x) => x.task + ' / ' + x.answer), ['Hur många rader har Assistentprov? / Två rader.', 'Och kolumner? / Två kolumner: kommun och invånare.']);
    assert.ok(got.every((x) => /^\d{4}-\d\d-\d\dT/.test(x.at)), 'each with its time');
    const history = assistant.historyOf(got);
    assert.deepEqual(history.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
    assert.equal(history[3].content[0].text, 'Två kolumner: kommun och invånare.');
    const nb = (await notebooks.list()).find((x) => x.kind === assistant.MEMORY_KIND);
    assert.ok(nb && nb.name === D.t('assistant.title') && nb.cells.length === 2 && nb.cells[0].type === 'markdown' && /Hur många rader/.test(nb.cells[0].source), 'a notebook the person can read');
    const meta = await datasets.create({ name: 'Assistentprov minne', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    created.push(meta.id);
    const bundle = await workspace.collect({ kind: 'bundle', datasetIds: [meta.id], listAll: false });
    assert.ok(!Object.keys(bundle.files).includes('notebooks/' + nb.id + '.nb.json'), 'not in a bundle for others');
    const backup = await workspace.collect({});
    assert.ok(Object.keys(backup.files).includes('notebooks/' + nb.id + '.nb.json'), 'in the person\'s own backup');
    // The panel shows the memory, sends it to the provider as earlier turns, remembers the new exchange, and forgets on Nytt samtal.
    world.calls = 0; world.bodies = [];
    world.script = [() => words('Tre rader nu.')];
    const ctx = { shell: { log() {}, openFlows() {} } };
    const ui = D.require('ui/assistant');
    const handle = ui.open(ctx);
    try {
      await waitFor(() => handle.state.providers.length && handle.state.earlier.length, 3000, 'the providers and the memory');
      assert.equal(handle.panel.el.querySelector('[data-assistant-memory]').getAttribute('data-assistant-memory'), '2', 'the memory shown');
      handle.state.providerId = provider.id;
      handle.state.task = 'Och nu?';
      await handle.send();
      const sent = JSON.parse(world.bodies[0]);
      assert.equal(sent.messages[0].content, 'Hur många rader har Assistentprov?', 'the earlier task first');
      assert.equal(sent.messages[4].content, 'Och nu?', 'then the new one');
      await waitFor(async () => (await assistant.recall()).length === 3, 3000, 'the new exchange remembered');
      const fresh = Array.from(handle.panel.el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === D.t('assistant.new'));
      assert.ok(fresh, 'Nytt samtal offered');
      /** @type {HTMLElement} */ (fresh.querySelector('button')).click();
      await waitFor(async () => (await assistant.recall()).length === 0, 3000, 'forgotten');
      assert.equal(handle.panel.el.querySelector('[data-assistant-memory]'), null, 'the memory line gone');
    } finally { handle.panel.close(); }
    return 'ok';
  }, 30000);

  test('assistant: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    if (provider) await providers.remove(provider.id).catch(() => {});
    if (realRequest) http.request = realRequest;
    assert.ok(true);
  });
})();
