// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a new, empty digital comprehensive plan (data/plan-new, B-78): the settings and their defaults, the plan dataset with
 * the municipality's boundary from the boundaries that ship with the app (no network), its facts, side tables and coordinate
 * system, that data/plan-edit edits it and io/exporters/plan-delivery exports it as a delivery that comes back the same, and the
 * form in Inhämta, which creates the plan and opens it in Bearbeta with the AI panel in the mode Bygg från beskrivning.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const planNew = D.require('data/plan-new');
  const planEdit = D.require('data/plan-edit');
  const delivery = D.require('data/plan-delivery');
  const exporter = D.require('io/exporters/plan-delivery');
  const geo = D.require('data/geo');
  const made = [];
  const keep = (meta) => { made.push(meta.id); return meta; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, ms, label) { const t0 = performance.now(); for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('timeout waiting for ' + label); await wait(40); } }
  /** A square in SWEREF 99 TM as a WGS 84 polygon, as the plan keeps its areas. */
  const square = (e, n, side) => geo.toWgs84({ type: 'Polygon', coordinates: [[[e, n], [e + side, n], [e + side, n + side], [e, n + side], [e, n]]] }, 'EPSG:3006');
  const rowsOf = async (id) => { const hd = await datasets.ensureOpen(id); const r = await hd.engine.exec('select tema, innehallstyp, namn, geometrityp from data order by ordning, rowid'); return r[0] ? r[0].values : []; };

  test('plan new: the settings take SWEREF 99 TM and the defaults, and refuse a system or a code the app cannot use', async (assert) => {
    const s = planNew.settings({});
    assert.equal(s.crs, 'EPSG:3006'); assert.equal(s.name, t('newplan.default.name')); assert.equal(s.boundary, false, 'no boundary without a municipality');
    const k = planNew.settings({ kommun: 'Örebro', kommunkod: '1880', description: '  Växa längs stråket.\r\n' });
    assert.equal(k.name, t('newplan.default.name.kommun', { kommun: 'Örebro' })); assert.equal(k.boundary, true); assert.equal(k.description, 'Växa längs stråket.');
    assert.equal(planNew.settings({ crs: 'EPSG:3010' }).crs, 'EPSG:3010', 'a local zone');
    assert.equal(planNew.settings({ crs: 'SWEREF99 18 00' }).crs, 'EPSG:3011', 'a zone by its name');
    assert.equal(planNew.settings({ kommunkod: '1880', boundary: false }).boundary, false, 'the boundary may be left out');
    await assert.throws(() => planNew.settings({ crs: 'EPSG:4326' }), new RegExp(t('newplan.err.crs', { crs: 'EPSG:4326' }).slice(0, 20)));
    await assert.throws(() => planNew.settings({ kommunkod: '12' }), /12/);
    const list = await planNew.municipalities();
    assert.equal(list.length, 290, 'Sweden\'s municipalities'); assert.ok(list.some((m) => m.code === '1880' && m.name === 'Örebro'));
    return 'ok';
  });

  test('plan new: the plan has the municipality\'s boundary, its facts and empty side tables, and plan-edit and the delivery export take it', async (assert) => {
    const meta = keep(await planNew.create({ kommunkod: '1880', description: 'Kommunen ska växa längs stråket.' }));
    assert.equal(meta.kind, 'plan'); assert.equal(meta.name, t('newplan.default.name.kommun', { kommun: 'Örebro' }), 'the name from the municipality the code names');
    assert.equal(meta.source.kind, 'new'); assert.equal(meta.rowCount, 1, 'the plan boundary');
    const info = meta.plan;
    assert.equal(info.slag, 'oversiktsplan'); assert.equal(info.kommun, 'Örebro'); assert.equal(info.kommunkod, '1880'); assert.equal(info.crs, 'EPSG:3006');
    assert.equal(info.beskrivning, 'Kommunen ska växa längs stråket.'); assert.ok(/^[0-9a-f-]{36}$/.test(info.objektid), 'a new objektidentitet');
    assert.deepEqual(info.antal, { plangeometri: 1 });
    const rows = await rowsOf(meta.id);
    assert.equal(rows[0][0], 'plangeometri'); assert.equal(rows[0][2], 'Örebro'); assert.ok(/Polygon/.test(rows[0][3]), rows[0][3]);
    assert.deepEqual(await delivery.sectionsOf(meta.id), [], 'no sections yet, but the table is there');
    // Saved and read again, the plan keeps its facts.
    await datasets.flushSaves();
    assert.equal((await datasets.get(meta.id)).plan.kommun, 'Örebro');
    // Hand edits as for a delivered plan.
    const area = await planEdit.addArea(meta.id, { tema: 'markochvattenanvandning', geometry: square(512000, 6571000, 800), innehallstyp: 'Bostadsbebyggelse', namn: 'Norra Ängen' });
    const section = await planEdit.addSection(meta.id, { rubrik: 'Bostäder i Norra Ängen', text: 'Här byggs bostäder.', objekt: [area] });
    assert.equal(section.dokument, planEdit.DEFAULT_DOCUMENT, 'the plan description\'s document');
    // Exported as a delivery and read back: the same plan, areas and section.
    const built = await exporter.build(meta.id);
    assert.deepEqual(built.files.map((f) => f.role), ['plankarta', 'textdokument']);
    const blob = await exporter.toZip(meta.id);
    const back = keep(await delivery.importDelivery([new File([blob], 'ny-plan.zip', { type: 'application/zip' })], {}));
    assert.equal(back.plan.kommun, 'Örebro'); assert.equal(back.plan.kommunkod, '1880'); assert.equal(back.plan.objektid, info.objektid, 'the plan\'s identity');
    const sorted = (list) => list.map((r) => [r[0], r[1], r[2]]).sort((a, b) => a.join('|').localeCompare(b.join('|')));
    assert.deepEqual(sorted(await rowsOf(back.id)), [['markochvattenanvandning', 'Bostadsbebyggelse', 'Norra Ängen'], ['plangeometri', 'Plangeometri', 'Örebro']], 'the area and the plan boundary');
    const sections = await delivery.sectionsOf(back.id);
    assert.equal(sections.length, 1); assert.equal(sections[0].rubrik, 'Bostäder i Norra Ängen'); assert.equal(sections[0].objekt.length, 1, 'linked to the area');
    return 'ok';
  }, 60000);

  test('plan new: without a municipality the plan is empty, in the coordinate system chosen', async (assert) => {
    const meta = keep(await planNew.create({ name: 'Tom plan', crs: 'EPSG:3010' }));
    assert.equal(meta.name, 'Tom plan'); assert.equal(meta.rowCount, 0); assert.equal(meta.plan.crs, 'EPSG:3010'); assert.equal(meta.plan.kommun, '');
    assert.equal(meta.description, t('newplan.description', { crs: geo.crsText('EPSG:3010') }));
    return 'ok';
  });

  test('plan new: the form in Inhämta creates the plan and opens it in Bearbeta with the AI panel and the description', async (assert) => {
    if (typeof document === 'undefined') return 'ok';
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const item = await waitFor(() => Array.from(root.querySelectorAll('.dm-list-item')).find((x) => x.textContent.includes(t('import.sources.newplan'))), 5000, 'the source');
      /** @type {any} */ (item).click();
      const form = await waitFor(() => root.querySelector('[data-newplan-form]'), 3000, 'the form');
      assert.equal(/** @type {any} */ (form.querySelector('[data-newplan="crs"]')).value, 'EPSG:3006', 'SWEREF 99 TM by default');
      const kommun = /** @type {any} */ (await waitFor(() => { const el = /** @type {any} */ (root.querySelector('[data-newplan="kommun"]')); return el && el.options && el.options.length > 100 ? el : null; }, 5000, 'the municipalities'));
      kommun.value = '1880'; kommun.dispatchEvent(new Event('change'));
      await waitFor(() => root.querySelector('[data-newplan="boundary"]'), 3000, 'the boundary switch');
      const name = /** @type {any} */ (root.querySelector('[data-newplan="name"]'));
      name.value = 'Formulärplanen'; name.dispatchEvent(new Event('input'));
      const description = /** @type {any} */ (root.querySelector('[data-newplan="description"]'));
      description.value = 'Bostäder vid stationen.'; description.dispatchEvent(new Event('input'));
      /** @type {any} */ (root.querySelector('[data-newplan-create]')).click();
      const done = await waitFor(() => root.querySelector('[data-newplan-done]'), 10000, 'the plan is created');
      assert.ok(done.textContent.includes('Formulärplanen'));
      const meta = (await datasets.list()).find((m) => m.name === 'Formulärplanen');
      assert.ok(meta && meta.kind === 'plan' && meta.rowCount === 1 && meta.plan.kommunkod === '1880', 'the plan with its boundary'); made.push(meta.id);
      assert.ok(done.querySelector('[data-newplan-open]'), 'Öppna i Bearbeta');
      const build = /** @type {any} */ (done.querySelector('[data-newplan-build]'));
      assert.ok(build, 'Bygg planen med AI in BIM och GIS');
      build.click();
      const panel = await waitFor(() => root.querySelector('[data-plan-ai]'), 15000, 'the AI panel in the plan view');
      const question = /** @type {any} */ (await waitFor(() => panel.querySelector('[data-ai-question]'), 5000, 'the brief'));
      assert.equal(question.value, 'Bostäder vid stationen.', 'the description as the brief');
      assert.ok(panel.textContent.includes(t('plan.ai.title.build')), 'in the mode Bygg från beskrivning');
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
    return 'ok';
  }, 60000);

  test('plan new: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of made) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 30000);
})();
