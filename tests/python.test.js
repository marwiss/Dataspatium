// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the Python session: the component catalog, the bridge with a fake engine (offline), and Pyodide itself.
 * The real Pyodide test needs the runtime from jsDelivr (about 22 MB, cached as components afterwards); it runs
 * when the components are already cached or when the page is opened with `?python=1`, and is skipped otherwise.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const catalog = D.require('engines/python/catalog');
  const { bridge, PythonBridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const notebooks = D.require('analysis/notebooks');
  const created = [];
  const stdoutOf = (res) => res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  let real = false;

  test('python: the catalog maps imports to Pyodide packages and follows the lock', (assert) => {
    catalog.reset();
    catalog.parse({ packages: {
      numpy: { version: '2', file_name: 'numpy-2.whl', sha256: 'a', depends: [], imports: ['numpy'] },
      pandas: { version: '3', file_name: 'pandas-3.whl', sha256: 'b', depends: ['numpy', 'pytz'], imports: ['pandas'] },
      pytz: { version: '1', file_name: 'pytz-1.whl', sha256: 'c', depends: [], imports: ['pytz'] },
      matplotlib: { version: '3', file_name: 'mpl.whl', sha256: 'd', depends: ['numpy'], imports: ['matplotlib', 'pylab', 'mpl_toolkits'] },
    } });
    assert.deepEqual(catalog.referenced('import numpy as np, json\nfrom pandas import DataFrame  # import matplotlib in a comment\nimport os; import matplotlib.pyplot as plt\nx = 1'), ['numpy', 'pandas', 'matplotlib']);
    assert.deepEqual(catalog.referenced('from pylab import *'), ['matplotlib']);
    assert.deepEqual(catalog.referenced('print("import numpy")\ndf.import_this()'), []);
    assert.deepEqual(catalog.closure(['pandas']).sort(), ['numpy', 'pandas', 'pytz']);
    assert.deepEqual(catalog.closure(['unknown']), []);
    assert.ok(catalog.has('numpy') && !catalog.has('scipy'));
    assert.ok(catalog.RUNTIME.length === 5 && catalog.RUNTIME.every((f) => /^[0-9a-f]{64}$/.test(f.sha256) && f.size > 0), 'pinned runtime digests');
    assert.ok(catalog.BASE.startsWith('https://cdn.jsdelivr.net/pyodide/v' + catalog.VERSION + '/'), catalog.BASE);
    assert.deepEqual(catalog.STARTUP, ['numpy', 'pandas', 'micropip']);
    catalog.reset();
    return 'Pyodide ' + catalog.VERSION;
  });

  test('python: the bridge mirrors datasets, turns output into console entries and imports dm_write() files', async (assert) => {
    const file = new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\n'], 'pytest.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Pythontest');
    created.push(meta.id);
    /** A fake engine: an in-memory file system and canned answers, so the bridge logic runs without Pyodide. */
    const fs = new Map(); const ran = [];
    const fake = {
      python: '3.14.2', version: '314.0.7', handlers: {},
      on(ev, fn) { this.handlers[ev] = fn; return this; },
      async start() { return this; },
      async mkdir(p) { fs.set(p + '/', true); },
      async writeFile(p, bytes) { fs.set(p, bytes); },
      async readFile(p) { return new Uint8Array(fs.get(p)); },
      async listdir(p) { return Array.from(fs.keys()).filter((k) => k.startsWith(p + '/') && k !== p + '/').map((k) => k.slice(p.length + 1)); },
      async unlink(p) { fs.delete(p); },
      async shipAssets() { return []; },
      async loadPackages() { return []; },
      async run(code) {
        ran.push(code);
        if (code.includes('dm_setup')) return { ok: true, value: null };
        if (code.includes('print')) { this.handlers.stdout('hej\n'); this.handlers.stderr('varning\n'); return { ok: true, value: '42' }; }
        if (code.includes('raise')) return { ok: false, error: 'Traceback (most recent call last):\n  File "<exec>", line 1, in <module>\nValueError: fel' };
        if (code.includes('dm_write')) { fs.set('/data/out/ds_py1.sqlite', await datasets.exportBytes(meta.id)); return { ok: true, value: null }; }
        return { ok: true, value: null };
      },
      async evalJson(code) { return code.includes('_plot_collect') ? [{ key: 1, svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', png: 'iVBORw0KGgo=', width: 672, height: 480 }] : null; },
      interrupt() {}, async close() {},
    };
    const b = new PythonBridge({ createEngine: () => fake });
    const states = []; b.on((type, p) => { if (type === 'state') states.push(p.state); });
    await b.start();
    assert.deepEqual(states, ['starting', 'ready']);
    assert.ok(ran[0].includes('from dataspatium import *') && ran[0].includes('dm_setup(lang="sv")'), ran[0]);
    assert.ok(fs.has('/home/pyodide/dataspatium.py') && fs.has('/data/index.tsv'), 'helper and index written');
    assert.ok(fs.has(`/data/${meta.id}.sqlite`), 'dataset mirrored at start');
    const index = new TextDecoder().decode(new Uint8Array(fs.get('/data/index.tsv')));
    assert.ok(index.includes('Pythontest') && index.includes(meta.shortName), index.split('\n')[1]);
    assert.ok(/^import /.test(new TextDecoder().decode(new Uint8Array(fs.get('/home/pyodide/dataspatium.py'))).split('\n').find((l) => /^import /.test(l))), 'the helper module is the embedded python/dataspatium.py');
    const res = await b.run('print("hej")');
    assert.deepEqual(res.entries.map((e) => e.kind), ['input', 'stdout', 'stderr', 'stdout'], JSON.stringify(res.entries));
    assert.equal(res.entries[1].text, 'hej\n'); assert.equal(res.entries[3].text, '42\n');
    assert.equal(b.state, 'ready');
    const failed = await b.run('raise ValueError("fel")');
    assert.ok(failed.entries.some((e) => e.kind === 'error' && e.text.includes('ValueError: fel')), JSON.stringify(failed.entries));
    b.mplReady = true;
    const plotted = await b.run('x = 1');
    const plot = plotted.entries.find((e) => e.kind === 'plot');
    assert.ok(plot && plot.key === 1 && plot.svg.includes('<svg') && plot.png, 'plot entry: ' + JSON.stringify(plotted.entries.map((e) => e.kind)));
    const written = await b.run('dm_write(df, "Kopia")');
    const ds = written.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds, 'dataset entry: ' + JSON.stringify(written.entries.map((e) => e.kind)));
    created.push(ds.meta.id);
    assert.equal(ds.meta.rowCount, 2);
    assert.ok(ds.meta.id !== meta.id, 'a new dataset');
    assert.ok(!fs.has('/data/out/ds_py1.sqlite'), 'output file removed after import');
    assert.equal(b.resolveIds(['pythontest', 'Pythontest', 'nope'], await datasets.list()).length, 2);
    assert.deepEqual(b.referencedNames('a = dm_read("x"); b = dm_read(\'y\')'), ['x', 'y']);
    assert.equal(b.interrupt(), false, 'nothing running');
    // A notebook cell of type python runs through the same kind of bridge.
    assert.ok(notebooks.CELL_TYPES.includes('python') && notebooks.CELL_TYPES.indexOf('python') === notebooks.CELL_TYPES.indexOf('r') + 1, 'python cells after R: ' + notebooks.CELL_TYPES.join(','));
    assert.equal(notebooks.cell('python', 'x = 1').type, 'python');
    return 'ok';
  }, 30000);

  test('python: Pyodide starts from pinned components, dm_read restores types, figures export and dm_write creates a dataset', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    real = true;
    const file = new File(['kommun;kod;befolkning;andel;datum;aktiv\nStockholm;0180;984748;9,37;2024-12-31;ja\nGöteborg;1480;596841;5,68;2024-12-31;nej\n'], 'pybrygga.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Pybrygga');
    created.push(meta.id);
    await D.require('data/recipes').apply(meta.id, 'set_label', { column: 'befolkning', label: 'Folkmängd', description: 'Antal invånare', unit: 'personer' });
    await bridge.start();
    assert.ok(/^Python 3\./.test(bridge.version), bridge.version);
    const listed = await bridge.run('x = dm_list(); print("Pybrygga" in list(x["namn"]), "pybrygga" in list(x["kortnamn"]))');
    assert.equal(stdoutOf(listed).trim(), 'True True', JSON.stringify(listed.entries));
    const read = await bridge.run('df = dm_read("Pybrygga")\nprint(len(df), str(df["datum"].dtype)[:8], str(df["befolkning"].dtype), str(df["aktiv"].dtype), df["kod"][0], df["andel"][0], df.attrs["dataspatium"]["labels"]["befolkning"], df.attrs["dataspatium"]["descriptions"]["befolkning"], df.attrs["dataspatium"]["units"]["befolkning"], sep="|")');
    assert.equal(stdoutOf(read).trim(), '2|datetime|int64|boolean|0180|9.37|Folkmängd|Antal invånare|personer', JSON.stringify(read.entries));
    const expr = await bridge.run('1 + 1');
    assert.equal(stdoutOf(expr).trim(), '2', 'the last expression is shown like in a REPL');
    const filtered = await bridge.run('print(len(dm_read("pybrygga", columns=["kommun"], where="befolkning > 600000")))');
    assert.equal(stdoutOf(filtered).trim(), '1');
    const plotted = await bridge.run('import matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nax.bar(["a", "b"], [1, 2])\nax.set_title("Pybrygga")');
    const plot = plotted.entries.find((e) => e.kind === 'plot');
    assert.ok(plot && plot.key && plot.svg.includes('<svg') && plot.png.length > 100, 'plot entry: ' + JSON.stringify(plotted.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    assert.ok(plotted.entries.some((e) => e.kind === 'packages' && e.names.includes('matplotlib')), 'matplotlib was fetched for the import');
    const svg = await bridge.exportPlot(plot.key, 'svg');
    assert.ok((await svg.text()).includes('<svg'), 'svg export');
    const pdf = await bridge.exportPlot(plot.key, 'pdf');
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5)), '%PDF-');
    const png = await bridge.exportPlot(plot.key, 'png');
    assert.ok(png.type === 'image/png' && png.size > 1000, 'png export ' + png.size);
    const written = await bridge.run('import pandas as pd\nx = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"], "d": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]), "ok": [True, False, True]})\ndm_write(x, "Från Python", labels={"a": "Antal"}, units={"a": "st"}, descriptions={"a": "Löpnummer"})');
    const ds = written.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds, 'dataset entry: ' + JSON.stringify(written.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    created.push(ds.meta.id);
    assert.equal(ds.meta.name, 'Från Python');
    const cols = await datasets.columns(ds.meta.id);
    assert.deepEqual(cols.map((c) => c.type), ['integer', 'text', 'date', 'boolean']);
    assert.equal(cols[0].label, 'Antal'); assert.equal(cols[0].unit, 'st'); assert.equal(cols[0].description, 'Löpnummer');
    const rows = await datasets.query(ds.meta.id);
    assert.deepEqual(rows[0], [1, 'x', '2024-01-01', 1]);
    // Round trip: what dm_read() gives, dm_write() returns with the same types and values.
    const round = await bridge.run('df2 = dm_read("Pybrygga")\ndm_write(df2, "Pybrygga kopia")');
    const copy = round.entries.find((e) => e.kind === 'dataset');
    assert.ok(copy, 'copy created: ' + JSON.stringify(round.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    created.push(copy.meta.id);
    assert.deepEqual((await datasets.columns(copy.meta.id)).map((c) => c.type), (await datasets.columns(meta.id)).map((c) => c.type));
    assert.deepEqual(await datasets.query(copy.meta.id), await datasets.query(meta.id));
    const failed = await bridge.run('raise ValueError("testfel")');
    const err = failed.entries.find((e) => e.kind === 'error');
    assert.ok(err && err.text.includes('ValueError: testfel') && !err.text.includes('_pyodide'), JSON.stringify(failed.entries));
    // A notebook cell of type python: text and a PNG image.
    const nb = notebooks.create('Pybok', null);
    const cell = notebooks.cell('python', 'print("hej", 1 + 1)\nimport matplotlib.pyplot as plt\nplt.plot([1, 2, 3])');
    await notebooks.runCell(nb, cell);
    const kinds = cell.outputs.map((o) => o.kind);
    assert.ok(kinds.includes('text') && kinds.includes('image'), JSON.stringify(cell.outputs.filter((o) => o.kind !== 'image')));
    assert.ok(cell.outputs.find((o) => o.kind === 'image').dataUrl.startsWith('data:image/png'), 'png data url');
    return `${bridge.version}; startup ${Math.round(bridge.startupMs)} ms`;
  }, 600000);

  test('python: running code stops with interrupt() when the page is cross-origin isolated (from a web server)', async (assert) => {
    if (!real) return 'skipped: Pyodide not started in this run';
    if (!bridge.canInterrupt) {
      assert.equal(bridge.interrupt(), false, 'nothing to stop');
      return 'not isolated (file://): only a restart helps';
    }
    const running = bridge.run('i = 0\nwhile True:\n    i += 1');
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(bridge.interrupt(), 'the interrupt is sent');
    const res = await running;
    assert.ok(res.entries.some((e) => e.kind === 'error' && e.text === D.t('python.interrupted')), JSON.stringify(res.entries));
    const after = await bridge.run('print(i > 0, 1 + 1)');
    assert.equal(stdoutOf(after).trim(), 'True 2', 'the session and its objects remain');
    return 'stopped after ' + Math.round(res.ms) + ' ms';
  }, 120000);

  test('python: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id);
    assert.ok(true);
  });
})();
