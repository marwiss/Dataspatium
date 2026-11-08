// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataspatium against a real Kontroll OpenCDE server (checklist C in Kontroll's docs/acceptance.md, and more): discovery,
 * sign-in with PKCE, the BCF tables, writing topics, comments, viewpoints and references, both document APIs with upload and
 * download, the model import, the project's files, the family's own uploads, a BCF file out and in, registration, refresh,
 * revocation and the refused redirect. Kontroll III: the issues as a table with the model's elements, the board Ärendeläge,
 * Cypher against the IFC graph (only with ?cdegraph=bolt://host:port, cdegraphuser, cdegraphpass) and a bundle through the CDE.
 * 2.32: the CDE log over the whole run, and with ?cdeadminhelper=<helper signed in as an administrator> the server's request log.
 * 2.34: the capabilities document (/.well-known/kontroll) and the server's error codes in the user's words. Runs only when the page is
 * served over http and given ?cde=<server>&cdehelper=<helper>&cdeclient=<client id>[&cdeproject=<name>][&cdebcf=2.1]; otherwise it is
 * skipped. With cdebcf=2.1 the suite speaks BCF API 2.1, and checks that each version's answers hold what its specification says. The helper (tools/cde-helper.py) plays the user at the server's own pages. See docs/utveckling.md.
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
  /** The id of the user the helper signs in as (Kontroll's seed has dm_manager; a CI job may create another). */
  const CDE_USER = params.get('cdeuser') || 'dm_manager';
  const CLIENT = params.get('cdeclient') || '';
  const PROJECT_NAME = params.get('cdeproject') || 'Dataspatium-prov';
  /** Which version of the BCF API the run speaks. */
  const VERSION = params.get('cdebcf') || '3.0';
  const V21 = VERSION === '2.1';
  const BCF = '/bcf/' + VERSION;
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
    const disc = await timed('discover', () => opencde.discover(BASE, { bcfVersion: VERSION }));
    assert.deepEqual(disc.bcfVersions, ['3.0', '2.1'], 'the server has both, newest first');
    assert.equal(disc.bcfVersion, VERSION);
    assert.deepEqual(Object.keys(disc.apis).sort(), ['bcf', 'documents', 'foundation'], JSON.stringify(disc.apis));
    assert.ok(disc.pkceRequired, 'PKCE required');
    const res = await families.createConnector('opencde', { baseUrl: BASE, clientId: CLIENT, clientSecret: '', bcfVersion: VERSION });
    shared.connector = res.connector;
    assert.equal(shared.connector.family.type, 'opencde');
    assert.equal(opencde.bcfVersion(shared.connector), VERSION, 'the source speaks the version asked for');
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
    assert.equal(me.id, CDE_USER, JSON.stringify(me)); assert.ok(me.name, 'the server names the user: ' + JSON.stringify(me));
    return me.id;
  }, 60000);

  test('opencde live: projects, extensions and what the user may do', async (assert) => {
    const projects = await opencde.projects(shared.connector);
    const mine = projects.find((p) => p.name === PROJECT_NAME);
    assert.ok(mine, 'project ' + PROJECT_NAME + ' among ' + projects.map((p) => p.name).join(', '));
    shared.projectId = mine.project_id;
    // Leftovers from an aborted run would double the counts below: the suite's own topics go first.
    const stale = (await opencde.topics(shared.connector, shared.projectId, { $top: 500 })).filter((tp) => /^Dataspatium: /.test(String(tp.title || '')));
    for (const tp of stale) await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${tp.guid}`, { method: 'DELETE' }).catch((e) => log('stale topic: ' + e.message));
    if (stale.length) log(`removed ${stale.length} stale topics from an earlier run`);
    const ext = await opencde.extensions(shared.connector, shared.projectId);
    log(`extensions: types ${(ext.topic_type || []).length}, statuses ${(ext.topic_status || []).length}, labels ${(ext.topic_label || []).length}, users ${(ext.users || []).length}`);
    assert.ok(Array.isArray(ext.project_actions) && ext.project_actions.includes('createTopic'), 'project_actions: ' + JSON.stringify(ext.project_actions));
    const withAuth = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}?includeAuthorization=true`);
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
    const topic = await timed('create topic', () => opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics`, { method: 'POST', json: body }));
    assert.ok(topic.guid && (V21 ? !('server_assigned_id' in topic) : topic.server_assigned_id), JSON.stringify(topic).slice(0, 200));
    shared.topic = topic;
    const other = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics`, { method: 'POST', json: Object.assign({}, body, { title: 'Dataspatium: relaterat ärende' }) });
    shared.other = other;
    const vp = await timed('create viewpoint', () => opencde.createViewpoint(shared.connector, shared.projectId, topic.guid, {
      perspective_camera: { camera_view_point: { x: 12, y: -8, z: 4 }, camera_direction: { x: -0.6, y: 0.7, z: -0.3 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 60, aspect_ratio: 1.6 },
      snapshot: { snapshot_type: 'png', snapshot_data: pngDataUrl() },
      components: { selection: WALLS.map((g) => ({ ifc_guid: g, originating_system: 'Dataspatium' })), coloring: [{ color: 'FF0000', components: [{ ifc_guid: WALLS[0] }] }], visibility: { default_visibility: true } },
    }));
    assert.ok(vp.guid, 'viewpoint');
    if (V21) assert.ok(!('aspect_ratio' in vp.perspective_camera) && !('authorization' in vp), 'a viewpoint of 2.1 has neither: ' + JSON.stringify(vp).slice(0, 200));
    shared.viewpoint = vp;
    const comment = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${topic.guid}/comments`, { method: 'POST', json: { comment: 'Se de markerade väggarna.', viewpoint_guid: vp.guid } });
    assert.equal(comment.viewpoint_guid, vp.guid, JSON.stringify(comment));
    if (V21) {
      // What 2.1 has and 3.0 does not.
      const answer = await opencde.createComment(shared.connector, shared.projectId, topic.guid, { comment: 'Håller med.', reply_to_comment_guid: comment.guid });
      assert.equal(answer.reply_to_comment_guid, comment.guid, JSON.stringify(answer));
      const wrong = await opencde.createComment(shared.connector, shared.projectId, topic.guid, { comment: 'Fel', reply_to_comment_guid: '00000000-0000-4000-8000-000000000000' }).catch((e) => e);
      assert.ok(wrong instanceof Error && wrong.status === 400, 'a reply to a comment that is not there: ' + (wrong && wrong.status));
      const table = await opencde.fetchComments(shared.connector, shared.projectId, [topic]);
      assert.ok(table.rows.some((r) => r[table.columns.indexOf('reply_to_comment_guid')] === comment.guid), 'the table holds the reply');
      const ext21 = await opencde.extensions(shared.connector, shared.projectId);
      assert.ok(Array.isArray(ext21.users) && ext21.users.length && Array.isArray(ext21.user_id_type), 'user_id_type is read as users: ' + JSON.stringify(ext21).slice(0, 160));
    }
    const ref = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${topic.guid}/document_references`, { method: 'POST', json: { url: 'https://example.org/ritningar/A-40-1-100.pdf', description: 'Planritning' } });
    assert.ok(ref.guid, 'document reference');
    const related = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${topic.guid}/related_topics`, { method: 'PUT', json: [{ related_topic_guid: other.guid }] });
    assert.equal(related.length, 1, JSON.stringify(related));
    const snapshot = await raw('GET', `${BCF}/projects/${shared.projectId}/topics/${topic.guid}/viewpoints/${vp.guid}/snapshot`, { headers: { Accept: 'image/png' }, responseType: 'arraybuffer' });
    assert.ok(snapshot.ok && snapshot.buffer && snapshot.buffer.byteLength > 100, 'snapshot back: ' + snapshot.status);
    const events = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${topic.guid}/events`);
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
    log(`files before uploads: ${files.rows.length}`);
    shared.topicsTable = topics;
    return `${topics.rows.length} topics, ${components.rows.length} components`;
  }, 90000);

  test('opencde live: probes of what the browser lets through to the server', async (assert) => {
    const token = await opencde.ensureToken(shared.connector);
    const url = `${BASE}${BCF}/projects/${shared.projectId}/documents`;
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
    const res = await timed('POST bcf document', () => raw('POST', `${BCF}/projects/${shared.projectId}/documents`, { body: bytes, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="testhus.ifc"' } })).catch((e) => e);
    if (res instanceof Error) throw res;
    assert.ok(res.ok, `document: ${res.status} ${res.text.slice(0, 200)}`);
    assert.ok((res.headers.get('X-RateLimit-Limit') || '') !== '' || true, 'rate limit headers may show');
    const doc = JSON.parse(res.text);
    assert.equal(doc.filename, 'testhus.ifc', JSON.stringify(doc));
    shared.bcfDocument = doc;
    const list = await opencde.bcfDocuments(shared.connector, shared.projectId);
    assert.ok(list.some((d) => d.guid === doc.guid), 'listed');
    if (V21) {
      const gone = await opencde.filesInformation(shared.connector, shared.projectId).catch((e) => e);
      assert.ok(gone instanceof Error && gone.status === 404, 'no files information in 2.1: ' + (gone && gone.status));
      const entry = (await opencde.filesList(shared.connector, shared.projectId)).find((f) => f.filename === 'testhus.ifc');
      assert.ok(entry && entry.model, 'the document is what 2.1 can name');
      const header = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${shared.topic.guid}/files`, { method: 'PUT', json: [{ file_name: 'testhus.ifc', reference: entry.reference }] });
      assert.equal(header[0].file_name, 'testhus.ifc', 'file_name for filename: ' + JSON.stringify(header));
    } else {
      const info = await opencde.filesInformation(shared.connector, shared.projectId);
      const entry = info.find((e) => e.file && e.file.filename === 'testhus.ifc');
      assert.ok(entry, 'in files_information: ' + JSON.stringify(info).slice(0, 300));
      log(`files_information ifc_project for the model: ${entry && entry.file.ifc_project}`);
      const header = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${shared.topic.guid}/files`, { method: 'PUT', json: [{ filename: 'testhus.ifc', ifc_project: entry.file.ifc_project || undefined, reference: entry.file.reference }] });
      assert.equal(header.length, 1, JSON.stringify(header));
    }
    const back = await raw('GET', `${BCF}/projects/${shared.projectId}/documents/${doc.guid}`, { headers: { Accept: '*/*' }, responseType: 'arraybuffer' });
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
    const current = await opencde.api(shared.connector, `${BCF}/projects/${p}/topics/${tp.guid}`);
    const statuses = shared.ext.topic_status || [];
    const next = statuses.find((x) => x !== current.topic_status) || current.topic_status;
    const put = Object.assign({}, current, { topic_status: next, title: current.title + ' (ändrat)' });
    for (const k of ['guid', 'server_assigned_id', 'creation_author', 'creation_date', 'modified_author', 'modified_date', 'authorization']) delete put[k];
    const changed = await timed('PUT topic', () => opencde.api(shared.connector, `${BCF}/projects/${p}/topics/${tp.guid}`, { method: 'PUT', json: put }));
    assert.equal(changed.topic_status, next, JSON.stringify(changed).slice(0, 200));
    assert.ok(changed.title.endsWith('(ändrat)'));
    shared.topic = changed;
    const comments = await opencde.comments(shared.connector, p, tp.guid);
    const c = comments[0];
    const edited = await opencde.api(shared.connector, `${BCF}/projects/${p}/topics/${tp.guid}/comments/${c.guid}`, { method: 'PUT', json: { comment: c.comment + ' Rättat.', viewpoint_guid: c.viewpoint_guid } });
    assert.ok(edited.comment.endsWith('Rättat.'), JSON.stringify(edited).slice(0, 200));
    const cEvents = await opencde.api(shared.connector, `${BCF}/projects/${p}/topics/${tp.guid}/comments/${c.guid}/events`);
    log(`comment events: ${cEvents.map((e) => (e.actions || []).map((a) => a.type).join('+')).join(', ')}`);
    const extra = await opencde.createViewpoint(shared.connector, p, tp.guid, { perspective_camera: { camera_view_point: { x: 1, y: 1, z: 1 }, camera_direction: { x: -1, y: -1, z: -1 }, camera_up_vector: { x: 0, y: 0, z: 1 }, field_of_view: 50, aspect_ratio: 1 } });
    if (V21) {
      const told = await opencde.deleteViewpoint(shared.connector, p, tp.guid, extra.guid).catch((e) => e);
      assert.equal(told.message, t('opencde.err.bcf21.deleteviewpoint'), 'the app says so');
      const refused = await raw('DELETE', `${BCF}/projects/${p}/topics/${tp.guid}/viewpoints/${extra.guid}`);
      assert.equal(refused.status, 405, 'and so does the server');
    } else {
      await opencde.deleteViewpoint(shared.connector, p, tp.guid, extra.guid);
      const vps = await opencde.viewpoints(shared.connector, p, tp.guid);
      assert.ok(!vps.some((v) => v.guid === extra.guid) && vps.some((v) => v.guid === shared.viewpoint.guid), 'one viewpoint gone, one left');
    }
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
    const ifc = files.find((f) => f.model && f.documentId) || files.find((f) => f.model && f.filename === 'testhus.ifc') || files.find((f) => f.model);
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
    if (V21) assert.ok(!listed && files.some((f) => f.filename === 'familjens-hus.ifc'), 'in 2.1 the list is the BCF documents: ' + JSON.stringify(files).slice(0, 200));
    else assert.ok(listed && Number(listed.versionIndex) === Number(next.version_index), 'the files list knows the document and its latest version: ' + JSON.stringify(listed));
    // The project's issues as a BCF file, and the file read back.
    const bcfXml = D.require('data/bcf-xml');
    const topics = await opencde.topics(shared.connector, shared.projectId, { $top: 100 });
    const items = [];
    for (const tp of topics) {
      const [comments, viewpoints] = await Promise.all([opencde.comments(shared.connector, shared.projectId, tp.guid), opencde.viewpoints(shared.connector, shared.projectId, tp.guid)]);
      const vps = [];
      for (const vp of viewpoints) {
        const base = `${BCF}/projects/${shared.projectId}/topics/${tp.guid}/viewpoints/${vp.guid}`;
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
    const result = await opencde.register(BASE, { redirectUri: REDIRECT, bcfVersion: VERSION }).catch((e) => e);
    if (result instanceof Error) { log(`registration: ${result.message}`); return 'skipped: ' + result.message; }
    assert.ok(result.clientId, 'a client id');
    assert.equal(result.clientSecret, '', 'a public client needs no secret');
    log(`registered public client ${result.clientId}`);
    const fresh = (await families.createConnector('opencde', { baseUrl: BASE, clientId: result.clientId, clientSecret: '', bcfVersion: VERSION })).connector;
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
    const first = await raw('GET', `${BCF}/projects/${shared.projectId}/topics`);
    const etag = first.headers.get('ETag');
    assert.ok(first.ok && etag, 'ETag: ' + etag);
    const second = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics`, { headers: { 'If-None-Match': etag }, notModifiedOk: true }).then(() => 'answered', (e) => e);
    const probe304 = await raw('GET', `${BCF}/projects/${shared.projectId}/topics`, { headers: { 'If-None-Match': etag } });
    log(`conditional GET answered ${probe304.status}; api() with notModifiedOk ${second instanceof Error ? 'failed: ' + second.message : 'took it'}`);
    assert.equal(probe304.status, 304);
    assert.ok(!(second instanceof Error), 'a 304 is a good answer when asked for');
    const limited = await raw('GET', `${BCF}/projects/${shared.projectId}/topics?$top=1&$orderby=creation_date desc`);
    assert.ok(limited.ok && JSON.parse(limited.text).length === 1, 'OData $top and $orderby');
    const filtered = await raw('GET', `${BCF}/projects/${shared.projectId}/topics?$filter=${encodeURIComponent(`title eq '${shared.topic.title}'`)}`);
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
    assert.equal(me.id, CDE_USER); assert.ok(me.name);
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

  test('opencde live III: the issues as a table with the model elements, the counts, the board and the colours', async (assert) => {
    const issuesLogic = D.require('data/issues');
    const model = await importer.run(new File([ifcBytes()], 'testhus.ifc'), {}, null, 'Färgprov');
    shared.created.push(model.id);
    const topics = await opencde.topics(shared.connector, shared.projectId, { $top: 500 });
    const table = await opencde.fetchComponents(shared.connector, shared.projectId, topics);
    const at = Object.fromEntries(table.columns.map((c, i) => [c, i]));
    const parts = new Map();
    for (const r of table.rows) {
      if (!r[at.ifc_guid]) continue;
      const list = parts.get(r[at.topic_guid]) || [];
      list.push({ guid: String(r[at.ifc_guid]) });
      parts.set(r[at.topic_guid], list);
    }
    const engine = (await datasets.ensureOpen(model.id)).engine;
    const res = await engine.exec('select id, guid, typ, namn, vaning from data where guid is not null');
    const elements = new Map(); const info = new Map();
    for (const r of res[0].values) { elements.set(String(r[1]), Number(r[0])); info.set(String(r[1]), { typ: r[2], namn: r[3], vaning: r[4] }); }
    const colors = issuesLogic.colorGroups(topics, parts, elements);
    assert.ok(colors.groups.length >= 1 && colors.groups[0].ids.length >= 1, 'a colour group from the walls the viewpoints point at: ' + JSON.stringify(colors.legend));
    const rows = issuesLogic.tableOf(topics, parts, info);
    const meta = await runner.toDataset(rows, { name: 'Ärenden: Färgprov', source: { kind: 'file', fileName: '', cde: { connectorId: shared.connector.id, connectorName: shared.connector.name, host: opencde.hostOf(BASE), projectId: shared.projectId, projectName: PROJECT_NAME, kind: 'issues', modelId: model.id, modelName: model.name, fetchedAt: new Date().toISOString() } } });
    shared.created.push(meta.id);
    assert.ok(await D.require('data/facets').has(meta.id, 'bcf'), 'the table is a BCF facet');
    const sum = await issuesLogic.summary(meta.id, ['topic_status', 'element_typ']);
    assert.ok(sum.rows.length >= 1 && sum.rows.some((r) => Number(r[2]) >= 1), 'counts per status and element type: ' + JSON.stringify(sum.rows.slice(0, 3)));
    const starters = await D.require('analysis/starters').forDataset(meta, 'sql');
    const piece = starters.find((p) => p.key === 'starter.bcf.elements');
    assert.ok(piece, 'the starter that joins issues and elements');
    const ran = await D.require('data/query').select(meta.id, piece.code, { limit: 50 });
    assert.ok(ran.values.length >= 1, 'the starter runs on the saved table');
    const dash = await D.require('viz/suggest').issueBoard(meta);
    shared.dashboards = [dash.id];
    assert.ok(dash.items.length >= 4 && dash.filters.length === 3, `board with ${dash.items.length} charts`);
    log(`issues table ${rows.rows.length} rows, colours ${colors.legend.map((l) => `${l.status}:${l.n}`).join(', ')}, board ${dash.items.length} charts`);
    return `${rows.rows.length} rows`;
  }, 60000);

  test('opencde live III: Cypher against the IFC graph through the Neo4j source (Bolt over WebSocket)', async (assert) => {
    const params = new URLSearchParams(location.search);
    const bolt = params.get('cdegraph');
    if (!bolt) return 'skipped: no cdegraph';
    const neo4j = D.require('api/families/neo4j');
    const r = await D.require('api/families/databases').createConnector('neo4j', { baseUrl: bolt, database: params.get('cdegraphdb') || 'neo4j', username: params.get('cdegraphuser') || 'neo4j', password: params.get('cdegraphpass') || '' }, { discover: false });
    shared.graphConnector = r.connector;
    const example = (id) => neo4j.EXAMPLES.find((x) => x.id === id).cypher;
    const models = await timed('cypher models', () => neo4j.run(r.connector, example('models')));
    assert.ok(models.rows.length >= 1, 'models in the graph: ' + JSON.stringify(models.rows.slice(0, 3)));
    const walls = await neo4j.run(r.connector, 'MATCH (w:IfcWall) RETURN count(w) AS antal');
    const linked = await neo4j.run(r.connector, example('issue_elements'));
    const classes = await neo4j.run(r.connector, example('classes'));
    log(`graph: ${models.rows.length} models (states ${Array.from(new Set(models.rows.map((x) => x[1]))).join(',')}), ${walls.rows[0] ? walls.rows[0][0] : '?'} walls, ${classes.rows.length} classes, ${linked.rows.length} issue-element links`);
    assert.ok(classes.rows.length >= 1, 'elements in the graph');
    // The model list, a view and a step from a node, as the workbench asks them.
    const ifcGraph = D.require('data/ifc-graph');
    const list = ifcGraph.modelsOf(await neo4j.run(r.connector, ifcGraph.MODELS));
    assert.ok(list.models.length >= 1, 'finished models: ' + JSON.stringify(list).slice(0, 200));
    const model = ifcGraph.pickModel(list.models, shared.documentId ? { documentId: shared.documentId } : null);
    shared.graphModel = model;
    const spatial = await timed('spatial view', () => neo4j.run(r.connector, ifcGraph.viewOf('spatial', model.id).cypher));
    assert.ok(spatial.graph && spatial.graph.nodes.some((n) => n.label === 'IfcProject'), 'the project at the top: ' + JSON.stringify(spatial.graph && spatial.graph.nodes.map((n) => n.label)));
    assert.ok(spatial.graph.nodes.every((n) => n.name), 'every node has a name to show');
    assert.ok(!spatial.graph.nodes.some((n) => n.label === 'IfcEntity' || n.label === 'IfcRoot'), 'the class, not a supertype');
    assert.ok(spatial.graph.edges.length >= 1, 'with its relationships');
    shared.spatialIds = spatial.graph.nodes.map((n) => n.id).sort();
    const wall = await neo4j.run(r.connector, `MATCH (w:IfcWall {model_id: ${ifcGraph.quote(model.id)}}) RETURN w LIMIT 1`);
    const wallNode = wall.graph.nodes[0];
    assert.ok(wallNode.properties.etiketter.includes('IfcWall') && wallNode.properties.etiketter.includes('IfcProduct'), 'all the labels stay: ' + JSON.stringify(wallNode.properties.etiketter));
    assert.equal(ifcGraph.familyOf(wallNode), 'element');
    const around = await neo4j.run(r.connector, ifcGraph.stepFrom('neighbours', wallNode.id));
    assert.ok(around.graph.nodes.length >= 2, 'a step from the wall: ' + around.graph.nodes.length);
    const props = await neo4j.run(r.connector, ifcGraph.stepFrom('properties', wallNode.id));
    log(`from the wall: ${around.graph.nodes.length} neighbours, ${props.rows.length} property rows`);
    // The form from Kontroll 3.0.0: what only writes the file back stays out of what is shown and saved. A server with the earlier form has no blocks.
    const blocks = await neo4j.run(r.connector, 'MATCH (:IfcModel)-[:HAS_STEP_BLOCK]->(b:StepBlock) RETURN b LIMIT 3');
    log(`blocks in the graph: ${blocks.rows.length}`);
    if (blocks.rows.length) {
      assert.ok(blocks.graph.nodes.every((n) => n.label === 'StepBlock' && !('text' in n.properties)), 'no block text: ' + JSON.stringify(blocks.graph.nodes[0]).slice(0, 200));
      assert.ok(JSON.stringify(blocks).length < 20000, 'the answer stays small: ' + JSON.stringify(blocks).length);
      const stepped = await neo4j.run(r.connector, `MATCH (w:IfcWall {model_id: ${ifcGraph.quote(model.id)}}) RETURN w.Representation__step AS steg, w LIMIT 1`);
      assert.ok(!stepped.columns.some((c) => c.startsWith('w.') && /__(type|step)$/.test(c)), 'no helper columns: ' + stepped.columns.join(','));
      assert.ok(Number.isFinite(Number(stepped.rows[0][stepped.columns.indexOf('steg')])), 'but it can be asked for by name');
      assert.ok(!around.graph.nodes.some((n) => n.label === 'StepBlock'), 'a step from a node leaves the blocks out');
      const fromModel = await neo4j.run(r.connector, `MATCH (m:IfcModel {id: ${ifcGraph.quote(model.id)}}) RETURN m`);
      const steps = await neo4j.run(r.connector, ifcGraph.stepFrom('neighbours', fromModel.graph.nodes[0].id));
      assert.ok(!steps.graph.nodes.some((n) => n.label === 'StepBlock'), 'also from the model itself');
    }
    // A real stream, cut in the browser.
    const cut = await neo4j.run(r.connector, 'MATCH (n) RETURN n', { maxRows: 5 });
    assert.equal(cut.rows.length, 5); assert.equal(cut.truncated, true);
    // The accounts are in the same database: their hashes stay behind.
    const accounts = await neo4j.run(r.connector, 'MATCH (u:User) RETURN u, u.password_hash AS password_hash, properties(u) AS alla LIMIT 5');
    assert.ok(accounts.rows.length >= 1, 'users to look at');
    assert.ok(!/argon2|password_hash":/.test(JSON.stringify(accounts.graph)) && !JSON.stringify(accounts.rows).includes('argon2'), 'no hash in the answer: ' + JSON.stringify(accounts.rows[0]).slice(0, 200));
    // Nodes without relationships in the answer are joined by the second question.
    const pair = await neo4j.run(r.connector, ifcGraph.CONNECTING, { params: { ids: spatial.graph.nodes.map((n) => n.id) } });
    assert.ok(pair.graph.edges.length >= spatial.graph.edges.length, 'the second question finds the lines');
    // The real drawing, from the real answer.
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:560px;';
    document.body.appendChild(host);
    try {
      const drawing = await D.require('viz/graph-draw').renderLive(host, spatial.graph, { layout: 'dagre', colorKey: ifcGraph.colorKey });
      assert.equal(drawing.cy.nodes().length, spatial.graph.nodes.length);
      assert.ok(drawing.legend().some((l) => l.key === 'ifc:spatial'), 'the families in the legend: ' + JSON.stringify(drawing.legend()));
      assert.ok(drawing.merge(around.graph, spatial.graph.nodes[0].id) > 0, 'grows');
      drawing.destroy();
    } finally { host.remove(); }
    return `${models.rows.length} models, ${linked.rows.length} links`;
  }, 60000);

  test('opencde live III: a workspace bundle goes to the CDE as a document and comes back whole', async (assert) => {
    const workspace = D.require('data/workspace');
    const model = (await datasets.list()).find((d) => d.name === 'Färgprov');
    assert.ok(model, 'the model from the previous test');
    const res = await workspace.bundle({ name: 'Provpaket', datasetIds: [model.id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false }, author: 'Dataspatium', message: 'Från provet' });
    const file = new File([res.blob], 'provpaket.dataspatium.zip', { type: 'application/zip' });
    const popupUpload = async (url) => (await helper('/upload', { url, project: shared.projectId, title: 'Provpaket', version: '1' })).callback;
    const version = await timed('upload bundle', () => opencde.uploadDocument(shared.connector, file, { redirectUri: REDIRECT, popup: popupUpload }));
    assert.ok(version && version.document_id, JSON.stringify(version).slice(0, 200));
    let back = null;
    if (V21) back = await opencde.downloadVersion(shared.connector, version); // 2.1 lists only BCF documents; the Documents API works as ever
    else {
      const files = await opencde.filesList(shared.connector, shared.projectId);
      const entry = files.find((f) => f.documentId === version.document_id);
      assert.ok(entry && /\.dataspatium\.zip$/i.test(entry.filename), 'the bundle in the files list: ' + JSON.stringify(entry));
      back = await opencde.downloadFile(shared.connector, entry);
    }
    const opened = await workspace.inspect(back);
    assert.equal(opened.manifest && opened.manifest.kind, 'bundle');
    assert.ok((opened.manifest.datasets || []).some((d) => d.id === model.id), 'the model travels in the bundle');
    log(`bundle ${file.size} bytes up and down, manifest ${opened.manifest.name}`);
    return `${file.size} bytes`;
  }, 120000);

  test('opencde live IV: the CDE log holds the run, and the server echoes X-Request-Id', async (assert) => {
    const cdeLog = D.require('api/cde-log');
    const entries = cdeLog.list(shared.connector.id);
    assert.ok(entries.length >= 20, 'entries: ' + entries.length);
    const apis = new Set(entries.map((e) => e.api));
    assert.ok(apis.has('foundation') && apis.has('bcf') && apis.has('documents'), Array.from(apis).join(','));
    const withId = entries.filter((e) => e.requestId);
    assert.ok(withId.length >= 10, 'ids sent: ' + withId.length);
    const echoed = withId.filter((e) => e.responseHeaders && e.responseHeaders['x-request-id'] === e.requestId);
    const failed = entries.filter((e) => e.ok === false || e.error).length;
    log(`cde log: ${entries.length} entries, ${withId.length} with X-Request-Id, ${echoed.length} echoed by the server, ${failed} failed, ${Math.round(entries.reduce((a, e) => a + (e.ms || 0), 0) / entries.length)} ms on average`);
    assert.ok(echoed.length >= 1, 'the server echoes the id');
    const unknown = Array.from(new Set(entries.filter((e) => e.api === 'other').map((e) => e.path)));
    log(`unclassified paths: ${unknown.length ? unknown.join(', ') : 'none'}`);
    const token = secrets.get(shared.connector.id).token;
    assert.ok(!entries.some((e) => JSON.stringify(e).includes(token)), 'no token in the log');
    shared.logEntries = entries.length;
    return `${entries.length} entries, ${echoed.length} echoed`;
  }, 30000);

  test('opencde live IV: the server log holds the same requests (admin scope through a second helper)', async (assert) => {
    const params = new URLSearchParams(location.search);
    const adminHelper = params.get('cdeadminhelper');
    if (!adminHelper) return 'skipped: no cdeadminhelper';
    const cdeLog = D.require('api/cde-log');
    const mine = cdeLog.list(shared.connector.id).filter((e) => e.requestId).slice(-30).map((e) => e.requestId);
    const admin = (await families.createConnector('opencde', { baseUrl: BASE, clientId: CLIENT, clientSecret: '', bcfVersion: VERSION })).connector;
    admin.auth.scope = 'profile bcf documents admin';
    await connectors.save(admin);
    const adminPopup = async (url) => { const r = await fetch(adminHelper + '/authorize?url=' + encodeURIComponent(url)); const j = await r.json(); if (!r.ok) throw new Error(j.error || String(r.status)); return j.callback; };
    try {
      const creds = await opencde.login(admin, { popup: adminPopup, redirectUri: REDIRECT });
      assert.ok(/admin/.test(creds.scope || 'admin'), 'scope: ' + creds.scope);
      const page = await opencde.api(admin, `/admin/api/requests?client_id=${encodeURIComponent(CLIENT)}&limit=1000`);
      const ids = new Set((page.requests || []).map((r) => r.request_id));
      const matched = mine.filter((id) => ids.has(id));
      log(`server log: ${(page.requests || []).length} rows for the client (retention ${page.retention_hours} h), ${matched.length} of the app's last ${mine.length} ids found`);
      assert.ok(matched.length >= Math.min(5, mine.length), 'the server logged the app ids');
      // The administration API (client-guide §7), reads only: every list, the settings, the health and, when on, one graph query.
      const adm = D.require('api/families/opencde-admin');
      if (await adm.available(admin)) {
        assert.ok(adm.hasAdminScope(admin), 'the token carries the admin scope');
        const o = await adm.overview(admin);
        assert.ok(Number.isFinite(Number(o.users)) && o.version, 'overview: ' + JSON.stringify(o));
        const users = await adm.users(admin, {});
        const projects = await adm.projects(admin, {});
        const clients = await adm.clients(admin);
        const sessions = await adm.sessions(admin, {});
        const audit = await adm.audit(admin, { limit: 50 });
        const settings = await adm.settings(admin);
        const health = await adm.health(admin);
        log(`admin: ${o.version}, ${users.total} users, ${projects.total} projects, ${clients.total} clients, ${sessions.total} sessions, ${audit.items.length} audit rows, ${(health.checks || []).length} checks (${health.ok ? 'ok' : 'problems'}), request log ${o.request_log && o.request_log.enabled ? 'on' : 'off'}`);
        assert.ok(users.items.some((u) => u.is_admin), 'an administrator is listed');
        assert.ok(projects.items.some((p) => Array.isArray(p.members)), 'projects carry members');
        assert.ok(clients.items.some((c) => c.client_id === CLIENT), 'the app\'s own client is listed');
        assert.ok(settings.public_url && settings.raw, 'settings are structured with the raw values beside');
        assert.ok(adm.tableOf('users', users.items).rows.length === users.items.length, 'the list becomes a table');
        const caps = await opencde.capabilities(admin, { force: true });
        if (opencde.hasExtension(caps, 'graph_query')) {
          const g = await adm.graphQuery(admin, 'MATCH (n) RETURN labels(n) AS etikett, count(*) AS antal ORDER BY antal DESC LIMIT 5');
          log(`graph query: ${g.rows.length} rows (${g.columns.join(', ')}), truncated ${g.truncated}`);
          assert.deepEqual(g.columns, ['etikett', 'antal']);
          const refused = await adm.graphQuery(admin, 'MATCH (n) DETACH DELETE n').catch((e) => e);
          assert.ok(refused instanceof Error && refused.code === 'validation_error', 'a writing statement is refused: ' + (refused && refused.code));
          // The IFC graph through the server: the same answer as over Bolt, drawn from JSON, with what the server promises kept.
          const graphSource = D.require('api/graph-source');
          const ifcGraph = D.require('data/ifc-graph');
          const run = graphSource.adminRunner(admin);
          const models = ifcGraph.modelsOf(await run(ifcGraph.MODELS));
          assert.ok(models.models.length >= 1, 'models through the server');
          const model = shared.graphModel || ifcGraph.pickModel(models.models, null);
          const spatial = await timed('spatial view through the server', () => run(ifcGraph.viewOf('spatial', model.id).cypher));
          assert.ok(spatial.graph && spatial.graph.nodes.some((n) => n.label === 'IfcProject'), 'the project at the top: ' + JSON.stringify(spatial.graph && spatial.graph.nodes.map((n) => n.label)));
          if (shared.spatialIds) assert.deepEqual(spatial.graph.nodes.map((n) => n.id).sort(), shared.spatialIds, 'the same nodes as over Bolt');
          const around = await run(ifcGraph.stepFrom('neighbours', spatial.graph.nodes[0].id));
          assert.ok(around.graph && around.graph.nodes.length >= 2, 'a step from a node through the server');
          const joined = await run(ifcGraph.CONNECTING, { params: { ids: spatial.graph.nodes.map((n) => n.id) } });
          assert.ok(joined.graph && joined.graph.edges.length >= 1, 'parameters reach the server');
          const accounts = await run('MATCH (u:User) RETURN u LIMIT 5');
          assert.ok(accounts.rows.length >= 1 && !JSON.stringify(accounts).includes('argon2'), 'the accounts without their hashes');
          log(`graph through the server: ${models.models.length} models, ${spatial.graph.nodes.length} nodes in the spatial view`);
        } else log('graph query: the extension is off');
      } else log('admin: the server has no administration API');
      await opencde.logout(admin).catch(() => {});
    } finally {
      await connectors.remove(admin.id).catch(() => {});
      // The two connectors share the record: put the suite's own back and sign in again as the ordinary user.
      await connectors.save(shared.connector);
      await opencde.login(shared.connector, { popup, redirectUri: REDIRECT });
    }
    return 'ok';
  }, 90000);

  test('opencde live V: the capabilities document, when the server has one, and the error codes in the user\'s words', async (assert) => {
    const caps = await opencde.capabilities(shared.connector, { force: true });
    if (!caps.present) { log('capabilities: the server has no /.well-known/kontroll yet'); } else {
      const on = Object.keys(caps.extensions).filter((k) => opencde.hasExtension(caps, k));
      log(`capabilities: ${caps.server ? caps.server.name + ' ' + caps.server.version : '?'}; extensions on: ${on.join(', ')}; scopes ${caps.scopes.join(' ')}; max upload ${caps.limits.max_upload_bytes}`);
      assert.ok(caps.apis && caps.apis.bcf, 'the document names the BCF API');
      if (caps.bcfVersions) assert.deepEqual(opencde.bcfVersionsOf({ family: {} }, caps), ['3.0', '2.1'], 'and which versions');
      assert.ok(on.includes('dynamic_client_registration'), 'registration is on in the dev stack');
    }
    // A missing topic: the server answers 404 with a code when it has codes, a plain message otherwise.
    const err = await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/00000000-0000-4000-8000-000000000000`).catch((e) => e);
    assert.ok(err instanceof Error && err.status === 404, 'a 404 for an unknown topic: ' + (err && err.status));
    log(`error code for an unknown topic: ${err.code || '(none)'}; message shown: ${err.message}`);
    if (err.code) assert.ok(err.message.includes(t('opencde.err.code.' + err.code)) || err.code === 'not_found', 'translated');
    return caps.present ? 'with capabilities' : 'without capabilities';
  }, 30000);

  test('opencde live VI: Validera modellen reads the server\'s check of a model, its IDS check included (only with ?cdevaldoc=)', async (assert) => {
    const docId = params.get('cdevaldoc') || '';
    if (!docId) return 'skipped: give ?cdevaldoc=<document id of an IFC version the server has checked>[&cdevalver=<version>]';
    const version = Number(params.get('cdevalver') || 1);
    const validation = D.require('data/ifc-validation');
    const summary = validation.fromMetadata(await opencde.versionMetadata(shared.connector, docId, version));
    assert.ok(summary, 'the server checked the version');
    log(`validation: ${summary.status}, ${summary.issues} findings, rulesets ${summary.ruleset}`);
    const report = await opencde.validationReport(shared.connector, docId, version);
    assert.ok(report && Array.isArray(report.issues), 'the report from the app\'s own address');
    const checks = validation.checksOf(report);
    log('checks: ' + checks.map((c) => `${c.name} ${c.state} ${c.findings}${c.notRun.length ? ' not run: ' + c.notRun.join(', ') : ''}`).join('; '));
    const ids = checks.find((c) => c.name === 'ids');
    let s = null;
    if (ids) {
      assert.ok(Array.isArray(ids.specifications) && ids.specifications.length, 'the specifications of the IDS check');
      s = validation.specsSummary(ids);
      log(`ids: ${s.total} specifications in ${s.documents} documents, ${s.passed} passed, ${s.failed} failed, ${s.notApplicable} not applicable`);
      for (const x of ids.specifications) log(`  spec ${x.identifier || '-'} "${x.name}" in "${x.document}": ${x.status}, ${x.usage}, applies to ${x.applicable}, ${x.issues} issues${x.forThisSchema ? '' : ', not for this schema'}`);
      assert.equal(s.passed + s.failed + s.notApplicable, s.total, 'every verdict is one the app knows');
      const idsIssues = report.issues.filter((i) => i.kind === 'ids');
      if (!report.truncated) assert.equal(idsIssues.length, ids.findings, 'the IDS findings listed are the ones the check counted');
      if (idsIssues.some((i) => !i.document_id)) finding('an IDS finding without document_id');
    } else finding('the server\'s report has no IDS check');
    // The card in Hantera, on the model fetched from the server.
    const name = params.get('cdevalname') || 'modell.ifc';
    const model = await opencde.importFile(shared.connector, { project_id: shared.projectId, name: PROJECT_NAME }, { filename: name, reference: `${BASE}/documents/1.0/documents/${docId}/versions/${version}/download`, documentId: docId, versionIndex: version, ifcProject: null, source: 'Documents API' });
    shared.created.push(model.id);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn, ms, label) => { const t0 = performance.now(); for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(50); } };
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 5000, 'the model in store');
      shell.activate('hantera');
      shell.store.set({ selectedId: model.id });
      const card = await waitFor(() => root.querySelector('[data-card="validation"]'), 8000, 'the card');
      /** @type {any} */ (card.querySelector('[data-validation-fetch]')).click();
      await waitFor(() => card.querySelector(`[data-validation-status="${summary.status}"]`), 15000, 'the status on the card');
      const reportButton = card.querySelector('[data-validation-report]');
      if (reportButton) {
        /** @type {any} */ (reportButton).click();
        await waitFor(() => card.querySelector('[data-validation-issues]'), 15000, 'the findings on the card');
        assert.equal(card.querySelectorAll('[data-validation-checks] > li').length, checks.length, 'one line per check');
        if (ids && s) {
          const specs = await waitFor(() => card.querySelector('[data-validation-ids-specs]'), 5000, 'the IDS specifications on the card');
          assert.ok(specs.textContent.includes(t('validation.ids.summary', { n: String(s.total), docs: String(s.documents), passed: String(s.passed), failed: String(s.failed), na: String(s.notApplicable) })), specs.textContent);
          assert.equal(specs.querySelectorAll('[data-validation-spec]').length, s.failed, 'the failed specifications by name');
          log('card: ' + specs.textContent);
        }
      }
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return `${summary.status}, ${checks.length} checks` + (s ? `, IDS ${s.passed}/${s.total} passed` : '');
  }, 120000);

  test('opencde live: cleanup', async (assert) => {
    for (const tp of [shared.topic, shared.other]) if (tp) await opencde.api(shared.connector, `${BCF}/projects/${shared.projectId}/topics/${tp.guid}`, { method: 'DELETE' }).catch((e) => log('delete topic: ' + e.message));
    const left = await opencde.fetchTopics(shared.connector, shared.projectId);
    log(`topics left in the project: ${left.rows.length}`);
    await opencde.logout(shared.connector);
    for (const id of shared.dashboards || []) {
      const dash = await D.require('viz/dashboards').get(id).catch(() => null);
      for (const it of (dash && dash.items) || []) await D.require('viz/charts').remove(it.chartId).catch(() => {});
      await D.require('viz/dashboards').remove(id).catch(() => {});
    }
    if (shared.graphConnector) await connectors.remove(shared.graphConnector.id).catch(() => {});
    for (const id of shared.created) await datasets.remove(id).catch(() => {});
    if (shared.connector) await connectors.remove(shared.connector.id);
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
