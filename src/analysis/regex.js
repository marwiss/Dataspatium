// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Regular expressions on datasets for the Regex tab in Analysera and the regex recipe steps. The syntax
 * rules are in data/regex-syntax.js.
 *
 * Matching runs in a small worker of its own with a time limit, because a pattern with catastrophic
 * backtracking such as (a+)+$ can take minutes on a single value and JavaScript cannot interrupt it. The
 * worker is terminated when the limit passes and created again on the next call. Before a recipe step
 * changes a dataset, every value of the column is checked in that worker (`guard`), so that the SQL that
 * follows, which runs the same pattern in the SQLite worker, cannot hang.
 *
 * Also: match counts over a column (`stats`) and the pattern profile (`profile`, shapes such as
 * 9999-99-99 with counts).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/regex', ['data/regex-syntax', 'data/datasets'], (syntax, datasets) => {
    const TIMEOUT_MS = 2000;
    const CHUNK = 5000;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

    /** Runs in the matching worker. Self-contained: it is serialised with toString(). */
    function dataspatiumRegexWorker() {
      'use strict';
      // The same compile rules as data/regex-syntax.js and the SQLite worker.
      function compile(pattern, flags) {
        var p = String(pattern); var f = '';
        var lead = /^(?:\(\?[ims]+\))+/.exec(p);
        if (lead) p = p.slice(lead[0].length);
        String(flags || '').concat(lead ? lead[0].replace(/[^ims]/g, '') : '').split('').forEach(function (c) { if ('dgimsuyv'.indexOf(c) >= 0 && f.indexOf(c) < 0) f += c; });
        try { return new RegExp(p, f + 'u'); } catch (e) { return new RegExp(p, f); }
      }
      function all(re, text, limit) {
        var out = []; var m; re.lastIndex = 0;
        while (out.length < limit && (m = re.exec(text)) !== null) {
          out.push(m);
          if (m[0] === '') re.lastIndex++;
        }
        return out;
      }
      self.onmessage = function (ev) {
        var msg = ev.data;
        try {
          var flags = String(msg.flags || '').replace(/g/g, '');
          var re = compile(msg.pattern, flags);
          var g = compile(msg.pattern, flags + 'g');
          var values = msg.values || [];
          var out = new Array(values.length);
          for (var i = 0; i < values.length; i++) {
            var v = values[i];
            if (v === null || v === undefined) { out[i] = null; continue; }
            var s = String(v);
            if (msg.op === 'test') out[i] = re.test(s) ? 1 : 0;
            else if (msg.op === 'replace') { g.lastIndex = 0; out[i] = s.replace(g, msg.replacement || ''); }
            else {
              // 'match': up to `limit` matches as [index, length, groups].
              out[i] = all(g, s, msg.limit || 50).map(function (m) { return [m.index, m[0].length, m.slice(1).map(function (x) { return x === undefined ? null : x; })]; });
            }
          }
          self.postMessage({ id: msg.id, ok: true, value: out });
        } catch (err) {
          self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
        }
      };
    }

    let worker = null; let seq = 0;
    /** @type {Map<number, {resolve: Function, reject: Function, timer: any}>} */
    const pending = new Map();
    function ensureWorker() {
      if (worker) return worker;
      worker = D.workers.create({ namespace: 'regex', source: D.workers.functionSource(dataspatiumRegexWorker) });
      worker.onmessage = (ev) => {
        const m = ev.data; const p = pending.get(m.id);
        if (!p) return;
        pending.delete(m.id); clearTimeout(p.timer);
        if (m.ok) p.resolve(m.value); else p.reject(new Error(m.error));
      };
      worker.onerror = (ev) => { const err = new Error('Regex worker: ' + (ev.message || 'error')); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(err); } pending.clear(); };
      return worker;
    }
    /** Stop the worker; calls that are waiting are rejected with `reason`. */
    function stop(reason) {
      if (worker) { worker.terminate(); worker = null; }
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(reason || new Error('stopped')); }
      pending.clear();
    }

    /** Error raised when a pattern runs past the time limit. */
    class RegexTimeout extends Error {
      constructor() { super(D.t('regex.err.timeout')); this.name = 'RegexTimeout'; }
    }

    /**
     * Evaluate a pattern on values in the matching worker within the time limit.
     * @param {{op: 'test'|'match'|'replace', pattern: string, flags?: string, values: any[], replacement?: string, limit?: number}} task
     * @param {number} [timeout] milliseconds
     * @returns {Promise<any[]>}
     */
    function run(task, timeout = TIMEOUT_MS) {
      const w = ensureWorker();
      return new Promise((resolve, reject) => {
        const id = ++seq;
        const timer = setTimeout(() => { pending.delete(id); const err = new RegexTimeout(); stop(err); reject(err); }, timeout);
        pending.set(id, { resolve, reject, timer });
        w.postMessage(Object.assign({ id }, task));
      });
    }

    /** The engine of a dataset id, or of `{engine}` (inside a recipe step). */
    async function engineOf(target) {
      if (target && typeof target === 'object' && target.engine) return target.engine;
      return (await datasets.ensureOpen(String(target))).engine;
    }

    /**
     * Distinct values of a column as text with their row counts, most common first.
     * @param {string|{engine: any}} target @param {string} column @param {number} limit
     * @returns {Promise<Array<[string, number]>>}
     */
    async function distinct(target, column, limit) {
      const engine = await engineOf(target);
      const res = await engine.exec(`select cast(${q(column)} as text) as v, count(*) as n from data where ${q(column)} is not null group by v order by n desc, v limit ?`, [limit]);
      return res[0] ? res[0].values.map((r) => [r[0], Number(r[1])]) : [];
    }

    /**
     * How many rows of a column match: exact when the column has at most `maxDistinct` distinct values,
     * otherwise counted over the most common ones (`sampled`).
     * @returns {Promise<{rows: number, filled: number, matching: number, distinct: number, sampled: boolean}>}
     */
    async function stats(target, column, pattern, flags, maxDistinct = 20000) {
      const engine = await engineOf(target);
      const head = await engine.exec(`select count(*), count(${q(column)}), count(distinct ${q(column)}) from data`);
      const [rows, filled, nDistinct] = head[0].values[0].map(Number);
      const values = await distinct({ engine }, column, maxDistinct);
      const hits = values.length ? await run({ op: 'test', pattern, flags, values: values.map((v) => v[0]) }) : [];
      let matching = 0;
      values.forEach((v, i) => { if (hits[i]) matching += v[1]; });
      return { rows, filled, matching, distinct: nDistinct, sampled: nDistinct > values.length };
    }

    /**
     * Check every value of a column within the time limit before SQL runs the pattern on the whole column.
     * The column is read in rowid order a chunk at a time; values already checked are skipped. Rejects
     * with RegexTimeout when a chunk takes too long, and with an error for an invalid pattern.
     * @param {string|{engine: any}} target
     */
    async function guard(target, column, pattern, flags) {
      const compiled = syntax.compile(pattern, flags);
      if (compiled.error) throw new Error(D.t('regex.err.invalid', { message: compiled.error }));
      const engine = await engineOf(target);
      const seen = new Set();
      let after = -9007199254740991;
      for (;;) {
        const res = await engine.exec(`select rowid, cast(${q(column)} as text) from data where rowid > ? and ${q(column)} is not null order by rowid limit ?`, [after, CHUNK]);
        const rows = res[0] ? res[0].values : [];
        if (!rows.length) return;
        const fresh = [];
        for (const r of rows) if (!seen.has(r[1])) { fresh.push(r[1]); if (seen.size < 200000) seen.add(r[1]); }
        if (fresh.length) await run({ op: 'test', pattern, flags, values: fresh }, TIMEOUT_MS * 2);
        after = Number(rows[rows.length - 1][0]);
        if (rows.length < CHUNK) return;
      }
    }

    /**
     * Pattern profile: the shapes of a column's values with counts and an example of each.
     * @param {string|{engine: any}} target @param {string} column @param {boolean} collapse
     * @returns {Promise<Array<{shape: string, count: number, example: string}>>}
     */
    async function profile(target, column, collapse, limit = 30) {
      const engine = await engineOf(target);
      const res = await engine.exec(`select dm_shape(cast(${q(column)} as text), ?) as s, count(*) as n, min(cast(${q(column)} as text)) as ex from data where ${q(column)} is not null group by s order by n desc, s limit ?`, [collapse ? 1 : 0, limit]);
      return res[0] ? res[0].values.map((r) => ({ shape: r[0], count: Number(r[1]), example: r[2] })) : [];
    }

    return Object.assign({}, syntax, { run, stop, RegexTimeout, distinct, stats, guard, profile, TIMEOUT_MS });
  });
})();
