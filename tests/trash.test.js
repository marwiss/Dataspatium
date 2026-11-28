// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of the storage location and its trash in the dataset tree (F131 b): the node Webbläsaren (or the portable folder) with
 * Arbetsyta and Papperskorg, Ta bort to the trash, Återställ, Ångra, Ta bort för gott and Töm papperskorgen, the trash kept out
 * of the modes, and backups and bundles with and without it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const workspace = D.require('data/workspace');
  const idb = D.require('platform/storage/idb');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const csv = (name) => new File([`namn;varde\n${name};1\n`], name + '.csv', { type: 'text/csv' });
  const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})));
  const depth = (el) => Number(/** @type {HTMLElement} */ (el).style.getPropertyValue('--dm-depth'));
  const sameBytes = (a, b) => { const x = new Uint8Array(a); const y = new Uint8Array(b); return x.length === y.length && x.every((v, i) => v === y[i]); };
  /** Open or close one of the nodes above the folders by its chevron. */
  function fold(scope, node, open) {
    const toggle = /** @type {HTMLElement} */ (scope.querySelector(`[data-node="${node}"] .dm-tree-toggle`));
    if (toggle && (toggle.getAttribute('aria-expanded') === 'true') !== open) toggle.click();
  }
  async function startShell() {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    return { root, shell, svc: shell.ctx.services.datasets, store: shell.store };
  }
  const closeAll = () => {
    for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
    for (const m of Array.from(document.querySelectorAll('.dm-menu'))) m.remove();
  };
  const buttonIn = (scope, label) => /** @type {HTMLElement} */ (Array.from(scope.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === label).querySelector('button'));

  test('datasets: the trash marks the record only, list() leaves it out, restore() puts it back, and its short name stays taken', async (assert) => {
    const a = await importer.run(csv('Korgdata'), {}, null, 'Korgdata');
    try {
      await datasets.updateMeta(a.id, { folder: 'Korg/Under' });
      const before = await datasets.get(a.id);
      const file = await idb.loadBlob('ds:' + a.id);
      const [moved] = await datasets.trash([a.id], { root: '' });
      assert.ok(moved && moved.trashed, 'marked');
      assert.equal(moved.trashed.folder, 'Korg/Under', 'where it lay');
      assert.equal(moved.trashed.root, '', 'removed on its own');
      assert.ok(Date.parse(moved.trashed.at) > 0 && moved.trashed.batch, 'when, and the removal');
      const after = await datasets.get(a.id);
      assert.equal(after.updatedAt, before.updatedAt, 'the dataset is not saved again');
      assert.ok(sameBytes(await idb.loadBlob('ds:' + a.id), file), 'its file is not written');
      assert.ok(!(await datasets.list()).some((d) => d.id === a.id), 'left out of the workspace');
      assert.ok((await datasets.list('trash')).some((d) => d.id === a.id), 'in the trash');
      assert.ok((await datasets.list('all')).some((d) => d.id === a.id), 'and among all');
      assert.ok((await datasets.uniqueShortName(a.shortName)) !== a.shortName, 'its short name stays taken');
      assert.deepEqual(await datasets.query(a.id), [['Korgdata', 1]], 'the data stays');
      await datasets.restore([a.id]);
      const back = await datasets.get(a.id);
      assert.ok(!back.trashed && back.folder === 'Korg/Under', 'back where it lay');
      assert.ok((await datasets.list()).some((d) => d.id === a.id));
      return 'ok';
    } finally { await datasets.remove(a.id).catch(() => {}); }
  });

  test('dataset tree: the place with Arbetsyta and Papperskorg, the rows indented under Arbetsyta, the trash grouped by removal, and the folds remembered', async (assert) => {
    const list = D.require('ui/dataset-list');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ds = [
      { id: 'ka', name: 'Alfa', shortName: 'alfa', folder: 'X', rowCount: 1, columnCount: 1, updatedAt: '2026-01-03' },
      { id: 'kc', name: 'Gamma', shortName: 'gamma', folder: '', rowCount: 3, columnCount: 1, updatedAt: '2026-01-01' },
    ];
    const at = '2026-11-28T10:00:00.000Z';
    const trash = [
      { id: 'kt1', name: 'Borta i mapp', shortName: 'b1', folder: 'Gammal/Under', rowCount: 1, byteSize: 1000, trashed: { at, batch: 'tr_k', folder: 'Gammal/Under', root: 'Gammal' } },
      { id: 'kt2', name: 'Borta ensam', shortName: 'b2', folder: 'X', rowCount: 1, byteSize: 2000, trashed: { at: '2026-11-28T11:00:00.000Z', batch: 'tr_l', folder: 'X', root: '' } },
    ];
    const opts = { datasets: ds, trash, selectedId: null, onSelect: () => {}, multi: true, selectedIds: [], onToggle: () => {} };
    let other = null;
    try {
      list.render(container, opts);
      fold(container, 'place', true); fold(container, 'workspace', true); fold(container, 'trash', false);
      const place = /** @type {HTMLElement} */ (container.querySelector('[data-node="place"]'));
      assert.equal(place.getAttribute('data-place'), 'browser');
      assert.equal(place.querySelector('.dm-tree-label').textContent, t('datasets.place.browser'));
      assert.ok(place.querySelector('.dm-list-sub').textContent.includes(t('datasets.place.browser.sub')), 'på den här datorn');
      const rows = Array.from(container.querySelectorAll('[data-tree-row]'));
      assert.equal(rows[0], place, 'the place first');
      assert.equal(depth(place), 0);
      assert.equal(depth(container.querySelector('[data-node="workspace"]')), 1, 'Arbetsyta under it');
      assert.equal(depth(container.querySelector('[data-node="trash"]')), 1, 'Papperskorg beside Arbetsyta');
      assert.equal(depth(container.querySelector('[data-folder-row="X"]')), 2, 'a folder is indented under Arbetsyta');
      assert.equal(depth(container.querySelector('.dm-tree-row[data-id="kc"]')), 2, 'a dataset at the top level too');
      assert.equal(depth(container.querySelector('.dm-tree-row[data-id="ka"]')), 3, 'a dataset in a folder one step more');
      assert.equal(container.querySelector('[data-node="workspace"] .dm-tree-count').textContent, '2');
      assert.ok(container.querySelector('[data-node="trash"] .dm-list-sub').textContent.includes(t('datasets.trash.sub', { n: '2', size: D.require('ui/i18n').formatBytes(3000) })), 'what the trash holds');
      assert.ok(!container.querySelector('[data-trash-id]'), 'the trash starts closed');
      // The trash: the removal of a folder whole, and the dataset removed on its own; the newest first.
      fold(container, 'trash', true);
      const top = Array.from(container.querySelectorAll('[data-tree-row]')).filter((r) => depth(r) === 2 && (r.hasAttribute('data-trash-id') || r.hasAttribute('data-trash-folder')));
      assert.deepEqual(top.map((r) => r.getAttribute('data-trash-id') || r.getAttribute('data-trash-folder')), ['kt2', 'Gammal'], 'each removal, the newest first');
      assert.ok(top[0].querySelector('.dm-list-sub').textContent.includes(t('datasets.trash.from', { folder: 'X' })), 'where it lay');
      assert.ok(top[1].querySelector('.dm-list-sub').textContent.includes(t('datasets.trash.from', { folder: t('datasets.storage.title') })), 'the folder lay at the top');
      assert.ok(!container.querySelector('[data-trash-id="kt1"]'), 'a folder in the trash starts closed');
      /** @type {HTMLElement} */ (top[1].querySelector('.dm-tree-toggle')).click();
      /** @type {HTMLElement} */ ((await waitFor(() => container.querySelector('[data-trash-folder="Gammal/Under"] .dm-tree-toggle'), 2000, 'the subfolder')).click());
      assert.equal(depth(container.querySelector('[data-trash-id="kt1"]')), 4, 'with what it held, as it lay');
      assert.ok(!container.querySelector('.dm-tree-row[data-id="kt1"]') && !container.querySelector('[data-trash-id] input[type="checkbox"]'), 'not a dataset of the workspace, and nothing to check');
      assert.ok(!container.querySelector('[data-restore]') && !container.querySelector('[data-empty-trash]'), 'no tools without Hantera\'s actions');
      // The folds are remembered: another panel draws them the same, and the setting keeps them.
      other = document.createElement('div');
      document.body.appendChild(other);
      list.render(other, Object.assign({}, opts));
      assert.ok(other.querySelector('[data-trash-id="kt2"]'), 'the trash open in another panel too');
      await waitFor(async () => { const v = await idb.getSetting('ui.tree.nodes', {}); return v && v['t:'] === true; }, 2000, 'kept in the setting');
      fold(container, 'workspace', false);
      assert.ok(!container.querySelector('[data-folder-row="X"]'), 'Arbetsyta folds');
      fold(container, 'workspace', true);
      fold(container, 'trash', false);
      await waitFor(async () => { const v = await idb.getSetting('ui.tree.nodes', {}); return v && v['t:'] === false && v['w:'] === true; }, 2000, 'kept closed again');
      assert.deepEqual(D.require('tests/a11y').audit(container), [], 'the accessibility check');
      return 'ok';
    } finally { container.remove(); if (other) other.remove(); }
  });

  test('hantera: Ta bort moves a dataset and a folder with all in it to the trash without a question, the log says what went, and Ångra and Återställ put them back where they lay', async (assert) => {
    const list = D.require('ui/dataset-list');
    const { root, shell, svc, store } = await startShell();
    const a = await shell.ctx.services.importer.run(csv('Korgmapp A'), {}, null, 'Korgmapp A');
    const b = await shell.ctx.services.importer.run(csv('Korgmapp B'), {}, null, 'Korgmapp B');
    const c = await shell.ctx.services.importer.run(csv('Korgmapp C'), {}, null, 'Korgmapp C');
    try {
      await svc.updateMeta(a.id, { folder: 'Korgmapp' });
      await svc.updateMeta(b.id, { folder: 'Korgmapp/Under' });
      list.folders.add('Korgmapp/Tom');
      store.set({ selectedIds: [], selectedId: null });
      await shell.activate('hantera');
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Korgmapp/Under"]') && root.querySelector('.dm-left [data-folder-row="Korgmapp/Tom"]'), 5000, 'the folders');
      fold(root.querySelector('.dm-left'), 'trash', true);
      // Arbetsyta opens the workspace's page, and the entry under the tree is gone.
      assert.ok(!Array.from(root.querySelectorAll('.dm-left .dm-list-item')).some((x) => x.textContent.includes(t('datasets.storage.title'))), 'no Arbetsyta under the tree');
      /** @type {HTMLElement} */ (root.querySelector('.dm-left [data-node="workspace"] [data-part="main"]')).click();
      assert.equal(store.get().selectedId, '__workspace');
      await waitFor(() => root.querySelector('.dm-center [data-storage-card]'), 5000, 'the workspace page');
      assert.ok(root.querySelector('.dm-center [data-storage-card]').textContent.includes(t('datasets.storage.text')), 'where it is stored and what that means');
      await waitFor(() => root.querySelector('.dm-right') && root.querySelector('.dm-right').textContent.includes(t('datasets.storage.where.browser')), 5000, 'the inspector says it too');
      assert.ok(root.querySelector('.dm-left [data-node="workspace"]').classList.contains('dm-tree-current'), 'Arbetsyta is the current row');
      /** @type {HTMLElement} */ (root.querySelector('.dm-left [data-node="place"] [data-part="main"]')).click();
      assert.equal(store.get().selectedId, '__workspace', 'the place opens the same page');
      store.set({ selectedId: null });
      // The folder whole, with Ta bort: no question.
      /** @type {HTMLElement} */ ((await waitFor(() => root.querySelector('.dm-left [data-folder-row="Korgmapp"] input[type="checkbox"]'), 3000, 'the folder')).click());
      /** @type {HTMLElement} */ ((await waitFor(() => { const el = root.querySelector('.dm-left [data-tool="delete"] button'); return el && !(/** @type {any} */ (el)).disabled ? el : null; }, 3000, 'Ta bort on')).click());
      await waitFor(() => !store.get().datasets.some((d) => d.id === a.id || d.id === b.id), 5000, 'gone from Arbetsyta');
      assert.ok(!document.querySelector('dialog[open]'), 'no question');
      assert.ok(!list.folders.list().includes('Korgmapp/Tom'), 'the empty subfolder went too');
      const what = t('datasets.tree.and', { a: t('datasets.tree.n.subfolders', { n: '2' }), b: t('datasets.tree.n.datasets', { n: '2' }) });
      const said = t('datasets.trash.moved.folder', { name: 'Korgmapp', what });
      assert.ok(root.querySelector('.dm-log').textContent.includes(said), 'the log: ' + said);
      const row = await waitFor(() => root.querySelector('.dm-left [data-trash-folder="Korgmapp"]'), 3000, 'the folder in the trash');
      assert.equal(row.querySelector('.dm-tree-count').textContent, '2', 'with its two datasets');
      // Ångra puts back the datasets and the empty folder.
      const toast = await waitFor(() => Array.from(document.querySelectorAll('.dm-toast')).find((x) => x.textContent.includes(said)), 3000, 'the message');
      buttonIn(toast, t('common.undo')).click();
      await waitFor(() => store.get().datasets.filter((d) => d.id === a.id || d.id === b.id).length === 2, 5000, 'back after Ångra');
      assert.equal((await svc.get(b.id)).folder, 'Korgmapp/Under', 'in the same place');
      assert.ok(list.folders.list().includes('Korgmapp/Tom'), 'the empty folder too');
      await waitFor(() => !root.querySelector('.dm-left [data-trash-folder="Korgmapp"]'), 3000, 'out of the trash');
      // A dataset on its own, with Delete on its row; Återställ on its row in the trash puts it back.
      store.set({ selectedIds: [] });
      const main = await waitFor(() => root.querySelector(`.dm-left .dm-tree-row[data-id="${c.id}"] [data-part="main"]`), 3000, 'the row');
      key(main, 'Delete');
      await waitFor(async () => (await svc.get(c.id)).trashed, 5000, 'c in the trash');
      assert.ok(root.querySelector('.dm-log').textContent.includes(t('datasets.trash.moved.one', { name: c.name })), 'the log names it');
      /** @type {HTMLElement} */ ((await waitFor(() => root.querySelector(`.dm-left [data-restore="x:${c.id}"] button`), 3000, 'Återställ on its row')).click());
      await waitFor(() => store.get().datasets.some((d) => d.id === c.id), 5000, 'c back');
      assert.equal((await svc.get(c.id)).folder, '', 'at the top level, where it lay');
      // The folder again, and Återställ in the snabbmeny; it comes back also when its place is gone meanwhile.
      store.set({ selectedIds: [] });
      await shell.ctx.services.datasets.trash([b.id], { root: 'Korgmapp/Under' });
      const inTrash = await waitFor(() => root.querySelector('.dm-left [data-trash-folder="Korgmapp/Under"] [data-part="main"]'), 3000, 'Under in the trash');
      inTrash.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      const menu = await waitFor(() => document.querySelector('.dm-menu'), 2000, 'the snabbmeny');
      assert.deepEqual(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((x) => x.getAttribute('data-menu-item')), ['restore', 'purge']);
      /** @type {HTMLElement} */ (menu.querySelector('[data-menu-item="restore"]')).click();
      await waitFor(() => store.get().datasets.some((d) => d.id === b.id), 5000, 'b back');
      assert.equal((await svc.get(b.id)).folder, 'Korgmapp/Under');
      return 'ok';
    } finally {
      closeAll();
      for (const d of [a, b, c]) await svc.remove(d.id).catch(() => {});
      list.folders.removeUnder('Korgmapp');
      list.folders.untrash(null, 'Korgmapp', false);
      fold(root, 'trash', false);
      store.set({ selectedIds: [], selectedId: null });
      root.remove();
    }
  }, 40000);

  test('hantera: Ta bort för gott and Töm papperskorgen ask first and say how much, Avbryt keeps everything, and the trash has its own size in the status bar', async (assert) => {
    const list = D.require('ui/dataset-list');
    const { root, shell, svc, store } = await startShell();
    const a = await shell.ctx.services.importer.run(csv('Gott A'), {}, null, 'Gott A');
    const b = await shell.ctx.services.importer.run(csv('Gott B'), {}, null, 'Gott B');
    const c = await shell.ctx.services.importer.run(csv('Gott C'), {}, null, 'Gott C');
    try {
      await svc.updateMeta(a.id, { folder: 'Gottmapp' });
      list.folders.add('Gottmapp/Tom');
      await shell.activate('hantera');
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Gottmapp/Tom"]'), 5000, 'the folder');
      fold(root.querySelector('.dm-left'), 'trash', true);
      const version = await svc.snapshot(c.id, 'Provversion');
      assert.ok(await idb.loadBlob(`ds:${c.id}:v${version.n}`), 'a version is kept');
      await shell.ctx.services.datasets.trash([c.id], { root: '' });
      await D.require('ui/batch-actions').removeUnits(shell.ctx, { ids: [b.id], folders: ['Gottmapp'] });
      await waitFor(() => store.get().trash.filter((d) => [a.id, b.id, c.id].includes(d.id)).length === 3, 5000, 'three in the trash');
      // The status bar: the workspace without the trash, and the trash on its own.
      const size = store.get().trash.reduce((n, d) => n + svc.storedBytes(d), 0);
      await waitFor(() => shell.storageEl.textContent.includes(t('shell.storage.trash', { size: D.require('ui/i18n').formatBytes(size) })), 5000, 'the trash in the status bar: ' + shell.storageEl.textContent);
      // Ta bort för gott on one dataset: the question, Avbryt, then yes.
      const row = await waitFor(() => root.querySelector(`.dm-left [data-trash-id="${c.id}"] [data-part="main"]`), 3000, 'c in the trash');
      key(row, 'Delete');
      let dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question');
      assert.equal(dlg.querySelector('.dm-dialog-body').textContent, t('datasets.trash.purge.confirm', { what: c.name }));
      buttonIn(dlg, t('common.cancel')).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 3000, 'closed');
      await wait(200);
      assert.ok((await svc.get(c.id)).trashed, 'Avbryt keeps it');
      root.querySelector(`.dm-left [data-trash-id="${c.id}"] [data-part="main"]`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      /** @type {HTMLElement} */ ((await waitFor(() => document.querySelector('.dm-menu [data-menu-item="purge"]'), 2000, 'Ta bort för gott')).click());
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question again');
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="danger"] button')).click();
      await waitFor(async () => !(await svc.get(c.id)), 5000, 'c gone for good');
      assert.ok(!(await idb.loadBlob('ds:' + c.id)) && !(await idb.loadBlob(`ds:${c.id}:v${version.n}`)), 'its file and its versions are gone from the database');
      // Töm papperskorgen: the folder with its dataset and empty folder, and the dataset on its own.
      const trash = await svc.list('trash');
      const all = trash.reduce((n, d) => n + svc.storedBytes(d), 0);
      const folders = new Set(trash.filter((d) => d.trashed.root).map((d) => d.trashed.batch + '|' + d.trashed.root));
      for (const r of list.folders.trashed()) folders.add(r.batch + '|' + r.root);
      const amount = [folders.size ? t('datasets.tree.n.folders', { n: String(folders.size) }) : '', t('datasets.tree.n.datasets', { n: String(trash.length) })].filter(Boolean);
      const what = amount.length > 1 ? t('datasets.tree.and', { a: amount[0], b: amount[1] }) : amount[0];
      /** @type {HTMLElement} */ ((await waitFor(() => root.querySelector('.dm-left [data-empty-trash] button'), 3000, 'Töm papperskorgen on the row')).click());
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question');
      assert.equal(dlg.querySelector('.dm-dialog-body').textContent, t('datasets.trash.empty.confirm', { what, size: D.require('ui/i18n').formatBytes(all) }), 'how much');
      buttonIn(dlg, t('common.cancel')).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 3000, 'closed');
      await wait(200);
      assert.ok((await svc.get(a.id)).trashed && (await svc.get(b.id)).trashed, 'Avbryt keeps everything');
      /** @type {HTMLElement} */ (root.querySelector('.dm-left [data-empty-trash] button')).click();
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question again');
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="danger"] button')).click();
      await waitFor(async () => !(await svc.get(a.id)) && !(await svc.get(b.id)), 8000, 'gone for good');
      assert.deepEqual(list.folders.trashed(), [], 'the empty folders too');
      assert.ok(!list.folders.list().includes('Gottmapp/Tom'), 'and they do not come back');
      await waitFor(() => !root.querySelector('.dm-left [data-empty-trash]'), 3000, 'nothing left to empty');
      return 'ok';
    } finally {
      closeAll();
      for (const d of [a, b, c]) await svc.remove(d.id).catch(() => {});
      list.folders.removeUnder('Gottmapp');
      list.folders.untrash(null, 'Gottmapp', false);
      fold(root, 'trash', false);
      root.remove();
    }
  }, 40000);

  test('the trash is seen nowhere else: the chosen dataset leaves the modes, their lists, choices and SQL, and its row in the trash opens nothing', async (assert) => {
    const { root, shell, svc, store } = await startShell();
    const a = await shell.ctx.services.importer.run(csv('Osynlig'), {}, null, 'Osynlig');
    try {
      store.set({ selectedId: a.id, selectedIds: [a.id] });
      await shell.activate('bearbeta');
      await waitFor(() => root.querySelector(`.dm-left .dm-tree-row[data-id="${a.id}"]`), 8000, 'the row in Bearbeta');
      const query = D.require('data/query');
      assert.ok((await query.referenced(null, `select * from ${a.shortName}`)).others.some((d) => d.id === a.id), 'SQL finds it before');
      await D.require('ui/batch-actions').removeUnits(shell.ctx, { ids: [a.id], folders: [] });
      await waitFor(() => !store.get().datasets.some((d) => d.id === a.id), 5000, 'gone from the store');
      assert.equal(store.get().selectedId, null, 'no longer chosen');
      assert.deepEqual(store.get().selectedIds, [], 'no longer checked');
      assert.ok(!(await svc.list()).some((d) => d.id === a.id), 'not in the list the modes ask');
      assert.ok(!(await query.referenced(null, `select * from ${a.shortName}`)).others.some((d) => d.id === a.id), 'SQL across datasets does not find it');
      for (const mode of ['bearbeta', 'visualisera', 'soka']) {
        await shell.activate(mode);
        await waitFor(() => store.get().mode === mode && root.querySelector('.dm-left [data-node="trash"]'), 8000, 'the tree in ' + mode);
        assert.ok(!root.querySelector(`.dm-left .dm-tree-row[data-id="${a.id}"]`), mode + ': not under Arbetsyta');
        fold(root.querySelector('.dm-left'), 'trash', true);
        const row = await waitFor(() => root.querySelector(`.dm-left [data-trash-id="${a.id}"] [data-part="main"]`), 3000, mode + ': in Papperskorg');
        /** @type {HTMLElement} */ (row).click();
        assert.equal(store.get().selectedId, null, mode + ': its row opens nothing');
        assert.ok(!root.querySelector('.dm-left [data-restore]') && !root.querySelector('.dm-left [data-empty-trash]'), mode + ': no tools for the trash');
        row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
        await wait(100);
        assert.ok(!document.querySelector('.dm-menu'), mode + ': no snabbmeny');
        key(row, 'Delete');
        await wait(200);
        assert.ok(!document.querySelector('dialog[open]') && (await svc.get(a.id)), mode + ': Delete does nothing');
      }
      return 'ok';
    } finally {
      closeAll();
      await svc.remove(a.id).catch(() => {});
      fold(root, 'trash', false);
      store.set({ selectedIds: [], selectedId: null });
      root.remove();
    }
  }, 40000);

  test('backup and bundle: the trash stays out unless chosen; a backup with it brings it back into the trash, and a bundle carries a chosen one without the mark', async (assert) => {
    const zip = D.require('platform/storage/zip');
    const a = await importer.run(csv('Kopia kvar'), {}, null, 'Kopia kvar');
    const b = await importer.run(csv('Kopia korg'), {}, null, 'Kopia korg');
    const made = [a.id, b.id];
    try {
      await datasets.updateMeta(b.id, { folder: 'Korgkopia' });
      await datasets.trash([b.id], { root: 'Korgkopia' });
      const mark = (await datasets.get(b.id)).trashed;
      const manifestOf = (files) => JSON.parse(String(files[workspace.MANIFEST]));
      const plain = await workspace.collect();
      assert.ok(manifestOf(plain.files).datasets.some((d) => d.id === a.id), 'the workspace goes');
      assert.ok(!manifestOf(plain.files).datasets.some((d) => d.id === b.id) && !plain.files[`datasets/${b.id}.sqlite`], 'the trash stays out');
      const withTrash = await workspace.backup({ trash: true });
      const entries = await zip.readZip(withTrash.blob);
      const listed = JSON.parse(zip.text(entries[workspace.MANIFEST])).datasets.find((d) => d.id === b.id);
      assert.ok(listed && entries[`datasets/${b.id}.sqlite`], 'chosen, it goes');
      assert.deepEqual(listed.trashed, mark, 'marked as in the trash');
      // Restored into an empty place, it comes back into the trash with its mark.
      for (const id of made) await datasets.remove(id);
      const only = {};
      for (const [path, bytes] of Object.entries(entries)) if (path === workspace.MANIFEST || path === `datasets/${a.id}.sqlite` || path === `datasets/${b.id}.sqlite`) only[path] = bytes;
      const res = await workspace.restoreEntries(only);
      assert.equal(res.imported.length, 2);
      assert.ok(!(await datasets.get(a.id)).trashed, 'the workspace back in the workspace');
      assert.deepEqual((await datasets.get(b.id)).trashed, mark, 'the trash back in the trash');
      assert.equal((await datasets.get(b.id)).folder, 'Korgkopia');
      // A bundle takes a dataset from the trash only when it is chosen, and never with the mark.
      const unchosen = await workspace.collect({ kind: 'bundle', datasetIds: [a.id], listAll: false });
      assert.ok(!manifestOf(unchosen.files).datasets.some((d) => d.id === b.id), 'not chosen: not in the bundle');
      const chosen = await workspace.collect({ kind: 'bundle', datasetIds: [b.id], listAll: false });
      const entry = manifestOf(chosen.files).datasets.find((d) => d.id === b.id);
      assert.ok(entry && chosen.files[`datasets/${b.id}.sqlite`], 'chosen: in the bundle');
      assert.ok(!('trashed' in entry), 'without the mark');
      return 'ok';
    } finally { for (const id of made) await datasets.remove(id).catch(() => {}); }
  }, 30000);

  test('the portable folder: the node takes the folder\'s name and says so, and the folder keeps the trash with its mark', async (assert) => {
    const list = D.require('ui/dataset-list');
    const folder = D.require('platform/storage/folder');
    /** An in-memory folder with the methods platform/storage/folder uses. */
    function memoryDirectory(name) {
      const own = new Map(); const dirs = new Map();
      return {
        kind: 'directory', name,
        async getDirectoryHandle(n, opts = {}) { if (!dirs.has(n)) { if (!opts.create) throw new DOMException('Not found: ' + n, 'NotFoundError'); dirs.set(n, memoryDirectory(n)); } return dirs.get(n); },
        async getFileHandle(n, opts = {}) {
          if (!own.has(n)) { if (!opts.create) throw new DOMException('Not found: ' + n, 'NotFoundError'); own.set(n, new Uint8Array(0)); }
          return { kind: 'file', name: n, async getFile() { return new File([own.get(n)], n); }, async createWritable() { const parts = []; return { async write(d) { parts.push(d instanceof Uint8Array ? d : new Uint8Array(await new Blob([d]).arrayBuffer())); }, async close() { own.set(n, new Uint8Array(await new Blob(parts).arrayBuffer())); } }; } };
        },
        async removeEntry(n) { if (!own.delete(n) && !dirs.delete(n)) throw new DOMException('Not found: ' + n, 'NotFoundError'); },
        async *entries() { for (const [n, d] of dirs) yield [n, d]; for (const [n] of own) yield [n, { kind: 'file', name: n }]; },
        async queryPermission() { return 'granted'; },
      };
    }
    const handle = memoryDirectory('Provmapp på disk');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const b = await importer.run(csv('Mappkorg'), {}, null, 'Mappkorg');
    const was = workspace.folderStatus().enabled;
    try {
      list.render(container, { datasets: [], selectedId: null, onSelect: () => {} });
      const place = () => /** @type {HTMLElement} */ (container.querySelector('[data-node="place"]'));
      assert.equal(place().getAttribute('data-place'), 'browser');
      await folder.setHandle(handle);
      workspace.setAutoSave(true);
      await waitFor(() => place().getAttribute('data-place') === 'folder', 3000, 'the folder as the place');
      assert.equal(place().querySelector('.dm-tree-label').textContent, 'Provmapp på disk', 'named after the folder');
      assert.ok(place().querySelector('.dm-list-sub').textContent.includes(t('datasets.place.folder.sub')), 'and says that it is a portable folder');
      // The folder is where the workspace lies: its trash goes there too, marked, and loading it again brings nothing twice.
      await datasets.trash([b.id], { root: '' });
      await workspace.saveToFolder(handle, { force: true });
      const manifest = JSON.parse(new TextDecoder().decode(await folder.readFile(handle, workspace.MANIFEST)));
      const entry = manifest.datasets.find((d) => d.id === b.id);
      assert.ok(entry && entry.trashed && (await folder.listFiles(handle, 'datasets/')).includes(`datasets/${b.id}.sqlite`), 'the trash in the folder, marked');
      const loaded = await workspace.loadFromFolder(handle);
      assert.ok(!loaded.imported.some((m) => m.id === b.id || m.name === 'Mappkorg'), 'not brought in a second time');
      workspace.setAutoSave(false);
      await waitFor(() => place().getAttribute('data-place') === 'browser', 3000, 'the browser again');
      assert.equal(place().querySelector('.dm-tree-label').textContent, t('datasets.place.browser'));
      return 'ok';
    } finally {
      workspace.setAutoSave(was);
      await folder.setHandle(null);
      await datasets.remove(b.id).catch(() => {});
      container.remove();
    }
  }, 30000);
})();
