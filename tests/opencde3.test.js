// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Dataregium II against a mocked OpenCDE server (virtual providers and a spy on api/http, no network): the app registers
 * itself when the server allows it, a new issue from the marked elements with the view as viewpoint, a comment and a new status
 * from the panel, the project as a BCF file and the file back as tables, and Dela sending a dataset through the Documents API
 * and as a BCF document.
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
  const facets = D.require('data/facets');
  const bcfXml = D.require('data/bcf-xml');
  const importer = D.require('io/import');
  const http = D.require('api/http');
  const fixtures = D.require('tests/fixtures/ifc');
  const BASE = 'dataspatium-asset://tests/opencde3';
  const PROJECT = 'aaaaaaaa-1111-4222-8333-444444444444';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  const buttonIn = (el, text) => Array.from(el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const openDialog = () => document.querySelector('dialog[open]');
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  /** Every request, so that providers can answer by method and the tests can read the bodies. */
  const spy = { requests: [] };
  const realRequest = http.request;
  const spyRequest = (req) => { spy.requests.push(req); return realRequest(req); };
  http.request = spyRequest;
  const last = () => spy.requests[spy.requests.length - 1] || {};
  const bodyOf = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : null; } catch (_e) { return null; } };
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  const text = (data) => ({ kind: 'text', data });
  const uuid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const world = { tokens: 0, topics: [], comments: new Map(), viewpoints: new Map(), files: new Map(), parts: [], documents: [], registrations: 0 };
  let snapshotBytes = null;
  function png() {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30;
    const g = canvas.getContext('2d'); g.fillStyle = '#009e73'; g.fillRect(0, 0, 40, 30);
    const bin = atob(canvas.toDataURL('image/png').split(',')[1]); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  D.net.virtual('tests/opencde3/', (url) => {
    const u = new URL(url);
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : u.pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    const req = last(); const method = (req.method || 'GET').toUpperCase(); const body = bodyOf(req) || {};
    const p = `/bcf/3.0/projects/${PROJECT}`;
    const m = (re) => re.exec(path);
    let r;
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', oauth2_dynamic_client_reg_url: BASE + '/foundation/oauth2/reg', oauth2_pkce_required: true }));
    if (path === '/foundation/oauth2/reg' && world.refuse) return Promise.resolve({ kind: 'text', data: JSON.stringify(world.refuse), status: 400 });
    if (path === '/foundation/oauth2/reg') { world.registrations++; return Promise.resolve(json({ client_id: 'registered-' + world.registrations, client_name: body.client_name, redirect_uris: body.redirect_uris })); }
    if (path === '/foundation/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'a' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600 })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve(text(''));
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'officer', name: 'Handläggaren' }));
    if (path === '/bcf/3.0/projects') return Promise.resolve(json([{ project_id: PROJECT, name: 'Bygglovet' }]));
    if (path === p) return Promise.resolve(json({ project_id: PROJECT, name: 'Bygglovet', authorization: { project_actions: ['createTopic', 'createDocument'] } }));
    if (path === `${p}/extensions`) return Promise.resolve(json({ topic_type: ['Issue', 'Request'], topic_status: ['Open', 'In progress', 'Closed'], topic_label: ['Safety'], priority: ['Low', 'High'], users: ['officer', 'developer'], project_actions: ['createTopic', 'createDocument'], topic_actions: ['update', 'createComment', 'createViewpoint', 'updateFiles'], comment_actions: ['update'] }));
    if (path === `${p}/topics`) {
      if (method === 'POST') { const tp = Object.assign({ guid: uuid(100 + world.topics.length), server_assigned_id: 'K-' + (100 + world.topics.length), creation_author: 'officer', creation_date: '2026-11-05T10:00:00Z', labels: [] }, body); world.topics.push(tp); return Promise.resolve(json(tp)); }
      if (u.searchParams.get('$skip') && u.searchParams.get('$skip') !== '0') return Promise.resolve(json([]));
      return Promise.resolve(json(world.topics));
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)$/))) {
      const tp = world.topics.find((x) => x.guid === r[1]);
      if (method === 'PUT' && tp) { Object.assign(tp, body, { modified_date: '2026-11-05T11:00:00Z', modified_author: 'officer' }); return Promise.resolve(json(tp)); }
      if (method === 'DELETE') { world.topics = world.topics.filter((x) => x.guid !== r[1]); return Promise.resolve(text('')); }
      return Promise.resolve(tp ? json(tp) : { kind: 'text', data: '{"message":"Not Found"}', status: 404 });
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/comments$/))) {
      const list = world.comments.get(r[1]) || [];
      if (method === 'POST') { const c = Object.assign({ guid: uuid(500 + list.length), topic_guid: r[1], date: '2026-11-05T12:00:00Z', author: 'officer' }, body); list.push(c); world.comments.set(r[1], list); return Promise.resolve(json(c)); }
      return Promise.resolve(json(list));
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/viewpoints$/))) {
      const list = world.viewpoints.get(r[1]) || [];
      if (method === 'POST') { const vp = Object.assign({ guid: uuid(700 + list.length) }, body); list.push(vp); world.viewpoints.set(r[1], list); return Promise.resolve(json({ guid: vp.guid, snapshot: vp.snapshot ? { snapshot_type: vp.snapshot.snapshot_type } : undefined, perspective_camera: vp.perspective_camera })); }
      return Promise.resolve(json(list.map((vp) => ({ guid: vp.guid, snapshot: vp.snapshot ? { snapshot_type: vp.snapshot.snapshot_type } : undefined, perspective_camera: vp.perspective_camera }))));
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/viewpoints\/([^/]+)\/(selection|coloring|visibility|snapshot)$/))) {
      const vp = (world.viewpoints.get(r[1]) || []).find((x) => x.guid === r[2]) || { components: {} };
      const c = vp.components || {};
      if (r[3] === 'selection') return Promise.resolve(json({ selection: c.selection || [] }));
      if (r[3] === 'coloring') return Promise.resolve(json({ coloring: c.coloring || [] }));
      if (r[3] === 'visibility') return Promise.resolve(json({ visibility: c.visibility || { default_visibility: true } }));
      return Promise.resolve({ kind: 'binary', data: snapshotBytes || (snapshotBytes = png()) });
    }
    // A topic's model files (BCF 3.3.2 and 3.3.3): what was put is what is given.
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/files$/))) {
      if (method === 'PUT') world.files.set(r[1], Array.isArray(bodyOf(req)) ? bodyOf(req) : []);
      return Promise.resolve(json(world.files.get(r[1]) || []));
    }
    if (path === `${p}/documents`) { const doc = { guid: uuid(900 + world.documents.length), filename: /filename="([^"]+)"/.exec(String((req.headers || {})['Content-Disposition'] || ''))?.[1] || 'document' }; world.documents.push(doc); return Promise.resolve(json(doc)); }
    if (path === '/documents/1.0/upload-documents') return Promise.resolve(json({ upload_ui_url: BASE + '/documents/1.0/upload-ui/tok', expires_in: 600, max_size_in_bytes: 1073741824, files: body.files }));
    if (path === '/documents/1.0/upload-sessions/s1/instructions') {
      const size = Number(((body.files || [])[0] || {}).size_in_bytes) || 0;
      const half = Math.max(1, Math.floor(size / 2));
      return Promise.resolve(json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: BASE + '/upload-part/1', http_method: 'PUT', content_range_start: 0, content_range_end: half - 1, include_authorization: true }, { url: BASE + '/upload-part/2', http_method: 'PUT', content_range_start: half, content_range_end: size - 1, additional_headers: { values: [{ name: 'X-Part', value: '2' }] } }], upload_completion: { url: BASE + '/documents/1.0/upload-sessions/s1/files/0/complete' }, upload_cancellation: { url: BASE + '/cancel' } }] }));
    }
    if (path.startsWith('/upload-part/')) { world.parts.push({ url: path, size: req.body && req.body.byteLength !== undefined ? req.body.byteLength : (req.body && req.body.size) || 0, headers: req.headers }); return Promise.resolve(text('')); }
    if (path === '/documents/1.0/upload-sessions/s1/files/0/complete') return Promise.resolve(json({ document_id: world.lastDocumentId || 'doc-new', version_index: world.lastDocumentId ? 2 : 1, version_number: world.lastDocumentId ? '2' : '1', title: 'Skickad', links: { document_version_download: { url: BASE + '/documents/1.0/documents/doc-new/versions/1/download' } } }));
    return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null; let model = null; let wallGuids = [];

  test('opencde III: the app registers itself when the server allows it, and otherwise says so', async (assert) => {
    const reg = await opencde.register(BASE, { redirectUri: REDIRECT });
    assert.equal(reg.clientId, 'registered-1');
    const sent = bodyOf(spy.requests.filter((r) => r.url.endsWith('/foundation/oauth2/reg')).pop());
    assert.equal(sent.token_endpoint_auth_method, 'none', 'a public client');
    assert.deepEqual(sent.redirect_uris, [REDIRECT]);
    assert.equal(sent.software_id, 'dataspatium'); assert.equal(sent.software_version, D.version, 'the app says which version registers');
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: reg.clientId, clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.ok(opencde.signedIn(connector));
    const without = await opencde.register('dataspatium-asset://tests/opencde2', { redirectUri: REDIRECT }).catch((e) => e);
    assert.ok(without instanceof Error && without.message === t('opencde.err.noregistration'), String(without && without.message));
    // A refusal is told in the app's language when it has a code, with the server's message otherwise, never as raw JSON.
    world.refuse = { message: 'A redirect to localhost is not allowed here', code: 'localhost_redirect' };
    const coded = await opencde.register(BASE, { redirectUri: 'http://localhost:8080/oauth-callback.html' }).catch((e) => e);
    assert.equal(coded.message, t('opencde.err.registration', { detail: t('opencde.err.code.localhost_redirect') }));
    assert.ok(t('opencde.err.code.localhost_redirect').includes('127.0.0.1'), 'it says what to do instead');
    world.refuse = { message: 'Registrations are closed' };
    const plain = await opencde.register(BASE, { redirectUri: REDIRECT }).catch((e) => e);
    assert.equal(plain.message, t('opencde.err.registration', { detail: 'Registrations are closed' }));
    world.refuse = null;
    return reg.clientId;
  }, 30000);

  test('opencde III: a new issue from the marked elements, with the view as its viewpoint', async (assert) => {
    model = await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Kontrollhuset');
    created.push(model.id);
    const cols = await datasets.columns(model.id);
    const g = cols.findIndex((c) => c.name === 'guid'); const typ = cols.findIndex((c) => c.name === 'typ'); const idAt = cols.findIndex((c) => c.name === 'id');
    const walls = (await datasets.query(model.id, {})).filter((r) => /wall/i.test(String(r[typ])));
    wallGuids = walls.map((r) => String(r[g]));
    const firstWall = { id: Number(walls[0][idAt]), guid: wallGuids[0] };
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 3000, 'dataset');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: model.id, openElement: { datasetId: model.id, id: firstWall.id } });
      const toggle = await waitFor(() => root.querySelector('[data-model-issues-toggle]'), 8000, 'the button');
      await waitFor(() => root.querySelector('.dm-model-canvas'), 15000, 'the 3D view');
      toggle.click();
      const panel = await waitFor(() => root.querySelector('[data-model-issues]'), 5000, 'the panel');
      // No source on this model: the first OpenCDE connector is offered, signed in already.
      await waitFor(() => buttonIn(panel, t('issues.fetch')), 5000, 'fetch button');
      (await waitFor(() => buttonIn(panel, t('issues.fetch')), 5000, 'fetch button')).click();
      const newBtn = await waitFor(() => panel.querySelector('[data-issue-new]'), 8000, 'the new button');
      newBtn.click();
      const dlg = await waitFor(openDialog, 3000, 'dialog');
      assert.ok(dlg.textContent.includes(t('issues.new.marked', { n: '1' })), 'one marked element: ' + dlg.textContent.slice(0, 200));
      const title = Array.from(dlg.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('issues.new.title'));
      /** @type {any} */ (title).value = 'Väggen lutar';
      const typeSel = Array.from(dlg.querySelectorAll('dm-select')).find((x) => x.getAttribute('label') === t('issues.field.topic_type'));
      assert.ok(typeSel && /** @type {any} */ (typeSel).options.length === 2, 'types from the extensions');
      buttonIn(dlg, t('issues.new.create')).click();
      await waitFor(() => !openDialog(), 5000, 'dialog closes');
      const item = await waitFor(() => panel.querySelector('[data-issue]'), 8000, 'the new issue in the list');
      assert.ok(item.textContent.includes('Väggen lutar'), item.textContent);
      const posted = spy.requests.filter((r) => (r.method || 'GET') === 'POST' && /\/topics$/.test(r.url)).map(bodyOf).pop();
      assert.equal(posted.title, 'Väggen lutar');
      assert.equal(posted.topic_type, 'Issue');
      assert.equal(posted.topic_status, 'Open');
      const vp = spy.requests.filter((r) => (r.method || 'GET') === 'POST' && /\/viewpoints$/.test(r.url)).map(bodyOf).pop();
      assert.ok(vp && vp.snapshot && vp.snapshot.snapshot_type === 'png' && vp.snapshot.snapshot_data.length > 100, 'a snapshot of the view');
      assert.ok(vp.perspective_camera && typeof vp.perspective_camera.camera_view_point.x === 'number' && vp.perspective_camera.field_of_view === 45, JSON.stringify(vp.perspective_camera));
      const dir = vp.perspective_camera.camera_direction; const up = vp.perspective_camera.camera_up_vector;
      assert.ok(Math.abs(Math.hypot(dir.x, dir.y, dir.z) - 1) < 0.01 && Math.abs(dir.x * up.x + dir.y * up.y + dir.z * up.z) < 0.02, 'direction unit, up at right angles');
      assert.deepEqual(vp.components.selection.map((c) => c.ifc_guid), [firstWall.guid], 'the marked wall is the selection');
      // The new topic is tied to the model's file: the server offers updateFiles, and the file's own header gives the facts.
      const put = await waitFor(() => spy.requests.filter((r) => (r.method || 'GET') === 'PUT' && /\/topics\/[^/]+\/files$/.test(r.url)).map(bodyOf).pop(), 5000, 'the files');
      const facts = (await datasets.get(model.id)).model;
      assert.deepEqual(put, [{ ifc_project: facts.projectGuid, date: '2026-11-04T12:00:00', filename: 'testhus.ifc' }], 'PUT /topics/{guid}/files with the IfcProject, the time stamp and the name');
      assert.ok(panel.querySelector('[data-issue-detail]'), 'the new issue is chosen');
      await waitFor(() => panel.querySelector('[data-issue-detail] img'), 8000, 'its snapshot shows');
    });
    return 'ok';
  }, 90000);

  test('opencde III: a comment and a new status from the panel', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('bearbeta');
      shell.store.set({ selectedId: model.id });
      const toggle = await waitFor(() => root.querySelector('[data-model-issues-toggle]'), 8000, 'the button');
      toggle.click();
      const panel = await waitFor(() => root.querySelector('[data-model-issues]'), 5000, 'the panel');
      (await waitFor(() => buttonIn(panel, t('issues.fetch')), 5000, 'fetch button')).click();
      const item = await waitFor(() => panel.querySelector('[data-issue]'), 8000, 'the issue');
      item.click();
      const box = await waitFor(() => panel.querySelector('[data-issue-comment] dm-input'), 5000, 'the comment box');
      /** @type {any} */ (box).value = 'Mätt på plats: 12 mm.';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      buttonIn(panel.querySelector('[data-issue-comment]'), t('issues.comment.send')).click();
      await waitFor(() => panel.textContent.includes('Mätt på plats'), 5000, 'the comment shows');
      const posted = spy.requests.filter((r) => (r.method || 'GET') === 'POST' && /\/comments$/.test(r.url)).map(bodyOf).pop();
      assert.equal(posted.comment, 'Mätt på plats: 12 mm.');
      const status = await waitFor(() => panel.querySelector('[data-issue-status]'), 3000, 'the status select');
      /** @type {any} */ (status).value = 'In progress';
      status.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => { const b = panel.querySelector('[data-issue] dm-badge'); return b && ((b.getAttribute('text') || b.textContent || '').trim() === 'In progress'); }, 5000, 'the badge follows');
      const put = spy.requests.filter((r) => (r.method || 'GET') === 'PUT' && /\/topics\/[^/]+$/.test(r.url)).map(bodyOf).pop();
      assert.equal(put.topic_status, 'In progress');
      assert.equal(put.guid, undefined, 'server fields left out');
      assert.equal(put.creation_date, undefined);
      assert.equal(put.title, 'Väggen lutar');
    });
    return 'ok';
  }, 60000);

  test('opencde III: the project as a BCF file, and the file back as tables', async (assert) => {
    let saved = null;
    await withApp(async (shell, root) => {
      const real = shell.ctx.services.files.download;
      shell.ctx.services.files.download = (blob, name) => { saved = { blob, name }; };
      try {
        shell.activate('bearbeta');
        shell.store.set({ selectedId: model.id });
        const toggle = await waitFor(() => root.querySelector('[data-model-issues-toggle]'), 8000, 'the button');
        toggle.click();
        const panel = await waitFor(() => root.querySelector('[data-model-issues]'), 5000, 'the panel');
        (await waitFor(() => buttonIn(panel, t('issues.fetch')), 5000, 'fetch button')).click();
        const bcf = await waitFor(() => panel.querySelector('[data-issue-bcf]'), 8000, 'the BCF button');
        bcf.click();
        await waitFor(() => saved, 15000, 'the file');
      } finally { shell.ctx.services.files.download = real; }
    });
    assert.ok(saved.name.endsWith('.bcfzip'), saved.name);
    const read = await bcfXml.read(await saved.blob.arrayBuffer());
    assert.equal(read.version, '3.0');
    const invalid = await D.require('tests/bcf-schema-check').checkBlob(saved.blob);
    if (invalid) assert.deepEqual(invalid, [], 'the project file is valid BCF 3.0');
    assert.equal(read.topics.length, 1);
    assert.equal(read.topics[0].title, 'Väggen lutar');
    assert.equal(read.topics[0].topic_status, 'In progress');
    assert.equal(read.comments.length, 1);
    assert.equal(read.comments[0].comment, 'Mätt på plats: 12 mm.');
    assert.equal(read.viewpoints.length, 1);
    assert.deepEqual(read.components.map((c) => c.ifc_guid), [wallGuids[0]]);
    assert.equal(read.snapshots.length, 1);
    assert.ok(read.snapshots[0].bytes.length > 50, 'the snapshot bytes');
    assert.ok(read.viewpoints[0].perspective_camera && read.viewpoints[0].perspective_camera.field_of_view === 45, 'the camera came through');
    assert.equal(read.project.name, 'Bygglovet');
    assert.deepEqual(read.topics[0].header_files.map((f) => f.filename), ['testhus.ifc'], 'the model file in the topic header');
    assert.equal(read.topics[0].creation_author, 'officer', 'the author the server gave');
    // Back in: three tables, the first one an issues table.
    const file = new File([saved.blob], 'bygglovet.bcfzip', { type: 'application/zip' });
    const before = (await datasets.list()).length;
    const main = await importer.run(file, {}, null, 'Bygglovet BCF');
    const all = await datasets.list();
    const mine = all.filter((d) => d.name.startsWith('Bygglovet BCF'));
    for (const d of mine) created.push(d.id);
    assert.equal(all.length, before + 3, 'issues, comments and components');
    assert.equal(main.rowCount, 1);
    const cols = (await datasets.columns(main.id)).map((c) => c.name);
    assert.ok(cols.includes('title') && cols.includes('topic_status') && cols.includes('guid'), cols.join(','));
    assert.ok((await facets.detect(main.id)).some((f) => f.id === 'bcf' && f.on), 'a facet of issues');
    assert.equal(main.source.format, 'bcf');
    const comps = mine.find((d) => d.name.endsWith(t('opencde.kind.components')));
    assert.equal(comps.rowCount, 1);
    return `${read.topics.length} topics`;
  }, 60000);

  test('opencde III: the pure writer and reader keep what the API gives', async (assert) => {
    // Components are IFC GlobalIds of 22 characters, as BCF requires.
    const G1 = '0Dataspatium0000000g01'; const G2 = '0Dataspatium0000000g02'; const G3 = '0Dataspatium0000000g03';
    const camera = bcfXml.cameraFromView({ position: [10, 2, 5], target: [0, 2, 0], fov: 50, aspect: 1.5 });
    assert.ok(Math.abs(camera.camera_direction.x + 0.894) < 0.01 && Math.abs(camera.camera_direction.z + 0.447) < 0.01, JSON.stringify(camera.camera_direction));
    assert.deepEqual(camera.camera_up_vector, { x: 0, y: 1, z: 0 }, 'Y stays up when the view is level');
    const items = [{
      topic: { guid: 'c1d2e3f4-0000-4000-8000-000000000001', title: 'Två <väggar> & en dörr', topic_status: 'Open', labels: ['Safety', 'MEP'], description: 'Rad 1\nRad 2', document_references: [{ guid: 'c1d2e3f4-0000-4000-8000-000000000009', url: 'https://example.org/a.pdf', description: 'Ritning' }], related_topics: [{ related_topic_guid: 'c1d2e3f4-0000-4000-8000-000000000002' }] },
      comments: [{ guid: 'c1d2e3f4-0000-4000-8000-000000000005', date: '2026-11-05T12:00:00Z', author: 'a', comment: 'Hej "citat"', viewpoint_guid: 'c1d2e3f4-0000-4000-8000-000000000007' }],
      viewpoints: [{ viewpoint: { guid: 'c1d2e3f4-0000-4000-8000-000000000007', perspective_camera: camera, components: { selection: [{ ifc_guid: G1 }], coloring: [{ color: 'FF0000', components: [{ ifc_guid: G2 }] }], visibility: { default_visibility: false, exceptions: [{ ifc_guid: G3 }] } } }, snapshot: { bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]), type: 'image/png' } }],
      header: [{ filename: 'hus.ifc', ifc_project: '0Dataspatium0000000001', reference: 'https://example.org/hus.ifc' }],
    }, { topic: { guid: 'c1d2e3f4-0000-4000-8000-000000000002', title: 'Den andra' }, comments: [], viewpoints: [] }];
    const blob = await bcfXml.write(items, { projectName: 'Projektet' });
    const read = await bcfXml.read(await blob.arrayBuffer());
    assert.equal(read.topics.length, 2);
    const invalid = await D.require('tests/bcf-schema-check').checkBlob(blob);
    if (invalid) assert.deepEqual(invalid, [], 'valid BCF 3.0');
    const first = read.topics.find((x) => x.guid === 'c1d2e3f4-0000-4000-8000-000000000001');
    assert.equal(first.title, 'Två <väggar> & en dörr');
    assert.deepEqual(first.labels, ['Safety', 'MEP']);
    assert.equal(first.description, 'Rad 1\nRad 2');
    assert.equal(first.document_references[0].url, 'https://example.org/a.pdf');
    assert.equal(first.related_topics[0].related_topic_guid, 'c1d2e3f4-0000-4000-8000-000000000002');
    assert.equal(first.header_files[0].ifc_project, '0Dataspatium0000000001');
    assert.equal(read.comments[0].comment, 'Hej "citat"');
    assert.equal(read.comments[0].viewpoint_guid, 'c1d2e3f4-0000-4000-8000-000000000007');
    const vp = read.viewpoints[0];
    assert.deepEqual(vp.perspective_camera.camera_view_point, { x: 10, y: 2, z: 5 });
    assert.equal(vp.components.visibility.default_visibility, false);
    assert.deepEqual(vp.components.visibility.exceptions.map((c) => c.ifc_guid), [G3]);
    assert.deepEqual(read.components.map((c) => [c.role, c.ifc_guid, c.color]), [['selection', G1, null], ['coloring', G2, 'FF0000']]);
    assert.deepEqual(Array.from(read.snapshots[0].bytes), [137, 80, 78, 71, 1, 2, 3]);
    const bad = await bcfXml.read(await (await D.require('platform/storage/zip').createZip({ 'a.txt': new TextEncoder().encode('x') })).arrayBuffer()).catch((e) => e);
    assert.ok(bad instanceof Error && bad.message === t('bcf.err.notbcf'));
    return 'ok';
  }, 30000);

  test('opencde III: Dela sends a dataset through the Documents API, as a new version, and as a BCF document', async (assert) => {
    const table = await datasets.create({ name: 'Att skicka', columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Umeå', 130], ['Luleå', 77]] });
    created.push(table.id);
    const cdeSend = D.require('ui/share/cde-send');
    cdeSend.setPopup((url) => { assert.ok(url.endsWith('/upload-ui/tok'), 'the server page opens'); return Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(BASE + '/documents/1.0/upload-sessions/s1/instructions')}`); }, REDIRECT);
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === table.id), 3000, 'dataset');
        shell.store.set({ selectedId: table.id });
        shell.activate('dela');
        const tab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('dela.tabs.cde'))), 5000, 'the tab');
        tab.click();
        const send = await waitFor(() => root.querySelector('[data-cde-send]'), 8000, 'the send button');
        world.parts = [];
        send.click();
        const done = await waitFor(() => root.querySelector('[data-cde-done]'), 20000, 'done');
        assert.ok(done.textContent.includes('1'), done.textContent);
        assert.equal(world.parts.length, 2, 'two parts went up');
        assert.ok(world.parts[1].headers['X-Part'] === '2', 'additional headers travel');
        assert.ok(world.parts[0].headers.Authorization, 'the bearer token on the part that asks for it');
        const started = spy.requests.filter((r) => /upload-documents$/.test(r.url)).map(bodyOf).pop();
        assert.equal(started.files[0].file_name.endsWith('.csv'), true, started.files[0].file_name);
        assert.equal(started.files[0].document_id, undefined);
        // Now as a new version of a document the dataset came from.
        await datasets.updateMeta(table.id, { source: { kind: 'file', fileName: 'skickad.csv', cde: { connectorId: connector.id, host: 'test', projectId: PROJECT, projectName: 'Bygglovet', kind: 'document', documentId: 'doc-old', versionIndex: 1, reference: BASE + '/x' } } });
        world.lastDocumentId = 'doc-old';
        await waitFor(() => root.querySelector('[data-cde-send-version]'), 8000, 'the version button');
        root.querySelector('[data-cde-send-version]').click();
        await waitFor(() => { const el = root.querySelector('[data-cde-done]'); return el && el.textContent.includes('2') ? el : null; }, 20000, 'version 2 done');
        const again = spy.requests.filter((r) => /upload-documents$/.test(r.url)).map(bodyOf).pop();
        assert.equal(again.files[0].document_id, 'doc-old', 'a new version of the same document');
        assert.equal((await datasets.get(table.id)).source.cde.versionIndex, 2, 'the dataset now points at version 2');
        world.lastDocumentId = null;
        // And as a BCF document, with the name in Content-Disposition.
        const how = Array.from(root.querySelectorAll('dm-select')).find((x) => x.getAttribute('label') === t('cde.send.how'));
        /** @type {any} */ (how).value = 'bcf';
        how.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => root.querySelector('[data-cde-send]'), 3000, 'the button again');
        root.querySelector('[data-cde-send]').click();
        await waitFor(() => { const el = root.querySelector('[data-cde-done]'); return el && el.textContent.includes(t('cde.send.done.bcf', { name: '', id: '' }).slice(0, 5)) && /BCF/.test(el.textContent) ? el : null; }, 20000, 'bcf done');
        const posted = spy.requests.filter((r) => (r.method || 'GET') === 'POST' && /\/documents$/.test(r.url)).pop();
        assert.ok(/filename="[^"]*\.csv"/.test(String(posted.headers['Content-Disposition'])), posted.headers['Content-Disposition']);
        assert.ok((await datasets.log(table.id)).some((e) => e.action === 'shared'), 'the sharing is in the history');
      });
    } finally { cdeSend.setPopup(null); }
    return 'ok';
  }, 90000);

  test('opencde III: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
