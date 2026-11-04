// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the map view (viz/leaflet with the vendored Leaflet), the Geo tools (analysis/geo with Turf), the QGIS
 * project importer and the views in Bearbeta, Visualisera and Analysera. Nothing here touches the net: background
 * maps are refused by a stubbed consent asker and verified not to be added.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const leaflet = D.require('viz/leaflet');
  const geoAnalysis = D.require('analysis/geo');
  const qgis = D.require('io/importers/qgis');
  const charts = D.require('viz/charts');
  const consent = D.require('platform/consent');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const square = (lon, lat, d) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]] });
  function host(width = 800, height = 500) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute; left:-10000px; top:0; width:${width}px; height:${height}px;`;
    document.body.appendChild(el);
    return el;
  }
  /** The vector layer must really show on the page: as wide on screen as its own width, and with painted pixels. */
  async function assertLayerVisible(assert, canvas, label) {
    const width = canvas.getBoundingClientRect().width;
    assert.ok(Math.abs(width - parseFloat(canvas.style.width)) < 1, `${label}: the vector layer is ${Math.round(width)} px wide on screen, its own width is ${canvas.style.width}`);
    const painted = () => { const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true; return false; };
    await waitFor(painted, 3000, `${label}: painted features`);
  }
  async function makeAreas() {
    const rows = [['Norr', 'A', 120, JSON.stringify(square(17.0, 60.0, 0.5))], ['Söder', 'B', 80, JSON.stringify(square(17.0, 59.4, 0.5))], ['Öst', 'A', 45, JSON.stringify(square(17.6, 59.7, 0.5))]];
    const meta = await datasets.create({ name: 'Testområden', columns: [{ name: 'namn', type: 'text' }, { name: 'klass', type: 'text' }, { name: 'varde', type: 'integer' }, { name: 'geometry', type: 'text' }], rows });
    created.push(meta.id);
    return meta;
  }
  async function makePoints() {
    const rows = [['P1', 17.1, 60.1, 10], ['P2', 17.2, 60.2, 20], ['P3', 17.1, 59.5, 5], ['P4', 18.5, 58.5, 1]];
    const meta = await datasets.create({ name: 'Testpunkter', columns: [{ name: 'id', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }, { name: 'antal', type: 'integer' }], rows });
    created.push(meta.id);
    return meta;
  }

  test('map: Leaflet loads from the vendored files and draws polygons by category and points over a boundary layer, with clicks and a legend', async (assert) => {
    const areas = await makeAreas(); const points = await makePoints();
    const areaCols = await datasets.columns(areas.id); const pointCols = await datasets.columns(points.id);
    assert.equal(leaflet.geometryColumn(areaCols), 'geometry'); assert.deepEqual(leaflet.coordinateColumns(pointCols), { lon: 'lon', lat: 'lat' });
    assert.ok(leaflet.mappable(areaCols) && leaflet.mappable(pointCols) && !leaflet.mappable([{ name: 'a', type: 'text' }]));
    const chart = charts.create('map', areas, 'Testkarta');
    chart.map = leaflet.defaultMap(areaCols, areas);
    chart.map.layers[0].colorBy = { column: 'klass', mode: 'category' };
    chart.map.layers[0].label = 'namn';
    chart.map.layers.push(Object.assign(leaflet.layerFor(pointCols, points, 1), { name: 'Punkter' }));
    chart.map.layers.unshift(leaflet.boundaryLayer('lan'));
    const el = host();
    const selected = [];
    try {
      const L = await leaflet.ensure();
      assert.ok(L && L.version && L.version.startsWith('1.9'), 'Leaflet ' + (L && L.version));
      const hd = await leaflet.render(el, chart, { onSelect: (sel) => selected.push(sel) });
      assert.ok(el.classList.contains('leaflet-container'), 'the element became the map container');
      assert.ok(el.querySelector('.leaflet-overlay-pane canvas'), 'canvas renderer for the vector layers');
      await assertLayerVisible(assert, el.querySelector('.leaflet-overlay-pane canvas'), 'render');
      assert.ok(!el.querySelector('.leaflet-tile-pane img'), 'no tiles without a background map');
      assert.equal(hd.info.rows, 3 + 4 + 21, 'three areas, four points and the 21 counties');
      assert.equal(hd.legend.length, 3);
      const areaLegend = hd.legend.find((l) => l.name === 'Testområden');
      assert.deepEqual(areaLegend.entries.map((e) => e.label), ['A', 'B'], 'categories in order of appearance');
      assert.ok(areaLegend.entries[0].color !== areaLegend.entries[1].color, 'different colours');
      const z = hd.map.getZoom();
      assert.ok(z >= 3 && z <= 14, 'fitted to the layers, zoom ' + z);
      // A click on a feature reports its attributes.
      const group = hd.groups.find((g) => g.layer.name === 'Testområden').group;
      const first = group.getLayers()[0];
      first.fire('click');
      assert.equal(selected.length, 1); assert.equal(selected[0].properties.namn, 'Norr'); assert.equal(selected[0].layer.name, 'Testområden');
      hd.map.setZoom(z + 1, { animate: false });
      assert.deepEqual(hd.view().zoom, z + 1, 'view follows the map');
      hd.finalize();
      assert.ok(!el.querySelector('.leaflet-map-pane'), 'finalize removes the map panes');
    } finally { el.remove(); }
    return 'ok';
  }, 30000);

  test('map: export draws the layers headless to SVG and PNG, with the legend, and htmlFor inlines the features', async (assert) => {
    const areas = await makeAreas();
    const chart = charts.create('map', areas, 'Exportkarta');
    chart.map = leaflet.defaultMap(await datasets.columns(areas.id), areas);
    chart.map.layers[0].colorBy = { column: 'varde', mode: 'graduated', classes: 3 };
    const svg = await (await leaflet.toBlob(chart, 'svg', { width: 600, height: 400 })).text();
    assert.ok(/<svg[^>]*width="600"/.test(svg) && (svg.match(/<path /g) || []).length === 3, 'three polygons as paths');
    assert.ok(/<rect[^>]*rx="4"/.test(svg) && /<text/.test(svg), 'legend box with labels');
    const png = await leaflet.toBlob(chart, 'png', { width: 600, height: 400, scale: 1 });
    assert.ok(png.type === 'image/png' && png.size > 2000, 'png ' + png.size);
    const pdf = await leaflet.toBlob(chart, 'pdf', { width: 600, height: 400 });
    assert.ok(pdf.size > 1000, 'pdf ' + pdf.size);
    const thumb = await leaflet.thumbnail(chart);
    assert.ok(thumb && thumb.startsWith('data:image/png'), 'thumbnail data url');
    const html = await leaflet.htmlFor('m1', chart);
    assert.ok(html.includes('L.map("m1"') && html.includes('"__style"') && (html.match(/"Polygon"/g) || []).length === 3, 'features inline');
    assert.ok(!/tileLayer/.test(html), 'no tile layer without a background map');
    chart.map.basemap = 'osm';
    assert.ok(/tileLayer\("https:\/\/tile\.openstreetmap\.org/.test(await leaflet.htmlFor('m2', chart)), 'OSM tiles referenced when chosen');
    const src = await leaflet.source();
    assert.ok(src.js.length > 100000 && /leaflet-container/.test(src.css), 'library text for publishing');
    return `svg ${svg.length} chars, png ${png.size} bytes`;
  }, 30000);

  test('map: a background map needs consent for the purpose basemaps and is left out when refused', async (assert) => {
    const areas = await makeAreas();
    const chart = charts.create('map', areas, 'Samtyckeskarta');
    chart.map = leaflet.defaultMap(await datasets.columns(areas.id), areas);
    chart.map.basemap = 'osm';
    const asked = [];
    const key = 'dataspatium.consent';
    const before = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('basemaps');
    await consent.set('basemaps', null);
    consent.setAsker(async (purpose, info) => { asked.push({ purpose, host: info.host }); return { allow: false, remember: false }; });
    const el = host();
    try {
      const factory = (url, opts) => { throw new Error('tile layer must not be created: ' + url); };
      const hd = await leaflet.render(el, chart, { tileFactory: factory });
      assert.deepEqual(asked, [{ purpose: 'basemaps', host: 'tile.openstreetmap.org' }], 'asked once for the OSM host');
      assert.ok(hd.info.basemapDenied, 'denied is reported');
      assert.ok(!el.querySelector('.leaflet-tile-pane img'), 'no tiles');
      hd.finalize();
      // With consent the (stubbed) tile layer is created; nothing is fetched because the factory is ours.
      consent.setAsker(async () => ({ allow: true, remember: false }));
      let made = null;
      const hd2 = await leaflet.render(el, chart, { tileFactory: (url, opts) => { made = { url, opts }; return { addTo: () => {} }; } });
      assert.ok(made && made.url.includes('openstreetmap') && /OpenStreetMap/.test(made.opts.attribution), 'tile layer created after consent');
      assert.ok(!hd2.info.basemapDenied);
      hd2.finalize();
      chart.map.basemap = 'none';
      const hd3 = await leaflet.render(el, chart, { tileFactory: factory });
      assert.ok(!hd3.info.basemapDenied, 'no question without a background map');
      hd3.finalize();
    } finally {
      consent.setAsker(null);
      await consent.set('basemaps', prior === 'granted' || prior === 'denied' ? prior : null);
      if (before !== null) localStorage.setItem(key, before);
      el.remove();
    }
    return 'ok';
  }, 30000);

  test('map: 10 000 polygons render in under 5 seconds and pan without errors', async (assert) => {
    const rows = [];
    for (let i = 0; i < 100; i++) for (let j = 0; j < 100; j++) rows.push([i * 100 + j, (i + j) % 7, JSON.stringify(square(11 + i * 0.1, 55 + j * 0.1, 0.09))]);
    const meta = await datasets.create({ name: 'Rutnät', columns: [{ name: 'id', type: 'integer' }, { name: 'klass', type: 'integer' }, { name: 'geometry', type: 'text' }], rows });
    created.push(meta.id);
    const chart = charts.create('map', meta, 'Rutnät');
    chart.map = leaflet.defaultMap(await datasets.columns(meta.id), meta);
    chart.map.layers[0].colorBy = { column: 'klass', mode: 'category' };
    const el = host(900, 700);
    try {
      const t0 = performance.now();
      const hd = await leaflet.render(el, chart, {});
      const ms = performance.now() - t0;
      assert.equal(hd.info.rows, 10000);
      assert.ok(ms < 5000, `rendered in ${Math.round(ms)} ms`);
      const t1 = performance.now();
      for (let k = 0; k < 10; k++) hd.map.panBy([20, 10], { animate: false });
      hd.map.zoomIn(1, { animate: false });
      const pan = performance.now() - t1;
      assert.ok(pan < 3000, `ten pans and a zoom in ${Math.round(pan)} ms`);
      hd.finalize();
      return `render ${Math.round(ms)} ms, pan ${Math.round(pan)} ms`;
    } finally { el.remove(); }
  }, 60000);

  test('geo: measures, points in polygons, nearest, buffer, overlay, dissolve and simplify with Turf', async (assert) => {
    const areas = await makeAreas(); const points = await makePoints();
    await geoAnalysis.ensure();
    assert.ok(globalThis.turf && typeof globalThis.turf.area === 'function', 'turf loaded');
    const A = await geoAnalysis.featuresOfDataset(areas.id); const P = await geoAnalysis.featuresOfDataset(points.id);
    assert.equal(A.features.length, 3); assert.equal(P.features.length, 4); assert.equal(P.features[0].geometry.type, 'Point');
    const m = await geoAnalysis.measure(A);
    const col = (out, name) => out.columns.findIndex((c) => c.name === name);
    const area = m.rows[0][col(m, 'area_km2')];
    assert.ok(area > 1400 && area < 1700, 'half a degree square near 60°N is about 1 550 km²: ' + area);
    assert.ok(Math.abs(m.rows[0][col(m, 'mitt_lon')] - 17.25) < 0.01 && Math.abs(m.rows[0][col(m, 'mitt_lat')] - 60.25) < 0.01, 'centroid');
    assert.equal(m.rows[0][col(m, 'geometri_typ')], 'Polygon');
    const counts = await geoAnalysis.pointsInPolygons(P, A, { mode: 'count', valueColumn: 'antal' });
    assert.deepEqual(counts.rows.map((r) => [r[col(counts, 'namn')], r[col(counts, 'antal_punkter')], r[col(counts, 'summa_antal')]]), [['Norr', 2, 30], ['Söder', 1, 5], ['Öst', 0, 0]]);
    assert.equal(counts.matched, 3, 'P4 lies outside every area');
    const attached = await geoAnalysis.pointsInPolygons(P, A, { mode: 'attach' });
    assert.deepEqual(attached.rows.map((r) => [r[col(attached, 'id')], r[col(attached, 'namn')]]), [['P1', 'Norr'], ['P2', 'Norr'], ['P3', 'Söder'], ['P4', null]]);
    const near = await geoAnalysis.nearest(P, A);
    assert.equal(near.rows[3][col(near, 'narmaste_namn')], 'Söder');
    assert.ok(near.rows[3][col(near, 'avstand_km')] > 100 && near.rows[3][col(near, 'avstand_km')] < 200, 'P4 is 100–200 km from Söder: ' + near.rows[3][col(near, 'avstand_km')]);
    assert.equal(near.rows[0][col(near, 'avstand_km')] < 20, true, 'P1 is inside Norr, close to its centroid');
    const buf = await geoAnalysis.buffer(P, 1000);
    assert.equal(buf.rows.length, 4);
    assert.ok(Math.abs(buf.rows[0][col(buf, 'area_km2')] - Math.PI) < 0.2, 'a 1 km buffer is about 3.14 km²: ' + buf.rows[0][col(buf, 'area_km2')]);
    assert.equal(JSON.parse(buf.rows[0][col(buf, 'geometry')]).type, 'Polygon');
    const shifted = await datasets.create({ name: 'Förskjutna', columns: [{ name: 'zon', type: 'text' }, { name: 'geometry', type: 'text' }], rows: [['Z1', JSON.stringify(square(17.25, 60.25, 0.5))], ['Z2', JSON.stringify(square(20, 65, 0.5))]] });
    created.push(shifted.id);
    const B = await geoAnalysis.featuresOfDataset(shifted.id);
    const inter = await geoAnalysis.overlay(A, B, { op: 'intersect' });
    assert.equal(inter.rows.length, 1, 'one overlapping pair');
    assert.deepEqual([inter.rows[0][col(inter, 'namn')], inter.rows[0][col(inter, 'zon')]], ['Norr', 'Z1']);
    assert.ok(inter.rows[0][col(inter, 'area_km2')] > 300 && inter.rows[0][col(inter, 'area_km2')] < 450, 'a quarter of the square: ' + inter.rows[0][col(inter, 'area_km2')]);
    const diff = await geoAnalysis.overlay(A, B, { op: 'difference' });
    assert.equal(diff.rows.length, 3);
    assert.ok(diff.rows[0][col(diff, 'area_km2')] < area, 'Norr lost a corner');
    const dis = await geoAnalysis.dissolve(A, 'klass');
    assert.deepEqual(dis.rows.map((r) => [r[col(dis, 'klass')], r[col(dis, 'antal')]]), [['A', 2], ['B', 1]]);
    assert.equal(JSON.parse(dis.rows[0][col(dis, 'geometry')]).type, 'MultiPolygon', 'two separate squares stay a multipolygon');
    const all = await geoAnalysis.dissolve(A, null);
    assert.equal(all.rows.length, 1);
    const simp = await geoAnalysis.simplify(A, 1000);
    assert.ok(simp.rows[0][col(simp, 'punkter_efter')] <= simp.rows[0][col(simp, 'punkter_fore')], 'not more points after simplification');
    return `area ${Math.round(area)} km²`;
  }, 60000);

  test('geo: the measures of an API answer have every column once and open as a map', async (assert) => {
    // An API table holds the geometry in `geometri` with `geometri_typ` beside it (api/parsers.geojsonRecords).
    const meta = await datasets.create({ name: 'Svar från API', columns: [{ name: 'namn', type: 'text' }, { name: 'geometri_typ', type: 'text' }, { name: 'geometri', type: 'text' }], rows: [['Norr', 'Polygon', JSON.stringify(square(17.0, 60.0, 0.5))], ['Söder', 'Polygon', JSON.stringify(square(17.0, 59.4, 0.5))]] });
    created.push(meta.id);
    const src = await geoAnalysis.featuresOfDataset(meta.id);
    assert.equal(src.geometryColumn, 'geometri');
    const m = await geoAnalysis.measure(src);
    const names = m.columns.map((c) => c.name);
    assert.ok(!names.includes('geometri'), 'no empty source geometry column: ' + names.join(','));
    assert.equal(names.length, new Set(names).size, 'every column once: ' + names.join(','));
    assert.equal(m.rows[0].length, names.length, 'rows as wide as the columns');
    assert.equal(m.rows[0][names.indexOf('namn')], 'Norr');
    assert.equal(m.rows[0][names.indexOf('geometri_typ')], 'Polygon');
    assert.ok(m.rows[0][names.indexOf('area_km2')] > 1400, 'area: ' + m.rows[0][names.indexOf('area_km2')]);
    // Saved as a dataset the result opens as a map with the same objects.
    const saved = await datasets.create({ name: 'Mått av svaret', columns: m.columns, rows: m.rows });
    created.push(saved.id);
    const cols = await datasets.columns(saved.id);
    assert.equal(leaflet.geometryColumn(cols), 'geometry');
    const prepared = await leaflet.prepare({ kind: 'map', name: saved.name, datasetId: saved.id, map: leaflet.defaultMap(cols, saved), options: {} });
    assert.equal(prepared.rows, 2, 'both objects on the map');
    // Measuring that dataset again replaces the measures instead of doubling them.
    const again = (await geoAnalysis.measure(await geoAnalysis.featuresOfDataset(saved.id))).columns.map((c) => c.name);
    assert.equal(again.length, new Set(again).size, 'every column once the second time: ' + again.join(','));
    return 'ok';
  });

  test('qgis: a project gives the layers in tree order with single, categorized and graduated symbols, matches datasets by file name and becomes a map chart; .qgz is read', async (assert) => {
    const areas = await makeAreas();
    await datasets.updateMeta(areas.id, { source: { kind: 'file', fileName: 'omraden.gpkg', format: 'gpkg' }, importOptions: { table: 'omraden' } });
    const xml = `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis projectname="Testprojekt" version="3.34.6-Prizren">
  <title>Testprojekt</title>
  <projectCrs><spatialrefsys><authid>EPSG:3006</authid></spatialrefsys></projectCrs>
  <layer-tree-group>
    <layer-tree-layer id="punkter_1" name="Punkter" checked="Qt::Checked" source="./data/punkter.csv" providerKey="delimitedtext"/>
    <layer-tree-group name="Underlag" checked="Qt::Checked">
      <layer-tree-layer id="omraden_2" name="Områden" checked="Qt::Checked" source="./data/omraden.gpkg|layername=omraden" providerKey="ogr"/>
      <layer-tree-layer id="raster_3" name="Ortofoto" checked="Qt::Unchecked" source="./data/orto.tif" providerKey="gdal"/>
    </layer-tree-group>
  </layer-tree-group>
  <projectlayers>
    <maplayer geometry="Point" type="vector">
      <id>punkter_1</id><datasource>file:///C:/data/punkter.csv?delimiter=,&amp;xField=lon&amp;yField=lat</datasource><layername>Punkter</layername>
      <srs><spatialrefsys><authid>EPSG:4326</authid></spatialrefsys></srs><provider>delimitedtext</provider>
      <renderer-v2 type="graduatedSymbol" attr="antal" graduatedMethod="GraduatedColor">
        <ranges>
          <range render="true" symbol="0" lower="0.000" upper="10.000" label="0 - 10"/>
          <range render="true" symbol="1" lower="10.000" upper="20.000" label="10 - 20"/>
        </ranges>
        <symbols>
          <symbol type="marker" name="0" alpha="1"><layer class="SimpleMarker" enabled="1"><Option type="Map"><Option name="color" type="QString" value="255,255,178,255"/><Option name="outline_color" type="QString" value="35,35,35,255"/><Option name="size" type="QString" value="3"/></Option></layer></symbol>
          <symbol type="marker" name="1" alpha="1"><layer class="SimpleMarker" enabled="1"><Option type="Map"><Option name="color" type="QString" value="240,59,32,255,rgb:0.94,0.23,0.13,1"/><Option name="outline_color" type="QString" value="35,35,35,255"/><Option name="size" type="QString" value="3"/></Option></layer></symbol>
        </symbols>
      </renderer-v2>
    </maplayer>
    <maplayer geometry="Polygon" type="vector">
      <id>omraden_2</id><datasource>./data/omraden.gpkg|layername=omraden</datasource><layername>Områden</layername>
      <srs><spatialrefsys><authid>EPSG:3006</authid></spatialrefsys></srs><provider>ogr</provider>
      <renderer-v2 type="categorizedSymbol" attr="klass">
        <categories>
          <category render="true" symbol="0" value="A" label="Klass A" type="string"/>
          <category render="true" symbol="1" value="B" label="Klass B" type="string"/>
        </categories>
        <symbols>
          <symbol type="fill" name="0" alpha="1"><layer class="SimpleFill" enabled="1"><prop k="color" v="31,120,180,255"/><prop k="outline_color" v="35,35,35,255"/><prop k="outline_width" v="0.46"/><prop k="style" v="solid"/></layer></symbol>
          <symbol type="fill" name="1" alpha="0.5"><layer class="SimpleFill" enabled="1"><prop k="color" v="51,160,44,255"/><prop k="outline_style" v="no"/></layer></symbol>
        </symbols>
      </renderer-v2>
    </maplayer>
    <maplayer type="raster"><id>raster_3</id><datasource>./data/orto.tif</datasource><layername>Ortofoto</layername><provider>gdal</provider></maplayer>
  </projectlayers>
