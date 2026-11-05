// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Registry of in-place dataset operations ("recept"-steg). Each operation declares its parameters
 * (for forms and validation), runs as SQL against the dataset's SQLite engine, and can describe
 * itself as SQL and as R for recipe export.
 *
 * Operation contract:
 *   { id, group, params: [{name, type, required?, options?, default?, kinds?, prefer?, labelled?, language?}],
 *     apply(ctx, p) -> Promise<{rows?: number}>, toSQL(p, ctx) -> string[], toR(p, ctx) -> string,
 *     prepare?(ctx, p) (before the savepoint), preview?(ctx, p), manualPreview? (preview on request only) }
 *   Param types: column (kinds limits the types, prefer a RegExp on the name, labelled puts columns with value
 *   labels first), columns, select, switch, lines, expression, pattern, code (language: python|r), text, number.
 * ctx: { engine, columns, q(ident), lit(value), column(name), setType(name, type), rename(old, new),
 *        addColumn({name, type, label}), dropColumn(name), rebuildColumn(name, type, expr) }
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/operations', ['data/types', 'data/boundaries', 'data/regex-syntax'], (types, boundaries, regexSyntax) => {
    const q = (ident) => '"' + String(ident).replace(/"/g, '""') + '"';
    const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
    const rstr = (s) => JSON.stringify(String(s));
    /** @type {Map<string, any>} */
    const registry = new Map();
    function define(op) { registry.set(op.id, op); return op; }

    /** Build the SQL expression that converts a column to a type. */
    function conversionExpr(name, type, p) {
      const c = q(name);
      const decimal = p.decimal && p.decimal !== 'auto' ? lit(p.decimal) : 'NULL';
      const format = p.dateFormat ? lit(p.dateFormat) : 'NULL';
      switch (type) {
        case 'number': return `dm_parse_number(${c}, ${decimal})`;
        case 'integer': return `cast(round(dm_parse_number(${c}, ${decimal})) as integer)`;
        case 'date': return `dm_parse_date(${c}, ${format})`;
        case 'datetime': return `dm_parse_datetime(${c}, ${format})`;
        case 'boolean': return `dm_parse_bool(${c})`;
        default: return `cast(${c} as text)`;
      }
    }

    const TEXT_ONLY = (ctx, cols) => cols.filter((n) => { const c = ctx.column(n); return c && c.type === 'text'; });

    // ---- column metadata -------------------------------------------------------------------
    define({
      id: 'rename_column', group: 'column',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'name', type: 'text', required: true }],
      async apply(ctx, p) {
        const name = String(p.name).trim();
        if (!name) throw new Error(D.t('op.err.name.empty'));
        if (ctx.column(name) && name !== p.column) throw new Error(D.t('op.err.column.exists', { name }));
        await ctx.engine.run(`alter table data rename column ${q(p.column)} to ${q(name)}`);
        ctx.rename(p.column, name);
        return {};
      },
      toSQL: (p) => [`ALTER TABLE data RENAME COLUMN ${q(p.column)} TO ${q(p.name)};`],
      toR: (p) => `names(df)[names(df) == ${rstr(p.column)}] <- ${rstr(p.name)}`,
    });

    define({
      id: 'set_label', group: 'column',
      // Label for headings and charts; description and unit for the codebook, the inspector and R (as attributes).
      params: [{ name: 'column', type: 'column', required: true }, { name: 'label', type: 'text' }, { name: 'description', type: 'text' }, { name: 'unit', type: 'text' }],
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        if (col) {
          col.label = p.label || p.column;
          if (p.description !== undefined) col.description = String(p.description || '').trim() || null;
          if (p.unit !== undefined) col.unit = String(p.unit || '').trim() || null;
          ctx.columnsChanged = true;
        }
        return {};
      },
      toSQL: () => [],
      toR: (p) => [`attr(df$${p.column}, "label") <- ${rstr(p.label || '')}`].concat(p.description ? [`attr(df$${p.column}, "description") <- ${rstr(p.description)}`] : [], p.unit ? [`attr(df$${p.column}, "unit") <- ${rstr(p.unit)}`] : []).join('\n'),
    });

    define({
      id: 'drop_columns', group: 'column',
      params: [{ name: 'columns', type: 'columns', required: true }],
      async apply(ctx, p) {
        if (p.columns.length >= ctx.columns.length) throw new Error(D.t('op.err.keep.one'));
        for (const name of p.columns) { await ctx.engine.run(`alter table data drop column ${q(name)}`); ctx.dropColumn(name); }
        return {};
      },
      toSQL: (p) => p.columns.map((c) => `ALTER TABLE data DROP COLUMN ${q(c)};`),
      toR: (p) => p.columns.map((c) => `df$${q(c)} <- NULL`).join('\n'),
    });

    define({
      id: 'reorder_columns', group: 'column',
      params: [{ name: 'order', type: 'columns', required: true }],
      async apply(ctx, p) {
        const rest = ctx.columns.map((c) => c.name).filter((n) => !p.order.includes(n));
        const order = p.order.concat(rest);
        ctx.columns.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
        ctx.columns.forEach((c, i) => { c.position = i; });
        ctx.columnsChanged = true;
        return {};
      },
      toSQL: () => [],
      toR: (p) => `df <- df[, c(${p.order.map(rstr).join(', ')}, setdiff(names(df), c(${p.order.map(rstr).join(', ')})))]`,
    });

    define({
      id: 'set_type', group: 'column',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'type', type: 'select', required: true, options: types.TYPES }, { name: 'decimal', type: 'select', options: ['auto', 'comma', 'point'], default: 'auto' }, { name: 'dateFormat', type: 'text' }],
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        if (!col) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        if (col.type === p.type) return { rows: 0 };
        const before = await ctx.engine.exec(`select count(${q(p.column)}) from data`);
        await ctx.rebuildColumn(p.column, p.type, conversionExpr(p.column, p.type, p));
        const after = await ctx.engine.exec(`select count(${q(p.column)}) from data`);
        return { rows: Number(after[0].values[0][0]), lost: Number(before[0].values[0][0]) - Number(after[0].values[0][0]) };
      },
      toSQL: (p) => [`ALTER TABLE data ADD COLUMN "__tmp" ${types.sqlType(p.type)};`, `UPDATE data SET "__tmp" = ${conversionExpr(p.column, p.type, p)};`, `ALTER TABLE data DROP COLUMN ${q(p.column)};`, `ALTER TABLE data RENAME COLUMN "__tmp" TO ${q(p.column)};`],
      toR(p) {
        const c = `df$${q(p.column)}`;
        switch (p.type) {
          case 'number': return `${c} <- as.numeric(gsub(",", ".", gsub("[ \\u00a0]", "", ${c})))`;
          case 'integer': return `${c} <- as.integer(round(as.numeric(gsub(",", ".", gsub("[ \\u00a0]", "", ${c})))))`;
          case 'date': return `${c} <- as.Date(${c}${p.dateFormat ? ', format = ' + rstr(p.dateFormat.replace('YYYY', '%Y').replace('MM', '%m').replace('DD', '%d')) : ''})`;
          case 'datetime': return `${c} <- as.POSIXct(${c}, tz = "UTC")`;
          case 'boolean': return `${c} <- tolower(trimws(${c})) %in% c("ja", "true", "1", "yes", "sant", "j")`;
          default: return `${c} <- as.character(${c})`;
        }
      },
    });

    // ---- values ----------------------------------------------------------------------------
    define({
      id: 'replace_text', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'find', type: 'text', required: true }, { name: 'replace', type: 'text', default: '' }, { name: 'regex', type: 'switch', default: false }, { name: 'caseInsensitive', type: 'switch', default: false }],
      expr(p, name) {
        const c = q(name);
        if (p.regex) return `regexp_replace(${c}, ${lit(p.find)}, ${lit(p.replace || '')}, ${lit(p.caseInsensitive ? 'gi' : 'g')})`;
        return `dm_replace(${c}, ${lit(p.find)}, ${lit(p.replace || '')}, ${p.caseInsensitive ? 1 : 0})`;
      },
      where(p, name) {
        const c = q(name);
        if (p.regex) return `${c} IS NOT NULL AND regexp(${lit(p.caseInsensitive ? '(?i)' + p.find : p.find)}, ${c})`;
        return `${c} IS NOT NULL AND instr(${p.caseInsensitive ? 'dm_lower(' + c + ')' : c}, ${lit(p.caseInsensitive ? String(p.find).toLowerCase() : p.find)}) > 0`;
      },
      async preview(ctx, p) {
        const cols = TEXT_ONLY(ctx, p.columns);
        let total = 0; const samples = [];
        for (const name of cols) {
          const res = await ctx.engine.exec(`select count(*) from data where ${this.where(p, name)}`);
          total += Number(res[0].values[0][0]);
          if (samples.length < 5) { const ex = await ctx.engine.exec(`select ${q(name)}, ${this.expr(p, name)} from data where ${this.where(p, name)} limit ${5 - samples.length}`); for (const r of (ex[0] ? ex[0].values : [])) samples.push({ column: name, before: r[0], after: r[1] }); }
        }
        return { rows: total, samples };
      },
      async apply(ctx, p) {
        let rows = 0;
        // A regular expression is first tried on every value within a time limit (see analysis/regex.js).
        if (p.regex) for (const name of TEXT_ONLY(ctx, p.columns)) await D.require('analysis/regex').guard({ engine: ctx.engine }, name, p.find, p.caseInsensitive ? 'i' : '');
        for (const name of TEXT_ONLY(ctx, p.columns)) rows += await ctx.engine.run(`update data set ${q(name)} = ${this.expr(p, name)} where ${this.where(p, name)}`);
        return { rows };
      },
      toSQL(p, ctx) { return TEXT_ONLY(ctx, p.columns).map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)} WHERE ${this.where(p, n)};`); },
      toR(p) {
        // A regex replacement's $1 and $<name> become R's \1; in plain text a backslash is doubled.
        const pat = p.regex ? p.find : String(p.find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const repl = p.regex ? regexSyntax.rReplacement(p.replace || '', p.find) : String(p.replace || '').replace(/\\/g, '\\\\');
        return p.columns.map((c) => `df$${q(c)} <- gsub(${rstr(pat)}, ${rstr(repl)}, df$${q(c)}${p.caseInsensitive ? ', ignore.case = TRUE' : ''}${p.regex ? ', perl = TRUE' : ''})`).join('\n');
      },
    });

    define({
      id: 'trim', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'squish', type: 'switch', default: true }],
      expr(p, name) { return p.squish ? `dm_squish(${q(name)})` : `trim(${q(name)})`; },
      async preview(ctx, p) { let rows = 0; for (const n of TEXT_ONLY(ctx, p.columns)) { const r = await ctx.engine.exec(`select count(*) from data where ${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`); rows += Number(r[0].values[0][0]); } return { rows }; },
      async apply(ctx, p) { let rows = 0; for (const n of TEXT_ONLY(ctx, p.columns)) rows += await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`); return { rows }; },
      toSQL(p, ctx) { return TEXT_ONLY(ctx, p.columns).map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)};`); },
      toR: (p) => p.columns.map((c) => `df$${q(c)} <- ${p.squish ? 'gsub("\\\\s+", " ", trimws(df$' + q(c) + '))' : 'trimws(df$' + q(c) + ')'}`).join('\n'),
    });

    define({
      id: 'change_case', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'mode', type: 'select', required: true, options: ['upper', 'lower', 'title'] }],
      expr(p, name) { return `${p.mode === 'upper' ? 'dm_upper' : p.mode === 'lower' ? 'dm_lower' : 'dm_title'}(${q(name)})`; },
      async apply(ctx, p) { let rows = 0; for (const n of TEXT_ONLY(ctx, p.columns)) rows += await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null`); return { rows }; },
      toSQL(p, ctx) { return TEXT_ONLY(ctx, p.columns).map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)};`); },
      toR: (p) => p.columns.map((c) => `df$${q(c)} <- ${p.mode === 'upper' ? 'toupper' : p.mode === 'lower' ? 'tolower' : 'tools::toTitleCase'}(df$${q(c)})`).join('\n'),
    });

    define({
      id: 'fix_encoding', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }],
      async preview(ctx, p) { let rows = 0; for (const n of TEXT_ONLY(ctx, p.columns)) { const r = await ctx.engine.exec(`select count(*) from data where ${q(n)} is not null and ${q(n)} != dm_fix_encoding(${q(n)})`); rows += Number(r[0].values[0][0]); } return { rows }; },
      async apply(ctx, p) { let rows = 0; for (const n of TEXT_ONLY(ctx, p.columns)) rows += await ctx.engine.run(`update data set ${q(n)} = dm_fix_encoding(${q(n)}) where ${q(n)} is not null and ${q(n)} != dm_fix_encoding(${q(n)})`); return { rows }; },
      toSQL(p, ctx) { return TEXT_ONLY(ctx, p.columns).map((n) => `UPDATE data SET ${q(n)} = dm_fix_encoding(${q(n)});`); },
      toR: (p) => p.columns.map((c) => `df$${q(c)} <- iconv(df$${q(c)}, from = "UTF-8", to = "latin1") |> iconv(from = "UTF-8", to = "UTF-8")`).join('\n'),
    });

    define({
      id: 'replace_value', group: 'values',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'from', type: 'text' }, { name: 'to', type: 'text' }, { name: 'fromEmpty', type: 'switch', default: false }, { name: 'toEmpty', type: 'switch', default: false }],
      where(p) { const c = q(p.column); return p.fromEmpty ? `(${c} IS NULL OR cast(${c} as text) = '')` : `cast(${c} as text) = ${lit(String(p.from))}`; },
      async preview(ctx, p) { const r = await ctx.engine.exec(`select count(*) from data where ${this.where(p)}`); return { rows: Number(r[0].values[0][0]) }; },
      async apply(ctx, p) { const col = ctx.column(p.column); const value = p.toEmpty ? null : types.parseValue(p.to, col ? col.type : 'text'); const rows = await ctx.engine.run(`update data set ${q(p.column)} = ? where ${this.where(p)}`, [value]); return { rows }; },
      toSQL(p) { return [`UPDATE data SET ${q(p.column)} = ${p.toEmpty ? 'NULL' : lit(p.to)} WHERE ${this.where(p)};`]; },
      toR: (p) => p.fromEmpty ? `df$${q(p.column)}[is.na(df$${q(p.column)}) | df$${q(p.column)} == ""] <- ${p.toEmpty ? 'NA' : rstr(p.to)}` : `df$${q(p.column)}[df$${q(p.column)} == ${rstr(p.from)}] <- ${p.toEmpty ? 'NA' : rstr(p.to)}`,
    });

    define({
      id: 'fill_missing', group: 'values',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'mode', type: 'select', required: true, options: ['constant', 'previous', 'next', 'mean', 'median', 'mostcommon'], default: 'constant' }, { name: 'value', type: 'text' }],
      /** The value that fills the gaps for the mean, median and most common modes. */
      async statistic(ctx, p) {
        const c = q(p.column);
        const col = ctx.column(p.column);
        if ((p.mode === 'mean' || p.mode === 'median') && !(col && (col.type === 'integer' || col.type === 'number'))) throw new Error(D.t('op.err.numeric'));
        if (p.mode === 'mean') { const r = await ctx.engine.exec(`select avg(${c}) from data`); const v = r[0].values[0][0]; return v === null ? null : (col.type === 'integer' ? Math.round(v) : v); }
        if (p.mode === 'median') {
          const n = Number((await ctx.engine.exec(`select count(${c}) from data`))[0].values[0][0]);
          if (!n) return null;
          const r = await ctx.engine.exec(`select ${c} from data where ${c} is not null order by ${c} limit ${n % 2 ? 1 : 2} offset ${Math.floor((n - 1) / 2)}`);
          const vals = r[0].values.map((x) => Number(x[0]));
          const m = vals.reduce((a, b) => a + b, 0) / vals.length;
          return col.type === 'integer' ? Math.round(m) : m;
        }
        const r = await ctx.engine.exec(`select ${c} from data where ${c} is not null and cast(${c} as text) != '' group by ${c} order by count(*) desc, ${c} limit 1`);
        return r[0] ? r[0].values[0][0] : null;
      },
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        if (p.mode === 'constant') return { rows: await ctx.engine.run(`update data set ${q(p.column)} = ? where ${q(p.column)} is null`, [types.parseValue(p.value, col ? col.type : 'text')]) };
        if (p.mode === 'mean' || p.mode === 'median' || p.mode === 'mostcommon') {
          const v = await this.statistic(ctx, p);
          return { rows: v === null ? 0 : await ctx.engine.run(`update data set ${q(p.column)} = ? where ${q(p.column)} is null or cast(${q(p.column)} as text) = ''`, [v]) };
        }
        // previous / next: carry the nearest non-empty value down (previous) or up (next) in row order
        const res = await ctx.engine.exec(`select rowid, ${q(p.column)} from data order by rowid ${p.mode === 'next' ? 'desc' : 'asc'}`);
        const pairs = []; let last = null;
        for (const [rowid, v] of (res[0] ? res[0].values : [])) { if (v === null || v === '') { if (last !== null) pairs.push([rowid, last]); } else last = v; }
        return { rows: await ctx.engine.updateRows('data', p.column, pairs) };
      },
      toSQL: (p) => p.mode === 'constant' ? [`UPDATE data SET ${q(p.column)} = ${lit(p.value)} WHERE ${q(p.column)} IS NULL;`] : ['-- ' + D.t('code.fill_down')],
      toR: (p) => {
        const x = `df$${q(p.column)}`;
        switch (p.mode) {
          case 'constant': return `${x}[is.na(${x})] <- ${rstr(p.value)}`;
          case 'next': return `${x} <- zoo::na.locf(${x}, na.rm = FALSE, fromLast = TRUE)`;
          case 'mean': return `${x}[is.na(${x})] <- mean(${x}, na.rm = TRUE)`;
          case 'median': return `${x}[is.na(${x})] <- median(${x}, na.rm = TRUE)`;
          case 'mostcommon': return `${x}[is.na(${x})] <- names(sort(table(${x}), decreasing = TRUE))[1]`;
          default: return `${x} <- zoo::na.locf(${x}, na.rm = FALSE)`;
        }
      },
    });

    // Pseudonymisation of identifiers (personnummer, customer ids) before sharing. Hashing with a salt is
    // pseudonymisation, not anonymisation: the same input gives the same output, and anyone who knows the salt
    // can test candidates. The salt is marked secret and never written to the log or the recipe.
    define({
      id: 'pseudonymize', group: 'values',
      params: [
        { name: 'columns', type: 'columns', required: true },
        { name: 'method', type: 'select', required: true, options: ['hash', 'mask', 'sequence'], default: 'hash' },
        { name: 'salt', type: 'text', secret: true },
        { name: 'length', type: 'number', default: 16 },
        { name: 'keepStart', type: 'number', default: 0 },
        { name: 'keepEnd', type: 'number', default: 0 },
        { name: 'prefix', type: 'text', default: 'P' },
      ],
      hashLength(p) { return Math.max(4, Math.min(64, Number(p.length) || 16)); },
      seqWidth(p) { return Math.max(1, Math.min(12, Number(p.length) || 6)); },
      expr(p, name) {
        const c = `cast(${q(name)} as text)`;
        if (p.method === 'mask') return `dm_mask(${c}, ${Number(p.keepStart) || 0}, ${Number(p.keepEnd) || 0}, '*')`;
        return `dm_hash(${c}, ${lit(p.salt || '')}, ${this.hashLength(p)})`;
      },
      async preview(ctx, p) { let rows = 0; for (const n of p.columns) { const r = await ctx.engine.exec(`select count(*) from data where ${q(n)} is not null`); rows += Number(r[0].values[0][0]); } return { rows }; },
      async apply(ctx, p) {
        let rows = 0;
        for (const n of p.columns) {
          if (p.method === 'sequence') {
            // Stable running numbers per distinct value, numbered in sorted order of the original values.
            const width = this.seqWidth(p);
            await ctx.engine.run('drop table if exists temp._dm_seq');
            await ctx.engine.run(`create temp table _dm_seq as select v, row_number() over (order by v) as r from (select distinct ${q(n)} as v from data where ${q(n)} is not null)`);
            await ctx.engine.run('create index temp._dm_seq_v on _dm_seq(v)');
            rows += await ctx.engine.run(`update data set ${q(n)} = (select ${lit(String(p.prefix || 'P'))} || substr('000000000000' || r, -${width}, ${width}) from _dm_seq where _dm_seq.v = data.${q(n)}) where ${q(n)} is not null`);
            await ctx.engine.run('drop table if exists temp._dm_seq');
          } else {
            rows += await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null`);
          }
          const col = ctx.column(n);
          if (col && col.type !== 'text') ctx.setType(n, 'text');
        }
        return { rows };
      },
      toSQL(p) {
        return p.columns.map((n) => (p.method === 'sequence'
          ? '-- ' + D.t('code.sequence', { column: q(n) })
          : `UPDATE data SET ${q(n)} = ${this.expr(p, n)};  -- ${D.t('code.hash.functions')}`));
      },
      toR(p) {
        const lines = [];
        if (p.method === 'mask') lines.push('dm_mask <- function(x, keep_start = 0, keep_end = 0, ch = "*") { vapply(as.character(x), function(s) { if (is.na(s)) return(NA_character_); chars <- strsplit(s, "")[[1]]; n <- length(chars); idx <- seq_len(n); keep <- idx <= keep_start | idx > n - keep_end | grepl("[[:space:]/.+-]", chars); paste0(ifelse(keep, chars, ch), collapse = "") }, "", USE.NAMES = FALSE) }');
        for (const n of p.columns) {
          const col = `df$${q(n)}`;
          if (p.method === 'mask') lines.push(`${col} <- dm_mask(${col}, ${Number(p.keepStart) || 0}, ${Number(p.keepEnd) || 0})`);
          else if (p.method === 'sequence') lines.push(`${col} <- ifelse(is.na(${col}), NA, paste0(${rstr(p.prefix || 'P')}, formatC(as.integer(factor(${col})), width = ${this.seqWidth(p)}, flag = "0")))`);
          else lines.push(`${col} <- substr(vapply(${p.salt ? `paste0(${rstr(p.salt)}, "|", as.character(${col}))` : `as.character(${col})`}, digest::digest, "", algo = "sha256", serialize = FALSE), 1, ${this.hashLength(p)})  # ${D.t('code.requires', { pkg: 'digest' })}`);
        }
        return lines.join('\n');
      },
    });

    define({
      id: 'edit_cell', group: 'values',
      params: [{ name: 'rowid', type: 'number', required: true }, { name: 'column', type: 'column', required: true }, { name: 'value', type: 'text' }],
      /** Cheap undo: remember the old value instead of snapshotting the whole file. */
      async inverse(ctx, p) {
        const r = await ctx.engine.exec(`select ${q(p.column)} from data where rowid = ?`, [Number(p.rowid)]);
        const old = r[0] && r[0].values[0] ? r[0].values[0][0] : null;
        // A stored number is written with a decimal point, whatever the language.
        return { op: 'edit_cell', params: { rowid: p.rowid, column: p.column, value: old === null || old === undefined ? '' : String(old), decimal: 'point' } };
      },
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        const value = p.value === null || p.value === undefined || p.value === '' ? null : types.parseValue(p.value, col ? col.type : 'text', { decimal: p.decimal || cellDecimal(p.value) });
        if (value === null && p.value !== null && p.value !== undefined && p.value !== '' && col && col.type !== 'text') throw new Error(D.t('op.err.value.type', { value: p.value, type: col.type }));
        return { rows: await ctx.engine.run(`update data set ${q(p.column)} = ? where rowid = ?`, [value, Number(p.rowid)]), value };
      },
      toSQL: (p) => [`UPDATE data SET ${q(p.column)} = ${lit(p.value)} WHERE rowid = ${Number(p.rowid)};`],
      toR: (p) => `df[${Number(p.rowid)}, ${rstr(p.column)}] <- ${rstr(p.value)}  # ${D.t('code.rowid')}`,
    });

    // ---- rows ------------------------------------------------------------------------------
    define({
      id: 'delete_rows', group: 'rows',
      params: [{ name: 'where', type: 'expression', required: true }, { name: 'keep', type: 'switch', default: false }],
      cond(p) { return p.keep ? `NOT (${p.where})` : `(${p.where})`; },
      async preview(ctx, p) { const r = await ctx.engine.exec(`select count(*) from data where ${this.cond(p)}`); return { rows: Number(r[0].values[0][0]) }; },
      async apply(ctx, p) { return { rows: await ctx.engine.run(`delete from data where ${this.cond(p)}`) }; },
      toSQL(p) { return [`DELETE FROM data WHERE ${this.cond(p)};`]; },
      toR: (p) => `# ${D.t('code.sql.where', { where: p.where })}\ndf <- df[${p.keep ? '' : '!'}(with(df, ${p.where.replace(/=/g, '==').replace(/<>/g, '!=')})), ]`,
    });

    define({
      id: 'remove_duplicates', group: 'rows',
      params: [{ name: 'columns', type: 'columns' }],
      keyCols(ctx, p) { return (p.columns && p.columns.length ? p.columns : ctx.columns.map((c) => c.name)).map(q).join(', '); },
      // count(distinct …) takes one argument in SQLite, so distinct rows are counted through a subquery.
      async preview(ctx, p) { const r = await ctx.engine.exec(`select (select count(*) from data) - (select count(*) from (select distinct ${this.keyCols(ctx, p)} from data))`); return { rows: Number(r[0].values[0][0]) }; },
      async apply(ctx, p) { return { rows: await ctx.engine.run(`delete from data where rowid not in (select min(rowid) from data group by ${this.keyCols(ctx, p)})`) }; },
      toSQL(p, ctx) { return [`DELETE FROM data WHERE rowid NOT IN (SELECT min(rowid) FROM data GROUP BY ${this.keyCols(ctx, p)});`]; },
      toR: (p) => p.columns && p.columns.length ? `df <- df[!duplicated(df[, c(${p.columns.map(rstr).join(', ')})]), ]` : 'df <- df[!duplicated(df), ]',
    });

    // ---- structure -------------------------------------------------------------------------
    define({
      id: 'add_column', group: 'structure',
      params: [{ name: 'name', type: 'text', required: true }, { name: 'type', type: 'select', required: true, options: types.TYPES, default: 'number' }, { name: 'expression', type: 'expression', required: true }],
      async apply(ctx, p) {
        const name = String(p.name).trim();
        if (!name) throw new Error(D.t('op.err.name.empty'));
        if (ctx.column(name)) throw new Error(D.t('op.err.column.exists', { name }));
        await ctx.engine.exec(`select (${p.expression}) from data limit 1`); // validates the expression
        await ctx.engine.run(`alter table data add column ${q(name)} ${types.sqlType(p.type)}`);
        const rows = await ctx.engine.run(`update data set ${q(name)} = (${p.expression})`);
        ctx.addColumn({ name, type: p.type, label: name });
        return { rows };
      },
      toSQL: (p) => [`ALTER TABLE data ADD COLUMN ${q(p.name)} ${types.sqlType(p.type)};`, `UPDATE data SET ${q(p.name)} = (${p.expression});`],
      toR: (p) => `# ${D.t('code.sql.expr', { expression: p.expression })}\ndf$${q(p.name)} <- with(df, ${p.expression})`,
    });

    define({
      id: 'combine_columns', group: 'structure',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'separator', type: 'text', default: ' ' }, { name: 'name', type: 'text', required: true }],
      expr(p) { return p.columns.map((c) => `coalesce(cast(${q(c)} as text), '')`).join(` || ${lit(p.separator === undefined ? ' ' : p.separator)} || `); },
      async apply(ctx, p) {
        if (ctx.column(p.name)) throw new Error(D.t('op.err.column.exists', { name: p.name }));
        await ctx.engine.run(`alter table data add column ${q(p.name)} TEXT`);
        const rows = await ctx.engine.run(`update data set ${q(p.name)} = ${this.expr(p)}`);
        ctx.addColumn({ name: p.name, type: 'text', label: p.name });
        return { rows };
      },
      toSQL(p) { return [`ALTER TABLE data ADD COLUMN ${q(p.name)} TEXT;`, `UPDATE data SET ${q(p.name)} = ${this.expr(p)};`]; },
      toR: (p) => `df$${q(p.name)} <- paste(${p.columns.map((c) => 'df$' + q(c)).join(', ')}, sep = ${rstr(p.separator === undefined ? ' ' : p.separator)})`,
    });

    define({
      id: 'split_column', group: 'structure',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'delimiter', type: 'text', required: true }, { name: 'parts', type: 'number', default: 2 }],
      async apply(ctx, p) {
        const parts = Math.max(2, Math.min(20, Number(p.parts) || 2));
        const names = [];
        for (let i = 1; i <= parts; i++) { let n = `${p.column}_${i}`; let k = 2; while (ctx.column(n)) n = `${p.column}_${i}_${k++}`; names.push(n); }
        for (const n of names) { await ctx.engine.run(`alter table data add column ${q(n)} TEXT`); ctx.addColumn({ name: n, type: 'text', label: n }); }
        const res = await ctx.engine.exec(`select rowid, ${q(p.column)} from data where ${q(p.column)} is not null`);
        const perPart = names.map(() => []);
        for (const [rowid, v] of (res[0] ? res[0].values : [])) {
          const pieces = String(v).split(p.delimiter);
          for (let i = 0; i < parts; i++) perPart[i].push([rowid, i < pieces.length ? (i === parts - 1 ? pieces.slice(i).join(p.delimiter) : pieces[i]) : null]);
        }
        let rows = 0;
        for (let i = 0; i < parts; i++) rows += await ctx.engine.updateRows('data', names[i], perPart[i]);
        return { rows: res[0] ? res[0].values.length : 0, columns: names };
      },
      toSQL: (p) => ['-- ' + D.t('code.split', { column: q(p.column), delimiter: lit(p.delimiter), parts: p.parts })],
      toR: (p) => `delar <- strsplit(df$${q(p.column)}, ${rstr(p.delimiter)}, fixed = TRUE)\n${Array.from({ length: Number(p.parts) || 2 }, (_, i) => `df$${q(p.column + '_' + (i + 1))} <- sapply(delar, function(x) x[${i + 1}])`).join('\n')}`,
    });

    define({
      id: 'pivot_longer', group: 'structure',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'namesTo', type: 'text', default: D.t('op.pivot_longer.names.default') }, { name: 'valuesTo', type: 'text', default: D.t('op.pivot_longer.values.default') }],
      async apply(ctx, p) {
        const keep = ctx.columns.map((c) => c.name).filter((n) => !p.columns.includes(n));
        if (!p.columns.length) throw new Error(D.t('op.err.pivot.columns'));
        const namesTo = p.namesTo || 'variabel'; const valuesTo = p.valuesTo || 'varde';
        const selects = p.columns.map((c) => `select ${keep.map(q).concat([`${lit(c)} as ${q(namesTo)}`, `cast(${q(c)} as text) as ${q(valuesTo)}`]).join(', ')} from data`);
        await ctx.engine.execMany([`create table data_new as ${selects.join(' union all ')}`, 'drop table data', 'alter table data_new rename to data']);
        const keepCols = keep.map((n) => Object.assign({}, ctx.column(n)));
        ctx.replaceColumns(keepCols.concat([{ name: namesTo, type: 'text', label: namesTo }, { name: valuesTo, type: 'text', label: valuesTo }]));
        const count = await ctx.engine.exec('select count(*) from data');
        return { rows: Number(count[0].values[0][0]) };
      },
      toSQL: (p) => ['-- ' + D.t('code.pivot_longer', { cols: p.columns.map(q).join(', '), names: p.namesTo || 'variabel', values: p.valuesTo || 'varde' })],
      toR: (p) => `df <- tidyr::pivot_longer(df, cols = c(${p.columns.map(rstr).join(', ')}), names_to = ${rstr(p.namesTo || 'variabel')}, values_to = ${rstr(p.valuesTo || 'varde')})`,
    });

    define({
      id: 'pivot_wider', group: 'structure',
      params: [{ name: 'names', type: 'column', required: true }, { name: 'values', type: 'column', required: true }],
      async apply(ctx, p) {
        const keep = ctx.columns.map((c) => c.name).filter((n) => n !== p.names && n !== p.values);
        const keysRes = await ctx.engine.exec(`select distinct cast(${q(p.names)} as text) from data where ${q(p.names)} is not null order by 1 limit 500`);
        const keys = (keysRes[0] ? keysRes[0].values : []).map((r) => String(r[0]));
        if (!keys.length) throw new Error(D.t('op.err.pivot.values'));
        const valueCol = ctx.column(p.values);
        const agg = valueCol && (valueCol.type === 'number' || valueCol.type === 'integer') ? 'sum' : 'max';
        const cols = keys.map((k) => `${agg}(case when cast(${q(p.names)} as text) = ${lit(k)} then ${q(p.values)} end) as ${q(k)}`);
        await ctx.engine.execMany([`create table data_new as select ${keep.map(q).concat(cols).join(', ')} from data${keep.length ? ' group by ' + keep.map(q).join(', ') : ''}`, 'drop table data', 'alter table data_new rename to data']);
        ctx.replaceColumns(keep.map((n) => Object.assign({}, ctx.column(n))).concat(keys.map((k) => ({ name: k, type: valueCol ? valueCol.type : 'text', label: k }))));
        const count = await ctx.engine.exec('select count(*) from data');
        return { rows: Number(count[0].values[0][0]), columns: keys };
      },
      toSQL: (p) => ['-- ' + D.t('code.pivot_wider', { names: q(p.names), values: q(p.values) })],
      toR: (p) => `df <- tidyr::pivot_wider(df, names_from = ${rstr(p.names)}, values_from = ${rstr(p.values)})`,
    });

    define({
      id: 'sql', group: 'structure',
      params: [{ name: 'statement', type: 'expression', required: true }],
      // Other datasets mentioned by short name are attached before the statement runs (see data/query).
      async prepare(ctx, p) { if (ctx.datasetId) await D.require('data/query').attach(ctx.datasetId, p.statement); },
      async apply(ctx, p) {
        const rows = await ctx.engine.run(p.statement);
        // The statement may have changed the schema; re-read it.
        const info = await ctx.engine.exec('pragma table_info(data)');
        const names = (info[0] ? info[0].values : []).map((r) => String(r[1]));
        const next = names.map((n) => ctx.column(n) || { name: n, type: 'text', label: n });
        if (names.length !== ctx.columns.length || names.some((n, i) => ctx.columns[i].name !== n)) ctx.replaceColumns(next);
        return { rows };
      },
      toSQL: (p) => [p.statement.trim().replace(/;?$/, ';')],
      toR: (p) => `# SQL: ${p.statement.replace(/\n/g, ' ')}\n# ${D.t('code.sql.run')}`,
    });

    // ---- geodata ------------------------------------------------------------------------------
    // Geometry columns hold GeoJSON or WKT text; coordinates are longitude/latitude or SWEREF 99 TM metres.
    // The work is done by the engine's dm_geo_*, dm_to_* and dm_region() functions (sqlite-worker.js).
    async function addColumnOf(ctx, name, type) {
      const n = String(name || '').trim();
      if (!n) throw new Error(D.t('op.err.colname.empty'));
      if (ctx.column(n)) throw new Error(D.t('op.err.column.exists', { name: n }));
      await ctx.engine.run(`alter table data add column ${q(n)} ${types.sqlType(type)}`);
      ctx.addColumn({ name: n, type, label: n });
      return n;
    }
    const GEO_SQL_NOTE = '  -- ' + D.t('code.geo.functions');
    // Column suggestions for the forms: geometry by name among text columns, coordinates among numeric ones.
    const GEOMETRY_PARAM = { name: 'column', type: 'column', required: true, kinds: ['text'], prefer: /^(geometry|geom|wkt|shape|the_geom|geometri)$/i };
    const NUMERIC = ['number', 'integer'];
    const PREFER_X = /^(lon|long|lng|longitude|longitud|x|e|east|easting|ost|öst|x_koord|xkoord)$/i;
    const PREFER_Y = /^(lat|latitude|latitud|y|n|north|northing|nord|norr|y_koord|ykoord)$/i;

    define({
      id: 'geo_centroid', group: 'geo',
      params: [GEOMETRY_PARAM, { name: 'lonName', type: 'text', default: 'lon' }, { name: 'latName', type: 'text', default: 'lat' }],
      names(p) { return [String(p.lonName || 'lon').trim(), String(p.latName || 'lat').trim()]; },
      async apply(ctx, p) {
        const [lon, lat] = this.names(p);
        await addColumnOf(ctx, lon, 'number'); await addColumnOf(ctx, lat, 'number');
        const rows = await ctx.engine.run(`update data set ${q(lon)} = dm_geo_lon(${q(p.column)}), ${q(lat)} = dm_geo_lat(${q(p.column)}) where ${q(p.column)} is not null`);
        return { rows };
      },
      toSQL(p) { const [lon, lat] = this.names(p); return [`ALTER TABLE data ADD COLUMN ${q(lon)} REAL;`, `ALTER TABLE data ADD COLUMN ${q(lat)} REAL;`, `UPDATE data SET ${q(lon)} = dm_geo_lon(${q(p.column)}), ${q(lat)} = dm_geo_lat(${q(p.column)});${GEO_SQL_NOTE}`]; },
      toR(p) { const [lon, lat] = this.names(p); return `# ${D.t('code.geo.centroid')}\ng <- sf::st_as_sfc(df$${q(p.column)}, GeoJSON = TRUE)\nxy <- sf::st_coordinates(sf::st_centroid(g))\ndf$${q(lon)} <- xy[, 1]\ndf$${q(lat)} <- xy[, 2]`; },
    });

    define({
      id: 'geo_area', group: 'geo',
      params: [GEOMETRY_PARAM, { name: 'name', type: 'text', default: 'area_km2' }],
      async apply(ctx, p) {
        const name = await addColumnOf(ctx, p.name || 'area_km2', 'number');
        const rows = await ctx.engine.run(`update data set ${q(name)} = dm_geo_area(${q(p.column)}) where ${q(p.column)} is not null`);
        return { rows };
      },
      toSQL: (p) => [`ALTER TABLE data ADD COLUMN ${q(p.name || 'area_km2')} REAL;`, `UPDATE data SET ${q(p.name || 'area_km2')} = dm_geo_area(${q(p.column)});${GEO_SQL_NOTE}`],
      toR: (p) => `# ${D.t('code.requires', { pkg: 'sf' })}\ng <- sf::st_as_sfc(df$${q(p.column)}, GeoJSON = TRUE)\ndf$${q(p.name || 'area_km2')} <- as.numeric(sf::st_area(g)) / 1e6`,
    });

    define({
      id: 'geo_reproject', group: 'geo',
      params: [{ name: 'xColumn', type: 'column', required: true, kinds: NUMERIC, prefer: PREFER_X }, { name: 'yColumn', type: 'column', required: true, kinds: NUMERIC, prefer: PREFER_Y }, { name: 'direction', type: 'select', required: true, options: ['to_wgs84', 'to_sweref'], default: 'to_wgs84' }, { name: 'xName', type: 'text' }, { name: 'yName', type: 'text' }],
      names(p) { const sweref = p.direction === 'to_sweref'; return [String(p.xName || (sweref ? 'ost' : 'lon')).trim(), String(p.yName || (sweref ? 'norr' : 'lat')).trim()]; },
      exprs(p) { const x = q(p.xColumn); const y = q(p.yColumn); return p.direction === 'to_sweref' ? [`dm_to_east(${x}, ${y})`, `dm_to_north(${x}, ${y})`] : [`dm_to_lon(${x}, ${y})`, `dm_to_lat(${x}, ${y})`]; },
      async apply(ctx, p) {
        const [xn, yn] = this.names(p); const [ex, ey] = this.exprs(p);
        await addColumnOf(ctx, xn, 'number'); await addColumnOf(ctx, yn, 'number');
        const rows = await ctx.engine.run(`update data set ${q(xn)} = ${ex}, ${q(yn)} = ${ey} where ${q(p.xColumn)} is not null and ${q(p.yColumn)} is not null`);
        return { rows };
      },
      toSQL(p) { const [xn, yn] = this.names(p); const [ex, ey] = this.exprs(p); return [`ALTER TABLE data ADD COLUMN ${q(xn)} REAL;`, `ALTER TABLE data ADD COLUMN ${q(yn)} REAL;`, `UPDATE data SET ${q(xn)} = ${ex}, ${q(yn)} = ${ey};${GEO_SQL_NOTE}`]; },
      toR(p) { const [xn, yn] = this.names(p); const from = p.direction === 'to_sweref' ? 4326 : 3006; const to = p.direction === 'to_sweref' ? 3006 : 4326; return `# ${D.t('code.requires', { pkg: 'sf' })}\npts <- sf::st_transform(sf::st_as_sf(df, coords = c(${rstr(p.xColumn)}, ${rstr(p.yColumn)}), crs = ${from}, remove = FALSE), ${to})\nxy <- sf::st_coordinates(pts)\ndf$${q(xn)} <- xy[, 1]\ndf$${q(yn)} <- xy[, 2]`; },
    });

    define({
      id: 'geo_region', group: 'geo',
      params: [{ name: 'lonColumn', type: 'column', required: true, kinds: NUMERIC, prefer: PREFER_X }, { name: 'latColumn', type: 'column', required: true, kinds: NUMERIC, prefer: PREFER_Y }, { name: 'level', type: 'select', required: true, options: ['kommun', 'lan'], default: 'kommun' }],
      fields(p) { return p.level === 'lan' ? ['lanskod', 'lan'] : ['kommunkod', 'kommun', 'lanskod', 'lan']; },
      file(p) { return p.level === 'lan' ? 'lan' : 'kommuner'; },
      async apply(ctx, p) {
        const fields = this.fields(p);
        for (const f of fields) if (ctx.column(f)) throw new Error(D.t('op.err.column.exists', { name: f }));
        const feats = await boundaries.features(this.file(p));
        await ctx.engine.regions(feats.map((f) => ({ geometry: f.geometry, props: f.props })));
        for (const f of fields) await addColumnOf(ctx, f, 'text');
        const lon = q(p.lonColumn); const lat = q(p.latColumn);
        const rows = await ctx.engine.run(`update data set ${fields.map((f) => `${q(f)} = dm_region(${lon}, ${lat}, ${lit(f)})`).join(', ')} where ${lon} is not null and ${lat} is not null`);
        const hit = await ctx.engine.exec(`select count(*) from data where ${q(fields[0])} is not null`);
        return { rows, matched: Number(hit[0].values[0][0]) };
      },
      toSQL(p) { const fields = this.fields(p); const lon = q(p.lonColumn); const lat = q(p.latColumn); return fields.map((f) => `ALTER TABLE data ADD COLUMN ${q(f)} TEXT;`).concat([`UPDATE data SET ${fields.map((f) => `${q(f)} = dm_region(${lon}, ${lat}, ${lit(f)})`).join(', ')};${GEO_SQL_NOTE} ${D.t('code.geo.region.lookup')}`]); },
      toR(p) { const file = `presets/geo/${this.file(p)}.geojson`; return `# ${D.t('code.geo.region.r', { file })}\ngranser <- sf::st_read(${rstr(file)}, quiet = TRUE)\npts <- sf::st_as_sf(df, coords = c(${rstr(p.lonColumn)}, ${rstr(p.latColumn)}), crs = 4326, remove = FALSE)\ndf <- sf::st_drop_geometry(sf::st_join(pts, granser[, c(${this.fields(p).map(rstr).join(', ')})], join = sf::st_within))`; },
    });

    /**
     * How a number typed in a cell is meant. 3.14 cannot be a thousands separator, whatever the language, while 1.234 is one
     * thousand two hundred and thirty-four in the Nordic languages and a little over one in English.
     * @param {any} value @returns {'comma'|'point'}
     */
    function cellDecimal(value) {
      const text = String(value).trim();
      if (/^[-+]?\d+\.\d+$/.test(text) && !/^[-+]?\d{1,3}\.\d{3}$/.test(text)) return 'point';
      return D.require('ui/i18n').language() === 'en' ? 'point' : 'comma';
    }

    function get(id) { const op = registry.get(id); if (!op) throw new Error('Unknown operation: ' + id); return op; }
    function list() { return Array.from(registry.values()); }

    /** Build an operation context for a dataset handle (engine + mutable columns copy). */
    function makeContext(engine, columns) {
      const ctx = {
        engine, columns: columns.map((c) => Object.assign({}, c)), columnsChanged: false, q, lit,
        column(name) { return ctx.columns.find((c) => c.name === name) || null; },
        rename(oldName, newName) { const c = ctx.column(oldName); if (c) { c.name = newName; if (c.label === oldName) c.label = newName; ctx.columnsChanged = true; } },
        setType(name, type) { const c = ctx.column(name); if (c) { c.type = type; ctx.columnsChanged = true; } },
        addColumn(col) { ctx.columns.push(Object.assign({ position: ctx.columns.length, format: null, sourceName: col.name }, col)); ctx.columnsChanged = true; },
        dropColumn(name) { ctx.columns = ctx.columns.filter((c) => c.name !== name); ctx.columns.forEach((c, i) => { c.position = i; }); ctx.columnsChanged = true; },
        replaceColumns(cols) { ctx.columns = cols.map((c, i) => Object.assign({ position: i, format: null, sourceName: c.name, label: c.name }, c, { position: i })); ctx.columnsChanged = true; },
        /** Replace a column with a converted copy (SQLite column affinity makes in-place type changes unreliable). */
        async rebuildColumn(name, type, expr) {
          const tmp = '__dm_tmp_' + Math.random().toString(36).slice(2, 7);
          await engine.execMany([
            `alter table data add column ${q(tmp)} ${types.sqlType(type)}`,
            `update data set ${q(tmp)} = ${expr}`,
            `alter table data drop column ${q(name)}`,
            `alter table data rename column ${q(tmp)} to ${q(name)}`,
          ]);
          ctx.setType(name, type);
        },
      };
      return ctx;
    }

    return { define, get, list, makeContext, q, lit };
  });
})();
