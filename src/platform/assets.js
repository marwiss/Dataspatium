// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Asset loader for embedded third-party resources.
 *
 * Binaries (wasm, R packages, fonts) and ES module text are shipped as JavaScript wrapper files in
 * vendor/ that call `Dataspatium.assets.register(name, encoding, payload)`. `vendor/manifest.js` maps
 * asset names to wrapper files, so assets load lazily by injecting a <script> tag, which works under
 * file:// where fetch() does not. Decoding uses Uint8Array.fromBase64 and DecompressionStream.
 *
 * Asset names look like `webr/R.wasm` or `webr-repo/bin/emscripten/contrib/4.6/PACKAGES`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  /** @type {Map<string, {encoding: string, payload: string}>} raw registrations awaiting decode */
  const registry = new Map();
  /** @type {Map<string, {kind: 'text'|'binary', data: any}>} decoded assets */
  const decoded = new Map();
  /** @type {Map<string, Promise<void>>} wrapper file URL -> load promise */
  const loading = new Map();
  /** @type {{assets: Record<string, any>, libraries: Record<string, any>}} */
  let manifestData = { assets: {}, libraries: {} };
  const base = () => globalThis.DATASPATIUM_BASE || '';

  function manifest(m) { manifestData = m; }

  /**
   * Declare additional assets outside vendor/manifest.js (for example presets shipped with the app).
   * @param {Record<string, {file: string, encoding: string, size?: number, library?: string}>} entries
   */
  function addEntries(entries) { Object.assign(manifestData.assets, entries); }

  /** Called by wrapper files in vendor/. */
  function register(name, encoding, payload) { registry.set(name, { encoding, payload }); }

  /** @param {string} b64 @returns {Uint8Array} */
  function decodeBase64(b64) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** @param {Uint8Array} bytes @returns {Promise<Uint8Array>} */
  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Inject a classic script and resolve when it has executed. */
  function loadScript(url) {
    const existing = loading.get(url);
    if (existing) return existing;
    const p = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = url;
      el.async = true;
      el.onload = () => { el.remove(); resolve(); };
      el.onerror = () => { el.remove(); loading.delete(url); reject(new Error('Could not load script ' + url)); };
      document.head.appendChild(el);
    });
    loading.set(url, p);
    return p;
  }

  async function ensureRegistered(name) {
    if (registry.has(name)) return;
    const entry = manifestData.assets[name];
    if (!entry) throw new Error('Unknown asset: ' + name);
    if (entry.provided) throw new Error('Provided asset ' + name + ' is no longer in memory');
    const url = base() + entry.file;
    await loadScript(url);
    if (!registry.has(name)) {
      // The wrapper ran earlier and its payload was consumed; inject it again.
      loading.delete(url);
      await loadScript(url);
      if (!registry.has(name)) throw new Error('Asset ' + name + ' was not registered by ' + entry.file);
    }
  }

  /**
   * Decode an asset to {kind, data}. Binary data is an ArrayBuffer, text a string.
   * @param {string} name
   * @returns {Promise<{kind: 'text'|'binary', data: any}>}
   */
  /** @type {Map<string, Promise<{kind: 'text'|'binary', data: any}>>} decodes in flight, shared by concurrent callers */
  const decoding = new Map();
  async function decode(name) {
    const cached = decoded.get(name);
    if (cached) return cached;
    // Two concurrent loads of one asset share the work: the first decode drops the raw payload from the registry.
    if (decoding.has(name)) return decoding.get(name);
    const p = (async () => {
      await ensureRegistered(name);
      const raw = /** @type {{encoding: string, payload: string}} */ (registry.get(name));
      /** @type {{kind: 'text'|'binary', data: any}} */
      let result;
      if (raw.encoding === 'text') result = { kind: 'text', data: raw.payload };
      else if (raw.encoding === 'base64') result = { kind: 'binary', data: decodeBase64(raw.payload).buffer };
      else if (raw.encoding === 'gzip+base64') result = { kind: 'binary', data: (await gunzip(decodeBase64(raw.payload))).buffer };
      else throw new Error('Unknown encoding ' + raw.encoding + ' for ' + name);
      registry.delete(name); // drop the large base64 string
      decoded.set(name, result);
      return result;
    })();
    decoding.set(name, p);
    try { return await p; } finally { decoding.delete(name); }
  }

  /** @returns {Promise<ArrayBuffer|string>} */
  async function load(name) { return (await decode(name)).data; }

  /** @returns {Promise<string>} */
  async function loadText(name) {
    const e = await decode(name);
    return e.kind === 'text' ? e.data : new TextDecoder().decode(new Uint8Array(e.data));
  }

  /** Decoded entry if already in memory, otherwise null (no loading). */
  function peek(name) { return decoded.get(name) || null; }

  /**
   * Provide an asset that was not shipped as a wrapper file: a component fetched on demand (platform/components) or
   * generated text. It behaves like a decoded asset from then on (until taken by a worker transfer).
   * @param {string} name @param {'text'|'binary'} kind @param {string|ArrayBuffer} data
   */
  function provide(name, kind, data) {
    decoded.set(name, { kind, data });
    if (!manifestData.assets[name]) manifestData.assets[name] = { file: null, encoding: kind === 'text' ? 'text' : 'binary', size: kind === 'text' ? String(data).length : /** @type {ArrayBuffer} */ (data).byteLength, provided: true };
  }

  /** Remove a decoded asset from the cache (after transferring its buffer to a worker). */
  function take(name) { const e = decoded.get(name); decoded.delete(name); return e; }

  /** @param {string} prefix @returns {string[]} */
  function names(prefix) { return Object.keys(manifestData.assets).filter((n) => n.startsWith(prefix)); }

  async function loadAll(prefix) { const list = names(prefix); await Promise.all(list.map(decode)); return list; }

  function info(name) { return manifestData.assets[name]; }
  function libraries() { return manifestData.libraries; }

  /**
   * Import an ES module shipped as text, via a blob: URL (works under file:// in Chromium and Firefox).
   * @param {string} name asset name of the module text
   */
  async function importModule(name) {
    const text = await loadText(name);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    try { return await import(url); } finally { URL.revokeObjectURL(url); }
  }

  /** @type {Map<string, {index: any, urls: Map<string, string>, pending: Map<string, Promise<string>>, modules: Map<string, Promise<any>>}>} */
  const graphs = new Map();
  async function graphUrl(g, lib, spec) {
    if (g.urls.has(spec)) return g.urls.get(spec);
    if (g.pending.has(spec)) return g.pending.get(spec);
    const p = (async () => {
      const m = g.index.modules[spec];
      if (!m) throw new Error('Unknown module ' + spec + ' in graph ' + lib);
      let text = await loadText(lib + '/graph/' + m.file);
      for (const [from, to] of m.rewrites || []) {
        if (!text.includes(from)) throw new Error('Rewrite not found in ' + spec);
        text = text.replace(from, to);
      }
      if (m.append) text += '\n' + m.append;
      for (const [lit, dep] of Object.entries(m.deps || {})) {
        const url = await graphUrl(g, lib, dep);
        text = text.split('"' + lit + '"').join('"' + url + '"').split("'" + lit + "'").join("'" + url + "'");
      }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      g.urls.set(spec, url);
      return url;
    })();
    g.pending.set(spec, p);
    return p;
  }
  /**
   * Import an ES module graph fetched by tools/fetch_vendor.py (type "esm-graph", e.g. mdb-reader): every module
   * text becomes a blob: URL in dependency order, its import specifiers rewritten to the URLs of its
   * dependencies (barrels were inlined and self-imports turned into aliases by the tool, so the graph is
   * acyclic). Works under file:// in Chromium and Firefox without import maps.
   * @param {string} lib library name in vendor.json @param {string} [spec] a module of the graph (default: the entry)
   */
  async function importGraph(lib, spec) {
    let g = graphs.get(lib);
    if (!g) {
      const index = JSON.parse(await loadText(lib + '/graph/index.json'));
      g = { index, urls: new Map(), pending: new Map(), modules: new Map() };
      graphs.set(lib, g);
    }
    const target = spec || g.index.entry;
    if (!g.modules.has(target)) g.modules.set(target, graphUrl(g, lib, target).then((url) => import(url)));
    return g.modules.get(target);
  }

  /** Load a directly shipped (non-wrapped) vendor script such as vendor/d3/d3.min.js. */
  function loadVendorScript(relativePath) { return loadScript(base() + relativePath); }

  D.assets = { manifest, addEntries, register, decode, load, loadText, loadAll, peek, take, provide, names, info, libraries, importModule, importGraph, loadScript, loadVendorScript, decodeBase64, gunzip };
  D.define('platform/assets', [], () => D.assets);
})();
