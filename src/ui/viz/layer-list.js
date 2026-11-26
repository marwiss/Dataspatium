// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The layers of a map that has many of them, shared by the plan map (ui/bearbeta/plan-view) and the kind `layers`
 * (ui/bearbeta/layers-view): a symbol per layer (its own colour from the data palette, the mark its geometry gives, a dash or a
 * marker shape where two layers would otherwise look alike), the layers drawn on a Leaflet map, the list that shows and hides
 * them (per file and per layer, with Visa alla, Dölj alla and Visa bara detta, and a filter above twelve layers) and the legend
 * of the layers that show. What the person hid is remembered per dataset, in the session and in the setting that keeps the
 * background maps (ui/viz/basemap-memory). Colours come from the tokens (viz/theme); a layer may bring its own symbol (the plan
 * map's outlines) and colours per row (Boverket's colours, ui/bearbeta/plan-layers), which then go before the layer's own colour.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/layer-list', ['ui/base', 'ui/basic', 'viz/theme', 'ui/viz/basemap-memory'], (base, basic, theme, memory) => {
    const { h, t, i18n, replace } = base;
    /** Above this many layers a filter narrows the list. */
    const FILTER_FROM = 12;
    /** A point layer with more features than this is drawn with circles (on the canvas) rather than marker shapes. */
    const MAX_SHAPED = 1000;
    /** Dash patterns for lines and outlines that would otherwise share a colour; the first is solid. */
    const DASHES = [null, '8 4', '2 4', '10 4 2 4', '1 3'];
    /** Marker shapes for points. */
    const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
    const SVG = 'http://www.w3.org/2000/svg';

    /**
     * @typedef {'polygon'|'line'|'point'} Mark
     * `planMap` draws as a detailed plan's map always has: strokes at full opacity, and points in the stroke's colour and weight.
     * @typedef {{mark: Mark, color: string, fill: string|null, dash: string|null, shape: string, weight: number, fillOpacity: number,
     *   colors?: string[], byRow?: (row: any) => (string|null), planMap?: boolean}} LayerSymbol
     * @typedef {{key: string, group: string, groupLabel: string, label: string, count: number, mark: Mark, title?: string,
     *   symbol?: Partial<LayerSymbol>, categories?: Array<{label: string, color: string}>, rows?: any[]}} LayerInfo
     */

    /**
     * The mark a geometry type gives: 'polygon', 'line' or 'point' (GeoJSON, GeoPackage and Swedish names), or null.
     * @param {any} type @returns {Mark|null}
     */
    function markOf(type) {
      const s = String(type || '').toLowerCase();
      if (/polygon|yta|ytor|surface/.test(s)) return 'polygon';
      if (/line|linje|curve/.test(s)) return 'line';
      if (/point|punkt/.test(s)) return 'point';
      return null;
    }
    /**
     * The mark most of a layer's rows have, from their `geometrityp` or else their geometry; 'polygon' when none says.
     * @param {any[]} rows @param {(row: any) => any} [geometryOf] @returns {Mark}
     */
    function markOfRows(rows, geometryOf) {
      const counts = { polygon: 0, line: 0, point: 0 };
      let parsed = 0;
      for (const r of rows || []) {
        let m = markOf(r && r.geometrityp);
        if (!m && geometryOf && r && r.geometri && parsed < 20) { parsed++; const g = geometryOf(r); m = g ? markOf(g.type) : null; }
        if (m) counts[m]++;
      }
      const best = /** @type {Mark[]} */ (['polygon', 'line', 'point']).sort((a, b) => counts[b] - counts[a])[0];
      return counts[best] ? best : 'polygon';
    }

    const signature = (s) => [s.mark, s.color, s.dash || '', s.mark === 'point' ? s.shape : ''].join('|');
    /**
     * A symbol for every layer: its own colour from the data palette in the layers' order, the mark of its geometry, a dash
     * pattern for a line or outline and a marker shape for points so that no two layers look alike while the variants last. A
     * layer that brings a symbol with a colour keeps it; one that brings only colours per row (`byRow`, for some of its rows)
     * gets its palette colour for the other rows, and its swatch shows that colour beside the first of the rows' colours.
     * @param {LayerInfo[]} layers @returns {Map<string, LayerSymbol>}
     */
    function symbols(layers) {
      const tk = theme.tokens();
      const palette = tk.palette;
      const out = new Map();
      const seen = new Set();
      let n = 0; let points = 0;
      for (const layer of layers || []) {
        const mark = layer.mark || 'polygon';
        const preset = layer.symbol;
        if (preset && preset.color) {
          const own = Object.assign({ mark, color: tk.text, fill: null, dash: null, shape: 'circle', weight: 1.5, fillOpacity: 0.4 }, preset);
          out.set(layer.key, own); seen.add(signature(own));
          continue;
        }
        const color = palette[n % palette.length]; n++;
        /** @type {LayerSymbol} */
        const sym = { mark, color, fill: mark === 'line' ? null : color, dash: null, shape: 'circle', weight: mark === 'line' ? 2.5 : 1.5, fillOpacity: mark === 'polygon' ? 0.3 : 0.9 };
        const start = mark === 'point' ? points++ : 0;
        if (mark === 'point') sym.shape = layer.count > MAX_SHAPED ? 'circle' : SHAPES[start % SHAPES.length];
        for (let v = 1; seen.has(signature(sym)) && v < DASHES.length * SHAPES.length; v++) {
          if (mark === 'point') { if (layer.count > MAX_SHAPED) break; sym.shape = SHAPES[(start + v) % SHAPES.length]; } else sym.dash = DASHES[v % DASHES.length];
        }
        if (preset && preset.byRow) { sym.byRow = preset.byRow; sym.colors = [color].concat((preset.colors || []).filter((c) => c !== color).slice(0, 2)); }
        seen.add(signature(sym));
        out.set(layer.key, sym);
      }
      return out;
    }

    /**
     * The Leaflet path style of a feature of a layer: the symbol's colour, weight and dash, and its fill. A row's own colour
     * (`byRow`) fills an area, and colours the stroke of a line and of an outline (a symbol without fill); a row without one is
     * drawn as the layer. An outline is clicked inside it too, unless the symbol says `edgeOnly` (a plan's boundary, which lies
     * over everything). @param {LayerSymbol & {edgeOnly?: boolean}} sym @param {any} [row] @returns {any}
     */
    function styleOf(sym, row) {
      const own = sym.byRow && row ? sym.byRow(row) : null;
      const outline = sym.mark === 'line' || !(sym.fillOpacity > 0);
      const color = own && outline ? own : sym.color;
      const fill = own && !outline ? own : sym.fill;
      return { color, weight: sym.weight, opacity: sym.planMap ? 1 : 0.95, dashArray: sym.dash || null, fill: sym.mark !== 'line' && (!!fill || !sym.edgeOnly), fillColor: fill || color, fillOpacity: fill ? sym.fillOpacity : 0 };
    }

    const svg = (tag, attrs) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, String(v)); return el; };
    /** A dash pattern scaled to a small swatch. */
    const smallDash = (dash) => (dash ? dash.split(/\s+/).map((x) => Math.max(1, Math.round(Number(x) / 2))).join(' ') : null);
    /** The marker shape's outline in a box of `size`, centred. */
    function shapeOf(shape, size, attrs) {
      const c = size / 2; const r = size * 0.36;
      if (shape === 'square') return svg('rect', Object.assign({ x: c - r, y: c - r, width: 2 * r, height: 2 * r }, attrs));
      if (shape === 'triangle') return svg('polygon', Object.assign({ points: `${c},${c - r * 1.1} ${c + r * 1.05},${c + r * 0.8} ${c - r * 1.05},${c + r * 0.8}` }, attrs));
      if (shape === 'diamond') return svg('polygon', Object.assign({ points: `${c},${c - r * 1.2} ${c + r * 1.2},${c} ${c},${c + r * 1.2} ${c - r * 1.2},${c}` }, attrs));
      return svg('circle', Object.assign({ cx: c, cy: c, r }, attrs));
    }
    /**
     * The swatch of a symbol as a small SVG: a filled square with its outline for areas (stripes of its colours when it has
     * colours per row), a stroke for lines and the marker shape for points. Decorative: the layer's name stands beside it.
     * @param {LayerSymbol} sym @param {number} [size] @returns {SVGSVGElement}
     */
    function swatch(sym, size = 16) {
      const tk = theme.tokens();
      const el = /** @type {SVGSVGElement} */ (svg('svg', { class: 'dm-layer-swatch', width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true', focusable: 'false' }));
      el.setAttribute('data-mark', sym.mark);
      if (sym.mark === 'line') {
        el.appendChild(svg('line', { x1: 1, y1: size / 2, x2: size - 1, y2: size / 2, stroke: sym.color, 'stroke-width': Math.min(3, sym.weight), 'stroke-dasharray': smallDash(sym.dash), 'stroke-linecap': 'butt' }));
        return el;
      }
      if (sym.mark === 'point') {
        el.appendChild(shapeOf(sym.shape, size, { fill: sym.fill || sym.color, stroke: tk.background, 'stroke-width': 1 }));
        return el;
      }
      const inset = 2; const w = size - 2 * inset;
      const colors = Array.isArray(sym.colors) && sym.colors.length ? sym.colors.slice(0, 3) : null;
      if (colors) colors.forEach((c, i) => el.appendChild(svg('rect', { x: inset + (i * w) / colors.length, y: inset, width: w / colors.length, height: w, fill: c, 'fill-opacity': Math.max(0.6, sym.fillOpacity) })));
      el.appendChild(svg('rect', { x: inset, y: inset, width: w, height: w, fill: colors ? 'none' : (sym.fill || 'none'), 'fill-opacity': sym.fill ? Math.max(0.3, sym.fillOpacity) : null, stroke: sym.color, 'stroke-width': Math.min(2, Math.max(1, sym.weight)), 'stroke-dasharray': smallDash(sym.dash) }));
      return el;
    }

    /**
     * A point drawn with its layer's symbol: a circle on the canvas, or the marker shape (a small SVG) for the other shapes, in
     * the row's own colour when the symbol has `byRow` and the row has one.
     * @param {any} L @param {LayerSymbol} sym @param {any} latlng @param {any} [row]
     */
    function pointOf(L, sym, latlng, row) {
      const tk = theme.tokens();
      const own = sym.byRow && row ? sym.byRow(row) : null;
      if (sym.planMap) return L.circleMarker(latlng, { radius: 6, color: sym.color, weight: sym.weight, fillColor: own || sym.fill || sym.color, fillOpacity: Math.max(0.7, sym.fillOpacity) });
      if (sym.mark !== 'point' || sym.shape === 'circle') return L.circleMarker(latlng, { radius: 6, color: sym.mark === 'point' ? tk.background : sym.color, weight: 1, fillColor: own || sym.fill || sym.color, fillOpacity: 0.9 });
      return L.marker(latlng, { icon: L.divIcon({ className: 'dm-layer-marker', html: swatch(own ? Object.assign({}, sym, { fill: own }) : sym, 14), iconSize: [14, 14], iconAnchor: [7, 7] }), keyboard: false });
    }

    /**
     * Draw the layers on a map: one L.geoJSON per layer with features, with its symbol; a hidden layer is made but not added.
     * `rowAt(i)` gives the row a feature came from (`row._i`), `geometryOf(row)` its GeoJSON geometry in WGS 84, and `onClick`
     * is told the row, the Leaflet layer clicked and Leaflet's event (its originalEvent says whether Shift was held).
     * @param {any} L @param {any} map @param {LayerInfo[]} layers @param {Map<string, LayerSymbol>} syms @param {Set<string>} hidden
     * @param {{rowAt: (i: number) => any, geometryOf: (row: any) => any, onClick?: (row: any, lyr: any, e?: any) => void}} options
     * @returns {Array<{key: string, group: any, count: number}>}
     */
    function draw(L, map, layers, syms, hidden, options) {
      const out = [];
      for (const info of layers) {
        const sym = syms.get(info.key);
        if (!sym) continue;
        const features = [];
        for (const row of info.rows || []) {
          const g = row && row.geometri ? options.geometryOf(row) : null;
          if (g && g.type) features.push({ type: 'Feature', geometry: g, properties: { _i: row._i } });
        }
        if (!features.length) continue;
        const rowOf = (f) => options.rowAt(f.properties._i);
        const group = L.geoJSON({ type: 'FeatureCollection', features }, {
          style: (f) => styleOf(sym, rowOf(f)),
          pointToLayer: (f, latlng) => pointOf(L, sym, latlng, rowOf(f)),
          onEachFeature: (f, lyr) => { lyr.on('click', (e) => { if (options.onClick) options.onClick(rowOf(f), lyr, e); }); },
        });
        if (!hidden.has(info.key)) group.addTo(map);
        out.push({ key: info.key, group, count: features.length });
      }
      return out;
    }
    /** Show or hide the drawn layers as `hidden` says. @param {any} map @param {Array<{key: string, group: any}>} drawn @param {Set<string>} hidden */
    function apply(map, drawn, hidden) {
      for (const d of drawn) {
        const on = !hidden.has(d.key);
        if (on && !map.hasLayer(d.group)) d.group.addTo(map);
        if (!on && map.hasLayer(d.group)) map.removeLayer(d.group);
      }
    }
    /**
     * Mark geometries on the map in the accent colour, above the layers and whether or not their layers show; the caller fits
     * the view to the layer's bounds. @param {any} L @param {any} map @param {any[]} geometries @returns {any|null} the layer
     */
    function mark(L, map, geometries) {
      const features = (geometries || []).filter((g) => g && g.type).map((g) => ({ type: 'Feature', properties: {}, geometry: g }));
      if (!features.length) return null;
      const color = theme.tokens().accent;
      return L.geoJSON({ type: 'FeatureCollection', features }, { interactive: false, style: () => ({ color, weight: 4, opacity: 1, fillColor: color, fillOpacity: 0.15 }), pointToLayer: (_f, at) => L.circleMarker(at, { radius: 9, color, weight: 4, fillOpacity: 0.2 }) }).addTo(map);
    }

    /** The layers in groups, in the order the groups first come. @param {LayerInfo[]} layers */
    function groupsOf(layers) {
      const out = [];
      for (const l of layers) {
        let g = out.find((x) => x.id === l.group);
        if (!g) { g = { id: l.group, label: l.groupLabel || l.group, layers: [] }; out.push(g); }
        g.layers.push(l);
      }
      return out;
    }

    /**
     * The list of layers and their legend for one map, kept in step: `list()` and `legend()` build their elements (the latest of
     * each follows every change), the switches change `hidden` and tell `onChange`. All layers show unless `hidden` names them.
     * @param {{layers: LayerInfo[], symbols: Map<string, LayerSymbol>, hidden: Set<string>, onChange: (hidden: Set<string>) => void}} options
     */
    function create(options) {
      const { layers, hidden } = options;
      const syms = options.symbols;
      const groups = groupsOf(layers);
      const st = { filter: '' };
      let listEl = null; let legendEl = null;
      const matches = (l) => { const f = st.filter.trim().toLowerCase(); return !f || [l.label, l.title || '', l.groupLabel || ''].some((x) => String(x).toLowerCase().includes(f)); };
      function changed() { sync(); options.onChange(hidden); }
      /** Show or hide layers by key. @param {string[]} keys @param {boolean} visible */
      function setVisible(keys, visible) { for (const k of keys) { if (visible) hidden.delete(k); else hidden.add(k); } changed(); }
      /** Show only this layer. @param {string} key */
      function only(key) { hidden.clear(); for (const l of layers) if (l.key !== key) hidden.add(l.key); changed(); }
      /** The layers the filter shows (all without a filter). */
      const shown = () => layers.filter(matches).map((l) => l.key);
      const btn = (label, icon, title, attrs, onClick) => basic.button(Object.assign({ label, icon, title, size: 'sm', onClick }, attrs));

      function item(l) {
        const sw = /** @type {any} */ (h('dm-switch', { label: l.label, 'data-layer-switch': l.key }));
        sw.checked = !hidden.has(l.key);
        sw.addEventListener('change', () => setVisible([l.key], sw.checked));
        const sym = syms.get(l.key);
        return h('li', { class: 'dm-layer-item', 'data-layer-key': l.key },
          sym ? swatch(sym) : h('span', { class: 'dm-layer-swatch' }), sw,
          h('span', { class: 'dm-layer-count', text: i18n.formatNumber(l.count) }),
          btn(t('layers.only'), 'eye', t('layers.only.hint', { name: l.label }), { 'icon-only': true, variant: 'ghost', 'data-layer-only': l.key }, () => only(l.key)));
      }
      /** The list: Visa alla and Dölj alla for all (what the filter shows), then per file and per layer. */
      function list() {
        const filter = layers.length > FILTER_FROM ? /** @type {any} */ (h('dm-input', { type: 'search', 'aria-label': t('layers.filter'), placeholder: t('layers.filter'), 'data-layer-filter': '' })) : null;
        const body = h('div', { class: 'dm-layer-groups' }, groups.map((g) => h('section', { class: 'dm-layer-group', 'data-layer-group': g.id },
          groups.length > 1 ? h('div', { class: 'dm-layer-group-head' }, h('h5', { class: 'dm-truncate', text: g.label }),
            btn(t('layers.show.all'), 'eye', t('layers.group.show.hint', { name: g.label }), { 'icon-only': true, variant: 'ghost', 'data-layer-group-show': g.id }, () => setVisible(g.layers.filter(matches).map((l) => l.key), true)),
            btn(t('layers.hide.all'), 'eye-off', t('layers.group.hide.hint', { name: g.label }), { 'icon-only': true, variant: 'ghost', 'data-layer-group-hide': g.id }, () => setVisible(g.layers.filter(matches).map((l) => l.key), false))) : null,
          h('ul', { class: 'dm-layer-items' }, g.layers.map(item)))));
        const el = h('div', { class: 'dm-layer-list', 'data-layer-list': '' },
          filter,
          h('div', { class: 'dm-row-wrap dm-layer-actions' },
            btn(t('layers.show.all'), 'eye', t('layers.show.all.hint'), { 'data-layer-show-all': '' }, () => setVisible(shown(), true)),
            btn(t('layers.hide.all'), 'eye-off', t('layers.hide.all.hint'), { 'data-layer-hide-all': '' }, () => setVisible(shown(), false))),
          body);
        if (filter) {
          filter.value = st.filter;
          filter.addEventListener('input', () => { st.filter = String(filter.value || ''); narrow(el); });
        }
        listEl = el;
        narrow(el);
        return el;
      }
      /** Hide the layers and files that the filter leaves out. */
      function narrow(el) {
        for (const li of Array.from(el.querySelectorAll('.dm-layer-item'))) { const l = layers.find((x) => x.key === li.getAttribute('data-layer-key')); /** @type {HTMLElement} */ (li).hidden = !!l && !matches(l); }
        for (const sec of Array.from(el.querySelectorAll('.dm-layer-group'))) /** @type {HTMLElement} */ (sec).hidden = !sec.querySelector('.dm-layer-item:not([hidden])');
      }
      /** The legend of the layers that show, grouped as the list, with the same swatches (and a layer's colours per category). */
      function legend() {
        const el = h('div', { class: 'dm-layer-legend', 'data-layer-legend': '' });
        fillLegend(el);
        legendEl = el;
        return el;
      }
      function fillLegend(el) {
        const visible = groups.map((g) => ({ g, ls: g.layers.filter((l) => !hidden.has(l.key)) })).filter((x) => x.ls.length);
        if (!visible.length) { replace(el, h('p', { class: 'dm-help dm-small', text: t('layers.legend.none') })); return; }
        replace(el, visible.map(({ g, ls }) => h('div', { class: 'dm-map-legend-block' },
          visible.length > 1 || groups.length > 1 ? h('h5', { class: 'dm-truncate', text: g.label }) : null,
          h('ul', { class: 'dm-map-legend-list' }, ls.map((l) => h('li', { 'data-layer-key': l.key },
            syms.get(l.key) ? swatch(/** @type {LayerSymbol} */ (syms.get(l.key))) : null,
            h('span', { class: 'dm-layer-legend-text' }, h('span', { class: 'dm-truncate', text: l.label }),
              l.categories && l.categories.length ? h('ul', { class: 'dm-map-legend-list dm-layer-legend-categories' }, l.categories.slice(0, 30).map((c) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: c.color } }), h('span', { class: 'dm-truncate', text: c.label })))) : null)))))));
      }
      /** Bring the latest list and legend in step with `hidden`. */
      function sync() {
        if (listEl) for (const sw of Array.from(listEl.querySelectorAll('[data-layer-switch]'))) /** @type {any} */ (sw).checked = !hidden.has(sw.getAttribute('data-layer-switch'));
        if (legendEl) fillLegend(legendEl);
      }
      return { list, legend, setVisible, only, sync, get hidden() { return hidden; }, groups };
    }

    /** The layers hidden on a dataset's map in an earlier visit, or null. @param {string} datasetId @returns {Promise<Set<string>|null>} */
    async function recall(datasetId) {
      const list = await memory.recallLayers(datasetId).catch(() => null);
      return list ? new Set(list) : null;
    }
    /** Remember the layers hidden on a dataset's map. @param {string} datasetId @param {Set<string>} hidden */
    const remember = (datasetId, hidden) => memory.rememberLayers(datasetId, hidden);

    return { FILTER_FROM, MAX_SHAPED, DASHES, SHAPES, markOf, markOfRows, symbols, styleOf, swatch, pointOf, draw, apply, mark, groupsOf, create, recall, remember };
  });
})();
