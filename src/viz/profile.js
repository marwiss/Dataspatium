// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Höjdprofil längs en linje (decision F37 c): the distance and the height from Lantmäteriet's terrain model along the lines of a
 * geometry column, as a derived dataset (linje, avstand_m, hojd_m, ost, nord in SWEREF 99 TM) and a saved line chart over it. The
 * heights come through api/heights, which asks for consent for the file host; nothing is fetched before the person presses the
 * button in the dialog (ui/viz/profile-dialog). The chart and the dataset are ordinary ones afterwards.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/profile', ['data/datasets', 'api/heights', 'viz/charts', 'viz/vega-builder'], (datasets, heights, charts, builder) => {
    const PREFER = /^(geometry|geom|wkt|shape|the_geom|geometri)$/i;
    const MAX_LINES = 50;
    const COLUMNS = [{ name: 'linje', type: 'text' }, { name: 'avstand_m', type: 'number' }, { name: 'hojd_m', type: 'number' }, { name: 'ost', type: 'number' }, { name: 'nord', type: 'number' }];

    /** The text columns of a dataset that may hold geometries, the likeliest first. @param {string} datasetId */
    async function columns(datasetId) {
      const cols = (await datasets.columns(datasetId)).filter((c) => c.type === 'text');
      return cols.filter((c) => PREFER.test(c.name)).concat(cols.filter((c) => !PREFER.test(c.name)));
    }
    /** Whether a profile is worth offering: a column named like a geometry, or a dataset the map facet knows. @param {string} datasetId */
    async function likely(datasetId) {
      if ((await columns(datasetId)).some((c) => PREFER.test(c.name))) return true;
      const facets = D.has('data/facets') ? D.require('data/facets') : null;
      return facets ? facets.has(datasetId, 'spatial').catch(() => false) : false;
    }

    /**
     * Builds the profile: a derived dataset with a row per sampled point and a saved line chart over it, one line per row of the
     * source. Null when no point along the lines got a height.
     * @param {any} ds the source dataset
     * @param {{column: string, label?: string, rows?: number, step?: number}} options the geometry column, the column that names the
     *   lines (else the row number), how many rows from the top (at most MAX_LINES) and the step in metres
     * @returns {Promise<{dataset: any, chart: any, points: number, found: number, lines: number}|null>}
     */
    async function build(ds, options) {
      const column = String(options.column || '');
      const cols = (await datasets.columns(ds.id)).map((c) => c.name);
      if (!cols.includes(column)) throw new Error(D.t('profile.err.column'));
      const label = options.label && cols.includes(String(options.label)) ? String(options.label) : null;
      const limit = Math.max(1, Math.min(MAX_LINES, Math.floor(Number(options.rows)) || 1));
      const step = Math.max(1, Number(options.step) || 10);
      const rows = await datasets.query(ds.id, { limit });
      const picked = rows.map((r, i) => ({ geometry: r[cols.indexOf(column)], name: label ? String(r[cols.indexOf(label)] ?? '') : '', index: i + 1 }))
        .filter((p) => p.geometry !== null && p.geometry !== undefined && String(p.geometry).trim() !== '');
      if (!picked.length) throw new Error(D.t('profile.err.empty'));
      const profiles = await heights.profile(picked.map((p) => p.geometry), { step });
      const out = [];
      profiles.forEach((pr, i) => {
        const name = picked[i].name || D.t('profile.line', { n: picked[i].index });
        for (const pt of pr.points) out.push([name, pt.distance, pt.height, pt.x, pt.y]);
      });
      const found = out.filter((r) => r[2] !== null).length;
      if (!found) return null;
      const name = D.t('profile.name', { name: ds.name });
      const meta = await datasets.create({
        name, columns: COLUMNS.map((c) => Object.assign({}, c)), rows: out,
        source: { kind: 'derived', profile: { datasetId: ds.id, column, label, step, rows: limit, fetchedAt: new Date().toISOString() } },
      });
      const made = await datasets.columns(meta.id);
      const col = (n) => made.find((c) => c.name === n);
      const chart = charts.create('vega', meta, name);
      const state = builder.defaultState('line', made);
      state.x = builder.channel(col('avstand_m'), { title: D.t('profile.axis.distance') });
      state.y = builder.channel(col('hojd_m'), { aggregate: 'none', title: D.t('profile.axis.height') });
      state.color = profiles.length > 1 ? builder.channel(col('linje')) : null;
      state.points = false;
      chart.vega.type = 'line';
      chart.vega.state = state;
      const saved = await charts.save(chart);
      return { dataset: meta, chart: saved, points: out.length, found, lines: profiles.length };
    }
    return { columns, likely, build, MAX_LINES, COLUMNS };
  });
})();
