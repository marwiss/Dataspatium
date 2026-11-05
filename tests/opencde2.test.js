// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Kontroll I against a mocked OpenCDE server (virtual providers, no network): the project's files and what the user
 * may do, a model fetched from the CDE that remembers its origin, the version check in Hantera, the issues panel in the model
 * view, and a table of issues as a facet with code and charts to start from.
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
  const runner = D.require('api/runner');
  const facets = D.require('data/facets');
  const starters = D.require('analysis/starters');
  const suggest = D.require('viz/suggest');
  const fixtures = D.require('tests/fixtures/ifc');
  const BASE = 'dataspatium-asset://tests/opencde2';
  const PROJECT = '0f3c9d6a-5b1e-4c7a-9d2b-8e1f2a3b4c5d';
  const TOPICS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const VP = '33333333-3333-4333-8333-333333333333';
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
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  /** What the mocked server knows; the walls are filled in once the model is imported, so the components can point at them. */
  const world = { walls: [], tokens: 0, snapshot: null };
  function png() {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30;
    const g = canvas.getContext('2d'); g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, 40, 30);
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  const text = (data) => ({ kind: 'text', data });
  const topic = (guid, title, status, type, who, when) => ({ guid, server_assigned_id: 'K-' + guid.slice(0, 1), title, topic_status: status, topic_type: type, assigned_to: who, creation_author: 'officer', creation_date: when, labels: [] });
  D.net.virtual('tests/opencde2/', (url) => {
    const u = new URL(url);
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : u.pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', oauth2_pkce_required: true }));
    if (path === '/foundation/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'a' + world.tokens, refresh_token: 'r' + world.tokens, expires_in: 3600, token_type: 'bearer' })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve(text(''));
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'officer', name: 'Handläggaren' }));
    if (path === '/bcf/3.0/projects') return Promise.resolve(json([{ project_id: PROJECT, name: 'Bygglovet' }]));
    if (path === `/bcf/3.0/projects/${PROJECT}`) return Promise.resolve(json({ project_id: PROJECT, name: 'Bygglovet', authorization: { project_actions: ['createTopic', 'createDocument'] } }));
    if (path === `/bcf/3.0/projects/${PROJECT}/extensions`) return Promise.resolve(json({ topic_type: ['Issue'], topic_status: ['Open', 'Closed'], topic_label: [], priority: [], users: ['officer'], project_actions: ['createTopic', 'createDocument'], topic_actions: ['update'], comment_actions: ['update'] }));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics`) {
      if (u.searchParams.get('$skip') && u.searchParams.get('$skip') !== '0') return Promise.resolve(json([]));
      return Promise.resolve(json([topic(TOPICS[0], 'Väggarna avviker från schemat', 'Open', 'Issue', 'developer', '2026-11-05T08:00:00Z'), topic(TOPICS[1], 'Ärende utan vy', 'Closed', 'Issue', 'officer', '2026-11-04T08:00:00Z')]));
    }
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[0]}/viewpoints`) return Promise.resolve(json([{ guid: VP, snapshot: { snapshot_type: 'png' } }]));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[1]}/viewpoints`) return Promise.resolve(json([]));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[0]}/viewpoints/${VP}/selection`) return Promise.resolve(json({ selection: world.walls.slice(0, 2).map((g) => ({ ifc_guid: g })) }));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[0]}/viewpoints/${VP}/coloring`) return Promise.resolve(json({ coloring: [{ color: 'FF0000', components: [{ ifc_guid: world.walls[2] || 'none' }, { ifc_guid: 'not-in-this-model-00000' }] }] }));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[0]}/viewpoints/${VP}/snapshot`) return Promise.resolve({ kind: 'binary', data: world.snapshot || (world.snapshot = png()) });
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[0]}/comments`) return Promise.resolve(json([{ guid: 'c1', topic_guid: TOPICS[0], date: '2026-11-05T09:00:00Z', author: 'developer', comment: 'Vi byter väggtyp.' }]));
    if (path === `/bcf/3.0/projects/${PROJECT}/topics/${TOPICS[1]}/comments`) return Promise.resolve(json([]));
    if (path === `/bcf/3.0/projects/${PROJECT}/files_information`) {
      return Promise.resolve(json([
        { display_information: [{ field_display_name: 'File name', field_value: 'testhus.ifc' }, { field_display_name: 'Source', field_value: 'BCF documents' }], file: { filename: 'testhus.ifc', ifc_project: '0Dataspatium0000000001', date: '2026-11-05T07:00:00Z', reference: BASE + '/bcf/3.0/projects/' + PROJECT + '/documents/d-ifc' } },
        { display_information: [{ field_display_name: 'File name', field_value: 'tabell.csv' }, { field_display_name: 'Source', field_value: 'Documents API' }], file: { filename: 'tabell.csv', ifc_project: null, date: '2026-11-05T07:30:00Z', reference: BASE + '/documents/1.0/documents/doc-1/versions/1/download' } },
      ]));
    }
    if (path === `/bcf/3.0/projects/${PROJECT}/documents/d-ifc`) return Promise.resolve(text(fixtures.ifcText({ walls: 3 })));
    if (path === '/documents/1.0/documents/doc-1/versions/1/download') return Promise.resolve(text('kommun;antal\nUmeå;130\nLuleå;77\n'));
    if (path === '/documents/1.0/documents/doc-1/versions/2/download') return Promise.resolve(text('kommun;antal\nUmeå;131\nLuleå;78\nKiruna;23\n'));
    if (path === '/documents/1.0/document-versions') return Promise.resolve(json({ versions: [{ document_id: 'doc-1', version_index: 2, version_number: '2', title: 'Tabell', file_description: { name: 'tabell.csv' }, links: { document_version_download: { url: BASE + '/documents/1.0/documents/doc-1/versions/2/download' } } }] }));
    return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null; let model = null; let table = null;

  test('opencde II: the project files, what the user may do, and a model that remembers its CDE', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-2', clientSecret: '' })).connector;
    assert.ok(connector.auth.authUrl, 'the dialog learned where to sign in');
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const rights = await opencde.rights(connector, PROJECT);
    assert.deepEqual(rights.project, ['createTopic', 'createDocument']);
    const files = await opencde.filesList(connector, PROJECT);
    assert.deepEqual(files.map((f) => [f.filename, f.model, f.documentId, f.versionIndex, f.source]), [['testhus.ifc', true, null, null, 'BCF documents'], ['tabell.csv', false, 'doc-1', 1, 'Documents API']]);
    model = await opencde.importFile(connector, { project_id: PROJECT, name: 'Bygglovet' }, files[0]);
    created.push(model.id);
    assert.equal(model.kind, 'model');
    assert.equal(model.source.fileName, 'testhus.ifc');
    assert.equal(model.source.cde.projectName, 'Bygglovet');
    assert.equal(model.source.cde.kind, 'bcf-document');
    assert.equal(model.source.cde.connectorId, connector.id);
    const cols = await datasets.columns(model.id);
    const g = cols.findIndex((c) => c.name === 'guid'); const typ = cols.findIndex((c) => c.name === 'typ');
    world.walls = (await datasets.query(model.id, {})).filter((r) => /wall/i.test(String(r[typ]))).map((r) => String(r[g]));
    assert.ok(world.walls.length >= 3, 'walls in the model: ' + world.walls.length);
    table = await opencde.importFile(connector, { project_id: PROJECT, name: 'Bygglovet' }, files[1]);
    created.push(table.id);
    assert.equal(table.kind, 'table');
    assert.equal(table.rowCount, 2);
    assert.equal(table.source.cde.documentId, 'doc-1');
    assert.equal(table.source.cde.versionIndex, 1);
    return `${files.length} files`;
  }, 60000);

  test('opencde II: Hantera says that the server has a newer version, and fetches it beside the old one', async (assert) => {
    const check = await opencde.newerVersion(connector, table);
    assert.ok(check.newer && check.version.version_index === 2, JSON.stringify(check));
    assert.equal((await opencde.newerVersion(connector, model)).newer, false, 'a BCF document has no versions');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === table.id), 3000, 'dataset');
      shell.activate('hantera');
      shell.store.set({ selectedId: table.id });
      const card = await waitFor(() => root.querySelector('[data-card="cde"]'), 5000, 'the card');
      assert.ok(card.textContent.includes('Bygglovet') && card.textContent.includes(t('cde.kind.document')), card.textContent);
      card.querySelector('[data-cde-check]').click();
      const newer = await waitFor(() => root.querySelector('[data-cde-newer]'), 5000, 'the newer version');
      assert.ok(newer.textContent.includes('2'), newer.textContent);
      buttonIn(newer, t('cde.fetch.version', { n: '2' })).click();
      // The import selects the new dataset first; its source gets the CDE facts right after.
      const fresh = await waitFor(async () => { const s = shell.store.get().selectedId; if (!s || s === table.id) return null; const m = await datasets.get(s); return m && m.source && m.source.cde ? m : null; }, 8000, 'the new dataset opens with its source');
      const id = fresh.id;
      created.push(id);
      assert.ok(fresh.name.endsWith('(v2)'), fresh.name);
      assert.equal(fresh.rowCount, 3);
      assert.equal(fresh.source.cde.versionIndex, 2);
      assert.ok(await datasets.get(table.id), 'the old one stays');
      shell.store.set({ selectedId: id });
      await waitFor(() => root.querySelector('[data-card="cde"]'), 5000, 'the card again');
      root.querySelector('[data-cde-check]').click();
      await waitFor(() => root.querySelector('[data-cde-current]'), 5000, 'now current');
    });
    return 'ok';
  }, 60000);

  test('opencde II: the model view lists the issues that point at the model and marks their elements', async (assert) => {
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 3000, 'dataset');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: model.id });
      const toggle = await waitFor(() => root.querySelector('[data-model-issues-toggle]'), 8000, 'the button');
      toggle.click();
      const panel = await waitFor(() => root.querySelector('[data-model-issues]'), 5000, 'the panel');
      const items = await waitFor(() => { const list = panel.querySelectorAll('[data-issue]'); return list.length === 2 ? list : null; }, 8000, 'two issues');
      assert.ok(items[0].textContent.includes('Väggarna avviker'), 'the issue that points at the model comes first: ' + items[0].textContent);
      assert.ok(items[0].textContent.includes(t('issues.elements.n', { n: '3' })), items[0].textContent);
      assert.ok(panel.textContent.includes(t('issues.summary', { n: '2', model: '1' })), panel.textContent);
      items[0].click();
      const detail = await waitFor(() => panel.querySelector('[data-issue-detail]'), 5000, 'the detail');
      await waitFor(() => detail.textContent.includes('Vi byter väggtyp') || panel.querySelector('[data-issue-detail] img'), 5000, 'comments and snapshot');
      await waitFor(() => panel.querySelector('[data-issue-detail] img'), 5000, 'the snapshot');
      assert.ok(root.querySelector('[data-issue][aria-current="true"]'), 'chosen');
      // From Hantera, the card opens the model with the panel.
      shell.activate('hantera');
      await waitFor(() => root.querySelector('[data-card="cde"]'), 5000, 'the card');
      buttonIn(root.querySelector('[data-card="cde"]'), t('issues.title')).click();
      await waitFor(() => shell.store.get().mode === 'bearbeta' && root.querySelector('[data-model-issues]'), 8000, 'the panel opens from Hantera');
    });
    return 'ok';
  }, 60000);

  test('opencde II: a table of issues is a facet with code and charts to start from', async (assert) => {
    const topics = await opencde.fetchTopics(connector, PROJECT);
    const meta = await runner.toDataset({ columns: topics.columns, rows: topics.rows, meta: {} }, { name: 'Bygglovet: ärenden', source: { kind: 'api', connectorId: connector.id, connectorName: connector.name, family: 'opencde', opencde: { kind: 'topics', projectId: PROJECT } } });
    created.push(meta.id);
    const found = await facets.detect(meta.id);
    const bcf = found.find((f) => f.id === 'bcf');
    assert.ok(bcf && bcf.on && bcf.reason === 'facets.reason.bcf', JSON.stringify(found));
    const pieces = await starters.forDataset(await datasets.get(meta.id), 'sql');
    const keys = pieces.map((p) => p.key);
    assert.ok(keys.includes('starter.bcf.status') && keys.includes('starter.bcf.assigned') && keys.includes('starter.bcf.months'), keys.join(', '));
    for (const p of pieces.filter((x) => x.key.startsWith('starter.bcf'))) {
      const r = await D.require('data/query').select(meta.id, p.code, { limit: 50 });
      assert.ok(r.values.length >= 1, p.key);
    }
    for (const lang of ['r', 'python']) assert.ok((await starters.forDataset(await datasets.get(meta.id), lang)).some((p) => p.key === 'starter.bcf.status'), lang);
    const ideas = await suggest.forDataset(await datasets.get(meta.id));
    const names = ideas.map((i) => i.key);
    assert.ok(names.includes('viz.suggest.bcf.topic_status') && names.includes('viz.suggest.bcf.assigned_to'), names.join(', '));
    const plain = await datasets.create({ name: 'Inte ärenden', columns: [{ name: 'guid', type: 'text' }, { name: 'title', type: 'text' }], rows: [['a', 'b']] });
    created.push(plain.id);
    assert.ok(!(await facets.detect(plain.id)).some((f) => f.id === 'bcf'), 'two of the columns are not enough');
    return keys.length + ' pieces';
  }, 60000);

  test('opencde II: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
