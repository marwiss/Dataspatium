// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * WebR client.
 *
 * webR is loaded as ES module text (blob import). Because the base URL `dataspatium-asset://webr/` is
 * cross-origin, webR fetches its worker script with XMLHttpRequest and creates a Blob worker from the
 * response; our net shim answers that request with "worker shim + webr-worker.js", and the global
 * Worker subclass then feeds the worker every `webr/*` and `webr-repo/*` asset before webR's own init
 * message is delivered. R therefore starts entirely from embedded files, with no network access.
 *
 * Channel: PostMessage on file:// (no SharedArrayBuffer there), so running R code cannot be interrupted and the
 * engine must be restarted instead. Served from a web server, the page is cross-origin isolated (see src/boot.js
 * and sw-coi.js) and the SharedArrayBuffer channel is used, which lets interrupt() stop running code.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/r', ['engines/r/packages'], (packages) => {
    const BASE_URL = 'dataspatium-asset://webr/';
    const REPO_URL = 'dataspatium-asset://webr-repo';
    const MAIN_THREAD_ONLY = new Set(['webr/webr.mjs', 'webr/webr-worker.js']);
    /** Files larger than this are written into R's file system in parts (see writeFile). */
    const WRITE_PART = 16 * 1024 * 1024;
    /** Packages always shipped at startup: what r/dataspatium.R itself needs. */
    const STARTUP_PACKAGES = ['DBI', 'RSQLite'];
    /** Where packages for the worker are written when it cannot take messages (see ensurePackages). */
    const FS_ASSETS = '/dataspatium-assets';

    class REngine {
      constructor() {
        /** @type {any} */ this.webR = null;
        /** @type {any} */ this.module = null;
        /** @type {Promise<REngine>|null} */ this.ready = null;
        this.startupMs = 0;
        /** Whether running code can be interrupted (a cross-origin isolated page with the SharedArrayBuffer channel). */
        this.interruptible = false;
        /** @type {Set<string>} package tgz assets already delivered to the worker */
        this.shippedAssets = new Set();
        this.handlers = {
          stdout: (/** @type {string} */ _text) => {},
          stderr: (/** @type {string} */ _text) => {},
          prompt: (/** @type {string} */ _text) => {},
          canvasImage: (/** @type {ImageBitmap} */ _image) => {},
          canvasNewPage: (/** @type {any} */ _data) => {},
          closed: () => {},
        };
      }

      /** Register an output handler: stdout, stderr, prompt, canvasImage, canvasNewPage, closed. */
      on(event, fn) { this.handlers[event] = fn; return this; }

      /** Start R (idempotent). */
      start() {
        if (!this.ready) this.ready = this.boot();
        return this.ready;
      }

      async boot() {
        const t0 = performance.now();
        D.net.virtual('webr/webr-worker.js', async () => ({
          kind: 'text',
          data: D.workerShim.buildWorkerSource({ namespace: 'webr' }, await D.assets.loadText('webr/webr-worker.js')),
        }));
        await packages.load();
        // Startup payload: the R runtime, the package index and the packages the helpers need. Other
        // packages are shipped on demand by ensurePackages() because webR downloads them with
        // synchronous XHR inside the worker, which cannot wait for the main thread.
        const startupRepo = D.assets.names('webr-repo/').filter((n) => /\/PACKAGES(\.gz)?$/.test(n)).concat(packages.assetsFor(packages.closure(STARTUP_PACKAGES)));
        for (const n of startupRepo) this.shippedAssets.add(n);
        D.workers.provider('webr', {
          initial: async () => D.assets.names('webr/').filter((n) => !MAIN_THREAD_ONLY.has(n)).concat(startupRepo),
          request: async () => true,
        });
        this.module = await D.assets.importModule('webr/webr.mjs');
        const { WebR, ChannelType } = this.module;
        this.interruptible = !!(D.capabilities && D.capabilities.sharedArrayBuffer);
        this.webR = new WebR({ baseUrl: BASE_URL, repoUrl: REPO_URL, channelType: this.interruptible ? ChannelType.SharedArrayBuffer : ChannelType.PostMessage, interactive: true });
        await this.webR.init();
        // Plots go to the canvas device; images arrive as `canvas` messages in pump(). r/dataspatium.R
        // (loaded by data/r-bridge.js) refines the device options for the console.
        await this.webR.evalRVoid('options(device = function(...) webr::canvas(width = 420, height = 420, ...))');
        this.pump();
        this.startupMs = performance.now() - t0;
        D.log('r', 'webR ready in', Math.round(this.startupMs), 'ms');
        return this;
      }

      /** Forward webR output messages to the registered handlers. */
      async pump() {
        for (;;) {
          let msg;
          try { msg = await this.webR.read(); } catch (err) { D.log('r', 'read loop ended', err); return; }
          switch (msg.type) {
            case 'stdout': this.handlers.stdout(String(msg.data)); break;
            case 'stderr': this.handlers.stderr(String(msg.data)); break;
            case 'prompt': this.handlers.prompt(String(msg.data)); break;
            case 'canvas': {
              const d = msg.data || {};
              if (d.event === 'canvasImage') this.handlers.canvasImage(d.image);
              else if (d.event === 'canvasNewPage') this.handlers.canvasNewPage(d);
              break;
            }
            case 'closed': this.handlers.closed(); return;
            default: D.log('r', 'unhandled message type', msg.type); break;
          }
        }
      }

      /** Send a line to R's interactive console. */
      writeConsole(line) { this.webR.writeConsole(line); }
      /** Stop the running R code (only with the SharedArrayBuffer channel; see `interruptible`). */
      interrupt() { if (this.webR && this.interruptible) this.webR.interrupt(); }
      evalR(code, options) { return this.webR.evalR(code, options); }
      evalRVoid(code) { return this.webR.evalRVoid(code); }
      /** @returns {Promise<string>} */
      evalRString(code) { return this.webR.evalRString(code); }
      /** @returns {Promise<number>} */
      evalRNumber(code) { return this.webR.evalRNumber(code); }

      /**
       * Evaluate code and capture printed output.
       * @returns {Promise<{text: string, output: Array<{type: string, data: string}>}>}
       */
      async capture(code, options = {}) {
        const shelter = await new this.webR.Shelter();
        try {
          const res = await shelter.captureR(code, Object.assign({ withAutoprint: true, captureGraphics: false }, options));
          const output = res.output.map((o) => ({ type: String(o.type), data: String(o.data) }));
          return { text: output.map((o) => o.data).join('\n'), output };
        } finally {
          await shelter.purge();
        }
      }

      /** @param {string} path @param {ArrayBuffer|Uint8Array} bytes */
      /**
       * Write a file into R's file system. webR 0.5.9 turns the bytes into a plain array on the way
       * (Object.values), which fails near 128 MB, so a larger file is written in parts that R joins.
       */
      async writeFile(path, bytes) {
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        if (data.byteLength <= WRITE_PART) { await this.webR.FS.writeFile(path, data); return; }
        const parts = [];
        for (let i = 0, n = 0; i < data.byteLength; i += WRITE_PART, n++) {
          const part = `${path}.part${n}`;
          // slice, not subarray: a view would be cloned with its whole underlying buffer.
          await this.webR.FS.writeFile(part, data.slice(i, i + WRITE_PART));
          parts.push(part);
        }
        const q = (s) => JSON.stringify(String(s));
        await this.webR.evalRVoid(`local({ out <- file(${q(path)}, "wb"); on.exit(close(out)); for (p in c(${parts.map(q).join(', ')})) { writeBin(readBin(p, "raw", file.size(p)), out); invisible(file.remove(p)) } })`);
      }
      /** @returns {Promise<Uint8Array>} */
      readFile(path) { return this.webR.FS.readFile(path); }
      async mkdir(path) { try { await this.webR.FS.mkdir(path); } catch (_err) { /* already exists */ } }

      /** The worker webR created for this session (a DataspatiumWorker with namespace "webr"). */
      worker() {
        const list = D.workers.list().filter((w) => w.dmNamespace === 'webr');
        return list[list.length - 1] || null;
      }

      /**
       * Ship the dependency closure of the named packages to the worker so that webr::install() /
       * library() can mount them. Unknown packages are ignored.
       * @param {string[]} names
       * @returns {Promise<string[]>} packages that were made available
       */
      async ensurePackages(names) {
        const wanted = packages.closure(names);
        const assets = packages.assetsFor(wanted).filter((a) => !this.shippedAssets.has(a));
        if (assets.length) {
          if (this.interruptible) {
            // With the SharedArrayBuffer channel the worker waits for R requests and never reads further messages, so
            // the packages go into R's file system, where the worker shim looks for assets it does not have.
            if (!this.assetDir) { try { await this.webR.FS.mkdir(FS_ASSETS); } catch (_err) { /* already there */ } this.assetDir = true; }
            for (const a of assets) {
              const e = await D.assets.decode(a);
              await this.webR.FS.writeFile(FS_ASSETS + '/' + encodeURIComponent(a), e.kind === 'text' ? new TextEncoder().encode(e.data) : new Uint8Array(e.data));
              D.assets.take(a);
            }
          } else {
            const worker = this.worker();
            if (!worker) throw new Error('R worker not available');
            await D.workers.sendAssets(worker, assets, false);
          }
          for (const a of assets) this.shippedAssets.add(a);
        }
        return wanted;
      }

      /** Install packages from the embedded repository (they must be present in vendor/webr-repo). */
      async installPackages(names) {
        await this.ensurePackages(names);
        const list = names.map((p) => JSON.stringify(String(p))).join(', ');
        return this.webR.evalRVoid(`suppressWarnings(webr::install(c(${list}), quiet = TRUE))`);
      }

      /** Stop the worker; a new start() boots a fresh R session. */
      async close() {
        if (this.webR) { try { await this.webR.close(); } catch (_err) { /* ignore */ } }
        this.webR = null; this.ready = null;
      }
    }
    return { REngine };
  });
})();
