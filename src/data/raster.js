// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Rasters (decision B-64): one or more GeoTIFF or cloud-optimised GeoTIFF files become one dataset of the kind raster, with one
 * row per file (its size, bands, data type, resolution, system, year, source, licence, bytes and its extent as a GeoJSON polygon
 * in WGS 84) and, in `_files` under the file's name, the original byte for byte (when it is small enough), a preview in Web Mercator
 * for the maps and a thumbnail. What the files hold is read in the raster worker (engines/raster): this module checks a file
 * (a TIFF with a place, not rotated, in a compression the app reads, with overviews when it is large), names its system, works out
 * its footprint, the level to read and the control points of the warp with data/geo (proj4 for the grids data/geo only converts
 * one way), and makes the thumbnail and the dataset. The values of tags that may name a person are never read out of the file:
 * only which of them are there, for the review before sharing.
 * The orthophoto shown on a map is saved the same way (`fromView`), from the image already read, in Web Mercator, with its
 * attribution and licence and without its key; and a raster's map image is written as a GeoTIFF in Web Mercator for Exportera
 * (`geoTiffZip`), with its attribution beside it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/raster', ['data/geo', 'data/datasets', 'data/dataset-files', 'engines/raster', 'io/importers/images', 'platform/tier', 'viz/orthophotos', 'platform/files', 'data/kinds'], (geo, datasets, dsFiles, engines, images, tier, orthophotos, files, kinds) => {
    const t = (key, params) => D.t(key, params);
    /**
     * What `open` in the raster worker reads from a file.
     * @typedef {{width: number, height: number, bands: number, bits: number, sampleFormat: number, photometric: number|null, compression: number,
     *   planar: number, tiled: boolean, levels: Array<{width: number, height: number}>, georef: 'tiepoint'|'transformation'|null, rotated: boolean,
     *   origin: number[]|null, res: number[]|null, geoKeys: Record<string, string|number>, pixelIsPoint: boolean, nodata: number|null, alpha: boolean,
     *   dateTime: string, copyright: string, personal: string[]}} RasterInfo
     *   the full image's size, samples, photometric interpretation and compression; the levels, finest first; the upper left corner
     *   and the pixel size (positive) in the file's units; the GeoKeys that name its system; the empty value (GDAL_NODATA), whether
     *   an extra sample is alpha, the TIFF date and copyright (at most 200 characters) and the names of the tags that may name a person
     * @typedef {{name: string, size: number, type: string, width: number, height: number, bands: number, bits: number, format: 'uint'|'int'|'float',
     *   photometric: number|null, compression: number|null, levels: Array<{width: number, height: number}>, crs: string, crsText: string,
     *   crsSource: 'epsg'|'name'|'assumed'|'unknown', placed: boolean, bbox: number[], res: number[], resolution: number|null,
     *   display: 'rgb'|'bands'|'gray', stretch: {min: number, max: number}|null, nodata: number|null, alpha: boolean, kept: 'original'|'none',
     *   skipped: ''|'size'|'total'|'view'|'shared', preview: {type: string|null, width: number, height: number, bounds: number[][]|null},
     *   year: number|null, tags: {personal: string[]}}} RasterFile
     *   one file of a raster as `_meta.raster.files` keeps it: `bbox` in the file's units (PixelIsPoint shifted half a pixel), the
     *   resolution in ground metres per pixel at the centre (null without a place), what became of the original, and the preview's
     *   type, size and corners ([[north, west], [south, east]] in degrees; null when not placed)
     * @typedef {{version: number, count: number, extent: number[]|null, attribution: string|null, license: {name: string, url?: string}|null,
     *   processed: boolean, skipped: Array<{name: string, code?: string, max?: number, error: string}>, files: RasterFile[]}} RasterMeta
     *   `_meta.raster`: the files, the union of the placed ones [west, south, east, north], the attribution (at most 200 characters)
     *   and licence, whether the pictures were processed from what the provider gave, and the files left out with their words: code
     *   'many' (with the limit `max`) for those over the number a raster holds, else the refusal's code (nogeo, rotated, read, …)
     */
    /** The columns of a raster's table: one row per file. */
    const COLUMNS = [
      { name: 'fil', type: 'text' }, { name: 'bredd', type: 'integer' }, { name: 'hojd', type: 'integer' }, { name: 'band', type: 'integer' },
      { name: 'datatyp', type: 'text' }, { name: 'upplosning', type: 'number', unit: 'm' }, { name: 'koordinatsystem', type: 'text' },
      { name: 'ar', type: 'integer' }, { name: 'kalla', type: 'text' }, { name: 'licens', type: 'text' }, { name: 'storlek', type: 'integer' },
      { name: 'geometri', type: 'text' },
    ];
    /**
     * The limits (tests may change them and put them back): the original kept up to `keepBytes` a file and `totalKeep` a dataset;
     * at most `maxFiles` files a raster; the preview's long side `preview`, or `previewMany` for more than four files; the thumbnail's
     * `thumb`; at most `maxPixels` pixels in the level read; and `quick`, the long side of a level small enough for Inhämta's picture.
     */
    const limits = { keepBytes: kinds.RASTER_KEEP.file, totalKeep: kinds.RASTER_KEEP.total, maxFiles: 16, preview: 2048, previewMany: 1024, thumb: 320, maxPixels: 300e6, quick: 2048 };
    /**
     * The TIFF tags that can name a person (IPTC's By-line, a GDAL item such as AUTHOR, Photoshop's own block among them); data/raster
     * keeps only which of them a file has.
     */
    const PERSONAL = ['Artist', 'HostComputer', 'ImageDescription', 'DocumentName', 'XMP', 'Exif IFD', 'IPTC', 'Photoshop', 'GDAL_METADATA'];
    /** The compressions geotiff.js decodes without loading anything: none, LZW, JPEG, Deflate, PackBits, LERC and WebP. */
    const COMPRESSIONS = [1, 5, 7, 8, 32946, 32773, 34887, 50001];
    const FORMAT = { 1: 'uint', 2: 'int', 3: 'float' };
    const R = 6378137;
    const DEG = Math.PI / 180;
    const merc = (lon, lat) => [R * lon * DEG, R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
    const unmerc = (x, y) => [x / R / DEG, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / DEG];
    const round7 = (x) => Math.round(x * 1e7) / 1e7;
    const isDegrees = (code) => code === 4326 || code === 4258;
    const finite = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    /** [west, south, east, north] from [[north, west], [south, east]]; null for none. */
    const boxOf = (b) => (Array.isArray(b) ? [b[0][1], b[1][0], b[1][1], b[0][0]] : null);
    /** An error the person can act on, with its code (nottiff, nogeo, rotated, compression, overviews, read, many). */
    function fail(code, key, params) { const err = /** @type {any} */ (new Error(t(key, params))); err.code = code; return err; }
    const isAbort = (err) => !!err && (err.name === 'AbortError' || err.code === 'aborted');
    /** An error of the worker in the person's words. */
    function engineError(err, file) {
      if (isAbort(err) || (err && err.code && err.code !== 'read' && err.code !== 'compression' && err.code !== 'canvas')) return err;
      if (err && err.code === 'compression') return fail('compression', 'raster.err.compression', { name: file.name });
      return fail('read', 'raster.err.read', { name: file.name, message: String((err && err.message) || err) });
    }

    /** Throws `raster.err.nottiff` unless the file starts as a TIFF or BigTIFF does. @param {File} file */
    async function sniff(file) {
      const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const little = b[0] === 0x49 && b[1] === 0x49 && (b[2] === 42 || b[2] === 43) && b[3] === 0;
      const big = b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && (b[3] === 42 || b[3] === 43);
      if (!little && !big) throw fail('nottiff', 'raster.err.nottiff', { name: file.name });
      return true;
    }
    /**
     * The box of a file in its own units [minX, minY, maxX, maxY], from its upper left corner and pixel size; for PixelIsPoint the
     * corner is the first pixel's centre, so the box is shifted half a pixel. Null without a place.
     * @param {RasterInfo} info
     */
    function extentOf(info) {
      if (!info.origin || !info.res) return null;
      const [x, y] = info.origin; const [rx, ry] = info.res;
      const minX = info.pixelIsPoint ? x - rx / 2 : x; const maxY = info.pixelIsPoint ? y + ry / 2 : y;
      return [minX, maxY - info.height * ry, minX + info.width * rx, maxY];
    }
    /**
     * The system of a file: its ProjectedCSTypeGeoKey (not 32767, user-defined); its GeographicTypeGeoKey for degrees; a system the
     * citation names (data/geo crsCode); with no system named at all degrees when the box fits them, else SWEREF 99 TM (the app's rule
     * for unnamed systems, `assumed`); anything else is unknown. `placed` says whether the app can convert it.
     * @param {RasterInfo} info @param {number[]|null} bbox
     * @returns {{code: number|null, crs: string, text: string, source: 'epsg'|'name'|'assumed'|'unknown', placed: boolean}}
     */
    function crsOf(info, bbox) {
      const k = (info && info.geoKeys) || {};
      const pcs = Number(k.ProjectedCSTypeGeoKey) || 0; const gcs = Number(k.GeographicTypeGeoKey) || 0; const model = Number(k.GTModelTypeGeoKey) || 0;
      const make = (code, source) => { const crs = 'EPSG:' + code; return { code, crs, text: geo.crsText(crs), source, placed: geo.knownCrs(code) }; };
      if (pcs && pcs !== 32767) return make(pcs, 'epsg');
      if (!pcs && gcs && gcs !== 32767 && model !== 1) return make(gcs, 'epsg');
      const cite = String(k.PCSCitationGeoKey || k.GTCitationGeoKey || (model === 2 ? k.GeogCitationGeoKey || '' : '')).trim();
      const named = cite ? geo.crsCode(cite) : null;
      if (named) return make(named, 'name');
      if (!pcs && !gcs && !k.PCSCitationGeoKey && !k.GTCitationGeoKey && !k.GeogCitationGeoKey) {
        const degrees = !!bbox && bbox.every((v, i) => Math.abs(v) <= (i % 2 ? 90 : 180));
        return make(degrees ? 4326 : 3006, 'assumed');
      }
      // GeoTIFF's code for a user-defined system stands for it when the file has no citation, so that Inhämta can say so.
      const own = cite || 'EPSG:' + (pcs || 32767);
      return { code: null, crs: own, text: geo.crsText(own) || own, source: 'unknown', placed: false };
    }
    /**
     * The extent of a box in its system as a GeoJSON polygon in WGS 84 (8 segments per edge, 7 decimals) and its corners
     * [[north, west], [south, east]]; both null when the system cannot be converted.
     * @param {number[]} bbox @param {string} crs
     */
    function footprint(bbox, crs) {
      const none = { geometry: null, bounds: null };
      if (!bbox) return none;
      const [x0, y0, x1, y1] = bbox; const ring = [];
      for (let k = 0; k < 8; k++) ring.push([x0 + ((x1 - x0) * k) / 8, y0]);
      for (let k = 0; k < 8; k++) ring.push([x1, y0 + ((y1 - y0) * k) / 8]);
      for (let k = 0; k < 8; k++) ring.push([x1 - ((x1 - x0) * k) / 8, y1]);
      for (let k = 0; k < 8; k++) ring.push([x0, y1 - ((y1 - y0) * k) / 8]);
      ring.push([x0, y0]);
      const code = geo.crsCode(crs);
      const native = { type: 'Polygon', coordinates: [ring] };
      const g = isDegrees(code) ? native : geo.toWgs84(native, crs);
      if (!g || !g.coordinates) return none;
      const coords = g.coordinates[0].map((p) => [round7(p[0]), round7(p[1])]);
      if (!coords.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return none;
      const lons = coords.map((p) => p[0]); const lats = coords.map((p) => p[1]);
      return { geometry: { type: 'Polygon', coordinates: [coords] }, bounds: [[Math.max(...lats), Math.min(...lons)], [Math.min(...lats), Math.max(...lons)]] };
    }
    /**
     * Ground metres per pixel at a latitude: the pixel itself in a projected grid, shrunk by the latitude's cosine in Web Mercator
     * and from degrees by the length of a degree; 4 decimals.
     * @param {number|null} code @param {number[]} res @param {number} lat
     */
    function groundResolution(code, res, lat) {
      const rx = Number(res && res[0]) || 0; const c = Math.cos(lat * DEG);
      const m = code === 3857 ? rx * c : isDegrees(code) ? rx * 111320 * c : rx;
      return Math.round(m * 1e4) / 1e4;
    }
    let proj4Loading = null;
    /**
     * The function from degrees [lon, lat] to a grid: SWEREF 99 TM and Web Mercator by data/geo's own formulas, degrees as they are,
     * and every other grid data/geo reads through proj4js (vendor/proj4, loaded once) with data/geo's definition.
     * @param {number} code @returns {Promise<(lon: number, lat: number) => number[]>}
     */
    async function forward(code) {
      if (code === 3006) return (lon, lat) => geo.wgs84ToSweref(lon, lat);
      if (isDegrees(code)) return (lon, lat) => [lon, lat];
      if (code === 3857) return merc;
      const def = geo.proj4Def(code);
      if (!def) throw new Error('raster: no conversion to EPSG:' + code);
      const g = /** @type {any} */ (globalThis);
      if (!g.proj4) {
        if (!proj4Loading) proj4Loading = D.assets.loadVendorScript('vendor/proj4/proj4.js').catch((err) => { proj4Loading = null; throw err; });
        await proj4Loading;
      }
      const p = g.proj4(def);
      return (lon, lat) => p.forward([lon, lat]);
    }
    /** The latitude where Web Mercator ends, as on the maps (Leaflet draws nothing beyond it). */
    const MAX_LAT = 85.0511287798;
    /**
     * The Web Mercator grid over corners in degrees: the longest side at most `side` pixels, and a pixel never finer than the source's
     * ground resolution at the centre in Mercator metres. The corners are cut at Web Mercator's latitudes (a world file reaches the
     * poles, where Mercator has no end), and the grid's own corners are given back; null when nothing of the box is left.
     * @param {number[][]} bounds [[north, west], [south, east]] @param {number|null} groundRes @param {number} side
     */
    function webGrid(bounds, groundRes, side) {
      const n = Math.min(MAX_LAT, bounds[0][0]); const s = Math.max(-MAX_LAT, bounds[1][0]);
      const w = bounds[0][1]; const e = bounds[1][1];
      if (!(n > s) || !(e > w)) return null;
      const [X0, Y0] = merc(w, s); const [X1, Y1] = merc(e, n);
      const c = Math.cos(((s + n) / 2) * DEG);
      const pixel = Math.max(Math.max(X1 - X0, Y1 - Y0) / side, groundRes && groundRes > 0 ? groundRes / c : 0);
      const W = Math.max(1, Math.min(side, Math.round((X1 - X0) / pixel))); const H = Math.max(1, Math.min(side, Math.round((Y1 - Y0) / pixel)));
      return { X0, Y0, X1, Y1, W, H, bounds: [[n, w], [s, e]] };
    }
    /**
     * The warp's control points: for every `STEP` pixels of the Web Mercator grid, where it lies in the mosaic (upper left corner
     * `minX`, `maxY`, `r` units a pixel), computed exactly with `fwd`; the worker interpolates between them.
     * @param {{X0: number, Y0: number, X1: number, Y1: number, W: number, H: number}} grid @param {(lon: number, lat: number) => number[]} fwd
     * @param {{minX: number, maxY: number, r: number}} src
     */
    function controlPoints(grid, fwd, src) {
      const { W, H } = grid; const step = engines.STEP;
      const nx = Math.ceil(W / step) + 1; const ny = Math.ceil(H / step) + 1;
      const U = new Float64Array(nx * ny); const V = new Float64Array(nx * ny);
      for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
        const x = Math.min(a * step, W); const y = Math.min(b * step, H);
        const ll = unmerc(grid.X0 + (x * (grid.X1 - grid.X0)) / W, grid.Y1 - (y * (grid.Y1 - grid.Y0)) / H);
        const p = fwd(ll[0], ll[1]);
        U[b * nx + a] = (p[0] - src.minX) / src.r; V[b * nx + a] = (src.maxY - p[1]) / src.r;
      }
      return { W, H, step, nx, ny, U, V };
    }
    /**
     * How a file is drawn: 'rgb' through geotiff.js readRGB (RGB of 8 or 16 bits, shifted to 8; palette, CMYK, YCbCr and CIELab; one
     * 8-bit band of grey), 'bands' for three or more 8-bit bands without a colour interpretation, else 'gray' (band 0 stretched,
     * inverted for MinIsWhite). Alpha only where an extra sample says so, and the file's empty value in every case.
     * @param {RasterInfo} info @returns {{mode: 'rgb'|'bands'|'gray', alpha: boolean, shift: number, invert: boolean, nodata: number|null}}
     */
    function displayOf(info) {
      const p = info.photometric; const uint = (info.sampleFormat || 1) === 1; const bits = info.bits;
      let mode = 'gray';
      if ([3, 5, 6, 8].includes(Number(p)) || (p === 2 && uint && (bits === 8 || bits === 16)) || ((p === 0 || p === 1) && info.bands === 1 && uint && bits === 8)) mode = 'rgb';
      else if ((p === 0 || p === 1 || p === null) && info.bands >= 3 && uint && bits === 8) mode = 'bands';
      const nodata = typeof info.nodata === 'number' && !Number.isNaN(info.nodata) ? info.nodata : null;
      return { mode: /** @type {any} */ (mode), alpha: mode === 'rgb' && p === 2 && !!info.alpha, shift: mode === 'rgb' && p === 2 && bits === 16 ? 8 : 0, invert: mode === 'gray' && p === 0, nodata };
    }
    /**
     * The mosaic a file is painted into: `r` units a pixel (never finer than the file, the box's longest side at most `side`), its
     * size and the level to read. Throws `raster.err.overviews` when that level has more than `limits.maxPixels` pixels.
     * @param {RasterInfo} info @param {number[]} bbox @param {number} side @param {string} [name]
     */
    function mosaicOf(info, bbox, side, name = '') {
      const rx = info.res[0];
      const bw = bbox[2] - bbox[0]; const bh = bbox[3] - bbox[1];
      const r = Math.max(rx, Math.max(bw, bh) / side);
      const level = engines.chooseLevel(info.levels.map((l) => ({ res: (rx * info.width) / l.width })), r);
      const lv = info.levels[level];
      if (lv.width * lv.height > limits.maxPixels) throw fail('overviews', 'raster.err.overviews', { name, n: D.require('ui/i18n').formatNumber(Math.round((lv.width * lv.height) / 1e6)) });
      // Rounded, so that the file covers every pixel of it (the last one is at most half a pixel wider or narrower).
      return { r, Wm: Math.max(1, Math.round(bw / r)), Hm: Math.max(1, Math.round(bh / r)), level };
    }
    /** The preview's corners, or null for a file that has no place on the map. @param {RasterFile} entry */
    function boundsOf(entry) { return entry && entry.preview && Array.isArray(entry.preview.bounds) ? entry.preview.bounds : null; }

    /** The year of a TIFF date ('YYYY:MM:DD HH:MM:SS'), or null. */
    function yearOf(info) {
      const m = /^(\d{4})[:-]/.exec(String(info.dateTime || ''));
      const y = m ? Number(m[1]) : 0;
      return y >= 1800 && y <= 2200 ? y : null;
    }
    /**
     * A file checked before any pixel is decoded: a TIFF, with a place, not rotated, in a compression the app reads. Returns what it
     * says, its box and its system.
     * @param {File} file
     */
    async function check(file) {
      await sniff(file);
      let info;
      try { info = /** @type {RasterInfo} */ (await engines.open(file)); } catch (err) { throw engineError(err, file); }
      if (!info.georef) throw fail('nogeo', 'raster.err.nogeo', { name: file.name });
      if (info.rotated) throw fail('rotated', 'raster.err.rotated', { name: file.name });
      if (!COMPRESSIONS.includes(info.compression)) throw fail('compression', 'raster.err.compression', { name: file.name });
      const bbox = /** @type {number[]} */ (extentOf(info));
      return { info, bbox, crs: crsOf(info, bbox) };
    }
    /** A file's row of the table. */
    function rowOf(file, info, crs, fp, resolution, year) {
      return [file.name, info.width, info.height, info.bands, (FORMAT[info.sampleFormat] || 'uint') + info.bits, resolution, crs.text || crs.crs || null,
        year, info.copyright || null, null, file.size, fp.geometry ? JSON.stringify(fp.geometry) : null];
    }
    /** A file's entry in `_meta.raster.files`. @returns {RasterFile} */
    function entryOf(file, info, bbox, crs, fp, extra) {
      return {
        name: file.name, size: file.size, type: 'image/tiff', width: info.width, height: info.height, bands: info.bands, bits: info.bits,
        format: /** @type {any} */ (FORMAT[info.sampleFormat] || 'uint'), photometric: info.photometric, compression: info.compression, levels: info.levels,
        crs: crs.crs, crsText: crs.text, crsSource: crs.source, placed: !!fp.geometry, bbox, res: info.res, resolution: extra.resolution,
        display: displayOf(info).mode, stretch: extra.stretch || null, nodata: finite(info.nodata), alpha: !!info.alpha,
        kept: extra.kept, skipped: extra.skipped, preview: extra.preview, year: extra.year, tags: { personal: (info.personal || []).filter((x) => PERSONAL.includes(x)) },
      };
    }
    /** Where a checked file lies: its footprint and ground resolution at the centre (null for both without a place). */
    function placeOf(info, bbox, crs) {
      const fp = crs.placed ? footprint(bbox, crs.crs) : { geometry: null, bounds: null };
      const lat = fp.bounds ? (fp.bounds[0][0] + fp.bounds[1][0]) / 2 : 0;
      return { fp, resolution: fp.bounds ? groundResolution(crs.code, /** @type {number[]} */ (info.res), lat) : null };
    }
    const baseName = (name) => D.require('io/import').baseName(name);

    /** Inhämta's previews, per File. @type {WeakMap<File, Promise<any>>} */
    const previews = new WeakMap();
    /**
     * What Inhämta shows before a file is imported: the file checked as the import checks it (also that it can be read without
     * overviews), its row, its facts as `_meta.raster` would hold them (`kept` predicted from its size) and, when it is small enough
     * to read quickly, a picture of it in its own grid as a data URL. `crs` is the file's system ('' when none was named), so that
     * io/import says before the import that a system the app cannot convert is not drawn.
     * @param {File} file @returns {Promise<any>}
     */
    function preview(file) {
      let p = previews.get(file);
      if (!p) {
        p = makePreview(file);
        previews.set(file, p);
        p.catch(() => previews.delete(file));
      }
      // io/import adds to what it is given: each caller gets its own copy.
      return p.then((x) => Object.assign({}, x, { dataRows: x.dataRows.map((r) => r.slice()), columns: x.columns.slice() }));
    }
    async function makePreview(file) {
      const { info, bbox, crs } = await check(file);
      mosaicOf(info, bbox, limits.preview, file.name);
      const { fp, resolution } = placeOf(info, bbox, crs);
      const kept = file.size <= limits.keepBytes;
      const pictures = []; let stretch = null;
      if (info.levels.some((l) => Math.max(l.width, l.height) <= limits.quick) || file.size <= limits.keepBytes) {
        const m = mosaicOf(info, bbox, limits.thumb, file.name);
        try {
          const out = await engines.render(file, { r: m.r, Wm: m.Wm, Hm: m.Hm, display: displayOf(info), warp: null, keepPixels: false });
          pictures.push(await files.blobToDataUrl(out.blob));
          stretch = out.stretch;
        } catch (err) {
          if (err && err.code === 'compression') throw engineError(err, file);
          D.log('raster', 'picture', err);
        }
      }
      const year = yearOf(info);
      const entry = entryOf(file, info, bbox, crs, fp, { resolution, stretch, year, kept: kept ? 'original' : 'none', skipped: kept ? '' : 'size', preview: { type: null, width: 0, height: 0, bounds: fp.bounds } });
      return {
        kind: 'raster', format: 'raster',
        raster: { version: 1, count: 1, extent: boxOf(fp.bounds), attribution: info.copyright || null, license: null, processed: false, skipped: [], files: [entry] },
        pictures, crs: crs.source === 'assumed' ? '' : crs.crs,
        columns: COLUMNS.map((c) => c.name), declaredTypes: COLUMNS.map((c) => c.type), dataRows: [rowOf(file, info, crs, fp, resolution, year)],
        totalRows: 1, header: true, datasetName: baseName(file.name),
      };
    }

    /**
     * One file read for a raster: checked, the level that fits painted in the worker, warped to Web Mercator when it has a place
     * (Web Mercator itself is drawn as it is), the thumbnail made from the preview, and the original kept when it is at most
     * `limits.keepBytes` and the dataset's originals stay within `limits.totalKeep`.
     * @param {File} file
     * @param {{side?: number, keptSoFar?: number, keepPixels?: boolean, signal?: AbortSignal, onProgress?: (p: {done: number, total: number}) => void}} [options]
     * @returns {Promise<{row: any[], meta: RasterFile, files: Array<{name: string, kind: string, type: string, bytes: Uint8Array}>, keptBytes: number, pixels: Uint8ClampedArray|null, level: number}>}
     */
    async function readFile(file, options = {}) {
      const side = options.side || limits.preview;
      const { info, bbox, crs } = await check(file);
      const m = mosaicOf(info, bbox, side, file.name);
      const { fp, resolution } = placeOf(info, bbox, crs);
      let warp = null; let bounds = null;
      if (fp.geometry && crs.code === 3857) {
        // The file's own grid is the map's: the mosaic is drawn between its corners.
        const nw = unmerc(bbox[0], bbox[3]); const se = unmerc(bbox[2], bbox[1]);
        bounds = [[nw[1], nw[0]], [se[1], se[0]]];
      } else if (fp.geometry && fp.bounds) {
        // A file wholly beyond Web Mercator's latitudes keeps its extent in the table, but has no place on the maps.
        const grid = webGrid(fp.bounds, resolution, side);
        if (grid) {
          warp = controlPoints(grid, await forward(/** @type {number} */ (crs.code)), { minX: bbox[0], maxY: bbox[3], r: m.r });
          bounds = grid.bounds;
        }
      }
      let out;
      try { out = await engines.render(file, { r: m.r, Wm: m.Wm, Hm: m.Hm, display: displayOf(info), warp, keepPixels: !!options.keepPixels }, { signal: options.signal, onProgress: options.onProgress }); } catch (err) { throw engineError(err, file); }
      const bitmap = await createImageBitmap(out.blob);
      let thumb;
      try { thumb = await images.scaled(bitmap, limits.thumb, out.empty ? 'image/png' : 'image/jpeg', 0.85); } finally { bitmap.close(); }
      const kept = file.size <= limits.keepBytes && (options.keptSoFar || 0) + file.size <= limits.totalKeep;
      const year = yearOf(info);
      const list = [];
      if (kept) list.push({ name: file.name, kind: 'original', type: 'image/tiff', bytes: new Uint8Array(await file.arrayBuffer()) });
      list.push({ name: file.name, kind: 'preview', type: out.blob.type, bytes: new Uint8Array(await out.blob.arrayBuffer()) });
      list.push({ name: file.name, kind: 'thumb', type: thumb.type, bytes: thumb.bytes });
      const meta = entryOf(file, info, bbox, crs, fp, {
        resolution, stretch: out.stretch, year, kept: kept ? 'original' : 'none', skipped: kept ? '' : file.size > limits.keepBytes ? 'size' : 'total',
        preview: { type: out.blob.type, width: out.width, height: out.height, bounds },
      });
      return { row: rowOf(file, info, crs, fp, resolution, year), meta, files: list, keptBytes: kept ? file.size : 0, pixels: out.pixels || null, level: out.level };
    }

    /**
     * The files with a name each: a name already taken (the same tile from two folders) gets ' (2)' and on before its extension,
     * so that the rows and the files in `_files` stay apart. The bytes are not copied.
     * @param {File[]} list @returns {File[]}
     */
    function uniqueNames(list) {
      const used = new Set();
      return list.map((f) => {
        let name = f.name;
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name; const ext = dot > 0 ? name.slice(dot) : '';
        for (let k = 2; used.has(name); k++) name = `${stem} (${k})${ext}`;
        used.add(name);
        return name === f.name ? f : new File([f], name, { type: f.type, lastModified: f.lastModified });
      });
    }
    /**
     * One dataset of the kind raster from the files, read one at a time (`progress({file, index, total})` before each): at most
     * `limits.maxFiles`, the rest left out with `raster.err.many` (code 'many', with the limit); a file that cannot be read is left
     * out with its words and their code, and when none can, the first one's error is thrown.
     * @param {File[]} list @param {any} [_options] @param {string} [name] @param {Function} [progress]
     */
    async function importFiles(list, _options = {}, name, progress) {
      const all = uniqueNames(Array.from(list || []));
      const taken = all.slice(0, limits.maxFiles); const rest = all.slice(limits.maxFiles);
      const skipped = rest.map((f) => ({ name: f.name, code: 'many', max: limits.maxFiles, error: t('raster.err.many', { max: limits.maxFiles, n: rest.length }) }));
      const side = taken.length > 4 ? limits.previewMany : limits.preview;
      const items = []; const errors = []; let kept = 0;
      for (let i = 0; i < taken.length; i++) {
        if (progress) progress({ file: taken[i].name, index: i, total: taken.length });
        try {
          const item = await readFile(taken[i], { side, keptSoFar: kept });
          kept += item.keptBytes;
          items.push(item);
        } catch (err) {
          if (isAbort(err)) throw err;
          errors.push(err);
          skipped.push({ name: taken[i].name, code: err && typeof err.code === 'string' && err.code ? err.code : 'read', error: String((err && err.message) || err) });
        }
      }
      if (!items.length) throw errors[0] || new Error(t('import.err.empty'));
      const credits = Array.from(new Set(items.map((x) => x.row[8]).filter(Boolean)));
      return create({
        name: name || (all.length === 1 ? baseName(all[0].name) : t('import.collection.raster', { n: all.length })),
        items, attribution: credits.length ? credits.join('; ') : null, license: null, processed: false, skipped,
        source: { kind: 'files', format: 'raster', files: items.map((x) => ({ name: x.meta.name, size: x.meta.size, type: x.meta.type })), skipped },
      });
    }
    /**
     * The dataset of a raster from its files' rows, entries and `_files`; the extent is the union of the placed files.
     * @param {{name: string, items: Array<{row: any[], meta: RasterFile, files: any[]}>, source?: any, attribution?: string|null, license?: any, processed?: boolean, skipped?: any[]}} input
     */
    function create(input) {
      const entries = input.items.map((x) => x.meta);
      const extent = kinds.rasterExtent(entries);
      /** @type {RasterMeta} */
      const raster = {
        version: 1, count: entries.length, extent, attribution: input.attribution ? String(input.attribution).slice(0, 200) : null, license: input.license || null,
        processed: !!input.processed, skipped: input.skipped || [], files: entries,
      };
      return dsFiles.createDataset({
        name: input.name, kind: 'raster', columns: COLUMNS, rows: input.items.map((x) => x.row), files: [].concat(...input.items.map((x) => x.files)),
        source: input.source || null, meta: { raster }, importOptions: { format: 'raster' },
      });
    }

    /**
     * The orthophoto shown on a map, saved as a raster (decision B-64): the image already read (api/orthophoto-cog, in Web Mercator)
     * is the preview, with a thumbnail; there is no original. The attribution says it was processed for the map, the licence is the
     * preset's, and the source names the provider, the images and the box, but never a key, a token, a login or a file address.
     * Nothing is read again.
     * @param {any} result api/orthophoto-cog load's result in grid 3857 @param {{name?: string, preset?: any}} [options]
     */
    async function fromView(result, options = {}) {
      tier.guard('kind:raster');
      if (!result || !(result.blob instanceof Blob) || Number(result.grid || 3857) !== 3857 || !Array.isArray(result.bounds)) throw new Error(t('raster.ortho.none'));
      const preset = options.preset || (await orthophotos.get('ortho-se'));
      const [[n, w], [s, e]] = result.bounds;
      const years = Array.from(new Set((result.years || []).map(Number).filter(Boolean))).sort((a, b) => b - a);
      const type = result.blob.type || 'image/jpeg';
      const name = `ortofoto-${years.length ? years.join('-') : 'vy'}.${/png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg'}`;
      const [X0, Y0] = merc(w, s); const [X1, Y1] = merc(e, n);
      const width = Number(result.width); const height = Number(result.height);
      const bbox = [X0, Y0, X1, Y1];
      const fp = footprint(bbox, 'EPSG:3857');
      const bitmap = await createImageBitmap(result.blob);
      let thumb;
      try { thumb = await images.scaled(bitmap, limits.thumb, type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85); } finally { bitmap.close(); }
      const license = preset && preset.license ? { name: String(preset.license.name), url: String(preset.license.url || '') } : null;
      const publisher = preset ? String(preset.publisher) : null;
      const resolution = Math.round(Number(result.resolution) * 1e4) / 1e4 || null;
      /** @type {RasterFile} */
      const entry = {
        name, size: result.blob.size, type, width, height, bands: 3, bits: 8, format: 'uint', photometric: 2, compression: null, levels: [{ width, height }],
        crs: 'EPSG:3857', crsText: geo.crsText('EPSG:3857'), crsSource: 'epsg', placed: true, bbox, res: [(X1 - X0) / width, (Y1 - Y0) / height], resolution,
        display: 'rgb', stretch: null, nodata: null, alpha: false, kept: 'none', skipped: 'view',
        preview: { type, width, height, bounds: [[n, w], [s, e]] }, year: years[0] || null, tags: { personal: [] },
      };
      const row = [name, width, height, 3, 'uint8', resolution, entry.crsText, years[0] || null, publisher, license ? license.name : null, result.blob.size, JSON.stringify(fp.geometry)];
      const item = { row, meta: entry, files: [{ name, kind: 'preview', type, bytes: new Uint8Array(await result.blob.arrayBuffer()) }, { name, kind: 'thumb', type: thumb.type, bytes: thumb.bytes }] };
      const source = {
        kind: 'orthophoto', publisher, table: 'Ortofoto' + (years.length ? ' ' + years.join(', ') : ''), license: license ? license.name : null, preset: preset ? preset.id : null,
        items: (result.items || []).map((x) => ({ id: String(x.id || ''), collection: String(x.collection || ''), year: Number(x.year) || null })),
        box: [w, s, e, n], fetchedAt: new Date().toISOString(),
      };
      return create({
        name: options.name || t('raster.ortho.name', { years: years.join(', ') }), items: [item], source, license, processed: true, skipped: [],
        attribution: `${result.attribution || (preset ? preset.attribution : '')}, ${t('ortho.se.processed')}`,
      });
    }

    /** The attribution, the licence with its address and the source, one line each, for `kreditering.txt`; '' when there is neither. */
    function creditText(raster, source) {
      const license = raster.license && raster.license.name ? raster.license.name + (raster.license.url ? ` (${raster.license.url})` : '') : '';
      if (!raster.attribution && !license) return '';
      const from = source && source.publisher ? String(source.publisher) : (raster.files || []).map((f) => f.name).join(', ');
      return [raster.attribution ? `${t('raster.field.attribution')}: ${raster.attribution}` : '', license ? `${t('raster.field.license')}: ${license}` : '', from ? `${t('common.source')}: ${from}` : '']
        .filter(Boolean).join('\r\n') + '\r\n';
    }
    /**
     * A raster's map image for Exportera: the preview of every placed file that the table still lists, written as a GeoTIFF in Web
     * Mercator (`<name>.tif`, 8-bit RGBA) in a ZIP, with `kreditering.txt` beside them when there is an attribution or a licence.
     * @param {string} id @param {any} [meta] the dataset's meta (read when left out) @returns {Promise<Blob>}
     */
    async function geoTiffZip(id, meta) {
      const m = meta && meta.raster ? meta : await datasets.get(id);
      const raster = (m && m.raster) || {};
      const names = await dsFiles.listed(id);
      const files = (raster.files || []).filter((f) => f && (!names || names.has(String(f.name))));
      const out = {};
      for (const f of files) {
        const b = boundsOf(f);
        if (!b || !f.preview.width || !f.preview.height) continue;
        const got = await dsFiles.read(id, f.name, 'preview');
        if (!got) continue;
        const [[n, w], [s, e]] = b;
        const [X0, Y0] = merc(w, s); const [X1, Y1] = merc(e, n);
        const bytes = await engines.write(new Blob([got.bytes], { type: got.type }), { epsg: 3857, origin: [X0, Y1], res: [(X1 - X0) / f.preview.width, (Y1 - Y0) / f.preview.height] });
        const base = String(f.name).replace(/\.[^.]+$/, '') || 'raster';
        let path = base + '.tif';
        for (let k = 2; out[path]; k++) path = `${base}-${k}.tif`;
        out[path] = bytes;
      }
      if (!Object.keys(out).length) throw new Error(t('export.err.nofiles'));
      const credit = creditText(Object.assign({}, raster, { files }), m && m.source);
      if (credit) out['kreditering.txt'] = credit;
      return D.require('platform/storage/zip').createZip(out, { level: 0 });
    }

    return {
      COLUMNS, limits, PERSONAL, COMPRESSIONS, sniff, crsOf, extentOf, footprint, groundResolution, forward, webGrid, controlPoints, displayOf, mosaicOf,
      boundsOf, preview, readFile, importFiles, create, fromView, geoTiffZip, creditText,
    };
  });
})();
