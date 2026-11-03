// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tables in documents: HTML pages (.html, .htm, .xhtml), Markdown pipe tables (.md, .markdown), Word documents
 * (.docx) and LaTeX tabular environments (.tex). Every table in the file is offered by name (its caption, or
 * the nearest heading before it); merged cells are repeated across the cells they cover, so that each row has
 * a value in every column.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/tables', ['data/encoding', 'platform/storage/zip', 'io/importers/csv'], (encoding, zip, csv) => {
    const EXT = /\.(html?|xhtml|md|markdown|docx|tex)$/i;
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const MAX_SPAN = 1000;
    /** @type {WeakMap<File, Promise<Array<{label: string, rows: any[][], header?: boolean}>>>} */
    const cache = new WeakMap();

    /** @param {File} file */
    function detect(file) { return EXT.test(file.name); }

    const clean = (s) => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();

    /**
     * Rows of cells {text, colspan, rowspan} as a rectangular grid; merged cells repeat their text.
     * @param {Array<Array<{text: string, colspan?: number, rowspan?: number}>>} rows
     */
    function grid(rows) {
      /** @type {any[][]} */
      const out = [];
      rows.forEach((cells, r) => {
        const line = out[r] = out[r] || [];
        let c = 0;
        for (const cell of cells) {
          while (line[c] !== undefined) c++;
          const cs = Math.min(MAX_SPAN, Math.max(1, cell.colspan || 1));
          const rs = Math.min(MAX_SPAN, Math.max(1, cell.rowspan || 1));
          for (let dy = 0; dy < rs; dy++) {
            const target = out[r + dy] = out[r + dy] || [];
            for (let dx = 0; dx < cs; dx++) target[c + dx] = cell.text;
          }
          c += cs;
        }
      });
      const width = out.reduce((m, l) => Math.max(m, l.length), 0);
      return out.map((l) => Array.from({ length: width }, (_, i) => (l[i] === undefined || l[i] === '' ? null : l[i])));
    }

    // ---- HTML ----
    function htmlTables(text) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const out = [];
      let heading = '';
      for (const el of Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, table'))) {
        if (el.tagName !== 'TABLE') { heading = clean(el.textContent); continue; }
        const trs = Array.from(el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr, :scope > tfoot > tr'));
        const rows = trs.map((tr) => Array.from(tr.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
          .map((c) => ({ text: clean(c.textContent), colspan: Number(c.getAttribute('colspan')) || 1, rowspan: Number(c.getAttribute('rowspan')) || 1 })));
        if (!rows.some((r) => r.length)) continue;
        const first = trs[0];
        const header = !!first && (first.parentElement && first.parentElement.tagName === 'THEAD' || Array.from(first.children).every((c) => c.tagName === 'TH'));
        const caption = el.querySelector(':scope > caption');
        out.push({ name: caption ? clean(caption.textContent) : heading, rows: grid(rows), header });
      }
      return out;
    }

    // ---- Markdown pipe tables ----
    function mdCells(line) {
      let s = line.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
      const cells = [];
      let cur = '';
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; } else if (s[i] === '|') { cells.push(cur); cur = ''; } else cur += s[i];
      }
      cells.push(cur);
      // Plain text: code spans, bold, italics and links lose their markup.
      return cells.map((c) => clean(c.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
        .replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?![\w*])/g, '$1$2').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')));
    }
    function markdownTables(text) {
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      const out = [];
      let heading = '';
      const delimiter = (l) => l.includes('|') && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l);
      for (let i = 0; i < lines.length; i++) {
        const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(lines[i]);
        if (h) { heading = clean(h[1]); continue; }
        if (i + 1 < lines.length && lines[i].includes('|') && delimiter(lines[i + 1]) && mdCells(lines[i]).length === mdCells(lines[i + 1]).length) {
          const rows = [mdCells(lines[i])];
          let j = i + 2;
          while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') { rows.push(mdCells(lines[j])); j++; }
          out.push({ name: heading, rows: grid(rows.map((r) => r.map((text) => ({ text })))), header: true });
          i = j - 1;
        }
      }
      return out;
    }

    // ---- Word (.docx) ----
    const wattr = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute('w:' + name) : null);
    const wkids = (el, name) => Array.from(el.children).filter((c) => c.localName === name);
    /** Text of a paragraph, or of all paragraphs in a cell. */
    const wtext = (el) => clean((el.localName === 'p' ? [el] : Array.from(el.getElementsByTagNameNS(W, 'p')))
      .map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('')).join(' '));
    function docxRows(tbl) {
      const rows = [];
      for (const tr of wkids(tbl, 'tr')) {
        const line = [];
        for (const tc of wkids(tr, 'tc')) {
          const pr = wkids(tc, 'tcPr')[0];
          const span = pr ? wkids(pr, 'gridSpan')[0] : null;
          const vmerge = pr ? wkids(pr, 'vMerge')[0] : null;
          // A vertically merged cell continues the one above unless it starts the merge ("restart").
          line.push({ text: wtext(tc), colspan: Number(wattr(span, 'val')) || 1, cont: !!vmerge && wattr(vmerge, 'val') !== 'restart' });
        }
        rows.push(line);
      }
      const out = [];
      rows.forEach((line, r) => {
        const row = [];
        for (const cell of line) {
          const at = row.length;
          for (let k = 0; k < Math.min(MAX_SPAN, cell.colspan); k++) row.push(cell.cont && r > 0 && out[r - 1] ? out[r - 1][at + k] : cell.text);
        }
        out.push(row);
      });
      return grid(out.map((r) => r.map((text) => ({ text: text === null ? '' : text }))));
    }
    function docxTables(entries) {
      const xml = entries['word/document.xml'];
      if (!xml) throw new Error(D.t('import.err.docx'));
      const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
      const body = doc.getElementsByTagNameNS(W, 'body')[0];
      const out = [];
      let heading = ''; let caption = '';
      for (const el of Array.from(body ? body.children : [])) {
        if (el.localName === 'p') {
          const pr = wkids(el, 'pPr')[0];
          const style = String(wattr(pr ? wkids(pr, 'pStyle')[0] : null, 'val') || '');
          const text = wtext(el);
          if (/caption|beskrivning|bildtext|kuvateksti|myndatexti/i.test(style)) caption = text;
          else if (/heading|rubrik|overskrift|otsikko|fyrirs|title/i.test(style) && text) { heading = text; caption = ''; }
        } else if (el.localName === 'tbl') {
          out.push({ name: caption || heading, rows: docxRows(el) });
          caption = '';
        }
      }
      return out;
    }

    // ---- LaTeX ----
    /** Skip `count` brace groups (and an optional [..] argument) at the start of `s`. */
    function skipArgs(s, count) {
      let i = 0;
      const ws = () => { while (/\s/.test(s[i] || '')) i++; };
      ws();
      if (s[i] === '[') { const e = s.indexOf(']', i); i = e < 0 ? i : e + 1; }
      for (let n = 0; n < count; n++) {
        ws();
        if (s[i] !== '{') break;
        let depth = 0;
        for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
      }
      return s.slice(i);
    }
    /** Split on `sep` outside braces, ignoring escaped separators. */
    function splitTop(s, sep) {
      const out = []; let cur = ''; let depth = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        // The separator is checked first: LaTeX's row separator is itself two backslashes.
        if (depth === 0 && s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
        if (ch === '\\' && i + 1 < s.length) { cur += ch + s[i + 1]; i++; continue; }
        if (ch === '{') depth++; else if (ch === '}') depth--;
        cur += ch;
      }
      out.push(cur);
      return out;
    }
    function texText(s) {
      let t = s;
      for (let k = 0; k < 4; k++) t = t.replace(/\\(?:textbf|textit|textsl|textsc|emph|texttt|textrm|textsf|textup|text|mathrm|mathbf|num|underline|mbox|hbox|makecell|shortstack)\s*(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1');
      t = t.replace(/\\SI\{([^{}]*)\}\{([^{}]*)\}/g, '$1 $2').replace(/\\(?:,|;|:|!| |quad|qquad)/g, ' ')
        .replace(/\\textemdash|---/g, '—').replace(/\\textendash|--/g, '–').replace(/\\textbackslash\b/g, '\\\\')
        .replace(/\\(?:centering|raggedright|raggedleft|bfseries|itshape|small|footnotesize|scriptsize|normalsize|hfill)\b/g, '').replace(/~/g, ' ')
        // Grouping braces and math shifts go; escaped ones become the character itself.
        .replace(/\\[{}$]|[{}$]/g, (m) => (m.length === 2 ? m : ''))
        .replace(/\\([%&_#${}\\])/g, '$1');
      return clean(t);
    }
    function latexRows(body) {
      const noComments = body.split('\n').map((l) => l.replace(/(^|[^\\])%.*$/, '$1')).join('\n');
      const stripped = noComments.replace(/\\(?:hline|toprule|midrule|bottomrule|endhead|endfirsthead|endfoot|endlastfoot|addlinespace|noalign\{[^}]*\})/g, '\n')
        .replace(/\\(?:cline|cmidrule)(?:\([^)]*\))?\{[^}]*\}/g, '\n').replace(/\\rowcolor(?:\[[^\]]*\])?\{[^}]*\}/g, '');
      const rows = [];
      let ruleAfterFirst = false;
      const firstRule = /\\(?:hline|midrule|toprule)/;
      for (const raw of splitTop(stripped, '\\\\')) {
        const line = raw.replace(/^\s*\[[^\]]*\]/, '');
        if (!line.trim()) continue;
        const cells = [];
        for (const c of splitTop(line, '&')) {
          const m = /^\s*\\multicolumn\{(\d+)\}\{[^}]*\}\{([\s\S]*)\}\s*$/.exec(c);
          if (m) cells.push({ text: texText(m[2]), colspan: Number(m[1]) || 1 });
          else cells.push({ text: texText(c.replace(/^\s*\\multirow\{\d+\}\{[^}]*\}\{([\s\S]*)\}\s*$/, '$1')) });
        }
        rows.push(cells);
      }
      // booktabs and \hline: a rule right after the first row marks that row as the header.
      const afterFirst = splitTop(noComments, '\\\\')[1];
      if (afterFirst !== undefined && firstRule.test(afterFirst.split('&')[0])) ruleAfterFirst = true;
      return { rows: grid(rows), header: ruleAfterFirst };
    }
    function latexTables(text) {
      const out = [];
      const re = /\\begin\{(tabular\*?|tabularx|tabulary|longtable|xltabular|tabu|array)\}/g;
      let m;
      while ((m = re.exec(text))) {
        const env = m[1];
        const endTag = '\\end{' + env + '}';
        const end = text.indexOf(endTag, re.lastIndex);
        if (end < 0) break;
        const body = skipArgs(text.slice(re.lastIndex, end), /^(tabular\*|tabularx|tabulary|xltabular)$/.test(env) ? 2 : 1);
        // A \caption in the surrounding table environment names the table.
        const before = text.lastIndexOf('\\begin{table', m.index);
        const after = text.indexOf('\\end{table', end);
        const scope = (before >= 0 && text.lastIndexOf('\\end{table', m.index) < before ? text.slice(before, after >= 0 ? after : end) : '') + (env === 'longtable' ? body : '');
        const cap = /\\caption(?:\[[^\]]*\])?\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/.exec(scope);
        const parsed = latexRows(body);
        out.push({ name: cap ? texText(cap[1]) : '', rows: parsed.rows, header: parsed.header });
        re.lastIndex = end + endTag.length;
      }
      return out;
    }

    /** All tables in a file with display labels. */
    function tablesOf(file) {
      let p = cache.get(file);
      if (!p) {
        p = (async () => {
          const name = file.name.toLowerCase();
          let tables;
          if (name.endsWith('.docx')) tables = docxTables(await zip.readZip(file));
          else {
            const { text } = await encoding.readText(file);
            if (/\.(md|markdown)$/.test(name)) tables = markdownTables(text);
            else if (name.endsWith('.tex')) tables = latexTables(text);
            else tables = htmlTables(text);
          }
          tables = tables.filter((tb) => tb.rows.length);
          if (!tables.length) throw new Error(D.t('import.err.notables'));
          return tables.map((tb, i) => ({
            label: D.t('import.tables.label', { n: i + 1, name: tb.name || D.t('import.tables.unnamed'), rows: tb.rows.length, cols: tb.rows[0] ? tb.rows[0].length : 0 }),
            rows: tb.rows, header: tb.header,
          }));
        })();
        cache.set(file, p);
      }
      return p;
    }

    function split(rows, header) {
      const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const columns = header && rows.length
        ? Array.from({ length: width }, (_, i) => (rows[0][i] === null || rows[0][i] === undefined || String(rows[0][i]).trim() === '' ? `kolumn_${i + 1}` : String(rows[0][i])))
        : Array.from({ length: width }, (_, i) => `kolumn_${i + 1}`);
      return { columns, dataRows: header ? rows.slice(1) : rows };
    }
    const pick = (tables, label) => tables.find((tb) => tb.label === label) || tables[0];

    /** @param {File} file @param {{table?: string, header?: boolean, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const tables = await tablesOf(file);
      const tb = pick(tables, options.table);
      const header = options.header === undefined ? (tb.header !== undefined ? tb.header : csv.guessHeader(tb.rows)) : !!options.header;
      const { columns, dataRows } = split(tb.rows, header);
      return { kind: 'tables', tables: tables.map((x) => x.label), table: tb.label, header, columns, dataRows: dataRows.slice(0, options.previewRows || 100), totalRows: dataRows.length };
    }

    /** @param {File} file @param {{table?: string, header?: boolean}} options */
    async function parse(file, options = {}) {
      const tables = await tablesOf(file);
      const tb = pick(tables, options.table);
      const header = options.header === undefined ? (tb.header !== undefined ? tb.header : csv.guessHeader(tb.rows)) : !!options.header;
      const { columns, dataRows } = split(tb.rows, header);
      return { columns, rows: dataRows, meta: { format: 'tables', table: tb.label, header } };
    }

    return { id: 'tables', detect, preview, parse, htmlTables, markdownTables, latexTables, docxTables, grid };
  });
})();
