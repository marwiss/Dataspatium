// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tiny browser test harness. Tests register with `test(name, fn, timeoutMs)`; `run()` executes them
 * sequentially, renders results and prints the machine-readable lines tools/run-tests.ps1 looks for.
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

    async function run(listEl, summaryEl) {
      let pass = 0; let fail = 0;
      for (const t of tests) {
        const t0 = performance.now();
        let line;
        try {
          const detail = await Promise.race([
            t.fn(assert),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after ' + t.timeoutMs + ' ms')), t.timeoutMs)),
          ]);
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

    return { test, run, assert };
  });
})();
