// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Chart export helpers: SVG text to Blob, PNG (via canvas, with the Inter font embedded so text
 * renders the same as on screen) and PDF (jsPDF + svg2pdf.js, loaded on demand).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/export', [], () => {
    let fontCssPromise = null;
    const toB64 = (buf) => { const bytes = new Uint8Array(buf); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000))); return btoa(s); };

    /** @font-face rules with the embedded Inter files as data URLs (cached). */
    function fontCss() {
      if (!fontCssPromise) {
        fontCssPromise = (async () => {
          const rules = [];
          for (const [weight, name] of [[400, 'fonts/inter-latin-400-normal.woff2'], [500, 'fonts/inter-latin-500-normal.woff2'], [600, 'fonts/inter-latin-600-normal.woff2']]) {
            try { const buf = await D.assets.load(name); rules.push(`@font-face{font-family:"Inter";font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${toB64(buf)}) format("woff2");}`); } catch (_e) { /* font optional */ }
          }
          return rules.join('');
        })();
      }
      return fontCssPromise;
    }

    /** Size of an SVG from its attributes or viewBox. */
    function svgSize(svgText) {
      const w = /<svg[^>]*\swidth="([\d.]+)(px)?"/.exec(svgText); const h = /<svg[^>]*\sheight="([\d.]+)(px)?"/.exec(svgText);
      if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
      const vb = /<svg[^>]*\sviewBox="([\d.\s-]+)"/.exec(svgText);
      if (vb) { const p = vb[1].trim().split(/\s+/).map(Number); return { width: p[2], height: p[3] }; }
      return { width: 640, height: 400 };
    }

    /** SVG with the Inter font embedded in a <style> element (for PNG rendering and sharing). */
    async function svgWithFonts(svgText) {
      if (!/Inter/.test(svgText)) return svgText;
      const css = await fontCss();
      if (!css) return svgText;
      return svgText.replace(/<svg([^>]*)>/, (m, attrs) => `<svg${attrs}><style>${css}</style>`);
    }

    function svgBlob(svgText) { return new Blob([svgText.startsWith('<?xml') ? svgText : '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText], { type: 'image/svg+xml;charset=utf-8' }); }

    /** Rasterise SVG text to a PNG blob. */
    async function svgToPng(svgText, options = {}) {
      const { width, height } = svgSize(svgText);
      const scale = options.scale || 2;
      const text = await svgWithFonts(svgText);
      const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Kunde inte rita SVG till bild.')); i.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte skapa PNG.'))), 'image/png'));
      } finally { URL.revokeObjectURL(url); }
    }

    let pdfLibs = null;
    async function ensurePdfLibs() {
      if (!pdfLibs) {
        pdfLibs = (async () => {
          if (!globalThis.jspdf) await D.assets.loadVendorScript('vendor/jspdf/jspdf.umd.min.js');
          if (!globalThis.svg2pdf) await D.assets.loadVendorScript('vendor/svg2pdf.js/svg2pdf.umd.min.js');
          return globalThis.jspdf.jsPDF;
        })();
      }
      return pdfLibs;
    }

    /** Vector PDF from SVG text (one page sized to the chart, in points). */
    async function svgToPdf(svgText, options = {}) {
      const jsPDF = await ensurePdfLibs();
      const { width, height } = svgSize(svgText);
      const doc = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'pt', format: [width, height], compress: true });
      const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const el = parsed.documentElement;
      if (el.querySelector('parsererror')) throw new Error('SVG kunde inte tolkas för PDF.');
      // svg2pdf needs the element in a document to resolve computed styles.
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute; left:-20000px; top:0;';
      holder.appendChild(document.importNode(el, true));
      document.body.appendChild(holder);
      try {
        await doc.svg(holder.firstElementChild, { x: 0, y: 0, width, height });
      } finally { holder.remove(); }
      if (options.title) doc.setProperties({ title: options.title, creator: 'Dataspatium' });
      return doc.output('blob');
    }

    const MIME = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
    return { svgBlob, svgToPng, svgToPdf, svgWithFonts, svgSize, fontCss, ensurePdfLibs, MIME };
  });
})();
