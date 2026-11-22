// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the kind raster on maps and in the modes (decision B-64): the preview in the tile pane above the background and under
 * the features, at its place, with its attribution escaped and its opacity live; the fit, no raster in a grid of its own or below
 * BIM och GIS, and saved map views that keep the layer; Bearbeta's own map with the facts and the opacity, a hit in Söka that opens
 * its file, Visualisera's raster layers and suggestion, Hantera's picture and facts, Kontrollera's table, Mobil's pictures with the
 * attribution, and Inhämta's facts, picture and warning before an import without a column step.
 * Nothing here touches the net: the rasters come from tests/fixtures/geotiff, the consent asker is a stub, the background maps are
 * stub grid layers, and nothing is fetched.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const charts = D.require('viz/charts');
  const leaflet = D.require('viz/leaflet');
  const consent = D.require('platform/consent');
  const tier = D.require('platform/tier');
  const kinds = D.require('data/kinds');
  const fixture = D.require('tests/fixtures/geotiff');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const press = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();
  function host(width = 800, height = 500) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute; left:-10000px; top:0; width:${width}px; height:${height}px;`;
    document.body.appendChild(el);
    return el;
  }
  /** A raster dataset from the fixture, removed at the end of the suite. */
  async function raster(options) {
    const meta = await fixture.rasterDataset(options);
    created.push(meta.id);
    return meta;
  }
  const LICENSE = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
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
    consent.setAsker(async (purpose, info) => { asked.push(Object.assign({ purpose }, info)); return answer; });
    try { return await fn(asked); } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (before !== null) localStorage.setItem(key, before);
    }
  }
  /** Run with fetch spied: every call is noted and refused, so that a test can say that nothing was fetched. */
  async function noFetch(fn) {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = /** @type {any} */ ((input) => { calls.push(String(input && input.url ? input.url : input)); return Promise.reject(new Error('nothing may be fetched here: ' + input)); });
    try { return await fn(calls); } finally { globalThis.fetch = real; }
  }
  /** The app in a hidden root, as the other mode tests start it. */
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }
  const buttonIn = (el, text) => Array.from(el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);

  test('raster map: the preview lies in the tile pane above the background and under the features, at its place, with its attribution escaped and its opacity live, and nothing is fetched', async (assert) => {
    const L = await leaflet.ensure();
    const bounds = [[59.335, 18.05], [59.325, 18.07]];
    const meta = await raster({ name: 'Rasterkarta', files: [{ name: 'ruta.tif', bounds, width: 300, height: 200, color: '#3a6ea5' }], attribution: '<img src=x onerror="globalThis.__dmRasterXss=1"> Flygbild', license: LICENSE });
    const chart = { kind: 'map', name: 'Rasterkarta', map: leaflet.defaultMap(await datasets.columns(meta.id), meta) };
    assert.deepEqual(chart.map.layers.map((l) => l.kind), ['raster', 'dataset'], 'the pictures, and the outlines of the files above them');
    const outline = chart.map.layers[1];
    assert.ok(outline.geometry === 'geometri' && outline.label === 'fil' && outline.style.fillOpacity === 0 && outline.style.weight === 1, 'the outlines unfilled and named by file: ' + JSON.stringify(outline));
    const el = host();
    try {
      await withConsent({ allow: true, remember: false }, (asked) => noFetch(async (calls) => {
        // Without a background map nothing is asked or fetched: the pictures are in the dataset's own file.
        const hd = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('no tiles without a background map'); } });
        assert.equal(asked.length, 0, 'no consent asked for the raster');
        assert.equal(hd.info.rasters, 1, 'one picture drawn');
        const img = /** @type {HTMLImageElement} */ (el.querySelector('.leaflet-tile-pane > img.dm-raster-image'));
        assert.ok(img && img.src.startsWith('blob:') && img.alt === 'ruta.tif', 'the preview from the dataset\'s own file, in the tile pane');
        await waitFor(() => img.naturalWidth > 0, 3000, 'the preview decoded');
        assert.ok(hd.rasters[0].images[0].getBounds().equals(L.latLngBounds(bounds[0], bounds[1])), 'at the place its preview names');
        const nw = hd.map.latLngToLayerPoint(bounds[0]); const se = hd.map.latLngToLayerPoint(bounds[1]);
        assert.ok(Math.abs(parseFloat(img.style.width) - (se.x - nw.x)) < 1 && Math.abs(parseFloat(img.style.height) - (se.y - nw.y)) < 1, `as large as its place on the map: ${img.style.width} × ${img.style.height}`);
        assert.ok(hd.info.rows === 1 && el.querySelector('.leaflet-overlay-pane canvas'), 'the outline of the file is a feature over it');
        hd.finalize();
        // Over a background map (a stub grid layer, z-index 1 in the same pane) the picture lies above it, under the features.
        chart.map.basemap = 'osm';
        const hd2 = await leaflet.render(el, chart, { tileFactory: () => L.gridLayer() });
        assert.ok(asked.length === 1 && asked[0].purpose === 'basemaps' && asked[0].host === 'tile.openstreetmap.org', 'asked for the background map only: ' + JSON.stringify(asked));
        const pane = /** @type {HTMLElement} */ (el.querySelector('.leaflet-tile-pane'));
        const grid = /** @type {HTMLElement} */ (pane.querySelector(':scope > .leaflet-layer'));
        const picture = /** @type {HTMLElement} */ (pane.querySelector(':scope > img.dm-raster-image'));
        assert.ok(grid && picture, 'the background and the raster share the tile pane');
        assert.ok(Number(picture.style.zIndex) >= 2 && Number(picture.style.zIndex) > Number(grid.style.zIndex || 1), `the raster above the background (${picture.style.zIndex} over ${grid.style.zIndex})`);
        const z = (sel) => Number(getComputedStyle(/** @type {Element} */ (el.querySelector(sel))).zIndex);
        await waitFor(() => z('.leaflet-overlay-pane') > z('.leaflet-tile-pane'), 3000, 'the features above the tile pane');
        // The attribution is the file's text as text, with the licence linked.
        const credit = /** @type {HTMLElement} */ (el.querySelector('.leaflet-control-attribution'));
        assert.ok(credit.textContent.includes('<img src=x onerror="globalThis.__dmRasterXss=1"> Flygbild'), 'the text shown as text: ' + credit.textContent);
        assert.ok(!credit.querySelector('img') && !(/** @type {any} */ (globalThis)).__dmRasterXss, 'no element made from it');
        const link = credit.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]');
        assert.ok(link && link.textContent === 'CC BY 4.0', 'the licence linked');
        // The opacity changes at once, without drawing the map again.
        assert.equal(hd2.setRasterOpacity(chart.map.layers[0].id, 0.35), 1, 'one picture changed');
        assert.equal(picture.style.opacity, '0.35');
        assert.equal(hd2.setRasterOpacity('another', 0.2), 0, 'another layer\'s pictures are not touched');
        hd2.finalize();
        // The definition's opacity is the one drawn.
        chart.map.basemap = 'none'; chart.map.layers[0].style.opacity = 0.6;
        const hd3 = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('no tiles'); } });
        assert.equal(/** @type {HTMLElement} */ (el.querySelector('img.dm-raster-image')).style.opacity, '0.6', 'drawn with its own opacity');
        hd3.finalize();
        assert.deepEqual(calls, [], 'nothing fetched');
      }));
      // A licence whose address is not https is named, not linked; everything is escaped.
      assert.equal(leaflet.rasterAttribution({ attribution: 'A & <b>B</b>', license: { name: 'Egen "licens"', url: 'javascript:alert(1)' } }), 'A &amp; &lt;b&gt;B&lt;/b&gt; (Egen &quot;licens&quot;)');
      assert.equal(leaflet.rasterAttribution({ attribution: null, license: LICENSE }), '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>');
    } finally { el.remove(); }
    return 'ok';
  }, 40000);

  test('raster map: the map fits a raster without features, draws none in a grid of its own or below BIM och GIS, and a saved map view keeps the raster layer by name', async (assert) => {
    const L = await leaflet.ensure();
    const bounds = [[63.835, 20.25], [63.825, 20.27]];
    // A name of its own, so that the saved map view can only find this raster by it.
    const meta = await raster({ name: 'Rasterpassning ' + Date.now().toString(36), files: [{ name: 'umea.tif', bounds }], attribution: 'Prov' });
    const chart = charts.create('map', meta, 'Rasterpassning');
    chart.map = leaflet.defaultMap([], null);
    chart.map.layers.push(leaflet.rasterLayer(meta));
    const el = host();
    let saved = null;
    const noTiles = { tileFactory: () => { throw new Error('no tiles'); } };
    try {
      await noFetch(async (calls) => {
        const hd = await leaflet.render(el, chart, noTiles);
        assert.ok(hd.info.rows === 0 && hd.info.rasters === 1, 'no features, one picture');
        const box = L.latLngBounds(bounds[0], bounds[1]);
        assert.ok(hd.map.getBounds().contains(box) && hd.map.getZoom() >= 12, `fitted to the raster: zoom ${hd.map.getZoom()}, ${hd.map.getBounds().toBBoxString()}`);
        hd.finalize();
        // A map in a grid of its own (a plan's) draws no raster, which is in Web Mercator, and says so.
        const inGrid = await leaflet.render(el, Object.assign({}, chart, { map: Object.assign({}, chart.map, { crs: 3006 }) }), noTiles);
        assert.ok(inGrid.info.rasterProjection && !inGrid.info.rasters && !el.querySelector('img.dm-raster-image'), 'none in SWEREF 99 TM\'s grid');
        inGrid.finalize();
        // Below BIM och GIS a raster is its table: the map draws none of its pictures.
        await tier.set(1);
        try {
          const low = await leaflet.render(el, chart, noTiles);
          assert.ok(!low.info.rasters && !el.querySelector('img.dm-raster-image'), 'none in Dokument');
          low.finalize();
        } finally { await tier.set(3); }
        // Exports and published HTML leave the raster out (tonight's scope).
        const svg = await (await leaflet.toBlob(chart, 'svg', { width: 400, height: 300 })).text();
        assert.ok(/<svg/.test(svg) && !/<image/.test(svg), 'an SVG without the picture');
        const html = await leaflet.htmlFor('rm1', chart);
        assert.ok(!html.includes('blob:') && !html.includes('dm-raster-image') && !/imageOverlay/.test(html), 'published HTML without the picture');
        // A saved map view moved to another workspace finds its raster by name, as a table's layer does.
        const moved = JSON.parse(charts.exportJson(chart));
        moved.map.layers[0].datasetId = 'ds_elsewhere';
        saved = await charts.importJson(JSON.stringify(moved));
        const layer = saved.map.layers[0];
        assert.ok(layer.kind === 'raster' && layer.datasetId === meta.id && layer.datasetName === meta.name, 'the raster layer kept and matched: ' + JSON.stringify(layer));
        const again = await leaflet.render(el, saved, noTiles);
        assert.equal(again.info.rasters, 1, 'and it draws');
        again.finalize();
        assert.deepEqual(calls, [], 'nothing fetched');
      });
    } finally {
      if (saved) await charts.remove(saved.id).catch(() => {});
      el.remove();
    }
    return 'ok';
  }, 40000);

  test('raster map: Bearbeta opens a raster on its own map with its facts and opacity and no button back to itself, and a hit in Söka opens its file', async (assert) => {
    const north = [[60.02, 17.0], [60.0, 17.04]]; const south = [[59.52, 17.0], [59.5, 17.04]];
    const meta = await raster({ name: 'Rasterbearbeta', files: [{ name: 'norr.tif', bounds: north }, { name: 'soder.tif', bounds: south, color: '#a55b3a' }, { name: 'okand.tif' }], attribution: 'Provbild' });
    return withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'the raster in the store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      const view = await waitFor(() => root.querySelector('.dm-center .dm-map-view.leaflet-container'), 8000, 'the raster\'s own map');
      await waitFor(() => view.querySelectorAll('.leaflet-tile-pane img.dm-raster-image').length === 2, 8000, 'the two files with a place');
      const head = /** @type {HTMLElement} */ (root.querySelector('.dm-center .dm-page-head'));
      assert.equal(head.querySelector('dm-badge').textContent, kinds.summary(meta), 'counted in files');
      const labels = Array.from(head.querySelectorAll('dm-button')).map((b) => b.textContent.trim());
      assert.ok(labels.includes(t('bearbeta.view.table')), 'the table one button away');
      // Spara ortofotot stands beside Hämta ortofoto för vyn and shows with it, when Lantmäteriet's orthophoto is the background.
      const load = /** @type {HTMLElement} */ (head.querySelector('[data-map-ortho-load]')); const save = /** @type {HTMLElement} */ (head.querySelector('[data-ortho-save]'));
      assert.ok(load && save && load.nextElementSibling === save && load.hidden && save.hidden, 'the save button waits beside the load button');
      assert.ok(!labels.includes(t('bearbeta.view.map')) && !labels.some((l) => l.startsWith('bearbeta.view')), 'no button back to itself: ' + labels.join(' | '));
      const facts = /** @type {HTMLElement} */ (await waitFor(() => root.querySelector('.dm-right [data-raster-facts]'), 5000, 'the facts'));
      assert.ok(facts.textContent.includes(t('raster.field.crs')) && facts.textContent.includes(t('raster.field.attribution')) && facts.textContent.includes('Provbild'), facts.textContent);
      const unplaced = root.querySelector('.dm-right [data-raster-unplaced]');
      assert.ok(unplaced && unplaced.textContent === t('raster.unplaced', { n: '1' }), 'the file without a place is said: ' + (unplaced && unplaced.textContent));
      const field = /** @type {HTMLInputElement} */ (root.querySelector('.dm-right [data-raster-opacity] input'));
      assert.equal(field.value, '1', 'opaque at first');
      field.value = '0.5';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      assert.ok(Array.from(view.querySelectorAll('img.dm-raster-image')).every((img) => /** @type {HTMLElement} */ (img).style.opacity === '0.5'), 'the pictures follow at once');
      // Below the facts, the table: Bearbeta's own button leads there and back to the map.
      press(buttonIn(head, t('bearbeta.view.table')));
      await waitFor(() => root.querySelectorAll('.dm-center dm-table .dm-tr').length === 3, 8000, 'the table of three files');
      const back = await waitFor(() => buttonIn(root.querySelector('.dm-center .dm-page-head'), t('bearbeta.view.map')), 5000, 'the button back to the map');
      press(back);
      await waitFor(() => root.querySelector('.dm-center .dm-map-view.leaflet-container img.dm-raster-image'), 8000, 'the map again');
      // A hit in Söka names the file: Bearbeta opens the raster's map on it.
      shell.activate('soka');
      shell.store.set({ selectedId: meta.id, openRaster: { datasetId: meta.id, name: 'soder.tif' } });
      shell.activate('bearbeta');
      await waitFor(() => !shell.store.get().openRaster, 8000, 'the hit taken');
      const map = await waitFor(() => { const m = /** @type {any} */ (root.querySelector('.dm-center .dm-map-view')); return m && m._dmMap; }, 5000, 'the map');
      await waitFor(() => { const c = map.getCenter(); return c.lat > 59.5 && c.lat < 59.52 && c.lng > 17 && c.lng < 17.04 && map.getZoom() >= 12; }, 6000, 'the map on soder.tif');
      return 'ok';
    });
  }, 90000);

  test('raster map: Visualisera adds a raster layer from the dataset list, its card sets the opacity, and the suggestion is its own map', async (assert) => {
    const panel = D.require('ui/viz/map-panel');
    const suggest = D.require('viz/suggest');
    const meta = await raster({ name: 'Rastervisualisera', files: [{ name: 'vy.tif', bounds: [[57.71, 11.96], [57.7, 11.98]] }], attribution: 'Prov' });
    const mount = document.createElement('div');
    mount.style.cssText = 'position:absolute; left:-10000px; width:1000px; height:800px;';
    document.body.appendChild(mount);
    const chart = { kind: 'map', name: 'Rasterlager', map: leaflet.defaultMap([], null) };
    const made = panel.create({ chart, columns: [], onChange() {}, log() {}, onInspect() {} });
    mount.appendChild(made.el);
    try {
      const pick = /** @type {any} */ (await waitFor(() => Array.from(mount.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === t('map.add.dataset') && /** @type {any} */ (s).options.some((o) => o.value === meta.id)), 5000, 'the raster among the datasets'));
      pick.value = meta.id;
      press(mount.querySelector('[data-map-add-dataset]'));
      const card = /** @type {HTMLElement} */ (await waitFor(() => mount.querySelector('[data-map-layer-raster]'), 3000, 'the raster\'s card'));
      assert.ok(chart.map.layers.length === 1 && chart.map.layers[0].kind === 'raster' && chart.map.layers[0].datasetId === meta.id, JSON.stringify(chart.map.layers));
      assert.ok(card.textContent.includes(t('map.layer.raster.note')), 'what the raster is and where it goes');
      const img = /** @type {HTMLElement} */ (await waitFor(() => mount.querySelector('.dm-map-preview .leaflet-tile-pane img.dm-raster-image'), 8000, 'the picture on the live map'));
      const opacity = /** @type {any} */ (Array.from(card.querySelectorAll('dm-input')).find((i) => i.getAttribute('label') === t('map.style.opacity')));
      const field = opacity.querySelector('input');
      assert.equal(field.value, '1', 'opaque at first');
      field.value = '0.4';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(chart.map.layers[0].style.opacity, 0.4, 'kept in the map view');
      assert.ok(img.isConnected && img.style.opacity === '0.4', 'the live map follows without being drawn again');
    } finally { made.destroy(); mount.remove(); }
    // The suggestion for a raster is its own map: its pictures and the outlines of its files.
    const list = await suggest.forDataset(await datasets.get(meta.id));
    assert.deepEqual(list.map((s) => s.key), ['viz.suggest.map'], 'one suggestion');
    assert.deepEqual(list[0].chart.map.layers.map((l) => l.kind), ['raster', 'dataset'], 'the pictures and the outlines');
    const svg = await suggest.preview(list[0].chart);
    assert.ok(svg && /<path/.test(svg) && !/<image/.test(svg), 'its picture to choose by is the outlines');
    // A saved map view of the raster that has no layers yet opens in Visualisera with the raster's own layers.
    const record = await charts.save(charts.create('map', meta, 'Rasterkarta i Visualisera'));
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'the raster in the store');
        shell.store.set({ openChartId: record.id });
        shell.activate('visualisera');
        await waitFor(() => root.querySelector('[data-map-layer-raster]'), 8000, 'the raster layer in the map view');
        await waitFor(() => root.querySelector('.dm-map-preview .leaflet-tile-pane img.dm-raster-image'), 8000, 'the picture in the map view');
      });
    } finally { await charts.remove(record.id).catch(() => {}); }
    return 'ok';
  }, 90000);

  test('raster map: Hantera shows the picture, the facts and the open button, Kontrollera checks the table, and Mobil shows the pictures with the attribution', async (assert) => {
    const meta = await raster({ name: 'Rasterhantera', files: [{ name: 'a.tif', bounds: [[59.86, 17.6], [59.85, 17.62]] }, { name: 'b.tif', bounds: [[59.86, 17.62], [59.85, 17.64]], color: '#7a5ba5' }], attribution: 'Ortofoto © Prov', license: LICENSE });
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 5000, 'the raster in the store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('hantera');
      const picture = /** @type {HTMLImageElement} */ (await waitFor(() => root.querySelector('.dm-center .dm-ds-picture img.dm-sketch'), 8000, 'the picture'));
      assert.ok(picture.alt === t('datasets.picture.raster') && picture.src.startsWith('blob:'), 'the first file at a small size');
      await waitFor(() => picture.naturalWidth > 0 && picture.naturalWidth <= 320, 3000, 'the thumbnail decoded');
      const kv = /** @type {HTMLElement} */ (root.querySelector('.dm-center .dm-card dm-kv'));
      for (const text of [t('datasets.kind.raster'), t('raster.field.crs'), t('raster.field.files'), 'Ortofoto © Prov (CC BY 4.0)', t('import.source.files', { n: 2, format: t('import.format.raster.short') })]) assert.ok(kv.textContent.includes(text), 'the overview says ' + text + ': ' + kv.textContent);
      const head = /** @type {HTMLElement} */ (root.querySelector('.dm-center .dm-page-head'));
      assert.ok(Array.from(head.querySelectorAll('dm-badge')).map((b) => b.textContent).join(' ').includes(t('raster.files.n', { n: '2' })), 'counted in files');
      // Below BIM och GIS the picture and the facts stay, the map goes, and the notice says where it went.
      await tier.set(1);
      try {
        await waitFor(() => root.querySelector('.dm-center [data-tier-hidden="kind.raster"]'), 8000, 'the notice');
        await waitFor(() => root.querySelector('.dm-center .dm-ds-picture img.dm-sketch'), 8000, 'the picture in Dokument');
        assert.ok(!buttonIn(root.querySelector('.dm-center .dm-page-head'), t('hantera.view.raster')), 'no map in Dokument');
      } finally { await tier.set(3); }
      const open = await waitFor(() => buttonIn(root.querySelector('.dm-center .dm-page-head'), t('hantera.view.raster')), 8000, 'the open button');
      press(open);
      await waitFor(() => shell.store.get().mode === 'bearbeta' && root.querySelector('.dm-center .dm-map-view img.dm-raster-image'), 8000, 'the raster\'s map in Bearbeta');
      // Kontrollera checks the table of files as a table.
      shell.activate('kontrollera');
      const summary = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-summary]'), 8000, 'the check of the table');
      assert.equal(summary.getAttribute('data-kontrollera-rows'), '2', 'two files');
      assert.ok(!root.querySelector('.dm-center [data-kontrollera-none]'), 'not a kind without checks');
    });
    // The phone: the pictures from the bundle's own file, with the attribution and the licence.
    const workspace = D.require('data/workspace');
    const mobile = D.require('mobile/app');
    const views = D.require('mobile/kind-views');
    const bundle = await workspace.bundle({ name: 'Rastermobil', datasetIds: [meta.id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false } });
    const entries = await D.require('platform/storage/zip').readZip(bundle.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const entry = manifest.datasets.find((d) => d.name === meta.name);
    assert.ok(entry && entry.kind === 'raster', 'the bundle says what it is');
    const view = await mobile.openDataset(bundle.blob, entry.file);
    try {
      view.data = await view.rows(0, 50);
      assert.equal(view.kind, 'raster');
      const el = /** @type {HTMLElement} */ (await views.render(view));
      const pictures = /** @type {HTMLImageElement[]} */ (Array.from(el.querySelectorAll('.dm-m-pictures img')));
      assert.ok(pictures.length === 2 && pictures.every((img) => img.src.startsWith('blob:')), 'the two thumbnails');
      assert.deepEqual(pictures.map((img) => img.getAttribute('alt')), ['a.tif', 'b.tif'], 'named by file');
      document.body.appendChild(el);
      try { await waitFor(() => pictures.every((img) => img.naturalWidth > 0), 3000, 'the thumbnails decoded'); } finally { el.remove(); }
      const credit = el.querySelector('[data-m-raster-credit]');
      assert.equal(credit && credit.textContent, 'Ortofoto © Prov (CC BY 4.0)', 'the attribution with the licence');
    } finally { view.close(); }
    return 'ok';
  }, 90000);

  test('raster map: Inhämta shows a GeoTIFF\'s facts and picture, warns about a system it cannot convert, and imports without a column step', async (assert) => {
    // Gauss-Krüger zone 3 (EPSG:31467): read, but with no place on the map, which Inhämta says before the import.
    const file = fixture.file({ width: 48, height: 32, geo: { res: 10, east: 3500000, north: 5800000, epsg: 31467 }, copyright: 'Flygbild © Prov' }, 'gauss-kruger-inhamta.tif');
    const name = 'gauss kruger inhamta';
    return withApp(async (shell, root) => {
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [file] }, bubbles: true }));
      const card = /** @type {HTMLElement} */ (await waitFor(() => root.querySelector('.dm-center [data-import-raster]'), 15000, 'the raster\'s facts'));
      const center = /** @type {HTMLElement} */ (root.querySelector('.dm-center'));
      for (const text of [t('datasets.kind.raster'), t('raster.field.crs'), 'EPSG:31467', t('raster.field.size'), '48 × 32', t('raster.field.bands'), '3 · uint8', t('raster.kept.original'), 'Flygbild © Prov']) {
        assert.ok(card.textContent.includes(text), 'the facts say ' + text + ': ' + card.textContent);
      }
      // The browsers cannot draw a TIFF file: the picture is the one the raster worker made of it.
      const picture = /** @type {HTMLImageElement} */ (await waitFor(() => center.querySelector('.dm-photos.dm-import-photos > img.dm-import-photo[data-import-raster-picture]'), 8000, 'the picture'));
      assert.ok(picture.src.startsWith('data:image/') && picture.alt === file.name, 'a picture of the file, named by it');
      await waitFor(() => picture.naturalWidth > 0, 3000, 'the picture decoded');
      const warning = center.querySelector('[data-import-crs-unknown]');
      assert.ok(warning && warning.textContent === t('import.crs.unknown', { crs: 'EPSG:31467' }), 'the system it cannot convert is said: ' + (warning && warning.textContent));
      const sense = center.querySelector('.dm-sense');
      assert.ok(sense && sense.textContent.includes(t('import.sense.raster', { crs: 'EPSG:31467' })), 'what the file is: ' + (sense && sense.textContent));
      assert.ok(center.textContent.includes(t('import.collection.hint.raster')), 'what each file becomes');
      // No column step: the name and Import.
      assert.ok(!buttonIn(center, t('common.next')), 'no column step');
      press(await waitFor(() => buttonIn(center, t('common.import')), 3000, 'the import button'));
      const done = /** @type {HTMLElement} */ (await waitFor(() => center.querySelector('.dm-success'), 15000, 'the result'));
      const made = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'raster' && d.name === name), 5000, 'the raster in the workspace');
      created.push(made.id);
      assert.ok(done.textContent.includes(kinds.summary(made)) && buttonIn(done, t('hantera.view.raster')), 'counted in files, with the way on to its map: ' + done.textContent);
      const ds = await datasets.get(made.id);
      assert.ok(ds.raster.files[0].placed === false && ds.raster.files[0].kept === 'original' && ds.raster.attribution === 'Flygbild © Prov', 'kept without a place: ' + JSON.stringify(ds.raster.files[0]));
      return 'ok';
    });
  }, 60000);

  test('raster map: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
