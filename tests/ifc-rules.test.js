// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for buildingSMART's rules in the preview, the schema's EXPRESS rules at approval, the app's own IDS files, the purpose and
 * stage in the brief and the card Grunduppgifter (recommendations 8 and 10 of the native IFC study, 5, 6 and 12 of the Praxi study).
 * With the wheel stubbed: the agent's preview carries the failed rules by code, errors and warnings apart, and the failed IDS
 * specifications; the approved step asks for the EXPRESS rules and refuses new errors without leaving an undo step; the IDS files
 * are embedded; the brief's purpose picks the level of detail and the IDS file, and purpose, stage and requirements open the brief,
 * reach the AI's preview and the person's; the card draws every check and an error. With the real Pyodide (`?python=1` or cached
 * components): what the app writes passes the rules, a wrong property, a crossing outline and a set named like IFC's are found
 * (errors and a warning), the fixture's own faults never count, an IDS file is tried in the preview, the basic requirements are read
 * and the approval runs the EXPRESS rules.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const agent = D.require('ai/agent');
  const writeTools = D.require('ai/write-tools');
  const providers = D.require('ai/providers');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const fixtures = D.require('tests/fixtures/ifc');
  const http = D.require('api/http');
  const created = [];
  const BASE = 'dataspatium-asset://tests/ifc-rules';
  const world = { calls: 0, script: [], bodies: [] };
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data), status: 200 });
  const toolUse = (name, input) => ({ id: 'm' + world.calls, content: [{ type: 'tool_use', id: 'tu' + world.calls, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 80, output_tokens: 30 } });
  const words = (text) => ({ id: 'm' + world.calls, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 80, output_tokens: 30 } });
  D.net.virtual('tests/ifc-rules/', async (url) => {
    const u = String(url);
    if (u.endsWith('/v1/messages')) { const next = world.script[world.calls] || words('Klart.'); world.calls++; return json(typeof next === 'function' ? next() : next); }
    return { kind: 'text', data: '{}', status: 404 };
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const rule = (code, level, id, message) => ({ level, kind: 'rule', rule: code, ifc_class: 'IfcWall', id, guid: 'g' + id, attribute: null, message });
  /** A preview report as the wheel answers it: a schema error, three rule errors of two rules, a rule warning and an IDS file's verdict. */
  const REPORT = {
    created: [{ id: 900, ifc_class: 'IfcWall', storey: 'Plan 1' }], changed: [], deleted: [], errors: 4,
    findings: [{ level: 'error', ifc_class: 'IfcWall', id: 900, attribute: 'Name', message: 'Attribute not optional' }, rule('IFC102', 'error', 900, 'PredefinedType STANDARD is deprecated for IfcWall in IFC4'),
      rule('IFC102', 'error', 901, 'PredefinedType STANDARD is deprecated for IfcWall in IFC4'), rule('SWE001', 'error', 902, 'the profile\'s outer curve is not a simple closed boundary: Self-intersection[2 2]'),
      rule('PSE002', 'warning', 903, '\'PSet_Eget\' is a property set of its own whose name starts like a standard one; only IFC\'s own sets start with Pset_')],
    rules: { errors: 3, warnings: 1, rules: { IFC102: { level: 'error', count: 2 }, SWE001: { level: 'error', count: 1 }, PSE002: { level: 'warning', count: 1 } }, source: 'buildingSMART ifc-gherkin-rules 893f827' },
    ids: { file: 'SE-Dataspatium_Grund.ids', specifications: 14, passed: 13, failed: [{ name: 'Rummet har ett nummer', failed: 2, examples: [{ class: 'IfcSpace', id: 950, name: null, reason: 'The required attribute does not exist' }] }] },
  };
  let model = null;
  async function theModel() {
    if (!model) { model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Regelprov'); created.push(model.id); }
    return model;
  }

  test('ifc rules: the agent\'s preview carries the failed rules by code, errors and warnings apart, and the failed IDS specifications', async (assert) => {
    const ds = await theModel();
    const cs = writeTools.create(ds.id);
    assert.ok(writeTools.call(cs, 'create_wall', { storey: 'Plan 1', start: [0, 0], end: [12, 0], thickness: 0.2, height: 3, name: 'Syd' }).ok);
    const real = bridge.runIfcChangeset; const state = bridge.state;
    const seen = [];
    bridge.runIfcChangeset = async (changes, bytes, options) => { seen.push(options || {}); return { bytes: new Uint8Array(4), info: REPORT, log: [] }; };
    try {
      bridge.state = 'ready';
      const out = await agent.previewFor(ds.id, cs, { ids: { name: 'krav.ids', text: '<ids/>' } });
      assert.equal(out.errors, 4, 'every error counts, the rules\' too');
      assert.deepEqual(out.findings, [{ class: 'IfcWall', id: 900, attribute: 'Name', message: 'Attribute not optional' }], 'the schema\'s findings without the rules\'');
      assert.deepEqual(out.rules.map((r) => [r.rule, r.level, r.count, r.examples.length]), [['IFC102', 'error', 2, 2], ['SWE001', 'error', 1, 1], ['PSE002', 'warning', 1, 1]], 'by rule, errors first: ' + JSON.stringify(out.rules));
      assert.deepEqual(out.rules[0].examples[0], { class: 'IfcWall', id: 900, message: 'PredefinedType STANDARD is deprecated for IfcWall in IFC4' });
      assert.deepEqual(out.ids, { file: 'SE-Dataspatium_Grund.ids', specifications: 14, passed: 13, failed: REPORT.ids.failed });
      assert.deepEqual(seen[0].ids, { name: 'krav.ids', text: '<ids/>' }, 'the IDS file goes to the wheel');
      const plain = await agent.previewFor(ds.id, cs);
      assert.ok(!('ids' in seen[1]) && plain.rules.length === 3, 'without an IDS file none is asked for');
      bridge.runIfcChangeset = async () => ({ bytes: new Uint8Array(4), info: { created: [], changed: [], deleted: [], findings: [], errors: 0, rules: { errors: 0, warnings: 0, rules: {} } }, log: [] });
      const clean = await agent.previewFor(ds.id, cs);
      assert.ok(!('rules' in clean) && !('ids' in clean), 'nothing to say: no rules and no IDS in the summary');
      assert.deepEqual(agent.idsBrief({ file: 'x.ids', error: 'XMLSchemaValidationError: bad' }), { file: 'x.ids', error: 'XMLSchemaValidationError: bad' }, 'an IDS error stays an error');
    } finally { bridge.runIfcChangeset = real; bridge.state = state; }
    const rulesLine = 'The preview also tries buildingSMART\'s rules on what the change set made or changed (rules, each with its code): mend the errors as you mend schema errors, since they block approval, and the warnings when you can.';
    assert.ok(agent.SYSTEM_CHANGE.includes(rulesLine) && agent.SYSTEM_BUILD.includes(rulesLine), 'the change and build texts say to mend the rules');
    assert.ok(agent.SYSTEM_BUILD.includes('The brief may name the model\'s purpose and stage') && agent.SYSTEM_BUILD.includes('each preview lists the specifications the model fails (ids)'), 'the build text knows the purpose and the requirements');
    assert.ok(/buildingSMART rules the change set fails \(rules: code, error or warning, count and examples\)/.test(agent.PREVIEW_TOOL.description) && /the specifications that fail \(ids\)/.test(agent.PREVIEW_TOOL.description) && agent.PREVIEW_TOOL.description.includes('topology'), 'the preview tool tells of the rules and the IDS');
    return 'ok';
  }, 20000);

  test('ifc rules: the approved step asks for the schema\'s EXPRESS rules and refuses new errors without leaving an undo step', async (assert) => {
    const ds = await theModel();
    const real = bridge.runIfcChangeset;
    const seen = [];
    bridge.runIfcChangeset = async (changes, bytes, options) => {
      seen.push(options || {});
      return { bytes: new Uint8Array(4), log: [], info: { created: [], changed: [], deleted: [], errors: 2, rules: { errors: 0, warnings: 0, rules: {} }, express: { ran: true, errors: 2 },
        findings: [{ level: 'error', kind: 'express', rule: 'IfcWall.CorrectPredefinedType', ifc_class: 'IfcWall', id: 54, attribute: 'IfcWall.CorrectPredefinedType', message: 'x' },
          { level: 'error', kind: 'express', rule: 'IfcSlab.CorrectTypeAssigned', ifc_class: 'IfcSlab', id: 55, attribute: 'IfcSlab.CorrectTypeAssigned', message: 'y' }] } };
    };
    const undoBefore = recipes.canUndo(ds.id);
    let refused = '';
    try {
      await recipes.apply(ds.id, 'ifc_changeset', { changes: JSON.stringify([{ tool: 'set_properties', ids: [1], pset: 'Pset_WallCommon', properties: { IsExternal: true } }]) });
    } catch (err) { refused = String(err.message); } finally { bridge.runIfcChangeset = real; }
    assert.equal(refused, t('op.err.ifc_changeset.express', { n: 2, rules: 'IfcWall.CorrectPredefinedType, IfcSlab.CorrectTypeAssigned' }), 'the refusal names the rules');
    assert.equal(seen[0].express, true, 'the approval asks the wheel for the EXPRESS rules');
    assert.equal(recipes.canUndo(ds.id), undoBefore, 'the refused step left no undo step');
    ifcOps.refuseExpress({ express: { ran: true, errors: 0 } });
    ifcOps.refuseExpress({ express: { ran: false, errors: 0, note: 'the schema\'s rules were left out on a model of 400000 instances' } });
    ifcOps.refuseExpress({});
    return 'ok';
  }, 20000);

  test('ifc rules: the app\'s IDS files are embedded, and the brief\'s purpose picks the level and the IDS file, which reach the brief and both previews', async (assert) => {
    const presets = D.require('analysis/ids-presets');
    const listed = await presets.list();
    const names = listed.map((x) => x.name);
    assert.ok(names.includes('presets/ids/SE-Dataspatium_Grund.ids') && names.includes('presets/ids/SE-Dataspatium_Klimatdeklaration.ids'), 'the two files: ' + names.join(', '));
    assert.deepEqual(listed.filter((x) => /Grund|Klimat/.test(x.file)).map((x) => x.title), ['SE-Dataspatium_Grund', 'SE-Dataspatium_Klimatdeklaration'], 'listed by their titles');
    const grund = await presets.load('presets/ids/SE-Dataspatium_Grund.ids');
    assert.equal(grund.name, 'SE-Dataspatium_Grund.ids');
    assert.ok(grund.text.includes('<title>SE-Dataspatium_Grund</title>') && (grund.text.match(/<specification /g) || []).length === 14, 'Grund with 14 specifications');
    assert.ok(['G01', 'G05', 'G06', 'G14'].every((id) => grund.text.includes(`identifier="${id}"`)) && grund.text.includes('IFCBUILDINGELEMENTPROXY'), 'names, no proxies and PredefinedTypes');
    const klimat = await presets.load('presets/ids/SE-Dataspatium_Klimatdeklaration.ids');
    assert.ok((klimat.text.match(/<specification /g) || []).length === 22 && ['LoadBearing', 'IsExternal', 'Qto_WallBaseQuantities', 'Category', 'IFCWALLSTANDARDCASE'].every((x) => klimat.text.includes(x)), 'Klimatdeklaration with 22 specifications');
    // The panel in the mode Bygg ur brief.
    const ds = await theModel();
    const realRequest = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE) && req.body) world.bodies.push(String(req.body)); return realRequest(req); };
    const provider = await providers.save({ id: 'ifc-rules-anthropic', kind: 'anthropic', name: 'Mock rules', baseUrl: BASE + '/a/', model: 'claude-test' });
    providers.setKey(provider.id, 'sk-test-rules');
    await providers.setPolicy('ask');
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: ds.id, mode: 'build', brief: 'Ett enplanshus' });
    document.body.appendChild(panel.el);
    const realChangeset = bridge.runIfcChangeset; const state = bridge.state;
    const seen = [];
    bridge.runIfcChangeset = async (changes, bytes, options) => { seen.push(options || {}); return { bytes: new Uint8Array(4), info: REPORT, log: [] }; };
    try {
      await waitFor(() => panel.state.providers.length, 3000, 'the providers');
      const pick = (selector, value) => { const el = /** @type {any} */ (panel.el.querySelector(selector)); el.value = value; el.dispatchEvent(new Event('change')); };
      pick('[data-ai-form="purpose"]', 'permit');
      assert.ok(panel.state.detail === 'main' && panel.state.ids === 'SE-Dataspatium_Grund.ids', 'a building permit: main features and Grund');
      pick('[data-ai-form="purpose"]', 'volume');
      assert.ok(panel.state.detail === 'sketch' && panel.state.ids === 'SE-Dataspatium_Grund.ids', 'a massing study: a sketch');
      pick('[data-ai-form="purpose"]', 'climate');
      assert.ok(panel.state.detail === 'main' && panel.state.ids === 'SE-Dataspatium_Klimatdeklaration.ids', 'a climate declaration: its own IDS');
      pick('[data-ai-form="purpose"]', 'waste');
      const waste = names.includes('presets/ids/SE-Dataspatium_Avfallshantering.ids') ? 'SE-Dataspatium_Avfallshantering.ids' : '';
      assert.ok(panel.state.detail === 'detailed' && panel.state.ids === waste, 'a waste management plan: detailed, with its IDS when the app has it');
      assert.ok(!panel.el.querySelector('[data-ai-form="purposeText"]'), 'no free text but for another purpose');
      pick('[data-ai-form="purpose"]', 'other');
      const own = /** @type {any} */ (await waitFor(() => panel.el.querySelector('[data-ai-form="purposeText"]'), 2000, 'the free text'));
      own.value = 'Energiberäkning'; own.dispatchEvent(new Event('input'));
      pick('[data-ai-form="stage"]', 'proposal');
      pick('[data-ai-ids]', 'SE-Dataspatium_Grund.ids');
      assert.ok(panel.state.form.purpose === 'other' && panel.state.form.purposeText === 'Energiberäkning' && panel.state.form.stage === 'proposal' && panel.state.ids === 'SE-Dataspatium_Grund.ids', JSON.stringify(panel.state.form));
      bridge.state = 'ready';
      panel.state.providerId = provider.id;
      world.calls = 0; world.bodies = [];
      world.script = [
        () => toolUse('create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null }),
        () => toolUse('preview_changeset', {}),
        () => words('Byggt: en våning. Kvar: rumsnumren.'),
      ];
      await panel.ask('Ett enplanshus');
      const text = JSON.parse(world.bodies[0]).messages[0].content;
      const first = typeof text === 'string' ? text : text[0].text;
      for (const line of [t('ai.build.purpose.block', { purpose: 'Energiberäkning' }), t('ai.build.stage.block', { stage: t('ai.build.stage.proposal') }), t('ai.build.ids.block', { file: 'SE-Dataspatium_Grund.ids' })]) {
        assert.ok(first.includes(line), 'the brief opens with ' + line + ': ' + first);
      }
      assert.ok(seen[0] && seen[0].ids && seen[0].ids.name === 'SE-Dataspatium_Grund.ids' && seen[0].ids.text.includes('identifier="G01"'), 'the AI\'s preview tries the brief\'s IDS file');
      const third = JSON.stringify(JSON.parse(world.bodies[2]).messages);
      assert.ok(third.includes('\\"rules\\":[{\\"rule\\":\\"IFC102\\"') && third.includes('Rummet har ett nummer'), 'the AI read the failed rules and specifications');
      // The person's preview: the rules' codes, the warnings apart and the IDS verdict.
      await panel.preview();
      assert.ok(seen[1] && seen[1].ids && seen[1].ids.name === 'SE-Dataspatium_Grund.ids', 'the person\'s preview tries it too');
      await waitFor(() => panel.el.querySelector('[data-ai-report]'), 3000, 'the report');
      assert.ok(panel.el.querySelector('[data-ai-rule="IFC102"]') && panel.el.querySelector('[data-ai-rule="IFC102"]').textContent.startsWith('IFC102 · IfcWall #900'), 'a finding with its rule');
      assert.ok(panel.el.querySelector('[data-ai-rule="PSE002"]').classList.contains('dm-help'), 'a warning apart from the errors');
      assert.equal(panel.el.querySelector('[data-ai-rule-warnings]').textContent, t('ai.change.rules.warnings', { n: '1' }));
      assert.equal(panel.el.querySelector('[data-ai-findings]').getAttribute('data-ai-findings'), '4', 'the errors block approval');
      const ids = panel.el.querySelector('[data-ai-ids-result]');
      assert.ok(ids && ids.getAttribute('data-ai-ids-result') === '1' && ids.textContent === t('ai.change.ids.result', { file: 'SE-Dataspatium_Grund.ids', passed: '13', n: '14', failed: 'Rummet har ett nummer' }), ids && ids.textContent);
    } finally {
      bridge.runIfcChangeset = realChangeset; bridge.state = state; http.request = realRequest;
      panel.destroy(); panel.el.remove(); await providers.remove(provider.id).catch(() => {});
    }
    return 'ok';
  }, 30000);

  /** A basic-requirements report as the wheel answers it. */
  const BASICS = {
    schema: 'IFC4',
    checks: [
      { key: 'header', status: 'ok', facts: { view: 'ViewDefinition [DesignTransferView]', system: 'Testprogram 1.0', preprocessor: 'Testverktyg', time: '2026-11-04T12:00:00', schema: 'IFC4' }, faults: [] },
      { key: 'crs', status: 'fail', facts: { crs: '', height: '', conversions: 0 }, faults: [{ code: 'no_crs', level: 'fail', count: 1, examples: ['IfcProjectedCRS'] }] },
      { key: 'names', status: 'warn', facts: { sites: 1, buildings: 1, storeys: 2 }, faults: [{ code: 'no_description', level: 'warn', count: 7, examples: ['#1 IfcBuildingStorey \'Plan 1\'', '#2 x', '#3 x', '#4 x', '#5 x', '#6 x', '#7 x'] }] },
      { key: 'rooms', status: 'fail', facts: { spaces: 3 }, faults: [{ code: 'duplicate', level: 'fail', count: 1, examples: ['\'101\': #440, #465'] }] },
      { key: 'psets', status: 'ok', facts: { own: 0 }, faults: [] },
      { key: 'units', status: 'warn', facts: {}, faults: [{ code: 'unit', level: 'warn', count: 1, examples: ['SE-Prov_Ljud.Ljudklass = \'40 dB\''] }] },
    ],
  };

  test('ifc rules: the card Grunduppgifter in Kontrollera reads the model on the button and draws every check, and an error', async (assert) => {
    const ds = await theModel();
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const real = bridge.runIfcBasics;
    let fail = false;
    bridge.runIfcBasics = async () => { await wait(20); if (fail) throw new Error('IfcOpenShell is not available'); return BASICS; };
    try {
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === ds.id), 5000, 'model in store');
      shell.store.set({ selectedId: ds.id });
      shell.activate('kontrollera');
      const card = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-model] [data-card="basics"]'), 8000, 'the card');
      assert.ok(card.textContent.includes(t('kontrollera.basics')) && card.textContent.includes('Praxi') && !card.querySelector('[data-basics-check]'), 'the card names Praxi and waits for the button');
      const press = () => /** @type {HTMLElement} */ (card.querySelector('[data-basics-run] button') || card.querySelector('[data-basics-run]')).click();
      press();
      await waitFor(() => card.querySelector('[data-basics-check="units"]'), 5000, 'the checks');
      const statuses = Array.from(card.querySelectorAll('[data-basics-check]')).map((x) => [x.getAttribute('data-basics-check'), x.getAttribute('data-basics-status')]);
      assert.deepEqual(statuses, [['header', 'ok'], ['crs', 'fail'], ['names', 'warn'], ['rooms', 'fail'], ['psets', 'ok'], ['units', 'warn']], 'every check in order');
      const header = card.querySelector('[data-basics-check="header"]');
      assert.ok(header.textContent.includes('Testprogram 1.0') && header.textContent.includes(t('kontrollera.basics.fact.system')) && header.textContent.includes(t('kontrollera.basics.status.ok')), 'the header\'s facts');
      const crs = card.querySelector('[data-basics-check="crs"] [data-basics-fault="no_crs"]');
      assert.ok(crs && crs.textContent.includes(t('kontrollera.basics.fault.no_crs', { n: '1' })), 'no CRS');
      const names = card.querySelector('[data-basics-check="names"] [data-basics-fault="no_description"]');
      assert.ok(names.getAttribute('data-basics-count') === '7' && names.querySelectorAll('li').length === 5 && names.textContent.includes(t('kontrollera.classes.more', { n: '2' })), 'the first five examples and how many more');
      assert.ok(card.querySelector('[data-basics-check="rooms"]').textContent.includes('\'101\': #440, #465'), 'the room number used twice');
      assert.ok(card.querySelector('[data-basics-check="units"]').textContent.includes('40 dB'), 'the unit in a value');
      assert.ok(card.querySelector('[data-basics-summary]').textContent.includes('IFC4'), 'the schema');
      fail = true;
      press();
      const error = await waitFor(() => card.querySelector('[data-basics-error]'), 5000, 'the error');
      assert.ok(error.textContent.includes('IfcOpenShell is not available') && !card.querySelector('[data-basics-check]'), error.textContent);
      return 'ok';
    } finally { bridge.runIfcBasics = real; history.replaceState(null, '', location.pathname + location.search); root.remove(); }
  }, 60000);

  test('ifc rules: Python passes what the app writes, finds what a change set breaks and only that, tries an IDS file, reads the basic requirements and runs the EXPRESS rules at approval', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Regelprov Python');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const build = (bad) => {
      const cs = writeTools.create(meta.id);
      assert.ok(writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null }).ok);
      assert.ok(writeTools.call(cs, 'define_type', { kind: 'wall', name: 'YV1', layers: [{ material: 'Betong', thickness: 0.2, category: 'concrete', role: 'load_bearing' }], predefined_type: null }).ok);
      for (const [start, end] of [[[0, 0], [12, 0]], [[12, 0], [12, 8]], [[12, 8], [0, 8]], [[0, 8], [0, 0]]]) assert.ok(writeTools.call(cs, 'create_wall', { storey: 'Plan 3', start, end, thickness: null, height: 3, name: 'Vägg', type: 'new-1' }).ok);
      assert.ok(writeTools.call(cs, 'create_slab', { storey: 'Plan 3', outline: [[0, 0], [12, 0], [12, 8], [0, 8]], thickness: 0.25, name: 'Golv' }).ok);
      assert.ok(writeTools.call(cs, 'set_properties', { ids: ['new-2'], pset: 'Pset_WallCommon', properties: { IsExternal: true, LoadBearing: true } }).ok);
      if (bad) assert.ok(writeTools.call(cs, 'create_slab', { storey: 'Plan 3', outline: [[0, 0], [4, 4], [4, 0], [0, 4]], thickness: 0.2, name: 'Korsad' }).ok);
      return writeTools.toWheel(cs);
    };
    const good = await ifcOps.previewChangeset(meta.id, build(false));
    assert.equal(good.report.errors, 0, 'what the app writes passes, and the fixture\'s own faults (a STANDARD wall type) do not count: ' + JSON.stringify(good.report.findings));
    assert.ok(good.report.rules && good.report.rules.errors === 0 && good.report.rules.source === 'buildingSMART ifc-gherkin-rules 893f827', JSON.stringify(good.report.rules));
    const bad = await ifcOps.previewChangeset(meta.id, build(true));
    const codes = (bad.report.findings || []).filter((f) => f.kind === 'rule').map((f) => `${f.rule} ${f.level}`);
    assert.ok(codes.includes('SWE001 error') && bad.report.errors >= 1 && bad.report.rules.errors >= 1, 'the crossing outline: ' + JSON.stringify(bad.report.findings));
    // set_properties refuses a wrong standard set; the rules find one in a file that has it, the warning apart.
    const run = await bridge.run(['import ifcopenshell, ifcopenshell.api.project, ifcopenshell.api.root, ifcopenshell.api.pset', 'm = ifcopenshell.api.project.create_file(version="IFC4")',
      'w = ifcopenshell.api.root.create_entity(m, ifc_class="IfcWall")', 'p = ifcopenshell.api.pset.add_pset(m, product=w, name="Pset_WallCommon")',
      'p.HasProperties = [m.create_entity("IfcPropertySingleValue", Name="UValue", NominalValue=m.create_entity("IfcReal", 0.2))]',
      'q = ifcopenshell.api.pset.add_pset(m, product=w, name="PSet_Eget")', 'q.HasProperties = [m.create_entity("IfcPropertySingleValue", Name="Varde", NominalValue=m.create_entity("IfcInteger", 1))]',
      'r = _dataspatium._ifc_rules(m)', 'print(" | ".join(sorted(set("%s %s" % (f["rule"], f["level"]) for f in r["findings"]))))',
      'print([f["message"] for f in r["findings"] if f["rule"] == "PSE001"][0])'].join('\n'));
    const said = run.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
    assert.ok(said.includes('PSE001 error') && said.includes('PSE002 warning') && said.includes('UValue is not a property of Pset_WallCommon'), 'a wrong property is an error and a set named like IFC\'s a warning: ' + said);
    // An IDS file in the preview: the walls without LoadBearing fail Klimatdeklaration.
    const klimat = await D.require('analysis/ids-presets').load('presets/ids/SE-Dataspatium_Klimatdeklaration.ids');
    const tried = await ifcOps.previewChangeset(meta.id, build(false), { ids: { name: klimat.name, text: klimat.text } });
    const ids = tried.report.ids;
    assert.ok(ids && !ids.error && ids.file === 'SE-Dataspatium_Klimatdeklaration.ids' && ids.specifications === 22, JSON.stringify(ids));
    assert.ok(ids.failed.some((x) => x.name === 'Väggen är bärande eller inte' && x.failed >= 3), 'three walls say nothing of LoadBearing: ' + JSON.stringify(ids.failed.map((x) => [x.name, x.failed])));
    assert.equal(tried.report.errors, 0, 'requirements do not block approval');
    // The basic requirements of the fixture: a header, no CRS, names without long names and descriptions.
    const basics = await ifcOps.basicsOf(meta.id);
    assert.deepEqual(basics.checks.map((c) => c.key), ['header', 'crs', 'names', 'rooms', 'psets', 'units']);
    const by = Object.fromEntries(basics.checks.map((c) => [c.key, c]));
    assert.ok(by.header.status === 'ok' && by.header.facts.system === 'Testprogram 1.0', JSON.stringify(by.header));
    assert.ok(by.crs.status === 'fail' && by.crs.faults.some((f) => f.code === 'no_crs'), JSON.stringify(by.crs));
    assert.ok(by.names.faults.some((f) => f.code === 'no_long_name') && by.names.faults.some((f) => f.code === 'no_description' && f.count === 2), JSON.stringify(by.names));
    // The approval runs the schema's EXPRESS rules on the candidate.
    const result = await recipes.apply(meta.id, 'ifc_changeset', { changes: JSON.stringify(build(false)) });
    const express = result && result.report && result.report.express;
    assert.ok(express && (express.ran ? express.errors === 0 : /could not run|left out/.test(String(express.note))), 'the EXPRESS rules ran without new errors: ' + JSON.stringify(express));
    return 'ok';
  }, 900000);

  test('ifc rules: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    D.net.unvirtual('tests/ifc-rules/');
    return 'ok';
  });
})();
