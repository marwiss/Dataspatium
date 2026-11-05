// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a file is, said first and in the words of what it holds, and what is worth asking before it is read: coordinates
 * that have changed places, which coordinate system they are in, whether a list of links is a graph. It only reads the
 * wizard's preview, and nothing changes until the user answers.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/file-sense', ['viz/leaflet', 'data/facets', 'data/types', 'data/geo', 'data/kinds', 'data/boundaries', 'data/spatial-search', 'data/datasets'], (leaflet, facets, types, geo, kinds, boundaries, spatial, datasets) => {
    /** The coordinate systems the app can read, in the order a Nordic user would look for them. */
    const SYSTEMS = [
      { value: '3006', label: 'SWEREF 99 TM', group: 'SWEREF 99' },
      ...[[3007, '12 00'], [3008, '13 30'], [3012, '14 15'], [3009, '15 00'], [3013, '15 45'], [3010, '16 30'], [3014, '17 15'], [3011, '18 00'], [3015, '18 45'], [3016, '20 15'], [3017, '21 45'], [3018, '23 15']]
        .map(([code, zone]) => ({ value: String(code), label: `SWEREF 99 ${zone}`, group: 'SWEREF 99' })),
      { value: '3021', label: 'RT 90 2,5 gon V', group: 'RT 90' },
      { value: '25832', label: 'ETRS89 / UTM 32N', group: 'UTM' }, { value: '25833', label: 'ETRS89 / UTM 33N', group: 'UTM' },
      { value: '25834', label: 'ETRS89 / UTM 34N', group: 'UTM' }, { value: '25835', label: 'ETRS89 / UTM 35N', group: 'UTM' },
      { value: '3067', label: 'ETRS-TM35FIN', group: 'UTM' },
      { value: '3057', label: 'ISN93', group: 'ISN93' },
      { value: '3857', label: 'Web Mercator', group: 'Web Mercator' },
    ];
    const DEFAULT_SYSTEM = '3006';
    const RT90 = '3021';
    /** Boundary sets that can name a place, one per country that ships with the app. */
    const NAMING_SETS = ['kommuner', 'kommuner-no', 'kommuner-dk', 'kunnat-fi'];
    const ONLY_LETTERS = /^[xyen]$/i;

    const within = (r, low, high) => r.min >= low && r.max <= high;
    const range = (list) => list.reduce((r, v) => ({ min: Math.min(r.min, v), max: Math.max(r.max, v) }), { min: Infinity, max: -Infinity });
    /** A preview that goes through the column step. A plain table's preview has a kind of its own, such as text. */
    const isTable = (p) => !['graph', 'model', 'plan', 'package'].includes(p.kind) && !p.reader && !p.dataspatium && !p.planGpkg && p.importer !== 'images' && p.importer !== 'documents';

    /** The numbers of a preview column, null where a row has none. */
    function numbers(p, name) {
      const i = p.columns.indexOf(name);
      const spec = (p.inferred || [])[i] || {};
      return p.dataRows.map((row) => {
        if (types.isBlank(row[i])) return null;
        const v = types.parseNumber(row[i], spec.decimal || 'point');
        return Number.isFinite(v) ? v : null;
      });
    }
    /**
     * How the coordinates of a preview look.
     * `degrees`, `swapped` (latitude and longitude have changed places), `projected`, or `projected-swapped`, which is
     * common in Sweden, where X is north.
     * @param {any} p @returns {{lon: string, lat: string, state: string, system?: string}|null}
     */
    function coordinates(p) {
      const found = leaflet.coordinateColumns(p.inferred || []);
      if (!found) return null;
      const lons = numbers(p, found.lon).filter((v) => v !== null);
      const lats = numbers(p, found.lat).filter((v) => v !== null);
      if (!lons.length || !lats.length) return null;
      const lon = range(lons); const lat = range(lats);
      const base = { lon: found.lon, lat: found.lat };
      if (within(lon, 1e4, 2e6) && within(lat, 1e6, 1e7)) return Object.assign(base, { state: 'projected', system: lon.min > 1.1e6 ? RT90 : DEFAULT_SYSTEM });
      if (within(lat, 1e4, 2e6) && within(lon, 3e6, 1e7)) return Object.assign(base, { state: 'projected-swapped', system: lat.min > 1.1e6 ? RT90 : DEFAULT_SYSTEM });
      if (within(lon, -180, 180) && within(lat, -90, 90)) {
        // Small numbers under x and y are usually something else.
        if (ONLY_LETTERS.test(found.lon) || ONLY_LETTERS.test(found.lat)) return null;
        // In the Nordic countries a latitude is larger than a longitude.
        return Object.assign(base, { state: within(lat, 4, 32) && within(lon, 54, 72) ? 'swapped' : 'degrees' });
      }
      if (within(lon, -90, 90) && within(lat, -180, 180)) return Object.assign(base, { state: 'swapped' });
      return null;
    }
    /** A geometry column whose first value really is a geometry. */
    function shapeColumn(p) {
      const name = leaflet.geometryColumn(p.inferred || []);
      if (!name) return null;
      const i = p.columns.indexOf(name);
      const first = p.dataRows.map((r) => r[i]).find((v) => !types.isBlank(v));
      return first !== undefined && geo.parseGeometry(first) ? name : null;
    }

    /**
     * The sentence that says what the file is.
     * @param {any} p the wizard's preview @param {{files?: File[]}} [context]
     * @returns {{icon: string, key: string, params: any}|null}
     */
    function describe(p, context = {}) {
      const files = context.files || [];
      const count = files.length || 1;
      if (p.importer === 'images') return { icon: kinds.PROFILES.images.icon, key: 'import.sense.images', params: { n: count } };
      if (p.importer === 'documents') {
        const icon = kinds.PROFILES.document.icon;
        if (files.length > 1) return { icon, key: 'import.sense.documents', params: { n: count } };
        const noText = p.document && p.document.words === 0;
        return { icon, key: noText ? 'import.sense.document.notext' : 'import.sense.document', params: { pages: (p.document && p.document.pages) || 1 } };
      }
      if (p.kind === 'graph') return { icon: kinds.PROFILES.graph.icon, key: 'import.sense.graph', params: { nodes: p.graph.nodes, edges: p.graph.edges } };
      if (p.kind === 'model') {
        const dxf = p.model && p.model.format === 'dxf';
        return { icon: kinds.PROFILES.model.icon, key: dxf ? 'import.sense.dxf' : 'import.sense.ifc', params: { n: (p.dataRows || []).reduce((sum, r) => sum + Number(r[1] || 0), 0) } };
      }
      if (p.kind === 'plan' || p.planGpkg) return { icon: kinds.PROFILES.plan.icon, key: 'import.sense.plan', params: {} };
      if (p.dataspatium) return { icon: 'database', key: 'import.sense.dataspatium', params: {} };
      if (p.kind === 'package') return { icon: 'package', key: 'import.sense.package', params: { n: p.package.resources, name: p.datasetName } };
      if (!isTable(p) || !p.columns.length) return null;
      const shape = shapeColumn(p);
      if (shape) return { icon: 'map', key: 'import.sense.shapes', params: { column: shape } };
      const coords = coordinates(p);
      if (coords) return { icon: 'map', key: 'import.sense.places', params: { lon: coords.lon, lat: coords.lat } };
      const network = facets.networkColumns(p.columns);
      if (network) return { icon: kinds.PROFILES.graph.icon, key: 'import.sense.network', params: network };
      return { icon: 'table', key: 'import.sense.table', params: { n: p.columns.length } };
    }

    /**
     * What is worth asking about this file.
     * @param {any} p @returns {Array<{id: string, params: any, hint: string, system?: string}>}
     */
    function questions(p) {
      if (!isTable(p) || !p.columns.length || shapeColumn(p)) return [];
      const out = [];
      const coords = coordinates(p);
      if (coords && coords.state.endsWith('swapped')) out.push({ id: 'swap', params: { a: coords.lon, b: coords.lat }, hint: coords.state === 'swapped' ? 'import.q.swap.hint' : 'import.q.swap.hint.projected' });
      if (coords && coords.state.startsWith('projected')) out.push({ id: 'crs', params: {}, hint: 'import.q.crs.hint', system: coords.system });
      const network = facets.networkColumns(p.columns);
      if (network) out.push({ id: 'graph', params: network, hint: 'import.q.graph.hint' });
      return out;
    }

    /** The table to draw as a small map, following the answers given so far. @returns {{columns: string[], rows: any[][], types: any}|null} */
    function mapTable(p, answers = {}) {
      if (!isTable(p) && p.kind !== 'plan') return null;
      const shape = shapeColumn(p);
      if (shape) return { columns: p.columns, rows: p.dataRows, types: { [shape]: 'text' } };
      const coords = coordinates(p);
      if (!coords) return null;
      const projected = coords.state.startsWith('projected');
      const xs = numbers(p, answers.swap ? coords.lat : coords.lon);
      const ys = numbers(p, answers.swap ? coords.lon : coords.lat);
      const system = answers.crs || coords.system;
      const rows = [];
      xs.forEach((x, i) => {
        if (x === null || ys[i] === null) return;
        rows.push(projected ? geo.toWgs84({ type: 'Point', coordinates: [x, ys[i]] }, system).coordinates : [x, ys[i]]);
      });
      return rows.length ? { columns: ['lon', 'lat'], rows, types: { lon: 'number', lat: 'number' } } : null;
    }
    /**
     * The name of the municipality that holds the middle of these places, so that a mistake shows at once.
     * @param {any[][]} rows [lon, lat] @returns {Promise<string|null>}
     */
    async function placeName(rows) {
      if (!rows.length) return null;
      const middle = (i) => rows.map((r) => r[i]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
      const point = [middle(0), middle(1)];
      for (const set of NAMING_SETS) {
        const features = await boundaries.features(set);
        const hit = features.find((f) => f.geometry && spatial.inGeometry(point, f.geometry));
        if (hit) return hit.name;
      }
      return null;
    }
    /** What the import has to do with the coordinates, in the source's own column names. */
    function reprojectOption(p, answers = {}) {
      const coords = coordinates(p);
      if (!coords || !coords.state.startsWith('projected')) return null;
      const crs = answers.crs || coords.system;
      if (crs === DEFAULT_SYSTEM) return null;
      return { east: answers.swap ? coords.lat : coords.lon, north: answers.swap ? coords.lon : coords.lat, crs };
    }
    /** Change the names of two columns between each other. */
    function swapNames(specs, a, b) {
      const first = specs.find((s) => s.name === a); const second = specs.find((s) => s.name === b);
      if (!first || !second) return;
      first.name = b; second.name = a;
      if (first.label === a) first.label = b;
      if (second.label === b) second.label = a;
    }
    /**
     * A table read as a list of links becomes a graph, and the table is not kept beside it.
     * @param {any} meta the table just imported @param {{from: string, to: string}} network in the source's names
     */
    async function toGraph(meta, network) {
      const graph = D.require('data/graph');
      const columns = await datasets.columns(meta.id);
      const named = (source) => (columns.find((c) => c.sourceName === source) || { name: source }).name;
      const edgeType = columns.find((c) => /^(typ|type|relation|relationstyp|kind)$/i.test(c.name));
      const made = await graph.fromTables({ edgesId: meta.id, edgeSource: named(network.from), edgeTarget: named(network.to), edgeType: edgeType ? edgeType.name : null, nodesId: null, directed: true });
      const out = await graph.createGraphDataset({ name: meta.name, graph: made, source: meta.source });
      await datasets.remove(meta.id);
      return out;
    }

    return { SYSTEMS, coordinates, describe, questions, mapTable, placeName, reprojectOption, swapNames, toGraph };
  });
})();
