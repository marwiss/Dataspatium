// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Loads Vega, Vega-Lite and vega-embed from the vendored builds, registers the app's colour schemes
 * and Swedish locale, and renders specs into the DOM or headless (for export and batch runs).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/vega-render', ['viz/theme', 'viz/locale'], (theme, locale) => {
    let loading = null;
    async function ensureLibs() {
      if (!loading) {
        loading = (async () => {
          if (!globalThis.vega) await D.assets.loadVendorScript('vendor/vega/vega.min.js');
          if (!globalThis.vegaLite) await D.assets.loadVendorScript('vendor/vega-lite/vega-lite.min.js');
          if (!globalThis.vegaEmbed) await D.assets.loadVendorScript('vendor/vega-embed/vega-embed.min.js');
          const vega = globalThis.vega;
          vega.formatLocale(locale.numberLocale);
          vega.timeFormatLocale(locale.timeLocale);
          return { vega, vegaLite: globalThis.vegaLite, vegaEmbed: globalThis.vegaEmbed };
        })();
      }
      const libs = await loading;
      registerSchemes(libs.vega);
      return libs;
    }
    /** (Re)register the token-based schemes; called before every render so theme changes apply. */
    function registerSchemes(vega) {
      const tk = theme.tokens();
      vega.scheme('dataspatium-cat', tk.palette);
      vega.scheme('dataspatium-seq', (t) => theme.interpolateHex(tk.sequential[0], tk.sequential[1], t));
      vega.scheme('dataspatium-div', theme.diverging(tk.diverging[0], tk.diverging[1], tk.diverging[2]));
    }

    /**
     * Render into an element with vega-embed.
     * @returns {Promise<{view: any, spec: any, finalize: Function}>}
     */
    async function embed(el, spec, options = {}) {
      const { vegaEmbed } = await ensureLibs();
      const result = await vegaEmbed(el, spec, {
        actions: false, renderer: options.renderer || 'canvas', mode: 'vega-lite',
        config: theme.vegaConfig(options), formatLocale: locale.numberLocale, timeFormatLocale: locale.timeLocale,
        tooltip: options.tooltip !== false ? { theme: theme.tokens().dark ? 'dark' : 'light' } : false,
      });
      return { view: result.view, spec: result.spec, finalize: () => { try { result.finalize(); } catch (_e) { /* ignore */ } } };
    }

    /** Headless view (no DOM) for exports; `width` replaces a 'container' width. */
    async function headless(spec, options = {}) {
      const { vega, vegaLite } = await ensureLibs();
      const resolved = Object.assign({}, spec, spec.width === 'container' ? { width: options.width || 640 } : {});
      const vgSpec = vegaLite.compile(resolved, { config: theme.vegaConfig(options) }).spec;
      const view = new vega.View(vega.parse(vgSpec), { renderer: 'none' });
      await view.runAsync();
      return view;
    }
    async function toSvg(view) { return view.toSVG(); }
    async function toPng(view, scale = 2) {
      const canvas = await view.toCanvas(scale);
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte skapa PNG.'))), 'image/png'));
    }

    return { ensureLibs, registerSchemes, embed, headless, toSvg, toPng };
  });
})();
