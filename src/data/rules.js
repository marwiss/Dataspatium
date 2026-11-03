// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Validation rules ("förväntningar") per dataset: not null, unique, range, allowed values, pattern, length
 * and free SQL conditions. Rules are stored in the dataset's metadata (`_meta.rules`), so they travel with
 * the SQLite file, bundles and backups. Running them counts the rows that break each rule, keeps a few
 * examples, logs a `validate` entry and can turn the failing rows into a new dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/rules', ['data/datasets', 'data/profile'], (datasets, profile) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const TYPES = ['notnull', 'unique', 'range', 'inset', 'regex', 'length', 'sql'];
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

    /** SQL condition (with params) that is true for the rows that BREAK the rule. */
    function violation(rule, columns) {
      const col = rule.column ? q(rule.column) : null;
      switch (rule.type) {
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
        default: throw new Error('Okänd regeltyp: ' + rule.type);
      }
    }

    /** Human-readable rule text (Swedish, used in dialogs, logs and reports). */
    function describe(rule) {
      const cols = (rule.columns && rule.columns.length ? rule.columns : [rule.column]).join(' + ');
      switch (rule.type) {
        case 'notnull': return `${rule.column} får inte saknas`;
        case 'unique': return `${cols} ska vara unik`;
        case 'range': return `${rule.column} mellan ${rule.min === undefined || rule.min === '' ? '…' : rule.min} och ${rule.max === undefined || rule.max === '' ? '…' : rule.max}`;
        case 'inset': return `${rule.column} finns i listan (${splitValues(rule.values).length} värden)`;
        case 'regex': return `${rule.column} matchar mönstret ${rule.pattern}`;
        case 'length': return `${rule.column} har ${rule.min === undefined || rule.min === '' ? '…' : rule.min} till ${rule.max === undefined || rule.max === '' ? '…' : rule.max} tecken`;
        case 'sql': return `Villkor: ${rule.expression}`;
        default: return String(rule.type);
      }
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
          const v = violation(rule, handle.columns);
          const failures = Number((await handle.engine.exec(`select count(*) from data where ${v.sql}`, v.params))[0].values[0][0]);
          const sampleColumns = rule.columns && rule.columns.length ? rule.columns : (rule.column ? [rule.column] : handle.columns.slice(0, 3).map((c) => c.name));
          const res = failures ? await handle.engine.exec(`select ${sampleColumns.map(q).join(', ')} from data where ${v.sql} limit 5`, v.params) : [];
          results.push({ rule, failures, total, share: total ? failures / total : 0, sample: res[0] ? res[0].values : [], sampleColumns, ok: failures === 0 });
        } catch (err) { results.push({ rule, failures: null, total, share: 0, sample: [], sampleColumns: [], ok: false, error: (err && err.message) || String(err) }); }
      }
      const summary = { rules: all.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, ran: new Date().toISOString() };
      if (all.length) await datasets.appendLog(handle, 'validate', { summary, results: results.map((r) => ({ rule: r.rule.id, text: describe(r.rule), failures: r.failures, ok: r.ok })) });
      return { results, summary, total };
    }

    /** New dataset with the rows that break a rule. */
    async function failingRows(id, rule, name) {
      const handle = await datasets.ensureOpen(id);
      const v = violation(rule, handle.columns);
      return datasets.createFromQuery(id, `select * from data where ${v.sql}`, { params: v.params, name: name || `${handle.meta.name}: bryter mot ${describe(rule)}`, description: `Rader i ${handle.meta.name} som bryter mot regeln "${describe(rule)}".`, source: { kind: 'derived', op: 'rules', parent: id, rule: describe(rule) } });
    }

    /** Suggested rules from the profile: non-null and unique columns, fixed-width codes. */
    async function suggest(id) {
      const prof = await profile.profile(id);
      const out = [];
      for (const c of prof.columns) {
        if (prof.rows > 0 && c.nulls === 0) out.push({ type: 'notnull', column: c.name });
        if (c.unique && prof.rows > 1) out.push({ type: 'unique', columns: [c.name] });
        if (c.type === 'text' && /kod|code|nummer|nr$/i.test(c.name) && typeof c.min === 'string' && /^\d+$/.test(c.min) && typeof c.max === 'string' && c.max.length === c.min.length) out.push({ type: 'regex', column: c.name, pattern: `^\\d{${c.min.length}}$` });
      }
      return out;
    }

    /** Markdown report of a run (the caller renders it with the document builders). */
    function toMarkdown(result, meta) {
      const name = meta && meta.name ? meta.name : 'Datamängd';
      const lines = [`# Datakvalitetsrapport: ${name}`, '', `${result.total} rader, ${result.summary.rules} regler, ${result.summary.passed} uppfyllda, ${result.summary.failed} brutna. Körd ${result.summary.ran.slice(0, 16).replace('T', ' ')}.`, '', '| Regel | Resultat | Antal | Andel |', '|---|---|---|---|'];
      const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/\|/g, '\\|');
      for (const r of result.results) lines.push(`| ${esc(describe(r.rule))} | ${r.error ? 'Fel: ' + esc(r.error) : r.ok ? 'OK' : 'Bryts'} | ${r.failures === null ? '' : r.failures} | ${r.failures ? (100 * r.share).toFixed(1) + ' %' : ''} |`);
      for (const r of result.results) {
        if (!r.sample || !r.sample.length) continue;
        lines.push('', `## Exempel: ${describe(r.rule)}`, '', `| ${r.sampleColumns.map(esc).join(' | ')} |`, `|${r.sampleColumns.map(() => '---').join('|')}|`);
        for (const row of r.sample) lines.push(`| ${row.map(esc).join(' | ')} |`);
      }
      return lines.join('\n') + '\n';
    }

    return { TYPES, list, save, add, remove, run, suggest, failingRows, describe, toMarkdown, violation };
  });
})();
