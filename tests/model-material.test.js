// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the material behind a model (F43 b, step 5) against a mocked Dataregium (a virtual provider and a spy on api/http, no
 * network): the brief and two pictures go up as project documents with their names, media types and bytes, the topic Underlag gets a
 * document reference to each of them and to the model, the size limit refuses before anything goes up, a picture the server refuses
 * is skipped while the rest goes on, and the brief's failure or an abort ends the call without a topic.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const material = D.require('data/model-material');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const http = D.require('api/http');
  const BASE = 'dataspatium-asset://tests/model-material';
  const PROJECT = 'p-1';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  /** Every request, so that the virtual server can read the method, the headers and the body of the one it answers. */
  const spy = { requests: [] };
  const realRequest = http.request;
  http.request = (req) => { spy.requests.push(req); return realRequest(req); };
  const last = () => spy.requests[spy.requests.length - 1] || {};
  const world = { documents: [], topics: [], references: [], refuse: '' };
  const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
  const bytes = (n, seed) => { const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 255; return out; };
  D.net.virtual('tests/model-material/', (url) => {
    const path = (url.startsWith(BASE) ? url.slice(BASE.length) : new URL(url).pathname).split('?')[0];
    const req = last(); const method = String(req.method || 'GET').toUpperCase(); const headers = req.headers || {};
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
    if (path === `/bcf/3.0/projects/${PROJECT}/documents` && method === 'POST') {
      const disposition = String(headers['Content-Disposition'] || '');
      const name = decodeURIComponent((/filename\*=UTF-8''([^;]+)/.exec(disposition) || [])[1] || (/filename="([^"]*)"/.exec(disposition) || [])[1] || 'document');
      if (name === world.refuse) return Promise.resolve(json({ message: 'Storage full' }, 507));
      const doc = { guid: `d-${world.documents.length + 1}`, filename: name, contentType: String(headers['Content-Type'] || ''), bytes: req.body instanceof ArrayBuffer ? new Uint8Array(req.body) : new Uint8Array(0) };
      world.documents.push(doc);
      return Promise.resolve(json({ guid: doc.guid, filename: name }, 201));
    }
    if (path === `/bcf/3.0/projects/${PROJECT}/topics` && method === 'POST') {
      const topic = Object.assign({ guid: `t-${world.topics.length + 1}` }, JSON.parse(String(req.body || '{}')));
      world.topics.push(topic);
      return Promise.resolve(json(topic, 201));
    }
    const m = /^\/bcf\/3\.0\/projects\/p-1\/topics\/([^/]+)\/document_references$/.exec(path);
    if (m && method === 'POST') {
      const ref = Object.assign({ guid: `r-${world.references.length + 1}`, topic: m[1] }, JSON.parse(String(req.body || '{}')));
      world.references.push(ref);
      return Promise.resolve(json(ref, 201));
    }
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  let connector = null;
  const pictures = () => [
    { name: 'entre.jpg', mediaType: 'image/jpeg', data: toB64(bytes(1000, 1)), label: 'Entrén mot söder', when: '2026-11-10T14:02:00+01:00', where: { lat: 59.334, lon: 18.0632, alt: 12 } },
    { name: 'plan 1.png', mediaType: 'image/png', data: toB64(bytes(777, 2)) },
  ];

  test('model material: the brief and the pictures go up as project documents, and the topic Underlag refers to each of them and to the model', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    const statuses = [];
    const out = await material.upload(connector, PROJECT, 'doc-9', { brief: 'Ett tvåvåningshus 12 × 8 m\nmed sadeltak.', attachments: pictures(), name: 'Villa Ek' }, { onStatus: (s) => statuses.push(s) });
    assert.deepEqual(world.documents.map((d) => [d.filename, d.contentType, d.bytes.length]), [['brief-Villa Ek.md', 'text/markdown', world.documents[0].bytes.length], ['entre.jpg', 'image/jpeg', 1000], ['plan 1.png', 'image/png', 777]], 'three documents with their names, media types and sizes');
    assert.deepEqual(Array.from(world.documents[1].bytes.slice(0, 5)), Array.from(bytes(1000, 1).slice(0, 5)), 'the picture\'s own bytes');
    const md = new TextDecoder().decode(world.documents[0].bytes);
    assert.ok(md.startsWith(`# ${t('material.brief.name')}: Villa Ek\n\nEtt tvåvåningshus 12 × 8 m\nmed sadeltak.\n`), 'the brief as written, under its heading: ' + md);
    assert.ok(md.includes(`## ${t('material.pictures')}\n`) && md.includes('\n- entre.jpg (Entrén mot söder, 2026-11-10T14:02:00+01:00, 59.33400, 18.06320, 12 m)\n') && md.endsWith('\n- plan 1.png\n'), 'one line per picture, with label, time and position when given: ' + md);
    assert.equal(world.topics.length, 1, 'one topic');
    assert.equal(world.topics[0].title, t('material.topic.title'));
    assert.ok(world.topics[0].description.startsWith(t('material.topic.description', { n: 2 })) && world.topics[0].description.includes('\n- brief-Villa Ek.md\n') && world.topics[0].description.endsWith('\n- plan 1.png'), 'the description lists what went up: ' + world.topics[0].description);
    assert.deepEqual(world.references.map((r) => [r.topic, r.document_guid, r.description]), [['t-1', 'd-1', t('material.brief.name')], ['t-1', 'd-2', 'Entrén mot söder'], ['t-1', 'd-3', 'plan 1.png'], ['t-1', 'doc-9', 'Villa Ek']], 'a document reference per document, and one to the model');
    assert.deepEqual(out, { topic: { guid: 't-1', title: t('material.topic.title') }, documents: [{ id: 'd-1', name: 'brief-Villa Ek.md' }, { id: 'd-2', name: 'entre.jpg' }, { id: 'd-3', name: 'plan 1.png' }], skipped: [] }, 'the answer');
    assert.deepEqual(statuses, [t('material.status.upload', { name: 'brief-Villa Ek.md' }), t('material.status.upload', { name: 'entre.jpg' }), t('material.status.upload', { name: 'plan 1.png' }), t('material.status.topic')], 'the progress told');
    assert.equal(material.summary(connector, out), t('material.done', { server: opencde.hostOf(BASE), title: t('material.topic.title'), n: 3 }));
    return 'ok';
  }, 20000);

  test('model material: the size is counted without decoding, and more than 64 MB is refused before anything goes up', async (assert) => {
    assert.deepEqual([btoa(''), btoa('a'), btoa('ab'), btoa('abc'), 'YQ', 'data:image/png;base64,YWJj'].map(material.bytesOfBase64), [0, 1, 2, 3, 1, 3], 'padded, unpadded and prefixed');
    assert.deepEqual(Array.from(material.fromBase64(btoa('hello'))), [104, 101, 108, 108, 111], 'decoded');
    assert.deepEqual(Array.from(material.fromBase64('data:text/plain;base64,YQ')), [97], 'a prefix and no padding are tolerated');
    const small = { brief: 'abc', attachments: [{ name: 'x.jpg', mediaType: 'image/jpeg', data: btoa('hello') }] };
    assert.equal(material.sizeOf(small), new TextEncoder().encode(material.briefText(small)).length + 5, 'the brief and the pictures together');
    assert.equal(material.briefName({ brief: 'x', name: 'Hus: A/B' }), 'brief-Hus_ A_B.md', 'path characters leave the file name');
    assert.equal(material.briefName({ brief: 'x' }), 'brief-modell.md', 'a model without a name');
    // Eleven pictures that share one 8 M character text: 66 MB, far too much, without 66 MB of memory in the test.
    const chunk = 'A'.repeat(8 * 1024 * 1024);
    const big = { brief: 'x', attachments: Array.from({ length: 11 }, (_, i) => ({ name: `stor-${i}.jpg`, mediaType: 'image/jpeg', data: chunk })) };
    assert.ok(material.sizeOf(big) > material.MAX_BYTES && material.MAX_BYTES === 64 * 1024 * 1024, 'over the limit');
    const before = world.documents.length;
    const err = await material.upload(connector, PROJECT, null, big).catch((e) => e);
    assert.ok(err instanceof Error && err.message === t('material.err.size'), 'refused in the person\'s words: ' + (err && err.message));
    assert.equal(world.documents.length, before, 'nothing went up');
    return 'ok';
  }, 20000);

  test('model material: a picture the server refuses is skipped while the rest goes on; the brief\'s failure and an abort end the call without a topic', async (assert) => {
    world.documents = []; world.topics = []; world.references = []; world.refuse = 'entre.jpg';
    const out = await material.upload(connector, PROJECT, null, { brief: 'Bara text', attachments: pictures() });
    assert.deepEqual(out.skipped, ['entre.jpg'], 'the refused picture is skipped');
    assert.deepEqual(out.documents.map((d) => d.name), ['brief-modell.md', 'plan 1.png'], 'the brief of a model without a name, and the other picture');
    assert.deepEqual(world.references.map((r) => r.document_guid), ['d-1', 'd-2'], 'references only to what went up, and none to a model that is not on the server');
    assert.ok(world.topics.length === 1 && world.topics[0].description.startsWith(t('material.topic.description', { n: 1 })), 'one picture in the description: ' + world.topics[0].description);
    world.refuse = 'brief-modell.md';
    const err = await material.upload(connector, PROJECT, null, { brief: 'Bara text', attachments: pictures() }).catch((e) => e);
    assert.ok(err instanceof Error && err.status === 507, 'the brief\'s failure is the call\'s: ' + (err && err.message));
    assert.equal(world.topics.length, 1, 'no topic without the brief');
    world.refuse = '';
    const abort = new AbortController();
    const aborted = await material.upload(connector, PROJECT, null, { brief: 'x', attachments: pictures() }, { signal: abort.signal, onStatus: (s) => { if (s === t('material.status.upload', { name: 'entre.jpg' })) abort.abort(); } }).catch((e) => e);
    assert.ok(aborted instanceof Error && aborted.kind === 'aborted', 'an abort ends the call: ' + (aborted && aborted.message));
    assert.equal(world.topics.length, 1, 'no topic after an abort');
    return 'ok';
  }, 20000);

  test('model material: cleanup', async () => {
    http.request = realRequest;
    D.net.unvirtual('tests/model-material/');
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    return 'ok';
  });
})();
