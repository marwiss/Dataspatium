// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Phase 0 technical spike: proves the whole chain under file:// in Edge and Firefox.
 * Each check logs `DATASPATIUM-LOG: OK|FAIL | name :: detail`; the run ends with
 * `DATASPATIUM-TESTS: pass=N fail=M` so tools/run-tests.ps1 can evaluate it headless.
 * Open index.html?autorun=1 to run everything automatically.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('spike/main', ['engines/sqlite', 'engines/r'], (sqlite, rmod) => {
    /** @type {Record<string, HTMLElement>} */
    const ui = {};
    const results = [];
    /** @type {any} */ let rEngine = null;
    /** @type {any} */ let sqlEngine = null;
    /** @type {ArrayBuffer|null} */ let exportedDb = null;
    /** @type {((img: ImageBitmap) => void)|null} */ let plotWaiter = null;

    function el(tag, attrs, children) {
      const node = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (k === 'class') node.className = String(v);
        else if (k === 'text') node.textContent = String(v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
      for (const c of children || []) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      return node;
    }

    function report(ok, name, detail, ms) {
      results.push({ ok, name, detail });
      // One line per result: headless log parsers read line by line.
      const flat = String(detail).replace(/\s*\n\s*/g, ' | ');
      const line = `${ok ? 'OK' : 'FAIL'} | ${name} :: ${flat}${ms !== undefined ? ` (${Math.round(ms)} ms)` : ''}`;
      console.log('DATASPATIUM-LOG: ' + line);
      if (ui.results) ui.results.appendChild(el('li', { class: ok ? 'ok' : 'fail', text: line }));
    }

    async function check(name, fn, timeoutMs = 60000) {
      const t0 = performance.now();
      try {
        const detail = await Promise.race([
          fn(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after ' + timeoutMs + ' ms')), timeoutMs)),
        ]);
        report(true, name, detail === undefined ? 'ok' : String(detail), performance.now() - t0);
        return true;
      } catch (err) {
        report(false, name, (err && (err.stack || err.message)) || String(err), performance.now() - t0);
        return false;
      }
    }

    function waitForPlot(timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { plotWaiter = null; reject(new Error('no plot received within ' + timeoutMs + ' ms')); }, timeoutMs);
        plotWaiter = (img) => { clearTimeout(timer); plotWaiter = null; resolve(img); };
      });
    }

    function drawImage(img) {
      const canvas = /** @type {HTMLCanvasElement} */ (ui.canvas);
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
    }

    function appendOutput(text, cls) {
      const pre = ui.rOutput;
      pre.appendChild(el('span', { class: cls || '', text: text + '\n' }));
      pre.scrollTop = pre.scrollHeight;
    }

    // ---- checks -------------------------------------------------------------------------------

    const checks = {
      async capabilities() {
        const c = D.capabilities;
        return `protocol=${c.protocol} secure=${c.isSecureContext} sab=${c.sharedArrayBuffer} opfs=${await c.probeOpfs()} fsa=${c.fileSystemAccess} idb=${c.indexedDB} base64=${c.nativeBase64} ua=${c.userAgent}`;
      },
      async assets() {
        const t0 = performance.now();
        const wasm = /** @type {ArrayBuffer} */ (await D.assets.load('sqljs/sql-wasm.wasm'));
        const magic = new Uint8Array(wasm, 0, 4);
        if (!(magic[0] === 0 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d)) throw new Error('not a wasm binary');
        const names = Object.keys(D.assets.libraries());
        return `sql-wasm.wasm ${wasm.byteLength} bytes decoded in ${Math.round(performance.now() - t0)} ms; libraries: ${names.join(', ')}`;
      },
      async sqlite() {
        sqlEngine = new sqlite.SqliteEngine();
        await sqlEngine.start();
        await sqlEngine.open();
        const version = await sqlEngine.version();
        await sqlEngine.run('create table data (id integer primary key, kommun text, befolkning integer, andel real)');
        await sqlEngine.run('insert into data (kommun, befolkning, andel) values (?, ?, ?), (?, ?, ?), (?, ?, ?)', ['Stockholm', 984748, 0.0937, 'Göteborg', 596841, 0.0568, 'Malmö', 362133, 0.0345]);
        const rows = await sqlEngine.exec('select kommun, befolkning from data order by befolkning desc');
        if (rows[0].values.length !== 3 || rows[0].values[0][0] !== 'Stockholm') throw new Error('unexpected query result ' + JSON.stringify(rows));
        exportedDb = await sqlEngine.export();
        // Persist in IndexedDB and read back (storage that survives reloads on file://).
        const stored = await idbRoundtrip('spike-db', exportedDb.slice(0));
        const engine2 = new sqlite.SqliteEngine();
        await engine2.start();
        await engine2.open(stored);
        const count = await engine2.exec('select count(*) from data');
        engine2.terminate();
        if (count[0].values[0][0] !== 3) throw new Error('reopened database has ' + count[0].values[0][0] + ' rows');
        return `sqlite ${version}; 3 rows; exported ${exportedDb.byteLength} bytes; IndexedDB roundtrip ok`;
      },
      async rStart() {
        rEngine = new rmod.REngine();
        rEngine.on('stdout', (t) => appendOutput(t)).on('stderr', (t) => appendOutput(t, 'fail')).on('prompt', (p) => appendOutput(p, 'muted'));
        rEngine.on('canvasImage', (img) => { drawImage(img); if (plotWaiter) plotWaiter(img); });
        await rEngine.start();
        const version = await rEngine.evalRString('R.version.string');
        return `${version}; startup ${Math.round(rEngine.startupMs)} ms`;
      },
      async rPlot() {
        const p = waitForPlot(20000);
        await rEngine.evalRVoid('plot(1:10, main = "Dataspatium")');
        const img = await p;
        return `canvas image ${img.width}x${img.height}`;
      },
      async rGgplot() {
        const t0 = performance.now();
        await rEngine.installPackages(['ggplot2']);
        const installMs = performance.now() - t0;
        const p = waitForPlot(60000);
        await rEngine.evalRVoid('library(ggplot2); print(ggplot(mtcars, aes(wt, mpg, colour = factor(cyl))) + geom_point(size = 3) + labs(title = "Dataspatium ggplot2"))');
        const img = await p;
        return `install ${Math.round(installMs)} ms; image ${img.width}x${img.height}`;
      },
      async rSvglite() {
        await rEngine.installPackages(['svglite']);
        await rEngine.evalRVoid('svglite::svglite("/tmp/plot.svg", width = 6, height = 4); print(ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) + ggplot2::geom_point()); dev.off()');
        const bytes = await rEngine.readFile('/tmp/plot.svg');
        const svg = new TextDecoder().decode(bytes);
        if (!svg.includes('<svg')) throw new Error('no <svg> element');
        ui.svgHost.replaceChildren(el('img', { src: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), class: 'spike', alt: 'svglite', width: '420' }));
        return `svg ${bytes.length} bytes`;
      },
      async rPdf() {
        await rEngine.evalRVoid('pdf("/tmp/plot.pdf", width = 6, height = 4); plot(1:10); dev.off()');
        const bytes = await rEngine.readFile('/tmp/plot.pdf');
        const head = new TextDecoder().decode(bytes.slice(0, 5));
        if (head !== '%PDF-') throw new Error('not a PDF: ' + head);
        return `pdf ${bytes.length} bytes`;
      },
      async rSqlite() {
        if (!exportedDb) throw new Error('sqlite check did not run');
        await rEngine.installPackages(['RSQLite']);
        await rEngine.mkdir('/data');
        await rEngine.writeFile('/data/spike.sqlite', exportedDb.slice(0));
        const res = await rEngine.capture('con <- DBI::dbConnect(RSQLite::SQLite(), "/data/spike.sqlite"); df <- DBI::dbReadTable(con, "data"); DBI::dbDisconnect(con); cat(nrow(df), ncol(df), paste(names(df), collapse = ","), df$kommun[which.max(df$befolkning)], "\n")');
        if (!/^3 4 id,kommun,befolkning,andel Stockholm/.test(res.text.trim())) throw new Error('unexpected R output: ' + res.text);
        return res.text.trim();
      },
      async libD3() {
        await D.assets.loadVendorScript('vendor/d3/d3.min.js');
        const d3 = /** @type {any} */ (globalThis).d3;
        const svg = d3.select(ui.d3Host).append('svg').attr('width', 300).attr('height', 80).attr('class', 'spike');
        svg.selectAll('rect').data([984748, 596841, 362133]).join('rect').attr('x', (_d, i) => i * 100).attr('y', (d) => 80 - d / 15000).attr('width', 90).attr('height', (d) => d / 15000).attr('fill', '#2a7f9e');
        return 'd3 ' + d3.version + ', 3 rects';
      },
      async libVega() {
        for (const f of ['vendor/vega/vega.min.js', 'vendor/vega-lite/vega-lite.min.js', 'vendor/vega-embed/vega-embed.min.js']) await D.assets.loadVendorScript(f);
        const spec = { $schema: 'https://vega.github.io/schema/vega-lite/v6.json', width: 260, height: 80, data: { values: [{ k: 'Stockholm', v: 984748 }, { k: 'Göteborg', v: 596841 }, { k: 'Malmö', v: 362133 }] }, mark: 'bar', encoding: { x: { field: 'k', type: 'nominal', title: null }, y: { field: 'v', type: 'quantitative', title: 'Befolkning' } } };
        const result = await /** @type {any} */ (globalThis).vegaEmbed(ui.vegaHost, spec, { actions: false, renderer: 'svg' });
        const svg = await result.view.toSVG();
        return `vega ${/** @type {any} */ (globalThis).vega.version}, vega-lite ${/** @type {any} */ (globalThis).vegaLite.version}, svg ${svg.length} chars`;
      },
      async libDocx() {
        await D.assets.loadVendorScript('vendor/docx/docx.iife.js');
        const docx = /** @type {any} */ (globalThis).docx;
        const doc = new docx.Document({ sections: [{ children: [new docx.Paragraph({ text: 'Dataspatium', heading: docx.HeadingLevel.HEADING_1 }), new docx.Paragraph('Genererat dokument.')] }] });
        const blob = await docx.Packer.toBlob(doc);
        return `docx blob ${blob.size} bytes`;
      },
      async libCodeMirror() {
        const ce = D.require('ui/code-editor');
        const CodeMirror = await ce.loadCore();
        const mime = await ce.loadMode('r');
        const cm = CodeMirror(ui.cmHost, { value: 'library(ggplot2)\nggplot(mtcars, aes(wt, mpg)) + geom_point()\n', mode: mime, lineNumbers: true });
        if (!ui.cmHost.querySelector('.CodeMirror')) throw new Error('editor element missing');
        return 'CodeMirror ' + CodeMirror.version + ', ' + cm.lineCount() + ' lines';
      },
    };

    const ORDER = ['capabilities', 'assets', 'sqlite', 'libD3', 'libVega', 'libDocx', 'libCodeMirror', 'rStart', 'rPlot', 'rGgplot', 'rSvglite', 'rPdf', 'rSqlite'];
    const TIMEOUTS = { rStart: 180000, rGgplot: 180000, rSvglite: 120000, rSqlite: 120000 };

    async function runAll() {
      results.length = 0;
      ui.results.replaceChildren();
      const t0 = performance.now();
      for (const name of ORDER) {
        const ok = await check(name, checks[name], TIMEOUTS[name] || 60000);
        if (!ok && name === 'rStart') break; // later R checks would only repeat the failure
      }
      const pass = results.filter((r) => r.ok).length;
      const fail = results.length - pass;
      const summary = `DATASPATIUM-TESTS: pass=${pass} fail=${fail} total_ms=${Math.round(performance.now() - t0)}`;
      console.log(summary);
      ui.summary.textContent = summary;
      ui.summary.className = fail ? 'fail' : 'ok';
    }

    async function idbRoundtrip(key, buffer) {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('dataspatium-spike', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('files', 'readwrite');
          tx.objectStore('files').put(buffer, key);
          tx.oncomplete = () => {
            const get = db.transaction('files').objectStore('files').get(key);
            get.onsuccess = () => { db.close(); resolve(get.result); };
            get.onerror = () => reject(get.error);
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }

    function sendConsoleLine() {
      const input = /** @type {HTMLTextAreaElement} */ (ui.rInput);
      const code = input.value.trim();
      if (!code || !rEngine) return;
      appendOutput('> ' + code, 'muted');
      rEngine.writeConsole(code);
      input.value = '';
    }

    /** @param {HTMLElement} root */
    function mount(root) {
      ui.results = el('ul', { class: 'results' });
      ui.summary = el('p', { class: 'muted', text: 'Inga kontroller körda ännu.' });
      ui.canvas = el('canvas', { id: 'r-plot', width: '420', height: '420' });
      ui.rOutput = el('pre', { id: 'r-output' });
      ui.rInput = el('textarea', { rows: '3', placeholder: 'R-kod, t.ex. summary(mtcars)', 'aria-label': 'R-kod' });
      ui.svgHost = el('div');
      ui.d3Host = el('div');
      ui.vegaHost = el('div');
      ui.cmHost = el('div', { class: 'cm-host' });
      root.replaceChildren(
        el('h1', { text: 'Dataspatium: fas 0, teknisk spik' }),
        el('p', { class: 'muted', text: `Version ${D.version}. Kör från ${location.protocol} i ${D.capabilities.isFirefox ? 'Firefox' : D.capabilities.isChromium ? 'Chromium' : 'okänd webbläsare'}.` }),
        el('div', { class: 'row' }, [
          el('button', { text: 'Kör alla kontroller', onclick: () => runAll() }),
          el('button', { text: 'Starta R', onclick: () => check('rStart', checks.rStart, TIMEOUTS.rStart) }),
          el('button', { text: 'Testa SQLite', onclick: () => check('sqlite', checks.sqlite) }),
          ui.summary,
        ]),
        el('h2', { text: 'Resultat' }),
        ui.results,
        el('h2', { text: 'R-konsol' }),
        el('div', { class: 'grid' }, [
          el('div', {}, [ui.rInput, el('div', { class: 'row' }, [el('button', { text: 'Kör i R', onclick: sendConsoleLine })]), ui.rOutput]),
          el('div', {}, [ui.canvas]),
        ]),
        el('h2', { text: 'Bibliotek' }),
        el('div', { class: 'grid' }, [
          el('div', {}, [el('p', { class: 'muted', text: 'svglite' }), ui.svgHost]),
          el('div', {}, [el('p', { class: 'muted', text: 'D3' }), ui.d3Host]),
          el('div', {}, [el('p', { class: 'muted', text: 'Vega-Lite' }), ui.vegaHost]),
          el('div', {}, [el('p', { class: 'muted', text: 'CodeMirror' }), ui.cmHost]),
        ]),
      );
      ui.rInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) sendConsoleLine(); });
      if (/[?&]autorun=1/.test(location.search)) runAll();
    }

    return { mount, runAll, checks };
  });
})();
