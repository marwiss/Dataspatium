// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Dataregium III against a mocked OpenCDE server (virtual providers and a spy on api/http, no network): issues against
 * the model's elements as plain logic, colours in the 3D view, the panel's colours, table and chart, the tool Ärenden and its
 * starters, the board Ärendeläge from Hantera's card, Cypher starters for Dataregium's IFC graph, and a workspace bundle that goes
 * to the CDE from Dela and comes back through the source view's file list.
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
  const issues = D.require('data/issues');
  const importer = D.require('io/import');
  const http = D.require('api/http');
  const fixtures = D.require('tests/fixtures/ifc');
  const charts = D.require('viz/charts');
  const dashboards = D.require('viz/dashboards');
  const BASE = 'dataspatium-asset://tests/opencde4';
  const PROJECT = 'bbbbbbbb-1111-4222-8333-444444444444';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = []; const chartIds = []; const dashIds = [];
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
  const spy = { requests: [] };
  const realRequest = http.request;
  const spyRequest = (req) => { spy.requests.push(req); return realRequest(req); };
  http.request = spyRequest;
  const last = () => spy.requests[spy.requests.length - 1] || {};
  const bodyOf = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body) : null; } catch (_e) { return null; } };
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  const text = (data) => ({ kind: 'text', data });
  const uuid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const topic = (n, title, status) => ({ guid: uuid(100 + n), server_assigned_id: 'K-' + n, title, topic_type: 'Issue', topic_status: status, priority: n % 2 ? 'High' : 'Low', assigned_to: 'officer', labels: [], creation_author: 'officer', creation_date: `2026-${String(9 + (n % 3)).padStart(2, '0')}-05T10:00:00Z` });
  const world = { tokens: 0, topics: [], viewpoints: new Map(), bundleBytes: null, uploadName: '', parts: [] };
  let snapshotBytes = null;
  function png() {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30;
    const g = canvas.getContext('2d'); g.fillStyle = '#009e73'; g.fillRect(0, 0, 40, 30);
    const bin = atob(canvas.toDataURL('image/png').split(',')[1]); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  D.net.virtual('tests/opencde4/', async (url) => {
    const u = new URL(url);
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : u.pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    const req = last(); const method = (req.method || 'GET').toUpperCase(); const body = bodyOf(req) || {};
    const p = `/bcf/3.0/projects/${PROJECT}`;
    const m = (re) => re.exec(path);
    let r;
    if (path === '/foundation/versions') return json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] });
    if (path === '/foundation/1.0/auth') return json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', http_basic_supported: false, supported_oauth2_flows: ['authorization_code_grant'] });
    if (path === '/foundation/oauth2/token') { world.tokens++; return json({ access_token: 'a' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600 }); }
    if (path === '/foundation/oauth2/revoke') return text('');
    if (path === '/foundation/1.0/current-user') return json({ id: 'officer', name: 'Handläggaren' });
    if (path === '/bcf/3.0/projects') return json([{ project_id: PROJECT, name: 'Kvarteret' }]);
    if (path === p) return json({ project_id: PROJECT, name: 'Kvarteret', authorization: { project_actions: ['createTopic', 'createDocument'] } });
    if (path === `${p}/extensions`) return json({ topic_type: ['Issue'], topic_status: ['Open', 'In progress', 'Closed'], topic_label: [], priority: ['Low', 'High'], users: ['officer'], project_actions: ['createTopic', 'createDocument'], topic_actions: ['createComment', 'update', 'createViewpoint'], comment_actions: ['update'] });
    if (path === `${p}/topics`) {
      if (u.searchParams.get('$skip') && u.searchParams.get('$skip') !== '0') return json([]);
      return json(world.topics);
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)$/))) { const tp = world.topics.find((x) => x.guid === r[1]); return tp ? json(tp) : { kind: 'text', data: '{"message":"Not Found"}', status: 404 }; }
    if (m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/[^/]+\/comments$/)) return json([]);
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/viewpoints$/))) {
      const list = world.viewpoints.get(r[1]) || [];
      return json(list.map((vp) => Object.assign({ guid: vp.guid, snapshot: { snapshot_type: 'png' } }, vp.ortho ? { orthogonal_camera: { camera_view_point: { x: 2, y: -30, z: 4 }, camera_direction: { x: 0, y: 1, z: 0 }, camera_up_vector: { x: 0, y: 0, z: 1 }, view_to_world_scale: 12, aspect_ratio: 1.6 } } : { perspective_camera: { camera_view_point: { x: 1, y: 1, z: 1 }, camera_direction: { x: -1, y: -1, z: -1 }, camera_up_vector: { x: 0, y: 1, z: 0 }, field_of_view: 45, aspect_ratio: 1.6 } })));
    }
    if ((r = m(/^\/bcf\/3\.0\/projects\/[^/]+\/topics\/([^/]+)\/viewpoints\/([^/]+)\/(selection|coloring|visibility|snapshot)$/))) {
      const vp = (world.viewpoints.get(r[1]) || []).find((x) => x.guid === r[2]) || { components: {} };
      const c = vp.components || {};
      if (r[3] === 'selection') return json({ selection: c.selection || [] });
      if (r[3] === 'coloring') return json({ coloring: c.coloring || [] });
      if (r[3] === 'visibility') return json({ visibility: c.visibility || { default_visibility: true } });
      return { kind: 'binary', data: snapshotBytes || (snapshotBytes = png()) };
    }
    if (path === `${p}/files_information`) {
      if (!world.bundleBytes) return json([]);
      return json([{ file: { filename: world.uploadName, reference: `${BASE}/documents/1.0/documents/doc-bundle/versions/1/download`, date: '2026-11-05T12:00:00Z' }, display_information: [{ field_display_name: 'Source', field_value: 'Documents API' }, { field_display_name: 'Document id', field_value: 'doc-bundle' }, { field_display_name: 'Version index', field_value: '1' }] }]);
    }
    if (path === '/documents/1.0/documents/doc-bundle/versions/1/download') return { kind: 'binary', data: world.bundleBytes.buffer.slice(world.bundleBytes.byteOffset, world.bundleBytes.byteOffset + world.bundleBytes.byteLength) };
    if (path === '/documents/1.0/upload-documents') { world.uploadName = ((body.files || [])[0] || {}).file_name || 'fil'; return json({ upload_ui_url: BASE + '/documents/1.0/upload-ui/tok', expires_in: 600, max_size_in_bytes: 1073741824, files: body.files }); }
    if (path === '/documents/1.0/upload-sessions/s1/instructions') {
      const size = Number(((body.files || [])[0] || {}).size_in_bytes) || 0;
      return json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: BASE + '/upload-part/1', http_method: 'PUT', content_range_start: 0, content_range_end: Math.max(0, size - 1), include_authorization: true }], upload_completion: { url: BASE + '/documents/1.0/upload-sessions/s1/files/0/complete', http_method: 'POST' } }], documents_not_uploaded: [] });
    }
    if (path.startsWith('/upload-part/')) {
      const raw = req.body && typeof req.body.arrayBuffer === 'function' ? await req.body.arrayBuffer() : req.body;
      world.bundleBytes = new Uint8Array(raw);
      world.parts.push(world.bundleBytes.byteLength);
      return text('');
    }
    if (path === '/documents/1.0/upload-sessions/s1/files/0/complete') return json({ document_id: 'doc-bundle', version_index: 1, version_number: '1', title: 'Paket', file_description: { name: world.uploadName, size_in_bytes: world.bundleBytes ? world.bundleBytes.byteLength : 0 }, links: { document_version_download: { url: `${BASE}/documents/1.0/documents/doc-bundle/versions/1/download` } } });
    return { kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 };
  });
  let connector = null; let model = null; let wallGuids = []; let wallIds = []; let savedTable = null;

  test('opencde IV: issues against elements: ranks, colours, one row per issue and element, and the counts', async (assert) => {
    assert.deepEqual(['Open', 'In progress', 'Closed', 'Whatever', ''].map(issues.rank), [0, 1, 2, 3, 3]);
    assert.equal(issues.rank('Pågående'), 1); assert.equal(issues.rank('Stängd'), 2); assert.equal(issues.rank('Ny'), 0);
    const topics = [{ guid: 'a', title: 'A', topic_status: 'Open', labels: ['x', 'y'] }, { guid: 'b', title: 'B', topic_status: 'Closed' }, { guid: 'c', title: 'C', topic_status: 'In progress' }, { guid: 'd', title: 'D', topic_status: 'Open' }];
    const parts = new Map([['a', [{ guid: 'g1' }, { guid: 'g2' }]], ['b', [{ guid: 'g2' }, { guid: 'g3' }]], ['c', [{ guid: 'g3' }]], ['d', [{ guid: 'zz' }]]]);
    const elements = new Map([['g1', 1], ['g2', 2], ['g3', 3]]);
    const out = issues.colorGroups(topics, parts, elements);
    const tk = D.require('viz/theme').tokens();
    assert.deepEqual(out.groups.map((g) => [g.status, g.ids.slice().sort()]), [['Open', [1, 2]], ['In progress', [3]]], 'the most open status wins an element: ' + JSON.stringify(out.groups));
    assert.equal(out.groups[0].color, tk.error); assert.equal(out.groups[1].color, tk.warn);
    assert.deepEqual(out.legend.map((l) => l.n), [2, 1]);
    const info = new Map([['g1', { typ: 'IfcWall', namn: 'V1', vaning: 'Plan 1' }], ['g2', { typ: 'IfcWall', namn: 'V2', vaning: 'Plan 1' }], ['g3', { typ: 'IfcDoor', namn: 'D1', vaning: 'Plan 2' }]]);
    const table = issues.tableOf(topics, parts, info);
    assert.deepEqual(table.columns.slice(-4), ['element_guid', 'element_typ', 'element_namn', 'element_vaning']);
    assert.equal(table.rows.length, 6, 'a: two walls, b: two elements, c: one, d: one empty row');
    assert.equal(table.rows[0][table.columns.indexOf('labels')], 'x, y');
    const d = table.rows.find((r) => r[0] === 'd');
    assert.equal(d[table.columns.indexOf('element_guid')], null);
    const ds = await datasets.create({ name: 'Ärenden prov', columns: table.columns.map((name) => ({ name, type: 'text' })), rows: table.rows, source: { kind: 'file', fileName: '', cde: { kind: 'issues', modelId: 'm1', host: 'x', projectId: PROJECT } } });
    created.push(ds.id);
    assert.ok(await facets.has(ds.id, 'bcf'), 'a table of issues is a BCF facet');
    const sum = await issues.summary(ds.id, ['element_typ', 'topic_status']);
    const wallOpen = sum.rows.find((r) => r[0] === 'IfcWall' && r[1] === 'Open');
    assert.deepEqual(wallOpen.slice(2), [1, 1, 2], JSON.stringify(sum.rows));
    assert.ok(sum.rows.some((r) => r[0] === '' && r[1] === 'Open' && r[4] === 0), 'issues that point at nothing count with an empty element type');
    assert.deepEqual(sum.columns.map((c) => c.name), ['element_typ', 'topic_status', 'arenden', 'oppna', 'byggdelar']);
    assert.deepEqual(issues.tablesFor([{ id: 'x', name: 'B', source: { cde: { kind: 'issues', modelId: 'other' } } }, { id: 'y', name: 'A', source: { cde: { kind: 'issues', modelId: 'm1' } } }, { id: 'z', name: 'C', source: { kind: 'api' } }], { id: 'm1' }).map((x) => x.id), ['y', 'x']);
    return 'ok';
  });

  test('opencde IV: the 3D view colours groups of elements, and a chart keeps the colours and the legend', async (assert) => {
    model = await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Kvartershuset');
    created.push(model.id);
    const cols = await datasets.columns(model.id);
    const g = cols.findIndex((c) => c.name === 'guid'); const typ = cols.findIndex((c) => c.name === 'typ'); const idAt = cols.findIndex((c) => c.name === 'id');
    const seen = new Set();
    const walls = (await datasets.query(model.id, {})).filter((r) => String(r[typ]) === 'IfcWall' && !seen.has(String(r[g])) && seen.add(String(r[g])));
    wallGuids = walls.map((r) => String(r[g])); wallIds = walls.map((r) => Number(r[idAt]));
    assert.ok(wallIds.length >= 3, 'walls in the model: ' + wallIds.length);
    wallGuids = wallGuids.slice(0, 3); wallIds = wallIds.slice(0, 3);
    const draw = D.require('viz/model-draw');
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9000px;width:400px;height:300px;'; document.body.appendChild(host);
    try {
      const hd = await draw.render(host, { datasetId: model.id, colors: [{ color: '#c0392b', ids: [wallIds[0]] }] }, { width: 400, height: 300 });
      assert.ok(typeof hd.setColors === 'function', 'the handle colours');
      const n = hd.setColors([{ color: '#16703f', ids: wallIds }, { color: '#8f5a0b', ids: [999999] }]);
      assert.ok(n >= 1, 'meshes drawn in colour: ' + n);
      assert.equal(hd.setColors([]), 0, 'colours taken away');
      hd.destroy();
    } finally { host.remove(); }
    const html = await draw.htmlFor(null, { kind: 'model', name: 'x', datasetId: model.id, model: { datasetId: model.id, colors: [{ color: '#c0392b', ids: [wallIds[0]] }], legend: [{ status: 'Open', color: '#c0392b', n: 1 }] } }, { width: 300, height: 200 });
    assert.ok(/<img /.test(html) && html.includes('Open') && html.includes('#c0392b'), 'a picture with a legend');
    return `${wallIds.length} walls`;
  }, 60000);

  test('opencde IV: the panel colours by status, saves the issues as a table, and the view as a chart', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    assert.ok(opencde.signedIn(connector));
    world.topics = [topic(1, 'Spricka i vägg', 'Open'), topic(2, 'Dörr saknas', 'Closed'), topic(3, 'Fukt', 'In progress')];
    world.viewpoints.set(uuid(101), [{ guid: uuid(701), components: { selection: [{ ifc_guid: wallGuids[0] }, { ifc_guid: wallGuids[1] }] } }]);
    world.viewpoints.set(uuid(102), [{ guid: uuid(702), components: { selection: [{ ifc_guid: wallGuids[1] }] } }]);
    world.viewpoints.set(uuid(103), [{ guid: uuid(703), ortho: true, components: { selection: [{ ifc_guid: wallGuids[2] }] } }]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 3000, 'dataset');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: model.id, openModelIssues: { datasetId: model.id } });
      const panel = await waitFor(() => root.querySelector('[data-model-issues]'), 15000, 'the panel');
      await waitFor(() => root.querySelector('.dm-model-canvas'), 15000, 'the 3D view');
      await waitFor(() => buttonIn(panel, t('issues.fetch')), 5000, 'fetch button');
      buttonIn(panel, t('issues.fetch')).click();
      const sw = await waitFor(() => panel.querySelector('[data-issue-colors]'), 10000, 'the colour switch');
      /** @type {any} */ (sw).checked = true;
      sw.dispatchEvent(new Event('change', { bubbles: true }));
      const legend = await waitFor(() => panel.querySelector('.dm-model-issues-legend'), 5000, 'legend');
      const items = Array.from(legend.querySelectorAll('li')).map((li) => li.textContent.trim());
      assert.equal(items.length, 2, 'Open and In progress colour the walls; Closed loses its shared wall: ' + items.join(' | '));
      assert.ok(items[0].startsWith('Open (2)') && items[1].startsWith('In progress (1)'), items.join(' | '));
      // While the model is shown, an issue opens at its viewpoint's camera: an orthogonal one turns the view orthographic.
      assert.ok(!root.querySelector('[data-model-ortho][active]'), 'perspective before');
      panel.querySelector('[data-issue="' + uuid(103) + '"]').click();
      await waitFor(() => root.querySelector('[data-model-ortho][active]'), 8000, 'the orthogonal camera of the viewpoint');
      panel.querySelector('[data-issue-table]').click();
      savedTable = await waitFor(async () => (await datasets.list()).find((d) => d.name === t('issues.table.name', { model: 'Kvartershuset' }) && d.source && d.source.cde), 10000, 'the saved table');
      created.push(savedTable.id);
      assert.equal(savedTable.source.cde.kind, 'issues'); assert.equal(savedTable.source.cde.modelId, model.id);
      const names = (await datasets.columns(savedTable.id)).map((c) => c.name);
      assert.ok(names.includes('element_guid') && names.includes('topic_status') && names.includes('element_typ'), names.join(','));
      const rows = await datasets.query(savedTable.id, {});
      assert.equal(rows.length, 4, 'two walls for the first issue, one each for the others');
      assert.ok(await facets.has(savedTable.id, 'bcf'), 'the table is a BCF facet');
      panel.querySelector('[data-issue-chart]').click();
      const chart = await waitFor(async () => (await charts.list(model.id)).find((c) => c.kind === 'model' && c.model && Array.isArray(c.model.colors)), 10000, 'the chart');
      chartIds.push(chart.id);
      assert.equal(chart.model.colors.length, 2); assert.equal(chart.model.legend.length, 2);
      assert.ok(chart.model.view && chart.model.view.position, 'the camera travels with the chart');
      assert.equal(chart.name, t('issues.chart.name', { model: 'Kvartershuset' }));
    });
    return 'ok';
  }, 90000);

  test('opencde IV: the tool Ärenden counts per status and element type, and the starters know the elements', async (assert) => {
    assert.ok(savedTable, 'the table from the panel');
    const starters = D.require('analysis/starters');
    const sql = await starters.forDataset(savedTable, 'sql');
    const keys = sql.map((p) => p.key);
    assert.ok(keys.includes('starter.bcf.elements') && keys.includes('starter.bcf.storeys'), keys.join(','));
    for (const p of sql.filter((x) => x.key.startsWith('starter.bcf.'))) {
      const r = await D.require('data/query').select(savedTable.id, p.code, { limit: 50 });
      assert.ok(r.values.length >= 1, p.key);
    }
    assert.ok((await starters.forDataset(savedTable, 'r')).some((p) => p.key === 'starter.bcf.elements'), 'R knows the elements');
    assert.ok((await starters.forDataset(savedTable, 'python')).some((p) => p.key === 'starter.bcf.elements'), 'Python too');
    const plain = await datasets.create({ name: 'Bara ärenden', columns: ['guid', 'title', 'topic_status'].map((name) => ({ name, type: 'text' })), rows: [['a', 'A', 'Open']] });
    created.push(plain.id);
    assert.ok(!(await starters.forDataset(plain, 'sql')).some((p) => p.key === 'starter.bcf.elements'), 'no element starters without element columns');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === savedTable.id), 3000, 'dataset');
      shell.store.set({ selectedId: model.id });
      shell.activate('analysera');
      const outer = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.trim() === t('analysera.tabs.model')), 10000, 'the model tab');
      outer.click();
      const tab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.trim() === t('model.tool.issues')), 10000, 'the tool tab');
      tab.click();
      const result = await waitFor(() => { const el = root.querySelector('.dm-tool-result'); return el && el.querySelector('dm-table') && el.textContent.includes(savedTable.name) ? el : null; }, 10000, 'the counts for the saved table');
      assert.ok(result, 'the note names the table');
      const tableSel = Array.from(root.querySelectorAll('dm-select')).find((x) => x.getAttribute('label') === t('model.issues.table'));
      assert.ok(tableSel && /** @type {any} */ (tableSel).value === savedTable.id, 'the table is chosen');
    });
    return 'ok';
  }, 60000);

  test('opencde IV: Hantera\'s card makes the board Ärendeläge with its charts and filters', async (assert) => {
    assert.ok(savedTable, 'the table from the panel');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === savedTable.id), 3000, 'dataset');
      shell.activate('hantera');
      shell.store.set({ selectedId: savedTable.id });
      const card = await waitFor(() => root.querySelector('[data-card="bcf"]'), 8000, 'the card');
      assert.ok(card.textContent.includes(t('bcf.card.summary', { n: '3', open: '2' })), card.textContent);
      assert.ok(card.querySelector('[data-bcf-model]'), 'the model is in the workspace');
      const cde = await waitFor(() => root.querySelector('[data-card="cde"]'), 5000, 'the CDE card');
      assert.ok(cde.textContent.includes(t('cde.kind.issues')) && cde.textContent.includes('Kvartershuset'), cde.textContent);
      card.querySelector('[data-bcf-board]').click();
      const dash = await waitFor(async () => (await dashboards.list()).find((d) => d.name === t('viz.board.issues.name', { name: savedTable.name })), 10000, 'the dashboard');
      dashIds.push(dash.id);
      for (const it of dash.items) chartIds.push(it.chartId);
      assert.equal(dash.items.length, 5, 'status, type, assignee, priority and month');
      assert.deepEqual(dash.filters.map((f) => f.column), ['topic_status', 'topic_type', 'assigned_to']);
      const first = await charts.get(dash.items[0].chartId);
      assert.equal(first.kind, 'vega'); assert.equal(first.vega.state.x.field, 'topic_status');
      const months = await charts.get(dash.items[4].chartId);
      assert.equal(months.vega.state.x.timeUnit, 'yearmonth');
      await waitFor(() => shell.store.get().mode === 'visualisera' || root.querySelector('[data-dashboard]') || !shell.store.get().openDashboardId, 8000, 'Visualisera opens');
    });
    return 'ok';
  }, 60000);

  test('opencde IV: Cypher starters for Dataregium\'s IFC graph in the Neo4j view', async (assert) => {
    const neo4j = D.require('api/families/neo4j');
    assert.equal(neo4j.EXAMPLES.length, 8);
    for (const x of neo4j.EXAMPLES) assert.ok(/^MATCH /.test(x.cypher) && t('neo4j.example.' + x.id) !== 'neo4j.example.' + x.id, x.id);
    const r = await families.createConnector('neo4j', { baseUrl: 'bolt://127.0.0.1:7697/', database: 'neo4j', username: 'neo4j', password: 'hemligt' }, { discover: false });
    const int = (n) => ({ low: n, high: 0, toNumber: () => n, inSafeRange: () => true });
    const rec = (obj) => ({ keys: Object.keys(obj), get: (k) => obj[k] });
    const records = [rec({ fil: 'testhus.ifc', tillstand: 'done', entiteter: int(248), ifc_project: '0Dataspatium0000000001' })];
    const prev = globalThis.neo4j;
    globalThis.neo4j = Object.assign({ driver: () => ({ session: () => ({ run: () => ({ [Symbol.asyncIterator]() { let i = 0; return { next: async () => (i < records.length ? { value: records[i++], done: false } : { value: undefined, done: true }), return: async () => ({ value: undefined, done: true }) }; }, keys: async () => [], summary: async () => ({ counters: {} }) }), close: async () => {} }), close: async () => {} }), auth: { basic: (u, p) => ({ u, p }) }, session: { READ: 'READ', WRITE: 'WRITE' }, int: (n) => ({ low: Number(n), high: 0, toNumber: () => Number(n), inSafeRange: () => true }) }, { isNode: () => false, isRelationship: () => false, isPath: () => false, isInt: (v) => !!(v && v.low !== undefined && typeof v.toNumber === 'function') });
    try {
      const view = D.require('ui/api/neo4j-view').create({ connector: r.connector, log() {}, onDataset() {} });
      view.start();
      const sel = view.el.querySelector('[data-neo4j-example]');
      assert.ok(sel, 'the starter select');
      /** @type {any} */ (sel).value = 'models';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(view.state.query, neo4j.EXAMPLES[0].cypher, 'the starter is in the editor');
      await view.run();
      assert.ok(view.state.result && view.state.result.rows.length === 1 && view.state.result.rows[0][1] === 'done', 'the fake graph answered: ' + view.state.error);
    } finally { globalThis.neo4j = prev; await connectors.remove(r.connector.id); }
    return 'ok';
  }, 30000);

  test('opencde IV: Dela sends a workspace bundle to the CDE, and the source view receives it', async (assert) => {
    const table = await datasets.create({ name: 'Paketets tabell', columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Umeå', 130], ['Luleå', 77]] });
    const cdeSend = D.require('ui/share/cde-send');
    cdeSend.setPopup(() => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(BASE + '/documents/1.0/upload-sessions/s1/instructions')}`), REDIRECT);
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === table.id), 3000, 'dataset');
        shell.store.set({ selectedId: table.id });
        shell.activate('dela');
        const tab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('dela.tabs.cde'))), 5000, 'the tab');
        tab.click();
        await waitFor(() => root.querySelector('[data-cde-send]'), 8000, 'the send button');
        const what = Array.from(root.querySelectorAll('dm-select')).find((x) => x.getAttribute('label') === t('dela.share.what'));
        assert.ok(/** @type {any} */ (what).options.some((o) => o.value === 'bundle'), 'a bundle can be sent');
        /** @type {any} */ (what).value = 'bundle';
        what.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => root.textContent.includes(t('cde.send.what.bundle.hint')), 3000, 'the hint');
        world.parts = []; world.bundleBytes = null;
        root.querySelector('[data-cde-send]').click();
        const dlg = await waitFor(openDialog, 5000, 'the bundle dialog');
        assert.ok(dlg.textContent.includes(t('bundle.title')), 'the bundle dialog opens');
        const nameIn = Array.from(dlg.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('bundle.name'));
        /** @type {any} */ (nameIn).value = 'Kvarterspaket';
        buttonIn(dlg, t('bundle.create')).click();
        const done = await waitFor(() => root.querySelector('[data-cde-done]'), 20000, 'done');
        assert.ok(done.textContent.includes('1'), done.textContent);
        assert.ok(world.bundleBytes && world.bundleBytes.byteLength > 100 && world.parts.length === 1, 'the bundle went up in one part');
        assert.ok(/\.dataspatium\.zip$/.test(world.uploadName), world.uploadName);
        const opened = await shell.ctx.services.workspace.inspect(new Blob([world.bundleBytes]));
        assert.equal(opened.manifest.kind, 'bundle');
        assert.ok(opened.manifest.datasets.some((d) => d.id === table.id), 'the table is in the bundle');
        // The other side: the source view lists the bundle and receives it, after the table is gone here.
        await datasets.remove(table.id);
        await waitFor(() => !shell.store.get().datasets.some((d) => d.id === table.id), 5000, 'the table is gone');
        const view = D.require('ui/api/opencde-view').create({ ctx: shell.ctx, connector, log() {}, onDataset() {} });
        root.appendChild(view.el);
        await view.start();
        await waitFor(() => view.state.projectId === PROJECT, 5000, 'the project');
        await view.loadFiles();
        const row = view.el.querySelector(`[data-opencde-file="${world.uploadName}"]`);
        assert.ok(row, 'the bundle in the file list');
        const btn = row.querySelector('dm-button');
        await waitFor(() => btn.textContent.trim() === t('opencde.file.receive') || btn.getAttribute('label') === t('opencde.file.receive'), 3000, 'the receive button');
        btn.click();
        const summary = await waitFor(openDialog, 8000, 'the incoming summary');
        assert.ok(summary.textContent.includes('Paketets tabell'), summary.textContent.slice(0, 200));
        buttonIn(summary, t('bundle.open.ok')).click();
        const back = await waitFor(async () => (await datasets.list()).find((d) => d.name === 'Paketets tabell'), 10000, 'the table is back');
        created.push(back.id);
        if (back.id !== table.id) console.log('DATASPATIUM-LOG: bundle restored under a new id');
        assert.equal((await datasets.query(back.id, {})).length, 2);
      });
    } finally { cdeSend.setPopup(null); }
    return 'ok';
  }, 90000);

  test('opencde IV: cleanup', async () => {
    for (const id of dashIds) await dashboards.remove(id).catch(() => {});
    for (const id of chartIds) await charts.remove(id).catch(() => {});
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    if (http.request === spyRequest) http.request = realRequest;
    return 'ok';
  });
})();
