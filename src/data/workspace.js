// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Workspace files: backup and restore as a ZIP (manifest.json, one SQLite file per dataset, saved charts,
 * dashboards, the user's document templates, notebooks and saved scripts), selective sharing bundles with the same
 * layout, and the same layout written to a portable folder on disk through the File System Access API
 * (Chromium, see platform/storage/folder-store.js). With auto-save on, the folder is brought up to date
 * shortly after each change. Bundles carry a message, the sender's name and a change log; opening one can replace
 * datasets that already exist. The same layout can also be pushed to and pulled from a GitHub repository
 * (platform/storage/github-store.js).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/workspace', ['data/datasets', 'platform/storage/zip', 'platform/storage/idb', 'platform/storage/folder', 'platform/storage/github', 'data/changelog', 'data/comments'], (datasets, zip, idb, folder, github, changelog, comments) => {
    const MANIFEST = 'manifest.json';
    const AUTOSAVE_SETTING = 'folder:autosave';
    const AUTOSAVE_DELAY = 1500;
    const PREFIXES = ['charts/', 'documents/', 'dashboards/', 'notebooks/', 'scripts/'];
    const SCRIPT_LANGUAGES = ['r', 'sql', 'regex'];
    const optional = (name) => (D.has(name) ? D.require(name) : null);
    /** Files of the workspace layout (anything else in a folder or repository is left alone). */
    const isWorkspaceFile = (p) => p === MANIFEST || /^datasets\/[^/]+\.sqlite$/i.test(p) || /^charts\/[^/]+\.viz\.json$/i.test(p) || /^documents\/[^/]+\.doc\.json$/i.test(p) || /^dashboards\/[^/]+\.dash\.json$/i.test(p) || /^notebooks\/[^/]+\.nb\.json$/i.test(p) || /^scripts\/[^/]+\.script\.json$/i.test(p);

    /** A saved script (R, SQL or a regex pattern) as a script file. */
    function scriptJson(sc) {
      return JSON.stringify({ app: 'Dataspatium', kind: 'script', version: D.version, id: sc.id, name: sc.name, language: sc.language, code: sc.code, options: sc.options || null, createdAt: sc.createdAt, updatedAt: sc.updatedAt }, null, 2);
    }
    /** Store a script file; with `dedupe` a script with the same name and language is skipped (returns null). */
    async function importScript(text, dedupe) {
      const obj = JSON.parse(text);
      if (!obj || obj.kind !== 'script' || !SCRIPT_LANGUAGES.includes(obj.language) || typeof obj.code !== 'string') throw new Error(D.t('workspace.err.script'));
      const have = await idb.listScripts(obj.language);
      if (dedupe && have.some((s) => s.name === obj.name)) return null;
      const now = new Date().toISOString();
      const id = typeof obj.id === 'string' && obj.id && !(dedupe && have.some((s) => s.id === obj.id)) ? obj.id : 'sc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const record = { id, name: String(obj.name || ''), language: obj.language, code: obj.code, options: obj.options || null, createdAt: obj.createdAt || now, updatedAt: obj.updatedAt || now };
      await idb.putScript(record);
      return record;
    }

    /**
     * Everything that makes up the workspace as path -> bytes|string.
     * @param {{datasetIds?: string[], listAll?: boolean, include?: {charts?: boolean, dashboards?: boolean, documents?: boolean, notebooks?: boolean, scripts?: boolean}, kind?: string, name?: string, extra?: Record<string, any>}} [options]
     *   datasetIds: datasets whose bytes are included (default all); listAll=false also limits the manifest to them
     */
    async function collect(options = {}) {
      const list = await datasets.list();
      const only = options.datasetIds ? new Set(options.datasetIds) : null;
      const listed = only && options.listAll === false ? list.filter((m) => only.has(m.id)) : list;
      const inc = Object.assign({ charts: true, dashboards: true, documents: true, notebooks: true, scripts: true }, options.include || {});
      /** @type {Record<string, Uint8Array|string>} */
      const files = {};
      const entries = [];
      for (const meta of listed) {
        const path = `datasets/${meta.id}.sqlite`;
        if (!only || only.has(meta.id)) files[path] = new Uint8Array(await datasets.exportBytes(meta.id));
        entries.push({ id: meta.id, name: meta.name, rowCount: meta.rowCount, columnCount: meta.columnCount, updatedAt: meta.updatedAt, file: path });
      }
      // A bundle leaves the app: charts, dashboards and notebooks follow only for the chosen datasets, so that what other datasets
      // show never goes along with it.
      const bundling = options.kind === 'bundle' && !!only;
      // Saved charts travel as viz files (see viz/charts.js); they are matched to datasets by name on restore.
      const vizCharts = optional('viz/charts');
      const allCharts = inc.charts || inc.dashboards ? (vizCharts ? await vizCharts.list() : await idb.listCharts()) : [];
      const datasetOfChart = new Map(allCharts.map((c) => [c.id, c.datasetId]));
      const charts = !inc.charts ? [] : bundling ? allCharts.filter((c) => only.has(c.datasetId)) : allCharts;
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
      const dashList = inc.dashboards && dashMod ? await dashMod.list() : [];
      const dashes = bundling ? dashList.filter((d) => (d.items || []).every((it) => only.has(datasetOfChart.get(it.chartId)))) : dashList;
      const dashEntries = [];
      for (const dash of dashes) {
        const path = `dashboards/${dash.id}.dash.json`;
        files[path] = await dashMod.exportJson(dash);
        dashEntries.push({ id: dash.id, name: dash.name, file: path });
      }
      // Notebooks travel with their cells and saved outputs.
      const nbMod = optional('analysis/notebooks');
      const nbList = inc.notebooks && nbMod ? await nbMod.list() : [];
      const notebooks = bundling ? nbList.filter((nb) => !nb.datasetId || only.has(nb.datasetId)) : nbList;
      const nbEntries = [];
      for (const nb of notebooks) {
        const path = `notebooks/${nb.id}.nb.json`;
        files[path] = nbMod.exportJson(nb);
        nbEntries.push({ id: nb.id, name: nb.name, file: path });
      }
      // Saved R and SQL scripts and regex patterns.
      const scripts = inc.scripts ? await idb.listScripts() : [];
      const scriptEntries = [];
      for (const sc of scripts) {
        if (!SCRIPT_LANGUAGES.includes(sc.language)) continue;
        const path = `scripts/${sc.id}.script.json`;
        files[path] = scriptJson(sc);
        scriptEntries.push({ id: sc.id, name: sc.name, language: sc.language, file: path });
      }
      files[MANIFEST] = JSON.stringify(Object.assign({ app: 'Dataspatium', kind: options.kind || 'workspace-backup', name: options.name || '', version: D.version, created: new Date().toISOString(), datasets: entries, charts: chartEntries, documents: docEntries, dashboards: dashEntries, notebooks: nbEntries, scripts: scriptEntries }, options.extra || {}), null, 2);
      return { files, counts: { datasets: listed.length, charts: charts.length, documents: docs.length, dashboards: dashes.length, notebooks: notebooks.length, scripts: scriptEntries.length } };
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
     * @param {{name?: string, datasetIds: string[], include?: {charts?: boolean, dashboards?: boolean, documents?: boolean, notebooks?: boolean, scripts?: boolean}}} options
     */
    async function bundle(options) {
      const ids = options.datasetIds || [];
      const name = options.name || '';
      const author = options.author !== undefined ? String(options.author).trim() : await comments.author();
      const message = String(options.message || '').trim();
      const created = new Date().toISOString();
      // What changed in each dataset since it was last shared or received, and the comments still open.
      const changes = await changelog.forDatasets(ids);
      const open = [];
      for (const ds of changes) for (const c of await comments.list(ds.id)) if (!c.resolved) open.push({ dataset: ds.name, author: c.author, column: c.column, text: c.text });
      const { files, counts } = await collect({ datasetIds: ids, listAll: false, include: options.include, kind: 'bundle', name, extra: { author, message, changes } });
      files['CHANGELOG.md'] = changelog.markdown({ name: name || D.t('bundle.default.name'), author, message, created, changes, comments: open });
      const blob = await zip.createZip(files, { level: 6 });
      // The next bundle's change log starts here.
      for (const id of ids) await markLog(id, 'shared', { name, author, message });
      return { blob, counts };
    }

    /** Note in a dataset's history that it was shared or received (the change log of the next bundle starts after it). */
    async function markLog(id, action, details) {
      try {
        const handle = await datasets.ensureOpen(id);
        await datasets.appendLog(handle, action, details);
        await datasets.save(id);
      } catch (err) { D.log('workspace', 'could not log ' + action, err); }
    }

    /**
     * Look inside a backup or bundle before restoring it: its manifest and which of its datasets already exist.
     * @param {Blob|ArrayBuffer|Uint8Array} source
     * @returns {Promise<{entries: Record<string, Uint8Array>, manifest: any, existing: Array<{id: string, name: string, local: string}>}>}
     */
    async function inspect(source) {
      const entries = await zip.readZip(source);
      const manifest = entries[MANIFEST] ? JSON.parse(zip.text(entries[MANIFEST])) : null;
      return { entries, manifest, existing: await existingIn(entries, manifest) };
    }
    /** Datasets in the entries that already exist here, with their name in the entries and here. */
    async function existingIn(entries, manifest) {
      const local = new Map((await datasets.list()).map((m) => [m.id, m]));
      const named = new Map(((manifest && manifest.datasets) || []).map((d) => [d.id, d.name]));
      const out = [];
      for (const path of Object.keys(entries)) {
        const m = /^datasets\/([^/]+)\.sqlite$/i.exec(path);
        if (m && local.has(m[1])) out.push({ id: m[1], name: named.get(m[1]) || local.get(m[1]).name, local: local.get(m[1]).name });
      }
      return out;
    }

    /**
     * Restore from path -> bytes entries (the contents of a ZIP or of a folder).
     * @param {Record<string, Uint8Array>} entries
     * @param {{skipIds?: Set<string>, dedupe?: boolean, replaceIds?: Set<string>, received?: {name?: string, author?: string, message?: string}}} [options]
     *   skipIds: dataset ids already in the workspace; dedupe: skip charts, dashboards, templates and notebooks that
     *   already exist with the same name; replaceIds: existing datasets that get the incoming version (the current
     *   one is kept as a version first); received: noted in the history of the datasets that came in
     * @returns {Promise<{manifest: any, imported: any[], replaced: any[], skipped: string[], charts: any[], documents: any[], dashboards: any[], notebooks: any[], scripts: any[], existing: number}>}
     */
    async function restoreEntries(entries, options = {}) {
      const manifest = entries[MANIFEST] ? JSON.parse(zip.text(entries[MANIFEST])) : null;
      const imported = []; const replaced = []; const skipped = [];
      let existing = 0;
      for (const [path, bytes] of Object.entries(entries)) {
        if (!/\.sqlite$/i.test(path)) continue;
        const m = /([^/]+)\.sqlite$/i.exec(path);
        const id = m ? m[1] : '';
        try {
          const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          if (options.replaceIds && options.replaceIds.has(id) && (await datasets.get(id))) {
            await datasets.snapshot(id, D.t('bundle.replaced.version', { name: (options.received && options.received.name) || D.t('bundle.default.name') }));
            await datasets.replaceBytes(id, buffer, null);
            replaced.push(await datasets.get(id));
            continue;
          }
          if (options.skipIds && options.skipIds.has(id)) { existing++; continue; }
          imported.push(await datasets.importBytes(buffer));
        } catch (err) {
          skipped.push(path + ': ' + ((err && err.message) || err));
        }
      }
      if (options.received) for (const meta of imported.concat(replaced)) await markLog(meta.id, 'received', options.received);
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
      const scripts = [];
      for (const [path, bytes] of Object.entries(entries)) {
        if (!/^scripts\/[^/]+\.script\.json$/i.test(path)) continue;
        try {
          const record = await importScript(zip.text(bytes), !!options.dedupe);
          if (record) scripts.push(record); else existing++;
        } catch (err) { skipped.push(path + ': ' + ((err && err.message) || err)); }
      }
      return { manifest, imported, replaced, skipped, charts, documents, dashboards, notebooks, scripts, existing };
    }

    /**
     * Restore a backup (everything is added) or a bundle (what already exists is skipped, unless it is among
     * `replaceIds`). Takes a source or the result of inspect().
     * @param {Blob|ArrayBuffer|Uint8Array|{entries: Record<string, Uint8Array>, manifest: any}} source
     * @param {{replaceIds?: string[]}} [options]
     */
    async function restore(source, options = {}) {
      const opened = source && /** @type {any} */ (source).entries ? /** @type {any} */ (source) : await inspect(/** @type {any} */ (source));
      const { entries, manifest } = opened;
      if (manifest && manifest.kind === 'bundle') {
        const existing = new Set((await datasets.list()).map((m) => m.id));
        const received = { name: manifest.name || '', author: manifest.author || '', message: manifest.message || '' };
        return restoreEntries(entries, { skipIds: existing, dedupe: true, replaceIds: new Set(options.replaceIds || []), received });
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
      /** @type {Record<string, Uint8Array>} */
      const entries = {};
      for (const path of await folder.listFiles(root)) if (isWorkspaceFile(path)) entries[path] = await folder.readFile(root, path);
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

    // ---- GitHub ----
    const GITHUB_SETTING = 'github.sync';
    /** Repository, branch and folder for GitHub sync, with the times of the last push and pull. */
    async function githubConfig() {
      return Object.assign({ repo: '', branch: 'main', path: 'dataspatium', lastPush: null, lastPull: null, lastCommit: null }, (await idb.getSetting(GITHUB_SETTING, null)) || {});
    }
    /** @param {Record<string, any>} patch */
    async function setGithubConfig(patch) {
      const cfg = Object.assign(await githubConfig(), patch);
      await idb.setSetting(GITHUB_SETTING, cfg);
      return cfg;
    }
    async function githubTarget(token, fetchImpl) {
      const cfg = await githubConfig();
      const repo = github.parseRepo(cfg.repo);
      if (!repo) throw new Error(D.t('github.err.repo'));
      if (!token) throw new Error(D.t('github.err.notoken'));
      return { cfg, target: Object.assign({}, repo, { branch: cfg.branch || 'main', path: cfg.path, token, fetch: fetchImpl }) };
    }

    /**
     * Commit the whole workspace (datasets, charts, dashboards, templates, notebooks, scripts) to the repository.
     * @param {{token: string, message?: string, fetch?: Function}} options
     */
    async function pushToGitHub(options) {
      const { target } = await githubTarget(options.token, options.fetch);
      const { files } = await collect({ kind: 'workspace-backup', extra: { author: await comments.author() } });
      const res = await github.push(target, files, options.message || D.t('github.commit.default'), { managed: isWorkspaceFile, volatile: (p) => p === MANIFEST });
      await setGithubConfig({ lastPush: new Date().toISOString(), lastCommit: res.commit || (await githubConfig()).lastCommit });
      return Object.assign({ url: github.webUrl(target, res.commit) }, res);
    }

    /**
     * Download the workspace files from the repository (nothing changes here yet); restore them with restore().
     * @param {{token: string, fetch?: Function}} options
     * @returns {Promise<{entries: Record<string, Uint8Array>, manifest: any, existing: Array<{id: string, name: string, local: string}>, commit: string}>}
     */
    async function fetchFromGitHub(options) {
      const { target } = await githubTarget(options.token, options.fetch);
      const { commit, files } = await github.pull(target, { wanted: isWorkspaceFile });
      if (!files[MANIFEST]) throw new Error(D.t('github.err.empty.folder'));
      const manifest = JSON.parse(zip.text(files[MANIFEST]));
      return { entries: files, manifest, existing: await existingIn(files, manifest), commit };
    }

    /**
     * Add what fetchFromGitHub() found: what exists here is skipped, unless it is among `replaceIds`.
     * @param {{entries: Record<string, Uint8Array>, manifest: any, commit: string}} fetched
     * @param {{replaceIds?: string[]}} [options]
     */
    async function restoreFromGitHub(fetched, options = {}) {
      const existing = new Set((await datasets.list()).map((m) => m.id));
      const cfg = await githubConfig();
      const res = await restoreEntries(fetched.entries, { skipIds: existing, dedupe: true, replaceIds: new Set(options.replaceIds || []), received: { name: cfg.repo, author: (fetched.manifest && fetched.manifest.author) || '' } });
      await setGithubConfig({ lastPull: new Date().toISOString(), lastCommit: fetched.commit });
      return res;
    }

    return { backup, bundle, inspect, restore, restoreEntries, collect, saveToFolder, loadFromFolder, setAutoSave, setAutoSaveSetting, autoSaveSetting, initFolder, folderStatus, onFolder, markBackedUp, isBackupDue, backupStatus, setRemindDays, githubConfig, setGithubConfig, pushToGitHub, fetchFromGitHub, restoreFromGitHub, isWorkspaceFile, MANIFEST, AUTOSAVE_SETTING };
  });
})();
