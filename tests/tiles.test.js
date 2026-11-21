// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the OGC API – Tiles client against a simulated service (D.net.virtual): the landing page, /collections, the
 * tile set lists and /tileMatrixSets; templates in Web Mercator for Leaflet, the sets the map cannot draw (vector tiles,
 * another grid) with their reasons, consent "basemaps" once per reading, tiles as background and layer through the tile
 * factory (never the net), and the dialog in a map view.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const ogc = D.require('api/ogc-tiles');
  const leaflet = D.require('viz/leaflet');
  const consent = D.require('platform/consent');
  const t = D.require('ui/i18n').t;
  const B = 'dataspatium-asset://tests/geo/ogt/api';
  const P = '/geo/ogt/api';
  const REL = 'http://www.opengis.net/def/rel/ogc/1.0/';
  const URI = 'http://www.opengis.net/def/tilematrixset/OGC/1.0/';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const item = (href, type) => ({ rel: 'item', type, templated: true, href });
  /** The simulated service: path → JSON. */
  const ROUTES = {
    [P]: { title: 'Testgeodata', attribution: '<a href="https://x">© Testverket</a> &amp; co', links: [{ rel: 'self', href: B }, { rel: 'data', href: B + '/collections' }, { rel: REL + 'tiling-schemes', href: B + '/tileMatrixSets' }, { rel: REL + 'tilesets-map', href: B + '/map/tiles' }] },
    [P + '/collections']: { collections: [
      { id: 'orto', title: 'Ortofoto', links: [{ rel: REL + 'tilesets-map', href: P + '/collections/orto/map/tiles' }] },
      { id: 'vagar', title: 'Vägar', links: [{ rel: REL + 'tilesets-vector', href: B + '/collections/vagar/tiles' }] },
      { id: 'punkter', title: 'Punkter', links: [{ rel: 'items', href: B + '/collections/punkter/items' }] },
    ] },
    [P + '/map/tiles']: { tilesets: [{ title: 'Webbkarta', dataType: 'map', tileMatrixSetURI: URI + 'WebMercatorQuad', links: [{ rel: 'self', href: B + '/map/tiles/WebMercatorQuad' }, item(B + '/map/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=png', 'image/png')] }] },
    [P + '/collections/orto/map/tiles']: { tilesets: [
      { title: 'SWEREF 99 TM', dataType: 'map', tileMatrixSetURI: URI + 'SWEREF99TM', crs: 'http://www.opengis.net/def/crs/EPSG/0/3006', links: [{ rel: 'self', href: B + '/collections/orto/map/tiles/SWEREF99TM' }] },
      { title: 'Webbkarta', dataType: 'map', tileMatrixSetId: 'WebMercatorQuad', links: [{ rel: 'self', href: B + '/collections/orto/map/tiles/WebMercatorQuad' }] },
      { title: 'Egen 3857', dataType: 'map', tileMatrixSetURI: B + '/tileMatrixSets/Egen3857', links: [{ rel: REL + 'tiling-scheme', href: B + '/tileMatrixSets/Egen3857' }, item(B + '/collections/orto/map/tiles/Egen3857/{tileMatrix}/{tileRow}/{tileCol}.jpg', 'image/jpeg')] },
    ] },
    [P + '/collections/orto/map/tiles/WebMercatorQuad']: { title: 'Ortofoto', attribution: 'Ortofoto © Testverket', tileMatrixSetLimits: [5, 8, 12].map((z) => ({ tileMatrix: String(z), minTileRow: 0, maxTileRow: 2 ** z - 1, minTileCol: 0, maxTileCol: 2 ** z - 1 })),
      links: [item(P + '/collections/orto/map/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}.png', 'image/png')] },
    [P + '/collections/orto/map/tiles/SWEREF99TM']: { links: [item(B + '/collections/orto/map/tiles/SWEREF99TM/{tileMatrix}/{tileRow}/{tileCol}.png', 'image/png')] },
    [P + '/tileMatrixSets/SWEREF99TM']: { id: 'SWEREF99TM', crs: 'http://www.opengis.net/def/crs/EPSG/0/3006', tileMatrices: [{ id: '0', scaleDenominator: 14628571.428, cellSize: 4096, pointOfOrigin: [-1200000, 8500000], tileWidth: 256, tileHeight: 256, matrixWidth: 3, matrixHeight: 5 }] },
    [P + '/tileMatrixSets/Egen3857']: { id: 'Egen3857', crs: 'http://www.opengis.net/def/crs/EPSG/0/3857', tileMatrices: [2, 3, 4].map((z) => ({ id: 'EPSG:3857:' + z, scaleDenominator: 559082264.0287178 / 2 ** z, pointOfOrigin: [-20037508.3427892, 20037508.3427892], cornerOfOrigin: 'topLeft', tileWidth: 256, tileHeight: 256, matrixWidth: 2 ** z, matrixHeight: 2 ** z })) },
    [P + '/collections/vagar/tiles']: { tilesets: [{ title: 'Vektor', dataType: 'vector', tileMatrixSetURI: URI + 'WebMercatorQuad', links: [item(B + '/collections/vagar/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}', 'application/vnd.mapbox-vector-tile')] }] },
  };
  const served = [];
  function serve() {
    D.net.virtual('tests/geo/ogt/', (url) => {
      served.push(url);
      const path = new URL(url).pathname.replace(/\/+$/, '');
      const body = ROUTES[path];
      return Promise.resolve(body ? { kind: 'text', data: JSON.stringify(body) } : { kind: 'text', data: '{"code":"NotFound"}', status: 404 });
    });
    D.net.virtual('tests/geo/ogt-empty/', () => Promise.resolve({ kind: 'text', data: JSON.stringify({ title: 'Tom', links: [] }) }));
  }
  /** Consent "basemaps" asked through a stub (the test page grants every purpose through localStorage otherwise). */
  async function withConsent(answer, fn) {
    const key = 'dataspatium.consent';
    const override = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('basemaps');
    await consent.set('basemaps', null);
    const asked = [];
    let allow = answer;
    consent.setAsker(async (purpose, info) => { asked.push(purpose + ':' + info.host); return { allow, remember: false }; });
    try { return await fn(asked, (v) => { allow = v; }); } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (override !== null) localStorage.setItem(key, override);
    }
  }

  test('tiles: addresses, tile matrix sets and templates', async (assert) => {
    assert.deepEqual(ogc.landingOf('https://x.se/ogc/collections/orto/map/tiles/WebMercatorQuad?f=json'), { landing: 'https://x.se/ogc', collection: 'orto' });
    assert.deepEqual(ogc.landingOf('https://x.se/ogc/'), { landing: 'https://x.se/ogc', collection: '' });
    assert.deepEqual(ogc.landingOf('https://x.se/ogc/tileMatrixSets/WebMercatorQuad'), { landing: 'https://x.se/ogc', collection: '' });
    assert.deepEqual(ogc.landingOf('https://x.se/ogc/map/tiles'), { landing: 'https://x.se/ogc', collection: '' });
    assert.equal(ogc.resolveHref('/a/{tileMatrix}/{tileRow}/{tileCol}.png', 'https://x.se/ogc/collections'), 'https://x.se/a/{tileMatrix}/{tileRow}/{tileCol}.png', 'placeholders survive resolving');
    assert.ok(ogc.WEB_MERCATOR.test('WebMercatorQuad') && ogc.WEB_MERCATOR.test('GoogleMapsCompatible') && !ogc.WEB_MERCATOR.test('WorldCRS84Quad'));
    const egen = ROUTES[P + '/tileMatrixSets/Egen3857'];
    const levels = ogc.webMercatorLevels(egen);
    assert.deepEqual(Array.from(levels.entries()), [['EPSG:3857:2', 2], ['EPSG:3857:3', 3], ['EPSG:3857:4', 4]]);
    assert.equal(ogc.matrixPattern(levels), 'EPSG:3857:{z}');
    assert.equal(ogc.matrixPattern(new Map([['0', 0], ['1', 1]])), '{z}');
    assert.equal(ogc.matrixPattern(new Map([['a', 0], ['b', 1]])), null, 'names that are not zoom levels');
    assert.equal(ogc.webMercatorLevels(ROUTES[P + '/tileMatrixSets/SWEREF99TM']), null, 'SWEREF 99 TM is another grid');
    assert.equal(ogc.webMercatorLevels(Object.assign({}, egen, { tileMatrices: egen.tileMatrices.map((m) => Object.assign({}, m, { tileWidth: 512 })) })), null, '512-pixel tiles are another grid');
    assert.equal(ogc.webMercatorLevels(Object.assign({}, egen, { tileMatrices: egen.tileMatrices.map((m) => Object.assign({}, m, { cornerOfOrigin: 'bottomLeft' })) })), null);
    // Leaflet takes only http(s) addresses with {z}, {x} and {y}; the attribution is escaped (Leaflet shows it as HTML).
    assert.equal(leaflet.tilesSource({ template: 'javascript:alert(1)//{z}/{x}/{y}' }), null);
    assert.equal(leaflet.tilesSource({ template: 'https://x.se/{z}/{x}.png' }), null);
    const src = leaflet.tilesSource({ template: 'https://x.se/{z}/{y}/{x}.png', attribution: '<img src=x onerror=alert(1)>', minNativeZoom: 2, maxNativeZoom: 12 });
    assert.equal(src.url, 'https://x.se/{z}/{y}/{x}.png');
    assert.equal(src.attribution, '&lt;img src=x onerror=alert(1)&gt;');
    assert.deepEqual(src.native, { minNativeZoom: 2, maxNativeZoom: 12 });
    assert.ok(leaflet.BASEMAPS.includes('tiles'));
    return 'ok';
  });

  test('tiles: a service is read from its landing page after one consent, and its tile sets become Web Mercator templates or say why not', async (assert) => {
    serve();
    await withConsent(true, async (asked) => {
      const reader = ogc.client();
      served.length = 0;
      const service = await ogc.discover(B + '/collections/orto?f=json', reader);
      assert.equal(service.landing, B); assert.equal(service.collection, 'orto'); assert.equal(service.title, 'Testgeodata');
      assert.equal(service.attribution, '© Testverket & co', 'the attribution as plain text');
      assert.deepEqual(service.sources.map((s) => [s.key, s.title, s.kind]), [['map:', 'Testgeodata', 'map'], ['map:orto', 'Ortofoto', 'map'], ['vector:vagar', 'Vägar', 'vector']], 'the dataset first; a collection without tiles is left out');
      assert.equal(service.sources[1].url, B + '/collections/orto/map/tiles', 'a root-relative link resolved against the service');
      assert.equal(service.tileMatrixSets, B + '/tileMatrixSets');
      assert.ok(served.every((u) => new URL(u).searchParams.get('f') === 'json'), 'JSON asked for: ' + served.join(' '));
      // The collection's sets: Web Mercator first.
      const sets = await ogc.tilesets(service.sources[1], reader);
      assert.deepEqual(sets.map((s) => [s.id, s.webMercator]), [['WebMercatorQuad', true], ['SWEREF99TM', false], ['Egen3857', false]]);
      // WebMercatorQuad without a template in the list: its own document gives it, with the levels the service has.
      const web = await ogc.resolve(sets[0], service, reader);
      assert.equal(web.template, B + '/collections/orto/map/tiles/WebMercatorQuad/{z}/{y}/{x}.png');
      assert.deepEqual([web.minNativeZoom, web.maxNativeZoom, web.format, web.attribution], [5, 12, 'image/png', 'Ortofoto © Testverket']);
      // SWEREF 99 TM is read from /tileMatrixSets and refused; a set in Web Mercator's grid under another name is drawn.
      await assert.throws(() => ogc.resolve(sets[1], service, reader), new RegExp(t('map.tiles.err.tms', { tms: 'SWEREF99TM' }).slice(0, 20)));
      const own = await ogc.resolve(sets[2], service, reader);
      assert.equal(own.template, B + '/collections/orto/map/tiles/Egen3857/EPSG:3857:{z}/{y}/{x}.jpg');
      assert.deepEqual([own.minNativeZoom, own.maxNativeZoom, own.format, own.attribution], [2, 4, 'image/jpeg', '© Testverket & co']);
      // The dataset's own tiles keep their query string; vector tiles are listed but cannot be drawn.
      const whole = await ogc.resolve((await ogc.tilesets(service.sources[0], reader))[0], service, reader);
      assert.equal(whole.template, B + '/map/tiles/WebMercatorQuad/{z}/{y}/{x}?f=png');
      assert.deepEqual([whole.minNativeZoom, whole.maxNativeZoom], [0, 24]);
      const vector = await ogc.tilesets(service.sources[2], reader);
      await assert.throws(() => ogc.resolve(vector[0], service, reader), /Mapbox Vector Tiles/);
      assert.deepEqual(asked, ['basemaps:tests'], 'asked once for the whole reading');
      // A service without tiles says so; a new reading asks again.
      await assert.throws(() => ogc.discover('dataspatium-asset://tests/geo/ogt-empty/api', ogc.client()), new RegExp(t('map.tiles.err.none')));
      assert.equal(asked.length, 2);
      await assert.throws(() => ogc.discover('ftp://x.se/ogc', ogc.client()));
    });
    await withConsent(false, async () => {
      served.length = 0;
      await assert.throws(() => ogc.discover(B, ogc.client()));
      assert.equal(served.length, 0, 'nothing read without consent');
    });
    return 'ok';
  }, 30000);

  test('tiles: map tiles as background and layer go through the tile factory after consent, only in Web Mercator', async (assert) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute; left:-10000px; top:0; width:600px; height:400px;';
    document.body.appendChild(el);
    try {
      await withConsent(true, async (asked, setAllow) => {
        const background = { url: B, collection: 'orto', tileset: 'WebMercatorQuad', template: B + '/collections/orto/map/tiles/WebMercatorQuad/{z}/{y}/{x}.png', minNativeZoom: 5, maxNativeZoom: 12, attribution: '<b>Test</b>' };
        const layer = leaflet.tilesLayer({ url: B, collection: 'orto', tileset: 'Egen3857', title: 'Egen', template: B + '/collections/orto/map/tiles/Egen3857/EPSG:3857:{z}/{y}/{x}.jpg', minNativeZoom: 2, maxNativeZoom: 4, attribution: '' });
        assert.equal(layer.kind, 'tiles'); assert.equal(layer.name, 'Egen');
        const chart = { kind: 'map', name: 'Rutor', map: { layers: [layer], basemap: 'tiles', tiles: background, custom: { url: '', attribution: '' }, legend: true, height: 400 } };
        const made = [];
        const factory = (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; };
        const hd = await leaflet.render(el, chart, { tileFactory: factory });
        assert.deepEqual(made.map((m) => [m.url, m.opts.minNativeZoom, m.opts.maxNativeZoom, m.opts.opacity, m.opts.attribution, m.opts.layers]),
          [[background.template, 5, 12, undefined, '&lt;b&gt;Test&lt;/b&gt;', undefined], [layer.tiles.template, 2, 4, 1, '', undefined]], 'background first, then the layer, as plain tile layers');
        assert.equal(hd.legend.length, 0, 'no legend for tiles'); assert.equal(hd.overlays.length, 1);
        assert.ok(asked.length >= 1 && asked.every((a) => a === 'basemaps:tests'), asked.join(','));
        hd.finalize();
        // Published HTML carries both; the export draws no tiles.
        const html = await leaflet.htmlFor('m1', chart);
        assert.equal((html.match(/L\.tileLayer\(/g) || []).length, 2, 'two tile layers in standalone HTML');
        assert.ok(html.includes('EPSG:3857:{z}/{y}/{x}.jpg') && html.includes('"maxNativeZoom":12'));
        assert.ok((await leaflet.toBlob(chart, 'svg', { width: 200, height: 120 })).size > 0);
        // In a grid of its own (SWEREF 99 TM) neither is drawn, and the map says so.
        made.length = 0;
        const grid = await leaflet.render(el, Object.assign({}, chart, { map: Object.assign({}, chart.map, { crs: 3006 }) }), { tileFactory: factory });
        assert.equal(made.length, 0, 'no tiles in another grid'); assert.ok(grid.info.basemapProjection);
        grid.finalize();
        // Refused consent: nothing is created.
        setAllow(false);
        const denied = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('must not be created'); } });
        assert.ok(denied.info.basemapDenied); assert.equal(denied.overlays.length, 0);
        denied.finalize();
      });
    } finally { el.remove(); }
    return 'ok';
  }, 30000);

  /** Drive the dialog that is open: the address, Read service, then wait for the first drawable set. */
  async function readInDialog(address) {
    const dlg = /** @type {HTMLElement} */ (await waitFor(() => document.querySelector('[data-tiles-dialog]'), 5000, 'the dialog'));
    /** @type {any} */ (dlg.querySelector('[data-tiles-url]')).value = address;
    /** @type {HTMLElement} */ (dlg.querySelector('[data-tiles-read] button')).click();
    await waitFor(() => dlg.querySelector('[data-tiles-set]'), 5000, 'the tile sets');
    return dlg;
  }
  const noteOf = (dlg) => String(dlg.querySelector('[data-tiles-note]').textContent || '');
  const choose = (sel, value) => { sel.value = value; sel.dispatchEvent(new Event('change')); };
  const okButton = (dlg) => /** @type {HTMLElement} */ (Array.from(dlg.closest('dialog').querySelectorAll('.dm-dialog-actions dm-button button')).pop());

  test('tiles: the dialog reads a service, picks a collection and a tile set, and explains the sets it cannot draw', async (assert) => {
    serve();
    const dialog = D.require('ui/viz/tiles-dialog');
    await withConsent(true, async () => {
      const result = dialog.open(null);
      const dlg = await readInDialog(B + '/collections/orto');
      const ready = t('map.tiles.ready', { tms: 'WebMercatorQuad', min: 5, max: 12 });
      await waitFor(() => noteOf(dlg) === ready, 5000, 'the first set ready');
      const collection = /** @type {any} */ (dlg.querySelector('[data-tiles-collection]'));
      assert.equal(collection.value, '1', 'the collection the address named');
      assert.ok(collection.options[2].label.includes(t('map.tiles.vector')), 'vector tiles are marked');
      // Another grid and vector tiles say why they cannot be drawn.
      choose(dlg.querySelector('[data-tiles-set]'), '1');
      await waitFor(() => noteOf(dlg).startsWith(t('map.tiles.err.tms', { tms: 'SWEREF99TM' }).slice(0, 20)), 5000, 'another grid');
      assert.ok(dlg.querySelector('[data-tiles-note]').classList.contains('dm-error'));
      choose(collection, '2');
      await waitFor(() => noteOf(dlg) === t('map.tiles.err.vector'), 5000, 'vector tiles');
      choose(collection, '1');
      await waitFor(() => noteOf(dlg) === ready, 5000, 'back to the orthophoto');
      assert.equal(/** @type {any} */ (dlg.querySelector('[data-tiles-attribution]')).value, 'Ortofoto © Testverket', 'the service\'s attribution filled in');
      okButton(dlg).click();
      const def = await result;
      assert.deepEqual([def.url, def.collection, def.collectionTitle, def.serviceTitle, def.tileset, def.title, def.template, def.minNativeZoom, def.maxNativeZoom],
        [B, 'orto', 'Ortofoto', 'Testgeodata', 'WebMercatorQuad', 'Ortofoto', B + '/collections/orto/map/tiles/WebMercatorQuad/{z}/{y}/{x}.png', 5, 12]);
      assert.equal(dialog.summary(def), 'Testgeodata · Ortofoto · WebMercatorQuad');
      // Confirmed on vector tiles: nothing is chosen.
      const again = dialog.open(null);
      const dlg2 = await readInDialog(B);
      choose(dlg2.querySelector('[data-tiles-collection]'), '2');
      await waitFor(() => noteOf(dlg2) === t('map.tiles.err.vector'), 5000, 'vector tiles');
      okButton(dlg2).click();
      assert.equal(await again, null);
    });
    return 'ok';
  }, 30000);

  test('tiles: a map view in Visualisera adds map tiles as a layer from the dialog', async (assert) => {
    serve();
    const panel = D.require('ui/viz/map-panel');
    const mount = document.createElement('div');
    mount.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
    document.body.appendChild(mount);
    const chart = { kind: 'map', name: 'Rutkarta', map: { layers: [], basemap: 'none', custom: { url: '', attribution: '' }, legend: true, height: 300 } };
    let changes = 0;
    const made = panel.create({ chart, columns: [], onChange() { changes++; }, log() {}, onInspect() {} });
    mount.appendChild(made.el);
    try {
      await withConsent(true, async (asked, setAllow) => {
        const add = /** @type {HTMLElement} */ (await waitFor(() => mount.querySelector('[data-map-add-tiles] button'), 5000, 'the add button'));
        add.click();
        const dlg = await readInDialog(B + '/collections/orto');
        await waitFor(() => noteOf(dlg) === t('map.tiles.ready', { tms: 'WebMercatorQuad', min: 5, max: 12 }), 5000, 'ready');
        // The live map is refused its tiles: nothing is fetched by the test.
        setAllow(false);
        okButton(dlg).click();
        await waitFor(() => chart.map.layers.length === 1, 5000, 'the layer');
        const layer = chart.map.layers[0];
        assert.deepEqual([layer.kind, layer.name, layer.tiles.collection, layer.tiles.tileset], ['tiles', 'Ortofoto', 'orto', 'WebMercatorQuad']);
        assert.ok(changes > 0, 'the change is saved');
        const summary = await waitFor(() => mount.querySelector('[data-map-tiles-summary]'), 5000, 'the layer card');
        assert.equal(summary.textContent, 'Testgeodata · Ortofoto · WebMercatorQuad');
        assert.equal(mount.querySelector('[data-map-tiles-edit] button').getAttribute('data-tip'), t('map.tiles.edit.hint'), 'the edit button has a tip');
        assert.equal(mount.querySelector('[data-map-add-tiles] button').getAttribute('data-tip'), t('map.add.tiles.hint'));
        // The redrawn map asked for the layer's tiles and was refused; it is closed before consent is restored.
        await waitFor(() => made.el.textContent.includes(t('map.basemap.denied')), 5000, 'the refused tiles');
        made.destroy();
      });
    } finally { made.destroy(); mount.remove(); }
    return 'ok';
  }, 30000);
})();
