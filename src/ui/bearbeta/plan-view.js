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
 * files are beside the map, the plan description with the tab Filer (ui/bearbeta/plan-sections). Choosing a section marks its
 * areas; clicking an area chooses it, Shift-click adds or removes one, and Markera område or Shift and drag chooses every shown
 * area a rectangle meets, with the union of their sections in the inspector.
 *
 * The view is built by three functions that other modules can hook into: `toolbar` (the page head's tools), the text pane
 * (plan-sections' `textPane`) and `renderInspector`. A comprehensive plan is edited through them (ui/bearbeta/plan-edit): its
 * areas, its plan description's sections and the links between them, and exported as a delivery.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-view', ['ui/base', 'data/datasets', 'data/plan', 'data/plan-catalog', 'data/geo', 'data/plan-links', 'viz/leaflet', 'viz/charts', 'viz/data', 'viz/theme', 'platform/files', 'ui/viz/basemap-choice', 'ui/viz/basemap-memory', 'ui/viz/tiles-dialog', 'platform/tier', 'ui/viz/layer-list', 'ui/bearbeta/plan-layers', 'ui/bearbeta/plan-sections', 'ui/bearbeta/plan-edit'], (base, datasets, plan, catalog, geo, planLinks, leaflet, charts, vizData, theme, files, basemapChoice, memory, tilesDialog, tier, layerList, planLayers, planSections, planEdit) => {
    const { h, t, i18n, replace } = base;
    const MAX_ROWS = 20000;
    /** A drag shorter than this (in pixels) is a click, not a rectangle. */
    const MIN_BOX = 4;
    /** The plan boundary, which a rectangle always meets, is never chosen by one. */
    const isBoundary = (r) => r.objekttyp === 'planomrade' || r.tema === 'plangeometri';

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void, tileFactory?: Function, overlays?: any}} options tileFactory for tests (no tiles are fetched);
     *   overlays the other datasets drawn over the plan (ui/viz/map-overlays: attach, extend, block, detach)
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      // `selected` is the area chosen last, `picked` every area chosen (Shift-click, a rectangle), `boxMode` true after Markera område.
      const s = { id: null, basemap: 'none', wms: null, tiles: null, projection: 'web', labels: true, hidden: new Set(), selected: null, picked: [], boxMode: false, rows: [], byId: new Map(), info: null, slag: 'detaljplan', updatedAt: null, layers: [], marked: [] };
      let ds = null; let slots = null; let mapEl = null; let handle = null; let seq = 0; let groups = []; let labelLayer = null; let L = null;
      /** The layer list and legend of the plan drawn (ui/viz/layer-list), the layers' symbols, and the areas marked for a section. */
      let layerCtl = null; let symbols = new Map(); let marks = null;
      /** The toolbar's button Markera område, a layer click to ignore after a rectangle, and the rectangle's handlers on the map. */
      let boxBtn = null; let noClickUntil = 0; let unhook = null;
      /** The plan's AI panel (ui/bearbeta/plan-ai, the group of scripts ai), in the inspector while it is open. */
      let ai = null;
      const nameOf = (id) => { const r = s.byId.get(planLinks.key(id)); return r ? (s.slag === 'oversiktsplan' ? r.namn || r.innehallstyp : r.beteckning || r.formulering) || '' : ''; };
      /** Editing a comprehensive plan (ui/bearbeta/plan-edit): its buttons and bar, the map's drawing and the inspector's fields. */
      const editor = planEdit.create(ctx, { state: () => s, dataset: () => ds, pick: (rows) => pick(rows), changed: () => { s.updatedAt = null; if (ds && slots) render(ds, slots); }, inspector: () => renderInspector() });
      /** The plan's text and files beside the map. */
      const sections = planSections.create(ctx, { mark: (ids) => markObjects(ids), nameOf, shown: () => { if (handle) { handle.map.invalidateSize(); if (marks) fitMarks(); } }, changed: () => { s.updatedAt = null; if (ds && slots) render(ds, slots); }, editor });
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
          s.id = dataset.id; s.selected = null; s.picked = []; s.boxMode = false; s.hidden = new Set(); s.basemap = 'none'; restored = false;
          if (ai) { ai.destroy(); ai = null; }
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
        s.byId = new Map(s.rows.filter((r) => planLinks.key(r.objektid)).map((r) => [planLinks.key(r.objektid), r]));
        // The areas chosen before are the same objects in the rows read again.
        s.picked = s.picked.map((r) => s.byId.get(planLinks.key(r.objektid))).filter(Boolean);
        s.selected = s.picked[s.picked.length - 1] || null;
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
        // Inhämta hands over a new plan with its description (B-78): the AI panel opens in the mode Bygg från beskrivning with it.
        const askedAi = ctx.store.get().openPlanAi;
        if (askedAi && askedAi.datasetId === dataset.id) { ctx.store.set({ openPlanAi: null }); if (aiShown()) openAi({ mode: askedAi.mode || 'build', brief: askedAi.brief || '' }); }
        const bar = await toolbar(dataset, target);
        if (my !== seq || !slots) return;
        mapEl = h('div', { class: 'dm-map-view dm-plan-view dm-center-fill', 'aria-label': t('plan.view') });
        // The map alone, or beside the plan description and Filer of a delivered plan (ui/bearbeta/plan-sections).
        const body = await sections.mount(dataset, mapEl);
        if (my !== seq || !slots) return;
        const info = s.info || {};
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('layers', 20), dataset.name, ' ', h('dm-badge', { text: t('plan.slag.' + s.slag) }), info.land && info.land !== 'SE' ? h('dm-badge', { text: t('plan.land.' + info.land) }) : null, info.status ? h('dm-badge', { kind: /laga kraft|antagen|vedtaget|í gildi|voimassa|^13$/i.test(info.status) ? 'ok' : 'accent', text: info.status }) : null),
            bar),
          editor.bar(),
          body);
        syncBox();
        await draw();
        renderInspector();
      }
      /**
       * The page head's tools: the map's grid, the background map and its service, the labels, fitting, Markera område for a
       * comprehensive plan, saving as a chart, the provisions and the table. Built anew on each drawing (a hook for other views).
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target @returns {Promise<HTMLElement>}
       */
      async function toolbar(dataset, target) {
        // The map in Web Mercator (as web maps are) or in the plan's own grid (SWEREF 99 TM or its zone), with north up as on the plan map.
        const grid = planGrid();
        // The orthophotos whose service offers the map's grid (Web Mercator or the plan's own).
        const orthos = await basemapChoice.options({ grid: s.projection === 'plan' ? grid : 0 });
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
        // Markera område: the next drag on the map draws a rectangle that chooses every shown area it meets (Shift and drag does too).
        boxBtn = s.slag === 'oversiktsplan' ? ui.button({ label: t('plan.select.box'), icon: 'square', title: t('plan.select.box.hint'), 'data-plan-box': '', onClick: () => setBoxMode(!s.boxMode) }) : null;
        // The background maps from services belong to the tier BIM och GIS (platform/tier); the plan itself stays in Dokument.
        return h('div', { class: 'dm-toolbar' }, projectionSel, ...(tier.shows('map.basemap') ? [basemapSel, wmsEdit, tilesEdit, orthoBtn] : []), labels,
          ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('map.fit.hint'), onClick: fit }), boxBtn,
          tier.shows('chart:map') ? ui.button({ label: t('map.save.chart'), icon: 'save', title: t('plan.save.chart.hint'), onClick: saveChart }) : null,
          s.slag === 'detaljplan' ? ui.button({ label: t('plan.provisions.export'), icon: 'file-text', title: t('plan.provisions.export.hint'), onClick: exportProvisions }) : null,
          ...editor.buttons(),
          aiShown() ? ui.button({ label: t('plan.ai.button'), icon: 'cpu', title: t('plan.ai.button.hint'), pressed: ai ? 'true' : 'false', 'data-plan-ai-toggle': '', onClick: () => { if (ai) { ai.destroy(); ai = null; renderInspector(); syncAi(); } else openAi({}); } }) : null,
          ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }));
      }

      async function draw() {
        if (!mapEl || !ds) return;
        const my = ++seq;
        if (unhook) { unhook(); unhook = null; }
        if (handle) { handle.finalize(); handle = null; }
        groups = []; labelLayer = null; marks = null; highlighted = [];
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
          // A click chooses the area; with Shift (or Ctrl or Cmd) it adds or removes it among those chosen.
          groups = layerList.draw(L, hd.map, s.layers, symbols, s.hidden, { rowAt: (i) => s.rows[i], geometryOf: (r) => geo.parseGeometry(r.geometri), onClick: (row, _lyr, e) => {
            if (Date.now() < noClickUntil) return;
            const ev = e && e.originalEvent;
            pick([row], { toggle: !!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey)) });
          } });
          layerCtl = layerList.create({ layers: s.layers, symbols, hidden: s.hidden, onChange: onLayers });
          // Shift and drag chooses with a rectangle here, not Leaflet's zoom to a box.
          if (hd.map.boxZoom) hd.map.boxZoom.disable();
          unhook = boxHandlers(hd.map);
          editor.mapDrawn(hd.map, L, groups);
          updateLabels();
          if (options.overlays) { await options.overlays.attach(hd, ds, { hostLayers: s.layers, fit, refresh: renderInspector }); if (my !== seq) return; }
          fit();
          // A section's areas stay marked, and the chosen areas chosen, when the map is drawn again (another background map or grid).
          if (s.marked.length) markObjects(s.marked, { fit: true });
          highlightPicked();
          if (ai) ai.mapDrawn();
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
      /** The Leaflet layers drawn as chosen, with the style they had. */
      let highlighted = [];
      /** The Leaflet layers of rows. @param {Set<number>} wanted rows' `_i` */
      function layersOf(wanted) {
        const out = [];
        for (const g of groups) g.group.eachLayer((lyr) => { if (lyr.feature && wanted.has(lyr.feature.properties._i)) out.push(lyr); });
        return out;
      }
      /** The chosen areas drawn with a heavy edge in the error colour, above the others; the ones no longer chosen as they were. */
      function highlightPicked() {
        for (const lyr of highlighted) if (lyr.setStyle && lyr._dmStyle) lyr.setStyle(lyr._dmStyle);
        highlighted = [];
        if (!handle || !s.picked.length) { if (mapEl) mapEl.setAttribute('data-plan-picked', '0'); return; }
        const color = theme.tokens().error;
        for (const lyr of layersOf(new Set(s.picked.map((r) => r._i)))) {
          if (!lyr.setStyle) continue;
          lyr._dmStyle = Object.assign({}, lyr.options);
          lyr.setStyle({ weight: 4, color });
          if (lyr.bringToFront) lyr.bringToFront();
          highlighted.push(lyr);
        }
        if (mapEl) mapEl.setAttribute('data-plan-picked', String(s.picked.length));
      }
      /**
       * Choose areas: `toggle` adds or removes each (Shift-click), `add` adds them (Shift and a rectangle), else they are the only
       * ones chosen; none clears the choice. The inspector lists them and the sections that concern them.
       * @param {any[]} rows @param {{toggle?: boolean, add?: boolean}} [opts]
       */
      function pick(rows, opts = {}) {
        let next;
        if (opts.toggle) { next = s.picked.slice(); for (const r of rows) { const i = next.indexOf(r); if (i >= 0) next.splice(i, 1); else next.push(r); } }
        else if (opts.add) next = s.picked.concat(rows.filter((r) => !s.picked.includes(r)));
        else next = rows.slice();
        s.picked = next;
        s.selected = next[next.length - 1] || null;
        highlightPicked();
        renderInspector();
      }
      /**
       * Choose every shown area that a rectangle meets (data/plan-links boxHits), the plan boundary aside.
       * @param {any} bounds a Leaflet LatLngBounds @param {boolean} [add] add them to the areas chosen
       */
      function selectBox(bounds, add) {
        const box = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        // The drawn layers that show: their bounds first, then their features' geometry, already read.
        const found = new Set();
        for (const g of groups) {
          if (s.hidden.has(g.key)) continue;
          g.group.eachLayer((lyr) => {
            const f = lyr.feature; const row = f && s.rows[f.properties._i];
            if (!row || isBoundary(row)) return;
            const at = lyr.getBounds ? lyr.getBounds() : lyr.getLatLng ? L.latLngBounds(lyr.getLatLng(), lyr.getLatLng()) : null;
            if (at && at.isValid() && !bounds.intersects(at)) return;
            if (planLinks.boxHits(f.geometry, box)) found.add(row);
          });
        }
        const hits = s.rows.filter((r) => found.has(r));
        pick(hits, { add });
        return hits;
      }
      /** Markera område on or off: the next drag draws a rectangle; Esc turns it off. @param {boolean} on */
      function setBoxMode(on) {
        s.boxMode = !!on;
        syncBox();
        if (s.boxMode) ui.toast.show(t('plan.select.box.on'), { kind: 'info' });
      }
      /** The button and the map show whether Markera område is on. */
      function syncBox() {
        const inner = boxBtn && boxBtn.querySelector('button');
        if (inner) inner.setAttribute('aria-pressed', String(s.boxMode));
        if (mapEl) mapEl.toggleAttribute('data-plan-box-mode', s.boxMode);
      }
      /**
       * The rectangle on the map: a drag with Shift held, or any drag after Markera område, draws it in the accent colour and
       * chooses what it meets when let go (with Shift added to the areas chosen). Returns the function that removes the handlers.
       */
      function boxHandlers(map) {
        const el = map.getContainer();
        let start = null; let at = null; let rect = null; let shiftAtStart = false; let dragging = false;
        const point = (e) => map.mouseEventToContainerPoint(e);
        const down = (e) => {
          if (e.button !== 0 || !(e.shiftKey || s.boxMode)) return;
          // After Markera område the drag is the rectangle's alone; with Shift a click must still reach the area (Shift-click),
          // so the map only stops panning.
          if (s.boxMode) { e.preventDefault(); e.stopPropagation(); }
          start = point(e); at = start; shiftAtStart = e.shiftKey; dragging = false;
          if (map.dragging) map.dragging.disable();
        };
        const move = (e) => {
          if (!start) return;
          at = point(e);
          // A drag once the pointer has moved: only then is the pointer captured (before, a Shift-click keeps its area as target).
          if (!dragging) {
            if (Math.abs(at.x - start.x) < MIN_BOX && Math.abs(at.y - start.y) < MIN_BOX) return;
            dragging = true;
            try { el.setPointerCapture(e.pointerId); } catch (_err) { /* the drag still works over the map */ }
            if (L.DomUtil && L.DomUtil.disableTextSelection) L.DomUtil.disableTextSelection();
          }
          const b = L.latLngBounds(map.containerPointToLatLng(start), map.containerPointToLatLng(at));
          if (rect) rect.setBounds(b);
          else rect = L.rectangle(b, { interactive: false, color: theme.tokens().accent, weight: 1, dashArray: '4 4', fillOpacity: 0.08 }).addTo(map);
        };
        const up = (e) => {
          if (!start) return;
          at = point(e);
          const moved = Math.abs(at.x - start.x) >= MIN_BOX || Math.abs(at.y - start.y) >= MIN_BOX;
          const b = L.latLngBounds(map.containerPointToLatLng(start), map.containerPointToLatLng(at));
          start = null;
          if (rect) { map.removeLayer(rect); rect = null; }
          if (map.dragging) map.dragging.enable();
          if (dragging && L.DomUtil && L.DomUtil.enableTextSelection) L.DomUtil.enableTextSelection();
          dragging = false;
          if (!moved) return;
          // The click Leaflet sends after the drag is not a choice of its own.
          noClickUntil = Date.now() + 400;
          setBoxMode(false);
          selectBox(b, shiftAtStart || e.shiftKey);
        };
        const key = (e) => { if (e.key === 'Escape' && s.boxMode) setBoxMode(false); };
        // Let go anywhere (outside the map too, when the pointer could not be captured) ends the rectangle.
        el.addEventListener('pointerdown', down, true);
        el.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
        document.addEventListener('keydown', key);
        return () => { el.removeEventListener('pointerdown', down, true); el.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); document.removeEventListener('keydown', key); };
      }
      /** A search hit: the plan object chosen and in view. */
      function openPending() {
        const pending = ctx.store.get().openPlanObject;
        if (!pending || !s.id || pending.datasetId !== s.id) return;
        ctx.store.set({ openPlanObject: null });
        const row = s.byId.get(planLinks.key(pending.objektid)) || s.rows.find((r) => String(r.objektid) === String(pending.objektid));
        if (!row) return;
        pick([row]);
        for (const lyr of layersOf(new Set([row._i]))) {
          if (handle && lyr.getBounds) handle.map.fitBounds(lyr.getBounds(), { maxZoom: 16 });
          else if (handle && lyr.getLatLng) handle.map.setView(lyr.getLatLng(), 16);
        }
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
        if (options.overlays) bounds = options.overlays.extend(bounds);
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
        const wanted = new Set(s.marked.map(planLinks.key));
        const shapes = wanted.size ? s.rows.filter((r) => r.geometri && wanted.has(planLinks.key(r.objektid))).map((r) => geo.parseGeometry(r.geometri)) : [];
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
        // The plan's identity without braces, and a comprehensive plan's status as its planhändelse with its date (F90 a).
        const identity = String(info.objektid || '').replace(/[{}]/g, '').trim();
        const isOp = s.slag === 'oversiktsplan';
        kv.items = [
          info.beteckning ? { label: t('plan.field.beteckning'), value: info.beteckning } : null,
          identity ? { label: t('plan.field.objektid'), value: identity } : null,
          info.kommun || info.kommunkod ? { label: t('plan.field.kommun'), value: [info.kommun, info.kommunkod].filter(Boolean).join(' ') } : null,
          info.typ ? { label: t('plan.field.typ'), value: info.typ } : null,
          info.status ? { label: t(isOp ? 'plan.field.planhandelse' : 'plan.field.status'), value: isOp ? `${info.status} ${info.datumPlanhandelse || ''}`.trim() : info.status } : null,
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
        // What the person chose comes first: the section whose areas are marked (ui/bearbeta/plan-sections) and the areas chosen
        // on the map with the sections that concern them.
        const focus = [];
        const chosen = s.marked.length ? sections.chosenBlock() : null;
        if (chosen) focus.push(chosen);
        if (s.picked.length > 1) focus.push(pickedBlock());
        else if (s.selected) {
          focus.push(h('h4', { text: t('plan.selected') }), editor.inspector(s.selected) || selectedDetails(s.selected));
          if (s.slag === 'oversiktsplan') focus.push(h('p', { class: 'dm-help dm-small', text: t('plan.select.hint') }));
        }
        // In edit mode the areas chosen can be linked to a ställningstagande (ui/bearbeta/plan-edit).
        const linking = editor.selection();
        if (linking) focus.push(linking);
        // The ställningstaganden and other sections that concern the areas, each with the way to its text.
        const about = s.picked.length ? sections.forObjects(s.picked) : null;
        if (about) focus.push(about);
        if (s.picked.length === 1 && s.selected && s.selected.objektid) {
          const block = D.require('ui/kinds/comment-block');
          const objekt = s.selected.objektid;
          focus.push(block.create(ctx, ds, block.targetOf(ds, `plan:${objekt}`, s.selected.namn || String(objekt), () => objekt)));
        }
        if (focus.length) items.unshift(h('div', { class: 'dm-stack-sm', 'data-plan-focus': '' }, focus));
        if (ai) items.unshift(ai.el);
        // Layers: shown and hidden per file and layer, with counts and symbols (ui/viz/layer-list).
        items.push(h('h4', { text: t('map.layers') }), h('div', { class: 'dm-stack-sm dm-plan-layers' }, layerCtl ? layerCtl.list() : null));
        if (options.overlays) items.push(options.overlays.block());
        if (s.selected) {
          // Nothing more: what is chosen is at the top.
        } else if (s.slag === 'detaljplan') {
          const legend = plan.legend(s.rows);
          if (legend.length) items.push(h('h4', { text: t('map.legend') }), h('ul', { class: 'dm-map-legend-list dm-plan-legend' }, legend.map((e) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: e.color || 'transparent' } }), h('span', { class: 'dm-plan-legend-text' }, h('strong', { text: e.beteckning + ' ' }), h('span', { class: 'dm-truncate', text: e.formulering || '' }))))));
          for (const g of plan.grouped(s.rows)) {
            if (g.typ === 'anvandning') continue;
            items.push(h('details', { class: 'dm-more', open: g.rows.length <= 12 ? true : null }, h('summary', { text: `${t('plan.type.' + g.typ)} (${i18n.formatNumber(g.rows.length)})` }),
              h('ul', { class: 'dm-plan-provisions' }, g.rows.slice(0, 200).map((r) => h('li', { onclick: () => pick([r]) }, h('strong', { text: (r.beteckning || '–') + ' ' }), h('span', { text: r.formulering || '' }))))));
          }
        } else {
          // The legend of the layers that show, land use with Boverket's colours and its area per use.
          if (layerCtl) items.push(h('h4', { text: t('map.legend') }), layerCtl.legend());
          items.push(h('p', { class: 'dm-help', text: t('plan.help.op') }));
        }
        if (!s.selected) { const unplaced = withoutPlace(); if (unplaced) items.push(unplaced); }
        replace(slots.right, items);
      }
      /** Several areas chosen: their names (each chooses that one alone) and the way to clear the choice. */
      function pickedBlock() {
        const text = (r) => (s.slag === 'oversiktsplan' ? r.namn || r.innehallstyp : [r.beteckning, r.formulering].filter(Boolean).join(' ')) || String(r.objektid || '–');
        return h('div', { class: 'dm-stack-sm', 'data-plan-picked': String(s.picked.length) },
          h('h4', { text: t('plan.select.title', { n: s.picked.length }) }),
          h('ul', { class: 'dm-plan-provisions' }, s.picked.slice(0, 200).map((r) => h('li', { 'data-plan-picked-area': String(r.objektid || ''), onclick: () => pick([r]) }, h('span', { text: text(r) })))),
          h('p', { class: 'dm-help dm-small', text: t('plan.select.hint') }),
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('plan.select.clear'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.select.clear.hint'), 'data-plan-picked-clear': '', onClick: () => pick([]) })));
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
          h('ul', { class: 'dm-plan-provisions' }, rows.slice(0, 200).map((r) => h('li', { onclick: () => pick([r]) }, h('span', { text: text(r) })))));
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
          ui.button({ label: t('common.close'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => pick([]) })));
        return box;
      }

      // ---- the AI panel (B-78) ----
      /** The AI panel is offered for a comprehensive plan in the tier BIM och GIS (platform/tier ai.panel). */
      const aiShown = () => s.slag === 'oversiktsplan' && tier.shows('ai.panel');
      /** The toolbar's toggle follows the panel. */
      function syncAi() { const b = slots && slots.center ? slots.center.querySelector('[data-plan-ai-toggle]') : null; if (b) b.setAttribute('pressed', ai ? 'true' : 'false'); }
      /** The other datasets shown on the map, as the AI's tools read them (ui/viz/map-overlays). */
      const overlaySources = () => (options.overlays && options.overlays.features ? options.overlays.shown.map((id) => options.overlays.features(id)).filter(Boolean) : []);
      /** The feature of another dataset clicked on the map, with its ref for copying its shape. */
      function overlayFeature() {
        const sel = options.overlays ? options.overlays.selected : null;
        return sel && sel.row && sel.entry ? { ref: `${sel.entry.id}#${sel.row._rowid}`, dataset: sel.entry.name, label: sel.entry.label ? sel.row[sel.entry.label] : null } : null;
      }
      /**
       * Open the AI panel (its group of scripts loaded first), in a mode and with a brief when given.
       * @param {{mode?: string, brief?: string}} opts
       */
      function openAi(opts) {
        D.ensure(['ai'], () => {
          if (!slots || !ds) return;
          if (ai) ai.destroy();
          ai = D.require('ui/bearbeta/plan-ai').create(ctx, {
            datasetId: ds.id, mode: opts.mode, brief: opts.brief, rows: () => s.rows, sources: overlaySources,
            view: () => ({ picked: s.picked, marked: s.marked, feature: overlayFeature() }),
            map: () => (handle && L ? { map: handle.map, L } : null),
            pick: (ids) => pick(ids.map((id) => s.byId.get(planLinks.key(id))).filter(Boolean)),
            onApproved: () => { s.updatedAt = null; if (ds && slots) render(ds, slots); },
          });
          renderInspector(); syncAi();
        }).catch((err) => ctx.shell.partFailed(err));
      }

      function destroy() { seq++; if (ai) { ai.destroy(); ai = null; } if (options.overlays) options.overlays.detach(); editor.destroy(); sections.destroy(); if (unhook) { unhook(); unhook = null; } if (handle) { handle.finalize(); handle = null; } groups = []; labelLayer = null; marks = null; layerCtl = null; mapEl = null; slots = null; highlighted = []; boxBtn = null; }
      return { render, destroy, pick, selectBox, setBoxMode, toolbar, renderInspector, state: s, sections, editor, openAi, get ai() { return ai; }, get handle() { return handle; }, get layers() { return layerCtl; }, get marks() { return marks; } };
    }
    return { create };
  });
})();
