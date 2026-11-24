// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * plotly.js as a component on demand (MIT, pinned to one version and digest on jsDelivr): draws the figures that
 * Python's plotly hands over as JSON (python/dataspatium.py), with a layout template built from the app's design
 * tokens, and exports them to SVG, PNG and PDF on the main thread. Not shipped in the ZIP; fetched after consent
 * the first time a plotly figure is shown.
 *
 * A figure is data from the Python worker, and plotly.js fetches on the main thread what it names: a geo map's shapes
 * (plotly's topojson), a map's style, tiles and icons, layout images, GeoJSON by address, and what buttons and sliders bring
 * in; its text is pseudo-HTML whose styles and links reach the page. Every drawing works on a copy built key by key: text
 * keeps only bare tags, and prepare() asks once per purpose for the hosts the figure names (background maps, web addresses),
 * leaves out what is refused or cannot be checked, and says so. Plotly's cloud is never offered.
 *
 * A link in a chart drawn in the app (render) stays a link only when its address is an absolute https URL, rebuilt with that
 * address alone; a click on it never navigates: a dialog names the host and shows the address, and only a yes opens it in a new
 * tab without opener or referrer (F107 a). Exports and published HTML, which have no app to ask, keep every link as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/plotly', ['platform/components', 'platform/consent', 'viz/theme', 'viz/export'], (components, consent, theme, vizExport) => {
    const VERSION = '4.2.0';
    const SPEC = { id: 'plotly.js', urls: [`https://cdn.jsdelivr.net/npm/plotly.js-dist-min@${VERSION}/plotly.min.js`], sha256: 'fde93964a7511bfa54c5745c49b5d0e41715cbde0cc5ebeae3f9a02de0396cae', size: 4841490, label: `plotly.js ${VERSION}`, version: VERSION, purpose: 'components' };
    /** @type {Promise<any>|null} */ let loading = null;
    /** @type {string|null} */ let sourceText = null;

    // The hosts below were read from plotly.js 4.1.1 (config topojsonURL, src/plots/map/constants.js stylesMap, styles/arcgis-sat*.js
    // and map.js); the pinned 4.2.0 is taken to be the same. Read them again whenever VERSION changes.
    /** Where plotly.js fetches a geo map's shapes (its default topojsonURL, https://cdn.plot.ly/un/). */
    const TOPOJSON_HOST = 'cdn.plot.ly';
    /** topojsonURL when that host is not allowed: an asset that does not exist, so a fetch plotly still makes fails in the browser. */
    const NO_TOPOJSON = 'dataspatium-asset://plotly-topojson/';
    /** Every map loads the icons its symbols name and its sprite lacks from jsDelivr (@mapbox/maki). */
    const MAP_ICONS = 'cdn.jsdelivr.net';
    // CARTO's bold labels are rewritten to fonts.openmaptiles.org (map.js transformRequest).
    const CARTO = ['basemaps.cartocdn.com', 'tiles.basemaps.cartocdn.com', 'fonts.openmaptiles.org'];
    const OSM = ['tile.openstreetmap.org', 'fonts.openmaptiles.org'];
    const ORTO = ['server.arcgisonline.com', 'tilemaps.icgc.cat', 'geoserveis.icgc.cat'];
    /** The hosts behind plotly's built-in map styles (MapLibre). */
    const MAP_STYLES = {
      basic: CARTO, streets: CARTO, outdoors: CARTO, light: CARTO, dark: CARTO, 'carto-positron': CARTO, 'carto-darkmatter': CARTO, 'carto-voyager': CARTO,
      'carto-positron-nolabels': CARTO, 'carto-darkmatter-nolabels': CARTO, 'carto-voyager-nolabels': CARTO, 'open-street-map': OSM,
      'white-bg': ['fonts.openmaptiles.org'], satellite: ORTO, 'satellite-streets': ORTO,
    };
    const ANY_STYLE = Array.from(new Set([].concat(CARTO, OSM, ORTO)));
    const GEO_TYPES = new Set(['scattergeo', 'choropleth']);
    const MAP_TYPES = new Set(['scattermap', 'choroplethmap', 'densitymap']);
    /** Mapbox traces, which plotly.js 4 no longer draws: left out of the copy with the layout's mapbox subplots. */
    const GONE_TYPES = new Set(['scattermapbox', 'choroplethmapbox', 'densitymapbox']);
    /** The geo layers drawn from the topojson (the frame is not). */
    const GEO_LAYERS = ['showcoastlines', 'showland', 'showocean', 'showlakes', 'showrivers', 'showcountries', 'showsubunits'];
    const GEO_KEY = /^geo\d*$/;
    const MAP_KEY = /^map\d*$/;
    const MAX_DEPTH = 40;
    /** Nothing goes to Plotly's cloud: the Share chart button is off, and its click has no address to post to. */
    const NO_CLOUD = { showSendToCloud: false, plotlyServerURL: '' };

    function available() { return !!globalThis.Plotly; }

    /**
     * Load the library (from the component cache or jsDelivr after consent) and return the Plotly object; with `ask: false`
     * only a consent already kept lets it fetch (platform/components). A call that may ask and joins a load that failed only
     * because it could not ask (a flow at start) loads again, asking.
     * @param {{ask?: boolean, onProgress?: Function}} [options]
     */
    function ensure(options = {}) {
      if (globalThis.Plotly) return Promise.resolve(globalThis.Plotly);
      if (!loading) {
        loading = (async () => {
          sourceText = await components.text(SPEC, options);
          const url = URL.createObjectURL(new Blob([sourceText], { type: 'text/javascript' }));
          try { await D.assets.loadScript(url); } finally { URL.revokeObjectURL(url); }
          if (!globalThis.Plotly) throw new Error(D.t('plotly.err.load'));
          return globalThis.Plotly;
        })().catch((err) => { loading = null; throw err; });
      }
      if (options.ask === false) return loading;
      return loading.catch((err) => { if (err && err.name === 'ConsentError' && err.reason === 'unattended') return ensure(options); throw err; });
    }

    /** The library's text, for standalone HTML (Publicera); `ask: false` as in ensure(). */
    async function source(options = {}) {
      if (!sourceText) await ensure(options);
      return sourceText || components.text(SPEC, options);
    }

    /** Layout template from the design tokens: palette, font, surfaces, grid, legend below the plot. */
    function template() {
      const tk = theme.tokens();
      const axis = { gridcolor: tk.grid, zerolinecolor: tk.border, linecolor: tk.border, tickcolor: tk.border, tickfont: { color: tk.muted }, title: { font: { color: tk.muted } }, automargin: true };
      return {
        layout: {
          colorway: tk.palette,
          font: { family: tk.font, color: tk.text, size: 13 },
          paper_bgcolor: tk.background, plot_bgcolor: tk.background,
          title: { font: { size: 16, color: tk.text }, x: 0, xanchor: 'left' },
          xaxis: axis, yaxis: axis,
          legend: { orientation: 'h', yanchor: 'top', y: -0.18, xanchor: 'left', x: 0, font: { color: tk.muted } },
          margin: { t: 56, r: 16, b: 56, l: 56 },
          hoverlabel: { font: { family: tk.font } },
          colorscale: { sequential: [[0, tk.sequential[0]], [1, tk.sequential[1]]], diverging: [[0, tk.diverging[0]], [0.5, tk.diverging[1]], [1, tk.diverging[2]]] },
        },
        data: {},
      };
    }

    /** The figure's layout with the app's template (replacing plotly's own) and optional fixed size. */
    function layoutFor(fig, options = {}) {
      const layout = { ...((fig && fig.layout) || {}) };
      layout.template = template();
      if (options.width) layout.width = options.width;
      if (options.height) layout.height = options.height;
      if (!options.width && !options.height) { layout.autosize = true; delete layout.width; delete layout.height; }
      return layout;
    }

    // ---- the copy that is drawn -----------------------------------------------------------------------------------
    const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const typeOf = (trace) => String((isPlain(trace) && trace.type) || 'scatter');
    /** A subplot id as plotly reads it (its counterRegex); anything else is drawn in the first one. */
    const canon = (v, family) => (typeof v === 'string' && new RegExp('^' + family + '([2-9]|[1-9][0-9]+)?$').test(v) ? v : family);
    /** Path segments of an attribute name: 'images[0].source' -> ['images', 'source']. */
    const segments = (key) => String(key).replace(/\[\d+\]/g, '').split('.').filter(Boolean);
    /** plotly's pseudo-HTML (lib/svg_text_utils): the tags it styles, how it splits a string into tags, and a tag's style. */
    const TAGS = new Set(['sup', 'sub', 's', 'u', 'b', 'i', 'a', 'span', 'em']);
    const SPLIT_TAGS = /(<[^<>]*>)/;
    const ONE_TAG = /^<(\/?)([^ >]*)(\s+(.*))?>$/i;
    const STYLE = /(^|[\s"'])style\s*=\s*("([^"]*);?"|'([^']*);?')/i;
    /** A plain colour, the one style a tag keeps: no entity, escape, url() or second declaration fits. */
    const COLOR = /^\s*color\s*:\s*(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\(\s*[\d.]{1,5}%?(\s*,\s*[\d.]{1,5}%?){2,3}\s*\))\s*$/i;
    const angles = (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    /** How plotly reads a link's address in a tag (lib/svg_text_utils HREFMATCH). */
    const HREF = /(^|[\s"'])href\s*=\s*("([^"]*)"|'([^']*)')/i;
    /** What may not be in a link's address: controls and white space, quotes, angle brackets, a backslash and a template field. */
    const NOT_IN_LINK = /[\u0000-\u0020\u007f-\u009f"<>\\`]|%\{/;
    /**
     * A link's address when it may stay a link, as the URL constructor writes it: an absolute https URL with a host and without
     * a user or password, nothing in it that the tag, a template (`%{…}`) or plotly (which runs it through decodeURI) would
     * read otherwise. Anything else (javascript:, data:, http:, relative and protocol-relative addresses, other schemes) is null.
     * @param {any} value @returns {URL|null}
     */
    function linkUrl(value) {
      if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value) || NOT_IN_LINK.test(value)) return null;
      let url;
      try { url = new URL(value); } catch (_err) { return null; }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || NOT_IN_LINK.test(url.href)) return null;
      try { decodeURI(url.href); } catch (_err) { return null; }
      return url;
    }
    /**
     * Text plotly reads as pseudo-HTML, with every tag it knows rebuilt bare: `<b>`, `<span>` and the rest keep at most a plain
     * colour, `<br>` and `<extra>` stay, and every other `<` and `>` becomes an entity, which plotly shows as the character. So
     * no style or address reaches the page, also not when a template fills in values (they are cleaned the same way). With
     * `links` a link to an absolute https URL keeps that address, and only it: the URL as written by the URL constructor, which
     * holds no quote or angle bracket, so it cannot leave the attribute (plotly reads the address as it stands, without entities).
     * @param {string} s @param {boolean} [links] @returns {string}
     */
    function cleanText(s, links) {
      if (s.indexOf('<') < 0 && s.indexOf('>') < 0) return s;
      return s.split(SPLIT_TAGS).map((part, i) => {
        const m = i % 2 ? ONE_TAG.exec(part) : null;
        if (!m) return angles(part);
        const name = m[2].toLowerCase();
        if (/^br\/?$/.test(name)) return '<br>';
        if (name === 'extra') return m[1] ? '</extra>' : '<extra>';
        if (!TAGS.has(name)) return angles(part);
        if (m[1]) return `</${name}>`;
        if (name === 'a' && links) {
          const href = HREF.exec(m[4] || '');
          const url = href ? linkUrl(href[3] !== undefined ? href[3] : href[4]) : null;
          if (url) return `<a href="${url.href}">`;
        }
        const style = STYLE.exec(m[4] || '');
        const color = style ? String(style[3] || style[4] || '').split(';').find((d) => COLOR.test(d)) : null;
        return color ? `<${name} style="${color.trim()}">` : `<${name}>`;
      }).join('');
    }
    /** MapLibre's comparison operators, the only strings with `<` or `>` a map style needs. */
    const MAP_OPERATORS = new Set(['<', '<=', '>', '>=']);
    /** A string in a map's style or layers: MapLibre writes attributions into the page as HTML, so markup becomes plain text. */
    const cleanMapText = (s) => (MAP_OPERATORS.has(s) || (s.indexOf('<') < 0 && s.indexOf('>') < 0) ? s : angles(s.replace(/<[^<>]*>/g, '')));
    /** Keys never copied: they would become an object's prototype, or are no plotly attribute at all. */
    const DROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    /** Where a key leads: inside a map subplot (MapLibre), to an image's own address (checked as an address), or plotly text. */
    function contextOf(ctx, key) {
      if (ctx === 'map') return 'map';
      const parts = segments(key);
      if (parts.some((p) => MAP_KEY.test(p))) return 'map';
      return parts[parts.length - 1] === 'source' ? 'source' : ctx;
    }
    /**
     * A copy made key by key: own keys only and never those in DROP_KEYS, no deeper than MAX_DEPTH, and every string cleaned
     * for where it is drawn (`links` as in cleanText).
     */
    function cleanCopy(v, ctx, depth, links) {
      if (typeof v === 'string') return ctx === 'map' ? cleanMapText(v) : ctx === 'source' ? v : cleanText(v, links);
      if (!v || typeof v !== 'object') return v;
      if (depth > MAX_DEPTH) return null;
      // Only a source that is an address itself is left as it is; what an object or array under `source` holds is text.
      if (ctx === 'source') ctx = 'text';
      if (Array.isArray(v)) return v.map((x) => cleanCopy(x, ctx, depth + 1, links));
      if (ArrayBuffer.isView(v)) return /** @type {any} */ (v).slice ? /** @type {any} */ (v).slice() : null;
      const out = {};
      for (const k of Object.keys(v)) if (!DROP_KEYS.has(k)) out[k] = cleanCopy(v[k], contextOf(ctx, k), depth + 1, links);
      return out;
    }
    /**
     * The figure's traces and layout as such a copy, with plotly's own template dropped (the app sets its own), Mapbox left out,
     * and each geo and map trace's subplot written as plotly reads it, so the subplot analysed is the one drawn. With `links`
     * the text keeps its links to https addresses (a chart drawn in the app, which asks before one is followed).
     */
    function copyOf(fig, links) {
      const layout = fig && isPlain(fig.layout) ? cleanCopy(fig.layout, 'text', 0, links) : {};
      delete layout.template;
      for (const k of Object.keys(layout)) if (/^mapbox\d*$/.test(k)) delete layout[k];
      const data = (fig && Array.isArray(fig.data) ? cleanCopy(fig.data, 'text', 0, links) : []).filter((tr) => !GONE_TYPES.has(typeOf(tr)));
      for (const tr of data) {
        if (!isPlain(tr)) continue;
        if (GEO_TYPES.has(typeOf(tr))) tr.geo = canon(tr.geo, 'geo');
        if (MAP_TYPES.has(typeOf(tr))) tr.subplot = canon(tr.subplot, 'map');
      }
      return { data, layout };
    }

    // ---- what a figure fetches -----------------------------------------------------------------------------------
    /**
     * Where a string that plotly loads as an address (an image, GeoJSON) comes from: 'local' for data: and blob:, the host for
     * http and https, and null for anything else, which is never loaded (relative, protocol-relative, file: and the rest).
     */
    function strictSource(value) {
      if (typeof value !== 'string') return null;
      let url;
      try { url = new URL(value); } catch (_err) { return null; }
      if (url.protocol === 'data:' || url.protocol === 'blob:') return 'local';
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.host ? url.host : null;
    }
    /**
     * A string elsewhere in a figure (a map's style, a button's arguments): the host when it is an http(s) address (mapbox://
     * is Mapbox's API), '' when it is no address, and null when it cannot be checked: it would resolve to another host than it
     * names (//host, \\host), or, in a map, it is a data: or blob: address whose content names hosts of its own.
     */
    function looseHost(value, map) {
      const first = value.charCodeAt(0);
      // No scheme and no leading slash, backslash or control: no address (most strings, such as labels, end here).
      if (value.indexOf(':') < 0 && first > 0x20 && first !== 0x2f && first !== 0x5c) return '';
      const s = value.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, '');
      if (/^[\\/]{2}/.test(s)) return null;
      if (map && /^(data|blob):/i.test(s)) return null;
      if (!/^(https?|mapbox):/i.test(s)) return '';
      if (/^mapbox:/i.test(s)) return map ? 'api.mapbox.com' : '';
      try { return new URL(s).host || null; } catch (_err) { return null; }
    }
    /** The hosts a map style needs: a built-in name's provider, an address's host, or (for a style object) none of its own. */
    function styleHosts(style) {
      const name = style === undefined || style === null || style === '' ? 'basic' : style;
      if (typeof name !== 'string') return [];
      const host = looseHost(name, true);
      if (host) return [host];
      return MAP_STYLES[name] || ANY_STYLE;
    }
    /** Every address in a value, by host, into `out`; an address that cannot be checked blocks. */
    function addressesIn(value, map, out, depth = 0) {
      if (depth > MAX_DEPTH) { out.blocked = true; return; }
      if (typeof value === 'string') { const host = looseHost(value, map); if (host === null) out.blocked = true; else if (host) out.hosts.add(host); return; }
      if (Array.isArray(value)) { for (const v of value) addressesIn(v, map, out, depth + 1); return; }
      if (isPlain(value)) for (const k of Object.keys(value)) addressesIn(value[k], map, out, depth + 1);
    }
    /** What a map subplot fetches: its style's hosts, the icons' host and every address in its style and layers. */
    function mapNeeds(layout, id) {
      const sub = isPlain(layout[id]) ? layout[id] : {};
      const out = { hosts: new Set(styleHosts(sub.style).concat(MAP_ICONS)), blocked: false };
      addressesIn(sub, true, out);
      return out;
    }
    const familyOf = (type) => (GEO_TYPES.has(type) ? 'geo' : MAP_TYPES.has(type) ? 'map' : '');

    /**
     * What a button's or a slider step's arguments would bring in when clicked: the background maps of the geo and map
     * subplots they touch, the hosts of the addresses they name, and whether they name an address that cannot be checked.
     */
    function argsNeeds(args, layout) {
      const out = { basemaps: new Set(), url: new Set(), blocked: false };
      const mapsSeen = new Set();
      const addMap = (id) => {
        if (mapsSeen.has(id)) return;
        mapsSeen.add(id);
        const m = mapNeeds(layout, id);
        for (const h of m.hosts) out.basemaps.add(h);
        if (m.blocked) out.blocked = true;
      };
      /** A trace turned into a map trace keeps its own subplot: every map the layout has may be drawn. */
      const addAllMaps = () => { for (const id of ['map'].concat(Object.keys(layout).filter((k) => canon(k, 'map') === k))) addMap(id); };
      /** What an attribute path says by itself (a geo or map subplot, a source), worked out once per key. */
      const at = (path) => {
        const last = path[path.length - 1] || '';
        const mapAt = path.findIndex((p) => MAP_KEY.test(p));
        if (path.some((p) => GEO_KEY.test(p)) || last === 'locations' || last === 'locationmode') out.basemaps.add(TOPOJSON_HOST);
        if (mapAt >= 0) addMap(path[mapAt]);
        return { last, map: mapAt >= 0, style: last === 'style' && mapAt >= 0 && mapAt === path.length - 2 };
      };
      const leaf = (v, c) => {
        if (c.last === 'type' && GEO_TYPES.has(v)) out.basemaps.add(TOPOJSON_HOST);
        if (c.last === 'type' && MAP_TYPES.has(v)) addAllMaps();
        if (c.last === 'subplot') addMap(canon(v, 'map'));
        if (typeof v !== 'string') return;
        if (c.map) {
          if (c.style) for (const h of styleHosts(v)) out.basemaps.add(h);
          const host = looseHost(v, true);
          if (host === null) out.blocked = true; else if (host) out.basemaps.add(host);
        } else if (c.last === 'source' || c.last === 'geojson') {
          const src = strictSource(v);
          if (src === null) out.blocked = true; else if (src !== 'local') out.url.add(src);
        } else {
          const host = looseHost(v, false);
          if (host === null) out.blocked = true; else if (host) out.url.add(host);
        }
      };
      const walk = (v, path, c, depth) => {
        if (depth > MAX_DEPTH) { out.blocked = true; return; }
        if (Array.isArray(v)) {
          // A value that is no string says something only through its path, so a long array of numbers is looked at once.
          let primitive = false;
          for (const x of v) {
            if (typeof x === 'string' || (x && typeof x === 'object')) walk(x, path, c, depth + 1);
            else if (!primitive) { primitive = true; leaf(x, c); }
          }
          return;
        }
        if (isPlain(v)) { for (const k of Object.keys(v)) { const p = path.concat(segments(k)); walk(v[k], p, at(p), depth + 1); } return; }
        leaf(v, c);
      };
      walk(args, [], at([]), 0);
      return out;
    }

    /**
     * The parts of a figure that fetch something, each with the consents it needs (`asks`: purpose and hosts), whether it is
     * never drawn (`blocked`), the message it falls under (`kind`) and how it is left out of the copy (`drop`).
     */
    function partsOf(fig) {
      const { data, layout } = fig;
      const parts = [];
      const url = (host, address) => [{ purpose: 'url', hosts: [host], address }];
      // Geo maps: the land, coasts and borders, and the locations by name or code, come from plotly's topojson.
      const geo = data.map((tr, i) => (familyOf(typeOf(tr)) === 'geo' ? i : -1)).filter((i) => i >= 0);
      if (geo.length) {
        parts.push({ kind: 'basemaps', blocked: false, asks: [{ purpose: 'basemaps', hosts: [TOPOJSON_HOST] }], drop(out) {
          const ids = new Set(geo.map((i) => data[i].geo).concat(Object.keys(layout).filter((k) => GEO_KEY.test(k))));
          for (const id of ids) { const g = isPlain(layout[id]) ? layout[id] : {}; for (const k of GEO_LAYERS) g[k] = false; layout[id] = g; }
          for (const i of geo) { const tr = data[i]; if (tr.locations !== undefined || tr.locationmode !== undefined || tr.geojson !== undefined) out.traces.add(i); }
        } });
      }
      // Maps (MapLibre), one subplot at a time: the style, its tiles, glyphs and icons, and the layers' sources.
      const maps = new Map();
      data.forEach((tr, i) => { if (familyOf(typeOf(tr)) !== 'map') return; const id = tr.subplot; if (!maps.has(id)) maps.set(id, []); maps.get(id).push(i); });
      for (const [id, traces] of maps) {
        const needs = mapNeeds(layout, id);
        parts.push({ kind: 'basemaps', blocked: needs.blocked, asks: [{ purpose: 'basemaps', hosts: Array.from(needs.hosts) }], drop(out) { for (const i of traces) out.traces.add(i); delete layout[id]; } });
      }
      // Layout images: only data: and blob: are drawn as they are; an http(s) address after consent.
      if (layout.images !== undefined && !Array.isArray(layout.images)) delete layout.images;
      (layout.images || []).forEach((img, i) => {
        if (!isPlain(img)) { parts.push({ kind: 'url', blocked: true, asks: [], drop(out) { out.images.add(i); } }); return; }
        if (img.source === undefined || img.source === null) return;
        const src = strictSource(img.source);
        if (src === 'local') return;
        parts.push({ kind: 'url', blocked: src === null, asks: src ? url(src, img.source) : [], drop(out) { out.images.add(i); } });
      });
      // GeoJSON by address in any trace, and an image trace's picture.
      data.forEach((tr, i) => {
        if (!isPlain(tr)) return;
        for (const key of ['geojson', 'source']) {
          const v = tr[key];
          if ((key === 'source' && typeOf(tr) !== 'image') || v === undefined || v === null || isPlain(v)) continue;
          const src = strictSource(v);
          if (src !== 'local') parts.push({ kind: 'url', blocked: src === null, asks: src ? url(src, v) : [], drop(out) { out.traces.add(i); } });
        }
      });
      // Buttons and slider steps: what their arguments would bring in when clicked.
      const items = [];
      for (const [list, key] of [['updatemenus', 'buttons'], ['sliders', 'steps']]) {
        (Array.isArray(layout[list]) ? layout[list] : []).forEach((c, m) => (isPlain(c) && Array.isArray(c[key]) ? c[key] : []).forEach((item, k) => items.push({ id: `${list}:${m}:${k}`, args: isPlain(item) ? [item.args, item.args2] : [] })));
      }
      for (const it of items) {
        const n = argsNeeds(it.args, layout);
        const asks = (n.basemaps.size ? [{ purpose: 'basemaps', hosts: Array.from(n.basemaps) }] : []).concat(Array.from(n.url).map((h) => ({ purpose: 'url', hosts: [h], address: h })));
        if (n.blocked || asks.length) parts.push({ kind: n.url.size || n.blocked ? 'url' : 'basemaps', blocked: n.blocked, asks, drop(out) { out.items.add(it.id); } });
      }
      return parts;
    }

    const allows = (allowed, purpose, host) => { const a = allowed && allowed[purpose]; return a === true || !!(a && typeof a.has === 'function' && a.has(host)); };
    /** A copy of the figure with its parts (`links` as in copyOf). */
    function analyze(fig, links) { const figure = copyOf(fig, links); return { figure, parts: partsOf(figure) }; }

    /** The questions for some parts: one per purpose (background maps, then web addresses) with every host it names. */
    function questionsOf(parts) {
      const hosts = { basemaps: new Set(), url: new Set() }; const address = {};
      for (const q of parts.filter((p) => !p.blocked).flatMap((p) => p.asks)) {
        for (const h of q.hosts) hosts[q.purpose].add(h);
        if (q.address && !address[q.purpose]) address[q.purpose] = q.address;
      }
      return ['basemaps', 'url'].filter((p) => hosts[p].size).map((purpose) => ({ purpose, hosts: Array.from(hosts[purpose]), address: address[purpose] }));
    }

    /**
     * The consents drawing a figure needs, as questions in the order they are asked. Nothing is asked here.
     * @param {any} fig figure JSON ({data, layout})
     * @returns {Array<{purpose: 'basemaps'|'url', hosts: string[], address?: string}>}
     */
    function requests(fig) { return questionsOf(analyze(fig).parts); }

    /** Leave out of an analysed copy the parts that are not allowed. */
    function apply({ figure, parts }, allowed) {
      const out = { traces: new Set(), images: new Set(), items: new Set() };
      const removed = { basemaps: false, url: false };
      for (const p of parts) {
        const missing = p.asks.filter((q) => !q.hosts.every((h) => allows(allowed, q.purpose, h)));
        if (!p.blocked && !missing.length) continue;
        p.drop(out);
        if (p.blocked) removed[p.kind] = true;
        for (const q of missing) removed[q.purpose] = true;
      }
      const { layout } = figure;
      figure.data = figure.data.filter((_, i) => !out.traces.has(i));
      if (out.images.size) layout.images = layout.images.filter((_, i) => !out.images.has(i));
      for (const [list, key] of [['updatemenus', 'buttons'], ['sliders', 'steps']]) {
        if (!Array.isArray(layout[list])) continue;
        layout[list] = layout[list].map((c, m) => (isPlain(c) && Array.isArray(c[key]) ? Object.assign(c, { [key]: c[key].filter((_, k) => !out.items.has(`${list}:${m}:${k}`)) }) : c))
          .filter((c) => !(isPlain(c) && Array.isArray(c[key]) && !c[key].length));
      }
      return { figure, removed, topojson: allows(allowed, 'basemaps', TOPOJSON_HOST) };
    }

    /**
     * A copy of the figure without what may not be fetched: a refused or missing consent removes the geo map's shapes (and the
     * traces placed by name or code), a map with its traces, an image, a trace with GeoJSON or a picture by address, or a
     * button or slider step that would bring them in; what cannot be checked is removed always. Its text keeps only bare tags
     * (and, with `links`, links to absolute https addresses). Pure: nothing is asked or drawn.
     * @param {any} fig figure JSON ({data, layout})
     * @param {{basemaps?: true|Set<string>, url?: true|Set<string>}} [allowed] the hosts allowed per purpose (true for all)
     * @param {{links?: boolean}} [options]
     * @returns {{figure: {data: any[], layout: any}, removed: {basemaps: boolean, url: boolean}, topojson: boolean}}
     */
    function sanitize(fig, allowed = {}, options = {}) { return apply(analyze(fig, !!options.links), allowed); }

    /** The message for what a drawing left out, or ''. */
    function noticeFor(removed) {
      return [removed.basemaps ? D.t('plotly.denied.basemaps') : '', removed.url ? D.t('plotly.denied.url') : ''].filter(Boolean).join(' ');
    }

    /** The hosts of a question as the dialog shows them: the first three, and how many more. */
    function hostList(hosts) {
      return hosts.slice(0, 3).join(', ') + (hosts.length > 3 ? ' ' + D.t('plotly.consent.more', { n: hosts.length - 3 }) : '');
    }

    /**
     * A copy of the figure that may be drawn now: the consents it needs are asked first, at most one question per purpose
     * (background maps, then web addresses) naming its hosts, and what is refused is left out. Each question carries every
     * host (`hosts`), so a consent kept per host can answer it host by host. With `ask: false` nothing is asked and only a
     * purpose that is allowed for good counts (published HTML, which is drawn later and elsewhere; a flow at start). `links`
     * keeps the links to https addresses in the text (only for a chart drawn in the app, whose clicks guardLinks() catches).
     * @param {any} fig figure JSON ({data, layout}) @param {{ask?: boolean, links?: boolean}} [options]
     * @returns {Promise<{figure: {data: any[], layout: any}, removed: {basemaps: boolean, url: boolean}, topojson: boolean, notice: string}>}
     */
    async function prepare(fig, options = {}) {
      const analysed = analyze(fig, !!options.links);
      /** @type {{basemaps: true|Set<string>, url: true|Set<string>}} */
      const allowed = { basemaps: new Set(), url: new Set() };
      if (options.ask === false) {
        for (const purpose of ['basemaps', 'url']) if ((await consent.state(purpose)) === 'granted') allowed[purpose] = true;
      } else {
        for (const q of questionsOf(analysed.parts)) {
          const label = q.purpose === 'basemaps' ? D.t('plotly.consent.map') : D.t('plotly.consent.url', { url: String(q.address || q.hosts[0]).slice(0, 200) });
          try {
            await consent.require(q.purpose, { host: hostList(q.hosts), hosts: q.hosts.slice(), label });
            for (const h of q.hosts) /** @type {Set<string>} */ (allowed[q.purpose]).add(h);
          } catch (err) {
            if (!err || err.name !== 'ConsentError') console.error('[plotly] consent failed', err);
          }
        }
      }
      const ready = apply(analysed, allowed);
      return Object.assign(ready, { notice: noticeFor(ready.removed) });
    }

    /**
     * plotly's config for a prepared figure: never a way to Plotly's cloud, and a geo map whose shapes are not allowed gets an
     * address that fetches nothing.
     */
    function configFor(ready, config) {
      Object.assign(config, NO_CLOUD);
      if (!ready.topojson) config.topojsonURL = NO_TOPOJSON;
      return config;
    }

    // ---- links in a chart drawn in the app -------------------------------------------------------------------------
    const XLINK = 'http://www.w3.org/1999/xlink';
    /** A dialog about a link is open: plotly clicks an element again after its own drag ends, and that click asks nothing more. */
    let asking = false;
    /**
     * Ask before a link leaves the app: the dialog names the host and shows the whole address as text, and only a yes opens it,
     * in a new tab without opener or referrer. Resolves true when it was opened; nothing is opened while another such dialog is
     * open, or where the page has no dialogs.
     * @param {URL} url @returns {Promise<boolean>}
     */
    async function openLink(url) {
      if (asking || !D.has('ui/overlays')) return false;
      asking = true;
      try {
        const text = document.createElement('p');
        text.textContent = D.t('plotly.link.body', { host: url.host });
        const kv = /** @type {any} */ (document.createElement('dm-kv'));
        kv.items = [{ label: D.t('plotly.link.address'), value: url.href }];
        const body = document.createElement('div');
        body.className = 'dm-stack-sm';
        body.setAttribute('data-plotly-link', url.href);
        body.append(text, kv);
        const ok = await D.require('ui/overlays').dialog.open({ title: D.t('plotly.link.title'), body, help: 'python#seaborn-och-plotly', actions: [{ label: D.t('common.cancel'), value: false }, { label: D.t('plotly.link.open'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return false;
        window.open(url.href, '_blank', 'noopener,noreferrer');
        return true;
      } finally { asking = false; }
    }
    /**
     * Catch every activation of a link in a chart before plotly or the browser follows it: a click (also by keyboard) and a
     * middle click on an element with an address (an SVG `<a>` plotly draws with xlink:href) are stopped in the capture phase on
     * the chart's element and asked about with openLink() when the address is an absolute https URL; dragging a link out is
     * stopped too. Returns the function that takes the listeners away.
     * @param {HTMLElement} el @returns {() => void}
     */
    function guardLinks(el) {
      const onEvent = (e) => {
        const start = /** @type {any} */ (e.target);
        const a = start && typeof start.closest === 'function' ? start.closest('a') : null;
        if (!a || !el.contains(a) || !(a.hasAttribute('href') || a.hasAttributeNS(XLINK, 'href'))) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragstart' || (e.type === 'auxclick' && e.button !== 1)) return;
        const url = linkUrl(a.getAttributeNS(XLINK, 'href') || a.getAttribute('href'));
        if (url) openLink(url).catch((err) => console.error('[plotly] link', err));
      };
      const types = ['click', 'auxclick', 'dragstart'];
      for (const type of types) el.addEventListener(type, onEvent, true);
      return () => { for (const type of types) el.removeEventListener(type, onEvent, true); };
    }

    /**
     * Draw a figure into an element. Returns a handle with finalize() that frees the plot; when something was left out
     * without consent, `notice` says what, and a line under the element says it too. Links to https addresses stay links, and a
     * click on one asks first (guardLinks).
     * @param {HTMLElement} el @param {any} fig figure JSON ({data, layout}) @param {{width?: number, height?: number}} [options]
     */
    async function render(el, fig, options = {}) {
      const Plotly = await ensure();
      const ready = await prepare(fig, { links: true });
      const unguard = guardLinks(el);
      try {
        await Plotly.newPlot(el, ready.figure.data, layoutFor(ready.figure, options), configFor(ready, { responsive: !options.width, displaylogo: false, modeBarButtonsToRemove: ['sendChartToCloud', 'sendDataToCloud', 'lasso2d', 'select2d'] }));
      } catch (err) { unguard(); throw err; }
      let note = null;
      if (ready.notice && el.parentNode) {
        note = document.createElement('p');
        note.className = 'dm-help dm-small';
        note.setAttribute('role', 'status');
        note.textContent = ready.notice;
        el.after(note);
      }
      return { notice: ready.notice, removed: ready.removed, finalize: () => { unguard(); try { Plotly.purge(el); } catch (_err) { /* already gone */ } if (note) note.remove(); } };
    }

    function dataUrlToBlob(url) {
      const comma = url.indexOf(',');
      const head = url.slice(0, comma);
      const mime = (/data:([^;,]+)/.exec(head) || [])[1] || 'application/octet-stream';
      const payload = url.slice(comma + 1);
      if (/;base64/.test(head)) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(payload)], { type: mime });
    }

    /**
     * Export a figure without showing it: svg, png or pdf at the given pixel size. With `ask: false` (a flow at start) nothing
     * is asked: plotly.js and the figure's maps and addresses come only with a consent already kept, as in htmlFor(). Its links
     * stay text, as in htmlFor(): a file has no app to ask before one is followed.
     * @param {any} fig @param {'svg'|'png'|'pdf'} format @param {{width?: number, height?: number, scale?: number, title?: string, ask?: boolean}} [options]
     */
    async function toBlob(fig, format, options = {}) {
      const Plotly = await ensure({ ask: options.ask });
      const ready = await prepare(fig, { ask: options.ask });
      const width = Number(options.width) || 960;
      const height = Number(options.height) || Math.round(width * 0.6);
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'fixed', left: '-10000px', top: '0', width: width + 'px', height: height + 'px' });
      document.body.appendChild(el);
      try {
        await Plotly.newPlot(el, ready.figure.data, layoutFor(ready.figure, { width, height }), configFor(ready, { displaylogo: false, staticPlot: true }));
        if (format === 'png') return dataUrlToBlob(await Plotly.toImage(el, { format: 'png', width, height, scale: options.scale || 2 }));
        const svgUrl = await Plotly.toImage(el, { format: 'svg', width, height });
        const svgText = await dataUrlToBlob(svgUrl).text();
        if (format === 'svg') return vizExport.svgBlob(svgText);
        if (format === 'pdf') return vizExport.svgToPdf(svgText, { title: options.title });
        throw new Error(D.t('err.unknown.format', { format }));
      } finally {
        try { Plotly.purge(el); } catch (_err) { /* ignore */ }
        el.remove();
      }
    }

    /**
     * Markup for one figure in standalone HTML; the page includes the library (source()) once before it. The page is read
     * later and elsewhere, so nothing is asked: a map or an address comes along only when its consent is kept for good. The page
     * has no app to ask before a link is followed, so every link in its text stays text.
     */
    async function htmlFor(id, fig, options = {}) {
      const ready = await prepare(fig, { ask: false });
      const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
      return `<div id="${id}" class="dm-plotly"></div><script>Plotly.newPlot(${json(id)}, ${json(ready.figure.data)}, ${json(layoutFor(ready.figure, options))}, ${json(configFor(ready, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendChartToCloud', 'sendDataToCloud'] }))});</script>`;
    }

    return { VERSION, SPEC, TOPOJSON_HOST, NO_TOPOJSON, MAP_ICONS, available, ensure, source, template, layoutFor, requests, sanitize, prepare, linkUrl, openLink, guardLinks, render, toBlob, htmlFor, dataUrlToBlob };
  });
})();
