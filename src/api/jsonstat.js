// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * JSON-stat 2.0 (used by SCB PxWeb, Folkhälsomyndigheten and Eurostat): dataset -> long table with
 * one row per cell, dimension codes and labels as columns, and metrics (ContentsCode) as value
 * columns. Also exposes the dimension list, which PxWeb API 2 uses as table metadata.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/jsonstat', [], () => {
    /** Ordered categories of a dimension: [{code, label, index}]. */
    function categories(dim) {
      const cat = dim.category || {};
      let codes;
      if (Array.isArray(cat.index)) codes = cat.index.slice();
      else if (cat.index && typeof cat.index === 'object') codes = Object.entries(cat.index).sort((a, b) => a[1] - b[1]).map(([code]) => code);
      else if (cat.label) codes = Object.keys(cat.label);
      else codes = [];
      const labels = cat.label || {};
      return codes.map((code, i) => ({ code, label: labels[code] === undefined ? code : String(labels[code]), index: i }));
    }

    /**
     * Dimension list in PxWeb-variable form.
     * @returns {Array<{code: string, text: string, values: Array<{code: string, text: string}>, time: boolean, metric: boolean, elimination: boolean, codeLists: any[]}>}
     */
    function dimensions(ds) {
      const role = ds.role || {};
      const time = new Set(role.time || []);
      const metric = new Set(role.metric || []);
      return (ds.id || []).map((id) => {
        const dim = ds.dimension[id] || {};
        const ext = dim.extension || {};
        return {
          code: id, text: dim.label || id,
          values: categories(dim).map((c) => ({ code: c.code, text: c.label })),
          time: time.has(id), metric: metric.has(id) || id === 'ContentsCode',
          elimination: !!ext.elimination,
          codeLists: Array.isArray(ext.codeLists) ? ext.codeLists : [],
          unit: dim.category && dim.category.unit ? dim.category.unit : null,
        };
      });
    }

    /** JSON-stat 1.x keeps id, size and role inside `dimension`; lift them to the 2.0 positions. */
    function upgrade(ds) {
      if (ds && !Array.isArray(ds.id) && ds.dimension && Array.isArray(ds.dimension.id)) {
        return Object.assign({}, ds, { version: ds.version || '1.x', class: 'dataset', id: ds.dimension.id, size: ds.dimension.size || null, role: ds.dimension.role || ds.role || {} });
      }
      return ds;
    }
    function pickDataset(root) {
      if (root && root.class === 'dataset') return upgrade(root);
      if (root && root.class === 'collection' && root.link && Array.isArray(root.link.item)) {
        const first = root.link.item.find((it) => it.class === 'dataset');
        if (first) return upgrade(first);
      }
      if (root && typeof root === 'object' && !root.class) {
        // JSON-stat 1.x bundle: {name: {dataset}} (Statistics Denmark answers {dataset: {...}})
        const first = Object.values(root).find((v) => v && typeof v === 'object' && v.dimension);
        if (first) return upgrade(first);
      }
      throw new Error(D.t('api.err.jsonstat'));
    }

    /**
     * Convert a JSON-stat dataset to a table.
     * @param {any} root
     * @param {{codes?: 'both'|'label'|'code', metricWide?: boolean, valueColumn?: string}} [options]
     * @returns {{columns: string[], rows: any[][], types: Record<string, string>, meta: any}}
     */
    function toTable(root, options = {}) {
      const ds = pickDataset(root);
      const codesMode = options.codes || 'both';
      const metricWide = options.metricWide !== false;
      const ids = ds.id || [];
      const sizes = ds.size || ids.map((id) => categories(ds.dimension[id]).length);
      const dims = dimensions(ds);
      const cats = ids.map((id) => categories(ds.dimension[id]));
      const metricIndex = metricWide ? dims.findIndex((d) => d.metric) : -1;
      const columns = [];
      const types = {};
      const layout = [];
      dims.forEach((d, i) => {
        if (i === metricIndex) return;
        const base = d.text || d.code;
        const labelsDiffer = cats[i].some((c) => c.label !== c.code);
        if (d.time || !labelsDiffer || codesMode === 'code') {
          columns.push(base); types[base] = 'text'; layout.push({ dim: i, kind: 'code', col: columns.length - 1 });
        } else if (codesMode === 'label') {
          columns.push(base); types[base] = 'text'; layout.push({ dim: i, kind: 'label', col: columns.length - 1 });
        } else {
          columns.push(base + '_kod'); types[base + '_kod'] = 'text'; layout.push({ dim: i, kind: 'code', col: columns.length - 1 });
          columns.push(base); types[base] = 'text'; layout.push({ dim: i, kind: 'label', col: columns.length - 1 });
        }
      });
      const valueCols = [];
      if (metricIndex >= 0) {
        for (const c of cats[metricIndex]) { valueCols.push({ code: c.code, col: columns.length }); columns.push(c.label); types[c.label] = 'number'; }
      } else {
        valueCols.push({ code: null, col: columns.length }); columns.push(options.valueColumn || 'varde'); types[options.valueColumn || 'varde'] = 'number';
      }
      const hasStatus = ds.status !== undefined && ds.status !== null;
      let statusCol = -1;
      if (hasStatus) { statusCol = columns.length; columns.push('status'); types.status = 'text'; }

      const total = sizes.reduce((p, s) => p * s, 1);
      const strides = new Array(ids.length);
      for (let i = ids.length - 1, s = 1; i >= 0; i--) { strides[i] = s; s *= sizes[i]; }
      const valueAt = (k) => {
        const v = Array.isArray(ds.value) ? ds.value[k] : (ds.value ? ds.value[String(k)] : undefined);
        return v === undefined || v === null ? null : (typeof v === 'number' ? v : Number(String(v).replace(',', '.')));
      };
      const statusAt = (k) => {
        if (!hasStatus) return null;
        if (typeof ds.status === 'string') return ds.status;
        const v = Array.isArray(ds.status) ? ds.status[k] : ds.status[String(k)];
        return v === undefined ? null : v;
      };
      const rows = [];
      const rowIndex = new Map();
      const multi = new Array(ids.length);
      for (let k = 0; k < total; k++) {
        let rem = k;
        for (let i = 0; i < ids.length; i++) { multi[i] = Math.floor(rem / strides[i]); rem -= multi[i] * strides[i]; }
        let key = '';
        for (let i = 0; i < ids.length; i++) if (i !== metricIndex) key += multi[i] + '|';
        let row = rowIndex.get(key);
        if (!row) {
          row = new Array(columns.length).fill(null);
          for (const l of layout) { const c = cats[l.dim][multi[l.dim]]; row[l.col] = c ? (l.kind === 'code' ? c.code : c.label) : null; }
          rowIndex.set(key, row); rows.push(row);
        }
        const vc = metricIndex >= 0 ? valueCols[multi[metricIndex]] : valueCols[0];
        const v = valueAt(k);
        if (!Number.isNaN(v)) row[vc.col] = v; else row[vc.col] = null;
        if (statusCol >= 0) { const st = statusAt(k); if (st !== null && st !== undefined && st !== '') row[statusCol] = row[statusCol] ? row[statusCol] + ' ' + st : String(st); }
      }
      return { columns, rows, types, meta: { label: ds.label, source: ds.source, updated: ds.updated, note: ds.note || [], cells: total } };
    }

    return { toTable, dimensions, categories, pickDataset };
  });
})();
