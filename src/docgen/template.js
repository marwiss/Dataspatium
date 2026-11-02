// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Document templates: Markdown text with Mustache placeholders plus three Dataspatium tags that are
 * resolved before Mustache runs:
 *   {{#tabell}}kolumner: a, b; sortera: b fallande; topp: 20; filter: lan = Skåne län; rubrik: …{{/tabell}}
 *   {{diagram "Namn på sparat diagram" | bredd: 600 | hojd: 320}}
 *   {{sidbrytning}}
 * Mustache's HTML escaping is turned off here; every output builder escapes for its own format.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/template', ['viz/data', 'viz/charts', 'viz/render', 'data/datasets', 'data/profile', 'ui/i18n'], (vizData, charts, render, datasets, profileMod, i18n) => {
    const TOKEN = '\u0000';
    const RE_TABLE = /\{\{#tabell\}\}([\s\S]*?)\{\{\/tabell\}\}/g;
    const RE_CHART = /\{\{diagram\s+"([^"]+)"([^}]*)\}\}/g;
    const RE_PAGEBREAK = /\{\{sidbrytning\}\}/g;
    const t = i18n.t;

    async function ensureMustache() {
      if (!globalThis.Mustache) await D.assets.loadVendorScript('vendor/mustache/mustache.min.js');
      const M = globalThis.Mustache;
      M.escape = (s) => String(s);
      return M;
    }

    const fmt = (v) => (v === null || v === undefined ? '' : (typeof v === 'number' ? i18n.formatNumber(v) : String(v)));
    const pad = (n) => String(n).padStart(2, '0');
    const key = (s) => String(s).trim().toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');

    /** Parse the body of a {{#tabell}} tag. */
    function parseTableSpec(text) {
      const spec = { kolumner: [], sortera: null, topp: 50, filter: [], rubrik: '', kalla: 'rader' };
      for (const part of String(text).split(/;|\n/)) {
        const m = part.match(/^\s*([^:]+?)\s*:\s*([\s\S]*?)\s*$/);
        if (!m) continue;
        const k = key(m[1]); const v = m[2].trim();
        if (k === 'kolumner') spec.kolumner = v.split(',').map((s) => s.trim()).filter(Boolean);
        else if (k === 'sortera') { const sm = v.match(/^(.*?)(?:\s+(fallande|stigande))?$/i); spec.sortera = { col: sm[1].trim(), dir: sm[2] && /fallande/i.test(sm[2]) ? 'desc' : 'asc' }; }
        else if (k === 'topp') spec.topp = Math.max(1, Math.min(5000, Number(v) || 50));
        else if (k === 'filter') for (const cond of v.split(/\s+och\s+/i)) { const fm = cond.match(/^(\S+)\s*(!=|>=|<=|=|>|<|innehåller|innehaller)\s*(.*)$/); if (fm) spec.filter.push({ field: fm[1], op: /inneh/.test(fm[2]) ? 'contains' : fm[2], value: fm[3].trim() }); }
        else if (k === 'rubrik') spec.rubrik = v;
        else if (k === 'kalla') spec.kalla = key(v) === 'kolumner' ? 'kolumner' : 'rader';
      }
      return spec;
    }
    function parseChartOptions(rest) {
      const opts = {};
      for (const part of String(rest || '').split('|')) { const m = part.match(/^\s*([^:]+?)\s*:\s*(\d+)\s*$/); if (m) opts[key(m[1])] = Number(m[2]); }
      return { bredd: opts.bredd || 0, hojd: opts.hojd || 0 };
    }

    /**
     * Template context for a dataset, optionally filtered to one group.
     * @param {string} datasetId @param {{group?: {column: string, value: any}, filters?: any[], maxRows?: number}} [options]
     */
    async function buildContext(datasetId, options = {}) {
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error('Datamängden finns inte längre i arbetsytan.');
      const columns = await datasets.columns(datasetId);
      const filters = (options.filters || []).concat(options.group ? [{ field: options.group.column, op: '=', value: options.group.value }] : []);
      const data = await vizData.fetchRows(datasetId, { filters, limit: options.maxRows || 1000 });
      const numeric = columns.filter((c) => c.type === 'integer' || c.type === 'number');
      const stats = { summor: {}, medel: {}, minsta: {}, storsta: {} };
      if (numeric.length && data.total) {
        const agg = await vizData.fetchRows(datasetId, { filters, groupBy: [], limit: 1, aggregates: numeric.flatMap((c) => [{ field: c.name, fn: 'sum', as: 's_' + c.name }, { field: c.name, fn: 'mean', as: 'a_' + c.name }, { field: c.name, fn: 'min', as: 'n_' + c.name }, { field: c.name, fn: 'max', as: 'x_' + c.name }]) });
        const r = agg.rows[0] || {};
        for (const c of numeric) { stats.summor[c.name] = fmt(r['s_' + c.name]); stats.medel[c.name] = fmt(r['a_' + c.name] === null || r['a_' + c.name] === undefined ? null : Math.round(r['a_' + c.name] * 100) / 100); stats.minsta[c.name] = fmt(r['n_' + c.name]); stats.storsta[c.name] = fmt(r['x_' + c.name]); }
      }
      const rader = data.rows.map((row) => { const o = {}; for (const [k, v] of Object.entries(row)) o[k] = fmt(v); return o; });
      const now = new Date();
      const src = meta.source || {};
      return {
        datamangd: meta.name, beskrivning: meta.description || '',
        antal_rader: fmt(data.total), antal_rader_visade: fmt(data.rows.length), antal_kolumner: String(columns.length),
        kolumner: columns.map((c) => ({ namn: c.name, typ: t('type.' + c.type), etikett: c.label || c.name })),
        rader, forsta: rader[0] || {}, summor: stats.summor, medel: stats.medel, minsta: stats.minsta, storsta: stats.storsta,
        grupp: options.group ? String(options.group.value) : '', gruppkolumn: options.group ? options.group.column : '',
        datum: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, tid: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        app: 'Dataspatium ' + D.version, kalla: src.publisher || src.connectorName || src.fileName || '',
        _meta: meta, _columns: columns, _filters: filters, _datasetId: datasetId, _total: data.total,
      };
    }

    /** Context with a per-column profile for codebooks. */
    async function codebookContext(datasetId, options = {}) {
      const ctx = await buildContext(datasetId, Object.assign({ maxRows: 50 }, options));
      const prof = await profileMod.profile(datasetId);
      ctx.dubbletter = fmt(prof.duplicates);
      ctx.kolumner = prof.columns.map((c) => ({
        namn: c.name, typ: t('type.' + c.type), etikett: c.label || c.name, saknade: fmt(c.nulls), unika: fmt(c.distinct), minsta: fmt(c.min), storsta: fmt(c.max),
        medel: c.mean === null || c.mean === undefined ? '' : fmt(Math.round(c.mean * 100) / 100), ar_unik: !!c.unique,
        anmarkningar: c.warnings.map((w) => t('profile.warn.' + w.kind, { n: fmt(w.count) })).join('; '),
      }));
      return ctx;
    }

    async function resolveTable(spec, ctx) {
      if (spec.kalla === 'kolumner') {
        const cols = ['namn', 'typ', 'etikett'];
        return { caption: spec.rubrik, columns: cols, rows: ctx.kolumner.map((k) => cols.map((c) => k[c] || '')), numeric: [false, false, false] };
      }
      const columns = ctx._columns;
      const wanted = spec.kolumner.length ? spec.kolumner.filter((n) => columns.some((c) => c.name === n)) : columns.map((c) => c.name);
      if (!wanted.length) return { caption: spec.rubrik, columns: [], rows: [], numeric: [], error: 'Inga kända kolumner i tabellen: ' + spec.kolumner.join(', ') };
      const data = await vizData.fetchRows(ctx._datasetId, { fields: wanted, filters: ctx._filters.concat(spec.filter), limit: spec.topp, orderBy: spec.sortera ? spec.sortera.col : undefined, orderDir: spec.sortera ? spec.sortera.dir : undefined });
      const types = Object.fromEntries(columns.map((c) => [c.name, c.type]));
      const numeric = wanted.map((n) => types[n] === 'integer' || types[n] === 'number');
      return { caption: spec.rubrik, columns: wanted, rows: data.rows.map((r) => wanted.map((n) => fmt(r[n]))), numeric, total: data.total };
    }

    function pngSize(buf) {
      try { const v = new DataView(buf); return { width: v.getUint32(16), height: v.getUint32(20) }; } catch (_e) { return { width: 0, height: 0 }; }
    }
    async function resolveChart(spec, ctx) {
      const list = await charts.list();
      const chart = list.find((c) => c.name === spec.name);
      if (!chart) return { error: `Diagrammet "${spec.name}" finns inte bland de sparade diagrammen.`, caption: spec.name };
      if (chart.kind === 'r') return { error: `Diagrammet "${spec.name}" är ett R-diagram och kan inte läggas in i dokument.`, caption: spec.name };
      const width = spec.opts.bredd || 720;
      try {
        const blob = await render.toBlob(chart, 'png', { width, height: spec.opts.hojd || undefined, scale: 2, extraFilters: ctx._filters.length ? ctx._filters : undefined });
        const png = await blob.arrayBuffer();
        const size = pngSize(png);
        return { png, width: Math.round(size.width / 2) || width, height: Math.round(size.height / 2) || Math.round(width * 0.56), caption: chart.name };
      } catch (err) { return { error: `Diagrammet "${spec.name}" kunde inte renderas: ${(err && err.message) || err}`, caption: spec.name }; }
    }

    /**
     * Resolve tags, run Mustache. Returns the rendered text (with block tokens) and the resolved blocks.
     * @returns {Promise<{text: string, tables: any[], images: any[]}>}
     */
    async function renderTemplate(body, ctx) {
      const M = await ensureMustache();
      const tableSpecs = []; const chartSpecs = [];
      let text = String(body || '');
      text = text.replace(RE_TABLE, (m, spec) => { tableSpecs.push(spec); return `\n${TOKEN}TABLE:${tableSpecs.length - 1}${TOKEN}\n`; });
      text = text.replace(RE_CHART, (m, name, rest) => { chartSpecs.push({ name, opts: parseChartOptions(rest) }); return `\n${TOKEN}IMAGE:${chartSpecs.length - 1}${TOKEN}\n`; });
      text = text.replace(RE_PAGEBREAK, `\n${TOKEN}PAGEBREAK${TOKEN}\n`);
      const tables = []; for (const spec of tableSpecs) tables.push(await resolveTable(parseTableSpec(spec), ctx));
      const images = []; for (const spec of chartSpecs) images.push(await resolveChart(spec, ctx));
      let rendered;
      try { rendered = M.render(text, ctx); } catch (err) { throw new Error('Mallen kunde inte tolkas: ' + ((err && err.message) || err)); }
      return { text: rendered, tables, images };
    }

    return { buildContext, codebookContext, renderTemplate, parseTableSpec, parseChartOptions, resolveTable, resolveChart, ensureMustache, TOKEN, fmt };
  });
})();
