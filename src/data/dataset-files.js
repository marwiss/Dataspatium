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
  D.define('data/dataset-files', ['data/datasets', 'data/types'], (datasets, types) => {
    const TABLE = '_files';
    const FIELDS = ['name', 'kind', 'type', 'size', 'bytes'];
    /**
     * The roles of a plan delivery's files (data/plan-delivery), kept as their `kind`: the plan map and other GeoPackages, the text
     * document and its appendices, the delivery's manifest and metadata, and anything else that came with it.
     */
    const ROLES = ['plankarta', 'underlag', 'textdokument', 'bilaga', 'manifest', 'metadata', 'ovrigt'];
    /** The sorts of files that are originals, as they came: everything but what the app made itself (previews, thumbnails). */
    const ORIGINAL_KINDS = ['original'].concat(ROLES);
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

    /**
     * The names of the files that a dataset's table still lists in a column (a raster's `fil`): the table is the list of the files,
     * so a row removed there takes its file off the map and out of the exports. Null when the table has no such column.
     * @param {string} id @param {string} [column] @returns {Promise<Set<string>|null>}
     */
    async function listed(id, column = 'fil') {
      const handle = await datasets.ensureOpen(id);
      if (!handle.columns.some((c) => c.name === column)) return null;
      const c = datasets.quoteIdent(column);
      const r = await handle.engine.exec(`select distinct ${c} from data where ${c} is not null`);
      return new Set((r[0] ? r[0].values : []).map((row) => String(row[0])));
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

    /** The files that may open in a tab of their own: the name's ending, the type the tab gets and the file's first bytes. */
    const TAB_TYPES = [
      { ending: /\.pdf$/i, type: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
      { ending: /\.png$/i, type: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { ending: /\.jpe?g$/i, type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
    ];
    /**
     * The type with which a dataset's file may open in a tab of its own, or '' when it is to be downloaded instead: only a PDF,
     * PNG or JPEG file, and only when the name's ending and the first bytes agree. The stored type is never used for it: a
     * package, a picked folder or a received dataset can name any type, and the tab (a blob: address) has the app's origin, where
     * an HTML, SVG or XML page could run script. Without bytes the name alone gives the type a button can promise.
     * @param {string} name @param {Uint8Array} [bytes] @returns {string}
     */
    function tabType(name, bytes) {
      const kind = TAB_TYPES.find((k) => k.ending.test(String(name || '')));
      if (!kind) return '';
      if (bytes === undefined) return kind.type;
      return ArrayBuffer.isView(bytes) && kind.magic.every((b, i) => /** @type {any} */ (bytes)[i] === b) ? kind.type : '';
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
     * Create (or empty) a side table of a dataset and fill it: `columns` as [{name, type}] with the types of data/types.
     * @param {{engine: any}} handle @param {{name: string, columns: Array<{name: string, type: string}>, rows: any[][], index?: string[]}} table
     */
    async function writeTable(handle, table) {
      const q = datasets.quoteIdent;
      await handle.engine.run(`drop table if exists ${q(table.name)}`);
      await handle.engine.run(`create table ${q(table.name)} (${table.columns.map((c) => `${q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`);
      for (const column of table.index || []) await handle.engine.run(`create index if not exists ${q(table.name + '_' + column)} on ${q(table.name)} (${q(column)})`);
      const names = table.columns.map((c) => c.name);
      for (let i = 0; i < table.rows.length; i += 2000) await handle.engine.insertRows(table.name, names, table.rows.slice(i, i + 2000));
    }

    /**
     * Create a dataset of a collection kind (document, images) with its rows, files and extra metadata in one go.
     * Side tables (`tables`, see writeTable) are made before the metadata.
     * @param {{name: string, kind: string, columns: any[], rows: any[][], files?: any[], tables?: any[], source?: any, description?: string, meta?: Record<string, any>, importOptions?: any}} input
     */
    async function createDataset(input) {
      const handle = await datasets.createEmpty({ name: input.name, columns: input.columns, kind: input.kind, source: input.source || null, description: input.description || '', importOptions: input.importOptions || null });
      try {
        for (let i = 0; i < input.rows.length; i += 2000) await datasets.appendImportRows(handle, input.rows.slice(i, i + 2000));
        if (input.files && input.files.length) await put(handle, input.files);
        for (const table of input.tables || []) await writeTable(handle, table);
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

    return { TABLE, ROLES, ORIGINAL_KINDS, ensureTable, put, list, read, listed, url, tabType, clearUrls, hasTable, writeTable, createDataset };
  });
})();
