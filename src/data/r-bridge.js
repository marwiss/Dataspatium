// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Bridge between the workspace and the R session.
 *
 * Datasets are mirrored into webR's virtual filesystem as SQLite files (/data/<id>.sqlite) plus an
 * index (/data/index.json) that r/dataspatium.R reads. Before each command the datasets referenced with
 * dm_read("…") are mirrored (if changed), the command runs through captureR, plots drawn on the canvas
 * device are collected and recorded for export, and files written by dm_write() in /data/out are
 * imported back as new datasets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/r-bridge', ['engines/r', 'engines/r/packages', 'data/datasets'], (rmod, packages, datasets) => {
    const DATA_DIR = '/data';
    const OUT_DIR = '/data/out';
    const MIRROR_LIMIT = 50 * 1024 * 1024;

    class RBridge {
      constructor() {
        /** @type {any} */ this.engine = null;
        /** @type {Promise<void>|null} */ this.ready = null;
        /** @type {'idle'|'starting'|'ready'|'busy'|'error'} */ this.state = 'idle';
        this.error = null;
        this.version = '';
        this.startupMs = 0;
        /** @type {Map<string, string>} dataset id -> updatedAt mirrored */ this.mirrored = new Map();
        /**
         * Images of the current run, one array per device page. webR's canvas device sends one
         * incremental ImageBitmap (transparent except for the newly drawn marks) per drawing batch and a
         * canvasNewPage event between pages, so a page is the composite of all its images.
         * @type {ImageBitmap[][]}
         */
        this.pages = [[]];
        this.plotSeq = 0;
        this.listeners = new Set();
      }

      on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
      emit(type, payload) { for (const fn of Array.from(this.listeners)) { try { fn(type, payload); } catch (err) { console.error(err); } } }
      setState(state) { this.state = state; this.emit('state', { state }); }

      /** Start R and load the Dataspatium helpers (idempotent). */
      start() {
        if (this.ready) return this.ready;
        this.setState('starting');
        this.ready = (async () => {
          try {
            const t0 = performance.now();
            this.engine = new rmod.REngine();
            this.engine.on('canvasImage', (img) => this.onImage(img));
            this.engine.on('canvasNewPage', () => this.onNewPage());
            this.engine.on('stdout', (text) => this.emit('stream', { kind: 'stdout', text }));
            this.engine.on('stderr', (text) => this.emit('stream', { kind: 'stderr', text }));
            this.engine.on('closed', () => { this.setState('error'); this.error = D.t('r.err.closed'); });
            await this.engine.start();
            const src = await D.assets.loadText('r/dataspatium.R');
            await this.engine.mkdir(DATA_DIR);
            await this.engine.mkdir(OUT_DIR);
            await this.engine.writeFile('/home/web_user/dataspatium.R', new TextEncoder().encode(src));
            // User-facing R messages follow the app's language (see .dm_msg in r/dataspatium.R).
            await this.engine.evalRVoid('source("/home/web_user/dataspatium.R"); dm_setup(lang = "' + D.require('ui/i18n').language() + '")');
            await this.mirrorAll();
            this.version = await this.engine.evalRString('R.version.string');
            this.startupMs = performance.now() - t0;
            this.setState('ready');
            // Loading the RSQLite namespace takes a few seconds in WebAssembly; do it now, while the user
            // is still typing, so the first dm_read() is quick. Commands wait for it in run().
            this.warmup = this.engine.evalRVoid('suppressMessages(suppressWarnings(requireNamespace("RSQLite", quietly = TRUE)))').catch((err) => D.log('r', 'warmup failed', err));
          } catch (err) {
            this.error = (err && err.message) || String(err);
            this.setState('error');
            throw err;
          }
        })();
        return this.ready;
      }

      onImage(image) {
        const page = this.pages[this.pages.length - 1];
        page.push(image);
        if (this.state !== 'busy') this.emit('plot', { canvas: compositePage(page), key: null });
      }
      onNewPage() {
        if (this.pages[this.pages.length - 1].length) this.pages.push([]);
      }

      /** Write the dataset index and the given datasets into /data. */
      async mirror(ids) {
        const list = await datasets.list();
        let labelled = false;
        for (const id of ids) {
          const meta = list.find((d) => d.id === id);
          if (!meta) continue;
          // dm_read() turns columns with value labels into haven::labelled, reading the labels with jsonlite.
          if (!labelled) { try { labelled = (await datasets.columns(id)).some((c) => c.valueLabels); } catch (_err) { /* not open */ } }
          if (this.mirrored.get(id) === meta.updatedAt) continue;
          const bytes = await datasets.exportBytes(id);
          await this.engine.writeFile(`${DATA_DIR}/${id}.sqlite`, bytes);
          this.mirrored.set(id, meta.updatedAt);
        }
        if (labelled) await this.engine.ensurePackages(['haven', 'jsonlite']);
        const index = list.map((m) => ({ id: m.id, name: m.name, shortName: m.shortName || '', file: `${DATA_DIR}/${m.id}.sqlite`, rowCount: m.rowCount || 0, columnCount: m.columnCount || 0, updatedAt: m.updatedAt, mirrored: this.mirrored.has(m.id) }));
        // Tab-separated so that r/dataspatium.R can read it with base R only.
        const clean = (v) => String(v === null || v === undefined ? '' : v).replace(/[\t\r\n]+/g, ' ');
        const lines = ['id\tname\tshortName\tfile\trowCount\tcolumnCount\tupdatedAt\tmirrored'];
        for (const m of index) lines.push([m.id, m.name, m.shortName, m.file, m.rowCount, m.columnCount, m.updatedAt, m.mirrored ? 'TRUE' : 'FALSE'].map(clean).join('\t'));
        await this.engine.writeFile(`${DATA_DIR}/index.tsv`, new TextEncoder().encode(lines.join('\n') + '\n'));
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
          const exact = list.find((d) => d.id === n || d.name === n || d.shortName === lower);
          const ci = list.filter((d) => d.name.toLowerCase() === lower);
          const prefix = list.filter((d) => d.name.toLowerCase().startsWith(lower));
          const hit = exact || (ci.length === 1 ? ci[0] : null) || (prefix.length === 1 ? prefix[0] : null);
          if (hit) ids.push(hit.id);
        }
        return ids;
      }

      /**
       * Run user code. Resolves with the console entries to display.
       * @param {string} code
       * @returns {Promise<{entries: any[], ms: number}>}
       */
      async run(code) {
        await this.start();
        if (this.state === 'busy') throw new Error(D.t('r.err.busy'));
        this.setState('busy');
        const t0 = performance.now();
        this.pages = [[]];
        const entries = [{ kind: 'input', text: code }];
        const installed = [];
        try {
          if (this.warmup) { await this.warmup; this.warmup = null; }
          const list = await datasets.list();
          const ids = this.resolveIds(this.referencedNames(code), list);
          await this.mirror(ids);
          // Ship bundled packages the code mentions before R asks for them.
          await this.engine.ensurePackages(packages.referenced(code));
          const res = await this.engine.capture(code, { captureConditions: false });
          for (const o of res.output) {
            const text = String(o.data);
            if (o.type === 'stderr') {
              // library() installs bundled packages on first use; collapse the progress lines.
              const dl = /^Downloading webR package: (\S+)/.exec(text);
              if (dl) { installed.push(dl[1]); continue; }
              if (!text.trim()) continue;
              // With captureConditions off, R prints errors to stderr ("Error in …: …"); show those as errors.
              entries.push({ kind: /^(Error|Fel)\b/.test(text) ? 'error' : 'stderr', text });
            } else {
              entries.push({ kind: 'stdout', text });
            }
          }
        } catch (err) {
          entries.push({ kind: 'error', text: cleanError(err) });
        }
        if (installed.length) entries.splice(1, 0, { kind: 'packages', names: installed });
        // Canvas images arrive through the message pump; give them a moment to flush.
        await new Promise((r) => setTimeout(r, 80));
        const pages = this.pages.filter((p) => p.length);
        if (pages.length) {
          const key = ++this.plotSeq;
          try { await this.engine.evalRVoid(`dm_plot_record(${key})`); } catch (err) { D.log('r', 'recordPlot failed', err); }
          pages.forEach((images, i) => {
            const canvas = compositePage(images);
            // Only the last page is still in the device's display list, so only it can be exported.
            entries.push({ kind: 'plot', canvas, width: canvas.width, height: canvas.height, key: i === pages.length - 1 ? key : null });
          });
          this.pages = [[]];
        }
        for (const meta of await this.collectOutputs()) entries.push({ kind: 'dataset', meta });
        this.setState('ready');
        return { entries, ms: performance.now() - t0 };
      }

      /** Import SQLite files written by dm_write() and remove them from the virtual filesystem. */
      async collectOutputs() {
        let node;
        try { node = await this.engine.webR.FS.lookupPath(OUT_DIR); } catch (_err) { return []; }
        const names = Object.keys((node && node.contents) || {}).filter((n) => n.endsWith('.sqlite'));
        const created = [];
        for (const name of names) {
          const path = `${OUT_DIR}/${name}`;
          try {
            const bytes = await this.engine.readFile(path);
            const meta = await datasets.importBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            created.push(meta);
          } catch (err) { D.log('r', 'import from R failed', err); }
          try { await this.engine.webR.FS.unlink(path); } catch (_err) { /* ignore */ }
        }
        return created;
      }

      /**
       * Export a recorded plot.
       * @param {number} key @param {'svg'|'png'|'pdf'} format
       * @returns {Promise<Blob>}
       */
      async exportPlot(key, format, options = {}) {
        const file = `/tmp/dataspatium-plot-${key}.${format}`;
        const width = Number(options.width) || 7; const height = Number(options.height) || 5; const dpi = Number(options.dpi) || 150;
        if (format === 'svg') await this.engine.ensurePackages(['svglite']);
        await this.engine.evalRVoid(`dm_plot_export(${Number(key)}, "${format}", "${file}", width = ${width}, height = ${height}, dpi = ${dpi})`);
        const bytes = await this.engine.readFile(file);
        const type = format === 'svg' ? 'image/svg+xml' : format === 'png' ? 'image/png' : 'application/pdf';
        return new Blob([bytes], { type });
      }

      /** File helpers on the R session's virtual filesystem (used by R-based importers and exporters). */
      async writeFile(path, bytes) { await this.start(); const dir = path.slice(0, path.lastIndexOf('/')); if (dir) await this.engine.mkdir(dir); await this.engine.writeFile(path, bytes); }
      async readFile(path) { await this.start(); return this.engine.readFile(path); }
      async mkdir(path) { await this.start(); await this.engine.mkdir(path); }
      async removeFile(path) { try { await this.engine.webR.FS.unlink(path); } catch (_err) { /* ignore */ } }

      async installedPackages() {
        const res = await this.engine.capture('cat(sort(rownames(installed.packages())), sep = "\\n")');
        return res.text.split('\n').map((s) => s.trim()).filter(Boolean);
      }

      /** Stop and start a fresh session. */
      async restart() {
        if (this.engine) { try { await this.engine.close(); } catch (_err) { /* ignore */ } }
        this.engine = null; this.ready = null; this.mirrored.clear(); this.pages = [[]]; this.error = null; this.warmup = null;
        this.setState('idle');
        return this.start();
      }
    }

    /** Draw a page's incremental images onto one white canvas. @param {ImageBitmap[]} images */
    function compositePage(images) {
      const canvas = document.createElement('canvas');
      canvas.width = images[0].width;
      canvas.height = images[0].height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const img of images) ctx.drawImage(img, 0, 0);
      }
      return canvas;
    }

    function cleanError(err) {
      let msg = String((err && err.message) || err);
      msg = msg.replace(/^Error:\s*/, '');
      return msg;
    }

    const bridge = new RBridge();
    return { bridge, RBridge };
  });
})();
