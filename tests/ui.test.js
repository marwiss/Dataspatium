// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the component library and the application shell (end-to-end in the DOM). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  D.require('ui/components'); // registers every dm-* element

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      if (fn()) return;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  test('i18n: Swedish strings and formatting', (assert) => {
    assert.equal(t('mode.inhamta'), 'Inhämta');
    assert.equal(t('common.rows', { n: 3 }), '3 rader');
    assert.equal(t('missing.key.x'), 'missing.key.x');
    assert.equal(i18n.formatNumber(1234567.891, { maximumFractionDigits: 1 }).replace(/ /g, ' '), '1 234 567,9');
    assert.equal(i18n.formatBytes(1536).replace(/ /g, ' '), '1,5 kB');
    assert.equal(i18n.formatDateTime('2026-11-02T17:45:00'), '2026-11-02 17:45');
  });

  test('components: button, input, select, switch, table', async (assert) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; width:800px; height:400px;';
    document.body.appendChild(host);
    try {
      let clicks = 0;
      const btn = D.require('ui/basic').button({ label: 'Spara', icon: 'save', variant: 'primary', onClick: () => clicks++ });
      host.appendChild(btn);
      btn.querySelector('button').click();
      assert.equal(clicks, 1);
      assert.equal(btn.querySelector('button').textContent.trim(), 'Spara');
      const input = document.createElement('dm-input'); input.setAttribute('label', 'Namn'); host.appendChild(input);
      input.value = 'abc'; assert.equal(input.value, 'abc');
      const select = document.createElement('dm-select'); host.appendChild(select);
      select.options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]; select.value = 'b';
      assert.equal(select.value, 'b');
      const sw = document.createElement('dm-switch'); sw.setAttribute('label', 'På'); host.appendChild(sw);
      sw.checked = true; assert.equal(sw.checked, true);
      const table = document.createElement('dm-table');
      table.style.height = '300px';
      host.appendChild(table);
      const rows = Array.from({ length: 5000 }, (_, i) => [i + 1, 'rad ' + i, i * 1.5]);
      let calls = 0;
      table.setData({ columns: [{ key: 'id', label: 'Id', type: 'integer' }, { key: 'namn', label: 'Namn', type: 'text' }, { key: 'v', label: 'Värde', type: 'number' }], rowCount: rows.length, rowProvider: async (start, count) => { calls++; return rows.slice(start, start + count); } });
      await waitFor(() => table.querySelectorAll('.dm-tr').length > 5, 8000, 'table rows');
      const drawn = table.querySelectorAll('.dm-tr').length;
      assert.ok(drawn < 100, 'virtualised: drawn ' + drawn + ' of 5000');
      assert.equal(calls, 1, 'one block fetched');
      assert.equal(table.querySelector('.dm-tr .dm-td:nth-child(3)').textContent, 'rad 0');
      table.scroller.scrollTop = 30 * 4000;
      table.render();
      await waitFor(() => table.querySelector('.dm-tr[style*="120000px"]'), 8000, 'scrolled rows');
      assert.ok(calls >= 2, 'second block fetched after scroll');
      return `drawn ${drawn} rows, ${calls} block fetches`;
    } finally { host.remove(); }
  }, 20000);

  test('components: dm-code editor loads CodeMirror 5 with the R mode and runs on Ctrl+Enter', async (assert) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; width:600px;';
    document.body.appendChild(host);
    try {
      const editor = document.createElement('dm-code');
      editor.setAttribute('language', 'r');
      host.appendChild(editor);
      await new Promise((resolve, reject) => { editor.addEventListener('dm-ready', resolve, { once: true }); setTimeout(() => reject(new Error('editor did not load')), 10000); });
      editor.value = 'x <- c(1, 2)\nsum(x)';
      assert.equal(editor.value, 'x <- c(1, 2)\nsum(x)');
      assert.ok(host.querySelector('.CodeMirror'), 'CodeMirror element');
      assert.ok(host.querySelector('.cm-keyword, .cm-number'), 'syntax highlighting tokens');
      let ran = null;
      editor.addEventListener('dm-run', (e) => { ran = e.detail; });
      editor.cm.getOption('extraKeys')['Ctrl-Enter'](editor.cm);
      assert.ok(ran && ran.code.startsWith('x <- c'), 'dm-run fired');
      return 'CodeMirror ' + globalThis.CodeMirror.version;
    } finally { host.remove(); }
  }, 20000);

  test('app: shell renders eight modes, imports a dataset and shows it in the table', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    try {
      history.replaceState(null, '', location.pathname + location.search); // earlier tests may have left a #/mode hash
      const shell = await D.require('app').start(root);
      assert.equal(root.querySelectorAll('.dm-mode-btn').length, 8);
      assert.equal(shell.store.get().mode, 'inhamta');
      assert.ok(root.querySelector('dm-dropzone'), 'dropzone in Inhämta');
      const file = new File(['kommun;befolkning;andel\nStockholm;984748;9,37\nGöteborg;596841;5,68\n'], 'test.csv', { type: 'text/csv' });
      meta = await shell.ctx.services.importer.run(file, {}, null, 'UI-test');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('dm-table .dm-tr'), 5000, 'table rows in Bearbeta');
      assert.equal(root.querySelectorAll('dm-table .dm-tr').length, 2);
      assert.equal(root.querySelector('dm-table .dm-tr .dm-td:nth-child(2)').textContent, 'Stockholm');
      shell.activate('hantera');
      await waitFor(() => root.querySelector('dm-tabs'), 3000, 'dataset tabs in Hantera');
      shell.activate('exportera');
      await waitFor(() => root.querySelector('dm-select'), 3000, 'export form');
      shell.activate('analysera');
      // Opens in the dataset's own tool; the R console is one tab away.
      await waitFor(() => root.querySelector('dm-tabs [role="tab"]'), 3000, 'the first tab');
      /** @type {HTMLElement} */ (root.querySelector('dm-tabs [role="tab"]')).click();
      await waitFor(() => root.querySelector('dm-code') && root.querySelector('.dm-console'), 5000, 'R console in Analysera');
      shell.activate('visualisera');
      await waitFor(() => root.querySelector('dm-empty-state, .dm-gallery'), 5000, 'visualisera gallery');
      assert.ok(root.querySelector('.dm-log li'), 'log has entries');
      return 'ok';
    } finally {
      if (meta) await D.require('data/datasets').remove(meta.id);
      root.remove();
    }
  }, 60000);

  test('app: the language chooser saves the clicked language and reloads; cancelling or keeping it does not', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const before = i18n.language();
    const option = (code) => document.querySelector(`dialog.dm-dialog .dm-list-item[lang="${code}"]`);
    const actionButton = () => document.querySelector('dialog.dm-dialog .dm-dialog-actions dm-button button');
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      let reloads = 0;
      shell.reload = () => { reloads++; };
      // The ordinary chooser: clicking Danish saves it and reloads the page.
      let pending = shell.chooseLanguage();
      await waitFor(() => option('da'), 3000, 'language list');
      option('da').click();
      assert.equal(await pending, 'da');
      assert.equal(reloads, 1, 'page reloaded');
      assert.equal(localStorage.getItem(i18n.KEY), 'da', 'choice saved');
      assert.ok(!document.querySelector('dialog.dm-dialog'), 'dialog closed');
      i18n.setLanguage(before);
      // Cancel changes nothing.
      pending = shell.chooseLanguage();
      await waitFor(actionButton, 3000, 'cancel button');
      actionButton().click();
      assert.equal(await pending, null);
      assert.equal(reloads, 1, 'no reload after cancel');
      // The first start: another language reloads, keeping the proposed one only records the choice.
      pending = shell.chooseLanguage({ required: true });
      await waitFor(() => option('nb'), 3000, 'first-start list');
      option('nb').click();
      assert.equal(await pending, 'nb');
      assert.equal(reloads, 2, 'reloaded for Norwegian');
      i18n.setLanguage(before);
      pending = shell.chooseLanguage({ required: true });
      await waitFor(actionButton, 3000, 'keep button');
      actionButton().click();
      assert.equal(await pending, before);
      assert.equal(reloads, 2, 'keeping the language does not reload');
      assert.equal(localStorage.getItem(i18n.KEY), before);
      // A ?lang= parameter would win over the new choice at the reload, so the reload drops it.
      const strip = D.require('ui/shell').withoutLangParam;
      assert.equal(strip('file:///C:/app/index.html?lang=en#/inhamta'), 'file:///C:/app/index.html#/inhamta');
      assert.equal(strip('file:///C:/app/index.html?course=off&lang=da'), 'file:///C:/app/index.html?course=off');
      assert.equal(strip('file:///C:/app/index.html#/hantera'), null);
      return 'ok';
    } finally {
      i18n.setLanguage(before);
      for (const dlg of Array.from(document.querySelectorAll('dialog.dm-dialog'))) dlg.remove();
      root.remove();
    }
  }, 30000);

  test('app: cell editing with undo, operations palette and the SQL console', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const datasets = D.require('data/datasets');
    const recipes = D.require('data/recipes');
    let meta = null;
    const toolbarButton = (label) => Array.from(root.querySelectorAll('.dm-page-head dm-button')).find((b) => b.getAttribute('label') === label);
    try {
      const shell = await D.require('app').start(root);
      const file = new File(['kommun;befolkning;andel\nStockholm;984748;9,37\nGöteborg;596841;5,68\nMalmö;362133;3,45\n'], 'edit.csv', { type: 'text/csv' });
      meta = await shell.ctx.services.importer.run(file, {}, null, 'Redigeringstest');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('dm-table .dm-tr'), 5000, 'table rows');
      const table = /** @type {any} */ (root.querySelector('dm-table'));
      assert.ok(table.editable, 'table is editable');
      // Edit a cell: double-click, type, Enter.
      root.querySelector('dm-table .dm-tr .dm-td:nth-child(2)').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = /** @type {HTMLInputElement} */ (root.querySelector('dm-table .dm-cell-editor'));
      assert.ok(input, 'inline editor opened');
      input.value = 'Stockholms stad';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      let rows = [];
      for (let i = 0; i < 50; i++) { rows = await datasets.query(meta.id, { limit: 1 }); if (rows[0][0] === 'Stockholms stad') break; await wait(100); }
      assert.equal(rows[0][0], 'Stockholms stad', 'edit written to SQLite');
      await waitFor(() => { const cell = root.querySelector('dm-table .dm-tr .dm-td:nth-child(2)'); return !!cell && cell.textContent === 'Stockholms stad'; }, 5000, 'cell redrawn');
      assert.ok(recipes.canUndo(meta.id), 'undo available');
      const undoBtn = toolbarButton(t('common.undo'));
      assert.ok(undoBtn && !undoBtn.disabled, 'undo button enabled');
      undoBtn.querySelector('button').click();
      for (let i = 0; i < 50; i++) { rows = await datasets.query(meta.id, { limit: 1 }); if (rows[0][0] === 'Stockholm') break; await wait(100); }
      assert.equal(rows[0][0], 'Stockholm', 'undo restored the value');
      assert.ok((await recipes.steps(meta.id)).every((s) => s.op !== 'undo'), 'undo is not a recipe step');
      // Operations palette opens, a tile opens the operation dialog with a preview.
      toolbarButton(t('bearbeta.actions')).querySelector('button').click();
      await waitFor(() => document.querySelector('dialog .dm-op-tile'), 3000, 'palette dialog');
      const tiles = document.querySelectorAll('dialog .dm-op-tile').length;
      assert.ok(tiles >= 20, 'palette lists operations: ' + tiles);
      /** @type {HTMLElement} */ (document.querySelector('dialog .dm-op-tile[data-op="trim"]')).click();
      await waitFor(() => document.querySelector('dialog dm-switch'), 3000, 'trim dialog with column switches');
      /** @type {HTMLElement} */ (document.querySelector('dialog .dm-dialog-actions dm-button button')).click();
      await waitFor(() => !document.querySelector('dialog'), 3000, 'dialog closed');
      // SQL console: SELECT shows rows, UPDATE becomes a recipe step.
      shell.activate('analysera');
      await waitFor(() => root.querySelector('dm-tabs').querySelectorAll('[role="tab"]').length === 6, 5000, 'analysera tabs (R, Python, SQL, Regex, Statistik, Anteckningsbok)');
      /** @type {HTMLElement} */ (root.querySelector('dm-tabs').querySelectorAll('[role="tab"]')[2]).click();
      await waitFor(() => root.querySelector('dm-code[language="sql"]'), 3000, 'sql editor');
      const sqlEditor = /** @type {any} */ (root.querySelector('dm-code[language="sql"]'));
      await new Promise((resolve, reject) => { if (sqlEditor.cm) return resolve(undefined); sqlEditor.addEventListener('dm-ready', resolve, { once: true }); setTimeout(() => reject(new Error('sql editor did not load')), 10000); });
      sqlEditor.value = 'select kommun, befolkning from data order by befolkning desc';
      toolbarButton(t('sql.run')).querySelector('button').click();
      await waitFor(() => root.querySelector('.dm-sql-result dm-table .dm-tr'), 5000, 'sql result rows');
      assert.equal(root.querySelectorAll('.dm-sql-result dm-table .dm-tr').length, 3);
      assert.equal(root.querySelector('.dm-sql-result dm-table .dm-tr .dm-td:nth-child(2)').textContent, 'Stockholm');
      sqlEditor.value = "update data set andel = 0 where kommun = 'Malmö'";
      toolbarButton(t('sql.run')).querySelector('button').click();
      await waitFor(() => root.querySelector('.dm-sql-result .dm-console-dataset'), 5000, 'sql mutation message');
      assert.ok((await recipes.steps(meta.id)).some((s) => s.op === 'sql'), 'sql step logged');
      assert.equal((await datasets.query(meta.id, { limit: 1, offset: 2 }))[0][2], 0, 'update applied');
      return `${tiles} operations in palette`;
    } finally {
      for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
      if (meta) await datasets.remove(meta.id);
      root.remove();
    }
  }, 60000);
})();
