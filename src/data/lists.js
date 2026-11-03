// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Lists (Söka): saved selections, that is a search text and facet filters on one dataset. A list runs again
 * against the current data, and its hits can become a new dataset. Stored in IndexedDB (`lists`).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/lists', ['platform/storage/idb', 'data/datasets', 'analysis/search'], (idb, datasets, search) => {
    const listeners = new Set();
    const notify = (type, payload) => { for (const fn of Array.from(listeners)) { try { fn(type, payload); } catch (err) { console.error('[lists] listener failed', err); } } };
    /** @param {(type: string, payload: any) => void} fn */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const uid = () => 'list_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    async function list() { return idb.listLists(); }
    async function get(id) { return idb.getList(id); }

    /**
     * Save a list (new or updated).
     * @param {{id?: string, name: string, datasetId: string, text?: string, filters?: Array<{column: string, value: any}>, hits?: number|null, createdAt?: string}} input
     */
    async function save(input) {
      const meta = await datasets.get(input.datasetId);
      const now = new Date().toISOString();
      const rec = {
        id: input.id || uid(), name: String(input.name || '').trim() || D.t('soka.list.untitled'), datasetId: input.datasetId,
        datasetName: meta ? meta.name : '', datasetShort: meta ? meta.shortName || '' : '',
        text: input.text || '', filters: (input.filters || []).map((f) => ({ column: f.column, value: f.value })),
        hits: input.hits === undefined ? null : input.hits, lastRunAt: null,
        createdAt: input.createdAt || now, updatedAt: now,
      };
      await idb.putList(rec);
      notify('saved', rec);
      return rec;
    }

    async function remove(id) { await idb.deleteList(id); notify('deleted', { id }); }

    /** Run a list again: the current hits in its dataset (the stored hit count follows). */
    async function run(rec, options = {}) {
      const res = await search.searchDataset(rec.datasetId, rec.text, rec.filters, options);
      rec.hits = res.count;
      rec.lastRunAt = new Date().toISOString();
      await idb.putList(rec);
      notify('run', rec);
      return res;
    }

    /** The hits as a new dataset (same columns and types as the source). */
    async function toDataset(rec, name) {
      const cols = await datasets.columns(rec.datasetId);
      const { sql, params } = search.hitsSql(cols, rec.text, rec.filters);
      return datasets.createFromQuery(rec.datasetId, sql, { name: name || rec.name, params, source: { list: { id: rec.id, name: rec.name, text: rec.text, filters: rec.filters } } });
    }

    /** Readable summary of what a list selects. */
    function describe(rec) {
      const parts = [];
      if (rec.text) parts.push('"' + rec.text + '"');
      for (const f of rec.filters || []) parts.push(`${f.column} = ${f.value === null || f.value === undefined ? D.t('common.missing') : f.value}`);
      return parts.join(' · ');
    }

    return { list, get, save, remove, run, toDataset, describe, subscribe };
  });
})();
