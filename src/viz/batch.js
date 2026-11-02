// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Batch generation: one chart per value of a grouping column (every municipality, every year),
 * rendered headless in turn and packed into a ZIP. Vega and D3 charts render in the browser; R charts
 * run sequentially in the R session.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/batch', ['viz/render', 'viz/data', 'viz/export', 'platform/storage/zip', 'platform/files', 'data/datasets'], (render, vizData, vizExport, zip, files, datasets) => {
    function fileName(pattern, chart, value, format) {
      const name = String(pattern || '{diagram}-{grupp}').replace('{diagram}', chart.name || 'diagram').replace('{grupp}', String(value));
      return files.safeName(name, format);
    }

    /**
     * @param {any} chart saved chart (vega or d3; r through options.renderR)
     * @param {{groupColumn: string, formats?: string[], pattern?: string, width?: number, scale?: number, limit?: number, signal?: AbortSignal, onProgress?: Function, renderR?: (chart: any, value: any, format: string) => Promise<Blob>}} options
     * @returns {Promise<{blob: Blob, count: number, files: string[], errors: Array<{group: any, message: string}>}>}
     */
    async function run(chart, options) {
      const formats = options.formats && options.formats.length ? options.formats : ['png'];
      const values = await vizData.distinctValues(chart.datasetId, options.groupColumn, options.limit || 500);
      if (!values.length) throw new Error('Grupperingskolumnen saknar värden.');
      const out = {}; const names = []; const errors = [];
      let done = 0;
      for (const value of values) {
        if (options.signal && options.signal.aborted) throw Object.assign(new Error('Avbrutet.'), { kind: 'aborted' });
        const extraFilters = [{ field: options.groupColumn, op: '=', value }];
        for (const format of formats) {
          try {
            const blob = chart.kind === 'r'
              ? await (options.renderR ? options.renderR(chart, value, format) : Promise.reject(new Error('R-diagram kräver R-sessionen.')))
              : await render.toBlob(chart, format, { extraFilters, titleSuffix: ` – ${value}`, width: options.width || 800, scale: options.scale || 2 });
            const name = fileName(options.pattern, chart, value, format);
            out[name] = new Uint8Array(await blob.arrayBuffer());
            names.push(name);
          } catch (err) { errors.push({ group: value, message: (err && err.message) || String(err) }); }
        }
        done++;
        if (options.onProgress) options.onProgress({ done, total: values.length, value });
      }
      if (!names.length) throw new Error('Inga diagram kunde skapas: ' + (errors[0] ? errors[0].message : ''));
      const manifest = { app: 'Dataspatium', kind: 'chart-batch', chart: chart.name, dataset: chart.datasetName, groupColumn: options.groupColumn, groups: values.length, files: names, errors, created: new Date().toISOString() };
      out['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const blob = await zip.createZip(out, { level: 6 });
      return { blob, count: names.length, files: names, errors };
    }

    /**
     * One PowerPoint slide per group value (Vega and D3 headless; R through options.renderR).
     * @param {any} chart
     * @param {{groupColumn: string, width?: number, limit?: number, signal?: AbortSignal, onProgress?: Function, renderR?: Function}} options
     * @returns {Promise<{blob: Blob, count: number, errors: Array<{group: any, message: string}>}>}
     */
    async function deck(chart, options) {
      const pptx = D.require('viz/pptx');
      const values = await vizData.distinctValues(chart.datasetId, options.groupColumn, options.limit || 500);
      if (!values.length) throw new Error('Grupperingskolumnen saknar värden.');
      const slides = []; const errors = [];
      let done = 0;
      for (const value of values) {
        if (options.signal && options.signal.aborted) throw Object.assign(new Error('Avbrutet.'), { kind: 'aborted' });
        try {
          const png = chart.kind === 'r'
            ? await (options.renderR ? options.renderR(chart, value, 'png') : Promise.reject(new Error('R-diagram kräver R-sessionen.')))
            : await render.toBlob(chart, 'png', { extraFilters: [{ field: options.groupColumn, op: '=', value }], titleSuffix: ` – ${value}`, width: options.width || 1200, scale: 2 });
          const size = await pptx.imageSize(png);
          slides.push({ title: `${chart.name || 'Diagram'} – ${value}`, png, width: size.width, height: size.height, note: chart.datasetName || '' });
        } catch (err) { errors.push({ group: value, message: (err && err.message) || String(err) }); }
        done++;
        if (options.onProgress) options.onProgress({ done, total: values.length, value });
      }
      if (!slides.length) throw new Error('Inga diagram kunde skapas: ' + (errors[0] ? errors[0].message : ''));
      const blob = await pptx.build({ title: chart.name || 'Diagram', subtitle: [chart.datasetName, `${options.groupColumn}: ${values.length}`].filter(Boolean).join(' · '), slides });
      return { blob, count: slides.length, errors };
    }

    return { run, deck, fileName };
  });
})();
