// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Provenance on screen: the graph from left to right with the dataset in the middle, and the same things as a list, which is what
 * the keyboard and a screen reader use. A click on either opens the object.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/provenance-view', ['ui/base', 'data/provenance', 'viz/graph-draw'], (base, provenance, draw) => {
    const { h, t, replace } = base;
    const ICONS = { dataset: 'database', file: 'file', api: 'globe', url: 'link', paste: 'clipboard-paste', field: 'smartphone', recipe: 'list-checks', version: 'history', share: 'share-2', chart: 'chart-column', dashboard: 'chart-column', document: 'file-text', notebook: 'book-open', list: 'list-checks', flow: 'play' };
    /** Shapes tell the kinds apart without colour. */
    const SHAPES = { dataset: 'round-rectangle', recipe: 'hexagon', version: 'hexagon', share: 'diamond', chart: 'ellipse', dashboard: 'ellipse', document: 'ellipse', notebook: 'ellipse', list: 'ellipse', flow: 'ellipse' };
    const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    /** Open a node's object. @param {any} ctx @param {any} node */
    function openNode(ctx, node) {
      const o = node.open;
      if (!o) return;
      if (o.flow) { ctx.shell.openFlows('flows'); return; }
      if (o.store && Object.keys(o.store).length) ctx.store.set(o.store);
      if (o.mode && ctx.store.get().mode !== o.mode) ctx.shell.activate(o.mode);
    }
    function styles() {
      return [
        { selector: 'node', style: { label: 'data(label)', 'font-size': 11, 'font-family': token('--dm-font-sans') || 'sans-serif', color: token('--dm-text'), 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': 150, width: 170, height: 46, 'background-color': token('--dm-surface'), 'border-width': 1, 'border-color': token('--dm-border-strong') || token('--dm-border'), shape: 'data(shape)' } },
        { selector: 'node[?center]', style: { 'border-width': 3, 'border-color': token('--dm-accent') } },
        { selector: 'node[?openable]', style: { 'background-color': token('--dm-surface-2') || token('--dm-surface') } },
        { selector: 'edge', style: { width: 1.5, 'line-color': token('--dm-border-strong') || token('--dm-border'), 'target-arrow-color': token('--dm-border-strong') || token('--dm-border'), 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 9, color: token('--dm-text-muted'), 'text-background-color': token('--dm-bg') || token('--dm-surface'), 'text-background-opacity': 1, 'text-background-padding': 2 } },
      ];
    }
    /**
     * @param {any} ctx @param {any} ds the dataset
     * @returns {HTMLElement} fills itself in when the data has come
     */
    function create(ctx, ds) {
      const { ui, services } = ctx;
      const el = h('div', { class: 'dm-stack dm-provenance', 'data-provenance': '' }, h('dm-progress', { indeterminate: true, label: t('provenance.title') }));
      (async () => {
        const graph = await provenance.of(ds.id);
        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        const canvas = h('div', { class: 'dm-provenance-graph', 'aria-hidden': 'true' });
        const item = (n) => h('li', null, n.open
          ? h('button', { type: 'button', class: 'dm-list-item', 'data-provenance-node': n.id, onclick: () => openNode(ctx, n) }, ui.icon(ICONS[n.kind] || 'file', 16), h('span', { class: 'dm-list-main' }, h('span', { text: n.label }), h('span', { class: 'dm-list-sub', text: [t(`provenance.kind.${n.kind}`), n.detail].filter(Boolean).join(' · ') })))
          : h('div', { class: 'dm-list-item dm-list-item-static', 'data-provenance-node': n.id }, ui.icon(ICONS[n.kind] || 'file', 16), h('span', { class: 'dm-list-main' }, h('span', { text: n.label }), h('span', { class: 'dm-list-sub', text: [t(`provenance.kind.${n.kind}`), n.detail].filter(Boolean).join(' · ') }))));
        const part = (side, title) => {
          const found = graph.nodes.filter((n) => n.side === side);
          return found.length ? h('section', { class: 'dm-stack-sm', 'data-provenance-side': side }, h('h4', { text: title }), h('ul', { class: 'dm-list' }, found.map(item))) : null;
        };
        const alone = graph.nodes.length === 1;
        replace(el,
          h('div', { class: 'dm-row' },
            h('p', { class: 'dm-help dm-grow', text: t(alone ? 'provenance.none' : 'provenance.help') }),
            alone ? null : ui.button({ label: t('provenance.download'), icon: 'download', size: 'sm', title: t('provenance.download.hint'), onClick: () => services.files.download(new Blob([provenance.toMarkdown(graph)], { type: 'text/markdown' }), services.files.safeName(t('provenance.report', { name: ds.name }), 'md')) })),
          alone ? null : canvas,
          part('from', t('provenance.from')),
          part('to', t('provenance.to')));
        if (alone) return;
        const cytoscape = await draw.ensureCytoscape();
        if (!el.isConnected && !canvas.isConnected) return;
        const cy = cytoscape({
          container: canvas,
          elements: graph.nodes.map((n) => ({ data: { id: n.id, label: n.label, shape: SHAPES[n.kind] || 'round-rectangle', center: n.id === graph.center, openable: !!n.open } }))
            .concat(graph.edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e, i) => ({ data: { id: `e${i}`, source: e.from, target: e.to, label: e.label } }))),
          style: styles(), layout: { name: 'dagre', rankDir: 'LR', nodeSep: 18, rankSep: 70 }, wheelSensitivity: 0.3, minZoom: 0.2, maxZoom: 3,
        });
        cy.on('tap', 'node', (ev) => { const n = byId.get(ev.target.id()); if (n) openNode(ctx, n); });
        cy.fit(undefined, 16);
        /** @type {any} */ (el).cy = cy;
      })().catch((err) => {
        D.log('provenance', err);
        replace(el, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
      });
      return el;
    }

    return { create, openNode };
  });
})();
