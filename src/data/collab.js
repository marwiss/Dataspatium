// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Working together through a repository: what was fetched is compared with what is here by the two histories. Comments and notes
 * from both sides are always kept. When only one side has changed the data that side wins, and when both have, both versions are
 * kept until the user has chosen. Comments written by others are counted as unread until they have been looked at.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/collab', ['data/datasets', 'data/comments', 'platform/storage/idb'], (datasets, comments, idb) => {
    const UNREAD = 'collab.unread';
    /** Entries in the history that say something about the data without changing it. */
    const SOCIAL = new Set(['comment', 'shared', 'received']);
    const keyOf = (entry) => `${entry.ts}|${entry.action}|${JSON.stringify(entry.details)}`;
    const stepsOf = (log) => log.filter((e) => !SOCIAL.has(e.action)).map(keyOf);
    const startsWith = (list, start) => start.every((key, i) => list[i] === key);
    const listeners = new Set();

    /** The bytes of a dataset in what was fetched. */
    function bytesIn(fetched, id) {
      const path = Object.keys(fetched.entries).find((p) => p.toLowerCase() === `datasets/${id.toLowerCase()}.sqlite`);
      const bytes = fetched.entries[path];
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    /** What a version holds besides its rows, read from a temporary copy. */
    async function sideOf(buffer) {
      const copy = await datasets.importBytes(buffer, {}, { quiet: true });
      try { return { log: await datasets.log(copy.id), comments: await comments.list(copy.id) }; } finally { await datasets.remove(copy.id, { quiet: true }); }
    }
    /**
     * Which side has changed: `same` nothing to do, `comments` only comments and notes differ, `theirs` or `mine` only that side
     * has changed the data, `both` both have.
     * @param {any[]} mine the history here @param {any[]} theirs the fetched history @returns {'same'|'comments'|'theirs'|'mine'|'both'}
     */
    function compare(mine, theirs) {
      const a = stepsOf(mine); const b = stepsOf(theirs);
      if (a.length === b.length && startsWith(a, b)) {
        const seen = new Set(mine.map(keyOf));
        return theirs.every((e) => seen.has(keyOf(e))) && mine.length === theirs.length ? 'same' : 'comments';
      }
      if (startsWith(b, a)) return 'theirs';
      if (startsWith(a, b)) return 'mine';
      return 'both';
    }
    /**
     * What fetching would do to the datasets that are here already.
     * @param {{entries: Record<string, Uint8Array>, existing: Array<{id: string, name: string, local: string}>}} fetched
     * @returns {Promise<Array<{id: string, name: string, local: string, status: string, newComments: number, steps: {mine: number, theirs: number}}>>}
     */
    async function plan(fetched) {
      const out = [];
      for (const d of fetched.existing || []) {
        const theirs = await sideOf(bytesIn(fetched, d.id));
        const mineLog = await datasets.log(d.id);
        const mine = new Set((await comments.list(d.id)).map((c) => c.id));
        const status = compare(mineLog, theirs.log);
        const common = (a, b) => { let n = 0; while (n < a.length && a[n] === b[n]) n++; return n; };
        const a = stepsOf(mineLog); const b = stepsOf(theirs.log);
        const shared = common(a, b);
        out.push(Object.assign({}, d, { status, newComments: theirs.comments.filter((c) => !mine.has(c.id)).length, steps: { mine: a.length - shared, theirs: b.length - shared } }));
      }
      return out;
    }
    /** Comments and notes from the other side go in beside these. Returns the comments that were new here. */
    async function mergeSide(id, side) {
      const handle = await datasets.ensureOpen(id);
      const here = await comments.list(id);
      const known = new Map(here.map((c) => [c.id, c]));
      const added = [];
      for (const c of side.comments) {
        const mine = known.get(c.id);
        if (mine) {
          if (c.resolved && !mine.resolved) await comments.setResolved(id, c.id, true);
          continue;
        }
        await handle.engine.run('insert into _comments (id, ts, author, text, column_name, resolved, target) values (?, ?, ?, ?, ?, ?, ?)', [c.id, c.ts, c.author, c.text, c.column, c.resolved ? 1 : 0, c.target ? JSON.stringify(c.target) : null]);
        added.push(c);
      }
      const logged = new Set((await datasets.log(id)).map(keyOf));
      const notes = side.log.filter((e) => SOCIAL.has(e.action) && !logged.has(keyOf(e)));
      if (notes.length) await handle.engine.insertRows('_log', ['ts', 'action', 'details'], notes.map((e) => [e.ts, e.action, JSON.stringify(e.details)]));
      return added;
    }
    /**
     * Carry out a plan. `choices` says for each dataset where both have changed: `both` keeps a copy of theirs beside mine (the
     * default), `mine` keeps mine, `theirs` takes theirs and leaves mine as a version to go back to.
     * @param {any} fetched @param {any[]} planned from plan() @param {Record<string, 'both'|'mine'|'theirs'>} [choices]
     * @param {{from?: string}} [options] who the fetched version comes from
     * @returns {Promise<{comments: number, replaced: any[], copies: any[], kept: any[]}>}
     */
    async function apply(fetched, planned, choices = {}, options = {}) {
      const me = await comments.author();
      const unread = await unreadCounts();
      const result = { comments: 0, replaced: [], copies: [], kept: [] };
      for (const item of planned) {
        if (item.status === 'same') continue;
        const buffer = bytesIn(fetched, item.id);
        const choice = item.status === 'both' ? (choices[item.id] || 'both') : item.status;
        const theirs = await sideOf(buffer);
        let added = [];
        if (choice === 'theirs') {
          const mine = { log: await datasets.log(item.id), comments: await comments.list(item.id) };
          const before = new Set(mine.comments.map((c) => c.id));
          await datasets.snapshot(item.id, D.t('collab.version.mine', { from: options.from || D.t('comments.anonymous') }));
          await datasets.replaceBytes(item.id, buffer, null);
          await mergeSide(item.id, mine);
          added = theirs.comments.filter((c) => !before.has(c.id));
          result.replaced.push(await datasets.get(item.id));
        } else {
          added = await mergeSide(item.id, theirs);
          if (choice === 'both') {
            const copy = await datasets.importBytes(buffer, { name: D.t('collab.copy.name', { name: item.local, from: options.from || D.t('comments.anonymous') }) });
            await datasets.appendLog(await datasets.ensureOpen(copy.id), 'received', { name: options.from || '', author: options.from || '' });
            await datasets.save(copy.id);
            result.copies.push(copy);
          } else if (item.status === 'both') result.kept.push(item);
          await datasets.save(item.id);
          datasets.notify('changed', { id: item.id });
        }
        const foreign = added.filter((c) => c.author !== me);
        if (foreign.length) unread[item.id] = (unread[item.id] || 0) + foreign.length;
        result.comments += added.length;
      }
      await setUnread(unread);
      return result;
    }

    /** @returns {Promise<Record<string, number>>} */
    async function unreadCounts() { return Object.assign({}, await idb.getSetting(UNREAD, {})); }
    async function setUnread(counts) {
      await idb.setSetting(UNREAD, counts);
      for (const fn of listeners) { try { fn(); } catch (err) { D.log('collab', err); } }
    }
    /**
     * Comments not yet looked at, over the datasets that still exist.
     * @returns {Promise<{total: number, first: string|null, counts: Record<string, number>}>}
     */
    async function unread() {
      const counts = await unreadCounts();
      const have = new Set((await datasets.list()).map((m) => m.id));
      const ids = Object.keys(counts).filter((id) => counts[id] > 0 && have.has(id));
      return { total: ids.reduce((n, id) => n + counts[id], 0), first: ids[0] || null, counts };
    }
    /** The comments of a dataset have been looked at. @param {string} id */
    async function markRead(id) {
      const counts = await unreadCounts();
      if (!counts[id]) return;
      delete counts[id];
      await setUnread(counts);
    }
    /** @param {() => void} fn @returns {() => void} */
    function onUnread(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    return { compare, plan, apply, unread, markRead, onUnread };
  });
})();
