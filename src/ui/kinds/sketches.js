// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Small pictures of what a dataset holds, for Inhämta and Hantera: a network as a ring, a line over time, bars per type.
 * They use the app's tokens through CSS classes and hold nothing but shapes and short labels set as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/sketches', ['ui/base'], (base) => {
    const { h } = base;
    const NS = 'http://www.w3.org/2000/svg';
    const WIDTH = 480; const HEIGHT = 200;
    const MAX_NODES = 60;
    const MAX_EDGES = 300;

    function svg(tag, attrs, ...children) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
      for (const c of children) if (c) el.appendChild(c);
      return el;
    }
    const frame = (label) => svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'dm-sketch', role: 'img', 'aria-label': label });

    /**
     * What to draw of a network, whatever it was read from.
     * @param {any[]} nodeIds @param {any[][]} edges pairs of node ids
     * @returns {{nodes: string[], edges: number[][]}}
     */
    function networkOf(nodeIds, edges) {
      const nodes = nodeIds.slice(0, MAX_NODES).map(String);
      const index = new Map(nodes.map((id, i) => [id, i]));
      const pairs = [];
      for (const [a, b] of edges) {
        const from = index.get(String(a)); const to = index.get(String(b));
        if (from !== undefined && to !== undefined) pairs.push([from, to]);
        if (pairs.length >= MAX_EDGES) break;
      }
      return { nodes, edges: pairs };
    }
    /** A network drawn as a ring: enough to see whether it hangs together. @param {{nodes: string[], edges: number[][]}} net @param {string} label */
    function network(net, label) {
      const root = frame(label);
      const n = net.nodes.length;
      const cx = WIDTH / 2; const cy = HEIGHT / 2; const r = HEIGHT / 2 - 12;
      const at = net.nodes.map((_, i) => { const a = (i / Math.max(1, n)) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
      for (const [a, b] of net.edges) root.appendChild(svg('line', { x1: at[a][0], y1: at[a][1], x2: at[b][0], y2: at[b][1], class: 'dm-sketch-edge' }));
      for (const p of at) root.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 4, class: 'dm-sketch-node' }));
      return root;
    }
    /** A line through values in order. @param {number[]} values @param {string} label */
    function line(values, label) {
      const root = frame(label);
      const low = Math.min(...values); const high = Math.max(...values);
      const span = high - low || 1;
      const x = (i) => 8 + (i / Math.max(1, values.length - 1)) * (WIDTH - 16);
      const y = (v) => HEIGHT - 8 - ((v - low) / span) * (HEIGHT - 16);
      root.appendChild(svg('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'dm-sketch-line' }));
      return root;
    }
    /** Bars per name, longest first. @param {Array<{name: string, count: number}>} rows */
    function bars(rows) {
      const top = Math.max(1, ...rows.map((r) => r.count));
      return h('div', { class: 'dm-sketch-bars' }, rows.map((r) => h('div', { class: 'dm-sketch-bar' },
        h('span', { class: 'dm-truncate dm-small', text: r.name }),
        h('span', { class: 'dm-sketch-track' }, h('span', { class: 'dm-sketch-fill', style: `width:${Math.round((r.count / top) * 100)}%` })),
        h('span', { class: 'dm-num dm-small', text: base.i18n.formatNumber(r.count) }))));
    }
    /** An SVG in text form as an image, so that nothing in it can run. @param {string} text @param {string} label */
    function imageOfSvg(text, label) {
      const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
      const img = /** @type {HTMLImageElement} */ (h('img', { src: url, alt: label, class: 'dm-sketch' }));
      const free = () => URL.revokeObjectURL(url);
      img.addEventListener('load', free, { once: true });
      img.addEventListener('error', free, { once: true });
      return img;
    }

    return { networkOf, network, line, bars, imageOfSvg };
  });
})();
