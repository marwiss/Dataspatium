// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The fields for a place: a municipality or region, or a point and a distance. Söka and Fråga use the same form, and what
 * is typed goes into the object given, which `data/spatial-search` understands once `areaOf` has read it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/soka/place-form', ['ui/base', 'data/boundaries'], (base, boundaries) => {
    const { h, t, replace } = base;

    /** Whether enough has been given to search. @param {any} place */
    function complete(place) {
      if (place.type === 'region') return !!place.code;
      if (place.type === 'near') return !!(place.lat && place.lon && place.km);
      return false;
    }
    /**
     * What `data/spatial-search` asks for. Numbers can be typed with a decimal comma.
     * @param {any} place @returns {any}
     */
    function areaOf(place) {
      if (place.type === 'region') return { type: 'region', boundary: place.boundary, code: place.code };
      const num = (v) => Number(String(v).replace(',', '.'));
      return { type: 'near', lat: num(place.lat), lon: num(place.lon), km: num(place.km) };
    }
    /** The fields, without the choice of kind of place. */
    async function fieldsFor(holder, place) {
      if (place.type === 'region') {
        const setSel = /** @type {any} */ (h('dm-select', { label: t('soka.place.set') }));
        setSel.options = boundaries.BASEMAPS.map((b) => ({ value: b.id, label: t(b.key) }));
        setSel.value = place.boundary || boundaries.BASEMAPS[0].id;
        place.boundary = setSel.value;
        const features = await boundaries.features(place.boundary);
        const areaSel = /** @type {any} */ (h('dm-select', { label: t('soka.place.area') }));
        areaSel.options = [{ value: '', label: t('field.choose') }].concat(features.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'sv')).map((f) => ({ value: String(f.code), label: f.name })));
        areaSel.value = place.code || '';
        setSel.addEventListener('change', () => { place.boundary = setSel.value; place.code = ''; fieldsFor(holder, place); });
        areaSel.addEventListener('change', () => { place.code = areaSel.value; });
        replace(holder, setSel, areaSel);
      } else if (place.type === 'near') {
        const num = (key, label) => {
          const el = /** @type {any} */ (h('dm-input', { label, inputmode: 'decimal' }));
          el.value = place[key] === undefined ? '' : place[key];
          el.addEventListener('input', () => { place[key] = el.value; });
          return el;
        };
        replace(holder, num('lat', t('soka.place.lat')), num('lon', t('soka.place.lon')), num('km', t('soka.place.km')));
      } else replace(holder);
    }
    /**
     * The whole form.
     * @param {any} place where the answers go
     * @param {{any?: boolean}} [options] `any` offers "anywhere" as well
     * @returns {HTMLElement}
     */
    function create(place, options = {}) {
      const kindSel = /** @type {any} */ (h('dm-select', { label: t('soka.place') }));
      kindSel.options = (options.any ? [{ value: '', label: t('soka.place.any') }] : []).concat([{ value: 'region', label: t('soka.place.region') }, { value: 'near', label: t('soka.place.near') }]);
      if (!options.any && !place.type) place.type = 'region';
      kindSel.value = place.type || '';
      const fields = h('div', { class: 'dm-form-grid' });
      kindSel.addEventListener('change', () => { place.type = kindSel.value; fieldsFor(fields, place); });
      fieldsFor(fields, place);
      return h('div', { class: 'dm-stack-sm' }, kindSel, fields);
    }

    return { create, complete, areaOf };
  });
})();
