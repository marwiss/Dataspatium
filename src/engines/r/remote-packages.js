// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * R packages that are not bundled, fetched on demand from webR's own repository (repo.r-wasm.org) after consent. The needed
 * packages (with their dependencies that are not bundled) are downloaded through platform/components, provided as assets, and
 * the package index the worker reads is extended with their entries, so that library() and webr::install() find them like
 * bundled ones.
 *
 * The repository's PACKAGES index for an R version stops changing once the next R version is out (4.5 since April 2026), so it is
 * pinned here by SHA-256 (INDEX_PINS, printed by tools/webr_repo_pin.py when webR moves to another R version) and checked like
 * every pinned component, from the cache too, at every use; it never goes stale. The index lists each package with the MD5 sum of
 * its file, the only digest the repository publishes: a package is used only when its bytes have that sum, checked when it is
 * downloaded and again at every use from the cache, as Pyodide's pinned lock gives each wheel its SHA-256. A package the index
 * gives no sum, and every package of an R version without a pinned index, is refused with a message that says why.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/r/remote-packages', ['engines/r/packages', 'platform/components'], (packages, components) => {
    const REPO = 'https://repo.r-wasm.org';
    /** The pinned PACKAGES index of webR's repository per R version: the SHA-256 and size of <contrib>/PACKAGES. */
    const INDEX_PINS = Object.freeze({
      '4.5': Object.freeze({ sha256: '47adea5edb9e766a32114a67a087cc05902bf0a70328ca5f79d507b932ab8348', size: 5336284 }),
    });
    /** @type {{sha256: string, size?: number}|null} a test's own index in place of the pinned one (reset) */
    let testPin = null;
    /** @type {Map<string, {version: string, deps: string[], md5: string}>|null} */
    let remote = null;
    /** Blocks of the remote PACKAGES text per package name (to extend the worker's index). */
    const blocks = new Map();
    /** Packages provided so far (name -> tgz asset name). */
    const provided = new Map();
    const integrity = (message) => Object.assign(new Error(message), { integrity: true });

    /** The R version of the bundled repository, e.g. "4.5" (after packages.load()). */
    function rVersion() { const m = /contrib\/([^/]+)\/$/.exec(packages.contrib()); return m ? m[1] : ''; }
    /** "https://repo.r-wasm.org/bin/emscripten/contrib/4.5/" for the bundled repository's R version. */
    function contribUrl() { return `${REPO}/bin/emscripten/contrib/${rVersion() || '4.5'}/`; }

    /** The index as a component pinned by SHA-256; for an R version without a pin nothing can be checked, so nothing is used. */
    function indexSpec() {
      const version = rVersion();
      const pin = testPin || INDEX_PINS[version];
      if (!pin) throw integrity(D.t('r.remote.unpinned', { version }));
      return { id: 'webr-repo:PACKAGES', urls: [contribUrl() + 'PACKAGES'], label: D.t('r.remote.index', { version }), purpose: 'components', sha256: pin.sha256, size: pin.size || undefined, version };
    }
    /** A package's file as a component checked against the MD5 sum its pinned index gives; one without a sum is refused. */
    function packageSpec(pkg) {
      const entry = remote && remote.get(pkg);
      if (!entry || !entry.md5) throw integrity(D.t('r.remote.nodigest', { name: pkg }));
      const file = `${pkg}_${entry.version}.tgz`;
      return { id: 'webr-repo:' + file, urls: [contribUrl() + file], label: pkg, version: entry.version, purpose: 'components', md5: entry.md5 };
    }
    function useIndex(text) {
      remote = packages.parse(text);
      blocks.clear();
      for (const block of text.split(/\n\s*\n/)) { const m = /^Package:\s*(\S+)/m.exec(block); if (m) blocks.set(m[1], block.trim()); }
      return remote;
    }

    /** Fetch (or reuse) the remote index, verified against its pin. */
    async function index(options = {}) {
      if (remote) return remote;
      await packages.load();
      const spec = indexSpec();
      let text;
      try { text = await components.text(spec, options); } catch (err) {
        // Another index than the pinned one: the repository changed after this version of the app was made.
        if (err && err.integrity) throw integrity(D.t('r.remote.index.changed', { version: spec.version }));
        throw err;
      }
      return useIndex(text);
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
     * Download and provide the packages needed for the names, if any are missing locally. Every package is checked against its
     * pinned sum before anything is downloaded and its bytes before they are used; a failure carries `integrity: true`.
     * @param {string[]} names referenced packages
     * @param {{fetch?: Function, onProgress?: Function, ask?: boolean}} [options] `ask: false`: only from the cache or with a consent already kept
     * @returns {Promise<{packages: string[], assets: string[], indexAsset: string|null}>} what was provided (assets to ship)
     */
    async function ensure(names, options = {}) {
      const need = missing(names);
      if (!need.length) return { packages: [], assets: [], indexAsset: null };
      await index(options);
      const wanted = closure(need).filter((p) => !provided.has(p));
      if (!wanted.length) return { packages: [], assets: [], indexAsset: null };
      const specs = wanted.map(packageSpec);
      const assets = [];
      for (let i = 0; i < wanted.length; i++) {
        const bytes = await components.ensure(specs[i], options);
        const assetName = packages.contrib() + `${wanted[i]}_${specs[i].version}.tgz`;
        D.assets.provide(assetName, 'binary', bytes);
        provided.set(wanted[i], assetName);
        assets.push(assetName);
      }
      // The index the worker reads gets the remote entries appended, so webR's install() knows the files.
      const indexAsset = packages.indexAssetName();
      const base = await D.assets.loadText(indexAsset);
      const extra = Array.from(provided.keys()).map((p) => blocks.get(p)).filter(Boolean);
      D.assets.provide(indexAsset, 'text', base.replace(/\s+$/, '') + '\n\n' + extra.join('\n\n') + '\n');
      return { packages: wanted, assets, indexAsset };
    }

    /**
     * Whether the packages that code names can be used without fetching anything: bundled, or with the pinned index and every
     * file they need in the component cache with their sums. Nothing is asked or fetched (a flow at start checks this before it runs).
     * @param {string[]} names referenced packages @returns {Promise<boolean>}
     */
    async function cached(names) {
      await packages.load();
      const need = missing(names);
      if (!need.length) return true;
      try {
        if (!remote) {
          const bytes = await components.verified(indexSpec());
          if (!bytes) return false;
          useIndex(new TextDecoder().decode(new Uint8Array(bytes)));
        }
        for (const pkg of closure(need)) if (!provided.has(pkg) && !(await components.verified(packageSpec(pkg)))) return false;
        return true;
      } catch (_err) { return false; }
    }

    /**
     * Forget the index and what was provided. @param {{pin?: {sha256: string, size?: number}}} [options] `pin`: a test's own index
     * in place of the pinned one (the tests never reach the repository)
     */
    function reset(options = {}) { remote = null; blocks.clear(); provided.clear(); testPin = options.pin || null; }

    return { index, missing, closure, ensure, cached, contribUrl, rVersion, indexSpec, packageSpec, provided: () => Array.from(provided.keys()), reset, REPO, INDEX_PINS };
  });
})();
