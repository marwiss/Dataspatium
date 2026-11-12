// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Sweden's orthophotos from Lantmäteriet's STAC files (decision B-64): the search for the newest colour images, the
 * overview that fits the output, the window and the corners of the image, the consent asked once with the host, the key only
 * to the file host and never in the consent, a saved map or published HTML, and nothing fetched without the person's action.
 * Nothing here touches the net: the catalogue, the token and the files are virtual services under
 * dataspatium-asset://tests/geo/lmo, the files small GeoTIFFs written here, and the consent asker is a stub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const geo = D.require('data/geo');
  const cog = D.require('api/orthophoto-cog');
  const orthophotos = D.require('viz/orthophotos');
  const leaflet = D.require('viz/leaflet');
  const choice = D.require('ui/viz/basemap-choice');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const consent = D.require('platform/consent');
  const datasets = D.require('data/datasets');
  const BASE = 'dataspatium-asset://tests/geo/lmo';
  const SECRET = 'hemlighet-ortofoto'; const TOKEN = 'ortofoto-token';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }

  /**
   * A small tiled GeoTIFF as Lantmäteriet's files are (four bands, red, green, blue and infrared, with an overview): uncompressed,
   * 8 bits, tiles of 16 × 16. `levels` are {width, height, sub, pixel(x, y) -> [r, g, b, i]}; the first carries the place.
   */
  function writeTiff(levels, place) {
    const TILE = 16; const S = 4;
    const parts = []; let offset = 8;
    const plan = levels.map((lv) => {
      const tiles = [];
      for (let j = 0; j < Math.ceil(lv.height / TILE); j++) for (let i = 0; i < Math.ceil(lv.width / TILE); i++) {
        const buf = new Uint8Array(TILE * TILE * S);
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
          const gx = i * TILE + x; const gy = j * TILE + y;
          if (gx < lv.width && gy < lv.height) buf.set(lv.pixel(gx, gy), (y * TILE + x) * S);
        }
        tiles.push({ offset, length: buf.length }); parts.push(buf); offset += buf.length;
      }
      return tiles;
    });
    const SHORT = 3; const LONG = 4; const DOUBLE = 12;
    const ifds = levels.map((lv, k) => {
      const e = [[254, LONG, [lv.sub || 0]], [256, LONG, [lv.width]], [257, LONG, [lv.height]], [258, SHORT, [8, 8, 8, 8]], [259, SHORT, [1]], [262, SHORT, [2]],
        [277, SHORT, [S]], [284, SHORT, [1]], [322, SHORT, [TILE]], [323, SHORT, [TILE]], [324, LONG, plan[k].map((x) => x.offset)], [325, LONG, plan[k].map((x) => x.length)],
        [338, SHORT, [0]], [339, SHORT, [1, 1, 1, 1]]];
      if (!k) e.push([33550, DOUBLE, [place.res, place.res, 0]], [33922, DOUBLE, [0, 0, 0, place.east, place.north, 0]], [34735, SHORT, [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 3006]]);
      return e.sort((a, b) => a[0] - b[0]);
    });
    const SIZE = { 3: 2, 4: 4, 12: 8 };
    const blocks = []; let pos = offset;
    for (const entries of ifds) {
      const head = new DataView(new ArrayBuffer(2 + entries.length * 12 + 4));
      const start = pos; let extra = start + head.byteLength; const extras = [];
      head.setUint16(0, entries.length, true);
      entries.forEach(([tag, type, values], k) => {
        const at = 2 + k * 12; const bytes = SIZE[type] * values.length;
        head.setUint16(at, tag, true); head.setUint16(at + 2, type, true); head.setUint32(at + 4, values.length, true);
        const put = (view, o) => values.forEach((v, i) => { if (type === SHORT) view.setUint16(o + i * 2, v, true); else if (type === LONG) view.setUint32(o + i * 4, v, true); else view.setFloat64(o + i * 8, v, true); });
        if (bytes <= 4) put(head, at + 8);
        else { const ev = new DataView(new ArrayBuffer(bytes)); put(ev, 0); head.setUint32(at + 8, extra, true); extras.push(new Uint8Array(ev.buffer)); extra += bytes; }
      });
      blocks.push({ start, head: new Uint8Array(head.buffer), extras, next: start + 2 + entries.length * 12 });
      pos = extra;
    }
    const file = new Uint8Array(pos); const view = new DataView(file.buffer);
    file[0] = 0x49; file[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, blocks[0].start, true);
    let o = 8; for (const p of parts) { file.set(p, o); o += p.length; }
    blocks.forEach((b, i) => {
      let at = b.start; file.set(b.head, at); at += b.head.length;
      for (const x of b.extras) { file.set(x, at); at += x.length; }
      view.setUint32(b.next, i + 1 < blocks.length ? blocks[i + 1].start : 0, true);
    });
    return file.buffer;
  }
  /** One of Lantmäteriet's files in miniature: 256 × 256 m at 1 m and an overview at 2 m; red is the column, green the row, blue the file and level. */
  const SIZE = 256; const N0 = 6580256; const E_A = 674000; const E_B = 674128;
  const file = (marker, east) => writeTiff([
    { width: SIZE, height: SIZE, pixel: (x, y) => [x, y, marker, 77] },
    { width: SIZE / 2, height: SIZE / 2, sub: 1, pixel: (x, y) => [x * 2, y * 2, marker + 100, 77] },
  ], { res: 1, east, north: N0 });
  const FILES = { 'a.tif': file(10, E_A), 'b.tif': file(20, E_B) };
  const item = (id, name, east, year, kind = 'rgbi', code = 'EPSG:3006') => ({
    type: 'Feature', id, collection: `orto-x-${year}`, geometry: null,
    properties: { flygar: year, datetime: `${year}-06-01T10:00:00Z`, spektraltyp: kind, upplosning: 1, 'proj:bbox': [east, N0 - SIZE, east + SIZE, N0], 'proj:code': code },
    assets: { data: { href: `${BASE}-files/${name}`, type: 'image/tiff; application=geotiff; profile=cloud-optimized', 'proj:bbox': [east, N0 - SIZE, east + SIZE, N0], 'proj:code': code } },
  });
  const ANSWER = { type: 'FeatureCollection', links: [], features: [item('a', 'a.tif', E_A, 2023), item('b', 'b.tif', E_B, 2025), item('c', 'c.tif', E_A, 2026, 'cir'), item('d', 'd.tif', E_A, 2027, 'rgb', 'EPSG:3021')] };
  /** A box in degrees [west, south, east, north] from SWEREF 99 TM corners. */
  const box = (e0, n0, e1, n1) => { const a = geo.swerefToWgs84(e0, n0, 3006); const b = geo.swerefToWgs84(e1, n1, 3006); return [a[0], a[1], b[0], b[1]]; };

  /**
   * Run with the preset lantmateriet-stac pointed at the virtual Lantmäteriet (the user's copy with the preset's id takes its
   * place), its key in the session (unless `key` is false), the consent for API fetches not yet given and a recording asker;
   * every request to the catalogue and to the files is recorded. Everything is put back afterwards.
   */
  async function withLantmateriet(opts, fn) {
    const answer = opts.answer || { allow: true, remember: true };
    const preset = await connectors.get('lantmateriet-stac');
    const copy = JSON.parse(JSON.stringify(preset));
    Object.assign(copy, { baseUrl: BASE });
    copy.auth.tokenUrl = BASE + '/token';
    copy.files.hosts = ['tests'];
    await connectors.save(copy);
    if (opts.key !== false) secrets.set('lantmateriet-stac', { clientId: 'nyckel-ortofoto', clientSecret: SECRET });
    const searched = []; const files = []; const names = [];
    const serve = (name, fn2) => { names.push(name); D.net.virtual(name, fn2); };
    serve('tests/geo/lmo/token', () => Promise.resolve({ kind: 'text', data: JSON.stringify({ access_token: TOKEN, expires_in: 3600 }) }));
    serve('tests/geo/lmo/stac-bild/v1/search', (url) => { searched.push(String(url)); return Promise.resolve({ kind: 'text', data: JSON.stringify(opts.search || ANSWER) }); });
    for (const name of Object.keys(FILES)) serve('tests/geo/lmo-files/' + name, () => Promise.resolve(opts.refuse === name ? { kind: 'text', data: 'no', status: 403 } : { kind: 'binary', data: FILES[name].slice(0) }));
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => { if (/lmo-files/.test(String(input))) files.push({ url: String(input), auth: String(((init && init.headers) || {}).Authorization || ''), range: String(((init && init.headers) || {}).Range || '') }); return realFetch(input, init); };
    const key = 'dataspatium.consent';
    const before = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('api');
    await consent.set('api', null);
    const asked = [];
    consent.setAsker(async (purpose, info) => { asked.push(Object.assign({ purpose }, info)); return typeof answer === 'function' ? answer(purpose, info) : answer; });
    try { return await fn({ asked, searched, files }); } finally {
      consent.setAsker(null);
      await consent.set('api', prior === 'granted' || prior === 'denied' ? prior : null);
      if (before !== null) localStorage.setItem(key, before);
      globalThis.fetch = realFetch;
      for (const n of names) D.net.unvirtual(n);
      await connectors.remove('lantmateriet-stac').catch(() => {});
      await secrets.forget('lantmateriet-stac');
      D.require('api/auth').clearToken('lantmateriet-stac');
    }
  }
  function host(width = 400, height = 300) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute; left:-10000px; top:0; width:${width}px; height:${height}px;`;
    document.body.appendChild(el);
    return el;
  }
  const imageLayers = (map) => { const out = []; map.eachLayer((l) => { if (l instanceof /** @type {any} */ (globalThis).L.ImageOverlay) out.push(l); }); return out; };

  test('orthophoto-cog: the search asks the catalogue for the newest colour images over the box, and only COGs in SWEREF 99 TM are drawn, the newest that covers each part', async (assert) => {
    const connector = await connectors.get('lantmateriet-stac');
    const url = cog.searchUrl(connector, [18.068, 59.329, 18.07, 59.33]);
    assert.equal(url, "https://api.lantmateriet.se/stac-bild/v1/search?bbox=18.068000,59.329000,18.070000,59.330000&limit=50&sortby=-datetime&filter-lang=cql2-text&filter=spektraltyp%20IN%20('rgb'%2C'rgbi')");
    const items = cog.itemsOf(ANSWER);
    assert.deepEqual(items.map((i) => i.id), ['b', 'a'], 'infrared and RT 90 left out, newest first');
    assert.deepEqual(items[0].bbox, [E_B, N0 - SIZE, E_B + SIZE, N0]);
    assert.ok(items[0].year === 2025 && items[0].res === 1 && items[0].kind === 'rgbi', JSON.stringify(items[0]));
    // Inside both files the newest is enough; across the west edge of the newest the older fills in.
    assert.deepEqual(cog.pick(items, [674150, 6580100, 674250, 6580200]).map((i) => i.id), ['b']);
    assert.deepEqual(cog.pick(items, [674010, 6580100, 674250, 6580200]).map((i) => i.id), ['b', 'a']);
    assert.deepEqual(cog.pick(items, [690000, 6600000, 690100, 6600100]), [], 'nothing elsewhere');
    // The overview: the coarsest whose pixels are at most √2 times the size asked for.
    const levels = [{ res: 0.16 }, { res: 0.32 }, { res: 0.64 }, { res: 1.28 }, { res: 2.56 }];
    assert.deepEqual([0.1, 0.16, 0.2, 0.5, 1, 3, 50].map((r) => cog.chooseLevel(levels, r)), [0, 0, 0, 2, 3, 4, 4]);
    return 'ok';
  });

  test('orthophoto-cog: the overview that fits the output is read, only the window the box needs, with one consent question and the key only to the file host', async (assert) => {
    await withLantmateriet({}, async ({ asked, searched, files }) => {
      // Inside both files: only the newest (blue 20) is read, at 1 m from the full image.
      const b1 = box(674150, 6580100, 674250, 6580200);
      const r = await cog.load(b1, { grid: 3006, width: 100, keepPixels: true });
      assert.deepEqual(r.items.map((i) => [i.id, i.level]), [['b', 1]], 'the newest file, full resolution');
      assert.ok(asked.length === 1 && asked[0].purpose === 'api' && asked[0].host === 'tests' && /Lantmäteriet/.test(asked[0].label) && /CC BY 4\.0/.test(asked[0].label), 'one question: ' + JSON.stringify(asked));
      assert.ok(!JSON.stringify(asked).includes(SECRET) && !JSON.stringify(asked).includes(TOKEN), 'no key in the question');
      assert.ok(searched.length === 1 && /bbox=18\.\d+,59\.\d+,18\.\d+,59\.\d+/.test(searched[0]) && /filter-lang=cql2-text/.test(searched[0]), searched[0]);
      assert.ok(files.length >= 1 && files.every((f) => f.auth === 'Bearer ' + TOKEN && /^bytes=\d+-\d+$/.test(f.range)), 'range requests with the key: ' + JSON.stringify(files));
      assert.ok(files.every((f) => /b\.tif$/.test(f.url)), 'the older file is not opened');
      // The corners in SWEREF 99 TM, and each pixel from the place it lies on.
      const nw = geo.wgs84ToSweref(r.bounds[0][1], r.bounds[0][0]); const se = geo.wgs84ToSweref(r.bounds[1][1], r.bounds[1][0]);
      assert.ok(Math.abs(se[0] - nw[0] - r.width * r.resolution) < 0.05 && Math.abs(nw[1] - se[1] - r.height * r.resolution) < 0.05, 'the corners span the image');
      assert.ok(nw[0] <= 674150 && nw[1] >= 6580200 && se[0] >= 674250 && se[1] <= 6580100, 'the image covers the box: ' + nw.concat(se).map((v) => v.toFixed(1)).join(' '));
      let off = 0;
      for (const [i, j] of [[2, 2], [50, 40], [r.width - 3, r.height - 3]]) {
        const k = (j * r.width + i) * 4;
        const x = Math.floor(nw[0] + (i + 0.5) * r.resolution - E_B); const y = Math.floor(N0 - (nw[1] - (j + 0.5) * r.resolution));
        if (Math.abs(r.pixels[k] - x) > 2 || Math.abs(r.pixels[k + 1] - y) > 2 || r.pixels[k + 2] !== 20 || r.pixels[k + 3] !== 255) off++;
      }
      assert.equal(off, 0, 'red is the column and green the row of the file');
      assert.ok(r.blob.type === 'image/jpeg' || r.blob.type === 'image/png', r.blob.type);
      assert.ok(/^blob:/.test(r.url), 'an image address for the map');
      cog.release(r);
      // Half the pixels: the overview at 2 m (blue 120).
      const r2 = await cog.load(b1, { grid: 3006, width: 50, keepPixels: true });
      assert.ok(r2.items[0].level === 2 && r2.pixels[2 + 4 * (20 * r2.width + 20)] === 120, 'the overview: ' + JSON.stringify(r2.items));
      cog.release(r2);
      // Across the newest file's west edge, in Web Mercator: both files, the newest on top, each pixel where it belongs.
      const b2 = box(674010, 6580100, 674250, 6580200);
      const r3 = await cog.load(b2, { width: 240, keepPixels: true });
      assert.deepEqual(r3.items.map((i) => i.id), ['a', 'b'], 'oldest first, so the newest lies on top');
      assert.deepEqual(r3.bounds, [[b2[3], b2[0]], [b2[1], b2[2]]], 'the corners of a web map are the box');
      assert.equal(r3.attribution, 'Ortofoto © Lantmäteriet (2025, 2023)');
      const R = 6378137;
      const merc = (lon, lat) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
      const unmerc = (x, y) => [((x / R) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
      const [X0, Y0] = merc(b2[0], b2[1]); const [X1, Y1] = merc(b2[2], b2[3]);
      let n = 0; off = 0;
      for (let j = 1; j < r3.height; j += 7) for (let i = 1; i < r3.width; i += 7) {
        const k = (j * r3.width + i) * 4;
        const ll = unmerc(X0 + ((i + 0.5) * (X1 - X0)) / r3.width, Y1 - ((j + 0.5) * (Y1 - Y0)) / r3.height);
        const en = geo.wgs84ToSweref(ll[0], ll[1]);
        if (Math.abs(en[0] - E_B) < 2) continue;
        const inB = en[0] > E_B; const x = Math.floor(en[0] - (inB ? E_B : E_A)); const y = Math.floor(N0 - en[1]);
        n++;
        if (Math.abs(r3.pixels[k] - x) > 2 || Math.abs(r3.pixels[k + 1] - y) > 2 || r3.pixels[k + 2] !== (inB ? 20 : 10)) off++;
      }
      assert.ok(n > 100 && off === 0, `the warp to Web Mercator: ${off} of ${n} pixels misplaced`);
      cog.release(r3);
    });
    return 'ok';
  }, 60000);

  test('orthophoto-cog: nothing is contacted without the key, after a refused consent, outside Sweden or over 1 km², and a refused file says what the key needs', async (assert) => {
    const b1 = box(674150, 6580100, 674250, 6580200);
    await withLantmateriet({ key: false }, async ({ asked, searched, files }) => {
      const r = await cog.load(b1);
      assert.ok(r.needsKey && !asked.length && !searched.length && !files.length, 'no key: nothing asked or fetched');
      const preset = await orthophotos.get('ortho-se');
      assert.ok(preset && !orthophotos.ready(preset), 'the orthophoto is not ready without the key');
    });
    await withLantmateriet({ answer: { allow: false, remember: false } }, async ({ asked, searched, files }) => {
      const err = await cog.load(b1).catch((e) => e);
      assert.ok(err && err.name === 'ConsentError' && asked.length === 1 && !searched.length && !files.length, 'refused: nothing fetched');
    });
    await withLantmateriet({ refuse: 'b.tif' }, async ({ asked, searched }) => {
      const outside = await cog.load([-21.95, 64.13, -21.9, 64.15]).catch((e) => e);
      assert.ok(outside.code === 'outside' && outside.message === t('ortho.se.err.outside'), 'Reykjavík');
      const large = await cog.load([18.0, 59.3, 18.1, 59.4]).catch((e) => e);
      assert.ok(large.code === 'large' && large.area > cog.MAX_AREA, large.message);
      assert.ok(!asked.length && !searched.length, 'neither is asked or searched');
      const refused = await cog.load(b1).catch((e) => e);
      assert.ok(refused.code === 'file' && refused.status === 403 && refused.message === t('ortho.se.err.file', { status: 403 }), String(refused && refused.message));
      const none = await cog.load(box(690000, 6600000, 690100, 6600100)).catch((e) => e);
      assert.ok(none.code === 'none', 'no image there');
    });
    return 'ok';
  }, 60000);

  test('orthophoto-cog: on a map Lantmäteriet\'s orthophoto is fetched only on the person\'s action, then lies under the features with its attribution, and the key stays out of the saved map and published HTML', async (assert) => {
    const el = host();
    const centre = geo.swerefToWgs84(674192, 6580128, 3006);
    try {
      await withLantmateriet({}, async ({ asked, searched, files }) => {
        const chart = { kind: 'map', name: 'Ortofoto Sverige', map: { layers: [], basemap: 'ortho-se', view: { center: [centre[1], centre[0]], zoom: 19 } } };
        const hd = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('no tiles'); } });
        assert.ok(hd.info.basemapView === 'ortho-se' && !hd.info.basemapKey, 'the map knows its background is read per view');
        assert.equal(await choice.drawView(hd, { quiet: true }), 'idle', 'without the person\'s action nothing is read');
        assert.ok(!asked.length && !searched.length && !files.length, 'nothing asked or fetched when the map is drawn');
        assert.equal(await choice.drawView(hd, { load: true, quiet: true }), 'drawn');
        const layers = imageLayers(hd.map);
        assert.equal(layers.length, 1, 'one image');
        const lb = layers[0].getBounds(); const mb = hd.map.getBounds();
        assert.ok(Math.abs(lb.getWest() - mb.getWest()) < 1e-6 && Math.abs(lb.getNorth() - mb.getNorth()) < 1e-6, 'the image covers the view');
        const attribution = layers[0].getAttribution();
        assert.ok(attribution.includes('Ortofoto © Lantmäteriet (2025)') && attribution.includes('CC BY 4.0') && attribution.includes(t('ortho.se.processed')), attribution);
        assert.ok(layers[0].options.pane === 'tilePane', 'under the features');
        assert.ok(hd.info.basemapImage && hd.info.basemapImage.years[0] === 2025, JSON.stringify(hd.info.basemapImage));
        hd.finalize();
        // The same view drawn again takes the image already read.
        const n = files.length;
        const hd2 = await leaflet.render(el, chart, { tileFactory: () => { throw new Error('no tiles'); } });
        assert.equal(await choice.drawView(hd2, { quiet: true }), 'kept');
        assert.ok(files.length === n && searched.length === 1 && imageLayers(hd2.map).length === 1, 'nothing fetched again');
        hd2.finalize();
        // The key is in no question, saved map or published HTML; a key-bound orthophoto is left out of published HTML.
        const all = JSON.stringify(asked) + JSON.stringify(chart) + (await leaflet.htmlFor('m-se', chart));
        assert.ok(!all.includes(SECRET) && !all.includes(TOKEN) && !all.includes('nyckel-ortofoto'), 'no key');
        assert.ok(!/tileLayer|imageOverlay|blob:/.test(await leaflet.htmlFor('m-se', chart)), 'no orthophoto in published HTML');
      });
      // Without the key the map says so, and nothing is read (another view than the one read above).
      await withLantmateriet({ key: false }, async ({ asked, files }) => {
        const hd = await leaflet.render(el, { kind: 'map', map: { layers: [], basemap: 'ortho-se', view: { center: [centre[1], centre[0]], zoom: 18 } } }, {});
        assert.ok(hd.info.basemapKey === 'ortho-se' && choice.keyNotice(hd.info).includes(t('map.basemap.ortho-se')), 'the key is missing');
        assert.equal(await choice.drawView(hd, { load: true, quiet: true }), 'key');
        assert.ok(!asked.length && !files.length, 'nothing asked or fetched');
        hd.finalize();
      });
    } finally { el.remove(); }
    return 'ok';
  }, 60000);

  test('orthophoto-cog: the site step offers Lantmäteriet\'s orthophoto in Sweden and, when it is chosen, reads the place with 250 m around it', async (assert) => {
    const c = geo.swerefToWgs84(674192, 6580128, 3006);
    const square = { type: 'Polygon', coordinates: [[[c[0], c[1]], [c[0] + 0.0002, c[1]], [c[0] + 0.0002, c[1] + 0.0001], [c[0], c[1] + 0.0001], [c[0], c[1]]]] };
    const meta = await datasets.create({ name: 'Tomt Stockholm (STAC)', columns: [{ name: 'namn', type: 'text' }, { name: 'geometry', type: 'text' }], rows: [['Huset', JSON.stringify(square)]] });
    const site = D.require('ui/bearbeta/site-map').create({}, { tileFactory: () => { throw new Error('no tiles'); } });
    document.body.appendChild(site.el);
    try {
      await withLantmateriet({}, async ({ asked, files }) => {
        site.setDataset(meta.id);
        /** @type {HTMLDetailsElement} */ (site.el).open = true;
        await site.draw();
        assert.ok(!asked.length && !files.length, 'drawing the place asks nothing');
        await waitFor(() => site.handle && site.state.orthos.length, 8000, 'the map and its choices');
        assert.deepEqual(site.state.orthos.map((o) => o.value), ['ortho-se'], 'Lantmäteriet\'s orthophoto in Stockholm');
        assert.ok(!asked.length && !files.length, 'opening the map asks nothing');
        assert.equal(await site.choose('ortho-se'), true);
        assert.equal(site.state.image, 'drawn');
        const layers = imageLayers(site.handle.map);
        assert.equal(layers.length, 1, 'the image under the footprint');
        const b = layers[0].getBounds();
        const wide = (b.getEast() - b.getWest()) * 111320 * Math.cos((b.getCenter().lat * Math.PI) / 180); const high = (b.getNorth() - b.getSouth()) * 111320;
        assert.ok(wide >= 249 && high >= 249, 'at least 250 m around the place: ' + Math.round(wide) + ' × ' + Math.round(high));
        assert.ok(asked.length === 1, 'one question');
        const note = site.el.querySelector('[data-site-map-note]').textContent;
        assert.ok(/2025/.test(note), 'the note names the year: ' + note);
      });
    } finally { site.destroy(); site.el.remove(); await datasets.remove(meta.id).catch(() => {}); }
    return 'ok';
  }, 60000);
})();
