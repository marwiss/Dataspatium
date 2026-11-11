// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Kontrollera med AI (decision F44 a): record_finding checks each call and resolves the photo and the element, a check writes
 * only Pset_Condition, the agent in check mode records findings and sets the condition through set_properties while create_wall is
 * refused, the panel in the mode Kontrollera lists the findings and saves them as a table and as a BCF file read back with bcf-xml (the
 * photos without their EXIF), and Skapa ärenden på servern creates one topic per finding with a viewpoint on a virtual Dataregium.
 * Mocked provider, no network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fixtures = D.require('tests/fixtures/ifc');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const providers = D.require('ai/providers');
  const agent = D.require('ai/agent');
  const writeTools = D.require('ai/write-tools');
  const checkTools = D.require('ai/check-tools');
  const bcfXml = D.require('data/bcf-xml');
  const http = D.require('api/http');
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const platformFiles = D.require('platform/files');
  const BASE = 'dataspatium-asset://tests/ai-check';
  const CDE = 'dataspatium-asset://tests/ai-check-cde';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data, status = 200) => ({ kind: 'text', data: JSON.stringify(data), status });
  const world = { calls: 0, script: [], bodies: [] };
  /** One assistant turn with several tool calls. */
  const uses = (...calls) => ({ id: 'm' + world.calls, content: calls.map(([name, input], i) => ({ type: 'tool_use', id: `tu${world.calls}-${i}`, name, input })), stop_reason: 'tool_use', usage: { input_tokens: 80, output_tokens: 30 } });
  const words = (text) => ({ id: 'm' + world.calls, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 80, output_tokens: 30 } });
  const PIXEL = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const SOUTH = { name: 'sydfasad.jpg', label: 'south', mediaType: 'image/jpeg', data: PIXEL, where: { lat: 59.3293, lon: 18.0686, alt: 25 }, when: '2026-05-03T10:15:00' };
  const CORNER = { name: 'hörn.jpg', label: 'photo', mediaType: 'image/jpeg', data: PIXEL };
  /** The requests the virtual servers were sent, with their bodies; the virtual handlers themselves only see addresses. */
  const sent = [];
  const cde = { topics: 0, failTopic: 0 };
  let realRequest = null; let ds = null; let anthropic = null; let connector = null; let walls = []; const made = [];
  D.net.virtual('tests/ai-check/', async (url) => {
    if (!String(url).endsWith('/v1/messages')) return json({ error: { message: 'no such path' } }, 404);
    const next = world.script[world.calls] || words('Klart.');
    world.calls++;
    return json(typeof next === 'function' ? next() : next);
  });
  /** A virtual Dataregium with a project p-1 whose extensions name the priorities and the topic types; a topic can be made to fail. */
  D.net.virtual('tests/ai-check-cde/', (url) => {
    const path = (url.startsWith(CDE) ? url.slice(CDE.length) : new URL(url).pathname).split('?')[0];
    if (path === '/.well-known/dataregium') return Promise.resolve(json({ server: { name: 'Dataregium', version: '3.0.0' }, apis: { foundation: '1.0', bcf: '3.0', documents: '1.0' }, extensions: {} }));
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: CDE + '/foundation/oauth2/auth', oauth2_token_url: CDE + '/foundation/oauth2/token' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'granskare', name: 'Granskare' }));
    if (path === '/bcf/3.0/projects/p-1/extensions') return Promise.resolve(json({ topic_type: ['Issue', 'Request', 'Inspection'], topic_status: ['Open', 'Closed'], priority: ['Low', 'Medium', 'High', 'Critical'] }));
    if (path === '/bcf/3.0/projects/p-1/topics') {
      cde.topics++;
      if (cde.topics === cde.failTopic) return Promise.resolve(json({ message: 'priority is not one of the project\'s values' }, 400));
      return Promise.resolve(json({ guid: 't-' + cde.topics, title: 'x' }, 201));
    }
    const vp = /^\/bcf\/3\.0\/projects\/p-1\/topics\/(t-\d+)\/viewpoints$/.exec(path);
    if (vp) return Promise.resolve(json({ guid: 'vp-' + vp[1] }, 201));
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const bodiesTo = (suffix) => sent.filter((r) => r.url.startsWith(CDE) && r.url.split('?')[0].endsWith(suffix) && r.method === 'POST').map((r) => JSON.parse(r.body));
  const condition = (id, value, text) => ['set_properties', { ids: [id], pset: 'Pset_Condition', properties: [{ name: 'AssessmentDate', value: checkTools.today() }, { name: 'AssessmentCondition', value }, { name: 'AssessmentDescription', value: text }] }];
  const crack = () => ({ photo: 1, element_id: walls[0].id, title: 'Spricka i putsen', description: 'En spricka från sockeln upp mot fönstret.', condition: 'poor', priority: 'high', action: 'Laga putsen före vintern' });
  const damp = (photo) => ({ photo, element_id: walls[1].guid, title: 'Fuktfläck', description: 'Mörk fläck vid hörnet.', condition: 'fair', priority: 'medium', action: null });

  test('ai check: record_finding checks each call and resolves the photo and the element, and a check writes only Pset_Condition', async (assert) => {
    realRequest = http.request;
    http.request = (req) => { const u = String(req.url); if ((u.startsWith(BASE) || u.startsWith(CDE)) && req.body !== undefined) sent.push({ url: u, method: String(req.method || 'GET'), body: String(req.body) }); return realRequest(req); };
    ds = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Kontrollhus');
    const engine = (await datasets.ensureOpen(ds.id)).engine;
    const r = await engine.exec("select id, guid, typ, namn from data where namn in ('Vägg 1.1', 'Vägg 1.2') order by namn");
    walls = r[0].values.map(([id, guid, typ, namn]) => ({ id: Number(id), guid: String(guid), typ: String(typ), name: String(namn) }));
    assert.equal(walls.length, 2, 'two walls in the fixture');
    const c = checkTools.create(ds.id);
    assert.deepEqual(await checkTools.call(c, crack(), { photos: [SOUTH] }), { recorded: 1 });
    const f = c.findings[0];
    assert.ok(f.elementId === walls[0].id && f.elementGuid === walls[0].guid && f.elementClass === walls[0].typ && f.elementName === 'Vägg 1.1', JSON.stringify({ id: f.elementId, guid: f.elementGuid, cls: f.elementClass }));
    assert.ok(f.photoName === 'sydfasad.jpg' && f.date === '2026-05-03' && f.lat === 59.3293 && f.lon === 18.0686 && f.picture && f.picture.data === PIXEL, JSON.stringify({ photo: f.photoName, date: f.date, lat: f.lat }));
    assert.deepEqual(await checkTools.call(c, damp(null), { photos: [SOUTH] }), { recorded: 2 }, 'by guid, without a photo');
    assert.ok(c.findings[1].elementId === walls[1].id && c.findings[1].photoName === null && c.findings[1].date === checkTools.today());
    const errors = [
      [Object.assign(crack(), { condition: 'bad' }), 'condition'], [Object.assign(crack(), { priority: 'soon' }), 'priority'], [Object.assign(crack(), { title: ' ' }), 'title'],
      [Object.assign(crack(), { photo: 2 }), 'photo'], [Object.assign(crack(), { element_id: 999999 }), 'no element'], [Object.assign(crack(), { element_id: 'inte-en-guid' }), 'no element'],
    ];
    for (const [args, why] of errors) { const got = await checkTools.call(c, args, { photos: [SOUTH] }); assert.ok(got.error && got.error.includes(why), why + ': ' + JSON.stringify(got)); }
    const alone = await checkTools.call(c, crack(), {});
    assert.ok(alone.error && alone.error.includes('no picture'), 'a photo number without pictures: ' + alone.error);
    assert.equal(c.findings.length, 2, 'refused calls record nothing');
    assert.ok(checkTools.describe(f).includes('Spricka i putsen') && checkTools.describe(f).includes(t('ai.check.condition.poor')) && checkTools.describe(f).includes('sydfasad.jpg'), checkTools.describe(f));
    // The only write of a check.
    const cs = writeTools.create(ds.id);
    assert.ok(checkTools.write(cs, 'create_wall', { storey: null, start: [0, 0], end: [4, 0] }).error.includes('not offered'));
    assert.ok(checkTools.write(cs, 'set_properties', { ids: [walls[0].id], pset: 'Pset_WallCommon', properties: [{ name: 'IsExternal', value: true }] }).error.includes('Pset_Condition'));
    assert.ok(checkTools.write(cs, 'set_properties', { ids: [walls[0].id], pset: 'Pset_Condition', properties: [{ name: 'Colour', value: 'red' }] }).error.includes('AssessmentCondition'));
    assert.ok(checkTools.write(cs, 'set_properties', { ids: [walls[0].id], pset: 'pset_condition', properties: [{ name: 'assessmentcondition', value: 'poor' }] }).ok);
    assert.deepEqual(cs.ops, [{ tool: 'set_properties', ids: [walls[0].id], pset: 'Pset_Condition', properties: { AssessmentCondition: 'poor' } }], 'the names as IFC has them');
    const schema = checkTools.TOOLS[0];
    assert.ok(schema.name === 'record_finding' && ['photo', 'element_id', 'title', 'description', 'condition', 'priority', 'action'].every((k) => k in schema.parameters.properties), 'the schema');
    assert.deepEqual(schema.parameters.properties.condition.enum, ['good', 'fair', 'poor', 'critical']);
    assert.deepEqual(schema.parameters.properties.priority.enum, ['low', 'medium', 'high', 'urgent']);
    return 'ok';
  }, 20000);

  test('ai check: in check mode the agent records the findings and sets Pset_Condition through set_properties, and create_wall is refused', async (assert) => {
    anthropic = await providers.save({ id: 'ai-check-anthropic', kind: 'anthropic', name: 'Mock check', baseUrl: BASE + '/a/', model: 'claude-test' });
    providers.setKey(anthropic.id, 'sk-test-check');
    await providers.setPolicy('ask');
    world.calls = 0; world.script = [
      () => uses(['get_model_overview', {}]),
      () => uses(['query_elements', { ifc_class: walls[0].typ, storey: null, name_contains: null, property_set: null, property_name: null, property_value: null, missing_property: null, limit: null }]),
      () => uses(['record_finding', crack()], ['record_finding', damp(2)], condition(walls[0].id, 'poor', 'Spricka i putsen'), condition(walls[1].id, 'fair', 'Fuktfläck'),
        ['create_wall', { storey: null, start: [0, 0], end: [4, 0], thickness: 0.2, height: 3, name: 'Ny vägg' }]),
      () => words('Två fynd. Hög prioritet: spricka i putsen. Medel: fuktfläck.'),
    ];
    sent.length = 0;
    const cs = writeTools.create(ds.id);
    const findings = checkTools.create(ds.id);
    const images = [Object.assign({ caption: 'Bild 1: Fasad mot söder, sydfasad.jpg' }, SOUTH), Object.assign({ caption: 'Bild 2: Foto, hörn.jpg' }, CORNER)];
    const out = await agent.ask({ provider: anthropic, datasetId: ds.id, question: 'Kontrollera fasaderna mot fotona', changeset: cs, check: true, findings, images });
    assert.equal(out.stopped, 'answered');
    assert.ok(out.findings === findings && findings.findings.length === 2, 'two findings in the panel\'s list');
    assert.ok(findings.findings[0].photoName === 'sydfasad.jpg' && findings.findings[1].photoName === 'hörn.jpg' && findings.findings[1].elementId === walls[1].id, 'photos and elements resolved');
    assert.deepEqual(cs.ops.map((op) => [op.tool, op.pset, op.properties.AssessmentCondition]), [['set_properties', 'Pset_Condition', 'poor'], ['set_properties', 'Pset_Condition', 'fair']]);
    const refused = out.steps.find((s) => s.name === 'create_wall');
    assert.ok(refused && refused.error && refused.error.includes('not offered'), 'create_wall refused: ' + (refused && refused.error));
    assert.ok(/Hög prioritet/.test(out.answer), out.answer);
    const bodies = sent.filter((x) => x.url.startsWith(BASE)).map((x) => JSON.parse(x.body));
    const first = bodies[0];
    assert.ok(first.system.includes('record_finding') && first.system.includes('Pset_Condition') && first.system.endsWith(`Today is ${checkTools.today()}.`), 'the check\'s system text with today');
    const names = first.tools.map((x) => x.name);
    assert.ok(['record_finding', 'set_properties', 'preview_changeset', 'get_element', 'query_elements'].every((n) => names.includes(n)), names.join(', '));
    assert.ok(['create_wall', 'create_slab', 'create_opening', 'delete_elements', 'set_site', 'assign', 'transform_elements', 'manage_changeset', 'create_storeys_and_grid'].every((n) => !names.includes(n)), 'no other write tools: ' + names.join(', '));
    const tool = first.tools.find((x) => x.name === 'record_finding');
    assert.ok(tool.input_schema.required.length === 7 && tool.input_schema.additionalProperties === false && tool.input_schema.properties.condition.enum.length === 4, 'the strict schema');
    assert.equal(first.max_tokens, 4000);
    const content = first.messages[0].content;
    assert.ok(Array.isArray(content) && content.length === 5 && content[1].text === 'Bild 1: Fasad mot söder, sydfasad.jpg' && content[2].type === 'image' && content[3].text === 'Bild 2: Foto, hörn.jpg', 'the captions before the pictures');
    const results = bodies[3].messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === 'tool_result');
    assert.ok(results.some((b) => String(b.content) === '[data from the model] {"recorded":1}') && results.some((b) => String(b.content) === '[data from the model] {"recorded":2}'), 'the numbers went back as data');
    // The budget of a check: 24 turns.
    world.calls = 0; world.script = Array.from({ length: 30 }, () => () => uses(['list_storeys', {}]));
    const long = await agent.ask({ provider: anthropic, datasetId: ds.id, question: 'Kontrollera', changeset: writeTools.create(ds.id), check: true });
    assert.ok(long.stopped === 'budget' && world.calls === 24 && long.findings && long.findings.findings.length === 0, `stopped ${long.stopped} after ${world.calls} turns`);
    return 'ok';
  }, 30000);

  test('ai check: the panel in the mode Kontrollera lists the findings, saves them as a table and exports them as BCF', async (assert) => {
    const bounds = (ids) => (ids.includes(walls[0].id) ? { min: [0, 0, 0], max: [4, 0.2, 2.5] } : null);
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'check', preview: () => {}, bounds });
    document.body.appendChild(panel.el);
    const realDownload = platformFiles.download;
    const downloads = [];
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      assert.equal(panel.state.mode, 'check');
      assert.equal(/** @type {any} */ (panel.el.querySelector('[data-ai-mode]')).value, 'check');
      assert.ok(panel.el.textContent.includes(t('ai.title.check')), 'the title');
      assert.equal(panel.el.querySelector('[data-ai-ask]').getAttribute('label'), t('ai.check.run'));
      assert.ok(panel.el.querySelector('[data-ai-attach]') && panel.el.querySelector('[data-ai-label]'), 'the attach row with labels, as in the build mode');
      assert.equal(panel.el.querySelector('[data-ai-check]').getAttribute('data-ai-check'), '0', 'the empty list');
      assert.ok(!panel.el.querySelector('[data-ai-check-server]'), 'no server button for a model from a file');
      panel.attach([SOUTH, CORNER]);
      assert.equal(panel.el.querySelector('[data-ai-attachments]').getAttribute('data-ai-attachments'), '2');
      panel.state.providerId = anthropic.id;
      world.calls = 0; world.script = [
        () => uses(['record_finding', crack()], ['record_finding', damp(2)], condition(walls[0].id, 'poor', 'Spricka i putsen')),
        () => words('Två fynd.'),
      ];
      sent.length = 0;
      await panel.ask('Kontrollera fasaderna');
      assert.equal(panel.state.error, '', 'no error');
      const rows = panel.el.querySelectorAll('[data-ai-check-finding]');
      assert.equal(rows.length, 2, 'one row per finding');
      const row = rows[0];
      assert.ok(row.getAttribute('data-ai-check-condition') === 'poor' && row.getAttribute('data-ai-check-priority') === 'high', 'the codes');
      const text = row.textContent;
      assert.ok(text.includes('Spricka i putsen') && text.includes(t('ai.check.badge.condition', { condition: t('ai.check.condition.poor') })) && text.includes(t('ai.check.badge.priority', { priority: t('ai.check.priority.high') })), text);
      assert.ok(text.includes('sydfasad.jpg') && text.includes('Vägg 1.1') && text.includes(t('ai.check.action', { action: 'Laga putsen före vintern' })), text);
      assert.equal(row.querySelectorAll('dm-badge').length, 2, 'condition and priority as badges');
      assert.ok(panel.el.querySelector('[data-ai-changeset]') && panel.state.changeset.ops.length === 1 && panel.el.querySelector('[data-ai-preview]'), 'the condition previewed and approved as in Ändra');
      const content = JSON.parse(sent.find((x) => x.url.startsWith(BASE)).body).messages[0].content;
      assert.ok(content[1].text.includes(t('ai.build.label.south')) && content[1].text.includes('59.32930, 18.06860') && content[2].type === 'image', content[1].text);
      // Spara fynden som tabell.
      const meta = await panel.check.save();
      assert.ok(meta && meta.name === t('ai.check.table.name', { name: 'Kontrollhus' }), meta && meta.name);
      made.push(meta.id);
      assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['foto', 'element_id', 'element_guid', 'titel', 'beskrivning', 'skick', 'prioritet', 'atgard', 'datum', 'lat', 'lon']);
      const saved = await datasets.query(meta.id);
      assert.deepEqual(saved[0], ['sydfasad.jpg', walls[0].id, walls[0].guid, 'Spricka i putsen', 'En spricka från sockeln upp mot fönstret.', 'poor', 'high', 'Laga putsen före vintern', '2026-05-03', 59.3293, 18.0686]);
      assert.deepEqual(saved[1], ['hörn.jpg', walls[1].id, walls[1].guid, 'Fuktfläck', 'Mörk fläck vid hörnet.', 'fair', 'medium', null, checkTools.today(), null, null]);
      const skick = (await datasets.columns(meta.id)).find((c) => c.name === 'skick');
      assert.ok(skick.valueLabels && skick.valueLabels.labels.some(([code, label]) => code === 'poor' && label === t('ai.check.condition.poor')), 'the words as value labels');
      assert.ok(panel.el.querySelector('[data-ai-check-saved]'), 'the line about the table');
      // Exportera som BCF.
      platformFiles.download = (blob, name) => { downloads.push({ blob, name }); };
      const blob = await panel.check.exportBcf();
      assert.ok(blob && downloads.length === 1 && /\.bcfzip$/.test(downloads[0].name), JSON.stringify(downloads.map((d) => d.name)));
      const read = await bcfXml.read(new Uint8Array(await downloads[0].blob.arrayBuffer()));
      assert.equal(read.version, '3.0');
      assert.equal(read.topics.length, 2, 'one topic per finding');
      const topic = read.topics.find((x) => x.title === 'Spricka i putsen');
      const other = read.topics.find((x) => x.title === 'Fuktfläck');
      assert.ok(topic && other && topic.priority === 'High' && other.priority === 'Medium' && topic.topic_type === 'Inspection', JSON.stringify(read.topics.map((x) => [x.title, x.priority, x.topic_type])));
      assert.ok(topic.description.includes('En spricka från sockeln') && topic.description.includes(t('ai.check.badge.condition', { condition: t('ai.check.condition.poor') })) && topic.description.includes(walls[0].guid), topic.description);
      const selected = (guid) => read.components.filter((x) => x.topic_guid === guid && x.role === 'selection').map((x) => x.ifc_guid);
      assert.deepEqual(selected(topic.guid), [walls[0].guid]); assert.deepEqual(selected(other.guid), [walls[1].guid]);
      const snaps = read.snapshots.filter((x) => x.topic_guid === topic.guid);
      assert.ok(snaps.length === 1 && snaps[0].type === 'image/jpeg' && snaps[0].bytes[0] === 0xff && snaps[0].bytes[1] === 0xd8, 'the photo as the snapshot');
      assert.equal(read.snapshots.length, 2);
      const vp = read.viewpoints.find((x) => x.topic_guid === topic.guid);
      const p = vp && vp.perspective_camera && vp.perspective_camera.camera_view_point;
      assert.ok(p && p.x > 2 && p.y < 0.1 && p.z > 1.25, 'the camera frames the wall from the south-east above: ' + JSON.stringify(p));
      // A picture that kept its EXIF (one the browser could not shrink) leaves without its position.
      const exif = D.require('data/exif');
      const tagged = exif.insertApp1(Uint8Array.from(atob(PIXEL), (ch) => ch.charCodeAt(0)), exif.buildApp1({ lat: 59.3293, lon: 18.0686, dateTimeOriginal: '2026-05-03T10:15:00' }));
      assert.ok(Number.isFinite(exif.parse(tagged).lat), 'the photo carries a position');
      const view = panel.check.viewOf({ picture: { mediaType: 'image/jpeg', data: btoa(String.fromCharCode(...tagged)) }, elementGuid: null, elementId: null });
      let lat = null;
      try { const m = exif.parse(view.snapshot.bytes); lat = m && m.lat; } catch (_e) { lat = null; }
      assert.ok(!Number.isFinite(lat) && btoa(String.fromCharCode(...view.snapshot.bytes)) === PIXEL, 'the snapshot is the picture without its EXIF');
    } finally { platformFiles.download = realDownload; panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('ai check: Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: CDE, clientId: 'dataspatium', clientSecret: '' })).connector;
    const meta = await datasets.get(ds.id);
    await datasets.updateMeta(ds.id, { source: Object.assign({}, meta.source || { kind: 'file' }, { cde: { connectorId: connector.id, connectorName: connector.name, host: 'tests', projectId: 'p-1', projectName: 'Testprojekt', documentId: 'doc-1', versionIndex: 1 } }) });
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'check', preview: () => {} });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      assert.ok(!panel.el.querySelector('[data-ai-check-server]'), 'not signed in: no button');
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${new URL(url).searchParams.get('redirect_uri')}?code=abc&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      await panel.load();
      // The findings as the AI records them in a check.
      await checkTools.call(panel.state.findings, crack(), { photos: [SOUTH] });
      await checkTools.call(panel.state.findings, Object.assign(damp(null), { priority: 'urgent' }), { photos: [SOUTH] });
      panel.attach([]);
      const button = /** @type {any} */ (panel.el.querySelector('[data-ai-check-server]'));
      assert.ok(button && !button.disabled, 'signed in: Skapa ärenden på servern');
      sent.length = 0; cde.topics = 0; cde.failTopic = 2;
      const first = await panel.check.createIssues({ confirmed: true });
      assert.ok(first && first.made === 1 && first.failed.length === 1 && first.failed[0].n === 2, JSON.stringify(first));
      assert.ok(panel.el.querySelector('[data-ai-check-failed]') && /Fuktfläck/.test(panel.el.querySelector('[data-ai-check-failed]').textContent), 'the failed finding reported');
      const topics = bodiesTo('/projects/p-1/topics');
      assert.equal(topics.length, 2, 'two topics tried');
      assert.ok(topics[0].title === 'Spricka i putsen' && topics[0].priority === 'High' && topics[0].topic_type === 'Inspection' && topics[0].description.includes('En spricka från sockeln'), JSON.stringify(topics[0]).slice(0, 300));
      const vps = bodiesTo('/topics/t-1/viewpoints');
      assert.equal(vps.length, 1, 'a viewpoint on the topic');
      assert.ok(vps[0].snapshot && vps[0].snapshot.snapshot_type === 'jpg' && vps[0].snapshot.snapshot_data === PIXEL, 'the photo as the snapshot');
      assert.ok(vps[0].components.selection.length === 1 && vps[0].components.selection[0].ifc_guid === walls[0].guid && vps[0].perspective_camera, 'the element selected, with a camera');
      // The next press sends the one left.
      cde.failTopic = 0;
      const second = await panel.check.createIssues({ confirmed: true });
      assert.ok(second && second.made === 1 && !second.failed.length, JSON.stringify(second));
      const again = bodiesTo('/projects/p-1/topics');
      assert.ok(again.length === 3 && again[2].title === 'Fuktfläck' && again[2].priority === 'Critical', 'urgent as the project\'s Critical');
      const vp2 = bodiesTo('/topics/t-3/viewpoints');
      assert.ok(vp2.length === 1 && !vp2[0].snapshot && vp2[0].components.selection[0].ifc_guid === walls[1].guid && vp2[0].perspective_camera, 'no photo: the element alone');
      assert.equal(panel.el.querySelectorAll('[data-ai-check-issued]').length, 2, 'both rows say so');
      assert.equal(panel.el.querySelector('[data-ai-check-sent]').getAttribute('data-ai-check-sent'), '2');
      assert.equal(await panel.check.createIssues({ confirmed: true }), null, 'nothing left to send');
    } finally {
      panel.destroy(); panel.el.remove();
      await datasets.updateMeta(ds.id, { source: meta.source || { kind: 'file' } });
    }
    return 'ok';
  }, 30000);

  test('ai check: cleanup', async (assert) => {
    for (const id of made) await datasets.remove(id).catch(() => {});
    if (ds) await datasets.remove(ds.id).catch(() => {});
    if (anthropic) await providers.remove(anthropic.id).catch(() => {});
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id).catch(() => {}); }
    if (realRequest) http.request = realRequest;
    D.net.unvirtual('tests/ai-check/'); D.net.unvirtual('tests/ai-check-cde/');
    assert.ok(true);
  });
})();
