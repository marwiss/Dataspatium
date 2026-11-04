// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Rows that name pictures: a column of file names that exist in an image collection, such as the photos of collected rows.
 * The link is found from the data, so a table made from a photo inventory gets its pictures as well.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/media', ['data/datasets', 'data/dataset-files'], (datasets, files) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const PICTURE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
    const SEPARATOR = /\s*;\s*/;
    /** @type {Map<string, {key: any, link: any}>} */
    const cache = new Map();

    const namesIn = (value) => String(value === null || value === undefined ? '' : value).split(SEPARATOR).filter((x) => PICTURE.test(x));

    /**
     * Which column names pictures, and in which collection.
     * @param {string} id @returns {Promise<{column: string, albumId: string}|null>}
     */
    async function linkOf(id) {
      const marker = datasets.contentMarker(id);
      const hit = cache.get(id);
      if (hit && hit.key === marker) return hit.link;
      const handle = await datasets.ensureOpen(id);
      let link = null;
      if (handle.meta.kind !== 'images') {
        const albums = (await datasets.list()).filter((d) => d.kind === 'images');
        const own = handle.meta.field && handle.meta.field.imagesId;
        const ordered = albums.slice().sort((a, b) => Number(b.id === own) - Number(a.id === own));
        for (const c of handle.columns.filter((x) => x.type === 'text')) {
          const r = await handle.engine.exec(`select ${q(c.name)} from data where ${q(c.name)} is not null and ${q(c.name)} != '' limit 200`);
          const names = Array.from(new Set((r[0] ? r[0].values : []).flatMap((row) => namesIn(row[0]))));
          if (!names.length) continue;
          for (const album of ordered) {
            const albumHandle = await datasets.ensureOpen(album.id);
            const found = await albumHandle.engine.exec(`select count(*) from data where fil in (${names.map(() => '?').join(',')})`, names);
            if (found[0] && Number(found[0].values[0][0]) > 0) { link = { column: c.name, albumId: album.id }; break; }
          }
          if (link) break;
        }
      }
      cache.set(id, { key: marker, link });
      return link;
    }
    /**
     * The pictures of one row, as thumbnails.
     * @param {string} id @param {(column: string) => any} value reads a column of the row
     * @returns {Promise<Array<{name: string, albumId: string, url: string}>>}
     */
    async function picturesOf(id, value) {
      const link = await linkOf(id);
      if (!link) return [];
      const out = [];
      for (const name of namesIn(value(link.column))) {
        const url = await files.url(link.albumId, name, 'thumb').catch(() => null);
        if (url) out.push({ name, albumId: link.albumId, url });
      }
      return out;
    }

    return { linkOf, picturesOf };
  });
})();
