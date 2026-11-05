// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Connector registry: presets embedded under presets/api/*.api.json (see tools/wrap_local.py) and
 * connectors the user has imported, stored in the settings table. Import validates against the schema;
 * export produces a shareable JSON file that never contains credentials.
 *
 * Connectors carry their texts in Swedish plus optional translations under `i18n.<lang>`; `list()` and
 * `get()` return copies with the active language applied, while `exportJson()` writes the stored original.
 * Presets are sorted by country (Sweden first, then the other Nordic countries, the Nordic region and the EU).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/connectors', ['api/schema', 'platform/storage/idb', 'ui/i18n'], (schema, idb, i18n) => {
    const PRESET_PREFIX = 'presets/api/';
    const USER_KEY = 'api:connectors';
    const COUNTRIES = schema.COUNTRIES;
    let presets = null;
    let users = null;
    /** Stored (untranslated) connectors by id, for export. */
    const rawById = new Map();
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
          if (errors.length) { D.log('api', 'invalid preset', name, errors); continue; }
          obj.preset = true;
          out.push(obj);
        } catch (err) { D.log('api', 'could not read preset', name, err); }
      }
      presets = out;
      return presets;
    }
    async function loadUsers() {
      if (!users) users = ((await idb.getSetting(USER_KEY, [])) || []).map((c) => Object.assign({}, c, { preset: false }));
      return users;
    }
    async function saveUsers() { await idb.setSetting(USER_KEY, users.map((c) => strip(c))); notify(); }

    // ---- which presets the user has added to Inhämta's list of added sources; the rest wait in the catalogue of open APIs ----
    const ADDED_KEY = 'api:added';
    /** SCB's and Boverket's open APIs are added from the start; the choice is kept once the user changes it. */
    const DEFAULT_ADDED = ['scb-pxweb', 'scb-pxweb-v2', 'scb-geodata', 'boverket-planbestammelsekatalogen', 'boverket-energideklarationer'];
    /** @type {Set<string>|null} */
    let addedIds = null;
    async function loadAdded() {
      if (!addedIds) { const stored = await idb.getSetting(ADDED_KEY, null); addedIds = new Set(Array.isArray(stored) ? stored : DEFAULT_ADDED); }
      return addedIds;
    }
    /** Ids of the presets the user has added (a copy). */
    async function added() { return new Set(await loadAdded()); }
    /** Add a preset to the added sources, or take it out again; a preset taken out waits in the catalogue and is never deleted. */
    async function setAdded(id, on) {
      const set = await loadAdded();
      if (on) set.add(id); else set.delete(id);
      await idb.setSetting(ADDED_KEY, Array.from(set));
      notify();
    }
    /** Whether a connector belongs among the added sources: every connector of the user's own, and the presets the user has added. */
    async function isAdded(connector) { return !connector.preset || (await loadAdded()).has(connector.id); }

    /** Order of the country filter and of the source list. */
    function countryRank(connector) {
      const i = COUNTRIES.indexOf(connector.country);
      return i < 0 ? COUNTRIES.length : i;
    }
    function compare(a, b) {
      return countryRank(a) - countryRank(b) || (a.level || 1) - (b.level || 1) || String(a.name).localeCompare(String(b.name), i18n.locale());
    }

    /**
     * Copy of a connector with the texts of the active language applied (name, publisher, description,
     * notes, endpoint names and descriptions, parameter labels, help, examples and option labels, auth help).
     */
    function localize(raw, lang) {
      const code = lang || i18n.language();
      const ov = raw.i18n && raw.i18n[code];
      if (!ov) return raw;
      const out = Object.assign({}, raw);
      for (const k of ['name', 'publisher', 'description', 'notes']) if (typeof ov[k] === 'string') out[k] = ov[k];
      if (ov.auth && raw.auth) out.auth = Object.assign({}, raw.auth, typeof ov.auth.help === 'string' ? { help: ov.auth.help } : {});
      if (ov.endpoints && Array.isArray(raw.endpoints)) {
        out.endpoints = raw.endpoints.map((ep) => {
          const o = ov.endpoints[ep.id];
          if (!o) return ep;
          const e = Object.assign({}, ep);
          for (const k of ['name', 'description']) if (typeof o[k] === 'string') e[k] = o[k];
          if (o.params && Array.isArray(ep.params)) {
            e.params = ep.params.map((p) => {
              const po = o.params[p.name];
              if (!po) return p;
              const q = Object.assign({}, p);
              for (const k of ['label', 'help', 'example']) if (po[k] !== undefined) q[k] = po[k];
              if (po.options && Array.isArray(p.options)) q.options = p.options.map((opt) => (po.options[String(opt.value)] ? Object.assign({}, opt, { label: po.options[String(opt.value)] }) : opt));
              return q;
            });
          }
          return e;
        });
      }
      if (ov.dataset && out.endpoints) {
        // Dataset name templates per endpoint ("Kolada {kpi_id}") may be translated too.
        out.endpoints = out.endpoints.map((ep) => (ov.dataset[ep.id] && ep.dataset ? Object.assign({}, ep, { dataset: Object.assign({}, ep.dataset, { name: ov.dataset[ep.id] }) }) : ep));
      }
      return out;
    }

    /** All connectors in the active language; a user connector with the same id as a preset replaces the preset. */
    async function list() {
      const [p, u] = await Promise.all([loadPresets(), loadUsers()]);
      const ids = new Set(u.map((c) => c.id));
      const all = p.filter((c) => !ids.has(c.id)).concat(u);
      rawById.clear();
      for (const c of all) rawById.set(c.id, c);
      return all.map((c) => Object.assign({}, localize(c), { preset: !!c.preset })).sort(compare);
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
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error(D.t('err.invalid.json')); }
      const errors = schema.validate(obj);
      if (errors.length) throw new Error(D.t('api.err.config.invalid', { errors: errors.slice(0, 5).join('; ') + (errors.length > 5 ? D.t('api.err.config.more', { n: errors.length - 5 }) : '') }));
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
    /** Shareable JSON of the stored connector (all languages, no credentials). */
    function exportJson(connector) { return JSON.stringify(strip(rawById.get(connector.id) || connector), null, 2) + '\n'; }

    /** Short description of the authentication requirement in the active language. */
    function describeAuth(connector) {
      const auth = connector.auth || { type: 'none' };
      switch (auth.type) {
        case 'none': return D.t('api.auth.summary.none');
        case 'apiKey': return D.t('api.auth.summary.apikey', { where: auth.in === 'query' ? D.t('api.auth.summary.query') : D.t('api.auth.summary.header'), name: auth.name });
        case 'basic': return D.t('api.auth.summary.basic');
        case 'bearer': return D.t('api.auth.token');
        case 'oauth2_client_credentials': return D.t('api.auth.summary.oauth');
        case 'oauth2_pkce': return D.t('api.auth.summary.oauth.pkce');
        default: return auth.type;
      }
    }

    return { list, get, importJson, save, remove, exportJson, describeAuth, localize, loadPresets, subscribe, added, setAdded, isAdded, DEFAULT_ADDED, PRESET_PREFIX, COUNTRIES };
  });
})();
