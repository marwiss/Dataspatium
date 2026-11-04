// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the open geodata families (WFS, OGC API Features, ArcGIS REST) against simulated services: discovery of
 * layers, the endpoints' parameters, paging, GeoJSON results that open as maps, Bearer keys kept out of the
 * connector, and the mapping from catalogue links to families.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const geodata = D.require('api/families/geodata');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const runner = D.require('api/runner');
  const leaflet = D.require('viz/leaflet');
  const charts = D.require('viz/charts');
  const consent = D.require('platform/consent');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/geo';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const CAPS = '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><wfs:FeatureTypeList><wfs:FeatureType><wfs:Name>stat:kommuner</wfs:Name><wfs:Title>Kommuner</wfs:Title><wfs:Abstract>Kommungränser</wfs:Abstract></wfs:FeatureType><wfs:FeatureType><wfs:Name>stat:lan</wfs:Name><wfs:Title>Län</wfs:Title></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>';
  const served = []; const names = [];
  function serve(name, fn) {
    names.push(name);
    D.net.virtual(name, (url) => { served.push(url); return Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })); });
  }
  const square = (lon, lat, d) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]] });
  const feature = (i) => ({ type: 'Feature', id: 'f.' + i, properties: { kod: String(100 + i), namn: 'Område ' + i, varde: i * 10 }, geometry: square(17 + i * 0.5, 59, 0.4) });
  const ALL = [1, 2, 3].map(feature);

  test('geodata: a WFS service is discovered from its capabilities and read as GeoJSON in pages', async (assert) => {
    const ids = [];
    try {
      serve('tests/geo/wfs', (u) => {
        if (u.searchParams.get('request') === 'GetCapabilities') {
          return '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><wfs:FeatureTypeList><wfs:FeatureType><wfs:Name>stat:kommuner</wfs:Name><wfs:Title>Kommuner</wfs:Title><wfs:Abstract>Kommungränser</wfs:Abstract></wfs:FeatureType><wfs:FeatureType><wfs:Name>stat:lan</wfs:Name><wfs:Title>Län</wfs:Title></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>';
        }
        const start = Number(u.searchParams.get('startIndex') || 0); const count = Number(u.searchParams.get('count') || 1000);
        return { type: 'FeatureCollection', numberMatched: ALL.length, numberReturned: Math.min(count, ALL.length - start), features: ALL.slice(start, start + count) };
      });
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/wfs?service=WFS&request=GetCapabilities', token: 'hemlig' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'discovery ok: ' + r.discoveryError);
      assert.deepEqual(r.entities.map((e) => [e.id, e.name]), [['stat:kommuner', 'Kommuner'], ['stat:lan', 'Län']]);
      assert.deepEqual(r.connector.endpoints.map((e) => e.id), ['layer-stat-kommuner', 'layer-stat-lan', 'layer']);
      assert.equal(r.connector.baseUrl, BASE + '/wfs', 'the query string of the pasted link is dropped');
      assert.equal(r.connector.auth.type, 'bearer'); assert.equal(secrets.get(r.connector.id).token, 'hemlig');
      assert.ok(!JSON.stringify(r.connector).includes('hemlig'), 'the key is not in the connector');
      assert.equal(r.connector.level, 2);
      const ep = r.connector.endpoints[0];
      assert.equal(ep.response.format, 'geojson');
      served.length = 0;
      const table = await runner.fetchTable(r.connector, Object.assign({}, ep, { pagination: Object.assign({}, ep.pagination, { size: 2 }) }), { bbox: '17,58,19,60' });
      assert.equal(table.rows.length, 3); assert.equal(table.meta.pages, 2, 'two pages of two');
      assert.ok(table.columns.includes('geometri') && table.columns.includes('namn'), 'geometry and properties: ' + table.columns.join(','));
      assert.deepEqual(r.connector.family, { type: 'geodata', kind: 'wfs' }, 'the connector carries its family');
      const first = new URL(served[0]);
      assert.deepEqual(['WFS', '2.0.0', 'GetFeature', 'stat:kommuner', 'application/json', 'EPSG:4326', '17,58,19,60', '0', '2'], ['service', 'version', 'request', 'typeNames', 'outputFormat', 'srsName', 'bbox', 'startIndex', 'count'].map((k) => first.searchParams.get(k)), 'GetFeature parameters');
      const meta = await runner.toDataset(table, { name: 'WFS-test', source: { kind: 'api', connectorName: r.connector.name } });
      try {
        const cols = await D.require('data/datasets').columns(meta.id);
        assert.ok(leaflet.mapDefault(cols), 'the dataset opens as a map');
      } finally { await D.require('data/datasets').remove(meta.id); }
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: an OGC API Features service lists its collections and follows next links; ArcGIS REST lists layers and pages with resultOffset', async (assert) => {
    const ids = [];
    try {
      serve('tests/geo/oapif/collections', () => ({ collections: [{ id: 'detaljplan', title: 'Detaljplaner', description: 'Gällande planer' }] }));
      serve('tests/geo/oapif/collections/detaljplan/items', (u) => (u.searchParams.get('page') === '2'
        ? { type: 'FeatureCollection', features: [ALL[2]], links: [] }
        : { type: 'FeatureCollection', features: ALL.slice(0, 2), numberMatched: 3, links: [{ rel: 'next', href: BASE + '/oapif/collections/detaljplan/items?f=json&page=2' }] }));
      const r = await geodata.createConnector('ogcapi', { baseUrl: BASE + '/oapif/collections', token: 'nyckel' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'discovery ok: ' + r.discoveryError);
      assert.equal(r.connector.baseUrl, BASE + '/oapif', 'the /collections suffix is dropped');
      assert.deepEqual(r.connector.endpoints.map((e) => e.id), ['collection-detaljplan', 'collection']);
      const t1 = await runner.fetchTable(r.connector, r.connector.endpoints[0], {});
      assert.equal(t1.rows.length, 3); assert.equal(t1.meta.pages, 2, 'followed the next link');
      assert.ok(served.some((u) => /oapif\/collections\/detaljplan\/items\?/.test(u) && /f=json/.test(u) && /limit=1000/.test(u)), 'items request with f=json and limit');
      // ArcGIS: the service root lists the layers; the query pages until a page is short.
      serve('tests/geo/arcgis/Tjanst/FeatureServer', () => ({ layers: [{ id: 0, name: 'Nyckelbiotoper', geometryType: 'esriGeometryPolygon' }, { id: 1, name: 'Punkter', geometryType: 'esriGeometryPoint' }], tables: [] }));
      serve('tests/geo/arcgis/Tjanst/FeatureServer/0/query', (u) => { const o = Number(u.searchParams.get('resultOffset') || 0); const n = Number(u.searchParams.get('resultRecordCount') || 1000); return { type: 'FeatureCollection', features: ALL.slice(o, o + n) }; });
      const r2 = await geodata.createConnector('arcgis', { baseUrl: BASE + '/arcgis/Tjanst/FeatureServer/0/query' });
      ids.push(r2.connector.id);
      assert.equal(r2.discoveryError, null, 'discovery ok: ' + r2.discoveryError);
      assert.equal(r2.connector.baseUrl, BASE + '/arcgis/Tjanst/FeatureServer', 'the pasted layer query is reduced to the service root');
      assert.deepEqual(r2.entities.map((e) => [e.id, e.name, e.abstract]), [['0', 'Nyckelbiotoper', 'Polygon'], ['1', 'Punkter', 'Point']]);
      assert.equal(r2.connector.auth.type, 'none'); assert.equal(r2.connector.level, 1);
      served.length = 0;
      const ep = r2.connector.endpoints[0];
      const t2 = await runner.fetchTable(r2.connector, Object.assign({}, ep, { pagination: Object.assign({}, ep.pagination, { size: 2 }) }), {});
      assert.equal(t2.rows.length, 3); assert.equal(t2.meta.pages, 2);
      const q = new URL(served[0]);
      assert.deepEqual(['1=1', '*', '4326', 'geojson', 'true', '0', '2'], ['where', 'outFields', 'outSR', 'f', 'returnGeometry', 'resultOffset', 'resultRecordCount'].map((k) => q.searchParams.get(k)), 'query parameters');
      // A services directory: the feature and map services become entities with their first layer.
      serve('tests/geo/arcgis2', () => ({ services: [{ name: 'Mapp/Skog', type: 'FeatureServer' }, { name: 'Mapp/Bild', type: 'ImageServer' }] }));
      const r3 = await geodata.createConnector('arcgis', { baseUrl: BASE + '/arcgis2' });
      ids.push(r3.connector.id);
      assert.deepEqual(r3.entities.map((e) => e.id), ['Skog/FeatureServer/0']);
      assert.equal(r3.connector.endpoints[0].path, '/Skog/FeatureServer/0/query');
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: catalogue links map to families, and a service without layers reports it', async (assert) => {
    assert.equal(geodata.familyForLink('HTTP:OGC:API-Features', 'https://api.lantmateriet.se/distribution/geodatakatalog/sokning/v1/detaljplan/v2/'), 'ogcapi');
    assert.equal(geodata.familyForLink('OGC:WFS', 'https://geodata.scb.se/geoserver/wfs?service=WFS&request=GetCapabilities'), 'wfs');
    assert.equal(geodata.familyForLink('', 'https://geodpags.skogsstyrelsen.se/arcgis/rest/services/Skog/FeatureServer'), 'arcgis');
    assert.equal(geodata.familyForLink('HTTP:OGC:WMS', 'https://x/wms'), 'wms');
    assert.equal(geodata.familyForLink('HTTP:Information', 'https://www.lantmateriet.se/'), null);
    assert.equal(geodata.serviceUrl('https://host/geoserver/wfs?service=WFS&request=GetCapabilities'), 'https://host/geoserver/wfs');
    assert.equal(geodata.arcgisRoot('https://host/arcgis/rest/services/A/B/MapServer/3/query?where=1'), 'https://host/arcgis/rest/services/A/B/MapServer');
    serve('tests/geo/empty', () => '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0"><wfs:FeatureTypeList/></wfs:WFS_Capabilities>');
    const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/empty' });
    try {
      assert.ok(r.discoveryError && r.discoveryError.length > 0, 'no layers reported: ' + r.discoveryError);
      assert.deepEqual(r.connector.endpoints.map((e) => e.id), ['layer'], 'the generic endpoint remains');
    } finally { await connectors.remove(r.connector.id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: a source saved without layers reads them on refresh, an answer is drawn as a small map, and WMS addresses, capabilities, background and overlay go through the tile factory', async (assert) => {
    const ids = []; let metaId = null; const el = document.createElement('div');
    el.style.cssText = 'position:absolute; left:-10000px; top:0; width:600px; height:400px;';
    document.body.appendChild(el);
    // The test page grants every purpose through localStorage; here the asker must be consulted.
    const key = 'dataspatium.consent';
    const override = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('basemaps');
    try {
      serve('tests/geo/wfs2', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', numberMatched: ALL.length, features: ALL }));
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/wfs2' }, { discover: false });
      ids.push(r.connector.id);
      assert.deepEqual(r.connector.endpoints.map((e) => e.id), ['layer'], 'only the generic endpoint before refresh');
      const res = await geodata.refresh(r.connector);
      assert.deepEqual(res.entities.map((e) => e.id), ['stat:kommuner', 'stat:lan']);
      const saved = await connectors.get(r.connector.id);
      assert.deepEqual(geodata.layerEndpoints(saved).map((e) => e.id), ['layer-stat-kommuner', 'layer-stat-lan'], 'saved with the layers');
      assert.equal(geodata.genericEndpoint(saved).id, 'layer');
      // The presets of 2.8.0 validate and are listed: geodata services without layers and the catalogue search.
      const all = await connectors.list();
      for (const id of ['geodataportalen', 'scb-geodata', 'sgu-geodata', 'kartverket-adm', 'statfin-geo', 'skogsstyrelsen-geodata', 'lantmateriet-ngp-detaljplan']) assert.ok(all.some((c) => c.id === id), 'preset listed: ' + id);
      assert.equal(all.find((c) => c.id === 'scb-geodata').family.kind, 'wfs');
      assert.equal(all.find((c) => c.id === 'geodataportalen').endpoints[0].response.format, 'geonetwork');
      // The answer as a small SVG map, before it is saved.
      const table = await runner.fetchTable(saved, saved.endpoints[0], {});
      const svg = leaflet.tableSvg(table, { width: 320, height: 200 });
      assert.ok(svg && svg.startsWith('<svg') && (svg.match(/<path /g) || []).length === 3, 'three polygons drawn: ' + (svg ? svg.slice(0, 60) : svg));
      assert.equal(leaflet.tableSvg({ columns: ['a'], rows: [[1]] }), null, 'no geometry, no map');
      // WMS definitions: request parameters are dropped from pasted links, other parameters stay, layers are required.
      assert.equal(leaflet.wmsSource({ url: 'https://x.se/wms?service=WMS&request=GetCapabilities', layers: 'a' }).url, 'https://x.se/wms');
      assert.equal(leaflet.wmsSource({ url: 'https://x.se/wms?map=k&service=WMS', layers: 'a' }).url, 'https://x.se/wms?map=k');
      assert.equal(leaflet.wmsSource({ url: 'https://x.se/wms', layers: '' }), null);
      assert.deepEqual(leaflet.wmsSource({ url: 'https://x.se/wms', layers: 'a,b', transparent: true }).wms, { layers: 'a,b', format: 'image/png', transparent: true, version: '1.3.0' });
      assert.ok(leaflet.BASEMAPS.includes('wms'));
      // Capabilities after consent (stubbed to allow): only named layers, in document order.
      await consent.set('basemaps', null);
      const asked = [];
      consent.setAsker(async (purpose, info) => { asked.push(purpose + ':' + info.host); return { allow: true, remember: false }; });
      serve('tests/geo/wms', (u) => (u.searchParams.get('request') === 'GetCapabilities'
        ? '<?xml version="1.0"?><WMS_Capabilities xmlns="http://www.opengis.net/wms" version="1.3.0"><Capability><Layer><Title>Rot</Title><Layer><Name>topo</Name><Title>Topografisk</Title></Layer><Layer><Name>orto</Name><Title>Ortofoto</Title><Abstract>Flygbild</Abstract></Layer></Layer></Capability></WMS_Capabilities>'
        : 'no'));
      const layers = await leaflet.wmsLayers(BASE + '/wms?service=WMS&request=GetCapabilities');
      assert.deepEqual(layers.map((l) => [l.id, l.name, l.abstract]), [['topo', 'Topografisk', ''], ['orto', 'Ortofoto', 'Flygbild']]);
      assert.ok(asked.length >= 1 && asked.every((a) => a === 'basemaps:tests'), 'asked for the purpose basemaps: ' + asked.join(','));
      // A map with a WMS background and a WMS overlay: both are created through the tile factory with GetMap parameters.
      const meta = await runner.toDataset(table, { name: 'WMS-test', source: { kind: 'api', connectorName: saved.name } });
      metaId = meta.id;
      const cols = await datasets.columns(meta.id);
      const chart = charts.create('map', meta, 'WMS-karta');
      chart.map = leaflet.defaultMap(cols, meta);
      chart.map.basemap = 'wms'; chart.map.wms = { url: BASE + '/wms', layers: 'topo', format: 'image/jpeg', transparent: false, attribution: 'Test' };
      chart.map.layers.unshift(leaflet.wmsLayer({ url: BASE + '/wms?service=WMS&request=GetCapabilities', layers: 'orto' }, 'Orto'));
      const made = [];
      const hd = await leaflet.render(el, chart, { tileFactory: (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; } });
      assert.deepEqual(made.map((m) => [m.url, m.opts.layers, m.opts.format, m.opts.transparent, m.opts.opacity]), [[BASE + '/wms', 'topo', 'image/jpeg', false, undefined], [BASE + '/wms', 'orto', 'image/png', true, 0.8]], 'background first, then the overlay with its opacity');
      assert.equal(hd.legend.length, 1, 'the WMS overlay has no legend entry'); assert.equal(hd.info.layers, 1); assert.ok(!hd.info.basemapDenied);
      assert.ok(el.querySelector('.leaflet-overlay-pane canvas'), 'the features are drawn');
      hd.finalize();
      // Published HTML carries both WMS layers; export draws only the features.
      const html = await leaflet.htmlFor('m1', chart);
      assert.equal((html.match(/L\.tileLayer\.wms\(/g) || []).length, 2, 'two WMS layers in standalone HTML');
      assert.ok(html.includes('"layers":"orto"') && html.includes('"opacity":0.8'), 'overlay parameters inlined');
      const blob = await leaflet.toBlob(chart, 'svg', { width: 200, height: 120 });
      assert.ok(blob.size > 0, 'export without tiles');
      // Refused consent: no WMS layer is created, the denial is reported.
      consent.setAsker(async () => ({ allow: false, remember: false }));
      const hd2 = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('must not be created'); } });
      assert.ok(hd2.info.basemapDenied, 'denied reported'); assert.equal(hd2.overlays.length, 0);
      hd2.finalize();
    } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (override !== null) localStorage.setItem(key, override);
      if (metaId) await datasets.remove(metaId).catch(() => {});
      for (const id of ids) await connectors.remove(id).catch(() => {});
      el.remove();
    }
    return 'ok';
  }, 60000);

  test('ui: a geodata source shows its layers in Inhämta, a layer is fetched with a map preview and saved, and a catalogue hit becomes a geodata source', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const ids = []; let savedId = null;
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const itemByText = (text) => Array.from(root.querySelectorAll('.dm-list-item')).find((e) => e.textContent.includes(text));
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      serve('tests/geo/ui-wfs', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', numberMatched: ALL.length, features: ALL }));
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/ui-wfs' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'discovered: ' + r.discoveryError);
      // The catalogue points at a second service, so that adding the hit creates a new source.
      serve('tests/geo/cat-wfs', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', numberMatched: ALL.length, features: ALL }));
      serve('tests/geo/catalog/_search', () => ({ hits: { total: { value: 1 }, hits: [{ _id: 'abc', _source: { resourceTitleObject: { default: 'Kommuner (katalog)' }, resourceAbstractObject: { default: 'Kommungränser från Testverket' }, OrgForResourceObject: { default: 'Testverket' }, resourceType: ['dataset'], link: [{ protocol: 'OGC:WFS', urlObject: { default: BASE + '/cat-wfs?service=WFS&request=GetCapabilities' }, nameObject: { default: 'WFS' } }, { protocol: 'OGC:WMS', url: 'https://x.example/wms' }, { protocol: 'WWW:LINK', url: 'https://x.example/info', name: 'Info' }] } }] } }));
      const portal = await connectors.save({ format: 'dataspatium-api/1', id: 'test-geoportal', name: 'Testkatalog', baseUrl: BASE + '/catalog', auth: { type: 'none' }, family: { type: 'geoportal' }, endpoints: [{ id: 'search', name: 'Sök', method: 'POST', path: '/_search', bodyType: 'json', body: { query: { query_string: { query: '{q}' } } }, params: [{ name: 'q', in: 'template', type: 'string', required: true }], response: { format: 'geonetwork' } }] });
      ids.push(portal.id);
      shell.activate('inhamta');
      await waitFor(() => buttonByText(t('import.sources.add')), 5000, 'the button Lägg till källa');
      // The WFS source: its layers as a list, one layer's form, the fetch with a map preview, saving.
      await waitFor(() => itemByText(r.connector.name), 5000, 'the WFS source in the list');
      itemByText(r.connector.name).click();
      await waitFor(() => root.querySelectorAll('.dm-geo-layer').length === 3, 8000, 'two layers and the generic entry');
      assert.ok(!root.querySelector('.dm-api-view dm-tabs'), 'no endpoint tab for a geodata source');
      /** @type {any} */ (Array.from(root.querySelectorAll('.dm-geo-layer')).find((e) => e.textContent.includes('Kommuner'))).click();
      await waitFor(() => buttonByText(t('api.fetch')), 5000, 'fetch button for the layer');
      assert.ok(Array.from(root.querySelectorAll('.dm-geo-form dm-input')).some((i) => (i.getAttribute('label') || '').includes(t('geodata.param.bbox'))), 'the bbox field');
      const before = new Set(shell.store.get().datasets.map((d) => d.id));
      buttonByText(t('api.fetch')).click();
      await waitFor(() => root.querySelector('.dm-api-map svg'), 15000, 'map preview of the answer');
      assert.equal(root.querySelectorAll('.dm-api-map svg path').length, 3, 'three polygons in the preview');
      buttonByText(t('api.save')).click();
      await waitFor(() => buttonByText(t('geodata.open.map')), 15000, 'saved with Öppna som karta');
      // The store learns about the new dataset asynchronously (slower over https than from file://).
      const ds = await waitFor(() => shell.store.get().datasets.find((d) => !before.has(d.id)), 10000, 'the new dataset in the store');
      savedId = ds.id;
      assert.ok(leaflet.mapDefault(await datasets.columns(ds.id)), 'the dataset opens as a map');
      // The catalogue: search, one card with the organisation and the service buttons, add the WFS as a source.
      itemByText('Testkatalog').click();
      const input = await waitFor(() => root.querySelector('.dm-geoportal-search dm-input'), 5000, 'search field');
      input.value = 'kommuner'; input.dispatchEvent(new Event('input', { bubbles: true }));
      buttonByText(t('geoportal.search')).click();
      await waitFor(() => root.querySelector('.dm-geoportal-card'), 10000, 'a result card');
      const card = root.querySelector('.dm-geoportal-card');
      assert.ok(card.textContent.includes('Kommuner (katalog)') && card.textContent.includes('Testverket'), 'title and organisation');
      assert.ok(buttonByText(t('geoportal.add.wfs')) && buttonByText(t('geoportal.copy.wms')) && buttonByText(t('geoportal.metadata')), 'WFS, WMS and metadata buttons');
      assert.ok(card.querySelector('details') && card.textContent.includes('Info'), 'the other link under Fler länkar');
      const known = new Set((await connectors.list()).map((c) => c.id));
      buttonByText(t('geoportal.add.wfs')).click();
      const added = await waitFor(() => { const h1 = root.querySelector('.dm-api-view h1'); return h1 && !h1.textContent.includes('Testkatalog') && root.querySelectorAll('.dm-geo-layer').length === 3 ? h1 : null; }, 15000, 'the new source opened with its layers');
      const newOnes = (await connectors.list()).filter((c) => !known.has(c.id));
      assert.equal(newOnes.length, 1, 'one connector created');
      ids.push(newOnes[0].id);
      assert.equal(newOnes[0].baseUrl, BASE + '/cat-wfs'); assert.equal(newOnes[0].family.kind, 'wfs');
      assert.equal(newOnes[0].id, 'wfs-tests-geo-cat-wfs', 'id from host and path'); assert.equal(newOnes[0].name, 'tests/geo/cat-wfs (WFS)', 'name from host and path');
      assert.ok(added.textContent.includes(newOnes[0].name), 'the view shows the new source');
      return 'ok';
    } finally {
      if (savedId) await datasets.remove(savedId).catch(() => {});
      for (const id of ids) await connectors.remove(id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('geodata: the dialog lists the ready-made services, filters them, adds one with one click and opens a preset', async (assert) => {
    const familyDialog = D.require('ui/api/family-dialog');
    const ids = [];
    const dialogs = () => Array.from(document.querySelectorAll('dialog.dm-dialog'));
    try {
      serve('tests/geo/ready-wfs', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', features: ALL }));
      familyDialog.setServices([
        { id: 'scb-geodata', preset: 'scb-geodata', name: 'SCB öppna geodata', publisher: 'SCB', country: 'SE', kind: 'wfs', url: 'https://geodata.scb.se/geoserver/wfs', about: { sv: 'Gränser.' } },
        { id: 'test-ready', name: 'Testverkets WFS', publisher: 'Testverket', country: 'NO', kind: 'wfs', url: BASE + '/ready-wfs', about: { sv: 'Kommuner i testlandet.', en: 'Municipalities of the test land.' } },
      ]);
      const promise = familyDialog.open({ shell: { log: () => {} } }, { group: 'geodata' });
      const dialog = await waitFor(() => { const d = dialogs().pop(); return d && d.querySelectorAll('.dm-geodata-ready-item').length === 2 ? d : null; }, 5000, 'dialog with two services');
      const items = () => Array.from(dialog.querySelectorAll('.dm-geodata-ready-item'));
      assert.ok(items()[0].textContent.includes('SCB öppna geodata') && items()[1].textContent.includes('Testverket'), 'names shown');
      const filter = /** @type {any} */ (dialog.querySelector('.dm-geodata-ready dm-input'));
      filter.value = 'testverket'; filter.dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => items().length === 1, 3000, 'filtered to one');
      const addBtn = /** @type {any} */ (items()[0].querySelector('dm-button'));
      assert.equal(addBtn.textContent.trim(), t('geodata.ready.add'));
      addBtn.click();
      const connector = await promise;
      assert.ok(connector && connector.family && connector.family.kind === 'wfs' && connector.baseUrl === BASE + '/ready-wfs', 'connector created from the list: ' + JSON.stringify(connector && { id: connector.id, baseUrl: connector.baseUrl }));
      ids.push(connector.id);
      assert.equal(connector.name, 'Testverkets WFS'); assert.deepEqual(geodata.layerEndpoints(connector).map((e) => e.id), ['layer-stat-kommuner', 'layer-stat-lan']);
      // A preset entry opens the existing connector without creating anything.
      const before = (await connectors.list()).length;
      const promise2 = familyDialog.open({ shell: { log: () => {} } }, { group: 'geodata' });
      const dialog2 = await waitFor(() => { const d = dialogs().pop(); return d && d !== dialog && d.querySelectorAll('.dm-geodata-ready-item').length === 2 ? d : null; }, 5000, 'second dialog');
      /** @type {any} */ (dialog2.querySelectorAll('.dm-geodata-ready-item')[0].querySelector('dm-button')).click();
      const preset = await promise2;
      assert.ok(preset && preset.id === 'scb-geodata' && preset.preset, 'the preset itself is returned');
      assert.equal((await connectors.list()).length, before, 'nothing new created');
    } finally {
      familyDialog.setServices(null);
      for (const id of ids) await connectors.remove(id).catch(() => {});
    }
    return 'ok';
  }, 30000);

  test('geodata: cleanup', async (assert) => {
    for (const n of names) D.net.unvirtual(n);
    assert.ok(true);
  });
})();
