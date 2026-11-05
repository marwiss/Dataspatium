// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A picture of a dataset for its page in Hantera: the first page of a document, a small map of its places, a network, a line
 * over time, what a model is made of. A plain table has none, and a picture collection shows its pictures anyway. It is drawn
 * after the page, and a failure only means that there is no picture.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/dataset-picture', ['ui/base', 'data/datasets', 'data/kinds', 'data/facets', 'viz/leaflet', 'ui/kinds/sketches'], (base, datasets, kinds, facets, leaflet, sketches) => {
    const { h, t, replace } = base;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const MAP_ROWS = 1500;
    const PAGE_WIDTH = 220;
    const LINE_POINTS = 300;
    /** Rendered first pages, since opening a PDF is not free. @type {Map<string, {key: any, url: string}>} */
    const pages = new Map();

    const valuesOf = (res) => (res[0] ? res[0].values : []);

    async function page(ds, handle) {
      const first = (ds.documents || [])[0];
      if (first && /\.pdf$/i.test(first.name || '')) {
        const key = datasets.contentMarker(ds.id);
        let hit = pages.get(ds.id);
        if (!hit || hit.key !== key) {
          const file = await D.require('data/dataset-files').read(ds.id, first.name, 'original');
          if (file) {
            const pdf = D.require('engines/pdf');
            const doc = await pdf.open(file.bytes);
            try {
              const canvas = document.createElement('canvas');
              await pdf.render(doc, 1, canvas, { width: PAGE_WIDTH });
              hit = { key, url: canvas.toDataURL('image/png') };
              pages.set(ds.id, hit);
            } finally { await doc.destroy(); }
          }
        }
        if (hit && hit.key === key) return h('img', { src: hit.url, alt: t('datasets.picture.page'), class: 'dm-ds-page' });
      }
      // Anything else that can be read: the start of the text, set like a page.
      const lines = valuesOf(await handle.engine.exec('select text from data where text is not null order by rowid limit 8')).map((r) => String(r[0]));
      return lines.length ? h('div', { class: 'dm-ds-page dm-ds-page-text', 'aria-label': t('datasets.picture.page') }, lines.map((text) => h('p', { text: text.slice(0, 200) }))) : null;
    }
    async function map(handle) {
      const geometry = leaflet.geometryColumn(handle.columns);
      const coords = geometry ? null : leaflet.coordinateColumns(handle.columns);
      if (!geometry && !coords) return null;
      const names = geometry ? [geometry] : [coords.lon, coords.lat];
      const rows = valuesOf(await handle.engine.exec(`select ${names.map(q).join(', ')} from data limit ${MAP_ROWS}`));
      const text = leaflet.tableSvg({ columns: names, rows, types: Object.fromEntries(names.map((n) => [n, geometry ? 'text' : 'number'])) }, { width: 560, height: 240, limit: MAP_ROWS });
      if (!text) return null;
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const el = /** @type {any} */ (document.importNode(doc.documentElement, true));
      el.setAttribute('class', 'dm-sketch');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', t('datasets.picture.map'));
      return el;
    }
    async function network(handle) {
      const nodes = valuesOf(await handle.engine.exec('select id from data order by rowid limit 60')).map((r) => r[0]);
      const edges = valuesOf(await handle.engine.exec('select kalla, mal from _edges limit 2000'));
      return nodes.length ? sketches.network(sketches.networkOf(nodes, edges), t('datasets.picture.graph')) : null;
    }
    async function model(ds, handle) {
      if (kinds.isDxf(ds)) {
        const text = await D.require('data/model').drawing(ds.id);
        return text ? sketches.imageOfSvg(text, t('datasets.picture.drawing')) : null;
      }
      const rows = valuesOf(await handle.engine.exec('select typ, count(*) as n from data where typ is not null group by typ order by n desc limit 8'));
      return rows.length ? sketches.bars(rows.map((r) => ({ name: String(r[0]), count: Number(r[1]) }))) : null;
    }
    async function timeline(handle, facet) {
      const period = facet.columns[0];
      const value = handle.columns.find((c) => (c.type === 'number' || c.type === 'integer') && c.name !== period);
      if (!value) return null;
      const rows = valuesOf(await handle.engine.exec(`select ${q(period)}, avg(${q(value.name)}) from data where ${q(period)} is not null and ${q(value.name)} is not null group by 1 order by 1 limit ${LINE_POINTS}`));
      if (rows.length < 3) return null;
      return h('figure', { class: 'dm-ds-figure' }, sketches.line(rows.map((r) => Number(r[1])), t('datasets.picture.line', { value: value.name, period })),
        h('figcaption', { class: 'dm-help dm-small', text: t('datasets.picture.line', { value: value.name, period }) }));
    }
    /** @param {any} ds @returns {Promise<Element|null>} */
    async function draw(ds) {
      const handle = await datasets.ensureOpen(ds.id);
      const own = kinds.of(ds).picture;
      if (own === 'none') return null;
      if (own === 'page') return page(ds, handle);
      if (own === 'map') return map(handle);
      if (own === 'network') return network(handle);
      if (own === 'model') return model(ds, handle);
      const found = await facets.detect(ds.id);
      if (found.some((f) => f.id === 'spatial' && f.on)) return map(handle);
      const series = found.find((f) => f.id === 'timeseries' && f.on);
      return series ? timeline(handle, series) : null;
    }
    /**
     * The place for the picture, which removes itself when there is nothing to show.
     * @param {any} ds @returns {HTMLElement}
     */
    function create(ds) {
      const holder = h('div', { class: 'dm-ds-picture' });
      draw(ds).then((el) => { if (el) replace(holder, el); else holder.remove(); }).catch((err) => { D.log('picture', err); holder.remove(); });
      return holder;
    }

    return { create, draw };
  });
})();
