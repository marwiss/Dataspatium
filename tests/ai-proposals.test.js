// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the card Ändringsförslag på servern (decision F43 b, step 5): the list of a document's change proposals from a virtual
 * Dataregium through the capability's template, the rows with their states, Approve on a tried one, the server's 403 in words, and
 * a server without the list. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const json = (data, status = 200) => ({ kind: 'text', data: JSON.stringify(data), status });
  const CDE = 'dataspatium-asset://tests/ai-proposals-cde';
  const BARE = 'dataspatium-asset://tests/ai-proposals-bare';
  const OPS = 'dataspatium-asset://tests/ai-proposals-ops';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const http = D.require('api/http');
  const writeTools = D.require('ai/write-tools');
  const hits = []; let approveAnswer = 'ok';
  /** The bodies the virtual servers were sent, by path; the virtual handler itself only sees addresses. */
  const sent = {}; let realRequest = null;
  /** What the virtual servers answer for the project's role and AI policy. */
  const project = { actions: ['createTopic', 'createDocument'], policy: 'local', policyStatus: 200 };
  const rows = [
    { topic_guid: 't-2', title: 'Brandklass EI90', description: 'Dörrarna på plan 2', state: 'clean', base_version_index: 4, change_count: 3, author: 'bo', checked_at: '2026-11-11T20:00:00Z', proposal_url: CDE + '/bcf/3.0/projects/p-1/topics/t-2/ifc-proposal', approve_url: CDE + '/bcf/3.0/projects/p-1/topics/t-2/ifc-proposal/approve' },
    { topic_guid: 't-1', title: 'Nya fönster', state: 'approved', base_version_index: 3, change_count: 12, author: 'anna', checked_at: '2026-11-10T09:00:00Z', version_index: 4, proposal_url: CDE + '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal', approve_url: CDE + '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve' },
  ];
  /** A virtual Dataregium: with the list's template in its capability, or without it, and with the write tools' form or without it. */
  function server(base, withList, withOps) {
    return (url) => {
      const rest = url.startsWith(base) ? url.slice(base.length) : new URL(url).pathname;
      const path = rest.split('?')[0];
      hits.push(path);
      if (path === '/.well-known/dataregium') {
        const changes = { enabled: true, schema: '/documents/1.0/ifc-changes/schema', proposal_url: base + '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal', approve_url: base + '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/approve' };
        if (withList) changes.ifc_proposals_url = base + '/documents/1.0/documents/{document_id}/ifc-proposals';
        if (withOps) changes.ops_form = 'dataspatium-tools/1';
        const extensions = { ifc_changes: changes };
        if (withOps) extensions.ai_policy = { enabled: true, url: '/documents/1.0/projects/{project_id}/ai-policy', default: 'local' };
        return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, extensions }));
      }
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: base + '/foundation/oauth2/auth', oauth2_token_url: base + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'anna', name: 'Anna' }));
      if (path === '/documents/1.0/documents/doc-1/ifc-proposals') return Promise.resolve(json(rows));
      if (path === '/bcf/3.0/projects/p-1') return Promise.resolve(json({ project_id: 'p-1', name: 'Testprojekt', authorization: { project_actions: project.actions } }));
      if (path === '/documents/1.0/projects/p-1/ai-policy') return Promise.resolve(json(project.policyStatus === 200 ? { project_id: 'p-1', ai_policy: project.policy } : { message: 'Not Found' }, project.policyStatus));
      if (path === '/bcf/3.0/projects/p-1/extensions') return Promise.resolve(json({ topic_type: ['Issue', 'Change proposal'], topic_status: ['Open'] }));
      if (path === '/bcf/3.0/projects/p-1/topics') return Promise.resolve(json({ guid: 't-9', title: 'x' }, 201));
      if (path === '/bcf/3.0/projects/p-1/topics/t-9/snippet') return Promise.resolve({ kind: 'text', data: '' });
      if (path === '/bcf/3.0/projects/p-1/topics/t-2/ifc-proposal/approve') {
        if (approveAnswer === 'team') return Promise.resolve(json({ message: 'Only the responsible of the team Stomme approves it', code: 'forbidden' }, 403));
        rows[0] = Object.assign({}, rows[0], { state: 'approved', version_index: 5 });
        return Promise.resolve(json({ version_index: 5, version_number: '5', title: 'Hus' }, 201));
      }
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    };
  }
  let ds = null; let connector = null; let bare = null;
  const signIn = (c) => opencde.login(c, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
  async function waitFor(fn, ms, label) {
    const t0 = Date.now();
    for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + label); await new Promise((r) => setTimeout(r, 25)); }
  }

  test('proposals: the card lists a document\'s change proposals from the server and approves a tried one', async (assert) => {
    D.net.virtual('tests/ai-proposals-cde/', server(CDE, true));
    D.net.virtual('tests/ai-proposals-bare/', server(BARE, false));
    ds = await importer.run(fixtures.ifcFile({ walls: 1 }), { format: 'model' }, null, 'Förslagshus');
    connector = (await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' })).connector;
    const meta = await datasets.get(ds.id);
    const cardFile = D.require('ui/bearbeta/proposals-card').create({ shell: { log() {} } }, meta);
    assert.equal(await cardFile.ready, false, 'a model from a file has no card');
    assert.equal(cardFile.el.children.length, 0);
    await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', projectName: 'Testprojekt', documentId: 'doc-1', versionIndex: 4 } }) });
    const cardOut = D.require('ui/bearbeta/proposals-card').create({ shell: { log() {} } }, await datasets.get(ds.id));
    assert.equal(await cardOut.ready, false, 'not signed in: no card');
    await signIn(connector);
    const logged = [];
    const card = D.require('ui/bearbeta/proposals-card').create({ shell: { log: (m) => logged.push(m) } }, await datasets.get(ds.id));
    document.body.appendChild(card.el);
    try {
      assert.equal(await card.ready, true, 'signed in: the card');
      assert.ok(card.el.querySelector('[data-proposals-fetch]') && card.el.textContent.includes(t('proposals.title')), 'the title and the button');
      assert.ok(!hits.includes('/documents/1.0/documents/doc-1/ifc-proposals'), 'nothing fetched before the person asks');
      /** @type {HTMLElement} */ (card.el.querySelector('[data-proposals-fetch] button')).click();
      await waitFor(() => card.el.querySelector('[data-proposals-list]'), 5000, 'the list');
      assert.equal(card.el.querySelector('[data-proposals-list]').getAttribute('data-proposals-list'), '2');
      assert.ok(card.el.querySelector('[data-proposal="t-2"][data-proposal-state="clean"]') && card.el.querySelector('[data-proposal="t-1"][data-proposal-state="approved"]'), 'the rows with their states');
      const text = card.el.textContent;
      assert.ok(/Brandklass EI90/.test(text) && /Dörrarna på plan 2/.test(text) && text.includes(t('proposals.state.approved', { version: '4' })), text.slice(0, 300));
      assert.ok(card.el.querySelector('[data-proposal-approve="t-2"]') && !card.el.querySelector('[data-proposal-approve="t-1"]'), 'approve only on the tried one');
      assert.ok(logged.some((m) => m === t('proposals.log.fetched', { n: '2', server: connector.name })), 'the log line');
      approveAnswer = 'team';
      const refused = await card.approve(rows[0], { confirmed: true });
      assert.equal(refused, null);
      assert.ok(card.el.querySelector('[data-proposals-error]') && /Stomme/.test(card.el.querySelector('[data-proposals-error]').textContent), 'the team refusal in words');
      approveAnswer = 'ok';
      const version = await card.approve(rows[0], { confirmed: true });
      assert.equal(version && version.version_index, 5);
      await waitFor(() => card.el.querySelector('[data-proposal="t-2"][data-proposal-state="approved"]'), 5000, 'the list refreshed');
      assert.ok(!card.el.querySelector('[data-proposals-error]'), 'no error after the approval');
    } finally { card.el.remove(); card.destroy(); }
    // A server without the list: the card says so instead of guessing an address.
    bare = (await families.createConnector('opencde', { baseUrl: BARE, clientId: 'dataspatium', clientSecret: '' })).connector;
    await signIn(bare);
    assert.equal(await opencde.ifcProposals(bare, 'p-1', 'doc-1'), null);
    const list = await opencde.ifcProposals(connector, 'p-1', 'doc-1');
    assert.ok(Array.isArray(list) && list.length === 2 && list[0].topic_guid === 't-2', 'the list through the capability');
    return 'ok';
  }, 20000);

  let withOps = null;
  test('proposals: a server that takes the write tools\' form gets their operations in the snippet, also for created elements alone', async (assert) => {
    D.net.virtual('tests/ai-proposals-ops/', server(OPS, false, true));
    realRequest = http.request;
    http.request = (req) => { const u = String(req.url); if (u.startsWith(OPS) && req.body !== undefined) sent[u.slice(OPS.length).split('?')[0]] = { method: req.method, body: String(req.body) }; return realRequest(req); };
    withOps = (await families.createConnector('opencde', { baseUrl: OPS, clientId: 'dataspatium', clientSecret: '' })).connector;
    await signIn(withOps);
    assert.equal(await opencde.opsForm(withOps), opencde.OPS_FORM);
    assert.equal(await opencde.opsForm(connector), null, 'a server without the form');
    const ops = [{ tool: 'create_storeys_and_grid', storeys: [{ name: 'Plan 1', elevation: 0 }], grid: null }, { tool: 'create_wall', storey: 'Plan 1', start: [0, 0], end: [12, 0], thickness: 0.3, height: 2.7, name: 'Yttervägg syd' }];
    const changeSet = { base: { document_id: 'doc-1', version_index: 4 }, provenance: { user: 'Anna', ai_model: null, tool_call: 'create_wall', created_at: new Date().toISOString() }, changes: [] };
    const out = await opencde.proposeChanges(withOps, 'p-1', { title: 'Nytt hus', changeSet, ops });
    assert.equal(out.opsForm, 'dataspatium-tools/1');
    const put = sent['/bcf/3.0/projects/p-1/topics/t-9/snippet'];
    assert.ok(put && put.method === 'PUT', 'the snippet was sent');
    const snippet = JSON.parse(put.body);
    assert.ok(snippet.ops_form === 'dataspatium-tools/1' && JSON.stringify(snippet.ops) === JSON.stringify(ops) && Array.isArray(snippet.changes) && !snippet.changes.length, put.body.slice(0, 300));
    assert.equal(JSON.stringify(out.changeSet.ops), JSON.stringify(ops), 'the panel keeps what was sent');
    // Without the form the operations stay at home, and created elements alone are no proposal: refused before any topic.
    let refused = null;
    try { await opencde.proposeChanges(connector, 'p-1', { title: 'Nytt hus', changeSet, ops }); } catch (err) { refused = err; }
    assert.ok(refused && refused.message === t('opencde.err.changes.none'), String(refused && refused.message));
    // The panel: a previewed change set of a new wall goes with its operations, without the refs.
    const meta = await datasets.get(ds.id);
    await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: withOps.id, connectorName: withOps.name, host: 'tests', projectId: 'p-1', projectName: 'Testprojekt', documentId: 'doc-1', versionIndex: 4 } }) });
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      panel.setMode('change');
      writeTools.call(panel.state.changeset, 'create_wall', { storey: 'Plan 1', start: [0, 0], end: [8, 0], thickness: 0.3, height: 2.7, name: 'Ny vägg' });
      // An existing element by its STEP id: the proposal names it by GlobalId (decision F34 a at Dataregium).
      const handle = await datasets.ensureOpen(ds.id);
      const wallRow = (await handle.engine.exec("select id, guid from data where typ like 'IfcWall%' and guid is not null limit 1"))[0].values[0];
      writeTools.call(panel.state.changeset, 'set_properties', { ids: [Number(wallRow[0])], pset: 'Pset_WallCommon', properties: [{ name: 'FireRating', value: 'EI60' }] });
      assert.ok(typeof writeTools.call(panel.state.changeset, 'set_properties', { ids: [String(wallRow[1])], pset: 'Pset_WallCommon', properties: [{ name: 'FireRating', value: 'EI90' }] }).error !== 'string', 'a GlobalId is taken as an id');
      panel.state.cde = (await datasets.get(ds.id)).source.cde;
      panel.state.opsForm = opencde.OPS_FORM;
      panel.state.preview = { report: { proposal: { changes: [], instances: 0, unexpressed: { created: 1, deleted: 0, relations: 0 } }, created: [{ id: 300, ifc_class: 'IfcWall', ref: 'new-1' }], changed: [], deleted: [], findings: [], errors: 0 } };
      panel.attach([]);
      const line = panel.el.querySelector('[data-ai-proposal]');
      assert.ok(line && line.textContent.includes(t('ai.change.propose.ops', { n: String(panel.state.changeset.ops.length) })), 'the line says the operations go along: ' + (line && line.textContent));
      const btn = /** @type {any} */ (panel.el.querySelector('[data-ai-propose]'));
      assert.ok(btn && !btn.disabled, 'Föreslå på servern is possible without attribute changes');
      delete sent['/bcf/3.0/projects/p-1/topics/t-9/snippet'];
      await panel.propose({ title: 'Ny vägg', description: 'En vägg.' });
      assert.equal(panel.state.error, '', 'no error');
      const fromPanel = JSON.parse(sent['/bcf/3.0/projects/p-1/topics/t-9/snippet'].body);
      assert.ok(fromPanel.ops.length === 3 && fromPanel.ops[0].tool === 'create_wall' && !('ref' in fromPanel.ops[0]) && fromPanel.ops_form === opencde.OPS_FORM, JSON.stringify(fromPanel.ops));
      assert.ok(fromPanel.ops[1].tool === 'set_properties' && fromPanel.ops[1].ids[0] === String(wallRow[1]) && fromPanel.ops[2].ids[0] === String(wallRow[1]), 'the STEP id became the GlobalId: ' + JSON.stringify(fromPanel.ops[1]));
      assert.ok(panel.state.proposed && JSON.stringify(panel.state.proposed.changeSet.ops) === JSON.stringify(fromPanel.ops), 'the proposal kept as sent');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 20000);

  test('proposals: the button needs the role editor, and a local-only project refuses a cloud provider before anything is sent', async (assert) => {
    // The role: createDocument in the BCF project's actions means editor or higher (Dataregium's F35 a).
    project.actions = ['createTopic', 'createDocument'];
    assert.equal(await opencde.canPropose(withOps, 'p-1'), true);
    project.actions = ['createTopic'];
    assert.equal(await opencde.canPropose(withOps, 'p-1'), false, 'a contributor');
    // The AI policy (Dataregium's F29 a): the project's own, the default when the endpoint fails, none from a server without it.
    project.policy = 'cloud'; project.policyStatus = 200;
    assert.equal(await opencde.aiPolicy(withOps, 'p-1'), 'cloud');
    project.policy = 'later'; project.policyStatus = 200;
    assert.equal(await opencde.aiPolicy(withOps, 'p-1'), 'local', 'an unknown value reads as local');
    project.policyStatus = 404;
    assert.equal(await opencde.aiPolicy(withOps, 'p-1'), 'local', 'the default when the endpoint fails');
    assert.equal(await opencde.aiPolicy(connector, 'p-1'), null, 'a server without a policy');
    project.policy = 'local'; project.policyStatus = 200;
    const providers = D.require('ai/providers');
    const cloud = await providers.save({ id: 'proposals-cloud', kind: 'anthropic', name: 'Moln', baseUrl: 'dataspatium-asset://tests/ai-proposals-cloud/', model: 'claude-test' });
    providers.setKey(cloud.id, 'sk-test-proposals');
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      for (let i = 0; i < 100 && !panel.state.providers.length; i++) await new Promise((r) => setTimeout(r, 30));
      for (let i = 0; i < 100 && !panel.state.material; i++) await new Promise((r) => setTimeout(r, 30));
      assert.ok(panel.state.material && panel.state.material.connector.id === withOps.id, 'the panel knows the model\'s server');
      panel.state.providerId = cloud.id;
      const before = hits.length;
      await panel.ask('Vilka väggar saknar brandklass?');
      assert.equal(panel.state.error, t('ai.err.policy.project', { project: 'Testprojekt', host: providers.hostOf(cloud.baseUrl) }), panel.state.error);
      assert.ok(!hits.slice(before).some((h) => /messages/.test(h)), 'nothing went to the provider');
      // The propose button is not offered without the role.
      panel.setMode('change');
      writeTools.call(panel.state.changeset, 'create_wall', { storey: 'Plan 1', start: [0, 0], end: [4, 0], thickness: 0.3, height: 2.7, name: 'Vägg' });
      panel.state.cde = (await datasets.get(ds.id)).source.cde;
      panel.state.opsForm = opencde.OPS_FORM; panel.state.canPropose = false;
      panel.state.preview = { report: { proposal: { changes: [], instances: 0, unexpressed: { created: 1, deleted: 0, relations: 0 } }, created: [], changed: [], deleted: [], findings: [], errors: 0 } };
      panel.attach([]);
      assert.ok(!panel.el.querySelector('[data-ai-propose]') && panel.el.querySelector('[data-ai-propose-role]'), 'no button, a line about the role');
    } finally { panel.destroy(); panel.el.remove(); await providers.remove(cloud.id).catch(() => {}); }
    return 'ok';
  }, 20000);

  test('proposals: cleanup', async (assert) => {
    if (ds) await datasets.remove(ds.id).catch(() => {});
    for (const c of [connector, bare, withOps]) { if (c) { await opencde.logout(c).catch(() => {}); await connectors.remove(c.id).catch(() => {}); } }
    if (realRequest) http.request = realRequest;
    D.net.unvirtual('tests/ai-proposals-cde/'); D.net.unvirtual('tests/ai-proposals-bare/'); D.net.unvirtual('tests/ai-proposals-ops/');
    assert.ok(true);
  });
})();
