// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What reading text in pictures does with the data: the pages of a scanned PDF get their text in the document's table, pictures
 * become a document collection, and a picture of a table becomes text for the normal import. Machine-read text can be wrong, so
 * it is marked: each document says which pages were read this way and how sure the reading was.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/ocr', ['data/datasets', 'data/dataset-files', 'engines/ocr'], (datasets, dsFiles, engine) => {
    /** An A4 page at about 200 dots per inch, which is what reading needs without taking too long. */
    const PAGE_WIDTH = 1654;
    const countWords = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) || []).length;

    /**
     * Paragraphs from read text: empty lines separate them, line breaks inside them go away, a word split at a line end is joined.
     * @param {string} text @returns {string[]}
     */
    function paragraphsOf(text) {
      return String(text || '').split(/\n\s*\n/)
        .map((p) => p.replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2').replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean);
    }
    /**
     * A picture of a table as text with semicolons, for the import to read. Two spaces or more separate the columns; when the
     * reading kept only single spaces and every line has as many words, each word is a column.
     * @param {string} text @returns {string}
     */
    function tableText(text) {
      const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const cells = lines.map((l) => l.split(/\s{2,}|\t/));
      if (cells.some((c) => c.length > 1)) return cells.map((c) => c.join(';')).join('\n');
      const words = lines.map((l) => l.split(/\s+/));
      const same = lines.length > 1 && words[0].length > 1 && words.every((w) => w.length === words[0].length);
      return (same ? words.map((w) => w.join(';')) : lines).join('\n');
    }
    /** @param {any} doc from the dataset's list of documents @returns {boolean} */
    const isPdf = (doc) => !!doc && (doc.type === 'pdf' || /\.pdf$/i.test(doc.name || ''));
    /**
     * The pages of a PDF that have no text.
     * @param {string} id @param {any} doc @returns {Promise<number[]>}
     */
    async function pagesWithoutText(id, doc) {
      if (!isPdf(doc)) return [];
      const handle = await datasets.ensureOpen(id);
      const r = await handle.engine.exec("select distinct sida from data where dokument = ? and text is not null and trim(text) != ''", [doc.name]);
      const have = new Set((r[0] ? r[0].values : []).map((row) => Number(row[0])));
      const out = [];
      for (let page = 1; page <= (Number(doc.pages) || 1); page++) if (!have.has(page)) out.push(page);
      return out;
    }
    /** The share of a document that was read by machine, for the document's own line. @param {any} doc @param {number} page @returns {any} */
    function readingOf(doc, page) {
      return doc && doc.ocr && (doc.ocr.pages || []).includes(page) ? doc.ocr : null;
    }

    /** A page of a PDF as a picture. */
    async function pagePicture(pdf, opened, page) {
      const canvas = document.createElement('canvas');
      await pdf.render(opened, page, canvas, { width: PAGE_WIDTH / Math.min(2, globalThis.devicePixelRatio || 1) });
      return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas'))), 'image/png'));
    }
    /**
     * Read the pages of a PDF that have no text. Pages already read stay if it is stopped.
     * @param {string} id @param {any} doc @param {{language?: string, onProgress?: (done: number, total: number) => void, signal?: {stop?: boolean}}} [options]
     * @returns {Promise<{pages: number, words: number, confidence: number}>}
     */
    async function readDocument(id, doc, options = {}) {
      const pages = await pagesWithoutText(id, doc);
      if (!pages.length) return { pages: 0, words: 0, confidence: 0 };
      const file = await dsFiles.read(id, doc.name, 'original');
      if (!file) throw new Error(D.t('ocr.err.original'));
      const pdf = D.require('engines/pdf');
      const opened = await pdf.open(file.bytes.slice());
      const out = []; const sure = [];
      try {
        for (let i = 0; i < pages.length; i++) {
          if (options.signal && options.signal.stop) break;
          if (options.onProgress) options.onProgress(i, pages.length);
          const res = await engine.read(await pagePicture(pdf, opened, pages[i]), { language: options.language });
          out.push({ page: pages[i], paragraphs: paragraphsOf(res.text) });
          sure.push(res.confidence);
        }
      } finally { await opened.destroy(); }
      if (!out.length) return { pages: 0, words: 0, confidence: 0 };
      const confidence = Math.round(sure.reduce((a, b) => a + b, 0) / sure.length);
      await D.require('data/recipes').apply(id, 'ocr_text', { document: doc.name, pages: JSON.stringify(out), language: options.language || 'sv', confidence: String(confidence) });
      await datasets.save(id);
      datasets.notify('changed', { id });
      if (options.onProgress) options.onProgress(pages.length, pages.length);
      const words = out.reduce((n, x) => n + x.paragraphs.reduce((m, s) => m + countWords(s), 0), 0);
      return { pages: out.length, words, confidence };
    }
    /** Any picture as PNG, upright: what Tesseract reads best and the same for every format the browser can open. */
    async function normalised(blob) {
      if (blob.type === 'image/png') return blob;
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.convertToBlob({ type: 'image/png' });
    }
    /**
     * The text in a picture of a collection.
     * @param {string} id @param {string} name @param {{language?: string}} [options] @returns {Promise<{text: string, confidence: number}>}
     */
    async function readPicture(id, name, options = {}) {
      const file = await dsFiles.read(id, name, 'preview');
      if (!file) throw new Error(D.t('ocr.err.original'));
      return engine.read(await normalised(new Blob([file.bytes], { type: file.type })), { language: options.language });
    }
    /**
     * Pictures as a document collection, one document per picture. The picture collection stays as it is.
     * @param {string} id @param {string[]} names
     * @param {{language?: string, name?: string, onProgress?: (done: number, total: number) => void, signal?: {stop?: boolean}}} [options]
     * @returns {Promise<any>} the new dataset, or null when nothing was read
     */
    async function picturesToDocuments(id, names, options = {}) {
      const rows = []; const documents = []; const files = [];
      for (let i = 0; i < names.length; i++) {
        if (options.signal && options.signal.stop) break;
        if (options.onProgress) options.onProgress(i, names.length);
        const res = await readPicture(id, names[i], options);
        const paragraphs = paragraphsOf(res.text);
        paragraphs.forEach((text, n) => rows.push([names[i], 1, n + 1, 'stycke', text, text.length]));
        const file = await dsFiles.read(id, names[i], 'preview');
        files.push({ name: names[i], kind: 'original', type: file.type, bytes: file.bytes });
        documents.push({ name: names[i], type: 'image', size: file.bytes.length, pages: 1, paragraphs: paragraphs.length, words: paragraphs.reduce((m, s) => m + countWords(s), 0), ocr: { pages: [1], language: options.language || 'sv', confidence: res.confidence } });
      }
      if (!documents.length) return null;
      if (options.onProgress) options.onProgress(names.length, names.length);
      return dsFiles.createDataset({
        name: options.name || D.t('import.collection.documents', { n: documents.length }), kind: 'document', columns: D.require('io/importers/documents').COLUMNS, rows, files,
        source: { kind: 'derived', from: id, op: 'ocr' }, meta: { documents },
      });
    }
    /**
     * A picture of a table as text for the import.
     * @param {Blob} blob @param {{language?: string}} [options] @returns {Promise<{text: string, confidence: number}>}
     */
    async function readTable(blob, options = {}) {
      const res = await engine.read(await normalised(blob), { language: options.language, table: true });
      return { text: tableText(res.text), confidence: res.confidence };
    }

    return { paragraphsOf, tableText, isPdf, pagesWithoutText, readingOf, readDocument, readPicture, picturesToDocuments, readTable };
  });
})();
