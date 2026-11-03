// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for cross-tab sync (BroadcastChannel, Web Locks), WKT geometry parsing and the skip link. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const sync = D.require('platform/sync');
  const geo = D.require('data/geo');
  const builder = D.require('viz/vega-builder');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const created = [];
  function waitFor(fn, ms, what) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      (function tick() { let v; try { v = fn(); } catch (_e) { v = null; } if (v) return resolve(v); if (performance.now() - t0 > ms) return reject(new Error('timeout: ' + what)); setTimeout(tick, 50); })();
    });
  }
  /** Another tab stands in as a second BroadcastChannel in this page. */
  function otherTab() {
    const ch = new BroadcastChannel(sync.NAME);
    const received = [];
    ch.onmessage = (e) => received.push(e.data);
    return { ch, received, post: (msg) => ch.postMessage(Object.assign({ tab: 'tab_other', at: Date.now() }, msg)), close: () => ch.close() };
  }

  test('sync: saves are broadcast to other tabs and remote changes drop stale handles and notify', async (assert) => {
    assert.ok(sync.supported, 'BroadcastChannel available');
    const other = otherTab();
    try {
      const meta = await importer.run(new File(['a;b\n1;2\n'], 'sync.csv', { type: 'text/csv' }), {}, null, 'Fliktest');
      created.push(meta.id);
      await waitFor(() => other.received.some((m) => m.kind === 'datasets' && m.action === 'created' && m.payload.id === meta.id), 3000, 'created broadcast');
      await datasets.save(meta.id);
      await waitFor(() => other.received.some((m) => m.kind === 'datasets' && m.action === 'saved' && m.payload.id === meta.id && m.payload.name === 'Fliktest'), 3000, 'saved broadcast');
      assert.ok(other.received.every((m) => m.tab === sync.tabId), 'messages carry this tab id');
      // A remote save of a dataset we hold open: the handle is closed and a 'remote' event tells the UI.
      await datasets.query(meta.id);
      const events = [];
      const unsub = datasets.subscribe((type, payload) => { if (type === 'remote') events.push(payload); });
      other.post({ kind: 'datasets', action: 'saved', payload: { id: meta.id, name: 'Fliktest' } });
      await waitFor(() => events.length === 1, 3000, 'remote event');
      unsub();
      assert.equal(events[0].action, 'saved');
      assert.equal((await datasets.query(meta.id)).length, 1, 'dataset reopens from IndexedDB');
      // Our own messages are ignored.
      const before = events.length;
      sync.broadcast('datasets', 'saved', { id: meta.id });
      await new Promise((r) => setTimeout(r, 150));
      assert.equal(events.length, before, 'own broadcasts do not loop back');
      const value = await sync.withLock('test', async () => 42);
      assert.equal(value, 42, 'withLock runs the function');
      return other.received.length + ' messages';
    } finally { other.close(); }
  }, 20000);

  test('sync: WKT geometries parse and draw on the map', async (assert) => {
    const poly = geo.wktToGeoJson('POLYGON((600000 6500000, 600000 6501000, 601000 6501000, 600000 6500000))');
    assert.equal(poly.type, 'Polygon'); assert.equal(poly.coordinates[0].length, 4);
    const holes = geo.wktToGeoJson('POLYGON ((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 4, 4 4, 2 2))');
    assert.equal(holes.coordinates.length, 2, 'inner ring kept');
    assert.deepEqual(geo.wktToGeoJson('POINT (18.07 59.33)'), { type: 'Point', coordinates: [18.07, 59.33] });
    assert.deepEqual(geo.wktToGeoJson('SRID=3006;POINT Z (1 2 3)'), { type: 'Point', coordinates: [1, 2] }, 'SRID prefix and Z dropped');
    assert.equal(geo.wktToGeoJson('MULTIPOLYGON(((0 0,0 1,1 1,0 0)),((5 5,5 6,6 6,5 5)))').coordinates.length, 2);
    assert.deepEqual(geo.wktToGeoJson('MULTIPOINT((1 2),(3 4))').coordinates, [[1, 2], [3, 4]]);
    assert.deepEqual(geo.wktToGeoJson('MULTIPOINT(1 2, 3 4)').coordinates, [[1, 2], [3, 4]]);
    assert.equal(geo.wktToGeoJson('LINESTRING(0 0, 1 1)').type, 'LineString');
    assert.equal(geo.wktToGeoJson('POLYGON EMPTY'), null);
    assert.equal(geo.wktToGeoJson('hello'), null);
    assert.equal(geo.parseGeometry('{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]}}').type, 'Point', 'features unwrap');
    assert.equal(geo.parseGeometry(''), null);
    assert.ok(geo.isProjected([poly]) && !geo.isProjected([geo.wktToGeoJson('POINT (18 59)')]));
    const columns = [{ name: 'namn', type: 'text' }, { name: 'wkt', type: 'text' }, { name: 'varde', type: 'number' }];
    const state = builder.defaultState('map', columns);
    assert.equal(state.x.field, 'wkt', 'wkt column picked as geometry');
    const spec = builder.toSpec(state, columns, { values: [{ namn: 'A', wkt: 'POLYGON((600000 6500000, 600000 6501000, 601000 6501000, 600000 6500000))', varde: 1 }, { namn: 'B', wkt: 'not geometry', varde: 2 }] });
    assert.equal(spec.data.values.length, 1, 'unparsable geometry rows are dropped');
    assert.equal(spec.data.values[0].wkt.type, 'Feature');
    assert.equal(spec.data.values[0].wkt.geometry.type, 'Polygon');
    assert.equal(spec.projection.type, 'identity');
    return 'ok';
  });

  test('sync: the shell has a skip link to the main content and labelled panes', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const skip = /** @type {HTMLElement} */ (root.querySelector('a.dm-skip'));
      assert.ok(skip && skip.getAttribute('href') === '#dm-center', 'skip link present');
      skip.click();
      assert.equal(document.activeElement, root.querySelector('#dm-center'), 'main content focused');
      assert.ok(root.querySelector('aside.dm-left[aria-label]') && root.querySelector('aside.dm-right[aria-label]'), 'panes labelled');
      assert.ok(shell.store.get().mode, 'shell started');
      return 'ok';
    } finally { root.remove(); }
  }, 30000);

  test('sync: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    assert.ok(true);
  });
})();
