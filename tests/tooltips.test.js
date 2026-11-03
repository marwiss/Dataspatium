// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of the shared tooltip: hover and focus, title conversion, Escape, dialogs, and the rule that every button without text has a name and a tooltip. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  D.require('ui/components');
  const tooltip = D.require('ui/tooltip');
  const basic = D.require('ui/basic');
  const { h } = D.require('ui/base');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tip = () => document.getElementById(tooltip.ID);
  const over = (el) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  const out = (el) => el.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body }));

  test('tooltips: an icon-only button shows its label after a hover delay, at once on focus, and hides on pointer out and Escape', async (assert) => {
    const host = h('div', null);
    document.body.appendChild(host);
    try {
      const btn = basic.button({ label: 'Spara allt', icon: 'save', 'icon-only': true });
      host.appendChild(btn);
      const inner = btn.querySelector('button');
      assert.equal(inner.getAttribute('data-tip'), 'Spara allt', 'label as tooltip text');
      assert.equal(inner.getAttribute('aria-label'), 'Spara allt', 'and as accessible name');
      assert.ok(!inner.hasAttribute('title'), 'no native title');
      over(inner);
      await wait(100);
      assert.ok(!tip() || tip().hidden, 'not yet shown after 100 ms');
      await wait(tooltip.HOVER_DELAY);
      assert.ok(tip() && !tip().hidden && tip().textContent === 'Spara allt', 'shown after the delay: ' + JSON.stringify({ exists: !!tip(), hidden: tip() && tip().hidden, text: tip() && tip().textContent, described: inner.getAttribute('aria-describedby') }));
      assert.equal(inner.getAttribute('aria-describedby'), tooltip.ID);
      out(inner);
      assert.ok(tip().hidden, 'hidden on pointer out');
      assert.ok(!inner.hasAttribute('aria-describedby'));
      inner.focus();
      inner.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      assert.ok(!tip().hidden, 'shown at once on focus');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.ok(tip().hidden, 'Escape hides');
      // A labelled button with an explicit title shows the title.
      const labelled = basic.button({ label: 'Kör', icon: 'play', title: 'Kör koden (Ctrl+Enter)' });
      host.appendChild(labelled);
      assert.equal(labelled.querySelector('button').getAttribute('data-tip'), 'Kör koden (Ctrl+Enter)');
      return 'ok';
    } finally { tooltip.hide(); host.remove(); }
  });

  test('tooltips: a plain element with a title gets data-tip (and an aria-label when it had no name); inside a dialog the tooltip renders in the dialog', async (assert) => {
    const host = h('div', null);
    document.body.appendChild(host);
    try {
      const plain = h('button', { type: 'button', title: 'Fäll ihop' });
      host.appendChild(plain);
      assert.equal(tooltip.textFor(plain), 'Fäll ihop');
      assert.ok(!plain.hasAttribute('title'), 'title removed');
      assert.equal(plain.getAttribute('data-tip'), 'Fäll ihop');
      assert.equal(plain.getAttribute('aria-label'), 'Fäll ihop', 'the title was the only name');
      const named = h('button', { type: 'button', title: 'Mer om detta', text: 'Hjälp' });
      host.appendChild(named);
      tooltip.textFor(named);
      assert.ok(!named.hasAttribute('aria-label'), 'a button with text keeps its text as the name');
      const dlg = /** @type {HTMLDialogElement} */ (h('dialog', null, h('button', { type: 'button', 'data-tip': 'I dialogen', text: 'x' })));
      document.body.appendChild(dlg);
      dlg.showModal();
      try {
        tooltip.show(dlg.querySelector('button'));
        assert.equal(tip().parentElement, dlg, 'tooltip lives in the open dialog');
        assert.equal(tip().textContent, 'I dialogen');
      } finally { tooltip.hide(); dlg.close(); dlg.remove(); }
      return 'ok';
    } finally { host.remove(); }
  });

  test('tooltips: in every mode, every button without visible text has an accessible name and a tooltip', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const meta = await shell.ctx.services.importer.run(new File(['a;b\n1;2\n'], 'tips.csv', { type: 'text/csv' }), {}, null, 'Tooltips');
    try {
      await wait(50);
      shell.store.set({ selectedId: meta.id });
      const problems = [];
      for (const mode of D.require('ui/shell').MODES) {
        shell.activate(mode);
        await wait(250);
        for (const b of Array.from(root.querySelectorAll('button'))) {
          if ((b.textContent || '').trim()) continue;
          if (!b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby')) problems.push(`${mode}: button without name (${b.className})`);
          if (!b.getAttribute('data-tip') && !b.getAttribute('title')) problems.push(`${mode}: button without tooltip (${b.className})`);
        }
      }
      assert.deepEqual(problems, []);
      return 'ok';
    } finally { await shell.ctx.services.datasets.remove(meta.id); root.remove(); }
  });
})();
