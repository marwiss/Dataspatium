// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dashboards: a named set of saved charts laid out in a grid, with shared filters on columns the charts'
 * datasets have in common. Records live in IndexedDB (table `dashboards`); the shareable
 * `*.dash.json` file embeds the chart definitions so that it is self-contained.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/dashboards', ['platform/storage/idb', 'viz/charts', 'data/datasets', 'viz/render', 'viz/pptx', 'viz/theme', 'platform/sync'], (idb, charts, datasets, render, pptx, theme, sync) => {
    const FORMAT = 'dataspatium-dash/1';
    const FILTERABLE = ['text', 'integer', 'date', 'boolean'];
    const listeners = new Set();
    function notify(type, payload) { for (const fn of listeners) { try { fn(type, payload); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    const newId = () => 'dash_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    async function list() { return idb.listDashboards(); }
    async function get(id) { return idb.getDashboard(id); }

    /** New record: `columns` is the grid width (1-3), `items` the charts in order, `filters` the shared filter columns. */
    function create(name) { return { id: null, name: name || '', description: '', columns: 2, items: [], filters: [] }; }

    /** Insert or update; returns the stored record. */
    async function save(dash) {
      const now = new Date().toISOString();
      const record = Object.assign({}, dash, {
        id: dash.id || newId(), createdAt: dash.createdAt || now, updatedAt: now,
        name: (dash.name || '').trim() || 'Namnlös dashboard',
        columns: Math.max(1, Math.min(3, Number(dash.columns) || 2)),
        items: (dash.items || []).map((it) => ({ chartId: it.chartId, span: Math.max(1, Math.min(3, Number(it.span) || 1)) })),
        filters: (dash.filters || []).map((f) => ({ column: f.column })),
      });
      await idb.putDashboard(record);
      notify('saved', record);
      sync.broadcast('dashboards', 'saved', { id: record.id, name: record.name });
      return record;
    }
    async function remove(id) { await idb.deleteDashboard(id); notify('deleted', { id }); sync.broadcast('dashboards', 'deleted', { id }); }
    sync.on((msg) => { if (msg.kind === 'dashboards') notify('remote', msg.payload); });

    /** The dashboard's charts in order; charts that no longer exist are skipped. */
    async function resolveCharts(dash) {
      const out = [];
      for (const item of dash.items || []) {
        const chart = item.chartId ? await charts.get(item.chartId) : null;
        if (chart) out.push({ item, chart });
      }
      return out;
    }

    /** Columns (by name) present in every dataset the dashboard's charts use, with a filterable type. */
    async function sharedColumns(dash) {
      const resolved = await resolveCharts(dash);
      const ids = Array.from(new Set(resolved.map((r) => r.chart.datasetId).filter(Boolean)));
      if (!ids.length) return [];
      let shared = null;
      for (const id of ids) {
        let cols;
        try { cols = await datasets.columns(id); } catch (_err) { return []; }
        const names = new Map(cols.filter((c) => FILTERABLE.includes(c.type)).map((c) => [c.name, c]));
        shared = shared ? new Map(Array.from(shared).filter(([n]) => names.has(n))) : names;
      }
      return shared ? Array.from(shared.values()).map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })) : [];
    }

    /** Filter values chosen in the filter bar -> extra filters for viz/render (empty values mean "all"). */
    function toExtraFilters(values) {
      return Object.entries(values || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([field, value]) => ({ field, op: '=', value }));
    }

    /** Shareable JSON with the chart definitions embedded (no ids, no thumbnails). */
    async function exportJson(dash) {
      const resolved = await resolveCharts(dash);
      const out = {
        format: FORMAT, name: dash.name, description: dash.description || '', columns: dash.columns || 2, filters: (dash.filters || []).map((f) => ({ column: f.column })),
        items: resolved.map(({ item, chart }) => ({ span: item.span || 1, chart: JSON.parse(charts.exportJson(chart)) })),
        created: new Date().toISOString(), app: 'Dataspatium', version: D.version,
      };
      return JSON.stringify(out, null, 2) + '\n';
    }

    /**
     * Import a dashboard file. Charts are matched to existing ones by name, kind and dataset name;
     * missing ones are created from the embedded definitions.
     */
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error('Filen är inte giltig JSON.'); }
      if (obj.format !== FORMAT || !Array.isArray(obj.items)) throw new Error('Filen är inte en Dataspatium-dashboard (format ' + FORMAT + ' saknas).');
      const existing = await charts.list();
      const items = [];
      for (const it of obj.items) {
        const c = it.chart || {};
        let match = existing.find((x) => x.name === c.name && x.kind === c.kind && x.datasetName === c.datasetName);
        if (!match) { match = await charts.importJson(JSON.stringify(c)); existing.push(match); }
        items.push({ chartId: match.id, span: it.span || 1 });
      }
      return save({ name: obj.name || 'Importerad dashboard', description: obj.description || '', columns: obj.columns || 2, items, filters: obj.filters || [] });
    }

    const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function filtersText(extraFilters) { return (extraFilters || []).map((f) => `${f.field} = ${f.value}`).join(', '); }

    /**
     * Standalone HTML with every Vega and D3 chart as inline SVG (R charts as their saved thumbnail).
     * @param {any} dash
     * @param {{extraFilters?: any[], width?: number, generatedText?: string, filtersLabel?: string}} [options] texts come from the caller (i18n lives in the UI)
     */
    async function toHtml(dash, options = {}) {
      const resolved = await resolveCharts(dash);
      const tk = theme.tokens();
      const sections = [];
      for (const { chart } of resolved) {
        let body = '';
        if (chart.kind === 'r') body = chart.thumbnail ? `<img src="${chart.thumbnail}" alt="${esc(chart.name)}">` : '';
        else body = (await (await render.toBlob(chart, 'svg', { width: options.width || 900, extraFilters: options.extraFilters })).text()).replace(/^<\?xml[^>]*>\s*/, '');
        sections.push(`<section><h2>${esc(chart.name)}</h2>${body}<p class="src">${esc(chart.datasetName || '')}</p></section>`);
      }
      const filt = filtersText(options.extraFilters);
      const meta = [options.generatedText || '', filt ? `${options.filtersLabel ? options.filtersLabel + ' ' : ''}${filt}` : ''].filter(Boolean).map(esc).join(' · ');
      const html = `<!doctype html>\n<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(dash.name)}</title>\n`
        + `<style>body{font-family:${tk.font};margin:32px;color:${tk.text};background:${tk.background}} h1{font-size:24px;margin:0 0 8px} h2{font-size:16px;margin:0 0 8px} section{break-inside:avoid;margin:0 0 32px;padding:16px;border:1px solid ${tk.border};border-radius:8px} svg,img{max-width:100%;height:auto} p{margin:4px 0} .src,.meta{color:${tk.muted};font-size:12px}</style></head>\n`
        + `<body><h1>${esc(dash.name)}</h1>${dash.description ? `<p>${esc(dash.description)}</p>` : ''}${meta ? `<p class="meta">${meta}</p>` : ''}\n${sections.join('\n')}\n</body></html>\n`;
      return new Blob([html], { type: 'text/html;charset=utf-8' });
    }

    /** A presentation with a title slide and one slide per chart. */
    async function toPptx(dash, options = {}) {
      const resolved = await resolveCharts(dash);
      const filt = filtersText(options.extraFilters);
      const subtitle = [dash.description || '', filt ? `${options.filtersLabel ? options.filtersLabel + ' ' : ''}${filt}` : ''].filter(Boolean).join(' · ');
      return pptx.fromCharts(resolved.map((r) => r.chart), { title: dash.name, subtitle, extraFilters: options.extraFilters, width: options.width, onProgress: options.onProgress });
    }

    return { list, get, create, save, remove, resolveCharts, sharedColumns, toExtraFilters, exportJson, importJson, toHtml, toPptx, filtersText, subscribe, FORMAT };
  });
})();
