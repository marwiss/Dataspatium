// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A dataset as a page of its own, to give to someone who does not have the app: a document to read, pictures to look through,
 * a map, a network, a model, or a table to filter. The page holds what it shows and asks the network for nothing. Everything
 * is escaped, and the small script only hides what a filter does not match.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/viewers', ['data/datasets', 'data/kinds', 'data/dataset-files', 'viz/dashboards', 'viz/suggest'], (datasets, kinds, dsFiles, dashboards, suggest) => {
    const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const MAX_ROWS = 2000;
    const MAX_PICTURES = 100;
    const MAX_PARAGRAPHS = 20000;
    const VIEWER_CSS = '<style>.dm-v-filter{font:inherit;padding:8px;width:100%;max-width:420px;margin:8px 0 16px;box-sizing:border-box}.dm-v-table{border-collapse:collapse;width:100%;font-size:14px}.dm-v-table th,.dm-v-table td{border:1px solid currentColor;border-color:rgba(127,127,127,.35);padding:4px 8px;text-align:left}.dm-v-page{color:gray;font-size:13px;margin:24px 0 4px}.dm-v-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.dm-v-grid figure{margin:0}.dm-v-grid img{width:100%;height:auto;display:block}.dm-v-grid figcaption{font-size:13px;margin-top:4px;overflow-wrap:anywhere}.dm-v-note{color:gray;font-size:13px}</style>';
    /** One line of script, so that the page can be read by anyone it is sent to. */
    const FILTER_SCRIPT = (selector) => `<script>(function(){var f=document.querySelector('.dm-v-filter');var all=document.querySelectorAll(${JSON.stringify(selector)});f.addEventListener('input',function(){var q=f.value.toLowerCase();for(var i=0;i<all.length;i++){all[i].style.display=!q||all[i].textContent.toLowerCase().indexOf(q)>=0?'':'none';}});})();</script>`;
    const filterBox = (label) => `<input class="dm-v-filter" type="search" placeholder="${esc(label)}" aria-label="${esc(label)}">`;

    const rowsOf = async (id, limit) => { const cols = await datasets.columns(id); const rows = await datasets.query(id, { limit }); return { cols, rows }; };
    /** Table: the rows, with a filter that reads what is on the page. */
    async function tablePart(id, meta, limit = MAX_ROWS) {
      const { cols, rows } = await rowsOf(id, limit);
      const note = (meta.rowCount || 0) > rows.length ? `<p class="dm-v-note">${esc(D.t('viewer.rows.first', { n: rows.length, total: meta.rowCount }))}</p>` : '';
      return `${filterBox(D.t('viewer.filter'))}${note}<table class="dm-v-table"><thead><tr>${cols.map((c) => `<th>${esc(c.label || c.name)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${FILTER_SCRIPT('.dm-v-table tbody tr')}`;
    }
    /** Documents: the text, page by page. */
    async function documentPart(id, meta) {
      const handle = await datasets.ensureOpen(id);
      const r = await handle.engine.exec(`select dokument, sida, typ, text from data order by rowid limit ${MAX_PARAGRAPHS}`);
      const parts = [filterBox(D.t('viewer.filter'))];
      let doc = null; let page = null;
      for (const [name, sida, typ, text] of r[0] ? r[0].values : []) {
        if (name !== doc) { parts.push(`<h2>${esc(name)}</h2>`); doc = name; page = null; }
        if (sida !== page && sida) { parts.push(`<p class="dm-v-page">${esc(D.t('document.comment.target', { name, page: sida }))}</p>`); page = sida; }
        parts.push(typ === 'rubrik' ? `<h3 class="dm-v-p">${esc(text)}</h3>` : `<p class="dm-v-p">${esc(text)}</p>`);
      }
      if ((meta.rowCount || 0) > MAX_PARAGRAPHS) parts.push(`<p class="dm-v-note">${esc(D.t('viewer.rows.first', { n: MAX_PARAGRAPHS, total: meta.rowCount }))}</p>`);
      parts.push(FILTER_SCRIPT('.dm-v-p'));
      return parts.join('');
    }
    function toBase64(bytes) {
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      return btoa(binary);
    }
    /** Pictures: inside the page, so that it can be sent as one file. */
    async function picturePart(id, meta) {
      const handle = await datasets.ensureOpen(id);
      const r = await handle.engine.exec(`select fil, datum, beskrivning from data order by datum, fil limit ${MAX_PICTURES}`);
      const figures = [];
      for (const [name, date, description] of r[0] ? r[0].values : []) {
        const file = await dsFiles.read(id, name, 'preview');
        if (!file) continue;
        figures.push(`<figure class="dm-v-fig"><img alt="${esc(name)}" src="data:${esc(file.type)};base64,${toBase64(file.bytes)}"><figcaption>${esc([name, date, description].filter(Boolean).join(' · '))}</figcaption></figure>`);
      }
      const note = (meta.rowCount || 0) > MAX_PICTURES ? `<p class="dm-v-note">${esc(D.t('viewer.rows.first', { n: MAX_PICTURES, total: meta.rowCount }))}</p>` : '';
      return `${filterBox(D.t('viewer.filter'))}${note}<div class="dm-v-grid">${figures.join('')}</div>${FILTER_SCRIPT('.dm-v-fig')}`;
    }
    /** What a dataset that is drawn shows beside the picture. */
    async function drawnChart(meta, id) {
      const profile = kinds.of(meta);
      if (profile === kinds.PROFILES.plan) {
        const chart = D.require('viz/charts').create('map', meta, meta.name);
        chart.map = D.require('viz/plan-map').defOf(meta, await datasets.columns(id));
        return chart;
      }
      if (profile === kinds.PROFILES.graph) return suggest.ownChart(meta, 'graph');
      if (profile === kinds.PROFILES.model) return suggest.ownChart(meta, 'model');
      return (await D.require('viz/leaflet').drawable(id)) ? suggest.ownChart(meta, 'map') : null;
    }
    /**
     * The page of a dataset.
     * @param {string} id @returns {Promise<Blob>}
     */
    async function pageFor(id) {
      const meta = await datasets.get(id);
      const generatedText = D.t('dash.html.generated', { date: D.require('ui/i18n').formatDateTime(new Date()) });
      const about = { name: meta.name, description: meta.description || kinds.summary(meta) };
      if (kinds.of(meta) === kinds.PROFILES.document) return dashboards.toHtml(about, { resolved: [], after: VIEWER_CSS + await documentPart(id, meta), generatedText });
      if (kinds.of(meta) === kinds.PROFILES.images) return dashboards.toHtml(about, { resolved: [], after: VIEWER_CSS + await picturePart(id, meta), generatedText });
      const chart = await drawnChart(meta, id);
      return dashboards.toHtml(about, { resolved: chart ? [{ chart }] : [], after: VIEWER_CSS + await tablePart(id, meta), generatedText });
    }

    return { pageFor, MAX_ROWS, MAX_PICTURES };
  });
})();
