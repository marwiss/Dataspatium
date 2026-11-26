// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dataset list shown in the object panel of most modes: a tree of folders (each dataset's `folder` path, and the empty
 * folders made with Ny mapp) with the datasets inside, a filter box and a sort order when there are several datasets, and,
 * where the mode asks for it, check boxes for datasets and whole folders, the tools right above the tree (Ny mapp, Byt namn,
 * Klipp ut, Kopiera, Klistra in, Flytta, Ta bort) with their keys, and drag and drop into folders. Selecting an item updates
 * `store.selectedId`, which every mode reacts to. The shell gives every mode the same tree (`withDefaults`, ui/batch-actions).
 *
 *   datasetList.render(container, {datasets, selectedId, onSelect, extra?, emptyHint?,
 *                                  multi?, selectedIds?, onToggle?(ids), onMove?(ids, folder), tools?,
 *                                  actions?, itemTrailing?(d)})
 *
 * `actions` does the work and resolves when it is done: remove(units) (asks first), paste(clip, target) (the ids pasted) and
 * rename(unit, name). Units are {ids, folders}: the folders chosen whole and the datasets chosen one by one outside them; a
 * clip is units with a mode, 'copy' or 'cut'. `itemTrailing(d)` is a control after a dataset's row (Bearbeta's map: Visa i
 * kartan), or null.
 * Keys on the tree: Delete, Ctrl+C, Ctrl+X, Ctrl+V, F2, the arrows, Home and End.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dataset-list', ['ui/base', 'ui/icons', 'ui/basic', 'platform/storage/idb', 'data/kinds', 'data/datasets'], (base, icons, basic, idb, kinds, datasets) => {
    const { h, t, i18n, replace } = base;
    /** The mark of a kind; the kinds themselves are described in data/kinds. */
    function kindIcon(kind) { return kinds.of(kind).icon; }
    /** One line about a dataset's size, in its own units. */
    const kindSummary = (ds) => kinds.summary(ds);
    const COLLAPSED_SETTING = 'ui.folders.collapsed';
    const EMPTY_SETTING = 'ui.folders.empty';
    const SORTS = ['updated', 'name', 'rows'];
    const DRAG_TYPE = 'text/plain';
    /** Folders the user has collapsed; shared by all modes and kept between sessions. */
    const collapsed = new Set();
    /** Folders made with Ny mapp that hold no dataset yet; a folder exists otherwise only through its datasets' paths. */
    const empty = new Set();
    idb.getSetting(COLLAPSED_SETTING, []).then((v) => { if (Array.isArray(v)) for (const p of v) collapsed.add(String(p)); }).catch(() => {});
    idb.getSetting(EMPTY_SETTING, []).then((v) => { if (Array.isArray(v)) for (const p of v) { const n = datasets.normalizeFolder(p); if (n) empty.add(n); } }).catch(() => {});
    const persistCollapsed = () => { idb.setSetting(COLLAPSED_SETTING, Array.from(collapsed)).catch(() => {}); };
    const persistEmpty = () => { idb.setSetting(EMPTY_SETTING, Array.from(empty)).catch(() => {}); };
    /** The empty folders that are checked (a folder with datasets is checked through them). Shared by all modes, like the selection. */
    const markedFolders = new Set();
    /** What Klipp ut or Kopiera took, for Klistra in: {mode, ids, folders}, or null. Shared by all modes. */
    let clipboard = null;
    /** Filter, sort, the last toggled id, the inline edit, the move picker and the options per panel (the container). */
    const panelState = new WeakMap();

    const within = (path, folder) => path === folder || path.startsWith(folder + '/');
    const parentOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    const leafOf = (path) => path.slice(path.lastIndexOf('/') + 1);
    const joinPath = (a, b) => (a ? a + '/' + b : b);

    /** Move every path at or below `from` to `to` in a set of paths. */
    function renameIn(set, from, to) {
      for (const p of Array.from(set)) if (within(p, from)) { set.delete(p); set.add(to + p.slice(from.length)); }
    }
    /**
     * The empty folders (Ny mapp), kept in the browser like the collapsed ones. The tree actions keep them in step when folders
     * are deleted, moved, renamed or copied.
     */
    const folders = {
      /** @returns {string[]} */
      list: () => Array.from(empty).sort((a, b) => a.localeCompare(b, i18n.locale())),
      /** @param {string} path @returns {string} the normalised path ('' when there is none) */
      add(path) { const p = datasets.normalizeFolder(path); if (p) { empty.add(p); persistEmpty(); } return p; },
      /** A folder and everything below it is gone. @param {string} path */
      removeUnder(path) {
        for (const set of [empty, markedFolders, collapsed]) for (const p of Array.from(set)) if (within(p, path)) set.delete(p);
        persistEmpty(); persistCollapsed();
      },
      /** A folder moved or renamed: what was below it follows. @param {string} from @param {string} to */
      move(from, to) { renameIn(empty, from, to); renameIn(markedFolders, from, to); renameIn(collapsed, from, to); persistEmpty(); persistCollapsed(); },
      /** A folder copied: its empty folders are copied too. @param {string} from @param {string} to */
      copy(from, to) { for (const p of Array.from(empty)) if (within(p, from)) empty.add(to + p.slice(from.length)); persistEmpty(); },
    };

    function sortDatasets(list, sort) {
      const copy = list.slice();
      if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name, i18n.locale()));
      else if (sort === 'rows') copy.sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0));
      else copy.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return copy;
    }

    /**
     * Group datasets by folder path into a tree of {path, name, folders: Map, datasets, count, marker}. `extra` are empty folders
     * (marker: true); count is the number of datasets in a folder and below it.
     * @param {any[]} list @param {string[]} [extra]
     */
    function buildTree(list, extra) {
      const node = (path, name) => ({ path, name, folders: new Map(), datasets: [], count: 0, marker: false });
      const root = node('', '');
      const step = (at, seg) => {
        if (!at.folders.has(seg)) at.folders.set(seg, node(at.path ? at.path + '/' + seg : seg, seg));
        return at.folders.get(seg);
      };
      for (const p of extra || []) { let at = root; for (const seg of String(p).split('/').filter(Boolean)) at = step(at, seg); if (at !== root) at.marker = true; }
      for (const ds of list) {
        let at = root;
        at.count++;
        for (const seg of String(ds.folder || '').split('/').filter(Boolean)) { at = step(at, seg); at.count++; }
        at.datasets.push(ds);
      }
      return root;
    }
    /** The folder node at a path, or null. */
    function findNode(root, path) {
      let at = root;
      for (const seg of String(path || '').split('/').filter(Boolean)) { at = at.folders.get(seg); if (!at) return null; }
      return at;
    }
    /** Every folder path in a tree, depth first. */
    function folderPathsOf(root) {
      const out = [];
      (function walk(n) { for (const f of n.folders.values()) { out.push(f.path); walk(f); } })(root);
      return out;
    }
    /** What a folder holds all the way down: the ids of its datasets and the empty folders among it and its subfolders. */
    function contents(node) {
      const ids = []; const marks = [];
      (function walk(n) { if (n.marker) marks.push(n.path); for (const d of n.datasets) ids.push(d.id); for (const f of n.folders.values()) walk(f); })(node);
      return { ids, marks };
    }
    /**
     * Whether all, some or none of what a folder holds is selected.
     * @param {any} node @param {Set<string>} ids @param {Set<string>} marks @returns {'all'|'some'|'none'}
     */
    function folderState(node, ids, marks) {
      const c = contents(node);
      const total = c.ids.length + c.marks.length;
      const n = c.ids.filter((id) => ids.has(id)).length + c.marks.filter((p) => marks.has(p)).length;
      return !total || !n ? 'none' : n === total ? 'all' : 'some';
    }
    /**
     * The selection as units: the outermost folders selected whole, and the datasets selected one by one outside them.
     * @param {any} root @param {Set<string>} ids @param {Set<string>} marks @returns {{ids: string[], folders: string[]}}
     */
    function unitsOf(root, ids, marks) {
      const out = { ids: [], folders: [] };
      (function walk(n) {
        for (const f of n.folders.values()) { if (folderState(f, ids, marks) === 'all') out.folders.push(f.path); else walk(f); }
        for (const d of n.datasets) if (ids.has(d.id)) out.ids.push(d.id);
      })(root);
      return out;
    }
    /**
     * Where Klistra in and Ny mapp put things: the one folder chosen whole, the folder of the datasets chosen when they share
     * one, the current dataset's folder when nothing is checked, else the root. A folder on the clipboard is pasted beside
     * itself, not into itself.
     * @param {{ids: string[], folders: string[]}} units @param {Map<string, any>} byId @param {any} current @param {any} [clip]
     */
    function targetOf(units, byId, current, clip) {
      let target = '';
      if (units.folders.length === 1 && !units.ids.length) target = units.folders[0];
      else if (!units.folders.length && units.ids.length) {
        const where = new Set(units.ids.map((id) => (byId.get(id) ? byId.get(id).folder || '' : '')));
        if (where.size === 1) target = Array.from(where)[0];
      } else if (!units.folders.length && !units.ids.length && current) target = current.folder || '';
      if (clip && clip.folders.includes(target)) target = parentOf(target);
      return target;
    }
    const count = (u) => u.ids.length + u.folders.length;

    /** Ids and folders carried by a drag that started in the tree, or null. */
    function dragged(e) {
      try {
        const data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || 'null');
        return data && data.dataspatium === 'datasets' && Array.isArray(data.ids) ? { ids: data.ids, folders: Array.isArray(data.folders) ? data.folders : [] } : null;
      } catch (_e) { return null; }
    }

    /** Where the focus is in a panel, so that it can come back after the panel is drawn again. */
    function focusOf(container) {
      const a = /** @type {HTMLElement|null} */ (document.activeElement);
      if (!a || !container.contains(a)) return null;
      if (a.closest('.dm-list-filter')) return { filter: true };
      const tool = a.closest('[data-tool]');
      if (tool) return { tool: tool.getAttribute('data-tool') };
      const row = a.closest('[data-key]');
      if (!row) return null;
      const part = a.closest('[data-part]');
      const rows = Array.from(container.querySelectorAll('.dm-tree [data-key]'));
      return { key: row.getAttribute('data-key'), part: part ? part.getAttribute('data-part') : 'main', index: rows.indexOf(row) };
    }
    function focusEl(el, selectAll) {
      if (!el) return false;
      const control = /** @type {any} */ (el).control || el;
      if (control.disabled) return false;
      control.focus();
      if (control.setSelectionRange && typeof control.value === 'string') { if (selectAll) control.select(); else control.setSelectionRange(control.value.length, control.value.length); }
      return true;
    }
    function restoreFocus(container, f) {
      if (!f) return;
      if (f.filter) { focusEl(container.querySelector('.dm-list-filter'), false); return; }
      if (f.tool) {
        const el = container.querySelector(`[data-tool="${CSS.escape(f.tool)}"]`);
        if (el && focusEl(el.tagName === 'DM-BUTTON' ? el.querySelector('button') : el, false)) return;
      }
      if (f.key && focusEl(container.querySelector(`.dm-tree [data-key="${CSS.escape(f.key)}"] [data-part="${f.part || 'main'}"]`), !!f.select)) return;
      // The row is gone (deleted, moved): the one now in its place, else the first.
      const mains = Array.from(container.querySelectorAll('.dm-tree [data-part="main"]'));
      if (mains.length) focusEl(mains[Math.max(0, Math.min(f.index === undefined || f.index < 0 ? 0 : f.index, mains.length - 1))], false);
    }

    /**
     * @param {HTMLElement} container
     * @param {{datasets: any[], selectedId: string|null, onSelect: (id: string) => void, extra?: Array<{id: string, label: string, icon: string, sub?: string}>, emptyHint?: string,
     *   multi?: boolean, selectedIds?: string[], onToggle?: (ids: string[]) => void, onMove?: (ids: string[], folder: string) => void, tools?: Node[],
     *   actions?: {remove: (units: any) => Promise<any>, paste: (clip: any, target: string) => Promise<string[]>, rename: (unit: any, name: string) => Promise<any>},
     *   itemTrailing?: (d: any) => (Node|null)}} options
     */
    function render(container, options) {
      let state = panelState.get(container);
      if (!state) {
        // The tree draws itself again in its own element (a box that does not take part in the layout), so that what a mode
        // adds to the panel below it (Visualisera's charts, Analysera's notebooks) stays when only the tree changes.
        state = { filter: '', sort: 'updated', last: null, renders: 0, editing: null, moving: null, busy: false, focus: null, root: h('div', { class: 'dm-tree-panel' }) };
        panelState.set(container, state);
      }
      state.options = options;
      state.selected = new Set(options.selectedIds || []);
      state.renders++;
      if (!state.focus) state.focus = focusOf(state.root);
      replace(container, state.root);
      draw(state.root, state);
    }

    function draw(container, state) {
      const options = state.options;
      const multi = !!options.multi;
      const actions = options.actions || null;
      const selected = state.selected;
      const redraw = () => draw(container, state);
      const all = options.datasets;
      const byId = new Map(all.map((d) => [d.id, d]));
      const marks = folders.list();
      const full = buildTree(all, marks);
      const knownFolders = new Set(folderPathsOf(full));
      for (const p of Array.from(markedFolders)) if (!knownFolders.has(p)) markedFolders.delete(p);
      const focus = state.focus || focusOf(container);
      state.focus = null;

      // ---- the selection, and what the tools act on ----
      const units = () => (multi ? unitsOf(full, selected, markedFolders) : { ids: [], folders: [] });
      const unitOfKey = (key) => (key.startsWith('f:') ? { ids: [], folders: [key.slice(2)] } : { ids: [key.slice(2)], folders: [] });
      /** The checked items, else the row with the focus (keys), else the current dataset. */
      function targets(key) {
        const u = units();
        if (count(u)) return u;
        if (key && key !== 'new') return unitOfKey(key);
        const current = byId.get(options.selectedId);
        return current ? { ids: [current.id], folders: [] } : { ids: [], folders: [] };
      }
      const current = byId.get(options.selectedId);
      const isCut = (path, id) => !!clipboard && clipboard.mode === 'cut' && ((id && clipboard.ids.includes(id)) || clipboard.folders.some((f) => within(path, f)));
      function select(next) {
        state.selected = next;
        const before = state.renders;
        if (options.onToggle) options.onToggle(Array.from(next));
        if (state.renders === before) redraw();
      }
      function run(task) {
        if (state.busy) return Promise.resolve();
        // Where the focus goes when the work is done: where it was asked to go, else where it is.
        const back = state.focus || focusOf(container);
        state.busy = true; redraw();
        return Promise.resolve().then(task).catch((err) => D.log('dataset-list', err)).finally(() => {
          state.busy = false;
          const a = document.activeElement;
          if (!state.focus && (!a || a === document.body || container.contains(a))) state.focus = back;
          redraw();
        });
      }

      // ---- the tools ----
      function doRemove(key) {
        const u = targets(key);
        if (!actions || !count(u)) return;
        run(async () => {
          if (!(await actions.remove(u))) return;
          if (clipboard) {
            const gone = (id) => u.ids.includes(id) || u.folders.some((f) => byId.get(id) && within(byId.get(id).folder || '', f));
            clipboard.ids = clipboard.ids.filter((id) => !gone(id));
            clipboard.folders = clipboard.folders.filter((p) => !u.folders.some((f) => within(p, f)));
            if (!count(clipboard)) clipboard = null;
          }
        });
      }
      function doClip(mode, key) {
        const u = targets(key);
        if (!actions || !count(u)) return;
        clipboard = { mode, ids: u.ids.slice(), folders: u.folders.slice() };
        redraw();
      }
      function doPaste(key) {
        if (!actions || !clipboard) return;
        const clip = clipboard;
        // Keys paste where the focus is (into a folder, beside a dataset); the tool where the selection is.
        let target;
        if (key && key.startsWith('f:')) target = key.slice(2);
        else if (key && key.startsWith('d:') && byId.get(key.slice(2))) target = byId.get(key.slice(2)).folder || '';
        else target = targetOf(units(), byId, current);
        if (clip.folders.includes(target)) target = parentOf(target);
        run(async () => {
          const ids = await actions.paste(clip, target);
          if (clip.mode === 'cut') clipboard = null;
          if (ids && ids.length && multi) { markedFolders.clear(); select(new Set(ids)); }
        });
      }
      function reveal(path) { let changed = false; for (let p = path; p; p = parentOf(p)) if (collapsed.delete(p)) changed = true; if (changed) persistCollapsed(); }
      function doRename(key) {
        const u = targets(key);
        if (!actions || count(u) !== 1) return;
        const editKey = u.folders.length ? 'f:' + u.folders[0] : 'd:' + u.ids[0];
        const original = u.folders.length ? leafOf(u.folders[0]) : (byId.get(u.ids[0]) || {}).name || '';
        reveal(u.folders.length ? parentOf(u.folders[0]) : ((byId.get(u.ids[0]) || {}).folder || ''));
        state.editing = { kind: 'rename', key: editKey, unit: u, value: original, original };
        state.focus = { key: editKey, part: 'edit', select: true };
        redraw();
      }
      function doNewFolder() {
        const parent = targetOf(units(), byId, current);
        const node = findNode(full, parent);
        const names = new Set(node ? Array.from(node.folders.keys()) : []);
        let name = t('datasets.tree.newfolder.name');
        for (let n = 2; names.has(name); n++) name = t('datasets.tree.newfolder.name.n', { n });
        reveal(parent);
        state.editing = { kind: 'new', key: 'new', parent, value: name, original: '' };
        state.focus = { key: 'new', part: 'edit', select: true };
        redraw();
      }
      function finishEdit(save) {
        const edit = state.editing;
        if (!edit) return;
        state.editing = null;
        const value = String(edit.value || '').trim();
        if (!save || !value || value === edit.original) { state.focus = edit.kind === 'new' ? null : { key: edit.key, part: 'main' }; redraw(); return; }
        if (edit.kind === 'new') {
          const path = datasets.normalizeFolder(joinPath(edit.parent, value.replace(/\//g, ' ')));
          if (path && !knownFolders.has(path)) folders.add(path);
          state.focus = { key: 'f:' + path, part: 'main' };
          redraw();
          return;
        }
        state.focus = { key: edit.key, part: 'main' };
        run(() => actions.rename(edit.unit, value));
      }
      function openMove() {
        const u = targets(null);
        if (!actions || !count(u)) return;
        state.moving = u;
        state.focus = { tool: 'move-to' };
        redraw();
      }

      const header = h('div', { class: 'dm-list-head' },
        multi && selected.size ? h('span', { class: 'dm-help', text: t('datasets.selected.count', { n: selected.size }) }) : null,
        clipboard ? h('span', { class: 'dm-help', 'data-clip': clipboard.mode, text: t('datasets.tree.clip.' + clipboard.mode, { n: count(clipboard) }) }) : null);
      dropTarget(header, '');
      const items = [header];
      const anything = all.length > 0 || marks.length > 0;
      if (!all.length) items.push(h('p', { class: 'dm-help', text: options.emptyHint || t('shell.no.datasets.hint') }));
      if (all.length > 1 || state.filter) {
        const filterIn = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('datasets.filter'), 'aria-label': t('datasets.filter'), class: 'dm-list-filter' }));
        filterIn.value = state.filter;
        filterIn.addEventListener('input', () => {
          state.filter = filterIn.value;
          state.focus = { filter: true };
          redraw();
        });
        const sortSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('datasets.sort'), class: 'dm-list-sort' }));
        sortSel.options = SORTS.map((s) => ({ value: s, label: t('datasets.sort.' + s) }));
        sortSel.value = state.sort;
        sortSel.addEventListener('change', () => { state.sort = sortSel.value; redraw(); });
        items.push(h('div', { class: 'dm-list-tools' }, filterIn, sortSel));
      }
      if (actions && anything) items.push(toolbar());
      if (actions && state.moving) items.push(movePicker());

      const needle = state.filter.trim().toLowerCase();
      const shown = needle
        ? all.filter((d) => d.name.toLowerCase().includes(needle) || String(d.shortName || '').includes(needle) || (d.tags || []).some((x) => String(x).toLowerCase().includes(needle)) || String(d.folder || '').toLowerCase().includes(needle))
        : all;
      const sorted = sortDatasets(shown, state.sort);
      const visibleOrder = sorted.map((d) => d.id);
      const list = h('div', { class: 'dm-list dm-tree' });

      function toolbar() {
        const u = targets(null);
        const n = count(u);
        const where = (p) => p || t('datasets.tree.root');
        const tool = (id, label, tip, enabled, onClick, variant) => basic.button({
          label, title: tip, size: 'sm', variant: variant || 'ghost', 'data-tool': id, disabled: !enabled || state.busy, onClick,
        });
        return h('div', { class: 'dm-tree-toolbar', role: 'group', 'aria-label': t('datasets.tree.tools') },
          tool('newfolder', t('datasets.tree.newfolder'), t('datasets.tree.newfolder.tip', { folder: where(targetOf(units(), byId, current)) }), true, doNewFolder),
          tool('rename', t('common.rename'), t('datasets.tree.rename.tip'), n === 1, () => doRename(null)),
          tool('cut', t('datasets.tree.cut'), t('datasets.tree.cut.tip'), n > 0, () => doClip('cut', null)),
          tool('copy', t('common.copy'), t('datasets.tree.copy.tip'), n > 0, () => doClip('copy', null)),
          tool('paste', t('datasets.tree.paste'), t('datasets.tree.paste.tip', { folder: where(targetOf(units(), byId, current, clipboard)) }), !!clipboard, () => doPaste(null)),
          tool('move', t('datasets.tree.move'), t('datasets.tree.move.tip'), n > 0, openMove),
          tool('delete', t('common.delete'), t('datasets.tree.delete.tip'), n > 0, () => doRemove(null), 'danger'));
      }
      function movePicker() {
        const u = state.moving;
        // A folder cannot go into itself or below itself.
        const choices = [''].concat(folderPathsOf(full).filter((p) => !u.folders.some((f) => within(p, f))));
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('datasets.tree.move.to'), 'data-tool': 'move-to', class: 'dm-tree-move-select' }));
        sel.options = choices.map((p) => ({ value: p, label: p || t('datasets.folder.root') }));
        sel.value = state.moving.to !== undefined ? state.moving.to : '';
        sel.addEventListener('change', () => { if (state.moving) state.moving.to = sel.value; });
        const close = () => { state.moving = null; state.focus = { tool: 'move' }; redraw(); };
        const panel = h('div', { class: 'dm-tree-move', 'data-move': '' },
          h('span', { class: 'dm-help', text: t('datasets.tree.move.what', { n: count(u) }) }), sel,
          basic.button({ label: t('datasets.tree.move.here'), size: 'sm', 'data-tool': 'move-here', disabled: state.busy, onClick: () => {
            const to = sel.value || '';
            state.moving = null;
            state.focus = { tool: 'move' };
            run(() => actions.paste({ mode: 'cut', ids: u.ids, folders: u.folders }, to));
          } }),
          basic.button({ label: t('common.cancel'), size: 'sm', variant: 'ghost', 'data-tool': 'move-cancel', onClick: close }));
        panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
        return panel;
      }

      // Drop targets: a folder row or the heading (the root).
      function dropTarget(el, folderPath) {
        if (!options.onMove && !actions) return;
        el.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dm-drop-target'); } });
        el.addEventListener('dragleave', () => el.classList.remove('dm-drop-target'));
        el.addEventListener('drop', (e) => {
          el.classList.remove('dm-drop-target');
          const data = dragged(e);
          if (!data) return;
          e.preventDefault();
          if (data.folders.length && actions) run(() => actions.paste({ mode: 'cut', ids: data.ids, folders: data.folders }, folderPath));
          else if (options.onMove) options.onMove(data.ids, folderPath);
          else if (actions) run(() => actions.paste({ mode: 'cut', ids: data.ids, folders: [] }, folderPath));
        });
      }
      /** A drag from a row carries the selection when the row is part of it, else the row alone. */
      function draggable(el, key, path) {
        if (!options.onMove && !actions) return;
        if (key.startsWith('f:') && !actions) return;
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
          const u = units();
          const id = key.startsWith('d:') ? key.slice(2) : null;
          const inside = id ? u.ids.includes(id) || u.folders.some((f) => within(path, f)) : u.folders.some((f) => within(path, f));
          const carried = inside ? u : unitOfKey(key);
          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ dataspatium: 'datasets', ids: carried.ids, folders: carried.folders }));
          e.dataTransfer.effectAllowed = 'move';
        });
      }

      function toggle(id, shiftKey) {
        if (!options.onToggle) return;
        const next = new Set(selected);
        if (shiftKey && state.last && visibleOrder.includes(state.last)) {
          const a = visibleOrder.indexOf(state.last); const b = visibleOrder.indexOf(id);
          const [from, to] = a < b ? [a, b] : [b, a];
          const on = !next.has(id);
          for (const x of visibleOrder.slice(from, to + 1)) { if (on) next.add(x); else next.delete(x); }
        } else if (next.has(id)) next.delete(id); else next.add(id);
        state.last = id;
        select(next);
      }
      function toggleFolder(path) {
        const node = findNode(full, path);
        if (!node || !options.onToggle) return;
        const c = contents(node);
        const on = folderState(node, selected, markedFolders) !== 'all';
        const next = new Set(selected);
        for (const id of c.ids) { if (on) next.add(id); else next.delete(id); }
        for (const p of c.marks) { if (on) markedFolders.add(p); else markedFolders.delete(p); }
        select(next);
      }
      function checkbox(label, st, onClick) {
        const box = h('input', { type: 'checkbox', 'data-part': 'box', 'aria-label': label, checked: st === 'all' ? true : null, props: { checked: st === 'all', indeterminate: st === 'some' } });
        box.addEventListener('click', onClick);
        return h('label', { class: 'dm-tree-check' }, box);
      }
      function editor(label) {
        const edit = state.editing;
        const input = /** @type {any} */ (h('dm-input', { 'aria-label': label, class: 'dm-tree-edit', 'data-part': 'edit' }));
        input.value = edit.value;
        input.addEventListener('input', () => { edit.value = input.value; });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdit(false); }
        });
        // Leaving the field keeps what was typed, as in a file manager; a field taken away by a new drawing does not count.
        input.addEventListener('focusout', () => { setTimeout(() => { if (input.isConnected && state.editing === edit && !input.contains(document.activeElement)) finishEdit(true); }, 0); });
        return input;
      }
      const spacer = () => h('span', { class: 'dm-tree-spacer', 'aria-hidden': 'true' });

      function datasetRow(ds, depth) {
        const key = 'd:' + ds.id;
        const editing = state.editing && state.editing.kind === 'rename' && state.editing.key === key;
        let main;
        if (editing) main = editor(t('datasets.tree.rename.field', { name: ds.name }));
        else {
          main = item({
            id: ds.id, icon: kindIcon(ds.kind), label: ds.name,
            // The short name is what SQL, R and chart files use to refer to the dataset.
            sub: `${ds.shortName ? ds.shortName + ' · ' : ''}${kindSummary(ds)}`,
            code: ds.shortName || '', current: ds.id === options.selectedId, onSelect: options.onSelect,
          });
          main.setAttribute('data-part', 'main');
          draggable(main, key, ds.folder || '');
        }
        const trailing = options.itemTrailing ? options.itemTrailing(ds) : null;
        const row = h('div', { class: 'dm-tree-row' + (!multi && trailing ? ' dm-tree-row-trailing' : '') + (isCut(ds.folder || '', ds.id) ? ' dm-tree-cut' : ''), 'data-id': ds.id, 'data-key': key },
          multi ? checkbox(t('datasets.select', { name: ds.name }), selected.has(ds.id) ? 'all' : 'none', (e) => toggle(ds.id, e.shiftKey)) : null,
          spacer(), main, trailing || null);
        row.style.setProperty('--dm-depth', String(depth));
        return row;
      }
      function newFolderRow(depth) {
        const row = h('div', { class: 'dm-tree-folder-row dm-tree-new', 'data-key': 'new' },
          multi ? h('span', { class: 'dm-tree-check', 'aria-hidden': 'true' }) : null, spacer(), icons.icon('folder-plus', 16), editor(t('datasets.tree.newfolder.field')));
        row.style.setProperty('--dm-depth', String(depth));
        state.editing.placed = true;
        return row;
      }
      function folderRow(f, depth) {
        const key = 'f:' + f.path;
        const isCollapsed = collapsed.has(f.path) && !needle;
        const flip = () => { if (collapsed.has(f.path)) collapsed.delete(f.path); else collapsed.add(f.path); persistCollapsed(); redraw(); };
        const fullNode = findNode(full, f.path) || f;
        const st = multi ? folderState(fullNode, selected, markedFolders) : 'none';
        const chevron = h('button', {
          type: 'button', class: 'dm-tree-toggle', 'data-part': 'toggle', 'aria-expanded': isCollapsed ? 'false' : 'true',
          'aria-label': t(isCollapsed ? 'datasets.tree.folder.expand' : 'datasets.tree.folder.collapse', { name: f.name }), title: t('datasets.tree.folder.toggle'), onclick: flip,
        }, icons.icon(isCollapsed ? 'chevron-right' : 'chevron-down', 14));
        const editing = state.editing && state.editing.kind === 'rename' && state.editing.key === key;
        let main;
        if (editing) main = editor(t('datasets.tree.rename.field', { name: f.name }));
        else {
          // With check boxes a click on a folder chooses it whole and the chevron opens or closes it; without, a click opens or closes it.
          main = h('button', {
            type: 'button', class: 'dm-list-item dm-tree-folder', 'data-folder': f.path, 'data-part': 'main',
            'aria-expanded': multi ? null : (isCollapsed ? 'false' : 'true'), 'aria-pressed': multi ? (st === 'all' ? 'true' : st === 'some' ? 'mixed' : 'false') : null,
            title: multi ? t('datasets.tree.folder.choose', { name: f.path }) : t('datasets.tree.folder.toggle'),
            onclick: multi ? () => toggleFolder(f.path) : flip,
          }, icons.icon(isCollapsed ? 'folder' : 'folder-open', 16),
          h('span', { class: 'dm-truncate', text: f.name }), h('span', { class: 'dm-tree-count', text: i18n.formatNumber(f.count) }));
          draggable(main, key, f.path);
        }
        const row = h('div', { class: 'dm-tree-folder-row' + (isCut(f.path, null) ? ' dm-tree-cut' : ''), 'data-key': key, 'data-folder-row': f.path },
          multi ? checkbox(t('datasets.tree.folder.select', { name: f.path }), st, () => toggleFolder(f.path)) : null, chevron, main);
        row.style.setProperty('--dm-depth', String(depth));
        dropTarget(row, f.path);
        return row;
      }
      function renderNode(node, depth) {
        if (state.editing && state.editing.kind === 'new' && state.editing.parent === node.path) list.appendChild(newFolderRow(depth));
        const children = Array.from(node.folders.values()).sort((a, b) => a.name.localeCompare(b.name, i18n.locale()));
        for (const f of children) {
          list.appendChild(folderRow(f, depth));
          if (!(collapsed.has(f.path) && !needle)) renderNode(f, depth + 1);
        }
        for (const ds of node.datasets) list.appendChild(datasetRow(ds, depth));
      }
      if (state.editing) state.editing.placed = false;
      renderNode(buildTree(sorted, needle ? marks.filter((p) => p.toLowerCase().includes(needle)) : marks), 0);
      // A new folder whose parent the filter hides is named at the top.
      if (state.editing && state.editing.kind === 'new' && !state.editing.placed) list.insertBefore(newFolderRow(0), list.firstChild);

      // Keys on the tree: the tools, and moving between the rows.
      list.addEventListener('keydown', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('dm-input')) return;
        const rowEl = target.closest('[data-key]');
        const key = rowEl ? rowEl.getAttribute('data-key') : null;
        const mod = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
        const letter = e.key.length === 1 ? e.key.toLowerCase() : '';
        const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
        if (actions && e.key === 'Delete' && plain && !e.shiftKey) doRemove(key);
        else if (actions && mod && letter === 'c') doClip('copy', key);
        else if (actions && mod && letter === 'x') doClip('cut', key);
        else if (actions && mod && letter === 'v') doPaste(key);
        else if (actions && e.key === 'F2' && plain) doRename(key);
        else if (plain && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          const mains = Array.from(list.querySelectorAll('[data-part="main"]'));
          const at = rowEl ? mains.findIndex((m) => rowEl.contains(m)) : -1;
          const to = e.key === 'Home' ? 0 : e.key === 'End' ? mains.length - 1 : e.key === 'ArrowDown' ? Math.min(at + 1, mains.length - 1) : Math.max(at - 1, 0);
          focusEl(mains[to], false);
        } else if (plain && key && key !== 'new' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          const path = key.startsWith('f:') ? key.slice(2) : null;
          const ds = path === null ? byId.get(key.slice(2)) : null;
          const mains = Array.from(list.querySelectorAll('[data-part="main"]'));
          const at = mains.findIndex((m) => rowEl.contains(m));
          if (path !== null && e.key === 'ArrowRight' && collapsed.has(path)) { collapsed.delete(path); persistCollapsed(); state.focus = { key, part: 'main' }; redraw(); }
          else if (path !== null && e.key === 'ArrowRight') focusEl(mains[at + 1] || null, false);
          else if (path !== null && e.key === 'ArrowLeft' && !collapsed.has(path) && findNode(full, path) && (findNode(full, path).folders.size || findNode(full, path).datasets.length)) { collapsed.add(path); persistCollapsed(); state.focus = { key, part: 'main' }; redraw(); }
          else if (e.key === 'ArrowLeft') {
            const up = path !== null ? parentOf(path) : (ds ? ds.folder || '' : '');
            if (up) focusEl(list.querySelector(`[data-key="${CSS.escape('f:' + up)}"] [data-part="main"]`), false);
          } else return;
        } else return;
        e.preventDefault();
        e.stopPropagation();
      });
      items.push(list);
      if (options.extra && options.extra.length) {
        items.push(h('hr'));
        items.push(h('div', { class: 'dm-list' }, options.extra.map((x) => item(Object.assign({ current: x.id === options.selectedId, onSelect: options.onSelect }, x)))));
      }
      if (options.tools && options.tools.length) items.push(h('div', { class: 'dm-list-actions' }, options.tools));
      replace(container, items);
      restoreFocus(container, focus);
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

    /** The clipboard of the tree (Klipp ut, Kopiera): {mode, ids, folders}, or null; `set` takes null to empty it. */
    const clip = { get: () => (clipboard ? { mode: clipboard.mode, ids: clipboard.ids.slice(), folders: clipboard.folders.slice() } : null), set: (v) => { clipboard = v ? { mode: v.mode, ids: (v.ids || []).slice(), folders: (v.folders || []).slice() } : null; } };

    const api = { render, buildTree, sortDatasets, kindIcon, kindSummary, SORTS, folders, clip, folderState, unitsOf, targetOf, contents, findNode, withDefaults };
    /**
     * The same list with defaults that every render gets unless it gives its own (the shell: check boxes, tools and moves).
     * @param {() => Record<string, any>} defaults
     */
    function withDefaults(defaults) {
      return Object.assign({}, api, { render: (container, options) => render(container, Object.assign({}, defaults(), options)) });
    }
    return api;
  });
})();
