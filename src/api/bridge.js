// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Client for the local database bridge (tools/db-bridge.ps1 on Windows, tools/db_bridge.py elsewhere): a small
 * HTTP service on 127.0.0.1 that lists data sources, tables and columns and runs queries through ODBC, OLE DB,
 * SqlClient or sqlite3, so that Access, Excel, SQL Server, SQLite and every ODBC source on the computer can be
 * imported. The address and token live in the session (api/secrets; persisted encrypted on request), every call
 * needs the 'databases' consent, and passwords never reach a dataset's metadata: they are kept for the session
 * only, keyed by the rest of the source. Datasets imported here carry source.kind 'bridge' and are refreshed
 * through api/runner like API datasets. As a go-between (F14.1, off until the user turns it on in Internetåtkomst) the
 * bridge fetches an https address for api/http when the service does not let the browser read its answer; the bridge
 * itself decides which hosts it reaches (--allow-host / -AllowHosts).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/bridge', ['api/secrets', 'api/runner', 'platform/storage/idb', 'platform/consent'], (secrets, runner, idb, consent) => {
    const ID = '__bridge';
    const URL_KEY = 'bridge.url';
    const RELAY_KEY = 'bridge.relay';
    let relayOn = null;
    /** Type names reported by the bridge (.NET and the Python bridge's names) -> dataset types; others are inferred. */
    const TYPES = {
      Int16: 'integer', Int32: 'integer', Int64: 'integer', Byte: 'integer', SByte: 'integer', UInt16: 'integer', UInt32: 'integer', UInt64: 'integer',
      Single: 'number', Double: 'number', Decimal: 'number', Boolean: 'boolean', DateTime: 'datetime', DateTimeOffset: 'datetime', Date: 'date',
      String: 'text', Guid: 'text', Char: 'text',
    };
    const listeners = new Set();
    /** @type {Map<string, {password?: string, connectionString?: string}>} source signature -> secrets given this session */
    const sessionSecrets = new Map();
    let transport = null;
    let infoCache = null;
    let current = null;

    class BridgeError extends Error {
      constructor(message, status, data) { super(message); this.name = 'BridgeError'; this.status = status || 0; this.data = data || null; }
    }

    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function normalizeUrl(url) {
      let u = String(url || '').trim();
      if (!u) return '';
      if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
      return u.replace(/\/+$/, '');
    }
    function hostOf(url) { try { return new URL(url).host; } catch (_e) { return String(url); } }
    function connection() { return secrets.get(ID); }
    function isConnected() { return !!connection(); }

    function messageFor(status, data) {
      const detail = data && data.error ? String(data.error) : '';
      if (status === 401) return D.t('bridge.err.token');
      if (status === 403 && /skrivskydd|read-only|allow-?write/i.test(detail)) return D.t('bridge.err.readonly');
      if (status === 428) return D.t('bridge.err.approval');
      return detail || D.t('bridge.err.http', { status });
    }

    /** One call to the bridge: GET without a body, POST with one. The 'databases' consent is asked once. */
    async function call(path, body) {
      const conn = connection();
      if (!conn) throw new BridgeError(D.t('bridge.err.notconnected'), 0);
      await consent.require('databases', { host: hostOf(conn.url) });
      const init = { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + conn.token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' };
      let res;
      try { res = await (transport || fetch)(conn.url + path, init); } catch (err) { throw new BridgeError(D.t('bridge.err.unreachable', { url: conn.url }), 0, { cause: String((err && err.message) || err) }); }
      let data = null;
      try { data = await res.json(); } catch (_e) { data = null; }
      if (!res.ok) throw new BridgeError(messageFor(res.status, data), res.status, data);
      return data;
    }

    /**
     * Connect: keep address and token for the session and read the bridge's description. Nothing is kept when
     * the bridge does not answer or rejects the token.
     */
    async function connect(url, token) {
      const u = normalizeUrl(url);
      const tok = String(token || '').trim();
      if (!u || !tok) throw new BridgeError(D.t('bridge.err.fields'), 0);
      secrets.set(ID, { url: u, token: tok });
      try { infoCache = await call('/'); } catch (err) { await secrets.forget(ID); infoCache = null; throw err; }
      await idb.setSetting(URL_KEY, u);
      notify();
      return infoCache;
    }
    async function disconnect() { await secrets.forget(ID); infoCache = null; current = null; sessionSecrets.clear(); notify(); }
    /** Keep address and token encrypted with the passphrase shared by all saved keys (api/secrets). */
    async function persist(passphrase) {
      const conn = connection();
      if (!conn) throw new BridgeError(D.t('bridge.err.notconnected'), 0);
      await secrets.persist(ID, conn, passphrase);
      notify();
    }
    async function rememberedUrl() { return (await idb.getSetting(URL_KEY, '')) || ''; }
    // ---- databases opened through the bridge, kept without secrets so that Inhämta can list them among the added sources ----
    const SOURCES_KEY = 'bridge.sources';
    /** @returns {Promise<Array<{source: any, label: string}>>} newest first */
    async function remembered() { const list = await idb.getSetting(SOURCES_KEY, []); return Array.isArray(list) ? list : []; }
    /** Keep a database the user opened (its connection details without passwords, and the label the app shows). */
    async function remember(source) {
      const entry = { source: sanitize(source), label: sourceLabel(source) };
      if (!entry.label) return;
      const list = (await remembered()).filter((x) => x.label !== entry.label);
      list.unshift(entry);
      await idb.setSetting(SOURCES_KEY, list.slice(0, 50));
      notify();
    }
    /** Forget a remembered database (the datasets fetched from it stay). */
    async function forget(label) { await idb.setSetting(SOURCES_KEY, (await remembered()).filter((x) => x.label !== label)); notify(); }
    async function info(force) { if (!infoCache || force) infoCache = await call('/'); return infoCache; }
    function sources() { return call('/sources'); }
    function tables(source) { return call('/tables', { source: withSecrets(source) }).then((r) => r.tables || []); }
    function columns(source, table) { return call('/columns', { source: withSecrets(source), table }).then((r) => r.columns || []); }
    function rows(source, table, limit) { return call('/rows', { source: withSecrets(source), table, limit }); }
    /** Run SQL. A write (anything but SELECT) needs `approved: true`; the bridge answers 428 until then, 403 when read-only. */
    function query(source, sql, options = {}) { return call('/query', { source: withSecrets(source), sql, limit: options.limit, approved: !!options.approved }); }

    // ---- secrets of a source ----
    const MASK = '***';
    function maskConnectionString(cs) { return String(cs || '').replace(/((?:^|;)\s*(?:pwd|password)\s*=)[^;]*/gi, '$1' + MASK); }
    /** The source as it may be stored (with a dataset, in the log): no password, the connection string masked. */
    function sanitize(source) {
      const out = {};
      let hasSecrets = false;
      for (const [k, v] of Object.entries(source || {})) {
        if (k === 'password') { if (v) hasSecrets = true; continue; }
        if (k === 'connectionString') { const masked = maskConnectionString(v); if (masked !== String(v || '')) hasSecrets = true; out[k] = masked; continue; }
        if (k === 'hasSecrets') continue;
        out[k] = v;
      }
      if (hasSecrets) out.hasSecrets = true;
      return out;
    }
    function signature(source) { const s = sanitize(source); delete s.hasSecrets; return JSON.stringify(s); }
    function hasSecretValues(source) { return !!((source.password) || (source.connectionString && !source.connectionString.includes(MASK))); }
    /** The source with the secrets given earlier this session filled in; secrets given now are remembered for the session. */
    function withSecrets(source) {
      const src = Object.assign({}, source || {});
      delete src.hasSecrets;
      const key = signature(src);
      const given = sessionSecrets.get(key) || {};
      if (!src.password && given.password) src.password = given.password;
      if (src.connectionString && src.connectionString.includes(MASK) && given.connectionString) src.connectionString = given.connectionString;
      if (hasSecretValues(src)) sessionSecrets.set(key, { password: src.password, connectionString: src.connectionString });
      return src;
    }

    // ---- tables and datasets ----
    /** Result of /rows or /query -> table for api/runner.toDataset; types known to the bridge become type hints. */
    function toTable(result) {
      const columns = (result.columns || []).map((c) => c.name);
      const types = {};
      for (const c of result.columns || []) { const type = TYPES[c.type]; if (type) types[c.name] = type; }
      return { columns, rows: result.rows || [], types, truncated: !!result.truncated };
    }
    /** Short name of a source for lists and logs: file name, server/database or DSN. */
    function sourceLabel(source) {
      const s = source || {};
      const file = (p) => String(p || '').split(/[\\/]/).pop();
      switch (s.kind) {
        case 'access': case 'excel': case 'sqlite': return file(s.path);
        case 'sqlserver': return [s.server, s.database].filter(Boolean).join('/');
        case 'dsn': return s.dsn || 'DSN';
        default: return s.kind ? String(s.kind).toUpperCase() : '';
      }
    }
    /** Source descriptor stored with a dataset (no secrets), so that Hantera and Inhämta can fetch it again. */
    function describeSource(source, options, table) {
      const conn = connection();
      return {
        kind: 'bridge', url: conn ? conn.url : '', source: sanitize(source), table: options.table || null, sql: options.sql || null,
        label: [sourceLabel(source), options.table || 'SQL'].filter(Boolean).join(' · '),
        rows: table.rows.length, truncated: table.truncated, fetchedAt: new Date().toISOString(),
      };
    }
    /**
     * Import a table or the result of own SQL as a new dataset (types from the bridge, the rest inferred).
     * @param {any} source @param {{table?: string, sql?: string, limit?: number, name?: string}} options
     */
    async function importTable(source, options = {}) {
      const result = options.sql ? await query(source, options.sql, { limit: options.limit }) : await rows(source, options.table, options.limit);
      if (result.affected !== undefined) throw new BridgeError(D.t('bridge.err.notaquery'), 0);
      const table = toTable(result);
      const name = options.name || options.table || D.t('bridge.fetched.name');
      return runner.toDataset(table, { name, source: describeSource(source, options, table) });
    }
    /** Fetch again what a dataset's bridge source describes (api/runner.refetch delegates here). */
    async function refetch(desc, options = {}) {
      if (!connection()) throw new BridgeError(D.t('bridge.err.notconnected'), 0);
      const source = withSecrets(desc.source || {});
      if (desc.source && desc.source.hasSecrets && !hasSecretValues(source)) throw new BridgeError(D.t('bridge.err.password', { name: desc.label || '' }), 0);
      const result = desc.sql ? await query(source, desc.sql, { limit: options.limit }) : await rows(source, desc.table, options.limit);
      if (result.affected !== undefined) throw new BridgeError(D.t('bridge.err.notaquery'), 0);
      return toTable(result);
    }

    /** Whether the user lets the app fetch through the bridge when a service does not allow the browser; off by default. */
    async function relayEnabled() { if (relayOn === null) relayOn = !!(await idb.getSetting(RELAY_KEY, false)); return relayOn; }
    /** @param {boolean} on */
    async function setRelay(on) { relayOn = !!on; await idb.setSetting(RELAY_KEY, relayOn); notify(); }
    /** True when a request may go through the bridge: the user has chosen it, a bridge is connected, and it can fetch. */
    async function canRelay() {
      if (!(await relayEnabled()) || !connection()) return false;
      try { return !!(await info()).fetch; } catch (_e) { return false; }
    }
    function toBase64(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
      return btoa(s);
    }
    function fromBase64(text) {
      const s = atob(String(text || ''));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
    /**
     * Fetch an address through the bridge (POST /fetch): the bridge fetches it and hands back the status, a few headers and the
     * body. A host the bridge was not started with is refused by the bridge, with the reason.
     * @param {string} url @param {{method?: string, headers?: Record<string, string>, body?: any}} [init] @returns {Promise<Response>}
     */
    async function relay(url, init = {}) {
      let body;
      if (init.body !== undefined && init.body !== null) {
        const b = init.body;
        body = toBase64(typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new TextEncoder().encode(String(b)));
      }
      const out = await call('/fetch', { url, method: init.method || 'GET', headers: init.headers || {}, body });
      const empty = [101, 204, 205, 304].includes(Number(out.status));
      return new Response(empty ? null : fromBase64(out.body), { status: Number(out.status), statusText: String(out.statusText || ''), headers: out.headers || {} });
    }

    /** The source last opened in the bridge view: the SQL console in Analysera can run against it. */
    function setCurrent(source) { current = source ? Object.assign({}, source) : null; notify(); }
    function getCurrent() { return current; }
    /** Tests replace the network with a function (url, init) => Response-like {ok, status, json()}. */
    function setTransport(fn) { transport = fn || null; infoCache = null; }

    return { ID, TYPES, BridgeError, call, relayEnabled, setRelay, canRelay, relay, connect, disconnect, persist, rememberedUrl, remembered, remember, forget, isConnected, connection, info, sources, tables, columns, rows, query, importTable, refetch, toTable, sanitize, sourceLabel, setCurrent, getCurrent, subscribe, setTransport };
  });
})();
