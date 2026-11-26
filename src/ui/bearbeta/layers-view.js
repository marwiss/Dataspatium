// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The view in Bearbeta of the kind `layers` (kartlager): one or more GeoPackages with many layers kept as one dataset, a row per
 * feature with its layer (`lager`), file (`fil`), geometry in WGS 84 and attributes (`egenskaper`, JSON), and the layers described
 * in `_meta.layers` = {filer, lager: [{namn, fil, geometrityp, antal, crs}]}. The layers are drawn on one map, each with its own
 * symbol, and are shown and hidden with the shared list and legend (ui/viz/layer-list), remembered per dataset with the
 * background map (ui/viz/basemap-memory, asked for nothing at start). A clicked feature shows its attributes in the inspector;
 * the table is one button away, and what is done there shows here.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/layers-view', ['ui/base', 'data/datasets', 'data/geo', 'data/kinds', 'viz/leaflet', 'viz/data', 'viz/theme', 'ui/viz/basemap-choice', 'ui/viz/basemap-memory', 'ui/viz/layer-list', 'platform/tier'], (base, datasets, geo, kinds, leaflet, vizData, theme, basemapChoice, memory, layerList, tier) => {
    const { h, t, i18n, replace } = base;
    /** More features than this are left out of the map; the table has them all. */
    const MAX_ROWS = 20000;
    const SEP = '::';
    const FIELDS = ['lager', 'fil', 'objektid', 'geometrityp', 'geometri', 'egenskaper', 'ordning'];
    const fileName = (fil) => String(fil || '').split(/[\\/]/).pop() || String(fil || '');
    const geometryOf = (row) => geo.parseGeometry(row.geometri);
    const keyOf = (fil, namn) => `${fil || ''}${SEP}${namn || ''}`;

    /**
     * The layers of a `layers` dataset in the order `_meta.layers` gives them, then any other its rows name; a layer whose rows
     * were all removed in the table is left out. @param {any} ds @param {any[]} rows @returns {any[]} ui/viz/layer-list's LayerInfo
     */
    function layersOf(ds, rows) {
      const described = ds && ds.layers && Array.isArray(ds.layers.lager) ? ds.layers.lager : [];
      const byKey = new Map();
      for (const m of described) {
        if (!m || !m.namn) continue;
        const key = keyOf(m.fil, m.namn);
        if (!byKey.has(key)) byKey.set(key, { key, fil: String(m.fil || ''), namn: String(m.namn), typ: m.geometrityp, crs: m.crs, rows: [] });
      }
      for (const r of rows) {
        const key = keyOf(r.fil, r.lager);
        if (!byKey.has(key)) byKey.set(key, { key, fil: String(r.fil || ''), namn: String(r.lager || ''), typ: r.geometrityp, crs: null, rows: [] });
        byKey.get(key).rows.push(r);
      }
      return Array.from(byKey.values()).filter((l) => l.rows.length).map((l) => ({
        key: l.key, group: l.fil, groupLabel: fileName(l.fil) || (ds && ds.name) || '', label: l.namn || t('layers.unnamed'), title: l.fil, count: l.rows.length,
        mark: layerList.markOf(l.typ) || layerList.markOfRows(l.rows, geometryOf), rows: l.rows, crs: l.crs,
      }));
    }
    /** A feature's attributes from `egenskaper` as label and text, for the inspector. @param {any} row */
    function attributesOf(row) {
      let props = null;
      try { props = row.egenskaper ? JSON.parse(row.egenskaper) : null; } catch (_e) { props = null; }
      if (!props || typeof props !== 'object' || Array.isArray(props)) return [];
      const show = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? t(v ? 'common.yes' : 'common.no') : typeof v === 'number' ? i18n.formatNumber(v) : typeof v === 'object' ? JSON.stringify(v) : String(v));
      return Object.entries(props).slice(0, 80).map(([k, v]) => ({ label: k, value: show(v) }));
    }

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void, tileFactory?: Function, overlays?: any}} options tileFactory for tests (no tiles are fetched);
     *   overlays the other datasets drawn over the layers (ui/viz/map-overlays: attach, extend, block, detach)
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, basemap: 'none', hidden: new Set(), selected: null, rows: [], layers: [], updatedAt: null, truncated: false };
      let ds = null; let slots = null; let mapEl = null; let handle = null; let seq = 0; let groups = []; let ctl = null; let L = null; let picked = null;
      /** Sweden's orthophoto: read on the next drawing, because the person chose it. */
      let orthoLoad = false;

      async function load(dataset) {
        ds = dataset;
        if (s.id !== dataset.id) {
          Object.assign(s, { id: dataset.id, selected: null, hidden: new Set(), basemap: 'none', updatedAt: null, rows: [] });
          // The background map and the hidden layers it had last (ui/viz/basemap-memory asks nothing).
          const [kept, hidden] = await Promise.all([memory.recall('map', dataset.id), layerList.recall(dataset.id)]);
          if (s.id !== dataset.id) return;
          if (kept) s.basemap = kept.basemap;
          if (hidden) s.hidden = hidden;
        }
        if (s.updatedAt === dataset.updatedAt && s.rows.length) return;
        const columns = await datasets.columns(dataset.id);
        const data = await vizData.fetchRows(dataset.id, { fields: FIELDS.filter((f) => columns.some((c) => c.name === f)), limit: MAX_ROWS });
        s.rows = data.rows.map((r, i) => Object.assign({ _i: i }, r));
        s.truncated = (Number(dataset.rowCount) || 0) > s.rows.length;
        s.layers = layersOf(dataset, s.rows);
        s.updatedAt = dataset.updatedAt;
      }

      /** @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        try { await load(dataset); } catch (err) { replace(target.center, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); return; }
        const orthos = await basemapChoice.options();
        if (my !== seq || !slots) return;
        const choices = [{ value: 'none', label: t('map.basemap.none') }, { value: 'osm', label: t('map.basemap.osm') }].concat(orthos);
        s.basemap = memory.within(s.basemap, choices);
        const basemapSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true, 'data-layers-basemap': '' }));
        basemapSel.options = choices;
        basemapSel.value = s.basemap;
        basemapSel.addEventListener('change', async () => {
          if (!(await basemapChoice.ensure(basemapSel.value))) { basemapSel.value = s.basemap; return; }
          s.basemap = basemapSel.value;
          memory.remember('map', s.id, { basemap: s.basemap });
          orthoLoad = basemapChoice.isView(s.basemap);
          render(dataset, target);
        });
        const orthoBtn = basemapChoice.isView(s.basemap) ? ui.button({ label: t('ortho.se.load'), icon: 'image', 'icon-only': true, title: t('ortho.se.load.hint'), 'data-map-ortho-load': '', onClick: () => { if (handle) basemapChoice.drawView(handle, { load: true, redraw: () => { orthoLoad = true; draw(); } }); } }) : null;
        mapEl = h('div', { class: 'dm-map-view dm-layers-view dm-center-fill', 'aria-label': t('layers.view') });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('layers', 20), dataset.name, ' ', ...kinds.badges(dataset).flatMap((text, i) => (i ? [' ', h('dm-badge', { text })] : [h('dm-badge', { text })]))),
            h('div', { class: 'dm-toolbar' }, ...(tier.shows('map.basemap') ? [basemapSel, orthoBtn] : []),
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('map.fit.hint'), onClick: fit }),
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          mapEl);
        await draw();
        renderInspector();
      }

      async function draw() {
        if (!mapEl || !ds) return;
        const my = ++seq;
        if (handle) { handle.finalize(); handle = null; }
        groups = []; picked = null;
        mapEl.replaceChildren();
        try {
          L = await leaflet.ensure();
          const hd = await leaflet.render(mapEl, { kind: 'map', name: ds.name, map: { layers: [], basemap: s.basemap, custom: { url: '', attribution: '' }, legend: false } }, { tileFactory: options.tileFactory });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          L = /** @type {any} */ (globalThis).L;
          if (hd.info.basemapDenied) ui.toast.show(t('map.basemap.denied'), { kind: 'warn' });
          basemapChoice.notifyKey(hd.info, () => { orthoLoad = true; draw(); });
          const syms = layerList.symbols(s.layers);
          groups = layerList.draw(L, hd.map, s.layers, syms, s.hidden, { rowAt: (i) => s.rows[i], geometryOf, onClick: (row, lyr) => select(row, lyr) });
          ctl = layerList.create({ layers: s.layers, symbols: syms, hidden: s.hidden, onChange: (hidden) => { if (handle) layerList.apply(handle.map, groups, hidden); layerList.remember(s.id, hidden); } });
          if (options.overlays) { await options.overlays.attach(hd, ds, { hostLayers: s.layers, fit, refresh: renderInspector }); if (my !== seq) return; }
          mapEl.setAttribute('data-layers-drawn', String(groups.length));
          fit();
          showPending();
          renderInspector();
          if (hd.info.basemapView) { const load = orthoLoad; orthoLoad = false; await basemapChoice.drawView(hd, { load, redraw: () => { orthoLoad = true; draw(); } }); }
        } catch (err) {
          if (my !== seq) return;
          replace(mapEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log(String((err && err.message) || err), 'error');
        }
      }
      function fit() {
        if (!handle || !L) return;
        let bounds = null;
        for (const g of groups) { const b = g.group.getBounds(); if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); }
        if (options.overlays) bounds = options.overlays.extend(bounds);
        if (bounds) handle.map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18, animate: false });
      }
      /** A feature chosen: marked in the accent colour, its attributes in the inspector. */
      function select(row, lyr) {
        if (picked && picked.lyr.setStyle) picked.lyr.setStyle(picked.style);
        picked = null;
        s.selected = row;
        if (lyr && lyr.setStyle) { picked = { lyr, style: Object.assign({}, lyr.options) }; lyr.setStyle({ weight: 4, color: theme.tokens().accent }); if (lyr.bringToFront) lyr.bringToFront(); }
        renderInspector();
      }
      /** A search hit (`openLayerObject`): its feature chosen and in view. */
      function showPending() {
        const pending = store.get().openLayerObject;
        if (!pending || !ds || pending.datasetId !== ds.id) return;
        store.set({ openLayerObject: null });
        const row = s.rows.find((r) => String(r.objektid) === String(pending.objektid) && (!pending.lager || String(r.lager) === String(pending.lager)));
        if (!row) return;
        for (const g of groups) {
          g.group.eachLayer((lyr) => {
            if (!lyr.feature || lyr.feature.properties._i !== row._i) return;
            select(row, lyr);
            if (handle && lyr.getBounds) handle.map.fitBounds(lyr.getBounds(), { maxZoom: 16 });
            else if (handle && lyr.getLatLng) handle.map.setView(lyr.getLatLng(), 16);
          });
        }
      }

      function renderInspector() {
        if (!slots || !ds) return;
        const files = Array.from(new Set(s.layers.map((l) => fileName(l.group)).filter(Boolean)));
        const crs = Array.from(new Set(s.layers.map((l) => l.crs).filter(Boolean).map((c) => geo.crsText(c))));
        const facts = /** @type {any} */ (h('dm-kv', { 'data-layers-facts': '' }));
        facts.items = [
          { label: t('layers.field.layers'), value: i18n.formatNumber(s.layers.length) },
          { label: t('layers.field.objects'), value: i18n.formatNumber(Number(ds.rowCount) || s.rows.length) },
          files.length ? { label: t('layers.field.files'), value: files.join(', ') } : null,
          crs.length ? { label: t('layers.field.crs'), value: crs.join(', ') } : null,
        ].filter(Boolean);
        const items = [h('h4', { text: t('datasets.kind.layers') }), facts];
        if (s.truncated) items.push(h('p', { class: 'dm-help dm-small', 'data-layers-truncated': '', text: t('layers.truncated', { n: i18n.formatNumber(s.rows.length) }) }));
        items.push(h('h4', { text: t('map.layers') }), ctl ? ctl.list() : null);
        if (options.overlays) items.push(options.overlays.block());
        if (s.selected) {
          const row = s.selected;
          const kv = /** @type {any} */ (h('dm-kv', { 'data-layers-selected': '' }));
          kv.items = [
            { label: t('layers.field.layer'), value: row.lager }, row.fil ? { label: t('layers.field.file'), value: fileName(row.fil) } : null,
            row.geometrityp ? { label: t('viz.channel.geometry'), value: row.geometrityp } : null, row.objektid ? { label: t('layers.field.id'), value: row.objektid } : null,
            ...attributesOf(row),
          ].filter(Boolean);
          items.push(h('h4', { text: t('map.selected') }), kv,
            h('div', { class: 'dm-row-wrap' },
              ui.button({ label: t('map.edit.table'), icon: 'table', size: 'sm', title: t('map.edit.table.hint'), onClick: options.onTable }),
              ui.button({ label: t('common.close'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => select(null, null) })));
        } else {
          items.push(h('h4', { text: t('map.legend') }), ctl ? ctl.legend() : null, h('p', { class: 'dm-help', text: t('layers.help') }));
        }
        replace(slots.right, items);
      }

      function destroy() { seq++; if (options.overlays) options.overlays.detach(); if (handle) { handle.finalize(); handle = null; } groups = []; ctl = null; mapEl = null; slots = null; }
      return { render, destroy, state: s, get handle() { return handle; }, get layers() { return ctl; } };
    }
    return { create, layersOf, attributesOf };
  });
})();
