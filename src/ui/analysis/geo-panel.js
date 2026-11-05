// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geo tab in Analysera, shown when the selected dataset has geometry or coordinates: measures, points in polygons,
 * nearest feature, buffers, overlays, dissolve and simplification (analysis/geo.js with Turf). Every result is a
 * table with a geometry column that can be saved as a dataset and opened as a map.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/geo-panel', ['ui/base', 'ui/basic', 'analysis/geo', 'data/datasets', 'viz/leaflet', 'data/boundaries'], (base, basic, geoAnalysis, datasets, leaflet, boundaries) => {
    const { h, t, i18n, replace } = base;
    const TOOLS = ['measure', 'points', 'nearest', 'buffer', 'overlay', 'dissolve', 'simplify'];
    const PREVIEW_ROWS = 2000;

    const select = basic.select;
    function input(label, value, onChange, attrs = {}) {
      const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs)));
      el.value = String(value);
      el.addEventListener('change', () => onChange(el.value));
      return el;
    }

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{rerenderRight?: () => void}} [options]
     */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'measure', other: '', mode: 'count', valueColumn: '', countName: 'antal_punkter', radius: 500, op: 'intersect', column: '', tolerance: 100 };
      /** @type {Map<string, any[]>} */ const colsCache = new Map();
      let mappable = []; let mappableFor = '';
      let fieldsEl = null; let resultEl = null; let seq = 0; let running = false; let last = null;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      async function columnsOf(id) { if (!colsCache.has(id)) colsCache.set(id, await datasets.columns(id).catch(() => [])); return colsCache.get(id); }
      /** Tables, picture collections with positions and plans can all be drawn, so they can all be counted. */
      const readable = (d) => d.kind === 'table' || !d.kind || d.kind === 'images' || d.kind === 'plan';
      async function usable(ds) { return !!ds && readable(ds) && leaflet.mappable(await columnsOf(ds.id)); }
      /** Every table with geometry, for the "other dataset" choices. */
      async function loadMappable() {
        const all = store.get().datasets.filter(readable);
        const key = all.map((d) => d.id + ':' + d.updatedAt).join('|');
        if (key === mappableFor) return mappable;
        const out = [];
        for (const d of all) { colsCache.delete(d.id); if (leaflet.mappable(await columnsOf(d.id))) out.push(d); }
        mappable = out; mappableFor = key;
        return out;
      }

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('map', 20), t('geo.title')));
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('geo.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; last = null; renderFields(); renderResult(); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); renderResult();
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      async function renderFields() {
        if (!fieldsEl) return;
        const my = ++seq;
        const ds = selected();
        const ok = await usable(ds);
        if (my !== seq || !fieldsEl) return;
        if (!ok) { replace(fieldsEl, h('dm-empty-state', { icon: 'map', heading: t('geo.no.dataset'), text: t('geo.intro') })); return; }
        const others = (await loadMappable()).filter((d) => d.id !== ds.id);
        const cols = await columnsOf(ds.id);
        if (my !== seq || !fieldsEl) return;
        const geometryName = leaflet.geometryColumn(cols);
        const names = cols.filter((c) => c.name !== geometryName).map((c) => ({ value: c.name, label: c.name }));
        const nums = cols.filter((c) => (c.type === 'integer' || c.type === 'number') && c.name !== geometryName).map((c) => ({ value: c.name, label: c.name }));
        const otherOpts = others.map((d) => ({ value: d.id, label: d.name }));
        // Counting per area also works against the boundaries that come with the app, so nothing else is needed.
        const areaOpts = otherOpts.concat(boundaries.BASEMAPS.map((b) => ({ value: 'boundary:' + b.id, label: t(b.key) })));
        if (s.tool === 'points' && !areaOpts.some((o) => o.value === s.other)) s.other = 'boundary:' + boundaries.BASEMAPS[0].id;
        else if (s.tool !== 'points' && !others.some((d) => d.id === s.other)) s.other = others[0] ? others[0].id : '';
        const parts = [];
        if (s.tool === 'points') {
          parts.push(select(t('geo.points.areas'), areaOpts, s.other, (v) => { s.other = v; }));
          parts.push(select(t('geo.points.mode'), [{ value: 'count', label: t('geo.points.count') }, { value: 'attach', label: t('geo.points.attach') }], s.mode, (v) => { s.mode = v; renderFields(); }));
          if (s.mode === 'count') {
            parts.push(select(t('geo.points.value'), [{ value: '', label: t('map.none') }].concat(nums), s.valueColumn, (v) => { s.valueColumn = v; }));
            parts.push(input(t('geo.points.countname'), s.countName, (v) => { s.countName = v.trim() || 'antal_punkter'; }));
          }
        } else if (s.tool === 'nearest') {
          parts.push(select(t('geo.nearest.to'), otherOpts, s.other, (v) => { s.other = v; }));
        } else if (s.tool === 'buffer') {
          parts.push(input(t('geo.buffer.radius'), s.radius, (v) => { s.radius = Math.max(1, Number(v) || 500); }, { type: 'number', min: '1', step: '50' }));
        } else if (s.tool === 'overlay') {
          parts.push(select(t('geo.overlay.other'), otherOpts, s.other, (v) => { s.other = v; }));
          parts.push(select(t('geo.overlay.op'), [{ value: 'intersect', label: t('geo.overlay.intersect') }, { value: 'difference', label: t('geo.overlay.difference') }], s.op, (v) => { s.op = v; }));
        } else if (s.tool === 'dissolve') {
          parts.push(select(t('geo.dissolve.column'), [{ value: '', label: t('geo.dissolve.all') }].concat(names), s.column, (v) => { s.column = v; }));
        } else if (s.tool === 'simplify') {
          parts.push(input(t('geo.simplify.tolerance'), s.tolerance, (v) => { s.tolerance = Math.max(1, Number(v) || 100); }, { type: 'number', min: '1', step: '10' }));
        }
        const needsOther = ['points', 'nearest', 'overlay'].includes(s.tool);
        parts.push(ui.button({ label: t('geo.run'), icon: 'play', variant: 'primary', loading: running, disabled: running || (needsOther && !s.other), title: t('geo.run.hint'), onClick: () => run() }));
        replace(fieldsEl, h('p', { class: 'dm-help', text: t('geo.hint.' + s.tool) }), needsOther && s.tool !== 'points' && !others.length ? h('p', { class: 'dm-help dm-small', text: t('geo.no.other') }) : null, h('div', { class: 'dm-tool-fields' }, parts));
      }

      async function run() {
        const ds = selected();
        if (!ds || running) return;
        running = true; renderFields();
        const my = ++seq;
        const progress = /** @type {any} */ (h('dm-progress', { value: '0', label: t('geo.running') }));
        const note = h('p', { class: 'dm-help', text: t('geo.running') });
        replace(resultEl, progress, note);
        const onProgress = (done, total) => { progress.setAttribute('value', String(Math.round(done / Math.max(1, total) * 100))); note.textContent = t('geo.progress', { done: i18n.formatNumber(done), total: i18n.formatNumber(total) }); };
        try {
          await geoAnalysis.ensure();
          const src = await geoAnalysis.featuresOfDataset(ds.id);
          let out;
          if (s.tool === 'measure') out = await geoAnalysis.measure(src, { onProgress });
          else if (s.tool === 'points') { const other = s.other.startsWith('boundary:') ? await geoAnalysis.featuresOfBoundary(s.other.slice('boundary:'.length)) : await geoAnalysis.featuresOfDataset(s.other); out = await geoAnalysis.pointsInPolygons(src, other, { density: true, mode: s.mode, valueColumn: s.valueColumn || null, countName: s.countName, onProgress }); }
          else if (s.tool === 'nearest') { const other = await geoAnalysis.featuresOfDataset(s.other); out = await geoAnalysis.nearest(src, other, { onProgress }); }
          else if (s.tool === 'buffer') out = await geoAnalysis.buffer(src, s.radius, { onProgress });
          else if (s.tool === 'overlay') { const other = await geoAnalysis.featuresOfDataset(s.other); out = await geoAnalysis.overlay(src, other, { op: s.op, onProgress }); }
          else if (s.tool === 'dissolve') out = await geoAnalysis.dissolve(src, s.column || null, { onProgress });
          else out = await geoAnalysis.simplify(src, s.tolerance, { onProgress });
          if (my !== seq) return;
          last = Object.assign(out, { contentKey: contentKey(), source: ds, truncated: src.truncated, note: t('geo.result.note', { rows: i18n.formatNumber(out.rows.length), features: i18n.formatNumber(src.features.length) }) + (out.matched !== undefined ? ' · ' + t('geo.points.matched', { n: i18n.formatNumber(out.matched) }) : '') + (src.truncated ? ' · ' + t('map.truncated', { n: i18n.formatNumber(geoAnalysis.MAX_ROWS) }) : '') });
          renderResult();
        } catch (err) {
          if (my !== seq) return;
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log('Geo: ' + ((err && err.message) || err), 'error');
        } finally { running = false; renderFields(); }
      }

      function renderResult() {
        if (!resultEl) return;
        if (!last) { replace(resultEl, h('p', { class: 'dm-help', text: t('geo.result.empty') })); return; }
        const out = last;
        const table = /** @type {any} */ (h('dm-table'));
        const shown = out.columns.filter((c) => c.name !== 'geometry');
        const idxs = shown.map((c) => out.columns.indexOf(c));
        replace(resultEl,
          h('div', { class: 'dm-row' }, h('span', { class: 'dm-help dm-grow', text: out.note }),
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, title: t('geo.create.hint'), onClick: () => createDataset(out) })),
          h('div', { class: 'dm-table-wrap' }, table));
        requestAnimationFrame(() => { if (table.isConnected) table.setData({ columns: shown.map((c) => ({ key: c.name, label: c.label || c.name, type: c.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count).map((r) => idxs.map((i) => r[i])) }); });
      }
      async function createDataset(out) {
        const ds = out.source;
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: t('geo.dataset.default', { tool: t('geo.tool.' + s.tool), name: ds.name }) });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })), rows: out.rows, description: t('geo.dataset.description', { tool: t('geo.tool.' + s.tool), name: ds.name }), source: { kind: 'derived', from: ds.id, tool: 'geo:' + s.tool, settings: { other: s.other, mode: s.mode, radius: s.radius, op: s.op, column: s.column, tolerance: s.tolerance } } });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok', action: { label: t('geo.open.map'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function inspector() {
        const ds = selected();
        return [h('h4', { text: t('geo.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('geo.about.' + s.tool) }), h('p', { class: 'dm-help dm-xs', text: t('geo.about.turf') }),
          ds ? h('p', { class: 'dm-help', text: t('geo.dataset.about', { name: ds.name, rows: i18n.formatNumber(ds.rowCount || 0) }) }) : null];
      }
      /** What the result on screen was computed from; a save of the same content must not clear it. */
      const contentKey = () => { const ds = selected(); return ds ? `${ds.id}#${datasets.contentMarker(ds.id)}` : ''; };
      function datasetChanged() { mappableFor = ''; if (!(last && last.contentKey === contentKey())) last = null; if (fieldsEl) { renderFields(); renderResult(); } }
      function destroy() { seq++; fieldsEl = null; resultEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s };
    }
    return { create, TOOLS };
  });
})();
