// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the OpenCDE family (api/families/opencde) against a mocked server (virtual dataspatium-asset://
 * providers, no network): discovery, the PKCE sign-in with a fake popup, token refresh, the BCF tables, the
 * Documents API selection flow, saving datasets, and the browser view in Inhämta. Virtual providers only see the
 * address, so the requests themselves (method, headers, body) are observed through a spy on api/http.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const schema = D.require('api/schema');
  const datasets = D.require('data/datasets');
  const runner = D.require('api/runner');
  const http = D.require('api/http');
  const view = D.require('ui/api/opencde-view');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/opencde';
  const PROJECT = '3002cc15-2fe2-49b9-ba94-09d0dff66385';
  const TOPIC = '9beb451a-b39d-4c03-9014-63713ba6366d';
  const VIEWPOINT = '0d6f4e1a-0b2c-4f3d-8a9e-1c2b3d4e5f60';
  const created = [];
  const connIds = [];

  /** Every request the family makes, in order (the provider is called after the push, so it can read the last one). */
  const spy = { requests: [] };
  const realRequest = http.request;
  const spyRequest = (req) => { spy.requests.push(req); return realRequest(req); };
  http.request = spyRequest;
  const last = () => spy.requests[spy.requests.length - 1] || { headers: {}, body: '' };
  const lastParams = () => new URLSearchParams(String(last().body || ''));
  const lastAuth = () => String((last().headers || {}).Authorization || '');
  const server = { tokens: 0, refreshed: 0, revoked: 0 };
  function serve(name, fn) {
    D.net.virtual(name, (url) => Promise.resolve().then(() => fn(new URL(url))).then((out) => (out && out.kind ? out : { kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })));
  }
  serve('tests/opencde/foundation/versions', () => ({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
  serve('tests/opencde/foundation/1.0/auth', () => ({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'], oauth2_pkce_required: true }));
  serve('tests/opencde/foundation/oauth2/token', () => {
    server.tokens++;
    const params = lastParams();
    if (params.get('grant_type') === 'refresh_token') server.refreshed++;
    return { access_token: 'access-' + server.tokens, refresh_token: 'refresh-' + server.tokens, expires_in: 3600, token_type: 'bearer', scope: 'profile bcf documents' };
  });
  serve('tests/opencde/foundation/oauth2/revoke', () => { server.revoked++; return ''; });
  serve('tests/opencde/foundation/1.0/current-user', () => ({ id: 'editor', name: 'Edith Editor' }));
  serve('tests/opencde/bcf/3.0/projects', () => [{ project_id: PROJECT, name: 'Bygglov' }]);
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics`, (url) => (url.searchParams.get('$skip') === '0' || !url.searchParams.get('$skip') ? [
    { guid: TOPIC, server_assigned_id: 'ISSUE-0001', title: 'Dörr saknar dörrstängare', topic_type: 'Issue', topic_status: 'Open', labels: ['Safety', 'Architecture'], creation_author: 'editor', creation_date: '2026-11-05T10:00:00.000Z', priority: 'High' },
    { guid: 'b724aac3-5b2a-234a-d143-ae33cc184140', server_assigned_id: 'ISSUE-0002', title: 'Fel GTIN på vägg', topic_status: 'Closed', labels: [], creation_author: 'manager', creation_date: '2026-11-05T11:00:00.000Z' },
  ] : []));
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics/${TOPIC}/comments`, () => [{ guid: 'c1', topic_guid: TOPIC, date: '2026-11-05T12:00:00.000Z', author: 'contributor', comment: 'Kolla dörrschemat.', viewpoint_guid: VIEWPOINT }]);
  serve('tests/opencde/bcf/3.0/projects/' + PROJECT + '/topics/b724aac3-5b2a-234a-d143-ae33cc184140/comments', () => []);
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics/${TOPIC}/viewpoints`, () => [{ guid: VIEWPOINT, snapshot: { snapshot_type: 'png' } }]);
  serve('tests/opencde/bcf/3.0/projects/' + PROJECT + '/topics/b724aac3-5b2a-234a-d143-ae33cc184140/viewpoints', () => []);
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics/${TOPIC}/viewpoints/${VIEWPOINT}/selection`, () => ({ selection: [{ ifc_guid: '1Xezbq735AdBO_4DerG66G', originating_system: 'Archicad' }] }));
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics/${TOPIC}/viewpoints/${VIEWPOINT}/coloring`, () => ({ coloring: [{ color: 'FF0000', components: [{ ifc_guid: '3eT96F_cnDsOufCEsotwtp' }] }] }));
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/topics/events`, () => [{ topic_guid: TOPIC, date: '2026-11-05T10:00:00.000Z', author: 'editor', actions: [{ type: 'topic_created', value: null }, { type: 'status_updated', value: 'Open' }] }]);
  serve(`tests/opencde/bcf/3.0/projects/${PROJECT}/files_information`, () => [{ display_information: [{ field_display_name: 'File name', field_value: 'walls.ifc' }, { field_display_name: 'Source', field_value: 'Documents API' }], file: { filename: 'walls.ifc', ifc_project: '1CGyzxdzHaJybf9L4wHy3R', date: '2026-11-05T09:00:00.000Z', reference: BASE + '/documents/1.0/documents/d1/versions/1/download' } }]);
  serve('tests/opencde/documents/1.0/select-documents', () => ({ select_documents_url: BASE + '/documents/1.0/select-ui/token-1', expires_in: 600 }));
  serve('tests/opencde/documents/1.0/selection-sessions/s1/documents', () => ({ server_context: null, documents: [{ links: { document_version: { url: BASE + '/v' }, document_version_metadata: { url: BASE + '/m' }, document_version_download: { url: BASE + '/documents/1.0/documents/d1/versions/1/download' }, document_versions: { url: BASE + '/vs' }, document_details: { url: BASE + '/d' } }, version_number: '1', version_index: 1, creation_date: '2026-11-05T09:00:00.000Z', title: 'Walls', file_description: { name: 'walls.csv', size_in_bytes: 28 }, document_id: 'd1' }] }));
  serve('tests/opencde/documents/1.0/documents/d1/versions/1/download', () => 'id,name\n1,Vägg A\n2,Vägg B\n');

  /** A fake popup: "the user signs in", the server redirects to redirect_uri with code and state. */
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc-${u.searchParams.get('code_challenge').slice(0, 6)}&state=${u.searchParams.get('state')}&iss=${encodeURIComponent(BASE)}`); };
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  let connector = null;

  test('opencde: PKCE helpers, discovery and the connector of the family dialog', async (assert) => {
    const v = opencde.verifier();
    assert.ok(/^[A-Za-z0-9_-]{43,128}$/.test(v), 'verifier is URL safe: ' + v);
    assert.equal(await opencde.challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', 'RFC 7636 example');
    assert.ok(families.FAMILIES.some((f) => f.id === 'opencde'), 'family registered in the dialog');
    assert.ok(schema.FAMILIES.includes('opencde') && schema.AUTH_TYPES.includes('oauth2_pkce'));

    const disc = await opencde.discover(BASE);
    assert.deepEqual(disc.apis, { foundation: '1.0', bcf: '3.0', documents: '1.0' });
    assert.ok(disc.authUrl.endsWith('/foundation/oauth2/auth') && disc.pkceRequired);

    const res = await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium-test', clientSecret: '' });
    connector = res.connector; connIds.push(connector.id);
    assert.equal(connector.family.type, 'opencde'); assert.equal(connector.auth.type, 'oauth2_pkce'); assert.equal(connector.auth.clientId, 'dataspatium-test');
    assert.deepEqual(schema.validate(connector), []);
    assert.equal(secrets.get(connector.id), null, 'no secret stored for a public client');
    // The dialog asked the server where to sign in, so the connector knows already.
    assert.equal(connector.auth.authUrl, disc.authUrl, 'authUrl from the dialog');
    assert.equal(connector.auth.tokenUrl, disc.tokenUrl, 'tokenUrl from the dialog');
    assert.equal(connector.auth.revocationUrl, disc.revocationUrl);
    // A connector made while the server was unreachable learns them at the first sign-in, and keeps them.
    const blind = await connectors.importJson(JSON.stringify(Object.assign(JSON.parse(connectors.exportJson(connector)), { id: 'opencde-blind' })));
    connIds.push(blind.id);
    delete blind.auth.authUrl; delete blind.auth.tokenUrl; delete blind.auth.revocationUrl;
    await connectors.save(blind);
    assert.equal((await connectors.get(blind.id)).auth.authUrl, undefined, 'blind to begin with');
    await opencde.login(blind, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal((await connectors.get(blind.id)).auth.tokenUrl, disc.tokenUrl, 'learned and kept');
    await opencde.logout(blind);
    assert.ok(!JSON.stringify(connectors.exportJson(connector)).includes('access-'), 'exports never carry tokens');
    assert.equal(connectors.describeAuth(connector), t('api.auth.summary.oauth.pkce'));
    return connector.id;
  });

  test('opencde: sign in with a popup, refuse a wrong state, refresh an expiring token, sign out', async (assert) => {
    assert.equal(opencde.signedIn(connector), false);
    const creds = await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.ok(creds.token.startsWith('access-') && creds.refreshToken.startsWith('refresh-'), 'tokens stored');
    const tokenCall = spy.requests.filter((r) => r.url.endsWith('/foundation/oauth2/token')).pop();
    const body = new URLSearchParams(String(tokenCall.body));
    assert.equal(tokenCall.method, 'POST'); assert.equal(tokenCall.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(body.get('grant_type'), 'authorization_code'); assert.equal(body.get('redirect_uri'), REDIRECT); assert.equal(body.get('client_id'), 'dataspatium-test');
    assert.ok(body.get('code_verifier') && body.get('code') && body.get('code').startsWith('abc-'), 'code and verifier sent');
    assert.equal(tokenCall.headers.Authorization, undefined, 'public client: no Basic authentication');
    assert.ok(opencde.signedIn(connector));
    const me = await opencde.currentUser(connector);
    assert.equal(me.id, 'editor');
    assert.equal(lastAuth(), 'Bearer ' + creds.token, 'the token travels as a bearer token');

    const wrongState = await opencde.login(connector, { popup: (url) => Promise.resolve(`${REDIRECT}?code=x&state=other`), redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(wrongState instanceof Error && wrongState.message === t('opencde.err.state'), 'state checked: ' + (wrongState && wrongState.message));
    const denied = await opencde.login(connector, { popup: (url) => Promise.resolve(`${REDIRECT}?error=access_denied&error_description=nope&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(denied instanceof Error && /nope/.test(denied.message), 'denial reported');

    // An expiring token is refreshed before the next call; the rotated refresh token replaces the old one.
    const stored = secrets.get(connector.id);
    secrets.set(connector.id, Object.assign({}, stored, { expiresAt: String(Date.now() + 1000) }));
    const before = server.refreshed;
    const token = await opencde.ensureToken(connector);
    assert.equal(server.refreshed, before + 1, 'refreshed once');
    assert.equal(lastParams().get('refresh_token'), stored.refreshToken, 'the stored refresh token was presented');
    assert.ok(token.startsWith('access-') && secrets.get(connector.id).refreshToken !== stored.refreshToken, 'rotation stored');

    const revokedBefore = server.revoked;
    await opencde.logout(connector);
    assert.equal(server.revoked, revokedBefore + 1, 'refresh token revoked (RFC 7009)');
    assert.equal(lastParams().get('token_type_hint'), 'refresh_token');
    assert.equal(opencde.signedIn(connector), false);
    const unauthenticated = await opencde.projects(connector).catch((e) => e);
    assert.ok(unauthenticated instanceof Error && unauthenticated.message === t('opencde.err.signin.first', { name: connector.name }));
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    return 'signed in again';
  });

  test('opencde: BCF tables (topics, comments, components, events, files) and saving a dataset', async (assert) => {
    const projects = await opencde.projects(connector);
    assert.deepEqual(projects.map((p) => p.name), ['Bygglov']);
    const topics = await opencde.fetchTopics(connector, PROJECT);
    assert.equal(topics.rows.length, 2); assert.equal(topics.columns[0], 'server_assigned_id');
    assert.ok(spy.requests.some((r) => /\/topics\?(%24|\$)top=500&(%24|\$)skip=0$/.test(r.url)), 'OData paging parameters sent');
    const row = Object.fromEntries(topics.columns.map((c, i) => [c, topics.rows[0][i]]));
    assert.equal(row.title, 'Dörr saknar dörrstängare'); assert.equal(row.labels, 'Safety, Architecture'); assert.equal(row.description, null);
    const comments = await opencde.fetchComments(connector, PROJECT);
    assert.equal(comments.rows.length, 1); assert.equal(comments.rows[0][comments.columns.indexOf('topic')], 'Dörr saknar dörrstängare');
    const components = await opencde.fetchComponents(connector, PROJECT);
    assert.equal(components.rows.length, 2);
    const roles = components.rows.map((r) => [r[components.columns.indexOf('role')], r[components.columns.indexOf('ifc_guid')], r[components.columns.indexOf('color')]]);
    assert.deepEqual(roles, [['selection', '1Xezbq735AdBO_4DerG66G', null], ['coloring', '3eT96F_cnDsOufCEsotwtp', 'FF0000']]);
    const events = await opencde.fetchEvents(connector, PROJECT);
    assert.deepEqual(events.rows.map((r) => r[events.columns.indexOf('type')]), ['topic_created', 'status_updated']);
    const files = await opencde.fetchFiles(connector, PROJECT);
    assert.equal(files.rows[0][files.columns.indexOf('ifc_project')], '1CGyzxdzHaJybf9L4wHy3R');

    const meta = await runner.toDataset({ columns: topics.columns, rows: topics.rows, meta: {} }, { name: 'Bygglov: ärenden', source: { kind: 'api', connectorId: connector.id, connectorName: connector.name, family: 'opencde', opencde: { kind: 'topics', projectId: PROJECT }, fetchedAt: new Date().toISOString() } });
    created.push(meta.id);
    assert.equal(meta.rowCount, 2);
    const again = await runner.refetch(meta.source);
    assert.equal(again.rows.length, 2, 'refetch through the runner uses the family');
    return meta.name;
  });

  test('opencde: Documents API selection in a popup and import of the chosen files', async (assert) => {
    const popup = (url) => { assert.ok(url.endsWith('/select-ui/token-1'), 'the server page opens'); return Promise.resolve(`${REDIRECT}?selected_documents_url=${encodeURIComponent(BASE + '/documents/1.0/selection-sessions/s1/documents')}`); };
    const selected = await opencde.selectDocuments(connector, { popup, redirectUri: REDIRECT, extensions: ['.csv', '.ifc'] });
    assert.equal(selected.documents.length, 1);
    const start = spy.requests.find((r) => r.url.endsWith('/select-documents'));
    assert.ok(start && start.method === 'POST' && /supported_file_extensions/.test(String(start.body)) && /"callback"/.test(String(start.body)), 'callback and extensions sent');
    const file = await opencde.downloadVersion(connector, selected.documents[0]);
    assert.equal(file.name, 'walls.csv'); assert.equal(file.size, 28, 'the UTF-8 bytes of the mocked CSV');
    const cancelled = await opencde.selectDocuments(connector, { popup: () => Promise.resolve(`${REDIRECT}?user_cancelled_selection=true`), redirectUri: REDIRECT });
    assert.equal(cancelled, null, 'cancellation reported as null');
    return file.name;
  });

  test('opencde: the browser in Inhämta signs in, lists the project and fetches topics', async (assert) => {
    await opencde.logout(connector);
    const logs = [];
    const ui = view.create({ connector, log: (m, k) => logs.push([k, m]) });
    document.body.appendChild(ui.el);
    try {
      ui.start();
      assert.ok(ui.el.textContent.includes(t('opencde.status.out')), 'signed out at first');
      // The popup cannot open headless: sign in through the family with the fake popup, then let the view pick it up.
      await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
      ui.start();
      await new Promise((r) => setTimeout(r, 300));
      assert.ok(ui.el.querySelector('dm-select'), 'project picker shown');
      await ui.fetchKind(ui.KINDS[0]);
      assert.ok(ui.state.result && ui.state.result.rows.length === 2, 'topics fetched');
      assert.ok(ui.el.textContent.includes(t('opencde.kind.topics')), 'buttons for every table');
      assert.ok(logs.some(([, m]) => m.includes(t('opencde.kind.topics'))), 'logged');
      await ui.saveTable('Bygglov via vyn');
      const list = await datasets.list();
      const ds = list.find((d) => d.name === 'Bygglov via vyn');
      assert.ok(ds, 'dataset saved from the view'); if (ds) created.push(ds.id);
      await ui.signOut();
      assert.equal(opencde.signedIn(connector), false);
    } finally { ui.destroy(); ui.el.remove(); }
    for (const id of created) await datasets.remove(id);
    for (const id of connIds) await connectors.remove(id);
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
