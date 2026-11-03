// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Vega-Lite builder: chart types with sensible defaults, a builder state (channels, filters, labels,
 * size) and the translation of that state into a Vega-Lite specification. Also decides when the data
 * can be aggregated in SQL instead of in the browser.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/vega-builder', ['viz/locale', 'viz/theme', 'data/geo'], (locale, theme, geo) => {
    const SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json';
    const AGGREGATES = ['none', 'sum', 'mean', 'median', 'min', 'max', 'count', 'distinct'];
    const TIME_UNITS = ['', 'year', 'yearmonth', 'yearquarter', 'month', 'yearmonthdate', 'day', 'hours'];
    const CHART_TYPES = [
      { id: 'bar', label: D.t('viz.charttype.bar'), icon: 'chart-column', mark: 'bar', channels: ['x', 'y', 'color', 'facet'], x: 'category', y: 'measure', aggregate: 'sum' },
      { id: 'barh', label: D.t('viz.charttype.barh'), icon: 'chart-bar-big', mark: 'bar', horizontal: true, channels: ['x', 'y', 'color', 'facet'], x: 'category', y: 'measure', aggregate: 'sum' },
      { id: 'line', label: D.t('viz.charttype.line'), icon: 'chart-line', mark: 'line', channels: ['x', 'y', 'color', 'facet'], x: 'time', y: 'measure', aggregate: 'sum' },
      { id: 'area', label: D.t('viz.charttype.area'), icon: 'chart-area', mark: 'area', channels: ['x', 'y', 'color', 'facet'], x: 'time', y: 'measure', aggregate: 'sum' },
      { id: 'point', label: D.t('viz.charttype.point'), icon: 'chart-scatter', mark: 'point', channels: ['x', 'y', 'color', 'size', 'facet'], x: 'measure', y: 'measure', aggregate: 'none' },
      { id: 'histogram', label: D.t('viz.charttype.histogram'), icon: 'chart-column', mark: 'bar', channels: ['x', 'color', 'facet'], x: 'measure', y: 'count', aggregate: 'count' },
      { id: 'heatmap', label: D.t('viz.charttype.heatmap'), icon: 'grid-2x2', mark: 'rect', channels: ['x', 'y', 'color'], x: 'category', y: 'category', aggregate: 'sum' },
      { id: 'boxplot', label: D.t('viz.charttype.boxplot'), icon: 'chart-candlestick', mark: 'boxplot', channels: ['x', 'y', 'color'], x: 'category', y: 'measure', aggregate: 'none' },
      { id: 'pie', label: D.t('viz.charttype.pie'), icon: 'chart-pie', mark: 'arc', channels: ['x', 'y'], x: 'category', y: 'measure', aggregate: 'sum' },
      // Choropleth map: x holds the geometry column (GeoJSON or WKT text), y a label, color the value.
      { id: 'map', label: D.t('viz.charttype.map'), icon: 'globe', mark: 'geoshape', geo: true, channels: ['x', 'y', 'color'], x: 'geometry', y: 'label', aggregate: 'none' },
      // Point map: x/y hold longitude/latitude (or SWEREF 99 TM metres), size and color values, facet a
      // label for the tooltip; drawn over the bundled county or municipality boundaries (state.basemap).
      { id: 'pointmap', label: D.t('viz.charttype.pointmap'), icon: 'map-pin', mark: 'circle', geo: true, points: true, channels: ['x', 'y', 'color', 'size', 'facet'], x: 'longitude', y: 'latitude', aggregate: 'none' },
    ];
    // Longitude span within which the SWEREF 99 TM-like transverse Mercator about 15°E looks right.
    const TM_LON_RANGE = [-25, 55];

    function fieldType(column) {
      if (!column) return 'nominal';
      if (column.type === 'integer' || column.type === 'number') return 'quantitative';
      if (column.type === 'date' || column.type === 'datetime') return 'temporal';
      return 'nominal';
    }
    function typeOf(id) { return CHART_TYPES.find((c) => c.id === id) || CHART_TYPES[0]; }
    function channel(column, overrides) { return column ? Object.assign({ field: column.name, type: fieldType(column), aggregate: 'none', bin: false, timeUnit: '', sort: '', title: '', format: '' }, overrides || {}) : null; }

    /** Pick a first column of a kind: category (text/boolean), measure (numeric), time (date), geometry, label, longitude, latitude, any. */
    function pick(columns, kind, used = []) {
      const free = columns.filter((c) => !used.includes(c.name));
      const by = (pred) => free.find(pred) || columns.find(pred) || null;
      const numeric = (c) => c.type === 'integer' || c.type === 'number';
      const yearLike = (c) => /^(ar|år|year|period|manad|månad|vecka|kvartal)$/i.test(c.name);
      const idLike = (c) => /^(fid|id|rowid|objectid|gid|ogc_fid)$/i.test(c.name);
      const codeLike = (c) => /kod$|code$|_id$|^id$|nr$/i.test(c.name);
      if (kind === 'measure') return by((c) => numeric(c) && !yearLike(c) && !idLike(c)) || by((c) => numeric(c) && !yearLike(c)) || by(numeric);
      if (kind === 'time') return by((c) => c.type === 'date' || c.type === 'datetime') || by((c) => /^(ar|år|year|tid|period|manad|månad)$/i.test(c.name)) || by((c) => c.type === 'text');
      if (kind === 'category') return by((c) => c.type === 'text' || c.type === 'boolean') || by((c) => c.type === 'integer');
      if (kind === 'geometry') return by((c) => c.type === 'text' && /^(geometry|geom|wkt|shape|the_geom|geometri)$/i.test(c.name)) || by((c) => c.type === 'text' && /geom|wkt/i.test(c.name));
      // Labels: a name column first (kommun before kommunkod), then any text column that is not a code or geometry.
      if (kind === 'label') return by((c) => c.type === 'text' && /^(namn|name|kommun|kommunnamn|lan|län|lansnamn|länsnamn|region|regionnamn|omrade|område|station|stationsnamn|plats|ort)$/i.test(c.name)) || by((c) => c.type === 'text' && !codeLike(c) && /namn|name|kommun|region|lan|län|omrade|område|station|plats|ort/i.test(c.name)) || by((c) => c.type === 'text' && !codeLike(c) && !/geom|wkt|shape/i.test(c.name)) || by((c) => c.type === 'text' && !/geom|wkt|shape/i.test(c.name));
      if (kind === 'longitude') return by((c) => numeric(c) && /^(lon|long|lng|longitude|longitud|x|e|east|easting|ost|öst|x_koord|xkoord|lon_wgs84|longitude_wgs84)$/i.test(c.name)) || by((c) => numeric(c) && /lon|long|east|öst|ost/i.test(c.name) && !/lat/i.test(c.name));
      if (kind === 'latitude') return by((c) => numeric(c) && /^(lat|latitude|latitud|y|n|north|northing|nord|y_koord|ykoord|lat_wgs84|latitude_wgs84)$/i.test(c.name)) || by((c) => numeric(c) && /lat|north|nord/i.test(c.name));
      return free[0] || columns[0] || null;
    }

    /** Fresh builder state for a chart type and a dataset's columns. */
    function defaultState(typeId, columns) {
      const type = typeOf(typeId);
      const x = pick(columns, type.x);
      const state = {
        type: type.id, x: channel(x), y: null, color: null, size: null, facet: null, facetColumns: 3,
        stack: 'zero', labels: false, points: false, interpolate: 'linear', title: '', subtitle: '', width: 0, height: 360, legend: 'right', colorScheme: 'auto', maxRows: 50000, filters: [], yFormat: '', xFormat: '',
      };
      if (type.geo) {
        if (type.points) {
          const y = pick(columns, 'latitude', x ? [x.name] : []);
          state.y = channel(y);
          const used = [x && x.name, y && y.name].filter(Boolean);
          const size = pick(columns, 'measure', used);
          state.size = size && !used.includes(size.name) ? channel(size, { aggregate: 'none' }) : null;
          state.facet = channel(pick(columns, 'label'));
          state.basemap = 'lan';
          state.height = 480;
          return state;
        }
        state.y = channel(pick(columns, 'label', x ? [x.name] : []));
        state.color = channel(pick(columns, 'measure'), { aggregate: 'none' });
        state.height = 480;
        return state;
      }
      if (type.y === 'count') state.y = { field: null, type: 'quantitative', aggregate: 'count', bin: false, timeUnit: '', sort: '', title: '', format: '' };
      else state.y = channel(pick(columns, type.y, x ? [x.name] : []), { aggregate: type.aggregate });
      if (type.id === 'histogram' && state.x) { state.x.bin = true; }
      if (type.id === 'heatmap') { state.y = channel(pick(columns, 'category', x ? [x.name] : [])); state.color = channel(pick(columns, 'measure'), { aggregate: 'sum' }); }
      if (type.id === 'line' && state.x && state.x.type === 'quantitative' && /^(ar|år|year)$/i.test(state.x.field)) state.x.type = 'ordinal';
      return state;
    }

    /** Change chart type while keeping compatible channels. */
    function switchType(state, typeId, columns) {
      const next = defaultState(typeId, columns);
      const from = typeOf(state.type); const to = typeOf(typeId);
      for (const key of ['x', 'y', 'color', 'facet', 'size']) {
        // Maps give x, y and facet other meanings (geometry, coordinates, label), so those start fresh.
        if ((from.geo || to.geo) && from.id !== to.id && (key === 'x' || key === 'y' || key === 'facet')) continue;
        if (state[key] && to.channels.includes(key) && columns.some((c) => c.name === state[key].field)) next[key] = Object.assign({}, state[key]);
      }
      if (typeId === 'histogram') { next.y = { field: null, type: 'quantitative', aggregate: 'count', bin: false, timeUnit: '', sort: '', title: '', format: '' }; if (next.x) next.x.bin = true; }
      for (const key of ['title', 'subtitle', 'filters', 'width', 'height', 'legend', 'maxRows', 'stack']) next[key] = state[key];
      return next;
    }

    function isAggregated(ch) { return !!(ch && ch.aggregate && ch.aggregate !== 'none'); }
    function needsRawRows(state) {
      const type = typeOf(state.type);
      if (type.geo) return true;
      if (type.mark === 'boxplot' || type.mark === 'point') return true;
      const chans = ['x', 'y', 'color', 'size', 'facet'].map((k) => state[k]).filter(Boolean);
      if (chans.some((c) => c.bin || c.timeUnit)) return true;
      if (chans.some((c) => c.aggregate === 'median')) return true;
      const measures = chans.filter((c) => c.type === 'quantitative' && c.field);
      return !measures.length || measures.some((c) => !isAggregated(c));
    }

    /**
     * Data request for viz/data. Aggregates in SQL when the chart only needs aggregated measures and
     * the dataset is larger than maxRows.
     */
    function dataRequest(state, columns, total) {
      const fields = Array.from(new Set(['x', 'y', 'color', 'size', 'facet'].map((k) => state[k] && state[k].field).filter(Boolean)));
      const base = { filters: state.filters || [], limit: state.maxRows || 50000 };
      if (total <= (state.maxRows || 50000) || needsRawRows(state)) return Object.assign(base, { fields });
      const groupBy = []; const aggregates = []; const aliases = {};
      for (const key of ['x', 'y', 'color', 'size', 'facet']) {
        const ch = state[key];
        if (!ch) continue;
        if (isAggregated(ch)) { const as = ch.aggregate === 'count' && !ch.field ? 'antal' : `${ch.aggregate}_${ch.field}`; aggregates.push({ field: ch.field, fn: ch.aggregate, as }); aliases[key] = as; }
        else if (ch.field && !groupBy.includes(ch.field)) groupBy.push(ch.field);
      }
      return Object.assign(base, { groupBy, aggregates, aliases });
    }

    function encode(ch, options = {}) {
      if (!ch) return null;
      const out = { type: ch.type };
      if (ch.field) out.field = ch.field;
      if (options.alias) { out.field = options.alias; }
      else if (isAggregated(ch)) out.aggregate = ch.aggregate === 'mean' ? 'mean' : ch.aggregate;
      if (ch.aggregate === 'count' && !ch.field && !options.alias) { delete out.field; out.aggregate = 'count'; }
      if (ch.bin) out.bin = typeof ch.bin === 'object' ? ch.bin : { maxbins: 30 };
      if (ch.timeUnit && ch.type === 'temporal') out.timeUnit = ch.timeUnit;
      if (ch.sort) out.sort = ch.sort;
      // Swedish axis titles instead of Vega-Lite's "Sum of x" / "x (binned)".
      const title = ch.title || (isAggregated(ch) ? aggregateTitle(ch) : (ch.bin ? ch.field : undefined));
      if (title) out.title = title;
      if (ch.format) out.axis = Object.assign(out.axis || {}, { format: ch.format });
      return out;
    }
    function aggregateTitle(ch) {
      const names = Object.fromEntries(['sum', 'mean', 'median', 'min', 'max', 'count', 'distinct'].map((a) => [a, D.t('viz.aggname.' + a)]));
      return ch.field ? `${names[ch.aggregate] || ch.aggregate} ${ch.field}` : (names[ch.aggregate] || ch.aggregate);
    }

    /**
     * Projection for longitude/latitude data: transverse Mercator about 15°E (the look of SWEREF 99 TM
     * maps) when the data lies within Europe, Mercator elsewhere.
     * @param {{minX: number, maxX: number}|null} b bounds of the data in degrees
     */
    function lonLatProjection(b) {
      if (!b || (b.minX >= TM_LON_RANGE[0] && b.maxX <= TM_LON_RANGE[1])) return { type: 'transverseMercator', rotate: [-15, 0, 0] };
      return { type: 'mercator' };
    }

    /** Id of the bundled boundary layer a state draws under its points, or null. */
    function basemapOf(state) {
      const type = typeOf(state && state.type);
      return type.points && state.basemap && state.basemap !== 'none' ? state.basemap : null;
    }

    /**
     * Geometry as a GeoJSON Feature. Vega fits the projection with its geojson transform, which expects
     * Feature objects; bare geometries draw but leave the fit empty (every path becomes NaN).
     */
    function feature(geometry) { return geometry && geometry.type === 'Feature' ? geometry : { type: 'Feature', properties: {}, geometry }; }

    /** Layered spec for a point map: bundled boundaries underneath, one circle per row on top. */
    function pointMapSpec(state, data, spec) {
      const tokens = theme.tokens();
      const lonField = state.x && state.x.field; const latField = state.y && state.y.field;
      const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
      let values = null; let b = null;
      if (data.values) {
        const rows = lonField && latField ? data.values.filter((r) => Number.isFinite(num(r[lonField])) && Number.isFinite(num(r[latField]))) : [];
        // Metres (SWEREF 99 TM) become degrees so that the points and the boundaries share one projection.
        const projected = rows.some((r) => Math.abs(num(r[lonField])) > 180 || Math.abs(num(r[latField])) > 90);
        values = rows.map((r) => { let lon = num(r[lonField]); let lat = num(r[latField]); if (projected) [lon, lat] = geo.swerefToWgs84(lon, lat); return Object.assign({}, r, { __lon: lon, __lat: lat }); });
        b = geo.bounds(values.map((v) => ({ coordinates: [v.__lon, v.__lat] })));
      }
      const layers = [];
      const basemap = data.basemap || [];
      if (basemap.length) layers.push({ data: { values: basemap.map((f) => ({ geometry: feature(f.geometry), namn: f.name })) }, mark: { type: 'geoshape', fill: tokens.grid, stroke: tokens.background, strokeWidth: 0.8 }, encoding: { shape: { field: 'geometry', type: 'geojson' }, tooltip: [{ field: 'namn', type: 'nominal', title: D.t('viz.tooltip.area') }] } });
      const enc = { longitude: { field: '__lon', type: 'quantitative' }, latitude: { field: '__lat', type: 'quantitative' } };
      const legend = state.legend === 'none' ? null : { orient: state.legend || 'right' };
      const numberFormat = state.yFormat ? { format: state.yFormat } : {};
      if (state.size && state.size.field) enc.size = { field: state.size.field, type: 'quantitative', title: state.size.title || state.size.field, scale: { range: [16, 900], zero: true }, legend: legend ? Object.assign({}, legend, numberFormat) : null };
      if (state.color && state.color.field) {
        const color = { field: state.color.field, type: state.color.type, title: state.color.title || state.color.field, legend: legend ? Object.assign({}, legend, state.color.type === 'quantitative' ? numberFormat : {}) : null };
        if (color.type === 'quantitative' || state.colorScheme === 'sequential') color.scale = { scheme: 'dataspatium-seq' };
        if (state.colorScheme === 'diverging') color.scale = { scheme: 'dataspatium-div' };
        enc.color = color;
      }
      const tips = [];
      if (state.facet && state.facet.field) tips.push({ field: state.facet.field, type: 'nominal', title: state.facet.title || state.facet.field });
      for (const key of ['color', 'size']) {
        const ch = state[key];
        if (ch && ch.field && !tips.some((tp) => tp.field === ch.field)) tips.push(Object.assign({ field: ch.field, type: ch.type, title: ch.title || ch.field }, ch.type === 'quantitative' ? numberFormat : {}));
      }
      if (tips.length) enc.tooltip = tips;
      const pointLayer = { mark: { type: 'circle', opacity: 0.85, stroke: tokens.background, strokeWidth: 0.5, size: 60 }, encoding: enc };
      if (values) pointLayer.data = { values };
      else pointLayer.transform = [{ calculate: `toNumber(datum[${JSON.stringify(lonField || '')}])`, as: '__lon' }, { calculate: `toNumber(datum[${JSON.stringify(latField || '')}])`, as: '__lat' }];
      layers.push(pointLayer);
      spec.layer = layers;
      if (values) delete spec.data;
      spec.height = data.height !== undefined ? data.height : (state.height || 480);
      spec.projection = lonLatProjection(b);
      return spec;
    }

    /**
     * Vega-Lite spec from a builder state.
     * @param {any} state @param {Array<{name: string, type: string}>} columns
     * @param {{values?: any[], name?: string, aliases?: Record<string, string>, width?: number, height?: number, basemap?: any[]}} [data]
     */
    function toSpec(state, columns, data = {}) {
      const type = typeOf(state.type);
      const aliases = data.aliases || {};
      const spec = { $schema: SCHEMA, data: data.values ? { values: data.values } : { name: data.name || 'table' }, width: data.width !== undefined ? data.width : (state.width > 0 ? state.width : 'container'), height: data.height !== undefined ? data.height : (state.height || 360) };
      if (state.title) spec.title = state.subtitle ? { text: state.title, subtitle: state.subtitle } : state.title;
      const enc = {};
      if (type.geo && type.points) return pointMapSpec(state, data, spec);
      if (type.geo) {
        // Geometry arrives as GeoJSON or WKT text; parse it into Features and let Vega-Lite draw them with
        // geoshape. Projected coordinates (SWEREF99 TM metres) are drawn as-is, longitude/latitude through
        // a transverse Mercator.
        const geomField = state.x && state.x.field;
        const geometries = geomField ? (data.values || []).map((row) => geo.parseGeometry(row[geomField])) : [];
        const values = geomField ? (data.values || []).map((row, i) => Object.assign({}, row, { [geomField]: geometries[i] ? feature(geometries[i]) : null })).filter((row) => row[geomField]) : (data.values || []);
        spec.data = data.values ? { values } : { name: data.name || 'table' };
        spec.height = data.height !== undefined ? data.height : (state.height || 480);
        spec.projection = geo.isProjected(geometries) ? { type: 'identity', reflectY: true } : lonLatProjection(geo.bounds(geometries));
        spec.mark = { type: 'geoshape', stroke: theme.tokens().background, strokeWidth: 0.6 };
        if (geomField) enc.shape = { field: geomField, type: 'geojson' };
        if (state.color && state.color.field) {
          const color = encode(state.color, { alias: aliases.color });
          color.scale = { scheme: state.colorScheme === 'diverging' ? 'dataspatium-div' : 'dataspatium-seq' };
          color.legend = state.legend === 'none' ? null : Object.assign({ orient: state.legend || 'right' }, state.yFormat ? { format: state.yFormat } : {});
          enc.color = color;
        }
        const tips = [];
        if (state.y && state.y.field) tips.push({ field: state.y.field, type: 'nominal', title: state.y.title || state.y.field });
        if (state.color && state.color.field) tips.push(Object.assign({ field: state.color.field, type: state.color.type, title: state.color.title || state.color.field }, state.yFormat ? { format: state.yFormat } : {}));
        if (tips.length) enc.tooltip = tips;
        spec.encoding = enc;
        return spec;
      }
      const x = encode(state.x, { alias: aliases.x }); const y = encode(state.y, { alias: aliases.y });
      if (type.id === 'pie') {
        spec.mark = { type: 'arc', innerRadius: state.donut ? 60 : 0 };
        if (y) enc.theta = Object.assign(y, { stack: true });
        if (x) enc.color = Object.assign(x, { legend: { title: state.x.title || state.x.field } });
        if (state.labels && y) spec.layer = undefined;
      } else {
        const markDef = { type: type.mark };
        if (type.mark === 'line') { markDef.interpolate = state.interpolate || 'linear'; if (state.points) markDef.point = true; }
        if (type.mark === 'area') { markDef.interpolate = state.interpolate || 'linear'; markDef.line = true; }
        if (type.mark === 'boxplot') markDef.extent = 'min-max';
        spec.mark = markDef;
        const horizontal = !!type.horizontal;
        if (x) {
          if (x.type === 'nominal' && !x.sort && (type.mark === 'bar') && y && isAggregated(state.y)) x.sort = horizontal ? '-x' : '-y';
          // "By value" names the value axis, which is x once a horizontal chart has swapped the axes.
          else if (horizontal && (x.sort === '-y' || x.sort === 'y')) x.sort = x.sort === '-y' ? '-x' : 'x';
          enc[horizontal ? 'y' : 'x'] = x;
        }
        if (y) {
          if ((type.mark === 'bar' || type.mark === 'area') && state.color && state.stack) y.stack = state.stack === 'normalize' ? 'normalize' : (state.stack === 'none' ? null : 'zero');
          if (state.yFormat) y.axis = Object.assign(y.axis || {}, { format: state.yFormat });
          enc[horizontal ? 'x' : 'y'] = y;
        }
        if (state.xFormat && x) x.axis = Object.assign(x.axis || {}, { format: state.xFormat });
        if (state.color) {
          const color = encode(state.color, { alias: aliases.color });
          if (color.type === 'quantitative' || state.colorScheme === 'sequential') color.scale = { scheme: 'dataspatium-seq' };
          if (state.colorScheme === 'diverging') color.scale = { scheme: 'dataspatium-div' };
          if (state.legend === 'none') color.legend = null;
          enc.color = color;
        }
        if (state.size && type.channels.includes('size')) enc.size = encode(state.size, { alias: aliases.size });
        if (state.facet && type.channels.includes('facet')) { enc.facet = Object.assign(encode(state.facet, { alias: aliases.facet }), { columns: state.facetColumns || 3 }); }
        if (state.labels && type.mark === 'bar' && y) {
          const text = Object.assign({}, y); delete text.axis; delete text.stack;
          spec.layer = [{ mark: markDef }, { mark: { type: 'text', align: horizontal ? 'left' : 'center', baseline: horizontal ? 'middle' : 'bottom', dx: horizontal ? 4 : 0, dy: horizontal ? 0 : -4 }, encoding: { text: Object.assign(text, { format: state.yFormat || ',.0f' }) } }];
          delete spec.mark;
        }
      }
      spec.encoding = enc;
      if (state.facet && spec.width === 'container') spec.width = 260;
      return spec;
    }

    /** True when the first coordinate cannot be longitude/latitude (projected metres, e.g. SWEREF99 TM). */
    function isProjected(values, field) { return geo.isProjected((values || []).map((row) => { const g = row && field ? row[field] : null; return g && g.type === 'Feature' ? g.geometry : g; })); }

    /** Problems in the state the user should fix before rendering. */
    function validate(state) {
      const type = typeOf(state.type);
      const problems = [];
      if (type.geo) {
        if (type.points) {
          if (!state.x || !state.x.field || !state.y || !state.y.field) problems.push(D.t('viz.problem.lonlat'));
          return problems;
        }
        if (!state.x || !state.x.field) problems.push(D.t('viz.problem.geometry'));
        if (!state.color || !state.color.field) problems.push(D.t('viz.problem.value'));
        return problems;
      }
      if (!state.x || !state.x.field) problems.push(D.t('viz.problem.x'));
      if (type.y !== 'count' && (!state.y || !state.y.field)) problems.push(D.t('viz.problem.y'));
      if (type.id === 'heatmap' && (!state.color || !state.color.field)) problems.push(D.t('viz.problem.color'));
      return problems;
    }

    return { CHART_TYPES, AGGREGATES, TIME_UNITS, NUMBER_FORMATS: locale.NUMBER_FORMATS, fieldType, typeOf, channel, defaultState, switchType, toSpec, dataRequest, needsRawRows, validate, isAggregated, isProjected, lonLatProjection, basemapOf, feature };
  });
})();
