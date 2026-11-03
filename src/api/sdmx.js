// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * SDMX-JSON data messages (used by the ECB, the OECD, the IMF, the BIS and Eurostat's SDMX API), versions 1.0
 * and 2.0: dataset -> long table with one row per observation, the codes and names of every dimension as
 * columns, the value, and the observation and series attributes. Data may come per series
 * (`series` -> `observations`) or as flat observations (`dimensionAtObservation=AllDimensions`).
 * Version 1.0 has `dataSets` and `structure` at the top (ECB) or under `data` (OECD); version 2.0 has
 * `data.dataSets` and `data.structures`, and a dataset points to its structure by index.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/sdmx', [], () => {
    /** The part of the message that holds `dataSets`. */
    function rootOf(json) {
      if (json && json.data && Array.isArray(json.data.dataSets)) return json.data;
      return json;
    }

    /** Whether parsed JSON is an SDMX-JSON data message. */
    function isSdmxJson(json) {
      const root = rootOf(json);
      return !!root && typeof root === 'object' && Array.isArray(root.dataSets) && !!(root.structure || (Array.isArray(root.structures) && root.structures.length));
    }

    /** A name in the wanted language, else the default name, else the id. */
    function nameOf(item, lang) {
      if (!item) return '';
      if (item.names && lang && item.names[lang]) return String(item.names[lang]);
      if (typeof item.name === 'string' && item.name) return item.name;
      if (item.name && typeof item.name === 'object') return String(item.name[lang] || item.name.en || Object.values(item.name)[0] || item.id || '');
      return String(item.id || '');
    }

    const toValue = (v) => {
      if (v === null || v === undefined || v === '' || v === 'NaN') return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) && /^\s*-?[\d.,]+(e[+-]?\d+)?\s*$/i.test(String(v)) ? n : v;
    };

    /**
     * Long table of the first dataset (or `options.dataset`).
     * @param {any} json parsed SDMX-JSON message
     * @param {{lang?: string, codes?: 'both'|'code'|'label', valueColumn?: string, dataset?: number}} [options]
     * @returns {{columns: string[], rows: any[][], types: Record<string, string>, meta: any}}
     */
    function toTable(json, options = {}) {
      const root = rootOf(json);
      if (!isSdmxJson(json)) throw new Error(D.t('api.err.sdmx'));
      const index = options.dataset || 0;
      const ds = root.dataSets[index] || root.dataSets[0];
      const structures = Array.isArray(root.structures) ? root.structures : [root.structure];
      const st = structures[typeof ds.structure === 'number' ? ds.structure : 0] || structures[0];
      const lang = options.lang || (json.meta && Array.isArray(json.meta.contentLanguages) ? json.meta.contentLanguages[0] : undefined);
      const codesMode = options.codes || 'both';
      const dims = st.dimensions || {};
      const seriesDims = dims.series || [];
      const obsDims = dims.observation || [];
      const attrs = st.attributes || {};
      const seriesAttrs = attrs.series || [];
      const obsAttrs = attrs.observation || [];

      // Columns: every dimension (series first, then observation), codes and names where they differ.
      const columns = []; const types = {}; const used = new Set();
      const unique = (name) => { let n = name || 'kolumn'; for (let i = 2; used.has(n); i++) n = `${name}_${i}`; used.add(n); return n; };
      const layout = [];
      const addDim = (dim, from, pos) => {
        const base = nameOf(dim, lang) || dim.id;
        const values = dim.values || [];
        const time = dim.role === 'time' || dim.id === 'TIME_PERIOD' || (Array.isArray(dim.roles) && dim.roles.includes('TIME_PERIOD'));
        const labelsDiffer = values.some((v) => nameOf(v, lang) !== v.id);
        if (time || !labelsDiffer || codesMode === 'code') { const c = unique(base); columns.push(c); types[c] = 'text'; layout.push({ from, pos, values, kind: 'code' }); }
        else if (codesMode === 'label') { const c = unique(base); columns.push(c); types[c] = 'text'; layout.push({ from, pos, values, kind: 'label' }); }
        else {
          const code = unique(base + '_kod'); columns.push(code); types[code] = 'text'; layout.push({ from, pos, values, kind: 'code' });
          const label = unique(base); columns.push(label); types[label] = 'text'; layout.push({ from, pos, values, kind: 'label' });
        }
      };
      seriesDims.forEach((d, i) => addDim(d, 'series', i));
      obsDims.forEach((d, i) => addDim(d, 'obs', i));
      const valueCol = columns.length; const valueName = unique(options.valueColumn || 'varde'); columns.push(valueName); types[valueName] = 'number';
      const attrLayout = [];
      const addAttr = (attr, from, pos) => { const c = unique(nameOf(attr, lang) || attr.id); columns.push(c); types[c] = 'text'; attrLayout.push({ from, pos, attr, col: columns.length - 1 }); };
      seriesAttrs.forEach((a, i) => addAttr(a, 'series', i));
      obsAttrs.forEach((a, i) => addAttr(a, 'obs', i));

      const attrValue = (attr, idx) => {
        if (idx === null || idx === undefined) return null;
        const v = (attr.values || [])[idx];
        if (v === undefined) return typeof idx === 'number' ? null : String(idx);
        return nameOf(v, lang) || (v.id === undefined ? null : String(v.id));
      };
      const rows = [];
      const emit = (seriesIdx, obsIdx, arr, seriesAttrIdx) => {
        const row = new Array(columns.length).fill(null);
        let col = 0;
        for (const l of layout) {
          const idx = l.from === 'series' ? seriesIdx[l.pos] : obsIdx[l.pos];
          const v = l.values[idx];
          row[col++] = v ? (l.kind === 'code' ? String(v.id) : nameOf(v, lang)) : null;
        }
        row[valueCol] = toValue(Array.isArray(arr) ? arr[0] : arr);
        for (const a of attrLayout) {
          const idx = a.from === 'series' ? (seriesAttrIdx || [])[a.pos] : (Array.isArray(arr) ? arr[a.pos + 1] : undefined);
          row[a.col] = attrValue(a.attr, idx);
        }
        rows.push(row);
      };
      const split = (key) => (key === '' ? [] : String(key).split(':').map((k) => (k === '~' || k === '' ? -1 : Number(k))));
      if (ds.series && typeof ds.series === 'object') {
        for (const [skey, s] of Object.entries(ds.series)) {
          const sIdx = split(skey);
          for (const [okey, arr] of Object.entries((s && s.observations) || {})) emit(sIdx, split(okey), arr, s && s.attributes);
        }
      } else if (ds.observations && typeof ds.observations === 'object') {
        for (const [okey, arr] of Object.entries(ds.observations)) emit([], split(okey), arr, null);
      }

      // Attribute columns that are empty on every row are dropped.
      const keep = columns.map((_, i) => i <= valueCol || rows.some((r) => r[i] !== null && r[i] !== ''));
      const cols = columns.filter((_, i) => keep[i]);
      const outTypes = {}; for (const c of cols) outTypes[c] = types[c];
      if (rows.length && rows.some((r) => typeof r[valueCol] === 'string')) outTypes[valueName] = 'text';
      return {
        columns: cols,
        rows: keep.every(Boolean) ? rows : rows.map((r) => r.filter((_, i) => keep[i])),
        types: outTypes,
        meta: { label: nameOf(st, lang) || (ds.links && ds.links[0] && ds.links[0].urn) || '', prepared: (json.meta || json.header || {}).prepared, sender: ((json.meta || json.header || {}).sender || {}).id, observations: rows.length },
      };
    }

    return { isSdmxJson, toTable, nameOf };
  });
})();
