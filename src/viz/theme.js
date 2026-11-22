// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * One look for every chart engine: reads the design tokens (src/ui/design/tokens.css) at render time
 * and turns them into a Vega config and a D3 style object. Light and dark themes come for free since
 * the tokens change with the theme.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/theme', ['viz/locale', 'ui/theme'], (locale, uiTheme) => {
    const FALLBACK_PALETTE = ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#56b4e9', '#cc79a7', '#f0e442', '#7f7f7f'];

    function cssVar(name, fallback) {
      if (typeof document === 'undefined') return fallback;
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }
    function hexToRgb(hex) {
      const m = String(hex).trim().replace('#', '');
      const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
      const n = parseInt(s, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    /** Linear RGB interpolation between two hex colours. */
    function interpolateHex(a, b, t) {
      const x = hexToRgb(a); const y = hexToRgb(b);
      return toHex(x.map((v, i) => v + (y[i] - v) * t));
    }
    /** Interpolator over a three-stop diverging palette. */
    function diverging(neg, mid, pos) { return (t) => (t < 0.5 ? interpolateHex(neg, mid, t * 2) : interpolateHex(mid, pos, (t - 0.5) * 2)); }
    const COLOUR_NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?';
    const COLOUR_FUNCTION = new RegExp(`^(?:rgba?|hsla?)\\(\\s*${COLOUR_NUMBER}(?:%|deg|rad|grad|turn)?(?:\\s*[,/]?\\s*${COLOUR_NUMBER}%?){2,3}\\s*\\)$`, 'i');
    /**
     * A colour that a chart definition names (a map layer's style, a class, a legend), kept only when it is a colour and
     * nothing else: #rgb, #rgba, #rrggbb or #rrggbbaa, rgb(), rgba(), hsl() or hsla() of numbers, or a colour's name. Where the
     * page has CSS.supports it must also accept the value as a colour. Anything else (a url(), more declarations, markup) gives
     * null, so the caller draws its own colour: the value goes into CSS, SVG attributes and published HTML.
     * @param {any} value @returns {string|null}
     */
    function cssColor(value) {
      if (typeof value !== 'string') return null;
      const v = value.trim().toLowerCase();
      if (!v || v.length > 64) return null;
      if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) && !COLOUR_FUNCTION.test(v) && !/^[a-z]{3,24}$/.test(v)) return null;
      const css = /** @type {any} */ (globalThis).CSS;
      return !css || typeof css.supports !== 'function' || css.supports('color', v) ? v : null;
    }

    /** Current token values relevant to charts. */
    function tokens() {
      const palette = FALLBACK_PALETTE.map((fb, i) => cssVar(`--dm-cat-${i + 1}`, fb));
      return {
        palette,
        sequential: [cssVar('--dm-seq-start', '#dbe9f6'), cssVar('--dm-seq-end', '#08306b')],
        diverging: [cssVar('--dm-div-neg', '#b2182b'), cssVar('--dm-div-mid', '#f7f7f7'), cssVar('--dm-div-pos', '#2166ac')],
        font: cssVar('--dm-font-sans', 'Inter, system-ui, sans-serif').replace(/"/g, ''),
        text: cssVar('--dm-text', '#1f252e'),
        muted: cssVar('--dm-text-muted', '#545c69'),
        faint: cssVar('--dm-text-faint', '#656e7b'),
        border: cssVar('--dm-border', '#e1e4e9'),
        grid: cssVar('--dm-n-100', '#eef0f3'),
        background: cssVar('--dm-surface', '#ffffff'),
        accent: cssVar('--dm-accent', '#2b6cb0'),
        ok: cssVar('--dm-ok', '#16703f'),
        warn: cssVar('--dm-warn', '#8f5a0b'),
        error: cssVar('--dm-error', '#c0392b'),
        dark: uiTheme.effective() === 'dark',
      };
    }

    /**
     * Vega config built from the tokens.
     * @param {{transparent?: boolean, background?: string, legend?: string}} [options]
     */
    function vegaConfig(options = {}) {
      const tk = tokens();
      return {
        background: options.transparent ? null : (options.background || tk.background),
        font: tk.font,
        padding: 12,
        view: { stroke: null },
        title: { font: tk.font, fontSize: 16, fontWeight: 600, color: tk.text, anchor: 'start', subtitleColor: tk.muted, subtitleFontSize: 12, subtitleFontWeight: 400, offset: 14 },
        axis: {
          labelFont: tk.font, titleFont: tk.font, labelColor: tk.muted, titleColor: tk.text, labelFontSize: 11, titleFontSize: 12, titleFontWeight: 500,
          domainColor: tk.border, tickColor: tk.border, gridColor: tk.grid, labelPadding: 4, titlePadding: 8, labelLimit: 180,
        },
        axisX: { grid: false },
        axisY: { grid: true, domain: false, ticks: false },
        legend: { labelFont: tk.font, titleFont: tk.font, labelColor: tk.muted, titleColor: tk.text, labelFontSize: 11, titleFontSize: 12, titleFontWeight: 500, symbolType: 'circle', orient: options.legend || 'right', labelLimit: 200 },
        header: { labelFont: tk.font, titleFont: tk.font, labelColor: tk.text, titleColor: tk.text, labelFontSize: 12, titleFontSize: 12 },
        range: {
          category: tk.palette,
          ordinal: { scheme: 'dataspatium-seq' },
          ramp: { scheme: 'dataspatium-seq' },
          heatmap: { scheme: 'dataspatium-seq' },
          diverging: { scheme: 'dataspatium-div' },
        },
        mark: { tooltip: true, color: tk.palette[0] },
        bar: { cornerRadiusEnd: 0 },
        line: { strokeWidth: 2 },
        area: { opacity: 0.85 },
        point: { size: 56, filled: true, opacity: 0.85 },
        circle: { size: 56, opacity: 0.85 },
        arc: { stroke: tk.background, strokeWidth: 1 },
        rect: { stroke: null },
        boxplot: { median: { color: tk.text } },
        text: { font: tk.font, fontSize: 11, color: tk.text },
      };
    }

    /** Style values for D3 templates. */
    function d3Style() {
      const tk = tokens();
      return Object.assign({}, tk, { label: 11, small: 10, title: 16, subtitle: 12, strokeWidth: 2, interpolateSeq: (t) => interpolateHex(tk.sequential[0], tk.sequential[1], t), interpolateDiv: diverging(tk.diverging[0], tk.diverging[1], tk.diverging[2]) });
    }

    return { tokens, vegaConfig, d3Style, interpolateHex, diverging, cssColor, FALLBACK_PALETTE, locale };
  });
})();
