// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Components on demand: files the app can fetch after consent (R packages from webR's repository, later Python,
 * plotly.js, OCR, background maps), verified against SHA-256 when a digest is known (webR's packages against the MD5 their
 * pinned index lists), kept in IndexedDB and listed
 * under Hantera with their size so they can be removed. The standard ZIP never needs this; it works without a network.
 *
 * A cached copy is hashed again at every use and compared with the digest pinned in the caller's spec, never with the
 * digest stored beside it: code in a worker, or another page on the same origin, can rewrite both rows.
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

    // MD5 (RFC 1321), which WebCrypto lacks: the only digest webR's repository publishes for its packages. It is trusted only as
    // a sum listed in an index that is itself pinned by SHA-256 (engines/r/remote-packages), where finding other bytes with the
    // same sum would take a second preimage, which nobody can compute for MD5.
    const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    const MD5_K = new Int32Array(64);
    for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    /** Runs the 64-byte blocks of view[start, end) into the state h. */
    function md5Blocks(h, view, start, end) {
      const x = new Int32Array(16);
      let a0 = h[0]; let b0 = h[1]; let c0 = h[2]; let d0 = h[3];
      for (let off = start; off < end; off += 64) {
        for (let j = 0; j < 16; j++) x[j] = view.getInt32(off + j * 4, true);
        let a = a0; let b = b0; let c = c0; let d = d0;
        for (let i = 0; i < 64; i++) {
          let f; let g;
          if (i < 16) { f = (b & c) | (~b & d); g = i; } else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; } else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; } else { f = c ^ (b | ~d); g = (7 * i) & 15; }
          const s = MD5_S[(i >> 4) * 4 + (i & 3)];
          const sum = (a + f + MD5_K[i] + x[g]) | 0;
          a = d; d = c; c = b;
          b = (b + ((sum << s) | (sum >>> (32 - s)))) | 0;
        }
        a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
      }
      h[0] = a0; h[1] = b0; h[2] = c0; h[3] = d0;
    }
    /**
     * The MD5 sum of the bytes in hex, a megabyte at a time with a pause between, so the page is never held long.
     * @param {ArrayBuffer|Uint8Array} buffer @returns {Promise<string>}
     */
    async function md5Hex(buffer) {
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const n = bytes.byteLength;
      const h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
      const view = new DataView(bytes.buffer, bytes.byteOffset, n);
      const full = n - (n % 64);
      const SLICE = 1 << 20;
      for (let at = 0; at < full; at += SLICE) {
        md5Blocks(h, view, at, Math.min(full, at + SLICE));
        if (at + SLICE < full) await new Promise((r) => setTimeout(r, 0));
      }
      // The last block: the rest, a one bit, zeros and the length in bits (64 bits, little-endian).
      const tail = new Uint8Array(n % 64 < 56 ? 64 : 128);
      tail.set(bytes.subarray(full));
      tail[n - full] = 0x80;
      const tv = new DataView(tail.buffer);
      tv.setUint32(tail.length - 8, (n << 3) >>> 0, true);
      tv.setUint32(tail.length - 4, Math.floor(n / 536870912), true);
      md5Blocks(h, tv, 0, tail.length);
      let out = '';
      for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) out += ((h[i] >>> (8 * k)) & 255).toString(16).padStart(2, '0');
      return out;
    }
    /** Whether the bytes have every digest the spec pins (SHA-256, and MD5 for a file an index pinned by SHA-256 lists). */
    async function matches(spec, bytes) {
      if (spec.sha256 && (await sha256Hex(bytes)) !== spec.sha256) return false;
      if (spec.md5 && (await md5Hex(bytes)) !== String(spec.md5).toLowerCase()) return false;
      return true;
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
    async function readBody(res, spec, onProgress, dl) {
      if (!res.body || typeof res.body.getReader !== 'function') { const buf = await res.arrayBuffer(); if (dl) dl.update(buf.byteLength); return buf; }
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (dl) dl.update(received);
        if (onProgress) { try { onProgress({ id: spec.id, received, total: spec.size || null }); } catch (err) { console.error('[components] progress listener failed', err); } }
      }
      const out = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
      return out.buffer;
    }

    /** The stored bytes as an ArrayBuffer of their own, or null when the row holds something else. */
    function ownBuffer(bytes) {
      if (bytes instanceof ArrayBuffer) return bytes;
      if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice().buffer;
      return null;
    }

    /**
     * The cached bytes when they may be used, without fetching: fresh, and with the spec's pinned digests when it has them.
     * The bytes are hashed at every call and compared with `spec.sha256` (and `spec.md5`), never with the stored row; a copy that
     * fails is removed, so that ensure() fetches it again after consent. The buffer returned is the one that was hashed. A row that
     * cannot be read (a chunk that is not bytes) goes the same way.
     * @param {{id: string, sha256?: string, md5?: string, maxAgeMs?: number}} spec
     * @returns {Promise<ArrayBuffer|null>}
     */
    async function verified(spec) {
      let hit;
      try { hit = await cached(spec.id); } catch (err) {
        console.warn('[components] the cached copy of ' + spec.id + ' cannot be read; removed, to be fetched again', err);
        await remove(spec.id).catch(() => {});
        return null;
      }
      if (!hit) return null;
      const fresh = !spec.maxAgeMs || Date.now() - Date.parse(hit.meta.fetchedAt) < spec.maxAgeMs;
      if (!fresh) return null;
      const bytes = ownBuffer(hit.bytes);
      if (bytes && (await matches(spec, bytes))) return bytes;
      console.warn('[components] the cached copy of ' + spec.id + ' is not the pinned file; removed, to be fetched again');
      await remove(spec.id);
      return null;
    }

    /**
     * The bytes of a component: from the cache when present (and matching the pinned digest), otherwise
     * fetched from the first source that answers, after consent, and verified. With `ask: false` (a flow at start) nothing
     * is asked: only a consent already kept lets it fetch, and otherwise it fails with a ConsentError. Bytes that fail a pinned
     * digest are never stored or used: the error says so and carries `integrity: true`.
     * @param {{id: string, urls: string[], sha256?: string, md5?: string, size?: number, label?: string, purpose?: string, version?: string, maxAgeMs?: number}} spec
     *   `md5` only for a file listed with that sum in an index pinned by SHA-256 (webR's repository publishes no other digest)
     * @param {{fetch?: Function, onProgress?: (info: {id: string, received: number, total: number|null}) => void, ask?: boolean}} [options]
     * @returns {Promise<ArrayBuffer>}
     */
    async function ensure(spec, options = {}) {
      // Every component has a pinned digest (decision F118 a): its own SHA-256, or the MD5 of a file listed in an index pinned by
      // SHA-256 (webR's packages). A spec without either is refused before anything is asked or fetched.
      if (!/^[0-9a-f]{64}$/i.test(String(spec && spec.sha256 || '')) && !/^[0-9a-f]{32}$/i.test(String(spec && spec.md5 || ''))) {
        throw new Error(D.t('components.err.nodigest', { label: (spec && (spec.label || spec.id)) || '?' }));
      }
      const hit = await verified(spec);
      if (hit) return hit;
      const first = spec.urls[0];
      const purpose = spec.purpose || 'components';
      await consent.require(purpose, { host: consent.hostOf(first), label: spec.label || spec.id, size: spec.size || null, ask: options.ask });
      const doFetch = options.fetch || globalThis.fetch.bind(globalThis);
      let lastErr = null;
      for (const url of spec.urls) {
        // Listed in platform/downloads with its bytes and speed; the status bar's abort stops the fetch here.
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const dl = D.downloads ? D.downloads.begin({ id: spec.id, name: spec.id, label: spec.label || spec.id, total: spec.size || null, abort: () => { if (controller) controller.abort(); } }) : null;
        try {
          const res = await doFetch(url, controller ? { signal: controller.signal } : undefined);
          if (!res || !res.ok) throw new Error(D.t('components.err.status', { status: res ? res.status : '?', url }));
          const bytes = await readBody(res, spec, options.onProgress, dl);
          const digest = await sha256Hex(bytes);
          if ((spec.sha256 && digest !== spec.sha256) || (spec.md5 && (await md5Hex(bytes)) !== String(spec.md5).toLowerCase())) {
            throw Object.assign(new Error(D.t('components.err.hash', { label: spec.label || spec.id })), { integrity: true });
          }
          await store(spec, bytes, digest, url);
          if (dl) dl.done();
          return bytes;
        } catch (err) {
          if (dl && dl.aborted) {
            const e = /** @type {any} */ (new Error(D.t('components.err.aborted', { label: spec.label || spec.id })));
            e.aborted = true;
            throw e;
          }
          if (dl) dl.fail(err);
          lastErr = err; D.log('components', 'source failed', url, err);
        }
      }
      throw lastErr || new Error(D.t('components.err.status', { status: '?', url: first }));
    }

    /** A text component (an index), with the same cache and consent rules. */
    async function text(spec, options = {}) {
      return new TextDecoder().decode(new Uint8Array(await ensure(spec, options)));
    }

    async function totalSize() { return (await list()).reduce((n, m) => n + (m.size || 0), 0); }

    return { list, meta, cached, verified, ensure, text, remove, totalSize, subscribe, sha256Hex, md5Hex };
  });
})();
