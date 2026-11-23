// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the background map remembered per dataset and view (ui/viz/basemap-memory): the map in Bearbeta and the plan map
 * have the same background map again when the person comes back to a dataset, a choice kept from an earlier session comes back
 * only when nothing would be asked for it, and the memory survives a reload. Nothing here touches the net: tiles go to a
 * stubbed factory, the consent asker is a stub, and the setting is put back afterwards.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const leaflet = D.require('viz/leaflet');
  const consent = D.require('platform/consent');
  const secrets = D.require('api/secrets');
  const idb = D.require('platform/storage/idb');
  const memory = D.require('ui/viz/basemap-memory');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  /**
   * Run with the consent for background maps not yet given and a recording asker (the test page grants everything, so its
   * switch is lifted for the duration), and with the remembered choices as they were; everything is put back afterwards.
   */
  async function withConsent(answer, fn) {
    const key = 'dataspatium.consent';
    const before = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('basemaps');
    await consent.set('basemaps', null);
    const kept = await idb.getSetting(memory.SETTING, null);
    const asked = [];
    consent.setAsker(async (purpose, info) => { asked.push(Object.assign({ purpose }, info)); return answer; });
    try { return await fn(asked); } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (before !== null) localStorage.setItem(key, before);
      if (kept === null) await idb.deleteSetting(memory.SETTING); else await idb.setSetting(memory.SETTING, kept);
      memory.reset();
    }
  }
  /** Where a view draws: a centre and an inspector off screen. */
  function target() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:900px; height:700px;';
    const center = document.createElement('div'); center.style.height = '600px';
    const right = document.createElement('div');
    host.append(center, right);
    document.body.appendChild(host);
    return { host, center, right };
  }
  /** A stubbed tile factory: a real (empty) layer, so that the map can be asked whether it shows it; nothing is fetched. */
  function tiles() {
    const made = [];
    const factory = (url, opts) => { const layer = /** @type {any} */ (globalThis).L.layerGroup(); made.push({ url, opts, layer }); return layer; };
    return { made, factory };
  }
  async function points(name, lon, lat) {
    const meta = await datasets.create({ name, columns: [{ name: 'namn', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [['P1', lon, lat], ['P2', lon + 0.01, lat + 0.01]] });
    created.push(meta.id);
    return meta;
  }
  /** A detailed plan in SWEREF 99 TM: the plan area and one use. */
  function planFile(name, x0, y0) {
    const g = (position) => [{ geometri: { typ: 'yta', position, koordinatsystemPlan: 'EPSG:3006', dimension: 2 } }];
    const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
    const json = { type: 'FeatureCollection', 'feature:mediatyp': 'application/vnd.lm.detaljplan.v4+json', features: [
      { type: 'Feature', id: 'p1', geometry: null, properties: { 'feature:typ': 'detaljplan', objektidentitet: 'p1', namn: name, beteckning: 'DP ' + name, status: 'laga kraft', kommun: '0180', plangeometri: g(square(x0, y0, 200)) } },
      { type: 'Feature', id: 'b1', geometry: null, properties: { 'feature:typ': 'användningsbestämmelse', detaljplan: 'p1', objektidentitet: 'b1', bestammelseformulering: 'Bostäder', planbestammelsekatalogreferens: 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36', bestammelsegeometri: g(square(x0, y0, 100)) } },
    ] };
    return new File([JSON.stringify(json)], name + '.json', { type: 'application/json' });
  }
  const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('change')); };

  test('basemap memory: the map in Bearbeta has its background map again when the dataset comes back, after an edit and in a new view', async (assert) => {
    const a = await points('Minne A', 17.1, 60.1);
    const b = await points('Minne B', 18.1, 59.3);
    await withApp((shell) => withConsent({ allow: true, remember: false }, async (asked) => {
      const { made, factory } = tiles();
      const where = target();
      const view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {}, tileFactory: factory });
      const sel = () => /** @type {any} */ (where.center.querySelector('[data-map-basemap]'));
      try {
        await view.render(a, where);
        assert.ok(sel().value === 'none' && !made.length && !asked.length, 'no background map until one is chosen');
        change(sel(), 'osm');
        await waitFor(() => made.length === 1 && view.handle && view.handle.map.hasLayer(made[0].layer), 5000, 'OpenStreetMap drawn');
        assert.ok(made[0].url.includes('openstreetmap') && asked.length === 1 && asked[0].purpose === 'basemaps', 'asked once, as when chosen');
        // Another dataset starts without one.
        await view.render(b, where);
        assert.ok(sel().value === 'none' && view.state.chart.map.basemap === 'none' && made.length === 1, 'the other dataset has none');
        // Back: the same background map in the choice and on the map; the consent behaves as when it was chosen (asked once more).
        await view.render(a, where);
        assert.equal(sel().value, 'osm', 'the choice again');
        assert.ok(view.state.chart.map.basemap === 'osm' && made.length === 2 && view.handle.map.hasLayer(made[1].layer), 'drawn again');
        assert.equal(asked.length, 2, 'the render\'s own question, a one-time yes as before');
        // An edit of the same dataset keeps it.
        await view.render(Object.assign({}, a, { updatedAt: new Date().toISOString() }), where);
        assert.ok(sel().value === 'osm' && view.handle.map.hasLayer(made[made.length - 1].layer), 'kept after an edit');
        const stored = await waitFor(async () => { const v = await idb.getSetting(memory.SETTING, null); return v && v[a.id] ? v : null; }, 3000, 'the setting');
        assert.deepEqual(stored[a.id].map, { basemap: 'osm' }, 'kept in the setting by dataset id');
        assert.ok(!stored[b.id], 'nothing for the dataset with none');
      } finally { view.destroy(); where.host.remove(); }
      // A new view (another mode and back) restores it from the session.
      const where2 = target();
      const view2 = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {}, tileFactory: factory });
      try {
        await view2.render(a, where2);
        assert.ok(/** @type {any} */ (where2.center.querySelector('[data-map-basemap]')).value === 'osm' && view2.handle.map.hasLayer(made[made.length - 1].layer), 'a new view has it too');
      } finally { view2.destroy(); where2.host.remove(); }
    }));
    return 'ok';
  }, 40000);

  test('basemap memory: after a reload a background map comes back only with the consent kept for good, and nothing is asked', async (assert) => {
    const a = await points('Minne efter omladdning', 16.1, 58.6);
    await withApp((shell) => withConsent({ allow: false, remember: false }, async (asked) => {
      const { made, factory } = tiles();
      const open = async () => {
        const where = target();
        const view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {}, tileFactory: factory });
        await view.render(a, where);
        const value = /** @type {any} */ (where.center.querySelector('[data-map-basemap]')).value;
        const shown = !!made.length && view.handle.map.hasLayer(made[made.length - 1].layer);
        view.destroy(); where.host.remove();
        return { value, shown };
      };
      await memory.remember('map', a.id, { basemap: 'osm' });
      // A reload: the session is forgotten, the choice is read from the setting.
      memory.reset();
      const without = await open();
      assert.ok(without.value === 'none' && !made.length && !asked.length, 'without the consent kept for good: none, nothing asked or drawn');
      await consent.set('basemaps', 'granted');
      memory.reset();
      const granted = await open();
      assert.ok(granted.value === 'osm' && granted.shown && made.length === 1 && !asked.length, 'with it: the same background map, nothing asked');
      // An orthophoto with a key comes back only when the key is already in the session; the key is never in the setting.
      await secrets.forget('basemap:ortho-dk');
      try {
        await memory.remember('map', a.id, { basemap: 'ortho-dk' });
        memory.reset();
        assert.equal((await memory.recall('map', a.id)).basemap, 'none', 'no key at hand: none');
        secrets.set('basemap:ortho-dk', { apiKey: 'prov-nyckel-0001' });
        assert.equal((await memory.recall('map', a.id)).basemap, 'ortho-dk', 'the key at hand');
        assert.ok(!JSON.stringify(await idb.getSetting(memory.SETTING, null)).includes('prov-nyckel'), 'no key in the setting');
      } finally { await secrets.forget('basemap:ortho-dk'); }
      // A background map that is gone, or that the view does not offer, is not drawn.
      await memory.remember('map', a.id, { basemap: 'ortho-gone' });
      memory.reset();
      assert.equal((await memory.recall('map', a.id)).basemap, 'none', 'a preset that is gone');
      assert.equal(memory.within('ortho-se', [{ value: 'none' }, { value: 'osm' }]), 'none', 'not among the choices');
      assert.equal(asked.length, 0, 'never asked');
    }));
    return 'ok';
  }, 40000);

  test('basemap memory: the plan map has its WMS and grid again when the plan comes back, and gone datasets leave the setting', async (assert) => {
    const importer = D.require('io/import');
    const madeA = await importer.run(planFile('Minnesplan A', 674000, 6580000), {}, null, null); created.push(madeA.id);
    const madeB = await importer.run(planFile('Minnesplan B', 675000, 6581000), {}, null, null); created.push(madeB.id);
    // The datasets as the shell has them, with the plan's facts.
    const planA = await datasets.get(madeA.id); const planB = await datasets.get(madeB.id);
    assert.ok(planA.kind === 'plan' && planA.plan && planA.plan.crs === 'EPSG:3006', 'a plan in SWEREF 99 TM: ' + JSON.stringify(planA.plan && planA.plan.crs));
    const wms = { url: 'https://wms.example.test/wms', layers: 'karta', format: 'image/png', transparent: false, attribution: 'Provkarta', version: '1.3.0' };
    await withApp((shell) => withConsent({ allow: true, remember: false }, async (asked) => {
      const { made, factory } = tiles();
      const where = target();
      const view = D.require('ui/bearbeta/plan-view').create(shell.ctx, { onTable() {}, tileFactory: factory });
      const q = (sel) => /** @type {any} */ (where.center.querySelector(sel));
      const map = () => { const el = q('.dm-plan-view'); return el && el._dmMap ? el._dmMap : null; };
      try {
        await view.render(planA, where);
        await waitFor(() => map(), 8000, 'the plan map');
        // In the plan's own grid, with a WMS as the background (the service entered before, so no dialog).
        change(q('[data-plan-projection]'), 'plan');
        await waitFor(() => map() && map().options.crs.code === 'EPSG:3006', 8000, 'the map in SWEREF 99 TM');
        view.state.wms = Object.assign({}, wms);
        change(q('[data-plan-basemap]'), 'wms');
        await waitFor(() => made.length === 1 && map() && map().hasLayer(made[0].layer), 8000, 'the WMS drawn');
        assert.ok(made[0].url === wms.url && made[0].opts.layers === 'karta' && made[0].opts.version === '1.1.1', 'the WMS in the plan\'s grid: ' + JSON.stringify({ url: made[0].url, version: made[0].opts.version }));
        // Another plan: no background map; its grid is the one shown, and the person turns it to Web Mercator.
        await view.render(planB, where);
        await waitFor(() => map(), 8000, 'the other plan');
        assert.ok(q('[data-plan-basemap]').value === 'none' && view.state.basemap === 'none' && made.length === 1, 'the other plan has none');
        change(q('[data-plan-projection]'), 'web');
        await waitFor(() => map() && map().options.crs.code === 'EPSG:3857', 8000, 'the other plan in Web Mercator');
        // Back: the WMS in the plan's grid again.
        await view.render(planA, where);
        await waitFor(() => made.length === 2 && map() && map().options.crs.code === 'EPSG:3006' && map().hasLayer(made[1].layer), 8000, 'the WMS again');
        assert.ok(q('[data-plan-basemap]').value === 'wms' && q('[data-plan-projection]').value === 'plan', 'the choices again');
        assert.ok(made[1].url === wms.url && made[1].opts.version === '1.1.1', 'the same service');
        assert.ok(asked.every((x) => x.purpose === 'basemaps' && x.host === 'wms.example.test'), 'asked only for the WMS host');
        const stored = await waitFor(async () => { const v = await idb.getSetting(memory.SETTING, null); return v && v[planA.id] && v[planB.id] ? v : null; }, 3000, 'the setting');
        assert.deepEqual(stored[planA.id].plan, { basemap: 'wms', projection: 'plan', wms, tiles: null }, 'the plan\'s choice in the setting');
        assert.deepEqual(stored[planB.id].plan, { basemap: 'none', projection: 'web', wms: null, tiles: null }, 'the other plan\'s grid');
      } finally { view.destroy(); where.host.remove(); }
      // A dataset that is gone leaves the setting at the next choice.
      await datasets.remove(planB.id);
      await memory.remember('plan', planA.id, { basemap: 'none', projection: 'web', wms: null, tiles: null });
      const after = await idb.getSetting(memory.SETTING, null);
      assert.ok(!after[planB.id] && after[planA.id], 'the removed plan is pruned');
      const all = {}; for (let i = 0; i < memory.MAX + 5; i++) all['x' + i] = { at: i, map: { basemap: 'osm' } };
      const trimmed = memory.trim(all, null);
      assert.ok(Object.keys(trimmed).length === memory.MAX && trimmed['x' + (memory.MAX + 4)] && !trimmed.x4, 'at most MAX, the latest kept');
    }));
    return 'ok';
  }, 60000);

  test('basemap memory: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
