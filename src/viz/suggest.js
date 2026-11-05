// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Charts that fit a dataset, ready to be drawn: a line for a series, bars for what can be counted, a map for places, the
 * network of a graph. Visualisera shows them as real pictures, and document templates use the same charts for their tags.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/suggest', ['data/datasets', 'data/kinds', 'data/facets', 'viz/charts', 'viz/vega-builder', 'viz/leaflet'], (datasets, kinds, facets, charts, builder, leaflet) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const MAX_CATEGORIES = 30;
    const isNumber = (c) => c.type === 'number' || c.type === 'integer';
    const t = (key, params) => D.t(key, params);

    function vegaChart(ds, name, type, columns, build) {
      const chart = charts.create('vega', ds, name);
      const state = builder.defaultState(type, columns);
      build(state);
      chart.vega.type = type;
      chart.vega.state = state;
      return chart;
    }
    /** Bars per value of a column: the sum of a number when one is given, otherwise a count. */
    function bars(ds, name, columns, x, y, table) {
      const chart = vegaChart(ds, name, 'bar', columns, (state) => {
        state.x = builder.channel(x);
        state.y = y ? builder.channel(y, { aggregate: 'sum' }) : { aggregate: 'count', type: 'quantitative' };
      });
      if (table) chart.vega.table = table;
      return chart;
    }
    const named = (columns, name) => columns.find((c) => c.name === name);
    /**
     * A dataset's own picture: a map, a network or a model. Document templates ask for these by name.
     * @param {any} ds @param {'map'|'graph'|'model'} kind @returns {Promise<any>}
     */
    async function ownChart(ds, kind) {
      const chart = charts.create(kind, ds, `${ds.name}: ${t('viz.kind.badge.' + kind)}`);
      if (kind === 'map') chart.map = leaflet.defaultMap(await datasets.columns(ds.id), ds);
      if (kind === 'graph') chart.graph = D.require('viz/graph-draw').defaultDef(ds);
      return chart;
    }
    /** The first text column that groups the rows, not one where every row has its own value. */
    async function categoryOf(handle, columns) {
      for (const c of columns.filter((x) => x.type === 'text')) {
        if (c.name === leaflet.geometryColumn(columns)) continue;
        const r = await handle.engine.exec(`select count(distinct ${q(c.name)}) from data`);
        const n = Number(r[0].values[0][0]);
        if (n >= 2 && n <= MAX_CATEGORIES) return c;
      }
      return null;
    }
    /** What fits a table: follows what the data can be used as. */
    async function forTable(ds, handle, columns) {
      const out = [];
      const found = (await facets.detect(ds.id)).filter((f) => f.on);
      const series = found.find((f) => f.id === 'timeseries');
      const numbers = columns.filter(isNumber);
      if (series) {
        const period = named(columns, series.columns[0]);
        const value = numbers.find((c) => c.name !== period.name);
        if (value) out.push({ key: 'viz.suggest.series', params: { value: value.name }, chart: vegaChart(ds, `${ds.name}: ${value.name}`, 'timeseries', columns, (state) => { state.x = builder.channel(period); state.y = builder.channel(value, { aggregate: 'sum' }); }) });
      }
      if (found.some((f) => f.id === 'spatial')) out.push({ key: 'viz.suggest.map', params: {}, chart: await ownChart(ds, 'map') });
      const category = await categoryOf(handle, columns);
      const value = numbers.find((c) => !series || c.name !== series.columns[0]);
      if (found.some((f) => f.id === 'bcf')) {
        // Issues from a CDE: the state of things first.
        for (const name of ['topic_status', 'topic_type', 'assigned_to']) { const c = named(columns, name); if (c) out.push({ key: 'viz.suggest.bcf.' + name, params: {}, chart: bars(ds, `${ds.name}: ${t('viz.suggest.bcf.' + name)}`, columns, c, null) }); }
      }
      if (category) out.push({ key: value ? 'viz.suggest.sum' : 'viz.suggest.count', params: { value: value ? value.name : '', by: category.name }, chart: bars(ds, `${ds.name}: ${category.name}`, columns, category, value) });
      if (numbers.length >= 2 && !series) out.push({ key: 'viz.suggest.scatter', params: { x: numbers[0].name, y: numbers[1].name }, chart: vegaChart(ds, `${ds.name}: ${numbers[0].name}, ${numbers[1].name}`, 'point', columns, (state) => { state.x = builder.channel(numbers[0]); state.y = builder.channel(numbers[1]); }) });
      if (value && !series) out.push({ key: 'viz.suggest.histogram', params: { value: value.name }, chart: vegaChart(ds, `${ds.name}: ${value.name}`, 'histogram', columns, (state) => { state.x = builder.channel(value, { bin: true }); }) });
      return out;
    }
    /** What fits the kinds that are more than a table. */
    async function forKind(ds, columns) {
      const col = (name) => named(columns, name);
      const out = [];
      switch (kinds.of(ds)) {
        case kinds.PROFILES.document:
          out.push({ key: 'viz.suggest.documents', params: {}, chart: bars(ds, `${ds.name}: ${t('document.characters')}`, columns, col('dokument'), col('tecken')) });
          break;
        case kinds.PROFILES.images:
          if (await facets.has(ds.id, 'spatial')) out.push({ key: 'viz.suggest.map', params: {}, chart: await ownChart(ds, 'map') });
          out.push({ key: 'viz.suggest.cameras', params: {}, chart: bars(ds, `${ds.name}: ${t('gallery.camera')}`, columns, col('kamera'), null) });
          break;
        case kinds.PROFILES.plan:
          out.push({ key: 'viz.suggest.map', params: {}, chart: await ownChart(ds, 'map') });
          break;
        case kinds.PROFILES.graph: {
          out.push({ key: 'viz.suggest.graph', params: {}, chart: await ownChart(ds, 'graph') });
          const edges = await D.require('viz/data').columnsOf(ds.id, '_edges');
          out.push({ key: 'viz.suggest.edges', params: {}, chart: bars(ds, `${ds.name}: ${t('viz.table._edges')}`, edges, named(edges, 'typ'), null, '_edges') });
          break;
        }
        case kinds.PROFILES.model:
          if (kinds.isDxf(ds)) {
            out.push({ key: 'viz.suggest.layers', params: {}, chart: bars(ds, `${ds.name}: ${t('model.col.lager')}`, columns, col('lager'), null) });
            break;
          }
          out.push({ key: 'viz.suggest.model', params: {}, chart: await ownChart(ds, 'model') });
          out.push({ key: 'viz.suggest.types', params: {}, chart: bars(ds, `${ds.name}: ${t('model.col.typ')}`, columns, col('typ'), null) });
          {
            const amounts = await D.require('viz/data').columnsOf(ds.id, '_quantities');
            if (named(amounts, 'varde')) out.push({ key: 'viz.suggest.quantities', params: {}, chart: bars(ds, `${ds.name}: ${t('viz.table._quantities')}`, amounts, named(amounts, 'namn'), named(amounts, 'varde'), '_quantities') });
          }
          break;
        default: break;
      }
      return out;
    }
    /**
     * Charts that fit the dataset, the most telling first.
     * @param {any} ds @returns {Promise<Array<{key: string, params: any, chart: any}>>}
     */
    async function forDataset(ds) {
      const handle = await datasets.ensureOpen(ds.id);
      const columns = await datasets.columns(ds.id);
      return kinds.isCollection(ds) ? forKind(ds, columns) : forTable(ds, handle, columns);
    }
    /**
     * The picture of a suggestion as SVG text, or null for what takes too long to draw just to choose it.
     * @param {any} chart @returns {Promise<string|null>}
     */
    async function preview(chart) {
      if (chart.kind === 'model') return null;
      const blob = await D.require('viz/render').toBlob(chart, 'svg', { width: 320, height: 200 });
      return blob.text();
    }

    /**
     * The board Ärendeläge for a table of issues: status, type, who has them, priority and the month they came, as saved
     * charts in a dashboard with shared filters on status, type and assignee.
     * @param {any} ds the issue table @returns {Promise<any>} the saved dashboard
     */
    async function issueBoard(ds) {
      const columns = await datasets.columns(ds.id);
      const made = [];
      for (const name of ['topic_status', 'topic_type', 'assigned_to', 'priority']) {
        const c = named(columns, name);
        if (c) made.push(bars(ds, `${ds.name}: ${t('viz.suggest.bcf.' + name)}`, columns, c));
      }
      const created = named(columns, 'creation_date');
      if (created) {
        made.push(vegaChart(ds, `${ds.name}: ${t('viz.suggest.bcf.months')}`, 'bar', columns, (state) => {
          state.x = Object.assign(builder.channel(created), { type: 'temporal', timeUnit: 'yearmonth' });
          state.y = { field: null, type: 'quantitative', aggregate: 'count', bin: false, timeUnit: '', sort: '', title: '', format: '' };
        }));
      }
      const dashboards = D.require('viz/dashboards');
      const dash = dashboards.create(t('viz.board.issues.name', { name: ds.name }));
      dash.description = t('viz.board.issues.description');
      for (const chart of made) { const saved = await charts.save(chart); dash.items.push({ chartId: saved.id, span: 1 }); }
      dash.filters = ['topic_status', 'topic_type', 'assigned_to'].filter((n) => named(columns, n)).map((column) => ({ column }));
      return dashboards.save(dash);
    }

    return { forDataset, ownChart, preview, issueBoard };
  });
})();
