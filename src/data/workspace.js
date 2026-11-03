// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Workspace files: backup and restore as a ZIP (manifest.json, one SQLite file per dataset, saved charts,
 * dashboards, the user's document templates and notebooks), selective sharing bundles with the same
 * layout, and the same layout written to a portable folder on disk through the File System Access API
 * (Chromium, see platform/storage/folder-store.js). With auto-save on, the folder is brought up to date
 * shortly after each change.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/workspace', ['data/datasets', 'platform/storage/zip', 'platform/storage/idb', 'platform/storage/folder'], (datasets, zip, idb, folder) => {
    const MANIFEST = 'manifest.json';
    const AUTOSAVE_SETTING = 'folder:autosave';
    const AUTOSAVE_DELAY = 1500;
    const PREFIXES = ['charts/', 'documents/', 'dashboards/', 'notebooks/'];
    const optional = (name) => (D.has(name) ? D.require(name) : null);

    /**
     * Everything that makes up the workspace as path -> bytes|string.
     * @param {{datasetIds?: string[], listAll?: boolean, include?: {charts?: boolean, dashboards?: boolean, documents?: boolean, notebooks?: boolean}, kind?: string, name?: string}} [options]
     *   datasetIds: datasets whose bytes are included (default all); listAll=false also limits the manifest to them
     */
    async function collect(options = {}) {
      const list = await datasets.list();
      const only = options.datasetIds ? new Set(options.datasetIds) : null;
      const listed = only && options.listAll === false ? list.filter((m) => only.has(m.id)) : list;
      const inc = Object.assign({ charts: true, dashboards: true, documents: true, notebooks: true }, options.include || {});
      /** @type {Record<string, Uint8Array|string>} */
      const files = {};
      const entries = [];
      for (const meta of listed) {
        const path = `datasets/${meta.id}.sqlite`;
        if (!only || only.has(meta.id)) files[path] = new Uint8Array(await datasets.exportBytes(meta.id));
        entries.push({ id: meta.id, name: meta.name, rowCount: meta.rowCount, columnCount: meta.columnCount, updatedAt: meta.updatedAt, file: path });
      }
      // Saved charts travel as viz files (see viz/charts.js); they are matched to datasets by name on restore.
      const vizCharts = optional('viz/charts');
      const charts = inc.charts ? (vizCharts ? await vizCharts.list() : await idb.listCharts()) : [];
      const chartEntries = [];
      for (const chart of charts) {
        const path = `charts/${chart.id}.viz.json`;
        files[path] = vizCharts ? vizCharts.exportJson(chart) : JSON.stringify(chart);
        chartEntries.push({ id: chart.id, name: chart.name, kind: chart.kind, datasetName: chart.datasetName, file: path });
      }
      // Document templates (the user's own, not the built-in ones) travel as doc files.
      const docMod = optional('docgen/documents');
      const docs = inc.documents && docMod ? (await docMod.list()).filter((d) => !d.builtin) : [];
      const docEntries = [];
      for (const doc of docs) {
        const path = `documents/${doc.id}.doc.json`;
        files[path] = docMod.exportJson(doc);
        docEntries.push({ id: doc.id, name: doc.name, file: path });
      }
      // Dashboards travel as self-contained dash files (chart definitions embedded).
      const dashMod = optional('viz/dashboards');
      const dashes = inc.dashboards && dashMod ? await dashMod.list() : [];
      const dashEntries = [];
      for (const dash of dashes) {
        const path = `dashboards/${dash.id}.dash.json`;
        files[path] = await dashMod.exportJson(dash);
        dashEntries.push({ id: dash.id, name: dash.name, file: path });
      }
      // Notebooks travel with their cells and saved outputs.
      const nbMod = optional('analysis/notebooks');
      const notebooks = inc.notebooks && nbMod ? await nbMod.list() : [];
      const nbEntries = [];
      for (const nb of notebooks) {
        const path = `notebooks/${nb.id}.nb.json`;
        files[path] = nbMod.exportJson(nb);
        nbEntries.push({ id: nb.id, name: nb.name, file: path });
      }
      files[MANIFEST] = JSON.stringify({ app: 'Dataspatium', kind: options.kind || 'workspace-backup', name: options.name || '', version: D.version, created: new Date().toISOString(), datasets: entries, charts: chartEntries, documents: docEntries, dashboards: dashEntries, notebooks: nbEntries }, null, 2);
      return { files, counts: { datasets: listed.length, charts: charts.length, documents: docs.length, dashboards: dashes.length, notebooks: notebooks.length } };
    }

    /** @returns {Promise<{blob: Blob, count: number, charts: number, documents: number}>} */
    async function backup() {
      const { files, counts } = await collect();
      const blob = await zip.createZip(files, { level: 6 });
      await markBackedUp();
      return { blob, count: counts.datasets, charts: counts.charts, documents: counts.documents };
    }

    // ---- backup reminder: a setting for the interval and the time of the last backup ----
    const BACKUP_LAST = 'backup.lastAt';
    const BACKUP_REMIND = 'backup.remindDays';
    const DEFAULT_REMIND_DAYS = 30;
    async function markBackedUp(when = new Date()) { try { await idb.setSetting(BACKUP_LAST, when.toISOString()); } catch (_err) { /* best effort */ } }
    /** The reminder rule: due when reminders are on, the workspace has datasets and the last backup is older than the interval. */
    function isBackupDue({ lastAt, remindDays, datasetCount, now = Date.now() }) {
      const days = Number(remindDays);
      if (!days || days <= 0 || !datasetCount) return false;
      if (!lastAt) return true;
      const t = Date.parse(lastAt);
      return !Number.isFinite(t) || now - t > days * 86400000;
    }
    /** @returns {Promise<{lastAt: string|null, remindDays: number, daysSince: number|null, due: boolean}>} */
    async function backupStatus() {
      const lastAt = await idb.getSetting(BACKUP_LAST, null);
      const stored = await idb.getSetting(BACKUP_REMIND, null);
      const remindDays = stored === null || stored === undefined ? DEFAULT_REMIND_DAYS : Number(stored) || 0;
      const datasetCount = (await datasets.list()).length;
      const daysSince = lastAt && Number.isFinite(Date.parse(lastAt)) ? Math.floor((Date.now() - Date.parse(lastAt)) / 86400000) : null;
      return { lastAt, remindDays, daysSince, due: isBackupDue({ lastAt, remindDays, datasetCount }) };
    }
    async function setRemindDays(days) { await idb.setSetting(BACKUP_REMIND, Math.max(0, Number(days) || 0)); }

    /**
     * A shareable package: the chosen datasets plus, optionally, every chart, dashboard, template and notebook.
     * Restoring a bundle skips datasets, charts, dashboards, templates and notebooks that already exist.
     * @param {{name?: string, datasetIds: string[], include?: {charts?: boolean, dashboards?: boolean, documents?: boolean, notebooks?: boolean}}} options
     */
    async function bundle(options) {
      const { files, counts } = await collect({ datasetIds: options.datasetIds || [], listAll: false, include: options.include, kind: 'bundle', name: options.name });
      const blob = await zip.createZip(files, { level: 6 });
      return { blob, counts };
    }

    /**
     * Restore from path -> bytes entries (the contents of a ZIP or of a folder).
     * @param {Record<string, Uint8Array>} entries
     * @param {{skipIds?: Set<string>, dedupe?: boolean}} [options] skipIds: dataset ids already in the
     *   workspace; dedupe: skip charts, dashboards, templates and notebooks that already exist with the same name
     * @returns {Promise<{manifest: any, imported: any[], skipped: string[], charts: any[], documents: any[], dashboards: any[], notebooks: any[], existing: number}>}
     */
    async function restoreEntries(entries, options = {}) {
      const manifest = entries[MANIFEST] ? JSON.parse(zip.text(entries[MANIFEST])) : null;
      const imported = []; const skipped = [];
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
      /** Import every file matching `re` through a module, skipping existing items when deduplicating. */
      async function importKind(re, moduleName, same) {
        const mod = optional(moduleName);
        const out = [];
        if (!mod) return out;
        const have = options.dedupe ? await mod.list() : [];
        for (const [path, bytes] of Object.entries(entries)) {
          if (!re.test(path)) continue;
          try {
            const text = zip.text(bytes);
            if (options.dedupe) { const obj = JSON.parse(text); if (have.some((item) => same(item, obj))) { existing++; continue; } }
            out.push(await mod.importJson(text));
          } catch (err) { skipped.push(path + ': ' + ((err && err.message) || err)); }
        }
        return out;
      }
      // Charts first: dashboards and notebooks refer to them and to datasets by name.
      const charts = await importKind(/\.viz\.json$/i, 'viz/charts', (c, obj) => c.name === obj.name && c.kind === obj.kind && c.datasetName === obj.datasetName);
      const documents = await importKind(/\.doc\.json$/i, 'docgen/documents', (d, obj) => d.name === obj.name);
      const dashboards = await importKind(/\.dash\.json$/i, 'viz/dashboards', (d, obj) => d.name === obj.name);
      const notebooks = await importKind(/\.nb\.json$/i, 'analysis/notebooks', (n, obj) => n.name === obj.name);
      return { manifest, imported, skipped, charts, documents, dashboards, notebooks, existing };
    }

    /** Restore a backup (everything is added) or a bundle (what already exists is skipped). */
    async function restore(source) {
      const entries = await zip.readZip(source);
      const manifest = entries[MANIFEST] ? JSON.parse(zip.text(entries[MANIFEST])) : null;
      if (manifest && manifest.kind === 'bundle') {
        const existing = new Set((await datasets.list()).map((m) => m.id));
        return restoreEntries(entries, { skipIds: existing, dedupe: true });
      }
      return restoreEntries(entries);
    }

    // ---- portable folder ----
    const fs = { written: new Map(), lastSync: null, timer: 0, unsubscribe: null, enabled: false, busy: false, error: '', listeners: new Set() };
    function onFolder(fn) { fs.listeners.add(fn); return () => fs.listeners.delete(fn); }
    function folderStatus() { return { enabled: fs.enabled, lastSync: fs.lastSync, busy: fs.busy, error: fs.error }; }
    function emitFolder() { for (const fn of Array.from(fs.listeners)) { try { fn(folderStatus()); } catch (err) { console.error(err); } } }

    /**
     * Write the workspace into a folder. Datasets unchanged since the last write are skipped unless
     * `force`; files of removed datasets, charts, dashboards, templates and notebooks are deleted.
     * @param {any} root directory handle
     * @param {{force?: boolean}} [options]
     * @returns {Promise<{written: number, removed: number, datasets: number}>}
     */
    async function saveToFolder(root, options = {}) {
      if (!root) throw new Error(D.t('folder.err.none'));
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
        // The manifest and the small JSON files are always rewritten.
        const { files } = await collect({ datasetIds: [] });
        for (const [path, data] of Object.entries(files)) await folder.writeFile(root, path, data);
        for (const prefix of PREFIXES) {
          for (const path of await folder.listFiles(root, prefix)) if (!(path in files)) { await folder.removeFile(root, path); removed++; }
        }
        fs.lastSync = new Date().toISOString(); fs.error = '';
        return { written, removed, datasets: list.length };
      } catch (err) {
        fs.error = (err && err.message) || String(err);
        throw err;
      } finally { fs.busy = false; emitFolder(); }
    }

    /** Read a folder written by saveToFolder; datasets and objects already present are skipped. */
    async function loadFromFolder(root) {
      if (!root) throw new Error(D.t('folder.err.none'));
      const wanted = (p) => p === MANIFEST || /^datasets\/[^/]+\.sqlite$/i.test(p) || /^charts\/[^/]+\.viz\.json$/i.test(p) || /^documents\/[^/]+\.doc\.json$/i.test(p) || /^dashboards\/[^/]+\.dash\.json$/i.test(p) || /^notebooks\/[^/]+\.nb\.json$/i.test(p);
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

    return { backup, bundle, restore, restoreEntries, collect, saveToFolder, loadFromFolder, setAutoSave, setAutoSaveSetting, autoSaveSetting, initFolder, folderStatus, onFolder, markBackedUp, isBackupDue, backupStatus, setRemindDays, MANIFEST, AUTOSAVE_SETTING };
  });
})();
