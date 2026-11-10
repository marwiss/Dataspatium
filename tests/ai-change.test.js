// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Ändra med AI (step 2 of the AI modelling): the write tools check every call and fill a change set with refs, the agent in
 * change mode fills it through a mocked provider, the panel previews the candidate in 3D and approves it as the recipe step
 * ifc_changeset with the wheel stubbed (Pyodide never runs in the suite), undo restores the file exactly, a change set with schema
 * errors cannot be approved, and a publish on a stale base is refused with 412 version_conflict by a mocked Dataregium.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const model = D.require('data/model');
  const recipes = D.require('data/recipes');
  const providers = D.require('ai/providers');
  const agent = D.require('ai/agent');
  const writeTools = D.require('ai/write-tools');
  const { bridge } = D.require('data/python-bridge');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const CHANGE = 'dataspatium-asset://tests/ai-change';
  const world = { calls: 0 };
  let ds = null; let provider = null;
  /** The mocked Anthropic in change mode: a storey, a grid and a wall; then properties on the wall by its ref and a delete nobody asked for; then the answer. */
  D.net.virtual('tests/ai-change/', (url) => {
    if (!url.endsWith('/v1/messages')) return Promise.resolve(json({ error: { message: 'no such path' } }, 404));
    world.calls++;
    const n = world.calls % 3;
    if (n === 1) return Promise.resolve(json({ id: 'm1', content: [{ type: 'tool_use', id: 'tu1', name: 'create_storeys_and_grid', input: { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: { x_spacing: 6, x_count: 1, y_spacing: 4, y_count: 1 } } }, { type: 'tool_use', id: 'tu2', name: 'create_wall', input: { storey: 'Plan 3', start: [0, 0], end: [6, 0], thickness: 0.2, height: 3, name: 'Vägg S' } }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 50 } }));
    if (n === 2) return Promise.resolve(json({ id: 'm2', content: [{ type: 'tool_use', id: 'tu3', name: 'set_properties', input: { ids: ['new-1'], pset: 'Pset_WallCommon', properties: [{ name: 'IsExternal', value: true }] } }, { type: 'tool_use', id: 'tu4', name: 'delete_elements', input: { ids: ['new-1'], confirm: false } }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 50 } }));
    return Promise.resolve(json({ id: 'm3', content: [{ type: 'text', text: 'Ändringssetet har en våning med rutnät, en vägg och dess egenskaper.' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } }));
  });

  test('ai change: the write tools check each call, fill the change set with refs and refuse what the person has not asked for', async (assert) => {
    const cs = writeTools.create('x');
    const storeys = writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 1', elevation: 0 }, { name: 'Plan 2', elevation: 3 }], grid: { x_spacing: 6, x_count: 1, y_spacing: 4, y_count: 1 } });
    assert.ok(storeys.ok && storeys.step === 1 && !storeys.ref, 'storeys and a grid, no ref');
    const wall = writeTools.call(cs, 'create_wall', { storey: 'Plan 1', start: [0, 0], end: [6, 0], thickness: null, height: null, name: 'Vägg S' });
    assert.equal(wall.ref, 'new-1'); assert.equal(cs.ops[1].thickness, 0.2); assert.equal(cs.ops[1].height, 3, 'defaults filled in');
    const slab = writeTools.call(cs, 'create_slab', { storey: 'Plan 1', outline: null, thickness: null, name: null });
    assert.equal(slab.ref, 'new-2');
    const door = writeTools.call(cs, 'create_opening', { wall_id: 'new-1', offset: 1, width: null, height: null, sill: null, fill: 'door', name: 'Dörr' });
    assert.equal(door.ref, 'new-3'); assert.equal(cs.ops[3].fill, 'door');
    assert.ok(writeTools.call(cs, 'create_opening', { wall_id: 'new-9', offset: 1, width: null, height: null, sill: null, fill: null, name: null }).error, 'a ref that does not exist');
    assert.ok(writeTools.call(cs, 'create_wall', { storey: null, start: [0, 0], end: [0, 0], thickness: 0.2, height: 3, name: null }).error, 'a wall without length');
    assert.ok(writeTools.call(cs, 'create_wall', { storey: null, start: [0, 0], end: [1, 0], thickness: -1, height: 3, name: null }).error, 'a negative thickness');
    const props = writeTools.call(cs, 'set_properties', { ids: ['new-1', 12], pset: 'Pset_WallCommon', properties: [{ name: 'IsExternal', value: true }, { name: 'FireRating', value: 'EI60' }] });
    assert.ok(props.ok); assert.deepEqual(cs.ops[4].properties, { IsExternal: true, FireRating: 'EI60' }); assert.deepEqual(cs.ops[4].ids, ['new-1', 12]);
    assert.ok(writeTools.call(cs, 'set_properties', { ids: [], pset: 'x', properties: [{ name: 'a', value: 1 }] }).error, 'ids required');
    assert.ok(writeTools.call(cs, 'assign', { ids: [12], storey: null, material: null }).error, 'assign needs a storey or a material');
    assert.ok(writeTools.call(cs, 'transform_elements', { ids: [12], dx: 0, dy: null, dz: 0 }).error, 'a move of nothing');
    const refused = writeTools.call(cs, 'delete_elements', { ids: [12], confirm: null });
    assert.ok(refused.error && refused.error.includes('confirm'), 'deleting without confirm is refused: ' + refused.error);
    assert.ok(writeTools.call(cs, 'delete_elements', { ids: [12], confirm: true }).ok);
    assert.equal(cs.ops.length, 6); assert.deepEqual(writeTools.summary(cs), { steps: 6, creates: 4, deletes: 1 });
    const list = writeTools.call(cs, 'manage_changeset', { action: 'list' });
    assert.equal(list.steps.length, 6); assert.equal(list.steps[1].ref, 'new-1'); assert.ok(list.steps[1].description.includes('Vägg S'), list.steps[1].description);
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'remove_last' }).ok); assert.equal(cs.ops.length, 5);
    assert.ok(writeTools.toWheel(cs).every((op) => !('ref' in op)), 'the wheel counts refs itself');
    assert.ok(writeTools.call(cs, 'manage_changeset', { action: 'clear' }).ok); assert.equal(cs.ops.length, 0); assert.equal(cs.refs, 0);
    assert.ok(writeTools.call(cs, 'publish_version', {}).error, 'publishing is not a tool');
    for (const tool of writeTools.TOOLS) assert.ok(tool.description && tool.parameters && tool.parameters.type === 'object', tool.name);
    return 'ok';
  });

  test('ai change: in change mode the agent fills the change set through the write tools, and a delete nobody asked for stays out', async (assert) => {
    ds = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'AI-ändring');
    provider = await providers.save({ id: 'ai-change-anthropic', kind: 'anthropic', name: 'Mock Claude', baseUrl: CHANGE, model: 'claude-test' });
    providers.setKey(provider.id, 'sk-test-change');
    await providers.setPolicy('ask');
    world.calls = 0;
    const cs = writeTools.create(ds.id);
    const out = await agent.ask({ provider, datasetId: ds.id, question: 'Lägg till plan 3 med en vägg', changeset: cs });
    assert.equal(out.stopped, 'answered'); assert.equal(out.changes, 3); assert.equal(cs.ops.length, 3);
    assert.deepEqual(cs.ops.map((op) => op.tool), ['create_storeys_and_grid', 'create_wall', 'set_properties']);
    assert.equal(cs.ops[1].ref, 'new-1'); assert.deepEqual(cs.ops[2].ids, ['new-1']);
    const refused = out.steps.find((s) => s.name === 'delete_elements');
    assert.ok(refused && refused.error && refused.error.includes('confirm'), 'the delete was refused and the model told why');
    assert.ok(out.answer.includes('Ändringssetet'), out.answer);
    // The read loop is untouched: without a change set the write tools are not even offered.
    const plain = await agent.ask({ provider, datasetId: ds.id, question: 'hej', budget: { turns: 1 } });
    assert.ok(plain.steps.every((s) => s.error), 'write tools called without a change set are unknown tools: ' + JSON.stringify(plain.steps.map((s) => s.error)));
    return 'ok';
  }, 20000);

  test('ai change: the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval', async (assert) => {
    const engine = (await datasets.ensureOpen(ds.id)).engine;
    const wallId = Number((await engine.exec("select id from data where namn = 'Vägg 1.1'"))[0].values[0][0]);
    const changed = new TextEncoder().encode(fixtures.ifcText({ walls: 2 }).replace("'Vägg 1.1'", "'Vägg AI'"));
    const real = bridge.runIfcChangeset;
    const calls = [];
    bridge.runIfcChangeset = async (changes) => { calls.push(changes); return { bytes: changed, info: { elements: 6, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [], changed: [{ id: wallId, ifc_class: 'IfcWall', name: 'Vägg AI' }], deleted: [], findings: [], errors: 0 }, log: [] }; };
    const previews = [];
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log: () => {} } }, { datasetId: ds.id, preview: (p) => { previews.push(p); } });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers loaded');
      panel.state.providerId = provider.id;
      panel.setMode('change');
      assert.ok(panel.el.querySelector('[data-ai-changeset]'), 'the change set shown in change mode');
      world.calls = 0;
      await panel.ask('Lägg till plan 3 med en vägg');
      assert.equal(panel.state.changeset.ops.length, 3); assert.equal(panel.el.querySelectorAll('[data-ai-changes] li').length, 3, 'the steps listed');
      assert.ok(/** @type {any} */ (panel.el.querySelector('[data-ai-approve]')).disabled, 'no approval before a preview');
      await panel.preview();
      assert.equal(calls.length, 1); assert.equal(calls[0][1].tool, 'create_wall'); assert.ok(!('ref' in calls[0][1]), 'the wheel gets the operations without the panel\'s refs');
      assert.ok(previews[0] && previews[0].bytes === changed && previews[0].colors.length === 1 && previews[0].colors[0].ids[0] === wallId, 'the candidate drawn with the changed wall coloured');
      assert.ok(panel.el.querySelector('[data-ai-report]'), 'the report shown'); assert.equal(panel.el.querySelector('[data-ai-findings]').getAttribute('data-ai-findings'), '0');
      assert.ok(!(/** @type {any} */ (panel.el.querySelector('[data-ai-approve]')).disabled), 'approval possible');
      const before = new TextDecoder().decode((await model.original(ds.id)).bytes);
      await panel.approve();
      assert.equal(panel.state.error, '', 'approved without error');
      assert.ok(new TextDecoder().decode((await model.original(ds.id)).bytes).includes("'Vägg AI'"), 'the approved change set is the model');
      assert.equal((await model.rowsOf(ds.id, "select namn from data where namn = 'Vägg AI'")).length, 1, 'the tables rebuilt');
      assert.equal(panel.state.changeset.ops.length, 0, 'the change set is spent');
      const last = previews[previews.length - 1];
      assert.ok(last && !last.bytes && last.colors.length === 1, 'after approval only the colours remain on the model');
      const steps = await recipes.steps(ds.id);
      const step = steps.find((st) => st.op === 'ifc_changeset');
      assert.ok(step, 'a recipe step');
      assert.equal(JSON.parse(step.params.changes).length, 3); assert.equal(JSON.parse(step.params.provenance).model, provider.model, 'the provenance names the model');
      assert.ok(recipes.canUndo(ds.id));
      await recipes.undo(ds.id);
      assert.equal(new TextDecoder().decode((await model.original(ds.id)).bytes), before, 'undo restores the file exactly');
      // Schema errors block approval.
      bridge.runIfcChangeset = async (changes) => ({ bytes: changed, info: { elements: 6, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [], changed: [], deleted: [], findings: [{ level: 'error', ifc_class: 'IfcWall', id: wallId, attribute: 'Name', message: 'Attribute not optional' }], errors: 1 }, log: [] });
      world.calls = 0;
      await panel.ask('igen');
      assert.equal(panel.state.changeset.ops.length, 3);
      await panel.preview();
      assert.equal(panel.el.querySelector('[data-ai-findings]').getAttribute('data-ai-findings'), '1');
      assert.ok(/** @type {any} */ (panel.el.querySelector('[data-ai-approve]')).disabled, 'no approval with schema errors');
      const stepsBefore = (await recipes.steps(ds.id)).length;
      await panel.approve();
      assert.equal((await recipes.steps(ds.id)).length, stepsBefore, 'approve did nothing');
      await panel.reject();
      assert.equal(panel.state.changeset.ops.length, 0); assert.equal(previews[previews.length - 1], null, 'the preview ended');
    } finally { bridge.runIfcChangeset = real; panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('ai change: a publish on a stale base version is refused with 412 version_conflict, told in the user\'s words', async (assert) => {
    const CDE = 'dataspatium-asset://tests/ai-change-cde';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const hits = [];
    D.net.virtual('tests/ai-change-cde/', (url) => {
      const rest = url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname;
      const path = rest.split('?')[0];
      hits.push(path);
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: CDE + '/ui', expires_in: 600, max_size_in_bytes: 0 }));
      if (path === '/documents/1.0/upload-instructions') return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: CDE + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 9 }], upload_completion: { url: CDE + '/complete' } }] }));
      if (path === '/part') return Promise.resolve({ kind: 'text', data: '' });
      if (path === '/complete') return Promise.resolve(json({ code: 'version_conflict', message: 'The upload builds on version 1, but the document\'s latest version is 2' }, 412));
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const { connector } = await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' });
    try {
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      const file = new File(['0123456789'], 'hus.ifc', { type: 'application/octet-stream' });
      const err = await opencde.uploadDocument(connector, file, { documentId: 'doc-1', baseVersionIndex: 1, redirectUri: REDIRECT, popup: () => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(CDE + '/documents/1.0/upload-instructions')}`) }).catch((e) => e);
      assert.ok(err instanceof Error, 'the upload failed');
      assert.equal(err.code, 'version_conflict'); assert.equal(err.status, 412);
      assert.ok(err.message.includes(t('opencde.err.code.version_conflict', { detail: '' }).trim()), 'told in the user\'s words: ' + err.message);
      assert.ok(hits.includes('/complete') && hits.includes('/part'), 'the parts went up and the completion was refused');
    } finally { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    return 'ok';
  }, 20000);

  test('ai change: cleanup', async () => {
    if (provider) await providers.remove(provider.id);
    if (ds) await datasets.remove(ds.id);
    return 'ok';
  });
})();
