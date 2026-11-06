// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Downloads in flight: components fetched after consent (platform/components) and the app's own big files when the
 * app is served over http (platform/assets). Each download reports what it is, the bytes received of the total, the
 * speed measured over the last seconds and the time left at that speed, and can be aborted. The status bar shows
 * the list with an abort button; the test harness extends a test's time limit while bytes keep arriving; the latest
 * measured speed gives an estimate before a download starts. Under file:// nothing is downloaded: the files are on
 * disk and this list stays empty.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  /** The speed is measured over this window, so that a stalled connection shows as such. */
  const WINDOW_MS = 4000;
  const listeners = new Set();
  /** @type {Map<string, any>} */
  const active = new Map();
  let lastSpeed = 0;
  let seq = 0;

  function list() { return Array.from(active.values()).map((d) => d.view()); }
  function notify() { for (const fn of Array.from(listeners)) { try { fn(list()); } catch (err) { console.error('[downloads] listener failed', err); } } }

  /** Bytes per second over the last window of the samples [{t, received}]. */
  function speedOf(samples, now) {
    const recent = samples.filter((s) => now - s.t <= WINDOW_MS);
    const first = recent.length > 1 ? recent[0] : samples[0];
    const last = samples[samples.length - 1];
    if (!first || !last || last.t <= first.t) return 0;
    return ((last.received - first.received) * 1000) / (last.t - first.t);
  }

  /**
   * Begin a download. `abort` is what stops the transfer (an AbortController's abort, for example).
   * @param {{id?: string, name: string, label?: string, total?: number|null, abort?: () => void}} spec
   * @returns {{id: string, aborted: boolean, update(received: number): void, done(): void, fail(err?: any): void, abort(): void, view(): any}}
   */
  function begin(spec) {
    const id = spec.id || ('dl' + (++seq));
    const started = Date.now();
    const samples = [{ t: started, received: 0 }];
    const d = {
      id, name: String(spec.name), label: String(spec.label || spec.name), total: spec.total || null, received: 0, started, aborted: false,
      view() {
        const now = Date.now();
        const speed = speedOf(samples, now);
        const remaining = d.total && speed > 0 ? Math.max(0, (d.total - d.received) / speed) : null;
        return { id: d.id, name: d.name, label: d.label, total: d.total, received: d.received, speed, remaining, started: d.started };
      },
      update(received) {
        d.received = Number(received) || 0;
        samples.push({ t: Date.now(), received: d.received });
        if (samples.length > 400) samples.splice(1, samples.length - 400);
        const s = speedOf(samples, Date.now());
        if (s > 0) lastSpeed = s;
        notify();
      },
      done() { if (active.delete(id)) notify(); },
      fail() { if (active.delete(id)) notify(); },
      abort() {
        d.aborted = true;
        try { if (spec.abort) spec.abort(); } catch (err) { console.error('[downloads] abort failed', err); }
        if (active.delete(id)) notify();
      },
    };
    active.set(id, d);
    notify();
    return d;
  }

  /** Everything in flight as one picture: bytes, total, speed and the time left at that speed (null when unknown). */
  function summary() {
    const items = list();
    const received = items.reduce((a, x) => a + x.received, 0);
    const total = items.reduce((a, x) => a + (x.total || 0), 0);
    const speed = items.reduce((a, x) => a + x.speed, 0);
    const remaining = total > 0 && speed > 0 ? Math.max(0, (total - received) / speed) : null;
    return { count: items.length, received, total, speed, remaining, items };
  }
  /** Seconds a download of `bytes` would take at the latest measured speed, or null before anything has been measured. */
  function estimate(bytes) { return lastSpeed > 0 && bytes > 0 ? bytes / lastSpeed : null; }
  function abortAll() { for (const d of Array.from(active.values())) d.abort(); }
  /** Abort one download by its id. */
  function abort(id) { const d = active.get(id); if (d) d.abort(); }
  /** @param {Function} fn called with the list of downloads in flight after every change */
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  /** Whether an error came from an aborted download. */
  const isAbort = (err) => !!(err && (err.name === 'AbortError' || err.aborted === true));
  /** Seconds as a short text: 45 s, 3 min, 1 h 20 min. */
  function formatSeconds(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 90) return s + ' s';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  D.downloads = { begin, list, summary, estimate, abort, abortAll, onChange, isAbort, formatSeconds, speed: () => lastSpeed };
  D.define('platform/downloads', [], () => D.downloads);
})();
