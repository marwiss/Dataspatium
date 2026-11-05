// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataset service: one SQLite file per dataset, held in a sql.js worker while open and persisted to
 * IndexedDB. Each file has four tables:
 *   data       the rows, one column per dataset column
 *   _columns   position, name, type, label, format, source_name
 *   _meta      key/value: id, name, description, createdAt, updatedAt, rowCount, columnCount, source, importOptions
 *   _log       ts, action, details (JSON) – the operations log that later becomes "recept"
 * The same file is what R reads through RSQLite, so the schema is the contract between JS and R.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/datasets', ['engines/sqlite', 'platform/storage/idb', 'data/types', 'platform/sync'], (sqlite, idb, types, sync) => {
    /** @type {Map<string, {engine: any, meta: any, columns: any[]}>} */
    const openHandles = new Map();
    const listeners = new Set();
    const META_KEYS = ['id', 'name', 'shortName', 'description', 'createdAt', 'updatedAt', 'rowCount', 'columnCount', 'source', 'importOptions', 'rules', 'folder', 'tags', 'kind'];
    /** Metadata of the dataset kinds (set by their importers), restored with the file on undo and version restore. */
    const KIND_META_KEYS = ['graph', 'plan', 'documents', 'images', 'model', 'models', 'field', 'facets'];
    /** Kinds of datasets: what the file holds and which views apply. Only 'table' exists until later 2.x releases. */
    const KINDS = ['table', 'graph', 'document', 'images', 'model', 'plan'];

    // ---- folders and tags: how the dataset list is organised; stored in _meta, so they travel with the file ----
    /** A folder path: segments separated by "/", trimmed, without empty segments; '' is the root. */
    function normalizeFolder(path) {
      return String(path || '').split('/').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean).join('/').slice(0, 200);
    }
    /** Tags: trimmed, non-empty and unique, in the given order; a string is split on commas. */
    function normalizeTags(tags) {
      const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
      const out = [];
      for (const raw of list) {
        const tag = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (tag && !out.includes(tag)) out.push(tag);
      }
      return out;
    }
    /** Every folder path in use by the given datasets, parents included, sorted. */
    function folderPaths(list) {
      const set = new Set();
      for (const d of list) {
        const segs = normalizeFolder(d.folder).split('/').filter(Boolean);
        for (let i = 1; i <= segs.length; i++) set.add(segs.slice(0, i).join('/'));
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    // ---- short names: an identifier per dataset for SQL across datasets, dm_read() in R and chart files ----
    /** Hard limit for a short name (user-typed) and the target length for derived ones. */
    const SHORT_MAX = 20;
    const SHORT_TARGET = 15;
    const SHORT_NAME = /^[a-z][a-z0-9_]{0,19}$/;
    /** Words that may be used neither as SQL identifiers (SQLite keywords, our own tables) nor as R names. */
    const RESERVED_SHORT = new Set(['data', 'main', 'temp', 'df', 'rowid', 'sqlite_master', 'sqlite_schema', 'sqlite_sequence', 'select', 'from', 'where', 'table', 'index', 'view', 'join', 'on', 'as', 'and', 'or', 'not', 'null', 'order', 'group', 'by', 'limit', 'offset', 'union', 'all', 'distinct', 'case', 'when', 'then', 'else', 'end', 'in', 'is', 'like', 'between', 'exists', 'having', 'values', 'insert', 'update', 'delete', 'set', 'into', 'create', 'drop', 'alter', 'with', 'using', 'left', 'right', 'inner', 'outer', 'cross', 'natural', 'true', 'false',
      'default', 'primary', 'key', 'references', 'check', 'constraint', 'column', 'add', 'rename', 'to', 'escape', 'glob', 'regexp', 'match', 'collate', 'cast', 'pragma', 'explain', 'begin', 'commit', 'rollback', 'transaction', 'replace', 'attach', 'detach', 'database', 'temporary', 'trigger', 'vacuum', 'reindex', 'analyze', 'recursive', 'window', 'over', 'partition', 'filter', 'if', 'repeat', 'while', 'function', 'for', 'next', 'break', 'inf', 'nan', 'na']);
    /** Filler words dropped when a short name is derived (Swedish, Danish, Norwegian, Finnish, Icelandic, English). */
    const STOP_WORDS = new Set(['per', 'och', 'av', 'i', 'for', 'fran', 'med', 'till', 'pa', 'om', 'en', 'ett', 'og', 'af', 'fra', 'ved', 'et', 'ja', 'tai', 'mukaan', 'eftir', 'a', 'ad', 'um', 'the', 'of', 'and', 'in', 'by', 'to', 'at', 'an']);
    /** ASCII folding of a dataset name into lower-case words (å ä → a, ö ø → o, æ → ae, þ → th, ð → d, accents removed). */
    function asciiWords(name) {
      let s = String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/þ/g, 'th').replace(/ð/g, 'd');
      s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return s.split(/[^a-z0-9]+/).filter(Boolean);
    }
    /**
     * A short name derived from a dataset name: lower-case ASCII letters, digits and underscores, starting
     * with a letter, normally within SHORT_TARGET characters. Filler words are dropped, words are added while
     * they fit and a year is kept as a suffix ("Befolkning per kommun 2024" becomes "befolkning_2024"). A first
     * word that is longer than the room left is kept whole when the result stays within SHORT_MAX
     * ("arbetsloshet_2020"), otherwise cut.
     */
    function shortNameFrom(name) {
      const words = asciiWords(name);
      const content = words.filter((w) => !STOP_WORDS.has(w));
      const pool = content.length ? content : words;
      const isYear = (w) => /^(1[89]|20)\d\d$/.test(w);
      const year = pool.find(isYear) || '';
      const rest = pool.filter((w) => !isYear(w));
      const room = SHORT_TARGET - (year ? year.length + 1 : 0);
      let s = '';
      for (const w of rest) {
        const cand = s ? s + '_' + w : w;
        if (cand.length <= room) s = cand; else break;
      }
      if (!s && rest.length) {
        const first = rest[0];
        s = first.length + (year ? year.length + 1 : 0) <= SHORT_MAX ? first : first.slice(0, Math.max(3, room));
      }
      if (year) s = s ? s + '_' + year : year;
      if (!s) s = 'datamangd';
      if (!/^[a-z]/.test(s)) s = ('d_' + s).slice(0, SHORT_MAX);
      if (RESERVED_SHORT.has(s)) s = s.slice(0, SHORT_MAX - 2) + '_1';
      return s;
    }
    /** A short name not used by any other dataset (suffix _2, _3, ... when needed). */
    async function uniqueShortName(base, excludeId) {
      const taken = new Set((await list()).filter((d) => d.id !== excludeId).map((d) => d.shortName).filter(Boolean));
      const root = SHORT_NAME.test(String(base || '')) && !RESERVED_SHORT.has(base) ? base : shortNameFrom(base);
      if (!taken.has(root)) return root;
      for (let i = 2; ; i++) {
        const suffix = '_' + i;
        const cand = root.slice(0, SHORT_MAX - suffix.length).replace(/_+$/g, '') + suffix;
        if (!taken.has(cand)) return cand;
      }
    }
    /** Normalise and check a user-typed short name; throws a message in the UI language when it cannot be used. */
    function validateShortName(value) {
      const s = String(value || '').trim().toLowerCase();
      if (!SHORT_NAME.test(s)) throw new Error(D.t('datasets.shortname.invalid'));
      if (RESERVED_SHORT.has(s)) throw new Error(D.t('datasets.shortname.reserved', { name: s }));
      return s;
    }
    /** Give datasets from older versions a short name (stored in the IndexedDB record; the file follows on the next save). */
    async function ensureShortNames() {
      const all = await list();
      let changed = 0;
      for (const record of all) {
        if (record.shortName) continue;
        const shortName = await uniqueShortName(record.name, record.id);
        await idb.putDataset(Object.assign({}, record, { shortName }));
        const open = openHandles.get(record.id);
        if (open) open.meta.shortName = shortName;
        changed++;
      }
      return changed;
    }

    const q = (ident) => '"' + String(ident).replace(/"/g, '""') + '"';
    function newId() { return 'ds_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function notify(type, payload) { for (const fn of listeners) { try { fn(type, payload); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    async function newEngine(bytes) {
      const engine = new sqlite.SqliteEngine();
      await engine.start();
      await engine.open(bytes);
      return engine;
    }

    function metaToRows(meta) {
      return META_KEYS.filter((k) => meta[k] !== undefined).map((k) => [k, typeof meta[k] === 'string' ? meta[k] : JSON.stringify(meta[k] === undefined ? null : meta[k])]);
    }
    function rowsToMeta(rows) {
      const meta = {};
      for (const [k, v] of rows) {
        if (k === 'rowCount' || k === 'columnCount' || k === 'source' || k === 'importOptions' || k === 'rules' || k === 'tags' || KIND_META_KEYS.includes(k)) { try { meta[k] = JSON.parse(v); } catch (_e) { meta[k] = v; } }
        else meta[k] = v;
      }
      return meta;
    }

    /**
     * Create a dataset from parsed rows.
     * @param {{name: string, columns: Array<{name: string, type: string, label?: string, sourceName?: string}>, rows: any[][], source?: any, importOptions?: any, description?: string}} input
     */
    async function create(input) {
      const handle = await createEmpty(input);
      await appendImportRows(handle, input.rows);
      return finishImport(handle);
    }

    /**
     * Create the tables of a new dataset without rows, for chunked imports: follow with appendImportRows()
     * per chunk and finishImport() (or abortImport() on failure). The dataset is not listed, saved
     * or announced until finishImport().
     * @param {{name: string, columns: Array<{name: string, type: string, label?: string, sourceName?: string}>, source?: any, importOptions?: any, description?: string}} input
     */
    async function createEmpty(input) {
      const id = newId();
      const engine = await newEngine();
      const names = types.cleanColumnNames(input.columns.map((c) => c.name));
      const columns = input.columns.map((c, i) => ({ position: i, name: names[i], type: c.type || 'text', label: c.label || names[i], format: null, sourceName: c.sourceName || c.name, description: c.description || null, unit: c.unit || null, valueLabels: normaliseValueLabels(c.valueLabels) }));
      await engine.run(`create table data (${columns.map((c) => `${q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`);
      await engine.run(`create table _columns (${COLUMN_FIELDS.map((f) => `${f} ${f === 'position' ? 'integer' : 'text'}`).join(', ')})`);
      await engine.run('create table _meta (key text primary key, value text)');
      await engine.run('create table _log (ts text, action text, details text)');
      await engine.insertRows('_columns', COLUMN_FIELDS, columns.map(columnRow));
      const now = new Date().toISOString();
      const shortName = await uniqueShortName(input.shortName || input.name || 'datamangd');
      const meta = {
        id, name: input.name || D.t('datasets.untitled'), shortName, description: input.description || '', createdAt: now, updatedAt: now,
        rowCount: 0, columnCount: columns.length, source: input.source || null, importOptions: input.importOptions || null,
        folder: normalizeFolder(input.folder), tags: normalizeTags(input.tags), kind: KINDS.includes(input.kind) ? input.kind : 'table',
      };
      await engine.insertRows('_meta', ['key', 'value'], metaToRows(meta));
      const handle = { engine, meta, columns, importing: true };
      openHandles.set(id, handle);
      return handle;
    }

    /** Insert a chunk of rows (arrays in column order) into a dataset being imported (see createEmpty). */
    async function appendImportRows(handle, rows) {
      if (!rows || !rows.length) return 0;
      await handle.engine.insertRows('data', handle.columns.map((c) => c.name), rows);
      return rows.length;
    }

    /** Complete a chunked import: counts, log, first save and the 'created' event. */
    async function finishImport(handle, extra = {}) {
      delete handle.importing;
      await refreshCounts(handle);
      if (extra.importOptions) {
        handle.meta.importOptions = extra.importOptions;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['importOptions', JSON.stringify(extra.importOptions)]);
      }
      await appendLog(handle, 'import', Object.assign({ source: handle.meta.source, rows: handle.meta.rowCount, columns: handle.columns.map((c) => ({ name: c.name, type: c.type })) }, extra.streamed ? { streamed: true } : {}));
      await persist(handle);
      notify('created', handle.meta);
      sync.broadcast('datasets', 'created', { id: handle.meta.id, name: handle.meta.name });
      return handle.meta;
    }

    /** Abandon a chunked import after an error or cancellation: nothing was saved. */
    function abortImport(handle) {
      try { handle.engine.terminate(); } catch (_err) { /* ignore */ }
      openHandles.delete(handle.meta.id);
    }

    async function persist(handle) {
      // One tab at a time writes a given dataset file (Web Locks when available).
      return sync.withLock('ds:' + handle.meta.id, async () => {
        const snapshot = () => Object.assign({}, handle.meta, { columns: handle.columns.map((c) => ({ name: c.name, type: c.type, label: c.label })) });
        if (handle.removed) return snapshot(); // removed while waiting for the lock
        const bytes = await handle.engine.export();
        handle.meta.byteSize = bytes.byteLength;
        const record = snapshot();
        await idb.saveBlob('ds:' + handle.meta.id, bytes);
        // Removed meanwhile: the catalogue entry must not come back without its file.
        if (handle.removed) return record;
        await idb.putDataset(record);
        return record;
      });
    }

    // Other tabs: drop stale in-memory copies of datasets they saved or removed, then let the UI reload its lists.
    sync.on((msg) => {
      if (msg.kind !== 'datasets') return;
      const id = msg.payload && msg.payload.id;
      if (id && (msg.action === 'saved' || msg.action === 'deleted') && openHandles.has(id)) {
        if (saveTimers.has(id)) D.log('datasets', 'remote change to a dataset with unsaved edits here; the last save wins', id);
        else close(id);
      }
      notify('remote', Object.assign({ action: msg.action }, msg.payload || {}));
    });

    /** Earlier versions kept a kind's facts as text in datasets that came from a bundle; they are read as data. */
    function healRecord(record) {
      if (!record) return record;
      for (const key of KIND_META_KEYS) {
        if (typeof record[key] !== 'string') continue;
        try { record[key] = JSON.parse(record[key]); } catch (_err) { delete record[key]; }
      }
      return record;
    }
    async function list() { return (await idb.listDatasets()).map(healRecord); }
    async function get(id) { return healRecord(await idb.getDataset(id)); }

    /** Opens in progress: callers that ask for the same dataset at the same time share one handle. */
    const opening = new Map();
    async function ensureOpen(id) {
      const existing = openHandles.get(id);
      if (existing) return existing;
      if (!opening.has(id)) opening.set(id, openHandle(id).finally(() => opening.delete(id)));
      return opening.get(id);
    }
    async function openHandle(id) {
      const record = healRecord(await idb.getDataset(id));
      if (!record) throw new Error('Dataset not found: ' + id);
      const bytes = await idb.loadBlob('ds:' + id);
      if (!bytes) throw new Error('Dataset file missing: ' + id);
      const engine = await newEngine(bytes);
      const columns = await readColumns(engine);
      const handle = { engine, meta: Object.assign({}, record), columns };
      delete handle.meta.columns;
      // The record is the source of truth for the short name; keep the file's _meta in step for exports.
      if (record.shortName) await engine.run('insert or replace into _meta (key, value) values (?, ?)', ['shortName', record.shortName]);
      openHandles.set(id, handle);
      return handle;
    }

    /** Current bytes of a dataset: the live engine when it is open (unsaved edits included), else the stored file. */
    async function bytesOf(id) {
      const open = openHandles.get(id);
      if (open) return open.engine.export();
      const bytes = await idb.loadBlob('ds:' + id);
      if (!bytes) throw new Error('Dataset file missing: ' + id);
      return bytes;
    }

    /** The fields of _columns. description and unit came in 1.9 and value_labels in 1.15; older files (and files written
     * by dm_write in R before that) get them when opened. */
    const COLUMN_FIELDS = ['position', 'name', 'type', 'label', 'format', 'source_name', 'description', 'unit', 'value_labels'];
    async function ensureColumnsSchema(engine) {
      const info = await engine.exec('pragma table_info(_columns)');
      const have = new Set((info[0] ? info[0].values : []).map((r) => r[1]));
      for (const extra of ['description', 'unit', 'value_labels']) if (!have.has(extra)) await engine.run(`alter table _columns add column ${extra} text`);
    }
    /**
     * Value labels of a column: the label of every code, and whether the column holds the codes or already
     * the labels (as after an SPSS import with labels as text). Stored as JSON in _columns.value_labels.
     * @returns {{values: 'codes'|'labels', labels: Array<[any, string]>}|null}
     */
    function normaliseValueLabels(v) {
      let o = v;
      if (typeof o === 'string') { try { o = JSON.parse(o); } catch (_err) { return null; } }
      if (!o || !Array.isArray(o.labels)) return null;
      const labels = o.labels.filter((p) => Array.isArray(p) && p.length >= 2 && p[0] !== null && p[0] !== undefined && p[0] !== '').map((p) => [p[0], String(p[1])]);
      return labels.length ? { values: o.values === 'labels' ? 'labels' : 'codes', labels } : null;
    }
    /** Value labels on one line for display, e.g. "1 = Man; 2 = Kvinna". */
    const valueLabelsText = (vl) => (vl && vl.labels ? vl.labels.map(([code, label]) => `${code} = ${label}`).join('; ') : '');
    const columnRow = (c) => [c.position, c.name, c.type, c.label, c.format, c.sourceName, c.description, c.unit, c.valueLabels ? JSON.stringify(c.valueLabels) : null];
    async function readColumns(engine) {
      await ensureColumnsSchema(engine);
      const res = await engine.exec(`select ${COLUMN_FIELDS.join(', ')} from _columns order by position`);
      return (res[0] ? res[0].values : []).map((r) => ({ position: r[0], name: r[1], type: r[2], label: r[3], format: r[4], sourceName: r[5], description: r[6] || null, unit: r[7] || null, valueLabels: normaliseValueLabels(r[8]) }));
    }

    function buildWhere(columns, options) {
      const clauses = []; const params = [];
      if (options.search) {
        clauses.push('(' + columns.map((c) => `cast(${q(c.name)} as text) like ?`).join(' or ') + ')');
        for (let i = 0; i < columns.length; i++) params.push('%' + options.search + '%');
      }
      if (options.where && options.where.sql) { clauses.push('(' + options.where.sql + ')'); params.push(...(options.where.params || [])); }
      return { sql: clauses.length ? ' where ' + clauses.join(' and ') : '', params };
    }

    /**
     * Page through rows.
     * @param {string} id
     * @param {{orderBy?: string, dir?: 'asc'|'desc', search?: string, where?: {sql: string, params?: any[]}, limit?: number, offset?: number, withRowId?: boolean}} [options]
     * @returns {Promise<any[][]>} rows in column order; with `withRowId` the SQLite rowid comes first
     */
    /**
     * Index on demand: sorting a big table re-sorts every page, so the first sorted page of a table with
     * at least `indexing.threshold` rows creates an index on the sort column. Operations that rebuild
     * columns drop the indexes first (recipes.apply calls dropIndexes); they come back on the next sort.
     */
    const indexing = { threshold: 200000 };
    const indexName = (column) => '_idx_' + String(column).replace(/[^A-Za-z0-9_]/g, '_');
    async function ensureIndex(handle, column) {
      if (!handle.indexes) handle.indexes = new Set();
      if (handle.indexes.has(column)) return false;
      await handle.engine.run(`create index if not exists ${q(indexName(column))} on data(${q(column)})`);
      handle.indexes.add(column);
      return true;
    }
    async function dropIndexes(handle) {
      const res = await handle.engine.exec("select name from sqlite_master where type = 'index' and name like '\\_idx\\_%' escape '\\'");
      const names = (res[0] ? res[0].values : []).map((r) => String(r[0]));
      for (const name of names) await handle.engine.run(`drop index if exists ${q(name)}`);
      handle.indexes = new Set();
      return names.length;
    }

    async function query(id, options = {}) {
      const handle = await ensureOpen(id);
      const cols = handle.columns;
      const where = buildWhere(cols, options);
      const select = (options.withRowId ? ['rowid'] : []).concat(cols.map((c) => q(c.name)));
      let sql = `select ${select.join(', ')} from data${where.sql}`;
      if (options.orderBy && cols.some((c) => c.name === options.orderBy)) {
        if ((handle.meta.rowCount || 0) >= indexing.threshold) { try { await ensureIndex(handle, options.orderBy); } catch (err) { D.log('datasets', 'index skipped', err); } }
        sql += ` order by ${q(options.orderBy)} ${options.dir === 'desc' ? 'desc' : 'asc'} nulls last, rowid`;
      } else sql += ' order by rowid';
      if (options.limit !== undefined) sql += ` limit ${Math.max(0, Number(options.limit) | 0)} offset ${Math.max(0, Number(options.offset) | 0)}`;
      const res = await handle.engine.exec(sql, where.params);
      return res[0] ? res[0].values : [];
    }

    async function count(id, options = {}) {
      const handle = await ensureOpen(id);
      const where = buildWhere(handle.columns, options);
      const res = await handle.engine.exec(`select count(*) from data${where.sql}`, where.params);
      return res[0] ? Number(res[0].values[0][0]) : 0;
    }

    /** Summary statistics for one column. */
    async function columnStats(id, columnName) {
      const handle = await ensureOpen(id);
      const col = handle.columns.find((c) => c.name === columnName);
      if (!col) throw new Error('Unknown column: ' + columnName);
      const numeric = col.type === 'integer' || col.type === 'number';
      const c = q(col.name);
      const sql = numeric
        ? `select count(*), count(${c}), count(distinct ${c}), min(${c}), max(${c}), avg(${c}), sum(${c}) from data`
        : `select count(*), count(${c}), count(distinct ${c}), min(${c}), max(${c}), null, null from data`;
      const res = await handle.engine.exec(sql);
      const [total, nonNull, distinct, min, max, mean, sum] = res[0].values[0];
      const top = await handle.engine.exec(`select ${c}, count(*) as n from data where ${c} is not null group by ${c} order by n desc, ${c} limit 5`);
      return { column: col, total, nonNull, nulls: total - nonNull, distinct, min, max, mean, sum, top: top[0] ? top[0].values : [] };
    }

    async function log(id) {
      const handle = await ensureOpen(id);
      const res = await handle.engine.exec('select ts, action, details from _log order by rowid');
      return (res[0] ? res[0].values : []).map((r) => { let details = null; try { details = JSON.parse(r[2]); } catch (_e) { details = r[2]; } return { ts: r[0], action: r[1], details }; });
    }

    async function appendLog(handle, action, details) {
      await handle.engine.insertRows('_log', ['ts', 'action', 'details'], [[new Date().toISOString(), action, JSON.stringify(details || {})]]);
    }

    /** Rewrite the _columns table from a columns array (after schema-changing operations). */
    async function writeColumns(handle, columns) {
      handle.columns = columns.map((c, i) => ({ position: i, name: c.name, type: c.type || 'text', label: c.label || c.name, format: c.format || null, sourceName: c.sourceName || c.name, description: c.description || null, unit: c.unit || null, valueLabels: normaliseValueLabels(c.valueLabels) }));
      await ensureColumnsSchema(handle.engine);
      await handle.engine.run('delete from _columns');
      await handle.engine.insertRows('_columns', COLUMN_FIELDS, handle.columns.map(columnRow));
      handle.meta.columnCount = handle.columns.length;
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['columnCount', JSON.stringify(handle.columns.length)]);
    }

    /** Refresh rowCount after operations that add or remove rows. */
    async function refreshCounts(handle) {
      const res = await handle.engine.exec('select count(*) from data');
      handle.meta.rowCount = Number(res[0].values[0][0]);
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['rowCount', JSON.stringify(handle.meta.rowCount)]);
      return handle.meta.rowCount;
    }

    // ---- debounced persistence ----
    /** @type {Map<string, number>} */
    const saveTimers = new Map();
    const SAVE_DELAY = 1500;
    /** A marker that changes whenever a dataset's content may have changed (saves and unsaved edits alike). */
    async function version(id) {
      const open = openHandles.get(id);
      if (open) return `${open.meta.updatedAt || ''}#${open.revision || 0}`;
      const record = await idb.getDataset(id);
      return record ? String(record.updatedAt || '') : '';
    }
    /** A marker of an open dataset's content: unlike version(), a save of the same content leaves it unchanged. */
    function contentMarker(id) {
      const open = openHandles.get(id);
      return open ? `${open.revision || 0}|${open.meta.rowCount || 0}|${open.meta.columnCount || 0}|${open.replaced || 0}` : '';
    }
    function scheduleSave(id, delay = SAVE_DELAY) {
      const open = openHandles.get(id);
      if (open) open.revision = (open.revision || 0) + 1;
      notify('dirty', { id });
      const existing = saveTimers.get(id);
      if (existing) clearTimeout(existing);
      saveTimers.set(id, setTimeout(() => { saveTimers.delete(id); save(id).catch((err) => console.error('[datasets] save failed', err)); }, delay));
    }
    /** Persist every dataset with a pending save now. */
    async function flushSaves() {
      const ids = Array.from(saveTimers.keys());
      for (const id of ids) { clearTimeout(saveTimers.get(id)); saveTimers.delete(id); }
      await Promise.all(ids.map((id) => save(id)));
    }
    function hasPendingSaves() { return saveTimers.size > 0; }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves(); });

    /**
     * Rebuild a dataset's table from new typed rows and columns (an API table fetched again), keeping its id,
     * name, short name, metadata, rules and log. Labels, descriptions and units of columns with the same name
     * are kept. Returns the file from before, for a rollback with replaceBytes.
     * @param {string} id @param {{columns: Array<{name: string, type: string, label?: string, sourceName?: string}>, rows: any[][], source?: any}} input
     * @returns {Promise<ArrayBuffer>}
     */
    async function rebuild(id, input) {
      const handle = await ensureOpen(id);
      await dropIndexes(handle);
      const before = await handle.engine.export();
      const names = types.cleanColumnNames(input.columns.map((c) => c.name));
      const old = new Map(handle.columns.map((c) => [c.name, c]));
      const columns = input.columns.map((c, i) => {
        const o = old.get(names[i]);
        return { name: names[i], type: c.type || 'text', label: (o && o.label) || c.label || names[i], format: o ? o.format : null, sourceName: c.sourceName || c.name, description: o ? o.description : null, unit: o ? o.unit : null, valueLabels: o ? o.valueLabels : null };
      });
      await handle.engine.execMany(['drop table if exists data', `create table data (${columns.map((c) => `${q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`]);
      await writeColumns(handle, columns);
      await handle.engine.insertRows('data', handle.columns.map((c) => c.name), input.rows);
      if (input.source) {
        handle.meta.source = input.source;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['source', JSON.stringify(input.source)]);
      }
      await refreshCounts(handle);
      handle.replaced = (handle.replaced || 0) + 1;
      return before;
    }

    /** Replace the dataset file wholesale (undo, version restore). */
    async function replaceBytes(id, bytes, logEntry) {
      const handle = await ensureOpen(id);
      await handle.engine.open(bytes.slice(0));
      handle.columns = await readColumns(handle.engine);
      handle.replaced = (handle.replaced || 0) + 1;
      if (logEntry) await appendLog(handle, logEntry.action || 'restore', logEntry);
      await refreshCounts(handle);
      handle.meta.columnCount = handle.columns.length;
      // Kind-specific facts (a graph's counts, a plan's facts, a collection's files) live in the restored file's _meta too.
      for (const key of KIND_META_KEYS) {
        const r = await handle.engine.exec('select value from _meta where key = ?', [key]);
        if (r[0] && r[0].values.length) { try { handle.meta[key] = JSON.parse(r[0].values[0][0]); } catch (_e) { /* keep the current value */ } }
      }
      return save(id);
    }

    // ---- versions (snapshots kept in IndexedDB) ----
    /** What a version needs to say what it holds in the kind's own units. */
    function versionFacts(meta) {
      const facts = { kind: meta.kind, rowCount: meta.rowCount, columnCount: meta.columnCount };
      for (const key of ['documents', 'images', 'model', 'graph', 'plan']) if (meta[key]) facts[key] = meta[key];
      return facts;
    }
    async function snapshot(id, label) {
      const handle = await ensureOpen(id);
      const record = await idb.getDataset(id);
      const versions = (record && record.versions) || [];
      const n = versions.length ? Math.max(...versions.map((v) => v.n)) + 1 : 1;
      const bytes = await handle.engine.export();
      await idb.saveBlob(`ds:${id}:v${n}`, bytes);
      const version = { n, label: label || `Version ${n}`, ts: new Date().toISOString(), byteSize: bytes.byteLength, rowCount: handle.meta.rowCount, columnCount: handle.columns.length, facts: versionFacts(handle.meta) };
      handle.meta.versions = versions.concat([version]);
      await appendLog(handle, 'snapshot', { n, label: version.label });
      await save(id);
      return version;
    }
    async function listVersions(id) { const record = await idb.getDataset(id); return (record && record.versions) || []; }
    async function restoreVersion(id, n) {
      const bytes = await idb.loadBlob(`ds:${id}:v${n}`);
      if (!bytes) throw new Error(D.t('datasets.version.gone'));
      const versions = await listVersions(id);
      const v = versions.find((x) => x.n === n);
      return replaceBytes(id, bytes, { action: 'restore', n, description: D.t('datasets.restored.to', { label: v ? v.label : D.t('datasets.version.n', { n }) }) });
    }
    async function deleteVersion(id, n) {
      const handle = await ensureOpen(id);
      await idb.deleteBlob(`ds:${id}:v${n}`);
      handle.meta.versions = (handle.meta.versions || (await listVersions(id))).filter((v) => v.n !== n);
      return save(id);
    }
    /** Compare the current state with a version: schema differences and row/size counts. */
    async function compareVersion(id, n) {
      const handle = await ensureOpen(id);
      const bytes = await idb.loadBlob(`ds:${id}:v${n}`);
      if (!bytes) throw new Error(D.t('datasets.version.gone'));
      const other = await newEngine(bytes);
      try {
        const oldCols = await readColumns(other);
        const oldCount = Number((await other.exec('select count(*) from data'))[0].values[0][0]);
        const now = handle.columns;
        const added = now.filter((c) => !oldCols.some((o) => o.name === c.name)).map((c) => c.name);
        const removed = oldCols.filter((o) => !now.some((c) => c.name === o.name)).map((c) => c.name);
        const retyped = now.filter((c) => { const o = oldCols.find((x) => x.name === c.name); return o && o.type !== c.type; }).map((c) => ({ name: c.name, from: oldCols.find((x) => x.name === c.name).type, to: c.type }));
        const own = await D.require('data/version-diff').compare(handle.meta, handle.engine, other);
        return { rowsThen: oldCount, rowsNow: handle.meta.rowCount, added, removed, retyped, bytesThen: bytes.byteLength, own };
      } finally { other.terminate(); }
    }

    /**
     * Append rows to (or replace the rows of) an existing dataset. Columns are matched by cleaned name;
     * missing columns become NULL and unknown columns are ignored. Values are parsed to the column types.
     * @param {string} id @param {{columns: string[], rows: any[][]}} table
     * @param {{mode?: 'append'|'replace', dedupeKeys?: string[], decimal?: string, source?: any}} [options]
     */
    async function appendRows(id, table, options = {}) {
      const handle = await ensureOpen(id);
      const incoming = types.cleanColumnNames(table.columns);
      const map = handle.columns.map((c) => incoming.indexOf(c.name));
      const missing = handle.columns.filter((c, i) => map[i] < 0).map((c) => c.name);
      const ignored = incoming.filter((n) => !handle.columns.some((c) => c.name === n));
      let rows = table.rows.map((r) => map.map((i, ci) => (i < 0 ? null : types.parseValue(r[i], handle.columns[ci].type, { decimal: options.decimal || 'point' }))));
      let skipped = 0;
      if (options.mode !== 'replace' && options.dedupeKeys && options.dedupeKeys.length) {
        const keyIdx = options.dedupeKeys.map((k) => handle.columns.findIndex((c) => c.name === k)).filter((i) => i >= 0);
        if (keyIdx.length) {
          const res = await handle.engine.exec(`select ${keyIdx.map((i) => q(handle.columns[i].name)).join(', ')} from data`);
          const seen = new Set((res[0] ? res[0].values : []).map((r) => JSON.stringify(r)));
          rows = rows.filter((r) => { const k = JSON.stringify(keyIdx.map((i) => r[i])); if (seen.has(k)) { skipped++; return false; } seen.add(k); return true; });
        }
      }
      await handle.engine.run('savepoint dm_append');
      try {
        if (options.mode === 'replace') await handle.engine.run('delete from data');
        await handle.engine.insertRows('data', handle.columns.map((c) => c.name), rows);
        await handle.engine.run('release dm_append');
      } catch (err) {
        try { await handle.engine.run('rollback to dm_append'); await handle.engine.run('release dm_append'); } catch (_e) { /* ignore */ }
        throw err;
      }
      if (options.source) {
        handle.meta.source = options.source;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['source', JSON.stringify(options.source)]);
      }
      await appendLog(handle, options.mode === 'replace' ? 'replace' : 'append', { rows: rows.length, skipped, missing, ignored, source: options.source ? { kind: options.source.kind, connectorName: options.source.connectorName, fetchedAt: options.source.fetchedAt } : null });
      await refreshCounts(handle);
      await save(id);
      return { rows: rows.length, skipped, missing, ignored };
    }

    /** Write the current state to IndexedDB. */
    async function save(id) {
      const handle = await ensureOpen(id);
      notify('saving', { id });
      handle.meta.updatedAt = new Date().toISOString();
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['updatedAt', handle.meta.updatedAt]);
      const record = await persist(handle);
      notify('updated', record);
      notify('saved', { id });
      sync.broadcast('datasets', 'saved', { id, name: handle.meta.name, updatedAt: handle.meta.updatedAt });
      return record;
    }

    /**
     * Create a new dataset from a SQL query against an open dataset (aggregations, selections).
     * @param {string} sourceId @param {string} sql @param {{name: string, params?: any[], types?: Record<string, string>, source?: any, description?: string}} options
     */
    async function createFromQuery(sourceId, sql, options) {
      const handle = await ensureOpen(sourceId);
      const res = await handle.engine.exec(sql, options.params);
      const columnsOut = res[0] ? res[0].columns : [];
      const rows = res[0] ? res[0].values : [];
      const sourceTypes = Object.fromEntries(handle.columns.map((c) => [c.name, c.type]));
      const columns = columnsOut.map((name) => ({ name, type: (options.types && options.types[name]) || sourceTypes[name] || types.inferColumns([name], rows.map((r) => [r[columnsOut.indexOf(name)]]), { sample: 500 })[0].type, label: name }));
      return create({ name: options.name, description: options.description || '', columns, rows, source: Object.assign({ kind: 'derived', from: sourceId, sql }, options.source || {}) });
    }

    /**
     * Copy another dataset's rows into a table of an open dataset (used for joins and appends; sql.js
     * cannot ATTACH files).
     */
    async function copyInto(targetHandle, otherId, tableName) {
      const other = await ensureOpen(otherId);
      const cols = other.columns;
      await targetHandle.engine.run(`drop table if exists ${q(tableName)}`);
      await targetHandle.engine.run(`create temp table ${q(tableName)} (${cols.map((c) => `${q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`);
      const CHUNK = 50000;
      for (let offset = 0; ; offset += CHUNK) {
        const rows = await query(otherId, { limit: CHUNK, offset });
        if (!rows.length) break;
        await targetHandle.engine.insertRows(tableName, cols.map((c) => c.name), rows);
        if (rows.length < CHUNK) break;
      }
      return cols;
    }

    async function updateMeta(id, patch) {
      const handle = await ensureOpen(id);
      if (patch.shortName !== undefined) {
        const s = validateShortName(patch.shortName);
        if ((await list()).some((d) => d.id !== id && d.shortName === s)) throw new Error(D.t('datasets.shortname.taken', { name: s }));
        patch = Object.assign({}, patch, { shortName: s });
      }
      if (patch.folder !== undefined) patch = Object.assign({}, patch, { folder: normalizeFolder(patch.folder) });
      if (patch.tags !== undefined) patch = Object.assign({}, patch, { tags: normalizeTags(patch.tags) });
      for (const [k, v] of Object.entries(patch)) {
        if (!META_KEYS.includes(k) || k === 'id') continue;
        handle.meta[k] = v;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', [k, typeof v === 'string' ? v : JSON.stringify(v)]);
      }
      await appendLog(handle, 'meta', patch);
      return save(id);
    }

    async function remove(id, options = {}) {
      const pending = saveTimers.get(id);
      if (pending) { clearTimeout(pending); saveTimers.delete(id); }
      const handle = openHandles.get(id);
      if (handle) { handle.removed = true; handle.engine.terminate(); openHandles.delete(id); }
      // Same lock as persist(): a save in flight finishes first and cannot re-create the entry afterwards.
      await sync.withLock('ds:' + id, () => idb.deleteDataset(id));
      if (!options.quiet) notify('deleted', { id });
      if (!options.quiet) sync.broadcast('datasets', 'deleted', { id });
    }

    /** @returns {Promise<ArrayBuffer>} the SQLite file */
    async function exportBytes(id) { const handle = await ensureOpen(id); return handle.engine.export(); }

    /**
     * The file of a dataset with columns pseudonymised or dropped in the copy only (the review before sharing);
     * the dataset itself is untouched. Hashing uses dm_hash with the salt (random when not given), dropped columns
     * leave _columns too and the remaining positions close up.
     * @param {string} id @param {{drop?: string[], hash?: string[], salt?: string}} [options]
     * @returns {Promise<ArrayBuffer>}
     */
    async function exportBytesTransformed(id, options = {}) {
      const drop = (options.drop || []).filter(Boolean);
      const hash = (options.hash || []).filter((c) => c && !drop.includes(c));
      const bytes = await exportBytes(id);
      const engine = await newEngine(bytes);
      try {
        const names = (await readColumns(engine)).map((c) => c.name);
        const salt = options.salt || Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
        for (const name of hash) {
          if (!names.includes(name)) continue;
          await engine.run(`update data set ${q(name)} = dm_hash(cast(${q(name)} as text), ?, 16) where ${q(name)} is not null`, [salt]);
          await engine.run("update _columns set type = 'text', value_labels = null where name = ?", [name]);
        }
        if (drop.some((n) => names.includes(n))) {
          // Indexes made for sorting and filtering would block the drop; the copy does not need them.
          const idx = await engine.exec("select name from sqlite_master where type = 'index' and tbl_name = 'data' and sql is not null");
          for (const row of (idx[0] ? idx[0].values : [])) await engine.run(`drop index if exists ${q(String(row[0]))}`);
          for (const name of drop) {
            if (!names.includes(name)) continue;
            await engine.run(`alter table data drop column ${q(name)}`);
            await engine.run('delete from _columns where name = ?', [name]);
          }
          const left = await engine.exec('select name from _columns order by position');
          let position = 0;
          for (const row of (left[0] ? left[0].values : [])) await engine.run('update _columns set position = ? where name = ?', [position++, row[0]]);
        }
        if (options.after) await options.after(engine);
        // SQLite keeps removed values in free pages until told otherwise, and this copy leaves the app.
        await engine.run('vacuum');
        return await engine.export();
      } finally { engine.terminate(); }
    }

    /** All rows in column order (for exporters). */
    async function allRows(id) { return query(id); }
    async function columns(id) { return (await ensureOpen(id)).columns; }

    /**
     * Add a dataset from an existing SQLite file (restore from backup or import of a .sqlite file).
     * A new id is assigned when the file's id already exists.
     */
    async function importBytes(bytes, overrides = {}, options = {}) {
      const engine = await newEngine(bytes.slice(0));
      const tables = await engine.exec("select name from sqlite_master where type='table'");
      const names = tables[0] ? tables[0].values.map((r) => r[0]) : [];
      for (const required of ['data', '_columns', '_meta', '_log']) if (!names.includes(required)) { engine.terminate(); throw new Error('Not a Dataspatium dataset (missing table ' + required + ')'); }
      const metaRows = await engine.exec('select key, value from _meta');
      const meta = Object.assign(rowsToMeta(metaRows[0] ? metaRows[0].values : []), overrides);
      if (!meta.id || (await idb.getDataset(meta.id))) meta.id = newId();
      await engine.run('insert or replace into _meta (key, value) values (?, ?)', ['id', meta.id]);
      meta.shortName = await uniqueShortName(meta.shortName || meta.name, meta.id);
      await engine.run('insert or replace into _meta (key, value) values (?, ?)', ['shortName', meta.shortName]);
      const cols = await readColumns(engine);
      const countRes = await engine.exec('select count(*) from data');
      meta.rowCount = Number(countRes[0].values[0][0]);
      meta.columnCount = cols.length;
      meta.updatedAt = meta.updatedAt || new Date().toISOString();
      meta.createdAt = meta.createdAt || meta.updatedAt;
      const handle = { engine, meta, columns: cols };
      openHandles.set(meta.id, handle);
      await persist(handle);
      if (!options.quiet) {
        notify('created', handle.meta);
        sync.broadcast('datasets', 'created', { id: handle.meta.id, name: handle.meta.name });
      }
      return handle.meta;
    }

    function close(id) { const h = openHandles.get(id); if (h) { h.engine.terminate(); openHandles.delete(id); } }

    return {
      contentMarker, notify, create, list, get, ensureOpen, query, count, columnStats, log, appendLog, writeColumns, refreshCounts, save, scheduleSave, flushSaves, hasPendingSaves,
      replaceBytes, rebuild, snapshot, listVersions, restoreVersion, deleteVersion, compareVersion, createFromQuery, copyInto, appendRows,
      createEmpty, appendImportRows, finishImport, abortImport,
      shortNameFrom, uniqueShortName, validateShortName, ensureShortNames, bytesOf, version, normalizeFolder, normalizeTags, folderPaths, KINDS,
      updateMeta, remove, exportBytes, exportBytesTransformed, allRows, columns, importBytes, close, subscribe, quoteIdent: q, ensureIndex, dropIndexes, indexing, valueLabelsText,
    };
  });
})();
