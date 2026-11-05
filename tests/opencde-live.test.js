// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataspatium against a real Kontroll OpenCDE server (checklist C in Kontroll's docs/acceptance.md, and more): discovery,
 * sign-in with PKCE, the BCF tables, writing topics, comments, viewpoints and references, both document APIs with upload and
 * download, the model import, the project's files, the family's own uploads, a BCF file out and in, registration, refresh,
 * revocation and the refused redirect. Runs only when the page is
 * served over http and given ?cde=<server>&cdehelper=<helper>&cdeclient=<client id>[&cdeproject=<name>]; otherwise it is
 * skipped. The helper (tools/cde-helper.py) plays the user at the server's own pages. See docs/utveckling.md.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const datasets = D.require('data/datasets');
  const runner = D.require('api/runner');
  const http = D.require('api/http');
  const importer = D.require('io/import');
  const fixtures = D.require('tests/fixtures/ifc');
  const params = new URLSearchParams(location.search);
  const BASE = (params.get('cde') || '').replace(/\/+$/, '');
  const HELPER = (params.get('cdehelper') || '').replace(/\/+$/, '');
  const CLIENT = params.get('cdeclient') || '';
  const PROJECT_NAME = params.get('cdeproject') || 'Dataspatium-prov';
  const REDIRECT = location.origin + '/oauth-callback.html';
  const IFC_TEXT = fixtures.ifcText({ walls: 3, name: 'testhus.ifc' });
  const WALLS = Array.from(IFC_TEXT.matchAll(/IFCWALL\('([^']+)'/g)).map((m) => m[1]).slice(0, 3);
  const ifcBytes = () => new TextEncoder().encode(IFC_TEXT).buffer;
  const log = (text) => console.log('DATASPATIUM-LOG: cde ' + text);
  const finding = (text) => console.log('DATASPATIUM-LOG: cde FINDING ' + text);
  const shared = { connector: null, projectId: '', topic: null, other: null, viewpoint: null, documentId: '', created: [], bcfDocument: null };
  const timed = async (label, fn) => { const t0 = performance.now(); const out = await fn(); log(`${label}: ${Math.round(performance.now() - t0)} ms`); return out; };
  async function helper(path, query) {
    const q = new URLSearchParams(query);
    const res = await fetch(`${HELPER}${path}?${q.toString()}`);
    const j = await res.json();
    if (j.error) throw new Error('helper: ' + j.error);
    return j;
  }
  const popup = async (url) => (await helper('/authorize', { url })).callback;
  /** A raw call with the bearer token, for what the family has no helper for (binary bodies, headers to inspect). */
  async function raw(method, url, options = {}) {
    const token = await opencde.ensureToken(shared.connector);
    const headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, options.headers || {});
    const full = /^https?:/.test(url) ? url : BASE + url;
    return http.request({ url: full, method, headers, body: options.body, retries: 0, rateKey: shared.connector.id, responseType: options.responseType });
  }
  function pngDataUrl() {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100;
    const g = canvas.getContext('2d'); g.fillStyle = '#dde6f0'; g.fillRect(0, 0, 160, 100); g.fillStyle = '#2b6cb0'; g.fillRect(30, 20, 100, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  }
  if (!BASE || !HELPER || !CLIENT) {
    test('opencde live: skipped', async () => 'skipped: give ?cde=<server>&cdehelper=<helper>&cdeclient=<client id>');
    return;
  }

  test('opencde live: discovery and a connector from the family dialog', async (assert) => {
    const disc = await timed('discover', () => opencde.discover(BASE));
    assert.deepEqual(Object.keys(disc.apis).sort(), ['bcf', 'documents', 'foundation'], JSON.stringify(disc.apis));
    assert.ok(disc.pkceRequired, 'PKCE required');
    const res = await families.createConnector('opencde', { baseUrl: BASE, clientId: CLIENT, clientSecret: '' });
    shared.connector = res.connector;
    assert.equal(shared.connector.family.type, 'opencde');
    // What the dialog leaves behind: a connector that does not know where to sign in.
    if (!shared.connector.auth.authUrl) {
      const err = await opencde.login(shared.connector, { popup, redirectUri: REDIRECT }).catch((e) => e);
      finding(`a connector made in the dialog has no authUrl; login says: ${err && err.message}`);
      Object.assign(shared.connector.auth, { authUrl: disc.authUrl, tokenUrl: disc.tokenUrl, revocationUrl: disc.revocationUrl });
      shared.connector = await connectors.save(shared.connector);
    }
    return 'ok';
  }, 60000);

  test('opencde live: sign in with PKCE through the server (C2)', async (assert) => {
    const creds = await timed('login', () => opencde.login(shared.connector, { popup, redirectUri: REDIRECT }));
    assert.ok(creds.token && creds.refreshToken, 'tokens');
    log(`token lives ${Math.round((Number(creds.expiresAt) - Date.now()) / 1000)} s; scope "${creds.scope}"`);
    const me = await opencde.currentUser(shared.connector);
    assert.equal(me.name, 'Dataspatium provare', JSON.stringify(me));
    return me.id;
  }, 60000);

  test('opencde live: projects, extensions and what the user may do', async (assert) => {
    const projects = await opencde.projects(shared.connector);
    const mine = projects.find((p) => p.name === PROJECT_NAME);
    assert.ok(mine, 'project ' + PROJECT_NAME + ' among ' + projects.map((p) => p.name).join(', '));
    shared.projectId = mine.project_id;
    // Leftovers from an aborted run would double the counts below: the suite's own topics go first.
    const stale = (await opencde.topics(shared.connector, shared.projectId, { $top: 500 })).filter((tp) => /^Dataspatium: /.test(String(tp.title || '')));
    for (const tp of stale) await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${tp.guid}`, { method: 'DELETE' }).catch((e) => log('stale topic: ' + e.message));
    if (stale.length) log(`removed ${stale.length} stale topics from an earlier run`);
    const ext = await opencde.extensions(shared.connector, shared.projectId);
    log(`extensions: types ${(ext.topic_type || []).length}, statuses ${(ext.topic_status || []).length}, labels ${(ext.topic_label || []).length}, users ${(ext.users || []).length}`);
    assert.ok(Array.isArray(ext.project_actions) && ext.project_actions.includes('createTopic'), 'project_actions: ' + JSON.stringify(ext.project_actions));
    const withAuth = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}?includeAuthorization=true`);
    assert.ok(withAuth.authorization && withAuth.authorization.project_actions.includes('createDocument'), JSON.stringify(withAuth.authorization));
    shared.ext = ext;
    return mine.project_id;
  }, 60000);

  test('opencde live: a topic with a comment, a viewpoint, references and related topics', async (assert) => {
    const ext = shared.ext;
    const body = { title: 'Dataspatium: väggtyp stämmer inte med schemat', description: 'Jämför de tre markerade väggarna med väggschemat.' };
    if (ext.topic_type && ext.topic_type.length) body.topic_type = ext.topic_type[0];
    if (ext.topic_status && ext.topic_status.length) body.topic_status = ext.topic_status[0];
    if (ext.topic_label && ext.topic_label.length) body.labels = ext.topic_label.slice(0, 1);
    const topic = await timed('create topic', () => opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics`, { method: 'POST', json: body }));
    assert.ok(topic.guid && topic.server_assigned_id, JSON.stringify(topic).slice(0, 200));
    shared.topic = topic;
    const other = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics`, { method: 'POST', json: Object.assign({}, body, { title: 'Dataspatium: relaterat ärende' }) });
    shared.other = other;
    const vp = await timed('create viewpoint', () => opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/viewpoints`, { method: 'POST', json: {
      perspective_camera: { camera_view_point: { x: 12, y: -8, z: 4 }, camera_direction: { x: -0.6, y: 0.7, z: -0.3 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 60, aspect_ratio: 1.6 },
      snapshot: { snapshot_type: 'png', snapshot_data: pngDataUrl() },
      components: { selection: WALLS.map((g) => ({ ifc_guid: g, originating_system: 'Dataspatium' })), coloring: [{ color: 'FF0000', components: [{ ifc_guid: WALLS[0] }] }], visibility: { default_visibility: true } },
    } }));
    assert.ok(vp.guid, 'viewpoint');
    shared.viewpoint = vp;
    const comment = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/comments`, { method: 'POST', json: { comment: 'Se de markerade väggarna.', viewpoint_guid: vp.guid } });
    assert.equal(comment.viewpoint_guid, vp.guid, JSON.stringify(comment));
    const ref = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/document_references`, { method: 'POST', json: { url: 'https://example.org/ritningar/A-40-1-100.pdf', description: 'Planritning' } });
    assert.ok(ref.guid, 'document reference');
    const related = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/related_topics`, { method: 'PUT', json: [{ related_topic_guid: other.guid }] });
    assert.equal(related.length, 1, JSON.stringify(related));
    const snapshot = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/viewpoints/${vp.guid}/snapshot`, { headers: { Accept: 'image/png' }, responseType: 'arraybuffer' });
    assert.ok(snapshot.ok && snapshot.buffer && snapshot.buffer.byteLength > 100, 'snapshot back: ' + snapshot.status);
    const events = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${topic.guid}/events`);
    log(`topic events: ${events.map((e) => (e.actions || []).map((a) => a.type).join('+')).join(', ')}`);
    assert.ok(events.length >= 1);
    return topic.server_assigned_id;
  }, 90000);

  test('opencde live: the five tables (C3)', async (assert) => {
    const topics = await timed('fetchTopics', () => opencde.fetchTopics(shared.connector, shared.projectId));
    assert.ok(topics.rows.length >= 2, 'topics: ' + topics.rows.length);
    const title = topics.columns.indexOf('title');
    assert.ok(topics.rows.some((r) => r[title] === shared.topic.title), 'our topic in the table');
    const comments = await timed('fetchComments', () => opencde.fetchComments(shared.connector, shared.projectId));
    assert.ok(comments.rows.length >= 1, 'comments');
    const components = await timed('fetchComponents', () => opencde.fetchComponents(shared.connector, shared.projectId));
    const guid = components.columns.indexOf('ifc_guid'); const role = components.columns.indexOf('role'); const color = components.columns.indexOf('color');
    const ours = components.rows.filter((r) => WALLS.includes(r[guid]));
    assert.equal(ours.length, 4, 'three selected and one coloured: ' + ours.length);
    assert.ok(ours.some((r) => r[role] === 'coloring' && r[color] === 'FF0000'), 'coloured wall');
    const events = await timed('fetchEvents', () => opencde.fetchEvents(shared.connector, shared.projectId));
    assert.ok(events.rows.length >= 2, 'events: ' + events.rows.length);
    const files = await timed('fetchFiles', () => opencde.fetchFiles(shared.connector, shared.projectId));
    log(`files_information rows before uploads: ${files.rows.length}`);
    shared.topicsTable = topics;
    return `${topics.rows.length} topics, ${components.rows.length} components`;
  }, 90000);

  test('opencde live: probes of what the browser lets through to the server', async (assert) => {
    const token = await opencde.ensureToken(shared.connector);
    const url = `${BASE}/bcf/3.0/projects/${shared.projectId}/documents`;
    const bytes = new TextEncoder().encode(['ISO-10303-21;', 'HEADER;', 'ENDSEC;', 'DATA;', 'ENDSEC;', 'END-ISO-10303-21;', ''].join(String.fromCharCode(10)));
    const variants = [
      ['text/plain string body', { 'Content-Type': 'text/plain' }, 'hej'],
      ['octet-stream Uint8Array', { 'Content-Type': 'application/octet-stream' }, bytes],
      ['octet-stream ArrayBuffer', { 'Content-Type': 'application/octet-stream' }, bytes.buffer],
      ['octet-stream Blob', { 'Content-Type': 'application/octet-stream' }, new Blob([bytes])],
      ['octet-stream + Content-Disposition', { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="probe.ifc"' }, bytes],
      ['no content type, Blob', {}, new Blob([bytes], { type: 'application/octet-stream' })],
    ];
    for (const [name, headers, body] of variants) {
      try {
        const res = await fetch(url, { method: 'POST', headers: Object.assign({ Authorization: 'Bearer ' + token }, headers), body });
        const text = await res.text();
        log(`probe ${name}: ${res.status} ${text.slice(0, 100).replace(/\s+/g, ' ')}`);
      } catch (err) { log(`probe ${name}: fetch failed: ${err && err.message}`); }
    }
    assert.ok(true);
    return 'ok';
  }, 60000);

  test('opencde live: a BCF document (binary POST) and the topic header files', async (assert) => {
    const bytes = ifcBytes();
    const res = await timed('POST bcf document', () => raw('POST', `/bcf/3.0/projects/${shared.projectId}/documents`, { body: bytes, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="testhus.ifc"' } })).catch((e) => e);
    if (res instanceof Error) throw res;
    assert.ok(res.ok, `document: ${res.status} ${res.text.slice(0, 200)}`);
    assert.ok((res.headers.get('X-RateLimit-Limit') || '') !== '' || true, 'rate limit headers may show');
    const doc = JSON.parse(res.text);
    assert.equal(doc.filename, 'testhus.ifc', JSON.stringify(doc));
    shared.bcfDocument = doc;
    const list = await opencde.bcfDocuments(shared.connector, shared.projectId);
    assert.ok(list.some((d) => d.guid === doc.guid), 'listed');
    const info = await opencde.filesInformation(shared.connector, shared.projectId);
    const entry = info.find((e) => e.file && e.file.filename === 'testhus.ifc');
    assert.ok(entry, 'in files_information: ' + JSON.stringify(info).slice(0, 300));
    log(`files_information ifc_project for the model: ${entry && entry.file.ifc_project}`);
    const header = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${shared.topic.guid}/files`, { method: 'PUT', json: [{ filename: 'testhus.ifc', ifc_project: entry.file.ifc_project || undefined, reference: entry.file.reference }] });
    assert.equal(header.length, 1, JSON.stringify(header));
    const back = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/documents/${doc.guid}`, { headers: { Accept: '*/*' }, responseType: 'arraybuffer' });
    assert.equal(back.buffer.byteLength, bytes.byteLength, 'the same bytes back');
    return doc.guid;
  }, 90000);

  test('opencde live: Documents API upload in parts, then the version query', async (assert) => {
    const bytes = ifcBytes();
    const started = await opencde.api(shared.connector, '/documents/1.0/upload-documents', { method: 'POST', json: { callback: { url: REDIRECT, expires_in: 600 }, files: [{ file_name: 'testhus.ifc', session_file_id: 'f1' }] } });
    assert.ok(started.upload_ui_url, JSON.stringify(started));
    log(`max upload ${started.max_size_in_bytes} bytes`);
    const page = await helper('/upload', { url: started.upload_ui_url, project: shared.projectId, title: 'Tre väggar', version: '1' });
    const q = new URL(page.callback).searchParams;
    assert.ok(q.get('upload_documents_url'), 'callback: ' + page.callback);
    const plan = await opencde.api(shared.connector, q.get('upload_documents_url'), { method: 'POST', json: { files: [{ session_file_id: 'f1', size_in_bytes: bytes.byteLength }] } });
    const todo = plan.documents_to_upload[0];
    log(`parts: ${todo.upload_file_parts.length}`);
    for (const part of todo.upload_file_parts) {
      const chunk = bytes.slice(part.content_range_start, part.content_range_end + 1);
      const headers = { 'Content-Type': 'application/octet-stream' };
      for (const hv of ((part.additional_headers || {}).values || [])) headers[hv.name] = hv.value;
      const res = await raw(part.http_method || 'PUT', part.url, { body: chunk, headers });
      assert.ok(res.ok, `part ${part.content_range_start}: ${res.status} ${res.text.slice(0, 200)}`);
    }
    const version = await timed('complete upload', () => opencde.api(shared.connector, todo.upload_completion.url, { method: 'POST' }));
    assert.ok(version.document_id && version.version_number, JSON.stringify(version).slice(0, 300));
    shared.documentId = version.document_id;
    const query = await opencde.api(shared.connector, '/documents/1.0/document-versions', { method: 'POST', json: { document_ids: [version.document_id] } });
    assert.equal(query.versions.length, 1, JSON.stringify(query).slice(0, 200));
    assert.equal(query.versions[0].title, 'Tre väggar');
    const cancelled = await opencde.api(shared.connector, '/documents/1.0/upload-documents', { method: 'POST', json: { callback: { url: REDIRECT, expires_in: 600 }, files: [{ file_name: 'x.csv', session_file_id: 'f2' }] } });
    const cancelPage = await helper('/upload', { url: cancelled.upload_ui_url, cancel: '1' });
    assert.equal(new URL(cancelPage.callback).searchParams.get('user_cancelled_upload'), 'true', cancelPage.callback);
    return version.document_id;
  }, 120000);

  test('opencde live: change a topic and a comment, delete a viewpoint, and a new version of a document', async (assert) => {
    const p = shared.projectId; const tp = shared.topic;
    const current = await opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}`);
    const statuses = shared.ext.topic_status || [];
    const next = statuses.find((x) => x !== current.topic_status) || current.topic_status;
    const put = Object.assign({}, current, { topic_status: next, title: current.title + ' (ändrat)' });
    for (const k of ['guid', 'server_assigned_id', 'creation_author', 'creation_date', 'modified_author', 'modified_date', 'authorization']) delete put[k];
    const changed = await timed('PUT topic', () => opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}`, { method: 'PUT', json: put }));
    assert.equal(changed.topic_status, next, JSON.stringify(changed).slice(0, 200));
    assert.ok(changed.title.endsWith('(ändrat)'));
    shared.topic = changed;
    const comments = await opencde.comments(shared.connector, p, tp.guid);
    const c = comments[0];
    const edited = await opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}/comments/${c.guid}`, { method: 'PUT', json: { comment: c.comment + ' Rättat.', viewpoint_guid: c.viewpoint_guid } });
    assert.ok(edited.comment.endsWith('Rättat.'), JSON.stringify(edited).slice(0, 200));
    const cEvents = await opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}/comments/${c.guid}/events`);
    log(`comment events: ${cEvents.map((e) => (e.actions || []).map((a) => a.type).join('+')).join(', ')}`);
    const extra = await opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}/viewpoints`, { method: 'POST', json: { perspective_camera: { camera_view_point: { x: 1, y: 1, z: 1 }, camera_direction: { x: -1, y: -1, z: -1 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 50, aspect_ratio: 1 } } });
    await opencde.api(shared.connector, `/bcf/3.0/projects/${p}/topics/${tp.guid}/viewpoints/${extra.guid}`, { method: 'DELETE' });
    const vps = await opencde.viewpoints(shared.connector, p, tp.guid);
    assert.ok(!vps.some((v) => v.guid === extra.guid) && vps.some((v) => v.guid === shared.viewpoint.guid), 'one viewpoint gone, one left');
    if (shared.documentId) {
      const bytes = ifcBytes();
      const started = await opencde.api(shared.connector, '/documents/1.0/upload-documents', { method: 'POST', json: { callback: { url: REDIRECT, expires_in: 600 }, files: [{ file_name: 'testhus.ifc', session_file_id: 'f1', document_id: shared.documentId }] } });
      const page = await helper('/upload', { url: started.upload_ui_url, project: p, title: 'Tre väggar', version: '2' });
      const plan = await opencde.api(shared.connector, new URL(page.callback).searchParams.get('upload_documents_url'), { method: 'POST', json: { files: [{ session_file_id: 'f1', size_in_bytes: bytes.byteLength }] } });
      const todo = plan.documents_to_upload[0];
      for (const part of todo.upload_file_parts) {
        const headers = { 'Content-Type': 'application/octet-stream' };
        for (const hv of ((part.additional_headers || {}).values || [])) headers[hv.name] = hv.value;
        const r = await raw(part.http_method || 'PUT', part.url, { body: bytes.slice(part.content_range_start, part.content_range_end + 1), headers });
        assert.ok(r.ok, 'part ' + r.status);
      }
      const v2 = await opencde.api(shared.connector, todo.upload_completion.url, { method: 'POST' });
      assert.equal(v2.document_id, shared.documentId, 'the same document');
      log(`new version: ${v2.version_number} (index ${v2.version_index})`);
      const versions = await opencde.api(shared.connector, `/documents/1.0/documents/${shared.documentId}/versions`);
      log(`versions listed: ${Array.isArray(versions) ? versions.length : JSON.stringify(versions).slice(0, 80)}`);
      const latest = await opencde.api(shared.connector, '/documents/1.0/document-versions', { method: 'POST', json: { document_ids: [shared.documentId] } });
      assert.equal(latest.versions[0].version_index, v2.version_index, 'the query gives the latest version');
    }
    return 'ok';
  }, 120000);

  test('opencde live: select documents on the server page, import the model, match the guids (C5, C6)', async (assert) => {
    const popupSelect = async (url) => (await helper('/select', shared.documentId ? { url, ids: shared.documentId } : { url })).callback;
    const selected = await timed('selectDocuments', () => opencde.selectDocuments(shared.connector, { popup: popupSelect, redirectUri: REDIRECT, extensions: ['.ifc'] }));
    assert.ok(selected && selected.documents.length >= 1, 'documents: ' + JSON.stringify(selected).slice(0, 200));
    log(`selected: ${selected.documents.map((d) => (d.file_description && d.file_description.name) || d.title).join(', ')}`);
    const version = selected.documents.find((d) => d.file_description && d.file_description.name === 'testhus.ifc') || selected.documents.find((d) => d.document_id === shared.documentId) || selected.documents[0];
    const file = await opencde.downloadVersion(shared.connector, version);
    assert.equal(file.name, 'testhus.ifc', file.name);
    const meta = await timed('import model', () => importer.run(file, {}, null, version.title));
    shared.created.push(meta.id);
    assert.equal(meta.kind, 'model', JSON.stringify({ kind: meta.kind, rows: meta.rowCount }));
    const cols = await datasets.columns(meta.id);
    const g = cols.findIndex((c) => c.name === 'guid');
    const guids = new Set((await datasets.query(meta.id, {})).map((r) => r[g]));
    for (const w of WALLS) assert.ok(guids.has(w), 'wall in the model: ' + w);
    const cancelled = await opencde.selectDocuments(shared.connector, { popup: async (url) => (await helper('/select', { url, cancel: '1' })).callback, redirectUri: REDIRECT });
    assert.equal(cancelled, null, 'cancellation is null');
    return `${meta.rowCount} elements`;
  }, 120000);

  test('opencde live: the project files, a model fetched from the CDE, and the version check', async (assert) => {
    const files = await timed('filesList', () => opencde.filesList(shared.connector, shared.projectId));
    log(`files: ${files.map((f) => `${f.filename} [${f.source}${f.versionIndex ? ' v' + f.versionIndex : ''}]`).join(', ')}`);
    const ifc = files.find((f) => f.model && f.documentId) || files.find((f) => f.model);
    assert.ok(ifc, 'a model among the files');
    const rights = await opencde.rights(shared.connector, shared.projectId);
    assert.ok(rights.project.includes('createTopic'), JSON.stringify(rights));
    const meta = await timed('importFile', () => opencde.importFile(shared.connector, { project_id: shared.projectId, name: PROJECT_NAME }, ifc));
    shared.created.push(meta.id);
    assert.equal(meta.kind, 'model');
    assert.equal(meta.source.cde.projectId, shared.projectId);
    if (ifc.documentId) {
      const check = await opencde.newerVersion(shared.connector, meta);
      log(`version check: have ${check.have}, newer ${check.newer}`);
      assert.equal(check.newer, false, 'the latest was fetched');
    }
    return `${files.length} files`;
  }, 90000);

  test('opencde live: the family uploads through the Documents API and as a BCF document, and the project becomes a BCF file', async (assert) => {
    const csv = new File([new TextEncoder().encode('kommun;antal' + String.fromCharCode(10) + 'Umeå;130' + String.fromCharCode(10))], 'tabell.csv', { type: 'text/csv' });
    const steps = [];
    const popupUpload = async (url) => (await helper('/upload', { url, project: shared.projectId, title: 'Familjens tabell', version: '1' })).callback;
    const version = await timed('uploadDocument', () => opencde.uploadDocument(shared.connector, csv, { redirectUri: REDIRECT, popup: popupUpload, onProgress: (p) => steps.push(p.done) }));
    assert.ok(version && version.document_id, JSON.stringify(version).slice(0, 200));
    assert.ok(steps.length >= 1 && steps[steps.length - 1] === csv.size, 'progress reached the end: ' + steps.join(','));
    const next = await opencde.uploadDocument(shared.connector, csv, { documentId: version.document_id, redirectUri: REDIRECT, popup: popupUpload });
    assert.equal(next.document_id, version.document_id);
    assert.ok(Number(next.version_index) > Number(version.version_index), 'a new version');
    const cancelled = await opencde.uploadDocument(shared.connector, csv, { redirectUri: REDIRECT, popup: async (url) => (await helper('/upload', { url, cancel: '1' })).callback });
    assert.equal(cancelled, null, 'cancelled on the page is null');
    const doc = await timed('uploadBcfDocument', () => opencde.uploadBcfDocument(shared.connector, shared.projectId, new File([ifcBytes()], 'familjens-hus.ifc')));
    assert.equal(doc.filename, 'familjens-hus.ifc', JSON.stringify(doc));
    const files = await opencde.filesList(shared.connector, shared.projectId);
    const listed = files.find((f) => f.documentId === version.document_id);
    assert.ok(listed && Number(listed.versionIndex) === Number(next.version_index), 'the files list knows the document and its latest version: ' + JSON.stringify(listed));
    // The project's issues as a BCF file, and the file read back.
    const bcfXml = D.require('data/bcf-xml');
    const topics = await opencde.topics(shared.connector, shared.projectId, { $top: 100 });
    const items = [];
    for (const tp of topics) {
      const [comments, viewpoints] = await Promise.all([opencde.comments(shared.connector, shared.projectId, tp.guid), opencde.viewpoints(shared.connector, shared.projectId, tp.guid)]);
      const vps = [];
      for (const vp of viewpoints) {
        const base = `/bcf/3.0/projects/${shared.projectId}/topics/${tp.guid}/viewpoints/${vp.guid}`;
        const [sel, col] = await Promise.all([opencde.api(shared.connector, base + '/selection'), opencde.api(shared.connector, base + '/coloring')]);
        const snapshot = vp.snapshot ? await opencde.binary(shared.connector, base + '/snapshot', 'image/*') : null;
        vps.push({ viewpoint: Object.assign({}, vp, { components: { selection: sel.selection || [], coloring: col.coloring || [], visibility: { default_visibility: true } } }), snapshot: snapshot ? { bytes: new Uint8Array(snapshot.buffer), type: snapshot.contentType } : null });
      }
      items.push({ topic: tp, comments, viewpoints: vps });
    }
    const blob = await bcfXml.write(items, { projectName: PROJECT_NAME, projectId: shared.projectId });
    const read = await bcfXml.read(await blob.arrayBuffer());
    assert.equal(read.topics.length, topics.length, 'every topic in the file');
    assert.ok(read.snapshots.length >= 1 && read.snapshots[0].bytes.length > 100, 'a snapshot came along');
    assert.ok(read.components.some((c) => WALLS.includes(c.ifc_guid)), 'the walls are components');
    const meta = await importer.run(new File([blob], 'projektet.bcfzip'), {}, null, 'Projektets BCF');
    shared.created.push(meta.id);
    for (const d of await datasets.list()) if (d.name.startsWith('Projektets BCF') && !shared.created.includes(d.id)) shared.created.push(d.id);
    assert.equal(meta.rowCount, topics.length);
    log(`bcf file ${blob.size} bytes, ${read.topics.length} topics, ${read.comments.length} comments, ${read.components.length} components, ${read.snapshots.length} snapshots`);
    return `${version.document_id} v${next.version_index}`;
  }, 180000);

  test('opencde live: the app registers itself when the server allows it', async (assert) => {
    const result = await opencde.register(BASE, { redirectUri: REDIRECT }).catch((e) => e);
    if (result instanceof Error) { log(`registration: ${result.message}`); return 'skipped: ' + result.message; }
    assert.ok(result.clientId, 'a client id');
    assert.equal(result.clientSecret, '', 'a public client needs no secret');
    log(`registered public client ${result.clientId}`);
    const fresh = (await families.createConnector('opencde', { baseUrl: BASE, clientId: result.clientId, clientSecret: '' })).connector;
    try {
      const creds = await opencde.login(fresh, { popup, redirectUri: REDIRECT });
      assert.ok(creds.token, 'the registered client signs in');
      await opencde.logout(fresh);
    } finally {
      await connectors.remove(fresh.id);
      // Two connectors for one server share the record: put the suite's own back and sign in again.
      await connectors.save(shared.connector);
      await opencde.login(shared.connector, { popup, redirectUri: REDIRECT });
    }
    return result.clientId;
  }, 60000);

  test('opencde live: save a table as a dataset and fetch it again (C4)', async (assert) => {
    const tb = shared.topicsTable;
    const meta = await runner.toDataset({ columns: tb.columns, rows: tb.rows, meta: {} }, { name: 'Kontroll: ärenden', source: { kind: 'api', connectorId: shared.connector.id, connectorName: shared.connector.name, family: 'opencde', opencde: { kind: 'topics', projectId: shared.projectId } } });
    shared.created.push(meta.id);
    const again = await timed('refetch', () => runner.refetch(meta.source));
    assert.equal(again.rows.length, tb.rows.length, 'same count');
    return meta.name;
  }, 60000);

  test('opencde live: ETag, If-None-Match and how the app takes a 304', async (assert) => {
    const first = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/topics`);
    const etag = first.headers.get('ETag');
    assert.ok(first.ok && etag, 'ETag: ' + etag);
    const second = await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics`, { headers: { 'If-None-Match': etag }, notModifiedOk: true }).then(() => 'answered', (e) => e);
    const probe304 = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/topics`, { headers: { 'If-None-Match': etag } });
    log(`conditional GET answered ${probe304.status}; api() with notModifiedOk ${second instanceof Error ? 'failed: ' + second.message : 'took it'}`);
    assert.equal(probe304.status, 304);
    assert.ok(!(second instanceof Error), 'a 304 is a good answer when asked for');
    const limited = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/topics?$top=1&$orderby=creation_date desc`);
    assert.ok(limited.ok && JSON.parse(limited.text).length === 1, 'OData $top and $orderby');
    const filtered = await raw('GET', `/bcf/3.0/projects/${shared.projectId}/topics?$filter=${encodeURIComponent(`title eq '${shared.topic.title}'`)}`);
    assert.ok(filtered.ok && JSON.parse(filtered.text).length === 1, 'OData $filter: ' + filtered.status);
    return etag;
  }, 60000);

  test('opencde live: refresh an expiring token, then sign out and be refused (C7, C8)', async (assert) => {
    const before = secrets.get(shared.connector.id);
    secrets.set(shared.connector.id, Object.assign({}, before, { expiresAt: String(Date.now() + 1000) }));
    const token = await timed('refresh', () => opencde.ensureToken(shared.connector));
    const after = secrets.get(shared.connector.id);
    assert.ok(token && token !== before.token, 'new access token');
    assert.ok(after.refreshToken && after.refreshToken !== before.refreshToken, 'the refresh token rotated');
    const me = await opencde.currentUser(shared.connector);
    assert.equal(me.name, 'Dataspatium provare');
    await opencde.logout(shared.connector);
    assert.equal(opencde.signedIn(shared.connector), false);
    const refused = await opencde.projects(shared.connector).catch((e) => e);
    assert.ok(refused instanceof Error && refused.message === t('opencde.err.signin.first', { name: shared.connector.name }), String(refused && refused.message));
    // The old access token must be dead on the server too.
    const stale = await http.request({ url: BASE + '/foundation/1.0/current-user', headers: { Authorization: 'Bearer ' + token }, retries: 0 });
    log(`old token after sign-out: ${stale.status}`);
    assert.equal(stale.status, 401, 'revoked family');
    await opencde.login(shared.connector, { popup, redirectUri: REDIRECT });
    return 'signed in again';
  }, 60000);

  test('opencde live: a redirect address the server does not know is refused (C9)', async (assert) => {
    const url = new URL(shared.connector.auth.authUrl);
    const probe = { response_type: 'code', client_id: CLIENT, redirect_uri: location.origin + '/annan-sida.html', scope: 'profile bcf documents', state: 'x', code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', code_challenge_method: 'S256' };
    for (const [k, v] of Object.entries(probe)) url.searchParams.set(k, v);
    const err = await helper('/authorize', { url: url.href }).then(() => null, (e) => e);
    assert.ok(err && /authorization page answered 4\d\d/.test(err.message), 'refused without a redirect: ' + (err && err.message));
    return 'ok';
  }, 60000);

  test('opencde live: cleanup', async (assert) => {
    for (const tp of [shared.topic, shared.other]) if (tp) await opencde.api(shared.connector, `/bcf/3.0/projects/${shared.projectId}/topics/${tp.guid}`, { method: 'DELETE' }).catch((e) => log('delete topic: ' + e.message));
    const left = await opencde.fetchTopics(shared.connector, shared.projectId);
    log(`topics left in the project: ${left.rows.length}`);
    await opencde.logout(shared.connector);
    for (const id of shared.created) await datasets.remove(id).catch(() => {});
    if (shared.connector) await connectors.remove(shared.connector.id);
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
