// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Lantmäteriet's orthophotos for a small area (decision B-64): the image catalogue of the STAC (`/stac-bild/v1/search`, the
 * collections orto-*-YYYY, CC BY 4.0) is searched for the newest colour images (spektraltyp rgb or rgbi) over a box, and only
 * the window that the box needs is read from the cloud-optimised GeoTIFF files with range requests through geotiff.js (vendor/
 * geotiff), from the overview whose pixel size fits the output. The search needs no key; the files take the key of the preset
 * lantmateriet-stac (Geotorget), which goes only to the file host the preset names, as the height model's tiles do (api/heights).
 * The tiles are decoded one at a time with a pause between them, and the image is drawn in rounds, so the page never waits long.
 * The result is a PNG or JPEG Blob with its address and the corners of the image in WGS 84, in Web Mercator (warped from SWEREF 99
 * TM, for maps in Web Mercator) or in SWEREF 99 TM (for maps in that grid).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
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
    /** Milliseconds of drawing before the page gets a turn. */
    const BUDGET = 12;
    /** Output pixels between two exactly computed points of the warp. */
    const STEP = 16;
    const R = 6378137;

    const pause = () => new Promise((r) => setTimeout(r, 0));
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return ''; } };
    const isAsset = (url) => /^dataspatium-asset:/.test(String(url));
    async function lib() {
      if (!globalThis.GeoTIFF) await D.assets.loadVendorScript('vendor/geotiff/geotiff.js');
      return /** @type {any} */ (globalThis).GeoTIFF;
    }
    /** An error the person can act on, with a code for the caller: outside, large, none, file. */
    function fail(code, message, extra) { const err = /** @type {any} */ (new Error(message)); err.code = code; return Object.assign(err, extra || {}); }

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

    // ---- files --------------------------------------------------------------------------------------------
    /**
     * geotiff.js's client for one file: range requests through the page's fetch without cookies, the key only in `headers`. What
     * went wrong is kept in `failed`, since geotiff.js reports a failed range only as "Request failed".
     */
    function clientFor(url, headers) {
      const client = {
        url,
        /** @type {null|{status?: number, network?: boolean}} */ failed: null,
        async request({ headers: extra = {}, signal } = {}) {
          let res;
          try { res = await globalThis.fetch(url, { headers: Object.assign({}, extra, headers), signal, credentials: 'omit' }); } catch (err) {
            if (!(signal && signal.aborted)) client.failed = { network: true };
            throw err;
          }
          if (!res.ok) client.failed = { status: res.status };
          return { get ok() { return res.ok; }, get status() { return res.status; }, getHeader: (name) => res.headers.get(name), getData: () => res.arrayBuffer() };
        },
      };
      return client;
    }
    /** The error to show for a file that could not be read: a refusal says what the key needs. */
    function fileError(client, err) {
      const f = client.failed;
      if (!f) return err;
      if (f.status === 401 || f.status === 403) return fail('file', D.t('ortho.se.err.file', { status: f.status }), { status: f.status });
      if (f.status) return fail('file', D.t('geodata.err.http', { status: f.status }), { status: f.status });
      return fail('file', D.t('api.err.network', { host: hostOf(client.url) }));
    }
    /**
     * The levels of a file, the full image first and then its overviews (masks left out), each with its pixel size in metres.
     * @param {any} tiff @returns {Promise<Array<{image: any, width: number, height: number, res: number}>>}
     */
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
    /**
     * The level to read for a pixel size in metres: the coarsest whose pixels are at most √2 times the size asked for (the nearest
     * on a scale of halvings), and the full image when even that is too coarse.
     * @param {Array<{res: number}>} levels finest first @param {number} target
     */
    function chooseLevel(levels, target) {
      let pickIndex = 0;
      levels.forEach((l, i) => { if (l.res <= target * Math.SQRT2) pickIndex = i; });
      return pickIndex;
    }
    /**
     * Read one item's part of the box into the mosaic (RGBA in SWEREF 99 TM with its upper left corner at box[0], box[3] and `r`
     * metres per pixel), a tile (or a few small ones) per round.
     */
    async function paintItem(GeoTIFF, item, ctx) {
      const { connector, signal } = ctx;
      const host = hostOf(item.href);
      // The file host was named in the question at the start; another host is asked for on its own.
      if (!isAsset(item.href) && !ctx.named.includes(host)) await consent.require('api', { host });
      const hosts = (connector.files && connector.files.hosts) || [];
      // The key only for the file host the preset names.
      const headers = hosts.includes(host) ? (await auth.apply(connector, { url: item.href, method: 'GET', headers: {} })).headers : {};
      const client = clientFor(item.href, headers);
      try { return await readItem(await GeoTIFF.fromCustomClient(client, { allowFullFile: isAsset(item.href) }), item, ctx); } catch (err) {
        if (signal && signal.aborted) throw err;
        throw fileError(client, err);
      }
    }
    /** The reading of paintItem, from an opened file. */
    async function readItem(tiff, item, ctx) {
      const { box, r, mosaic, Wm, Hm, signal } = ctx;
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
      // Small tiles are read a few at a time, so that a round has some work but stays short.
      const cw = tiled ? tw * Math.max(1, Math.floor(512 / tw)) : tw; const ch = tiled ? th * Math.max(1, Math.floor(512 / th)) : th;
      const nodata = first.getGDALNoData();
      // A level pixel's edge in the mosaic; neighbouring chunks share their edges, so no seam or overlap appears.
      const mx = (x) => Math.round((ox + x * lr - box[0]) / r);
      const my = (y) => Math.round((box[3] - (oy - y * lr)) / r);
      const chunks = [];
      for (let cy = Math.floor(y0 / ch) * ch; cy < y1; cy += ch) for (let cx = tiled ? Math.floor(x0 / cw) * cw : x0; cx < x1; cx += cw) chunks.push([Math.max(x0, cx), Math.max(y0, cy), Math.min(x1, cx + cw), Math.min(y1, cy + ch)]);
      for (const [a0, b0, a1, b1] of chunks) {
        if (signal && signal.aborted) throw new http.ApiError('Avbrutet.', { kind: 'aborted' });
        const mx0 = mx(a0); const my0 = my(b0); const w = mx(a1) - mx0; const hgt = my(b1) - my0;
        if (w > 0 && hgt > 0) {
          const rgb = await image.readRGB({ window: [a0, b0, a1, b1], width: w, height: hgt, interleave: true, signal });
          const shift = rgb instanceof Uint8Array || rgb instanceof Uint8ClampedArray ? 0 : Math.max(0, Number(image.getBitsPerSample ? image.getBitsPerSample(0) : 8) - 8);
          paint(mosaic, Wm, Hm, rgb, mx0, my0, w, hgt, nodata, shift);
        }
        ctx.done++;
        if (ctx.onProgress) ctx.onProgress({ done: ctx.done });
        await pause();
      }
      return { level: level.res, tile: [tw, th] };
    }
    /** Copy RGB pixels into the RGBA mosaic at (mx0, my0); a pixel equal to the file's empty value stays as it was. */
    function paint(mosaic, Wm, Hm, rgb, mx0, my0, w, hgt, nodata, shift) {
      for (let y = 0; y < hgt; y++) {
        const ty = my0 + y;
        if (ty < 0 || ty >= Hm) continue;
        for (let x = 0; x < w; x++) {
          const tx = mx0 + x;
          if (tx < 0 || tx >= Wm) continue;
          const s = (y * w + x) * 3;
          const rr = rgb[s] >> shift; const gg = rgb[s + 1] >> shift; const bb = rgb[s + 2] >> shift;
          if (nodata !== null && rgb[s] === nodata && rgb[s + 1] === nodata && rgb[s + 2] === nodata) continue;
          const d = (ty * Wm + tx) * 4;
          mosaic[d] = rr; mosaic[d + 1] = gg; mosaic[d + 2] = bb; mosaic[d + 3] = 255;
        }
      }
    }
    /**
     * The mosaic warped into an output grid, in rounds: `toSweref(px, py)` gives a pixel's place in the mosaic's pixels, computed
     * exactly every STEP pixels and interpolated between (well under a pixel apart over a few hundred metres).
     */
    async function warp(mosaic, Wm, Hm, W, H, toMosaic, signal) {
      const out = new Uint8ClampedArray(W * H * 4);
      const nx = Math.ceil(W / STEP) + 1; const ny = Math.ceil(H / STEP) + 1;
      const px = (a) => Math.min(a * STEP, W); const py = (b) => Math.min(b * STEP, H);
      const U = new Float64Array(nx * ny); const V = new Float64Array(nx * ny);
      for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) { const uv = toMosaic(px(a), py(b)); U[b * nx + a] = uv[0]; V[b * nx + a] = uv[1]; }
      let t0 = performance.now(); let empty = 0;
      for (let j = 0; j < H; j++) {
        const yc = j + 0.5; const b = Math.min(ny - 2, Math.floor(yc / STEP)); const fy = (yc - py(b)) / (py(b + 1) - py(b));
        for (let i = 0; i < W; i++) {
          const xc = i + 0.5; const a = Math.min(nx - 2, Math.floor(xc / STEP)); const fx = (xc - px(a)) / (px(a + 1) - px(a));
          const k = b * nx + a;
          const u = (U[k] * (1 - fx) + U[k + 1] * fx) * (1 - fy) + (U[k + nx] * (1 - fx) + U[k + nx + 1] * fx) * fy;
          const v = (V[k] * (1 - fx) + V[k + 1] * fx) * (1 - fy) + (V[k + nx] * (1 - fx) + V[k + nx + 1] * fx) * fy;
          const sx = Math.floor(u); const sy = Math.floor(v);
          const d = (j * W + i) * 4;
          if (sx < 0 || sy < 0 || sx >= Wm || sy >= Hm) { empty++; continue; }
          const s = (sy * Wm + sx) * 4;
          out[d] = mosaic[s]; out[d + 1] = mosaic[s + 1]; out[d + 2] = mosaic[s + 2]; out[d + 3] = mosaic[s + 3];
          if (!mosaic[s + 3]) empty++;
        }
        if (performance.now() - t0 > BUDGET) {
          await pause();
          if (signal && signal.aborted) throw new http.ApiError('Avbrutet.', { kind: 'aborted' });
          t0 = performance.now();
        }
      }
      return { pixels: out, empty };
    }
    /** RGBA pixels as an image Blob: JPEG when every pixel is covered, PNG (with its transparent parts) otherwise. */
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
     * large); a refused consent throws the ConsentError.
     * @param {number[]} box [west, south, east, north] in WGS 84
     * @param {{grid?: number, width?: number, height?: number, connector?: any, signal?: AbortSignal, onProgress?: Function, keepPixels?: boolean}} [options]
     *   grid: 3857 (default, the image warped to Web Mercator) or 3006 (SWEREF 99 TM, as the files are); width/height: the output
     *   in pixels (the longest side at most MAX_SIDE, never finer than the files); keepPixels: also return the RGBA pixels (tests)
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
      const mosaic = new Uint8ClampedArray(Wm * Hm * 4);
      const GeoTIFF = await lib();
      const ctx = { box: src, r, mosaic, Wm, Hm, connector, named: hosts, signal: options.signal, done: 0, onProgress: options.onProgress };
      const read = [];
      // Oldest first, so that the newest is drawn last and lies on top.
      for (const item of chosen.slice().reverse()) { const got = await paintItem(GeoTIFF, item, ctx); if (got) read.push(Object.assign({ item }, got)); }
      let pixels; let width; let height; let bounds; let empty = 0;
      if (grid === 3006) {
        // The files' own grid: the mosaic as it is, its corners exact in a map in SWEREF 99 TM.
        pixels = mosaic; width = Wm; height = Hm;
        for (let k = 3; k < mosaic.length; k += 4) if (!mosaic[k]) empty++;
        const nw = geo.swerefToWgs84(src[0], src[3], 3006); const se = geo.swerefToWgs84(src[0] + Wm * r, src[3] - Hm * r, 3006);
        bounds = [[nw[1], nw[0]], [se[1], se[0]]];
      } else {
        // Web Mercator: each output pixel looks up its place in the mosaic, so the image lies right on a web map.
        const warped = await warp(mosaic, Wm, Hm, W, H, (x, y) => {
          const ll = unmerc(target[0] + (x * tw) / W, target[3] - (y * th) / H);
          const en = geo.wgs84ToSweref(ll[0], ll[1]);
          return [(en[0] - src[0]) / r, (src[3] - en[1]) / r];
        }, options.signal);
        pixels = warped.pixels; width = W; height = H; empty = warped.empty;
        bounds = [[n, w], [s, e]];
      }
      const blob = await encode(pixels, width, height, empty);
      const years = Array.from(new Set(read.map((x) => x.item.year).filter(Boolean))).sort((a, b) => b - a);
      const out = {
        url: URL.createObjectURL(blob), blob, type: blob.type, bounds, width, height, grid, resolution: r,
        items: read.map((x) => ({ id: x.item.id, collection: x.item.collection, year: x.item.year, kind: x.item.kind, res: x.item.res, level: x.level })),
        years, attribution: ATTRIBUTION + (years.length ? ` (${years.join(', ')})` : ''),
      };
      if (options.keepPixels) out.pixels = pixels;
      return out;
    }
    /** Let go of an image's address. @param {any} result */
    function release(result) { if (result && result.url) { try { URL.revokeObjectURL(result.url); } catch (_e) { /* already gone */ } } }

    return { CONNECTOR, KINDS, FILTER, MAX_AREA, MAX_SIDE, SWEDEN, ATTRIBUTION, searchUrl, itemsOf, pick, levelsOf, chooseLevel, inSweden, load, release };
  });
})();
