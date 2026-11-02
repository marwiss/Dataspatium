// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for document generation: template context and Mustache rendering, table and chart tags, the
 * Markdown parser, the HTML/Markdown/LaTeX/DOCX/PDF builders, built-in and saved templates, batch
 * generation and the Dokument tab in Exportera.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const template = D.require('docgen/template');
  const markdown = D.require('docgen/markdown');
  const builders = D.require('docgen/builders');
  const office = D.require('docgen/builders-office');
  const documents = D.require('docgen/documents');
  const generate = D.require('docgen/generate');
  const charts = D.require('viz/charts');
  const builder = D.require('viz/vega-builder');
  const zip = D.require('platform/storage/zip');
  const t = D.require('ui/i18n').t;
  const created = []; const chartIds = []; const docIds = [];
  let id = null;
  const NBSP = ' ';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { if (fn()) return; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const CSV = 'kommun;lan;ar;befolkning\nStockholm;Stockholms län;2023;984748\nGöteborg;Västra Götalands län;2023;596841\nMalmö;Skåne län;2023;362133\nStockholm;Stockholms län;2024;995574\nGöteborg;Västra Götalands län;2024;608993\nMalmö;Skåne län;2024;365644\n';

  test('docgen: test dataset and a saved chart', async () => {
    const meta = await importer.run(new File([CSV], 'dok.csv'), {}, [
      { name: 'kommun', type: 'text', include: true }, { name: 'lan', type: 'text', include: true }, { name: 'ar', type: 'integer', include: true }, { name: 'befolkning', type: 'integer', include: true }], 'Doktest');
    id = meta.id; created.push(id);
    const columns = await datasets.columns(id);
    const chart = charts.create('vega', meta, 'Doktest-diagram');
    chart.vega.state = builder.defaultState('bar', columns);
    const saved = await charts.save(chart); chartIds.push(saved.id);
    return 'dataset ' + id;
  });

  test('docgen: context and Mustache rendering with Swedish numbers and no HTML escaping', async (assert) => {
    const ctx = await template.buildContext(id);
    assert.equal(ctx.datamangd, 'Doktest'); assert.equal(ctx.antal_rader, '6'); assert.equal(ctx.kolumner.length, 4);
    assert.equal(ctx.summor.befolkning, '3' + NBSP + '913' + NBSP + '933');
    assert.equal(ctx.storsta.befolkning, '995' + NBSP + '574');
    const res = await template.renderTemplate('# {{datamangd}}\n\n{{#rader}}- {{kommun}} {{ar}}: {{befolkning}}\n{{/rader}}\nSumma {{summor.befolkning}} & klart <b>', ctx);
    assert.ok(res.text.includes('- Stockholm 2' + NBSP + '023: 984' + NBSP + '748') || res.text.includes('- Stockholm 2023: 984' + NBSP + '748'), res.text.slice(0, 200));
    assert.ok(res.text.includes('& klart <b>'), 'Mustache does not HTML-escape');
    const grp = await template.buildContext(id, { group: { column: 'kommun', value: 'Malmö' } });
    assert.equal(grp.antal_rader, '2'); assert.equal(grp.grupp, 'Malmö'); assert.equal(grp.gruppkolumn, 'kommun');
    const cb = await template.codebookContext(id);
    assert.equal(cb.kolumner.length, 4); assert.equal(cb.kolumner[0].unika, '3'); assert.ok('dubbletter' in cb);
  });

  test('docgen: table and chart tags are resolved into blocks', async (assert) => {
    const spec = template.parseTableSpec('kolumner: kommun, befolkning; sortera: befolkning fallande; topp: 2; filter: ar = 2024 och kommun != Malmö; rubrik: Störst');
    assert.deepEqual(spec.kolumner, ['kommun', 'befolkning']); assert.deepEqual(spec.sortera, { col: 'befolkning', dir: 'desc' }); assert.equal(spec.topp, 2); assert.equal(spec.filter.length, 2); assert.equal(spec.filter[1].op, '!='); assert.equal(spec.rubrik, 'Störst');
    assert.deepEqual(template.parseChartOptions(' | bredd: 600 | hojd: 300'), { bredd: 600, hojd: 300 });
    const ctx = await template.buildContext(id);
    const res = await template.renderTemplate('Intro\n{{#tabell}}kolumner: kommun, befolkning; sortera: befolkning fallande; topp: 2; filter: ar = 2024{{/tabell}}\n{{#tabell}}kalla: kolumner{{/tabell}}\n{{diagram "Doktest-diagram" | bredd: 400}}\n{{diagram "Finns inte"}}\n{{sidbrytning}}\nSlut', ctx);
    assert.equal(res.tables.length, 2);
    assert.deepEqual(res.tables[0].rows[0], ['Stockholm', '995' + NBSP + '574']); assert.equal(res.tables[0].rows.length, 2); assert.deepEqual(res.tables[0].numeric, [false, true]);
    assert.equal(res.tables[1].rows.length, 4);
    assert.ok(res.images[0].png && res.images[0].png.byteLength > 500 && res.images[0].width > 100, 'chart rendered ' + JSON.stringify([res.images[0].width, res.images[0].height, res.images[0].error]));
    assert.ok(res.images[1].error && res.images[1].error.includes('Finns inte'), 'missing chart reported');
    const ast = markdown.parse(res.text, res);
    assert.deepEqual(ast.blocks.map((b) => b.type), ['paragraph', 'table', 'table', 'image', 'paragraph', 'pagebreak', 'paragraph']);
  }, 30000);

  test('docgen: markdown subset parses headings, inline runs, lists, tables and rules', (assert) => {
    const ast = markdown.parse('# Rubrik\n\nText med **fet** och *kursiv* och `kod` och [länk](https://x.se).\n\n- a\n- b\n\n1. ett\n2. två\n\n| k | v |\n|---|---:|\n| x | 1 |\n\n---\n## Under\nSista raden\nfortsätter');
    const [h1, p, ul, ol, table, rule, h2, last] = ast.blocks;
    assert.equal(h1.type, 'heading'); assert.equal(h1.level, 1); assert.equal(markdown.plain(h1.runs), 'Rubrik');
    assert.ok(p.runs.some((r) => r.bold && r.text === 'fet') && p.runs.some((r) => r.italic && r.text === 'kursiv') && p.runs.some((r) => r.code && r.text === 'kod') && p.runs.some((r) => r.link === 'https://x.se'), JSON.stringify(p.runs));
    assert.ok(ul.type === 'list' && !ul.ordered && ul.items.length === 2);
    assert.ok(ol.type === 'list' && ol.ordered && ol.items.length === 2);
    assert.ok(table.type === 'table' && table.columns.length === 2 && table.rows[0][1] === '1' && table.numeric[1] === true, JSON.stringify(table));
    assert.equal(rule.type, 'rule'); assert.equal(h2.level, 2); assert.equal(markdown.plain(last.runs), 'Sista raden fortsätter');
    assert.equal(markdown.title(ast), 'Rubrik');
  });

  test('docgen: HTML, Markdown, LaTeX, DOCX and PDF builders escape and structure the content', async (assert) => {
    const ast = markdown.parse('# Titel & test\n\nStycke med <taggar> och 100 % säkert.\n\n| kommun | varde |\n|---|---:|\n| Malmö | 1 234 |\n');
    const html = builders.toHtml(ast, {});
    assert.ok(html.includes('<title>Titel &amp; test</title>') && html.includes('&lt;taggar&gt;') && html.includes('<table>') && html.includes('class="num"'), 'html escaped and structured');
    const dom = builders.toDom(ast);
    assert.equal(dom.querySelectorAll('table').length, 1); assert.ok(!dom.querySelector('taggar'), 'no injected elements');
    const md = builders.toMarkdown(ast);
    assert.ok(md.text.includes('# Titel & test') && md.text.includes('| kommun | varde |') && md.text.includes('---:'), md.text);
    const tex = builders.toLatex(ast, {});
    assert.ok(tex.text.includes('\\title{Titel \\& test}') && tex.text.includes('\\toprule') && tex.text.includes('100 \\%') && tex.text.includes('\\begin{longtable}{lr}'), tex.text.slice(0, 700));
    const docxBlob = await office.toDocx(ast, { title: 'Test' });
    assert.ok(docxBlob.size > 2000, 'docx size ' + docxBlob.size);
    const parts = await zip.readZip(docxBlob);
    const xml = zip.text(parts['word/document.xml']);
    assert.ok(xml.includes('Malmö') && xml.includes('Titel &amp; test') && xml.includes('<w:tbl>'), 'docx xml contains text and a table');
    const pdf = await office.toPdf(ast, { title: 'Test' });
    assert.equal(pdf.type, 'application/pdf');
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer())), '%PDF-');
    assert.ok(pdf.size > 1000, 'pdf size ' + pdf.size);
  }, 30000);

  test('docgen: built-in templates generate in every format; saved templates round-trip', async (assert) => {
    const list = await documents.list();
    assert.ok(list.length >= 3 && list.some((d) => d.id === 'builtin-kodbok') && list.some((d) => d.id === 'builtin-rapport'));
    const report = list.find((d) => d.id === 'builtin-rapport');
    const html = await generate.generate(report, id, 'html');
    assert.ok(html.filename.endsWith('.html'));
    const text = await html.blob.text();
    assert.ok(text.includes('Doktest') && text.includes('<table>') && text.includes('Stockholm'), 'report html');
    const kodbok = await generate.generate(list.find((d) => d.id === 'builtin-kodbok'), id, 'md');
    const mdText = await kodbok.blob.text();
    assert.ok(mdText.includes('## kommun') && mdText.includes('Unika värden: 3'), mdText.slice(0, 400));
    const tex = await generate.generate(report, id, 'tex');
    assert.ok(tex.filename.endsWith('.zip'));
    const entries = await zip.readZip(tex.blob);
    assert.ok(entries['main.tex'] && zip.text(entries['main.tex']).includes('\\begin{document}'), 'latex zip');
    assert.ok((await generate.generate(report, id, 'docx')).blob.size > 2000);
    assert.equal((await generate.generate(report, id, 'pdf')).blob.type, 'application/pdf');
    const custom = await documents.save(documents.create('Min mall', '# {{datamangd}}\n\n{{diagram "Doktest-diagram" | bredd: 300}}\n'));
    docIds.push(custom.id);
    const withChart = await generate.generate(custom, id, 'md');
    assert.ok(withChart.filename.endsWith('.zip'), 'markdown with figures is zipped');
    const mdz = await zip.readZip(withChart.blob);
    assert.ok(Object.keys(mdz).some((n) => n.startsWith('figures/')), Object.keys(mdz).join(','));
    const json = documents.exportJson(custom);
    assert.ok(json.includes('dataspatium-doc/1'));
    const imported = await documents.importJson(json); docIds.push(imported.id);
    assert.equal(imported.body, custom.body);
    const prev = await generate.preview(custom, id);
    assert.ok(prev.el.querySelector('h1') && prev.el.querySelector('img'), 'preview DOM with image');
  }, 60000);

  test('docgen: batch per group to ZIP (HTML and LaTeX)', async (assert) => {
    const grp = (await documents.list()).find((d) => d.id === 'builtin-grupp');
    const result = await generate.batch(grp, id, { groupColumn: 'kommun', format: 'html', pattern: '{dokument}-{grupp}' });
    assert.equal(result.count, 3);
    const entries = await zip.readZip(result.blob);
    const malmoName = Object.keys(entries).find((n) => n.includes('Malmö') && n.endsWith('.html'));
    assert.ok(malmoName && entries['manifest.json'], Object.keys(entries).join(','));
    const malmo = zip.text(entries[malmoName]);
    assert.ok(malmo.includes('Malmö') && !malmo.includes('Stockholm'), 'rows filtered to the group');
    const texBatch = await generate.batch(grp, id, { groupColumn: 'kommun', format: 'tex' });
    assert.ok(Object.keys(await zip.readZip(texBatch.blob)).some((n) => /\/main\.tex$/.test(n)), 'one folder per group for LaTeX');
  }, 60000);

  test('app: Exportera has Data, Diagram and Dokument tabs and previews a template', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.store.set({ selectedId: id });
      shell.activate('exportera');
      await waitFor(() => root.querySelectorAll('dm-tabs [role="tab"]').length === 3, 5000, 'three tabs');
      /** @type {HTMLElement} */ (root.querySelectorAll('dm-tabs [role="tab"]')[2]).click();
      await waitFor(() => root.querySelector('.dm-doc-preview h1'), 20000, 'document preview');
      assert.ok(root.querySelector('.dm-doc-preview h1').textContent.includes('Doktest'), 'preview shows the dataset name');
      assert.ok(root.querySelector('.dm-doc-preview table'), 'preview has a table');
      const sel = /** @type {any} */ (root.querySelector('.dm-form-grid dm-select'));
      assert.ok(sel.options.length >= 3, 'templates listed: ' + sel.options.length);
      assert.ok(Array.from(root.querySelectorAll('dm-button')).some((b) => b.getAttribute('label') === t('doc.create')), 'create button');
      /** @type {HTMLElement} */ (root.querySelectorAll('dm-tabs [role="tab"]')[1]).click();
      await waitFor(() => Array.from(root.querySelectorAll('.dm-list-item')).some((b) => b.textContent.includes('Doktest-diagram')), 5000, 'chart listed');
      return 'ok';
    } finally {
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 60000);

  test('docgen: cleanup', async () => {
    for (const d of docIds) { try { await documents.remove(d); } catch (_e) { /* ignore */ } }
    for (const c of chartIds) { try { await charts.remove(c); } catch (_e) { /* ignore */ } }
    for (const d of created) { try { await datasets.remove(d); } catch (_e) { /* ignore */ } }
    return `${docIds.length} templates, ${chartIds.length} charts, ${created.length} datasets removed`;
  });
})();
