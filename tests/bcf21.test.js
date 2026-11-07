// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for BCF API 2.1 next to 3.0, against mocked servers: one of 2.1 alone (no Foundation API, no Documents API, no capabilities, and
 * strict about what 2.1 does not know) and one with both versions, like Kontroll. Discovery, signing in, the tables, the writes, the source
 * view, the issues panel, sending to a CDE, the log, and the choice of version. A real server in both versions is in opencde-live.test.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const http = D.require('api/http');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const fixtures = D.require('tests/fixtures/ifc');
  const overlays = D.require('ui/overlays');
  const basic = D.require('ui/basic');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 8000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const ONLY = 'dataspatium-asset://tests/bcf21';
  const BOTH = 'dataspatium-asset://tests/bcf2130';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const PROJECT = 'p-1';
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const notFound = () => json({ message: 'Not Found' }, 404);
  const png = () => Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0)).buffer;
  /** Every request to these servers, for the method and the body: the provider only sees the address. */
  const seen = [];
  const realRequest = http.request;
  http.request = (req) => { if (String(req.url).startsWith(ONLY)) seen.push(req); return realRequest(req); };
  const requestFor = (url) => { for (let i = seen.length - 1; i >= 0; i--) if (seen[i].url === url) return seen[i]; return {}; };
  const paths = () => seen.map((r) => String(r.url).replace(/^dataspatium-asset:\/\/tests\/bcf(21|2130)/, ''));

  /** What the servers hold. The wall's guid is filled in from the model when the panel is tried. */
  function freshWorld() {
    return {
      authScope: undefined, tokens: 0, ignoreSkip: false,
      topics: [{ guid: 't-1', title: 'Väggen', topic_type: 'Issue', topic_status: 'Open', creation_author: 'anna', creation_date: '2026-11-01T08:00:00Z', labels: ['A'] }],
      comments: { 't-1': [{ guid: 'c-1', date: '2026-11-01T09:00:00Z', author: 'anna', comment: 'Första', topic_guid: 't-1' }, { guid: 'c-2', date: '2026-11-01T10:00:00Z', author: 'bo', comment: 'Svaret', topic_guid: 't-1', reply_to_comment_guid: 'c-1' }] },
      viewpoints: { 't-1': [{ guid: 'v-1', perspective_camera: { camera_view_point: { x: 0, y: 0, z: 0 }, camera_direction: { x: 1, y: 0, z: 0 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 60 }, snapshot: { snapshot_type: 'png' } }] },
      selection: ['GUID'], documents: [{ guid: 'd-1', filename: 'testhus.ifc' }, { guid: 'd-2', filename: 'anteckning.txt' }],
    };
  }
  let world = freshWorld();
  /** BCF API 2.1 as its specification has it. A property that came with 3.0 is refused, which is stricter than Kontroll. */
  function bcf21(path, req, url) {
    const method = String(req.method || 'GET').toUpperCase();
    const body = (() => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : {}; } catch (_e) { return {}; } })();
    const q = new URL(url).searchParams;
    const m = (re) => re.exec(path);
    const r = (x) => Promise.resolve(x);
    if (path === '/auth') return r(json({ oauth2_auth_url: base(url) + '/oauth2/auth', oauth2_token_url: base(url) + '/oauth2/token', oauth2_dynamic_client_reg_url: base(url) + '/bcf/2.1/oauth2/reg', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'] }));
    if (path === '/oauth2/reg' && method === 'POST') return r(json({ client_id: 'registered-21' }));
    if (path === '/current-user') return r(json({ id: 'anna@example.org', name: 'Anna' }));
    if (path === '/projects') return r(json([{ project_id: PROJECT, name: 'Bron' }]));
    if (path === `/projects/${PROJECT}/extensions`) return r(json({ topic_type: ['Issue'], topic_status: ['Open', 'Closed'], topic_label: ['A'], priority: ['High'], user_id_type: ['anna@example.org', 'bo@example.org'], stage: [], snippet_type: [], project_actions: ['createTopic', 'createDocument'], topic_actions: ['update', 'createComment', 'createViewpoint'], comment_actions: ['update'] }));
    if (path === `/projects/${PROJECT}/files_information`) return r(notFound());
    let x = m(new RegExp(`^/projects/${PROJECT}/documents(?:/([^/]+))?$`));
    if (x && !x[1] && method === 'GET') return r(json(world.documents));
    if (x && !x[1] && method === 'POST') { const made = { guid: 'd-' + (world.documents.length + 1), filename: 'uppladdad' }; world.documents.push(made); return r(json(made)); }
    if (x && x[1]) return r(x[1] === 'd-1' ? { kind: 'text', data: fixtures.ifcText({ walls: 1, name: 'testhus.ifc' }) } : { kind: 'text', data: 'en rad text\n' });
    if (path === `/projects/${PROJECT}/topics/events`) return r(json([{ topic_guid: 't-1', date: '2026-11-01T09:00:00Z', author: 'anna', actions: [{ type: 'status_updated', value: 'Open' }] }]));
    if (path === `/projects/${PROJECT}/topics`) {
      if (method === 'POST') { const made = Object.assign({ guid: 't-' + (world.topics.length + 1), creation_author: 'anna', creation_date: '2026-11-02T08:00:00Z' }, body); world.topics.push(made); world.comments[made.guid] = []; world.viewpoints[made.guid] = []; return r(json(made)); }
      if (world.ignoreSkip) return r(json(Array.from({ length: 500 }, (_, i) => ({ guid: 'many-' + i, title: 'x' }))));
      const skip = Number(q.get('$skip')) || 0; const top = Number(q.get('$top')) || 1000;
      return r(json(world.topics.slice(skip, skip + top)));
    }
    x = m(new RegExp(`^/projects/${PROJECT}/topics/([^/]+)$`));
    if (x && method === 'PUT') { const tp = world.topics.find((y) => y.guid === x[1]); if ('server_assigned_id' in body || 'guid' in body) return r(json({ message: 'unknown property' }, 400)); Object.assign(tp, body); return r(json(tp)); }
    x = m(new RegExp(`^/projects/${PROJECT}/topics/([^/]+)/comments$`));
    if (x && method === 'GET') return r(json(world.comments[x[1]] || []));
    if (x && method === 'POST') {
      const list = world.comments[x[1]] || (world.comments[x[1]] = []);
      if (body.reply_to_comment_guid && !list.some((c) => c.guid === body.reply_to_comment_guid)) return r(json({ message: 'no such comment' }, 400));
      const made = Object.assign({ guid: 'c-' + (list.length + 10), date: '2026-11-02T09:00:00Z', author: 'anna', topic_guid: x[1] }, body); list.push(made); return r(json(made));
    }
    x = m(new RegExp(`^/projects/${PROJECT}/topics/([^/]+)/viewpoints$`));
    if (x && method === 'GET') return r(json(world.viewpoints[x[1]] || []));
    if (x && method === 'POST') {
      for (const cam of [body.perspective_camera, body.orthogonal_camera]) if (cam && 'aspect_ratio' in cam) return r(json({ message: 'aspect_ratio is not in BCF API 2.1' }, 400));
      const made = Object.assign({ guid: 'v-' + ((world.viewpoints[x[1]] || []).length + 10) }, body); delete made.components; (world.viewpoints[x[1]] || (world.viewpoints[x[1]] = [])).push(made); return r(json(made));
    }
    x = m(new RegExp(`^/projects/${PROJECT}/topics/([^/]+)/viewpoints/([^/]+)/(selection|coloring|visibility|snapshot)$`));
    if (x && x[3] === 'selection') return r(json({ selection: world.selection.map((g) => ({ ifc_guid: g })) }));
    if (x && x[3] === 'coloring') return r(json({ coloring: [] }));
    if (x && x[3] === 'visibility') return r(json({ visibility: { default_visibility: true } }));
    if (x && x[3] === 'snapshot') return r({ kind: 'binary', data: png() });
    if (m(new RegExp(`^/projects/${PROJECT}/topics/([^/]+)/viewpoints/([^/]+)$`)) && method === 'DELETE') return r(json({ message: 'Method Not Allowed' }, 405));
    return r(notFound());
  }
  const base = (url) => (String(url).startsWith(BOTH) ? BOTH : ONLY);
  /** Token and sign-in answers, on the addresses each server names. */
  function oauth(path) {
    if (path === '/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'tok' + world.tokens, refresh_token: 'ref', expires_in: 3600, scope: world.authScope || '' })); }
    if (path === '/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    return null;
  }
  D.net.virtual('tests/bcf21/', (url) => {
    const path = url.slice(ONLY.length).split('?')[0].split('#')[0] || '/';
    const req = requestFor(url);
    if (world.foundationBlocked && path === '/foundation/versions') return Promise.reject(new TypeError('Failed to fetch'));
    const answer = oauth(path);
    if (answer) return answer;
    if (path === '/bcf/versions') return Promise.resolve(json(world.onlyVersions || { versions: [{ version_id: '2.1', detailed_version: 'https://github.com/buildingSMART/BCF-API/tree/release_2_1' }] }));
    if (path.startsWith('/bcf/2.1/')) return bcf21(path.slice('/bcf/2.1'.length), req, url);
    return Promise.resolve(notFound()); // no Foundation API, no Documents API, no capabilities
  });
  // Both versions with a Foundation API, and 2.1 somewhere else than usual, as `api_base_url` allows.
  const realRequest2 = http.request;
  http.request = (req) => { if (String(req.url).startsWith(BOTH)) seen.push(req); return realRequest2(req); };
  D.net.virtual('tests/bcf2130/', (url) => {
    const path = url.slice(BOTH.length).split('?')[0].split('#')[0] || '/';
    const req = requestFor(url);
    const answer = oauth(path);
    if (answer) return answer;
    const r = (x) => Promise.resolve(x);
    if (path === '/.well-known/kontroll') return r(json({ server: { name: 'Kontroll', version: '2.6.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, bcf_versions: ['3.0', '2.1'], scopes: ['profile', 'bcf', 'documents'], extensions: {}, limits: {}, links: {} }));
    if (path === '/foundation/versions') return r(json({ versions: [{ api_id: 'foundation', version_id: '1.0', api_base_url: BOTH + '/foundation/1.0' }, { api_id: 'bcf', version_id: '3.0', api_base_url: BOTH + '/bcf/3.0' }, { api_id: 'bcf', version_id: '2.1', api_base_url: BOTH + '/v2/bcf/2.1' }, { api_id: 'documents', version_id: '1.0', api_base_url: BOTH + '/documents/1.0' }] }));
    if (path === '/foundation/1.0/auth') return r(json({ oauth2_auth_url: BOTH + '/oauth2/auth', oauth2_token_url: BOTH + '/oauth2/token', oauth2_revocation_url: BOTH + '/oauth2/revoke', oauth2_dynamic_client_reg_url: BOTH + '/foundation/oauth2/reg', oauth2_pkce_required: true }));
    if (path === '/foundation/1.0/current-user') return r(json({ id: 'admin30', name: 'Tretton' }));
    if (path === '/bcf/3.0/projects') return r(json([{ project_id: PROJECT, name: 'Via 3.0' }]));
    if (path === `/bcf/3.0/projects/${PROJECT}/extensions`) return r(json({ topic_status: ['Open'], users: ['a'], project_actions: [], topic_actions: [], comment_actions: [] }));
    if (path === `/bcf/3.0/projects/${PROJECT}/files_information`) return r(json([{ display_information: [{ field_display_name: 'Source', field_value: 'Documents API' }], file: { filename: 'x.ifc', reference: BOTH + '/documents/1.0/documents/doc-1/versions/1/download' } }]));
    if (path === '/v2/bcf/2.1/projects') return r(json([{ project_id: PROJECT, name: 'Via 2.1' }]));
    if (path === '/v2/bcf/2.1/current-user') return r(json({ id: 'admin21', name: 'Tjugoett' }));
    if (path === '/v2/bcf/2.1/auth') return r(json({ oauth2_auth_url: BOTH + '/oauth2/auth', oauth2_token_url: BOTH + '/oauth2/token', oauth2_revocation_url: BOTH + '/oauth2/revoke', oauth2_dynamic_client_reg_url: BOTH + '/v2/bcf/2.1/oauth2/reg' }));
    if (path.startsWith('/v2/bcf/2.1/')) return bcf21(path.slice('/v2/bcf/2.1'.length), req, url);
    return r(notFound());
  });
  const scopeOf = (url) => new URL(url).searchParams.get('scope');
  const fakePopup = (url) => { const u = new URL(url); world.authScope = scopeOf(url) || ''; world.authHadChallenge = !!u.searchParams.get('code_challenge'); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const made = { connectors: [], datasets: [] };
  const addSource = async (address, extra) => {
    const out = await families.createConnector('opencde', Object.assign({ baseUrl: address, clientId: 'dataspatium', clientSecret: '' }, extra || {}));
    made.connectors.push(out.connector.id);
    return out;
  };

  test('bcf 2.1: a server of 2.1 alone is found without a Foundation API, and sign-in asks for no scope it may not know', async (assert) => {
    world = freshWorld();
    const found = await opencde.discover(ONLY);
    assert.deepEqual(found.bcfVersions, ['2.1']); assert.equal(found.bcfVersion, '2.1'); assert.equal(found.foundation, false);
    assert.equal(found.apis.documents, undefined, 'no Documents API');
    assert.equal(found.authUrl, ONLY + '/oauth2/auth', 'the addresses from /bcf/2.1/auth');
    assert.equal(found.registrationUrl, ONLY + '/bcf/2.1/oauth2/reg');
    // A server whose CORS headers cover only its APIs gives no status for the path it lacks.
    world.foundationBlocked = true;
    assert.equal((await opencde.discover(ONLY)).bcfVersion, '2.1', 'also when the first question gets no readable answer');
    world.foundationBlocked = false;
    // Asking for what the server does not have, or a server of neither.
    const no30 = await opencde.discover(ONLY, { bcfVersion: '3.0' }).catch((e) => e);
    assert.equal(no30.message, t('opencde.err.bcf.version', { host: 'tests', version: '3.0', offered: '2.1' }));
    world.onlyVersions = { versions: [{ version_id: '1.0' }] };
    const old = await opencde.discover(ONLY).catch((e) => e);
    assert.equal(old.message, t('opencde.err.bcf.unsupported', { host: 'tests', offered: '1.0', ours: '3.0, 2.1' }), 'a version the app does not speak is said in words');
    world.onlyVersions = null;
    const out = await addSource(ONLY);
    assert.equal(out.discoveryError, null, 'the source was understood');
    const connector = out.connector;
    assert.equal(opencde.bcfVersion(connector), '2.1'); assert.equal(opencde.bcfBase(connector), '/bcf/2.1');
    assert.deepEqual(connector.family.bcfVersions, ['2.1']);
    assert.equal(opencde.hasDocuments(connector), false);
    assert.equal(connector.auth.authUrl, ONLY + '/oauth2/auth');
    await opencde.login(connector, { popup: (url) => { assert.equal(scopeOf(url), null, 'no scope in the sign-in: ' + url); return fakePopup(url); }, redirectUri: REDIRECT });
    assert.ok(world.authHadChallenge, 'PKCE all the same, which a server without it ignores');
    assert.equal(opencde.signedIn(connector), true);
    assert.equal((await opencde.currentUser(connector)).id, 'anna@example.org', 'the user from 2.1\'s own service');
    assert.ok(paths().includes('/bcf/2.1/current-user') && !paths().includes('/foundation/1.0/current-user'), 'not from the Foundation API');
    // Registration at 2.1's own address.
    const reg = await opencde.register(ONLY, { redirectUri: REDIRECT });
    assert.equal(reg.clientId, 'registered-21');
    return 'ok';
  }, 30000);

  test('bcf 2.1: the tables read 2.1, with the differences in the fields ironed out', async (assert) => {
    world = freshWorld();
    const connector = (await addSource(ONLY)).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const ext = await opencde.extensions(connector, PROJECT);
    assert.deepEqual(ext.users, ['anna@example.org', 'bo@example.org'], 'user_id_type read as users');
    const rights = await opencde.rights(connector, PROJECT);
    assert.ok(rights.project.includes('createTopic'));
    const topics = await opencde.fetchTopics(connector, PROJECT);
    assert.equal(topics.rows.length, 1);
    assert.equal(topics.rows[0][topics.columns.indexOf('server_assigned_id')], null, 'no number from a server of 2.1');
    assert.equal(topics.rows[0][topics.columns.indexOf('title')], 'Väggen');
    const comments = await opencde.fetchComments(connector, PROJECT);
    assert.equal(comments.rows[1][comments.columns.indexOf('reply_to_comment_guid')], 'c-1', 'what answers what');
    const components = await opencde.fetchComponents(connector, PROJECT);
    assert.equal(components.rows[0][components.columns.indexOf('ifc_guid')], 'GUID');
    const events = await opencde.fetchEvents(connector, PROJECT);
    assert.equal(events.rows[0][events.columns.indexOf('type')], 'status_updated');
    // Files: no files information, but the documents.
    const files = await opencde.filesList(connector, PROJECT);
    assert.deepEqual(files.map((f) => [f.filename, f.source, f.model, f.documentId]), [['testhus.ifc', 'BCF', true, null], ['anteckning.txt', 'BCF', false, null]]);
    assert.equal(files[0].reference, `/bcf/2.1/projects/${PROJECT}/documents/d-1`);
    assert.ok(!paths().some((p) => p.endsWith('/files_information')), 'it never asked for what 2.1 does not have');
    const fileTable = await opencde.fetchFiles(connector, PROJECT);
    assert.equal(fileTable.rows.length, 2); assert.equal(fileTable.rows[0][0], 'testhus.ifc');
    const model = await opencde.importFile(connector, { project_id: PROJECT, name: 'Bron' }, files[0]);
    made.datasets.push(model.id);
    assert.equal(model.kind, 'model', 'a BCF document that is a model becomes a model');
    assert.equal(model.source.cde.kind, 'bcf-document'); assert.equal(model.source.cde.reference, files[0].reference);
    // Refetching a saved table goes the same way.
    const again = await opencde.refetch(connector, { opencde: { kind: 'topics', projectId: PROJECT } });
    assert.equal(again.rows.length, 1);
    // Paging is optional in 2.1: a server that ignores $skip ends the reading instead of repeating itself to the limit.
    world.ignoreSkip = true;
    const asked = seen.length;
    const many = await opencde.allTopics(connector, PROJECT);
    assert.equal(many.length, 500, 'one page, not forty');
    assert.equal(seen.length - asked, 2, 'it took one more question to see that');
    world.ignoreSkip = false;
    return 'ok';
  }, 60000);

  test('bcf 2.1: writing leaves out what 2.1 does not know, and says so about what it cannot do', async (assert) => {
    world = freshWorld();
    const connector = (await addSource(ONLY)).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const topic = await opencde.createTopic(connector, PROJECT, { title: 'Ny', topic_status: 'Open' });
    assert.equal(topic.title, 'Ny');
    // The camera from the 3D view carries an aspect ratio, which came with 3.0.
    const camera = D.require('data/bcf-xml').cameraFromView({ position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 50, aspect: 1.5 });
    assert.ok('aspect_ratio' in camera, 'the view gives one');
    const vp = await opencde.createViewpoint(connector, PROJECT, topic.guid, { perspective_camera: camera, components: { selection: [{ ifc_guid: 'X' }] } });
    assert.ok(vp.guid, 'the strict server took the viewpoint');
    assert.ok(!JSON.stringify(vp).includes('aspect_ratio'));
    assert.ok('aspect_ratio' in camera, 'and what was handed in is left as it was');
    const refused = await opencde.deleteViewpoint(connector, PROJECT, topic.guid, vp.guid).catch((e) => e);
    assert.equal(refused.message, t('opencde.err.bcf21.deleteviewpoint'), 'told before anything is asked');
    const comment = await opencde.createComment(connector, PROJECT, 't-1', { comment: 'Håller med', reply_to_comment_guid: 'c-1' });
    assert.equal(comment.reply_to_comment_guid, 'c-1', 'a reply');
    const doc = await opencde.uploadBcfDocument(connector, PROJECT, new File(['x'], 'a.txt'));
    assert.ok(doc.guid, 'a BCF document goes up as in 3.0');
    // A connector of 3.0 keeps the aspect ratio, and viewpoints go as they are.
    const three = { family: { type: 'opencde', bcfVersion: '3.0' } };
    assert.ok('aspect_ratio' in opencde.viewpointFor(three, { perspective_camera: camera }).perspective_camera);
    return 'ok';
  }, 30000);

  test('bcf 2.1: the source view reads a server of 2.1 alone and leaves out what it lacks', async (assert) => {
    world = freshWorld();
    const connector = (await addSource(ONLY)).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const view = D.require('ui/api/opencde-view').create({ connector, ctx: {}, log() {}, onDataset: (m) => made.datasets.push(m.id), onConnector() {} });
    document.body.appendChild(view.el);
    try {
      view.start();
      await waitFor(() => view.state.projects, 8000, 'the projects');
      await waitFor(() => view.el.querySelector('[data-opencde-files]'), 8000, 'the cards');
      assert.equal(view.el.querySelector('[data-opencde-bcf]').getAttribute('data-opencde-bcf'), '2.1');
      assert.ok(view.el.textContent.includes(t('opencde.bcf.speaks', { version: '2.1' })), 'it says which version');
      assert.ok(!view.el.querySelector('[data-opencde-bcf-select]'), 'and offers no choice where there is none');
      assert.ok(!view.el.querySelector('[data-opencde-documents]'), 'no Documents API, no button for it');
      assert.ok(view.el.querySelector('[data-ifcgraph-card]').hidden, 'no graph card without capabilities');
      await view.fetchKind(view.KINDS[0]);
      assert.equal(view.state.error, ''); assert.equal(view.state.result.rows.length, 1);
      await view.loadFiles();
      await waitFor(() => view.el.querySelector('[data-opencde-file="testhus.ifc"]'), 5000, 'the file');
      assert.equal(view.el.querySelector('[data-opencde-files-bcf21]').textContent, t('opencde.files.bcf21'), 'what the list covers');
    } finally { view.destroy(); view.el.remove(); }
    return 'ok';
  }, 30000);

  test('bcf 2.1: the issues panel reads, answers and writes through 2.1', async (assert) => {
    world = freshWorld();
    const connector = (await addSource(ONLY)).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const model = await importer.run(fixtures.ifcFile({ walls: 1 }), { format: 'model' }, null, 'Bron');
    made.datasets.push(model.id);
    const opened = await datasets.ensureOpen(model.id);
    const res = await opened.engine.exec("select guid from data where lower(typ) like '%wall%' limit 1");
    world.selection = [String(res[0].values[0][0])];
    const ctx = { ui: { button: basic.button, toast: overlays.toast, dialog: overlays.dialog }, shell: { log() {} }, services: { files: { download() {}, safeName: (n, e) => `${n}.${e}` } } };
    const selected = [];
    const panel = D.require('ui/bearbeta/model-issues').create(ctx, model, { connectorId: connector.id, projectId: PROJECT, select: (ids) => selected.push(ids), view: () => ({ position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 50, aspect: 1.5 }), marked: () => [] });
    document.body.appendChild(panel.el);
    try {
      await panel.start();
      await waitFor(() => panel.state.topics, 8000, 'the topics');
      assert.equal(panel.state.error, '');
      assert.ok(panel.el.querySelector('[data-issue="t-1"]').textContent.includes('Väggen'), 'a topic without a number shows its title');
      assert.deepEqual(panel.state.ext.users, ['anna@example.org', 'bo@example.org'], 'who can be assigned, from user_id_type');
      await panel.choose(panel.state.topics[0]);
      assert.equal(selected[selected.length - 1].length, 1, 'the wall is marked');
      assert.ok(panel.state.snapshot, 'the snapshot came through 2.1');
      assert.ok(paths().includes(`/bcf/2.1/projects/${PROJECT}/topics/t-1/viewpoints/v-1/snapshot`));
      // The replies that only 2.1 has.
      await waitFor(() => panel.el.querySelector('[data-issue-reply-to]'), 5000, 'the reply shown');
      assert.equal(panel.el.querySelector('[data-issue-comment-item="c-2"] [data-issue-reply-to]').textContent.trim(), t('issues.comment.reply.to', { author: 'anna' }));
      /** @type {any} */ (panel.el.querySelector('[data-issue-reply="c-2"]')).click();
      assert.ok(panel.el.querySelector('[data-issue-answering]').textContent.includes('bo'), 'whom the box answers');
      panel.state.comment = 'Ett svar';
      await panel.sendComment();
      const sent = world.comments['t-1'][world.comments['t-1'].length - 1];
      assert.equal(sent.reply_to_comment_guid, 'c-2'); assert.equal(sent.comment, 'Ett svar');
      assert.equal(panel.state.replyTo, '', 'and it lets go');
      panel.state.comment = 'Utan svar';
      await panel.sendComment();
      assert.equal(world.comments['t-1'][world.comments['t-1'].length - 1].reply_to_comment_guid, undefined, 'a comment is not an answer unless asked');
      // A status: the PUT sends back what is not the server's. The strict mock refuses guid and number.
      await panel.setStatus('Closed');
      assert.equal(panel.state.error, ''); assert.equal(world.topics[0].topic_status, 'Closed');
      await panel.saveBcf();
      assert.equal(panel.state.error, '', 'and everything as a BCF file, through 2.1');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 60000);

  test('bcf 2.1: sending to a server without the Documents API goes as a BCF document', async (assert) => {
    world = freshWorld();
    const connector = (await addSource(ONLY)).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const table = await datasets.create({ name: 'Till CDE 2.1', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    made.datasets.push(table.id);
    const panel = D.require('ui/share/cde-send').create({ ui: { button: basic.button, toast: overlays.toast }, shell: { log() {} }, services: { exporter: D.require('io/export'), files: D.require('platform/files') } }, { dataset: () => table });
    document.body.appendChild(panel.el);
    try {
      await panel.start();
      panel.state.connector = connector;
      panel.state.projects = [{ project_id: PROJECT, name: 'Bron' }]; panel.state.projectId = PROJECT;
      panel.render();
      assert.equal(panel.state.how, 'bcf', 'the only way there is');
      const labels = Array.from(panel.el.querySelectorAll('dm-select')).map((sel) => /** @type {any} */ (sel).options || []).flat().map((o) => o.label);
      assert.ok(labels.includes(t('cde.send.how.bcf')) && !labels.includes(t('cde.send.how.documents')), 'no Documents API among the choices');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('bcf 2.1: a server with both speaks the newest unless told, and the source can change, also where the server says the API lives', async (assert) => {
    world = freshWorld();
    const newest = await opencde.discover(BOTH);
    assert.deepEqual(newest.bcfVersions, ['3.0', '2.1'], 'the versions, newest first');
    assert.equal(newest.bcfVersion, '3.0'); assert.equal(newest.apis.bcf, '3.0'); assert.equal(newest.apis.documents, '1.0'); assert.equal(newest.foundation, true);
    assert.equal(newest.registrationUrl, BOTH + '/foundation/oauth2/reg');
    assert.deepEqual(newest.bcfBases, { '2.1': '/v2/bcf/2.1' }, 'only what is not where it usually is');
    const asked21 = await opencde.discover(BOTH, { bcfVersion: '2.1' });
    assert.equal(asked21.bcfVersion, '2.1');
    assert.equal(asked21.registrationUrl, BOTH + '/v2/bcf/2.1/oauth2/reg', 'a client of 2.1 reads what 2.1 says about signing in');
    const connector = (await addSource(BOTH)).connector;
    assert.equal(opencde.bcfVersion(connector), '3.0'); assert.equal(opencde.hasDocuments(connector), true);
    await opencde.login(connector, { popup: (url) => { assert.equal(scopeOf(url), opencde.SCOPES, 'this server has named its scopes'); return fakePopup(url); }, redirectUri: REDIRECT });
    assert.equal((await opencde.projects(connector))[0].name, 'Via 3.0');
    const view = D.require('ui/api/opencde-view').create({ connector, ctx: {}, log() {}, onDataset() {}, onConnector() {} });
    document.body.appendChild(view.el);
    try {
      view.start();
      await waitFor(() => view.state.projects, 8000, 'the projects');
      await waitFor(() => view.el.querySelector('[data-opencde-bcf-select]'), 5000, 'the choice');
      const sel = /** @type {any} */ (view.el.querySelector('[data-opencde-bcf-select]'));
      assert.deepEqual(sel.options.map((o) => o.value), ['3.0', '2.1']);
      await waitFor(() => view.el.querySelector('[data-opencde-documents]'), 5000, 'the Documents API is there');
      await view.changeVersion('2.1');
      assert.equal(opencde.bcfVersion(connector), '2.1'); assert.equal(opencde.bcfBase(connector), '/v2/bcf/2.1');
      assert.equal(view.state.projects[0].name, 'Via 2.1', 'the projects read through 2.1, at its own address');
      assert.equal(view.state.user.id, 'admin21', 'and the user');
      assert.ok(view.el.querySelector('[data-opencde-documents]'), 'the Documents API stays, whichever version of BCF is spoken');
      await view.loadFiles();
      await waitFor(() => view.el.querySelector('[data-opencde-files-bcf21]'), 5000, 'the note');
      assert.equal(view.el.querySelector('[data-opencde-files-bcf21]').textContent, t('opencde.files.bcf21.documents'), 'it says where the rest is');
      const saved = await connectors.get(connector.id);
      assert.equal(saved.family.bcfVersion, '2.1', 'the choice is kept');
      await view.changeVersion('3.0');
      assert.equal(view.state.projects[0].name, 'Via 3.0', 'and back');
    } finally { view.destroy(); view.el.remove(); }
    // A source saved before there was a choice speaks 3.0, and learns the choices from the capabilities.
    const older = { baseUrl: BOTH, family: { type: 'opencde', clientId: 'x' }, auth: {} };
    assert.equal(opencde.bcfVersion(older), '3.0'); assert.equal(opencde.bcfBase(older), '/bcf/3.0'); assert.equal(opencde.hasDocuments(older), true);
    assert.deepEqual(opencde.bcfVersionsOf(older, null), ['3.0']);
    assert.deepEqual(opencde.bcfVersionsOf(older, { present: true, bcfVersions: ['3.0', '2.1', '9.9'] }), ['3.0', '2.1'], 'what the app also speaks');
    const refused = await opencde.setBcfVersion(older, '1.0').catch((e) => e);
    assert.ok(refused instanceof Error, 'no version the app does not speak');
    return 'ok';
  }, 60000);

  test('bcf 2.1: the dialog keeps the version choice under more options, and the log has words for what 2.1 asks', async (assert) => {
    world = freshWorld();
    const dialog = D.require('ui/api/family-dialog');
    const p = dialog.open({}, { family: 'opencde', values: { baseUrl: BOTH, clientId: 'dataspatium' } });
    const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
    let connector = null;
    try {
      const choice = /** @type {any} */ (dlg.querySelector('[data-family-field="bcfVersion"]'));
      assert.ok(choice && choice.closest('details.dm-more'), 'under more options');
      assert.equal(choice.value, 'auto');
      assert.equal(choice.options[0].label, t('families.bcfVersion.auto'));
      choice.value = '2.1'; choice.dispatchEvent(new Event('change', { bubbles: true }));
      /** @type {any} */ (Array.from(dlg.querySelectorAll('dm-button[variant="primary"] button')).pop()).click();
      connector = await p;
    } finally { for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close(); }
    made.connectors.push(connector.id);
    assert.equal(opencde.bcfVersion(connector), '2.1', 'the choice reached the source');
    const cdeLog = D.require('api/cde-log');
    for (const [path, op] of [['/bcf/versions', 'versions'], ['/bcf/2.1/auth', 'auth'], ['/bcf/2.1/current-user', 'current_user']]) {
      const c = cdeLog.classify('GET', 'http://x' + path);
      assert.equal(c.api, 'bcf', path); assert.equal(c.operation, op, path);
      const key = `cdelog.op.bcf.${op}`;
      assert.ok(t(key) !== key, key);
    }
    assert.equal(cdeLog.classify('GET', 'http://x/bcf/2.1/projects/p/topics').operation, 'topics', 'the rest is the same');
    return 'ok';
  }, 30000);

  test('bcf 2.1: cleanup', async () => {
    for (const id of made.datasets) { try { await datasets.remove(id, { quiet: true }); } catch (_e) { /* removed earlier */ } }
    for (const id of made.connectors) { try { await connectors.remove(id); } catch (_e) { /* removed earlier */ } }
    return 'ok';
  });
})();
