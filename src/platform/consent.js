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
    const PURPOSES = ['api', 'url', 'github', 'components', 'basemaps', 'databases', 'neo4j', 'opencde', 'stun', 'ai'];
    const key = (purpose) => 'consent.' + purpose;
    /** @type {Map<string, 'granted'|'denied'|null>} */
    const cache = new Map();
    const listeners = new Set();
    /** @type {null|((purpose: string, info: any) => Promise<{allow: boolean, remember?: boolean}|null>)} */
    let asker = null;
    const notify = (purpose, value) => { for (const fn of Array.from(listeners)) { try { fn(purpose, value); } catch (err) { console.error('[consent] listener failed', err); } } };

    /**
     * A refusal. `reason` 'unattended' is a run nobody watches (a flow at start, `ask: false`) that met a consent not kept: its
     * text says how to allow it, since nobody refused anything.
     */
    class ConsentError extends Error {
      constructor(purpose, reason) {
        super(D.t(reason === 'unattended' ? 'consent.unattended' : 'consent.denied', { purpose: D.t('consent.purpose.' + purpose) }));
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

    /** Per purpose, the end of the queue of questions: one question per purpose is open at a time. */
    const queues = new Map();
    /** The open question for a purpose and its detail (host and label): the same question asked again shares its answer. */
    const openQuestions = new Map();
    /** Per purpose, how many questions were queued, and through which of them a refusal reaches. */
    const queuedCount = new Map();
    const refusedThrough = new Map();

    /**
     * Ask about a purpose once its earlier questions are answered. The state is read again first, so a remembered answer settles
     * the questions that waited for it. A one-time yes covers only its own question, so another host is asked again; a refusal of
     * any kind (Deny, Escape, closing the dialog) also refuses, unasked, the questions already waiting, since refusing fails closed
     * and one no then ends a burst. A question whose `wanted()` says no (its worker has ended) is refused without asking.
     * @returns {Promise<boolean>} whether the question was allowed
     */
    function ask(purpose, info) {
      const key = purpose + '\n' + (info.host || '') + '\n' + (info.label || '');
      const same = openQuestions.get(key);
      if (same) return same;
      const seq = (queuedCount.get(purpose) || 0) + 1;
      queuedCount.set(purpose, seq);
      const answer = (queues.get(purpose) || Promise.resolve()).then(async () => {
        if (seq <= (refusedThrough.get(purpose) || 0)) return false;
        const v = await state(purpose);
        if (v === 'granted') return true;
        if (v === 'denied') return false;
        if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
        if (typeof info.wanted === 'function' && !info.wanted()) return false;
        const a = await asker(purpose, info);
        if (!a || !a.allow) {
          refusedThrough.set(purpose, queuedCount.get(purpose));
          if (a && a.remember) await set(purpose, 'denied');
          return false;
        }
        if (a.remember !== false) await set(purpose, 'granted');
        return true;
      });
      const settled = answer.then(() => {}, () => {});
      queues.set(purpose, settled);
      openQuestions.set(key, answer);
      settled.then(() => {
        if (openQuestions.get(key) === answer) openQuestions.delete(key);
        if (queues.get(purpose) === settled) queues.delete(purpose);
      });
      return answer;
    }

    /**
     * Make sure a purpose is allowed; asks through the registered asker, one question per purpose at a time. Rejects with
     * ConsentError when the user has said no (now or earlier), or when the question is no longer wanted. With `ask: false`
     * (the marker a flow at start carries down to every fetch it makes) nothing is asked: only a consent already kept for good
     * lets it through, and otherwise it rejects with reason 'unattended'.
     * @param {string} purpose
     * @param {{host?: string, label?: string, size?: number, wanted?: () => boolean, ask?: boolean}} [info] shown in the question;
     *   `wanted` is asked right before the question is shown
     */
    async function require(purpose, info = {}) {
      const v = await state(purpose);
      if (v === 'granted') return true;
      if (v === 'denied') throw new ConsentError(purpose, 'denied');
      if (info.ask === false) throw new ConsentError(purpose, 'unattended');
      if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
      if (!(await ask(purpose, info))) throw new ConsentError(purpose, 'denied');
      return true;
    }

    /** The UI's question (a dialog); returns {allow, remember}. */
    function setAsker(fn) { asker = fn; }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return String(url || ''); } };

    return { PURPOSES, state, set, all, require, setAsker, subscribe, hostOf, override, ConsentError };
  });
})();
