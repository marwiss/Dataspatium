// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A library of recipes, templates, notebooks, scripts, flows and sources, each with its licence. One library comes with the app; others
 * are JSON files anyone can put at an address, and they are only fetched when the user asks. What comes from elsewhere is shown before
 * it is added and is never run on its own.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/library', [], () => {
    const FORMAT = 'dataspatium-library/1';
    const ASSET = 'presets/bibliotek/index.json';
    /** Where a newer copy of the library that comes with the app is. */
    const HOME = 'https://marwiss.github.io/Dataspatium/presets/bibliotek/index.json';
    const KINDS = ['recipe', 'document', 'notebook', 'script', 'flow', 'connector'];
    const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0'];
    const MAX_ENTRIES = 500;

    /** The text for the app's language from a text or {sv, en, ...}. */
    function textOf(value) {
      if (!value || typeof value === 'string') return value || '';
      const language = D.require('ui/i18n').language();
      return value[language] || value.sv || value.en || Object.values(value)[0] || '';
    }
    /** A library that goes in only if it is what it says; unknown kinds are left out rather than guessed at. */
    function parse(text, source) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_err) { throw new Error(D.t('library.err.format')); }
      if (!obj || obj.format !== FORMAT || !Array.isArray(obj.entries)) throw new Error(D.t('library.err.format'));
      const entries = obj.entries.slice(0, MAX_ENTRIES)
        .filter((e) => e && KINDS.includes(e.kind) && e.content && typeof e.content === 'object' && e.name && typeof e.license === 'string' && e.license.trim())
        .map((e, i) => ({ id: String(e.id || `entry-${i}`), kind: e.kind, name: textOf(e.name), description: textOf(e.description), license: e.license, author: String(e.author || ''), content: e.content }));
      return { name: textOf(obj.name) || D.t('library.unnamed'), source: source || '', entries };
    }
    /** The library that comes with the app. @returns {Promise<any>} */
    async function bundled() { return parse(await D.assets.loadText(ASSET), ''); }
    /**
     * A library from an address, after consent.
     * @param {string} url @returns {Promise<any>}
     */
    async function load(url) {
      const file = await D.require('io/url-import').fetchFile(url);
      return parse(await file.text(), String(url).trim());
    }
    /**
     * What an entry would do, in words and code, to look at before it is added.
     * @param {any} entry @returns {string}
     */
    function preview(entry) {
      const c = entry.content;
      if (entry.kind === 'recipe') return (c.steps || []).map((s, i) => `${i + 1}. ${D.require('data/recipes').describe(s.op, s.params || {})}`).join('\n');
      if (entry.kind === 'script') return String(c.code || '');
      if (entry.kind === 'document') return String(c.body || '');
      if (entry.kind === 'notebook') return (c.cells || []).map((x) => String(x.source !== undefined ? x.source : x.text || '')).join('\n\n');
      return JSON.stringify(c, null, 2);
    }
    /**
     * Add an entry to the workspace. A recipe is run on a dataset, the others become objects of their own.
     * @param {any} entry @param {{datasetId?: string}} [options]
     * @returns {Promise<{record?: any, steps?: any[]}>}
     */
    async function add(entry, options = {}) {
      const text = JSON.stringify(entry.content);
      switch (entry.kind) {
        case 'recipe': {
          if (!options.datasetId) throw new Error(D.t('library.err.dataset'));
          const done = await D.require('data/recipes').replay(options.datasetId, entry.content.steps || []);
          const failed = done.find((x) => !x.ok);
          if (failed) throw new Error(D.t('library.err.step', { step: D.require('data/recipes').describe(failed.step.op, failed.step.params || {}), message: failed.error }));
          return { steps: done };
        }
        case 'document': return { record: await D.require('docgen/documents').importJson(text) };
        case 'notebook': return { record: await D.require('analysis/notebooks').importJson(text) };
        case 'flow': return { record: await D.require('data/flows').importJson(text) };
        case 'connector': return { record: await D.require('api/connectors').importJson(text) };
        case 'script': return { record: await D.require('data/workspace').importScript(text, false) };
        default: throw new Error(D.t('library.err.format'));
      }
    }
    /**
     * What the user has made, as a library file to share as it is or to put in a repository.
     * @param {Array<{kind: string, name: string, description?: string, content: any}>} items
     * @param {{name?: string, license?: string, author?: string}} [options] @returns {string}
     */
    function toFile(items, options = {}) {
      const license = options.license || LICENSES[0];
      return JSON.stringify({
        format: FORMAT, name: options.name || D.t('library.own.name'),
        entries: items.map((item, i) => ({ id: `${item.kind}-${i + 1}`, kind: item.kind, name: item.name, description: item.description || '', license, author: options.author || '', content: item.content })),
      }, null, 2);
    }
    /** Everything of the user's that can go in a library file. @returns {Promise<any[]>} */
    async function own() {
      const out = [];
      const documents = D.require('docgen/documents');
      for (const d of (await documents.list()).filter((x) => !x.builtin)) out.push({ kind: 'document', name: d.name, content: JSON.parse(documents.exportJson(d)) });
      const notebooks = D.require('analysis/notebooks');
      for (const n of await notebooks.list()) out.push({ kind: 'notebook', name: n.name, content: JSON.parse(notebooks.exportJson(n)) });
      const flows = D.require('data/flows');
      for (const f of await flows.list()) out.push({ kind: 'flow', name: f.name, content: JSON.parse(flows.exportJson(f)) });
      for (const s of await D.require('platform/storage/idb').listScripts()) out.push({ kind: 'script', name: s.name, content: { kind: 'script', language: s.language, name: s.name, code: s.code } });
      return out;
    }

    return { FORMAT, HOME, KINDS, LICENSES, parse, bundled, load, preview, add, toFile, own, textOf };
  });
})();
