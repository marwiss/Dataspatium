// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for code lists, data packages, DCAT-AP-SE, the quality declaration and guides. No network: guides read virtual services
 * that answer as the real ones do. `?guides=live` runs the guides against the real sources, by hand.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const codelists = D.require('data/codelists');
  const dcat = D.require('data/dcat');
  const guides = D.require('data/guides');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function make(name, columns, rows, extra = {}) {
    const meta = await datasets.create(Object.assign({ name, columns: columns.map(([n, type]) => ({ name: n, type })), rows }, extra));
    created.push(meta.id);
    return meta;
  }
  const track = (meta) => { created.push(meta.id); return meta; };
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
  const button = (root, text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button')).click();
  const fill = (el, value) => { /** @type {any} */ (el).value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const inputOf = (root, label) => Array.from(root.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === label);

  test('code lists: every list that ships can be read, and has a source and labels', async (assert) => {
    for (const list of codelists.LISTS) {
      const data = await codelists.load(list.id);
      assert.ok(data.codes.size > 20, `${list.id}: ${data.codes.size} codes`);
      for (const [code, row] of Array.from(data.codes).slice(0, 5)) assert.ok(row.length === data.languages.length || list.boundary, `${list.id} ${code}`);
    }
    const sni = await codelists.load('sni2007');
    assert.equal(sni.license, 'CC0');
    assert.ok(sni.codes.get('A')[0].includes('jordbruk'), sni.codes.get('A')[0]);
    assert.deepEqual((await codelists.load('nace')).languages, ['en']);
    return 'ok';
  }, 20000);

  test('code lists: the values and the name decide, and a short code needs the name', async (assert) => {
    const of = async (name, columns, rows) => (await codelists.suggest((await make(name, columns, rows)).id)).map((f) => [f.column, f.list]);
    assert.deepEqual(await of('Kodlista sni', [['sni', 'text'], ['tal', 'number']], [['A', 1], ['B', 2], ['01.110', 3]]), [['sni', 'sni2007']], 'named, with few values');
    assert.deepEqual(await of('Kodlista kommun', [['kommun', 'text']], [['0180'], ['2480'], ['1480']]), [['kommun', 'kommuner']]);
    assert.deepEqual(await of('Kodlista kommun utan nolla', [['kommunkod', 'integer']], [[180], [2480], [1480]]), [['kommunkod', 'kommuner']], 'a code that lost its zero');
    assert.deepEqual(await of('Kodlista land', [['land', 'text']], [['SE'], ['NO'], ['DK']]), [['land', 'iso3166']]);
    assert.deepEqual(await of('Kodlista inget namn', [['kod', 'text']], [['SE'], ['NO'], ['DK'], ['FI'], ['IS'], ['DE'], ['FR'], ['ES']]), [], 'two letters mean nothing without a name');
    assert.deepEqual(await of('Kodlista tal', [['antal', 'integer']], [[1], [2], [3], [10], [11], [12], [13], [14]]), [], 'small numbers are not codes');
    assert.deepEqual(await of('Kodlista fel', [['sni', 'text']], [['inte'], ['en'], ['kod']]), [], 'a name without the values is nothing');
    const ssyk = Array.from((await codelists.load('ssyk2012')).codes.keys()).slice(0, 12).map((c) => [c]);
    const found = await of('Kodlista utan namn', [['kolumn', 'text']], ssyk);
    assert.deepEqual(found, [['kolumn', 'ssyk2012']], 'many long codes are enough');
    return 'ok';
  }, 30000);

  test('code lists: labels in the language of the app, as one step, and the values stay', async (assert) => {
    const i18n = D.require('ui/i18n');
    const recipes = D.require('data/recipes');
    const meta = await make('Etiketter', [['sni', 'text'], ['land', 'text']], [['A', 'SE'], ['01.110', 'NO']]);
    await codelists.apply(meta.id, 'sni', 'sni2007');
    const col = (await datasets.columns(meta.id)).find((c) => c.name === 'sni');
    const label = new Map(col.valueLabels.labels);
    assert.ok(label.get('A').includes('jordbruk'), label.get('A'));
    assert.equal((await datasets.query(meta.id))[0][0], 'A', 'the values do not change');
    await recipes.undo(meta.id);
    assert.ok(!(await datasets.columns(meta.id)).find((c) => c.name === 'sni').valueLabels, 'undone');
    const language = i18n.language();
    i18n.setLanguage('en');
    try {
      assert.ok((await codelists.labelLines(meta.id, 'sni', 'sni2007')).includes('agriculture'), 'in English');
      assert.ok((await codelists.labelLines(meta.id, 'land', 'iso3166')).includes('Sweden'), 'countries from the browser');
    } finally { i18n.setLanguage(language); }
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      shell.store.set({ selectedId: meta.id });
      shell.activate('hantera');
      const card = await waitFor(() => root.querySelector('[data-card="codelists"]'), 5000, 'the card');
      assert.ok(card.textContent.includes('SNI 2007'), card.textContent);
      click(card.querySelector('dm-button'));
      await waitFor(async () => (await datasets.columns(meta.id)).some((c) => c.valueLabels), 3000, 'the labels');
    });
    return 'ok';
  }, 30000);

  test('data package: what is written says what it holds, and comes back the same', async (assert) => {
    const zip = D.require('platform/storage/zip');
    const meta = await make('Paket med åäö', [['kommun', 'text'], ['tal', 'number'], ['ar', 'integer'], ['datum', 'date'], ['text', 'text']], [['0180', 1.5, 2020, '2020-01-02', 'med "citat", och komma'], ['2480', null, 2021, null, 'rad\nbrytning']]);
    const handle = await datasets.ensureOpen(meta.id);
    await D.require('data/recipes').apply(meta.id, 'set_label', { column: 'tal', label: 'Ett tal', description: 'Beskrivning' });
    assert.ok(handle);
    const blob = (await exporter.exportDataset(meta.id, 'datapackage')).blob;
    const entries = await zip.readZip(blob);
    const descriptor = JSON.parse(zip.text(entries['datapackage.json']));
    assert.equal(descriptor.profile, 'tabular-data-package');
    assert.equal(descriptor.name, 'paket-med-aao', 'a name the standard allows');
    const fields = descriptor.resources[0].schema.fields;
    assert.deepEqual(fields.map((f) => f.type), ['string', 'number', 'integer', 'date', 'string']);
    assert.equal(fields[1].title, 'Ett tal');
    assert.ok(entries[descriptor.resources[0].path], 'the data is where it says');
    const file = new File([blob], 'paket.zip', { type: 'application/zip' });
    const preview = await importer.preview(file);
    assert.equal(preview.kind, 'package', 'recognised');
    assert.equal(D.require('io/file-sense').describe(preview).key, 'import.sense.package');
    const back = track(await importer.run(file, {}, null, null));
    assert.equal(back.name, 'Paket med åäö', 'by its title');
    const columns = await datasets.columns(back.id);
    assert.deepEqual(columns.map((c) => c.type), ['text', 'number', 'integer', 'date', 'text'], 'the types from the schema');
    assert.equal(columns[1].label, 'Ett tal');
    const rows = await datasets.query(back.id);
    assert.equal(rows[0][0], '0180', 'a leading zero stays');
    assert.equal(rows[0][1], 1.5);
    assert.equal(rows[1][1], null);
    assert.equal(rows[0][4], 'med "citat", och komma');
    assert.equal(rows[1][4], 'rad\nbrytning');
    // An ordinary ZIP is not a package.
    const other = new File([await zip.createZip({ 'a.txt': new TextEncoder().encode('x') }, {})], 'annan.zip');
    assert.equal(await D.require('io/datapackage').sniff(other), false);
    // A graph follows with its edges, as a resource of their own.
    const graph = D.require('data/graph');
    const net = track(await graph.createGraphDataset({ name: 'Paketgraf', graph: { directed: true, nodes: [{ id: 'a', labels: [], name: 'A', properties: {} }, { id: 'b', labels: [], name: 'B', properties: {} }], edges: [{ id: 'e', source: 'a', target: 'b', type: 'K', properties: {} }] } }));
    const netEntries = await zip.readZip((await exporter.exportDataset(net.id, 'datapackage')).blob);
    const netDescriptor = JSON.parse(zip.text(netEntries['datapackage.json']));
    assert.ok(netDescriptor.resources.some((r) => r.title === '_edges'), 'edges');
    return 'ok';
  }, 20000);

  test('description: DCAT-AP-SE as a file that can be read back, with what is missing said', async (assert) => {
    const meta = await make('Beskriven & tydlig', [['a', 'integer']], [[1]]);
    const empty = dcat.of(await datasets.get(meta.id));
    assert.equal(empty.title, 'Beskriven & tydlig', 'starts from what is known');
    assert.deepEqual(dcat.missing(empty), ['description', 'publisher', 'contactName', 'contactEmail']);
    const filled = Object.assign(empty, { description: 'En <beskrivning>', publisher: 'Myndigheten', contactName: 'Registrator', contactEmail: 'registrator@example.se', keywords: ['ett', 'två'], theme: 'REGI', frequency: 'ANNUAL', license: dcat.LICENSES[0].value, temporalFrom: '2020-01-01', temporalTo: '2024-12-31', landingPage: 'https://example.se/data' });
    assert.deepEqual(dcat.missing(filled), []);
    await dcat.save(meta.id, filled);
    assert.equal((await datasets.get(meta.id)).dcat.publisher, 'Myndigheten', 'kept with the dataset');
    const bytes = await datasets.exportBytes(meta.id);
    const copy = track(await datasets.importBytes(bytes, { name: 'Kopia' }));
    assert.equal((await datasets.get(copy.id)).dcat.theme, 'REGI', 'and follows a copy');
    const blob = (await exporter.exportDataset(meta.id, 'dcat')).blob;
    const text = await blob.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    assert.equal(doc.querySelector('parsererror'), null, 'valid XML');
    assert.ok(text.includes('data-theme/REGI') && text.includes('frequency/ANNUAL') && text.includes('En &lt;beskrivning&gt;'), 'by the EU vocabularies, escaped');
    const back = dcat.fromRdf(text);
    for (const key of ['title', 'description', 'publisher', 'contactName', 'contactEmail', 'theme', 'frequency', 'license', 'temporalFrom', 'temporalTo', 'landingPage']) assert.equal(back[key], filled[key], key);
    assert.deepEqual(back.keywords, ['ett', 'två']);
    let refused = false;
    try { dcat.fromRdf('<inte-rdf/>'); } catch (_err) { refused = true; }
    assert.ok(refused, 'another file is refused');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      shell.store.set({ selectedId: meta.id });
      shell.activate('hantera');
      /** @type {HTMLElement} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"], dm-tabs button')).find((b) => b.textContent.trim() === t('dcat.tab')), 3000, 'the tab')).click();
      const publisher = await waitFor(() => inputOf(root, t('dcat.publisher')), 3000, 'the form');
      assert.equal(/** @type {any} */ (publisher).value, 'Myndigheten');
      assert.ok(root.textContent.includes(t('dcat.complete')));
      fill(publisher, '');
      click(button(root, t('common.save')));
      await waitFor(() => root.textContent.includes(t('dcat.missing', { list: t('dcat.publisher') })), 3000, 'what is missing');
    });
    return 'ok';
  }, 20000);

  test('quality declaration: filled in from what the app knows, with places left to write', async (assert) => {
    const quality = D.require('docgen/quality');
    const zip = D.require('platform/storage/zip');
    const meta = await make('Deklarerad', [['namn', 'text'], ['tal', 'number']], [['a', 1], ['a', 1], [null, null]]);
    await D.require('data/comments').add(meta.id, { text: 'Bortfallet är känt.' });
    await D.require('data/rules').add(meta.id, { type: 'notnull', column: 'namn' });
    await dcat.save(meta.id, Object.assign(dcat.of(await datasets.get(meta.id)), { description: 'Vad det är.', publisher: 'Myndigheten', frequency: 'ANNUAL' }));
    await D.require('data/recipes').apply(meta.id, 'trim', { columns: ['namn'] });
    const md = await quality.markdownFor(meta.id);
    for (const key of ['quality.content', 'quality.reliability', 'quality.timeliness', 'quality.access', 'quality.comparability']) assert.ok(md.includes('## ' + t(key)), key);
    assert.ok(md.includes('Vad det är.'), 'the description');
    assert.ok(md.includes('Bortfallet är känt.'), 'the comment');
    assert.ok(md.includes('Myndigheten'), 'the publisher');
    assert.ok(md.includes(t('quality.duplicates', { n: 1 })), 'the duplicates: ' + md.slice(0, 400));
    assert.ok(md.includes('| namn | 1 |'), 'what is missing per column');
    assert.ok(md.includes(t('dcat.frequency.ANNUAL')), 'how often');
    assert.ok(md.includes(t('quality.write', { what: t('quality.reliability.write') })), 'a place for what only a person can say');
    const blob = (await exporter.exportDataset(meta.id, 'quality')).blob;
    const entries = await zip.readZip(blob);
    const xml = new TextDecoder().decode(entries['word/document.xml']);
    assert.ok(xml.includes('Bortfallet är känt.') && xml.includes(t('quality.reliability')), 'a Word document');
    return 'ok';
  }, 30000);

  /** Answers as the real sources do, in the same form, under a virtual address. */
  function virtualSources(served) {
    let scbCalls = 0;
    D.net.virtual('tests/guides/', (url) => {
      served.push(url);
      const u = new URL(url);
      const text = (data) => Promise.resolve({ kind: 'text', data: typeof data === 'string' ? data : JSON.stringify(data), status: 200, contentType: 'application/json' });
      if (u.pathname.includes('/data/kpi/')) {
        const row = (municipality, value) => ({ kpi: 'N01951', period: 2023, municipality, values: [{ gender: 'T', count: 1, status: '', value, isdeleted: false }, { gender: 'K', count: 1, status: '', value: value / 2, isdeleted: false }] });
        return text({ values: [row('0000', 10000000), row('0001', 2000000), row('0180', 980000), row('2480', 130000), row('1480', 590000)] });
      }
      if (u.pathname.includes('/data.csv')) {
        const lines = ['Stationsnamn;Stationsnummer', 'Stockholm;98210', '', 'Från Datum Tid (UTC);Till Datum Tid (UTC);Representativt dygn;Lufttemperatur;Kvalitet'];
        for (const [day, v] of [['2020-01-01', 1], ['2020-07-01', 21], ['2021-01-01', -1], ['2021-07-01', 19]]) lines.push(`${day} 00:00:01;${day} 23:59:59;${day};${v};G`);
        return Promise.resolve({ kind: 'text', data: lines.join('\n'), status: 200, contentType: 'text/csv' });
      }
      if (u.pathname.includes('/ICP/')) {
        return text({ header: {}, dataSets: [{ series: { '0:0:0:0:0:0': { observations: { 0: [1.5], 1: [2.5] } } } }], structure: { dimensions: { series: ['FREQ', 'REF_AREA', 'ADJUSTMENT', 'ICP_ITEM', 'STS_INSTITUTION', 'ICP_SUFFIX'].map((id) => ({ id, name: id, values: [{ id: 'X', name: 'X' }] })), observation: [{ id: 'TIME_PERIOD', name: 'Time', values: [{ id: '2024-01', name: '2024-01' }, { id: '2024-02', name: '2024-02' }] }] } } });
      }
      // The metadata is a GET and the data a POST to the same address, and a provider only sees the address.
      if (u.pathname.endsWith('BefolkningNy') && (scbCalls++) % 2 === 0) {
        return text({ title: 'Folkmängden', variables: [{ code: 'Region', text: 'region', values: ['00'], valueTexts: ['Riket'] }, { code: 'Civilstand', text: 'civilstånd', elimination: true, values: ['OG'], valueTexts: ['ogifta'] }, { code: 'Alder', text: 'ålder', elimination: true, values: ['0', '1', 'tot'], valueTexts: ['0 år', '1 år', 'totalt ålder'] }, { code: 'Kon', text: 'kön', elimination: true, values: ['1', '2'], valueTexts: ['män', 'kvinnor'] }, { code: 'ContentsCode', text: 'tabellinnehåll', values: ['BE0101N1'], valueTexts: ['Folkmängd'] }, { code: 'Tid', text: 'år', time: true, values: ['2024'], valueTexts: ['2024'] }] });
      }
      return text({ class: 'dataset', version: '2.0', label: 'Folkmängden', id: ['Alder', 'Kon', 'ContentsCode', 'Tid'], size: [2, 2, 1, 1], dimension: { Alder: { label: 'ålder', category: { index: { 0: 0, 1: 1 }, label: { 0: '0 år', 1: '1 år' } } }, Kon: { label: 'kön', category: { index: { 1: 0, 2: 1 }, label: { 1: 'män', 2: 'kvinnor' } } }, ContentsCode: { label: 'tabellinnehåll', category: { index: { BE0101N1: 0 }, label: { BE0101N1: 'Folkmängd' } } }, Tid: { label: 'år', category: { index: { 2024: 0 }, label: { 2024: '2024' } } } }, value: [50000, 47000, 51000, 48000] });
    });
    const base = 'dataspatium-asset://tests/guides';
    return async (id) => {
      const real = await D.require('api/connectors').get(id);
      const copy = JSON.parse(JSON.stringify(real));
      copy.baseUrl = base + '/' + id;
      if (copy.family && copy.family.urls) for (const k of Object.keys(copy.family.urls)) copy.family.urls[k] = base + '/' + id;
      return copy;
    };
  }

  test('guides: each one leaves a table, a chart and the steps behind, and the chart draws', async (assert) => {
    const served = [];
    const connector = virtualSources(served);
    const render = D.require('viz/render');
    const charts = D.require('viz/charts');
    const recipes = D.require('data/recipes');
    for (const guide of guides.GUIDES) {
      assert.ok(D.require('ui/i18n').has(`guide.${guide.id}.title`), guide.id);
      const values = Object.fromEntries(guide.fields.map((f) => [f.name, f.default]));
      const steps = [];
      const res = await guides.run(guide.id, values, { connector, onStep: (s) => steps.push(s) });
      created.push(res.dataset.id);
      assert.deepEqual(steps, ['fetch', 'clean', 'chart', 'done'], guide.id);
      assert.ok(res.dataset.rowCount > 0, `${guide.id}: rows`);
      const svg = await (await render.toBlob(res.chart, 'svg', { width: 500 })).text();
      assert.ok(svg.includes('<svg') && /<(path|rect|line)/.test(svg), `${guide.id}: a chart`);
      await charts.remove(res.chart.id);
    }
    assert.ok(served.length >= 4, 'through the virtual sources only');
    // Kolada: what was asked for, with names rather than codes.
    const kolada = await guides.run('kolada', { kpi: 'N01951', year: '2023' }, { connector });
    created.push(kolada.dataset.id);
    await charts.remove(kolada.chart.id);
    const rows = await datasets.query(kolada.dataset.id);
    const at = (await datasets.columns(kolada.dataset.id)).findIndex((c) => c.name === 'kommun_id');
    assert.deepEqual(rows.map((r) => r[at]).sort(), ['Göteborg', 'Stockholm', 'Umeå'], 'the country and counties gone, names in place');
    assert.ok((await recipes.steps(kolada.dataset.id)).length >= 3, 'the steps stay to build on');
    return 'ok';
  }, 60000);

  test('guides: through the page, with the way on, and a failure said in words', async (assert) => {
    const served = [];
    const connector = virtualSources(served);
    const view = D.require('ui/guides/guides-view');
    await withApp(async (shell, root) => {
      const list = document.createElement('div');
      root.appendChild(list);
      const ui = view.create(shell.ctx, { connector });
      ui.render(list);
      assert.equal(list.querySelectorAll('[data-guide]').length, guides.GUIDES.length);
      /** @type {HTMLElement} */ (list.querySelector('[data-guide="kolada"]')).click();
      const year = await waitFor(() => inputOf(list, t('guide.kolada.field.year')), 2000, 'the fields');
      fill(year, '2022');
      assert.equal(ui.state.values.year, '2022');
      click(button(list, t('guide.run')));
      const success = await waitFor(() => list.querySelector('.dm-success'), 8000, 'the result');
      created.push(ui.state.result.dataset.id);
      assert.ok(success.textContent.includes(t('guide.done', { name: ui.state.result.dataset.name })));
      click(button(list, t('guide.open.chart')));
      await waitFor(() => root.querySelector('.dm-chart-preview canvas, .dm-chart-preview svg'), 10000, 'the chart opens');
      await D.require('viz/charts').remove(ui.state.result.chart.id);
      // A source that answers with something else.
      const failing = view.create(shell.ctx, { connector: async () => { throw new Error('Nätet svarar inte'); } });
      const holder = document.createElement('div');
      root.appendChild(holder);
      failing.render(holder);
      /** @type {HTMLElement} */ (holder.querySelector('[data-guide="prices"]')).click();
      click(await waitFor(() => button(holder, t('guide.run')), 2000, 'the button'));
      await waitFor(() => holder.querySelector('.dm-error'), 3000, 'the message');
      assert.ok(holder.querySelector('.dm-error').textContent.includes('Nätet svarar inte'));
    });
    return 'ok';
  }, 30000);

  test('guides: live against the real sources, by hand', async (assert) => {
    if (!/[?&]guides=live\b/.test(location.search)) return 'skipped: open the page with ?guides=live';
    const render = D.require('viz/render');
    for (const guide of guides.GUIDES) {
      const values = Object.fromEntries(guide.fields.map((f) => [f.name, f.default]));
      const res = await guides.run(guide.id, values);
      created.push(res.dataset.id);
      assert.ok(res.dataset.rowCount > 0, guide.id);
      const svg = await (await render.toBlob(res.chart, 'svg', { width: 500 })).text();
      assert.ok(/<(path|rect|line)/.test(svg), `${guide.id}: a chart`);
      await D.require('viz/charts').remove(res.chart.id);
      D.log('guide', guide.id, res.dataset.rowCount);
    }
    return 'ok';
  }, 180000);

  test('adapt9: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  });
})();
