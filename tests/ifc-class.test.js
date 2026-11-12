// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the right IFC class (decision B-57.2). With the wheel stubbed: the read tools search_ifc_class and get_class_report answer
 * through the app's Python only when it runs and start nothing otherwise, the search passes the model's schema, the card IFC-klasser
 * in Kontrollera draws a report and an error, and the build and change texts tell the AI how to choose a class. With the real Pyodide
 * (`?python=1` or cached components): 'sink' finds IfcSanitaryTerminal with SINK, 'handrail' IfcRailing with HANDRAIL, the report on a
 * fixture with a proxy, a USERDEFINED covering without ObjectType and furniture outside the spatial structure counts them all, and the
 * change set refuses a PredefinedType outside the class's enumeration, naming the values it takes.
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

  test('ifc class: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
