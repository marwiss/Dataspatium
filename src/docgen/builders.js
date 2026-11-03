// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Text builders for the document model: self-contained HTML (also as DOM for previews), Markdown and
 * LaTeX (booktabs tables, figures folder). Every piece of text is escaped for its target.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/builders', ['docgen/markdown'], (markdown) => {
    const toB64 = (buf) => { const bytes = new Uint8Array(buf); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000))); return btoa(s); };

    // ---- HTML ----
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function runsHtml(runs) {
      return runs.map((r) => {
        let s = escHtml(r.text);
        if (r.code) s = `<code>${s}</code>`;
        if (r.bold) s = `<strong>${s}</strong>`;
        if (r.italic) s = `<em>${s}</em>`;
        if (r.link && /^(https?:|mailto:)/i.test(r.link)) s = `<a href="${escHtml(r.link)}">${s}</a>`;
        return s;
      }).join('');
    }
    const CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #f7f8fa; color: #1f252e; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 15px; line-height: 1.55; }
main.doc { max-width: 820px; margin: 32px auto; padding: 40px 48px; background: #fff; border: 1px solid #e1e4e9; border-radius: 8px; }
h1 { font-size: 28px; margin: 0 0 16px; line-height: 1.2; } h2 { font-size: 20px; margin: 28px 0 8px; } h3 { font-size: 16px; margin: 20px 0 6px; } h4 { font-size: 15px; margin: 16px 0 4px; }
p { margin: 0 0 12px; } ul, ol { margin: 0 0 12px; padding-left: 24px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; font-size: 13.5px; }
th, td { border: 1px solid #e1e4e9; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #eef0f3; font-weight: 600; } td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
caption, figcaption { caption-side: bottom; text-align: left; color: #6b7583; font-size: 12.5px; padding: 6px 0; }
figure { margin: 12px 0 18px; } img { max-width: 100%; height: auto; display: block; }
hr { border: 0; border-top: 1px solid #e1e4e9; margin: 20px 0; } .pagebreak { page-break-after: always; break-after: page; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 0.92em; background: #eef0f3; padding: 1px 4px; border-radius: 3px; }
pre.code { margin: 0 0 12px; padding: 10px 12px; background: #eef0f3; border-radius: 6px; overflow: auto; font-size: 13px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; } pre.code code { background: none; padding: 0; }
pre.lang-output { background: #f7f8fa; border: 1px solid #e1e4e9; } pre.lang-error { background: #fdecec; color: #8a1c1c; }
@media print { body { background: #fff; } main.doc { border: 0; margin: 0; padding: 0; max-width: none; } }`;

    function blockHtml(b, images) {
      switch (b.type) {
        case 'heading': return `<h${b.level}>${runsHtml(b.runs)}</h${b.level}>`;
        case 'paragraph': return `<p>${runsHtml(b.runs)}</p>`;
        case 'list': return `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((it) => `<li>${runsHtml(it)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
        case 'table': return `<table>${b.caption ? `<caption>${escHtml(b.caption)}</caption>` : ''}<thead><tr>${b.columns.map((c, i) => `<th${b.numeric && b.numeric[i] ? ' class="num"' : ''}>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td${b.numeric && b.numeric[i] ? ' class="num"' : ''}>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        case 'image': { const src = images ? images(b) : `data:image/png;base64,${toB64(b.png)}`; return `<figure><img src="${src}" width="${b.width}" height="${b.height}" alt="${escHtml(b.caption || '')}">${b.caption ? `<figcaption>${escHtml(b.caption)}</figcaption>` : ''}</figure>`; }
        case 'code': return `<pre class="code${b.language ? ' lang-' + escHtml(String(b.language).replace(/[^a-z0-9-]/gi, '')) : ''}"><code>${escHtml(b.text)}</code></pre>`;
        case 'rule': return '<hr>';
        case 'pagebreak': return '<div class="pagebreak"></div>';
        default: return '';
      }
    }
    /** Complete standalone HTML document. */
    function toHtml(ast, options = {}) {
      const title = options.title || markdown.title(ast) || 'Dokument';
      return `<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="generator" content="Dataspatium ${D.version}">\n<title>${escHtml(title)}</title>\n<style>${CSS}</style>\n</head>\n<body>\n<main class="doc">\n${ast.blocks.map((b) => blockHtml(b)).join('\n')}\n</main>\n</body>\n</html>\n`;
    }
    /** DOM for the in-app preview (built from strings produced by the same escaping code). */
    function toDom(ast) {
      const root = document.createElement('article');
      root.className = 'dm-doc';
      const tpl = document.createElement('template');
      tpl.innerHTML = ast.blocks.map((b) => blockHtml(b)).join('\n'); // all text is escaped above; images are data URLs
      root.appendChild(tpl.content);
      return root;
    }

    // ---- Markdown ----
    function runsMd(runs) {
      return runs.map((r) => { let s = r.text.replace(/([*_`\\])/g, '\\$1'); if (r.code) s = '`' + r.text + '`'; if (r.bold) s = `**${s}**`; if (r.italic) s = `*${s}*`; if (r.link) s = `[${s}](${r.link})`; return s; }).join('');
    }
    function toMarkdown(ast) {
      const figures = {}; let n = 0;
      const out = [];
      for (const b of ast.blocks) {
        if (b.type === 'heading') out.push(`${'#'.repeat(b.level)} ${runsMd(b.runs)}\n`);
        else if (b.type === 'paragraph') out.push(runsMd(b.runs) + '\n');
        else if (b.type === 'list') out.push(b.items.map((it, i) => `${b.ordered ? (i + 1) + '.' : '-'} ${runsMd(it)}`).join('\n') + '\n');
        else if (b.type === 'table') {
          const cell = (c) => String(c).replace(/\|/g, '\\|');
          out.push(`| ${b.columns.map(cell).join(' | ')} |\n| ${b.columns.map((c, i) => (b.numeric && b.numeric[i] ? '---:' : '---')).join(' | ')} |\n${b.rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n')}\n${b.caption ? '\n*' + b.caption + '*\n' : ''}`);
        } else if (b.type === 'image') { n++; const path = `figures/fig-${n}.png`; figures[path] = new Uint8Array(b.png); out.push(`![${b.caption || ''}](${path})\n`); }
        else if (b.type === 'code') out.push('```' + (b.language && b.language !== 'output' && b.language !== 'error' ? b.language : '') + '\n' + String(b.text).replace(/```/g, '` ` `') + '\n```\n');
        else if (b.type === 'rule') out.push('---\n');
        else if (b.type === 'pagebreak') out.push('<div style="page-break-after: always"></div>\n');
      }
      return { text: out.join('\n'), figures };
    }

    // ---- LaTeX ----
    const escTex = (s) => String(s).replace(/\\/g, '\\textbackslash{}').replace(/([&%$#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}').replace(/\u00a0/g, '~');
    function runsTex(runs) {
      return runs.map((r) => { let s = r.code ? `\\texttt{${escTex(r.text)}}` : escTex(r.text); if (r.bold) s = `\\textbf{${s}}`; if (r.italic) s = `\\emph{${s}}`; if (r.link) s = `\\href{${r.link.replace(/[%#&]/g, (c) => '\\' + c)}}{${s}}`; return s; }).join('');
    }
    const SECTIONS = ['section', 'subsection', 'subsubsection', 'paragraph'];
    function toLatex(ast, options = {}) {
      const title = options.title || markdown.title(ast) || 'Dokument';
      const figures = {}; let n = 0;
      const body = [];
      let first = true;
      for (const b of ast.blocks) {
        if (b.type === 'heading') {
          if (first && b.level === 1) { first = false; continue; } // the first H1 becomes \title
          body.push(`\\${SECTIONS[Math.min(3, b.level - 1)]}*{${runsTex(b.runs)}}\n`);
        } else if (b.type === 'paragraph') body.push(runsTex(b.runs) + '\n');
        else if (b.type === 'list') body.push(`\\begin{${b.ordered ? 'enumerate' : 'itemize'}}\n${b.items.map((it) => `  \\item ${runsTex(it)}`).join('\n')}\n\\end{${b.ordered ? 'enumerate' : 'itemize'}}\n`);
        else if (b.type === 'table') {
          const spec = b.columns.map((c, i) => (b.numeric && b.numeric[i] ? 'r' : 'l')).join('');
          body.push(`\\begin{longtable}{${spec}}\n${b.caption ? `\\caption{${escTex(b.caption)}}\\\\\n` : ''}\\toprule\n${b.columns.map((c) => `\\textbf{${escTex(c)}}`).join(' & ')} \\\\\n\\midrule\n\\endhead\n\\bottomrule\n\\endfoot\n${b.rows.map((r) => r.map(escTex).join(' & ') + ' \\\\').join('\n')}\n\\end{longtable}\n`);
        } else if (b.type === 'image') { n++; const path = `figures/fig-${n}.png`; figures[path] = new Uint8Array(b.png); body.push(`\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=\\linewidth]{${path}}\n${b.caption ? `  \\caption{${escTex(b.caption)}}\n` : ''}\\end{figure}\n`); }
        else if (b.type === 'code') body.push(`\\begin{verbatim}\n${String(b.text).replace(/\\end\{verbatim\}/g, '\\end {verbatim}')}\n\\end{verbatim}\n`);
        else if (b.type === 'rule') body.push('\\noindent\\rule{\\linewidth}{0.4pt}\n');
        else if (b.type === 'pagebreak') body.push('\\clearpage\n');
        first = false;
      }
      const text = `% Skapat av Dataspatium ${D.version}. Kompilera med pdflatex, xelatex eller lualatex.\n\\documentclass[a4paper,11pt]{article}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[swedish]{babel}\n\\usepackage{booktabs,longtable,graphicx,hyperref}\n\\usepackage[margin=25mm]{geometry}\n\\setlength{\\parskip}{6pt}\n\\setlength{\\parindent}{0pt}\n\\title{${escTex(title)}}\n\\author{}\n\\date{${escTex(options.date || '')}}\n\\begin{document}\n\\maketitle\n\n${body.join('\n')}\n\\end{document}\n`;
      return { text, figures };
    }

    return { toHtml, toDom, toMarkdown, toLatex, escHtml, escTex, runsHtml, CSS };
  });
})();
