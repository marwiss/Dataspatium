// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the left column of Inhämta (2.3.0): four groups, SCB's and Boverket's open APIs among the added sources from the
 * start, a removed preset going back to the catalogue of open APIs and coming back from it, a source of the user's own deleted,
 * a bridge database remembered and forgotten, and the pane head that names the mode instead of saying Objekt.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const connectors = D.require('api/connectors');
  const bridge = D.require('api/bridge');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  const paneHead = (root) => root.querySelector('.dm-left .dm-pane-head span');
  const okButton = (dlg) => /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button')).pop().querySelector('button'));

  test('sources: four groups in the left column, SCB and Boverket added from the start, and the pane head names the mode', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      await waitFor(() => pane.querySelector('[data-added^="api:"]'), 5000, 'the added sources');
      assert.deepEqual(Array.from(pane.querySelectorAll('.dm-pane-body h4')).map((h) => h.textContent), [t('import.sources.common'), t('import.sources.addgroup'), t('import.sources.added'), t('import.sources.other')]);
      assert.equal(paneHead(root).textContent, t('import.sources'), 'the pane head says Källor, not Objekt');
      assert.equal(root.querySelector('.dm-left').getAttribute('aria-label'), t('import.sources'));
      assert.equal(pane.querySelectorAll('[data-add-sources] .dm-list-item').length, 7, 'seven ways to add a source');
      assert.deepEqual(Array.from(pane.querySelectorAll('[data-add-source]')).map((b) => b.getAttribute('data-add-source')), ['file', 'family', 'opencde', 'neo4j', 'geodata']);
      const added = Array.from(pane.querySelectorAll('[data-added]')).map((e) => e.getAttribute('data-added'));
      for (const id of connectors.DEFAULT_ADDED) assert.ok(added.includes('api:' + id), 'added from the start: ' + id);
      const all = await connectors.list();
      const other = all.find((c) => c.preset && !connectors.DEFAULT_ADDED.includes(c.id));
      assert.ok(other && !added.includes('api:' + other.id), 'the other presets wait in the catalogue: ' + (other && other.id));
      assert.ok(!Array.from(pane.querySelectorAll('dm-button')).some((b) => !b.closest('[data-added]')), 'no separate add button: the only buttons in the column take an added source out');
      shell.activate('hantera');
      await wait(50);
      assert.equal(paneHead(root).textContent, t('shell.datasets'), 'Hantera: Datamängder in the pane head');
      assert.ok(!Array.from(root.querySelectorAll('.dm-left .dm-pane-body h4')).some((h) => h.textContent === t('shell.datasets')), 'no duplicate heading in the panel');
      shell.activate('bearbeta');
      await wait(50);
      assert.equal(paneHead(root).textContent, t('shell.datasets'));
    });
    return 'ok';
  }, 30000);

  test('sources: a removed preset goes back to the catalogue of open APIs and can be added again; a source of the user\'s own is deleted', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      await waitFor(() => pane.querySelector('[data-added="api:scb-pxweb"]'), 5000, 'SCB among the added');
      /** @type {HTMLElement} */ (pane.querySelector('[data-remove-source="api:scb-pxweb"] button')).click();
      let dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the confirmation');
      assert.ok(dlg.textContent.includes(t('import.sources.remove.preset.confirm', { name: 'SCB Statistikdatabasen' })), 'the text says it goes back to the catalogue');
      okButton(dlg).click();
      await waitFor(() => !pane.querySelector('[data-added="api:scb-pxweb"]'), 5000, 'gone from the added');
      assert.ok(!(await connectors.added()).has('scb-pxweb'), 'remembered as removed');
      // The catalogue in the workspace lists it again, with country chips and a search; Lägg till brings it back and opens it.
      /** @type {HTMLElement} */ (Array.from(pane.querySelectorAll('.dm-list-item')).find((b) => b.textContent.includes(t('api.sources')))).click();
      await waitFor(() => root.querySelector('[data-api-catalog] [data-catalog="scb-pxweb"]'), 5000, 'SCB in the catalogue');
      assert.ok(root.querySelector('.dm-chips'), 'country chips in the catalogue');
      const search = /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-input, .dm-main dm-input, dm-input')).find((i) => i.getAttribute('placeholder') === t('api.catalog.search')));
      assert.ok(search, 'a search field');
      search.value = 'Kolada'; search.dispatchEvent(new Event('input'));
      await waitFor(() => !root.querySelector('[data-api-catalog] [data-catalog="scb-pxweb"]'), 3000, 'filtered away');
      search.value = ''; search.dispatchEvent(new Event('input'));
      const row = await waitFor(() => root.querySelector('[data-api-catalog] [data-catalog="scb-pxweb"]'), 3000, 'back after clearing');
      /** @type {HTMLElement} */ (row.querySelector('[data-catalog-add="scb-pxweb"] button')).click();
      await waitFor(() => pane.querySelector('[data-added="api:scb-pxweb"]'), 5000, 'SCB back among the added');
      assert.ok((await connectors.added()).has('scb-pxweb'));
      await waitFor(() => root.querySelector('.dm-api-view'), 5000, 'the source opened');
      // A source of the user's own: listed when saved, deleted for good from the row.
      await connectors.save({ format: 'dataspatium-api/1', id: 'test-own-source', name: 'Egen testkälla', baseUrl: 'https://example.org/api', auth: { type: 'none' }, family: { type: 'opencde', clientId: 'x' }, endpoints: [] });
      await waitFor(() => pane.querySelector('[data-added="api:test-own-source"]'), 5000, 'the own source listed');
      /** @type {HTMLElement} */ (pane.querySelector('[data-remove-source="api:test-own-source"] button')).click();
      dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the confirmation');
      assert.ok(dlg.textContent.includes(t('import.sources.remove.confirm', { name: 'Egen testkälla' })));
      okButton(dlg).click();
      await waitFor(() => !pane.querySelector('[data-added="api:test-own-source"]'), 5000, 'deleted');
      assert.ok(!(await connectors.get('test-own-source')), 'gone from the connectors');
    });
    return 'ok';
  }, 40000);

  test('sources: a database opened through the bridge is remembered among the added sources and can be forgotten', async (assert) => {
    await bridge.remember({ kind: 'access', path: 'C:/data/prov.accdb' });
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      // Other tests may have remembered databases of their own through the bridge; this one is told apart by its label.
      const rowOf = () => Array.from(pane.querySelectorAll('[data-added^="bridge:"]')).find((e) => e.textContent.includes('prov.accdb'));
      const row = await waitFor(rowOf, 5000, 'the remembered database');
      assert.ok(row.textContent.includes('prov.accdb') && row.textContent.includes(t('bridge.added.sub')), row.textContent);
      /** @type {HTMLElement} */ (row.querySelector('.dm-list-item')).click();
      await waitFor(() => root.querySelector('.dm-bridge'), 5000, 'the bridge view opened');
      await wait(300);
      /** @type {HTMLElement} */ (rowOf().querySelector('[data-remove-source] button')).click();
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the confirmation');
      assert.ok(dlg.textContent.includes('prov.accdb'));
      okButton(dlg).click();
      try { await waitFor(() => !rowOf(), 5000, 'forgotten'); }
      catch (err) { throw new Error(err.message + ' | remembered: ' + (await bridge.remembered()).length + ' | dialogs: ' + document.querySelectorAll('dialog[open]').length + ' | rows: ' + Array.from(pane.querySelectorAll('[data-added]')).map((e) => e.getAttribute('data-added')).join(',')); }
      assert.ok(!(await bridge.remembered()).some((b) => b.label === 'prov.accdb'), 'no longer remembered');
    });
    return 'ok';
  }, 30000);

  test('sources: cleanup', async () => {
    for (const id of connectors.DEFAULT_ADDED) await connectors.setAdded(id, true);
    await connectors.remove('test-own-source').catch(() => {});
    for (const b of await bridge.remembered()) await bridge.forget(b.label);
    return 'ok';
  });
})();
