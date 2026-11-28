// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * dm-tree (ui/tree): the app's one tree, for Hantera's datasets, Inhämta's groups, Mobil's list and a model's spatial
 * structure. Its own code (F127 a, after the spike with headless-tree): a flat list of the visible rows, drawn in full or, in
 * large trees, only the rows in view (virtualised), and pointer events for dragging with a finger.
 *
 *   const view = tree.create({label, nodes, ...});   parent.appendChild(view.el);   view.update({nodes, ...});
 *
 * A node: {id, label, icon?, iconOpen?, sub?, code?, badges?: [{text, kind}], count?, children?: Node[] (a folder), lazy?: true
 * (a folder whose children come from `loadChildren(node)`), trailing?: Node (a control at the end of the row), current?, cut?,
 * checkable?, draggable?, droppable?, renamable?, rowAttrs?, mainAttrs?, mainClass?, data?}.
 *
 * Options (all optional but nodes): label (the tree's name), memory (the key under which the folded folders are kept between
 * sessions) or expansion ({isOpen(id), setOpen(id, open)}, the caller keeps them), defaultOpen (true), openAll (every folder
 * open, as while filtering), filter (a text; matches show with their folders), match(node, needle), activeId, onActivate(node,
 * event) (true: handled; else a folder opens or closes), checkable with checked (ids) and onCheckedChange(ids), or checkState(node)
 * ('all'|'some'|'none') and onCheck(node, {range, on}) when the caller counts itself, selecting (Välj: a tap checks), onDrop(payload,
 * target, event) (dragging, Klipp ut and Klistra in with the keys, and Flytta till…; target null is the top level), dragData(node),
 * canDrop(payload, target), onRename(node, name) and onRenameCancel(node), onKey(event, node) (true: handled), menu(node, defaults)
 * (the snabbmeny's items, see ui/menu), loadChildren(node), simple (no check boxes, dragging, renaming or menu), aria ('tree',
 * 'buttons' or 'auto': buttons on touch screens, whose screen readers read ARIA trees unevenly), scroller, virtualFrom (400).
 *
 * Keys (WAI-ARIA tree): Up and Down, Home and End, Page Up and Down, Right opens or goes in, Left closes or goes up, Enter
 * activates, Space checks (Shift: from the last checked; else activates), Shift+Up and Down check while moving, Ctrl+A checks
 * all, * opens the siblings, a letter jumps to the next name that starts with it, F2 renames, Ctrl+X and Ctrl+V move, Escape
 * forgets what was cut, Shift+F10 and the menu key open the snabbmeny.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/tree', ['ui/base', 'ui/icons', 'ui/basic', 'ui/menu', 'ui/overlays', 'platform/storage/idb'], (base, icons, basic, menu, overlays, idb) => {
    const { h, t, i18n } = base;
    /** Trees with more visible rows than this draw only the rows in view. */
    const VIRTUAL_FROM = 400;
    const OVERSCAN = 10;
    /** A press this long on a touch screen opens the snabbmeny, or starts a drag when the finger then moves. */
    const PRESS_MS = 500;
    const SLOP = 8;
    /** Near the edge of the scrolled area a drag scrolls it. */
    const EDGE = 40;
    const TYPE_MS = 700;
    const DRAG_TYPE = 'text/plain';
    const FALLBACK_ROW_H = 40;

    /** Remembered folds, per key: shared by every tree with the key and kept in the browser. */
    const memories = new Map();
    /**
     * @param {string} key @param {boolean} [defaultOpen]
     * @returns {{key: string, isOpen: (id: string) => boolean, setOpen: (id: string, open: boolean) => void, ready: Promise<void>, views: Set<any>}}
     */
    function memory(key, defaultOpen = true) {
      let m = memories.get(key);
      if (m) return m;
      /** The folders folded the other way than `defaultOpen`. */
      const flipped = new Set();
      const views = new Set();
      const save = () => { idb.setSetting(key, Array.from(flipped)).catch(() => {}); };
      m = {
        key, views,
        isOpen: (id) => (defaultOpen ? !flipped.has(id) : flipped.has(id)),
        setOpen: (id, open) => { if (open === defaultOpen) flipped.delete(id); else flipped.add(id); save(); },
        ready: idb.getSetting(key, []).then((v) => {
          if (Array.isArray(v)) for (const x of v) flipped.add(String(x));
          for (const ref of Array.from(views)) { const view = ref.deref(); if (view) view.refresh(); else views.delete(ref); }
        }).catch(() => {}),
      };
      memories.set(key, m);
      return m;
    }
    /** Folds kept only as long as the tree lives. */
    function localExpansion(defaultOpen) {
      const flipped = new Set();
      return { isOpen: (id) => (defaultOpen ? !flipped.has(id) : flipped.has(id)), setOpen: (id, open) => { if (open === defaultOpen) flipped.delete(id); else flipped.add(id); } };
    }
    const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (_e) { return false; } };
    const isFolderNode = (n) => Array.isArray(n.children) || !!n.lazy;

    /**
     * A tree. See the file's description for the nodes and the options.
     * @param {Record<string, any>} initial
     */
    function create(initial) {
      const root = h('div', { class: 'dm-tree', role: 'tree' });
      /** @type {Record<string, any>} */
      let o = {};
      /** The visible rows: {node, level, parent, index, setSize, posInSet, folder, open, placeholder?}. */
      let rows = [];
      /** Every known node: id → {node, parent}. */
      let byId = new Map();
      /** id → index in rows. */
      let rowIndex = new Map();
      let focusId = null;
      let anchorId = null;
      /** The name being typed in a row: {id, value, original, label, select}. */
      let editing = null;
      /** What Ctrl+X took for Ctrl+V: {payload, ids}. */
      let cut = null;
      let selecting = false;
      let buttons = false;
      let checked = new Set();
      let stateMemo = new Map();
      let needle = '';
      let kept = new Map();
      let currentId = null;
      /** Children of lazy folders, loaded and loading. */
      const loaded = new Map();
      const loading = new Set();
      let expansion = null;
      let expansionFor = null;
      let virtual = false;
      let rowH = FALLBACK_ROW_H;
      /** Row elements of this drawing, by id (a scroll draws them again from here). */
      let cache = new Map();
      let scroller = null;
      let frame = 0;
      let typed = ''; let typedAt = 0;
      /** A touch press: {id, x, y, pointerId, armed, timer}; a drag with a finger: {payload, node, target, ghost, x, y}. */
      let press = null;
      let pdrag = null;
      let marked = null;
      let suppressUntil = 0;
      let menuKeyAt = 0;
      let renders = 0;
      let alive = true;
      /** Drop zones outside the tree (Hantera's heading: the top level): element → target. */
      const zones = new WeakMap();
      /** This tree, held weakly by its memory so that a fold made elsewhere draws it again while it lives. */
      let selfRef = null;

      // ---- options ----
      function configure(next) {
        o = Object.assign({}, o, next || {});
        const simple = !!o.simple;
        o.checkable_ = !simple && !!o.checkable;
        o.drag_ = !simple && typeof o.onDrop === 'function';
        o.rename_ = !simple && typeof o.onRename === 'function';
        o.menu_ = !simple || typeof o.menu === 'function';
        if (next && 'checked' in next) checked = new Set(next.checked || []);
        if (next && 'selecting' in next) selecting = !!next.selecting;
        if (!selfRef) selfRef = typeof WeakRef === 'function' ? new WeakRef(view) : { deref: () => view };
        const want = o.expansion || o.memory || null;
        if (!expansion || want !== expansionFor) {
          if (expansion && expansion.views) expansion.views.delete(selfRef);
          expansion = o.expansion || (o.memory ? memory(o.memory, o.defaultOpen !== false) : localExpansion(o.defaultOpen !== false));
          if (expansion.views) expansion.views.add(selfRef);
          expansionFor = want;
        }
        buttons = o.aria === 'buttons' || (o.aria !== 'tree' && coarse());
        root.setAttribute('role', buttons ? 'group' : 'tree');
        root.setAttribute('aria-label', o.label || '');
        root.toggleAttribute('data-selecting', selecting);
        root.classList.toggle('dm-tree-simple', simple);
      }

      // ---- the model ----
      const childrenOf = (n) => (Array.isArray(n.children) ? n.children : n.lazy ? (loaded.get(n.id) || null) : null);
      function index() {
        byId = new Map();
        const walk = (list, parent) => { for (const n of list) { byId.set(n.id, { node: n, parent }); const kids = childrenOf(n); if (kids) walk(kids, n); } };
        walk(o.nodes || [], null);
      }
      function filterNodes() {
        needle = String(o.filter || '').trim().toLowerCase();
        kept = new Map();
        if (!needle) return;
        const match = o.match || ((n, s) => String(n.label || '').toLowerCase().includes(s));
        const keep = (n) => {
          let on = !!match(n, needle);
          const kids = childrenOf(n);
          if (kids) for (const k of kids) if (keep(k)) on = true;
          kept.set(n.id, on);
          return on;
        };
        for (const n of o.nodes || []) keep(n);
      }
      function flatten() {
        const out = [];
        const openAll = !!o.openAll || !!needle;
        currentId = null;
        const walk = (list, level, parent) => {
          const shown = needle ? list.filter((n) => kept.get(n.id)) : list;
          shown.forEach((node, i) => {
            const folder = isFolderNode(node);
            const open = folder && (openAll || expansion.isOpen(node.id));
            if (currentId === null && (node.current || (o.activeId != null && o.activeId === node.id))) currentId = node.id;
            out.push({ node, level, parent, index: out.length, setSize: shown.length, posInSet: i + 1, folder, open });
            if (!open) return;
            const kids = childrenOf(node);
            if (kids) { walk(kids, level + 1, node); return; }
            load(node);
            const now = childrenOf(node);
            if (now) walk(now, level + 1, node);
            else out.push({ node: { id: node.id + '\u001floading', label: t('tree.loading') }, level: level + 1, parent: node, index: out.length, setSize: 1, posInSet: 1, folder: false, open: false, placeholder: true });
          });
        };
        walk(o.nodes || [], 0, null);
        return out;
      }
      function load(node) {
        if (loading.has(node.id) || loaded.has(node.id)) return;
        if (typeof o.loadChildren !== 'function') { loaded.set(node.id, []); return; }
        loading.add(node.id);
        let asked;
        try { asked = Promise.resolve(o.loadChildren(node)); } catch (err) { asked = Promise.reject(err); }
        asked
          .then((kids) => { loaded.set(node.id, Array.isArray(kids) ? kids : []); }, (err) => { D.log('tree', err); loaded.set(node.id, []); })
          .finally(() => { loading.delete(node.id); if (alive) redraw(); });
      }
      /** Whether all, some or none of what a node holds is checked. @returns {'all'|'some'|'none'} */
      function checkStateOf(node) {
        if (o.checkState) return o.checkState(node);
        let s = stateMemo.get(node.id);
        if (s) return s;
        const kids = childrenOf(node);
        if (!kids || !kids.length) s = checked.has(node.id) ? 'all' : 'none';
        else {
          let any = false; let all = true; let some = false;
          for (const k of kids) {
            if (k.checkable === false) continue;
            any = true;
            const ks = checkStateOf(k);
            if (ks !== 'all') all = false;
            if (ks !== 'none') some = true;
          }
          s = !any ? 'none' : all ? 'all' : some ? 'some' : 'none';
        }
        stateMemo.set(node.id, s);
        return s;
      }
      /** The checkable ends at and below a node: the nodes without children (empty folders too). */
      function leavesOf(node, out) {
        const kids = childrenOf(node);
        if (!kids || !kids.length) { if (node.checkable !== false) out.push(node.id); return out; }
        for (const k of kids) leavesOf(k, out);
        return out;
      }
      const checkableRow = (r) => !!r && !r.placeholder && o.checkable_ && r.node.checkable !== false;
      function isAncestor(id, of) { for (let at = byId.get(of); at && at.parent; at = byId.get(at.parent.id)) if (at.parent.id === id) return true; return false; }
      function canDrag(n) { return o.drag_ && n.draggable !== false && !(typeof o.canDrag === 'function' && !o.canDrag(n)); }
      const dragData = (n) => (typeof o.dragData === 'function' ? o.dragData(n) : { ids: [n.id] });
      function canDrop(payload, target) {
        if (typeof o.canDrop === 'function') return !!o.canDrop(payload, target);
        if (!target) return true;
        const ids = payload && Array.isArray(payload.ids) ? payload.ids : [];
        return !ids.includes(target.id) && !ids.some((id) => isAncestor(id, target.id));
      }
      /** Where a drop on a row goes: into a folder, beside an item (its folder, or the top level). undefined: nowhere. */
      function dropTargetOf(r) {
        if (!r) return undefined;
        if (r.folder && !r.placeholder && r.node.droppable !== false) return r.node;
        return r.parent || null;
      }

      // ---- drawing ----
      function readRowHeight() {
        if (!root.isConnected) return rowH || FALLBACK_ROW_H;
        const v = parseFloat(getComputedStyle(root).getPropertyValue('--dm-tree-row-h'));
        return Number.isFinite(v) && v > 0 ? v : FALLBACK_ROW_H;
      }
      function tabStop() {
        if (focusId !== null && rowIndex.has(focusId)) return focusId;
        if (currentId !== null && rowIndex.has(currentId)) return currentId;
        return rows.length ? rows[0].node.id : null;
      }
      function focusInfo() {
        const a = /** @type {HTMLElement|null} */ (document.activeElement);
        if (!a || !root.contains(a)) return null;
        const rowEl = a.closest('[data-tree-row]');
        if (!rowEl) return null;
        const id = rowEl.getAttribute('data-key');
        const part = a.closest('[data-part]');
        return { id, part: part ? part.getAttribute('data-part') : 'main', index: rowIndex.has(id) ? rowIndex.get(id) : -1 };
      }
      function redraw() {
        if (!alive) return;
        renders++;
        const before = focusInfo();
        filterNodes();
        index();
        stateMemo = new Map();
        rows = flatten();
        rowIndex = new Map(rows.map((r, i) => [r.node.id, i]));
        if (editing && !rowIndex.has(editing.id)) editing = null;
        cache = new Map();
        virtual = rows.length > (o.virtualFrom || VIRTUAL_FROM);
        root.classList.toggle('dm-tree-virtual', virtual);
        if (virtual) {
          rowH = readRowHeight();
          root.style.height = rows.length * rowH + 'px';
          root.replaceChildren();
          watch();
          renderWindow();
        } else {
          root.style.height = '';
          const frag = document.createDocumentFragment();
          for (const r of rows) frag.appendChild(rowEl(r));
          root.replaceChildren(frag);
        }
        restore(before);
      }
      function restore(before) {
        if (editing) {
          const input = /** @type {any} */ (root.querySelector(`[data-key="${CSS.escape(editing.id)}"] dm-input`));
          if (input && (before || editing.select)) {
            const control = input.control || input;
            control.focus();
            if (control.setSelectionRange && typeof control.value === 'string') { if (editing.select) control.select(); else control.setSelectionRange(control.value.length, control.value.length); }
            editing.select = false;
            return;
          }
        }
        if (!before) return;
        if (rowIndex.has(before.id)) { focusRow(before.id); return; }
        if (rows.length) focusRow(rows[Math.max(0, Math.min(before.index < 0 ? 0 : before.index, rows.length - 1))].node.id);
      }
      function rowEl(r) {
        const cached = cache.get(r.node.id);
        if (cached) return cached;
        const n = r.node;
        let el;
        if (r.placeholder) {
          el = h('div', { class: 'dm-tree-row dm-tree-placeholder', role: 'none', 'data-tree-row': '', 'data-key': n.id },
            h('span', { class: 'dm-tree-spacer', 'aria-hidden': 'true' }),
            h('div', { class: 'dm-list-item dm-tree-main', role: buttons ? 'note' : 'treeitem', 'data-part': 'main', tabindex: '-1', 'aria-level': buttons ? null : String(r.level + 1), 'aria-busy': 'true' },
              icons.icon('loader-circle', 16), h('span', { class: 'dm-truncate', text: n.label })));
        } else {
          const st = checkableRow(r) ? checkStateOf(n) : null;
          const mixed = st === 'all' ? 'true' : st === 'some' ? 'mixed' : 'false';
          const isCurrent = n.id === currentId;
          const editHere = !!editing && editing.id === n.id;
          const main = h('div', Object.assign({}, n.mainAttrs || {}, {
            class: 'dm-list-item dm-tree-main' + (n.mainClass ? ' ' + n.mainClass : ''),
            role: buttons ? 'button' : 'treeitem', 'data-part': 'main', tabindex: n.id === tabStop() ? '0' : '-1',
            'aria-level': buttons ? null : String(r.level + 1), 'aria-setsize': buttons ? null : String(r.setSize), 'aria-posinset': buttons ? null : String(r.posInSet),
            'aria-expanded': r.folder ? String(r.open) : null,
            'aria-checked': !buttons && st ? mixed : null, 'aria-pressed': buttons && st ? mixed : null,
            'aria-selected': !buttons && !o.checkable_ ? String(isCurrent) : null, 'aria-current': isCurrent ? 'true' : null,
            draggable: canDrag(n) && !editHere ? 'true' : null,
          }));
          main.appendChild(icons.icon(r.folder && r.open && n.iconOpen ? n.iconOpen : (n.icon || (r.folder ? (r.open ? 'folder-open' : 'folder') : 'file')), 16));
          if (editHere) main.appendChild(editor(n));
          else {
            const sub = n.sub || n.code ? h('span', { class: 'dm-list-sub dm-truncate' }) : null;
            if (sub) {
              if (n.code) sub.appendChild(h('code', { class: 'dm-list-code', text: n.code }));
              if (n.code && n.sub) sub.appendChild(document.createTextNode(' · '));
              if (n.sub) sub.appendChild(document.createTextNode(String(n.sub)));
            }
            main.appendChild(h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate dm-tree-label', text: n.label }), sub));
          }
          for (const b of n.badges || []) main.appendChild(h('dm-badge', { kind: b.kind || null, text: b.text }));
          if (n.count !== undefined && n.count !== null && n.count !== '') main.appendChild(h('span', { class: 'dm-tree-count', text: typeof n.count === 'number' ? i18n.formatNumber(n.count) : String(n.count) }));
          const cls = (r.folder ? 'dm-tree-folder-row' : 'dm-tree-row') + (n.cut || (cut && cut.ids.has(n.id)) ? ' dm-tree-cut' : '') + (st === 'all' ? ' dm-tree-checked' : '') + (isCurrent ? ' dm-tree-current' : '');
          el = h('div', Object.assign({}, n.rowAttrs || {}, { class: cls, role: 'none', 'data-key': n.id, 'data-tree-row': '' }));
          if (o.checkable_) {
            el.appendChild(n.checkable === false ? h('span', { class: 'dm-tree-check', 'aria-hidden': 'true' })
              : h('label', { class: 'dm-tree-check', 'aria-hidden': 'true' }, h('input', { type: 'checkbox', 'data-part': 'box', tabindex: '-1', props: { checked: st === 'all', indeterminate: st === 'some' } })));
          }
          el.appendChild(r.folder
            ? h('button', { type: 'button', class: 'dm-tree-toggle', 'data-part': 'toggle', tabindex: '-1', 'aria-hidden': 'true', 'aria-expanded': String(r.open), 'aria-label': t(r.open ? 'tree.collapse' : 'tree.expand', { name: n.label }), 'data-tip': t(r.open ? 'tree.collapse' : 'tree.expand', { name: n.label }) }, icons.icon(r.open ? 'chevron-down' : 'chevron-right', 14))
            : h('span', { class: 'dm-tree-spacer', 'aria-hidden': 'true' }));
          el.appendChild(main);
          if (n.trailing) el.appendChild(n.trailing);
        }
        el.style.setProperty('--dm-depth', String(r.level));
        if (virtual) el.style.top = r.index * rowH + 'px';
        cache.set(n.id, el);
        return el;
      }
      function editor(n) {
        const ed = editing;
        const input = /** @type {any} */ (h('dm-input', { 'aria-label': ed.label || t('tree.rename.field', { name: n.label }), class: 'dm-tree-edit', 'data-part': 'edit' }));
        input.value = ed.value;
        input.addEventListener('input', () => { if (editing === ed) ed.value = input.value; });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
          else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
          // The keys in the field are the field's, not the tree's.
          e.stopPropagation();
        });
        // Leaving the field keeps what was typed, as in a file manager; a field taken away by a new drawing does not count.
        input.addEventListener('focusout', () => { setTimeout(() => { if (input.isConnected && editing === ed && !input.contains(document.activeElement)) finishEdit(true); }, 0); });
        return input;
      }

      // ---- the rows in view (large trees) ----
      function scrollerOf() {
        if (o.scroller) return o.scroller;
        for (let el = root.parentElement; el; el = el.parentElement) {
          const s = getComputedStyle(el).overflowY;
          if (s === 'auto' || s === 'scroll') return el;
        }
        return document.scrollingElement || document.documentElement;
      }
      const onScroll = () => { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; renderWindow(); }); };
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (virtual) relayout(); }) : null;
      if (ro) ro.observe(root);
      function watch() {
        const sc = scrollerOf();
        if (sc === scroller) return;
        unwatch();
        scroller = sc;
        const target = sc === document.scrollingElement || sc === document.documentElement ? window : sc;
        target.addEventListener('scroll', onScroll, { passive: true });
        if (ro && target !== window) ro.observe(sc);
      }
      function unwatch() {
        if (!scroller) return;
        const target = scroller === document.scrollingElement || scroller === document.documentElement ? window : scroller;
        target.removeEventListener('scroll', onScroll);
        if (ro && target !== window) ro.unobserve(scroller);
        scroller = null;
      }
      /** The row height may change with the window (44 px on narrow screens): the rows move to their places. */
      function relayout() {
        const v = readRowHeight();
        if (v !== rowH) {
          rowH = v;
          root.style.height = rows.length * rowH + 'px';
          for (const el of Array.from(root.children)) { const i = rowIndex.get(el.getAttribute('data-key')); if (i !== undefined) /** @type {HTMLElement} */ (el).style.top = i * rowH + 'px'; }
        }
        watch();
        renderWindow();
      }
      /** How far the top of the tree is above the top of what is in view, and how much is in view. */
      function viewport() {
        const sc = scroller || scrollerOf();
        const tr = root.getBoundingClientRect();
        if (sc === document.scrollingElement || sc === document.documentElement) return { offset: -tr.top, height: window.innerHeight };
        const sr = sc.getBoundingClientRect();
        return { offset: sr.top + sc.clientTop - tr.top, height: sc.clientHeight };
      }
      function renderWindow() {
        if (!virtual || !alive) return;
        let first = 0; let last = Math.min(rows.length - 1, 60);
        if (root.isConnected) {
          const v = viewport();
          if (v.height > 0) {
            first = Math.max(0, Math.floor(v.offset / rowH) - OVERSCAN);
            last = Math.max(first, Math.min(rows.length - 1, Math.ceil((v.offset + v.height) / rowH) + OVERSCAN));
          }
        }
        const keep = new Set();
        for (let i = first; i <= last; i++) keep.add(i);
        // The row with the focus, the one being named and the one being dragged stay, wherever they are.
        for (const id of [focusId, editing && editing.id, press && press.id]) if (id !== null && rowIndex.has(id)) keep.add(rowIndex.get(id));
        for (const el of Array.from(root.children)) { const i = rowIndex.get(el.getAttribute('data-key')); if (i === undefined || !keep.has(i)) el.remove(); }
        const present = new Map(Array.from(root.children).map((el) => [rowIndex.get(el.getAttribute('data-key')), el]));
        const wanted = Array.from(keep).sort((a, b) => a - b);
        let next = null;
        for (let s = wanted.length - 1; s >= 0; s--) {
          let el = present.get(wanted[s]);
          if (!el) { el = rowEl(rows[wanted[s]]); root.insertBefore(el, next); }
          next = el;
        }
      }
      function ensureVisible(i) {
        if (!virtual || !root.isConnected) return;
        const sc = scroller || scrollerOf();
        const v = viewport();
        const top = i * rowH; const bottom = top + rowH;
        const by = top < v.offset ? top - v.offset : bottom > v.offset + v.height ? bottom - v.offset - v.height : 0;
        if (by) { if (sc === document.scrollingElement || sc === document.documentElement) window.scrollBy(0, by); else sc.scrollTop += by; }
        renderWindow();
      }
      const page = () => (virtual && root.isConnected ? Math.max(1, Math.floor(viewport().height / rowH) - 1) : 10);

      // ---- focus ----
      const mainOf = (id) => /** @type {HTMLElement|null} */ (root.querySelector(`[data-key="${CSS.escape(id)}"] > [data-part="main"]`));
      function focusRow(id) {
        if (!rowIndex.has(id)) return false;
        focusId = id;
        if (virtual) ensureVisible(rowIndex.get(id));
        const el = mainOf(id);
        if (!el) return false;
        for (const m of Array.from(root.querySelectorAll('[data-part="main"][tabindex="0"]'))) if (m !== el) m.setAttribute('tabindex', '-1');
        el.setAttribute('tabindex', '0');
        el.focus({ preventScroll: virtual });
        return true;
      }
      const move = (j) => { if (rows.length) focusRow(rows[Math.max(0, Math.min(rows.length - 1, j))].node.id); return true; };
      root.addEventListener('focusin', (e) => {
        const main = /** @type {HTMLElement} */ (e.target).closest('[data-part="main"]');
        const rowEl = main && main.closest('[data-tree-row]');
        if (!rowEl) return;
        focusId = rowEl.getAttribute('data-key');
        for (const m of Array.from(root.querySelectorAll('[data-part="main"][tabindex="0"]'))) if (m !== main) m.setAttribute('tabindex', '-1');
        main.setAttribute('tabindex', '0');
      });

      // ---- actions ----
      function setOpen(id, open) { expansion.setOpen(id, open); redraw(); }
      function activate(r, e) {
        if (!r || r.placeholder) return;
        const handled = typeof o.onActivate === 'function' ? o.onActivate(r.node, e || null) : false;
        if (handled !== true && r.folder) setOpen(r.node.id, !r.open);
      }
      function rangeRows(fromId, toId) {
        const a = rowIndex.get(fromId); const b = rowIndex.get(toId);
        if (a === undefined || b === undefined) return null;
        return rows.slice(Math.min(a, b), Math.max(a, b) + 1).filter(checkableRow);
      }
      /** Check a row (or the rows from the last one checked, with Shift), or all of `range`. */
      function check(r, e, range) {
        if (!checkableRow(r)) return;
        const span = range || (e && e.shiftKey && anchorId !== null ? rangeRows(anchorId, r.node.id) : null);
        if (!range && !(e && e.shiftKey)) anchorId = r.node.id;
        const on = range ? !range.every((x) => checkStateOf(x.node) === 'all') : checkStateOf(r.node) !== 'all';
        const nodes = span ? span.map((x) => x.node) : [r.node];
        const at = renders;
        if (typeof o.onCheck === 'function') o.onCheck(r.node, { range: span ? nodes : null, on });
        else {
          const next = new Set(checked);
          for (const n of nodes) for (const id of leavesOf(n, [])) { if (on) next.add(id); else next.delete(id); }
          checked = next;
          if (typeof o.onCheckedChange === 'function') o.onCheckedChange(Array.from(next));
        }
        if (renders === at) redraw();
      }
      function drop(payload, target, e) {
        if (!o.drag_ || !payload || !canDrop(payload, target || null)) return false;
        o.onDrop(payload, target || null, e || null);
        return true;
      }
      function openSiblings(r) {
        const list = r.parent ? (childrenOf(r.parent) || []) : (o.nodes || []);
        for (const n of list) if (isFolderNode(n)) expansion.setOpen(n.id, true);
        redraw();
      }
      function typeAhead(ch, from) {
        const now = Date.now();
        typed = now - typedAt > TYPE_MS ? ch.toLowerCase() : typed + ch.toLowerCase();
        typedAt = now;
        // The same letter again goes on to the next name with it, as in a file manager.
        const same = typed.split('').every((c) => c === typed[0]);
        const want = same ? typed[0] : typed;
        const start = same ? from + 1 : from;
        for (let s = 0; s < rows.length; s++) {
          const r = rows[(start + s) % rows.length];
          if (!r.placeholder && String(r.node.label || '').toLowerCase().startsWith(want)) return move(r.index);
        }
        return true;
      }
      function edit(id, opts = {}) {
        if (!byId.has(id)) return false;
        const node = byId.get(id).node;
        reveal(id, false);
        editing = { id, value: opts.value !== undefined ? String(opts.value) : String(node.label || ''), original: opts.original !== undefined ? String(opts.original) : String(node.label || ''), label: opts.label || null, select: true };
        focusId = id;
        redraw();
        return true;
      }
      function finishEdit(save) {
        const ed = editing;
        if (!ed) return;
        editing = null;
        const at = byId.get(ed.id);
        const value = String(ed.value || '').trim();
        focusId = ed.id;
        redraw();
        if (!at) return;
        if (save && value && value !== ed.original) { if (typeof o.onRename === 'function') o.onRename(at.node, value); }
        else if (typeof o.onRenameCancel === 'function') o.onRenameCancel(at.node);
      }
      /** Open the folders above a node, and bring it into view. */
      function reveal(id, draw = true) {
        for (let at = byId.get(id); at && at.parent; at = byId.get(at.parent.id)) if (!expansion.isOpen(at.parent.id)) expansion.setOpen(at.parent.id, true);
        if (draw) { redraw(); if (virtual && rowIndex.has(id)) ensureVisible(rowIndex.get(id)); }
      }
      function defaultItems(node) {
        const out = [];
        if (o.rename_ && node.renamable !== false) out.push({ id: 'rename', label: t('common.rename'), icon: 'pencil', onSelect: () => edit(node.id) });
        if (o.drag_ && canDrag(node)) out.push({ id: 'move', label: t('tree.move.to'), icon: 'folder-input', onSelect: () => { moveTo(node); } });
        return out;
      }
      function openMenuAt(r, at) {
        if (!r || r.placeholder || !o.menu_) return false;
        const defaults = defaultItems(r.node);
        const items = typeof o.menu === 'function' ? o.menu(r.node, defaults) : defaults;
        if (!items || !items.filter(Boolean).length) return false;
        focusRow(r.node.id);
        const main = mainOf(r.node.id);
        menu.open(Object.assign({ items, label: t('tree.menu', { name: r.node.label }) }, at ? { x: at.x, y: at.y } : { anchor: main || root }));
        return true;
      }
      /**
       * Flytta till…: the folders a node can go to, in a dialog; the same as dragging it there.
       * @param {any} node @param {any} [payload]
       */
      async function moveTo(node, payload) {
        const what = payload || dragData(node);
        if (!what) return;
        const choices = [{ value: '', label: o.rootLabel || t('tree.root') }];
        const walk = (list, path) => {
          for (const n of list) {
            if (!isFolderNode(n) || n.id === node.id) continue;
            const p = path.concat(String(n.label || ''));
            if (n.droppable !== false && canDrop(what, n)) choices.push({ value: n.id, label: p.join(' / ') });
            const kids = childrenOf(n);
            if (kids) walk(kids, p);
          }
        };
        walk(o.nodes || [], []);
        const sel = basic.select(t('tree.move.target'), choices, '', () => {}, { 'data-tree-move': '' });
        const ok = await overlays.dialog.open({ title: t('tree.move.title', { name: node.label }), body: sel, actions: [{ label: t('common.cancel'), value: false }, { label: t('tree.move.here'), variant: 'primary', value: true, primary: true }] });
        if (alive) focusRow(node.id);
        if (ok !== true) return;
        const to = /** @type {any} */ (sel).value;
        drop(what, to && byId.has(to) ? byId.get(to).node : null);
      }

      // ---- keys ----
      function handleKey(e, r) {
        const k = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        const i = r.index;
        if ((k === 'F10' && e.shiftKey && !ctrl && !e.altKey) || k === 'ContextMenu') { menuKeyAt = Date.now(); openMenuAt(r, null); return true; }
        if (ctrl && !e.altKey && !e.shiftKey) {
          const letter = k.length === 1 ? k.toLowerCase() : '';
          if (letter === 'a' && o.checkable_) { const all = rows.filter(checkableRow); if (all.length) check(all[0], null, all); return true; }
          if (letter === 'x' && o.drag_ && !r.placeholder && canDrag(r.node)) { const payload = dragData(r.node); if (payload) { cut = { payload, ids: new Set([r.node.id]) }; redraw(); } return true; }
          if (letter === 'v' && o.drag_ && cut) {
            // What was cut waits for a place it can go to (a folder does not go into itself).
            const target = dropTargetOf(r);
            if (canDrop(cut.payload, target)) { const c = cut; cut = null; redraw(); drop(c.payload, target); }
            return true;
          }
          return false;
        }
        if (ctrl || e.altKey) return false;
        if (e.shiftKey && o.checkable_ && (k === 'ArrowDown' || k === 'ArrowUp')) {
          const j = Math.max(0, Math.min(rows.length - 1, i + (k === 'ArrowDown' ? 1 : -1)));
          if (j !== i) { move(j); check(rows[j], null); }
          return true;
        }
        if (e.shiftKey && o.checkable_ && k === ' ') { check(r, { shiftKey: true }); return true; }
        // * is a shifted key on many keyboards, and so are capital letters.
        if (k === '*') { openSiblings(r); return true; }
        if (k.length === 1 && k !== ' ') return typeAhead(k, i);
        if (e.shiftKey) return false;
        switch (k) {
          case 'ArrowDown': return move(i + 1);
          case 'ArrowUp': return move(i - 1);
          case 'Home': return move(0);
          case 'End': return move(rows.length - 1);
          case 'PageDown': return move(i + page());
          case 'PageUp': return move(i - page());
          case 'ArrowRight':
            if (r.folder && !r.open) setOpen(r.node.id, true);
            else if (r.folder && rows[i + 1] && rows[i + 1].parent === r.node) move(i + 1);
            return true;
          case 'ArrowLeft':
            if (r.folder && r.open) setOpen(r.node.id, false);
            else if (r.parent && rowIndex.has(r.parent.id)) move(rowIndex.get(r.parent.id));
            return true;
          case 'Enter': activate(r, e); return true;
          case ' ': if (checkableRow(r)) check(r, e); else activate(r, e); return true;
          case 'F2': if (o.rename_ && !r.placeholder && r.node.renamable !== false) { edit(r.node.id); return true; } return false;
          case 'Escape': if (cut) { cut = null; redraw(); return true; } return false;
          default: return false;
        }
      }
      const rowOfEl = (el) => { const rowEl = el && el.closest ? el.closest('[data-tree-row]') : null; if (!rowEl || !root.contains(rowEl)) return null; const i = rowIndex.get(rowEl.getAttribute('data-key')); return i === undefined ? null : rows[i]; };
      root.addEventListener('keydown', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target.closest('[data-part="main"]') || target.closest('dm-input')) return;
        const r = rowOfEl(target);
        if (!r) return;
        if (typeof o.onKey === 'function' && !r.placeholder && o.onKey(e, r.node) === true) { e.preventDefault(); e.stopPropagation(); return; }
        if (handleKey(e, r)) { e.preventDefault(); e.stopPropagation(); }
      });

      // ---- pointer ----
      // The chevron and the check box do not take the focus (it stays in the tree, and no tip lands over the next row).
      root.addEventListener('mousedown', (e) => { if (/** @type {HTMLElement} */ (e.target).closest('[data-part="toggle"], .dm-tree-check')) e.preventDefault(); });
      root.addEventListener('click', (e) => {
        if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
        const target = /** @type {HTMLElement} */ (e.target);
        const part = target.closest('[data-part]');
        const r = rowOfEl(target);
        if (!r || !part || !root.contains(part)) return;
        const p = part.getAttribute('data-part');
        if (p === 'toggle') { if (r.folder) setOpen(r.node.id, !r.open); return; }
        if (p === 'box') { if (target.tagName === 'INPUT') check(r, e); return; }
        if (p !== 'main' || target.closest('dm-input') || r.placeholder) return;
        focusId = r.node.id;
        if (checkableRow(r) && (e.ctrlKey || e.metaKey || e.shiftKey || selecting)) { check(r, e.shiftKey ? e : null); return; }
        activate(r, e);
      }, true);
      root.addEventListener('contextmenu', (e) => {
        if (press || Date.now() - menuKeyAt < 600) { e.preventDefault(); return; }
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('dm-input')) return;
        const r = rowOfEl(target);
        if (!r) return;
        const keyboard = e.clientX === 0 && e.clientY === 0;
        if (openMenuAt(r, keyboard ? null : { x: e.clientX, y: e.clientY })) e.preventDefault();
      });
      // Touch and pen: a long press opens the snabbmeny, a long press and a move drags (the browser's own drag and drop does
      // not work with touch on Android and only partly on iOS).
      root.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || !e.isPrimary || pdrag) return;
        const main = /** @type {HTMLElement} */ (e.target).closest('[data-part="main"]');
        const r = rowOfEl(main);
        if (!main || !r || r.placeholder || (editing && editing.id === r.node.id)) return;
        cancelPress();
        const id = r.node.id;
        press = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, armed: false, timer: setTimeout(() => { if (press && press.id === id) { press.armed = true; main.classList.add('dm-tree-pressed'); } }, PRESS_MS) };
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
      });
      // Once the press is held, the finger moves the row and not the page.
      root.addEventListener('touchmove', (e) => { if (press && (press.armed || pdrag)) e.preventDefault(); }, { passive: false });
      function onPointerMove(e) {
        if (!press || e.pointerId !== press.pointerId) return;
        const far = Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP;
        if (pdrag) { e.preventDefault(); dragMove(e.clientX, e.clientY); return; }
        if (!press.armed) { if (far) cancelPress(); return; }
        if (far) {
          const r = rows[rowIndex.get(press.id)];
          if (r && canDrag(r.node)) startDrag(r, e.clientX, e.clientY);
        }
      }
      function onPointerUp(e) {
        if (!press || e.pointerId !== press.pointerId) return;
        const r = rows[rowIndex.get(press.id)];
        if (pdrag) { finishDrag(); suppressUntil = performance.now() + 600; }
        else if (press.armed && r) { suppressUntil = performance.now() + 600; cancelPress(); openMenuAt(r, { x: e.clientX, y: e.clientY }); return; }
        cancelPress();
      }
      function onPointerCancel() { cancelDrag(); cancelPress(); }
      function cancelPress() {
        if (!press) return;
        clearTimeout(press.timer);
        const main = mainOf(press.id);
        if (main) main.classList.remove('dm-tree-pressed');
        press = null;
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
      }
      function startDrag(r, x, y) {
        const payload = dragData(r.node);
        if (!payload) { cancelPress(); return; }
        const n = payload && Array.isArray(payload.ids) ? payload.ids.length + (Array.isArray(payload.folders) ? payload.folders.length : 0) : 1;
        const ghost = h('div', { class: 'dm-tree-ghost', 'aria-hidden': 'true' }, icons.icon(r.node.icon || (r.folder ? 'folder' : 'file'), 16),
          h('span', { class: 'dm-truncate', text: n > 1 ? t('tree.drag.many', { name: r.node.label, n }) : r.node.label }));
        document.body.appendChild(ghost);
        pdrag = { payload, node: r.node, target: undefined, ghost, x, y, speed: 0 };
        root.setAttribute('data-dragging', '');
        dragMove(x, y);
      }
      function dragMove(x, y) {
        if (!pdrag) return;
        pdrag.x = x; pdrag.y = y;
        pdrag.ghost.style.left = Math.round(x + 12) + 'px';
        pdrag.ghost.style.top = Math.round(y + 12) + 'px';
        const under = /** @type {HTMLElement|null} */ (document.elementFromPoint(x, y));
        const zone = under ? under.closest('[data-tree-drop]') : null;
        let target;
        if (zone && zones.has(zone)) target = zones.get(zone);
        else if (under && root.contains(under)) target = dropTargetOf(rowOfEl(under));
        if (target !== undefined && !canDrop(pdrag.payload, target)) target = undefined;
        pdrag.target = target;
        mark(zone && zones.has(zone) ? zone : target === undefined ? null : target === null ? root : (rowIndex.has(target.id) ? root.querySelector(`[data-key="${CSS.escape(target.id)}"]`) : null));
        // Near the top or the bottom of the scrolled area the drag scrolls it.
        const sc = scroller || scrollerOf();
        const box = sc === document.scrollingElement || sc === document.documentElement ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
        pdrag.speed = y < box.top + EDGE ? -Math.ceil((box.top + EDGE - y) / 4) : y > box.bottom - EDGE ? Math.ceil((y - box.bottom + EDGE) / 4) : 0;
        if (pdrag.speed && !pdrag.scrolling) { pdrag.scrolling = true; requestAnimationFrame(autoScroll); }
      }
      function autoScroll() {
        if (!pdrag || !pdrag.speed) { if (pdrag) pdrag.scrolling = false; return; }
        const sc = scroller || scrollerOf();
        if (sc === document.scrollingElement || sc === document.documentElement) window.scrollBy(0, pdrag.speed); else sc.scrollTop += pdrag.speed;
        dragMove(pdrag.x, pdrag.y);
        requestAnimationFrame(autoScroll);
      }
      function finishDrag() {
        if (!pdrag) return;
        const { payload, target } = pdrag;
        cancelDrag();
        if (target !== undefined) drop(payload, target);
      }
      function cancelDrag() {
        if (!pdrag) return;
        pdrag.ghost.remove();
        pdrag = null;
        root.removeAttribute('data-dragging');
        mark(null);
      }
      function mark(el) {
        if (marked === el) return;
        if (marked) marked.classList.remove('dm-drop-target');
        marked = el;
        if (el) el.classList.add('dm-drop-target');
      }

      // ---- the browser's drag and drop (mouse) ----
      const carries = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes(DRAG_TYPE);
      const payloadOf = (e) => { try { const v = JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || 'null'); return v && typeof v === 'object' ? v : null; } catch (_e) { return null; } };
      function targetOfEvent(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        const r = rowOfEl(target);
        if (r) return dropTargetOf(r);
        return target === root ? null : undefined;
      }
      root.addEventListener('dragstart', (e) => {
        const r = rowOfEl(/** @type {HTMLElement} */ (e.target).closest('[data-part="main"]'));
        if (!r || r.placeholder || !canDrag(r.node) || !e.dataTransfer) return;
        const payload = dragData(r.node);
        if (!payload) { e.preventDefault(); return; }
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
      });
      root.addEventListener('dragover', (e) => {
        if (!o.drag_ || !carries(e)) return;
        const target = targetOfEvent(e);
        if (target === undefined) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        mark(target === null ? root : root.querySelector(`[data-key="${CSS.escape(target.id)}"]`));
      });
      root.addEventListener('dragleave', (e) => { if (!root.contains(/** @type {Node} */ (e.relatedTarget))) mark(null); });
      root.addEventListener('dragend', () => mark(null));
      root.addEventListener('drop', (e) => {
        mark(null);
        if (!o.drag_ || !e.dataTransfer) return;
        const target = targetOfEvent(e);
        if (target === undefined) return;
        const payload = payloadOf(e);
        if (!payload) return;
        e.preventDefault();
        drop(payload, target, e);
      });
      /**
       * Make an element outside the tree a place to drop on (Hantera's heading: the top level).
       * @param {HTMLElement} el @param {any} [target] a folder node, or null for the top level
       */
      function dropZone(el, target = null) {
        zones.set(el, target);
        el.setAttribute('data-tree-drop', '');
        el.addEventListener('dragover', (e) => { if (!o.drag_ || !carries(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dm-drop-target'); });
        el.addEventListener('dragleave', () => el.classList.remove('dm-drop-target'));
        el.addEventListener('drop', (e) => {
          el.classList.remove('dm-drop-target');
          const payload = o.drag_ && e.dataTransfer ? payloadOf(e) : null;
          if (!payload) return;
          e.preventDefault();
          drop(payload, zones.get(el), e);
        });
      }

      const view = {
        el: root,
        /** New nodes or options; the tree draws itself again at once. @param {Record<string, any>} next */
        update(next) { configure(next); redraw(); return view; },
        refresh() { redraw(); return view; },
        /** Focus a row's main part, or its name field while it is being named. @param {string} id @param {string} [part] */
        focus(id, part) {
          if (part === 'edit' && editing && editing.id === id) { const input = /** @type {any} */ (root.querySelector(`[data-key="${CSS.escape(id)}"] dm-input`)); if (input) { (input.control || input).focus(); return true; } }
          return focusRow(id);
        },
        /** Focus the row at a place in the visible list. @param {number} i */
        focusIndex(i) { if (!rows.length) return false; return focusRow(rows[Math.max(0, Math.min(rows.length - 1, i))].node.id); },
        edit, finishEdit, reveal, moveTo, dropZone,
        /** @param {string} id */
        isOpen: (id) => !!expansion && expansion.isOpen(id),
        /** @param {string} id @param {boolean} open */
        setOpen,
        /** The visible rows, top to bottom. */
        rows: () => rows.map((r) => ({ id: r.node.id, level: r.level, folder: r.folder, open: r.open, placeholder: !!r.placeholder })),
        /** The rows that are drawn (fewer than the visible ones in a large tree). */
        drawn: () => root.querySelectorAll('[data-tree-row]').length,
        /** @param {boolean} on */
        setSelecting(on) { selecting = !!on; o.selecting = selecting; root.toggleAttribute('data-selecting', selecting); return view; },
        selecting: () => selecting,
        openMenu: (id) => openMenuAt(rows[rowIndex.get(id)], null),
        destroy() {
          alive = false;
          cancelDrag(); cancelPress(); unwatch();
          if (ro) ro.disconnect();
          if (frame) cancelAnimationFrame(frame);
          if (expansion && expansion.views) expansion.views.delete(selfRef);
        },
      };
      configure(initial);
      redraw();
      return view;
    }

    return { create, memory, VIRTUAL_FROM };
  });
})();
