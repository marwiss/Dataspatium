// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The start without the groups (tests/lazy.html, PLAN 4 steps 5 and 6): the page loads only the start list, as the app does, and
 * tries what the start draws and does without the groups 'families', 'plan' and 'import' (src/boot.js), and that what needs a group
 * waits for it. The cases run in order: those that must not load a group first, then what loads it, then what asks for it once it is
 * there. The importers' loading ahead (io/import loadAhead) is counted, not run, so that the first file shows the wait.
 * The test page itself (tests/index.html) loads every group at start, so only this page and tools/check_groups.py see a wait that
 * is missing. Nothing touches the net: the service is virtual (D.net.virtual) and the consent is never asked.
 */
(function () {
  'use strict';
  document.addEventListener('dataspatium:ready', async function () {
    const D = /** @type {any} */ (globalThis).Dataspatium;
    await D.assets.loadScript('harness.js');
    const harness = D.require('tests/harness');
    harness.loading('lazy.test.js');
    const { test } = harness;
    const datasets = D.require('data/datasets');
    const connectors = D.require('api/connectors');
    const consent = D.require('platform/consent');
    const tier = D.require('platform/tier');
    const t = D.require('ui/i18n').t;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
    }
    const loaded = () => D.groups.loaded('families');
    const importer = D.require('io/import');
    const linked = D.require('data/linked');
    /** The importers' loading ahead, counted in place of run until the cleanup. */
    const realAhead = importer.loadAhead;
    let ahead = 0;
    importer.loadAhead = () => { ahead += 1; };
    const realPick = linked.pick;
    const button = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button') || el).click();
    const sourceButton = (id) => waitFor(() => root.querySelector(`.dm-left button[data-source="${id}"]`), 5000, 'the source ' + id);
    /** Files dropped on Inhämta's drop zone (the source Filer). @param {File[]} list */
    async function drop(list) {
      click(await sourceButton('file'));
      const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: list }, bubbles: true }));
    }
    /** The wizard's preview once it shows `text` (dm-table draws its rows on the next frame). @param {string} text */
    const preview = (text) => waitFor(() => { const el = root.querySelector('.dm-center .dm-table-preview'); return el && el.textContent.includes(text) ? el : null; }, 8000, 'the preview with ' + text);
    /** The groups asked for through D.ensure while the page runs, in order (every caller in the app goes through it). */
    const asked = [];
    const ensure = D.ensure;
    D.ensure = (names, then) => { asked.push(...[].concat(names)); return ensure(names, then); };
    const askedSince = (n) => asked.slice(n);
    /** What the consent was asked for: nothing, on this page. */
    const consentAsked = [];
    consent.setAsker(async (purpose) => { consentAsked.push(purpose); return { allow: false }; });
    const BASE = 'dataspatium-asset://tests/lazy';
    const served = [];
    D.net.virtual('tests/lazy/rows', (url) => { served.push(url); return Promise.resolve({ kind: 'text', data: JSON.stringify({ rows: [{ kommun: 'Lund', folk: 20 }, { kommun: 'Umeå', folk: 30 }, { kommun: 'Visby', folk: 5 }] }) }); });
    const CONNECTOR = { format: D.require('api/schema').FORMAT_ID, id: 'lazy-api', name: 'Lat tjänst', baseUrl: BASE, auth: { type: 'none' }, endpoints: [{ id: 'rows', name: 'Rader', method: 'GET', path: '/rows', response: { format: 'json', path: 'rows' }, dataset: { name: 'Lat' } }] };
    const created = [];
    /** @type {any} */ let shell = null;
    /** @type {HTMLElement|null} */ let root = null;
    /** @type {string} */ let apiId = '';
    const heard = [];

    test('lazy: the start list has no family, and the shell starts without the group families', async (assert) => {
      assert.ok(!D.groups.everything, 'only the start list');
      const start = D.groups.start();
      assert.ok(!start.includes('src/api/runner.js') && !start.some((p) => p.startsWith('src/api/families/')), 'no runner, no family at start');
      assert.ok(!D.has('api/runner') && !D.has('api/families/opencde') && !loaded(), 'not loaded');
      D.require('ui/components');
      root = document.createElement('div');
      root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
      document.body.appendChild(root);
      history.replaceState(null, '', location.pathname + location.search);
      const t0 = performance.now();
      shell = await D.require('app').start(root);
      const ms = Math.round(performance.now() - t0);
      await wait(300);
      assert.ok(!loaded() && !asked.includes('families'), 'the start neither loads nor asks for the families: ' + asked.join(','));
      assert.ok(!start.some((p) => p.startsWith('src/io/importers/')) && !D.has('io/importers/csv') && !D.has('io/import-pipeline'), 'no importer at start');
      assert.ok(!D.groups.loaded('import') && !D.groups.loaded('plan') && !asked.includes('import'), 'the start neither loads nor asks for the importers');
      assert.ok(ahead > 0, 'the mode drawn first loads them ahead');
      return start.length + ' scripts at start, the shell in ' + ms + ' ms';
    }, 30000);

    test('lazy: io/import names files at once, and its questions about a file wait for the importers', async (assert) => {
      assert.equal(importer.baseName('lat_fil-1.csv'), 'lat fil 1', 'baseName without the group');
      assert.deepEqual(importer.materialize({ columns: ['a'], rows: [['1']] }, [{ name: 'a', type: 'integer' }]).rows, [[1]], 'materialize without the group');
      let early = null;
      try { importer.importerFor(new File(['a\n1\n'], 'x.csv')); } catch (err) { early = err; }
      assert.ok(early && /ready\(\)/.test(early.message), 'importerFor before the group says to await ready(): ' + (early && early.message));
      assert.ok(!D.groups.loaded('import'), 'still not loaded');
      return 'ok';
    });

    test('lazy: a new plan in Inhämta waits for the group plan, not for the importers', async (assert) => {
      await shell.activate('inhamta');
      const t0 = performance.now();
      click(await sourceButton('newplan'));
      await waitFor(() => root.querySelector('.dm-center [data-newplan="name"]'), 8000, 'the form of a new plan');
      assert.ok(D.groups.loaded('plan') && D.has('data/plan-new'), 'the group plan is loaded');
      assert.ok(!D.groups.loaded('import') && !loaded(), 'neither the importers nor the families');
      return 'the form, with the group, in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: a CSV dropped in Inhämta waits for the importers, then shows its preview with the choices of a CSV', async (assert) => {
      assert.ok(!D.groups.loaded('import'), 'the importers are not loaded yet');
      const before = asked.length;
      const t0 = performance.now();
      await drop([new File(['kommun;folk\nLund;20\nUmeå;30\n'], 'lat-tabell.csv', { type: 'text/csv' })]);
      await preview('Umeå');
      const ms = Math.round(performance.now() - t0);
      assert.ok(root.querySelector(`.dm-center dm-select[label="${t('import.delimiter')}"]`), 'the delimiters of the CSV importer');
      assert.ok(root.querySelector('.dm-center .dm-sense'), 'what the file is (io/file-sense)');
      assert.ok(D.groups.loaded('import') && askedSince(before).includes('import'), 'the group import was asked for and loaded');
      assert.ok(!loaded(), 'the families are not loaded');
      return 'previewed, with the group, in ' + ms + ' ms';
    }, 30000);

    test('lazy: pasted text and a web address are read through the importers', async (assert) => {
      let t0 = performance.now();
      click(await sourceButton('paste'));
      const box = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-center dm-input[type="textarea"]'), 5000, 'the text box'));
      box.value = 'namn,antal\nA,1\nB,2\n';
      click(await waitFor(() => button(t('import.paste.use')), 3000, 'Använd'));
      assert.ok(await preview('B'), 'the pasted rows');
      const paste = Math.round(performance.now() - t0);
      const servedBefore = served.length;
      D.net.virtual('tests/lazy/punkter.csv', (url) => { served.push(url); return Promise.resolve({ kind: 'text', data: 'plats,lon,lat\nLund,13.19,55.70\n' }); });
      try {
        t0 = performance.now();
        click(await sourceButton('url'));
        const input = /** @type {any} */ (await waitFor(() => root.querySelector('.dm-center dm-input[type="url"]'), 5000, 'the address'));
        input.value = BASE + '/punkter.csv';
        click(await waitFor(() => button(t('import.url.fetch')), 3000, 'Hämta'));
        assert.ok(await preview('Lund'), 'the rows from the address');
      } finally { D.net.unvirtual('tests/lazy/punkter.csv'); }
      assert.equal(served.length - servedBefore, 1, 'one request to the virtual address');
      assert.ok(!loaded() && consentAsked.length === 0, 'no families, nothing asked');
      return 'pasted in ' + paste + ' ms, fetched in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: a QGIS project dropped in Inhämta opens with its layers', async (assert) => {
      const qgs = `<qgis projectname="Lat" version="3.34.6"><title>Lat projekt</title><projectCrs><spatialrefsys><authid>EPSG:4326</authid></spatialrefsys></projectCrs>
<layer-tree-group><layer-tree-layer id="p_1" name="Punkter" checked="Qt::Checked" source="./punkter.csv" providerKey="delimitedtext"/></layer-tree-group>
<projectlayers><maplayer geometry="Point" type="vector"><id>p_1</id><datasource>./punkter.csv?xField=lon&amp;yField=lat</datasource><layername>Punkter</layername><provider>delimitedtext</provider></maplayer></projectlayers></qgis>`;
      const t0 = performance.now();
      await drop([new File([qgs], 'lat.qgs', { type: 'application/xml' }), new File(['namn,lon,lat\nLund,13.19,55.70\n'], 'punkter.csv', { type: 'text/csv' })]);
      await waitFor(() => root.querySelector(`.dm-center dm-input[label="${t('import.project.name')}"]`), 8000, 'the project step');
      assert.ok(root.querySelector('.dm-center').textContent.includes(t('import.project.layer.import', { file: 'punkter.csv' })), 'its layer, from the file dropped with it');
      assert.ok(!loaded(), 'the families are not loaded');
      return 'opened in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: a plan file, an example, a linked file and photos from the field are read through io/import', async (assert) => {
      const times = [];
      const timed = async (label, fn) => { const t0 = performance.now(); const out = await fn(); times.push(label + ' ' + Math.round(performance.now() - t0) + ' ms'); return out; };
      const plan = await timed('plan', () => importer.run(new File([JSON.stringify(planFile())], 'lat-plan.json', { type: 'application/json' }), {}, null, 'Lat plan'));
      created.push(plan.id);
      assert.equal(plan.kind, 'plan', 'a plan dataset');
      const example = await timed('example', () => importer.runPreset(D.require('presets').examples[0]));
      created.push(example.id);
      assert.ok(((await datasets.get(example.id)) || {}).rowCount > 0, 'the example has rows');
      // A linked file read again from "disk" (a test double for the handle), as Uppdatera does.
      let text = 'kommun;antal\nUmeå;3\n';
      const handle = { kind: 'file', name: 'lat-lankad.csv', getFile: async () => new File([text], 'lat-lankad.csv', { type: 'text/csv' }), queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
      const link = await timed('linked', async () => { const m = await importer.run(await handle.getFile(), { linked: true }, null, 'Lat länkad'); await linked.link(m.id, handle); return m; });
      created.push(link.id);
      text = 'kommun;antal\nUmeå;3\nLund;4\n';
      const again = await timed('read again', () => linked.refetch(link.source, { datasetId: link.id }));
      assert.equal(again.rows.length, 2, 'the linked file read again');
      // Rows from the phone with a photo: the photos become an image collection through the image importer.
      const collect = D.require('data/field-collect'); const fieldForm = D.require('data/field-form');
      const inventory = await datasets.create({ name: 'Lat inventering', columns: [{ name: 'plats', type: 'text' }], rows: [['Hem']] });
      created.push(inventory.id);
      const form = await collect.compile(inventory.id, Object.assign(await collect.formFor(inventory.id), { position: 'off', photo: 'optional' }));
      const jpeg = await photo();
      const pack = await fieldForm.packRows(form, [{ id: 'rad_1', createdAt: '2026-06-01T10:00:00.000Z', values: { plats: 'Ute' }, position: null, photos: [{ name: 'rad_1-1.jpg', size: jpeg.size, type: 'image/jpeg' }], warnings: [] }], async () => jpeg.arrayBuffer(), { device: 'Lat mobil' });
      const res = await timed('field', async () => collect.apply(await collect.plan(await fieldForm.readPackage(pack.blob))));
      if (res.imagesId) created.push(res.imagesId);
      assert.ok(res.rows === 1 && res.photos === 1 && res.imagesId, 'the row and its photo: ' + JSON.stringify({ rows: res.rows, photos: res.photos }));
      // The same file picked through the picker of linked files in Inhämta, where the browser has one (a test double here).
      if (linked.supported()) {
        linked.pick = async () => ({ handle, file: await handle.getFile() });
        try {
          click(await sourceButton('file'));
          click(await waitFor(() => button(t('linked.pick')), 3000, 'the picker of linked files'));
          assert.ok(await preview('Lund'), 'the linked file in the preview');
          times.push('picked');
        } finally { linked.pick = realPick; }
      }
      click(await sourceButton('file'));
      assert.ok(!loaded(), 'the families are not loaded');
      return times.join(', ');
    }, 45000);

    test('lazy: Inhämta lists a dataset from an API among the saved fetches without the families', async (assert) => {
      await connectors.importJson(JSON.stringify(CONNECTOR));
      const meta = await datasets.create({ name: 'Lat hämtning', columns: [{ name: 'kommun', type: 'text', label: 'kommun' }, { name: 'folk', type: 'integer', label: 'folk' }], rows: [['Stockholm', 100], ['Malmö', 50]],
        source: { kind: 'api', connectorId: CONNECTOR.id, connectorName: CONNECTOR.name, endpointId: 'rows', endpointName: 'Rader', params: {}, rows: 2 }, importOptions: { decimal: 'point' } });
      created.push(meta.id); apiId = meta.id;
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'the dataset in the store');
      const t0 = performance.now();
      await shell.activate('inhamta');
      const item = await waitFor(() => Array.from(root.querySelectorAll('.dm-left button.dm-list-item')).find((b) => b.textContent.includes(t('api.saved.title'))), 5000, 'the saved fetches');
      /** @type {HTMLElement} */ (item).click();
      const row = await waitFor(() => Array.from(root.querySelectorAll('.dm-center tbody tr')).find((tr) => tr.textContent.includes('Lat hämtning')), 5000, 'the dataset listed');
      assert.ok(row.querySelector(`dm-button[label="${t('api.saved.update')}"]`), 'with its update');
      assert.ok(!loaded(), 'the families are not loaded');
      return 'listed in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: Hantera shows a dataset from an API, its update and its watch without the families', async (assert) => {
      const watches = D.require('data/watches');
      // A watch that read the source once through a fetch of the test's own, which the update below brings back to the same.
      const rec = await watches.setWatched(apiId, true, { fetch: async () => ({ columns: ['kommun', 'folk'], rows: [['Ny', 1], ['Ny', 2], ['Ny', 3]] }) });
      assert.equal(rec.state, 'new', 'the watch sees three rows where the dataset has two');
      const t0 = performance.now();
      shell.store.set({ selectedId: apiId });
      await shell.activate('hantera');
      await waitFor(() => root.querySelector(`dm-button[label="${t('api.refetch')}"]`), 5000, 'the button Uppdatera');
      assert.ok(!loaded(), 'the families are not loaded');
      return 'drawn in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: the palette offers api:refresh without the families', async (assert) => {
      const cmds = await shell.palette.collect();
      assert.ok(cmds.some((c) => c.id === 'api:refresh'), 'api:refresh among ' + cmds.length);
      assert.ok(!loaded(), 'the families are not loaded');
      return 'ok';
    });

    test('lazy: a BCF file the tier does not read is refused before the families load', async (assert) => {
      const before = asked.length;
      try {
        await tier.set(1);
        let refused = null;
        try { await shell.ctx.services.importer.preview(new File(['PK'], 'fynd.bcfzip')); } catch (err) { refused = err; }
        assert.ok(refused && refused.name === 'TierError' && refused.tierFeature === 'import:bcf', 'refused by the tier: ' + (refused && refused.message));
      } finally { await tier.set(3); }
      assert.ok(!loaded() && !askedSince(before).includes('families'), 'the families are neither loaded nor asked for');
      return 'ok';
    });

    test('lazy: a BCF file at the tier that reads it loads the group families and is read', async (assert) => {
      await D.assets.loadScript('fixtures/bcf-fixture.js');
      const fx = D.require('tests/fixtures/bcf');
      const file = new File([await D.require('platform/storage/zip').createZip(fx.bytesOf(fx.v30))], 'lat-fynd.bcfzip', { type: 'application/zip' });
      const before = asked.length;
      const t0 = performance.now();
      const p = await shell.ctx.services.importer.preview(file);
      assert.ok(p.importer === 'bcf' && p.dataRows.length > 0, 'the topics of the file: ' + p.importer);
      assert.ok(loaded() && askedSince(before).includes('families'), 'the group families asked for and loaded');
      return 'read, with the group, in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: the palette\'s api:refresh fetches from a virtual service, loading the families first', async (assert) => {
      const stop = connectors.onFetched((id, table) => { heard.push([id, table.rows.length]); });
      const cmd = (await shell.palette.collect()).find((c) => c.id === 'api:refresh');
      const t0 = performance.now();
      try { await cmd.run(); } finally { stop(); }
      const ms = Math.round(performance.now() - t0);
      assert.ok(loaded(), 'the group families is loaded');
      const rows = served.filter((u) => u.startsWith(BASE + '/rows'));
      assert.ok(rows.length === 1, 'one request to the virtual service: ' + served.join(' '));
      assert.deepEqual(await datasets.query(apiId, { limit: 10 }), [['Lund', 20], ['Umeå', 30], ['Visby', 5]], 'the rows of the service');
      assert.equal(consentAsked.length, 0, 'nothing asked');
      return 'updated, with the group, in ' + ms + ' ms';
    }, 30000);

    test('lazy: onFetched in api/connectors tells the listeners and the watches of the update', async (assert) => {
      assert.deepEqual(heard, [[apiId, 3]], 'the listener heard the dataset and the table it was read from');
      const rec = await D.require('data/watches').get(apiId);
      assert.ok(rec && rec.state === 'same' && rec.baseline && rec.baseline.rows === 3, 'the watch took what it was made from: ' + JSON.stringify(rec && { state: rec.state, rows: rec.baseline && rec.baseline.rows }));
      return 'ok';
    });

    test('lazy: Hantera shows a dataset from a CDE with its card, which asks for the families', async (assert) => {
      // Counted from before the dataset is made: the shell may select and draw it as soon as it reads the list again.
      const before = asked.length;
      const meta = await datasets.create({ name: 'Lat CDE-fil', columns: [{ name: 'a', type: 'integer' }], rows: [[1]],
        source: { kind: 'file', fileName: 'lat.csv', cde: { connectorId: 'lazy-cde', host: 'cde.lazy.test', projectId: 'p1', projectName: 'Projektet', kind: 'document', documentId: 'doc-1', versionIndex: 1, fetchedAt: new Date().toISOString() } } });
      created.push(meta.id);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'the dataset in the store');
      const t0 = performance.now();
      // The shell selects a dataset it has made once it has read the list again (ui/shell): the CDE file is chosen until it shows.
      await waitFor(() => { if (shell.store.get().selectedId !== meta.id) shell.store.set({ selectedId: meta.id }); return root.querySelector('[data-card="cde"] [data-cde-check]'); }, 5000, 'the CDE card with Kontrollera');
      assert.ok(askedSince(before).includes('families'), 'the card loads the family ahead');
      return 'drawn in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: a model from the server without an IFC file is drawn from its glTF, through the group families', async (assert) => {
      const meta = await datasets.create({ name: 'Lat servermodell', kind: 'model', columns: [{ name: 'id', type: 'integer' }, { name: 'guid', type: 'text' }, { name: 'typ', type: 'text' }], rows: [[101, '1WallGuid00000000000A', 'IfcWall']],
        source: { kind: 'file', fileName: 'hus.ifc', large: { lod: 'box' } } });
      created.push(meta.id);
      await D.require('data/dataset-files').put(await datasets.ensureOpen(meta.id), [{ name: 'geometry.glb', kind: 'geometry', type: 'model/gltf-binary', bytes: glb() }]);
      assert.equal(await D.require('data/model').original(meta.id), null, 'no IFC file');
      const before = asked.length;
      const t0 = performance.now();
      const draw = D.require('viz/model-draw');
      const drawn = await draw.meshesOf(meta.id);
      assert.ok(askedSince(before).includes('families'), 'the drawing asks for the group');
      assert.ok(drawn.elements === 1 && drawn.byElement.has(101), 'the server geometry drawn: ' + drawn.elements);
      draw.clearCache();
      return 'meshes in ' + Math.round(performance.now() - t0) + ' ms';
    }, 30000);

    test('lazy: cleanup', async () => {
      for (const dlg of document.querySelectorAll('dialog')) dlg.remove();
      await D.require('data/watches').setWatched(apiId, false);
      for (const id of created) await datasets.remove(id, { quiet: true }).catch(() => {});
      await connectors.remove(CONNECTOR.id);
      D.net.unvirtual('tests/lazy/rows');
      importer.loadAhead = realAhead;
      linked.pick = realPick;
      if (root) root.remove();
      return 'ok';
    });

    /** A small detaljplan per Detaljplan 4.1: the plan and one provision. */
    function planFile() {
      const square = (x0, y0, d) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0 + d, y0], [x0 + d, y0 + d], [x0, y0 + d], [x0, y0]]] });
      const g = (position) => [{ geometri: { typ: 'yta', position, koordinatsystemPlan: 'EPSG:3006', dimension: 2 } }];
      return { type: 'FeatureCollection', 'feature:mediatyp': 'application/vnd.lm.detaljplan.v4+json', features: [
        { type: 'Feature', id: 'p1', geometry: null, properties: { 'feature:typ': 'detaljplan', objektidentitet: 'p1', namn: 'Lat plan', beteckning: 'DP 1', status: 'laga kraft', kommun: '1280', plangeometri: g(square(374000, 6164000, 200)) } },
        { type: 'Feature', id: 'b1', geometry: null, properties: { 'feature:typ': 'användningsbestämmelse', detaljplan: 'p1', objektidentitet: 'b1', bestammelseformulering: 'Bostäder', planbestammelsekatalogreferens: 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36', bestammelsegeometri: g(square(374000, 6164000, 100)) } },
      ] };
    }
    /** A small JPEG, as a camera would hand it over. */
    async function photo() {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
      const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')); g.fillStyle = '#336699'; g.fillRect(0, 0, 64, 48);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      return new File([/** @type {Blob} */ (blob)], 'rad_1-1.jpg', { type: 'image/jpeg' });
    }

    /** A binary glTF with one triangle, the element 101 (an IfcWall). */
    function glb() {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const indices = new Uint16Array([0, 1, 2]);
      const bin = new Uint8Array(positions.byteLength + indices.byteLength);
      bin.set(new Uint8Array(positions.buffer), 0); bin.set(new Uint8Array(indices.buffer), positions.byteLength);
      const json = {
        asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
        nodes: [{ name: '1WallGuid00000000000A', mesh: 0, extras: { class: 'IfcWall', step: 101 } }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
        materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.2, 0.2, 1] } }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
        buffers: [{ byteLength: bin.byteLength }],
      };
      const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
      const pad = (n) => (4 - (n % 4)) % 4;
      const jsonLen = jsonBytes.length + pad(jsonBytes.length); const binLen = bin.length + pad(bin.length);
      const out = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
      const dv = new DataView(out.buffer);
      dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
      dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4E4F534A, true); out.set(jsonBytes, 20); out.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen);
      dv.setUint32(20 + jsonLen, binLen, true); dv.setUint32(24 + jsonLen, 0x004E4942, true); out.set(bin, 28 + jsonLen);
      return out;
    }

    // Every function is tried, as on the test page (tests/start.js): the tier Experimentell.
    await tier.set(3);
    harness.run(document.getElementById('results'), document.getElementById('summary'));
  });
  document.addEventListener('dataspatium:boot-error', function (ev) {
    console.log('DATASPATIUM-LOG: FAIL | boot :: ' + /** @type {any} */ (ev).detail);
    console.log('DATASPATIUM-TESTS: pass=0 fail=1');
  });
})();
