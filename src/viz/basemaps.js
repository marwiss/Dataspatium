// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Background layers for maps: the county and municipality boundaries that ship with the app
 * (presets/geo, from SCB's "Digitala gränser" under CC0, converted to WGS 84 by
 * tools/build_boundaries.py). Parsed once per session and cached.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/basemaps', [], () => {
    const BASEMAPS = [
      { id: 'lan', key: 'viz.basemap.lan', asset: 'presets/geo/lan.geojson', nameField: 'lan', codeField: 'lanskod' },
      { id: 'kommuner', key: 'viz.basemap.kommuner', asset: 'presets/geo/kommuner.geojson', nameField: 'kommun', codeField: 'kommunkod' },
    ];
    const cache = new Map();

    /** Definition of a basemap or null. */
    function get(id) { return BASEMAPS.find((b) => b.id === id) || null; }

    /**
     * Features of a basemap as [{geometry, name, code}] in WGS 84; [] for unknown ids.
     * @param {string} id
     * @returns {Promise<Array<{geometry: any, name: string, code: string}>>}
     */
    async function features(id) {
      const def = get(id);
      if (!def) return [];
      if (!cache.has(id)) {
        cache.set(id, (async () => {
          const fc = JSON.parse(await D.assets.loadText(def.asset));
          return (fc.features || []).map((f) => ({ geometry: f.geometry, name: f.properties ? f.properties[def.nameField] : '', code: f.properties ? f.properties[def.codeField] : '' }));
        })());
      }
      return cache.get(id);
    }

    return { BASEMAPS, get, features };
  });
})();
