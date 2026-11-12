// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the right IFC class (decision B-57.2). With the wheel stubbed: the read tools search_ifc_class and get_class_report answer
 * through the app's Python only when it runs and start nothing otherwise, the search passes the model's schema, the card IFC-klasser
 * in Kontrollera draws a report and an error, and the build and change texts tell the AI how to choose a class. With the real Pyodide
 * (`?python=1` or cached components): 'sink' finds IfcSanitaryTerminal with SINK, 'handrail' IfcRailing with HANDRAIL, the report on a
 * fixture with a proxy, a USERDEFINED covering without ObjectType and furniture outside the spatial structure counts them all, and the
 * change set refuses a PredefinedType outside the class's enumeration, naming the values it takes. Decision B-59 and the native-IFC
 * fixes: no tool text or prompt names a licensed classification system, set_site measures from grid east, a wall is SOLIDWALL or
 * PARTITIONING, an outline drops a repeated first corner and the importer takes IFC4.3 storeys' heights from their placements; with
 * the real Pyodide the wheel writes those walls, closes every polyline on its first point (GEM111), shares a classification reference
 * only for the same system, code and name, and writes IFC4.3 storeys without Elevation and spaces as SPACE (IFC102).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const agent = D.require('ai/agent');
  const tools = D.require('ai/model-tools');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const SINK = [{ class: 'IfcSanitaryTerminal', predefined_types: [{ name: 'SINK', doc: 'Waste water appliance for receiving, retaining or disposing of domestic, culinary, laboratory or industrial process liquids.' }], description: 'A sanitary terminal is a fixed appliance …', spec_url: 'https://standards.buildingsmart.org/', type_class: 'IfcSanitaryTerminalType' }];
  const example = (id, cls, name, extra) => Object.assign({ id, guid: 'g' + id, ifc_class: cls, name }, extra || {});
  /** A class report as the wheel answers it. */
  const REPORT = {
    schema: 'IFC4', elements: 9,
    proxies: { count: 1, examples: [example(1112, 'IfcBuildingElementProxy', 'Okänd låda', { object_type: 'Låda' })] },
    userdefined: { count: 1, occurrences: 1, types: 0, rule: 'IFC CorrectPredefinedType; ifc-gherkin-rules OJT001 Object Predefined Type', examples: [example(1116, 'IfcCovering', 'Golvbeläggning', { kind: 'occurrence' })] },
    untyped: { count: 7, by_class: { IfcSlab: 4, IfcDoor: 3 }, examples: [1, 2, 3, 4, 5, 6, 7].map((i) => example(2000 + i, i <= 4 ? 'IfcSlab' : 'IfcDoor', 'Del ' + i, { type_classes: [i <= 4 ? 'IfcSlabType' : 'IfcDoorType'] })) },
    type_conflicts: { count: 0, rule: 'ifc-gherkin-rules OJT001 Object Predefined Type (concept template 4.1.3.2)', examples: [] },
    outside: { count: 1, rule: 'ifc-gherkin-rules SPS007 Spatial Containment', examples: [example(1120, 'IfcFurniture', 'Lös stol')] },
  };
  let model = null;
  async function theModel() {
    if (!model) { model = await importer.run(fixtures.ifcFile({ walls: 2, classes: true }), { format: 'model' }, null, 'Klassprov'); created.push(model.id); }
    return model;
  }

  test('ifc class: search_ifc_class and get_class_report answer through the app\'s Python only when it runs, with the model\'s schema', async (assert) => {
    const ds = await theModel();
    const search = tools.TOOLS.find((x) => x.name === 'search_ifc_class');
    assert.ok(search && /English IFC words/.test(search.description) && /IfcBuildingElementProxy is the last resort/.test(search.description), 'the search tool as the providers see it');
    assert.deepEqual(Object.keys(search.parameters.properties), ['query', 'limit']);
    assert.ok(tools.TOOLS.some((x) => x.name === 'get_class_report' && /OJT001/.test(x.description) && /SPS007/.test(x.description)), 'the report tool names the rules');
    const realSearch = bridge.runIfcClassSearch; const realReport = bridge.runIfcClassReport; const state = bridge.state;
    const calls = [];
    bridge.runIfcClassSearch = async (schema, query, limit) => { calls.push([schema, query, limit]); return SINK; };
    bridge.runIfcClassReport = async () => { calls.push(['report']); return REPORT; };
    try {
      bridge.state = 'idle';
      assert.equal((await tools.call(ds.id, 'search_ifc_class', { query: 'sink', limit: null })).error, 'the class search needs the app\'s Python, which is not running; ask the person to press Preview once');
      assert.ok(/needs the app's Python/.test((await tools.call(ds.id, 'get_class_report', {})).error), 'the report too');
      assert.equal(calls.length, 0, 'nothing started');
      bridge.state = 'ready';
      const out = await tools.call(ds.id, 'search_ifc_class', { query: 'sink', limit: null });
      assert.deepEqual(out, { query: 'sink', count: 1, classes: SINK });
      assert.deepEqual(calls[0], ['IFC4', 'sink', 12], 'the model\'s schema and the default limit');
      await tools.call(ds.id, 'search_ifc_class', { query: 'handrail', limit: 99 });
      assert.equal(calls[1][2], 50, 'at most 50');
      assert.ok((await tools.call(ds.id, 'search_ifc_class', { query: '  ', limit: null })).error.includes('English IFC words'), 'an empty query');
      assert.deepEqual(await tools.call(ds.id, 'get_class_report', {}), REPORT);
    } finally { bridge.runIfcClassSearch = realSearch; bridge.runIfcClassReport = realReport; bridge.state = state; }
    for (const text of [agent.SYSTEM_BUILD, agent.SYSTEM_CHANGE]) {
      assert.ok(text.includes('Choose the most specific IFC class and PredefinedType, look it up with search_ifc_class when unsure, never use IfcBuildingElementProxy when a class fits, and use USERDEFINED only with an ObjectType.'), 'the build and change texts say how to choose');
    }
    return 'ok';
  }, 20000);

  test('ifc class: the card IFC-klasser in Kontrollera reads the model on the button and draws every check, and an error', async (assert) => {
    const ds = await theModel();
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const real = bridge.runIfcClassReport;
    let fail = false;
    bridge.runIfcClassReport = async () => { await wait(20); if (fail) throw new Error('IfcOpenShell is not available'); return REPORT; };
    try {
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === ds.id), 5000, 'model in store');
      shell.store.set({ selectedId: ds.id });
      shell.activate('kontrollera');
      const card = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-model] [data-card="classes"]'), 8000, 'the card');
      assert.ok(card.textContent.includes(t('kontrollera.classes')) && !card.querySelector('[data-classes-check]'), 'the card waits for the button');
      const press = () => /** @type {HTMLElement} */ (card.querySelector('[data-classes-run] button') || card.querySelector('[data-classes-run]')).click();
      press();
      await waitFor(() => card.querySelector('[data-classes-check="outside"]'), 5000, 'the checks');
      const counts = Array.from(card.querySelectorAll('[data-classes-check]')).map((x) => [x.getAttribute('data-classes-check'), x.getAttribute('data-classes-count')]);
      assert.deepEqual(counts, [['proxies', '1'], ['userdefined', '1'], ['untyped', '7'], ['type_conflicts', '0'], ['outside', '1']], 'every check in order');
      const conflicts = card.querySelector('[data-classes-check="type_conflicts"]');
      assert.ok(conflicts.textContent.includes(t('kontrollera.findings.none')) && conflicts.textContent.includes('OJT001'), 'none, with the rule');
      const untyped = card.querySelector('[data-classes-check="untyped"]');
      assert.equal(untyped.querySelectorAll('[data-classes-example]').length, 5, 'the first five examples');
      assert.ok(untyped.textContent.includes('IfcSlab 4') && untyped.textContent.includes('IfcDoor 3') && untyped.textContent.includes('IfcSlabType'), 'the classes and their type classes');
      assert.ok(untyped.textContent.includes(t('kontrollera.classes.more', { n: '2' })), 'and how many more');
      assert.ok(card.querySelector('[data-classes-check="outside"]').textContent.includes('SPS007') && card.querySelector('[data-classes-example="1120"]').textContent.includes('Lös stol'), 'the furniture outside');
      assert.ok(card.querySelector('[data-classes-summary]').textContent.includes('IFC4'), 'the schema');
      fail = true;
      press();
      const error = await waitFor(() => card.querySelector('[data-classes-error]'), 5000, 'the error');
      assert.ok(error.textContent.includes('IfcOpenShell is not available') && !card.querySelector('[data-classes-check]'), error.textContent);
      return 'ok';
    } finally { bridge.runIfcClassReport = real; history.replaceState(null, '', location.pathname + location.search); root.remove(); }
  }, 60000);

  test('ifc class: Python finds sink and handrail, reports the fixture\'s proxy, USERDEFINED and furniture, and refuses a PredefinedType outside the enumeration', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const ds = await theModel();
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const sink = await tools.call(ds.id, 'search_ifc_class', { query: 'sink', limit: null });
    assert.ok(!sink.error && sink.classes[0].class === 'IfcSanitaryTerminal' && sink.classes[0].predefined_types[0].name === 'SINK' && sink.classes[0].type_class === 'IfcSanitaryTerminalType', 'sink: ' + JSON.stringify(sink).slice(0, 400));
    assert.ok(sink.classes[0].predefined_types[0].doc && sink.classes[0].description && sink.classes[0].spec_url, 'with the docs of the pinned IfcOpenShell');
    const rail = await tools.call(ds.id, 'search_ifc_class', { query: 'handrail', limit: null });
    assert.ok(!rail.error && rail.classes[0].class === 'IfcRailing' && rail.classes[0].predefined_types.some((p) => p.name === 'HANDRAIL'), 'handrail: ' + JSON.stringify(rail).slice(0, 400));
    const report = await tools.call(ds.id, 'get_class_report', {});
    assert.ok(!report.error, JSON.stringify(report).slice(0, 300));
    assert.equal(report.proxies.count, 1, 'the proxy'); assert.equal(report.proxies.examples[0].object_type, 'Låda');
    assert.equal(report.userdefined.count, 1, 'USERDEFINED without ObjectType'); assert.equal(report.userdefined.examples[0].ifc_class, 'IfcCovering');
    assert.equal(report.outside.count, 1, 'the furniture outside the spatial structure'); assert.equal(report.outside.examples[0].ifc_class, 'IfcFurniture');
    assert.equal(report.type_conflicts.count, 4, 'the fixture\'s walls are SOLIDWALL under a STANDARD type (OJT001)');
    assert.ok(report.untyped.by_class.IfcSlab === 1 && report.untyped.by_class.IfcDoor === 1, 'the untyped slab and door: ' + JSON.stringify(report.untyped.by_class));
    const run = await bridge.run(['import ifcopenshell, ifcopenshell.guid', 'm = ifcopenshell.file(schema="IFC4")', 'w = m.create_entity("IfcWall", GlobalId=ifcopenshell.guid.new())',
      'try:', '    _dataspatium._ChangeSet(m).predefined(w, "BIG")', '    print("accepted")', 'except _dataspatium.DataspatiumError as exc:', '    print("refused: " + str(exc))'].join('\n'));
    const said = run.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
    assert.ok(said.includes('refused: BIG is not a PredefinedType of IfcWall in IFC4; it takes') && said.includes('SOLIDWALL') && said.includes('PARTITIONING'), 'the valid values named: ' + said);
    return 'ok';
  }, 900000);

  test('ifc class: no tool text or prompt names a licensed classification system, set_site measures from grid east, and walls, outlines and storeys follow the rules', async (assert) => {
    // Decision B-59: no classification system that needs a licence or costs money in tool texts, prompts or tests.
    const writeTools = D.require('ai/write-tools');
    const texts = [agent.SYSTEM, agent.SYSTEM_CHANGE, agent.SYSTEM_BUILD, agent.SYSTEM_CHECK || ''].concat(tools.TOOLS.concat(writeTools.TOOLS).map((x) => x.name + ' ' + x.description + ' ' + JSON.stringify(x.parameters)));
    const LICENSED = new RegExp(['Co' + 'Class', 'BS' + 'AB', 'NS ?34' + '51', 'TA' + 'LO ?2000', '\\bCC' + 'S\\b', '\\bCC' + 'I\\b', '813' + '46'].join('|'), 'i');
    assert.deepEqual(texts.filter((x) => LICENSED.test(x)).map((x) => x.slice(0, 60)), [], 'no licensed system named');
    const classify = writeTools.TOOLS.find((x) => x.name === 'set_classification').description;
    assert.ok(/the person names; never assume a system/.test(classify) && /search_ifc_class/.test(classify), 'set_classification stays system-agnostic');
    const site = writeTools.TOOLS.find((x) => x.name === 'set_site').description;
    assert.ok(/from grid east \(the map's x axis, along the eastings\) to the model's X axis, counter-clockwise positive/.test(site) && !/grid north to/.test(site), 'the rotation as IfcMapConversion measures it');
    // Walls: partition true is PARTITIONING, otherwise SOLIDWALL; never STANDARD.
    const cs = writeTools.create('x');
    assert.ok(writeTools.call(cs, 'create_wall', { storey: null, start: [0, 0], end: [4, 0], thickness: 0.1, height: 2.5, name: 'Lätt', partition: true }).ok);
    assert.ok(writeTools.call(cs, 'create_wall', { storey: null, start: [0, 0], end: [0, 4], thickness: 0.3, height: 2.5, name: 'Bärande', partition: null }).ok);
    assert.equal(cs.ops[0].partition, true); assert.ok(!('partition' in cs.ops[1]), 'only a partition carries the flag');
    assert.ok(writeTools.describe(cs.ops[0]).endsWith(t('ai.change.wall.partition')) && !writeTools.describe(cs.ops[1]).endsWith(t('ai.change.wall.partition')), 'the description says so');
    assert.deepEqual(writeTools.TOOLS.find((x) => x.name === 'create_wall').parameters.properties.partition, { type: ['boolean', 'null'] });
    // Outlines: a repeated first corner at the end is dropped, the wheel closes on the first point (GEM111).
    assert.ok(writeTools.call(cs, 'create_slab', { storey: null, outline: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], thickness: null, name: null }).ok);
    assert.deepEqual(cs.ops[2].outline, [[0, 0], [4, 0], [4, 4], [0, 4]]);
    assert.ok(writeTools.call(cs, 'create_roof', { storey: null, shape: 'flat', outline: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null }).ok);
    assert.equal(cs.ops[3].outline.length, 4);
    assert.ok(writeTools.call(cs, 'create_slab', { storey: null, outline: [[0, 0], [4, 0], [0, 0]], thickness: null, name: null }).error, 'two corners and a repeat are not an outline');
    // IFC4.3 deprecates IfcBuildingStorey.Elevation (IFC102): the importer takes a storey's height from its placement.
    const text = fixtures.ifcText({ walls: 2 }).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC4X3_ADD2'))").replace(/(IFCBUILDINGSTOREY\([^;]*,\.ELEMENT\.,)[0-9.]+\)/g, '$1$)');
    assert.ok(!/IFCBUILDINGSTOREY\([^;]*\.ELEMENT\.,[0-9]/.test(text), 'the fixture without Elevation');
    const m43 = await importer.run(new File([text], 'utan-elevation.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Utan Elevation');
    created.push(m43.id);
    const facts = ((await datasets.get(m43.id)) || {}).model || {};
    assert.deepEqual((facts.storeys || []).map((s) => [s.name, s.elevation]), [['Plan 1', 0], ['Plan 2', 3]], 'the storeys\' heights from their placements: ' + JSON.stringify(facts.storeys));
    return 'ok';
  }, 30000);

  test('ifc class: Python writes SOLIDWALL and PARTITIONING, closes polylines on their first point, shares a classification reference only for the same class, and writes IFC4.3 storeys and spaces without deprecated values', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const writeTools = D.require('ai/write-tools');
    const ifcOps = D.require('data/ifc-ops');
    const ds = await theModel();
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const build = (storey) => {
      const cs = writeTools.create(ds.id);
      if (storey === 'Plan 3') writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 3', elevation: 6 }], grid: null });
      for (const [name, start, end, partition] of [['S', [0, 0], [12, 0], null], ['E', [12, 0], [12, 8], null], ['N', [12, 8], [0, 8], null], ['W', [0, 8], [0, 0], null], ['M', [6, 0], [6, 8], true]]) {
        assert.ok(writeTools.call(cs, 'create_wall', { storey, start, end, thickness: 0.2, height: 3, name, partition }).ok);
      }
      writeTools.call(cs, 'create_slab', { storey, outline: [[0, 0], [12, 0], [12, 8], [0, 8], [0, 0]], thickness: null, name: 'Golv' });
      writeTools.call(cs, 'create_roof', { storey, shape: 'hip', outline: null, pitch: null, overhang: null, thickness: null, ridge: null, base: null, name: null });
      writeTools.call(cs, 'create_spaces', { storey, rooms: [{ at: [3, 4], index: null, name: 'Kök', long_name: null }, { at: [9, 4], index: null, name: 'Sal', long_name: null }], height: null });
      return cs;
    };
    /** The closed polylines of a STEP text that end on a copy of their first point instead of the point itself (GEM111). */
    function copies(text) {
      const at = new Map(Array.from(text.matchAll(/^#(\d+)=IFCCARTESIANPOINT\(\(([^)]*)\)\);$/gm)).map((m) => [m[1], m[2]]));
      return Array.from(text.matchAll(/^#(\d+)=IFCPOLYLINE\(\(([^)]*)\)\);$/gm)).filter((m) => {
        const refs = m[2].split(',').map((r) => r.trim().slice(1));
        return refs.length >= 4 && at.get(refs[0]) === at.get(refs[refs.length - 1]) && refs[0] !== refs[refs.length - 1];
      }).map((m) => m[1]);
    }
    const cs = build('Plan 3');
    // The walls S and E are new-1 and new-2. The same code in two systems, two classes without a code, and a reference shared.
    for (const args of [{ ids: ['new-1'], system: 'System A', code: '21', name: 'Exterior', uri: null }, { ids: ['new-2'], system: 'System B', code: '21', name: 'Other', uri: null },
      { ids: ['new-1'], system: 'System A', code: null, name: 'No code 1', uri: null }, { ids: ['new-2'], system: 'System A', code: null, name: 'No code 2', uri: null },
      { ids: ['new-2'], system: 'System A', code: '21', name: 'Exterior', uri: null }]) assert.ok(writeTools.call(cs, 'set_classification', args).ok, JSON.stringify(args));
    const out = await ifcOps.previewChangeset(ds.id, writeTools.toWheel(cs));
    assert.equal(out.report.errors, 0, 'no errors: ' + JSON.stringify(out.report.findings));
    const text = new TextDecoder().decode(out.bytes);
    const walls = Array.from(text.matchAll(/^#\d+=IFCWALL\('[^']*',#\d+,'([SENWM])',.*,\.(\w+)\.\);$/gm)).map((m) => m[1] + ' ' + m[2]).sort();
    assert.deepEqual(walls, ['E SOLIDWALL', 'M PARTITIONING', 'N SOLIDWALL', 'S SOLIDWALL', 'W SOLIDWALL'], 'the walls\' PredefinedTypes');
    assert.ok(!/=IFCWALL\(.*\.STANDARD\.\);/.test(text), 'no STANDARD');
    assert.deepEqual(copies(text), [], 'every closed polyline of the slab, the roof and the spaces ends on its first point');
    const systems = new Map(Array.from(text.matchAll(/^#(\d+)=IFCCLASSIFICATION\([^;]*'(System [AB])'/gm)).map((m) => [m[1], m[2]]));
    const refs = Array.from(text.matchAll(/^#(\d+)=IFCCLASSIFICATIONREFERENCE\(\$,(\$|'21'),'([^']*)',#(\d+),/gm)).filter((m) => systems.has(m[4]));
    assert.deepEqual(refs.map((m) => `${systems.get(m[4])} | ${m[2] === '$' ? '-' : '21'} | ${m[3]}`).sort(),
      ['System A | - | No code 1', 'System A | - | No code 2', 'System A | 21 | Exterior', 'System B | 21 | Other'], 'one reference per system, code and, without a code, name');
    const exterior = refs.find((m) => m[3] === 'Exterior')[1];
    const sharing = Array.from(text.matchAll(/^#\d+=IFCRELASSOCIATESCLASSIFICATION\([^;]*\(([^)]*)\),#(\d+)\);$/gm)).filter((m) => m[2] === exterior);
    assert.ok(sharing.length === 1 && sharing[0][1].split(',').length === 2, 'both walls share the reference of the same class: ' + JSON.stringify(sharing.map((m) => m[1])));
    // A new IFC4.3 model: storeys without Elevation, spaces SPACE with Pset_SpaceCommon.IsExternal false.
    const { dataset } = await D.require('data/ifc-new').create({ name: 'Klassprov 4.3', schema: 'IFC4X3_ADD2', storey: 'Plan 1' });
    created.push(dataset.id);
    const cs43 = build('Plan 1');
    cs43.datasetId = dataset.id;
    const out43 = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs43));
    assert.equal(out43.report.errors, 0, 'IFC4.3: no errors: ' + JSON.stringify(out43.report.findings));
    const t43 = new TextDecoder().decode(out43.bytes);
    assert.ok(/=IFCBUILDINGSTOREY\('[^']*',\$,'Plan 1',\$,\$,#\d+,\$,\$,\.ELEMENT\.,\$\);/.test(t43), 'the storey without Elevation');
    assert.ok(/=IFCSPACE\([^;]*\.ELEMENT\.,\.SPACE\.,\$\);/.test(t43) && !/=IFCSPACE\([^;]*\.INTERNAL\./.test(t43), 'the spaces are SPACE');
    assert.ok(t43.includes("'Pset_SpaceCommon'") && /IFCPROPERTYSINGLEVALUE\('IsExternal',\$,IFCBOOLEAN\(\.F\.\),\$\)/.test(t43), 'and not external');
    assert.deepEqual(copies(t43), [], 'closed polylines in IFC4.3 too');
    return 'ok';
  }, 900000);

  test('ifc class: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
