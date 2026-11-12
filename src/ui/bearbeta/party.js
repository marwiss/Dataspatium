// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A model's responsible party (recommendation 8 of the study of the IFC and BCF guidelines: models are divided per responsible
 * party, and a review issue names the party that is to act). It is read from the model's facts (data/ifc-step `parties`), shown
 * with the model, the default of Ansvarig part in a new issue, and set with a form whose operation (ai/write-tools partyOp) the
 * recipe step ifc_party writes through the wheel, undoable like any other step. The organisation and its role name nobody; a contact
 * person's name is personal data, which the review before sharing finds in the file (data/ifc-step personalOf).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/party', ['ui/base', 'ai/write-tools'], (base, writeTools) => {
    const { h, t } = base;
    /** The form's fields, in their order. */
    const FIELDS = ['organization', 'role', 'user_role', 'designation', 'contact_role', 'contact_person'];

    /** The model's parties from its facts, the project's first. @param {any} ds @returns {any[]} */
    const partiesOf = (ds) => (ds && ds.model && Array.isArray(ds.model.parties) ? ds.model.parties.filter((p) => p && p.organization) : []);
    /** The model's responsible party: the first of its parties, or null. @param {any} ds */
    const of = (ds) => partiesOf(ds)[0] || null;
    /** A party as text: its organisation and role. @param {any} p */
    const text = (p) => (p ? p.organization + (writeTools.partyRole(p) ? ` (${writeTools.partyRole(p)})` : '') : '');
    /**
     * What a new issue's Ansvarig part can start on, best first: the designation the project gives the model's party, then its
     * organisation (the project's own label list may hold either). @param {any} ds @returns {string[]}
     */
    const labels = (ds) => { const p = of(ds); return p ? [p.designation, p.organization].filter(Boolean) : []; };

    /** The model's parties as rows of its facts (dm-kv); the contact person is said, never named. @param {any} ds */
    function facts(ds) {
      const list = partiesOf(ds);
      if (!list.length) return [];
      const p = list[0];
      return [{ label: t('model.field.party'), value: text(p) },
        p.designation ? { label: t('party.designation'), value: p.designation } : null,
        p.contact ? { label: t('party.contact_role'), value: p.contact } : null,
        p.person ? { label: t('party.contact_person'), value: t('party.person.named') } : null,
        list.length > 1 ? { label: t('party.more'), value: list.slice(1).map(text).join(', ') } : null].filter(Boolean);
    }

    /**
     * The form: organisation, role (IfcRoleEnum), the role's own name for Annan roll, designation, contact role and contact person.
     * @param {any} [initial] a party of the facts, or the form's own values
     * @returns {{nodes: HTMLElement[], values: () => any, inputs: Record<string, any>, check: () => string}}
     */
    function form(initial = {}) {
      const start = { organization: initial.organization, role: initial.role, user_role: initial.user_role || initial.userRole, designation: initial.designation,
        contact_role: initial.contact_role || initial.contact, contact_person: initial.contact_person };
      /** @type {Record<string, any>} */
      const inputs = {};
      for (const key of FIELDS) {
        if (key === 'role') {
          const sel = /** @type {any} */ (h('dm-select', { label: t('party.role'), help: t('party.role.help'), 'data-party': key }));
          sel.options = [{ value: '', label: t('party.role.none') }].concat(writeTools.ROLES.map((r) => ({ value: r, label: t('party.role.' + r.toLowerCase()) })));
          sel.value = start.role && writeTools.ROLES.includes(start.role) ? start.role : '';
          inputs[key] = sel;
          continue;
        }
        const el = /** @type {any} */ (h('dm-input', { label: t('party.' + key), help: t('party.' + key + '.help'), placeholder: t('party.' + key + '.placeholder'), 'data-party': key }));
        el.value = start[key] ? String(start[key]) : '';
        inputs[key] = el;
      }
      // The role's own name only for Annan roll (USERDEFINED).
      const own = () => { inputs.user_role.hidden = inputs.role.value !== 'USERDEFINED'; };
      inputs.role.addEventListener('change', own);
      own();
      const get = (key) => String(inputs[key].value || '').trim();
      /** The operation's fields from what is filled in; the role's own name only with Annan roll. */
      function values() {
        const out = {};
        for (const key of FIELDS) if (get(key) && !(key === 'user_role' && get('role') !== 'USERDEFINED')) out[key] = get(key);
        return out;
      }
      /** What is missing, in the person's words, or ''. */
      const check = () => (!get('organization') ? t('party.err.organization') : get('role') === 'USERDEFINED' && !get('user_role') ? t('party.err.user_role') : '');
      return { nodes: FIELDS.map((key) => inputs[key]), values, inputs, check };
    }

    /**
     * The dialog Ansvarig part for a model: the form on the party it has (a contact person it names stays unless replaced or
     * removed), then the step ifc_party; Python starts on the button and fetches its components after consent the first time.
     * @param {any} ctx shell context @param {any} ds the model's dataset @returns {Promise<boolean>} whether the model was changed
     */
    async function open(ctx, ds) {
      const current = of(ds) || {};
      const f = form(current);
      const drop = current.person ? /** @type {any} */ (h('dm-switch', { label: t('party.person.remove'), 'data-party-person-remove': '' })) : null;
      const body = h('div', { class: 'dm-stack', 'data-party-form': '' }, h('p', { class: 'dm-help', text: t('party.lead') }), ...f.nodes,
        current.person ? h('p', { class: 'dm-help dm-xs', text: t('party.person.kept') }) : null, drop, h('p', { class: 'dm-help dm-xs', text: t('party.python') }));
      for (;;) {
        const ok = await ctx.ui.dialog.open({ title: t('party.title'), size: 'md', help: 'cad-bim#ansvarig-part', body,
          actions: [{ label: t('common.cancel'), value: false }, { label: t('party.save'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return false;
        const missing = f.check();
        if (!missing) break;
        ctx.ui.toast.show(missing, { kind: 'warn' });
      }
      const op = writeTools.partyOp(Object.assign(f.values(), drop && drop.checked && !f.values().contact_person ? { contact_person: '' } : {}), { person: true });
      try {
        await D.require('data/recipes').apply(ds.id, 'ifc_party', { party: JSON.stringify(op) });
        const msg = t('party.saved', { name: text(op) });
        ctx.shell.log(msg, 'ok');
        ctx.ui.toast.show(msg, { kind: 'ok' });
        return true;
      } catch (err) {
        const msg = t('party.err.failed', { message: String((err && err.message) || err) });
        ctx.shell.log(msg, 'error');
        ctx.ui.toast.show(msg, { kind: 'error' });
        return false;
      }
    }

    return { FIELDS, partiesOf, of, text, labels, facts, form, open };
  });
})();
