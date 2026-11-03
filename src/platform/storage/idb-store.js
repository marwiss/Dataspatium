// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Workspace storage in IndexedDB (via Dexie). Holds dataset metadata, dataset files (SQLite bytes,
 * stored in 8 MB chunks) and settings. IndexedDB is the only storage that works and persists under
 * file:// in both Edge and Firefox; the data lives in this browser profile only, so the app offers
 * ZIP backups (see zip-bundle.js) and, later, a portable folder in Chromium.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/storage/idb', [], () => {
    const DB_NAME = 'dataspatium';
    const CHUNK = 8 * 1024 * 1024;
    /** @type {any} */
    let db = null;
    let opening = null;

    async function open() {
      if (db) return db;
      if (!opening) {
        opening = (async () => {
          await D.assets.loadVendorScript('vendor/dexie/dexie.min.js');
          const Dexie = /** @type {any} */ (globalThis).Dexie;
          const instance = new Dexie(DB_NAME);
          instance.version(1).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key' });
          instance.version(2).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key', scripts: 'id, name, language, updatedAt' });
          instance.version(3).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key', scripts: 'id, name, language, updatedAt', charts: 'id, name, kind, datasetId, updatedAt' });
          instance.version(4).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key', scripts: 'id, name, language, updatedAt', charts: 'id, name, kind, datasetId, updatedAt', documents: 'id, name, updatedAt' });
          instance.version(5).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key', scripts: 'id, name, language, updatedAt', charts: 'id, name, kind, datasetId, updatedAt', documents: 'id, name, updatedAt', dashboards: 'id, name, updatedAt' });
          instance.version(6).stores({ datasets: 'id, name, updatedAt', blobs: 'key, parent', settings: 'key', scripts: 'id, name, language, updatedAt', charts: 'id, name, kind, datasetId, updatedAt', documents: 'id, name, updatedAt', dashboards: 'id, name, updatedAt', notebooks: 'id, name, datasetId, updatedAt' });
          await instance.open();
          db = instance;
          return instance;
        })();
      }
      return opening;
    }

    // ---- dataset metadata ----
    async function listDatasets() { const d = await open(); return d.datasets.orderBy('updatedAt').reverse().toArray(); }
    async function getDataset(id) { const d = await open(); return d.datasets.get(id); }
    async function putDataset(meta) { const d = await open(); await d.datasets.put(meta); return meta; }
    async function deleteDataset(id) {
      const d = await open();
      await d.transaction('rw', d.datasets, d.blobs, async () => {
        await d.datasets.delete(id);
        await d.blobs.where('parent').equals('ds:' + id).delete();
      });
    }

    // ---- large binaries, chunked ----
    /** @param {string} parent @param {ArrayBuffer} buffer */
    async function saveBlob(parent, buffer) {
      const d = await open();
      const chunks = [];
      let n = 0;
      for (let i = 0; i < buffer.byteLength || (i === 0 && n === 0); i += CHUNK, n++) {
        chunks.push({ key: `${parent}:${n}`, parent, index: n, data: buffer.slice(i, Math.min(i + CHUNK, buffer.byteLength)) });
        if (buffer.byteLength === 0) break;
      }
      await d.transaction('rw', d.blobs, async () => {
        await d.blobs.where('parent').equals(parent).delete();
        await d.blobs.bulkPut(chunks);
      });
      return buffer.byteLength;
    }
    /** @returns {Promise<ArrayBuffer|null>} */
    async function loadBlob(parent) {
      const d = await open();
      const chunks = await d.blobs.where('parent').equals(parent).sortBy('index');
      if (!chunks.length) return null;
      if (chunks.length === 1) return chunks[0].data;
      const total = chunks.reduce((s, c) => s + c.data.byteLength, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(new Uint8Array(c.data), offset); offset += c.data.byteLength; }
      return out.buffer;
    }
    async function deleteBlob(parent) { const d = await open(); await d.blobs.where('parent').equals(parent).delete(); }

    // ---- saved scripts (R, SQL, ...) ----
    async function listScripts(language) {
      const d = await open();
      const all = await d.scripts.orderBy('updatedAt').reverse().toArray();
      return language ? all.filter((s) => s.language === language) : all;
    }
    async function getScript(id) { const d = await open(); return d.scripts.get(id); }
    async function putScript(script) { const d = await open(); await d.scripts.put(script); return script; }
    async function deleteScript(id) { const d = await open(); await d.scripts.delete(id); }

    // ---- saved charts (Vega-Lite, D3 templates, R scripts) ----
    async function listCharts(datasetId) {
      const d = await open();
      const all = await d.charts.orderBy('updatedAt').reverse().toArray();
      return datasetId ? all.filter((c) => c.datasetId === datasetId) : all;
    }
    async function getChart(id) { const d = await open(); return d.charts.get(id); }
    async function putChart(chart) { const d = await open(); await d.charts.put(chart); return chart; }
    async function deleteChart(id) { const d = await open(); await d.charts.delete(id); }
    async function listDashboards() { const d = await open(); return d.dashboards.orderBy('updatedAt').reverse().toArray(); }
    async function getDashboard(id) { const d = await open(); return d.dashboards.get(id); }
    async function putDashboard(dash) { const d = await open(); await d.dashboards.put(dash); return dash; }
    async function deleteDashboard(id) { const d = await open(); await d.dashboards.delete(id); }
    async function listNotebooks() { const d = await open(); return d.notebooks.orderBy('updatedAt').reverse().toArray(); }
    async function getNotebook(id) { const d = await open(); return d.notebooks.get(id); }
    async function putNotebook(nb) { const d = await open(); await d.notebooks.put(nb); return nb; }
    async function deleteNotebook(id) { const d = await open(); await d.notebooks.delete(id); }

    // ---- document templates ----
    async function listDocuments() { const d = await open(); return d.documents.orderBy('updatedAt').reverse().toArray(); }
    async function getDocument(id) { const d = await open(); return d.documents.get(id); }
    async function putDocument(doc) { const d = await open(); await d.documents.put(doc); return doc; }
    async function deleteDocument(id) { const d = await open(); await d.documents.delete(id); }

    // ---- settings ----
    async function getSetting(key, fallback) { const d = await open(); const row = await d.settings.get(key); return row ? row.value : fallback; }
    async function setSetting(key, value) { const d = await open(); await d.settings.put({ key, value }); }
    async function deleteSetting(key) { const d = await open(); await d.settings.delete(key); }
    /** Settings whose key starts with a prefix: [{key, value}]. */
    async function listSettings(prefix) { const d = await open(); return d.settings.where('key').startsWith(prefix).toArray(); }

    // ---- quota ----
    async function estimate() { try { return await navigator.storage.estimate(); } catch (_e) { return null; } }
    async function persisted() { try { return navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (_e) { return false; } }
    async function requestPersist() { try { return navigator.storage.persist ? await navigator.storage.persist() : false; } catch (_e) { return false; } }

    /** Remove everything (used by tests and by "återställ arbetsytan"). */
    async function clearAll() { const d = await open(); await d.transaction('rw', d.datasets, d.blobs, d.settings, async () => { await d.datasets.clear(); await d.blobs.clear(); await d.settings.clear(); }); }

    return { open, listDatasets, getDataset, putDataset, deleteDataset, saveBlob, loadBlob, deleteBlob, listScripts, getScript, putScript, deleteScript, listCharts, getChart, putChart, deleteChart, listDashboards, getDashboard, putDashboard, deleteDashboard, listNotebooks, getNotebook, putNotebook, deleteNotebook, listDocuments, getDocument, putDocument, deleteDocument, getSetting, setSetting, deleteSetting, listSettings, estimate, persisted, requestPersist, clearAll, CHUNK };
  });
})();
