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

  test('tier: the deployment\'s server becomes a source once, without contacting it or replacing a source on the same host', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const connectors = D.require('api/connectors');
    const idb = D.require('platform/storage/idb');
    const consent = D.require('platform/consent');
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false }; });
    const netBefore = D.net.log().length;
    let made = null; let own = null;
    try {
      await idb.deleteSetting('deploy.server');
      made = await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test', name: 'Vår Dataregium' });
      assert.ok(made && opencde.isOpenCde(made), 'an OpenCDE source');
      assert.equal(made.name, 'Vår Dataregium');
      assert.ok((await connectors.list()).some((c) => c.id === made.id), 'among the sources');
      assert.equal(await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test/' }), null, 'not added twice');
      await connectors.remove(made.id);
      assert.equal(await opencde.addDeployed({ baseUrl: 'https://dataregium.tier.test' }), null, 'one the user removed stays removed');
      // The user's own source on the same host, under another address, is kept as it is.
      own = (await D.require('api/families/databases').createConnector('opencde', { baseUrl: 'https://same.tier.test', name: 'Min egen' }, { discover: false })).connector;
      await idb.deleteSetting('deploy.server');
      assert.equal(await opencde.addDeployed({ baseUrl: 'http://same.tier.test/dataregium', name: 'Deras' }), null, 'not added over it');
      assert.equal((await connectors.get(own.id)).name, 'Min egen', 'and the user\'s source is not replaced');
      assert.equal(D.net.log().length, netBefore, 'no request');
      assert.deepEqual(asked, [], 'no consent asked');
      return 'ok';
    } finally {
      consent.setAsker(null);
      if (made) await connectors.remove(made.id).catch(() => {});
      if (own) await connectors.remove(own.id).catch(() => {});
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
      const documentsButton = /** @type {HTMLElement} */ (card.querySelector('[data-tier="documents"]'));
      documentsButton.focus();
      documentsButton.click();
      await waitFor(() => tier.current() === 1, 3000, 'the tier chosen');
      const again = await waitFor(() => root.querySelector('[data-settings="tier"][data-tier-current="documents"]'), 5000, 'the card redrawn');
      await waitFor(() => document.activeElement && document.activeElement.getAttribute('data-tier') === 'documents' && again.contains(document.activeElement), 5000, 'the focus back on the chosen tier');
      assert.ok(!again.querySelector('[data-tier="bim-gis"]').textContent.includes(t('tier.default')), 'a choice is made now');
      // A ceiling: the tiers above it cannot be chosen, and the card says why.
      tier.useConfig({ tier: 'bim-gis' });
      shell.applyTier();
      const capped = await waitFor(() => { const c = root.querySelector('[data-settings="tier"]'); return c && c.querySelector('[data-tier-capped="deployment"]') ? c : null; }, 5000, 'the capped card');
      assert.ok(/** @type {HTMLButtonElement} */ (capped.querySelector('[data-tier="experimental"]')).disabled, 'Experimentell cannot be chosen');
      assert.ok(!(/** @type {HTMLButtonElement} */ (capped.querySelector('[data-tier="bim-gis"]')).disabled));
      // With no choice and a ceiling of Dokument, the default is the tier that then holds.
      await tier.set(null);
      tier.useConfig({ tier: 'documents' });
      shell.applyTier();
      const low = await waitFor(() => root.querySelector('[data-settings="tier"][data-tier-current="documents"]'), 5000, 'the card under the ceiling');
      assert.ok(low.querySelector('[data-tier="documents"]').textContent.includes(t('tier.default')) && !low.querySelector('[data-tier="bim-gis"]').textContent.includes(t('tier.default')), 'the default marked where it holds');
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
      assert.equal(notice.tagName, 'DM-EMPTY-STATE', 'Kontrollera\'s empty state');
      assert.ok(root.textContent.includes(t('tier.hint')), 'and the inspector says what the tier does');
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

  test('tier: unreadable config values warn in the console, and a write that fails changes nothing', async (assert) => {
    const warned = [];
    const realWarn = console.warn;
    console.warn = (...args) => { warned.push(args.map(String).join(' ')); };
    try { tier.readConfig({ tier: 'dokument', language: 'xx', server: { baseUrl: 'ftp://x' } }); } finally { console.warn = realWarn; }
    assert.equal(warned.length, 3, 'the tier, the language and the server: ' + warned.join(' | '));
    assert.ok(warned[0].includes('dokument') && warned[1].includes('xx'), 'each names what it skipped');
    assert.equal(tier.readConfig({ tier: 'dokument' }).ceiling, null, 'a mistyped tier is no ceiling');
    await reset();
    const idb = D.require('platform/storage/idb');
    const realSet = idb.setSetting;
    idb.setSetting = () => Promise.reject(new Error('the storage is full'));
    let failed = false;
    try { await tier.set('documents'); } catch (_e) { failed = true; } finally { idb.setSetting = realSet; }
    try {
      assert.ok(failed, 'the choice is refused');
      assert.equal(tier.current(), 2, 'and the tier is as before');
      assert.equal(tier.choice(), null);
      return 'ok';
    } finally { await restore(); }
  });

  test('tier: a server\'s capabilities need the OpenCDE consent, and its tier is remembered', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const consent = D.require('platform/consent');
    const idb = D.require('platform/storage/idb');
    const http = D.require('api/http');
    const BASE = 'dataspatium-asset://tests/tier-cde';
    let hits = 0;
    D.net.virtual('tests/tier-cde/', (url) => {
      hits++;
      return Promise.resolve(new URL(url).pathname.endsWith('/.well-known/dataregium') ? { kind: 'text', data: JSON.stringify({ server: { name: 'Nivåservern' }, tier: 'documents', extensions: {} }) } : { kind: 'text', data: '{}', status: 404 });
    });
    const a = { id: 'tier-cde-a', name: 'Nivå A', baseUrl: BASE, family: { type: 'opencde' }, auth: { type: 'none' }, endpoints: [], requestId: false };
    const b = Object.assign({}, a, { id: 'tier-cde-b', name: 'Nivå B' });
    const key = 'dataspatium.consent';
    const override = localStorage.getItem(key);
    const prior = { opencde: await consent.state('opencde'), api: await consent.state('api') };
    const remembered = async (id) => { for (let i = 0; i < 50; i++) { const saved = await idb.getSetting('tier.servers', null); if (saved && saved[id] === 1) return true; await wait(20); } return false; };
    const realRequest = http.request;
    try {
      // With OpenCDE denied, even with open APIs allowed, the server is not asked.
      localStorage.removeItem(key);
      await consent.set('opencde', 'denied'); await consent.set('api', 'granted');
      let refused = null;
      try { await opencde.capabilities(a, { force: true }); } catch (err) { refused = err; }
      assert.ok(refused && refused.name === 'ConsentError' && refused.purpose === 'opencde', 'refused by the OpenCDE consent: ' + (refused && refused.message));
      assert.equal(hits, 0, 'no request');
      if (override !== null) localStorage.setItem(key, override);
      // The server answers: its tier caps what needs it, by the source's id and its address, and is kept in IndexedDB.
      await opencde.capabilities(a, { force: true });
      assert.ok(hits > 0, 'asked once allowed');
      assert.equal(tier.serverTier('tier-cde-a'), 1);
      assert.equal(tier.serverTier(BASE), 1);
      assert.ok(await remembered('tier-cde-a'), 'remembered');
      // Another source on the same server is noted from the cache, without another request.
      const asked = hits;
      await opencde.capabilities(b);
      assert.equal(hits, asked, 'from the cache');
      assert.equal(tier.serverTier('tier-cde-b'), 1, 'the second source by its own id');
      // A server that cannot be reached leaves what it announced before.
      http.request = () => Promise.reject(Object.assign(new Error('unreachable'), { kind: 'network' }));
      await opencde.capabilities(a, { force: true });
      http.request = realRequest;
      assert.equal(tier.serverTier('tier-cde-a'), 1, 'kept after a failed request');
      // After a reload, what was remembered caps again.
      const saved = await idb.getSetting('tier.servers', {});
      await idb.setSetting('tier.servers', Object.assign({}, saved, { 'tier-cde-reload': 1 }));
      await tier.load();
      assert.equal(tier.serverTier('tier-cde-reload'), 1, 'read back at start');
      assert.ok(!tier.shows('cde.teams', { server: 'tier-cde-reload' }) && !tier.shows('cde.bcf', { server: 'tier-cde-reload' }) && tier.shows('kind:model', { server: 'tier-cde-reload' }), 'the server caps its own features only');
      // An unknown value caps nothing and is said in the console.
      const warned = [];
      const realWarn = console.warn;
      console.warn = (...args) => { warned.push(args.map(String).join(' ')); };
      try { tier.noteServer({ id: 'tier-cde-odd' }, 'gold'); } finally { console.warn = realWarn; }
      assert.ok(warned.some((w) => w.includes('gold')) && tier.serverTier('tier-cde-odd') === null, 'an unknown tier is no cap');
      return 'ok';
    } finally {
      http.request = realRequest;
      if (override !== null) localStorage.setItem(key, override);
      await consent.set('opencde', prior.opencde); await consent.set('api', prior.api);
      for (const c of [a, b, { id: 'tier-cde-reload' }]) tier.noteServer(c, undefined);
      D.net.unvirtual('tests/tier-cde/');
    }
  });

  test('tier: commands, operations, recipes and fetching again refuse what the tier hides, in words that name it', async (assert) => {
    await reset();
    const commands = D.require('data/commands');
    const recipes = D.require('data/recipes');
    const runner = D.require('api/runner');
    const connectors = D.require('api/connectors');
    let table = null;
    try {
      table = await datasets.create({ name: 'Nivå kommandon', columns: [{ name: 'namn', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [[' a ', 18.06, 59.33]] });
      await tier.set('documents');
      const names = commands.list().map((c) => c.name);
      assert.ok(!names.includes('create_map') && !names.includes('add_map_layer') && !names.includes('cde_topics') && !names.includes('cde_create_topic'), 'the maps and the BCF topics go: ' + names.join(', '));
      assert.ok(names.includes('create_chart') && names.includes('make_document') && names.includes('cde_files') && names.includes('cde_fetch_file'), 'the charts, documents and the CDE\'s files stay');
      assert.ok(commands.list({ all: true }).some((c) => c.name === 'create_map'), 'every command on request');
      assert.ok(!commands.tools().some((x) => x.name === 'cde_create_topic'), 'and the assistant is not offered them');
      const map = await commands.run('create_map', { dataset: table.id, name: 'Karta', basemap: null }, { trusted: true });
      assert.ok(!map.ok && map.tier === 'bim-gis' && map.error.includes(t('tier.bim-gis')) && map.error.includes(t('tier.documents')), 'refused in words that name the tiers: ' + map.error);
      let approvals = 0;
      const topic = await commands.run('cde_create_topic', { source: 'x', project: 'y', title: 'z', description: null, status: null, priority: null, type: null }, { approve: async () => { approvals++; return true; } });
      assert.ok(!topic.ok && !topic.refused && approvals === 0, 'refused before anyone is asked to approve it');
      const listed = await commands.run('list_operations', { group: null });
      const ops = listed.result.operations.map((o) => o.id);
      assert.ok(!ops.includes('geo_height') && !ops.includes('ifc_python') && !ops.includes('ifc_changeset') && !ops.includes('ifc_party') && ops.includes('trim'), 'list_operations holds what the tier shows');
      const described = await commands.run('describe_operation', { operation: 'geo_height' });
      assert.ok(!described.ok && described.error.includes(t('tier.bim-gis')), described.error);
      let refused = null;
      try { await recipes.apply(table.id, 'geo_height', {}); } catch (err) { refused = err; }
      assert.ok(refused && refused.name === 'TierError' && refused.tierFeature === 'op:geo_height', 'recipes refuse the heights: ' + (refused && refused.message));
      await recipes.apply(table.id, 'trim', { columns: ['namn'] });
      assert.ok(recipes.canUndo(table.id), 'what Dokument holds runs');
      await recipes.undo(table.id);
      // Fetching again: a geodata service is never contacted, a CDE's topics need BCF and its administration's lists stay.
      assert.ok(await connectors.get('naturvardsregistret'), 'the preset is in the catalogue');
      const before = D.net.log().length;
      let refetch = null;
      try { await runner.refetch({ kind: 'api', connectorId: 'naturvardsregistret', endpointId: 'x', params: {} }); } catch (err) { refetch = err; }
      assert.ok(refetch && refetch.name === 'TierError', 'refused: ' + (refetch && refetch.message));
      assert.equal(D.net.log().length, before, 'no request');
      assert.deepEqual(runner.hiddenBy({ kind: 'api', family: 'opencde', connectorId: 'cde-x', opencde: { kind: 'topics', projectId: 'p' } }), { entry: 'cde.bcf', options: { server: 'cde-x' } });
      assert.equal(runner.hiddenBy({ kind: 'api', family: 'opencde', connectorId: 'cde-x', opencde: { kind: 'admin', admin: 'users' } }), null, 'the administration\'s lists stay in Dokument');
      await tier.set('bim-gis');
      assert.ok(commands.list().some((c) => c.name === 'create_map') && commands.list().some((c) => c.name === 'cde_topics'), 'BIM och GIS lists them again');
      assert.equal(runner.hiddenBy({ kind: 'api', connectorId: 'naturvardsregistret' }), null);
      assert.ok(runner.hiddenBy({ kind: 'api', family: 'opencde', connectorId: 'cde-x', opencde: { kind: 'admin', admin: 'graph' } }), 'the administration\'s graph query is Experimentell');
      return 'ok';
    } finally {
      if (table) await datasets.remove(table.id);
      await restore();
    }
  }, 30000);

  test('tier: exports, templates, the IFC graph and the groups loaded ahead follow the tier', async (assert) => {
    await reset();
    const exporter = D.require('io/export');
    const documents = D.require('docgen/documents');
    const graphSource = D.require('api/graph-source');
    const importer = D.require('io/import');
    try {
      const ifc = { kind: 'model', model: { format: 'ifc' } };
      const kindFormats = () => exporter.formatsFor(ifc).filter((f) => f.kind).map((f) => f.id);
      assert.ok(kindFormats().includes('model-glb') && kindFormats().includes('model-properties'), 'BIM och GIS exports the model\'s own formats');
      assert.ok((await documents.list()).some((d) => d.id === 'builtin-besiktning'), 'and lists the reports of findings');
      // The IFC graph is Experimentell: a model's way to it is refused in the notice's words.
      let graph = null;
      try { await graphSource.open({}, { source: { cde: { connectorId: 'cde-x', host: 'cde.tier.test' } } }); } catch (err) { graph = err; }
      assert.ok(graph && graph.name === 'TierError' && graph.message.includes(t('tier.experimental')), 'the IFC graph needs Experimentell: ' + (graph && graph.message));
      // The installed app loads every group up to the ceiling ahead, so that raising the tier works offline.
      assert.ok(tier.groupAllowed('assistant') && !tier.groupShown('assistant'), 'the assistant\'s group is loaded ahead in BIM och GIS');
      tier.useConfig({ tier: 'bim-gis' });
      assert.ok(!tier.groupAllowed('assistant') && tier.groupAllowed('ai'), 'but not above the ceiling');
      tier.useConfig(undefined);
      await tier.set('documents');
      assert.deepEqual(kindFormats(), ['model-original'], 'Dokument exports a model\'s original file and its table');
      assert.ok(!(await documents.list()).some((d) => d.findings), 'no reports of findings in Dokument');
      assert.ok(await documents.get('builtin-besiktning'), 'one a flow names is still found');
      assert.ok(!tier.shows('cde.teams') && !tier.shows('geo:buffer') && tier.shows('geo:points'), 'no teams, and of the geo tools only places per area');
      // A BCF file is read by the BCF client only: refused before it is read.
      let bcf = null;
      try { await importer.preview(new File(['PK'], 'arenden.bcfzip'), {}); } catch (err) { bcf = err; }
      assert.ok(bcf && bcf.name === 'TierError' && bcf.tierFeature === 'import:bcf', 'a BCF file needs BIM och GIS: ' + (bcf && bcf.message));
      return 'ok';
    } finally { await restore(); }
  });

  test('tier: a saved chart of a hidden type opens as the notice, and nothing draws or publishes it', async (assert) => {
    await reset();
    const charts = D.require('viz/charts');
    const leaflet = D.require('viz/leaflet');
    const render = D.require('viz/render');
    const dashboards = D.require('viz/dashboards');
    let table = null; let chart = null; let started = null;
    try {
      table = await datasets.create({ name: 'Nivå platser', columns: [{ name: 'namn', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [['a', 18.06, 59.33]] });
      const record = charts.create('map', table, 'Nivå karta');
      record.map = leaflet.defaultMap(await datasets.columns(table.id), table);
      chart = await charts.save(record);
      await tier.set('documents');
      let drawn = null;
      try { await render.toBlob(chart, 'png'); } catch (err) { drawn = err; }
      assert.ok(drawn && drawn.name === 'TierError', 'the map view is not drawn in Dokument: ' + (drawn && drawn.message));
      const html = await (await dashboards.toHtml({ name: 'Nivå tavla', description: '' }, { resolved: [{ chart }] })).text();
      assert.ok(html.includes('Nivå tavla') && !html.includes('Nivå karta'), 'and left out of published HTML');
      started = await startShell('#/visualisera/' + encodeURIComponent(chart.id));
      const { root } = started;
      const notice = await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="map.view"]'), 8000, 'the notice');
      assert.ok(notice.textContent.includes(t('tier.bim-gis')), 'it names the tier');
      assert.ok(!root.querySelector('.dm-center [data-map-basemap]'), 'the map panel is not built');
      /** @type {HTMLElement} */ (root.querySelector('.dm-center [data-tier-raise="bim-gis"]')).click();
      await waitFor(() => tier.current() === 2 && !root.querySelector('.dm-center [data-tier-hidden]'), 8000, 'the chart opened');
      return 'ok';
    } finally {
      if (started) stop(started.root);
      if (chart) await charts.remove(chart.id).catch(() => {});
      if (table) await datasets.remove(table.id);
      await restore();
    }
  }, 60000);

  test('tier: Inhämta says why it reads no BCF file or QGIS project below BIM och GIS, the geo tab counts places, and the assistant closes', async (assert) => {
    await tier.set('experimental');
    let started = null;
    try {
      started = await startShell();
      const { root, shell } = started;
      await shell.openAssistant();
      assert.ok(D.require('ui/assistant').current(), 'the assistant is open in Experimentell');
      await tier.set('documents');
      assert.equal(D.require('ui/assistant').current(), null, 'and closes in Dokument');
      // The Geo tab offers counting places per area only.
      const geo = D.require('ui/analysis/geo-panel').create(shell.ctx);
      assert.deepEqual(geo.center().body[0].tabs.map((x) => x.id), ['points'], 'Punkter i områden');
      geo.destroy();
      shell.activate('inhamta');
      const drop = (file) => /** @type {HTMLElement} */ (root.querySelector('.dm-center dm-dropzone')).dispatchEvent(new CustomEvent('dm-files', { detail: { files: [file] } }));
      await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      drop(new File(['<qgis projectname="Nivå"></qgis>'], 'projekt.qgs'));
      const qgis = await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="map.view"]'), 5000, 'the notice for the QGIS project');
      assert.ok(qgis.querySelector('[data-tier-raise="bim-gis"]'), 'with the way to raise the tier');
      drop(new File(['PK'], 'arenden.bcfzip'));
      await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="cde.bcf"]'), 5000, 'the notice for the BCF file');
      /** @type {HTMLElement} */ (root.querySelector('.dm-center [data-tier-raise="bim-gis"]')).click();
      await waitFor(() => tier.current() === 2 && !root.querySelector('.dm-center [data-tier-hidden]'), 5000, 'the notice gone in BIM och GIS');
      return 'ok';
    } finally { if (started) stop(started.root); await restore(); }
  }, 60000);

  test('tier: a plan\'s own map is drawn in Dokument, on the sheet and in a template, and a saved map chart is not', async (assert) => {
    await reset();
    const exporter = D.require('io/export');
    const template = D.require('docgen/template');
    const charts = D.require('viz/charts');
    const leaflet = D.require('viz/leaflet');
    const area = JSON.stringify({ type: 'Polygon', coordinates: [[[15, 60], [15.1, 60], [15.1, 60.1], [15, 60.1], [15, 60]]] });
    const columns = ['objektid', 'objekttyp', 'beteckning', 'formulering', 'farg', 'geometri'].map((name) => ({ name, type: 'text' }));
    let plan = null; let chart = null;
    try {
      plan = await datasets.create({ name: 'Nivå detaljplan', kind: 'plan', columns, rows: [['o1', 'anvandning', 'B', 'Bostäder', 'brun', area], ['o2', 'egenskap', 'e1', 'Största byggnadsarea är 200 m2', null, area]] });
      const record = charts.create('map', plan, 'Nivå plankarta');
      record.map = leaflet.defaultMap(await datasets.columns(plan.id), plan);
      chart = await charts.save(record);
      await tier.set('documents');
      assert.ok(exporter.formatsFor(await datasets.get(plan.id)).some((f) => f.id === 'plan-sheet'), 'Dokument offers the plan map');
      const sheet = (await exporter.exportDataset(plan.id, 'plan-sheet')).blob;
      assert.equal(await sheet.slice(0, 4).text(), '%PDF', 'the plan map as PDF in Dokument');
      const out = await template.renderTemplate('{{plan "Nivå detaljplan"}}\n{{karta "Nivå detaljplan" | bredd: 400}}\n{{diagram "Nivå plankarta"}}', { _filters: [] });
      assert.ok(out.images[0].png && out.images[0].png.byteLength > 1000, 'the word plan draws the plan: ' + (out.images[0].error || ''));
      assert.ok(out.images[1].png && out.images[1].png.byteLength > 1000, 'and karta: ' + (out.images[1].error || ''));
      assert.ok(out.images[2].error && out.images[2].error.includes(t('tier.bim-gis')), 'a saved map chart belongs to the map view: ' + out.images[2].error);
      return 'ok';
    } finally {
      if (chart) await charts.remove(chart.id).catch(() => {});
      if (plan) await datasets.remove(plan.id);
      await restore();
    }
  }, 30000);

  test('tier: raising the tier from Inhämta\'s notice for a BCF file leaves no refusal on the page', async (assert) => {
    await reset();
    let started = null;
    try {
      await tier.set('documents');
      started = await startShell();
      const { root, shell } = started;
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [new File(['PK'], 'arenden.bcfzip')] } }));
      await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="cde.bcf"]'), 5000, 'the notice for the BCF file');
      const error = () => root.querySelector('.dm-center .dm-error');
      assert.ok(!error(), 'the notice in place of an error');
      /** @type {HTMLElement} */ (root.querySelector('.dm-center [data-tier-raise="bim-gis"]')).click();
      await waitFor(() => tier.current() === 2 && !root.querySelector('.dm-center [data-tier-hidden]'), 5000, 'the notice gone in BIM och GIS');
      assert.ok(!error(), 'and the refusal with it: ' + (error() ? error().textContent : ''));
      assert.ok(root.querySelector('.dm-center dm-dropzone'), 'the file can be chosen again');
      return 'ok';
    } finally { if (started) stop(started.root); await restore(); }
  }, 60000);

  test('tier: a server with the Documents API alone gives and takes documents in Dokument without the BCF API, past a BCF file', async (assert) => {
    await reset();
    const opencde = D.require('api/families/opencde');
    const connectors = D.require('api/connectors');
    const cdeSend = D.require('ui/share/cde-send');
    const BASE = 'dataspatium-asset://tests/tier-docs';
    const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
    const paths = [];
    const json = (data) => Promise.resolve({ kind: 'text', data: JSON.stringify(data) });
    const version = (id, title, name) => ({ links: { document_version_download: { url: `${BASE}/documents/1.0/documents/${id}/versions/1/download` } }, version_number: '1', version_index: 1, title, file_description: { name, size_in_bytes: 12 }, document_id: id });
    const files = { d1: 'kod,antal\nA,1\n', d2: 'PK', d3: 'kod,antal\nB,2\n' };
    const session = BASE + '/documents/1.0/upload-sessions/s2';
    // As a Dataregium with the Documents API alone answers: no BCF version in the Foundation API, and no /bcf/ path at all.
    D.net.virtual('tests/tier-docs/', (url) => {
      const path = url.slice(BASE.length).split('?')[0];
      paths.push(path);
      const download = /^\/documents\/1\.0\/documents\/(d\d)\/versions\/1\/download$/.exec(path);
      if (download) return Promise.resolve({ kind: 'text', data: files[download[1]] });
      switch (path) {
        case '/foundation/versions': return json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'documents', version_id: '1.0' }] });
        case '/foundation/1.0/auth': return json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_pkce_required: true });
        case '/foundation/oauth2/token': return json({ access_token: 'tier-docs-token', expires_in: 3600 });
        case '/foundation/1.0/current-user': return json({ id: 'reader', name: 'Läsaren' });
        case '/documents/1.0/select-documents': return json({ select_documents_url: BASE + '/documents/1.0/select-ui/t1', expires_in: 600 });
        case '/documents/1.0/selection-sessions/s1/documents': return json({ documents: [version('d1', 'Nivå dokument A', 'a.csv'), version('d2', 'Nivå ärenden', 'arenden.bcfzip'), version('d3', 'Nivå dokument B', 'b.csv')] });
        case '/documents/1.0/upload-documents': return json({ upload_ui_url: BASE + '/documents/1.0/upload-ui/t2', max_size_in_bytes: 1000000 });
        case '/documents/1.0/upload-sessions/s2/instructions': return json({ documents_to_upload: [{ session_file_id: 'f1', upload_file_parts: [{ url: session + '/part', http_method: 'PUT', content_range_start: 0, content_range_end: 999999 }], upload_completion: { url: session + '/complete' } }] });
        case '/documents/1.0/upload-sessions/s2/part': return Promise.resolve({ kind: 'text', data: '' });
        case '/documents/1.0/upload-sessions/s2/complete': return json({ title: 'Nivå skickad', version_number: '1', version_index: 1, document_id: 'd9' });
        default: return Promise.resolve({ kind: 'text', data: '{"message":"Not Found"}', status: 404 });
      }
    });
    const realRedirect = opencde.redirectUri; const realSelect = opencde.selectDocuments;
    const made = []; const logs = [];
    let connector = null; let ui = null; let panel = null; let table = null;
    try {
      await tier.set('documents');
      connector = (await D.require('api/families/databases').createConnector('opencde', { baseUrl: BASE, clientId: 'tier-docs', clientSecret: '' })).connector;
      assert.ok(!opencde.hasBcf(connector) && opencde.hasDocuments(connector), 'discovery finds the Documents API alone');
      await opencde.login(connector, { popup: (url) => Promise.resolve(`${REDIRECT}?code=c1&state=${new URL(url).searchParams.get('state')}`), redirectUri: REDIRECT });
      // Inhämta: Hämta dokument without a project of the BCF API.
      ui = D.require('ui/api/opencde-view').create({ connector, ctx: {}, log: (m, k) => logs.push([k, m]), onDataset: (m) => made.push(m.id) });
      document.body.appendChild(ui.el);
      ui.start();
      await waitFor(() => ui.state.projects && !ui.state.busy && ui.el.querySelector('[data-opencde-documents]'), 5000, 'the button Hämta dokument');
      assert.deepEqual(ui.state.projects, [], 'no projects to list');
      assert.ok(!ui.el.querySelector('[data-opencde-files]') && !ui.el.querySelector('[data-opencde-bcf]'), 'no files card and no BCF version');
      // The chosen documents come; the BCF file among them is skipped in the tier's words, and the one after it still comes.
      opencde.redirectUri = () => REDIRECT;
      opencde.selectDocuments = (c, options) => realSelect(c, Object.assign({ redirectUri: REDIRECT, popup: () => Promise.resolve(`${REDIRECT}?selected_documents_url=${encodeURIComponent(BASE + '/documents/1.0/selection-sessions/s1/documents')}`) }, options || {}));
      await ui.fetchDocuments();
      assert.equal(made.length, 2, 'two of the three documents are read: ' + JSON.stringify(logs.slice(-3)));
      assert.ok(logs.some(([k, m]) => k === 'warn' && m.startsWith('Nivå ärenden: ') && m.includes(t('tier.bim-gis'))), 'the BCF file is skipped in the tier\'s words');
      assert.ok(logs.some(([, m]) => m === t('opencde.documents.imported', { n: '2' })), 'and the rest are counted');
      // Dela: the file goes up through the Documents API, whose page asks for the project.
      table = await datasets.create({ name: 'Nivå att skicka', columns: [{ name: 'kod', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['A', 1]] });
      const ctx = { store: { get: () => ({ datasets: [] }), set() {} }, shell: { log: (m, k) => logs.push([k, m]) }, services: { exporter: D.require('io/export') }, ui: Object.assign({ h: D.require('ui/base').h, t, button: D.require('ui/basic').button }, D.require('ui/overlays')) };
      panel = cdeSend.create(ctx, { dataset: () => table });
      document.body.appendChild(panel.el);
      await panel.start();
      const select = (label) => /** @type {any} */ (Array.from(panel.el.querySelectorAll('dm-select')).find((x) => x.getAttribute('label') === t(label)));
      if (panel.state.connector.id !== connector.id) { select('issues.source').value = connector.id; select('issues.source').dispatchEvent(new Event('change')); }
      await waitFor(() => panel.state.connector.id === connector.id && panel.state.projects, 3000, 'the source chosen');
      assert.ok(!select('opencde.project'), 'no project to choose');
      assert.deepEqual(select('cde.send.how').options.map((o) => o.value), ['documents'], 'and no BCF document');
      cdeSend.setPopup(() => Promise.resolve(`${REDIRECT}?upload_documents_url=${encodeURIComponent(session + '/instructions')}`), REDIRECT);
      await panel.send();
      assert.equal(panel.state.done, t('cde.send.done.document', { name: 'Nivå skickad', version: '1' }), 'sent without a project: ' + panel.state.error);
      assert.deepEqual(paths.filter((p) => p.startsWith('/bcf/')), [], 'the BCF API is never asked');
      return 'ok';
    } finally {
      cdeSend.setPopup(null);
      opencde.redirectUri = realRedirect; opencde.selectDocuments = realSelect;
      if (panel) { panel.destroy(); panel.el.remove(); }
      if (ui) { ui.destroy(); ui.el.remove(); }
      for (const id of made.concat(table ? [table.id] : [])) await datasets.remove(id).catch(() => {});
      if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id).catch(() => {}); }
      D.net.unvirtual('tests/tier-docs/');
      await restore();
    }
  }, 60000);

  test('tier: a server that answers its capabilities with an error keeps the tier it announced; one without the document caps nothing', async (assert) => {
    const opencde = D.require('api/families/opencde');
    const idb = D.require('platform/storage/idb');
    const BASE = 'dataspatium-asset://tests/tier-caps';
    const status = { dataregium: 200, kontroll: 404 };
    D.net.virtual('tests/tier-caps/', (url) => {
      const which = url.endsWith('/.well-known/dataregium') ? 'dataregium' : url.endsWith('/.well-known/kontroll') ? 'kontroll' : '';
      const code = status[which] || 404;
      return Promise.resolve(code === 200 ? { kind: 'text', data: JSON.stringify({ server: { name: 'Nivåservern' }, tier: 'documents', extensions: {} }) } : { kind: 'text', data: '{"detail":"no"}', status: code });
    });
    const c = { id: 'tier-caps-a', name: 'Nivå C', baseUrl: BASE, family: { type: 'opencde' }, auth: { type: 'none' }, endpoints: [], requestId: false };
    const remembered = async () => { for (let i = 0; i < 50; i++) { const saved = await idb.getSetting('tier.servers', null); if (saved && saved[c.id] === 1) return true; await wait(20); } return false; };
    await reset();
    try {
      await opencde.capabilities(c, { force: true });
      assert.equal(tier.serverTier(c.id), 1, 'the server announces Dokument');
      assert.ok(await remembered(), 'and it is remembered');
      // A rate limit, a server restarting behind its proxy, a refusal: nothing definite about the server's tier.
      for (const [dataregium, kontroll] of [[429, 429], [503, 404], [404, 502], [403, 403]]) {
        Object.assign(status, { dataregium, kontroll });
        await opencde.capabilities(c, { force: true });
        assert.equal(tier.serverTier(c.id), 1, `kept after ${dataregium} and ${kontroll}`);
        await opencde.capabilities(c);
        assert.equal(tier.serverTier(c.id), 1, `and from the cache after ${dataregium} and ${kontroll}`);
      }
      assert.ok(await remembered(), 'still remembered');
      assert.ok(!tier.shows('cde.bcf', { server: c.id }), 'so BCF stays capped for the server');
      Object.assign(status, { dataregium: 404, kontroll: 404 });
      await opencde.capabilities(c, { force: true });
      assert.equal(tier.serverTier(c.id), null, 'a server without the document at either address caps nothing');
      return 'ok';
    } finally {
      tier.noteServer(c, undefined);
      D.net.unvirtual('tests/tier-caps/');
      await restore();
    }
  });

  test('tier: Kontrollera offers the reports of findings from BIM och GIS only', async (assert) => {
    await reset();
    let table = null; let started = null;
    try {
      table = await datasets.create({ name: 'Nivå fynd', columns: [{ name: 'element', type: 'text' }, { name: 'skick', type: 'text' }, { name: 'prioritet', type: 'text' }], rows: [['Vägg', 'brist', 'hog']] });
      await tier.set('documents');
      started = await startShell();
      const { root, shell } = started;
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === table.id), 3000, 'the table in the store');
      shell.store.set({ selectedId: table.id });
      shell.activate('kontrollera');
      await waitFor(() => root.querySelector('.dm-center [data-kontrollera-summary]'), 8000, 'the table checked');
      assert.ok(!root.querySelector('.dm-center [data-kontrollera-report]'), 'no card for the reports in Dokument');
      await tier.set('bim-gis');
      await waitFor(() => root.querySelector('.dm-center [data-kontrollera-report]'), 8000, 'the card in BIM och GIS');
      return 'ok';
    } finally {
      if (started) stop(started.root);
      if (table) await datasets.remove(table.id);
      await restore();
    }
  }, 60000);
})();
