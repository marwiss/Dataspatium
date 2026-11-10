// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the card Projektets medlemmar (Dataregium's project administration, its OB-41) against a mocked server: the scope project
 * asked for at sign-in, the projects the user manages and their members, adding by user name, a user who does not exist, changing a
 * role, removing a member, the refusal to leave a project without a manager, renaming through the BCF API, and a server without it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const http = D.require('api/http');
  const manage = D.require('api/families/opencde-manage');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const BASE = 'dataspatium-asset://tests/manage';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const world = { on: true, scopeAsked: '', requests: [], project: { project_id: 'p1', name: 'Bygglovet' },
    members: [{ user_id: 'u1', username: 'anna', name: 'Anna', role: 'manager' }, { user_id: 'u2', username: 'bo', name: 'Bo', role: 'editor' }],
    users: { anna: 'u1', bo: 'u2', cecilia: 'u3' } };
  const fakePopup = (url) => { const u = new URL(url); world.scopeAsked = u.searchParams.get('scope') || ''; return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const managers = () => world.members.filter((m) => m.role === 'manager').length;
  D.net.virtual('tests/manage/', (url) => {
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname;
    const path = rest.split('?')[0];
    const req = world.requests[world.requests.length - 1] || {};
    const method = String(req.method || 'GET').toUpperCase();
    let body = {}; try { body = typeof req.body === 'string' ? JSON.parse(req.body) : {}; } catch (_e) { body = {}; }
    if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, scopes: ['profile', 'bcf', 'documents', 'project'],
      extensions: world.on ? { project_administration: { enabled: true, url: '/manage/1.0/projects', scope: 'project', roles: ['viewer', 'contributor', 'editor', 'manager'], for: 'manager' } } : {} }));
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600, scope: world.scopeAsked }));
    if (path === '/manage/1.0/projects') return Promise.resolve(json({ items: [world.project], total: 1 }));
    if (path === '/manage/1.0/projects/p1/members') {
      if (method === 'POST') {
        const id = world.users[body.username];
        if (!id) return Promise.resolve(json({ message: 'No such user', code: 'not_found' }, 404));
        const m = world.members.find((x) => x.user_id === id);
        if (m) { m.role = body.role; return Promise.resolve(json(m, 200)); }
        const added = { user_id: id, username: body.username, name: body.username, role: body.role };
        world.members.push(added);
        return Promise.resolve(json(added, 201));
      }
      return Promise.resolve(json({ items: world.members, total: world.members.length }));
    }
    const member = /^\/manage\/1\.0\/projects\/p1\/members\/(.+)$/.exec(path);
    if (member) {
      const m = world.members.find((x) => x.user_id === member[1]);
      if (!m) return Promise.resolve(json({ message: 'Not Found' }, 404));
      const lastManager = m.role === 'manager' && managers() === 1;
      if (method === 'PUT') { if (lastManager && body.role !== 'manager') return Promise.resolve(json({ message: 'A project needs a manager', code: 'conflict' }, 409)); m.role = body.role; return Promise.resolve(json({ user_id: m.user_id, role: m.role })); }
      // The server answers 204; the virtual network cannot build a 204 with a body, so the mock answers 200 with nothing in it.
      if (method === 'DELETE') { if (lastManager) return Promise.resolve(json({ message: 'A project needs a manager', code: 'conflict' }, 409)); world.members = world.members.filter((x) => x !== m); return Promise.resolve({ kind: 'text', data: '' }); }
    }
    if (path === '/bcf/3.0/projects/p1' && method === 'PUT') { world.project.name = body.name; return Promise.resolve(json({ project_id: 'p1', name: body.name })); }
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });

  test('manage: a project\'s manager signs in with the scope project, lists the members, adds, changes roles, removes and renames, and cannot leave the project without a manager', async (assert) => {
    const realRequest = http.request;
    http.request = (req) => { world.requests.push(req); return realRequest(req); };
    const { connector } = await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' });
    const panel = D.require('ui/api/manage-panel').create({ connector, log: () => {} });
    document.body.appendChild(panel.el);
    try {
      await panel.start();
      assert.ok(!panel.el.hidden && panel.el.querySelector('[data-manage-signin]'), 'the card and its sign-in when the server has the extension');
      const ext = await manage.extension(connector);
      assert.deepEqual([ext.url, ext.scope, ext.roles.length], ['/manage/1.0/projects', 'project', 4], 'the extension as announced');
      await manage.signIn(connector, ext.scope, { popup: fakePopup, redirectUri: REDIRECT });
      assert.ok(world.scopeAsked.split(' ').includes('project') && world.scopeAsked.split(' ').includes('bcf'), 'the scope project asked for beside the others: ' + world.scopeAsked);
      assert.ok(manage.hasScope(connector, 'project'), 'the session holds it');
      await panel.loadProjects();
      assert.equal(panel.state.projectId, 'p1');
      assert.equal(panel.el.querySelector('[data-manage-members]').getAttribute('data-manage-members'), '2', 'two members listed');
      assert.ok(panel.el.querySelector('[data-manage-member="u2"]').textContent.includes('Bo'), 'by name');
      // Add by exact user name.
      assert.ok(await panel.add('cecilia', 'contributor'), 'added');
      const post = world.requests.filter((r) => String(r.method).toUpperCase() === 'POST' && String(r.url).endsWith('/members')).pop();
      assert.deepEqual(JSON.parse(post.body), { username: 'cecilia', role: 'contributor' }, 'the body the server wants');
      assert.equal(panel.el.querySelector('[data-manage-members]').getAttribute('data-manage-members'), '3');
      // A user who does not exist.
      assert.ok(!(await panel.add('nobody', 'viewer')), 'refused');
      assert.equal(panel.state.error, t('manage.err.noUser', { username: 'nobody' }), 'told in the user\'s words');
      // Change a role, then remove a member.
      assert.ok(await panel.setRole('u2', 'manager', { confirmed: true }), 'Bo is a manager');
      assert.equal(world.members.find((m) => m.user_id === 'u2').role, 'manager');
      assert.ok(await panel.remove('u2', { confirmed: true }), 'Bo removed');
      assert.ok(!world.members.some((m) => m.user_id === 'u2'));
      // Anna is the last manager: neither removed nor demoted.
      assert.ok(!(await panel.remove('u1', { confirmed: true })), 'the last manager stays');
      assert.equal(panel.state.error, t('manage.err.lastManager'));
      assert.ok(!(await panel.setRole('u1', 'viewer', { confirmed: true })), 'nor demoted');
      assert.equal(panel.state.error, t('manage.err.lastManager'));
      // Rename through the BCF API.
      assert.ok(await panel.rename('Bygglovet, etapp 2'), 'renamed');
      const put = world.requests.filter((r) => String(r.method).toUpperCase() === 'PUT' && /\/bcf\/3\.0\/projects\/p1$/.test(String(r.url))).pop();
      assert.deepEqual(JSON.parse(put.body), { name: 'Bygglovet, etapp 2' });
      assert.ok(panel.el.querySelector('[data-manage-project]') && panel.state.projects[0].name === 'Bygglovet, etapp 2', 'the new name read back');
      // A server without the extension shows no card.
      world.on = false;
      const { connector: other } = await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' });
      await opencde.capabilities(other, { force: true });
      const none = D.require('ui/api/manage-panel').create({ connector: other });
      await none.start();
      assert.ok(none.el.hidden, 'hidden without the extension');
      await connectors.remove(other.id);
    } finally {
      http.request = realRequest; world.on = true;
      panel.el.remove();
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id);
    }
    return 'ok';
  }, 20000);
})();
