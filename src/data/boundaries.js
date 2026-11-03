// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The county and municipality boundaries that ship with the app (presets/geo, from SCB's
 * "Digitala gränser" under CC0, converted to WGS 84 by tools/build_boundaries.py). Used as map
 * backgrounds, as importable presets and for looking up the region of a coordinate. Parsed once per
 * session and cached.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/boundaries', [], () => {
    const BASEMAPS = [
      { id: 'lan', key: 'viz.basemap.lan', asset: 'presets/geo/lan.geojson', nameField: 'lan', codeField: 'lanskod' },
      { id: 'kommuner', key: 'viz.basemap.kommuner', asset: 'presets/geo/kommuner.geojson', nameField: 'kommun', codeField: 'kommunkod' },
    ];
    const cache = new Map();

    /** Definition of a boundary set or null. */
    function get(id) { return BASEMAPS.find((b) => b.id === id) || null; }

    /**
     * Features of a boundary set as [{geometry, name, code, props}] in WGS 84; [] for unknown ids.
     * @param {string} id
     * @returns {Promise<Array<{geometry: any, name: string, code: string, props: Record<string, any>}>>}
     */
    async function features(id) {
      const def = get(id);
      if (!def) return [];
      if (!cache.has(id)) {
        cache.set(id, (async () => {
          const fc = JSON.parse(await D.assets.loadText(def.asset));
          return (fc.features || []).map((f) => { const props = f.properties || {}; return { geometry: f.geometry, name: props[def.nameField] || '', code: props[def.codeField] || '', props }; });
        })());
      }
      return cache.get(id);
    }

    return { BASEMAPS, get, features };
  });
})();
