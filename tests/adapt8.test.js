// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Dela following the kind of dataset: what a bundle carries, a dataset as a page of its own, and the kinds on the
 * phone. Pages are loaded in a frame and asked what they show. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const datasets = D.require('data/datasets');
  const graph = D.require('data/graph');
  const importer = D.require('io/import');
  const workspace = D.require('data/workspace');
  const viewers = D.require('docgen/viewers');
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
  async function photo(name) {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d').fillRect(0, 0, 80, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return new File([await blob.arrayBuffer()], name, { type: 'image/jpeg' });
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
  const NET = () => ({
    directed: true,
    nodes: ['a', 'b', 'c'].map((id) => ({ id, labels: ['X'], name: 'Namn ' + id, properties: {} })),
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'K', properties: {} }, { id: 'e2', source: 'a', target: 'c', type: 'K', properties: {} }],
  });
  /** A page in a frame, so that its own script runs and its text can be asked for. */
  async function opened(blob, fn) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute; left:-10000px; width:900px; height:700px;';
    frame.srcdoc = await blob.text();
    document.body.appendChild(frame);
    try {
      await new Promise((resolve) => { frame.onload = resolve; });
      // A published page is opened on its own, where its inline script runs. In a srcdoc frame it inherits this page's content
      // policy, which has no inline scripts, so the test runs the page's scripts itself (eval is allowed for web-ifc and Vega).
      if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const win = /** @type {any} */ (frame.contentWindow);
        for (const s of Array.from(frame.contentDocument.querySelectorAll('script:not([src])'))) if (!s.type || /javascript/.test(s.type)) win.eval(s.textContent);
      }
      return await fn(frame.contentDocument);
    } finally { frame.remove(); }
  }

  test('published page: a document to read and filter, everything escaped', async (assert) => {
    const doc = track(await importer.runFiles([new File(['# Rubrik <b>\n\nFörsta stycket om vatten.\n\nAndra stycket om <script>alert(1)</script> luft.\n'], 'a.md', { type: 'text/markdown' })], { format: 'documents' }, 'Sidans dokument'));
    await opened(await viewers.pageFor(doc.id), async (page) => {
      assert.ok(page.body.textContent.includes('Första stycket om vatten.'), 'the text');
      assert.equal(page.querySelectorAll('script[src]').length, 0, 'nothing is fetched');
      assert.ok(page.querySelector('h3, h2'), 'headings stay headings');
      assert.ok(!Array.from(page.querySelectorAll('script')).some((s) => s.textContent.includes('alert(1)')), 'no script from the text');
      const box = page.querySelector('.dm-v-filter');
      box.value = 'vatten';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      const shown = Array.from(page.querySelectorAll('.dm-v-p')).filter((p) => p.style.display !== 'none');
      assert.equal(shown.length, 1, 'the filter works in the page');
      assert.ok(shown[0].textContent.includes('vatten'));
    });
    return 'ok';
  }, 15000);

  test('published page: pictures inside the page, a table to filter, a map, a graph, a plan and a model', async (assert) => {
    const album = track(await importer.runFiles([await photo('sida.jpg')], { format: 'images' }, 'Sidans bilder'));
    await opened(await viewers.pageFor(album.id), async (page) => {
      const img = page.querySelector('.dm-v-fig img');
      assert.ok(img.src.startsWith('data:image/'), 'inside the page');
      await waitFor(() => img.naturalWidth > 0, 3000, 'it can be seen');
    });
    const table = await make('Sidans <tabell>', [['namn', 'text'], ['tal', 'number']], [['<i>a</i>', 1], ['b', 2]]);
    await opened(await viewers.pageFor(table.id), async (page) => {
      assert.equal(page.querySelectorAll('.dm-v-table tbody tr').length, 2);
      assert.equal(page.querySelector('.dm-v-table i'), null, 'a value stays a value');
      assert.ok(page.title.includes('<tabell>'), 'the title is escaped too');
    });
    const places = await make('Sidans platser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['A', 20.26, 63.83]]);
    await opened(await viewers.pageFor(places.id), async (page) => {
      assert.ok(page.querySelector('section'), 'a map section');
      assert.equal(page.querySelectorAll('.dm-v-table tbody tr').length, 1, 'and the rows');
    });
    const net = track(await graph.createGraphDataset({ name: 'Sidans graf', graph: NET() }));
    await opened(await viewers.pageFor(net.id), async (page) => {
      assert.ok(page.querySelector('section svg'), 'the network as a picture');
      assert.equal(page.querySelectorAll('.dm-v-table tbody tr').length, 3, 'the nodes');
    });
    const plan = await make('Sidans plan', [['objektid', 'text'], ['objekttyp', 'text'], ['formulering', 'text'], ['geometri', 'text']], [['o1', 'anvandning', 'Bostäder', JSON.stringify({ type: 'Polygon', coordinates: [[[15, 60], [15.1, 60], [15.1, 60.1], [15, 60]]] })]], { kind: 'plan' });
    await opened(await viewers.pageFor(plan.id), async (page) => {
      assert.ok(page.body.textContent.includes('Bostäder'), 'the provisions');
      assert.ok(page.querySelector('section'), 'the map');
    });
    return 'ok';
  }, 45000);

  test('published page: goes through the review and changes nothing in the dataset', async (assert) => {
    const meta = await make('Sidans namn', [['namn', 'text'], ['pnr', 'text']], [['A', '19121212-1212']]);
    await withApp(async (shell, root) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
      const real = shell.ctx.services.files.download;
      const got = [];
      shell.ctx.services.files.download = (blob, name) => { got.push({ blob, name }); };
      try {
        shell.activate('dela');
        const tab = await waitFor(() => Array.from(root.querySelectorAll('dm-tabs [role="tab"], dm-tabs button')).find((b) => b.textContent.trim() === t('dela.tabs.publish')), 3000, 'the tab');
        /** @type {HTMLElement} */ (tab).click();
        const row = await waitFor(() => Array.from(root.querySelectorAll('.dm-row')).find((r) => r.textContent.includes('Sidans namn')), 3000, 'the row');
        /** @type {HTMLElement} */ (row.querySelector('dm-button button')).click();
        // The review opens, since the column looks like personal numbers.
        const dialog = await waitFor(() => document.querySelector('dialog[open]'), 5000, 'the review');
        assert.ok(dialog.textContent.includes('pnr'), 'names the column');
        const select = Array.from(dialog.querySelectorAll('dm-select')).find((s) => /** @type {any} */ (s).options && /** @type {any} */ (s).options.some((o) => o.value === 'drop'));
        /** @type {any} */ (select).value = 'drop';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const go = Array.from(dialog.querySelectorAll('dm-button')).filter((b) => b.getAttribute('variant') === 'primary').pop();
        /** @type {HTMLElement} */ (go.querySelector('button')).click();
        await waitFor(() => got.length === 1, 8000, 'the page');
      } finally { shell.ctx.services.files.download = real; }
      const html = await got[0].blob.text();
      assert.ok(!html.includes('19121212-1212'), 'the value is not in the page');
      assert.equal((await datasets.query(meta.id))[0][1], '19121212-1212', 'and the dataset is as it was');
      assert.ok(!shell.store.get().datasets.some((d) => d.id !== meta.id && d.name === 'Sidans namn'), 'and no copy is left behind');
    });
    return 'ok';
  }, 30000);

  test('bundle: a dataset can leave its files behind, and says how large they are', async (assert) => {
    const album = track(await importer.runFiles([await photo('paket.jpg')], { format: 'images' }, 'Paketalbum'));
    const plain = await make('Pakettabell', [['a', 'integer']], [[1]]);
    await withApp(async (shell) => {
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === album.id), 3000, 'dataset');
      const real = shell.ctx.services.files.download;
      const got = [];
      shell.ctx.services.files.download = (blob, name) => { got.push(blob); };
      try {
        const opening = D.require('ui/share/bundle').shareBundle(shell.ctx, { datasetIds: [album.id, plain.id] });
        const dialog = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'the dialog');
        const sw = /** @type {any} */ (await waitFor(() => Array.from(dialog.querySelectorAll('dm-switch')).find((s) => s.getAttribute('label') === t('bundle.files.pictures')), 3000, 'the choice'));
        await waitFor(() => /\d/.test(sw.parentElement.textContent), 3000, 'the size');
        assert.ok(dialog.textContent.includes(D.require('data/kinds').summary(album)), 'each in its own units');
        sw.checked = false;
        sw.dispatchEvent(new Event('change', { bubbles: true }));
        const create = Array.from(dialog.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('bundle.create'));
        /** @type {HTMLElement} */ (create.querySelector('button')).click();
        // The review may ask; the pictures are not going, so it has little to say.
        for (let i = 0; i < 100 && !got.length; i++) {
          await wait(50);
          const next = document.querySelector('dialog[open]');
          if (next && next !== dialog && i % 10 === 5) {
            const go = Array.from(next.querySelectorAll('dm-button')).filter((b) => b.getAttribute('variant') === 'primary').pop();
            if (go) /** @type {HTMLElement} */ (go.querySelector('button')).click();
          }
        }
        await opening;
        assert.equal(got.length, 1, 'the bundle is made');
      } finally { shell.ctx.services.files.download = real; }
      const entries = await D.require('platform/storage/zip').readZip(got[0]);
      const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
      const entry = manifest.datasets.find((d) => d.name === 'Paketalbum');
      const copy = track(await datasets.importBytes(entries[entry.file].slice().buffer, { name: 'Paketkopia' }));
      assert.deepEqual(await D.require('data/dataset-files').list(copy.id), [], 'no pictures in the copy');
      assert.equal(copy.rowCount, 1, 'the row about the picture stays');
      assert.equal((await D.require('data/dataset-files').list(album.id)).length > 0, true, 'and the album is as it was');
    });
    return 'ok';
  }, 30000);

  test('phone: each kind in its own form, with the rows one step away', async (assert) => {
    const mobile = D.require('mobile/app');
    const views = D.require('mobile/kind-views');
    const fixtures = D.require('tests/fixtures/ifc');
    const album = track(await importer.runFiles([await photo('m.jpg')], { format: 'images' }, 'Mobilalbum'));
    const doc = track(await importer.runFiles([new File(['# Rubrik\n\nEn rad att läsa.\n'], 'a.md', { type: 'text/markdown' })], { format: 'documents' }, 'Mobildokument'));
    const net = track(await graph.createGraphDataset({ name: 'Mobilgraf', graph: NET() }));
    const house = track(await importer.run(fixtures.ifcFile({ walls: 3 }), { format: 'model' }, null, 'Mobilhus'));
    const places = await make('Mobilplatser', [['namn', 'text'], ['lon', 'number'], ['lat', 'number']], [['A', 20.26, 63.83], ['B', 22.15, 65.58]]);
    const plan = await make('Mobilplan', [['objektid', 'text'], ['beteckning', 'text'], ['formulering', 'text']], [['o', 'e1', 'Största byggnadsarea']], { kind: 'plan' });
    const plain = await make('Mobiltabell', [['namn', 'text']], [['a']]);
    const all = [album, doc, net, house, places, plan, plain];
    const bundle = await workspace.bundle({ name: 'Mobilslag', datasetIds: all.map((d) => d.id), include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false } });
    const entries = await D.require('platform/storage/zip').readZip(bundle.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const open = async (name) => {
      const file = manifest.datasets.find((d) => d.name === name).file;
      const view = await mobile.openDataset(bundle.blob, file);
      view.data = await view.rows(0, 50);
      return view;
    };
    const check = async (name, fn) => { const view = await open(name); try { await fn(await views.render(view), view); } finally { view.close(); } };
    await check('Mobilalbum', async (el, view) => {
      assert.equal(view.kind, 'images');
      const img = el.querySelector('img');
      document.body.appendChild(el);
      await waitFor(() => img.naturalWidth > 0, 3000, 'the picture');
      el.remove();
    });
    await check('Mobildokument', async (el) => { assert.ok(el.textContent.includes('En rad att läsa.'), 'read as text'); assert.ok(el.querySelector('h4'), 'with its heading'); });
    await check('Mobilgraf', async (el) => { assert.ok(el.textContent.includes(t('graph.edges.n', { n: 2 })), el.textContent); assert.ok(el.textContent.includes('Namn a')); });
    await check('Mobilhus', async (el) => assert.ok(el.textContent.includes('IfcWall'), el.textContent));
    await check('Mobilplatser', async (el) => assert.equal(el.querySelectorAll('circle').length, 2, 'a dot per place'));
    await check('Mobilplan', async (el) => assert.ok(el.textContent.includes('Största byggnadsarea')));
    await check('Mobiltabell', async (el) => assert.equal(el, null, 'rows say it best'));
    return 'ok';
  }, 45000);

  test('ui: leaving Bearbeta while its table reloads is quiet', async (assert) => {
    const meta = await make('Lämnad tabell', [['namn', 'text']], [['a'], ['b']]);
    const errors = [];
    const onError = (e) => errors.push(String(e.reason));
    globalThis.addEventListener('unhandledrejection', onError);
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset');
        shell.activate('bearbeta');
        shell.store.set({ selectedId: meta.id });
        await waitFor(() => root.querySelector('dm-table'), 5000, 'the table');
        for (let i = 0; i < 5; i++) {
          datasets.notify('changed', { id: meta.id });
          shell.activate('hantera');
          await wait(20);
          shell.activate('bearbeta');
          await waitFor(() => root.querySelector('dm-table'), 5000, 'the table again');
        }
        datasets.notify('changed', { id: meta.id });
        shell.activate('hantera');
        await wait(200);
      });
    } finally { globalThis.removeEventListener('unhandledrejection', onError); }
    assert.deepEqual(errors.filter((e) => e.includes('countBadge')), []);
    return 'ok';
  }, 30000);

  test('adapt8: cleanup', async (assert) => {
    await datasets.flushSaves();
    for (const id of created) if (id) await datasets.remove(id).catch(() => {});
    assert.ok(true);
    return 'ok';
  }, 60000);
})();
