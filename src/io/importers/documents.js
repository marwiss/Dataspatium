// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Documents as datasets (kind "document"): PDF, Word (docx), OpenDocument (odt), plain text and Markdown become
 * one row per paragraph with the document name, page, running number, type (rubrik, stycke, tabell), text and
 * character count. The original files travel in the dataset (data/dataset-files), so PDF pages can be shown and
 * the text re-read. PDF text comes from pdf.js in a worker (engines/pdf); docx and odt are read with the
 * platform's XML parser; text files are split at blank lines.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/documents', ['platform/storage/zip', 'data/dataset-files'], (zip, dsFiles) => {
    const EXT_DEFAULT = /\.(pdf|docx|odt|md|markdown)$/i;
    const EXT_ALL = /\.(pdf|docx|odt|md|markdown|txt)$/i;
    const COLUMNS = [
      { name: 'dokument', type: 'text' }, { name: 'sida', type: 'integer' }, { name: 'stycke', type: 'integer' },
      { name: 'typ', type: 'text' }, { name: 'text', type: 'text' }, { name: 'tecken', type: 'integer' },
    ];
    const HEADING_STYLE = /heading|rubrik|overskrift|otsikko|fyrirs|title|titel/i;
    /** Parsed files, so that preview and import read a file once. @type {WeakMap<File, any>} */
    const cache = new WeakMap();

    /** .pdf, .docx, .odt and Markdown go here by default; .txt only when chosen (data files are usually CSV). */
    function detect(file) { return EXT_DEFAULT.test(file.name) || file.type === 'application/pdf'; }
    function accepts(file) { return EXT_ALL.test(file.name) || file.type === 'application/pdf'; }

    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const words = (s) => (String(s || '').match(/[\p{L}\p{N}]+/gu) || []).length;

    function decodeText(bytes) {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (_err) { return new TextDecoder('windows-1252').decode(bytes); }
    }

    /** Paragraphs of plain text or Markdown: blocks separated by blank lines; Markdown headings keep their level. */
    function paragraphsFromText(text, markdown) {
      const out = [];
      for (const block of String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
        const lines = block.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
        if (!lines.length) continue;
        if (markdown && lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) { out.push({ text: clean(lines[0].replace(/^#{1,6}\s+/, '').replace(/\s#+$/, '')), heading: true }); continue; }
        if (markdown) {
          // A heading line may share a block with its paragraph.
          let i = 0;
          while (i < lines.length && /^#{1,6}\s+/.test(lines[i])) { out.push({ text: clean(lines[i].replace(/^#{1,6}\s+/, '')), heading: true }); i++; }
          const rest = lines.slice(i).join('\n');
          if (/^(-{3,}|={3,}|\*{3,})$/.test(rest.trim())) continue;
          if (rest.trim()) out.push({ text: clean(rest.replace(/^[-*+]\s+/gm, '• ').replace(/^\d+\.\s+/gm, (m) => m)), heading: false });
          continue;
        }
        out.push({ text: clean(lines.join(' ')), heading: false });
      }
      return out;
    }

    // ---- Word (docx): paragraphs, headings by style, page breaks, tables as rows ------------------------
    const kids = (el, name) => Array.from(el.children).filter((c) => c.localName === name);
    function runText(p) {
      let text = '';
      const walk = (node) => {
        for (const c of Array.from(node.childNodes)) {
          if (c.nodeType === 3) continue;
          const el = /** @type {Element} */ (c);
          if (el.localName === 't') text += el.textContent;
          else if (el.localName === 'tab') text += '\t';
          else if (el.localName === 'br' || el.localName === 'cr') text += ' ';
          else if (el.localName === 'sym') text += '';
          else if (el.localName !== 'rPr' && el.localName !== 'pPr' && el.localName !== 'del' && el.localName !== 'instrText') walk(el);
        }
      };
      walk(p);
      return clean(text);
    }
    const styleOf = (p) => { const pr = kids(p, 'pPr')[0]; const st = pr ? kids(pr, 'pStyle')[0] : null; return st ? String(st.getAttribute('w:val') || st.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val') || '') : ''; };
    function docxParagraphs(entries) {
      const xml = entries['word/document.xml'];
      if (!xml) throw new Error(D.t('import.err.docx'));
      const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
      const body = doc.getElementsByTagNameNS('*', 'body')[0];
      const out = [];
      let page = 1;
      const pageBreaksIn = (p) => Array.from(p.getElementsByTagNameNS('*', 'br')).filter((br) => (br.getAttribute('w:type') || br.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'type')) === 'page').length + p.getElementsByTagNameNS('*', 'lastRenderedPageBreak').length;
      const visit = (el) => {
        if (el.localName === 'p') {
          const breaks = pageBreaksIn(el);
          const text = runText(el);
          if (breaks && !text && out.length) { page += breaks; return; }
          if (!text) return;
          out.push({ page, text, heading: HEADING_STYLE.test(styleOf(el)), type: HEADING_STYLE.test(styleOf(el)) ? 'rubrik' : 'stycke' });
          if (breaks) page += breaks;
        } else if (el.localName === 'tbl') {
          for (const tr of kids(el, 'tr')) {
            const cells = kids(tr, 'tc').map((tc) => Array.from(tc.getElementsByTagNameNS('*', 'p')).map(runText).filter(Boolean).join(' '));
            const text = cells.join(' | ').trim();
            if (text) out.push({ page, text, heading: false, type: 'tabell' });
          }
        } else if (el.localName === 'sdt' || el.localName === 'sdtContent') {
          for (const c of Array.from(el.children)) visit(c);
        }
      };
      for (const el of Array.from(body ? body.children : [])) visit(el);
      return { paragraphs: out, pages: page };
    }
    function docxMeta(entries) {
      const xml = entries['docProps/core.xml'];
      const meta = { title: null, author: null, created: null, modified: null };
      if (!xml) return meta;
      const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
      const get = (name) => { const el = doc.getElementsByTagNameNS('*', name)[0]; return el && el.textContent ? el.textContent.trim() : null; };
      return { title: get('title'), author: get('creator'), created: get('created'), modified: get('modified') };
    }

    // ---- OpenDocument (odt) ---------------------------------------------------------------------------
    function odtText(el) {
      let text = '';
      const walk = (node) => {
        for (const c of Array.from(node.childNodes)) {
          if (c.nodeType === 3) { text += c.nodeValue; continue; }
          const e = /** @type {Element} */ (c);
          if (e.localName === 's') text += ' '.repeat(Number(e.getAttribute('text:c') || e.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'c') || 1));
          else if (e.localName === 'tab') text += '\t';
          else if (e.localName === 'line-break') text += ' ';
          else if (e.localName === 'note' || e.localName === 'annotation' || e.localName === 'tracked-changes') continue;
          else walk(e);
        }
      };
      walk(el);
      return clean(text);
    }
    function odtParagraphs(entries) {
      const xml = entries['content.xml'];
      if (!xml) throw new Error(D.t('import.err.odt'));
      const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
      const textEl = doc.getElementsByTagNameNS('*', 'text')[0];
      const out = [];
      let page = 1;
      const visit = (el) => {
        const name = el.localName;
        if (name === 'soft-page-break') { page++; return; }
        if (name === 'h' || name === 'p') {
          const breaks = el.getElementsByTagNameNS('*', 'soft-page-break').length;
          const text = odtText(el);
          if (text) out.push({ page, text, heading: name === 'h', type: name === 'h' ? 'rubrik' : 'stycke' });
          page += breaks;
        } else if (name === 'table') {
          for (const tr of Array.from(el.getElementsByTagNameNS('*', 'table-row'))) {
            const cells = Array.from(tr.children).filter((c) => c.localName === 'table-cell').map((tc) => Array.from(tc.children).map(odtText).filter(Boolean).join(' '));
            const text = cells.join(' | ').trim();
            if (text) out.push({ page, text, heading: false, type: 'tabell' });
          }
        } else if (name === 'list' || name === 'list-item' || name === 'section' || name === 'list-header') {
          for (const c of Array.from(el.children)) visit(c);
        }
      };
      for (const el of Array.from(textEl ? textEl.children : [])) visit(el);
      return { paragraphs: out, pages: page };
    }
    function odtMeta(entries) {
      const xml = entries['meta.xml'];
      const meta = { title: null, author: null, created: null, modified: null };
      if (!xml) return meta;
      const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
      const get = (name) => { const el = doc.getElementsByTagNameNS('*', name)[0]; return el && el.textContent ? el.textContent.trim() : null; };
      return { title: get('title'), author: get('initial-creator') || get('creator'), created: get('creation-date'), modified: get('date') };
    }

    /**
     * Parse one file into paragraphs and metadata (cached per File object).
     * @param {File} file @param {{onProgress?: Function}} [options]
     * @returns {Promise<{name: string, type: string, size: number, pages: number, meta: any, paragraphs: Array<{page: number, text: string, heading: boolean, type: string}>, original: Uint8Array}>}
     */
    async function parseFile(file, options = {}) {
      const cached = cache.get(file);
      if (cached) return cached;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = file.name;
      const lower = name.toLowerCase();
      let paragraphs = []; let pages = 1; let meta = { title: null, author: null, created: null, modified: null }; let type = 'text';
      if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        type = 'pdf';
        const pdf = D.require('engines/pdf');
        const doc = await pdf.open(bytes.slice());
        try {
          meta = await pdf.metadata(doc);
          const result = await pdf.extract(doc, { onProgress: (p) => { if (options.onProgress) options.onProgress({ file: name, page: p.page, pages: p.pages }); } });
          pages = doc.numPages;
          for (const pg of result) for (const para of pg.paragraphs) paragraphs.push({ page: pg.page, text: para.text, heading: para.heading, type: para.heading ? 'rubrik' : 'stycke' });
        } finally { try { await doc.destroy(); } catch (_err) { /* ignore */ } }
      } else if (lower.endsWith('.docx')) {
        type = 'docx';
        const entries = await zip.readZip(bytes);
        const r = docxParagraphs(entries); paragraphs = r.paragraphs; pages = r.pages; meta = docxMeta(entries);
      } else if (lower.endsWith('.odt')) {
        type = 'odt';
        const entries = await zip.readZip(bytes);
        const r = odtParagraphs(entries); paragraphs = r.paragraphs; pages = r.pages; meta = odtMeta(entries);
      } else {
        type = /\.(md|markdown)$/i.test(lower) ? 'markdown' : 'text';
        paragraphs = paragraphsFromText(decodeText(bytes), type === 'markdown').map((p) => ({ page: 1, text: p.text, heading: p.heading, type: p.heading ? 'rubrik' : 'stycke' }));
        if (type === 'markdown') { const h = paragraphs.find((p) => p.heading); if (h) meta.title = h.text; }
      }
      const parsed = { name, type, size: file.size, pages, meta, paragraphs, original: bytes, mime: file.type || mimeOf(type) };
      cache.set(file, parsed);
      return parsed;
    }
    const mimeOf = (type) => ({ pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text', markdown: 'text/markdown', text: 'text/plain' })[type] || 'application/octet-stream';

    /** Rows of one parsed document: [dokument, sida, stycke, typ, text, tecken]. */
    function rowsOf(parsed) {
      return parsed.paragraphs.map((p, i) => [parsed.name, p.page, i + 1, p.type, p.text, p.text.length]);
    }
    function describe(parsed) {
      return { name: parsed.name, type: parsed.type, size: parsed.size, pages: parsed.pages, paragraphs: parsed.paragraphs.length, words: parsed.paragraphs.reduce((n, p) => n + words(p.text), 0), title: parsed.meta.title, author: parsed.meta.author, created: parsed.meta.created, modified: parsed.meta.modified };
    }

    /** Wizard preview of a single file: the first paragraphs as rows. */
    async function preview(file, options = {}) {
      const parsed = await parseFile(file, options);
      const rows = rowsOf(parsed);
      return { columns: COLUMNS.map((c) => c.name), dataRows: rows.slice(0, 50), header: true, declaredTypes: COLUMNS.map((c) => c.type), meta: { format: 'documents' }, totalRows: rows.length, document: describe(parsed) };
    }
    async function parse(file, options = {}) {
      const parsed = await parseFile(file, options);
      return { columns: COLUMNS.map((c) => c.name), rows: rowsOf(parsed), meta: { format: 'documents' } };
    }

    /**
     * One dataset (kind document) from one or several files: all paragraphs, the originals in `_files` and a
     * `documents` list in the metadata.
     * @param {File[]} files @param {any} options @param {string} [name] @param {Function} [progress]
     */
    async function importFiles(files, options = {}, name, progress) {
      const parsedAll = [];
      for (let i = 0; i < files.length; i++) {
        if (progress) progress({ file: files[i].name, index: i, total: files.length });
        parsedAll.push(await parseFile(files[i], { onProgress: (p) => progress && progress(Object.assign({ index: i, total: files.length }, p)) }));
      }
      const rows = parsedAll.flatMap(rowsOf);
      const baseName = D.require('io/import').baseName;
      const datasetName = name || (files.length === 1 ? baseName(files[0].name) : D.t('import.collection.documents', { n: files.length }));
      return dsFiles.createDataset({
        name: datasetName, kind: 'document', columns: COLUMNS, rows,
        files: parsedAll.map((p) => ({ name: p.name, kind: 'original', type: p.mime, bytes: p.original })),
        source: { kind: 'files', format: 'documents', files: parsedAll.map((p) => ({ name: p.name, size: p.size, type: p.type, pages: p.pages })) },
        meta: { documents: parsedAll.map(describe) },
        importOptions: Object.assign({}, options, { format: 'documents' }),
      });
    }

    return { id: 'documents', kind: 'document', collection: true, detect, accepts, preview, parse, parseFile, importFiles, paragraphsFromText, docxParagraphs, odtParagraphs, COLUMNS };
  });
})();
