// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tiers (nivåerna; decisions F48 b c and F52 a): Dataspatium and Dataregium are one program in three cumulative tiers,
 * 1 Dokument (`documents`), 2 BIM och GIS (`bim-gis`) and 3 Experimentell (`experimental`). The user picks one in Hantera's
 * workspace page; with no choice made it is tier 2. Whoever deploys the app may set a ceiling in dataspatium.config.js (next to
 * index.html, a classic script that sets `DATASPATIUM_CONFIG`), and a Dataregium server that announces `tier` in its
 * capabilities document caps what needs that server; a server that announces nothing caps nothing. What a server announced is
 * remembered (IndexedDB), so that the cap holds after a reload too.
 *
 * FEATURES is the one table of what belongs above tier 1, and ENTRIES names the entry points that open each; everything not in
 * them is tier 1. The modes ask `shows(feature or entry)` at their entry points (source list, cards, tabs, actions, palette
 * commands, the status bar), and the paths that run without the UI (recipes, commands, fetching again, imports) refuse with
 * `guard`, in the words of the notice; none tests the tier itself. Going down hides functions and keeps every dataset; going up
 * shows them again, at once (subscribers redraw).
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
    /** What the servers announced, by connector id and address. */
    const SERVERS = 'tier.servers';
    /**
     * What lies above tier 1, with the rows of Dataregium's nivaerna.md (DS-nn) it follows. `server` marks a feature that needs a
     * Dataregium server, which may cap it with its own tier; `group` names the group of scripts (src/boot.js) that only it opens.
     * @type {Record<string, {tier: number, rows: string[], server?: boolean, group?: string}>}
     */
    const FEATURES = {
      // Tier 2, BIM och GIS
      'kind.model': { tier: 2, rows: ['DS-40', 'DS-41', 'DS-42', 'DS-43', 'DS-44', 'DS-48', 'DS-50', 'DS-52', 'DS-54', 'DS-55'] },
      'source.newmodel': { tier: 2, rows: ['DS-48', 'DS-51'] },
      'source.geodata': { tier: 2, rows: ['DS-34', 'DS-36'] },
      'geo.heights': { tier: 2, rows: ['DS-34'] },
      'map.view': { tier: 2, rows: ['DS-35', 'DS-27'] },
      'map.basemap': { tier: 2, rows: ['DS-16', 'DS-37'] },
      'ai.panel': { tier: 2, rows: ['DS-45', 'DS-46', 'DS-48', 'DS-49', 'DS-51', 'DS-53', 'DS-54', 'DS-57'], group: 'ai' },
      'cde.bcf': { tier: 2, rows: ['DS-38', 'DS-39'], server: true },
      'cde.teams': { tier: 2, rows: ['DS-49'], server: true },
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
     * `view:` a view in Bearbeta, `tab:` a tab in Analysera, `geo:` a tool of its Geo tab, `chart:` a type of chart in Visualisera,
     * `op:` an action, `tool:` a tool the AI is offered, `status:` an item of the status bar, `command:` a command of the palette,
     * `cmd:` a command of data/commands (flows, the bridge, the assistant), `import:` a kind of file that only a feature reads,
     * `source:` an item of Inhämta's source list, `family:` a family of sources and `preset:` a ready-made source (both in the
     * catalogue and among the added sources).
     */
    const ENTRIES = {
      'kind:model': 'kind.model', 'view:model': 'kind.model', 'tab:model': 'kind.model', 'chart:model': 'kind.model',
      'op:ifc_apply_table': 'kind.model', 'op:ifc_python': 'kind.model', 'op:ifc_changeset': 'kind.model', 'op:ifc_party': 'kind.model',
      // The map view with layers (Bearbeta's and Visualisera's, DS-35) and the Geo tab's tools; counting places per area (the
      // tool `points`) is DS-10's and stays in Dokument.
      'view:map': 'map.view', 'chart:map': 'map.view',
      'geo:measure': 'map.view', 'geo:nearest': 'map.view', 'geo:buffer': 'map.view', 'geo:overlay': 'map.view', 'geo:dissolve': 'map.view', 'geo:simplify': 'map.view',
      'op:geo_height': 'geo.heights', 'op:geo_height_along': 'geo.heights', 'chart:profile': 'geo.heights',
      'source:newmodel': 'source.newmodel', 'source:geodata': 'source.geodata',
      'tool:server_query': 'ai.server-query', 'status:assistant': 'assistant', 'command:assistant': 'assistant',
      // The maps among the commands (DS-27) and the BCF topics (DS-39); the charts, the documents and the CDE's files stay in Dokument.
      'cmd:create_map': 'map.view', 'cmd:add_map_layer': 'map.view',
      'cmd:cde_topics': 'cde.bcf', 'cmd:cde_create_topic': 'cde.bcf', 'cmd:cde_comment': 'cde.bcf',
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
     * {baseUrl, name}. Anything that does not check out is left out and said in the console, so a mistyped file never locks the
     * app (a mistyped tier means no ceiling).
     * @param {any} raw
     * @returns {{ceiling: number|null, language: string|null, server: {baseUrl: string, name: string}|null}}
     */
    function readConfig(raw) {
      const out = { ceiling: null, language: null, server: null };
      if (!raw || typeof raw !== 'object') return out;
      const warn = (what, value) => console.warn('[dataspatium.config.js] ' + what, value === undefined ? '' : value);
      if (raw.tier !== undefined) { out.ceiling = level(raw.tier); if (out.ceiling === null) warn('unknown tier, no ceiling set (documents, bim-gis or experimental):', raw.tier); }
      const langs = D.boot && D.boot.LANGUAGES ? D.boot.LANGUAGES : [];
      if (typeof raw.language === 'string' && langs.indexOf(raw.language) >= 0) out.language = raw.language;
      else if (raw.language !== undefined) warn('unknown language, ignored (' + langs.join(', ') + '):', raw.language);
      const s = raw.server;
      if (s && typeof s === 'object' && typeof s.baseUrl === 'string' && /^https?:\/\/[^\s/]+/i.test(s.baseUrl.trim())) {
        out.server = { baseUrl: s.baseUrl.trim().replace(/\/+$/, ''), name: typeof s.name === 'string' ? s.name.trim().slice(0, 120) : '' };
      } else if (s !== undefined) warn('server ignored: it needs a baseUrl with http(s)');
      return out;
    }
    let rawConfig = /** @type {any} */ (globalThis).DATASPATIUM_CONFIG;
    let config = readConfig(rawConfig);

    /** The user's choice (1–3) or null before one is made. @type {number|null} */
    let chosen = null;
    /** What each Dataregium server announced, by its connector id and its address: its tier; one that announced none is absent. */
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
     * Note what a server announced in its capabilities (`tier`), for the features that need it, and remember it. Only an answer
     * counts: the caller notes nothing when the server could not be reached. An unknown value caps nothing and is said in the console.
     * @param {{id?: string, baseUrl?: string}} connector @param {any} announced
     */
    function noteServer(connector, announced) {
      const n = level(announced);
      if (n === null && announced !== undefined && announced !== null && announced !== '') console.warn('[tier] the server announces an unknown tier, no ceiling:', announced);
      let changed = false;
      const put = (key) => {
        if (!key || (servers.has(key) ? servers.get(key) : null) === n) return;
        if (n === null) servers.delete(key); else servers.set(key, n);
        changed = true;
      };
      if (connector) { put(connector.id || ''); put(connector.baseUrl ? trim(connector.baseUrl) : ''); }
      if (changed) idb.setSetting(SERVERS, Object.fromEntries(servers)).catch((err) => D.log('tier', 'servers', err));
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
    /** @param {number} n @returns {string} the tier's name in the language in use */
    const nameOf = (n) => D.t('tier.' + keyOf(n));
    /** @param {{cap: string|null, current: number}} w a `why` @returns {string} what caps a feature, in words */
    const capText = (w) => (w.cap === 'server' ? D.t('tier.capped.server', { tier: nameOf(w.current) }) : D.t('tier.capped.deployment', { tier: nameOf(ceiling()) }));
    /**
     * The words for a hidden feature, as the notice has them: what it is, the tier it belongs to and the one in effect, and, when
     * the deployment or the server caps it, that too. @param {string} feature @param {{server?: string}} [options] @returns {string}
     */
    function hiddenText(feature, options = {}) {
      const w = why(feature, options);
      const text = D.t('tier.hidden', { feature: D.t('tier.feature.' + w.feature), tier: nameOf(w.needs), current: nameOf(w.current) });
      return w.cap ? text + ' ' + capText(w) : text;
    }
    /**
     * Refuse what the tier hides, where something runs without the UI (recipes, commands, fetching again, imports): throws an Error
     * in the notice's words, with `tierFeature` (the name asked with, for ui/settings/tier.notice), `tierOptions` and `tier` (the key
     * of the tier it needs).
     * @param {string} feature @param {{server?: string}} [options]
     */
    function guard(feature, options = {}) {
      if (shows(feature, options)) return;
      const err = /** @type {any} */ (new Error(hiddenText(feature, options)));
      err.name = 'TierError'; err.tierFeature = feature; err.tierOptions = Object.assign({}, options); err.tier = keyOf(tierOf(feature));
      throw err;
    }
    /**
     * The entry that hides a source (a connector, added or in the catalogue): its family's or its preset's; null when it is shown.
     * @param {{id?: string, preset?: any, family?: {type?: string}}} connector @returns {string|null}
     */
    function connectorEntry(connector) {
      if (!connector) return null;
      const type = connector.family && connector.family.type;
      if (type && !shows('family:' + type)) return 'family:' + type;
      return shows('preset:' + connector.id) ? null : 'preset:' + connector.id;
    }
    /**
     * Whether a source (a connector, added or in the catalogue) is shown: its family and, for a ready-made one, its preset.
     * @param {{id?: string, preset?: any, family?: {type?: string}}} connector
     */
    const showsConnector = (connector) => !!connector && !connectorEntry(connector);
    /** @param {string} name a group of scripts @returns {string|null} the feature that only it opens */
    const groupFeature = (name) => { const entry = Object.entries(FEATURES).find(([, f]) => f.group === name); return entry ? entry[0] : null; };
    /** Whether the group of scripts that only a feature opens may be opened now. @param {string} name */
    const groupShown = (name) => { const f = groupFeature(name); return f ? shows(f) : true; };
    /**
     * Whether the deployment's ceiling allows a group at all, so that it may be loaded ahead: the installed app keeps every group
     * the user could reach by raising the tier without a network. @param {string} name
     */
    const groupAllowed = (name) => { const f = groupFeature(name); return f ? FEATURES[f].tier <= ceiling() : true; };

    /** Read the user's choice and what the servers announced (the shell, before the first mode opens). */
    async function load() {
      try { chosen = level(await idb.getSetting(SETTING, null)); } catch (_e) { chosen = null; }
      try {
        const saved = await idb.getSetting(SERVERS, null);
        if (saved && typeof saved === 'object') for (const [key, value] of Object.entries(saved)) { const n = level(value); if (n !== null && !servers.has(key)) servers.set(key, n); }
      } catch (_e) { /* nothing remembered: no server caps anything until it is asked */ }
      return current();
    }
    /**
     * Choose a tier, or null to go back to the default. A tier above the deployment's ceiling is refused. The choice is stored
     * first, so that a failed write changes nothing.
     * @param {number|string|null} value @returns {Promise<number>} the tier in effect
     */
    async function set(value) {
      const n = value === null ? null : level(value);
      if (value !== null && n === null) throw new Error('Unknown tier: ' + value);
      if (n !== null && n > ceiling()) throw new Error(D.t('tier.capped.deployment', { tier: nameOf(ceiling()) }));
      if (n === null) await idb.deleteSetting(SETTING); else await idb.setSetting(SETTING, n);
      chosen = n;
      notify();
      return current();
    }
    /** @param {(tier: number) => void} fn @returns {() => void} */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    return {
      TIERS, DEFAULT, FEATURES, ENTRIES, featureOf, showsConnector, connectorEntry, level, keyOf, compute, current, ceiling, choice: () => chosen, shows, why, tierOf,
      hiddenText, capText, guard, groupShown, groupAllowed, serverTier, noteServer, load, set, subscribe,
      /** The deployment's checked settings: {ceiling, language, server}. */
      deployment: () => ({ ceiling: config.ceiling, language: config.language, server: config.server ? Object.assign({}, config.server) : null }),
      readConfig,
      /** Use other deployment settings (the tests); returns the earlier ones to put back. @param {any} raw */
      useConfig(raw) { const before = rawConfig; rawConfig = raw; config = readConfig(raw); notify(); return before; },
    };
  });
})();
