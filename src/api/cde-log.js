// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The CDE log: every request the app sends to an OpenCDE server, for debugging and for learning the APIs. In memory only (a ring
 * of 500 entries), never stored, never sent. Each entry names the API (Foundation, BCF, Documents) and the operation the path
 * belongs to, the status, the time it took, the headers with tokens and cookies masked, and, only when the user asked for bodies,
 * the request and response bodies (text up to a limit; binaries as a size). A request id travels in X-Request-Id when the
 * connector asks for it, so that the server's own log can be matched line by line.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/cde-log', [], () => {
    const MAX = 500;
    const BODY_MAX = 64 * 1024;
    /** @type {any[]} */
    const entries = [];
    const listeners = new Set();
    let seq = 0;
    let bodies = false;
    try { bodies = localStorage.getItem('dataspatium.cdelog.bodies') === '1'; } catch (_e) { /* storage may be blocked */ }

    /** Path patterns to the API and operation of the specifications, most specific first. */
    const OPERATIONS = [
      [/\/\.well-known\/kontroll$/, 'kontroll', 'capabilities'],
      [/\/foundation\/versions$/, 'foundation', 'versions'],
      [/\/foundation\/[\d.]+\/auth$/, 'foundation', 'auth'],
      [/\/foundation\/[\d.]+\/current-user$/, 'foundation', 'current_user'],
      [/\/oauth2\/reg$/, 'foundation', 'register'],
      [/\/oauth2\/revoke$|\/revoke$/, 'foundation', 'revoke'],
      [/\/oauth2\/token$|\/token$/, 'foundation', 'token'],
      [/\/oauth2\/auth$|\/authorize$/, 'foundation', 'authorize'],
      [/\/documents\/[\d.]+\/upload-documents$/, 'documents', 'upload_documents'],
      [/\/documents\/[\d.]+\/select-documents$/, 'documents', 'select_documents'],
      [/\/documents\/[\d.]+\/document-versions$/, 'documents', 'document_versions'],
      [/\/documents\/[\d.]+\/documents\/[^/]+\/versions\/[^/]+\/download$/, 'documents', 'download'],
      [/\/documents\/[\d.]+\/documents\/[^/]+\/versions$/, 'documents', 'versions'],
      [/\/documents\/[\d.]+\/documents\/[^/]+\/versions\/[^/]+$/, 'documents', 'version'],
      [/\/upload-sessions\/[^/]+\/instructions$/, 'documents', 'upload_instructions'],
      [/\/complete$/, 'documents', 'upload_complete'],
      [/\/upload-part\/|\/parts?\//, 'documents', 'upload_part'],
      [/\/bcf\/[\d.]+\/projects$/, 'bcf', 'projects'],
      [/\/bcf\/[\d.]+\/projects\/[^/]+$/, 'bcf', 'project'],
      [/\/extensions$/, 'bcf', 'extensions'],
      [/\/files_information$/, 'bcf', 'files_information'],
      [/\/topics\/[^/]+\/files$/, 'bcf', 'topic_files'],
      [/\/topics\/[^/]+\/document_references(\/[^/]+)?$/, 'bcf', 'document_references'],
      [/\/topics\/[^/]+\/related_topics$/, 'bcf', 'related_topics'],
      [/\/topics\/[^/]+\/comments\/[^/]+\/events$/, 'bcf', 'comment_events'],
      [/\/topics\/[^/]+\/events$/, 'bcf', 'topic_events'],
      [/\/topics\/events$/, 'bcf', 'events'],
      [/\/topics\/[^/]+\/comments\/[^/]+$/, 'bcf', 'comment'],
      [/\/topics\/[^/]+\/comments$/, 'bcf', 'comments'],
      [/\/viewpoints\/[^/]+\/(selection|coloring|visibility|snapshot|bitmaps)$/, 'bcf', 'viewpoint_'],
      [/\/topics\/[^/]+\/viewpoints\/[^/]+$/, 'bcf', 'viewpoint'],
      [/\/topics\/[^/]+\/viewpoints$/, 'bcf', 'viewpoints'],
      [/\/topics\/[^/]+$/, 'bcf', 'topic'],
      [/\/topics$/, 'bcf', 'topics'],
      [/\/documents\/[^/]+$/, 'bcf', 'document'],
      [/\/documents$/, 'bcf', 'documents'],
    ];
    const MASKED = /^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)$/i;
    const KEPT_RESPONSE = ['content-type', 'content-length', 'etag', 'last-modified', 'cache-control', 'x-request-id', 'location', 'content-disposition', 'retry-after', 'x-ratelimit-remaining'];

    /** The API and operation of a path. @param {string} method @param {string} url */
    function classify(method, url) {
      const path = (() => { try { return new URL(url).pathname; } catch (_e) { return String(url).split('?')[0]; } })();
      for (const [re, api, op] of OPERATIONS) {
        const m = re.exec(path);
        if (m) return { api, operation: op.endsWith('_') ? op + m[1] : op, path };
      }
      return { api: 'other', operation: method.toLowerCase(), path };
    }
    /** Headers with secrets masked. @param {any} headers object or Headers */
    function redactHeaders(headers) {
      const out = {};
      // A scheme (Bearer, Basic) stays readable; the secret itself never does.
      const add = (k, v) => { out[k] = MASKED.test(k) ? ((/^(bearer|basic|digest)\s/i.test(String(v)) ? String(v).split(' ')[0] + ' ' : '') + '«dold»') : String(v); };
      if (!headers) return out;
      if (typeof headers.forEach === 'function' && !Array.isArray(headers) && !(headers.constructor === Object)) headers.forEach((v, k) => add(k, v));
      else for (const [k, v] of Object.entries(headers)) add(k, v);
      return out;
    }
    function keptResponseHeaders(headers) {
      const out = {};
      if (!headers || typeof headers.get !== 'function') return out;
      for (const k of KEPT_RESPONSE) { const v = headers.get(k); if (v !== null && v !== undefined) out[k] = v; }
      return out;
    }
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return String(url); } };
    function notify() { for (const fn of Array.from(listeners)) { try { fn(); } catch (err) { console.error('[cde-log]', err); } } }
    const randomId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const textOf = (body) => (typeof body === 'string' ? body : body && typeof body.byteLength === 'number' ? null : body && typeof body.size === 'number' ? null : body === undefined || body === null ? null : String(body));
    const sizeOf = (body) => (typeof body === 'string' ? new TextEncoder().encode(body).byteLength : body && typeof body.byteLength === 'number' ? body.byteLength : body && typeof body.size === 'number' ? body.size : 0);

    /**
     * Starts an entry for a request about to go; the returned function finishes it with the response (or the error). Sets
     * X-Request-Id on the request when the connector asks for it (`connector.requestId`).
     * @param {any} connector the connector, or {id: null, baseUrl} before one exists
     * @param {any} req {url, method, headers, body}
     * @param {{kind?: 'token'|'part'|'binary'|'json'}} [extra] token requests never log their bodies; parts and binaries log sizes
     * @returns {(res: any, err?: any) => void}
     */
    function begin(connector, req, extra = {}) {
      const method = String(req.method || 'GET').toUpperCase();
      const { api, operation, path } = classify(method, req.url);
      const id = randomId();
      // On by default for a saved connector; the user, or a server whose CORS refuses the header, turns it off (requestId: false).
      const wantsId = !!(connector && connector.id && connector.requestId !== false);
      if (wantsId) { req.headers = Object.assign({}, req.headers || {}, { 'X-Request-Id': id }); }
      const entry = {
        id, at: new Date().toISOString(), connectorId: connector ? connector.id || null : null, host: hostOf(req.url), method, url: String(req.url), path, api, operation,
        kind: extra.kind || 'json', status: null, ok: null, ms: null, requestId: wantsId ? id : null,
        requestHeaders: redactHeaders(req.headers), responseHeaders: {}, requestBytes: sizeOf(req.body), responseBytes: 0,
        requestBody: bodies && extra.kind !== 'token' && extra.kind !== 'part' ? clip(textOf(req.body)) : null, responseBody: null, error: null,
      };
      entries.push(entry);
      if (entries.length > MAX) entries.shift();
      const t0 = performance.now();
      notify();
      return (res, err) => {
        entry.ms = Math.round(performance.now() - t0);
        if (res) {
          entry.status = res.status; entry.ok = !!res.ok;
          entry.responseHeaders = keptResponseHeaders(res.headers);
          entry.responseBytes = res.buffer ? res.buffer.byteLength : sizeOf(res.text || '');
          if (bodies && extra.kind !== 'token') entry.responseBody = res.buffer ? null : clip(res.text || '');
        }
        if (err) entry.error = String((err && err.message) || err);
        notify();
      };
    }
    const clip = (s) => (s === null || s === undefined ? null : s.length > BODY_MAX ? s.slice(0, BODY_MAX) + ' …' : s);

    /** The entries, newest last; for one connector when an id is given. */
    function list(connectorId) { return connectorId ? entries.filter((e) => e.connectorId === connectorId) : entries.slice(); }
    function clear(connectorId) {
      if (!connectorId) entries.length = 0;
      else for (let i = entries.length - 1; i >= 0; i--) if (entries[i].connectorId === connectorId) entries.splice(i, 1);
      notify();
    }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function setBodies(flag) { bodies = !!flag; try { localStorage.setItem('dataspatium.cdelog.bodies', bodies ? '1' : '0'); } catch (_e) { /* fine */ } notify(); }
    /** The log as JSON text (what the viewer shows, nothing more). */
    function toJson(connectorId) { return JSON.stringify(list(connectorId), null, 2); }
    /** The log as a table, for a dataset: one row per request. */
    function toTable(connectorId) {
      const columns = ['tid', 'metod', 'api', 'operation', 'sokvag', 'status', 'ms', 'request_id', 'bytes_ut', 'bytes_in', 'fel'];
      const rows = list(connectorId).map((e) => [e.at, e.method, e.api, e.operation, e.path, e.status, e.ms, e.requestId, e.requestBytes, e.responseBytes, e.error]);
      return { columns, rows, meta: {} };
    }
    /** A curl line for an entry: the address, method and headers, with the token masked, the body when it was kept. */
    function toCurl(entry) {
      const parts = ['curl', '-X', entry.method, JSON.stringify(entry.url)];
      for (const [k, v] of Object.entries(entry.requestHeaders || {})) parts.push('-H', JSON.stringify(`${k}: ${v}`));
      if (entry.requestBody) parts.push('--data', JSON.stringify(entry.requestBody));
      return parts.join(' ');
    }
    /** Counts per API and status class, for the card's summary. */
    function summary(connectorId) {
      const out = { total: 0, failed: 0, ms: 0, apis: {} };
      for (const e of list(connectorId)) {
        out.total++; out.ms += e.ms || 0;
        if (e.ok === false || e.error) out.failed++;
        out.apis[e.api] = (out.apis[e.api] || 0) + 1;
      }
      return out;
    }

    return { begin, classify, redactHeaders, list, clear, subscribe, setBodies, bodies: () => bodies, toJson, toTable, toCurl, summary, MAX, BODY_MAX };
  });
})();
