// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Ny byggnad ur en brief (decision F43 a): the agent in build mode plans, asks the person, builds through the write tools
 * and says the plan, with pictures in the first message in each provider's form; the panel in the mode Bygg ur brief shows the brief,
 * takes attachments and the question box; the form in Inhämta hands a brief to the model view. Mocked providers, no network.
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
  const http = D.require('api/http');
  const BASE = 'dataspatium-asset://tests/ai-build';
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data), status: 200 });
  const world = { calls: 0, script: [], bodies: [] };
  const toolUse = (name, input) => ({ id: 'm' + world.calls, content: [{ type: 'tool_use', id: 'tu' + world.calls, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 80, output_tokens: 30 } });
  const words = (text) => ({ id: 'm' + world.calls, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 80, output_tokens: 30 } });
  const openaiWords = (text) => ({ id: 'o' + world.calls, choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 10 } });
  let realRequest = null; let ds = null; let anthropic = null; let openai = null;
  const PIXEL = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  D.net.virtual('tests/ai-build/', async (url) => {
    const u = String(url);
    if (u.endsWith('/v1/messages') || u.endsWith('/chat/completions')) { const next = world.script[world.calls] || words('Klart.'); world.calls++; return json(typeof next === 'function' ? next() : next); }
    return { kind: 'text', data: '{}', status: 404 };
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }

  test('ai build: the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief', async (assert) => {
    realRequest = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE) && req.body) world.bodies.push(String(req.body)); return realRequest(req); };
    ds = await importer.run(fixtures.ifcFile({ walls: 0 }), { format: 'model' }, null, 'Brief-hus');
    anthropic = await providers.save({ id: 'ai-build-anthropic', kind: 'anthropic', name: 'Mock build', baseUrl: BASE + '/a/', model: 'claude-test' });
    providers.setKey(anthropic.id, 'sk-test-build');
    await providers.setPolicy('ask');
    world.calls = 0; world.bodies = [];
    world.script = [
      () => toolUse('get_model_overview', {}),
      () => toolUse('ask_person', { question: 'Hur många våningar?', options: [{ label: 'En', description: null }, { label: 'Två', description: 'Två plan' }], allow_free: true }),
      () => toolUse('create_storeys_and_grid', { storeys: [{ name: 'Plan 1', elevation: 0 }, { name: 'Plan 2', elevation: 2.7 }], grid: { x_count: 2, x_spacing: 6, y_count: 1, y_spacing: 8 } }),
      () => toolUse('create_wall', { storey: 'Plan 1', start: [0, 0], end: [12, 0], thickness: 0.3, height: 2.7, name: 'Yttervägg syd' }),
      () => toolUse('preview_changeset', {}),
      () => words('Planen: två plan, 12 × 8 m. Ändringssetet håller våningarna, rutnätet och en vägg.'),
    ];
    const cs = writeTools.create(ds.id);
    const asked = [];
    const out = await agent.ask({ provider: anthropic, datasetId: ds.id, question: 'Ett tvåvåningshus 12 × 8 m i tegel', changeset: cs, build: true,
      images: [{ mediaType: 'image/jpeg', data: PIXEL }],
      ask: async (q) => { asked.push(q); return { answer: 'Två', index: 1, free: false }; } });
    assert.equal(out.stopped, 'answered');
    assert.equal(out.changes, 2, 'storeys and grid, and a wall');
    assert.deepEqual(cs.ops.map((op) => op.tool), ['create_storeys_and_grid', 'create_wall']);
    assert.deepEqual(asked.map((q) => [q.question, q.options.map((o) => o.label), q.free]), [['Hur många våningar?', ['En', 'Två'], true]]);
    assert.ok(/Planen/.test(out.answer), out.answer);
    const first = JSON.parse(world.bodies[0]);
    assert.ok(/brief/.test(first.system) && /ask_person/.test(first.system) && /preview_changeset/.test(first.system), 'the build system text');
    assert.ok(first.tools.some((x) => x.name === 'ask_person') && first.tools.some((x) => x.name === 'create_wall') && first.tools.some((x) => x.name === 'preview_changeset'), 'the tools of the build');
    assert.ok(Array.isArray(first.messages[0].content) && first.messages[0].content[0].text === 'Ett tvåvåningshus 12 × 8 m i tegel' && first.messages[0].content[1].type === 'image' && first.messages[0].content[1].source.media_type === 'image/jpeg' && first.messages[0].content[1].source.data === PIXEL, 'the picture as an Anthropic image block');
    assert.equal(first.max_tokens, 4000);
    const third = JSON.parse(world.bodies[2]);
    const answered = third.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((b) => b.type === 'tool_result' && /"answer"/.test(String(b.content)));
    const back = answered ? String(answered.content) : '';
    assert.ok(/^\[data from the model\] /.test(back) && /"answer":"Två"/.test(back) && /"index":1/.test(back) && /"own_text":false/.test(back), 'the person\'s answer went back as data');
    const previewStep = out.steps.find((s) => s.name === 'preview_changeset');
    assert.ok(previewStep, 'the preview was tried (Python does not run in the suite)');
    // The OpenAI-compatible form carries the same picture as an image_url.
    openai = await providers.save({ id: 'ai-build-openai', kind: 'openai', name: 'Mock build OpenAI', baseUrl: BASE + '/o/', model: 'gpt-test' });
    providers.setKey(openai.id, 'sk-test-build-2');
    world.calls = 0; world.bodies = []; world.script = [() => openaiWords('Klart.')];
    const plain = await agent.ask({ provider: openai, datasetId: ds.id, question: 'Hej', images: [{ mediaType: 'image/png', data: PIXEL, caption: 'Bild 1: foto, test.png' }], budget: { turns: 1 } });
    assert.equal(plain.stopped, 'answered');
    const body = JSON.parse(world.bodies[0]);
    const user = body.messages.find((m) => m.role === 'user');
    assert.ok(Array.isArray(user.content) && user.content[1].type === 'text' && user.content[1].text === 'Bild 1: foto, test.png', 'the caption before the picture');
    assert.ok(user.content[2].type === 'image_url' && user.content[2].image_url.url.startsWith('data:image/png;base64,'), 'the picture as an OpenAI image block');
    return 'ok';
  }, 20000);

  test('ai build: the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI', async (assert) => {
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'build', brief: 'Ett tvåvåningshus 12 × 8 m' });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      assert.equal(panel.state.mode, 'build');
      assert.equal(/** @type {any} */ (panel.el.querySelector('[data-ai-question]')).value, 'Ett tvåvåningshus 12 × 8 m', 'the brief in the box');
      assert.ok(panel.el.querySelector('[data-ai-attach]') && panel.el.querySelector('[data-ai-attachments]').getAttribute('data-ai-attachments') === '0', 'the attach row');
      assert.equal(panel.el.querySelector('[data-ai-mode]').value, 'build');
      panel.attach([{ name: 'fasad.jpg', mediaType: 'image/jpeg', data: PIXEL }]);
      assert.equal(panel.el.querySelector('[data-ai-attachments]').getAttribute('data-ai-attachments'), '1');
      assert.ok(panel.el.querySelector('[data-ai-attachment="fasad.jpg"]'), 'the attachment listed');
      // The building's facts and the level of detail open the brief, and a labelled picture with a position gets a caption (decision F43 b).
      const storeys = /** @type {any} */ (panel.el.querySelector('[data-ai-form="storeys"]')); storeys.value = '2'; storeys.dispatchEvent(new Event('input'));
      const roof = /** @type {any} */ (panel.el.querySelector('[data-ai-form="roof"]')); roof.value = 'gable'; roof.dispatchEvent(new Event('change'));
      const detail = /** @type {any} */ (panel.el.querySelector('[data-ai-detail]')); detail.value = 'sketch'; detail.dispatchEvent(new Event('change'));
      const labelPick = /** @type {any} */ (panel.el.querySelector('[data-ai-label]')); labelPick.value = 'south'; labelPick.dispatchEvent(new Event('change'));
      assert.ok(panel.state.form.storeys === '2' && panel.state.form.roof === 'gable' && panel.state.detail === 'sketch', JSON.stringify(panel.state.form));
      const exif = D.require('data/exif');
      const raw = Uint8Array.from(atob(PIXEL), (c) => c.charCodeAt(0));
      const withPosition = exif.insertApp1(raw, exif.buildApp1({ lat: 59.3293, lon: 18.0686, altitude: 25, dateTimeOriginal: '2026-05-03T10:15:00' }));
      const fileInput = /** @type {any} */ (panel.el.querySelector('[data-ai-attach-input]'));
      const dt = new DataTransfer(); dt.items.add(new File([withPosition], 'sydfasad.jpg', { type: 'image/jpeg' })); fileInput.files = dt.files; fileInput.dispatchEvent(new Event('change'));
      await waitFor(() => panel.el.querySelector('[data-ai-attachments]').getAttribute('data-ai-attachments') === '2', 5000, 'the labelled picture (' + (panel.state.error || 'no error') + ', ' + panel.state.attachments.map((a) => a.name).join('|') + ')');
      const south = panel.state.attachments.find((a) => a.name === 'sydfasad.jpg');
      assert.ok(south && south.label === 'south' && south.where && Math.abs(south.where.lat - 59.3293) < 1e-4 && Math.abs(south.where.lon - 18.0686) < 1e-4 && south.where.alt === 25 && /^2026-05-03/.test(String(south.when)), JSON.stringify(south && { label: south.label, where: south.where, when: south.when }));
      assert.ok(panel.el.querySelector('[data-ai-attachment="sydfasad.jpg"][data-ai-attachment-label="south"]'), 'the badge says which façade');
      // The material goes to the server only for a model from one: no button for a model from a file, the button once the panel knows the server.
      assert.ok(!panel.el.querySelector('[data-ai-material]'), 'no upload for a model from a file');
      panel.state.material = { cde: { connectorId: 'c', projectId: 'p-1', projectName: 'Testprojekt', documentId: 'doc-1' }, connector: { name: 'Testservern' }, name: 'Brief-hus' };
      panel.attach([]);
      assert.equal(!!panel.el.querySelector('[data-ai-material]'), D.has('data/model-material'), 'the upload button when the module is there');
      panel.state.material = null; panel.attach([]);
      panel.state.providerId = anthropic.id;
      world.calls = 0; world.bodies = [];
      world.script = [
        () => toolUse('ask_person', { question: 'Vilket material?', options: [{ label: 'Tegel', description: null }, { label: 'Trä', description: null }], allow_free: false }),
        () => toolUse('create_storeys_and_grid', { storeys: [{ name: 'Plan 1', elevation: 0 }], grid: null }),
        () => words('Byggt: en våning i tegel.'),
      ];
      const run = panel.ask('Ett tvåvåningshus 12 × 8 m');
      const box = await waitFor(() => panel.el.querySelector('[data-ask]'), 5000, 'the question box');
      assert.ok(/Vilket material/.test(box.textContent));
      /** @type {HTMLElement} */ (box.querySelector('[data-ask-option="0"] button')).click();
      await run;
      assert.ok(/tegel/.test(panel.state.answer), panel.state.answer);
      assert.equal(panel.state.changeset.ops.length, 1, 'the change set holds the storey');
      const sent = JSON.parse(world.bodies[0]);
      const content = sent.messages[0].content;
      assert.ok(Array.isArray(content) && content[0].type === 'text' && content[0].text.startsWith(t('ai.build.form.block', { facts: `${t('ai.build.form.storeys')}: 2; ${t('ai.build.form.roof')}: ${t('ai.build.roof.gable')}` })), content[0].text);
      assert.ok(content[0].text.includes(t('ai.build.detail.block', { level: t('ai.build.detail.sketch'), text: t('ai.build.detail.sketch.text') })) && content[0].text.endsWith('Ett tvåvåningshus 12 × 8 m'), 'the level of detail and the brief after the facts');
      assert.ok(content[1].type === 'text' && content[1].text === t('ai.build.caption', { n: '1', label: t('ai.build.label.photo'), name: 'fasad.jpg' }) && content[2].type === 'image', 'the first picture with its caption');
      assert.ok(content[3].type === 'text' && content[3].text.includes(t('ai.build.label.south')) && content[3].text.includes('59.32930, 18.06860') && content[3].text.includes(t('ai.build.caption.alt', { alt: '25' })) && content[4].type === 'image', content[3].text);
      assert.ok(/Ett tvåvåningshus/.test(panel.state.history[0].content) && panel.state.exchanges.length === 1, 'the brief in the history');
      assert.ok(panel.el.querySelector('[data-ai-preview]'), 'preview and approval as in Ändra');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 20000);

  test('ai build: facts from a dataset go into the brief as text, with a footprint as corners in metres from the south-west corner', async (assert) => {
    const input = D.require('ai/build-input');
    const meta = await datasets.create({ name: 'Tomtprov', columns: [{ name: 'namn', type: 'text' }, { name: 'geometri', type: 'text' }, { name: 'vaningar', type: 'integer' }], rows: [['Huset', 'POLYGON ((674000 6580000, 674012 6580000, 674012 6580008, 674000 6580008, 674000 6580000))', 2], ['Garaget', 'POLYGON ((674020 6580000, 674026 6580000, 674026 6580004, 674020 6580004, 674020 6580000))', 1]] });
    try {
      const o = input.outline('POLYGON ((674000 6580000, 674012 6580000, 674012 6580008, 674000 6580008, 674000 6580000))');
      assert.deepEqual(o.corners, [[0, 0], [12, 0], [12, 8], [0, 8]], 'the closing point dropped, the corners from the south-west');
      assert.ok(o.width === 12 && o.depth === 8 && o.projected, JSON.stringify(o));
      const got = await input.facts(meta.id);
      assert.equal(got.rows, 2); assert.equal(got.geometries, 2);
      assert.ok(got.text.startsWith(t('ai.build.facts.block', { name: 'Tomtprov', n: 2 })), got.text.slice(0, 80));
      assert.ok(/namn: Huset/.test(got.text) && /12 × 8 m/.test(got.text) && /\(12, 8\)/.test(got.text) && /vaningar: 2/.test(got.text), got.text);
      const wgs = input.outline({ type: 'Point', coordinates: [12.0, 57.9] });
      assert.ok(wgs && wgs.corners.length === 1 && !wgs.projected, 'a WGS 84 point is projected');
      assert.equal(input.outline('nonsense'), null);
      const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'build', brief: 'Ett hus' });
      document.body.appendChild(panel.el);
      try {
        await waitFor(() => panel.state.providers.length, 3000, 'the providers');
        await panel.addFacts(meta.id);
        assert.ok(panel.state.question.startsWith('Ett hus\n\n') && /Huset/.test(panel.state.question), 'the facts appended to the brief');
      } finally { panel.destroy(); panel.el.remove(); }
    } finally { await datasets.remove(meta.id).catch(() => {}); }
    return 'ok';
  });

  test('ai build: the store flag from Inhämta is read by the model view', async (assert) => {
    assert.ok(typeof D.require('ui/bearbeta/model-view').create === 'function');
    const inhamta = D.require('ui/modes/inhamta');
    assert.ok(inhamta, 'the mode exists');
    assert.ok(t('newmodel.build') !== 'newmodel.build' && t('ai.mode.build') !== 'ai.mode.build', 'the strings exist');
    return 'ok';
  });

  test('ai build: cleanup', async (assert) => {
    if (ds) await datasets.remove(ds.id).catch(() => {});
    if (anthropic) await providers.remove(anthropic.id).catch(() => {});
    if (openai) await providers.remove(openai.id).catch(() => {});
    if (realRequest) http.request = realRequest;
    D.net.unvirtual('tests/ai-build/');
    assert.ok(true);
  });
})();
