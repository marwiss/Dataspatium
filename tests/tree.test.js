// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of the tree (ui/tree, F127 a): the keys and ARIA of the WAI-ARIA tree pattern, check boxes in three states, the filter,
 * the folds kept under a key, renaming in place, moving with the keys, Flytta till … and dragging with a finger, the snabbmeny,
 * the simple mode, lazy children and 20 000 nodes drawn only in view; and the dataset list on top of it (ui/dataset-list).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const tree = D.require('ui/tree');
  const menu = D.require('ui/menu');
  const idb = D.require('platform/storage/idb');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 3000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})));
  const click = (el, extra) => el.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, extra || {})));
  /** Arkiv (Anteckningar, Bilder, Byggnad (Plan 1)) and Ceder. */
  const sample = () => [
    { id: 'A', label: 'Arkiv', children: [
      { id: 'a1', label: 'Anteckningar', sub: 'text' },
      { id: 'a2', label: 'Bilder' },
      { id: 'B', label: 'Byggnad', children: [{ id: 'b1', label: 'Plan 1' }] },
    ] },
    { id: 'c', label: 'Ceder' },
  ];
  /** A tree in a box of its own; `onScreen` puts it where the pointer can reach it (elementFromPoint). */
  function mount(opts, onScreen) {
    const host = document.createElement('div');
    host.style.cssText = onScreen ? 'position:fixed; left:0; top:0; width:320px; z-index:9999; background:var(--dm-surface);' : 'position:absolute; left:-10000px; top:0; width:320px;';
    document.body.appendChild(host);
    const view = tree.create(Object.assign({ label: 'Prov', nodes: sample() }, opts || {}));
    host.appendChild(view.el);
    view.refresh();
    const main = (id) => /** @type {HTMLElement} */ (view.el.querySelector(`[data-key="${CSS.escape(id)}"] > [data-part="main"]`));
    const row = (id) => /** @type {HTMLElement} */ (view.el.querySelector(`[data-key="${CSS.escape(id)}"]`));
    const ids = () => view.rows().map((r) => r.id);
    return {
      host, view, main, row, ids,
      done: () => {
        if (host.contains(document.activeElement)) /** @type {any} */ (document.activeElement).blur();
        const m = menu.current(); if (m) m.close(false);
        for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
        view.destroy(); host.remove();
      },
    };
  }
  const centre = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
  const pointer = (el, type, at, id = 7) => el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, isPrimary: true, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }));

  test('tree: the keys and ARIA follow the WAI-ARIA tree pattern (arrows, Home, End, Enter, a letter, *) with one tab stop', async (assert) => {
    const activated = [];
    const m = mount({ activeId: 'a2', onActivate: (n) => { activated.push(n.id); return n.id === 'A' ? undefined : true; } });
    try {
      const el = m.view.el;
      assert.equal(el.getAttribute('role'), 'tree');
      assert.equal(el.getAttribute('aria-label'), 'Prov');
      assert.equal(m.main('A').getAttribute('role'), 'treeitem');
      assert.deepEqual(['aria-level', 'aria-setsize', 'aria-posinset', 'aria-expanded'].map((a) => m.main('A').getAttribute(a)), ['1', '2', '1', 'true']);
      assert.deepEqual(['aria-level', 'aria-setsize', 'aria-posinset'].map((a) => m.main('B').getAttribute(a)), ['2', '3', '3']);
      assert.equal(m.main('b1').getAttribute('aria-level'), '3');
      assert.equal(m.main('c').getAttribute('aria-expanded'), null, 'an item has no expanded state');
      assert.equal(m.main('a2').getAttribute('aria-selected'), 'true', 'the active item is the selected one');
      assert.equal(m.main('a2').getAttribute('aria-current'), 'true');
      assert.equal(m.main('a1').getAttribute('aria-selected'), 'false');
      assert.equal(el.querySelectorAll('[tabindex="0"]').length, 1, 'one tab stop');
      assert.equal(m.main('a2').getAttribute('tabindex'), '0', 'on the active item');
      assert.ok(m.row('A').classList.contains('dm-tree-folder-row') && m.row('c').classList.contains('dm-tree-row'), 'folders and items');
      m.main('A').focus();
      key(m.main('A'), 'ArrowDown');
      assert.equal(document.activeElement, m.main('a1'), 'Down');
      key(document.activeElement, 'End');
      assert.equal(document.activeElement, m.main('c'), 'End');
      key(document.activeElement, 'Home');
      assert.equal(document.activeElement, m.main('A'), 'Home');
      assert.equal(el.querySelectorAll('[tabindex="0"]').length, 1, 'still one tab stop');
      key(document.activeElement, 'ArrowLeft');
      assert.equal(m.main('A').getAttribute('aria-expanded'), 'false', 'Left closes');
      assert.deepEqual(m.ids(), ['A', 'c']);
      assert.equal(document.activeElement, m.main('A'), 'the focus stays on the row drawn again');
      key(document.activeElement, 'ArrowRight');
      assert.equal(m.main('A').getAttribute('aria-expanded'), 'true', 'Right opens');
      key(document.activeElement, 'ArrowRight');
      assert.equal(document.activeElement, m.main('a1'), 'Right goes in');
      key(document.activeElement, 'ArrowLeft');
      assert.equal(document.activeElement, m.main('A'), 'Left goes up');
      key(m.main('a1'), 'Enter');
      assert.deepEqual(activated, ['a1'], 'Enter activates');
      key(m.main('A'), 'Enter');
      assert.equal(m.main('A').getAttribute('aria-expanded'), 'false', 'Enter on a folder its handler leaves alone opens or closes it');
      key(m.main('A'), ' ');
      assert.equal(m.main('A').getAttribute('aria-expanded'), 'true', 'Space too, without check boxes');
      // A letter jumps to the next name that starts with it; the same letter again goes on.
      m.main('A').focus();
      key(document.activeElement, 'b');
      assert.equal(document.activeElement, m.main('a2'), 'b: Bilder');
      key(document.activeElement, 'b');
      assert.equal(document.activeElement, m.main('B'), 'b again: Byggnad');
      await wait(800);
      key(document.activeElement, 'C', { shiftKey: true });
      assert.equal(document.activeElement, m.main('c'), 'a capital letter too');
      // *: the folders beside the row open.
      m.view.setOpen('B', false);
      key(m.main('a1'), '*', { shiftKey: true });
      assert.equal(m.main('B').getAttribute('aria-expanded'), 'true', '* opens the siblings');
      // The chevron opens and closes, and does not take the focus.
      m.main('c').focus();
      const chevron = /** @type {HTMLElement} */ (m.row('B').querySelector('.dm-tree-toggle'));
      assert.equal(chevron.getAttribute('aria-hidden'), 'true', 'the chevron is for the pointer; the row carries the state');
      chevron.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      chevron.click();
      assert.equal(m.main('B').getAttribute('aria-expanded'), 'false');
      assert.equal(document.activeElement, m.main('c'), 'the focus stays where it was');
      assert.ok(!m.main('B').hasAttribute('data-tip') && !m.main('B').hasAttribute('title'), 'no tip on a row (it would cover the next one)');
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: check boxes in three states, Space, Ctrl and Shift, Ctrl+A, Shift+Down, and Välj, where a tap checks', async (assert) => {
    const changes = []; const activated = [];
    const m = mount({ checkable: true, checked: [], onCheckedChange: (ids) => changes.push(ids.slice().sort()), onActivate: (n) => { activated.push(n.id); return true; } });
    try {
      const box = (id) => /** @type {HTMLInputElement} */ (m.row(id).querySelector('input[type="checkbox"]'));
      box('B').click();
      assert.deepEqual(changes.pop(), ['b1'], 'a folder checks what it holds');
      assert.equal(m.main('B').getAttribute('aria-checked'), 'true');
      assert.equal(m.main('A').getAttribute('aria-checked'), 'mixed', 'the folder above is partly checked');
      assert.ok(box('A').indeterminate && !box('A').checked, 'and its box shows it');
      assert.ok(!box('c').checked && m.main('c').getAttribute('aria-checked') === 'false');
      assert.ok(m.row('B').classList.contains('dm-tree-checked'), 'a checked row looks checked');
      assert.equal(m.main('A').getAttribute('aria-selected'), null, 'a tree with check boxes uses aria-checked');
      assert.equal(m.row('A').querySelector('.dm-tree-check').getAttribute('aria-hidden'), 'true', 'the box is for the pointer');
      key(m.main('a1'), ' ');
      assert.deepEqual(changes.pop(), ['a1', 'b1'], 'Space checks');
      click(m.main('a2'), { ctrlKey: true });
      assert.deepEqual(changes.pop(), ['a1', 'a2', 'b1'], 'Ctrl and a click checks one more');
      assert.equal(m.main('A').getAttribute('aria-checked'), 'true', 'all of Arkiv');
      click(m.main('c'), { shiftKey: true });
      assert.deepEqual(changes.pop(), ['a1', 'a2', 'b1', 'c'], 'Shift and a click checks from the last one checked');
      key(m.main('c'), 'a', { ctrlKey: true });
      assert.deepEqual(changes.pop(), [], 'Ctrl+A with everything checked clears it');
      key(m.main('c'), 'a', { ctrlKey: true });
      assert.deepEqual(changes.pop(), ['a1', 'a2', 'b1', 'c'], 'and checks everything');
      assert.deepEqual(activated, [], 'checking activates nothing');
      m.main('c').click();
      assert.deepEqual(activated, ['c'], 'a plain click activates');
      key(m.main('c'), 'a', { ctrlKey: true });
      changes.length = 0;
      m.main('a1').focus();
      key(m.main('a1'), 'ArrowDown', { shiftKey: true });
      assert.equal(document.activeElement, m.main('a2'), 'Shift+Down moves');
      assert.deepEqual(changes.pop(), ['a2'], 'and checks the row it comes to');
      m.view.setSelecting(true);
      assert.ok(m.view.el.hasAttribute('data-selecting'), 'Välj');
      m.main('c').click();
      assert.deepEqual(changes.pop(), ['a2', 'c'], 'in Välj a tap checks');
      assert.deepEqual(activated, ['c'], 'and activates nothing');
      m.view.update({ checked: ['b1'] });
      assert.deepEqual(['A', 'B', 'b1', 'c'].map((id) => m.main(id).getAttribute('aria-checked')), ['mixed', 'true', 'true', 'false'], 'the caller sets what is checked');
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: a filter shows the matches with their folders, and the folds are kept under the key the caller gives', async (assert) => {
    const KEY = 'test.tree.folds';
    await idb.deleteSetting(KEY).catch(() => {});
    const m = mount({ memory: KEY });
    try {
      await tree.memory(KEY).ready;
      m.view.setOpen('B', false);
      assert.deepEqual(m.ids(), ['A', 'a1', 'a2', 'B', 'c']);
      m.view.update({ filter: 'plan' });
      assert.deepEqual(m.ids(), ['A', 'B', 'b1'], 'the match with its folders, open while filtering');
      m.view.update({ filter: 'ARK' });
      assert.deepEqual(m.ids(), ['A'], 'in any case');
      m.view.update({ filter: '' });
      assert.deepEqual(m.ids(), ['A', 'a1', 'a2', 'B', 'c'], 'Byggnad is folded again');
      const again = mount({ memory: KEY });
      try { assert.equal(again.main('B').getAttribute('aria-expanded'), 'false', 'another tree with the key'); } finally { again.done(); }
      const other = mount({ memory: 'test.tree.other' });
      try { assert.equal(other.main('B').getAttribute('aria-expanded'), 'true', 'a tree with another key has its own folds'); } finally { other.done(); }
      const saved = await waitFor(async () => { const v = await idb.getSetting(KEY, null); return Array.isArray(v) && v.includes('B') ? v : null; }, 3000, 'the setting');
      assert.deepEqual(saved, ['B'], 'kept in the browser');
      const closed = mount({ memory: 'test.tree.closed', defaultOpen: false });
      try { assert.deepEqual(closed.ids(), ['A', 'c'], 'folders can start folded'); } finally { closed.done(); }
      return 'ok';
    } finally { m.done(); for (const k of [KEY, 'test.tree.other', 'test.tree.closed']) await idb.deleteSetting(k).catch(() => {}); }
  });

  test('tree: F2 and Byt namn in the snabbmeny name a row in place; Enter keeps the name, Escape leaves it', async (assert) => {
    const renamed = []; const cancelled = [];
    const m = mount({ onRename: (n, name) => renamed.push([n.id, name]), onRenameCancel: (n) => cancelled.push(n.id) });
    try {
      m.main('a1').focus();
      key(m.main('a1'), 'F2');
      let field = /** @type {any} */ (m.row('a1').querySelector('dm-input.dm-tree-edit'));
      assert.ok(field, 'a field in the row');
      assert.equal(field.value, 'Anteckningar');
      assert.equal(document.activeElement, field.control, 'with the focus');
      assert.equal(field.control.selectionStart, 0, 'and the name chosen');
      key(field.control, 'Escape');
      assert.ok(!m.view.el.querySelector('dm-input'), 'Escape leaves it');
      assert.deepEqual(cancelled, ['a1']);
      assert.equal(document.activeElement, m.main('a1'), 'the focus is back on the row');
      key(m.main('a1'), 'F2');
      field = m.row('a1').querySelector('dm-input');
      field.value = 'Noter';
      field.control.dispatchEvent(new Event('input', { bubbles: true }));
      m.view.refresh();
      field = m.row('a1').querySelector('dm-input');
      assert.equal(field.value, 'Noter', 'what is typed stays when the tree draws again');
      key(field.control, 'Enter');
      assert.deepEqual(renamed, [['a1', 'Noter']], 'Enter keeps it');
      assert.equal(document.activeElement, m.main('a1'));
      // The same from the snabbmeny.
      m.main('c').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      const item = await waitFor(() => document.querySelector('.dm-menu [data-menu-item="rename"]'), 2000, 'Byt namn in the menu');
      /** @type {HTMLElement} */ (item).click();
      field = await waitFor(() => m.row('c').querySelector('dm-input'), 2000, 'the field');
      field.value = 'Cypress';
      field.control.dispatchEvent(new Event('input', { bubbles: true }));
      key(field.control, 'Enter');
      assert.deepEqual(renamed.pop(), ['c', 'Cypress']);
      key(m.main('c'), 'F2');
      key(m.row('c').querySelector('dm-input').control, 'Enter');
      assert.deepEqual(renamed, [['a1', 'Noter']], 'the same name is no change');
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: moves with Ctrl+X and Ctrl+V, with Flytta till …, and with the browser\'s drag and drop on a folder or beside an item', async (assert) => {
    const drops = [];
    const m = mount({ onDrop: (payload, target) => drops.push([payload.ids.join(','), target ? target.id : null]) });
    try {
      key(m.main('c'), 'x', { ctrlKey: true });
      assert.ok(m.row('c').classList.contains('dm-tree-cut'), 'what is cut is faded');
      key(m.main('b1'), 'v', { ctrlKey: true });
      assert.deepEqual(drops.pop(), ['c', 'B'], 'Ctrl+V beside an item puts it in that folder');
      assert.ok(!m.row('c').classList.contains('dm-tree-cut'));
      key(m.main('a2'), 'x', { ctrlKey: true });
      key(m.main('a2'), 'Escape');
      assert.ok(!m.row('a2').classList.contains('dm-tree-cut'), 'Escape forgets it');
      key(m.main('B'), 'v', { ctrlKey: true });
      assert.equal(drops.length, 0, 'nothing to paste');
      key(m.main('B'), 'x', { ctrlKey: true });
      key(m.main('b1'), 'v', { ctrlKey: true });
      assert.equal(drops.length, 0, 'a folder does not go into itself');
      key(m.main('c'), 'v', { ctrlKey: true });
      assert.deepEqual(drops.pop(), ['B', null], 'but to the top level');
      // Flytta till …: the folders it can go to, in a dialog.
      m.view.moveTo(sample()[0].children[0]);
      let dlg = await waitFor(() => document.querySelector('dialog[open]'), 2000, 'the dialog');
      let sel = /** @type {any} */ (dlg.querySelector('[data-tree-move]'));
      assert.deepEqual(sel.options.map((o) => o.label), [t('tree.root'), 'Arkiv', 'Arkiv / Byggnad']);
      sel.value = 'B';
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="primary"] button')).click();
      await waitFor(() => drops.length, 2000, 'the move');
      assert.deepEqual(drops.pop(), ['a1', 'B']);
      m.main('A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      /** @type {HTMLElement} */ (await waitFor(() => document.querySelector('.dm-menu [data-menu-item="move"]'), 2000, 'Flytta till in the menu')).click();
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 2000, 'the dialog for a folder');
      sel = dlg.querySelector('[data-tree-move]');
      assert.deepEqual(sel.options.map((o) => o.label), [t('tree.root')], 'a folder cannot go into itself or below itself');
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button:not([variant="primary"]) button')).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 2000, 'closed');
      assert.equal(drops.length, 0, 'Avbryt moves nothing');
      // The browser's drag and drop (a mouse): on a folder, beside an item, and in an element made a drop zone.
      const dt = () => { const d = new DataTransfer(); d.setData('text/plain', JSON.stringify({ ids: ['c'] })); return d; };
      m.main('B').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt() }));
      assert.deepEqual(drops.pop(), ['c', 'B'], 'on a folder');
      m.main('a2').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt() }));
      assert.deepEqual(drops.pop(), ['c', 'A'], 'beside an item: its folder');
      const zone = document.createElement('div');
      m.host.appendChild(zone);
      m.view.dropZone(zone, null);
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt() }));
      assert.deepEqual(drops.pop(), ['c', null], 'a drop zone: the top level');
      const start = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
      m.main('a1').dispatchEvent(start);
      assert.equal(m.main('a1').getAttribute('draggable'), 'true');
      assert.equal(JSON.parse(start.dataTransfer.getData('text/plain')).ids[0], 'a1', 'a drag carries the row');
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: a finger drags after a long press (pointer events): into a folder, out of it to the top level, with a ghost and a drop target', async (assert) => {
    const drops = [];
    const m = mount({ onDrop: (payload, target) => drops.push([payload.ids.join(','), target ? target.id : null]) }, true);
    const zone = document.createElement('div');
    zone.style.cssText = 'height:40px;';
    m.host.insertBefore(zone, m.view.el);
    m.view.dropZone(zone, null);
    try {
      const t0 = performance.now();
      pointer(m.main('c'), 'pointerdown', centre(m.main('c')));
      await wait(650);
      assert.ok(m.main('c').classList.contains('dm-tree-pressed'), 'the long press is felt');
      const over = centre(m.main('B'));
      pointer(m.main('c'), 'pointermove', { x: over.x, y: over.y - 20 });
      pointer(m.main('c'), 'pointermove', over);
      assert.ok(document.querySelector('.dm-tree-ghost'), 'a ghost follows the finger');
      assert.ok(m.row('B').classList.contains('dm-drop-target'), 'the folder under the finger is the target');
      assert.ok(m.view.el.hasAttribute('data-dragging'));
      pointer(m.main('c'), 'pointerup', over);
      assert.deepEqual(drops.pop(), ['c', 'B'], 'dropped into the folder');
      assert.ok(!document.querySelector('.dm-tree-ghost') && !m.view.el.querySelector('.dm-drop-target'), 'the ghost and the mark are gone');
      // A click right after the drag does nothing.
      const before = drops.length;
      m.main('c').click();
      assert.equal(drops.length, before);
      // Out of a folder: from Plan 1 to the zone (the top level).
      await wait(650);
      pointer(m.main('b1'), 'pointerdown', centre(m.main('b1')), 8);
      await wait(650);
      pointer(m.main('b1'), 'pointermove', centre(zone), 8);
      assert.ok(zone.classList.contains('dm-drop-target'), 'the zone is the target');
      pointer(m.main('b1'), 'pointerup', centre(zone), 8);
      assert.deepEqual(drops.pop(), ['b1', null], 'out to the top level');
      // A finger that moves at once scrolls: no drag.
      await wait(650);
      pointer(m.main('a1'), 'pointerdown', centre(m.main('a1')), 9);
      pointer(m.main('a1'), 'pointermove', { x: centre(m.main('a1')).x, y: centre(m.main('a1')).y + 30 }, 9);
      await wait(650);
      pointer(m.main('a1'), 'pointermove', centre(m.main('B')), 9);
      pointer(m.main('a1'), 'pointerup', centre(m.main('B')), 9);
      assert.equal(drops.length, 0, 'a swipe is a scroll');
      // A folder is not dropped into itself.
      await wait(650);
      pointer(m.main('A'), 'pointerdown', centre(m.main('A')), 10);
      await wait(650);
      pointer(m.main('A'), 'pointermove', centre(m.main('B')), 10);
      assert.ok(!m.row('B').classList.contains('dm-drop-target'), 'no target inside the folder dragged');
      pointer(m.main('A'), 'pointercancel', centre(m.main('B')), 10);
      assert.equal(drops.length, 0, 'cancelled');
      return `ok in ${Math.round(performance.now() - t0)} ms (four presses of 650 ms)`;
    } finally { m.done(); }
  });

  test('tree: the snabbmeny opens with a right click, the menu key, Shift+F10 and a long press, with the menu\'s keys', async (assert) => {
    const chosen = [];
    const m = mount({ menu: (n) => [{ id: 'open', label: 'Öppna', icon: 'folder-open', onSelect: () => chosen.push(['open', n.id]) }, { id: 'off', label: 'Av', disabled: true, onSelect: () => chosen.push(['off', n.id]) }, { separator: true }, { id: 'drop', label: 'Ta bort', danger: true, onSelect: () => chosen.push(['drop', n.id]) }] }, true);
    try {
      m.main('a1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
      let el = /** @type {HTMLElement} */ (document.querySelector('.dm-menu'));
      assert.ok(el && el.getAttribute('role') === 'menu', 'a menu');
      assert.equal(el.getAttribute('aria-label'), t('tree.menu', { name: 'Anteckningar' }));
      assert.deepEqual(Array.from(el.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent), ['Öppna', 'Av', 'Ta bort']);
      assert.equal(document.activeElement, el.querySelector('[data-menu-item="open"]'), 'the focus on the first item');
      key(document.activeElement, 'ArrowDown');
      assert.equal(document.activeElement, el.querySelector('[data-menu-item="off"]'), 'Down');
      key(document.activeElement, 'Enter');
      assert.deepEqual(chosen, [], 'a disabled item does nothing');
      key(document.activeElement, 'End');
      key(document.activeElement, 'Enter');
      assert.deepEqual(chosen.pop(), ['drop', 'a1'], 'Enter chooses');
      assert.ok(!document.querySelector('.dm-menu'), 'and closes');
      assert.equal(document.activeElement, m.main('a1'), 'the focus back on the row');
      key(m.main('c'), 'F10', { shiftKey: true });
      el = /** @type {HTMLElement} */ (document.querySelector('.dm-menu'));
      assert.ok(el, 'Shift+F10');
      key(document.activeElement, 'Escape');
      assert.ok(!document.querySelector('.dm-menu') && document.activeElement === m.main('c'), 'Escape closes it');
      key(m.main('c'), 'ContextMenu');
      assert.ok(document.querySelector('.dm-menu'), 'the menu key');
      key(document.activeElement, 'ö');
      assert.equal(document.activeElement, document.querySelector('.dm-menu [data-menu-item="open"]'), 'a letter jumps');
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      assert.ok(!document.querySelector('.dm-menu'), 'a press outside closes it');
      // A long press without moving opens it where the finger is, and the click after it does nothing.
      pointer(m.main('B'), 'pointerdown', centre(m.main('B')));
      await wait(650);
      pointer(m.main('B'), 'pointerup', centre(m.main('B')));
      el = await waitFor(() => document.querySelector('.dm-menu'), 2000, 'the menu after a long press');
      assert.equal(el.getAttribute('aria-label'), t('tree.menu', { name: 'Byggnad' }));
      const open = m.main('B').getAttribute('aria-expanded');
      m.main('B').click();
      assert.equal(m.main('B').getAttribute('aria-expanded'), open, 'the click after the press is not a tap');
      /** @type {HTMLElement} */ (el.querySelector('[data-menu-item="open"]')).click();
      assert.deepEqual(chosen.pop(), ['open', 'B']);
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: the simple mode (Inhämta\'s groups, Mobil\'s list) has no check boxes, dragging, renaming or snabbmeny, and buttons for screen readers on phones', async (assert) => {
    const KEY = 'test.tree.simple';
    await idb.deleteSetting(KEY).catch(() => {});
    const activated = [];
    const m = mount({ simple: true, memory: KEY, checkable: true, onDrop: () => activated.push('drop'), onRename: () => activated.push('rename'), onActivate: (n) => { activated.push(n.id); return isLeaf(n); } });
    function isLeaf(n) { return !n.children; }
    try {
      assert.ok(!m.view.el.querySelector('input[type="checkbox"]'), 'no check boxes');
      assert.ok(!m.view.el.querySelector('[draggable]'), 'no dragging');
      key(m.main('a1'), 'F2');
      assert.ok(!m.view.el.querySelector('dm-input'), 'no renaming');
      m.main('a1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
      assert.ok(!document.querySelector('.dm-menu'), 'no snabbmeny');
      m.main('A').click();
      assert.deepEqual(m.ids(), ['A', 'c'], 'a tap on a group folds it');
      m.main('c').click();
      assert.deepEqual(activated, ['A', 'c'], 'and a tap on an item opens it');
      await tree.memory(KEY).ready;
      const again = mount({ simple: true, memory: KEY });
      try { assert.deepEqual(again.ids(), ['A', 'c'], 'the fold is remembered'); } finally { again.done(); }
      // As buttons (phones' screen readers): each row a button with its open or closed state.
      m.view.update({ aria: 'buttons' });
      assert.equal(m.view.el.getAttribute('role'), 'group');
      assert.equal(m.main('A').getAttribute('role'), 'button');
      assert.equal(m.main('A').getAttribute('aria-expanded'), 'false');
      assert.equal(m.main('A').getAttribute('aria-level'), null);
      m.view.update({ aria: 'tree' });
      assert.equal(m.main('A').getAttribute('role'), 'treeitem');
      assert.deepEqual(D.require('tests/a11y').audit(m.host), [], 'the accessibility check');
      return 'ok';
    } finally { m.done(); await idb.deleteSetting(KEY).catch(() => {}); }
  });

  test('tree: children load lazily through the caller\'s function, with a row that says so meanwhile', async (assert) => {
    let release = null; const asked = [];
    const nodes = [{ id: 'site', label: 'Plats', lazy: true }, { id: 'x', label: 'Annat' }];
    const m = mount({ nodes, defaultOpen: false, loadChildren: (n) => { asked.push(n.id); return new Promise((r) => { release = () => r([{ id: 'b0', label: 'Byggnad 0', lazy: true }, { id: 'b1', label: 'Byggnad 1' }]); }); } });
    try {
      assert.deepEqual(m.ids(), ['site', 'x']);
      assert.equal(m.main('site').getAttribute('aria-expanded'), 'false', 'a lazy folder is a folder');
      assert.deepEqual(asked, [], 'nothing asked before it opens');
      key(m.main('site'), 'ArrowRight');
      assert.deepEqual(asked, ['site']);
      const wait1 = m.view.el.querySelector('.dm-tree-placeholder');
      assert.ok(wait1 && wait1.textContent.includes(t('tree.loading')), 'Läser in …');
      release();
      await waitFor(() => m.ids().includes('b0'), 2000, 'the children');
      assert.deepEqual(m.ids(), ['site', 'b0', 'b1', 'x']);
      assert.ok(!m.view.el.querySelector('.dm-tree-placeholder'));
      m.view.setOpen('site', false);
      m.view.setOpen('site', true);
      assert.deepEqual(asked, ['site'], 'asked once');
      return 'ok';
    } finally { m.done(); }
  });

  test('tree: 20 000 nodes of a model\'s spatial structure draw only the rows in view, and the keys reach every row', async (assert) => {
    // 1 site, 2 buildings, 10 storeys each, 50 spaces each, 19 elements each.
    const nodes = [];
    let n = 0;
    const site = { id: 's', label: 'Plats', children: [] };
    nodes.push(site); n++;
    for (let b = 0; b < 2; b++) {
      const bu = { id: 'b' + b, label: 'Byggnad ' + b, children: [] }; site.children.push(bu); n++;
      for (let f = 0; f < 10; f++) {
        const st = { id: `b${b}f${f}`, label: 'Våning ' + f, children: [] }; bu.children.push(st); n++;
        for (let r = 0; r < 50; r++) {
          const sp = { id: `b${b}f${f}r${r}`, label: 'Rum ' + r, children: [] }; st.children.push(sp); n++;
          for (let e = 0; e < 19; e++) { sp.children.push({ id: `b${b}f${f}r${r}e${e}`, label: 'Element ' + e, icon: 'box' }); n++; }
        }
      }
    }
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:320px; height:480px; overflow:auto;';
    document.body.appendChild(host);
    let t0 = performance.now();
    const view = tree.create({ label: 'Modell', nodes });
    host.appendChild(view.el);
    view.refresh();
    const build = performance.now() - t0;
    try {
      assert.ok(n >= 20000, n + ' nodes');
      assert.equal(view.rows().length, n, 'all open: every node is a row');
      assert.ok(view.el.classList.contains('dm-tree-virtual'));
      const drawn = view.drawn();
      assert.ok(drawn > 5 && drawn < 120, 'only the rows in view are drawn: ' + drawn);
      const rowH = parseFloat(getComputedStyle(view.el).getPropertyValue('--dm-tree-row-h'));
      assert.equal(Math.round(view.el.getBoundingClientRect().height), Math.round(n * rowH), 'the tree is as tall as all its rows');
      const first = /** @type {HTMLElement} */ (view.el.querySelector('[data-key="s"] > [data-part="main"]'));
      assert.deepEqual(['aria-level', 'aria-setsize', 'aria-posinset'].map((a) => first.getAttribute(a)), ['1', '1', '1']);
      first.focus();
      t0 = performance.now();
      key(first, 'End');
      const end = performance.now() - t0;
      const last = /** @type {HTMLElement} */ (view.el.querySelector('[data-key="b1f9r49e18"] > [data-part="main"]'));
      assert.ok(last && document.activeElement === last, 'End reaches the last of ' + n);
      assert.equal(last.getAttribute('aria-level'), '5');
      assert.ok(host.scrollTop > 0, 'scrolled to it');
      assert.ok(view.drawn() < 120, 'still only the rows in view');
      key(last, 'ArrowUp');
      assert.equal(document.activeElement.closest('[data-key]').getAttribute('data-key'), 'b1f9r49e17', 'Up from there');
      host.scrollTop = 0;
      await waitFor(() => view.el.querySelector('[data-key="s"]'), 2000, 'the top drawn after a scroll');
      assert.ok(view.el.querySelector('[data-key="b1f9r49e17"]'), 'the row with the focus stays drawn');
      t0 = performance.now();
      view.setOpen('b0', false);
      const fold = performance.now() - t0;
      assert.equal(view.rows().length, n - 10010, 'Byggnad 0 folded: ' + view.rows().length + ' rows');
      t0 = performance.now();
      view.update({ filter: 'element 18' });
      const filter = performance.now() - t0;
      assert.equal(view.rows().filter((r) => !r.folder).length, 1000, 'the filter finds the 1 000 matches');
      view.update({ filter: '' });
      return `${n} nodes: drawn in ${Math.round(build)} ms (${drawn} rows in the DOM), End in ${Math.round(end)} ms, a fold in ${Math.round(fold)} ms, a filter in ${Math.round(filter)} ms`;
    } finally { view.destroy(); host.remove(); }
  }, 30000);

  // ---- the dataset list on top of the tree ----
  function listFixture(width) {
    const list = D.require('ui/dataset-list');
    const container = document.createElement('div');
    container.style.cssText = `position:absolute; left:-10000px; top:0; width:${width || 320}px;`;
    document.body.appendChild(container);
    const calls = { toggled: [], removed: [], pasted: [], selected: [] };
    const ds = [
      { id: 'ta', name: 'Alfa', shortName: 'alfa', folder: 'X', rowCount: 1, columnCount: 1, updatedAt: '2026-01-03' },
      { id: 'tb', name: 'Beta', shortName: 'beta', folder: 'X/Y', rowCount: 2, columnCount: 1, updatedAt: '2026-01-02' },
      { id: 'tc', name: 'Gamma', shortName: 'gamma', folder: '', rowCount: 3, columnCount: 1, updatedAt: '2026-01-01' },
    ];
    const opts = {
      datasets: ds, selectedId: null, onSelect: (id) => calls.selected.push(id), multi: true, selectedIds: [], onToggle: (ids) => { calls.toggled.push(ids.slice().sort()); },
      actions: { remove: async (u) => { calls.removed.push(u); return true; }, paste: async (clip, target) => { calls.pasted.push({ clip, target }); return []; }, rename: async () => true },
    };
    list.render(container, opts);
    return {
      list, container, calls, again: (patch) => list.render(container, Object.assign(opts, patch)),
      main: (sel) => /** @type {HTMLElement} */ (container.querySelector(sel + ' [data-part="main"]')),
      done: () => { if (container.contains(document.activeElement)) /** @type {any} */ (document.activeElement).blur(); const m = menu.current(); if (m) m.close(false); list.clip.set(null); container.remove(); },
    };
  }

  test('dataset list: one row height for folders and datasets, the focus ring inside the row, no tips on rows, and the tools as icons on one line', async (assert) => {
    const f = listFixture();
    try {
      const folderRow = /** @type {HTMLElement} */ (f.container.querySelector('[data-folder-row="X"]'));
      const dsRow = /** @type {HTMLElement} */ (f.container.querySelector('.dm-tree-row[data-id="ta"]'));
      assert.equal(Math.round(folderRow.getBoundingClientRect().height), Math.round(dsRow.getBoundingClientRect().height), 'the same height');
      assert.equal(getComputedStyle(folderRow).backgroundColor, getComputedStyle(dsRow).backgroundColor, 'the same background');
      const main = f.main('[data-folder-row="X"]');
      assert.ok(!main.hasAttribute('title') && !main.hasAttribute('data-tip'), 'no tip on a folder (it covered the next row)');
      const ring = getComputedStyle(main);
      main.focus();
      key(main, 'ArrowDown'); key(document.activeElement, 'ArrowUp');
      assert.equal(document.activeElement, f.main('[data-folder-row="X"]'));
      assert.ok(parseFloat(getComputedStyle(document.activeElement).outlineOffset) <= 0, 'the focus ring lies inside the row: ' + ring.outlineOffset);
      const bar = /** @type {HTMLElement} */ (f.container.querySelector('.dm-tree-toolbar'));
      const tops = new Set(Array.from(bar.querySelectorAll('dm-button')).map((b) => Math.round(b.getBoundingClientRect().top)));
      assert.equal(tops.size, 1, 'one line');
      for (const b of Array.from(bar.querySelectorAll('dm-button'))) {
        assert.ok(b.getAttribute('icon'), 'an icon on ' + b.getAttribute('data-tool'));
        assert.ok(b.getBoundingClientRect().width < 50, 'an icon button: ' + b.getAttribute('data-tool'));
      }
      assert.ok(f.container.querySelector('.dm-tree-more').hidden, 'Fler alternativ only when the tools do not fit');
      assert.equal(f.container.querySelector('.dm-tree').getAttribute('role'), 'tree');
      assert.deepEqual(D.require('tests/a11y').audit(f.container), [], 'the accessibility check');
      return 'ok';
    } finally { f.done(); }
  });

  test('dataset list: in a narrow panel the tools that do not fit are under Fler alternativ, and Välj, the snabbmeny and dm-choose work', async (assert) => {
    const f = listFixture(150);
    try {
      const more = /** @type {any} */ (await waitFor(() => { const m = f.container.querySelector('.dm-tree-more'); return m && !m.hidden ? m : null; }, 3000, 'Fler alternativ'));
      const hidden = Array.from(f.container.querySelectorAll('.dm-tree-toolbar > dm-button')).filter((b) => /** @type {any} */ (b).hidden).map((b) => b.getAttribute('data-tool'));
      assert.ok(hidden.length && hidden.includes('delete'), 'the last tools are hidden: ' + hidden.join(', '));
      more.querySelector('button').click();
      const el = await waitFor(() => document.querySelector('.dm-menu'), 2000, 'the menu');
      assert.deepEqual(Array.from(el.querySelectorAll('[role="menuitem"]')).map((b) => b.getAttribute('data-menu-item')), hidden, 'they are in the menu');
      assert.equal(el.querySelector('[data-menu-item="delete"]').getAttribute('aria-disabled'), 'true', 'disabled as the tool is');
      key(document.activeElement, 'Escape');
      // The snabbmeny on a row acts on that row.
      f.main('.dm-tree-row[data-id="tc"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      const ctx = await waitFor(() => document.querySelector('.dm-menu'), 2000, 'the snabbmeny');
      assert.deepEqual(Array.from(ctx.querySelectorAll('[role="menuitem"]')).map((b) => b.getAttribute('data-menu-item')), ['newfolder', 'rename', 'cut', 'copy', 'paste', 'move', 'delete'], 'the same as the tools');
      /** @type {HTMLElement} */ (ctx.querySelector('[data-menu-item="cut"]')).click();
      assert.deepEqual(f.list.clip.get(), { mode: 'cut', ids: ['tc'], folders: [] }, 'Klipp ut on the row');
      f.main('[data-folder-row="X/Y"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      /** @type {HTMLElement} */ ((await waitFor(() => document.querySelector('.dm-menu [data-menu-item="paste"]'), 2000, 'Klistra in')).click());
      await waitFor(() => f.calls.pasted.length, 2000, 'pasted');
      assert.deepEqual(f.calls.pasted.pop(), { clip: { mode: 'cut', ids: ['tc'], folders: [] }, target: 'X/Y' }, 'into the folder pressed');
      // Välj: a tap checks.
      const select = /** @type {HTMLElement} */ (f.container.querySelector('.dm-list-head .dm-tree-select button'));
      assert.ok(select, 'Välj in the heading (shown on touch screens)');
      select.click();
      assert.ok(f.container.querySelector('.dm-tree').hasAttribute('data-selecting'));
      f.main('.dm-tree-row[data-id="ta"]').click();
      assert.deepEqual(f.calls.toggled.pop(), ['ta'], 'a tap checks in Välj');
      assert.deepEqual(f.calls.selected, [], 'and opens nothing');
      /** @type {HTMLElement} */ (f.container.querySelector('.dm-list-head .dm-tree-select button')).click();
      let chose = null;
      f.container.addEventListener('dm-choose', (e) => { chose = /** @type {CustomEvent} */ (e).detail.id; });
      f.main('.dm-tree-row[data-id="tb"]').click();
      assert.deepEqual(f.calls.selected, ['tb'], 'a tap opens again');
      assert.equal(chose, 'tb', 'and tells the panel (a sheet closes)');
      return 'ok';
    } finally { f.done(); }
  });

  test('dataset list: a drag with a finger moves a dataset out of its folder to the top level, as Klipp ut and Klistra in', async (assert) => {
    const list = D.require('ui/dataset-list');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed; left:0; top:0; width:320px; z-index:9999; background:var(--dm-surface);';
    document.body.appendChild(container);
    const moved = [];
    const ds = [
      { id: 'pa', name: 'Alfa', shortName: 'alfa', folder: 'X', rowCount: 1, columnCount: 1, updatedAt: '2026-01-03' },
      { id: 'pc', name: 'Gamma', shortName: 'gamma', folder: '', rowCount: 3, columnCount: 1, updatedAt: '2026-01-01' },
    ];
    list.render(container, { datasets: ds, selectedId: null, onSelect() {}, multi: true, selectedIds: [], onToggle() {}, onMove: (ids, folder) => moved.push([ids, folder]) });
    try {
      const main = (sel) => /** @type {HTMLElement} */ (container.querySelector(sel + ' [data-part="main"]'));
      // The heading takes no room but on touch screens (B-81.3): the filter row at the top of the panel is the top level.
      assert.equal(getComputedStyle(container.querySelector('.dm-list-head')).display, 'none');
      const top = /** @type {HTMLElement} */ (container.querySelector('.dm-list-tools'));
      pointer(main('.dm-tree-row[data-id="pa"]'), 'pointerdown', centre(main('.dm-tree-row[data-id="pa"]')), 11);
      await wait(650);
      pointer(main('.dm-tree-row[data-id="pa"]'), 'pointermove', centre(top), 11);
      assert.ok(top.classList.contains('dm-drop-target'), 'the top of the panel is the top level');
      pointer(main('.dm-tree-row[data-id="pa"]'), 'pointerup', centre(top), 11);
      assert.deepEqual(moved.pop(), [['pa'], ''], 'out of the folder');
      await wait(650);
      pointer(main('.dm-tree-row[data-id="pc"]'), 'pointerdown', centre(main('.dm-tree-row[data-id="pc"]')), 12);
      await wait(650);
      pointer(main('.dm-tree-row[data-id="pc"]'), 'pointermove', centre(main('[data-folder-row="X"]')), 12);
      pointer(main('.dm-tree-row[data-id="pc"]'), 'pointerup', centre(main('[data-folder-row="X"]')), 12);
      assert.deepEqual(moved.pop(), [['pc'], 'X'], 'into a folder');
      return 'ok';
    } finally { container.remove(); }
  });
})();
