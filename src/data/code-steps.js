// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Code steps in recipes: an operation that runs a function on the whole table in Python (`def step(df): ...`,
 * pandas) or R (`function(df) {...}`) and replaces the table with what the function returns. The dataset travels
 * as a SQLite file to the engine (data/python-bridge, data/r-bridge) and back; types come from the result's
 * `_columns`. The steps replay, undo and export like other operations (the code itself in the recipe), with a
 * preview on the first rows. The heavy work happens in `prepare`, before the operation's savepoint.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/code-steps', ['data/operations', 'data/types', 'engines/sqlite'], (ops, types, sqlite) => {
    const PREVIEW_ROWS = 200;
    const SAMPLE_ROWS = 5;
    const CHUNK = 20000;
    const LABEL = { python: 'Python', r: 'R' };

    function bridgeFor(lang) { return D.require(lang === 'python' ? 'data/python-bridge' : 'data/r-bridge').bridge; }

    /** Column records of a step result (the same `_columns` table that dm_write() writes). */
    async function resultColumns(engine) {
      const res = await engine.exec('select position, name, type, label, format, source_name, description, unit, value_labels from _columns order by position');
      return (res[0] ? res[0].values : []).map((r, i) => {
        let valueLabels = null;
        if (r[8]) { try { valueLabels = JSON.parse(String(r[8])); } catch (_err) { valueLabels = null; } }
        return { position: i, name: String(r[1]), type: types.TYPES.includes(r[2]) ? r[2] : 'text', label: r[3] ? String(r[3]) : String(r[1]), format: r[4] || null, sourceName: r[5] ? String(r[5]) : String(r[1]), description: r[6] || null, unit: r[7] || null, valueLabels };
      });
    }

    /**
     * Run the code on the dataset (or its first rows) and open the result in a temporary engine.
     * @returns {Promise<{tmp: any, columns: any[], rowCount: number, sample: any[][], log: any[]}>}
     */
    async function runCode(lang, ctx, code, options = {}) {
      const bytes = await ctx.engine.export();
      const res = await bridgeFor(lang).runStep(String(code), bytes, { limit: options.limit, name: options.name });
      const tmp = new sqlite.SqliteEngine();
      await tmp.start();
      await tmp.open(res.bytes);
      try {
        const columns = await resultColumns(tmp);
        if (!columns.length) throw new Error(D.t('op.err.step.nocols'));
        const count = await tmp.exec('select count(*) from data');
        const rowCount = Number(count[0] && count[0].values[0] ? count[0].values[0][0] : 0);
        const sample = await tmp.exec(`select ${columns.map((c) => ops.q(c.name)).join(', ')} from data limit ${SAMPLE_ROWS}`);
        return { tmp, columns, rowCount, sample: sample[0] ? sample[0].values : [], log: res.log || [] };
      } catch (err) { tmp.terminate(); throw err; }
    }

    /** Replace the dataset's table with the step result (inside the operation's savepoint). */
    async function replaceTable(ctx, result) {
      const names = result.columns.map((c) => c.name);
      try {
        await ctx.engine.run('drop table data');
        await ctx.engine.run(`create table data (${result.columns.map((c) => `${ops.q(c.name)} ${types.sqlType(c.type)}`).join(', ')})`);
        for (let offset = 0; ; offset += CHUNK) {
          const page = await result.tmp.exec(`select ${names.map((n) => ops.q(n)).join(', ')} from data limit ${CHUNK} offset ${offset}`);
          const rows = page[0] ? page[0].values : [];
          if (rows.length) await ctx.engine.insertRows('data', names, rows);
          if (rows.length < CHUNK) break;
        }
      } finally { result.tmp.terminate(); }
      ctx.replaceColumns(result.columns.map((c) => ({ name: c.name, type: c.type, label: c.label, format: c.format, sourceName: c.sourceName, description: c.description, unit: c.unit, valueLabels: c.valueLabels })));
    }

    function stepOp(id, lang) {
      return ops.define({
        id, group: 'code', manualPreview: true,
        params: [{ name: 'code', type: 'code', language: lang, required: true }],
        /** The step runs here, before the savepoint: engines cannot work inside it, and a failure leaves the table as it was. */
        async prepare(ctx, p) { ctx._codeStep = await runCode(lang, ctx, p.code, {}); },
        async apply(ctx) {
          const result = ctx._codeStep;
          ctx._codeStep = null;
          if (!result) throw new Error(D.t('op.err.step.noresult'));
          await replaceTable(ctx, result);
          return { rows: result.rowCount, columns: result.columns.length };
        },
        /** The first rows through the function: row count, columns and a few result rows. */
        async preview(ctx, p) {
          const result = await runCode(lang, ctx, p.code, { limit: PREVIEW_ROWS });
          result.tmp.terminate();
          return { rows: result.rowCount, columns: result.columns.map((c) => c.name), sample: result.sample, log: result.log };
        },
        toSQL: (p) => ['-- ' + D.t('code.step.sql.note', { lang: LABEL[lang] })].concat(String(p.code).split('\n').map((l) => '-- ' + l)),
        toR: (p) => (lang === 'r' ? `df <- (${String(p.code).trim()})(df)` : ['# ' + D.t('code.step.r.note')].concat(String(p.code).split('\n').map((l) => '# ' + l)).join('\n')),
      });
    }

    const python = stepOp('python_step', 'python');
    const r = stepOp('r_step', 'r');

    return { python, r, runCode, PREVIEW_ROWS, LABEL };
  });
})();
