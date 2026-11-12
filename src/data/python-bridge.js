// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Bridge between the workspace and the Python session, the counterpart of data/r-bridge.js.
 *
 * Datasets are mirrored into Pyodide's file system as SQLite files (/data/<id>.sqlite) plus an index
 * (/data/index.tsv) that python/dataspatium.py reads. Before each command the datasets referenced with
 * dm_read("…") are mirrored (if changed) and the wheels the code imports are fetched (after consent) and
 * shipped; the command runs in the worker; matplotlib figures are collected as SVG and PNG and kept for
 * export; files written by dm_write() in /data/out are imported back as new datasets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/python-bridge', ['engines/python', 'engines/python/catalog', 'data/datasets'], (pymod, catalog, datasets) => {
    const DATA_DIR = '/data';
    const OUT_DIR = '/data/out';
    const HELPER_DIR = '/home/pyodide';
    const MIRROR_LIMIT = 50 * 1024 * 1024;

    class PythonBridge {
      /** @param {{createEngine?: () => any}} [options] a factory for tests */
      constructor(options = {}) {
        this.createEngine = options.createEngine || (() => new pymod.PythonEngine());
        /** @type {any} */ this.engine = null;
        /** @type {Promise<void>|null} */ this.ready = null;
        /** @type {'idle'|'starting'|'ready'|'busy'|'error'} */ this.state = 'idle';
        this.error = null;
        this.version = '';
        this.startupMs = 0;
        /** Download progress while starting: {received, total} or null. */
        this.progress = null;
        /** @type {Map<string, string>} dataset id -> updatedAt mirrored */ this.mirrored = new Map();
        /** stdout/stderr lines of the running command, in order. @type {Array<{kind: string, text: string}>} */
        this.streams = [];
        this.mplReady = false;
        this.plotlyReady = false;
        /** plotly figures shown this session (key -> figure JSON), exported by viz/plotly on the main thread. */
        this.plotlyFigures = new Map();
        this.interrupted = false;
        this.listeners = new Set();
      }

      on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
      emit(type, payload) { for (const fn of Array.from(this.listeners)) { try { fn(type, payload); } catch (err) { console.error(err); } } }
      setState(state) { this.state = state; this.emit('state', { state }); }

      /** Start Python (fetching the runtime the first time) and load the Dataspatium helpers (idempotent). */
      start() {
        if (this.ready) return this.ready;
        this.setState('starting');
        this.ready = (async () => {
          try {
            const t0 = performance.now();
            this.engine = this.createEngine();
            this.engine.on('stdout', (text) => this.onStream('stdout', text));
            this.engine.on('stderr', (text) => this.onStream('stderr', text));
            this.engine.on('progress', (info) => { this.progress = info; this.emit('progress', info); });
            this.engine.on('closed', (err) => { this.error = D.t('python.err.closed'); this.setState('error'); D.log('python', 'worker closed', err); });
            await this.engine.start();
            this.progress = null;
            const src = await D.assets.loadText('python/dataspatium.py');
            await this.engine.mkdir(DATA_DIR);
            await this.engine.mkdir(OUT_DIR);
            await this.engine.mkdir(HELPER_DIR);
            await this.engine.writeFile(`${HELPER_DIR}/dataspatium.py`, new TextEncoder().encode(src).buffer);
            // User-facing messages follow the app's language (see MESSAGES in python/dataspatium.py).
            const lang = D.require('ui/i18n').language();
            // __dm_format_result lets the worker show figures as plots instead of their repr (see python-engine.js).
            const setup = await this.engine.run(`import sys\nif ${JSON.stringify(HELPER_DIR)} not in sys.path: sys.path.insert(0, ${JSON.stringify(HELPER_DIR)})\nimport dataspatium as _dataspatium\nfrom dataspatium import *\n__dm_format_result = _dataspatium._format_result\n_dataspatium.dm_setup(lang=${JSON.stringify(lang)})\n`);
            if (!setup.ok) throw new Error(setup.error);
            this.streams = [];
            await this.mirrorAll();
            this.version = `Python ${this.engine.python} (Pyodide ${this.engine.version})`;
            this.startupMs = performance.now() - t0;
            this.setState('ready');
          } catch (err) {
            this.error = (err && err.message) || String(err);
            this.setState('error');
            // A failed start is not replayed forever: the next start() tries again with a fresh engine.
            const failed = this.engine;
            this.engine = null; this.ready = null; this.mirrored.clear(); this.progress = null;
            if (failed) { try { await failed.close(); } catch (_err) { /* already gone */ } }
            throw err;
          }
        })();
        return this.ready;
      }

      onStream(kind, text) {
        this.streams.push({ kind, text });
        this.emit('stream', { kind, text });
      }

      /** Write the dataset index and the given datasets into /data. */
      async mirror(ids) {
        const list = await datasets.list();
        for (const id of ids) {
          const meta = list.find((d) => d.id === id);
          if (!meta) continue;
          if (this.mirrored.get(id) === meta.updatedAt) continue;
          let bytes;
          try { bytes = await datasets.exportBytes(id); }
          catch (err) {
            // Removed between list() and here (a batch delete, another tab): leave it out instead of failing the run.
            if (!(await datasets.get(id))) { this.mirrored.delete(id); D.log('python', 'mirror skipped a removed dataset', id); continue; }
            throw err;
          }
          await this.engine.writeFile(`${DATA_DIR}/${id}.sqlite`, bytes);
          this.mirrored.set(id, meta.updatedAt);
        }
        const index = list.map((m) => ({ id: m.id, name: m.name, shortName: m.shortName || '', folder: m.folder || '', file: `${DATA_DIR}/${m.id}.sqlite`, rowCount: m.rowCount || 0, columnCount: m.columnCount || 0, updatedAt: m.updatedAt || '', mirrored: this.mirrored.has(m.id) }));
        // Tab-separated, the same file r/dataspatium.R reads; python/dataspatium.py uses the csv module.
        const clean = (v) => String(v === null || v === undefined ? '' : v).replace(/[\t\r\n]+/g, ' ');
        const lines = ['id\tname\tshortName\tfolder\tfile\trowCount\tcolumnCount\tupdatedAt\tmirrored'];
        for (const m of index) lines.push([m.id, m.name, m.shortName, m.folder, m.file, m.rowCount, m.columnCount, m.updatedAt, m.mirrored ? 'TRUE' : 'FALSE'].map(clean).join('\t'));
        await this.engine.writeFile(`${DATA_DIR}/index.tsv`, new TextEncoder().encode(lines.join('\n') + '\n').buffer);
        return index;
      }

      /** Mirror every dataset below the size limit. */
      async mirrorAll() {
        const list = await datasets.list();
        return this.mirror(list.filter((m) => (m.byteSize || 0) <= MIRROR_LIMIT).map((m) => m.id));
      }

      /** Packages a piece of code imports, with the package index loaded first (the scan needs the lock's import names). */
      async referencedPackages(code) {
        try { await catalog.load(); } catch (err) { D.log('python-bridge', 'package index not available', err); }
        return catalog.referenced(code);
      }

      /** Dataset names referenced with dm_read("…") in a piece of code. */
      referencedNames(code) {
        const names = [];
        const re = /dm_(?:read(?:_edges|_nodes|_properties|_quantities)?|ifc)\(\s*(["'])([^"']+)\1/g;
        let m;
        while ((m = re.exec(code))) names.push(m[2]);
        return names;
      }

      resolveIds(names, list) {
        const ids = [];
        for (const n of names) {
          const lower = n.toLowerCase();
          // "Mapp/Namn" and "mapp/kortnamn" address a dataset through its folder.
          const qualified = (d) => ((d.folder ? d.folder + '/' : '') + d.name).toLowerCase();
          const qualifiedShort = (d) => (d.folder ? d.folder.toLowerCase() + '/' : '') + (d.shortName || '');
          const exact = list.find((d) => d.id === n || d.name === n || d.shortName === lower || qualified(d) === lower || qualifiedShort(d) === lower);
          const ci = list.filter((d) => d.name.toLowerCase() === lower);
          const prefix = list.filter((d) => d.name.toLowerCase().startsWith(lower));
          const hit = exact || (ci.length === 1 ? ci[0] : null) || (prefix.length === 1 ? prefix[0] : null);
          if (hit) ids.push(hit.id);
        }
        return ids;
      }

      /**
       * Fetch (after consent) and ship the wheels of the packages the code imports. A refusal or a network error
       * only leaves Python to report the missing module. matplotlib gets the Agg backend and the app's theme before
       * it is first used.
       * @param {string[]} names package names from catalog.referenced()
       * @returns {Promise<string[]>} packages newly made available
       */
      async ensurePackages(names) {
        if (!names.length) return [];
        let fetched = [];
        try {
          const res = await catalog.ensurePackages(names, { onProgress: (info) => this.emit('progress', info) });
          if (res.assets.length) await this.engine.shipAssets(res.assets);
          fetched = res.packages;
        } catch (err) {
          D.log('python-bridge', err && err.name === 'ConsentError' ? 'packages not allowed' : 'packages failed', err);
          return fetched;
        }
        const closure = catalog.closure(names);
        // Wheels outside Pyodide's distribution (seaborn, plotly) are installed by their asset address, after their
        // dependencies from the distribution: a wheel given as an address does not pull those in by itself.
        const extras = closure.map((n) => catalog.info(n)).filter((e) => e && (e.url || e.asset)).sort((a, b) => (a.order || 0) - (b.order || 0));
        if (extras.length) {
          try {
            const deps = closure.filter((n) => { const e = catalog.info(n); return e && !e.url && !e.asset; });
            if (deps.length) await this.engine.loadPackages(deps);
            // One at a time, in order: IfcOpenShell's plug-ins link against the wheels installed before them.
            for (const e of extras) await this.engine.loadPackages([catalog.INDEX_URL + e.file]);
          } catch (err) { D.log('python', 'extra wheels failed', err); }
        }
        if (!this.mplReady && closure.includes('matplotlib')) {
          try {
            await this.engine.loadPackages(['matplotlib']);
            const r = await this.engine.run('_dataspatium._matplotlib_setup()');
            if (r.ok) this.mplReady = true; else D.log('python', 'matplotlib setup failed', r.error);
          } catch (err) { D.log('python', 'matplotlib setup failed', err); }
        }
        if (!this.plotlyReady && closure.includes('plotly')) {
          try {
            const r = await this.engine.run('_dataspatium._plotly_setup()');
            if (r.ok) this.plotlyReady = true; else D.log('python', 'plotly setup failed', r.error);
          } catch (err) { D.log('python', 'plotly setup failed', err); }
        }
        return fetched;
      }

      /**
       * A code step in a recipe: run `def step(df): ...` on the dataset bytes (a SQLite file) and return the resulting
       * file. Used by data/code-steps; a Python error is thrown with its traceback.
       * @param {string} code @param {ArrayBuffer|Uint8Array} bytes @param {{limit?: number, name?: string}} [options]
       * @returns {Promise<{bytes: ArrayBuffer, rows: number, columns: string[], log: Array<{kind: string, text: string}>}>}
       */
      async runStep(code, bytes, options = {}) {
        await this.start();
        if (this.state === 'busy') throw new Error(D.t('python.err.busy'));
        this.setState('busy');
        try {
          await this.engine.mkdir('/data/step');
          await this.engine.writeFile('/data/step/in.sqlite', bytes);
          await this.ensurePackages((await this.referencedPackages(code)));
          this.streams = [];
          const info = await this.engine.evalJson(`_dataspatium._run_step(${JSON.stringify(String(code))}, "/data/step/in.sqlite", "/data/step/out.sqlite", ${options.limit ? Number(options.limit) : 'None'}, ${JSON.stringify(String(options.name || ''))})`);
          const out = await this.engine.readFile('/data/step/out.sqlite');
          for (const p of ['/data/step/in.sqlite', '/data/step/out.sqlite']) { try { await this.engine.unlink(p); } catch (_err) { /* ignore */ } }
          return { bytes: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength), rows: Number(info && info.rows) || 0, columns: (info && info.columns) || [], log: this.streams.slice() };
        } finally {
          this.streams = [];
          if (this.state === 'busy') this.setState('ready');
        }
      }

      /**
       * Run user code. Resolves with the console entries to display.
       * @param {string} code
       * @returns {Promise<{entries: any[], ms: number}>}
       */
      async run(code) {
        await this.start();
        if (this.state === 'busy') throw new Error(D.t('python.err.busy'));
        this.setState('busy');
        const t0 = performance.now();
        const entries = [{ kind: 'input', text: code }];
        let installed = [];
        this.interrupted = false;
        this.streams = [];
        try {
          const list = await datasets.list();
          const ids = this.resolveIds(this.referencedNames(code), list);
          await this.mirror(ids);
          installed = await this.ensurePackages((await this.referencedPackages(code)));
          this.streams = [];
          const res = await this.engine.run(code);
          for (const s of this.streams) entries.push({ kind: s.kind, text: s.text });
          this.streams = [];
          if (res.ok) {
            if (res.value !== null && res.value !== undefined) entries.push({ kind: 'stdout', text: String(res.value) + '\n' });
          } else {
            const stopped = this.interrupted || /KeyboardInterrupt/.test(String(res.error));
            entries.push({ kind: 'error', text: stopped ? D.t('python.interrupted') : String(res.error) });
          }
        } catch (err) {
          for (const s of this.streams) entries.push({ kind: s.kind, text: s.text });
          this.streams = [];
          entries.push({ kind: 'error', text: this.interrupted ? D.t('python.interrupted') : cleanError(err) });
        }
        if (installed.length) entries.splice(1, 0, { kind: 'packages', names: installed });
        try {
          for (const f of await this.collectPlots()) {
            if (f.plotly) { this.plotlyFigures.set(f.key, f.plotly); entries.push({ kind: 'plot', plotly: f.plotly, width: f.width, height: f.height, key: f.key }); }
            else entries.push({ kind: 'plot', svg: f.svg, png: f.png, width: f.width, height: f.height, key: f.key });
          }
        } catch (err) { D.log('python', 'plot collection failed', err); }
        for (const meta of await this.collectOutputs()) entries.push({ kind: 'dataset', meta });
        if (this.state === 'busy') this.setState('ready');
        return { entries, ms: performance.now() - t0 };
      }

      /**
       * Open matplotlib figures as {key, svg, png (base64), width, height} and shown plotly figures as {key, plotly};
       * matplotlib figures stay in Python for export, plotly figures are exported by viz/plotly.
       */
      async collectPlots() {
        if (!this.engine || (!this.mplReady && !this.plotlyReady)) return [];
        return (await this.engine.evalJson('_dataspatium._plot_collect()')) || [];
      }

      /**
       * Import what the command left in /data/out and remove it from the virtual filesystem: SQLite files written by dm_write()
       * become datasets, IFC files written by dm_ifc_write() (with their .json sidecar: name, description, file) become model datasets.
       */
      async collectOutputs() {
        if (!this.engine) return [];
        const names = (await this.engine.listdir(OUT_DIR)).filter((n) => n.endsWith('.sqlite') || n.endsWith('.ifc'));
        const created = [];
        for (const name of names) {
          const path = `${OUT_DIR}/${name}`;
          try {
            const bytes = await this.engine.readFile(path);
            if (name.endsWith('.ifc')) {
              let info = {};
              try { info = JSON.parse(new TextDecoder().decode(await this.engine.readFile(path + '.json'))) || {}; } catch (_err) { info = {}; }
              const meta = await D.require('data/model').createIfcDataset({ name: String(info.name || name.replace(/\.ifc$/, '')), fileName: String(info.file || name), bytes, description: String(info.description || ''), source: { kind: 'python', from: info.from || null } });
              created.push(meta);
              try { await this.engine.unlink(path + '.json'); } catch (_err) { /* ignore */ }
            } else {
              const meta = await datasets.importBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
              created.push(meta);
            }
          } catch (err) { D.log('python', 'import from Python failed', err); }
          try { await this.engine.unlink(path); } catch (_err) { /* ignore */ }
        }
        return created;
      }

      /**
       * One of the model tools of Analysera on a model dataset (python/dataspatium.py `_ifc_tool`): the dataset is mirrored,
       * IfcOpenShell fetched after consent, and the result comes back as a table.
       * @param {string} datasetId @param {string} tool validate | ids | structure | psets | select | elements | geometry
       * @param {Record<string, any>} [params]
       * @returns {Promise<{columns: Array<{name: string, type: string}>, rows: any[][], total: number}>}
       */
      async ifcTool(datasetId, tool, params = {}) {
        await this.start();
        if (this.state === 'busy') throw new Error(D.t('python.err.busy'));
        const meta = await datasets.get(datasetId);
        if (meta && (meta.byteSize || 0) > MIRROR_LIMIT) throw new Error(D.t('python.err.toobig', { mb: Math.round(MIRROR_LIMIT / 1048576) }));
        this.setState('busy');
        try {
          await this.mirror([datasetId]);
          await this.ensurePackages(['ifcopenshell'].concat(tool === 'ids' ? ['ifctester'] : []).concat(params.express ? ['pytest'] : []));
          this.streams = [];
          const res = await this.engine.evalJson(`_dataspatium._ifc_tool(${JSON.stringify(datasetId)}, ${JSON.stringify(String(tool))}, ${JSON.stringify(JSON.stringify(params))})`);
          return res || { columns: [], rows: [], total: 0 };
        } finally {
          this.streams = [];
          if (this.state === 'busy') this.setState('ready');
        }
      }

      /**
       * The recipe step "Python på modellen": `def step(model): ...` on the model kept in a dataset file; the changed model
       * comes back as IFC bytes with counts for the log (data/ifc-ops).
       * @param {string} code @param {ArrayBuffer|Uint8Array} bytes the dataset's SQLite file @param {{name?: string}} [options]
       * @returns {Promise<{bytes: Uint8Array, info: any, log: Array<{kind: string, text: string}>}>}
       */
      async runIfcStep(code, bytes, options = {}) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          await this.ensurePackages((await this.referencedPackages(code)).concat(['ifcopenshell']));
          this.streams = [];
          const info = await this.engine.evalJson(`_dataspatium._ifc_step(${JSON.stringify(String(code))}, "/data/step/model.sqlite", "/data/step/model-out.ifc", ${JSON.stringify(String(options.name || ''))})`);
          return this.takeIfc('/data/step/model-out.ifc', info, ['/data/step/model.sqlite', '/data/step/step-in.ifc']);
        });
      }

      /**
       * The recipe step "Skriv tabell till modellen": a table dataset's values into the model (dm_ifc_set).
       * @param {ArrayBuffer|Uint8Array} bytes the model dataset's SQLite file @param {ArrayBuffer|Uint8Array} tableBytes @param {string} key
       */
      async runIfcApply(bytes, tableBytes, key) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          await this.engine.writeFile('/data/step/table.sqlite', tableBytes);
          await this.ensurePackages(['ifcopenshell']);
          this.streams = [];
          const info = await this.engine.evalJson(`_dataspatium._ifc_apply("/data/step/model.sqlite", "/data/step/table.sqlite", ${JSON.stringify(String(key || 'guid'))}, "/data/step/model-out.ifc")`);
          return this.takeIfc('/data/step/model-out.ifc', info, ['/data/step/model.sqlite', '/data/step/table.sqlite', '/data/step/apply-in.ifc']);
        });
      }

      /**
       * The recipe step "AI-ändring" and its preview: a change set (the operations of ai/write-tools, JSON) on the model kept in a
       * dataset file; the written IFC comes back with the wheel's report (created with refs, changed, deleted, findings, errors).
       * `express` also runs the schema's EXPRESS rules (at approval; pytest is fetched for them as a component) and `ids` tries the
       * candidate against an IDS file given as its name and text (ifctester), both reported by the wheel (`express`, `ids`).
       * @param {any[]} changes @param {ArrayBuffer|Uint8Array} bytes the dataset's SQLite file
       * @param {{name?: string, express?: boolean, ids?: {name: string, text: string}|null}} [options]
       * @returns {Promise<{bytes: Uint8Array, info: any, log: Array<{kind: string, text: string}>}>}
       */
      async runIfcChangeset(changes, bytes, options = {}) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          const wheel = {};
          const idsPath = options.ids && options.ids.text ? '/data/ids/' + String(options.ids.name || 'krav.ids').replace(/[^\w.-]+/g, '_') : '';
          if (idsPath) { await this.engine.mkdir('/data/ids'); await this.engine.writeFile(idsPath, new TextEncoder().encode(String(options.ids.text))); wheel.ids = idsPath; }
          if (options.express) wheel.express = true;
          await this.ensurePackages(['ifcopenshell'].concat(options.express ? ['pytest'] : [], idsPath ? ['ifctester'] : []));
          this.streams = [];
          const info = await this.engine.evalJson(`_dataspatium._ifc_changeset("/data/step/model.sqlite", ${JSON.stringify(JSON.stringify(changes))}, "/data/step/model-out.ifc", ${JSON.stringify(JSON.stringify(wheel))})`);
          return this.takeIfc('/data/step/model-out.ifc', Object.assign({ name: options.name || '' }, info || {}), ['/data/step/model.sqlite', '/data/step/changeset-in.ifc'].concat(idsPath ? [idsPath] : []));
        });
      }

      /**
       * The basic requirements of the model kept in a dataset file (the card Grunduppgifter; the wheel's `_ifc_basics_file`): the
       * header, the coordinate system, names, room numbers, the naming of one's own sets and units in values. Read-only.
       * @param {ArrayBuffer|Uint8Array} bytes the model dataset's SQLite file
       * @returns {Promise<any>}
       */
      async runIfcBasics(bytes) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          try {
            await this.ensurePackages(['ifcopenshell']);
            this.streams = [];
            return await this.engine.evalJson('_dataspatium._ifc_basics_file("/data/step/model.sqlite", "/data/step/basics.json")');
          } finally {
            for (const p of ['/data/step/model.sqlite', '/data/step/basics-in.ifc', '/data/step/basics.json']) { try { await this.engine.unlink(p); } catch (_err) { /* ignore */ } }
          }
        });
      }

      /**
       * The building's topology (decision F46 a) of the model kept in a dataset file: per storey the rooms the walls enclose, which
       * rooms border which, the external walls with the façade they face and the open wall ends (the wheel's `_ifc_topology_file`).
       * Read-only: nothing is written back.
       * @param {ArrayBuffer|Uint8Array} bytes the model dataset's SQLite file
       * @returns {Promise<any[]>} one entry per storey
       */
      async runIfcTopology(bytes) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          try {
            await this.ensurePackages(['ifcopenshell']);
            this.streams = [];
            return await this.engine.evalJson('_dataspatium._ifc_topology_file("/data/step/model.sqlite", "/data/step/topology.json")');
          } finally {
            for (const p of ['/data/step/model.sqlite', '/data/step/topology-in.ifc', '/data/step/topology.json']) { try { await this.engine.unlink(p); } catch (_err) { /* ignore */ } }
          }
        });
      }

      /**
       * The IFC classes of a schema for a thing named in English words (decision B-57.2; the wheel's `_ifc_class_search` on
       * IfcOpenShell's documentation of the schema). No model is read.
       * @param {string} schema the model's schema, such as IFC4 @param {string} query @param {number} [limit]
       * @returns {Promise<any[]>} the hits, best first
       */
      async runIfcClassSearch(schema, query, limit = 12) {
        return this.ifcJob(async () => {
          await this.ensurePackages(['ifcopenshell']);
          this.streams = [];
          return await this.engine.evalJson(`__import__("json").dumps(_dataspatium._ifc_class_search(${JSON.stringify(String(schema))}, ${JSON.stringify(String(query))}, ${Number(limit) || 12}), ensure_ascii=False)`);
        });
      }

      /**
       * The class report of the model kept in a dataset file (decision B-57.2; the wheel's `_ifc_class_report_file`): proxies,
       * USERDEFINED without a name, untyped elements, type and occurrence conflicts and elements outside the spatial structure.
       * @param {ArrayBuffer|Uint8Array} bytes the model dataset's SQLite file
       * @returns {Promise<any>}
       */
      async runIfcClassReport(bytes) {
        return this.ifcJob(async () => {
          await this.engine.writeFile('/data/step/model.sqlite', bytes);
          try {
            await this.ensurePackages(['ifcopenshell']);
            this.streams = [];
            return await this.engine.evalJson('_dataspatium._ifc_class_report_file("/data/step/model.sqlite", "/data/step/classes.json")');
          } finally {
            for (const p of ['/data/step/model.sqlite', '/data/step/classes-in.ifc', '/data/step/classes.json']) { try { await this.engine.unlink(p); } catch (_err) { /* ignore */ } }
          }
        });
      }

      /**
       * A new, empty model written by the wheel (OB-06 Schemaval för nya modeller): project, units, contexts, site, building and a
       * first storey in the schema chosen.
       * @param {string} schema IFC4X3_ADD2, IFC4 or IFC2X3 @param {{project: string, site: string, building: string, storey: string, elevation: number}} names
       * @returns {Promise<{bytes: Uint8Array, info: any, log: Array<{kind: string, text: string}>}>}
       */
      async runIfcNewModel(schema, names) {
        return this.ifcJob(async () => {
          await this.ensurePackages(['ifcopenshell']);
          this.streams = [];
          const info = await this.engine.evalJson(`_dataspatium._ifc_new_model(${JSON.stringify(String(schema))}, ${JSON.stringify(JSON.stringify(names || {}))}, "/data/step/new-model.ifc")`);
          return this.takeIfc('/data/step/new-model.ifc', info, []);
        });
      }

      async ifcJob(fn) {
        await this.start();
        if (this.state === 'busy') throw new Error(D.t('python.err.busy'));
        this.setState('busy');
        try {
          await this.engine.mkdir('/data/step');
          this.streams = [];
          return await fn();
        } finally {
          this.streams = [];
          if (this.state === 'busy') this.setState('ready');
        }
      }

      async takeIfc(path, info, cleanup) {
        const out = await this.engine.readFile(path);
        const log = this.streams.slice();
        for (const p of [path].concat(cleanup)) { try { await this.engine.unlink(p); } catch (_err) { /* ignore */ } }
        return { bytes: out, info: info || {}, log };
      }

      /**
       * Export a kept figure.
       * @param {number} key @param {'svg'|'png'|'pdf'} format
       * @returns {Promise<Blob>}
       */
      async exportPlot(key, format, options = {}) {
        const width = Number(options.width) || 7; const height = Number(options.height) || 5; const dpi = Number(options.dpi) || 150;
        // plotly figures are drawn by plotly.js on the main thread; sizes in inches become pixels at 96 per inch.
        if (this.plotlyFigures.has(Number(key))) return D.require('viz/plotly').toBlob(this.plotlyFigures.get(Number(key)), format, { width: Math.round(width * 96), height: Math.round(height * 96), scale: 2 });
        const file = `/tmp/dataspatium-plot-${Number(key)}.${format}`;
        await this.engine.evalJson(`_dataspatium._plot_export(${Number(key)}, ${JSON.stringify(format)}, ${JSON.stringify(file)}, ${width}, ${height}, ${dpi})`);
        const bytes = await this.engine.readFile(file);
        try { await this.engine.unlink(file); } catch (_err) { /* ignore */ }
        const type = format === 'svg' ? 'image/svg+xml' : format === 'png' ? 'image/png' : 'application/pdf';
        return new Blob([bytes], { type });
      }

      /** File helpers on the Python session's virtual filesystem. */
      async writeFile(path, bytes) { await this.start(); const dir = path.slice(0, path.lastIndexOf('/')); if (dir) await this.engine.mkdir(dir); await this.engine.writeFile(path, bytes); }
      async readFile(path) { await this.start(); return this.engine.readFile(path); }

      /** Packages (with versions) made available in this session. */
      async loadedPackages() {
        if (!this.engine) return [];
        return (await this.engine.evalJson('__import__("json").dumps(sorted(__import__("pyodide_js").loadedPackages.to_py().keys()))')) || [];
      }

      /** Whether running code can be stopped with interrupt() (the page is cross-origin isolated, see src/boot.js). */
      get canInterrupt() { return !!(D.capabilities && D.capabilities.sharedArrayBuffer); }

      /** Stop the code that is running; the session and its objects stay. */
      interrupt() {
        if (!this.engine || this.state !== 'busy' || !this.canInterrupt) return false;
        this.interrupted = true;
        this.engine.interrupt();
        return true;
      }

      /** Stop and start a fresh session. */
      async restart() {
        if (this.engine) { try { await this.engine.close(); } catch (_err) { /* ignore */ } }
        this.engine = null; this.ready = null; this.mirrored.clear(); this.error = null; this.mplReady = false; this.plotlyReady = false; this.plotlyFigures.clear(); this.streams = []; this.progress = null;
        this.setState('idle');
        return this.start();
      }
    }

    function cleanError(err) {
      return String((err && err.message) || err).replace(/^Error:\s*/, '');
    }

    const bridge = new PythonBridge();
    return { bridge, PythonBridge };
  });
})();
