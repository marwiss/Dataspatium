// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * PDF reading with pdf.js 3.11 (the last build that ships as classic scripts). The display layer runs on the
 * main thread (DOM canvas, fonts through the FontFace API); the parsing runs in one of Dataspatium's own
 * shimmed classic Blob workers, into which the pdf.js worker build is imported: it then attaches itself to the
 * worker's message port, and pdf.js talks to it through `GlobalWorkerOptions.workerPort`. Standard fonts are
 * embedded assets that the worker fetches through the asset shim. No nested workers, no module workers.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /** Runs inside the worker: loads the pdf.js worker build once the shim has delivered the assets. */
  function dataspatiumPdfWorker() {
    'use strict';
    var dm = self.__dataspatium;
    dm.ready.then(function () {
      importScripts('dataspatium-asset://pdfjs/pdf.worker.min.js');
      self.postMessage({ dmPdf: 'ready' });
    });
  }

  D.define('engines/pdf', [], () => {
    const FONTS = 'dataspatium-asset://pdfjs/standard_fonts/';
    /** @type {Promise<any>|null} */ let ready = null;
    /** @type {any} */ let worker = null;

    /** Load the display layer and start the worker (idempotent). Resolves with the pdfjsLib object. */
    function load() {
      if (ready) return ready;
      ready = (async () => {
        if (!globalThis.pdfjsLib) await D.assets.loadVendorScript('vendor/pdfjs/pdf.min.js');
        D.workers.provider('pdfjs', { initial: async () => ['pdfjs/pdf.worker.min.js'].concat(D.assets.names('pdfjs/standard_fonts/')) });
        worker = D.workers.create({ namespace: 'pdfjs', source: D.workers.functionSource(dataspatiumPdfWorker), name: 'pdf' });
        await new Promise((resolve, reject) => {
          worker.addEventListener('message', (ev) => { if (ev.data && ev.data.dmPdf === 'ready') resolve(undefined); });
          worker.onerror = (ev) => reject(new Error('PDF worker: ' + ((ev && ev.message) || 'error')));
          setTimeout(() => reject(new Error('PDF worker did not start')), 60000);
        });
        globalThis.pdfjsLib.GlobalWorkerOptions.workerPort = worker;
        return globalThis.pdfjsLib;
      })().catch((err) => { ready = null; throw err; });
      return ready;
    }

    /** Open a PDF from bytes. The returned document has numPages, getPage, getMetadata and destroy. */
    async function open(bytes) {
      const lib = await load();
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      return lib.getDocument({ data, standardFontDataUrl: FONTS, isEvalSupported: false }).promise;
    }

    /**
     * Paragraphs of one page from pdf.js text items: items become lines by their baseline, lines become
     * paragraphs when the vertical gap grows beyond the usual line distance; a line set in a clearly larger size
     * than the page's text is a heading.
     * @param {any[]} items `getTextContent().items`
     * @returns {Array<{text: string, heading: boolean}>}
     */
    function paragraphsOf(items) {
      const glyphs = items.filter((i) => i && typeof i.str === 'string' && i.str.trim() && Array.isArray(i.transform));
      if (!glyphs.length) return [];
      const lines = [];
      for (const it of glyphs) {
        const y = it.transform[5]; const x = it.transform[4]; const h = Math.abs(it.transform[3]) || it.height || 10;
        const line = lines.find((l) => Math.abs(l.y - y) <= Math.max(2, h * 0.4));
        if (line) line.items.push({ x, str: it.str, h, width: it.width || 0 });
        else lines.push({ y, items: [{ x, str: it.str, h, width: it.width || 0 }] });
      }
      lines.sort((a, b) => b.y - a.y);
      const heights = [];
      for (const l of lines) {
        l.items.sort((a, b) => a.x - b.x);
        let text = ''; let prevEnd = null;
        for (const it of l.items) {
          if (prevEnd !== null && it.x - prevEnd > it.h * 0.25 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
          text += it.str; prevEnd = it.x + it.width;
        }
        l.text = text.replace(/\s+/g, ' ').trim();
        l.h = l.items.reduce((m, it) => Math.max(m, it.h), 0);
        heights.push(l.h);
      }
      heights.sort((a, b) => a - b);
      const median = heights[Math.floor(heights.length / 2)] || 10;
      const out = [];
      let current = null; let prevY = null; let prevH = median;
      for (const l of lines) {
        const heading = l.h > median * 1.3 && l.text.length < 200;
        const gap = prevY === null ? 0 : prevY - l.y;
        const newBlock = !current || heading || current.heading || gap > Math.max(prevH, median) * 1.6;
        if (newBlock) { current = { text: l.text, heading }; out.push(current); }
        else current.text += (/-$/.test(current.text) ? '' : ' ') + l.text;
        prevY = l.y; prevH = l.h;
      }
      return out.filter((p) => p.text);
    }

    /**
     * Text of every page as paragraphs.
     * @param {any} doc @param {{onProgress?: (info: {page: number, pages: number}) => void}} [options]
     * @returns {Promise<Array<{page: number, paragraphs: Array<{text: string, heading: boolean}>}>>}
     */
    async function extract(doc, options = {}) {
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        pages.push({ page: p, paragraphs: paragraphsOf(content.items) });
        page.cleanup();
        if (options.onProgress) options.onProgress({ page: p, pages: doc.numPages });
      }
      return pages;
    }

    /** "D:20240601123000+02'00'" -> ISO text, or the input when it is not a PDF date. */
    function pdfDate(s) {
      const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(String(s || ''));
      if (!m) return s ? String(s) : null;
      return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}${m[4] ? ` ${m[4]}:${m[5] || '00'}:${m[6] || '00'}` : ''}`;
    }

    /** Title, author, subject, dates and producer from the document information dictionary. */
    async function metadata(doc) {
      let info = {};
      try { info = (await doc.getMetadata()).info || {}; } catch (_err) { info = {}; }
      return { title: info.Title || null, author: info.Author || null, subject: info.Subject || null, created: pdfDate(info.CreationDate), modified: pdfDate(info.ModDate), producer: info.Producer || info.Creator || null };
    }

    /**
     * Draw a page into a canvas at the given width (CSS pixels; the device pixel ratio sharpens it).
     * @param {any} doc @param {number} pageNo @param {HTMLCanvasElement} canvas @param {{width?: number, scale?: number}} [options]
     */
    async function render(doc, pageNo, canvas, options = {}) {
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const scale = options.scale || (options.width ? options.width / base.width : 1.5);
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      canvas.style.width = Math.ceil(viewport.width / dpr) + 'px'; canvas.style.height = Math.ceil(viewport.height / dpr) + 'px';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return { width: viewport.width / dpr, height: viewport.height / dpr, pages: doc.numPages };
    }

    return { load, open, extract, paragraphsOf, metadata, render, pdfDate, FONTS, available: () => !!ready };
  });
})();
