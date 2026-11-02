// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Connector registry: presets embedded under presets/api/*.api.json (see tools/wrap_local.py) and
 * connectors the user has imported, stored in the settings table. Import validates against the schema;
 * export produces a shareable JSON file that never contains credentials.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/connectors', ['api/schema', 'platform/storage/idb'], (schema, idb) => {
    const PRESET_PREFIX = 'presets/api/';
    const USER_KEY = 'api:connectors';
    let presets = null;
    let users = null;
    const listeners = new Set();
    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    async function loadPresets() {
      if (presets) return presets;
      const out = [];
      for (const name of D.assets.names(PRESET_PREFIX).filter((n) => n.endsWith('.api.json'))) {
        try {
          const obj = JSON.parse(await D.assets.loadText(name));
          const errors = schema.validate(obj);
          if (errors.length) { D.log('api', 'ogiltig förinställning', name, errors); continue; }
          obj.preset = true;
          out.push(obj);
        } catch (err) { D.log('api', 'kunde inte läsa förinställning', name, err); }
      }
      out.sort((a, b) => (a.level || 1) - (b.level || 1) || a.name.localeCompare(b.name, 'sv'));
      presets = out;
      return presets;
    }
    async function loadUsers() {
      if (!users) users = ((await idb.getSetting(USER_KEY, [])) || []).map((c) => Object.assign({}, c, { preset: false }));
      return users;
    }
    async function saveUsers() { await idb.setSetting(USER_KEY, users.map((c) => strip(c))); notify(); }

    /** All connectors; a user connector with the same id as a preset replaces the preset. */
    async function list() {
      const [p, u] = await Promise.all([loadPresets(), loadUsers()]);
      const ids = new Set(u.map((c) => c.id));
      return p.filter((c) => !ids.has(c.id)).concat(u);
    }
    async function get(id) { return (await list()).find((c) => c.id === id) || null; }

    /** Copy without runtime fields. */
    function strip(connector) {
      const out = Object.assign({}, connector);
      delete out.preset;
      return out;
    }

    /** Validate and store a connector from JSON text (file import or paste). */
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error('Filen är inte giltig JSON.'); }
      const errors = schema.validate(obj);
      if (errors.length) throw new Error('Konfigurationen är ogiltig: ' + errors.slice(0, 5).join('; ') + (errors.length > 5 ? ` (+${errors.length - 5} till)` : ''));
      await loadUsers();
      const clean = strip(obj);
      const i = users.findIndex((c) => c.id === clean.id);
      const stored = Object.assign({}, clean, { preset: false });
      if (i >= 0) users[i] = stored; else users.push(stored);
      await saveUsers();
      return stored;
    }
    /** Store a connector object (already validated by the caller or built in the app). */
    async function save(connector) { return importJson(JSON.stringify(strip(connector))); }
    async function remove(id) { await loadUsers(); users = users.filter((c) => c.id !== id); await saveUsers(); }
    function exportJson(connector) { return JSON.stringify(strip(connector), null, 2) + '\n'; }

    /** Short Swedish description of the authentication requirement. */
    function describeAuth(connector) {
      const auth = connector.auth || { type: 'none' };
      switch (auth.type) {
        case 'none': return 'Ingen nyckel behövs';
        case 'apiKey': return `API-nyckel (${auth.in === 'query' ? 'frågeparameter' : 'header'} ${auth.name})`;
        case 'basic': return 'Användarnamn och lösenord';
        case 'bearer': return 'Åtkomsttoken';
        case 'oauth2_client_credentials': return 'OAuth2 med klient-id och klienthemlighet';
        default: return auth.type;
      }
    }

    return { list, get, importJson, save, remove, exportJson, describeAuth, loadPresets, subscribe, PRESET_PREFIX };
  });
})();
