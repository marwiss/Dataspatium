// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of folders, tags, the dataset tree with multi-selection and the batch actions in Hantera. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const csv = (name) => new File([`namn;varde\n${name};1\n`], name + '.csv', { type: 'text/csv' });

  test('datasets: folder and tags are normalised, kept in the file and survive export and import', async (assert) => {
    const a = await importer.run(csv('Mappdata'), {}, null, 'Mappdata');
    let again = null;
    try {
      assert.equal(a.folder, ''); assert.deepEqual(a.tags, []);
      await datasets.updateMeta(a.id, { folder: ' Projekt / 2026 / ', tags: 'befolkning, scb , befolkning' });
      const meta = await datasets.get(a.id);
      assert.equal(meta.folder, 'Projekt/2026');
      assert.deepEqual(meta.tags, ['befolkning', 'scb']);
      assert.deepEqual(datasets.folderPaths([meta, { folder: 'Projekt/2025' }, { folder: '' }]), ['Projekt', 'Projekt/2025', 'Projekt/2026']);
      assert.equal(datasets.normalizeFolder('//a//b/'), 'a/b');
      const bytes = await datasets.exportBytes(a.id);
      await datasets.remove(a.id);
      again = await datasets.importBytes(bytes);
      assert.equal(again.folder, 'Projekt/2026', 'folder travels in the file');
      assert.deepEqual(again.tags, ['befolkning', 'scb'], 'tags travel in the file');
      return 'ok';
    } finally { if (again) await datasets.remove(again.id); else await datasets.remove(a.id).catch(() => {}); }
  });

  test('dataset list: a tree of folders with counts, collapsing, a filter and check boxes for several datasets', async (assert) => {
    const list = D.require('ui/dataset-list');
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const ds = [
        { id: 'a', name: 'Alfa', shortName: 'alfa', folder: 'X', rowCount: 1, columnCount: 1, updatedAt: '2026-01-03' },
        { id: 'b', name: 'Beta', shortName: 'beta', folder: 'X/Y', rowCount: 2, columnCount: 1, updatedAt: '2026-01-02' },
        { id: 'c', name: 'Gamma', shortName: 'gamma', folder: '', rowCount: 3, columnCount: 1, updatedAt: '2026-01-01', tags: ['viktig'] },
      ];
      let toggled = null; let moved = null;
      const opts = { datasets: ds, selectedId: 'c', onSelect: () => {}, multi: true, selectedIds: ['a'], onToggle: (ids) => { toggled = ids; }, onMove: (ids, folder) => { moved = { ids, folder }; } };
      list.render(container, opts);
      const folders = Array.from(container.querySelectorAll('.dm-tree-folder'));
      assert.deepEqual(folders.map((f) => f.getAttribute('data-folder')), ['X', 'X/Y'], 'nested folders');
      assert.equal(folders[0].querySelector('.dm-tree-count').textContent, '2', 'X holds two datasets');
      assert.equal(container.querySelectorAll('.dm-tree-row').length, 3, 'three dataset rows');
      assert.ok(container.querySelector('.dm-tree-row[data-id="a"] input[type="checkbox"]').checked, 'a is checked');
      /** @type {HTMLElement} */ (container.querySelector('.dm-tree-row[data-id="b"] input[type="checkbox"]')).click();
      assert.deepEqual(toggled.sort(), ['a', 'b'], 'toggle adds b');
      // The chevron opens and closes a folder; with check boxes a click on the folder itself chooses it (the tree tests below).
      /** @type {HTMLElement} */ (container.querySelector('[data-folder-row="X"] .dm-tree-toggle')).click();
      assert.equal(container.querySelectorAll('.dm-tree-row').length, 1, 'collapsing X hides a and b');
      assert.equal(container.querySelector('[data-folder-row="X"] .dm-tree-toggle').getAttribute('aria-expanded'), 'false');
      /** @type {HTMLElement} */ (container.querySelector('[data-folder-row="X"] .dm-tree-toggle')).click();
      assert.equal(container.querySelectorAll('.dm-tree-row').length, 3, 'expanded again');
      const filter = /** @type {any} */ (container.querySelector('.dm-list-filter'));
      filter.value = 'viktig';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      assert.deepEqual(Array.from(container.querySelectorAll('.dm-tree-row')).map((r) => r.getAttribute('data-id')), ['c'], 'filter matches a tag');
      filter.value = '';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      // A drop on a folder row reports the ids and the folder.
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify({ dataspatium: 'datasets', ids: ['c'] }));
      container.querySelector('.dm-tree-folder[data-folder="X/Y"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      assert.deepEqual(moved, { ids: ['c'], folder: 'X/Y' });
      return 'ok';
    } finally { container.remove(); }
  });

  test('hantera: selecting two datasets offers the batch actions, and Ordna moves them to a new folder', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const a = await shell.ctx.services.importer.run(csv('Batch A'), {}, null, 'Batch A');
    const b = await shell.ctx.services.importer.run(csv('Batch B'), {}, null, 'Batch B');
    try {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === b.id), 3000, 'datasets in store');
      shell.activate('hantera');
      await waitFor(() => root.querySelector(`.dm-left .dm-tree-row[data-id="${a.id}"]`), 3000, 'tree rows');
      /** @type {HTMLElement} */ (root.querySelector(`.dm-left .dm-tree-row[data-id="${a.id}"] input`)).click();
      /** @type {HTMLElement} */ (root.querySelector(`.dm-left .dm-tree-row[data-id="${b.id}"] input`)).click();
      assert.deepEqual(shell.store.get().selectedIds.slice().sort(), [a.id, b.id].sort(), 'both selected');
      const batchBtn = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('.dm-left dm-button')).find((x) => (x.getAttribute('label') || '').includes('(2)')), 3000, 'batch button'));
      batchBtn.querySelector('button').click();
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'batch dialog');
      const organize = /** @type {any} */ (Array.from(dlg.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === t('datasets.organize')));
      organize.querySelector('button').click();
      const dlg2 = await waitFor(() => { const open = document.querySelectorAll('dialog[open]'); return open.length === 1 && open[0].querySelector('dm-select') ? open[0] : null; }, 3000, 'organise dialog');
      const newIn = /** @type {any} */ (Array.from(dlg2.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('datasets.folder.new')));
      newIn.value = 'Testmapp/2026';
      /** @type {HTMLElement} */ (dlg2.querySelector('.dm-dialog-actions dm-button[variant="primary"] button')).click();
      // Wait for both: the move runs dataset by dataset, and cleanup must not race a save in flight.
      const folderOf = async (id) => (await shell.ctx.services.datasets.get(id)).folder;
      for (let i = 0; i < 100 && !((await folderOf(a.id)) === 'Testmapp/2026' && (await folderOf(b.id)) === 'Testmapp/2026'); i++) await wait(50);
      assert.equal((await shell.ctx.services.datasets.get(b.id)).folder, 'Testmapp/2026', 'b moved');
      assert.equal((await shell.ctx.services.datasets.get(a.id)).folder, 'Testmapp/2026', 'a moved');
      await waitFor(() => root.querySelector('.dm-left .dm-tree-folder[data-folder="Testmapp/2026"]'), 3000, 'folder in the tree');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      await shell.ctx.services.datasets.remove(a.id); await shell.ctx.services.datasets.remove(b.id); root.remove();
    }
  });

  test('datasets: duplicate copies the whole file under a new id and short name, with the name and folder given, and says where it came from', async (assert) => {
    const dsFiles = D.require('data/dataset-files');
    const a = await dsFiles.createDataset({ name: 'Original', columns: [{ name: 'namn', type: 'text' }, { name: 'tal', type: 'integer' }], rows: [['a', 1], ['b', 2]], files: [{ name: 'bilaga.txt', kind: 'original', type: 'text/plain', bytes: new TextEncoder().encode('hej') }] });
    let copy = null; let back = null;
    try {
      await datasets.updateMeta(a.id, { folder: 'Original/Mapp', tags: 'en, två' });
      copy = await datasets.duplicate(a.id, { name: 'Original (kopia)', folder: 'Kopior' });
      assert.ok(copy.id !== a.id, 'a new id');
      assert.ok(copy.shortName && copy.shortName !== (await datasets.get(a.id)).shortName, 'a short name of its own: ' + copy.shortName);
      assert.equal(copy.name, 'Original (kopia)');
      assert.equal(copy.folder, 'Kopior');
      assert.deepEqual(copy.tags, ['en', 'två'], 'the tags come along');
      assert.deepEqual(await datasets.query(copy.id), await datasets.query(a.id), 'the same rows');
      assert.deepEqual((await dsFiles.list(copy.id)).map((f) => f.name), ['bilaga.txt'], 'the files come along');
      const log = await datasets.log(copy.id);
      assert.equal(log[log.length - 1].action, 'copy');
      assert.equal(log[log.length - 1].details.from, a.id);
      assert.equal(D.require('data/changelog').describe(log[log.length - 1]), t('log.copy', { name: 'Original' }));
      assert.equal((await datasets.get(a.id)).folder, 'Original/Mapp', 'the original stays where it was');
      // The name and folder are in the copy's file too, so a backup or bundle carries them.
      back = await datasets.importBytes(await datasets.exportBytes(copy.id), {}, { quiet: true });
      assert.equal(back.name, 'Original (kopia)');
      assert.equal(back.folder, 'Kopior');
      return 'ok';
    } finally {
      for (const d of [back, copy, a]) if (d) await datasets.remove(d.id).catch(() => {});
    }
  });

  /** A tree with stand-in tools for the tests below: X holds ta, X/Y holds tb, and tc is at the root. */
  function treeFixture(extra) {
    const list = D.require('ui/dataset-list');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const calls = { toggled: [], removed: [], pasted: [], renamed: [] };
    const ds = [
      { id: 'ta', name: 'Alfa', shortName: 'alfa', folder: 'X', rowCount: 1, columnCount: 1, updatedAt: '2026-01-03' },
      { id: 'tb', name: 'Beta', shortName: 'beta', folder: 'X/Y', rowCount: 2, columnCount: 1, updatedAt: '2026-01-02' },
      { id: 'tc', name: 'Gamma', shortName: 'gamma', folder: '', rowCount: 3, columnCount: 1, updatedAt: '2026-01-01' },
    ];
    const opts = Object.assign({
      datasets: ds, selectedId: null, onSelect: () => {}, multi: true, selectedIds: [], onToggle: (ids) => { calls.toggled.push(ids.slice().sort()); },
      actions: {
        remove: async (u) => { calls.removed.push(u); return true; },
        paste: async (clip, target) => { calls.pasted.push({ clip, target }); return []; },
        rename: async (u, name) => { calls.renamed.push({ u, name }); return true; },
      },
    }, extra || {});
    list.render(container, opts);
    return {
      list, container, calls,
      again: (patch) => list.render(container, Object.assign(opts, patch)),
      box: (sel) => /** @type {HTMLInputElement} */ (container.querySelector(sel + ' input[type="checkbox"]')),
      main: (sel) => /** @type {HTMLElement} */ (container.querySelector(sel + ' [data-part="main"]')),
      tool: (id) => /** @type {HTMLButtonElement} */ (container.querySelector(`[data-tool="${id}"] button`)),
      // Focus left inside a tree would come back with every redraw and steal the focus (and its tooltip) from later tests.
      done: () => { if (container.contains(document.activeElement)) /** @type {any} */ (document.activeElement).blur(); list.clip.set(null); container.remove(); },
    };
  }
  const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})));

  test('dataset tree: a folder\'s check box chooses everything in it and below, a part shows as mixed, and a click on the folder does the same', async (assert) => {
    const f = treeFixture();
    try {
      // What a mode adds to the panel below the tree (Visualisera's charts) stays when the tree draws itself again.
      const after = document.createElement('p');
      after.className = 'dm-test-after';
      f.container.appendChild(after);
      f.box('[data-folder-row="X"]').click();
      assert.ok(after.parentNode === f.container, 'the mode\'s part of the panel stays');
      assert.deepEqual(f.calls.toggled.pop(), ['ta', 'tb'], 'X with its subfolder');
      assert.ok(f.box('[data-folder-row="X"]').checked && f.box('[data-folder-row="X/Y"]').checked, 'both folders checked');
      f.box('.dm-tree-row[data-id="tb"]').click();
      assert.deepEqual(f.calls.toggled.pop(), ['ta']);
      assert.ok(!f.box('[data-folder-row="X"]').checked && f.box('[data-folder-row="X"]').indeterminate, 'X is partly chosen');
      assert.ok(!f.box('[data-folder-row="X/Y"]').checked && !f.box('[data-folder-row="X/Y"]').indeterminate, 'X/Y is not chosen');
      // The mode draws again with its own selection: the subfolder alone.
      f.again({ selectedIds: ['tb'] });
      assert.ok(f.box('[data-folder-row="X/Y"]').checked, 'X/Y chosen through its dataset');
      assert.ok(f.box('[data-folder-row="X"]').indeterminate, 'X mixed');
      f.main('[data-folder-row="X"]').click();
      assert.deepEqual(f.calls.toggled.pop(), ['ta', 'tb'], 'a click on a partly chosen folder chooses all of it');
      f.main('[data-folder-row="X"]').click();
      assert.deepEqual(f.calls.toggled.pop(), [], 'and again clears it');
      return 'ok';
    } finally { f.done(); }
  });

  test('dataset tree: the tools stand right above the tree with labels and tips and are on when they apply, and itemTrailing ends a dataset\'s row', async (assert) => {
    const { h } = D.require('ui/base');
    const f = treeFixture({ itemTrailing: (d) => (d.id === 'tc' ? null : h('span', { class: 'dm-test-trail', text: d.id })) });
    try {
      const bar = f.container.querySelector('.dm-tree-toolbar');
      assert.ok(bar && bar.nextElementSibling && bar.nextElementSibling.classList.contains('dm-tree'), 'right above the tree');
      assert.equal(bar.getAttribute('aria-label'), t('datasets.tree.tools'));
      const ids = Array.from(bar.querySelectorAll('dm-button')).map((b) => b.getAttribute('data-tool'));
      assert.deepEqual(ids, ['newfolder', 'rename', 'cut', 'copy', 'paste', 'move', 'delete']);
      for (const b of Array.from(bar.querySelectorAll('dm-button'))) {
        const inner = b.querySelector('button');
        assert.ok(inner.textContent.trim() && inner.getAttribute('data-tip'), 'a label and a tip on ' + b.getAttribute('data-tool'));
      }
      assert.equal(bar.querySelector('[data-tool="delete"]').getAttribute('variant'), 'danger');
      const on = () => ids.filter((id) => !f.tool(id).disabled);
      assert.deepEqual(on(), ['newfolder'], 'nothing chosen: only Ny mapp');
      f.again({ selectedIds: ['ta', 'tb'] });
      assert.deepEqual(on(), ['newfolder', 'rename', 'cut', 'copy', 'move', 'delete'], 'one folder chosen whole');
      f.again({ selectedIds: ['ta', 'tc'] });
      assert.deepEqual(on(), ['newfolder', 'cut', 'copy', 'move', 'delete'], 'two items: no rename');
      f.again({ selectedIds: [], selectedId: 'tc' });
      assert.deepEqual(on(), ['newfolder', 'rename', 'cut', 'copy', 'move', 'delete'], 'nothing checked: the current dataset');
      const rowA = f.container.querySelector('.dm-tree-row[data-id="ta"]');
      assert.ok(rowA.lastElementChild.classList.contains('dm-test-trail'), 'the trailing node ends the row');
      assert.ok(!f.container.querySelector('.dm-tree-row[data-id="tc"] .dm-test-trail'), 'null adds nothing');
      return 'ok';
    } finally { f.done(); }
  });

  test('dataset tree: Delete, Ctrl+C, Ctrl+X, Ctrl+V and F2 on the tree, and the arrows between the rows', async (assert) => {
    const f = treeFixture();
    try {
      // Nothing checked: a key acts on the row it is pressed on.
      key(f.main('.dm-tree-row[data-id="tc"]'), 'Delete');
      await waitFor(() => f.calls.removed.length, 2000, 'Delete');
      assert.deepEqual(f.calls.removed.pop(), { ids: ['tc'], folders: [] });
      f.again({ selectedIds: ['tb'] });
      key(f.main('[data-folder-row="X/Y"]'), 'c', { ctrlKey: true });
      assert.deepEqual(f.list.clip.get(), { mode: 'copy', ids: [], folders: ['X/Y'] }, 'Ctrl+C takes the folder chosen whole');
      assert.ok(f.container.querySelector('[data-clip="copy"]'), 'the head says what is copied');
      assert.ok(!f.tool('paste').disabled, 'Klistra in is on');
      f.again({ selectedIds: [] });
      key(f.main('.dm-tree-row[data-id="tc"]'), 'v', { ctrlKey: true });
      await waitFor(() => f.calls.pasted.length, 2000, 'Ctrl+V');
      assert.deepEqual(f.calls.pasted.pop(), { clip: { mode: 'copy', ids: [], folders: ['X/Y'] }, target: '' }, 'beside the dataset the key is pressed on');
      assert.ok(f.list.clip.get(), 'a copy can be pasted again');
      key(f.main('.dm-tree-row[data-id="tc"]'), 'x', { ctrlKey: true });
      assert.equal(f.list.clip.get().mode, 'cut');
      assert.ok(f.container.querySelector('.dm-tree-row[data-id="tc"]').classList.contains('dm-tree-cut'), 'what is cut is faded');
      key(f.main('[data-folder-row="X/Y"]'), 'v', { ctrlKey: true });
      await waitFor(() => f.calls.pasted.length, 2000, 'Ctrl+V after Ctrl+X');
      assert.deepEqual(f.calls.pasted.pop(), { clip: { mode: 'cut', ids: ['tc'], folders: [] }, target: 'X/Y' }, 'into the folder the key is pressed on');
      assert.equal(f.list.clip.get(), null, 'a cut is pasted once');
      // F2: the name in place, Escape leaves it, Enter saves it.
      const a = f.main('.dm-tree-row[data-id="ta"]');
      a.focus();
      key(a, 'F2');
      let field = /** @type {any} */ (await waitFor(() => f.container.querySelector('.dm-tree-row[data-id="ta"] dm-input'), 2000, 'the name field'));
      assert.equal(field.value, 'Alfa');
      assert.equal(document.activeElement, field.control, 'the field has the focus');
      key(field.control, 'Escape');
      assert.ok(!f.container.querySelector('dm-input.dm-tree-edit'), 'Escape leaves it');
      assert.equal(document.activeElement, f.main('.dm-tree-row[data-id="ta"]'), 'the focus is back on the row');
      key(f.main('.dm-tree-row[data-id="ta"]'), 'F2');
      field = f.container.querySelector('.dm-tree-row[data-id="ta"] dm-input');
      field.value = 'Alfa ny';
      field.control.dispatchEvent(new Event('input', { bubbles: true }));
      key(field.control, 'Enter');
      await waitFor(() => f.calls.renamed.length, 2000, 'rename');
      assert.deepEqual(f.calls.renamed.pop(), { u: { ids: ['ta'], folders: [] }, name: 'Alfa ny' });
      // The arrows go from row to row, Left to the folder above.
      const mains = Array.from(f.container.querySelectorAll('.dm-tree [data-part="main"]'));
      mains[0].focus();
      key(mains[0], 'ArrowDown');
      assert.equal(document.activeElement, mains[1]);
      const b = f.main('.dm-tree-row[data-id="tb"]');
      b.focus();
      key(b, 'ArrowLeft');
      assert.equal(document.activeElement, f.main('[data-folder-row="X/Y"]'));
      return 'ok';
    } finally { f.done(); }
  });

  test('hantera: a folder chosen whole is deleted with its subfolders and datasets after one question that says how many', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const svc = shell.ctx.services.datasets;
    const a = await shell.ctx.services.importer.run(csv('Radmapp A'), {}, null, 'Radmapp A');
    const b = await shell.ctx.services.importer.run(csv('Radmapp B'), {}, null, 'Radmapp B');
    const c = await shell.ctx.services.importer.run(csv('Radmapp C'), {}, null, 'Radmapp C');
    try {
      await svc.updateMeta(a.id, { folder: 'Provmapp' });
      await svc.updateMeta(b.id, { folder: 'Provmapp/Under' });
      shell.store.set({ selectedIds: [] });
      shell.activate('hantera');
      // The moves reach the store and the tree a moment later: wait for the subfolder, not only the folder (LD-69).
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Provmapp/Under"]'), 5000, 'the subfolder row');
      const box = /** @type {HTMLInputElement} */ (await waitFor(() => root.querySelector('.dm-left [data-folder-row="Provmapp"] input[type="checkbox"]'), 5000, 'the folder row'));
      box.click();
      assert.deepEqual(shell.store.get().selectedIds.slice().sort(), [a.id, b.id].sort(), 'the folder chooses both');
      const what = t('datasets.tree.and', { a: t('datasets.tree.n.subfolders', { n: '1' }), b: t('datasets.tree.n.datasets', { n: '2' }) });
      // Avbryt changes nothing.
      /** @type {HTMLElement} */ (root.querySelector('.dm-left [data-tool="delete"] button')).click();
      let dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question');
      assert.ok(dlg.querySelector('.dm-dialog-body').textContent.includes(t('datasets.tree.delete.folder', { name: 'Provmapp', what })), 'how many go, and that it cannot be undone');
      /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button')).find((x) => x.getAttribute('label') === t('common.cancel')).querySelector('button')).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 3000, 'the question closed');
      await wait(200);
      assert.ok((await svc.get(a.id)) && (await svc.get(b.id)), 'nothing deleted');
      assert.deepEqual(shell.store.get().selectedIds.slice().sort(), [a.id, b.id].sort(), 'still chosen');
      assert.ok(root.querySelector('.dm-left [data-folder-row="Provmapp/Under"]'), 'the folders stay');
      /** @type {HTMLElement} */ (await waitFor(() => { const el = root.querySelector('.dm-left [data-tool="delete"] button'); return el && !(/** @type {any} */ (el)).disabled ? el : null; }, 3000, 'Ta bort on again')).click();
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question again');
      assert.equal(dlg.querySelector('.dm-dialog-body').textContent, t('datasets.tree.delete.folder', { name: 'Provmapp', what }));
      /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button[variant="danger"] button')).click();
      await waitFor(() => !shell.store.get().datasets.some((d) => d.id === a.id || d.id === b.id), 5000, 'both gone');
      assert.ok(!(await svc.get(a.id)) && !(await svc.get(b.id)), 'deleted from storage');
      assert.ok(await svc.get(c.id), 'the dataset outside the folder stays');
      await waitFor(() => !root.querySelector('.dm-left [data-folder-row="Provmapp"]'), 3000, 'the folder leaves the tree');
      assert.ok(!document.querySelector('dialog[open]'), 'one question only');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      for (const d of [a, b, c]) await svc.remove(d.id).catch(() => {});
      shell.store.set({ selectedIds: [] });
      root.remove();
    }
  }, 30000);

  test('hantera: a folder chosen whole gives the batch actions everything in it, and their Ta bort deletes it with its subfolders, the empty one too; the filter lies right under the pane head', async (assert) => {
    const list = D.require('ui/dataset-list');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const svc = shell.ctx.services.datasets;
    const store = shell.store;
    const a = await shell.ctx.services.importer.run(csv('Batchmapp A'), {}, null, 'Batchmapp A');
    const b = await shell.ctx.services.importer.run(csv('Batchmapp B'), {}, null, 'Batchmapp B');
    const c = await shell.ctx.services.importer.run(csv('Batchmapp C'), {}, null, 'Batchmapp C');
    const box = (path) => /** @type {HTMLInputElement} */ (root.querySelector(`.dm-left [data-folder-row="${path}"] input[type="checkbox"]`));
    const button = (dlg, label) => /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === label).querySelector('button'));
    try {
      await svc.updateMeta(a.id, { folder: 'Batchmapp' });
      await svc.updateMeta(b.id, { folder: 'Batchmapp/Under' });
      list.folders.add('Batchmapp/Tom');
      store.set({ selectedIds: [], selectedId: null });
      shell.activate('hantera');
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Batchmapp/Under"]') && root.querySelector('.dm-left [data-folder-row="Batchmapp/Tom"]'), 5000, 'the folders');
      // The heading takes no room (it holds Välj on touch screens), and the filter lies right under the pane head.
      const head = /** @type {HTMLElement} */ (root.querySelector('.dm-left .dm-list-head'));
      const body = root.querySelector('.dm-left .dm-pane-body');
      assert.equal(getComputedStyle(head).display, 'none', 'no empty heading');
      const gap = root.querySelector('.dm-left .dm-list-tools').getBoundingClientRect().top - body.getBoundingClientRect().top;
      assert.ok(gap <= parseFloat(getComputedStyle(body).paddingTop) + 1, 'the filter first in the panel: ' + gap);
      // The folder's box chooses everything below it; a part shows as mixed.
      box('Batchmapp').click();
      assert.deepEqual(store.get().selectedIds.slice().sort(), [a.id, b.id].sort(), 'the datasets of the folder and its subfolder');
      await waitFor(() => box('Batchmapp').checked && box('Batchmapp/Under').checked && box('Batchmapp/Tom').checked, 3000, 'the folders checked');
      assert.equal(getComputedStyle(root.querySelector('.dm-left .dm-list-head')).display, 'none', 'still no heading: checking moves no row');
      const status = root.querySelector('.dm-left .dm-list-status');
      assert.ok(status && status.previousElementSibling === root.querySelector('.dm-left .dm-tree') && status.textContent === t('datasets.selected.count', { n: 2 }), 'how many, under the tree');
      /** @type {HTMLElement} */ (root.querySelector(`.dm-left .dm-tree-row[data-id="${b.id}"] input`)).click();
      await waitFor(() => box('Batchmapp').indeterminate && !box('Batchmapp').checked, 3000, 'mixed');
      assert.ok(!box('Batchmapp/Under').checked && !box('Batchmapp/Under').indeterminate, 'the subfolder not chosen');
      box('Batchmapp').click();
      await waitFor(() => box('Batchmapp').checked && !box('Batchmapp').indeterminate, 3000, 'all again');
      // Åtgärder för markerade: both datasets; Ta bort asks the tree's question, and Avbryt keeps everything.
      const openBatch = async () => {
        /** @type {HTMLElement} */ ((await waitFor(() => root.querySelector('.dm-left [data-course="batch"] button'), 3000, 'the batch button')).click());
        const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the batch dialog');
        assert.equal(dlg.querySelector('.dm-dialog-head h2').textContent, t('datasets.batch.title', { n: 2 }));
        button(dlg, t('datasets.batch.delete')).click();
        return waitFor(() => { const d = document.querySelector('dialog[open]'); return d && d !== dlg ? d : null; }, 3000, 'the question');
      };
      const what = t('datasets.tree.and', { a: t('datasets.tree.n.subfolders', { n: '2' }), b: t('datasets.tree.n.datasets', { n: '2' }) });
      let ask = await openBatch();
      assert.equal(ask.querySelector('.dm-dialog-body').textContent, t('datasets.tree.delete.folder', { name: 'Batchmapp', what }));
      button(ask, t('common.cancel')).click();
      await waitFor(() => !document.querySelector('dialog[open]'), 3000, 'closed');
      await wait(200);
      assert.ok((await svc.get(a.id)) && (await svc.get(b.id)) && list.folders.list().includes('Batchmapp/Tom'), 'nothing deleted');
      ask = await openBatch();
      /** @type {HTMLElement} */ (ask.querySelector('.dm-dialog-actions dm-button[variant="danger"] button')).click();
      await waitFor(() => !store.get().datasets.some((d) => d.id === a.id || d.id === b.id), 5000, 'both gone');
      assert.ok(!(await svc.get(a.id)) && !(await svc.get(b.id)), 'deleted from storage');
      assert.ok(await svc.get(c.id), 'the dataset outside the folder stays');
      assert.ok(!list.folders.list().some((p) => p.startsWith('Batchmapp')), 'the empty subfolder goes too');
      await waitFor(() => !root.querySelector('.dm-left [data-folder-row="Batchmapp"]'), 3000, 'the folder leaves the tree');
      assert.deepEqual(store.get().selectedIds, [], 'nothing chosen any more');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      for (const d of [a, b, c]) await svc.remove(d.id).catch(() => {});
      list.folders.removeUnder('Batchmapp');
      store.set({ selectedIds: [] });
      root.remove();
    }
  }, 40000);

  test('dataset tree: the tools that change the folders are Hantera\'s alone; in Bearbeta and Visualisera the tree filters, sorts and checks, but its keys, snabbmeny and dragging do nothing', async (assert) => {
    const list = D.require('ui/dataset-list');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const svc = shell.ctx.services.datasets;
    const store = shell.store;
    const a = await shell.ctx.services.importer.run(csv('Lägesmapp A'), {}, null, 'Lägesmapp A');
    const b = await shell.ctx.services.importer.run(csv('Lägesmapp B'), {}, null, 'Lägesmapp B');
    const main = (sel) => /** @type {HTMLElement} */ (root.querySelector(`.dm-left ${sel} [data-part="main"]`));
    try {
      await svc.updateMeta(a.id, { folder: 'Lägesmapp' });
      store.set({ selectedIds: [], selectedId: null });
      list.clip.set(null);
      await shell.activate('hantera');
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Lägesmapp"]') && root.querySelector('.dm-left .dm-tree-toolbar'), 5000, 'the tools in Hantera');
      assert.equal(main('[data-folder-row="Lägesmapp"]').getAttribute('draggable'), 'true', 'a folder is dragged in Hantera');
      for (const mode of ['bearbeta', 'visualisera']) {
        await shell.activate(mode);
        await waitFor(() => store.get().mode === mode && root.querySelector(`.dm-left .dm-tree-row[data-id="${a.id}"]`) && !root.querySelector('.dm-left .dm-tree-toolbar'), 8000, 'the tree without tools in ' + mode);
        assert.ok(!root.querySelector('.dm-left [data-tool]'), mode + ': no tools');
        assert.ok(root.querySelector('.dm-left .dm-list-filter') && root.querySelector('.dm-left .dm-list-sort'), mode + ': the filter and the sort order');
        assert.ok(!main('[data-folder-row="Lägesmapp"]').hasAttribute('draggable') && !main(`.dm-tree-row[data-id="${a.id}"]`).hasAttribute('draggable'), mode + ': nothing to drag');
        // The keys of the tools do nothing.
        for (const [k, extra] of [['Delete'], ['F2'], ['x', { ctrlKey: true }], ['c', { ctrlKey: true }]]) key(main(`.dm-tree-row[data-id="${a.id}"]`), k, extra);
        await wait(300);
        assert.ok(!document.querySelector('dialog[open]') && (await svc.get(a.id)), mode + ': Delete asks nothing and deletes nothing');
        assert.ok(!root.querySelector('.dm-left dm-input.dm-tree-edit'), mode + ': F2 names nothing');
        assert.equal(list.clip.get(), null, mode + ': Ctrl+X and Ctrl+C take nothing');
        // No snabbmeny, and a drop on a folder moves nothing.
        main(`.dm-tree-row[data-id="${a.id}"]`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
        await wait(100);
        assert.ok(!document.querySelector('.dm-menu'), mode + ': no snabbmeny');
        const dt = new DataTransfer();
        dt.setData('text/plain', JSON.stringify({ dataspatium: 'datasets', ids: [b.id], folders: [] }));
        main('[data-folder-row="Lägesmapp"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        await wait(300);
        assert.equal((await svc.get(b.id)).folder, '', mode + ': the drop moves nothing');
        // The check boxes choose for the mode's own actions.
        /** @type {HTMLElement} */ (root.querySelector(`.dm-left [data-folder-row="Lägesmapp"] input[type="checkbox"]`)).click();
        assert.deepEqual(store.get().selectedIds, [a.id], mode + ': the folder chooses its dataset');
        store.set({ selectedIds: [] });
      }
      await shell.activate('hantera');
      await waitFor(() => root.querySelector('.dm-left .dm-tree-toolbar'), 5000, 'the tools back in Hantera');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      for (const m of Array.from(document.querySelectorAll('.dm-menu'))) m.remove();
      for (const d of [a, b]) await svc.remove(d.id).catch(() => {});
      store.set({ selectedIds: [] });
      root.remove();
    }
  }, 40000);

  test('hantera: copy and paste make a copy of a folder with its datasets, cut and paste moves it, and Ny mapp and Byt namn work in place', async (assert) => {
    const list = D.require('ui/dataset-list');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const svc = shell.ctx.services.datasets;
    const store = shell.store;
    const a = await shell.ctx.services.importer.run(csv('Kopiedata'), {}, null, 'Kopiedata');
    const made = [a.id];
    const tool = (id) => /** @type {HTMLElement} */ (root.querySelector(`.dm-left [data-tool="${id}"] button`));
    const field = () => /** @type {any} */ (root.querySelector('.dm-left dm-input.dm-tree-edit'));
    const type = (el, value) => { el.value = value; el.control.dispatchEvent(new Event('input', { bubbles: true })); key(el.control, 'Enter'); };
    try {
      await svc.updateMeta(a.id, { folder: 'Kopiemapp' });
      store.set({ selectedIds: [], selectedId: null });
      shell.activate('hantera');
      (await waitFor(() => root.querySelector('.dm-left [data-folder-row="Kopiemapp"] input[type="checkbox"]'), 5000, 'the folder')).click();
      tool('copy').click();
      tool('paste').click();
      // The folder still chosen: the copy goes beside it, under a copy's name.
      const copy = await waitFor(() => store.get().datasets.find((d) => d.folder === t('datasets.tree.copy.name', { name: 'Kopiemapp' })), 8000, 'the copy');
      made.push(copy.id);
      assert.ok(copy.id !== a.id && copy.name === a.name, 'a dataset of its own with the same name');
      assert.deepEqual(await svc.query(copy.id), await svc.query(a.id), 'the same rows');
      assert.equal((await svc.get(a.id)).folder, 'Kopiemapp', 'the original stays');
      // Cut the copy's folder and paste it into the original folder.
      store.set({ selectedIds: [copy.id] });
      await waitFor(() => !/** @type {any} */ (tool('cut')).disabled, 3000, 'Klipp ut on');
      tool('cut').click();
      assert.deepEqual(list.clip.get(), { mode: 'cut', ids: [], folders: [copy.folder] });
      store.set({ selectedIds: [a.id] });
      await waitFor(() => !/** @type {any} */ (tool('paste')).disabled, 3000, 'Klistra in on');
      tool('paste').click();
      await waitFor(async () => (await svc.get(copy.id)).folder === 'Kopiemapp/' + copy.folder, 8000, 'moved into the original');
      await waitFor(() => list.clip.get() === null, 3000, 'the clipboard is empty after a cut is pasted');
      // Ny mapp at the root, named in place.
      store.set({ selectedIds: [], selectedId: null });
      await waitFor(() => !/** @type {any} */ (tool('newfolder')).disabled, 3000, 'Ny mapp on');
      tool('newfolder').click();
      type(await waitFor(field, 3000, 'the name field'), 'Provtom');
      await waitFor(() => root.querySelector('.dm-left [data-folder-row="Provtom"]'), 3000, 'the new folder');
      assert.ok(list.folders.list().includes('Provtom'), 'an empty folder is kept');
      // Byt namn on the folder: its datasets and subfolders follow.
      store.set({ selectedIds: [a.id, copy.id] });
      await waitFor(() => !/** @type {any} */ (tool('rename')).disabled, 3000, 'Byt namn on');
      tool('rename').click();
      type(await waitFor(field, 3000, 'the name field'), 'Kopiemapp 2');
      await waitFor(async () => (await svc.get(a.id)).folder === 'Kopiemapp 2' && (await svc.get(copy.id)).folder === 'Kopiemapp 2/' + copy.folder, 8000, 'renamed');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      for (const id of made) await svc.remove(id).catch(() => {});
      list.folders.removeUnder('Provtom');
      list.clip.set(null);
      store.set({ selectedIds: [] });
      root.remove();
    }
  }, 40000);
})();
