// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The checks of an IFC model and their latest results, for the card Validera modellen in Hantera. Two kinds of check:
 * the server's, which Dataregium (from 3.0.0) makes of every IFC file uploaded as a document version and reports in the
 * version's metadata (`ifc_validation_*`) with a report of every error; and the checks run here with IfcOpenShell
 * (validation against the schema, and IDS). The latest result of each is kept as a setting per dataset
 * (`validation:<id>`), so that showing or recording one never changes the dataset itself.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/ifc-validation', ['platform/storage/idb'], (idb) => {
    const PREFIX = 'validation:';
    /** `warnings`: every finding is a warning, which buildingSMART's validation service holds valid; `issues`: one or more errors. */
    const STATUSES = ['pending', 'passed', 'warnings', 'issues', 'unknown'];
    /**
     * What found an issue, in the report's words: parts of the IFC schema, `gherkin` for one of buildingSMART's rules, or `ids` for a
     * specification in one of the project's IDS documents (Dataregium 3.0.0).
     */
    const KINDS = ['schema', 'entity_rule', 'simpletype_rule', 'global_rule', 'gherkin', 'ids'];
    /** The report's own field names, kept as the table's columns. */
    const COLUMNS = [
      { name: 'kind', type: 'text' }, { name: 'rule', type: 'text' }, { name: 'severity', type: 'text' }, { name: 'message', type: 'text' },
      { name: 'step_id', type: 'integer' }, { name: 'global_id', type: 'text' }, { name: 'attribute', type: 'text' },
    ];
    const GUID = /^[0-9A-Za-z_$]{22}$/;
    const str = (v) => (v === null || v === undefined || v === '' ? null : String(v));

    /**
     * The server's summary from a document version's metadata (`{metadata: [...]}` or the entries themselves).
     * @param {any} answer @returns {{status: string, issues: number|null, checkedAt: string|null, ruleset: string|null, report: string|null}|null}
     *   null when the server did not check the file
     */
    function fromMetadata(answer) {
      const list = Array.isArray(answer) ? answer : (answer && Array.isArray(answer.metadata) ? answer.metadata : []);
      const values = (name) => {
        const e = list.find((x) => x && x.name === 'ifc_validation_' + name);
        return e && Array.isArray(e.value) ? e.value.map(String).filter(Boolean) : [];
      };
      const value = (name) => values(name)[0] || null;
      const status = value('status');
      if (!status) return null;
      const n = value('issues');
      // The schema check and buildingSMART's rules each name their ruleset.
      const rulesets = values('ruleset');
      return {
        status: STATUSES.includes(status) ? status : 'unknown',
        issues: n === null || !Number.isFinite(Number(n)) ? null : Number(n),
        checkedAt: value('checked_at'), ruleset: rulesets.length ? rulesets.join('; ') : null, report: value('report'),
      };
    }

    /** @param {any} report @returns {any[]} */
    const issuesOf = (report) => (report && Array.isArray(report.issues) ? report.issues : []);

    /**
     * The report's errors as a table, with the report's own field names.
     * @param {any} report @returns {{columns: Array<{name: string, type: string}>, rows: any[][]}}
     */
    function tableOf(report) {
      return {
        columns: COLUMNS.map((c) => Object.assign({}, c)),
        rows: issuesOf(report).map((i) => [str(i.kind), str(i.rule), str(i.severity), str(i.message), Number.isInteger(i.step_id) ? i.step_id : null, str(i.global_id), str(i.attribute)]),
      };
    }

    /**
     * How many findings and errors the report has: its own counts when it gives them (they count beyond a truncated list).
     * @param {any} report @returns {{findings: number, errors: number}}
     */
    function counts(report) {
      const issues = issuesOf(report);
      const findings = report && Number.isFinite(Number(report.issue_count)) ? Number(report.issue_count) : issues.length;
      const errors = report && Number.isFinite(Number(report.error_count)) ? Number(report.error_count) : issues.filter((i) => String(i.severity || 'error') === 'error').length;
      return { findings, errors };
    }
    /**
     * The checks the server made, from the report's `checks`: the schema check, buildingSMART's rules and the project's IDS
     * documents when the server has them. The IDS check also has the `documents` it used and every `specification` with its
     * verdict (passed, failed or not applicable); a document it could not read is in `notRun` by its title.
     * @param {any} report
     * @returns {Array<{name: string, state: string, ruleset: string, findings: number, notRun: string[], documents?: Array<{id: string, version: number|null, title: string}>, specifications?: Array<{documentId: string, document: string, name: string, identifier: string, usage: string, status: string, applicable: number, issues: number, forThisSchema: boolean}>}>}
     */
    function checksOf(report) {
      const list = report && Array.isArray(report.checks) ? report.checks : [];
      return list.map((c) => {
        const out = {
          name: String(c.name || ''), state: String(c.state || ''), ruleset: String(c.ruleset || ''),
          findings: Number(c.issue_count) || 0,
          notRun: (Array.isArray(c.rules_not_run) ? c.rules_not_run : []).map((r) => String((r && r.rule) || r || '')).filter(Boolean),
        };
        // Dataregium writes both lists, empty, on every check: only the IDS check (or a check that has some) gets them.
        const some = (v) => Array.isArray(v) && v.length > 0;
        if (out.name === 'ids' || some(c.documents) || some(c.specifications)) {
          const documents = (Array.isArray(c.documents) ? c.documents : []).filter(Boolean).map((d) => ({ id: String(d.document_id || ''), version: Number.isInteger(d.version_index) ? d.version_index : null, title: String(d.title || '') }));
          const titles = new Map(documents.map((d) => [d.id, d.title]));
          out.documents = documents;
          out.specifications = (Array.isArray(c.specifications) ? c.specifications : []).filter(Boolean).map((s) => ({
            documentId: String(s.document_id || ''), document: titles.get(String(s.document_id || '')) || String(s.document_id || ''),
            name: String(s.name || ''), identifier: s.identifier ? String(s.identifier) : '', usage: String(s.usage || ''), status: String(s.status || ''),
            applicable: Number(s.applicable) || 0, issues: Number(s.issues) || 0, forThisSchema: s.for_this_schema !== false,
          }));
        }
        return out;
      });
    }
    /**
     * The verdicts of an IDS check's specifications counted: how many passed, failed and did not apply, and in how many documents.
     * @param {{documents?: any[], specifications?: any[]}} check @returns {{documents: number, total: number, passed: number, failed: number, notApplicable: number}}
     */
    function specsSummary(check) {
      const specs = (check && check.specifications) || [];
      return {
        documents: ((check && check.documents) || []).length, total: specs.length,
        passed: specs.filter((s) => s.status === 'passed').length, failed: specs.filter((s) => s.status === 'failed').length,
        notApplicable: specs.filter((s) => s.status === 'not applicable').length,
      };
    }

    /**
     * How many errors of each kind the report lists, the most first.
     * @param {any} report @returns {Array<{kind: string, n: number}>}
     */
    function byKind(report) {
      const counts = new Map();
      for (const i of issuesOf(report)) { const k = str(i.kind) || 'schema'; counts.set(k, (counts.get(k) || 0) + 1); }
      return Array.from(counts.entries()).map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
    }

    /**
     * The elements the errors name, as a condition on the model's table, where `id` is the STEP instance number; a GlobalId
     * stands in when an error has no instance. Both are checked before they go into SQL.
     * @param {any} report @returns {string|null} null when the errors name no element
     */
    function whereOf(report) {
      const ids = new Set(); const guids = new Set();
      for (const i of issuesOf(report)) {
        if (Number.isInteger(i.step_id) && i.step_id > 0) ids.add(i.step_id);
        else if (typeof i.global_id === 'string' && GUID.test(i.global_id)) guids.add(i.global_id);
      }
      const parts = [];
      if (ids.size) parts.push(`id in (${Array.from(ids).join(', ')})`);
      if (guids.size) parts.push(`guid in (${Array.from(guids).map((g) => `'${g}'`).join(', ')})`);
      return parts.length ? parts.join(' or ') : null;
    }

    /**
     * One error in a line: the instance and its class when the message names them, and the message's last line, which in
     * IfcOpenShell's words is the rule in plain language ("The attribute GlobalId should be unique").
     * @param {any} issue @returns {{instance: string, cls: string, text: string}}
     */
    function lineOf(issue) {
      const message = String((issue && issue.message) || '');
      const named = /#(\d+)\s*=\s*(Ifc\w+)\s*\(/i.exec(message);
      const lines = message.split('\n').map((x) => x.trim()).filter(Boolean);
      const step = issue && Number.isInteger(issue.step_id) ? issue.step_id : (named ? Number(named[1]) : null);
      return { instance: step ? '#' + step : '', cls: named ? named[2] : '', text: lines.length ? lines[lines.length - 1] : '' };
    }

    /** The kind of badge a status gets: none while waiting or unknown. @param {string} status */
    const badgeKind = (status) => (status === 'passed' ? 'ok' : status === 'issues' ? 'error' : status === 'warnings' ? 'warn' : '');

    /**
     * The latest results of a dataset's checks: `server` (the summary and when it was fetched), `schema` and `ids` (run here).
     * @param {string} datasetId @returns {Promise<{server?: any, schema?: any, ids?: any}>}
     */
    async function results(datasetId) {
      try { return (await idb.getSetting(PREFIX + datasetId, null)) || {}; } catch (err) { D.log('validation', err); return {}; }
    }

    /**
     * Keeps the latest result of one check. Nothing about the dataset changes.
     * @param {string} datasetId @param {'server'|'schema'|'ids'} check @param {any} result @returns {Promise<any>} all results
     */
    async function record(datasetId, check, result) {
      const all = Object.assign({}, await results(datasetId), { [check]: Object.assign({ at: new Date().toISOString() }, result) });
      await idb.setSetting(PREFIX + datasetId, all);
      return all;
    }

    /**
     * The result of a check run here, from what the model tool returned (`validate` or `ids` in ui/analysis/model-panel).
     * @param {'validate'|'ids'} tool @param {any} out the tool's table @param {{file?: string}} [extra] @returns {any}
     */
    function localResult(tool, out, extra = {}) {
      if (tool === 'ids') {
        const s = (out && out.summary) || {};
        return { file: extra.file || '', specs: Number(s.specifications) || 0, checks: Number(s.checks) || 0, pass: Number(s.checks_pass) || 0, fail: Number(s.checks_fail) || 0 };
      }
      return { findings: Number(out && out.total) || 0, express: !!extra.express };
    }

    return { PREFIX, STATUSES, KINDS, COLUMNS, fromMetadata, tableOf, counts, checksOf, specsSummary, byKind, whereOf, lineOf, badgeKind, results, record, localResult };
  });
})();
