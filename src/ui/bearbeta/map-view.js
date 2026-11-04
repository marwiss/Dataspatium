// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Map view in Bearbeta for tables with a geometry column or coordinate columns: the dataset drawn with Leaflet
 * (zoom and pan, click on a feature shows its attributes in the inspector), an optional background map after
 * consent, and buttons to save the map as a chart for Visualisera and to switch to the table. The dataset itself
 * is always the table; what is done there (filter, correct, remove rows) shows here too.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/map-view', ['ui/base', 'data/datasets', 'viz/leaflet', 'viz/charts'], (base, datasets, leaflet, charts) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, basemap: 'none', selected: null, chart: null };
      let ds = null; let columns = []; let slots = null; let mapEl = null; let handle = null; let seq = 0;

      async function load(dataset) {
        ds = dataset;
        columns = await datasets.columns(dataset.id);
        if (s.id !== dataset.id || !s.chart) {
          s.id = dataset.id; s.selected = null; s.basemap = 'none';
          s.chart = { kind: 'map', name: dataset.name, datasetId: dataset.id, datasetName: dataset.name, datasetShort: dataset.shortName || '', map: leaflet.defaultMap(columns, dataset), options: {} };
        } else {
          // The dataset changed (an edit): the layer keeps its settings, the features are read again.
          s.chart.datasetName = dataset.name; s.chart.name = dataset.name;
        }
        s.chart.map.basemap = s.basemap;
      }

      /**
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target
       */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        await load(dataset);
        if (my !== seq || !slots) return;
        const basemapSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true }));
        basemapSel.options = [{ value: 'none', label: t('map.basemap.none') }, { value: 'osm', label: t('map.basemap.osm') }];
        basemapSel.value = s.basemap;
        basemapSel.addEventListener('change', () => { s.basemap = basemapSel.value; s.chart.map.basemap = s.basemap; draw(); });
        mapEl = h('div', { class: 'dm-map-view dm-center-fill', 'aria-label': t('map.view') });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('map', 20), dataset.name, ' ', h('dm-badge', { text: t('common.rows', { n: i18n.formatNumber(dataset.rowCount || 0) }) })),
            h('div', { class: 'dm-toolbar' }, basemapSel,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('map.fit.hint'), onClick: () => { if (handle) handle.fit(); } }),
              ui.button({ label: t('map.save.chart'), icon: 'save', title: t('map.save.chart.hint'), onClick: saveChart }),
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          mapEl);
        await draw();
        renderInspector();
      }
      async function draw() {
        if (!mapEl || !ds) return;
        const my = ++seq;
        if (handle) { handle.finalize(); handle = null; }
        mapEl.replaceChildren();
        try {
          const hd = await leaflet.render(mapEl, s.chart, { onSelect: (sel) => { s.selected = sel; renderInspector(); } });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          if (hd.info.basemapDenied) ui.toast.show(t('map.basemap.denied'), { kind: 'warn' });
          await showPending();
          renderInspector();
        } catch (err) {
          if (my !== seq) return;
          replace(mapEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log(String((err && err.message) || err), 'error');
        }
      }
      async function saveChart() {
        const name = await ui.dialog.prompt(t('viz.name'), { title: t('map.save.chart'), value: t('map.chart.default', { name: ds.name }) });
        if (!name) return;
        try {
          const record = charts.create('map', ds, name.trim());
          record.map = JSON.parse(JSON.stringify(s.chart.map));
          if (handle) record.map.view = handle.view();
          record.thumbnail = await leaflet.thumbnail(record).catch(() => null);
          const saved = await charts.save(record);
          shell.log(t('viz.saved.toast', { name: saved.name }), 'ok');
          ui.toast.show(t('viz.saved.toast', { name: saved.name }), { kind: 'ok', action: { label: t('map.open.visualisera'), onClick: () => { store.set({ openChartId: saved.id }); shell.activate('visualisera'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function renderInspector() {
        if (!slots) return;
        const items = [];
        const info = handle ? handle.info : null;
        if (info) {
          const kv = /** @type {any} */ (h('dm-kv'));
          const layer = s.chart.map.layers[0] || {};
          kv.items = [
            { label: t('map.features'), value: i18n.formatNumber(info.rows) + (info.truncated ? ` ${t('map.truncated', { n: i18n.formatNumber(layer.maxRows || 0) })}` : '') },
            layer.geometry ? { label: t('viz.channel.geometry'), value: layer.geometry } : { label: t('map.coordinates'), value: `${layer.lon}, ${layer.lat}` },
            { label: t('map.basemap'), value: t('map.basemap.' + (s.basemap || 'none')) },
          ];
          items.push(h('h4', { text: t('map.layer') }), kv);
        }
        if (s.selected) {
          const props = s.selected.properties || {};
          const kv2 = /** @type {any} */ (h('dm-kv'));
          kv2.items = Object.keys(props).slice(0, 40).map((k) => ({ label: k, value: props[k] === null || props[k] === undefined ? '' : String(props[k]) }));
          items.push(h('h4', { text: t('map.selected') }), kv2,
            h('p', { class: 'dm-help dm-small', text: t('map.selected.geometry', { type: s.selected.geometry ? s.selected.geometry.type : '' }) }),
            h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('map.edit.table'), icon: 'table', size: 'sm', title: t('map.edit.table.hint'), onClick: options.onTable })));
        } else items.push(h('p', { class: 'dm-help', text: t('map.help') }));
        replace(slots.right, items);
      }

      /** A search hit: the map goes to the row's place and marks it. */
      async function showPending() {
        const pending = store.get().openMapRow;
        if (!pending || !ds || pending.datasetId !== ds.id || !handle) return;
        store.set({ openMapRow: null });
        const dsHandle = await D.require('data/datasets').ensureOpen(ds.id);
        const leaflet2 = D.require('viz/leaflet');
        const geoMod = D.require('data/geo');
        const name = (c) => '"' + String(c).replace(/"/g, '""') + '"';
        const geometry = leaflet2.geometryColumn(dsHandle.columns);
        const coords = geometry ? null : leaflet2.coordinateColumns(dsHandle.columns);
        const cols = geometry ? name(geometry) : `${name(coords.lon)}, ${name(coords.lat)}`;
        const r = await dsHandle.engine.exec(`select ${cols} from data where rowid = ?`, [Number(pending.rowid)]);
        if (!r[0] || !r[0].values.length || !handle) return;
        const row = r[0].values[0];
        const shape = geometry ? geoMod.parseGeometry(row[0]) : (typeof row[0] === 'number' && typeof row[1] === 'number' ? { type: 'Point', coordinates: [row[0], row[1]] } : null);
        if (!shape) return;
        const L = globalThis.L;
        const place = geoMod.isProjected([shape]) ? geoMod.toWgs84(shape) : shape;
        const color = D.require('viz/theme').tokens().accent;
        const marked = L.geoJSON(place, { style: { color, weight: 4, fillOpacity: 0.1 }, pointToLayer: (_f, at) => L.circleMarker(at, { radius: 9, color, weight: 4, fillOpacity: 0.2 }) }).addTo(handle.map);
        const bounds = marked.getBounds();
        if (bounds.isValid()) handle.map.fitBounds(bounds.pad(0.5), { maxZoom: 15 });
      }

      function destroy() { seq++; if (handle) { handle.finalize(); handle = null; } mapEl = null; slots = null; }
      return { render, destroy, state: s };
    }
    return { create };
  });
})();
