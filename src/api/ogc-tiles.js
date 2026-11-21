// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Client for OGC API – Tiles (OGC 20-057): reads a service from its landing page (the dataset's own tile sets and those of
 * every collection, `/collections`, `/tileMatrixSets`), lists a source's tile sets and turns one into a Leaflet address
 * template. The map views draw raster tiles (PNG, JPEG, WebP) in Web Mercator: the tile matrix set WebMercatorQuad (also
 * under its older names) or any set whose definition is the same grid. Vector tiles (Mapbox Vector Tiles) are listed but
 * cannot be drawn, because Leaflet has no renderer for them. Every request goes out after consent "basemaps", asked once
 * per reading of a service (a client), and only on the person's action.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/ogc-tiles', ['platform/consent'], (consent) => {
    const t = (k, p) => D.t(k, p);
    const REL = 'http://www.opengis.net/def/rel/ogc/1.0/';
    const RASTER = /^image\/(png|jpe?g|webp)\b/i;
    const VECTOR = /(mapbox-vector-tile|x-protobuf|\bmvt\b|\bpbf\b)/i;
    /** The names Web Mercator's tile matrix set has had (OGC 17-083r2/r4 and the drafts, WMTS's well-known scale set). */
    const WEB_MERCATOR = /^(WebMercatorQuad|GoogleMapsCompatible|GoogleMapsCompatible_Level\d*|EPSG:?3857|EPSG:?900913)$/i;
    /** Scale denominator of WebMercatorQuad's level 0 (256-pixel tiles of 0.28 mm) and the grid's half width in metres. */
    const SCALE0 = 559082264.0287178;
    const HALF = 20037508.3427892;

    const trim = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    const lastSegment = (u) => { const s = String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, ''); return decodeURIComponent(s.slice(s.lastIndexOf('/') + 1)); };
    /** True when a link's relation is `name`, written out, as a CURIE or as the bare word. */
    const relIs = (link, name) => { const r = String((link && link.rel) || ''); return r === name || r === REL + name || r === 'ogc-rel:' + name || r === '[ogc-rel:' + name + ']'; };
    const linksOf = (doc) => (doc && Array.isArray(doc.links) ? doc.links : []);
    /** Plain text of a service's attribution (it may be HTML or Markdown), never markup. */
    function plain(s) {
      const text = String(s || '');
      if (!/[<&]/.test(text)) return text.trim();
      try { return String(new DOMParser().parseFromString(text, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (_e) { return text.replace(/<[^>]*>/g, '').trim(); }
    }

    /**
     * The landing page of a pasted address (a collection, tiles or tile matrix set link works too) and the collection it named.
     * @param {string} input @returns {{landing: string, collection: string}}
     */
    function landingOf(input) {
      let s = String(input || '').trim();
      try { const u = new URL(s); u.search = ''; u.hash = ''; s = u.toString(); } catch (_e) { s = s.replace(/[?#].*$/, ''); }
      s = trim(s);
      const m = /^(.*?)\/collections(?:\/([^/]+))?(?:\/.*)?$/i.exec(s);
      if (m) return { landing: trim(m[1]), collection: m[2] ? decodeURIComponent(m[2]) : '' };
      return { landing: trim(s.replace(/\/(tileMatrixSets|(map\/)?tiles)(\/.*)?$/i, '')), collection: '' };
    }
    /** The address with `f=json` unless it names a format already. */
    function withJson(url) {
      try { const u = new URL(url); if (!u.searchParams.has('f')) u.searchParams.set('f', 'json'); return u.toString(); } catch (_e) { return url + (url.includes('?') ? '&' : '?') + 'f=json'; }
    }
    /** An address in a document, resolved against the document's own address; template placeholders survive. */
    function resolveHref(href, base) {
      const keep = []; const masked = String(href || '').replace(/\{[^}]+\}/g, (m) => { keep.push(m); return `__dmv${keep.length - 1}__`; });
      let out = masked;
      try { out = new URL(masked, base).toString(); } catch (_e) { /* left as given */ }
      return out.replace(/__dmv(\d+)__/g, (_m, i) => keep[Number(i)]);
    }

    /**
     * A reading of one service: GETs JSON after consent "basemaps", asked once for this client (one action of the person).
     * Tests and other callers may pass their own `fetch`.
     * @param {{fetch?: (url: string, init?: any) => Promise<Response>}} [options]
     */
    function client(options = {}) {
      let allowed = false;
      return {
        /** @param {string} url @returns {Promise<any>} */
        async get(url) {
          if (!/^(https?|dataspatium-asset):\/\//i.test(String(url))) throw new Error(t('families.err.url', { field: t('map.tiles.url') }));
          if (!allowed) { await consent.require('basemaps', { host: hostOf(url), url }); allowed = true; }
          const res = await (options.fetch || globalThis.fetch)(withJson(url), { headers: { Accept: 'application/json, application/geo+json;q=0.9, */*;q=0.5' } });
          if (!res.ok) throw new Error(t('geodata.err.http', { status: res.status }));
          const text = await res.text();
          try { return JSON.parse(text); } catch (_e) { throw new Error(t('map.tiles.err.json')); }
        },
      };
    }

    /** The tile set lists a document links to: map (raster) and vector tiles; coverage tiles are data, not pictures. */
    function tileLinks(doc, base) {
      const out = [];
      for (const l of linksOf(doc)) {
        const kind = relIs(l, 'tilesets-map') ? 'map' : relIs(l, 'tilesets-vector') ? 'vector' : relIs(l, 'tiles') ? '' : null;
        if (kind === null || !l.href) continue;
        const url = resolveHref(l.href, base);
        if (!out.some((o) => o.url === url)) out.push({ kind, url });
      }
      return out;
    }

    /**
     * Read a service: its title and attribution, and every source of tiles (the dataset's own tile sets first, then the
     * collections'), each {key, id, title, kind: 'map'|'vector'|'', url}.
     * @param {string} input the landing page (a collection's or a tiles address works too)
     * @param {{get: (url: string) => Promise<any>}} reader a client()
     */
    async function discover(input, reader) {
      const { landing, collection } = landingOf(input);
      if (!/^(https?|dataspatium-asset):\/\//i.test(landing)) throw new Error(t('families.err.url', { field: t('map.tiles.url') }));
      const home = await reader.get(landing);
      const title = String((home && home.title) || hostOf(landing));
      const sources = tileLinks(home, landing).map((l) => ({ key: `${l.kind}:`, id: '', title, kind: l.kind, url: l.url }));
      const dataLink = linksOf(home).find((l) => relIs(l, 'data') && l.href);
      const collectionsUrl = dataLink ? resolveHref(dataLink.href, landing) : landing + '/collections';
      let list = [];
      try {
        const doc = await reader.get(collectionsUrl);
        list = doc && Array.isArray(doc.collections) ? doc.collections : [];
      } catch (err) { if (!sources.length) throw err; }
      for (const c of list) {
        if (!c || !c.id) continue;
        for (const l of tileLinks(c, collectionsUrl)) {
          const key = `${l.kind}:${c.id}`;
          if (!sources.some((s) => s.key === key)) sources.push({ key, id: String(c.id), title: String(c.title || c.id), kind: l.kind, url: l.url });
        }
      }
      if (!sources.length) throw new Error(t('map.tiles.err.none'));
      const tmsLink = linksOf(home).find((l) => relIs(l, 'tiling-schemes') && l.href);
      return { landing, title, attribution: plain(home && home.attribution), collection, sources, tileMatrixSets: tmsLink ? resolveHref(tmsLink.href, landing) : landing + '/tileMatrixSets' };
    }

    /** The tile matrix set a tile set uses: its URI's or id's last part. */
    function tmsIdOf(ts) {
      const uri = ts.tileMatrixSetURI || ts.tileMatrixSetUri || (ts.tileMatrixSetDefinition && String(ts.tileMatrixSetDefinition));
      if (uri) return lastSegment(uri);
      if (ts.tileMatrixSetId || ts.tileMatrixSet) return String(ts.tileMatrixSetId || ts.tileMatrixSet);
      const scheme = linksOf(ts).find((l) => relIs(l, 'tiling-scheme') && l.href);
      if (scheme) return lastSegment(scheme.href);
      const self = linksOf(ts).find((l) => l.rel === 'self' && l.href);
      return self ? lastSegment(self.href) : '';
    }
    /** The templated tile addresses of a document: [{href, type}]. */
    function itemsOf(doc, base) {
      return linksOf(doc).filter((l) => (relIs(l, 'item') || l.rel === 'item') && l.href && (l.templated || /\{tile(Matrix|Row|Col)\}/i.test(l.href))).map((l) => ({ href: resolveHref(l.href, base), type: String(l.type || '') }));
    }

    /**
     * The tile sets of a source, each {id (the tile matrix set), title, kind, webMercator, crs, url (its own document), tms
     * (its definition's address), items, limits}.
     * @param {{url: string, kind: string, title?: string}} source @param {{get: (url: string) => Promise<any>}} reader
     */
    async function tilesets(source, reader) {
      const doc = await reader.get(source.url);
      const out = [];
      if (doc && Array.isArray(doc.tilesets)) {
        for (const ts of doc.tilesets) {
          const id = tmsIdOf(ts);
          const self = linksOf(ts).find((l) => l.rel === 'self' && l.href);
          const scheme = linksOf(ts).find((l) => relIs(l, 'tiling-scheme') && l.href);
          out.push({ id, title: String(ts.title || id), kind: String(ts.dataType || source.kind || ''), webMercator: WEB_MERCATOR.test(id), crs: crsText(ts.crs), url: self ? resolveHref(self.href, source.url) : '', tms: scheme ? resolveHref(scheme.href, source.url) : '', items: itemsOf(ts, source.url), limits: ts.tileMatrixSetLimits || null, attribution: plain(ts.attribution) });
        }
      } else if (doc && Array.isArray(doc.tileMatrixSetLinks)) {
        // The 2020 drafts: the sets are named and the templates hold {tileMatrixSetId}.
        const items = itemsOf(doc, source.url);
        for (const l of doc.tileMatrixSetLinks) {
          const id = String(l.tileMatrixSet || lastSegment(l.tileMatrixSetURI || ''));
          out.push({ id, title: id, kind: source.kind || '', webMercator: WEB_MERCATOR.test(id), crs: '', url: '', tms: '', items: items.map((i) => ({ href: i.href.replace(/\{tileMatrixSetId\}/gi, encodeURIComponent(id)), type: i.type })), limits: l.tileMatrixSetLimits || null, attribution: '' });
        }
      } else if (doc && (doc.tileMatrixSetURI || doc.tileMatrixSetId || itemsOf(doc, source.url).length)) {
        // The address was one tile set.
        const id = tmsIdOf(doc);
        out.push({ id, title: String(doc.title || id), kind: String(doc.dataType || source.kind || ''), webMercator: WEB_MERCATOR.test(id), crs: crsText(doc.crs), url: source.url, tms: '', items: itemsOf(doc, source.url), limits: doc.tileMatrixSetLimits || null, attribution: plain(doc.attribution) });
      }
      if (!out.length) throw new Error(t('map.tiles.err.none'));
      // Web Mercator first: the sets the map can draw.
      return out.sort((a, b) => Number(b.webMercator) - Number(a.webMercator));
    }
    const crsText = (crs) => (typeof crs === 'string' ? crs : crs && typeof crs === 'object' ? String(crs.uri || (crs.wkt ? 'WKT' : '')) : '');

    /**
     * Leaflet's zoom per tile matrix of a definition, or null when the set is not Web Mercator's grid: EPSG:3857, 256-pixel
     * tiles from the top left corner at (−20 037 508, 20 037 508), each level's scale a halving of level 0's.
     * @param {any} def a tile matrix set (2.0 `tileMatrices` or 1.0 `tileMatrix`)
     * @returns {Map<string, number>|null}
     */
    function webMercatorLevels(def) {
      if (!def) return null;
      const crs = crsText(def.crs) || String(def.supportedCRS || '');
      if (!/(3857|900913)$/.test(crs.replace(/\/+$/, ''))) return null;
      const matrices = Array.isArray(def.tileMatrices) ? def.tileMatrices : Array.isArray(def.tileMatrix) ? def.tileMatrix : [];
      const out = new Map();
      for (const m of matrices) {
        const id = String(m.id !== undefined ? m.id : m.identifier);
        const z = Math.log2(SCALE0 / Number(m.scaleDenominator));
        const origin = m.pointOfOrigin || m.topLeftCorner || [-HALF, HALF];
        const corner = String(m.cornerOfOrigin || 'topLeft');
        if (!Number.isFinite(z) || Math.abs(z - Math.round(z)) > 0.01 || Math.round(z) < 0) return null;
        if ((m.tileWidth && Number(m.tileWidth) !== 256) || (m.tileHeight && Number(m.tileHeight) !== 256) || corner !== 'topLeft') return null;
        if (Math.abs(Number(origin[0]) + HALF) > 1 || Math.abs(Number(origin[1]) - HALF) > 1) return null;
        out.set(id, Math.round(z));
      }
      return out.size ? out : null;
    }
    /** The Leaflet text for {tileMatrix}: '{z}' when the ids are the zoom levels, a fixed prefix and '{z}', else null. */
    function matrixPattern(levels) {
      const pairs = Array.from(levels.entries());
      if (pairs.every(([id, z]) => id === String(z))) return '{z}';
      const [id0, z0] = pairs[0];
      if (!id0.endsWith(String(z0))) return null;
      const prefix = id0.slice(0, id0.length - String(z0).length);
      return pairs.every(([id, z]) => id === prefix + z) ? prefix + '{z}' : null;
    }

    /**
     * A tile set as a map layer's tiles: {template (Leaflet's {z}/{x}/{y}), format, tileset, minNativeZoom, maxNativeZoom,
     * attribution}. Throws a message the person can read when the set cannot be drawn (vector tiles, another grid, no template).
     * @param {any} set one of tilesets() @param {any} service discover()'s result @param {{get: (url: string) => Promise<any>}} reader
     */
    async function resolve(set, service, reader) {
      let items = set.items || []; let limits = set.limits; let attribution = set.attribution || '';
      let tmsUrl = set.tms;
      if (!items.some((i) => RASTER.test(i.type)) && set.url) {
        const doc = await reader.get(set.url);
        items = items.concat(itemsOf(doc, set.url));
        limits = limits || doc.tileMatrixSetLimits || null;
        attribution = attribution || plain(doc.attribution);
        const scheme = linksOf(doc).find((l) => relIs(l, 'tiling-scheme') && l.href);
        if (!tmsUrl && scheme) tmsUrl = resolveHref(scheme.href, set.url);
      }
      // An item without a type is taken for a picture when its address ends like one.
      const raster = items.find((i) => RASTER.test(i.type)) || items.find((i) => !i.type && /\.(png|jpe?g|webp)(\?|$)/i.test(i.href));
      if (!raster) throw new Error(set.kind === 'vector' || items.some((i) => VECTOR.test(i.type) || /\.(mvt|pbf)(\?|$)/i.test(i.href)) ? t('map.tiles.err.vector') : t('map.tiles.err.template'));
      let levels = null;
      if (WEB_MERCATOR.test(set.id)) levels = new Map(Array.from({ length: 25 }, (_, z) => [String(z), z]));
      else {
        const def = await reader.get(tmsUrl || `${service.tileMatrixSets}/${encodeURIComponent(set.id)}`).catch(() => null);
        levels = webMercatorLevels(def);
        if (!levels) throw new Error(t('map.tiles.err.tms', { tms: set.id || '?' }));
      }
      const pattern = matrixPattern(levels);
      if (!pattern) throw new Error(t('map.tiles.err.tms', { tms: set.id }));
      // Only the levels the service has: Leaflet enlarges the closest one beyond them.
      let zs = Array.from(levels.values());
      if (Array.isArray(limits) && limits.length) {
        const limited = limits.map((l) => levels.get(String(l.tileMatrix))).filter((z) => typeof z === 'number');
        if (limited.length) zs = limited;
      }
      const template = raster.href
        .replace(/\{tileMatrixSetId\}/gi, encodeURIComponent(set.id))
        .replace(/\{tileMatrix\}/gi, pattern).replace(/\{tileRow\}/gi, '{y}').replace(/\{tileCol\}/gi, '{x}');
      if (!/\{z\}/.test(template) || !/\{x\}/.test(template) || !/\{y\}/.test(template) || /\{[^}]*\}/.test(template.replace(/\{[xyz]\}/g, ''))) throw new Error(t('map.tiles.err.template'));
      return { template, format: raster.type || 'image/png', tileset: set.id, minNativeZoom: Math.min(...zs), maxNativeZoom: Math.max(...zs), attribution: attribution || service.attribution || '' };
    }

    return { REL, WEB_MERCATOR, landingOf, client, discover, tilesets, resolve, webMercatorLevels, matrixPattern, resolveHref };
  });
})();
