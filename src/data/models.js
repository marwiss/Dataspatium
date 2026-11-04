// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Saved models: a regression fitted in the Statistics tab is kept in its dataset as plain coefficients and applied with
 * the recipe step Prediktion, on new versions of the data or on other datasets. Coefficients need no engine: the
 * prediction is a SQL expression, also readable in R and in the codebook. The step carries a copy of the model, so a
 * recipe replays even where the dataset that fitted it is gone.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/models', ['data/datasets', 'data/operations'], (datasets, ops) => {
    const { define, q, lit } = ops;
    const uid = () => 'model_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const clean = (s) => String(s).replace(/`/g, '');

    /**
     * A model from the coefficient table of a regression. R names factor terms `column` + level, Python column=level.
     * @param {{name: string, kind: 'linear'|'logistic', target: string, predictors: string[], table: {columns: any[], rows: any[][]}, values: any, lang?: string}} input
     */
    function fromResult(input) {
      const ti = input.table.columns.findIndex((c) => c.name === 'term');
      const ci = input.table.columns.findIndex((c) => c.name === 'skattning');
      let intercept = 0; const terms = [];
      for (const row of input.table.rows) {
        const term = clean(row[ti]); const value = row[ci];
        if (typeof value !== 'number') continue;
        if (term === '(Intercept)' || term === 'const') { intercept = value; continue; }
        const eq = term.indexOf('=');
        const exact = input.predictors.find((p) => p === term);
        if (exact) { terms.push({ column: exact, level: null, coefficient: value }); continue; }
        const byEq = eq > 0 ? input.predictors.find((p) => p === term.slice(0, eq)) : null;
        if (byEq) { terms.push({ column: byEq, level: term.slice(eq + 1), coefficient: value }); continue; }
        const prefix = input.predictors.filter((p) => term.startsWith(p)).sort((a, b) => b.length - a.length)[0];
        if (prefix) terms.push({ column: prefix, level: term.slice(prefix.length), coefficient: value });
      }
      const v = input.values || {};
      return {
        id: uid(), name: String(input.name || '').trim() || input.target, kind: input.kind === 'logistic' ? 'logistic' : 'linear', target: input.target,
        intercept, terms, metrics: { n: v.n === undefined ? null : v.n, r2: v.r2 === undefined ? null : v.r2, aic: v.aic === undefined ? null : v.aic },
        positive: Array.isArray(v.nivaer) && v.nivaer.length ? String(v.nivaer[v.nivaer.length - 1]) : null, lang: input.lang || 'r', createdAt: new Date().toISOString(),
      };
    }
    /** The columns a model needs that a table lacks. */
    function missing(model, columns) {
      const have = new Set(columns.map((c) => c.name));
      return Array.from(new Set(model.terms.map((t) => t.column))).filter((c) => !have.has(c));
    }
    /** The prediction as a SQL expression. A level the model has not seen counts as the reference level. */
    function toSqlExpr(model) {
      const parts = [String(model.intercept)];
      for (const t of model.terms) {
        parts.push(t.level === null ? `(${t.coefficient}) * ${q(t.column)}` : `(${t.coefficient}) * (case when ${q(t.column)} is null then null when ${q(t.column)} = ${lit(t.level)} then 1 else 0 end)`);
      }
      const eta = parts.join(' + ');
      return model.kind === 'logistic' ? `dm_logistic(${eta})` : eta;
    }
    /** The same prediction as R code. */
    function toRExpr(model) {
      const col = (c) => `df[[${JSON.stringify(c)}]]`;
      const parts = [String(model.intercept)];
      for (const t of model.terms) parts.push(t.level === null ? `(${t.coefficient}) * ${col(t.column)}` : `(${t.coefficient}) * (${col(t.column)} == ${JSON.stringify(t.level)})`);
      const eta = parts.join(' + ');
      return model.kind === 'logistic' ? `plogis(${eta})` : eta;
    }
    /** The model as a formula, for the codebook and the log. */
    function describe(model) {
      const num = (v) => String(Math.round(v * 10000) / 10000);
      const parts = model.terms.map((t) => `${t.coefficient < 0 ? '- ' : '+ '}${num(Math.abs(t.coefficient))} × ${t.level === null ? t.column : `(${t.column} = ${t.level})`}`);
      const eta = `${num(model.intercept)} ${parts.join(' ')}`.trim();
      const left = model.kind === 'logistic' ? `P(${model.target} = ${model.positive === null ? '1' : model.positive}) = logistic(` : `${model.target} = `;
      const m = model.metrics || {};
      const fit = [m.n !== null && m.n !== undefined ? `n = ${m.n}` : '', m.r2 !== null && m.r2 !== undefined ? `R² = ${num(m.r2)}` : ''].filter(Boolean).join(', ');
      return `${left}${eta}${model.kind === 'logistic' ? ')' : ''}${fit ? ` (${fit})` : ''}`;
    }

    async function persist(handle) {
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['models', JSON.stringify(handle.meta.models || [])]);
      await datasets.save(handle.meta.id);
    }
    /** Keeps a model in a dataset. @returns {Promise<any>} the model */
    async function save(datasetId, model) {
      const handle = await datasets.ensureOpen(datasetId);
      handle.meta.models = (handle.meta.models || []).filter((m) => m.id !== model.id).concat([model]);
      await persist(handle);
      return model;
    }
    async function remove(datasetId, id) {
      const handle = await datasets.ensureOpen(datasetId);
      handle.meta.models = (handle.meta.models || []).filter((m) => m.id !== id);
      await persist(handle);
    }
    /** Every saved model, with the dataset it was fitted on. */
    async function list() {
      const out = [];
      for (const meta of await datasets.list()) for (const m of meta.models || []) out.push(Object.assign({}, m, { datasetId: meta.id, datasetName: meta.name }));
      return out;
    }

    // The recipe step: the expression is computed through a temporary table, as window functions are in operations-extra.
    define({
      id: 'predict_model', group: 'calc',
      params: [{ name: 'model', type: 'model', required: true }, { name: 'name', type: 'text', required: true, default: 'prediktion' }],
      async preview(ctx, p) {
        if (!p.model) return { rows: 0 };
        const gone = missing(p.model, ctx.columns);
        if (gone.length) throw new Error(D.t('predict.err.columns', { columns: gone.join(', ') }));
        const res = await ctx.engine.exec(`select ${toSqlExpr(p.model)} from data limit 5`);
        return { rows: await count(ctx), sample: res[0] ? res[0].values : [], columns: [String(p.name || 'prediktion')] };
      },
      async apply(ctx, p) {
        if (!p.model) throw new Error(D.t('predict.err.pick'));
        const name = String(p.name || '').trim();
        if (!name) throw new Error(D.t('op.err.name.empty'));
        if (ctx.column(name)) throw new Error(D.t('op.err.column.exists', { name }));
        const gone = missing(p.model, ctx.columns);
        if (gone.length) throw new Error(D.t('predict.err.columns', { columns: gone.join(', ') }));
        await ctx.engine.execMany([
          'drop table if exists temp.__dm_calc', 'create temp table __dm_calc (rid integer primary key, v)',
          `insert into temp.__dm_calc (rid, v) select rowid, ${toSqlExpr(p.model)} from data`,
          `alter table data add column ${q(name)} REAL`,
          `update data set ${q(name)} = (select v from temp.__dm_calc c where c.rid = data.rowid)`,
          'drop table temp.__dm_calc',
        ]);
        ctx.addColumn({ name, type: 'number', label: name, description: D.t('predict.column.description', { name: p.model.name, formula: describe(p.model) }) });
        return { rows: await count(ctx) };
      },
      toSQL: (p) => [`ALTER TABLE data ADD COLUMN ${q(p.name)} REAL;`, `UPDATE data SET ${q(p.name)} = ${toSqlExpr(p.model)};`],
      toR: (p) => `df[[${JSON.stringify(p.name)}]] <- ${toRExpr(p.model)}`,
    });
    async function count(ctx) { return Number((await ctx.engine.exec('select count(*) from data'))[0].values[0][0]); }

    return { fromResult, missing, toSqlExpr, toRExpr, describe, save, remove, list };
  });
})();
