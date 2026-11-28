// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the AI panels' feedback (B-83): answers streamed as server-sent events in Anthropic's and the OpenAI-compatible form,
 * with the fallback to the plain answer; Avbryt ending a stream being read; the status line above the conversation (the text as it is
 * written, the tool in words, the AI's time, the tokens); a question from the AI that makes the run button wait instead of spinning,
 * comes first in the panel and stops the clock; a change or build that proposed nothing; the models per kind and the server's list;
 * where each key is (session, stored and unlocked, stored and locked, missing) and Pröva nyckeln. Mocked providers (virtual
 * dataspatium-asset:// servers that see only the address, and api/http replaced for the streams the test writes itself); no network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const providers = D.require('ai/providers');
  const stream = D.require('ai/stream');
  const agent = D.require('ai/agent');
  const secrets = D.require('api/secrets');
  const http = D.require('api/http');
  const idb = D.require('platform/storage/idb');
  const BASE = 'dataspatium-asset://tests/ai-sse';
  const KEYS = 'dataspatium-asset://tests/ai-keys';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status: status || 200, headers: { 'Content-Type': 'application/json' } });
  const events = (text, type) => ({ kind: 'text', data: text, status: 200, headers: type === null ? {} : { 'Content-Type': type || 'text/event-stream' } });
  /** Server-sent events from [name, data] pairs; a null name sends data alone. */
  const sse = (list) => list.map(([name, data]) => (name ? `event: ${name}\n` : '') + `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`).join('');
  const pieces = (text, n) => { const out = []; const size = Math.max(1, Math.ceil(text.length / n)); for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size)); return out; };
  /** Anthropic's events for an answer: an optional thinking block (left out of the answer), text in pieces, a tool call in slices. */
  function anthropicEvents({ text = '', tool = '', input = {}, thinking = false, usage = { input: 120, output: 42 } }) {
    const ev = [['message_start', { type: 'message_start', message: { id: 'msg_s', type: 'message', role: 'assistant', content: [], usage: { input_tokens: usage.input, output_tokens: 1 } } }]];
    let i = 0;
    if (thinking) {
      ev.push(['content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '' } }]);
      ev.push(['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: '' } }]);
      ev.push(['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: 'c2ln' } }]);
      ev.push(['content_block_stop', { type: 'content_block_stop', index: i }]); i++;
    }
    if (text) {
      ev.push(['content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }]);
      for (const p of pieces(text, 3)) ev.push(['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: p } }]);
      ev.push(['content_block_stop', { type: 'content_block_stop', index: i }]); i++;
    }
    if (tool) {
      ev.push(['content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: 'tu_s' + i, name: tool, input: {} } }]);
      for (const p of pieces(JSON.stringify(input), 3)) ev.push(['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: p } }]);
      ev.push(['content_block_stop', { type: 'content_block_stop', index: i }]);
    }
    ev.push(['ping', { type: 'ping' }]);
    ev.push(['message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output } }]);
    ev.push(['message_stop', { type: 'message_stop' }]);
    return ev;
  }
  /** An OpenAI-compatible stream: the text in pieces, a tool call whose arguments come in slices, the finish and the usage chunk. */
  function openaiEvents({ text = '', tool = '', input = {} }) {
    const chunks = [{ id: 'c', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: '' } }] }];
    for (const p of text ? pieces(text, 3) : []) chunks.push({ id: 'c', choices: [{ index: 0, delta: { content: p } }] });
    if (tool) {
      chunks.push({ id: 'c', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_s', type: 'function', function: { name: tool, arguments: '' } }] } }] });
      for (const p of pieces(JSON.stringify(input), 3)) chunks.push({ id: 'c', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: p } }] } }] });
    }
    chunks.push({ id: 'c', choices: [{ index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop' }] });
    chunks.push({ id: 'c', choices: [], usage: { prompt_tokens: 90, completion_tokens: 12, total_tokens: 102 } });
    return chunks.map((c) => [null, c]).concat([[null, '[DONE]']]);
  }
  const words = (text) => json({ id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 10 } });

  // The mocked provider answers by its script, one entry per call; the bodies are read where the app sends them (api/http).
  const world = { calls: 0, script: /** @type {Array<() => any>} */ ([]), bodies: /** @type {string[]} */ ([]), lives: /** @type {any[]} */ ([]), keyHits: 0, down: 0 };
  D.net.virtual('tests/ai-sse/', async (url) => {
    const u = String(url);
    if (!u.endsWith('/v1/messages') && !u.endsWith('/chat/completions')) return json({ error: { message: 'no such path' } }, 404);
    const next = world.script[world.calls];
    world.calls++;
    return next ? next() : words('Klart.');
  });
  // The key's server: the path says how it answers, since a virtual server never sees the key.
  D.net.virtual('tests/ai-keys/', async (url) => {
    const u = String(url).split('?')[0];
    world.keyHits++;
    if (u.includes('/ok/') && u.endsWith('/v1/models')) return json({ data: [{ type: 'model', id: 'claude-zeta-test', display_name: 'Zeta' }, { type: 'model', id: 'claude-opus-5-5', display_name: 'Opus' }], has_more: false });
    if (u.includes('/ok-openai/') && u.endsWith('/models')) return json({ object: 'list', data: [{ id: 'qwen3', object: 'model' }, { id: 'llama3.2', object: 'model' }] });
    if (u.includes('/bad/')) return json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key sk-ant-echo-9999' } }, 401);
    if (u.includes('/denied/')) return json({ type: 'error', error: { type: 'permission_error', message: 'no access to this model' } }, 403);
    if (u.includes('/nolist/') && u.endsWith('/chat/completions')) return json({ id: 'c', choices: [{ message: { role: 'assistant', content: 'p' }, finish_reason: 'length' }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    return json({ error: { message: 'Not found' } }, 404);
  });
  let realRequest = null;
  /** A stream the test writes itself, piece by piece; `cancelled` says whether the reader gave it up. */
  function liveStream() {
    const enc = new TextEncoder();
    let ctl = null; let cancelled = false;
    const body = new ReadableStream({ start(c) { ctl = c; }, cancel() { cancelled = true; } });
    return { body, push: (list) => ctl.enqueue(enc.encode(sse(list))), end: () => ctl.close(), get cancelled() { return cancelled; } };
  }
  function install() {
    if (realRequest) return;
    realRequest = http.request;
    http.request = (req) => {
      const url = String(req.url);
      if (url.startsWith(BASE) && req.body) world.bodies.push(String(req.body));
      // The live streams: the next one the test has put in line, or a plain answer when none is left.
      if (url.startsWith(BASE + '/live')) {
        const live = world.lives.shift();
        if (live && live.body) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', headers: new Headers({ 'Content-Type': 'text/event-stream' }), url, text: '', buffer: null, body: live.body, contentType: 'text/event-stream', ms: 0 });
        const answer = JSON.stringify((live && live.json) || { id: 'm', content: [{ type: 'text', text: 'Klart.' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', headers: new Headers({ 'Content-Type': 'application/json' }), url, text: answer, buffer: null, body: null, contentType: 'application/json', ms: 0 });
      }
      if (url.startsWith(KEYS + '/down')) { world.down++; return Promise.reject(new http.ApiError('no network', { kind: 'network', url })); }
      return realRequest(req);
    };
  }
  let anthropic = null; let openai = null; let live = null; let model = null;
  async function setup() {
    install();
    if (!anthropic) {
      anthropic = await providers.save({ id: 'ai-sse-anthropic', kind: 'anthropic', name: 'Mock stream', baseUrl: BASE + '/a', model: 'claude-sonnet-5-5' });
      openai = await providers.save({ id: 'ai-sse-openai', kind: 'openai', name: 'Mock stream OpenAI', baseUrl: BASE + '/o', model: 'gpt-test' });
      live = await providers.save({ id: 'ai-sse-live', kind: 'anthropic', name: 'Mock live', baseUrl: BASE + '/live', model: 'claude-sonnet-5-5' });
    }
    for (const p of [anthropic, openai, live]) providers.setKey(p.id, 'sk-test-stream-' + p.id);
    await providers.setPolicy('ask');
  }
  async function theModel() {
    if (!model) model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Strömhuset');
    return model;
  }

  test('ai stream: the event parser reads events in any slices, with CRLF, comments and data on several lines', async (assert) => {
    const text = ': a comment\r\nevent: a\r\ndata: {"x":1}\r\n\r\nevent: b\ndata: line1\ndata:line2\n\nid: 7\ndata: plain\n\ndata: last';
    for (const size of [1, 2, 3, 7, text.length]) {
      const got = [];
      const p = stream.parser((name, data) => got.push([name, data]));
      for (let i = 0; i < text.length; i += size) p.push(text.slice(i, i + size));
      p.end();
      assert.deepEqual(got, [['a', '{"x":1}'], ['b', 'line1\nline2'], ['message', 'plain'], ['message', 'last']], 'slices of ' + size);
    }
    assert.ok(stream.looksLikeEvents('event: x\ndata: 1') && stream.looksLikeEvents('data: {}') && !stream.looksLikeEvents('{"a":1}'));
    return 'ok';
  });

  test('ai stream: Anthropic\'s events build the same answer as the plain call, report each piece, and the request asks for a stream', async (assert) => {
    await setup();
    world.calls = 0; world.bodies = [];
    const input = { ifc_class: 'IfcDoor', storey: null, name_contains: null, property_set: null, property_name: 'FireRating', property_value: null, missing_property: true, limit: null };
    world.script = [() => events(sse(anthropicEvents({ thinking: true, text: 'Jag letar efter dörrarna.', tool: 'query_elements', input })))];
    const deltas = [];
    const res = await providers.chat(anthropic, { messages: [{ role: 'user', content: 'hej' }], onDelta: (d) => deltas.push(d) });
    assert.equal(res.streamed, true, 'read as a stream');
    assert.equal(res.text, 'Jag letar efter dörrarna.');
    assert.deepEqual(res.toolCalls, [{ id: 'tu_s2', name: 'query_elements', args: input }], 'the tool call from its slices');
    assert.deepEqual(res.content.map((b) => b.type), ['text', 'tool_use'], 'the thinking block is left out, as in the plain answer');
    assert.deepEqual(res.usage, { input: 120, output: 42 }); assert.equal(res.stop, 'tool_use');
    assert.equal(deltas.filter((d) => d.type === 'text').map((d) => d.text).join(''), 'Jag letar efter dörrarna.', 'the text as it was written');
    assert.ok(deltas.some((d) => d.type === 'tool' && d.name === 'query_elements'), 'the tool reported when its call begins');
    assert.deepEqual(deltas.filter((d) => d.type === 'usage').pop(), { type: 'usage', input: 120, output: 42 });
    const body = JSON.parse(world.bodies[0]);
    assert.equal(body.stream, true, 'stream: true'); assert.equal(body.stream_options, undefined, 'no stream_options for Anthropic');
    // An error event inside the stream is the provider's error in words.
    world.calls = 0;
    world.script = [() => events(sse([['message_start', { type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 0 } } }], ['error', { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]]))];
    const err = await providers.chat(anthropic, { messages: [{ role: 'user', content: 'hej' }] }).catch((e) => e);
    assert.ok(err instanceof Error && err.message === t('ai.err.provider', { name: anthropic.name, detail: 'Overloaded' }), String(err && err.message));
    return 'ok';
  }, 20000);

  test('ai stream: an OpenAI-compatible stream with tool_calls deltas and the usage chunk builds the same answer', async (assert) => {
    await setup();
    world.calls = 0; world.bodies = [];
    world.script = [() => events(sse(openaiEvents({ text: 'Jag läser.', tool: 'get_element', input: { id: 12, guid: null } })))];
    const deltas = [];
    const res = await providers.chat(openai, { messages: [{ role: 'user', content: 'hej' }], onDelta: (d) => deltas.push(d) });
    assert.equal(res.streamed, true);
    assert.equal(res.text, 'Jag läser.');
    assert.deepEqual(res.toolCalls, [{ id: 'call_s', name: 'get_element', args: { id: 12, guid: null } }]);
    assert.deepEqual(res.usage, { input: 90, output: 12 }); assert.equal(res.stop, 'tool_calls');
    assert.ok(deltas.some((d) => d.type === 'tool' && d.name === 'get_element') && deltas.filter((d) => d.type === 'text').length === 3, 'the pieces reported');
    const body = JSON.parse(world.bodies[0]);
    assert.ok(body.stream === true && body.stream_options && body.stream_options.include_usage === true, 'stream with the usage asked for');
    assert.equal(body.max_tokens, 1024, 'max_tokens for a server that is not OpenAI\'s own');
    return 'ok';
  }, 20000);

  test('ai stream: a server that answers without a stream, or refuses one, gets the plain answer', async (assert) => {
    await setup();
    // A plain answer to a stream request.
    world.calls = 0; world.bodies = [];
    world.script = [() => words('Ett vanligt svar.')];
    const plain = await providers.chat(anthropic, { messages: [{ role: 'user', content: 'hej' }] });
    assert.equal(plain.text, 'Ett vanligt svar.'); assert.equal(plain.streamed, false);
    assert.equal(JSON.parse(world.bodies[0]).stream, true, 'the stream was asked for');
    // Events without their content type (a relayed answer) are still read.
    world.calls = 0;
    world.script = [() => events(sse(anthropicEvents({ text: 'Utan rubrik.' })), null)];
    const bare = await providers.chat(anthropic, { messages: [{ role: 'user', content: 'hej' }] });
    assert.equal(bare.text, 'Utan rubrik.');
    // A refusal to stream: the same call again without it, and the provider is not asked to stream again this session.
    const refusing = await providers.save({ id: 'ai-sse-refusing', kind: 'openai', name: 'Mock refusing', baseUrl: BASE + '/r', model: 'gpt-test' });
    providers.setKey(refusing.id, 'sk-test-refusing');
    world.calls = 0; world.bodies = [];
    world.script = [() => json({ error: { message: 'Unrecognized request argument supplied: stream_options' } }, 400), () => json({ id: 'c', choices: [{ message: { role: 'assistant', content: 'Utan ström.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
      () => json({ id: 'c', choices: [{ message: { role: 'assistant', content: 'Igen.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } })];
    const fell = await providers.chat(refusing, { messages: [{ role: 'user', content: 'hej' }] });
    assert.equal(fell.text, 'Utan ström.'); assert.equal(world.calls, 2, 'asked twice');
    const [first, second] = world.bodies.map((b) => JSON.parse(b));
    assert.ok(first.stream === true && second.stream === undefined && second.stream_options === undefined, 'the second call without the stream');
    const again = await providers.chat(refusing, { messages: [{ role: 'user', content: 'hej' }] });
    assert.equal(again.text, 'Igen.'); assert.equal(JSON.parse(world.bodies[2]).stream, undefined, 'remembered for the session');
    await providers.remove(refusing.id);
    return 'ok';
  }, 20000);

  test('ai stream: Avbryt ends a stream being read, and the agent says the question was cancelled; each tool is reported before it runs', async (assert) => {
    await setup();
    const ds = await theModel();
    const s1 = liveStream();
    world.lives = [s1];
    const controller = new AbortController();
    const got = [];
    const running = agent.ask({ provider: live, datasetId: ds.id, question: 'hej', signal: controller.signal, onEvent: (ev) => got.push(ev) });
    await waitFor(() => world.lives.length === 0, 3000, 'the request');
    s1.push([anthropicEvents({ text: 'x' })[0], ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }], ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Jag börjar' } }]]);
    await waitFor(() => got.some((ev) => ev.type === 'delta' && ev.delta.type === 'text'), 3000, 'the first words');
    controller.abort();
    const out = await running;
    assert.equal(out.stopped, 'cancelled'); assert.equal(out.answer, t('ai.answer.cancelled'));
    assert.ok(s1.cancelled, 'the stream itself was given up');
    // A run with a tool: tool-start before the tool, then the tool's step, then the usage of each turn.
    const s2 = liveStream();
    world.lives = [s2, { json: { id: 'm', content: [{ type: 'text', text: 'Två väggar.' }], stop_reason: 'end_turn', usage: { input_tokens: 30, output_tokens: 4 } } }];
    got.length = 0;
    const second = agent.ask({ provider: live, datasetId: ds.id, question: 'Hur många väggar?', onEvent: (ev) => got.push(ev) });
    await waitFor(() => world.lives.length === 1, 3000, 'the first request');
    s2.push(anthropicEvents({ tool: 'list_storeys', input: {} })); s2.end();
    const done = await second;
    assert.equal(done.stopped, 'answered'); assert.equal(done.answer, 'Två väggar.');
    const order = got.filter((ev) => ev.type !== 'delta').map((ev) => ev.type + (ev.name ? ':' + ev.name : ev.step ? ':' + ev.step.name : ''));
    assert.deepEqual(order, ['thinking', 'usage', 'tool-start:list_storeys', 'tool:list_storeys', 'thinking', 'usage'], order.join(', '));
    assert.deepEqual(got.filter((ev) => ev.type === 'usage').pop().usage, { input: 150, output: 46 }, 'the run\'s tokens after each turn');
    return 'ok';
  }, 30000);

  test('ai stream: the model panel shows the status line while the AI writes: the text, the tool in words, the AI\'s time and the tokens', async (assert) => {
    await setup();
    const ds = await theModel();
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      panel.state.providerId = live.id;
      const s1 = liveStream();
      world.lives = [s1, { json: { id: 'm', content: [{ type: 'text', text: 'Det finns två våningar.' }], stop_reason: 'end_turn', usage: { input_tokens: 30, output_tokens: 4 } } }];
      const asked = panel.ask('Hur många våningar?');
      const status = /** @type {HTMLElement} */ (await waitFor(() => panel.el.querySelector('[data-ai-run]:not([hidden])'), 3000, 'the status line'));
      assert.equal(status.getAttribute('data-ai-run'), 'thinking');
      assert.ok(status.compareDocumentPosition(panel.el.querySelector('[data-ai-ask]')) & Node.DOCUMENT_POSITION_PRECEDING, 'below the run button');
      const ev = anthropicEvents({ text: 'Jag läser våningarna.', tool: 'list_storeys', input: {}, usage: { input: 1234, output: 56 } });
      s1.push(ev.slice(0, 4));
      await waitFor(() => /Jag läser/.test(status.querySelector('[data-ai-run-live]').textContent), 3000, 'the text as it is written');
      assert.equal(status.getAttribute('data-ai-run'), 'writing');
      assert.ok(status.querySelector('[data-ai-run-meta]').textContent.includes(D.require('ui/i18n').formatNumber(1234)), 'the input tokens: ' + status.textContent);
      assert.ok(/\d+:\d\d/.test(status.querySelector('[data-ai-run-meta]').textContent), 'the AI\'s time');
      s1.push(ev.slice(4, 7));
      await waitFor(() => status.getAttribute('data-ai-run') === 'calling', 3000, 'the tool call begins');
      assert.ok(status.textContent.includes(t('ai.tool.list_storeys')), 'the tool in words: ' + status.textContent);
      assert.ok(panel.el.querySelector('[data-ai-ask]').hasAttribute('loading'), 'the run button spins while the AI works');
      s1.push(ev.slice(7)); s1.end();
      await asked;
      assert.ok(status.hidden, 'the status line goes when the run ends');
      assert.ok(/två våningar/.test(panel.el.querySelector('[data-ai-answer]').textContent), 'the answer');
      assert.ok(!panel.el.querySelector('[data-ai-ask]').hasAttribute('loading'));
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('ai stream: a question from the AI makes the run button wait instead of spinning, comes first in the panel, is focused, and stops the clock; a build without steps says so', async (assert) => {
    await setup();
    const ds = await theModel();
    world.calls = 0; world.bodies = [];
    world.script = [
      () => events(sse(anthropicEvents({ text: 'Jag behöver veta en sak.', tool: 'ask_person', input: { question: 'Hur många våningar?', options: [{ label: 'En', description: null }, { label: 'Två', description: 'Två plan' }], allow_free: false } }))),
      () => words('Jag bygger inget förrän fasaden är bestämd.'),
      () => words('Fortfarande inget.'),
    ];
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'build', brief: 'Ett hus' });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      panel.state.providerId = anthropic.id;
      const asked = panel.ask('Ett hus');
      const box = /** @type {HTMLElement} */ (await waitFor(() => panel.el.querySelector('[data-ask]'), 5000, 'the question'));
      assert.ok(panel.el.children[1] === box, 'the question first, under the title');
      assert.ok(box.classList.contains('dm-ask-pending') && box.textContent.includes(t('ai.run.question')), 'marked as waiting for the person');
      const button = /** @type {HTMLElement} */ (await waitFor(() => panel.el.querySelector('[data-ai-waiting]'), 3000, 'the waiting button'));
      assert.ok(!button.hasAttribute('loading'), 'the run button does not spin');
      assert.ok(button.textContent.includes(t('ai.run.waiting')), button.textContent);
      assert.equal(button.querySelector('button').getAttribute('data-tip'), t('ai.run.waiting.hint'), 'with its tip');
      assert.equal(panel.el.querySelector('[data-ai-run]').getAttribute('data-ai-run'), 'waiting');
      await waitFor(() => box.contains(document.activeElement), 3000, 'the question focused');
      /** @type {any} */ (document.activeElement).blur();
      /** @type {HTMLElement} */ (button.querySelector('button')).click();
      await waitFor(() => box.contains(document.activeElement), 3000, 'the waiting button brings the question forward');
      const before = panel.run.elapsed();
      await wait(1100);
      assert.ok(panel.run.elapsed() - before < 150, 'the clock stands still while the question waits: ' + (panel.run.elapsed() - before));
      /** @type {HTMLElement} */ (box.querySelector('[data-ask-option="1"] button')).click();
      await asked;
      assert.equal(world.calls, 2);
      const back = JSON.parse(world.bodies[1]).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((b) => b.type === 'tool_result');
      assert.ok(back && /"answer":"Två"/.test(String(back.content)), 'the answer went back to the AI');
      // Nothing proposed: the AI's words, said clearly, with Fråga igen and Ändra frågan.
      const none = /** @type {HTMLElement} */ (await waitFor(() => panel.el.querySelector('[data-ai-no-changes]'), 3000, 'the notice'));
      assert.ok(none.textContent.includes(t('ai.none.title')) && none.querySelector('[data-ai-none-answer]').textContent.includes('fasaden är bestämd'), none.textContent);
      assert.ok(!panel.el.querySelector('[data-ai-answer]'), 'the answer is shown once, in the notice');
      /** @type {HTMLElement} */ (none.querySelector('[data-ai-refine] button')).click();
      const q = /** @type {any} */ (panel.el.querySelector('[data-ai-question]'));
      assert.equal(q.value, 'Ett hus', 'the question back in its box');
      assert.ok(q.contains(document.activeElement), 'and focused');
      /** @type {HTMLElement} */ (panel.el.querySelector('[data-ai-ask] button')).click();
      await waitFor(() => world.calls === 3 && !panel.state.busy, 5000, 'asked again');
      assert.ok(/Fortfarande inget/.test(panel.el.querySelector('[data-ai-no-changes]').textContent));
      /** @type {HTMLElement} */ (panel.el.querySelector('[data-ai-again] button')).click();
      await waitFor(() => world.calls === 4 && !panel.state.busy, 5000, 'Fråga igen');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('ai stream: the AI assistant shows the status line above the conversation and its question first', async (assert) => {
    await setup();
    world.calls = 0;
    world.script = [
      () => events(sse(anthropicEvents({ text: 'Jag frågar först.', tool: 'ask_person', input: { question: 'Vilken datamängd?', options: [{ label: 'Den första', description: null }, { label: 'Ingen', description: null }], allow_free: null } }))),
      () => words('Då gör jag ingenting.'),
    ];
    const handle = D.require('ui/assistant').open({ shell: { log() {}, openFlows() {} } });
    try {
      await waitFor(() => handle.state.providers.length, 3000, 'the providers');
      handle.state.providerId = anthropic.id; handle.render();
      assert.ok(handle.panel.el.querySelector('.dm-floating-meta').textContent.includes('claude-sonnet-5-5'), 'the model in the panel');
      handle.state.task = 'Gör något';
      const sent = handle.send();
      const box = /** @type {HTMLElement} */ (await waitFor(() => handle.panel.el.querySelector('[data-ask]'), 5000, 'the question'));
      assert.equal(handle.panel.el.querySelector('.dm-floating-body').firstElementChild, box, 'the question first');
      assert.equal(handle.panel.el.querySelector('[data-ai-run]').getAttribute('data-ai-run'), 'waiting');
      assert.ok(/Jag frågar först/.test(handle.panel.el.querySelector('[data-ai-run-live]').textContent), 'the words written before the question');
      /** @type {HTMLElement} */ (box.querySelector('[data-ask-option="1"] button')).click();
      await sent;
      assert.ok(handle.panel.el.querySelector('[data-ai-run]').hidden, 'no status after the run');
      assert.ok(handle.panel.el.textContent.includes('Då gör jag ingenting.'));
    } finally { handle.panel.close(); }
    return 'ok';
  }, 30000);

  test('ai models: a list per kind with Sonnet first chosen, the server\'s list fetched, and the choice kept with the provider and shown in the panel', async (assert) => {
    await setup();
    assert.deepEqual(providers.MODELS.anthropic, ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
    assert.equal(providers.KINDS.anthropic.model, 'claude-sonnet-5-5', 'the default');
    assert.deepEqual(providers.modelsFor({ kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5' }), providers.MODELS.anthropic);
    const gpt = providers.modelsFor({ kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5' });
    assert.ok(gpt[0] === 'gpt-5' && gpt.length >= 3, gpt.join(', '));
    assert.deepEqual(providers.modelsFor({ kind: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' }), ['llama3.2'], 'Ollama\'s local default');
    // Hämta modellistan: the server's own list, after the consent, in both forms.
    const own = await providers.save({ id: 'ai-models-test', kind: 'anthropic', name: 'Mock models', baseUrl: KEYS + '/ok', model: 'claude-sonnet-5-5' });
    providers.setKey(own.id, 'sk-ant-models-1234');
    assert.deepEqual(await providers.fetchModels(own), ['claude-opus-5-5', 'claude-zeta-test'], 'sorted, from data[].id');
    assert.deepEqual(await providers.fetchModels({ kind: 'openai', baseUrl: KEYS + '/ok-openai', name: 'Mock' }, { key: 'sk-typed-0000' }), ['llama3.2', 'qwen3'], 'an OpenAI-compatible list');
    const noKey = await providers.fetchModels({ kind: 'anthropic', baseUrl: KEYS + '/ok' }).catch((e) => e);
    assert.ok(noKey instanceof Error && noKey.message === t('ai.test.nokey'), 'no key, no call');
    await providers.save(Object.assign({}, own, { models: ['claude-zeta-test'] }));
    assert.ok(providers.modelsFor(await providers.get(own.id)).includes('claude-zeta-test'), 'the fetched list kept with the provider');
    await providers.save(Object.assign({}, await providers.get(own.id), { name: 'Mock models 2' }));
    assert.deepEqual((await providers.get(own.id)).models, ['claude-zeta-test'], 'kept when the form is saved again');
    // The panel shows the model and keeps a choice with the provider.
    const ds = await theModel();
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      panel.state.providerId = own.id;
      panel.setMode('ask');
      const sel = /** @type {any} */ (await waitFor(() => panel.el.querySelector('[data-ai-model]'), 3000, 'the model choice'));
      assert.equal(sel.value, 'claude-sonnet-5-5');
      assert.ok(sel.options.some((o) => o.value === 'claude-haiku-5-5') && sel.options.some((o) => o.value === 'claude-zeta-test') && sel.options.some((o) => o.label === t('ai.model.other')), 'the list and Annan modell');
      sel.value = 'claude-haiku-5-5';
      sel.dispatchEvent(new Event('change'));
      await waitFor(async () => (await providers.get(own.id)).model === 'claude-haiku-5-5', 3000, 'kept with the provider');
      await waitFor(() => panel.el.querySelector('[data-ai-model]') && /** @type {any} */ (panel.el.querySelector('[data-ai-model]')).value === 'claude-haiku-5-5', 3000, 'shown in the panel');
    } finally { panel.destroy(); panel.el.remove(); }
    await providers.remove(own.id);
    return 'ok';
  }, 30000);

  test('ai keys: Pröva nyckeln makes one call after the policy and says OK, wrong key (401), no access (403), wrong address (404) or unreachable, never with the key', async (assert) => {
    await setup();
    const KEY = 'sk-ant-echo-9999';
    const p = (path, kind) => ({ kind: kind || 'anthropic', name: 'Mock key', baseUrl: KEYS + path, model: kind === 'openai' ? 'gpt-test' : 'claude-sonnet-5-5' });
    world.keyHits = 0;
    const ok = await providers.testKey(p('/ok'), { key: KEY });
    assert.ok(ok.ok && ok.code === 'ok' && ok.message === t('ai.test.ok', { host: 'tests' }), ok.message);
    assert.equal(world.keyHits, 1, 'one call');
    const bad = await providers.testKey(p('/bad'), { key: KEY });
    assert.ok(!bad.ok && bad.code === 'key' && bad.status === 401 && bad.message.startsWith(t('ai.test.401', { host: 'tests', status: '401', detail: '' }).trim().slice(0, 20)), bad.message);
    assert.ok(!bad.message.includes(KEY) && bad.message.includes('•••'), 'the key put out of sight when the server repeats it: ' + bad.message);
    const denied = await providers.testKey(p('/denied'), { key: KEY });
    assert.ok(!denied.ok && denied.code === 'access' && denied.message.includes('403'), denied.message);
    const missing = await providers.testKey(p('/missing'), { key: KEY });
    assert.ok(!missing.ok && missing.code === 'address' && missing.message.includes('404'), missing.message);
    // An OpenAI-compatible server without a list of models is tried with one token instead.
    world.bodies = [];
    const nolist = await providers.testKey(p('/nolist', 'openai'), { key: KEY });
    assert.ok(nolist.ok, nolist.message);
    const down = await providers.testKey(p('/down'), { key: KEY });
    assert.ok(!down.ok && down.code === 'network' && down.message === t('ai.test.network', { host: 'tests' }), down.message);
    const nokey = await providers.testKey(p('/ok'), {});
    assert.ok(!nokey.ok && nokey.code === 'nokey');
    // The policy Endast lokal refuses before anything is sent.
    world.keyHits = 0;
    await providers.setPolicy('local');
    try {
      const refused = await providers.testKey(p('/ok'), { key: KEY });
      assert.ok(!refused.ok && refused.code === 'refused' && refused.message === t('ai.err.policy.local', { host: 'tests' }), refused.message);
      assert.equal(world.keyHits, 0, 'nothing sent');
    } finally { await providers.setPolicy('ask'); }
    for (const r of [ok, bad, denied, missing, nolist, down]) assert.ok(!JSON.stringify(r).includes(KEY), 'the key in no answer');
    return 'ok';
  }, 30000);

  test('ai keys: where each key is (session, stored and unlocked, stored and locked, missing), stored encrypted from the form and unlocked again', async (assert) => {
    await setup();
    const aiProviders = D.require('ui/bearbeta/ai-providers');
    await secrets.clearPersisted();
    const p = await providers.save({ id: 'ai-keys-test', kind: 'anthropic', name: 'Mock keys', baseUrl: KEYS + '/ok', model: 'claude-sonnet-5-5' });
    await providers.forgetKey(p.id);
    assert.equal(await providers.keyState(p), 'missing');
    assert.equal(await providers.keyState({ id: 'none', baseUrl: 'http://127.0.0.1:11434/v1' }), 'local', 'a local model needs none');
    providers.setKey(p.id, 'sk-ant-session-1111');
    assert.equal(await providers.keyState(p), 'session');
    await providers.saveKey(p.id, null, 'lösenfras-ai-prov');
    assert.equal(await providers.keyState(p), 'saved', 'the session\'s key stored');
    await providers.unstoreKey(p.id);
    assert.equal(await providers.keyState(p), 'session', 'back to the session only');
    assert.ok(providers.hasKey(p.id));
    // The form: the state, the key typed and stored encrypted with the passphrase, a confirmation that says so.
    await providers.forgetKey(p.id);
    const editing = aiProviders.edit(await providers.get(p.id));
    const dlg = /** @type {HTMLElement} */ (await waitFor(() => { const k = document.querySelector('dialog[open] [data-ai-form-key]'); return k && k.closest('dialog'); }, 3000, 'the form'));
    assert.equal(dlg.querySelector('[data-ai-key-state]').getAttribute('data-ai-key-state'), 'missing');
    const model = /** @type {any} */ (dlg.querySelector('[data-ai-form-model]'));
    assert.equal(model.value, 'claude-sonnet-5-5');
    assert.ok(providers.MODELS.anthropic.every((m) => model.options.some((o) => o.value === m)), 'the four models to choose from');
    /** @type {any} */ (dlg.querySelector('[data-ai-form-key]')).value = 'sk-ant-dialog-5678';
    const keep = /** @type {any} */ (dlg.querySelector('[data-ai-form-keep]'));
    keep.value = 'saved'; keep.dispatchEvent(new Event('change'));
    /** @type {HTMLElement} */ (dlg.querySelector('[data-ai-test-key] button')).click();
    await waitFor(() => dlg.querySelector('[data-ai-form-status="ok"]'), 5000, 'the key tried');
    /** @type {HTMLElement} */ (dlg.querySelector('[data-ai-fetch-models] button')).click();
    await waitFor(() => model.options.some((o) => o.value === 'claude-zeta-test'), 5000, 'the list fetched into the form');
    /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="primary"] button')).click();
    const pass = /** @type {any} */ (await waitFor(() => document.querySelector('dialog[open] [data-ai-passphrase]'), 3000, 'the passphrase'));
    pass.value = 'lösenfras-ai-prov';
    /** @type {HTMLElement} */ (pass.closest('dialog').querySelector('.dm-dialog-actions dm-button[variant="primary"] button')).click();
    const saved = await editing;
    assert.equal(saved.id, p.id, 'the same provider');
    assert.equal(await providers.keyState(saved), 'saved');
    assert.ok(Array.from(document.querySelectorAll('.dm-toast')).some((el) => el.textContent.includes(t('ai.key.done.saved', { name: saved.name }))), 'the confirmation says where the key is');
    assert.ok((await providers.get(p.id)).models.includes('claude-zeta-test'), 'the fetched list saved with the provider');
    const settings = JSON.stringify(await idb.listSettings(''));
    assert.ok(!settings.includes('sk-ant-dialog-5678'), 'the key is in no setting in clear text');
    // The next session: locked until the passphrase unlocks it, and the panel says so.
    const ds = await theModel();
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      panel.state.providerId = p.id;
      secrets.lock();
      assert.equal(await providers.keyState(p), 'locked');
      const notice = await waitFor(() => panel.el.querySelector('[data-ai-key-notice="locked"]'), 3000, 'the locked notice');
      assert.ok(notice.querySelector('[data-ai-unlock]'), 'with Lås upp');
      assert.equal(await providers.unlockKeys('lösenfras-ai-prov'), 1);
      assert.equal(await providers.keyState(p), 'saved');
      await waitFor(() => !panel.el.querySelector('[data-ai-key-notice]'), 3000, 'the notice gone');
      assert.equal(secrets.get(p.id).apiKey, 'sk-ant-dialog-5678', 'the same key back');
    } finally { panel.destroy(); panel.el.remove(); }
    await providers.remove(p.id);
    await secrets.clearPersisted();
    for (const el of Array.from(document.querySelectorAll('.dm-toast'))) el.remove();
    return 'ok';
  }, 40000);

  test('ai stream: the status line names each tool in words, its time as m:ss', async (assert) => {
    const run = D.require('ui/bearbeta/ai-run');
    assert.equal(run.describeTool('create_wall', { storey: 'Plan 1' }), t('ai.tool.create_wall') + ' · Plan 1');
    assert.equal(run.describeTool('no_such_command', {}), t('ai.tool.other', { name: 'no_such_command' }));
    assert.equal(run.clock(0), '0:00'); assert.equal(run.clock(83000), '1:23'); assert.equal(run.clock(3723000), '1:02:03');
    const r = run.create();
    r.start();
    r.event({ type: 'delta', delta: { type: 'text', text: '<b>fet</b>' } });
    assert.equal(r.el.querySelector('[data-ai-run-live]').querySelector('b'), null, 'the AI\'s text as text only');
    r.stop();
    assert.ok(r.el.hidden);
    return 'ok';
  });

  test('ai stream: cleanup', async () => {
    if (realRequest) { http.request = realRequest; realRequest = null; }
    for (const p of [anthropic, openai, live]) if (p) await providers.remove(p.id);
    anthropic = null; openai = null; live = null;
    if (model) await datasets.remove(model.id);
    model = null;
    D.net.unvirtual('tests/ai-sse/'); D.net.unvirtual('tests/ai-keys/');
    return 'ok';
  });
})();
