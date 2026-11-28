// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the example data (PLAN 12 f, F128 a; presets/exempeldata, tools/build_examples.py): every example imports as its kind
 * (a table, a comprehensive and a detailed plan, a model, a table from JSON, a graph, a map layer); the house lies in the detailed
 * plan's residential area, the plan area inside the comprehensive plan and in its area for housing; the graph has every
 * municipality and known neighbours; the house names no person; and the empty Hantera links to Exempeldata in Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const presets = D.require('presets');
  const geo = D.require('data/geo');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const post = (id) => { const p = presets.examples.find((x) => x.id === id); if (!p) throw new Error('no example ' + id); return p; };
  const made = [];
  /** @returns {Promise<any>} the example's dataset, imported once for the tests of this file */
  const imported = {};
  async function importOnce(id) {
    if (!imported[id]) imported[id] = importer.runPreset(post(id)).then((meta) => { made.push(meta.id); return meta; });
    return imported[id];
  }
  /** The rows of a plan dataset as objects. */
  async function planRows(id) {
    const names = (await datasets.columns(id)).map((c) => c.name);
    return D.require('data/plan').fromRows(names, await datasets.query(id));
  }
  /** Ray casting in a Polygon or MultiPolygon (holes respected). */
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inside(x, y, g) {
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return polygons.some((rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((hole) => inRing(x, y, hole)));
  }
  const positions = (g) => (g.type === 'Polygon' ? g.coordinates.flat() : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : []);
  /** An IfcCompoundPlaneAngleMeasure (degrees, minutes, seconds, millionths) in degrees. */
  const angle = (parts) => parts.reduce((sum, v, i) => sum + Number(v) / [1, 60, 3600, 3600e6][i], 0);

  test('examples: every example imports as its kind, with its short name and its origin', async (assert) => {
    const kinds = {};
    for (const p of presets.examples.filter((x) => !x.boundary || x.example)) {
      const meta = await importOnce(p.id);
      const ds = await datasets.get(meta.id);
      kinds[p.id] = ds.kind + (ds.plan ? ':' + ds.plan.slag : '');
      assert.ok(ds.source && ds.source.preset === p.id && ds.source.license === p.source.license, 'origin and licence kept: ' + p.id);
      assert.ok(/^[a-z][a-z0-9_]*$/.test(ds.shortName) && ds.shortName.startsWith(p.shortName.slice(0, 10)), 'short name: ' + ds.shortName);
      assert.equal(ds.description, t(p.descriptionKey), 'description: ' + p.id);
    }
    assert.deepEqual(kinds, {
      'befolkning-kommuner-2024': 'table', 'lomma-op-2020': 'plan:oversiktsplan', 'lomma-dp-bjorreds-vangar': 'plan:detaljplan', 'bjorreds-vangar-hus': 'model',
      'fardigstallda-lagenheter-2024': 'table', kommungrannar: 'graph', 'kommuner-scb': 'table',
    });
    // The table: population and land area per municipality.
    const table = await importOnce('befolkning-kommuner-2024');
    const cols = await datasets.columns(table.id);
    assert.deepEqual(cols.map((c) => c.name), ['kommunkod', 'kommun', 'lanskod', 'lan', 'ar', 'folkmangd', 'landareal_km2']);
    assert.equal(cols[6].type, 'number', 'the area is a number');
    const lomma = (await datasets.query(table.id)).find((r) => r[0] === '1262');
    assert.ok(lomma && lomma[1] === 'Lomma' && lomma[6] > 50 && lomma[6] < 60, 'Lomma has about 56 km²: ' + JSON.stringify(lomma));
    // The JSON file: SCB's JSON-stat answer as one row per municipality and type of building.
    const json = await datasets.get((await importOnce('fardigstallda-lagenheter-2024')).id);
    assert.equal(json.rowCount, 580, '290 municipalities by two types of building');
    // The map layer: the municipal boundaries with their geometry.
    const layer = await importOnce('kommuner-scb');
    assert.ok((await datasets.columns(layer.id)).some((c) => c.name === 'geometry'), 'a geometry column');
    assert.equal((await datasets.get(layer.id)).rowCount, 290);
    return Object.keys(kinds).length + ' examples';
  }, 120000);

  test('examples: the house lies in the detailed plan, and the plan area in the comprehensive plan and its area for housing', async (assert) => {
    const dp = await planRows((await importOnce('lomma-dp-bjorreds-vangar')).id);
    const op = await planRows((await importOnce('lomma-op-2020')).id);
    const area = JSON.parse(dp.find((r) => r.objekttyp === 'planomrade').geometri);
    const housing = JSON.parse(dp.find((r) => r.objekttyp === 'anvandning' && r.beteckning === 'B').geometri);
    assert.equal(dp.filter((r) => r.objekttyp === 'anvandning').length, 3, 'B, GATA and NATUR');
    assert.ok(dp.concat(op).every((r) => r.geometri), 'every object of both plans has its place in WGS 84');
    const themes = new Set(op.map((r) => r.tema));
    assert.ok(['plangeometri', 'markochvattenanvandning', 'utvecklingsinriktning', 'klimatrelateradrisk'].every((k) => themes.has(k)), 'the ÖP\'s themes: ' + Array.from(themes));
    assert.ok(dp.filter((r) => r.objekttyp === 'egenskap').every((r) => r.katalogreferens), 'every provision refers to the catalogue');
    const boundary = JSON.parse(op.find((r) => r.tema === 'plangeometri').geometri);
    const outside = positions(area).filter(([x, y]) => !inside(x, y, boundary));
    assert.equal(outside.length, 0, 'every corner of the plan area inside the comprehensive plan: ' + JSON.stringify(outside.slice(0, 3)));
    // The house: the site's reference point and the map conversion, from the shipped file.
    const text = await D.assets.loadText(post('bjorreds-vangar-hus').asset);
    assert.ok(/IFCPROJECTEDCRS\('EPSG:3008'/.test(text), 'SWEREF 99 13 30');
    const site = /IFCSITE\('[^']*',#\d+,'house - site',[^;]*?\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\),\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\)/.exec(text);
    assert.ok(site, 'the house site has its latitude and longitude');
    const lat = angle(site.slice(1, 5)); const lon = angle(site.slice(5, 9));
    assert.ok(inside(lon, lat, area), 'the house in the plan area: ' + lon + ', ' + lat);
    assert.ok(inside(lon, lat, housing), 'the house in the residential area (B)');
    const homes = op.filter((r) => r.innehallstyp === 'Bostadsbebyggelse').map((r) => JSON.parse(r.geometri));
    assert.ok(homes.some((g) => inside(lon, lat, g)), 'the house in the comprehensive plan\'s area for housing');
    const conv = /IFCMAPCONVERSION\(#\d+,#\d+,([\d.]+),([\d.]+),([\d.]+),/.exec(text);
    const origin = geo.toWgs84({ type: 'Point', coordinates: [Number(conv[1]), Number(conv[2])] }, 'EPSG:3008').coordinates;
    const metres = Math.hypot((origin[0] - lon) * 111320 * Math.cos(lat * Math.PI / 180), (origin[1] - lat) * 110570);
    assert.ok(metres < 100, 'the map conversion puts the model\'s origin next to the house: ' + metres.toFixed(1) + ' m');
    // No person's name in the model (the owner history is the app's neutral user).
    const personal = await D.require('data/ifc-step').personal(new TextEncoder().encode(text));
    assert.deepEqual(personal.persons, [], 'no person in the house');
    return `${lon.toFixed(5)}, ${lat.toFixed(5)}`;
  }, 120000);

  test('examples: the graph of neighbouring municipalities has every municipality and their shared borders', async (assert) => {
    const graph = D.require('data/graph');
    const id = (await importOnce('kommungrannar')).id;
    const info = await graph.summary(id);
    assert.equal(info.nodes, 290, 'every municipality');
    assert.equal(info.edges, 690, 'every pair with a shared border');
    assert.deepEqual(info.types.map((x) => x.name), ['GRANSAR_TILL']);
    const of = async (code) => (await graph.edges(id, { ids: [code] })).map((e) => (e.source === code ? e.target : e.source)).sort();
    const stockholm = await of('0180');
    assert.ok(stockholm.includes('0184') && stockholm.includes('0183') && stockholm.includes('0126'), 'Stockholm borders Solna, Sundbyberg and Huddinge: ' + stockholm);
    assert.deepEqual(await of('1262'), ['1230', '1231', '1261', '1281'], 'Lomma borders Staffanstorp, Burlöv, Kävlinge and Lund');
    assert.deepEqual(await of('0980'), [], 'Gotland borders no one');
    const solna = (await graph.nodes(id, { ids: ['0184'] }))[0];
    assert.ok(solna && solna.label === 'Kommun' && solna.properties.namn === 'Solna', 'a node: ' + JSON.stringify(solna));
    return `${info.nodes} noder, ${info.edges} kanter`;
  }, 60000);

  test('examples: the empty Hantera links to Exempeldata in Inhämta', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const kept = shell.store.get().datasets;
      shell.store.set({ datasets: [], selectedId: null });
      await shell.activate('hantera');
      const center = root.querySelector('.dm-center');
      const button = await waitFor(() => center.querySelector('[data-try-examples]'), 5000, 'the button in the empty Hantera');
      assert.equal(button.getAttribute('label'), t('presets.try'));
      const before = shell.store.get().datasets.length;
      /** @type {HTMLElement} */ (button.querySelector('button')).click();
      await waitFor(() => center.querySelector('[data-examples]'), 8000, 'Exempeldata in Inhämta');
      assert.equal(root.querySelector('.dm-left [data-source="examples"]').getAttribute('aria-current'), 'true', 'the source is marked');
      assert.equal(shell.store.get().datasets.length, before, 'nothing imported by the button');
      shell.store.set({ datasets: kept });
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    for (const id of made.splice(0)) await datasets.remove(id, { quiet: true }).catch(() => {});
    return 'ok';
  }, 40000);
})();
