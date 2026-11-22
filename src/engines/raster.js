// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The raster worker (decision B-64): GeoTIFF and cloud-optimised GeoTIFF files that the person chose are read with geotiff.js
 * (vendor/geotiff, loaded only in the worker) in a Blob worker of its own (namespace `raster`), so that nothing is decoded on the
 * page and the page never waits on a tile. The File is posted to the worker as it is; the worker opens it with `fromBlob`, which
 * reads only the slices it needs, and contacts nothing.
 *   - `open` gives what the file says about itself: its size, bands, sample type, levels (the full image and its overviews), its
 *     place (a tiepoint and a pixel scale, or a transformation, and whether it is rotated), the GeoKeys that name its system, the
 *     empty value, an alpha band, its date and copyright, and the names (never the values) of the tags that may name a person.
 *   - `render` paints the level that fits into a mosaic in the file's own grid (RGB, three bands, or one band stretched from 2 to
 *     98 per cent), a chunk of tiles or strips at a time with progress after each, warps it to Web Mercator with the control points
 *     the page computed (as the orthophoto worker of api/orthophoto-cog does) and encodes it with OffscreenCanvas: JPEG when every
 *     pixel is covered, WebP (or PNG where the browser cannot encode WebP) otherwise.
 *   - `write` writes an image as an 8-bit RGBA GeoTIFF in a projected grid (Web Mercator for the map image of Exportera).
 * Without OffscreenCanvas in the worker the page encodes and decodes the pixels instead.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /**
   * The level to read for a pixel size: the coarsest whose pixels are at most √2 times the size asked for (the nearest on a scale
   * of halvings), and the full image when even that is too coarse. A copy of api/orthophoto-cog's; standalone, since the worker gets
   * its source too.
   * @param {Array<{res: number}>} levels finest first @param {number} target
   */
  function chooseLevel(levels, target) {
    let pickIndex = 0;
    levels.forEach((l, i) => { if (l.res <= target * Math.SQRT2) pickIndex = i; });
    return pickIndex;
  }

  /**
   * The raster worker. Standalone (only `chooseLevel` beside it): serialised with Dataspatium.workers.functionSource.
   *   page -> worker  {type: 'open', id, file}   {type: 'render', id, file, spec: {r, Wm, Hm, display, warp, keepPixels}}
   *                   {type: 'write', id, image | pixels+width+height, georef: {epsg, origin, res}}   {type: 'abort', id}
   *   worker -> page  {type: 'progress', id, done, total}   {type: 'done', id, ok: true, info | bytes, mime, width, height, ...}
   *                   {type: 'done', id, ok: false, code: 'compression'|'aborted'|'canvas'|'read', error}
   */
  function dataspatiumRasterWorker() {
    'use strict';
    const jobs = new Map();
    const post = (msg, transfer) => self.postMessage(msg, transfer || []);
    /** Tags that can name a person: only their names leave the worker. */
    const PERSONAL = ['Artist', 'HostComputer', 'ImageDescription', 'DocumentName', 'XMP', 'Exif IFD'];
    /** The GeoKeys that say which system a file is in. */
    const KEYS = ['GTModelTypeGeoKey', 'GTRasterTypeGeoKey', 'GTCitationGeoKey', 'GeographicTypeGeoKey', 'GeogCitationGeoKey', 'ProjectedCSTypeGeoKey', 'PCSCitationGeoKey'];
    /** The side of a chunk read at a time, in level pixels. */
    const CHUNK = 512;
    const abortError = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };
    /** A tag's text without its NUL, cut to `max` characters. */
    const text = (v, max) => (v === undefined || v === null ? '' : String(v).replace(/\u0000/g, ' ').trim().slice(0, max));
    const one = (v) => (v !== null && typeof v === 'object' && typeof v.length === 'number' ? v[0] : v);

    // The full image and its overviews (IFDs marked as reduced, masks left out, with the same samples), finest first.
    async function levelsOf(tiff) {
      const first = await tiff.getImage(0);
      const spp = first.getSamplesPerPixel();
      const count = await tiff.getImageCount();
      const out = [];
      for (let i = 1; i < count; i++) {
        const image = await tiff.getImage(i);
        const sub = Number(image.fileDirectory.NewSubfileType || 0);
        if (!(sub & 1) || (sub & 4) || image.getSamplesPerPixel() !== spp) continue;
        out.push({ image, width: image.getWidth(), height: image.getHeight() });
      }
      return [{ image: first, width: first.getWidth(), height: first.getHeight() }].concat(out.sort((a, b) => b.width - a.width));
    }
    // The place of the upper left corner and the pixel size, from a transformation or a tiepoint with a pixel scale. A grid that is
    // turned or mirrored counts as rotated.
    function georefOf(image) {
      const fd = image.fileDirectory;
      const M = fd.ModelTransformation; const tie = fd.ModelTiepoint; const scale = fd.ModelPixelScale;
      if (M && M.length >= 16) {
        const rotated = M[1] !== 0 || M[4] !== 0 || !(M[0] > 0) || !(M[5] < 0);
        return { georef: 'transformation', rotated, origin: [M[3], M[7]], res: [Math.abs(M[0]), Math.abs(M[5])] };
      }
      if (tie && tie.length >= 6 && scale && scale.length >= 2 && scale[0] > 0 && scale[1] !== 0) {
        const sx = scale[0]; const sy = Math.abs(scale[1]);
        return { georef: 'tiepoint', rotated: scale[1] < 0, origin: [tie[3] - tie[0] * sx, tie[4] + tie[1] * sy], res: [sx, sy] };
      }
      return { georef: null, rotated: false, origin: null, res: null };
    }
    async function openFile(file) {
      const tiff = await self.GeoTIFF.fromBlob(file);
      const levels = await levelsOf(tiff);
      const image = levels[0].image;
      const fd = image.fileDirectory;
      const g = georefOf(image);
      const keys = image.getGeoKeys() || {};
      const geoKeys = {};
      for (const k of KEYS) {
        const v = keys[k];
        if (v === undefined || v === null) continue;
        geoKeys[k] = typeof v === 'string' ? text(v, 200) : Number(one(v));
      }
      const extra = fd.ExtraSamples === undefined ? [] : Array.from(typeof fd.ExtraSamples === 'object' ? fd.ExtraSamples : [fd.ExtraSamples]).map(Number);
      const info = {
        width: levels[0].width, height: levels[0].height, bands: image.getSamplesPerPixel(), bits: Number(one(fd.BitsPerSample)) || 8,
        sampleFormat: Number(one(fd.SampleFormat)) || 1, photometric: fd.PhotometricInterpretation === undefined ? null : Number(fd.PhotometricInterpretation),
        compression: Number(fd.Compression || 1), planar: Number(fd.PlanarConfiguration || 1), tiled: !!image.isTiled,
        levels: levels.map((l) => ({ width: l.width, height: l.height })),
        georef: g.georef, rotated: g.rotated, origin: g.origin, res: g.res, geoKeys,
        pixelIsPoint: geoKeys.GTRasterTypeGeoKey === 2,
        nodata: fd.GDAL_NODATA ? image.getGDALNoData() : null,
        alpha: extra.some((x) => x === 1 || x === 2),
        dateTime: text(fd.DateTime, 40), copyright: text(fd.Copyright, 200),
        personal: PERSONAL.filter((name) => fd[name] !== undefined && fd[name] !== null),
      };
      return { levels, info };
    }
    // RGB(A) samples of a chunk into the RGBA mosaic at (x0, y0); a pixel whose three values equal the empty value stays empty.
    function paint(mosaic, Wm, data, spp, x0, y0, w, h, nodata, shift) {
      for (let y = 0; y < h; y++) {
        let s = y * w * spp; let d = ((y0 + y) * Wm + x0) * 4;
        for (let x = 0; x < w; x++, s += spp, d += 4) {
          const r = data[s]; const g = data[s + 1]; const b = data[s + 2];
          if (nodata !== null && r === nodata && g === nodata && b === nodata) continue;
          mosaic[d] = r >>> shift; mosaic[d + 1] = g >>> shift; mosaic[d + 2] = b >>> shift;
          mosaic[d + 3] = spp > 3 ? data[s + 3] >>> shift : 255;
        }
      }
    }
    // One band from its 2nd to its 98th percentile (of at most a million values) onto 0–255, inverted for MinIsWhite; an empty
    // value stays transparent. Returns the stretch, or null when the band holds no value.
    function stretchGray(values, mosaic, invert) {
      const n = values.length; const step = Math.max(1, Math.floor(n / 1e6));
      const sample = [];
      for (let i = 0; i < n; i += step) { const v = values[i]; if (v === v) sample.push(v); }
      if (!sample.length) return null;
      const sorted = Float64Array.from(sample).sort();
      const at = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
      const min = at(0.02); const max = at(0.98);
      const k = max > min ? 255 / (max - min) : 0;
      for (let i = 0; i < n; i++) {
        const v = values[i];
        if (v !== v) continue;
        let g = k ? (v - min) * k : 128;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        if (invert) g = 255 - g;
        const d = i * 4;
        mosaic[d] = g; mosaic[d + 1] = g; mosaic[d + 2] = g; mosaic[d + 3] = 255;
      }
      return { min, max };
    }
    // The mosaic warped into the output grid: each output pixel's place in the mosaic, interpolated between the page's exactly
    // computed control points `step` pixels apart (api/orthophoto-cog's warp).
    function warp(mosaic, Wm, Hm, spec) {
      const { W, H, step, nx, ny, U, V } = spec;
      const out = new Uint8ClampedArray(W * H * 4);
      const px = (a) => Math.min(a * step, W); const py = (b) => Math.min(b * step, H);
      let empty = 0;
      for (let j = 0; j < H; j++) {
        const yc = j + 0.5; const b = Math.min(ny - 2, Math.floor(yc / step)); const fy = (yc - py(b)) / (py(b + 1) - py(b));
        for (let i = 0; i < W; i++) {
          const xc = i + 0.5; const a = Math.min(nx - 2, Math.floor(xc / step)); const fx = (xc - px(a)) / (px(a + 1) - px(a));
          const k = b * nx + a;
          const u = (U[k] * (1 - fx) + U[k + 1] * fx) * (1 - fy) + (U[k + nx] * (1 - fx) + U[k + nx + 1] * fx) * fy;
          const v = (V[k] * (1 - fx) + V[k + 1] * fx) * (1 - fy) + (V[k + nx] * (1 - fx) + V[k + nx + 1] * fx) * fy;
          const sx = Math.floor(u); const sy = Math.floor(v);
          if (sx < 0 || sy < 0 || sx >= Wm || sy >= Hm) { empty++; continue; }
          const s = (sy * Wm + sx) * 4; const d = (j * W + i) * 4;
          out[d] = mosaic[s]; out[d + 1] = mosaic[s + 1]; out[d + 2] = mosaic[s + 2]; out[d + 3] = mosaic[s + 3];
          if (!mosaic[s + 3]) empty++;
        }
      }
      return { pixels: out, empty };
    }
    // JPEG when every pixel is covered, WebP otherwise (PNG where the browser cannot encode WebP: the blob says which); null
    // without OffscreenCanvas (the page encodes).
    async function encode(pixels, W, H, empty) {
      if (typeof OffscreenCanvas !== 'function') return null;
      try {
        const canvas = new OffscreenCanvas(W, H);
        const g = canvas.getContext('2d');
        if (!g) return null;
        g.putImageData(new ImageData(pixels, W, H), 0, 0);
        const blob = await canvas.convertToBlob(empty ? { type: 'image/webp', quality: 0.85 } : { type: 'image/jpeg', quality: 0.9 });
        return { bytes: await blob.arrayBuffer(), type: blob.type };
      } catch (_e) { return null; }
    }
    async function render(job) {
      const signal = job.controller.signal;
      const spec = job.msg.spec;
      const { levels, info } = await openFile(job.msg.file);
      if (!info.res) throw new Error('The file has no place.');
      const [rx, ry] = info.res;
      const level = chooseLevel(levels.map((l) => ({ res: (rx * info.width) / l.width })), spec.r);
      const lv = levels[level]; const image = lv.image;
      const lrx = (rx * info.width) / lv.width; const lry = (ry * info.height) / lv.height;
      const { r, Wm, Hm } = spec;
      const display = spec.display || { mode: 'rgb' };
      // A level pixel's edge in the mosaic; neighbouring chunks share their edges, so no seam or overlap appears.
      const mx = (a) => Math.min(Wm, Math.round((a * lrx) / r)); const my = (b) => Math.min(Hm, Math.round((b * lry) / r));
      // Tiles a few at a time, strips in bands of whole strips of at least 256 rows.
      const th = image.getTileHeight();
      const cw = image.isTiled ? image.getTileWidth() * Math.max(1, Math.floor(CHUNK / image.getTileWidth())) : lv.width;
      const ch = image.isTiled ? th * Math.max(1, Math.floor(CHUNK / th)) : th * Math.max(1, Math.ceil(256 / th));
      const chunks = [];
      for (let b0 = 0; b0 < lv.height; b0 += ch) for (let a0 = 0; a0 < lv.width; a0 += cw) chunks.push([a0, b0, Math.min(lv.width, a0 + cw), Math.min(lv.height, b0 + ch)]);
      const gray = display.mode === 'gray';
      const mosaic = new Uint8ClampedArray(Wm * Hm * 4);
      const values = gray ? new Float32Array(Wm * Hm).fill(NaN) : null;
      const float32 = info.sampleFormat === 3 && info.bits === 32;
      // The file's empty value as the samples hold it (a float32 band holds it rounded to single precision).
      const given = display.nodata;
      const nodata = given === null || given === undefined || Number.isNaN(given) ? null : float32 ? Math.fround(given) : given;
      let done = 0;
      for (const [a0, b0, a1, b1] of chunks) {
        if (signal.aborted) throw abortError();
        const x0 = mx(a0); const y0 = my(b0); const w = mx(a1) - x0; const h = my(b1) - y0;
        if (w > 0 && h > 0) {
          const opts = { window: [a0, b0, a1, b1], width: w, height: h, interleave: true, signal };
          if (display.mode === 'rgb') {
            const data = await image.readRGB(Object.assign(opts, { enableAlpha: !!display.alpha }));
            const shift = data instanceof Uint8Array || data instanceof Uint8ClampedArray ? 0 : Number(display.shift) || 0;
            paint(mosaic, Wm, data, Math.round(data.length / (w * h)), x0, y0, w, h, nodata, shift);
          } else if (display.mode === 'bands') {
            paint(mosaic, Wm, await image.readRasters(Object.assign(opts, { samples: [0, 1, 2] })), 3, x0, y0, w, h, nodata, 0);
          } else {
            const data = await image.readRasters(Object.assign(opts, { samples: [0] }));
            for (let y = 0; y < h; y++) {
              const d = (y0 + y) * Wm + x0; const s = y * w;
              for (let x = 0; x < w; x++) { const v = data[s + x]; values[d + x] = v === nodata || v !== v ? NaN : v; }
            }
          }
        }
        done++;
        post({ type: 'progress', id: job.id, done, total: chunks.length });
      }
      const stretch = gray ? stretchGray(values, mosaic, !!display.invert) : null;
      let pixels = mosaic; let width = Wm; let height = Hm; let blank = 0;
      if (spec.warp) { const out = warp(mosaic, Wm, Hm, spec.warp); pixels = out.pixels; width = spec.warp.W; height = spec.warp.H; blank = out.empty; } else for (let k = 3; k < mosaic.length; k += 4) if (!mosaic[k]) blank++;
      if (signal.aborted) throw abortError();
      const picture = await encode(pixels, width, height, blank);
      const msg = { type: 'done', id: job.id, ok: true, width, height, empty: blank, stretch, level, bytes: picture ? picture.bytes : null, mime: picture ? picture.type : '', pixels: null };
      const transfer = picture ? [picture.bytes] : [];
      if (!picture || spec.keepPixels) { msg.pixels = pixels.buffer; transfer.push(pixels.buffer); }
      post(msg, transfer);
    }
    async function write(job) {
      const msg = job.msg;
      let rgba; let width; let height;
      if (msg.pixels) { rgba = new Uint8Array(msg.pixels); width = msg.width; height = msg.height; } else {
        if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') throw Object.assign(new Error('canvas'), { code: 'canvas' });
        // The values as the image holds them; a browser that does not take these options decodes it plainly.
        const bitmap = await createImageBitmap(msg.image, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).catch(() => createImageBitmap(msg.image));
        width = bitmap.width; height = bitmap.height;
        const canvas = new OffscreenCanvas(width, height);
        const g = canvas.getContext('2d');
        if (!g) throw Object.assign(new Error('canvas'), { code: 'canvas' });
        g.drawImage(bitmap, 0, 0);
        bitmap.close();
        rgba = new Uint8Array(g.getImageData(0, 0, width, height).data.buffer);
      }
      const georef = msg.georef;
      const written = self.GeoTIFF.writeArrayBuffer(rgba, {
        width, height, BitsPerSample: [8, 8, 8, 8], SamplesPerPixel: 4, PhotometricInterpretation: 2, ExtraSamples: 2,
        ModelPixelScale: [georef.res[0], georef.res[1], 0], ModelTiepoint: [0, 0, 0, georef.origin[0], georef.origin[1], 0],
        GTModelTypeGeoKey: 1, GTRasterTypeGeoKey: 1, ProjectedCSTypeGeoKey: georef.epsg,
      });
      const bytes = written instanceof ArrayBuffer ? written : new Uint8Array(written).slice().buffer;
      post({ type: 'done', id: job.id, ok: true, bytes, width, height }, [bytes]);
    }
    async function open(job) {
      const { info } = await openFile(job.msg.file);
      post({ type: 'done', id: job.id, ok: true, info });
    }
    // What went wrong, for the page's words: a compression geotiff.js has no decoder for, a cancelled job, or another failure.
    function codeOf(err, job) {
      if (job.controller.signal.aborted || (err && err.name === 'AbortError')) return 'aborted';
      if (err && err.code === 'canvas') return 'canvas';
      return /compression|decoder/i.test(String((err && err.message) || err)) ? 'compression' : 'read';
    }
    const RUN = { open, render, write };

    self.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === 'abort') { const job = jobs.get(msg.id); if (job) job.controller.abort(); return; }
      const run = RUN[msg.type];
      if (!run) return;
      const job = { id: msg.id, msg, controller: new AbortController() };
      jobs.set(job.id, job);
      run(job).catch((err) => post({ type: 'done', id: job.id, ok: false, code: codeOf(err, job), error: String((err && err.message) || err) }))
        .finally(() => jobs.delete(job.id));
    };
    self.__dataspatium.ready.then(() => { importScripts('dataspatium-asset://geotiff/worker/geotiff.js'); post({ ready: true }); })
      .catch((err) => post({ ready: false, error: String((err && err.message) || err) }));
  }

  D.define('engines/raster', [], () => {
    /** The geotiff.js build the worker loads (vendor/geotiff, wrapped as text). */
    const WORKER_LIB = 'geotiff/worker/geotiff.js';
    /** Output pixels between two exactly computed points of the warp, as for the orthophotos. */
    const STEP = 64;
    let worker = null; let ready = null; let seq = 0;
    /** Jobs in the worker by id: the promise and the progress hook. */
    const jobs = new Map();
    const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError', code: 'aborted' });

    function ensureWorker() {
      if (ready) return ready;
      D.workers.provider('raster', { initial: async () => [WORKER_LIB] });
      const w = D.workers.create({ namespace: 'raster', source: chooseLevel.toString() + '\n' + D.workers.functionSource(dataspatiumRasterWorker), name: 'raster' });
      worker = w;
      ready = new Promise((resolve, reject) => {
        w.onmessage = (ev) => {
          const msg = ev.data || {};
          if ('ready' in msg) { if (msg.ready) resolve(w); else { reject(new Error('Raster worker: ' + msg.error)); stop(); } return; }
          onMessage(msg);
        };
        w.onerror = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); const err = new Error('Raster worker: ' + ((ev && ev.message) || 'error')); reject(err); stop(err); };
      });
      return ready;
    }
    /** Stop the worker; the jobs in it fail. @param {Error} [err] */
    function stop(err) {
      if (worker) worker.terminate();
      worker = null; ready = null;
      for (const job of jobs.values()) { job.finish(); job.reject(err || abortError()); }
      jobs.clear();
    }
    /** A failed job as an Error with its code: compression, aborted, canvas or read. */
    function errorOf(msg) {
      const err = /** @type {any} */ (new Error(msg.error || 'raster'));
      err.code = msg.code || 'read';
      if (err.code === 'aborted') err.name = 'AbortError';
      return err;
    }
    function onMessage(msg) {
      const job = jobs.get(msg.id);
      if (!job) return;
      if (msg.type === 'progress') { if (job.onProgress) { try { job.onProgress({ done: msg.done, total: msg.total }); } catch (err) { D.log('raster', err); } } return; }
      if (msg.type !== 'done') return;
      jobs.delete(msg.id); job.finish();
      if (msg.ok) job.resolve(msg); else job.reject(errorOf(msg));
    }
    /** Send a job to the worker; `signal` cancels it there, `onProgress({done, total})` follows each chunk. */
    async function call(message, options = {}, transfer = []) {
      if (options.signal && options.signal.aborted) throw abortError();
      const w = await ensureWorker();
      return new Promise((resolve, reject) => {
        const id = ++seq;
        const onAbort = () => { if (worker) worker.postMessage({ type: 'abort', id }); };
        const finish = () => { if (options.signal) options.signal.removeEventListener('abort', onAbort); };
        jobs.set(id, { resolve, reject, finish, onProgress: options.onProgress || null });
        if (options.signal) options.signal.addEventListener('abort', onAbort);
        try { w.postMessage(Object.assign({ id }, message), transfer); } catch (err) { jobs.delete(id); finish(); reject(err); }
      });
    }
    /** RGBA pixels as an image Blob on the page, when the worker has no OffscreenCanvas: JPEG when every pixel is covered, else WebP or PNG. */
    async function encode(pixels, W, H, empty) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas');
      g.putImageData(new ImageData(pixels, W, H), 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, empty ? 'image/webp' : 'image/jpeg', empty ? 0.85 : 0.9));
      canvas.width = 0; canvas.height = 0;
      if (!blob) throw new Error('canvas');
      return /** @type {Blob} */ (blob);
    }
    /** An image's RGBA pixels on the page, when the worker cannot decode it. @param {Blob} image */
    async function decode(image) {
      const bitmap = await createImageBitmap(image, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).catch(() => createImageBitmap(image));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      g.drawImage(bitmap, 0, 0);
      bitmap.close();
      const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
      const out = { pixels: new Uint8Array(data.buffer), width: canvas.width, height: canvas.height };
      canvas.width = 0; canvas.height = 0;
      return out;
    }

    /**
     * What a GeoTIFF file says about itself, read in the worker (see data/raster for the fields).
     * @param {File|Blob} file @returns {Promise<any>} the file's info
     */
    async function open(file) { return (await call({ type: 'open', file })).info; }
    /**
     * The level that fits painted into a mosaic of `Wm` × `Hm` pixels of `r` native units, warped when `warp` holds control points
     * (data/raster controlPoints), and encoded. `display` is data/raster displayOf's; `keepPixels` also gives the RGBA pixels.
     * @param {File|Blob} file
     * @param {{r: number, Wm: number, Hm: number, display: any, warp?: any, keepPixels?: boolean}} spec
     * @param {{signal?: AbortSignal, onProgress?: (p: {done: number, total: number}) => void}} [options]
     * @returns {Promise<{blob: Blob, width: number, height: number, empty: number, stretch: {min: number, max: number}|null, level: number, pixels?: Uint8ClampedArray|null}>}
     */
    async function render(file, spec, options = {}) {
      const transfer = spec.warp ? [spec.warp.U.buffer, spec.warp.V.buffer] : [];
      const done = await call({ type: 'render', file, spec }, options, transfer);
      const pixels = done.pixels ? new Uint8ClampedArray(done.pixels) : null;
      const blob = done.bytes ? new Blob([done.bytes], { type: done.mime }) : await encode(/** @type {Uint8ClampedArray} */ (pixels), done.width, done.height, done.empty);
      const out = { blob, width: done.width, height: done.height, empty: done.empty, stretch: done.stretch || null, level: done.level };
      if (spec.keepPixels) out.pixels = pixels;
      return out;
    }
    /**
     * An image written as an 8-bit RGBA GeoTIFF in a projected grid: `origin` is the upper left corner, `res` the pixel size.
     * @param {Blob} image @param {{epsg: number, origin: number[], res: number[]}} georef @returns {Promise<Uint8Array>}
     */
    async function write(image, georef) {
      let done;
      try { done = await call({ type: 'write', image, georef }); } catch (err) {
        if (!err || err.code !== 'canvas') throw err;
        const decoded = await decode(image);
        done = await call({ type: 'write', pixels: decoded.pixels.buffer, width: decoded.width, height: decoded.height, georef }, {}, [decoded.pixels.buffer]);
      }
      return new Uint8Array(done.bytes);
    }

    return { STEP, WORKER_LIB, chooseLevel, open, render, write, stop };
  });
})();
