// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Heights from Lantmäteriet's terrain model (G2): points are looked up in the cloud-optimised GeoTIFF tiles of the STAC
 * collection dtm-cog, which a search in the points' area finds, and read pixel by pixel with range requests through
 * geotiff.js (vendor/geotiff, loaded on first use; its worker pool is never used). The key is that of the preset
 * lantmateriet-stac (Geotorget) and goes along only to the file host the preset names. A point outside every tile, or on
 * a tile's empty value, gets no height rather than a wrong one.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/heights', ['data/geo', 'api/connectors', 'api/auth', 'api/runner', 'platform/consent'], (geo, connectors, auth, runner, consent) => {
    const CONNECTOR = 'lantmateriet-stac';
    const COLLECTION = 'dtm-cog';
    /** At most this many points are looked up at a time. */
    const MAX_POINTS = 5000;

    async function lib() {
      if (!globalThis.GeoTIFF) await D.assets.loadVendorScript('vendor/geotiff/geotiff.js');
      return /** @type {any} */ (globalThis).GeoTIFF;
    }
    const parse = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(String(v)); return Array.isArray(a) ? a : null; } catch (_e) { return null; } };

    /**
     * The terrain model's tiles over a box in WGS 84, each with its address and its extent in SWEREF 99 TM.
     * @param {any} connector @param {number[]} box [west, south, east, north]
     * @returns {Promise<Array<{url: string, bbox: number[]}>>}
     */
    async function tiles(connector, box) {
      const endpoint = (connector.endpoints || []).find((e) => e.id === 'hojd');
      if (!endpoint) throw new Error(D.t('heights.err.noconnector'));
      const table = await runner.fetchTable(connector, endpoint, { collections: COLLECTION, bbox: box.map((v) => v.toFixed(6)).join(',') });
      const at = (name) => table.columns.indexOf(name);
      const url = at('asset_data'); const proj = at('proj:bbox'); const wgs = at('bbox');
      return table.rows.map((r) => {
        let bbox = proj >= 0 ? parse(r[proj]) : null;
        // Without the projected extent, the corners of the WGS 84 box give it.
        if (!bbox && wgs >= 0) { const b = parse(r[wgs]); if (b) { const a = geo.wgs84ToSweref(b[0], b[1]); const c = geo.wgs84ToSweref(b[2], b[3]); bbox = [a[0], a[1], c[0], c[1]]; } }
        return { url: url >= 0 ? r[url] : null, bbox };
      }).filter((tile) => typeof tile.url === 'string' && tile.bbox && tile.bbox.length >= 4);
    }

    /**
     * Heights in metres (RH 2000) at points, given in WGS 84 ([lon, lat]) or in SWEREF 99 TM ([east, north]).
     * @param {Array<number[]|null>} points
     * @param {{connector?: any}} [options]
     * @returns {Promise<{heights: Array<number|null>, tiles: number}>}
     */
    async function at(points, options = {}) {
      const connector = options.connector || (await connectors.get(CONNECTOR));
      if (!connector) throw new Error(D.t('heights.err.noconnector'));
      if (points.length > MAX_POINTS) throw new Error(D.t('heights.err.many', { max: MAX_POINTS }));
      const xy = points.map((p) => {
        if (!p || !Number.isFinite(Number(p[0])) || !Number.isFinite(Number(p[1]))) return null;
        const x = Number(p[0]); const y = Number(p[1]);
        return Math.abs(x) > 180 || Math.abs(y) > 90 ? [x, y] : geo.wgs84ToSweref(x, y);
      });
      const heights = points.map(() => null);
      const known = xy.filter(Boolean);
      if (!known.length) return { heights, tiles: 0 };
      const ll = known.map((c) => geo.swerefToWgs84(c[0], c[1], 3006));
      const pad = 0.0005;
      const box = [Math.min(...ll.map((c) => c[0])) - pad, Math.min(...ll.map((c) => c[1])) - pad, Math.max(...ll.map((c) => c[0])) + pad, Math.max(...ll.map((c) => c[1])) + pad];
      const list = await tiles(connector, box);
      const inside = (b, c) => c[0] >= b[0] && c[0] < b[2] && c[1] > b[1] && c[1] <= b[3];
      const byTile = new Map();
      xy.forEach((c, i) => { if (!c) return; const k = list.findIndex((tile) => inside(tile.bbox, c)); if (k >= 0) { if (!byTile.has(k)) byTile.set(k, []); byTile.get(k).push(i); } });
      const GeoTIFF = await lib();
      const hosts = (connector.files && connector.files.hosts) || [];
      for (const [k, indices] of byTile) {
        const tile = list[k];
        const host = new URL(tile.url).host;
        if (!/^dataspatium-asset:/.test(tile.url)) await consent.require('api', { host });
        // The key only for the file host the preset names.
        const headers = hosts.includes(host) ? (await auth.apply(connector, { url: tile.url, method: 'GET', headers: {} })).headers : {};
        const tiff = await GeoTIFF.fromUrl(tile.url, { headers, allowFullFile: true });
        const image = await tiff.getImage();
        const [ox, oy] = image.getOrigin(); const [rx, ry] = image.getResolution();
        const w = image.getWidth(); const h = image.getHeight();
        const nodata = image.getGDALNoData();
        for (const i of indices) {
          const px = Math.floor((xy[i][0] - ox) / rx); const py = Math.floor((xy[i][1] - oy) / ry);
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const r = await image.readRasters({ window: [px, py, px + 1, py + 1], samples: [0] });
          const v = Number(r[0][0]);
          if (!Number.isFinite(v) || (nodata !== null && v === nodata)) continue;
          heights[i] = Math.round(v * 100) / 100;
        }
      }
      return { heights, tiles: byTile.size };
    }

    return { at, tiles, CONNECTOR, MAX_POINTS };
  });
})();
