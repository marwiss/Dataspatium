// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * WebSocket transport for sources that speak a socket protocol (Neo4j's Bolt over WebSocket in 2.9, streaming
 * APIs): consent per purpose before connecting, JSON framing by default, request/response pairing on an id
 * field, listeners for messages, close and errors. Tests inject a fake socket class with setFactory().
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/websocket', ['platform/consent'], (consent) => {
    let factory = null;
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return String(url); } };

    /**
     * Open a socket; resolves when it is open.
     * @param {string} url ws:// or wss://
     * @param {{purpose?: string, protocols?: string|string[], binaryType?: 'blob'|'arraybuffer', json?: boolean, idField?: string, timeoutMs?: number}} [options]
     */
    async function connect(url, options = {}) {
      await consent.require(options.purpose || 'databases', { host: hostOf(url) });
      const WS = factory || globalThis.WebSocket;
      if (typeof WS !== 'function') throw new Error(D.t('ws.err.unsupported'));
      const ws = options.protocols ? new WS(url, options.protocols) : new WS(url);
      if (options.binaryType) ws.binaryType = options.binaryType;
      const session = createSession(ws, url, options);
      await session.opened;
      return session;
    }

    function createSession(ws, url, options) {
      /** @type {Map<string, Set<Function>>} */
      const listeners = new Map();
      /** @type {Map<any, {resolve: Function, reject: Function, timer: any}>} */
      const pending = new Map();
      const idField = options.idField || 'id';
      let seq = 0;
      const emit = (event, payload) => { for (const fn of Array.from(listeners.get(event) || [])) { try { fn(payload); } catch (err) { console.error(err); } } };
      const on = (event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); return () => listeners.get(event).delete(fn); };
      const failPending = (message) => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); } pending.clear(); };
      const opened = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { try { ws.close(); } catch (_e) { /* ignore */ } reject(new Error(D.t('ws.err.timeout'))); }, options.timeoutMs || 20000);
        ws.addEventListener('open', () => { clearTimeout(timer); resolve(undefined); }, { once: true });
        ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(D.t('ws.err.connection', { url }))); }, { once: true });
      });
      opened.catch(() => {});
      ws.addEventListener('message', (e) => {
        let data = e.data;
        if (typeof data === 'string' && options.json !== false) { try { data = JSON.parse(data); } catch (_err) { /* plain text stays text */ } }
        if (data && typeof data === 'object' && !Array.isArray(data) && pending.has(data[idField])) {
          const p = pending.get(data[idField]);
          pending.delete(data[idField]);
          clearTimeout(p.timer);
          if (data.error) p.reject(new Error(typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error)))); else p.resolve(data);
          return;
        }
        emit('message', data);
      });
      ws.addEventListener('close', (e) => { failPending(D.t('ws.err.closed')); emit('close', { code: e && e.code, reason: e && e.reason }); });
      ws.addEventListener('error', () => { emit('error', new Error(D.t('ws.err.connection', { url }))); });
      function send(message) {
        const raw = typeof message === 'string' || message instanceof ArrayBuffer || ArrayBuffer.isView(message) || (typeof Blob !== 'undefined' && message instanceof Blob) ? message : JSON.stringify(message);
        ws.send(raw);
      }
      /** Send an object and resolve with the reply that carries the same id (a reply with `error` rejects). */
      function request(message, timeoutMs = 30000) {
        const id = message[idField] !== undefined ? message[idField] : ++seq;
        const body = Object.assign({}, message, { [idField]: id });
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { pending.delete(id); reject(new Error(D.t('ws.err.timeout'))); }, timeoutMs);
          pending.set(id, { resolve, reject, timer });
          try { send(body); } catch (err) { clearTimeout(timer); pending.delete(id); reject(err); }
        });
      }
      function close(code, reason) { try { ws.close(code, reason); } catch (_e) { /* ignore */ } }
      return { url, ws, opened, on, send, request, close, get state() { return ws.readyState; }, get pending() { return pending.size; } };
    }

    /** Tests replace the socket class (same events open, message, close and error; same send, close and readyState). */
    function setFactory(fn) { factory = fn || null; }
    return { connect, setFactory };
  });
})();
