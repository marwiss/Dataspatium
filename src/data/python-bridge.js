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
            const setup = await this.engine.run(`import sys\nif ${JSON.stringify(HELPER_DIR)} not in sys.path: sys.path.insert(0, ${JSON.stringify(HELPER_DIR)})\nimport dataspatium as _dataspatium\nfrom dataspatium import *\n_dataspatium.dm_setup(lang=${JSON.stringify(lang)})\n`);
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

      /** Dataset names referenced with dm_read("…") in a piece of code. */
      referencedNames(code) {
        const names = [];
        const re = /dm_read\(\s*(["'])([^"']+)\1/g;
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
        if (!this.mplReady && catalog.closure(names).includes('matplotlib')) {
          try {
            await this.engine.loadPackages(['matplotlib']);
            const r = await this.engine.run('_dataspatium._matplotlib_setup()');
            if (r.ok) this.mplReady = true; else D.log('python', 'matplotlib setup failed', r.error);
          } catch (err) { D.log('python', 'matplotlib setup failed', err); }
        }
        return fetched;
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
          installed = await this.ensurePackages(catalog.referenced(code));
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
          for (const f of await this.collectPlots()) entries.push({ kind: 'plot', svg: f.svg, png: f.png, width: f.width, height: f.height, key: f.key });
        } catch (err) { D.log('python', 'plot collection failed', err); }
        for (const meta of await this.collectOutputs()) entries.push({ kind: 'dataset', meta });
        if (this.state === 'busy') this.setState('ready');
        return { entries, ms: performance.now() - t0 };
      }

      /** Open matplotlib figures as {key, svg, png (base64), width, height}; the figures stay in Python for export. */
      async collectPlots() {
        if (!this.engine || !this.mplReady) return [];
        return (await this.engine.evalJson('_dataspatium._plot_collect()')) || [];
      }

      /** Import SQLite files written by dm_write() and remove them from the virtual filesystem. */
      async collectOutputs() {
        if (!this.engine) return [];
        const names = (await this.engine.listdir(OUT_DIR)).filter((n) => n.endsWith('.sqlite'));
        const created = [];
        for (const name of names) {
          const path = `${OUT_DIR}/${name}`;
          try {
            const bytes = await this.engine.readFile(path);
            const meta = await datasets.importBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            created.push(meta);
          } catch (err) { D.log('python', 'import from Python failed', err); }
          try { await this.engine.unlink(path); } catch (_err) { /* ignore */ }
        }
        return created;
      }

      /**
       * Export a kept figure.
       * @param {number} key @param {'svg'|'png'|'pdf'} format
       * @returns {Promise<Blob>}
       */
      async exportPlot(key, format, options = {}) {
        const file = `/tmp/dataspatium-plot-${Number(key)}.${format}`;
        const width = Number(options.width) || 7; const height = Number(options.height) || 5; const dpi = Number(options.dpi) || 150;
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
        this.engine = null; this.ready = null; this.mirrored.clear(); this.error = null; this.mplReady = false; this.streams = []; this.progress = null;
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
