// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Sweden's orthophotos from Lantmäteriet's STAC files (decision B-64): the search for the newest colour images, the
 * overview that fits the output, the window and the corners of the image, the consent asked once with the host, the key only
 * to the file host and never in the consent, a saved map or published HTML, and nothing fetched without the person's action;
 * the decoding and the warp in the worker while the page only answers its ranges, and the file host's Geotorget login asked
 * once and sent only there.
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
   * every request to the catalogue and to the files is recorded (`all`: every request the page sends with its Authorization).
   * `basic`: the virtual file host takes the Geotorget login (files.basic); `bearer401`: it refuses the key's token; `ranges`:
   * it answers range requests with 206 and the span, as Lantmäteriet's does. Everything is put back afterwards.
   */
  async function withLantmateriet(opts, fn) {
    const answer = opts.answer || { allow: true, remember: true };
    const preset = await connectors.get('lantmateriet-stac');
    const copy = JSON.parse(JSON.stringify(preset));
    Object.assign(copy, { baseUrl: BASE });
    copy.auth.tokenUrl = BASE + '/token';
    copy.files.hosts = ['tests'];
    if (opts.basic) copy.files.basic = ['tests'];
    await connectors.save(copy);
    if (opts.key !== false) secrets.set('lantmateriet-stac', { clientId: 'nyckel-ortofoto', clientSecret: SECRET });
    const searched = []; const files = []; const names = []; const all = [];
    const serve = (name, fn2) => { names.push(name); D.net.virtual(name, fn2); };
    serve('tests/geo/lmo/token', () => Promise.resolve({ kind: 'text', data: JSON.stringify({ access_token: TOKEN, expires_in: 3600 }) }));
    serve('tests/geo/lmo/stac-bild/v1/search', (url) => { searched.push(String(url)); return Promise.resolve({ kind: 'text', data: JSON.stringify(opts.search || ANSWER) }); });
    for (const name of Object.keys(FILES)) serve('tests/geo/lmo-files/' + name, () => Promise.resolve(opts.refuse === name ? { kind: 'text', data: 'no', status: 403 } : { kind: 'binary', data: FILES[name].slice(0) }));
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = String(input); const h = (init && init.headers) || {};
      const auth = String(h.Authorization || ''); const range = String(h.Range || '');
      all.push({ url, auth });
      if (/lmo-files/.test(url)) {
        files.push({ url, auth, range });
        if (opts.bearer401 && /^Bearer /.test(auth)) return Promise.resolve(new Response('no', { status: 401 }));
        const m = opts.ranges ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
        const data = FILES[url.split('/').pop()];
        if (m && data) {
          const from = Number(m[1]); const to = Math.min(Number(m[2]), data.byteLength - 1);
          return Promise.resolve(new Response(data.slice(from, to + 1), { status: 206, headers: { 'Content-Type': 'image/tiff', 'Content-Range': `bytes ${from}-${to}/${data.byteLength}` } }));
        }
      }
      return realFetch(input, init);
    };
    const key = 'dataspatium.consent';
    const before = localStorage.getItem(key);
    localStorage.removeItem(key);
    const prior = await consent.state('api');
    await consent.set('api', null);
    const asked = [];
    consent.setAsker(async (purpose, info) => { asked.push(Object.assign({ purpose }, info)); return typeof answer === 'function' ? answer(purpose, info) : answer; });
    try { return await fn({ asked, searched, files, all }); } finally {
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

  /** The worker that reads the files, once a reading has started it. */
  const orthoWorker = () => D.workers.list().find((w) => /** @type {any} */ (w).dmNamespace === 'geotiff');
  /** A finer file over b.tif's square: 1 024 × 1 024 at 25 cm, red the column and green the row modulo 256, blue 30. */
  function bigFile() {
    if (!FILES['big.tif']) {
      FILES['big.tif'] = writeTiff([
        { width: 1024, height: 1024, pixel: (x, y) => [x & 255, y & 255, 30, 77] },
        { width: 512, height: 512, sub: 1, pixel: (x, y) => [(x * 2) & 255, (y * 2) & 255, 130, 77] },
      ], { res: 0.25, east: E_B, north: N0 });
    }
    const it = item('big', 'big.tif', E_B, 2026);
    it.properties.upplosning = 0.25;
    return { type: 'FeatureCollection', links: [], features: [it] };
  }
  /** The longest pause between the page's turns while `fn` runs, from a timer that asks for a turn as often as it can. */
  async function longestPause(fn) {
    let last = performance.now(); let longest = 0; let on = true;
    const tick = () => { const now = performance.now(); longest = Math.max(longest, now - last); last = now; if (on) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    try { return { value: await fn(), get longest() { return longest; } }; } finally { on = false; }
  }

  test('orthophoto-cog: the tiles are decoded and warped in a worker; the page only answers its ranges, with the key, and gets the image, its corners and progress after each tile', async (assert) => {
    const search = bigFile();
    await withLantmateriet({ search, ranges: true }, async ({ files }) => {
      // The first reading starts the worker.
      const b0 = box(674200, 6580100, 674240, 6580140);
      cog.release(await cog.load(b0, { grid: 3006, width: 40 }));
      const w = /** @type {any} */ (orthoWorker());
      assert.ok(w, 'the worker that reads the files');
      // The page's share: how long it takes to answer each of the worker's messages, and whether it decodes anything itself.
      const original = w.onmessage; let slowest = 0; let messages = 0;
      w.onmessage = function (ev) { const t0 = performance.now(); try { return original.call(this, ev); } finally { messages++; slowest = Math.max(slowest, performance.now() - t0); } };
      const G = /** @type {any} */ (globalThis).GeoTIFF; let onPage = 0; const opened = G && G.fromCustomClient;
      if (G) G.fromCustomClient = (...args) => { onPage++; return opened.apply(G, args); };
      files.length = 0;
      const progress = [];
      const b2 = box(674150, 6580030, 674360, 6580230);
      let run;
      try {
        run = await longestPause(() => cog.load(b2, { width: 1024, keepPixels: true, onProgress: (p) => progress.push(p.done) }));
      } finally { w.onmessage = original; if (G) G.fromCustomClient = opened; }
      const r = run.value;
      assert.ok(onPage === 0 && (G || !(/** @type {any} */ (globalThis).GeoTIFF)), 'nothing is decoded on the page');
      assert.ok(messages > 3 && slowest < 20, `each answer to the worker is bookkeeping: ${messages} messages, the slowest ${slowest.toFixed(1)} ms`);
      assert.ok(run.longest < 50, `the page never waits more than 50 ms: ${run.longest.toFixed(1)} ms`);
      assert.ok(progress.length >= 2 && progress.every((d, i) => d === i + 1), 'progress after each tile: ' + progress.join(','));
      assert.ok(files.length >= 2 && files.every((f) => f.auth === 'Bearer ' + TOKEN && /^bytes=\d+-\d+$/.test(f.range) && /big\.tif$/.test(f.url)), 'range requests with the key, from the page: ' + files.length);
      // The same image as on the page before: the corners of a web map are the box, and each pixel comes from where it lies.
      assert.deepEqual(r.bounds, [[b2[3], b2[0]], [b2[1], b2[2]]], 'the corners');
      assert.ok(r.items.length === 1 && r.items[0].level === 0.25 && Math.abs(r.resolution - 0.25) < 0.01, JSON.stringify(r.items) + ' ' + r.resolution);
      assert.ok(r.width > 800 && r.width <= 1024 && r.pixels.length === r.width * r.height * 4, `${r.width} × ${r.height}`);
      assert.ok((r.blob.type === 'image/jpeg' || r.blob.type === 'image/png') && r.blob.size > 0 && /^blob:/.test(r.url), r.blob.type);
      const R = 6378137;
      const merc = (lon, lat) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
      const unmerc = (x, y) => [((x / R) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
      const [X0, Y0] = merc(b2[0], b2[1]); const [X1, Y1] = merc(b2[2], b2[3]);
      const near = (a, b) => { const d = (((a - b) % 256) + 256) % 256; return d <= 2 || d >= 254; };
      let n = 0; let off = 0;
      for (let j = 3; j < r.height; j += 37) for (let i = 3; i < r.width; i += 37) {
        const k = (j * r.width + i) * 4;
        const ll = unmerc(X0 + ((i + 0.5) * (X1 - X0)) / r.width, Y1 - ((j + 0.5) * (Y1 - Y0)) / r.height);
        const en = geo.wgs84ToSweref(ll[0], ll[1]);
        n++;
        if (!near(r.pixels[k], Math.floor((en[0] - E_B) / 0.25) & 255) || !near(r.pixels[k + 1], Math.floor((N0 - en[1]) / 0.25) & 255) || r.pixels[k + 2] !== 30) off++;
      }
      assert.ok(n > 400 && off === 0, `the warp in the worker: ${off} of ${n} pixels misplaced`);
      cog.release(r);
      // A reading cancelled while the worker reads gives up, and the worker takes the next one.
      const controller = new AbortController();
      const err = await cog.load(b2, { width: 1024, signal: controller.signal, onProgress: () => controller.abort() }).catch((e) => e);
      assert.ok(err && err.kind === 'aborted', 'cancelled: ' + String(err && (err.kind || err.message)));
      const again = await cog.load(b0, { grid: 3006, width: 40 });
      assert.ok(again.items.length === 1, 'the next reading');
      cog.release(again);
    });
    return 'ok';
  }, 90000);

  test('orthophoto-cog: when the file host refuses the key\'s token, the Geotorget login is asked once, goes as Basic only to the file host and is kept with the key', async (assert) => {
    const USER = 'prov-anvandare'; const PASSWORD = 'prov-lösen-ortofoto';
    const LOGIN = 'Basic ' + btoa(Array.from(new TextEncoder().encode(`${USER}:${PASSWORD}`), (b) => String.fromCharCode(b)).join(''));
    const auth = D.require('api/auth');
    const b1 = box(674150, 6580100, 674250, 6580200);
    // What the page sends to its workers, to show that neither the key's token nor the login goes there.
    const Shimmed = /** @type {any} */ (globalThis.Worker);
    const sent = [];
    Shimmed.prototype.postMessage = function (msg, transfer) { if (msg && msg.type) sent.push(msg); return Object.getPrototypeOf(Shimmed.prototype).postMessage.call(this, msg, transfer); };
    try {
      await withLantmateriet({ basic: true, bearer401: true }, async ({ asked: questions, files, all }) => {
        // Nobody to ask: the message says what to do.
        const none = await cog.load(b1, { grid: 3006, width: 100 }).catch((e) => e);
        assert.ok(none && none.code === 'login' && none.status === 401 && none.message === t('ortho.se.err.login', { host: 'tests' }), String(none && none.message));
        // The person cancels: asked once, nothing sent with a login.
        let asked = 0;
        const declined = await cog.load(b1, { grid: 3006, width: 100, login: async () => { asked++; return false; } }).catch((e) => e);
        assert.ok(declined && declined.code === 'login' && asked === 1, 'asked once: ' + asked);
        assert.ok(!all.some((x) => x.auth === LOGIN), 'no login sent before it is entered');
        // The person enters it: asked once for a reading of two files; the token is tried once, then every file takes the login.
        files.length = 0; all.length = 0; asked = 0;
        const b2 = box(674010, 6580100, 674250, 6580200);
        const r = await cog.load(b2, { width: 240, login: async () => { asked++; secrets.set('lantmateriet-stac', Object.assign({}, secrets.get('lantmateriet-stac'), { fileUser: USER, filePassword: PASSWORD })); return true; } });
        assert.ok(asked === 1 && r.items.length === 2, `asked ${asked} times, ${r.items.length} files`);
        assert.equal(files.filter((f) => /^Bearer /.test(f.auth)).length, 1, 'the token is tried once');
        const withLogin = all.filter((x) => x.auth === LOGIN);
        assert.ok(withLogin.length >= 2 && withLogin.every((x) => /lmo-files/.test(x.url)) && files.slice(1).every((f) => f.auth === LOGIN), 'the login only to the file host');
        assert.ok(!all.some((x) => !/lmo-files/.test(x.url) && x.auth === LOGIN), 'neither the token host nor the catalogue gets it');
        // Only the hosts in files.basic, and only with both fields.
        const connector = await connectors.get('lantmateriet-stac');
        assert.equal(auth.fileLogin(connector, BASE + '-files/a.tif'), LOGIN);
        assert.equal(auth.fileLogin(connector, 'https://example.org/a.tif'), null);
        assert.equal(auth.fileLogin(Object.assign({}, connector, { files: { column: 'asset_data', hosts: ['tests'] } }), BASE + '-files/a.tif'), null, 'not without files.basic');
        // Never in the consent, the worker's messages or the saved connector.
        const seen = JSON.stringify(questions) + JSON.stringify(sent) + JSON.stringify(await connectors.get('lantmateriet-stac'));
        assert.ok(sent.some((m) => m.type === 'job') && sent.some((m) => m.type === 'range'), 'the worker got its job and ranges');
        assert.ok(![PASSWORD, USER, LOGIN, TOKEN, SECRET, 'nyckel-ortofoto'].some((s) => seen.includes(s)), 'no key, token or login in the question, the worker or the connector');
      });
    } finally { delete Shimmed.prototype.postMessage; }
    // The preset sends it to Lantmäteriet's file host and nowhere else.
    const preset = await connectors.get('lantmateriet-stac');
    assert.deepEqual(auth.fileLoginHosts(preset), ['dl1.lantmateriet.se']);
    return 'ok';
  }, 60000);

  test('orthophoto-cog: the credentials panel has the file host\'s login beside the key, both fields or neither, kept with the key', async (assert) => {
    const auth = D.require('api/auth');
    const i18n = D.require('ui/i18n');
    const panels = D.require('ui/api/auth-panel');
    const connector = { id: 'prov-filinloggning', name: 'Prov', auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://example.org/token' }, files: { column: 'url', hosts: ['files.example.org'], basic: ['files.example.org'] } };
    secrets.set(connector.id, { clientId: 'id-prov', clientSecret: 'hemlighet-prov' });
    let changed = 0;
    const panel = panels.create(connector, { login: true, onChange: () => changed++ });
    document.body.appendChild(panel.el);
    const button = (label) => /** @type {any} */ (Array.from(panel.el.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === label));
    const field = (key) => /** @type {any} */ (panel.el.querySelector(`[data-file-login="${key}"]`));
    try {
      // The panel draws itself again when it knows whether the key is saved.
      await secrets.isPersisted(connector.id); await wait(200);
      const section = /** @type {HTMLDetailsElement} */ (panel.el.querySelector('[data-file-login-section]'));
      assert.ok(section && section.open && section.textContent.includes('files.example.org'), 'open with the host named');
      field('fileUser').value = 'anv';
      button(t('api.key.use')).click();
      assert.ok(!secrets.get(connector.id).fileUser && !changed, 'both fields or neither');
      field('filePassword').value = 'lösen ord';
      button(t('api.key.use')).click();
      const kept = secrets.get(connector.id);
      assert.ok(kept.clientId === 'id-prov' && kept.fileUser === 'anv' && kept.filePassword === 'lösen ord' && changed === 1, 'kept with the key');
      assert.equal(auth.fileLogin(connector, 'https://files.example.org/x.tif'), 'Basic ' + btoa(Array.from(new TextEncoder().encode('anv:lösen ord'), (b) => String.fromCharCode(b)).join('')));
      assert.equal(auth.fileLogin(connector, 'https://other.example.org/x.tif'), null, 'no other host');
      const plain = panels.create({ id: 'prov-utan', name: 'Prov', auth: { type: 'apiKey', in: 'header', name: 'X-Key' } });
      assert.ok(!plain.el.querySelector('[data-file-login]'), 'no login fields without files.basic');
      plain.destroy();
      // The words in all seven languages.
      const before = i18n.language();
      try {
        for (const code of i18n.LANGUAGES.map((l) => l.code)) {
          await i18n.loadLanguage(code); i18n.setLanguage(code, { persist: false });
          for (const key of ['api.files.login', 'api.files.login.help', 'ortho.se.err.login', 'ortho.se.login.title', 'ortho.se.login.why', 'ortho.se.login.enter']) assert.ok(t(key) !== key, code + ': ' + key);
        }
      } finally { i18n.setLanguage(before, { persist: false }); }
    } finally { panel.destroy(); panel.el.remove(); await secrets.forget(connector.id); }
    return 'ok';
  }, 30000);
})();
