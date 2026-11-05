// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the CDE log (2.32) against a mocked OpenCDE server: the classification of paths into APIs and operations, masked
 * headers, bodies only when asked for and never for tokens, X-Request-Id on by default and turned off when the server refuses it,
 * the card in the source view, the export as JSON, curl and a dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const cdeLog = D.require('api/cde-log');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const http = D.require('api/http');
  const BASE = 'dataspatium-asset://tests/opencde5';
  const PROJECT = 'cccccccc-1111-4222-8333-444444444444';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const spy = { requests: [] };
  const realRequest = http.request;
  // A server whose CORS refuses the header: the browser never sends the request, which the app sees as a network error.
  const spyRequest = (req) => { spy.requests.push(req); if (world.refuseHeader && req.headers && req.headers['X-Request-Id']) return Promise.reject(new http.ApiError('Failed to fetch (preflight refused X-Request-Id)', { kind: 'network', url: req.url })); return realRequest(req); };
  http.request = spyRequest;
  const last = () => spy.requests[spy.requests.length - 1] || {};
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  const world = { tokens: 0, refuseHeader: false };
  D.net.virtual('tests/opencde5/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    const req = last();
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'] }));
    if (path === '/foundation/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'secret-token-' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600 })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'officer', name: 'Handläggaren' }));
    if (path === '/bcf/3.0/projects') return Promise.resolve(json([{ project_id: PROJECT, name: 'Loggprojektet' }]));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics`) return Promise.resolve(json([{ guid: 'a', title: 'Ett ärende', topic_status: 'Open' }]));
    if (path === `/bcf/3.0/projects/${PROJECT}/broken`) return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Server error for the test' }), status: 500 });
    return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null;

  test('cde-log: paths become APIs and operations, headers are masked, bodies only when asked and never for tokens', async (assert) => {
    const c = (m, u) => cdeLog.classify(m, u);
    assert.deepEqual([c('GET', 'https://cde.example.org/foundation/versions').operation, c('GET', 'https://cde.example.org/foundation/1.0/auth').api, c('POST', 'https://cde.example.org/foundation/oauth2/token').operation, c('POST', 'https://x/foundation/oauth2/reg').operation],
      ['versions', 'foundation', 'token', 'register']);
    assert.deepEqual([c('GET', 'https://x/bcf/3.0/projects').operation, c('GET', 'https://x/bcf/3.0/projects/p1?includeAuthorization=true').operation, c('GET', 'https://x/bcf/3.0/projects/p1/topics?$top=5').operation, c('PUT', 'https://x/bcf/3.0/projects/p1/topics/t1').operation],
      ['projects', 'project', 'topics', 'topic']);
    assert.deepEqual([c('GET', 'https://x/bcf/3.0/projects/p1/topics/t1/viewpoints/v1/selection').operation, c('GET', 'https://x/bcf/3.0/projects/p1/topics/t1/viewpoints/v1/snapshot').operation, c('GET', 'https://x/bcf/3.0/projects/p1/files_information').operation, c('POST', 'https://x/bcf/3.0/projects/p1/documents').operation, c('GET', 'https://x/bcf/3.0/projects/p1/documents/d1').operation],
      ['viewpoint_selection', 'viewpoint_snapshot', 'files_information', 'documents', 'document']);
    assert.deepEqual([c('POST', 'https://x/documents/1.0/upload-documents').operation, c('PUT', 'https://x/upload-part/1').operation, c('GET', 'https://x/documents/1.0/documents/d1/versions/2/download').operation, c('POST', 'https://x/documents/1.0/document-versions').operation, c('GET', 'https://x/whatever').api],
      ['upload_documents', 'upload_part', 'download', 'document_versions', 'other']);
    const masked = cdeLog.redactHeaders({ Authorization: 'Bearer abc.def', Accept: 'application/json', Cookie: 'session=1' });
    assert.equal(masked.Authorization, 'Bearer «dold»'); assert.equal(masked.Accept, 'application/json'); assert.equal(masked.Cookie, '«dold»');
    cdeLog.clear();
    cdeLog.setBodies(false);
    const fakeConnector = { id: 'c-test', requestId: false };
    const req = { url: 'https://x/bcf/3.0/projects/p1/topics', method: 'POST', headers: { Authorization: 'Bearer abc' }, body: '{"title":"Hej"}' };
    const done = cdeLog.begin(fakeConnector, req);
    assert.equal(req.headers['X-Request-Id'], undefined, 'no id when turned off');
    done({ ok: true, status: 201, headers: new Headers({ 'Content-Type': 'application/json', ETag: '"7"' }), text: '{"guid":"a"}' });
    const e = cdeLog.list('c-test')[0];
    assert.equal(e.api, 'bcf'); assert.equal(e.operation, 'topics'); assert.equal(e.status, 201); assert.ok(e.ms >= 0);
    assert.equal(e.requestBody, null, 'bodies off'); assert.equal(e.responseBody, null);
    assert.equal(e.requestBytes, 15); assert.equal(e.responseHeaders.etag, '"7"'); assert.equal(e.requestHeaders.Authorization, 'Bearer «dold»');
    cdeLog.setBodies(true);
    const on = { id: 'c-test' };
    const req2 = { url: 'https://x/bcf/3.0/projects/p1/topics', method: 'POST', headers: {}, body: '{"title":"Hej"}' };
    cdeLog.begin(on, req2)({ ok: true, status: 201, headers: new Headers(), text: '{"guid":"b"}' });
    assert.ok(req2.headers['X-Request-Id'], 'the id travels by default');
    const e2 = cdeLog.list('c-test')[1];
    assert.equal(e2.requestBody, '{"title":"Hej"}'); assert.equal(e2.responseBody, '{"guid":"b"}'); assert.equal(e2.requestId, req2.headers['X-Request-Id']);
    const tokenReq = { url: 'https://x/foundation/oauth2/token', method: 'POST', headers: {}, body: 'grant_type=authorization_code&code=secret' };
    cdeLog.begin(on, tokenReq, { kind: 'token' })({ ok: true, status: 200, headers: new Headers(), text: '{"access_token":"never"}' });
    const e3 = cdeLog.list('c-test')[2];
    assert.equal(e3.requestBody, null, 'token bodies are never kept'); assert.equal(e3.responseBody, null);
    assert.ok(!cdeLog.toJson('c-test').includes('never') && !cdeLog.toJson('c-test').includes('Bearer abc'), 'no secret in the JSON');
    const table = cdeLog.toTable('c-test');
    assert.deepEqual(table.columns.slice(0, 4), ['tid', 'metod', 'api', 'operation']); assert.equal(table.rows.length, 3);
    const curl = cdeLog.toCurl(e2);
    assert.ok(curl.startsWith('curl -X POST') && curl.includes('--data') && curl.includes('X-Request-Id'), curl);
    assert.ok(!cdeLog.toCurl(e).includes('abc'), 'masked in curl');
    const sum = cdeLog.summary('c-test');
    assert.equal(sum.total, 3); assert.equal(sum.failed, 0); assert.equal(sum.apis.bcf, 2);
    cdeLog.setBodies(false);
    cdeLog.clear('c-test');
    assert.equal(cdeLog.list('c-test').length, 0);
    return 'ok';
  });

  test('cde-log: the family logs every request, with X-Request-Id by default, and turns the header off when the server refuses it', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    cdeLog.clear(connector.id);
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const me = await opencde.currentUser(connector);
    assert.equal(me.name, 'Handläggaren');
    const ops = cdeLog.list(connector.id).map((e) => `${e.api}.${e.operation}`);
    assert.ok(ops.includes('foundation.token') && ops.includes('foundation.current_user'), ops.join(','));
    const tokenEntry = cdeLog.list(connector.id).find((e) => e.operation === 'token');
    assert.ok(tokenEntry.requestId && tokenEntry.requestBody === null, 'the token request has an id but no body');
    // The spy sees every request of the page (the earlier test files too), so take the last current-user request.
    const sent = spy.requests.filter((r) => /current-user$/.test(r.url)).pop();
    assert.ok(sent.headers['X-Request-Id'], 'the header travels by default');
    assert.ok(cdeLog.list(connector.id).some((e) => e.operation === 'current_user' && e.requestId === sent.headers['X-Request-Id']), 'the same id in the log');
    // A failing call is in the log with its status.
    const err = await opencde.api(connector, `/bcf/3.0/projects/${PROJECT}/broken`).catch((e) => e);
    assert.ok(err instanceof Error);
    const broken = cdeLog.list(connector.id).find((e) => e.path.endsWith('/broken'));
    assert.equal(broken.status, 500); assert.equal(broken.ok, false);
    assert.equal(cdeLog.summary(connector.id).failed, 1);
    // The server refuses the header: one retry without it, and the connector remembers.
    world.refuseHeader = true;
    const projects = await opencde.projects(connector);
    assert.equal(projects.length, 1, 'the retry without the header succeeded');
    assert.equal(connector.requestId, false, 'the connector turned the header off');
    assert.equal((await connectors.get(connector.id)).requestId, false, 'and saved it');
    const tail = cdeLog.list(connector.id).slice(-2);
    assert.ok(tail[0].error && tail[0].requestId, 'the refused attempt is in the log'); assert.equal(tail[1].requestId, null); assert.equal(tail[1].status, 200);
    world.refuseHeader = false;
    await opencde.topics(connector, PROJECT, {});
    assert.equal(cdeLog.list(connector.id).slice(-1)[0].requestId, null, 'stays off');
    return `${cdeLog.list(connector.id).length} entries`;
  }, 30000);

  test('cde-log: the card shows the requests, explains an operation, keeps bodies on request and saves the log', async (assert) => {
    const card = D.require('ui/api/cde-log-card').create(connector, { log() {}, onDataset: (m) => created.push(m.id) });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:900px;';
    document.body.appendChild(root);
    root.appendChild(card.el);
    try {
      assert.ok(card.el.querector === undefined || true);
      const summary = await waitFor(() => root.querySelector('[data-cde-log-summary]'), 3000, 'summary');
      assert.ok(summary.textContent.includes(String(cdeLog.list(connector.id).length)), summary.textContent);
      root.querySelector('[data-cde-log-toggle]').click();
      const rows = await waitFor(() => { const r = root.querySelectorAll('[data-cde-log-row]'); return r.length ? r : null; }, 3000, 'rows');
      assert.ok(rows.length >= 4, 'rows: ' + rows.length);
      // Since 2.34 the view also reads the capabilities document, so the newest row may be Kontroll's.
      assert.ok(['BCF', 'Foundation', 'Kontroll'].some((w) => rows[0].textContent.includes(w)), rows[0].textContent);
      // Discovery runs before a connector exists, so the card's first explained row is the current user.
      const userRow = Array.from(rows).find((r) => r.textContent.includes('current_user'));
      assert.ok(userRow, 'a current_user row');
      userRow.click();
      const detail = await waitFor(() => root.querySelector('[data-cde-log-detail]'), 3000, 'detail');
      assert.equal(detail.querySelector('[data-cde-log-explain]').textContent, t('cdelog.op.foundation.current_user'));
      assert.ok(detail.textContent.includes('/foundation/1.0/current-user'));
      const text = await card.copyCurl(cdeLog.list(connector.id).find((e) => e.operation === 'current_user'));
      assert.ok(text.includes('Bearer «dold»') && !text.includes('secret-token'), text);
      const sw = root.querySelector('[data-cde-log-bodies]');
      /** @type {any} */ (sw).checked = true; sw.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(cdeLog.bodies(), true);
      await opencde.topics(connector, PROJECT, {});
      assert.ok(cdeLog.list(connector.id).slice(-1)[0].responseBody.includes('Ett ärende'), 'the body is kept now');
      /** @type {any} */ (sw).checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(cdeLog.bodies(), false);
      root.querySelector('[data-cde-log-dataset]').click();
      const meta = await waitFor(async () => (await datasets.list()).find((d) => d.name === t('cdelog.dataset.name', { name: connector.name })), 8000, 'the dataset');
      if (!created.includes(meta.id)) created.push(meta.id);
      const cols = (await datasets.columns(meta.id)).map((c) => c.name);
      assert.ok(cols.includes('operation') && cols.includes('status') && cols.includes('request_id'), cols.join(','));
      assert.ok((await datasets.query(meta.id, {})).length >= 5);
      root.querySelector('[data-cde-log-clear]').click();
      await waitFor(() => !root.querySelector('[data-cde-log-row]'), 3000, 'cleared');
      assert.equal(cdeLog.list(connector.id).length, 0);
    } finally { card.destroy(); root.remove(); }
    return 'ok';
  }, 30000);

  test('cde-log: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    cdeLog.clear();
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
