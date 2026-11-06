// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tiny browser test harness. Tests register with `test(name, fn, timeoutMs)`; `run()` executes them
 * sequentially, renders results and prints the machine-readable lines tools/run-tests.ps1 looks for.
 * `?only=word1,word2` in the address runs a subset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/harness', [], () => {
    /** @type {Array<{name: string, fn: Function, timeoutMs: number}>} */
    const tests = [];

    function test(name, fn, timeoutMs = 20000) { tests.push({ name, fn, timeoutMs }); }

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

    /** `tests/index.html?only=formats3` runs only the tests whose names contain one of the comma-separated words. */
    function selected() {
      let only = [];
      try { only = (new URLSearchParams(location.search).get('only') || '').split(',').map((s) => s.trim()).filter(Boolean); } catch (_e) { /* no location */ }
      return only.length ? tests.filter((t) => only.some((w) => t.name.includes(w))) : tests;
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

    async function run(listEl, summaryEl) {
      let pass = 0; let fail = 0;
      for (const t of selected()) {
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
        console.log('DATASPATIUM-LOG: ' + line);
        if (listEl) { const li = document.createElement('li'); li.className = line.startsWith('OK') ? 'ok' : 'fail'; li.textContent = line; listEl.appendChild(li); }
      }
      const summary = `DATASPATIUM-TESTS: pass=${pass} fail=${fail}`;
      console.log(summary);
      if (summaryEl) { summaryEl.textContent = summary; summaryEl.className = fail ? 'fail' : 'ok'; }
      return { pass, fail };
    }

    return { test, run, assert, extensionFor };
  });
})();
