// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the Swedish names, numbers and georeferencing (recommendations 2, 3 and 11 of the Praxi study, 14 and 15 of the native
 * IFC study, B3 of Boverket's report 2024:26): a storey's description and long name, a room's number and type, and set_site's
 * vertical datum land on the operation only when given and are described; the tool texts and the build text explain the numbering
 * and the compound codes with RH 2000; a new model's designations (property, building number and name, national building id, the
 * first storey's description, the header's author and organisation) map to the wheel's keys and come from the form's own section.
 * With the real Pyodide (`?python=1` or cached components) the wheel writes them in a new IFC4X3 model with the Axis context, the
 * file header and the note that a CRS is missing (GRF003), numbers the rooms, places the model with EPSG:5850, and georeferences
 * the millimetre fixture with a Plan context: the CRS in metres with RH 2000, Scale 0.001, one conversion per context, the
 * building's height and the header kept where it is another program's.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const writeTools = D.require('ai/write-tools');
  const agent = D.require('ai/agent');
  const ifcNew = D.require('data/ifc-new');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const fixtures = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const textOf = (bytes) => (typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes));
  const count = (text, needle) => text.split(needle).length - 1;
  const SITE = { latitude: 59.3293, longitude: 18.0686, elevation: 12.5, crs: 'EPSG:5850', eastings: 154000, northings: 6580822, rotation: null, site_name: null };
  const WALLS = [[[0, 0], [12, 0]], [[12, 0], [12, 8]], [[12, 8], [0, 8]], [[0, 8], [0, 0]], [[6, 0], [6, 8]]];
  const room = (o) => Object.assign({ at: null, index: null, name: 'A', long_name: null, number: null, room_type: null }, o);

  test('ai names: a storey\'s description and long name, a room\'s number and type land only when given, and the texts explain the numbering', async (assert) => {
    const storeys = writeTools.TOOLS.find((x) => x.name === 'create_storeys_and_grid');
    assert.deepEqual(storeys.parameters.properties.storeys.items.required, ['name', 'elevation', 'description', 'long_name'], 'every field of a storey is required, null for not given');
    assert.ok(/numbering for the whole project that follows their height/.test(storeys.description) && /entrance level in the description/.test(storeys.description), 'the numbering by height, the entrance in the description');
    const spaces = writeTools.TOOLS.find((x) => x.name === 'create_spaces');
    assert.ok(/number, unique in the building/.test(spaces.description) && /ObjectType with PredefinedType USERDEFINED/.test(spaces.description), 'the room number and type');
    const cs = writeTools.create('names-test');
    assert.ok(writeTools.call(cs, 'create_storeys_and_grid', { storeys: [{ name: 'Plan 1', elevation: 0, description: 'Plan 1 (Entre)', long_name: 'Bottenvaning' }, { name: 'Plan 2', elevation: 3, description: null, long_name: null }], grid: null }).ok);
    assert.deepEqual(cs.ops[0].storeys, [{ name: 'Plan 1', elevation: 0, description: 'Plan 1 (Entre)', long_name: 'Bottenvaning' }, { name: 'Plan 2', elevation: 3 }], 'only what is given lands');
    assert.ok(writeTools.describe(cs.ops[0]).includes('Plan 1 – Plan 1 (Entre)'), writeTools.describe(cs.ops[0]));
    const out = writeTools.call(cs, 'create_spaces', { storey: 'Plan 1', rooms: [room({ at: [3, 4], name: 'Kok', number: 101, room_type: 'Kok' }), room({ at: [9, 4], name: 'Vardagsrum', long_name: 'Vardagsrum med matplats', number: '102' }), room({ index: 3, name: 'Hall' })], height: null });
    assert.ok(out.ok && out.refs.length === 3, JSON.stringify(out));
    assert.deepEqual(cs.ops[1].rooms, [{ at: [3, 4], index: null, name: 'Kok', long_name: null, number: '101', room_type: 'Kok' }, { at: [9, 4], index: null, name: 'Vardagsrum', long_name: 'Vardagsrum med matplats', number: '102' }, { at: null, index: 3, name: 'Hall', long_name: null }], 'a number as text, and nothing for a room without');
    const text = writeTools.describe(cs.ops[1]);
    assert.ok(text.includes('101 Kok') && text.includes('102 Vardagsrum') && text.includes('Hall'), text);
    const twice = writeTools.call(cs, 'create_spaces', { storey: 'Plan 1', rooms: [room({ at: [1, 1], number: '201' }), room({ at: [5, 1], number: '201' })], height: null });
    assert.ok(twice.error && /201 is listed twice/.test(twice.error) && cs.ops.length === 2, 'a number twice is refused: ' + JSON.stringify(twice));
    assert.ok(/Number the storeys for the whole project by height/.test(agent.SYSTEM_BUILD) && /the storey's number and two digits \(101, 102/.test(agent.SYSTEM_BUILD), 'the build text numbers storeys and rooms');
    return 'ok';
  });

  test('ai names: set_site prefers the local SWEREF 99 zone with RH 2000 and takes a vertical datum only where the code has no heights', async (assert) => {
    const tool = writeTools.TOOLS.find((x) => x.name === 'set_site');
    assert.ok('vertical_datum' in tool.parameters.properties, 'vertical_datum is a field');
    assert.ok(/prefer the local SWEREF 99 zone with RH 2000/.test(tool.description) && /EPSG:5850 for SWEREF 99 18 00 \+ RH 2000/.test(tool.description) && /EPSG:5845/.test(tool.description) && /Never convert coordinates/.test(tool.description), 'the tool text');
    assert.ok(/EPSG:5845 for coordinates in SWEREF 99 TM/.test(agent.SYSTEM_BUILD), 'the build text takes the compound code for the facts\' SWEREF 99 TM');
    const cs = writeTools.create('names-site');
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { vertical_datum: null })).ok);
    assert.ok(!('vertical_datum' in cs.ops[0]), 'nothing when not given');
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { vertical_datum: 'RH 2000' })).ok && !('vertical_datum' in cs.ops[1]), 'RH 2000 with a code that gives it is dropped');
    const other = writeTools.call(cs, 'set_site', Object.assign({}, SITE, { vertical_datum: 'RH 70' }));
    assert.ok(other.error && other.error.includes('EPSG:3011'), 'another height system with a compound code is refused, with the plan code to give: ' + JSON.stringify(other));
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { crs: 'EPSG:3006', eastings: 674032, vertical_datum: 'RH 70' })).ok);
    assert.equal(cs.ops[2].vertical_datum, 'RH 70', 'a plan code takes it');
    assert.ok(writeTools.describe(cs.ops[2]).includes('EPSG:3006 + RH 70'), writeTools.describe(cs.ops[2]));
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { crs: null, eastings: null, northings: null, vertical_datum: 'RH 2000' })).error, 'a vertical datum needs a crs');
    return 'ok';
  });

  test('ai names: a new model\'s designations map to the wheel\'s keys, only those filled in', async (assert) => {
    assert.deepEqual(ifcNew.IDENTITY_FIELDS, ['property', 'building_number', 'building_name', 'building_id', 'storey_description', 'author', 'organization']);
    assert.deepEqual(ifcNew.identity({}), {}, 'nothing filled in, nothing sent');
    assert.deepEqual(ifcNew.identity({ property: ' Kommun  Trakt 1:23 ', site: 'Tomten', building: 'Huset', building_number: '1001' }),
      { site: 'Kommun Trakt 1:23', land_id: 'Kommun Trakt 1:23', site_long_name: 'Tomten', building: '1001', building_long_name: 'Huset' }, 'the property names the site and the number the building; what was entered becomes the long names');
    assert.deepEqual(ifcNew.identity({ property: 'Kommun Trakt 1:23', building_number: '1001', building: 'Huset', building_name: 'Hus A' }),
      { site: 'Kommun Trakt 1:23', land_id: 'Kommun Trakt 1:23', building: '1001', building_long_name: 'Hus A' }, 'the building\'s name goes before the building entered');
    assert.deepEqual(ifcNew.identity({ building_name: 'Hus A', building_id: 'a3c6e3f0-1b2c-4d5e-8f90-123456789abc', storey_description: 'Entreplan', author: 'A. Person', organization: 'Firman' }),
      { building_long_name: 'Hus A', building_id: 'a3c6e3f0-1b2c-4d5e-8f90-123456789abc', storey_description: 'Entreplan', author: 'A. Person', organization: 'Firman' }, 'the rest as entered');
    const real = bridge.runIfcNewModel;
    const calls = [];
    bridge.runIfcNewModel = async (schema, names, options) => { calls.push({ schema, names, options }); throw new Error('stopped after the call'); };
    try {
      await ifcNew.create({ name: 'Namnhus', property: 'Kommun Trakt 1:23', building_number: '1001' }).catch(() => {});
    } finally { bridge.runIfcNewModel = real; }
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].names, { project: t('newmodel.default.project'), site: 'Kommun Trakt 1:23', building: '1001', storey: t('newmodel.default.storey'), elevation: 0, land_id: 'Kommun Trakt 1:23' }, 'the wheel\'s names');
    assert.deepEqual(calls[0].options, { fileName: 'Namnhus.ifc' }, 'the file name for the header');
    return 'ok';
  });

  test('ai names: the form in Inhämta has the designations in a section of their own and sends them', async (assert) => {
    const real = bridge.runIfcNewModel;
    const calls = [];
    bridge.runIfcNewModel = async (schema, names, options) => { calls.push({ schema, names, options }); throw new Error('stopped after the call'); };
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const item = await waitFor(() => Array.from(root.querySelectorAll('.dm-list-item')).find((x) => x.textContent.includes(t('import.sources.newmodel'))), 5000, 'the source');
      item.click();
      const form = await waitFor(() => root.querySelector('[data-newmodel-form]'), 3000, 'the form');
      const section = /** @type {HTMLDetailsElement} */ (await waitFor(() => form.querySelector('[data-newmodel-identity]'), 3000, 'the section'));
      assert.ok(!section.open, 'folded while empty');
      assert.ok(section.querySelector('summary').textContent.includes(t('newmodel.identity')), 'its heading');
      for (const key of ifcNew.IDENTITY_FIELDS) assert.ok(section.querySelector(`[data-newmodel="${key}"]`), key + ' in the section');
      assert.ok(!form.querySelector('[data-newmodel="brief"]').closest('[data-newmodel-identity]'), 'the brief stays outside it');
      const set = (key, value) => { const el = /** @type {any} */ (form.querySelector(`[data-newmodel="${key}"]`)); el.value = value; el.dispatchEvent(new Event('input')); };
      set('name', 'Formularnamn'); set('property', 'Kommun Trakt 1:23'); set('building_number', '1001'); set('building_name', 'Hus A'); set('storey_description', 'Entreplan');
      /** @type {any} */ (form.querySelector('[data-newmodel-create]')).click();
      await waitFor(() => calls.length && root.querySelector('[data-newmodel-error]'), 8000, 'the call');
      assert.deepEqual(Object.assign({}, calls[0].names, { project: null }), { project: null, site: 'Kommun Trakt 1:23', building: '1001', storey: t('newmodel.default.storey'), elevation: 0, land_id: 'Kommun Trakt 1:23', building_long_name: 'Hus A', storey_description: 'Entreplan' }, JSON.stringify(calls[0].names));
      assert.ok(/** @type {HTMLDetailsElement} */ (root.querySelector('[data-newmodel-identity]')).open, 'open once filled in');
    } finally {
      bridge.runIfcNewModel = real;
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 30000);

  test('ai names: Python writes the designations, the Axis context and the header in a new IFC4X3 model, numbers the rooms and places it with EPSG:5850', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const { dataset, info } = await ifcNew.create({ name: 'Namnprov', schema: 'IFC4X3_ADD2', site: 'Tomten', property: 'Kommun Trakt 1:23', building_number: '1001', building_name: 'Hus A',
      building_id: 'a3c6e3f0-1b2c-4d5e-8f90-123456789abc', storey: 'Plan 1', storey_description: 'Plan 1 (Entreplan)' });
    created.push(dataset.id);
    assert.equal(info.errors, 0, JSON.stringify(info.findings));
    assert.ok((info.notes || []).some((n) => String(n).startsWith('GRF003')), 'the note that no CRS is set: ' + JSON.stringify(info.notes));
    const text = textOf((await D.require('data/model').original(dataset.id)).bytes);
    assert.ok(text.includes("FILE_DESCRIPTION(('ViewDefinition [notYetAssigned]'),'2;1');"), 'no official view fits a full IFC4X3 model: ' + text.slice(0, 300));
    const name = /FILE_NAME\('([^']*)','([^']*)',\(([^)]*)\),\(([^)]*)\),'([^']*)','([^']*)','([^']*)'\);/.exec(text);
    assert.ok(name, 'FILE_NAME');
    assert.equal(name[1], 'Namnprov.ifc', 'the file name');
    assert.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/.test(name[2]), 'the time in ISO 8601: ' + name[2]);
    assert.deepEqual([name[3], name[4], name[7]], ["''", "''", ''], 'no author, organisation or authorisation unless entered');
    assert.ok(name[5].startsWith('Dataspatium ' + D.version + ' (IfcOpenShell '), 'the preprocessor: ' + name[5]);
    assert.equal(name[6], 'Dataspatium - Dataspatium - ' + D.version, 'the originating system in the form the validation service reads');
    assert.ok(/IFCSITE\('[^']*',\$,'Kommun Trakt 1:23',\$,\$,#\d+,\$,'Tomten',/.test(text), 'the site named after the property, with its long name');
    assert.ok(text.includes("'Pset_LandRegistration'") && text.includes("IFCPROPERTYSINGLEVALUE('LandID',$,IFCIDENTIFIER('Kommun Trakt 1:23'),$)"), 'the land id');
    assert.ok(/IFCBUILDING\('[^']*',\$,'1001',\$,\$,#\d+,\$,'Hus A',/.test(text), 'the building number and name');
    assert.ok(text.includes("IFCPROPERTYSINGLEVALUE('BuildingID',$,IFCIDENTIFIER('a3c6e3f0-1b2c-4d5e-8f90-123456789abc'),$)") && text.includes("IFCPROPERTYSINGLEVALUE('IsPermanentID',$,IFCBOOLEAN(.T.),$)"), 'the national building id, permanent');
    assert.ok(/IFCBUILDINGSTOREY\('[^']*',\$,'Plan 1','Plan 1 \(Entreplan\)',/.test(text), 'the first storey\'s description');
    assert.ok(/IFCGEOMETRICREPRESENTATIONSUBCONTEXT\('Axis','Model',\*,\*,\*,\*,#\d+,\$,\.GRAPH_VIEW\.,\$\)/.test(text), 'the Axis context from the start');
    // Storeys, a box with an inner wall, numbered rooms and the place on earth in one change set.
    const cs = writeTools.create(dataset.id);
    const steps = [['create_storeys_and_grid', { storeys: [{ name: 'Plan 1', elevation: 0, description: null, long_name: 'Bottenvaning' }, { name: 'Plan 2', elevation: 3, description: 'Plan 2', long_name: null }], grid: null }]];
    for (const [start, end] of WALLS) steps.push(['create_wall', { storey: 'Plan 1', start, end, thickness: 0.2, height: 3, name: null, type: null, partition: null }]);
    steps.push(['create_spaces', { storey: 'Plan 1', rooms: [room({ at: [3, 4], name: 'Kok', number: '101', room_type: 'Kok' }), room({ at: [9, 4], name: 'Vardagsrum', long_name: 'Vardagsrum med matplats', number: '102' })], height: null }]);
    for (const [tool, args] of steps) assert.ok(writeTools.call(cs, tool, args).ok, tool);
    const before = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
    assert.equal(before.report.errors, 0, JSON.stringify(before.report.findings));
    assert.ok((before.report.notes || []).some((n) => String(n).startsWith('GRF003')), 'without set_site the report notes the missing CRS');
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { vertical_datum: null })).ok);
    const res = await ifcOps.previewChangeset(dataset.id, writeTools.toWheel(cs));
    const report = res.report;
    assert.equal(report.errors, 0, 'no errors: ' + JSON.stringify(report.findings));
    assert.ok(!(report.notes || []).some((n) => String(n).startsWith('GRF003')), 'the CRS is set: ' + JSON.stringify(report.notes));
    const out = textOf(res.bytes);
    assert.ok(/IFCSPACE\('[^']*',\$,'101',\$,'Kok',#\d+,#\d+,'Kok',\.ELEMENT\.,\.USERDEFINED\.,/.test(out), 'room 101: the number, its type as ObjectType with USERDEFINED, the name as LongName');
    assert.ok(/IFCSPACE\('[^']*',\$,'102','Vardagsrum med matplats',\$,#\d+,#\d+,'Vardagsrum',\.ELEMENT\.,\.SPACE\.,/.test(out), 'room 102: the long name as its description');
    assert.ok(/IFCBUILDINGSTOREY\('[^']*',\$,'Plan 1','Plan 1 \(Entreplan\)',\$,#\d+,\$,'Bottenvaning',/.test(out) && /IFCBUILDINGSTOREY\('[^']*',\$,'Plan 2','Plan 2',/.test(out), 'the storeys\' texts, also on the one that existed');
    assert.ok(out.includes("IFCPROJECTEDCRS('EPSG:5850','SWEREF 99 18 00 + RH 2000','SWEREF99',$,'Transverse Mercator','18 00',#"), 'the compound code in plain words, no separate vertical datum');
    assert.equal(count(out, 'IFCMAPCONVERSION('), 1, 'one parent context, one conversion');
    assert.ok(/IFCMAPCONVERSION\(#\d+,#\d+,154000\.,6580822\.,12\.5,1\.,0\.,1\.\);/.test(out), 'the conversion in metres with Scale 1 and the height above RH 2000: ' + (out.match(/IFCMAPCONVERSION\([^;]*;/) || [''])[0]);
    assert.ok(!/IFCBUILDING\([^;]*,12\.5,/.test(out), 'no ElevationOfRefHeight in IFC4X3 (IFC102)');
    return 'ok';
  }, 900000);

  test('ai names: Python georeferences the millimetre fixture with a Plan context: CRS in metres with RH 2000, Scale 0.001, a conversion per context, the building\'s height, and the header kept', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    // The fixture (IFC4, millimetres, another program's header) with a second parent context, a 2D plan.
    const base = fixtures.ifcText({ walls: 2 });
    const world = /IFCGEOMETRICREPRESENTATIONCONTEXT\(\$,'Model',3,1\.E-05,#(\d+),\$\)/.exec(base);
    assert.ok(world, 'the fixture\'s model context');
    const text = base.replace('ENDSEC;\nEND-ISO-10303-21;', `#9000=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',2,1.E-05,#${world[1]},$);\nENDSEC;\nEND-ISO-10303-21;`);
    assert.ok(text.includes('#9000=IFCGEOMETRICREPRESENTATIONCONTEXT'), 'the plan context added');
    const meta = await importer.run(new File([text], 'plan-context.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Namnprov mm');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const cs = writeTools.create(meta.id);
    assert.ok(writeTools.call(cs, 'set_site', Object.assign({}, SITE, { crs: 'EPSG:3006', eastings: 674032, vertical_datum: null })).ok);
    const res = await ifcOps.previewChangeset(meta.id, writeTools.toWheel(cs));
    assert.equal(res.report.errors, 0, 'no errors: ' + JSON.stringify(res.report.findings));
    const out = textOf(res.bytes);
    const crs = /#(\d+)=IFCPROJECTEDCRS\('EPSG:3006','SWEREF 99 TM \+ RH 2000','SWEREF99','RH 2000','Transverse Mercator','TM',#(\d+)\);/.exec(out);
    assert.ok(crs, 'the CRS with its description and RH 2000 as the vertical datum: ' + (out.match(/IFCPROJECTEDCRS\([^;]*;/) || [''])[0]);
    assert.ok(new RegExp(`#${crs[2]}=IFCSIUNIT\\(\\*,\\.LENGTHUNIT\\.,\\$,\\.METRE\\.\\);`).test(out), 'the map unit is the metre, not the file\'s millimetre (GRF005)');
    const conversions = Array.from(out.matchAll(/IFCMAPCONVERSION\(#(\d+),#(\d+),([^,]+),([^,]+),([^,]+),[^,]+,[^,]+,([^,)]+)\)/g));
    assert.equal(conversions.length, 2, 'one conversion per parent context (GRF001)');
    const model = /#(\d+)=IFCGEOMETRICREPRESENTATIONCONTEXT\(\$,'Model'/.exec(out);
    assert.deepEqual(conversions.map((m) => m[1]).sort(), [model ? model[1] : '', '9000'].sort(), 'from the model and the plan context');
    assert.ok(conversions.every((m) => m[2] === crs[1] && m[3] === '674032.' && m[4] === '6580822.' && m[5] === '12.5' && m[6] === '0.001'), 'the same values in metres, Scale the millimetre: ' + JSON.stringify(conversions.map((m) => m.slice(1))));
    assert.ok(/IFCBUILDING\('[^']*',#\d+,'Testhuset',\$,\$,#\d+,\$,\$,\.ELEMENT\.,12500\.,/.test(out), 'IFC4: the building\'s height above the sea in ElevationOfRefHeight, in millimetres');
    assert.ok(out.includes("FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');"), 'IFC4\'s view replaces one the validation service does not accept');
    const name = /FILE_NAME\('([^']*)','[^']*',\(([^)]*)\),\(([^)]*)\),'([^']*)','([^']*)','([^']*)'\);/.exec(out);
    assert.ok(name && name[1] === 'plan-context.ifc' && name[2] === "'Testare'" && name[3] === "'Testbolaget'" && name[5] === 'Testprogram 1.0', 'the file\'s own author, organisation and originating system are kept: ' + (name ? name.join(' | ') : ''));
    assert.ok(name && name[4].startsWith('Dataspatium '), 'the preprocessor is the app');
    return 'ok';
  }, 900000);

  test('ai names: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
