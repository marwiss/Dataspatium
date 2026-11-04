// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Pyodide as components on demand. Python is not shipped in the ZIP: the runtime files (pinned here with their
 * SHA-256) and the wheels (verified with the digests in the pinned pyodide-lock.json) are fetched from jsDelivr
 * after consent, cached in IndexedDB by platform/components and provided as assets `pyodide/<file>` that the
 * Python worker loads through the asset shim. Nothing here touches the network before the user starts Python.
 *
 * The catalog also knows which package a Python import belongs to (`imports` in the lock), so that the bridge can
 * fetch the wheels a piece of code needs before Python looks for them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/python/catalog', ['platform/components'], (components) => {
    const VERSION = '314.0.7';
    const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
    /** Asset names: pyodide/<file>; the worker's indexURL. */
    const PREFIX = 'pyodide/';
    const INDEX_URL = 'dataspatium-asset://' + PREFIX;
    /** The runtime, pinned (regenerate with tools/pyodide_catalog.py when upgrading). */
    const RUNTIME = [
      { file: 'pyodide.js', sha256: '3141b814715a72e59b51b1b18b9ceae5bf19f7c852417e431bb0a34feadf825c', size: 18912, kind: 'text' },
      { file: 'pyodide.asm.mjs', sha256: 'f7cdc8ece80678ceb712f8e65ebe6d3a83203a180c399865f49612a051693635', size: 1250344, kind: 'text' },
      { file: 'pyodide.asm.wasm', sha256: 'cc36e3cab04fdfc9a63ff13eb52eae2b911bf46c025cc7b281f394bd3de1d5e6', size: 9598218, kind: 'binary' },
      { file: 'python_stdlib.zip', sha256: 'fa1957e5777068fc4f7437f96d860ae2fbe9c19732ba06c84e004ec16dd7dd7a', size: 2545637, kind: 'binary' },
      { file: 'pyodide-lock.json', sha256: '5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010', size: 119077, kind: 'text' },
    ];
    /** Packages fetched at the first start: what python/dataspatium.py needs, plus micropip for pure wheels. */
    const STARTUP = ['numpy', 'pandas', 'micropip'];
    /** Approximate wheel sizes for the consent dialog and progress (the lock has no sizes). */
    const KNOWN_SIZES = { numpy: 2960568, pandas: 4177749, matplotlib: 6982033, micropip: 115486, pillow: 1037806, fonttools: 1152647 };
    const RUNTIME_SIZE = RUNTIME.reduce((n, f) => n + f.size, 0);

    /** @type {Map<string, {name: string, version: string, file: string, sha256: string, depends: string[], imports: string[]}>|null} */
    let index = null;
    /** @type {Map<string, string>} top-level import name -> package name */
    let importMap = new Map();
    /** Asset names provided so far. */
    const provided = new Set();

    /** Build the index from a parsed pyodide-lock.json. */
    function parse(lock) {
      index = new Map();
      importMap = new Map();
      const packages = (lock && lock.packages) || {};
      for (const name of Object.keys(packages)) {
        const p = packages[name];
        if (!p || !p.file_name) continue;
        const entry = { name, version: String(p.version || ''), file: String(p.file_name), sha256: String(p.sha256 || ''), depends: (p.depends || []).map(String), imports: (p.imports || []).map(String) };
        index.set(name, entry);
        for (const imp of entry.imports) if (!importMap.has(imp)) importMap.set(imp, name);
      }
      return index;
    }

    function runtimeSpec(f) {
      return { id: 'pyodide:' + f.file, urls: [BASE + f.file], sha256: f.sha256, size: f.size, label: `Pyodide ${VERSION}: ${f.file}`, version: VERSION, purpose: 'components' };
    }
    function wheelSpec(entry) {
      return { id: 'pyodide:' + entry.file, urls: [BASE + entry.file], sha256: entry.sha256, size: KNOWN_SIZES[entry.name] || null, label: `Python: ${entry.name} ${entry.version}`, version: entry.version, purpose: 'components' };
    }

    /** Fetch (or reuse) the package index; the lock file is pinned by its own digest. */
    async function load(options = {}) {
      if (index) return index;
      const f = RUNTIME.find((r) => r.file === 'pyodide-lock.json');
      const text = await components.text(runtimeSpec(f), options);
      parse(JSON.parse(text));
      D.assets.provide(PREFIX + f.file, 'text', text);
      provided.add(PREFIX + f.file);
      return index;
    }

    function has(name) { return !!(index && index.has(name)); }
    function info(name) { return index ? index.get(name) || null : null; }
    function all() { return index ? Array.from(index.keys()) : []; }

    /**
     * Packages that a piece of Python code imports, by the lock's import names. Standard-library modules and
     * unknown names are left out; pandas' import chain is covered by the lock's `depends`.
     * @param {string} code
     * @returns {string[]} package names, in order of appearance
     */
    function referenced(code) {
      const found = [];
      const add = (mod) => {
        const top = String(mod).split('.')[0];
        const pkg = importMap.get(top);
        if (pkg && !found.includes(pkg)) found.push(pkg);
      };
      const lines = String(code || '').split(/\r?\n/);
      for (const raw of lines) {
        // Statements may share a line after ";"; comments are dropped.
        for (const part of raw.replace(/#.*$/, '').split(';')) {
          const s = part.trim();
          let m;
          if ((m = /^from\s+([A-Za-z_][\w.]*)\s+import\b/.exec(s))) { add(m[1]); continue; }
          if ((m = /^import\s+(.+)$/.exec(s))) {
            for (const item of m[1].split(',')) {
              const name = item.trim().split(/\s+/)[0];
              if (/^[A-Za-z_][\w.]*$/.test(name)) add(name);
            }
          }
        }
      }
      return found;
    }

    /** The dependency closure of the named packages (names unknown to the lock are ignored). */
    function closure(names) {
      const seen = [];
      const stack = names.filter((n) => has(n));
      while (stack.length) {
        const name = stack.pop();
        if (seen.includes(name)) continue;
        seen.push(name);
        for (const dep of index.get(name).depends) if (!seen.includes(dep) && has(dep)) stack.push(dep);
      }
      return seen;
    }

    /**
     * Download (or take from the cache) one runtime file or wheel and provide it as an asset. A binary asset is
     * consumed when it is transferred to the worker, so after a restart it is read from the component cache again.
     */
    async function provideSpec(spec, assetName, kind, options) {
      if (D.assets.peek(assetName)) { provided.add(assetName); return assetName; }
      const bytes = await components.ensure(spec, options);
      D.assets.provide(assetName, kind, kind === 'text' ? new TextDecoder().decode(new Uint8Array(bytes)) : bytes);
      provided.add(assetName);
      return assetName;
    }
    /** Whether an asset is in memory right now (not consumed by a worker transfer). */
    const inMemory = (assetName) => !!D.assets.peek(assetName);

    /**
     * The runtime files, as asset names, fetched after consent on first use.
     * @param {{onProgress?: Function}} [options]
     * @returns {Promise<string[]>}
     */
    async function ensureRuntime(options = {}) {
      const names = [];
      for (const f of RUNTIME) {
        const asset = PREFIX + f.file;
        if (!inMemory(asset)) await provideSpec(runtimeSpec(f), asset, f.kind, options);
        names.push(asset);
      }
      if (!index) await load(options);
      return names;
    }

    /**
     * Fetch the wheels (with dependencies) of the named packages that are not provided yet.
     * @param {string[]} names package names
     * @param {{onProgress?: Function}} [options]
     * @returns {Promise<{packages: string[], assets: string[]}>} what was newly provided (assets to ship to the worker)
     */
    async function ensurePackages(names, options = {}) {
      await load(options);
      const all = closure(names);
      // New to this session: never provided before. Others may need re-reading from the cache after a restart.
      const fresh = all.filter((n) => !provided.has(PREFIX + index.get(n).file));
      const assets = [];
      for (const name of all) {
        const entry = index.get(name);
        const asset = PREFIX + entry.file;
        if (!inMemory(asset)) await provideSpec(wheelSpec(entry), asset, 'binary', options);
        assets.push(asset);
      }
      return { packages: fresh, assets };
    }

    /**
     * Provider for asset requests from the worker (a wheel Pyodide fetches that was not shipped in advance, for
     * example after an import the scanner did not see). Returns false for names that are not Pyodide's.
     * @param {string} assetName
     */
    async function provideFile(assetName, options = {}) {
      if (!assetName.startsWith(PREFIX)) return false;
      if (inMemory(assetName)) return true;
      const file = assetName.slice(PREFIX.length);
      const runtime = RUNTIME.find((r) => r.file === file);
      if (runtime) { await provideSpec(runtimeSpec(runtime), assetName, runtime.kind, options); return true; }
      await load(options);
      const entry = Array.from(index.values()).find((e) => e.file === file);
      if (!entry) return false;
      await provideSpec(wheelSpec(entry), assetName, 'binary', options);
      return true;
    }

    /** Whether the runtime is already in the component cache (no download needed to start). */
    async function cachedRuntime() {
      for (const f of RUNTIME) { const m = await components.meta('pyodide:' + f.file); if (!m || m.sha256 !== f.sha256) return false; }
      return true;
    }

    function reset() { index = null; importMap = new Map(); provided.clear(); }

    return { VERSION, BASE, PREFIX, INDEX_URL, RUNTIME, RUNTIME_SIZE, STARTUP, parse, load, has, info, all, referenced, closure, ensureRuntime, ensurePackages, provideFile, cachedRuntime, provided: () => Array.from(provided), reset };
  });
})();
