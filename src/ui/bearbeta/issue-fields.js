// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The fields of a new issue that review practice asks for, as form fields for the dialog Nytt ärende and the AI check's issues: type,
 * status, priority, a label, the responsible party (which BCF has no field for, so it goes in as a label), the assignee, the stage and
 * the due date. With a project's own lists (the BCF API's extensions) a field is a choice among the project's values and a list the
 * project lacks gives no field; without a project (a BCF file) status, assignee, stage and responsible party are free text. Nothing is
 * filled in for the person: an optional field starts empty.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/issue-fields', ['ui/base', 'data/bcf-xml'], (base, bcfXml) => {
    const { h, t } = base;
    /** The project's list behind each field (BCF API extension keys). */
    const LISTS = { topic_type: 'topic_type', topic_status: 'topic_status', priority: 'priority', labels: 'topic_label', responsible: 'topic_label', assigned_to: 'users', stage: 'stage' };
    const FREE = new Set(['topic_status', 'responsible', 'assigned_to', 'stage']);
    const ALL = ['topic_type', 'topic_status', 'priority', 'labels', 'responsible', 'assigned_to', 'stage', 'due_date'];

    /**
     * @param {any} ext the project's extensions, or null for a file
     * @param {{fields?: string[], required?: string[], initial?: Record<string, any>}} [options] `required` fields start on the
     *   project's first value and have no "none"; the others start empty (or on `initial`)
     * @returns {{nodes: HTMLElement[], values: () => any, inputs: Record<string, any>}}
     */
    function create(ext, options = {}) {
      const wanted = options.fields || ALL;
      const required = new Set(options.required || []);
      const initial = options.initial || {};
      /** @type {Record<string, any>} */
      const inputs = {};
      for (const name of wanted) {
        // The assignee in review practice's own word, apart from the responsible party.
        const label = t('issues.field.' + (name === 'assigned_to' ? 'assignee' : name));
        const help = name === 'responsible' ? t('issues.field.responsible.help') : name === 'due_date' ? t('issues.field.due_date.help') : '';
        if (name === 'due_date') {
          const el = /** @type {any} */ (h('dm-input', { type: 'date', label, help, 'data-issue-field': name }));
          el.value = initial.due_date ? String(initial.due_date).slice(0, 10) : '';
          inputs[name] = el;
          continue;
        }
        const list = ext && Array.isArray(ext[LISTS[name]]) ? ext[LISTS[name]].filter((v) => v !== null && v !== undefined && String(v).trim()) : null;
        if (list && list.length) {
          const sel = /** @type {any} */ (h('dm-select', Object.assign({ label, 'data-issue-field': name }, help ? { help } : {})));
          sel.options = (required.has(name) ? [] : [{ value: '', label: t('issues.field.none') }]).concat(list.map((v) => ({ value: String(v), label: String(v) })));
          sel.value = initial[name] && list.includes(initial[name]) ? String(initial[name]) : sel.options[0].value;
          inputs[name] = sel;
        } else if (!ext && FREE.has(name)) {
          const el = /** @type {any} */ (h('dm-input', Object.assign({ label, 'data-issue-field': name }, help ? { help } : {})));
          el.value = initial[name] ? String(initial[name]) : '';
          inputs[name] = el;
        }
      }
      /** The topic's fields from what is chosen; empty fields are left out, and the responsible party joins the labels. */
      function values() {
        const out = {};
        const get = (name) => (inputs[name] ? String(inputs[name].value || '').trim() : '');
        for (const name of ['topic_type', 'topic_status', 'priority', 'assigned_to', 'stage']) if (get(name)) out[name] = get(name);
        const labels = Array.from(new Set([get('labels'), get('responsible')].filter(Boolean)));
        if (labels.length) out.labels = labels;
        const due = bcfXml.dateTime(get('due_date'));
        if (due) out.due_date = due;
        return out;
      }
      return { nodes: Object.values(inputs), values, inputs };
    }
    return { create, ALL };
  });
})();
