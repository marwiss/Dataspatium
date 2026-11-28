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
      await waitFor(() => root.querySelector('[data-source="geodata"]'), 5000, 'the item Geodatakälla');
      // The WFS source: its layers as a list, one layer's form, the fetch with a map preview, saving.
      await waitFor(() => itemByText(r.connector.name), 5000, 'the WFS source in the list');
      itemByText(r.connector.name).click();
      await waitFor(() => root.querySelectorAll('.dm-geo-layer').length === 3, 8000, 'two layers and the generic entry');
      assert.ok(!root.querySelector('.dm-api-view dm-tabs'), 'no endpoint tab and, without plans, no mode switch for a geodata source');
      // The count says how many layers the filter leaves of all of them.
      assert.equal(root.querySelector('[data-geo-count]').textContent, t('geodata.layers.count', { n: '2' }));
      const filterInput = /** @type {any} */ (root.querySelector('.dm-geo-head dm-input'));
      filterInput.value = 'Kommun'; filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert.equal(root.querySelector('[data-geo-count]').textContent, t('geodata.layers.count.of', { shown: '1', n: '2' }), 'one of two after filtering');
      filterInput.value = ''; filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert.ok(root.querySelector('.dm-right [data-geo-pick]'), 'the inspector asks for a layer');
      // A layer chosen: its form is in the inspector, above the facts about the service.
      /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center .dm-geo-layer')).find((e) => e.textContent.includes('Kommuner'))).click();
      const formEl = await waitFor(() => root.querySelector('.dm-right .dm-geo-form'), 5000, 'the layer\'s form in the inspector');
      assert.ok(formEl.compareDocumentPosition(Array.from(root.querySelectorAll('.dm-right h4')).find((x) => x.textContent === t('api.info'))) & Node.DOCUMENT_POSITION_FOLLOWING, 'above Om tjänsten');
      assert.ok(Array.from(formEl.querySelectorAll('dm-input')).some((i) => (i.getAttribute('label') || '').includes(t('geodata.param.bbox'))), 'the bbox field');
      const before = new Set(shell.store.get().datasets.map((d) => d.id));
      buttonByText(t('api.fetch')).click();
      // The answer takes the list's place in the work area, with the way back.
      await waitFor(() => root.querySelector('.dm-center .dm-geo-result .dm-api-map svg'), 15000, 'map preview of the answer in the work area');
      assert.equal(root.querySelectorAll('.dm-api-map svg path').length, 3, 'three polygons in the preview');
      assert.ok(!root.querySelector('.dm-center .dm-geo-layers') && root.querySelector('.dm-center [data-geo-back]'), 'the list gives way to the answer, with Alla lager');
      assert.ok(root.querySelector('.dm-right .dm-geo-form') === formEl, 'the form stays in the inspector');
      assert.ok(!buttonByText(t('plan.save.detaljplan')) && !buttonByText(t('plan.save.oversiktsplan')), 'no plan button for a layer that is no plan');
      buttonByText(t('api.save')).click();
      await waitFor(() => buttonByText(t('geodata.open.map')), 15000, 'saved with Öppna som karta');
      // The store learns about the new dataset asynchronously (slower over https than from file://).
      const ds = await waitFor(() => shell.store.get().datasets.find((d) => !before.has(d.id)), 10000, 'the new dataset in the store');
      savedId = ds.id;
      assert.ok(leaflet.mapDefault(await datasets.columns(ds.id)), 'the dataset opens as a map');
      // Alla lager: back to the list, with the layer still chosen and its form in the inspector.
      /** @type {HTMLElement} */ (root.querySelector('.dm-center [data-geo-back] button')).click();
      assert.equal(root.querySelectorAll('.dm-center .dm-geo-layer').length, 3, 'the list again');
      assert.ok(!root.querySelector('.dm-center .dm-geo-result') && root.querySelector('.dm-right .dm-geo-form') === formEl, 'the form kept');
      assert.ok(root.querySelector('.dm-center .dm-geo-layer[aria-current="true"]').textContent.includes('Kommuner'), 'the layer still chosen');
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
      // The form Egen geodatakälla in the workspace, with the family and the address filled in (PLAN 12 a4, B-81.3).
      const field = await waitFor(() => root.querySelector('.dm-center [data-source-form="owngeodata"] [data-family-field="baseUrl"]'), 8000, 'the geodata form with the address');
      assert.equal(/** @type {any} */ (field).value, BASE + '/cat-wfs?service=WFS&request=GetCapabilities', 'the address from the post');
      Array.from(root.querySelectorAll('.dm-center [data-source-form="owngeodata"] dm-button')).find((b) => b.textContent.trim() === t('families.add')).click();
      const added = await waitFor(() => { const h1 = root.querySelector('.dm-api-view h1'); return h1 && !h1.textContent.includes('Testkatalog') && root.querySelectorAll('.dm-geo-layer').length === 3 ? h1 : null; }, 15000, 'the new source opened with its layers');
      const newOnes = (await connectors.list()).filter((c) => !known.has(c.id));
      assert.equal(newOnes.length, 1, 'one connector created');
      ids.push(newOnes[0].id);
      assert.equal(newOnes[0].baseUrl, BASE + '/cat-wfs'); assert.equal(newOnes[0].family.kind, 'wfs');
      assert.equal(newOnes[0].id, 'wfs-tests-geo-cat-wfs', 'id from host and path'); assert.equal(newOnes[0].name, 'tests/geo/cat-wfs (WFS)', 'name from host and path');
      assert.equal(newOnes[0].perHost, true, 'a source from a catalogue post asks consent per host');
      assert.ok(added.textContent.includes(newOnes[0].name), 'the view shows the new source');
      return 'ok';
    } finally {
      if (savedId) await datasets.remove(savedId).catch(() => {});
      for (const id of ids) await connectors.remove(id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('ui: a geodata source fills the work area: Valfritt lager above a list that alone scrolls, the arrow keys in it, and the inspector shown on choosing (a sheet below 1100 px)', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const ids = [];
    const many = '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" version="2.0.0"><wfs:FeatureTypeList>'
      + Array.from({ length: 80 }, (_, i) => `<wfs:FeatureType><wfs:Name>stat:lager${String(i).padStart(2, '0')}</wfs:Name><wfs:Title>Lager ${String(i).padStart(2, '0')}</wfs:Title></wfs:FeatureType>`).join('') + '</wfs:FeatureTypeList></wfs:WFS_Capabilities>';
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      serve('tests/geo/ui-many', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? many : { type: 'FeatureCollection', numberMatched: ALL.length, features: ALL }));
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/ui-many' });
      ids.push(r.connector.id);
      shell.activate('inhamta');
      const source = await waitFor(() => root.querySelector(`[data-source="api:${r.connector.id}"]`), 5000, 'the source in the list');
      /** @type {HTMLElement} */ (source).click();
      await waitFor(() => root.querySelectorAll('.dm-center [data-geo-layer]').length === 81, 8000, 'eighty layers and Valfritt lager');
      assert.ok(!root.querySelector('[data-geo-modes]'), 'no mode switch without plans');
      const center = /** @type {HTMLElement} */ (root.querySelector('.dm-center'));
      const list = /** @type {HTMLElement} */ (root.querySelector('.dm-center .dm-geo-layers'));
      const generic = /** @type {HTMLElement} */ (root.querySelector('.dm-center .dm-geo-generic'));
      assert.ok(generic && generic.textContent.includes(t('geodata.generic.layer')), 'Valfritt lager');
      assert.ok(generic.getBoundingClientRect().bottom <= list.getBoundingClientRect().top, 'above the list');
      // One scrollbar: the list scrolls, the work area does not.
      assert.ok(list.scrollHeight > list.clientHeight + 40, `the list scrolls: ${list.scrollHeight} > ${list.clientHeight}`);
      assert.ok(center.scrollHeight <= center.clientHeight + 1, `the work area does not: ${center.scrollHeight} <= ${center.clientHeight}`);
      assert.ok(list.getBoundingClientRect().bottom <= center.getBoundingClientRect().bottom + 1, 'the list ends inside the work area');
      // The arrow keys: Down from the search box to the first layer, on to the next; Escape empties the box.
      const box = /** @type {any} */ (root.querySelector('.dm-center [data-geo-search="layers"]'));
      const control = box.querySelector('input');
      control.focus();
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      assert.equal(document.activeElement && document.activeElement.getAttribute('data-geo-layer'), list.querySelector('[data-geo-layer]').getAttribute('data-geo-layer'), 'Down: the first layer');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      assert.equal(document.activeElement, Array.from(list.querySelectorAll('[data-geo-layer]')).pop(), 'End: the last layer');
      box.value = 'Lager 1'; box.dispatchEvent(new Event('input', { bubbles: true }));
      assert.equal(list.querySelectorAll('[data-geo-layer]').length, 10, 'filtered as one types');
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(box.value, ''); assert.equal(list.querySelectorAll('[data-geo-layer]').length, 80, 'Escape empties the box');
      // Choosing a layer shows the inspector: the column on a wide window, a sheet over the work area below 1100 px.
      const shellEl = /** @type {HTMLElement} */ (root.querySelector('.dm-shell'));
      const narrow = matchMedia('(max-width: 1099px)').matches;
      if (narrow) assert.equal(shellEl.getAttribute('data-right'), 'closed', 'the sheet starts closed');
      const fifth = /** @type {HTMLElement} */ (list.querySelectorAll('[data-geo-layer]')[4]);
      fifth.focus(); fifth.click();
      assert.equal(shellEl.getAttribute('data-right'), narrow ? 'sheet' : 'open', 'the inspector shown on choosing');
      assert.equal(root.querySelector('.dm-right .dm-geo-form').getAttribute('data-geo-form'), fifth.getAttribute('data-geo-layer'), 'with the layer\'s form');
      assert.equal(document.activeElement, fifth, 'the list keeps the focus');
      if (narrow) {
        // Hämta in the sheet: the sheet closes, so that the answer in the work area is seen.
        Array.from(root.querySelectorAll('.dm-right dm-button')).find((b) => b.textContent.trim() === t('api.fetch')).click();
        await waitFor(() => root.querySelector('.dm-center .dm-geo-result .dm-api-map svg'), 15000, 'the answer');
        assert.equal(shellEl.getAttribute('data-right'), 'closed', 'the sheet closed for the answer');
      }
      return narrow ? 'narrow: the inspector as a sheet' : 'wide: the inspector as a column';
    } finally {
      D.net.unvirtual('tests/geo/ui-many');
      for (const id of ids) await connectors.remove(id).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('geodata: NGP\'s other datasets are sources of their own that take the plan source\'s login and the keys given there', async (assert) => {
    const list = JSON.parse(await D.assets.loadText('presets/geodata/services.json')).services;
    const others = list.filter((s) => /^lantmateriet-ngp-/.test(s.id) && s.id !== 'lantmateriet-ngp-detaljplan');
    assert.equal(others.length, 4, 'buildings, shore protection, cultural remains and the near-mountain forest line');
    assert.ok(others.every((s) => !s.preset && s.authFrom === 'lantmateriet-ngp-detaljplan'), 'none opens the plan source; all log in like it');
    const secrets = D.require('api/secrets');
    const from = { id: 'test-ngp-login', auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://apimanager.lantmateriet.se/oauth2/token', clientAuth: 'body' } };
    secrets.set(from.id, { clientId: 'konsumentnyckel', clientSecret: 'konsumenthemlighet' });
    let made = null;
    try {
      const res = await geodata.createConnector('ogcapi', { baseUrl: BASE + '/ngp-byggnad', name: 'Byggnader (prov)' }, { authFrom: from, discover: false });
      made = res.connector;
      assert.deepEqual([made.auth.type, made.auth.tokenUrl, made.auth.clientAuth], ['oauth2_client_credentials', 'https://apimanager.lantmateriet.se/oauth2/token', 'body'], 'the login copied');
      assert.deepEqual(secrets.get(made.id), { clientId: 'konsumentnyckel', clientSecret: 'konsumenthemlighet' }, 'the session\'s keys copied');
      assert.ok(made.auth !== from.auth, 'a copy, not the same object');
    } finally {
      await secrets.forget(from.id);
      if (made) { await secrets.forget(made.id); await connectors.remove(made.id).catch(() => {}); }
    }
    return 'ok';
  });

  test('ui: Egen geodatakälla is a source of its own in Geodatakällor whose form saves an address as a source, and Geodatakälla lists only the ready-made services', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const familyDialog = D.require('ui/api/family-dialog');
    const ID = 'wfs-tests-geo-own-wfs';
    try {
      history.replaceState(null, '', location.pathname + location.search);
      serve('tests/geo/own-wfs', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', features: ALL }));
      familyDialog.setServices([{ id: 'test-listed', name: 'Testverkets listade WFS', publisher: 'Testverket', country: 'NO', kind: 'wfs', url: BASE + '/listed-wfs', about: { sv: 'Prov.' } }]);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const pane = root.querySelector('.dm-left');
      const center = root.querySelector('.dm-center');
      const item = (id) => /** @type {HTMLElement} */ (pane.querySelector(`[data-source="${id}"]`));
      await waitFor(() => item('owngeodata'), 5000, 'Egen geodatakälla in the column');
      const rows = shell.modes.get('inhamta').sourceTree.rows();
      const at = rows.findIndex((r) => r.id === 'group:geodata');
      assert.deepEqual(rows.slice(at + 1, at + 5).map((r) => r.id), ['geodata', 'owngeodata', 'geoportal', 'boundaries'], 'in Geodatakällor, right after Geodatakälla');
      assert.equal(item('owngeodata').querySelector('.dm-tree-label').textContent, t('geodata.own.short'));
      // Geodatakälla: the ready-made services, and no fields for an address.
      item('geodata').click();
      const listed = await waitFor(() => center.querySelector('[data-source-form="geodata"] [data-family-form="geodata-ready"] .dm-geodata-ready-item'), 8000, 'the ready-made services');
      assert.ok(listed.textContent.includes('Testverkets listade WFS'));
      assert.ok(!center.querySelector('[data-family-field]'), 'no address of one\'s own there');
      // Egen geodatakälla: the families and the address, without the list.
      item('owngeodata').click();
      const form = await waitFor(() => center.querySelector('[data-source-form="owngeodata"] [data-family-form="geodata"]'), 8000, 'the form');
      assert.equal(center.querySelector('.dm-page-head h1').textContent.trim(), t('geodata.own.short'), 'its own heading');
      assert.equal(center.querySelector('[data-source-lead="owngeodata"]').textContent, t('geodata.own.lead'));
      assert.ok(!form.querySelector('.dm-geodata-ready'), 'no list of ready-made services');
      assert.deepEqual(/** @type {any} */ (form.querySelector('dm-select')).options.map((o) => o.value), geodata.FAMILIES.map((f) => f.id), 'the geodata families');
      const address = /** @type {any} */ (form.querySelector('[data-family-field="baseUrl"]'));
      address.value = BASE + '/own-wfs'; address.dispatchEvent(new Event('input'));
      /** @type {HTMLElement} */ (Array.from(form.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('families.add')).querySelector('button')).click();
      await waitFor(() => pane.querySelector(`[data-added="api:${ID}"]`) && root.querySelectorAll('.dm-center .dm-geo-layer').length === 3, 15000, 'saved, among the added sources and opened with its layers');
      const made = await connectors.get(ID);
      assert.ok(made && made.baseUrl === BASE + '/own-wfs' && made.family.kind === 'wfs', 'the address saved as a source: ' + JSON.stringify(made && made.baseUrl));
      assert.deepEqual(geodata.layerEndpoints(made).map((e) => e.id), ['layer-stat-kommuner', 'layer-stat-lan']);
      // From another mode the same form is a dialog.
      shell.activate('hantera');
      const dialogs = () => Array.from(document.querySelectorAll('dialog[open]'));
      const done = familyDialog.open(shell.ctx, { group: 'geodata' });
      const dlg = await waitFor(() => dialogs().pop(), 3000, 'the dialog');
      assert.equal(dlg.querySelector('.dm-dialog-head h2').textContent, t('geodata.own.add'));
      assert.ok(dlg.querySelector('[data-family-form="geodata"] [data-family-field="baseUrl"]') && !dlg.querySelector('.dm-geodata-ready'), 'the address, without the list');
      /** @type {any} */ (dlg).close();
      assert.equal(await done, null, 'closed without a source');
      return 'ok';
    } finally {
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      familyDialog.setServices(null);
      await connectors.remove(ID).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('geodata: the shipped list has SLU species observations and four more datasets of the geodata platform', async (assert) => {
    const list = JSON.parse(await D.assets.loadText('presets/geodata/services.json')).services;
    const byId = new Map(list.map((s) => [s.id, s]));
    const slu = byId.get('slu-artdata-wfs');
    assert.ok(slu && slu.kind === 'wfs' && slu.url === 'https://sosgeo.artdata.slu.se/geoserver/SOS/ows' && !slu.key, 'the species WFS, without a key');
    const langs = ['sv', 'en', 'da', 'nb', 'nn', 'fi', 'is'];
    const ngp = ['byggnad', 'strandskydd', 'kulturhistorisklamning', 'gransforfjallnaraskog'].map((d) => byId.get('lantmateriet-ngp-' + d));
    for (const s of [slu].concat(ngp)) {
      assert.ok(s, 'present');
      assert.ok(['sv', 'en'].every((l) => s.about && s.about[l]) && langs.every((l) => !s.about[l] || String(s.about[l]).trim()), s.id + ': a description in Swedish and English (the others may lack one and show English, F49 a)');
    }
    for (const s of ngp) {
      assert.ok(!s.preset && s.authFrom === 'lantmateriet-ngp-detaljplan', s.id + ' logs in with the platform key, as a source of its own');
      assert.ok(s.key && s.kind === 'ogcapi' && /\/sokning\/v1\/[a-z]+\/v1$/.test(s.url), s.id + ': ' + s.url);
    }
    assert.equal(new Set(list.map((s) => s.id)).size, list.length, 'the ids are unique');
    // The review of 2026-11-27: SCB's workspace, SGU's and Riksantikvaren's OGC APIs, SYKE's GeoServer.
    assert.equal(byId.get('scb-geodata').url, 'https://geodata.scb.se/geoserver/stat/wfs');
    for (const id of ['sgu-geodata', 'sgu-berggrund', 'sgu-brunnar', 'sgu-grundvatten']) assert.ok(byId.get(id) && byId.get(id).kind === 'ogcapi' && /^https:\/\/api\.sgu\.se\/oppnadata\/[a-z0-9-]+\/ogc\/features\/v1$/.test(byId.get(id).url), id);
    assert.ok(!list.some((s) => /maps3\.sgu\.se|kart\.ra\.no|paikkatieto\.ymparisto\.fi\/arcgis/.test(s.url)), 'no switched-off or closed addresses');
    assert.equal(byId.get('riksantikvaren-kulturminner').url, 'https://api.ra.no/LokaliteterEnkeltminnerOgSikringssoner');
    for (const s of list) assert.ok(s.about && s.about.sv && s.about.en, s.id + ': a description in Swedish and English');
    const sgu = JSON.parse(await D.assets.loadText('presets/api/sgu-geodata.api.json'));
    assert.deepEqual([sgu.family.kind, sgu.baseUrl], ['ogcapi', byId.get('sgu-geodata').url], 'the SGU preset follows the list');
    const stac = JSON.parse(await D.assets.loadText('presets/api/lantmateriet-geodata.api.json'));
    assert.equal(stac.license.name, 'CC BY 4.0', 'the licence the STAC catalogue states');
    return list.length + ' services';
  });

  test('geodata: a source that cannot be reached where the app runs says why', async (assert) => {
    const reach = D.require('api/reach');
    assert.equal(reach.mode(), location.protocol === 'file:' ? 'file' : 'web');
    assert.equal(reach.blocked({}), null, 'no measurement: it works');
    assert.equal(reach.blocked({ cors: { file: true, web: true } }), null);
    assert.equal(reach.blocked({ cors: { file: false } }, 'file'), 'web', 'only from the web version');
    assert.equal(reach.blocked({ cors: { file: false } }, 'web'), null);
    assert.equal(reach.blocked({ cors: { web: false } }, 'web'), 'file', 'only from a folder');
    assert.equal(reach.blocked({ cors: { file: false, web: false } }, 'file'), 'bridge', 'from neither');
    for (const r of ['web', 'file', 'bridge']) assert.ok(reach.label(r) !== 'reach.' + r && reach.hint(r) !== 'reach.' + r + '.hint', 'texts for ' + r);
    const familyDialog = D.require('ui/api/family-dialog');
    const dialogs = () => Array.from(document.querySelectorAll('dialog.dm-dialog'));
    const here = reach.mode();
    familyDialog.setServices([{ id: 'test-far', name: 'Avlägsen tjänst', publisher: 'Testverket', country: 'NO', kind: 'wfs', url: 'https://example.invalid/wfs', cors: { [here]: false }, about: { sv: 'Nås inte här.' } }]);
    const promise = familyDialog.open({ shell: { log: () => {} } }, { group: 'geodata', ready: true });
    try {
      const dialog = await waitFor(() => { const d = dialogs().pop(); return d && d.querySelector('.dm-geodata-ready-item') ? d : null; }, 5000, 'the dialog');
      const item = dialog.querySelector('.dm-geodata-ready-item');
      assert.ok(item.textContent.includes(reach.label(here === 'file' ? 'web' : 'file')), 'the reason in the list: ' + item.textContent);
    } finally {
      for (const d of dialogs()) /** @type {any} */ (d).close();
      await promise.catch(() => {});
      familyDialog.setServices(null);
    }
    return 'ok';
  });

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
      const promise = familyDialog.open({ shell: { log: () => {} } }, { group: 'geodata', ready: true });
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
      const promise2 = familyDialog.open({ shell: { log: () => {} } }, { group: 'geodata', ready: true });
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

  /** A copy of the NVDB preset against a simulated Trafikverket, two objects per page, and every request it sends. */
  async function nvdbCopy(path) {
    const http = D.require('api/http');
    const preset = await connectors.get('trafikverket-nvdb');
    const connector = JSON.parse(JSON.stringify(preset));
    connector.id = 'test-nvdb-' + path; connector.baseUrl = BASE + '/' + path;
    const endpoint = connector.endpoints.find((e) => e.id === 'hastighetsgrans');
    endpoint.pagination.size = 2;
    const sent = []; const real = http.request;
    http.request = (req) => { sent.push({ url: String(req.url), body: String(req.body || ''), type: String((req.headers || {})['Content-Type'] || '') }); return real(req); };
    return { preset, connector, endpoint, sent, restore: () => { http.request = real; return secrets.forget(connector.id); } };
  }

  test('geodata: NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84', async (assert) => {
    const { preset, connector, endpoint, sent, restore } = await nvdbCopy('nvdb');
    assert.equal(preset.endpoints.length, 45, 'the preset has 45 object types');
    assert.equal(D.require('api/schema').validate(preset).length, 0, 'the preset validates');
    assert.equal(preset.auth.in, 'body');
    const key = 'ab<c>&"d';
    secrets.set(connector.id, { apiKey: key });
    const line = (i) => ({ Id: 'h' + i, Hogsta_tillatna_hastighet: 30 + i * 10, Geometry: { 'WKT-SWEREF99TM-3D': `LINESTRING Z (${674000 + i * 100} 6580000 12.5, ${674050 + i * 100} 6580040 13)` } });
    const objects = [1, 2, 3].map(line);
    serve('tests/geo/nvdb/data.json', () => {
      const skip = Number((/skip="(\d+)"/.exec(sent[sent.length - 1].body) || [])[1]);
      return { RESPONSE: { RESULT: [{ Hastighetsgräns: objects.slice(skip, skip + 2) }] } };
    });
    try {
      const table = await runner.fetchTable(connector, endpoint, { bbox: '17.95,59.30,18.10,59.36' });
      assert.equal(table.rows.length, 3, 'both pages');
      assert.equal(sent.length, 2, 'one request per page');
      assert.ok(/skip="0"/.test(sent[0].body) && /skip="2"/.test(sent[1].body) && /limit="2"/.test(sent[1].body), 'skip and limit in the body');
      assert.ok(sent[0].body.includes('authenticationkey="ab&lt;c&gt;&amp;&quot;d"'), 'the key, escaped for XML, in the body: ' + sent[0].body.slice(0, 80));
      assert.ok(sent.every((s) => !s.url.includes('authenticationkey') && !s.url.includes(encodeURIComponent(key))), 'never in the address');
      assert.ok(/text\/xml/.test(sent[0].type), 'sent as XML');
      assert.ok(sent[0].body.includes('objecttype="Hastighetsgräns" namespace="vägdata.nvdb_dk_o" schemaversion="1.2"'), 'object type and namespace');
      const box = /<INTERSECTS name="Geometry\.WKT-SWEREF99TM-3D" shape="box" value="(\d+) (\d+), (\d+) (\d+)"\/>/.exec(sent[0].body);
      assert.ok(box, 'a box in the filter: ' + sent[0].body);
      const [x1, y1, x2, y2] = box.slice(1).map(Number);
      // Central Stockholm lies around E 670 000–680 000, N 6 575 000–6 585 000 in SWEREF 99 TM.
      assert.ok(x1 > 660000 && x2 < 690000 && y1 > 6570000 && y2 < 6590000 && x1 < x2 && y1 < y2, 'the box in SWEREF 99 TM: ' + box[0]);
      const col = (n) => table.columns.indexOf(n);
      assert.ok(col('geometri') >= 0 && col('geometri_typ') >= 0, 'the GeoJSON columns: ' + table.columns.join(', '));
      assert.ok(!table.columns.some((c) => /^Geometry/.test(c)), 'the text in SWEREF 99 TM is not kept');
      const g = JSON.parse(table.rows[0][col('geometri')]);
      assert.equal(g.type, 'LineString');
      assert.ok(Math.abs(g.coordinates[0][0] - 18.05) < 0.1 && Math.abs(g.coordinates[0][1] - 59.33) < 0.05, 'in WGS 84: ' + JSON.stringify(g.coordinates[0]));
      // Without a box no filter is sent, and no placeholder is left in the request.
      sent.length = 0;
      await runner.fetchTable(connector, endpoint, {}, { firstPageOnly: true });
      assert.ok(!/<FILTER>/.test(sent[0].body) && !/\{[a-z]+\}/.test(sent[0].body), 'no filter: ' + sent[0].body);
      return table.rows.length + ' rows';
    } finally { await restore(); }
  });

  test('geodata: NVDB reports the service\'s own error, refuses a box in metres before sending and is among the ready sources', async (assert) => {
    const { connector, endpoint, sent, restore } = await nvdbCopy('nvdb2');
    secrets.set(connector.id, { apiKey: 'nyckel' });
    serve('tests/geo/nvdb2/data.json', () => ({ RESPONSE: { RESULT: [{ ERROR: { SOURCE: 'Request', MESSAGE: 'Okänd objekttyp' } }] } }));
    try {
      await assert.throws(() => runner.fetchTable(connector, endpoint, {}), /Okänd objekttyp/);
      sent.length = 0;
      await assert.throws(() => runner.fetchTable(connector, endpoint, { bbox: '674000,6580000,675000,6581000' }), /WGS 84/);
      assert.equal(sent.length, 0, 'nothing sent for a box in metres');
      const list = JSON.parse(await D.assets.loadText('presets/geodata/services.json')).services;
      const nvdb = list.find((s) => s.id === 'trafikverket-nvdb');
      assert.ok(nvdb && nvdb.preset === 'trafikverket-nvdb' && nvdb.key && nvdb.kind === 'api', 'the ready list opens the preset');
      assert.equal(D.require('api/reach').blocked(nvdb), null, 'reached from file:// and the web alike');
      assert.ok(/body|kropp/.test(connectors.describeAuth(connector)), 'the key is said to go in the body: ' + connectors.describeAuth(connector));
      return 'ok';
    } finally { await restore(); }
  });

  test('geodata: Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host', async (assert) => {
    const http = D.require('api/http');
    const files = D.require('api/files');
    const zip = D.require('platform/storage/zip');
    const insight = D.require('ui/kinds/insight-cards');
    const preset = await connectors.get('lantmateriet-stac');
    assert.ok(preset && preset.endpoints.length === 8 && preset.files && preset.files.hosts[0] === 'dl1.lantmateriet.se', 'the preset with four catalogues and its file host');
    assert.equal(D.require('api/schema').validate(preset).length, 0, 'the preset validates');
    // A copy against a simulated Lantmäteriet; the host of the simulated files is "tests".
    const copy = JSON.parse(JSON.stringify(preset));
    Object.assign(copy, { id: 'test-stac', baseUrl: BASE + '/lm', preset: undefined });
    copy.auth.tokenUrl = BASE + '/lm/token';
    copy.files.hosts = ['tests'];
    const connector = await connectors.save(copy);
    secrets.set(connector.id, { clientId: 'nyckel', clientSecret: 'hemlighet' });
    const square = [[[18.0, 59.3], [18.05, 59.3], [18.05, 59.33], [18.0, 59.33], [18.0, 59.3]]];
    serve('tests/geo/lm/token', () => ({ access_token: 'stac-token', expires_in: 3600 }));
    serve('tests/geo/lm/stac-vektor/v1/search', () => ({ type: 'FeatureCollection', links: [], features: [
      { type: 'Feature', id: '0180', properties: { title: 'Byggnader för Stockholms kommun' }, geometry: { type: 'Polygon', coordinates: square }, assets: { data: { href: BASE + '/lm-files/byggnad.zip', type: 'application/zip' } } },
      { type: 'Feature', id: 'm1', properties: { title: 'Höjdmodell' }, geometry: { type: 'Polygon', coordinates: square }, assets: { data: { href: 'https://elsewhere.invalid/hojd/m1.tif', type: 'image/tiff' } } },
    ] }));
    const inner = new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { objektidentitet: 'b1', andamal: 'Bostad' }, geometry: { type: 'Polygon', coordinates: square } }] }));
    const zipped = await (await zip.createZip({ 'byggnad/byggnad.geojson': inner, '__MACOSX/byggnad/._byggnad.geojson': new Uint8Array([1, 2]) })).arrayBuffer();
    D.net.virtual('tests/geo/lm-files/byggnad.zip', () => Promise.resolve({ kind: 'binary', data: zipped }));
    names.push('tests/geo/lm-files/byggnad.zip');
    const sent = []; const real = http.request;
    http.request = (req) => {
      sent.push({ url: String(req.url), auth: String((req.headers || {}).Authorization || '') });
      // The file on another host is answered here: the test never goes to the network.
      if (/elsewhere\.invalid/.test(String(req.url))) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), url: req.url, text: '', buffer: new Uint8Array([73, 73, 42, 0]).buffer, contentType: 'image/tiff', ms: 1 });
      return real(req);
    };
    const created = [];
    try {
      const endpoint = connector.endpoints.find((e) => e.id === 'vektor');
      const table = await runner.fetchTable(connector, endpoint, { collections: 'byggnad', bbox: '17.9,59.3,18.1,59.4' });
      assert.equal(table.rows.length, 2);
      const search = sent.find((s) => /\/stac-vektor\/v1\/search/.test(s.url));
      assert.ok(search && /collections=byggnad/.test(search.url) && /bbox=17\.9%2C59\.3%2C18\.1%2C59\.4|bbox=17\.9,59\.3,18\.1,59\.4/.test(search.url), 'collection and area in the search: ' + (search && search.url));
      assert.equal(search.auth, 'Bearer stac-token', 'the token from the key');
      const meta = await runner.toDataset(table, { name: 'STAC-test', source: runner.describeSource(connector, endpoint, { collections: 'byggnad' }, table) });
      created.push(meta.id);
      const found = await files.of(meta);
      assert.deepEqual(found.files.map((f) => [f.name, f.importable]), [['byggnad.zip', true], ['m1.tif', false]], 'the files and which can be read in');
      // The card: two buttons; reading in gives the dataset from inside the ZIP.
      let selected = null;
      const ctx = { store: { get: () => ({}), set: (patch) => { selected = patch.selectedId || selected; } }, shell: { log() {} }, ui: { button: D.require('ui/basic').button } };
      const card = insight.filesCard(ctx, meta);
      document.body.appendChild(card);
      try {
        const button = await waitFor(() => card.querySelector('[data-files-import]'), 5000, 'the import button');
        assert.ok(card.querySelector('[data-files-save]'), 'and the one that saves the other files');
        sent.length = 0;
        /** @type {any} */ (button).click();
        await waitFor(() => card.querySelector('[data-files-message]'), 20000, 'the files read in');
        assert.ok(selected, 'the new dataset is selected');
        created.push(selected);
        const ds = await datasets.get(selected);
        assert.equal(ds.rowCount, 1, 'the layer inside the ZIP');
        assert.ok((await datasets.columns(selected)).some((c) => /geometri|geometry/.test(c.name)), 'with its geometry');
        assert.equal(ds.source.url, BASE + '/lm-files/byggnad.zip', 'the dataset remembers the file');
        const fileReq = sent.find((s) => /lm-files\/byggnad\.zip/.test(s.url));
        assert.equal(fileReq && fileReq.auth, 'Bearer stac-token', 'the key goes to the file host');
      } finally { card.remove(); }
      sent.length = 0;
      await files.fetchFile(connector, 'https://elsewhere.invalid/hojd/m1.tif');
      assert.equal(sent[0].auth, '', 'never to another host');
      return created.length + ' datasets';
    } finally {
      http.request = real;
      for (const id of created) await datasets.remove(id).catch(() => {});
      await connectors.remove(connector.id).catch(() => {});
      await secrets.forget(connector.id);
      D.require('api/auth').clearToken(connector.id);
    }
  }, 60000);

  test('geodata: Höjd ur markhöjdmodellen reads each point in the terrain model tile that covers it, with the key, and a height profile along a line becomes a dataset and a line chart', async (assert) => {
    const recipes = D.require('data/recipes');
    const http = D.require('api/http');
    if (!globalThis.GeoTIFF) await D.assets.loadVendorScript('vendor/geotiff/geotiff.js');
    const GeoTIFF = /** @type {any} */ (globalThis).GeoTIFF;
    // A tile of 4 × 4 cells of 10 m in SWEREF 99 TM, upper left corner E 674 000, N 6 580 040; the heights are 10 to 25 row by row.
    const tif = GeoTIFF.writeArrayBuffer(Array.from({ length: 16 }, (_, i) => 10 + i), { width: 4, height: 4, ModelPixelScale: [10, 10, 0], ModelTiepoint: [0, 0, 0, 674000, 6580040, 0], ProjectedCSTypeGeoKey: 3006, GTModelTypeGeoKey: 1, GTRasterTypeGeoKey: 1 });
    // The preset itself, pointed at a simulated Lantmäteriet; the user's copy with the preset's id takes its place until it is removed.
    const preset = await connectors.get('lantmateriet-stac');
    const copy = JSON.parse(JSON.stringify(preset));
    Object.assign(copy, { baseUrl: BASE + '/lmh' });
    copy.auth.tokenUrl = BASE + '/lmh/token';
    copy.files.hosts = ['tests'];
    await connectors.save(copy);
    secrets.set('lantmateriet-stac', { clientId: 'nyckel', clientSecret: 'hemlighet' });
    serve('tests/geo/lmh/token', () => ({ access_token: 'hojd-token', expires_in: 3600 }));
    serve('tests/geo/lmh/stac-hojd/v1/search', () => ({ type: 'FeatureCollection', links: [], features: [
      { type: 'Feature', id: '658_67', properties: { 'proj:bbox': [674000, 6580000, 674040, 6580040] }, geometry: null, assets: { data: { href: BASE + '/lmh-files/dtm.tif', type: 'image/tiff; application=geotiff; profile=cloud-optimized' } } }] }));
    D.net.virtual('tests/geo/lmh-files/dtm.tif', () => Promise.resolve({ kind: 'binary', data: tif }));
    names.push('tests/geo/lmh-files/dtm.tif');
    const sent = []; const real = http.request;
    http.request = (req) => { sent.push({ url: String(req.url), auth: String((req.headers || {}).Authorization || '') }); return real(req); };
    const realFetch = globalThis.fetch; const fetched = [];
    globalThis.fetch = (input, init) => { fetched.push({ url: String(input), auth: String(((init && init.headers) || {}).Authorization || '') }); return realFetch(input, init); };
    let id = null; let id2 = null; let made = null;
    try {
      const middle = D.require('data/geo').swerefToWgs84(674015, 6580025, 3006);
      const csv = `namn;x;y\nhörnet;674005;6580035\nmotsatt;674035;6580005\nmitten;${middle[0].toFixed(7)};${middle[1].toFixed(7)}\nutanför;690000;6600000\n`;
      const meta = await D.require('io/import').run(new File([csv], 'punkter.csv'), {}, null, 'Höjdpunkter');
      id = meta.id;
      const res = await recipes.apply(id, 'geo_height', { lonColumn: 'x', latColumn: 'y', name: 'hojd' });
      const rows = await datasets.query(id);
      const cols = (await datasets.columns(id)).map((c) => c.name);
      const h = rows.map((r) => r[cols.indexOf('hojd')]);
      assert.deepEqual(h, [10, 25, 15, null], 'the cell under each point; nothing outside the model');
      assert.ok(res && res.matched === 3, 'three of four points: ' + JSON.stringify(res));
      assert.ok(sent.some((s) => /stac-hojd\/v1\/search/.test(s.url) && /collections=dtm-cog/.test(s.url) && s.auth === 'Bearer hojd-token'), 'the terrain model searched with the key');
      const tile = fetched.find((f) => /lmh-files\/dtm\.tif/.test(f.url));
      assert.ok(tile && tile.auth === 'Bearer hojd-token', 'the tile read with the key from the file host');
      // Along a line of 30 m in the top row of the tile: a point every 10 m reads 10, 11, 12 and 13.
      const lineCsv = ['namn;geometri', 'linjen;LINESTRING (674005 6580035, 674035 6580035)', 'utanför;LINESTRING (690000 6600000, 690100 6600000)', ''].join(String.fromCharCode(10));
      const lines = await D.require('io/import').run(new File([lineCsv], 'linjer.csv'), {}, null, 'Höjdlinjer');
      id2 = lines.id;
      const res2 = await recipes.apply(id2, 'geo_height_along', { column: 'geometri', step: 10, prefix: 'hojd' });
      const cols2 = (await datasets.columns(id2)).map((c) => c.name);
      const rows2 = await datasets.query(id2);
      const pick = (r) => ['hojd_min', 'hojd_max', 'hojd_medel'].map((n) => r[cols2.indexOf(n)]);
      assert.deepEqual(rows2.map(pick), [[10, 13, 11.5], [null, null, null]], 'lowest, highest and mean along the line');
      assert.ok(res2 && res2.matched === 1, JSON.stringify(res2));
      // A height profile along the lines (F37 c): a derived dataset with a point every 10 m, named by the namn column, and a line chart.
      const profile = D.require('viz/profile');
      assert.ok(await profile.likely(id2), 'a geometry column is likely');
      assert.deepEqual((await profile.columns(id2)).map((c) => c.name), ['geometri', 'namn'], 'the geometry column first');
      made = await profile.build(lines, { column: 'geometri', label: 'namn', rows: 2, step: 10 });
      assert.ok(made && made.lines === 2 && made.found === 4 && made.points === 15, JSON.stringify(made && { lines: made.lines, found: made.found, points: made.points }));
      assert.equal(made.dataset.name, t('profile.name', { name: 'Höjdlinjer' }));
      assert.deepEqual((await datasets.columns(made.dataset.id)).map((c) => c.name), ['linje', 'avstand_m', 'hojd_m', 'ost', 'nord']);
      const prows = await datasets.query(made.dataset.id);
      assert.deepEqual(prows.filter((r) => r[0] === 'linjen').map((r) => [r[1], r[2], r[3], r[4]]), [[0, 10, 674005, 6580035], [10, 11, 674015, 6580035], [20, 12, 674025, 6580035], [30, 13, 674035, 6580035]], 'distance, height and place every 10 m');
      assert.ok(prows.filter((r) => r[0] === 'utanför').length === 11 && prows.filter((r) => r[0] === 'utanför').every((r) => r[2] === null), 'the line outside the model keeps its points without heights');
      const st = made.chart.vega.state;
      assert.ok(made.chart.id && made.chart.datasetId === made.dataset.id && made.chart.vega.type === 'line' && st.x.field === 'avstand_m' && st.y.field === 'hojd_m' && st.y.aggregate === 'none' && st.color.field === 'linje', 'a saved line chart over the profile: ' + JSON.stringify(st));
      assert.ok((await charts.list(made.dataset.id)).some((c) => c.id === made.chart.id), 'listed for the dataset');
      const none = await profile.build(lines, { column: 'geometri', rows: 1, step: 10 }).catch((err) => err);
      assert.ok(none && none.found === 4 && !none.chart.vega.state.color, 'one line gives no colour channel');
      await datasets.remove(none.dataset.id); await charts.remove(none.chart.id);
      return h.join(', ');
    } finally {
      http.request = real; globalThis.fetch = realFetch;
      if (id) await datasets.remove(id).catch(() => {});
      if (id2) await datasets.remove(id2).catch(() => {});
      if (made) { await datasets.remove(made.dataset.id).catch(() => {}); await charts.remove(made.chart.id).catch(() => {}); }
      await connectors.remove('lantmateriet-stac');
      await secrets.forget('lantmateriet-stac');
      D.require('api/auth').clearToken('lantmateriet-stac');
    }
  }, 60000);

  // Excerpts of real answers (2026-11-27). Naturvårdsregistret is an ArcGIS Server WFS that calls GeoJSON "GEOJSON", refuses
  // application/json and sends at most 500 features per request (CountDefault); Kartverket's deegree WFS lists only GML, for all
  // operations; SGU's old GeoServer WFS is switched off.
  const NVR_CAPS = '<?xml version="1.0" encoding="UTF-8"?><wfs:WFS_Capabilities xmlns="http://www.opengis.net/wfs/2.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><ows:OperationsMetadata><ows:Operation name="GetFeature"><ows:Parameter name="resultType"><ows:AllowedValues><ows:Value>results</ows:Value><ows:Value>hits</ows:Value></ows:AllowedValues></ows:Parameter><ows:Parameter name="outputFormat"><ows:AllowedValues><ows:Value>GML32</ows:Value><ows:Value>application/gml+xml; version=3.2</ows:Value><ows:Value>GEOJSON</ows:Value><ows:Value>GEOJSON+ZIP</ows:Value><ows:Value>ESRIGEOJSON</ows:Value><ows:Value>KML</ows:Value></ows:AllowedValues></ows:Parameter></ows:Operation><ows:Constraint name="ImplementsResultPaging"><ows:NoValues/><ows:DefaultValue>TRUE</ows:DefaultValue></ows:Constraint><ows:Constraint name="CountDefault"><ows:NoValues/><ows:DefaultValue>500</ows:DefaultValue></ows:Constraint></ows:OperationsMetadata><wfs:FeatureTypeList><wfs:FeatureType><wfs:Name>Naturvardsregistret_WFS:SkyddadeOmraden</wfs:Name><wfs:Title>SkyddadeOmraden</wfs:Title><wfs:DefaultCRS>urn:ogc:def:crs:EPSG::3006</wfs:DefaultCRS></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>';
  const NVR_EXC = '\n<ExceptionReport\n version="2.0.0" xmlns="http://www.opengis.net/ows/1.1"\n xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n>\n  <Exception exceptionCode="InvalidParameterValue" locator="outputFormat">\n    <ExceptionText><![CDATA[OutputFormat \'application/json\' not supported.]]></ExceptionText>\n  </Exception>\n</ExceptionReport>';
  const KV_CAPS = '<?xml version="1.0" encoding="UTF-8"?><WFS_Capabilities xmlns="http://www.opengis.net/wfs/2.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><ows:OperationsMetadata><ows:Operation name="GetFeature"><ows:DCP><ows:HTTP><ows:Get xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://wfs.geonorge.no/skwms1/wfs.administrative_enheter?"/></ows:HTTP></ows:DCP></ows:Operation><ows:Parameter name="version"><ows:AllowedValues><ows:Value>2.0.0</ows:Value></ows:AllowedValues></ows:Parameter><ows:Parameter name="outputFormat"><ows:AllowedValues><ows:Value>text/xml; subtype=gml/3.2.1</ows:Value><ows:Value>application/gml+xml; version=3.2</ows:Value></ows:AllowedValues></ows:Parameter></ows:OperationsMetadata><FeatureTypeList><FeatureType><Name xmlns:app="https://skjema.geonorge.no/SOSI/produktspesifikasjon/AdmEnheter/20240101">app:Fylke</Name><Title>Fylke</Title><DefaultCRS>urn:ogc:def:crs:EPSG::4258</DefaultCRS></FeatureType></FeatureTypeList></WFS_Capabilities>';
  const KV_EXC = "<?xml version='1.0' encoding='UTF-8'?>\n<ows:ExceptionReport xmlns:ows=\"http://www.opengis.net/ows/1.1\" version=\"2.0.0\">\n  <ows:Exception exceptionCode=\"InvalidParameterValue\" locator=\"outputFormat\">\n    <ows:ExceptionText>This WFS is not configured to handle the output/input format 'application/json'</ows:ExceptionText>\n  </ows:Exception>\n</ows:ExceptionReport>";
  const SGU_EXC = '<?xml version="1.0" encoding="UTF-8"?><ows:ExceptionReport xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:ows="http://www.opengis.net/ows" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0">\n  <ows:Exception exceptionCode="ServiceUnavailable">\n    <ows:ExceptionText>Service WFS is disabled</ows:ExceptionText>\n  </ows:Exception>\n</ows:ExceptionReport>\n';

  test('geodata: a WFS is read in the GeoJSON format and page size its capabilities name, one that offers only GML in GML, and one with neither says so', async (assert) => {
    assert.equal(geodata.jsonFormat(['GML32', 'application/geo+json', 'application/json']), 'application/json', 'application/json first');
    assert.equal(geodata.jsonFormat(['gml3', 'application/geo+json', 'json']), 'application/geo+json');
    assert.equal(geodata.jsonFormat(['GML2', 'json']), 'json');
    assert.equal(geodata.jsonFormat(['GML32', 'GEOJSON', 'ESRIGEOJSON']), 'GEOJSON', 'as the server spells it');
    assert.equal(geodata.jsonFormat(['GML2', 'application/json; subtype=geojson']), 'application/json; subtype=geojson', 'MapServer');
    assert.equal(geodata.jsonFormat(['GML32', 'ESRIGEOJSON', 'application/vnd.ogc.fg+json']), null, 'Esri JSON and JSON-FG are not GeoJSON');
    const ids = [];
    try {
      serve('tests/geo/nvr', (u) => {
        if (u.searchParams.get('request') === 'GetCapabilities') return NVR_CAPS;
        if (u.searchParams.get('outputFormat') !== 'GEOJSON') return NVR_EXC;
        // ArcGIS Server sends no numberMatched and at most 500 features.
        const start = Number(u.searchParams.get('startIndex') || 0); const count = Math.min(500, Number(u.searchParams.get('count') || 500));
        return { type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:4326' } }, features: ALL.slice(start, start + count) };
      });
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/nvr' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'discovered: ' + r.discoveryError);
      const ep = r.connector.endpoints[0];
      assert.equal(ep.params.find((p) => p.name === 'outputFormat').default, 'GEOJSON', 'the format is kept in the source');
      assert.equal(ep.pagination.size, 500, 'pages of CountDefault, so that paging does not stop after the first 500');
      assert.equal(geodata.genericEndpoint(r.connector).params.find((p) => p.name === 'outputFormat').default, 'GEOJSON', 'the generic endpoint too');
      served.length = 0;
      const table = await runner.fetchTable(r.connector, ep, {});
      assert.equal(table.rows.length, 3);
      const q = new URL(served[0]);
      assert.deepEqual(['GEOJSON', '500', 'EPSG:4326'], ['outputFormat', 'count', 'srsName'].map((k) => q.searchParams.get(k)));
      // Kartverket: GML only, named for all operations; read as GML 3.2 (F130 a, tests/gml.test.js reads the answers).
      serve('tests/geo/kv', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? KV_CAPS : KV_EXC));
      const r2 = await geodata.createConnector('wfs', { baseUrl: BASE + '/kv' });
      ids.push(r2.connector.id);
      assert.equal(r2.discoveryError, null, 'GML is read: ' + r2.discoveryError);
      assert.deepEqual(r2.connector.endpoints.map((e) => [e.id, e.response.format]), [['layer-app-fylke', 'gml'], ['layer', 'gml']]);
      assert.equal(r2.connector.endpoints[0].params.find((p) => p.name === 'outputFormat').default, 'text/xml; subtype=gml/3.2.1');
      // Neither GeoJSON nor GML: the source is kept with its generic endpoint and says why.
      serve('tests/geo/shp', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? KV_CAPS.replace('<ows:Value>text/xml; subtype=gml/3.2.1</ows:Value><ows:Value>application/gml+xml; version=3.2</ows:Value>', '<ows:Value>SHAPE-ZIP</ows:Value><ows:Value>csv</ows:Value>') : KV_EXC));
      const r4 = await geodata.createConnector('wfs', { baseUrl: BASE + '/shp' });
      ids.push(r4.connector.id);
      assert.ok(r4.discoveryError && r4.discoveryError === t('geodata.err.nojson', { formats: 'SHAPE-ZIP, csv' }), 'neither GeoJSON nor GML said plainly: ' + r4.discoveryError);
      assert.deepEqual(r4.connector.endpoints.map((e) => e.id), ['layer']);
      // Capabilities that list no formats keep application/json (the GeoServer default).
      serve('tests/geo/plain', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? CAPS : { type: 'FeatureCollection', features: [] }));
      const r3 = await geodata.createConnector('wfs', { baseUrl: BASE + '/plain' });
      ids.push(r3.connector.id);
      assert.equal(r3.connector.endpoints[0].params.find((p) => p.name === 'outputFormat').default, 'application/json');
      assert.equal(r3.connector.endpoints[0].pagination.size, 1000);
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: an OGC exception report is the service\'s own error, in the capabilities and in GetFeature, also with status 400', async (assert) => {
    const http = D.require('api/http');
    assert.deepEqual(http.owsException(SGU_EXC), { code: 'ServiceUnavailable', locator: '', text: 'Service WFS is disabled' });
    assert.deepEqual(http.owsException(NVR_EXC), { code: 'InvalidParameterValue', locator: 'outputFormat', text: "OutputFormat 'application/json' not supported." }, 'CDATA and no prefix');
    assert.deepEqual(http.owsException('<?xml version="1.0"?><ServiceExceptionReport version="1.1.1"><ServiceException code="LayerNotDefined">Layer &quot;x&quot; is not defined</ServiceException></ServiceExceptionReport>'), { code: 'LayerNotDefined', locator: '', text: 'Layer "x" is not defined' }, 'the older report');
    assert.equal(http.owsException(CAPS), null, 'capabilities are not an error');
    assert.equal(http.owsException('{"type":"FeatureCollection","features":[]}'), null);
    const e400 = http.httpError({ ok: false, status: 400, text: KV_EXC, url: 'https://x/wfs' }, 'Kartverket');
    assert.ok(e400.message.startsWith('Kartverket: ') && e400.message.includes("This WFS is not configured to handle the output/input format 'application/json'") && e400.message.includes('InvalidParameterValue, outputFormat') && !e400.message.includes('<'), e400.message);
    assert.equal(e400.status, 400);
    const ids = [];
    try {
      // SGU's switched-off WFS answers 200 with a report: the service's text, not "no layers".
      serve('tests/geo/sgu', () => SGU_EXC);
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/sgu' });
      ids.push(r.connector.id);
      assert.ok(r.discoveryError && r.discoveryError.includes('Service WFS is disabled') && r.discoveryError.includes('ServiceUnavailable') && !r.discoveryError.includes(t('geodata.err.nolayers')), r.discoveryError);
      // A source saved before the format was read asks for application/json and gets Naturvårdsregistret's report.
      serve('tests/geo/nvr2', (u) => (u.searchParams.get('request') === 'GetCapabilities' ? NVR_CAPS : NVR_EXC));
      const r2 = await geodata.createConnector('wfs', { baseUrl: BASE + '/nvr2' }, { discover: false });
      ids.push(r2.connector.id);
      const err = await runner.fetchTable(r2.connector, geodata.genericEndpoint(r2.connector), { typeNames: 'Naturvardsregistret_WFS:SkyddadeOmraden' }).then(() => null, (x) => x);
      assert.ok(err && err.message.includes("OutputFormat 'application/json' not supported.") && err.message.includes('InvalidParameterValue') && !err.message.includes('JSON:'), 'the report, not "not valid JSON": ' + (err && err.message));
      // ... and with status 400, as deegree answers.
      D.net.virtual('tests/geo/kv400', () => Promise.resolve({ kind: 'text', data: KV_EXC, status: 400 }));
      names.push('tests/geo/kv400');
      const r3 = await geodata.createConnector('wfs', { baseUrl: BASE + '/kv400' }, { discover: false });
      ids.push(r3.connector.id);
      const err3 = await runner.fetchTable(r3.connector, geodata.genericEndpoint(r3.connector), { typeNames: 'app:Fylke' }).then(() => null, (x) => x);
      assert.ok(err3 && err3.message.includes('This WFS is not configured') && err3.status === 400, err3 && err3.message);
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: an ArcGIS directory with only folders is read in its folders, each service gives its queryable layers, and an ArcGIS error is reported', async (assert) => {
    // Riksantikvaren's directory (2026-11-27): folders only at the root, layer 1 but no layer 0, a feature and a map service of the
    // same name, a service closed to the public; SYKE's flood service starts with a group layer.
    const RA = 'tests/geo/ra/rest/services';
    const routes = {
      '': { currentVersion: 11.3, folders: ['Andretjenester', 'MABYGIS', 'Utilities'], services: [] },
      '/Andretjenester': { currentVersion: 11.3, folders: [], services: [] },
      '/MABYGIS': { currentVersion: 11.3, folders: [], services: [{ name: 'MABYGIS/admin', type: 'MapServer' }, { name: 'MABYGIS/MABYGIS_Askeladden', type: 'FeatureServer' }, { name: 'MABYGIS/MABYGIS_Askeladden', type: 'MapServer' }, { name: 'MABYGIS/Tulva', type: 'MapServer' }, { name: 'MABYGIS/Bilder', type: 'ImageServer' }] },
      '/MABYGIS/admin/MapServer': { status: 'error', messages: ['Administrative access is disabled. Please contact your system administrator to enable it.'], code: 403 },
      '/MABYGIS/MABYGIS_Askeladden/FeatureServer': { maxRecordCount: 1000, layers: [{ id: 1, name: 'Dispensasjoner', parentLayerId: -1, defaultVisibility: true, subLayerIds: null, minScale: 0, maxScale: 0, type: 'Feature Layer', geometryType: 'esriGeometryPolygon' }], tables: [] },
      '/MABYGIS/Tulva/MapServer': { maxRecordCount: 500, layers: [{ id: 0, name: 'Assets values', parentLayerId: -1, subLayerIds: [1, 2], type: 'Group Layer', geometryType: null }, { id: 1, name: 'predominantly', parentLayerId: 0, subLayerIds: null, type: 'Feature Layer', geometryType: 'esriGeometryPolygon' }, { id: 2, name: 'Raster', parentLayerId: 0, subLayerIds: null, type: 'Raster Layer' }] },
      '/MABYGIS/MABYGIS_Askeladden/FeatureServer/1/query': { type: 'FeatureCollection', features: ALL },
      '/MABYGIS/MABYGIS_Askeladden/FeatureServer/0/query': { error: { code: 400, extendedCode: -2147024809, message: 'Invalid or missing input parameters.', details: ['Invalid Layer or Table ID: 0.'] } },
    };
    for (const [path, body] of Object.entries(routes)) serve(RA + path, () => body);
    const ids = [];
    try {
      served.length = 0;
      const r = await geodata.createConnector('arcgis', { baseUrl: BASE + '/ra/rest/services' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'discovered: ' + r.discoveryError);
      assert.deepEqual(r.entities.map((e) => [e.id, e.name, e.abstract]), [['MABYGIS/MABYGIS_Askeladden/FeatureServer/1', 'MABYGIS_Askeladden: Dispensasjoner', 'Polygon'], ['MABYGIS/Tulva/MapServer/1', 'Tulva: predominantly', 'Polygon']], 'the feature service, no group or raster layers, the closed service left out');
      assert.ok(!served.some((u) => /\/Utilities/.test(u)) && !served.some((u) => /MABYGIS_Askeladden\/MapServer/.test(u)), 'Utilities and the duplicate map service are not read');
      const [askeladden, tulva] = r.connector.endpoints;
      assert.equal(askeladden.path, '/MABYGIS/MABYGIS_Askeladden/FeatureServer/1/query');
      assert.equal(tulva.pagination.size, 500, 'pages of maxRecordCount');
      assert.equal(tulva.params.find((p) => p.name === 'resultRecordCount').default, 500);
      const table = await runner.fetchTable(r.connector, askeladden, {});
      assert.equal(table.rows.length, 3);
      // An ArcGIS error in an answer of status 200 is the service's message, not an empty layer.
      const err = await runner.fetchTable(r.connector, geodata.genericEndpoint(r.connector), { layer: 'MABYGIS/MABYGIS_Askeladden/FeatureServer/0' }).then(() => null, (x) => x);
      assert.ok(err && err.message.includes('Invalid or missing input parameters. Invalid Layer or Table ID: 0.'), err && err.message);
      // The folder's own address: the layers are relative to it.
      const r2 = await geodata.createConnector('arcgis', { baseUrl: BASE + '/ra/rest/services/MABYGIS' });
      ids.push(r2.connector.id);
      assert.deepEqual(r2.entities.map((e) => e.id), ['MABYGIS_Askeladden/FeatureServer/1', 'Tulva/MapServer/1']);
      assert.equal(r2.connector.endpoints[0].path, '/MABYGIS_Askeladden/FeatureServer/1/query');
      // A service's own address still lists its layers, without group layers.
      const r3 = await geodata.createConnector('arcgis', { baseUrl: BASE + '/ra/rest/services/MABYGIS/Tulva/MapServer' });
      ids.push(r3.connector.id);
      assert.deepEqual(r3.entities.map((e) => [e.id, e.pageSize]), [['1', 500]]);
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: layers whose names share their first 60 characters get endpoints of their own', async (assert) => {
    // Havs- och vattenmyndigheten (2026-11-27): eleven layers in one long workspace name.
    const long = 'vidareutveckling-av-lansstyrelsernas-geografiska-kulturmiljounderlag';
    const types = ['samband', 'siktsektorer', 'A02-lamningar-sverige-linestring-urval-vrak-i-hav'].map((n) => `<wfs:FeatureType><wfs:Name>${long}:${n}</wfs:Name><wfs:Title>${n}</wfs:Title></wfs:FeatureType>`).join('');
    serve('tests/geo/hav', () => `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" version="2.0.0"><wfs:FeatureTypeList>${types}<wfs:FeatureType><wfs:Name>a:b</wfs:Name><wfs:Title>Ett</wfs:Title></wfs:FeatureType><wfs:FeatureType><wfs:Name>a_b</wfs:Name><wfs:Title>Två</wfs:Title></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>`);
    const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/hav' });
    try {
      assert.equal(r.discoveryError, null, r.discoveryError);
      const epIds = r.connector.endpoints.map((e) => e.id);
      assert.equal(new Set(epIds).size, epIds.length, 'unique: ' + epIds.join(' '));
      assert.equal(epIds[0], 'layer-' + (long + '-samband').slice(0, 60), 'the first keeps the short id');
      assert.equal(epIds[1], 'layer-' + long + '-siktsektorer', 'the next one the whole name');
      assert.deepEqual(epIds.slice(3), ['layer-a-b', 'layer-a-b-2', 'layer']);
    } finally { await connectors.remove(r.connector.id).catch(() => {}); }
    return 'ok';
  });

  test('geodata: cleanup', async (assert) => {
    for (const n of names) D.net.unvirtual(n);
    assert.ok(true);
  });
})();
