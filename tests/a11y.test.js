// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Accessibility tests: WCAG AA contrast of the design tokens in both themes, landmarks and the skip link,
 * accessible names and valid ARIA in every mode and tab, and dialogs that keep their own titles when two are
 * open at once. The checks are in tests/a11y.js.
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
      if (fn()) return;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }
  const report = (problems) => problems.map((p) => `${p.rule}: ${p.element}`);

  // Text needs 4.5:1 (WCAG 1.4.3); the borders of form fields and switches 3:1 (WCAG 1.4.11).
  const PAIRS = [
    ['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text', 'surface-2', 4.5], ['text', 'selection', 4.5],
    ['text-muted', 'bg', 4.5], ['text-muted', 'surface', 4.5], ['text-muted', 'surface-2', 4.5],
    ['text-faint', 'bg', 4.5], ['text-faint', 'surface', 4.5], ['text-faint', 'surface-2', 4.5],
    ['accent', 'surface', 4.5], ['accent', 'bg', 4.5], ['accent', 'accent-soft', 4.5], ['on-accent', 'accent', 4.5],
    ['ok', 'surface', 4.5], ['ok', 'ok-soft', 4.5], ['warn', 'surface', 4.5], ['warn', 'warn-soft', 4.5],
    ['error', 'surface', 4.5], ['error', 'error-soft', 4.5],
    ['border-input', 'surface', 3], ['border-input', 'bg', 3],
  ];

  test('a11y: text and form-field colours meet WCAG AA contrast in the light and the dark theme', async (assert) => {
    const root = document.documentElement;
    const before = root.getAttribute('data-theme');
    const fails = []; let checked = 0;
    try {
      for (const theme of ['light', 'dark']) {
        root.setAttribute('data-theme', theme);
        const cs = getComputedStyle(root);
        const v = (name) => cs.getPropertyValue('--dm-' + name).trim();
        for (const [fg, bg, need] of PAIRS) {
          assert.ok(v(fg) && v(bg), `${theme}: tokens ${fg} and ${bg} exist`);
          const ratio = a11y.contrast(v(fg), v(bg));
          checked++;
          if (ratio < need) fails.push(`${theme}: ${fg} on ${bg} ${ratio.toFixed(2)} < ${need}`);
        }
      }
    } finally { if (before) root.setAttribute('data-theme', before); else root.removeAttribute('data-theme'); }
    assert.deepEqual(fails, [], 'contrast');
    return checked + ' pairs';
  });

  test('a11y: landmarks, skip link and accessible names in all eight modes and their tabs', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const datasets = D.require('data/datasets');
    let meta = null;
    try {
      const shell = await D.require('app').start(root);
      const file = new File(['kommun;kod;befolkning;datum\nStockholm;0180;984748;2024-01-01\nGöteborg;1480;596841;2024-01-01\n'], 'a11y.csv', { type: 'text/csv' });
      meta = await shell.ctx.services.importer.run(file, {}, null, 'Tillgänglighet');
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      // Landmarks: banner, navigation, main and the two side panels, all named where there are several.
      assert.ok(root.querySelector('header.dm-topbar'), 'header');
      assert.ok(root.querySelector('nav[aria-label]'), 'named navigation for the modes');
      assert.equal(root.querySelectorAll('main').length, 1, 'one main');
      assert.equal(root.querySelectorAll('aside[aria-label]').length, 2, 'named side panels');
      // The skip link moves focus to the work area.
      const skip = /** @type {HTMLElement} */ (root.querySelector('a.dm-skip'));
      skip.click();
      assert.equal(document.activeElement, root.querySelector('main'), 'skip link focuses main');
      const problems = [];
      const check = (where) => { for (const p of a11y.audit(root)) problems.push(`${where}: ${p.rule}: ${p.element}`); };
      const tabs = () => Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]'));
      for (const mode of ['inhamta', 'hantera', 'bearbeta', 'analysera', 'visualisera', 'exportera']) {
        shell.activate(mode);
        await wait(600);
        check(mode);
        if (mode === 'analysera' || mode === 'exportera') {
          const count = tabs().length;
          for (let i = 1; i < count; i++) {
            /** @type {HTMLElement} */ (tabs()[i]).click();
            await wait(500);
            check(`${mode} tab ${i + 1}`);
          }
        }
      }
      assert.deepEqual(problems, [], 'no accessibility problems');
      // Keyboard: arrow keys and End move between the tabs of Analysera, and the focus follows the active tab
      // although the mode draws its tabs anew.
      shell.activate('analysera');
      await wait(400);
      /** @type {HTMLElement} */ (tabs()[0]).click();
      await wait(300);
      /** @type {HTMLElement} */ (tabs()[0]).focus();
      const key = (k) => /** @type {HTMLElement} */ (document.activeElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      key('ArrowRight');
      await wait(100);
      assert.equal(document.activeElement && document.activeElement.textContent.trim(), t('analysera.tabs.sql'), 'focus on the SQL tab');
      assert.equal(tabs()[1].getAttribute('aria-selected'), 'true', 'SQL tab active');
      key('End');
      await wait(100);
      assert.equal(document.activeElement && document.activeElement.textContent.trim(), t('analysera.tabs.notebook'), 'End goes to the last tab (the notebook is always last)');
      return 'eight modes';
    } finally {
      if (meta) await datasets.remove(meta.id);
      root.remove();
    }
  }, 60000);

  test('a11y: two dialogs open at once keep their own titles', async (assert) => {
    const overlays = D.require('ui/overlays');
    const first = overlays.dialog.open({ title: 'Första dialogen', body: 'a' });
    const second = overlays.dialog.open({ title: 'Andra dialogen', body: 'b' });
    await wait(50);
    const dialogs = Array.from(document.querySelectorAll('dialog.dm-dialog'));
    try {
      assert.deepEqual(dialogs.map((d) => a11y.nameOf(d)), ['Första dialogen', 'Andra dialogen']);
      assert.deepEqual(report(a11y.audit(document.body).filter((p) => p.el.closest('dialog'))), []);
    } finally {
      for (const d of dialogs.reverse()) /** @type {HTMLElement} */ (d.querySelector('.dm-dialog-head dm-button button')).click();
    }
    await Promise.all([first, second]);
    assert.equal(document.querySelectorAll('dialog.dm-dialog').length, 0, 'both closed');
    return 'ok';
  });
})();
