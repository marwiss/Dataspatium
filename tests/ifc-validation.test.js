// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the card Validera modellen against a mocked OpenCDE server (virtual providers, no network): the server's check read
 * from a version's metadata, its report, the address the report is fetched from, the log's words for both calls, the card in
 * Hantera from fetching to marking the elements and saving the errors as a table, and the latest result of a check run here.
 * Python is never started.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const opencde = D.require('api/families/opencde');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const validation = D.require('data/ifc-validation');
  const cdeLog = D.require('api/cde-log');
  const selection = D.require('data/selection');
  const idb = D.require('platform/storage/idb');
  const fixtures = D.require('tests/fixtures/ifc');
  const BASE = 'dataspatium-asset://tests/ifcval';
  const PROJECT = '5a0c9e1b-7d2f-4b3a-8c6d-1e2f3a4b5c6d';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  const fakePopup = (url) => { const u = new URL(url); return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const json = (data) => ({ kind: 'text', data: JSON.stringify(data) });
  /** What the mocked server knows; the walls are filled in once the model is imported, so that the report can name them. */
  const world = { walls: [], asked: [], tokens: 0 };
  const entry = (name, value, type) => ({ name, value: [value], data_type: type });
  /** The IDS check as Kontroll 3.0.0 reports it: the project's IDS documents, every specification with its verdict, and a document it could not read. */
  const IDS_CHECK = {
    name: 'ids', state: 'done', ruleset: 'IfcTester 0.9.0', issue_count: 1,
    rules_not_run: [{ rule: 'trasig.ids', error: 'XMLSchemaValidationError', document_id: 'doc-broken' }],
    documents: [{ document_id: 'doc-ids', version_index: 2, title: 'krav.ids' }],
    specifications: [
      { document_id: 'doc-ids', name: 'Väggar har brandklass', identifier: 'S1', usage: 'required', ifc_versions: ['IFC4'], for_this_schema: true, status: 'passed', applicable: 3, issues: 0 },
      { document_id: 'doc-ids', name: 'Väggar har ljudklass', identifier: 'S2', usage: 'required', ifc_versions: ['IFC4'], for_this_schema: true, status: 'failed', applicable: 3, issues: 1 },
      { document_id: 'doc-ids', name: 'Dörrar har bredd', usage: 'optional', ifc_versions: ['IFC4'], for_this_schema: true, status: 'not applicable', applicable: 0, issues: 0 },
    ],
  };
  function report() {
    const [a, b, c] = world.walls;
    return {
      status: 'issues', checked_at: '2026-11-07T10:05:25.123Z', ruleset: 'IfcOpenShell 0.9.0.post1: schema and EXPRESS rules; ifc-gherkin-rules 893f827 with IfcOpenShell 0.8.6',
      issue_count: 4, error_count: 3, truncated: false,
      checks: [
        // As the server writes them: every check carries `documents` and `specifications`, empty but for the IDS check.
        { name: 'schema', state: 'done', ruleset: 'IfcOpenShell 0.9.0.post1: schema and EXPRESS rules', issue_count: 2, rules_not_run: [], documents: [], specifications: [] },
        { name: 'gherkin', state: 'done', ruleset: 'ifc-gherkin-rules 893f827 with IfcOpenShell 0.8.6', issue_count: 1, rules_not_run: [{ rule: 'GEM004', error: 'FileNotFoundError' }], documents: [], specifications: [] },
        IDS_CHECK,
      ],
      issues: [
        { kind: 'schema', severity: 'error', message: `On instance:\n    #${a.id}=IfcWall('${a.guid}',$,$)\nRule IfcRoot.UR1:\n    The attribute GlobalId should be unique`, step_id: a.id, global_id: a.guid },
        { kind: 'entity_rule', severity: 'error', message: 'IfcWall.WR1: the wall has no body', global_id: b.guid },
        { kind: 'gherkin', rule: 'IFC106', severity: 'warning', message: 'IFC106 - Resource entities should be referenced by rooted entity.' },
        { kind: 'ids', rule: 'S2', severity: 'error', message: 'The requirement Pset_WallCommon.AcousticRating is not met', global_id: c.guid, document_id: 'doc-ids' },
      ],
    };
  }
  D.net.virtual('tests/ifcval/', (url) => {
    const u = new URL(url);
    const rest = url.startsWith(BASE) ? url.slice(BASE.length) : u.pathname;
    const path = rest.split('?')[0].split('#')[0] || '/';
    world.asked.push(path);
    const doc = (id) => `/documents/1.0/documents/${id}/versions/1`;
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke', oauth2_pkce_required: true }));
    if (path === '/foundation/oauth2/token') { world.tokens++; return Promise.resolve(json({ access_token: 'v' + world.tokens, refresh_token: 'w' + world.tokens, expires_in: 3600, token_type: 'bearer' })); }
    if (path === '/foundation/oauth2/revoke') return Promise.resolve({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'checker', name: 'Granskaren' }));
    if (path === '/bcf/3.0/projects') return Promise.resolve(json([{ project_id: PROJECT, name: 'Kontrollen' }]));
    if (path === doc('doc-ifc') + '/download') return Promise.resolve({ kind: 'text', data: fixtures.ifcText({ walls: 3 }) });
    // The report's address in the metadata points elsewhere on purpose: the app must build its own.
    if (path === doc('doc-ifc') + '/metadata') {
      return Promise.resolve(json({ metadata: [entry('file_name', 'hus.ifc', 'string'), entry('ifc_validation_status', 'issues', 'string'), entry('ifc_validation_issues', '4', 'integer32'),
        entry('ifc_validation_checked_at', '2026-11-07T10:05:25.123Z', 'date-time'),
        { name: 'ifc_validation_ruleset', value: ['IfcOpenShell 0.9.0.post1: schema and EXPRESS rules', 'ifc-gherkin-rules 893f827 with IfcOpenShell 0.8.6'], data_type: 'string' },
        entry('ifc_validation_report', 'https://elsewhere.example/collect', 'url')] }));
    }
    if (path === doc('doc-ifc') + '/ifc-validation') return Promise.resolve(json(report()));
    if (path === doc('doc-plain') + '/metadata') return Promise.resolve(json({ metadata: [entry('file_name', 'plain.ifc', 'string')] }));
    return Promise.resolve({ kind: 'text', data: JSON.stringify({ message: 'Not Found' }), status: 404 });
  });
  let connector = null; let model = null;

  test('validation: the server\'s check read from metadata, the errors as a table and as the elements they name', async (assert) => {
    assert.equal(validation.fromMetadata({ metadata: [entry('file_name', 'a.ifc', 'string')] }), null, 'no check, no summary');
    const s = validation.fromMetadata([entry('ifc_validation_status', 'issues', 'string'), entry('ifc_validation_issues', '3', 'integer32'), entry('ifc_validation_checked_at', '2026-11-07T10:05:25Z', 'date-time'), entry('ifc_validation_ruleset', 'R', 'string'), entry('ifc_validation_report', 'https://x/r', 'url')]);
    assert.deepEqual(s, { status: 'issues', issues: 3, checkedAt: '2026-11-07T10:05:25Z', ruleset: 'R', report: 'https://x/r' });
    assert.equal(validation.fromMetadata([entry('ifc_validation_status', 'strange', 'string')]).status, 'unknown', 'a status the app does not know is said as unknown');
    assert.equal(validation.fromMetadata([entry('ifc_validation_status', 'pending', 'string')]).issues, null, 'waiting has no count');
    const rep = { issues: [
      { kind: 'schema', severity: 'error', message: 'On instance:\n #12=IfcWall(\'0abcdefghijklmnopqrstu\',$)\nRule IfcRoot.UR1:\n The attribute GlobalId should be unique', step_id: 12, global_id: '0abcdefghijklmnopqrstu' },
      { kind: 'entity_rule', severity: 'error', message: 'x', global_id: '1abcdefghijklmnopqrst$' },
      { kind: 'entity_rule', severity: 'error', message: 'y', global_id: "x' or 1=1 --" },
      { kind: 'global_rule', severity: 'error', message: 'z' },
    ] };
    const table = validation.tableOf(rep);
    assert.deepEqual(table.columns.map((c) => c.name), ['kind', 'rule', 'severity', 'message', 'step_id', 'global_id', 'attribute']);
    assert.equal(table.rows.length, 4);
    assert.equal(table.rows[0][4], 12);
    assert.equal(table.rows[3][5], null);
    // Kontroll's vocabulary from 3.0.0: warnings only, two rulesets, error counts and the checks with rules that could not run.
    const two = validation.fromMetadata([entry('ifc_validation_status', 'warnings', 'string'), { name: 'ifc_validation_ruleset', value: ['A', 'B'], data_type: 'string' }]);
    assert.deepEqual([two.status, two.ruleset], ['warnings', 'A; B']);
    assert.equal(validation.badgeKind('warnings'), 'warn');
    assert.deepEqual(validation.counts({ issue_count: 12, error_count: 1, issues: [{ severity: 'warning' }] }), { findings: 12, errors: 1 }, 'the report\'s own counts go beyond its list');
    assert.deepEqual(validation.counts({ issues: [{ severity: 'warning' }, { severity: 'error' }, {}] }), { findings: 3, errors: 2 }, 'counted from the list when the report has no counts');
    assert.deepEqual(validation.checksOf({ checks: [{ name: 'gherkin', state: 'done', ruleset: 'R', issue_count: 4, rules_not_run: [{ rule: 'GEM004', error: 'x' }] }] }), [{ name: 'gherkin', state: 'done', ruleset: 'R', findings: 4, notRun: ['GEM004'] }]);
    // The IDS check (Kontroll 3.0.0): its documents and every specification's verdict, a document it could not read among the rules not run.
    const [ids] = validation.checksOf({ checks: [IDS_CHECK] });
    assert.deepEqual([ids.name, ids.findings, ids.notRun], ['ids', 1, ['trasig.ids']]);
    assert.deepEqual(ids.documents, [{ id: 'doc-ids', version: 2, title: 'krav.ids' }]);
    assert.deepEqual(ids.specifications.map((s) => [s.identifier, s.status, s.issues, s.document]), [['S1', 'passed', 0, 'krav.ids'], ['S2', 'failed', 1, 'krav.ids'], ['', 'not applicable', 0, 'krav.ids']]);
    assert.deepEqual(validation.specsSummary(ids), { documents: 1, total: 3, passed: 1, failed: 1, notApplicable: 1 });
    const [schema] = validation.checksOf({ checks: [{ name: 'schema', state: 'done', ruleset: 'R', issue_count: 0, rules_not_run: [], documents: [], specifications: [] }] });
    assert.equal(schema.specifications, undefined, 'the empty lists the server writes on a check that is not IDS are left out');
    assert.ok(validation.KINDS.includes('ids') && t('validation.kind.ids') !== 'validation.kind.ids', 'the kind ids has a name');
    assert.equal(validation.tableOf({ issues: [{ kind: 'gherkin', rule: 'IFC106', severity: 'warning', message: 'm' }] }).rows[0][1], 'IFC106');
    assert.deepEqual(validation.byKind(rep), [{ kind: 'entity_rule', n: 2 }, { kind: 'schema', n: 1 }, { kind: 'global_rule', n: 1 }]);
    assert.equal(validation.whereOf(rep), "id in (12) or guid in ('1abcdefghijklmnopqrst$')", 'a GlobalId that is not one stays out of the SQL');
    assert.equal(validation.whereOf({ issues: [{ kind: 'global_rule', message: 'z' }] }), null, 'errors that name no element mark nothing');
    assert.deepEqual(validation.lineOf(rep.issues[0]), { instance: '#12', cls: 'IfcWall', text: 'The attribute GlobalId should be unique' });
    assert.deepEqual(validation.localResult('ids', { summary: { specifications: 2, checks: 5, checks_pass: 4, checks_fail: 1 } }, { file: 'krav.ids' }), { file: 'krav.ids', specs: 2, checks: 5, pass: 4, fail: 1 });
    assert.deepEqual(validation.localResult('validate', { total: 7 }, { express: true }), { findings: 7, express: true });
    assert.equal(validation.badgeKind('passed'), 'ok');
    assert.equal(validation.badgeKind('pending'), '');
    return 'ok';
  });

  test('validation: metadata and report from the server, the report from the app\'s own address, and the words in the log', async (assert) => {
    connector = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dm-test-val', clientSecret: '' })).connector;
    await opencde.login(connector, { popup: fakePopup, redirectUri: REDIRECT });
    model = await opencde.importFile(connector, { project_id: PROJECT, name: 'Kontrollen' }, { filename: 'hus.ifc', reference: BASE + '/documents/1.0/documents/doc-ifc/versions/1/download', documentId: 'doc-ifc', versionIndex: 1, ifcProject: null, source: 'Documents API' });
    created.push(model.id);
    assert.equal(model.kind, 'model');
    assert.equal(model.source.cde.documentId, 'doc-ifc');
    const cols = await datasets.columns(model.id);
    const at = (name) => cols.findIndex((c) => c.name === name);
    world.walls = (await datasets.query(model.id, {})).filter((r) => /wall/i.test(String(r[at('typ')]))).map((r) => ({ id: Number(r[at('id')]), guid: String(r[at('guid')]) }));
    assert.ok(world.walls.length >= 3, 'walls in the model: ' + world.walls.length);
    const summary = validation.fromMetadata(await opencde.versionMetadata(connector, 'doc-ifc', 1));
    assert.equal(summary.status, 'issues');
    assert.equal(summary.issues, 4);
    world.asked = [];
    const rep = await opencde.validationReport(connector, 'doc-ifc', 1);
    assert.equal(rep.issue_count, 4);
    assert.deepEqual(world.asked, ['/documents/1.0/documents/doc-ifc/versions/1/ifc-validation'], 'the address is the app\'s own, not the one in the metadata');
    assert.equal(await opencde.validationReport(connector, 'doc-plain', 1), null, 'a version never checked has no report');
    assert.equal(validation.fromMetadata(await opencde.versionMetadata(connector, 'doc-plain', 1)), null, 'nor a summary');
    for (const [suffix, op] of [['metadata', 'metadata'], ['ifc-validation', 'ifc_validation']]) {
      const c = cdeLog.classify('GET', BASE + '/documents/1.0/documents/doc-ifc/versions/1/' + suffix);
      assert.deepEqual([c.api, c.operation], ['documents', op]);
      assert.ok(t('cdelog.op.documents.' + op) !== 'cdelog.op.documents.' + op, 'the log explains ' + op);
    }
    return 'ok';
  }, 60000);

  test('validation: the card in Hantera fetches the check, shows the errors, saves them as a table and marks the elements', async (assert) => {
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 3000, 'dataset');
      shell.activate('hantera');
      shell.store.set({ selectedId: model.id });
      const card = await waitFor(() => root.querySelector('[data-card="validation"]'), 5000, 'the card');
      world.asked = [];
      await wait(300);
      assert.ok(card.textContent.includes(t('validation.server.never')), 'nothing fetched before the user asks: ' + card.textContent);
      assert.equal(world.asked.length, 0, 'drawing the card asks the server nothing');
      /** @type {any} */ (card.querySelector('[data-validation-fetch]')).click();
      await waitFor(() => card.querySelector('[data-validation-status="issues"]'), 8000, 'the status');
      assert.ok(card.textContent.includes(t('validation.status.issues', { n: '4' })), card.textContent);
      assert.ok(card.textContent.includes('IfcOpenShell 0.9.0.post1') && card.textContent.includes('ifc-gherkin-rules 893f827'), 'both rulesets are shown');
      const kept = await validation.results(model.id);
      assert.equal(kept.server.status, 'issues');
      assert.ok(kept.server.at, 'when it was fetched');
      /** @type {any} */ (card.querySelector('[data-validation-report]')).click();
      await waitFor(() => card.querySelector('[data-validation-issues]'), 8000, 'the errors');
      assert.equal(card.querySelectorAll('[data-validation-issue]').length, 4);
      assert.ok(card.textContent.includes('The attribute GlobalId should be unique'), 'the rule in words');
      assert.ok(card.textContent.includes('#' + world.walls[0].id), 'the instance');
      assert.ok(card.querySelector('[data-validation-counts]').textContent.includes(t('validation.report.counts', { n: '4', errors: '3' })), 'findings and errors');
      const checks = card.querySelectorAll('[data-validation-checks] > li');
      assert.equal(checks.length, 3, 'the schema check, buildingSMART\'s rules and the project\'s IDS files');
      assert.ok(checks[1].textContent.includes(t('validation.check.gherkin')) && checks[1].textContent.includes('GEM004'), 'a rule that could not run is named: ' + checks[1].textContent);
      assert.ok(card.textContent.includes('IFC106'), 'the rule of a gherkin finding');
      // The IDS check: the verdicts counted, the failed specification by name, and the document that could not be read.
      assert.ok(checks[2].textContent.includes(t('validation.check.ids')) && checks[2].textContent.includes('trasig.ids'), checks[2].textContent);
      assert.equal(card.querySelectorAll('[data-validation-ids-specs]').length, 1, 'only the IDS check has specifications, though the server writes empty lists on every check');
      const specs = checks[2].querySelector('[data-validation-ids-specs]');
      assert.ok(specs && specs.textContent.includes(t('validation.ids.summary', { n: '3', docs: '1', passed: '1', failed: '1', na: '1' })), specs ? specs.textContent : 'no specifications');
      const failed = specs.querySelector('[data-validation-spec="S2"]');
      assert.ok(failed && failed.textContent === t('validation.ids.spec', { name: 'S2 Väggar har ljudklass', document: 'krav.ids', n: 1 }), failed ? failed.textContent : 'no failed specification');
      assert.ok(card.textContent.includes(t('validation.kind.ids')), 'the kind of the IDS finding');
      /** @type {any} */ (card.querySelector('[data-validation-table]')).click();
      const saved = await waitFor(() => shell.store.get().datasets.find((d) => d.source && d.source.cde && d.source.cde.kind === 'validation' && d.source.cde.modelId === model.id), 8000, 'the table');
      created.push(saved.id);
      assert.equal(saved.rowCount, 4);
      assert.deepEqual((await datasets.columns(saved.id)).map((c) => c.name), ['kind', 'rule', 'severity', 'message', 'step_id', 'global_id', 'attribute']);
      /** @type {any} */ (card.querySelector('[data-validation-mark]')).click();
      await waitFor(() => shell.store.get().mode === 'bearbeta', 5000, 'Bearbeta');
      const chosen = selection.get();
      assert.ok(chosen && chosen.datasetId === model.id, 'a selection on the model');
      assert.equal(chosen.rowids.length, 3, 'the three walls the errors name, one by its instance and two by their GlobalId');
      selection.clear();
    });
    return 'ok';
  }, 60000);

  test('validation: a check run here keeps its latest result, and the card opens the IDS check in Analysera', async (assert) => {
    await validation.record(model.id, 'schema', validation.localResult('validate', { total: 4 }));
    await validation.record(model.id, 'ids', validation.localResult('ids', { summary: { specifications: 1, checks: 6, checks_pass: 5, checks_fail: 1 } }, { file: 'krav.ids' }));
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === model.id), 3000, 'dataset');
      shell.activate('hantera');
      shell.store.set({ selectedId: model.id });
      const card = await waitFor(() => { const c = root.querySelector('[data-card="validation"]'); return c && c.textContent.includes('krav.ids') ? c : null; }, 5000, 'the card with the results');
      assert.ok(card.textContent.includes(t('validation.local.schema.result', { n: '4', date: '' }).replace(/[,\s]+$/, '')), card.textContent);
      assert.ok(card.textContent.includes(t('validation.local.ids.result', { file: 'krav.ids', pass: '5', checks: '6', date: '' }).replace(/[,\s]+$/, '')), card.textContent);
      /** @type {any} */ (card.querySelector('[data-validation-ids]')).click();
      await waitFor(() => root.querySelector('[data-ifc-ids-pick]'), 8000, 'the IDS check in Analysera');
      assert.equal(shell.store.get().mode, 'analysera');
      assert.equal(shell.store.get().openModelTool, null, 'the wish is taken once');
    });
    return 'ok';
  }, 60000);

  test('validation: cleanup', async () => {
    if (connector) { await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id); }
    for (const id of created) { await idb.deleteSetting(validation.PREFIX + id).catch(() => {}); await datasets.remove(id).catch(() => {}); }
    return 'ok';
  });
})();
