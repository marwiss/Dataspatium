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

    /** Current token values relevant to charts. */
    function tokens() {
      const palette = FALLBACK_PALETTE.map((fb, i) => cssVar(`--dm-cat-${i + 1}`, fb));
      return {
        palette,
        sequential: [cssVar('--dm-seq-start', '#dbe9f6'), cssVar('--dm-seq-end', '#08306b')],
        diverging: [cssVar('--dm-div-neg', '#b2182b'), cssVar('--dm-div-mid', '#f7f7f7'), cssVar('--dm-div-pos', '#2166ac')],
        font: cssVar('--dm-font-sans', 'Inter, system-ui, sans-serif').replace(/"/g, ''),
        text: cssVar('--dm-text', '#1f252e'),
        muted: cssVar('--dm-text-muted', '#6b7583'),
        faint: cssVar('--dm-text-faint', '#9aa3b0'),
        border: cssVar('--dm-border', '#e1e4e9'),
        grid: cssVar('--dm-n-100', '#eef0f3'),
        background: cssVar('--dm-surface', '#ffffff'),
        accent: cssVar('--dm-accent', '#2b6cb0'),
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

    return { tokens, vegaConfig, d3Style, interpolateHex, diverging, FALLBACK_PALETTE, locale };
  });
})();
