// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Gallery of saved charts: cards with thumbnails, a column toggle, and a "panel" mode that renders
 * every Vega and D3 chart live in a grid (the simple dashboard).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/gallery', ['ui/base', 'ui/basic', 'ui/icons', 'viz/render'], (base, basic, icons, render) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {{charts: any[], onOpen: Function, onExport: Function, onDelete: Function}} options
     */
    function create(options) {
      let columns = 2; let live = false;
      const handles = [];
      const el = h('div', { class: 'dm-stack' });
      function destroy() { for (const hd of handles) { try { hd.finalize(); } catch (_e) { /* ignore */ } } handles.length = 0; }

      function card(chart) {
        const body = h('div', { class: 'dm-gallery-body' });
        if (live && !D.require('viz/code-charts').isCode(chart.kind)) {
          const holder = h('div', { class: 'dm-chart-preview' });
          body.appendChild(holder);
          render.renderInto(chart, holder, { width: undefined }).then((hd) => handles.push(hd)).catch((err) => replace(holder, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })));
        } else if (chart.thumbnail) {
          body.appendChild(h('img', { class: 'dm-gallery-thumb', src: chart.thumbnail, alt: chart.name }));
        } else {
          body.appendChild(h('div', { class: 'dm-gallery-thumb dm-gallery-placeholder' }, icons.icon(chart.kind === 'r' ? 'terminal' : chart.kind === 'python' ? 'code' : 'chart-column', 32)));
        }
        return h('article', { class: 'dm-gallery-card dm-card' },
          h('div', { class: 'dm-gallery-head' },
            h('div', { class: 'dm-stack-sm' }, h('strong', { class: 'dm-truncate', text: chart.name }), h('span', { class: 'dm-help dm-truncate', text: [chart.datasetName, i18n.formatDateTime(chart.updatedAt)].filter(Boolean).join(' · ') })),
            h('dm-badge', { text: t('viz.kind.badge.' + chart.kind) })),
          body,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('viz.gallery.open'), icon: 'pencil', size: 'sm', variant: 'primary', onClick: () => options.onOpen(chart) }),
            basic.button({ label: t('viz.export'), icon: 'download', size: 'sm', onClick: () => options.onExport(chart) }),
            basic.button({ label: t('common.delete'), icon: 'trash-2', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => options.onDelete(chart) })));
      }

      function render_() {
        destroy();
        const cols = /** @type {any} */ (h('dm-select', { 'aria-label': t('viz.gallery.columns'), inline: true }));
        cols.options = [1, 2, 3].map((n) => ({ value: String(n), label: `${n} ${t('viz.gallery.columns').toLowerCase()}` }));
        cols.value = String(columns);
        cols.addEventListener('change', () => { columns = Number(cols.value); render_(); });
        const liveBtn = basic.button({ label: t('viz.gallery.live'), icon: 'layout-grid', variant: live ? 'primary' : 'default', onClick: () => { live = !live; render_(); } });
        replace(el,
          h('div', { class: 'dm-page-head' }, h('h1', null, icons.icon('chart-column', 20), t('viz.gallery'), ' ', h('dm-badge', { text: String(options.charts.length) })), h('div', { class: 'dm-row' }, cols, liveBtn)),
          options.charts.length ? h('div', { class: 'dm-gallery', style: { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } }, options.charts.map(card)) : h('dm-empty-state', { icon: 'chart-column', heading: t('viz.gallery'), text: t('viz.gallery.empty') }));
      }
      render_();
      return { el, render: render_, destroy, update(charts) { options.charts = charts; render_(); } };
    }
    return { create };
  });
})();
