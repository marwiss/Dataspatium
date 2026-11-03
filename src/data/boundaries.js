// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The region and municipality boundaries that ship with the app (presets/geo, WGS 84): Sweden from SCB's
 * "Digitala gränser" under CC0 (tools/build_boundaries.py); Denmark, Norway and Finland from DAGI,
 * Kartverket's N1000 and Statistics Finland (tools/build_nordic_boundaries.py, see presets/geo/KALLA.md).
 * Used as map backgrounds, as importable presets and (Sweden) for looking up the region of a coordinate.
 * Parsed once per session and cached.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/boundaries', [], () => {
    const BASEMAPS = [
      { id: 'lan', key: 'viz.basemap.lan', asset: 'presets/geo/lan.geojson', nameField: 'lan', codeField: 'lanskod' },
      { id: 'kommuner', key: 'viz.basemap.kommuner', asset: 'presets/geo/kommuner.geojson', nameField: 'kommun', codeField: 'kommunkod' },
      { id: 'regioner-dk', key: 'viz.basemap.regioner-dk', asset: 'presets/geo/regioner-dk.geojson', nameField: 'region', codeField: 'regionskode' },
      { id: 'kommuner-dk', key: 'viz.basemap.kommuner-dk', asset: 'presets/geo/kommuner-dk.geojson', nameField: 'kommune', codeField: 'kommunekode' },
      { id: 'fylker-no', key: 'viz.basemap.fylker-no', asset: 'presets/geo/fylker-no.geojson', nameField: 'fylke', codeField: 'fylkesnummer' },
      { id: 'kommuner-no', key: 'viz.basemap.kommuner-no', asset: 'presets/geo/kommuner-no.geojson', nameField: 'kommune', codeField: 'kommunenummer' },
      { id: 'maakunnat-fi', key: 'viz.basemap.maakunnat-fi', asset: 'presets/geo/maakunnat-fi.geojson', nameField: 'maakunta', codeField: 'maakuntakoodi' },
      { id: 'kunnat-fi', key: 'viz.basemap.kunnat-fi', asset: 'presets/geo/kunnat-fi.geojson', nameField: 'kunta', codeField: 'kuntakoodi' },
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
