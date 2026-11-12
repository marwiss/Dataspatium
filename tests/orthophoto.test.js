// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the orthophotos as background maps (decision B-64): the presets and their licences, the consent for background
 * maps with the host named, the keys kept out of addresses that leave the app, the grids each service offers, the choice in
 * Bearbeta's map and Visualisera's map views, and the place of a new building in the brief's site step. Nothing here touches
 * the net: tiles go to a stubbed factory, and the consent asker is a stub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const i18n = D.require('ui/i18n');
  const datasets = D.require('data/datasets');
  const charts = D.require('viz/charts');
  const leaflet = D.require('viz/leaflet');
  const orthophotos = D.require('viz/orthophotos');
  const consent = D.require('platform/consent');
  const secrets = D.require('api/secrets');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  function host(width = 800, height = 500) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute; left:-10000px; top:0; width:${width}px; height:${height}px;`;
    document.body.appendChild(el);
    return el;
  }
  /** A house-sized square in degrees (about 12 × 12 m at 65°N). */
  const house = (lon, lat) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.00025, lat], [lon + 0.00025, lat + 0.0001], [lon, lat + 0.0001], [lon, lat]]] });
  async function footprint(name, lon, lat) {
    const meta = await datasets.create({ name, columns: [{ name: 'namn', type: 'text' }, { name: 'geometry', type: 'text' }], rows: [['Huset', JSON.stringify(house(lon, lat))]] });
    created.push(meta.id);
    return meta;
  }
  /**
   * Run with the consent for background maps not yet given and a recording asker (the test page grants everything, so its
   * switch is lifted for the duration); everything is put back afterwards.
   */
  async function withConsent(answer, fn) {
    const key = 'dataspatium.consent';
    const before = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('basemaps');
    await consent.set('basemaps', null);
    const asked = [];
    consent.setAsker(async (purpose, info) => { asked.push(Object.assign({ purpose }, info)); return typeof answer === 'function' ? answer(purpose, info) : answer; });
    try { return await fn(asked); } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (before !== null) localStorage.setItem(key, before);
    }
  }

  test('orthophoto: the presets parse and carry an open licence, an attribution, a source in Web Mercator and, where a key is asked, its parameter and sign-up page', async (assert) => {
    const list = await orthophotos.list();
    assert.deepEqual(list.map((b) => b.id), ['ortho-dk', 'ortho-fi', 'ortho-is'], 'Denmark, Finland and Iceland');
    for (const b of list) {
      assert.ok(/^CC (BY 4\.0|0)/.test(b.license.name) && b.license.url.startsWith('https://creativecommons.org/'), b.id + ': an open licence: ' + b.license.name);
      assert.ok(b.attribution.includes(b.publisher), b.id + ': the attribution names the provider: ' + b.attribution);
      assert.ok(/^https:\/\//.test(orthophotos.sourceFor(b, 3857).url), b.id + ': a source in Web Mercator');
      assert.ok(Array.isArray(b.bounds) && b.bounds.length === 4 && b.terms && b.docs, b.id + ': area, terms and documentation');
      assert.ok(t('map.basemap.' + b.id) !== 'map.basemap.' + b.id, b.id + ': a label');
    }
    const is = list.find((b) => b.id === 'ortho-is'); const dk = list.find((b) => b.id === 'ortho-dk'); const fi = list.find((b) => b.id === 'ortho-fi');
    assert.ok(!is.key && dk.key.param === 'apikey' && fi.key.param === 'api-key', 'Iceland needs no key; Denmark and Finland name their parameter');
    assert.ok(dk.key.signupUrl.includes('datafordeler.dk') && fi.key.signupUrl.includes('maanmittauslaitos.fi'), 'the sign-up pages');
    assert.deepEqual(orthophotos.grids(is).sort((x, y) => x - y), [3057, 3857], 'Iceland also in ISN93');
    assert.deepEqual(orthophotos.grids(dk).sort((x, y) => x - y), [3857, 25832], 'Denmark also in UTM 32N');
    assert.deepEqual(orthophotos.grids(fi), [3857], 'Finland in Web Mercator only');
    assert.equal(orthophotos.sourceFor(fi, 3067), null, 'no source in a grid the service does not offer');
    assert.equal(orthophotos.attributionText(is), 'Grunnkort – Loftmynd © Náttúrufræðistofnun (CC BY 4.0)');
    // A file with a preset that lacks its licence or a WMS layer is refused; an attribution is escaped for Leaflet.
    const bad = (patch) => JSON.stringify({ format: orthophotos.FORMAT, basemaps: [Object.assign({}, is, patch)] });
    await assert.throws(() => orthophotos.parse(bad({ license: { name: 'CC BY 4.0' } })), /incomplete preset ortho-is/);
    await assert.throws(() => orthophotos.parse(bad({ sources: { 3857: { url: 'https://example.org/wms' } } })), /without layers/);
    await assert.throws(() => orthophotos.parse(bad({ key: { param: 'k' } })), /sign-up page/);
    await assert.throws(() => orthophotos.parse('{"format":"other","basemaps":[]}'), /unknown format/);
    const html = orthophotos.attributionHtml(Object.assign({}, is, { attribution: 'A <b>bold</b> & co' }));
    assert.ok(html.startsWith('A &lt;b&gt;bold&lt;/b&gt; &amp; co (<a href="https://creativecommons.org/licenses/by/4.0/"'), html);
    return list.map((b) => b.id).join(', ');
  });

  test('orthophoto: the consent for background maps is asked on first use with the host named, a refusal leaves the map without tiles, and each grid gets its own source', async (assert) => {
    const el = host();
    try {
      await withConsent({ allow: false, remember: false }, async (asked) => {
        const made = [];
        const factory = (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; };
        const hd = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-is' } }, { tileFactory: factory });
        assert.equal(asked.length, 1, 'asked once');
        assert.ok(asked[0].purpose === 'basemaps' && asked[0].host === 'gis.natt.is' && asked[0].label.includes('Náttúrufræðistofnun') && asked[0].label.includes('CC BY 4.0'), JSON.stringify(asked[0]));
        assert.ok(hd.info.basemapDenied && !made.length, 'refused: no tile layer');
        hd.finalize();
      });
      await withConsent({ allow: true, remember: false }, async (asked) => {
        const made = [];
        const factory = (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; };
        const hd = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-is' } }, { tileFactory: factory });
        assert.ok(made.length === 1 && made[0].url === 'https://gis.natt.is/mapcache/web-mercator/wms' && made[0].opts.layers === 'grunnkort-loftmynd' && made[0].opts.version === '1.3.0', JSON.stringify(made[0]));
        assert.ok(/Náttúrufræðistofnun/.test(made[0].opts.attribution) && /CC BY 4\.0/.test(made[0].opts.attribution), 'the provider\'s attribution on the map: ' + made[0].opts.attribution);
        assert.equal(asked.length, 1);
        hd.finalize();
        // In Iceland's own grid the service has its own address, asked for with WMS 1.1.1.
        made.length = 0;
        const hd2 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-is', crs: 3057 } }, { tileFactory: factory });
        assert.ok(hd2.crs === 3057 && made.length === 1 && made[0].url === 'https://gis.natt.is/mapcache/isn93/wms' && made[0].opts.version === '1.1.1', JSON.stringify(made[0]));
        hd2.finalize();
        // A grid the service does not offer gets no tiles and no question.
        made.length = 0; asked.length = 0;
        const hd3 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-is', crs: 3006 } }, { tileFactory: factory });
        assert.ok(hd3.info.basemapProjection && !made.length && !asked.length, 'no orthophoto of Iceland in SWEREF 99 TM');
        hd3.finalize();
      });
    } finally { el.remove(); }
    return 'ok';
  }, 30000);

  test('orthophoto: a key stays in the session: without it nothing is asked or fetched, with it it goes only into the image addresses, never into the consent, the saved map or published HTML', async (assert) => {
    const el = host();
    const KEY_DK = 'dk-test-key-0001'; const KEY_FI = 'fi/test key';
    try {
      await secrets.forget('basemap:ortho-dk'); await secrets.forget('basemap:ortho-fi');
      await withConsent({ allow: true, remember: false }, async (asked) => {
        const made = [];
        const factory = (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; };
        const chart = { kind: 'map', name: 'Nyckelprov', map: { layers: [], basemap: 'ortho-dk' } };
        const hd = await leaflet.render(el, chart, { tileFactory: factory });
        assert.ok(hd.info.basemapKey === 'ortho-dk' && !made.length && !asked.length, 'no key: no question and no tiles');
        assert.ok(D.require('ui/viz/basemap-choice').keyNotice(hd.info).includes(t('map.basemap.ortho-dk')), 'the notice names the orthophoto');
        hd.finalize();
        secrets.set('basemap:ortho-dk', { apiKey: KEY_DK });
        const hd2 = await leaflet.render(el, chart, { tileFactory: factory });
        assert.ok(made.length === 1 && made[0].url === 'https://wms.datafordeler.dk/GeoDanmarkOrto/orto_foraar/1.0.0/WMS' && made[0].opts.apikey === KEY_DK && made[0].opts.layers === 'orto_foraar', 'the key as the WMS parameter apikey');
        assert.ok(asked.length === 1 && asked[0].host === 'wms.datafordeler.dk' && !JSON.stringify(asked).includes(KEY_DK), 'the consent names the host, without the key');
        hd2.finalize();
        assert.ok(!JSON.stringify(chart).includes(KEY_DK), 'the map definition carries no key');
        const published = await leaflet.htmlFor('m1', chart);
        assert.ok(!published.includes(KEY_DK) && !/tileLayer/.test(published), 'published HTML leaves out an orthophoto with a key');
        // Finland's tiles are an XYZ template: the key is a parameter that Leaflet fills in per tile, encoded.
        made.length = 0;
        secrets.set('basemap:ortho-fi', { apiKey: KEY_FI });
        const hd3 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-fi' } }, { tileFactory: factory });
        assert.ok(made.length === 1 && made[0].url.endsWith('/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key={dmkey}') && made[0].opts.dmkey === encodeURIComponent(KEY_FI) && made[0].opts.maxNativeZoom === 16, JSON.stringify(made[0]));
        assert.ok(!made[0].url.includes('fi/test'), 'the key is not in the template');
        hd3.finalize();
        // Denmark's own grid (UTM 32N) is offered; Finland's ETRS-TM35FIN is not, so a Finnish plan map gets no orthophoto.
        made.length = 0;
        const hd4 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-dk', crs: 25832 } }, { tileFactory: factory });
        assert.ok(made.length === 1 && made[0].opts.version === '1.1.1' && made[0].opts.apikey === KEY_DK, 'Denmark in UTM 32N');
        hd4.finalize();
        const hd5 = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-fi', crs: 3067 } }, { tileFactory: factory });
        assert.ok(hd5.info.basemapProjection && made.length === 1, 'no Finnish orthophoto in ETRS-TM35FIN');
        hd5.finalize();
      });
      // A keyless orthophoto is referenced in published HTML with its attribution.
      const html = await leaflet.htmlFor('m2', { kind: 'map', map: { layers: [], basemap: 'ortho-is' } });
      assert.ok(/L\.tileLayer\.wms\("https:\/\/gis\.natt\.is\/mapcache\/web-mercator\/wms"/.test(html) && html.includes('Náttúrufræðistofnun'), 'Iceland in published HTML');
    } finally {
      await secrets.forget('basemap:ortho-dk'); await secrets.forget('basemap:ortho-fi');
      el.remove();
    }
    return 'ok';
  }, 30000);

  test('orthophoto: start never asks: the choices are read without the net, follow the grid and the place, and a map without a background map asks nothing', async (assert) => {
    const choice = D.require('ui/viz/basemap-choice');
    const el = host();
    try {
      await withConsent(() => { throw new Error('the consent must not be asked'); }, async (asked) => {
        const values = async (where) => (await choice.options(where)).map((o) => o.value);
        assert.deepEqual(await values(), ['ortho-dk', 'ortho-fi', 'ortho-is'], 'all in Web Mercator');
        assert.deepEqual(await values({ grid: 3057 }), ['ortho-is'], 'ISN93');
        assert.deepEqual(await values({ grid: 25832 }), ['ortho-dk'], 'UTM 32N');
        assert.deepEqual(await values({ grid: 3006 }), [], 'none in SWEREF 99 TM');
        assert.deepEqual(await values({ box: { minX: 12.5, minY: 55.6, maxX: 12.6, maxY: 55.7 } }), ['ortho-dk'], 'a place in Copenhagen');
        assert.deepEqual(await values({ box: { minX: 18.0, minY: 59.3, maxX: 18.1, maxY: 59.4 } }), [], 'none in Stockholm');
        const labels = (await choice.options()).map((o) => o.label);
        assert.ok(labels.includes(t('map.basemap.ortho-is')), labels.join(', '));
        assert.equal(await choice.ensure('ortho-is'), true, 'a keyless orthophoto is ready without a dialog');
        assert.equal(await choice.ensure('osm'), true, 'other background maps pass');
        const hd = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'none' } }, { tileFactory: () => { throw new Error('no tiles'); } });
        assert.ok(!asked.length && !hd.info.basemapDenied, 'nothing asked');
        hd.finalize();
      });
      // The labels in all seven languages.
      const before = i18n.language();
      try {
        for (const code of i18n.LANGUAGES.map((l) => l.code)) {
          await i18n.loadLanguage(code); i18n.setLanguage(code, { persist: false });
          for (const key of ['map.basemap.ortho-dk', 'map.basemap.ortho-fi', 'map.basemap.ortho-is', 'map.site', 'map.site.ortho.none', 'map.basemap.key.help']) assert.ok(t(key) !== key, code + ': ' + key);
        }
      } finally { i18n.setLanguage(before, { persist: false }); }
    } finally { el.remove(); }
    return 'ok';
  }, 30000);

  test('orthophoto: the site step of a new building shows the footprint on a map and offers the orthophoto that covers it; choosing it asks the consent for its host', async (assert) => {
    const model = await datasets.create({ name: 'Ny byggnad (prov)', columns: [{ name: 'id', type: 'integer' }], rows: [[1]] });
    created.push(model.id);
    const iceland = await footprint('Tomt Egilsstaðir', -14.4035, 65.2653);
    const sweden = await footprint('Tomt Stockholm', 18.0686, 59.3293);
    const made = [];
    const panel = D.require('ui/bearbeta/ai-panel').create({ shell: { log() {} } }, { datasetId: model.id, mode: 'build', tileFactory: (url, opts) => { made.push({ url, opts }); return { addTo: () => {} }; } });
    document.body.appendChild(panel.el);
    try {
      await withConsent({ allow: true, remember: false }, async (asked) => {
        await waitFor(() => panel.state.tables.some((d) => d.id === iceland.id), 5000, 'the datasets');
        assert.ok(!panel.el.querySelector('[data-site-map]'), 'no map before a dataset is chosen');
        panel.state.factsFrom = iceland.id;
        panel.setMode('build');
        const details = /** @type {HTMLDetailsElement} */ (await waitFor(() => panel.el.querySelector('[data-site-map]'), 3000, 'the site map'));
        details.open = true;
        await waitFor(() => panel.site.handle && panel.site.state.orthos.length, 8000, 'the map and its choices');
        const sel = /** @type {any} */ (await waitFor(() => panel.el.querySelector('[data-site-map-basemap]'), 3000, 'the choice'));
        assert.deepEqual(sel.options.map((o) => o.value), ['none', 'osm', 'ortho-is'], 'the orthophoto that covers the place');
        assert.ok(!asked.length && !made.length, 'opening the map asks nothing and fetches nothing');
        assert.ok(panel.site.handle.map.getZoom() >= 17, 'close enough to see the house: zoom ' + panel.site.handle.map.getZoom());
        assert.equal(await panel.site.choose('ortho-is'), true);
        assert.ok(asked.length === 1 && asked[0].purpose === 'basemaps' && asked[0].host === 'gis.natt.is', JSON.stringify(asked));
        assert.ok(made.length === 1 && made[0].opts.layers === 'grunnkort-loftmynd', 'the orthophoto under the footprint');
        // Drawing the panel again keeps the same map.
        const kept = panel.site.handle;
        panel.setMode('build');
        assert.ok(panel.el.querySelector('[data-site-map]') === details && panel.site.handle === kept, 'the map survives the panel\'s drawing');
        // A place in Sweden: no open orthophoto, and the note says why.
        panel.state.factsFrom = sweden.id;
        panel.setMode('build');
        await waitFor(() => panel.site.state.datasetId === sweden.id && panel.site.handle && panel.site.handle !== kept && /\S/.test(panel.el.querySelector('[data-site-map-note]').textContent), 8000, 'the Swedish place');
        assert.deepEqual(/** @type {any} */ (panel.el.querySelector('[data-site-map-basemap]')).options.map((o) => o.value), ['none', 'osm'], 'no orthophoto in Stockholm');
        assert.ok(panel.el.querySelector('[data-site-map-note]').textContent.includes(t('map.site.ortho.none')), 'the note');
      });
    } finally { panel.destroy(); panel.el.remove(); }
    return 'ok';
  }, 30000);

  test('orthophoto: the base-layer choice in Bearbeta\'s map and in a map view in Visualisera lists the orthophotos', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let chartId = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const place = await footprint('Ortofotoprov', 12.57, 55.68);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === place.id), 3000, 'dataset in store');
      const values = (sel) => (sel && sel.options ? sel.options.map((o) => o.value) : []);
      shell.activate('bearbeta');
      shell.store.set({ selectedId: place.id });
      const sel = await waitFor(() => root.querySelector('.dm-center [data-map-basemap]'), 8000, 'the choice in Bearbeta');
      assert.ok(['none', 'osm', 'ortho-dk', 'ortho-fi', 'ortho-is'].every((v) => values(sel).includes(v)), 'Bearbeta: ' + values(sel).join(', '));
      assert.equal(/** @type {any} */ (sel).value, 'none', 'no background map until one is chosen');
      const chart = charts.create('map', place, 'Ortofotovy');
      chart.map = leaflet.defaultMap(await datasets.columns(place.id), place);
      chartId = (await charts.save(chart)).id;
      shell.store.set({ openChartId: chartId });
      shell.activate('visualisera');
      const side = await waitFor(() => { const s = root.querySelector('[data-map-basemap]'); return s && values(s).includes('ortho-is') ? s : null; }, 8000, 'the choice in Visualisera');
      assert.deepEqual(values(side), ['none', 'osm', 'ortho-dk', 'ortho-fi', 'ortho-is', 'custom', 'wms'], 'Visualisera: the orthophotos after OpenStreetMap');
      return 'ok';
    } finally {
      if (chartId) await charts.remove(chartId).catch(() => {});
      root.remove();
    }
  }, 40000);

  test('orthophoto: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
