// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The start profile (`?profil=start` in the address): how long the start takes and where the time goes. src/boot.js puts
 * marks in the browser's performance timeline (`dataspatium:boot`, `insert:<path>` and `load:<path>` per script,
 * `dom-content-loaded`, `ready`, `boot-error`), the app and the mobile app call `rendered()` once they have drawn, and this
 * module adds the long tasks over 50 ms (PerformanceObserver 'longtask', Chromium only) and, over http(s), the bytes per
 * file from the resource entries. A second after the first render it prints a console.table and one
 * `DATASPATIUM-LOG: profil ...` line per item, which tools/run-tests.ps1 prints; with `profil-exit=1` as well it ends with
 * a `DATASPATIUM-TESTS:` line, so the headless runner stops. Without the parameter nothing is observed or marked.
 *
 * A script's `total` is its load minus its insertion, which includes the wait for the scripts before it (they run in
 * order); its `own` time is its load minus the later of its insertion and the previous script's load, the time it alone
 * added, so the own times of a group add up to that group's share of the start.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const PREFIX = 'dataspatium:';

  /**
   * True when the query string has the parameter with the value among its values.
   * @param {string} search a location.search
   * @param {string} name
   * @param {string} value
   */
  function hasParam(search, name, value) {
    try { return new URLSearchParams(search).getAll(name).indexOf(value) >= 0; } catch (_e) { return false; }
  }
  const on = hasParam(location.search, 'profil', 'start');

  D.define('platform/startup-profile', [], () => {
    /** The slowest scripts, the largest files and the longest tasks listed one by one. */
    const TOP = 15;
    /** A task longer than this blocks the page noticeably (the browser's own threshold for a long task). */
    const LONG_TASK_MS = 50;
    /** After the first render the summary waits this long, so that long tasks the browser reports late still count. */
    const SETTLE_MS = 1000;
    /** Without a first render (the very first start waits for the language choice) the summary comes this long after ready. */
    const NO_RENDER_MS = 60000;

    /** @typedef {{name: string, startTime: number}} ProfileMark */
    /** @typedef {{name: string, transferSize?: number, encodedBodySize?: number, decodedBodySize?: number}} ProfileResource */
    /** @typedef {{startTime: number, duration: number}} ProfileTask */
    /**
     * @typedef {object} ProfileInput
     * @property {ProfileMark[]} marks the page's marks; only those named `dataspatium:...` count
     * @property {ProfileResource[]} [resources] resource timing entries
     * @property {ProfileTask[]|null} [longTasks] the long tasks seen, or null where the browser does not report them
     * @property {ProfileMark[]} [paints] paint entries (first-paint, first-contentful-paint)
     * @property {{domContentLoadedEventStart?: number}|null} [navigation] the navigation entry, for DOMContentLoaded without a mark
     * @property {string} [protocol] location.protocol
     * @property {string} [page] 'full' or 'mobile'
     * @property {string|null} [error] why the start did not finish, if it did not
     */
    /**
     * @typedef {object} ProfileScript
     * @property {string} path the path in the boot list
     * @property {string} group its folder group (groupOf)
     * @property {number} inserted ms from navigation start
     * @property {number} loaded ms from navigation start
     * @property {number} total load minus insertion
     * @property {number} own the time it alone added
     * @property {number|null} bytes decoded size, null when the browser does not report it
     */

    /** @param {number|null|undefined} v */
    const round = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
    /** @param {number|null} v */
    const ms = (v) => (v === null ? '-' : Math.round(v) + ' ms');
    /** @param {number} b */
    const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(1) + ' kB');
    /** @param {number} n @param {string} word */
    const count = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    /** @param {ProfileResource} r */
    const bodyOf = (r) => Number(r.decodedBodySize || r.encodedBodySize || 0);

    /**
     * The folder group of a script: `src/ui/<folder>` under src/ui, `src/<folder>` elsewhere under src, else the top folder.
     * @param {string} path e.g. 'src/ui/i18n/sv.js'
     * @returns {string} e.g. 'src/ui/i18n'
     */
    function groupOf(path) {
      const parts = String(path).split(/[?#]/)[0].split('/');
      parts.pop();
      if (!parts.length) return '.';
      return parts.slice(0, parts[0] === 'src' && parts[1] === 'ui' ? 3 : 2).join('/');
    }

    /**
     * The summary of a start, from the timeline's entries alone (no browser calls, so it can be tried with fake entries).
     * @param {ProfileInput} input
     */
    function summarize(input) {
      const marks = (input.marks || []).filter((m) => m && String(m.name).startsWith(PREFIX));
      /** @param {string} name */
      const at = (name) => { const m = marks.find((x) => x.name === PREFIX + name); return m ? m.startTime : null; };
      /** @type {Map<string, number>} */ const inserted = new Map();
      /** @type {Map<string, number>} */ const loaded = new Map();
      for (const m of marks) {
        const name = m.name.slice(PREFIX.length);
        if (name.startsWith('insert:') && !inserted.has(name.slice(7))) inserted.set(name.slice(7), m.startTime);
        else if (name.startsWith('load:') && !loaded.has(name.slice(5))) loaded.set(name.slice(5), m.startTime);
      }
      const sized = (input.resources || []).map((r) => ({ url: String(r.name || '').split(/[?#]/)[0], bytes: bodyOf(r) })).filter((r) => r.bytes > 0);
      /** @param {string} path */
      const bytesOf = (path) => { const hit = sized.find((r) => r.url.endsWith('/' + path)); return hit ? hit.bytes : null; };
      const boot = at('boot');
      let previous = boot === null ? 0 : boot;
      /** @type {ProfileScript[]} */
      const scripts = Array.from(loaded.entries()).sort((a, b) => a[1] - b[1]).map(([path, end]) => {
        const start = inserted.has(path) ? /** @type {number} */ (inserted.get(path)) : end;
        const own = Math.max(0, end - Math.max(previous, start));
        previous = end;
        return { path, group: groupOf(path), inserted: /** @type {number} */ (round(start)), loaded: /** @type {number} */ (round(end)), total: /** @type {number} */ (round(end - start)), own: /** @type {number} */ (round(own)), bytes: bytesOf(path) };
      });
      const slowest = scripts.slice().sort((a, b) => b.total - a.total || b.own - a.own).slice(0, TOP);

      /** @type {Map<string, {group: string, scripts: number, own: number, bytes: number|null}>} */
      const byGroup = new Map();
      for (const s of scripts) {
        const g = byGroup.get(s.group) || { group: s.group, scripts: 0, own: 0, bytes: null };
        g.scripts += 1; g.own += s.own;
        if (s.bytes !== null) g.bytes = (g.bytes || 0) + s.bytes;
        byGroup.set(s.group, g);
      }
      const groups = Array.from(byGroup.values()).map((g) => ({ group: g.group, scripts: g.scripts, own: /** @type {number} */ (round(g.own)), bytes: g.bytes }))
        .sort((a, b) => b.own - a.own || a.group.localeCompare(b.group));

      const resources = input.resources || [];
      const counted = scripts.filter((s) => s.bytes !== null);
      const bytes = {
        available: counted.length > 0,
        counted: counted.length,
        scripts: counted.reduce((n, s) => n + /** @type {number} */ (s.bytes), 0),
        resources: resources.length,
        all: resources.reduce((n, r) => n + bodyOf(r), 0),
        transferred: resources.reduce((n, r) => n + Number(r.transferSize || 0), 0),
        largest: counted.slice().sort((a, b) => /** @type {number} */ (b.bytes) - /** @type {number} */ (a.bytes)).slice(0, TOP).map((s) => ({ path: s.path, bytes: /** @type {number} */ (s.bytes) })),
      };

      const tasks = input.longTasks === null || input.longTasks === undefined ? null : input.longTasks.filter((x) => x.duration > LONG_TASK_MS);
      const longTasks = {
        supported: tasks !== null,
        count: tasks ? tasks.length : 0,
        total: round(tasks ? tasks.reduce((n, x) => n + x.duration, 0) : 0),
        longest: round(tasks ? tasks.reduce((n, x) => Math.max(n, x.duration), 0) : 0),
        // The longest ones in time order, each with the scripts that finished within it (a script's load event ends its task).
        items: (tasks || []).slice().sort((a, b) => b.duration - a.duration).slice(0, TOP).sort((a, b) => a.startTime - b.startTime).map((x) => ({
          start: round(x.startTime),
          duration: round(x.duration),
          scripts: Array.from(loaded.entries()).filter(([, end]) => end >= x.startTime && end <= x.startTime + x.duration).map(([path]) => path),
        })),
      };

      const nav = input.navigation && Number(input.navigation.domContentLoadedEventStart) > 0 ? Number(input.navigation.domContentLoadedEventStart) : null;
      const dcl = at('dom-content-loaded');
      const timeline = {
        boot: round(boot),
        domContentLoaded: round(dcl === null ? nav : dcl),
        scriptsDone: scripts.length ? scripts[scripts.length - 1].loaded : null,
        ready: round(at('ready')),
        firstRender: round(at('first-render')),
        bootError: round(at('boot-error')),
      };
      const paints = (input.paints || []).map((p) => ({ name: p.name, start: round(p.startTime) }));
      return { page: input.page || 'full', protocol: input.protocol || '', timeline, scripts, slowest, groups, bytes, longTasks, paints, error: input.error || null };
    }

    /**
     * One line per item of a summary, each to be printed after `DATASPATIUM-LOG: `.
     * @param {ReturnType<typeof summarize>} s
     * @returns {string[]}
     */
    function lines(s) {
      const tl = s.timeline;
      const out = [`profil start: ${s.page} page over ${s.protocol || '?'}, ${count(s.scripts.length, 'script')}; from navigation start: boot ${ms(tl.boot)}, DOMContentLoaded ${ms(tl.domContentLoaded)}, last script ${ms(tl.scriptsDone)}, ready ${ms(tl.ready)}, first render ${ms(tl.firstRender)}`];
      for (const p of s.paints) out.push(`profil paint: ${p.name} ${ms(p.start)}`);
      s.slowest.forEach((x, i) => out.push(`profil slowest ${i + 1}: ${x.path} ${ms(x.total)} from insertion to load (own ${ms(x.own)}${x.bytes === null ? '' : ', ' + size(x.bytes)})`));
      for (const g of s.groups) out.push(`profil group: ${g.group} ${count(g.scripts, 'script')}, own ${ms(g.own)}${g.bytes === null ? '' : ', ' + size(g.bytes)}`);
      if (s.bytes.available) {
        out.push(`profil bytes: ${s.bytes.counted} of ${s.scripts.length} scripts ${size(s.bytes.scripts)}; all ${s.bytes.resources} resources ${size(s.bytes.all)}, transferred ${size(s.bytes.transferred)}`);
        s.bytes.largest.forEach((x, i) => out.push(`profil largest ${i + 1}: ${x.path} ${size(x.bytes)}`));
      } else {
        out.push(`profil bytes: not reported by the browser over ${s.protocol || '?'} (from a web server the bytes per file are listed)`);
      }
      if (!s.longTasks.supported) out.push('profil long tasks: not reported by this browser');
      else {
        out.push(`profil long tasks: ${s.longTasks.count} over ${LONG_TASK_MS} ms, ${ms(s.longTasks.total)} in all, longest ${ms(s.longTasks.longest)}`);
        for (const x of s.longTasks.items) out.push(`profil long task: ${ms(x.duration)} at ${ms(x.start)}${x.scripts.length ? ' during ' + x.scripts.join(', ') : ''}`);
      }
      if (s.error) out.push(`profil error: ${s.error}`);
      return out;
    }

    /** @type {ProfileTask[]|null} */
    let tasks = null;
    let begun = false;
    let renderSeen = false;
    let finished = false;
    let noRender = 0;

    /** The page's entries now, for summarize. @param {string|null} error */
    function collect(error) {
      /** @param {string} type @returns {any[]} */
      const get = (type) => { try { return performance.getEntriesByType(type); } catch (_e) { return []; } };
      return {
        marks: get('mark').map((m) => ({ name: m.name, startTime: m.startTime })),
        resources: get('resource').map((r) => ({ name: r.name, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize })),
        paints: get('paint').map((p) => ({ name: p.name, startTime: p.startTime })),
        navigation: get('navigation')[0] || null,
        longTasks: tasks ? tasks.slice() : null,
        protocol: location.protocol,
        page: /** @type {any} */ (globalThis).DATASPATIUM_PROFILE === 'mobile' ? 'mobile' : 'full',
        error,
      };
    }

    /** Prints the summary once: a console.table and the lines, and the runner's stop line with profil-exit=1. @param {string|null} error */
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(noRender);
      const summary = summarize(collect(error));
      try { console.table(summary.scripts); console.table(summary.groups); } catch (_e) { /* no console.table */ }
      for (const line of lines(summary)) console.log('DATASPATIUM-LOG: ' + line);
      const failed = summary.error ? 1 : 0;
      if (hasParam(location.search, 'profil-exit', '1')) console.log(`DATASPATIUM-TESTS: pass=${1 - failed} fail=${failed}`);
    }

    /** Starts observing (called at load when the profile is on): a resource buffer for every file, long tasks, the boot events. */
    function begin() {
      if (!on || begun) return;
      begun = true;
      try { performance.setResourceTimingBufferSize(5000); } catch (_e) { /* the default buffer */ }
      try {
        if (typeof PerformanceObserver === 'function' && (PerformanceObserver.supportedEntryTypes || []).indexOf('longtask') >= 0) {
          const seen = /** @type {ProfileTask[]} */ ([]);
          tasks = seen;
          new PerformanceObserver((list) => { for (const e of list.getEntries()) seen.push({ startTime: e.startTime, duration: e.duration }); })
            .observe({ type: 'longtask', buffered: true });
        }
      } catch (_e) { tasks = null; }
      document.addEventListener('dataspatium:ready', () => {
        noRender = setTimeout(() => finish(`no first render within ${NO_RENDER_MS / 1000} s after ready (the very first start waits for the language choice; add lang=sv)`), NO_RENDER_MS);
      }, { once: true });
      document.addEventListener('dataspatium:boot-error', (ev) => finish('the start failed at ' + /** @type {CustomEvent} */ (ev).detail), { once: true });
    }

    /**
     * The app or the mobile app has drawn for the first time: marks `dataspatium:first-render` after the next frame (when it
     * is on the screen) and prints the summary a second later. Does nothing without the profile or after the first call.
     */
    function rendered() {
      if (!on || renderSeen) return;
      renderSeen = true;
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        try { performance.mark(PREFIX + 'first-render'); } catch (_e) { /* no user timing */ }
        clearTimeout(noRender);
        setTimeout(() => finish(null), SETTLE_MS);
      };
      // A hidden page draws no frames; then the mark comes now, and the timer covers a frame that never comes.
      if (document.visibilityState === 'hidden') { go(); return; }
      requestAnimationFrame(() => setTimeout(go, 0));
      setTimeout(go, 1000);
    }

    return { summarize, lines, groupOf, begin, rendered, TOP, LONG_TASK_MS };
  });

  if (on) D.require('platform/startup-profile').begin();
})();
