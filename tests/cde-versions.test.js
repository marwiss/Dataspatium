// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a new version sent to Dataregium's phase 5.0, against a mocked server (a virtual provider and a spy on api/http, no
 * network): a refusal that comes as 200 after the keep-alive decides by its code (version_conflict as 412 with its conflicts), the
 * version's message goes in the file entry cleaned and only for a new version, and a version whose ids the server moved
 * (`ifc_renumbered` in its metadata) comes back as the model: the stored file, an undoable step in the history but not in the
 * recipe, the dataset pointing at the new version and its facts at the version's highest id; a version without the entry is not
 * fetched, and the assistant is not offered the step.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const model = D.require('data/model');
  const importer = D.require('io/import');
  const http = D.require('api/http');
  const fixtures = D.require('tests/fixtures/ifc');
  const BASE = 'dataspatium-asset://tests/cde-versions';
  const PROJECT = '5b6c7d8e-1111-4222-8333-9a0b1c2d3e4f';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const json = (data, status) => Object.assign({ kind: 'text', data: JSON.stringify(data) }, status ? { status } : {});
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const uploadPopup = () => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(BASE + '/documents/1.0/upload-instructions')}`);
  const spy = { requests: [] };
  const realRequest = http.request;
  // Another server's address never leaves the test: it is refused here, so a token sent there would show in the requests.
  const ELSEWHERE = 'https://elsewhere.example/';
  const spyRequest = (req) => { spy.requests.push(req); return String(req.url).startsWith(ELSEWHERE) ? Promise.reject(new Error('elsewhere')) : realRequest(req); };
  http.request = spyRequest;
  const bodyOf = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : null; } catch (_e) { return null; } };
  const lastStart = () => spy.requests.filter((r) => /\/upload-documents$/.test(r.url)).map(bodyOf).pop();
  /** The server's behaviour for the next completion, set by each test. */
  const world = { completion: null, metadata: [], stored: '', tokens: 0 };
  D.net.virtual('tests/cde-versions/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', oauth2_pkce_required: true }));
    if (path === '/foundation/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'v' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600, token_type: 'bearer' })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: BASE + '/ui', expires_in: 600, max_size_in_bytes: 0 }));
    if (path === '/documents/1.0/upload-instructions') return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: BASE + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 9 }], upload_completion: { url: BASE + '/complete' } }] }));
    if (path === '/part') return Promise.resolve({ kind: 'text', data: '' });
    // After the keep-alive's spaces the answer is JSON, a version or an error body, always with status 200.
    if (path === '/complete') return Promise.resolve({ kind: 'text', data: '      ' + JSON.stringify(world.completion) });
    if (path === '/documents/1.0/documents/doc-r/versions/2/metadata') return Promise.resolve(json({ metadata: world.metadata }));
    if (path === '/documents/1.0/documents/doc-r/versions/2/download') return Promise.resolve({ kind: 'text', data: world.stored });
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  let connector = null;
  async function signedIn() {
    if (connector) return connector;
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-cde-versions', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    return connector;
  }
  const upload = (file, options) => opencde.uploadDocument(connector, file, Object.assign({ redirectUri: REDIRECT, popup: uploadPopup }, options));
  const ten = (name) => new File(['0123456789'], name, { type: 'application/octet-stream' });
  const version2 = () => ({ document_id: 'doc-r', version_index: 2, version_number: '2', title: 'Hus', file_description: { name: 'hus.ifc', size_in_bytes: 10 }, links: { document_version_download: { url: BASE + '/documents/1.0/documents/doc-r/versions/2/download' } } });
  const stepIds = (text) => Array.from(String(text).matchAll(/^#(\d+)\s*=/gm)).map((m) => Number(m[1]));

  test('cde versions: a refusal at 200 after the keep-alive decides by its code, version_conflict as 412 with its conflicts', async (assert) => {
    await signedIn();
    world.completion = { message: 'The document has a newer version', code: 'version_conflict', conflicts: ['#1012.Name', 'abc/Pset_WallCommon.FireRating'] };
    const err = await upload(ten('hus.ifc'), { documentId: 'doc-r', baseVersionIndex: 1 }).catch((e) => e);
    assert.ok(err instanceof Error, 'refused: ' + String(err));
    assert.equal(err.status, 412); assert.equal(err.code, 'version_conflict');
    assert.deepEqual(err.conflicts, ['#1012.Name', 'abc/Pset_WallCommon.FireRating'], 'the conflicts come along');
    assert.ok(err.message.includes(t('opencde.err.code.version_conflict', { detail: '' }).trim()), 'told in the user\'s words: ' + err.message);
    world.completion = { message: 'Unavailable', code: 'unavailable' };
    const other = await upload(ten('hus.ifc'), { documentId: 'doc-r' }).catch((e) => e);
    assert.ok(other instanceof Error && other.status === 503 && other.code === 'unavailable', 'any code decides: ' + String(other && other.status));
    world.completion = { message: 'Odd', code: 'something_new' };
    const odd = await upload(ten('a.csv'), {}).catch((e) => e);
    assert.ok(odd instanceof Error && odd.status === 400, 'an unknown code is a refusal too');
    return 'ok';
  }, 30000);

  test('cde versions: the version\'s message goes in the file entry, cleaned, and only for a new version', async (assert) => {
    await signedIn();
    world.completion = Object.assign(version2(), { file_description: { name: 'a.csv' } });
    await upload(ten('a.csv'), { documentId: 'doc-r', baseVersionIndex: 1, message: '  Nya fönster\u0007 på plan 2\r\nrad två\t ' });
    assert.equal(lastStart().files[0].message, 'Nya fönster på plan 2\nrad två', 'trimmed, line breaks kept, other control characters gone');
    assert.equal(lastStart().files[0].base_version_index, 1);
    await upload(ten('a.csv'), { documentId: 'doc-r', message: 'x'.repeat(2500) });
    assert.equal(lastStart().files[0].message.length, opencde.MESSAGE_MAX, 'at most the server\'s length');
    await upload(ten('a.csv'), { documentId: 'doc-r', message: ' \u0001 ' });
    assert.ok(!('message' in lastStart().files[0]), 'nothing left, nothing sent');
    world.completion = { document_id: 'doc-new', version_index: 1, version_number: '1', title: 'Ny' };
    await upload(ten('a.csv'), { message: 'Första' });
    assert.ok(!('message' in lastStart().files[0]) && !('document_id' in lastStart().files[0]), 'a new document has no message of a version');
    return 'ok';
  }, 30000);

  test('cde versions: a version whose ids the server moved comes back as the model, undoable, outside the recipe, at the new version', async (assert) => {
    await signedIn();
    const local = fixtures.ifcText({ walls: 2 });
    const meta = await importer.run(new File([local], 'hus.ifc', { type: 'application/x-step' }), { format: 'model' }, null, 'Omnumrerad');
    created.push(meta.id);
    await datasets.updateMeta(meta.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: PROJECT, kind: 'document', documentId: 'doc-r', versionIndex: 1, reference: BASE + '/documents/1.0/documents/doc-r/versions/1/download' } }) });
    // The stored file: the local one with its last instance moved above the history, as the safety net does.
    const top = Math.max(...stepIds(local));
    world.stored = local.replace(new RegExp(`#${top}\\b`, 'g'), '#5000');
    world.metadata = [{ name: 'file_name', value: ['hus.ifc'], data_type: 'string' }, { name: 'ifc_max_step_id', value: ['5000'], data_type: 'integer' }, { name: 'ifc_renumbered', value: [`${top}>5000`], data_type: 'string' }];
    world.completion = version2();
    const before = spy.requests.length;
    const version = await upload(new File([local], 'hus.ifc'), { documentId: 'doc-r', baseVersionIndex: 1 });
    assert.deepEqual(version.renumbered, { pairs: [`${top}>5000`], count: 1 }, 'the moved ids are read from the version\'s metadata');
    assert.ok(!spy.requests.slice(before).some((r) => /\/download$/.test(r.url)), 'the upload itself fetches nothing');
    // A download link on another server is not followed: the app builds the address on the source's own server.
    version.links = { document_version_download: { url: ELSEWHERE + 'documents/doc-r/versions/2/download' } };
    await opencde.adoptStored(connector, meta.id, version);
    assert.ok(!spy.requests.some((r) => String(r.url).startsWith(ELSEWHERE)), 'nothing went to another server');
    assert.ok(spy.requests.slice(before).some((r) => r.url === BASE + '/documents/1.0/documents/doc-r/versions/2/download'), 'the stored version came from the source\'s own server');
    const now = await datasets.get(meta.id);
    const original = await model.original(meta.id);
    assert.equal(new TextDecoder().decode(original.bytes), world.stored, 'the stored file is the model now');
    assert.ok(stepIds(new TextDecoder().decode(original.bytes)).includes(5000), 'with the server\'s id');
    assert.equal(now.source.cde.versionIndex, 2, 'the dataset points at the new version');
    assert.equal(now.source.cde.documentId, 'doc-r');
    assert.ok(Number(now.model.maxId) >= 5000, 'the facts take the version\'s highest id: ' + now.model.maxId);
    const log = await datasets.log(meta.id);
    const entry = log.find((e) => e.action === 'refresh');
    assert.ok(entry && String(entry.details && entry.details.description).includes(t('cde.stored.log', { n: 1, version: '2' })), 'in the history in words: ' + JSON.stringify(entry));
    assert.ok(!(await recipes.steps(meta.id)).some((s) => s.op === 'ifc_stored'), 'not a step of the recipe');
    assert.ok(recipes.canUndo(meta.id), 'undoable');
    await recipes.undo(meta.id);
    assert.equal(new TextDecoder().decode((await model.original(meta.id)).bytes), local, 'the undo brings back the file that went up');
    assert.ok(Number((await datasets.get(meta.id)).model.maxId) >= 5000, 'and the highest id never falls');
    // More than the server lists: the count says how many.
    world.metadata = [{ name: 'ifc_renumbered', value: ['1001>6001', '1002>6002'], data_type: 'string' }, { name: 'ifc_renumbered_count', value: ['1500'], data_type: 'integer32' }];
    assert.deepEqual(await opencde.renumbered(connector, 'doc-r', 2), { pairs: ['1001>6001', '1002>6002'], count: 1500 });
    return 'ok';
  }, 60000);

  test('cde versions: a version without the entry is not fetched, and the assistant is not offered the step', async (assert) => {
    await signedIn();
    world.metadata = [{ name: 'file_name', value: ['hus.ifc'], data_type: 'string' }];
    world.completion = version2();
    const before = spy.requests.length;
    const version = await upload(ten('hus.ifc'), { documentId: 'doc-r', baseVersionIndex: 1 });
    assert.equal(version.renumbered, null, 'nothing moved');
    assert.ok(!spy.requests.slice(before).some((r) => /\/download$/.test(r.url)), 'and nothing fetched');
    const commands = D.require('data/commands');
    const listed = (await commands.run('list_operations', { group: 'model' })).result;
    assert.ok(!listed.operations.some((op) => op.id === 'ifc_stored'), 'the step is not among the assistant\'s operations');
    return 'ok';
  }, 30000);

  test('cde versions: a server with a git history per project sets the message\'s length, and the card shows the version\'s commit', async (assert) => {
    const GIT = 'dataspatium-asset://tests/cde-git';
    const COMMIT = '3f2a9c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49';
    D.net.virtual('tests/cde-git/', (url) => {
      const rest = url.startsWith(GIT) ? url.slice(GIT.length) : new URL(url).pathname;
      const path = rest.split('?')[0].split('#')[0] || '/';
      if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '0.1.0' }, extensions: { git: { enabled: true, ifcmerge: false, max_message: 500 } } }));
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: GIT + '/foundation/oauth2/auth', oauth2_token_url: GIT + '/foundation/oauth2/token', oauth2_revocation_url: GIT + '/foundation/oauth2/revoke', oauth2_pkce_required: true }));
      if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'g1', refresh_token: 'gr1', expires_in: 3600, token_type: 'bearer' }));
      if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
      if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: GIT + '/ui', expires_in: 600, max_size_in_bytes: 0 }));
      if (path === '/documents/1.0/upload-instructions') return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: GIT + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 9 }], upload_completion: { url: GIT + '/complete' } }] }));
      if (path === '/part') return Promise.resolve({ kind: 'text', data: '' });
      if (path === '/complete') return Promise.resolve(json({ document_id: 'doc-g', version_index: 2, version_number: '2', title: 'Tabell' }));
      if (path === '/documents/1.0/document-versions') return Promise.resolve(json({ versions: [{ document_id: 'doc-g', version_index: 1, version_number: '1' }] }));
      if (path === '/documents/1.0/documents/doc-g/versions/1/metadata') return Promise.resolve(json({ metadata: [{ name: 'file_name', value: ['tabell.csv'], data_type: 'string' }, { name: 'git_commit', value: [COMMIT], data_type: 'string' }] }));
      if (path === '/documents/1.0/documents/doc-g/versions/2/metadata') return Promise.resolve(json({ metadata: [{ name: 'git_commit', value: ['not a commit'], data_type: 'string' }] }));
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const git = (await families.createConnector('opencde', { baseUrl: GIT, clientId: 'dm-test-cde-git', clientSecret: '' })).connector;
    const table = await datasets.create({ name: 'Git-tabell', columns: [{ name: 'a', type: 'integer' }], rows: [[1]] });
    created.push(table.id);
    let card = null;
    try {
      await opencde.login(git, { popup: fakePopup, redirectUri: REDIRECT });
      assert.equal(await opencde.messageMax(git), 500, 'the server\'s length');
      assert.equal(await opencde.messageMax(connector || (await signedIn())), opencde.MESSAGE_MAX, 'and the default on a server without git');
      await opencde.uploadDocument(git, ten('tabell.csv'), { documentId: 'doc-g', baseVersionIndex: 1, message: 'y'.repeat(800), redirectUri: REDIRECT, popup: () => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(GIT + '/documents/1.0/upload-instructions')}`) });
      assert.equal(lastStart().files[0].message.length, 500, 'the message is cut where the server says');
      assert.equal(await opencde.gitCommit(git, 'doc-g', 1), COMMIT, 'the version\'s commit');
      assert.equal(await opencde.gitCommit(git, 'doc-g', 2), null, 'and nothing that is not a commit');
      assert.equal(await opencde.gitCommit(git, 'doc-none', 1), null, 'nor when the metadata cannot be read');
      await datasets.updateMeta(table.id, { source: { kind: 'file', fileName: 'tabell.csv', cde: { connectorId: git.id, connectorName: git.name, host: 'tests', projectId: PROJECT, kind: 'document', documentId: 'doc-g', versionIndex: 1, reference: GIT + '/x' } } });
      const ui = Object.assign({ button: D.require('ui/basic').button }, D.require('ui/overlays'));
      card = D.require('ui/kinds/insight-cards').cdeCard({ ui, store: { set: () => {} }, shell: { log: () => {}, activate: () => {} } }, await datasets.get(table.id));
      document.body.appendChild(card);
      card.querySelector('[data-cde-check]').click();
      const current = await (async () => { const t0 = performance.now(); for (;;) { const el = card.querySelector('[data-cde-current]'); if (el) return el; if (performance.now() - t0 > 5000) return null; await new Promise((r) => setTimeout(r, 30)); } })();
      assert.ok(current, 'the check is done');
      assert.ok(card.textContent.includes(t('cde.git.commit')) && card.textContent.includes(COMMIT.slice(0, 12)) && !card.textContent.includes(COMMIT), 'the commit in brief on the card: ' + card.textContent);
    } finally {
      if (card) card.remove();
      await opencde.logout(git).catch(() => {}); await connectors.remove(git.id);
    }
    return 'ok';
  }, 30000);

  test('cde versions: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
