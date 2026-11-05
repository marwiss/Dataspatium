// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A workspace, or a selection from it, as a read-only site to put on an intranet or send: a start page and one page per dataset,
 * dashboard and document, tied together with relative links. It builds on the pages Publicera makes, holds what it shows and asks
 * the network for nothing. Datasets are read from copies that have been through the review, which is the caller's part.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/site', ['data/datasets', 'data/kinds', 'docgen/viewers', 'viz/dashboards', 'platform/storage/zip'], (datasets, kinds, viewers, dashboards, zip) => {
    const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const CSS = '<style>.dm-s-back{display:block;padding:8px 16px;font:14px system-ui,sans-serif}.dm-s-list{list-style:none;padding:0;margin:0 0 24px}.dm-s-list li{padding:10px 0;border-bottom:1px solid currentColor}.dm-s-list a{font-weight:600}.dm-s-sub{display:block;font-size:14px;opacity:.75}.dm-s-book{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0 24px}.dm-s-book th,.dm-s-book td{border:1px solid currentColor;padding:4px 8px;text-align:left}</style>';

    /** A file name that works in an address and is not taken. */
    function fileName(name, used) {
      const base = String(name || 'sida').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sida';
      let out = base; let n = 2;
      while (used.has(out)) out = `${base}-${n++}`;
      used.add(out);
      return `${out}.html`;
    }
    /** The back link goes first on the page, and the code book last. */
    function withFrame(html, title, extra) {
      const back = `${CSS}<a class="dm-s-back" href="../index.html">${esc(D.t('site.back', { title }))}</a>`;
      const start = html.search(/<body[^>]*>/i);
      if (start < 0) throw new Error('page without a body');
      const open = html.indexOf('>', start) + 1;
      const close = html.toLowerCase().lastIndexOf('</body>');
      return html.slice(0, open) + back + html.slice(open, close) + (extra || '') + html.slice(close);
    }
    /**
     * The columns of a dataset, what they mean and what their values stand for.
     * @param {string} id @returns {Promise<string>}
     */
    async function codebook(id) {
      const cols = await datasets.columns(id);
      const labels = (c) => (c.valueLabels && c.valueLabels.labels ? c.valueLabels.labels.slice(0, 40).map(([code, label]) => `${code} = ${label}`).join(', ') : '');
      const rows = cols.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.label && c.label !== c.name ? c.label : '')}</td><td>${esc(c.type)}</td><td>${esc(c.description || '')}${c.unit ? ` (${esc(c.unit)})` : ''}</td><td>${esc(labels(c))}</td></tr>`).join('');
      return `<section><h2>${esc(D.t('site.codebook'))}</h2><table class="dm-s-book"><thead><tr>${['site.book.name', 'site.book.label', 'site.book.type', 'site.book.description', 'site.book.values'].map((k) => `<th>${esc(D.t(k))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></section>`;
    }
    /**
     * @param {{title?: string, description?: string, datasets?: Array<{id: string, name?: string}>, dashboards?: any[], documents?: any[], documentDataset?: string|null}} selection
     *   `datasets` are the ids to read from, which are copies when the review has asked for changes
     * @param {{onProgress?: (done: number, total: number) => void}} [options]
     * @returns {Promise<Blob>} a ZIP with index.html at its root
     */
    async function build(selection, options = {}) {
      const title = selection.title || D.t('site.default.title');
      const parts = { datasets: selection.datasets || [], dashboards: selection.dashboards || [], documents: selection.documents || [] };
      const total = parts.datasets.length + parts.dashboards.length + parts.documents.length;
      const entries = {}; const used = new Set(); const groups = [];
      let done = 0;
      const step = () => { done++; if (options.onProgress) options.onProgress(done, total); };
      const encode = (text) => new TextEncoder().encode(text);

      const datasetItems = [];
      for (const d of parts.datasets) {
        const meta = await datasets.get(d.id);
        const name = d.name || meta.name;
        const html = await (await viewers.pageFor(d.id)).text();
        const file = fileName(name, used);
        entries[`sidor/${file}`] = encode(withFrame(html, title, await codebook(d.id)));
        datasetItems.push({ href: `sidor/${file}`, name, sub: meta.description || kinds.summary(meta) });
        step();
      }
      if (datasetItems.length) groups.push({ title: D.t('site.group.datasets'), items: datasetItems });
      const dashItems = [];
      for (const dash of parts.dashboards) {
        const html = await (await dashboards.toHtml(dash)).text();
        const file = fileName(dash.name, used);
        entries[`sidor/${file}`] = encode(withFrame(html, title));
        dashItems.push({ href: `sidor/${file}`, name: dash.name, sub: dash.description || D.t('viz.count', { n: (dash.items || []).length }) });
        step();
      }
      if (dashItems.length) groups.push({ title: D.t('site.group.dashboards'), items: dashItems });
      const docItems = [];
      for (const doc of parts.documents) {
        const made = await D.require('docgen/generate').generate(doc, selection.documentDataset, 'html');
        const file = fileName(doc.name, used);
        entries[`sidor/${file}`] = encode(withFrame(await made.blob.text(), title));
        docItems.push({ href: `sidor/${file}`, name: doc.name, sub: '' });
        step();
      }
      if (docItems.length) groups.push({ title: D.t('site.group.documents'), items: docItems });
      const list = groups.map((g) => `<section><h2>${esc(g.title)}</h2><ul class="dm-s-list">${g.items.map((i) => `<li><a href="${esc(encodeURI(i.href))}">${esc(i.name)}</a>${i.sub ? `<span class="dm-s-sub">${esc(i.sub)}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
      const page = await dashboards.toHtml({ name: title, description: selection.description || D.t('site.description') }, { resolved: [], after: CSS + list, generatedText: D.t('dash.html.generated', { date: D.require('ui/i18n').formatDateTime(new Date()) }) });
      entries['index.html'] = encode(await page.text());
      return zip.createZip(entries, { level: 6 });
    }

    return { build, codebook, fileName };
  });
})();
