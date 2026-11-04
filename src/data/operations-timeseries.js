// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Time series operations for tables such as those from SDMX and PxWeb: understanding periods (2024M03, 2024K1, 2024-Q1,
 * dates), rolling up to a coarser period, change against the previous period or the same period last year, an index with a
 * base period, moving averages, and seasonal adjustment through R. A series is a period column and optional grouping
 * columns. The SQLite functions dm_period, dm_period_date and dm_period_shift live in the engine's worker.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/operations-timeseries', ['data/operations', 'data/types', 'data/code-steps'], (ops, types, codeSteps) => {
    const { define, q, lit } = ops;
    const NUMERIC = ['integer', 'number'];
    const PERIOD = /period|tid|time|datum|date|ar$|^ar|year|manad|månad|kvartal|quarter/i;
    const rstr = (s) => JSON.stringify(String(s));
    const list = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
    const count = async (ctx) => Number((await ctx.engine.exec('select count(*) from data'))[0].values[0][0]);
    const partition = (groups) => (groups.length ? `partition by ${groups.map(q).join(', ')} ` : '');
    const key = (column) => `dm_period(${q(column)}, 'auto')`;
    const rBy = (groups) => (groups.length ? ` |> dplyr::group_by(${groups.map(rstr).map((g) => `dplyr::across(all_of(${g}))`).join(', ')})` : '');
    const rUn = (groups) => (groups.length ? ' |> dplyr::ungroup()' : '');
    const needNew = (ctx, name) => {
      const n = String(name || '').trim();
      if (!n) throw new Error(D.t('op.err.name.empty'));
      if (ctx.column(n)) throw new Error(D.t('op.err.column.exists', { name: n }));
      return n;
    };
    const groupParam = { name: 'groups', type: 'columns' };
    const periodParam = { name: 'period', type: 'column', required: true, prefer: PERIOD };
    const valueParam = { name: 'column', type: 'column', required: true, kinds: NUMERIC };

    /** A new column from a query `select <rid>, <value> <from>`. */
    async function addFrom(ctx, name, type, select, description) {
      await ctx.engine.execMany([
        'drop table if exists temp.__dm_calc', 'create temp table __dm_calc (rid integer primary key, v)',
        `insert into temp.__dm_calc (rid, v) ${select}`,
        `alter table data add column ${q(name)} ${types.sqlType(type)}`,
        `update data set ${q(name)} = (select v from temp.__dm_calc c where c.rid = data.rowid)`,
        'drop table temp.__dm_calc',
      ]);
      ctx.addColumn({ name, type, label: name, description: description || null });
      return { rows: Number((await ctx.engine.exec(`select count(*) from data where ${q(name)} is not null`))[0].values[0][0]) };
    }
    const sqlFrom = (name, type, select) => ['CREATE TEMP TABLE __dm_calc (rid INTEGER PRIMARY KEY, v);', `INSERT INTO temp.__dm_calc (rid, v) ${select};`, `ALTER TABLE data ADD COLUMN ${q(name)} ${types.sqlType(type)};`, `UPDATE data SET ${q(name)} = (SELECT v FROM temp.__dm_calc c WHERE c.rid = data.rowid);`, 'DROP TABLE temp.__dm_calc;'];

    define({
      id: 'ts_period', group: 'timeseries',
      params: [{ name: 'column', type: 'column', required: true, prefer: PERIOD }, { name: 'frequency', type: 'select', required: true, options: ['auto', 'month', 'quarter', 'year'] }, { name: 'name', type: 'text', required: true, default: 'period' }],
      async preview(ctx, p) {
        const res = await ctx.engine.exec(`select count(*), count(dm_period(${q(p.column)}, ${lit(p.frequency || 'auto')})) from data`);
        const sample = await ctx.engine.exec(`select distinct ${q(p.column)}, dm_period(${q(p.column)}, ${lit(p.frequency || 'auto')}) from data limit 5`);
        return { rows: Number(res[0].values[0][1]), sample: sample[0] ? sample[0].values : [], columns: [p.column, p.name || 'period'] };
      },
      async apply(ctx, p) {
        const name = needNew(ctx, p.name);
        const dateName = needNew(ctx, name + '_datum');
        const freq = lit(p.frequency || 'auto');
        const out = await addFrom(ctx, name, 'text', `select rowid, dm_period(${q(p.column)}, ${freq}) from data`);
        await addFrom(ctx, dateName, 'date', `select rowid, dm_period_date(dm_period(${q(p.column)}, ${freq})) from data`);
        return out;
      },
      toSQL: (p) => sqlFrom(p.name, 'text', `SELECT rowid, dm_period(${q(p.column)}, ${lit(p.frequency || 'auto')}) FROM data`).concat(sqlFrom(p.name + '_datum', 'date', `SELECT rowid, dm_period_date(dm_period(${q(p.column)}, ${lit(p.frequency || 'auto')})) FROM data`)),
      toR: (p) => `df[[${rstr(p.name)}]] <- dm_period(df[[${rstr(p.column)}]], ${rstr(p.frequency || 'auto')})\ndf[[${rstr(p.name + '_datum')}]] <- as.Date(dm_period_date(df[[${rstr(p.name)}]]))`,
    });

    define({
      id: 'ts_aggregate', group: 'timeseries',
      params: [periodParam, { name: 'to', type: 'select', required: true, options: ['quarter', 'year', 'month'] }, { name: 'columns', type: 'columns', required: true }, { name: 'how', type: 'select', required: true, options: ['sum', 'mean', 'last', 'min', 'max'] }, groupParam],
      /** The table becomes one row per coarser period and group. */
      async apply(ctx, p) {
        const groups = list(p.groups);
        const values = list(p.columns).filter((c) => { const col = ctx.column(c); return col && NUMERIC.includes(col.type); });
        if (!values.length) throw new Error(D.t('op.ts.err.values'));
        const fn = { sum: 'sum', mean: 'avg', min: 'min', max: 'max' }[p.how];
        const pcol = q(p.period);
        const selects = [`dm_period(${pcol}, ${lit(p.to)}) as ${q(p.period)}`].concat(groups.map(q), values.map((v) => (p.how === 'last' ? `${q(v)} as ${q(v)}` : `${fn}(${q(v)}) as ${q(v)}`)));
        const last = p.how === 'last' ? `, max(${key(p.period)}) as __dm_last` : '';
        const where = `where dm_period(${pcol}, ${lit(p.to)}) is not null`;
        const keep = [p.period].concat(groups, values);
        const by = [`dm_period(${pcol}, ${lit(p.to)})`].concat(groups.map(q)).join(', ');
        await ctx.engine.execMany([
          'drop table if exists __dm_new',
          `create table __dm_new as select ${selects.join(', ')}${last} from data ${where} group by ${by} order by ${by}`,
          'drop table data',
          `create table data (${keep.map((c) => { const col = ctx.column(c); return `${q(c)} ${c === p.period ? 'TEXT' : types.sqlType(col.type === 'integer' && p.how === 'mean' ? 'number' : col.type)}`; }).join(', ')})`,
          `insert into data (${keep.map(q).join(', ')}) select ${keep.map(q).join(', ')} from __dm_new`,
          'drop table __dm_new',
        ]);
        ctx.replaceColumns(keep.map((c) => { const col = ctx.column(c); return Object.assign({}, col, { name: c, type: c === p.period ? 'text' : (col.type === 'integer' && p.how === 'mean' ? 'number' : col.type) }); }));
        return { rows: await count(ctx), columns: keep.length };
      },
      toSQL(p) {
        const groups = list(p.groups); const values = list(p.columns);
        const fn = { sum: 'SUM', mean: 'AVG', min: 'MIN', max: 'MAX', last: 'MAX' }[p.how];
        const by = [`dm_period(${q(p.period)}, ${lit(p.to)})`].concat(groups.map(q)).join(', ');
        return [`CREATE TABLE __dm_new AS SELECT dm_period(${q(p.period)}, ${lit(p.to)}) AS ${q(p.period)}, ${groups.map(q).concat(values.map((v) => `${fn}(${q(v)}) AS ${q(v)}`)).join(', ')} FROM data GROUP BY ${by};`, 'DROP TABLE data;', 'ALTER TABLE __dm_new RENAME TO data;'];
      },
      toR(p) {
        const groups = list(p.groups); const values = list(p.columns);
        const fn = { sum: 'sum(.x, na.rm = TRUE)', mean: 'mean(.x, na.rm = TRUE)', min: 'min(.x, na.rm = TRUE)', max: 'max(.x, na.rm = TRUE)', last: 'dplyr::last(.x)' }[p.how];
        return `df[[${rstr(p.period)}]] <- dm_period(df[[${rstr(p.period)}]], ${rstr(p.to)})\ndf <- df |> dplyr::group_by(dplyr::across(all_of(c(${[p.period].concat(groups).map(rstr).join(', ')})))) |> dplyr::summarise(dplyr::across(all_of(c(${values.map(rstr).join(', ')})), ~ ${fn}), .groups = "drop")`;
      },
    });

    define({
      id: 'ts_change', group: 'timeseries',
      params: [valueParam, periodParam, groupParam, { name: 'compare', type: 'select', required: true, options: ['previous', 'year'] }, { name: 'mode', type: 'select', required: true, options: ['percent', 'absolute'] }, { name: 'name', type: 'text', required: true, default: 'forandring' }],
      /** The value it is compared with: the row before, or the same period a year earlier. */
      select(p) {
        const groups = list(p.groups);
        const change = (now, then) => (p.mode === 'absolute' ? `${now} - ${then}` : `(${now} - ${then}) * 100.0 / nullif(${then}, 0)`);
        if (p.compare === 'year') {
          const same = groups.map((g) => `a.${q(g)} is b.${q(g)}`).concat([`dm_period_shift(dm_period(a.${q(p.period)}, 'auto'), -1) = dm_period(b.${q(p.period)}, 'auto')`]).join(' and ');
          return `select a.rowid, ${change(`a.${q(p.column)}`, `b.${q(p.column)}`)} from data a left join data b on ${same}`;
        }
        return `select rowid, ${change(q(p.column), `lag(${q(p.column)}) over (${partition(groups)}order by ${key(p.period)}, rowid)`)} from data`;
      },
      async apply(ctx, p) { const name = needNew(ctx, p.name); return addFrom(ctx, name, 'number', this.select(p)); },
      toSQL(p) { return sqlFrom(p.name, 'number', this.select(p)); },
      toR(p) {
        const groups = list(p.groups);
        const k = p.compare === 'year' ? 'dm_periods_per_year(df[[' + rstr(p.period) + ']])' : '1';
        const prev = `dplyr::lag(.data[[${rstr(p.column)}]], ${k})`;
        return `df <- df |> dplyr::arrange(.data[[${rstr(p.period)}]])${rBy(groups)} |> dplyr::mutate(${q(p.name)} = ${p.mode === 'absolute' ? `.data[[${rstr(p.column)}]] - ${prev}` : `(.data[[${rstr(p.column)}]] - ${prev}) * 100 / ${prev}`})${rUn(groups)}`;
      },
    });

    define({
      id: 'ts_index', group: 'timeseries',
      params: [valueParam, periodParam, groupParam, { name: 'base', type: 'text', required: true }, { name: 'name', type: 'text', required: true, default: 'index' }],
      /** Every value against the mean of the base period (a year as base takes the mean of its months or quarters). */
      select(p) {
        const groups = list(p.groups);
        const base = `(select avg(b.${q(p.column)}) from data b where ${groups.map((g) => `b.${q(g)} is a.${q(g)}`).concat([`dm_period(b.${q(p.period)}, 'auto') like ${lit(String(p.base).trim() + '%')}`]).join(' and ')})`;
        return `select a.rowid, a.${q(p.column)} * 100.0 / nullif(${base}, 0) from data a`;
      },
      async apply(ctx, p) {
        const name = needNew(ctx, p.name);
        const base = String(p.base || '').trim();
        if (!base) throw new Error(D.t('op.ts.err.base'));
        const found = await ctx.engine.exec(`select count(*) from data where dm_period(${q(p.period)}, 'auto') like ${lit(base + '%')}`);
        if (!Number(found[0].values[0][0])) throw new Error(D.t('op.ts.err.base.missing', { base }));
        return addFrom(ctx, name, 'number', this.select(p), D.t('op.ts.index.description', { base }));
      },
      toSQL(p) { return sqlFrom(p.name, 'number', this.select(p)); },
      toR(p) {
        const groups = list(p.groups);
        return `df <- df${rBy(groups)} |> dplyr::mutate(${q(p.name)} = .data[[${rstr(p.column)}]] * 100 / mean(.data[[${rstr(p.column)}]][startsWith(as.character(dm_period(.data[[${rstr(p.period)}]])), ${rstr(String(p.base).trim())})], na.rm = TRUE))${rUn(groups)}`;
      },
    });

    define({
      id: 'ts_moving', group: 'timeseries',
      params: [valueParam, periodParam, groupParam, { name: 'window', type: 'number', required: true, default: 3 }, { name: 'centered', type: 'switch' }, { name: 'name', type: 'text', required: true, default: 'glidande' }],
      /** Only full windows give a value, so the first ones stay empty instead of misleading. */
      select(p) {
        const groups = list(p.groups);
        const w = Math.max(2, Math.trunc(Number(p.window) || 3));
        const before = p.centered ? Math.floor((w - 1) / 2) : w - 1;
        const after = p.centered ? w - 1 - before : 0;
        const frame = `over (${partition(groups)}order by ${key(p.period)}, rowid rows between ${before} preceding and ${after} following)`;
        return `select rowid, case when count(${q(p.column)}) ${frame} = ${w} then avg(${q(p.column)}) ${frame} end from data`;
      },
      async apply(ctx, p) { const name = needNew(ctx, p.name); return addFrom(ctx, name, 'number', this.select(p)); },
      toSQL(p) { return sqlFrom(p.name, 'number', this.select(p)); },
      toR(p) {
        const groups = list(p.groups);
        const w = Math.max(2, Math.trunc(Number(p.window) || 3));
        return `df <- df |> dplyr::arrange(.data[[${rstr(p.period)}]])${rBy(groups)} |> dplyr::mutate(${q(p.name)} = as.numeric(stats::filter(.data[[${rstr(p.column)}]], rep(1 / ${w}, ${w}), sides = ${p.centered ? 2 : 1})))${rUn(groups)}`;
      },
    });

    /** The R function that decomposes every series with stl and adds trend, seasonal and adjusted columns. */
    function seasonalCode(p) {
      const groups = list(p.groups);
      const f = Number(p.frequency) === 4 ? 4 : 12;
      const name = String(p.name || 'rensad');
      return [
        'function(df) {',
        `  df <- df[order(df[[${rstr(p.period)}]]), ]`,
        `  df[[${rstr(name + '_trend')}]] <- NA_real_`,
        `  df[[${rstr(name + '_sasong')}]] <- NA_real_`,
        `  df[[${rstr(name)}]] <- NA_real_`,
        `  grupper <- ${groups.length ? `interaction(df[c(${groups.map(rstr).join(', ')})], drop = TRUE)` : 'rep(1, nrow(df))'}`,
        '  for (g in unique(grupper)) {',
        '    rader <- which(grupper == g)',
        `    x <- df[[${rstr(p.column)}]][rader]`,
        `    if (length(x) < 2 * ${f} || anyNA(x)) next`,
        `    s <- stl(ts(x, frequency = ${f}), s.window = "periodic")$time.series`,
        `    df[[${rstr(name + '_trend')}]][rader] <- as.numeric(s[, "trend"])`,
        `    df[[${rstr(name + '_sasong')}]][rader] <- as.numeric(s[, "seasonal"])`,
        `    df[[${rstr(name)}]][rader] <- x - as.numeric(s[, "seasonal"])`,
        '  }',
        '  df',
        '}',
      ].join('\n');
    }
    define({
      id: 'ts_seasonal', group: 'timeseries', manualPreview: true,
      params: [valueParam, periodParam, groupParam, { name: 'frequency', type: 'select', required: true, options: ['12', '4'] }, { name: 'name', type: 'text', required: true, default: 'rensad' }],
      /** The work happens in R, before the operation's savepoint, as for other code steps. */
      async prepare(ctx, p) {
        for (const suffix of ['', '_trend', '_sasong']) needNew(ctx, String(p.name || 'rensad') + suffix);
        ctx._codeStep = await codeSteps.runCode('r', ctx, seasonalCode(p), {});
      },
      async apply(ctx) {
        const result = ctx._codeStep;
        ctx._codeStep = null;
        if (!result) throw new Error(D.t('op.err.step.noresult'));
        await codeSteps.replaceTable(ctx, result);
        return { rows: result.rowCount, columns: result.columns.length };
      },
      async preview(ctx, p) {
        const result = await codeSteps.runCode('r', ctx, seasonalCode(p), { limit: codeSteps.PREVIEW_ROWS });
        result.tmp.terminate();
        return { rows: result.rowCount, columns: result.columns.map((c) => c.name), sample: result.sample, log: result.log };
      },
      toSQL: (p) => ['-- ' + D.t('code.step.sql.note', { lang: 'R' })].concat(seasonalCode(p).split('\n').map((l) => '-- ' + l)),
      toR: (p) => `df <- (${seasonalCode(p)})(df)`,
    });

    return { seasonalCode };
  });
})();
