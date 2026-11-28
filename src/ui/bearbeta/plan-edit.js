// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Editing a digital comprehensive plan in the plan view (ui/bearbeta/plan-view, F65): the buttons *Redigera planen* (and *Klar*)
 * and *Exportera som leverans*, and in edit mode a bar to draw a new area, line or point into a layer or theme (Leaflet-Geoman,
 * vendored, loaded on first use), the area's attributes, shape and position in the inspector, the sections of the areas chosen
 * with *Ta bort koppling*, the areas chosen (a click, Shift-click, *Markera område* or Shift and drag: the plan view's own choice)
 * linked to a ställningstagande, and the plan description's sections edited in place, added and removed beside the map
 * (ui/bearbeta/plan-sections). Every change goes through data/plan-edit, so it is logged and undone with the app's undo (*Ångra*
 * in the bar); the view draws the plan again afterwards. Texts are plain text and reach the page only as text.
 *
 * A Swedish detailed plan (Inhämta's Ny detaljplan, or one read from a file) is drawn the same way (PLAN 12 e): the bar chooses
 * the plan boundary, a use area or a property area and, for the last two, a provision from Boverket's catalogue (data/plan-catalog:
 * the common ones, or any found with *Sök i katalogen*); the inspector changes an area's provision, the values of its variables,
 * its designation and motive. It is exported as the national specification's GeoJSON (io/exporters/detaljplan).
 *
 * The plan view hands over what it knows (`api`): its state (rows, `picked`, the area chosen last, the layers), the dataset, how to
 * choose areas, draw the plan again and draw the inspector again. The view calls `buttons`, `bar`, `mapDrawn`, `inspector` and
 * `selection`; the plan description calls `textHead`, `sectionTools` and `objectSectionTools`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-edit', ['ui/base', 'ui/basic', 'data/plan', 'data/plan-edit', 'data/plan-delivery', 'data/plan-links', 'data/plan-catalog', 'data/recipes', 'data/geo', 'viz/leaflet', 'viz/theme', 'platform/files', 'ui/bearbeta/plan-layers'], (base, basic, plan, planEdit, delivery, planLinks, catalog, recipes, geo, leaflet, theme, files, planLayers) => {
    const { h, t, i18n, replace } = base;
    const GEOMAN = 'vendor/leaflet-geoman/';
    /** Geoman's names of the shapes drawn, by the kind of geometry. */
    const SHAPES = { polygon: 'Polygon', line: 'Line', point: 'CircleMarker' };
    const ICONS = { polygon: 'square', line: 'trending-up', point: 'map-pin' };
    const AREA_ONLY = new Set(['omrade', 'plangeometri']);
    /** What a detailed plan's bar draws: its plan boundary, a use area or a property area (data/plan object types). */
    const DP_TARGETS = ['planomrade', 'anvandning', 'egenskap'];
    /** A catalogue provision as one line: its designation and formulation. @param {any} e */
    const provisionLabel = (e) => [String(e.beteckning || '').replace(/#/g, '').trim(), e.formulering].filter(Boolean).join(' ');
    /** @type {Promise<any>|null} */ let loading = null;
    let cssLinked = false;
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    /** An id as compared (data/plan-links): without braces, in lower case. */
    const idOf = (v) => planLinks.key(v);

    /** Load Leaflet-Geoman (vendored classic script) and its stylesheet after Leaflet, on first use. @returns {Promise<any>} L */
    function ensureLibrary() {
      if (!cssLinked && typeof document !== 'undefined') {
        document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: (globalThis.DATASPATIUM_BASE || '') + GEOMAN + 'leaflet-geoman.css' }));
        cssLinked = true;
      }
      const g = /** @type {any} */ (globalThis);
      if (g.L && g.L.PM) return Promise.resolve(g.L);
      if (!loading) {
        loading = leaflet.ensure()
          .then(() => (g.L.PM ? null : D.assets.loadVendorScript(GEOMAN + 'leaflet-geoman.js')))
          .then(() => { if (!g.L.PM) throw new Error(t('plan.edit.err.library')); return g.L; })
          .catch((err) => { loading = null; throw err; });
      }
      return loading;
    }
    /** Several geometries of one kind as one (a MultiPolygon, MultiLineString or MultiPoint); one stays as it is. */
    function combine(list) {
      const parts = list.filter((g) => g && g.type);
      if (parts.length === 1) return parts[0];
      const multi = { Polygon: 'MultiPolygon', LineString: 'MultiLineString', Point: 'MultiPoint' };
      const type = multi[parts[0].type] || parts[0].type;
      return { type, coordinates: parts.flatMap((g) => (g.type === type ? g.coordinates : [g.coordinates])) };
    }

    /**
     * The plan view's editor.
     * @param {any} ctx shell context
     * @param {{state: () => any, dataset: () => any, pick: (rows: any[]) => void, changed: () => void, inspector: () => void}} api
     */
    function create(ctx, api) {
      const { ui, shell } = ctx;
      const st = { editing: false, target: '', drawing: '', shape: /** @type {any} */ (null), pending: '', catalogue: /** @type {Map<string, string[]>|null} */ (null), catalogueFor: '',
        /** A detailed plan's provisions to draw with: the common ones per type, those found in the catalogue, the one chosen per type. */
        common: /** @type {Record<string, any[]>} */ ({ anvandning: [], egenskap: [] }), found: /** @type {Record<string, any[]>} */ ({ anvandning: [], egenskap: [] }), provision: /** @type {Record<string, string>} */ ({}) };
      let map = null; let L = null; let groups = []; let copy = null; let barEl = null;
      const ds = () => api.dataset();
      const view = () => api.state();
      /** A detailed plan in the view (a Swedish one: a Nordic plan has its own model). */
      const isDp = () => view().slag === 'detaljplan';
      const available = () => { const d = ds(); const info = view().info || {}; return !!(d && d.kind === 'plan' && (view().slag === 'oversiktsplan' || (isDp() && (!info.land || info.land === 'SE')))); };
      const rowOf = (id) => view().rows.find((r) => idOf(r.objektid) === idOf(id)) || null;
      /** The areas chosen on the map (the plan view's `picked`) and their ids. */
      const picked = () => (view().picked || []).filter(Boolean);
      const pickedIds = () => picked().map((r) => str(r.objektid)).filter((x) => idOf(x));
      /** An action from a button: its error as a toast, the details in the log. */
      const guard = (fn) => async (...args) => {
        try { await fn(...args); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 9000 }); shell.log(String((err && err.message) || err), 'error'); }
      };

      // ---- edit mode -----------------------------------------------------------------------------------------
      /** *Redigera planen* and *Klar*, and *Exportera som leverans*, for the plan view's toolbar. */
      function buttons() {
        if (!available()) return [];
        const toggle = basic.button({ label: t(st.editing ? 'plan.edit.done' : 'plan.edit.start'), icon: st.editing ? 'check' : 'pencil', title: t(st.editing ? 'plan.edit.done.hint' : 'plan.edit.start.hint'), 'data-plan-edit': st.editing ? 'done' : 'start',
          onClick: guard(async () => { toggle.setAttribute('loading', ''); try { await (st.editing ? stop() : start()); } finally { toggle.removeAttribute('loading'); } }) });
        const exported = isDp()
          ? basic.button({ label: t('plan.dp.export'), icon: 'package', title: t('plan.dp.export.hint'), 'data-plan-export': 'detaljplan', onClick: guard(exportDetailed) })
          : basic.button({ label: t('plan.edit.export'), icon: 'package', title: t('plan.edit.export.hint'), 'data-plan-export': '', onClick: guard(exportDelivery) });
        return [toggle, exported];
      }
      /** Edit mode on, without drawing the plan again (the view draws it next): the drawing library and the plan's value lists. */
      async function begin() {
        await ensureLibrary();
        st.editing = true; st.target = '';
        const id = ds().id;
        if (st.catalogueFor !== id) {
          st.catalogue = null; st.catalogueFor = id; st.provision = {}; st.found = { anvandning: [], egenskap: [] };
          if (isDp()) Promise.all([catalog.common('anvandning'), catalog.common('egenskap')]).then(([a, e]) => { if (st.catalogueFor === id) { st.common = { anvandning: a, egenskap: e }; fillBar(); api.inspector(); } }).catch((err) => D.log('plan-edit', err));
          else planEdit.catalogue(id).then((c) => { if (st.catalogueFor === id) { st.catalogue = c; api.inspector(); } }).catch((err) => D.log('plan-edit', err));
        }
      }
      async function start() { await begin(); api.changed(); }
      async function stop() {
        stopDrawing(); dropShape();
        st.editing = false; st.shape = null;
        api.changed();
      }
      /** The plan as a delivery (io/exporters/plan-delivery), downloaded. */
      async function exportDelivery() {
        const d = ds();
        const blob = await D.require('io/exporters/plan-delivery').toZip(d.id);
        const name = files.safeName(d.name, 'zip');
        files.download(blob, name);
        shell.log(t('plan.edit.exported', { name }) + ` (${i18n.formatBytes(blob.size)})`, 'ok');
        ui.toast.show(t('plan.edit.exported', { name }), { kind: 'ok' });
      }
      /** A detailed plan as the national specification's GeoJSON (io/exporters/detaljplan), downloaded. */
      async function exportDetailed() {
        const d = ds();
        const blob = await D.require('io/exporters/detaljplan').toBlob(d.id);
        const name = files.safeName(d.name, 'geojson');
        files.download(blob, name);
        shell.log(t('plan.edit.exported', { name }) + ` (${i18n.formatBytes(blob.size)})`, 'ok');
        ui.toast.show(t('plan.edit.exported', { name }), { kind: 'ok' });
      }
      async function undo() {
        stopDrawing(); dropShape();
        const label = await planEdit.undo(ds().id);
        shell.log(t('bearbeta.undone', { label }), 'ok');
        api.changed();
      }

      // ---- the bar -----------------------------------------------------------------------------------------------
      /** The layers and themes to draw into: the plan map's layers (not the underlag), then every theme of the ÖP model. */
      function targets() {
        if (isDp()) return DP_TARGETS.map((typ) => ({ value: 'dp:' + typ, label: t('plan.dp.target.' + typ) }));
        const out = [];
        for (const l of view().layers || []) {
          if (l.tema === 'underlag' || !l.lager) continue;
          out.push({ value: 'layer:' + l.key, label: l.groupLabel ? `${l.label} · ${l.groupLabel}` : l.label, group: t('plan.edit.target.layers') });
        }
        for (const key of Object.keys(plan.OP_CATEGORIES)) out.push({ value: 'theme:' + key, label: planLayers.themeLabel(key), group: t('plan.edit.target.themes') });
        return out;
      }
      const layerOf = (value) => (value.startsWith('layer:') ? (view().layers || []).find((l) => 'layer:' + l.key === value) || null : null);
      /** The kind of geometry a target takes: a layer's own, an area-only theme's, else any (''). */
      function familyOf(value) {
        if (value.startsWith('dp:')) return value === 'dp:egenskap' ? '' : 'polygon';
        const l = layerOf(value);
        if (l) return planEdit.layerFamily(l.lager, l.tema) || l.mark || '';
        const tema = value.replace(/^theme:/, '');
        return AREA_ONLY.has(tema) ? 'polygon' : '';
      }
      function defaultTarget(list) {
        const s = view();
        // A detailed plan starts with its boundary, then its uses.
        if (isDp()) return s.rows.some((r) => r.objekttyp === 'planomrade') ? 'dp:anvandning' : 'dp:planomrade';
        const own = s.selected && (view().layers || []).find((l) => l.rows && l.rows.includes(s.selected));
        if (own && list.some((o) => o.value === 'layer:' + own.key)) return 'layer:' + own.key;
        return (list.find((o) => o.value.startsWith('layer:')) || list.find((o) => o.value === 'theme:markochvattenanvandning') || list[0] || { value: '' }).value;
      }
      /** The edit bar below the page's head, or null outside edit mode. */
      function bar() {
        if (!st.editing || !available()) { barEl = null; return null; }
        barEl = h('div', { class: 'dm-stack-sm dm-plan-edit', 'data-plan-edit-bar': '' });
        fillBar();
        return barEl;
      }
      function fillBar() {
        if (!barEl) return;
        const list = targets();
        if (!list.some((o) => o.value === st.target)) st.target = defaultTarget(list);
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('plan.edit.target'), inline: true, title: t('plan.edit.target'), 'data-plan-edit-target': '' }));
        sel.options = list; sel.value = st.target;
        sel.addEventListener('change', () => { st.target = sel.value; fillBar(); });
        const fam = familyOf(st.target);
        const busy = !!(st.drawing || st.shape);
        const draw = (family) => basic.button({ label: t('plan.edit.draw.' + family), icon: ICONS[family], size: 'sm', title: t('plan.edit.draw.' + family + '.hint'), disabled: (fam && fam !== family) || busy ? true : null, 'data-plan-draw': family, onClick: guard(() => startDraw(family)) });
        const drawing = st.drawing ? [
          basic.button({ label: t('plan.edit.draw.finish'), icon: 'check', size: 'sm', title: t('plan.edit.draw.finish.hint'), 'data-plan-draw-finish': '', onClick: () => finishDraw() }),
          basic.button({ label: t('common.cancel'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.edit.draw.cancel.hint'), 'data-plan-draw-cancel': '', onClick: () => stopDrawing() }),
        ] : [];
        const id = ds().id;
        const can = recipes.canUndo(id);
        const undoBtn = basic.button({ label: t('common.undo'), icon: 'history', size: 'sm', disabled: can && !busy ? null : true, title: can ? t('bearbeta.undo.title', { label: recipes.undoLabel(id) }) : t('bearbeta.undo.none'), 'data-plan-edit-undo': '', onClick: guard(undo) });
        replace(barEl,
          h('div', { class: 'dm-toolbar' }, sel, ...provisionPicker(), draw('polygon'), draw('line'), draw('point'), ...drawing, undoBtn),
          h('p', { class: 'dm-help dm-small', text: t(st.drawing ? (isDp() ? 'plan.dp.drawing.hint' : 'plan.edit.drawing.hint') : st.shape ? 'plan.edit.shape.hint' : isDp() ? 'plan.dp.hint' : 'plan.edit.hint') }));
      }

      /** The provisions of a type to choose from: the one an area has, the common ones, then those found in the catalogue. */
      function provisionOptions(typ, current) {
        const seen = new Set();
        const out = [];
        for (const [list, group] of [[current ? [current] : [], ''], [st.common[typ] || [], t('plan.dp.common')], [st.found[typ] || [], t('plan.dp.found')]]) {
          for (const e of list) { if (!e || seen.has(e.uuid)) continue; seen.add(e.uuid); out.push({ value: e.uuid, label: provisionLabel(e), group: group || e.form || '' }); }
        }
        return out;
      }
      const entryOf = (typ, uuid) => [].concat(st.common[typ] || [], st.found[typ] || []).find((e) => e.uuid === uuid) || null;
      /** A detailed plan's provision for the next use or property area, and *Sök i katalogen*; nothing for the plan boundary. */
      function provisionPicker() {
        const typ = st.target.replace(/^dp:/, '');
        if (!isDp() || typ === 'planomrade') return [];
        const options = provisionOptions(typ, null);
        if (!st.provision[typ] && options.length) st.provision[typ] = options[0].value;
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('plan.dp.provision'), inline: true, title: t('plan.dp.provision'), 'data-plan-dp-provision': '' }));
        sel.options = options; sel.value = st.provision[typ] || '';
        sel.addEventListener('change', () => { st.provision[typ] = sel.value; });
        return [sel, basic.button({ label: t('plan.dp.search'), icon: 'search', size: 'sm', title: t('plan.dp.search.hint'), 'data-plan-dp-search': '', onClick: guard(async () => {
          const e = await searchDialog(typ);
          if (e) { st.provision[typ] = e.uuid; fillBar(); }
        }) })];
      }
      /**
       * Boverket's catalogue as the app ships it, searched for a provision of a type in force; the one chosen is kept with those
       * found. @param {string} typ @returns {Promise<any|null>}
       */
      async function searchDialog(typ) {
        const cat = await catalog.load();
        const input = /** @type {any} */ (h('dm-input', { type: 'search', label: t('plan.dp.search.label'), placeholder: t('plan.dp.search.placeholder'), 'data-plan-dp-query': '' }));
        const list = h('div', { class: 'dm-list', 'data-plan-dp-results': '' });
        let done = null;
        const draw = async () => {
          const found = await catalog.search(input.value, { typ, current: true, limit: 60 });
          replace(list, found.length ? found.map((e) => h('button', { type: 'button', class: 'dm-list-item', 'data-plan-dp-result': e.uuid, onclick: () => { if (done) done(e); } },
            h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: provisionLabel(e) }), h('span', { class: 'dm-list-sub dm-truncate', text: [e.form, e.kategori, e.underkategori].filter(Boolean).join(' · ') })))) : h('p', { class: 'dm-help', text: t('plan.dp.search.none') }));
        };
        input.addEventListener('input', () => { draw().catch((err) => D.log('plan-edit', err)); });
        const chosen = await ui.dialog.open({
          title: t('plan.dp.search.title', { type: t('plan.type.' + typ) }), help: 'planer#en-ny-detaljplan', size: 'lg',
          body: (finish) => { done = finish; draw().catch((err) => D.log('plan-edit', err)); return h('div', { class: 'dm-stack', 'data-plan-dp-search-dialog': '' }, h('p', { class: 'dm-help dm-small', text: t('plan.dp.search.release', { release: cat.release || '' }) }), input, list); },
          actions: [{ label: t('common.cancel'), value: null }],
        });
        if (!chosen || typeof chosen !== 'object') return null;
        if (!st.found[typ].some((e) => e.uuid === chosen.uuid)) st.found[typ].push(chosen);
        return chosen;
      }

      // ---- the map -----------------------------------------------------------------------------------------------
      /**
       * The plan's map is drawn (again): in edit mode a shape drawn becomes an area, a new area is chosen, and a shape being edited
       * stays so. @param {any} m the Leaflet map @param {any} Lib L @param {any[]} drawn its layer groups
       */
      function mapDrawn(m, Lib, drawn) {
        map = m; L = Lib; groups = drawn || []; copy = null;
        if (!st.editing || !available() || !map) return;
        if (L.PM && !map.pm) L.PM.reInitLayer(map);
        if (map.pm) map.pm.setGlobalOptions({ snappable: true, snapDistance: 15, tooltips: false });
        map.on('pm:create', (e) => { onCreate(e).catch((err) => { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 9000 }); }); });
        const s = view();
        // A new area is the one chosen (the view draws it as chosen and lists it in the inspector).
        if (st.pending) { const row = rowOf(st.pending); st.pending = ''; if (row) { s.picked = [row]; s.selected = row; } }
        if (st.shape) setupShape();
      }
      /** The plan's areas answer clicks, or not while a shape is drawn or edited (a click must reach the map then). */
      function setInteractive(on) {
        for (const g of groups) {
          g.group.eachLayer((lyr) => {
            lyr.options.interactive = on;
            if (lyr._path && L) L.DomUtil[on ? 'addClass' : 'removeClass'](lyr._path, 'leaflet-interactive');
            if (lyr._icon) lyr._icon.style.pointerEvents = on ? '' : 'none';
          });
        }
      }
      function startDraw(family) {
        if (!map || !L || !L.PM) throw new Error(t('plan.edit.err.library'));
        if (!map.pm) L.PM.reInitLayer(map);
        stopDrawing();
        const color = theme.tokens().accent;
        map.pm.enableDraw(SHAPES[family], { snappable: true, continueDrawing: false, tooltips: false, templineStyle: { color }, hintlineStyle: { color, dashArray: [5, 5] }, pathOptions: { color, fillColor: color, fillOpacity: 0.2 } });
        st.drawing = family;
        setInteractive(false);
        map.getContainer().setAttribute('data-plan-drawing', family);
        fillBar();
      }
      function finishDraw() {
        const d = map && map.pm && map.pm.Draw ? map.pm.Draw[SHAPES[st.drawing]] : null;
        if (d && typeof d._finishShape === 'function') d._finishShape();
      }
      function stopDrawing() {
        if (map && map.pm) map.pm.disableDraw();
        if (map) map.getContainer().removeAttribute('data-plan-drawing');
        st.drawing = '';
        if (!st.shape) setInteractive(true);
        fillBar();
      }
      /** A shape drawn: a new area in the layer or theme chosen, selected when the plan is drawn again. */
      async function onCreate(e) {
        const layer = e && e.layer;
        let g = null;
        try { g = layer ? layer.toGeoJSON().geometry : null; } catch (_err) { g = null; }
        if (layer && layer.remove) layer.remove();
        stopDrawing();
        if (!g) return;
        if (isDp()) { await createProvision(g); return; }
        const target = layerOf(st.target);
        const tema = target ? target.tema || 'omrade' : st.target.replace(/^theme:/, '') || 'omrade';
        const types = (st.catalogue && st.catalogue.get(tema)) || [];
        const same = target && target.rows ? target.rows.find((r) => r.innehallstyp) : null;
        const area = { tema, geometry: g, innehallstyp: same ? same.innehallstyp : types[0] || plan.OP_CATEGORIES[tema] || '' };
        if (target) Object.assign(area, { lager: target.lager, fil: target.fil || '' });
        const objektid = await planEdit.addArea(ds().id, area);
        st.pending = objektid;
        shell.log(t('plan.edit.area.added', { layer: target ? target.label : planLayers.themeLabel(tema) }), 'ok');
        api.changed();
      }

      /** A shape drawn in a detailed plan: the plan boundary (the one there is gets the new shape), or an area with its provision. */
      async function createProvision(g) {
        const id = ds().id;
        const typ = st.target.replace(/^dp:/, '') || 'anvandning';
        const boundary = typ === 'planomrade' ? view().rows.find((r) => r.objekttyp === 'planomrade') : null;
        if (boundary) { await planEdit.setGeometry(id, boundary.objektid, g); st.pending = String(boundary.objektid); }
        else st.pending = await planEdit.addProvision(id, { objekttyp: typ, geometry: g, entry: typ === 'planomrade' ? null : entryOf(typ, st.provision[typ]) });
        // With its boundary drawn the plan gets its uses next.
        if (typ === 'planomrade') st.target = 'dp:anvandning';
        shell.log(t('plan.edit.area.added', { layer: t('plan.dp.target.' + typ) }), 'ok');
        api.changed();
      }

      // ---- an area's shape ----------------------------------------------------------------------------------
      function editShape(row, mode) {
        if (!map || !L || !L.PM) throw new Error(t('plan.edit.err.library'));
        stopDrawing();
        st.shape = { objektid: idOf(row.objektid), mode };
        setInteractive(false);
        setupShape();
        fillBar();
        api.inspector();
      }
      /** The area being edited drawn above the plan with Geoman's handles: vertices to drag, or the whole shape to move. */
      function setupShape() {
        removeCopy();
        const row = st.shape ? rowOf(st.shape.objektid) : null;
        const g = row && row.geometri ? geo.parseGeometry(row.geometri) : null;
        if (!map || !L || !g) { st.shape = null; return; }
        const color = theme.tokens().accent;
        copy = L.geoJSON(g, { style: () => ({ color, weight: 3, fillColor: color, fillOpacity: 0.15 }), pointToLayer: (_f, at) => L.circleMarker(at, { radius: 9, color, weight: 3, fillOpacity: 0.3 }) }).addTo(map);
        copy.eachLayer((lyr) => {
          if (!lyr.pm) L.PM.reInitLayer(lyr);
          if (st.shape.mode === 'move') lyr.pm.enableLayerDrag();
          else lyr.pm.enable({ allowSelfIntersection: false, snappable: true, draggable: false });
        });
        setInteractive(false);
        map.getContainer().setAttribute('data-plan-edit-shape', st.shape.mode);
      }
      function removeCopy() {
        if (copy) { copy.eachLayer((lyr) => { try { if (lyr.pm) { lyr.pm.disable(); if (lyr.pm.disableLayerDrag) lyr.pm.disableLayerDrag(); } } catch (_e) { /* already off */ } }); if (map) map.removeLayer(copy); }
        copy = null;
        if (map) map.getContainer().removeAttribute('data-plan-edit-shape');
      }
      /** Stop editing a shape without keeping it. */
      function dropShape() { removeCopy(); st.shape = null; setInteractive(true); }
      async function saveShape() {
        if (!copy || !st.shape) return;
        const geometry = combine(copy.toGeoJSON().features.map((f) => f.geometry));
        const objektid = st.shape.objektid;
        dropShape();
        await planEdit.setGeometry(ds().id, objektid, geometry);
        ui.toast.show(t('plan.edit.shape.saved'), { kind: 'ok' });
        api.changed();
      }

      // ---- the inspector ----------------------------------------------------------------------------------------
      /** The areas chosen, in edit mode: *Koppla till ställningstagande*; null outside edit mode or with none chosen. */
      function selection() {
        const n = pickedIds().length;
        if (!st.editing || !available() || isDp() || !n) return null;
        return h('div', { class: 'dm-row-wrap', 'data-plan-edit-selection': String(n) },
          basic.button({ label: t('plan.edit.link'), icon: 'link', size: 'sm', title: t('plan.edit.link.hint'), 'data-plan-link': '', onClick: guard(linkDialog) }));
      }
      /**
       * The chosen area's attributes to change, its shape and position, and *Ta bort området*; null outside edit mode (the view
       * then shows its facts as before). @param {any} row
       */
      function inspector(row) {
        if (!st.editing || !row || !available()) return null;
        if (isDp()) return provisionInspector(row);
        const id = ds().id;
        const objektid = str(row.objektid).trim();
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [{ label: t('plan.field.tema'), value: planLayers.themeLabel(row.tema) }, row.lager ? { label: t('plan.edit.layer'), value: row.lager } : null, { label: t('plan.field.objektid'), value: objektid }].filter(Boolean);
        const values = ((st.catalogue && st.catalogue.get(str(row.tema))) || []).slice();
        if (row.innehallstyp && !values.includes(row.innehallstyp)) values.unshift(row.innehallstyp);
        const typeSel = /** @type {any} */ (h('dm-select', { label: t('plan.field.innehallstyp'), 'data-plan-area-type': '' }));
        typeSel.options = values.map((v) => ({ value: v, label: v }));
        typeSel.value = row.innehallstyp || '';
        const other = /** @type {any} */ (h('dm-input', { label: t('plan.edit.type.other'), 'data-plan-area-type-other': '' }));
        const name = /** @type {any} */ (h('dm-input', { label: t('common.name'), 'data-plan-area-name': '' }));
        name.value = row.namn || '';
        const prec = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('plan.field.precisering'), 'data-plan-area-precision': '' }));
        prec.value = row.precisering || '';
        const save = basic.button({ label: t('common.save'), icon: 'save', variant: 'primary', size: 'sm', title: t('plan.edit.area.save.hint'), 'data-plan-area-save': '', onClick: guard(async () => {
          await planEdit.editArea(id, objektid, { innehallstyp: str(other.value).trim() || typeSel.value, namn: name.value, precisering: prec.value });
          ui.toast.show(t('plan.edit.area.saved'), { kind: 'ok' });
          api.changed();
        }) });
        const mine = st.shape && st.shape.objektid === idOf(objektid);
        const shapeButtons = mine
          ? [basic.button({ label: t('plan.edit.shape.save'), icon: 'check', size: 'sm', 'data-plan-shape-save': '', onClick: guard(saveShape) }),
            basic.button({ label: t('common.cancel'), icon: 'x', size: 'sm', variant: 'ghost', 'data-plan-shape-cancel': '', onClick: () => { dropShape(); fillBar(); api.inspector(); } })]
          : [basic.button({ label: t('plan.edit.shape.edit'), icon: 'pencil', size: 'sm', title: t('plan.edit.shape.edit.hint'), disabled: row.geometri && !st.drawing ? null : true, 'data-plan-shape-edit': 'vertices', onClick: guard(() => editShape(row, 'vertices')) }),
            basic.button({ label: t('plan.edit.shape.move'), icon: 'arrow-right-left', size: 'sm', title: t('plan.edit.shape.move.hint'), disabled: row.geometri && !st.drawing ? null : true, 'data-plan-shape-edit': 'move', onClick: guard(() => editShape(row, 'move')) })];
        const remove = basic.button({ label: t('plan.edit.area.delete'), icon: 'trash-2', size: 'sm', variant: 'danger', title: t('plan.edit.area.delete.hint'), 'data-plan-area-delete': '', onClick: guard(async () => {
          if (!(await ui.dialog.confirm(t('plan.edit.area.delete.confirm', { name: row.namn || row.innehallstyp || objektid }), { okLabel: t('common.delete'), danger: true }))) return;
          await planEdit.deleteArea(id, objektid);
          if (st.shape && st.shape.objektid === idOf(objektid)) dropShape();
          api.pick([]);
          ui.toast.show(t('plan.edit.area.deleted'), { kind: 'ok' });
          api.changed();
        }) });
        return h('div', { class: 'dm-stack-sm', 'data-plan-area-edit': objektid }, kv, typeSel,
          h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }), other),
          name, prec, h('div', { class: 'dm-row-wrap' }, save), h('div', { class: 'dm-row-wrap' }, ...shapeButtons, remove));
      }
      /** The shape buttons of the area chosen (*Redigera formen*, *Flytta*, or *Spara formen* and *Avbryt*) and *Ta bort området*. */
      function shapeTools(row, label) {
        const id = ds().id;
        const objektid = str(row.objektid).trim();
        const mine = st.shape && st.shape.objektid === idOf(objektid);
        const shapeButtons = mine
          ? [basic.button({ label: t('plan.edit.shape.save'), icon: 'check', size: 'sm', 'data-plan-shape-save': '', onClick: guard(saveShape) }),
            basic.button({ label: t('common.cancel'), icon: 'x', size: 'sm', variant: 'ghost', 'data-plan-shape-cancel': '', onClick: () => { dropShape(); fillBar(); api.inspector(); } })]
          : [basic.button({ label: t('plan.edit.shape.edit'), icon: 'pencil', size: 'sm', title: t('plan.edit.shape.edit.hint'), disabled: row.geometri && !st.drawing ? null : true, 'data-plan-shape-edit': 'vertices', onClick: guard(() => editShape(row, 'vertices')) }),
            basic.button({ label: t('plan.edit.shape.move'), icon: 'arrow-right-left', size: 'sm', title: t('plan.edit.shape.move.hint'), disabled: row.geometri && !st.drawing ? null : true, 'data-plan-shape-edit': 'move', onClick: guard(() => editShape(row, 'move')) })];
        const remove = basic.button({ label: t('plan.edit.area.delete'), icon: 'trash-2', size: 'sm', variant: 'danger', title: t('plan.edit.area.delete.hint'), 'data-plan-area-delete': '', onClick: guard(async () => {
          if (!(await ui.dialog.confirm(t('plan.edit.area.delete.confirm', { name: label || objektid }), { okLabel: t('common.delete'), danger: true }))) return;
          await planEdit.deleteArea(id, objektid);
          if (st.shape && st.shape.objektid === idOf(objektid)) dropShape();
          api.pick([]);
          ui.toast.show(t('plan.edit.area.deleted'), { kind: 'ok' });
          api.changed();
        }) });
        return h('div', { class: 'dm-row-wrap' }, ...shapeButtons, remove);
      }
      /**
       * A detailed plan's area in edit mode: its provision (the catalogue's, chosen as in the bar), the values of the provision's
       * variables, its designation and motive (a provision outside the catalogue: its formulation), *Spara*, its shape and place.
       * The plan boundary has only its shape: the plan's name and designation are the plan's facts. @param {any} row
       */
      function provisionInspector(row) {
        const id = ds().id;
        const objektid = str(row.objektid).trim();
        const typ = str(row.objekttyp);
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [{ label: t('plan.field.objekttyp'), value: t('plan.type.' + (typ || 'annan')) }, { label: t('plan.field.objektid'), value: objektid }];
        const box = h('div', { class: 'dm-stack-sm', 'data-plan-area-edit': objektid }, kv);
        if (typ === 'planomrade' || !(typ in st.common)) { box.appendChild(shapeTools(row, row.formulering || t('plan.type.planomrade'))); return box; }
        const fields = h('div', { class: 'dm-stack-sm' });
        box.appendChild(fields);
        box.appendChild(shapeTools(row, [row.beteckning, row.formulering].filter(Boolean).join(' ')));
        let facts = {};
        try { facts = row.egenskaper ? JSON.parse(row.egenskaper) : {}; } catch (_e) { facts = {}; }
        /** The fields for a provision: `entry` the catalogue's (null outside it); `values` its variables' values. */
        const fill = (entry, values) => {
          const sel = /** @type {any} */ (h('dm-select', { label: t('plan.dp.provision'), 'data-plan-area-provision': '' }));
          sel.options = provisionOptions(typ, entry).concat(entry ? [] : [{ value: '', label: t('plan.dp.provision.none') }]);
          sel.value = entry ? entry.uuid : '';
          sel.addEventListener('change', () => fill(entryOf(typ, sel.value) || (entry && entry.uuid === sel.value ? entry : null), {}));
          const search = basic.button({ label: t('plan.dp.search'), icon: 'search', size: 'sm', title: t('plan.dp.search.hint'), onClick: guard(async () => { const e = await searchDialog(typ); if (e) fill(e, {}); }) });
          const vars = entry ? planEdit.variablesOf(entry.formulering) : [];
          const inputs = vars.map((v) => { const el = /** @type {any} */ (h('dm-input', { label: v.name, help: t('plan.dp.variable.' + (v.type === 'decimaltal' ? 'number' : 'text')), 'data-plan-area-variable': v.name })); el.value = values[v.name] === undefined ? '' : values[v.name]; return el; });
          const mark = /** @type {any} */ (h('dm-input', { label: t('plan.field.beteckning'), help: t('plan.dp.beteckning.help'), 'data-plan-area-designation': '' }));
          mark.value = entry && entry.uuid !== str(row.katalogreferens) ? String(entry.beteckning || '').replace(/#/g, '').trim() : row.beteckning || '';
          const text = entry ? null : /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('plan.field.formulering'), 'data-plan-area-formulation': '' }));
          if (text) text.value = row.formulering || '';
          const motive = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('plan.field.motiv'), 'data-plan-area-motive': '' }));
          motive.value = row.etikett || '';
          const save = basic.button({ label: t('common.save'), icon: 'save', variant: 'primary', size: 'sm', title: t('plan.edit.area.save.hint'), 'data-plan-area-save': '', onClick: guard(async () => {
            const given = {};
            vars.forEach((v, i) => { given[v.name] = inputs[i].value; });
            const next = entry ? planEdit.provisionFields(entry, given, facts) : { formulering: text.value };
            next.beteckning = mark.value; next.etikett = motive.value;
            await planEdit.editArea(id, objektid, next);
            ui.toast.show(t('plan.edit.area.saved'), { kind: 'ok' });
            api.changed();
          }) });
          replace(fields, h('div', { class: 'dm-row-end' }, sel, search), entry ? h('p', { class: 'dm-help dm-small', text: entry.formulering }) : null, ...inputs, mark, text, motive, h('div', { class: 'dm-row-wrap' }, save));
        };
        const ref = str(row.katalogreferens);
        if (!ref) fill(null, {});
        else catalog.get(ref).then((entry) => fill(entry, entry ? planEdit.valuesIn(entry.formulering, row.formulering) : {})).catch(() => fill(null, {}));
        return box;
      }
      /**
       * *Ta bort koppling* beside a section that concerns the areas chosen: the links of those areas to the section go.
       * @param {any} section @param {any[]} rows the chosen areas the section covers
       */
      function objectSectionTools(section, rows) {
        if (!st.editing || !available() || isDp()) return null;
        const ids = (rows || []).map((r) => str(r && r.objektid)).filter((x) => idOf(x));
        if (!ids.length) return null;
        return basic.button({ label: t('plan.edit.unlink'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.edit.unlink.hint'), 'data-plan-unlink': section.avsnitt, onClick: guard(async () => {
          const res = await planEdit.unlink(ds().id, section, ids);
          ui.toast.show(t('plan.edit.unlinked', { n: res.rows || 0 }), { kind: 'ok' });
          api.changed();
        }) });
      }
      /** The sections to link to, ställningstaganden first, in a dialog; the selected areas linked to the one chosen. */
      async function linkDialog() {
        const id = ds().id;
        const sections = await delivery.sectionsOf(id);
        if (!sections.length) { ui.toast.show(t('plan.edit.link.none'), { kind: 'info', timeout: 9000 }); return; }
        const keyOf = (s) => JSON.stringify([s.avsnitt, s.dokument]);
        const pick = /** @type {any} */ (h('dm-select', { label: t('plan.edit.link.pick'), 'data-plan-link-pick': '' }));
        const statements = sections.filter(planEdit.isStatement);
        const label = (s) => `${s.rubrik || s.avsnitt}${s.rubrik ? ' (' + s.avsnitt + ')' : ''}`;
        pick.options = statements.map((s) => ({ value: keyOf(s), label: label(s), group: t('plan.sections.statements') }))
          .concat(sections.filter((s) => !planEdit.isStatement(s)).map((s) => ({ value: keyOf(s), label: label(s), group: t('plan.sections.others') })));
        pick.value = keyOf(statements[0] || sections[0]);
        const ok = await ui.dialog.open({
          title: t('plan.edit.link'), help: 'planer#redigera-planen',
          body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('plan.edit.selected', { n: pickedIds().length }) }), pick),
          actions: [{ label: t('common.cancel'), value: false }, { label: t('plan.edit.link.ok'), variant: 'primary', value: true, primary: true }],
        });
        if (!ok) return;
        const [avsnitt, dokument] = JSON.parse(pick.value);
        const res = await planEdit.link(id, { avsnitt, dokument }, pickedIds());
        ui.toast.show(t('plan.edit.linked', { n: res.rows || 0 }), { kind: 'ok' });
        api.changed();
      }

      // ---- the plan description's sections -------------------------------------------------------------------------
      /** *Nytt ställningstagande* and *Nytt avsnitt* at the top of the tab Ställningstaganden; null outside edit mode. */
      function textHead() {
        if (!st.editing || !available() || isDp()) return null;
        return h('div', { class: 'dm-stack-sm', 'data-plan-text-edit': '' },
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('plan.edit.section.add.statement'), icon: 'plus', title: t('plan.edit.section.add.hint'), 'data-plan-section-add': 'statement', onClick: guard(() => sectionDialog(planEdit.STATEMENT)) }),
            basic.button({ label: t('plan.edit.section.add'), icon: 'plus', variant: 'ghost', title: t('plan.edit.section.add.hint'), 'data-plan-section-add': 'other', onClick: guard(() => sectionDialog('Beskrivning')) })));
      }
      /** A new section: heading, text, type, document and (under Fler alternativ) its bookmark, linked to the selected areas. */
      async function sectionDialog(typ) {
        const id = ds().id;
        const sections = await delivery.sectionsOf(id);
        const taken = sections.map((s) => s.avsnitt);
        const field = (label, attrs = {}) => /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs)));
        const head = field(t('plan.edit.section.heading'), { 'data-plan-new-heading': '' });
        const body = field(t('plan.edit.section.text'), { type: 'textarea', rows: '6', 'data-plan-new-text': '' });
        const type = /** @type {any} */ (h('dm-select', { label: t('plan.edit.section.type'), 'data-plan-new-type': '' }));
        type.options = plan.SECTION_TYPES.map((v) => ({ value: v, label: v }));
        type.value = typ;
        const docs = Array.from(new Set(sections.map((s) => s.dokument).filter(Boolean)));
        const doc = /** @type {any} */ (h('dm-select', { label: t('plan.edit.section.document'), 'data-plan-new-document': '' }));
        doc.options = docs.map((d) => ({ value: d, label: d }));
        if (docs.length) doc.value = docs[0];
        const mark = field(t('plan.edit.section.bookmark.label'), { help: t('plan.edit.section.bookmark.help'), mono: true, 'data-plan-new-bookmark': '' });
        let typed = false;
        mark.addEventListener('input', () => { typed = true; });
        head.addEventListener('input', () => { if (!typed) mark.value = planEdit.bookmarkName(head.value, taken); });
        mark.value = planEdit.bookmarkName('', taken);
        const chosen = pickedIds();
        const linkSel = chosen.length ? /** @type {any} */ (h('dm-switch', { label: t('plan.edit.section.link', { n: chosen.length }), 'data-plan-new-link': '' })) : null;
        if (linkSel) linkSel.checked = true;
        let done = null;
        const add = basic.button({ label: t('common.add'), icon: 'plus', variant: 'primary', 'data-plan-new-add': '', onClick: () => {
          const name = str(mark.value).trim();
          mark.error = !planEdit.validBookmark(name) ? t('plan.edit.err.bookmark', { name }) : taken.some((x) => x.toLowerCase() === name.toLowerCase()) ? t('plan.edit.err.bookmark.taken', { name }) : '';
          head.error = !planEdit.cleanLine(head.value) && !planEdit.cleanText(body.value) ? t('plan.edit.err.empty') : '';
          if (mark.getAttribute('error') || head.getAttribute('error')) return;
          if (done) done({ avsnitt: name, rubrik: head.value, text: body.value, typ: type.value, dokument: docs.length > 1 ? doc.value : docs[0] || '', link: !!(linkSel && linkSel.checked) });
        } });
        const values = await ui.dialog.open({
          title: t(typ === planEdit.STATEMENT ? 'plan.edit.section.add.statement' : 'plan.edit.section.add'), help: 'planer#redigera-planen', size: 'lg',
          body: (finish) => { done = finish; return h('div', { class: 'dm-stack', 'data-plan-new-section': '' }, head, body, type, docs.length > 1 ? doc : null, linkSel, h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }), mark), h('div', { class: 'dm-row' }, add)); },
          actions: [{ label: t('common.cancel'), value: null }],
        });
        if (!values || typeof values !== 'object') return;
        const made = await planEdit.addSection(id, { avsnitt: values.avsnitt, rubrik: values.rubrik, text: values.text, typ: values.typ, dokument: values.dokument, objekt: values.link ? chosen : [] });
        ui.toast.show(t('plan.edit.section.added', { name: values.rubrik || made.avsnitt }), { kind: 'ok' });
        api.changed();
      }
      /**
       * The edit buttons of a section in the tab Ställningstaganden: *Ändra* (in place), *Koppla markerade områden*, *Ta bort
       * kopplingen till markerade* and *Ta bort*; null outside edit mode. @param {any} section
       */
      function sectionTools(section) {
        if (!st.editing || !available() || isDp()) return null;
        return h('div', { class: 'dm-row-wrap', 'data-plan-section-tools': section.avsnitt },
          basic.button({ label: t('common.edit'), icon: 'pencil', size: 'sm', title: t('plan.edit.section.edit.hint'), 'data-plan-section-edit': section.avsnitt, onClick: (e) => editInPlace(/** @type {any} */ (e.currentTarget).closest('article'), section) }),
          basic.button({ label: t('plan.edit.link.selected'), icon: 'link', size: 'sm', title: t('plan.edit.link.selected.hint'), 'data-plan-section-link': section.avsnitt, onClick: guard(() => linkSelected(section, true)) }),
          basic.button({ label: t('plan.edit.unlink.selected'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.edit.unlink.selected.hint'), 'data-plan-section-unlink': section.avsnitt, onClick: guard(() => linkSelected(section, false)) }),
          basic.button({ label: t('common.delete'), icon: 'trash-2', size: 'sm', variant: 'danger', title: t('plan.edit.section.delete.hint'), 'data-plan-section-delete': section.avsnitt, onClick: guard(() => deleteSection(section)) }));
      }
      /** The heading, text and type of a section edited where it stands; Spara keeps them, Avbryt puts the section back. */
      function editInPlace(article, section) {
        if (!article) return;
        const kept = Array.from(article.childNodes);
        const head = /** @type {any} */ (h('dm-input', { label: t('plan.edit.section.heading'), 'data-plan-section-heading': '' }));
        head.value = section.rubrik || '';
        const body = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '8', label: t('plan.edit.section.text'), 'data-plan-section-body': '' }));
        body.value = planEdit.bodyOf(section);
        const type = /** @type {any} */ (h('dm-select', { label: t('plan.edit.section.type'), 'data-plan-section-type': '' }));
        const types = plan.SECTION_TYPES.slice();
        if (section.typ && !types.includes(section.typ)) types.unshift(section.typ);
        type.options = [{ value: '', label: '–' }].concat(types.map((v) => ({ value: v, label: v })));
        type.value = section.typ || '';
        const save = basic.button({ label: t('common.save'), icon: 'save', variant: 'primary', size: 'sm', 'data-plan-section-save': '', onClick: guard(async () => {
          await planEdit.editSection(ds().id, section, { rubrik: head.value, text: planEdit.composeText(section, head.value, body.value), typ: type.value });
          ui.toast.show(t('plan.edit.section.saved'), { kind: 'ok' });
          api.changed();
        }) });
        const cancel = basic.button({ label: t('common.cancel'), size: 'sm', variant: 'ghost', 'data-plan-section-cancel': '', onClick: () => article.replaceChildren(...kept) });
        article.replaceChildren(h('div', { class: 'dm-stack-sm', 'data-plan-section-form': section.avsnitt }, head, body, type,
          h('p', { class: 'dm-help dm-small', text: t('plan.edit.section.bookmark', { name: section.avsnitt }) }), h('div', { class: 'dm-row-wrap' }, save, cancel)));
        head.focus();
      }
      /** The selected areas linked to a section, or unlinked from it. */
      async function linkSelected(section, on) {
        const ids = pickedIds();
        if (!ids.length) { ui.toast.show(t('plan.edit.select.first'), { kind: 'info' }); return; }
        const res = await (on ? planEdit.link(ds().id, section, ids) : planEdit.unlink(ds().id, section, ids));
        ui.toast.show(t(on ? 'plan.edit.linked' : 'plan.edit.unlinked', { n: res.rows || 0 }), { kind: 'ok' });
        api.changed();
      }
      async function deleteSection(section) {
        if (!(await ui.dialog.confirm(t('plan.edit.section.delete.confirm', { name: section.rubrik || section.avsnitt }), { okLabel: t('common.delete'), danger: true }))) return;
        await planEdit.deleteSection(ds().id, section);
        ui.toast.show(t('plan.edit.section.deleted'), { kind: 'ok' });
        api.changed();
      }

      function destroy() { stopDrawing(); removeCopy(); map = null; groups = []; barEl = null; }
      return { buttons, bar, mapDrawn, selection, inspector, objectSectionTools, textHead, sectionTools, destroy, begin, start, stop, state: st, get editing() { return st.editing && available(); } };
    }
    return { create, ensureLibrary, combine };
  });
})();
