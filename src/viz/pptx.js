// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * PowerPoint export with PptxGenJS (vendor/pptxgenjs): a title slide and one chart per slide, from saved
 * charts, a dashboard or a batch (one slide per group). Charts are rendered headless to PNG at 2x.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/pptx', ['viz/render', 'viz/theme'], (render, theme) => {
    const LAYOUT = { width: 10, height: 5.625 };
    const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    async function lib() {
      await D.assets.loadVendorScript('vendor/pptxgenjs/pptxgen.bundle.js');
      const P = /** @type {any} */ (globalThis).PptxGenJS;
      if (!P) throw new Error(D.t('viz.err.pptx.load'));
      return P;
    }
    const hex = (css) => String(css || '').trim().replace(/^#/, '').slice(0, 6) || '1F2937';
    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
    }
    async function imageSize(blob) {
      try { const bmp = await createImageBitmap(blob); const size = { width: bmp.width, height: bmp.height }; bmp.close(); return size; } catch (_err) { return { width: 16, height: 9 }; }
    }

    /**
     * Build a presentation.
     * @param {{title?: string, subtitle?: string, slides: Array<{title?: string, note?: string, png?: Blob, dataUrl?: string, width?: number, height?: number}>}} deck
     * @returns {Promise<Blob>}
     */
    async function build(deck) {
      const PptxGenJS = await lib();
      const tk = theme.tokens();
      const text = hex(tk.text); const muted = hex(tk.textMuted || tk.muted || '6B7280'); const accent = hex(tk.palette && tk.palette[0]);
      const font = 'Calibri';
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.title = deck.title || 'Dataspatium';
      pptx.author = 'Dataspatium';
      pptx.lang = 'sv-SE';
      if (deck.title) {
        const s = pptx.addSlide();
        s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.55, w: 1.2, h: 0.08, fill: { color: accent }, line: { color: accent } });
        s.addText(deck.title, { x: 0.5, y: 1.4, w: 9, h: 1.0, fontSize: 32, fontFace: font, bold: true, color: text });
        if (deck.subtitle) s.addText(deck.subtitle, { x: 0.5, y: 2.8, w: 9, h: 0.6, fontSize: 16, fontFace: font, color: muted });
      }
      for (const sl of deck.slides) {
        const s = pptx.addSlide();
        s.addText(sl.title || '', { x: 0.5, y: 0.25, w: 9, h: 0.6, fontSize: 20, fontFace: font, bold: true, color: text });
        const dataUrl = sl.dataUrl || (sl.png ? await blobToDataUrl(sl.png) : null);
        if (dataUrl) {
          const size = sl.width && sl.height ? { width: sl.width, height: sl.height } : (sl.png ? await imageSize(sl.png) : { width: 16, height: 9 });
          const ratio = size.width / size.height;
          const maxW = LAYOUT.width - 1; const maxH = LAYOUT.height - 1.45;
          let w = maxW; let h = w / ratio;
          if (h > maxH) { h = maxH; w = h * ratio; }
          s.addImage({ data: dataUrl, x: (LAYOUT.width - w) / 2, y: 0.95, w, h });
        }
        if (sl.note) s.addText(sl.note, { x: 0.5, y: LAYOUT.height - 0.45, w: 9, h: 0.3, fontSize: 10, fontFace: font, color: muted });
      }
      const out = await pptx.write({ outputType: 'blob' });
      return out instanceof Blob ? new Blob([out], { type: MIME }) : new Blob([/** @type {any} */ (out)], { type: MIME });
    }

    /**
     * One slide per saved chart, rendered headless (R and Python through their engines; a failing chart is skipped).
     * @param {any[]} chartList
     * @param {{title?: string, subtitle?: string, note?: string, width?: number, extraFilters?: any[], onProgress?: Function}} [options]
     */
    async function fromCharts(chartList, options = {}) {
      const slides = []; const skipped = [];
      let done = 0;
      for (const chart of chartList) {
        let png;
        // R and Python charts render through their engines; a chart that fails is skipped and named in the result.
        try { png = await render.toBlob(chart, 'png', { width: options.width || 1200, scale: 2, extraFilters: options.extraFilters }); }
        catch (err) { D.log('pptx', 'chart skipped', chart.name, err); skipped.push(chart.name); continue; }
        const size = await imageSize(png);
        slides.push({ title: chart.name, png, width: size.width, height: size.height, note: [chart.datasetName, options.note].filter(Boolean).join(' · ') });
        done++;
        if (options.onProgress) options.onProgress({ done, total: chartList.length });
      }
      if (!slides.length) throw new Error(D.t('viz.err.pptx.none'));
      const blob = await build({ title: options.title, subtitle: options.subtitle, slides });
      return { blob, count: slides.length, skipped };
    }

    return { build, fromCharts, blobToDataUrl, imageSize, MIME };
  });
})();
