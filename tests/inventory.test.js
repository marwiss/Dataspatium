// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the material inventory for the waste management plan (analysis/inventory, ui/analysis/inventory-panel) and the app's
 * IDS files (analysis/ids-presets, presets/ids), with the network stubbed and Python left alone unless the page asks for it: the
 * waste fraction from IfcMaterial.Category before the name (wool, composites, several fractions and no material left to the
 * person), the GTIN's check digit, hazards only where a property says so, the mass from the file's weight or the material's
 * density, the sums per fraction and per layer, the reusable products with their identities, the hazard list, the IDS file's
 * form, the tool in Analysera and its way to IDS-kontroll. With the real Pyodide (`?python=1` or cached components) IfcOpenShell's
 * templates confirm the product properties per schema and ifctester checks the model against the IDS. Own test data only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const inventory = D.require('analysis/inventory');
  const presets = D.require('analysis/ids-presets');
  const imports = D.require('io/import');
  const datasets = D.require('data/datasets');
  const catalog = D.require('engines/python/catalog');
  const IDS = 'presets/ids/SE-Dataspatium_Avfallshantering.ids';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const near = (a, b, tol = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= tol;

  /** A small IFC4 building in millimetres with products, densities and hazards, written for these tests. */
  function ifcText() {
    const lines = []; let next = 100; let g = 1;
    const add = (text) => { const id = next++; lines.push(`#${id}=${text};`); return id; };
    const G = () => '0Invent' + String(g++).padStart(15, '0');
    const num = (v) => (Number.isInteger(v) ? v + '.' : String(v));
    const units = add(`IFCUNITASSIGNMENT((#${add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')},#${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},#${add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')}))`);
    const origin = add('IFCCARTESIANPOINT((0.,0.,0.))');
    const zDir = add('IFCDIRECTION((0.,0.,1.))');
    const world = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${add('IFCDIRECTION((1.,0.,0.))')})`);
    const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${world},$)`);
    const body = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${context},$,.MODEL_VIEW.,$)`);
    const project = add(`IFCPROJECT('${G()}',$,'Inventeringsprojekt',$,$,$,$,(#${context}),#${units})`);
    const place = add(`IFCLOCALPLACEMENT($,#${world})`);
    const site = add(`IFCSITE('${G()}',$,'Tomten',$,$,#${place},$,$,.ELEMENT.,$,$,$,$,$)`);
    const building = add(`IFCBUILDING('${G()}',$,'Inventeringshuset',$,$,#${place},$,$,.ELEMENT.,$,$,$)`);
    const storey = add(`IFCBUILDINGSTOREY('${G()}',$,'Plan 1',$,$,#${place},$,$,.ELEMENT.,0.)`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${project},(#${site}))`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${site},(#${building}))`);
    add(`IFCRELAGGREGATES('${G()}',$,$,$,#${building},(#${storey}))`);
    const p2 = add(`IFCAXIS2PLACEMENT2D(#${add('IFCCARTESIANPOINT((0.,0.))')},$)`);
    const shape = (item) => add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${add(`IFCSHAPEREPRESENTATION(#${body},'Body','SweptSolid',(#${item}))`)}))`);
    const box = (x, y, depth) => shape(add(`IFCEXTRUDEDAREASOLID(#${add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${p2},${num(x)},${num(y)})`)},#${world},#${zDir},${num(depth)})`));
    const el = (cls, name, shapeId, extra) => add(`${cls}('${G()}',$,'${name}',$,$,#${place},${shapeId ? '#' + shapeId : '$'},$${extra ? ',' + extra : ''})`);
    const props = (list) => list.map(([n, v]) => '#' + add(`IFCPROPERTYSINGLEVALUE('${n}',$,${v},$)`)).join(',');
    const pset = (name, list) => add(`IFCPROPERTYSET('${G()}',$,'${name}',$,(${props(list)}))`);
    const defines = (on, set) => add(`IFCRELDEFINESBYPROPERTIES('${G()}',$,$,$,(#${on}),#${set})`);
    const material = (name, category) => add(`IFCMATERIAL('${name}',$,${category ? `'${category}'` : '$'})`);
    const associate = (on, mat) => add(`IFCRELASSOCIATESMATERIAL('${G()}',$,$,$,(#${on}),#${mat})`);
    const typed = (on, type) => add(`IFCRELDEFINESBYTYPE('${G()}',$,$,$,(#${on}),#${type})`);
    const label = (v) => `IFCLABEL('${v}')`; const ident = (v) => `IFCIDENTIFIER('${v}')`;
    const maker = (gtin, model) => pset('Pset_ManufacturerTypeInformation', [['GlobalTradeItemNumber', ident(gtin)], ['Manufacturer', label('Provtillverkaren')], ['ModelLabel', label(model)]]);

    const betong = material('Betong', 'concrete');
    add(`IFCMATERIALPROPERTIES('Pset_MaterialCommon',$,(${props([['MassDensity', 'IFCMASSDENSITYMEASURE(2400.)']])}),#${betong})`);
    const ull = material('Mineralull', 'insulation');
    const glas = material('Planglas', 'glass');
    const fog = material('Fogmassa', null);
    add(`IFCMATERIALPROPERTIES('Farliga ämnen',$,(${props([['PCB', 'IFCBOOLEAN(.T.)']])}),#${fog})`);
    // The external wall: two layers, its quantities in the file.
    const outer = el('IFCWALL', 'Yttervägg', box(4000, 200, 2500), '.SOLIDWALL.');
    defines(outer, pset('Pset_WallCommon', [['IsExternal', 'IFCBOOLEAN(.T.)'], ['LoadBearing', 'IFCBOOLEAN(.T.)']]));
    defines(outer, add(`IFCELEMENTQUANTITY('${G()}',$,'Qto_WallBaseQuantities',$,$,(#${add("IFCQUANTITYAREA('NetSideArea',$,$,10.,$)")},#${add("IFCQUANTITYVOLUME('NetVolume',$,$,2.,$)")}))`));
    const layers = add(`IFCMATERIALLAYERSET((#${add(`IFCMATERIALLAYER(#${betong},150.,$,'Stomme',$,'LoadBearing',$)`)},#${add(`IFCMATERIALLAYER(#${ull},50.,$,'Isolering',$,'Insulation',$)`)}),'Yttervägg 200',$)`);
    associate(outer, add(`IFCMATERIALLAYERSETUSAGE(#${layers},.AXIS2.,.POSITIVE.,0.,$)`));
    // An internal wall of gypsum, its volume from the extrusion; a property says no asbestos.
    const inner = el('IFCWALL', 'Innervägg', box(3000, 100, 2500), '.SOLIDWALL.');
    defines(inner, pset('Pset_WallCommon', [['IsExternal', 'IFCBOOLEAN(.F.)']]));
    defines(inner, pset('Farliga ämnen', [['Asbest', label('Nej')]]));
    associate(inner, material('Gips', 'gypsum'));
    // A door with its product on the type and its own serial number and barcode; wood and glass by shares.
    const door = el('IFCDOOR', 'Dörr', null, '2100.,900.,.DOOR.,$,$');
    typed(door, add(`IFCDOORTYPE('${G()}',$,'Innerdörr 9x21',$,$,(#${maker('4006381333931', 'Dörr 9')}),$,$,$,.DOOR.,.SINGLE_SWING_LEFT.,$,$)`));
    defines(door, pset('Pset_ManufacturerOccurrence', [['SerialNumber', ident('SN-0001')], ['BarCode', ident('BC-0001')]]));
    associate(door, add(`IFCMATERIALCONSTITUENTSET('Dörrblad',$,(#${add(`IFCMATERIALCONSTITUENT('Blad',$,#${material('Furu', 'wood')},0.8,$)`)},#${add(`IFCMATERIALCONSTITUENT('Ruta',$,#${glas},0.2,$)`)}))`));
    // A window whose GTIN has a wrong check digit, glazed with a sealant that holds PCB.
    const windowEl = el('IFCWINDOW', 'Fönster', null, '1200.,1000.,.WINDOW.,$,$');
    typed(windowEl, add(`IFCWINDOWTYPE('${G()}',$,'Fönster 12x10',$,$,(#${maker('4006381333932', 'Fönster 12')}),$,$,$,.WINDOW.,.SINGLE_PANEL.,$,$)`));
    associate(windowEl, add(`IFCMATERIALLIST((#${glas},#${fog}))`));
    // The base slab of the same concrete, 3.6 m³; it names its hazardous waste and its other waste.
    const slab = el('IFCSLAB', 'Platta', box(4000, 3000, 300), '.BASESLAB.');
    associate(slab, betong);
    defines(slab, pset('Pset_EnvironmentalImpactValues', [['HazardousWaste', 'IFCMASSMEASURE(0.2)'], ['NonHazardousWaste', 'IFCMASSMEASURE(5.)']]));
    // Floor tiles of clinker, which a property says hold asbestos.
    const tiles = el('IFCCOVERING', 'Golvplattor', null, '.FLOORING.');
    associate(tiles, material('Klinker', null));
    defines(tiles, pset('Farliga ämnen', [['Asbest', label('Ja')]]));
    // A steel column with a type and its weight in the file.
    const column = el('IFCCOLUMN', 'Pelare', box(200, 200, 3000), '.COLUMN.');
    typed(column, add(`IFCCOLUMNTYPE('${G()}',$,'HEB 200',$,$,$,$,$,$,.COLUMN.)`));
    associate(column, material('Konstruktionsstål', 'steel'));
    defines(column, add(`IFCELEMENTQUANTITY('${G()}',$,'Qto_ColumnBaseQuantities',$,$,(#${add("IFCQUANTITYWEIGHT('NetWeight',$,$,300.,$)")}))`));
    // A pump with its product, and an element of no material.
    const pump = el('IFCPUMP', 'Pump 1', null, '.CIRCULATOR.');
    typed(pump, add(`IFCPUMPTYPE('${G()}',$,'Cirkulationspump',$,$,(#${maker('96385074', 'Pump 25')}),$,$,$,.CIRCULATOR.)`));
    const proxy = el('IFCBUILDINGELEMENTPROXY', 'Okänd', null, '.NOTDEFINED.');
    const all = [outer, inner, door, windowEl, slab, tiles, column, pump, proxy];
    add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${G()}',$,$,$,(${all.map((x) => '#' + x).join(',')}),#${storey})`);
    const head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
      "FILE_NAME('inventering.ifc','2026-11-12T12:00:00',('Testare'),('Testbolaget'),'Testverktyg','Testprogram 1.0','');", "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;'];
    return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
  }
  let modelMeta = null;
  async function modelDataset() {
    if (!modelMeta) {
      modelMeta = await imports.run(new File([ifcText()], 'inventering.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Inventeringshuset');
      created.push(modelMeta.id);
    }
    return modelMeta;
  }

  test('inventory: the waste fraction follows IfcMaterial.Category before the name and leaves wool, composites and mixtures to the person', async (assert) => {
    const f = (name, category) => { const r = inventory.fractionOf(name, category); return [r.fraction, r.rule]; };
    assert.deepEqual(f('Pelarmaterial', 'concrete'), ['mineral', 'category'], 'the category names the fraction');
    assert.deepEqual(f('Furu', 'Wood'), ['tra', 'category']);
    assert.deepEqual(f('Betong C30/37', null), ['mineral', 'name'], 'the name when there is no category');
    assert.deepEqual(f('Cellplast EPS', 'insulation'), ['plast', 'name'], 'a category that names no fraction hands over to the name');
    assert.deepEqual(f('Mineralull', 'insulation'), ['ovrigt', 'wool'], 'mineral wool is neither mineral nor glass');
    assert.deepEqual(f('Glasull', null), ['ovrigt', 'wool']);
    assert.deepEqual(f('Stenull', null), ['ovrigt', 'wool']);
    assert.deepEqual(f('Glasfiberarmerad plast', null), ['ovrigt', 'composite']);
    assert.deepEqual(f('Trä/aluminium', null), ['ovrigt', 'several'], 'several fractions are for the person');
    assert.deepEqual(f('X', 'Concrete, Steel'), ['ovrigt', 'category-several']);
    assert.deepEqual(f('Linoleum', null), ['ovrigt', 'none']);
    assert.deepEqual(f('', null), ['ovrigt', 'nomaterial']);
    for (const [name, want] of [['Limträ GL30c', 'tra'], ['Konstruktionsvirke C24', 'tra'], ['Tegel', 'mineral'], ['Kalksandsten', 'mineral'], ['Klinker', 'mineral'], ['Stålbalk HEA', 'metall'],
      ['Sträckmetall', 'metall'], ['Isolerglas', 'glas'], ['Gipsskiva', 'gips'], ['Gypsum Wall Board', 'gips'], ['PVC-matta', 'plast'], ['Murstein', 'mineral'], ['Betoni', 'mineral']]) {
      assert.equal(inventory.fractionOf(name, null).fraction, want, name);
    }
    const text = inventory.fractionOf('Fabriksbetong', null).text;
    assert.ok(text.includes('Fabriksbetong') && text.includes('fabriksbetong') && text.includes(t('inventory.fraction.mineral')), 'the rule says what decided: ' + text);
    assert.ok(inventory.fractionOf('X', 'concrete').text.includes('IfcMaterial.Category = concrete'), 'and names the category');
    assert.deepEqual(['4006381333931', '4006381333932', '96385074', '12345', 'ABC', '', null].map(inventory.gtinCheck), ['ok', 'checkdigit', 'ok', 'format', 'format', null, null], 'GS1 check digits');
    return 'ok';
  });

  test('inventory: a hazardous substance only where a property says so, and densities from the materials\' properties', async (assert) => {
    const says = ([set, name, value]) => inventory.saysHazard(set, name, value);
    assert.deepEqual([['Farliga ämnen', 'Bly', 'Ja'], ['X', 'Asbest', 'Nej'], ['X', 'ContainsHazardousSubstances', false], ['Pset_EnvironmentalImpactValues', 'HazardousWaste', 0.2],
      ['Pset_EnvironmentalImpactValues', 'HazardousWaste', 0], ['Pset_EnvironmentalImpactValues', 'NonHazardousWaste', 5], ['Pset_Risk', 'RiskType', 'HAZARD'], ['Pset_Risk', 'RiskName', 'Fall'],
      ['Pset_MaterialCombustion', 'FireHazardFactor', 3], ['Pset_WallCommon', 'FireRating', 'EI60']].map(says),
    [true, false, false, true, false, false, true, false, false, false]);
    const facts = inventory.materialFacts([[1, 'Pset_MaterialCommon', 'MassDensity', 2400], [2, 'Farliga ämnen', 'PCB', true], [3, 'X', 'Asbest', 'Nej'], [4, 'Pset_MaterialCommon', 'MassDensity', 0]]);
    assert.deepEqual([Array.from(facts.density.entries()), Array.from(facts.hazards.keys())], [[[1, 2400]], [2]], 'a density above zero, a hazard that says yes');
    return 'ok';
  });

  test('inventory: from a model, the masses, the fractions per post, the sums per fraction and layer, the reusable products and the hazards', async (assert) => {
    const meta = await modelDataset();
    const data = await inventory.gather(meta.id);
    assert.ok(data.hasFile && data.materialProps.length >= 2, 'the materials\' properties are read: ' + JSON.stringify(data.materialProps));
    const built = inventory.build(data);
    const row = (name, label) => built.rows.find((r) => r.namn === name && (!label || r.label === label));
    const concrete = row('Yttervägg', 'Betong');
    assert.ok(concrete && concrete.fraction === 'mineral' && concrete.fractionRule === 'category' && near(concrete.volume, 1.5) && near(concrete.mass, 3600) && concrete.massFrom === 'density', 'volume × density: ' + JSON.stringify(concrete && [concrete.volume, concrete.mass]));
    const wool = row('Yttervägg', 'Mineralull');
    assert.ok(wool.fraction === 'ovrigt' && wool.mass === null && near(wool.volume, 0.5), 'no density, no mass');
    assert.ok(near(row('Platta').mass, 3.6 * 2400) && row('Platta').layer === 1, 'the slab: ' + row('Platta').mass);
    assert.ok(row('Innervägg').fraction === 'gips' && near(row('Innervägg').volume, 0.75) && row('Innervägg').mass === null);
    assert.ok(row('Pelare').fraction === 'metall' && row('Pelare').mass === 300 && row('Pelare').massFrom === 'qto', 'the file\'s weight first');
    assert.deepEqual(built.rows.filter((r) => r.namn === 'Dörr').map((r) => [r.label, r.fraction]), [['Furu', 'tra'], ['Planglas', 'glas']], 'a door per material, not as one product');
    assert.deepEqual(built.rows.filter((r) => r.namn === 'Fönster').map((r) => [r.label, r.fraction]), [['Planglas', 'glas'], ['Fogmassa', 'ovrigt']]);
    assert.ok(row('Golvplattor').fraction === 'mineral' && row('Okänd').fractionRule === 'nomaterial' && row('Pump 1').fractionRule === 'nomaterial');

    const sums = inventory.summarize(built.rows);
    assert.deepEqual(sums.map((s) => s.fraction), inventory.FRACTIONS.concat(['total']), 'the ordinance\'s fractions in order, then the total');
    const mineral = sums.find((s) => s.fraction === 'mineral');
    assert.ok(mineral.elements === 3 && near(mineral.mass, 3600 + 8640) && near(mineral.volume, 5.1) && mineral.noMass === 1, JSON.stringify(mineral));
    const total = sums.find((s) => s.fraction === 'total');
    assert.equal(total.posts, built.rows.length, 'every post in the total');
    const layers = inventory.layerTable(built.rows);
    const pairs = layers.rows.map((r) => r[0] + ' | ' + r[1]);
    assert.ok(pairs.includes(t('climate.layer.1') + ' | ' + t('inventory.fraction.mineral')) && pairs.includes(t('climate.layer.3') + ' | ' + t('inventory.fraction.mineral')) && pairs.includes(t('climate.layer.4') + ' | ' + t('inventory.fraction.ovrigt')), pairs.join('; '));
    assert.equal(new Set(pairs).size, pairs.length, 'one row per layer and fraction');

    const reuse = inventory.reuseTable(built.elements, built.rows, data.products);
    const at = (name) => reuse.columns.findIndex((c) => c.name === name);
    const byName = (name) => reuse.rows.find((r) => r[at('namn')] === name);
    assert.deepEqual(reuse.rows.map((r) => r[at('namn')]).sort(), ['Dörr', 'Fönster', 'Pelare', 'Pump 1'], 'the elements with a type');
    assert.equal(reuse.rows[reuse.rows.length - 1][at('namn')], 'Pelare', 'those with product data first');
    const d = byName('Dörr');
    assert.deepEqual([d[at('tillverkare')], d[at('modell')], d[at('gtin')], d[at('gtin_kontroll')], d[at('serienummer')], d[at('streckkod')]], ['Provtillverkaren', 'Dörr 9', '4006381333931', t('inventory.gtin.ok'), 'SN-0001', 'BC-0001'], 'type and occurrence');
    assert.equal(byName('Fönster')[at('gtin_kontroll')], t('inventory.gtin.checkdigit'), 'a wrong check digit is shown, not mended');
    assert.ok(String(byName('Fönster')[at('farliga_amnen')]).includes('PCB') && String(byName('Fönster')[at('fraktion')]).includes(t('inventory.fraction.glas')), 'the window\'s sealant and its glass');

    const hazards = inventory.hazardTable(built.elements, built.rows, data.hazards);
    const h = hazards.rows.map((r) => [r[3], r[6] + '.' + r[7], r[8]]);
    assert.deepEqual(h.sort(), [['Fönster', 'Farliga ämnen.PCB', 'true'], ['Golvplattor', 'Farliga ämnen.Asbest', 'Ja'], ['Platta', 'Pset_EnvironmentalImpactValues.HazardousWaste', '0.2']], 'only what the model says: ' + JSON.stringify(h));
    const elements = inventory.elementTable(built.rows);
    assert.ok(['fraktion', 'regel', 'skikt', 'densitet', 'massa_kg', 'farliga_amnen'].every((c) => elements.columns.some((x) => x.name === c)) && elements.rows.length === built.rows.length);
    return 'ok';
  }, 60000);

  test('inventory: the app\'s IDS for waste management is listed, valid in form and asks for categories, base quantities and product data', async (assert) => {
    const list = await presets.list();
    const mine = list.find((p) => p.name === IDS);
    assert.ok(mine && mine.file === 'SE-Dataspatium_Avfallshantering.ids' && mine.title.startsWith('Avfallshantering'), JSON.stringify(list));
    const file = await presets.load(IDS);
    assert.ok(file.bytes instanceof Uint8Array && file.bytes.length === new TextEncoder().encode(file.text).length);
    const doc = new DOMParser().parseFromString(file.text, 'application/xml');
    assert.ok(!doc.querySelector('parsererror'), 'well-formed XML');
    const NS = 'http://standards.buildingsmart.org/IDS'; const XS = 'http://www.w3.org/2001/XMLSchema';
    assert.equal(doc.documentElement.namespaceURI, NS);
    const specs = Array.from(doc.getElementsByTagNameNS(NS, 'specification'));
    assert.equal(specs.length, 8);
    for (const s of specs) {
      assert.ok(s.getAttribute('ifcVersion').split(' ').every((v) => ['IFC4', 'IFC4X3_ADD2'].includes(v)) && s.getAttribute('name') && s.getAttribute('identifier'), s.getAttribute('name'));
      const names = Array.from(s.getElementsByTagNameNS(NS, 'applicability')[0].getElementsByTagNameNS(XS, 'enumeration')).map((e) => e.getAttribute('value'));
      assert.ok(names.length && names.every((n) => /^IFC[A-Z0-9]+$/.test(n)), names.join(','));
      if (!s.getAttribute('ifcVersion').includes('IFC4X3_ADD2')) assert.ok(names.every((n) => /(STANDARD|ELEMENTED)CASE$/.test(n)), 'IFC4\'s own classes only where IFC4.3 has none');
    }
    const props = Array.from(doc.getElementsByTagNameNS(NS, 'property')).map((p) => {
      const value = (tag) => { const e = p.getElementsByTagNameNS(NS, tag)[0]; const sv = e && e.getElementsByTagNameNS(NS, 'simpleValue')[0]; const pat = e && e.getElementsByTagNameNS(XS, 'pattern')[0]; return sv ? sv.textContent : pat ? pat.getAttribute('value') : null; };
      return [value('propertySet'), value('baseName'), p.getAttribute('cardinality'), p.getAttribute('dataType')];
    });
    const has = (want) => props.some((p) => JSON.stringify(p) === JSON.stringify(want));
    assert.ok(has(['Pset_ManufacturerTypeInformation', 'Manufacturer', 'required', 'IFCLABEL']) && has(['Pset_ManufacturerTypeInformation', 'ModelLabel', 'required', 'IFCLABEL']) && has(['Pset_ManufacturerTypeInformation', 'GlobalTradeItemNumber', 'optional', 'IFCIDENTIFIER']), JSON.stringify(props));
    assert.ok(props.some((p) => /Qto_\(Wall\|Slab/.test(p[0]) && p[1] === '(Net|Gross)Volume' && p[3] === 'IFCVOLUMEMEASURE') && props.some((p) => /Qto_CurtainWallQuantities/.test(p[0]) && p[3] === 'IFCAREAMEASURE'), 'base quantities');
    const material = doc.getElementsByTagNameNS(NS, 'material')[0];
    assert.ok(material && /concrete/.test(material.getElementsByTagNameNS(XS, 'pattern')[0].getAttribute('value')), 'materials with IFC\'s recommended categories');
    // The product identities the inventory reads are in IfcOpenShell's templates for IFC4 and IFC4X3 (the GTIN not in IFC2X3's).
    const TEMPLATES = { Pset_ManufacturerTypeInformation: ['GlobalTradeItemNumber', 'ArticleNumber', 'ModelReference', 'ModelLabel', 'Manufacturer', 'ProductionYear', 'AssemblyPlace'], Pset_ManufacturerOccurrence: ['AcquisitionDate', 'BarCode', 'SerialNumber', 'BatchReference', 'AssemblyPlace'] };
    assert.ok(Object.values(inventory.PRODUCT_FIELDS).every(([set, name]) => (TEMPLATES[set] || []).includes(name)), JSON.stringify(inventory.PRODUCT_FIELDS));
    return 'ok';
  });

  test('inventory: the tool in Analysera shows the basis in the provision\'s order, lists the hazards and opens IDS-kontroll with the app\'s IDS', async (assert) => {
    const meta = await modelDataset();
    // IDS-kontroll runs in Python; here the check is stubbed so that nothing starts or is fetched.
    const analysis = D.require('analysis/model');
    const bridge = D.require('data/python-bridge').bridge;
    const realTool = analysis.ifcTool; const realWrite = bridge.writeFile;
    const calls = [];
    analysis.ifcTool = async (id, tool, params) => { calls.push({ id, tool, params }); return { columns: [{ name: 'specifikation', type: 'text' }], rows: [], total: 0, summary: { specifications: 8, checks: 0, checks_pass: 0, checks_fail: 0 } }; };
    bridge.writeFile = async (path, bytes) => { calls.push({ path, text: new TextDecoder().decode(bytes) }); };
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'the dataset');
      shell.store.set({ selectedId: meta.id, openModelTool: { datasetId: meta.id, tool: 'inventory' } });
      shell.activate('analysera');
      const reuse = await waitFor(() => root.querySelector('[data-inventory-result="reuse"]'), 30000, 'the reusable products');
      assert.ok(reuse.textContent.includes(t('inventory.note.basis')) && reuse.textContent.includes(t('inventory.note.hazards', { n: 3 })), 'the basis and the hazards: ' + reuse.textContent);
      const view = (v) => { const el = /** @type {any} */ (root.querySelector('[data-inventory-view]')); el.value = v; el.dispatchEvent(new Event('change')); };
      view('fractions');
      const fractions = await waitFor(() => root.querySelector('[data-inventory-result="fractions"]'), 10000, 'the fractions');
      assert.ok(fractions.textContent.includes(t('inventory.note.fractions')), 'point 2 a');
      await waitFor(() => root.textContent.includes(t('inventory.inspector.law').slice(0, 40)), 5000, 'the provision in the inspector');
      view('hazards');
      const hazards = await waitFor(() => root.querySelector('[data-inventory-result="hazards"]'), 10000, 'the hazards');
      assert.ok(hazards.textContent.includes(t('inventory.note.hazardlist')), 'point 2 b');
      assert.equal(calls.length, 0, 'nothing ran in Python');
      /** @type {any} */ (root.querySelector('[data-inventory-ids]')).click();
      const pick = await waitFor(() => root.querySelector('[data-ifc-ids-preset]'), 10000, 'IDS-kontroll');
      assert.equal(/** @type {any} */ (pick).value, IDS, 'the app\'s IDS is chosen');
      await waitFor(() => calls.some((c) => c.tool === 'ids'), 10000, 'the check');
      const written = calls.find((c) => c.path);
      assert.ok(written && /SE-Dataspatium_Avfallshantering\.ids$/.test(written.path) && written.text.includes('<ids:title>Avfallshantering'), 'the preset is checked as a picked file: ' + (written && written.path));
      assert.equal(calls.find((c) => c.tool === 'ids').params.ids, written.path);
    } finally {
      analysis.ifcTool = realTool; bridge.writeFile = realWrite;
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 120000);

  test('inventory: IfcOpenShell\'s templates have the product properties per schema and ifctester checks the model against the app\'s IDS', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await modelDataset();
    const bridge = D.require('data/python-bridge').bridge;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const code = ['import ifcopenshell, ifcopenshell.util.pset as up', 'out = {}', 'for s in ("IFC2X3", "IFC4", "IFC4X3"):',
      '    t = up.get_template(s)', '    for n in ("Pset_ManufacturerTypeInformation", "Pset_ManufacturerOccurrence"):',
      '        p = t.get_by_name(n)', '        out[s + ":" + n] = sorted(x.Name for x in p.HasPropertyTemplates) if p else []', 'import json', 'print(json.dumps(out))'].join('\n');
    const res = await bridge.run(code);
    const text = res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim();
    const out = JSON.parse(text.split('\n').pop());
    for (const s of ['IFC2X3', 'IFC4', 'IFC4X3']) {
      assert.ok(['Manufacturer', 'ModelLabel'].every((n) => out[s + ':Pset_ManufacturerTypeInformation'].includes(n)) && ['SerialNumber', 'BarCode'].every((n) => out[s + ':Pset_ManufacturerOccurrence'].includes(n)), s + ': ' + JSON.stringify(out));
      assert.equal(out[s + ':Pset_ManufacturerTypeInformation'].includes('GlobalTradeItemNumber'), s !== 'IFC2X3', s + ' and the GTIN');
    }
    const file = await presets.load(IDS);
    await bridge.writeFile('/data/ids/' + file.name, file.bytes.slice());
    const checked = await bridge.ifcTool(meta.id, 'ids', { ids: '/data/ids/' + file.name });
    assert.ok(checked.summary && checked.summary.specifications === 8 && checked.summary.checks_pass > 0 && checked.summary.checks_fail > 0, JSON.stringify(checked.summary));
    const failed = checked.rows.filter((r) => r[2] === 'underkänd').map((r) => r[0] + ': ' + r[5]);
    assert.ok(failed.includes('Material med kategori: Okänd') && failed.includes('Basmängd: volym: Innervägg') && !failed.some((x) => /Produktdata.*Dörr/.test(x)), failed.join('; '));
    return 'ok';
  }, 900000);

  test('inventory: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
