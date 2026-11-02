// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dataset list shown in the object panel of most modes. Selecting an item updates
 * `store.selectedId`, which every mode reacts to.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dataset-list', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {HTMLElement} container
     * @param {{datasets: any[], selectedId: string|null, onSelect: (id: string) => void, extra?: Array<{id: string, label: string, icon: string, sub?: string}>, emptyHint?: string}} options
     */
    function render(container, options) {
      const items = [];
      items.push(h('h4', { text: t('shell.datasets') }));
      if (!options.datasets.length) {
        items.push(h('p', { class: 'dm-help', text: options.emptyHint || t('shell.no.datasets.hint') }));
      }
      items.push(h('div', { class: 'dm-list' }, options.datasets.map((ds) => item({
        id: ds.id, icon: 'table', label: ds.name,
        sub: `${t('common.rows', { n: i18n.formatNumber(ds.rowCount || 0) })} · ${t('common.columns', { n: ds.columnCount || 0 })}`,
        current: ds.id === options.selectedId, onSelect: options.onSelect,
      }))));
      if (options.extra && options.extra.length) {
        items.push(h('hr'));
        items.push(h('div', { class: 'dm-list' }, options.extra.map((x) => item(Object.assign({ current: x.id === options.selectedId, onSelect: options.onSelect }, x)))));
      }
      replace(container, items);
    }

    function item({ id, icon, label, sub, current, onSelect }) {
      return h('button', { type: 'button', class: 'dm-list-item', 'aria-current': current ? 'true' : null, onclick: () => onSelect(id) },
        icons.icon(icon, 16),
        h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: label }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
    }

    return { render };
  });
})();
