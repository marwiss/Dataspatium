// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Dataregium's phase 5.5 and its whole-file proposals (F204 a there, F124 a here) against a virtual Dataregium (no network):
 * the document's history as pages with the server's count and next page, a version's commit with its trailers, the diff of two
 * sides; Jämför versioner with the history to choose from and the old way without the capabilities; the version's commit on the CDE
 * card; Dela's conflict branch compared with the latest version and told gone after its time; a whole file as the topic's own snippet
 * with the base and the provenance in the query, refused before it goes when it is too large or not STEP; Föreslå ändringarna sending
 * the whole file through the review when the change set cannot carry it, tried and approved as a change set; the proposals card showing
 * a whole file as its diff against the base; and step 7, the mirror at a forge, whose token goes once to the server and nowhere else.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const i18n = D.require('ui/i18n');
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const basic = D.require('ui/basic');
  const overlays = D.require('ui/overlays');
  const opencde = D.require('api/families/opencde');
  const manage = D.require('api/families/opencde-manage');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const cdeLog = D.require('api/cde-log');
  const http = D.require('api/http');
  const { bridge } = D.require('data/python-bridge');
  const BASE = 'dataspatium-asset://tests/cde-history';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const MIB = 1024 * 1024;
  const hex = (n) => (n.toString(16).padStart(8, '0') + 'a'.repeat(32)).slice(0, 40);
  const CONFLICT = hex(0xc0ff1c7);
  const FILECOMMIT = hex(0xf11e);
  const WALL = '0Dataspatium0000000011';
  const json = (data, status, headers) => Object.assign({ kind: 'text', data: JSON.stringify(data) }, status ? { status } : {}, headers ? { headers } : {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(25); }
  }
  /** The history: 130 commits, newest first; the second is a conflict that has expired, the fifth this version (2). */
  const HISTORY = Array.from({ length: 130 }, (_, i) => {
    if (i === 0) return { commit: hex(1000), parents: [hex(1001)], kind: 'version', version_index: 3, base_version_index: 2, author: 'anna', date: '2026-11-27T10:00:00Z', subject: 'Nya fönster' };
    if (i === 1) return { commit: CONFLICT, parents: [hex(1000)], kind: 'conflict', merged_with_version_index: 3, expires_at: '2026-11-01T00:00:00Z', author: 'bo', date: '2026-11-26T10:00:00Z', subject: 'Upload that did not merge' };
    if (i === 2) return { commit: FILECOMMIT, parents: [hex(1004)], kind: 'proposal', base_version_index: 2, proposal_url: BASE + '/bcf/3.0/projects/p-h/topics/t-f/ifc-proposal', author: 'anna', date: '2026-11-25T10:00:00Z', subject: 'Change set t-f' };
    if (i === 3) return { commit: hex(1003), parents: [hex(1004)], kind: 'upload', version_index: 3, author: 'anna', date: '2026-11-24T10:00:00Z', subject: 'Upload' };
    if (i === 4) return { commit: hex(1004), parents: [hex(1005)], kind: 'version', version_index: 2, author: 'anna', date: '2026-11-23T10:00:00Z', subject: 'Version 2' };
    if (i === 5) return { commit: 'not a commit', parents: [], kind: 'version', author: 'x', date: '', subject: '' };
    return { commit: hex(1000 + i), parents: [], kind: 'upload', version_index: 1, author: 'anna', date: '2026-11-01T10:00:00Z', subject: 'Old ' + i };
  });
  const COMMIT2 = { commit: hex(1004), parents: [hex(1005), FILECOMMIT], author: 'anna', committer: 'bo', date: '2026-11-23T10:00:00Z',
    message: 'Change set t-f\n\nThe whole file from the AI.\n\nDataregium-Base: 1\nDataregium-Proposal: p-5\nDataregium-Topic: t-f', base_version_index: 1, proposal_commit: FILECOMMIT };
  const DIFF = { by: 'guid', added: [{ guid: '0NewSlab00000000000000', type: 'IfcSlab', name: 'Ny platta', storey: 'Plan 1' }], removed: [], changed: [{ guid: WALL, type: 'IfcWall', name: 'Vägg 1.1', storey: 'Plan 1', attributes: [{ path: 'Name', old: 'Vägg 1.1', new: 'Vägg X' }] }], same: 6, truncated: false };
  /** What the virtual server answers, set by each test, and what it was asked. */
  const W = { git: true, files: true, maxUpload: 0, requests: [], sides: [], gone: new Set(), snippetStatus: 200, trials: 0, approve: 'ok', completion: null, remote: null, base: fixtures.ifcText({ walls: 2 }) };
  const lastOf = (url) => W.requests.slice().reverse().find((r) => String(r.url) === url) || {};
  const bodyOf = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : null; } catch (_e) { return null; } };
  D.net.virtual('tests/cde-history/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0];
    const q = new URL(url).searchParams;
    const req = lastOf(url);
    const method = String(req.method || 'GET').toUpperCase();
    if (path === '/.well-known/dataregium') {
      const extensions = {
        project_administration: { enabled: true, url: '/manage/1.0/projects', scope: 'project', roles: ['viewer', 'contributor', 'editor', 'manager'] },
        ifc_changes: Object.assign({ enabled: true, schema: '/documents/1.0/ifc-changes/schema', snippet_type: 'DataregiumIfcChangeSet', max_changes: 10000, tried: true, proposal_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal', approve_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/approve', ifc_proposals_url: '/documents/1.0/documents/{document_id}/ifc-proposals' }, W.files ? { file_snippet_type: 'DataregiumIfcFile', proposal_file_url: '/bcf/3.0/projects/{project_id}/topics/{topic_guid}/ifc-proposal/file' } : {}),
        ifc_diff: Object.assign({ enabled: true, url: '/documents/1.0/documents/{document_id}/versions/{version_index}/ifc-diff/{other_index}' }, W.git ? { sides_url: '/documents/1.0/documents/{document_id}/ifc-diff?a={a}&b={b}' } : {}),
        git: W.git ? { enabled: true, ifcmerge: true, max_message: 2000, history_url: '/documents/1.0/documents/{document_id}/history', commit_url: '/documents/1.0/documents/{document_id}/versions/{version_index}/commit', remote: { enabled: true, url: '/manage/1.0/projects/{project_id}/remote', hosts: ['github.com'] } } : { enabled: true, max_message: 2000 },
      };
      return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, scopes: ['profile', 'bcf', 'documents', 'project'], extensions, limits: { max_upload_bytes: W.maxUpload } }));
    }
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'h-token', refresh_token: 'h-refresh', expires_in: 3600, scope: 'profile bcf documents project' }));
    if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'anna', name: 'Anna' }));
    if (path === '/bcf/3.0/projects') return Promise.resolve(json([{ project_id: 'p-h', name: 'Historik' }]));
    if (path === '/bcf/3.0/projects/p-h') return Promise.resolve(json({ project_id: 'p-h', name: 'Historik', authorization: { project_actions: ['createTopic', 'createDocument'] } }));
    if (path === '/bcf/3.0/projects/p-h/extensions') return Promise.resolve(json({ topic_type: ['Issue', 'Change proposal'], topic_status: ['Open'] }));
    if (path === '/bcf/3.0/projects/p-h/topics') return Promise.resolve(json({ guid: 't-f', title: 'x' }, 201));
    if (path === '/bcf/3.0/projects/p-h/topics/t-f') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/bcf/3.0/projects/p-h/topics/t-f/snippet') return Promise.resolve(W.snippetStatus === 200 ? { kind: 'text', data: '' } : json({ message: 'The snippet is not an IFC file in STEP', code: 'validation_error' }, W.snippetStatus));
    if (path === '/bcf/3.0/projects/p-h/topics/t-f/ifc-proposal') { W.trials++; return Promise.resolve(json(W.trials < 2 ? { state: 'queued', kind: 'file' } : { state: 'clean', kind: 'file', commit: FILECOMMIT, base: { document_id: 'doc-h', version_index: 2 }, created_at: '2026-11-28T01:00:00Z', issue_count: 0, error_count: 0, checks: [], issues: [] })); }
    if (path === '/bcf/3.0/projects/p-h/topics/t-f/ifc-proposal/approve') {
      if (W.approve === 'details') return Promise.resolve(json({ message: 'The document has 1 newer version and the file collides with what came between', code: 'version_conflict', conflicts: ['#1062.NominalValue'], conflict_details: [{ key: '#1062.NominalValue', step_id: 1062, attribute: 'NominalValue', op: 'set', base: { type: 'IfcLabel', value: 'EI60' }, theirs: { type: 'IfcLabel', value: 'EI120' }, ours: { type: 'IfcLabel', value: 'EI90' }, version_index: 3, change_index: null }], merge: { base_version_index: 2, latest_version_index: 3 } }, 412));
      return Promise.resolve(json({ document_id: 'doc-h', version_index: 4, version_number: '4', title: 'Hus' }, 201));
    }
    if (path === '/documents/1.0/documents/doc-h/ifc-proposals') return Promise.resolve(json([{ topic_guid: 't-f', title: 'Hela huset', description: null, state: 'clean', base_version_index: 2, change_count: null, author: 'anna', checked_at: '2026-11-28T01:00:00Z', version_index: null, proposal_url: BASE + '/bcf/3.0/projects/p-h/topics/t-f/ifc-proposal', approve_url: BASE + '/bcf/3.0/projects/p-h/topics/t-f/ifc-proposal/approve' }]));
    if (path === '/documents/1.0/documents/doc-h/history') {
      const top = Number(q.get('$top')) || 100; const skip = Number(q.get('$skip')) || 0;
      const page = HISTORY.slice(skip, skip + top);
      const more = skip + top < HISTORY.length;
      const next = new URL(url); next.searchParams.set('$skip', String(skip + top));
      return Promise.resolve(json(page, 200, more ? { 'X-Total-Count': String(HISTORY.length), Link: `<${next.href}>; rel="next"` } : null));
    }
    if (path === '/documents/1.0/documents/doc-h/versions/2/commit') return Promise.resolve(json(COMMIT2));
    if (path === '/documents/1.0/documents/doc-h/ifc-diff') {
      W.sides.push({ a: q.get('a'), b: q.get('b') });
      if (W.gone.has(q.get('a')) || W.gone.has(q.get('b'))) return Promise.resolve(json({ message: 'Not Found', code: 'not_found' }, 404));
      return Promise.resolve(json(Object.assign({ a: { document_id: 'doc-h' }, b: { document_id: 'doc-h' } }, DIFF)));
    }
    if (path === '/documents/1.0/documents/doc-h/versions/2/ifc-diff/1') return Promise.resolve(json(DIFF));
    if (path === '/documents/1.0/document-versions') return Promise.resolve(json({ versions: [1, 2, 3].map((n) => ({ document_id: 'doc-h', version_index: n, version_number: String(n) })) }));
    if (/^\/documents\/1\.0\/documents\/doc-h\/versions\/\d+\/metadata$/.test(path)) return Promise.resolve(json({ metadata: [] }));
    if (path === '/documents/1.0/documents/doc-h/versions/2/download') return Promise.resolve({ kind: 'text', data: W.base });
    if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: BASE + '/ui', expires_in: 600, max_size_in_bytes: 0 }));
    if (path === '/documents/1.0/upload-instructions') return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: BASE + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 99999 }], upload_completion: { url: BASE + '/complete' } }] }));
    if (path === '/part') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/complete') return Promise.resolve({ kind: 'text', data: '   ' + JSON.stringify(W.completion) });
    if (path === '/manage/1.0/projects') return Promise.resolve(json([{ project_id: 'p-h', name: 'Historik' }]));
    if (path === '/manage/1.0/projects/p-h/members') return Promise.resolve(json([{ user_id: 'u1', username: 'anna', name: 'Anna', role: 'manager' }]));
    if (path === '/manage/1.0/projects/p-h/remote') {
      if (method === 'PUT') { const b = bodyOf(req) || {}; W.remote = { url: b.url, max_file_bytes: b.max_file_bytes || 100 * MIB, connected_at: '2026-11-28T02:00:00Z', expires_at: b.expires_at || '2027-11-28T02:00:00Z', status: 'waiting', error: null, pushed_at: null, pushed: [], left_out: [] }; return Promise.resolve(json(W.remote)); }
      if (method === 'DELETE') { W.remote = null; return Promise.resolve({ kind: 'text', data: '' }); }
      return Promise.resolve(W.remote ? json(W.remote) : json({ message: 'The project is not mirrored to a forge', code: 'not_found' }, 404));
    }
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  /** What http.request was when the spy went in (other test files wrap it as they load), restored at the cleanup. */
  let realRequest = null;
  const spyRequest = (req) => { if (String(req.url).startsWith(BASE)) W.requests.push(req); return realRequest(req); };
  const popup = (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`);
  let connector = null; let model = null; let table = null;
  const created = [];
  const cdeOf = (versionIndex, extra) => Object.assign({ connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-h', projectName: 'Historik', kind: 'document', documentId: 'doc-h', versionIndex, reference: BASE + '/x' }, extra || {});
  async function setUp() {
    if (connector) return;
    realRequest = http.request; http.request = spyRequest;
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-cde-history', clientSecret: '' })).connector;
    await opencde.login(connector, { popup, redirectUri: REDIRECT });
    model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Historikhus');
    created.push(model.id);
    await datasets.updateMeta(model.id, { source: Object.assign({}, (await datasets.get(model.id)).source || { kind: 'file' }, { cde: cdeOf(2) }) });
    model = await datasets.get(model.id);
  }
  const fresh = () => opencde.capabilities(connector, { force: true });

  test('cde history: the history comes as pages with the server\'s count and next page, a version\'s commit with its trailers, and the diff of two sides', async (assert) => {
    await setUp();
    W.git = true; await fresh();
    const first = await opencde.history(connector, 'doc-h');
    const asked = new URL(W.requests.filter((r) => /\/history\?/.test(r.url)).pop().url);
    assert.equal(asked.href.split('?')[0], BASE + '/documents/1.0/documents/doc-h/history', 'the template\'s path');
    assert.equal(asked.searchParams.get('$top'), '100'); assert.equal(asked.searchParams.get('$skip'), '0');
    assert.equal(first.entries.length, 99, 'a page of a hundred, without the one that is not a commit');
    assert.equal(first.total, 130, 'X-Total-Count'); assert.equal(first.more, true, 'Link rel="next"');
    assert.deepEqual([first.entries[0].kind, first.entries[0].versionIndex, first.entries[0].baseVersionIndex], ['version', 3, 2], 'a version in the app\'s form');
    assert.deepEqual([first.entries[1].kind, first.entries[1].mergedWith, first.entries[1].expiresAt], ['conflict', 3, '2026-11-01T00:00:00Z'], 'a conflict with its time');
    assert.ok(opencde.expired(first.entries[1].expiresAt) && !opencde.expired('2999-01-01T00:00:00Z') && !opencde.expired(null), 'past its time or not');
    assert.equal(first.entries[2].author, 'anna', 'the author is a user name');
    const second = await opencde.history(connector, 'doc-h', { skip: 100 });
    assert.equal(second.entries.length, 30); assert.equal(second.more, false, 'the last page names no next');
    assert.equal(second.total, null, 'and the server does not count it');
    await opencde.history(connector, 'doc-h', { top: 9999 });
    assert.equal(new URL(W.requests.filter((r) => /\/history\?/.test(r.url)).pop().url).searchParams.get('$top'), '500', 'at most 500 a page');
    const commit = await opencde.versionCommit(connector, 'doc-h', 2);
    assert.equal(commit.commit, hex(1004)); assert.equal(commit.committer, 'bo'); assert.equal(commit.subject, 'Change set t-f');
    assert.deepEqual(commit.trailers, [{ name: 'Dataregium-Base', value: '1' }, { name: 'Dataregium-Proposal', value: 'p-5' }, { name: 'Dataregium-Topic', value: 't-f' }], 'the trailers of the last paragraph');
    assert.equal(commit.proposalCommit, FILECOMMIT); assert.equal(commit.sideCommit, null); assert.equal(commit.baseVersionIndex, 1);
    assert.equal(await opencde.versionCommit(connector, 'doc-h', 1), null, 'a version without a commit (404)');
    assert.deepEqual(opencde.trailersOf('Only a subject'), [], 'no trailers in a message of one paragraph');
    const diff = await opencde.sidesDiff(connector, 'doc-h', 2, FILECOMMIT);
    assert.deepEqual(W.sides[W.sides.length - 1], { a: '2', b: FILECOMMIT }, 'the two sides in the query');
    assert.equal(diff.added.length, 1);
    assert.ok(!W.requests.some((r) => !String(r.url).startsWith(BASE)), 'every request went to the source\'s own server');
    W.git = false; await fresh();
    assert.equal(await opencde.history(connector, 'doc-h'), null, 'without the capability: no history');
    assert.equal(await opencde.versionCommit(connector, 'doc-h', 2), null, 'no commit');
    assert.equal(await opencde.sidesDiff(connector, 'doc-h', 2, 3), null, 'no sides');
    W.git = true; await fresh();
    return 'ok';
  }, 30000);

  test('cde history: Jämför versioner gives the history as pages to choose from, compares through the sides, and keeps the old way without the capabilities', async (assert) => {
    await setUp();
    const panel = D.require('ui/bearbeta/model-compare').create({ shell: { log() {} } }, model, { preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.el.querySelector('[data-compare-server-versions]'), 3000, 'the versions button');
      await panel.loadServerVersions();
      assert.equal(panel.state.serverError, '', 'the history came');
      assert.equal(panel.state.history.count, 99);
      const server = panel.state.choices.filter((c) => c.server);
      assert.equal(server.length, 98, 'every point but this version');
      assert.equal(panel.state.choice, 'server:' + hex(1000), 'the newest chosen');
      assert.ok(server[0].label.includes('Nya fönster') && server[0].label.includes('anna'), 'in words: ' + server[0].label);
      const page = panel.el.querySelector('[data-compare-history-page]');
      assert.ok(page && page.textContent === t('compare.history.page', { page: '1', pages: '2' }), 'where in the history: ' + (page && page.textContent));
      await panel.run();
      assert.equal(panel.state.error, '');
      assert.deepEqual(W.sides[W.sides.length - 1], { a: '2', b: '3' }, 'this version against a version by its index');
      assert.ok(panel.el.querySelector('[data-compare-counts]').textContent.includes(server[0].label), 'the counts name the point');
      assert.equal(panel.state.result.changed[0].id > 0, true, 'the changed wall found here by its GlobalId');
      // A proposal's trial by its commit, and a conflict whose branch the server took away.
      panel.state.choice = 'server:' + FILECOMMIT;
      await panel.run();
      assert.deepEqual(W.sides[W.sides.length - 1], { a: '2', b: FILECOMMIT }, 'a commit as the other side');
      const conflict = server.find((c) => c.server === CONFLICT);
      assert.ok(conflict.label === t('compare.history.conflict.gone', { n: '3', date: i18n.formatDateTime('2026-11-26T10:00:00Z'), author: 'bo', subject: 'Upload that did not merge', expires: i18n.formatDateTime('2026-11-01T00:00:00Z') }), 'the conflict told gone: ' + conflict.label);
      W.gone.add(CONFLICT);
      panel.state.choice = 'server:' + CONFLICT;
      await panel.run();
      assert.equal(panel.state.error, t('compare.conflict.expired', { date: i18n.formatDateTime('2026-11-01T00:00:00Z') }), 'a 404 after its time in words');
      // The next page, and back.
      await panel.pageHistory(1);
      assert.equal(new URL(W.requests.filter((r) => /\/history\?/.test(r.url)).pop().url).searchParams.get('$skip'), '100', 'the older page');
      assert.equal(panel.state.history.count, 30);
      assert.equal(panel.el.querySelector('[data-compare-history-page]').textContent, t('compare.history.page', { page: '2', pages: '2' }), 'the last page keeps the count');
      assert.ok(/** @type {any} */ (panel.el.querySelector('[data-compare-history-older]')).disabled && !(/** @type {any} */ (panel.el.querySelector('[data-compare-history-newer]')).disabled), 'older off, newer on');
      await panel.pageHistory(-1);
      assert.equal(panel.state.history.skip, 0);
    } finally { panel.destroy(); panel.el.remove(); W.gone.clear(); }
    // Without the capabilities: the document's versions and the diff between versions, as before.
    W.git = false; await fresh();
    const old = D.require('ui/bearbeta/model-compare').create({ shell: { log() {} } }, model, { preview: () => {} });
    document.body.appendChild(old.el);
    try {
      await old.loadServerVersions();
      assert.deepEqual(old.state.choices.filter((c) => c.server).map((c) => c.server), [3, 1], 'the versions, newest first');
      assert.equal(old.state.history, null, 'no history');
      old.state.choice = 'server:1';
      const before = W.sides.length;
      await old.run();
      assert.equal(old.state.error, ''); assert.equal(W.sides.length, before, 'the old diff, not the sides');
    } finally { old.destroy(); old.el.remove(); W.git = true; await fresh(); }
    return 'ok';
  }, 30000);

  test('cde history: the CDE card shows the version\'s commit with its message, who committed it, its base and its trailers', async (assert) => {
    await setUp();
    const ui = Object.assign({ button: basic.button }, overlays);
    const card = D.require('ui/kinds/insight-cards').cdeCard({ ui, store: { set: () => {} }, shell: { log: () => {}, activate: () => {} } }, model);
    document.body.appendChild(card);
    try {
      /** @type {HTMLElement} */ (card.querySelector('[data-cde-check]')).click();
      const part = await waitFor(() => card.querySelector('[data-cde-commit]'), 5000, 'the commit');
      assert.equal(part.getAttribute('data-cde-commit'), hex(1004));
      const text = part.textContent;
      assert.ok(text.includes(t('cde.commit.title', { commit: hex(1004).slice(0, 12) })) && text.includes('Change set t-f') && text.includes('bo'), 'the subject and the committer: ' + text);
      assert.ok(text.includes(FILECOMMIT.slice(0, 12)) && !text.includes(FILECOMMIT), 'the proposal\'s trial in brief');
      const trailers = part.querySelector('[data-cde-commit-trailers]');
      assert.ok(trailers && trailers.getAttribute('data-cde-commit-trailers') === '3' && trailers.textContent.includes('Proposal: p-5'), 'the trailers without the prefix: ' + (trailers && trailers.textContent));
      assert.ok(card.textContent.includes(t('cde.git.commit')) && card.textContent.includes(hex(1004).slice(0, 12)), 'and the commit in the facts');
    } finally { card.remove(); }
    return 'ok';
  }, 30000);

  test('cde history: Dela compares the conflict branch with the latest version in 3D, and says when the branch is gone', async (assert) => {
    await setUp();
    // A table never has a branch to draw: ifcmerge merges models, and only a model is drawn in 3D.
    table = await datasets.create({ name: 'Konflikttabell', columns: [{ name: 'a', type: 'integer' }], rows: [[1], [2]] });
    created.push(table.id);
    await datasets.updateMeta(table.id, { source: { kind: 'file', fileName: 'tabell.csv', cde: cdeOf(1) } });
    let current = await datasets.get(model.id);
    const stored = []; const activated = [];
    const ctx = { ui: { button: basic.button, toast: overlays.toast, dialog: { open: async () => true, confirm: async () => true } }, shell: { log() {}, activate: (m) => activated.push(m) },
      services: { exporter: D.require('io/export'), files: D.require('platform/files') }, store: { get: () => ({ datasets: [] }), set: (v) => stored.push(v) } };
    const cdeSend = D.require('ui/share/cde-send');
    cdeSend.setPopup(() => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(BASE + '/documents/1.0/upload-instructions')}`), REDIRECT);
    const panel = cdeSend.create(ctx, { dataset: () => current });
    document.body.appendChild(panel.el);
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    try {
      panel.state.connectors = [connector]; panel.state.connector = connector; panel.render();
      W.completion = { message: 'The upload collides with version 3', code: 'version_conflict', conflicts: ['#1012.Name'], conflict_details: [{ key: '#1012.Name', step_id: 1012, attribute: 'Name', op: 'set', base: 'A', theirs: 'B', ours: 'C', version_index: 3 }], merge: { base_version_index: 1, latest_version_index: 3 }, conflict_commit: CONFLICT.toUpperCase(), conflict_expires_at: future };
      await panel.send({ asVersionOf: 'doc-h' });
      const c = panel.state.conflict;
      assert.ok(c && c.commit === CONFLICT && c.expiresAt === future, 'the branch and its time from the 412: ' + JSON.stringify(c));
      const branch = panel.el.querySelector('[data-cde-conflict-branch]');
      assert.ok(branch && branch.textContent.includes(t('cde.send.conflict.kept', { date: i18n.formatDateTime(future), commit: CONFLICT.slice(0, 12) })), 'kept until when: ' + (branch && branch.textContent));
      const before = W.sides.length;
      await panel.compareBranch();
      assert.deepEqual(W.sides.slice(before), [{ a: CONFLICT, b: '3' }], 'the branch against the latest version through the sides');
      const handed = stored.find((v) => v.openModelCompare);
      assert.ok(handed && handed.selectedId === model.id && handed.openModelCompare.datasetId === model.id && handed.openModelCompare.conflict.commit === CONFLICT && handed.openModelCompare.conflict.latest === 3 && handed.openModelCompare.conflict.diff, 'handed to Jämför versioner with the diff');
      assert.deepEqual(activated, ['bearbeta'], 'in Bearbeta, where the model is drawn');
      // Jämför versioner opens on it without asking again, and colours what differs.
      const previews = [];
      const compare = D.require('ui/bearbeta/model-compare').create({ shell: { log() {} } }, model, { preview: (p) => { previews.push(p); }, conflict: handed.openModelCompare.conflict });
      await compare.ready;
      assert.equal(compare.state.error, '');
      assert.equal(compare.state.choice, 'server:' + CONFLICT, 'the branch chosen');
      assert.ok(compare.state.result && compare.state.result.counts.changed === 1 && compare.state.result.counts.onlyThere === 1, 'the diff shown');
      assert.equal(W.sides.length, before + 1, 'from the answer Dela had');
      assert.ok(previews[0] && previews[0].colors.length >= 1, 'coloured in 3D');
      compare.destroy();
      // The server took the branch away (404): Dela says so.
      W.gone.add(CONFLICT);
      await panel.compareBranch();
      const gone = panel.el.querySelector('[data-cde-conflict-gone]');
      assert.ok(gone && gone.textContent === t('cde.send.conflict.gone', { date: i18n.formatDateTime(future) }), 'told gone: ' + (gone && gone.textContent));
      assert.ok(!panel.el.querySelector('[data-cde-conflict-compare]'), 'and nothing to compare');
      // Past its time, nothing is asked.
      panel.state.conflict.gone = false; panel.state.conflict.expiresAt = '2026-01-01T00:00:00Z'; panel.render();
      const asked = W.sides.length;
      await panel.compareBranch();
      assert.equal(W.sides.length, asked, 'no request after the time');
      assert.ok(panel.el.querySelector('[data-cde-conflict-gone]'), 'gone by its time');
      // Jämför versioner on a branch that is gone says so in words.
      const late = D.require('ui/bearbeta/model-compare').create({ shell: { log() {} } }, model, { preview: () => {}, conflict: { commit: CONFLICT, latest: 3, expiresAt: future } });
      await late.ready;
      assert.equal(late.state.error, t('compare.conflict.expired', { date: i18n.formatDateTime(future) }));
      late.destroy();
      // The same conflict on a table: told, but nothing to draw.
      current = await datasets.get(table.id);
      panel.state.conflict.gone = false; panel.state.conflict.expiresAt = future; panel.render();
      assert.ok(panel.el.querySelector('[data-cde-conflict-branch]') && !panel.el.querySelector('[data-cde-conflict-compare]'), 'no 3D for a table');
    } finally { cdeSend.setPopup(null); panel.destroy(); panel.el.remove(); W.gone.clear(); }
    current = null;
    return 'ok';
  }, 60000);

  test('cde history: a whole file goes as the topic\'s own snippet with the base and the provenance in the query, refused before it goes when too large or not STEP', async (assert) => {
    await setUp();
    W.maxUpload = 0; W.files = true; W.snippetStatus = 200; await fresh();
    assert.equal(await opencde.takesFiles(connector), true);
    const bytes = new TextEncoder().encode(W.base);
    const before = W.requests.length;
    const out = await opencde.proposeFile(connector, 'p-h', { title: 'Hela huset', description: 'Nya väggar', topicType: 'Change proposal', bytes, fileName: 'hus.ifc', base: { document_id: 'doc-h', version_index: 2 }, aiModel: 'claude\u0007-opus', toolCall: 'x'.repeat(300) });
    const mine = W.requests.slice(before);
    const topic = bodyOf(mine.find((r) => /\/topics$/.test(r.url) && r.method === 'POST'));
    assert.deepEqual(topic.bim_snippet, { snippet_type: 'DataregiumIfcFile', is_external: false, reference: 'hus.ifc', reference_schema: 'https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/' }, 'the topic\'s own file');
    assert.equal(topic.topic_type, 'Change proposal');
    const put = mine.find((r) => /\/topics\/t-f\/snippet\?/.test(r.url));
    assert.ok(put && put.method === 'PUT', 'PUT …/snippet');
    const q = new URL(put.url).searchParams;
    assert.deepEqual([q.get('base_document_id'), q.get('base_version_index')], ['doc-h', '2'], 'the base in the query');
    assert.equal(q.get('ai_model'), 'claude-opus', 'without control characters');
    assert.equal(q.get('tool_call').length, 200, 'at most 200 characters');
    assert.ok(!q.has('user') && !q.has('created_at'), 'the server sets the user and the time');
    assert.equal(put.headers['Content-Type'], 'application/octet-stream');
    assert.ok(/filename="hus\.ifc"/.test(put.headers['Content-Disposition']), put.headers['Content-Disposition']);
    assert.equal(put.body.byteLength, bytes.byteLength, 'the file\'s bytes as the body');
    assert.ok(String(put.headers.Authorization).startsWith('Bearer ') && mine.every((r) => String(r.url).startsWith(BASE)), 'the token to the source\'s own server only');
    assert.deepEqual([out.kind, out.tried, out.fileName], ['file', true, 'hus.ifc']);
    // Too large, and not STEP: refused before anything goes.
    W.maxUpload = 100; await fresh();
    let at = W.requests.length;
    const large = await opencde.proposeFile(connector, 'p-h', { title: 'x', bytes, base: { document_id: 'doc-h', version_index: 2 } }).catch((e) => e);
    assert.ok(large instanceof Error && large.message === t('cde.err.toolarge', { max: i18n.formatBytes(100) }), 'larger than the server takes: ' + large);
    assert.ok(!W.requests.slice(at).some((r) => /\/topics/.test(r.url)), 'no topic made');
    W.maxUpload = 0; await fresh();
    const notStep = await opencde.proposeFile(connector, 'p-h', { title: 'x', bytes: new TextEncoder().encode('{"a": 1}'), base: { document_id: 'doc-h', version_index: 2 } }).catch((e) => e);
    assert.ok(notStep instanceof Error && notStep.message === t('opencde.err.file.step'), 'not STEP');
    // A refused upload takes the topic away again.
    W.snippetStatus = 400; at = W.requests.length;
    const refused = await opencde.proposeFile(connector, 'p-h', { title: 'x', bytes, base: { document_id: 'doc-h', version_index: 2 } }).catch((e) => e);
    assert.ok(refused instanceof Error && refused.status === 400, 'the server\'s refusal');
    assert.ok(W.requests.slice(at).some((r) => /\/topics\/t-f$/.test(r.url) && r.method === 'DELETE'), 'the topic removed');
    W.snippetStatus = 200;
    W.files = false; await fresh();
    assert.equal(await opencde.proposeFile(connector, 'p-h', { title: 'x', bytes, base: { document_id: 'doc-h', version_index: 2 } }), null, 'a server without whole files');
    assert.equal(await opencde.takesFiles(connector), false);
    W.files = true; await fresh();
    return 'ok';
  }, 30000);

  test('cde history: Föreslå ändringarna sends the whole file through the review when the change set cannot carry it, tried and approved as a change set', async (assert) => {
    await setUp();
    const realProposal = bridge.runIfcProposal; const realApply = bridge.runIfcApply;
    const reviewMod = D.require('ui/share/review'); const realReview = reviewMod.review;
    const reviewed = [];
    reviewMod.review = async (ctx, ids, options) => { reviewed.push(ids.slice()); return realReview(ctx, ids, options); };
    const ds = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Hel fil');
    created.push(ds.id);
    await datasets.updateMeta(ds.id, { source: Object.assign({}, (await datasets.get(ds.id)).source || { kind: 'file' }, { cde: cdeOf(2, { fetchedAt: new Date().toISOString() }) }) });
    const tableIn = await datasets.create({ name: 'Väggnamn', columns: [{ name: 'guid', type: 'text' }, { name: 'namn', type: 'text' }], rows: [[WALL, 'Vägg X']] });
    created.push(tableIn.id);
    let current = await datasets.get(ds.id);
    const ctx = { ui: { button: basic.button, toast: overlays.toast, dialog: { open: async () => true, confirm: async () => true } }, shell: { log() {} },
      services: { exporter: D.require('io/export'), files: D.require('platform/files') }, store: { get: () => ({ datasets: [] }), set: () => {} } };
    const panel = D.require('ui/share/cde-send').create(ctx, { dataset: () => current });
    document.body.appendChild(panel.el);
    try {
      await wait(5);
      const changed = W.base.replace("'Vägg 1.1'", "'Vägg X'");
      bridge.runIfcApply = async () => ({ bytes: new TextEncoder().encode(changed), info: { changed: 1, rows: 1, file: 'testhus.ifc' }, log: [] });
      await recipes.apply(ds.id, 'ifc_apply_table', { table: tableIn.id, key: 'guid' });
      await datasets.save(ds.id); current = await datasets.get(ds.id);
      bridge.runIfcProposal = async () => ({ changes: [{ guid: WALL, attribute: 'Name', op: 'set', old: 'Vägg 1.1', new: 'Vägg X' }], truncated: false, instances: 1, unexpressed: { created: 2, deleted: 1, relations: 3, geometry: 0 } });
      panel.state.connectors = [connector]; panel.state.connector = connector;
      panel.state.takesChanges = await opencde.takesChanges(connector);
      panel.state.takesFiles = await opencde.takesFiles(connector);
      panel.render();
      await waitFor(() => panel.el.querySelector('[data-cde-propose]'), 5000, 'the button');
      const before = W.requests.length;
      W.trials = 0; W.approve = 'ok';
      await panel.propose({ title: 'Hela huset', description: 'Nya väggar och en borttagen' });
      assert.equal(panel.state.error, '', 'no error');
      assert.ok(reviewed.some((ids) => ids.includes(ds.id)), 'the file went through the review');
      const mine = W.requests.slice(before);
      const topic = bodyOf(mine.find((r) => /\/topics$/.test(r.url) && r.method === 'POST'));
      assert.equal(topic.bim_snippet.snippet_type, 'DataregiumIfcFile', 'a whole file, not a change set');
      assert.ok(/\.ifc$/.test(topic.bim_snippet.reference), topic.bim_snippet.reference);
      const put = mine.find((r) => /\/topics\/t-f\/snippet\?/.test(r.url));
      const q = new URL(put.url).searchParams;
      assert.deepEqual([q.get('base_document_id'), q.get('base_version_index'), q.get('tool_call')], ['doc-h', '2', 'ifc_apply_table'], 'the base and how it was made');
      assert.ok(!q.has('ai_model'), 'no AI model');
      assert.ok(new TextDecoder().decode(put.body).startsWith('ISO-10303-21;') && new TextDecoder().decode(put.body).includes("'Vägg X'"), 'the model\'s own file as it is now');
      assert.ok(!mine.some((r) => /\/snippet$/.test(r.url)), 'no change set went');
      const shown = panel.el.querySelector('[data-ai-proposed]');
      assert.ok(shown && shown.getAttribute('data-ai-proposed-kind') === 'file', 'told as a whole file');
      assert.ok((await datasets.log(ds.id)).some((e) => e.action === 'shared' && JSON.stringify(e.details).includes(t('cde.propose.file.log', { host: opencde.hostOf(BASE) }))), 'in the dataset\'s history');
      await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
      assert.equal(panel.state.proposed.trial.kind, 'file'); assert.equal(panel.state.proposed.trial.commit, FILECOMMIT);
      assert.equal(panel.el.querySelector('[data-ai-trial]').textContent, t('ai.change.trial.file.clean'), 'the trial of a whole file in words');
      await panel.approveOnServer({ confirmed: true });
      assert.equal(panel.state.error, '');
      assert.equal(panel.el.querySelector('[data-ai-approved-server]').getAttribute('data-ai-approved-server'), '4', 'the new version');
      // A collision at the approval: shown, not chosen one by one.
      W.trials = 0; W.approve = 'details';
      await panel.propose({ title: 'Igen', description: 'x' });
      await waitFor(() => panel.state.proposed && panel.state.proposed.trial && panel.state.proposed.trial.state === 'clean', 8000, 'the clean trial');
      await panel.approveOnServer({ confirmed: true });
      assert.equal(panel.state.error, t('ai.change.approve.server.conflict.file', { k: '1' }), 'told why');
      assert.ok(panel.el.querySelector('[data-ai-conflicts-file] [data-ai-conflict="0"]') && !panel.el.querySelector('[data-ai-conflict-pick]') && !panel.el.querySelector('[data-ai-conflict-resend]'), 'the collision listed without choices');
      // A server without whole files: what the form cannot express is said at the button, as before.
      panel.state.takesFiles = false;
      await panel.propose({ title: 'x' });
      assert.ok(!panel.el.querySelector('[data-cde-propose-note]'), 'with changes it still goes as a change set');
      W.approve = 'ok';
    } finally {
      bridge.runIfcProposal = realProposal; bridge.runIfcApply = realApply; reviewMod.review = realReview;
      panel.destroy(); panel.el.remove();
    }
    return 'ok';
  }, 60000);

  test('cde history: the proposals card shows a whole file as its diff against the base through the sides, and approves it', async (assert) => {
    await setUp();
    const card = D.require('ui/bearbeta/proposals-card').create({ shell: { log() {} } }, model);
    document.body.appendChild(card.el);
    try {
      assert.equal(await card.ready, true);
      await card.fetch();
      const row = await waitFor(() => card.el.querySelector('[data-proposal="t-f"]'), 5000, 'the row');
      assert.ok(row.querySelector('[data-proposal-diff-show="t-f"]'), 'the diff offered on a tried proposal');
      W.trials = 5;
      const before = W.sides.length;
      const diff = await card.showDiff(card.state.rows[0]);
      assert.deepEqual(W.sides.slice(before), [{ a: '2', b: FILECOMMIT }], 'from the base\'s index to the trial\'s commit');
      assert.equal(diff.kind, 'file');
      const shown = card.el.querySelector('[data-proposal-diff="t-f"][data-proposal-kind="file"]');
      assert.ok(shown && shown.textContent.includes(t('proposals.diff.counts', { added: '1', removed: '0', changed: '1', base: '2' })) && shown.textContent.includes('Ny platta'), 'what it changes: ' + (shown && shown.textContent));
      assert.ok(card.el.querySelector('[data-proposal="t-f"]').textContent.includes(t('proposals.row.file', { base: '2', author: 'anna', when: i18n.formatDateTime('2026-11-28T01:00:00Z') })), 'a whole file in the row');
      W.approve = 'ok';
      const version = await card.approve(card.state.rows[0], { confirmed: true });
      assert.equal(version && version.version_index, 4, 'approved as a change set is');
    } finally { card.el.remove(); card.destroy(); }
    return 'ok';
  }, 30000);

  test('cde history: a manager mirrors the project\'s repository to a forge, and the token goes once to the server, never into the log or the app', async (assert) => {
    await setUp();
    await manage.signIn(connector, 'project', { popup, redirectUri: REDIRECT });
    const bodies = cdeLog.bodies();
    cdeLog.setBodies(true);
    const logged = [];
    const panel = D.require('ui/api/manage-panel').create({ connector, log: (m) => logged.push(m) });
    document.body.appendChild(panel.el);
    const TOKEN = 'github_pat_Hemlig0123456789';
    try {
      await panel.start();
      await waitFor(() => panel.el.querySelector('[data-manage-remote="none"]'), 5000, 'the form');
      assert.deepEqual(panel.state.remoteExt, { url: '/manage/1.0/projects/{project_id}/remote', hosts: ['github.com'] });
      assert.equal(panel.state.remote, null, 'not mirrored (404)');
      // What the form refuses before anything goes.
      const at = W.requests.length;
      for (const [given, key] of [[{ url: 'https://github.com/o/r.git', token: TOKEN, ack: false }, 'manage.remote.err.ack'], [{ url: 'http://github.com/o/r.git', token: TOKEN, ack: true }, 'manage.remote.err.url'],
        [{ url: 'https://gitlab.com/o/r.git', token: TOKEN, ack: true }, 'manage.remote.err.host'], [{ url: 'https://github.com/o/r.git', token: 'kort', ack: true }, 'manage.remote.err.token'],
        [{ url: 'https://github.com/o/r.git', token: TOKEN, ack: true, expires: '2020-01-01' }, 'manage.remote.err.expires'], [{ url: 'https://github.com/o/r.git', token: TOKEN, ack: true, maxFileMib: 9000 }, 'manage.remote.err.size']]) {
        assert.equal(await panel.connectRemote(given), false);
        assert.equal(panel.state.error, t(key, { hosts: 'github.com' }), key);
      }
      assert.ok(!W.requests.slice(at).some((r) => r.method === 'PUT'), 'nothing sent');
      // The token typed into its field, read once and emptied.
      const field = /** @type {any} */ (panel.el.querySelector('[data-manage-remote-token]'));
      field.value = TOKEN;
      const expires = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      assert.equal(await panel.connectRemote({ url: 'https://github.com/owner/hus.git', expires, maxFileMib: 50, ack: true }), true, 'connected');
      const put = W.requests.slice(at).find((r) => r.method === 'PUT' && /\/remote$/.test(r.url));
      assert.ok(put, 'PUT …/remote');
      const body = bodyOf(put);
      assert.deepEqual(Object.keys(body).sort(), ['acknowledged', 'expires_at', 'max_file_bytes', 'token', 'url']);
      assert.deepEqual([body.url, body.token, body.acknowledged, body.max_file_bytes, body.expires_at.slice(0, 10)], ['https://github.com/owner/hus.git', TOKEN, true, 50 * MIB, expires], 'the server\'s form');
      assert.ok(String(put.url).startsWith(BASE + '/manage/1.0/projects/p-h/remote'), 'to the source\'s own server');
      assert.equal(field.value, '', 'the field emptied');
      const entry = cdeLog.list(connector.id).filter((e) => e.method === 'PUT' && /\/remote$/.test(e.url)).pop();
      assert.ok(entry && entry.requestBody === null && !JSON.stringify(cdeLog.list()).includes(TOKEN), 'never in the CDE log, though it keeps bodies');
      assert.ok(!JSON.stringify(panel.state).includes(TOKEN) && !JSON.stringify(secrets.get(connector.id) || {}).includes(TOKEN) && !JSON.stringify(await connectors.get(connector.id)).includes(TOKEN), 'nor in the panel, the secrets or the source');
      let stored = '';
      try { for (let i = 0; i < localStorage.length; i++) stored += localStorage.getItem(localStorage.key(i) || '') || ''; } catch (_e) { /* blocked */ }
      assert.ok(!stored.includes(TOKEN), 'nor in the browser\'s storage');
      assert.ok(panel.el.querySelector('[data-manage-remote="waiting"]') && panel.el.textContent.includes(t('manage.remote.state.waiting')), 'the state from the server');
      assert.ok(logged.some((m) => m === t('manage.remote.done', { url: 'https://github.com/owner/hus.git', project: 'Historik' })), 'in the log in words');
      // The server's status after a round: pushed with a file left out, or an error.
      W.remote = Object.assign({}, W.remote, { status: 'error', error: 'remote rejected', pushed_at: '2026-11-28T03:00:00Z', pushed: ['main', 'proposals/p-5'], left_out: [{ path: 'stor.ifc', bytes: 200 * MIB }] });
      await panel.loadRemote(); panel.select('p-h');
      await waitFor(() => panel.el.querySelector('[data-manage-remote="error"]'), 5000, 'the error state');
      assert.ok(panel.el.querySelector('[data-manage-remote-error]').textContent.includes('remote rejected'), 'the server\'s words');
      assert.ok(panel.el.querySelector('[data-manage-remote-left="1"]').textContent.includes('stor.ifc'), 'the file left out');
      assert.ok(panel.el.textContent.includes('main, proposals/p-5'), 'the branches pushed');
      assert.equal(await panel.removeRemote({ confirmed: true }), true);
      assert.ok(W.requests.some((r) => r.method === 'DELETE' && /\/remote$/.test(r.url)) && W.remote === null, 'DELETE …/remote');
      assert.ok(panel.el.querySelector('[data-manage-remote="none"]'), 'the form again');
      // A server whose administrator has not turned it on shows nothing of it.
      W.git = false; await fresh();
      assert.equal(await manage.remoteExtension(connector), null);
    } finally { cdeLog.setBodies(bodies); panel.el.remove(); W.git = true; await fresh(); }
    return 'ok';
  }, 30000);

  test('cde history: cleanup', async () => {
    if (realRequest && http.request === spyRequest) http.request = realRequest;
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
