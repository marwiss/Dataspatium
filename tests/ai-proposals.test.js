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
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const hits = []; let approveAnswer = 'ok';
  const rows = [
    { topic_guid: 't-2', title: 'Brandklass EI90', description: 'Dörrarna på plan 2', state: 'clean', base_version_index: 4, change_count: 3, author: 'bo', checked_at: '2026-11-11T20:00:00Z', proposal_url: CDE + '/bcf/3.0/projects/p-1/topics/t-2/ifc-proposal', approve_url: CDE + '/bcf/3.0/projects/p-1/topics/t-2/ifc-proposal/approve' },
    { topic_guid: 't-1', title: 'Nya fönster', state: 'approved', base_version_index: 3, change_count: 12, author: 'anna', checked_at: '2026-11-10T09:00:00Z', version_index: 4, proposal_url: CDE + '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal', approve_url: CDE + '/bcf/3.0/projects/p-1/topics/t-1/ifc-proposal/approve' },
  ];
  /** A virtual Dataregium: with the list's template in its capability, or without it. */
  function server(base, withList) {
    return (url) => {
      const rest = url.startsWith(base) ? url.slice(base.length) : new URL(url).pathname;
      const path = rest.split('?')[0];
      hits.push(path);
      if (path === '/.well-known/dataregium') {
        const changes = { enabled: true, schema: '/documents/1.0/ifc-changes/schema', proposal_url: base + '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal', approve_url: base + '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/approve' };
        if (withList) changes.ifc_proposals_url = base + '/documents/1.0/documents/{document_id}/ifc-proposals';
        return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, extensions: { ifc_changes: changes } }));
      }
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: base + '/foundation/oauth2/auth', oauth2_token_url: base + '/foundation/oauth2/token' }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
      if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'anna', name: 'Anna' }));
      if (path === '/documents/1.0/documents/doc-1/ifc-proposals') return Promise.resolve(json(rows));
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

  test('proposals: cleanup', async (assert) => {
    if (ds) await datasets.remove(ds.id).catch(() => {});
    for (const c of [connector, bare]) { if (c) { await opencde.logout(c).catch(() => {}); await connectors.remove(c.id).catch(() => {}); } }
    D.net.unvirtual('tests/ai-proposals-cde/'); D.net.unvirtual('tests/ai-proposals-bare/');
    assert.ok(true);
  });
})();
