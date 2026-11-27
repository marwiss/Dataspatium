// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Internet access by consent. Every purpose that makes the app contact a server (API fetches, web addresses,
 * GitHub, components downloaded on demand, Python code, background maps, databases, Neo4j, STUN) has its own consent, asked
 * for the first time it is needed and remembered until changed under Hantera. The UI registers the asker; without
 * one (tests, tools) a request is allowed and logged, since nothing there happens without an explicit call.
 *
 * Where content chooses the host (F102 a, F103 a: Python code, plotly figures, also in received notebooks and recipes) the
 * answer is asked and remembered per host instead: the request says so with `perHost` (Python code always is), a yes for the
 * purpose never covers it, a refused purpose refuses it, and the hosts answered for good are listed per purpose (hosts()) and
 * can be removed (setHost(purpose, host, null)). Addresses the person types and the app's own map layers stay per purpose.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/consent', ['platform/storage/idb'], (idb) => {
    const PURPOSES = ['api', 'url', 'github', 'components', 'python', 'basemaps', 'databases', 'neo4j', 'opencde', 'stun', 'ai'];
    /** Purposes whose every request is chosen by content, so always asked per host: Python code reaching the internet (F102 a). */
    const PER_HOST = new Set(['python']);
    const key = (purpose) => 'consent.' + purpose;
    const hostsKey = (purpose) => 'consent.hosts.' + purpose;
    /** @type {Map<string, 'granted'|'denied'|null>} */
    const cache = new Map();
    /** Per purpose, the hosts answered for good, loaded once: Map<host, 'granted'|'denied'>. */
    const hostCache = new Map();
    const listeners = new Set();
    /** @type {null|((purpose: string, info: any) => Promise<{allow: boolean, remember?: boolean}|null>)} */
    let asker = null;
    const notify = (purpose, value, host) => { for (const fn of Array.from(listeners)) { try { fn(purpose, value, host); } catch (err) { console.error('[consent] listener failed', err); } } };

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

    /** Whether a request is asked per host: its purpose always is, or the content chose its host (`perHost`). */
    const perHost = (purpose, info) => PER_HOST.has(purpose) || !!(info && info.perHost);
    const hostName = (host) => String(host || '').trim().toLowerCase();

    /** @returns {Promise<Map<string, 'granted'|'denied'>>} */
    async function hostMap(purpose) {
      if (hostCache.has(purpose)) return hostCache.get(purpose);
      let v = null;
      try { v = await idb.getSetting(hostsKey(purpose), null); } catch (_e) { v = null; }
      const map = new Map();
      if (v && typeof v === 'object') for (const h of Object.keys(v)) if (v[h] === 'granted' || v[h] === 'denied') map.set(h, v[h]);
      if (!hostCache.has(purpose)) hostCache.set(purpose, map);
      return hostCache.get(purpose);
    }

    /** The answer kept for one host under a purpose: 'granted', 'denied' or null (ask). */
    async function hostState(purpose, host) {
      if (override()) return 'granted';
      return (await hostMap(purpose)).get(hostName(host)) || null;
    }

    /** Keep (or with null forget) the answer for one host under a purpose. @param {string} purpose @param {string} host @param {'granted'|'denied'|null} value */
    async function setHost(purpose, host, value) {
      const map = await hostMap(purpose);
      const h = hostName(host);
      if (value === 'granted' || value === 'denied') map.set(h, value); else map.delete(h);
      const out = {};
      for (const [k, v] of map) out[k] = v;
      if (map.size) await idb.setSetting(hostsKey(purpose), out); else await idb.deleteSetting(hostsKey(purpose));
      notify(purpose, value, h);
    }

    /** The hosts answered for good under a purpose, sorted: [{host, state}]. */
    async function hosts(purpose) {
      return Array.from(await hostMap(purpose), ([host, value]) => ({ host, state: value })).sort((a, b) => a.host.localeCompare(b.host));
    }

    /** Per purpose, the end of the queue of questions: one question per purpose is open at a time. */
    const queues = new Map();
    /** The open question for a purpose and its detail (host and label): the same question asked again shares its answer. */
    const openQuestions = new Map();
    /** Per purpose, how many questions were queued, and through which of them a refusal reaches. */
    const queuedCount = new Map();
    const refusedThrough = new Map();

    /**
     * Ask about a purpose once its earlier questions are answered. `check()` reads the kept answer again first, so a remembered
     * answer settles the questions that waited for it, and `keep(value)` remembers one (for the purpose or for its hosts). A
     * one-time yes covers only its own question, so another host is asked again; a refusal of any kind (Deny, Escape, closing the
     * dialog) also refuses, unasked, the questions already waiting, since refusing fails closed and one no then ends a burst. A
     * question whose `wanted()` says no (its worker has ended) is refused without asking.
     * @param {string} purpose @param {any} info
     * @param {() => Promise<'granted'|'denied'|null>} check @param {(value: 'granted'|'denied') => Promise<void>} keep
     * @returns {Promise<boolean>} whether the question was allowed
     */
    function ask(purpose, info, check, keep) {
      // A question about several hosts is the same question only for the same hosts, whatever its shortened text says.
      const id = purpose + '\n' + (info.perHost ? 'host' : '') + '\n' + (Array.isArray(info.hosts) ? info.hosts.join(' ') : info.host || '') + '\n' + (info.label || '');
      const same = openQuestions.get(id);
      if (same) return same;
      const seq = (queuedCount.get(purpose) || 0) + 1;
      queuedCount.set(purpose, seq);
      const answer = (queues.get(purpose) || Promise.resolve()).then(async () => {
        if (seq <= (refusedThrough.get(purpose) || 0)) return false;
        const v = await check();
        if (v === 'granted') return true;
        if (v === 'denied') return false;
        if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
        if (typeof info.wanted === 'function' && !info.wanted()) return false;
        const a = await asker(purpose, info);
        if (!a || !a.allow) {
          refusedThrough.set(purpose, queuedCount.get(purpose));
          if (a && a.remember) await keep('denied');
          return false;
        }
        if (a.remember !== false) await keep('granted');
        return true;
      });
      const settled = answer.then(() => {}, () => {});
      queues.set(purpose, settled);
      openQuestions.set(id, answer);
      settled.then(() => {
        if (openQuestions.get(id) === answer) openQuestions.delete(id);
        if (queues.get(purpose) === settled) queues.delete(purpose);
      });
      return answer;
    }

    /**
     * The hosts among `list` that may be reached now under a purpose asked per host. The hosts answered for good settle
     * themselves; the others are asked about in one question that names them (`info.hosts`, `info.host` as shown), and its
     * answer, when remembered, is kept for each of them. A refused purpose allows none. With `ask: false` nothing is asked and
     * only the hosts kept for good count; without an asker every host is allowed and logged. Never rejects.
     * @param {string} purpose @param {string[]} list
     * @param {{host?: string, label?: string, wanted?: () => boolean, ask?: boolean}} [info] `host`: the hosts as the question shows them
     * @returns {Promise<Set<string>>}
     */
    async function allowHosts(purpose, list, info = {}) {
      const wantedHosts = Array.from(new Set(list.map(hostName).filter(Boolean)));
      const out = new Set();
      if (!wantedHosts.length) return out;
      if (override()) { for (const h of wantedHosts) out.add(h); return out; }
      if ((await state(purpose)) === 'denied') return out;
      const map = await hostMap(purpose);
      const open = wantedHosts.filter((h) => !map.has(h));
      let yes = false;
      if (open.length && info.ask !== false) {
        if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, open.join(', ')); yes = true; }
        else {
          // Asked in the purpose's queue: what is still open is worked out again once the questions before it are answered.
          let asked = open;
          yes = await ask(purpose, Object.assign({}, info, { perHost: true, hosts: open, host: info.host || open.join(', ') }), async () => {
            if ((await state(purpose)) === 'denied') return 'denied';
            asked = open.filter((h) => !map.has(h));
            return asked.length ? null : 'granted';
          }, async (value) => { for (const h of asked) await setHost(purpose, h, value); });
          if ((await state(purpose)) === 'denied') return out;
        }
      }
      for (const h of wantedHosts) if (map.get(h) === 'granted' || (yes && !map.has(h))) out.add(h);
      return out;
    }

    /**
     * Make sure a purpose is allowed; asks through the registered asker, one question per purpose at a time. Rejects with
     * ConsentError when the user has said no (now or earlier), or when the question is no longer wanted. With `ask: false`
     * (the marker a flow at start carries down to every fetch it makes) nothing is asked: only a consent already kept for good
     * lets it through, and otherwise it rejects with reason 'unattended'. A request asked per host (`perHost`, or a purpose such
     * as python) is settled by its host's answer instead, and a request without a host is then refused.
     * @param {string} purpose
     * @param {{host?: string, label?: string, size?: number, wanted?: () => boolean, ask?: boolean, perHost?: boolean}} [info] shown
     *   in the question; `wanted` is asked right before the question is shown
     */
    async function require(purpose, info = {}) {
      if (perHost(purpose, info)) {
        if (override()) return true;
        if (!hostName(info.host)) throw new ConsentError(purpose, 'denied');
        if ((await state(purpose)) === 'denied') throw new ConsentError(purpose, 'denied');
        const h = await hostState(purpose, info.host);
        if (h === 'granted') return true;
        if (h === 'denied') throw new ConsentError(purpose, 'denied');
        if (info.ask === false) throw new ConsentError(purpose, 'unattended');
        if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
        const one = Object.assign({}, info, { perHost: true, host: hostName(info.host) });
        const ok = await ask(purpose, one, async () => ((await state(purpose)) === 'denied' ? 'denied' : hostState(purpose, one.host)), (value) => setHost(purpose, one.host, value));
        if (!ok) throw new ConsentError(purpose, 'denied');
        return true;
      }
      const v = await state(purpose);
      if (v === 'granted') return true;
      if (v === 'denied') throw new ConsentError(purpose, 'denied');
      if (info.ask === false) throw new ConsentError(purpose, 'unattended');
      if (!asker) { D.log('consent', 'no asker registered; allowing', purpose, info.host || ''); return true; }
      if (!(await ask(purpose, info, () => state(purpose), (value) => set(purpose, value)))) throw new ConsentError(purpose, 'denied');
      return true;
    }

    /** The UI's question (a dialog); returns {allow, remember}. */
    function setAsker(fn) { asker = fn; }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return String(url || ''); } };

    return { PURPOSES, PER_HOST, state, set, all, require, allowHosts, hostState, setHost, hosts, setAsker, subscribe, hostOf, override, ConsentError };
  });
})();
