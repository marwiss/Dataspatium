// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Statistics formats read by R in the browser: SPSS (.sav, .zsav, .por), Stata (.dta) and SAS (.sas7bdat,
 * .xpt) via haven, PC-Axis (.px) via pxR, R objects (.rds, .rda, .RData) with base R and Parquet via
 * nanoparquet. The file is written to the R session's filesystem, read with the right package and handed
 * back through dm_write(), which keeps variable labels as column labels; value labels become text.
 * There is no data preview: the wizard shows how the file will be read and imports in one step.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/r-formats', ['data/r-bridge'], (rb) => {
    const READERS = [
      { ext: /\.(sav|zsav)$/i, format: 'spss', label: 'SPSS', pkg: 'haven', code: (p) => `haven::read_sav(${p})` },
      { ext: /\.por$/i, format: 'spss-por', label: 'SPSS portable', pkg: 'haven', code: (p) => `haven::read_por(${p})` },
      { ext: /\.dta$/i, format: 'stata', label: 'Stata', pkg: 'haven', code: (p) => `haven::read_dta(${p})` },
      { ext: /\.sas7bdat$/i, format: 'sas', label: 'SAS', pkg: 'haven', code: (p) => `haven::read_sas(${p})` },
      { ext: /\.xpt$/i, format: 'sas-xpt', label: 'SAS transport', pkg: 'haven', code: (p) => `haven::read_xpt(${p})` },
      // The file is re-encoded to UTF-8 by pxToUtf8() first; pxR itself only tells ANSI from UTF-8.
      { ext: /\.px$/i, format: 'px', label: 'PC-Axis (PX)', pkg: 'pxR', code: (p) => `as.data.frame(pxR::read.px(${p}, encoding = "UTF-8"))` },
      { ext: /\.rds$/i, format: 'rds', label: 'R (RDS)', pkg: 'base', code: (p) => `readRDS(${p})` },
      { ext: /\.(rda|rdata)$/i, format: 'rdata', label: 'R (RData)', pkg: 'base', code: (p) => `local({ e <- new.env(); load(${p}, envir = e); nms <- Filter(function(n) is.data.frame(get(n, envir = e)), ls(e)); if (!length(nms)) stop("Filen innehåller ingen data.frame.", call. = FALSE); get(nms[[1]], envir = e) })` },
      { ext: /\.parquet$/i, format: 'parquet', label: 'Parquet', pkg: 'nanoparquet', code: (p) => `nanoparquet::read_parquet(${p})` },
    ];
    /** R code run after reading: labelled, factor and time-of-day columns become text; variable labels are kept. */
    const NORMALISE = [
      'df <- as.data.frame(df, stringsAsFactors = FALSE)',
      'for (nm in names(df)) {',
      '  x <- df[[nm]]; lbl <- attr(x, "label", exact = TRUE)',
      '  if (inherits(x, "haven_labelled")) x <- as.character(haven::as_factor(x, levels = "default"))',
      '  else if (is.factor(x)) x <- as.character(x)',
      '  else if (inherits(x, "difftime")) x <- as.character(x)',
      '  else next',
      '  attr(x, "label") <- lbl; df[[nm]] <- x',
      '}',
    ].join('\n');

    function readerFor(name) { return READERS.find((r) => r.ext.test(name || '')) || null; }
    function detect(file) { return !!readerFor(file.name); }

    /**
     * PX files declare their code page (CODEPAGE, or CHARSET="ANSI" meaning Latin-1/Windows-1252). Decode
     * with it and return UTF-8 bytes with the header updated, so that R reads the file as UTF-8.
     * @param {Uint8Array} bytes
     */
    function pxToUtf8(bytes) {
      const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
      const m = /CODEPAGE="([^"]+)"/i.exec(head);
      let label = m ? m[1].trim().toLowerCase() : (/CHARSET="ANSI"/i.test(head) ? 'windows-1252' : 'utf-8');
      if (['ansi', 'latin1', 'iso-8859-1', 'iso8859-1', 'cp1252'].includes(label)) label = 'windows-1252';
      let text;
      try { text = new TextDecoder(label, { fatal: label === 'utf-8' }).decode(bytes); } catch (_err) { text = new TextDecoder('windows-1252').decode(bytes); }
      text = text.replace(/^﻿/, '');
      text = /CODEPAGE=/i.test(text) ? text.replace(/CODEPAGE="[^"]*";?/i, 'CODEPAGE="utf-8";') : 'CODEPAGE="utf-8";\n' + text;
      return new TextEncoder().encode(text);
    }

    /** No data preview without R; the wizard shows how the file will be read. */
    async function preview(file) {
      const reader = readerFor(file.name);
      return { kind: 'r', viaR: true, columns: [], dataRows: [], totalRows: undefined, header: true, reader: reader ? reader.label : '', pkg: reader ? reader.pkg : '', format: reader ? reader.format : '' };
    }
    async function parse() { throw new Error('Formatet läses av R; använd importViaR().'); }

    /**
     * Read the file in R and hand it to the app with dm_write(). Resolves with the new dataset's metadata.
     * @param {File} file @param {string} name @param {{description?: string}} [options]
     */
    async function importViaR(file, name, options = {}) {
      const reader = readerFor(file.name);
      if (!reader) throw new Error('Okänt format: ' + file.name);
      const bridge = rb.bridge;
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
      const path = `/tmp/dataspatium-import/${Date.now().toString(36)}-${safe}`;
      let bytes = new Uint8Array(await file.arrayBuffer());
      if (reader.format === 'px') bytes = pxToUtf8(bytes);
      await bridge.writeFile(path, bytes);
      const dsName = name || file.name.replace(/\.[^.]+$/, '');
      const description = options.description || `Importerad från ${file.name} (${reader.label}, R-paketet ${reader.pkg})`;
      // library() goes through webR's shim, which installs a bundled package on first use; `pkg::` alone does not.
      const libs = reader.pkg === 'base' ? '' : `suppressPackageStartupMessages(library(${reader.pkg}))\n`;
      const code = [`${libs}df <- ${reader.code(JSON.stringify(path))}`, NORMALISE, `dm_write(df, ${JSON.stringify(dsName)}, description = ${JSON.stringify(description)})`].join('\n');
      let result;
      try { result = await bridge.run(code); } finally { await bridge.removeFile(path); }
      const error = result.entries.find((e) => e.kind === 'error');
      const dataset = result.entries.find((e) => e.kind === 'dataset');
      if (!dataset) throw new Error(error ? error.text : 'R skapade ingen datamängd.');
      return dataset.meta;
    }

    return { id: 'r', viaR: true, detect, preview, parse, importViaR, readerFor, READERS, pxToUtf8 };
  });
})();
