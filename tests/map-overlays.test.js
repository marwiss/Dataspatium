// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for several datasets on one map in Bearbeta (ui/viz/map-overlays with ui/bearbeta/map-view, ui/viz/layer-list and the
 * hook `itemTrailing` in ui/dataset-list): Visa i kartan only beside the datasets that can be drawn (a table whose values are
 * places, a plan, a raster with a place) and only while a map shows, a table, a plan and a raster over the map at once with a
 * group and a colour each in the legend, the raster under the features, the plan in Boverket's colours, a click naming its
 * dataset, the map fitting them all, what a map shows remembered in a new view and after a reload, a removed dataset leaving
 * the map and a changed one drawn again, and a big one drawn in slices. Nothing touches the net: no background map, a stubbed
 * consent asker and tile factory, fetch spied; the setting, the session's choices and the datasets are put back afterwards.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const dsFiles = D.require('data/dataset-files');
  const plan = D.require('data/plan');
  const consent = D.require('platform/consent');
  const idb = D.require('platform/storage/idb');
  const theme = D.require('viz/theme');
  const overlaysMod = D.require('ui/viz/map-overlays');
  const fixture = D.require('tests/fixtures/geotiff');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 8000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const square = (lon, lat, d) => JSON.stringify({ type: 'Polygon', coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]] });
  const press = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();

  /** The suite's datasets, made once: two tables with places, two without, a comprehensive plan and a raster. */
  let made = null;
  async function fixtures() {
    if (made) return made;
    const areas = await datasets.create({ name: 'Överlagring områden', columns: [{ name: 'namn', type: 'text' }, { name: 'klass', type: 'text' }, { name: 'geometry', type: 'text' }], rows: [['Norr', 'A', square(17.0, 60.0, 0.4)], ['Söder', 'B', square(17.0, 59.4, 0.4)]] });
    const points = await datasets.create({ name: 'Överlagring punkter', columns: [{ name: 'id', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }, { name: 'antal', type: 'integer' }], rows: [['P1', 18.1, 60.6, 10], ['P2', 18.2, 60.7, 20], ['P3', 18.3, 59.2, 5]] });
    const plain = await datasets.create({ name: 'Överlagring utan plats', columns: [{ name: 'namn', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['a', 1], ['b', 2]] });
    // Named like coordinates, but the values are neither degrees nor a projected system: the values decide.
    const fake = await datasets.create({ name: 'Överlagring falska koordinater', columns: [{ name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [[1000, 5000], [2000, 6000]] });
    const row = (o) => plan.OP_COLUMNS.map((c) => (o[c.name] === undefined ? (c.name === 'ordning' ? 0 : '') : o[c.name]));
    const opPlan = await dsFiles.createDataset({ name: 'Överlagring översiktsplan', kind: 'plan', columns: plan.OP_COLUMNS, rows: [
      row({ objektid: 'o-1', tema: 'markochvattenanvandning', innehallstyp: 'Bostadsbebyggelse', namn: 'Bostäder', geometrityp: 'Polygon', geometri: square(17.5, 59.8, 0.1) }),
      row({ objektid: 'o-2', tema: 'markochvattenanvandning', innehallstyp: 'Grönområde', namn: 'Parken', geometrityp: 'Polygon', geometri: square(17.62, 59.8, 0.1) }),
    ], meta: { plan: { slag: 'oversiktsplan', namn: 'Överlagring översiktsplan', kommun: 'Testköping' } } });
    const raster = await fixture.rasterDataset({ name: 'Överlagring raster', files: [{ name: 'ruta.tif', bounds: [[60.45, 17.6], [60.3, 17.9]], width: 200, height: 160, color: '#3a6ea5' }] });
    made = { areas, points, plain, fake, opPlan, raster };
    for (const d of Object.values(made)) created.push(d.id);
    return made;
  }
  const record = (id) => datasets.get(id);

  /**
   * The app started off screen with the consent asker refusing and recording, fetch spied after the start, and the setting and
   * this session's choices put back afterwards (the writes under way are waited for first).
   */
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const kept = await idb.getSetting(overlaysMod.SETTING, null);
    const net = { asked: [], fetched: [] };
    consent.setAsker(async (purpose) => { net.asked.push(purpose); return { allow: false, remember: false }; });
    const realFetch = globalThis.fetch;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      globalThis.fetch = /** @type {any} */ ((input) => { net.fetched.push(String(input && input.url ? input.url : input)); return Promise.reject(new Error('nothing may be fetched here: ' + input)); });
      return await fn(shell, root, net);
    } finally {
      globalThis.fetch = realFetch;
      consent.setAsker(null);
      await overlaysMod.remember('dm-test-flush', []);
      if (kept === null) await idb.deleteSetting(overlaysMod.SETTING); else await idb.setSetting(overlaysMod.SETTING, kept);
      overlaysMod.reset();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  /** Where a view draws: a centre and an inspector off screen. */
  function target() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:800px; display:flex;';
    const center = document.createElement('div'); center.style.cssText = 'width:680px; height:700px; display:flex; flex-direction:column;';
    const right = document.createElement('div'); right.style.cssText = 'width:320px;';
    host.append(center, right);
    document.body.appendChild(host);
    return { host, center, right };
  }
  /** A tile factory that records, for maps that must never fetch. */
  function tiles() { const made2 = []; return { made: made2, factory: (url) => { made2.push(url); return /** @type {any} */ (globalThis).L.layerGroup(); } }; }
  /** Bearbeta's map view of a dataset with its own overlays, drawn off screen. */
  async function mapView(shell, id, overlays, factory) {
    const where = target();
    const view = D.require('ui/bearbeta/map-view').create(shell.ctx, { onTable() {}, tileFactory: factory, overlays });
    await view.render(await record(id), where);
    await waitFor(() => view.handle && overlays.hostId === id && !overlays.busy, 10000, 'the map with its overlays');
    return { view, where, close: () => { view.destroy(); where.host.remove(); } };
  }
  /** The legend's groups in the inspector, by their headings. */
  const legendGroups = (el) => Array.from(el.querySelectorAll('.dm-map-overlays [data-layer-legend] > .dm-map-legend-block > h5')).map((x) => x.textContent);

  test('map overlays: Visa i kartan beside the datasets that can be drawn, while Bearbeta shows a map, never beside its own; nothing asked or fetched', async (assert) => {
    const f = await fixtures();
    await withApp(async (shell, root, net) => {
      shell.activate('bearbeta');
      shell.store.set({ selectedId: f.areas.id });
      await waitFor(() => root.querySelector('.dm-center .dm-map-view.leaflet-container'), 10000, 'the map in Bearbeta');
      const left = /** @type {HTMLElement} */ (root.querySelector('.dm-left'));
      const toggleOf = (id) => left.querySelector(`[data-overlay-toggle="${id}"]`);
      const pending = (id) => left.querySelector(`[data-overlay-pending="${id}"]`);
      await waitFor(() => toggleOf(f.points.id) && toggleOf(f.opPlan.id) && toggleOf(f.raster.id) && !pending(f.fake.id), 10000, 'the toggles');
      assert.ok(!toggleOf(f.areas.id), 'none beside the map\'s own dataset');
      assert.ok(!toggleOf(f.plain.id) && !pending(f.plain.id), 'none beside a table without places');
      assert.ok(!toggleOf(f.fake.id), 'none beside a table whose values are not places');
      for (const d of [f.points, f.opPlan, f.raster]) {
        const btn = /** @type {HTMLElement} */ (toggleOf(d.id).querySelector('button'));
        assert.equal(btn.getAttribute('aria-label'), t('overlay.show', { name: d.name }), 'named for screen readers');
        assert.equal(btn.getAttribute('data-tip'), t('overlay.show.hint', { name: d.name }), 'a tip');
        assert.equal(btn.getAttribute('aria-pressed'), 'false', 'not shown yet');
      }
      // Shown over the map: pressed, and a group of its own beside the map's in the inspector.
      press(toggleOf(f.points.id));
      const right = /** @type {HTMLElement} */ (root.querySelector('.dm-right'));
      await waitFor(() => right.querySelector('.dm-map-overlays[data-overlays="1"] [data-layer-legend]'), 10000, 'the overlay in the inspector');
      assert.equal(toggleOf(f.points.id).querySelector('button').getAttribute('aria-pressed'), 'true', 'pressed');
      assert.equal(toggleOf(f.points.id).querySelector('button').getAttribute('data-tip'), t('overlay.hide.hint', { name: f.points.name }), 'its tip says it takes it off');
      assert.deepEqual(legendGroups(right), [f.areas.name, f.points.name], 'the map\'s own dataset and the one over it, each a group');
      // The table has no toggles; back on the map they come again, with the choice kept.
      const buttonByText = (text) => Array.from(root.querySelectorAll('.dm-center dm-button')).find((b) => b.textContent.trim() === text);
      press(await waitFor(() => buttonByText(t('bearbeta.view.table')), 5000, 'Visa som tabell'));
      await waitFor(() => root.querySelector('.dm-center dm-table') && !left.querySelector('[data-overlay-toggle]'), 8000, 'no toggles beside the table');
      press(await waitFor(() => buttonByText(t('bearbeta.view.map')), 5000, 'Visa som karta'));
      await waitFor(() => toggleOf(f.points.id) && toggleOf(f.points.id).querySelector('button[aria-pressed="true"]') && right.querySelector('.dm-map-overlays[data-overlays="1"]'), 10000, 'the map again with its overlay');
      // Taken off again.
      press(toggleOf(f.points.id));
      await waitFor(() => right.querySelector('[data-overlay-hint]'), 8000, 'the map alone');
      assert.equal(toggleOf(f.points.id).querySelector('button').getAttribute('aria-pressed'), 'false');
      assert.deepEqual([net.asked, net.fetched], [[], []], 'nothing asked, nothing fetched');
    });
    return 'ok';
  }, 60000);

  test('map overlays: a table, a plan and a raster over a map at once, each a group with its own colour, the raster under the features, the plan in Boverket\'s colours, a click naming its dataset, and the map fitting them all', async (assert) => {
    const f = await fixtures();
    await withApp(async (shell, _root, net) => {
      shell.store.set({ selectedId: f.areas.id });
      const { made: tileUrls, factory } = tiles();
      const overlays = overlaysMod.create(shell.ctx);
      const mv = await mapView(shell, f.areas.id, overlays, factory);
      try {
        const { view, where } = mv;
        assert.ok(where.right.querySelector('[data-overlay-hint]'), 'a line on how to show more');
        for (const id of [f.points.id, f.opPlan.id, f.raster.id]) await overlays.toggle(id);
        assert.deepEqual(overlays.shown, [f.points.id, f.opPlan.id, f.raster.id], 'in the order they were shown');
        await waitFor(() => where.right.querySelector('.dm-map-overlays[data-overlays="3"]'), 8000, 'three in the inspector');
        assert.deepEqual(legendGroups(where.right), [f.areas.name, f.points.name, f.opPlan.name, f.raster.name], 'a legend group per dataset');
        assert.deepEqual(Array.from(where.right.querySelectorAll('.dm-map-overlays [data-layer-group]')).map((g) => g.getAttribute('data-layer-group')), [f.areas.id, f.points.id, f.opPlan.id, f.raster.id], 'and a group per dataset in the list');
        // Colours: the points take the palette's next colour after the map's own.
        const palette = theme.tokens().palette.map((c) => c.toLowerCase());
        const own = String(view.handle.groups[0].group.getLayers()[0].options.fillColor).toLowerCase();
        const dots = overlays.groups(f.points.id)[0].group.getLayers();
        assert.equal(dots.length, 3, 'three points');
        assert.ok(own === palette[0] && String(dots[0].options.fillColor).toLowerCase() === palette[1], `its own colour: ${dots[0].options.fillColor} beside ${own}`);
        // The plan keeps Boverket's colours.
        const housing = overlays.groups(f.opPlan.id).flatMap((g) => g.group.getLayers()).find((l) => l.feature && l.feature.properties._i === 0);
        assert.equal(housing.options.fillColor, plan.opFillOf({ tema: 'markochvattenanvandning', innehallstyp: 'Bostadsbebyggelse' }), 'Boverket\'s colour for housing');
        // The raster lies in the tile pane, under the features.
        const img = /** @type {HTMLElement} */ (await waitFor(() => where.center.querySelector('.leaflet-tile-pane > img.dm-raster-image'), 5000, 'the raster'));
        assert.ok(Number(img.style.zIndex) >= 3, 'above a raster of the map\'s own: ' + img.style.zIndex);
        const z = (sel) => Number(getComputedStyle(/** @type {Element} */ (where.center.querySelector(sel))).zIndex);
        assert.ok(where.center.querySelector('.leaflet-overlay-pane canvas'), 'the features on the canvas');
        await waitFor(() => z('.leaflet-overlay-pane') > z('.leaflet-tile-pane'), 3000, 'the features above the tile pane');
        // The map fits everything shown.
        const all = overlays.extend(view.handle.groups[0].group.getBounds());
        await waitFor(() => view.handle.map.getBounds().pad(0.02).contains(all), 5000, 'the map fitted to all');
        // A click on a point names its dataset in the inspector, with the row's attributes.
        dots[0].fire('click');
        const chosen = await waitFor(() => where.right.querySelector(`dm-kv[data-overlay-selected="${f.points.id}"]`), 5000, 'the chosen feature');
        assert.ok(Array.from(where.right.querySelectorAll('h4')).some((x) => x.textContent === t('overlay.selected', { name: f.points.name })), 'under its dataset\'s name');
        assert.ok(chosen.textContent.includes('P1') && chosen.textContent.includes('antal'), 'its attributes: ' + chosen.textContent);
        assert.ok(!Array.from(where.right.querySelectorAll('p')).some((p) => p.textContent === t('map.help')), 'the map\'s own help gives way');
        // Hidden from the list: off the map, and out of the legend.
        const sw = /** @type {any} */ (where.right.querySelector(`.dm-map-overlays [data-layer-switch="${overlays.groups(f.opPlan.id)[0].key}"]`));
        sw.querySelector('input').click();
        assert.ok(!view.handle.map.hasLayer(overlays.groups(f.opPlan.id)[0].group), 'the plan\'s layer off the map');
        assert.deepEqual([net.asked, net.fetched, tileUrls], [[], [], []], 'nothing asked, fetched or tiled');
      } finally { mv.close(); }
      assert.equal(overlays.hostId, null, 'let go with the view');
    });
    return 'ok';
  }, 60000);

  test('map overlays: what a map shows is remembered by its dataset, in a new view and after a reload, without asking', async (assert) => {
    const f = await fixtures();
    await withApp(async (shell, _root, net) => {
      shell.store.set({ selectedId: f.areas.id });
      const { factory } = tiles();
      let overlays = overlaysMod.create(shell.ctx);
      let mv = await mapView(shell, f.areas.id, overlays, factory);
      await overlays.toggle(f.points.id);
      await overlays.toggle(f.opPlan.id);
      mv.close();
      const stored = await waitFor(async () => { const v = await idb.getSetting(overlaysMod.SETTING, null); return v && v[f.areas.id] && v[f.areas.id].ids.length === 2 ? v : null; }, 3000, 'the setting');
      assert.deepEqual(stored[f.areas.id].ids, [f.points.id, f.opPlan.id], 'kept by the map\'s dataset id');
      // A new view of the same map, later in the session: the same datasets drawn, and pressed in the list.
      overlays = overlaysMod.create(shell.ctx);
      mv = await mapView(shell, f.areas.id, overlays, factory);
      const list = document.createElement('div');
      list.style.cssText = 'position:absolute; left:-10000px; width:280px;';
      document.body.appendChild(list);
      try {
        assert.deepEqual(overlays.shown, [f.points.id, f.opPlan.id], 'the same in a new view');
        assert.ok(overlays.groups(f.points.id)[0].count === 3 && overlays.groups(f.opPlan.id).length, 'drawn again');
        const all = await Promise.all([f.areas.id, f.points.id, f.opPlan.id, f.raster.id].map(record));
        D.require('ui/dataset-list').render(list, { datasets: all, selectedId: f.areas.id, onSelect() {}, itemTrailing: overlays.itemTrailing });
        await waitFor(() => list.querySelector(`[data-overlay-toggle="${f.points.id}"]`), 5000, 'the toggle');
        const pressed = Array.from(list.querySelectorAll('[data-overlay-toggle] button[aria-pressed="true"]')).map((b) => b.parentElement.getAttribute('data-overlay-toggle')).sort();
        assert.deepEqual(pressed, [f.points.id, f.opPlan.id].sort(), 'pressed in the list');
        mv.close();
        // Another map has its own choice.
        const other = await mapView(shell, f.points.id, overlays, factory);
        assert.deepEqual(overlays.shown, [], 'nothing over another map');
        other.close();
        // After a reload the setting brings them back, asking nothing and fetching nothing.
        overlaysMod.reset();
        overlays = overlaysMod.create(shell.ctx);
        mv = await mapView(shell, f.areas.id, overlays, factory);
        assert.deepEqual(overlays.shown, [f.points.id, f.opPlan.id], 'and after a reload, from the setting');
        assert.ok(mv.where.right.querySelector('.dm-map-overlays[data-overlays="2"]'), 'in the inspector');
        assert.deepEqual([net.asked, net.fetched], [[], []], 'nothing asked, nothing fetched');
      } finally { mv.close(); list.remove(); }
    });
    return 'ok';
  }, 60000);

  test('map overlays: a dataset removed leaves the map and the setting, and one changed is drawn again', async (assert) => {
    const f = await fixtures();
    const gone = await datasets.create({ name: 'Överlagring tas bort', columns: [{ name: 'namn', type: 'text' }, { name: 'geometry', type: 'text' }], rows: [['X', square(16.5, 59.6, 0.2)]] });
    const grows = await datasets.create({ name: 'Överlagring växer', columns: [{ name: 'id', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [['A', 16.8, 60.2], ['B', 16.9, 60.3]] });
    created.push(gone.id, grows.id);
    await withApp(async (shell) => {
      shell.store.set({ selectedId: f.areas.id });
      const { factory } = tiles();
      const overlays = overlaysMod.create(shell.ctx);
      const mv = await mapView(shell, f.areas.id, overlays, factory);
      try {
        await overlays.toggle(grows.id);
        await overlays.toggle(gone.id);
        const group = overlays.groups(gone.id)[0].group;
        assert.ok(mv.view.handle.map.hasLayer(group), 'on the map');
        // A row added to a dataset shown: drawn again with it.
        await datasets.appendRows(grows.id, { columns: ['id', 'lon', 'lat'], rows: [['C', 17.0, 60.4]] });
        await waitFor(() => overlays.groups(grows.id).length && overlays.groups(grows.id)[0].count === 3 && !overlays.busy, 8000, 'the new row drawn');
        // A dataset removed: off the map, out of the list and the setting.
        const removed = overlays.groups(gone.id)[0].group;
        await datasets.remove(gone.id);
        await waitFor(() => !overlays.shown.includes(gone.id) && !mv.view.handle.map.hasLayer(removed) && !overlays.busy, 8000, 'the removed dataset off the map');
        assert.deepEqual(overlays.shown, [grows.id], 'the other stays');
        await waitFor(() => !mv.where.right.querySelector(`[data-layer-group="${gone.id}"]`), 5000, 'out of the inspector');
        const stored = await waitFor(async () => { const v = await idb.getSetting(overlaysMod.SETTING, null); return v && v[f.areas.id] && !v[f.areas.id].ids.includes(gone.id) ? v : null; }, 3000, 'the setting');
        assert.deepEqual(stored[f.areas.id].ids, [grows.id], 'and out of the setting');
      } finally { mv.close(); }
    });
    return 'ok';
  }, 60000);

  test('map overlays: a big dataset is read and drawn in slices, letting other work run between them', async (assert) => {
    const f = await fixtures();
    const rows = Array.from({ length: 6000 }, (_, i) => [`B${i}`, 16 + (i % 100) * 0.02, 59 + Math.floor(i / 100) * 0.02]);
    const big = await datasets.create({ name: 'Överlagring stor', columns: [{ name: 'id', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows });
    created.push(big.id);
    let result = '';
    await withApp(async (shell) => {
      shell.store.set({ selectedId: f.areas.id });
      const { factory } = tiles();
      const overlays = overlaysMod.create(shell.ctx);
      const mv = await mapView(shell, f.areas.id, overlays, factory);
      try {
        let ticks = 0; let gap = 0; let last = performance.now(); let running = true;
        const probe = () => { const now = performance.now(); gap = Math.max(gap, now - last); last = now; ticks++; if (running) setTimeout(probe, 0); };
        setTimeout(probe, 0);
        const t0 = performance.now();
        await overlays.toggle(big.id);
        running = false;
        const elapsed = performance.now() - t0;
        assert.equal(overlays.groups(big.id)[0].count, 6000, 'every point drawn');
        assert.ok(ticks > 1, 'other work ran while it was read and drawn: ' + ticks);
        result = `6000 points in ${Math.round(elapsed)} ms, ${ticks} turns for other work, the longest wait ${Math.round(gap)} ms`;
      } finally { mv.close(); }
    });
    return result;
  }, 60000);

  test('map overlays: dm-button pressed says its state, and the setting keeps only maps and datasets that exist', async (assert) => {
    const basic = D.require('ui/basic');
    const btn = basic.button({ label: 'x', icon: 'eye', 'icon-only': true, pressed: 'true' });
    document.body.appendChild(btn);
    try {
      assert.equal(btn.querySelector('button').getAttribute('aria-pressed'), 'true');
      btn.setAttribute('pressed', 'false');
      assert.equal(btn.querySelector('button').getAttribute('aria-pressed'), 'false');
      btn.removeAttribute('pressed');
      assert.equal(btn.querySelector('button').getAttribute('aria-pressed'), null, 'a plain button again');
    } finally { btn.remove(); }
    const trimmed = overlaysMod.trim({ a: { at: 2, ids: ['b', 'gone', 'a'] }, gone: { at: 3, ids: ['a'] }, c: { at: 1, ids: ['gone'] }, d: 'x' }, new Set(['a', 'b', 'c']));
    assert.deepEqual(trimmed, { a: { at: 2, ids: ['b'] } }, 'a map that is gone, one left with nothing and the map itself go');
    return 'ok';
  });

  test('map overlays: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
