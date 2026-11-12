// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the preliminary climate declaration (analysis/climate, api/klimatdatabas, ui/analysis/climate-panel), with the
 * network stubbed: the rules on known elements (category, layer, provisional categories that still count), IsExternal derived
 * from the topology and from the wall a door or window sits in, parts and the person's settlement, the quantities from the
 * quantity sets, the extrusions (rectangle, polyline, circle, I-shape through a mapped item, a tilted roof), a door's size or
 * none, the proposals by IfcMaterial.Category and by name, GWP summed per post, category and layer, the database fetched only
 * on the button through the preset (a virtual address here) and refused without consent for the real host, and the tool in
 * Analysera. Own test data only: the IFC is written here and the database's values are made up in Boverket's form.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const climate = D.require('analysis/climate');
  const klimatdb = D.require('api/klimatdatabas');
  const connectors = D.require('api/connectors');
  const consent = D.require('platform/consent');
  const imports = D.require('io/import');
  const model = D.require('data/model');
  const datasets = D.require('data/datasets');
  const idb = D.require('platform/storage/idb');
  const BASE = 'dataspatium-asset://tests/klimat';
  const KEYS = ['klimat:databas', 'klimat:resurser', 'klimat:kategorier'];
  const created = [];
  const saved = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const near = (a, b, tol = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= tol;

  /** A small IFC4 building in millimetres, written for these tests; nothing comes from a real project. */
  function ifcText() {
    const lines = []; let next = 100; let g = 1;
    const add = (text) => { const id = next++; lines.push(`#${id}=${text};`); return id; };
    const G = () => ('0Klimat' + String(g++).padStart(15, '0')).slice(0, 22);
    const num = (v) => (Number.isInteger(v) ? v + '.' : String(v));
    const units = add(`IFCUNITASSIGNMENT((#${add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')},#${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},#${add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')}))`);
    const origin = add('IFCCARTESIANPOINT((0.,0.,0.))');
    const zDir = add('IFCDIRECTION((0.,0.,1.))');
    const world = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${add('IFCDIRECTION((1.,0.,0.))')})`);
    const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${world},$)`);
    const body = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${context},$,.MODEL_VIEW.,$)`);
    const project = add(`IFCPROJECT('${G()}',$,'Klimatprojekt',$,$,$,$,(#${context}),#${units})`);
    const place = add(`IFCLOCALPLACEMENT($,#${world})`);
    const site = add(`IFCSITE('${G()}',$,'Tomten',$,$,#${place},$,$,.ELEMENT.,$,$,$,$,$)`);
    const building = add(`IFCBUILDING('${G()}',$,'Klimathuset',$,$,#${place},$,$,.ELEMENT.,$,$,$)`);
    const storey = add(`IFCBUILDINGSTOREY('${G()}',$,'Plan 1',$,$,#${place},$,$,.ELEMENT.,0.)`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${project},(#${site}))`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${site},(#${building}))`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${building},(#${storey}))`);
    const p2 = add(`IFCAXIS2PLACEMENT2D(#${add('IFCCARTESIANPOINT((0.,0.))')},$)`);
    const rep = (kind, items) => add(`IFCSHAPEREPRESENTATION(#${body},'Body','${kind}',(${items.map((i) => '#' + i).join(',')}))`);
    const shape = (...items) => add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep('SweptSolid', items)}))`);
    const extrude = (profile, depth, dir) => add(`IFCEXTRUDEDAREASOLID(#${profile},#${world},#${dir || zDir},${num(depth)})`);
    const rect = (x, y) => add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${p2},${num(x)},${num(y)})`);
    const el = (cls, name, shapeId, extra) => add(`${cls}('${G()}',$,'${name}',$,$,#${place},${shapeId ? '#' + shapeId : '$'},$${extra ? ',' + extra : ''})`);
    const pset = (name, props, on) => add(`IFCRELDEFINESBYPROPERTIES('${G()}',$,$,$,(#${on}),#${add(`IFCPROPERTYSET('${G()}',$,'${name}',$,(${props.map(([n, v]) => '#' + add(`IFCPROPERTYSINGLEVALUE('${n}',$,IFCBOOLEAN(.${v ? 'T' : 'F'}.),$)`)).join(',')}))`)})`);
    const material = (name, category) => add(`IFCMATERIAL('${name}',$,'${category}')`);
    const associate = (on, mat) => add(`IFCRELASSOCIATESMATERIAL('${G()}',$,$,$,(#${on}),#${mat})`);
    const opening = (host) => { const o = add(`IFCOPENINGELEMENT('${G()}',$,'Öppning',$,$,#${place},$,$,.OPENING.)`); add(`IFCRELVOIDSELEMENT('${G()}',$,$,$,#${host},#${o})`); return o; };
    const fill = (o, filler) => add(`IFCRELFILLSELEMENT('${G()}',$,$,$,#${o},#${filler})`);

    const betong = material('Betong', 'concrete');
    const ull = material('Mineralull', 'insulation');
    // The external wall: properties and quantities in the file, two layers.
    const outer = el('IFCWALL', 'Yttervägg', shape(extrude(rect(4000, 200), 2500)), '.SOLIDWALL.');
    pset('Pset_WallCommon', [['IsExternal', true], ['LoadBearing', true]], outer);
    add(`IFCRELDEFINESBYPROPERTIES('${G()}',$,$,$,(#${outer}),#${add(`IFCELEMENTQUANTITY('${G()}',$,'Qto_WallBaseQuantities',$,$,(#${add("IFCQUANTITYAREA('NetSideArea',$,$,10.,$)")},#${add("IFCQUANTITYVOLUME('NetVolume',$,$,2.,$)")}))`)})`);
    const layers = add(`IFCMATERIALLAYERSET((#${add(`IFCMATERIALLAYER(#${betong},150.,$,'Stomme',$,'LoadBearing',$)`)},#${add(`IFCMATERIALLAYER(#${ull},50.,$,'Isolering',$,'Insulation',$)`)}),'Yttervägg 200',$)`);
    associate(outer, add(`IFCMATERIALLAYERSETUSAGE(#${layers},.AXIS2.,.POSITIVE.,0.,$)`));
    // An internal wall without LoadBearing: its volume comes from the extrusion.
    const inner = el('IFCWALL', 'Innervägg', shape(extrude(rect(3000, 100), 2500)), '.SOLIDWALL.');
    pset('Pset_WallCommon', [['IsExternal', false]], inner);
    associate(inner, material('Gips', 'gypsum'));
    // A door in the internal wall and a window in the external one, neither with IsExternal.
    const door = el('IFCDOOR', 'Dörr', null, '2100.,900.,.DOOR.,$,$');
    fill(opening(inner), door);
    add(`IFCRELDEFINESBYTYPE('${G()}',$,$,$,(#${door}),#${add(`IFCDOORTYPE('${G()}',$,'Innerdörr 9x21',$,$,$,$,$,$,.DOOR.,.SINGLE_SWING_LEFT.,$,$)`)})`);
    const windowEl = el('IFCWINDOW', 'Fönster', null, '1200.,1000.,.WINDOW.,$,$');
    fill(opening(outer), windowEl);
    // The base slab: an L-shaped polyline, 24 m², 300 mm thick.
    const points = [[0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 5000], [0, 5000], [0, 0]].map(([x, y]) => '#' + add(`IFCCARTESIANPOINT((${num(x)},${num(y)}))`));
    const lshape = add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${add(`IFCPOLYLINE((${points.join(',')}))`)})`);
    const slab = el('IFCSLAB', 'Platta', shape(extrude(lshape, 300)), '.BASESLAB.');
    associate(slab, betong);
    // The roof: a container with a tilted roof slab 200 mm thick over 20 m².
    const roofSlab = el('IFCSLAB', 'Takplatta', shape(extrude(rect(4000, 5000), 250, add('IFCDIRECTION((0.,0.6,0.8))'))), '.ROOF.');
    const roof = el('IFCROOF', 'Tak', null, '.GABLE_ROOF.');
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${roof},(#${roofSlab}))`);
    // A column, round, 300 mm across and 3 m tall, of a material only its category names.
    const column = el('IFCCOLUMN', 'Pelare', shape(extrude(add(`IFCCIRCLEPROFILEDEF(.AREA.,$,#${p2},150.)`), 3000)), '.COLUMN.');
    associate(column, material('Pelarmaterial', 'concrete'));
    // A beam drawn through its type's representation map: an I-profile 200 × 400, web 10, flanges 20, 5 m long.
    const ishape = add(`IFCISHAPEPROFILEDEF(.AREA.,$,#${p2},200.,400.,10.,20.,$,$,$)`);
    const map = add(`IFCREPRESENTATIONMAP(#${world},#${rep('SweptSolid', [extrude(ishape, 5000)])})`);
    const beamType = add(`IFCBEAMTYPE('${G()}',$,'Balktyp HEA',$,$,$,(#${map}),$,$,.BEAM.)`);
    const mapped = add(`IFCMAPPEDITEM(#${map},#${add(`IFCCARTESIANTRANSFORMATIONOPERATOR3D($,$,#${origin},1.,$)`)})`);
    const beam = el('IFCBEAM', 'Balk', add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep('MappedRepresentation', [mapped])}))`), '.BEAM.');
    add(`IFCRELDEFINESBYTYPE('${G()}',$,$,$,(#${beam}),#${beamType})`);
    // What is not included, and what the rules cannot decide.
    const others = [el('IFCPILE', 'Påle', null, '.DRIVEN.,$'), el('IFCFURNITURE', 'Skåp', null, '.NOTDEFINED.'), el('IFCPIPESEGMENT', 'Rör', null, '.RIGIDSEGMENT.'),
      el('IFCCOVERING', 'Parkett', null, '.FLOORING.'), el('IFCBUILDINGELEMENTPROXY', 'Okänd', null, '.NOTDEFINED.')];
    const all = [outer, inner, door, windowEl, slab, roofSlab, roof, column, beam].concat(others);
    add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${G()}',$,$,$,(${all.map((x) => '#' + x).join(',')}),#${storey})`);
    const head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
      "FILE_NAME('klimathus.ifc','2026-11-12T12:00:00',('Testare'),('Testbolaget'),'Testverktyg','Testprogram 1.0','');", "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;'];
    return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
  }

  /** Made-up resources in the form of Boverket's database: GWP-GHG per module, conversions and Boverket's own categories. */
  function database() {
    const values = (typical, conservative, a4, a5) => [{ DataModuleCode: 'A1-A3 Typical', Value: typical }, { DataModuleCode: 'A1-A3 Conservative', Value: conservative }]
      .concat(a4 === undefined ? [] : [{ DataModuleCode: 'A4', Value: a4 }, { DataModuleCode: 'A5.1', Value: a5 }]);
    const resource = (id, sv, en, unit, conversion, category, gwp, synonyms) => ({ ResourceId: id, Name: sv, Names: { SV: sv, EN: en }, InventoryUnit: unit, Conversions: conversion ? [conversion] : null,
      WasteFactor: 1.05, Synonyms: synonyms || '', Categories: [{ ClassificationType: 'Boverket', Code: category[0], Text: category[1] }], DataItems: [{ PropertyCode: 'GWP-GHG AR4', PropertyUnitCode: 'kg CO2 eq./' + unit, DataValueItems: gwp }] });
    const volume = (v) => ({ Field: 'Volume', Unit: 'kg/m³', Value: v });
    const area = (v) => ({ Field: 'Area', Unit: 'kg/m²', Value: v });
    return { Location: 'SE', Culture: 'sv-se', Publisher: 'Test', Version: '09.09.000', PublishedDate: '2026-01-01T00:00:00Z', Resources: [
      resource(9000000001, 'Fabriksbetong, prov C25/30', 'Ready-mix concrete, test C25/30', 'kg', volume(2400), ['6', 'Betong'], values(0.1, 0.125, 0.005, 0.004)),
      resource(9000000002, 'Betongtakpannor, prov', 'Concrete roof tiles, test', 'kg', volume(2400), ['9', 'Murblock och tegel'], values(0.2, 0.25, 0.06, 0.01)),
      resource(9000000003, 'Glasull, prov', 'Glass wool, test', 'kg', volume(20), ['7', 'Isolering'], values(1, 1.25, 0.04, 0.08), 'Isolering'),
      resource(9000000004, 'Fenolbaserad isolering, prov', 'Phenolic thermal insulation, test', 'kg', volume(40), ['7', 'Isolering'], values(3, 3.75, 0.04, 0.2)),
      resource(9000000005, 'Gipsskiva, prov', 'Gypsum, plasterboard, test', 'kg', volume(700), ['10', 'Byggskivor'], values(0.2, 0.25, 0.03, 0.04)),
      resource(9000000006, 'Innerdörr utan glas, prov', 'Interior door, test', 'kg', area(20), ['4', 'Fönster, dörrar och glas'], values(1.6, 2, 0.05, 0)),
      resource(9000000007, 'Fönster, trä, prov', 'Window, wood, test', 'kg', area(40), ['4', 'Fönster, dörrar och glas'], values(2, 2.5, 0.05, 0)),
      resource(9000000008, 'Elektricitet, prov', 'Electricity, test', 'kWh', null, ['3', 'Energi och bränsle'], values(0.04, 0.04)),
    ] };
  }

  /** The virtual Boverket: the latest version and every resource, counted per call. */
  const served = { latest: 0, resources: 0 };
  D.net.virtual('tests/klimat/', (url) => {
    const p = String(url).slice(BASE.length).split('?')[0];
    if (p === '/api/Klimat/v2/GetLatestVersion/sv/json') { served.latest++; return Promise.resolve({ kind: 'text', data: JSON.stringify({ Version: '09.09.000' }) }); }
    if (p === '/api/Klimat/v2/GetAllResources/09.09.000/sv/json') { served.resources++; return Promise.resolve({ kind: 'text', data: JSON.stringify(database()) }); }
    return Promise.resolve({ kind: 'text', data: '{"Message":"Not Found"}', status: 404 });
  });
  async function virtualConnector() {
    const preset = await connectors.get(klimatdb.CONNECTOR);
    return Object.assign({}, preset, { id: 'test-klimatdatabas', baseUrl: BASE });
  }
  let modelMeta = null;
  async function modelDataset() {
    if (!modelMeta) {
      modelMeta = await imports.run(new File([ifcText()], 'klimathus.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Klimathuset');
      created.push(modelMeta.id);
    }
    return modelMeta;
  }

  test('climate: setup keeps the person\'s own database and choices', async () => {
    for (const key of KEYS) saved[key] = await idb.getSetting(key, null);
    for (const key of KEYS) await idb.deleteSetting(key);
    return 'ok';
  });

  test('climate: the rule table decides category and layer on known elements, and a missing LoadBearing keeps a wall in the declaration', async (assert) => {
    const c = (cls, extra) => { const r = climate.classify(Object.assign({ cls }, extra || {})); return [r.category, r.layer, r.uncertain, r.rule]; };
    assert.deepEqual(c('IfcFooting'), ['grund', 1, false, 'footing']);
    assert.deepEqual(c('IfcPile'), ['ingar_inte', 1, false, 'pile'], 'piles are not included');
    assert.deepEqual(c('IfcSlab', { predefined: 'BASESLAB' }), ['grund', 1, false, 'slab-base']);
    assert.deepEqual(c('IfcSlab', { predefined: 'FLOOR' }), ['barande', 2, false, 'floor']);
    assert.deepEqual(c('IfcSlab', { predefined: 'ROOF' }), ['skarm', 3, false, 'slab-roof']);
    assert.deepEqual(c('IfcSlab', { predefined: 'FLOOR', loadBearing: false }), ['inner', 5, true, 'floor-notbearing'], 'a floor that is not load-bearing counts, uncertain');
    assert.deepEqual(c('IfcWallStandardCase', { external: true, loadBearing: true }), ['skarm', 3, false, 'wall-external'], 'an external wall is envelope whether or not it bears');
    assert.deepEqual(c('IfcWall', { external: true }), ['skarm', 3, false, 'wall-external'], 'also without LoadBearing');
    assert.deepEqual(c('IfcWall', { external: false, loadBearing: true }), ['barande', 2, false, 'wall-internal-bearing']);
    assert.deepEqual(c('IfcWall', { external: false, loadBearing: false }), ['inner', 5, false, 'wall-internal']);
    assert.deepEqual(c('IfcWall', { external: false }), ['inner', 5, true, 'wall-internal-unknown'], 'an internal wall without LoadBearing counts, uncertain');
    assert.deepEqual(c('IfcWall', { loadBearing: true }), ['barande', 2, true, 'wall-bearing-unknown']);
    assert.deepEqual(c('IfcWall'), ['inner', 5, true, 'wall-unknown']);
    assert.deepEqual(c('IfcWall', { predefined: 'PARTITIONING' }), ['inner', 5, false, 'partition']);
    assert.deepEqual(c('IfcWall', { predefined: 'MOVABLE', external: false }), ['ingar_inte', 5, false, 'wall-movable'], 'a movable wall is not included');
    assert.deepEqual(c('IfcWindow'), ['skarm', 3, true, 'window']);
    assert.deepEqual(c('IfcDoor', { external: true }), ['skarm', 3, false, 'door-external']);
    assert.deepEqual(c('IfcDoor'), ['inner', 5, true, 'door'], 'a door without IsExternal counts, uncertain');
    assert.deepEqual(c('IfcCovering', { predefined: 'CEILING' }), ['inner', 5, false, 'covering-ceiling'], 'ceilings belong to interior walls');
    assert.deepEqual(c('IfcCovering', { predefined: 'FLOORING' }), ['ingar_inte', 5, false, 'covering-finish'], 'interior surface layers are not included');
    assert.deepEqual(c('IfcRailing'), ['barande', 2, false, 'railing'], 'railings of stairs and balconies are load-bearing parts');
    assert.deepEqual(c('IfcMember', { predefined: 'MULLION' }), ['skarm', 3, false, 'member-mullion']);
    assert.deepEqual(c('IfcFurniture'), ['ingar_inte', 6, false, 'furnishing']);
    assert.deepEqual(c('IfcPipeSegment'), ['ingar_inte', 4, false, 'services']);
    assert.deepEqual(c('IfcSpaceHeatEr'), ['ingar_inte', 4, false, 'services'], 'the class as the STEP reader spells it');
    assert.deepEqual(c('IfcShadingDevice'), ['ingar_inte', 3, false, 'shading']);
    assert.deepEqual(c('IfcSolarDevice'), ['oklar', null, false, 'solar'], 'solar cells wait for the person');
    assert.deepEqual(c('IfcBuildingElementProxy'), ['oklar', null, false, 'proxy']);
    assert.deepEqual(c('IfcSomethingNew'), ['oklar', null, false, 'unknown']);
    assert.equal(climate.predefinedOf('NOTDEFINED', 'BASESLAB'), 'BASESLAB', 'the type\'s PredefinedType goes first');
    assert.equal(climate.predefinedOf('FLOOR', null), 'FLOOR');
    assert.equal(climate.predefinedOf('USERDEFINED', 'NOTDEFINED'), 'USERDEFINED');
    for (const r of climate.RULES) assert.ok(climate.CATEGORIES.includes(r.category) && (r.layer === null || climate.LAYERS.includes(r.layer)) && (!r.uncertain || !!r.reason), 'rule ' + r.id);
    assert.ok(climate.RULES.filter((r) => r.uncertain).every((r) => climate.DECLARED.includes(r.category)), 'a provisional category is always a declared one');
    const text = climate.classify({ cls: 'IfcWall', external: false }).text;
    assert.ok(text.includes('IsExternal = false') && text.includes(t('climate.reason.bearing')), text);
    assert.deepEqual([true, 'T', '.F.', 'false', null, 'x'].map(climate.bool), [true, true, false, false, null, null]);
    return 'ok';
  });

  test('climate: IsExternal from the topology and from the wall a door sits in, parts take their whole, and the person\'s settlement wins', async (assert) => {
    const derived = climate.externalFromTopology([{ closed: true, external: [{ wall: 10 }], rooms: [{ walls: [10, 11] }] }, { closed: false, external: [{ wall: 20 }], rooms: [{ walls: [20, 21] }] }]);
    assert.deepEqual(Array.from(derived.entries()), [[10, true], [11, false], [20, true]], 'outer walls are external; the others only on a closed storey');
    const raw = (id, cls, extra) => Object.assign({ id, guid: 'g' + id, typ: cls, cls, namn: cls, vaning: 'Plan 1', typnamn: null, predefined: null, external: null, loadBearing: null, parent: null, host: null }, extra || {});
    const data = { elements: [raw(10, 'IfcWall'), raw(11, 'IfcWall'), raw(12, 'IfcWindow', { host: 10 }), raw(13, 'IfcDoor', { host: 11 }), raw(14, 'IfcBuildingElementPart', { parent: 15 }), raw(15, 'IfcFooting'), raw(16, 'IfcWall', { external: false })],
      posts: [{ id: 16, key: 'm:gips' }] };
    const out = climate.decide(data, { derived, settled: { g16: 'barande' } });
    const by = new Map(out.elements.map((e) => [e.id, e]));
    assert.deepEqual([by.get(10).category, by.get(10).externalFrom, by.get(10).uncertain], ['skarm', 'topology', false]);
    assert.ok(by.get(10).ruleText.includes(t('climate.derived.topology')), 'the rule says the value is derived: ' + by.get(10).ruleText);
    assert.deepEqual([by.get(11).category, by.get(11).uncertain], ['inner', true], 'internal from the topology, LoadBearing still unknown');
    assert.deepEqual([by.get(12).category, by.get(12).externalFrom], ['skarm', 'host'], 'the window takes its wall\'s value');
    assert.deepEqual([by.get(13).category, by.get(13).externalFrom], ['inner', 'host'], 'and so does the door');
    assert.deepEqual([by.get(14).category, by.get(14).rule], ['grund', 'part'], 'a part takes the decision of its whole');
    assert.deepEqual([by.get(16).category, by.get(16).layer, by.get(16).rule, by.get(16).ruled.category], ['barande', 2, 'person', 'inner'], 'the person\'s settlement wins and the rule is kept');
    assert.equal(out.posts[0].category, 'barande', 'posts follow their element');
    assert.equal(data.elements[0].external, null, 'gather\'s data is not changed');
    const groups = climate.settleGroups(out.elements, { g16: 'barande' });
    assert.ok(groups.some((g) => g.guids.includes('g16') && g.choice === 'barande') && groups.some((g) => g.guids.includes('g11') && g.uncertain), JSON.stringify(groups.map((g) => [g.label, g.count, g.choice])));
    assert.ok(!groups.some((g) => g.guids.includes('g10')), 'decided elements are not listed');
    return 'ok';
  });

  test('climate: quantities from the quantity sets, else the extrusion, else a door\'s size, else none; layers by thickness', async (assert) => {
    const q = climate.quantitiesOf('IfcWall', [['NetFootprintArea', 0.8, 'area'], ['NetSideArea', 10, 'area'], ['GrossVolume', 2.2, 'volym'], ['NetVolume', 2, 'volym']], null);
    assert.deepEqual([q.volume, q.area, q.sources], [2, 10, { volume: 'qto', area: 'qto' }], 'net before gross, the side area of a wall');
    const posts = climate.postsOf({ cls: 'IfcWall', typnamn: 'Yttervägg 200' }, q, { kind: 'layers', items: [['Betong', 0.15, null, 'LoadBearing', 'concrete'], ['Mineralull', 0.05, null, 'Insulation', 'insulation']] });
    assert.deepEqual(posts.map((p) => [p.key, p.thickness, Math.round(p.volume * 1e6) / 1e6, p.area, p.materialCategory]), [['m:betong', 0.15, 1.5, 10, 'concrete'], ['m:mineralull', 0.05, 0.5, 10, 'insulation']]);
    const x = climate.quantitiesOf('IfcSlab', [], { volume: 5.4, clipped: true, openings: 2 });
    assert.deepEqual([x.volume, x.sources.volume, x.notes.length], [5.4, 'extrusion', 2], 'from the extrusion, with what it does not deduct');
    const d = climate.quantitiesOf('IfcDoor', [], { volume: null, overall: [2.1, 0.9] });
    assert.ok(near(d.area, 1.89) && d.sources.area === 'overall', 'from the door\'s size');
    assert.deepEqual(climate.postsOf({ cls: 'IfcDoor', typnamn: 'Innerdörr 9x21' }, d, null).map((p) => [p.key, p.name]), [['t:innerdörr 9x21', 'Innerdörr 9x21']], 'a door is one post keyed by its type');
    const none = climate.quantitiesOf('IfcBeam', [], { volume: null });
    assert.deepEqual([none.volume, none.area, none.mass], [null, null, null], 'otherwise none');

    // The same from a model dataset and its file.
    const meta = await modelDataset();
    const data = await climate.gather(meta.id);
    assert.ok(data.hasFile, 'the file is read');
    assert.equal(data.containers, 1, 'the roof is counted in its slab');
    assert.equal(data.elements.length, 14, 'every building element');
    const el = (name) => data.elements.find((e) => e.namn === name);
    const post = (name, key) => data.posts.find((p) => p.namn === name && (!key || p.key === key));
    assert.deepEqual([el('Yttervägg').external, el('Yttervägg').loadBearing, el('Innervägg').external, el('Innervägg').loadBearing], [true, true, false, null], 'the properties as given');
    assert.deepEqual([el('Platta').predefined, el('Dörr').predefined, el('Balk').predefined], ['BASESLAB', 'DOOR', 'BEAM'], 'PredefinedType read from the file');
    assert.equal(el('Dörr').host, el('Innervägg').id, 'the door sits in the internal wall');
    assert.equal(el('Fönster').host, el('Yttervägg').id, 'the window in the external wall');
    assert.equal(el('Takplatta').parent, el('Tak').id, 'the roof slab is part of the roof');
    assert.ok(near(post('Yttervägg', 'm:betong').volume, 1.5) && near(post('Yttervägg', 'm:mineralull').volume, 0.5) && post('Yttervägg', 'm:betong').sources.volume === 'qto', 'layers from the quantity sets');
    assert.equal(post('Yttervägg', 'm:betong').materialCategory, 'concrete', 'IfcMaterial.Category read');
    assert.ok(near(post('Innervägg').volume, 0.75) && post('Innervägg').sources.volume === 'extrusion', 'rectangle × depth: ' + post('Innervägg').volume);
    assert.ok(near(post('Platta').volume, 7.2), 'polyline × depth: ' + post('Platta').volume);
    assert.ok(near(post('Takplatta').volume, 4), 'a tilted extrusion counts its thickness: ' + post('Takplatta').volume);
    assert.ok(near(post('Pelare').volume, Math.PI * 0.15 * 0.15 * 3), 'circle × depth: ' + post('Pelare').volume);
    assert.ok(near(post('Balk').volume, 0.0116 * 5) && post('Balk').key === 't:balktyp hea', 'an I-profile through a mapped item: ' + post('Balk').volume);
    assert.ok(near(post('Dörr').area, 1.89) && post('Dörr').sources.area === 'overall' && near(post('Fönster').area, 1.2), 'doors and windows from their size');
    assert.ok(!post('Tak'), 'no post for the container');
    for (const name of ['Påle', 'Skåp', 'Rör', 'Parkett', 'Okänd']) assert.ok(post(name) && post(name).volume === null && post(name).area === null, name + ' has no quantity');
    const decided = climate.decide(data);
    const cat = (name) => { const e = decided.elements.find((x) => x.namn === name); return [e.category, e.layer, e.uncertain, e.externalFrom]; };
    assert.deepEqual(cat('Yttervägg'), ['skarm', 3, false, null]);
    assert.deepEqual(cat('Innervägg'), ['inner', 5, true, null]);
    assert.deepEqual(cat('Dörr'), ['inner', 5, false, 'host']);
    assert.deepEqual(cat('Fönster'), ['skarm', 3, false, 'host']);
    assert.deepEqual(cat('Platta'), ['grund', 1, false, null]);
    assert.deepEqual(cat('Takplatta'), ['skarm', 3, false, null]);
    assert.deepEqual(cat('Pelare'), ['barande', 2, false, null]);
    assert.deepEqual(cat('Påle'), ['ingar_inte', 1, false, null]);
    assert.deepEqual(cat('Skåp'), ['ingar_inte', 6, false, null]);
    assert.deepEqual(cat('Rör'), ['ingar_inte', 4, false, null]);
    assert.deepEqual(cat('Okänd'), ['oklar', null, false, null]);
    return 'ok';
  }, 60000);

  test('climate: proposals follow IfcMaterial.Category before the name, the person\'s choice wins, and GWP sums per post, category and layer', async (assert) => {
    const db = klimatdb.compact(database(), '09.09.000');
    assert.deepEqual(db.resources.map((r) => r.id), ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005', '9000000006', '9000000007'], 'energy is not a building product');
    assert.deepEqual([db.resources[0].density, db.resources[0].group, db.resources[0].a1a3, db.resources[0].a4, db.resources[0].a5], [2400, '6', { typical: 0.1, conservative: 0.125 }, 0.005, 0.004]);
    const first = (name, kinds, category) => (climate.suggest(name, db.resources, kinds, 1, category)[0] || { id: null }).id;
    assert.equal(first('Betong', ['volume'], 'concrete'), '9000000001', 'concrete in the concrete category, not the roof tiles');
    assert.equal(first('Pelarmaterial', ['volume'], 'concrete'), '9000000001', 'the category proposes when the name says nothing');
    assert.equal(first('Mineralull', ['volume'], 'insulation'), '9000000003', 'the category\'s first product when the word only names the category');
    assert.equal(first('Gips', ['volume'], 'gypsum'), '9000000005');
    assert.equal(first('Betong', ['volume'], null), '9000000001', 'by name: the compound that ends with the word');
    assert.equal(first('Innerdörr 9x21', ['area'], null), '9000000006', 'a door per square metre');
    assert.equal(first('Innerdörr 9x21', ['volume'], null), null, 'only resources the quantity can count');
    assert.equal(first('Mineralull', ['volume'], null), null, 'no proposal without a match');

    const meta = await modelDataset();
    const decided = climate.decide(await climate.gather(meta.id));
    const rows = climate.compute(decided.posts, { db, choices: { 'm:mineralull': '9000000004' } });
    const row = (name, key) => rows.find((r) => r.namn === name && (!key || r.key === key));
    const expect = (volume, density, a13, a4, a5) => { const m = volume * density; return { a1a3: m * a13, a4: m * a4, a5: m * a5, total: m * (a13 + a4 + a5) }; };
    const concrete = row('Yttervägg', 'm:betong');
    assert.ok(concrete.resource.id === '9000000001' && !concrete.chosen && concrete.basis === 'volume', 'the proposal counts, marked as one');
    const e1 = expect(1.5, 2400, 0.125, 0.005, 0.004);
    assert.ok(near(concrete.gwp.a1a3, e1.a1a3) && near(concrete.gwp.a4, e1.a4) && near(concrete.gwp.a5, e1.a5) && near(concrete.gwp.total, e1.total), JSON.stringify(concrete.gwp));
    const wool = row('Yttervägg', 'm:mineralull');
    assert.ok(wool.resource.id === '9000000004' && wool.chosen && near(wool.gwp.total, expect(0.5, 40, 3.75, 0.04, 0.2).total), 'the person\'s choice wins');
    const door = row('Dörr');
    assert.ok(door.basis === 'area' && near(door.mass, 1.89 * 20) && near(door.gwp.a1a3, 1.89 * 20 * 2), 'a door per square metre');
    assert.ok(!row('Fönster').resource && !row('Fönster').gwp, 'no proposal for a window without a type name');
    const typical = climate.compute(decided.posts, { db, value: 'typical' }).find((r) => r.namn === 'Yttervägg' && r.key === 'm:betong');
    assert.ok(near(typical.gwp.a1a3, 1.5 * 2400 * 0.1), 'the typical value when asked');

    const sums = climate.summarize(rows, 'category');
    const sum = (group) => sums.find((s) => s.group === group);
    const total = (names) => rows.filter((r) => names.includes(r.category) && r.gwp).reduce((s, r) => s + r.gwp.total, 0);
    assert.deepEqual(sums.map((s) => s.group), ['grund', 'barande', 'skarm', 'inner', 'total', 'ingar_inte', 'oklar']);
    assert.ok(near(sum('total').total, total(['grund', 'barande', 'skarm', 'inner']), 1e-6) && near(sum('total').total, sum('grund').total + sum('barande').total + sum('skarm').total + sum('inner').total, 1e-6), 'the declaration is the four categories');
    assert.ok(near(sum('grund').total, expect(7.2, 2400, 0.125, 0.005, 0.004).total, 1e-6), 'the base slab is the foundation');
    assert.ok(sum('inner').uncertain === 1 && sum('inner').total > 0, 'the internal wall without LoadBearing counts, as uncertain');
    assert.ok(near(sum('grund').share + sum('barande').share + sum('skarm').share + sum('inner').share, 100, 1e-6), 'shares of the declaration');
    assert.equal(sum('oklar').elements, 1, 'the proxy waits for the person');
    const layers = climate.summarize(rows, 'layer');
    assert.deepEqual(layers.map((s) => s.group), ['1', '2', '3', '4', '5', '6', '']);
    assert.ok(near(layers.reduce((s, x) => s + x.total, 0), rows.filter((r) => r.gwp).reduce((s, r) => s + r.gwp.total, 0), 1e-6), 'every post in some layer');
    const table = climate.elementTable(rows);
    const at = (name) => table.columns.findIndex((c) => c.name === name);
    const tr = table.rows.find((r) => r[at('namn')] === 'Innervägg');
    assert.deepEqual([tr[at('kategori')], tr[at('beslut')], tr[at('enhet')], tr[at('mangdkalla')]], [t('climate.cat.inner'), t('climate.decision.uncertain'), 'm³', t('climate.source.extrusion') + ', ' + t('climate.source.openings', { n: 1 })], 'the door\'s opening is not deducted');
    const st = climate.summaryTable(rows, 'category');
    assert.equal(st.rows[4][0], t('climate.cat.total'));
    return 'ok';
  }, 60000);

  test('climate: the database is fetched only on the person\'s action, through the preset, with consent for api.boverket.se, and kept with its version', async (assert) => {
    const preset = await connectors.get(klimatdb.CONNECTOR);
    assert.ok(preset && preset.baseUrl === 'https://api.boverket.se/klimatdatabas' && preset.level === 1 && (preset.auth || {}).type === 'none', 'the preset, open and without a key');
    assert.deepEqual(preset.endpoints.map((e) => e.id), ['resurser', 'senaste-version', 'versioner']);
    assert.equal(await klimatdb.cached(), null, 'nothing kept and nothing fetched before');
    assert.deepEqual(served, { latest: 0, resources: 0 });
    klimatdb.setConnector(await virtualConnector());
    try {
      const db = await klimatdb.fetchLatest();
      assert.deepEqual(served, { latest: 1, resources: 1 }, 'the latest version, then its resources');
      assert.ok(db.version === '09.09.000' && db.resources.length === 7 && db.fetchedAt, 'kept in its compact form');
      assert.equal((await klimatdb.cached()).version, '09.09.000', 'read back without the network');
      assert.deepEqual(served, { latest: 1, resources: 1 });
    } finally { klimatdb.setConnector(null); }
    // The real host: a refusal stops the call before anything leaves the browser.
    const key = 'dataspatium.consent';
    const override = localStorage.getItem(key);
    const prior = await consent.state('api');
    const before = D.net.log().length;
    localStorage.removeItem(key);
    try {
      await consent.set('api', 'denied');
      let err = await klimatdb.fetchLatest().catch((e) => e);
      assert.ok(err && err.name === 'ConsentError', 'refused: ' + (err && err.message));
      await consent.set('api', null);
      const asked = [];
      consent.setAsker(async (purpose, info) => { asked.push(purpose + ':' + info.host); return { allow: false, remember: false }; });
      err = await klimatdb.fetchLatest().catch((e) => e);
      assert.ok(err && err.name === 'ConsentError', 'asked and refused');
      assert.deepEqual(asked, ['api:api.boverket.se'], 'the purpose api for Boverket\'s host');
      assert.ok(!D.net.log().slice(before).some((r) => /boverket/.test(r.url)), 'no request reached the network');
    } finally {
      consent.setAsker(null);
      await consent.set('api', prior === 'granted' || prior === 'denied' ? prior : null);
      if (override !== null) localStorage.setItem(key, override);
    }
    return 'ok';
  });

  test('climate: the tool in Analysera fetches on its button, shows the summary marked preliminary, proposes resources and lets the person settle', async (assert) => {
    const meta = await modelDataset();
    await klimatdb.forget();
    const calls = served.latest + served.resources;
    klimatdb.setConnector(await virtualConnector());
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'the dataset');
      shell.store.set({ selectedId: meta.id, openModelTool: { datasetId: meta.id, tool: 'climate' } });
      shell.activate('analysera');
      const summary = await waitFor(() => root.querySelector('[data-climate-result="summary"]'), 30000, 'the summary');
      assert.ok(summary.textContent.includes(t('climate.note.summary')) && summary.textContent.includes(t('climate.note.nodb')), 'preliminary, and no database yet: ' + summary.textContent);
      assert.equal(served.latest + served.resources, calls, 'opening the tool fetches nothing');
      /** @type {any} */ (root.querySelector('[data-climate-fetch]')).click();
      await waitFor(() => { const s = root.querySelector('[data-climate-db]'); return s && s.textContent.includes('09.09.000'); }, 10000, 'the database');
      assert.equal(served.latest + served.resources, calls + 2, 'fetched on the button');
      await waitFor(() => { const s = root.querySelector('[data-climate-result="summary"]'); return s && s.textContent.includes(t('climate.db.source', { version: '09.09.000', date: new Date().toISOString().slice(0, 10) })); }, 10000, 'the source under the summary');
      const view = (v) => { const el = /** @type {any} */ (root.querySelector('[data-climate-view]')); el.value = v; el.dispatchEvent(new Event('change')); };
      view('materials');
      await waitFor(() => root.querySelector('[data-climate-result="materials"]'), 10000, 'the materials');
      const betong = await waitFor(() => root.querySelector('[data-climate-material="m:betong"]'), 5000, 'the concrete');
      assert.equal(/** @type {any} */ (betong).value, '9000000001', 'proposed');
      /** @type {any} */ (root.querySelector('[data-climate-accept]')).click();
      await waitFor(async () => (await climate.choices())['m:betong'] === '9000000001', 5000, 'the proposals kept as choices');
      view('settle');
      await waitFor(() => root.querySelector('[data-climate-result="settle"]'), 10000, 'the elements to settle');
      const wallRow = await waitFor(() => Array.from(root.querySelectorAll('[data-climate-settle-row]')).find((r) => r.textContent.includes(t('climate.reason.bearing'))), 5000, 'the internal wall');
      const guid = (await model.rowsOf(meta.id, "select guid from data where namn = 'Innervägg'"))[0].guid;
      const pick = /** @type {any} */ (wallRow.querySelector('[data-climate-settle]'));
      pick.value = 'barande'; pick.dispatchEvent(new Event('change'));
      await waitFor(async () => (await climate.settled())[guid] === 'barande', 5000, 'the settlement kept');
      view('elements');
      const rows = await waitFor(() => root.querySelector('[data-climate-result="elements"]'), 10000, 'the rows');
      assert.ok(rows.textContent.includes(t('climate.db.source', { version: '09.09.000', date: new Date().toISOString().slice(0, 10) })), 'the source under the rows');
    } finally {
      klimatdb.setConnector(null);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 120000);

  test('climate: cleanup', async () => {
    D.net.unvirtual('tests/klimat/');
    klimatdb.setConnector(null);
    for (const key of KEYS) { if (saved[key] === null || saved[key] === undefined) await idb.deleteSetting(key); else await idb.setSetting(key, saved[key]); }
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
