// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the left column of Inhämta: seven groups in a tree that fold and are remembered, under a pane head without a heading
 * (B-81, B-81.1); the forms that add a source in the workspace and as dialogs (F126 a); Gränser för kartor, Exempeldata (F128 a) and
 * Mobilen (F129 a); deep links and the palette; SCB's and Boverket's open APIs among the added sources from the start, a removed
 * preset going back to the catalogue of open APIs and coming back from it, a source of the user's own deleted, and a bridge
 * database remembered and forgotten.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  const forms = D.require('ui/import/source-forms');
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

  /** The rows of Inhämta's tree as {group: [source ids]}, in order (ui/tree rows: the groups at level 0). */
  function groupsOf(shell) {
    const out = {};
    let at = null;
    for (const r of shell.modes.get('inhamta').sourceTree.rows()) {
      if (r.level === 0) { at = r.id.replace(/^group:/, ''); out[at] = []; } else if (at) out[at].push(r.id);
    }
    return out;
  }
  const toggleOf = (pane, group) => /** @type {HTMLElement} */ (pane.querySelector(`[data-key="group:${group}"] [data-part="toggle"]`));

  test('sources: seven groups in order, each folded and unfolded with its arrow and remembered per browser, under a pane head without a heading', async (assert) => {
    const idb = D.require('platform/storage/idb');
    await idb.deleteSetting('inhamta.groups').catch(() => {});
    try {
      await withApp(async (shell, root) => {
        shell.activate('inhamta');
        const pane = root.querySelector('.dm-left');
        await waitFor(() => pane.querySelector('[data-added^="api:"]'), 5000, 'the added sources');
        assert.deepEqual(Array.from(pane.querySelectorAll('[data-source-group]')).map((e) => e.getAttribute('data-source-group')), ['create', 'common', 'databases', 'apis', 'geodata', 'added', 'other']);
        assert.deepEqual(Array.from(pane.querySelectorAll('[data-source-group] .dm-tree-label')).map((e) => e.textContent),
          ['import.sources.create', 'import.sources.common', 'import.sources.databases', 'import.sources.apis', 'import.sources.geodata', 'import.sources.added', 'import.sources.other'].map((k) => t(k)));
        const groups = groupsOf(shell);
        assert.deepEqual(groups.create, ['newmodel', 'newplan', 'newdetailplan', 'newlayer', 'newtable'], 'Skapa källor');
        assert.deepEqual(groups.common, ['file', 'paste', 'url', 'opencde', 'mobile'], 'Vanliga källor');
        assert.deepEqual(groups.databases, ['database', 'bridge', 'neo4j'], 'Databaskällor');
        assert.deepEqual(groups.apis, ['catalog', 'apifile'], 'API-källor');
        assert.deepEqual(groups.geodata, ['geodata', 'geoportal', 'boundaries'], 'Geodatakällor: Geodataportalen beside the form (PLAN 12 a4)');
        assert.deepEqual(groups.other, ['saved', 'examples', 'guides'], 'Övriga källor: Insamling i fält is a part of Mobilen');
        for (const id of connectors.DEFAULT_ADDED) assert.ok(groups.added.includes('api:' + id), 'added from the start: ' + id);
        const all = await connectors.list();
        const other = all.find((c) => c.preset && !connectors.DEFAULT_ADDED.includes(c.id));
        assert.ok(other && !groups.added.includes('api:' + other.id), 'the other presets wait in the catalogue: ' + (other && other.id));
        assert.equal(pane.querySelector('[data-source="database"] .dm-tree-label').textContent, t('families.add.short'), 'Extern databas');
        assert.ok(!pane.querySelector('h4'), 'the groups are the tree\'s headings');
        assert.ok(!Array.from(pane.querySelectorAll('dm-button')).some((b) => !b.closest('[data-added]')), 'no separate add button: the only buttons in the column take an added source out');
        // The pane head: the same head, without a heading; the column is still named for screen readers.
        assert.ok(paneHead(root), 'the pane head is drawn');
        assert.equal(paneHead(root).textContent, '', 'no heading in the pane head (B-81.1)');
        assert.equal(root.querySelector('.dm-left').getAttribute('aria-label'), t('import.sources'));
        assert.equal(root.querySelector('.dm-left [role="tree"], .dm-left [role="group"]').getAttribute('aria-label'), t('import.sources'));
        // A group folds and unfolds with its arrow, and with the keys.
        const head = /** @type {HTMLElement} */ (pane.querySelector('[data-source-group="common"]'));
        assert.equal(head.getAttribute('aria-expanded'), 'true', 'open from the start');
        toggleOf(pane, 'common').click();
        assert.deepEqual(groupsOf(shell).common, [], 'folded');
        assert.ok(!pane.querySelector('[data-source="file"]'), 'its sources are hidden');
        assert.equal(pane.querySelector('[data-source-group="common"]').getAttribute('aria-expanded'), 'false');
        /** @type {HTMLElement} */ (pane.querySelector('[data-source-group="databases"]')).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
        assert.deepEqual(groupsOf(shell).databases, [], 'Left folds a group');
        await waitFor(async () => { const v = await idb.getSetting('inhamta.groups', []); return Array.isArray(v) && v.includes('group:common') && v.includes('group:databases'); }, 3000, 'kept in the browser');
        shell.activate('hantera');
        await wait(50);
        assert.equal(paneHead(root).textContent, t('shell.datasets'), 'Hantera: Datamängder in the pane head');
        assert.ok(!Array.from(root.querySelectorAll('.dm-left .dm-pane-body h4')).some((h) => h.textContent === t('shell.datasets')), 'no duplicate heading in the panel');
        shell.activate('bearbeta');
        await wait(50);
        assert.equal(paneHead(root).textContent, t('shell.datasets'));
      });
      // The next start of the app remembers the folds.
      await withApp(async (shell, root) => {
        shell.activate('inhamta');
        const pane = root.querySelector('.dm-left');
        await waitFor(() => pane.querySelector('[data-source-group="common"]'), 5000, 'the tree');
        assert.deepEqual(groupsOf(shell).common, [], 'still folded');
        assert.deepEqual(groupsOf(shell).databases, [], 'and this one');
        assert.deepEqual(groupsOf(shell).apis, ['catalog', 'apifile'], 'the others open');
        toggleOf(pane, 'common').click();
        /** @type {HTMLElement} */ (pane.querySelector('[data-source-group="databases"]')).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        assert.deepEqual(groupsOf(shell).common, ['file', 'paste', 'url', 'opencde', 'mobile'], 'unfolded with the arrow');
        assert.deepEqual(groupsOf(shell).databases, ['database', 'bridge', 'neo4j'], 'and with Right');
        // A tap on a source opens it and marks it.
        /** @type {HTMLElement} */ (pane.querySelector('[data-source="examples"]')).click();
        await waitFor(() => root.querySelector('.dm-center [data-examples]'), 3000, 'Exempeldata opened');
        assert.equal(pane.querySelector('[data-source="examples"]').getAttribute('aria-current'), 'true');
      });
    } finally { await idb.deleteSetting('inhamta.groups').catch(() => {}); }
    return 'ok';
  }, 40000);

  test('sources: the forms that add a source are drawn in the workspace with their help, and the same forms open as dialogs elsewhere', async (assert) => {
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      const center = root.querySelector('.dm-center');
      await waitFor(() => pane.querySelector('[data-source="database"]'), 5000, 'the tree');
      for (const id of ['database', 'opencde', 'neo4j', 'geodata', 'apifile', 'boundaries']) {
        /** @type {HTMLElement} */ (pane.querySelector(`[data-source="${id}"]`)).click();
        const form = await waitFor(() => center.querySelector(`[data-source-form="${id}"]`), 8000, 'the form ' + id);
        assert.ok(!document.querySelector('dialog[open]'), id + ': no dialog');
        assert.ok(center.querySelector(`[data-source-lead="${id}"]`).textContent.trim().length > 20, id + ': the help above the form');
        assert.ok(form.children.length, id + ': the form itself');
        assert.ok(root.querySelector('.dm-right').textContent.trim(), id + ': and a word in the inspector');
      }
      // Extern databas: the families over HTTP, says that MySQL, MariaDB and PostgreSQL go through the bridge, and leads there.
      /** @type {HTMLElement} */ (pane.querySelector('[data-source="database"]')).click();
      const db = await waitFor(() => center.querySelector('[data-source-form="database"]'), 5000, 'Extern databas');
      const kinds = /** @type {any} */ (db.querySelector('dm-select')).options.map((o) => o.value);
      assert.ok(kinds.includes('postgrest') && !kinds.includes('opencde') && !kinds.includes('neo4j'), 'OpenCDE and Neo4j have their own entries: ' + kinds.join(','));
      assert.ok(center.querySelector('[data-source-lead="database"]').textContent.includes('MySQL'), 'MySQL, MariaDB and PostgreSQL through the bridge (F125)');
      /** @type {HTMLElement} */ (center.querySelector('[data-open-source="bridge"] button')).click();
      await waitFor(() => center.querySelector('.dm-bridge'), 5000, 'the bridge opened from there');
      // OpenCDE: its own form without a choice of family.
      /** @type {HTMLElement} */ (pane.querySelector('[data-source="opencde"]')).click();
      const cde = await waitFor(() => center.querySelector('[data-source-form="opencde"] [data-family-form="opencde"]'), 5000, 'the OpenCDE form');
      assert.ok(!cde.querySelector(':scope > dm-select'), 'no choice of family');
      assert.ok(cde.querySelector('[data-family-field="baseUrl"]'), 'the address');
      // The same forms as dialogs, from another mode or a card: the same builder, so the same parts.
      shell.activate('hantera');
      for (const [open, sel] of [[() => D.require('ui/api/family-dialog').open(shell.ctx, { family: 'neo4j' }), '[data-family-form="neo4j"]'], [() => D.require('ui/api/family-dialog').open(shell.ctx, { group: 'geodata' }), '[data-family-form="geodata"]'], [() => forms.boundariesForm.open(shell.ctx), '[data-boundaries]'], [() => forms.apiFileForm.open(shell.ctx), '[data-api-file]']]) {
        const done = open();
        const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog for ' + sel);
        assert.ok(dlg.querySelector(sel), 'the form in the dialog: ' + sel);
        /** @type {any} */ (dlg).close();
        assert.equal(await done, null, 'closed without a source');
      }
    });
    return 'ok';
  }, 40000);

  test('sources: Gränser för kartor is a source of its own with origin and licence, and the files no longer offer boundaries or examples', async (assert) => {
    let made = null;
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      const center = root.querySelector('.dm-center');
      await waitFor(() => center.querySelector('dm-dropzone'), 5000, 'the files');
      assert.ok(!center.textContent.includes(t('presets.geo.import')) && !center.textContent.includes(t('presets.try')), 'nothing bundled among the files');
      /** @type {HTMLElement} */ (pane.querySelector('[data-source="boundaries"]')).click();
      const form = await waitFor(() => center.querySelector('[data-boundaries]'), 5000, 'the form');
      const pick = /** @type {any} */ (form.querySelector('[data-boundaries-pick]'));
      assert.deepEqual(pick.options.map((o) => o.value), forms.boundaries().map((p) => p.id), 'every bundled set of boundaries');
      assert.equal(forms.boundaries().length, 8);
      assert.ok(!forms.examples().some((p) => p.boundary) && !forms.boundaries().some((p) => !p.boundary), 'examples and boundaries apart');
      pick.value = 'lan-scb'; pick.dispatchEvent(new Event('change'));
      const card = await waitFor(() => form.querySelector('[data-boundary="lan-scb"]'), 2000, 'the chosen set');
      assert.ok(card.textContent.includes('CC0') && card.textContent.includes('SCB'), 'origin and licence: ' + card.textContent);
      /** @type {HTMLElement} */ (form.querySelector('[data-boundaries-import] button')).click();
      await waitFor(() => form.querySelector('[data-boundaries-done]'), 20000, 'imported');
      made = shell.store.get().datasets.find((d) => d.source && d.source.preset === 'lan-scb') || (await D.require('data/datasets').list()).find((d) => d.source && d.source.preset === 'lan-scb');
      assert.ok(made, 'a dataset of the boundaries');
    });
    if (made) await D.require('data/datasets').remove(made.id, { quiet: true }).catch(() => {});
    return 'ok';
  }, 40000);

  test('sources: Exempeldata lists each example with what it is, where it comes from and its licence, imports one or all, and the empty workspace links there', async (assert) => {
    const made = [];
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      const center = root.querySelector('.dm-center');
      // The first start: an empty workspace points at the examples from the files.
      const kept = shell.store.get().datasets;
      shell.store.set({ datasets: [] });
      /** @type {HTMLElement} */ (await waitFor(() => pane.querySelector('[data-source="paste"]'), 5000, 'the tree')).click();
      /** @type {HTMLElement} */ (pane.querySelector('[data-source="file"]')).click();
      const first = await waitFor(() => center.querySelector('[data-first-examples]'), 3000, 'the link at the first start');
      assert.ok(first.textContent.includes(t('examples.first')));
      /** @type {HTMLElement} */ (first.querySelector('dm-button button')).click();
      await waitFor(() => center.querySelector('[data-examples]'), 3000, 'Exempeldata');
      shell.store.set({ datasets: kept });
      assert.equal(pane.querySelector('[data-source="examples"]').getAttribute('aria-current'), 'true', 'the source is marked');
      const list = forms.examples();
      const cards = Array.from(center.querySelectorAll('[data-example]'));
      assert.deepEqual(cards.map((c) => c.getAttribute('data-example')), list.map((p) => p.id), 'one card per example');
      for (const [i, c] of cards.entries()) {
        const p = list[i];
        assert.ok(c.textContent.includes(t(p.nameKey)) && c.textContent.includes(t(p.descriptionKey)), 'what it is: ' + p.id);
        assert.ok(c.textContent.includes(p.source.publisher) && c.textContent.includes(p.source.license), 'where it comes from and its licence: ' + p.id);
      }
      const all = /** @type {any} */ (center.querySelector('[data-examples-all]'));
      assert.equal(all.getAttribute('label'), t('examples.import.all', { n: list.length }), 'one button for all');
      assert.ok(center.querySelector('[data-course="example"][data-example-import]'), 'the course points at the first example');
      /** @type {HTMLElement} */ (center.querySelector(`[data-example-import="${list[0].id}"] button`)).click();
      const open = await waitFor(() => center.querySelector(`[data-example-open="${list[0].id}"]`), 20000, 'imported, with the way on');
      assert.ok(open && center.querySelector(`[data-example="${list[0].id}"] dm-badge`), 'marked as in the workspace');
      for (const d of shell.store.get().datasets) if (d.source && d.source.preset === list[0].id && !kept.some((k) => k.id === d.id)) made.push(d.id);
      assert.ok(made.length >= 1, 'a dataset of the example');
    });
    for (const id of made) await D.require('data/datasets').remove(id, { quiet: true }).catch(() => {});
    return 'ok';
  }, 40000);

  test('sources: Mobilen pairs and receives from the phone and holds Insamling i fält; Dela keeps sending to devices', async (assert) => {
    const p2p = D.require('platform/p2p');
    await withApp(async (shell, root) => {
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      const center = root.querySelector('.dm-center');
      /** @type {HTMLElement} */ (await waitFor(() => pane.querySelector('[data-source="mobile"]'), 5000, 'Mobilen')).click();
      const lead = await waitFor(() => center.querySelector('[data-mobile-lead]'), 3000, 'the view');
      assert.equal(lead.textContent, t('import.mobile.lead'), 'says what it is for and what can be done');
      const tabs = Array.from(center.querySelectorAll('dm-tabs [role="tab"]')).map((b) => b.textContent.trim());
      assert.deepEqual(tabs, [t('import.mobile.tab.receive'), t('field.source')]);
      if (p2p.supported()) {
        const card = await waitFor(() => center.querySelector('[data-devices-receive]'), 8000, 'receiving');
        assert.ok(card.textContent.includes(t('devices.receive.hint')), 'what the phone sends and what becomes of it');
        assert.ok(!Array.from(center.querySelectorAll('dm-select')).some((s) => /** @type {any} */ (s).options && /** @type {any} */ (s).options.some((o) => o.value === 'all')), 'no sending of datasets here');
      }
      assert.equal(root.querySelectorAll('.dm-right li').length, 4, 'the steps in the inspector');
      // Insamling i fält, under the same heading.
      /** @type {HTMLElement} */ (Array.from(center.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.trim() === t('field.source'))).click();
      await waitFor(() => center.querySelector('[data-mobile-tab="field"]') && center.textContent.includes(t('field.about')), 3000, 'the form tab');
      assert.equal(center.querySelectorAll('h1').length, 1, 'one heading');
      assert.equal(shell.modes.get('inhamta').mobileView.tab, 'field');
      // In Dataspatium Mobil the phone sends to the computer.
      assert.equal(i18n.tIn('sv', 'mobile.send.computer'), 'Skicka till datorn');
      assert.ok(i18n.tIn('sv', 'mobile.connect.hint').includes('Inhämta → Mobilen'), 'and the phone says where to scan');
      // Dela keeps Enheter, with datasets and files to send.
      if (p2p.supported()) {
        shell.store.set({ delaTab: 'devices' });
        await shell.activate('dela');
        const what = await waitFor(() => Array.from(root.querySelectorAll('.dm-center dm-select')).find((s) => /** @type {any} */ (s).options && /** @type {any} */ (s).options.some((o) => o.value === 'all')), 8000, 'Enheter in Dela');
        assert.ok(/** @type {any} */ (what).options.some((o) => o.value === 'files'));
      }
    });
    return 'ok';
  }, 40000);

  test('sources: deep links #/inhamta/<source> and the palette open the sources, Insamling i fält in Mobilen', async (assert) => {
    history.replaceState(null, '', location.pathname + location.search + '#/inhamta/boundaries');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      const shell = await D.require('app').start(root);
      const center = root.querySelector('.dm-center');
      await waitFor(() => center.querySelector('[data-source-form="boundaries"]'), 5000, 'the link at the start');
      await shell.openRoute({ mode: 'inhamta', object: 'examples' });
      await waitFor(() => center.querySelector('[data-examples]'), 3000, 'Exempeldata from a link');
      await shell.openRoute({ mode: 'inhamta', object: 'field' });
      await waitFor(() => center.querySelector('[data-mobile-tab="field"]'), 5000, 'Insamling i fält, now in Mobilen');
      await shell.openRoute({ mode: 'inhamta', object: 'ingen-sådan' });
      await wait(100);
      assert.ok(center.querySelector('[data-mobile-tab="field"]'), 'an unknown source changes nothing');
      // From another mode the link waits for Inhämta.
      await shell.activate('hantera');
      await shell.openRoute({ mode: 'inhamta', object: 'apifile' });
      await shell.activate('inhamta');
      await waitFor(() => center.querySelector('[data-source-form="apifile"]'), 5000, 'API från fil after the mode');
      // The palette: one command per source the tier shows, in a group of its own.
      const cmds = await shell.palette.collect();
      const ids = cmds.filter((c) => c.id.startsWith('source:')).map((c) => c.id.slice(7));
      for (const id of ['file', 'mobile', 'database', 'neo4j', 'catalog', 'apifile', 'geodata', 'boundaries', 'examples', 'guides']) assert.ok(ids.includes(id), 'in the palette: ' + id);
      assert.ok(cmds.filter((c) => c.id.startsWith('source:')).every((c) => c.group === t('palette.group.sources')));
      await shell.activate('hantera');
      await shell.palette.run(cmds.find((c) => c.id === 'source:mobile'));
      await waitFor(() => shell.store.get().mode === 'inhamta' && center.querySelector('[data-mobile-lead]'), 5000, 'Mobilen from the palette');
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 40000);

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
