// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tiers (nivåerna; decisions F48 b c and F52 a): Dataspatium and Dataregium are one program in three cumulative tiers,
 * 1 Dokument (`documents`), 2 BIM och GIS (`bim-gis`) and 3 Experimentell (`experimental`). The user picks one in Hantera's
 * workspace page; with no choice made it is tier 2. Whoever deploys the app may set a ceiling in dataspatium.config.js (next to
 * index.html, a classic script that sets `DATASPATIUM_CONFIG`), and a Dataregium server that announces `tier` in its
 * capabilities document caps what needs that server; a server that announces nothing caps nothing.
 *
 * FEATURES is the one table of what belongs above tier 1, and ENTRIES names the entry points that open each; everything not in
 * them is tier 1. The modes ask `shows(feature or entry)` at their entry points (source list, cards, tabs, actions, palette
 * commands, the status bar) and never test the tier themselves. Going
 * down hides functions and keeps every dataset; going up shows them again, at once (subscribers redraw).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/tier', ['platform/storage/idb'], (idb) => {
    /** The tiers in order; `key` is the name Dataregium announces and the config file uses. */
    const TIERS = [
      { n: 1, key: 'documents', icon: 'file-text' },
      { n: 2, key: 'bim-gis', icon: 'box' },
      { n: 3, key: 'experimental', icon: 'activity' },
    ];
    const TOP = 3;
    /** The tier with no choice made (F52 a). */
    const DEFAULT = 2;
    const SETTING = 'ui.tier';
    /**
     * What lies above tier 1, with the rows of Dataregium's nivaerna.md (DS-nn) it follows. `server` marks a feature that needs a
     * Dataregium server, which may cap it with its own tier; `group` names the group of scripts (src/boot.js) that only it opens.
     * @type {Record<string, {tier: number, rows: string[], server?: boolean, group?: string}>}
     */
    const FEATURES = {
      // Tier 2, BIM och GIS
      'kind.model': { tier: 2, rows: ['DS-40', 'DS-41', 'DS-42', 'DS-43', 'DS-44', 'DS-50', 'DS-52', 'DS-55'] },
      'source.newmodel': { tier: 2, rows: ['DS-48', 'DS-51'] },
      'source.geodata': { tier: 2, rows: ['DS-34', 'DS-36'] },
      'geo.heights': { tier: 2, rows: ['DS-34'] },
      'map.view': { tier: 2, rows: ['DS-35'] },
      'map.basemap': { tier: 2, rows: ['DS-16', 'DS-37'] },
      'ai.panel': { tier: 2, rows: ['DS-45', 'DS-46', 'DS-48', 'DS-49', 'DS-51', 'DS-53', 'DS-54', 'DS-57'], group: 'ai' },
      'cde.bcf': { tier: 2, rows: ['DS-38', 'DS-39'], server: true },
      'cde.geometry': { tier: 2, rows: ['DS-58'], server: true },
      'cde.profile': { tier: 2, rows: ['DS-56'], server: true },
      // Tier 3, Experimentell
      'cde.ifc-graph': { tier: 3, rows: ['DS-59', 'DS-32'], server: true },
      'cde.unreachable': { tier: 3, rows: ['DS-60'], server: true },
      'cde.merge': { tier: 3, rows: ['DS-61'], server: true },
      'graph.ifc': { tier: 3, rows: ['DS-07'] },
      'ai.server-query': { tier: 3, rows: ['DS-47'], server: true },
      'assistant': { tier: 3, rows: ['DS-62'], group: 'assistant' },
    };

    /**
     * The entry points that open a feature, by the name the modes ask with: `kind:` a kind of dataset's own views and tools,
     * `view:` a view in Bearbeta, `tab:` a tab in Analysera, `op:` an action, `tool:` a tool the AI is offered, `status:` an item
     * of the status bar, `command:` a command of the palette, `source:` an item of Inhämta's source list,
     * `family:` a family of sources and `preset:` a ready-made source (both in the catalogue and among the added sources).
     */
    const ENTRIES = {
      'kind:model': 'kind.model', 'view:model': 'kind.model', 'tab:model': 'kind.model', 'op:ifc_apply_table': 'kind.model', 'op:ifc_python': 'kind.model',
      'view:map': 'map.view', 'tab:geo': 'map.view',
      'op:geo_height': 'geo.heights', 'op:geo_height_along': 'geo.heights',
      'source:newmodel': 'source.newmodel', 'source:geodata': 'source.geodata',
      'tool:server_query': 'ai.server-query', 'status:assistant': 'assistant', 'command:assistant': 'assistant',
      'family:geodata': 'source.geodata', 'family:geoportal': 'source.geodata',
      // The geodata services and the planning platforms that are not of the geodata families (DS-34, DS-36).
      'preset:naturvardsregistret': 'source.geodata', 'preset:lantmateriet-stac': 'source.geodata', 'preset:lantmateriet-direkt': 'source.geodata',
      'preset:lantmateriet-geodata': 'source.geodata', 'preset:trafikverket-nvdb': 'source.geodata', 'preset:boverket-planbestammelsekatalogen': 'source.geodata',
    };
    /** @param {string} name a feature or an entry point @returns {string} the feature */
    const featureOf = (name) => ENTRIES[name] || name;

    /**
     * A tier from a number or a key; null for anything else.
     * @param {any} value @returns {number|null}
     */
    function level(value) {
      if (typeof value === 'number' && TIERS.some((x) => x.n === value)) return value;
      if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        const found = TIERS.find((x) => x.key === s || String(x.n) === s);
        if (found) return found.n;
      }
      return null;
    }
    /** @param {number} n @returns {string} the tier's key */
    const keyOf = (n) => (TIERS.find((x) => x.n === n) || TIERS[DEFAULT - 1]).key;

    /**
     * The deployment's settings, read from `DATASPATIUM_CONFIG` and checked: a ceiling, a language and a Dataregium server
     * {baseUrl, name}. Anything that does not check out is left out (and logged), so a mistyped file never locks the app.
     * @param {any} raw
     * @returns {{ceiling: number|null, language: string|null, server: {baseUrl: string, name: string}|null}}
     */
    function readConfig(raw) {
      const out = { ceiling: null, language: null, server: null };
      if (!raw || typeof raw !== 'object') return out;
      if (raw.tier !== undefined) { out.ceiling = level(raw.tier); if (out.ceiling === null) D.log('tier', 'config: unknown tier', raw.tier); }
      const langs = D.boot && D.boot.LANGUAGES ? D.boot.LANGUAGES : [];
      if (typeof raw.language === 'string' && langs.indexOf(raw.language) >= 0) out.language = raw.language;
      const s = raw.server;
      if (s && typeof s === 'object' && typeof s.baseUrl === 'string' && /^https?:\/\/[^\s/]+/i.test(s.baseUrl.trim())) {
        out.server = { baseUrl: s.baseUrl.trim().replace(/\/+$/, ''), name: typeof s.name === 'string' ? s.name.trim().slice(0, 120) : '' };
      } else if (s !== undefined) D.log('tier', 'config: the server needs a baseUrl with http(s)');
      return out;
    }
    let rawConfig = /** @type {any} */ (globalThis).DATASPATIUM_CONFIG;
    let config = readConfig(rawConfig);

    /** The user's choice (1–3) or null before one is made. @type {number|null} */
    let chosen = null;
    /** What each Dataregium server announced, by its connector id and its address: a tier, or null for nothing announced. */
    const servers = new Map();
    const listeners = new Set();
    const notify = () => { for (const fn of Array.from(listeners)) { try { fn(current()); } catch (err) { console.error('[tier] listener failed', err); } } };
    const trim = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();

    /**
     * The effective tier: the smallest of the choice (or the default), the deployment's ceiling and the server's tier.
     * @param {{chosen?: number|null, ceiling?: number|null, server?: number|null}} parts
     * @returns {number}
     */
    function compute(parts) {
      const pick = level(parts.chosen) || DEFAULT;
      return Math.min(pick, level(parts.ceiling) || TOP, level(parts.server) || TOP);
    }
    /** The deployment's ceiling, 3 when it sets none. */
    const ceiling = () => config.ceiling || TOP;
    /** The tier in effect for everything that needs no server. */
    const current = () => compute({ chosen, ceiling: config.ceiling });
    /**
     * What a server announced: its tier, or null when it announced none (no ceiling). @param {string} [server] a connector id or address
     * @returns {number|null}
     */
    function serverTier(server) {
      if (!server) return null;
      const hit = servers.has(server) ? servers.get(server) : servers.get(trim(server));
      return hit === undefined ? null : hit;
    }
    /**
     * Note what a server announced in its capabilities (`tier`), for the features that need it.
     * @param {{id?: string, baseUrl?: string}} connector @param {any} announced
     */
    function noteServer(connector, announced) {
      const n = level(announced);
      if (connector && connector.id) servers.set(connector.id, n);
      if (connector && connector.baseUrl) servers.set(trim(connector.baseUrl), n);
    }
    /** @param {string} feature @returns {number} the tier a feature belongs to (1 when the table does not name it) */
    const tierOf = (feature) => (FEATURES[featureOf(feature)] ? FEATURES[featureOf(feature)].tier : 1);

    /**
     * Whether a feature is shown. A feature that needs a server is capped by that server's tier when `server` (its connector's
     * id or address) is given and the server has announced one.
     * @param {string} feature @param {{server?: string}} [options]
     * @returns {boolean}
     */
    function shows(feature, options = {}) {
      const f = FEATURES[featureOf(feature)];
      if (!f) return true;
      const server = f.server ? serverTier(options.server) : null;
      return f.tier <= compute({ chosen, ceiling: config.ceiling, server });
    }
    /**
     * Why a feature is hidden, for the words of a notice: the tier it needs, the tier in effect, what caps it ('deployment',
     * 'server' or null when the user can raise it) and whether raising is possible.
     * @param {string} feature @param {{server?: string}} [options]
     * @returns {{feature: string, needs: number, current: number, cap: 'deployment'|'server'|null, canRaise: boolean}}
     */
    function why(feature, options = {}) {
      const needs = tierOf(feature);
      const f = FEATURES[featureOf(feature)];
      const server = f && f.server ? serverTier(options.server) : null;
      const cap = needs > ceiling() ? 'deployment' : server !== null && needs > server ? 'server' : null;
      return { feature: featureOf(feature), needs, current: compute({ chosen, ceiling: config.ceiling, server }), cap, canRaise: !cap };
    }
    /**
     * Whether a source (a connector, added or in the catalogue) is shown: its family and, for a ready-made one, its preset.
     * @param {{id?: string, preset?: any, family?: {type?: string}}} connector
     */
    function showsConnector(connector) {
      if (!connector) return false;
      const type = connector.family && connector.family.type;
      return (!type || shows('family:' + type)) && shows('preset:' + connector.id);
    }
    /** Whether the group of scripts that only a feature opens may be opened. @param {string} name */
    function groupShown(name) {
      const entry = Object.entries(FEATURES).find(([, f]) => f.group === name);
      return entry ? shows(entry[0]) : true;
    }

    /** Read the user's choice (the shell, before the first mode opens). */
    async function load() {
      try { chosen = level(await idb.getSetting(SETTING, null)); } catch (_e) { chosen = null; }
      return current();
    }
    /**
     * Choose a tier, or null to go back to the default. A tier above the deployment's ceiling is refused.
     * @param {number|string|null} value @returns {Promise<number>} the tier in effect
     */
    async function set(value) {
      const n = value === null ? null : level(value);
      if (value !== null && n === null) throw new Error('Unknown tier: ' + value);
      if (n !== null && n > ceiling()) throw new Error(D.t('tier.capped.deployment', { tier: D.t('tier.' + keyOf(ceiling())) }));
      chosen = n;
      if (n === null) await idb.deleteSetting(SETTING); else await idb.setSetting(SETTING, n);
      notify();
      return current();
    }
    /** @param {(tier: number) => void} fn @returns {() => void} */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    return {
      TIERS, DEFAULT, FEATURES, ENTRIES, featureOf, showsConnector, level, keyOf, compute, current, ceiling, choice: () => chosen, shows, why, tierOf, groupShown,
      serverTier, noteServer, load, set, subscribe,
      /** The deployment's checked settings: {ceiling, language, server}. */
      deployment: () => ({ ceiling: config.ceiling, language: config.language, server: config.server ? Object.assign({}, config.server) : null }),
      readConfig,
      /** Use other deployment settings (the tests); returns the earlier ones to put back. @param {any} raw */
      useConfig(raw) { const before = rawConfig; rawConfig = raw; config = readConfig(raw); notify(); return before; },
    };
  });
})();
