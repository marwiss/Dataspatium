// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a dataset can also be used as, whatever its kind: places on a map, a time series, regions that can be coloured, a
 * network, running text. A facet is found from both names and values, always says why, and the user can overrule it, which
 * is kept in the dataset (`_meta.facets`). The modes read this instead of guessing for themselves.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/facets', ['data/datasets', 'data/kinds', 'viz/leaflet', 'data/boundaries'], (datasets, kinds, leaflet, boundaries) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const IDS = ['spatial', 'timeseries', 'region', 'network', 'text'];
    const PERIOD_NAME = /^(ar|år|aar|year|vuosi|tid|period|time|date|datum|dato|aika|manad|månad|month|kvartal|quarter)/i;
    const REGION_NAME = /kommun|lan$|län|region|fylke|kunta|maakunta|sveitarf/i;
    const TEXT_LENGTH = 80;
    const SAMPLE = 500;
    const NETWORK_NAMES = [['source', 'target'], ['from', 'to'], ['fran', 'till'], ['från', 'till'], ['kalla', 'mal'], ['källa', 'mål'], ['avsandare', 'mottagare'], ['avsändare', 'mottagare'], ['lahde', 'kohde'], ['fra', 'til']];
    /** @type {Map<string, {key: string, list: any[]}>} */
    const cache = new Map();

    const textColumns = (columns) => columns.filter((c) => c.type === 'text');
    const first = (res) => (res[0] && res[0].values[0] ? res[0].values[0] : []);

    async function findSpatial(handle) {
      if (kinds.of(handle.meta).files === 'pictures') {
        const n = Number(first(await handle.engine.exec('select count(lon) from data'))[0]) || 0;
        return n ? { reason: 'facets.reason.pictures', params: { n }, columns: ['lon', 'lat'] } : null;
      }
      if (!(await leaflet.drawableByValues(handle))) return null;
      const geometry = leaflet.geometryColumn(handle.columns);
      if (geometry) return { reason: 'facets.reason.geometry', params: { column: geometry }, columns: [geometry] };
      const coords = leaflet.coordinateColumns(handle.columns);
      return coords ? { reason: 'facets.reason.coordinates', params: coords, columns: [coords.lon, coords.lat] } : null;
    }
    /** A column of periods beside something to count: names help, and the values have to read as periods. */
    async function findTimeseries(handle) {
      const columns = handle.columns;
      if (!columns.some((c) => c.type === 'number' || c.type === 'integer')) return null;
      const candidates = columns.filter((c) => c.type === 'date' || c.type === 'datetime' || (c.type === 'integer' && PERIOD_NAME.test(c.name)) || c.type === 'text');
      for (const c of candidates) {
        const r = first(await handle.engine.exec(`select count(*), sum(dm_period(v, 'auto') is not null), count(distinct v) from (select ${q(c.name)} as v from data where ${q(c.name)} is not null limit ${SAMPLE})`));
        const [n, periods, distinct] = r.map(Number);
        if (n >= 3 && distinct >= 3 && periods / n >= 0.9) return { reason: 'facets.reason.period', params: { column: c.name }, columns: [c.name] };
      }
      return null;
    }
    /** A column named like a region whose values are the codes or names of a boundary set that ships with the app. */
    async function findRegion(handle) {
      for (const c of handle.columns.filter((x) => REGION_NAME.test(x.name))) {
        const r = await handle.engine.exec(`select distinct cast(${q(c.name)} as text) from data where ${q(c.name)} is not null limit ${SAMPLE}`);
        const values = (r[0] ? r[0].values : []).map((row) => String(row[0]));
        if (!values.length) continue;
        for (const def of boundaries.BASEMAPS) {
          const features = await boundaries.features(def.id);
          const known = new Set();
          for (const f of features) { if (f.code) known.add(String(f.code)); if (f.name) known.add(String(f.name)); }
          const hits = values.filter((v) => known.has(v) || known.has(v.padStart(4, '0')) || known.has(v.padStart(2, '0'))).length;
          if (hits / values.length >= 0.9) return { reason: 'facets.reason.region', params: { column: c.name, set: D.t(def.key) }, columns: [c.name], boundary: def.id };
        }
      }
      return null;
    }
    function findNetwork(handle) {
      const names = handle.columns.map((c) => c.name);
      for (const [from, to] of NETWORK_NAMES) {
        const a = names.find((x) => x.toLowerCase() === from);
        const b = names.find((x) => x.toLowerCase() === to);
        if (a && b) return { reason: 'facets.reason.network', params: { from: a, to: b }, columns: [a, b] };
      }
      return null;
    }
    async function findText(handle) {
      for (const c of textColumns(handle.columns)) {
        if (c.name === leaflet.geometryColumn(handle.columns)) continue;
        const r = first(await handle.engine.exec(`select avg(length(v)), count(*) from (select ${q(c.name)} as v from data where ${q(c.name)} is not null limit ${SAMPLE})`));
        if (Number(r[1]) >= 3 && Number(r[0]) >= TEXT_LENGTH) return { reason: 'facets.reason.text', params: { column: c.name }, columns: [c.name] };
      }
      return null;
    }

    /**
     * What the dataset can be used as, with the reason for each and what the user has decided.
     * @param {string} id
     * @returns {Promise<Array<{id: string, on: boolean, auto: boolean, forced: boolean, reason: string|null, params?: any, columns: string[], boundary?: string}>>}
     */
    async function detect(id) {
      const handle = await datasets.ensureOpen(id);
      const forced = handle.meta.facets || {};
      const key = `${datasets.contentMarker(id)}:${JSON.stringify(forced)}`;
      const hit = cache.get(id);
      if (hit && hit.key === key) return hit.list;
      const collection = kinds.isCollection(handle.meta);
      const found = {
        spatial: collection && kinds.of(handle.meta).files !== 'pictures' ? null : await findSpatial(handle),
        timeseries: collection ? null : await findTimeseries(handle),
        region: collection ? null : await findRegion(handle),
        network: collection ? null : findNetwork(handle),
        text: collection ? null : await findText(handle),
      };
      const list = IDS.filter((f) => found[f] || forced[f] !== undefined).map((f) => {
        const auto = !!found[f];
        return Object.assign({ id: f, auto, forced: forced[f] !== undefined, on: forced[f] === undefined ? auto : !!forced[f], reason: null, columns: [] }, found[f] || {});
      });
      cache.set(id, { key, list });
      return list;
    }
    /** @param {string} id @param {string} facet @returns {Promise<boolean>} */
    async function has(id, facet) {
      const list = await detect(id);
      const f = list.find((x) => x.id === facet);
      return !!(f && f.on);
    }
    /**
     * Overrule a facet, or hand it back to the app with null.
     * @param {string} id @param {string} facet @param {boolean|null} value
     */
    async function set(id, facet, value) {
      const handle = await datasets.ensureOpen(id);
      const next = Object.assign({}, handle.meta.facets);
      if (value === null) delete next[facet]; else next[facet] = !!value;
      handle.meta.facets = next;
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['facets', JSON.stringify(next)]);
      cache.delete(id);
      await datasets.save(id);
      datasets.notify('changed', { id });
    }
    /** The tab in Analysera where this dataset is best started: the kind's own, or what the data says. */
    async function startTab(id) {
      const handle = await datasets.ensureOpen(id);
      if (kinds.isCollection(handle.meta)) return kinds.of(handle.meta).tab;
      if (await has(id, 'spatial')) return 'geo';
      if (await has(id, 'text')) return 'text';
      return 'stats';
    }
    /** The group of the operations palette that fits first. */
    async function firstGroups(id) {
      const out = [];
      if (await has(id, 'spatial')) out.push('geo');
      if (await has(id, 'timeseries')) out.push('timeseries');
      if (await has(id, 'text')) out.push('regex');
      return out;
    }

    return { IDS, detect, has, set, startTab, firstGroups };
  });
})();
