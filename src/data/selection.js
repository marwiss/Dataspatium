// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A selection that follows the user between the modes: twelve walls, thirty photos or the hits of a search, made in one
 * place and used in the next. There is one at a time, it lives until the page closes or it is cleared, and it can be kept
 * as a list or turned into a dataset. Rows are remembered by rowid, so it stops meaning anything when the table is rebuilt;
 * a change of content therefore clears it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/selection', ['data/datasets', 'data/lists'], (datasets, lists) => {
    /** @type {{datasetId: string, rowids: number[], label: string, marker: any}|null} */
    let current = null;
    const listeners = new Set();
    const notify = () => { for (const fn of listeners) { try { fn(current); } catch (err) { D.log('selection', err); } } };
    /** @param {Function} fn called with the selection or null @returns {Function} stop listening */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    /** The selection, as long as the dataset's rows are the same as when it was made. */
    function get() {
      if (current && datasets.contentMarker(current.datasetId) !== current.marker) { current = null; notify(); }
      return current;
    }
    function clear() { if (current) { current = null; notify(); } }
    /**
     * Make a selection; no rows means none.
     * @param {{datasetId: string, rowids: number[], label?: string}} input
     */
    function set(input) {
      current = input.rowids && input.rowids.length ? { datasetId: input.datasetId, rowids: input.rowids.map(Number), label: input.label || '', marker: datasets.contentMarker(input.datasetId) } : null;
      notify();
      return current;
    }
    /**
     * Make a selection from a condition on the dataset's rows.
     * @param {string} datasetId @param {string} where SQL condition, or empty for all rows @param {any[]} [params] @param {string} [label]
     */
    async function setFromWhere(datasetId, where, params = [], label = '') {
      const handle = await datasets.ensureOpen(datasetId);
      const r = await handle.engine.exec(`select rowid from data${where ? ' where ' + where : ''}`, params);
      return set({ datasetId, rowids: r[0] ? r[0].values.map((row) => Number(row[0])) : [], label });
    }
    /** The condition for the selection in one dataset, or null. @param {string} datasetId */
    function whereOf(datasetId) {
      const s = get();
      return s && s.datasetId === datasetId ? { sql: `rowid in (${s.rowids.join(',')})`, params: [] } : null;
    }
    /** Keep it as a list, which Bearbeta and charts can use later. @param {string} name */
    async function toList(name) {
      const s = get();
      if (!s) return null;
      return lists.save({ name, datasetId: s.datasetId, kind: 'rows', rowids: s.rowids, hits: s.rowids.length });
    }
    /** The selected rows as a new dataset. @param {string} name */
    async function toDataset(name) {
      const s = get();
      if (!s) return null;
      return datasets.createFromQuery(s.datasetId, `select * from data where rowid in (${s.rowids.join(',')})`, { name });
    }

    return { get, set, setFromWhere, clear, whereOf, toList, toDataset, subscribe };
  });
})();
