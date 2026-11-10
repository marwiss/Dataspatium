// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Python engine: Pyodide in one of Dataspatium's own classic Blob workers (with the asset shim), following the
 * R engine's pattern. The runtime and the wheels are components fetched on demand (engines/python/catalog);
 * the worker loads them through `dataspatium-asset://pyodide/...`. Pyodide's loader wants to `import()` its
 * ES-module glue and refuses classic workers; the worker rewrites those three spots of the loader text at run
 * time (proven in the spike notes kept outside the repo, .claude/plans/underlag/spik-fas0-2.md, spike 5), the files themselves stay as published.
 *
 * Messages: main -> worker {id, type: init|run|eval|packages|fs|net-reply}; worker -> main {type: 'result', id,
 * ok, value|error}, {type: 'stream', kind, text} for stdout/stderr lines and {type: 'net', id, url} when Python code
 * (micropip) wants to reach the internet, which the main thread allows only with the user's consent.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /** Runs inside the worker. Standalone: no references to the main thread's scope. */
  function dataspatiumPythonWorker() {
    'use strict';
    var INDEX_URL = 'dataspatium-asset://pyodide/';
    var pyodide = null;
    var reprFn = null;
    var netSeq = 0;
    var netPending = new Map();
    function post(msg, transfer) { self.postMessage(msg, transfer || []); }

    // Network gate: anything that is not an asset, a blob or a data URL (micropip against PyPI) asks the main thread
    // first, which applies the user's consent for components.
    var shimFetch = self.fetch;
    self.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && typeof input.url === 'string' ? input.url : String(input));
      if (/^(dataspatium-asset:|blob:|data:)/.test(url)) return shimFetch(input, init);
      var id = ++netSeq;
      return new Promise(function (resolve) { netPending.set(id, resolve); post({ type: 'net', id: id, url: url }); })
        .then(function (ok) {
          if (!ok) throw new TypeError('Dataspatium: internet access was not allowed for ' + url);
          return shimFetch(input, init);
        });
    };

    // When pyodide.js reaches for its glue with import() (Pyodide 314 ships an ES module, pyodide.asm.mjs; the 0.29 line loads
    // the classic pyodide.asm.js with importScripts through the shim and only falls back to import()), the shim serves the text
    // and it becomes a classic script: only `export default` and import.meta.url need rewriting.
    self.__dmImportAsm = function (url) {
      return fetch(url).then(function (r) { return r.text(); }).then(function (text) {
        var classic = /export\s+default\s+_createPyodideModule/.test(text)
          ? text.replace(/import\.meta\.url/g, JSON.stringify(String(url))).replace(/export\s+default\s+_createPyodideModule;?\s*$/, '')
          : text;
        (0, eval)(classic + '\n//# sourceURL=' + url);
        return { default: self._createPyodideModule };
      });
    };
    function loadLoader() {
      return fetch(INDEX_URL + 'pyodide.js').then(function (r) { return r.text(); }).then(function (src) {
        var patched = src.split('await import(/* webpackIgnore */e)').join('await self.__dmImportAsm(e)');
        if (patched === src) throw new Error('Pyodide loader: the import() call site was not found (pyodide.js changed?)');
        // Pyodide 314 refuses classic workers outright; the 0.29 line has no such check.
        var guarded = patched.replace(/if\((\w+)&&(\w+)\(\)\)throw new Error\("Classic web workers are not supported"\);/, '');
        (0, eval)(guarded + '\n//# sourceURL=' + INDEX_URL + 'pyodide.js');
      });
    }

    // Python tracebacks without the frames of Pyodide's own evaluation helpers.
    function cleanTraceback(message) {
      var lines = String(message).split('\n');
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        if (/^\s+File "[^"]*\/_pyodide\/[^"]*"/.test(lines[i])) {
          while (i + 1 < lines.length && /^\s{4,}/.test(lines[i + 1]) && !/^\s+File "/.test(lines[i + 1])) i++;
          continue;
        }
        out.push(lines[i]);
      }
      return out.join('\n').replace(/\n+$/, '');
    }
    // The console's view of a command's last value: the session's __dm_format_result (python/dataspatium.py) lets
    // figures go to the plot area; without it the plain repr is used.
    function reprOf(value) {
      if (value === undefined || value === null) return null;
      var text;
      if (pyodide.globals.has('__dm_format_result')) {
        var fmt = pyodide.globals.get('__dm_format_result');
        try { text = fmt(value); } finally { fmt.destroy(); }
      } else {
        if (!reprFn) reprFn = pyodide.runPython('repr');
        text = reprFn(value);
      }
      if (value && typeof value.destroy === 'function') { try { value.destroy(); } catch (e) { /* already gone */ } }
      if (text === undefined || text === null || text === 'None') return null;
      return String(text);
    }
    var quiet = function () {};

    var handlers = {
      init: function (msg) {
        return loadLoader().then(function () {
          return self.loadPyodide({
            indexURL: INDEX_URL,
            stdout: function (text) { post({ type: 'stream', kind: 'stdout', text: text + '\n' }); },
            stderr: function (text) { post({ type: 'stream', kind: 'stderr', text: text + '\n' }); },
          });
        }).then(function (py) {
          pyodide = py;
          if (msg.interrupt) pyodide.setInterruptBuffer(msg.interrupt);
          // The startup wheels (shipped as assets) are installed now; dataspatium.py imports pandas.
          return pyodide.loadPackage(msg.packages || [], { messageCallback: quiet, errorCallback: quiet });
        }).then(function () {
          var python = pyodide.runPython('import sys; sys.version.split(" ")[0]');
          return { value: { version: String(pyodide.version), python: String(python) } };
        });
      },
      run: function (msg) {
        // Wheels the code imports are fetched through the asset shim; a failure leaves Python to report the module.
        return pyodide.loadPackagesFromImports(msg.code, { messageCallback: quiet, errorCallback: quiet }).catch(quiet)
          .then(function () { return pyodide.runPythonAsync(msg.code); })
          .then(function (value) { return { value: reprOf(value) }; });
      },
      eval: function (msg) {
        var v = pyodide.runPython(msg.code);
        var text = v === undefined || v === null ? null : String(v);
        if (v && typeof v.destroy === 'function') { try { v.destroy(); } catch (e) { /* ignore */ } }
        return { value: text };
      },
      packages: function (msg) {
        return pyodide.loadPackage(msg.names, { messageCallback: quiet, errorCallback: quiet }).then(function (loaded) {
          var names = [];
          try { for (var i = 0; i < loaded.length; i++) names.push(String(loaded[i].name || loaded[i])); } catch (e) { /* older shape */ }
          return { value: names };
        });
      },
      fs: function (msg) {
        var FS = pyodide.FS;
        switch (msg.op) {
          case 'write': FS.writeFile(msg.path, new Uint8Array(msg.bytes)); return {};
          case 'read': { var bytes = FS.readFile(msg.path); var copy = bytes.slice().buffer; return { value: copy, transfer: [copy] }; }
          case 'mkdir': FS.mkdirTree(msg.path); return {};
          case 'list': return { value: FS.readdir(msg.path).filter(function (n) { return n !== '.' && n !== '..'; }) };
          case 'unlink': try { FS.unlink(msg.path); } catch (e) { /* missing */ } return {};
          case 'exists': return { value: !!FS.analyzePath(msg.path).exists };
          default: throw new Error('Unknown fs operation ' + msg.op);
        }
      },
    };

    self.onmessage = function (ev) {
      var msg = ev.data || {};
      if (msg.type === 'net-reply') { var r = netPending.get(msg.id); if (r) { netPending.delete(msg.id); r(!!msg.ok); } return; }
      var fn = handlers[msg.type];
      if (!fn) { post({ type: 'result', id: msg.id, ok: false, error: 'Unknown message ' + msg.type }); return; }
      Promise.resolve().then(function () { return fn(msg); }).then(function (res) {
        res = res || {};
        post({ type: 'result', id: msg.id, ok: true, value: res.value === undefined ? null : res.value }, res.transfer);
      }, function (err) {
        post({ type: 'result', id: msg.id, ok: false, error: cleanTraceback((err && err.message) || String(err)), errorType: (err && err.type) || '' });
      });
    };
  }

  D.define('engines/python', ['engines/python/catalog', 'platform/consent'], (catalog, consent) => {
    /** Rough size of the startup wheels (numpy, pandas, micropip and their dependencies), for the progress text. */
    const STARTUP_SIZE = 8.2e6;

    class PythonEngine {
      constructor() {
        /** @type {any} */ this.worker = null;
        /** @type {Promise<PythonEngine>|null} */ this.ready = null;
        this.startupMs = 0;
        this.version = '';
        this.python = '';
        /** Whether running code can be interrupted (a cross-origin isolated page: SharedArrayBuffer). */
        this.interruptible = false;
        /** @type {Uint8Array|null} */ this.interruptBuffer = null;
        this.seq = 0;
        /** @type {Map<number, {resolve: Function, reject: Function}>} */ this.pending = new Map();
        /** @type {Set<string>} asset names already in the worker */ this.shipped = new Set();
        this.handlers = {
          stdout: (/** @type {string} */ _text) => {},
          stderr: (/** @type {string} */ _text) => {},
          progress: (/** @type {{received: number, total: number}} */ _info) => {},
          closed: (/** @type {Error} */ _err) => {},
        };
      }

      /** Register a handler: stdout, stderr, progress (downloads), closed (the worker died). */
      on(event, fn) { this.handlers[event] = fn; return this; }

      /** Start Python (idempotent; a failed start is retried by the next call). */
      start() {
        if (!this.ready) this.ready = this.boot().catch((err) => { this.ready = null; throw err; });
        return this.ready;
      }

      async boot() {
        const t0 = performance.now();
        const files = new Map();
        const total = catalog.RUNTIME_SIZE + STARTUP_SIZE;
        const onProgress = (info) => {
          files.set(info.id, info.received);
          let sum = 0;
          for (const v of files.values()) sum += v;
          this.handlers.progress({ received: sum, total });
        };
        // Runtime and startup wheels: from the component cache, or downloaded after consent.
        const runtime = await catalog.ensureRuntime({ onProgress });
        const startup = await catalog.ensurePackages(catalog.STARTUP, { onProgress });
        const initial = runtime.concat(startup.assets);
        D.workers.provider('pyodide', {
          initial: async () => initial,
          // A wheel the worker asks for later (an import the scanner did not see) is fetched the same way.
          request: (name) => catalog.provideFile(name),
        });
        this.worker = D.workers.create({ namespace: 'pyodide', source: D.workers.functionSource(dataspatiumPythonWorker), name: 'python' });
        this.worker.onmessage = (ev) => this.onMessage(ev.data);
        this.worker.onerror = (ev) => this.fail(new Error('Python worker: ' + ((ev && ev.message) || 'error')));
        this.interruptible = !!(D.capabilities && D.capabilities.sharedArrayBuffer);
        if (this.interruptible) this.interruptBuffer = new Uint8Array(new SharedArrayBuffer(1));
        for (const n of initial) this.shipped.add(n);
        const info = await this.request({ type: 'init', interrupt: this.interruptBuffer, packages: catalog.STARTUP });
        this.version = info.value.version;
        this.python = info.value.python;
        this.startupMs = performance.now() - t0;
        D.log('python', 'Pyodide', this.version, '(Python', this.python + ') ready in', Math.round(this.startupMs), 'ms');
        return this;
      }

      onMessage(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'stream') { this.handlers[msg.kind === 'stderr' ? 'stderr' : 'stdout'](String(msg.text)); return; }
        if (msg.type === 'net') { this.allowNet(msg); return; }
        if (msg.type !== 'result') return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) { p.resolve(msg); return; }
        const err = /** @type {any} */ (new Error(msg.error || 'Python error'));
        err.pythonType = msg.errorType || '';
        p.reject(err);
      }

      /** Python code wants the internet (micropip): allowed with the user's consent for components. */
      async allowNet(msg) {
        let ok = false;
        try { await consent.require('components', { host: consent.hostOf(msg.url), label: String(msg.url) }); ok = true; }
        catch (err) { D.log('python', 'internet access refused', msg.url, (err && err.message) || err); }
        if (this.worker) this.worker.postMessage({ type: 'net-reply', id: msg.id, ok });
      }

      request(msg, transfer) {
        if (!this.worker) return Promise.reject(new Error(D.t('python.err.closed')));
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          this.worker.postMessage(Object.assign({ id }, msg), transfer || []);
        });
      }

      /**
       * Run code in the session's main namespace. Resolves with the repr of the last expression (null when none);
       * a Python exception comes back as {ok: false, error} with the cleaned traceback.
       * @returns {Promise<{ok: boolean, value?: string|null, error?: string, errorType?: string}>}
       */
      async run(code) {
        try {
          const r = await this.request({ type: 'run', code: String(code) });
          return { ok: true, value: r.value };
        } catch (err) {
          if (!this.worker) throw err;
          return { ok: false, error: err.message, errorType: err.pythonType || '' };
        }
      }

      /** Evaluate an expression synchronously in the worker and parse its text as JSON (null for None). */
      async evalJson(code) {
        const r = await this.request({ type: 'eval', code: String(code) });
        return r.value === null || r.value === undefined ? null : JSON.parse(String(r.value));
      }

      /**
       * Write a file into Python's file system. The buffer is transferred, so pass a copy if it is needed later.
       * @param {string} path @param {ArrayBuffer|Uint8Array} bytes
       */
      async writeFile(path, bytes) {
        const buf = bytes instanceof ArrayBuffer ? bytes : (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer);
        await this.request({ type: 'fs', op: 'write', path, bytes: buf }, [buf]);
      }
      /** @returns {Promise<Uint8Array>} */
      async readFile(path) { return new Uint8Array((await this.request({ type: 'fs', op: 'read', path })).value); }
      async mkdir(path) { await this.request({ type: 'fs', op: 'mkdir', path }); }
      /** @returns {Promise<string[]>} names in a directory (empty when it does not exist) */
      async listdir(path) { try { return (await this.request({ type: 'fs', op: 'list', path })).value || []; } catch (_err) { return []; } }
      async unlink(path) { await this.request({ type: 'fs', op: 'unlink', path }); }
      async exists(path) { return !!(await this.request({ type: 'fs', op: 'exists', path })).value; }

      /** Load Pyodide packages (their wheels must be shipped or providable). @returns {Promise<string[]>} */
      async loadPackages(names) { return (await this.request({ type: 'packages', names })).value || []; }

      /** Send assets (wheels) to the worker; already shipped ones are skipped unless `force`. */
      async shipAssets(names, options = {}) {
        const assets = names.filter((a) => options.force || !this.shipped.has(a));
        if (assets.length && this.worker) {
          await D.workers.sendAssets(this.worker, assets, false);
          for (const a of assets) this.shipped.add(a);
        }
        return assets;
      }

      /** Ask Python to raise KeyboardInterrupt (only with SharedArrayBuffer, see `interruptible`). */
      interrupt() { if (this.interruptBuffer) this.interruptBuffer[0] = 2; }

      fail(err) {
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
        this.handlers.closed(err);
      }

      /** Stop the worker; a new start() boots a fresh session (and re-reads cached components). */
      async close() {
        const w = this.worker;
        this.worker = null; this.ready = null;
        const err = new Error(D.t('python.err.closed'));
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
        if (w) { try { w.terminate(); } catch (_err) { /* ignore */ } }
      }
    }
    return { PythonEngine, workerSource: () => D.workers.functionSource(dataspatiumPythonWorker) };
  });
})();
