// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of Kontrollera: the mode in the switcher, a table tried against the rules (type and empty values per column,
 * duplicate rows) with the finding in the inspector, a large table that waits for the button, and a model's checks.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  /** The app in a hidden root, as the other mode tests start it. */
  async function startShell() {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    return { root, shell };
  }
  const stop = (root) => { history.replaceState(null, '', location.pathname + location.search); root.remove(); };
  const press = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();

  test('kontrollera: the mode is fifth in the switcher, reached by Alt+5, the palette and a link, and draws the three slots', async (assert) => {
    const { root, shell } = await startShell();
    try {
      const MODES = D.require('ui/shell').MODES;
      assert.deepEqual(MODES, ['inhamta', 'hantera', 'soka', 'bearbeta', 'kontrollera', 'analysera', 'visualisera', 'exportera', 'dela']);
      assert.deepEqual(Array.from(root.querySelectorAll('.dm-mode-btn')).map((b) => b.getAttribute('data-mode')), MODES, 'the switcher follows the order');
      assert.ok(shell.modes.get('kontrollera'), 'registered');
      assert.equal(root.querySelector('.dm-mode-btn[data-mode="kontrollera"]').textContent.trim(), t('mode.kontrollera'));
      shell.activate('kontrollera');
      assert.equal(shell.store.get().mode, 'kontrollera');
      assert.equal(location.hash, '#/kontrollera');
      assert.equal(root.querySelector('aside.dm-left').getAttribute('aria-label'), t('shell.datasets'), 'the object panel is headed Datamängder');
      assert.ok(root.querySelector('.dm-left .dm-pane-body'), 'the object panel');
      const empty = root.querySelector('.dm-center dm-empty-state');
      assert.ok(empty && empty.textContent.includes(t('kontrollera.empty')), 'the empty state in the work area');
      assert.ok(root.querySelector('.dm-right .dm-help'), 'a hint in the inspector');
      // Alt+5, the palette and a deep link reach the mode as well.
      shell.activate('hantera');
      shell.onKey(new KeyboardEvent('keydown', { key: '5', altKey: true, cancelable: true }));
      assert.equal(shell.store.get().mode, 'kontrollera', 'Alt+5');
      assert.ok(shell.builtinCommands().some((c) => c.id === 'mode:kontrollera'), 'in the palette');
      assert.ok(shell.link('kontrollera', 'x').endsWith('#/kontrollera/x'), 'the link');
      return 'ok';
    } finally { stop(root); }
  });

  test('kontrollera: a table is tried against the rules, type and empty values per column and duplicate rows, and the inspector shows the finding', async (assert) => {
    const { root, shell } = await startShell();
    let meta = null;
    try {
      meta = await datasets.create({
        name: 'Kontroll tabell', columns: [{ name: 'kommun', type: 'text' }, { name: 'kod', type: 'text' }, { name: 'antal', type: 'integer' }],
        rows: [['Stockholm', '0180', 10], ['Göteborg', '', 20], ['Stockholm', '0180', 10], ['Malmö', '1280', null], ['Uppsala', '  ', 30]],
      });
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('kontrollera');
      // A small table is checked as soon as it is chosen.
      const summary = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-summary]'), 8000, 'the summary');
      assert.equal(summary.getAttribute('data-kontrollera-rows'), '5');
      assert.equal(summary.getAttribute('data-kontrollera-duplicates'), '1', 'one row is a copy of another');
      assert.equal(summary.getAttribute('data-kontrollera-empty'), '3', 'an empty text, a blank text and a null');
      const table = root.querySelector('.dm-center dm-table[data-kontrollera-rules]');
      await waitFor(() => table.querySelectorAll('.dm-tr').length === 3, 5000, 'one row per column');
      // The cells of each row, without the row number that dm-table draws first.
      const rows = Array.from(table.querySelectorAll('.dm-tr')).map((tr) => Array.from(tr.querySelectorAll('[role="gridcell"]')).map((td) => td.textContent));
      assert.deepEqual(rows, [['kommun', t('type.text'), '0'], ['kod', t('type.text'), '2'], ['antal', t('type.integer'), '1']], JSON.stringify(rows));
      // The inspector shows the table's duplicates until a row is chosen, then the column's empty values with their share.
      assert.ok(root.querySelector('.dm-right [data-kontrollera-finding=""]'), 'the whole table first');
      assert.ok(root.querySelector('.dm-right').textContent.includes(t('kontrollera.rule.duplicates')), 'the duplicates rule');
      /** @type {HTMLElement} */ (table.querySelectorAll('.dm-tr')[1]).click();
      await waitFor(() => root.querySelector('.dm-right [data-kontrollera-finding="kod"]'), 3000, 'the column kod in the inspector');
      const right = root.querySelector('.dm-right').textContent;
      assert.ok(right.includes(t('kontrollera.rule.empty')) && right.includes('40'), 'the rule and the share, 2 of 5 rows: ' + right);
      // The button runs the check again.
      press(root.querySelector('.dm-center [data-kontrollera-run]'));
      await waitFor(() => { const s = root.querySelector('.dm-center [data-kontrollera-summary]'); return s && s !== summary; }, 8000, 'checked again');
      assert.equal(root.querySelector('.dm-center [data-kontrollera-summary]').getAttribute('data-kontrollera-duplicates'), '1');
      // The link #/kontrollera/<short name> chooses the dataset.
      shell.store.set({ selectedId: null });
      await shell.openRoute({ mode: 'kontrollera', object: meta.shortName });
      assert.equal(shell.store.get().selectedId, meta.id, 'the link chooses the dataset');
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id); stop(root); }
  });

  test('kontrollera: a large table waits for the button', async (assert) => {
    const { root, shell } = await startShell();
    let meta = null;
    try {
      const rows = [];
      for (let i = 0; i < 10000; i++) rows.push([i, i % 2 ? 'a' : 'b']);
      meta = await datasets.create({ name: 'Kontroll stor', columns: [{ name: 'nr', type: 'integer' }, { name: 'grupp', type: 'text' }], rows });
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id && d.rowCount === 10000), 5000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('kontrollera');
      const waiting = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-waiting]'), 5000, 'the hint');
      assert.ok(waiting.textContent.includes(t('kontrollera.run')), 'tells about the button: ' + waiting.textContent);
      await wait(500);
      assert.ok(!root.querySelector('.dm-center [data-kontrollera-summary]'), 'not checked by itself');
      press(root.querySelector('.dm-center [data-kontrollera-run]'));
      const summary = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-summary]'), 15000, 'the summary');
      assert.equal(summary.getAttribute('data-kontrollera-rows'), '10000');
      assert.equal(summary.getAttribute('data-kontrollera-duplicates'), '0');
      assert.equal(summary.getAttribute('data-kontrollera-empty'), '0');
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id); stop(root); }
  });

  test('kontrollera: an IFC model shows its checks, the validation card and the version comparison, and a collection has none yet', async (assert) => {
    const { root, shell } = await startShell();
    const fixtures = D.require('tests/fixtures/ifc');
    const importer = D.require('io/import');
    let model = null; let doc = null;
    try {
      model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Kontroll modell');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 5000, 'model in store');
      shell.store.set({ selectedId: model.id });
      shell.activate('kontrollera');
      const box = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-model]'), 8000, 'the model checks');
      assert.ok(box.querySelector('[data-card="validation"]'), 'the card Validera modellen, reused from Hantera');
      assert.ok(box.querySelector('[data-validation-local]') && box.querySelector('[data-validation-ids]') && box.querySelector('[data-validation-clash]'), 'the schema, IDS and clash checks reachable from the card');
      assert.ok(box.querySelector('[data-compare-panel]'), 'the panel Jämför versioner, reused from Bearbeta');
      await waitFor(() => box.querySelector('[data-compare-with]') || box.querySelector('[data-compare-none]'), 5000, 'the comparison loaded its choices');
      assert.ok(root.querySelector('.dm-right .dm-help'), 'a hint in the inspector');
      // The clash check is linked: its button opens the tool in Analysera.
      press(box.querySelector('[data-validation-clash]'));
      await waitFor(() => shell.store.get().mode === 'analysera', 3000, 'Analysera opened');
      // A document collection has no checks yet.
      doc = await datasets.create({ name: 'Kontroll dokument', kind: 'document', columns: [{ name: 'text', type: 'text' }], rows: [['x']] });
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === doc.id), 3000, 'document in store');
      shell.store.set({ selectedId: doc.id });
      shell.activate('kontrollera');
      await waitFor(() => root.querySelector('.dm-center [data-kontrollera-none]'), 5000, 'no checks for the kind');
      return 'ok';
    } finally { for (const m of [model, doc]) if (m) await datasets.remove(m.id); stop(root); }
  }, 60000);
})();
