// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * HTTP layer for API connectors: rate limiting per connector, timeouts, retries on 429/503 (and on 500, 502
 * and 504 for GET), an optional user-run proxy for services without CORS, and Swedish error messages that
 * say what to do.
 * fetch() against https hosts works from file:// when the service sends Access-Control-Allow-Origin.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/http', ['platform/storage/idb'], (idb) => {
    const PROXY_KEY = 'api:proxy';
    /** @type {Map<string, number[]>} request timestamps per rate-limit key */
    const buckets = new Map();
    /** @type {Map<string, Promise<void>>} serialises throttle decisions per key */
    const chains = new Map();
    let proxy = null;

    class ApiError extends Error {
      /** @param {string} message @param {{kind: string, status?: number, url?: string, detail?: string, code?: string, cause?: any}} info */
      constructor(message, info) { super(message); this.name = 'ApiError'; Object.assign(this, info); }
    }

    const sleep = (ms, signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(new ApiError('Avbrutet.', { kind: 'aborted' })); }, { once: true });
    });

    /** Wait until a request is allowed under `limit` ({requests, perSeconds}) for `key`. */
    function throttle(key, limit, signal) {
      if (!limit || !limit.requests) return Promise.resolve();
      const run = async () => {
        const windowMs = limit.perSeconds * 1000;
        for (;;) {
          const now = Date.now();
          const stamps = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
          buckets.set(key, stamps);
          if (stamps.length < limit.requests) { stamps.push(now); return; }
          await sleep(stamps[0] + windowMs - now + 20, signal);
        }
      };
      const next = (chains.get(key) || Promise.resolve()).then(run, run);
      chains.set(key, next.catch(() => {}));
      return next;
    }

    async function getProxy() { if (proxy === null) proxy = (await idb.getSetting(PROXY_KEY, '')) || ''; return proxy; }
    async function setProxy(url) { proxy = String(url || '').trim(); await idb.setSetting(PROXY_KEY, proxy); return proxy; }
    function applyProxy(url, proxyUrl) {
      if (!proxyUrl || !/^https?:/i.test(url)) return url;
      return proxyUrl.includes('{url}') ? proxyUrl.replace('{url}', encodeURIComponent(url)) : proxyUrl + url;
    }

    function hostOf(url) { try { return new URL(url).host; } catch (_e) { return url; } }

    /** Swedish explanation of an HTTP status. */
    function describeStatus(status) {
      if (status === 400) return D.t('api.http.400');
      if (status === 401) return D.t('api.http.401');
      if (status === 403) return D.t('api.http.403');
      if (status === 404) return D.t('api.http.404');
      if (status === 429) return D.t('api.http.429');
      if (status >= 500) return D.t('api.http.5xx', { status });
      return D.t('api.http.other', { status });
    }

    /**
     * Perform a request.
     * @param {{url: string, method?: string, headers?: Record<string, string>, body?: any, signal?: AbortSignal, timeoutMs?: number, notModifiedOk?: boolean, rateKey?: string, rateLimit?: {requests: number, perSeconds: number}, retries?: number, responseType?: 'text'|'arraybuffer', ask?: boolean, cors?: {file?: boolean, web?: boolean}}} req
     *   `cors`: what was measured for the source (api/reach), so that a refused request names the bridge
     * @returns {Promise<{ok: boolean, status: number, statusText: string, headers: Headers, url: string, text: string, buffer: ArrayBuffer|null, contentType: string, ms: number}>}
     */
    async function request(req) {
      // Real servers are contacted only with the user's consent for API fetches (asked once); the app's own
      // virtual sources (dataspatium-asset://, used by presets and tests) never leave the page.
      // `ask: false` (a flow at start): only a consent already kept lets the request go out.
      if (!/^dataspatium-asset:/.test(String(req.url))) await D.require('platform/consent').require('api', { host: hostOf(req.url), ask: req.ask });
      const proxyUrl = await getProxy();
      const url = applyProxy(req.url, proxyUrl);
      const retries = req.retries === undefined ? 2 : req.retries;
      let attempt = 0;
      for (;;) {
        await throttle(req.rateKey || hostOf(req.url), req.rateLimit, req.signal);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), req.timeoutMs || 90000);
        const onAbort = () => controller.abort();
        if (req.signal) { if (req.signal.aborted) { clearTimeout(timer); throw new ApiError('Avbrutet.', { kind: 'aborted' }); } req.signal.addEventListener('abort', onAbort, { once: true }); }
        const t0 = performance.now();
        let res;
        try {
          res = await fetch(url, { method: req.method || 'GET', headers: req.headers || {}, body: req.body === undefined ? undefined : req.body, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
        } catch (err) {
          clearTimeout(timer);
          if (req.signal && req.signal.aborted) throw new ApiError('Avbrutet.', { kind: 'aborted' });
          if (controller.signal.aborted) throw new ApiError(D.t('api.err.timeout', { host: hostOf(req.url) }), { kind: 'timeout', url: req.url });
          res = url === req.url ? await viaBridge(req) : null;
          if (!res) throw networkError(req, err, url !== req.url);
        } finally {
          if (req.signal) req.signal.removeEventListener('abort', onAbort);
        }
        clearTimeout(timer);
        const ms = performance.now() - t0;
        // Busy services (429, 503) are retried; for GET, which is safe to repeat, also passing server errors.
        const transient = res.status === 429 || res.status === 503 || ((req.method || 'GET').toUpperCase() === 'GET' && [500, 502, 504].includes(res.status));
        if (transient && attempt < retries) {
          attempt++;
          const retryAfter = Number(res.headers.get('Retry-After'));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1500 * attempt, req.signal);
          continue;
        }
        const contentType = res.headers.get('Content-Type') || '';
        // 304 means "what you have is still right": a good answer for a caller that asked with If-None-Match.
        const out = { ok: res.ok || (res.status === 304 && !!req.notModifiedOk), status: res.status, statusText: res.statusText, headers: res.headers, url: res.url || url, text: '', buffer: null, contentType, ms };
        if (req.responseType === 'arraybuffer') out.buffer = await res.arrayBuffer();
        else out.text = await res.text();
        return out;
      }
    }

    /**
     * The error of a request that never got an answer. A source marked as out of the browser's reach here (`req.cors`, what was
     * measured for it, api/reach) says so and how the bridge fetches it, instead of "no network or no CORS"; through the user's
     * own proxy the general text stands.
     * @param {{url: string, cors?: {file?: boolean, web?: boolean}}} req @param {any} cause @param {boolean} proxied
     */
    function networkError(req, cause, proxied) {
      const host = hostOf(req.url);
      const reach = D.require('api/reach');
      const why = req.cors && !proxied ? reach.blocked({ cors: req.cors }) : null;
      if (!why) return new ApiError(D.t('api.err.network', { host }), { kind: 'network', url: req.url, cause });
      const text = D.t('api.err.nocors', { host });
      return new ApiError(why === 'bridge' ? text : reach.hint(why) + ' ' + text, { kind: 'network', code: 'cors', url: req.url, cause });
    }

    /**
     * A service that does not let the browser read its answer (no CORS) fails like a network error. When the user has chosen
     * it in Internetåtkomst and a bridge that can fetch is connected, the request goes through the bridge on this computer
     * instead (F14.1); otherwise null, and the network error stands. Only https addresses go this way.
     */
    async function viaBridge(req) {
      if (!/^https:/i.test(String(req.url))) return null;
      const bridge = D.require('api/bridge');
      if (!(await bridge.canRelay())) return null;
      try { return await bridge.relay(String(req.url), { method: req.method || 'GET', headers: req.headers || {}, body: req.body }); }
      catch (err) { throw new ApiError(D.t('api.err.bridge', { host: hostOf(req.url), message: (err && err.message) || String(err) }), { kind: 'network', url: req.url, cause: err }); }
    }

    /** Build an ApiError from a non-OK response; an OGC exception report in the body gives the service's own text. */
    function httpError(res, context) {
      const ows = owsError(res.text, context);
      if (ows) return Object.assign(ows, { kind: 'http', status: res.status, url: res.url });
      const detail = (res.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      return new ApiError(`${context ? context + ': ' : ''}${describeStatus(res.status)}${detail ? ' Svar: ' + detail : ''}`, { kind: 'http', status: res.status, url: res.url, detail });
    }

    const ENTITIES = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
    /** Text content of an XML fragment: CDATA kept, tags dropped, entities decoded, white space collapsed. */
    const xmlText = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>|<[^>]*>|&(lt|gt|quot|apos|amp|#\d+);/g, (_m, cdata, ent) => (cdata !== undefined ? cdata : ent ? (ent[0] === '#' ? String.fromCharCode(Number(ent.slice(1))) : ENTITIES[ent]) : '')).replace(/\s+/g, ' ').trim();
    /**
     * The code, locator and text of an OGC exception report (ows:ExceptionReport of WFS, WMS and WCS, or the older
     * ServiceExceptionReport) when that is what a response body is, otherwise null. Regular expressions, so that it works
     * in workers too.
     * @param {string} text @returns {{code: string, locator: string, text: string}|null}
     */
    function owsException(text) {
      const s = String(text || '');
      if (!/^\s*</.test(s) || !/<(\w+:)?(ExceptionReport|ServiceExceptionReport)[\s>/]/.test(s.slice(0, 1500))) return null;
      const attr = (name) => xmlText((new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(s) || [])[1] || '');
      const texts = Array.from(s.matchAll(/<((?:\w+:)?(?:ExceptionText|ServiceException))\b[^>]*>([\s\S]*?)<\/\1>/g), (m) => xmlText(m[2])).filter(Boolean);
      return { code: attr('(?:exceptionCode|code)'), locator: attr('locator'), text: texts.join(' ').slice(0, 300) };
    }
    /**
     * An ApiError with the service's own message when a response body is an OGC exception report, otherwise null:
     * "Service WFS is disabled (ServiceUnavailable)" instead of "not valid JSON".
     * @param {string} text @param {string} [context] the source's name
     */
    function owsError(text, context) {
      const e = owsException(text);
      if (!e) return null;
      const what = [e.code, e.locator].filter(Boolean).join(', ');
      const message = D.t('api.err.service', { message: (e.text || e.code || '?') + (what && e.text ? ` (${what})` : '') });
      return new ApiError(`${context ? context + ': ' : ''}${message}`, { kind: 'service', code: e.code, detail: e.text });
    }

    /** Parse an RFC 8288 Link header and return the URL with the given rel, or null. */
    function linkHeader(value, rel) {
      if (!value) return null;
      for (const part of value.split(',')) {
        const m = part.match(/<([^>]+)>\s*;\s*(.*)$/);
        if (m && new RegExp(`rel\\s*=\\s*"?${rel}"?`).test(m[2])) return m[1].trim();
      }
      return null;
    }

    return { request, throttle, getProxy, setProxy, applyProxy, describeStatus, httpError, owsException, owsError, linkHeader, hostOf, ApiError, sleep };
  });
})();
