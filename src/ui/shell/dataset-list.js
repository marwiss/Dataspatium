// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dataset list shown in the object panel of most modes: a tree of folders (each dataset's `folder` path)
 * with the datasets inside, a filter box and a sort order when there are several datasets, and, where the mode
 * asks for it, check boxes for selecting several datasets and drag and drop into folders. Selecting an item
 * updates `store.selectedId`, which every mode reacts to.
 *
 *   datasetList.render(container, {datasets, selectedId, onSelect, extra?, emptyHint?,
 *                                  multi?, selectedIds?, onToggle?(ids), onMove?(ids, folder), tools?})
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dataset-list', ['ui/base', 'ui/icons', 'platform/storage/idb', 'data/kinds'], (base, icons, idb, kinds) => {
    const { h, t, i18n, replace } = base;
    /** The mark of a kind; the kinds themselves are described in data/kinds. */
    function kindIcon(kind) { return kinds.of(kind).icon; }
    /** One line about a dataset's size, in its own units. */
    const kindSummary = (ds) => kinds.summary(ds);
    const COLLAPSED_SETTING = 'ui.folders.collapsed';
    const SORTS = ['updated', 'name', 'rows'];
    const DRAG_TYPE = 'text/plain';
    /** Folders the user has collapsed; shared by all modes and kept between sessions. */
    const collapsed = new Set();
    idb.getSetting(COLLAPSED_SETTING, []).then((v) => { if (Array.isArray(v)) for (const p of v) collapsed.add(String(p)); }).catch(() => {});
    const persistCollapsed = () => { idb.setSetting(COLLAPSED_SETTING, Array.from(collapsed)).catch(() => {}); };
    /** Filter text, sort order and the last toggled id per panel (the container), kept between re-renders. */
    const panelState = new WeakMap();

    function sortDatasets(list, sort) {
      const copy = list.slice();
      if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name, i18n.locale()));
      else if (sort === 'rows') copy.sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0));
      else copy.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return copy;
    }

    /** Group datasets by folder path into a tree of {path, name, folders: Map, datasets, count}. */
    function buildTree(list) {
      const root = { path: '', name: '', folders: new Map(), datasets: [], count: 0 };
      for (const ds of list) {
        let node = root;
        node.count++;
        for (const seg of String(ds.folder || '').split('/').filter(Boolean)) {
          if (!node.folders.has(seg)) node.folders.set(seg, { path: node.path ? node.path + '/' + seg : seg, name: seg, folders: new Map(), datasets: [], count: 0 });
          node = node.folders.get(seg);
          node.count++;
        }
        node.datasets.push(ds);
      }
      return root;
    }

    /** Ids carried by a drag that started on a dataset row, or null. */
    function draggedIds(e) {
      try {
        const data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || 'null');
        return data && data.dataspatium === 'datasets' && Array.isArray(data.ids) ? data.ids : null;
      } catch (_e) { return null; }
    }

    /**
     * @param {HTMLElement} container
     * @param {{datasets: any[], selectedId: string|null, onSelect: (id: string) => void, extra?: Array<{id: string, label: string, icon: string, sub?: string}>, emptyHint?: string,
     *   multi?: boolean, selectedIds?: string[], onToggle?: (ids: string[]) => void, onMove?: (ids: string[], folder: string) => void, tools?: Node[]}} options
     */
    function render(container, options) {
      const state = panelState.get(container) || { filter: '', sort: 'updated', last: null };
      panelState.set(container, state);
      const multi = !!options.multi;
      const selectedIds = new Set(options.selectedIds || []);
      const rerender = () => render(container, options);

      // Drop targets: a folder row or the heading (the root).
      function dropTarget(el, folderPath) {
        if (!options.onMove) return;
        el.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dm-drop-target'); } });
        el.addEventListener('dragleave', () => el.classList.remove('dm-drop-target'));
        el.addEventListener('drop', (e) => {
          el.classList.remove('dm-drop-target');
          const ids = draggedIds(e);
          if (!ids) return;
          e.preventDefault();
          options.onMove(ids, folderPath);
        });
      }

      const header = h('div', { class: 'dm-list-head' },
        multi && selectedIds.size ? h('span', { class: 'dm-help', text: t('datasets.selected.count', { n: selectedIds.size }) }) : null);
      dropTarget(header, '');
      const items = [header];
      if (!options.datasets.length) items.push(h('p', { class: 'dm-help', text: options.emptyHint || t('shell.no.datasets.hint') }));
      if (options.datasets.length > 1 || state.filter) {
        const filterIn = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('datasets.filter'), 'aria-label': t('datasets.filter'), class: 'dm-list-filter' }));
        filterIn.value = state.filter;
        filterIn.addEventListener('input', () => {
          state.filter = filterIn.value;
          rerender();
          const again = /** @type {any} */ (container.querySelector('.dm-list-filter'));
          if (again) { again.focus(); const c = again.control; if (c && c.setSelectionRange) c.setSelectionRange(c.value.length, c.value.length); }
        });
        const sortSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('datasets.sort'), class: 'dm-list-sort' }));
        sortSel.options = SORTS.map((s) => ({ value: s, label: t('datasets.sort.' + s) }));
        sortSel.value = state.sort;
        sortSel.addEventListener('change', () => { state.sort = sortSel.value; rerender(); });
        items.push(h('div', { class: 'dm-list-tools' }, filterIn, sortSel));
      }
      const needle = state.filter.trim().toLowerCase();
      const shown = needle
        ? options.datasets.filter((d) => d.name.toLowerCase().includes(needle) || String(d.shortName || '').includes(needle) || (d.tags || []).some((x) => String(x).toLowerCase().includes(needle)) || String(d.folder || '').toLowerCase().includes(needle))
        : options.datasets;
      const sorted = sortDatasets(shown, state.sort);
      const visibleOrder = sorted.map((d) => d.id);
      const list = h('div', { class: 'dm-list dm-tree' });

      function toggle(id, shiftKey) {
        if (!options.onToggle) return;
        const next = new Set(selectedIds);
        if (shiftKey && state.last && visibleOrder.includes(state.last)) {
          const a = visibleOrder.indexOf(state.last); const b = visibleOrder.indexOf(id);
          const [from, to] = a < b ? [a, b] : [b, a];
          const on = !next.has(id);
          for (const x of visibleOrder.slice(from, to + 1)) { if (on) next.add(x); else next.delete(x); }
        } else if (next.has(id)) next.delete(id); else next.add(id);
        state.last = id;
        options.onToggle(Array.from(next));
      }

      function datasetRow(ds, depth) {
        const current = ds.id === options.selectedId;
        const btn = item({
          id: ds.id, icon: kindIcon(ds.kind), label: ds.name,
          // The short name is what SQL, R and chart files use to refer to the dataset.
          sub: `${ds.shortName ? ds.shortName + ' · ' : ''}${kindSummary(ds)}`,
          code: ds.shortName || '', current, onSelect: options.onSelect,
        });
        if (options.onMove) {
          btn.draggable = true;
          btn.addEventListener('dragstart', (e) => {
            const ids = selectedIds.has(ds.id) ? Array.from(selectedIds) : [ds.id];
            e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ dataspatium: 'datasets', ids }));
            e.dataTransfer.effectAllowed = 'move';
          });
        }
        if (!multi) { btn.style.setProperty('--dm-depth', String(depth)); return btn; }
        const box = h('input', { type: 'checkbox', 'aria-label': t('datasets.select', { name: ds.name }), checked: selectedIds.has(ds.id) ? true : null });
        box.addEventListener('click', (e) => { toggle(ds.id, e.shiftKey); });
        const row = h('div', { class: 'dm-tree-row', 'data-id': ds.id }, box, btn);
        row.style.setProperty('--dm-depth', String(depth));
        return row;
      }

      function renderNode(node, depth) {
        const folders = Array.from(node.folders.values()).sort((a, b) => a.name.localeCompare(b.name, i18n.locale()));
        for (const f of folders) {
          const isCollapsed = collapsed.has(f.path) && !needle;
          const row = h('button', {
            type: 'button', class: 'dm-list-item dm-tree-folder', 'data-folder': f.path, 'aria-expanded': isCollapsed ? 'false' : 'true', title: t('datasets.tree.folder.toggle'),
            onclick: () => { if (collapsed.has(f.path)) collapsed.delete(f.path); else collapsed.add(f.path); persistCollapsed(); rerender(); },
          }, icons.icon(isCollapsed ? 'chevron-right' : 'chevron-down', 14), icons.icon(isCollapsed ? 'folder' : 'folder-open', 16),
          h('span', { class: 'dm-truncate', text: f.name }), h('span', { class: 'dm-tree-count', text: i18n.formatNumber(f.count) }));
          row.style.setProperty('--dm-depth', String(depth));
          dropTarget(row, f.path);
          list.appendChild(row);
          if (!isCollapsed) renderNode(f, depth + 1);
        }
        for (const ds of node.datasets) list.appendChild(datasetRow(ds, depth));
      }
      renderNode(buildTree(sorted), 0);
      items.push(list);
      if (options.extra && options.extra.length) {
        items.push(h('hr'));
        items.push(h('div', { class: 'dm-list' }, options.extra.map((x) => item(Object.assign({ current: x.id === options.selectedId, onSelect: options.onSelect }, x)))));
      }
      if (options.tools && options.tools.length) items.push(h('div', { class: 'dm-list-actions' }, options.tools));
      replace(container, items);
    }

    function item({ id, icon, label, sub, code, current, onSelect }) {
      const subEl = sub ? h('span', { class: 'dm-list-sub dm-truncate' }) : null;
      if (subEl) {
        if (code) { subEl.appendChild(h('code', { class: 'dm-list-code', text: code })); subEl.appendChild(document.createTextNode(sub.slice(code.length))); }
        else subEl.textContent = sub;
      }
      return h('button', { type: 'button', class: 'dm-list-item', 'data-id': id, 'aria-current': current ? 'true' : null, title: code ? `${label} (${code})` : label, onclick: () => onSelect(id) },
        icons.icon(icon, 16),
        h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: label }), subEl));
    }

    return { render, buildTree, sortDatasets, kindIcon, kindSummary, SORTS };
  });
})();
