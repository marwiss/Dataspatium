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
  D.define('api/connectors', ['api/schema', 'platform/storage/idb', 'ui/i18n', 'platform/startup-profile', 'platform/tier'], (schema, idb, i18n, profile, tier) => {
    const PRESET_PREFIX = 'presets/api/';
    const USER_KEY = 'api:connectors';
    const COUNTRIES = schema.COUNTRIES;
    let users = null;
    /** Stored (untranslated) connectors by id, for export. */
    const rawById = new Map();
    const listeners = new Set();
    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    /** Preset files read at once, as many as the boot loader has scripts on their way (LD-61), not one round trip per file in turn. */
    const PRESETS_AT_ONCE = 8;
    const ownText = (name) => D.assets.loadText(name);
    /** Each reader's one read of the presets: the app's own and a test's. @type {WeakMap<Function, Promise<object[]>>} */
    const presetReads = new WeakMap();

    /**
     * The presets: the first call reads them, PRESETS_AT_ONCE files at a time, kept in the order of D.assets.names (list() sorts
     * them anyway), and leaves out a file that cannot be read or is no valid configuration; calls meanwhile and later get the
     * same list. The start profile times the app's read (platform/startup-profile). `options.loadText` reads the files in place of
     * D.assets.loadText, with a read of its own (the tests').
     * @param {{loadText?: (name: string) => Promise<string>}} [options]
     * @returns {Promise<object[]>}
     */
    function loadPresets(options = {}) {
      const loadText = options.loadText || ownText;
      let read = presetReads.get(loadText);
      if (!read) { read = readPresets(loadText); presetReads.set(loadText, read); }
      return loadText === ownText ? profile.track('presets', read) : read;
    }
    /** @param {(name: string) => Promise<string>} loadText */
    async function readPresets(loadText) {
      const names = D.assets.names(PRESET_PREFIX).filter((n) => n.endsWith('.api.json'));
      const read = new Array(names.length).fill(null);
      let next = 0;
      const reader = async () => {
        while (next < names.length) {
          const i = next++;
          try {
            const obj = JSON.parse(await loadText(names[i]));
            const errors = schema.validate(obj);
            if (errors.length) { D.log('api', 'invalid preset', names[i], errors); continue; }
            obj.preset = true;
            read[i] = obj;
          } catch (err) { D.log('api', 'could not read preset', names[i], err); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PRESETS_AT_ONCE, names.length) }, reader));
      return read.filter(Boolean);
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
     * Swedish is the file's base; under Danish, Norwegian, Finnish and Icelandic the English texts come first, so that
     * a text the translation lacks shows in English, as in the app (F49 a).
     */
    function localize(raw, lang) {
      const code = lang || i18n.language();
      if (code !== 'sv' && code !== 'en' && i18n.LANGUAGES.some((l) => l.code === code) && raw.i18n && raw.i18n.en) raw = localize(raw, 'en');
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
        case 'apiKey': return D.t('api.auth.summary.apikey', { where: D.t('api.auth.summary.' + (auth.in === 'query' || auth.in === 'body' ? auth.in : 'header')), name: auth.name });
        case 'basic': return D.t('api.auth.summary.basic');
        case 'bearer': return D.t('api.auth.token');
        case 'oauth2_client_credentials': return D.t('api.auth.summary.oauth');
        case 'oauth2_pkce': return D.t('api.auth.summary.oauth.pkce');
        default: return auth.type;
      }
    }

    // ---- what the start asks of the sources without the families, which load as the group 'families' (src/boot.js, PLAN 4) ----
    /**
     * The ids of the database families (api/families/databases FAMILIES, with the neo4j and opencde that those modules add),
     * so that the list of sources can mark them without loading the families. tests/api.test.js keeps the two lists the same.
     */
    const DATABASE_FAMILIES = ['postgrest', 'odata', 'graphql', 'couchdb', 'clickhouse', 'elasticsearch', 'sparql', 'influxdb', 'sheets', 'airtable', 'neo4j', 'opencde'];
    /** Whether a connector was made for a database family (its id begins with the family's). @param {{id?: string}} connector */
    const isDatabase = (connector) => DATABASE_FAMILIES.some((f) => String(connector && connector.id).startsWith(f + '-'));

    /**
     * What hides a dataset's source in the tier in effect (platform/tier): its connector's family or preset (the geodata services),
     * or what a CDE's list needs of that server (the BCF topics, the IFC graph's query); null when the tier shows it. Without the
     * connector, only the preset and the server are looked at. api/runner refuses what this names.
     * @param {any} source @param {any} [connector]
     * @returns {{entry: string, options: {server?: string}}|null}
     */
    function hiddenBy(source, connector) {
      if (!source || source.kind !== 'api') return null;
      const entry = connector ? tier.connectorEntry(connector) : (source.connectorId && !tier.shows('preset:' + source.connectorId) ? 'preset:' + source.connectorId : null);
      if (entry) return { entry, options: {} };
      const spec = source.family === 'opencde' && source.opencde;
      if (!spec) return null;
      const server = { server: source.connectorId };
      const needs = spec.kind === 'admin' ? (spec.admin === 'graph' ? 'cde.ifc-graph' : null) : 'cde.bcf';
      return needs && !tier.shows(needs, server) ? { entry: needs, options: server } : null;
    }
    /** The same, with the source's connector looked up. @param {any} source */
    async function hidden(source) {
      const connector = source && source.kind === 'api' && source.connectorId ? await get(source.connectorId).catch(() => null) : null;
      return hiddenBy(source, connector);
    }

    /** The setting that remembers the deployment's server once added (api/families/opencde addDeployed), so that one the user took away stays away. */
    const DEPLOYED_KEY = 'deploy.server';
    /** @param {{baseUrl?: string}|null} server */
    const deployedAddress = (server) => String((server && server.baseUrl) || '').trim().replace(/\/+$/, '').toLowerCase();
    /**
     * Whether there is nothing to add for the server a deployment names (dataspatium.config.js): none is named, or it was added
     * before. The shell asks this at start, so that the families load only for a server not yet added.
     * @param {{baseUrl?: string}|null} server @returns {Promise<boolean>}
     */
    async function deployedNoted(server) { return !server || !server.baseUrl || (await idb.getSetting(DEPLOYED_KEY, null)) === deployedAddress(server); }
    /** Remembers that the deployment's server has been added. @param {{baseUrl: string}} server */
    async function noteDeployed(server) { await idb.setSetting(DEPLOYED_KEY, deployedAddress(server)); }

    /** @type {Set<(id: string, table: any) => any>} */
    const fetchedListeners = new Set();
    /** Tells a listener whenever a dataset has been updated from its source (with the table it was read from). */
    function onFetched(fn) { fetchedListeners.add(fn); return () => fetchedListeners.delete(fn); }
    /** Tells the listeners that a dataset was updated from its source (api/runner, after an update). @param {string} id @param {any} table */
    async function fetched(id, table) {
      for (const fn of Array.from(fetchedListeners)) { try { await fn(id, table); } catch (err) { console.error('[connectors] listener failed', err); } }
    }

    return { list, get, importJson, save, remove, exportJson, describeAuth, localize, loadPresets, subscribe, added, setAdded, isAdded, hiddenBy, hidden, onFetched, fetched, isDatabase, deployedNoted, noteDeployed, DATABASE_FAMILIES, DEFAULT_ADDED, PRESET_PREFIX, COUNTRIES };
  });
})();
