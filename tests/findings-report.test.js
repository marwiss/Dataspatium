// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of the inspection report and the maintenance plan of a table of findings (decision F44 a, docgen/findings): the rule in the
 * template gives the year of each measure, data stays literal text in the Markdown, the table saved by Kontrollera med AI carries the
 * class, storey, building part, photos and the building's facts, the two templates render it by building part with the photos embedded
 * and everything escaped in HTML, Word and PDF, and Gör rapport and Gör underhållsplan, in the AI panel and in Kontrollera, open
 * Exportera › Dokument with the table and the template. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const fixtures = D.require('tests/fixtures/ifc');
  const checkTools = D.require('ai/check-tools');
  const aiCheck = D.require('ui/bearbeta/ai-check');
  const findings = D.require('docgen/findings');
  const markdown = D.require('docgen/markdown');
  const documents = D.require('docgen/documents');
  const generate = D.require('docgen/generate');
  const dsFiles = D.require('data/dataset-files');
  const zip = D.require('platform/storage/zip');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const press = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();
  /** A real JPEG, 40 × 30, that the browser can draw. */
  function jpeg() {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    const g = c.getContext('2d'); g.fillStyle = '#7a8b9c'; g.fillRect(0, 0, 40, 30); g.fillStyle = '#c0392b'; g.fillRect(5, 5, 10, 20);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }
  const NASTY = '<script>alert(1)</script> & *fet* a_b_c | [x](javascript:alert(1))';
  const state = { model: null, walls: [], table: null, made: [], docs: [] };
  const thisYear = new Date().getFullYear();

  test('findings report: the rule in the template gives the year of each measure, and data stays literal text', async (assert) => {
    const report = (await documents.list()).find((d) => d.id === findings.REPORT);
    const plan = (await documents.list()).find((d) => d.id === findings.PLAN);
    assert.ok(report && plan && report.findings && plan.findings && report.builtin && plan.builtin, 'two built-in templates marked for findings');
    assert.ok(report.name === t('doc.builtin.besiktning.name') && plan.name === t('doc.builtin.underhall.name'), 'named in the language of the app');
    assert.deepEqual(findings.parseRule(plan.body), { priority: { urgent: 0, high: 1, medium: 3, low: 5 }, condition: { critical: 0, poor: 1, fair: 3, good: 10 }, interval: 5 }, 'the plan states the default rule');
    assert.deepEqual(findings.parseRule('no tag'), findings.parseRule(plan.body), 'without the tag the default');
    // A level by its code or its word, with or without a colon and a unit.
    const rule = findings.parseRule(`{{#underhallsregel}}prioritet: ${t('ai.check.priority.high')}: 2 år, low 6; skick: poor 4, ${t('ai.check.condition.good')} 8; intervall: 10{{/underhallsregel}}`);
    assert.ok(rule.priority.high === 2 && rule.priority.low === 6 && rule.priority.urgent === 0 && rule.condition.poor === 4 && rule.condition.good === 8 && rule.interval === 10, JSON.stringify(rule));
    const base = findings.parseRule('');
    assert.deepEqual(findings.yearOf(base, { priority: 'high', condition: 'poor', date: '2026-05-03' }), { year: 2027, next: 2032 }, 'the inspection year plus the fewer years');
    assert.deepEqual(findings.yearOf(base, { priority: 'low', condition: 'critical', date: '2026-05-03' }), { year: 2026, next: 2031 }, 'a critical condition goes before a low priority');
    assert.deepEqual(findings.yearOf(rule, { priority: 'high', condition: 'poor', date: '2026-05-03' }), { year: 2028, next: 2038 }, 'the rule of the template');
    assert.deepEqual(findings.yearOf(base, { priority: 'medium', condition: null, date: null }), { year: thisYear + 3, next: thisYear + 8 }, 'without a date: this year');
    assert.deepEqual(findings.yearOf(base, { priority: 'soon', condition: 'bad', date: '2026-01-01' }), { year: null, next: null }, 'no known level, no year');
    // The building part: the climate declaration's layers from the class and the two properties.
    assert.equal(findings.layerOf('IfcWall', { IsExternal: 'true' }), 3, 'an external wall is the envelope');
    assert.equal(findings.layerOf('IfcWall', { LoadBearing: '.T.' }), 2, 'a load-bearing wall is the frame');
    assert.equal(findings.layerOf('IfcFooting'), 1);
    assert.equal(findings.layerOf('IfcPipeSegment'), 4);
    assert.equal(findings.layerOf(null), null);
    // Data never becomes markup: no heading, no emphasis, no link, no table cell split, no block token.
    const lit = markdown.literal;
    const ast = markdown.parse(`${lit('# ' + NASTY)}\n\n| a | b |\n|---|---|\n| ${lit('x | y')} | ${lit('_z_')} |\n\n${lit('1. one\u0000IMAGE:0\u0000')}\n`, { images: [{ png: new ArrayBuffer(8), width: 1, height: 1 }] });
    assert.deepEqual(ast.blocks.map((b) => b.type), ['paragraph', 'table', 'paragraph'], JSON.stringify(ast.blocks.map((b) => b.type)));
    assert.deepEqual(ast.blocks[0].runs, [{ text: '# ' + NASTY }], 'one plain run: ' + JSON.stringify(ast.blocks[0].runs));
    assert.deepEqual(ast.blocks[1].rows, [['x | y', '_z_']], 'an escaped pipe stays in its cell');
    assert.equal(markdown.plain(ast.blocks[2].runs), '1. oneIMAGE:0', 'a number is no list and NUL is dropped');
    assert.ok(markdown.parse('**fet** och *kursiv*').blocks[0].runs.some((r) => r.bold), 'markup in the template itself still works');
    return 'ok';
  });

  test('findings report: the saved table carries class, storey, building part, photos and the building, and the templates render it in HTML, Word and PDF', async (assert) => {
    state.model = await importer.run(fixtures.ifcFile({ walls: 2 }), { format: 'model' }, null, 'Rapporthus');
    const engine = (await datasets.ensureOpen(state.model.id)).engine;
    const r = await engine.exec("select id, guid, typ from data where namn in ('Vägg 1.1', 'Vägg 1.2') order by namn");
    state.walls = r[0].values.map(([id, guid, typ]) => ({ id: Number(id), guid: String(guid), typ: String(typ) }));
    const photo = { name: 'fasad_söder.jpg', mediaType: 'image/jpeg', data: jpeg(), when: '2026-05-03T10:15:00', where: { lat: 59.3293, lon: 18.0686 } };
    const collector = checkTools.create(state.model.id);
    await checkTools.call(collector, { photo: 1, element_id: state.walls[0].id, title: NASTY, description: 'Sprickan går\n# från sockeln.', condition: 'poor', priority: 'high', action: 'Laga putsen' }, { photos: [photo] });
    await checkTools.call(collector, { photo: null, element_id: state.walls[1].guid, title: 'Fuktfläck', description: 'Mörk fläck.', condition: 'fair', priority: 'medium', action: null }, { photos: [photo] });
    await checkTools.call(collector, { photo: null, element_id: null, title: 'Rost på räcket', description: '', condition: 'critical', priority: 'low', action: 'Byt räcket' }, { photos: [photo] });
    const errors = [];
    const check = aiCheck.create({}, { datasetId: state.model.id, findings: () => collector, render() {}, fail: (e) => errors.push(e), log() {} });
    state.table = await check.save();
    assert.ok(state.table && !errors.length, 'saved: ' + errors.map(String).join('; '));
    state.made.push(state.table.id);
    const meta = await datasets.get(state.table.id);
    assert.ok(findings.isFindings(meta) && meta.source.from === state.model.id, 'a table of findings from the model');
    assert.ok(meta.source.building && meta.source.building.byggnad === 'Testhuset' && meta.source.building.projekt === 'Testprojekt' && meta.source.building.vaningar === 'Plan 1, Plan 2', 'the building\'s facts: ' + JSON.stringify(meta.source.building));
    const rows = await datasets.query(state.table.id);
    const cols = (await datasets.columns(state.table.id)).map((c) => c.name);
    const at = (row, name) => row[cols.indexOf(name)];
    assert.ok(at(rows[0], 'ifc_klass') === state.walls[0].typ && at(rows[0], 'vaning') === 'Plan 1' && at(rows[0], 'byggdel') === 2 && at(rows[2], 'byggdel') === null, 'class, storey and part: ' + JSON.stringify(rows.map((x) => [at(x, 'ifc_klass'), at(x, 'byggdel')])));
    const stored = await dsFiles.list(state.table.id);
    assert.deepEqual(stored.map((f) => [f.name, f.type]), [['fasad_söder.jpg', 'image/jpeg']], 'the photo as the table\'s file');
    // Besiktningsrapport in HTML: the facts, the parts in order, the photo embedded, everything escaped.
    const report = await documents.get(findings.REPORT);
    const html = await (await generate.generate(report, state.table.id, 'html')).blob.text();
    assert.ok(html.includes('Testhuset') && html.includes(t('doc.findings.fact.projekt')) && html.includes('Testprojekt'), 'the building at the top');
    const parts = [t('climate.layer.2'), t('doc.findings.layer.none')].map((s) => html.indexOf(s));
    assert.ok(parts[0] > 0 && parts[1] > parts[0], 'by building part, the frame first and the finding without an element last');
    assert.ok(!html.includes('<script>alert') && html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; *fet* a_b_c | [x](javascript:alert(1))'), 'the title escaped and literal');
    assert.ok(!/href="javascript/i.test(html) && !html.includes('<em>fet</em>'), 'no link and no emphasis from data');
    assert.ok(/<img[^>]+src="data:image\/png;base64,/.test(html) && html.includes('fasad_söder.jpg'), 'the photo embedded with its name');
    assert.equal((html.match(/<img/g) || []).length, 1, 'one photo, none for the findings without one');
    assert.ok(html.includes(t('ai.check.condition.poor')) && html.includes(t('ai.check.priority.high')) && html.includes('Laga putsen'), 'condition, priority and action in words');
    assert.ok(html.includes('Sprickan går # från sockeln.'), 'the description on one line, no heading');
    assert.ok(!html.includes('59.3293') && !html.includes('59.32930'), 'the photo\'s position stays out of the template');
    // Underhållsplan: the years after the rule, in the schedule and per part.
    const plan = await documents.get(findings.PLAN);
    const planHtml = await (await generate.generate(plan, state.table.id, 'html')).blob.text();
    assert.ok(planHtml.includes('<table>') && planHtml.includes('<td>2027</td>') && planHtml.includes('<td>2032</td>'), 'high and poor on 2026-05-03: 2027, next check 2032');
    assert.ok(planHtml.includes(`<td>${thisYear + 3}</td>`) && planHtml.includes(`<td>${thisYear}</td>`), 'fair and medium three years on, critical this year');
    assert.ok(planHtml.indexOf('<td>' + thisYear + '</td>') < planHtml.indexOf('<td>' + (thisYear + 3) + '</td>'), 'the schedule in year order');
    // The person changes the rule in a copy of the template.
    const custom = await documents.save(Object.assign({}, plan, { id: null, builtin: false, name: 'Egen plan', body: plan.body.replace('high 1', 'high 4').replace('poor 1', 'poor 4') }));
    state.docs.push(custom.id);
    assert.ok(custom.findings, 'the copy stays a template for findings');
    const customHtml = await (await generate.generate(custom, state.table.id, 'html')).blob.text();
    const rowOf = (text, what) => (text.match(/<tr>.*?<\/tr>/g) || []).find((tr) => tr.includes(what)) || '';
    assert.ok(rowOf(planHtml, 'Laga putsen').includes('<td>2027</td>') && rowOf(customHtml, 'Laga putsen').includes('<td>2030</td>') && rowOf(customHtml, 'Laga putsen').includes('<td>2035</td>'), 'the changed rule moves the measure to 2030: ' + rowOf(customHtml, 'Laga putsen'));
    // Word and PDF with the photo.
    const docx = await generate.generate(report, state.table.id, 'docx');
    const entries = await zip.readZip(docx.blob);
    const xml = zip.text(entries['word/document.xml']);
    assert.ok(Object.keys(entries).some((n) => n.startsWith('word/media/')), 'the photo in the Word file');
    assert.ok(xml.includes('&lt;script') && xml.includes('&amp; *fet* a_b_c') && !xml.includes('<script>'), 'escaped in the XML');
    assert.ok(xml.includes(t('climate.layer.2')), 'the building part in Word');
    const pdf = await generate.generate(plan, state.table.id, 'pdf');
    assert.equal(pdf.blob.type, 'application/pdf');
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.blob.slice(0, 5).arrayBuffer())), '%PDF-');
    assert.ok(pdf.blob.size > 3000, 'pdf size ' + pdf.blob.size);
    return 'ok';
  }, 60000);

  test('findings report: Gör rapport in the AI panel and the card in Kontrollera open Exportera › Dokument with the table and the template', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const ctx = { store: shell.store, shell };
    const chosen = () => { const sel = /** @type {any} */ (root.querySelector('.dm-center .dm-form-grid dm-select')); return sel ? sel.value : ''; };
    let plain = null;
    try {
      // The AI panel's buttons: off without findings, on with them; the table is saved first, then reused while unchanged.
      const empty = checkTools.create(state.model.id);
      const none = aiCheck.create(ctx, { datasetId: state.model.id, findings: () => empty, render() {}, fail() {}, log() {} });
      const off = none.view();
      assert.ok(off.querySelector('[data-ai-check-report]') && /** @type {any} */ (off.querySelector('[data-ai-check-report]')).disabled && /** @type {any} */ (off.querySelector('[data-ai-check-plan]')).disabled, 'off without findings');
      const collector = checkTools.create(state.model.id);
      await checkTools.call(collector, { photo: null, element_id: state.walls[0].id, title: 'Spricka', description: '', condition: 'poor', priority: 'high', action: 'Laga' }, {});
      const check = aiCheck.create(ctx, { datasetId: state.model.id, findings: () => collector, render() {}, fail() {}, log() {} });
      const view = check.view();
      document.body.appendChild(view);
      try {
        const btn = /** @type {any} */ (view.querySelector('[data-ai-check-report]'));
        assert.ok(btn && !btn.disabled && btn.getAttribute('label') === t('ai.check.report') && view.querySelector('[data-ai-check-plan]').getAttribute('label') === t('ai.check.plan'), 'Gör rapport and Gör underhållsplan');
        await waitFor(() => btn.querySelector('button[data-tip]'), 2000, 'the tip');
        assert.equal(btn.querySelector('button').getAttribute('data-tip'), t('ai.check.report.hint'), 'with a tip');
        shell.activate('hantera');
        press(btn);
        await waitFor(() => shell.store.get().mode === 'exportera', 8000, 'Exportera opened');
        const id = shell.store.get().selectedId;
        assert.ok(id && id !== state.model.id && check.state.saved && check.state.saved.id === id, 'the new table is selected');
        state.made.push(id);
        await waitFor(() => chosen() === findings.REPORT, 8000, 'the report chosen');
        await waitFor(() => { const h1 = root.querySelector('.dm-doc-preview h1'); return h1 && h1.textContent.includes('Testhuset'); }, 20000, 'the preview of the report');
        assert.equal(shell.store.get().pendingDocument, null, 'the request is taken');
        shell.activate('hantera');
        assert.equal(await check.report('plan'), id, 'the same table again while the findings are unchanged');
        await waitFor(() => shell.store.get().mode === 'exportera' && chosen() === findings.PLAN, 8000, 'the plan chosen');
      } finally { view.remove(); }
      // Kontrollera: the card for a table of findings, none for another table.
      shell.store.set({ selectedId: state.table.id });
      shell.activate('kontrollera');
      const card = await waitFor(() => root.querySelector('.dm-center [data-kontrollera-report]'), 8000, 'the card');
      assert.ok(card.textContent.includes(t('kontrollera.report')) && card.querySelector('[data-kontrollera-report-open="report"]') && card.querySelector('[data-kontrollera-report-open="plan"]'), 'two buttons on the card');
      press(card.querySelector('[data-kontrollera-report-open="plan"]'));
      await waitFor(() => shell.store.get().mode === 'exportera' && shell.store.get().selectedId === state.table.id && chosen() === findings.PLAN, 8000, 'the plan with the table');
      plain = await datasets.create({ name: 'Vanlig tabell', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === plain.id), 3000, 'the table in the store');
      shell.store.set({ selectedId: plain.id });
      shell.activate('kontrollera');
      await waitFor(() => root.querySelector('.dm-center [data-kontrollera-summary]'), 8000, 'the table checked');
      assert.ok(!root.querySelector('.dm-center [data-kontrollera-report]'), 'no card for a table without findings');
      return 'ok';
    } finally {
      if (plain) await datasets.remove(plain.id).catch(() => {});
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 60000);

  test('findings report: cleanup', async (assert) => {
    for (const id of state.docs) await documents.remove(id).catch(() => {});
    for (const id of state.made) await datasets.remove(id).catch(() => {});
    if (state.model) await datasets.remove(state.model.id).catch(() => {});
    assert.ok(true);
  });
})();
