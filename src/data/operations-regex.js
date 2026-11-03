// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Recipe steps with regular expressions, used by the Regex tab in Analysera and the action palette in
 * Bearbeta: keep or remove rows that match, extract groups into new columns, flag matches, count matches
 * and split a column at a pattern. Replacing uses the existing step replace_text with `regex: true`.
 *
 * Every step first checks all values of the column in the matching worker of analysis/regex.js within a
 * time limit (catastrophic backtracking stops there instead of hanging the SQLite worker), then runs SQL
 * with the dm_regex_* functions of the SQLite worker. R export uses stringr, whose ICU syntax accepts the
 * same patterns in the common cases (classes, quantifiers, groups, named groups, lookaround, \p{L}).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/operations-regex', ['data/operations', 'data/types', 'data/regex-syntax', 'analysis/regex'], (ops, types, syntax, regex) => {
    const { define, q, lit } = ops;
    const rstr = (s) => JSON.stringify(String(s));
    const MAX_PARTS = 20;
    const rx = (p) => syntax.rRegex(syntax.fullPattern(p), syntax.flagsOf(p));
    const rcol = (c) => `as.character(df$${q(c)})`;
    const count = async (ctx, where) => Number((await ctx.engine.exec(`select count(*) from data${where ? ' where ' + where : ''}`))[0].values[0][0]);
    const textOf = (c) => `cast(${q(c)} as text)`;
    const flagsLit = (p) => lit(syntax.flagsOf(p));
    const patternLit = (p) => lit(syntax.fullPattern(p));
    const PATTERN = { name: 'pattern', type: 'pattern', required: true };
    const CASE = { name: 'caseInsensitive', type: 'switch', default: false };

    /** The column must exist and the pattern must be valid and fast enough on every value of it. */
    async function check(ctx, p) {
      if (!ctx.column(p.column)) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
      await regex.guard({ engine: ctx.engine }, p.column, syntax.fullPattern(p), syntax.flagsOf(p));
    }
    /** Rows of the column that match, counted in the matching worker (safe for previews). */
    async function matching(ctx, p) {
      if (!ctx.column(p.column)) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
      const compiled = syntax.compile(syntax.fullPattern(p), syntax.flagsOf(p));
      if (compiled.error) throw new Error(D.t('regex.err.invalid', { message: compiled.error }));
      return regex.stats({ engine: ctx.engine }, p.column, syntax.fullPattern(p), syntax.flagsOf(p));
    }
    /** New column names must be given and free. */
    function freeNames(ctx, names) {
      const seen = new Set();
      for (const n of names) {
        if (!n) throw new Error(D.t('op.err.name.empty'));
        if (ctx.column(n) || seen.has(n)) throw new Error(D.t('op.err.column.exists', { name: n }));
        seen.add(n);
      }
    }
    async function addColumn(ctx, name, type, expr) {
      await ctx.engine.execMany([`alter table data add column ${q(name)} ${types.sqlType(type)}`, `update data set ${q(name)} = ${expr}`]);
      ctx.addColumn({ name, type, label: name });
    }

    // ---- rows ---------------------------------------------------------------------------------------
    define({
      id: 'regex_filter', group: 'regex',
      params: [{ name: 'column', type: 'column', required: true }, PATTERN, CASE, { name: 'whole', type: 'switch', default: false }, { name: 'keep', type: 'select', options: ['matching', 'other'], default: 'matching' }],
      condition(p) { return `coalesce(dm_regex_test(${textOf(p.column)}, ${patternLit(p)}, ${flagsLit(p)}), 0) = ${p.keep === 'other' ? 1 : 0}`; },
      async preview(ctx, p) {
        const s = await matching(ctx, p);
        return { rows: p.keep === 'other' ? s.matching : s.rows - s.matching };
      },
      async apply(ctx, p) {
        await check(ctx, p);
        return { rows: await ctx.engine.run(`delete from data where ${this.condition(p)}`) };
      },
      toSQL(p) { return [`DELETE FROM data WHERE ${this.condition(p)};`]; },
      toR(p) {
        const hit = `stringr::str_detect(${rcol(p.column)}, ${rx(p)}) %in% TRUE`;
        return `df <- df[${p.keep === 'other' ? `!(${hit})` : hit}, , drop = FALSE]`;
      },
    });

    // ---- new columns --------------------------------------------------------------------------------
    /** Columns that regex_extract creates: one per group (the whole match when there are none). */
    function extractPlan(p) {
      const compiled = syntax.compile(syntax.fullPattern(p), syntax.flagsOf(p));
      if (compiled.error) throw new Error(D.t('regex.err.invalid', { message: compiled.error }));
      const groups = compiled.groups.length ? compiled.groups : ['0'];
      const given = String(p.names || '').split(',').map((s) => s.trim());
      return groups.map((g, i) => ({
        group: g,
        name: given[i] || (/^\d+$/.test(g) ? `${p.column}_${g === '0' ? 'match' : g}` : g),
      }));
    }
    define({
      id: 'regex_extract', group: 'regex',
      params: [{ name: 'column', type: 'column', required: true }, PATTERN, CASE, { name: 'which', type: 'select', options: ['first', 'all'], default: 'first' }, { name: 'sep', type: 'text', default: ', ' }, { name: 'names', type: 'text', default: '' }],
      expr(p, g) {
        const group = /^\d+$/.test(g) ? String(Number(g)) : lit(g);
        return p.which === 'all'
          ? `dm_regex_all(${textOf(p.column)}, ${patternLit(p)}, ${group}, ${lit(p.sep === undefined || p.sep === null ? ', ' : p.sep)}, ${flagsLit(p)})`
          : `dm_regex_extract(${textOf(p.column)}, ${patternLit(p)}, ${group}, ${flagsLit(p)})`;
      },
      async preview(ctx, p) {
        const s = await matching(ctx, p);
        return { rows: s.matching, columns: extractPlan(p).map((x) => x.name) };
      },
      async apply(ctx, p) {
        const plan = extractPlan(p);
        freeNames(ctx, plan.map((x) => x.name));
        await check(ctx, p);
        // The names are kept in the step, so that a replay and the export create the same columns.
        p.names = plan.map((x) => x.name).join(', ');
        for (const x of plan) await addColumn(ctx, x.name, 'text', this.expr(p, x.group));
        return { rows: await count(ctx, plan.map((x) => `${q(x.name)} is not null`).join(' or ')) };
      },
      toSQL(p) { return extractPlan(p).flatMap((x) => [`ALTER TABLE data ADD COLUMN ${q(x.name)} TEXT;`, `UPDATE data SET ${q(x.name)} = ${this.expr(p, x.group)};`]); },
      toR(p) {
        const plan = extractPlan(p);
        if (p.which === 'all') {
          const sep = rstr(p.sep === undefined || p.sep === null ? ', ' : p.sep);
          return [`m <- stringr::str_match_all(${rcol(p.column)}, ${rx(p)})`].concat(plan.map((x) => {
            const col = x.group === '0' ? 1 : plan.indexOf(x) + 2;
            return `df$${q(x.name)} <- vapply(m, function(g) { v <- g[, ${col}]; v <- v[!is.na(v) & v != ""]; if (length(v)) paste(v, collapse = ${sep}) else NA_character_ }, character(1))`;
          })).join('\n');
        }
        if (plan.length === 1 && plan[0].group === '0') return `df$${q(plan[0].name)} <- stringr::str_extract(${rcol(p.column)}, ${rx(p)})`;
        return [`m <- stringr::str_match(${rcol(p.column)}, ${rx(p)})`].concat(plan.map((x, i) => `df$${q(x.name)} <- m[, ${i + 2}]`)).join('\n');
      },
    });

    define({
      id: 'regex_flag', group: 'regex',
      params: [{ name: 'column', type: 'column', required: true }, PATTERN, CASE, { name: 'whole', type: 'switch', default: false }, { name: 'name', type: 'text', required: true }],
      expr(p) { return `dm_regex_test(${textOf(p.column)}, ${patternLit(p)}, ${flagsLit(p)})`; },
      async preview(ctx, p) { return { rows: (await matching(ctx, p)).matching }; },
      async apply(ctx, p) {
        freeNames(ctx, [String(p.name || '').trim()]);
        await check(ctx, p);
        await addColumn(ctx, String(p.name).trim(), 'boolean', this.expr(p));
        return { rows: await count(ctx, `${q(String(p.name).trim())} = 1`) };
      },
      toSQL(p) { return [`ALTER TABLE data ADD COLUMN ${q(p.name)} INTEGER;`, `UPDATE data SET ${q(p.name)} = ${this.expr(p)};`]; },
      toR(p) { return `df$${q(p.name)} <- stringr::str_detect(${rcol(p.column)}, ${rx(p)})`; },
    });

    define({
      id: 'regex_count', group: 'regex',
      params: [{ name: 'column', type: 'column', required: true }, PATTERN, CASE, { name: 'name', type: 'text', required: true }],
      expr(p) { return `dm_regex_count(${textOf(p.column)}, ${patternLit(p)}, ${flagsLit(p)})`; },
      async preview(ctx, p) { return { rows: (await matching(ctx, p)).matching }; },
      async apply(ctx, p) {
        freeNames(ctx, [String(p.name || '').trim()]);
        await check(ctx, p);
        await addColumn(ctx, String(p.name).trim(), 'integer', this.expr(p));
        return { rows: await count(ctx, `${q(String(p.name).trim())} > 0`) };
      },
      toSQL(p) { return [`ALTER TABLE data ADD COLUMN ${q(p.name)} INTEGER;`, `UPDATE data SET ${q(p.name)} = ${this.expr(p)};`]; },
      toR(p) { return `df$${q(p.name)} <- stringr::str_count(${rcol(p.column)}, ${rx(p)})`; },
    });

    /** Names of the columns regex_split creates: <name>_1 … <name>_n. */
    const splitNames = (p) => Array.from({ length: Math.max(2, Math.min(MAX_PARTS, Math.trunc(Number(p.parts) || 2))) }, (_, i) => `${String(p.name || p.column).trim()}_${i + 1}`);
    define({
      id: 'regex_split', group: 'regex',
      params: [{ name: 'column', type: 'column', required: true }, PATTERN, CASE, { name: 'parts', type: 'number', default: 2 }, { name: 'name', type: 'text', required: true }],
      expr(p, i, n) { return `dm_regex_split(${textOf(p.column)}, ${patternLit(p)}, ${i}, ${n}, ${flagsLit(p)})`; },
      async preview(ctx, p) { return { rows: (await matching(ctx, p)).matching, columns: splitNames(p) }; },
      async apply(ctx, p) {
        const names = splitNames(p);
        freeNames(ctx, names);
        await check(ctx, p);
        for (let i = 0; i < names.length; i++) await addColumn(ctx, names[i], 'text', this.expr(p, i + 1, names.length));
        return { rows: await count(ctx, `${q(names[1])} is not null`) };
      },
      toSQL(p) { const names = splitNames(p); return names.flatMap((n, i) => [`ALTER TABLE data ADD COLUMN ${q(n)} TEXT;`, `UPDATE data SET ${q(n)} = ${this.expr(p, i + 1, names.length)};`]); },
      toR(p) {
        const names = splitNames(p);
        // str_split_fixed keeps the rest in the last part, like dm_regex_split; missing parts become NA.
        return [`parts <- stringr::str_split_fixed(${rcol(p.column)}, ${rx(p)}, ${names.length})`, 'parts[parts == ""] <- NA']
          .concat(names.map((n, i) => `df$${q(n)} <- parts[, ${i + 1}]`)).join('\n');
      },
    });

    return { extractPlan, splitNames };
  });
})();
