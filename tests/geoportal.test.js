// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Geodataportalen in Inhämta (PLAN 12 a4, ui/api/geoportal-view): the catalogue's posts on short excerpts of real
 * records (2026-11-28: SCB's Handelsområden with WFS and WMS, SGU's markradar with a ZIP and OGC API, Länsstyrelsen's
 * Kyrkobyggnader as an INSPIRE ATOM feed, SMHI's salinity as WMS, Lantmäteriet's Saccess that needs a licence) sorted by what
 * they link to; the view with the four kinds of posts and their actions (the form of a geodata source, a file through the
 * import, the files of an ATOM feed, a WMS layer on a map), a post marked when it needs a key or an agreement, and a service
 * that shuts the browser out named with the bridge; consent asked per host for what the catalogue chose (F102 a, F103 a); and
 * the source in Inhämta. Nothing touches the net: the services are dataspatium-asset:// addresses, an https host is refused.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const parsers = D.require('api/parsers');
  const connectors = D.require('api/connectors');
  const consent = D.require('platform/consent');
  const geodata = D.require('api/families/geodata');
  const runner = D.require('api/runner');
  const BASE = 'dataspatium-asset://tests/portal';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const names = [];
  function serve(name, fn) {
    names.push(name);
    D.net.virtual(name, (url) => Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })));
  }
  const hit = (id, title, links, lic) => ({ _id: id, _source: { resourceTitleObject: { default: title, langswe: title }, resourceType: ['dataset'], OrgForResource: ['Testverket'], licenseObject: lic, link: links } });
  const L = (protocol, url, name) => ({ protocol, url, name, function: '', applicationProfile: '', description: '', mimeType: '', group: 0 });
  const NO_LIMIT = [{ default: 'Inga begränsningar för allmänhetens tillgång', langswe: 'Inga begränsningar för allmänhetens tillgång', link: 'http://inspire.ec.europa.eu/metadata-codelist/LimitationsOnPublicAccess/noLimitations' }, { default: 'Creative commons  CC0 1.0 Universiell', link: 'http://resources.geodata.se/codelist/metadata/anvandningsrestriktioner.xml#CC01.0' }];
  const CC_BY = [{ default: 'inga tillämpliga villkor', link: 'http://inspire.ec.europa.eu/metadata-codelist/ConditionsApplyingToAccessAndUse/noConditionsApply' }, { default: 'Creative Commons Erkännande 4.0 Internationell (CC BY 4.0)\n\nDu har tillstånd att: DELA och BEARBETA\n\nPå följande villkor: ERKÄNNANDE och INGA YTTERLIGARE BEGRÄNSNINGAR.' }];
  const LICENCE = [{ default: 'Immateriella rättigheter', link: 'http://inspire.ec.europa.eu/metadata-codelist/LimitationsOnPublicAccess/INSPIRE_Directive_Article13_1e' }, { default: 'Licens för användning av resurs krävs. \nFör statliga myndigheter, som inte är affärsverk, är data avgiftsfritt för användning inom det offentliga uppdraget.', link: 'http://inspire.ec.europa.eu/metadata-codelist/ConditionsApplyingToAccessAndUse/noConditionsApply' }];
  /** The real posts, with their links as the catalogue has them. */
  const REAL = { hits: { total: { value: 5, relation: 'eq' }, hits: [
    hit('1804b752-71c2-42af-9b74-a688a5bb1451', 'Handelsområden WFS', [L('HTTP:OGC:WFS', 'https://geodata.scb.se/geoserver/stat/wfs?service=wfs&version=1.1.0&request=GetCapabilities', 'Handelsområden WFS'), L('HTTP:Information', 'https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/statistiska-handelsomraden/', 'Öppna geodata för handelsområden'), L('HTTP:OGC:WMS', 'https://geodata.scb.se/geoserver/stat/wms?service=wms&version=1.3.0&request=GetCapabilities', 'Handelsområden WMS')], NO_LIMIT),
    hit('39de44a4-db9f-4121-8aaf-aeba7c8f35da', 'Geofysiska markmätningar, markradar', [L('HTTP:Information:Produktspecifikation', 'https://resource.sgu.se/dokument/produkter/geofysiska-markmatningar-markradar-beskrivning.pdf', 'Produktbeskrivning'), L('HTTP:Nedladdning', 'https://resource.sgu.se/data/oppnadata/geofysik-mark-markradar/geofysik-mark-markradar.zip', 'Nedladdning ZIP'), L('HTTP:OGC:API-Features', 'https://api.sgu.se/oppnadata/geofysik-mark-markradar/ogc/features/v1', 'Landningssida OGC API - Features')], NO_LIMIT),
    hit('8e7986ca-e519-4877-866b-1e107a1f9238', 'LstS Kyrkobyggnader', [L('HTTP:Nedladdning:Atom', 'https://ext-dokument.lansstyrelsen.se/gemensamt/geodata/ATOM/ATOM_Lsts.Kyrkobyggnader.xml', 'Nedladdning')], CC_BY),
    hit('1723d770-2389-11ed-832f-911b23582b4f', 'SE.OF Oceanografiska observationer - Salthalt: Visningstjänst', [L('HTTP:OGC:WMS', 'https://opendata-view.smhi.se/oc-obs-salinity/OF.PointObservation/wms?service=wms&request=getcapabilities', 'Visningstjänst (WMS)')], NO_LIMIT),
    hit('da3e5412-e9e8-431d-a7a0-f7d70403f426', 'Saccess, ortokorrigerade kartriktiga scener', [L('HTTP:Information:Produktspecifikation', 'https://www.lantmateriet.se/saccess', 'Produktbeskrivning'), L('HTTP:Nedladdning:API', 'https://api.lantmateriet.se/stac-bild/v1/collections/saccess', 'STAC')], LICENCE),
  ] } };
  /** The same posts with the addresses the tests serve (and one https host that is refused). */
  const SERVED = JSON.parse(JSON.stringify(REAL).replace(/https:\/\/geodata\.scb\.se\/geoserver\/stat\/wfs[^"]*/g, BASE + '/wfs?service=WFS&request=GetCapabilities')
    .replace(/https:\/\/geodata\.scb\.se\/geoserver\/stat\/wms[^"]*/g, BASE + '/wms?service=WMS&request=GetCapabilities')
    .replace('https://resource.sgu.se/data/oppnadata/geofysik-mark-markradar/geofysik-mark-markradar.zip', BASE + '/files/markradar.geojson')
    .replace('https://ext-dokument.lansstyrelsen.se/gemensamt/geodata/ATOM/ATOM_Lsts.Kyrkobyggnader.xml', BASE + '/atom/kyrkobyggnader.xml')
    .replace(/https:\/\/opendata-view\.smhi\.se\/[^"]*/, BASE + '/blocked/wms?service=wms&request=getcapabilities'));
  /** Länsstyrelsen's feed, its one entry pointing at the served file (and the entry's own id kept as it is). */
  const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.w3.org/2005/Atom">
	<title>LstS Kyrkobyggnader</title>
	<updated>2021-01-09T02:21:44</updated>
	<author><name>Organisation: Länsstyrelsen Värmland</name></author>
	<entry xmlns:georss="http://www.georss.org/georss" xml:lang="swe">
		<category term="EPSG:3006"></category>
		<id>${BASE}/files/kyrkobyggnader.geojson</id>
		<link href="${BASE}/files/kyrkobyggnader.geojson" rel="alternate" type="application/geo+json" hreflang="swe" title="Lsts.Kyrkobyggnader"></link>
		<title>Lsts.Kyrkobyggnader</title>
		<updated>2021-01-09T02:20:54</updated>
	</entry>
	<entry>
		<title>Brunnar</title>
		<link rel="alternate" href="${BASE}/atom/brunnar.xml" type="application/atom+xml" hreflang="sv" title="Nedladdning av data för brunnar"/>
		<link rel="related" href="${BASE}/files/brunnar-beskrivning.pdf" type="application/pdf" hreflang="sv" title="Produktbeskrivning för brunnar"/>
	</entry>
</feed>`;
  const GEOJSON = (name) => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { namn: name }, geometry: { type: 'Point', coordinates: [13.5, 59.4] } }] });
  const WMS_CAPS = '<?xml version="1.0"?><WMS_Capabilities xmlns="http://www.opengis.net/wms" version="1.3.0"><Capability><Layer><Title>stat</Title><Layer><Name>stat:Handelsomraden_2020</Name><Title>Handelsområden 2020</Title></Layer><Layer><Name>stat:Handelsomraden_2015</Name><Title>Handelsområden 2015</Title></Layer></Layer></Capability></WMS_Capabilities>';
  const CATALOG = { format: 'dataspatium-api/1', id: 'test-portal', name: 'Testportal', baseUrl: BASE + '/catalog', auth: { type: 'none' }, family: { type: 'geoportal' },
    endpoints: [
      { id: 'search', name: 'Sök', method: 'POST', path: '/_search', bodyType: 'json', body: { query: { query_string: { query: '{q}' } } }, params: [{ name: 'q', in: 'template', type: 'string', required: true }], response: { format: 'geonetwork' } },
      // The served search cannot read the body, so the filtered one says so in its address too.
      { id: 'fetchable', name: 'Sök det som går att hämta', method: 'POST', path: '/_search', bodyType: 'json', body: { query: { bool: { must: [{ query_string: { query: '{q}' } }], filter: [{ terms: { linkProtocol: ['HTTP:OGC:WFS'] } }] } } }, params: [{ name: 'q', in: 'template', type: 'string', required: true }, { name: 'filter', in: 'query', type: 'string', default: 'fetchable', hidden: true }], response: { format: 'geonetwork' } },
    ] };
  const asked = []; const searches = [];
  /** Consent through the asker: the test page's override is lifted, hosts under https are refused, the app's own are allowed. */
  async function withAsker(fn) {
    const key = 'dataspatium.consent';
    const override = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = { url: await consent.state('url'), basemaps: await consent.state('basemaps'), api: await consent.state('api') };
    consent.setAsker(async (purpose, info) => { asked.push({ purpose, host: info.host, perHost: !!info.perHost }); return { allow: !/\./.test(String(info.host)), remember: false }; });
    try { return await fn(); } finally {
      consent.setAsker(null);
      for (const [p, v] of Object.entries(prior)) await consent.set(p, v === 'granted' || v === 'denied' ? v : null);
      if (override !== null) localStorage.setItem(key, override);
    }
  }
  function servePortal(bodies) {
    serve('tests/portal/catalog/_search', (u) => { searches.push(u.searchParams.get('filter') || 'all'); return bodies.shift() || SERVED; });
    serve('tests/portal/atom/kyrkobyggnader.xml', () => ATOM);
    serve('tests/portal/atom/brunnar.xml', () => ATOM.replace('kyrkobyggnader.geojson', 'brunnar.geojson').replace('kyrkobyggnader.geojson', 'brunnar.geojson'));
    serve('tests/portal/files/kyrkobyggnader.geojson', () => GEOJSON('Karlstads domkyrka'));
    serve('tests/portal/files/markradar.geojson', () => GEOJSON('Profil 1'));
    serve('tests/portal/wms', (u) => (/GetCapabilities/i.test(u.searchParams.get('request') || '') ? WMS_CAPS : ''));
    serve('tests/portal/wfs', () => '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" version="2.0.0"><wfs:FeatureTypeList><wfs:FeatureType><wfs:Name>stat:Handelsomraden_2020</wfs:Name><wfs:Title>Handelsområden 2020</wfs:Title></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>');
  }

  test('geoportal: the catalogue\'s posts are sorted by what they link to, with an ATOM feed and a file apart, and the ones that need a licence marked', async (assert) => {
    const table = await parsers.parse(JSON.stringify(REAL), { format: 'geonetwork' });
    const rows = table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i]])));
    const [scb, sgu, lst, smhi, saccess] = rows;
    assert.equal(table.meta.total, 5);
    assert.ok(/geodata\.scb\.se\/geoserver\/stat\/wfs/.test(scb.wfs) && /\/wms\?/.test(scb.wms) && !scb.nedladdning && !scb.atom, 'SCB: WFS and WMS');
    assert.equal(sgu.nedladdning, 'https://resource.sgu.se/data/oppnadata/geofysik-mark-markradar/geofysik-mark-markradar.zip', 'SGU: the ZIP');
    assert.ok(/api\.sgu\.se/.test(sgu.ogc_api), 'SGU: OGC API');
    assert.equal(lst.atom, 'https://ext-dokument.lansstyrelsen.se/gemensamt/geodata/ATOM/ATOM_Lsts.Kyrkobyggnader.xml', 'Länsstyrelsen: the ATOM feed');
    assert.equal(lst.nedladdning, null, 'a feed is no file');
    assert.ok(smhi.wms && !smhi.wfs, 'SMHI: WMS only');
    assert.equal(saccess.nedladdning, null, 'Lantmäteriet\'s STAC is no file to fetch');
    assert.deepEqual(rows.map((r) => r.begransad), [false, false, false, false, true], 'only the post that needs a licence is marked (CC BY\'s "tillstånd att dela" is no constraint)');
    assert.ok(/Licens för användning av resurs krävs/.test(saccess.villkor), saccess.villkor);
    return 'ok';
  });

  test('geoportal: the view lists the four kinds of posts with their actions, reads an ATOM feed, fetches a file, draws a WMS layer, and names the bridge when a service shuts the browser out', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:900px;';
    document.body.appendChild(root);
    const realFetch = globalThis.fetch;
    const fetched = [];
    globalThis.fetch = function (input, init) {
      const url = String(input && input.url ? input.url : input);
      fetched.push(url);
      if (/\/blocked\//.test(url)) return Promise.reject(new TypeError('Failed to fetch'));
      return realFetch.call(this, input, init);
    };
    const calls = { add: [], open: [], bridge: 0 };
    const tiles = [];
    let view = null;
    try {
      await withAsker(async () => {
        servePortal([]);
        view = D.require('ui/api/geoportal-view').create({ connector: CATALOG, log: () => {}, actions: { add: (family, url) => calls.add.push([family, url]), open: (file, url) => calls.open.push([file, url]), bridge: () => { calls.bridge++; } }, tileFactory: (url, opts) => { tiles.push({ url, layers: opts.layers }); return { addTo: () => {} }; } });
        root.appendChild(view.el);
        view.start();
        view.state.q = 'kyrkor';
        await view.search();
        const cards = root.querySelectorAll('.dm-geoportal-card');
        assert.equal(cards.length, 5);
        const card = (i) => /** @type {HTMLElement} */ (root.querySelectorAll('.dm-geoportal-card')[i]);
        const button = (i, text) => Array.from(card(i).querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
        assert.ok(card(4).querySelector('[data-geoportal-restricted]') && card(4).textContent.includes(t('geoportal.restricted')), 'the post that needs a licence is marked');
        assert.ok(!card(0).querySelector('[data-geoportal-restricted]'), 'the open one is not');
        // WFS and OGC API: the form, with the family and the address.
        button(0, t('geoportal.add.wfs')).click();
        button(1, t('geoportal.add.ogcapi')).click();
        assert.deepEqual(calls.add, [['wfs', BASE + '/wfs?service=WFS&request=GetCapabilities'], ['ogcapi', 'https://api.sgu.se/oppnadata/geofysik-mark-markradar/ogc/features/v1']]);
        // A file: fetched and handed over.
        button(1, t('geoportal.download')).click();
        await waitFor(() => calls.open.length === 1, 5000, 'the file handed to the import');
        assert.equal(calls.open[0][1], BASE + '/files/markradar.geojson');
        assert.ok(calls.open[0][0] instanceof File && (await calls.open[0][0].text()).includes('Profil 1'), 'the file itself');
        // An ATOM feed: its files listed (the PDF beside them left out), one fetched; the feed of a dataset opens in turn.
        button(2, t('geoportal.download')).click();
        await waitFor(() => card(2).querySelector('[data-atom]'), 5000, 'the files of the feed');
        assert.ok(card(2).querySelector(`[data-atom-file="${BASE}/files/kyrkobyggnader.geojson"]`), 'the file of the entry');
        assert.ok(card(2).querySelector(`[data-atom-feed="${BASE}/atom/brunnar.xml"]`) && !card(2).textContent.includes('brunnar-beskrivning.pdf'), 'a dataset feed, not the description');
        /** @type {any} */ (card(2).querySelector('[data-atom-file] dm-button')).click();
        await waitFor(() => calls.open.length === 2, 5000, 'the file of the feed handed over');
        assert.ok((await calls.open[1][0].text()).includes('Karlstads domkyrka'));
        // WMS: the layers from the capabilities, the first on a small map as a WMS layer.
        button(0, t('geoportal.map')).click();
        await waitFor(() => tiles.length, 8000, 'the WMS layer made');
        assert.deepEqual(tiles.map((x) => [x.url, x.layers]), [[BASE + '/wms', 'stat:Handelsomraden_2020']]);
        assert.ok(card(0).querySelector('[data-geoportal-map] .leaflet-container, [data-geoportal-map].leaflet-container'), 'a map in the card');
        assert.ok(asked.some((a) => a.purpose === 'basemaps' && a.perHost && a.host === 'tests'), 'the map asks for the host: ' + JSON.stringify(asked));
        // SMHI's WMS shuts the browser out: the bridge's words and a way to the bridge.
        button(3, t('geoportal.map')).click();
        const problem = await waitFor(() => card(3).querySelector('[data-geoportal-problem]'), 5000, 'the problem named');
        assert.ok(problem.textContent.includes(t('api.err.nocors', { host: 'tests' })), problem.textContent);
        Array.from(problem.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('geoportal.bridge')).click();
        assert.equal(calls.bridge, 1);
        // The filter on what can be fetched is the catalogue's filtered search; off, the whole catalogue answers.
        assert.deepEqual(searches.slice(-1), ['fetchable'], 'searched with the filter');
        const only = /** @type {any} */ (root.querySelector('[data-geoportal-fetchable]'));
        only.checked = false; only.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => searches[searches.length - 1] === 'all' && !view.state.loading && root.querySelectorAll('.dm-geoportal-card').length === 5, 5000, 'the search without the filter');
      });
    } finally {
      globalThis.fetch = realFetch;
      if (view) view.destroy();
      root.remove();
    }
    return 'ok';
  }, 60000);

  test('geoportal: what the catalogue chose asks consent for its host, and a refused host is not contacted', async (assert) => {
    const realFetch = globalThis.fetch;
    const fetched = [];
    globalThis.fetch = function (input, init) { fetched.push(String(input && input.url ? input.url : input)); return realFetch.call(this, input, init); };
    const hosts = ['ext-dokument.lansstyrelsen.se', 'wfs.geonorge.no'];
    const ids = [];
    try {
      await withAsker(async () => {
        asked.length = 0;
        const urlImport = D.require('io/url-import');
        const err = await urlImport.fetchFile('https://ext-dokument.lansstyrelsen.se/gemensamt/geodata/ATOM/ATOM_Lsts.Kyrkobyggnader.xml', { perHost: true }).then(() => null, (x) => x);
        assert.ok(err && err.name === 'ConsentError', 'refused: ' + (err && err.message));
        assert.deepEqual(asked, [{ purpose: 'url', host: 'ext-dokument.lansstyrelsen.se', perHost: true }], 'asked for the host');
        // A geodata source from a post: every request asks for its host.
        asked.length = 0;
        const r = await geodata.createConnector('wfs', { baseUrl: 'https://wfs.geonorge.no/skwms1/wfs.stedsnavn' }, { perHost: true });
        ids.push(r.connector.id);
        assert.equal(r.connector.perHost, true, 'kept with the source');
        assert.ok(r.discoveryError, 'the refused host gives no layers');
        assert.deepEqual(asked, [{ purpose: 'api', host: 'wfs.geonorge.no', perHost: true }]);
        const saved = await connectors.get(r.connector.id);
        asked.length = 0;
        const err2 = await runner.fetchTable(saved, geodata.genericEndpoint(saved), { typeNames: 'app:Sted' }).then(() => null, (x) => x);
        assert.ok(err2 && err2.name === 'ConsentError', 'a fetch asks again for the host');
        assert.ok(asked.every((a) => a.perHost && a.host === 'wfs.geonorge.no') && asked.length >= 1, JSON.stringify(asked));
        // The WMS capabilities of a post likewise.
        asked.length = 0;
        const err3 = await D.require('viz/leaflet').wmsLayers('https://opendata-view.smhi.se/oc-obs-salinity/OF.PointObservation/wms', { perHost: true }).then(() => null, (x) => x);
        assert.ok(err3 && err3.name === 'ConsentError');
        assert.deepEqual(asked, [{ purpose: 'basemaps', host: 'opendata-view.smhi.se', perHost: true }]);
      });
      assert.deepEqual(fetched.filter((u) => /^https:/.test(u)), [], 'no https host was contacted');
    } finally {
      globalThis.fetch = realFetch;
      for (const id of ids) await connectors.remove(id).catch(() => {});
      for (const h of hosts) { await consent.setHost('url', h, null); await consent.setHost('api', h, null); }
    }
    return 'ok';
  });

  test('geoportal: in Inhämta under Geodatakällor, a service opens the geodata form filled in and a file goes on in the import', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const ID = 'geodataportalen';
    const before = (await connectors.list()).find((c) => c.id === ID && !c.preset) || null;
    const buttonByText = (text, scope = root) => Array.from(scope.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    try {
      servePortal([]);
      await connectors.save(Object.assign({}, CATALOG, { id: ID, name: 'Geodataportalen (test)' }));
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const item = await waitFor(() => root.querySelector('[data-source="geoportal"]'), 5000, 'Geodataportalen in the tree');
      assert.ok(D.require('ui/modes/inhamta').GROUPS.find((g) => g.id === 'geodata').items.some((i) => i.id === 'geoportal'), 'under Geodatakällor');
      /** @type {HTMLElement} */ (item).click();
      const input = await waitFor(() => root.querySelector('.dm-center .dm-geoportal-search dm-input'), 8000, 'the search');
      assert.ok(root.querySelector('.dm-center [data-source-lead="geoportal"]'), 'the lead says what it is for');
      assert.ok(root.querySelector('.dm-center [data-geoportal-fetchable]'), 'the filter on what can be fetched');
      /** @type {any} */ (input).value = 'handel'; input.dispatchEvent(new Event('input', { bubbles: true }));
      buttonByText(t('geoportal.search')).click();
      await waitFor(() => root.querySelectorAll('.dm-center .dm-geoportal-card').length === 5, 8000, 'the posts');
      // A file: on to the import wizard as a file from an address.
      buttonByText(t('geoportal.download'), /** @type {HTMLElement} */ (root.querySelectorAll('.dm-center .dm-geoportal-card')[1])).click();
      await waitFor(() => root.querySelector('.dm-center') && root.querySelector('.dm-center').textContent.includes('Profil 1'), 10000, 'the preview of the fetched file');
      // A WFS: the geodata form in the workspace with the family and the address filled in.
      /** @type {HTMLElement} */ (root.querySelector('[data-source="geoportal"]')).click();
      await waitFor(() => root.querySelectorAll('.dm-center .dm-geoportal-card').length === 5, 8000, 'the posts kept');
      buttonByText(t('geoportal.add.wfs')).click();
      const field = await waitFor(() => root.querySelector('.dm-center [data-source-form="geodata"] [data-family-field="baseUrl"]'), 8000, 'the geodata form');
      assert.equal(/** @type {any} */ (field).value, BASE + '/wfs?service=WFS&request=GetCapabilities');
      const family = /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center [data-source-form="geodata"] dm-select')).find((s) => (s.getAttribute('label') || '') === t('families.family')));
      assert.equal(family && family.value, 'wfs', 'the family of the post');
    } finally {
      if (before) await connectors.save(before); else await connectors.remove(ID).catch(() => {});
      root.remove();
    }
    return 'ok';
  }, 90000);

  test('geoportal: cleanup', async (assert) => {
    for (const n of names) D.net.unvirtual(n);
    assert.ok(true);
  });
})();
