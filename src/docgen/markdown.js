// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Markdown subset -> document model. Blocks: heading (1-4), paragraph, list (ordered or not), table,
 * image, rule, pagebreak. Inline runs: bold (**x**), italic (*x* or _x_), code (`x`), links [t](url), and a backslash before
 * one of \ ` * _ [ ] | # + - . > for the character itself (also in table cells, where \| is a pipe that does not split).
 * Block tokens (\u0000TABLE:n\u0000 etc.) come from docgen/template.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/markdown', [], () => {
    const TOKEN = '\u0000';
    const RE_TOKEN = /^\u0000(TABLE|IMAGE):(\d+)\u0000$|^\u0000PAGEBREAK\u0000$/;
    /** The characters a backslash makes literal. */
    const RE_ESCAPED = /\\([\\`*_[\]|#+\-.>])/g;

    /**
     * A value as literal text on one line of a template: NUL (the block tokens' mark) dropped, white space and line breaks as one
     * space, the inline markers escaped, and a heading, list or quote marker at the start escaped too, so that data never becomes
     * markup. @param {any} v @returns {string}
     */
    function literal(v) {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().replace(/[\\`*_[\]|]/g, '\\$&');
      return s.replace(/^([#>+-])/, '\\$1').replace(/^(\d+)([.)])(?=\s)/, '$1\\$2');
    }

    /** Inline markup to runs. */
    function inline(text) {
      const runs = [];
      const re = /(\\([\\`*_[\]|#+\-.>])|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_)/g;
      let last = 0; let m;
      const push = (run) => { const prev = runs[runs.length - 1]; if (Object.keys(run).length === 1 && prev && Object.keys(prev).length === 1) prev.text += run.text; else runs.push(run); };
      while ((m = re.exec(text))) {
        if (m.index > last) push({ text: text.slice(last, m.index) });
        if (m[2] !== undefined) push({ text: m[2] });
        else if (m[3] !== undefined) runs.push({ text: unescaped(m[3]), bold: true });
        else if (m[4] !== undefined) runs.push({ text: m[4], code: true });
        else if (m[5] !== undefined) runs.push({ text: unescaped(m[5]), link: m[6] });
        else if (m[7] !== undefined) runs.push({ text: unescaped(m[7]), italic: true });
        else if (m[8] !== undefined) runs.push({ text: unescaped(m[8]), italic: true });
        last = m.index + m[0].length;
      }
      if (last < text.length) push({ text: text.slice(last) });
      return runs.length ? runs : [{ text: '' }];
    }
    const plain = (runs) => runs.map((r) => r.text).join('');
    const unescaped = (s) => String(s).replace(RE_ESCAPED, '$1');

    /** The cells of a table row: split at the pipes that are not escaped, each cell's escapes undone. */
    function parsePipeRow(line) {
      let s = line.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|') && !/(^|[^\\])(\\\\)*\\\|$/.test(s)) s = s.slice(0, -1);
      const cells = []; let cell = '';
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && i + 1 < s.length) { cell += s[i] + s[i + 1]; i++; } else if (s[i] === '|') { cells.push(cell); cell = ''; } else cell += s[i];
      }
      cells.push(cell);
      return cells.map((c) => unescaped(c.trim()));
    }
    const isSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

    /**
     * @param {string} text rendered template text
     * @param {{tables?: any[], images?: any[]}} [resolved]
     * @returns {{blocks: any[]}}
     */
    function parse(text, resolved = {}) {
      const blocks = [];
      const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
      let para = []; let list = null;
      const flushPara = () => { if (para.length) { blocks.push({ type: 'paragraph', runs: inline(para.join(' ').trim()) }); para = []; } };
      const flushList = () => { if (list) { blocks.push(list); list = null; } };
      const flush = () => { flushPara(); flushList(); };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tok = line.trim().match(RE_TOKEN);
        if (tok) {
          flush();
          if (line.trim() === TOKEN + 'PAGEBREAK' + TOKEN) blocks.push({ type: 'pagebreak' });
          else if (tok[1] === 'TABLE') { const tb = (resolved.tables || [])[Number(tok[2])]; if (tb && !tb.error) blocks.push(Object.assign({ type: 'table' }, tb)); else blocks.push({ type: 'paragraph', runs: [{ text: (tb && tb.error) || D.t('doc.table.missing'), italic: true }] }); }
          else { const im = (resolved.images || [])[Number(tok[2])]; if (im && im.png) blocks.push(Object.assign({ type: 'image' }, im)); else blocks.push({ type: 'paragraph', runs: [{ text: (im && im.error) || D.t('doc.chart.missing'), italic: true }] }); }
          continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*\S)\s*#*\s*$/);
        if (heading) { flush(); blocks.push({ type: 'heading', level: heading[1].length, runs: inline(heading[2]) }); continue; }
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); blocks.push({ type: 'rule' }); continue; }
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (bullet || numbered) {
          flushPara();
          const ordered = !!numbered;
          if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
          list.items.push(inline((bullet || numbered)[1].trim()));
          continue;
        }
        if (line.trim().startsWith('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
          flush();
          const columns = parsePipeRow(line);
          const align = parsePipeRow(lines[i + 1]).map((c) => (/^:?-+:$/.test(c) && !c.startsWith(':') ? 'right' : (/^:-+:$/.test(c) ? 'center' : 'left')));
          const rows = [];
          i += 2;
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(parsePipeRow(lines[i])); i++; }
          i--;
          blocks.push({ type: 'table', columns, rows: rows.map((r) => columns.map((_, c) => r[c] === undefined ? '' : r[c])), numeric: align.map((a) => a === 'right'), caption: '' });
          continue;
        }
        if (!line.trim()) { flush(); continue; }
        flushList();
        para.push(line.trim());
      }
      flush();
      return { blocks };
    }

    /** First heading text, for titles and file names. */
    function title(ast) { const hd = ast.blocks.find((b) => b.type === 'heading'); return hd ? plain(hd.runs) : ''; }

    return { parse, inline, plain, title, literal, TOKEN };
  });
})();
