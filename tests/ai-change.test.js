// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Ändra med AI (step 2 of the AI modelling): the write tools check every call and fill a change set with refs, the agent in
 * change mode fills it through a mocked provider, the panel previews the candidate in 3D and approves it as the recipe step
 * ifc_changeset with the wheel stubbed (Pyodide never runs in the suite), undo restores the file exactly, a change set with schema
 * errors cannot be approved, a publish on a stale base is refused with 412 version_conflict by a mocked Dataregium, the preview asks
 * the server's precheck, and a change set goes to the server as a change proposal (a BCF topic with the snippet in its form).
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

  test('ai change: the agent previews its own change set and mends what the wheel finds, but never starts Python itself', async (assert) => {
    const PRE = 'dataspatium-asset://tests/ai-preview';
    let calls = 0; const seen = [];
    D.net.virtual('tests/ai-preview/', (url, init) => {
      calls++;
      const r = (content, stop) => Promise.resolve(json({ id: 'p' + calls, content, stop_reason: stop || 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } }));
      if (calls === 1) return r([{ type: 'tool_use', id: 'a1', name: 'create_wall', input: { storey: 'Plan 9', start: [0, 0], end: [4, 0], thickness: 0.2, height: 3, name: 'Vägg X' } }]);
      if (calls === 2) return r([{ type: 'tool_use', id: 'a2', name: 'preview_changeset', input: {} }]);
      if (calls === 3) return r([{ type: 'tool_use', id: 'a3', name: 'manage_changeset', input: { action: 'remove_last' } }, { type: 'tool_use', id: 'a4', name: 'create_wall', input: { storey: 'Plan 1', start: [0, 0], end: [4, 0], thickness: 0.2, height: 3, name: 'Vägg X' } }]);
      if (calls === 4) return r([{ type: 'tool_use', id: 'a5', name: 'preview_changeset', input: {} }]);
      return r([{ type: 'text', text: 'Ändringssetet har en vägg på Plan 1.' }], 'end_turn');
    });
    const pre = await providers.save({ id: 'ai-preview-anthropic', kind: 'anthropic', name: 'Mock preview', baseUrl: PRE, model: 'claude-test' });
    providers.setKey(pre.id, 'sk-test-preview');
    const real = bridge.runIfcChangeset; const state = bridge.state;
    bridge.runIfcChangeset = async (changes) => {
      seen.push(changes.map((op) => op.storey));
      if (changes.some((op) => op.storey === 'Plan 9')) throw new Error("step 1 (create_wall): no storey named 'Plan 9'; the storeys are Plan 1, Plan 2");
      return { bytes: new Uint8Array(4), info: { created: [{ id: 900, ifc_class: 'IfcWall' }], changed: [], deleted: [], findings: [], errors: 0 }, log: [] };
    };
    try {
      bridge.state = 'ready';
      const cs = writeTools.create(ds.id);
      const out = await agent.ask({ provider: pre, datasetId: ds.id, question: 'En vägg på plan 9', changeset: cs });
      assert.equal(out.stopped, 'answered');
      const previews = out.steps.filter((s) => s.name === 'preview_changeset');
      assert.equal(previews.length, 2, 'previewed twice');
      assert.ok(previews[0].error && previews[0].error.includes('Plan 9'), 'the first preview told the agent what was wrong: ' + previews[0].error);
      assert.ok(!previews[1].error, 'the second preview was clean');
      assert.deepEqual(cs.ops.map((op) => op.storey), ['Plan 1'], 'the agent mended its change set');
      assert.deepEqual(seen, [['Plan 9'], ['Plan 1']], 'the wheel ran on each version of the set');
      const fed = JSON.stringify(out.messages);
      assert.ok(fed.includes('\\"errors\\":0') && fed.includes('\\"created\\":1'), 'the verdict went back to the agent as data');
      // Without a running Python the tool says so and starts nothing.
      calls = 0; seen.length = 0; bridge.state = 'idle';
      const cs2 = writeTools.create(ds.id);
      const out2 = await agent.ask({ provider: pre, datasetId: ds.id, question: 'En vägg på plan 9', changeset: cs2 });
      const p2 = out2.steps.find((s) => s.name === 'preview_changeset');
      assert.ok(p2 && p2.error && p2.error.includes('Python'), 'told that Python does not run: ' + (p2 && p2.error));
      assert.equal(seen.length, 0, 'the wheel did not run');
      assert.ok(agent.SYSTEM_CHANGE.includes('preview_changeset') && agent.MAX_PREVIEWS === 3, 'the agent is told to preview, within a limit');
    } finally {
      bridge.runIfcChangeset = real; bridge.state = state;
      await providers.remove(pre.id);
    }
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

  test('ai change: the preview asks Dataregium\'s precheck of the candidate for a fetched model, and a refused upload carries the report', async (assert) => {
    const CDE = 'dataspatium-asset://tests/ai-change-cde2';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const hits = []; let polls = 0;
    D.net.virtual('tests/ai-change-cde2/', (url) => {
      const rest = url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname;
      const path = rest.split('?')[0];
      hits.push(path);
      if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', documents: '1.0' }, extensions: { ifc_precheck: { enabled: true, url: '/documents/1.0/projects/{project_id}/ifc-precheck' } } }));
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/documents/1.0/projects/p-1/ifc-precheck') return Promise.resolve(json({ id: 'pc1', status: 'pending', file_name: 'testhus.ifc', url: CDE + '/precheck/pc1' }, 202));
      if (path === '/precheck/pc1') { polls++; return Promise.resolve(json(polls < 2 ? { id: 'pc1', status: 'pending', url: CDE + '/precheck/pc1' } : { id: 'pc1', status: 'warnings', issue_count: 1, error_count: 0, issues: [{ kind: 'gherkin', rule: 'ALB001', severity: 'warning', message: 'Alignment', step_id: 1, global_id: null }] })); }
      if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: CDE + '/ui', expires_in: 600, max_size_in_bytes: 0 }));
      if (path === '/documents/1.0/upload-instructions') return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: CDE + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 9 }], upload_completion: { url: CDE + '/complete' } }] }));
      if (path === '/part') return Promise.resolve({ kind: 'text', data: '' });
      // A check that took long: 200 with the refusal in the body.
      if (path === '/complete') return Promise.resolve(json({ message: 'The file has 2 validation errors', code: 'ifc_validation_failed', report: CDE + '/precheck/pc2' }));
      if (path === '/precheck/pc2') return Promise.resolve(json({ id: 'pc2', status: 'issues', issue_count: 3, error_count: 2, issues: [] }));
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const { connector } = await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' });
    const meta = await datasets.get(ds.id);
    const changed = new TextEncoder().encode(fixtures.ifcText({ walls: 2 }));
    const real = bridge.runIfcChangeset;
    bridge.runIfcChangeset = async (changes) => ({ bytes: changed, info: { elements: 6, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [], changed: [], deleted: [], findings: [], errors: 0 }, log: [] });
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log: () => {} } }, { datasetId: ds.id, preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', documentId: 'doc-1', versionIndex: 1 } }) });
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      await waitFor(() => panel.state.providers.length, 3000, 'the providers loaded');
      panel.state.providerId = provider.id; panel.setMode('change');
      world.calls = 0;
      await panel.ask('Lägg till plan 3 med en vägg');
      await panel.preview();
      assert.ok(hits.includes('/documents/1.0/projects/p-1/ifc-precheck'), 'the candidate went to the precheck'); assert.equal(polls, 2, 'polled until done');
      const line = panel.el.querySelector('[data-ai-precheck]');
      assert.ok(line && line.getAttribute('data-ai-precheck') === 'warnings' && line.textContent.includes('1'), 'the server\'s verdict shown: ' + (line && line.textContent));
      assert.ok(!(/** @type {any} */ (panel.el.querySelector('[data-ai-approve]'))).disabled, 'warnings do not block approval');
      // The refusal at publish: the code in the body decides, and the report's address comes along.
      const file = new File(['0123456789'], 'hus.ifc', { type: 'application/octet-stream' });
      const err = await opencde.uploadDocument(connector, file, { documentId: 'doc-1', baseVersionIndex: 1, redirectUri: REDIRECT, popup: () => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(CDE + '/documents/1.0/upload-instructions')}`) }).catch((e) => e);
      assert.ok(err instanceof Error && err.code === 'ifc_validation_failed' && err.status === 422 && err.report === CDE + '/precheck/pc2', 'refused with the report: ' + err.message);
      assert.ok(err.message.includes(t('opencde.err.code.ifc_validation_failed', { detail: '' }).trim()), 'told in the user\'s words');
      const validation = D.require('data/ifc-validation');
      const report = await opencde.api(connector, err.report);
      assert.deepEqual(validation.counts(report), { findings: 3, errors: 2 }, 'the report counts for the message and the card');
      await panel.reject();
    } finally {
      bridge.runIfcChangeset = real; panel.destroy(); panel.el.remove();
      await datasets.updateMeta(ds.id, { source: meta.source || { kind: 'file' } });
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id);
    }
    return 'ok';
  }, 30000);

  test('ai change: a previewed change set goes to Dataregium as a change proposal, a BCF topic with the snippet in the server\'s form', async (assert) => {
    const CDE = 'dataspatium-asset://tests/ai-change-cde3';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const hits = []; const bodies = {}; let trials = 0; let cleanTrial = false; let approveAnswer = 'ok';
    // The virtual server sees only addresses; the bodies are read off fetch itself.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => { const u = String(url); if (u.startsWith(CDE) && init && init.body !== undefined) bodies[u.slice(CDE.length).split('?')[0]] = { method: init.method, body: String(init.body), headers: init.headers || {} }; return realFetch(url, init); };
    D.net.virtual('tests/ai-change-cde3/', (url) => {
      const rest = url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname;
      const path = rest.split('?')[0];
      hits.push(path);
      if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, extensions: { ifc_changes: { enabled: true, schema: '/documents/1.0/ifc-changes/schema', snippet_type: 'DataregiumIfcChangeSet', max_changes: 10000, proposal_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal', approve_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/approve', tried: true } } }));
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'anna', name: 'Anna' }));
      if (path === '/bcf/3.0/projects/p-1/extensions') return Promise.resolve(json({ topic_type: ['Issue', 'Change proposal'], topic_status: ['Open'] }));
      if (path === '/bcf/3.0/projects/p-1/topics') return Promise.resolve(json({ guid: 't-1', title: 'x' }, 201));
      if (path === '/bcf/3.0/projects/p-1/topics/t-1/snippet') return Promise.resolve({ kind: 'text', data: '' });
      if (path === '/documents/1.0/document-versions') return Promise.resolve(json({ versions: [{ document_id: 'doc-1', version_index: 2, version_number: '2' }, { document_id: 'doc-1', version_index: 4, version_number: '4' }] }));
      if (path === '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal') { trials++; return Promise.resolve(json(trials < 2 ? { state: 'queued', base: { document_id: 'doc-1', version_index: 2 }, change_count: 2 } : cleanTrial ? { state: 'clean', base: { document_id: 'doc-1', version_index: 2 }, change_count: 1, applied: 1, issue_count: 0, error_count: 0, issues: [] } : { state: 'issues', base: { document_id: 'doc-1', version_index: 2 }, change_count: 2, applied: 1, issue_count: 1, error_count: 1, issues: [{ kind: 'proposal', severity: 'error', message: 'change 1: RelatedElements has no member #99' }] })); }
      if (path === '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve') {
        if (approveAnswer === 'conflict') return Promise.resolve(json({ message: 'The document has 2 newer versions and 1 of its changes collide with what came between', code: 'version_conflict', conflicts: ['#170.NominalValue'] }, 412));
        if (approveAnswer === 'stale') { cleanTrial = false; trials = 0; return Promise.resolve(json({ message: 'On version 4 the trial is issues; see the trial' }, 409)); }
        if (approveAnswer === 'details') return Promise.resolve(json({ message: 'The document has 2 newer versions and 1 of its changes collide with what came between', code: 'version_conflict', conflicts: ['#170.NominalValue'], conflict_details: [{ key: '#170.NominalValue', step_id: 170, attribute: 'NominalValue', op: 'set', base: { type: 'IfcLabel', value: 'EI60' }, theirs: { type: 'IfcLabel', value: 'EI120' }, ours: { type: 'IfcLabel', value: 'EI90' }, version_index: 4 }] }, 412));
        return Promise.resolve(json({ version_index: 3, version_number: '3', title: 'Hus', file_name: 'hus.ifc', metadata: { base_version_index: 2, change_set_id: 't-1', proposed_by: 'anna', approved_by: 'anna' } }, 201));
      }
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const { connector } = await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' });
    const meta = await datasets.get(ds.id);
    const changed = new TextEncoder().encode(fixtures.ifcText({ walls: 2 }));
    const real = bridge.runIfcChangeset;
    const proposal = { changes: [{ step_id: 170, attribute: 'NominalValue', op: 'set', old: { type: 'IfcLabel', value: 'EI60' }, new: { type: 'IfcLabel', value: 'EI90' } }, { step_id: 71, attribute: 'RelatedElements', op: 'remove', old: { step_id: 99 } }], truncated: false, instances: 2, unexpressed: { created: 1, deleted: 0, relations: 1 } };
    bridge.runIfcChangeset = async (changes) => ({ bytes: changed, info: { elements: 6, entities: 1, file: 'testhus.ifc', operations: changes.length, created: [{ id: 200, ifc_class: 'IfcWall' }], changed: [{ id: 99, ifc_class: 'IfcWall' }], deleted: [], findings: [], errors: 0, proposal }, log: [] });
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log: () => {} } }, { datasetId: ds.id, preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', projectName: 'Testprojekt', documentId: 'doc-1', versionIndex: 2 } }) });
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      await waitFor(() => panel.state.providers.length, 3000, 'the providers loaded');
      panel.state.providerId = provider.id; panel.setMode('change');
      world.calls = 0;
      await panel.ask('Sätt brandklass EI90 på väggen');
      await panel.preview();
      const line = panel.el.querySelector('[data-ai-proposal]');
      assert.ok(line && line.getAttribute('data-ai-proposal') === '2' && line.textContent.includes('1'), 'the proposal\'s form and what it leaves out: ' + (line && line.textContent));
      const btn = /** @type {any} */ (panel.el.querySelector('[data-ai-propose]'));
      assert.ok(btn && !btn.disabled, 'the button Föreslå på servern for a fetched model');
      await panel.propose({ title: 'Brandklass EI90 på väggen', description: 'Väggen får EI90.' });
      assert.equal(panel.state.error, '', 'no error');
      assert.ok(hits.includes('/bcf/3.0/projects/p-1/topics') && hits.includes('/bcf/3.0/projects/p-1/topics/t-1/snippet'), 'the topic and then its snippet: ' + hits.join(' '));
      const topic = JSON.parse(bodies['/bcf/3.0/projects/p-1/topics'].body);
      assert.equal(topic.title, 'Brandklass EI90 på väggen'); assert.equal(topic.topic_type, 'Change proposal', 'the project\'s type for proposals');
      assert.deepEqual(topic.bim_snippet, { snippet_type: 'DataregiumIfcChangeSet', is_external: false, reference: 'changes.json', reference_schema: CDE + '/documents/1.0/ifc-changes/schema' }, 'the bim_snippet names the type and the schema');
      const put = bodies['/bcf/3.0/projects/p-1/topics/t-1/snippet'];
      assert.equal(put.method, 'PUT'); assert.equal(String(put.headers['Content-Type'] || put.headers['content-type']), 'application/json');
      const snippet = JSON.parse(put.body);
      assert.equal(snippet.schema, CDE + '/documents/1.0/ifc-changes/schema');
      assert.deepEqual(snippet.base, { document_id: 'doc-1', version_index: 2 }, 'the base version the model was fetched as');
      assert.equal(snippet.provenance.user, 'Anna', 'the signed-in user'); assert.equal(snippet.provenance.ai_model, 'claude-test');
      assert.ok(snippet.provenance.tool_call.includes('create_storeys_and_grid') && /^\d{4}-\d\d-\d\dT/.test(snippet.provenance.created_at), 'the tools and the time');
      assert.deepEqual(snippet.changes, proposal.changes, 'the wheel\'s changes as they are');
      assert.ok(Object.keys(snippet).sort().join() === 'base,changes,provenance,schema', 'nothing else in the snippet');
      const sent = panel.el.querySelector('[data-ai-proposed]');
      assert.ok(sent && sent.getAttribute('data-ai-proposed') === 't-1' && sent.textContent.includes('Brandklass'), 'the topic shown');
      assert.ok((/** @type {any} */ (panel.el.querySelector('[data-ai-propose]'))).disabled, 'sent once');
      // The server's trial of the proposal: polled until final, the verdict and the change that could not be applied shown.
      await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'issues', 8000, 'the trial finished');
      assert.equal(trials, 2, 'polled until final');
      const trial = panel.el.querySelector('[data-ai-trial]');
      assert.ok(trial && trial.getAttribute('data-ai-trial') === 'issues' && trial.textContent.includes('1') && trial.textContent.includes('2'), 'the trial\'s verdict: ' + (trial && trial.textContent));
      const issue = panel.el.querySelector('[data-ai-trial-issues] li');
      assert.ok(issue && issue.textContent.includes('proposal') && issue.textContent.includes('change 1'), 'the change that could not be applied: ' + (issue && issue.textContent));
      assert.ok(!panel.el.querySelector('[data-ai-approve-server]'), 'a trial with issues cannot be approved');
      // A clean trial: a manager makes the proposal the next version on the server.
      cleanTrial = true; trials = 0; proposal.changes = proposal.changes.slice(0, 1);
      await panel.reject();
      world.calls = 0;
      await panel.ask('Sätt brandklass EI90 på väggen');
      await panel.preview();
      await panel.propose({ title: 'Brandklass EI90', description: 'Bara egenskapen.' });
      await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
      const approveBtn = /** @type {any} */ (panel.el.querySelector('[data-ai-approve-server]'));
      assert.ok(approveBtn && !approveBtn.disabled, 'Godkänn på servern after a clean trial');
      await panel.approveOnServer({ confirmed: true });
      assert.equal(panel.state.error, '', 'approved without error');
      assert.ok(hits.includes('/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve') && bodies['/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve'] === undefined, 'POST without a body');
      const approved = panel.el.querySelector('[data-ai-approved-server]');
      assert.ok(approved && approved.getAttribute('data-ai-approved-server') === '3' && approved.textContent.includes('3'), 'the new version shown: ' + (approved && approved.textContent));
      assert.ok(!panel.el.querySelector('[data-ai-approve-server]'), 'approved once');
      // A stale base: the changes collide with what came between (412 with the keys), told with the keys under the topic.
      for (const answer of ['conflict', 'stale', 'details']) {
        approveAnswer = answer; cleanTrial = true; trials = 0;
        await panel.reject();
        world.calls = 0;
        await panel.ask('Sätt brandklass EI90 på väggen');
        await panel.preview();
        await panel.propose({ title: 'Brandklass EI90 igen', description: '' });
        await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
        await panel.approveOnServer({ confirmed: true });
        if (answer === 'details') {
          // OB-19 d: the three values per collision, the person keeps the proposal, and it goes again against the latest version.
          assert.equal(panel.state.error, t('ai.change.approve.server.conflict.choose', { k: '1' }), 'told to choose');
          const row = panel.el.querySelector('[data-ai-conflict="0"]');
          assert.ok(row && row.textContent.includes('EI60') && row.textContent.includes('EI120') && row.textContent.includes('EI90') && row.textContent.includes('4'), 'base, what came between and the proposal: ' + (row && row.textContent));
          assert.ok(panel.el.querySelector('[data-ai-conflict-pick="0"]') && panel.el.querySelector('[data-ai-conflict-resend]'), 'a choice and the button');
          await panel.resolveConflicts(['ours']);
          assert.equal(panel.state.error, '', 'sent again without error');
          const again = JSON.parse(bodies['/bcf/3.0/projects/p-1/topics/t-1/snippet'].body);
          assert.equal(again.base.version_index, 4, 'against the latest version');
          assert.deepEqual(again.changes.map((c) => [c.step_id, c.old, c.new]), [[170, { type: 'IfcLabel', value: 'EI120' }, { type: 'IfcLabel', value: 'EI90' }]], 'the kept change with what came between as its old value');
          assert.ok(!panel.el.querySelector('[data-ai-conflicts]'), 'the collisions are decided');
          await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the new trial');
          approveAnswer = 'ok';
          await panel.approveOnServer({ confirmed: true });
          assert.ok(panel.el.querySelector('[data-ai-approved-server]'), 'approved after the choice');
        } else if (answer === 'conflict') {
          assert.ok(panel.state.error.includes('#170.NominalValue') && panel.state.error === t('ai.change.approve.server.conflict', { k: '1', keys: '#170.NominalValue' }), 'the colliding keys in the person\'s words: ' + panel.state.error);
          const list = panel.el.querySelector('[data-ai-approve-conflicts]');
          assert.ok(list && list.getAttribute('data-ai-approve-conflicts') === '1' && list.textContent.includes('#170.NominalValue'), 'the keys listed');
          assert.ok(!panel.el.querySelector('[data-ai-approved-server]'), 'not approved');
        } else {
          assert.ok(panel.state.error.includes('version 4'), 'the server\'s words on the retried trial: ' + panel.state.error);
          await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'issues', 8000, 'the trial on the latest version fetched again');
          assert.ok(panel.el.querySelector('[data-ai-trial]').getAttribute('data-ai-trial') === 'issues', 'the new verdict shown');
        }
      }
      approveAnswer = 'ok';
      // A change set that only creates: nothing in the server's form, and the button says so.
      cleanTrial = false; proposal.changes = [];
      await panel.reject();
      world.calls = 0;
      await panel.ask('Lägg till en vägg');
      await panel.preview();
      assert.ok((/** @type {any} */ (panel.el.querySelector('[data-ai-propose]'))).disabled, 'nothing to propose');
      await panel.propose({ title: 'x' });
      assert.ok(panel.state.error && panel.state.error === t('ai.change.propose.none'), 'told why: ' + panel.state.error);
      await panel.reject();
    } finally {
      globalThis.fetch = realFetch;
      bridge.runIfcChangeset = real; panel.destroy(); panel.el.remove();
      await datasets.updateMeta(ds.id, { source: meta.source || { kind: 'file' } });
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id);
    }
    return 'ok';
  }, 70000);

  test('ai change: cleanup', async () => {
    if (provider) await providers.remove(provider.id);
    if (ds) await datasets.remove(ds.id);
    return 'ok';
  });
})();
