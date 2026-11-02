// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Main-thread client for the SQLite worker. One engine instance holds one open database.
 * Databases are plain SQLite files (ArrayBuffer) that can be stored in IndexedDB, downloaded, or
 * handed to R (RSQLite) through webR's virtual filesystem.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/sqlite', ['engines/sqlite/worker-source'], (workerFn) => {
    D.workers.provider('sqljs', { initial: async () => D.assets.names('sqljs/') });

    class SqliteEngine {
      constructor() {
        /** @type {any} */
        this.worker = null;
        this.seq = 0;
        /** @type {Map<number, {resolve: Function, reject: Function}>} */
        this.pending = new Map();
      }

      /** Start the worker (idempotent). */
      async start() {
        if (this.worker) return;
        this.worker = D.workers.create({ namespace: 'sqljs', source: D.workers.functionSource(workerFn) });
        this.worker.onmessage = (ev) => {
          const m = ev.data;
          const p = this.pending.get(m.id);
          if (!p) return;
          this.pending.delete(m.id);
          if (m.ok) p.resolve(m.value); else p.reject(new Error(m.error));
        };
        this.worker.onerror = (ev) => {
          const err = new Error('SQLite worker error: ' + (ev.message || 'unknown'));
          for (const p of this.pending.values()) p.reject(err);
          this.pending.clear();
        };
      }

      /** @returns {Promise<any>} */
      call(op, args, transfer) {
        if (!this.worker) throw new Error('SqliteEngine not started');
        return new Promise((resolve, reject) => {
          const id = ++this.seq;
          this.pending.set(id, { resolve, reject });
          this.worker.postMessage({ id, op, args }, transfer || []);
        });
      }

      /** Open a database from bytes, or a new empty one. @param {ArrayBuffer} [bytes] */
      open(bytes) { return this.call('open', { bytes }, bytes ? [bytes] : []); }
      /** @returns {Promise<Array<{columns: string[], values: any[][]}>>} */
      exec(sql, params) { return this.call('exec', { sql, params }); }
      /** @returns {Promise<number>} rows modified */
      run(sql, params) { return this.call('run', { sql, params }); }
      /**
       * Bulk insert rows (arrays in column order), in chunks to bound message size.
       * @param {string} table @param {string[]} columns @param {any[][]} rows
       */
      async insertRows(table, columns, rows, chunk = 20000) {
        let inserted = 0;
        for (let i = 0; i < rows.length; i += chunk) {
          inserted += await this.call('insertRows', { table, columns, rows: rows.slice(i, i + chunk) });
        }
        return inserted;
      }
      /**
       * Set one column for many rows: pairs of [rowid, value].
       * @param {string} table @param {string} column @param {Array<[number, any]>} pairs
       */
      async updateRows(table, column, pairs, chunk = 20000) {
        let updated = 0;
        for (let i = 0; i < pairs.length; i += chunk) {
          updated += await this.call('updateRows', { table, column, pairs: pairs.slice(i, i + chunk) });
        }
        return updated;
      }
      /** Run several statements atomically. @param {Array<string|{sql: string, params?: any[]}>} statements */
      execMany(statements) { return this.call('execMany', { statements }); }
      /** @returns {Promise<ArrayBuffer>} the database file */
      export() { return this.call('export'); }
      /** @returns {Promise<string>} */
      version() { return this.call('version'); }
      close() { return this.call('close'); }
      terminate() { if (this.worker) this.worker.terminate(); this.worker = null; this.pending.clear(); }
    }
    return { SqliteEngine };
  });
})();
