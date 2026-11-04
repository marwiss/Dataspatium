// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * plotly.js as a component on demand (MIT, pinned to one version and digest on jsDelivr): draws the figures that
 * Python's plotly hands over as JSON (python/dataspatium.py), with a layout template built from the app's design
 * tokens, and exports them to SVG, PNG and PDF on the main thread. Not shipped in the ZIP; fetched after consent
 * the first time a plotly figure is shown.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/plotly', ['platform/components', 'viz/theme', 'viz/export'], (components, theme, vizExport) => {
    const VERSION = '4.2.0';
    const SPEC = { id: 'plotly.js', urls: [`https://cdn.jsdelivr.net/npm/plotly.js-dist-min@${VERSION}/plotly.min.js`], sha256: 'fde93964a7511bfa54c5745c49b5d0e41715cbde0cc5ebeae3f9a02de0396cae', size: 4841490, label: `plotly.js ${VERSION}`, version: VERSION, purpose: 'components' };
    /** @type {Promise<any>|null} */ let loading = null;
    /** @type {string|null} */ let sourceText = null;

    function available() { return !!globalThis.Plotly; }

    /** Load the library (from the component cache or jsDelivr after consent) and return the Plotly object. */
    function ensure(options = {}) {
      if (globalThis.Plotly) return Promise.resolve(globalThis.Plotly);
      if (!loading) {
        loading = (async () => {
          sourceText = await components.text(SPEC, options);
          const url = URL.createObjectURL(new Blob([sourceText], { type: 'text/javascript' }));
          try { await D.assets.loadScript(url); } finally { URL.revokeObjectURL(url); }
          if (!globalThis.Plotly) throw new Error(D.t('plotly.err.load'));
          return globalThis.Plotly;
        })().catch((err) => { loading = null; throw err; });
      }
      return loading;
    }

    /** The library's text, for standalone HTML (Publicera). */
    async function source() {
      if (!sourceText) await ensure();
      return sourceText || components.text(SPEC);
    }

    /** Layout template from the design tokens: palette, font, surfaces, grid, legend below the plot. */
    function template() {
      const tk = theme.tokens();
      const axis = { gridcolor: tk.grid, zerolinecolor: tk.border, linecolor: tk.border, tickcolor: tk.border, tickfont: { color: tk.muted }, title: { font: { color: tk.muted } }, automargin: true };
      return {
        layout: {
          colorway: tk.palette,
          font: { family: tk.font, color: tk.text, size: 13 },
          paper_bgcolor: tk.background, plot_bgcolor: tk.background,
          title: { font: { size: 16, color: tk.text }, x: 0, xanchor: 'left' },
          xaxis: axis, yaxis: axis,
          legend: { orientation: 'h', yanchor: 'top', y: -0.18, xanchor: 'left', x: 0, font: { color: tk.muted } },
          margin: { t: 56, r: 16, b: 56, l: 56 },
          hoverlabel: { font: { family: tk.font } },
          colorscale: { sequential: [[0, tk.sequential[0]], [1, tk.sequential[1]]], diverging: [[0, tk.diverging[0]], [0.5, tk.diverging[1]], [1, tk.diverging[2]]] },
        },
        data: {},
      };
    }

    /** The figure's layout with the app's template (replacing plotly's own) and optional fixed size. */
    function layoutFor(fig, options = {}) {
      const layout = Object.assign({}, (fig && fig.layout) || {});
      layout.template = template();
      if (options.width) layout.width = options.width;
      if (options.height) layout.height = options.height;
      if (!options.width && !options.height) { layout.autosize = true; delete layout.width; delete layout.height; }
      return layout;
    }

    /**
     * Draw a figure into an element. Returns a handle with finalize() that frees the plot.
     * @param {HTMLElement} el @param {any} fig figure JSON ({data, layout}) @param {{width?: number, height?: number}} [options]
     */
    async function render(el, fig, options = {}) {
      const Plotly = await ensure();
      await Plotly.newPlot(el, (fig && fig.data) || [], layoutFor(fig, options), { responsive: !options.width, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'] });
      return { finalize: () => { try { Plotly.purge(el); } catch (_err) { /* already gone */ } } };
    }

    function dataUrlToBlob(url) {
      const comma = url.indexOf(',');
      const head = url.slice(0, comma);
      const mime = (/data:([^;,]+)/.exec(head) || [])[1] || 'application/octet-stream';
      const payload = url.slice(comma + 1);
      if (/;base64/.test(head)) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(payload)], { type: mime });
    }

    /**
     * Export a figure without showing it: svg, png or pdf at the given pixel size.
     * @param {any} fig @param {'svg'|'png'|'pdf'} format @param {{width?: number, height?: number, scale?: number, title?: string}} [options]
     */
    async function toBlob(fig, format, options = {}) {
      const Plotly = await ensure();
      const width = Number(options.width) || 960;
      const height = Number(options.height) || Math.round(width * 0.6);
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'fixed', left: '-10000px', top: '0', width: width + 'px', height: height + 'px' });
      document.body.appendChild(el);
      try {
        await Plotly.newPlot(el, (fig && fig.data) || [], layoutFor(fig, { width, height }), { displaylogo: false, staticPlot: true });
        if (format === 'png') return dataUrlToBlob(await Plotly.toImage(el, { format: 'png', width, height, scale: options.scale || 2 }));
        const svgUrl = await Plotly.toImage(el, { format: 'svg', width, height });
        const svgText = await dataUrlToBlob(svgUrl).text();
        if (format === 'svg') return vizExport.svgBlob(svgText);
        if (format === 'pdf') return vizExport.svgToPdf(svgText, { title: options.title });
        throw new Error(D.t('err.unknown.format', { format }));
      } finally {
        try { Plotly.purge(el); } catch (_err) { /* ignore */ }
        el.remove();
      }
    }

    /** Markup for one figure in standalone HTML; the page includes the library (source()) once before it. */
    function htmlFor(id, fig, options = {}) {
      const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
      return `<div id="${id}" class="dm-plotly"></div><script>Plotly.newPlot(${json(id)}, ${json((fig && fig.data) || [])}, ${json(layoutFor(fig, options))}, {responsive: true, displaylogo: false});</script>`;
    }

    return { VERSION, SPEC, available, ensure, source, template, layoutFor, render, toBlob, htmlFor, dataUrlToBlob };
  });
})();
