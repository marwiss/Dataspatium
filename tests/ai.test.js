// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Fråga AI om modellen against mocked providers (virtual dataspatium-asset:// servers that play Anthropic Messages and an
 * OpenAI-compatible Chat Completions, no network): the read tools on the test building, the two adapters' request and answer shapes,
 * the agent loop with tool calls and the elements it collects, the policy and the key, cancelling, and the panel in the model view.
 * The mocked servers answer by call count, since a virtual provider only sees the address, not the body.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const selection = D.require('data/selection');
  const providers = D.require('ai/providers');
  const tools = D.require('ai/model-tools');
  const agent = D.require('ai/agent');
  const secrets = D.require('api/secrets');
  const ANTHROPIC = 'dataspatium-asset://tests/ai-anthropic';
  const OPENAI = 'dataspatium-asset://tests/ai-openai';
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const world = { anthropic: 0, openai: 0, slow: false };
  let model = null; let doorId = null; let a = null; let o = null;
  /** The mocked Anthropic: first a tool call for the doors without a fire rating, then the answer in words. */
  D.net.virtual('tests/ai-anthropic/', async (url) => {
    if (!url.endsWith('/v1/messages')) return json({ error: { message: 'no such path' } }, 404);
    if (world.slow) await wait(1500);
    world.anthropic++;
    if (world.anthropic % 2 === 1) return json({ id: 'msg1', content: [{ type: 'text', text: 'Jag letar efter dörrarna.' }, { type: 'tool_use', id: 'tu1', name: 'query_elements', input: { ifc_class: 'IfcDoor', storey: null, name_contains: null, property_set: null, property_name: 'FireRating', property_value: null, missing_property: true, limit: null } }], stop_reason: 'tool_use', usage: { input_tokens: 300, output_tokens: 40 } });
    return json({ id: 'msg2', content: [{ type: 'text', text: 'En dörr saknar brandklass: Dörr 1 (id ' + doorId + ') på Plan 1.' }], stop_reason: 'end_turn', usage: { input_tokens: 500, output_tokens: 30 } });
  });
  /** The mocked OpenAI-compatible server: a tool call for the overview and the marked elements, then the answer. */
  D.net.virtual('tests/ai-openai/', (url) => {
    if (!url.endsWith('/chat/completions')) return Promise.resolve(json({ error: { message: 'no such path' } }, 404));
    world.openai++;
    if (world.openai % 2 === 1) return Promise.resolve(json({ id: 'c1', choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'get_view_context', arguments: '{}' } }, { id: 'call2', type: 'function', function: { name: 'get_element', arguments: JSON.stringify({ id: doorId, guid: null }) } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 200, completion_tokens: 20 } }));
    return Promise.resolve(json({ id: 'c2', choices: [{ message: { role: 'assistant', content: 'Det markerade är en dörr utan egenskaper.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 400, completion_tokens: 15 } }));
  });

  test('ai: the read tools answer from the test building: overview, storeys, elements by class, storey and property, one element, the marked', async (assert) => {
    model = await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'AI-huset');
    const overview = await tools.call(model.id, 'get_model_overview', {});
    assert.equal(overview.elements, 8, '3 + 3 walls, a slab and a door');
    assert.ok(overview.classes.some((c) => c.ifc_class === 'IfcWall' && c.n === 6), 'walls counted');
    assert.ok(overview.property_sets.some((p) => p.property_set === 'Pset_WallCommon'), 'the property set listed');
    const storeys = await tools.call(model.id, 'list_storeys', {});
    assert.deepEqual(storeys.storeys.map((s) => s.storey), ['Plan 1', 'Plan 2']); assert.equal(storeys.storeys[1].elements, 3);
    const walls2 = await tools.call(model.id, 'query_elements', { ifc_class: 'ifcwall', storey: 'Plan 2', name_contains: null, property_set: null, property_name: null, property_value: null, missing_property: null, limit: null });
    assert.equal(walls2.count, 3); assert.equal(walls2.truncated, false); assert.ok(walls2.elements.every((e) => e.ifc_class === 'IfcWall' && e.storey === 'Plan 2'));
    const rated = await tools.call(model.id, 'query_elements', { ifc_class: null, storey: null, name_contains: null, property_set: 'Pset_WallCommon', property_name: 'FireRating', property_value: 'ei', missing_property: null, limit: 2 });
    assert.equal(rated.count, 6, 'six walls carry EI60'); assert.equal(rated.truncated, true, 'cut at the limit'); assert.equal(rated.elements.length, 2); assert.equal(rated.elements[0].property_value, 'EI60');
    const doors = await tools.call(model.id, 'query_elements', { ifc_class: 'IfcDoor', storey: null, name_contains: null, property_set: null, property_name: 'FireRating', property_value: null, missing_property: true, limit: null });
    assert.equal(doors.count, 1, 'the door lacks a fire rating'); assert.equal(doors.elements[0].name, 'Dörr 1');
    doorId = doors.elements[0].id;
    const door = await tools.call(model.id, 'get_element', { id: null, guid: doors.elements[0].guid });
    assert.equal(door.id, doorId); assert.equal(door.ifc_class, 'IfcDoor'); assert.equal(door.storey, 'Plan 1');
    const wall = await tools.call(model.id, 'get_element', { id: walls2.elements[0].id, guid: null });
    assert.ok(wall.properties.Pset_WallCommon && wall.properties.Pset_WallCommon.some((p) => p.name === 'FireRating' && p.value === 'EI60'), 'properties grouped by set');
    assert.ok(wall.quantities.some((qty) => qty.name === 'Length'), 'quantities');
    assert.deepEqual(await tools.call(model.id, 'get_view_context', {}), { marked: 0, elements: [] }, 'nothing marked');
    await selection.setFromWhere(model.id, `id = ${doorId}`, [], 'provet');
    const ctx = await tools.call(model.id, 'get_view_context', {});
    assert.equal(ctx.marked, 1); assert.equal(ctx.elements[0].id, doorId); assert.equal(ctx.label, 'provet');
    assert.ok((await tools.call(model.id, 'no_such_tool', {})).error, 'an unknown tool is an error object, not an exception');
    assert.deepEqual(tools.idsOf(doors), [doorId]); assert.deepEqual(tools.idsOf(door), [doorId]);
    return 'ok';
  }, 30000);

  test('ai: providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host', async (assert) => {
    a = await providers.save({ id: 'ai-test-anthropic', kind: 'anthropic', name: 'Mock Claude', baseUrl: ANTHROPIC + '/', model: 'claude-test' });
    o = await providers.save({ id: 'ai-test-openai', kind: 'openai', name: 'Mock GPT', baseUrl: OPENAI, model: 'gpt-test' });
    assert.equal(a.baseUrl, ANTHROPIC, 'the address is trimmed');
    assert.ok((await providers.list()).some((p) => p.id === a.id) && (await providers.list()).some((p) => p.id === o.id));
    assert.ok(!providers.hasKey(a.id));
    const err = await providers.chat(a, { messages: [{ role: 'user', content: 'hej' }] }).catch((e) => e);
    assert.ok(err instanceof Error && err.message === t('ai.err.nokey', { name: a.name }), 'no key, no call: ' + err.message);
    providers.setKey(a.id, 'sk-test-anthropic'); providers.setKey(o.id, 'sk-test-openai');
    assert.ok(providers.hasKey(a.id) && secrets.get(a.id).apiKey === 'sk-test-anthropic');
    assert.ok(!JSON.stringify(await providers.list()).includes('sk-test'), 'the key is not in the setting');
    assert.ok(providers.isLocal('http://127.0.0.1:11434/v1') && providers.isLocal('http://localhost:8080') && !providers.isLocal('https://api.anthropic.com'));
    await providers.setPolicy('local');
    const refused = await providers.chat(a, { messages: [{ role: 'user', content: 'hej' }] }).catch((e) => e);
    assert.ok(refused instanceof Error && refused.message === t('ai.err.policy.local', { host: 'tests' }), 'refused by the policy: ' + refused.message);
    await providers.setPolicy('ask');
    const bad = await providers.save({ kind: 'openai', name: 'x', baseUrl: 'ftp://x', model: 'm' }).catch((e) => e);
    assert.ok(bad instanceof Error && bad.message === t('ai.err.address'));
    return 'ok';
  }, 20000);

  test('ai: the agent asks, runs the tool the model called, hands the result back as data and collects the elements (Anthropic shape)', async (assert) => {
    world.anthropic = 0;
    const events = [];
    const out = await agent.ask({ provider: a, datasetId: model.id, question: 'Vilka dörrar saknar brandklass?', onEvent: (ev) => events.push(ev) });
    assert.equal(world.anthropic, 2, 'two exchanges');
    assert.ok(out.answer.includes('Dörr 1'), out.answer);
    assert.equal(out.steps.length, 1); assert.equal(out.steps[0].name, 'query_elements'); assert.equal(out.steps[0].count, 1);
    assert.deepEqual(out.elements, [doorId], 'the door collected for marking');
    assert.deepEqual(out.usage, { input: 800, output: 70 }); assert.equal(out.stopped, 'answered');
    const toolMsg = out.messages.find((m) => m.role === 'tool');
    assert.ok(toolMsg && toolMsg.results[0].id === 'tu1' && toolMsg.results[0].content.startsWith('[data from the model]'), 'the result goes back marked as data');
    assert.ok(events.some((e) => e.type === 'tool') && events.some((e) => e.type === 'thinking'));
    return 'ok';
  }, 20000);

  test('ai: the OpenAI-compatible shape: tool calls with JSON arguments, tool messages back, and the answer', async (assert) => {
    world.openai = 0;
    await selection.setFromWhere(model.id, `id = ${doorId}`, [], 'provet');
    const out = await agent.ask({ provider: o, datasetId: model.id, question: 'Vad är markerat?' });
    assert.equal(world.openai, 2);
    assert.equal(out.steps.length, 2); assert.deepEqual(out.steps.map((s) => s.name), ['get_view_context', 'get_element']);
    assert.ok(out.answer.includes('dörr'), out.answer); assert.deepEqual(out.elements, [doorId]);
    assert.deepEqual(out.usage, { input: 600, output: 35 });
    return 'ok';
  }, 20000);

  test('ai: a question can be cancelled, and the budget of turns ends a loop that never answers', async (assert) => {
    world.slow = true; world.anthropic = 0;
    const controller = new AbortController();
    const p = agent.ask({ provider: a, datasetId: model.id, question: 'hej', signal: controller.signal });
    await wait(200); controller.abort();
    const out = await p;
    assert.equal(out.stopped, 'cancelled'); assert.equal(out.answer, t('ai.answer.cancelled'));
    world.slow = false; world.anthropic = 0;
    // A budget of one turn: the model calls a tool and never gets to answer.
    const short = await agent.ask({ provider: a, datasetId: model.id, question: 'hej', budget: { turns: 1 } });
    assert.equal(short.stopped, 'budget'); assert.equal(short.answer, t('ai.answer.budget')); assert.equal(short.steps.length, 1);
    return 'ok';
  }, 20000);

  test('ai: the panel in the model view asks, shows the steps and the answer, and marks the elements', async (assert) => {
    world.anthropic = 0;
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log: () => {} } }, { datasetId: model.id });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers loaded');
      panel.state.providerId = a.id;
      await panel.ask('Vilka dörrar saknar brandklass?');
      assert.ok(panel.el.querySelector('[data-ai-answer]') && panel.el.querySelector('[data-ai-answer]').textContent.includes('Dörr 1'), 'the answer shown');
      assert.equal(panel.el.querySelectorAll('[data-ai-steps] li').length, 1, 'the step listed');
      assert.ok(panel.el.querySelector('[data-ai-usage]'), 'the usage shown');
      selection.clear();
      /** @type {HTMLElement} */ (panel.el.querySelector('[data-ai-mark]')).click();
      await waitFor(() => selection.get(), 3000, 'the selection');
      assert.deepEqual(selection.get().rowids.length, 1, 'the door marked'); assert.equal(selection.get().label, t('ai.selection.label'));
      assert.equal(panel.state.history.length, 2, 'the exchange kept for the next question');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 20000);

  test('ai: the tool server_query asks Dataregium\'s named queries for a model fetched from a server the user is signed in to', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const families = D.require('api/families/databases');
    const connectors = D.require('api/connectors');
    const CDE = 'dataspatium-asset://tests/ai-cde';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const hits = [];
    D.net.virtual('tests/ai-cde/', (url) => {
      const rest = url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname;
      const path = rest.split('?')[0]; const query = rest.includes('?') ? rest.split('?')[1] : '';
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/documents/1.0/documents/doc-1/versions/2/ifc-queries') return Promise.resolve(json({ model_state: 'done', queries: [{ name: 'property', parameters: ['pset', 'property', 'class'] }] }));
      if (path === '/documents/1.0/documents/doc-1/versions/2/ifc-queries/property') { hits.push(query); return Promise.resolve(json({ name: 'property', columns: ['global_id', 'class', 'name', 'value', 'type'], rows: [['1Xezbq735AdBO_4DerG66G', 'IfcWall', 'Vägg 1.1', 'EI60', 'IFCLABEL']], truncated: false })); }
      if (path === '/documents/1.0/documents/doc-1/versions/2/ifc-queries/entity') { hits.push(query); return Promise.resolve(json({ name: 'entity', columns: ['global_id', 'class', 'step_id', 'attributes', 'references', 'referenced_by'], rows: [['1Xezbq735AdBO_4DerG66G', 'IfcWall', 99, { Name: 'Vägg 1.1' }, { ObjectPlacement: [120] }, { RelatedElements: [71] }]], truncated: false })); }
      if (path === '/documents/1.0/documents/doc-1/versions/2/ifc-queries/changed-since') { hits.push(query); return Promise.resolve(json({ name: 'changed-since', columns: ['version_index', 'change_set_id', 'author', 'approved_by', 'whole_file', 'guid', 'step_id', 'path', 'attribute', 'op'], rows: [[3, 't-1', 'anna', 'bo', false, '1Xezbq735AdBO_4DerG66G', 170, null, 'NominalValue', 'set']], truncated: false })); }
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const before = await tools.call(model.id, 'server_query', { name: 'property', class: null, pset: 'Pset_WallCommon', property: 'FireRating' });
    assert.ok(before.error && before.error.includes('not fetched'), 'a local model has no server: ' + before.error);
    const { connector } = await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' });
    const meta = await datasets.get(model.id);
    await datasets.updateMeta(model.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', documentId: 'doc-1', versionIndex: 2 } }) });
    try {
      const out = await tools.call(model.id, 'server_query', { name: 'property', class: null, pset: 'Pset_WallCommon', property: 'FireRating' });
      assert.ok(out.error && out.error.includes('sign in'), 'signed out: ' + out.error);
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      const answer = await tools.call(model.id, 'server_query', { name: 'property', class: null, pset: 'Pset_WallCommon', property: 'FireRating' });
      assert.deepEqual(answer.columns, ['global_id', 'class', 'name', 'value', 'type']); assert.equal(answer.count, 1); assert.equal(answer.rows[0][3], 'EI60'); assert.equal(answer.truncated, false);
      assert.equal(hits[0], 'pset=Pset_WallCommon&property=FireRating', 'the parameters as the server wants them');
      const entity = await tools.call(model.id, 'server_query', { name: 'entity', class: null, pset: null, property: null, global_id: '1Xezbq735AdBO_4DerG66G', since: null });
      assert.ok(entity.rows.length === 1 && entity.rows[0][2] === 99 && hits[1] === 'global_id=1Xezbq735AdBO_4DerG66G', 'one rooted entity by GlobalId: ' + hits[1]);
      const since = await tools.call(model.id, 'server_query', { name: 'changed-since', class: null, pset: null, property: null, global_id: null, since: '2' });
      assert.ok(since.rows.length === 1 && since.columns.includes('whole_file') && hits[2] === 'since=2', 'what the versions after 2 changed: ' + hits[2]);
      const list = await tools.call(model.id, 'server_query', { name: null, class: null, pset: null, property: null });
      assert.equal(list.model_state, 'done'); assert.equal(list.queries[0].name, 'property');
      assert.ok(tools.TOOLS.some((tool) => tool.name === 'server_query'), 'offered to the model');
    } finally {
      await datasets.updateMeta(model.id, { source: meta.source || { kind: 'file' } });
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id);
    }
    return 'ok';
  }, 20000);

  test('ai: cleanup', async () => {
    selection.clear();
    for (const p of [a, o]) if (p) await providers.remove(p.id);
    await providers.setPolicy('ask');
    if (model) await datasets.remove(model.id);
    return 'ok';
  });
})();
