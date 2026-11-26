// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tiny browser test harness. Tests register with `test(name, fn, timeoutMs, options)`; `run()` executes them
 * sequentially, renders results and prints the machine-readable lines tools/run-tests.ps1 looks for.
 * Parameters in the address choose a subset (all of them together):
 *   `?only=word1,word2`      the tests whose names contain one of the words;
 *   `?files=a.test.js,b`     the tests of these files (with or without `.test.js`); every file is still loaded;
 *   `?shard=2/3`             the second of three parts of the files, split by their time (tests/weights.js);
 *   `?serial=skip|only`      leave out, or run only, the files with a test marked `{serial: true}`;
 *   `?timings=1`             a line `DATASPATIUM-TIME: <file> <ms> <tests>` per file after the summary.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/harness', [], () => {
    /** @type {Array<{name: string, fn: Function, timeoutMs: number, file: string, serial: boolean}>} */
    const tests = [];
    /** The file tests/start.js is loading; each test belongs to it. */
    let loadingFile = '';

    /**
     * Register a test. `options.serial` marks a test that measures time (the 50 ms limit of the main thread, "in under 5
     * seconds"): its whole file then runs alone in a parallel run, never beside other browsers (tools/run-tests.ps1 -Jobs).
     * @param {string} name @param {Function} fn @param {number} [timeoutMs] @param {{serial?: boolean}} [options]
     */
    function test(name, fn, timeoutMs = 20000, options = {}) {
      tests.push({ name, fn, timeoutMs, file: loadingFile, serial: !!(options && options.serial) });
    }

    /** @param {string} file the file tests/start.js loads next; the tests it registers belong to it. */
    function loading(file) { loadingFile = file; }

    const assert = {
      ok(value, message) { if (!value) throw new Error(message || 'expected truthy value, got ' + String(value)); },
      equal(actual, expected, message) {
        if (actual !== expected) throw new Error((message ? message + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
      },
      deepEqual(actual, expected, message) {
        const a = JSON.stringify(actual); const b = JSON.stringify(expected);
        if (a !== b) throw new Error((message ? message + ': ' : '') + 'expected ' + b + ', got ' + a);
      },
      async throws(fn, pattern) {
        try { await fn(); } catch (err) {
          if (pattern && !pattern.test(String(err && err.message))) throw new Error('error did not match ' + pattern + ': ' + err.message);
          return;
        }
        throw new Error('expected an error');
      },
    };

    /** Seconds a file without a measured weight counts as (about the median file). */
    const DEFAULT_WEIGHT = 1;

    /**
     * Splits files into n parts of about the same time: the heaviest file first, each into the part with the least so far,
     * ties to the lower part. The same files and weights give the same parts every time.
     * @param {string[]} files @param {Record<string, number>} weights seconds per file @param {number} n
     * @returns {string[][]}
     */
    function partition(files, weights, n) {
      const parts = Array.from({ length: Math.max(1, n) }, () => ({ files: /** @type {string[]} */ ([]), load: 0 }));
      const order = files.map((f, i) => ({ f, i, w: Number(weights[f]) >= 0 ? Number(weights[f]) : DEFAULT_WEIGHT }))
        .sort((a, b) => b.w - a.w || a.i - b.i);
      for (const x of order) {
        let k = 0;
        for (let j = 1; j < parts.length; j++) if (parts[j].load < parts[k].load) k = j;
        parts[k].files.push(x.f); parts[k].load += x.w;
      }
      // Each part keeps the files in the order of the suite.
      return parts.map((p) => files.filter((f) => p.files.includes(f)));
    }

    /** `a`, `a.test.js` and `tests/a.test.js` name the same file. @param {string} name */
    const fileName = (name) => { const s = name.trim().replace(/^\.?\/?tests\//, ''); return /\.js$/.test(s) ? s : s + '.test.js'; };

    /**
     * The tests the parameters choose, in the order they registered, and the problems with the parameters.
     * @param {Array<{name: string, file: string, serial: boolean}>} all
     * @param {URLSearchParams} params
     * @param {Record<string, number>} weights
     * @returns {{tests: any[], errors: string[]}}
     */
    function pick(all, params, weights) {
      const errors = [];
      const words = (key) => (params.get(key) || '').split(',').map((s) => s.trim()).filter(Boolean);
      let chosen = all;
      const files = Array.from(new Set(all.map((t) => t.file)));
      const named = words('files').map(fileName);
      if (named.length) {
        for (const f of named) if (!files.includes(f)) errors.push('files: no tests in ' + f);
        chosen = chosen.filter((t) => named.includes(t.file));
      }
      const serialFiles = new Set(all.filter((t) => t.serial).map((t) => t.file));
      const serial = params.get('serial');
      if (serial === 'skip') chosen = chosen.filter((t) => !serialFiles.has(t.file));
      else if (serial === 'only') chosen = chosen.filter((t) => serialFiles.has(t.file));
      else if (serial) errors.push('serial: skip or only, not ' + serial);
      const shard = params.get('shard');
      if (shard) {
        const m = /^(\d+)\/(\d+)$/.exec(shard);
        if (!m || +m[1] < 1 || +m[1] > +m[2]) errors.push('shard: i/n with 1 <= i <= n, not ' + shard);
        else {
          const part = partition(Array.from(new Set(chosen.map((t) => t.file))), weights, +m[2])[+m[1] - 1];
          chosen = chosen.filter((t) => part.includes(t.file));
        }
      }
      const only = words('only');
      if (only.length) chosen = chosen.filter((t) => only.some((w) => t.name.includes(w)));
      return { tests: chosen, errors };
    }

    /**
     * How far a test's deadline moves on when a download reports progress: the time the rest should take at the measured
     * speed with a margin, at least 30 s and at most 20 minutes. A stalled download stops extending.
     * @param {{remaining: number|null, received: number}} summary from D.downloads.summary()
     */
    function extensionFor(summary) {
      if (!summary || !summary.received) return 0;
      const rest = summary.remaining === null ? 60 : summary.remaining;
      return Math.min(20 * 60000, Math.max(30000, rest * 1500));
    }

    /** Rejects at the deadline; downloads in flight (D.downloads) push the deadline on, so a slow network is not a failure. */
    function deadlineFor(t) {
      let deadline = Date.now() + t.timeoutMs;
      let extended = 0;
      let lastReceived = -1;
      const dl = D.downloads;
      const unsub = dl && dl.onChange ? dl.onChange((items) => {
        if (!items.length) return;
        const summary = dl.summary();
        if (summary.received === lastReceived) return;
        lastReceived = summary.received;
        const next = Date.now() + extensionFor(summary);
        if (next > deadline) { extended += next - deadline; deadline = next; }
      }) : null;
      let timer = null;
      const promise = /** @type {any} */ (new Promise((_, rej) => {
        const tick = () => {
          if (Date.now() >= deadline) rej(new Error('timeout after ' + t.timeoutMs + ' ms' + (extended ? ' (+' + Math.round(extended / 1000) + ' s while downloading)' : '')));
          else timer = setTimeout(tick, 250);
        };
        timer = setTimeout(tick, 250);
      }));
      promise.stop = () => { clearTimeout(timer); if (unsub) unsub(); };
      return promise;
    }

    /** Browser noise that is no error in the app: ResizeObserver reports a loop it already resolved. */
    const BENIGN = /ResizeObserver loop/;

    async function run(listEl, summaryEl) {
      let pass = 0; let fail = 0;
      // An error or a rejection that nobody handles is a fault even when the test passes (F18 a): each one is reported with the
      // test that was running when it came, and counts as a failure.
      /** @type {Array<{test: string, text: string}>} */
      const stray = [];
      let current = '(before the first test)';
      const textOf = (x) => String((x && (x.stack || x.message)) || x);
      const onError = (ev) => { const text = textOf(ev.error || ev.message); if (!BENIGN.test(text)) stray.push({ test: current, text }); };
      const onRejection = (ev) => { const text = textOf(ev.reason); if (!BENIGN.test(text)) stray.push({ test: current, text }); };
      globalThis.addEventListener('error', onError);
      globalThis.addEventListener('unhandledrejection', onRejection);
      const report = (line) => {
        console.log('DATASPATIUM-LOG: ' + line);
        if (listEl) { const li = document.createElement('li'); li.className = line.startsWith('OK') ? 'ok' : 'fail'; li.textContent = line; listEl.appendChild(li); }
      };
      let params = new URLSearchParams('');
      try { params = new URLSearchParams(location.search); } catch (_e) { /* no location */ }
      const weights = D.has && D.has('tests/weights') ? D.require('tests/weights') : {};
      const chosen = pick(tests, params, weights);
      for (const e of chosen.errors) { fail++; report('FAIL | selection :: ' + e); }
      /** @type {Map<string, {ms: number, n: number}>} */
      const perFile = new Map();
      for (const t of chosen.tests) {
        current = t.name;
        const t0 = performance.now();
        let line;
        const deadline = deadlineFor(t);
        try {
          const detail = await Promise.race([t.fn(assert), deadline]).finally(() => { if (deadline.stop) deadline.stop(); });
          pass++;
          line = `OK | ${t.name} :: ${detail === undefined ? 'ok' : String(detail)} (${Math.round(performance.now() - t0)} ms)`;
        } catch (err) {
          fail++;
          // Firefox stacks do not include the message; print both.
          const message = String((err && err.message) || err);
          const stack = err && err.stack ? String(err.stack) : '';
          line = `FAIL | ${t.name} :: ${(stack.includes(message) ? stack : message + ' | ' + stack).replace(/\s*\n\s*/g, ' | ')}`;
        }
        const f = perFile.get(t.file) || { ms: 0, n: 0 };
        f.ms += performance.now() - t0; f.n++; perFile.set(t.file, f);
        report(line);
      }
      // Late errors from the last tests (a timer, a frame) still count.
      current = '(after the last test)';
      await new Promise((r) => setTimeout(r, 500));
      globalThis.removeEventListener('error', onError);
      globalThis.removeEventListener('unhandledrejection', onRejection);
      for (const s of stray) { fail++; report(`FAIL | uncaught during "${s.test}" :: ${s.text.replace(/\s*\n\s*/g, ' | ')}`); }
      if (params.get('timings')) for (const [file, f] of perFile) console.log(`DATASPATIUM-TIME: ${file} ${Math.round(f.ms)} ${f.n}`);
      const summary = `DATASPATIUM-TESTS: pass=${pass} fail=${fail}`;
      console.log(summary);
      if (summaryEl) { summaryEl.textContent = summary; summaryEl.className = fail ? 'fail' : 'ok'; }
      return { pass, fail };
    }

    return { test, loading, run, assert, extensionFor, partition, pick };
  });
})();
