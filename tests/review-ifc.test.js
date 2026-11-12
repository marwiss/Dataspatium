// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for personal data inside an IFC model before it leaves the app (Boverket 2023:4: a model handed to an authority becomes a
 * public record). The fixture with made-up people: the review finds the people, the organisation's addresses, the owner history,
 * the header's author, organisation and authoriser, the actor and the occupant, and the e-mail address and identity number in free
 * text (the app's own detectors, dm_personal_matches); the tables built from the file are not listed apart; the app's neutral
 * owner is nobody. Without Python the parts can only be kept, the dialog says why and starts Python on the button, and then
 * offers keep, pseudonymise or remove. With the wheel stubbed the copy is cleaned before the columns, its tables are built anew
 * from the cleaned file, selected rows follow their elements and a bundle carries the cleaned model, while the dataset stays.
 * With the real Pyodide (`?python=1` or cached components) IfcOpenShell removes and pseudonymises every part, the codes are those
 * of dm_hash with the same salt, the GlobalIds stay, and a removed copy has nothing left for the review to find.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const shareScan = D.require('data/share-scan');
  const review = D.require('ui/share/review');
  const model = D.require('data/model');
  const importer = D.require('io/import');
  const fixtures = D.require('tests/fixtures/ifc');
  const catalog = D.require('engines/python/catalog');
  const { bridge } = D.require('data/python-bridge');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wantReal = () => { try { return new URLSearchParams(location.search).get('python') === '1'; } catch (_e) { return false; } };
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  const track = (meta) => { created.push(meta.id); return meta; };
  const asText = (bytes) => new TextDecoder('latin1').decode(bytes);
  const rows = async (id, sql) => { const r = await (await datasets.ensureOpen(id)).engine.exec(sql); return r[0] ? r[0].values : []; };
  const reopen = async (bytes, name) => track(await datasets.importBytes(bytes instanceof ArrayBuffer ? bytes : bytes.slice().buffer, { name }, { quiet: true }));
  let people = null;
  async function thePeople() {
    if (!people) people = track(await importer.run(fixtures.ifcFile({ persons: true, name: 'personhus.ifc' }), { format: 'model' }, null, 'Personhuset'));
    return people;
  }
  const byId = (parts) => Object.fromEntries(parts.map((p) => [p.id, p]));
  /** The review's ctx: the names of the datasets and the app's dialog. */
  const ctxFor = (...metas) => ({ store: { get: () => ({ datasets: metas.map((m) => ({ id: m.id, name: m.name })) }) }, ui: { dialog: D.require('ui/overlays').dialog } });
  const openDialog = () => document.querySelector('dialog[open]');
  const lastButton = (dlg) => /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button button')).pop());
  const firstButton = (dlg) => /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button button'));

  test('review ifc: the app\'s detectors give the pieces of a text they recognise', async (assert) => {
    const ds = track(await datasets.create({ name: 'Bitar', columns: [{ name: 'a', type: 'text' }], rows: [['x']] }));
    const engine = (await datasets.ensureOpen(ds.id)).engine;
    const one = async (text) => { const r = await engine.exec('select dm_personal_matches(?)', [text]); return r[0].values[0][0]; };
    assert.deepEqual(JSON.parse(await one('Mejla anna@example.se, nummer 19121212-1212, rum 12345')), ['anna@example.se', '19121212-1212']);
    assert.equal(await one('Vägg 1.1 i rum 12345'), null, 'nothing personal, nothing listed');
    assert.equal(await one('19121212-1213'), null, 'a number that fails its check digit is no identity number');
    return 'ok';
  });

  test('review ifc: the people, addresses, owner history, header, actors and free text inside a model are found, and only kept without Python', async (assert) => {
    const ds = await thePeople();
    const state = bridge.state;
    try {
      bridge.state = 'idle';
      const found = await shareScan.inspect(ds.id);
      const parts = byId(found.parts);
      assert.deepEqual(found.parts.filter((p) => p.kind.startsWith('ifc.')).map((p) => p.id), ['ifc:persons', 'ifc:organizations', 'ifc:owner', 'ifc:header', 'ifc:actors', 'ifc:text'], 'every part, in order: ' + JSON.stringify(found.parts.map((p) => p.id)));
      assert.deepEqual(parts['ifc:persons'].names, ['Anna Andersson', 'Bo Berg', 'Cecilia Ek'], 'the people by name');
      assert.equal(parts['ifc:organizations'].count, 1);
      assert.ok(parts['ifc:organizations'].names[0].includes('info@arkitekt.example.se'), 'the organisation\'s address: ' + parts['ifc:organizations'].names[0]);
      assert.deepEqual(parts['ifc:owner'].names, ['Anna Andersson (Arkitektkontoret Test AB)', 'Testprogram 1.0'], 'the owning user and the application');
      assert.deepEqual(parts['ifc:header'].names, ['Anna Andersson', 'Arkitektkontoret Test AB', 'Bo Berg'], 'author, organisation and authoriser');
      assert.deepEqual(parts['ifc:actors'].names, ['Byggherre: Bo Berg (Arkitektkontoret Test AB)', 'Hyresgäst: Cecilia Ek']);
      assert.equal(parts['ifc:text'].count, 2, 'the wall\'s description and the type\'s property');
      assert.deepEqual(parts['ifc:text'].matches.slice().sort(), ['19121212-1212', 'bo.berg@example.se'], 'the pieces for IfcOpenShell');
      assert.ok(found.parts.filter((p) => p.kind.startsWith('ifc.')).every((p) => p.choices.length === 1 && p.choices[0] === 'keep' && p.start === 'keep' && p.needsPython), 'keep or stop without Python');
      // The tables are the file's: listing them apart, or the file as an original that cannot be cleaned, would say it twice.
      assert.ok(!found.parts.some((p) => p.kind === 'originals' || p.kind === 'side' || p.kind === 'text'), 'no table parts beside the file: ' + JSON.stringify(found.parts.map((p) => p.id)));
      assert.ok(!found.columns.some((f) => model.IFC_COLUMNS.some((c) => c.name === f.column)), 'nor the element columns');
      bridge.state = 'ready';
      const running = byId((await shareScan.inspect(ds.id)).parts);
      assert.deepEqual(running['ifc:persons'].choices, ['keep', 'hash', 'remove'], 'with Python: keep, pseudonymise or remove');
      assert.deepEqual(['persons', 'organizations', 'owner', 'header', 'actors', 'text'].map((k) => running['ifc:' + k].start), ['hash', 'remove', 'hash', 'remove', 'hash', 'remove'], 'where each starts');
    } finally { bridge.state = state; }
    // The fixture without people still names its maker; the app's own neutral owner and an empty header name nobody.
    const plain = track(await importer.run(fixtures.ifcFile({ name: 'vanligt.ifc' }), { format: 'model' }, null, 'Vanligt hus'));
    assert.deepEqual((await shareScan.inspect(plain.id)).parts.filter((p) => p.kind.startsWith('ifc.')).map((p) => p.id), ['ifc:persons', 'ifc:owner', 'ifc:header']);
    const neutralText = fixtures.ifcText({ name: 'neutralt.ifc' }).replace("IFCPERSON($,'Testare',$,$,$,$,$,$)", "IFCPERSON('user','User','',$,$,$,$,$)").replace("('Testare'),('Testbolaget')", "(''),('')");
    const neutral = track(await importer.run(new File([neutralText], 'neutralt.ifc'), { format: 'model' }, null, 'Neutralt hus'));
    assert.deepEqual((await shareScan.inspect(neutral.id)).parts.filter((p) => p.kind.startsWith('ifc.')), [], 'nothing to ask about');
    return 'ok';
  }, 60000);

  test('review ifc: the dialog says why there is only Behåll, starts Python on the button, then offers every choice; GitHub\'s warning lists the people', async (assert) => {
    const ds = await thePeople();
    const ctx = ctxFor(ds);
    const state = bridge.state; const start = bridge.start;
    let started = 0;
    bridge.start = async () => { started++; await wait(20); bridge.state = 'ready'; };
    try {
      bridge.state = 'idle';
      const asking = review.review(ctx, [ds.id]);
      const dlg = await waitFor(() => { const d = openDialog(); return d && d.querySelector('[data-review-ifc-python]') ? d : null; }, 8000, 'the review');
      assert.equal(dlg.querySelector('[data-review-ifc-python]').textContent, t('review.ifc.python'), 'it says why');
      const persons = /** @type {any} */ (dlg.querySelector('[data-review-ifc="persons"]'));
      assert.deepEqual(persons.options.map((o) => o.value), ['keep'], 'keep only');
      assert.ok(persons.textContent.includes('Anna Andersson'), 'the label names the people');
      assert.equal(started, 0, 'nothing started by opening the review');
      /** @type {HTMLElement} */ (dlg.querySelector('[data-review-ifc-start] button')).click();
      await waitFor(() => persons.options.length === 3, 5000, 'all choices');
      assert.equal(started, 1, 'Python started on the button');
      assert.equal(persons.value, 'hash', 'pseudonymised unless chosen otherwise');
      assert.equal(/** @type {any} */ (dlg.querySelector('[data-review-ifc="header"]')).value, 'remove');
      assert.equal(dlg.querySelector('[data-review-ifc-python]').textContent, t('review.ifc.started'));
      assert.ok(!dlg.querySelector('[data-review-ifc-start]'), 'the button is gone');
      const text = /** @type {any} */ (dlg.querySelector('[data-review-ifc="text"]'));
      text.value = 'hash';
      text.dispatchEvent(new Event('change', { bubbles: true }));
      const owner = /** @type {any} */ (dlg.querySelector('[data-review-ifc="owner"]'));
      owner.value = 'keep';
      owner.dispatchEvent(new Event('change', { bubbles: true }));
      lastButton(dlg).click();
      const res = await asking;
      const ifc = res.transform[ds.id].ifc;
      assert.deepEqual([ifc.persons, ifc.organizations, ifc.owner, ifc.header, ifc.actors, ifc.text], ['hash', 'remove', undefined, 'remove', 'hash', 'hash'], 'the choices, keep left out: ' + JSON.stringify(ifc));
      assert.deepEqual(ifc.matches.slice().sort(), ['19121212-1212', 'bo.berg@example.se'], 'the pieces of free text follow');
      assert.ok(shareScan.changes(res.transform[ds.id]), 'the copy changes');
      assert.ok(review.summary(res.transform).includes(t('review.applied.more', { n: 5 })), 'the log line counts the parts: ' + review.summary(res.transform));
      // Cancelling sends nothing.
      bridge.state = 'idle';
      const again = review.review(ctx, [ds.id]);
      firstButton(await waitFor(() => { const d = openDialog(); return d && d.querySelector('[data-review-ifc-python]') ? d : null; }, 8000, 'the review again')).click();
      assert.equal(await again, null, 'stopped');
      // A push to GitHub cannot change the copy: it lists what is inside the model and can be stopped.
      const warning = review.warn(ctx, [ds.id]);
      const w = await waitFor(openDialog, 8000, 'the warning');
      assert.ok(w.textContent.includes('Anna Andersson') && w.textContent.includes('IfcOwnerHistory'), w.textContent.slice(0, 200));
      firstButton(w).click();
      assert.equal(await warning, false);
    } finally {
      bridge.start = start; bridge.state = state;
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
    }
    return 'ok';
  }, 60000);

  test('review ifc: the copy is cleaned through the wheel first, its tables are built from the cleaned file, a bundle carries it, and the dataset stays', async (assert) => {
    const ds = await thePeople();
    const original = fixtures.ifcText({ persons: true, name: 'personhus.ifc' });
    // What the wheel would give back: the free text masked and the person coded.
    const cleaned = original.replace(/bo\.berg@example\.se|19121212-1212/g, '[***]').replace("'AA1','Andersson','Anna'", "'k0d','k0d',$");
    const calls = [];
    const real = bridge.runIfcScrub;
    bridge.runIfcScrub = async (bytes, options) => { calls.push({ size: bytes.byteLength, options }); return { bytes: new TextEncoder().encode(cleaned), info: {}, log: [] }; };
    try {
      const wall = (await rows(ds.id, "select rowid, guid from data where namn = 'Vägg 1.1'"))[0];
      const tr = { ifc: { persons: 'hash', owner: 'keep', text: 'remove' }, only: [wall[0]] };
      const copy = await reopen(await shareScan.copy(ds.id, tr), 'Rensad kopia');
      assert.equal(calls.length, 1, 'the wheel ran once');
      const sent = calls[0].options;
      assert.ok(calls[0].size > 1000, 'with the copy\'s SQLite file');
      assert.equal(sent.persons, 'hash'); assert.equal(sent.text, 'remove'); assert.ok(!('owner' in sent), 'a kept part is not sent');
      assert.deepEqual(sent.matches.slice().sort(), ['19121212-1212', 'bo.berg@example.se'], 'the pieces found again when the review gave none');
      assert.ok(/^[0-9a-f]{16}$/.test(sent.salt), 'a salt for the codes');
      const file = await model.original(copy.id);
      assert.equal(file.name, 'personhus.ifc', 'the file keeps its name');
      assert.ok(!asText(file.bytes).includes('bo.berg@example.se') && asText(file.bytes).includes('Kontakt [***]'), 'the copy\'s file is the cleaned one');
      assert.deepEqual(await rows(copy.id, 'select guid, beskrivning from data'), [[wall[1], 'Kontakt [***]']], 'the chosen element alone, from the cleaned file');
      assert.equal((await rows(copy.id, 'select count(*) from _log'))[0][0], 0, 'no change log follows');
      const whole = await reopen(await shareScan.copy(ds.id, { ifc: { text: 'remove', matches: ['bo.berg@example.se', '19121212-1212'] } }), 'Hel kopia');
      assert.deepEqual(await rows(whole.id, "select varde from _properties where namn = 'Ansvarig' limit 1"), [['Kontrollant [***]']], 'the properties come from the cleaned file too');
      assert.equal((await rows(whole.id, 'select count(*) from data'))[0][0], (await rows(ds.id, 'select count(*) from data'))[0][0], 'every element');
      // A bundle leaves through the same copy.
      const bundle = await D.require('data/workspace').bundle({ name: 'Modellpaket', datasetIds: [ds.id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false }, author: '', message: '', transform: { [ds.id]: { ifc: { persons: 'hash', text: 'remove' } } } });
      const entries = await D.require('platform/storage/zip').readZip(bundle.blob);
      const back = await reopen(entries[Object.keys(entries).find((x) => x.startsWith('datasets/'))], 'Från paketet');
      assert.ok(asText((await model.original(back.id)).bytes).includes("'k0d','k0d'"), 'the bundle carries the cleaned model');
      // The dataset itself is as it was.
      const mine = asText((await model.original(ds.id)).bytes);
      assert.ok(mine.includes('bo.berg@example.se') && mine.includes("'AA1','Andersson','Anna'"), 'the dataset\'s file is untouched');
      assert.deepEqual(await rows(ds.id, "select beskrivning from data where namn = 'Vägg 1.1'"), [['Kontakt bo.berg@example.se']]);
      // Everything kept: no wheel, no change.
      calls.length = 0;
      await shareScan.copy(ds.id, { ifc: { persons: 'keep' } });
      assert.equal(calls.length, 0, 'keep runs nothing');
      assert.ok(!shareScan.changes({ ifc: { persons: 'keep', header: 'keep' } }));
    } finally { bridge.runIfcScrub = real; }
    return 'ok';
  }, 60000);

  test('review ifc: IfcOpenShell removes and pseudonymises every part in the copy, with the codes of dm_hash, and keeps the GlobalIds', async (assert) => {
    if (!wantReal() && !(await catalog.cachedRuntime())) return 'skipped: Python components not cached (open the page with ?python=1 to fetch them, about 13 MB more for IfcOpenShell)';
    const ds = await thePeople();
    await bridge.start();
    await waitFor(() => bridge.state !== 'busy', 60000, 'Python free');
    const found = byId((await shareScan.inspect(ds.id)).parts);
    assert.deepEqual(found['ifc:persons'].choices, ['keep', 'hash', 'remove'], 'Python runs, so every choice is offered');
    const matches = found['ifc:text'].matches;
    const guids = (await rows(ds.id, 'select guid from data order by guid')).map((r) => r[0]);
    const parts = ['persons', 'organizations', 'owner', 'header', 'actors', 'text'];
    const all = (choice) => Object.assign(Object.fromEntries(parts.map((k) => [k, choice])), { matches });
    // Removed: nobody is left, and the review finds nothing in the copy.
    const gone = await reopen(await shareScan.copy(ds.id, { ifc: all('remove'), salt: 'testsalt' }), 'Utan personer');
    const goneText = asText((await model.original(gone.id)).bytes);
    for (const word of ['Andersson', 'anna.andersson@example.se', 'Testgatan', '+46 70', 'info@arkitekt', 'Bo Berg', 'Cecilia', 'bo.berg@example.se', '19121212-1212']) assert.ok(!goneText.includes(word), 'removed: ' + word);
    assert.ok(/FILE_NAME\('[^']*','[^']*',\(''\),\(''\),'[^']*','[^']*',''\)/.test(goneText), 'an empty header: ' + (goneText.match(/FILE_NAME[^;]*/) || [''])[0]);
    assert.ok(!/IFCOWNERHISTORY|IFCACTOR|IFCOCCUPANT/.test(goneText), 'no owner history, actor or occupant in IFC4');
    assert.ok(goneText.includes('Kontakt [***]') && goneText.includes('Kontrollant [***]'), 'the free text masked, the rest kept');
    assert.deepEqual((await rows(gone.id, 'select guid from data order by guid')).map((r) => r[0]), guids, 'every element with its GlobalId');
    assert.deepEqual((await shareScan.inspect(gone.id)).parts.filter((p) => p.kind.startsWith('ifc.')), [], 'nothing left to find');
    // Pseudonymised: codes in place of names, the same as dm_hash with the same salt.
    const coded = await reopen(await shareScan.copy(ds.id, { ifc: all('hash'), salt: 'testsalt' }), 'Pseudonymiserad');
    const codedText = asText((await model.original(coded.id)).bytes);
    const engine = (await datasets.ensureOpen(coded.id)).engine;
    const hash = async (v) => (await engine.exec("select dm_hash(?, 'testsalt', 16)", [v]))[0].values[0][0];
    for (const word of ['Andersson', 'anna.andersson@example.se', 'Testgatan', 'Bo Berg', 'Cecilia', 'bo.berg@example.se', '19121212-1212']) assert.ok(!codedText.includes(word), 'pseudonymised: ' + word);
    assert.ok(codedText.includes(`IFCPERSON('${await hash('AA1 Anna Andersson')}','${await hash('AA1 Anna Andersson')}',$`), 'the owner as a coded person');
    assert.ok(codedText.includes(`('${await hash('Anna Andersson')}'),('${await hash('Arkitektkontoret Test AB')}')`) && codedText.includes(`'${await hash('Bo Berg')}');`), 'the header coded');
    assert.ok(codedText.includes(`Kontakt ${await hash('bo.berg@example.se')}`), 'a piece of free text coded in place');
    assert.ok(codedText.includes(`'${await hash('info@arkitekt.example.se')}'`), 'the organisation\'s e-mail coded');
    assert.ok(codedText.includes('IFCOWNERHISTORY(') && codedText.includes("'Testprogram'"), 'the owner history stays, with its application');
    assert.deepEqual((await rows(coded.id, 'select guid from data order by guid')).map((r) => r[0]), guids, 'every GlobalId');
    // The dataset is as it was.
    assert.ok(asText((await model.original(ds.id)).bytes).includes('anna.andersson@example.se'), 'the dataset is untouched');
    return 'ok';
  }, 240000);

  test('review ifc: cleanup', async () => {
    for (const id of created) await datasets.remove(id, { quiet: true }).catch(() => {});
    return 'ok';
  });
})();
