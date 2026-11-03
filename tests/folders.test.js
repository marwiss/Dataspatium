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
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
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
      /** @type {HTMLElement} */ (folders[0]).click();
      assert.equal(container.querySelectorAll('.dm-tree-row').length, 1, 'collapsing X hides a and b');
      assert.equal(container.querySelector('.dm-tree-folder').getAttribute('aria-expanded'), 'false');
      /** @type {HTMLElement} */ (container.querySelector('.dm-tree-folder')).click();
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
})();
