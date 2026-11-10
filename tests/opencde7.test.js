// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the administration of a Dataregium server from the app (2.2.0) against a mocked server: the admin scope asked for at
 * sign-in, the reads, the writes with one-time values, the fresh sign-in that dangerous operations need, the lists as datasets,
 * the graph query, and the card Administration in the source view.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const http = D.require('api/http');
  const admin = D.require('api/families/opencde-admin');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const BASE = 'dataspatium-asset://tests/opencde7';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  /** Every request, so that the provider can answer by method and read the bodies (the virtual provider only sees the address). */
  const spy = { requests: [] };
  const realRequest = http.request;
  const spyRequest = (req) => { spy.requests.push(req); return realRequest(req); };
  http.request = spyRequest;
  const last = () => spy.requests[spy.requests.length - 1] || {};
  const bodyOf = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : {}; } catch (_e) { return {}; } };
  /** What the mocked server knows. A sign-in with the admin scope makes the token "fresh" for the dangerous calls once. */
  const world = {
    tokens: 0, scopeAsked: '', fresh: false, popups: 0,
    users: [{ id: 'u1', username: 'admin', name: 'Admin', email: 'admin@example.org', is_admin: true, disabled: false, created_at: '2026-11-01T08:00:00Z', last_sign_in_at: '2026-11-05T09:00:00Z', projects: [{ project_id: 'p1', role: 'manager' }] },
      { id: 'u2', username: 'editor', name: 'Redaktören', email: 'editor@example.org', is_admin: false, disabled: false, created_at: '2026-11-01T08:00:00Z', last_sign_in_at: null, projects: [] }],
    projects: [{ project_id: 'p1', name: 'Bygglovet', created_at: '2026-11-01T08:00:00Z', members: [{ user_id: 'u1', username: 'admin', role: 'manager' }], topics: 2, documents: 1, models: 1 }],
    clients: [{ client_id: 'c1', name: 'Dataspatium', description: '', url: '', public: true, dynamic: true, redirect_uris: ['http://localhost:8080/oauth-callback.html'], disabled: false, created_at: '2026-11-01T08:00:00Z', expires_at: null, last_used_at: '2026-11-05T09:00:00Z', software_id: 'dataspatium', software_version: '2.1.0' },
      { client_id: 'c2', name: 'Robot', description: '', url: '', public: false, dynamic: false, redirect_uris: [], disabled: false, created_at: '2026-11-01T08:00:00Z', expires_at: null, last_used_at: null, software_id: null, software_version: null }],
    sessions: [{ kind: 'oauth2', id: 'f1', user_id: 'u1', username: 'admin', client_id: 'c1', client_name: 'Dataspatium', scope: 'profile bcf documents admin', created_at: '2026-11-05T09:00:00Z', expires_at: '2026-12-05T09:00:00Z' },
      { kind: 'web', id: 's1', user_id: 'u2', username: 'editor', ip: '127.0.0.1', created_at: '2026-11-05T09:00:00Z', expires_at: '2026-11-05T21:00:00Z' }],
    audit: [{ at: '2026-11-05T09:00:00Z', type: 'auth.sign_in', actor: 'u1', client_id: 'c1', ip: '127.0.0.1', request_id: 'r1', details: { ok: true } }],
    writes: [],
  };
  const CAPS = { server: { name: 'Dataregium OpenCDE server', version: '2.1.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, scopes: ['profile', 'bcf', 'documents', 'admin'],
    extensions: { admin_api: { enabled: true, version: '1', url: '/admin/api' }, graph_query: { enabled: true, url: '/admin/api/graph/query', max_rows: 1000, timeout_seconds: 10 } }, limits: {}, links: {} };
  const fakePopup = (url) => { const u = new URL(url); world.popups++; world.scopeAsked = u.searchParams.get('scope') || ''; return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  function dangerous(fn) {
    if (!world.fresh) return json({ message: 'Fresh sign-in needed', code: 'reauthentication_required' }, 403);
    world.fresh = false;
    return fn();
  }
  D.net.virtual('tests/opencde7/', (url) => {
    const u = new URL(url);
    const init = last();
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : u.pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    const method = ((init && init.method) || 'GET').toUpperCase();
    const body = bodyOf(init);
    const r = (x) => Promise.resolve(x);
    if (path === '/.well-known/dataregium') return r(json(CAPS));
    if (path === '/foundation/versions') return r(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return r(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'] }));
    if (path === '/foundation/oauth2/token') { world.tokens++; world.fresh = true; return r(json({ access_token: 'tok' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600, scope: world.scopeAsked })); }
    if (path === '/foundation/oauth2/revoke') return r({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return r(json({ id: 'u1', name: 'Admin' }));
    if (path === '/bcf/3.0/projects') return r(json([{ project_id: 'p1', name: 'Bygglovet' }]));
    if (!path.startsWith('/admin/api/')) return r(json({ message: 'Not Found' }, 404));
    const auth = (init && init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
    if (!auth) return r(json({ message: 'Unauthenticated', code: 'unauthenticated' }, 401));
    if (!world.scopeAsked.split(' ').includes('admin')) return r(json({ message: 'Insufficient scope', code: 'insufficient_scope' }, 403));
    const sub = path.slice('/admin/api'.length);
    const m = (re) => re.exec(sub);
    world.writes.push(method + ' ' + sub);
    if (sub === '/overview') return r(json({ version: '2.1.0', uptime_s: 90061, dialect: 'postgresql', graph_ok: true, users: world.users.length, projects: world.projects.length, clients: world.clients.length, sessions: world.sessions.length, topics: 2, documents: 1, models: 1, request_log: { enabled: true, rows: 12 } }));
    if (sub === '/users' && method === 'GET') { const q = (u.searchParams.get('q') || '').toLowerCase(); const items = world.users.filter((x) => !q || x.username.includes(q) || (x.name || '').toLowerCase().includes(q)); return r(json({ items, total: items.length })); }
    if (sub === '/users' && method === 'POST') { const nu = { id: 'u' + (world.users.length + 1), username: body.username, name: body.name || '', email: body.email || '', is_admin: !!body.is_admin, disabled: false, created_at: '2026-11-05T10:00:00Z', last_sign_in_at: null, projects: [] }; world.users.push(nu); return r(json(Object.assign({}, nu, { initial_password: 'engangs-losen-123' }))); }
    let x = m(/^\/users\/([^/]+)$/);
    if (x && method === 'GET') { const usr = world.users.find((y) => y.id === x[1]); return r(usr ? json(usr) : json({ message: 'No such user', code: 'not_found' }, 404)); }
    if (x && (method === 'PUT' || method === 'PATCH')) { const usr = world.users.find((y) => y.id === x[1]); if (!usr) return r(json({ message: 'No such user', code: 'not_found' }, 404)); if ('is_admin' in body) return r(dangerous(() => { Object.assign(usr, body); return json(usr); })); Object.assign(usr, body); return r(json(usr)); }
    if (x && method === 'DELETE') return r(dangerous(() => { world.users = world.users.filter((y) => y.id !== x[1]); return { kind: 'text', data: '' }; }));
    x = m(/^\/users\/([^/]+)\/reset-password$/);
    if (x && method === 'POST') return r(dangerous(() => json({ password: 'nytt-losen-456' })));
    if (sub === '/projects' && method === 'GET') return r(json({ items: world.projects, total: world.projects.length }));
    if (sub === '/projects' && method === 'POST') { const np = { project_id: 'p' + (world.projects.length + 1), name: body.name, created_at: '2026-11-05T10:00:00Z', members: [], topics: 0, documents: 0, models: 0 }; world.projects.push(np); return r(json(np)); }
    x = m(/^\/projects\/([^/]+)$/);
    if (x && (method === 'PUT' || method === 'PATCH')) { const p = world.projects.find((y) => y.project_id === x[1]); Object.assign(p, body); return r(json(p)); }
    if (x && method === 'DELETE') return r(dangerous(() => { world.projects = world.projects.filter((y) => y.project_id !== x[1]); return { kind: 'text', data: '' }; }));
    x = m(/^\/projects\/([^/]+)\/members\/([^/]+)$/);
    if (x && method === 'PUT') { const p = world.projects.find((y) => y.project_id === x[1]); const usr = world.users.find((y) => y.id === x[2]); const mem = p.members.find((y) => y.user_id === x[2]); if (mem) mem.role = body.role; else p.members.push({ user_id: x[2], username: usr ? usr.username : x[2], role: body.role }); return r(json({ ok: true })); }
    if (x && method === 'DELETE') { const p = world.projects.find((y) => y.project_id === x[1]); p.members = p.members.filter((y) => y.user_id !== x[2]); return r({ kind: 'text', data: '' }); }
    if (sub === '/clients' && method === 'GET') return r(json({ items: world.clients, total: world.clients.length }));
    if (sub === '/clients' && method === 'POST') { const nc = { client_id: 'c' + (world.clients.length + 1), name: body.name, description: body.description || '', url: body.url || '', public: !!body.public, dynamic: false, redirect_uris: body.redirect_uris || [], disabled: false, created_at: '2026-11-05T10:00:00Z', expires_at: null, last_used_at: null }; world.clients.push(nc); return r(json(body.public ? nc : Object.assign({}, nc, { client_secret: 'hemlig-789' }))); }
    x = m(/^\/clients\/([^/]+)\/rotate-secret$/);
    if (x && method === 'POST') return r(dangerous(() => json({ client_secret: 'roterad-000' })));
    x = m(/^\/clients\/([^/]+)\/revoke$/);
    if (x && method === 'POST') return r({ kind: 'text', data: '' });
    x = m(/^\/clients\/([^/]+)$/);
    if (x && (method === 'PUT' || method === 'PATCH')) { const c = world.clients.find((y) => y.client_id === x[1]); Object.assign(c, body); return r(json(c)); }
    if (x && method === 'DELETE') return r(dangerous(() => { world.clients = world.clients.filter((y) => y.client_id !== x[1]); return { kind: 'text', data: '' }; }));
    if (sub === '/sessions' && method === 'GET') { const who = u.searchParams.get('user'); const items = world.sessions.filter((y) => !who || y.user_id === who || y.username === who); return r(json({ items, total: items.length })); }
    if (sub === '/sessions' && method === 'DELETE') { const who = u.searchParams.get('user'); world.sessions = world.sessions.filter((y) => y.user_id !== who && y.username !== who); return r({ kind: 'text', data: '' }); }
    x = m(/^\/sessions\/([^/]+)$/);
    if (x && method === 'DELETE') { world.sessions = world.sessions.filter((y) => y.id !== x[1]); return r({ kind: 'text', data: '' }); }
    if (sub === '/audit') { const type = u.searchParams.get('type'); const items = world.audit.filter((y) => !type || y.type.startsWith(type)); return r(json({ items, total: items.length })); }
    if (sub === '/settings') return r(json({ public_url: 'http://localhost:8000', environment: 'development', dynamic_client_registration: true, request_log: { enabled: true, retention_hours: 72 }, ifcgraph: { enabled: true }, cors_origins: ['null', 'http://localhost:8080'], dataspatium_url: 'http://localhost:8080', graph_public_bolt_url: null, modules: ['bcf', 'documents'], raw: { OPENCDE_PUBLIC_URL: 'http://localhost:8000', OPENCDE_REQUEST_LOG_ENABLED: 'true' } }));
    if (sub === '/health') return r(json({ ok: true, total: 3, checks: [{ name: 'database', ok: true, detail: 'postgresql 16' }, { name: 'graph', ok: true, detail: 'neo4j 5' }, { name: 'storage', ok: true, detail: '12 GB free' }] }));
    if (sub === '/graph/query' && method === 'POST') {
      if (/\b(CREATE|MERGE|SET|DELETE|REMOVE|DROP)\b/i.test(body.cypher)) return r(json({ message: 'Writing statements are refused', code: 'validation_error' }, 400));
      return r(json({ columns: ['n', 'antal'], rows: [[{ identity: '1', labels: ['IfcWall'], properties: { name: 'Vägg 1', gtin: 3 } }, 3]], truncated: false }));
    }
    return r(json({ message: 'Not Found', code: 'not_found' }, 404));
  });
  let connector = null;

  test('opencde VII: the admin scope is asked for at sign-in, the capabilities say the API is on, and every list reads', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    assert.equal(await admin.available(connector), true, 'the capabilities document says admin_api');
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal(admin.hasAdminScope(connector), false, 'a plain sign-in has no admin scope');
    const denied = await admin.overview(connector).catch((e) => e);
    assert.ok(denied instanceof Error && denied.code === 'insufficient_scope', 'without the scope the server refuses: ' + (denied && denied.code));
    await admin.signInAsAdmin(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.ok(world.scopeAsked.split(' ').includes('admin'), 'the scope admin was asked for: ' + world.scopeAsked);
    assert.equal(admin.hasAdminScope(connector), true);
    assert.ok((connector.auth.scope || '').includes('admin'), 'the connector keeps the scope for later sign-ins');
    const o = await admin.overview(connector);
    assert.equal(o.users, 2); assert.equal(o.request_log.rows, 12); assert.equal(o.graph_ok, true);
    const users = await admin.users(connector, { q: 'edit' });
    assert.deepEqual(users.items.map((x) => x.username), ['editor']); assert.equal(users.total, 1);
    assert.equal((await admin.user(connector, 'u1')).username, 'admin');
    assert.equal((await admin.projects(connector, {})).items[0].members[0].role, 'manager');
    assert.equal((await admin.clients(connector)).items.length, 2);
    assert.equal((await admin.sessions(connector, { user: 'editor' })).items[0].kind, 'web');
    assert.equal((await admin.audit(connector, { type: 'auth' })).items.length, 1);
    assert.equal((await admin.settings(connector)).request_log.retention_hours, 72);
    assert.equal((await admin.health(connector)).checks.length, 3);
    const tbl = admin.tableOf('users', world.users);
    assert.equal(tbl.columns[1], 'username'); assert.equal(tbl.rows[0][4], 1); assert.ok(tbl.rows[0][8].includes('manager'), 'the projects column names the role');
    const st = admin.settingsTable(await admin.settings(connector));
    assert.ok(st.rows.some((r) => r[0] === 'request_log.retention_hours' && r[1] === '72'), 'nested settings are flattened');
    assert.ok(st.rows.some((r) => r[0] === 'raw.OPENCDE_PUBLIC_URL'), 'the raw values follow');
    assert.ok(st.rows.some((r) => r[0] === 'cors_origins' && r[1] === 'null, http://localhost:8080'), 'lists are joined');
    return 'ok';
  }, 30000);

  test('opencde VII: writes carry one-time values, and dangerous calls sign in again when the server wants a fresh session', async (assert) => {
    const made = await admin.createUser(connector, { username: 'granskaren', name: 'Granskaren', email: '', is_admin: false });
    assert.equal(made.initial_password, 'engangs-losen-123', 'the initial password comes once');
    await admin.updateUser(connector, made.id, { name: 'Granskaren G' });
    assert.equal(world.users.find((x) => x.id === made.id).name, 'Granskaren G');
    world.fresh = false;
    const popupsBefore = world.popups;
    const reset = await admin.resetPassword(connector, made.id, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal(reset.password, 'nytt-losen-456');
    assert.equal(world.popups, popupsBefore + 1, 'one fresh sign-in for the dangerous call');
    world.fresh = false;
    await admin.updateUser(connector, made.id, { is_admin: true }, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal(world.popups, popupsBefore + 2, 'the administrator flag is dangerous too');
    world.fresh = false;
    await admin.deleteUser(connector, made.id, { popup: fakePopup, redirectUri: REDIRECT });
    assert.ok(!world.users.some((x) => x.id === made.id), 'deleted after the fresh sign-in');
    const other = await admin.deleteUser(connector, 'nobody', { popup: () => Promise.reject(new Error('no popup wanted')), redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(other instanceof Error, 'a fresh sign-in is tried only for reauthentication_required: ' + other.message);
    const proj = await admin.createProject(connector, { name: 'Rivningslovet' });
    await admin.setMember(connector, proj.project_id, 'u2', 'editor');
    assert.equal(world.projects.find((p) => p.project_id === proj.project_id).members[0].role, 'editor');
    await admin.removeMember(connector, proj.project_id, 'u2');
    assert.equal(world.projects.find((p) => p.project_id === proj.project_id).members.length, 0);
    const cl = await admin.createClient(connector, { name: 'Analysrobot', redirect_uris: [], public: false });
    assert.equal(cl.client_secret, 'hemlig-789', 'a confidential client gets its secret once');
    world.fresh = false;
    const rotated = await admin.rotateSecret(connector, cl.client_id, { popup: fakePopup, redirectUri: REDIRECT });
    assert.equal(rotated.client_secret, 'roterad-000');
    assert.equal(await admin.revokeClient(connector, cl.client_id), null, 'revoke answers 204 without a body');
    await admin.endSession(connector, 's1');
    assert.ok(!world.sessions.some((x) => x.id === 's1'));
    await admin.endSessions(connector, 'admin');
    assert.equal(world.sessions.length, 0);
    const g = await admin.graphQuery(connector, 'MATCH (n:IfcWall) RETURN n, count(*) AS antal');
    assert.deepEqual(g.columns, ['n', 'antal']); assert.equal(g.truncated, false);
    const gt = admin.graphTable(g);
    assert.ok(gt.rows[0][0].includes('"labels":["IfcWall"]') && gt.rows[0][1] === 3, 'nodes become JSON text, numbers stay numbers');
    const refused = await admin.graphQuery(connector, 'MATCH (n) DELETE n').catch((e) => e);
    assert.ok(refused instanceof Error && refused.code === 'validation_error', 'a writing statement is refused by the server');
    return 'ok';
  }, 30000);

  test('opencde VII: the card Administration shows the overview, lists the users, creates one with a one-time password and saves a list as a dataset', async (assert) => {
    const panel = D.require('ui/api/admin-panel');
    const got = []; const logged = [];
    const ui = panel.create({ connector, ctx: {}, log: (m) => logged.push(String(m)), onDataset: (m) => got.push(m) });
    document.body.appendChild(ui.el);
    try {
      await ui.start();
      assert.equal(ui.el.hidden, false, 'the card is shown for a server with the API');
      await waitFor(() => ui.el.querySelector('[data-admin-overview]'), 5000, 'the overview');
      assert.ok(ui.el.textContent.includes(t('admin.graph.ok')), 'the graph badge is green');
      await ui.load('users');
      ui.state.tab = 'users'; await ui.load('users');
      await waitFor(() => ui.el.querySelector('[data-admin-user="editor"]'), 5000, 'the user rows');
      assert.ok(ui.el.querySelector('[data-admin-user="admin"]'), 'both users listed');
      // A new user: the form, then the password shown once.
      /** @type {any} */ (ui.el.querySelector('[data-admin-new="user"]')).click();
      const form = await waitFor(() => document.querySelector('dialog[open] [data-admin-form="user"]'), 5000, 'the user form');
      const inputs = Array.from(form.querySelectorAll('dm-input'));
      /** @type {any} */ (inputs[0]).value = 'handlaggaren'; /** @type {any} */ (inputs[1]).value = 'Handläggaren';
      const dlg = form.closest('dialog');
      const readBack = inputs.map((i) => /** @type {any} */ (i).value).join(',') + ' / controls: ' + inputs.map((i) => (i.querySelector('input') ? 'input' : 'none')).join(',') + ' / actions: ' + Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button')).map((b) => JSON.stringify(b.textContent.trim())).join(',');
      /** @type {any} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button')).find((b) => b.textContent.trim() === t('common.save')).querySelector('button')).click();
      let once;
      try { once = await waitFor(() => document.querySelector('dialog[open] [data-admin-once-value]'), 8000, 'the one-time password'); }
      catch (err) { throw new Error(err.message + ' | state: busy=' + ui.state.busy + ' error=' + ui.state.error + ' | log: ' + logged.join(' / ') + ' | dialogs: ' + document.querySelectorAll('dialog[open]').length + ' | users: ' + world.users.map((x) => x.username).join(',') + ' | readBack: ' + readBack + ' | writes: ' + world.writes.slice(-4).join(',')); }
      assert.equal(once.textContent, 'engangs-losen-123');
      assert.ok(!logged.some((m) => m.includes('engangs-losen-123')), 'the password is never logged');
      assert.ok(logged.some((m) => m.includes('handlaggaren')), 'the log names the new user');
      /** @type {any} */ (once.closest('dialog')).close();
      await waitFor(() => ui.el.querySelector('[data-admin-user="handlaggaren"]'), 5000, 'the list loaded again');
      // The list as a dataset.
      /** @type {any} */ (ui.el.querySelector('[data-admin-save="users"]')).click();
      const meta = await waitFor(() => got[0], 10000, 'the dataset');
      created.push(meta.id);
      assert.equal(meta.rowCount, world.users.length);
      const cols = await datasets.columns(meta.id);
      assert.deepEqual(cols.map((c) => c.name).slice(0, 3), ['id', 'username', 'name']);
      assert.equal(meta.source.opencde.kind, 'admin'); assert.equal(meta.source.opencde.admin, 'users');
      // The graph section appears because the capabilities say graph_query is on.
      assert.ok(ui.state.graph, 'graph_query seen in the capabilities');
      ui.state.tab = 'graph'; ui.load('overview');
      await waitFor(() => ui.el.querySelector('[data-admin-graph]'), 5000, 'the graph section');
      /** @type {any} */ (ui.el.querySelector('[data-admin-graph-run]')).click();
      await waitFor(() => ui.state.data.graph, 5000, 'the graph answer');
      assert.ok(ui.el.textContent.includes(t('admin.graph.rows', { n: '1' })), 'one row shown');
    } finally { ui.destroy(); ui.el.remove(); for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close(); }
    return 'ok';
  }, 60000);

  test('opencde VII: a server without the API shows no card, and a saved list fetches again through refetch', async (assert) => {
    const plainBase = 'dataspatium-asset://tests/opencde7-plain';
    D.net.virtual('tests/opencde7-plain/', (url) => {
      const rest = url.startsWith(plainBase) ? url.slice(plainBase.length) : new URL(url).pathname;
      const path = rest.split('?')[0] || '/';
      if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }] }));
      if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: plainBase + '/a', oauth2_token_url: plainBase + '/t' }));
      return Promise.resolve(json({ message: 'Not Found' }, 404));
    });
    const plain = (await families.createConnector('opencde', { baseUrl: plainBase, clientId: 'x', clientSecret: '' })).connector;
    const panel = D.require('ui/api/admin-panel');
    const ui = panel.create({ connector: plain, ctx: {}, log: () => {}, onDataset: () => {} });
    await ui.start();
    assert.equal(ui.el.hidden, true, 'no card without the extension');
    ui.destroy();
    await connectors.remove(plain.id);
    const again = await opencde.refetch(connector, { opencde: { kind: 'admin', admin: 'projects', params: {} } });
    assert.ok(again.columns.includes('project_id') && again.rows.length === world.projects.length, 'refetch gives the list again');
    return 'ok';
  }, 30000);

  test('opencde VII: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_e) { /* gone */ } }
    if (connector) { try { await opencde.logout(connector); } catch (_e) { /* fine */ } await connectors.remove(connector.id); }
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
