// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * API credentials. Default: kept in memory for this session only. Optionally persisted in IndexedDB
 * encrypted with a passphrase (PBKDF2-SHA-256 -> AES-GCM-256). Under file:// every local HTML page
 * shares the same storage origin in Chromium, so secrets are never written in clear text.
 * Keys in the settings store: `api:secret:<connectorId>` and `api:secretcheck` (passphrase check).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/secrets', ['platform/storage/idb'], (idb) => {
    const PREFIX = 'api:secret:';
    const CHECK_KEY = 'api:secretcheck';
    const CHECK_TEXT = 'dataspatium-secrets-v1';
    const ITERATIONS = 200000;
    /** @type {Map<string, Record<string, string>>} */
    const session = new Map();
    let unlocked = false;
    const listeners = new Set();

    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

    async function deriveKey(passphrase, salt) {
      const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function encrypt(passphrase, text) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(passphrase, salt);
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
      return { v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
    }
    async function decrypt(passphrase, record) {
      const key = await deriveKey(passphrase, fromB64(record.salt));
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(record.iv) }, key, fromB64(record.data));
        return dec.decode(plain);
      } catch (_err) { throw new Error('Fel lösenfras.'); }
    }

    /** Credentials for a connector in this session, or null. */
    function get(connectorId) { return session.get(connectorId) || null; }
    function has(connectorId) { return session.has(connectorId); }
    /** Keep credentials for this session only. */
    function set(connectorId, values) { session.set(connectorId, Object.assign({}, values)); notify(); }
    /** Forget credentials in memory and, if stored, on disk. */
    async function forget(connectorId) { session.delete(connectorId); await idb.deleteSetting(PREFIX + connectorId); notify(); }

    async function persistedIds() { return (await idb.listSettings(PREFIX)).map((row) => row.key.slice(PREFIX.length)); }
    async function isPersisted(connectorId) { return (await idb.getSetting(PREFIX + connectorId, null)) !== null; }
    async function hasPersisted() { return (await persistedIds()).length > 0; }
    function isUnlocked() { return unlocked; }

    /** Verify (or establish) the passphrase shared by all persisted secrets. */
    async function verifyPassphrase(passphrase) {
      const check = await idb.getSetting(CHECK_KEY, null);
      if (!check) { await idb.setSetting(CHECK_KEY, await encrypt(passphrase, CHECK_TEXT)); return true; }
      try { return (await decrypt(passphrase, check)) === CHECK_TEXT; } catch (_err) { return false; }
    }

    /** Store credentials encrypted with the passphrase and keep them in the session. */
    async function persist(connectorId, values, passphrase) {
      if (!passphrase || passphrase.length < 6) throw new Error('Lösenfrasen måste ha minst 6 tecken.');
      if (!(await verifyPassphrase(passphrase))) throw new Error('Fel lösenfras. Använd samma lösenfras som för dina andra sparade nycklar.');
      await idb.setSetting(PREFIX + connectorId, await encrypt(passphrase, JSON.stringify(values)));
      session.set(connectorId, Object.assign({}, values));
      unlocked = true;
      notify();
    }

    /** Decrypt every persisted secret into the session. Returns the number of connectors unlocked. */
    async function unlock(passphrase) {
      if (!(await verifyPassphrase(passphrase))) throw new Error('Fel lösenfras.');
      let n = 0;
      for (const row of await idb.listSettings(PREFIX)) {
        try { session.set(row.key.slice(PREFIX.length), JSON.parse(await decrypt(passphrase, row.value))); n++; } catch (err) { D.log('secrets', 'could not decrypt', row.key, err); }
      }
      unlocked = true;
      notify();
      return n;
    }

    /** Forget everything in memory (persisted secrets stay and can be unlocked again). */
    function lock() { session.clear(); unlocked = false; notify(); }

    /** Remove all persisted secrets and the passphrase check (keeps the session). */
    async function clearPersisted() {
      for (const row of await idb.listSettings(PREFIX)) await idb.deleteSetting(row.key);
      await idb.deleteSetting(CHECK_KEY);
      unlocked = false;
      notify();
    }

    /** Replace secret values in a string with bullets (for logs and the request panel). */
    function mask(text, connectorId) {
      const values = session.get(connectorId);
      let out = String(text);
      if (values) for (const v of Object.values(values)) if (v && v.length >= 4) out = out.split(v).join('•••').split(encodeURIComponent(v)).join('•••');
      return out;
    }

    return { get, has, set, forget, persist, unlock, lock, isPersisted, persistedIds, hasPersisted, isUnlocked, clearPersisted, mask, subscribe, encrypt, decrypt };
  });
})();
