// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the project profile (F41 a, step 5): the AI writes an IDS with the validator in the loop against a mocked provider and an
 * injected check, bSDD's answers are normalised through a virtual address, set_classification becomes a change-set step and
 * search_bsdd a model tool, and the card lists the project's IDS documents and keeps the chosen dictionaries. Nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const idsWriter = D.require('ai/ids-writer');
  const providers = D.require('ai/providers');
  const bsdd = D.require('api/bsdd');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/profile';
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data), status: 200 });
  const world = { calls: 0, script: [], bodies: [] };
  const toolUse = (name, input) => ({ id: 'm' + world.calls, content: [{ type: 'tool_use', id: 'tu' + world.calls, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 50, output_tokens: 20 } });
  const words = (text) => ({ id: 'm' + world.calls, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 20 } });
  const http = D.require('api/http');
  const created = [];
  let realRequest = null; let provider = null;
  D.net.virtual('tests/profile/', async (url) => {
    const u = String(url);
    if (u.endsWith('/v1/messages')) { const next = world.script[world.calls] || words('Klart.'); world.calls++; return json(typeof next === 'function' ? next() : next); }
    if (u.includes('/bsdd/api/TextSearch/v1')) return json({ dictionaries: [{ dictionaryName: 'Testordbok', dictionaryUri: 'https://identifier.buildingsmart.org/uri/test/test/1.0', classes: [{ uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0/class/wall', name: 'Vägg', code: 'W1', description: 'En vägg' }] }] });
    if (u.includes('/bsdd/api/Dictionary/v1')) return json({ dictionaries: [{ uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0', name: 'Testordbok', organizationCodeOwner: 'test', version: '1.0', license: 'MIT' }] });
    if (u.includes('/bsdd/api/Class/v1')) return json({ uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0/class/wall', name: 'Vägg', code: 'W1', definition: 'En vägg', classProperties: [{ name: 'FireRating', propertySet: 'Pset_WallCommon', dataType: 'String' }] });
    return { kind: 'text', data: '{}', status: 404 };
  });
  const VALID = '<?xml version="1.0" encoding="UTF-8"?><ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><info><title>Krav</title></info><specifications><specification name="Väggar har brandklass" ifcVersion="IFC4"><applicability minOccurs="1" maxOccurs="unbounded"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability><requirements><property dataType="IFCLABEL" cardinality="required"><propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet><baseName><simpleValue>FireRating</simpleValue></baseName></property></requirements></specification></specifications></ids>';

  test('profile: the AI hands the IDS to the check, gets the structure error back, fixes the file and reports when it ran', async (assert) => {
    realRequest = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE) && req.body) world.bodies.push(String(req.body)); return realRequest(req); };
    provider = await providers.save({ id: 'ai-test-ids', kind: 'anthropic', name: 'Mock IDS', baseUrl: BASE + '/', model: 'claude-test' });
    providers.setKey(provider.id, 'sk-test-ids');
    await providers.setPolicy('ask');
    const meta = await datasets.create({ name: 'Profilprov', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    created.push(meta.id);
    world.calls = 0; world.bodies = [];
    world.script = [
      () => toolUse('write_ids', { xml: '<ids><specifications/></ids>' }),
      () => toolUse('write_ids', { xml: VALID }),
      () => words('Kontrollen gick: 2 av 3 väggar har brandklass.'),
    ];
    const checked = []; const events = [];
    const out = await idsWriter.write({ provider, datasetId: meta.id, description: 'Alla väggar ska ha brandklass i Pset_WallCommon.', rounds: 4,
      check: async (xml) => { checked.push(xml); return { ran: true, summary: { specifications: 1, checks: 3, checks_pass: 2, checks_fail: 1 }, failed: [{ specification: 'Väggar har brandklass', requirement: 'FireRating', element: 'IfcWall Vägg 3', reason: 'saknas' }], rows: 3 }; },
      onEvent: (ev) => events.push(ev) });
    assert.equal(out.stopped, 'ran');
    assert.equal(out.rounds, 2, 'two hand-overs');
    assert.deepEqual(checked, [VALID], 'only the well-formed file reached the check');
    assert.ok(/brandklass/.test(out.answer), out.answer);
    assert.ok(out.xml === VALID && out.result.ran && out.result.summary.checks_fail === 1, 'the file and the check kept');
    assert.deepEqual(events.map((e) => [e.round, e.ran]), [[1, false], [2, true]]);
    const second = JSON.parse(world.bodies[1]);
    const toolResult = JSON.stringify(second.messages);
    assert.ok(/the root must be <ids> in the namespace/.test(toolResult), 'the structure error went back to the AI');
    assert.ok(/data from the app/.test(toolResult), 'marked as data');
    assert.ok(/write_ids/.test(JSON.stringify(second.tools)) && /ifctester/.test(second.system) && /\(sv\)|\(en\)|\(da\)|\(nb\)|\(nn\)|\(fi\)|\(is\)/.test(second.system), 'the tool and the system text');
    assert.equal(idsWriter.structure(VALID), null);
    assert.ok(/well-formed/.test(idsWriter.structure('<ids>') || ''));
    assert.ok(/no specification/.test(idsWriter.structure('<ids xmlns="http://standards.buildingsmart.org/IDS"/>') || ''));
    // The rounds run out without a file that runs.
    world.calls = 0; world.script = [() => toolUse('write_ids', { xml: '<x/>' }), () => toolUse('write_ids', { xml: '<y/>' })];
    const spent = await idsWriter.write({ provider, datasetId: meta.id, description: 'x', rounds: 2, check: async () => ({ ran: true }) });
    assert.equal(spent.stopped, 'rounds'); assert.equal(spent.rounds, 2);
    return 'ok';
  });

  test('profile: bSDD answers are normalised, and set_classification and search_bsdd are tools', async (assert) => {
    bsdd.setBase(BASE + '/bsdd');
    try {
      const found = await bsdd.search('vägg', { dictionaries: ['https://identifier.buildingsmart.org/uri/test/test/1.0'] });
      assert.deepEqual(found.map((c) => [c.name, c.code, c.dictionary]), [['Vägg', 'W1', 'Testordbok']]);
      const dicts = await bsdd.dictionaries();
      assert.deepEqual(dicts.map((d) => [d.name, d.version, d.license]), [['Testordbok', '1.0', 'MIT']]);
      const cls = await bsdd.classOf(found[0].uri);
      assert.ok(cls.name === 'Vägg' && cls.properties[0].propertySet === 'Pset_WallCommon', JSON.stringify(cls));
    } finally { bsdd.setBase(null); }
    const writeTools = D.require('ai/write-tools');
    const cs = writeTools.create();
    const res = writeTools.call(cs, 'set_classification', { ids: [101, 102], system: 'Testordbok', code: 'W1', name: 'Vägg', uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0/class/wall' });
    assert.ok(res.ok && /Testordbok/.test(res.description) && /W1/.test(res.description), JSON.stringify(res));
    const ops = writeTools.toWheel(cs);
    assert.deepEqual(ops, [{ tool: 'set_classification', ids: [101, 102], system: 'Testordbok', code: 'W1', name: 'Vägg', uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0/class/wall' }]);
    const bad = writeTools.call(cs, 'set_classification', { ids: [1], system: '', name: '' });
    assert.ok(!bad.ok, 'system and name are required');
    const modelTools = D.require('ai/model-tools');
    assert.ok(modelTools.names().includes('search_bsdd'), 'the read tool exists');
    bsdd.setBase(BASE + '/bsdd');
    try {
      const got = await modelTools.call(created[0], 'search_bsdd', { text: 'vägg', limit: 5 });
      assert.ok(got && got.classes && got.classes[0].code === 'W1', JSON.stringify(got));
    } finally { bsdd.setBase(null); }
    return 'ok';
  });

  test('profile: the card lists the IDS documents of the project and keeps the chosen dictionaries per server and project', async (assert) => {
    const profileCard = D.require('ui/api/profile-card');
    const connector = { id: 'cde-profile-test', name: 'Testserver', baseUrl: 'https://cde.example.test/' };
    const idb = D.require('platform/storage/idb');
    await idb.setSetting(profileCard.SETTING(connector.id, 'p1'), null);
    const card = profileCard.create({ connector, log() {} });
    document.body.appendChild(card.el);
    try {
      card.update({ projectId: '', files: [] });
      assert.ok(card.el.hidden, 'hidden without a project');
      card.update({ projectId: 'p1', projectName: 'Projektet', files: [{ filename: 'krav.ids', documentId: 'd1' }, { filename: 'hus.ifc', documentId: 'd2', model: true }] });
      await new Promise((r) => setTimeout(r, 50));
      assert.ok(!card.el.hidden && card.el.querySelector('[data-profile-ids-docs]').getAttribute('data-profile-ids-docs') === '1' && /krav\.ids/.test(card.el.textContent), 'one IDS document listed');
      assert.ok(card.el.querySelector('[data-profile-write-ids]'), 'the AI button');
      await card.addDictionary({ uri: 'https://identifier.buildingsmart.org/uri/test/test/1.0', name: 'Testordbok' });
      assert.equal(card.el.querySelector('[data-profile-dictionaries]').getAttribute('data-profile-dictionaries'), '1');
      const again = profileCard.create({ connector, log() {} });
      again.update({ projectId: 'p1', projectName: 'Projektet', files: [] });
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(again.state.dictionaries.length, 1, 'kept in the browser for the server and project');
      again.update({ projectId: 'p2', projectName: 'Annat', files: [] });
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(again.state.dictionaries.length, 0, 'another project has its own');
      await card.removeDictionary('https://identifier.buildingsmart.org/uri/test/test/1.0');
      assert.equal(card.state.dictionaries.length, 0);
    } finally { card.el.remove(); await idb.setSetting(profileCard.SETTING(connector.id, 'p1'), null); }
    return 'ok';
  });

  test('profile: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    if (provider) await providers.remove(provider.id).catch(() => {});
    if (realRequest) http.request = realRequest;
    D.net.unvirtual('tests/profile/');
    assert.ok(true);
  });
})();
