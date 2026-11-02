// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Saved charts: records in IndexedDB (table `charts`), shareable `*.viz.json` files, and helpers to
 * create new chart records. A chart has a kind: 'vega' (builder state or custom spec), 'd3'
 * (template id and parameters) or 'r' (an R script that draws with ggplot2 or base graphics).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/charts', ['platform/storage/idb', 'data/datasets'], (idb, datasets) => {
    const FORMAT = 'dataspatium-viz/1';
    const KINDS = ['vega', 'd3', 'r'];
    const listeners = new Set();
    function notify(type, payload) { for (const fn of listeners) { try { fn(type, payload); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const newId = () => 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    async function list(datasetId) { return idb.listCharts(datasetId); }
    async function get(id) { return idb.getChart(id); }

    /** Insert or update; returns the stored record. */
    async function save(chart) {
      const now = new Date().toISOString();
      const record = Object.assign({}, chart, { id: chart.id || newId(), createdAt: chart.createdAt || now, updatedAt: now, name: (chart.name || '').trim() || 'Namnlöst diagram' });
      await idb.putChart(record);
      notify('saved', record);
      return record;
    }
    async function remove(id) { await idb.deleteChart(id); notify('deleted', { id }); }

    /** New record for a dataset. */
    function create(kind, dataset, name) {
      const base = { id: null, kind, name: name || '', datasetId: dataset ? dataset.id : null, datasetName: dataset ? dataset.name : '', thumbnail: null, options: {} };
      if (kind === 'vega') base.vega = { type: 'bar', state: null, customSpec: null };
      if (kind === 'd3') base.d3 = { template: 'lollipop', params: {} };
      if (kind === 'r') base.r = { code: '' };
      return base;
    }

    /** Shareable JSON (no thumbnail, no ids). */
    function exportJson(chart) {
      const out = { format: FORMAT, kind: chart.kind, name: chart.name, datasetName: chart.datasetName, created: new Date().toISOString(), app: 'Dataspatium', version: D.version };
      if (chart.kind === 'vega') out.vega = chart.vega;
      if (chart.kind === 'd3') out.d3 = chart.d3;
      if (chart.kind === 'r') out.r = chart.r;
      out.options = chart.options || {};
      return JSON.stringify(out, null, 2) + '\n';
    }

    /** Import a viz file; the dataset is matched by name in this workspace (or left unbound). */
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error('Filen är inte giltig JSON.'); }
      if (obj.format !== FORMAT) throw new Error('Filen är inte ett Dataspatium-diagram (format ' + FORMAT + ' saknas).');
      if (!KINDS.includes(obj.kind)) throw new Error('Okänd diagramtyp: ' + obj.kind);
      const all = await datasets.list();
      const match = all.find((d) => d.name === obj.datasetName) || null;
      const chart = { id: null, kind: obj.kind, name: obj.name || 'Importerat diagram', datasetId: match ? match.id : null, datasetName: obj.datasetName || '', thumbnail: null, options: obj.options || {} };
      if (obj.kind === 'vega') chart.vega = obj.vega || { type: 'bar', state: null, customSpec: null };
      if (obj.kind === 'd3') chart.d3 = obj.d3 || { template: 'lollipop', params: {} };
      if (obj.kind === 'r') chart.r = obj.r || { code: '' };
      return save(chart);
    }

    return { list, get, save, remove, create, exportJson, importJson, subscribe, FORMAT, KINDS };
  });
})();
