// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Lantmäteriet's orthophotos for a small area (decision B-64): the image catalogue of the STAC (`/stac-bild/v1/search`, the
 * collections orto-*-YYYY, CC BY 4.0) is searched for the newest colour images (spektraltyp rgb or rgbi) over a box, and only
 * the window that the box needs is read from the cloud-optimised GeoTIFF files with range requests through geotiff.js (vendor/
 * geotiff), from the overview whose pixel size fits the output. The search needs no key; the files take the key of the preset
 * lantmateriet-stac (Geotorget), which goes only to the file host the preset names, as the height model's tiles do (api/heights).
 * When that host refuses the key's token (401), it takes the person's Geotorget login instead (`files.basic`, api/auth
 * fileLogin): asked once per reading through `options.login` and sent as Basic only to that host.
 *
 * The decoding, the mosaic in SWEREF 99 TM, the warp to Web Mercator and the encoding run in a Blob worker
 * (dataspatiumOrthoWorker), so the page never waits on a tile. The worker fetches nothing itself: each range it needs is asked
 * of the page by the file's index in the job, and the page reads it with the page's fetch (counted in the status bar), the same
 * consent, the same key and no cookies, so the key and the login never reach the worker. The page only answers those requests,
 * computes the warp's control points with data/geo and makes the Blob URL of the bytes the worker hands over.
 * The result is a PNG or JPEG Blob with its address and the corners of the image in WGS 84, in Web Mercator (warped from SWEREF 99
 * TM, for maps in Web Mercator) or in SWEREF 99 TM (for maps in that grid).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /**
   * The level to read for a pixel size in metres: the coarsest whose pixels are at most √2 times the size asked for (the nearest
   * on a scale of halvings), and the full image when even that is too coarse. Standalone: the worker gets its source too.
   * @param {Array<{res: number}>} levels finest first @param {number} target
   */
  function chooseLevel(levels, target) {
    let pickIndex = 0;
    levels.forEach((l, i) => { if (l.res <= target * Math.SQRT2) pickIndex = i; });
    return pickIndex;
  }

  /**
   * The orthophoto worker: reads a job's files with geotiff.js through ranges that the page fetches, paints the mosaic, warps it
   * with the control points the page computed and encodes it with OffscreenCanvas. Standalone (only `chooseLevel` beside it):
   * serialised with Dataspatium.workers.functionSource.
   *   page -> worker  {type: 'job', id, items: [{href, bbox, asset}], box, r, Wm, Hm, warp: null|{W, H, step, nx, ny, U, V}, keepPixels}
   *                   {type: 'range', req, ok, status, headers, data} | {type: 'range', req, network|aborted: true}   {type: 'abort', job}
   *   worker -> page  {type: 'range', job, req, index, range}   {type: 'progress', job, done}
   *                   {type: 'done', job, ok: true, bytes, mime, pixels?, width, height, empty, read} | {type: 'done', job, ok: false, ...}
   */
  function dataspatiumOrthoWorker() {
    'use strict';
    const jobs = new Map();
    const waiting = new Map();
    let seq = 0;
    const post = (msg, transfer) => self.postMessage(msg, transfer || []);
    const abortError = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };

    // geotiff.js's client for one file: each range is asked of the page by the file's index, never by an address. What went
    // wrong is kept in `failed`, since geotiff.js reports a failed range only as "Error fetching data".
    function clientFor(job, index) {
      const client = {
        url: job.items[index].href,
        failed: null,
        request({ headers = {}, signal } = {}) {
          if (signal && signal.aborted) return Promise.reject(abortError());
          const req = ++seq;
          return new Promise((resolve) => { waiting.set(req, resolve); post({ type: 'range', job: job.id, req, index, range: String(headers.Range || headers.range || '') }); })
            .then((res) => {
              if (res.aborted) throw abortError();
              if (res.network) { client.failed = { network: true }; throw new TypeError('Failed to fetch'); }
              if (!res.ok) client.failed = { status: res.status };
              const h = res.headers || {};
              return { ok: !!res.ok, status: res.status, getHeader: (name) => { const v = h[String(name).toLowerCase()]; return v === undefined ? null : v; }, getData: () => Promise.resolve(res.data) };
            });
        },
      };
      return client;
    }
    // The levels of a file, the full image first and then its overviews (masks left out), each with its pixel size in metres.
    async function levelsOf(tiff) {
      const first = await tiff.getImage(0);
      const w0 = first.getWidth();
      const res0 = Math.abs(first.getResolution()[0]);
      const spp = first.getSamplesPerPixel();
      const count = await tiff.getImageCount();
      const out = [];
      for (let i = 0; i < count; i++) {
        const image = i ? await tiff.getImage(i) : first;
        const sub = Number(image.fileDirectory.NewSubfileType || 0);
        if ((sub & 4) || image.getSamplesPerPixel() !== spp) continue;
        out.push({ image, width: image.getWidth(), height: image.getHeight(), res: (res0 * w0) / image.getWidth() });
      }
      return out.sort((a, b) => a.res - b.res);
    }
    // Copy RGB pixels into the RGBA mosaic at (mx0, my0); a pixel equal to the file's empty value stays as it was.
    function paint(mosaic, Wm, Hm, rgb, mx0, my0, w, hgt, nodata, shift) {
      for (let y = 0; y < hgt; y++) {
        const ty = my0 + y;
        if (ty < 0 || ty >= Hm) continue;
        for (let x = 0; x < w; x++) {
          const tx = mx0 + x;
          if (tx < 0 || tx >= Wm) continue;
          const s = (y * w + x) * 3;
          if (nodata !== null && rgb[s] === nodata && rgb[s + 1] === nodata && rgb[s + 2] === nodata) continue;
          const d = (ty * Wm + tx) * 4;
          mosaic[d] = rgb[s] >> shift; mosaic[d + 1] = rgb[s + 1] >> shift; mosaic[d + 2] = rgb[s + 2] >> shift; mosaic[d + 3] = 255;
        }
      }
    }
    // One item's part of the box into the mosaic (RGBA in SWEREF 99 TM, its upper left corner at box[0], box[3], r metres per
    // pixel), a tile (or a few small ones) at a time, with a progress message after each.
    async function readItem(tiff, item, job, mosaic, state) {
      const { box, r, Wm, Hm } = job;
      const signal = job.controller.signal;
      const levels = await levelsOf(tiff);
      const level = levels[chooseLevel(levels, r)];
      const first = levels[0].image;
      const [ox, oy] = first.getOrigin();
      const lr = level.res;
      // The window of the level that the box and the item share, in the level's pixels.
      const minE = Math.max(box[0], item.bbox[0]); const maxE = Math.min(box[2], item.bbox[2]);
      const minN = Math.max(box[1], item.bbox[1]); const maxN = Math.min(box[3], item.bbox[3]);
      if (minE >= maxE || minN >= maxN) return null;
      const x0 = Math.max(0, Math.floor((minE - ox) / lr)); const x1 = Math.min(level.width, Math.ceil((maxE - ox) / lr));
      const y0 = Math.max(0, Math.floor((oy - maxN) / lr)); const y1 = Math.min(level.height, Math.ceil((oy - minN) / lr));
      if (x0 >= x1 || y0 >= y1) return null;
      const image = level.image;
      const tiled = !!image.isTiled;
      const tw = tiled ? image.getTileWidth() : x1 - x0; const th = tiled ? image.getTileHeight() : Math.max(image.getTileHeight(), 256);
      // Small tiles are read a few at a time.
      const cw = tiled ? tw * Math.max(1, Math.floor(512 / tw)) : tw; const ch = tiled ? th * Math.max(1, Math.floor(512 / th)) : th;
      const nodata = first.getGDALNoData();
      // A level pixel's edge in the mosaic; neighbouring chunks share their edges, so no seam or overlap appears.
      const mx = (x) => Math.round((ox + x * lr - box[0]) / r);
      const my = (y) => Math.round((box[3] - (oy - y * lr)) / r);
      const chunks = [];
      for (let cy = Math.floor(y0 / ch) * ch; cy < y1; cy += ch) for (let cx = tiled ? Math.floor(x0 / cw) * cw : x0; cx < x1; cx += cw) chunks.push([Math.max(x0, cx), Math.max(y0, cy), Math.min(x1, cx + cw), Math.min(y1, cy + ch)]);
      for (const [a0, b0, a1, b1] of chunks) {
        if (signal.aborted) throw abortError();
        const mx0 = mx(a0); const my0 = my(b0); const w = mx(a1) - mx0; const hgt = my(b1) - my0;
        if (w > 0 && hgt > 0) {
          const rgb = await image.readRGB({ window: [a0, b0, a1, b1], width: w, height: hgt, interleave: true, signal });
          const shift = rgb instanceof Uint8Array || rgb instanceof Uint8ClampedArray ? 0 : Math.max(0, Number(image.getBitsPerSample ? image.getBitsPerSample(0) : 8) - 8);
          paint(mosaic, Wm, Hm, rgb, mx0, my0, w, hgt, nodata, shift);
        }
        state.done++;
        post({ type: 'progress', job: job.id, done: state.done });
      }
      return { level: level.res, tile: [tw, th] };
    }
    // The mosaic warped into the output grid: each output pixel's place in the mosaic, interpolated between the page's exactly
    // computed control points `step` pixels apart.
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
    // JPEG when every pixel is covered, PNG (with its transparent parts) otherwise; null without OffscreenCanvas (the page encodes).
    async function encode(pixels, W, H, empty) {
      if (typeof OffscreenCanvas !== 'function') return null;
      try {
        const canvas = new OffscreenCanvas(W, H);
        const g = canvas.getContext('2d');
        if (!g) return null;
        g.putImageData(new ImageData(pixels, W, H), 0, 0);
        const blob = await canvas.convertToBlob({ type: empty ? 'image/png' : 'image/jpeg', quality: 0.9 });
        return { bytes: await blob.arrayBuffer(), type: blob.type };
      } catch (_e) { return null; }
    }
    async function run(job) {
      const GeoTIFF = self.GeoTIFF;
      const signal = job.controller.signal;
      const mosaic = new Uint8ClampedArray(job.Wm * job.Hm * 4);
      const state = { done: 0 };
      const read = [];
      for (let i = 0; i < job.items.length; i++) {
        const client = clientFor(job, i);
        let got;
        try { got = await readItem(await GeoTIFF.fromCustomClient(client, { allowFullFile: !!job.items[i].asset }), job.items[i], job, mosaic, state); } catch (err) {
          if (signal.aborted) throw abortError();
          throw Object.assign(new Error(String((err && err.message) || err)), { failed: client.failed, index: i });
        }
        if (got) read.push({ index: i, level: got.level, tile: got.tile });
      }
      let pixels = mosaic; let width = job.Wm; let height = job.Hm; let empty = 0;
      if (job.warp) { const w = warp(mosaic, job.Wm, job.Hm, job.warp); pixels = w.pixels; width = job.warp.W; height = job.warp.H; empty = w.empty; } else for (let k = 3; k < mosaic.length; k += 4) if (!mosaic[k]) empty++;
      if (signal.aborted) throw abortError();
      const image = await encode(pixels, width, height, empty);
      const msg = { type: 'done', job: job.id, ok: true, width, height, empty, read, bytes: image ? image.bytes : null, mime: image ? image.type : '', pixels: null };
      const transfer = image ? [image.bytes] : [];
      if (!image || job.keepPixels) { msg.pixels = pixels.buffer; transfer.push(pixels.buffer); }
      post(msg, transfer);
    }

    self.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === 'range') { const resolve = waiting.get(msg.req); if (resolve) { waiting.delete(msg.req); resolve(msg); } return; }
      if (msg.type === 'abort') { const job = jobs.get(msg.job); if (job) job.controller.abort(); return; }
      if (msg.type !== 'job') return;
      const job = Object.assign({}, msg, { controller: new AbortController() });
      jobs.set(job.id, job);
      run(job).catch((err) => post({ type: 'done', job: job.id, ok: false, aborted: job.controller.signal.aborted, failed: (err && err.failed) || null, index: err && typeof err.index === 'number' ? err.index : -1, error: String((err && err.message) || err) }))
        .finally(() => jobs.delete(job.id));
    };
    self.__dataspatium.ready.then(() => { importScripts('dataspatium-asset://geotiff/worker/geotiff.js'); post({ ready: true }); })
      .catch((err) => post({ ready: false, error: String((err && err.message) || err) }));
  }

  D.define('api/orthophoto-cog', ['data/geo', 'api/connectors', 'api/auth', 'api/http', 'platform/consent'], (geo, connectors, auth, http, consent) => {
    const CONNECTOR = 'lantmateriet-stac';
    const SEARCH_PATH = '/stac-bild/v1/search';
    /** The colour images; cir (infrared) and gra (black and white) are left out. */
    const KINDS = ['rgb', 'rgbi'];
    const FILTER = "spektraltyp IN ('rgb','rgbi')";
    /** Items asked for at a time, newest first: enough for every year over a square kilometre. */
    const LIMIT = 50;
    /** The largest area read, in square metres. */
    const MAX_AREA = 1e6;
    /** The longest side of an image, in pixels. */
    const MAX_SIDE = 2048;
    /** Sweden, with a margin, in degrees [west, south, east, north]. */
    const SWEDEN = [10.9, 55.3, 24.2, 69.1];
    const ATTRIBUTION = 'Ortofoto © Lantmäteriet';
    /**
     * Output pixels between two exactly computed points of the warp. Over at most 1 km² the step from Web Mercator to SWEREF 99
     * TM bends by well under a centimetre between them, and at most 33 × 33 points are computed on the page.
     */
    const STEP = 64;
    /** The geotiff.js build the worker loads (vendor/geotiff, wrapped as text). */
    const WORKER_LIB = 'geotiff/worker/geotiff.js';
    /** A range request as geotiff.js makes it: one span of bytes. */
    const RANGE = /^bytes=\d+-\d+$/;
    const R = 6378137;

    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return ''; } };
    const isAsset = (url) => /^dataspatium-asset:/.test(String(url));
    /** An error the person can act on, with a code for the caller: outside, large, none, file, login. */
    function fail(code, message, extra) { const err = /** @type {any} */ (new Error(message)); err.code = code; return Object.assign(err, extra || {}); }
    const aborted = () => new http.ApiError('Avbrutet.', { kind: 'aborted' });

    // ---- grids --------------------------------------------------------------------------------------------
    const merc = (lon, lat) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
    const unmerc = (x, y) => [(x / R) * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI];
    /**
     * The box in SWEREF 99 TM that covers a box in another grid, from points along its edges, with a margin in metres.
     * @param {(x: number, y: number) => number[]} toLonLat @param {number[]} b [minX, minY, maxX, maxY] @param {number} margin
     */
    function coverSweref(toLonLat, b, margin) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const fx = b[0] + ((b[2] - b[0]) * k) / 8; const fy = b[1] + ((b[3] - b[1]) * k) / 8;
        pts.push([fx, b[1]], [fx, b[3]], [b[0], fy], [b[2], fy]);
      }
      const en = pts.map((p) => { const ll = toLonLat(p[0], p[1]); return geo.wgs84ToSweref(ll[0], ll[1]); });
      return [Math.min(...en.map((p) => p[0])) - margin, Math.min(...en.map((p) => p[1])) - margin, Math.max(...en.map((p) => p[0])) + margin, Math.max(...en.map((p) => p[1])) + margin];
    }
    /** True when a box in degrees [west, south, east, north] meets Sweden. @param {number[]} box */
    function inSweden(box) { return box[2] >= SWEDEN[0] && box[0] <= SWEDEN[2] && box[3] >= SWEDEN[1] && box[1] <= SWEDEN[3]; }

    // ---- catalogue ----------------------------------------------------------------------------------------
    /**
     * The search for the newest colour images over a box in WGS 84 [west, south, east, north]: no key, sorted newest first.
     * @param {any} connector @param {number[]} box @returns {string}
     */
    function searchUrl(connector, box) {
      const endpoint = (connector.endpoints || []).find((e) => e.id === 'bild');
      const base = String(connector.baseUrl || '').replace(/\/+$/, '') + ((endpoint && endpoint.path) || SEARCH_PATH);
      return `${base}?bbox=${box.map((v) => Number(v).toFixed(6)).join(',')}&limit=${LIMIT}&sortby=-datetime&filter-lang=cql2-text&filter=${encodeURIComponent(FILTER)}`;
    }
    const arr = (v) => (Array.isArray(v) && v.length >= 4 && v.every((x) => Number.isFinite(Number(x))) ? v.map(Number) : null);
    /**
     * The items of a search answer that the app can draw: a COG in SWEREF 99 TM with its extent, in colour; newest first.
     * @param {any} answer the GeoJSON of the search
     * @returns {Array<{id: string, collection: string, href: string, bbox: number[], kind: string, res: number|null, year: number|null, datetime: string}>}
     */
    function itemsOf(answer) {
      const out = [];
      for (const f of (answer && answer.features) || []) {
        const a = (f.assets && f.assets.data) || {};
        const p = f.properties || {};
        const bbox = arr(a['proj:bbox']) || arr(p['proj:bbox']);
        const code = String(a['proj:code'] || p['proj:code'] || (p['proj:epsg'] ? 'EPSG:' + p['proj:epsg'] : 'EPSG:3006'));
        const kind = String(p.spektraltyp || '');
        if (typeof a.href !== 'string' || !/^(https:|dataspatium-asset:)/.test(a.href) || !bbox || code !== 'EPSG:3006' || (kind && !KINDS.includes(kind))) continue;
        const datetime = String(p.datetime || p.start_datetime || '');
        out.push({ id: String(f.id || ''), collection: String(f.collection || ''), href: a.href, bbox, kind, res: Number(p.upplosning) || null, year: Number(p.flygar) || Number(datetime.slice(0, 4)) || null, datetime });
      }
      // Newest first, also when a server leaves the order out.
      return out.map((x, i) => [x, i]).sort((a, b) => (b[0].datetime > a[0].datetime ? 1 : b[0].datetime < a[0].datetime ? -1 : a[1] - b[1])).map((x) => x[0]);
    }
    /**
     * The items to draw for a box in SWEREF 99 TM: at points spread over the box, the newest item that covers each; newest first.
     * Where the newest flight ends (a production area's edge), the next newest fills in.
     * @param {any[]} items newest first @param {number[]} box [minE, minN, maxE, maxN]
     */
    function pick(items, box) {
      const chosen = [];
      const N = 5;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const e = box[0] + ((box[2] - box[0]) * (i + 0.5)) / N; const n = box[1] + ((box[3] - box[1]) * (j + 0.5)) / N;
          const hit = items.find((it) => e >= it.bbox[0] && e <= it.bbox[2] && n >= it.bbox[1] && n <= it.bbox[3]);
          if (hit && !chosen.includes(hit)) chosen.push(hit);
        }
      }
      return items.filter((it) => chosen.includes(it));
    }

    // ---- the worker and its ranges ----------------------------------------------------------------------------
    let worker = null; let ready = null; let jobSeq = 0;
    /** Jobs in the worker by id: the files with their keys (on the page only), the signal, the hooks and the promise. */
    const jobs = new Map();
    /** File hosts that refused the key's token in this session and took the login: they get the login first. */
    const loginFirst = new Set();

    function ensureWorker() {
      if (ready) return ready;
      D.workers.provider('geotiff', { initial: async () => [WORKER_LIB] });
      const w = D.workers.create({ namespace: 'geotiff', source: chooseLevel.toString() + '\n' + D.workers.functionSource(dataspatiumOrthoWorker), name: 'orthophoto' });
      worker = w;
      ready = new Promise((resolve, reject) => {
        w.onmessage = (ev) => {
          const msg = ev.data || {};
          if ('ready' in msg) { if (msg.ready) resolve(w); else { reject(new Error('Orthophoto worker: ' + msg.error)); stop(); } return; }
          onMessage(msg);
        };
        w.onerror = (ev) => { const err = new Error('Orthophoto worker: ' + ((ev && ev.message) || 'error')); reject(err); stop(err); };
      });
      return ready;
    }
    /** Stop the worker; the jobs in it fail. @param {Error} [err] */
    function stop(err) {
      if (worker) worker.terminate();
      worker = null; ready = null;
      for (const job of jobs.values()) { job.finish(); job.reject(err || aborted()); }
      jobs.clear();
    }
    function onMessage(msg) {
      const job = jobs.get(msg.job);
      if (!job) return;
      if (msg.type === 'range') serve(job, msg);
      else if (msg.type === 'progress') { if (job.onProgress) { try { job.onProgress({ done: msg.done }); } catch (err) { D.log('orthophoto', err); } } }
      else if (msg.type === 'done') {
        jobs.delete(job.id); job.finish();
        // An image finished after the reading was cancelled is not used.
        if (msg.ok && !(job.signal && job.signal.aborted)) job.resolve(msg); else job.reject(job.error || errorOf(job, msg));
      }
    }
    /** The error to show for a job that failed: a refused file says what the key needs. */
    function errorOf(job, msg) {
      if (msg.aborted || (job.signal && job.signal.aborted)) return aborted();
      const f = msg.failed;
      if (f && (f.status === 401 || f.status === 403)) return fail('file', D.t('ortho.se.err.file', { status: f.status }), { status: f.status });
      if (f && f.status) return fail('file', D.t('geodata.err.http', { status: f.status }), { status: f.status });
      if (f && f.network) return fail('file', D.t('api.err.network', { host: hostOf((job.items[msg.index] || {}).href || '') }));
      return new Error(msg.error || 'orthophoto');
    }
    /**
     * Answer one of the worker's ranges: only a file of the job, by its index, and only one span of bytes; read with the page's
     * fetch, the key or login the page holds, and no cookies. The bytes go back by transfer.
     */
    async function serve(job, msg) {
      const item = job.items[msg.index];
      let answer;
      if (!item || !RANGE.test(String(msg.range))) answer = { ok: false, status: 400, headers: {}, data: null };
      else {
        try { answer = await fetchRange(job, item, String(msg.range)); } catch (err) {
          if (job.signal && job.signal.aborted) answer = { aborted: true };
          else if (err && err.code === 'login') { job.error = job.error || err; answer = { ok: false, status: 401, headers: {}, data: null }; }
          else answer = { network: true };
        }
      }
      if (worker && jobs.has(job.id)) worker.postMessage(Object.assign({ type: 'range', req: msg.req }, answer), answer.data ? [answer.data] : []);
    }
    /** One range of a file: with the key's headers, or the file host's login when that host refused the token. */
    async function fetchRange(job, item, range) {
      const host = hostOf(item.href);
      const get = (login) => globalThis.fetch(item.href, { headers: Object.assign({}, login ? { Authorization: login } : item.headers, { Range: range }), signal: job.signal, credentials: 'omit' });
      let login = loginFirst.has(host) ? auth.fileLogin(job.connector, item.href) : null;
      let res = await get(login);
      if (res.status === 401 && !login && auth.fileLoginHosts(job.connector).includes(host)) {
        login = await loginFor(job, item.href);
        if (!login) throw fail('login', D.t('ortho.se.err.login', { host }), { status: 401 });
        res = await get(login);
        if (res.ok) loginFirst.add(host);
      }
      const headers = {};
      for (const name of ['content-type', 'content-range', 'content-length']) { const v = res.headers.get(name); if (v !== null) headers[name] = v; }
      return { ok: res.ok, status: res.status, headers, data: await res.arrayBuffer() };
    }
    /** The file host's login: the one entered, or asked for once per reading through the caller's `login`; null without it. */
    function loginFor(job, url) {
      const now = auth.fileLogin(job.connector, url);
      if (now || !job.login) return Promise.resolve(now);
      if (!job.asking) job.asking = Promise.resolve().then(() => job.login()).catch((err) => { D.log('orthophoto', err); return false; });
      return job.asking.then((ok) => (ok ? auth.fileLogin(job.connector, url) : null));
    }
    /**
     * Run a job in the worker. `spec` goes to the worker (addresses, boxes, control points); `ctx` stays on the page (the files
     * with their keys, the connector, the signal, the hooks).
     */
    async function inWorker(spec, ctx, transfer) {
      if (ctx.signal && ctx.signal.aborted) throw aborted();
      const w = await ensureWorker();
      return new Promise((resolve, reject) => {
        const id = ++jobSeq;
        const onAbort = () => { if (worker) worker.postMessage({ type: 'abort', job: id }); };
        jobs.set(id, Object.assign({ id, resolve, reject, error: null, asking: null, finish: () => { if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort); } }, ctx));
        if (ctx.signal) ctx.signal.addEventListener('abort', onAbort);
        w.postMessage(Object.assign({ type: 'job', id }, spec), transfer);
      });
    }
    /** RGBA pixels as an image Blob on the page, when the worker has no OffscreenCanvas: JPEG when every pixel is covered, PNG otherwise. */
    async function encode(pixels, W, H, empty) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas');
      g.putImageData(new ImageData(pixels, W, H), 0, 0);
      const type = empty ? 'image/png' : 'image/jpeg';
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
      if (!blob) throw new Error('canvas');
      canvas.width = 0; canvas.height = 0;
      return blob;
    }

    /**
     * The orthophoto of a box, read after consent with the key of the preset lantmateriet-stac. Nothing is contacted without the
     * key (the result is then `{needsKey: true}`), outside Sweden or for a box over MAX_AREA (both throw with `code` outside or
     * large); a refused consent throws the ConsentError. When the file host refuses the token and no login for it is entered,
     * `login` is called once (it resolves true when the person entered one); without it the error has `code` login.
     * @param {number[]} box [west, south, east, north] in WGS 84
     * @param {{grid?: number, width?: number, height?: number, connector?: any, signal?: AbortSignal, onProgress?: Function, login?: () => Promise<boolean>, keepPixels?: boolean}} [options]
     *   grid: 3857 (default, the image warped to Web Mercator) or 3006 (SWEREF 99 TM, as the files are); width/height: the output
     *   in pixels (the longest side at most MAX_SIDE, never finer than the files); onProgress({done}) after each tile read;
     *   keepPixels: also return the RGBA pixels (tests)
     * @returns {Promise<any>} {url, blob, type, bounds: [[lat, lon] north-west, [lat, lon] south-east], width, height, grid,
     *   resolution (metres per pixel read), items, years, attribution} or {needsKey: true}
     */
    async function load(box, options = {}) {
      const [w, s, e, n] = box.map(Number);
      if (![w, s, e, n].every(Number.isFinite) || w >= e || s >= n) throw fail('none', D.t('ortho.se.err.none'));
      if (!inSweden([w, s, e, n])) throw fail('outside', D.t('ortho.se.err.outside'));
      const grid = options.grid === 3006 ? 3006 : 3857;
      // The output box in its grid, and the SWEREF 99 TM box the files are read for.
      const target = grid === 3006 ? coverSweref((x, y) => [x, y], [w, s, e, n], 0) : [...merc(w, s), ...merc(e, n)];
      const toLonLat = grid === 3006 ? (x, y) => geo.swerefToWgs84(x, y, 3006) : unmerc;
      const src0 = coverSweref(toLonLat, target, 0);
      const area = (src0[2] - src0[0]) * (src0[3] - src0[1]);
      if (area > MAX_AREA) {
        const km2 = (v) => D.require('ui/i18n').formatNumber(v / 1e6, { maximumFractionDigits: 1 });
        throw fail('large', D.t('ortho.se.err.large', { area: km2(area), max: km2(MAX_AREA) }), { area });
      }
      const connector = options.connector || (await connectors.get(CONNECTOR));
      if (!connector) throw new Error(D.t('heights.err.noconnector'));
      if (!auth.hasCredentials(connector)) return { needsKey: true };
      // One question for the hosts the reading contacts: the catalogue, the key's token and the file host.
      const url = searchUrl(connector, [w, s, e, n]);
      const hosts = Array.from(new Set([hostOf(url), connector.auth && connector.auth.tokenUrl ? hostOf(connector.auth.tokenUrl) : ''].concat((connector.files && connector.files.hosts) || []).filter(Boolean)));
      await consent.require('api', { host: hostOf(url), label: `${ATTRIBUTION} · STAC · CC BY 4.0 · ${hosts.join(', ')}` });
      const res = await http.request({ url, headers: { Accept: 'application/geo+json, application/json' }, signal: options.signal });
      if (!res.ok) throw http.httpError(res);
      let answer;
      try { answer = JSON.parse(res.text); } catch (_e) { throw fail('none', D.t('ortho.se.err.none')); }
      const chosen = pick(itemsOf(answer), src0);
      if (!chosen.length) throw fail('none', D.t('ortho.se.err.none'));
      // The output size: the longest side asked for (at most MAX_SIDE) and never finer than the finest file.
      const tw = target[2] - target[0]; const th = target[3] - target[1];
      let longest = Math.min(MAX_SIDE, Math.max(Number(options.width) || 0, Number(options.height) || 0) || 1024);
      const finest = Math.min(...chosen.map((it) => it.res || 0.16));
      const ground = Math.max(src0[2] - src0[0], src0[3] - src0[1]);
      if (ground / longest < finest) longest = Math.max(1, Math.round(ground / finest));
      const W = Math.max(1, tw >= th ? longest : Math.round((longest * tw) / th)); const H = Math.max(1, th > tw ? longest : Math.round((longest * th) / tw));
      const r = Math.max(finest, Math.max(src0[2] - src0[0], src0[3] - src0[1]) / Math.max(W, H));
      // The mosaic in SWEREF 99 TM, a pixel of margin around the box so that the warp's edges are covered.
      const src = [src0[0] - r, src0[1] - r, src0[2] + r, src0[3] + r];
      const Wm = Math.ceil((src[2] - src[0]) / r); const Hm = Math.ceil((src[3] - src[1]) / r);
      // Oldest first, so that the newest is drawn last and lies on top.
      const order = chosen.slice().reverse();
      // Each file's key, on the page: a host other than those named at the start is asked for on its own, and the key goes only
      // to the file host the preset names.
      const fileHosts = (connector.files && connector.files.hosts) || [];
      const files = [];
      for (const item of order) {
        const host = hostOf(item.href);
        if (!isAsset(item.href) && !hosts.includes(host)) { await consent.require('api', { host }); hosts.push(host); }
        const headers = fileHosts.includes(host) ? (await auth.apply(connector, { url: item.href, method: 'GET', headers: {} }, { signal: options.signal })).headers : {};
        files.push({ href: item.href, headers });
      }
      // Web Mercator: each output pixel looks up its place in the mosaic, so the image lies right on a web map; the control points
      // are computed here with data/geo, the pixels in the worker.
      let warpSpec = null; const transfer = [];
      if (grid !== 3006) {
        const nx = Math.ceil(W / STEP) + 1; const ny = Math.ceil(H / STEP) + 1;
        const U = new Float64Array(nx * ny); const V = new Float64Array(nx * ny);
        for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
          const x = Math.min(a * STEP, W); const y = Math.min(b * STEP, H);
          const ll = unmerc(target[0] + (x * tw) / W, target[3] - (y * th) / H);
          const en = geo.wgs84ToSweref(ll[0], ll[1]);
          U[b * nx + a] = (en[0] - src[0]) / r; V[b * nx + a] = (src[3] - en[1]) / r;
        }
        warpSpec = { W, H, step: STEP, nx, ny, U, V };
        transfer.push(U.buffer, V.buffer);
      }
      const spec = { items: order.map((it) => ({ href: it.href, bbox: it.bbox, asset: isAsset(it.href) })), box: src, r, Wm, Hm, warp: warpSpec, keepPixels: !!options.keepPixels };
      const done = await inWorker(spec, { items: files, connector, signal: options.signal, onProgress: options.onProgress, login: options.login }, transfer);
      const pixels = done.pixels ? new Uint8ClampedArray(done.pixels) : null;
      const blob = done.bytes ? new Blob([done.bytes], { type: done.mime }) : await encode(/** @type {Uint8ClampedArray} */ (pixels), done.width, done.height, done.empty);
      let bounds;
      if (grid === 3006) {
        // The files' own grid: the mosaic as it is, its corners exact in a map in SWEREF 99 TM.
        const nw = geo.swerefToWgs84(src[0], src[3], 3006); const se = geo.swerefToWgs84(src[0] + Wm * r, src[3] - Hm * r, 3006);
        bounds = [[nw[1], nw[0]], [se[1], se[0]]];
      } else bounds = [[n, w], [s, e]];
      const read = done.read.map((x) => Object.assign({ item: order[x.index] }, x));
      const years = Array.from(new Set(read.map((x) => x.item.year).filter(Boolean))).sort((a, b) => b - a);
      const out = {
        url: URL.createObjectURL(blob), blob, type: blob.type, bounds, width: done.width, height: done.height, grid, resolution: r,
        items: read.map((x) => ({ id: x.item.id, collection: x.item.collection, year: x.item.year, kind: x.item.kind, res: x.item.res, level: x.level })),
        years, attribution: ATTRIBUTION + (years.length ? ` (${years.join(', ')})` : ''),
      };
      if (options.keepPixels) out.pixels = pixels;
      return out;
    }
    /** Let go of an image's address. @param {any} result */
    function release(result) { if (result && result.url) { try { URL.revokeObjectURL(result.url); } catch (_e) { /* already gone */ } } }

    return { CONNECTOR, KINDS, FILTER, MAX_AREA, MAX_SIDE, SWEDEN, ATTRIBUTION, STEP, searchUrl, itemsOf, pick, chooseLevel, inSweden, load, release, stop };
  });
})();
