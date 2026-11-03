// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Coordination between tabs of the same workspace: a BroadcastChannel carries change notifications
 * (datasets, charts, dashboards, notebooks, templates) so that other tabs reload their lists and drop
 * stale in-memory copies, and Web Locks serialise writes of the same dataset file. Both are optional:
 * without them the app works as before, with the last write winning.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/sync', [], () => {
    const NAME = 'dataspatium-sync';
    const tabId = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const supported = typeof BroadcastChannel !== 'undefined';
    const listeners = new Set();
    let channel = null;

    function start() {
      if (channel || !supported) return channel;
      try {
        channel = new BroadcastChannel(NAME);
        channel.onmessage = (e) => {
          const msg = e.data;
          if (!msg || msg.tab === tabId) return;
          for (const fn of Array.from(listeners)) { try { fn(msg); } catch (err) { console.error(err); } }
        };
      } catch (_err) { channel = null; }
      return channel;
    }

    /** Tell the other tabs about a change. Returns false when broadcasting is unavailable. */
    function broadcast(kind, action, payload) {
      if (!channel) start();
      if (!channel) return false;
      try { channel.postMessage({ tab: tabId, kind, action, payload: payload || {}, at: Date.now() }); return true; } catch (_err) { return false; }
    }

    /** Listen to changes from other tabs: fn({tab, kind, action, payload, at}). */
    function on(fn) { start(); listeners.add(fn); return () => listeners.delete(fn); }

    /** Run fn while holding a cross-tab lock (Web Locks); without the API fn runs directly. */
    async function withLock(name, fn) {
      const locks = navigator.locks;
      if (locks && typeof locks.request === 'function') return locks.request('dataspatium:' + name, fn);
      return fn();
    }

    return { start, broadcast, on, withLock, tabId, NAME, supported };
  });
})();
