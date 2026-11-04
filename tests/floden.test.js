// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for flows and watches: saving and files, a chain of real steps with its output and log, errors and cancelling,
 * the checks before a flow runs at start, an R step, watches over a virtual API (fingerprints, row differences, the
 * fingerprint following an update, the check at start and its consent), linked files, backups, and the page in Hantera
 * with the status bar. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const flows = D.require('data/flows');
  const watches = D.require('data/watches');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const lists = D.require('data/lists');
  const charts = D.require('viz/charts');
  const dashboards = D.require('viz/dashboards');
  const documents = D.require('docgen/documents');
  const connectors = D.require('api/connectors');
  const runner = D.require('api/runner');
  const linked = D.require('data/linked');
  const workspace = D.require('data/workspace');
  const zip = D.require('platform/storage/zip');
  const idb = D.require('platform/storage/idb');
  const t = D.require('ui/i18n').t;
  const created = []; const flowIds = []; const chartIds = []; const listIds = []; const dashIds = []; const connectorIds = []; const scriptIds = []; const docIds = [];
  const BASE = 'dataspatium-asset://tests/flode';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  async function table(name, rows) {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: rows || [['Ale', 10], ['Bollebygd', 20], ['Ale', 5]] });
    created.push(meta.id);
    return meta;
  }
  const saved = async (input) => { const f = await flows.save(input); flowIds.push(f.id); return f; };
  async function apiDataset(serviceRows, name) {
    const virtual = 'tests/flode/data' + Math.random().toString(36).slice(2, 7);
    let rows = serviceRows;
    D.net.virtual(virtual, () => Promise.resolve({ kind: 'text', data: JSON.stringify({ rader: rows }) }));
    const conn = await connectors.save({ format: 'dataspatium-api/1', id: 'test-flode-' + virtual.slice(-5), name: 'Testkälla', baseUrl: 'dataspatium-asset://' + virtual, auth: { type: 'none' }, endpoints: [{ id: 'e', name: 'E', method: 'GET', path: '', params: [], response: { format: 'json', path: 'rader' } }] });
    connectorIds.push(conn.id);
    const res = await runner.fetchTable(conn, conn.endpoints[0], {});
    const meta = await runner.toDataset(res, { name, source: runner.describeSource(conn, conn.endpoints[0], {}, res) });
    created.push(meta.id);
    return { meta, setRows: (r) => { rows = r; }, stop: () => D.net.unvirtual(virtual) };
  }

  test('floden: saving, listing, files and removing', async (assert) => {
    assert.ok(flows.STEP_TYPES.includes('refresh') && flows.STEP_TYPES.includes('export'));
    const f = await saved({ name: ' Månadsrapport ', description: 'Varje månad', onStart: true, steps: [{ type: 'export', params: { datasetId: 'x', format: 'csv' } }] });
    assert.equal(f.name, 'Månadsrapport');
    assert.ok(f.id && f.createdAt);
    assert.ok((await flows.list()).some((x) => x.id === f.id));
    assert.equal((await flows.get(f.id)).steps[0].params.format, 'csv');
    const json = flows.exportJson(f);
    assert.ok(!JSON.parse(json).lastRun, 'no run log in the file');
    assert.equal(JSON.parse(json).onStart, false, 'a flow from a file never starts by itself');
    const back = await flows.importJson(json.replace(f.id, f.id + 'b'));
    flowIds.push(back.id);
    assert.equal(back.onStart, false);
    assert.equal(back.steps.length, 1);
    let message = '';
    try { await flows.importJson('{"format":"x"}'); } catch (err) { message = err.message; }
    assert.equal(message, t('flows.err.file'));
    await flows.remove(back.id);
    assert.equal(await flows.get(back.id), null);
    return 'ok';
  });

  test('floden: a chain of list, chart, dashboard, document and export gives files, a log and keeps the same dataset', async (assert) => {
    const meta = await table('Flödeskälla');
    const list = await lists.save({ name: 'Ale', datasetId: meta.id, text: 'Ale', filters: [] });
    listIds.push(list.id);
    const chart = charts.create('vega', meta, 'Flödesdiagram');
    chart.vega = Object.assign({}, chart.vega, { mark: 'bar', encoding: { x: { field: 'kommun', type: 'nominal' }, y: { field: 'antal', type: 'quantitative' } } });
    const savedChart = await charts.save(chart);
    chartIds.push(savedChart.id);
    const dash = dashboards.create('Flödespanel');
    dash.items = [{ chartId: savedChart.id }];
    const savedDash = await dashboards.save(dash);
    dashIds.push(savedDash.id);
    const doc = await documents.save({ name: 'Flödesdokument', format: 'markdown', body: '# Rapport\n\n{{antal_rader}} rader.' });
    docIds.push(doc.id);
    const flow = await saved({ name: 'Rapportkedja', steps: [
      { type: 'list', params: { listId: list.id, name: 'Ale-rader' } },
      { type: 'chart', params: { chartId: savedChart.id, format: 'svg' } },
      { type: 'chart', params: { chartId: savedChart.id, format: 'png', groupColumn: 'kommun' } },
      { type: 'dashboard', params: { dashboardId: savedDash.id } },
      { type: 'document', params: { documentId: doc.id, datasetId: meta.id, format: 'html' } },
      { type: 'export', params: { datasetId: meta.id, format: 'csv' } },
    ] });
    const seen = [];
    const off = flows.subscribe((type, p) => { if (type === 'step') seen.push([p.index, p.type]); });
    const result = await flows.run(flow);
    off();
    assert.ok(result.ok, 'all steps ran: ' + JSON.stringify(result.steps));
    assert.deepEqual(seen.map((x) => x[1]), ['list', 'chart', 'chart', 'dashboard', 'document', 'export']);
    assert.equal(result.files.length, 5);
    assert.ok(flows.hasOutput(flow.id));
    const out = await flows.output(flow.id);
    assert.ok(out.name.endsWith('.zip'), out.name);
    const entries = await zip.readZip(out.blob);
    assert.equal(Object.keys(entries).length, 5, Object.keys(entries).join(','));
    assert.ok(Object.keys(entries).some((n) => n.endsWith('.svg')));
    assert.ok(new TextDecoder().decode(entries[Object.keys(entries).find((n) => n.endsWith('.csv'))]).includes('Bollebygd'));
    const stored = await flows.get(flow.id);
    assert.ok(stored.lastRun.ok); assert.equal(stored.history.length, 1);
    const target = stored.steps[0].targetId;
    const made = await datasets.get(target);
    created.push(target);
    assert.equal(made.name, 'Ale-rader'); assert.equal(made.rowCount, 2);
    // The next run updates the same dataset, so charts on it keep working.
    await datasets.appendRows(meta.id, { columns: ['kommun', 'antal'], rows: [['Ale', 7]] }, { mode: 'append' });
    const again = await flows.run(await flows.get(flow.id));
    assert.ok(again.ok, JSON.stringify(again.steps));
    assert.equal((await flows.get(flow.id)).steps[0].targetId, target, 'same dataset');
    await datasets.flushSaves();
    assert.equal((await datasets.get(target)).rowCount, 3);
    assert.equal((await flows.get(flow.id)).history.length, 2);
    return 'ok';
  }, 90000);

  test('floden: a step that fails stops the flow unless it should go on, and a flow can be cancelled', async (assert) => {
    const meta = await table('Felkälla');
    const steps = [{ type: 'export', params: { datasetId: 'finns-inte', format: 'csv' } }, { type: 'export', params: { datasetId: meta.id, format: 'csv' } }];
    const stopped = await flows.run(await saved({ name: 'Stannar', steps }));
    assert.equal(stopped.ok, false);
    assert.equal(stopped.steps.length, 1, 'stopped at the first error');
    assert.equal(stopped.steps[0].message, t('flows.err.dataset'));
    const onward = await flows.run(await saved({ name: 'Fortsätter', continueOnError: true, steps }));
    assert.equal(onward.ok, false, 'still reported as failed');
    assert.equal(onward.steps.length, 2);
    assert.ok(onward.steps[1].ok);
    assert.equal(onward.files.length, 1);
    const one = await flows.output(onward.flowId);
    assert.ok(one.name.endsWith('.csv'), 'one file comes as it is: ' + one.name);
    // Cancelling takes effect before the next step; two flows never run at once.
    const long = await saved({ name: 'Avbryts', steps: [{ type: 'export', params: { datasetId: meta.id, format: 'csv' } }, { type: 'export', params: { datasetId: meta.id, format: 'json' } }] });
    const p = flows.run(long);
    assert.equal(flows.current().name, 'Avbryts');
    let busy = '';
    try { await flows.run(long); } catch (err) { busy = err.message; }
    assert.equal(busy, t('flows.err.busy', { name: 'Avbryts' }));
    flows.cancel();
    const cancelled = await p;
    assert.ok(cancelled.aborted && !cancelled.ok, JSON.stringify(cancelled));
    assert.ok(cancelled.steps.length < 2);
    assert.equal(flows.current(), null);
    return 'ok';
  }, 30000);

  test('floden: at start a flow only runs when it need not ask for anything', async (assert) => {
    const api = await apiDataset([{ a: 1 }], 'Startkälla');
    const flow = await saved({ name: 'Vid start', onStart: true, steps: [{ type: 'refresh', params: { datasetId: api.meta.id } }] });
    assert.deepEqual(await flows.blockers(flow), [], 'the test page has consent');
    const before = localStorage.getItem('dataspatium.consent');
    localStorage.removeItem('dataspatium.consent');
    const consent = D.require('platform/consent');
    const previous = await consent.state('api');
    await consent.set('api', null);
    try {
      assert.deepEqual(await flows.blockers(flow), [t('flows.block.consent', { purpose: t('consent.purpose.api') })]);
      const skipped = [];
      const res = await flows.runOnStart({ force: true, onSkip: (f, why) => skipped.push(f.name + ':' + why.length) });
      assert.ok(skipped.includes('Vid start:1'), 'skipped and reported: ' + skipped.join());
      assert.ok(!res.some((r) => r.flowId === flow.id));
    } finally {
      await consent.set('api', previous);
      localStorage.setItem('dataspatium.consent', before || 'granted');
    }
    const ran = await flows.runOnStart({ force: true });
    assert.ok(ran.some((r) => r.flowId === flow.id && r.ok), JSON.stringify(ran));
    const script = { id: 'script_flode_py', name: 'Pyskript', language: 'python', code: 'print(1)', updatedAt: new Date().toISOString() };
    await idb.putScript(script); scriptIds.push(script.id);
    const reasons = await flows.blockers({ steps: [{ type: 'code', params: { scriptId: script.id } }] });
    const cached = await D.require('engines/python/catalog').cachedRuntime();
    assert.deepEqual(reasons, cached ? [] : [t('flows.block.python')], 'Python is never fetched at start');
    await flows.save(Object.assign(await flows.get(flow.id), { onStart: false }));
    api.stop();
    return 'ok';
  }, 30000);

  test('floden: a refresh step replays the recipe, a recipe step applies it elsewhere, and an R step writes a dataset', async (assert) => {
    const api = await apiDataset([{ namn: ' ale ', tal: 1 }], 'Hämtad');
    await recipes.apply(api.meta.id, 'trim', { columns: ['namn'] });
    api.setRows([{ namn: ' ale ', tal: 1 }, { namn: ' borås ', tal: 2 }]);
    const copy = await table('Mottagare', [['x', 1]]);
    const other = await datasets.create({ name: 'Annan', columns: [{ name: 'namn', type: 'text' }, { name: 'tal', type: 'integer' }], rows: [[' lund ', 3]] });
    created.push(other.id);
    const script = { id: 'script_flode_r', name: 'Rskript', language: 'r', code: 'dm_write(data.frame(a = 1:2), "Från flödet")', updatedAt: new Date().toISOString() };
    await idb.putScript(script); scriptIds.push(script.id);
    const flow = await saved({ name: 'Kodkedja', steps: [
      { type: 'refresh', params: { datasetId: api.meta.id } },
      { type: 'recipe', params: { from: api.meta.id, to: other.id } },
      { type: 'code', params: { scriptId: script.id } },
    ] });
    const res = await flows.run(flow);
    assert.ok(res.ok, JSON.stringify(res.steps));
    const rows = await datasets.query(api.meta.id, {});
    assert.equal(rows.length, 2, 'two rows after the refresh');
    assert.equal(rows[1][0], 'borås', 'the recipe was replayed on the new rows: ' + JSON.stringify(rows));
    assert.equal((await datasets.query(other.id, {}))[0][0], 'lund', 'the recipe was applied to the other dataset');
    assert.ok(res.steps[2].message.includes('Från flödet'), res.steps[2].message);
    const written = (await datasets.list()).find((d) => d.name === 'Från flödet');
    assert.ok(written && written.rowCount === 2, 'the script wrote a dataset');
    created.push(written.id, copy.id);
    // A broken script stops the flow with R's own message.
    const bad = { id: 'script_flode_rbad', name: 'Trasigt', language: 'r', code: 'stop("fel i skriptet")', updatedAt: new Date().toISOString() };
    await idb.putScript(bad); scriptIds.push(bad.id);
    const failed = await flows.run(await saved({ name: 'Fel i R', steps: [{ type: 'code', params: { scriptId: bad.id } }] }));
    assert.ok(!failed.ok && failed.steps[0].message.includes('fel i skriptet'), JSON.stringify(failed.steps));
    api.stop();
    return 'ok';
  }, 120000);

  test('watches: a watched source shows what changed, and an update makes it quiet again', async (assert) => {
    const api = await apiDataset([{ a: 1 }, { a: 2 }, { a: 3 }], 'Bevakad');
    assert.ok(watches.watchable(api.meta));
    assert.ok(!watches.watchable(await table('Vanlig')));
    const first = await watches.setWatched(api.meta.id, true);
    assert.equal(first.state, 'same', 'nothing has moved since the fetch: ' + JSON.stringify(first));
    assert.equal((await watches.pending()).filter((w) => w.datasetId === api.meta.id).length, 0);
    // The same rows in another order are not news.
    api.setRows([{ a: 3 }, { a: 1 }, { a: 2 }]);
    assert.equal((await watches.check(api.meta.id)).state, 'same', 'order does not count');
    // One changed, one more: the dataset itself stays as it was.
    api.setRows([{ a: 1 }, { a: 2 }, { a: 30 }, { a: 4 }]);
    const news = await watches.check(api.meta.id);
    assert.equal(news.state, 'new');
    assert.equal(news.summary.rowsBefore, 3); assert.equal(news.summary.rowsNow, 4);
    assert.equal(news.summary.added, 2); assert.equal(news.summary.removed, 1);
    assert.equal((await datasets.get(api.meta.id)).rowCount, 3, 'the dataset is untouched');
    assert.ok((await watches.pending()).some((w) => w.datasetId === api.meta.id));
    // Updating the dataset, by any route, moves the comparison along.
    const up = await runner.refreshDataset(api.meta.id);
    assert.equal(up.rows, 4);
    await waitFor(async () => (await watches.get(api.meta.id)).state === 'same', 3000, 'the fingerprint after the update');
    assert.equal((await watches.check(api.meta.id)).state, 'same');
    // A new column is news too; a broken source is an error, not news.
    api.setRows([{ a: 1, b: 2 }]);
    const col = await watches.check(api.meta.id);
    assert.equal(col.state, 'new');
    assert.deepEqual(col.summary.columnsAdded, ['b']);
    const failing = await watches.check(api.meta.id, { fetch: async () => { throw new Error('tjänsten svarar inte'); } });
    assert.equal(failing.state, 'error');
    assert.equal(failing.error, 'tjänsten svarar inte');
    // Started late: the source already has more rows than when the dataset was fetched.
    await watches.setWatched(api.meta.id, false);
    assert.equal(await watches.get(api.meta.id), null);
    api.setRows([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }, { a: 6 }]);
    const late = await watches.setWatched(api.meta.id, true);
    assert.equal(late.state, 'new', JSON.stringify(late));
    assert.equal(late.summary.rowsNow, 6);
    await watches.setWatched(api.meta.id, false);
    api.stop();
    return 'ok';
  }, 30000);

  test('watches: the check at start is the user’s choice and needs consent already given; linked files need their permission', async (assert) => {
    const api = await apiDataset([{ a: 1 }], 'Vid start bevakad');
    await watches.setWatched(api.meta.id, true);
    api.setRows([{ a: 2 }]);
    await watches.setChecksOnStart(false);
    assert.deepEqual(await watches.checkOnStart({ force: true }), [], 'off by default');
    await watches.setChecksOnStart(true);
    const before = localStorage.getItem('dataspatium.consent');
    localStorage.removeItem('dataspatium.consent');
    const consent = D.require('platform/consent');
    const previous = await consent.state('api');
    await consent.set('api', null);
    try { assert.deepEqual(await watches.checkOnStart({ force: true }), [], 'no consent: nothing is read and nothing is asked'); }
    finally { await consent.set('api', previous); localStorage.setItem('dataspatium.consent', before || 'granted'); }
    const out = await watches.checkOnStart({ force: true });
    assert.ok(out.some((w) => w.datasetId === api.meta.id && w.state === 'new'), JSON.stringify(out.map((w) => w.state)));
    await watches.setChecksOnStart(false);
    await watches.setWatched(api.meta.id, false);
    api.stop();
    // A linked file: size and time decide, and without permission nothing is known.
    const importer = D.require('io/import');
    let csv = 'a;b\n1;2\n';
    const stamp = Date.now();
    let when = stamp;
    const handle = { kind: 'file', name: 'lankad.csv', queryPermission: async () => 'granted', getFile: async () => new File([csv], 'lankad.csv', { type: 'text/csv', lastModified: when }) };
    const firstFile = await handle.getFile();
    const meta = await importer.run(firstFile, { linked: true }, null, 'Länkad');
    created.push(meta.id);
    await linked.link(meta.id, handle);
    const linkedMeta = await datasets.get(meta.id);
    assert.ok(watches.watchable(linkedMeta), JSON.stringify(linkedMeta.source));
    const quiet = await watches.setWatched(meta.id, true);
    assert.equal(quiet.state, 'same', JSON.stringify(quiet));
    csv = 'a;b\n1;2\n3;4\n'; when = stamp + 60000;
    const changed = await watches.check(meta.id);
    assert.equal(changed.state, 'new');
    assert.equal(changed.summary.added, 1);
    handle.queryPermission = async () => 'prompt';
    assert.equal((await watches.check(meta.id)).state, 'unknown', 'no permission: no question at this point');
    await watches.setWatched(meta.id, false);
    await linked.unlink(meta.id);
    return 'ok';
  }, 30000);

  test('floden: they follow backups but not bundles to others', async (assert) => {
    const flow = await saved({ name: 'I säkerhetskopian', steps: [{ type: 'export', params: { datasetId: 'x', format: 'csv' } }] });
    const backup = await workspace.collect({});
    assert.ok(backup.files[`flows/${flow.id}.flow.json`], 'in the backup');
    const bundle = await workspace.collect({ kind: 'bundle', datasetIds: [] });
    assert.ok(!Object.keys(bundle.files).some((p) => p.startsWith('flows/')), 'not in a bundle');
    await flows.remove(flow.id);
    const blob = await zip.createZip({ [`flows/${flow.id}.flow.json`]: backup.files[`flows/${flow.id}.flow.json`], 'manifest.json': backup.files['manifest.json'] || '{}' }, { level: 1 });
    const res = await workspace.restore(blob);
    assert.equal(res.flows.length, 1, JSON.stringify(Object.keys(res)));
    assert.equal(res.flows[0].name, 'I säkerhetskopian');
    assert.equal(res.flows[0].onStart, false);
    return 'ok';
  });

  test('ui: flows and watches in Hantera, with the running flow and the news in the status bar', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const meta = await table('Sidkälla');
      const api = await apiDataset([{ a: 1 }], 'Sidans källa');
      const shell = await D.require('app').start(root);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === api.meta.id), 5000, 'datasets in the store');
      const before = (await flows.list()).length;
      shell.activate('hantera');
      shell.store.set({ selectedId: '__flows' });
      await waitFor(() => root.querySelector('.dm-center') && root.querySelector('.dm-center').textContent.includes(t('flows.title')), 5000, 'the page');
      // A new flow through the editor.
      const newBtn = await waitFor(() => buttonByText(t('flows.new')), 5000, 'the new flow button');
      newBtn.click();
      const addBtn = await waitFor(() => buttonByText(t('flows.add')), 5000, 'the editor');
      const name = await waitFor(() => Array.from(root.querySelectorAll('dm-input')).find((i) => i.getAttribute('label') === t('flows.name')), 3000, 'the name');
      /** @type {any} */ (name).value = 'Sidflöde';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      const typeSel = Array.from(root.querySelectorAll('dm-select')).find((e) => e.getAttribute('label') === t('flows.add.type'));
      /** @type {any} */ (typeSel).value = 'export';
      typeSel.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      const pick = await waitFor(() => Array.from(root.querySelectorAll('.dm-flow-step dm-select')).find((e) => e.getAttribute('label') === t('flows.field.datasetId')), 3000, 'the step field');
      /** @type {any} */ (pick).value = meta.id;
      pick.dispatchEvent(new Event('change', { bubbles: true }));
      buttonByText(t('common.save')).click();
      await waitFor(async () => (await flows.list()).length === before + 1, 3000, 'the saved flow');
      const flow = (await flows.list()).find((f) => f.name === 'Sidflöde');
      flowIds.push(flow.id);
      assert.equal(flow.steps[0].params.datasetId, meta.id);
      const card = await waitFor(() => root.querySelector(`[data-flow="${flow.id}"]`), 5000, 'the flow card');
      // Run it: the log gets the steps, and the result can be fetched.
      Array.from(card.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('flows.run')).click();
      await waitFor(() => { const c = root.querySelector(`[data-flow="${flow.id}"]`); return c && Array.from(c.querySelectorAll('dm-button')).some((b) => b.textContent.trim() === t('flows.fetch')); }, 8000, 'the fetch button');
      assert.ok(root.querySelector('.dm-log').textContent.includes(t('flows.finished.ok', { name: 'Sidflöde' })), 'the log says it is done');
      await waitFor(() => root.querySelector('.dm-right').textContent.includes(t('flows.step.export')), 3000, 'the run in the inspector');
      // The status bar shows a running flow while it runs.
      const flowBar = root.querySelector('.dm-sb-flow');
      assert.ok(flowBar.hidden, 'nothing while idle');
      // Watches: the page lists what can be watched, and news shows in the status bar and opens the page.
      const watchBar = root.querySelector('.dm-sb-watch');
      assert.ok(watchBar.hidden, 'no news yet');
      await watches.setWatched(api.meta.id, true);
      api.setRows([{ a: 1 }, { a: 2 }]);
      await watches.check(api.meta.id);
      await waitFor(() => !watchBar.hidden, 3000, 'the news in the status bar');
      assert.equal(watchBar.textContent.trim(), t('shell.watch.new', { n: 1 }));
      shell.store.set({ selectedId: meta.id });
      await wait(100);
      /** @type {any} */ (watchBar).click();
      const row = await waitFor(() => root.querySelector(`[data-watch="${api.meta.id}"]`), 5000, 'the watch page');
      assert.ok(row.textContent.includes(t('watch.state.new')));
      assert.ok(row.textContent.includes(t('watch.summary.rows', { before: '1', now: '2' })), row.textContent);
      Array.from(row.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('watch.update')).click();
      await waitFor(() => watchBar.hidden, 8000, 'the news gone after the update');
      assert.equal((await datasets.get(api.meta.id)).rowCount, 2);
      // The dataset's own page has the button.
      shell.store.set({ selectedId: api.meta.id });
      await waitFor(() => buttonByText(t('watch.off')), 5000, 'the button says it is being watched');
      await watches.setWatched(api.meta.id, false);
      api.stop();
      return 'ok';
    } finally { root.remove(); }
  }, 60000);

  test('floden: cleanup', async (assert) => {
    for (const id of flowIds) await flows.remove(id).catch(() => {});
    for (const id of chartIds) await charts.remove(id).catch(() => {});
    for (const id of dashIds) await dashboards.remove(id).catch(() => {});
    for (const id of listIds) await lists.remove(id).catch(() => {});
    for (const id of connectorIds) await connectors.remove(id).catch(() => {});
    for (const id of docIds) await documents.remove(id).catch(() => {});
    for (const id of scriptIds) await idb.deleteScript(id).catch(() => {});
    for (const id of created) await datasets.remove(id).catch(() => {});
    for (const w of await watches.list()) await watches.setWatched(w.datasetId, false);
    assert.ok(true);
    return 'ok';
  });
})();
