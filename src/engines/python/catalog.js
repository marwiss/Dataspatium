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
    const VERSION = '0.29.5';
    const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
    /** Asset names: pyodide/<file>; the worker's indexURL. */
    const PREFIX = 'pyodide/';
    const INDEX_URL = 'dataspatium-asset://' + PREFIX;
    /**
     * The runtime, pinned (regenerate with tools/pyodide_catalog.py when upgrading). Pyodide 0.29.5 is the last line on
     * Python 3.13 (ABI 2025_0): IfcOpenShell's WebAssembly wheels are built for it (Martin 2026-11-06), so the app's Python
     * follows those wheels and moves to 3.14 when they do.
     */
    const RUNTIME = [
      { file: 'pyodide.js', sha256: '7f832a350240263d9946a9c3c877f7bcdab6c37d6dc65f72cd3be5905dca62dd', size: 18597, kind: 'text' },
      { file: 'pyodide.asm.js', sha256: '356c42f69e1695397e9d8670bd3c2e678248cde76e18bdae1731e848537b47d7', size: 1074322, kind: 'text' },
      { file: 'pyodide.asm.wasm', sha256: '54309a5a2cfd757b1f0fdbc9093c92503f7b341500110329d932487183912718', size: 8647684, kind: 'binary' },
      { file: 'python_stdlib.zip', sha256: '831fd1e535084b972f87c6a35275de3d236efd5166f5e77ce89497710635e73c', size: 2424003, kind: 'binary' },
      { file: 'pyodide-lock.json', sha256: '14d2c2dba101277999e17135e653d8f15389ad1437f53eae213bf0c3cdff723d', size: 122027, kind: 'text' },
    ];
    /** Packages fetched at the first start: what python/dataspatium.py needs, plus micropip for pure wheels. */
    /** sqlite3 is an unvendored standard-library module in the 0.29 line; python/dataspatium.py imports it. */
    const STARTUP = ['numpy', 'pandas', 'micropip', 'sqlite3'];
    /** Approximate wheel sizes for the consent dialog and progress (the lock has no sizes). */
    const KNOWN_SIZES = { numpy: 2823762, pandas: 4493372, matplotlib: 6664081, micropip: 115486, pillow: 1037865, fonttools: 1089800 };
    /**
     * Pure-Python wheels outside Pyodide's distribution, pinned to files on PyPI with their SHA-256. They are
     * installed by their asset address after their dependencies from the distribution.
     */
    const EXTRA = [
      { name: 'seaborn', version: '0.13.2', file: 'seaborn-0.13.2-py3-none-any.whl', url: 'https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl', sha256: '636f8336facf092165e27924f223d3c62ca560b1f2bb5dff7ab7fad265361987', size: 294914, depends: ['numpy', 'pandas', 'matplotlib'], imports: ['seaborn'] },
      { name: 'plotly', version: '7.1.0', file: 'plotly-7.1.0-py3-none-any.whl', url: 'https://files.pythonhosted.org/packages/e5/7d/905a3a3d51087515719058c94cfbda2ff0fc14417c20d557ae3e82d8b250/plotly-7.1.0-py3-none-any.whl', sha256: 'dbb7fa18afce40d0a8e80d1bf162eceb3faa0ce5a77fe741ad09a74cf78f53f3', size: 9692368, depends: ['narwhals', 'packaging'], imports: ['plotly'] },
      // lark and isodate: pure wheels IfcOpenShell needs that Pyodide's distribution does not carry.
      { name: 'lark', version: '1.3.1', file: 'lark-1.3.1-py3-none-any.whl', url: 'https://files.pythonhosted.org/packages/82/3d/14ce75ef66813643812f3093ab17e46d3a206942ce7376d31ec2d36229e7/lark-1.3.1-py3-none-any.whl', sha256: 'c629b661023a014c37da873b4ff58a817398d12635d3bbb2c5a03be7fe5d1e12', size: 113151, depends: [], imports: ['lark'] },
      { name: 'isodate', version: '0.7.2', file: 'isodate-0.7.2-py3-none-any.whl', url: 'https://files.pythonhosted.org/packages/15/aa/0aca39a37d3c7eb941ba736ede56d689e7be91cab5d9ca846bde3999eba6/isodate-0.7.2-py3-none-any.whl', sha256: '28009937d8031054830160fce6d409ed342816b543597cece116d966c6d99e15', size: 22320, depends: [], imports: ['isodate'] },
    ];
    /**
     * IfcOpenShell (LGPL-3.0; https://github.com/IfcOpenShell/IfcOpenShell) as the modular WebAssembly wheels upstream publishes
     * for this Pyodide line at https://ifcopenshell.github.io/wasm-wheels/ (GitHub Pages, CORS; PyPI has no WebAssembly wheels
     * until PEP 783). The plug-ins link against each other, so they are installed one at a time in this order after the
     * dependencies: the core, then a schema parser and its geometry mapping per schema, the pure-Python part and the
     * OpenCASCADE geometry kernel. The core's `depends` names them all, so `import ifcopenshell` brings the whole set
     * (12.7 MB once, cached as components). Regenerate the digests with tools/ifcopenshell_catalog.py.
     */
    const IFC_VERSION = '0.9.1+a963c38';
    const IFC_BASE = 'https://ifcopenshell.github.io/wasm-wheels/modular/0.9.1%2Ba963c38/';
    const IFC_TAG = 'cp313-cp313-pyemscripten_2025_0_wasm32';
    const IFC_WHEELS = [
      { name: 'ifcopenshell', sha256: 'c6471ffda789e534a3a86291071726b72170d97cb5ecb6e67559dfe5546e54b0', size: 3210216 },
      { name: 'ifcopenshell-parse-schema-ifc2x3', sha256: 'b189566c4cae71540161e14ec3ff5d7132e0fd4c161c4b9da2479cb13a15edc8', size: 542084 },
      { name: 'ifcopenshell-geometry-mapping-ifc2x3', sha256: '67ceeb6195dc53003801716bc19a6b562f832ffe1e4f5302ffaeb8dd2c246ff8', size: 230874 },
      { name: 'ifcopenshell-parse-schema-ifc4', sha256: 'a996cf0041c366b0ddc407406c94c7f0ea9c2ba0ddae05e58aa2b62c97bea3fd', size: 579767 },
      { name: 'ifcopenshell-geometry-mapping-ifc4', sha256: '833ff774a80fcdc45121a35b2f31252b740a633a233602eac4b95b0b540492e4', size: 266534 },
      { name: 'ifcopenshell-parse-schema-ifc4x3-add2', sha256: 'cafc3e719c5e88c13669c8d7ea24157a2c9236885e113be6b260323711d25d76', size: 637142 },
      { name: 'ifcopenshell-geometry-mapping-ifc4x3-add2', sha256: '18a27e8ec69910f8f04d8b54780d940bad1dc8bf62eb2907a0df2017a221d910', size: 346204 },
      { name: 'ifcopenshell-pure-python', sha256: '31241f65e0b92274fb0e7d7972af6ab8d1a590169d2e7ae79768d9e314307771', size: 1543924, pure: true },
      { name: 'ifcopenshell-geometry-kernel-opencascade', sha256: '5a6e4d66420b9ffe0dbffba1c36999fe714de79d565927d6468575e925ec3046', size: 5354748 },
    ];
    /** Distribution packages IfcOpenShell imports (lark and isodate come from EXTRA above). */
    const IFC_DEPENDS = ['numpy', 'shapely', 'lark', 'isodate', 'python-dateutil', 'pyparsing', 'typing-extensions'];
    for (let i = 0; i < IFC_WHEELS.length; i++) {
      const w = IFC_WHEELS[i];
      const file = `${w.name.replace(/-/g, '_')}-${IFC_VERSION}-${w.pure ? 'py3-none-any' : IFC_TAG}.whl`;
      EXTRA.push({
        name: w.name, version: IFC_VERSION, file, url: IFC_BASE + file.replace('+', '%2B'), sha256: w.sha256, size: w.size, order: i + 1,
        depends: i === 0 ? IFC_DEPENDS.concat(IFC_WHEELS.slice(1).map((x) => x.name)) : [], imports: i === 0 ? ['ifcopenshell'] : [],
      });
    }
    const IFC_SIZE = IFC_WHEELS.reduce((n, w) => n + w.size, 0);
    /** Helpers in python/dataspatium.py that import a package the code itself does not name. */
    const IMPLIED = [{ pattern: /\bdm_ifc\w*\s*\(/, pkg: 'ifcopenshell' }];
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
      for (const e of EXTRA) {
        if (index.has(e.name)) continue;
        index.set(e.name, Object.assign({}, e, { depends: e.depends.slice(), imports: e.imports.slice(), order: e.order || 0 }));
        for (const imp of e.imports) if (!importMap.has(imp)) importMap.set(imp, e.name);
      }
      return index;
    }

    function runtimeSpec(f) {
      return { id: 'pyodide:' + f.file, urls: [BASE + f.file], sha256: f.sha256, size: f.size, label: `Pyodide ${VERSION}: ${f.file}`, version: VERSION, purpose: 'components' };
    }
    function wheelSpec(entry) {
      return { id: 'pyodide:' + entry.file, urls: [entry.url || BASE + entry.file], sha256: entry.sha256, size: entry.size || KNOWN_SIZES[entry.name] || null, label: `Python: ${entry.name} ${entry.version}`, version: entry.version, purpose: 'components' };
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
      for (const imp of IMPLIED) if (imp.pattern.test(String(code || '')) && importMap.has(imp.pkg) && !found.includes(importMap.get(imp.pkg))) found.push(importMap.get(imp.pkg));
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

    return { VERSION, BASE, PREFIX, INDEX_URL, RUNTIME, RUNTIME_SIZE, STARTUP, EXTRA, IFC_VERSION, IFC_WHEELS, IFC_SIZE, parse, load, has, info, all, referenced, closure, ensureRuntime, ensurePackages, provideFile, cachedRuntime, provided: () => Array.from(provided), reset };
  });
})();
