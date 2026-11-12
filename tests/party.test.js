// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a model's responsible party (recommendation 8 of the study of the IFC and BCF guidelines): set_responsible_party is
 * checked as the wheel takes it, with IFC's roles, never a person's name from the AI and a log line that never names one; the reader
 * finds the party in a file (the project's first) and says that a contact person is named without naming it; the model's facts,
 * Hantera's card and the AI's overview show it; a new issue's Ansvarig part starts on it, in the project's own list without regard
 * to case; the form checks what is missing and writes the step ifc_party, keeping, replacing or removing a contact person; the new
 * model form sends it to the wheel; and the review before sharing lists an actor only when it names a person. With the real Pyodide
 * (`?python=1` or cached components) the wheel writes the party natively in a new model and in the fixture, changes it in place
 * with the GlobalIds kept, and the review's removal keeps the organisation of an actor that named a person. Test data names made-up
 * companies and roles only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const writeTools = D.require('ai/write-tools');
  const fixtures = D.require('tests/fixtures/ifc');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const ifcOps = D.require('data/ifc-ops');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  const SKIPPED = 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const textOf = (bytes) => (typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes));
  const PARTY = { organization: 'Exempel Arkitekter AB', role: 'ARCHITECT', user_role: null, designation: 'A', contact_role: 'Uppdragsansvarig' };
  const party = () => D.require('ui/bearbeta/party');
  const imported = async (options, name) => { const meta = await importer.run(fixtures.ifcFile(Object.assign({ name: name + '.ifc' }, options)), { format: 'model' }, null, name); created.push(meta.id); return meta; };

  test('party: set_responsible_party takes an organisation with IFC\'s role, never a person\'s name from the AI, and its line names nobody', async (assert) => {
    const tool = writeTools.TOOLS.find((x) => x.name === 'set_responsible_party');
    assert.ok(tool, 'a write tool');
    assert.deepEqual(Object.keys(tool.parameters.properties), ['organization', 'role', 'user_role', 'designation', 'contact_role'], 'no contact person for the AI');
    assert.ok(/never guess one, and never write a person's name/.test(tool.description) && /assigned to the IfcProject/.test(tool.description), 'the tool says how and what not');
    assert.ok(writeTools.ROLES.length === 23 && writeTools.ROLES[0] === 'ARCHITECT' && writeTools.ROLES.includes('COMMISSIONINGENGINEER') && writeTools.ROLES[22] === 'USERDEFINED', 'IfcRoleEnum');
    const cs = writeTools.create('party-test');
    const out = writeTools.call(cs, 'set_responsible_party', Object.assign({}, PARTY, { organization: '  Exempel   Arkitekter AB ', role: 'architect' }));
    assert.ok(out.ok && !out.ref, 'a change without a ref: ' + JSON.stringify(out));
    assert.deepEqual(cs.ops[0], { tool: 'set_responsible_party', organization: 'Exempel Arkitekter AB', role: 'ARCHITECT', designation: 'A', contact_role: 'Uppdragsansvarig' }, 'only what is given lands');
    assert.equal(writeTools.describe(cs.ops[0]), t('ai.change.set_responsible_party', { organization: 'Exempel Arkitekter AB', role: ` (${t('party.role.architect')})` }) + t('ai.change.party.designation', { designation: 'A' }) + t('ai.change.party.contact', { contact: 'Uppdragsansvarig' }));
    const refused = (args, re, label) => { const r = writeTools.call(cs, 'set_responsible_party', Object.assign({}, PARTY, args)); assert.ok(r.error && re.test(r.error), label + ': ' + JSON.stringify(r)); return r; };
    refused({ organization: ' ' }, /organization is required/, 'no organisation');
    const odd = refused({ role: 'Trollkarl' }, /role must be ARCHITECT, /, 'a role outside the list');
    assert.ok(!/Trollkarl/i.test(odd.error), 'never quoting what was sent');
    refused({ role: 'USERDEFINED' }, /needs user_role/, 'an own role without its name');
    refused({ role: 'CLIENT', user_role: 'Brandkonsult' }, /goes with role USERDEFINED/, 'an own name with a role of the list');
    const person = refused({ contact_person: 'Kontaktperson' }, /contact_person is not taken here/, 'a person\'s name from the AI');
    assert.ok(!/Kontaktperson/.test(person.error), 'not quoted');
    assert.equal(cs.ops.length, 1, 'nothing refused lands');
    assert.ok(writeTools.call(cs, 'set_responsible_party', { organization: 'Exempel Konsult AB', role: 'USERDEFINED', user_role: 'Brandkonsult', designation: null, contact_role: null }).ok);
    assert.equal(writeTools.partyRole(cs.ops[1]), 'Brandkonsult', 'an own role by its name');
    // The form's own operation may carry a contact person: a name sets it, '' removes it, and leaving it out keeps it.
    const own = writeTools.partyOp(Object.assign({}, PARTY, { role: 'COMISSIONINGENGINEER', contact_person: 'Kontaktperson' }), { person: true });
    assert.equal(own.role, 'COMMISSIONINGENGINEER', 'IFC2X3\'s spelling read as IFC4\'s');
    assert.equal(own.contact_person, 'Kontaktperson');
    assert.ok(writeTools.describe(own).endsWith(t('ai.change.party.person')) && !writeTools.describe(own).includes('Kontaktperson'), 'said, never named');
    assert.equal(writeTools.partyOp(Object.assign({}, PARTY, { contact_person: '' }), { person: true }).contact_person, '', '\'\' removes');
    assert.ok(!('contact_person' in writeTools.partyOp(PARTY, { person: true })), 'left out keeps');
    return 'ok';
  });

  test('party: the reader finds the model\'s party, the project\'s first, and says a contact person without naming it; the facts, Hantera and the AI show it', async (assert) => {
    const step = D.require('data/ifc-step');
    const plain = await step.summary(new TextEncoder().encode(fixtures.ifcText({ name: 'utan.ifc' })));
    assert.deepEqual(plain.parties, [], 'no party, none listed');
    const people = await step.summary(new TextEncoder().encode(fixtures.ifcText({ name: 'personer.ifc', persons: true })));
    assert.deepEqual(people.parties, [], 'an occupant of the building is no party of the model, and an actor assigned to nothing neither');
    const meta = await imported({ party: 'contact' }, 'Partshus');
    const ds = await datasets.get(meta.id);
    assert.deepEqual(ds.model.parties, [{ organization: 'Exempel Arkitekter AB', role: 'ARCHITECT', userRole: '', designation: 'A', contact: 'Uppdragsansvarig', person: true, on: 'IfcProject' }], 'the party in the facts: ' + JSON.stringify(ds.model.parties));
    assert.ok(!JSON.stringify(ds.model).includes('Kontaktperson'), 'the contact person is said, never named');
    // A party of the building comes after the project's.
    const text = fixtures.ifcText({ name: 'tva.ifc', party: true }).replace('ENDSEC;\nEND-ISO-10303-21;', [
      "#9001=IFCORGANIZATION($,'Exempel Bygg AB',$,$,$);", "#9002=IFCACTOR('0Party0000000000000001',$,$,$,$,#9001);",
      "#9003=IFCACTORROLE(.CONTRACTOR.,$,$);"].join('\n') + '\nENDSEC;\nEND-ISO-10303-21;');
    const building = /#(\d+)=IFCBUILDING\(/.exec(text)[1];
    const two = await step.summary(new TextEncoder().encode(text.replace('ENDSEC;\nEND-ISO-10303-21;', `#9004=IFCRELASSIGNSTOACTOR('0Party0000000000000002',$,$,$,(#${building}),$,#9002,#9003);\nENDSEC;\nEND-ISO-10303-21;`)));
    assert.deepEqual(two.parties.map((p) => [p.organization, p.role, p.on]), [['Exempel Arkitekter AB', 'ARCHITECT', 'IfcProject'], ['Exempel Bygg AB', 'CONTRACTOR', 'IfcBuilding']], 'the project\'s first');
    // Shown with the model: its facts, Hantera's card and the AI's overview.
    const rows = party().facts(ds);
    assert.deepEqual(rows.map((r) => [r.label, r.value]), [[t('model.field.party'), `Exempel Arkitekter AB (${t('party.role.architect')})`], [t('party.designation'), 'A'], [t('party.contact_role'), 'Uppdragsansvarig'], [t('party.contact_person'), t('party.person.named')]]);
    assert.deepEqual(party().facts({ model: { parties: two.parties } }).pop(), { label: t('party.more'), value: `Exempel Bygg AB (${t('party.role.contractor')})` }, 'the other parties');
    assert.ok(D.require('data/kinds').facts(ds).some((f) => f.label === t('model.field.party') && f.value === 'Exempel Arkitekter AB'), 'Hantera\'s card');
    const overview = await D.require('ai/model-tools').call(meta.id, 'get_model_overview', {});
    assert.deepEqual(overview.responsible_parties, [{ organization: 'Exempel Arkitekter AB', role: 'ARCHITECT', user_role: null, designation: 'A' }], 'the AI reads it, without whom to contact');
    assert.deepEqual(party().labels(ds), ['A', 'Exempel Arkitekter AB'], 'what an issue can start on');
    return 'ok';
  });

  test('party: a new issue\'s Ansvarig part starts on the model\'s party, as free text in a file and in the project\'s list without regard to case', async (assert) => {
    const fields = D.require('ui/bearbeta/issue-fields');
    const labels = ['A', 'Exempel Arkitekter AB'];
    const file = fields.create(null, { initial: { responsible: labels } });
    assert.equal(file.inputs.responsible.value, 'A', 'the designation first');
    file.inputs.responsible.value = 'K';
    assert.deepEqual(file.values().labels, ['K'], 'the person can change it');
    const list = fields.create({ topic_label: ['Fasad', 'exempel arkitekter ab'], topic_type: ['Issue'], topic_status: ['Open'] }, { required: ['topic_type', 'topic_status'], initial: { responsible: labels } });
    assert.equal(list.inputs.responsible.value, 'exempel arkitekter ab', 'the project\'s own spelling');
    assert.deepEqual(list.values().labels, ['exempel arkitekter ab']);
    const other = fields.create({ topic_label: ['Fasad'], topic_type: ['Issue'], topic_status: ['Open'] }, { initial: { responsible: labels } });
    assert.equal(other.inputs.responsible.value, '', 'none when the list lacks it');
    assert.equal(fields.create(null, {}).inputs.responsible.value, '', 'nothing without a party');
    return 'ok';
  });

  test('party: the form says what is missing and writes the step ifc_party, keeping, replacing or removing a contact person', async (assert) => {
    const recipes = D.require('data/recipes');
    const real = recipes.apply;
    const calls = []; const toasts = []; let opened = 0; let fill = null;
    recipes.apply = async (id, op, params) => { calls.push({ id, op, params }); return {}; };
    const ctx = { shell: { log: () => {} }, ui: { toast: { show: (m) => toasts.push(m) }, dialog: { open: async (o) => { opened++; if (fill) fill(o.body, opened); return true; } } } };
    const set = (body, key, value) => { const el = /** @type {any} */ (body.querySelector(`[data-party="${key}"]`)); el.value = value; el.dispatchEvent(new Event('change')); };
    try {
      // Empty first: the organisation is asked for, and the role's own name with Annan roll.
      fill = (body, n) => {
        if (n === 1) { assert.ok(/** @type {any} */ (body.querySelector('[data-party="user_role"]')).hidden, 'the own name hidden for a role of the list'); return; }
        if (n === 2) { set(body, 'organization', 'Exempel Konsult AB'); set(body, 'role', 'USERDEFINED'); assert.ok(!/** @type {any} */ (body.querySelector('[data-party="user_role"]')).hidden, 'shown for Annan roll'); return; }
        set(body, 'user_role', 'Brandkonsult'); set(body, 'designation', 'BR');
      };
      assert.ok(await party().open(ctx, { id: 'ds-x', model: {} }));
      assert.deepEqual(toasts.slice(0, 2), [t('party.err.organization'), t('party.err.user_role')], 'what is missing, in the person\'s words');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].op, 'ifc_party');
      assert.deepEqual(JSON.parse(calls[0].params.party), { tool: 'set_responsible_party', organization: 'Exempel Konsult AB', role: 'USERDEFINED', user_role: 'Brandkonsult', designation: 'BR' });
      // A party with a contact: the form starts on it, says the contact is kept, and the switch removes it.
      const ds = { id: 'ds-y', model: { parties: [{ organization: 'Exempel Arkitekter AB', role: 'ARCHITECT', userRole: '', designation: 'A', contact: 'Uppdragsansvarig', person: true, on: 'IfcProject' }] } };
      opened = 0;
      fill = (body) => {
        assert.equal(/** @type {any} */ (body.querySelector('[data-party="organization"]')).value, 'Exempel Arkitekter AB');
        assert.equal(/** @type {any} */ (body.querySelector('[data-party="role"]')).value, 'ARCHITECT');
        assert.ok(body.textContent.includes(t('party.person.kept')), 'the contact is kept unless replaced');
      };
      await party().open(ctx, ds);
      assert.ok(!('contact_person' in JSON.parse(calls[1].params.party)), 'kept: left out');
      fill = (body) => { /** @type {any} */ (body.querySelector('[data-party-person-remove]')).checked = true; };
      await party().open(ctx, ds);
      assert.equal(JSON.parse(calls[2].params.party).contact_person, '', 'removed');
      fill = (body) => { set(body, 'contact_person', 'Kontaktperson'); };
      await party().open(ctx, ds);
      assert.equal(JSON.parse(calls[3].params.party).contact_person, 'Kontaktperson', 'replaced');
      // Cancelled: nothing written.
      ctx.ui.dialog.open = async () => false;
      assert.equal(await party().open(ctx, ds), false);
      assert.equal(calls.length, 4);
    } finally { recipes.apply = real; }
    // The new model's form sends the party with the names.
    const ifcNew = D.require('data/ifc-new');
    assert.deepEqual(ifcNew.identity({ party: {} }), {}, 'nothing filled in, nothing sent');
    assert.deepEqual(ifcNew.identity({ party: { organization: 'Exempel Arkitekter AB', role: 'ARCHITECT' } }), { party: { organization: 'Exempel Arkitekter AB', role: 'ARCHITECT' } });
    return 'ok';
  });

  test('party: the review lists an actor only when it names a person; an organisation alone is no personal data', async (assert) => {
    const shareScan = D.require('data/share-scan');
    const state = bridge.state;
    try {
      bridge.state = 'idle';
      const firm = await imported({ party: true }, 'Partsfirma');
      assert.deepEqual((await shareScan.inspect(firm.id)).parts.filter((p) => p.kind.startsWith('ifc.')).map((p) => p.id), ['ifc:persons', 'ifc:owner', 'ifc:header'], 'the party is not listed, the fixture\'s maker is');
      const contact = await imported({ party: 'contact' }, 'Partskontakt');
      const parts = (await shareScan.inspect(contact.id)).parts;
      const actors = parts.find((p) => p.id === 'ifc:actors');
      assert.ok(actors && actors.count === 1 && actors.names[0].includes('Kontaktperson'), 'with a contact person it is: ' + JSON.stringify(actors));
      assert.ok(parts.find((p) => p.id === 'ifc:persons').names.includes('Kontaktperson'), 'and the person too');
    } finally { bridge.state = state; }
    return 'ok';
  }, 60000);

  test('party: Python writes the responsible party natively, in a new model and in the fixture, and changes it in place with its GlobalIds', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return SKIPPED;
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    // A new model with its party, in the three schemas; IFC2X3 spells COMMISSIONINGENGINEER its own way.
    const code = ['import json', 'import ifcopenshell', 'out = {}',
      'for schema in ("IFC4X3_ADD2", "IFC4", "IFC2X3"):',
      '    party = {"organization": "Exempel Arkitekter AB", "role": "COMMISSIONINGENGINEER" if schema == "IFC2X3" else "ARCHITECT", "designation": "A", "contact_role": "Uppdragsansvarig"}',
      '    info = json.loads(_dataspatium._ifc_new_model(schema, json.dumps({"project": "P", "site": "S", "building": "B", "storey": "Plan 1", "party": party}), "/data/step/party-new.ifc"))',
      '    m = ifcopenshell.open("/data/step/party-new.ifc")',
      '    r = m.by_type("IfcRelAssignsToActor")',
      '    a = r[0].RelatingActor if r else None',
      '    out[schema] = {"errors": info["errors"], "rels": len(r), "on": r[0].RelatedObjects[0].is_a() if r else None, "org": a.TheActor.Name if a else None, "who": a.TheActor.is_a() if a else None,',
      '        "role": r[0].ActingRole.Role if r and r[0].ActingRole else None, "roles": [x.Role for x in (a.TheActor.Roles or ())] if a else [], "name": a.Name if a else None, "description": a.Description if a else None,',
      '        "express": len(_dataspatium._ifc_express(m))}',
      'print(json.dumps(out))'].join('\n');
    const run = await bridge.run(code);
    const error = run.entries.find((e) => e.kind === 'error');
    assert.ok(!error, error ? String(error.text).slice(-400) : '');
    const facts = JSON.parse(run.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim().split('\n').pop());
    for (const [schema, f] of Object.entries(facts)) {
      const role = schema === 'IFC2X3' ? 'COMISSIONINGENGINEER' : 'ARCHITECT';
      assert.deepEqual(f, { errors: 0, rels: 1, on: 'IfcProject', org: 'Exempel Arkitekter AB', who: 'IfcOrganization', role, roles: [role], name: 'A', description: 'Uppdragsansvarig', express: 0 }, schema + ': ' + JSON.stringify(f));
    }
    // The fixture (IFC4, millimetres): the party in a change set, then changed in place with a contact, then without.
    const meta = await imported({}, 'Partsprov');
    const one = await ifcOps.previewChangeset(meta.id, [Object.assign({ tool: 'set_responsible_party' }, PARTY)]);
    assert.equal(one.report.errors, 0, JSON.stringify(one.report.findings));
    assert.deepEqual(one.report.created.map((c) => c.ifc_class), ['IfcActor', 'IfcRelAssignsToActor'], 'an actor and its assignment');
    const first = textOf(one.bytes);
    const project = /#(\d+)=IFCPROJECT\(/.exec(first)[1];
    const role = /#(\d+)=IFCACTORROLE\(\.ARCHITECT\.,\$,\$\);/.exec(first);
    const org = /#(\d+)=IFCORGANIZATION\(\$,'Exempel Arkitekter AB',\$,\(#(\d+)\),\$\);/.exec(first);
    assert.ok(role && org && org[2] === role[1], 'the organisation with its role');
    const actor = new RegExp(`#(\\d+)=IFCACTOR\\('([^']{22})',#\\d+,'A','Uppdragsansvarig',\\$,#${org[1]}\\);`).exec(first);
    assert.ok(actor, 'the actor of the organisation, with the file\'s owner history');
    const rel = new RegExp(`IFCRELASSIGNSTOACTOR\\('([^']{22})',#\\d+,\\$,\\$,\\(#${project}\\),\\$,#${actor[1]},#${role[1]}\\);`).exec(first);
    assert.ok(rel, 'assigned to the project with its acting role');
    const again = await importer.run(new File([one.bytes], 'partsprov-2.ifc'), { format: 'model' }, null, 'Partsprov 2');
    created.push(again.id);
    const two = await ifcOps.previewChangeset(again.id, [{ tool: 'set_responsible_party', organization: 'Exempel Arkitekter Nord AB', role: 'ARCHITECT', designation: 'A1', contact_person: 'Kontakt Projektledare' }]);
    assert.equal(two.report.errors, 0, JSON.stringify(two.report.findings));
    const second = textOf(two.bytes);
    assert.ok(second.includes(`IFCACTOR('${actor[2]}'`) && second.includes(`IFCRELASSIGNSTOACTOR('${rel[1]}'`), 'the same GlobalIds');
    assert.ok(/IFCPERSONANDORGANIZATION\(#\d+,#\d+,\$\)/.test(second) && second.includes("IFCPERSON($,'Projektledare','Kontakt',$,$,$,$,$)"), 'the contact at the new organisation');
    assert.ok(!second.includes("'Exempel Arkitekter AB'"), 'an organisation is never renamed, and the old one went');
    return 'ok';
  }, 900000);

  test('party: cleanup', async () => {
    for (const id of created) await datasets.remove(id, { quiet: true }).catch(() => {});
    return 'ok';
  });
})();
