// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Charts drawn by code (kinds 'r' and 'python'): the script gets the dataset as `df`, optionally filtered, and the
 * last plot it draws is the chart. This module builds the prelude that loads and filters `df` in either language
 * and renders such charts headless through the engine bridges (export, batch per group, documents, slides).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/code-charts', [], () => {
    const KINDS = ['r', 'python'];
    const str = (s) => JSON.stringify(String(s === undefined || s === null ? '' : s));

    function isCode(kind) { return KINDS.includes(kind); }
    function bridgeFor(lang) { return D.require(lang === 'python' ? 'data/python-bridge' : 'data/r-bridge').bridge; }

    /**
     * Filter clauses of a chart data request ({field, op, value}) as R or pandas statements on `df`.
     * Operators: =, !=, >, >=, <, <=, in, contains, empty, notempty; others are ignored.
     * @param {'r'|'python'} lang @param {any[]} filters
     * @returns {string[]}
     */
    function filterCode(lang, filters) {
      const lines = [];
      for (const f of filters || []) {
        if (!f || !f.field || !f.op) continue;
        const col = str(f.field);
        const val = f.value;
        const num = typeof val === 'number';
        const lit = num ? String(val) : str(val);
        const list = (Array.isArray(val) ? val : [val]).map((v) => str(v)).join(', ');
        let cond = null;
        if (lang === 'r') {
          const x = `df[[${col}]]`;
          if (f.op === '=') cond = num ? `${x} == ${lit}` : `as.character(${x}) == ${lit}`;
          else if (f.op === '!=') cond = num ? `${x} != ${lit}` : `as.character(${x}) != ${lit}`;
          else if (['>', '>=', '<', '<='].includes(f.op)) cond = `${x} ${f.op} ${lit}`;
          else if (f.op === 'in') cond = `as.character(${x}) %in% c(${list})`;
          else if (f.op === 'contains') cond = `grepl(${lit}, as.character(${x}), fixed = TRUE)`;
          else if (f.op === 'empty') cond = `is.na(${x}) | as.character(${x}) == ""`;
          else if (f.op === 'notempty') cond = `!is.na(${x}) & as.character(${x}) != ""`;
          if (cond) lines.push(`df <- df[!is.na(${cond}) & (${cond}), , drop = FALSE]`);
        } else {
          const x = `df[${col}]`;
          if (f.op === '=') cond = num ? `${x} == ${lit}` : `${x}.astype(str) == ${lit}`;
          else if (f.op === '!=') cond = num ? `${x} != ${lit}` : `${x}.astype(str) != ${lit}`;
          else if (['>', '>=', '<', '<='].includes(f.op)) cond = `${x} ${f.op} ${lit}`;
          else if (f.op === 'in') cond = `${x}.astype(str).isin([${list}])`;
          else if (f.op === 'contains') cond = `${x}.astype(str).str.contains(${lit}, regex=False)`;
          else if (f.op === 'empty') cond = `(${x}.isna() | (${x}.astype(str) == ""))`;
          else if (f.op === 'notempty') cond = `(${x}.notna() & (${x}.astype(str) != ""))`;
          if (cond) lines.push(`df = df[${cond}]`);
        }
      }
      return lines;
    }

    /** Code that loads the dataset as `df` (by short name when known) and applies the filters, before the script. */
    function prelude(lang, datasetRef, filters) {
      const first = lang === 'r' ? `df <- dm_read(${str(datasetRef)})` : `df = dm_read(${str(datasetRef)})`;
      return [first].concat(filterCode(lang, filters)).join('\n') + '\n';
    }

    /**
     * Run a code chart's script in its engine and return the last plot as a blob (svg, png or pdf). `extraFilters`
     * filter `df`; width and height are pixels (96 per inch when the engine draws in inches). A plotly figure from
     * Python is drawn by plotly.js.
     * @param {any} chart @param {'svg'|'png'|'pdf'} format @param {{extraFilters?: any[], width?: number, height?: number}} [options]
     * @returns {Promise<Blob>}
     */
    async function toBlob(chart, format, options = {}) {
      const lang = chart.kind;
      if (!isCode(lang)) throw new Error(D.t('viz.err.rkind', { kind: chart.kind }));
      const bridge = bridgeFor(lang);
      const code = (chart[lang] && chart[lang].code) || '';
      const res = await bridge.run(prelude(lang, chart.datasetShort || chart.datasetName, options.extraFilters || []) + code);
      const plots = res.entries.filter((e) => e.kind === 'plot' && e.key);
      if (!plots.length) {
        const error = res.entries.find((e) => e.kind === 'error');
        throw new Error(error ? error.text : D.t('viz.code.no.plot'));
      }
      const last = plots[plots.length - 1];
      const width = Number(options.width) || 960;
      const height = Number(options.height) || Math.round(width * 0.6);
      return bridge.exportPlot(last.key, format, { width: (width / 96).toFixed(2), height: (height / 96).toFixed(2), dpi: 150 });
    }

    return { KINDS, isCode, filterCode, prelude, toBlob };
  });
})();
