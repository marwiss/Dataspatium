// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Internet access by consent. Every purpose that makes the app contact a server (API fetches, web addresses,
 * GitHub, components downloaded on demand, background maps, databases, Neo4j, STUN) has its own consent, asked
 * for the first time it is needed and remembered until changed under Hantera. The UI registers the asker; without
 * one (tests, tools) a request is allowed and logged, since nothing there happens without an explicit call.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/consent', ['platform/storage/idb'], (idb) => {
    const PURPOSES = ['api', 'url', 'github', 'components', 'basemaps', 'databases', 'neo4j', 'opencde', 'stun'];
    const key = (purpose) => 'consent.' + purpose;
    /** @type {Map<string, 'granted'|'denied'|null>} */
    const cache = new Map();
    const listeners = new Set();
    /** @type {null|((purpose: string, info: any) => Promise<{allow: boolean, remember?: boolean}|null>)} */
    let asker = null;
    const notify = (purpose, value) => { for (const fn of Array.from(listeners)) { try { fn(purpose, value); } catch (err) { console.error('[consent] listener failed', err); } } };

    class ConsentError extends Error {
      constructor(purpose, reason) {
        super(D.t('consent.denied', { purpose: D.t('consent.purpose.' + purpose) }));
        this.name = 'ConsentError';
        this.purpose = purpose;
        this.reason = reason || 'denied';
      }
    }

    /** Developer switch: `localStorage dataspatium.consent = granted` allows everything (the test page sets it). */
    function override() { try { return localStorage.getItem('dataspatium.consent') === 'granted'; } catch (_e) { return false; } }

    /** 'granted', 'denied' or null (ask next time). */
    async function state(purpose) {
      if (override()) return 'granted';
      if (cache.has(purpose)) return cache.get(purpose);
      let v = null;
      try { v = await idb.getSetting(key(purpose), null); } catch (_e) { v = null; }
      cache.set(purpose, v === 'granted' || v === 'denied' ? v : null);
      return cache.get(purpose);
    }

    /** @param {string} purpose @param {'granted'|'denied'|null} value */
    async function set(purpose, value) {
      cache.set(purpose, value);
      if (value === null) await idb.deleteSetting(key(purpose)); else await idb.setSetting(key(purpose), value);
      notify(purpose, value);
    }

    async function all() {
      const out = {};
      for (const p of PURPOSES) out[p] = await state(p);
      return out;
    }

    /**
     * Make sure a purpose is allowed; asks once through the registered asker. Rejects with ConsentError when the
     * user has said no (now or earlier).
     * @param {string} purpose
     * @param {{host?: string, label?: string, size?: number}} [info] shown in the question
     */
    async function require(purpose, info = {}) {
      const v = await state(purpose);
      if (v === 'granted') return true;
      if (v === 'denied') throw new ConsentError(purpose, 'denied');
      if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
      const answer = await asker(purpose, info);
      if (!answer || !answer.allow) {
        if (answer && answer.remember) await set(purpose, 'denied');
        throw new ConsentError(purpose, 'denied');
      }
      if (answer.remember !== false) await set(purpose, 'granted');
      return true;
    }

    /** The UI's question (a dialog); returns {allow, remember}. */
    function setAsker(fn) { asker = fn; }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return String(url || ''); } };

    return { PURPOSES, state, set, all, require, setAsker, subscribe, hostOf, override, ConsentError };
  });
})();
