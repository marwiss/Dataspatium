// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Components on demand: files the app can fetch after consent (R packages from webR's repository, later Python,
 * plotly.js, OCR, background maps), verified against SHA-256 when a digest is known, kept in IndexedDB and listed
 * under Hantera with their size so they can be removed. The standard ZIP never needs this; it works without a network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/components', ['platform/storage/idb', 'platform/consent'], (idb, consent) => {
    const PARENT = 'component:';
    const listeners = new Set();
    const notify = () => { for (const fn of Array.from(listeners)) { try { fn(); } catch (err) { console.error('[components] listener failed', err); } } };
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    async function sha256Hex(buffer) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    /** Metadata of every cached component, newest first. */
    async function list() {
      const rows = await idb.listSettings(PARENT);
      return rows.map((r) => r.value).sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)));
    }
    async function meta(id) { return idb.getSetting(PARENT + id, null); }

    /** Cached bytes and metadata, or null. */
    async function cached(id) {
      const m = await meta(id);
      if (!m) return null;
      const bytes = await idb.loadBlob(PARENT + id);
      if (!bytes) { await idb.deleteSetting(PARENT + id).catch(() => {}); return null; }
      return { meta: m, bytes };
    }

    async function store(spec, bytes, digest, source) {
      await idb.saveBlob(PARENT + spec.id, bytes);
      const m = { id: spec.id, label: spec.label || spec.id, purpose: spec.purpose || 'components', sha256: digest, size: bytes.byteLength, source, fetchedAt: new Date().toISOString(), version: spec.version || null };
      await idb.setSetting(PARENT + spec.id, m);
      notify();
      return m;
    }

    async function remove(id) {
      await idb.deleteBlob(PARENT + id);
      await idb.deleteSetting(PARENT + id).catch(() => {});
      notify();
    }

    /**
     * The response body; with a progress callback it is read in chunks so that a large download (the Python runtime)
     * can be shown. `total` is the known uncompressed size, since Content-Length is the compressed one.
     * @param {Response} res @param {{id: string, size?: number|null}} spec @param {Function} [onProgress]
     */
    async function readBody(res, spec, onProgress) {
      if (!onProgress || !res.body || typeof res.body.getReader !== 'function') return res.arrayBuffer();
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        try { onProgress({ id: spec.id, received, total: spec.size || null }); } catch (err) { console.error('[components] progress listener failed', err); }
      }
      const out = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
      return out.buffer;
    }

    /**
     * The bytes of a component: from the cache when present (and matching the expected digest), otherwise
     * fetched from the first source that answers, after consent, and verified.
     * @param {{id: string, urls: string[], sha256?: string, size?: number, label?: string, purpose?: string, version?: string, maxAgeMs?: number}} spec
     * @param {{fetch?: Function, onProgress?: (info: {id: string, received: number, total: number|null}) => void}} [options]
     * @returns {Promise<ArrayBuffer>}
     */
    async function ensure(spec, options = {}) {
      const hit = await cached(spec.id);
      if (hit) {
        const fresh = !spec.maxAgeMs || Date.now() - Date.parse(hit.meta.fetchedAt) < spec.maxAgeMs;
        if (fresh && (!spec.sha256 || hit.meta.sha256 === spec.sha256)) return hit.bytes;
      }
      const first = spec.urls[0];
      await consent.require(spec.purpose || 'components', { host: consent.hostOf(first), label: spec.label || spec.id, size: spec.size || null });
      const doFetch = options.fetch || globalThis.fetch.bind(globalThis);
      let lastErr = null;
      for (const url of spec.urls) {
        try {
          const res = await doFetch(url);
          if (!res || !res.ok) throw new Error(D.t('components.err.status', { status: res ? res.status : '?', url }));
          const bytes = await readBody(res, spec, options.onProgress);
          const digest = await sha256Hex(bytes);
          if (spec.sha256 && digest !== spec.sha256) throw new Error(D.t('components.err.hash', { label: spec.label || spec.id }));
          await store(spec, bytes, digest, url);
          return bytes;
        } catch (err) { lastErr = err; D.log('components', 'source failed', url, err); }
      }
      throw lastErr || new Error(D.t('components.err.status', { status: '?', url: first }));
    }

    /** A text component (an index), with the same cache and consent rules. */
    async function text(spec, options = {}) {
      return new TextDecoder().decode(new Uint8Array(await ensure(spec, options)));
    }

    async function totalSize() { return (await list()).reduce((n, m) => n + (m.size || 0), 0); }

    return { list, meta, cached, ensure, text, remove, totalSize, subscribe, sha256Hex };
  });
})();
