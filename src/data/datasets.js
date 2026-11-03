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
    const META_KEYS = ['id', 'name', 'description', 'createdAt', 'updatedAt', 'rowCount', 'columnCount', 'source', 'importOptions', 'rules'];

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
        if (k === 'rowCount' || k === 'columnCount' || k === 'source' || k === 'importOptions' || k === 'rules') { try { meta[k] = JSON.parse(v); } catch (_e) { meta[k] = v; } }
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
      const columns = input.columns.map((c, i) => ({ position: i, name: names[i], type: c.type || 'text', label: c.label || names[i], format: null, sourceName: c.sourceName || c.name, description: c.description || null, unit: c.unit || null }));
      await engine.run(`create table data (${columns.map((c) => `${q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`);
      await engine.run('create table _columns (position integer, name text, type text, label text, format text, source_name text, description text, unit text)');
      await engine.run('create table _meta (key text primary key, value text)');
      await engine.run('create table _log (ts text, action text, details text)');
      await engine.insertRows('_columns', ['position', 'name', 'type', 'label', 'format', 'source_name', 'description', 'unit'], columns.map((c) => [c.position, c.name, c.type, c.label, c.format, c.sourceName, c.description, c.unit]));
      const now = new Date().toISOString();
      const meta = {
        id, name: input.name || 'Namnlös datamängd', description: input.description || '', createdAt: now, updatedAt: now,
        rowCount: 0, columnCount: columns.length, source: input.source || null, importOptions: input.importOptions || null,
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
        const bytes = await handle.engine.export();
        handle.meta.byteSize = bytes.byteLength;
        const record = Object.assign({}, handle.meta, { columns: handle.columns.map((c) => ({ name: c.name, type: c.type, label: c.label })) });
        await idb.saveBlob('ds:' + handle.meta.id, bytes);
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

    async function list() { return idb.listDatasets(); }
    async function get(id) { return idb.getDataset(id); }

    async function ensureOpen(id) {
      const existing = openHandles.get(id);
      if (existing) return existing;
      const record = await idb.getDataset(id);
      if (!record) throw new Error('Dataset not found: ' + id);
      const bytes = await idb.loadBlob('ds:' + id);
      if (!bytes) throw new Error('Dataset file missing: ' + id);
      const engine = await newEngine(bytes);
      const columns = await readColumns(engine);
      const handle = { engine, meta: Object.assign({}, record), columns };
      delete handle.meta.columns;
      openHandles.set(id, handle);
      return handle;
    }

    /** `_columns` gained description and unit in 1.9; older files (and files written by dm_write in R) get them on open. */
    async function ensureColumnsSchema(engine) {
      const info = await engine.exec('pragma table_info(_columns)');
      const have = new Set((info[0] ? info[0].values : []).map((r) => r[1]));
      for (const extra of ['description', 'unit']) if (!have.has(extra)) await engine.run(`alter table _columns add column ${extra} text`);
    }
    async function readColumns(engine) {
      await ensureColumnsSchema(engine);
      const res = await engine.exec('select position, name, type, label, format, source_name, description, unit from _columns order by position');
      return (res[0] ? res[0].values : []).map((r) => ({ position: r[0], name: r[1], type: r[2], label: r[3], format: r[4], sourceName: r[5], description: r[6] || null, unit: r[7] || null }));
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
      handle.columns = columns.map((c, i) => ({ position: i, name: c.name, type: c.type || 'text', label: c.label || c.name, format: c.format || null, sourceName: c.sourceName || c.name, description: c.description || null, unit: c.unit || null }));
      await handle.engine.run('delete from _columns');
      await handle.engine.insertRows('_columns', ['position', 'name', 'type', 'label', 'format', 'source_name', 'description', 'unit'], handle.columns.map((c) => [c.position, c.name, c.type, c.label, c.format, c.sourceName, c.description, c.unit]));
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
    function scheduleSave(id, delay = SAVE_DELAY) {
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

    /** Replace the dataset file wholesale (undo, version restore). */
    async function replaceBytes(id, bytes, logEntry) {
      const handle = await ensureOpen(id);
      await handle.engine.open(bytes.slice(0));
      handle.columns = await readColumns(handle.engine);
      if (logEntry) await appendLog(handle, logEntry.action || 'restore', logEntry);
      await refreshCounts(handle);
      handle.meta.columnCount = handle.columns.length;
      return save(id);
    }

    // ---- versions (snapshots kept in IndexedDB) ----
    async function snapshot(id, label) {
      const handle = await ensureOpen(id);
      const record = await idb.getDataset(id);
      const versions = (record && record.versions) || [];
      const n = versions.length ? Math.max(...versions.map((v) => v.n)) + 1 : 1;
      const bytes = await handle.engine.export();
      await idb.saveBlob(`ds:${id}:v${n}`, bytes);
      const version = { n, label: label || `Version ${n}`, ts: new Date().toISOString(), byteSize: bytes.byteLength, rowCount: handle.meta.rowCount, columnCount: handle.columns.length };
      handle.meta.versions = versions.concat([version]);
      await appendLog(handle, 'snapshot', { n, label: version.label });
      await save(id);
      return version;
    }
    async function listVersions(id) { const record = await idb.getDataset(id); return (record && record.versions) || []; }
    async function restoreVersion(id, n) {
      const bytes = await idb.loadBlob(`ds:${id}:v${n}`);
      if (!bytes) throw new Error('Versionen finns inte längre.');
      const versions = await listVersions(id);
      const v = versions.find((x) => x.n === n);
      return replaceBytes(id, bytes, { action: 'restore', n, description: 'Återställd till ' + (v ? v.label : 'version ' + n) });
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
      if (!bytes) throw new Error('Versionen finns inte längre.');
      const other = await newEngine(bytes);
      try {
        const oldCols = await readColumns(other);
        const oldCount = Number((await other.exec('select count(*) from data'))[0].values[0][0]);
        const now = handle.columns;
        const added = now.filter((c) => !oldCols.some((o) => o.name === c.name)).map((c) => c.name);
        const removed = oldCols.filter((o) => !now.some((c) => c.name === o.name)).map((c) => c.name);
        const retyped = now.filter((c) => { const o = oldCols.find((x) => x.name === c.name); return o && o.type !== c.type; }).map((c) => ({ name: c.name, from: oldCols.find((x) => x.name === c.name).type, to: c.type }));
        return { rowsThen: oldCount, rowsNow: handle.meta.rowCount, added, removed, retyped, bytesThen: bytes.byteLength };
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
      for (const [k, v] of Object.entries(patch)) {
        if (!META_KEYS.includes(k) || k === 'id') continue;
        handle.meta[k] = v;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', [k, typeof v === 'string' ? v : JSON.stringify(v)]);
      }
      await appendLog(handle, 'meta', patch);
      return save(id);
    }

    async function remove(id) {
      const pending = saveTimers.get(id);
      if (pending) { clearTimeout(pending); saveTimers.delete(id); }
      const handle = openHandles.get(id);
      if (handle) { handle.engine.terminate(); openHandles.delete(id); }
      await idb.deleteDataset(id);
      notify('deleted', { id });
      sync.broadcast('datasets', 'deleted', { id });
    }

    /** @returns {Promise<ArrayBuffer>} the SQLite file */
    async function exportBytes(id) { const handle = await ensureOpen(id); return handle.engine.export(); }

    /** All rows in column order (for exporters). */
    async function allRows(id) { return query(id); }
    async function columns(id) { return (await ensureOpen(id)).columns; }

    /**
     * Add a dataset from an existing SQLite file (restore from backup or import of a .sqlite file).
     * A new id is assigned when the file's id already exists.
     */
    async function importBytes(bytes, overrides = {}) {
      const engine = await newEngine(bytes.slice(0));
      const tables = await engine.exec("select name from sqlite_master where type='table'");
      const names = tables[0] ? tables[0].values.map((r) => r[0]) : [];
      for (const required of ['data', '_columns', '_meta', '_log']) if (!names.includes(required)) { engine.terminate(); throw new Error('Not a Dataspatium dataset (missing table ' + required + ')'); }
      const metaRows = await engine.exec('select key, value from _meta');
      const meta = Object.assign(rowsToMeta(metaRows[0] ? metaRows[0].values : []), overrides);
      if (!meta.id || (await idb.getDataset(meta.id))) meta.id = newId();
      await engine.run('insert or replace into _meta (key, value) values (?, ?)', ['id', meta.id]);
      const cols = await readColumns(engine);
      const countRes = await engine.exec('select count(*) from data');
      meta.rowCount = Number(countRes[0].values[0][0]);
      meta.columnCount = cols.length;
      meta.updatedAt = meta.updatedAt || new Date().toISOString();
      meta.createdAt = meta.createdAt || meta.updatedAt;
      const handle = { engine, meta, columns: cols };
      openHandles.set(meta.id, handle);
      await persist(handle);
      notify('created', handle.meta);
      sync.broadcast('datasets', 'created', { id: handle.meta.id, name: handle.meta.name });
      return handle.meta;
    }

    function close(id) { const h = openHandles.get(id); if (h) { h.engine.terminate(); openHandles.delete(id); } }

    return {
      create, list, get, ensureOpen, query, count, columnStats, log, appendLog, writeColumns, refreshCounts, save, scheduleSave, flushSaves, hasPendingSaves,
      replaceBytes, snapshot, listVersions, restoreVersion, deleteVersion, compareVersion, createFromQuery, copyInto, appendRows,
      createEmpty, appendImportRows, finishImport, abortImport,
      updateMeta, remove, exportBytes, allRows, columns, importBytes, close, subscribe, quoteIdent: q, ensureIndex, dropIndexes, indexing,
    };
  });
})();
