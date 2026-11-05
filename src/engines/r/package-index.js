// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Index of the embedded R package repository (vendor/webr-repo). Parses the PACKAGES file so that the
 * dependency closure of a package can be shipped to the R worker right before it is needed, instead of
 * sending every package at startup. Also finds package references in user code.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/r/packages', [], () => {
    const CONTRIB = 'webr-repo/bin/emscripten/contrib/';
    const BASE = new Set(['R', 'base', 'stats', 'utils', 'methods', 'grDevices', 'graphics', 'grid', 'tools', 'parallel', 'splines', 'stats4', 'tcltk', 'compiler', 'datasets', 'webr']);
    /** @type {Map<string, {version: string, deps: string[]}>|null} */
    let index = null;
    let contribPath = '';

    function indexAssetName() {
      const name = D.assets.names(CONTRIB).find((n) => n.endsWith('/PACKAGES'));
      if (!name) throw new Error('No PACKAGES index in the embedded R repository');
      return name;
    }

    /** Parse the Debian-control-style PACKAGES file. */
    function parse(text) {
      const map = new Map();
      for (const block of text.split(/\n\s*\n/)) {
        const fields = {};
        let key = null;
        for (const line of block.split('\n')) {
          if (/^[ \t]/.test(line) && key) fields[key] += ' ' + line.trim();
          else if (line.includes(':')) { const i = line.indexOf(':'); key = line.slice(0, i).trim(); fields[key] = line.slice(i + 1).trim(); }
        }
        if (!fields.Package) continue;
        const deps = [];
        for (const field of ['Depends', 'Imports', 'LinkingTo']) {
          for (const dep of String(fields[field] || '').split(',')) {
            const name = dep.replace(/\(.*?\)/g, '').trim();
            if (name && !BASE.has(name)) deps.push(name);
          }
        }
        map.set(fields.Package, { version: fields.Version, deps });
      }
      return map;
    }

    /** Load the index once. */
    async function load() {
      if (index) return index;
      const name = indexAssetName();
      contribPath = name.slice(0, name.lastIndexOf('/') + 1);
      index = parse(await D.assets.loadText(name));
      return index;
    }

    function has(pkg) { return !!(index && index.has(pkg)); }

    /** Packages needed to install the given ones (including themselves), only those we bundle. */
    function closure(names) {
      if (!index) throw new Error('Package index not loaded');
      const seen = new Set();
      const stack = names.filter((n) => index.has(n));
      while (stack.length) {
        const pkg = stack.pop();
        if (seen.has(pkg)) continue;
        const entry = index.get(pkg);
        if (!entry) continue;
        seen.add(pkg);
        for (const dep of entry.deps) if (!seen.has(dep) && index.has(dep)) stack.push(dep);
      }
      return Array.from(seen);
    }

    /** Asset names (tgz wrappers) for a list of packages. */
    function assetsFor(names) {
      return names.filter((n) => index && index.has(n)).map((n) => `${contribPath}${n}_${index.get(n).version}.tgz`);
    }

    /** Our own helpers that need a package the code does not name: a graph's properties are JSON. */
    const IMPLIED = [[/\bdm_read_(?:edges|nodes)\b/, 'jsonlite']];
    /** Package names referenced in R code: library(x), require(x), requireNamespace("x"), x::f, webr::install("x"). */
    function referenced(code) {
      const found = new Set();
      const patterns = [
        /\b(?:library|require|requireNamespace|loadNamespace)\(\s*["']?([A-Za-z][\w.]*)["']?/g,
        /\b([A-Za-z][\w.]*)::/g,
        /\b(?:webr::install|install\.packages|webr::install_packages)\(\s*(?:c\()?\s*((?:["'][A-Za-z][\w.]*["']\s*,?\s*)+)/g,
      ];
      for (const re of patterns) {
        let m;
        while ((m = re.exec(code))) {
          const group = m[1];
          for (const name of group.match(/[A-Za-z][\w.]*/g) || []) if (!BASE.has(name)) found.add(name);
        }
      }
      for (const [re, name] of IMPLIED) if (re.test(code)) found.add(name);
      return Array.from(found);
    }

    function all() { return index ? Array.from(index.keys()) : []; }
    /** The contrib path of the embedded repository, e.g. "webr-repo/bin/emscripten/contrib/4.5/" (after load). */
    function contrib() { return contribPath; }

    return { load, has, closure, assetsFor, referenced, all, parse, contrib, indexAssetName, BASE };
  });
})();
