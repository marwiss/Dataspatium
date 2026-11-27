// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Föreslå ändringarna in Dela's Till CDE (decision F123 a), against a virtual Dataregium and with the wheel stubbed
 * (Pyodide never runs here): the button is offered for a model fetched from a server with `ifc_changes` once it has steps since it
 * was fetched; the base version's file comes from the source's own server, the model's file is compared with it, and the proposal
 * goes with the AI panel's form, schema and provenance, the steps in place of an AI model; what the form cannot express is said at
 * the button with the way to a new version; the review takes values with personal data out or keeps them; the trial, the approval
 * and the collisions work as in the AI panel; and a person without the role editor is told before anything is computed.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const ifcOps = D.require('data/ifc-ops');
  const basic = D.require('ui/basic');
  const overlays = D.require('ui/overlays');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const http = D.require('api/http');
  const { bridge } = D.require('data/python-bridge');
  const BASE = 'dataspatium-asset://tests/cde-propose';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data, status) => Object.assign({ kind: 'text', data: JSON.stringify(data) }, status ? { status } : {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(25); }
  }
  /** What the virtual server answers, set by each test, and what it was asked. */
  const world = { changes: true, actions: ['createTopic', 'createDocument'], trials: 0, clean: true, approve: 'ok', base: fixtures.ifcText({ walls: 2 }), hits: [], sent: {} };
  D.net.virtual('tests/cde-propose/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0];
    world.hits.push(path);
    if (path === '/.well-known/dataregium') {
      const extensions = world.changes ? { ifc_changes: { enabled: true, schema: '/documents/1.0/ifc-changes/schema', snippet_type: 'DataregiumIfcChangeSet', max_changes: 10000, proposal_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal', approve_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/approve', tried: true } } : {};
      return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, extensions }));
    }
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'anna', name: 'Anna' }));
    if (path === '/bcf/3.0/projects/p-1') return Promise.resolve(json({ project_id: 'p-1', name: 'Testprojekt', authorization: { project_actions: world.actions } }));
    if (path === '/bcf/3.0/projects/p-1/extensions') return Promise.resolve(json({ topic_type: ['Issue', 'Change proposal'], topic_status: ['Open'] }));
    if (path === '/bcf/3.0/projects/p-1/topics') return Promise.resolve(json({ guid: 't-1', title: 'x' }, 201));
    if (path === '/bcf/3.0/projects/p-1/topics/t-1/snippet') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/documents/1.0/documents/doc-1/versions/2/download') return Promise.resolve({ kind: 'text', data: world.base });
    if (path === '/documents/1.0/document-versions') return Promise.resolve(json({ versions: [{ document_id: 'doc-1', version_index: 4, version_number: '4' }] }));
    if (path === '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal') { world.trials++; return Promise.resolve(json(world.trials < 2 ? { state: 'queued' } : world.clean ? { state: 'clean', change_count: 2, applied: 2, issue_count: 0, error_count: 0, issues: [] } : { state: 'issues', change_count: 2, applied: 1, issue_count: 1, error_count: 1, issues: [{ kind: 'proposal', severity: 'error', message: 'change 2: the value is no longer EI60' }] })); }
    if (path === '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve') {
      if (world.approve === 'details') return Promise.resolve(json({ message: 'The document has 2 newer versions and 1 of its changes collide with what came between', code: 'version_conflict', conflicts: ['#1062.NominalValue'], conflict_details: [{ key: '#1062.NominalValue', step_id: 1062, attribute: 'NominalValue', op: 'set', base: { type: 'IfcLabel', value: 'EI60' }, theirs: { type: 'IfcLabel', value: 'EI120' }, ours: { type: 'IfcLabel', value: 'EI90' }, version_index: 4, change_index: 1 }] }, 412));
      return Promise.resolve(json({ version_index: 3, version_number: '3', title: 'Hus' }, 201));
    }
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  /** What http.request was when the spy went in (other test files wrap it as they load), restored at the cleanup. */
  let realRequest = null;
  const spyRequest = (req) => { const u = String(req.url); if (u.startsWith(BASE) && req.body !== undefined) world.sent[u.slice(BASE.length).split('?')[0]] = { method: req.method, body: String(req.body) }; return realRequest(req); };
  /** The changes the stubbed wheel answers: a wall's name by its GlobalId, a property by its set's GlobalId and path. */
  const L = (v) => ({ type: 'IfcLabel', value: v });
  const NAME = { guid: '0Dataspatium0000000011', attribute: 'Name', op: 'set', old: 'Vägg 1.1', new: 'Vägg X' };
  const FIRE = { guid: '0Dataspatium0000000012', path: 'HasProperties[1]', attribute: 'NominalValue', op: 'set', old: L('EI60'), new: L('EI90') };
  const proposalOf = (changes, unexpressed, truncated) => ({ changes, truncated: !!truncated, instances: changes.length, unexpressed: Object.assign({ created: 0, deleted: 0, relations: 0, geometry: 0 }, unexpressed || {}) });
  let connector = null; let ds = null; let table = null; let panel = null; let current = null;
  /** What the review's dialog does: 'drop' or 'keep' the changes with personal data, or 'cancel'; and what it was shown. */
  const reviewing = { choice: 'drop', shown: [] };
  const ctx = {
    ui: { button: basic.button, toast: overlays.toast, dialog: { open: async (spec) => {
      const sel = /** @type {any} */ (spec.body.querySelector('[data-review-changes]'));
      reviewing.shown.push({ n: sel ? sel.getAttribute('data-review-changes') : null, text: spec.body.textContent });
      if (reviewing.choice === 'cancel') return false;
      if (sel) { sel.value = reviewing.choice; sel.dispatchEvent(new Event('change')); }
      return true;
    } } },
    shell: { log() {} }, services: { exporter: D.require('io/export'), files: D.require('platform/files') }, store: { get: () => ({ datasets: [] }) },
  };
  const realProposal = bridge.runIfcProposal; const realApply = bridge.runIfcApply;
  /** What the stubbed wheel was given, and what it answers next. */
  const wheel = { seen: [], answer: proposalOf([NAME, FIRE], { relations: 1 }) };
  const snippet = () => JSON.parse(world.sent['/bcf/3.0/projects/p-1/topics/t-1/snippet'].body);
  const button = () => /** @type {any} */ (panel.el.querySelector('[data-cde-propose]'));
  /** A button's tip (dm-button moves its title to the shared tooltip's data-tip). */
  const tipOf = (b) => { const inner = b && b.querySelector('button[data-tip]'); return inner ? inner.getAttribute('data-tip') : (b && b.tipText) || ''; };
  async function refresh() { await datasets.save(ds.id); current = await datasets.get(ds.id); panel.render(); }

  test('cde propose: the button is offered for a model from Dataregium with steps since it was fetched, and the changes go against the base from the server, with the steps as provenance', async (assert) => {
    realRequest = http.request; http.request = spyRequest;
    bridge.runIfcProposal = async (base, model) => { wheel.seen.push({ base: new TextDecoder().decode(base), model: new TextDecoder().decode(model) }); return wheel.answer; };
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-cde-propose', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
    ds = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Föreslå ändringarna');
    table = await datasets.create({ name: 'Brandklasser', columns: [{ name: 'guid', type: 'text' }, { name: 'Pset_WallCommon.FireRating', type: 'text' }], rows: [['0Dataspatium0000000011', 'EI90']] });
    const meta = await datasets.get(ds.id);
    // A reference on the source that is not the version's address: the base is fetched from the Documents API's own path.
    await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', projectName: 'Testprojekt', kind: 'document', documentId: 'doc-1', versionIndex: 2, reference: BASE + '/elsewhere', fetchedAt: new Date().toISOString() } }) });
    current = await datasets.get(ds.id);
    panel = D.require('ui/share/cde-send').create(ctx, { dataset: () => current });
    document.body.appendChild(panel.el);
    panel.state.connectors = [connector]; panel.state.connector = connector;
    panel.state.takesChanges = await opencde.takesChanges(connector);
    assert.ok(panel.state.takesChanges, 'the server takes change proposals');
    panel.render();
    await waitFor(() => panel.state.stepsFor === ds.id, 3000, 'the steps read');
    assert.ok(panel.el.querySelector('[data-cde-send-version]') && !button(), 'no proposal before the model has changed');
    // A table written into the model (the wheel stubbed): the step is in the log after the fetch, and the button comes.
    await wait(5);
    const changed = fixtures.ifcText({ walls: 2 }).replace("IFCLABEL('EI60')", "IFCLABEL('EI90')").replace("'Vägg 1.1'", "'Vägg X'");
    bridge.runIfcApply = async () => ({ bytes: new TextEncoder().encode(changed), info: { changed: 1, rows: 1, file: 'testhus.ifc' }, log: [] });
    await recipes.apply(ds.id, 'ifc_apply_table', { table: table.id, key: 'guid' });
    assert.deepEqual((await ifcOps.stepsSinceFetch(ds.id)).steps, ['ifc_apply_table'], 'the step since the fetch');
    await refresh();
    const btn = await waitFor(() => button(), 3000, 'the button');
    assert.equal(btn.getAttribute('label'), t('cde.propose'), 'Föreslå ändringarna');
    assert.ok(btn.getAttribute('variant') !== 'primary' && panel.el.querySelectorAll('dm-button[variant="primary"]').length <= 1, 'not a second primary button');
    assert.equal(tipOf(btn), t('cde.propose.hint'), 'with its tip');
    await panel.propose({ title: 'Brandklass EI90', description: 'Från tabellen.' });
    assert.equal(panel.state.error, '', 'no error');
    assert.ok(world.hits.includes('/documents/1.0/documents/doc-1/versions/2/download') && !world.hits.includes('/elsewhere'), 'the base version fetched from the source\'s own server');
    assert.equal(wheel.seen.length, 1);
    assert.equal(wheel.seen[0].base, world.base, 'the wheel compares the server\'s file of the base version');
    assert.ok(wheel.seen[0].model.includes("IFCLABEL('EI90')") && wheel.seen[0].model.includes("'Vägg X'"), 'with the model\'s file now');
    const topic = JSON.parse(world.sent['/bcf/3.0/projects/p-1/topics'].body);
    assert.equal(topic.title, 'Brandklass EI90'); assert.equal(topic.topic_type, 'Change proposal', 'the project\'s type for proposals');
    assert.deepEqual(topic.bim_snippet, { snippet_type: 'DataregiumIfcChangeSet', is_external: false, reference: 'changes.json', reference_schema: BASE + '/documents/1.0/ifc-changes/schema' }, 'the same snippet as the AI panel\'s');
    const sent = snippet();
    assert.equal(sent.schema, BASE + '/documents/1.0/ifc-changes/schema');
    assert.deepEqual(sent.base, { document_id: 'doc-1', version_index: 2 }, 'the base version the model was fetched as');
    assert.equal(sent.provenance.user, 'Anna', 'the signed-in user');
    assert.equal(sent.provenance.ai_model, null, 'no AI model');
    assert.equal(sent.provenance.tool_call, 'ifc_apply_table', 'how the change was made');
    assert.ok(/^\d{4}-\d\d-\d\dT/.test(sent.provenance.created_at), 'and when');
    assert.deepEqual(sent.changes, [NAME, FIRE], 'the wheel\'s changes as they are');
    assert.equal(Object.keys(sent).sort().join(), 'base,changes,provenance,schema', 'nothing else in the snippet');
    const shown = panel.el.querySelector('[data-ai-proposed]');
    assert.ok(shown && shown.getAttribute('data-ai-proposed') === 't-1' && shown.textContent.includes('Brandklass'), 'the topic shown under the buttons');
    assert.ok(panel.el.querySelector('[data-cde-proposal]').getAttribute('data-cde-proposal') === '2', 'what the proposal carries');
    assert.ok((await datasets.log(ds.id)).some((e) => e.action === 'shared' && JSON.stringify(e.details).includes(t('cde.propose.log', { host: opencde.hostOf(BASE) }))), 'the proposal is in the dataset\'s history');
    // The server's trial and a manager's approval, as in the AI panel.
    await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
    await waitFor(() => panel.el.querySelector('[data-ai-approve-server]'), 3000, 'the approval button');
    await panel.approveOnServer({ confirmed: true });
    assert.equal(panel.state.error, '', 'approved without error');
    const approved = panel.el.querySelector('[data-ai-approved-server]');
    assert.ok(approved && approved.getAttribute('data-ai-approved-server') === '3', 'the new version shown');
    return 'ok';
  }, 60000);

  test('cde propose: what the form cannot express is said at the button, with the way to a new version, and nothing goes', async (assert) => {
    const topics = () => world.hits.filter((p) => p === '/bcf/3.0/projects/p-1/topics').length;
    const before = topics();
    const button3 = t('cde.send.version', { n: '3' });
    const cases = [
      [proposalOf([], { created: 2, relations: 2 }), t('cde.propose.none.created', { n: '2', button: button3 })],
      [proposalOf([], { deleted: 1, relations: 1 }), t('cde.propose.none.unexpressed', { created: '0', deleted: '1', relations: '1', geometry: '0', button: button3 })],
      [proposalOf([], {}), t('cde.propose.none.same', { version: '2' })],
      [proposalOf([NAME], {}, true), t('cde.propose.none.truncated', { n: '1', button: button3 })],
    ];
    for (const [answer, words] of cases) {
      wheel.answer = answer;
      await panel.propose({ title: 'x' });
      const note = panel.el.querySelector('[data-cde-propose-note]');
      assert.ok(note && note.textContent === words, 'told why: ' + (note && note.textContent));
      assert.equal(tipOf(button()), words, 'the button says it too');
    }
    assert.equal(topics(), before, 'no topic was made');
    // A proposal with something only the description can tell: the dialog lists it beside the count, and a cancel sends nothing.
    wheel.answer = proposalOf([NAME], { geometry: 1, relations: 2 });
    const realOpen = overlays.dialog.open; let asked = null;
    overlays.dialog.open = async (spec) => { asked = spec; return false; };
    try { await panel.propose(); } finally { overlays.dialog.open = realOpen; }
    assert.ok(asked && asked.title === t('ai.change.propose.title'), 'the dialog asked for the words');
    const text = asked.body.textContent;
    assert.ok(text.includes(t('ai.change.propose.summary', { n: '1', m: '1' })) && text.includes(t('cde.propose.unexpressed', { created: '0', deleted: '0', relations: '2', geometry: '1' })), 'what goes and what does not: ' + text);
    assert.ok(text.includes(t('op.ifc_apply_table')) && text.includes('Testprojekt'), 'how the change was made and where it goes');
    assert.ok(/** @type {any} */ (asked.body.querySelector('[data-ai-propose-description]')).value.includes(t('cde.propose.unexpressed', { created: '0', deleted: '0', relations: '2', geometry: '1' })), 'the description tells it');
    assert.equal(topics(), before, 'cancelled: nothing sent');
    return 'ok';
  }, 30000);

  test('cde propose: the review takes a value with personal data out of the proposal or keeps it, and a cancel sends nothing', async (assert) => {
    const MAIL = { guid: '0Dataspatium0000000016', attribute: 'Description', op: 'set', old: null, new: 'Kontakt anna.andersson@example.se' };
    wheel.answer = proposalOf([NAME, MAIL], {});
    reviewing.choice = 'drop'; reviewing.shown = [];
    await panel.propose({ title: 'Med e-post' });
    assert.equal(reviewing.shown.length, 1, 'the review was shown'); assert.equal(reviewing.shown[0].n, '1', 'with the one change');
    assert.ok(reviewing.shown[0].text.includes(t('review.changes.note')), 'and why it cannot be pseudonymised');
    assert.deepEqual(snippet().changes, [NAME], 'the change with the e-mail address was taken out');
    reviewing.choice = 'keep';
    await panel.propose({ title: 'Med e-post' });
    assert.deepEqual(snippet().changes, [NAME, MAIL], 'kept when the person keeps it');
    reviewing.choice = 'cancel'; delete world.sent['/bcf/3.0/projects/p-1/topics/t-1/snippet'];
    await panel.propose({ title: 'Med e-post' });
    assert.ok(!world.sent['/bcf/3.0/projects/p-1/topics/t-1/snippet'], 'cancelled: nothing sent');
    // Without personal data no review is shown.
    wheel.answer = proposalOf([NAME], {}); reviewing.shown = [];
    await panel.propose({ title: 'Utan' });
    assert.equal(reviewing.shown.length, 0, 'nothing to decide on');
    reviewing.choice = 'drop';
    return 'ok';
  }, 30000);

  test('cde propose: a collision with a newer version is decided as in the AI panel, and the proposal goes again against the latest', async (assert) => {
    wheel.answer = proposalOf([NAME, FIRE], {});
    world.trials = 0; world.clean = true; world.approve = 'details';
    await panel.propose({ title: 'Krock' });
    await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
    await panel.approveOnServer({ confirmed: true });
    assert.equal(panel.state.error, t('ai.change.approve.server.conflict.choose', { k: '1' }), 'told to choose');
    const row = panel.el.querySelector('[data-ai-conflict="0"]');
    assert.ok(row && row.textContent.includes('EI60') && row.textContent.includes('EI120') && row.textContent.includes('EI90'), 'base, what came between and the proposal: ' + (row && row.textContent));
    await panel.resolveConflicts(['ours']);
    assert.equal(panel.state.error, '', 'sent again');
    const again = snippet();
    assert.equal(again.base.version_index, 4, 'against the latest version');
    assert.deepEqual(again.changes.map((c) => [c.attribute, c.old]), [['Name', 'Vägg 1.1'], ['NominalValue', L('EI120')]], 'the kept change with what came between as its old value');
    assert.equal(again.provenance.tool_call, 'ifc_apply_table', 'the provenance kept');
    world.approve = 'ok';
    return 'ok';
  }, 30000);

  test('cde propose: without the role editor the person is told before anything is computed, and a server without ifc_changes offers no button', async (assert) => {
    wheel.seen = []; world.actions = ['createTopic'];
    await panel.propose({ title: 'x' });
    assert.equal(panel.state.error, t('ai.change.propose.role.none'), 'told about the role');
    assert.equal(wheel.seen.length, 0, 'nothing computed');
    world.actions = ['createTopic', 'createDocument'];
    panel.state.takesChanges = false; panel.render();
    assert.ok(!button() && panel.el.querySelector('[data-cde-send-version]'), 'only the new version');
    // A step before the fetch does not count.
    const meta = await datasets.get(ds.id);
    await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source, { cde: Object.assign({}, meta.source.cde, { fetchedAt: new Date(Date.now() + 1000).toISOString() }) }) });
    assert.deepEqual((await ifcOps.stepsSinceFetch(ds.id)).steps, [], 'fetched after the step');
    return 'ok';
  }, 30000);

  test('cde propose: cleanup', async () => {
    bridge.runIfcProposal = realProposal; bridge.runIfcApply = realApply;
    if (realRequest && http.request === spyRequest) http.request = realRequest;
    if (panel) { panel.destroy(); panel.el.remove(); }
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const d of [ds, table]) if (d) await datasets.remove(d.id).catch(() => {});
    return 'ok';
  });
})();
