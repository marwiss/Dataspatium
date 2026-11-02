// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Workspace backup and restore as a ZIP file (manifest.json, one SQLite file per dataset, saved charts and
 * the user's document templates), and the same layout written to a portable folder on disk through the
 * File System Access API (Chromium, see platform/storage/folder-store.js). With auto-save on, the folder
 * is brought up to date shortly after each change.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/workspace', ['data/datasets', 'platform/storage/zip', 'platform/storage/idb', 'platform/storage/folder'], (datasets, zip, idb, folder) => {
    const MANIFEST = 'manifest.json';
    const AUTOSAVE_SETTING = 'folder:autosave';
    const AUTOSAVE_DELAY = 1500;

    /**
     * Everything that makes up the workspace as path -> bytes|string. Dataset bytes are included only for
     * `datasetIds` (default: all); the manifest always lists every dataset.
     * @param {{datasetIds?: string[]}} [options]
     */
    async function collect(options = {}) {
      const list = await datasets.list();
      const include = options.datasetIds ? new Set(options.datasetIds) : null;
      /** @type {Record<string, Uint8Array|string>} */
      const files = {};
      const entries = [];
      for (const meta of list) {
        const path = `datasets/${meta.id}.sqlite`;
        if (!include || include.has(meta.id)) files[path] = new Uint8Array(await datasets.exportBytes(meta.id));
        entries.push({ id: meta.id, name: meta.name, rowCount: meta.rowCount, columnCount: meta.columnCount, updatedAt: meta.updatedAt, file: path });
      }
      // Saved charts travel as viz files (see viz/charts.js); they are matched to datasets by name on restore.
      const charts = D.has('viz/charts') ? await D.require('viz/charts').list() : await idb.listCharts();
      const chartEntries = [];
      for (const chart of charts) {
        const path = `charts/${chart.id}.viz.json`;
        files[path] = D.has('viz/charts') ? D.require('viz/charts').exportJson(chart) : JSON.stringify(chart);
        chartEntries.push({ id: chart.id, name: chart.name, kind: chart.kind, datasetName: chart.datasetName, file: path });
      }
      // Document templates (the user's own, not the built-in ones) travel as doc files.
      const docs = D.has('docgen/documents') ? (await D.require('docgen/documents').list()).filter((d) => !d.builtin) : [];
      const docEntries = [];
      for (const doc of docs) {
        const path = `documents/${doc.id}.doc.json`;
        files[path] = D.require('docgen/documents').exportJson(doc);
        docEntries.push({ id: doc.id, name: doc.name, file: path });
      }
      files[MANIFEST] = JSON.stringify({ app: 'Dataspatium', kind: 'workspace-backup', version: D.version, created: new Date().toISOString(), datasets: entries, charts: chartEntries, documents: docEntries }, null, 2);
      return { files, counts: { datasets: list.length, charts: charts.length, documents: docs.length } };
    }

    /** @returns {Promise<{blob: Blob, count: number, charts: number, documents: number}>} */
    async function backup() {
      const { files, counts } = await collect();
      const blob = await zip.createZip(files, { level: 6 });
      return { blob, count: counts.datasets, charts: counts.charts, documents: counts.documents };
    }

    /**
     * Restore from path -> bytes entries (the contents of a ZIP or of a folder).
     * @param {Record<string, Uint8Array>} entries
     * @param {{skipIds?: Set<string>, dedupe?: boolean}} [options] skipIds: dataset ids already in the
     *   workspace; dedupe: skip charts and templates that already exist with the same name
     * @returns {Promise<{manifest: any, imported: any[], skipped: string[], charts: any[], documents: any[], existing: number}>}
     */
    async function restoreEntries(entries, options = {}) {
      const manifest = entries[MANIFEST] ? JSON.parse(zip.text(entries[MANIFEST])) : null;
      const imported = []; const skipped = []; const charts = []; const documents = [];
      let existing = 0;
      for (const [path, bytes] of Object.entries(entries)) {
        if (!/\.sqlite$/i.test(path)) continue;
        const m = /([^/]+)\.sqlite$/i.exec(path);
        if (options.skipIds && m && options.skipIds.has(m[1])) { existing++; continue; }
        try {
          const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          imported.push(await datasets.importBytes(buffer));
        } catch (err) {
          skipped.push(path + ': ' + ((err && err.message) || err));
        }
      }
      if (D.has('viz/charts')) {
        const vizCharts = D.require('viz/charts');
        const have = options.dedupe ? await vizCharts.list() : [];
        for (const [path, bytes] of Object.entries(entries)) {
          if (!/\.viz\.json$/i.test(path)) continue;
          try {
            const text = zip.text(bytes);
            if (options.dedupe) { const obj = JSON.parse(text); if (have.some((c) => c.name === obj.name && c.kind === obj.kind && c.datasetName === obj.datasetName)) { existing++; continue; } }
            charts.push(await vizCharts.importJson(text));
          } catch (err) { skipped.push(path + ': ' + ((err && err.message) || err)); }
        }
      }
      if (D.has('docgen/documents')) {
        const docs = D.require('docgen/documents');
        const have = options.dedupe ? await docs.list() : [];
        for (const [path, bytes] of Object.entries(entries)) {
          if (!/\.doc\.json$/i.test(path)) continue;
          try {
            const text = zip.text(bytes);
            if (options.dedupe) { const obj = JSON.parse(text); if (have.some((d) => d.name === obj.name)) { existing++; continue; } }
            documents.push(await docs.importJson(text));
          } catch (err) { skipped.push(path + ': ' + ((err && err.message) || err)); }
        }
      }
      return { manifest, imported, skipped, charts, documents, existing };
    }

    /** @param {Blob|ArrayBuffer} source */
    async function restore(source) { return restoreEntries(await zip.readZip(source)); }

    // ---- portable folder ----
    const fs = { written: new Map(), lastSync: null, timer: 0, unsubscribe: null, enabled: false, busy: false, error: '', listeners: new Set() };
    function onFolder(fn) { fs.listeners.add(fn); return () => fs.listeners.delete(fn); }
    function folderStatus() { return { enabled: fs.enabled, lastSync: fs.lastSync, busy: fs.busy, error: fs.error }; }
    function emitFolder() { for (const fn of Array.from(fs.listeners)) { try { fn(folderStatus()); } catch (err) { console.error(err); } } }

    /**
     * Write the workspace into a folder. Datasets unchanged since the last write are skipped unless
     * `force`; files of removed datasets, charts and templates are deleted.
     * @param {any} root directory handle
     * @param {{force?: boolean}} [options]
     * @returns {Promise<{written: number, removed: number, datasets: number}>}
     */
    async function saveToFolder(root, options = {}) {
      if (!root) throw new Error('Ingen mapp vald.');
      fs.busy = true; emitFolder();
      try {
        const list = await datasets.list();
        let written = 0; let removed = 0;
        for (const meta of list) {
          if (!options.force && fs.written.get(meta.id) === meta.updatedAt) continue;
          await folder.writeFile(root, `datasets/${meta.id}.sqlite`, new Uint8Array(await datasets.exportBytes(meta.id)));
          fs.written.set(meta.id, meta.updatedAt); written++;
        }
        const ids = new Set(list.map((m) => m.id));
        for (const path of await folder.listFiles(root, 'datasets/')) {
          const m = /([^/]+)\.sqlite$/i.exec(path);
          if (m && !ids.has(m[1])) { await folder.removeFile(root, path); fs.written.delete(m[1]); removed++; }
        }
        // The manifest, charts and templates are small and always rewritten.
        const { files } = await collect({ datasetIds: [] });
        for (const [path, data] of Object.entries(files)) await folder.writeFile(root, path, data);
        for (const prefix of ['charts/', 'documents/']) {
          for (const path of await folder.listFiles(root, prefix)) if (!(path in files)) { await folder.removeFile(root, path); removed++; }
        }
        fs.lastSync = new Date().toISOString(); fs.error = '';
        return { written, removed, datasets: list.length };
      } catch (err) {
        fs.error = (err && err.message) || String(err);
        throw err;
      } finally { fs.busy = false; emitFolder(); }
    }

    /** Read a folder written by saveToFolder; datasets, charts and templates already present are skipped. */
    async function loadFromFolder(root) {
      if (!root) throw new Error('Ingen mapp vald.');
      const wanted = (p) => p === MANIFEST || /^datasets\/[^/]+\.sqlite$/i.test(p) || /^charts\/[^/]+\.viz\.json$/i.test(p) || /^documents\/[^/]+\.doc\.json$/i.test(p);
      /** @type {Record<string, Uint8Array>} */
      const entries = {};
      for (const path of await folder.listFiles(root)) if (wanted(path)) entries[path] = await folder.readFile(root, path);
      const existing = new Set((await datasets.list()).map((m) => m.id));
      const res = await restoreEntries(entries, { skipIds: existing, dedupe: true });
      for (const meta of res.imported) fs.written.set(meta.id, meta.updatedAt);
      return res;
    }

    /** Save to the remembered folder shortly after datasets change; needs an already granted permission. */
    function setAutoSave(enabled) {
      fs.enabled = !!enabled;
      if (fs.unsubscribe) { fs.unsubscribe(); fs.unsubscribe = null; }
      clearTimeout(fs.timer);
      if (fs.enabled) {
        fs.unsubscribe = datasets.subscribe((type) => {
          if (type !== 'saved' && type !== 'created' && type !== 'deleted') return;
          clearTimeout(fs.timer);
          fs.timer = setTimeout(() => autoSaveNow().catch((err) => D.log('folder', 'autosave failed', err)), AUTOSAVE_DELAY);
        });
      }
      emitFolder();
    }
    async function autoSaveNow() {
      const root = await folder.current();
      if (!root || fs.busy) return null;
      if ((await folder.permission(root)) !== 'granted') return null;
      return saveToFolder(root);
    }
    /** At start-up: resume auto-save when it was on. Writes wait until the browser grants access again. */
    async function initFolder() {
      if (!folder.supported()) return false;
      if (!(await idb.getSetting(AUTOSAVE_SETTING, false))) return false;
      setAutoSave(true);
      return true;
    }
    async function setAutoSaveSetting(enabled) { await idb.setSetting(AUTOSAVE_SETTING, !!enabled); setAutoSave(enabled); }
    async function autoSaveSetting() { return !!(await idb.getSetting(AUTOSAVE_SETTING, false)); }

    return { backup, restore, restoreEntries, collect, saveToFolder, loadFromFolder, setAutoSave, setAutoSaveSetting, autoSaveSetting, initFolder, folderStatus, onFolder, MANIFEST, AUTOSAVE_SETTING };
  });
})();
