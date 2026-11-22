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
  /** The JSON a run printed last; throws with the console entries when there is none. */
  const lastJson = (res) => {
    const lines = stdoutOf(res).trim().split('\n');
    try { return JSON.parse(lines[lines.length - 1]); } catch (_e) { throw new Error('no JSON printed: ' + JSON.stringify(res.entries.map((e) => (e.text || '').slice(0, 300)))); }
  };
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  /** Run with the developer override off (the test page turns it on so that no dialog blocks the suite), as in consent.test.js. */
  async function withoutOverride(fn) {
    const saved = localStorage.getItem('dataspatium.consent');
    localStorage.removeItem('dataspatium.consent');
    try { return await fn(); } finally { if (saved !== null) localStorage.setItem('dataspatium.consent', saved); }
  }
  /** With the override off and components not yet answered, every question goes to `asker`; all is put back afterwards. */
  async function withAsker(asker, fn) {
    const consent = D.require('platform/consent');
    return withoutOverride(async () => {
      const before = await consent.state('components');
      try {
        await consent.set('components', null);
        consent.setAsker(asker);
        return await fn();
      } finally { consent.setAsker(null); await consent.set('components', before); }
    });
  }
  let real = false;

  test('python: the catalog maps imports to Pyodide packages and follows the lock', (assert) => {
    // A small fake lock; reset afterwards so that the real test below loads the pinned one.
    catalog.reset();
    try { catalogChecks(assert); } finally { catalog.reset(); }
    return 'Pyodide ' + catalog.VERSION;
  });
  function catalogChecks(assert) {
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
    // Pinned wheels from PyPI (seaborn, plotly) join the index with their own addresses and import names.
    assert.ok(catalog.has('seaborn') && catalog.info('seaborn').url.startsWith('https://files.pythonhosted.org/') && /^[0-9a-f]{64}$/.test(catalog.info('seaborn').sha256), 'seaborn pinned');
    assert.deepEqual(catalog.referenced('import seaborn as sns\nimport plotly.express as px'), ['seaborn', 'plotly']);
    assert.deepEqual(catalog.closure(['seaborn']).sort(), ['matplotlib', 'numpy', 'pandas', 'pytz', 'seaborn']);
    assert.ok(catalog.EXTRA.every((e) => (e.url || e.asset) && e.sha256 && e.size > 0 && (e.imports.length || e.order)), 'every extra wheel is pinned (IfcOpenShell plug-ins have no import names of their own)');
    assert.ok(catalog.RUNTIME.length === 5 && catalog.RUNTIME.every((f) => /^[0-9a-f]{64}$/.test(f.sha256) && f.size > 0), 'pinned runtime digests');
    assert.ok(catalog.BASE.startsWith('https://cdn.jsdelivr.net/pyodide/v' + catalog.VERSION + '/'), catalog.BASE);
    assert.deepEqual(catalog.STARTUP, ['numpy', 'pandas', 'micropip', 'sqlite3']);
  }

  test('python: the bridge mirrors datasets, turns output into console entries and imports dm_write() files', async (assert) => {
    const file = new File(['kommun;befolkning\nStockholm;984748\nGöteborg;596841\n'], 'pytest.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Pythontest');
    created.push(meta.id);
    /** A fake engine: an in-memory file system and canned answers, so the bridge logic runs without Pyodide. */
    const fs = new Map(); const ran = [];
    const fake = {
      python: '3.13.2', version: '0.29.5', handlers: {},
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
    assert.ok(ran[0].includes('from dataspatium import *') && ran[0].includes('dm_setup(lang="sv"'), ran[0]);
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
    const helpers = await bridge.run('print(callable(dm_read_nodes), callable(dm_read_edges), callable(dm_read_properties), callable(dm_read_quantities))');
    assert.equal(stdoutOf(helpers).trim(), 'True True True True', 'from dataspatium import * gives the helpers of graphs and models');
    const modelMeta = await importer.run(D.require('tests/fixtures/ifc').ifcFile(), { format: 'model' }, null, 'Pymodell');
    created.push(modelMeta.id);
    const modelRead = await bridge.run('q = dm_read_quantities("Pymodell"); p = dm_read_properties("Pymodell"); print(len(q), round(q[q["namn"] == "NetVolume"]["varde"].sum(), 3), len(dm_read("Pymodell")), "FireRating" in list(p["namn"]))');
    assert.equal(stdoutOf(modelRead).trim(), '12 8.0 10 True', JSON.stringify(modelRead.entries));
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
    // A Python step in a recipe replaces the table (types from the result) and previews on the first rows.
    const recipes = D.require('data/recipes');
    const stepCode = 'def step(df):\n    df["tusental"] = (df["befolkning"] / 1000).round().astype(int)\n    return df.sort_values("kommun")';
    const pv = await recipes.preview(meta.id, 'python_step', { code: stepCode });
    assert.equal(pv.rows, 2); assert.equal(pv.columns[pv.columns.length - 1], 'tusental');
    const stepped = await recipes.apply(meta.id, 'python_step', { code: stepCode });
    assert.equal(stepped.rows, 2);
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.type), ['text', 'text', 'integer', 'number', 'date', 'boolean', 'integer']);
    assert.equal((await datasets.query(meta.id))[0][0], 'Göteborg');
    assert.ok((await recipes.toR(meta.id)).includes('# def step(df):'), 'R export carries the Python code as comments');
    // seaborn: a pinned wheel from PyPI, installed by its asset address after its dependencies.
    const sb = await bridge.run('import seaborn as sns\nsns.barplot(x=["a", "b"], y=[1, 2])');
    assert.ok(sb.entries.some((e) => e.kind === 'plot' && e.svg), 'seaborn plot: ' + JSON.stringify(sb.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    // plotly: the figure arrives as JSON and is drawn and exported by plotly.js (a component).
    const pl = await bridge.run('import plotly.express as px\nfig = px.bar(x=["a", "b"], y=[1, 2], title="Plotlytest")\nfig.show()\nfig');
    const plPlots = pl.entries.filter((e) => e.kind === 'plot' && e.plotly);
    assert.ok(plPlots.length === 2 && plPlots[0].plotly.data && plPlots[0].plotly.data.length === 1, 'plotly figures (show and last value): ' + JSON.stringify(pl.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    assert.ok(!pl.entries.some((e) => e.kind === 'stdout' && /Figure\(/.test(e.text)), 'no repr of the figure');
    const plPng = await bridge.exportPlot(plPlots[0].key, 'png', { width: 6, height: 4 });
    assert.ok(plPng.type === 'image/png' && plPng.size > 1000, 'plotly png via plotly.js ' + plPng.size);
    assert.ok((await (await bridge.exportPlot(plPlots[0].key, 'svg')).text()).includes('<svg'), 'plotly svg');
    const plDoc = document.createElement('div'); document.body.appendChild(plDoc);
    try { const hd = await D.require('viz/plotly').render(plDoc, plPlots[0].plotly, { width: 400, height: 300 }); assert.ok(plDoc.querySelector('.plotly'), 'plotly drew into the element'); hd.finalize(); } finally { plDoc.remove(); }
    // A saved Python chart renders headless with a filter (documents, batch, Exportera).
    const charts = D.require('viz/charts'); const render = D.require('viz/render');
    const chart = charts.create('python', meta, 'Pychart');
    chart.python.code = 'import matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nax.bar(df["kommun"], df["befolkning"])\nprint(len(df))';
    const cpng = await render.toBlob(chart, 'png', { width: 640, height: 400, extraFilters: [{ field: 'kommun', op: '=', value: 'Göteborg' }] });
    assert.ok(cpng.type === 'image/png' && cpng.size > 1000, 'python chart png ' + cpng.size);
    let memory = '';
    if (typeof performance.measureUserAgentSpecificMemory === 'function') {
      try { await D.require('data/r-bridge').bridge.start(); const m = await performance.measureUserAgentSpecificMemory(); memory = `; ${Math.round(m.bytes / 1e6)} MB with R and Python started`; assert.ok(m.bytes < 1.5e9, 'R and Python together stay under 1.5 GB: ' + m.bytes); } catch (err) { memory = '; memory not measured (' + ((err && err.message) || err) + ')'; }
    }
    return `${bridge.version}; startup ${Math.round(bridge.startupMs)} ms${memory}`;
  }, 900000);

  test('python: Python opens no sockets: its socket functions name pyfetch, a socket past them finds no WebSocket in the emulation, and pyfetch still reads', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    await bridge.start();
    // Emscripten's socket emulation would make each connection a WebSocket to ws://host:port/. The addresses are the discard port
    // on this computer and a name that never resolves, so even a broken block reaches no server.
    const res = await bridge.run([
      'import errno, json, socket, _socket, urllib.request, js, pyodide.http',
      'def tried(call):',
      '    try:',
      '        call()',
      '    except OSError as e:',
      '        return [type(e).__name__, e.errno, str(e)]',
      '    return None',
      'def raw(kind, call):',
      '    s = _socket.socket(_socket.AF_INET, kind)',
      '    try:',
      '        return tried(lambda: call(s))',
      '    finally:',
      '        s.close()',
      'out = {',
      '    "create_connection": tried(lambda: socket.create_connection(("127.0.0.1", 9), timeout=1)),',
      '    "getaddrinfo": tried(lambda: socket.getaddrinfo("dataspatium.invalid", 443)),',
      '    "connect": tried(lambda: socket.socket().connect(("127.0.0.1", 9))),',
      '    "urlopen": tried(lambda: urllib.request.urlopen("http://127.0.0.1:9/", timeout=1)),',
      '    "raw": raw(_socket.SOCK_STREAM, lambda s: s.connect(("127.0.0.1", 9))),',
      '    "udp": raw(_socket.SOCK_DGRAM, lambda s: s.sendto(b"x", ("127.0.0.1", 9))),',
      '    "unreachable": errno.EHOSTUNREACH,',
      '    "js": [n for n in ("WebSocket", "WebTransport") if getattr(js, n, None) is not None],',
      '}',
      'r = await pyodide.http.pyfetch("dataspatium-asset://pyodide/pyodide-lock.json")',
      'out["pyfetch"] = [r.status, len(await r.bytes()) > 1000]',
      'print(json.dumps(out))',
    ].join('\n'));
    const lines = stdoutOf(res).trim().split('\n');
    const out = JSON.parse(lines[lines.length - 1] || 'null');
    assert.ok(out, JSON.stringify(res.entries.map((e) => (e.text || '').slice(0, 300))));
    const said = D.t('python.net.blocked', { api: 'sockets' });
    for (const key of ['create_connection', 'getaddrinfo', 'connect', 'urlopen']) {
      assert.ok(out[key] && out[key][2].includes(said), key + ' says why in the app\'s language: ' + JSON.stringify(out[key]));
    }
    for (const key of ['raw', 'udp']) assert.ok(out[key] && out[key][1] === out.unreachable, key + ' past the patches fails in the emulation, which has no WebSocket: ' + JSON.stringify(out[key]));
    assert.deepEqual(out.js, [], 'no WebSocket or WebTransport for Python code');
    assert.deepEqual(out.pyfetch, [200, true], 'pyfetch reads through the app\'s gate');
    return 'blocked: ' + out.create_connection[0] + ', ' + out.urlopen[0] + ', _socket errno ' + out.raw[1];
  }, 300000);

  test('python: Python reaches the internet through fetch only: open_url, pyxhr, XMLHttpRequest, importScripts and Cache.add are refused with the message, EventSource, caches, IndexedDB, BroadcastChannel and the navigator\'s storage, storageBuckets, locks and serviceWorker are gone, Worker starts nothing, and pyfetch still reads an asset', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    await bridge.start();
    // Port 9 on this computer, which browsers refuse anyway: even a broken block reaches no server.
    const res = await bridge.run([
      'import json, js, pyodide.code, pyodide.http',
      'from pyodide.http import pyxhr',
      'def refused(call):',
      '    try:',
      '        call()',
      '    except Exception as e:',
      '        return [type(e).__name__, str(e), str(e.__cause__) if e.__cause__ else ""]',
      '    return None',
      'def xhr(asynchronous):',
      '    x = js.XMLHttpRequest.new()',
      '    x.open("GET", "http://127.0.0.1:9/", asynchronous)',
      '    x.send()',
      'out = {',
      '    "open_url": refused(lambda: pyodide.http.open_url("http://127.0.0.1:9/")),',
      '    "pyxhr": refused(lambda: pyxhr.get("http://127.0.0.1:9/")),',
      '    "sync": refused(lambda: xhr(False)),',
      '    "async": refused(lambda: xhr(True)),',
      '    "importScripts": refused(lambda: js.importScripts("http://127.0.0.1:9/x.js")),',
      '    "gone": [n for n in ("WebSocket", "WebSocketStream", "WebTransport", "EventSource", "BroadcastChannel", "Notification", "caches", "indexedDB") if getattr(js, n, None) is not None],',
      '    "storage": getattr(js.navigator, "storage", None) is None,',
      '}',
      'out["nav"] = pyodide.code.run_js("[typeof navigator.userAgent, typeof navigator.storage, typeof navigator.storageBuckets, typeof navigator.locks, typeof navigator.serviceWorker, Object.isFrozen(navigator)].join(\' \')")',
      'out["cache"] = await pyodide.code.run_js("Promise.resolve(typeof Cache !== \'function\' ? \'no Cache\' : Cache.prototype.add.call(Object.create(Cache.prototype), \'http://127.0.0.1:9/cache\').then(function () { return \'added\'; }, function (e) { return e.message; }))")',
      'w = js.Worker.new("http://127.0.0.1:9/w.js")',
      'w.postMessage("hi")',
      'out["worker"] = pyodide.code.run_js("[typeof Worker, typeof SharedWorker, /native code/.test(String(Worker)), __dataspatium.refused().some(function (r) { return r.api === \'Worker\' && r.url === \'http://127.0.0.1:9/w.js\'; })].join(\' \')")',
      'r = await pyodide.http.pyfetch("dataspatium-asset://pyodide/pyodide-lock.json")',
      'out["pyfetch"] = [r.status, len(await r.bytes()) > 1000]',
      'print(json.dumps(out))',
    ].join('\n'));
    const out = lastJson(res);
    const xhrText = D.t('python.net.blocked', { api: 'XMLHttpRequest' });
    for (const key of ['open_url', 'sync', 'async']) assert.ok(out[key] && out[key][1].includes(xhrText), key + ': ' + JSON.stringify(out[key]));
    assert.ok(out.pyxhr && out.pyxhr[0] === 'XHRNetworkError' && out.pyxhr[2].includes(xhrText), 'pyxhr turns the refusal into its network error: ' + JSON.stringify(out.pyxhr));
    assert.ok(out.importScripts && out.importScripts[1].includes(D.t('python.net.blocked', { api: 'importScripts' })), JSON.stringify(out.importScripts));
    assert.deepEqual(out.gone, [], 'no sockets, streams, notifications, caches, IndexedDB or BroadcastChannel for Python code');
    assert.equal(out.storage, true, 'no navigator.storage');
    assert.equal(out.nav, 'string undefined undefined undefined undefined true', 'the navigator is a frozen copy that keeps its userAgent and has no storage, storageBuckets, locks or serviceWorker');
    assert.ok(out.cache === 'no Cache' || out.cache === D.t('python.net.blocked', { api: 'Cache.add' }), 'Cache.add is refused with the message: ' + out.cache);
    assert.equal(out.worker, 'function function false true', 'Worker and SharedWorker are stand-ins: the worker was refused with its address and started nothing');
    assert.deepEqual(out.pyfetch, [200, true], 'pyfetch of an asset still works');
    return 'refused: ' + ['open_url', 'pyxhr', 'sync', 'async', 'importScripts'].map((k) => out[k][0]).join(', ');
  }, 300000);

  test('python: urllib3 and requests import, also from a web server, where urllib3 finds a Worker that starts nothing; requests reaches the internet through fetch where the browser has JSPI and through XMLHttpRequest, which is refused, elsewhere', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    await bridge.start();
    const t0 = Date.now();
    // Port 9 on this computer, which browsers refuse anyway: even a broken block reaches no server. The test page allows the
    // internet for components, so with JSPI the request passes the consent and the browser refuses it.
    const res = await bridge.run([
      'import json, js, pyodide.code, pyodide.ffi',
      'import urllib3, requests',
      'from urllib3.contrib.emscripten import fetch as u3fetch',
      'out = {"isolated": bool(getattr(js, "crossOriginIsolated", False)), "fetcher": u3fetch._fetcher is not None, "streaming": u3fetch.streaming_ready(), "jspi": bool(pyodide.ffi.can_run_sync())}',
      'if u3fetch._fetcher is not None:',
      '    try:',
      '        await u3fetch.wait_for_streaming_ready()',
      '        out["ready"] = "ready"',
      '    except Exception as e:',
      '        out["ready"] = type(e).__name__',
      'try:',
      '    requests.get("http://127.0.0.1:9/requests", timeout=5)',
      '    out["get"] = None',
      'except Exception as e:',
      '    out["get"] = [type(e).__name__, str(e)]',
      'out["refused"] = pyodide.code.run_js("__dataspatium.refused().map(function (r) { return r.api; }).join(\' \')")',
      'print(json.dumps(out))',
    ].join('\n'));
    const out = lastJson(res);
    if (out.isolated) {
      assert.ok(out.fetcher && out.streaming === false, 'served (cross-origin isolated): urllib3 built its streaming fetcher on the stand-in, which never gets ready: ' + JSON.stringify(out));
      assert.ok(out.ready && out.ready !== 'ready', 'waiting for it fails instead of hanging: ' + out.ready);
      assert.ok(out.refused.split(' ').includes('Worker'), 'the stand-in refused the worker: ' + out.refused);
    } else {
      assert.equal(out.fetcher, false, 'not isolated (file://): urllib3 builds no streaming fetcher');
    }
    assert.ok(out.get && out.get[0] === 'ConnectionError', 'the request fails: ' + JSON.stringify(out.get));
    const logged = D.net.log().filter((e) => e.at >= t0 && e.url === 'http://127.0.0.1:9/requests');
    if (out.jspi) {
      assert.ok(logged.length === 1 && logged[0].status === 'error', 'with JSPI requests went through the worker\'s fetch, past the consent, and is in the network log: ' + JSON.stringify(logged));
      assert.ok(!out.get[1].includes(D.t('python.net.blocked', { api: 'XMLHttpRequest' })), 'and not through XMLHttpRequest');
    } else {
      assert.ok(out.get[1].includes(D.t('python.net.blocked', { api: 'XMLHttpRequest' })), 'without JSPI requests used XMLHttpRequest, refused with the message: ' + out.get[1]);
      assert.equal(logged.length, 0, 'nothing went out');
    }
    return (out.isolated ? 'isolated' : 'not isolated') + ', ' + (out.jspi ? 'JSPI: fetch' : 'no JSPI: XMLHttpRequest');
  }, 300000);

  test('python: pyfetch to the internet asks for consent for components with the host, is refused when the person says no, and shows in the network log when allowed', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    await bridge.start();
    // Port 9 on this computer, which browsers refuse anyway: even a broken gate reaches no server.
    const probe = async (url) => lastJson(await bridge.run([
      'import json, pyodide.http',
      'try:',
      '    await pyodide.http.pyfetch(' + JSON.stringify(url) + ')',
      '    out = None',
      'except Exception as e:',
      '    out = [type(e).__name__, str(e)]',
      'print(json.dumps(out))',
    ].join('\n')));
    const asked = [];
    let allow = false;
    const t0 = Date.now();
    const out = await withAsker(async (purpose, info) => { asked.push([purpose, info.host, info.label]); return { allow, remember: false }; }, async () => {
      const refused = await probe('http://127.0.0.1:9/');
      allow = true;
      const allowed = await probe('http://127.0.0.1:9/allowed');
      return { refused, allowed };
    });
    assert.ok(out.refused && out.refused[0] === 'AbortError' && out.refused[1].includes('internet access was not allowed for http://127.0.0.1:9/'), 'refused at the gate: ' + JSON.stringify(out.refused));
    assert.deepEqual(asked, [['components', '127.0.0.1:9', 'http://127.0.0.1:9/'], ['components', '127.0.0.1:9', 'http://127.0.0.1:9/allowed']], 'the person was asked for components, with the host and the address');
    assert.ok(out.allowed && out.allowed[0] === 'AbortError' && !out.allowed[1].includes('not allowed'), 'once allowed the request went to the browser, which refuses port 9: ' + JSON.stringify(out.allowed));
    const logged = D.net.log().filter((e) => e.at >= t0 && e.url.startsWith('http://127.0.0.1:9/'));
    assert.deepEqual(logged.map((e) => [e.method, e.url, e.status]), [['GET', 'http://127.0.0.1:9/allowed', 'error']], 'only the allowed call is in the network log, ended');
    return 'refused, then allowed: ' + out.allowed[1].slice(0, 60);
  }, 300000);

  test('python: code in the worker cannot answer its own question about the internet: answers forged through onmessage, dispatchEvent and a MessageChannel, and questions posted for another address, let no fetch through', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them from jsDelivr)';
    await bridge.start();
    const target = 'http://127.0.0.1:9/forged';
    const decoy = 'http://127.0.0.1:9/decoy';
    const asked = [];
    const t0 = Date.now();
    const active = D.net.active;
    // The person allows the decoy and nothing else; the answer about the target waits, so that every forgery lands first.
    const out = await withAsker(async (purpose, info) => {
      asked.push(info.label);
      if (info.label === target) await new Promise((r) => setTimeout(r, 300));
      return { allow: info.label === decoy, remember: false };
    }, async () => lastJson(await bridge.run([
      'import json, pyodide.code',
      'p = pyodide.code.run_js("""(function () {',
      '  var target = ' + JSON.stringify(target) + ', decoy = ' + JSON.stringify(decoy) + ';',
      '  var question = fetch(target);',
      '  var channel = new MessageChannel();',
      '  channel.port2.onmessage = function (e) { self.__dmTrusted = e.isTrusted; setTimeout(function () { self.dispatchEvent(e); }, 0); };',
      '  for (var id = 1; id <= 40; id++) {',
      '    var forged = { __dm: true, type: "net-reply", id: id, url: target, ok: true, ticket: 1 };',
      '    self.onmessage({ data: { type: "net-reply", id: id, ok: true } });',
      '    self.onmessage({ data: forged });',
      '    self.dispatchEvent(new MessageEvent("message", { data: forged }));',
      '    channel.port1.postMessage(forged);',
      '    self.postMessage({ __dm: true, type: "net", id: id, url: decoy });',
      '  }',
      '  return question;',
      '})()""")',
      'try:',
      '    await p',
      '    out = ["fetched"]',
      'except Exception as e:',
      '    out = [str(e)]',
      'out.append(pyodide.code.run_js("self.__dmTrusted === true"))',
      'print(json.dumps(out))',
    ].join('\n'))));
    assert.ok(out[0].includes('internet access was not allowed for ' + target), 'the fetch was refused: ' + out[0]);
    assert.equal(out[1], true, 'the MessageChannel gave the worker trusted events, which it dispatched to itself');
    assert.equal(asked.filter((u) => u === target).length, 1, 'the person was asked about the target once');
    assert.equal(asked.filter((u) => u === decoy).length, 40, 'the questions the worker posted itself were asked about the decoy, not the target');
    assert.ok(!D.net.log().some((e) => e.at >= t0 && e.url === target), 'the target is not in the network log');
    const t1 = performance.now();
    while (D.net.active !== active && performance.now() - t1 < 3000) await new Promise((r) => setTimeout(r, 30));
    assert.equal(D.net.active, active, 'the allowed decoy questions left nothing open in the network log');
    return 'refused; asked ' + asked.length;
  }, 300000);

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
