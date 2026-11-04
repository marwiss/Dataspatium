// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Map charts in Visualisera: layers from datasets with geometry or coordinates and from the bundled boundaries,
 * colours by category or class, labels, a background map after consent, the saved view; the live map on the right
 * with a click showing a feature's attributes in the inspector. Export and thumbnails are drawn headless by
 * viz/leaflet (no tiles).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/map-panel', ['ui/base', 'ui/basic', 'viz/leaflet', 'data/datasets', 'data/boundaries', 'data/kinds'], (base, basic, leaflet, datasets, boundaries, kinds) => {
    const { h, t, i18n, replace } = base;
    const MODES = ['none', 'category', 'graduated'];

    function select(label, opts, value, onChange, attrs = {}) {
      const el = /** @type {any} */ (h('dm-select', Object.assign({ label }, attrs)));
      el.options = opts; el.value = value;
      el.addEventListener('change', () => onChange(el.value));
      return el;
    }
    function toggle(label, checked, onChange) {
      const el = /** @type {any} */ (h('dm-switch', { label }));
      el.checked = checked;
      el.addEventListener('change', () => onChange(el.checked));
      return el;
    }
    function input(label, value, onChange, attrs = {}) {
      const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs)));
      el.value = value === null || value === undefined ? '' : String(value);
      el.addEventListener('change', () => onChange(el.value));
      return el;
    }
    const numeric = (c) => c.type === 'integer' || c.type === 'number';

    /**
     * @param {{chart: any, columns: any[], onChange: (def: any) => void, log: Function, onInspect?: () => void}} options
     */
    function create(options) {
      const { chart } = options;
      if (!chart.map) chart.map = leaflet.defaultMap(options.columns, { id: chart.datasetId, name: chart.datasetName, shortName: chart.datasetShort });
      const def = chart.map;
      if (!def.custom) def.custom = { url: '', attribution: '' };
      if (!def.wms) def.wms = { url: '', layers: '', format: 'image/png', transparent: false, attribution: '' };
      const el = h('div', { class: 'dm-viz-layout' });
      const side = h('div', { class: 'dm-viz-side dm-stack' });
      const preview = h('div', { class: 'dm-chart-preview dm-map-preview' });
      const info = h('p', { class: 'dm-help' });
      const main = h('div', { class: 'dm-viz-main' }, preview, info);
      replace(el, side, main);
      let handle = null; let seq = 0; let timer = 0; let selected = null; let legend = [];
      /** @type {Map<string, Promise<any[]>>} */
      const colsCache = new Map();
      const columnsOf = (id) => { if (!colsCache.has(id)) colsCache.set(id, datasets.columns(id).catch(() => [])); return colsCache.get(id); };
      let allDatasets = [];
      datasets.list().then((list) => { allDatasets = list; renderSide(); }).catch(() => {});

      const changed = (redraw = true) => { options.onChange(def); if (redraw) schedule(); };
      function schedule(delay = 300) { clearTimeout(timer); timer = setTimeout(draw, delay); }
      async function draw() {
        const my = ++seq;
        if (handle) { handle.finalize(); handle = null; }
        preview.replaceChildren();
        preview.classList.add('dm-rendering');
        try {
          const hd = await leaflet.render(preview, chart, { onSelect: (sel) => { selected = sel; if (options.onInspect) options.onInspect(); } });
          if (my !== seq) { hd.finalize(); return; }
          handle = hd; legend = hd.legend;
          const parts = [t('viz.rows.used', { rows: i18n.formatNumber(hd.info.rows), total: i18n.formatNumber(hd.info.total) })];
          if (hd.info.truncated) parts.push(t('map.truncated', { n: i18n.formatNumber(Math.max(...def.layers.map((l) => l.maxRows || leaflet.MAX_ROWS))) }));
          if (hd.info.basemapDenied) parts.push(t('map.basemap.denied'));
          info.textContent = parts.join(' · ');
          if (options.onInspect) options.onInspect();
        } catch (err) {
          if (my !== seq) return;
          replace(preview, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          options.log('Karta: ' + ((err && err.message) || err), 'error');
        } finally { preview.classList.remove('dm-rendering'); }
      }

      // ---- side: general settings, layers, add ----
      function renderSide() { replace(side, generalCard(), layersCard(), addCard()); }
      function generalCard() {
        const items = [
          select(t('map.basemap'), leaflet.BASEMAPS.map((b) => ({ value: b, label: t('map.basemap.' + b) })), def.basemap || 'none', (v) => { def.basemap = v; renderSide(); changed(); }),
        ];
        if (def.basemap === 'custom') {
          items.push(input(t('map.custom.url'), def.custom.url, (v) => { def.custom.url = v.trim(); changed(); }, { placeholder: 'https://…/{z}/{x}/{y}.png', help: t('map.custom.url.help') }));
          items.push(input(t('map.custom.attribution'), def.custom.attribution, (v) => { def.custom.attribution = v.trim(); changed(); }));
        }
        if (def.basemap === 'wms') items.push(wmsFields(def.wms, () => changed()));
        items.push(toggle(t('map.legend'), def.legend !== false, (v) => { def.legend = v; changed(); }));
        items.push(input(t('map.height'), def.height || 480, (v) => { def.height = Math.max(200, Number(v) || 480); changed(); }, { type: 'number', min: '200', max: '2000', step: '20' }));
        items.push(h('div', { class: 'dm-row-wrap' },
          basic.button({ label: t('map.view.save'), icon: 'save', size: 'sm', title: t('map.view.save.hint'), onClick: () => { if (handle) { def.view = handle.view(); changed(false); options.log(t('map.view.saved'), 'ok'); renderSide(); } } }),
          def.view ? basic.button({ label: t('map.view.reset'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { def.view = null; changed(); renderSide(); } }) : null,
          basic.button({ label: t('map.fit'), icon: 'scan-line', size: 'sm', variant: 'ghost', onClick: () => { if (handle) handle.fit(); } })));
        return h('div', { class: 'dm-card dm-stack-sm' }, h('strong', { text: t('map.settings') }), items);
      }
      /** Fields of a WMS definition (background map or overlay): address, layer (typed or picked from the capabilities), format, transparency, attribution. */
      function wmsFields(w, onChange) {
        const picked = h('div');
        const layersInput = input(t('map.wms.layers'), w.layers, (v) => { w.layers = v.trim(); onChange(); }, { help: t('map.wms.layers.help') });
        const read = basic.button({ label: t('map.wms.read'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', title: t('map.wms.read.hint'), onClick: async () => {
          if (!w.url) return;
          read.setAttribute('loading', '');
          try {
            const list = await leaflet.wmsLayers(w.url);
            const sel = select(t('map.wms.pick'), list.map((l) => ({ value: l.id, label: l.name !== l.id ? `${l.name} (${l.id})` : l.id })), list.some((l) => l.id === w.layers) ? w.layers : list[0].id, (v) => { w.layers = v; layersInput.value = v; onChange(); });
            replace(picked, sel);
            if (!w.layers) { w.layers = list[0].id; layersInput.value = w.layers; onChange(); }
          } catch (err) {
            replace(picked, h('p', { class: 'dm-error dm-xs', text: String((err && err.message) || err) }));
            options.log('WMS: ' + ((err && err.message) || err), 'error');
          }
          read.removeAttribute('loading');
        } });
        return h('div', { class: 'dm-stack-sm dm-map-wms' },
          input(t('map.wms.url'), w.url, (v) => { w.url = v.trim(); onChange(); }, { placeholder: 'https://…/wms', help: t('map.wms.url.help') }),
          h('div', { class: 'dm-row-end' }, layersInput, read),
          picked,
          h('div', { class: 'dm-row-wrap' },
            select(t('map.wms.format'), [{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPEG' }], w.format || 'image/png', (v) => { w.format = v; onChange(); }),
            toggle(t('map.wms.transparent'), !!w.transparent, (v) => { w.transparent = v; onChange(); })),
          input(t('map.custom.attribution'), w.attribution || '', (v) => { w.attribution = v.trim(); onChange(); }));
      }
      function layersCard() {
        const body = h('div', { class: 'dm-stack-sm' });
        // The topmost layer first in the list (Leaflet draws the array in order, so the last one is on top).
        const ordered = def.layers.slice().reverse();
        if (!ordered.length) body.appendChild(h('p', { class: 'dm-help', text: t('map.layers.none') }));
        for (const layer of ordered) body.appendChild(layerCard(layer));
        return h('div', { class: 'dm-card dm-stack-sm' }, h('strong', { text: t('map.layers') }), body);
      }
      function layerCard(layer) {
        const index = def.layers.indexOf(layer);
        const details = h('details', { class: 'dm-more dm-map-layer', open: def.layers.length <= 2 ? true : null });
        const head = h('summary', null, h('span', { class: 'dm-map-layer-swatch', style: { background: (layer.style && (layer.style.fillColor || layer.style.color)) || '' } }), h('span', { class: 'dm-truncate', text: layer.name || layer.datasetName || layer.boundary }));
        const fields = h('div', { class: 'dm-stack-sm' });
        details.append(head, fields);
        fields.appendChild(h('div', { class: 'dm-row-wrap' },
          toggle(t('map.layer.visible'), layer.visible !== false, (v) => { layer.visible = v; changed(); }),
          basic.button({ label: t('map.layer.up'), icon: 'arrow-up', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index >= def.layers.length - 1, onClick: () => { def.layers.splice(index, 1); def.layers.splice(index + 1, 0, layer); changed(); renderSide(); } }),
          basic.button({ label: t('map.layer.down'), icon: 'arrow-down', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index <= 0, onClick: () => { def.layers.splice(index, 1); def.layers.splice(index - 1, 0, layer); changed(); renderSide(); } }),
          basic.button({ label: t('map.layer.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => { def.layers.splice(index, 1); changed(); renderSide(); } })));
        fields.appendChild(input(t('common.name'), layer.name, (v) => { layer.name = v.trim() || layer.datasetName || ''; changed(); renderSide(); }));
        const st = layer.style || (layer.style = {});
        if (layer.kind === 'wms') {
          fields.appendChild(input(t('map.style.opacity'), st.opacity === undefined ? 0.8 : st.opacity, (v) => { st.opacity = Math.max(0, Math.min(1, Number(v))); changed(); }, { type: 'number', min: '0', max: '1', step: '0.05' }));
          fields.appendChild(wmsFields(layer.wms || (layer.wms = { url: '', layers: '', format: 'image/png', transparent: true, attribution: '' }), () => changed()));
          fields.appendChild(h('p', { class: 'dm-help dm-xs', text: t('map.layer.wms.note') }));
          return details;
        }
        const styleRow = h('div', { class: 'dm-row-wrap' },
          input(t('map.style.color'), st.fillColor || st.color || '#2b6cb0', (v) => { st.fillColor = v; st.color = v; changed(); renderSide(); }, { type: 'color' }),
          input(t('map.style.fillopacity'), st.fillOpacity === undefined ? 0.45 : st.fillOpacity, (v) => { st.fillOpacity = Math.max(0, Math.min(1, Number(v))); changed(); }, { type: 'number', min: '0', max: '1', step: '0.05' }),
          input(t('map.style.weight'), st.weight === undefined ? 1.5 : st.weight, (v) => { st.weight = Math.max(0, Number(v) || 0); changed(); }, { type: 'number', min: '0', max: '10', step: '0.5' }),
          input(t('map.style.radius'), st.radius === undefined ? 6 : st.radius, (v) => { st.radius = Math.max(1, Number(v) || 6); changed(); }, { type: 'number', min: '1', max: '40', step: '1' }));
        fields.appendChild(styleRow);
        if (layer.kind === 'dataset') {
          const holder = h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help dm-xs', text: t('common.loading') }));
          fields.appendChild(holder);
          columnsOf(layer.datasetId).then((cols) => {
            if (!holder.isConnected) return;
            const names = cols.map((c) => ({ value: c.name, label: c.label && c.label !== c.name ? `${c.name} (${c.label})` : c.name }));
            const none = [{ value: '', label: t('map.none') }];
            const by = layer.colorBy || (layer.colorBy = { column: null, mode: 'none' });
            const parts = [];
            if (layer.geometry) parts.push(select(t('viz.channel.geometry'), names.filter((n) => cols.find((c) => c.name === n.value).type === 'text'), layer.geometry, (v) => { layer.geometry = v; changed(); }));
            else {
              const nums = names.filter((n) => numeric(cols.find((c) => c.name === n.value)));
              parts.push(h('div', { class: 'dm-row-wrap' }, select(t('viz.channel.longitude'), nums, layer.lon, (v) => { layer.lon = v; changed(); }), select(t('viz.channel.latitude'), nums, layer.lat, (v) => { layer.lat = v; changed(); })));
            }
            parts.push(h('div', { class: 'dm-row-wrap' },
              select(t('map.colorby'), none.concat(names), by.column || '', (v) => { by.column = v || null; if (!v) by.mode = 'none'; else if (by.mode === 'none') by.mode = numeric(cols.find((c) => c.name === v)) ? 'graduated' : 'category'; changed(); renderSide(); }),
              by.column ? select(t('map.colorby.mode'), MODES.filter((m) => m !== 'none').map((m) => ({ value: m, label: t('map.colorby.' + m) })), by.mode === 'none' ? 'category' : by.mode, (v) => { by.mode = v; changed(); renderSide(); }) : null,
              by.column && by.mode === 'graduated' ? input(t('map.colorby.classes'), by.classes || 5, (v) => { by.classes = Math.max(2, Math.min(9, Number(v) || 5)); changed(); }, { type: 'number', min: '2', max: '9' }) : null));
            parts.push(select(t('map.label'), none.concat(names), layer.label || '', (v) => { layer.label = v || null; changed(); }));
            parts.push(input(t('map.maxrows'), layer.maxRows || leaflet.MAX_ROWS, (v) => { layer.maxRows = Math.max(100, Number(v) || leaflet.MAX_ROWS); changed(); }, { type: 'number', min: '100', step: '1000' }));
            replace(holder, parts);
          });
        } else {
          fields.appendChild(h('p', { class: 'dm-help dm-xs', text: t('map.layer.boundary.note') }));
        }
        return details;
      }
      function addCard() {
        const dsSel = /** @type {any} */ (h('dm-select', { label: t('map.add.dataset') }));
        dsSel.options = allDatasets.filter((d) => { const profile = kinds.of(d); return !kinds.isCollection(d) || profile.files === 'pictures' || d.kind === 'plan'; }).map((d) => ({ value: d.id, label: d.name }));
        dsSel.value = chart.datasetId && dsSel.options.some((o) => o.value === chart.datasetId) ? chart.datasetId : (dsSel.options[0] ? dsSel.options[0].value : '');
        const bSel = /** @type {any} */ (h('dm-select', { label: t('map.add.boundary') }));
        bSel.options = boundaries.BASEMAPS.map((b) => ({ value: b.id, label: t(b.key) }));
        bSel.value = boundaries.BASEMAPS[0].id;
        const wmsInput = /** @type {any} */ (h('dm-input', { label: t('map.add.wms'), placeholder: 'https://…/wms?layers=…', help: t('map.add.wms.help') }));
        const addWms = () => {
          const raw = wmsInput.value.trim();
          if (!raw) return;
          let layersParam = '';
          try { layersParam = new URL(raw).searchParams.get('layers') || ''; } catch (_e) { /* not an address; the layer card reports it */ }
          def.layers.unshift(leaflet.wmsLayer({ url: raw, layers: layersParam, transparent: true }, layersParam || t('map.layer.wms')));
          changed(); renderSide();
        };
        wmsInput.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') addWms(); });
        return h('div', { class: 'dm-card dm-stack-sm' }, h('strong', { text: t('map.add') }),
          h('div', { class: 'dm-row-end' }, wmsInput, basic.button({ label: t('common.add'), icon: 'plus', size: 'sm', onClick: addWms })),
          h('div', { class: 'dm-row-end' }, dsSel, basic.button({ label: t('common.add'), icon: 'plus', size: 'sm', onClick: async () => {
            const ds = allDatasets.find((d) => d.id === dsSel.value);
            if (!ds) return;
            const cols = await columnsOf(ds.id);
            const layer = leaflet.layerFor(cols, ds, def.layers.length);
            if (!layer) { options.log(t('map.err.nogeometry', { name: ds.name }), 'warn'); return; }
            def.layers.push(layer); changed(); renderSide();
          } })),
          h('div', { class: 'dm-row-end' }, bSel, basic.button({ label: t('common.add'), icon: 'plus', size: 'sm', onClick: () => { const layer = leaflet.boundaryLayer(bSel.value); if (layer) { def.layers.unshift(layer); changed(); renderSide(); } } })));
      }

      /** Export; a group (batch) filters every layer that has the column. */
      async function exportBlob(format, opts = {}) {
        const extraFilters = opts.group ? [{ field: opts.group.column, op: '=', value: opts.group.value }] : undefined;
        return leaflet.toBlob(chart, format, { width: Number(opts.width) || 960, height: Number(opts.height) || Math.round((Number(opts.width) || 960) * 0.6), extraFilters, title: chart.name });
      }
      async function thumbnail() { return leaflet.thumbnail(chart).catch(() => chart.thumbnail || null); }
      /** The inspector: the legend and the clicked feature. */
      function inspector() {
        const items = [];
        if (legend.length) {
          items.push(h('h4', { text: t('map.legend') }));
          for (const l of legend) items.push(h('div', { class: 'dm-map-legend-block' }, h('strong', { class: 'dm-small', text: l.name }), h('ul', { class: 'dm-map-legend-list' }, l.entries.slice(0, 24).map((e) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: e.color } }), h('span', { class: 'dm-truncate', text: e.label }))))));
        }
        if (selected) {
          const props = selected.properties || {};
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = Object.keys(props).slice(0, 40).map((k) => ({ label: k, value: props[k] === null || props[k] === undefined ? '' : String(props[k]) }));
          items.push(h('h4', { text: t('map.selected') }), h('p', { class: 'dm-help dm-xs', text: selected.layer ? selected.layer.name : '' }), kv);
        } else items.push(h('p', { class: 'dm-help', text: t('map.help') }));
        return items;
      }

      renderSide();
      schedule(0);
      return { el, exportBlob, thumbnail, inspector, destroy: () => { clearTimeout(timer); seq++; if (handle) handle.finalize(); }, redraw: () => schedule(0) };
    }
    return { create };
  });
})();
