// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Main-thread network shim.
 *
 * Third-party code running on the main thread (notably webR, which loads its worker script over
 * XMLHttpRequest when the base URL is cross-origin) must be able to request `dataspatium-asset://`
 * URLs. This file routes such requests through Dataspatium.assets (and through "virtual" providers for
 * generated content such as the shimmed worker source) and passes every other URL to the real
 * fetch / XMLHttpRequest untouched.
 *
 * It also patches `URL` when the page reports `location.origin === "null"` (Firefox on file://),
 * because `new URL(x, "null")` throws and webR uses exactly that call.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const SCHEME = 'dataspatium-asset://';
  /** @type {Map<string, () => Promise<{kind: 'text'|'binary', data: any}>>} */
  const virtual = new Map();

  /** @param {string} url @returns {string|null} */
  function assetName(url) {
    const s = String(url);
    if (!s.startsWith(SCHEME)) return null;
    return s.slice(SCHEME.length).replace(/[?#].*$/, '').replace(/\/{2,}/g, '/').replace(/^\//, '');
  }

  /** @param {string} name */
  function mimeFor(name) {
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    switch (ext) {
      case 'wasm': return 'application/wasm';
      case 'js': case 'mjs': return 'text/javascript';
      case 'json': case 'metadata': return 'application/json';
      case 'txt': case 'conf': case 'pem': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }

  function lookupAsync(name, url) {
    let provider = virtual.get(name);
    // A name ending in a slash answers for everything under it.
    if (!provider) for (const [key, fn] of virtual) if (key.endsWith('/') && name.startsWith(key)) { provider = fn; break; }
    if (provider) return provider(url);
    return D.assets.decode(name);
  }
  function lookupSync(name) { return D.assets.peek(name); }

  // Activity count and a short log of real network calls, for the status bar and the network settings view.
  const activity = { active: 0, listeners: new Set(), log: [] };
  const LOG_MAX = 200;
  function notify() { for (const fn of Array.from(activity.listeners)) { try { fn(activity.active); } catch (err) { console.error('[net] listener failed', err); } } }
  function isNetworkUrl(url) {
    if (/^https?:/i.test(url)) return true;
    return !/^[a-z][a-z0-9+.-]*:/i.test(url) && /^https?:$/.test(globalThis.location ? location.protocol : '');
  }
  /**
   * Record one request: counted while in flight, with url, method, status and duration in the log. The returned function ends it
   * once, with the HTTP status, or 'redirect' for a redirect that was not followed (anything else counts as an error).
   * @param {string} url @param {string} [method] @returns {(status: any) => void}
   */
  function record(url, method) {
    const entry = { at: Date.now(), url: String(url), method: String(method || 'GET').toUpperCase(), status: null, ms: null };
    activity.log.push(entry);
    if (activity.log.length > LOG_MAX) activity.log.shift();
    activity.active++;
    notify();
    let open = true;
    return (status) => {
      if (!open) return;
      open = false;
      activity.active--;
      entry.ms = Date.now() - entry.at;
      entry.status = typeof status === 'number' ? status : status === 'redirect' ? 'redirect' : 'error';
      notify();
    };
  }
  /** Track one request made here. */
  function track(url, init, promise) {
    const done = record(url, init && init.method);
    return promise.then((res) => { done(res && res.status); return res; }, (err) => { done(null); throw err; });
  }

  // fetch()
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function fetch(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && input.url) || String(input));
    const name = assetName(url);
    if (name === null) { const p = realFetch(input, init); return isNetworkUrl(url) ? track(url, init, p) : p; }
    return lookupAsync(name, url).then((entry) => {
      const buf = entry.kind === 'text' ? new TextEncoder().encode(entry.data).buffer : entry.data.slice(0);
      // A virtual provider may answer with another status (the tests use it for server errors).
      const status = typeof entry.status === 'number' ? entry.status : 200;
      // ... and with headers of its own (a Link to the next page of a list).
      return new Response(buf, { status, statusText: status === 200 ? 'OK' : 'Error', headers: Object.assign({ 'Content-Type': mimeFor(name), 'Content-Length': String(buf.byteLength) }, entry.headers || {}) });
    }, (err) => new Response(String((err && err.message) || err), { status: 404, statusText: 'Not Found' }));
  };

  // XMLHttpRequest
  globalThis.XMLHttpRequest = D.workerShim.makeXHR(globalThis.XMLHttpRequest, lookupSync, lookupAsync, assetName, mimeFor);

  // URL base "null" (Firefox on file://)
  if (globalThis.location && location.origin === 'null') {
    const RealURL = globalThis.URL;
    /** @this {any} */
    const PatchedURL = function URL(url, base) {
      if (base === undefined || base === null || base === 'null') return new RealURL(url);
      return new RealURL(url, base);
    };
    PatchedURL.prototype = RealURL.prototype;
    Object.setPrototypeOf(PatchedURL, RealURL);
    for (const key of ['createObjectURL', 'revokeObjectURL', 'canParse', 'parse']) {
      if (typeof RealURL[key] === 'function') PatchedURL[key] = RealURL[key].bind(RealURL);
    }
    globalThis.URL = /** @type {any} */ (PatchedURL);
  }

  D.net = {
    SCHEME,
    assetName,
    mimeFor,
    /** Serve generated content for an asset name (takes precedence over the manifest). */
    virtual(name, provider) { virtual.set(name, provider); },
    unvirtual(name) { virtual.delete(name); },
    assetUrl(name) { return SCHEME + name; },
    /** Number of real network requests in flight. */
    get active() { return activity.active; },
    /** Subscribe to changes of the in-flight count; returns the unsubscribe function. */
    onActivity(fn) { activity.listeners.add(fn); return () => activity.listeners.delete(fn); },
    /** The most recent real network requests (newest last): {at, url, method, status, ms}. */
    log() { return activity.log.slice(); },
    /** Record a request made elsewhere (a worker's fetch after consent); call the returned function with its status when it ends. */
    record,
  };
  D.define('platform/net', [], () => D.net);
})();