</qgis>`;
    const project = qgis.parseXml(xml);
    assert.equal(project.title, 'Testprojekt'); assert.equal(project.crs, 'EPSG:3006');
    assert.deepEqual(project.layers.map((l) => [l.name, l.type, l.visible, l.group]), [['Punkter', 'vector', true, ''], ['Områden', 'vector', true, 'Underlag'], ['Ortofoto', 'raster', false, 'Underlag']]);
    const omr = project.layers[1];
    assert.deepEqual([omr.source.file, omr.source.layer, omr.crs], ['omraden.gpkg', 'omraden', 'EPSG:3006']);
    assert.equal(omr.renderer.type, 'categorizedSymbol'); assert.equal(omr.renderer.attribute, 'klass');
    assert.deepEqual(omr.renderer.categories.map((c) => [c.value, c.label, c.style.fillColor, c.style.color]), [['A', 'Klass A', '#1f78b4', '#232323'], ['B', 'Klass B', '#33a02c', '#33a02c']]);
    assert.ok(Math.abs(omr.renderer.categories[0].style.weight - 1.7) < 0.1, 'outline 0.46 mm is about 1.7 px: ' + omr.renderer.categories[0].style.weight);
    assert.ok(omr.renderer.categories[1].style.noStroke && omr.renderer.categories[1].style.weight === 0 && omr.renderer.categories[1].style.fillOpacity === 0.5, 'no outline and half transparent');
    const pts = project.layers[0];
    assert.equal(pts.source.file, 'punkter.csv'); assert.equal(pts.source.params.xField, 'lon');
    assert.equal(pts.renderer.type, 'graduatedSymbol');
    assert.deepEqual(pts.renderer.ranges.map((r) => [r.lower, r.upper, r.label, r.style.fillColor]), [[0, 10, '0 - 10', '#ffffb2'], [10, 20, '10 - 20', '#f03b20']]);
    assert.ok(pts.renderer.ranges[0].style.radius > 4 && pts.renderer.ranges[0].style.radius < 7, 'a 3 mm marker is about 5.7 px across: ' + pts.renderer.ranges[0].style.radius);
    assert.equal(qgis.parseColor('12,34,56,128').hex, '#0c2238'); assert.ok(Math.abs(qgis.parseColor('12,34,56,128').alpha - 0.5) < 0.01); assert.equal(qgis.parseColor('x'), null);
    // Matching by file name; the points file is not there.
    const all = await datasets.list();
    const matches = qgis.matchDatasets(project, all);
    assert.equal(matches.get('omraden_2') && matches.get('omraden_2').id, areas.id, 'gpkg matched by file name');
    assert.ok(!matches.has('punkter_1'), 'csv not matched');
    const result = await qgis.toMapLayers(project, matches, (id) => datasets.columns(id));
    assert.equal(result.layers.length, 1); assert.deepEqual(result.missing.map((m) => [m.layer.name, m.reason]), [['Punkter', 'dataset'], ['Ortofoto', 'raster']]);
    const layer = result.layers[0];
    assert.equal(layer.name, 'Områden'); assert.equal(layer.colorBy.mode, 'category'); assert.deepEqual(layer.colorBy.values, { A: '#1f78b4', B: '#33a02c' });
    const el = host();
    try {
      const chart = charts.create('map', areas, 'QGIS'); chart.map = leaflet.defaultMap([], null); chart.map.layers = result.layers;
      const hd = await leaflet.render(el, chart, {});
      assert.deepEqual(hd.legend[0].entries.map((e) => [e.label, e.color]), [['A', '#1f78b4'], ['B', '#33a02c']], 'QGIS colours in the legend');
      hd.finalize();
    } finally { el.remove(); }
    // .qgz: the same project zipped.
    const zip = D.require('platform/storage/zip');
    const qgz = new File([await zip.createZip({ 'testprojekt.qgs': xml, 'testprojekt.qgd': new Uint8Array(0) })], 'testprojekt.qgz');
    assert.equal((await qgis.parseFile(qgz)).layers.length, 3, 'qgz read');
    assert.ok(qgis.detect(qgz) && qgis.detect(new File([''], 'x.qgs')) && !qgis.detect(new File([''], 'x.gpkg')));
    return 'ok';
  }, 30000);

  test('ui: a geodataset opens as a map in Bearbeta, gets the Geo tab in Analysera, edits as a map view in Visualisera, and a QGIS project dropped in Inhämta becomes a map view', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let areas = null; let chartId = null; let projectChart = null; let imported = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      areas = await makeAreas();
      created.pop(); // removed here, not in cleanup
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === areas.id), 3000, 'dataset in store');
      const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
      // Bearbeta: the map by default, the table one click away and back.
      shell.activate('bearbeta');
      shell.store.set({ selectedId: areas.id });
      await assertLayerVisible(assert, await waitFor(() => root.querySelector('.dm-map-view.leaflet-container .leaflet-overlay-pane canvas'), 8000, 'map in Bearbeta'), 'Bearbeta');
      assert.ok(buttonByText(t('bearbeta.view.table')), 'table button');
      buttonByText(t('bearbeta.view.table')).click();
      await waitFor(() => root.querySelectorAll('dm-table .dm-tr').length === 3, 5000, 'three rows in the table');
      await waitFor(() => buttonByText(t('bearbeta.view.map')), 3000, 'map button in the table toolbar');
      buttonByText(t('bearbeta.view.map')).click();
      await waitFor(() => root.querySelector('.dm-map-view.leaflet-container'), 8000, 'map again');
      // Analysera: the Geo tab, a measure run and its result table.
      shell.activate('analysera');
      const tabs = () => Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).map((e) => e.textContent.trim());
      await waitFor(() => tabs().includes(t('analysera.tabs.geo')), 5000, 'Geo tab');
      /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === t('analysera.tabs.geo'))).click();
      await waitFor(() => buttonByText(t('geo.run')), 5000, 'Run button');
      buttonByText(t('geo.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 3, 15000, 'three measured rows');
      // Visualisera: a saved map chart opens in the map panel with its layer card and legend.
      const chart = charts.create('map', areas, 'UI-karta');
      chart.map = leaflet.defaultMap(await datasets.columns(areas.id), areas);
      chart.map.layers[0].colorBy = { column: 'klass', mode: 'category' };
      chartId = (await charts.save(chart)).id;
      shell.store.set({ openChartId: chartId });
      shell.activate('visualisera');
      await assertLayerVisible(assert, await waitFor(() => root.querySelector('.dm-map-preview.leaflet-container .leaflet-overlay-pane canvas'), 8000, 'map in Visualisera'), 'Visualisera');
      assert.ok(root.querySelector('.dm-map-layer'), 'layer card');
      await waitFor(() => root.querySelectorAll('.dm-right .dm-map-legend-list li').length === 2, 5000, 'legend with two categories in the inspector');
      // Inhämta: a QGIS project with its data file becomes a map view.
      const geojson = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { namn: 'Zon 1', klass: 'A' }, geometry: square(16, 58, 0.3) }, { type: 'Feature', properties: { namn: 'Zon 2', klass: 'B' }, geometry: square(16.5, 58, 0.3) }] };
      const dataFile = new File([JSON.stringify(geojson)], 'zoner.geojson', { type: 'application/geo+json' });
      const xml = '<!DOCTYPE qgis PUBLIC \'http://mrcc.com/qgis.dtd\' \'SYSTEM\'><qgis projectname="Zoner" version="3.34.0"><title>Zoner</title><layer-tree-group><layer-tree-layer id="z1" name="Zoner" checked="Qt::Checked"/></layer-tree-group><projectlayers><maplayer geometry="Polygon" type="vector"><id>z1</id><datasource>./zoner.geojson</datasource><layername>Zoner</layername><provider>ogr</provider><renderer-v2 type="categorizedSymbol" attr="klass"><categories><category render="true" symbol="0" value="A" label="A"/><category render="true" symbol="1" value="B" label="B"/></categories><symbols><symbol type="fill" name="0"><layer class="SimpleFill"><prop k="color" v="200,30,30,255"/></layer></symbol><symbol type="fill" name="1"><layer class="SimpleFill"><prop k="color" v="30,30,200,255"/></layer></symbol></symbols></renderer-v2></maplayer></projectlayers></qgis>';
      const zip = D.require('platform/storage/zip');
      const qgz = new File([await zip.createZip({ 'zoner.qgs': xml })], 'zoner.qgz');
      shell.activate('inhamta');
      const dz = await waitFor(() => root.querySelector('dm-dropzone'), 5000, 'dropzone');
      dz.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [qgz, dataFile] }, bubbles: true }));
      await waitFor(() => buttonByText(t('import.project.create')), 8000, 'project step');
      assert.ok(Array.from(root.querySelectorAll('.dm-center .dm-list-item')).some((e) => e.textContent.includes('zoner.geojson')), 'the data file is listed as the layer source');
      buttonByText(t('import.project.create')).click();
      await waitFor(() => buttonByText(t('import.project.open')), 15000, 'map view created');
      projectChart = (await charts.list()).find((c) => c.name === 'Zoner');
      assert.ok(projectChart && projectChart.map.layers.length === 1 && projectChart.map.layers[0].colorBy.values.A === '#c81e1e', 'QGIS colours kept: ' + JSON.stringify(projectChart && projectChart.map.layers[0].colorBy));
      imported = shell.store.get().datasets.find((d) => d.source && d.source.fileName === 'zoner.geojson');
      assert.ok(imported, 'the data file was imported as a dataset');
      return 'ok';
    } finally {
      if (chartId) await charts.remove(chartId).catch(() => {});
      if (projectChart) await charts.remove(projectChart.id).catch(() => {});
      if (imported) await datasets.remove(imported.id).catch(() => {});
      if (areas) await datasets.remove(areas.id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('map: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
