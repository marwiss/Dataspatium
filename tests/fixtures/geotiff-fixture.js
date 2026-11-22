// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * GeoTIFF files written here for the raster tests (B-64), and raster datasets made without the importer. `writeTiff` writes a
 * little-endian TIFF, as tests/orthophoto-cog.test.js does for Lantmäteriet's files, with what a test asks for: tiles of 16 or
 * strips, 1, 3 or 4 bands of 8, 16 or 32 bits (unsigned, signed or floats), overviews, the place as a tiepoint and a pixel scale
 * or as a transformation, the system as GeoKeys, and the tags the raster reads (GDAL_NODATA, DateTime, Copyright and the ones
 * that may name a person). The samples are always written uncompressed; `compression` only sets the tag. ASCII values are
 * written in UTF-8 with their NUL, as geotiff.js reads them. `rasterDataset` makes a dataset of the kind raster with a JPEG
 * preview and thumbnail drawn on a canvas and `_meta.raster` as data/raster writes it. No personal data.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/fixtures/geotiff', ['data/dataset-files', 'data/datasets'], (dsFiles, _datasets) => {
    const BYTE = 1; const ASCII = 2; const SHORT = 3; const LONG = 4; const UNDEFINED = 7; const FLOAT = 11; const DOUBLE = 12;
    const SIZE = { [BYTE]: 1, [ASCII]: 1, [SHORT]: 2, [LONG]: 4, [UNDEFINED]: 1, [FLOAT]: 4, [DOUBLE]: 8 };
    /** How one sample of each data type is written, little-endian. */
    const SAMPLE = {
      uint8: (v, o, x) => v.setUint8(o, x), uint16: (v, o, x) => v.setUint16(o, x, true), uint32: (v, o, x) => v.setUint32(o, x, true),
      int8: (v, o, x) => v.setInt8(o, x), int16: (v, o, x) => v.setInt16(o, x, true), int32: (v, o, x) => v.setInt32(o, x, true),
      float32: (v, o, x) => v.setFloat32(o, x, true), float64: (v, o, x) => v.setFloat64(o, x, true),
    };
    const SAMPLE_FORMAT = { uint: 1, int: 2, float: 3 };
    /** The columns of a raster's table, the same as data/raster.COLUMNS. */
    const COLUMNS = [
      { name: 'fil', type: 'text' }, { name: 'bredd', type: 'integer' }, { name: 'hojd', type: 'integer' }, { name: 'band', type: 'integer' },
      { name: 'datatyp', type: 'text' }, { name: 'upplosning', type: 'number', unit: 'm' }, { name: 'koordinatsystem', type: 'text' },
      { name: 'ar', type: 'integer' }, { name: 'kalla', type: 'text' }, { name: 'licens', type: 'text' }, { name: 'storlek', type: 'integer' },
      { name: 'geometri', type: 'text' },
    ];
    const ascii = (s) => Array.from(new TextEncoder().encode(String(s))).concat([0]);
    /** @param {DataView} view @param {number} at @param {number} type @param {number[]} values */
    function put(view, at, type, values) {
      values.forEach((v, i) => {
        if (type === SHORT) view.setUint16(at + i * 2, v, true);
        else if (type === LONG) view.setUint32(at + i * 4, v, true);
        else if (type === FLOAT) view.setFloat32(at + i * 4, v, true);
        else if (type === DOUBLE) view.setFloat64(at + i * 8, v, true);
        else view.setUint8(at + i, v);
      });
    }

    /**
     * What a test's GeoTIFF holds. `pixel(x, y, level, factor)` gives the samples of a pixel of a level in that level's own pixels
     * (level 0 is the full image, `factor` its scale: 1, then each overview's); by default red is the column and green the row of
     * the full image, blue 128 and the fourth band 255.
     * @typedef {Object} TiffSpec
     * @property {number} width
     * @property {number} height
     * @property {1|3|4} [bands] 3 by default
     * @property {8|16|32|64} [bits] 8 by default (64 only for floats)
     * @property {'uint'|'int'|'float'} [format] 'uint' by default
     * @property {number} [photometric] 2 (RGB) for three or more bands, else 1 (MinIsBlack)
     * @property {(x: number, y: number, level: number, factor: number) => number[]} [pixel]
     * @property {number[]} [overviews] the overviews' factors, finest first (each an IFD with NewSubfileType 1)
     * @property {number} [tile] the tiles' side, 16 by default
     * @property {number} [strips] rows per strip: strips instead of tiles
     * @property {{res?: number|number[], east?: number, north?: number, epsg?: number, geographic?: number, citation?: string, transformation?: number[]}} [geo]
     *   the upper left corner (`east`, `north`) and the pixel size (`res`, or [rx, ry]) as a tiepoint and a pixel scale, or a
     *   ModelTransformation of 16 numbers; the system as ProjectedCSTypeGeoKey `epsg`, GeographicTypeGeoKey `geographic` (with
     *   GTModelTypeGeoKey 2) or a `citation` (GTCitationGeoKey in GeoAsciiParams, with ProjectedCSTypeGeoKey 32767); none of the
     *   three writes no GeoKeys at all
     * @property {boolean} [pointIsPixel] GTRasterTypeGeoKey 2, PixelIsPoint (`pixelIsPoint` does the same)
     * @property {boolean} [pixelIsPoint]
     * @property {number|string} [nodata] GDAL_NODATA
     * @property {string} [artist]
     * @property {string} [hostComputer]
     * @property {string} [copyright]
     * @property {string} [dateTime] 'YYYY:MM:DD HH:MM:SS'
     * @property {number|number[]} [extraSamples] ExtraSamples, written only when given
     * @property {number} [compression] the Compression tag, 1 by default
     * @property {Array<[number, number, any]>} [tags] more tags as [tag, type, values]; an ASCII value is a string
     */

    /**
     * Write a GeoTIFF. @param {TiffSpec} spec @returns {ArrayBuffer}
     */
    function writeTiff(spec) {
      const bands = spec.bands || 3; const bits = spec.bits || 8; const format = spec.format || 'uint';
      const write = SAMPLE[format + bits];
      if (!write) throw new Error('writeTiff: no samples of ' + format + bits);
      const bps = bits / 8; const T = spec.tile || 16; const R = spec.strips || 0;
      const pixel = spec.pixel || ((x, y, _level, f) => [(x * f) & 255, (y * f) & 255, 128, 255]);
      const levels = [{ width: spec.width, height: spec.height, factor: 1, sub: 0 }]
        .concat((spec.overviews || []).map((f) => ({ width: Math.ceil(spec.width / f), height: Math.ceil(spec.height / f), factor: f, sub: 1 })));
      // The samples first, tile by tile or strip by strip, each on an even offset.
      const parts = []; let offset = 8;
      const chunks = levels.map((lv, k) => {
        const out = [];
        const add = (cw, ch, x0, y0) => {
          const buf = new Uint8Array(cw * ch * bands * bps); const view = new DataView(buf.buffer);
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
            if (x0 + x >= lv.width || y0 + y >= lv.height) continue;
            const v = pixel(x0 + x, y0 + y, k, lv.factor);
            for (let b = 0; b < bands; b++) write(view, ((y * cw + x) * bands + b) * bps, v[b] === undefined ? 0 : v[b]);
          }
          out.push({ offset, length: buf.length }); parts.push(buf); offset += buf.length;
          if (offset % 2) { parts.push(new Uint8Array(1)); offset++; }
        };
        if (R) for (let y0 = 0; y0 < lv.height; y0 += R) add(lv.width, Math.min(R, lv.height - y0), 0, y0);
        else for (let y0 = 0; y0 < lv.height; y0 += T) for (let x0 = 0; x0 < lv.width; x0 += T) add(T, T, x0, y0);
        return out;
      });
      const fill = (v) => new Array(bands).fill(v);
      const photometric = spec.photometric !== undefined ? spec.photometric : bands >= 3 ? 2 : 1;
      const ifds = levels.map((lv, k) => {
        const e = [[254, LONG, [lv.sub]], [256, LONG, [lv.width]], [257, LONG, [lv.height]], [258, SHORT, fill(bits)], [259, SHORT, [spec.compression || 1]],
          [262, SHORT, [photometric]], [277, SHORT, [bands]], [284, SHORT, [1]], [339, SHORT, fill(SAMPLE_FORMAT[format])]];
        const at = chunks[k].map((c) => c.offset); const lengths = chunks[k].map((c) => c.length);
        if (R) e.push([273, LONG, at], [278, LONG, [R]], [279, LONG, lengths]);
        else e.push([322, SHORT, [T]], [323, SHORT, [T]], [324, LONG, at], [325, LONG, lengths]);
        if (spec.extraSamples !== undefined && spec.extraSamples !== null) e.push([338, SHORT, Array.isArray(spec.extraSamples) ? spec.extraSamples : [spec.extraSamples]]);
        if (!k) e.push(...firstTags(spec));
        return e.sort((a, b) => a[0] - b[0]);
      });
      // Then each IFD with the values that do not fit in its entries; the last one points at none.
      const blocks = []; let pos = offset;
      for (const entries of ifds) {
        const head = new DataView(new ArrayBuffer(2 + entries.length * 12 + 4));
        const start = pos; let extra = start + head.byteLength; const extras = [];
        head.setUint16(0, entries.length, true);
        entries.forEach(([tag, type, raw], i) => {
          const values = type === ASCII ? ascii(raw) : Array.from(raw);
          const at = 2 + i * 12; const bytes = SIZE[type] * values.length;
          head.setUint16(at, tag, true); head.setUint16(at + 2, type, true); head.setUint32(at + 4, values.length, true);
          if (bytes <= 4) { put(head, at + 8, type, values); return; }
          const ev = new DataView(new ArrayBuffer(bytes + (bytes % 2)));
          put(ev, 0, type, values); head.setUint32(at + 8, extra, true); extras.push(new Uint8Array(ev.buffer)); extra += ev.byteLength;
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

    /** The tags of the first IFD only: the place, the GeoKeys and the file's texts. @param {TiffSpec} spec */
    function firstTags(spec) {
      const e = []; const g = spec.geo;
      const point = !!(spec.pointIsPixel || spec.pixelIsPoint);
      if (g && g.transformation) e.push([34264, DOUBLE, g.transformation]);
      else if (g && g.res !== undefined) {
        const rx = Array.isArray(g.res) ? g.res[0] : g.res; const ry = Array.isArray(g.res) ? g.res[1] : g.res;
        e.push([33550, DOUBLE, [rx, ry, 0]], [33922, DOUBLE, [0, 0, 0, g.east || 0, g.north || 0, 0]]);
      }
      // GeoKeys as [key, location, count, value]: a location of 0 holds the value itself, 34737 points into GeoAsciiParams.
      const keys = [];
      if (g && g.geographic) keys.push([1024, 0, 1, 2], [2048, 0, 1, g.geographic]);
      else if (g && g.citation) keys.push([1024, 0, 1, 1], [3072, 0, 1, 32767], [1026, 34737, String(g.citation).length + 1, 0]);
      else if (g && g.epsg) keys.push([1024, 0, 1, 1], [3072, 0, 1, g.epsg]);
      if (keys.length || point) keys.push([1025, 0, 1, point ? 2 : 1]);
      if (keys.length) e.push([34735, SHORT, [1, 1, 0, keys.length].concat(...keys.sort((a, b) => a[0] - b[0]))]);
      if (g && g.citation) e.push([34737, ASCII, g.citation + '|']);
      const texts = [[306, spec.dateTime], [315, spec.artist], [316, spec.hostComputer], [33432, spec.copyright], [42113, spec.nodata]];
      for (const [tag, value] of texts) if (value !== undefined && value !== null) e.push([tag, ASCII, String(value)]);
      return e.concat(spec.tags || []);
    }

    /** A GeoTIFF as the person would choose it. @param {TiffSpec} spec @param {string} [name] @returns {File} */
    const file = (spec, name) => new File([writeTiff(spec)], name || 'raster.tif', { type: 'image/tiff' });

    /** A JPEG of one colour, at most `max` pixels on its long side. */
    async function picture(width, height, color, max) {
      const k = Math.min(1, max / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * k)); canvas.height = Math.max(1, Math.round(height * k));
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      ctx.fillStyle = color || '#5b7f4a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const blob = /** @type {Blob} */ (await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9)));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
    }
    const EARTH = 6378137;
    const merc = (lon, lat) => [(EARTH * lon * Math.PI) / 180, EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
    const round7 = (x) => Math.round(x * 1e7) / 1e7;
    /** [west, south, east, north] from [[north, west], [south, east]] (either corner first) or from the box itself; null for none. */
    const boxOf = (b) => (!b ? null : Array.isArray(b[0])
      ? [Math.min(b[0][1], b[1][1]), Math.min(b[0][0], b[1][0]), Math.max(b[0][1], b[1][1]), Math.max(b[0][0], b[1][0])]
      : [b[0], b[1], b[2], b[3]]);

    /**
     * A raster dataset without the importer: each file a row of `COLUMNS`, a JPEG preview (2 048 pixels at most, 1 024 for more
     * than four files) and a 320 pixel thumbnail of its colour in `_files`, and `_meta.raster` as data/raster writes it. A file with
     * `bounds` ([[north, west], [south, east]] or [west, south, east, north] in degrees) is placed in Web Mercator, as a saved
     * orthophoto is; one without is in a system the app cannot convert (EPSG:31467), with no place on the map. Nothing is kept as
     * an original. Returns the dataset's meta, as an importer does.
     * @param {{name: string, files: Array<{name: string, bounds?: any, width?: number, height?: number, color?: string, year?: number}>, attribution?: string, license?: {name: string, url?: string}}} options
     */
    async function rasterDataset(options) {
      const geo = D.require('data/geo');
      const many = options.files.length > 4;
      const attribution = options.attribution ? String(options.attribution).slice(0, 200) : null;
      const license = options.license || null;
      const rows = []; const files = []; const entries = [];
      for (const f of options.files) {
        const width = f.width || 256; const height = f.height || 256;
        const box = boxOf(f.bounds);
        const preview = await picture(width, height, f.color, many ? 1024 : 2048);
        const thumb = await picture(width, height, f.color, 320);
        const crs = box ? 'EPSG:3857' : 'EPSG:31467';
        const [x0, y0] = box ? merc(box[0], box[1]) : [3500000, 5800000];
        const [x1, y1] = box ? merc(box[2], box[3]) : [x0 + width, y0 + height];
        const res = [(x1 - x0) / width, (y1 - y0) / height];
        const resolution = box ? Math.round(res[0] * Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180) * 1e4) / 1e4 : null;
        const ring = box ? [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]], [box[0], box[1]]].map((p) => p.map(round7)) : null;
        entries.push({
          name: f.name, size: preview.bytes.byteLength, type: 'image/tiff', width, height, bands: 3, bits: 8, format: 'uint', photometric: 2, compression: 1,
          levels: [{ width, height }], crs, crsText: geo.crsText(crs), crsSource: 'epsg', placed: !!box,
          bbox: [x0, y0, x1, y1], res, resolution, display: 'rgb', stretch: null, nodata: null, alpha: false, kept: 'none', skipped: 'view',
          preview: { type: 'image/jpeg', width: preview.width, height: preview.height, bounds: box ? [[box[3], box[0]], [box[1], box[2]]] : null },
          year: f.year || null, tags: { personal: [] },
        });
        rows.push([f.name, width, height, 3, 'uint8', resolution, geo.crsText(crs), f.year || null, attribution, license ? license.name : null, preview.bytes.byteLength,
          ring ? JSON.stringify({ type: 'Polygon', coordinates: [ring] }) : null]);
        files.push({ name: f.name, kind: 'preview', type: 'image/jpeg', bytes: preview.bytes }, { name: f.name, kind: 'thumb', type: 'image/jpeg', bytes: thumb.bytes });
      }
      const boxes = entries.filter((x) => x.placed).map((x) => boxOf(x.preview.bounds));
      const extent = boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : null;
      const raster = { version: 1, count: entries.length, extent, attribution, license, processed: false, skipped: [], files: entries };
      return dsFiles.createDataset({
        name: options.name, kind: 'raster', columns: COLUMNS, rows, files,
        source: { kind: 'files', format: 'raster', files: entries.map((x) => ({ name: x.name, size: x.size, type: x.type })), skipped: [] },
        meta: { raster }, importOptions: { format: 'raster' },
      });
    }

    return { COLUMNS, writeTiff, file, rasterDataset };
  });
})();
