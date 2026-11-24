// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Plan view in Bearbeta for datasets of kind "plan": a detailed development plan drawn as a plan map (uses filled
 * with Boverket's colours, property and administrative provisions as outlines, designations as labels, the plan
 * boundary on top) or a comprehensive plan by theme, with zoom and pan, an optional background map after consent
 * (OpenStreetMap, an orthophoto in the grids its service offers, a WMS, or OGC API – Tiles in Web Mercator), remembered with
 * the map's grid per plan (ui/viz/basemap-memory) so that they are there again when the person comes back to the plan,
 * the provisions listed in the inspector and the clicked provision explained from the embedded catalogue. The
 * dataset itself is always the table of plan objects; the table is one click away.
 * The layers (per GeoPackage and source layer of a delivered comprehensive plan, else per theme or object type) are shown and
 * hidden with ui/viz/layer-list, each with its own symbol and in the legend (ui/bearbeta/plan-layers); a delivery's text and
 * files are the tabs Ställningstaganden and Filer beside the map, and a chosen area's sections are in the inspector
 * (ui/bearbeta/plan-sections).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-view', ['ui/base', 'data/datasets', 'data/plan', 'data/plan-catalog', 'data/geo', 'viz/leaflet', 'viz/charts', 'viz/data', 'platform/files', 'ui/viz/basemap-choice', 'ui/viz/basemap-memory', 'ui/viz/tiles-dialog', 'platform/tier', 'ui/viz/layer-list', 'ui/bearbeta/plan-layers', 'ui/bearbeta/plan-sections'], (base, datasets, plan, catalog, geo, leaflet, charts, vizData, files, basemapChoice, memory, tilesDialog, tier, layerList, planLayers, planSections) => {
    const { h, t, i18n, replace } = base;
    const MAX_ROWS = 20000;

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void, tileFactory?: Function}} options tileFactory for tests (no tiles are fetched)
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, basemap: 'none', wms: null, tiles: null, projection: 'web', labels: true, hidden: new Set(), selected: null, rows: [], info: null, slag: 'detaljplan', updatedAt: null, layers: [], marked: [] };
      let ds = null; let slots = null; let mapEl = null; let handle = null; let seq = 0; let groups = []; let labelLayer = null; let L = null;
      /** The layer list and legend of the plan drawn (ui/viz/layer-list), the layers' symbols, and the areas marked for a section. */
      let layerCtl = null; let symbols = new Map(); let marks = null;
      /** The plan's text and files beside the map. */
      const sections = planSections.create(ctx, { mark: (ids) => markObjects(ids), shown: () => { if (handle) { handle.map.invalidateSize(); if (marks) fitMarks(); else fit(); } }, changed: () => { s.updatedAt = null; if (ds && slots) render(ds, slots); } });
      /** Sweden's orthophoto: read on the next drawing, because the person chose it (for the plan's extent, at most a square kilometre). */
      let orthoLoad = false;
      /** A background map remembered for the plan, checked against the choices once they are known. */
      let restored = false;
      /** The plan's background map, its WMS or tiles and the map's grid, remembered for the plan when the person changes them. */
      const keep = () => memory.remember('plan', s.id, { basemap: s.basemap, projection: s.projection, wms: s.basemap === 'wms' ? s.wms : null, tiles: s.basemap === 'tiles' ? s.tiles : null });
      async function loadOrtho(hd, load) {
        const status = await basemapChoice.drawView(hd, { load, redraw: () => { orthoLoad = true; draw(); } });
        if (status === 'idle') ui.toast.show(t('ortho.se.idle'), { kind: 'info', timeout: 9000 });
        return status;
      }

      /** Read the plan's rows (objects) and facts. */
      async function load(dataset) {
        ds = dataset;
        s.info = dataset.plan || {};
        s.slag = s.info.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan';
        if (s.id !== dataset.id) {
          s.id = dataset.id; s.selected = null; s.hidden = new Set(); s.basemap = 'none'; restored = false;
          // Another plan starts with the background map and grid it had last (ui/viz/basemap-memory asks nothing); a plan
          // without one keeps the grid shown, as before.
          const kept = await memory.recall('plan', dataset.id);
          if (kept && s.id === dataset.id) {
            s.basemap = kept.basemap; restored = true;
            if (kept.projection === 'web' || kept.projection === 'plan') s.projection = kept.projection;
            if (kept.wms && typeof kept.wms === 'object') s.wms = kept.wms;
            if (kept.tiles && typeof kept.tiles === 'object') s.tiles = kept.tiles;
          }
          // The layers the person hid on this plan's map before (ui/viz/layer-list); all show the first time.
          const hidden = await layerList.recall(dataset.id);
          if (hidden && s.id === dataset.id) s.hidden = hidden;
          s.marked = [];
        }
        if (s.updatedAt === dataset.updatedAt && s.rows.length) return;
        const columns = await datasets.columns(dataset.id);
        const data = await vizData.fetchRows(dataset.id, { fields: columns.map((c) => c.name), limit: MAX_ROWS });
        s.rows = data.rows.map((r, i) => Object.assign({ _i: i }, r));
        s.layers = planLayers.of(s.rows, { slag: s.slag, name: dataset.name });
        s.updatedAt = dataset.updatedAt;
      }
      /** The grid the plan map can be drawn in: the plan's own system when the app reads it, else the country's usual one. */
      function planGrid() {
        const own = geo.crsCode((s.info || {}).crs);
        if (own && geo.proj4Def(own)) return own;
        return { DK: 25832, NO: 25833, FI: 3067, IS: 3057 }[(s.info || {}).land] || 3006;
      }
      const labelText = (row) => (s.slag === 'oversiktsplan' ? (row.tema === 'markochvattenanvandning' ? row.innehallstyp : row.namn) : row.beteckning);

      /**
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target
       */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        try { await load(dataset); } catch (err) { replace(target.center, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); return; }
        if (my !== seq || !slots) return;
        // The map in Web Mercator (as web maps are) or in the plan's own grid (SWEREF 99 TM or its zone), with north up as on the plan map.
        const grid = planGrid();
        // The orthophotos whose service offers the map's grid (Web Mercator or the plan's own).
        const orthos = await basemapChoice.options({ grid: s.projection === 'plan' ? grid : 0 });
        if (my !== seq || !slots) return;
        const choices = [{ value: 'none', label: t('map.basemap.none') }].concat(s.projection === 'web' ? [{ value: 'osm', label: t('map.basemap.osm') }] : [], orthos, [{ value: 'wms', label: t('map.basemap.wms') }], s.projection === 'web' ? [{ value: 'tiles', label: t('map.basemap.tiles') }] : []);
        // A remembered background map that the map no longer offers, or whose service is not entered, is not drawn.
        if (restored) {
          restored = false;
          s.basemap = memory.within(s.basemap, choices.filter((c) => (c.value !== 'wms' || (s.wms && s.wms.url && s.wms.layers)) && (c.value !== 'tiles' || (s.tiles && s.tiles.template))));
        }
        if (s.basemap.startsWith('ortho-') && !orthos.some((o) => o.value === s.basemap)) { ui.toast.show(t('map.projection.ortho', { name: t('map.basemap.' + s.basemap), crs: geo.crsLabel(grid) }), { kind: 'info', timeout: 9000 }); s.basemap = 'none'; }
        const projectionSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.projection'), inline: true, 'data-plan-projection': '' }));
        projectionSel.options = [{ value: 'web', label: t('map.projection.web') }, { value: 'plan', label: geo.crsLabel(grid) }];
        projectionSel.value = s.projection;
        projectionSel.addEventListener('change', () => {
          s.projection = projectionSel.value;
          if (s.projection === 'plan' && (s.basemap === 'osm' || s.basemap === 'tiles')) { ui.toast.show(t(s.basemap === 'osm' ? 'map.projection.osm' : 'map.projection.tiles', { crs: geo.crsLabel(grid) }), { kind: 'info', timeout: 9000 }); s.basemap = 'none'; }
          keep();
          render(dataset, target);
        });
        // OpenStreetMap and OGC API – Tiles exist in Web Mercator only; an orthophoto in the grids its service offers; a WMS can be asked
        // for in either system.
        const basemapSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true, 'data-plan-basemap': '' }));
        basemapSel.options = choices;
        basemapSel.value = s.basemap;
        basemapSel.addEventListener('change', async () => {
          if (!(await basemapChoice.ensure(basemapSel.value))) { basemapSel.value = s.basemap; return; }
          if (basemapSel.value === 'wms' && !(s.wms && s.wms.url && s.wms.layers)) {
            const w = await wmsDialog();
            if (!w) { basemapSel.value = s.basemap; return; }
            s.wms = w;
          }
          if (basemapSel.value === 'tiles' && !(s.tiles && s.tiles.template)) {
            const picked = await tilesDialog.open(s.tiles);
            if (!picked) { basemapSel.value = s.basemap; return; }
            s.tiles = picked;
          }
          s.basemap = basemapSel.value;
          keep();
          orthoLoad = basemapChoice.isView(s.basemap);
          render(dataset, target);
        });
        // Sweden's orthophoto covers the view it was read for; after a move the person reads it for the new view.
        const orthoBtn = basemapChoice.isView(s.basemap) ? ui.button({ label: t('ortho.se.load'), icon: 'image', 'icon-only': true, title: t('ortho.se.load.hint'), 'data-map-ortho-load': '', onClick: () => { if (handle) loadOrtho(handle, true); } }) : null;
        const wmsEdit = s.basemap === 'wms' ? ui.button({ label: t('map.wms.edit'), icon: 'pencil', 'icon-only': true, title: t('map.wms.edit.hint'), 'data-plan-wms-edit': '', onClick: async () => { const w = await wmsDialog(); if (w) { s.wms = w; keep(); draw(); } } }) : null;
        const tilesEdit = s.basemap === 'tiles' ? ui.button({ label: t('map.tiles.edit'), icon: 'pencil', 'icon-only': true, title: t('map.tiles.edit.hint'), 'data-plan-tiles-edit': '', onClick: async () => { const picked = await tilesDialog.open(s.tiles); if (picked) { s.tiles = picked; keep(); draw(); } } }) : null;
        const labels = /** @type {any} */ (h('dm-switch', { label: t('plan.labels') }));
        labels.checked = s.labels;
        labels.addEventListener('change', () => { s.labels = labels.checked; updateLabels(); });
        mapEl = h('div', { class: 'dm-map-view dm-plan-view dm-center-fill', 'aria-label': t('plan.view') });
        // The map alone, or with the tabs Ställningstaganden and Filer of a delivered plan (ui/bearbeta/plan-sections).
        const body = await sections.mount(dataset, mapEl);
        if (my !== seq || !slots) return;
        const info = s.info || {};
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('layers', 20), dataset.name, ' ', h('dm-badge', { text: t('plan.slag.' + s.slag) }), info.land && info.land !== 'SE' ? h('dm-badge', { text: t('plan.land.' + info.land) }) : null, info.status ? h('dm-badge', { kind: /laga kraft|antagen|vedtaget|í gildi|voimassa|^13$/i.test(info.status) ? 'ok' : 'accent', text: info.status }) : null),
            // The background maps from services belong to the tier BIM och GIS (platform/tier); the plan itself stays in Dokument.
            h('div', { class: 'dm-toolbar' }, projectionSel, ...(tier.shows('map.basemap') ? [basemapSel, wmsEdit, tilesEdit, orthoBtn] : []), labels,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('map.fit.hint'), onClick: fit }),
              tier.shows('chart:map') ? ui.button({ label: t('map.save.chart'), icon: 'save', title: t('plan.save.chart.hint'), onClick: saveChart }) : null,
              s.slag === 'detaljplan' ? ui.button({ label: t('plan.provisions.export'), icon: 'file-text', title: t('plan.provisions.export.hint'), onClick: exportProvisions }) : null,
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          body);
        await draw();
        renderInspector();
      }

      async function draw() {
        if (!mapEl || !ds) return;
        const my = ++seq;
        if (handle) { handle.finalize(); handle = null; }
        groups = []; labelLayer = null; marks = null;
        mapEl.replaceChildren();
        try {
          L = await leaflet.ensure();
          // The shared map setup (consent-gated background map, the grid) with no dataset layers; the plan objects are drawn here.
          const def = { layers: [], basemap: s.basemap, wms: s.wms || undefined, tiles: s.tiles || undefined, custom: { url: '', attribution: '' }, legend: false };
          if (s.projection === 'plan') def.crs = planGrid();
          const hd = await leaflet.render(mapEl, { kind: 'map', name: ds.name, map: def }, { tileFactory: options.tileFactory });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          L = /** @type {any} */ (globalThis).L;
          if (hd.info.basemapDenied) ui.toast.show(t('map.basemap.denied'), { kind: 'warn' });
          basemapChoice.notifyKey(hd.info, () => { orthoLoad = true; draw(); });
          if (hd.info.basemapProjection) ui.toast.show(t('map.projection.osm', { crs: geo.crsLabel(planGrid()) }), { kind: 'info', timeout: 9000 });
          // One layer per source layer, theme or object type, each with its symbol (ui/viz/layer-list); the hidden ones are not added.
          symbols = layerList.symbols(s.layers);
          groups = layerList.draw(L, hd.map, s.layers, symbols, s.hidden, { rowAt: (i) => s.rows[i], geometryOf: (r) => geo.parseGeometry(r.geometri), onClick: (row, lyr) => { s.selected = row; renderInspector(); highlight(lyr); } });
          layerCtl = layerList.create({ layers: s.layers, symbols, hidden: s.hidden, onChange: onLayers });
          updateLabels();
          fit();
          // A section's areas stay marked when the map is drawn again (another background map or grid).
          if (s.marked.length) markObjects(s.marked, { fit: true });
          mapEl.setAttribute('data-plan-layers-drawn', String(groups.length));
          openPending();
          renderInspector();
          // Sweden's orthophoto for the plan's extent, under the plan objects, once the map has fitted them.
          if (hd.info.basemapView) { const load = orthoLoad; orthoLoad = false; await loadOrtho(hd, load); }
        } catch (err) {
          if (my !== seq) return;
          replace(mapEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log(String((err && err.message) || err), 'error');
        }
      }
      let highlighted = null;
      function highlight(lyr) {
        if (highlighted && highlighted.setStyle && highlighted._dmStyle) highlighted.setStyle(highlighted._dmStyle);
        if (lyr && lyr.setStyle) { lyr._dmStyle = Object.assign({}, lyr.options); lyr.setStyle({ weight: 4, color: '#e63946' }); highlighted = lyr; if (lyr.bringToFront) lyr.bringToFront(); }
      }
      /** A search hit: the plan object chosen and in view. */
      function openPending() {
        const pending = ctx.store.get().openPlanObject;
        if (!pending || !s.id || pending.datasetId !== s.id) return;
        ctx.store.set({ openPlanObject: null });
        const row = s.rows.find((r) => String(r.objektid) === String(pending.objektid));
        if (!row) return;
        s.selected = row;
        for (const g of groups) {
          g.group.eachLayer((lyr) => {
            if (!lyr.feature || lyr.feature.properties._i !== row._i) return;
            highlight(lyr);
            if (handle && lyr.getBounds) handle.map.fitBounds(lyr.getBounds(), { maxZoom: 16 });
            else if (handle && lyr.getLatLng) handle.map.setView(lyr.getLatLng(), 16);
          });
        }
        renderInspector();
      }
      /** Designation labels at the centre of every visible object (the plan boundary excluded). */
      function updateLabels() {
        if (!handle || !L) return;
        if (labelLayer) { handle.map.removeLayer(labelLayer); labelLayer = null; }
        if (!s.labels) return;
        const markers = [];
        for (const g of groups) {
          if (s.hidden.has(g.key)) continue;
          g.group.eachLayer((lyr) => {
            const row = s.rows[lyr.feature.properties._i];
            if (row.objekttyp === 'planomrade' || row.tema === 'plangeometri') return;
            const text = labelText(row);
            if (!text) return;
            const center = lyr.getBounds ? lyr.getBounds().getCenter() : (lyr.getLatLng ? lyr.getLatLng() : null);
            if (!center) return;
            const el = document.createElement('span'); el.className = 'dm-plan-label' + (row.objekttyp === 'anvandning' || row.tema === 'markochvattenanvandning' ? ' dm-plan-label-use' : ''); el.textContent = String(text);
            markers.push(L.marker(center, { icon: L.divIcon({ className: 'dm-plan-label-wrap', html: el, iconSize: null }), interactive: false, keyboard: false }));
          });
        }
        labelLayer = L.layerGroup(markers).addTo(handle.map);
      }
      function fit() {
        if (!handle || !L) return;
        let bounds = null;
        for (const g of groups) { const b = g.group.getBounds(); if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); }
        if (bounds) handle.map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18, animate: false });
      }
      /** The layer list changed what shows: the map and the labels follow, and the plan remembers it. */
      function onLayers(hidden) {
        if (handle) layerList.apply(handle.map, groups, hidden);
        updateLabels();
        layerList.remember(s.id, hidden);
      }
      /**
       * Mark a section's areas on the map (above the layers, shown or not) and fit the view to them; none clears the marking.
       * @param {string[]} ids objects' identities @param {{fit?: boolean}} [opts]
       */
      function markObjects(ids, opts = { fit: true }) {
        if (marks && handle) handle.map.removeLayer(marks);
        marks = null;
        s.marked = (ids || []).slice();
        const wanted = new Set(s.marked.map((x) => String(x).trim().toLowerCase().replace(/[{}]/g, '')));
        const shapes = wanted.size ? s.rows.filter((r) => r.geometri && wanted.has(String(r.objektid || '').trim().toLowerCase().replace(/[{}]/g, ''))).map((r) => geo.parseGeometry(r.geometri)) : [];
        if (handle && L) marks = layerList.mark(L, handle.map, shapes);
        if (mapEl) mapEl.setAttribute('data-plan-marked', String(marks ? marks.getLayers().length : 0));
        if (marks && opts.fit) fitMarks();
        renderInspector();
      }
      function fitMarks() { if (handle && marks) { const b = marks.getBounds(); if (b.isValid()) handle.map.fitBounds(b, { padding: [24, 24], maxZoom: 17, animate: false }); } }

      /** Save the plan as a map chart for Visualisera: uses coloured by Boverket's colour names, the rest as outlines. */
      async function saveChart() {
        const name = await ui.dialog.prompt(t('viz.name'), { title: t('map.save.chart'), value: t('map.chart.default', { name: ds.name }) });
        if (!name) return;
        try {
          const cols = await datasets.columns(ds.id);
          const record = charts.create('map', ds, name.trim());
          const def = D.require('viz/plan-map').defOf(Object.assign({}, ds, { plan: Object.assign({}, ds.plan, { slag: s.slag }) }), cols);
          def.basemap = s.basemap;
          if (s.basemap === 'wms' && s.wms) def.wms = Object.assign({}, s.wms);
          if (s.basemap === 'tiles' && s.tiles) def.tiles = Object.assign({}, s.tiles);
          record.map = def;
          // The chart is a web map; a view in the plan's grid has other zoom levels, so the chart fits the plan instead.
          if (handle && s.projection !== 'plan') record.map.view = handle.view();
          record.thumbnail = await leaflet.thumbnail(record).catch(() => null);
          const saved = await charts.save(record);
          shell.log(t('viz.saved.toast', { name: saved.name }), 'ok');
          ui.toast.show(t('viz.saved.toast', { name: saved.name }), { kind: 'ok', action: { label: t('map.open.visualisera'), onClick: () => { store.set({ openChartId: saved.id }); shell.activate('visualisera'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      /**
       * A WMS background: the service's address, the layer (typed, or picked from the service's capabilities after consent), and
       * the attribution. In the plan's grid a layer the service does not offer in that system is pointed out. Null when cancelled.
       */
      async function wmsDialog() {
        const w = Object.assign({ url: '', layers: '', format: 'image/png', transparent: false, attribution: '', version: '1.3.0' }, s.wms || {});
        const field = (label, value, attrs) => { const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs || {}))); el.value = value || ''; return el; };
        const url = field(t('map.wms.url'), w.url, { placeholder: 'https://…/wms', help: t('map.wms.url.help'), 'data-plan-wms-url': '' });
        const layers = field(t('map.wms.layers'), w.layers, { help: t('map.wms.layers.help'), 'data-plan-wms-layers': '' });
        const attribution = field(t('map.custom.attribution'), w.attribution);
        const transparent = /** @type {any} */ (h('dm-switch', { label: t('map.wms.transparent') }));
        transparent.checked = !!w.transparent;
        const picked = h('div');
        const note = h('p', { class: 'dm-help dm-small', 'data-plan-wms-note': '' });
        const read = /** @type {any} */ (ui.button({ label: t('map.wms.read'), icon: 'refresh-cw', size: 'sm', title: t('map.wms.read.hint'), onClick: async () => {
          if (!url.value.trim()) return;
          read.setAttribute('loading', '');
          try {
            const list = await leaflet.wmsLayers(url.value.trim());
            const sel = /** @type {any} */ (h('dm-select', { label: t('map.wms.pick') }));
            sel.options = list.map((l) => ({ value: l.id, label: l.name !== l.id ? `${l.name} (${l.id})` : l.id }));
            sel.value = list.some((l) => l.id === layers.value) ? layers.value : list[0].id;
            const check = () => {
              layers.value = sel.value;
              const l = list.find((x) => x.id === sel.value);
              const code = 'EPSG:' + planGrid();
              note.textContent = l && s.projection === 'plan' && l.crs && l.crs.length && !l.crs.includes(code) ? t('map.wms.crs.missing', { crs: geo.crsText(planGrid()) }) : '';
            };
            sel.addEventListener('change', check);
            replace(picked, sel);
            check();
          } catch (err) {
            replace(picked, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          }
          read.removeAttribute('loading');
        } }));
        const ok = await ui.dialog.open({
          title: t('map.basemap.wms'),
          body: h('div', { class: 'dm-stack', 'data-plan-wms-dialog': '' }, h('p', { class: 'dm-help', text: t('map.wms.dialog.hint', { crs: s.projection === 'plan' ? geo.crsText(planGrid()) : 'Web Mercator (EPSG:3857)' }) }), url, h('div', { class: 'dm-row-end' }, layers, read), picked, note, transparent, attribution),
          actions: [{ label: t('common.cancel'), value: false }, { label: t('common.ok'), variant: 'primary', value: true, primary: true }],
        });
        if (!ok) return null;
        const out = { url: String(url.value || '').trim(), layers: String(layers.value || '').trim(), format: w.format || 'image/png', transparent: !!transparent.checked, attribution: String(attribution.value || '').trim(), version: w.version || '1.3.0' };
        if (!leaflet.wmsSource(out)) { ui.toast.show(t('map.wms.incomplete'), { kind: 'warn' }); return null; }
        return out;
      }
      /** The provisions as a Markdown file (the list on a plan map). */
      function exportProvisions() {
        const labels = { plan: t('plan.slag.detaljplan'), beteckning: t('plan.field.beteckning'), kommun: t('plan.field.kommun'), status: t('plan.field.status'), lagakraft: t('plan.field.lagakraft') };
        for (const typ of plan.OBJECT_TYPES) labels[typ] = t('plan.type.' + typ);
        const md = plan.provisionsMarkdown(s.info || {}, s.rows, labels);
        files.download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), files.safeName(ds.name, 'md'));
      }

      // ---- inspector ----
      function renderInspector() {
        if (!slots) return;
        const items = [];
        const info = s.info || {};
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          info.beteckning ? { label: t('plan.field.beteckning'), value: info.beteckning } : null,
          info.kommun || info.kommunkod ? { label: t('plan.field.kommun'), value: [info.kommun, info.kommunkod].filter(Boolean).join(' ') } : null,
          info.typ ? { label: t('plan.field.typ'), value: info.typ } : null,
          info.status ? { label: t('plan.field.status'), value: info.status } : null,
          info.datumLagakraft ? { label: t('plan.field.lagakraft'), value: info.datumLagakraft } : null,
          info.datumAntagande ? { label: t('plan.field.antagande'), value: info.datumAntagande } : null,
          info.datumOverklagat ? { label: t('plan.field.overklagat'), value: info.datumOverklagat } : null,
          info.datumPaborjat ? { label: t('plan.field.paborjat'), value: info.datumPaborjat } : null,
          info.genomforandetid ? { label: t('plan.field.genomforandetid'), value: info.genomforandetid } : null,
          info.diarienummer ? { label: t('plan.field.diarienummer'), value: info.diarienummer } : null,
          info.beslutstyp ? { label: t('plan.field.beslutstyp'), value: info.beslutstyp } : null,
          info.planbeskrivning ? { label: t('plan.field.planbeskrivning'), value: info.planbeskrivning } : null,
          Array.isArray(info.handlingar) && info.handlingar.length ? { label: t('plan.field.handlingar'), value: info.handlingar.map((d) => d.namn).join('; ') } : null,
          typeof info.digitaltUrsprung === 'boolean' ? { label: t('plan.field.digitalt'), value: t(info.digitaltUrsprung ? 'common.yes' : 'common.no') } : null,
          info.anvandbarhet ? { label: t('plan.field.anvandbarhet'), value: info.anvandbarhet } : null,
          info.anteckning ? { label: t('plan.field.note'), value: info.anteckning } : null,
          { label: t('plan.field.objects'), value: i18n.formatNumber(s.rows.length) },
          info.format ? { label: t('plan.field.format'), value: t('plan.format.' + (info.format || 'detaljplan')) } : null,
          info.crs ? { label: t('plan.field.crs'), value: geo.crsText(info.crs) } : null,
          s.rows.some((r) => known(r.underkant) || known(r.overkant)) ? { label: t('plan.field.hojdsystem'), value: geo.heightLabel(info.hojdsystem) || t('plan.hojdsystem.none') } : null,
        ].filter(Boolean);
        items.push(h('h4', { text: t('plan.about') }), kv);
        // A system the app cannot convert: the objects are read, but not drawn in the wrong place.
        if (geo.crsUnknown(info.crs)) items.push(h('p', { class: 'dm-error dm-small', 'data-plan-crs-unknown': '', text: t('plan.crs.unknown', { crs: String(info.crs) }) }));
        items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('plan.status.edit'), icon: 'pencil', size: 'sm', title: t('plan.status.edit.hint'), onClick: () => editStatus().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) })));
        const archive = archiveBlock(info);
        if (archive) items.push(archive);
        // The section whose areas are marked on the map (ui/bearbeta/plan-sections).
        const chosen = s.marked.length ? sections.chosenBlock() : null;
        if (chosen) items.push(chosen);
        // Layers: shown and hidden per file and layer, with counts and symbols (ui/viz/layer-list).
        items.push(h('h4', { text: t('map.layers') }), h('div', { class: 'dm-stack-sm dm-plan-layers' }, layerCtl ? layerCtl.list() : null));
        if (s.selected) {
          items.push(h('h4', { text: t('plan.selected') }), selectedDetails(s.selected));
          const block = D.require('ui/kinds/comment-block');
          const objekt = s.selected.objektid;
          // The ställningstaganden and other sections that concern the area, each with the way to its text.
          const about = objekt ? sections.forObject(objekt) : null;
          if (about) items.push(about);
          if (objekt) items.push(block.create(ctx, ds, block.targetOf(ds, `plan:${objekt}`, s.selected.namn || String(objekt), () => objekt)));
        } else if (s.slag === 'detaljplan') {
          const legend = plan.legend(s.rows);
          if (legend.length) items.push(h('h4', { text: t('map.legend') }), h('ul', { class: 'dm-map-legend-list dm-plan-legend' }, legend.map((e) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: e.color || 'transparent' } }), h('span', { class: 'dm-plan-legend-text' }, h('strong', { text: e.beteckning + ' ' }), h('span', { class: 'dm-truncate', text: e.formulering || '' }))))));
          for (const g of plan.grouped(s.rows)) {
            if (g.typ === 'anvandning') continue;
            items.push(h('details', { class: 'dm-more', open: g.rows.length <= 12 ? true : null }, h('summary', { text: `${t('plan.type.' + g.typ)} (${i18n.formatNumber(g.rows.length)})` }),
              h('ul', { class: 'dm-plan-provisions' }, g.rows.slice(0, 200).map((r) => h('li', { onclick: () => { s.selected = r; renderInspector(); } }, h('strong', { text: (r.beteckning || '–') + ' ' }), h('span', { text: r.formulering || '' }))))));
          }
        } else {
          // The legend of the layers that show, land use with Boverket's colours and its area per use.
          if (layerCtl) items.push(h('h4', { text: t('map.legend') }), layerCtl.legend());
          items.push(h('p', { class: 'dm-help', text: t('plan.help.op') }));
        }
        if (!s.selected) { const unplaced = withoutPlace(); if (unplaced) items.push(unplaced); }
        replace(slots.right, items);
      }
      /** What is known about the plan's standing, kept with the dataset: its status, when it gained legal force, and a note. */
      async function editStatus() {
        const info = s.info || {};
        const field = (label, value) => { const el = /** @type {any} */ (h('dm-input', { label })); el.value = value || ''; return el; };
        const status = field(t('plan.field.status'), info.status);
        const date = field(t('plan.field.lagakraft'), info.datumLagakraft);
        const note = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('plan.field.note') }));
        note.value = info.anteckning || '';
        const ok = await ui.dialog.open({ title: t('plan.status.edit'), body: h('div', { class: 'dm-stack' }, status, date, note), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (!ok) return;
        const next = Object.assign({}, info, { status: status.value.trim(), datumLagakraft: date.value.trim(), anteckning: note.value.trim() });
        const handle = await datasets.ensureOpen(ds.id);
        handle.meta.plan = next;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(next)]);
        await datasets.save(ds.id);
        datasets.notify('changed', { id: ds.id });
        s.info = next;
        renderInspector();
      }
      /**
       * The archive package the plan came from: how its files stood against PREMIS when it was read, and the package's
       * documents (plan map, plan description …) to open from the dataset.
       */
      function archiveBlock(info) {
        const a = info && info.arkivpaket;
        if (!a) return null;
        const bad = (a.andrade || []).length + (a.saknas || []).length;
        const line = (key, list) => (list && list.length ? h('p', { class: 'dm-small', text: t(key, { files: list.join(', ') }) }) : null);
        const docs = h('ul', { class: 'dm-plan-provisions', 'data-plan-archive-docs': '' });
        const dsFiles = D.require('data/dataset-files');
        dsFiles.list(ds.id, 'original').then((list) => {
          for (const f of list) {
            if (!/^content\//i.test(f.name) || f.name === a.planfil || /\.(gpkg|json|geojson)$/i.test(f.name)) continue;
            const shown = f.name.replace(/^content\//i, '');
            // Only a PDF or a picture opens in a tab (with a type chosen here, never the stored one); every other file is downloaded.
            const opens = !!dsFiles.tabType(f.name);
            docs.appendChild(h('li', null, h('span', { class: 'dm-truncate', text: shown + ' ' }),
              ui.button({ label: t(opens ? 'plan.archive.open' : 'common.download'), icon: opens ? 'external-link' : 'download', size: 'sm', title: t(opens ? 'plan.archive.open.hint' : 'plan.archive.download.hint'), 'data-plan-archive-open': f.name, onClick: async () => {
                const file = await dsFiles.read(ds.id, f.name);
                if (!file) return;
                const type = dsFiles.tabType(f.name, file.bytes);
                if (!type) { files.download(new Blob([file.bytes], { type: 'application/octet-stream' }), shown.split('/').pop() || shown); return; }
                const u = URL.createObjectURL(new Blob([file.bytes], { type }));
                window.open(u, '_blank', 'noopener');
                setTimeout(() => URL.revokeObjectURL(u), 60000);
              } })));
          }
        }).catch(() => {});
        return h('details', { class: 'dm-more', open: true, 'data-plan-archive': bad ? 'changed' : 'ok' },
          h('summary', { text: t('plan.archive.title') }),
          h('p', { class: bad ? 'dm-error dm-small' : 'dm-help dm-small', text: bad ? t('plan.archive.bad', { n: bad }) : t('plan.archive.ok', { n: a.stammer || 0 }) }),
          line('plan.archive.changed', a.andrade), line('plan.archive.missing', a.saknas), line('plan.archive.unchecked', a.okontrollerade), line('plan.archive.extra', a.ovriga),
          h('p', { class: 'dm-help dm-small', text: t('plan.archive.checked', { date: String(a.kontrollerat || '').slice(0, 10), name: a.namn || '' }) }), docs);
      }
      const known = (v) => v !== null && v !== undefined && v !== '';
      const metres = (v) => `${i18n.formatNumber(Number(v))} m`;
      /** A provision's height limits in metres, in the height system the file names (RH 2000 for plans to NGP), when it is limited in height. */
      function heightItem(row) {
        const lo = known(row.underkant);
        const hi = known(row.overkant);
        if (!lo && !hi) return null;
        const value = lo && hi ? t('plan.height.range', { lower: metres(row.underkant), upper: metres(row.overkant) }) : lo ? t('plan.height.lower', { h: metres(row.underkant) }) : t('plan.height.upper', { h: metres(row.overkant) });
        const system = geo.heightLabel((s.info || {}).hojdsystem);
        return { label: system ? t('plan.field.hojd.in', { system }) : t('plan.field.hojd'), value };
      }
      /** Facts the dataset keeps without a column of their own (`egenskaper`), with other objects named by their text. */
      const HIDDEN_EXTRAS = new Set(['objektversion', 'versionGiltigFran']);
      function extraItems(row) {
        let extras = null;
        try { extras = row.egenskaper ? JSON.parse(row.egenskaper) : null; } catch (_e) { extras = null; }
        if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return [];
        const byId = new Map(s.rows.map((r) => [String(r.objektid || '').toLowerCase(), r]));
        const nameOf = (id) => {
          const r = byId.get(String(id).toLowerCase());
          if (!r) return String(id);
          return (s.slag === 'oversiktsplan' ? [r.innehallstyp, r.namn] : [r.beteckning, r.formulering]).filter(Boolean).join(' ') || String(id);
        };
        const show = (key, v) => {
          if (typeof v === 'boolean') return t(v ? 'common.yes' : 'common.no');
          if (typeof v === 'number') return i18n.formatNumber(v);
          if (Array.isArray(v)) return (/^(berorAnnatInnehall|reglerarAnvandningsbestammelse)$/.test(key) ? v.map(nameOf) : v.map((x) => show('', x))).join('; ');
          if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${show(k, x)}`).join(', ');
          return String(v);
        };
        return Object.entries(extras).filter(([key]) => !HIDDEN_EXTRAS.has(key) && !(key === 'utanBestammelse' && extras.utanBestammelse !== true))
          .map(([key, v]) => (key === 'utanBestammelse' ? { label: t('plan.prop.utanBestammelse'), value: t('plan.prop.utanBestammelse.value') } : { label: i18n.has('plan.prop.' + key) ? t('plan.prop.' + key) : key, value: show(key, v) }));
      }
      /** The objects without a place on the map (content described only in text), to be read in the inspector. */
      function withoutPlace() {
        const rows = s.rows.filter((r) => !r.geometri && r.objekttyp !== 'planomrade');
        if (!rows.length) return null;
        const text = (r) => (s.slag === 'oversiktsplan' ? [r.innehallstyp, r.namn].filter(Boolean).join(' – ') : [r.beteckning, r.formulering].filter(Boolean).join(' ')) || r.objektid || '–';
        return h('details', { class: 'dm-more', 'data-plan-unplaced': '' }, h('summary', { text: t('plan.unplaced', { n: rows.length }) }),
          h('ul', { class: 'dm-plan-provisions' }, rows.slice(0, 200).map((r) => h('li', { onclick: () => { s.selected = r; renderInspector(); } }, h('span', { text: text(r) })))));
      }
      /** The clicked object: its facts, and the catalogue's facts about the provision it refers to. */
      function selectedDetails(row) {
        const kv = /** @type {any} */ (h('dm-kv'));
        const isOp = s.slag === 'oversiktsplan';
        kv.items = (isOp ? [
          { label: t('plan.field.tema'), value: planLayers.themeLabel(row.tema) }, { label: t('plan.field.innehallstyp'), value: row.innehallstyp }, row.namn ? { label: t('common.name'), value: row.namn } : null,
          row.precisering ? { label: t('plan.field.precisering'), value: row.precisering } : null, row.kompletterande ? { label: t('plan.field.kompletterande'), value: row.kompletterande } : null,
          row.anvandningsstatus ? { label: t('plan.field.anvandningsstatus'), value: row.anvandningsstatus } : null, row.planhandelse ? { label: t('plan.field.planhandelse'), value: `${row.planhandelse} ${row.planhandelse_datum || ''}`.trim() } : null,
          row.utbyggnadsordning ? { label: t('plan.prop.utbyggnadsordning'), value: row.utbyggnadsordning } : null,
          ...extraItems(row),
        ] : [
          { label: t('plan.field.objekttyp'), value: t('plan.type.' + (row.objekttyp || 'annan')) }, row.beteckning ? { label: t('plan.field.beteckning'), value: row.beteckning } : null,
          row.formulering ? { label: t('plan.field.formulering'), value: row.formulering } : null, row.kategori ? { label: t('plan.field.kategori'), value: row.underkategori ? `${row.kategori} / ${row.underkategori}` : row.kategori } : null,
          row.anvandningsform ? { label: t('plan.field.anvandningsform'), value: row.anvandningsform } : null, row.varde ? { label: t('plan.field.varde'), value: `${row.vardetyp ? row.vardetyp + ' ' : ''}${row.varde}${row.enhet ? ' ' + row.enhet : ''}` } : null,
          row.farg ? { label: t('plan.field.farg'), value: row.farg } : null, row.kod ? { label: t('plan.field.kod'), value: row.kod } : null, heightItem(row), row.etikett && row.objekttyp !== 'planomrade' ? { label: t('plan.field.motiv'), value: row.etikett } : null,
          ...extraItems(row),
        ]).filter(Boolean);
        const box = h('div', { class: 'dm-stack-sm' }, kv);
        if (!isOp && row.katalogreferens) {
          const note = h('p', { class: 'dm-help dm-small', text: t('common.loading') });
          box.appendChild(note);
          catalog.get(row.katalogreferens).then((entry) => {
            if (!entry) { note.textContent = t('plan.catalog.unknown', { id: row.katalogreferens }); return; }
            const period = entry.start ? `${entry.start} – ${catalog.isCurrent(entry) ? t('plan.catalog.current') : entry.slut}` : '';
            replace(note, h('span', { text: t('plan.catalog.entry', { kod: entry.kod || entry.beteckning, typ: t(catalog.typeKey(entry.typ)), period }) }), entry.formulering && entry.formulering !== row.formulering ? h('span', { class: 'dm-block', text: t('plan.catalog.template', { text: entry.formulering }) }) : null);
          }).catch(() => { note.textContent = ''; });
        }
        box.appendChild(h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('plan.copy.text'), icon: 'copy', size: 'sm', onClick: async () => { try { await navigator.clipboard.writeText(isOp ? [row.innehallstyp, row.namn, row.precisering].filter(Boolean).join(' – ') : `${row.beteckning ? row.beteckning + ' ' : ''}${row.formulering || ''}`); ui.toast.show(t('plan.copied'), { kind: 'ok' }); } catch (_e) { /* clipboard unavailable */ } } }),
          ui.button({ label: t('map.edit.table'), icon: 'table', size: 'sm', title: t('map.edit.table.hint'), onClick: options.onTable }),
          ui.button({ label: t('common.close'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { s.selected = null; highlight(null); renderInspector(); } })));
        return box;
      }

      function destroy() { seq++; sections.destroy(); if (handle) { handle.finalize(); handle = null; } groups = []; labelLayer = null; marks = null; layerCtl = null; mapEl = null; slots = null; }
      return { render, destroy, state: s, sections, get handle() { return handle; }, get layers() { return layerCtl; }, get marks() { return marks; } };
    }
    return { create };
  });
})();
