// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * R packages that are not bundled, fetched on demand from webR's own repository (repo.r-wasm.org) after consent.
 * The remote PACKAGES index is cached for a week; the needed packages (with their dependencies that are not
 * bundled) are downloaded through platform/components, provided as assets, and the package index the worker reads
 * is extended with their entries, so that library() and webr::install() find them like bundled ones.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/r/remote-packages', ['engines/r/packages', 'platform/components'], (packages, components) => {
    const REPO = 'https://repo.r-wasm.org';
    const WEEK = 7 * 24 * 3600 * 1000;
    /** @type {Map<string, {version: string, deps: string[]}>|null} */
    let remote = null;
    /** Blocks of the remote PACKAGES text per package name (to extend the worker's index). */
    const blocks = new Map();
    /** Packages provided so far (name -> tgz asset name). */
    const provided = new Map();

    /** "https://repo.r-wasm.org/bin/emscripten/contrib/4.5/" for the bundled repository's R version. */
    function contribUrl() {
      const local = packages.contrib();
      const m = /contrib\/([^/]+)\/$/.exec(local);
      return `${REPO}/bin/emscripten/contrib/${m ? m[1] : '4.5'}/`;
    }

    /** Fetch (or reuse) the remote index. */
    async function index(options = {}) {
      if (remote) return remote;
      await packages.load();
      const text = await components.text({ id: 'webr-repo:PACKAGES', urls: [contribUrl() + 'PACKAGES'], label: 'webR PACKAGES', purpose: 'components', maxAgeMs: WEEK }, options);
      remote = packages.parse(text);
      blocks.clear();
      for (const block of text.split(/\n\s*\n/)) { const m = /^Package:\s*(\S+)/m.exec(block); if (m) blocks.set(m[1], block.trim()); }
      return remote;
    }

    /** Names (after a code scan) that are neither bundled nor base packages. */
    function missing(names) { return names.filter((n) => !packages.BASE.has(n) && !packages.has(n)); }

    /** The remote closure of the given packages, leaving out what is bundled or base. */
    function closure(names) {
      if (!remote) throw new Error('Remote package index not loaded');
      const seen = new Set();
      const stack = names.filter((n) => remote.has(n));
      while (stack.length) {
        const pkg = stack.pop();
        if (seen.has(pkg) || packages.has(pkg) || packages.BASE.has(pkg)) continue;
        const entry = remote.get(pkg);
        if (!entry) continue;
        seen.add(pkg);
        for (const dep of entry.deps) if (!seen.has(dep) && remote.has(dep) && !packages.has(dep)) stack.push(dep);
      }
      return Array.from(seen);
    }

    /**
     * Download and provide the packages needed for the names, if any are missing locally.
     * @param {string[]} names referenced packages
     * @param {{fetch?: Function, onProgress?: Function}} [options]
     * @returns {Promise<{packages: string[], assets: string[], indexAsset: string|null}>} what was provided (assets to ship)
     */
    async function ensure(names, options = {}) {
      const need = missing(names);
      if (!need.length) return { packages: [], assets: [], indexAsset: null };
      await index(options);
      const wanted = closure(need).filter((p) => !provided.has(p));
      if (!wanted.length) return { packages: [], assets: [], indexAsset: null };
      const assets = [];
      for (const pkg of wanted) {
        const file = `${pkg}_${remote.get(pkg).version}.tgz`;
        const bytes = await components.ensure({ id: 'webr-repo:' + file, urls: [contribUrl() + file], label: pkg, version: remote.get(pkg).version, purpose: 'components' }, options);
        const assetName = packages.contrib() + file;
        D.assets.provide(assetName, 'binary', bytes);
        provided.set(pkg, assetName);
        assets.push(assetName);
      }
      // The index the worker reads gets the remote entries appended, so webR's install() knows the files.
      const indexAsset = packages.indexAssetName();
      const base = await D.assets.loadText(indexAsset);
      const extra = Array.from(provided.keys()).map((p) => blocks.get(p)).filter(Boolean);
      D.assets.provide(indexAsset, 'text', base.replace(/\s+$/, '') + '\n\n' + extra.join('\n\n') + '\n');
      return { packages: wanted, assets, indexAsset };
    }

    function reset() { remote = null; blocks.clear(); provided.clear(); }

    return { index, missing, closure, ensure, contribUrl, provided: () => Array.from(provided.keys()), reset, REPO };
  });
})();
