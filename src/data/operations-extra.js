// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * More everyday table operations, registered in data/operations: rounding, padding codes with leading zeros,
 * removing characters, recoding values, more ways to fill missing values, sorting, keeping the top rows,
 * random samples, removing empty rows and columns, copying and cleaning column names, and new columns from
 * text, dates and calculations (classes, shares, ranks, running totals, changes, standardised values).
 * Calculations over several rows use SQLite window functions through a temporary table, since window
 * functions cannot appear in UPDATE directly.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/operations-extra', ['data/operations', 'data/types'], (ops, types) => {
    const { define, q, lit } = ops;
    const rstr = (s) => JSON.stringify(String(s));
    const NUMERIC = ['integer', 'number'];
    const DATES = ['date', 'datetime', 'text'];
    const count = async (ctx, where) => Number((await ctx.engine.exec(`select count(*) from data${where ? ' where ' + where : ''}`))[0].values[0][0]);
    const ofType = (ctx, names, kinds) => (names || []).filter((n) => { const c = ctx.column(n); return c && kinds.includes(c.type); });
    const int = (v, lo, hi, fallback) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback; };
    const partition = (p) => (p.group ? `partition by ${q(p.group)} ` : '');
    const rGroup = (p) => (p.group ? ` |> dplyr::group_by(${q(p.group)})` : '');
    const rUngroup = (p) => (p.group ? ' |> dplyr::ungroup()' : '');

    /** A new column filled from a query over the whole table (window functions): `select rowid, <expr> from data`. */
    async function addComputed(ctx, name, type, expr) {
      const n = String(name || '').trim();
      if (!n) throw new Error(D.t('op.err.name.empty'));
      if (ctx.column(n)) throw new Error(D.t('op.err.column.exists', { name: n }));
      // rid is the primary key, so the update looks each row up instead of scanning the temporary table.
      await ctx.engine.execMany([
        'drop table if exists temp.__dm_calc',
        'create temp table __dm_calc (rid integer primary key, v)',
        `insert into temp.__dm_calc (rid, v) select rowid, ${expr} from data`,
        `alter table data add column ${q(n)} ${types.sqlType(type)}`,
        `update data set ${q(n)} = (select v from temp.__dm_calc c where c.rid = data.rowid)`,
        'drop table temp.__dm_calc',
      ]);
      ctx.addColumn({ name: n, type, label: n });
      return { rows: await count(ctx, `${q(n)} is not null`) };
    }
    const computedSQL = (p, type, expr) => [
      'CREATE TEMP TABLE __dm_calc (rid INTEGER PRIMARY KEY, v);',
      `INSERT INTO temp.__dm_calc (rid, v) SELECT rowid, ${expr} FROM data;`,
      `ALTER TABLE data ADD COLUMN ${q(p.name)} ${types.sqlType(type)};`,
      `UPDATE data SET ${q(p.name)} = (SELECT v FROM temp.__dm_calc c WHERE c.rid = data.rowid);`,
      'DROP TABLE temp.__dm_calc;',
    ];

    // ---- columns ------------------------------------------------------------------------------------
    define({
      id: 'duplicate_column', group: 'column',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'name', type: 'text', required: true }],
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        if (!col) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        return addComputed(ctx, p.name, col.type, q(p.column));
      },
      toSQL: (p) => [`ALTER TABLE data ADD COLUMN ${q(p.name)};`, `UPDATE data SET ${q(p.name)} = ${q(p.column)};`],
      toR: (p) => `df$${q(p.name)} <- df$${q(p.column)}`,
    });

    /** Column name for code: lower case, ASCII letters, digits and underscores, never starting with a digit. */
    function cleanName(name) {
      const map = { å: 'a', ä: 'a', ö: 'o', æ: 'ae', ø: 'o', ð: 'd', þ: 'th', ß: 'ss' };
      const s = String(name).toLowerCase().replace(/[åäöæøðþß]/g, (ch) => map[ch]).normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return !s ? 'kolumn' : /^[0-9]/.test(s) ? 'x' + s : s;
    }
    define({
      id: 'clean_names', group: 'column',
      params: [],
      /** New names for every column (unique; the label keeps the original name). */
      plan(columns) {
        const used = new Set(); const out = [];
        for (const c of columns) {
          let base = cleanName(c.name); let name = base; let k = 2;
          while (used.has(name)) name = `${base}_${k++}`;
          used.add(name);
          out.push({ from: c.name, to: name, label: c.label || c.name });
        }
        return out;
      },
      async preview(ctx) { return { rows: 0, samples: this.plan(ctx.columns).filter((x) => x.from !== x.to).slice(0, 8).map((x) => ({ before: x.from, after: x.to })) }; },
      async apply(ctx, p) {
        const plan = this.plan(ctx.columns).filter((x) => x.from !== x.to);
        // Two steps so that a new name may equal another column's old name.
        const tmp = plan.map((x, i) => `__dm_name_${i}`);
        await ctx.engine.execMany(plan.map((x, i) => `alter table data rename column ${q(x.from)} to ${q(tmp[i])}`).concat(plan.map((x, i) => `alter table data rename column ${q(tmp[i])} to ${q(x.to)}`)));
        for (const x of plan) { ctx.rename(x.from, x.to); const c = ctx.column(x.to); if (c) c.label = x.label; }
        // The renames are kept with the step, so that SQL and R export them after the columns have changed.
        if (p) p.renames = plan.map((x) => [x.from, x.to]);
        return { rows: 0, columns: plan.length };
      },
      renames(p, ctx) { return p && p.renames ? p.renames : this.plan(ctx ? ctx.columns : []).filter((x) => x.from !== x.to).map((x) => [x.from, x.to]); },
      toSQL(p, ctx) { return this.renames(p, ctx).map(([from, to]) => `ALTER TABLE data RENAME COLUMN ${q(from)} TO ${q(to)};`); },
      toR(p, ctx) { const r = this.renames(p, ctx); return r.length ? `df <- dplyr::rename(df, ${r.map(([from, to]) => `${rstr(to)} = ${rstr(from)}`).join(', ')})` : ''; },
    });

    // ---- values -------------------------------------------------------------------------------------
    define({
      id: 'round_numbers', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'decimals', type: 'number', default: 0 }, { name: 'mode', type: 'select', options: ['round', 'floor', 'ceil', 'trunc'], default: 'round' }],
      expr(p, n) { return `dm_round(${q(n)}, ${int(p.decimals, -10, 10, 0)}, ${lit(p.mode || 'round')})`; },
      async preview(ctx, p) { let rows = 0; for (const n of ofType(ctx, p.columns, NUMERIC)) rows += await count(ctx, `${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`); return { rows }; },
      async apply(ctx, p) {
        let rows = 0;
        for (const n of ofType(ctx, p.columns, NUMERIC)) rows += await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`);
        return { rows };
      },
      toSQL(p, ctx) { return ofType(ctx, p.columns, NUMERIC).map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)};`); },
      toR(p) {
        const f = `10^${int(p.decimals, -10, 10, 0)}`;
        const fn = { floor: 'floor', ceil: 'ceiling', trunc: 'trunc' }[p.mode];
        return p.columns.map((c) => { const x = `df$${q(c)}`; return `${x} <- ${fn ? `${fn}(${x} * ${f}) / ${f}` : `sign(${x}) * floor(abs(${x}) * ${f} + 0.5) / ${f}`}`; }).join('\n');
      },
    });

    define({
      id: 'pad_text', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'length', type: 'number', required: true, default: 4 }, { name: 'fill', type: 'text', default: '0' }, { name: 'side', type: 'select', options: ['left', 'right'], default: 'left' }],
      expr(p, n) { return `dm_pad(${q(n)}, ${int(p.length, 1, 100, 4)}, ${lit(String(p.fill === undefined || p.fill === '' ? '0' : p.fill))}, ${lit(p.side || 'left')})`; },
      async preview(ctx, p) { let rows = 0; for (const n of p.columns) if (ctx.column(n)) rows += await count(ctx, `${q(n)} is not null and cast(${q(n)} as text) != ${this.expr(p, n)}`); return { rows }; },
      async apply(ctx, p) {
        let rows = 0;
        for (const n of p.columns) {
          const c = ctx.column(n);
          if (!c) continue;
          const changed = await count(ctx, `${q(n)} is not null and cast(${q(n)} as text) != ${this.expr(p, n)}`);
          // Codes stored as numbers cannot keep leading zeros: the column becomes text.
          if (c.type !== 'text') await ctx.rebuildColumn(n, 'text', `case when ${q(n)} is null then null else ${this.expr(p, n)} end`);
          else await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null`);
          rows += changed;
        }
        return { rows };
      },
      toSQL(p) { return p.columns.map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)} WHERE ${q(n)} IS NOT NULL;`); },
      toR: (p) => p.columns.map((c) => `df$${q(c)} <- stringr::str_pad(as.character(df$${q(c)}), ${int(p.length, 1, 100, 4)}, side = ${rstr(p.side === 'right' ? 'right' : 'left')}, pad = ${rstr(String(p.fill || '0').slice(0, 1))})`).join('\n'),
    });

    const CLEAN = { digits: ['[^0-9]', 'g'], letters: ['[^\\p{L}\\s]', 'gu'], punct: ['[\\p{P}\\p{S}]', 'gu'], spaces: ['\\s+', 'g'] };
    define({
      id: 'clean_chars', group: 'values',
      params: [{ name: 'columns', type: 'columns', required: true }, { name: 'mode', type: 'select', options: Object.keys(CLEAN), default: 'digits' }],
      expr(p, n) { const [re, flags] = CLEAN[p.mode] || CLEAN.digits; return `regexp_replace(${q(n)}, ${lit(re)}, '', ${lit(flags)})`; },
      async preview(ctx, p) { let rows = 0; for (const n of ofType(ctx, p.columns, ['text'])) rows += await count(ctx, `${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`); return { rows }; },
      async apply(ctx, p) {
        let rows = 0;
        for (const n of ofType(ctx, p.columns, ['text'])) rows += await ctx.engine.run(`update data set ${q(n)} = ${this.expr(p, n)} where ${q(n)} is not null and ${q(n)} != ${this.expr(p, n)}`);
        return { rows };
      },
      toSQL(p, ctx) { return ofType(ctx, p.columns, ['text']).map((n) => `UPDATE data SET ${q(n)} = ${this.expr(p, n)};`); },
      toR: (p) => { const [re] = CLEAN[p.mode] || CLEAN.digits; return p.columns.map((c) => `df$${q(c)} <- gsub(${rstr(re)}, "", df$${q(c)}${re.includes('\\p') ? ', perl = TRUE' : ''})`).join('\n'); },
    });

    /** "från = till" lines -> [[from, to]]; an empty right side means an empty value. */
    function mapping(text) {
      return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
        const i = l.indexOf('=');
        return i < 0 ? null : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }).filter((x) => x && x[0] !== '');
    }
    define({
      id: 'recode_values', group: 'values',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'mapping', type: 'lines', required: true }, { name: 'others', type: 'select', options: ['keep', 'empty'], default: 'keep' }],
      caseExpr(p) {
        const pairs = mapping(p.mapping);
        if (!pairs.length) throw new Error(D.t('op.err.mapping'));
        return `case cast(${q(p.column)} as text) ${pairs.map(([a, b]) => `when ${lit(a)} then ${b === '' ? 'null' : lit(b)}`).join(' ')} else ${p.others === 'empty' ? 'null' : q(p.column)} end`;
      },
      where(p) { const keys = mapping(p.mapping).map(([a]) => lit(a)); return p.others === 'empty' ? `${q(p.column)} is not null` : `cast(${q(p.column)} as text) in (${keys.join(', ') || "''"})`; },
      async preview(ctx, p) { return { rows: await count(ctx, this.where(p)) }; },
      async apply(ctx, p) {
        const c = ctx.column(p.column);
        if (!c) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        const rows = await count(ctx, this.where(p));
        // New values may be text where the column held numbers: such a column is rebuilt as text.
        if (c.type !== 'text' && mapping(p.mapping).some(([, b]) => b !== '' && types.parseValue(b, c.type) === null)) await ctx.rebuildColumn(p.column, 'text', this.caseExpr(p));
        else await ctx.engine.run(`update data set ${q(p.column)} = ${this.caseExpr(p)}`);
        return { rows };
      },
      toSQL(p) { return [`UPDATE data SET ${q(p.column)} = ${this.caseExpr(p)};`]; },
      toR: (p) => `df$${q(p.column)} <- dplyr::recode(as.character(df$${q(p.column)}), ${mapping(p.mapping).map(([a, b]) => `${rstr(a)} = ${b === '' ? 'NA_character_' : rstr(b)}`).join(', ')}${p.others === 'empty' ? ', .default = NA_character_' : ''})`,
    });

    // ---- rows ---------------------------------------------------------------------------------------
    define({
      id: 'sort_rows', group: 'rows',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'direction', type: 'select', options: ['asc', 'desc'], default: 'asc' }],
      statements(p) { return [`create table data_sorted as select * from data order by ${q(p.column)} ${p.direction === 'desc' ? 'desc' : 'asc'} nulls last, rowid`, 'drop table data', 'alter table data_sorted rename to data']; },
      async apply(ctx, p) {
        if (!ctx.column(p.column)) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        await ctx.engine.execMany(this.statements(p));
        return { rows: await count(ctx) };
      },
      toSQL(p) { return this.statements(p).map((s) => s + ';'); },
      toR: (p) => `df <- df[order(df$${q(p.column)}, decreasing = ${p.direction === 'desc' ? 'TRUE' : 'FALSE'}, na.last = TRUE), ]`,
    });

    define({
      id: 'keep_top', group: 'rows',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'count', type: 'number', required: true, default: 10 }, { name: 'which', type: 'select', options: ['largest', 'smallest'], default: 'largest' }, { name: 'group', type: 'column', optional: true }],
      where(p) {
        const n = int(p.count, 1, 1e9, 10);
        return `rowid not in (select rid from (select rowid as rid, row_number() over (${partition(p)}order by ${q(p.column)} ${p.which === 'smallest' ? 'asc' : 'desc'} nulls last, rowid) as rn from data) where rn <= ${n})`;
      },
      async preview(ctx, p) { return { rows: await count(ctx, this.where(p)) }; },
      async apply(ctx, p) { return { rows: await ctx.engine.run(`delete from data where ${this.where(p)}`) }; },
      toSQL(p) { return [`DELETE FROM data WHERE ${this.where(p)};`]; },
      toR: (p) => `df <- df${rGroup(p)} |> dplyr::${p.which === 'smallest' ? 'slice_min' : 'slice_max'}(${q(p.column)}, n = ${int(p.count, 1, 1e9, 10)}, with_ties = FALSE)${rUngroup(p)}`,
    });

    define({
      id: 'sample_rows', group: 'rows',
      params: [{ name: 'count', type: 'number', required: true, default: 100 }, { name: 'unit', type: 'select', options: ['rows', 'percent'], default: 'rows' }, { name: 'seed', type: 'number', default: 1 }],
      async keep(ctx, p) {
        const total = await count(ctx);
        return p.unit === 'percent' ? Math.round(total * Math.max(0, Math.min(100, Number(p.count) || 0)) / 100) : int(p.count, 0, 1e9, 100);
      },
      // The same seed always picks the same rows: rows are ordered by a hash of their position and the seed.
      where(p, n) { return `rowid not in (select rowid from data order by dm_hash(cast(rowid as text), ${lit(String(p.seed === undefined ? 1 : p.seed))}, 16) limit ${n})`; },
      async preview(ctx, p) { return { rows: await count(ctx, this.where(p, await this.keep(ctx, p))) }; },
      async apply(ctx, p) { return { rows: await ctx.engine.run(`delete from data where ${this.where(p, await this.keep(ctx, p))}`) }; },
      toSQL(p) { return [`-- ${D.t('code.sample', { seed: p.seed === undefined ? 1 : p.seed })}`]; },
      toR: (p) => `set.seed(${int(p.seed, -1e9, 1e9, 1)})\ndf <- ${p.unit === 'percent' ? `dplyr::slice_sample(df, prop = ${Math.max(0, Math.min(100, Number(p.count) || 0)) / 100})` : `dplyr::slice_sample(df, n = ${int(p.count, 0, 1e9, 100)})`}`,
    });

    define({
      id: 'remove_empty', group: 'rows',
      params: [{ name: 'emptyRows', type: 'switch', default: true }, { name: 'emptyColumns', type: 'switch', default: false }],
      blank: (n) => `(${q(n)} is null or trim(cast(${q(n)} as text)) = '')`,
      async preview(ctx, p) { return { rows: p.emptyRows === false ? 0 : await count(ctx, ctx.columns.map((c) => this.blank(c.name)).join(' and ')) }; },
      async apply(ctx, p) {
        let rows = 0; const dropped = [];
        if (p.emptyRows !== false && ctx.columns.length) rows = await ctx.engine.run(`delete from data where ${ctx.columns.map((c) => this.blank(c.name)).join(' and ')}`);
        if (p.emptyColumns) {
          for (const c of ctx.columns.slice()) {
            if (ctx.columns.length - dropped.length <= 1) break;
            if (await count(ctx, `not ${this.blank(c.name)}`) === 0) dropped.push(c.name);
          }
          for (const n of dropped) { await ctx.engine.run(`alter table data drop column ${q(n)}`); ctx.dropColumn(n); }
        }
        return { rows, columns: dropped };
      },
      toSQL(p, ctx) { return p.emptyRows === false || !ctx ? [] : [`DELETE FROM data WHERE ${ctx.columns.map((c) => this.blank(c.name)).join(' AND ')};`]; },
      toR: (p) => [p.emptyRows === false ? '' : 'df <- df[rowSums(!(is.na(df) | trimws(as.matrix(df)) == "")) > 0, , drop = FALSE]', p.emptyColumns ? 'df <- df[, colSums(!(is.na(df) | trimws(as.matrix(df)) == "")) > 0, drop = FALSE]' : ''].filter(Boolean).join('\n'),
    });

    // ---- new columns from text and dates -------------------------------------------------------------
    define({
      id: 'substring', group: 'structure',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'from', type: 'select', options: ['start', 'end'], default: 'start' }, { name: 'start', type: 'number', default: 1 }, { name: 'length', type: 'number', required: true, default: 2 }, { name: 'name', type: 'text', required: true }],
      expr(p) {
        const c = `cast(${q(p.column)} as text)`; const len = int(p.length, 1, 1e6, 2);
        return p.from === 'end' ? `substr(${c}, -${len})` : `substr(${c}, ${int(p.start, 1, 1e6, 1)}, ${len})`;
      },
      async apply(ctx, p) { return addComputed(ctx, p.name, 'text', this.expr(p)); },
      toSQL(p) { return computedSQL(p, 'text', this.expr(p)); },
      toR: (p) => `df$${q(p.name)} <- ${p.from === 'end' ? `stringr::str_sub(df$${q(p.column)}, -${int(p.length, 1, 1e6, 2)})` : `substr(df$${q(p.column)}, ${int(p.start, 1, 1e6, 1)}, ${int(p.start, 1, 1e6, 1) + int(p.length, 1, 1e6, 2) - 1})`}`,
    });

    const PART_R = { year: 'lubridate::year', quarter: 'lubridate::quarter', month: 'lubridate::month', week: 'lubridate::isoweek', day: 'lubridate::day', dayofyear: 'lubridate::yday', hour: 'lubridate::hour' };
    define({
      id: 'date_part', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: DATES, prefer: /datum|date|dag|tid|time|period/i }, { name: 'part', type: 'select', options: ['year', 'quarter', 'month', 'week', 'weekday', 'day', 'dayofyear', 'yearmonth', 'hour'], default: 'year' }, { name: 'name', type: 'text', required: true }],
      async apply(ctx, p) { return addComputed(ctx, p.name, p.part === 'yearmonth' ? 'text' : 'integer', `dm_date_part(${q(p.column)}, ${lit(p.part)})`); },
      toSQL(p) { return computedSQL(p, p.part === 'yearmonth' ? 'text' : 'integer', `dm_date_part(${q(p.column)}, ${lit(p.part)})`); },
      toR: (p) => {
        const x = `df$${q(p.column)}`;
        const expr = p.part === 'weekday' ? `lubridate::wday(${x}, week_start = 1)` : p.part === 'yearmonth' ? `format(as.Date(${x}), "%Y-%m")` : `${PART_R[p.part] || 'lubridate::year'}(${x})`;
        return `df$${q(p.name)} <- ${expr}`;
      },
    });

    define({
      id: 'date_diff', group: 'calc',
      params: [{ name: 'start', type: 'column', required: true, kinds: DATES, prefer: /start|från|fran|fodd|född|birth/i }, { name: 'end', type: 'column', optional: true, kinds: DATES }, { name: 'unit', type: 'select', options: ['days', 'weeks', 'months', 'years'], default: 'days' }, { name: 'name', type: 'text', required: true }],
      // Without an end column the difference is counted to the day the step runs.
      endExpr: (p) => (p.end ? q(p.end) : "date('now')"),
      async apply(ctx, p) { return addComputed(ctx, p.name, 'integer', `dm_date_diff(${q(p.start)}, ${this.endExpr(p)}, ${lit(p.unit || 'days')})`); },
      toSQL(p) { return computedSQL(p, 'integer', `dm_date_diff(${q(p.start)}, ${this.endExpr(p)}, ${lit(p.unit || 'days')})`); },
      toR: (p) => {
        const a = `as.Date(df$${q(p.start)})`; const b = p.end ? `as.Date(df$${q(p.end)})` : 'Sys.Date()';
        const expr = p.unit === 'months' ? `lubridate::interval(${a}, ${b}) %/% months(1)` : p.unit === 'years' ? `lubridate::interval(${a}, ${b}) %/% lubridate::years(1)`
          : p.unit === 'weeks' ? `trunc(as.numeric(${b} - ${a}) / 7)` : `as.numeric(${b} - ${a})`;
        return `df$${q(p.name)} <- ${expr}`;
      },
    });

    // ---- calculations ---------------------------------------------------------------------------------
    const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10))));
    define({
      id: 'bin_numeric', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: NUMERIC }, { name: 'method', type: 'select', options: ['breaks', 'equal', 'quantiles'], default: 'breaks' }, { name: 'breaks', type: 'text' }, { name: 'count', type: 'number', default: 4 }, { name: 'name', type: 'text', required: true }],
      /** Class limits: the lower limit of each class; the first class also takes smaller values. */
      async limits(ctx, p) {
        if (p.method === 'breaks') {
          // "0, 18, 65", "0; 18; 65" or "0 18 65"; without spaces or semicolons the commas separate ("0,18,65").
          const text = String(p.breaks || '').trim();
          const tokens = /[;\s]/.test(text) ? text.split(/\s*;\s*|,\s+|\s+/) : text.split(',');
          const list = tokens.map((s) => String(s).trim()).filter(Boolean).map((s) => Number(s.replace(',', '.'))).filter((n) => Number.isFinite(n));
          const sorted = Array.from(new Set(list)).sort((a, b) => a - b);
          if (!sorted.length) throw new Error(D.t('op.err.breaks'));
          return sorted;
        }
        const n = int(p.count, 2, 100, 4);
        const r = await ctx.engine.exec(`select min(${q(p.column)}), max(${q(p.column)}) from data`);
        const [min, max] = r[0].values[0].map((v) => (v === null ? NaN : Number(v)));
        if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error(D.t('op.err.numeric'));
        // Equal widths, rounded to two significant digits of the width so that the labels stay readable.
        const step = (max - min) / n || 1;
        const unit = Math.pow(10, Math.floor(Math.log10(step)) - 1);
        const nice = (v) => Number((Math.round(v / unit) * unit).toPrecision(12));
        return Array.from({ length: n }, (_, i) => (i === 0 ? Number((Math.floor(min / unit) * unit).toPrecision(12)) : nice(min + step * i)));
      },
      label(lo, hi, integer) {
        if (hi === undefined) return `${fmt(lo)}–`;
        return integer && Number.isInteger(lo) && Number.isInteger(hi) ? `${fmt(lo)}–${fmt(hi - 1)}` : `${fmt(lo)}–${fmt(hi)}`;
      },
      async expr(ctx, p) {
        const c = q(p.column);
        // Empty values form their own partition, so they do not take places in the groups.
        if (p.method === 'quantiles') return `case when ${c} is null then null else ntile(${int(p.count, 2, 100, 4)}) over (partition by ${c} is null order by ${c}) end`;
        const limits = await this.limits(ctx, p);
        const col = ctx.column(p.column);
        const integer = !!col && col.type === 'integer';
        const parts = [`when ${c} is null then null`, `when ${c} < ${limits[0]} then ${lit('<' + fmt(limits[0]))}`];
        for (let i = limits.length - 1; i >= 0; i--) parts.push(`when ${c} >= ${limits[i]} then ${lit(this.label(limits[i], limits[i + 1], integer))}`);
        return `case ${parts.join(' ')} end`;
      },
      async apply(ctx, p) { return addComputed(ctx, p.name, p.method === 'quantiles' ? 'integer' : 'text', await this.expr(ctx, p)); },
      toSQL(p) { return [`-- ${D.t('code.bin', { column: q(p.column), method: p.method, breaks: p.breaks || '', count: p.count || '' })}`]; },
      toR: (p) => (p.method === 'quantiles' ? `df$${q(p.name)} <- dplyr::ntile(df$${q(p.column)}, ${int(p.count, 2, 100, 4)})`
        : p.method === 'equal' ? `df$${q(p.name)} <- cut(df$${q(p.column)}, breaks = ${int(p.count, 2, 100, 4)}, right = FALSE, include.lowest = TRUE)`
          : `df$${q(p.name)} <- cut(df$${q(p.column)}, breaks = c(-Inf, ${String(p.breaks || '').split(/[;\s,]+/).filter(Boolean).join(', ')}, Inf), right = FALSE)`),
    });

    define({
      id: 'share_of_total', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: NUMERIC }, { name: 'group', type: 'column', optional: true }, { name: 'percent', type: 'switch', default: true }, { name: 'name', type: 'text', required: true }],
      expr(p) { return `${q(p.column)} * ${p.percent === false ? '1.0' : '100.0'} / nullif(sum(${q(p.column)}) over (${partition(p).trim()}), 0)`; },
      async apply(ctx, p) { return addComputed(ctx, p.name, 'number', this.expr(p)); },
      toSQL(p) { return computedSQL(p, 'number', this.expr(p)); },
      toR: (p) => `df <- df${rGroup(p)} |> dplyr::mutate(${q(p.name)} = ${q(p.column)}${p.percent === false ? '' : ' * 100'} / sum(${q(p.column)}, na.rm = TRUE))${rUngroup(p)}`,
    });

    const RANK = { min: 'rank', dense: 'dense_rank', row: 'row_number' };
    define({
      id: 'rank_values', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true }, { name: 'which', type: 'select', options: ['largest', 'smallest'], default: 'largest' }, { name: 'method', type: 'select', options: ['min', 'dense', 'row'], default: 'min' }, { name: 'group', type: 'column', optional: true }, { name: 'name', type: 'text', required: true }],
      expr(p) { return `case when ${q(p.column)} is null then null else ${RANK[p.method] || 'rank'}() over (${partition(p)}order by ${q(p.column)} ${p.which === 'smallest' ? 'asc' : 'desc'} nulls last) end`; },
      async apply(ctx, p) { return addComputed(ctx, p.name, 'integer', this.expr(p)); },
      toSQL(p) { return computedSQL(p, 'integer', this.expr(p)); },
      toR: (p) => {
        const fn = { min: 'dplyr::min_rank', dense: 'dplyr::dense_rank', row: 'dplyr::row_number' }[p.method] || 'dplyr::min_rank';
        return `df <- df${rGroup(p)} |> dplyr::mutate(${q(p.name)} = ${fn}(${p.which === 'smallest' ? q(p.column) : `dplyr::desc(${q(p.column)})`}))${rUngroup(p)}`;
      },
    });

    define({
      id: 'running_total', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: NUMERIC }, { name: 'order', type: 'column', required: true }, { name: 'group', type: 'column', optional: true }, { name: 'name', type: 'text', required: true }],
      expr(p) { return `sum(${q(p.column)}) over (${partition(p)}order by ${q(p.order)}, rowid rows between unbounded preceding and current row)`; },
      async apply(ctx, p) { const c = ctx.column(p.column); return addComputed(ctx, p.name, c ? c.type : 'number', this.expr(p)); },
      toSQL(p) { return computedSQL(p, 'number', this.expr(p)); },
      toR: (p) => `df <- df |> dplyr::arrange(${q(p.order)})${rGroup(p)} |> dplyr::mutate(${q(p.name)} = cumsum(dplyr::coalesce(${q(p.column)}, 0)))${rUngroup(p)}`,
    });

    define({
      id: 'change_previous', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: NUMERIC }, { name: 'order', type: 'column', required: true }, { name: 'group', type: 'column', optional: true }, { name: 'mode', type: 'select', options: ['difference', 'percent'], default: 'difference' }, { name: 'name', type: 'text', required: true }],
      expr(p) {
        const prev = `lag(${q(p.column)}) over (${partition(p)}order by ${q(p.order)}, rowid)`;
        return p.mode === 'percent' ? `(${q(p.column)} - ${prev}) * 100.0 / nullif(${prev}, 0)` : `${q(p.column)} - ${prev}`;
      },
      async apply(ctx, p) { const c = ctx.column(p.column); return addComputed(ctx, p.name, p.mode === 'percent' || !c ? 'number' : c.type, this.expr(p)); },
      toSQL(p) { return computedSQL(p, 'number', this.expr(p)); },
      toR: (p) => `df <- df |> dplyr::arrange(${q(p.order)})${rGroup(p)} |> dplyr::mutate(${q(p.name)} = ${p.mode === 'percent' ? `(${q(p.column)} / dplyr::lag(${q(p.column)}) - 1) * 100` : `${q(p.column)} - dplyr::lag(${q(p.column)})`})${rUngroup(p)}`,
    });

    define({
      id: 'standardize', group: 'calc',
      params: [{ name: 'column', type: 'column', required: true, kinds: NUMERIC }, { name: 'method', type: 'select', options: ['zscore', 'minmax'], default: 'zscore' }, { name: 'name', type: 'text', required: true }],
      async apply(ctx, p) {
        const c = q(p.column);
        const r = (await ctx.engine.exec(`select count(${c}), avg(${c}), sum(${c} * ${c}), min(${c}), max(${c}) from data`))[0].values[0].map(Number);
        const [n, mean, sumSq, min, max] = r;
        if (!n) throw new Error(D.t('op.err.numeric'));
        if (p.method === 'minmax') return addComputed(ctx, p.name, 'number', max === min ? `case when ${c} is null then null else 0.0 end` : `(${c} - ${min}) * 1.0 / ${max - min}`);
        // Sample standard deviation, as R's sd() and scale().
        const sd = n > 1 ? Math.sqrt(Math.max(0, (sumSq - n * mean * mean) / (n - 1))) : 0;
        return addComputed(ctx, p.name, 'number', sd > 0 ? `(${c} - ${mean}) / ${sd}` : `case when ${c} is null then null else 0.0 end`);
      },
      toSQL(p) { return [`-- ${D.t('code.standardize', { column: q(p.column), method: p.method })}`]; },
      toR: (p) => `df$${q(p.name)} <- ${p.method === 'minmax' ? `(df$${q(p.column)} - min(df$${q(p.column)}, na.rm = TRUE)) / diff(range(df$${q(p.column)}, na.rm = TRUE))` : `as.numeric(scale(df$${q(p.column)}))`}`,
    });

    return { cleanName, mapping };
  });
})();
