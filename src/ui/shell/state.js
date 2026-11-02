// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tiny observable store: `set(patch)` merges and notifies subscribers with the changed keys.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/state', [], () => {
    /**
     * @template T
     * @param {T} initial
     */
    function createStore(initial) {
      let state = Object.assign({}, initial);
      /** @type {Set<(state: T, changed: string[]) => void>} */
      const subscribers = new Set();
      return {
        get: () => state,
        /** @param {Partial<T>|((s: T) => Partial<T>)} patch */
        set(patch) {
          const next = typeof patch === 'function' ? patch(state) : patch;
          const changed = Object.keys(next).filter((k) => next[k] !== state[k]);
          if (!changed.length) return;
          state = Object.assign({}, state, next);
          for (const fn of Array.from(subscribers)) { try { fn(state, changed); } catch (err) { console.error('[state] subscriber failed', err); } }
        },
        subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
      };
    }
    return { createStore };
  });
})();
