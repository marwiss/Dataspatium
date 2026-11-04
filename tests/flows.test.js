// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Click tests of the app's dialogs and flows: every action in the Bearbeta palette is opened and closed,
 * the tool dialogs of Bearbeta and Hantera, the chart builder in Visualisera, the sources in Inhämta, the
 * command palette, the help and the language chooser. Each dialog is checked with tests/a11y.js, closes with
 * its close button or Esc, and no error may reach the console or the window while it is open.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const a11y = D.require('tests/a11y');
  const t = D.require('ui/i18n').t;
  D.require('ui/components');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(40);
    }
  }
  const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]'));
  /** Close the topmost dialog with its close button (or Esc when it has none) and wait until it is gone. */
  async function closeTop(label) {
    const before = openDialogs().length;
    const top = openDialogs().pop();
    if (!top) return;
    const close = top.querySelector('.dm-dialog-head .dm-dialog-close button');
    if (close) /** @type {HTMLElement} */ (close).click();
    else top.dispatchEvent(new Event('cancel', { cancelable: true }));
    await waitFor(() => openDialogs().length < before, 3000, 'closing ' + label);
  }

  /** Errors that reach the window while a flow runs. */
  function captureErrors() {
    const errors = [];
    const onError = (e) => errors.push(String((e && e.message) || e));
    const onRejection = (e) => errors.push('unhandled: ' + String((e && e.reason && e.reason.message) || (e && e.reason) || e));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return { errors, stop: () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); } };
  }

  async function startApp() {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const shell = await D.require('app').start(root);
    const csv = 'kommun;kod;lan;befolkning;andel;datum;kontakt\n'
      + 'Stockholm;0180;Stockholms län (01);984748;9,37;2024-01-01;info@stockholm.se\n'
      + 'Göteborg;1480;Västra Götalands län (14);596841;5,68;2024-02-01;Ring 031-365 00 00\n'
      + 'Malmö;1280;Skåne län (12);362133;3,45;2024-03-01;\n';
    const meta = await shell.ctx.services.importer.run(new File([csv], 'flows.csv', { type: 'text/csv' }), {}, null, 'Klicktest');
    // A second dataset, so that joining and appending have something to work with.
    const other = await shell.ctx.services.importer.run(new File(['kod;region\n0180;Stockholm\n1480;Västra Götaland\n'], 'flows2.csv', { type: 'text/csv' }), {}, null, 'Klicktest regioner');
    await waitFor(() => [meta.id, other.id].every((id) => shell.store.get().datasets.some((d) => d.id === id)), 3000, 'datasets in store');
    // Value labels on one column, so that the operations that need them have a column to preview on.
    await D.require('data/recipes').apply(meta.id, 'set_value_labels', { column: 'kod', labels: '0180 = Stockholm\n1480 = Göteborg\n1280 = Malmö' });
    shell.store.set({ selectedId: meta.id });
    return { root, shell, meta, other };
  }
  async function cleanup(root, ...metas) {
    for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
    for (const m of metas) { try { await D.require('data/datasets').remove(m.id); } catch (_e) { /* already gone */ } }
    root.remove();
  }
  const toolbar = (root, label) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === label);
  const press = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();

  test('flows: every action in the Bearbeta palette opens, passes the accessibility checks and closes', async (assert) => {
    const { root, shell, meta, other } = await startApp();
    const capture = captureErrors();
    const problems = [];
    const previewErrors = [];
    const errorPrefix = t('op.preview.error', { message: '' }).trim();
    const GROUPS = D.require('ui/dialogs').GROUPS;
    let opened = 0;
    try {
      shell.activate('bearbeta');
      await waitFor(() => toolbar(root, t('bearbeta.actions')), 5000, 'actions button');
      for (const id of GROUPS.flatMap((g) => g.ops)) {
        press(toolbar(root, t('bearbeta.actions')));
        await waitFor(() => document.querySelector(`dialog .dm-op-tile[data-op="${id}"]`), 3000, 'palette for ' + id);
        /** @type {HTMLElement} */ (document.querySelector(`dialog .dm-op-tile[data-op="${id}"]`)).click();
        const dlg = await waitFor(() => openDialogs().find((d) => !d.querySelector('.dm-op-tile')), 5000, 'dialog of ' + id);
        opened++;
        // Past the preview's debounce (300 ms) and until it has settled, so the check is the same in every run.
        await wait(400);
        const preview = dlg.querySelector('.dm-op-preview');
        if (preview) await waitFor(() => preview.textContent.trim() !== t('common.loading'), 5000, 'preview settled for ' + id);
        for (const p of a11y.audit(dlg)) problems.push(`${id}: ${p.rule}: ${p.element}`);
        if (preview && errorPrefix && preview.textContent.trim().startsWith(errorPrefix)) previewErrors.push(`${id}: ${preview.textContent.trim()}`);
        while (openDialogs().length) await closeTop(id);
      }
      assert.deepEqual(problems, [], 'accessibility of the action dialogs');
      assert.deepEqual(previewErrors, [], 'previews without errors');
      assert.deepEqual(capture.errors, [], 'no errors');
      return opened + ' action dialogs';
    } finally {
      capture.stop();
      await cleanup(root, meta, other);
    }
  }, 180000);

  test('flows: tool dialogs, the chart builder, the sources, the command palette, help and language', async (assert) => {
    const { root, shell, meta, other } = await startApp();
    const capture = captureErrors();
    const problems = [];
    const seen = [];
    /** Open a dialog with `open`, check it and close it again. */
    async function dialog(label, open) {
      const before = openDialogs().length;
      await open();
      const dlg = await waitFor(() => openDialogs().length > before && openDialogs().pop(), 5000, label);
      await wait(300);
      for (const p of a11y.audit(dlg)) problems.push(`${label}: ${p.rule}: ${p.element}`);
      seen.push(label);
      while (openDialogs().length > before) await closeTop(label);
    }
    const area = (label) => { for (const p of a11y.audit(root)) problems.push(`${label}: ${p.rule}: ${p.element}`); seen.push(label); };
    try {
      // Bearbeta: data quality, rules, versions and recipe.
      shell.activate('bearbeta');
      await waitFor(() => toolbar(root, t('bearbeta.profile')), 5000, 'bearbeta toolbar');
      for (const key of ['bearbeta.profile', 'bearbeta.rules', 'bearbeta.versions', 'bearbeta.recipe']) await dialog(key, () => press(toolbar(root, t(key))));
      // Hantera: rename in the dataset view, then the workspace view with the share bundle.
      shell.activate('hantera');
      await waitFor(() => toolbar(root, t('common.rename')), 5000, 'hantera');
      await dialog('common.rename', () => press(toolbar(root, t('common.rename'))));
      // The comments tab with its form.
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('comments.title')))).click();
      await waitFor(() => toolbar(root, t('comments.add')), 5000, 'comments tab');
      area('hantera comments');
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-left button.dm-list-item')).find((b) => b.textContent.includes(t('datasets.storage.title')))).click();
      await waitFor(() => toolbar(root, t('datasets.backup')), 5000, 'workspace view');
      area('hantera workspace');
      // Dela: every tab, and the bundle dialog from Paket.
      shell.activate('dela');
      await waitFor(() => toolbar(root, t('bundle.create')), 5000, 'dela');
      for (const id of D.require('ui/modes/dela').TABS) {
        /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('dela.tabs.' + id)))).click();
        await wait(300);
        area('dela ' + id);
      }
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('dela.tabs.paket')))).click();
      await waitFor(() => toolbar(root, t('bundle.create')), 5000, 'dela paket');
      await dialog('bundle.create', () => press(toolbar(root, t('bundle.create'))));
      // Visualisera: the kind of chart, then the builder with its axis options open.
      shell.store.set({ selectedId: meta.id });
      shell.activate('visualisera');
      await waitFor(() => toolbar(root, t('viz.new')), 5000, 'visualisera');
      await dialog('viz.new', () => press(toolbar(root, t('viz.new'))));
      press(toolbar(root, t('viz.new')));
      /** @type {HTMLElement} */ (await waitFor(() => document.querySelector('dialog .dm-op-tile[data-kind="vega"]'), 3000, 'kind dialog')).click();
      await waitFor(() => root.querySelector('.dm-viz-controls'), 5000, 'builder');
      const axes = Array.from(root.querySelectorAll('.dm-viz-controls details summary')).find((s) => s.textContent === t('viz.axes'));
      if (axes) /** @type {HTMLElement} */ (axes).click();
      await wait(400);
      area('chart builder');
      // Inhämta: file, pasted text and web address (the API sources would call the network).
      shell.activate('inhamta');
      await wait(500);
      for (const key of ['import.sources.files', 'import.sources.paste', 'import.sources.url']) {
        const item = Array.from(root.querySelectorAll('.dm-left button.dm-list-item')).find((b) => b.textContent.includes(t(key)));
        assert.ok(item, 'source ' + key);
        /** @type {HTMLElement} */ (item).click();
        await wait(400);
        area('inhamta: ' + key);
      }
      // Shell: command palette (Ctrl+K), help and the language chooser.
      // The palette is opened with its button: on this test page earlier app instances also listen for Ctrl+K.
      await dialog('palette', () => press(toolbar(root, t('palette.open'))));
      await dialog('help', () => press(toolbar(root, t('shell.help'))));
      await dialog('language', () => press(toolbar(root, t('lang.title'))));
      assert.deepEqual(problems, [], 'accessibility');
      assert.deepEqual(capture.errors, [], 'no errors');
      return seen.length + ' dialogs and views';
    } finally {
      capture.stop();
      await cleanup(root, meta, other);
    }
  }, 120000);
})();
