// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for 2.34 part 1 against a mocked server: the capabilities document (/.well-known/kontroll) read and cached, a server without it,
 * the server's error codes in the user's words, the source view naming the extensions, and the log card pointing at the server's log.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const cdeLog = D.require('api/cde-log');
  const http = D.require('api/http');
  const BASE = 'dataspatium-asset://tests/opencde6';
  const PLAIN = 'dataspatium-asset://tests/opencde6-plain';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const spy = { requests: [] };
  const realRequest = http.request;
  const spyRequest = (req) => { spy.requests.push(req); return realRequest(req); };
  http.request = spyRequest;
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const CAPS = { server: { name: 'Kontroll OpenCDE server', version: '0.1.0', public_url: 'http://localhost:8000' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, scopes: ['profile', 'bcf', 'documents', 'admin'],
    extensions: { dynamic_client_registration: { enabled: true, public_clients: true, unused_days: 30, url: '/foundation/oauth2/reg' }, request_log: { enabled: true, retention_hours: 72, url: '/admin/api/requests' }, admin_api: { enabled: true, version: 1, url: '/admin/api', scope: 'admin' }, ifcgraph: { enabled: true, bolt: null }, graph_query: { enabled: false } },
    limits: { max_upload_bytes: 104857600, max_image_bytes: 10485760, access_token_ttl_seconds: 3600 }, links: { dataspatium: null } };
  const world = { tokens: 0, capsHits: 0 };
  function common(path) {
    if (path === '/foundation/versions') return json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] });
    if (path === '/foundation/1.0/auth') return json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'] });
    if (path === '/foundation/oauth2/token') { world.tokens++; return json({ access_token: 'tok' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600 }); }
    if (path === '/foundation/oauth2/revoke') return { kind: 'text', data: '' };
    if (path === '/foundation/1.0/current-user') return json({ id: 'officer', name: 'Handläggaren' });
    if (path === '/bcf/3.0/projects/x/fresh') return json({ message: 'Fresh sign-in needed for this', code: 'reauthentication_required' }, 403);
    if (path === '/bcf/3.0/projects/x/odd') return json({ message: 'Something odd', code: 'some_unknown_code' }, 400);
    if (path === '/bcf/3.0/projects/x/plain') return json({ message: 'Plain message' }, 404);
    return null;
  }
  D.net.virtual('tests/opencde6/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/.well-known/kontroll') { world.capsHits++; return Promise.resolve(json(CAPS)); }
    const c = common(path);
    return Promise.resolve(c || { kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  D.net.virtual('tests/opencde6-plain/', (url) => {
    const rest = url.startsWith(PLAIN) ? url.slice(PLAIN.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: PLAIN + '/a', oauth2_token_url: PLAIN + '/t' }));
    // The token endpoint keeps RFC 6749's shape: this server has forgotten the client.
    if (path === '/t') return Promise.resolve(json({ error: 'invalid_client', error_description: 'Unknown client' }, 401));
    const c = common(path);
    return Promise.resolve(c || { kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null; let plain = null;

  test('opencde VI: the capabilities document is read once and cached; a server without it has no extensions', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    plain = (await families.createConnector('opencde', { baseUrl: PLAIN, clientId: 'dataspatium', clientSecret: '' })).connector;
    world.capsHits = 0;
    const caps = await opencde.capabilities(connector);
    assert.equal(caps.present, true); assert.equal(caps.server.version, '0.1.0');
    assert.ok(opencde.hasExtension(caps, 'request_log') && opencde.hasExtension(caps, 'admin_api') && !opencde.hasExtension(caps, 'graph_query') && !opencde.hasExtension(caps, 'something_else'));
    assert.equal(caps.extensions.request_log.retention_hours, 72); assert.equal(caps.limits.max_upload_bytes, 104857600);
    await opencde.capabilities(connector);
    assert.equal(world.capsHits, 1, 'cached');
    await opencde.capabilities(connector, { force: true });
    assert.equal(world.capsHits, 2, 'forced again');
    const none = await opencde.capabilities(plain);
    assert.equal(none.present, false); assert.deepEqual(none.extensions, {}); assert.equal(opencde.hasExtension(none, 'admin_api'), false);
    const entry = cdeLog.list(connector.id).find((e) => e.operation === 'capabilities');
    assert.ok(entry && entry.api === 'kontroll', 'the request is in the log as kontroll.capabilities');
    return 'ok';
  }, 30000);

  test('opencde VI: the server\'s error codes come out in the user\'s words, unknown codes keep the server\'s message', async (assert) => {
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const fresh = await opencde.api(connector, '/bcf/3.0/projects/x/fresh').catch((e) => e);
    assert.ok(fresh instanceof Error && fresh.code === 'reauthentication_required', 'the code travels: ' + (fresh && fresh.code));
    assert.ok(fresh.message.includes(t('opencde.err.code.reauthentication_required')), fresh.message);
    assert.equal(fresh.detail, 'Fresh sign-in needed for this', 'the server message stays as detail');
    const odd = await opencde.api(connector, '/bcf/3.0/projects/x/odd').catch((e) => e);
    assert.ok(odd.message.includes('Something odd') && odd.code === 'some_unknown_code', odd.message);
    const plainErr = await opencde.api(connector, '/bcf/3.0/projects/x/plain').catch((e) => e);
    assert.ok(plainErr.message.includes('Plain message') && plainErr.code === '', plainErr.message);
    const d = opencde.describeError({ message: 'Too big', code: 'validation_error' });
    assert.equal(d.text, t('opencde.err.code.validation_error', { detail: 'Too big' }));
    // RFC 6749 at the token endpoint: the `error` field is translated the same way.
    const tokenErr = await opencde.login(plain, { popup: fakePopup, redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(tokenErr instanceof Error && tokenErr.code === 'invalid_client', 'the OAuth error travels as code: ' + (tokenErr && tokenErr.code));
    assert.ok(tokenErr.message.includes(t('opencde.err.oauth.invalid_client')), tokenErr.message);
    assert.equal(tokenErr.detail, 'Unknown client');
    assert.equal(opencde.describeOAuthError('{"error":"invalid_grant"}').text, t('opencde.err.oauth.invalid_grant'));
    assert.equal(opencde.describeOAuthError('plain text').text, 'plain text', 'no JSON: the text as it is');
    return 'ok';
  }, 30000);

  test('opencde VI: the source view names the server and its extensions, and the log card points at the server log', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:900px;';
    document.body.appendChild(root);
    try {
      const view = D.require('ui/api/opencde-view').create({ connector, log() {}, onDataset() {} });
      root.appendChild(view.el);
      view.start();
      const line = await waitFor(() => root.querySelector('[data-opencde-capabilities]'), 5000, 'the capabilities line');
      assert.ok(line.textContent.includes('0.1.0') && line.textContent.includes(t('opencde.ext.request_log')) && line.textContent.includes(t('opencde.ext.admin_api')), line.textContent);
      assert.ok(!line.textContent.includes(t('opencde.ext.graph_query')), 'disabled extensions are not listed');
      const card = root.querySelector('[data-cde-log]');
      assert.ok(card, 'the log card is in the view');
      card.querySelector('[data-cde-log-toggle]').click();
      const server = await waitFor(() => card.querySelector('[data-cde-log-server]'), 5000, 'the server log line');
      assert.ok(server.textContent.includes('72'), server.textContent);
      assert.ok(server.querySelector('a').getAttribute('href').endsWith('/admin/requests'));
      view.destroy();
      const view2 = D.require('ui/api/opencde-view').create({ connector: plain, log() {}, onDataset() {} });
      root.appendChild(view2.el);
      view2.start();
      await wait(300);
      assert.ok(!view2.el.querySelector('[data-opencde-capabilities]'), 'no line for a server without the document');
      view2.destroy();
    } finally { root.remove(); }
    return 'ok';
  }, 30000);

  test('opencde VI: the popup addresses carry the app\'s language for Kontroll and are left alone for other servers', async (assert) => {
    const seen = [];
    const spyPopup = (url) => { seen.push(url); return fakePopup(url); };
    await opencde.login(connector, { popup: spyPopup, redirectUri: REDIRECT });
    assert.equal(new URL(seen[0]).searchParams.get('lang'), D.require('ui/i18n').language(), 'Kontroll gets lang: ' + seen[0]);
    assert.equal(new URL(seen[0]).searchParams.get('response_type'), 'code', 'the OAuth parameters stay');
    assert.equal(new URL(seen[0]).searchParams.get('code_challenge_method'), 'S256');
    await opencde.login(plain, { popup: spyPopup, redirectUri: REDIRECT }).catch(() => null);
    assert.equal(new URL(seen[1]).searchParams.get('lang'), null, 'a server without the capabilities document is left alone: ' + seen[1]);
    return 'ok';
  }, 30000);

  test('opencde VI: a popup that cannot answer the app falls back to a sign-in in a new tab with a field for the callback address', async (assert) => {
    const view = D.require('ui/api/opencde-view');
    const realLogin = opencde.login; const realStart = opencde.manualStart; const realRedirect = opencde.redirectUri; const realOpen = window.open;
    const opened = [];
    opencde.login = () => Promise.reject(new Error(t('opencde.err.closed')));
    opencde.manualStart = async (c, redirect) => ({ url: 'https://cde.example.org/auth?redirect_uri=' + encodeURIComponent(redirect), state: 's', verifier: 'v', redirectUri: redirect });
    opencde.redirectUri = () => 'http://127.0.0.1:8080/oauth-callback.html';
    window.open = (url) => { opened.push(String(url)); return null; };
    const ui = view.create({ connector: plain, ctx: {}, log: () => {}, onDataset: () => {} });
    document.body.appendChild(ui.el);
    try {
      await ui.signIn();
      assert.ok(ui.state.manual && ui.state.manual.state === 's', 'the manual flow started');
      assert.equal(opened.length, 1, 'the sign-in opened in a new tab: ' + opened.join());
      assert.ok(opened[0].includes(encodeURIComponent('http://127.0.0.1:8080/oauth-callback.html')), 'with the app\'s own callback address');
      assert.ok(ui.el.textContent.includes(t('opencde.manual.fallback')), 'the hint says what to do');
      assert.ok(ui.el.querySelector('dm-input[placeholder*="dataspatium-callback"]'), 'the field for the callback address is shown in http mode too');
      assert.equal(ui.state.error, '', 'no error line for a popup that was merely cut off');
    } finally { opencde.login = realLogin; opencde.manualStart = realStart; opencde.redirectUri = realRedirect; window.open = realOpen; ui.destroy(); ui.el.remove(); }
    return 'ok';
  }, 20000);

  test('opencde VI: the popup flow hears the callback page through a BroadcastChannel and a storage event, not only through the opener', async (assert) => {
    const realOpen = window.open;
    const fake = { closed: false, close() { this.closed = true; } };
    window.open = () => /** @type {any} */ (fake);
    const page = new BroadcastChannel(opencde.CALLBACK_CHANNEL);
    try {
      // Through the channel, as the callback page does when its opener is gone; the app acknowledges so that the page may close.
      const acks = [];
      page.onmessage = (ev) => { if (ev.data && ev.data.type === 'dataspatium-oauth-ack') acks.push(ev.data.id); };
      const p1 = opencde.popupFlow('https://cde.example.org/auth');
      await wait(50);
      page.postMessage({ type: 'dataspatium-oauth-callback', url: REDIRECT + '?code=c1&state=s1', id: 'x1' });
      assert.equal(await p1, REDIRECT + '?code=c1&state=s1');
      await waitFor(() => acks.includes('x1'), 3000, 'the acknowledgement');
      assert.ok(fake.closed, 'the app closes the popup');
      // Through the storage event, as the browser dispatches it to another document of the same origin.
      fake.closed = false;
      const p2 = opencde.popupFlow('https://cde.example.org/auth');
      await wait(50);
      window.dispatchEvent(new StorageEvent('storage', { key: opencde.CALLBACK_KEY, newValue: JSON.stringify({ url: REDIRECT + '?code=c2&state=s2', id: 'x2', at: Date.now() }) }));
      assert.equal(await p2, REDIRECT + '?code=c2&state=s2');
      // A popup the user closes is an error when the app is not isolated; an isolated app cannot tell and waits for the page.
      if (!globalThis.crossOriginIsolated) {
        fake.closed = false;
        const p3 = opencde.popupFlow('https://cde.example.org/auth');
        await wait(50); fake.closed = true;
        const err = await p3.catch((e) => e);
        assert.ok(err instanceof Error && err.message === t('opencde.err.closed'), 'closed by the user: ' + (err && err.message));
      }
    } finally { window.open = realOpen; page.close(); }
    return 'ok';
  }, 20000);

  test('opencde VI: cleanup', async () => {
    for (const c of [connector, plain]) if (c) { await opencde.logout(c).catch(() => {}); await connectors.remove(c.id); }
    cdeLog.clear();
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
