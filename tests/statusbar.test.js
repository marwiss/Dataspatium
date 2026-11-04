// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of the 2.0 shell: status bar, eight modes with Alt+1..8, panel toggles per breakpoint and the splitters. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function startApp() {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    return { root, shell };
  }

  test('shell: the status bar holds save state, storage, engine and network; the top bar only the global controls', async (assert) => {
    const { root, shell } = await startApp();
    try {
      const bar = root.querySelector('footer.dm-statusbar');
      assert.ok(bar, 'status bar at the bottom');
      assert.ok(bar.querySelector('.dm-sb[data-state="saved"]'), 'save state');
      assert.ok(bar.querySelector('[data-engine]'), 'engine indicator');
      assert.ok(bar.querySelector('[data-engine]').textContent.startsWith(t('shell.engine.r')), 'engine text starts with the engine name');
      assert.ok(bar.querySelector('[data-net="idle"]'), 'network indicator idle');
      assert.equal(root.querySelectorAll('.dm-topbar .dm-sb').length, 0, 'no status in the top bar');
      assert.equal(root.querySelectorAll('.dm-topbar dm-button').length, 4, 'palette, language, theme and help in the top bar');
      assert.equal(root.querySelectorAll('.dm-statusbar dm-button').length, 3, 'two panel toggles and the log button in the status bar');
      shell.setEngine('r', 'ready');
      assert.equal(bar.querySelector('[data-engine]').getAttribute('data-engine'), 'ready');
      assert.ok(bar.querySelector('[data-engine]').textContent.includes(t('shell.engine.state.ready')));
      shell.setNet(2);
      assert.equal(bar.querySelector('[data-net]').getAttribute('data-net'), 'active');
      shell.setNet(0);
      assert.equal(bar.querySelector('[data-net]').getAttribute('data-net'), 'idle');
      // The selected dataset shows in the status bar and leads to Hantera.
      const csv = 'a;b\n1;2\n3;4\n';
      const meta = await shell.ctx.services.importer.run(new File([csv], 'sb.csv', { type: 'text/csv' }), {}, null, 'Statusrad');
      try {
        // The status bar reads the dataset from the store, which the import refreshes asynchronously.
        for (let i = 0; i < 100 && !shell.store.get().datasets.some((d) => d.id === meta.id); i++) await wait(50);
        shell.store.set({ selectedId: meta.id });
        const ds = /** @type {HTMLElement} */ (bar.querySelector('.dm-sb-btn[aria-label]'));
        assert.ok(!ds.hidden && ds.textContent.includes(meta.shortName), 'dataset summary ' + ds.textContent);
        ds.click();
        assert.equal(shell.store.get().mode, 'hantera');
      } finally { await shell.ctx.services.datasets.remove(meta.id); }
      return 'ok';
    } finally { root.remove(); }
  });

  test('shell: eight modes in order, Alt+1..8 and #/mode hashes', async (assert) => {
    const { root, shell } = await startApp();
    try {
      const ids = Array.from(root.querySelectorAll('.dm-mode-btn')).map((b) => b.getAttribute('data-mode'));
      assert.deepEqual(ids, ['inhamta', 'hantera', 'soka', 'bearbeta', 'analysera', 'visualisera', 'exportera', 'dela']);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', altKey: true, bubbles: true }));
      assert.equal(shell.store.get().mode, 'soka');
      assert.equal(location.hash, '#/soka');
      assert.ok(root.querySelector('.dm-center dm-empty-state'), 'Söka frame');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '8', altKey: true, bubbles: true }));
      assert.equal(shell.store.get().mode, 'dela');
      assert.ok(root.querySelector('.dm-center h1').textContent.includes(t('dela.title')));
      return 'ok';
    } finally { root.remove(); history.replaceState(null, '', location.pathname + location.search); }
  });

  test('shell: panel toggles give columns on wide windows and sheets on narrow ones', async (assert) => {
    const { root, shell } = await startApp();
    try {
      const narrowRight = matchMedia('(max-width: 1099px)').matches;
      const narrowLeft = matchMedia('(max-width: 759px)').matches;
      assert.equal(shell.el.getAttribute('data-right'), narrowRight ? 'closed' : 'open', 'initial right');
      assert.equal(shell.el.getAttribute('data-left'), narrowLeft ? 'closed' : 'open', 'initial left');
      shell.toggle('right');
      assert.equal(shell.el.getAttribute('data-right'), narrowRight ? 'sheet' : 'closed', 'right after one toggle');
      if (narrowRight) {
        shell.closeSheets();
        assert.equal(shell.el.getAttribute('data-right'), 'closed', 'sheet closed by the workspace');
      } else {
        shell.toggle('right');
        assert.equal(shell.el.getAttribute('data-right'), 'open');
      }
      shell.toggle('drawer');
      assert.equal(shell.el.getAttribute('data-drawer'), 'open');
      shell.toggle('drawer');
      assert.equal(shell.el.getAttribute('data-drawer'), 'closed');
      return narrowRight ? 'narrow window: sheets' : 'wide window: columns';
    } finally { root.remove(); }
  });

  test('shell: the splitters resize the panels with keyboard and pointer, remember the width and reset on double click', async (assert) => {
    const idb = D.require('platform/storage/idb');
    const { root, shell } = await startApp();
    try {
      const left = /** @type {any} */ (root.querySelector('dm-splitter[for="left"]'));
      assert.ok(left && left.getAttribute('role') === 'separator', 'left splitter is a separator');
      const before = left.current();
      left.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal(left.current(), before + 16, 'arrow widens by 16');
      left.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
      assert.equal(left.current(), before + 80, 'shift arrow widens by 64');
      await wait(60);
      assert.equal(await idb.getSetting('ui.panel.left', null), before + 80, 'width persisted');
      left.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      assert.equal(left.current(), 560, 'End goes to the maximum');
      left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      assert.equal(left.current(), 200, 'Home goes to the minimum');
      // Pointer drag: the width follows the pointer relative to the shell's left edge.
      const rect = shell.el.getBoundingClientRect();
      left.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: rect.left + 200, bubbles: true }));
      left.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: rect.left + 333, bubbles: true }));
      left.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: rect.left + 333, bubbles: true }));
      assert.equal(left.current(), 333, 'dragged to 333');
      left.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      assert.equal(shell.el.style.getPropertyValue('--dm-panel-w'), '', 'reset removes the override');
      await wait(60);
      assert.equal(await idb.getSetting('ui.panel.left', null), null, 'setting removed');
      const right = /** @type {any} */ (root.querySelector('dm-splitter[for="right"]'));
      const rightBefore = right.current();
      right.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      assert.equal(right.current(), rightBefore + 16, 'the inspector grows towards the left');
      right.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return 'ok';
    } finally { root.remove(); await idb.deleteSetting('ui.panel.left').catch(() => {}); await idb.deleteSetting('ui.panel.right').catch(() => {}); }
  });
})();
