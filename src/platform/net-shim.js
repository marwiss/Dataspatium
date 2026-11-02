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
    const provider = virtual.get(name);
    if (provider) return provider(url);
    return D.assets.decode(name);
  }
  function lookupSync(name) { return D.assets.peek(name); }

  // fetch()
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function fetch(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && input.url) || String(input));
    const name = assetName(url);
    if (name === null) return realFetch(input, init);
    return lookupAsync(name, url).then((entry) => {
      const buf = entry.kind === 'text' ? new TextEncoder().encode(entry.data).buffer : entry.data.slice(0);
      return new Response(buf, { status: 200, statusText: 'OK', headers: { 'Content-Type': mimeFor(name), 'Content-Length': String(buf.byteLength) } });
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
  };
  D.define('platform/net', [], () => D.net);
})();
