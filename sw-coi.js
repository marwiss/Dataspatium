// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Service worker for running Dataspatium from a web server (localhost, or https on an intranet). It adds
 * Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: credentialless to the app's own
 * responses, which makes the page cross-origin isolated: SharedArrayBuffer becomes available, and with it webR's
 * SharedArrayBuffer channel, so running R code can be interrupted. Calls to other sites (the open APIs) pass
 * through untouched.
 *
 * src/boot.js registers it only when the app is served over http(s); a page opened from a folder (file://) never
 * uses it. A server that sends these headers itself does not need it.
 */
'use strict';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(fetch(request).then((response) => {
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }));
});
