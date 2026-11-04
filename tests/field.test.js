// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for collecting in the field: a dataset's columns and rules become a form with no rows in it, the phone fills in rows
 * with position and photos and judges them like the computer does, a draft survives the page being dropped, and the rows
 * come back as a new version with the photos as an image collection and the positions on a map. Both ends run in this
 * page; position and camera are stubs, and no network is used.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const fieldForm = D.require('data/field-form');
  const collect = D.require('data/field-collect');
  const datasets = D.require('data/datasets');
  const rules = D.require('data/rules');
  const idb = D.require('platform/storage/idb');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function make(name, columns, rows) {
    const meta = await datasets.create({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows });
    created.push(meta.id);
    return meta;
  }
  const rowsOf = async (id, cols = '*') => { const h = await datasets.ensureOpen(id); const r = await h.engine.exec(`select ${cols} from data order by rowid`); return r[0] ? r[0].values : []; };
  /** A real JPEG of the given size, as a camera would hand it over. */
  async function photo(width, height, name = 'foto.jpg') {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, width, height); g.fillStyle = '#ffffff'; g.fillRect(10, 10, width / 2, height / 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return new File([blob], name, { type: 'image/jpeg' });
  }
  const POSITION = { coords: { latitude: 63.8258, longitude: 20.263, accuracy: 7.6 }, timestamp: Date.parse('2026-06-01T10:00:00Z') };
  const geolocation = (result = POSITION) => ({ getCurrentPosition(ok, bad) { setTimeout(() => (result.code ? bad(result) : ok(result)), 0); } });

  /** A form for a small inventory, from a dataset with a rule of each kind that matters here. */
  async function inventory(name = 'Inventering') {
    const meta = await make(name, [['plats', 'text'], ['antal', 'integer'], ['matt', 'number'], ['datum', 'date'], ['ok', 'boolean'], ['anteckning', 'text']], [['Hemlig plats Ö', 3, 1.5, '2026-01-02', 1, 'x']]);
    await rules.add(meta.id, { type: 'notnull', column: 'plats' });
    await rules.add(meta.id, { type: 'range', column: 'antal', min: 0, max: 100 });
    await rules.add(meta.id, { type: 'regex', column: 'plats', pattern: '^[A-ZÅÄÖ]' });
    await rules.add(meta.id, { type: 'completeness', column: 'matt', threshold: 0.5 });
    return meta;
  }
  async function phone(root, options = {}) {
    const mobile = D.require('mobile/app');
    return mobile.start(root, Object.assign({ hash: '', geolocation: geolocation() }, options));
  }
  function mount(width = 360) {
    const root = document.createElement('div');
    root.style.cssText = `position:absolute; left:-10000px; width:${width}px; height:800px;`;
    document.body.appendChild(root);
    return root;
  }
  /** The form package kept on the phone, as if a computer had sent it. */
  async function deliver(app, form) {
    const mobile = D.require('mobile/app');
    const pack = await fieldForm.packForm(form);
    const meta = await mobile.keep(pack.blob, pack.name, 'Datorn');
    app.state.bundles = await mobile.listBundles();
    await app.field.adopt(meta);
    return (await mobile.listBundles()).find((b) => b.kind === 'form' && b.form.id === form.id);
  }
  async function cleanPhone(app, form) {
    const mobile = D.require('mobile/app');
    if (form) { for (const r of await idb.getSetting('mobile.field.rows.' + form.id, []) || []) for (const p of r.photos || []) await idb.deleteBlob('mfield:' + p.name); await idb.setSetting('mobile.field.rows.' + form.id, []); await idb.setSetting('mobile.field.draft.' + form.id, null); }
    if (app) app.destroy();
    for (const b of await mobile.listBundles()) await mobile.removeBundle(b.id);
  }
  const input = (root, name) => /** @type {any} */ (root.querySelector(`[data-field="${name}"]`));
  function type(root, name, value) {
    const el = input(root, name);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'DM-SELECT' ? 'change' : 'input', { bubbles: true }));
  }
  const press = (root, label) => {
    const b = Array.from(root.querySelectorAll('dm-button')).find((x) => x.getAttribute('label') === label);
    if (!b) throw new Error('no button: ' + label);
    /** @type {HTMLElement} */ (b.querySelector('button')).click();
  };

  test('field: a dataset becomes a form with fields, choices and rules, and no rows leave with it', async (assert) => {
    const meta = await inventory('Formulärets källa');
    const handle = await datasets.ensureOpen(meta.id);
    const kod = handle.columns.find((c) => c.name === 'ok');
    assert.equal(kod.type, 'boolean');
    const form = await collect.formFor(meta.id);
    assert.deepEqual(form.fields.map((f) => f.name), ['plats', 'antal', 'matt', 'datum', 'ok', 'anteckning']);
    assert.ok(form.fields.find((f) => f.name === 'anteckning').long, 'a note gets several lines');
    const compiled = await collect.compile(meta.id, form);
    assert.ok(compiled.fields.find((f) => f.name === 'plats').required, 'a not-null rule makes the field required');
    assert.equal(compiled.rules.length, 2, 'range and pattern go to the phone');
    assert.ok(compiled.rules.every((r) => r.sql && r.text && !r.text.includes('{')), 'as the same SQL, with a readable text');
    assert.equal(compiled.leftToComputer.length, 1, 'a rule about the whole table stays on the computer');
    // A column switched off is not asked for, and a rule about it stays behind.
    const without = JSON.parse(JSON.stringify(form));
    without.fields.find((f) => f.name === 'antal').include = false;
    const smaller = await collect.compile(meta.id, without);
    assert.ok(!smaller.fields.some((f) => f.name === 'antal') && smaller.rules.length === 1 && smaller.leftToComputer.length === 2);
    // The package holds the form and nothing from the rows.
    const pack = await collect.packageForm(meta.id, form);
    const read = await fieldForm.readPackage(pack.blob);
    assert.equal(read.kind, fieldForm.FORM_KIND);
    const text = JSON.stringify(read.manifest);
    assert.ok(!text.includes('Hemlig plats'), 'no values from the rows');
    assert.deepEqual(Object.keys(read.entries), [fieldForm.MANIFEST], 'one file only');
    // The form is kept in the dataset, follows it through a reload, and follows its columns.
    await datasets.flushSaves();
    datasets.close(meta.id);
    const again = await collect.formFor(meta.id);
    assert.equal(again.id, form.id, 'the same form after a reload');
    const reopened = await datasets.ensureOpen(meta.id);
    await reopened.engine.run('alter table data add column ny text');
    const ctx = D.require('data/operations').makeContext(reopened.engine, reopened.columns);
    ctx.addColumn({ name: 'ny', type: 'text', label: 'ny' });
    await datasets.writeColumns(reopened, ctx.columns);
    const grown = await collect.formFor(meta.id);
    assert.equal(grown.fields.find((f) => f.name === 'ny').include, false, 'a new column joins switched off');
    return 'ok';
  }, 30000);

  test('field: value labels and an allowed-values rule become choices, and an empty dataset can be started from a list', async (assert) => {
    const meta = await make('Med etiketter', [['kon', 'integer'], ['typ', 'text']], [[1, 'a']]);
    const handle = await datasets.ensureOpen(meta.id);
    const ctx = D.require('data/operations').makeContext(handle.engine, handle.columns);
    ctx.column('kon').valueLabels = { labels: [[1, 'Kvinna'], [2, 'Man']] };
    await datasets.writeColumns(handle, ctx.columns);
    await rules.add(meta.id, { type: 'inset', column: 'typ', values: 'Ek; Tall; Gran' });
    const compiled = await collect.compile(meta.id, await collect.formFor(meta.id));
    assert.deepEqual(compiled.fields[0].options, [{ value: 1, label: 'Kvinna' }, { value: 2, label: 'Man' }]);
    assert.deepEqual(compiled.fields[1].options.map((o) => o.value), ['Ek', 'Tall', 'Gran']);
    const view = D.require('ui/field/field-view');
    assert.equal(view.optionsText(compiled.fields[0].options), '1 = Kvinna\n2 = Man');
    assert.deepEqual(view.parseOptions('1 = Kvinna\n2 = Man', 'integer'), compiled.fields[0].options);
    assert.deepEqual(view.parseOptions('Ek\nTall', 'text').map((o) => o.label), ['Ek', 'Tall']);
    const empty = await collect.createEmpty('Ny insamling', `plats\nantal: ${t('type.integer').toLowerCase()}\nmatt: number\ndatum: date\nnote: med kolon: text`);
    created.push(empty.id);
    const cols = await datasets.columns(empty.id);
    assert.deepEqual(cols.slice(0, 4).map((c) => c.type), ['text', 'integer', 'number', 'date']);
    assert.equal(empty.rowCount, 0);
    let message = '';
    try { await collect.createEmpty('Tom', '  \n '); } catch (err) { message = err.message; }
    assert.equal(message, t('field.err.nocolumns'));
    return 'ok';
  }, 20000);

  test('field: values are read as the column type, and a row is checked before it is kept', async (assert) => {
    const number = { name: 'n', type: 'number' };
    assert.equal(fieldForm.coerce(number, '1 234,5').value, 1234.5, 'decimal comma and space');
    assert.equal(fieldForm.coerce(number, '12.5').value, 12.5);
    assert.ok(fieldForm.coerce(number, 'tolv').error);
    assert.ok(fieldForm.coerce({ name: 'i', type: 'integer' }, '1,5').error, 'not an integer');
    assert.equal(fieldForm.coerce({ name: 'i', type: 'integer' }, '15').value, 15);
    assert.equal(fieldForm.coerce({ name: 'd', type: 'date' }, '2026-02-28').value, '2026-02-28');
    assert.ok(fieldForm.coerce({ name: 'd', type: 'date' }, '2026-02-30').error, 'no such day');
    assert.equal(fieldForm.coerce({ name: 'b', type: 'boolean' }, 'false').value, false);
    assert.equal(fieldForm.coerce({ name: 'b', type: 'boolean' }, '').value, null, 'not answered is not no');
    const coded = { name: 'k', type: 'integer', options: [{ value: 1, label: 'A' }, { value: 2, label: 'B' }] };
    assert.equal(fieldForm.coerce(coded, '2').value, 2, 'a code keeps its type');
    assert.ok(fieldForm.coerce(coded, '3').error, 'not one of the choices');
    const form = { fields: [{ name: 'plats', type: 'text', required: true }, { name: 'ok', type: 'boolean', required: true }], position: 'required', photo: 'required' };
    const bad = fieldForm.validate(form, { plats: '  ', ok: '' }, {});
    assert.deepEqual(Object.keys(bad.errors).sort(), ['__photo', '__position', 'ok', 'plats']);
    const fine = fieldForm.validate(form, { plats: ' Umeå ', ok: 'false' }, { position: { lat: 1, lon: 2 }, photos: 1 });
    assert.ok(fine.ok);
    assert.deepEqual(fine.values, { plats: 'Umeå', ok: false });
    return 'ok';
  });

  test('field: the phone judges a row by the same rules as the computer', async (assert) => {
    const rows = [['Umeå', 5, 7, '901 87', '19121212-1212'], ['umeå', 500, 2, '90187', '19121212-1213'], ['Luleå', 1, 1, 'x', null], ['Kiruna', 5, 9, '981 31', '191212121212'], [null, null, null, null, null]];
    const meta = await make('Regellikhet', [['plats', 'text'], ['antal', 'integer'], ['max', 'integer'], ['post', 'text'], ['pnr', 'text']], rows);
    const added = [
      await rules.add(meta.id, { type: 'regex', column: 'plats', pattern: '^[A-ZÅÄÖ]' }),
      await rules.add(meta.id, { type: 'range', column: 'antal', min: 0, max: 100 }),
      await rules.add(meta.id, { type: 'compare', column: 'antal', operator: 'le', column2: 'max' }),
      await rules.add(meta.id, { type: 'format', column: 'post', format: 'se_postnr' }),
      await rules.add(meta.id, { type: 'identifier', column: 'pnr', kind: 'se_pnr' }),
      await rules.add(meta.id, { type: 'length', column: 'plats', min: 2, max: 5 }),
      await rules.add(meta.id, { type: 'not_in', column: 'plats', values: 'Luleå' }),
    ];
    const form = await collect.compile(meta.id, Object.assign(await collect.formFor(meta.id), { position: 'off', photo: 'off' }));
    assert.equal(form.rules.length, added.length, 'all seven go to the phone');
    const sqlite = D.require('engines/sqlite');
    const engine = new sqlite.SqliteEngine();
    await engine.start();
    await engine.open();
    try {
      const checker = await fieldForm.createChecker(engine, form);
      const handle = await datasets.ensureOpen(meta.id);
      for (const rule of added) {
        const v = rules.violation(rule, handle.columns, {});
        const res = await handle.engine.exec(`select plats, antal, max, post, pnr from data where ${v.sql}`, v.params);
        const onComputer = (res[0] ? res[0].values : []).map((r) => JSON.stringify(r)).sort();
        const onPhone = [];
        for (const row of rows) {
          const values = { plats: row[0], antal: row[1], max: row[2], post: row[3], pnr: row[4] };
          const broken = await checker.check(values);
          if (broken.some((x) => x.id === rule.id)) onPhone.push(JSON.stringify(row));
        }
        assert.deepEqual(onPhone.sort(), onComputer, `the same rows break ${rule.type}`);
      }
      // A uniqueness rule compares with the rows already on the phone; a rule that cannot run here is left to the computer.
      const local = Object.assign({}, form, { rules: [{ id: 'u', text: 'unik', sql: rules.violation({ type: 'unique', column: 'plats' }, []).sql, params: [] }, { id: 'x', text: 'fel', sql: 'nosuchcolumn = 1', params: [] }] });
      const second = new sqlite.SqliteEngine();
      await second.start(); await second.open();
      const checker2 = await fieldForm.createChecker(second, local);
      assert.deepEqual((await checker2.check({ plats: 'Umeå' }, [{ plats: 'Umeå' }])).map((r) => r.id), ['u']);
      assert.deepEqual((await checker2.check({ plats: 'Piteå' }, [{ plats: 'Umeå' }])).map((r) => r.id), []);
      second.terminate();
    } finally { engine.terminate(); }
    return 'ok';
  }, 30000);

  test('field: on the phone a row is filled in with position and photos, and rules stop it once', async (assert) => {
    const meta = await inventory('På telefonen');
    const form = await collect.compile(meta.id, Object.assign(await collect.formFor(meta.id), { instructions: 'Räkna träden', position: 'required', photo: 'optional' }));
    form.fields.find((f) => f.name === 'datum').sticky = true;
    const root = mount();
    // The test page has no mobile styles of its own; without them nothing below says how the phone page looks.
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('../src/mobile/mobile.css', location.href).href;
    await new Promise((resolve, reject) => { sheet.onload = resolve; sheet.onerror = reject; document.head.appendChild(sheet); });
    let app = null;
    try {
      app = await phone(root);
      const bundle = await deliver(app, form);
      app.render();
      assert.ok(root.textContent.includes(form.title), 'the form is listed on the start page');
      assert.ok(!Array.from(root.querySelectorAll('.dm-m-card')).some((c) => c.textContent.includes(t('mobile.received.title')) && c.textContent.includes(form.title)), 'not among received files');
      await app.field.open(bundle);
      assert.equal(app.state.screen, 'field');
      assert.ok(root.textContent.includes('Räkna träden'), 'the instructions are shown');
      press(root, t('field.row.add'));
      await waitFor(() => input(root, 'plats'), 2000, 'the row form');
      assert.equal(app.state.screen, 'fieldrow');
      const position = await waitFor(() => { const el = root.querySelector('[data-position]'); return el && el.textContent.includes('63') ? el : null; }, 2000, 'the position');
      assert.ok(position.textContent.includes('8'), 'with its accuracy rounded: ' + position.textContent);
      // Nothing filled in: the required field stops it and says so at the field.
      press(root, t('field.save.next'));
      await waitFor(() => Array.from(root.querySelectorAll('.dm-field-error')).some((e) => !e.hidden && e.textContent === t('field.err.required')), 2000, 'the required message');
      assert.equal((await D.require('mobile/field').loadRows(form.id)).length, 0, 'nothing kept');
      // Wrong type at the field; a rule stops it once and says which.
      type(root, 'plats', 'umeå');
      type(root, 'antal', 'många');
      input(root, 'antal').dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => Array.from(root.querySelectorAll('.dm-field-error')).some((e) => !e.hidden && e.textContent === t('field.err.number')), 2000, 'the number message');
      type(root, 'antal', '500');
      type(root, 'matt', '1,5');
      type(root, 'datum', '2026-06-01');
      type(root, 'ok', 'true');
      press(root, t('field.save.next'));
      await waitFor(() => app.field.edit && app.field.edit.broken.length === 2, 5000, 'two rules broken');
      const shown = Array.from(root.querySelectorAll('.dm-field-error')).filter((e) => !e.hidden).map((e) => e.textContent);
      assert.ok(shown.length >= 2, 'the rule texts are at the fields: ' + shown.join(' | '));
      assert.equal((await D.require('mobile/field').loadRows(form.id)).length, 0, 'still nothing kept');
      // A photo larger than the form allows is scaled before it is stored.
      await app.field.addPhotos([await photo(3000, 2000)]);
      const img = /** @type {HTMLImageElement} */ (await waitFor(() => root.querySelector('.dm-m-photo img'), 3000, 'the thumbnail'));
      await waitFor(() => img.naturalWidth > 0, 3000, 'the picture decoded');
      assert.equal(img.naturalWidth, 2048, 'scaled to the long side');
      assert.equal(img.naturalHeight, Math.round(2000 * 2048 / 3000));
      assert.ok(img.getBoundingClientRect().width > 40, 'shown at a size that can be seen: ' + img.getBoundingClientRect().width);
      // The second press keeps it, with the rules noted.
      press(root, t('field.save.next'));
      await waitFor(() => app.field.edit && app.field.edit.broken.length === 2 && app.field.edit.accept, 3000, 'still asking after the change');
      press(root, t('field.save.next'));
      await waitFor(() => app.field.rows.length === 1, 5000, 'kept');
      const row = app.field.rows[0];
      assert.equal(row.values.antal, 500); assert.equal(row.values.matt, 1.5); assert.equal(row.values.ok, true);
      assert.equal(row.warnings.length, 2, 'the broken rules are noted');
      assert.equal(row.position.lat, POSITION.coords.latitude);
      assert.equal(row.photos.length, 1);
      // The next row keeps what the form says should stay.
      await waitFor(() => input(root, 'datum') && app.field.edit && app.field.edit.id !== row.id, 2000, 'the next row');
      assert.equal(input(root, 'datum').value, '2026-06-01', 'a sticky field stays');
      assert.equal(input(root, 'plats').value, '', 'others start empty');
      // A narrow phone: nothing runs off the side, and everything can be hit with a finger.
      assert.ok(root.scrollWidth <= root.clientWidth + 1, `no sideways scrolling: ${root.scrollWidth} > ${root.clientWidth}`);
      for (const el of Array.from(root.querySelectorAll('.dm-m-actions dm-button > button, .dm-m-main input, .dm-m-main select'))) {
        if (el.getBoundingClientRect().height) assert.ok(el.getBoundingClientRect().height >= 44, `at least 44 px: ${el.outerHTML.slice(0, 80)} ${el.getBoundingClientRect().height}`);
      }
      return 'ok';
    } finally { await cleanPhone(app, form); root.remove(); sheet.remove(); }
  }, 45000);

  test('field: a draft and its photos survive the page being dropped when the camera opens', async (assert) => {
    const meta = await inventory('Utkast');
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    const root = mount();
    let app = null;
    try {
      app = await phone(root);
      const bundle = await deliver(app, form);
      await app.field.open(bundle);
      press(root, t('field.row.add'));
      await waitFor(() => input(root, 'plats'), 2000, 'the row form');
      type(root, 'plats', 'Vindeln');
      await app.field.addPhotos([await photo(800, 600)]);
      const id = app.field.edit.id;
      const stored = app.field.edit.photos[0].name;
      await waitFor(async () => { const d = await idb.getSetting('mobile.field.draft.' + form.id, null); return d && d.raw.plats === 'Vindeln' && d.photos.length === 1; }, 3000, 'the draft');
      // The phone drops the page: a new app starts from what is stored.
      app.destroy();
      root.textContent = '';
      app = await phone(root);
      await app.field.open(app.field.forms()[0]);
      assert.ok(Array.from(root.querySelectorAll('dm-button')).some((b) => b.getAttribute('label') === t('field.draft.resume')), 'the page offers to carry on');
      press(root, t('field.draft.resume'));
      await waitFor(() => input(root, 'plats'), 2000, 'the draft again');
      assert.equal(input(root, 'plats').value, 'Vindeln');
      assert.equal(app.field.edit.id, id, 'the same row');
      await waitFor(() => root.querySelector('.dm-m-photo img'), 3000, 'the photo again');
      // Saving ends the draft; discarding a new one removes its photos.
      press(root, t('common.save'));
      await waitFor(() => app.state.screen === 'field', 3000, 'saved');
      assert.equal(await idb.getSetting('mobile.field.draft.' + form.id, null), null, 'no draft left');
      assert.ok(await idb.loadBlob('mfield:' + stored), 'the photo stays with the row');
      press(root, t('field.row.add'));
      await waitFor(() => input(root, 'plats'), 2000, 'a new row');
      await app.field.addPhotos([await photo(300, 200)]);
      const dropped = app.field.edit.photos[0].name;
      const discarding = app.field.discardRow();
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the question');
      /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button button')).pop()).click();
      await discarding;
      assert.equal(await idb.loadBlob('mfield:' + dropped), null, 'its photo is gone');
      // A sent row can no longer be changed here.
      await app.field.markSent(form.id, [app.field.rows[0].id]);
      assert.ok(app.field.rows[0].sentAt);
      app.field.openRow(app.field.rows[0]);
      assert.equal(app.state.screen, 'field', 'stays on the list');
      return 'ok';
    } finally { await cleanPhone(app, form); root.remove(); }
  }, 30000);

  test('field: a position that cannot be had says why, and does not stop a row when it is optional', async (assert) => {
    const meta = await inventory('Utan position');
    const form = await collect.compile(meta.id, Object.assign(await collect.formFor(meta.id), { position: 'optional', photo: 'off' }));
    const root = mount();
    let app = null;
    try {
      app = await phone(root, { geolocation: geolocation({ code: 1 }) });
      const bundle = await deliver(app, form);
      await app.field.open(bundle);
      press(root, t('field.row.add'));
      await waitFor(() => { const el = root.querySelector('[data-position]'); return el && el.textContent === t('field.position.denied'); }, 2000, 'the reason');
      assert.ok(!Array.from(root.querySelectorAll('dm-button')).some((b) => b.getAttribute('label') === t('field.photo.add')), 'no photos asked for');
      type(root, 'plats', 'Robertsfors');
      press(root, t('common.save'));
      await waitFor(() => app.field.rows.length === 1, 3000, 'kept without a position');
      assert.equal(app.field.rows[0].position, null);
      return 'ok';
    } finally { await cleanPhone(app, form); root.remove(); }
  }, 20000);

  /** Rows as the phone packs them, without going through its screens. */
  async function packageOf(form, list, device = 'Fältmobil') {
    const photos = new Map();
    const rows = [];
    for (const item of list) {
      const shots = [];
      for (const [i, file] of (item.photos || []).entries()) { const name = `${item.id}-${i + 1}.jpg`; photos.set(name, await file.arrayBuffer()); shots.push({ name, size: file.size, type: file.type }); }
      rows.push({ id: item.id, createdAt: item.createdAt || '2026-06-01T10:00:00.000Z', values: item.values, position: item.position || null, photos: shots, warnings: item.warnings || [] });
    }
    return fieldForm.packRows(form, rows, async (name) => photos.get(name) || null, { device });
  }

  test('field: rows come back as a new version, the photos as an image collection, the positions on a map', async (assert) => {
    const leaflet = D.require('viz/leaflet');
    const meta = await inventory('Tillbaka på datorn');
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    const before = (await rowsOf(meta.id)).length;
    const list = [
      { id: 'rad_a', values: { plats: 'Umeå', antal: 3, matt: 1.5, datum: '2026-06-01', ok: true, anteckning: 'Första' }, position: { lat: 63.8258, lon: 20.263, accuracy: 7.6 }, photos: [await photo(1000, 800, 'a.jpg')] },
      { id: 'rad_b', values: { plats: 'Luleå', antal: 4, matt: null, datum: null, ok: false, anteckning: null }, position: { lat: 65.5848, lon: 22.1547, accuracy: 12 } },
      { id: 'rad_c', values: { plats: 'kiruna', antal: 500, matt: 2, datum: null, ok: null, anteckning: null }, warnings: ['x'] },
    ];
    const first = await fieldForm.readPackage((await packageOf(form, list)).blob);
    assert.equal(first.kind, fieldForm.ROWS_KIND);
    const plan = await collect.plan(first);
    assert.equal(plan.target.id, meta.id, 'it finds its dataset');
    assert.equal(plan.rows.length, 3); assert.equal(plan.positions, 2); assert.equal(plan.photos.length, 1); assert.equal(plan.flagged, 1); assert.equal(plan.duplicates, 0);
    const res = await collect.apply(plan);
    created.push(res.imagesId);
    assert.equal(res.rows, 3); assert.equal(res.photos, 1);
    assert.equal(res.broken, 2, 'the rules are run on the result: the pattern and the range break');
    const rows = await rowsOf(meta.id, 'plats, antal, matt, ok, falt_id, lat, lon, noggrannhet_m, foto, insamlad, insamlad_av');
    assert.equal(rows.length, before + 3);
    const a = rows[before];
    assert.equal(a[0], 'Umeå'); assert.equal(a[1], 3); assert.equal(a[2], 1.5); assert.equal(a[3], 1);
    assert.equal(a[4], 'rad_a'); assert.equal(a[5], 63.8258); assert.equal(a[6], 20.263); assert.equal(a[7], 8, 'accuracy in whole metres');
    assert.equal(a[8], 'rad_a-1.jpg'); assert.ok(String(a[9]).startsWith('2026-06-01'), 'when: ' + a[9]); assert.equal(a[10], 'Fältmobil');
    assert.equal(rows[before + 1][3], 0, 'no is not empty');
    assert.equal(rows[before + 2][3], null, 'not answered stays empty');
    assert.equal(rows[before + 2][5], null, 'no position stays empty');
    // The table as it was is kept as a version.
    const versions = await datasets.listVersions(meta.id);
    assert.equal(versions.length, 1);
    assert.equal(versions[0].rowCount, before, 'the version before the rows');
    // The positions are on a map, drawn for real.
    const columns = await datasets.columns(meta.id);
    assert.ok(leaflet.mapDefault(columns), 'the table opens as a map');
    // The photos are an image collection with the row's position, time and device.
    const album = await datasets.ensureOpen(res.imagesId);
    assert.equal(album.meta.kind, 'images');
    assert.equal(album.meta.name, t('field.images.name', { name: 'Tillbaka på datorn' }));
    const shot = (await rowsOf(res.imagesId, 'fil, lon, lat, datum, kamera, bredd, hojd'))[0];
    assert.equal(shot[0], 'rad_a-1.jpg'); assert.equal(shot[1], 20.263); assert.equal(shot[2], 63.8258); assert.equal(shot[4], 'Fältmobil'); assert.equal(shot[5], 1000); assert.equal(shot[6], 800);
    assert.ok(String(shot[3]).startsWith('2026-06-01'), 'the time of the row');
    assert.ok(leaflet.mapDefault(await datasets.columns(res.imagesId)), 'the collection has positions too');
    const files = D.require('data/dataset-files');
    assert.ok(await files.read(res.imagesId, 'rad_a-1.jpg', 'thumb'), 'with a thumbnail');
    // The same package again adds nothing.
    const replay = await collect.plan(await fieldForm.readPackage((await packageOf(form, list)).blob));
    assert.equal(replay.rows.length, 0); assert.equal(replay.duplicates, 3);
    // The next delivery joins the same collection.
    const next = await collect.plan(await fieldForm.readPackage((await packageOf(form, [list[0], { id: 'rad_d', values: { plats: 'Piteå', antal: 1 }, position: { lat: 65.3, lon: 21.5, accuracy: 3 }, photos: [await photo(500, 400, 'd.jpg')] }])).blob));
    assert.equal(next.rows.length, 1); assert.equal(next.duplicates, 1);
    const res2 = await collect.apply(next);
    assert.equal(res2.imagesId, res.imagesId, 'the same image collection');
    assert.equal((await rowsOf(res.imagesId, 'fil')).length, 2);
    const reloaded = await datasets.ensureOpen(res.imagesId);
    assert.equal(reloaded.meta.images.count, 2);
    assert.equal((await datasets.listVersions(meta.id)).length, 2);
    const handle = await datasets.ensureOpen(meta.id);
    assert.equal(handle.meta.field.imports.length, 2, 'each delivery is noted');
    assert.equal(handle.meta.field.imports[1].rows, 1);
    return 'ok';
  }, 45000);

  test('field: rows for a dataset that is gone can start a new one, and a large collection travels in parts', async (assert) => {
    const meta = await inventory('Borttagen');
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    await datasets.remove(meta.id);
    const pack = await fieldForm.readPackage((await packageOf(form, [{ id: 'rad_x', values: { plats: 'Ny plats', antal: 2 }, position: { lat: 60, lon: 15, accuracy: 5 } }])).blob);
    const plan = await collect.plan(pack);
    assert.equal(plan.target, null);
    const res = await collect.apply(plan, { name: 'Återskapad' });
    created.push(res.datasetId);
    const out = await datasets.get(res.datasetId);
    assert.equal(out.name, 'Återskapad'); assert.equal(out.rowCount, 1);
    const big = (n) => ({ id: 'r' + n, photos: [{ name: 'p' + n, size: 60 * 1024 * 1024 }] });
    const parts = fieldForm.batches([big(1), big(2), big(3), big(4), big(5)]);
    assert.deepEqual(parts.map((p) => p.length), [2, 2, 1], 'no package over the limit, no row split');
    return 'ok';
  }, 20000);

  /** The application as the user has it, for what happens on the computer. */
  async function withShell(fn) {
    const root = mount(1400);
    root.style.height = '900px';
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally { for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close(); root.remove(); }
  }

  test('ui: Insamling i fält in Inhämta edits the form, shows what leaves, and hands it to Enheter', async (assert) => {
    const meta = await inventory('Från Inhämta');
    await withShell(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('inhamta');
      const item = await waitFor(() => Array.from(root.querySelectorAll('.dm-list-item')).find((b) => b.textContent.includes(t('field.source'))), 3000, 'the source');
      item.click();
      const row = await waitFor(() => root.querySelector('.dm-field-row[data-field="antal"]'), 5000, 'the fields');
      assert.ok(root.textContent.includes(t('field.about')), 'says what it is for');
      // Switch one column off, make one required, and give one its choices.
      const sw = /** @type {any} */ (row.querySelector('dm-switch'));
      sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      assert.ok(row.querySelector('.dm-stack-sm').hidden, 'its settings fold away');
      const plats = root.querySelector('.dm-field-row[data-field="plats"]');
      const boxes = plats.querySelector('dm-input[type="textarea"]');
      /** @type {any} */ (boxes).value = 'Umeå\nLuleå';
      boxes.dispatchEvent(new Event('input', { bubbles: true }));
      // What leaves is shown first.
      let saved = null;
      const files = D.require('platform/files');
      const real = files.download;
      files.download = (blob, name) => { saved = { blob, name }; };
      try {
        const buttons = () => Array.from(root.querySelectorAll('dm-button'));
        /** @type {HTMLElement} */ (buttons().find((b) => b.getAttribute('label') === t('field.save.file')).querySelector('button')).click();
        const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the review');
        assert.ok(dlg.textContent.includes('plats') && !dlg.textContent.includes('antal'), 'lists what goes: ' + dlg.textContent.slice(0, 120));
        assert.ok(dlg.textContent.includes('Umeå, Luleå'), 'with the choices');
        /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('.dm-dialog-actions dm-button button')).pop()).click();
        await waitFor(() => saved, 3000, 'the file');
        assert.ok(saved.name.endsWith('.formular.zip'), saved.name);
        const read = await fieldForm.readPackage(saved.blob);
        assert.ok(!read.manifest.form.fields.some((f) => f.name === 'antal'));
        assert.deepEqual(read.manifest.form.fields.find((f) => f.name === 'plats').options.map((o) => o.value), ['Umeå', 'Luleå']);
        // Send to the phone goes through Enheter with the form ready to send.
        await waitFor(() => !document.querySelector('dialog[open]'), 2000, 'closed');
        /** @type {HTMLElement} */ (buttons().find((b) => b.getAttribute('label') === t('field.send.phone')).querySelector('button')).click();
        const dlg2 = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the review again');
        /** @type {HTMLElement} */ (Array.from(dlg2.querySelectorAll('.dm-dialog-actions dm-button button')).pop()).click();
        const pick = await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => /** @type {any} */ (s).options && /** @type {any} */ (s).options.some((o) => o.value === 'pending')), 5000, 'the form in Enheter');
        assert.equal(/** @type {any} */ (pick).value, 'pending', 'chosen already');
        assert.equal(shell.store.get().mode, 'dela');
      } finally { files.download = real; shell.store.set({ devicesPending: null }); }
    });
    return 'ok';
  }, 45000);

  test('ui: a package from the field is shown before anything is added, through the same door as bundles', async (assert) => {
    const share = D.require('ui/share/bundle');
    const meta = await inventory('Genom Ta emot');
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    const before = (await rowsOf(meta.id)).length;
    await withShell(async (shell) => {
      const ctx = shell.ctx;
      const pack = await packageOf(form, [{ id: 'rad_p', values: { plats: 'Skellefteå', antal: 2 }, position: { lat: 64.75, lon: 20.95, accuracy: 4 }, photos: [await photo(600, 400, 'p.jpg')] }]);
      const file = new File([pack.blob], pack.name, { type: 'application/zip' });
      const opening = share.receiveFile(ctx, file);
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the question');
      assert.ok(dlg.textContent.includes('Genom Ta emot'), 'names the dataset');
      assert.ok(dlg.textContent.includes('Fältmobil'), 'names the phone');
      assert.equal((await rowsOf(meta.id)).length, before, 'nothing added yet');
      const buttons = dlg.querySelectorAll('.dm-dialog-actions dm-button');
      assert.equal(buttons[buttons.length - 1].getAttribute('label'), t('field.receive.add', { n: 1 }));
      /** @type {HTMLElement} */ (buttons[buttons.length - 1].querySelector('button')).click();
      const res = await opening;
      created.push(res.imagesId);
      assert.equal((await rowsOf(meta.id)).length, before + 1, 'added');
      assert.equal(shell.store.get().selectedId, meta.id, 'and chosen');
      // The same file again has nothing new.
      const again = share.receiveFile(ctx, file);
      const dlg2 = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the second question');
      assert.ok(dlg2.textContent.includes(t('field.receive.nothing', { n: 1 })), dlg2.textContent.slice(0, 120));
      /** @type {HTMLElement} */ (dlg2.querySelector('.dm-dialog-actions dm-button button')).click();
      assert.equal(await again, null);
      // A form opened on a computer says where it belongs.
      const formPack = await fieldForm.packForm(form);
      const opened = share.receiveFile(ctx, new File([formPack.blob], formPack.name, { type: 'application/zip' }));
      const dlg3 = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the form message');
      assert.ok(dlg3.textContent.includes(form.title));
      /** @type {HTMLElement} */ (dlg3.querySelector('.dm-dialog-actions dm-button button')).click();
      assert.equal(await opened, null);
    });
    return 'ok';
  }, 45000);

  test('ui: collected positions are drawn on the map in Bearbeta', async (assert) => {
    const meta = await make('Kartpunkter', [['plats', 'text']], []);
    const handle = await datasets.ensureOpen(meta.id);
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    const pack = await fieldForm.readPackage((await packageOf(form, [
      { id: 'k1', values: { plats: 'Umeå' }, position: { lat: 63.82, lon: 20.26, accuracy: 5 } },
      { id: 'k2', values: { plats: 'Luleå' }, position: { lat: 65.58, lon: 22.15, accuracy: 5 } },
    ])).blob);
    await collect.apply(await collect.plan(pack));
    assert.equal(handle.meta.rowCount, 2);
    await withShell(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in store');
      shell.store.set({ selectedId: meta.id });
      shell.activate('bearbeta');
      const canvas = /** @type {HTMLCanvasElement} */ (await waitFor(() => root.querySelector('.dm-map-view.leaflet-container .leaflet-overlay-pane canvas'), 8000, 'the map'));
      const width = canvas.getBoundingClientRect().width;
      assert.ok(Math.abs(width - parseFloat(canvas.style.width)) < 1, `the layer is as wide on screen as its own width: ${width}`);
      const painted = () => { const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; for (let i = 3; i < data.length; i += 4) if (data[i]) return true; return false; };
      await waitFor(painted, 3000, 'painted points');
    });
    return 'ok';
  }, 30000);

  test('mobile: a form travels to the phone and the rows back over the direct connection', async (assert) => {
    const p2p = D.require('platform/p2p');
    const meta = await inventory('Direkt');
    const form = await collect.compile(meta.id, await collect.formFor(meta.id));
    const root = mount();
    let app = null; let computer = null;
    try {
      computer = p2p.offer();
      await waitFor(() => computer.offerPayload, 10000, 'offer');
      const certB = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' });
      app = await phone(root, { hash: '#o=' + computer.offerPayload, certificate: certB });
      await waitFor(() => app.state.session && app.state.session.answerCode, 10000, 'answer code');
      await computer.acceptAnswer(app.state.session.answerCode);
      await waitFor(() => computer.state === 'connected' && app.state.session.state === 'connected' && computer.peerInfo && app.state.session.peerInfo, 15000, 'connected');
      const pack = await fieldForm.packForm(form);
      const sending = computer.send([{ name: pack.name, type: 'application/zip', data: pack.blob, kind: 'field-form' }]);
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 8000, 'incoming dialog');
      /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === t('mobile.incoming.accept')).querySelector('button')).click();
      assert.equal((await sending).confirmed.length, 1);
      const bundle = await waitFor(() => app.field.forms()[0], 8000, 'the form kept');
      assert.equal(bundle.kind, 'form');
      assert.equal(bundle.form.title, form.title);
      await app.field.open(bundle);
      press(root, t('field.row.add'));
      await waitFor(() => input(root, 'plats'), 2000, 'the row form');
      type(root, 'plats', 'Vännäs');
      await app.field.addPhotos([await photo(640, 480)]);
      press(root, t('common.save'));
      await waitFor(() => app.field.rows.length === 1, 5000, 'kept');
      // What arrives on the computer is the package the computer can read.
      const arrived = new Promise((resolve) => computer.on('item', resolve));
      computer.on('offer', (o) => o.accept());
      await app.field.send();
      const item = await arrived;
      await waitFor(() => app.field.rows[0].sentAt, 8000, 'marked as sent once the computer has it');
      const read = await fieldForm.readPackage(item.blob);
      assert.equal(read.kind, fieldForm.ROWS_KIND);
      assert.equal(read.manifest.rows[0].values.plats, 'Vännäs');
      assert.equal(read.manifest.rows[0].photos.length, 1);
      assert.ok(read.entries[fieldForm.PHOTO_DIR + read.manifest.rows[0].photos[0].name], 'with the photo');
      assert.equal(read.manifest.form.rules, undefined, 'the rules stay behind');
      return 'ok';
    } finally {
      if (computer) computer.close();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      await cleanPhone(app, form);
      for (const p of await p2p.peers()) await p2p.forget(p.id);
      root.remove();
    }
  }, 60000);

  test('mobile: the page keeps what it needs for use without a network when a service worker is there', async (assert) => {
    const field = D.require('mobile/field');
    if (location.protocol === 'file:') {
      assert.equal(await field.prepareOffline(), 'local', 'from a folder the files are already here');
      return 'file://: nothing to keep';
    }
    const url = new URL('src/mobile/mobile.css', new URL('../', location.href)).href;
    const state = await field.prepareOffline({ urls: [url], wait: 5000 });
    if (state === 'pending' && !navigator.serviceWorker.controller) return 'no service worker in control of this page';
    assert.equal(state, 'ready');
    assert.ok(await caches.match(url), 'in the cache');
    return 'ok';
  }, 20000);

  test('mobile: the real phone page starts from its own file list, runs a form, and keeps all it used for use without a network', async (assert) => {
    if (location.protocol === 'file:') return 'file://: the phone page runs from a web address';
    const meta = await inventory('På den riktiga sidan');
    const form = await collect.compile(meta.id, Object.assign(await collect.formFor(meta.id), { photo: 'optional', position: 'optional' }));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute; left:-10000px; width:360px; height:800px; border:0;';
    frame.src = new URL('../m/index.html', location.href).href;
    document.body.appendChild(frame);
    let app = null;
    try {
      const win = await waitFor(() => { const w = /** @type {any} */ (frame.contentWindow); return w && w.Dataspatium && w.Dataspatium.mobile ? w : null; }, 30000, 'the phone page');
      const doc = frame.contentDocument;
      assert.ok(doc.querySelector('.dm-m'), 'it drew its start page');
      assert.ok(!win.Dataspatium.has('ui/modes/inhamta'), 'with the phone file list, not the whole app');
      app = win.Dataspatium.mobile;
      const mobileApp = win.Dataspatium.require('mobile/app');
      // Packed on the phone page: a Blob from this window is not a Blob there.
      const pack = await win.Dataspatium.require('data/field-form').packForm(JSON.parse(JSON.stringify(form)));
      const kept = await mobileApp.keep(pack.blob, pack.name, 'Datorn');
      assert.equal(kept.kind, 'form');
      app.state.bundles = await mobileApp.listBundles();
      await app.field.adopt(kept);
      const state = await waitFor(() => app.field.offline, 30000, 'getting ready').catch((err) => { throw new Error(`${err.message}: engine ${!!app.field.engine}, controller ${!!win.navigator.serviceWorker.controller}, files ${win.performance.getEntriesByType('resource').length}`); });
      await app.field.open(app.field.forms()[0]);
      press(doc, t('field.row.add'));
      await waitFor(() => input(doc, 'plats'), 3000, 'the row form');
      // Measured with the page's own styles, at the width of a phone.
      assert.ok(doc.documentElement.scrollWidth <= win.innerWidth + 1, `no sideways scrolling: ${doc.documentElement.scrollWidth} > ${win.innerWidth}`);
      for (const el of Array.from(doc.querySelectorAll('.dm-m-actions dm-button > button, .dm-m-main input, .dm-m-main select'))) {
        if (el.getBoundingClientRect().height) assert.ok(el.getBoundingClientRect().height >= 44, `at least 44 px: ${el.outerHTML.slice(0, 80)} ${el.getBoundingClientRect().height}`);
      }
      if (state === 'pending' && !win.navigator.serviceWorker.controller) return 'no service worker in control of the page';
      assert.equal(state, 'ready', 'it says it is ready');
      const urls = win.performance.getEntriesByType('resource').map((e) => e.name).filter((url) => url.startsWith(location.origin));
      assert.ok(urls.some((url) => /sql/i.test(url)), 'SQLite was fetched for the rules');
      for (const url of urls) assert.ok(await caches.match(url), 'kept: ' + url);
      assert.ok(await caches.match(frame.src), 'and the page itself');
      return `${urls.length} files kept`;
    } finally {
      if (app) { await idb.setSetting('mobile.field.draft.' + form.id, null); const mobileApp = frame.contentWindow.Dataspatium.require('mobile/app'); app.destroy(); for (const b of await mobileApp.listBundles()) await mobileApp.removeBundle(b.id); }
      frame.remove();
    }
  }, 90000);

  test('field: cleanup', async (assert) => {
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
