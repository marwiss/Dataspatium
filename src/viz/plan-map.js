// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The map of a plan as a chart definition: land use in Boverket's colours, and the rest as outlines or themes. The plan view
 * saves it as a map view and the export draws it on a sheet.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/plan-map', ['viz/leaflet', 'data/plan-catalog'], (leaflet, catalog) => {
    /**
     * @param {any} ds a plan dataset @param {any[]} cols its columns
     * @returns {any} what a map chart holds
     */
    function defOf(ds, cols) {
      const slag = ds.plan && ds.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan';
      const def = leaflet.defaultMap(cols, ds);
      const colorValues = {};
      for (const [k, v] of Object.entries(catalog.COLORS)) colorValues[k.charAt(0).toUpperCase() + k.slice(1)] = v;
      if (slag === 'detaljplan') {
        const uses = leaflet.layerFor(cols, ds, 0); uses.name = D.t('plan.type.anvandning'); uses.filters = [{ field: 'objekttyp', op: '=', value: 'anvandning' }]; uses.colorBy = { column: 'farg', mode: 'category', values: colorValues }; uses.label = 'beteckning'; uses.popup = ['beteckning', 'formulering', 'kategori']; uses.style = Object.assign(uses.style, { weight: 1, fillOpacity: 0.6 });
        const outlines = leaflet.layerFor(cols, ds, 1); outlines.name = D.t('plan.layer.outlines'); outlines.filters = [{ field: 'objekttyp', op: '!=', value: 'anvandning' }]; outlines.colorBy = { column: 'objekttyp', mode: 'category', values: { planomrade: '#111111', egenskap: '#1f6fb2', administrativ: '#8a3ffc', overgang: '#777c84' } }; outlines.label = 'beteckning'; outlines.popup = ['beteckning', 'formulering', 'kategori']; outlines.style = Object.assign(outlines.style, { weight: 1.5, fillOpacity: 0.05 });
        def.layers = [uses, outlines];
      } else {
        const uses = leaflet.layerFor(cols, ds, 0); uses.name = D.t('plan.theme.markochvattenanvandning'); uses.filters = [{ field: 'tema', op: '=', value: 'markochvattenanvandning' }]; uses.colorBy = { column: 'innehallstyp', mode: 'category', values: plan.OP_USE_COLORS }; uses.label = 'innehallstyp'; uses.popup = ['innehallstyp', 'namn', 'precisering'];
        const rest = leaflet.layerFor(cols, ds, 1); rest.name = D.t('plan.layer.themes'); rest.filters = [{ field: 'tema', op: '!=', value: 'markochvattenanvandning' }]; rest.colorBy = { column: 'tema', mode: 'category', values: plan.OP_THEME_COLORS }; rest.label = 'namn'; rest.popup = ['tema', 'innehallstyp', 'namn']; rest.style = Object.assign(rest.style, { fillOpacity: 0.25 });
        def.layers = [uses, rest];
      }
      return def;
    }
    return { defOf };
  });
})();
