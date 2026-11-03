// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * One entry point to render any saved chart (Vega-Lite, D3 template or R script) on screen or to
 * SVG/PNG/PDF blobs. Used by Visualisera, Exportera and the batch runner.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/render', ['viz/vega-builder', 'viz/vega-render', 'viz/d3-templates', 'viz/data', 'viz/export', 'viz/theme', 'data/boundaries', 'data/datasets'], (builder, vegaRender, d3t, vizData, vizExport, theme, basemaps, datasets) => {
    /** Data for a Vega chart: rows plus the spec built for them. */
    async function prepareVega(chart, options = {}) {
      const meta = await datasets.get(chart.datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const columns = await datasets.columns(chart.datasetId);
      const v = chart.vega || {};
      if (v.customSpec) {
        const spec = JSON.parse(v.customSpec);
        const fields = v.state ? undefined : [];
        const data = await vizData.fetchRows(chart.datasetId, { fields, filters: (v.state && v.state.filters) || [], limit: (v.state && v.state.maxRows) || 50000 });
        spec.data = { values: data.rows };
        if (options.width !== undefined && spec.width === 'container') spec.width = options.width;
        return { spec, data, columns, meta };
      }
      const state = Object.assign({}, v.state || builder.defaultState(v.type || 'bar', columns), options.extraFilters ? { filters: ((v.state && v.state.filters) || []).concat(options.extraFilters) } : {});
      const request = builder.dataRequest(state, columns, meta.rowCount || 0);
      const data = await vizData.fetchRows(chart.datasetId, request);
      // Point maps draw over bundled county or municipality boundaries.
      const basemapId = builder.basemapOf(state);
      const basemap = basemapId ? await basemaps.features(basemapId) : undefined;
      const spec = builder.toSpec(state, columns, { values: data.rows, aliases: request.aliases, width: options.width, height: options.height, basemap });
      if (options.titleSuffix) spec.title = spec.title ? (typeof spec.title === 'string' ? spec.title + options.titleSuffix : Object.assign({}, spec.title, { text: spec.title.text + options.titleSuffix })) : options.titleSuffix.replace(/^\s*[–-]\s*/, '');
      return { spec, data, columns, meta, state };
    }

    async function prepareD3(chart, options = {}) {
      const meta = await datasets.get(chart.datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const params = Object.assign({}, (chart.d3 && chart.d3.params) || {});
      const tpl = d3t.get(chart.d3 && chart.d3.template);
      if (!tpl) throw new Error(D.t('d3.err.unknown.short'));
      const fields = tpl.params.filter((p) => p.type === 'column' && params[p.name]).map((p) => params[p.name]);
      const data = await vizData.fetchRows(chart.datasetId, { fields, filters: ((chart.options && chart.options.filters) || []).concat(options.extraFilters || []), limit: (chart.options && chart.options.maxRows) || 200000 });
      if (options.titleSuffix) params.title = (params.title || chart.name || '') + options.titleSuffix;
      return { data, params, tpl, meta };
    }

    /**
     * Render into a container. Returns handles for export.
     * @returns {Promise<{kind: string, svg: () => Promise<string>, png: (scale?: number) => Promise<Blob>, finalize: Function, info: any}>}
     */
    async function renderInto(chart, container, options = {}) {
      if (chart.kind === 'vega') {
        const prep = await prepareVega(chart, options);
        container.replaceChildren();
        const emb = await vegaRender.embed(container, prep.spec, { renderer: 'canvas', tooltip: true, transparent: false });
        return {
          kind: 'vega', info: { rows: prep.data.rows.length, total: prep.data.total, truncated: prep.data.truncated, aggregated: prep.data.aggregated, spec: prep.spec },
          svg: async () => { const view = await vegaRender.headless(prep.spec, { width: container.clientWidth ? container.clientWidth - 24 : 640 }); return vegaRender.toSvg(view); },
          png: async (scale = 2) => vegaRender.toPng(emb.view, scale),
          finalize: emb.finalize,
        };
      }
      if (chart.kind === 'd3') {
        const prep = await prepareD3(chart, options);
        const svg = await d3t.render(prep.tpl.id, container, prep.data.rows, prep.params, { width: options.width || Math.max(320, (container.clientWidth || 740) - 24), height: options.height });
        const text = () => d3t.svgString(svg);
        return { kind: 'd3', info: { rows: prep.data.rows.length, total: prep.data.total, truncated: prep.data.truncated }, svg: async () => text(), png: async (scale = 2) => vizExport.svgToPng(text(), { scale }), finalize: () => {} };
      }
      throw new Error(D.t('viz.err.rkind', { kind: chart.kind }));
    }

    /** Export a chart to a blob without showing it (vega and d3). */
    async function toBlob(chart, format, options = {}) {
      const width = options.width || 800;
      let svgText;
      if (chart.kind === 'vega') {
        const prep = await prepareVega(chart, Object.assign({}, options, { width }));
        const view = await vegaRender.headless(prep.spec, { width });
        if (format === 'png') return vegaRender.toPng(view, options.scale || 2);
        svgText = await vegaRender.toSvg(view);
      } else if (chart.kind === 'd3') {
        const prep = await prepareD3(chart, options);
        const holder = document.createElement('div');
        const svg = await d3t.render(prep.tpl.id, holder, prep.data.rows, prep.params, { width, height: options.height });
        svgText = d3t.svgString(svg);
        if (format === 'png') return vizExport.svgToPng(svgText, { scale: options.scale || 2 });
      } else {
        throw new Error(D.t('viz.err.r.export'));
      }
      if (format === 'svg') return vizExport.svgBlob(await vizExport.svgWithFonts(svgText));
      if (format === 'pdf') return vizExport.svgToPdf(svgText, { title: chart.name });
      throw new Error(D.t('err.unknown.format', { format }));
    }

    /** Small PNG data URL for lists and the gallery. */
    async function thumbnail(chart) {
      try {
        const blob = await toBlob(chart, 'png', { width: 480, height: 270, scale: 1 });
        return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
      } catch (_err) { return null; }
    }

    return { prepareVega, prepareD3, renderInto, toBlob, thumbnail, theme };
  });
})();
