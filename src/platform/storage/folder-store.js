// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Portable workspace folder via the File System Access API (Chromium only; Firefox has no directory
 * picker, see capabilities). The chosen directory handle is kept in IndexedDB settings so the folder is
 * remembered between sessions; Chromium then asks once per browser session before the handle may be
 * used again, which must happen from a user gesture (see permission()). All path helpers take the root
 * handle explicitly so that tests can pass an in-memory stand-in with the same methods.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/storage/folder', ['platform/storage/idb', 'platform/capabilities'], (idb, caps) => {
    const SETTING = 'folder:handle';
    const state = { handle: null, loaded: false };

    /** True when the browser can open a directory picker (Chromium). */
    function supported() { return !!caps.fileSystemAccess; }

    /** The remembered directory handle, or null. */
    async function current() {
      if (!state.loaded) {
        try { state.handle = (await idb.getSetting(SETTING, null)) || null; } catch (_err) { state.handle = null; }
        state.loaded = true;
      }
      return state.handle;
    }

    /** Remember a handle, or forget it with null. Handles that cannot be cloned stay in memory only. */
    async function setHandle(handle) {
      state.handle = handle || null; state.loaded = true;
      try { if (handle) await idb.setSetting(SETTING, handle); else await idb.deleteSetting(SETTING); } catch (err) { D.log('folder', 'handle not persisted', err); }
    }

    /** Ask the user for a folder (must run from a user gesture). */
    async function choose() {
      if (!supported()) throw new Error('Webbläsaren saknar mappåtkomst (File System Access). Använd Edge eller Chrome.');
      const handle = await /** @type {any} */ (globalThis).showDirectoryPicker({ mode: 'readwrite', id: 'dataspatium-workspace' });
      await setHandle(handle);
      return handle;
    }
    async function disconnect() { await setHandle(null); }

    /**
     * Read/write permission state for a handle; with request=true the user is asked (needs a gesture).
     * @returns {Promise<'granted'|'prompt'|'denied'|'none'>}
     */
    async function permission(handle, request = false) {
      if (!handle) return 'none';
      if (typeof handle.queryPermission !== 'function') return 'granted';
      let p = await handle.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && request && typeof handle.requestPermission === 'function') p = await handle.requestPermission({ mode: 'readwrite' });
      return p;
    }

    async function resolve(root, path, create) {
      const parts = String(path).split('/').filter(Boolean);
      const name = parts.pop();
      if (!name) throw new Error('Tom sökväg');
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
      return { dir, name };
    }

    /** @param {any} root @param {string} path @param {Uint8Array|Blob|string} data */
    async function writeFile(root, path, data) {
      const { dir, name } = await resolve(root, path, true);
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      try { await w.write(typeof data === 'string' ? new TextEncoder().encode(data) : data); } finally { await w.close(); }
    }

    /** @returns {Promise<Uint8Array>} */
    async function readFile(root, path) {
      const { dir, name } = await resolve(root, path, false);
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      return new Uint8Array(await file.arrayBuffer());
    }

    /** @returns {Promise<boolean>} true when something was removed */
    async function removeFile(root, path) {
      try { const { dir, name } = await resolve(root, path, false); await dir.removeEntry(name); return true; } catch (_err) { return false; }
    }

    /** Recursive list of file paths (forward slashes) under the root, optionally filtered by prefix. */
    async function listFiles(root, prefix = '') {
      const out = [];
      async function walk(dir, base) {
        for await (const [name, entry] of dir.entries()) {
          const p = base ? base + '/' + name : name;
          if (entry.kind === 'directory') await walk(entry, p); else out.push(p);
        }
      }
      await walk(root, '');
      return out.filter((p) => p.startsWith(prefix)).sort();
    }

    return { supported, current, setHandle, choose, disconnect, permission, writeFile, readFile, removeFile, listFiles, SETTING };
  });
})();
