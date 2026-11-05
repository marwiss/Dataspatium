// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for provenance, working together through a repository, the library and a published workspace. No network: what a repository
 * would hold is made here, and a library at an address is a virtual service.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const comments = D.require('data/comments');
  const recipes = D.require('data/recipes');
  const collab = D.require('data/collab');
  const provenance = D.require('data/provenance');
  const library = D.require('data/library');
  const charts = D.require('viz/charts');
  const dashboards = D.require('viz/dashboards');
  const zip = D.require('platform/storage/zip');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error(`timed out: ${label}`);
      await wait(30);
    }
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
  const buttonIn = (el, text) => Array.from(el.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
  const openDialog = () => document.querySelector('dialog[open]');
  /** What a fetch from a repository gives, holding one version of a dataset. */
  async function fetchedOf(id, name, author) {
    const bytes = new Uint8Array(await datasets.exportBytes(id));
    const local = (await datasets.get(id)).name;
    return { entries: { [`datasets/${id}.sqlite`]: bytes.slice() }, manifest: { author, datasets: [{ id, name }] }, existing: [{ id, name, local }], commit: 'abc' };
  }
  const NET = () => [['namn', 'text'], ['antal', 'integer']];
  /** A second copy of a dataset, standing in for what someone else has on their computer. */
  async function bytesOf(id) {
    const b = await datasets.exportBytes(id);
    return b instanceof ArrayBuffer ? b.slice(0) : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }
  const otherCopy = async (id) => track(await datasets.importBytes(await bytesOf(id), {}, { quiet: true }));

  test('collab: the histories say who has changed what', async (assert) => {
    const log = (...actions) => actions.map(([ts, action]) => ({ ts, action, details: {} }));
    const base = [['1', 'import'], ['2', 'op']];
    const compare = (a, b) => collab.compare(log(...a), log(...b));
    assert.equal(compare(base, base), 'same');
    assert.equal(compare(base, base.concat([['3', 'comment']])), 'comments', 'a comment changes no data');
    assert.equal(compare(base.concat([['4', 'comment']]), base.concat([['3', 'comment']])), 'comments', 'one each');
    assert.equal(compare(base, base.concat([['3', 'op']])), 'theirs');
    assert.equal(compare(base.concat([['3', 'op']]), base), 'mine');
    assert.equal(compare(base.concat([['3', 'op']]), base.concat([['4', 'op']])), 'both');
    assert.equal(compare(base.concat([['3', 'shared']]), base.concat([['4', 'received'], ['5', 'op']])), 'theirs', 'notes are not changes');
    return 'ok';
  });

  test('collab: comments from both sides are kept, and only others count as unread', async (assert) => {
    await comments.setAuthor('Jag');
    const meta = await make('Gemensam', NET(), [['a', 1], ['b', 2]]);
    await comments.add(meta.id, { text: 'Gemensam start' });
    const base = await fetchedOf(meta.id, 'Gemensam', 'Någon');
    assert.deepEqual((await collab.plan(base)).map((p) => p.status), ['same'], 'nothing has happened');
    // The other side comments: made on a copy that keeps the id's history, then fetched.
    const other = await otherCopy(meta.id);
    await comments.add(other.id, { text: 'Från en annan', author: 'Kim' });
    const c = (await comments.list(other.id)).find((x) => x.author === 'Kim');
    await comments.setResolved(other.id, (await comments.list(other.id))[0].id, true);
    const bytes = new Uint8Array(await datasets.exportBytes(other.id));
    await comments.add(meta.id, { text: 'Från mig' });
    const fetched = { entries: { [`datasets/${meta.id}.sqlite`]: bytes }, manifest: { author: 'Kim', datasets: [{ id: meta.id, name: 'Gemensam' }] }, existing: [{ id: meta.id, name: 'Gemensam', local: 'Gemensam' }] };
    const planned = await collab.plan(fetched);
    assert.equal(planned[0].status, 'comments');
    assert.equal(planned[0].newComments, 1);
    const result = await collab.apply(fetched, planned, {}, { from: 'Kim' });
    assert.equal(result.comments, 1);
    const all = await comments.list(meta.id);
    assert.deepEqual(all.map((x) => x.text).sort(), ['Från en annan', 'Från mig', 'Gemensam start']);
    assert.equal(all.find((x) => x.id === c.id).author, 'Kim', 'who wrote it');
    assert.ok(all.find((x) => x.text === 'Gemensam start').resolved, 'resolved on either side stays resolved');
    assert.ok((await datasets.log(meta.id)).some((e) => e.action === 'comment' && e.details.author === 'Kim'), 'in the history too');
    let unread = await collab.unread();
    assert.equal(unread.counts[meta.id], 1, 'one from someone else');
    assert.equal((await collab.plan(fetched))[0].status, 'comments', 'my own comment is still mine only');
    assert.equal((await collab.apply(fetched, await collab.plan(fetched), {}, {})).comments, 0, 'fetching twice adds nothing');
    assert.equal((await collab.unread()).counts[meta.id], 1, 'and counts nothing more');
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      const bar = await waitFor(() => { const el = root.querySelector('.dm-sb-comments'); return el && !el.hidden ? el : null; }, 3000, 'the status bar');
      assert.ok(bar.textContent.includes('1'), bar.textContent);
      bar.click();
      await waitFor(() => Array.from(root.querySelectorAll('.dm-center *')).some((x) => x.children.length === 0 && x.textContent.includes('Från en annan')), 5000, 'the comments are open');
      await waitFor(() => root.querySelector('.dm-sb-comments').hidden, 3000, 'read now');
    });
    unread = await collab.unread();
    assert.equal(unread.total, 0);
    await comments.setAuthor('');
    return 'ok';
  }, 30000);

  test('collab: when only they changed the data theirs comes in, and mine stays as a version', async (assert) => {
    const meta = await make('Bara deras', NET(), [['a', 1]]);
    const other = await otherCopy(meta.id);
    await recipes.apply(other.id, 'sql', { statement: 'update data set antal = 2' });
    await comments.add(meta.id, { text: 'Min kommentar', author: 'Jag' });
    const fetched = { entries: { [`datasets/${meta.id}.sqlite`]: new Uint8Array(await datasets.exportBytes(other.id)) }, manifest: { author: 'Kim' }, existing: [{ id: meta.id, name: 'Bara deras', local: 'Bara deras' }] };
    const planned = await collab.plan(fetched);
    assert.equal(planned[0].status, 'theirs');
    assert.equal(planned[0].steps.theirs, 1);
    const result = await collab.apply(fetched, planned, {}, { from: 'Kim' });
    assert.equal(result.replaced.length, 1);
    assert.ok((await datasets.log(meta.id)).some((e) => e.details && e.details.op), 'their step is here');
    assert.ok((await comments.list(meta.id)).some((c) => c.text === 'Min kommentar'), 'my comment stays');
    assert.ok((await datasets.listVersions(meta.id)).some((v) => (v.label || '').includes('Kim')), 'mine can be gone back to');
    return 'ok';
  }, 30000);

  test('collab: when both changed the data nothing is lost, and the user chooses', async (assert) => {
    const meta = await make('Bådas', NET(), [['a', 1]]);
    const other = await otherCopy(meta.id);
    await recipes.apply(other.id, 'sql', { statement: 'update data set antal = 20' });
    await comments.add(other.id, { text: 'Deras tanke', author: 'Kim' });
    const fetched = { entries: { [`datasets/${meta.id}.sqlite`]: new Uint8Array(await datasets.exportBytes(other.id)) }, manifest: { author: 'Kim', datasets: [{ id: meta.id, name: 'Bådas' }, { id: 'ny', name: 'En ny' }] }, existing: [{ id: meta.id, name: 'Bådas', local: 'Bådas' }] };
    await recipes.apply(meta.id, 'sql', { statement: 'update data set antal = 10' });
    const planned = await collab.plan(fetched);
    assert.equal(planned[0].status, 'both');
    // The dialog says it and defaults to keeping both.
    const answer = await withApp(async (shell) => {
      const merge = D.require('ui/share/github-merge');
      const asking = merge.ask(shell.ctx, fetched, 'Hämta');
      const dlg = await waitFor(openDialog, 5000, 'dialog');
      const select = await waitFor(() => dlg.querySelector('[data-collab-choice]'), 5000, 'the choice');
      assert.equal(select.value, 'both');
      assert.ok(dlg.textContent.includes('En ny'), 'what is new is named');
      buttonIn(dlg, t('bundle.open.ok')).click();
      return asking;
    });
    assert.equal(answer.choices[meta.id], 'both');
    const result = await collab.apply(fetched, answer.planned, answer.choices, { from: 'Kim' });
    assert.equal(result.copies.length, 1);
    created.push(result.copies[0].id);
    assert.equal(Number((await datasets.query(meta.id, {}))[0][1]), 10, 'mine as it was');
    assert.equal(Number((await datasets.query(result.copies[0].id, {}))[0][1]), 20, 'theirs beside it');
    assert.ok(result.copies[0].name.includes('Kim'), result.copies[0].name);
    assert.ok((await comments.list(meta.id)).some((c) => c.text === 'Deras tanke'), 'their comment is here too');
    // Choosing mine or theirs.
    const kept = await collab.apply(fetched, await collab.plan(fetched), { [meta.id]: 'mine' }, {});
    assert.equal(kept.kept.length, 1);
    assert.equal(kept.copies.length, 0);
    const taken = await collab.apply(fetched, await collab.plan(fetched), { [meta.id]: 'theirs' }, { from: 'Kim' });
    assert.equal(taken.replaced.length, 1);
    assert.equal(Number((await datasets.query(meta.id, {}))[0][1]), 20, 'theirs now');
    assert.ok((await datasets.listVersions(meta.id)).length >= 1, 'mine as a version');
    return 'ok';
  }, 30000);

  test('provenance: where a dataset comes from and what it has become', async (assert) => {
    const root = await make('Ursprung', NET(), [['a', 1], ['b', 2]], { source: { kind: 'file', fileName: 'rader.csv' } });
    const right = await make('Andra sidan', NET(), [['a', 5]], { source: { kind: 'api', connectorName: 'Kolada', publisher: 'RKA' } });
    const mid = await make('Sammanslagen', NET(), [['a', 1]], { source: { kind: 'join', left: root.id, right: right.id, keys: [] } });
    const end = await make('Slutet', NET(), [['a', 1]], { source: { kind: 'derived', from: mid.id, op: 'query' } });
    await recipes.apply(mid.id, 'sql', { statement: 'update data set antal = 3' });
    await datasets.snapshot(mid.id, 'Före granskning');
    await datasets.appendLog(await datasets.ensureOpen(mid.id), 'shared', { name: 'Rapportpaket' });
    const chart = await charts.save(Object.assign(charts.create('vega', await datasets.get(mid.id), 'Staplarna'), { vega: { mark: 'bar' } }));
    const dash = await dashboards.save(Object.assign(dashboards.create('Tavlan'), { items: [{ chartId: chart.id, span: 1 }] }));
    const doc = await D.require('docgen/documents').save({ name: 'Rapporten', body: '{{diagram "Staplarna"}}' });
    const nb = await D.require('analysis/notebooks').save(Object.assign(D.require('analysis/notebooks').create('Boken', await datasets.get(mid.id)), {}));
    const graph = await provenance.of(mid.id);
    const by = (kind) => graph.nodes.filter((n) => n.kind === kind).map((n) => n.label);
    assert.equal(graph.center, mid.id);
    assert.deepEqual(by('dataset').sort(), ['Andra sidan', 'Sammanslagen', 'Slutet', 'Ursprung']);
    assert.deepEqual(by('file'), ['rader.csv'], 'the source of what it was made from');
    assert.deepEqual(by('api'), ['Kolada']);
    assert.deepEqual(by('chart'), ['Staplarna']);
    assert.deepEqual(by('dashboard'), ['Tavlan']);
    assert.deepEqual(by('document'), ['Rapporten']);
    assert.deepEqual(by('notebook'), ['Boken']);
    assert.equal(by('recipe').length, 1);
    assert.equal(by('version').length, 1);
    assert.ok(by('share')[0].includes('Rapportpaket'));
    const side = (label) => graph.nodes.find((n) => n.label === label).side;
    assert.equal(side('Ursprung'), 'from');
    assert.equal(side('Slutet'), 'to');
    assert.equal(side('Sammanslagen'), 'center');
    const edge = (from, to) => graph.edges.find((e) => e.from === from && e.to === to);
    assert.equal(edge(root.id, mid.id).label, t('provenance.edge.join'));
    assert.ok(edge(mid.id, end.id), 'to what it became');
    assert.ok(edge(`chart:${chart.id}`, `dash:${dash.id}`), 'a dashboard through its chart');
    assert.ok(edge(`chart:${chart.id}`, `doc:${doc.id}`), 'a document through its chart');
    assert.ok(graph.nodes.every((n) => t(`provenance.kind.${n.kind}`) !== `provenance.kind.${n.kind}`), 'every kind has a word');
    const text = provenance.toMarkdown(graph);
    assert.ok(text.includes('rader.csv') && text.includes('Tavlan') && text.startsWith('# '), text);
    // A dataset that has lost its parent says so, and one with nothing says that.
    await datasets.remove(end.id);
    const orphan = await make('Föräldralös', NET(), [], { source: { kind: 'derived', from: 'borta' } });
    assert.equal((await provenance.of(orphan.id)).nodes.find((n) => n.id === 'borta').label, t('provenance.gone'));
    // On screen: a graph, a list, and a click that goes to the object.
    await withApp(async (shell, rootEl) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === mid.id), 3000, 'dataset');
      shell.activate('hantera');
      shell.store.set({ selectedId: mid.id });
      const tabs = await waitFor(() => rootEl.querySelector('dm-tabs'), 5000, 'tabs');
      const tab = await waitFor(() => Array.from(tabs.querySelectorAll('[role="tab"]')).find((b) => b.textContent.includes(t('provenance.title'))), 3000, 'the tab');
      tab.click();
      const view = await waitFor(() => rootEl.querySelector('[data-provenance] .dm-provenance-graph'), 5000, 'the graph');
      const drawn = await waitFor(() => rootEl.querySelector('[data-provenance] canvas') || rootEl.querySelector('[data-provenance] .dm-error'), 15000, 'drawn');
      assert.equal(drawn.tagName.toLowerCase(), 'canvas', 'drawn without error: ' + drawn.textContent);
      assert.ok(drawn.getBoundingClientRect().width > 200, 'with a size');
      assert.ok(rootEl.querySelector('[data-provenance-side="from"]') && rootEl.querySelector('[data-provenance-side="to"]'), 'both sides as lists');
      rootEl.querySelector(`[data-provenance-node="${root.id}"]`).click();
      await waitFor(() => shell.store.get().selectedId === root.id, 3000, 'the dataset opens');
      shell.store.set({ selectedId: mid.id });
      await waitFor(() => rootEl.querySelector(`[data-provenance-node="dash:${dash.id}"]`), 5000, 'back with the dashboard');
      rootEl.querySelector(`[data-provenance-node="dash:${dash.id}"]`).click();
      await waitFor(() => shell.store.get().mode === 'visualisera', 3000, 'to Visualisera');
      await waitFor(() => rootEl.textContent.includes('Tavlan') && shell.store.get().openDashboardId === null, 5000, 'the dashboard is open');
      shell.activate('hantera');
      shell.store.set({ selectedId: mid.id });
      await waitFor(() => rootEl.querySelector(`[data-provenance-node="nb:${nb.id}"]`), 5000, 'with the notebook');
      rootEl.querySelector(`[data-provenance-node="nb:${nb.id}"]`).click();
      await waitFor(() => shell.store.get().mode === 'analysera' && shell.store.get().openNotebookId === null, 5000, 'the notebook is open');
    });
    await D.require('docgen/documents').remove(doc.id);
    await dashboards.remove(dash.id);
    await charts.remove(chart.id);
    await D.require('analysis/notebooks').remove(nb.id);
    return 'ok';
  }, 40000);

  test('library: what comes with the app can be seen before it is added, and has a licence', async (assert) => {
    const lib = await library.bundled();
    assert.ok(lib.entries.length >= 6, String(lib.entries.length));
    for (const e of lib.entries) {
      assert.ok(e.license && e.name && e.description, e.id);
      assert.ok(library.preview(e).length > 5, `shows what it does: ${e.id}`);
    }
    const tidy = lib.entries.find((e) => e.id === 'recipe-tidy');
    const meta = await make('Stökig', [['Mitt Namn', 'text'], ['Tom', 'text']], [['a', null], ['a', null], [null, null]]);
    await library.add(tidy, { datasetId: meta.id });
    assert.deepEqual((await datasets.columns(meta.id)).map((c) => c.name), ['mitt_namn'], 'clean names, no empty column');
    assert.equal(await datasets.count(meta.id), 1, 'no empty rows or duplicates');
    let failed = '';
    await library.add(tidy, {}).catch((err) => { failed = err.message; });
    assert.equal(failed, t('library.err.dataset'));
    const docs = D.require('docgen/documents');
    const short = await library.add(lib.entries.find((e) => e.id === 'document-short'));
    const made = await D.require('docgen/generate').generate(await docs.get(short.record.id), meta.id, 'html');
    assert.ok((await made.blob.text()).includes('Stökig'), 'the template works');
    await docs.remove(short.record.id);
    const nb = await library.add(lib.entries.find((e) => e.id === 'notebook-explore'));
    assert.equal(nb.record.cells.length, 3);
    await D.require('analysis/notebooks').remove(nb.record.id);
    const script = await library.add(lib.entries.find((e) => e.id === 'script-python-summary'));
    assert.equal(script.record.language, 'python');
    await D.require('platform/storage/idb').deleteScript(script.record.id);
    return 'ok';
  }, 30000);

  test('library: a file at an address is what it says, and what is unknown stays out', async (assert) => {
    await assert.throws(() => library.parse('inte json'), /./);
    await assert.throws(() => library.parse(JSON.stringify({ format: 'annat', entries: [] })), /./);
    const parsed = library.parse(JSON.stringify({ format: library.FORMAT, name: { sv: 'Kommunens', en: 'The municipality' }, entries: [
      { id: 'a', kind: 'recipe', name: 'Bra', license: 'MIT', content: { steps: [] } },
      { id: 'b', kind: 'virus', name: 'Okänt', license: 'MIT', content: {} },
      { id: 'c', kind: 'recipe', name: 'Utan licens', content: { steps: [] } },
      { id: 'd', kind: 'script', name: 'Utan innehåll', license: 'MIT' },
    ] }), 'https://exempel.se/b.json');
    assert.deepEqual(parsed.entries.map((e) => e.id), ['a'], 'only what can be used and has a licence');
    assert.equal(parsed.name, 'Kommunens');
    const file = library.toFile([{ kind: 'script', name: 'Mitt', content: { kind: 'script', language: 'r', name: 'Mitt', code: '1' } }], { name: 'Egen', license: 'CC-BY-4.0', author: 'Kim' });
    const back = library.parse(file);
    assert.equal(back.entries[0].license, 'CC-BY-4.0');
    assert.equal(back.entries[0].author, 'Kim');
    // Fetched only on request, shown, and added after the question.
    const address = 'dataspatium-asset://tests/library/bibliotek.json';
    D.net.virtual('tests/library/bibliotek.json', () => Promise.resolve({ kind: 'text', data: file }));
    {
      await withApp(async (shell, root) => {
        shell.activate('hantera');
        shell.store.set({ selectedId: '__library' });
        await waitFor(() => root.querySelector('[data-library-entry="recipe-tidy"]'), 5000, 'the bundled library');
        const url = Array.from(root.querySelectorAll('dm-input')).find((x) => x.getAttribute('label') === t('library.url'));
        /** @type {any} */ (url).value = address;
        url.dispatchEvent(new Event('input', { bubbles: true }));
        buttonIn(root, t('library.fetch')).click();
        const entry = await waitFor(() => root.querySelector('[data-library-entry="script-1"]'), 5000, 'the fetched library');
        entry.click();
        const preview = await waitFor(() => root.querySelector('[data-library-preview]'), 3000, 'what it is');
        assert.equal(preview.textContent, '1');
        assert.ok(root.textContent.includes('CC-BY-4.0'));
      });
    }
    return 'ok';
  }, 30000);

  test('site: a workspace as pages that hang together and fetch nothing', async (assert) => {
    const site = D.require('docgen/site');
    const used = new Set();
    assert.equal(site.fileName('Befolkning Åre', used), 'befolkning-are.html');
    assert.equal(site.fileName('Befolkning Åre', used), 'befolkning-are-2.html', 'a name is not taken twice');
    assert.equal(site.fileName('///', used), 'sida.html');
    const table = await make('Kommuner & regioner', NET(), [['<b>Umeå</b>', 130], ['Luleå', 77]], { description: 'Norr om <allt>' });
    await datasets.ensureOpen(table.id);
    await recipes.apply(table.id, 'set_label', { column: 'antal', label: 'Antal invånare', description: 'Tusental' });
    const notes = track(await D.require('io/import').runFiles([new File(['# Rubrik\n\nEn rad text att läsa.\n'], 'text.md', { type: 'text/markdown' })], { format: 'documents' }, 'Anteckningar'));
    const chart = await charts.save(Object.assign(charts.create('vega', await datasets.get(table.id), 'Stapel'), {}));
    const dash = await dashboards.save(Object.assign(dashboards.create('Tavla'), { items: [{ chartId: chart.id, span: 1 }] }));
    const doc = await D.require('docgen/documents').save({ name: 'Mallen', body: '# {{datamangd}}\n\nHej.\n' });
    try {
      const steps = [];
      const blob = await site.build({ title: 'Vår <webbplats>', datasets: [{ id: table.id }, { id: notes.id }], dashboards: [dash], documents: [doc], documentDataset: table.id }, { onProgress: (a, b) => steps.push(`${a}/${b}`) });
      assert.equal(steps.join(' '), '1/4 2/4 3/4 4/4');
      const files = await zip.readZip(new Uint8Array(await blob.arrayBuffer()));
      const names = Object.keys(files).sort();
      assert.ok(names.includes('index.html'), names.join(', '));
      assert.equal(names.length, 5, names.join(', '));
      const index = zip.text(files['index.html']);
      assert.ok(index.includes('Vår &lt;webbplats&gt;'), 'escaped');
      for (const name of names.filter((n) => n !== 'index.html')) {
        assert.ok(index.includes(`href="${name}"`), `linked: ${name}`);
        const page = zip.text(files[name]);
        assert.ok(page.includes('href="../index.html"'), `the way back: ${name}`);
        assert.ok(!/<(?:script|img|link)[^>]+(?:src|href)="https?:/i.test(page), `asks the network for nothing: ${name}`);
      }
      const tablePage = zip.text(files[names.find((n) => n.includes('kommuner'))]);
      assert.ok(tablePage.includes('&lt;b&gt;Umeå&lt;/b&gt;') && !tablePage.includes('<b>Umeå</b>'), 'the rows, escaped');
      assert.ok(tablePage.includes(t('site.codebook')) && tablePage.includes('Antal invånare') && tablePage.includes('Tusental'), 'the code book');
      assert.ok(zip.text(files[names.find((n) => n.includes('anteckningar'))]).includes('En rad text att läsa'), 'a document to read');
      assert.ok(zip.text(files[names.find((n) => n.includes('tavla'))]).includes('Stapel'), 'the dashboard with its chart');
      assert.ok(zip.text(files[names.find((n) => n.includes('mallen'))]).includes('Hej'), 'the document template filled in');
      // Through the dialog: the review is passed and the copies go away afterwards.
      const before = (await datasets.list()).length;
      const downloads = [];
      await withApp(async (shell, root) => {
        const realDownload = shell.ctx.services.files.download;
        shell.ctx.services.files.download = (b, n) => { downloads.push({ blob: b, name: n }); };
        try {
          shell.activate('dela');
          const tab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"]')).find((b) => b.textContent.includes(t('dela.tabs.publish'))), 5000, 'the tab');
          tab.click();
          const action = await waitFor(() => buttonIn(root, t('site.action')), 5000, 'the button');
          action.click();
          const dlg = await waitFor(openDialog, 5000, 'dialog');
          assert.ok(dlg.querySelector('[data-site-item="dataset"]') && dlg.querySelector('[data-site-item="dashboard"]'), 'things to choose from');
          buttonIn(dlg, t('site.create')).click();
          await waitFor(async () => {
            const open = openDialog();
            if (open) { const go = Array.from(open.querySelectorAll('dm-button[variant="primary"]')).pop(); if (go) /** @type {any} */ (go).click(); }
            return downloads.length;
          }, 30000, 'the file');
        } finally { shell.ctx.services.files.download = realDownload; }
      });
      assert.ok(downloads[0].name.endsWith('.zip'), downloads[0].name);
      // The copies go away after the download, so wait for them.
      await waitFor(async () => (await datasets.list()).length === before, 15000, 'no copies left');
    } finally {
      await D.require('docgen/documents').remove(doc.id);
      await dashboards.remove(dash.id);
      await charts.remove(chart.id);
    }
    return 'ok';
  }, 90000);

  test('adapt10: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* already gone */ } }
    await D.require('platform/storage/idb').setSetting('collab.unread', {});
    return 'ok';
  });
})();
