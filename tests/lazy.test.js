// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The start without the groups (tests/lazy.html, PLAN 4 step 5): the page loads only the start list, as the app does, and tries
 * what the start draws and does without the group 'families' (src/boot.js), and that what needs the group waits for it. The cases
 * run in order: those that must not load the group first, then an update that loads it, then what asks for it once it is there.
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
      return start.length + ' scripts at start, the shell in ' + ms + ' ms';
    }, 30000);

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

    test('lazy: the palette\'s api:refresh fetches from a virtual service, loading the families first', async (assert) => {
      const stop = connectors.onFetched((id, table) => { heard.push([id, table.rows.length]); });
      const cmd = (await shell.palette.collect()).find((c) => c.id === 'api:refresh');
      const t0 = performance.now();
      try { await cmd.run(); } finally { stop(); }
      const ms = Math.round(performance.now() - t0);
      assert.ok(loaded(), 'the group families is loaded');
      assert.ok(served.length === 1 && served[0].startsWith(BASE + '/rows'), 'one request to the virtual service: ' + served.join(' '));
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
      const meta = await datasets.create({ name: 'Lat CDE-fil', columns: [{ name: 'a', type: 'integer' }], rows: [[1]],
        source: { kind: 'file', fileName: 'lat.csv', cde: { connectorId: 'lazy-cde', host: 'cde.lazy.test', projectId: 'p1', projectName: 'Projektet', kind: 'document', documentId: 'doc-1', versionIndex: 1, fetchedAt: new Date().toISOString() } } });
      created.push(meta.id);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'the dataset in the store');
      const before = asked.length;
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
      if (root) root.remove();
      return 'ok';
    });

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
