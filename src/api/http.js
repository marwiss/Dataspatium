// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * HTTP layer for API connectors: rate limiting per connector, timeouts, retries on 429/503, an
 * optional user-run proxy for services without CORS, and Swedish error messages that say what to do.
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
      /** @param {string} message @param {{kind: string, status?: number, url?: string, detail?: string, cause?: any}} info */
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
     * @param {{url: string, method?: string, headers?: Record<string, string>, body?: any, signal?: AbortSignal, timeoutMs?: number, rateKey?: string, rateLimit?: {requests: number, perSeconds: number}, retries?: number, responseType?: 'text'|'arraybuffer'}} req
     * @returns {Promise<{ok: boolean, status: number, statusText: string, headers: Headers, url: string, text: string, buffer: ArrayBuffer|null, contentType: string, ms: number}>}
     */
    async function request(req) {
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
          throw new ApiError(D.t('api.err.network', { host: hostOf(req.url) }), { kind: 'network', url: req.url, cause: err });
        } finally {
          if (req.signal) req.signal.removeEventListener('abort', onAbort);
        }
        clearTimeout(timer);
        const ms = performance.now() - t0;
        if ((res.status === 429 || res.status === 503) && attempt < retries) {
          attempt++;
          const retryAfter = Number(res.headers.get('Retry-After'));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1500 * attempt, req.signal);
          continue;
        }
        const contentType = res.headers.get('Content-Type') || '';
        const out = { ok: res.ok, status: res.status, statusText: res.statusText, headers: res.headers, url: res.url || url, text: '', buffer: null, contentType, ms };
        if (req.responseType === 'arraybuffer') out.buffer = await res.arrayBuffer();
        else out.text = await res.text();
        return out;
      }
    }

    /** Build an ApiError from a non-OK response. */
    function httpError(res, context) {
      const detail = (res.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      return new ApiError(`${context ? context + ': ' : ''}${describeStatus(res.status)}${detail ? ' Svar: ' + detail : ''}`, { kind: 'http', status: res.status, url: res.url, detail });
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

    return { request, throttle, getProxy, setProxy, applyProxy, describeStatus, httpError, linkHeader, hostOf, ApiError, sleep };
  });
})();
