// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Generate documents from a template and a dataset in HTML, Word, PDF, Markdown or LaTeX, preview them
 * as DOM, and run batches (one document per group value) into a ZIP.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/generate', ['docgen/template', 'docgen/findings', 'docgen/markdown', 'docgen/builders', 'docgen/builders-office', 'viz/data', 'platform/storage/zip', 'platform/files'], (template, findings, markdown, builders, office, vizData, zip, files) => {
    const FORMATS = [
      { id: 'html', label: D.t('doc.format.html'), ext: 'html', mime: 'text/html;charset=utf-8' },
      { id: 'docx', label: 'Word (DOCX)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf' },
      { id: 'md', label: 'Markdown', ext: 'md', mime: 'text/markdown;charset=utf-8' },
      { id: 'tex', label: D.t('doc.format.tex'), ext: 'zip', mime: 'application/zip' },
    ];

    /**
     * Template + dataset -> document model. A report of findings (DS-55) belongs to BIM och GIS with the models: below it the
     * template is refused in the tier's words wherever it is generated from (a flow, a command, the bridge, Exportera).
     * `ask: false` (a flow at start): the charts in the template are drawn without asking for anything. `problems` are the texts of
     * the charts and pictures that could not be drawn (the document shows them in their place), so a flow can say them too.
     * @returns {Promise<{ast: any, ctx: any, problems: string[]}>}
     */
    async function buildAst(doc, datasetId, options = {}) {
      if (doc.findings) D.require('platform/tier').guard('kind:model');
      const ctx = doc.findings ? await findings.context(datasetId, options, doc.body) : doc.codebook ? await template.codebookContext(datasetId, options) : await template.buildContext(datasetId, options);
      if (options.ask === false) ctx._ask = false;
      const rendered = await template.renderTemplate(doc.body, ctx);
      const problems = Array.from(new Set((rendered.images || []).filter((i) => i && i.error).map((i) => String(i.error))));
      return { ast: markdown.parse(rendered.text, rendered), ctx, problems };
    }

    /**
     * Generate one document.
     * @returns {Promise<{blob: Blob, filename: string, format: string, problems: string[]}>} problems: charts and pictures not drawn
     */
    async function generate(doc, datasetId, format, options = {}) {
      const fmt = FORMATS.find((f) => f.id === format);
      if (!fmt) throw new Error(D.t('err.unknown.format', { format }));
      const { ast, ctx, problems } = await buildAst(doc, datasetId, options);
      const title = options.title || markdown.title(ast) || doc.name;
      const baseName = options.filename || `${doc.name} ${ctx.datamangd}${ctx.grupp ? ' ' + ctx.grupp : ''}`;
      let blob;
      if (format === 'html') blob = new Blob([builders.toHtml(ast, { title })], { type: fmt.mime });
      else if (format === 'docx') blob = await office.toDocx(ast, { title, description: D.t('doc.created.from', { name: ctx.datamangd }) });
      else if (format === 'pdf') blob = await office.toPdf(ast, { title });
      else if (format === 'md') {
        const md = builders.toMarkdown(ast);
        if (Object.keys(md.figures).length) { const f = Object.assign({ [files.safeName(baseName, 'md')]: md.text }, md.figures); blob = await zip.createZip(f, { level: 6 }); return { blob, filename: files.safeName(baseName, 'zip'), format, problems }; }
        blob = new Blob([md.text], { type: fmt.mime });
      } else {
        const tex = builders.toLatex(ast, { title, date: ctx.datum });
        blob = await zip.createZip(Object.assign({ 'main.tex': tex.text }, tex.figures), { level: 6 });
      }
      return { blob, filename: files.safeName(baseName, fmt.ext), format, problems };
    }

    /** DOM preview of the document. */
    async function preview(doc, datasetId, options = {}) {
      const { ast, ctx } = await buildAst(doc, datasetId, options);
      return { el: builders.toDom(ast), ast, ctx };
    }

    /**
     * One document per value of a column, packed in a ZIP with a manifest. `problems`: what the documents could not show.
     * @param {any} doc @param {string} datasetId
     * @param {{groupColumn: string, format: string, pattern?: string, limit?: number, signal?: AbortSignal, onProgress?: Function, ask?: boolean}} options
     */
    async function batch(doc, datasetId, options) {
      const values = await vizData.distinctValues(datasetId, options.groupColumn, options.limit || 500);
      if (!values.length) throw new Error(D.t('doc.err.group.empty'));
      const fmt = FORMATS.find((f) => f.id === options.format) || FORMATS[0];
      const out = {}; const names = []; const errors = []; const problems = new Set();
      let done = 0;
      for (const value of values) {
        if (options.signal && options.signal.aborted) throw Object.assign(new Error('Avbrutet.'), { kind: 'aborted' });
        try {
          const name = String(options.pattern || '{dokument}-{grupp}').replace('{dokument}', doc.name).replace('{grupp}', String(value));
          const result = await generate(doc, datasetId, fmt.id, { group: { column: options.groupColumn, value }, filename: name, ask: options.ask });
          for (const p of result.problems) problems.add(p);
          const bytes = new Uint8Array(await result.blob.arrayBuffer());
          if (result.filename.endsWith('.zip') && fmt.id !== 'tex' && fmt.id !== 'md') { out[result.filename] = bytes; }
          else if (fmt.id === 'tex' || (fmt.id === 'md' && result.filename.endsWith('.zip'))) {
            // Nested archives are unpacked into one folder per group.
            const inner = await zip.readZip(result.blob);
            const folder = files.safeName(name);
            for (const [path, data] of Object.entries(inner)) out[`${folder}/${path}`] = data;
          } else out[result.filename] = bytes;
          names.push(result.filename);
        } catch (err) { errors.push({ group: value, message: (err && err.message) || String(err) }); }
        done++;
        if (options.onProgress) options.onProgress({ done, total: values.length, value });
      }
      if (!names.length) throw new Error(D.t('doc.err.none.created', { message: errors[0] ? errors[0].message : '' }));
      out['manifest.json'] = new TextEncoder().encode(JSON.stringify({ app: 'Dataspatium', kind: 'document-batch', template: doc.name, dataset: datasetId, groupColumn: options.groupColumn, format: fmt.id, groups: values.length, files: names, errors, created: new Date().toISOString() }, null, 2));
      const blob = await zip.createZip(out, { level: 6 });
      // What the documents could not show (a chart not drawn, a group whose document failed), once each, for a flow's log.
      for (const e of errors) problems.add(`${e.group}: ${e.message}`);
      return { blob, count: names.length, files: names, errors, problems: Array.from(problems) };
    }

    return { FORMATS, buildAst, generate, preview, batch };
  });
})();
