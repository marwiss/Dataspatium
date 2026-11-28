// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dataset list shown in the object panel of most modes: a tree (ui/tree) whose top node is the place where the workspace lies
 * (Webbläsaren, on this computer, or the portable folder it is saved to as it changes; F131 b), with two children: Arbetsyta, the
 * folders (each dataset's `folder` path, and the empty folders made with Ny mapp) with the datasets inside, and Papperskorg, what
 * Ta bort moved there (each folder removed whole with what it held, and each dataset removed on its own). A filter box and a sort
 * order when there are several datasets, and,
 * where the mode asks for it, check boxes for datasets and whole folders, the tools right above the tree (Ny mapp, Byt namn,
 * Klipp ut, Kopiera, Klistra in, Flytta, Ta bort: icons with tips, and those that do not fit under Fler alternativ) with their
 * keys and the same in the snabbmeny, and drag and drop into, out of and between folders. Selecting an item updates
 * `store.selectedId`, which every mode reacts to. The shell gives every mode the same tree with check boxes (`withDefaults`,
 * ui/batch-actions); the tools, their keys, the snabbmeny and dragging come with `actions` and `onMove`, which only Hantera gives.
 *
 *   datasetList.render(container, {datasets, selectedId, onSelect, extra?, emptyHint?,
 *                                  multi?, selectedIds?, onToggle?(ids), onMove?(ids, folder), tools?,
 *                                  actions?, itemTrailing?(d), trash?, workspaceId?})
 *
 * `actions` does the work and resolves when it is done: remove(units) (to the trash), paste(clip, target) (the ids pasted),
 * rename(unit, name), and for the trash restore(tunit), purge(tunit) (for good, asks first) and empty() (asks first). Units are
 * {ids, folders}: the folders chosen whole and the datasets chosen one by one outside them; a clip is units with a mode, 'copy'
 * or 'cut'; a unit in the trash is {ids, roots: [{batch, path}]}. `itemTrailing(d)` is a control after a dataset's row
 * (Bearbeta's map: Visa i kartan), or null. `trash` are the datasets in the trash (the shell's store), and with `workspaceId`
 * (Hantera) the place and Arbetsyta open the workspace's page through onSelect(workspaceId).
 * Keys on the tree: Delete, Ctrl+C, Ctrl+X, Ctrl+V, F2, and those of ui/tree (the arrows, Home, End, Enter, Space, a letter).
 * In the trash Delete removes for good.
 * A dataset chosen in the tree sends `dm-choose` (the shell closes the panel when it is a sheet).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dataset-list', ['ui/base', 'ui/icons', 'ui/basic', 'ui/tree', 'ui/menu', 'platform/storage/idb', 'platform/storage/folder', 'data/kinds', 'data/datasets', 'data/workspace'], (base, icons, basic, treeMod, menuMod, idb, folderStore, kinds, datasets, workspace) => {
    const { h, t, i18n, replace } = base;
    /** The mark of a kind; the kinds themselves are described in data/kinds. */
    function kindIcon(kind) { return kinds.of(kind).icon; }
    /** One line about a dataset's size, in its own units. */
    const kindSummary = (ds) => kinds.summary(ds);
    const COLLAPSED_SETTING = 'ui.folders.collapsed';
    const EMPTY_SETTING = 'ui.folders.empty';
    const TRASH_SETTING = 'ui.folders.trash';
    const NODES_SETTING = 'ui.tree.nodes';
    /** The nodes above the folders: the place, its workspace and its trash. Arbetsyta's id gives '' (the top level) as a folder's does. */
    const PLACE = 'p:local';
    const WORKSPACE_NODE = 'w:';
    const TRASH_NODE = 't:';
    /** How they start: the place and the workspace open, the trash closed. Folders in the trash start closed too. */
    const NODE_DEFAULT = { [PLACE]: true, [WORKSPACE_NODE]: true, [TRASH_NODE]: false };
    const SORTS = ['updated', 'name', 'rows'];
    /** Folders the user has collapsed; shared by all modes and kept between sessions. */
    const collapsed = new Set();
    /** Folders made with Ny mapp that hold no dataset yet; a folder exists otherwise only through its datasets' paths. */
    const empty = new Set();
    idb.getSetting(COLLAPSED_SETTING, []).then((v) => { if (Array.isArray(v)) for (const p of v) collapsed.add(String(p)); }).catch(() => {});
    idb.getSetting(EMPTY_SETTING, []).then((v) => { if (Array.isArray(v)) for (const p of v) { const n = datasets.normalizeFolder(p); if (n) empty.add(n); } }).catch(() => {});
    const persistCollapsed = () => { idb.setSetting(COLLAPSED_SETTING, Array.from(collapsed)).catch(() => {}); };
    const persistEmpty = () => { idb.setSetting(EMPTY_SETTING, Array.from(empty)).catch(() => {}); };
    /** Empty folders that went to the trash with a folder removed whole: {batch, root, at, paths}, kept like the empty folders. */
    let trashedFolders = [];
    idb.getSetting(TRASH_SETTING, []).then((v) => {
      if (Array.isArray(v)) trashedFolders = v.filter((r) => r && typeof r.batch === 'string' && typeof r.root === 'string' && Array.isArray(r.paths)).map((r) => ({ batch: r.batch, root: r.root, at: String(r.at || ''), paths: r.paths.map(String) }));
    }).catch(() => {});
    const persistTrash = () => { idb.setSetting(TRASH_SETTING, trashedFolders).catch(() => {}); };
    /** The folds of the place, Arbetsyta and Papperskorg (kept between sessions) and of the folders in the trash (this session). */
    const nodeOpen = new Map();
    idb.getSetting(NODES_SETTING, {}).then((v) => { if (v && typeof v === 'object') for (const k of Object.keys(NODE_DEFAULT)) if (typeof v[k] === 'boolean') nodeOpen.set(k, v[k]); }).catch(() => {});
    const persistNodes = () => { const o = {}; for (const k of Object.keys(NODE_DEFAULT)) if (nodeOpen.has(k)) o[k] = nodeOpen.get(k); idb.setSetting(NODES_SETTING, o).catch(() => {}); };
    /** The folds as ui/tree reads and sets them: a folder row's id is 'f:' and its path. */
    const expansion = {
      isOpen: (id) => {
        if (id.startsWith('f:')) return !collapsed.has(id.slice(2));
        if (nodeOpen.has(id)) return nodeOpen.get(id);
        return id in NODE_DEFAULT ? NODE_DEFAULT[id] : !id.startsWith('r:');
      },
      setOpen: (id, open) => {
        if (id.startsWith('f:')) { if (open) collapsed.delete(id.slice(2)); else collapsed.add(id.slice(2)); persistCollapsed(); return; }
        nodeOpen.set(id, !!open);
        if (id in NODE_DEFAULT) persistNodes();
      },
    };

    /** Where the workspace lies: the browser on this computer, or the portable folder it is saved to as it changes (data/workspace). */
    let place = { kind: 'browser', name: '' };
    /** The panels drawn, so that a new place draws them again. */
    const drawnStates = new Set();
    function refreshPlace() {
      const on = !!workspace.folderStatus().enabled;
      (on ? folderStore.current().catch(() => null) : Promise.resolve(null)).then((handle) => {
        const next = handle && handle.name ? { kind: 'folder', name: String(handle.name) } : { kind: 'browser', name: '' };
        if (next.kind === place.kind && next.name === place.name) return;
        place = next;
        for (const s of Array.from(drawnStates)) { if (s.root.isConnected && s.options) draw(s.root, s); else drawnStates.delete(s); }
      });
    }
    workspace.onFolder(() => refreshPlace());
    /** The empty folders that are checked (a folder with datasets is checked through them). Shared by all modes, like the selection. */
    const markedFolders = new Set();
    /** What Klipp ut or Kopiera took, for Klistra in: {mode, ids, folders}, or null. Shared by all modes. */
    let clipboard = null;
    /** Filter, sort, the selection, the move picker, Välj, the tree and the options per panel (the container). */
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
      /**
       * A folder removed whole: the empty folders at and below it go into the trash with it.
       * @param {string} root @param {string} batch the removal (Ångra) @param {string} at when
       */
      trash(root, batch, at) {
        const paths = Array.from(empty).filter((p) => within(p, root));
        for (const p of paths) empty.delete(p);
        for (const p of Array.from(markedFolders)) if (within(p, root)) markedFolders.delete(p);
        if (paths.length) trashedFolders.push({ batch, root, at, paths });
        persistEmpty(); persistTrash();
      },
      /** The empty folders in the trash. @returns {Array<{batch: string, root: string, at: string, paths: string[]}>} */
      trashed: () => trashedFolders.map((r) => ({ batch: r.batch, root: r.root, at: r.at, paths: r.paths.slice() })),
      /**
       * Take empty folders out of the trash: those of a removal (null: every one) at or below a path (null: all of them), back
       * in their place with `back`, else gone for good.
       * @param {string|null} batch @param {string|null} path @param {boolean} back
       */
      untrash(batch, path, back) {
        for (const r of trashedFolders) {
          if (batch !== null && r.batch !== batch) continue;
          const take = r.paths.filter((p) => path === null || within(p, path));
          if (back) for (const p of take) empty.add(p);
          r.paths = r.paths.filter((p) => !take.includes(p));
        }
        trashedFolders = trashedFolders.filter((r) => r.paths.length);
        persistEmpty(); persistTrash();
      },
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

    /** Ids and folders carried by a drag from the tree (ui/tree's payload), or null. */
    function carried(payload) {
      return payload && payload.dataspatium === 'datasets' && Array.isArray(payload.ids) ? { ids: payload.ids, folders: Array.isArray(payload.folders) ? payload.folders : [] } : null;
    }

    /** Where the focus is in a panel, so that it can come back after the panel is drawn again. */
    function focusOf(container, state) {
      const a = /** @type {HTMLElement|null} */ (document.activeElement);
      if (!a || !container.contains(a)) return null;
      if (a.closest('.dm-list-filter')) return { filter: true };
      const tool = a.closest('[data-tool]');
      if (tool) return { tool: tool.getAttribute('data-tool') };
      const row = a.closest('[data-key]');
      if (!row || !state.view) return null;
      const part = a.closest('[data-part]');
      const key = row.getAttribute('data-key');
      return { key, part: part ? part.getAttribute('data-part') : 'main', index: state.view.rows().findIndex((r) => r.id === key) };
    }
    function focusEl(el) {
      if (!el) return false;
      const control = /** @type {any} */ (el).control || el;
      if (control.disabled) return false;
      control.focus();
      if (control.setSelectionRange && typeof control.value === 'string') control.setSelectionRange(control.value.length, control.value.length);
      return true;
    }
    function restoreFocus(container, state, f) {
      if (!f) return;
      if (f.filter) { focusEl(container.querySelector('.dm-list-filter')); return; }
      if (f.tool) {
        const el = container.querySelector(`[data-tool="${CSS.escape(f.tool)}"]`);
        if (el && focusEl(el.tagName === 'DM-BUTTON' ? el.querySelector('button') : el)) return;
      }
      if (f.key && state.view.focus(f.key, f.part)) return;
      // The row is gone (deleted, moved): the one now in its place, else the first.
      state.view.focusIndex(f.index === undefined || f.index < 0 ? 0 : f.index);
    }
    /** Put a panel's parts in order around the tree without taking the tree out (it keeps its focus and scroll). */
    function placeAround(container, items, keep) {
      for (const c of Array.from(container.childNodes)) if (c !== keep) c.remove();
      if (keep.parentNode !== container) container.appendChild(keep);
      const at = items.indexOf(keep);
      for (let i = 0; i < items.length; i++) if (i < at) container.insertBefore(items[i], keep); else if (i > at) container.appendChild(items[i]);
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
        state = { filter: '', sort: 'updated', renders: 0, editing: null, moving: null, busy: false, focus: null, selecting: false, overflow: null, view: null, root: h('div', { class: 'dm-tree-panel' }) };
        panelState.set(container, state);
      }
      if (!state.view) state.view = treeMod.create({ label: t('datasets.tree.label'), expansion });
      state.options = options;
      state.selected = new Set(options.selectedIds || []);
      state.renders++;
      if (!state.focus) state.focus = focusOf(state.root, state);
      if (state.root.parentNode !== container || container.childNodes.length !== 1) replace(container, state.root);
      drawnStates.add(state);
      draw(state.root, state);
      refreshPlace();
    }

    function draw(container, state) {
      const options = state.options;
      const multi = !!options.multi;
      const actions = options.actions || null;
      const selected = state.selected;
      const view = state.view;
      const redraw = () => draw(container, state);
      const all = options.datasets;
      const trash = options.trash || [];
      const byId = new Map(all.map((d) => [d.id, d]));
      const marks = folders.list();
      const full = buildTree(all, marks);
      const knownFolders = new Set(folderPathsOf(full));
      for (const p of Array.from(markedFolders)) if (!knownFolders.has(p)) markedFolders.delete(p);
      const focus = state.focus || focusOf(container, state);
      state.focus = null;
      if (state.editing && state.editing.kind === 'rename' && !(state.editing.key.startsWith('f:') ? knownFolders.has(state.editing.key.slice(2)) : byId.has(state.editing.key.slice(2)))) state.editing = null;

      // ---- the selection, and what the tools act on ----
      const units = () => (multi ? unitsOf(full, selected, markedFolders) : { ids: [], folders: [] });
      const unitOfKey = (key) => (key.startsWith('f:') ? { ids: [], folders: [key.slice(2)] } : { ids: [key.slice(2)], folders: [] });
      const pathOfKey = (key) => (key.startsWith('f:') ? key.slice(2) : ((byId.get(key.slice(2)) || {}).folder || ''));
      /** Whether a row is part of the checked units. */
      const inUnits = (u, key) => (key.startsWith('d:') ? u.ids.includes(key.slice(2)) : false) || u.folders.some((f) => within(pathOfKey(key), f));
      /** The checked items, else the row with the focus (keys), else the current dataset. */
      function targets(key) {
        const u = units();
        if (count(u)) return u;
        if (key && (key.startsWith('d:') || key.startsWith('f:'))) return unitOfKey(key);
        const cur = byId.get(options.selectedId);
        return cur ? { ids: [cur.id], folders: [] } : { ids: [], folders: [] };
      }
      /** What the snabbmeny and a drag act on: the checked items when the row is one of them, else the row alone. */
      function unitsFor(key) { const u = units(); return count(u) && inUnits(u, key) ? u : unitOfKey(key); }
      const current = byId.get(options.selectedId);
      // The clipboard is Hantera's (the tools come with `actions`): other modes neither fade nor mention what is on it.
      const shownClip = actions ? clipboard : null;
      const isCut = (path, id) => !!shownClip && shownClip.mode === 'cut' && ((id && shownClip.ids.includes(id)) || shownClip.folders.some((f) => within(path, f)));
      function select(next) {
        state.selected = next;
        const before = state.renders;
        if (options.onToggle) options.onToggle(Array.from(next));
        if (state.renders === before) redraw();
      }
      function run(task) {
        if (state.busy) return Promise.resolve();
        // Where the focus goes when the work is done: where it was asked to go, else where it is.
        const back = state.focus || focusOf(container, state);
        state.busy = true; redraw();
        return Promise.resolve().then(task).catch((err) => D.log('dataset-list', err)).finally(() => {
          state.busy = false;
          const a = document.activeElement;
          if (!state.focus && (!a || a === document.body || container.contains(a))) state.focus = back;
          redraw();
        });
      }

      // ---- the tools ----
      function doRemove(u) {
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
      function doClip(mode, u) {
        if (!actions || !count(u)) return;
        clipboard = { mode, ids: u.ids.slice(), folders: u.folders.slice() };
        redraw();
      }
      /** Klistra in: with a row (keys, the snabbmeny) into that folder or beside that dataset; with the tool where the selection is. */
      function doPaste(key) {
        if (!actions || !clipboard) return;
        const clip = clipboard;
        let target;
        if (key === WORKSPACE_NODE || key === PLACE) target = '';
        else if (key && key.startsWith('f:')) target = key.slice(2);
        else if (key && key.startsWith('d:') && byId.get(key.slice(2))) target = byId.get(key.slice(2)).folder || '';
        else target = targetOf(units(), byId, current);
        if (clip.folders.includes(target)) target = parentOf(target);
        run(async () => {
          const ids = await actions.paste(clip, target);
          if (clip.mode === 'cut') clipboard = null;
          if (ids && ids.length && multi) { markedFolders.clear(); select(new Set(ids)); }
        });
      }
      function reveal(path) {
        let changed = false;
        for (let p = path; p; p = parentOf(p)) if (collapsed.delete(p)) changed = true;
        if (changed) persistCollapsed();
        if (!expansion.isOpen(PLACE) || !expansion.isOpen(WORKSPACE_NODE)) { nodeOpen.set(PLACE, true); nodeOpen.set(WORKSPACE_NODE, true); persistNodes(); }
      }
      function doRename(u) {
        if (!actions || count(u) !== 1) return;
        const key = u.folders.length ? 'f:' + u.folders[0] : 'd:' + u.ids[0];
        const name = u.folders.length ? leafOf(u.folders[0]) : (byId.get(u.ids[0]) || {}).name || '';
        reveal(u.folders.length ? parentOf(u.folders[0]) : ((byId.get(u.ids[0]) || {}).folder || ''));
        state.editing = { kind: 'rename', key, unit: u, original: name };
        view.edit(key, { value: name, original: name, label: t('tree.rename.field', { name }) });
      }
      function doNewFolder(parent) {
        const node = findNode(full, parent);
        const names = new Set(node ? Array.from(node.folders.keys()) : []);
        let name = t('datasets.tree.newfolder.name');
        for (let n = 2; names.has(name); n++) name = t('datasets.tree.newfolder.name.n', { n });
        reveal(parent);
        state.editing = { kind: 'new', key: 'new', parent, original: '', value: name };
        redraw();
        view.edit('new', { value: name, original: '', label: t('datasets.tree.newfolder.field') });
      }
      function renamed(node, value) {
        const edit = state.editing;
        state.editing = null;
        if (edit && edit.kind === 'new') {
          const path = datasets.normalizeFolder(joinPath(edit.parent, value.replace(/\//g, ' ')));
          if (path && !knownFolders.has(path)) folders.add(path);
          state.focus = { key: 'f:' + path, part: 'main' };
          redraw();
          return;
        }
        if (!edit || edit.key !== node.id || !actions) { redraw(); return; }
        state.focus = { key: edit.key, part: 'main' };
        run(() => actions.rename(edit.unit, value));
      }
      function notRenamed() {
        const edit = state.editing;
        state.editing = null;
        if (edit && edit.kind === 'new') redraw();
      }
      function openMove(u) {
        if (!actions || !count(u)) return;
        state.moving = u;
        state.focus = { tool: 'move-to' };
        redraw();
      }
      function setChecked(nodes, on) {
        if (!options.onToggle) return;
        const next = new Set(selected);
        for (const n of nodes) {
          if (n.id.startsWith('d:')) { const id = n.id.slice(2); if (on) next.add(id); else next.delete(id); continue; }
          if (!n.id.startsWith('f:')) continue;
          const f = findNode(full, n.id.slice(2));
          if (!f) continue;
          const c = contents(f);
          for (const id of c.ids) { if (on) next.add(id); else next.delete(id); }
          for (const p of c.marks) { if (on) markedFolders.add(p); else markedFolders.delete(p); }
        }
        select(next);
      }
      // ---- the trash: Återställ, Ta bort för gott and Töm papperskorgen are Hantera's (with `actions`) ----
      /** A row in the trash as a unit: a dataset ('x:' and its id), or a folder that went whole or one inside it ('r:' batch|path). */
      function trashUnitOf(key) {
        if (key.startsWith('x:')) return { ids: [key.slice(2)], roots: [] };
        if (!key.startsWith('r:')) return null;
        const rest = key.slice(2);
        const bar = rest.indexOf('|');
        return { ids: [], roots: [{ batch: rest.slice(0, bar), path: rest.slice(bar + 1) }] };
      }
      const inTrash = (key) => key === TRASH_NODE || key.startsWith('x:') || key.startsWith('r:');
      const hasTrash = trash.length > 0 || folders.trashed().length > 0;
      function doRestore(u) { if (actions && actions.restore && u) run(() => actions.restore(u)); }
      function doPurge(u) { if (actions && actions.purge && u) run(() => actions.purge(u)); }
      function doEmpty() { if (actions && actions.empty && hasTrash) run(() => actions.empty()); }
      const restoreButton = (key, name) => (actions && actions.restore ? basic.button({ label: t('datasets.trash.restore'), icon: 'history', 'icon-only': true, size: 'sm', variant: 'ghost', title: t('datasets.trash.restore.tip', { name }), 'data-restore': key, disabled: state.busy, onClick: () => doRestore(trashUnitOf(key)) }) : null);

      const checkState = (n) => {
        if (n.id.startsWith('d:')) return selected.has(n.id.slice(2)) ? 'all' : 'none';
        const f = n.id.startsWith('f:') ? findNode(full, n.id.slice(2)) : null;
        return f ? folderState(f, selected, markedFolders) : 'none';
      };

      // The heading holds Välj for touch screens, as in the phones' file apps: the check boxes show and a tap checks. Elsewhere
      // it takes no room, so that the filter lies right under the pane head (B-81.3).
      const header = h('div', { class: 'dm-list-head' },
        multi && options.onToggle ? basic.button({ label: t(state.selecting ? 'tree.select.done' : 'tree.select'), title: t('tree.select.tip'), icon: 'list-checks', size: 'sm', variant: 'ghost', class: 'dm-tree-select', pressed: String(!!state.selecting), onClick: () => { state.selecting = !state.selecting; redraw(); } }) : null);
      // How many are checked and what is on the clipboard, under the tree, so that checking moves no row.
      const status = (multi && selected.size) || shownClip ? h('p', { class: 'dm-help dm-list-status' },
        multi && selected.size ? h('span', { text: t('datasets.selected.count', { n: selected.size }) }) : null,
        shownClip ? h('span', { 'data-clip': shownClip.mode, text: t('datasets.tree.clip.' + shownClip.mode, { n: count(shownClip) }) }) : null) : null;
      const canMove = !!(options.onMove || actions);
      if (canMove) view.dropZone(header, null);
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
        const row = h('div', { class: 'dm-list-tools' }, filterIn, sortSel);
        // The top of the panel is the top level, also when the heading is hidden.
        if (canMove) view.dropZone(row, null);
        items.push(row);
      }
      if (state.overflow) { state.overflow.disconnect(); state.overflow = null; }
      if (actions && anything) items.push(toolbar());
      if (actions && state.moving) items.push(movePicker());

      function toolbar() {
        const u = targets(null);
        const n = count(u);
        const where = (p) => p || t('datasets.tree.root');
        // Icons with the name for screen readers and the tip, on one line; what does not fit is under Fler alternativ.
        const tool = (id, icon, label, tip, enabled, onClick, variant) => basic.button({
          label, icon, title: tip, size: 'sm', variant: variant || 'ghost', 'data-tool': id, disabled: !enabled || state.busy, onClick,
        });
        const more = /** @type {any} */ (h('dm-menu-button', { label: t('common.more'), icon: 'more-horizontal', 'icon-only': true, size: 'sm', variant: 'ghost', class: 'dm-tree-more', hidden: true }));
        const bar = h('div', { class: 'dm-tree-toolbar', role: 'group', 'aria-label': t('datasets.tree.tools') },
          tool('newfolder', 'folder-plus', t('datasets.tree.newfolder'), t('datasets.tree.newfolder.tip', { folder: where(targetOf(units(), byId, current)) }), true, () => doNewFolder(targetOf(units(), byId, current))),
          tool('rename', 'pencil', t('common.rename'), t('datasets.tree.rename.tip'), n === 1, () => doRename(targets(null))),
          tool('cut', 'scissors', t('datasets.tree.cut'), t('datasets.tree.cut.tip'), n > 0, () => doClip('cut', targets(null))),
          tool('copy', 'copy', t('common.copy'), t('datasets.tree.copy.tip'), n > 0, () => doClip('copy', targets(null))),
          tool('paste', 'clipboard-paste', t('datasets.tree.paste'), t('datasets.tree.paste.tip', { folder: where(targetOf(units(), byId, current, clipboard)) }), !!clipboard, () => doPaste(null)),
          tool('move', 'folder-input', t('datasets.tree.move'), t('datasets.tree.move.tip'), n > 0, () => openMove(targets(null))),
          tool('delete', 'trash-2', t('common.delete'), t('datasets.tree.delete.tip'), n > 0, () => doRemove(targets(null)), 'danger'),
          more);
        state.overflow = menuMod.overflow(bar, more);
        return bar;
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
      /** The snabbmeny: the tools, on the row pressed (or on the checked items when it is one of them). */
      function menuOf(node) {
        if (!actions || node.id === 'new' || node.id === PLACE) return [];
        const key = node.id;
        if (key === TRASH_NODE) return hasTrash && actions.empty ? [{ id: 'empty-trash', label: t('datasets.trash.empty.action'), icon: 'trash-2', danger: true, onSelect: doEmpty }] : [];
        const tu = trashUnitOf(key);
        if (tu) {
          return [
            actions.restore ? { id: 'restore', label: t('datasets.trash.restore'), icon: 'history', onSelect: () => doRestore(tu) } : null,
            { separator: true },
            actions.purge ? { id: 'purge', label: t('datasets.trash.purge'), icon: 'trash-2', hint: 'Delete', danger: true, onSelect: () => doPurge(tu) } : null,
          ].filter(Boolean);
        }
        if (key === WORKSPACE_NODE) {
          return [
            { id: 'newfolder', label: t('datasets.tree.newfolder'), icon: 'folder-plus', onSelect: () => doNewFolder('') },
            { id: 'paste', label: t('datasets.tree.paste'), icon: 'clipboard-paste', hint: 'Ctrl+V', disabled: !clipboard, onSelect: () => doPaste(key) },
          ];
        }
        const u = unitsFor(key);
        return [
          { id: 'newfolder', label: t('datasets.tree.newfolder'), icon: 'folder-plus', onSelect: () => doNewFolder(pathOfKey(key)) },
          { id: 'rename', label: t('common.rename'), icon: 'pencil', hint: 'F2', disabled: count(u) !== 1, onSelect: () => doRename(u) },
          { id: 'cut', label: t('datasets.tree.cut'), icon: 'scissors', hint: 'Ctrl+X', onSelect: () => doClip('cut', u) },
          { id: 'copy', label: t('common.copy'), icon: 'copy', hint: 'Ctrl+C', onSelect: () => doClip('copy', u) },
          { id: 'paste', label: t('datasets.tree.paste'), icon: 'clipboard-paste', hint: 'Ctrl+V', disabled: !clipboard, onSelect: () => doPaste(key) },
          { id: 'move', label: t('tree.move.to'), icon: 'folder-input', onSelect: () => openMove(u) },
          { separator: true },
          { id: 'delete', label: t('common.delete'), icon: 'trash-2', hint: 'Delete', danger: true, onSelect: () => doRemove(u) },
        ];
      }

      // ---- the tree's rows ----
      const needle = state.filter.trim().toLowerCase();
      const shown = needle
        ? all.filter((d) => d.name.toLowerCase().includes(needle) || String(d.shortName || '').includes(needle) || (d.tags || []).some((x) => String(x).toLowerCase().includes(needle)) || String(d.folder || '').toLowerCase().includes(needle))
        : all;
      const sorted = sortDatasets(shown, state.sort);
      const editingNew = state.editing && state.editing.kind === 'new' ? state.editing : null;
      let placed = false;
      const newNode = () => ({ id: 'new', label: editingNew.value, icon: 'folder-plus', checkable: false, draggable: false, droppable: false });
      const byName = (a, b) => a.name.localeCompare(b.name, i18n.locale());
      function datasetNode(ds) {
        return {
          id: 'd:' + ds.id, label: ds.name, icon: kindIcon(ds.kind),
          // The short name is what SQL, R and chart files use to refer to the dataset.
          code: ds.shortName || '', sub: kindSummary(ds), current: ds.id === options.selectedId, cut: isCut(ds.folder || '', ds.id),
          trailing: options.itemTrailing ? options.itemTrailing(ds) : null, rowAttrs: { 'data-id': ds.id }, mainAttrs: { 'data-id': ds.id },
        };
      }
      function childrenOf(f) {
        const kids = [];
        if (editingNew && editingNew.parent === f.path) { kids.push(newNode()); placed = true; }
        for (const c of Array.from(f.folders.values()).sort(byName)) {
          kids.push({ id: 'f:' + c.path, label: c.name, count: c.count, children: childrenOf(c), cut: isCut(c.path, null), draggable: !!actions, mainClass: 'dm-tree-folder', rowAttrs: { 'data-folder-row': c.path }, mainAttrs: { 'data-folder': c.path } });
        }
        for (const ds of f.datasets) kids.push(datasetNode(ds));
        return kids;
      }
      const inWorkspace = childrenOf(buildTree(sorted, needle ? marks.filter((p) => p.toLowerCase().includes(needle)) : marks));
      // A new folder whose parent the filter hides is named at the top.
      if (editingNew && !placed) inWorkspace.unshift(newNode());

      // The trash: each removal of a folder whole with what it held (and the empty folders in it), and each dataset removed on its
      // own, newest first; it says where each one lay and when it went.
      const fixed = { checkable: false, draggable: false, renamable: false };
      const workspaceName = t('datasets.storage.title');
      const fromLine = (folder, at) => [t('datasets.trash.from', { folder: folder || workspaceName }), at ? i18n.formatDateTime(at) : ''].filter(Boolean).join(' · ');
      const trashShown = needle ? trash.filter((d) => d.name.toLowerCase().includes(needle) || String(d.folder || '').toLowerCase().includes(needle)) : trash;
      const removals = new Map();
      const removalOf = (batch, root, at) => { const k = batch + '|' + root; if (!removals.has(k)) removals.set(k, { batch, root, at: at || '', datasets: [], paths: [] }); return removals.get(k); };
      for (const r of folders.trashed()) {
        const paths = needle ? r.paths.filter((p) => p.toLowerCase().includes(needle)) : r.paths;
        if (paths.length) removalOf(r.batch, r.root, r.at).paths.push(...paths);
      }
      const alone = [];
      for (const d of trashShown) { const m = d.trashed || {}; if (m.root) removalOf(String(m.batch || ''), String(m.root), m.at).datasets.push(d); else alone.push(d); }
      function trashDatasetNode(d, top) {
        const m = d.trashed || {};
        return Object.assign({ id: 'x:' + d.id, label: d.name, icon: kindIcon(d.kind), sub: top ? fromLine(m.folder !== undefined ? m.folder : d.folder, m.at) : kindSummary(d), rowAttrs: { 'data-trash-id': d.id }, trailing: top ? restoreButton('x:' + d.id, d.name) : null }, fixed);
      }
      function trashFolderNode(n, x, top) {
        const key = 'r:' + x.batch + '|' + n.path;
        const kids = Array.from(n.folders.values()).sort(byName).map((c) => trashFolderNode(c, x, false)).concat(sortDatasets(n.datasets, state.sort).map((d) => trashDatasetNode(d, false)));
        return Object.assign({ id: key, label: n.name, count: n.count, children: kids, sub: top ? fromLine(parentOf(x.root), x.at) : undefined, rowAttrs: { 'data-trash-folder': n.path }, trailing: top ? restoreButton(key, n.name) : null }, fixed);
      }
      const inTrashNodes = Array.from(removals.values()).map((x) => ({ at: x.at, name: leafOf(x.root), node: trashFolderNode(findNode(buildTree(x.datasets, x.paths.concat([x.root])), x.root), x, true) }))
        .concat(alone.map((d) => ({ at: (d.trashed && d.trashed.at) || '', name: d.name, node: trashDatasetNode(d, true) })))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)) || a.name.localeCompare(b.name, i18n.locale()))
        .map((x) => x.node);
      const trashBytes = trash.reduce((n, d) => n + datasets.storedBytes(d), 0);
      const workspaceNode = Object.assign({
        id: WORKSPACE_NODE, label: workspaceName, icon: 'database', iconOpen: 'database', count: all.length, children: inWorkspace,
        current: !!options.workspaceId && options.selectedId === options.workspaceId, rowAttrs: { 'data-node': 'workspace' },
      }, fixed);
      const trashNode = Object.assign({
        id: TRASH_NODE, label: t('datasets.trash'), icon: 'trash-2', iconOpen: 'trash-2', children: inTrashNodes, droppable: !!actions,
        sub: trash.length ? t('datasets.trash.sub', { n: i18n.formatNumber(trash.length), size: i18n.formatBytes(trashBytes) }) : hasTrash ? t('datasets.trash.folders') : t('datasets.trash.none'),
        rowAttrs: { 'data-node': 'trash' },
        trailing: actions && actions.empty && hasTrash ? basic.button({ label: t('datasets.trash.empty.action'), icon: 'trash-2', 'icon-only': true, size: 'sm', variant: 'ghost', title: t('datasets.trash.empty.tip'), 'data-empty-trash': '', disabled: state.busy, onClick: doEmpty }) : null,
      }, fixed);
      const folderPlace = place.kind === 'folder';
      const nodes = [Object.assign({
        id: PLACE, label: folderPlace ? place.name : t('datasets.place.browser'), sub: t(folderPlace ? 'datasets.place.folder.sub' : 'datasets.place.browser.sub'),
        icon: folderPlace ? 'hard-drive' : 'globe', iconOpen: folderPlace ? 'hard-drive' : 'globe', children: [workspaceNode, trashNode], droppable: false,
        rowAttrs: { 'data-node': 'place', 'data-place': place.kind },
      }, fixed)];

      items.push(view.el);
      if (status) items.push(status);
      if (options.extra && options.extra.length) {
        items.push(h('hr'));
        items.push(h('div', { class: 'dm-list' }, options.extra.map((x) => item(Object.assign({ current: x.id === options.selectedId, onSelect: options.onSelect }, x)))));
      }
      if (options.tools && options.tools.length) items.push(h('div', { class: 'dm-list-actions' }, options.tools));
      placeAround(container, items, view.el);
      view.update({
        nodes, openAll: !!needle, checkable: multi, checkState, selecting: !!state.selecting,
        onCheck: (node, info) => setChecked(info.range || [node], info.on),
        onActivate: (node, e) => {
          if (node.id === 'new') return true;
          if (node.id.startsWith('d:')) {
            options.onSelect(node.id.slice(2));
            view.el.dispatchEvent(new CustomEvent('dm-choose', { bubbles: true, detail: { id: node.id.slice(2) } }));
            return true;
          }
          // What lies in the trash is chosen nowhere; the place and Arbetsyta open the workspace's page where there is one (Hantera).
          if (node.id.startsWith('x:')) return true;
          if ((node.id === PLACE || node.id === WORKSPACE_NODE) && options.workspaceId) {
            options.onSelect(options.workspaceId);
            view.el.dispatchEvent(new CustomEvent('dm-choose', { bubbles: true, detail: { id: options.workspaceId } }));
            return true;
          }
          if (multi && node.id.startsWith('f:')) { setChecked([node], checkState(node) !== 'all'); return true; }
          return false;
        },
        onKey: (e, node) => {
          if (!actions || node.id === 'new') return false;
          const key = node.id;
          const mod = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
          const letter = e.key.length === 1 ? e.key.toLowerCase() : '';
          const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
          if (inTrash(key)) {
            if (!(e.key === 'Delete' && plain)) return false;
            if (key === TRASH_NODE) doEmpty(); else doPurge(trashUnitOf(key));
            return true;
          }
          if (key === PLACE || key === WORKSPACE_NODE) {
            if (!(mod && letter === 'v')) return false;
            doPaste(key);
            return true;
          }
          if (e.key === 'Delete' && plain) doRemove(targets(key));
          else if (mod && letter === 'c') doClip('copy', targets(key));
          else if (mod && letter === 'x') doClip('cut', targets(key));
          else if (mod && letter === 'v') doPaste(key);
          else if (e.key === 'F2' && plain) doRename(targets(key));
          else return false;
          return true;
        },
        onDrop: canMove ? (payload, target) => {
          const data = carried(payload);
          if (!data) return;
          // Into the trash is Ta bort.
          if (target && inTrash(target.id)) { if (actions) doRemove({ ids: data.ids, folders: data.folders }); return; }
          const path = target ? target.id.slice(2) : '';
          if (data.folders.length && actions) run(() => actions.paste({ mode: 'cut', ids: data.ids, folders: data.folders }, path));
          else if (options.onMove) options.onMove(data.ids, path);
          else if (actions) run(() => actions.paste({ mode: 'cut', ids: data.ids, folders: [] }, path));
        } : undefined,
        // A drag from a row carries the selection when the row is part of it, else the row alone.
        dragData: (node) => { if (node.id === 'new') return null; const u = unitsFor(node.id); return { dataspatium: 'datasets', ids: u.ids, folders: u.folders }; },
        // A folder cannot go into itself or below itself.
        canDrop: (payload, target) => {
          const data = carried(payload);
          if (!data) return false;
          if (target && inTrash(target.id)) return !!actions;
          const path = target ? target.id.slice(2) : '';
          return !data.folders.some((f) => within(path, f));
        },
        onRename: actions ? renamed : undefined,
        onRenameCancel: notRenamed,
        menu: actions ? menuOf : undefined,
        rootLabel: t('datasets.folder.root'),
      });
      restoreFocus(container, state, focus);
    }

    function item({ id, icon, label, sub, code, current, onSelect }) {
      const subEl = sub ? h('span', { class: 'dm-list-sub dm-truncate' }) : null;
      if (subEl) {
        if (code) { subEl.appendChild(h('code', { class: 'dm-list-code', text: code })); subEl.appendChild(document.createTextNode(sub.slice(code.length))); }
        else subEl.textContent = sub;
      }
      return h('button', { type: 'button', class: 'dm-list-item', 'data-id': id, 'aria-current': current ? 'true' : null, onclick: () => onSelect(id) },
        icons.icon(icon, 16),
        h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: label }), subEl));
    }

    /** The clipboard of the tree (Klipp ut, Kopiera): {mode, ids, folders}, or null; `set` takes null to empty it. */
    const clip = { get: () => (clipboard ? { mode: clipboard.mode, ids: clipboard.ids.slice(), folders: clipboard.folders.slice() } : null), set: (v) => { clipboard = v ? { mode: v.mode, ids: (v.ids || []).slice(), folders: (v.folders || []).slice() } : null; } };

    /**
     * The checked datasets (the store's selectedIds) with the empty folders checked in the tree, as units: what the batch
     * dialog's Ta bort deletes, as the tree's own tool does (a folder chosen whole goes with everything in it).
     * @param {any[]} list all datasets @param {string[]} ids @returns {{ids: string[], folders: string[]}}
     */
    const selectionUnits = (list, ids) => unitsOf(buildTree(list, folders.list()), new Set(ids), markedFolders);

    const api = { render, buildTree, sortDatasets, kindIcon, kindSummary, SORTS, folders, clip, folderState, unitsOf, selectionUnits, targetOf, contents, findNode, withDefaults, PLACE, WORKSPACE_NODE, TRASH_NODE };
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
