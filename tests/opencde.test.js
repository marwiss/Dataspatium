// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the OpenCDE source of the 1 series against a mocked Dataregium (virtual dataspatium-asset:// providers, no
 * network): discovery and self-registration, PKCE sign-in with a fake popup and the refresh of a token, the capabilities
 * document with its older address as the fallback, documents chosen on the server's page and fetched as datasets, a dataset
 * sent through the upload flow, the cancel of a waiting popup, and the view in Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const datasets = D.require('data/datasets');
  const consent = D.require('platform/consent');
  const cdeLog = D.require('api/cde-log');
  const BASE = 'dataspatium-asset://tests/opencde';
  const OLD = 'dataspatium-asset://tests/opencde-old';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const world = { tokens: 0, registrations: 0, caps: 0, oldCaps: 0, uploads: 0, parts: 0, completed: 0 };
  const CAPS = { server: { name: 'Dataregium OpenCDE server', version: '1.0.0' }, apis: { foundation: '1.0', documents: '1.0' }, scopes: ['profile', 'documents'],
    extensions: { dynamic_client_registration: { enabled: true, public_clients: true }, request_log: { enabled: true } }, limits: { max_upload_bytes: 104857600 }, links: {} };
  const VERSION = { document_id: 'doc-1', version_index: 2, version_number: '2', title: 'Befolkning', file_description: { name: 'befolkning.csv', size_in_bytes: 60 }, links: { document_version_download: { url: BASE + '/documents/1.0/documents/doc-1/versions/2/download' } } };
  function routes(base, path) {
    if (path === '/foundation/versions') return json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] });
    if (path === '/foundation/1.0/auth') return json({ oauth2_auth_url: base + '/foundation/oauth2/auth', oauth2_token_url: base + '/foundation/oauth2/token', oauth2_revocation_url: base + '/foundation/oauth2/revoke', oauth2_dynamic_client_reg_url: base + '/foundation/oauth2/reg' });
    if (path === '/foundation/oauth2/reg') { world.registrations++; return json({ client_id: 'registered-' + world.registrations, redirect_uris: [REDIRECT] }, 201); }
    if (path === '/foundation/oauth2/token') { world.tokens++; return json({ access_token: 'tok' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600, scope: 'profile documents' }); }
    if (path === '/foundation/oauth2/revoke') return { kind: 'text', data: '' };
    if (path === '/foundation/1.0/current-user') return json({ id: 'officer', name: 'Handläggaren' });
    if (path === '/documents/1.0/select-documents') return json({ select_documents_url: base + '/documents/select-page', expires_in: 600 });
    if (path === '/documents/1.0/selected') return json({ documents: [VERSION] });
    if (path === '/documents/1.0/documents/doc-1/versions/2/download') return { kind: 'text', data: 'kommun;folk\nLund;130000\nMalmö;360000\n' };
    if (path === '/documents/1.0/document-versions') return json({ versions: [Object.assign({}, VERSION, { version_index: 3, version_number: '3' })] });
    if (path === '/documents/1.0/upload-documents') { world.uploads++; return json({ upload_ui_url: base + '/documents/upload-page', max_size_in_bytes: 104857600, expires_in: 600 }); }
    if (path === '/documents/1.0/upload-instructions') return json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: base + '/documents/1.0/part/1', http_method: 'PUT', content_range_start: 0, content_range_end: 9999999, include_authorization: true }], upload_completion: { url: base + '/documents/1.0/complete', http_method: 'POST' } }] });
    if (path === '/documents/1.0/part/1') { world.parts++; return { kind: 'text', data: '' }; }
    if (path === '/documents/1.0/complete') { world.completed++; return json({ document_id: 'doc-9', version_index: 1, version_number: '1', title: 'Skickad' }, 201); }
    return null;
  }
  D.net.virtual('tests/opencde/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/.well-known/dataregium') { world.caps++; return Promise.resolve(json(CAPS)); }
    return Promise.resolve(routes(BASE, path) || json({ message: 'Not Found' }, 404));
  });
  // A server from before the rename: the capabilities only at the old address.
  D.net.virtual('tests/opencde-old/', (url) => {
    const rest = url.startsWith(OLD) ? url.slice(OLD.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/.well-known/kontroll') { world.oldCaps++; return Promise.resolve(json(Object.assign({}, CAPS, { server: { name: 'Kontroll OpenCDE server', version: '3.0.0' } }))); }
    return Promise.resolve(routes(OLD, path) || json({ message: 'Not Found' }, 404));
  });
  /** The popup answered by the server's pages: the sign-in returns a code, the selection and the upload their links. */
  const fakePopup = (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/documents/select-page')) return Promise.resolve(REDIRECT + '?selected_documents_url=' + encodeURIComponent(BASE + '/documents/1.0/selected'));
    if (u.pathname.endsWith('/documents/upload-page')) return Promise.resolve(REDIRECT + '?upload_documents_url=' + encodeURIComponent(BASE + '/documents/1.0/upload-instructions'));
    return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`);
  };
  let connector = null;

  test('opencde: the server is discovered, the app registers itself when the client id is empty, and the source is saved', async (assert) => {
    consent.setAsker(() => Promise.resolve({ allow: true, remember: false }));
    const realRedirect = opencde.redirectUri;
    opencde.redirectUri = () => REDIRECT;
    try {
      connector = await opencde.createConnector({ baseUrl: BASE + '/', clientId: '' }, { redirectUri: REDIRECT });
      assert.equal(connector.id, 'opencde-tests', 'the id comes from the host');
      assert.equal(connector.auth.type, 'oauth2_pkce'); assert.equal(connector.auth.clientId, 'registered-1', 'the registered client id');
      assert.equal(connector.auth.authUrl, BASE + '/foundation/oauth2/auth'); assert.equal(connector.family.type, 'opencde'); assert.equal(connector.family.documents, true);
      assert.ok(opencde.isOpenCde(connector));
      assert.ok((await connectors.list()).some((c) => c.id === connector.id), 'saved among the sources');
      // A given client id is kept and no registration is made.
      const given = await opencde.createConnector({ baseUrl: 'dataspatium-asset://tests/opencde-old', clientId: 'handed-out', clientSecret: 's3cret' }, { redirectUri: REDIRECT });
      assert.equal(given.auth.clientId, 'handed-out'); assert.equal(world.registrations, 1, 'no second registration');
      assert.equal((secrets.get(given.id) || {}).clientSecret, 's3cret', 'the secret went to api/secrets');
      assert.ok(!JSON.stringify(given).includes('s3cret'), 'and not into the connector');
      await connectors.remove(given.id); secrets.forget(given.id);
    } finally { opencde.redirectUri = realRedirect; }
    return 'ok';
  }, 20000);

  test('opencde: sign in with PKCE through the popup, refresh an expiring token, read the user, and sign out', async (assert) => {
    const seen = [];
    const popup = (url) => { seen.push(url); return fakePopup(url); };
    await opencde.login(connector, { popup, redirectUri: REDIRECT });
    const u = new URL(seen[0]);
    assert.equal(u.searchParams.get('response_type'), 'code'); assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(u.searchParams.get('client_id'), 'registered-1'); assert.equal(u.searchParams.get('scope'), 'profile documents');
    assert.ok(u.searchParams.get('code_challenge') && u.searchParams.get('state'), 'challenge and state');
    assert.ok(opencde.signedIn(connector), 'signed in');
    const user = await opencde.currentUser(connector);
    assert.equal(user.name, 'Handläggaren');
    // A wrong state is refused.
    const bad = await opencde.login(connector, { popup: () => Promise.resolve(REDIRECT + '?code=x&state=wrong'), redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(bad instanceof Error && bad.message === t('opencde.err.state'), 'wrong state refused: ' + bad.message);
    // An expiring token is refreshed before the next call.
    const creds = secrets.get(connector.id); secrets.set(connector.id, Object.assign({}, creds, { expiresAt: String(Date.now() + 1000) }));
    const before = world.tokens;
    await opencde.currentUser(connector);
    assert.equal(world.tokens, before + 1, 'refreshed'); assert.equal(secrets.get(connector.id).token, 'tok' + world.tokens);
    const entry = cdeLog.list(connector.id).find((e) => e.operation === 'current_user');
    assert.ok(entry && entry.requestId, 'the request log keeps the call with its X-Request-Id');
    await opencde.logout(connector);
    assert.ok(!opencde.signedIn(connector), 'signed out');
    return 'ok';
  }, 20000);

  test('opencde: the capabilities document is read once and cached, and an older server answers at its old address', async (assert) => {
    world.caps = 0;
    const caps = await opencde.capabilities(connector);
    assert.equal(caps.present, true); assert.equal(caps.server.version, '1.0.0'); assert.ok(opencde.hasExtension(caps, 'request_log'));
    await opencde.capabilities(connector);
    assert.equal(world.caps, 1, 'cached');
    const old = { id: 'opencde-old', name: 'old', baseUrl: OLD, auth: { type: 'oauth2_pkce', clientId: 'x' }, family: { type: 'opencde' } };
    const legacy = await opencde.capabilities(old);
    assert.equal(legacy.present, true, 'the old address as fallback'); assert.equal(legacy.server.version, '3.0.0'); assert.equal(world.oldCaps, 1);
    return 'ok';
  }, 20000);

  test('opencde: documents chosen on the server\'s page become datasets, the newer version is noticed, and a dataset goes back up', async (assert) => {
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const chosen = await opencde.selectDocuments(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal(chosen.documents.length, 1);
    const ds = await opencde.importVersion(connector, chosen.documents[0]);
    created.push(ds.id);
    assert.equal(ds.name, 'Befolkning'); assert.equal(ds.rowCount, 2, 'two rows read');
    assert.equal(ds.source.cde.documentId, 'doc-1'); assert.equal(ds.source.cde.versionIndex, 2); assert.equal(ds.source.cde.host, 'tests');
    const newer = await opencde.newerVersion(connector, ds);
    assert.equal(newer.newer, true, 'the server has version 3'); assert.equal(newer.have, 2);
    // Cancelled on the server's page: nothing chosen, no error.
    const none = await opencde.selectDocuments(connector, { popup: () => Promise.resolve(REDIRECT + '?user_cancelled_selection=true'), redirectUri: REDIRECT });
    assert.equal(none, null);
    // Upload: the server's page, the instructions, one part, the completion.
    const progress = [];
    const file = new File(['a;b\n1;2\n'], 'skickad.csv', { type: 'text/csv' });
    const version = await opencde.uploadDocument(connector, file, { popup: fakePopup, redirectUri: REDIRECT, onProgress: (p) => progress.push(p) });
    assert.equal(version.document_id, 'doc-9'); assert.equal(world.parts, 1); assert.equal(world.completed, 1);
    assert.ok(progress.length && progress[progress.length - 1].done === file.size, 'progress to the end');
    const cancelled = await opencde.uploadDocument(connector, file, { popup: () => Promise.resolve(REDIRECT + '?user_cancelled_upload=true'), redirectUri: REDIRECT });
    assert.equal(cancelled, null, 'cancelled on the page');
    return 'ok';
  }, 30000);

  test('opencde: the view in Inhämta signs in, fetches the chosen documents and sends a dataset; a waiting popup can be cancelled', async (assert) => {
    const view = D.require('ui/api/opencde-view');
    const store = { get: () => ({ datasets: created.map((id) => ({ id, name: 'Befolkning' })) }) };
    const logged = [];
    const ui = view.create({ shell: { log: (m) => logged.push(m) }, store }, connector, { onDataset: (d) => created.push(d.id) });
    document.body.appendChild(ui.el);
    const realOpen = window.open; const realRedirect = opencde.redirectUri; const realLogin = opencde.login;
    const fake = { closed: false, close() { this.closed = true; } };
    try {
      await opencde.logout(connector);
      opencde.redirectUri = () => REDIRECT;
      ui.start();
      await waitFor(() => ui.el.querySelector('[data-opencde-capabilities]'), 3000, 'the capabilities line');
      assert.ok(ui.el.textContent.includes('Dataregium OpenCDE server 1.0.0'), 'the server named');
      // A popup the user stops waiting for.
      window.open = () => /** @type {any} */ (fake);
      opencde.login = () => opencde.popupFlow('https://cde.example.org/auth');
      const p = ui.signIn();
      const cancel = await waitFor(() => ui.el.querySelector('[data-opencde-cancel]'), 3000, 'the cancel button');
      await waitFor(() => opencde.popupPending(), 3000, 'the popup waiting');
      /** @type {HTMLElement} */ (cancel).click();
      await p;
      assert.equal(ui.state.busy, ''); assert.equal(ui.state.error, ''); assert.ok(fake.closed, 'the popup closed'); assert.ok(!ui.state.manual, 'no manual fallback');
      // The real sign-in through the fake popup, then the documents and the sending.
      opencde.login = (c, o) => realLogin(c, Object.assign({ popup: fakePopup, redirectUri: REDIRECT }, o || {}));
      await ui.signIn();
      assert.ok(opencde.signedIn(connector), 'signed in from the view');
      await waitFor(() => ui.el.querySelector('[data-opencde-documents]'), 3000, 'the documents button');
      const realSelect = opencde.selectDocuments; const realUpload = opencde.uploadDocument;
      opencde.selectDocuments = (c, o) => realSelect(c, Object.assign({ popup: fakePopup, redirectUri: REDIRECT }, o || {}));
      opencde.uploadDocument = (c, f, o) => realUpload(c, f, Object.assign({ popup: fakePopup, redirectUri: REDIRECT }, o || {}));
      try {
        const n = created.length;
        await ui.fetchDocuments();
        assert.equal(created.length, n + 1, 'a dataset came in'); assert.ok(ui.el.querySelector('[data-opencde-fetched]'), 'and is listed');
        ui.state.what = 'dataset'; ui.state.datasetId = created[0]; ui.state.format = 'csv';
        await ui.send();
        assert.ok(ui.state.sent && ui.state.sent.includes('Skickad'), 'the server\'s title: ' + ui.state.sent);
        assert.equal(ui.state.error, '', 'no error');
      } finally { opencde.selectDocuments = realSelect; opencde.uploadDocument = realUpload; }
    } finally { window.open = realOpen; opencde.redirectUri = realRedirect; opencde.login = realLogin; ui.destroy(); ui.el.remove(); }
    return 'ok';
  }, 30000);

  test('opencde: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); secrets.forget(connector.id); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    cdeLog.clear();
    consent.setAsker(null);
    return 'ok';
  });
})();
