// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Data-quality profile: per-column statistics and warnings that point at cleaning operations
 * (whitespace, numbers stored as text, dates stored as text, empty strings, mixed case, duplicates).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/profile', ['data/datasets', 'data/operations'], (datasets, ops) => {
    const { q } = ops;

    /** @param {string} id @returns {Promise<{rows: number, duplicates: number, columns: any[]}>} */
    async function profile(id) {
      const handle = await datasets.ensureOpen(id);
      const engine = handle.engine;
      const rows = Number((await engine.exec('select count(*) from data'))[0].values[0][0]);
      const all = handle.columns.map((c) => q(c.name)).join(', ');
      const duplicates = rows ? rows - Number((await engine.exec(`select count(*) from (select distinct ${all} from data)`))[0].values[0][0]) : 0;
      const columns = [];
      for (const col of handle.columns) {
        const c = q(col.name);
        const numeric = col.type === 'integer' || col.type === 'number';
        const base = await engine.exec(numeric
          ? `select count(${c}), count(distinct ${c}), min(${c}), max(${c}), avg(${c}) from data`
          : `select count(${c}), count(distinct ${c}), min(${c}), max(${c}), null from data`);
        const [nonNull, distinct, min, max, mean] = base[0].values[0];
        const entry = { name: col.name, type: col.type, label: col.label, description: col.description || null, unit: col.unit || null, nonNull: Number(nonNull), nulls: rows - Number(nonNull), distinct: Number(distinct), min, max, mean, warnings: [] };
        if (col.type === 'text') {
          const checks = await engine.exec(`select
            sum(case when ${c} != trim(${c}) then 1 else 0 end),
            sum(case when cast(${c} as text) = '' then 1 else 0 end),
            sum(case when dm_parse_number(${c}, NULL) is not null then 1 else 0 end),
            sum(case when dm_parse_date(${c}, NULL) is not null then 1 else 0 end),
            sum(case when ${c} != dm_fix_encoding(${c}) then 1 else 0 end),
            count(distinct dm_lower(${c})),
            sum(case when ${c} regexp '\\s{2,}' then 1 else 0 end),
            sum(case when ${c} regexp '^0[0-9]+$' then 1 else 0 end),
            sum(case when ${c} regexp '^(19|20)?[0-9]{6}[-+]?[0-9]{4}$' then 1 else 0 end)
            from data where ${c} is not null`);
          const [spaces, empties, numbers, dates, mojibake, distinctCi, doubleSpaces, leadingZeros, personalIds] = checks[0].values[0].map((v) => Number(v) || 0);
          // Swedish personal identity numbers (personnummer) in most values: suggest pseudonymisation before sharing.
          if (personalIds && personalIds >= Math.max(1, Math.round((entry.nonNull - empties) * 0.9))) entry.warnings.push({ kind: 'personal_id', count: personalIds, op: 'pseudonymize' });
          if (spaces) entry.warnings.push({ kind: 'whitespace', count: spaces, op: 'trim' });
          if (doubleSpaces) entry.warnings.push({ kind: 'double_spaces', count: doubleSpaces, op: 'trim' });
          if (empties) entry.warnings.push({ kind: 'empty_strings', count: empties, op: 'replace_value' });
          // Codes with leading zeros (kommunkod 0114, personnummer) are identifiers and must stay text.
          if (entry.nonNull && numbers === entry.nonNull - empties && numbers > 0 && !leadingZeros) entry.warnings.push({ kind: 'numbers_as_text', count: numbers, op: 'set_type' });
          if (entry.nonNull && dates === entry.nonNull - empties && dates > 0) entry.warnings.push({ kind: 'dates_as_text', count: dates, op: 'set_type' });
          if (mojibake) entry.warnings.push({ kind: 'encoding', count: mojibake, op: 'fix_encoding' });
          if (distinctCi < entry.distinct) entry.warnings.push({ kind: 'case_variants', count: entry.distinct - distinctCi, op: 'change_case' });
        }
        if (entry.nulls && rows) entry.missingShare = entry.nulls / rows;
        if (entry.nonNull && entry.distinct === entry.nonNull && rows > 1) entry.unique = true;
        if (entry.distinct === 1 && entry.nonNull === rows && rows > 1) entry.warnings.push({ kind: 'constant', count: rows });
        columns.push(entry);
      }
      return { rows, duplicates, columns };
    }

    return { profile };
  });
})();
