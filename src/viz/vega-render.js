// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Loads Vega, Vega-Lite and vega-embed from the vendored builds, registers the app's colour schemes
 * and Swedish locale, and renders specs into the DOM or headless (for export and batch runs).
 *
 * A custom spec (a viz file can carry one) may name addresses for its data and its image marks; Vega's own loader would
 * fetch them on the page without consent. The loader here reads data from data: addresses and pictures from data:image/
 * only, and refuses the rest with a line in the console. A link (a mark's href) opens on a click in a tab of its own, without
 * the app as its opener, and only to an http(s) or mailto: address. The tooltip is the app's own: keys and values as text, a
 * picture only from a data:image/ address. A spec's usermeta.embedOptions are dropped, so the options here always hold.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/vega-render', ['viz/theme', 'viz/locale', 'platform/text'], (theme, locale, text) => {
    let loading = null;
    /** @type {any} */ let loader = null;
    /**
     * Vega's loader without the network: every data load, image and link goes through sanitize(), which refuses other addresses.
     * After Vega's own check of the address, a link gets target _blank and rel noopener noreferrer. The loader is frozen, so that
     * nothing a chart brings can change it for the charts after it.
     */
    function loaderFor(vega) {
      if (loader) return loader;
      const own = vega.loader();
      const sanitize = own.sanitize;
      own.sanitize = async function (uri, options) {
        const out = await sanitize.call(this, uri, options);
        const context = options && options.context;
        const href = String(out.href || '');
        if (context === 'href') {
          if (/^(?:https?:\/\/|mailto:)/i.test(href)) return Object.assign(out, { target: '_blank', rel: 'noopener noreferrer' });
          console.warn('[vega] left out a link whose address is not http(s) or mailto: ' + href.slice(0, 80));
          throw new Error('address refused: ' + href.slice(0, 80));
        }
        if (context === 'image' ? text.imageSource(href) : /^data:/i.test(href)) return out;
        if (context !== 'image') console.warn('[vega] left out data whose address is not data: ' + href.slice(0, 80));
        throw new Error('address refused: ' + href.slice(0, 80));
      };
      Object.freeze(own.options);
      loader = Object.freeze(own);
      return loader;
    }
    /** A nested tooltip value as JSON text, cut at `depth` levels as vega-tooltip does. */
    function nested(value, depth) {
      const parents = [];
      return JSON.stringify(value, function (_key, v) {
        if (typeof v !== 'object' || v === null) return v;
        parents.length = parents.indexOf(this) + 1;
        if (parents.length > depth) return '[Object]';
        if (parents.includes(v)) return '[Circular]';
        parents.push(v);
        return v;
      });
    }
    /**
     * The tooltip's HTML, in place of vega-tooltip's own (which writes the key `image` as a picture from any address): the title,
     * keys and values as escaped text, and a picture only from a data:image/ address. Any other `image` is a row of text and is
     * never loaded.
     * @param {any} value the mark's tooltip @param {any} _sanitize vega-tooltip's (not used) @param {number} [maxDepth]
     * @returns {string}
     */
    function tooltipHtml(value, _sanitize, maxDepth) {
      const esc = text.escapeHtml;
      const depth = Number.isInteger(maxDepth) ? maxDepth : 2;
      const show = (v) => esc(v !== null && typeof v === 'object' ? nested(v, depth) : v);
      if (Array.isArray(value)) return '[' + value.map(show).join(', ') + ']';
      if (value === null || typeof value !== 'object') return show(value);
      const { title, image, ...rest } = value;
      const picture = typeof image === 'string' && /^data:image\//i.test(image) ? text.imageSource(image) : '';
      if (!picture && image !== undefined && image !== null && image !== '') rest.image = image;
      let html = title !== undefined && title !== null && title !== '' ? `<h2>${show(title)}</h2>` : '';
      if (picture) html += `<img src="${esc(picture)}">`;
      const keys = Object.keys(rest).filter((k) => rest[k] !== undefined);
      if (keys.length) html += '<table>' + keys.map((k) => `<tr><td class="key">${esc(k)}</td><td class="value">${show(rest[k])}</td></tr>`).join('') + '</table>';
      return html || '{}';
    }
    /**
     * The spec without usermeta.embedOptions. vega-embed merges those over the options it is given, so a spec could turn the
     * actions menu back on, post its rows to an editor address of its choosing, write HTML around its source, change the
     * tooltip and the renderer, and write into the app's loader and locales.
     */
    function withoutEmbedOptions(spec) {
      const meta = spec && typeof spec === 'object' ? spec.usermeta : null;
      if (!meta || typeof meta !== 'object' || !('embedOptions' in meta)) return spec;
      const usermeta = Object.assign({}, meta);
      delete usermeta.embedOptions;
      return Object.assign({}, spec, { usermeta });
    }
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
     * Render into an element with vega-embed: no actions menu, the loader above, the app's tooltip and copies of the locales
     * (vega-embed may write into what it is given). The spec's own embed options are dropped first.
     * @returns {Promise<{view: any, spec: any, finalize: Function}>}
     */
    async function embed(el, spec, options = {}) {
      const { vega, vegaEmbed } = await ensureLibs();
      const result = await vegaEmbed(el, withoutEmbedOptions(spec), {
        actions: false, renderer: options.renderer || 'canvas', mode: 'vega-lite', loader: loaderFor(vega),
        config: theme.vegaConfig(options), formatLocale: structuredClone(locale.numberLocale), timeFormatLocale: structuredClone(locale.timeLocale),
        tooltip: options.tooltip !== false ? { theme: theme.tokens().dark ? 'dark' : 'light', formatTooltip: tooltipHtml } : false,
      });
      return { view: result.view, spec: result.spec, finalize: () => { try { result.finalize(); } catch (_e) { /* ignore */ } } };
    }

    /** Headless view (no DOM) for exports; `width` replaces a 'container' width. */
    async function headless(spec, options = {}) {
      const { vega, vegaLite } = await ensureLibs();
      const resolved = Object.assign({}, spec, spec.width === 'container' ? { width: options.width || 640 } : {});
      const vgSpec = vegaLite.compile(resolved, { config: theme.vegaConfig(options) }).spec;
      const view = new vega.View(vega.parse(vgSpec), { renderer: 'none', loader: loaderFor(vega) });
      await view.runAsync();
      return view;
    }
    async function toSvg(view) { return view.toSVG(); }
    async function toPng(view, scale = 2) {
      const canvas = await view.toCanvas(scale);
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(D.t('viz.err.png')))), 'image/png'));
    }

    return { ensureLibs, registerSchemes, embed, headless, toSvg, toPng, tooltipHtml };
  });
})();
