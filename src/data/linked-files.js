// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Linked files (Chromium): a dataset imported from a file chosen with the File System Access picker keeps the
 * file's handle, so that "Uppdatera från disken" reads the file again with the same import options and replays
 * the dataset's recipe (api/runner.refreshDataset). Handles live in memory and, where the browser allows it, in
 * the settings store (linked:<dataset id>); reading again may need the user's permission, asked from the button.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/linked', ['platform/storage/idb', 'data/datasets'], (idb, datasets) => {
    const PREFIX = 'linked:';
    /** @type {Map<string, any>} dataset id -> FileSystemFileHandle (or a test double with getFile and queryPermission) */
    const handles = new Map();

    function supported() { return typeof (/** @type {any} */ (globalThis)).showOpenFilePicker === 'function'; }

    /** Let the user pick one file; returns the handle and the file (must run from a user gesture). */
    async function pick(options = {}) {
      if (!supported()) throw new Error(D.t('linked.err.unsupported'));
      const [handle] = await (/** @type {any} */ (globalThis)).showOpenFilePicker(Object.assign({ multiple: false, id: 'dataspatium-linked' }, options.types ? { types: options.types } : {}));
      return { handle, file: await handle.getFile() };
    }
    async function link(datasetId, handle) {
      handles.set(datasetId, handle);
      try { await idb.setSetting(PREFIX + datasetId, handle); } catch (err) { D.log('linked', 'handle not persisted', err); }
    }
    async function unlink(datasetId) {
      handles.delete(datasetId);
      try { await idb.deleteSetting(PREFIX + datasetId); } catch (_e) { /* ignore */ }
    }
    async function handleFor(datasetId) {
      if (handles.has(datasetId)) return handles.get(datasetId);
      let h = null;
      try { h = await idb.getSetting(PREFIX + datasetId, null); } catch (_e) { h = null; }
      if (h) handles.set(datasetId, h);
      return h;
    }
    function isLinked(meta) { return !!(meta && meta.source && meta.source.kind === 'file' && meta.source.linked); }

    /** Read permission for a handle; with request=true the user is asked (needs a gesture). */
    async function permission(handle, request) {
      if (!handle || typeof handle.queryPermission !== 'function') return 'granted';
      let p = await handle.queryPermission({ mode: 'read' });
      if (p !== 'granted' && request && typeof handle.requestPermission === 'function') p = await handle.requestPermission({ mode: 'read' });
      return p;
    }
    /** The linked file of a dataset, as a File. */
    async function file(datasetId, options = {}) {
      const handle = await handleFor(datasetId);
      if (!handle) throw new Error(D.t('linked.err.nohandle'));
      const p = await permission(handle, options.request !== false);
      if (p !== 'granted') throw new Error(D.t('linked.err.denied'));
      return handle.getFile();
    }
    /** Whether the file on disk differs from what was imported (size or modification time); null when unknown. */
    async function changed(datasetId) {
      const meta = await datasets.get(datasetId);
      if (!isLinked(meta)) return false;
      const handle = await handleFor(datasetId);
      if (!handle || (await permission(handle, false)) !== 'granted') return null;
      const f = await handle.getFile();
      return f.size !== meta.source.size || (!!meta.source.lastModified && new Date(f.lastModified).toISOString() !== meta.source.lastModified);
    }
    /**
     * Parse the linked file again with the dataset's import options: a table for api/runner.refreshDataset, which
     * infers the types afresh, rebuilds the rows and replays the recipe.
     * @param {any} source the dataset's source descriptor @param {{datasetId?: string}} [options]
     */
    async function refetch(source, options = {}) {
      const id = options.datasetId;
      if (!id) throw new Error(D.t('linked.err.nohandle'));
      const meta = await datasets.get(id);
      const f = await file(id, { request: true });
      const importer = D.require('io/import');
      const types = D.require('data/types');
      const importOptions = Object.assign({}, (meta && meta.importOptions) || {});
      delete importOptions.linked;
      const table = await importer.parse(f, importOptions);
      table.columns = types.cleanColumnNames(table.columns);
      return { columns: table.columns, rows: table.rows, types: {}, file: { name: f.name, size: f.size, lastModified: f.lastModified } };
    }

    return { supported, pick, link, unlink, handleFor, isLinked, permission, file, changed, refetch, PREFIX };
  });
})();
