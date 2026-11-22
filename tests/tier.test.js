// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of the tiers (platform/tier, ui/settings/tier; F48 b c, F52 a): the tier in effect is the smallest of the choice (tier 2
 * when none is made), the deployment's ceiling and, for what needs a server, the server's announced tier; the config file as
 * shipped sets nothing; entry points of each tier come and go with it; a deep link to a hidden function says so and raises the
 * tier; going down keeps every dataset. No test reaches the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const tier = D.require('platform/tier');
  const datasets = D.require('data/datasets');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  /** The app in a hidden root at the address `hash`, as the other mode tests start it. @param {string} [hash] @param {number} [width] */
  async function startShell(hash, width) {
    const root = document.createElement('div');
    root.style.cssText = `position:absolute; left:-10000px; width:${width || 1400}px; height:900px;`;
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search + (hash || ''));
    const shell = await D.require('app').start(root);
    return { root, shell };
  }
  const stop = (root) => { history.replaceState(null, '', location.pathname + location.search); root.remove(); };
  /** Each test starts from no choice and no deployment settings. */
  async function reset() { tier.useConfig(undefined); await tier.set(null); }
  /** And leaves the tier the suite runs in (tests/start.js): Experimentell. */
  async function restore() { tier.useConfig(undefined); await tier.set(3); }

  test('tier: the tier in effect is the default 2, the choice, capped by the deployment and by the server', async (assert) => {
    await reset();
    try {
      assert.equal(tier.DEFAULT, 2, 'BIM och GIS with no choice made (F52 a)');
      assert.equal(tier.choice(), null);
      assert.equal(tier.current(), 2);
      assert.equal(tier.compute({}), 2);
      assert.equal(tier.compute({ chosen: 3 }), 3);
      assert.equal(tier.compute({ chosen: 3, ceiling: 'bim-gis' }), 2, 'the ceiling caps the choice');
      assert.equal(tier.compute({ chosen: null, ceiling: 'documents' }), 1, 'and the default');
      assert.equal(tier.compute({ chosen: 3, server: 'documents' }), 1, 'the server caps what needs it');
      assert.equal(tier.compute({ chosen: 2, server: null }), 2, 'a server that announces nothing caps nothing');
      assert.deepEqual(tier.TIERS.map((x) => x.key), ['documents', 'bim-gis', 'experimental']);
      assert.equal(tier.level('BIM-GIS'), 2); assert.equal(tier.level(3), 3); assert.equal(tier.level('4'), null); assert.equal(tier.level('läge'), null);
      assert.equal(await tier.set('experimental'), 3);
      assert.equal(tier.current(), 3);
      assert.equal(await D.require('platform/storage/idb').getSetting('ui.tier', null), 3, 'the choice is kept in IndexedDB');
      await tier.set(null);
      assert.equal(tier.current(), 2, 'back to the default');
      // A ceiling refuses a higher choice and caps one made before it.
      await tier.set(3);
      tier.useConfig({ tier: 'documents' });
      assert.equal(tier.current(), 1, 'capped');
      assert.equal(tier.ceiling(), 1);
      let refused = '';
      try { await tier.set(2); } catch (err) { refused = String(err.message); }
      assert.ok(refused.includes(t('tier.documents')), 'a choice above the ceiling is refused in words: ' + refused);
      tier.useConfig(undefined);
      assert.equal(tier.current(), 3, 'the choice holds again without the ceiling');
      // The server's tier, by the connector's id or its address.
      tier.noteServer({ id: 'tier-test-cde', baseUrl: 'https://cde.tier.test/' }, 'documents');
      assert.equal(tier.serverTier('tier-test-cde'), 1);
      assert.equal(tier.serverTier('https://CDE.tier.test'), 1);
      assert.ok(!tier.shows('cde.bcf', { server: 'tier-test-cde' }), 'BCF needs tier 2 of the server');
      assert.ok(tier.shows('cde.bcf'), 'without a server named, the app\'s own tier');
      assert.ok(tier.shows('kind:model', { server: 'tier-test-cde' }), 'what needs no server is not capped by it');
      const why = tier.why('cde.bcf', { server: 'tier-test-cde' });
      assert.equal(why.cap, 'server'); assert.ok(!why.canRaise);
      tier.noteServer({ id: 'tier-test-cde', baseUrl: 'https://cde.tier.test' }, undefined);
      assert.ok(tier.shows('cde.bcf', { server: 'tier-test-cde' }), 'nothing announced caps nothing');
      return 'ok';
    } finally { await restore(); }
  });

  test('tier: the deployment config is checked, the shipped file sets nothing, and it may preset the language', async (assert) => {
    const bad = tier.readConfig({ tier: 'läge', language: 'xx', server: { baseUrl: 'ftp://x' } });
    assert.deepEqual(bad, { ceiling: null, language: null, server: null }, 'what does not check out is left out');
    const good = tier.readConfig({ tier: 'bim-gis', language: 'en', server: { baseUrl: ' https://cde.example.org/ ', name: 'Vår server' } });
    assert.deepEqual(good, { ceiling: 2, language: 'en', server: { baseUrl: 'https://cde.example.org', name: 'Vår server' } });
    assert.deepEqual(tier.readConfig(undefined), { ceiling: null, language: null, server: null }, 'no file, no settings');
    // The file next to index.html, as the release ships it: loading it defines nothing.
    const before = /** @type {any} */ (globalThis).DATASPATIUM_CONFIG;
    await D.assets.loadScript('../dataspatium.config.js');
    assert.equal(/** @type {any} */ (globalThis).DATASPATIUM_CONFIG, before, 'the shipped dataspatium.config.js sets nothing');
    // The language the deployment sets comes after a choice and a ?lang= link, and before the browser's.
    assert.deepEqual(D.boot.chosenLanguages({ search: '', stored: null, preset: 'en', prefs: ['sv-SE'] }), ['en']);
    assert.deepEqual(D.boot.chosenLanguages({ search: '', stored: 'sv', preset: 'en', prefs: ['sv-SE'] }), ['sv']);
    assert.deepEqual(D.boot.chosenLanguages({ search: '?lang=fi', stored: null, preset: 'en', prefs: ['sv-SE'] }), ['fi', 'en']);
    assert.deepEqual(D.boot.chosenLanguages({ search: '', stored: null, preset: 'xx', prefs: ['sv-SE'] }), ['languages', 'sv'], 'an unknown preset is ignored');
    return 'ok';
  });

  test('tier: the deployment\'s server becomes a source once, without contacting it', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const connectors = D.require('api/connectors');
    const idb = D.require('platform/storage/idb');
    const consent = D.require('platform/consent');
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false }; });
    const netBefore = D.net.log().length;
    let made = null;
    try {
      await idb.deleteSetting('deploy.server');
      made = await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test', name: 'Vår Dataregium' });
      assert.ok(made && opencde.isOpenCde(made), 'an OpenCDE source');
      assert.equal(made.name, 'Vår Dataregium');
      assert.ok((await connectors.list()).some((c) => c.id === made.id), 'among the sources');
      assert.equal(await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test/' }), null, 'not added twice');
      await connectors.remove(made.id);
      assert.equal(await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test' }), null, 'one the user removed stays removed');
      assert.equal(D.net.log().length, netBefore, 'no request');
      assert.deepEqual(asked, [], 'no consent asked');
      return 'ok';
    } finally {
      consent.setAsker(null);
      if (made) await connectors.remove(made.id).catch(() => {});
      await idb.deleteSetting('deploy.server');
    }
  });

  test('tier: the entry points of each tier come and go with it', async (assert) => {
    await reset();
    const { root, shell } = await startShell();
    const dialogs = D.require('ui/dialogs');
    const kinds = D.require('data/kinds');
    const tools = D.require('ai/model-tools');
    const has = (sel) => !!root.querySelector(sel);
    const ops = (kind) => dialogs.shownGroups(kind).flatMap((g) => g.ops);
    try {
      // Tier 2, the default.
      shell.activate('inhamta');
      await waitFor(() => has('[data-source="file"]'), 3000, 'the source list');
      assert.ok(has('[data-add-source="geodata"]') && has('[data-source="newmodel"]'), 'geodata services and a new model in BIM och GIS');
      assert.ok(root.querySelector('.dm-sb-assistant').hidden, 'the assistant is Experimentell');
      assert.ok(!shell.builtinCommands().some((c) => c.id === 'assistant'), 'nor in the palette');
      assert.ok(ops('table').includes('geo_height') && ops('model').includes('ifc_python'), 'the heights and the model actions');
      assert.equal(kinds.ownView({ kind: 'model' }), 'model');
      assert.ok(!tools.offered().some((x) => x.name === 'server_query'), 'server_query is Experimentell');
      assert.ok(tier.shows('map.basemap') && tier.shows('view:map') && tier.shows('geo:buffer'));
      // Tier 1: the same entry points are gone, the rest stays.
      await tier.set('documents');
      await waitFor(() => !has('[data-add-source="geodata"]'), 3000, 'Inhämta redrawn');
      assert.ok(!has('[data-source="newmodel"]'), 'no new model');
      assert.ok(has('[data-add-source="opencde"]') && has('[data-add-source="neo4j"]'), 'OpenCDE and Neo4j stay in Dokument');
      const catalogue = D.require('api/connectors');
      const all = await catalogue.list();
      assert.ok(!all.filter((c) => tier.showsConnector(c)).some((c) => c.id === 'naturvardsregistret' || (c.family && c.family.type === 'geodata')), 'the geodata presets are left out');
      assert.ok(all.filter((c) => tier.showsConnector(c)).some((c) => c.id === 'kolada'), 'the statistics stay');
      assert.ok(!ops('table').includes('geo_height') && ops('table').includes('geo_area'), 'the heights go, the table\'s geo calculations stay');
      assert.ok(!dialogs.shownGroups('model').some((g) => g.id === 'model'), 'no model actions');
      assert.equal(kinds.ownView({ kind: 'model' }), null, 'a model shows as a table');
      assert.equal(kinds.ownView({ kind: 'plan' }), 'plan', 'the plan map stays in Dokument');
      assert.equal(kinds.ownTab({ kind: 'model' }), 'stats');
      assert.ok(!tier.shows('map.basemap') && !tier.shows('geo:buffer') && tier.shows('tab:geo') && tier.shows('geo:points'), 'no service maps and no geo tools, but the geo tab counts places per area (DS-10)');
      assert.ok(!tier.shows('chart:model') && !tier.shows('chart:profile') && !tier.shows('chart:map') && tier.shows('chart:graph') && tier.shows('chart:vega'), 'the graph and the chart builder (its Vega maps too) stay; the map view, the 3D model and the height profile go');
      // Tier 3: the assistant and the server's graph queries.
      await tier.set('experimental');
      await waitFor(() => !root.querySelector('.dm-sb-assistant').hidden, 3000, 'the assistant shown');
      assert.ok(shell.builtinCommands().some((c) => c.id === 'assistant'), 'and in the palette');
      assert.ok(tools.offered().some((x) => x.name === 'server_query'), 'server_query offered');
      assert.ok(has('[data-add-source="geodata"]'), 'tier 2 is there too');
      return 'ok';
    } finally { stop(root); await restore(); }
  }, 30000);

  test('tier: the settings card chooses the tier, marks the default and shows the ceiling', async (assert) => {
    await reset();
    const { root, shell } = await startShell();
    try {
      shell.activate('hantera');
      shell.store.set({ selectedId: '__workspace' });
      const card = await waitFor(() => root.querySelector('[data-settings="tier"]'), 5000, 'the card Nivå');
      assert.equal(card.getAttribute('data-tier-current'), 'bim-gis');
      const items = Array.from(card.querySelectorAll('[role="radio"]'));
      assert.deepEqual(items.map((b) => b.getAttribute('data-tier')), ['documents', 'bim-gis', 'experimental']);
      assert.equal(card.querySelector('[aria-checked="true"]').getAttribute('data-tier'), 'bim-gis');
      assert.ok(card.querySelector('[data-tier="bim-gis"]').textContent.includes(t('tier.default')), 'the default is marked');
      assert.ok(items.every((b) => b.getAttribute('title')), 'each choice has a tip');
      assert.ok(card.textContent.includes(t('tier.documents.desc')), 'each tier is explained');
      /** @type {HTMLElement} */ (card.querySelector('[data-tier="documents"]')).click();
      await waitFor(() => tier.current() === 1, 3000, 'the tier chosen');
      const again = await waitFor(() => root.querySelector('[data-settings="tier"][data-tier-current="documents"]'), 5000, 'the card redrawn');
      assert.ok(!again.querySelector('[data-tier="bim-gis"]').textContent.includes(t('tier.default')), 'a choice is made now');
      // A ceiling: the tiers above it cannot be chosen, and the card says why.
      tier.useConfig({ tier: 'bim-gis' });
      shell.applyTier();
      const capped = await waitFor(() => { const c = root.querySelector('[data-settings="tier"]'); return c && c.querySelector('[data-tier-capped="deployment"]') ? c : null; }, 5000, 'the capped card');
      assert.ok(/** @type {HTMLButtonElement} */ (capped.querySelector('[data-tier="experimental"]')).disabled, 'Experimentell cannot be chosen');
      assert.ok(!(/** @type {HTMLButtonElement} */ (capped.querySelector('[data-tier="bim-gis"]')).disabled));
      return 'ok';
    } finally { stop(root); await restore(); }
  }, 30000);

  test('tier: a deep link to a hidden function says so and raises the tier, and going down keeps every dataset', async (assert) => {
    await reset();
    const fixtures = D.require('tests/fixtures/ifc');
    const importer = D.require('io/import');
    let model = null; let table = null; let started = null;
    try {
      model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Nivå modell');
      table = await datasets.create({ name: 'Nivå tabell', columns: [{ name: 'a', type: 'integer' }], rows: [[1], [2]] });
      const meta = await datasets.get(model.id);
      await tier.set('documents');
      started = await startShell('#/kontrollera/' + encodeURIComponent(meta.shortName || meta.id));
      const { root, shell } = started;
      const notice = await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="kind.model"]'), 8000, 'the notice');
      assert.ok(notice.textContent.includes(t('tier.bim-gis')) && notice.textContent.includes(t('tier.documents')), 'it names the tier it needs and the one in effect');
      assert.ok(!root.querySelector('.dm-center [data-kontrollera-model]'), 'the model\'s cards are hidden');
      const ids = (await datasets.list()).map((d) => d.id);
      assert.ok(ids.includes(model.id) && ids.includes(table.id), 'both datasets are kept in Dokument');
      // Bearbeta shows the model as a table, with the same notice.
      shell.activate('bearbeta');
      await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="kind.model"]') && root.querySelector('.dm-center dm-table'), 8000, 'the table with the notice');
      // Raising from the notice shows the model's own view again.
      shell.activate('kontrollera');
      const raise = await waitFor(() => root.querySelector('.dm-center [data-tier-raise="bim-gis"]'), 5000, 'the raise button');
      /** @type {HTMLElement} */ (raise.querySelector('button') || raise).click();
      await waitFor(() => tier.current() === 2, 3000, 'raised');
      await waitFor(() => root.querySelector('.dm-center [data-kontrollera-model]'), 8000, 'the model\'s cards');
      assert.ok(!root.querySelector('.dm-center [data-tier-hidden]'), 'the notice is gone');
      // A deployment that caps the tier offers no raise, and says why.
      await tier.set('documents');
      tier.useConfig({ tier: 'documents' });
      shell.applyTier();
      const capped = await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="kind.model"]'), 5000, 'the capped notice');
      assert.ok(capped.querySelector('[data-tier-capped="deployment"]') && !capped.querySelector('[data-tier-raise]'), 'no raise under the ceiling');
      return 'ok';
    } finally {
      if (started) stop(started.root);
      for (const m of [model, table]) if (m) await datasets.remove(m.id);
      await restore();
    }
  }, 60000);
})();
