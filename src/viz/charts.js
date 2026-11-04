// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Saved charts: records in IndexedDB (table `charts`), shareable `*.viz.json` files, and helpers to
 * create new chart records. A chart has a kind: 'vega' (builder state or custom spec), 'd3'
 * (template id and parameters), 'r' (an R script that draws with ggplot2 or base graphics) or 'python' (a
 * Python script that draws with matplotlib or plotly).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/charts', ['platform/storage/idb', 'data/datasets', 'platform/sync'], (idb, datasets, sync) => {
    const FORMAT = 'dataspatium-viz/1';
    const KINDS = ['vega', 'd3', 'r', 'python', 'map', 'graph', 'model'];
    const listeners = new Set();
    function notify(type, payload) { for (const fn of listeners) { try { fn(type, payload); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const newId = () => 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    async function list(datasetId) { return idb.listCharts(datasetId); }
    async function get(id) { return idb.getChart(id); }

    /** Insert or update; returns the stored record. */
    async function save(chart) {
      const now = new Date().toISOString();
      const record = Object.assign({}, chart, { id: chart.id || newId(), createdAt: chart.createdAt || now, updatedAt: now, name: (chart.name || '').trim() || D.t('viz.untitled') });
      await idb.putChart(record);
      notify('saved', record);
      sync.broadcast('charts', 'saved', { id: record.id, name: record.name });
      return record;
    }
    async function remove(id) { await idb.deleteChart(id); notify('deleted', { id }); sync.broadcast('charts', 'deleted', { id }); }
    sync.on((msg) => { if (msg.kind === 'charts') notify('remote', msg.payload); });

    /** New record for a dataset. */
    function create(kind, dataset, name) {
      const base = { id: null, kind, name: name || '', datasetId: dataset ? dataset.id : null, datasetName: dataset ? dataset.name : '', datasetShort: dataset ? dataset.shortName || '' : '', thumbnail: null, options: {} };
      if (kind === 'vega') base.vega = { type: 'bar', state: null, customSpec: null };
      if (kind === 'd3') base.d3 = { template: 'lollipop', params: {} };
      if (kind === 'r') base.r = { code: '' };
      // A Python chart keeps the plotly figure (JSON) it drew last, so dashboards can show it interactively.
      if (kind === 'python') base.python = { code: '', plotly: null };
      // A map keeps its layers, background map and view (viz/leaflet.defaultMap fills it when the chart opens).
      if (kind === 'map') base.map = null;
      // A graph chart keeps its definition (dataset, view, layout, focus); viz/graph-draw.defaultDef fills it when the chart opens.
      if (kind === 'graph') base.graph = null;
      if (kind === 'model') base.model = null;
      return base;
    }

    /** Shareable JSON (no thumbnail, no ids). `created` is the chart's last change, so an unchanged chart exports the same. */
    function exportJson(chart) {
      const out = { format: FORMAT, kind: chart.kind, name: chart.name, datasetName: chart.datasetName, datasetShort: chart.datasetShort || '', created: chart.updatedAt || chart.createdAt || new Date().toISOString(), app: 'Dataspatium', version: D.version };
      if (chart.kind === 'vega') out.vega = chart.vega;
      if (chart.kind === 'd3') out.d3 = chart.d3;
      if (chart.kind === 'r') out.r = chart.r;
      if (chart.kind === 'python') out.python = chart.python;
      if (chart.kind === 'map') out.map = chart.map;
      if (chart.kind === 'graph') out.graph = chart.graph;
      if (chart.kind === 'model') out.model = chart.model;
      out.options = chart.options || {};
      return JSON.stringify(out, null, 2) + '\n';
    }

    /** Import a viz file; the dataset is matched by name in this workspace (or left unbound). */
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error(D.t('err.invalid.json')); }
      if (obj.format !== FORMAT) throw new Error(D.t('viz.err.format', { format: FORMAT }));
      if (!KINDS.includes(obj.kind)) throw new Error(D.t('viz.err.kind', { kind: obj.kind }));
      const all = await datasets.list();
      // Matched by name, else by short name (the short name follows the dataset through renames and sharing).
      const match = all.find((d) => d.name === obj.datasetName) || (obj.datasetShort ? all.find((d) => d.shortName === obj.datasetShort) : null) || null;
      const chart = { id: null, kind: obj.kind, name: obj.name || D.t('viz.imported.name'), datasetId: match ? match.id : null, datasetName: obj.datasetName || '', datasetShort: obj.datasetShort || (match ? match.shortName : ''), thumbnail: null, options: obj.options || {} };
      if (obj.kind === 'vega') chart.vega = obj.vega || { type: 'bar', state: null, customSpec: null };
      if (obj.kind === 'd3') chart.d3 = obj.d3 || { template: 'lollipop', params: {} };
      if (obj.kind === 'r') chart.r = obj.r || { code: '' };
      if (obj.kind === 'python') chart.python = obj.python || { code: '', plotly: null };
      if (obj.kind === 'model') { chart.model = obj.model || null; if (chart.model) chart.model.datasetId = chart.datasetId; }
      if (obj.kind === 'graph') { chart.graph = obj.graph || null; if (chart.graph) { chart.graph.datasetId = chart.datasetId; chart.graph.datasetName = chart.datasetName; } }
      if (obj.kind === 'map') {
        chart.map = obj.map || null;
        // Layers point at datasets by id; after a transfer they are matched by name or short name like the chart itself.
        for (const layer of (chart.map && chart.map.layers) || []) {
          if (layer.kind !== 'dataset') continue;
          const m = all.find((d) => d.name === layer.datasetName) || (layer.datasetShort ? all.find((d) => d.shortName === layer.datasetShort) : null) || (layer.datasetId === obj.datasetId ? match : null);
          layer.datasetId = m ? m.id : null;
        }
      }
      return save(chart);
    }

    return { list, get, save, remove, create, exportJson, importJson, subscribe, FORMAT, KINDS };
  });
})();
