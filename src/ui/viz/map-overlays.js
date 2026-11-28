// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Other datasets on the map of the dataset shown in Bearbeta (the plain map, a plan's map, the kind `layers`): the list in the
 * object panel gets a toggle *Visa i kartan* beside every dataset that can be drawn on a map (a table with geometry or
 * coordinates whose values say so, viz/leaflet.drawable, and the kinds drawn on maps: a raster with a place, a plan, kartlager),
 * and the datasets toggled on are drawn over the current one, all at once. Rasters lie in the tile pane under every feature;
 * each other dataset is its own group in the shared layer list and legend (ui/viz/layer-list), with palette colours that go on
 * after the map's own and its own symbols, and a plan keeps Boverket's colours (ui/bearbeta/plan-layers). Big datasets are read
 * in pages and drawn in slices, so that the main thread is never held long; the map fits everything shown. A clicked feature's
 * attributes are in the inspector under its dataset's name. A dataset removed or changed leaves or is drawn again (the
 * datasets' events). What each map shows is remembered by its dataset's id, in the session and in the setting `maps.overlays`
 * ({<id>: {at, ids}}, the way ui/viz/basemap-memory keeps background maps); recalling asks nothing and fetches nothing, since
 * the datasets are the workspace's own.
 *
 * A map view takes part through four calls: `attach(handle, dataset, opts)` once its own layers are drawn (and before it fits),
 * `extend(bounds)` or `bounds()` in its fit, `block()` in its inspector and `detach()` when it goes. Bearbeta gives the list
 * `itemTrailing`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/map-overlays', ['ui/base', 'ui/basic', 'data/datasets', 'data/geo', 'data/kinds', 'viz/leaflet', 'viz/theme', 'ui/viz/layer-list', 'ui/bearbeta/plan-layers', 'ui/bearbeta/layers-view', 'platform/storage/idb', 'platform/tier'], (base, basic, datasets, geo, kinds, leaflet, theme, layerList, planLayers, layersView, idb, tier) => {
    const { h, t, i18n } = base;
    const SETTING = 'maps.overlays';
    /** The maps whose choices the setting keeps, the latest first. */
    const MAX = 200;
    /** Datasets over one map at most. */
    const MAX_SHOWN = 50;
    /** A plan's or kartlager's features read for its map, as their own views read them. */
    const MAX_FEATURES = 20000;
    /** Rows per read from the dataset's worker, so that no message is large. */
    const PAGE = 1000;
    /** How long a slice of reading or drawing may hold the main thread before it lets other work run. */
    const SLICE_MS = 12;
    /** Features added to a layer between two looks at the clock. */
    const CHUNK = 25;
    /** The first z-index of the rasters drawn over a map, above the map's own raster (2) and under every feature. */
    const RASTER_Z = 3;
    const LAYERS_FIELDS = ['lager', 'fil', 'objektid', 'geometrityp', 'geometri', 'ordning'];
    const SEP = '::';
    const q = (c) => '"' + String(c).replace(/"/g, '""') + '"';
    const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const fileName = (fil) => String(fil || '').split(/[\\/]/).pop() || String(fil || '');

    // ---- remembering ------------------------------------------------------------------------------------------
    /** This session's choices: a map's dataset id → the ids shown over it. @type {Map<string, string[]>} */
    const session = new Map();
    /** The setting, read once a session. @type {Promise<Record<string, any>>|null} */
    let stored = null;
    /** The writes in order, so that two choices close together both arrive. */
    let writing = Promise.resolve();
    function readSetting() {
      if (!stored) stored = idb.getSetting(SETTING, null).then((v) => (isObject(v) ? v : {})).catch((err) => { D.log('overlays', err); return {}; });
      return stored;
    }
    /**
     * The setting's entries for the maps and datasets that exist (all of them when `ids` is null), the latest first and at most
     * `max`; an entry left with nothing to show goes.
     * @param {Record<string, any>} all @param {Set<string>|null} ids @param {number} [max] @returns {Record<string, {at: number, ids: string[]}>}
     */
    function trim(all, ids, max = MAX) {
      const entries = Object.entries(isObject(all) ? all : {})
        .filter(([id, e]) => isObject(e) && Array.isArray(e.ids) && (!ids || ids.has(id)))
        .map(([id, e]) => [id, { at: Number(e.at) || 0, ids: e.ids.map(String).filter((x) => x !== id && (!ids || ids.has(x))).slice(0, MAX_SHOWN) }])
        .filter(([, e]) => /** @type {any} */ (e).ids.length);
      entries.sort((a, b) => /** @type {any} */ (b[1]).at - /** @type {any} */ (a[1]).at);
      return Object.fromEntries(entries.slice(0, max));
    }
    async function persist(mapId, ids) {
      const all = Object.assign({}, await readSetting());
      delete all[mapId];
      if (ids.length) all[mapId] = { at: Date.now(), ids };
      let existing = null;
      try { existing = new Set((await datasets.list('all')).map((d) => d.id)); } catch (err) { D.log('overlays', err); }
      const next = trim(all, existing);
      stored = Promise.resolve(next);
      await idb.setSetting(SETTING, next);
    }
    /**
     * Remember the datasets shown over a map: at once for this session, then in the setting. Resolves when it is written; a failed
     * write is logged and the session keeps the choice. @param {string} mapId the map's dataset @param {Iterable<string>} ids
     * @returns {Promise<void>}
     */
    function remember(mapId, ids) {
      if (!mapId) return Promise.resolve();
      const kept = Array.from(new Set(Array.from(ids || [], String))).filter((x) => x !== mapId).slice(0, MAX_SHOWN);
      session.set(mapId, kept);
      writing = writing.then(() => persist(mapId, kept)).catch((err) => D.log('overlays', err));
      return writing;
    }
    /**
     * The datasets shown over a map last, this session's or the setting's ([] when none). Never asks and never fetches.
     * @param {string} mapId @returns {Promise<string[]>}
     */
    async function recall(mapId) {
      if (!mapId) return [];
      const own = session.get(mapId);
      if (own) return own.slice();
      const e = (await readSetting())[mapId];
      return isObject(e) && Array.isArray(e.ids) ? e.ids.map(String).filter((x) => x !== mapId) : [];
    }
    /** Forget this session's choices and read the setting again on the next recall, as after a reload (for the tests). */
    function reset() { session.clear(); stored = null; }

    // ---- what can be drawn ----------------------------------------------------------------------------------
    /**
     * Whether a dataset can be drawn over a map, from its record: 'yes' for a kind drawn on maps (data/kinds: a raster with a
     * place, a plan, kartlager), 'check' for a table whose columns promise places (its values decide, viz/leaflet.drawable), else 'no'.
     * @param {any} d a dataset's record (with its columns) @returns {'yes'|'no'|'check'}
     */
    function candidate(d) {
      if (!d || !tier.shows('view:map')) return 'no';
      const prof = kinds.of(d);
      if (prof.chart === 'map') {
        if (!kinds.shown(d)) return 'no';
        if (prof.mapLayer === 'raster') return kinds.rasterExtent(d.raster && d.raster.files) ? 'yes' : 'no';
        return 'yes';
      }
      if (kinds.isCollection(d) || (d.facets && d.facets.spatial === false)) return 'no';
      return leaflet.mappable(Array.isArray(d.columns) ? d.columns : []) ? 'check' : 'no';
    }
    /** What a table's values said: id → {at: its updatedAt, ok: true|false|null while asked, promise}. @type {Map<string, any>} */
    const checked = new Map();
    /** The tables are asked one at a time, so that a long list opens one dataset after the other. */
    let checking = Promise.resolve(false);
    /** Whether a table's values can be drawn, asked once until the table changes. @param {any} d @returns {Promise<boolean>} */
    function drawableTable(d) {
      const seen = checked.get(d.id);
      if (seen && seen.at === d.updatedAt) return seen.promise;
      const entry = { at: d.updatedAt, ok: null, promise: null };
      checking = checking.then(() => leaflet.drawable(d.id)).then((ok) => !!ok, () => false);
      entry.promise = checking.then((ok) => { entry.ok = ok; return ok; });
      checked.set(d.id, entry);
      return entry.promise;
    }

    // ---- slices -----------------------------------------------------------------------------------------------
    const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
    /** A clock for work in slices: `due()` once the slice has run SLICE_MS, `next()` lets other work run and starts a new slice. */
    function slicer() {
      let start = performance.now();
      return { due: () => performance.now() - start > SLICE_MS, next: async () => { await pause(); start = performance.now(); } };
    }

    /**
     * The overlays of one map view (Bearbeta keeps one for all its map views).
     * @param {any} ctx shell context (store)
     * @param {{onHost?: () => void}} [options] `onHost` is told when the map whose list shows the toggles changes (or goes)
     */
    function create(ctx, options = {}) {
      const store = ctx && ctx.store;
      const st = { shown: /** @type {string[]} */ ([]), hidden: new Set(), selected: /** @type {any} */ (null) };
      /** The map drawn: its leaflet handle, its dataset and what it asked for (`attach`). @type {any} */
      let host = null;
      let seq = 0; let busy = false; let unsubscribe = null; let ctl = null; let picked = null;
      /** @type {Map<string, any>} */ let syms = new Map();
      /** What was read per dataset shown, kept while it is unchanged. @type {Map<string, any>} */
      const cache = new Map();
      /** What is on the current map per dataset shown: its groups [{key, group, count}]. @type {Map<string, {groups: any[]}>} */
      const drawn = new Map();
      /** Changes to a dataset shown, drawn again once they settle. @type {Map<string, any>} */
      const timers = new Map();

      const L = () => /** @type {any} */ (globalThis).L;
      /** Whether the map is still there (a map taken down has no panes). */
      const mapAlive = () => !!(host && host.handle && host.handle.map && host.handle.map._mapPane);
      const alive = (my) => my === seq && mapAlive();
      const refresh = () => { if (host && host.opts.refresh) host.opts.refresh(); };
      const shownEntries = () => st.shown.map((id) => (drawn.has(id) ? cache.get(id) : null)).filter(Boolean);

      // ---- reading ----
      /**
       * A dataset's rows in pages of PAGE in the order of its rows, at most `limit`, each with `_rowid` and `_i` (its place).
       * @param {any} meta @param {string[]|null} fields null for every column @param {number} limit
       */
      async function readRows(meta, fields, limit) {
        const hd = await datasets.ensureOpen(meta.id);
        const have = new Set(hd.columns.map((c) => c.name));
        const names = (fields || hd.columns.map((c) => c.name)).filter((n, i, all) => n && have.has(n) && all.indexOf(n) === i);
        const select = ['rowid'].concat(names.map(q)).join(', ');
        const rows = []; let last = null;
        while (rows.length < limit) {
          const n = Math.min(PAGE, limit - rows.length);
          const r = await hd.engine.exec(`select ${select} from data${last === null ? '' : ' where rowid > ?'} order by rowid limit ${n}`, last === null ? [] : [last]);
          const values = r[0] ? r[0].values : [];
          for (const v of values) {
            const row = { _rowid: v[0], _i: rows.length };
            for (let k = 0; k < names.length; k++) row[names[k]] = v[k + 1];
            rows.push(row);
          }
          if (values.length < n) return { rows, truncated: false };
          last = values[values.length - 1][0];
        }
        const more = await hd.engine.exec('select 1 from data where rowid > ? limit 1', [last]);
        return { rows, truncated: !!(more[0] && more[0].values.length) };
      }
      /**
       * A layer's name says its file when a dataset has several (the group is the dataset over another map).
       * @param {any[]} infos layer-list's LayerInfo from the dataset's own view
       */
      function named(infos) {
        if (new Set(infos.map((l) => l.group)).size > 1) for (const l of infos) l.label = `${l.groupLabel || fileName(l.group)} · ${l.label}`;
        return infos;
      }
      /** What a dataset brings to the map: its layers (LayerInfo with rows whose `_g` is the geometry in WGS 84), or its raster. */
      async function read(meta) {
        const entry = { id: meta.id, meta, updatedAt: meta.updatedAt, name: meta.name, infos: [], rows: [], truncated: false, crsUnknown: '', raster: false, rasterProjection: false, label: null, geometry: null };
        const group = { group: meta.id, groupLabel: meta.name };
        const prof = kinds.of(meta);
        if (prof.mapLayer === 'raster') {
          const tk = theme.tokens();
          entry.raster = true;
          entry.infos = [Object.assign({ key: meta.id + SEP + 'raster', label: meta.name, count: 0, mark: 'polygon', symbol: { mark: 'polygon', color: tk.muted, fill: tk.grid, fillOpacity: 0.8, weight: 1 } }, group)];
          return entry;
        }
        const clock = slicer();
        if (meta.kind === 'plan' || meta.kind === 'layers') {
          const isPlan = meta.kind === 'plan';
          const got = await readRows(meta, isPlan ? null : LAYERS_FIELDS, MAX_FEATURES);
          entry.rows = got.rows; entry.truncated = got.truncated;
          for (const r of entry.rows) { r._g = r.geometri ? geo.parseGeometry(r.geometri) : null; if (clock.due()) await clock.next(); }
          const slag = meta.plan && meta.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan';
          const infos = isPlan ? planLayers.of(entry.rows, { slag, name: meta.name }) : layersView.layersOf(meta, entry.rows);
          entry.infos = named(infos).map((l) => Object.assign(l, { key: meta.id + SEP + l.key }, group));
          entry.label = isPlan ? (slag === 'oversiktsplan' ? 'namn' : 'beteckning') : null;
          return entry;
        }
        // A table: its geometry column or its coordinates, and its label for the tooltip (viz/leaflet.layerFor, as on its own map).
        const layer = leaflet.layerFor(await datasets.columns(meta.id), meta, 0);
        if (!layer) return entry;
        entry.geometry = layer.geometry; entry.label = layer.label;
        const got = await readRows(meta, [layer.geometry, layer.lon, layer.lat, layer.label].filter(Boolean), leaflet.MAX_ROWS);
        entry.rows = got.rows; entry.truncated = got.truncated;
        for (const r of entry.rows) {
          r._g = layer.geometry ? geo.parseGeometry(r[layer.geometry]) : (typeof r[layer.lon] === 'number' && typeof r[layer.lat] === 'number' ? { type: 'Point', coordinates: [r[layer.lon], r[layer.lat]] } : null);
          if (layer.geometry) delete r[layer.geometry];
          if (clock.due()) await clock.next();
        }
        // Metres become degrees in the dataset's own system, as on its own map (viz/leaflet.featuresOf); a system the app cannot
        // convert leaves it without features and is named.
        const placed = entry.rows.filter((r) => r._g);
        const crs = geo.crsOfMeta(meta);
        if (placed.length && geo.isProjected(placed.slice(0, 50).map((r) => r._g))) {
          if (geo.crsUnknown(crs)) entry.crsUnknown = String(crs);
          for (const r of placed) { r._g = geo.toWgs84(r._g, crs || undefined); if (clock.due()) await clock.next(); }
        }
        const rows = entry.rows.filter((r) => r._g && r._g.type);
        entry.infos = [Object.assign({ key: meta.id + SEP + 'data', label: meta.name, count: rows.length, mark: layerList.markOfRows(rows.slice(0, 200).map((r) => ({ geometrityp: r._g.type }))), rows }, group)];
        return entry;
      }
      /** A dataset's entry, read again when it changed; null when the dataset is gone. */
      async function load(id) {
        const meta = await datasets.get(id);
        if (!meta) return null;
        const had = cache.get(id);
        if (had && had.updatedAt === meta.updatedAt) return had;
        const entry = await read(meta);
        cache.set(id, entry);
        return entry;
      }

      // ---- drawing ----
      /** The map's own layers in the list and legend, when the map asked for them (`listHost`): its dataset is a group too. */
      function listed() {
        if (!host || !host.opts.listHost) return [];
        if (host.listed) return host.listed;
        const tk = theme.tokens();
        host.listed = (host.handle.groups || []).map((g, i) => {
          const first = g.group.getLayers()[0];
          const mark = layerList.markOf(first && first.feature && first.feature.geometry ? first.feature.geometry.type : '') || 'polygon';
          const style = g.layer.style || {};
          const color = theme.cssColor(style.color) || tk.palette[0];
          const fillOpacity = Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : 0.45;
          const legend = Array.isArray(g.legend) ? g.legend : [];
          return { group: g.group, info: {
            key: host.dataset.id + SEP + 'own' + SEP + i, group: host.dataset.id, groupLabel: host.dataset.name, label: g.layer.name || host.dataset.name,
            count: g.group.getLayers().length, mark, symbol: { mark, color, fill: mark === 'line' || !(fillOpacity > 0) ? null : leaflet.swatchColor(g.layer) || color, fillOpacity, weight: 1.5 },
            categories: legend.length > 1 ? legend.map((e) => ({ label: e.label, color: e.color })) : undefined,
          } };
        });
        return host.listed;
      }
      /**
       * The symbols of the overlays' layers: their palette colours go on after the map's own (its `hostLayers`, or one colour per
       * listed layer), in the order the datasets were shown, so that a dataset added keeps the others' colours.
       */
      function symbolsFor() {
        const own = host.opts.hostLayers || listed().map((l) => ({ key: '\u0000' + l.info.key, mark: l.info.mark, count: 0 }));
        const infos = st.shown.map((id) => cache.get(id)).filter(Boolean).flatMap((e) => e.infos);
        const out = layerList.symbols(own.concat(infos));
        for (const l of listed()) out.set(l.info.key, layerList.symbols([l.info]).get(l.info.key));
        return out;
      }
      /** A feature's tooltip (its label as a text node) and its click. */
      function bind(entry, row, lyr) {
        const label = entry.label && row ? row[entry.label] : null;
        if (label !== null && label !== undefined && label !== '') lyr.bindTooltip(() => document.createTextNode(String(label)), { sticky: true, direction: 'top' });
        lyr.on('click', () => { select(entry, row, lyr).catch((err) => D.log('overlays', err)); });
      }
      /**
       * Draw one dataset on the map: a raster's pictures in the tile pane, else a GeoJSON layer per layer with its symbol, filled
       * in slices. A hidden layer is made but not added. Stops when another drawing has begun (`my`).
       */
      async function drawEntry(entry, my) {
        const Lf = L();
        const map = host.handle.map;
        const out = { groups: [] };
        drawn.set(entry.id, out);
        if (entry.raster) {
          const info = {};
          const at = RASTER_Z + st.shown.filter((x) => cache.get(x) && cache.get(x).raster).indexOf(entry.id);
          const pictures = await leaflet.rasterImages(Lf, { layers: [leaflet.rasterLayer(entry.meta)] }, info, host.handle.crs !== 3857, at);
          if (!alive(my)) return;
          entry.rasterProjection = !!(/** @type {any} */ (info).rasterProjection);
          const images = pictures.flatMap((p) => p.images);
          entry.infos[0].count = images.length;
          const group = Lf.featureGroup(images);
          if (!st.hidden.has(entry.infos[0].key)) group.addTo(map);
          out.groups.push({ key: entry.infos[0].key, group, count: images.length });
          return;
        }
        const clock = slicer();
        for (const info of entry.infos) {
          const sym = syms.get(info.key);
          if (!sym) continue;
          const rowOf = (f) => entry.rows[f.properties._i];
          const group = Lf.geoJSON(null, {
            style: (f) => layerList.styleOf(sym, rowOf(f)),
            pointToLayer: (f, latlng) => layerList.pointOf(Lf, sym, latlng, rowOf(f)),
            onEachFeature: (f, lyr) => bind(entry, rowOf(f), lyr),
          });
          if (!st.hidden.has(info.key)) group.addTo(map);
          const item = { key: info.key, group, count: 0 };
          out.groups.push(item);
          let batch = [];
          for (const row of info.rows || []) {
            if (row && row._g && row._g.type) batch.push({ type: 'Feature', geometry: row._g, properties: { _i: row._i } });
            if (batch.length < CHUNK) continue;
            group.addData(batch); item.count += batch.length; batch = [];
            if (clock.due()) { await clock.next(); if (!alive(my)) return; }
          }
          if (batch.length) { group.addData(batch); item.count += batch.length; }
          if (clock.due()) { await clock.next(); if (!alive(my)) return; }
        }
      }
      /** Read and draw one dataset; one that is gone is forgotten. */
      async function drawOne(id, my) {
        let entry = null;
        try { entry = await load(id); } catch (err) { D.log('overlays', err); return; }
        if (!alive(my) || !st.shown.includes(id)) return;
        if (!entry) { forget(id); return; }
        syms = symbolsFor();
        await drawEntry(entry, my);
      }
      /** Draw the datasets in order; the list and legend follow when all are drawn. */
      async function pass(my, ids) {
        busy = true;
        try {
          for (const id of ids) { if (!alive(my)) return; await drawOne(id, my); }
        } finally { if (my === seq) busy = false; }
        if (alive(my)) rebuild();
      }
      /** The list and legend of what is drawn (ui/viz/layer-list): the map's own layers when listed, then a group per dataset. */
      function rebuild() {
        if (!host) { ctl = null; return; }
        const entries = shownEntries();
        // The map's own layers are listed only beside other datasets: without them none of its own stays hidden.
        if (!entries.length) for (const l of listed()) st.hidden.delete(l.info.key);
        if (mapAlive()) layerList.apply(host.handle.map, listed().map((l) => ({ key: l.info.key, group: l.group })), st.hidden);
        if (!entries.length) { ctl = null; return; }
        const layers = listed().map((l) => l.info).concat(entries.flatMap((e) => e.infos));
        ctl = layerList.create({ layers, symbols: syms, hidden: st.hidden, onChange: (hidden) => { if (mapAlive()) layerList.apply(host.handle.map, allGroups(), hidden); } });
      }
      const allGroups = () => listed().map((l) => ({ key: l.info.key, group: l.group })).concat(Array.from(drawn.values()).flatMap((d) => d.groups));
      /** Take the overlays off the map they are on. */
      function takeDown() {
        const map = mapAlive() ? host.handle.map : null;
        for (const d of drawn.values()) for (const g of d.groups) { if (map && map.hasLayer(g.group)) map.removeLayer(g.group); }
        drawn.clear(); ctl = null; picked = null;
      }
      /** Draw every dataset shown again (after one went or changed in the middle), then fit and show the inspector. */
      async function redraw() {
        if (!host) return;
        const my = ++seq;
        takeDown();
        await pass(my, st.shown.slice());
        if (alive(my)) after();
      }
      function after() { if (host && host.opts.fit) host.opts.fit(); refresh(); }
      /** A dataset no longer shown: off the map (all drawn again when the colours after it would move), the list and the setting. */
      function drop(id) {
        const wasLast = st.shown[st.shown.length - 1] === id;
        st.shown = st.shown.filter((x) => x !== id);
        if (host) remember(host.dataset.id, st.shown);
        cache.delete(id);
        if (st.selected && st.selected.entry.id === id) { st.selected = null; picked = null; }
        mark(id, false);
        if (!host) return;
        if (busy || !wasLast) { redraw().catch((err) => D.log('overlays', err)); return; }
        const d = drawn.get(id);
        if (d && mapAlive()) for (const g of d.groups) host.handle.map.removeLayer(g.group);
        drawn.delete(id);
        rebuild();
        after();
      }
      /** A dataset that is gone: not shown, not remembered. */
      function forget(id) {
        st.shown = st.shown.filter((x) => x !== id);
        if (host) remember(host.dataset.id, st.shown);
        cache.delete(id);
        mark(id, false);
      }

      // ---- the toggles ----
      const tip = (on, name) => t(on ? 'overlay.hide.hint' : 'overlay.show.hint', { name });
      /** The toggle Visa i kartan of a dataset, pressed when it shows. */
      function toggleButton(d) {
        const on = st.shown.includes(d.id);
        return basic.button({
          label: t('overlay.show', { name: d.name }), icon: on ? 'eye' : 'eye-off', 'icon-only': true, variant: 'ghost', size: 'sm', class: 'dm-overlay-toggle',
          title: tip(on, d.name), pressed: on ? 'true' : 'false', 'data-overlay-toggle': d.id, 'data-overlay-name': d.name,
          onClick: (e) => { e.stopPropagation(); toggle(d.id).catch((err) => D.log('overlays', err)); },
        });
      }
      /** Every toggle of a dataset on the page follows its state. */
      function mark(id, on) {
        for (const el of Array.from(document.querySelectorAll('[data-overlay-toggle]'))) {
          if (el.getAttribute('data-overlay-toggle') !== id) continue;
          el.setAttribute('pressed', on ? 'true' : 'false');
          el.setAttribute('icon', on ? 'eye' : 'eye-off');
          el.setAttribute('title', tip(on, el.getAttribute('data-overlay-name') || ''));
        }
      }
      /**
       * The control after a dataset in the list (dataset-list's `itemTrailing`): the toggle for a dataset that can be drawn over
       * the map shown, null for the map's own dataset, one that cannot, or when no map is shown. A table's values decide first:
       * its toggle takes the place of an empty mark once they have said so.
       * @param {any} d @returns {Node|null}
       */
      function itemTrailing(d) {
        if (!host || !d || d.id === host.dataset.id) return null;
        const selected = store ? store.get().selectedId : null;
        if (selected && selected !== host.dataset.id) return null;
        const can = candidate(d);
        if (can === 'no') return null;
        if (can === 'yes') return toggleButton(d);
        const seen = checked.get(d.id);
        if (seen && seen.at === d.updatedAt && seen.ok !== null) return seen.ok ? toggleButton(d) : null;
        const slot = h('span', { class: 'dm-overlay-pending', 'data-overlay-pending': d.id });
        drawableTable(d).then((ok) => { if (!slot.isConnected) return; if (ok && host) slot.replaceWith(toggleButton(d)); else slot.remove(); });
        return slot;
      }
      /** Show a dataset over the map, or take it off. @param {string} id */
      async function toggle(id) {
        if (!host) return;
        if (st.shown.includes(id)) { drop(id); return; }
        if (st.shown.length >= MAX_SHOWN || id === host.dataset.id) return;
        st.shown = st.shown.concat([id]);
        remember(host.dataset.id, st.shown);
        mark(id, true);
        // A drawing under way starts again with the new list; otherwise the dataset is drawn after the others.
        if (busy) { await redraw(); return; }
        if (!mapAlive()) return;
        const my = seq;
        await pass(my, [id]);
        if (alive(my)) after();
      }

      // ---- the inspector ----
      /** A clicked feature's attributes, read from its dataset (the map has only what it draws). */
      async function attributesOf(entry, row) {
        if (!row) return [];
        const show = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? i18n.formatNumber(v) : String(v));
        const kind = entry.meta.kind;
        if (kind === 'plan') return Object.keys(row).filter((k) => !k.startsWith('_') && k !== 'geometri' && k !== 'egenskaper' && row[k] !== null && row[k] !== '').slice(0, 40).map((k) => ({ label: k, value: show(row[k]) }));
        const hd = await datasets.ensureOpen(entry.id);
        if (kind === 'layers') {
          const own = hd.columns.some((c) => c.name === 'egenskaper') ? await hd.engine.exec('select egenskaper from data where rowid = ?', [row._rowid]) : [];
          const egenskaper = own[0] && own[0].values[0] ? own[0].values[0][0] : null;
          return [
            { label: t('layers.field.layer'), value: show(row.lager) }, row.fil ? { label: t('layers.field.file'), value: fileName(row.fil) } : null,
            row.geometrityp ? { label: t('viz.channel.geometry'), value: show(row.geometrityp) } : null, row.objektid ? { label: t('layers.field.id'), value: show(row.objektid) } : null,
            ...layersView.attributesOf({ egenskaper }),
          ].filter(Boolean);
        }
        const r = await hd.engine.exec('select * from data where rowid = ?', [row._rowid]);
        if (!r[0] || !r[0].values.length) return [];
        const values = r[0].values[0];
        return r[0].columns.map((c, i) => ({ label: c, value: values[i] })).filter((x) => x.label !== entry.geometry).slice(0, 40).map((x) => ({ label: x.label, value: show(x.value) }));
      }
      function unpick() { if (picked && picked.lyr.setStyle) picked.lyr.setStyle(picked.style); picked = null; }
      /** A feature clicked: marked in the accent colour, its attributes under its dataset's name in the inspector. */
      async function select(entry, row, lyr) {
        unpick();
        if (lyr && lyr.setStyle) { picked = { lyr, style: Object.assign({}, lyr.options) }; lyr.setStyle({ weight: 4, color: theme.tokens().accent }); if (lyr.bringToFront) lyr.bringToFront(); }
        const chosen = { entry, row, items: null };
        st.selected = chosen;
        if (host && host.opts.onSelect) host.opts.onSelect();
        refresh();
        chosen.items = await attributesOf(entry, row).catch((err) => { D.log('overlays', err); return []; });
        if (st.selected === chosen) refresh();
      }
      /** The feature chosen on an overlay is let go (the map's own was clicked). */
      function clear() { if (!st.selected) return; unpick(); st.selected = null; }
      /**
       * The overlays' part of the inspector: the feature chosen with its dataset's name, then the datasets shown with the layer list
       * and legend, or a line saying how to show more. Null when no map is drawn.
       * @returns {HTMLElement|null}
       */
      function block() {
        if (!host) return null;
        const items = [];
        const sel = st.selected;
        if (sel) {
          const kv = /** @type {any} */ (h('dm-kv', { 'data-overlay-selected': sel.entry.id }));
          kv.items = sel.items || [];
          items.push(h('h4', { text: t('overlay.selected', { name: sel.entry.name }) }),
            sel.items ? kv : h('p', { class: 'dm-help dm-small', text: t('common.loading') }),
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('overlay.open'), icon: 'chevron-right', size: 'sm', title: t('overlay.open.hint', { name: sel.entry.name }), 'data-overlay-open': sel.entry.id, onClick: () => { if (store) store.set({ selectedId: sel.entry.id }); } }),
              basic.button({ label: t('common.close'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { clear(); refresh(); } })));
        }
        const entries = shownEntries();
        if (!st.shown.length) items.push(h('p', { class: 'dm-help dm-small', 'data-overlay-hint': '', text: t('overlay.hint') }));
        else {
          items.push(h('h4', { text: t('overlay.title') }));
          for (const e of entries) {
            if (e.truncated) items.push(h('p', { class: 'dm-help dm-small', text: t('overlay.truncated', { name: e.name, n: i18n.formatNumber(e.rows.length) }) }));
            if (e.crsUnknown) items.push(h('p', { class: 'dm-error dm-small', 'data-overlay-crs-unknown': e.id, text: t('overlay.crs.unknown', { name: e.name, crs: e.crsUnknown }) }));
            if (e.rasterProjection) items.push(h('p', { class: 'dm-help dm-small', text: t('overlay.raster.grid', { name: e.name }) }));
          }
          if (ctl) items.push(ctl.list(), h('h4', { text: t('map.legend') }), ctl.legend());
          else items.push(h('p', { class: 'dm-help dm-small', text: t('common.loading') }));
        }
        return h('div', { class: 'dm-stack-sm dm-map-overlays', 'data-overlays': String(entries.length) }, items);
      }

      // ---- the map ----
      /** The overlays that show, as Leaflet bounds, or null. */
      function bounds() {
        if (!mapAlive()) return null;
        const map = host.handle.map; let box = null;
        for (const d of drawn.values()) {
          for (const g of d.groups) {
            if (!map.hasLayer(g.group) || !g.group.getBounds) continue;
            const b = g.group.getBounds();
            if (b && b.isValid()) box = box ? box.extend(b) : L().latLngBounds(b.getSouthWest(), b.getNorthEast());
          }
        }
        return box;
      }
      /** A map's own bounds with the overlays', for its fit. @param {any} own Leaflet bounds or null @returns {any} */
      function extend(own) {
        const more = bounds();
        if (!more) return own;
        if (!own || !own.isValid()) return more;
        return L().latLngBounds(own.getSouthWest(), own.getNorthEast()).extend(more);
      }
      /** Changes to the datasets: one shown that is removed leaves the map, one that is changed is drawn again. */
      function listen() {
        if (unsubscribe) return;
        unsubscribe = datasets.subscribe((type, payload) => {
          const id = payload && payload.id;
          if (!id) return;
          const gone = type === 'deleted' || (type === 'remote' && payload.action === 'deleted');
          const changed = type === 'updated' || (type === 'remote' && payload.action === 'saved');
          if (gone) checked.delete(id);
          if (!host || !st.shown.includes(id)) return;
          if (gone) { clearTimeout(timers.get(id)); timers.delete(id); drop(id); return; }
          if (!changed) return;
          clearTimeout(timers.get(id));
          timers.set(id, setTimeout(() => { timers.delete(id); cache.delete(id); redraw().catch((err) => D.log('overlays', err)); }, 250));
        });
      }
      /**
       * Draw the datasets shown over a map that has just drawn its own layers: the ones remembered for its dataset the first time
       * (never asking, never fetching), the same again after a redraw. Resolves when they are drawn, before the map fits.
       * @param {any} handle viz/leaflet's handle @param {any} dataset the map's dataset
       * @param {{hostLayers?: any[], listHost?: boolean, fit?: () => void, refresh?: () => void, onSelect?: () => void}} [opts]
       *   `hostLayers` the layers the map drew with palette colours (the overlays' colours come after), `listHost` its own
       *   layers (handle.groups) in the list and legend too, `fit` and `refresh` its fit and inspector, `onSelect` told when an
       *   overlay's feature is chosen
       */
      async function attach(handle, dataset, opts = {}) {
        const my = ++seq;
        takeDown();
        const changed = !host || host.dataset.id !== dataset.id;
        host = { handle, dataset, opts, listed: null };
        if (changed) {
          st.selected = null; st.hidden = new Set();
          st.shown = (await recall(dataset.id)).filter((id) => id !== dataset.id);
          if (my !== seq) return;
          for (const id of Array.from(cache.keys())) if (!st.shown.includes(id)) cache.delete(id);
          if (options.onHost) options.onHost();
        }
        listen();
        await pass(my, st.shown.slice());
      }
      /** The map goes: the overlays leave it, and the list loses its toggles. */
      function detach() {
        if (!host) return;
        seq++; busy = false;
        takeDown();
        host = null; st.selected = null;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        if (options.onHost) options.onHost();
      }

      return {
        attach, detach, itemTrailing, toggle, block, bounds, extend, clear,
        /** The ids shown over the map, in order. */
        get shown() { return st.shown.slice(); },
        /** The feature chosen on an overlay, or null. */
        get selected() { return st.selected; },
        /**
         * What a dataset shown over the map brought, as it was read for drawing: its name, the field of its label and its rows
         * (`_rowid`, `_g` the geometry in WGS 84); null when it is not shown, not read yet or a raster (the plan's AI, B-78).
         * @param {string} id @returns {{id: string, name: string, label: string|null, rows: any[]}|null}
         */
        features(id) {
          const e = st.shown.includes(id) ? cache.get(id) : null;
          return e && !e.raster ? { id: e.id, name: e.name, label: e.label, rows: e.rows } : null;
        },
        /** The map's dataset id, or null. */
        get hostId() { return host ? host.dataset.id : null; },
        /** The groups drawn per dataset shown (for the tests). @param {string} id */
        groups: (id) => (drawn.get(id) || { groups: [] }).groups.slice(),
        /** The list and legend of what is drawn, or null. */
        get layers() { return ctl; },
        /** Resolves when the drawing under way is done (for the tests). */
        get busy() { return busy; },
      };
    }

    return { SETTING, MAX, MAX_SHOWN, create, candidate, recall, remember, reset, trim };
  });
})();
