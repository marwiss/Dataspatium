// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Service worker for running Dataspatium from a web server (localhost, or https on an intranet or GitHub Pages).
 *
 * 1. It adds Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: credentialless to the app's
 *    own responses, which makes the page cross-origin isolated: SharedArrayBuffer becomes available, and with it
 *    webR's SharedArrayBuffer channel, so running R code can be interrupted. Calls to other sites (the open APIs)
 *    pass through untouched.
 * 2. It keeps the app's own files in a cache, so that an installed app (Add to Home Screen) works without a network
 *    after the first use: vendor/, presets/ and src/ are served from the cache once fetched (they only change with a
 *    new version, which brings a new cache name), the page itself is fetched first and taken from the cache offline.
 *
 * src/boot.js registers it only when the app is served over http(s); a page opened from a folder (file://) never
 * uses it. A server that sends the two headers itself still benefits from the cache.
 */
'use strict';

/** Changes with every release (tools/release and docs/utveckling.md), so old caches are dropped on activation. */
const CACHE = 'dataspatium-2.0.0';
const CACHE_FIRST = /\/(vendor|presets|src|r)\//;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE && name.startsWith('dataspatium-')) await caches.delete(name);
    await self.clients.claim();
  })());
});

function isolated(response) {
  if (!response || response.status === 0 || response.type === 'opaque') return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  if (request.method !== 'GET') { event.respondWith(fetch(request).then(isolated)); return; }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (CACHE_FIRST.test(url.pathname)) {
      const hit = await cache.match(request);
      if (hit) return isolated(hit);
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
      return isolated(fresh);
    }
    try {
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
      return isolated(fresh);
    } catch (err) {
      const hit = await cache.match(request);
      if (hit) return isolated(hit);
      throw err;
    }
  })());
});
