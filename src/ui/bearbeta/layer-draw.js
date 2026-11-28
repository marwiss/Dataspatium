// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Drawing in a map layer made in Inhämta (data/layer-new) on the map in Bearbeta (ui/bearbeta/map-view): *Rita i lagret* and
 * *Klar* in the toolbar, and in drawing mode a bar with *Rita punkt*, *Rita linje* or *Rita yta* (the layer's kind of geometry)
 * and *Ångra*. A shape is drawn with Leaflet-Geoman (vendored, loaded on first use by ui/bearbeta/plan-edit's `ensureLibrary`):
 * click the points and finish on the first one, on the last one again, or with *Avsluta formen*. A feature clicked shows its
 * values to change, *Ändra formen* (vertices to drag) or *Flytta* (the whole feature, a point too) and *Ta bort* in the inspector.
 * Every change is a recipe step through data/layer-new, undone with the app's undo; the map is drawn again afterwards. Values
 * reach the page only as text.
 *
 * The map view hands over what it knows (`api`): the dataset, the map drawn again, the inspector drawn again, a feature chosen.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/layer-draw', ['ui/base', 'ui/basic', 'data/layer-new', 'data/recipes', 'data/datasets', 'viz/theme', 'ui/bearbeta/plan-edit'], (base, basic, layerNew, recipes, datasets, theme, planEditUi) => {
    const { h, t, replace } = base;
    /** Geoman's names of the shapes drawn, and the buttons' icons, by the kind of geometry. */
    const SHAPES = { polygon: 'Polygon', line: 'Line', point: 'CircleMarker' };
    const ICONS = { polygon: 'square', line: 'trending-up', point: 'map-pin' };

    /**
     * The map view's drawing tools.
     * @param {any} ctx shell context
     * @param {{dataset: () => any, changed: () => void, inspector: () => void, select: (sel: any) => void}} api
     */
    function create(ctx, api) {
      const { ui, shell } = ctx;
      const st = { editing: false, drawing: false, shape: /** @type {any} */ (null), pending: 0 };
      let map = null; let L = null; let handle = null; let copy = null; let barEl = null;
      const ds = () => api.dataset();
      const available = () => layerNew.isLayer(ds());
      const kind = () => layerNew.kindOf(ds());
      /** An action from a button: its error as a toast, the details in the log. */
      const guard = (fn) => async (...args) => {
        try { await fn(...args); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 9000 }); shell.log(String((err && err.message) || err), 'error'); }
      };

      /** *Rita i lagret* or *Klar*, for the map view's toolbar. */
      function buttons() {
        if (!available()) return [];
        const toggle = basic.button({ label: t(st.editing ? 'layer.draw.done' : 'layer.draw.start'), icon: st.editing ? 'check' : 'pencil', title: t(st.editing ? 'layer.draw.done.hint' : 'layer.draw.start.hint'), 'data-layer-edit': st.editing ? 'done' : 'start',
          onClick: guard(async () => { toggle.setAttribute('loading', ''); try { await (st.editing ? stop() : start()); } finally { toggle.removeAttribute('loading'); } }) });
        return [toggle];
      }
      /** Drawing mode on, without drawing the map again (the view draws it next). */
      async function begin() { await planEditUi.ensureLibrary(); st.editing = true; }
      async function start() { await begin(); api.changed(); }
      async function stop() { stopDrawing(); dropShape(); st.editing = false; api.changed(); }
      async function undo() {
        stopDrawing(); dropShape();
        const label = await layerNew.undo(ds().id);
        shell.log(t('bearbeta.undone', { label }), 'ok');
        api.select(null);
        api.changed();
      }

      /** The bar below the page's head, or null outside drawing mode. */
      function bar() {
        if (!st.editing || !available()) { barEl = null; return null; }
        barEl = h('div', { class: 'dm-stack-sm dm-plan-edit', 'data-layer-edit-bar': '' });
        fillBar();
        return barEl;
      }
      function fillBar() {
        if (!barEl) return;
        const k = kind();
        const busy = st.drawing || !!st.shape;
        const id = ds().id;
        const can = recipes.canUndo(id);
        replace(barEl,
          h('div', { class: 'dm-toolbar' },
            basic.button({ label: t('plan.edit.draw.' + k), icon: ICONS[k], size: 'sm', title: t('layer.draw.' + k + '.hint'), disabled: busy ? true : null, 'data-layer-draw': k, onClick: guard(startDraw) }),
            st.drawing && k !== 'point' ? basic.button({ label: t('plan.edit.draw.finish'), icon: 'check', size: 'sm', title: t('plan.edit.draw.finish.hint'), 'data-layer-draw-finish': '', onClick: () => finishDraw() }) : null,
            st.drawing ? basic.button({ label: t('common.cancel'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.edit.draw.cancel.hint'), 'data-layer-draw-cancel': '', onClick: () => stopDrawing() }) : null,
            basic.button({ label: t('common.undo'), icon: 'history', size: 'sm', disabled: can && !busy ? null : true, title: can ? t('bearbeta.undo.title', { label: recipes.undoLabel(id) }) : t('bearbeta.undo.none'), 'data-layer-edit-undo': '', onClick: guard(undo) })),
          h('p', { class: 'dm-help dm-small', text: t(st.drawing ? 'layer.draw.drawing.hint.' + k : st.shape ? 'plan.edit.shape.hint' : 'layer.draw.hint') }));
      }

      /** The map drawn (again): in drawing mode a shape drawn becomes a feature, a new feature is chosen, a shape edited stays so. */
      function mapDrawn(hd, Lib) {
        handle = hd; map = hd ? hd.map : null; L = Lib; copy = null;
        if (!st.editing || !available() || !map) return;
        if (L.PM && !map.pm) L.PM.reInitLayer(map);
        if (map.pm) map.pm.setGlobalOptions({ snappable: true, snapDistance: 15, tooltips: false });
        map.on('pm:create', (e) => { onCreate(e).catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 9000 })); });
        if (st.pending) { const sel = featureOf(st.pending); st.pending = 0; if (sel) api.select(sel); }
        if (st.shape) setupShape();
      }
      /** A feature drawn on the map by its rowid, as the map view's choice gives it ({layer, properties, geometry}), or null. */
      function featureOf(rowid) {
        for (const g of (handle && handle.groups) || []) {
          let found = null;
          g.group.eachLayer((lyr) => { const f = lyr.feature; if (!found && f && f.properties && Number(f.properties._rowid) === Number(rowid)) found = { layer: g.layer, properties: f.properties, geometry: f.geometry }; });
          if (found) return found;
        }
        return null;
      }
      /** The layer's features answer clicks, or not while a shape is drawn or edited (a click must reach the map then). */
      function setInteractive(on) {
        for (const g of (handle && handle.groups) || []) {
          g.group.eachLayer((lyr) => {
            lyr.options.interactive = on;
            if (lyr._path && L) L.DomUtil[on ? 'addClass' : 'removeClass'](lyr._path, 'leaflet-interactive');
          });
        }
      }
      function startDraw() {
        if (!map || !L || !L.PM) throw new Error(t('plan.edit.err.library'));
        if (!map.pm) L.PM.reInitLayer(map);
        stopDrawing();
        const color = theme.tokens().accent;
        map.pm.enableDraw(SHAPES[kind()], { snappable: true, continueDrawing: false, tooltips: false, templineStyle: { color }, hintlineStyle: { color, dashArray: [5, 5] }, pathOptions: { color, fillColor: color, fillOpacity: 0.2 } });
        st.drawing = true;
        setInteractive(false);
        map.getContainer().setAttribute('data-layer-drawing', kind());
        fillBar();
      }
      function finishDraw() {
        const d = map && map.pm && map.pm.Draw ? map.pm.Draw[SHAPES[kind()]] : null;
        if (d && typeof d._finishShape === 'function') d._finishShape();
      }
      function stopDrawing() {
        if (map && map.pm) map.pm.disableDraw();
        if (map) map.getContainer().removeAttribute('data-layer-drawing');
        st.drawing = false;
        if (!st.shape) setInteractive(true);
        fillBar();
      }
      /** A shape drawn: a new feature of the layer, in its own system, chosen when the map is drawn again. */
      async function onCreate(e) {
        const layer = e && e.layer;
        let g = null;
        try { g = layer ? layer.toGeoJSON().geometry : null; } catch (_err) { g = null; }
        if (layer && layer.remove) layer.remove();
        stopDrawing();
        if (!g) return;
        st.pending = await layerNew.addFeature(ds().id, g);
        shell.log(t('layer.draw.added'), 'ok');
        api.changed();
      }

      // ---- a feature's shape and place ----------------------------------------------------------------------
      function editShape(sel, mode) {
        if (!map || !L || !L.PM) throw new Error(t('plan.edit.err.library'));
        stopDrawing();
        st.shape = { rowid: Number(sel.properties._rowid), geometry: sel.geometry, mode };
        setupShape();
        fillBar();
        api.inspector();
      }
      /** The feature being edited drawn above the layer with Geoman's handles: vertices to drag, or the whole feature to move. */
      function setupShape() {
        removeCopy();
        if (!map || !L || !st.shape || !st.shape.geometry) { st.shape = null; return; }
        const color = theme.tokens().accent;
        copy = L.geoJSON(st.shape.geometry, { style: () => ({ color, weight: 3, fillColor: color, fillOpacity: 0.15 }), pointToLayer: (_f, at) => L.circleMarker(at, { radius: 9, color, weight: 3, fillOpacity: 0.3 }) }).addTo(map);
        copy.eachLayer((lyr) => {
          if (!lyr.pm) L.PM.reInitLayer(lyr);
          if (st.shape.mode === 'move') lyr.pm.enableLayerDrag();
          else lyr.pm.enable({ allowSelfIntersection: false, snappable: true, draggable: false });
        });
        setInteractive(false);
        map.getContainer().setAttribute('data-layer-edit-shape', st.shape.mode);
      }
      function removeCopy() {
        if (copy) { copy.eachLayer((lyr) => { try { if (lyr.pm) { lyr.pm.disable(); if (lyr.pm.disableLayerDrag) lyr.pm.disableLayerDrag(); } } catch (_e) { /* already off */ } }); if (map) map.removeLayer(copy); }
        copy = null;
        if (map) map.getContainer().removeAttribute('data-layer-edit-shape');
      }
      function dropShape() { removeCopy(); st.shape = null; setInteractive(true); }
      async function saveShape() {
        if (!copy || !st.shape) return;
        const geometry = planEditUi.combine(copy.toGeoJSON().features.map((f) => f.geometry));
        const rowid = st.shape.rowid;
        dropShape();
        await layerNew.setGeometry(ds().id, rowid, geometry);
        st.pending = rowid;
        ui.toast.show(t('plan.edit.shape.saved'), { kind: 'ok' });
        api.changed();
      }

      /**
       * The chosen feature in drawing mode: its values to change, its shape and place, and *Ta bort*; null outside drawing mode
       * (the view then shows its values as before). @param {any} sel the map view's choice
       */
      function inspector(sel) {
        if (!st.editing || !available() || !sel || !sel.properties || sel.properties._rowid === undefined) return null;
        const rowid = Number(sel.properties._rowid);
        const props = sel.properties;
        const box = h('div', { class: 'dm-stack-sm', 'data-layer-feature': String(rowid) });
        datasets.columns(ds().id).then((cols) => {
          const own = cols.filter((c) => c.name !== layerNew.GEOMETRY);
          const inputs = own.map((c) => { const el = /** @type {any} */ (h('dm-input', { label: c.label || c.name, 'data-layer-value': c.name })); el.value = props[c.name] === null || props[c.name] === undefined ? '' : String(props[c.name]); return { c, el }; });
          const save = own.length ? basic.button({ label: t('common.save'), icon: 'save', variant: 'primary', size: 'sm', title: t('layer.draw.values.save.hint'), 'data-layer-values-save': '', onClick: guard(async () => {
            for (const { c, el } of inputs) {
              const was = props[c.name] === null || props[c.name] === undefined ? '' : String(props[c.name]);
              if (String(el.value) !== was) await recipes.apply(ds().id, 'edit_cell', { rowid, column: c.name, value: el.value });
            }
            await datasets.flushSaves();
            st.pending = rowid;
            ui.toast.show(t('layer.draw.values.saved'), { kind: 'ok' });
            api.changed();
          }) }) : null;
          const mine = st.shape && st.shape.rowid === rowid;
          const shapeButtons = mine
            ? [basic.button({ label: t('plan.edit.shape.save'), icon: 'check', size: 'sm', 'data-layer-shape-save': '', onClick: guard(saveShape) }),
              basic.button({ label: t('common.cancel'), icon: 'x', size: 'sm', variant: 'ghost', 'data-layer-shape-cancel': '', onClick: () => { dropShape(); fillBar(); api.inspector(); } })]
            : [kind() !== 'point' ? basic.button({ label: t('plan.edit.shape.edit'), icon: 'pencil', size: 'sm', title: t('plan.edit.shape.edit.hint'), disabled: st.drawing ? true : null, 'data-layer-shape-edit': 'vertices', onClick: guard(() => editShape(sel, 'vertices')) }) : null,
              basic.button({ label: t('plan.edit.shape.move'), icon: 'arrow-right-left', size: 'sm', title: t('plan.edit.shape.move.hint'), disabled: st.drawing ? true : null, 'data-layer-shape-edit': 'move', onClick: guard(() => editShape(sel, 'move')) })];
          const remove = basic.button({ label: t('layer.draw.delete'), icon: 'trash-2', size: 'sm', variant: 'danger', title: t('layer.draw.delete.hint'), 'data-layer-delete': '', onClick: guard(async () => {
            if (!(await ui.dialog.confirm(t('layer.draw.delete.confirm'), { okLabel: t('common.delete'), danger: true }))) return;
            if (st.shape && st.shape.rowid === rowid) dropShape();
            await layerNew.deleteFeature(ds().id, rowid);
            api.select(null);
            ui.toast.show(t('layer.draw.deleted'), { kind: 'ok' });
            api.changed();
          }) });
          replace(box, ...inputs.map((x) => x.el), save ? h('div', { class: 'dm-row-wrap' }, save) : null, h('div', { class: 'dm-row-wrap' }, ...shapeButtons, remove));
        }).catch((err) => replace(box, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })));
        return box;
      }

      function destroy() { stopDrawing(); removeCopy(); map = null; handle = null; barEl = null; }
      return { buttons, bar, mapDrawn, inspector, destroy, begin, start, stop, state: st, get editing() { return st.editing && available(); }, get copy() { return copy; } };
    }
    return { create };
  });
})();
