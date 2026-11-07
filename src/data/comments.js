// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Comments on a dataset, on one of its columns or on one of its objects (a page, a picture, a node, an element). They are kept in the dataset's SQLite file (table `_comments`), so
 * they travel with backups, shared bundles, the portable folder and GitHub sync. The author is the name the user
 * gives (setting `user.name`, empty by default); nothing else about the user is stored.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/comments', ['data/datasets', 'platform/storage/idb'], (datasets, idb) => {
    const AUTHOR = 'user.name';
    const SCHEMA = 'create table if not exists _comments (id text primary key, ts text, author text, text text, column_name text, resolved integer default 0, target text)';
    const MAX_TEXT = 4000;

    /** The name shown with comments and in shared bundles ('' when none is given). */
    async function author() { return String((await idb.getSetting(AUTHOR, '')) || ''); }
    /** @param {string} name */
    async function setAuthor(name) { await idb.setSetting(AUTHOR, String(name || '').trim().slice(0, 80)); }

    /** The table of an open dataset, made ready. Files from before comments could be about an object lack the column `target`. */
    async function prepare(handle) {
      await handle.engine.run(SCHEMA);
      const known = await handle.engine.exec('pragma table_info(_comments)');
      if (!known[0].values.some((r) => r[1] === 'target')) await handle.engine.run('alter table _comments add column target text');
    }
    /** The step in flight per dataset: two callers at once (the status bar and a view) would both find the column missing, and the second ALTER would fail. */
    const preparing = new WeakMap();
    async function open(id) {
      const handle = await datasets.ensureOpen(id);
      let step = preparing.get(handle);
      if (!step) {
        step = prepare(handle).finally(() => preparing.delete(handle));
        preparing.set(handle, step);
      }
      await step;
      return handle;
    }

    function parseTarget(text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (_err) { return null; }
    }

    /**
     * The comments of a dataset, oldest first.
     * @param {string} id
     * @returns {Promise<Array<{id: string, ts: string, author: string, text: string, column: string|null, resolved: boolean, target: any}>>}
     */
    async function list(id) {
      const handle = await open(id);
      const res = await handle.engine.exec('select id, ts, author, text, column_name, resolved, target from _comments order by ts, rowid');
      return (res[0] ? res[0].values : []).map((r) => ({ id: r[0], ts: r[1], author: r[2] || '', text: r[3] || '', column: r[4] || null, resolved: !!r[5], target: parseTarget(r[6]) }));
    }

    /**
     * Add a comment to the dataset (or to one of its columns); it is also noted in the dataset's history.
     * @param {string} id
     * @param {{text: string, column?: string|null, author?: string, target?: {key: string, label: string, open: any}}} input author defaults to the saved name
     */
    async function add(id, input) {
      const text = String(input.text || '').trim().slice(0, MAX_TEXT);
      if (!text) throw new Error(D.t('comments.err.empty'));
      const handle = await open(id);
      const column = input.column || null;
      if (column && !handle.columns.some((c) => c.name === column)) throw new Error(D.t('op.err.unknown.column', { name: column }));
      const comment = {
        id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        ts: new Date().toISOString(),
        author: input.author !== undefined ? String(input.author).trim().slice(0, 80) : await author(),
        text, column, resolved: false, target: input.target || null,
      };
      await handle.engine.run('insert into _comments (id, ts, author, text, column_name, resolved, target) values (?, ?, ?, ?, ?, 0, ?)', [comment.id, comment.ts, comment.author, comment.text, comment.column, comment.target ? JSON.stringify(comment.target) : null]);
      await datasets.appendLog(handle, 'comment', { id: comment.id, author: comment.author, column, text: text.length > 120 ? text.slice(0, 119) + '…' : text });
      datasets.scheduleSave(id);
      return comment;
    }

    /** @param {string} id @param {string} commentId @param {boolean} resolved */
    async function setResolved(id, commentId, resolved) {
      const handle = await open(id);
      await handle.engine.run('update _comments set resolved = ? where id = ?', [resolved ? 1 : 0, commentId]);
      datasets.scheduleSave(id);
    }

    /** @param {string} id @param {string} commentId */
    async function remove(id, commentId) {
      const handle = await open(id);
      await handle.engine.run('delete from _comments where id = ?', [commentId]);
      datasets.scheduleSave(id);
    }

    return { list, add, setResolved, remove, author, setAuthor };
  });
})();
