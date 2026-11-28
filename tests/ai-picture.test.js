// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the AI's picture tools (ai/view-tools: render_view and plan_or_section, B-84) against mocked providers (virtual
 * dataspatium-asset:// servers, no network): the tool list and its tier, the pictures drawn off screen from the test building (type,
 * size and not empty), the picture in the tool's answer to a provider that sees pictures (Anthropic's tool_result, and an
 * OpenAI-compatible user message after the tool messages), the text in its place for one that does not, and the thumbnail in the
 * panel. The mocked servers answer by call count; the bodies are read where api/http sends them.
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
  const tools = D.require('ai/model-tools');
  const viewTools = D.require('ai/view-tools');
  const agent = D.require('ai/agent');
  const http = D.require('api/http');
  const tier = D.require('platform/tier');
  const BASE = 'dataspatium-asset://tests/ai-picture';
  const json = (data, status = 200) => ({ kind: 'text', data: JSON.stringify(data), status });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const VIEW = { view: 'iso', azimuth: null, elevation: null, storey: null, ifc_class: null, ids: null, isolate: null, projection: null };
  const CUT = { kind: 'plan', storey: 'Plan 1', cut_height: null, axis: null, at: null, start: null, end: null };
  const world = { anthropic: 0, openai: 0 };
  /** The bodies sent to the virtual providers, in order. */
  const sent = [];
  let model = null; let realRequest = null; let anthropic = null; let vision = null; let textOnly = null;
  /** The mocked Anthropic: first render_view, then the answer in words. */
  D.net.virtual('tests/ai-picture/a/', async (url) => {
    if (!String(url).endsWith('/v1/messages')) return json({ error: { message: 'no such path' } }, 404);
    world.anthropic++;
    if (world.anthropic % 2 === 1) return json({ id: 'p1', content: [{ type: 'tool_use', id: 'tu-pic', name: 'render_view', input: VIEW }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 20 } });
    return json({ id: 'p2', content: [{ type: 'text', text: 'Huset har två våningar.' }], stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 10 } });
  });
  /** The mocked OpenAI-compatible servers (one model that sees pictures, one that reads text only): plan_or_section, then the answer. */
  D.net.virtual('tests/ai-picture/o/', async (url) => {
    if (!String(url).endsWith('/chat/completions')) return json({ error: { message: 'no such path' } }, 404);
    world.openai++;
    if (world.openai % 2 === 1) return json({ id: 'c1', choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-pic', type: 'function', function: { name: 'plan_or_section', arguments: JSON.stringify(CUT) } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
    return json({ id: 'c2', choices: [{ message: { role: 'assistant', content: 'Planen har tre väggar.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 10 } });
  });
  /** The size of a picture and whether it shows more than its background. */
  async function look(picture) {
    const bytes = Uint8Array.from(atob(picture.data), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: picture.mediaType }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    g.drawImage(bitmap, 0, 0);
    const px = g.getImageData(0, 0, canvas.width, canvas.height).data;
    const bg = [px[0], px[1], px[2]];
    let other = 0;
    for (let i = 0; i < px.length; i += 4 * 7) if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 60) other++;
    const size = { width: bitmap.width, height: bitmap.height, other };
    bitmap.close();
    return size;
  }

  test('ai picture: the two picture tools are among the model tools, flat and strict, at the tier of the AI panel', async (assert) => {
    for (const name of ['render_view', 'plan_or_section']) {
      assert.ok(tools.names().includes(name) && tools.isPicture(name), name + ' listed');
      const tool = tools.TOOLS.find((x) => x.name === name);
      assert.ok(/picture/.test(tool.description) && /1024 × 768/.test(tool.description) && /without the changes of an open change set/.test(tool.description), 'the description says what the picture shows');
      const props = Object.entries(tool.parameters.properties);
      assert.ok(props.length >= 7 && props.every(([, p]) => Array.isArray(p.type) && p.type.includes('null')), name + ': every field may be null');
      assert.equal(tier.featureOf('tool:' + name), 'ai.panel', 'the panel\'s tier');
    }
    assert.ok(!tools.isPicture('query_elements'));
    const before = tier.choice();
    try {
      assert.ok(tools.offered().some((x) => x.name === 'render_view') && tools.offered().some((x) => x.name === 'plan_or_section'), 'offered in BIM och GIS');
      await tier.set('documents');
      assert.ok(!tools.offered().some((x) => tools.isPicture(x.name)), 'not in Dokument');
    } finally { await tier.set(before); }
    assert.ok(providers.seesImages({ kind: 'anthropic', model: 'claude-test' }), 'every Claude model sees pictures');
    assert.ok(['gpt-5', 'gpt-4o-mini', 'gemini-2.5-flash', 'llama3.2-vision', 'qwen2.5vl:7b', 'o3'].every((m) => providers.seesImages({ kind: 'openai', model: m })), 'models that see pictures');
    assert.ok(['llama3.2', 'gpt-test', 'o3-mini', ''].every((m) => !providers.seesImages({ kind: 'openai', model: m })), 'models that read text only');
    // The person's word wins over the name (F139 a): a local model with an unknown name, and a known one switched off.
    assert.ok(providers.seesImages({ kind: 'openai', model: 'min-lokala-modell', images: true }), 'switched on');
    assert.ok(!providers.seesImages({ kind: 'openai', model: 'gpt-4o', images: false }), 'switched off');
    assert.ok(providers.seesImages({ kind: 'anthropic', model: 'claude-test', images: false }), 'Claude always');
    const kept = await providers.save({ id: 'ai-test-images', kind: 'openai', name: 'Lokal', baseUrl: 'http://127.0.0.1:11434/v1', model: 'min-lokala-modell', images: true });
    try {
      assert.equal((await providers.get(kept.id)).images, true, 'the switch is kept with the provider');
      const plain = await providers.save({ id: 'ai-test-images', kind: 'openai', name: 'Lokal', baseUrl: 'http://127.0.0.1:11434/v1', model: 'min-lokala-modell' });
      assert.equal(plain.images, undefined, 'left unset, the name decides');
    } finally { await providers.remove(kept.id).catch(() => {}); }
    return 'ok';
  });

  test('ai picture: render_view draws the test building off screen as a JPEG of 1024 × 768 within the cap, of the whole model, a storey or chosen elements', async (assert) => {
    model = await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Bildhuset');
    const none = await tools.call(model.id, 'render_view', VIEW);
    assert.equal(none.error, viewTools.NO_PICTURE, 'without a provider that sees pictures, the text');
    const out = await tools.call(model.id, 'render_view', VIEW, { images: true });
    assert.ok(!out.error, String(out.error));
    assert.equal(out.picture.mediaType, 'image/jpeg');
    assert.ok(out.picture.bytes > 1000 && out.picture.bytes <= viewTools.MAX_BYTES, 'within the cap: ' + out.picture.bytes);
    const seen = await look(out.picture);
    assert.ok(seen.width === 1024 && seen.height === 768 && out.width === 1024 && out.height === 768, `1024 × 768: ${seen.width} × ${seen.height}`);
    assert.ok(seen.other > 200, 'the building is drawn, not only the background: ' + seen.other);
    assert.ok(out.count === 7 && /iso view of the whole model, perspective/.test(out.shows), out.shows);
    assert.ok(out.extent && out.extent.max[2] > out.extent.min[2], 'the model\'s extent');
    const engine = (await datasets.ensureOpen(model.id)).engine;
    // The door has no shape in the fixture: a wall is chosen.
    const wall = (await engine.exec("select id, guid from data where namn = 'Vägg 1.1'"))[0].values[0];
    const storey = await tools.call(model.id, 'render_view', Object.assign({}, VIEW, { storey: 'plan 2', azimuth: 200, elevation: 20, projection: 'orthographic' }), { images: true });
    assert.ok(!storey.error && storey.count === 3 && /azimuth 200° and elevation 20° of storey plan 2, orthographic/.test(storey.shows) && storey.metres_high > 0, storey.shows || storey.error);
    const chosen = await tools.call(model.id, 'render_view', Object.assign({}, VIEW, { view: 'front', ids: [String(wall[1])], isolate: true }), { images: true });
    assert.ok(!chosen.error && chosen.count === 1 && chosen.marked === 0 && /front view of 1 chosen elements/.test(chosen.shows), chosen.shows || chosen.error);
    const marked = await tools.call(model.id, 'render_view', Object.assign({}, VIEW, { ids: [Number(wall[0])] }), { images: true });
    assert.ok(!marked.error && marked.marked === 1 && marked.count === 7, 'the rest drawn and the wall marked: ' + marked.shows);
    const wrong = await tools.call(model.id, 'render_view', Object.assign({}, VIEW, { storey: 'Plan 9' }), { images: true });
    assert.ok(wrong.error && wrong.error.includes('Plan 1, Plan 2'), 'a storey the model lacks names the storeys: ' + wrong.error);
    const nothing = await tools.call(model.id, 'render_view', Object.assign({}, VIEW, { ids: [999999] }), { images: true });
    assert.ok(nothing.error && nothing.error.includes('none of the ids'), nothing.error);
    return 'ok';
  }, 60000);

  test('ai picture: plan_or_section draws a storey cut at a height and vertical sections along an axis and a line', async (assert) => {
    const plan = await tools.call(model.id, 'plan_or_section', CUT, { images: true });
    assert.ok(!plan.error, String(plan.error));
    assert.ok(plan.kind === 'plan' && plan.cut.cut_height === 1.2 && plan.cut.z > plan.cut.floor_z && plan.metres_per_pixel > 0, JSON.stringify(plan.cut));
    assert.ok(/plan of storey Plan 1, cut 1\.2 m above its floor/.test(plan.shows) && plan.count === 4, plan.shows);
    const seen = await look(plan.picture);
    assert.ok(seen.width === 1024 && seen.height === 768 && seen.other > 100 && plan.picture.bytes <= viewTools.MAX_BYTES, JSON.stringify(seen));
    const across = await tools.call(model.id, 'plan_or_section', Object.assign({}, CUT, { kind: 'section', storey: null, axis: 'y' }), { images: true });
    assert.ok(!across.error && across.kind === 'section' && across.cut.looking === 270 && /along the y axis at x = /.test(across.shows), across.shows || across.error);
    const line = await tools.call(model.id, 'plan_or_section', Object.assign({}, CUT, { kind: 'section', storey: null, start: [0, 0], end: [5, 0] }), { images: true });
    assert.ok(!line.error && line.cut.looking === 0 && /line from \(0, 0\) to \(5, 0\)/.test(line.shows), line.shows || line.error);
    assert.ok((await look(line.picture)).other > 50, 'the section shows the building');
    const neither = await tools.call(model.id, 'plan_or_section', Object.assign({}, CUT, { kind: null, storey: null }), { images: true });
    assert.ok(!neither.error && neither.kind === 'section' && neither.cut.looking === 0, 'without kind and storey a section along x through the middle');
    const plainPlan = await tools.call(model.id, 'plan_or_section', Object.assign({}, CUT, { storey: null, kind: 'plan' }), { images: true });
    assert.ok(plainPlan.error && plainPlan.error.includes('give storey'), plainPlan.error);
    const point = await tools.call(model.id, 'plan_or_section', Object.assign({}, CUT, { kind: 'section', start: [1, 1], end: [1, 1] }), { images: true });
    assert.ok(point.error && point.error.includes('two different points'), point.error);
    return 'ok';
  }, 60000);

  test('ai picture: a provider that sees pictures gets the picture in the tool result, Anthropic in its tool_result and OpenAI-compatible after the tool message', async (assert) => {
    realRequest = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE) && req.body !== undefined) sent.push(JSON.parse(String(req.body))); return realRequest(req); };
    anthropic = await providers.save({ id: 'ai-picture-anthropic', kind: 'anthropic', name: 'Mock picture Claude', baseUrl: BASE + '/a', model: 'claude-test' });
    vision = await providers.save({ id: 'ai-picture-vision', kind: 'openai', name: 'Mock picture GPT', baseUrl: BASE + '/o/vision', model: 'gpt-5' });
    textOnly = await providers.save({ id: 'ai-picture-text', kind: 'openai', name: 'Mock text model', baseUrl: BASE + '/o/text', model: 'llama3.2' });
    for (const p of [anthropic, vision, textOnly]) providers.setKey(p.id, 'sk-test-picture');
    await providers.setPolicy('ask');
    world.anthropic = 0; sent.length = 0;
    const out = await agent.ask({ provider: anthropic, datasetId: model.id, question: 'Hur ser huset ut?' });
    assert.ok(out.stopped === 'answered' && out.answer.includes('två våningar'), out.answer);
    assert.ok(out.steps.length === 1 && out.steps[0].name === 'render_view' && !out.steps[0].error && /^data:image\/jpeg;base64,/.test(out.steps[0].picture), 'the step carries the picture for the panel');
    assert.ok(sent[0].tools.some((x) => x.name === 'render_view' && x.input_schema.additionalProperties === false && x.input_schema.required.length === 8), 'offered with a strict schema');
    const result = sent[1].messages[2].content[0];
    assert.ok(result.type === 'tool_result' && result.tool_use_id === 'tu-pic' && Array.isArray(result.content), 'the result as blocks');
    assert.ok(result.content[0].type === 'text' && result.content[0].text.startsWith('[data from the model] ') && result.content[0].text.includes('"picture":"attached"') && result.content[0].text.length < 3000, 'the words without the picture: ' + result.content[0].text.slice(0, 120));
    const image = result.content[1];
    assert.ok(image.type === 'image' && image.source.type === 'base64' && image.source.media_type === 'image/jpeg' && image.source.data.length > 1000 && /^data:image\/jpeg;base64,/.test(out.steps[0].picture) && out.steps[0].picture.endsWith(image.source.data), 'the picture as an Anthropic image block');
    world.openai = 0; sent.length = 0;
    const plan = await agent.ask({ provider: vision, datasetId: model.id, question: 'Visa planen' });
    assert.ok(plan.stopped === 'answered' && plan.steps[0].name === 'plan_or_section' && plan.steps[0].picture, 'answered with the plan');
    const msgs = sent[1].messages;
    const at = msgs.findIndex((m) => m.role === 'tool');
    assert.ok(at > 0 && msgs[at].tool_call_id === 'call-pic' && typeof msgs[at].content === 'string' && msgs[at].content.includes('"picture":"attached"'), 'the tool message is text');
    const after = msgs[at + 1];
    assert.ok(after && after.role === 'user' && Array.isArray(after.content) && after.content[0].type === 'text' && after.content[0].text.includes('plan_or_section') && after.content[0].text.includes('call-pic'), 'a user message names the call');
    assert.ok(after.content[1].type === 'image_url' && after.content[1].image_url.url.startsWith('data:image/jpeg;base64,'), 'the picture as an image_url data URL');
    return 'ok';
  }, 60000);

  test('ai picture: a provider that reads text only gets the short text instead, and nothing is drawn or sent as a picture', async (assert) => {
    world.openai = 0; sent.length = 0;
    const out = await agent.ask({ provider: textOnly, datasetId: model.id, question: 'Visa planen' });
    assert.ok(out.stopped === 'answered' && out.steps[0].error === viewTools.NO_PICTURE && !out.steps[0].picture, 'the step says no picture can be shown');
    const msgs = sent[1].messages;
    const toolMsg = msgs.find((m) => m.role === 'tool');
    assert.ok(toolMsg && toolMsg.content.includes(viewTools.NO_PICTURE), 'the text in the tool message: ' + (toolMsg && toolMsg.content));
    assert.ok(!JSON.stringify(sent).includes('image_url') && !JSON.stringify(sent).includes('base64'), 'no picture in any request');
    return 'ok';
  }, 30000);

  test('ai picture: the panel shows the picture the AI asked for as a small picture in its step, and whole on a press', async (assert) => {
    world.anthropic = 0;
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log: () => {} } }, { datasetId: model.id });
    document.body.appendChild(panel.el);
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers loaded');
      panel.state.providerId = anthropic.id;
      await panel.ask('Hur ser huset ut?');
      const thumb = /** @type {HTMLButtonElement} */ (await waitFor(() => panel.el.querySelector('[data-ai-steps] li [data-ai-picture="render_view"]'), 3000, 'the thumbnail'));
      const img = /** @type {HTMLImageElement} */ (thumb.querySelector('img'));
      assert.ok(img && /^data:image\/jpeg;base64,/.test(img.src) && img.alt === t('ai.picture.alt', { tool: 'render_view' }), 'the picture with its text');
      assert.ok(thumb.getAttribute('data-tip') === t('ai.picture.open') && thumb.getAttribute('aria-label') === t('ai.picture.open'), 'a tip and a name');
      await waitFor(() => img.complete && img.naturalWidth === 1024, 3000, 'the picture decoded');
      assert.ok(thumb.getBoundingClientRect().width <= 220, 'small: ' + thumb.getBoundingClientRect().width);
      thumb.click();
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the picture whole');
      assert.ok(dlg.textContent.includes(t('ai.picture.title')) && dlg.querySelector('img') && /** @type {HTMLImageElement} */ (dlg.querySelector('img')).src === img.src, 'the same picture');
      /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button button')).pop()).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 2000, 'closed');
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 60000);

  test('ai picture: the provider form has *The model sees pictures* for an OpenAI-compatible model, preset from its name and kept when set (F139 a)', async (assert) => {
    const aiProviders = D.require('ui/bearbeta/ai-providers');
    const p = await providers.save({ id: 'ai-test-images-form', kind: 'openai', name: 'Lokal', baseUrl: 'http://127.0.0.1:11434/v1', model: 'min-lokala-modell' });
    try {
      const editing = aiProviders.edit(await providers.get(p.id));
      const dlg = /** @type {HTMLElement} */ (await waitFor(() => { const s = document.querySelector('dialog[open] [data-ai-form-images]'); return s && s.closest('dialog'); }, 3000, 'the form'));
      const images = /** @type {any} */ (dlg.querySelector('[data-ai-form-images]'));
      assert.ok(!images.hidden && !images.checked, 'shown, and off for a name not known to see pictures');
      images.checked = true; images.dispatchEvent(new Event('change'));
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="primary"] button')).click();
      const saved = await editing;
      assert.equal(saved && (await providers.get(saved.id)).images, true, 'kept with the provider');
      assert.ok(providers.seesImages(await providers.get(p.id)), 'and the picture tools now send it pictures');
      const claude = aiProviders.edit({ id: 'ai-test-images-claude', kind: 'anthropic', name: 'Claude', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5' });
      const dlg2 = /** @type {HTMLElement} */ (await waitFor(() => { const s = document.querySelector('dialog[open] [data-ai-form-images]'); return s && s.closest('dialog'); }, 3000, 'the Claude form'));
      assert.ok(/** @type {any} */ (dlg2.querySelector('[data-ai-form-images]')).hidden, 'no switch for Claude, which always sees pictures');
      /** @type {any} */ (dlg2).close();
      await claude;
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      await providers.remove(p.id).catch(() => {});
      await providers.remove('ai-test-images-claude').catch(() => {});
    }
    return 'ok';
  });

  test('ai picture: cleanup', async () => {
    if (realRequest) http.request = realRequest;
    for (const p of [anthropic, vision, textOnly]) if (p) await providers.remove(p.id);
    await providers.setPolicy('ask');
    if (model) await datasets.remove(model.id);
    D.require('viz/model-draw').clearCache();
    return 'ok';
  });
})();
