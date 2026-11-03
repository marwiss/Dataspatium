// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Validation rules ("förväntningar") per dataset: not null, unique, range, allowed and forbidden values,
 * patterns and ready-made formats, length, surplus whitespace, values that can be read as a type, Nordic
 * identity numbers, comparisons between columns, values found in another dataset, completeness, outliers
 * and free SQL conditions. Rules are stored in the dataset's metadata (`_meta.rules`), so they travel with
 * the SQLite file, bundles and backups. Running them counts the rows that break each rule, keeps a few
 * examples, logs a `validate` entry and can turn the failing rows into a new dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/rules', ['data/datasets', 'data/profile'], (datasets, profile) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const TYPES = ['notnull', 'unique', 'range', 'inset', 'not_in', 'regex', 'format', 'length', 'whitespace', 'parsable', 'identifier', 'compare', 'reference', 'completeness', 'outliers', 'sql'];
    /** Ready-made patterns for the format rule (JavaScript regular expressions, as in the regex rule). */
    const FORMATS = {
      email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      url: '^https?://[^\\s/$.?#][^\\s]*$',
      iso_date: '^\\d{4}-\\d{2}-\\d{2}$',
      se_postnr: '^\\d{3} ?\\d{2}$',
      se_kommunkod: '^\\d{4}$',
      se_lanskod: '^\\d{2}$',
      postnr4: '^\\d{4}$',
      fi_postnr: '^\\d{5}$',
      is_postnr: '^\\d{3}$',
    };
    /** Identity numbers checked by dm_valid_id() in the SQLite engine. */
    const ID_KINDS = ['se_pnr', 'se_orgnr', 'no_fnr', 'dk_cpr', 'fi_hetu', 'is_kt'];
    const OPERATORS = { lt: '<', le: '<=', eq: '=', ne: '!=', ge: '>=', gt: '>' };
    const PARSERS = { number: 'dm_parse_number(%s, NULL)', integer: 'dm_parse_number(%s, NULL)', date: 'dm_parse_date(%s, NULL)', datetime: 'dm_parse_datetime(%s, NULL)', boolean: 'dm_parse_bool(%s)' };
    const newId = () => 'rule_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const splitValues = (text) => String(text || '').split(/[\n;,]/).map((s) => s.trim()).filter(Boolean);
    const isNumeric = (columns, name) => { const c = (columns || []).find((x) => x.name === name); return !!c && (c.type === 'integer' || c.type === 'number'); };
    const bound = (v, numeric) => { if (!numeric) return String(v); const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : String(v); };

    async function list(id) { const meta = await datasets.get(id); return Array.isArray(meta && meta.rules) ? meta.rules : []; }
    async function save(id, rules) { await datasets.updateMeta(id, { rules }); return rules; }
    async function add(id, rule) {
      const rules = await list(id);
      const record = Object.assign({ id: newId() }, rule);
      rules.push(record);
      await save(id, rules);
      return record;
    }
    async function remove(id, ruleId) { const rules = (await list(id)).filter((r) => r.id !== ruleId); await save(id, rules); return rules; }

    /**
     * SQL condition (with params) that is true for the rows that BREAK the rule. `prepared` carries what
     * prepare() worked out from the data: the lookup table of a reference rule, the limits of an outlier rule.
     */
    function violation(rule, columns, prepared = {}) {
      const col = rule.column ? q(rule.column) : null;
      const filled = `${col} is not null and cast(${col} as text) != ''`;
      switch (rule.type) {
        case 'not_in': { const values = splitValues(rule.values); return { sql: `(${col} is not null and cast(${col} as text) in (${values.map(() => '?').join(', ') || "''"}))`, params: values }; }
        case 'format': return { sql: `(${filled} and not (cast(${col} as text) regexp ?))`, params: [FORMATS[rule.format] || FORMATS.email] };
        case 'whitespace': return { sql: `(${col} is not null and cast(${col} as text) != dm_squish(cast(${col} as text)))`, params: [] };
        case 'parsable': {
          const parse = (PARSERS[rule.target] || PARSERS.number).replace('%s', col);
          const integer = rule.target === 'integer' ? ` or ${parse} != round(${parse})` : '';
          return { sql: `(${filled} and (${parse} is null${integer}))`, params: [] };
        }
        case 'identifier': return { sql: `(${filled} and dm_valid_id(${col}, ?) = 0)`, params: [ID_KINDS.includes(rule.kind) ? rule.kind : 'se_pnr'] };
        case 'compare': return { sql: `(${col} is not null and ${q(rule.column2)} is not null and not (${col} ${OPERATORS[rule.operator] || '<='} ${q(rule.column2)}))`, params: [] };
        case 'reference': return { sql: `(${filled} and cast(${col} as text) not in (select v from temp.${prepared.table}))`, params: [] };
        case 'completeness': return { sql: `(${col} is null or cast(${col} as text) = '')`, params: [] };
        case 'outliers': return { sql: `(${col} is not null and (${col} < ? or ${col} > ?))`, params: [prepared.low, prepared.high] };
        case 'notnull': return { sql: `(${col} is null or cast(${col} as text) = '')`, params: [] };
        case 'unique': {
          const cols = (rule.columns && rule.columns.length ? rule.columns : [rule.column]).map(q);
          return { sql: `(${cols.join(', ')}) in (select ${cols.join(', ')} from data group by ${cols.join(', ')} having count(*) > 1)`, params: [] };
        }
        case 'range': {
          const numeric = isNumeric(columns, rule.column);
          const parts = []; const params = [];
          if (rule.min !== undefined && rule.min !== null && rule.min !== '') { parts.push(`${col} < ?`); params.push(bound(rule.min, numeric)); }
          if (rule.max !== undefined && rule.max !== null && rule.max !== '') { parts.push(`${col} > ?`); params.push(bound(rule.max, numeric)); }
          return { sql: `(${col} is not null and (${parts.join(' or ') || '0'}))`, params };
        }
        case 'inset': { const values = splitValues(rule.values); return { sql: `(${col} is not null and cast(${col} as text) not in (${values.map(() => '?').join(', ') || "''"}))`, params: values }; }
        case 'regex': return { sql: `(${col} is not null and not (cast(${col} as text) regexp ?))`, params: [String(rule.pattern || '')] };
        case 'length': {
          const parts = []; const params = [];
          if (rule.min !== undefined && rule.min !== '' && rule.min !== null) { parts.push(`length(cast(${col} as text)) < ?`); params.push(Number(rule.min) || 0); }
          if (rule.max !== undefined && rule.max !== '' && rule.max !== null) { parts.push(`length(cast(${col} as text)) > ?`); params.push(Number(rule.max) || 0); }
          return { sql: `(${col} is not null and (${parts.join(' or ') || '0'}))`, params };
        }
        case 'sql': return { sql: `not (${rule.expression || '1'})`, params: [] };
        default: throw new Error(D.t('rules.err.type', { type: rule.type }));
      }
    }

    /** Human-readable rule text in the UI language (dialogs, logs and reports). */
    function describe(rule) {
      const cols = (rule.columns && rule.columns.length ? rule.columns : [rule.column]).join(' + ');
      const bound = (v) => (v === undefined || v === '' ? '…' : v);
      switch (rule.type) {
        case 'notnull': return D.t('rules.describe.notnull', { column: rule.column });
        case 'unique': return D.t('rules.describe.unique', { cols });
        case 'range': return D.t('rules.describe.range', { column: rule.column, min: bound(rule.min), max: bound(rule.max) });
        case 'inset': return D.t('rules.describe.inset', { column: rule.column, n: splitValues(rule.values).length });
        case 'regex': return D.t('rules.describe.regex', { column: rule.column, pattern: rule.pattern });
        case 'length': return D.t('rules.describe.length', { column: rule.column, min: bound(rule.min), max: bound(rule.max) });
        case 'sql': return D.t('rules.describe.sql', { expression: rule.expression });
        case 'not_in': return D.t('rules.describe.not_in', { column: rule.column, n: splitValues(rule.values).length });
        case 'format': return D.t('rules.describe.format', { column: rule.column, format: D.t('rules.format.' + (rule.format || 'email')) });
        case 'whitespace': return D.t('rules.describe.whitespace', { column: rule.column });
        case 'parsable': return D.t('rules.describe.parsable', { column: rule.column, target: D.t('type.' + (rule.target || 'number')) });
        case 'identifier': return D.t('rules.describe.identifier', { column: rule.column, kind: D.t('rules.id.' + (rule.kind || 'se_pnr')) });
        case 'compare': return D.t('rules.describe.compare', { column: rule.column, op: (OPERATORS[rule.operator] || '<=').replace('<=', '≤').replace('>=', '≥').replace('!=', '≠'), column2: rule.column2 });
        case 'reference': return D.t('rules.describe.reference', { column: rule.column, dataset: rule.datasetName || '', refColumn: rule.refColumn });
        case 'completeness': return D.t('rules.describe.completeness', { column: rule.column, share: Number(rule.minShare) || 0 });
        case 'outliers': return D.t(rule.method === 'iqr' ? 'rules.describe.outliers.iqr' : 'rules.describe.outliers.sd', { column: rule.column, factor: Number(rule.factor) || (rule.method === 'iqr' ? 1.5 : 3) });
        default: return String(rule.type);
      }
    }

    /**
     * What a rule needs from the data before it can be checked: a reference rule copies the other dataset's
     * values into a temporary table, an outlier rule computes its limits (mean ± k standard deviations, or
     * the quartiles ± k interquartile ranges).
     */
    async function prepare(rule, handle) {
      if (rule.type === 'reference') {
        const other = await datasets.ensureOpen(rule.dataset);
        if (!other.columns.some((c) => c.name === rule.refColumn)) throw new Error(D.t('op.err.unknown.column', { name: rule.refColumn }));
        const res = await other.engine.exec(`select distinct cast(${q(rule.refColumn)} as text) from data where ${q(rule.refColumn)} is not null`);
        const table = '__dm_ref_' + String(rule.id || 'x').replace(/[^A-Za-z0-9_]/g, '');
        await handle.engine.execMany([`drop table if exists temp.${table}`, `create temp table ${table} (v text primary key)`]);
        const values = res[0] ? res[0].values.map((r) => r[0]) : [];
        for (let i = 0; i < values.length; i += 400) {
          const chunk = values.slice(i, i + 400);
          await handle.engine.run(`insert or ignore into temp.${table} (v) values ${chunk.map(() => '(?)').join(', ')}`, chunk);
        }
        return { table };
      }
      if (rule.type === 'outliers') {
        const c = q(rule.column);
        const [n, mean, sumSq] = (await handle.engine.exec(`select count(${c}), avg(${c}), sum(${c} * ${c}) from data`))[0].values[0].map(Number);
        if (!n) return { low: -Infinity, high: Infinity };
        if (rule.method === 'iqr') {
          const k = Number(rule.factor) || 1.5;
          const at = async (p) => { const r = await handle.engine.exec(`select ${c} from data where ${c} is not null order by ${c} limit 1 offset ${Math.floor((n - 1) * p)}`); return Number(r[0].values[0][0]); };
          const q1 = await at(0.25); const q3 = await at(0.75);
          return { low: q1 - k * (q3 - q1), high: q3 + k * (q3 - q1) };
        }
        const k = Number(rule.factor) || 3;
        const sd = n > 1 ? Math.sqrt(Math.max(0, (sumSq - n * mean * mean) / (n - 1))) : 0;
        return { low: mean - k * sd, high: mean + k * sd };
      }
      return {};
    }
    /** Whether a rule passes: no breaking rows, except completeness, which allows a share of empty values. */
    function passes(rule, failures, total) {
      if (rule.type === 'completeness') return !total || ((total - failures) / total) * 100 >= (Number(rule.minShare) || 0);
      return failures === 0;
    }

    /**
     * Run rules (the stored ones by default) against the dataset.
     * @returns {Promise<{results: any[], summary: {rules: number, passed: number, failed: number, ran: string}, total: number}>}
     */
    async function run(id, rules) {
      const handle = await datasets.ensureOpen(id);
      const all = rules || (await list(id));
      const total = Number((await handle.engine.exec('select count(*) from data'))[0].values[0][0]);
      const results = [];
      for (const rule of all) {
        try {
          const v = violation(rule, handle.columns, await prepare(rule, handle));
          const failures = Number((await handle.engine.exec(`select count(*) from data where ${v.sql}`, v.params))[0].values[0][0]);
          const sampleColumns = rule.columns && rule.columns.length ? rule.columns : (rule.column ? [rule.column].concat(rule.type === 'compare' && rule.column2 ? [rule.column2] : []) : handle.columns.slice(0, 3).map((c) => c.name));
          const res = failures ? await handle.engine.exec(`select ${sampleColumns.map(q).join(', ')} from data where ${v.sql} limit 5`, v.params) : [];
          results.push({ rule, failures, total, share: total ? failures / total : 0, sample: res[0] ? res[0].values : [], sampleColumns, ok: passes(rule, failures, total) });
        } catch (err) { results.push({ rule, failures: null, total, share: 0, sample: [], sampleColumns: [], ok: false, error: (err && err.message) || String(err) }); }
      }
      const summary = { rules: all.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, ran: new Date().toISOString() };
      if (all.length) await datasets.appendLog(handle, 'validate', { summary, results: results.map((r) => ({ rule: r.rule.id, text: describe(r.rule), failures: r.failures, ok: r.ok })) });
      return { results, summary, total };
    }

    /** New dataset with the rows that break a rule. */
    async function failingRows(id, rule, name) {
      const handle = await datasets.ensureOpen(id);
      const v = violation(rule, handle.columns, await prepare(rule, handle));
      return datasets.createFromQuery(id, `select * from data where ${v.sql}`, { params: v.params, name: name || D.t('rules.failing.name', { name: handle.meta.name, rule: describe(rule) }), description: D.t('rules.failing.description', { name: handle.meta.name, rule: describe(rule) }), source: { kind: 'derived', op: 'rules', parent: id, rule: describe(rule) } });
    }

    /** Column names that hint at an identity number, and the kind a name points to when it is specific. */
    const ID_NAME = /personnummer|personnr|samordningsnummer|^pnr$|organisationsnummer|orgnr|org_nr|cpr|f(ø|o|oe)dselsnummer|^fnr$|henkil(ö|o)tunnus|^hetu$|kennitala|^kt$/i;
    const ID_HINTS = [[/organisationsnummer|orgnr|org_nr/i, 'se_orgnr'], [/cpr/i, 'dk_cpr'], [/f(ø|o|oe)dselsnummer|^fnr$/i, 'no_fnr'], [/henkil(ö|o)tunnus|^hetu$/i, 'fi_hetu'], [/kennitala|^kt$/i, 'is_kt']];
    /** Kinds from the strictest check to the loosest, to break ties (a valid kennitala is also a valid CPR date). */
    const ID_STRICT = ['is_kt', 'no_fnr', 'fi_hetu', 'se_pnr', 'se_orgnr', 'dk_cpr'];
    /** Postcode formats a "postnummer" column may follow. */
    const POSTCODES = ['se_postnr', 'postnr4', 'fi_postnr', 'is_postnr'];

    /** Number of sampled non-empty values and how many pass each SQL test. */
    async function sampleHits(id, column, tests) {
      const handle = await datasets.ensureOpen(id);
      const sample = `(select ${q(column)} as v from data where ${q(column)} is not null limit 500)`;
      const res = await handle.engine.exec(`select count(*), ${tests.map((t) => `coalesce(sum(${t.sql}), 0)`).join(', ')} from ${sample}`, tests.flatMap((t) => t.params || []));
      const row = res[0] ? res[0].values[0].map(Number) : [0];
      return { total: row[0], hits: tests.map((t, i) => row[i + 1]) };
    }
    /** The identity number kind that at least half of a column's values pass, or null. */
    async function likelyIdKind(id, column) {
      const { total, hits } = await sampleHits(id, column, ID_KINDS.map((k) => ({ sql: `dm_valid_id(v, '${k}')` })));
      const passing = ID_KINDS.filter((k, i) => total > 0 && hits[i] >= total / 2);
      const hint = ID_HINTS.find(([re, k]) => re.test(column) && passing.includes(k));
      if (hint) return hint[1];
      const count = (k) => hits[ID_KINDS.indexOf(k)];
      passing.sort((a, b) => count(b) - count(a) || ID_STRICT.indexOf(a) - ID_STRICT.indexOf(b));
      return passing[0] || null;
    }
    /** The postcode format that most of a column's values follow, or null. */
    async function likelyPostcode(id, column) {
      const { total, hits } = await sampleHits(id, column, POSTCODES.map((f) => ({ sql: '(cast(v as text) regexp ?)', params: [FORMATS[f]] })));
      let best = null; let most = 0;
      POSTCODES.forEach((f, i) => { if (hits[i] > most) { best = f; most = hits[i]; } });
      return best && most >= total / 2 ? best : null;
    }

    /** Suggested rules from the profile: non-null and unique columns, fixed-width codes. */
    async function suggest(id) {
      const prof = await profile.profile(id);
      const out = [];
      for (const c of prof.columns) {
        if (prof.rows > 0 && c.nulls === 0) out.push({ type: 'notnull', column: c.name });
        if (c.unique && prof.rows > 1) out.push({ type: 'unique', columns: [c.name] });
        if (c.type === 'text' && /kod|code|nummer|nr$/i.test(c.name) && typeof c.min === 'string' && /^\d+$/.test(c.min) && typeof c.max === 'string' && c.max.length === c.min.length) out.push({ type: 'regex', column: c.name, pattern: `^\\d{${c.min.length}}$` });
        // Identity numbers recognised by the column name, of the kind most values pass; e-mail addresses and
        // postcodes by the column name.
        if (c.type === 'text' && ID_NAME.test(c.name)) {
          const kind = await likelyIdKind(id, c.name);
          if (kind) out.push({ type: 'identifier', column: c.name, kind });
        }
        if (c.type === 'text' && /e-?post|e-?mail|mejl|s(ä|a)hk(ö|o)posti|netfang/i.test(c.name)) out.push({ type: 'format', column: c.name, format: 'email' });
        if (/postnummer|postnr|postkod|postinumero|póstnúmer/i.test(c.name)) {
          const format = await likelyPostcode(id, c.name);
          if (format) out.push({ type: 'format', column: c.name, format });
        }
      }
      return out;
    }

    /** Markdown report of a run (the caller renders it with the document builders). */
    function toMarkdown(result, meta) {
      const name = meta && meta.name ? meta.name : D.t('datasets.default.name');
      const lines = [D.t('rules.report.title', { name }), '', D.t('rules.report.summary', { total: result.total, rules: result.summary.rules, passed: result.summary.passed, failed: result.summary.failed, ran: result.summary.ran.slice(0, 16).replace('T', ' ') }), '', D.t('rules.report.header'), '|---|---|---|---|'];
      const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/\|/g, '\\|');
      for (const r of result.results) lines.push(`| ${esc(describe(r.rule))} | ${r.error ? esc(D.t('rules.report.error', { error: r.error })) : r.ok ? 'OK' : D.t('rules.broken')} | ${r.failures === null ? '' : r.failures} | ${r.failures ? (100 * r.share).toFixed(1) + ' %' : ''} |`);
      for (const r of result.results) {
        if (!r.sample || !r.sample.length) continue;
        lines.push('', D.t('rules.report.sample', { rule: describe(r.rule) }), '', `| ${r.sampleColumns.map(esc).join(' | ')} |`, `|${r.sampleColumns.map(() => '---').join('|')}|`);
        for (const row of r.sample) lines.push(`| ${row.map(esc).join(' | ')} |`);
      }
      return lines.join('\n') + '\n';
    }

    return { TYPES, FORMATS, ID_KINDS, OPERATORS, list, save, add, remove, run, suggest, failingRows, describe, toMarkdown, violation, prepare };
  });
})();
