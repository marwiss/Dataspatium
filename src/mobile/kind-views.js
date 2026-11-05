// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A dataset on the phone in its own form, above the rows: pictures to look through, a document to read, places on a small
 * plan, a network's nodes with their edges, what a model is made of. It reads only the file it is given, and nothing here
 * goes over the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('mobile/kind-views', ['ui/base'], (base) => {
    const { h, t, i18n } = base;
    const NS = 'http://www.w3.org/2000/svg';
    const PLOT_W = 320; const PLOT_H = 220;
    const MAX_POINTS = 2000;
    const MAX_PICTURES = 60;
    const LON = /^(lon|lng|long|longitud|longitude|x)$/i;
    const LAT = /^(lat|latitud|latitude|y)$/i;

    const values = (res) => (res[0] ? res[0].values : []);
    const hasTable = async (engine, name) => Number(values(await engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [name]))[0][0]) > 0;

    /** Thumbnails from the file itself. The urls are freed when the view closes. */
    async function pictures(view) {
      const rows = values(await view.engine.exec(`select name, type, bytes from _files where kind = 'thumb' order by name limit ${MAX_PICTURES}`));
      if (!rows.length) return null;
      const urls = rows.map((r) => URL.createObjectURL(new Blob([r[2]], { type: String(r[1]) })));
      view.onClose(() => urls.forEach((u) => URL.revokeObjectURL(u)));
      return h('div', { class: 'dm-m-pictures' }, rows.map((r, i) => h('figure', { class: 'dm-m-picture' }, h('img', { src: urls[i], alt: String(r[0]) }), h('figcaption', { class: 'dm-small dm-truncate', text: String(r[0]) }))));
    }
    /** The paragraphs on this page of rows, set as text. */
    function reading(view) {
      const at = (name) => view.columns.findIndex((c) => c.name === name);
      const parts = [];
      let doc = null;
      for (const row of view.data || []) {
        if (row[at('dokument')] !== doc) { doc = row[at('dokument')]; parts.push(h('h3', { text: String(doc) })); }
        parts.push(h(row[at('typ')] === 'rubrik' ? 'h4' : 'p', { class: 'dm-m-text', text: String(row[at('text')] || '') }));
      }
      return parts.length ? h('div', { class: 'dm-m-reading' }, parts) : null;
    }
    /** Places as dots on a small plan, without a background map. */
    async function places(view) {
      const lon = view.columns.find((c) => LON.test(c.name)); const lat = view.columns.find((c) => LAT.test(c.name));
      if (!lon || !lat) return null;
      const q = (c) => '"' + c.name.replace(/"/g, '""') + '"';
      const rows = values(await view.engine.exec(`select ${q(lon)}, ${q(lat)} from data where ${q(lon)} is not null and ${q(lat)} is not null limit ${MAX_POINTS}`)).filter((r) => typeof r[0] === 'number' && typeof r[1] === 'number');
      if (!rows.length) return null;
      const xs = rows.map((r) => r[0]); const ys = rows.map((r) => r[1]);
      const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
      const spanX = maxX - minX || 1; const spanY = maxY - minY || 1;
      // A degree of longitude is shorter than one of latitude this far north.
      const stretch = maxY <= 90 ? Math.cos(((minY + maxY) / 2) * (Math.PI / 180)) : 1;
      const scale = Math.min((PLOT_W - 20) / (spanX * stretch), (PLOT_H - 20) / spanY);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${PLOT_W} ${PLOT_H}`);
      svg.setAttribute('class', 'dm-m-plot');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', t('datasets.picture.map'));
      for (const r of rows) {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', String(10 + (r[0] - minX) * stretch * scale));
        dot.setAttribute('cy', String(PLOT_H - 10 - (r[1] - minY) * scale));
        dot.setAttribute('r', '3');
        svg.appendChild(dot);
      }
      return svg;
    }
    /** The nodes on this page of rows, each with how many edges it has. */
    async function nodes(view) {
      if (!(await hasTable(view.engine, '_edges'))) return null;
      const at = (name) => view.columns.findIndex((c) => c.name === name);
      const ids = (view.data || []).map((row) => row[at('id')]);
      if (!ids.length) return null;
      const list = ids.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(',');
      const counts = new Map(values(await view.engine.exec(`select id, count(*) from (select kalla as id from _edges where kalla in (${list}) union all select mal from _edges where mal in (${list})) group by id`)).map((r) => [String(r[0]), Number(r[1])]));
      return h('ul', { class: 'dm-m-nodes' }, (view.data || []).map((row) => h('li', null,
        h('strong', { text: String(row[at('namn')] || row[at('id')]) }), ' ',
        h('span', { class: 'dm-help dm-small', text: [row[at('etikett')], t('graph.edges.n', { n: i18n.formatNumber(counts.get(String(row[at('id')])) || 0) })].filter(Boolean).join(' · ') }))));
    }
    /** What a model is made of: elements per type, or objects per layer. */
    async function parts(view) {
      const col = view.columns.some((c) => c.name === 'lager') ? 'lager' : 'typ';
      const rows = values(await view.engine.exec(`select "${col}", count(*) as n from data where "${col}" is not null group by "${col}" order by n desc limit 30`));
      if (!rows.length) return null;
      return h('ul', { class: 'dm-m-nodes' }, rows.map((r) => h('li', null, h('strong', { text: String(r[0]) }), ' ', h('span', { class: 'dm-help dm-small', text: i18n.formatNumber(Number(r[1])) }))));
    }
    /** A plan's provisions on this page of rows, each with its designation. */
    function provisions(view) {
      const at = (name) => view.columns.findIndex((c) => c.name === name);
      const text = at('formulering') >= 0 ? at('formulering') : at('namn');
      if (text < 0) return null;
      const rows = (view.data || []).filter((row) => row[text]);
      return rows.length ? h('ul', { class: 'dm-m-nodes' }, rows.map((row) => h('li', null, at('beteckning') >= 0 && row[at('beteckning')] ? h('strong', { text: String(row[at('beteckning')]) + ' ' }) : null, h('span', { text: String(row[text]) })))) : null;
    }
    /**
     * The dataset in its own form, or null when rows say it best. Reads the page of rows the view has loaded.
     * @param {any} view from `openDataset`, with `kind`, `engine`, `columns` and `data`
     * @returns {Promise<Element|null>}
     */
    async function render(view) {
      switch (view.kind) {
        case 'images': return pictures(view);
        case 'document': return reading(view);
        case 'graph': return nodes(view);
        case 'model': return parts(view);
        case 'plan': return provisions(view);
        default: return places(view);
      }
    }

    return { render };
  });
})();
