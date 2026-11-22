// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the kind raster (decision B-64): GeoTIFF and cloud-optimised GeoTIFF files read in the raster worker (engines/raster)
 * with their size, bands, place and system, and nothing decoded on the page; one dataset of one or more files, each a row with its
 * extent in WGS 84, the original byte for byte and a preview in Web Mercator with each pixel in its place; the overview that fits,
 * the limits on the originals and one band of floats stretched; the refusals in words the person can act on; the page never kept
 * waiting; Exportera's original and map image with its attribution; the review before sharing; undo, versions and packages; and
 * the orthophoto shown saved as a raster without a key, a token or a file address.
 * Nothing here touches the net: the files are GeoTIFFs written by tests/fixtures/geotiff, and the consent asker is a stub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const geo = D.require('data/geo');
  const datasets = D.require('data/datasets');
  const dsFiles = D.require('data/dataset-files');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const kinds = D.require('data/kinds');
  const fx = D.require('tests/fixtures/geotiff');
  const engines = D.require('engines/raster');
  const raster = D.require('data/raster');
  const created = [];
  const track = (meta) => { if (meta && meta.id) created.push(meta.id); return meta; };
  /** SWEREF 99 TM near Stockholm: the upper left corner of the test files. */
  const E0 = 674000; const N0 = 6580256;
  const R = 6378137;
  const merc = (lon, lat) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  const unmerc = (x, y) => [((x / R) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
  /** The text of a binary file, so that a value left anywhere in it can be found. */
  const asText = (bytes) => new TextDecoder('latin1').decode(bytes);
  const sameBytes = (a, b) => a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
  const rowsOf = async (id) => { const cols = await datasets.columns(id); return (await datasets.allRows(id)).map((r) => Object.fromEntries(cols.map((c, i) => [c.name, r[i]]))); };
  /** The error a promise rejects with, or null. */
  const failure = async (p) => { try { await p; return null; } catch (err) { return err; } };
  /** A JPEG picture of one colour, as the person would choose it. */
  async function jpegFile(name, width = 40, height = 30) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')); g.fillStyle = '#4a7f5b'; g.fillRect(0, 0, width, height);
    const blob = /** @type {Blob} */ (await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9)));
    return new File([blob], name, { type: 'image/jpeg' });
  }
  /** The longest pause between the page's turns while `fn` runs, from a timer that asks for a turn as often as it can. */
  async function longestPause(fn) {
    let last = performance.now(); let longest = 0; let on = true;
    const tick = () => { const now = performance.now(); longest = Math.max(longest, now - last); last = now; if (on) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    try { return { value: await fn(), get longest() { return longest; } }; } finally { on = false; }
  }
  /** Run with some of data/raster's limits changed, and put them back. */
  async function withLimits(changes, fn) {
    const before = Object.assign({}, raster.limits);
    Object.assign(raster.limits, changes);
    try { return await fn(); } finally { Object.assign(raster.limits, before); }
  }
  /** A GeoTIFF in SWEREF 99 TM at the test corner. */
  const sweref = (name, spec = {}) => fx.file(Object.assign({ width: 64, height: 48, geo: { res: 1, east: E0, north: N0, epsg: 3006 } }, spec), name);
  /** geotiff.js on the page, for reading back what the worker wrote (loaded only after the page is shown to decode nothing). */
  async function pageGeoTiff() {
    if (!(/** @type {any} */ (globalThis).GeoTIFF)) await D.assets.loadVendorScript('vendor/geotiff/geotiff.js');
    return /** @type {any} */ (globalThis).GeoTIFF;
  }

  test('raster: the worker reads a GeoTIFF\'s size, bands, place and system, draws a level into a picture, and writes a GeoTIFF that reads back with its place; nothing is decoded on the page', async (assert) => {
    // Whatever geotiff.js the page may hold already is watched: none of it may run.
    const G0 = /** @type {any} */ (globalThis).GeoTIFF;
    const real = {}; let onPage = 0;
    if (G0) for (const k of ['fromBlob', 'fromArrayBuffer', 'fromCustomClient', 'fromUrl', 'fromFile']) { real[k] = G0[k]; G0[k] = (...args) => { onPage++; return real[k].apply(G0, args); }; }
    // The worker encodes and decodes the pictures itself (OffscreenCanvas): the page's canvas does neither meanwhile.
    const toBlob = HTMLCanvasElement.prototype.toBlob; const getImageData = CanvasRenderingContext2D.prototype.getImageData; let canvases = 0;
    HTMLCanvasElement.prototype.toBlob = function (...args) { canvases++; return toBlob.apply(this, args); };
    CanvasRenderingContext2D.prototype.getImageData = function (...args) { canvases++; return getImageData.apply(this, args); };
    let written; let types = '';
    try {
      const file = sweref('sweref.tif', { dateTime: '2023:06:15 12:00:00', copyright: 'Prov AB', geo: { res: 2, east: E0, north: N0, epsg: 3006 } });
      const info = await engines.open(file);
      assert.ok(info.width === 64 && info.height === 48 && info.bands === 3 && info.bits === 8 && info.sampleFormat === 1 && info.photometric === 2 && info.compression === 1, JSON.stringify(info));
      assert.ok(info.tiled && info.georef === 'tiepoint' && !info.rotated && !info.pixelIsPoint, 'tiles and a tiepoint');
      assert.deepEqual(info.levels, [{ width: 64, height: 48 }]);
      assert.deepEqual([info.origin, info.res], [[E0, N0], [2, 2]]);
      assert.ok(info.geoKeys.ProjectedCSTypeGeoKey === 3006 && info.geoKeys.GTModelTypeGeoKey === 1, JSON.stringify(info.geoKeys));
      assert.ok(info.nodata === null && info.alpha === false && info.dateTime === '2023:06:15 12:00:00' && info.copyright === 'Prov AB' && info.personal.length === 0, 'the tags read');
      assert.deepEqual(raster.extentOf(info), [E0, N0 - 96, E0 + 128, N0]);
      // The systems: an EPSG code, a name in the citation, a code the app cannot convert, a citation it does not know, and none.
      const crsFor = async (spec, name) => { const i = await engines.open(fx.file(Object.assign({ width: 16, height: 16 }, spec), name)); return raster.crsOf(i, raster.extentOf(i)); };
      const epsg = raster.crsOf(info, raster.extentOf(info));
      assert.ok(epsg.source === 'epsg' && epsg.code === 3006 && epsg.crs === 'EPSG:3006' && epsg.text === 'SWEREF 99 TM (EPSG:3006)' && epsg.placed, JSON.stringify(epsg));
      const named = await crsFor({ geo: { res: 10, east: 500000, north: 6600000, citation: 'ETRS89 / UTM zone 33N' } }, 'utm.tif');
      assert.ok(named.source === 'name' && named.code === 25833 && named.placed, JSON.stringify(named));
      const gk = await crsFor({ geo: { res: 10, east: 3500000, north: 5800000, epsg: 31467 } }, 'gk3.tif');
      assert.ok(gk.source === 'epsg' && gk.code === 31467 && !gk.placed && geo.crsUnknown(gk.crs), 'a code the app cannot convert: ' + JSON.stringify(gk));
      const unknown = await crsFor({ geo: { res: 10, east: 3500000, north: 5800000, citation: 'DHDN / 3-degree Gauss-Kruger zone 3' } }, 'dhdn.tif');
      assert.ok(unknown.source === 'unknown' && unknown.crs === 'DHDN / 3-degree Gauss-Kruger zone 3' && !unknown.placed && geo.crsUnknown(unknown.crs), JSON.stringify(unknown));
      const bare = await crsFor({ geo: { res: 1, east: E0, north: N0 } }, 'bare.tif');
      assert.ok(bare.source === 'assumed' && bare.code === 3006 && bare.placed, 'no keys in metres: SWEREF 99 TM, ' + JSON.stringify(bare));
      const degrees = await crsFor({ geo: { res: 0.001, east: 18.06, north: 59.33 } }, 'grader.tif');
      assert.ok(degrees.source === 'assumed' && degrees.code === 4326, 'no keys in degrees: WGS 84, ' + JSON.stringify(degrees));
      const geographic = await crsFor({ geo: { res: 0.001, east: 18.06, north: 59.33, geographic: 4326 } }, 'wgs84.tif');
      assert.ok(geographic.source === 'epsg' && geographic.code === 4326 && geographic.placed, JSON.stringify(geographic));
      // A level drawn into a picture in the file's own grid: red is the column and green the row, with progress after each chunk.
      const progress = [];
      const out = await engines.render(file, { r: 2, Wm: 64, Hm: 48, display: raster.displayOf(info), warp: null, keepPixels: true }, { onProgress: (p) => progress.push(p) });
      assert.ok(out.width === 64 && out.height === 48 && out.empty === 0 && out.level === 0 && out.blob.type === 'image/jpeg', `${out.width} × ${out.height}, ${out.empty} empty, ${out.blob.type}`);
      let off = 0;
      for (let y = 0; y < 48; y += 5) for (let x = 0; x < 64; x += 5) { const k = (y * 64 + x) * 4; if (Math.abs(out.pixels[k] - x) > 2 || Math.abs(out.pixels[k + 1] - y) > 2 || out.pixels[k + 3] !== 255) off++; }
      assert.equal(off, 0, 'each pixel in its place');
      assert.ok(progress.length >= 1 && progress[progress.length - 1].done === progress[progress.length - 1].total, JSON.stringify(progress));
      // A file with an empty part keeps it transparent: WebP, or PNG where the browser cannot encode WebP.
      const holes = sweref('hal.tif', { width: 32, height: 32, nodata: 0, pixel: (x, y) => (x < 8 ? [0, 0, 0] : [x * 4, y * 4, 128]) });
      const hi = await engines.open(holes);
      const ho = await engines.render(holes, { r: 1, Wm: 32, Hm: 32, display: raster.displayOf(hi), warp: null, keepPixels: true });
      assert.ok(hi.nodata === 0 && ho.empty === 8 * 32 && ho.pixels[3] === 0 && ho.pixels[(4 * 32 + 20) * 4 + 3] === 255, `${ho.empty} empty`);
      assert.ok(ho.blob.type === 'image/webp' || ho.blob.type === 'image/png', ho.blob.type);
      // The picture written as a GeoTIFF in Web Mercator.
      written = await engines.write(out.blob, { epsg: 3857, origin: [2000000, 8400000], res: [5, 5] });
      // geotiff.js writes big-endian ("MM"); either byte order is a TIFF.
      assert.ok(written instanceof Uint8Array && written[0] === written[1] && (written[0] === 0x49 || written[0] === 0x4d), 'a TIFF');
      assert.equal(canvases, 0, 'the worker encoded and decoded the pictures');
      types = `${out.blob.type} and ${ho.blob.type} from the worker`;
    } finally { if (G0) Object.assign(G0, real); HTMLCanvasElement.prototype.toBlob = toBlob; CanvasRenderingContext2D.prototype.getImageData = getImageData; }
    assert.ok(onPage === 0 && (G0 || !(/** @type {any} */ (globalThis).GeoTIFF)), 'nothing is decoded on the page');
    assert.ok(D.workers.list().some((w) => /** @type {any} */ (w).dmNamespace === 'raster'), 'the raster worker');
    // Read back with the page's own build: the place, the pixel size, the system and four samples.
    const G = await pageGeoTiff();
    const image = await (await G.fromArrayBuffer(written.slice().buffer)).getImage();
    assert.ok(image.getWidth() === 64 && image.getHeight() === 48 && image.getSamplesPerPixel() === 4, 'the size and four samples');
    assert.deepEqual(Array.from(image.getOrigin()).slice(0, 2), [2000000, 8400000]);
    assert.deepEqual(Array.from(image.getResolution()).slice(0, 2), [5, -5]);
    assert.equal(image.getGeoKeys().ProjectedCSTypeGeoKey, 3857);
    const rgba = await image.readRasters({ interleave: true });
    // The picture went through JPEG on its way, so the values are near, not exact.
    const at = (10 * 64 + 20) * 4;
    assert.ok(Math.abs(rgba[at] - 20) <= 8 && Math.abs(rgba[at + 1] - 10) <= 8 && rgba[at + 3] === 255, `the pixels: ${Array.from(rgba.slice(at, at + 4))}`);
    return types;
  }, 60000);

  test('raster: a GeoTIFF in SWEREF 99 TM becomes one row with its extent in WGS 84, the original byte for byte, and a preview in Web Mercator with each pixel in its place', async (assert) => {
    const W = 256; const H = 192;
    const file = sweref('ortofoto-sweref.tif', { width: W, height: H, dateTime: '2023:06:15 12:00:00', copyright: 'Prov AB' });
    assert.equal(importer.importerFor(file).id, 'raster', 'a TIFF goes to the raster importer');
    const meta = track(await importer.runFiles([file], { format: 'raster' }, 'Raster SWEREF'));
    assert.equal(meta.kind, 'raster');
    const ds = await datasets.get(meta.id);
    const [row] = await rowsOf(meta.id);
    assert.deepEqual([row.fil, row.bredd, row.hojd, row.band, row.datatyp, row.upplosning, row.koordinatsystem, row.ar, row.kalla, row.licens, row.storlek],
      ['ortofoto-sweref.tif', W, H, 3, 'uint8', 1, 'SWEREF 99 TM (EPSG:3006)', 2023, 'Prov AB', null, file.size]);
    // The extent: the corners of the file in WGS 84.
    const ring = JSON.parse(row.geometri).coordinates[0];
    assert.equal(ring.length, 33, 'eight segments a side');
    const corners = [[0, E0, N0 - H], [8, E0 + W, N0 - H], [16, E0 + W, N0], [24, E0, N0]];
    for (const [i, e, n] of corners) {
      const ll = geo.swerefToWgs84(e, n, 3006);
      assert.ok(Math.abs(ring[i][0] - ll[0]) < 1e-7 && Math.abs(ring[i][1] - ll[1]) < 1e-7, `corner ${i}: ${ring[i]} against ${ll}`);
    }
    // The files: the original byte for byte, the preview and the thumbnail.
    const list = await dsFiles.list(meta.id);
    assert.deepEqual(list.map((f) => f.kind).sort(), ['original', 'preview', 'thumb']);
    const original = await dsFiles.read(meta.id, 'ortofoto-sweref.tif', 'original');
    assert.ok(sameBytes(original.bytes, new Uint8Array(await file.arrayBuffer())) && original.type === 'image/tiff', 'the original byte for byte');
    const f = ds.raster.files[0];
    assert.ok(f.placed && f.kept === 'original' && f.skipped === '' && f.crsSource === 'epsg' && f.display === 'rgb' && f.resolution === 1, JSON.stringify(f));
    assert.ok(ds.raster.count === 1 && ds.raster.attribution === 'Prov AB' && ds.raster.extent && ds.raster.extent[0] < ds.raster.extent[2], JSON.stringify(ds.raster.extent));
    // The preview: at most 2 048 pixels, no finer than the file, in Web Mercator over the footprint.
    const [[n, w], [s, e]] = f.preview.bounds;
    const [X0, Y0] = merc(w, s); const [X1, Y1] = merc(e, n);
    const cos = Math.cos(((n + s) / 2) * (Math.PI / 180));
    assert.ok(f.preview.width <= 2048 && f.preview.height <= 2048 && ((X1 - X0) / f.preview.width) * cos >= 0.99, `${f.preview.width} × ${f.preview.height}`);
    assert.ok(/^image\/(webp|png|jpeg)$/.test(f.preview.type) && list.find((x) => x.kind === 'thumb').type === (f.preview.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'), f.preview.type);
    // Each pixel of the preview from where it lies: through Web Mercator, WGS 84 and SWEREF 99 TM back to the file's pixel.
    const read = await raster.readFile(file, { keepPixels: true });
    assert.deepEqual(read.meta.preview.bounds, f.preview.bounds, 'the same preview');
    const Wp = read.meta.preview.width; const Hp = read.meta.preview.height;
    let inside = 0; let off = 0; let outside = 0;
    for (let j = 1; j < Hp; j += 5) for (let i = 1; i < Wp; i += 5) {
      const k = (j * Wp + i) * 4;
      const ll = unmerc(X0 + ((i + 0.5) * (X1 - X0)) / Wp, Y1 - ((j + 0.5) * (Y1 - Y0)) / Hp);
      const en = geo.wgs84ToSweref(ll[0], ll[1]);
      const x = Math.floor(en[0] - E0); const y = Math.floor(N0 - en[1]);
      if (x < -2 || y < -2 || x >= W + 2 || y >= H + 2) { if (read.pixels[k + 3] === 0) outside++; continue; }
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      inside++;
      if (Math.abs(read.pixels[k] - x) > 2 || Math.abs(read.pixels[k + 1] - y) > 2 || read.pixels[k + 2] !== 128 || read.pixels[k + 3] !== 255) off++;
    }
    assert.ok(inside > 500 && off === 0, `the warp to Web Mercator: ${off} of ${inside} pixels misplaced`);
    assert.ok(outside > 0, 'outside the file the preview is empty');
    // The import kept no system of its own: the extent is in degrees.
    assert.deepEqual(ds.importOptions, { format: 'raster' });
    assert.ok(ds.source.kind === 'files' && ds.source.format === 'raster' && ds.source.files[0].name === 'ortofoto-sweref.tif', JSON.stringify(ds.source));
    return 'ok';
  }, 60000);

  test('raster: a world file in degrees is cut at Web Mercator\'s latitudes on the maps and keeps its whole extent in the table', async (assert) => {
    const world = fx.file({ width: 72, height: 36, geo: { res: 5, east: -180, north: 90, geographic: 4326 } }, 'varlden.tif');
    const meta = track(await importer.runFiles([world], { format: 'raster' }, 'Världen'));
    const ds = await datasets.get(meta.id);
    const f = ds.raster.files[0];
    const [[n, w], [s, e]] = f.preview.bounds;
    assert.ok(Math.abs(n - 85.0511287798) < 1e-9 && Math.abs(s + 85.0511287798) < 1e-9 && w === -180 && e === 180, 'the preview within Web Mercator: ' + JSON.stringify(f.preview.bounds));
    assert.ok(f.preview.width > 0 && f.preview.height > 0 && f.preview.width <= 2048 && f.preview.height <= 2048, `${f.preview.width} × ${f.preview.height}`);
    assert.deepEqual(ds.raster.extent, [-180, s, 180, n], 'the extent drawn');
    const lats = JSON.parse((await rowsOf(meta.id))[0].geometri).coordinates[0].map((p) => p[1]);
    assert.ok(Math.max(...lats) === 90 && Math.min(...lats) === -90, 'the table keeps the whole extent');
    // A file wholly beyond them keeps its extent and its picture, but has no place on the maps.
    const polar = fx.file({ width: 8, height: 4, geo: { res: 1, east: 10, north: 90, geographic: 4326 } }, 'polen.tif');
    const pm = track(await importer.runFiles([polar], { format: 'raster' }, 'Polen'));
    const pd = await datasets.get(pm.id);
    assert.ok(pd.raster.files[0].preview.bounds === null && pd.raster.extent === null && (await rowsOf(pm.id))[0].geometri, 'no place on the maps: ' + JSON.stringify(pd.raster.files[0].preview));
    assert.ok(await dsFiles.read(pm.id, 'polen.tif', 'preview'), 'a picture all the same');
    return 'ok';
  }, 60000);

  test('raster: the overview that fits is read, a file over the limit keeps no original, and one band of floats is stretched from 2 to 98 per cent with its empty value transparent', async (assert) => {
    // Overviews at 1, 2 and 4 m beside the full image at 0.5 m; blue says which level a pixel came from.
    const cog = sweref('cog.tif', { width: 1024, height: 1024, tile: 64, overviews: [2, 4, 8], geo: { res: 0.5, east: E0, north: N0, epsg: 3006 }, pixel: (x, y, level, f) => [(x * f) & 255, (y * f) & 255, 10 + level, 255] });
    const info = await engines.open(cog);
    assert.deepEqual(info.levels.map((l) => l.width), [1024, 512, 256, 128], 'the full image and its overviews, finest first');
    const small = await raster.readFile(cog, { side: 256, keepPixels: true });
    assert.equal(small.level, 2, 'the overview at 2 m for a preview of 256 pixels');
    let blue = 0; let covered = 0;
    for (let k = 0; k < small.pixels.length; k += 4 * 7) if (small.pixels[k + 3] === 255) { covered++; if (small.pixels[k + 2] === 12) blue++; }
    assert.ok(covered > 100 && blue === covered, `the overview's pixels: ${blue} of ${covered}`);
    const full = await raster.readFile(cog, { side: 2048 });
    assert.equal(full.level, 0, 'the full image for a large preview');
    // Over the limit: the original stays behind, and the facts say why.
    await withLimits({ keepBytes: 1000 }, async () => {
      const meta = track(await importer.runFiles([sweref('stor-original.tif')], { format: 'raster' }, 'Utan original'));
      const ds = await datasets.get(meta.id);
      assert.ok(ds.raster.files[0].kept === 'none' && ds.raster.files[0].skipped === 'size', JSON.stringify(ds.raster.files[0]));
      assert.deepEqual((await dsFiles.list(meta.id)).map((f) => f.kind).sort(), ['preview', 'thumb']);
      const fact = kinds.facts(ds).find((x) => x.label === t('raster.field.original'));
      assert.equal(fact.value, t('raster.kept.size', { max: D.require('ui/i18n').formatBytes(kinds.RASTER_KEEP.file) }));
    });
    // The dataset's originals together: the second that would pass the total stays behind.
    const one = sweref('a-total.tif'); const two = sweref('b-total.tif');
    await withLimits({ totalKeep: one.size + 10 }, async () => {
      const meta = track(await importer.runFiles([one, two], { format: 'raster' }, 'Totalgräns'));
      const ds = await datasets.get(meta.id);
      assert.deepEqual(ds.raster.files.map((f) => [f.kept, f.skipped]), [['original', ''], ['none', 'total']]);
    });
    assert.equal(raster.limits.keepBytes, 32e6, 'the limits are back');
    // One band of floats with an empty value: stretched from its 2nd to its 98th percentile, the empty value transparent.
    const values = (x) => (x % 17 === 0 ? -9999 : x);
    const floats = sweref('hojd.tif', { width: 100, height: 20, bands: 1, bits: 32, format: 'float', nodata: -9999, pixel: (x) => [values(x)] });
    const fi = await engines.open(floats);
    const display = raster.displayOf(fi);
    assert.ok(display.mode === 'gray' && display.nodata === -9999 && !display.invert, JSON.stringify(display));
    const sorted = []; for (let y = 0; y < 20; y++) for (let x = 0; x < 100; x++) if (values(x) !== -9999) sorted.push(x);
    sorted.sort((a, b) => a - b);
    const at = (p) => sorted[Math.round(p * (sorted.length - 1))];
    const out = await engines.render(floats, { r: 1, Wm: 100, Hm: 20, display, warp: null, keepPixels: true });
    assert.deepEqual(out.stretch, { min: at(0.02), max: at(0.98) }, 'from 2 to 98 per cent');
    const grey = (x) => out.pixels[(5 * 100 + x) * 4];
    const alpha = (x) => out.pixels[(5 * 100 + x) * 4 + 3];
    assert.ok(alpha(17) === 0 && alpha(34) === 0 && alpha(18) === 255 && out.empty === 20 * 6, 'the empty value is transparent: ' + out.empty);
    let rising = true;
    for (let x = 1; x < 99; x++) if (values(x) !== -9999 && values(x + 1) !== -9999 && grey(x + 1) < grey(x)) rising = false;
    assert.ok(rising && grey(1) === 0 && grey(99) === 255 && Math.abs(grey(50) - ((50 - at(0.02)) * 255) / (at(0.98) - at(0.02))) <= 1, `grey rises with x: ${grey(1)}, ${grey(50)}, ${grey(99)}`);
    const meta = track(await importer.runFiles([floats], { format: 'raster' }, 'Flyttal'));
    const ds = await datasets.get(meta.id);
    assert.ok(ds.raster.files[0].display === 'gray' && ds.raster.files[0].stretch && ds.raster.files[0].stretch.max === at(0.98) && ds.raster.files[0].nodata === -9999, JSON.stringify(ds.raster.files[0].stretch));
    assert.equal((await rowsOf(meta.id))[0].datatyp, 'float32');
    assert.ok(kinds.facts(ds).some((x) => x.label === t('raster.field.bands') && x.value === '1 · float32'), 'the facts name the band');
    return 'ok';
  }, 90000);

  test('raster: several files become one raster, a mixed drop is sorted, and a system the app cannot convert is said before the import and kept without a place', async (assert) => {
    const tiles = [0, 1, 2].map((k) => sweref(`ruta-${k}.tif`, { width: 64, height: 64, geo: { res: 1, east: E0 + 64 * k, north: N0, epsg: 3006 } }));
    assert.equal(importer.collectionFor(tiles).id, 'raster', 'the tiles are one raster');
    const meta = track(await importer.runFiles(tiles, { format: 'raster' }, 'Tre rutor'));
    const ds = await datasets.get(meta.id);
    assert.equal(ds.rowCount, 3);
    assert.deepEqual((await rowsOf(meta.id)).map((r) => r.fil), ['ruta-0.tif', 'ruta-1.tif', 'ruta-2.tif']);
    const west = geo.swerefToWgs84(E0, N0 - 32, 3006)[0]; const east = geo.swerefToWgs84(E0 + 192, N0 - 32, 3006)[0];
    assert.ok(ds.raster.count === 3 && ds.raster.extent[0] <= west + 1e-6 && ds.raster.extent[2] >= east - 1e-6, 'the extent covers the three: ' + JSON.stringify(ds.raster.extent));
    assert.ok(kinds.summary(ds).includes(t('raster.files.n', { n: '3' })), kinds.summary(ds));
    // A drop of two TIFF files and a JPEG picture: a raster and an image collection.
    const jpg = await jpegFile('c.jpg');
    assert.equal(importer.importerFor(jpg).id, 'images');
    assert.equal(importer.collectionFor([tiles[0], jpg]), null, 'no collection takes both');
    const sorted = await importer.sortFiles([tiles[0], tiles[1], jpg]);
    assert.deepEqual(sorted.groups.map((g) => [g.importer, g.files.length]), [['raster', 2], ['images', 1]]);
    assert.equal(sorted.groups[0].name, t('import.collection.raster', { n: 2 }));
    // A system the app cannot convert: said before the import, kept without a place, and the health check says so.
    const gk = sweref('gauss-kruger.tif', { width: 32, height: 32, geo: { res: 10, east: 3500000, north: 5800000, epsg: 31467 } });
    const p = await importer.preview(gk);
    assert.ok(p.importer === 'raster' && p.kind === 'raster' && p.crsUnknown === 'EPSG:31467', JSON.stringify({ importer: p.importer, crsUnknown: p.crsUnknown }));
    assert.ok(p.dataRows.length === 1 && p.dataRows[0][11] === null && p.raster.files[0].preview.bounds === null && !p.raster.files[0].placed, 'no place in the preview');
    const sense = D.require('io/file-sense').describe(p, { files: [gk] });
    assert.ok(sense.key === 'import.sense.raster' && sense.params.crs === 'EPSG:31467', JSON.stringify(sense));
    assert.ok(p.pictures.length === 1 && /^data:image\//.test(p.pictures[0]), 'a picture of it all the same');
    const unplaced = track(await importer.runFiles([gk], { format: 'raster' }, 'Okänt system'));
    const u = await datasets.get(unplaced.id);
    assert.ok((await rowsOf(unplaced.id))[0].geometri === null && u.raster.files[0].preview.bounds === null && u.raster.extent === null, 'kept without a place');
    assert.ok(u.raster.files[0].preview.width === 32 && (await dsFiles.read(unplaced.id, 'gauss-kruger.tif', 'preview')), 'a preview in its own grid');
    const health = await D.require('data/kind-health').check(unplaced.id);
    assert.deepEqual(health.map((x) => [x.level, x.key, x.n]), [['warn', 'health.raster.unplaced', 1]]);
    assert.deepEqual(await D.require('data/kind-health').check(meta.id), [], 'the tiles are in good shape');
    return 'ok';
  }, 90000);

  test('raster: two tiles with the same name from two folders both come in, the second named with (2)', async (assert) => {
    const one = sweref('ruta_01.tif', { width: 16, height: 16 });
    const two = sweref('ruta_01.tif', { width: 16, height: 16, geo: { res: 1, east: E0 + 16, north: N0, epsg: 3006 } });
    const meta = track(await importer.runFiles([one, two], { format: 'raster' }, 'Samma namn'));
    assert.deepEqual((await rowsOf(meta.id)).map((r) => r.fil), ['ruta_01.tif', 'ruta_01 (2).tif']);
    const ds = await datasets.get(meta.id);
    assert.deepEqual(ds.raster.files.map((f) => f.name), ['ruta_01.tif', 'ruta_01 (2).tif']);
    assert.deepEqual((await dsFiles.list(meta.id, 'original')).map((f) => f.name), ['ruta_01 (2).tif', 'ruta_01.tif']);
    assert.ok(sameBytes((await dsFiles.read(meta.id, 'ruta_01 (2).tif', 'original')).bytes, new Uint8Array(await two.arrayBuffer())), 'the second file\'s own bytes');
    return 'ok';
  }, 60000);

  test('raster: a TIFF without a place, a rotated file, an unknown compression, too many pixels without overviews and a file that is no TIFF are refused with words the person can act on', async (assert) => {
    const cases = [
      [fx.file({ width: 16, height: 16 }, 'utan-lage.tif'), 'raster.err.nogeo'],
      [fx.file({ width: 16, height: 16, geo: { transformation: [1, 0.5, 0, E0, 0.5, -1, 0, N0, 0, 0, 0, 0, 0, 0, 0, 1] } }, 'vriden.tif'), 'raster.err.rotated'],
      [sweref('zstd.tif', { width: 16, height: 16, compression: 50000 }), 'raster.err.compression'],
      [new File(['inte en tiff alls'], 'fel.tif', { type: 'image/tiff' }), 'raster.err.nottiff'],
    ];
    const count = async () => (await datasets.list()).length;
    const before = await count();
    for (const [file, key] of cases) {
      const words = t(key, { name: file.name });
      const p = await failure(importer.preview(file));
      assert.ok(p && p.message === words, `${file.name} before the import: ${p && p.message}`);
      const r = await failure(importer.runFiles([file], { format: 'raster' }));
      assert.ok(r && r.message === words, `${file.name} imported: ${r && r.message}`);
    }
    // Too many pixels to read without overviews (the limit lowered for the test).
    await withLimits({ maxPixels: 1000 }, async () => {
      const big = sweref('utan-oversikter.tif', { width: 64, height: 64 });
      const words = t('raster.err.overviews', { name: big.name, n: D.require('ui/i18n').formatNumber(0) });
      const p = await failure(importer.preview(big));
      assert.ok(p && p.message === words && p.code === 'overviews', String(p && p.message));
      const r = await failure(importer.runFiles([big], { format: 'raster' }));
      assert.ok(r && r.message === words, String(r && r.message));
    });
    assert.equal(await count(), before, 'no dataset was made');
    // In a mixed choice the others are imported, and the ones left out are named with their words.
    const good = sweref('bra.tif', { width: 16, height: 16 });
    const meta = track(await importer.runFiles([good, cases[0][0], cases[2][0]], { format: 'raster' }, 'Blandat urval'));
    const ds = await datasets.get(meta.id);
    assert.equal(ds.rowCount, 1);
    assert.deepEqual(ds.raster.skipped, [{ name: 'utan-lage.tif', error: t('raster.err.nogeo', { name: 'utan-lage.tif' }) }, { name: 'zstd.tif', error: t('raster.err.compression', { name: 'zstd.tif' }) }]);
    assert.ok(kinds.facts(ds).some((x) => x.label === t('raster.field.files') && x.value.includes(t('images.skipped', { n: '2' }))), 'the facts say two were left out');
    const sorted = await importer.sortFiles([cases[0][0], await jpegFile('bild.jpg')]);
    const results = await importer.runSorted(sorted.groups);
    results.forEach((x) => track(x.meta));
    assert.deepEqual(results.map((x) => [x.group.importer, x.error, !!x.meta]), [['raster', t('raster.err.nogeo', { name: 'utan-lage.tif' }), false], ['images', null, true]]);
    // More files than a raster holds: the rest are left out and said.
    await withLimits({ maxFiles: 2 }, async () => {
      const three = [0, 1, 2].map((k) => sweref(`max-${k}.tif`, { width: 16, height: 16 }));
      const m = track(await importer.runFiles(three, { format: 'raster' }, 'För många'));
      const d = await datasets.get(m.id);
      assert.ok(d.rowCount === 2 && d.raster.skipped.length === 1 && d.raster.skipped[0].error === t('raster.err.many', { max: 2, n: 1 }), JSON.stringify(d.raster.skipped));
    });
    return 'ok';
  }, 90000);

  test('raster: a TIFF whose IFDs point back in a loop opens all the same, read to the loop and no further', async (assert) => {
    /** A TIFF with the next-IFD offset of its `k`-th IFD pointing back to the first. */
    const looped = (spec, k, name) => {
      const buf = fx.writeTiff(spec);
      const view = new DataView(buf);
      const first = view.getUint32(4, true);
      let at = first;
      for (let i = 0; i < k; i++) at = view.getUint32(at + 2 + view.getUint16(at, true) * 12, true);
      view.setUint32(at + 2 + view.getUint16(at, true) * 12, first, true);
      return new File([buf], name, { type: 'image/tiff' });
    };
    /** The promise, or an error after `ms` (the worker is then stopped, so that the tests after this one can run). */
    const within = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => { engines.stop(); reject(new Error(`no answer in ${ms} ms`)); }, ms))]);
    const self = looped({ width: 16, height: 16, geo: { res: 1, east: E0, north: N0, epsg: 3006 } }, 0, 'ring.tif');
    const info = await within(engines.open(self), 10000);
    assert.deepEqual(info.levels, [{ width: 16, height: 16 }], 'the image itself, once');
    const back = looped({ width: 64, height: 64, overviews: [2], geo: { res: 1, east: E0, north: N0, epsg: 3006 } }, 1, 'ring-oversikt.tif');
    const levels = (await within(engines.open(back), 10000)).levels;
    assert.deepEqual(levels, [{ width: 64, height: 64 }, { width: 32, height: 32 }], 'the overview once, then the loop ends it');
    const meta = track(await within(importer.runFiles([back], { format: 'raster' }, 'Ring'), 20000));
    assert.equal((await datasets.get(meta.id)).raster.files[0].levels.length, 2, 'and it imports');
    return 'ok';
  }, 60000);

  test('raster: importing never keeps the page waiting more than 50 ms', async (assert) => {
    const file = sweref('stor-cog.tif', { width: 2048, height: 1024, tile: 256, overviews: [2, 4], geo: { res: 0.5, east: E0, north: N0, epsg: 3006 } });
    // The worker is started by the tests before; the measure is the import itself.
    await engines.open(file);
    const run = await longestPause(() => importer.runFiles([file], { format: 'raster' }, 'Stor COG'));
    const meta = track(run.value);
    const ds = await datasets.get(meta.id);
    assert.ok(ds.raster.files[0].kept === 'original' && ds.raster.files[0].preview.width > 1000, JSON.stringify(ds.raster.files[0].preview));
    assert.ok(run.longest < 50, `the page never waits more than 50 ms: ${run.longest.toFixed(1)} ms`);
    return `${run.longest.toFixed(1)} ms`;
  }, 90000);

  test('raster: Exportera gives the original byte for byte and the map image as a GeoTIFF in Web Mercator with its attribution beside it', async (assert) => {
    const zip = D.require('platform/storage/zip');
    const file = sweref('en.tif', { copyright: 'Prov AB' });
    const one = track(await importer.runFiles([file], { format: 'raster' }, 'Export ett'));
    const ds = await datasets.get(one.id);
    const own = exporter.formatsFor(ds).filter((f) => f.kind === 'raster');
    assert.deepEqual(own.map((f) => [f.id, f.ext, f.unavailable || '']), [['raster-original', 'tif', ''], ['raster-image', 'zip', '']]);
    const orig = await exporter.exportDataset(one.id, 'raster-original');
    assert.ok(orig.filename === 'en.tif' && orig.blob.type === 'image/tiff' && sameBytes(new Uint8Array(await orig.blob.arrayBuffer()), new Uint8Array(await file.arrayBuffer())), orig.filename);
    // Two originals go in a ZIP.
    const a = sweref('a.tif'); const b = sweref('b.tif', { geo: { res: 1, east: E0 + 64, north: N0, epsg: 3006 } });
    const two = track(await importer.runFiles([a, b], { format: 'raster' }, 'Export två'));
    assert.equal(exporter.formatsFor(await datasets.get(two.id)).find((f) => f.id === 'raster-original').ext, 'zip');
    const both = await exporter.exportDataset(two.id, 'raster-original');
    const parts = await zip.readZip(both.blob);
    assert.ok(both.filename.endsWith('.zip') && sameBytes(parts['a.tif'], new Uint8Array(await a.arrayBuffer())) && sameBytes(parts['b.tif'], new Uint8Array(await b.arrayBuffer())), Object.keys(parts).join(', '));
    // The name asked for comes from the formats of the whole dataset; what is written decides its extension (a selection of one
    // original of several, or the other way round).
    assert.equal((await exporter.exportDataset(one.id, 'raster-original', { filename: 'Export ett.zip' })).filename, 'Export ett.tif');
    assert.equal((await exporter.exportDataset(two.id, 'raster-original', { filename: 'Export två.tif' })).filename, 'Export två.zip');
    // The map image: a GeoTIFF in Web Mercator beside kreditering.txt.
    const image = await exporter.exportDataset(one.id, 'raster-image');
    const inside = await zip.readZip(image.blob);
    assert.deepEqual(Object.keys(inside).sort(), ['en.tif', 'kreditering.txt']);
    assert.ok(zip.text(inside['kreditering.txt']).includes(`${t('raster.field.attribution')}: Prov AB`) && zip.text(inside['kreditering.txt']).includes(`${t('common.source')}: en.tif`), zip.text(inside['kreditering.txt']));
    const G = await pageGeoTiff();
    const tif = await (await G.fromArrayBuffer(inside['en.tif'].slice().buffer)).getImage();
    const f = ds.raster.files[0];
    const [[n, w], [s, e]] = f.preview.bounds;
    const [X0, Y0] = merc(w, s); const [X1, Y1] = merc(e, n);
    const origin = tif.getOrigin(); const res = tif.getResolution();
    assert.ok(tif.getGeoKeys().ProjectedCSTypeGeoKey === 3857 && tif.getSamplesPerPixel() === 4 && tif.getWidth() === f.preview.width, 'Web Mercator, RGBA, the preview\'s size');
    assert.ok(Math.abs(origin[0] - X0) < 1e-3 && Math.abs(origin[1] - Y1) < 1e-3 && Math.abs(res[0] - (X1 - X0) / f.preview.width) < 1e-6 && Math.abs(-res[1] - (Y1 - Y0) / f.preview.height) < 1e-6, `${origin} ${res}`);
    // Without an original, or without a place, the format says what it needs.
    await withLimits({ keepBytes: 1000 }, async () => {
      const none = track(await importer.runFiles([sweref('inget-original.tif')], { format: 'raster' }, 'Inget original'));
      assert.equal(exporter.formatsFor(await datasets.get(none.id)).find((x) => x.id === 'raster-original').unavailable, 'export.needs.original');
    });
    const unplaced = track(await fx.rasterDataset({ name: 'Utan läge', files: [{ name: 'okand.tif' }] }));
    const formats = exporter.formatsFor(await datasets.get(unplaced.id));
    assert.equal(formats.find((x) => x.id === 'raster-image').unavailable, 'export.needs.geometry');
    assert.ok(formats.some((x) => x.id === 'csv' && !x.unavailable), 'the table formats remain');
    return 'ok';
  }, 90000);

  test('raster: the table is the list of files: a deleted row leaves the map, the exports and the copies, and the copy of a selection names only its files', async (assert) => {
    const shareScan = D.require('data/share-scan');
    const recipes = D.require('data/recipes');
    const leaflet = D.require('viz/leaflet');
    const zip = D.require('platform/storage/zip');
    const tiles = ['a', 'b', 'c'].map((x, k) => sweref(`tabell-${x}.tif`, { width: 16, height: 16, geo: { res: 1, east: E0 + 16 * k, north: N0, epsg: 3006 } }));
    const meta = track(await importer.runFiles(tiles, { format: 'raster' }, 'Tabellen styr'));
    await recipes.apply(meta.id, 'delete_rows', { where: "fil = 'tabell-b.tif'" });
    await datasets.flushSaves();
    const ds = await datasets.get(meta.id);
    assert.ok(ds.rowCount === 2 && ds.raster.files.length === 3, 'the facts of the file stay, for an undo');
    assert.ok(kinds.summary(ds).includes(t('raster.files.n', { n: '2' })) && kinds.facts(ds).some((x) => x.label === t('raster.field.files') && x.value === '2'), 'counted by the rows: ' + kinds.summary(ds));
    // The map draws the files the table lists.
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute; left:-10000px; top:0; width:600px; height:400px;';
    document.body.appendChild(el);
    try {
      const hd = await leaflet.render(el, { kind: 'map', name: 'Tabellen styr', map: leaflet.defaultMap(await datasets.columns(meta.id), ds) }, { tileFactory: () => { throw new Error('no tiles'); } });
      assert.deepEqual(Array.from(el.querySelectorAll('img.dm-raster-image')).map((img) => img.getAttribute('alt')).sort(), ['tabell-a.tif', 'tabell-c.tif']);
      assert.equal(hd.info.rasters, 2);
      hd.finalize();
    } finally { el.remove(); }
    // The exports: the originals and the map image of the two.
    const originals = await zip.readZip((await exporter.exportDataset(meta.id, 'raster-original')).blob);
    assert.deepEqual(Object.keys(originals).sort(), ['tabell-a.tif', 'tabell-c.tif']);
    const image = await zip.readZip((await exporter.exportDataset(meta.id, 'raster-image')).blob);
    assert.deepEqual(Object.keys(image).sort(), ['tabell-a.tif', 'tabell-c.tif']);
    // A copy as it is, and a copy of a selection: only the files their rows name, with the facts and the extent of those.
    const files = async (id) => (await dsFiles.list(id)).map((f) => f.kind + '/' + f.name).sort();
    const plain = track(await datasets.importBytes(await shareScan.copy(meta.id, {}), { name: 'Tabellen styr kopia' }, { quiet: true }));
    const p = await datasets.get(plain.id);
    assert.deepEqual(p.raster.files.map((f) => f.name), ['tabell-a.tif', 'tabell-c.tif']);
    assert.ok(p.raster.count === 2 && (await files(plain.id)).every((x) => !x.endsWith('/tabell-b.tif')), JSON.stringify(await files(plain.id)));
    assert.deepEqual(p.source.files.map((f) => f.name), ['tabell-a.tif', 'tabell-c.tif'], 'the source names the two');
    const a = (await (await datasets.ensureOpen(meta.id)).engine.exec("select rowid from data where fil = 'tabell-a.tif'"))[0].values[0][0];
    const bytes = await shareScan.copy(meta.id, { only: [a] });
    const only = track(await datasets.importBytes(bytes, { name: 'Tabellen styr urval' }, { quiet: true }));
    const o = await datasets.get(only.id);
    assert.deepEqual(o.raster.files.map((f) => f.name), ['tabell-a.tif']);
    assert.deepEqual(o.raster.extent, kinds.rasterExtent([ds.raster.files[0]]), 'the extent of the file left');
    assert.deepEqual(await files(only.id), ['original/tabell-a.tif', 'preview/tabell-a.tif', 'thumb/tabell-a.tif']);
    const text = asText(new Uint8Array(bytes));
    assert.ok(!text.includes('tabell-b.tif') && !text.includes('tabell-c.tif'), 'the files left out are named nowhere in the copy');
    assert.deepEqual((await dsFiles.list(meta.id)).length, 9, 'the dataset itself is untouched');
    return 'ok';
  }, 90000);

  test('raster: the review before sharing starts the originals as removed when TIFF tags may name a person, and the copy keeps the pictures without the names', async (assert) => {
    const shareScan = D.require('data/share-scan');
    const file = sweref('dronare.tif', { artist: 'Anna Andersson', hostComputer: 'annas-dator' });
    const meta = track(await importer.runFiles([file], { format: 'raster' }, 'Drönarbild'));
    const handle = await datasets.ensureOpen(meta.id);
    const stored = (await handle.engine.exec("select value from _meta where key = 'raster'"))[0].values[0][0];
    assert.ok(!stored.includes('Anna Andersson') && !stored.includes('annas-dator'), 'the values are never copied out of the file');
    assert.deepEqual(JSON.parse(stored).files[0].tags.personal, ['Artist', 'HostComputer']);
    const found = await shareScan.inspect(meta.id);
    const part = found.parts.find((p) => p.id === 'originals');
    assert.ok(part && part.start === 'remove' && part.names[0] === 'dronare.tif (Artist, HostComputer)', JSON.stringify(part));
    const bytes = await shareScan.copy(meta.id, { originals: true });
    const text = asText(new Uint8Array(bytes));
    assert.ok(!text.includes('Anna Andersson') && !text.includes('annas-dator'), 'neither name is in the copy');
    const copy = track(await datasets.importBytes(bytes, { name: 'Drönarbild kopia' }, { quiet: true }));
    assert.deepEqual((await dsFiles.list(copy.id)).map((f) => f.kind).sort(), ['preview', 'thumb'], 'the pictures stay');
    const c = await datasets.get(copy.id);
    assert.ok(c.kind === 'raster' && c.raster.files[0].kept === 'none' && c.raster.files[0].skipped === 'shared', JSON.stringify(c.raster.files[0]));
    assert.deepEqual((await D.require('data/kind-health').check(copy.id)).map((x) => x.key), ['health.raster.original']);
    assert.ok((await dsFiles.read(meta.id, 'dronare.tif', 'original')), 'the dataset itself is untouched');
    // A file without such tags starts as kept.
    const plain = track(await importer.runFiles([sweref('vanlig.tif')], { format: 'raster' }, 'Vanlig'));
    assert.equal((await shareScan.inspect(plain.id)).parts.find((p) => p.id === 'originals').start, 'keep');
    // GDAL's metadata (an AUTHOR item, written with gdal_translate -mo) can name a person too, and is kept only by its name.
    const gdal = track(await importer.runFiles([sweref('gdal.tif', { tags: [[42112, 2, '<GDALMetadata><Item name="AUTHOR">Provperson Exempel</Item></GDALMetadata>']] })], { format: 'raster' }, 'GDAL-metadata'));
    const g = await datasets.get(gdal.id);
    assert.deepEqual(g.raster.files[0].tags.personal, ['GDAL_METADATA']);
    assert.ok(!JSON.stringify(g.raster).includes('Provperson'), 'the value is never copied out of the file');
    assert.equal((await shareScan.inspect(gdal.id)).parts.find((p) => p.id === 'originals').start, 'remove');
    return 'ok';
  }, 60000);

  test('raster: undo, a version and a package bring the raster back with its facts and files', async (assert) => {
    const recipes = D.require('data/recipes');
    const meta = track(await importer.runFiles([sweref('angra.tif', { copyright: 'Prov AB' })], { format: 'raster' }, 'Ångra raster'));
    const before = JSON.parse(JSON.stringify((await datasets.get(meta.id)).raster));
    const files = (await dsFiles.list(meta.id)).map((f) => f.kind + '/' + f.name);
    const rowid = (await (await datasets.ensureOpen(meta.id)).engine.exec('select rowid from data'))[0].values[0][0];
    await recipes.apply(meta.id, 'edit_cell', { rowid, column: 'kalla', value: 'Någon annan' });
    assert.equal((await rowsOf(meta.id))[0].kalla, 'Någon annan');
    await recipes.undo(meta.id);
    assert.equal((await rowsOf(meta.id))[0].kalla, 'Prov AB', 'undone');
    assert.deepEqual((await datasets.ensureOpen(meta.id)).meta.raster, before, 'the facts after undo');
    const version = await datasets.snapshot(meta.id, 'Före');
    assert.deepEqual(version.facts.raster, before, 'the version says what it holds');
    await recipes.apply(meta.id, 'edit_cell', { rowid, column: 'kalla', value: 'Ännu en' });
    await datasets.restoreVersion(meta.id, version.n);
    assert.equal((await rowsOf(meta.id))[0].kalla, 'Prov AB', 'restored');
    assert.deepEqual((await datasets.get(meta.id)).raster, before, 'the facts after the version');
    assert.deepEqual((await dsFiles.list(meta.id)).map((f) => f.kind + '/' + f.name), files);
    const copy = track(await datasets.importBytes(await datasets.exportBytes(meta.id), { name: 'Raster i paket' }, { quiet: true }));
    const c = await datasets.get(copy.id);
    assert.ok(c.kind === 'raster' && c.raster && typeof c.raster === 'object' && !Array.isArray(c.raster), 'the kind and its facts as data');
    assert.deepEqual(c.raster, before);
    assert.deepEqual((await dsFiles.list(copy.id)).map((f) => f.kind + '/' + f.name), files, 'the files go along');
    return 'ok';
  }, 60000);

  test('raster: the orthophoto shown becomes a raster in Web Mercator with Lantmäteriet\'s attribution and licence, and no key, token or file address', async (assert) => {
    const orthophotos = D.require('viz/orthophotos');
    const tier = D.require('platform/tier');
    const preset = await orthophotos.get('ortho-se');
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')); g.fillStyle = '#6b8f5a'; g.fillRect(0, 0, 300, 200);
    const blob = /** @type {Blob} */ (await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9)));
    const bounds = [[59.3305, 18.0600], [59.3290, 18.0640]];
    const ADDRESS = 'https://dl1.lantmateriet.se/ortofoto/hemlig-fil.tif';
    const result = {
      url: URL.createObjectURL(blob), blob, type: blob.type, bounds, width: 300, height: 200, grid: 3857, resolution: 0.25,
      items: [{ id: 'orto-1', collection: 'orto-x-2025', year: 2025, kind: 'rgbi', res: 0.16, level: 0.32, href: ADDRESS, headers: { Authorization: 'Bearer ortofoto-token' } }],
      years: [2025], attribution: 'Ortofoto © Lantmäteriet (2025)',
    };
    try {
      const meta = track(await raster.fromView(result, { name: 'Sparat ortofoto', preset }));
      const ds = await datasets.get(meta.id);
      const f = ds.raster.files[0];
      assert.ok(ds.kind === 'raster' && f.crs === 'EPSG:3857' && f.placed && f.kept === 'none' && f.skipped === 'view', JSON.stringify(f));
      assert.deepEqual(f.preview.bounds, bounds, 'the image lies where it was shown');
      assert.ok(f.preview.width === 300 && f.preview.height === 200 && f.resolution === 0.25 && f.year === 2025 && f.name === 'ortofoto-2025.jpg', JSON.stringify(f.preview));
      assert.ok(ds.raster.attribution.includes('Ortofoto © Lantmäteriet (2025)') && ds.raster.attribution.includes(t('ortho.se.processed')), ds.raster.attribution);
      assert.ok(ds.raster.license.name === 'CC BY 4.0' && /^https:\/\//.test(ds.raster.license.url) && ds.raster.processed === true, JSON.stringify(ds.raster.license));
      const [row] = await rowsOf(meta.id);
      assert.ok(row.kalla === 'Lantmäteriet' && row.licens === 'CC BY 4.0' && row.ar === 2025 && row.koordinatsystem === geo.crsText('EPSG:3857') && JSON.parse(row.geometri).type === 'Polygon', JSON.stringify(row));
      assert.deepEqual(ds.source.items, [{ id: 'orto-1', collection: 'orto-x-2025', year: 2025 }]);
      assert.ok(ds.source.kind === 'orthophoto' && ds.source.publisher === 'Lantmäteriet' && ds.source.license === 'CC BY 4.0' && ds.source.preset === 'ortho-se' && ds.source.box.length === 4 && ds.source.fetchedAt, JSON.stringify(ds.source));
      const preview = await dsFiles.read(meta.id, f.name, 'preview');
      assert.ok(sameBytes(preview.bytes, new Uint8Array(await blob.arrayBuffer())), 'the image shown, not read again');
      assert.deepEqual((await dsFiles.list(meta.id)).map((x) => x.kind).sort(), ['preview', 'thumb']);
      const text = asText(new Uint8Array(await datasets.exportBytes(meta.id)));
      assert.ok(!['dl1.lantmateriet.se', 'hemlig-fil', 'ortofoto-token', 'Bearer', 'blob:'].some((x) => text.includes(x)), 'no key, token or file address in the file');
      assert.ok(kinds.facts(ds).some((x) => x.label === t('raster.field.attribution') && x.value.includes('(CC BY 4.0)')), 'Hantera names the licence');
      // The kind's map belongs to BIM och GIS.
      await tier.set(1);
      try {
        const err = await failure(raster.fromView(result, { preset }));
        assert.ok(err && err.name === 'TierError', String(err && err.message));
      } finally { await tier.set(3); }
      const nothing = await failure(raster.fromView({ grid: 3006, bounds, blob }, { preset }));
      assert.equal(nothing && nothing.message, t('raster.ortho.none'), 'only an image in Web Mercator');
    } finally { URL.revokeObjectURL(result.url); }
    return 'ok';
  }, 60000);

  test('raster: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 90000);
})();
