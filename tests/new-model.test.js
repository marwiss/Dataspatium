// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Ny byggnadsmodell (OB-06 Schemaval för nya modeller): the settings take IFC4X3_ADD2 by default and refuse an unknown
 * schema, a file the wheel wrote becomes a model dataset with its project, site, building and storey, a file with schema errors is
 * not kept, and the form in Inhämta creates the model with the schema chosen. The wheel is stubbed (Pyodide never runs in the
 * suite); the IFC below is what python/dataspatium.py's _ifc_new_model wrote with IfcOpenShell 0.9.0.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const ifcNew = D.require('data/ifc-new');
  const { bridge } = D.require('data/python-bridge');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const created = [];

  /** The wheel's new model in IFC4X3_ADD2 (project Testhus, site Tomten, building Huset, storey Plan 1). */
  const NEW_IFC = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition[DesignTransferView]'),'2;1');",
    "FILE_NAME('/dev/null','2026-11-10T18:36:04+01:00',(''),(''),'IfcOpenShell 0.9.0.post1','IfcOpenShell 0.9.0.post1','Nobody');",
    "FILE_SCHEMA(('IFC4X3_ADD2'));", 'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('2oQc6UphjEUxY4ladKbF6J',$,'Testhus',$,$,$,$,(#11),#6);",
    '#2=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);', '#3=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);', '#4=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);',
    '#5=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);', '#6=IFCUNITASSIGNMENT((#3,#5,#4,#2));', '#7=IFCCARTESIANPOINT((0.,0.,0.));',
    '#8=IFCDIRECTION((0.,0.,1.));', '#9=IFCDIRECTION((1.,0.,0.));', '#10=IFCAXIS2PLACEMENT3D(#7,#8,#9);',
    "#11=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#10,$);",
    "#12=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#11,$,.MODEL_VIEW.,$);",
    "#13=IFCSITE('2k$pBVxg1EsRKdDbbN_7kb',$,'Tomten',$,$,#24,$,$,.ELEMENT.,$,$,$,$,$);",
    "#19=IFCRELAGGREGATES('1lHCT3_n58zvyU_fqvmuGr',$,$,$,#1,(#13));", '#20=IFCCARTESIANPOINT((0.,0.,0.));', '#21=IFCDIRECTION((0.,0.,1.));',
    '#22=IFCDIRECTION((1.,0.,0.));', '#23=IFCAXIS2PLACEMENT3D(#20,#21,#22);', '#24=IFCLOCALPLACEMENT($,#23);',
    "#25=IFCBUILDING('2mmrOkrO9ANvqN1bS_Zfx7',$,'Huset',$,$,#36,$,$,.ELEMENT.,$,$,$);",
    "#31=IFCRELAGGREGATES('3RZrAbvWH2EA4T2uXIf10h',$,$,$,#13,(#25));", '#32=IFCCARTESIANPOINT((0.,0.,0.));', '#33=IFCDIRECTION((0.,0.,1.));',
    '#34=IFCDIRECTION((1.,0.,0.));', '#35=IFCAXIS2PLACEMENT3D(#32,#33,#34);', '#36=IFCLOCALPLACEMENT(#24,#35);',
    "#37=IFCBUILDINGSTOREY('3oZ8$$$Hj61Ob3IHV53z2G',$,'Plan 1',$,$,#48,$,$,.ELEMENT.,0.);",
    "#43=IFCRELAGGREGATES('34NUcsE254Z9Yjo_AE0vin',$,$,$,#25,(#37));", '#44=IFCCARTESIANPOINT((0.,0.,0.));', '#45=IFCDIRECTION((0.,0.,1.));',
    '#46=IFCDIRECTION((1.,0.,0.));', '#47=IFCAXIS2PLACEMENT3D(#44,#45,#46);', '#48=IFCLOCALPLACEMENT(#36,#47);', 'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');

  /** Run fn with the wheel stubbed: the calls are recorded, and the answer is the file above with the info given. */
  async function withWheel(info, fn) {
    const real = bridge.runIfcNewModel;
    const calls = [];
    bridge.runIfcNewModel = async (schema, names) => {
      calls.push({ schema, names });
      return { bytes: new TextEncoder().encode(NEW_IFC), info: Object.assign({ schema, entities: 33, storeys: 1, findings: [], errors: 0 }, info || {}), log: [] };
    };
    try { return await fn(calls); } finally { bridge.runIfcNewModel = real; }
  }

  test('new model: the settings take IFC4X3_ADD2 and the defaults, and refuse what the wheel cannot write', async (assert) => {
    const s = ifcNew.settings({});
    assert.equal(s.schema, 'IFC4X3_ADD2', 'the newest schema by default');
    assert.equal(ifcNew.SCHEMAS.join(','), 'IFC4X3_ADD2,IFC4,IFC2X3');
    assert.equal(s.project, t('newmodel.default.project')); assert.equal(s.storey, t('newmodel.default.storey'));
    assert.equal(s.name, s.project, 'the dataset is named after the project'); assert.equal(s.elevation, 0);
    assert.equal(ifcNew.settings({ schema: 'ifc2x3', name: '  Mitt   hus ' }).schema, 'IFC2X3', 'the schema in any case');
    assert.equal(ifcNew.settings({ name: '  Mitt   hus ' }).name, 'Mitt hus', 'spaces cleaned');
    assert.throws(() => ifcNew.settings({ schema: 'IFC5' }), /IFC5/, 'an unknown schema is refused');
    assert.throws(() => ifcNew.settings({ elevation: 'hög' }), null, 'an elevation that is not a number');
    assert.equal(ifcNew.fileNameOf('Nytt hus på Ön'), 'Nytt-hus-pa-On.ifc', 'a safe file name');
    assert.equal(ifcNew.fileNameOf('???'), 'model.ifc');
    return 'ok';
  });

  test('new model: the wheel\'s file becomes a model dataset with its project, site, building and storey', async (assert) => {
    await withWheel({}, async (calls) => {
      const res = await ifcNew.create({ name: 'Testhus', schema: 'IFC4', project: 'Testhus', site: 'Tomten', building: 'Huset', storey: 'Plan 1', elevation: 0 });
      created.push(res.dataset.id);
      assert.equal(calls.length, 1); assert.equal(calls[0].schema, 'IFC4', 'the schema chosen goes to the wheel');
      assert.deepEqual(calls[0].names, { project: 'Testhus', site: 'Tomten', building: 'Huset', storey: 'Plan 1', elevation: 0 });
      const meta = await datasets.get(res.dataset.id);
      assert.equal(meta.kind, 'model', 'a model dataset');
      assert.equal(meta.source.kind, 'new'); assert.equal(meta.source.schema, 'IFC4'); assert.equal(meta.source.fileName, 'Testhus.ifc');
      assert.ok(String(meta.description).includes('IFC4'), 'the description names the schema');
      const original = await D.require('data/model').original(meta.id);
      assert.ok(original && new TextDecoder().decode(original.bytes).includes("IFCBUILDINGSTOREY('3oZ8$$$Hj61Ob3IHV53z2G',$,'Plan 1'"), 'the original file is kept');
      const rows = await datasets.allRows(meta.id);
      assert.ok(rows.length >= 1, 'the spatial structure is in the table');
    });
    return 'ok';
  });

  test('new model: a file with schema errors is not kept', async (assert) => {
    const before = (await datasets.list()).length;
    await withWheel({ errors: 2 }, async () => {
      let error = null;
      try { await ifcNew.create({ name: 'Trasig' }); } catch (err) { error = err; }
      assert.ok(error && String(error.message).includes('2'), 'refused with the number of errors');
    });
    assert.equal((await datasets.list()).length, before, 'no dataset');
    return 'ok';
  });

  test('new model: the form in Inhämta creates the model in the schema chosen and offers to open it', async (assert) => {
    await withWheel({}, async (calls) => {
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
        const schema = /** @type {any} */ (form.querySelector('[data-newmodel="schema"]'));
        assert.equal(schema.value, 'IFC4X3_ADD2', 'the default is chosen');
        schema.value = 'IFC2X3'; schema.dispatchEvent(new Event('change'));
        const name = /** @type {any} */ (form.querySelector('[data-newmodel="name"]'));
        name.value = 'Formulärhuset'; name.dispatchEvent(new Event('input'));
        /** @type {any} */ (form.querySelector('[data-newmodel-create]')).click();
        const done = await waitFor(() => root.querySelector('[data-newmodel-done]'), 8000, 'the model is created');
        assert.equal(calls.length, 1); assert.equal(calls[0].schema, 'IFC2X3', 'the schema from the form');
        assert.ok(done.textContent.includes('Formulärhuset'), 'the name in the result');
        const meta = (await datasets.list()).find((m) => m.name === 'Formulärhuset');
        assert.ok(meta, 'the dataset exists'); created.push(meta.id);
        assert.ok(Array.from(done.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('newmodel.open')), 'a button opens it in Bearbeta');
      } finally {
        for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
        root.remove();
      }
    });
    return 'ok';
  }, 30000);

  test('new model: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* already gone */ } }
    return 'ok';
  });
})();
