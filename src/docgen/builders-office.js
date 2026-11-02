// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Binary builders for the document model: Word (docx library) and PDF (jsPDF with jspdf-autotable).
 * Both libraries load on demand from vendor/.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/builders-office', ['docgen/markdown'], (markdown) => {
    const TEXT = '1F252E'; const MUTED = '6B7583'; const BORDER = 'E1E4E9'; const SHADE = 'EEF0F3';
    const PAGE_WIDTH_PX = 600; // A4 minus 25 mm margins at 96 px per inch, rounded down

    async function ensureDocx() {
      if (!globalThis.docx) await D.assets.loadVendorScript('vendor/docx/docx.iife.js');
      return globalThis.docx;
    }
    async function ensurePdf() {
      if (!globalThis.jspdf) await D.assets.loadVendorScript('vendor/jspdf/jspdf.umd.min.js');
      if (!(globalThis.jspdf.jsPDF.API && globalThis.jspdf.jsPDF.API.autoTable) && !globalThis.autoTable) await D.assets.loadVendorScript('vendor/jspdf-autotable/jspdf.plugin.autotable.min.js');
      return globalThis.jspdf.jsPDF;
    }

    // ---- DOCX ----
    async function toDocx(ast, options = {}) {
      const lib = await ensureDocx();
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, PageBreak, AlignmentType, BorderStyle, ShadingType, ExternalHyperlink } = lib;
      const title = options.title || markdown.title(ast) || 'Dokument';
      const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
      const borders = { top: border, bottom: border, left: border, right: border };
      const runs = (list, extra = {}) => list.map((r) => {
        const run = new TextRun(Object.assign({ text: r.text, bold: !!r.bold, italics: !!r.italic, font: r.code ? 'Consolas' : undefined }, extra));
        return r.link && /^(https?:|mailto:)/i.test(r.link) ? new ExternalHyperlink({ link: r.link, children: [new TextRun({ text: r.text, style: 'Hyperlink' })] }) : run;
      });
      const numbering = { config: [] };
      const children = [];
      let listNo = 0;
      for (const b of ast.blocks) {
        if (b.type === 'heading') children.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(3, b.level - 1)], children: runs(b.runs) }));
        else if (b.type === 'paragraph') children.push(new Paragraph({ children: runs(b.runs), spacing: { after: 140 } }));
        else if (b.type === 'list') {
          if (b.ordered) { listNo++; numbering.config.push({ reference: 'num' + listNo, levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }); }
          for (const it of b.items) children.push(new Paragraph(Object.assign({ children: runs(it), spacing: { after: 60 } }, b.ordered ? { numbering: { reference: 'num' + listNo, level: 0 } } : { bullet: { level: 0 } })));
        } else if (b.type === 'table') {
          if (b.caption) children.push(new Paragraph({ children: [new TextRun({ text: b.caption, italics: true, color: MUTED, size: 20 })], spacing: { before: 120, after: 60 } }));
          const cell = (text, i, head) => new TableCell({ borders, shading: head ? { type: ShadingType.CLEAR, fill: SHADE, color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ alignment: b.numeric && b.numeric[i] ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: head, size: 20 })] })] });
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: b.columns.map((c, i) => cell(c, i, true)) })].concat(b.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))) }));
          children.push(new Paragraph({ spacing: { after: 120 } }));
        } else if (b.type === 'image') {
          const width = Math.min(PAGE_WIDTH_PX, b.width || PAGE_WIDTH_PX); const height = Math.round(width * (b.height || Math.round(width * 0.56)) / (b.width || width));
          children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: new Uint8Array(b.png), transformation: { width, height } })], spacing: { before: 120, after: 60 } }));
          if (b.caption) children.push(new Paragraph({ children: [new TextRun({ text: b.caption, italics: true, color: MUTED, size: 20 })], spacing: { after: 160 } }));
        } else if (b.type === 'rule') children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 4 } }, spacing: { after: 160 } }));
        else if (b.type === 'pagebreak') children.push(new Paragraph({ children: [new PageBreak()] }));
      }
      const doc = new Document({
        creator: 'Dataspatium', title, description: options.description || '',
        styles: {
          default: { document: { run: { font: 'Arial', size: 22, color: TEXT } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, color: TEXT, font: 'Arial' }, paragraph: { spacing: { before: 240, after: 160 } } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: TEXT, font: 'Arial' }, paragraph: { spacing: { before: 280, after: 100 } } },
            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: TEXT, font: 'Arial' }, paragraph: { spacing: { before: 200, after: 80 } } },
            { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, italics: true, color: TEXT, font: 'Arial' }, paragraph: { spacing: { before: 160, after: 60 } } },
          ],
        },
        numbering,
        sections: [{ properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } }, children }],
      });
      return Packer.toBlob(doc);
    }

    // ---- PDF ----
    function runAutoTable(doc, opts) {
      if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
      if (typeof globalThis.autoTable === 'function') return globalThis.autoTable(doc, opts);
      if (globalThis.jspdf && typeof globalThis.jspdf.autoTable === 'function') return globalThis.jspdf.autoTable(doc, opts);
      throw new Error('Tabellstöd för PDF (jspdf-autotable) kunde inte laddas.');
    }
    async function toPdf(ast, options = {}) {
      const jsPDF = await ensurePdf();
      const title = options.title || markdown.title(ast) || 'Dokument';
      const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const margin = 56; const maxW = W - 2 * margin;
      let y = margin;
      const ensure = (h) => { if (y + h > H - margin) { doc.addPage(); y = margin; } };
      const text = (str, size, style, color, lineGap = 1.35) => {
        doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || [31, 37, 46]));
        const lines = doc.splitTextToSize(String(str), maxW);
        const lh = size * lineGap;
        for (const line of lines) { ensure(lh); doc.text(line, margin, y + size * 0.85); y += lh; }
      };
      const plain = (runs) => runs.map((r) => r.text).join('');
      for (const b of ast.blocks) {
        if (b.type === 'heading') { const size = [20, 15, 12.5, 11][Math.min(3, b.level - 1)]; y += b.level === 1 ? 0 : 8; text(plain(b.runs), size, 'bold'); y += 6; }
        else if (b.type === 'paragraph') { const allBold = b.runs.length && b.runs.every((r) => r.bold); const allItalic = b.runs.length && b.runs.every((r) => r.italic); text(plain(b.runs), 10.5, allBold ? 'bold' : (allItalic ? 'italic' : 'normal')); y += 6; }
        else if (b.type === 'list') { b.items.forEach((it, i) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); const lines = doc.splitTextToSize(plain(it), maxW - 16); const lh = 10.5 * 1.35; for (let k = 0; k < lines.length; k++) { ensure(lh); if (k === 0) doc.text(b.ordered ? `${i + 1}.` : '•', margin, y + 9); doc.text(lines[k], margin + 16, y + 9); y += lh; } }); y += 6; }
        else if (b.type === 'table') {
          if (b.caption) { text(b.caption, 9, 'italic', [107, 117, 131]); }
          ensure(40);
          const columnStyles = {}; (b.numeric || []).forEach((n, i) => { if (n) columnStyles[i] = { halign: 'right' }; });
          runAutoTable(doc, { startY: y, head: [b.columns], body: b.rows, margin: { left: margin, right: margin }, theme: 'grid', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [225, 228, 233], lineWidth: 0.5, textColor: [31, 37, 46], overflow: 'linebreak' }, headStyles: { fillColor: [238, 240, 243], textColor: [31, 37, 46], fontStyle: 'bold' }, columnStyles });
          y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 14;
        } else if (b.type === 'image') {
          const w = Math.min(maxW, b.width || maxW); const h = w * ((b.height || Math.round(w * 0.56)) / (b.width || w));
          ensure(h + 24);
          doc.addImage(new Uint8Array(b.png), 'PNG', margin, y, w, h);
          y += h + 4;
          if (b.caption) text(b.caption, 9, 'italic', [107, 117, 131]);
          y += 8;
        } else if (b.type === 'rule') { ensure(12); doc.setDrawColor(225, 228, 233); doc.line(margin, y + 4, W - margin, y + 4); y += 14; }
        else if (b.type === 'pagebreak') { doc.addPage(); y = margin; }
      }
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(107, 117, 131);
        doc.text(title, margin, H - 28);
        doc.text(`Sida ${p} av ${pages}`, W - margin, H - 28, { align: 'right' });
      }
      doc.setProperties({ title, creator: 'Dataspatium ' + D.version });
      return doc.output('blob');
    }

    return { toDocx, toPdf, ensureDocx, ensurePdf };
  });
})();
