// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for IfcOpenShell in the app (2.4.0): the pinned wheel set and its install order, the bridge paths (dm_ifc mirrors the
 * model, an IFC written by dm_ifc_write becomes a model dataset, the tools and steps call Python), the recipe steps that make a
 * changed IFC the dataset's content (rebuilt tables, log, undo), the Mängder tab's new tools, and, with the real Pyodide
 * (`?python=1` or cached components), the whole round trip: open, select, property sets, write a table back, a Python step,
 * geometry and a new dataset from Python.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const catalog = D.require('engines/python/catalog');
  const { bridge, PythonBridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const model = D.require('data/model');
  const ops = D.require('data/operations');
  const recipes = D.require('data/recipes');
  const fixture = D.require('tests/fixtures/ifc');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const stdoutOf = (res) => res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const FAKE_LOCK = { packages: {
    numpy: { version: '2', file_name: 'numpy-2.whl', sha256: 'a', depends: [], imports: ['numpy'] },
    shapely: { version: '2', file_name: 'shapely-2.whl', sha256: 'b', depends: ['numpy'], imports: ['shapely'] },
    pyparsing: { version: '3', file_name: 'pyparsing-3.whl', sha256: 'c', depends: [], imports: ['pyparsing'] },
    'python-dateutil': { version: '2', file_name: 'dateutil-2.whl', sha256: 'd', depends: [], imports: ['dateutil'] },
    'typing-extensions': { version: '4', file_name: 'te-4.whl', sha256: 'e', depends: [], imports: ['typing_extensions'] },
    pytest: { version: '8', file_name: 'pytest-8.whl', sha256: 'f', depends: [], imports: ['pytest'] },
  } };

  test('ifcopenshell: the wheels are pinned with their digests, install in upstream\'s order after their dependencies, and dm_ifc implies the package', (assert) => {
    catalog.reset();
    try {
      catalog.parse(FAKE_LOCK);
      assert.equal(catalog.IFC_WHEELS.length, 9, 'core, three schema parsers with their mappings, the pure-Python part and the OpenCASCADE kernel');
      assert.ok(catalog.IFC_WHEELS.every((w) => /^[0-9a-f]{64}$/.test(w.sha256) && w.size > 0), 'digests and sizes');
      const core = catalog.info('ifcopenshell');
      assert.ok(core && core.url.startsWith('https://ifcopenshell.github.io/wasm-wheels/modular/') && core.url.includes('%2B') && core.file.includes('+a963c38'), 'the core wheel at its GitHub Pages address: ' + (core && core.url));
      assert.equal(core.version, catalog.IFC_VERSION);
      const closure = catalog.closure(['ifcopenshell']);
      for (const w of catalog.IFC_WHEELS) assert.ok(closure.includes(w.name), 'in the closure: ' + w.name);
      for (const dep of ['numpy', 'shapely', 'lark', 'isodate', 'pyparsing', 'python-dateutil', 'typing-extensions']) assert.ok(closure.includes(dep), 'dependency ' + dep);
      const ordered = closure.map((n) => catalog.info(n)).filter((e) => e.url && e.order).sort((a, b) => a.order - b.order).map((e) => e.name);
      assert.deepEqual(ordered, catalog.IFC_WHEELS.map((w) => w.name), 'the plug-ins install after the core, each mapping after its schema parser, the kernel last');
      assert.ok(catalog.info('lark').url.startsWith('https://files.pythonhosted.org/') && catalog.info('isodate').url.startsWith('https://files.pythonhosted.org/'), 'lark and isodate pinned from PyPI');
      assert.deepEqual(catalog.referenced('m = dm_ifc("Hus")\nprint(m.schema)'), ['ifcopenshell'], 'dm_ifc implies the package');
      assert.deepEqual(catalog.referenced('import ifcopenshell.util.element as el\nimport pytest'), ['ifcopenshell', 'pytest']);
      assert.deepEqual(catalog.referenced('print("dm_ifc")'), [], 'a bare mention without a call is not a reference');
      assert.ok(catalog.IFC_SIZE > 12 * 1024 * 1024 && catalog.IFC_SIZE < 13.5 * 1024 * 1024, 'about 12.7 MB in all: ' + catalog.IFC_SIZE);
      // The IDS checker and its XML schema library travel in the ZIP as vendored wheels, installed like the others.
      for (const name of ['elementpath', 'xmlschema', 'ifctester']) {
        const e = catalog.info(name);
        assert.ok(e && e.asset && e.asset.startsWith(name + '/') && /^[0-9a-f]{64}$/.test(e.sha256) && e.size > 0 && !e.url, 'vendored wheel ' + name);
        const info = D.assets.info ? D.assets.info(e.asset) : null;
        assert.ok(!D.assets.info || (info && info.sha256 === e.sha256 && info.size === e.size), name + ' in vendor/manifest.js with the same digest');
      }
      assert.ok(catalog.info('ifctester').size < 60000, 'ifctester without its web app is small: ' + catalog.info('ifctester').size);
      assert.deepEqual(catalog.closure(['ifctester']).filter((n) => ['ifctester', 'xmlschema', 'elementpath', 'ifcopenshell'].includes(n)).sort(), ['elementpath', 'ifcopenshell', 'ifctester', 'xmlschema']);
      assert.deepEqual(catalog.referenced('r = dm_ifc_ids(m, "krav.ids")'), ['ifcopenshell', 'ifctester'], 'dm_ifc_ids implies both packages');
    } finally { catalog.reset(); }
    return 'IfcOpenShell ' + catalog.IFC_VERSION;
  });

  test('ifcopenshell: the bridge mirrors the model named in dm_ifc, installs the wheels one by one, takes an IFC from dm_ifc_write as a model dataset and reaches the tools and steps', async (assert) => {
    const meta = await importer.run(fixture.ifcFile(), { format: 'model' }, null, 'Ifcbrygga');
    created.push(meta.id);
    const ifcBytes = new Uint8Array(await fixture.ifcFile().arrayBuffer());
    const fs = new Map(); const loads = []; const evals = [];
    const fake = {
      python: '3.13.2', version: '0.29.5', handlers: {},
      on(ev, fn) { this.handlers[ev] = fn; return this; },
      async start() { return this; },
      async mkdir(p) { fs.set(p + '/', true); },
      async writeFile(p, bytes) { fs.set(p, bytes); },
      async readFile(p) { if (!fs.has(p)) throw new Error('no file ' + p); return new Uint8Array(fs.get(p)); },
      async listdir(p) { return Array.from(fs.keys()).filter((k) => k.startsWith(p + '/') && k !== p + '/' && !k.slice(p.length + 1).includes('/')).map((k) => k.slice(p.length + 1)); },
      async unlink(p) { fs.delete(p); },
      async shipAssets() { return []; },
      async loadPackages(names) { loads.push(names.slice()); return names; },
      async run(code) {
        if (code.includes('dm_ifc_write')) {
          fs.set('/data/out/ds_ifc1.ifc', ifcBytes.slice().buffer);
          fs.set('/data/out/ds_ifc1.ifc.json', new TextEncoder().encode(JSON.stringify({ name: 'Kopia av huset', description: 'från provet', file: 'kopia.ifc', from: meta.id })).buffer);
        }
        return { ok: true, value: null };
      },
      async evalJson(code) {
        evals.push(code);
        if (code.includes('_ifc_tool')) return { columns: [{ name: 'guid', type: 'text' }, { name: 'niva', type: 'integer' }], rows: [['abc', 0]], total: 1 };
        if (code.includes('_ifc_step') || code.includes('_ifc_apply')) { fs.set('/data/step/model-out.ifc', ifcBytes.slice().buffer); return { elements: 10, entities: 120, changed: 2, rows: 3, file: 'testhus.ifc' }; }
        return null;
      },
      interrupt() {}, async close() {},
    };
    const b = new PythonBridge({ createEngine: () => fake });
    // No network in this test: the catalog's package fetching is stubbed for the whole run (the real catalog would download the
    // Pyodide lock and the wheels when the component cache is empty, as on a fresh origin such as Pages).
    const realEnsure = catalog.ensurePackages;
    catalog.ensurePackages = async () => ({ packages: [], assets: [] });
    try {
    await b.start();
    assert.deepEqual(b.referencedNames('m = dm_ifc("Ifcbrygga"); x = dm_read(\'y\')'), ['Ifcbrygga', 'y'], 'dm_ifc names a dataset to mirror');
    const res = await b.run('m = dm_ifc("Ifcbrygga")\ndm_ifc_write(m, "Kopia av huset")');
    assert.ok(fs.has(`/data/${meta.id}.sqlite`), 'the model was mirrored for dm_ifc');
    const ds = res.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds && ds.meta.kind === 'model', 'a model dataset came back: ' + JSON.stringify(res.entries.map((e) => e.kind)));
    created.push(ds.meta.id);
    assert.equal(ds.meta.name, 'Kopia av huset');
    assert.equal(ds.meta.description, 'från provet');
    const orig = await model.original(ds.meta.id);
    assert.ok(orig && orig.name === 'kopia.ifc' && orig.bytes.byteLength === ifcBytes.byteLength, 'the written IFC is the new dataset\'s original');
    assert.ok(!fs.has('/data/out/ds_ifc1.ifc') && !fs.has('/data/out/ds_ifc1.ifc.json'), 'the output and its sidecar are removed');
    // The wheels: dependencies from the distribution first, then the IfcOpenShell set one wheel at a time in order.
    catalog.reset(); catalog.parse(FAKE_LOCK);
    {
      loads.length = 0;
      await b.ensurePackages(['ifcopenshell']);
      assert.ok(loads.length === catalog.IFC_WHEELS.length + 3, 'one call for the distribution packages, one per extra wheel: ' + loads.length);
      const urls = loads.slice(1).map((l) => l[0]);
      assert.ok(urls.slice(2).every((u) => u.startsWith(catalog.INDEX_URL)) && urls.filter((u) => u.includes('ifcopenshell')).length === catalog.IFC_WHEELS.length, JSON.stringify(urls));
      const names = urls.filter((u) => u.includes('ifcopenshell')).map((u) => u.slice(catalog.INDEX_URL.length).split('-')[0].replace(/_/g, '-'));
      assert.deepEqual(names, catalog.IFC_WHEELS.map((w) => w.name), 'in upstream\'s order');
      loads.length = 0;
      await b.ensurePackages(['ifctester']);
      const tail = loads.slice(-3).map((l) => l[0].slice(catalog.INDEX_URL.length).split('-')[0]);
      assert.deepEqual(tail, ['elementpath', 'xmlschema', 'ifctester'], 'the vendored wheels install after the IfcOpenShell set, in order: ' + JSON.stringify(loads.map((l) => l[0])));
    }
    // The tools and the steps reach Python with the dataset mirrored and come back as tables and files.
    const table = await b.ifcTool(meta.id, 'structure', {});
    assert.equal(table.total, 1); assert.deepEqual(table.columns.map((c) => c.name), ['guid', 'niva']);
    assert.ok(evals.some((c) => c.includes('_ifc_tool(') && c.includes('"structure"')), 'the tool call');
    const step = await b.runIfcStep('def step(model):\n    return model', await datasets.exportBytes(meta.id), { name: 'Ifcbrygga' });
    assert.ok(step.bytes.byteLength === ifcBytes.byteLength && step.info.elements === 10, 'the step returns the written IFC with counts');
    assert.ok(!fs.has('/data/step/model.sqlite') && !fs.has('/data/step/model-out.ifc'), 'step files cleaned up');
    const applied = await b.runIfcApply(await datasets.exportBytes(meta.id), await datasets.exportBytes(meta.id), 'guid');
    assert.equal(applied.info.changed, 2);
    assert.equal(b.state, 'ready');
    } finally { catalog.ensurePackages = realEnsure; catalog.reset(); }
    return 'ok';
  }, 30000);

  test('ifcopenshell: a changed IFC becomes the dataset\'s content as a recipe step, with the tables rebuilt, logged and undoable; the palette offers the group only for models', async (assert) => {
    const meta = await importer.run(fixture.ifcFile(), { format: 'model' }, null, 'Ifcsteg');
    created.push(meta.id);
    const changed = new TextEncoder().encode(fixture.ifcText().replace("'Vägg 1.1'", "'Vägg A'"));
    assert.ok(new TextDecoder().decode(changed).includes("'Vägg A'"), 'the fixture names a wall Vägg 1.1');
    const realStep = bridge.runIfcStep;
    bridge.runIfcStep = async () => ({ bytes: changed, info: { elements: 10, entities: 1, file: 'testhus.ifc' }, log: [] });
    try {
      assert.ok(ops.get('ifc_python') && ops.get('ifc_apply_table'), 'the operations are registered');
      assert.equal(ops.get('ifc_apply_table').params[0].type, 'dataset');
      const before = (await datasets.get(meta.id)).model;
      const result = await recipes.apply(meta.id, 'ifc_python', { code: 'def step(model):\n    return model' });
      assert.equal(result.rows, before.elements, 'as many elements as before: ' + JSON.stringify(result));
      assert.equal((await model.rowsOf(meta.id, "select namn from data where namn = 'Vägg A'")).length, 1, 'the renamed wall is in the table');
      assert.equal((await model.rowsOf(meta.id, "select namn from data where namn = 'Vägg 1.1'")).length, 0, 'the old name is gone');
      const orig = await model.original(meta.id);
      assert.ok(orig && new TextDecoder().decode(orig.bytes).includes("'Vägg A'"), 'the original file is the changed one');
      const after = await datasets.get(meta.id);
      assert.equal(after.model.elements, before.elements);
      assert.equal(after.model.file, 'testhus.ifc');
      const log = await datasets.log(meta.id);
      assert.ok(log.some((e) => JSON.stringify(e).includes('ifc_python')), 'the step is in the log');
      assert.ok(recipes.canUndo(meta.id), 'undo is possible');
      await recipes.undo(meta.id);
      assert.equal((await model.rowsOf(meta.id, "select namn from data where namn = 'Vägg 1.1'")).length, 1, 'undo brings the old wall back');
      assert.ok(new TextDecoder().decode((await model.original(meta.id)).bytes).includes("'Vägg 1.1'"), 'and the old original');
      const dialogs = D.require('ui/dialogs');
      const g = dialogs.GROUPS.find((x) => x.id === 'model');
      assert.ok(g && g.kinds.includes('model') && g.ops.includes('ifc_apply_table') && g.ops.includes('ifc_python'), 'the group Modell for model datasets');
      assert.ok(ops.get('ifc_python').toSQL({ code: 'x' }).join('\n').includes('x') && ops.get('ifc_apply_table').toR({ table: 'T', key: 'guid' }).includes('T'), 'the recipe export shows the step');
    } finally { bridge.runIfcStep = realStep; }
    return 'ok';
  }, 30000);

  test('ifcopenshell: the Mängder tab offers the IfcOpenShell tools and asks for a selection before it starts Python', async (assert) => {
    const meta = await importer.run(fixture.ifcFile(), { format: 'model' }, null, 'Ifcflik');
    created.push(meta.id);
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const stateBefore = bridge.state;
      shell.store.set({ selectedId: meta.id });
      shell.activate('analysera');
      const tabs = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs')).find((el) => /** @type {any} */ (el).tabs && /** @type {any} */ (el).tabs.some((x) => x.id === 'validate')), 8000, 'the Mängder tab with the new tools');
      const ids = /** @type {any} */ (tabs).tabs.map((x) => x.id);
      assert.deepEqual(ids.slice(-7), ['validate', 'ids', 'clash', 'structure', 'psets', 'select', 'geometry'], ids.join(','));
      assert.ok(ids.indexOf('issues') < ids.indexOf('validate'), 'after Ärenden');
      tabs.dispatchEvent(new CustomEvent('dm-change', { detail: { id: 'select' } }));
      await waitFor(() => root.querySelector('[data-ifc-query]'), 5000, 'the selection field');
      await waitFor(() => Array.from(root.querySelectorAll('.dm-tool-result .dm-help')).some((el) => el.textContent === t('model.select.empty')), 5000, 'the note asking for a selection');
      assert.equal(bridge.state, stateBefore, 'looking at the tab does not start Python');
      // The other tools run in Python as soon as they are chosen, so this test leaves them alone (a job left running would
      // collide with the next test); their fields are covered by the real run below.
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 30000);

  test('ifcopenshell: Pyodide opens the model with dm_ifc, the tools answer, a table writes back, a Python step makes a new version, geometry is measured and dm_ifc_write makes a dataset', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const meta = await importer.run(fixture.ifcFile(), { format: 'model' }, null, 'Ifcriktig');
    created.push(meta.id);
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const opened = await bridge.run('m = dm_ifc("Ifcriktig")\nprint(m.schema, len(m.by_type("IfcWall")) > 0, "Pset_WallCommon.LoadBearing" in dm_ifc_psets(m, "IfcWall").columns)');
    assert.equal(stdoutOf(opened).trim(), 'IFC4 True True', JSON.stringify(opened.entries.map((e) => (e.text || '').slice(0, 300))));
    const tree = await bridge.ifcTool(meta.id, 'structure', {});
    assert.ok(tree.rows.some((r) => r[2] === 'IfcBuildingStorey') && tree.rows[0][2] === 'IfcProject', JSON.stringify(tree.rows.slice(0, 4)));
    const validated = await bridge.ifcTool(meta.id, 'validate', {});
    assert.ok(Array.isArray(validated.rows) && validated.columns.map((c) => c.name).includes('meddelande'), 'validation answers with a table');
    const selected = await bridge.ifcTool(meta.id, 'select', { query: 'IfcWall' });
    assert.ok(selected.total > 0 && selected.rows.every((r) => r[1] === 'IfcWall'), 'the selector finds the walls');
    const psets = await bridge.ifcTool(meta.id, 'psets', { ifc_class: 'IfcWall', qtos: true });
    assert.ok(psets.columns.some((c) => c.name === 'Pset_WallCommon.LoadBearing') && psets.columns.some((c) => c.name.includes('BaseQuantities.')), psets.columns.map((c) => c.name).join(','));
    // A table with a GUID column writes attributes and properties back into the model, as a recipe step.
    const guid = String(selected.rows[0][0]);
    const table = await datasets.create({ name: 'Ifcvarden', columns: [{ name: 'guid', type: 'text' }, { name: 'Pset_WallCommon.FireRating', type: 'text' }, { name: 'namn', type: 'text' }], rows: [[guid, 'EI90', 'Vägg X']] });
    created.push(table.id);
    const preview = await recipes.preview(meta.id, 'ifc_apply_table', { table: table.id, key: 'guid' });
    assert.equal(preview.rows, 1, 'the preview counts the elements that change: ' + JSON.stringify(preview));
    await recipes.apply(meta.id, 'ifc_apply_table', { table: table.id, key: 'guid' });
    const fire = await model.rowsOf(meta.id, `select p.varde from _properties p join data d on d.id = p.id where d.guid = '${guid}' and p.namn = 'FireRating'`);
    assert.equal(fire.length && fire[0].varde, 'EI90', 'the property is in the rebuilt tables');
    assert.equal((await model.rowsOf(meta.id, `select namn from data where guid = '${guid}'`))[0].namn, 'Vägg X', 'the attribute too');
    await recipes.apply(meta.id, 'ifc_python', { code: 'def step(model):\n    for w in model.by_type("IfcWall"):\n        w.Description = "prov"\n    return model' });
    const described = await model.rowsOf(meta.id, "select count(*) as n from data where typ = 'IfcWall' and beskrivning = 'prov'");
    assert.ok(Number(described[0].n) > 0, 'the Python step changed the walls');
    assert.ok(recipes.canUndo(meta.id));
    const geometry = await bridge.ifcTool(meta.id, 'geometry', { ifc_class: 'IfcWall' });
    assert.ok(geometry.rows.some((r) => Number(r[3]) > 0), 'a wall has a volume: ' + JSON.stringify(geometry.rows[0]));
    // An IDS file: the walls have a FireRating but no AcousticRating, so one requirement passes and one fails.
    const idsXml = '<?xml version="1.0" encoding="UTF-8"?>\n<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd"><info><title>Provkrav</title></info><specifications><specification name="V\u00e4ggar har brandklass och ljudklass" ifcVersion="IFC4" identifier="S1"><applicability minOccurs="1" maxOccurs="unbounded"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability><requirements><property dataType="IFCLABEL" cardinality="required"><propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet><baseName><simpleValue>FireRating</simpleValue></baseName></property><property dataType="IFCLABEL" cardinality="required"><propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet><baseName><simpleValue>AcousticRating</simpleValue></baseName></property></requirements></specification></specifications></ids>';
    await bridge.writeFile('/data/ids/prov.ids', new TextEncoder().encode(idsXml));
    const checked = await bridge.ifcTool(meta.id, 'ids', { ids: '/data/ids/prov.ids' });
    assert.deepEqual(checked.columns.map((c) => c.name), ['specifikation', 'krav', 'status', 'guid', 'typ', 'namn', 'orsak']);
    assert.ok(checked.summary && checked.summary.specifications === 1 && checked.summary.checks > 0 && checked.summary.checks_fail > 0 && checked.summary.checks_pass > 0, JSON.stringify(checked.summary));
    const statuses = new Set(checked.rows.map((r) => r[2]));
    assert.ok(statuses.has('godkänd') && statuses.has('underkänd'), 'FireRating passes and AcousticRating fails: ' + JSON.stringify(checked.rows.slice(0, 4)));
    assert.ok(checked.rows.filter((r) => r[2] === 'underkänd').every((r) => r[4] === 'IfcWall' && r[6]), 'the failed rows name the wall and a reason');
    const viaPython = await bridge.run('r = dm_ifc_ids(dm_ifc("Ifcriktig"), "/data/ids/prov.ids")\nprint(len(r) > 0, r.attrs["ids"]["checks_fail"] > 0, sorted(set(r["status"])))');
    assert.equal(stdoutOf(viaPython).trim(), "True True ['godkänd', 'underkänd']", JSON.stringify(viaPython.entries.map((e) => (e.text || '').slice(0, 300))));
    const copied = await bridge.run('m = dm_ifc("Ifcriktig")\ndm_ifc_write(m, "Ifckopia")');
    const ds = copied.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds && ds.meta.name === 'Ifckopia' && ds.meta.kind === 'model', JSON.stringify(copied.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 200))));
    created.push(ds.meta.id);
    return 'ok';
  }, 900000);

  test('ifcopenshell: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
