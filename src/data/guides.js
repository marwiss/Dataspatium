// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Guides: a short way from a question to a result with real data. Each one fetches from an open source, cleans the table with
 * ordinary recipe steps and saves a chart, and leaves all three behind for the user to build on. The fetch asks for consent
 * like any other API call.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/guides', ['data/datasets', 'data/recipes', 'api/connectors', 'api/runner', 'api/families/pxweb', 'viz/charts', 'viz/vega-builder', 'data/codelists'], (datasets, recipes, connectors, runner, pxweb, charts, builder, codelists) => {
    const ages = () => Array.from({ length: 101 }, (_, i) => String(i)).concat(['100+']);
    const number = (columns) => columns.find((c) => c.type === 'number' || c.type === 'integer');
    const named = (columns, name) => columns.find((c) => c.name === name);
    /** A chart of a table, saved so that it is there to come back to. */
    async function saveVega(meta, name, type, build) {
      const columns = await datasets.columns(meta.id);
      const chart = charts.create('vega', meta, name);
      const state = builder.defaultState(type, columns);
      build(state, columns);
      chart.vega.type = type;
      chart.vega.state = state;
      return charts.save(chart);
    }
    const endpointOf = (connector, id) => connector.endpoints.find((e) => e.id === id);

    const GUIDES = [
      {
        id: 'kolada', icon: 'chart-column', source: 'Kolada',
        fields: [{ name: 'kpi', default: 'N01951' }, { name: 'year', type: 'number', default: String(new Date().getFullYear() - 2) }],
        async fetch(values, get) {
          const connector = await get('kolada');
          return runner.fetchTable(connector, endpointOf(connector, 'data-year'), { kpi_id: values.kpi, year: values.year, per_page: 5000 });
        },
        /** The whole country and the counties go, as do the figures per sex; the codes get their names. */
        async clean(id) {
          await recipes.apply(id, 'delete_rows', { where: "kon != 'T' or length(kommun_id) != 4 or substr(kommun_id, 1, 2) = '00'", keep: false });
          await codelists.apply(id, 'kommun_id', 'kommuner');
          await recipes.apply(id, 'apply_value_labels', { column: 'kommun_id', direction: 'labels' });
          await recipes.apply(id, 'keep_top', { column: 'varde', count: 20, which: 'largest' });
        },
        chart: (meta, name) => saveVega(meta, name, 'bar', (state, columns) => {
          state.x = builder.channel(named(columns, 'kommun_id'), { sort: '-y' });
          state.y = builder.channel(named(columns, 'varde'), { aggregate: 'sum' });
        }),
      },
      {
        id: 'pyramid', icon: 'align-center-vertical', source: 'SCB',
        fields: [{ name: 'region', default: '00' }],
        async fetch(values, get) {
          const connector = await get('scb-pxweb');
          const path = ['BE', 'BE0101', 'BE0101A', 'BefolkningNy'];
          const meta = await pxweb.tableMetaV1(connector, path);
          const selection = { Region: { filter: 'item', values: [values.region] }, Alder: { filter: 'item', values: ages().filter((a) => meta.variables.find((v) => v.code === 'Alder').values.some((x) => (x.code || x) === a)) }, Kon: { filter: 'all' }, ContentsCode: { filter: 'item', values: ['BE0101N1'] }, Tid: { filter: 'top', n: 1 } };
          return pxweb.fetchData(connector, { path, id: path[path.length - 1], title: meta.title }, meta.variables, selection, {});
        },
        async clean() { /* The table comes as it should be. */ },
        async chart(meta, name) {
          const columns = await datasets.columns(meta.id);
          const handle = await datasets.ensureOpen(meta.id);
          const text = columns.filter((c) => c.type === 'text');
          const sides = [];
          let side = null;
          for (const c of text) {
            const r = await handle.engine.exec(`select distinct "${c.name.replace(/"/g, '""')}" from data limit 3`);
            const values = (r[0] ? r[0].values : []).map((row) => String(row[0]));
            if (values.length === 2) { side = c; sides.push(...values); break; }
          }
          const value = number(columns);
          const group = text.find((c) => c !== side && /lder|age/i.test(c.name)) || text.find((c) => c !== side);
          const chart = charts.create('d3', meta, name);
          chart.d3 = { template: 'pyramid', params: { group: group.name, side: side.name, value: value.name, left: sides[0], right: sides[1], title: name } };
          return charts.save(chart);
        },
      },
      {
        id: 'weather', icon: 'chart-line', source: 'SMHI',
        fields: [{ name: 'station', type: 'select', default: '98210', options: [{ value: '98210', label: 'Stockholm' }, { value: '71420', label: 'Göteborg' }, { value: '52350', label: 'Malmö' }, { value: '140480', label: 'Umeå' }, { value: '162860', label: 'Luleå' }] }],
        async fetch(values, get) {
          const connector = await get('smhi-metobs');
          return runner.fetchTable(connector, endpointOf(connector, 'archive'), { parameter: '2', station: values.station });
        },
        /** One value per day becomes one per year. */
        async clean(id) {
          const columns = await datasets.columns(id);
          const day = named(columns, 'Representativt dygn');
          const value = named(columns, 'Lufttemperatur');
          await recipes.apply(id, 'ts_period', { column: day.name, frequency: 'month', name: 'period' });
          await recipes.apply(id, 'ts_aggregate', { period: 'period', to: 'year', columns: [value.name], how: 'mean' });
        },
        chart: (meta, name) => saveVega(meta, name, 'timeseries', (state, columns) => {
          const value = named(columns, 'Lufttemperatur');
          state.x = builder.channel(columns.find((c) => c.name !== value.name));
          state.y = builder.channel(value, { aggregate: 'mean' });
        }),
      },
      {
        id: 'prices', icon: 'trending-up', source: 'ECB',
        fields: [{ name: 'country', type: 'select', default: 'SE', options: [{ value: 'SE', label: 'Sverige' }, { value: 'DK', label: 'Danmark' }, { value: 'FI', label: 'Suomi' }, { value: 'NO', label: 'Norge' }, { value: 'IS', label: 'Ísland' }] }],
        async fetch(values, get) {
          const connector = await get('ecb');
          return runner.fetchTable(connector, endpointOf(connector, 'data'), { flow: 'ICP', key: `M.${values.country}.N.000000.4.ANR`, startPeriod: '2015-01' });
        },
        async clean() { /* The series comes as it should be. */ },
        chart: (meta, name) => saveVega(meta, name, 'timeseries', (state, columns) => {
          const value = columns.find((c) => /obs|value|varde/i.test(c.name)) || number(columns);
          state.x = builder.channel(columns.find((c) => /time|period|tid/i.test(c.name)));
          state.y = builder.channel(value, { aggregate: 'mean' });
        }),
      },
    ];

    /**
     * Run a guide from beginning to end.
     * @param {string} id @param {any} values @param {{onStep?: (step: string) => void, connector?: (id: string) => Promise<any>}} [options]
     * @returns {Promise<{dataset: any, chart: any}>}
     */
    async function run(id, values, options = {}) {
      const guide = GUIDES.find((g) => g.id === id);
      if (!guide) throw new Error('unknown guide ' + id);
      const step = options.onStep || (() => {});
      const get = options.connector || ((name) => connectors.get(name));
      step('fetch');
      const table = await guide.fetch(values, get);
      const name = D.t(`guide.${id}.name`, values);
      const dataset = await runner.toDataset(table, { name, source: { kind: 'guide', guide: id } });
      step('clean');
      await guide.clean(dataset.id);
      step('chart');
      const chart = await guide.chart(await datasets.get(dataset.id), name);
      step('done');
      return { dataset: await datasets.get(dataset.id), chart };
    }

    return { GUIDES, run };
  });
})();
