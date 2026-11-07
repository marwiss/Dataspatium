// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Files that belong to a dataset (the originals of a document collection, the previews and thumbnails of an
 * image collection), kept in the dataset's own SQLite file in the table `_files` (name, kind, type, size, bytes),
 * so that versions, bundles, GitHub and devices carry them without any extra plumbing. Object URLs are cached per
 * dataset for the views and dropped when the dataset changes or goes away.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/dataset-files', ['data/datasets'], (datasets) => {
    const TABLE = '_files';
    const FIELDS = ['name', 'kind', 'type', 'size', 'bytes'];
    /** @type {Map<string, Map<string, string>>} dataset id -> (kind/name -> object URL) */
    const urls = new Map();

    async function ensureTable(engine) {
      await engine.run(`create table if not exists ${TABLE} (name text, kind text, type text, size integer, bytes blob, primary key (name, kind))`);
    }

    /**
     * Store files in a dataset being imported (or an open handle).
     * @param {{engine: any}} handle @param {Array<{name: string, kind?: string, type?: string, bytes: Uint8Array}>} files
     */
    async function put(handle, files) {
      await ensureTable(handle.engine);
      const rows = files.map((f) => [f.name, f.kind || 'original', f.type || 'application/octet-stream', f.bytes.byteLength, f.bytes]);
      for (let i = 0; i < rows.length; i += 20) await handle.engine.insertRows(TABLE, FIELDS, rows.slice(i, i + 20), 20);
      return rows.length;
    }

    async function hasTable(engine) {
      const r = await engine.exec(`select name from sqlite_master where type = 'table' and name = '${TABLE}'`);
      return !!(r[0] && r[0].values.length);
    }

    /** The files of a dataset (without their bytes). @returns {Promise<Array<{name: string, kind: string, type: string, size: number}>>} */
    async function list(id, kind) {
      const handle = await datasets.ensureOpen(id);
      if (!(await hasTable(handle.engine))) return [];
      const r = await handle.engine.exec(`select name, kind, type, size from ${TABLE}${kind ? ` where kind = '${String(kind).replace(/'/g, "''")}'` : ''} order by name`);
      return (r[0] ? r[0].values : []).map((row) => ({ name: String(row[0]), kind: String(row[1]), type: String(row[2]), size: Number(row[3]) || 0 }));
    }

    /** The bytes of one file, or null. @returns {Promise<{bytes: Uint8Array, type: string}|null>} */
    async function read(id, name, kind = 'original') {
      const handle = await datasets.ensureOpen(id);
      if (!(await hasTable(handle.engine))) return null;
      const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
      const r = await handle.engine.exec(`select bytes, type from ${TABLE} where name = ${q(name)} and kind = ${q(kind)}`);
      const row = r[0] && r[0].values[0];
      if (!row || !row[0]) return null;
      const raw = row[0];
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      return { bytes, type: String(row[1] || 'application/octet-stream') };
    }

    /** An object URL for a file, cached until the dataset changes; null when the file is missing. */
    async function url(id, name, kind = 'original') {
      const key = kind + '/' + name;
      let map = urls.get(id);
      if (map && map.has(key)) return map.get(key);
      const file = await read(id, name, kind);
      if (!file) return null;
      const u = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
      if (!map) { map = new Map(); urls.set(id, map); }
      map.set(key, u);
      return u;
    }

    function clearUrls(id) {
      const map = urls.get(id);
      if (!map) return;
      for (const u of map.values()) { try { URL.revokeObjectURL(u); } catch (_err) { /* ignore */ } }
      urls.delete(id);
    }

    datasets.subscribe((type, payload) => {
      if ((type === 'deleted' || type === 'changed' || type === 'replaced') && payload && payload.id) clearUrls(payload.id);
    });

    /**
     * Create a dataset of a collection kind (document, images) with its rows, files and extra metadata in one go.
     * @param {{name: string, kind: string, columns: any[], rows: any[][], files?: any[], source?: any, description?: string, meta?: Record<string, any>, importOptions?: any}} input
     */
    async function createDataset(input) {
      const handle = await datasets.createEmpty({ name: input.name, columns: input.columns, kind: input.kind, source: input.source || null, description: input.description || '', importOptions: input.importOptions || null });
      try {
        for (let i = 0; i < input.rows.length; i += 2000) await datasets.appendImportRows(handle, input.rows.slice(i, i + 2000));
        if (input.files && input.files.length) await put(handle, input.files);
        for (const [key, value] of Object.entries(input.meta || {})) {
          handle.meta[key] = value;
          await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', [key, JSON.stringify(value)]);
        }
        return await datasets.finishImport(handle, {});
      } catch (err) {
        datasets.abortImport(handle);
        throw err;
      }
    }

    return { TABLE, ensureTable, put, list, read, url, clearUrls, hasTable, createDataset };
  });
})();
