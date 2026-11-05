// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Notebooks: cells of Markdown text, R code, Python code and SQL that run in order against the R and Python
 * sessions and the notebook's dataset. Outputs (text, tables, plots as PNG, created datasets) are stored with the cell, so
 * a notebook reopens with its results. A notebook exports to HTML, Word, PDF, Markdown and LaTeX through
 * the document builders, and travels as a `*.nb.json` file.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/notebooks', ['platform/storage/idb', 'data/datasets', 'data/recipes', 'data/r-bridge', 'data/python-bridge', 'docgen/markdown', 'docgen/builders', 'docgen/builders-office', 'platform/storage/zip', 'platform/files', 'platform/sync'],
    (idb, datasets, recipes, rb, pb, markdown, builders, office, zip, files, sync) => {
      const FORMAT = 'dataspatium-notebook/1';
      const CELL_TYPES = ['markdown', 'r', 'python', 'sql'];
      /** Code cells run through the engine bridges; their console entries become cell outputs. */
      const CODE_BRIDGES = { r: () => rb.bridge, python: () => pb.bridge };
      const SQL_LIMIT = 1000;
      const READ_ONLY_SQL = /^\s*(select|with|values|pragma|explain)\b/i;
      const EXPORT_FORMATS = [
        { id: 'html', label: D.t('doc.format.html'), ext: 'html', mime: 'text/html;charset=utf-8' },
        { id: 'docx', label: 'Word (DOCX)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf' },
        { id: 'md', label: 'Markdown', ext: 'md', mime: 'text/markdown;charset=utf-8' },
        { id: 'tex', label: D.t('doc.format.tex'), ext: 'zip', mime: 'application/zip' },
      ];
      const listeners = new Set();
      function notify(type, payload) { for (const fn of listeners) { try { fn(type, payload); } catch (err) { console.error(err); } } }
      function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
      const newId = () => 'nb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const newCellId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

      async function list() { return idb.listNotebooks(); }
      async function get(id) { return idb.getNotebook(id); }

      /** A cell. */
      function cell(type, source) { return { id: newCellId(), type: CELL_TYPES.includes(type) ? type : 'markdown', source: source || '', outputs: [] }; }

      /** New notebook with a short starter: a heading, an R cell and (with a dataset) an SQL cell. */
      function create(name, dataset) {
        const title = name || D.t('nb.default.name');
        const cells = [cell('markdown', D.t('nb.first.cell', { title }))];
        if (dataset) {
          // What to start from depends on what the dataset is.
          const starters = D.require('analysis/starters');
          for (const lang of ['r', 'sql']) for (const piece of starters.forKind(dataset, lang)) cells.push(cell(lang, piece.code));
        } else cells.push(cell('r', 'dm_list()'));
        return { id: null, name: title, datasetId: dataset ? dataset.id : null, datasetName: dataset ? dataset.name : '', datasetShort: dataset ? dataset.shortName || '' : '', cells };
      }

      /** Insert or update; returns the stored record. */
      async function save(nb) {
        const now = new Date().toISOString();
        const record = Object.assign({}, nb, {
          id: nb.id || newId(), createdAt: nb.createdAt || now, updatedAt: now,
          name: (nb.name || '').trim() || D.t('nb.untitled'),
          cells: (nb.cells || []).map((c) => ({ id: c.id || newCellId(), type: CELL_TYPES.includes(c.type) ? c.type : 'markdown', source: String(c.source || ''), outputs: Array.isArray(c.outputs) ? c.outputs : [], ran: c.ran || null, ms: c.ms || null })),
        });
        await idb.putNotebook(record);
        notify('saved', record);
        sync.broadcast('notebooks', 'saved', { id: record.id, name: record.name });
        return record;
      }
      async function remove(id) { await idb.deleteNotebook(id); notify('deleted', { id }); sync.broadcast('notebooks', 'deleted', { id }); }
      sync.on((msg) => { if (msg.kind === 'notebooks') notify('remote', msg.payload); });

      /** Run one cell; outputs replace the cell's previous outputs. Errors become an error output. */
      async function runCell(nb, c) {
        const t0 = performance.now();
        const outputs = [];
        try {
          if (c.type === 'sql') {
            if (!nb.datasetId) throw new Error(D.t('nb.err.nodataset'));
            const statement = String(c.source || '').trim().replace(/;\s*$/, '');
            if (!statement) throw new Error(D.t('nb.err.empty'));
            if (READ_ONLY_SQL.test(statement)) {
              // Short names of other datasets are attached, as in the SQL console.
              const r = await D.require('data/query').select(nb.datasetId, statement, { limit: SQL_LIMIT });
              outputs.push({ kind: 'table', columns: r.columns, rows: r.values, truncated: r.truncated });
            } else {
              const result = await recipes.apply(nb.datasetId, 'sql', { statement });
              outputs.push({ kind: 'text', text: typeof result.rows === 'number' ? D.t('sql.rows.affected', { n: result.rows }) : D.t('sql.statement.done') });
            }
          } else if (CODE_BRIDGES[c.type]) {
            const code = String(c.source || '').trim();
            if (!code) throw new Error(D.t('nb.err.empty'));
            const res = await CODE_BRIDGES[c.type]().run(code);
            let text = '';
            const flush = () => { if (text) { outputs.push({ kind: 'text', text: text.replace(/\n$/, '') }); text = ''; } };
            for (const e of res.entries) {
              if (e.kind === 'stdout' || e.kind === 'stderr') text += e.text + (e.text.endsWith('\n') ? '' : '\n');
              else if (e.kind === 'error') { flush(); outputs.push({ kind: 'error', text: e.text }); }
              else if (e.kind === 'plot') { flush(); outputs.push(await plotOutput(e)); }
              else if (e.kind === 'dataset') { flush(); outputs.push({ kind: 'dataset', id: e.meta.id, name: e.meta.name, rows: e.meta.rowCount || 0 }); }
              else if (e.kind === 'packages') { flush(); outputs.push({ kind: 'text', text: D.t('nb.packages.installed', { names: e.names.join(', ') }) }); }
            }
            flush();
          }
        } catch (err) { outputs.push({ kind: 'error', text: (err && err.message) || String(err) }); }
        c.outputs = outputs;
        c.ran = new Date().toISOString();
        c.ms = Math.round(performance.now() - t0);
        return c;
      }

      /** Run every cell in order. */
      async function runAll(nb, onProgress) {
        for (let i = 0; i < nb.cells.length; i++) {
          await runCell(nb, nb.cells[i]);
          if (onProgress) onProgress(i + 1, nb.cells.length);
        }
        return nb;
      }

      /**
       * A plot entry as a cell output: R draws on a canvas, Python hands over a PNG; a plotly figure is rendered to
       * PNG by plotly.js for the stored output and documents, and keeps its JSON for the interactive view.
       */
      async function plotOutput(e) {
        if (e.canvas) return { kind: 'image', dataUrl: e.canvas.toDataURL('image/png'), width: e.canvas.width, height: e.canvas.height };
        if (e.plotly) {
          try {
            const blob = await D.require('viz/plotly').toBlob(e.plotly, 'png', { width: 960, height: 576, scale: 1 });
            return { kind: 'image', dataUrl: await blobToDataUrl(blob), width: 960, height: 576, plotly: e.plotly };
          } catch (err) { return { kind: 'error', text: (err && err.message) || String(err) }; }
        }
        return { kind: 'image', dataUrl: 'data:image/png;base64,' + (e.png || ''), width: e.width, height: e.height };
      }
      function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
      }

      function dataUrlToBytes(dataUrl) {
        const b64 = String(dataUrl).split(',')[1] || '';
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      const fmtCell = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? v.toLocaleString('sv-SE', { maximumFractionDigits: 6 }) : String(v));

      /**
       * Notebook -> document model for the builders: Markdown cells as blocks, code as code blocks,
       * outputs as code blocks, tables and images.
       * @param {any} nb @param {{includeCode?: boolean, maxRows?: number}} [options]
       */
      function toAst(nb, options = {}) {
        const blocks = [];
        for (const c of nb.cells || []) {
          if (c.type === 'markdown') { blocks.push(...markdown.parse(c.source).blocks); continue; }
          if (options.includeCode !== false && String(c.source || '').trim()) blocks.push({ type: 'code', text: c.source, language: c.type });
          for (const o of c.outputs || []) {
            if (o.kind === 'text' || o.kind === 'error') blocks.push({ type: 'code', text: o.text, language: o.kind === 'error' ? 'error' : 'output' });
            else if (o.kind === 'table') {
              const rows = (o.rows || []).slice(0, options.maxRows || 200);
              blocks.push({ type: 'table', columns: o.columns, rows: rows.map((r) => r.map(fmtCell)), numeric: o.columns.map((_, i) => rows.some((r) => typeof r[i] === 'number')) });
            } else if (o.kind === 'image') {
              const scale = o.width > 672 ? 672 / o.width : 1;
              blocks.push({ type: 'image', png: dataUrlToBytes(o.dataUrl), width: Math.round(o.width * scale), height: Math.round(o.height * scale), caption: '' });
            } else if (o.kind === 'dataset') blocks.push({ type: 'paragraph', runs: [{ text: D.t('nb.new.dataset', { name: o.name, rows: o.rows }) }] });
          }
        }
        return { blocks };
      }

      /** DOM preview of a Markdown cell. */
      function renderMarkdown(source) { return builders.toDom(markdown.parse(source)); }

      /**
       * Export the notebook as a document.
       * @param {any} nb @param {string} format one of EXPORT_FORMATS ids
       * @param {{includeCode?: boolean, filename?: string}} [options]
       * @returns {Promise<{blob: Blob, filename: string, format: string}>}
       */
      async function exportNotebook(nb, format, options = {}) {
        const fmt = EXPORT_FORMATS.find((f) => f.id === format);
        if (!fmt) throw new Error(D.t('err.unknown.format', { format }));
        const ast = toAst(nb, options);
        const title = nb.name || markdown.title(ast) || D.t('nb.default.name');
        const base = options.filename || nb.name || D.t('nb.default.name').toLowerCase();
        let blob;
        if (format === 'html') blob = new Blob([builders.toHtml(ast, { title })], { type: fmt.mime });
        else if (format === 'docx') blob = await office.toDocx(ast, { title, description: D.t('nb.created.by') });
        else if (format === 'pdf') blob = await office.toPdf(ast, { title });
        else if (format === 'md') {
          const md = builders.toMarkdown(ast);
          if (Object.keys(md.figures).length) {
            blob = await zip.createZip(Object.assign({ [files.safeName(base, 'md')]: md.text }, md.figures), { level: 6 });
            return { blob, filename: files.safeName(base, 'zip'), format };
          }
          blob = new Blob([md.text], { type: fmt.mime });
        } else {
          const tex = builders.toLatex(ast, { title });
          blob = await zip.createZip(Object.assign({ 'main.tex': tex.text }, tex.figures), { level: 6 });
        }
        return { blob, filename: files.safeName(base, fmt.ext), format };
      }

      /** Shareable JSON (cells with outputs; no ids). */
      function exportJson(nb) {
        return JSON.stringify({
          format: FORMAT, name: nb.name, datasetName: nb.datasetName || '', datasetShort: nb.datasetShort || '', created: nb.updatedAt || nb.createdAt || new Date().toISOString(), app: 'Dataspatium', version: D.version,
          cells: (nb.cells || []).map((c) => ({ type: c.type, source: c.source, outputs: c.outputs || [] })),
        }, null, 2) + '\n';
      }

      /** Import a notebook file; the dataset is matched by name in this workspace. */
      async function importJson(text) {
        let obj;
        try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error(D.t('err.invalid.json')); }
        if (obj.format !== FORMAT || !Array.isArray(obj.cells)) throw new Error(D.t('nb.err.format', { format: FORMAT }));
        const all = await datasets.list();
        // The dataset is matched by name, else by short name (which survives renames in the other workspace).
        const match = (obj.datasetName ? all.find((d) => d.name === obj.datasetName) : null) || (obj.datasetShort ? all.find((d) => d.shortName === obj.datasetShort) : null) || null;
        return save({ name: obj.name || D.t('nb.imported.name'), datasetId: match ? match.id : null, datasetName: obj.datasetName || '', datasetShort: obj.datasetShort || (match ? match.shortName : ''), cells: obj.cells.map((c) => cell(c.type, c.source)).map((c, i) => Object.assign(c, { outputs: Array.isArray(obj.cells[i].outputs) ? obj.cells[i].outputs : [] })) });
      }

      return { list, get, create, cell, save, remove, runCell, runAll, toAst, renderMarkdown, exportNotebook, exportJson, importJson, subscribe, FORMAT, CELL_TYPES, EXPORT_FORMATS, SQL_LIMIT };
    });
})();
