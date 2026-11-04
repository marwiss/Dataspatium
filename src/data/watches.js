// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Watches: for a dataset with a source that can be read again (a saved fetch, a table through the database bridge, a
 * linked file), the app checks when asked, or at start if the user wants that, whether the source has changed. It reads
 * the source and compares a fingerprint of its rows with the one from the last time the dataset was updated, so a
 * reordered answer is not news and the summary can say how many rows came and went. The dataset itself changes only
 * when the user updates it. Nothing happens in the background: no check without the app open, and a check at start
 * never asks for anything, it skips what has no consent or permission yet.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/watches', ['platform/storage/idb', 'platform/consent', 'data/datasets', 'api/runner', 'data/linked'], (idb, consent, datasets, runner, linked) => {
    const PREFIX = 'watch:';
    const ON_START = 'watch.onStart';
    const listeners = new Set();
    const notify = (type, payload) => { for (const fn of Array.from(listeners)) { try { fn(type, payload); } catch (err) { console.error('[watches] listener failed', err); } } };
    /** @param {(type: 'changed', payload: any) => void} fn */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const pause = () => new Promise((r) => setTimeout(r, 0));

    /** True when a dataset's source can be read again. */
    function watchable(meta) {
      const s = meta && meta.source;
      return !!(s && (s.kind === 'api' || s.kind === 'bridge' || (s.kind === 'file' && s.linked)));
    }
    async function list() { return (await idb.listSettings(PREFIX)).map((r) => r.value); }
    async function get(id) { return idb.getSetting(PREFIX + id, null); }
    async function store(rec) { await idb.setSetting(PREFIX + rec.datasetId, rec); notify('changed', rec); return rec; }

    function hashText(text) {
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return h | 0;
    }
    /**
     * A fingerprint of a table: its columns and the sorted hashes of its rows, so that row order does not count.
     * Done in portions, so the page stays responsive on large answers.
     * @param {{columns: string[], rows: any[][]}} table
     */
    async function fingerprint(table) {
      const hashes = new Int32Array(table.rows.length);
      for (let i = 0; i < table.rows.length; i++) {
        hashes[i] = hashText(JSON.stringify(table.rows[i]));
        if (i && i % 5000 === 0) await pause();
      }
      hashes.sort();
      return { rows: table.rows.length, columns: table.columns.slice(), hashes };
    }
    /** How one fingerprint differs from another. A changed row counts as one gone and one new. */
    function difference(before, after) {
      let i = 0; let j = 0; let added = 0; let removed = 0;
      const a = before.hashes; const b = after.hashes;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; } else if (a[i] < b[j]) { removed++; i++; } else { added++; j++; }
      }
      removed += a.length - i; added += b.length - j;
      const columnsAdded = after.columns.filter((c) => !before.columns.includes(c));
      const columnsRemoved = before.columns.filter((c) => !after.columns.includes(c));
      return { rowsBefore: before.rows, rowsNow: after.rows, added, removed, columnsAdded, columnsRemoved, same: !added && !removed && !columnsAdded.length && !columnsRemoved.length };
    }

    /** Reads the source of a dataset as a table, without touching the dataset. */
    async function readSource(meta, options = {}) {
      return (options.fetch || runner.refetch)(meta.source, { datasetId: meta.id, signal: options.signal });
    }
    /**
     * Starts or stops watching a dataset. Starting reads the source once, which also shows whether it has already moved
     * on since the dataset was fetched.
     * @param {string} id @param {boolean} on @param {{fetch?: Function}} [options]
     */
    async function setWatched(id, on, options = {}) {
      if (!on) { await idb.deleteSetting(PREFIX + id); notify('changed', { datasetId: id, removed: true }); return null; }
      const meta = await datasets.get(id);
      if (!watchable(meta)) throw new Error(D.t('watch.err.source'));
      const rec = { datasetId: id, baseline: null, state: 'unknown', summary: null, error: '', lastCheck: null };
      await store(rec);
      return check(id, Object.assign({}, options, { first: true }));
    }

    /**
     * Checks one watched dataset.
     * @param {string} id @param {{fetch?: Function, signal?: AbortSignal, first?: boolean}} [options]
     * @returns {Promise<any>} the watch with state same, new, unknown or error
     */
    async function check(id, options = {}) {
      const rec = await get(id);
      if (!rec) return null;
      const meta = await datasets.get(id);
      if (!meta) { await idb.deleteSetting(PREFIX + id); notify('changed', { datasetId: id, removed: true }); return null; }
      rec.lastCheck = new Date().toISOString();
      rec.error = '';
      try {
        if (meta.source.kind === 'file') {
          const changed = await linked.changed(id);
          if (changed === null) { rec.state = 'unknown'; rec.summary = null; return store(rec); }
          if (!changed) { rec.state = 'same'; rec.summary = null; if (!rec.baseline) rec.baseline = await fingerprint(await readSource(meta, options)); return store(rec); }
        }
        const now = await fingerprint(await readSource(meta, options));
        if (!rec.baseline) {
          // The first look: the fingerprint of what the dataset was made from is gone, but the row count was noted.
          rec.baseline = now;
          const known = meta.source.rows;
          if (typeof known === 'number' && known !== now.rows) { rec.state = 'new'; rec.summary = { rowsBefore: known, rowsNow: now.rows, added: Math.max(0, now.rows - known), removed: Math.max(0, known - now.rows), columnsAdded: [], columnsRemoved: [] }; }
          else if (meta.source.kind === 'file') { rec.state = 'new'; rec.summary = { rowsBefore: meta.rowCount || 0, rowsNow: now.rows, added: 0, removed: 0, columnsAdded: [], columnsRemoved: [] }; }
          else { rec.state = 'same'; rec.summary = null; }
          return store(rec);
        }
        const diff = difference(rec.baseline, now);
        if (diff.same) { rec.state = 'same'; rec.summary = null; } else { rec.state = 'new'; rec.summary = diff; }
        return store(rec);
      } catch (err) {
        rec.state = 'error'; rec.summary = null; rec.error = String((err && err.message) || err);
        return store(rec);
      }
    }
    /**
     * Checks every watched dataset in turn.
     * @param {{fetch?: Function, signal?: AbortSignal, onProgress?: Function}} [options]
     */
    async function checkAll(options = {}) {
      const out = [];
      const all = await list();
      for (const rec of all) {
        if (options.signal && options.signal.aborted) break;
        out.push(await check(rec.datasetId, options));
        if (options.onProgress) options.onProgress({ done: out.length, total: all.length });
      }
      return out.filter(Boolean);
    }
    async function checksOnStart() { return !!(await idb.getSetting(ON_START, false)); }
    async function setChecksOnStart(on) { await idb.setSetting(ON_START, !!on); notify('changed', {}); }
    let startDone = false;
    /**
     * The check at start, when the user has asked for it. It never asks for anything: API sources need their consent
     * given already, linked files need their permission still valid (see check), and the local bridge is left out because
     * its token is only known once the user has connected.
     * @param {{force?: boolean, fetch?: Function}} [options]
     */
    async function checkOnStart(options = {}) {
      if (startDone && !options.force) return [];
      startDone = true;
      if (!(await checksOnStart())) return [];
      const allowed = (await consent.state('api')) === 'granted';
      const out = [];
      for (const rec of await list()) {
        const meta = await datasets.get(rec.datasetId);
        if (!meta || !meta.source) continue;
        if (meta.source.kind === 'bridge' || (meta.source.kind === 'api' && !allowed)) continue;
        out.push(await check(rec.datasetId, options));
      }
      return out.filter(Boolean);
    }
    /** Watches where new data waits. */
    async function pending() { return (await list()).filter((r) => r.state === 'new'); }
    /** Fetches the dataset again (with its recipe replayed); the fingerprint follows through onFetched below. */
    async function update(id, options = {}) { return runner.refreshDataset(id, options); }

    // Whenever a dataset is updated from its source, by anyone, what it was made from is what the next check compares with.
    runner.onFetched(async (id, table) => {
      const rec = await get(id);
      if (!rec) return;
      rec.baseline = await fingerprint(table);
      rec.state = 'same'; rec.summary = null; rec.error = ''; rec.lastCheck = new Date().toISOString();
      await store(rec);
    });

    return { watchable, list, get, setWatched, check, checkAll, checksOnStart, setChecksOnStart, checkOnStart, pending, update, fingerprint, difference, subscribe };
  });
})();
