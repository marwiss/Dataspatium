// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for help inside the app: the embedded handbook, search, links between documents, the ? button of dialogs and F1. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  test('help: the handbook loads with sections and slugs, searches, and finds a Swedish section in English', async (assert) => {
    const help = D.require('ui/help');
    assert.equal(help.slug('Granskning före delning'), 'granskning-före-delning');
    assert.equal(help.slug('R, SQL & regex: tips!'), 'r-sql-regex-tips');
    assert.deepEqual(help.parseRef('dela#enheter'), { doc: 'dela', section: 'enheter' });
    const c = help.compile('# Rubrik\n\nText med `kod` och [länk](soka.md#listor).\n\n```r\nx <- 1\n```\n\n![Bild](images/x.png)\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n## Del två\n\nMer text.\n');
    assert.deepEqual(c.blocks.map((b) => b.type), ['heading', 'paragraph', 'code', 'image', 'table', 'heading', 'paragraph'], c.blocks.map((b) => b.type).join(','));
    assert.equal(c.title, 'Rubrik');
    assert.equal(c.blocks[2].text, 'x <- 1');
    assert.deepEqual(c.sections.map((s) => s.slug), ['rubrik', 'del-två']);
    assert.ok(c.sections[0].text.includes('kod') && c.sections[0].text.includes('x <- 1'), 'section text for search');
    const sv = await help.load('sv');
    assert.equal(sv.docs.length, help.DOCS.length);
    for (const d of sv.docs) { assert.ok(d.title && d.title !== d.id, 'title of ' + d.id); assert.ok(d.sections.length > 1, 'sections of ' + d.id); }
    assert.ok(sv.byId.get('dela').sections.some((s) => s.slug === 'enheter'), 'dela has Enheter');
    const hits = help.search(sv, 'QR');
    assert.ok(hits.length > 0, 'QR is found');
    assert.ok(hits.every((x) => (x.section.title + ' ' + x.section.text).toLowerCase().includes('qr')), 'every hit contains the word');
    assert.equal(help.search(sv, 'xyzzyqwv').length, 0);
    const en = await help.load('en');
    assert.equal(en.docs.length, help.DOCS.length);
    const enSection = await help.resolveSection(en, 'dela', 'enheter');
    assert.ok(enSection, 'Swedish slug resolves in English');
    assert.ok(en.byId.get('dela').sections.some((s) => s.slug === enSection), 'to an English heading: ' + enSection);
    assert.equal(await help.resolveSection(sv, 'dela', 'finns-inte'), null);
    return 'ok';
  }, 20000);

  test('help: the panel opens at a section, searches, follows links, and is reachable from dialogs, the palette and F1', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const help = D.require('ui/help');
    const overlays = D.require('ui/overlays');
    const { h } = D.require('ui/base');
    const closeAll = () => { for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close(); };
    try {
      shell.activate('bearbeta');
      const panel = await help.open({ doc: 'dela', section: 'enheter' });
      const dlg = /** @type {HTMLDialogElement} */ (panel.el.closest('dialog'));
      assert.ok(dlg && dlg.open, 'dialog open');
      assert.equal(panel.state.doc, 'dela'); assert.equal(panel.state.section, 'enheter');
      assert.equal(panel.el.querySelectorAll('.dm-help-nav .dm-list-item').length, help.DOCS.length, 'contents list');
      assert.ok(panel.el.querySelector('.dm-help-content [data-section="enheter"]'), 'heading in content');
      assert.ok(panel.el.querySelector('.dm-help-nav .dm-list-item[aria-current="true"]'), 'current document marked');
      // Search lists hits; a hit opens its section.
      panel.search('QR');
      const hit = /** @type {HTMLElement} */ (panel.el.querySelector('.dm-help-hit'));
      assert.ok(hit, 'hits listed');
      assert.ok(panel.el.textContent.includes(t('help.hits', { n: panel.state.hits.length })), 'hit count shown');
      hit.click();
      await waitFor(() => panel.state.doc && panel.state.section, 2000, 'hit opened');
      // A link to another document opens it in the panel; external links open in a new tab.
      await panel.show('lagen');
      const link = /** @type {HTMLElement} */ (panel.el.querySelector('.dm-help-content a[data-doc]'));
      assert.ok(link, 'lagen links to other documents');
      const targetDoc = link.getAttribute('data-doc');
      link.click();
      await waitFor(() => panel.state.doc === targetDoc, 2000, 'link followed');
      await panel.show('licenser');
      const ext = Array.from(panel.el.querySelectorAll('.dm-help-content a')).find((a) => /^https?:/.test(a.getAttribute('href') || ''));
      assert.ok(ext && ext.getAttribute('target') === '_blank' && ext.getAttribute('rel') === 'noopener', 'external link in a new tab');
      // A second open navigates the same panel.
      const again = await help.open({ doc: 'soka' });
      assert.ok(again === panel && panel.state.doc === 'soka', 'same panel');
      panel.close();
      await waitFor(() => !help.current(), 2000, 'panel closed');
      // A dialog with help: 'doc#section' has a ? button that opens the section.
      const dlgDone = overlays.dialog.open({ title: 'Test', body: h('p', { text: 'x' }), help: 'dela#enheter' });
      const btn = await waitFor(() => Array.from(document.querySelectorAll('dialog[open] .dm-dialog-head dm-button')).find((b) => b.getAttribute('label') === t('help.open')), 2000, '? button');
      /** @type {HTMLElement} */ (btn.querySelector('button')).click();
      const p2 = await waitFor(() => help.current(), 3000, 'help from the dialog');
      await waitFor(() => p2.state.doc === 'dela' && p2.state.section === 'enheter', 3000, 'right section');
      p2.close();
      await waitFor(() => !help.current(), 2000, 'closed again');
      closeAll(); await dlgDone;
      // F1 opens the chapter of the active mode.
      shell.onKey(new KeyboardEvent('keydown', { key: 'F1', cancelable: true }));
      const p3 = await waitFor(() => help.current(), 3000, 'F1');
      await waitFor(() => p3.state.doc === 'bearbeta', 3000, 'Bearbeta chapter');
      p3.close();
      await waitFor(() => !help.current(), 2000, 'closed after F1');
      // Modes without a document of their own open the chapter of lagen.md that carries their name.
      shell.activate('exportera');
      const p4 = await shell.showHelp();
      assert.equal(p4.state.doc, 'lagen'); assert.ok(p4.state.section, 'chapter found: ' + p4.state.section);
      p4.close();
      await waitFor(() => !help.current(), 2000, 'closed after Exportera');
      // The palette lists the handbook's documents.
      const cmds = await help.commands();
      assert.equal(cmds.length, help.DOCS.length);
      assert.ok(cmds.every((c) => c.id.startsWith('help:') && c.label && typeof c.run === 'function'), 'palette commands');
      return 'ok';
    } finally {
      closeAll();
      shell.activate('hantera');
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 40000);
})();
