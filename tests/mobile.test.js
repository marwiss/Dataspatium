// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Dataspatium Mobil (mobile/app): a phone connects to a computer's offer, shows its code, receives a
 * bundle, lists and views the datasets inside it, keeps it, and can drop it again.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  const p2p = D.require('platform/p2p');
  const mobile = D.require('mobile/app');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  test('mobile: the phone page connects, shows its code, receives a bundle and views the datasets inside it', async (assert) => {
    const datasets = D.require('data/datasets');
    const workspace = D.require('data/workspace');
    const ds = await D.require('io/import').run(new File(['kommun;antal\nUmeå;3\nLuleå;4\nKiruna;5\n'], 'mobil.csv', { type: 'text/csv' }), {}, null, 'Mobiltest');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:400px; height:800px;';
    document.body.appendChild(root);
    let app = null; let computer = null;
    try {
      const bundle = await workspace.bundle({ name: 'Mobilpaket', datasetIds: [ds.id], include: { charts: false, dashboards: false, documents: false, notebooks: false, scripts: false }, author: 'Testaren', message: 'Hej från datorn' });
      computer = p2p.offer();
      await waitFor(() => computer.offerPayload, 10000, 'offer');
      // The phone has its own certificate; it opens the page from the QR code, so the offer is in the hash.
      const certB = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' });
      app = await mobile.start(root, { hash: '#o=' + computer.offerPayload, certificate: certB });
      assert.equal(app.state.screen, 'connect');
      await waitFor(() => app.state.session && app.state.session.answerCode, 10000, 'answer code');
      await waitFor(() => root.querySelector('.dm-m-identity') && root.querySelector('.dm-m-identity').textContent === app.state.session.answerCode, 3000, 'code shown on the phone');
      await computer.acceptAnswer(app.state.session.answerCode);
      await waitFor(() => computer.state === 'connected' && app.state.session.state === 'connected' && computer.peerInfo && app.state.session.peerInfo, 15000, 'connected');
      await waitFor(() => root.querySelector('.dm-m-code') && root.querySelector('.dm-m-code').textContent === computer.code, 3000, 'verification code on the phone');
      // The computer sends the bundle; the phone asks and the user accepts.
      const sending = computer.send([{ name: 'Mobilpaket.dataspatium.zip', type: 'application/zip', data: bundle.blob, kind: 'bundle' }]);
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 8000, 'incoming dialog');
      assert.ok(dlg.textContent.includes('Mobilpaket.dataspatium.zip') && dlg.textContent.includes(computer.code), 'dialog names the file and shows the code');
      /** @type {HTMLElement} */ (Array.from(dlg.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === t('mobile.incoming.accept')).querySelector('button')).click();
      const res = await sending;
      assert.equal(res.confirmed.length, 1, 'confirmed by the phone');
      await waitFor(() => app.state.bundles.length === 1, 8000, 'bundle kept');
      const b = app.state.bundles[0];
      assert.equal(b.kind, 'bundle');
      assert.equal(b.title, 'Mobilpaket');
      assert.equal(b.message, 'Hej från datorn');
      assert.equal(b.datasets.length, 1);
      assert.equal(b.datasets[0].name, 'Mobiltest');
      assert.ok(b.from, 'remembers who sent it: ' + b.from);
      const again = await mobile.listBundles();
      assert.equal(again[0].id, b.id, 'stored in IndexedDB');
      // Back to the start: the bundle is listed; open it and view the dataset.
      app.back();
      assert.equal(app.state.screen, 'start');
      assert.ok(root.textContent.includes('Mobilpaket'), 'listed on the start screen');
      await app.openBundle(b.id);
      assert.ok(root.textContent.includes('Mobiltest') && root.textContent.includes('Hej från datorn'), 'bundle screen shows the dataset and the message');
      await app.openDatasetView(b, b.datasets[0]);
      await waitFor(() => app.state.view && app.state.view.data && app.state.view.data.length === 3, 8000, 'rows loaded');
      assert.equal(root.querySelectorAll('.dm-m-table tbody tr').length, 3, 'three rows in the table');
      assert.ok(root.textContent.includes('Kiruna'), 'values shown');
      app.state.filter = 'Lule';
      await app.loadRows();
      assert.equal(app.state.view.data.length, 1, 'filter narrows the rows');
      assert.equal(app.state.view.shown, 1);
      app.back();
      assert.equal(app.state.screen, 'bundle');
      assert.ok(!app.state.view, 'engine closed on leaving the table');
      // Drop it again.
      await mobile.removeBundle(b.id);
      assert.equal((await mobile.listBundles()).length, 0, 'removed');
      assert.equal(await mobile.loadBlob(b.id), null, 'blob removed');
      return 'ok';
    } finally {
      if (app) app.destroy();
      if (computer) computer.close();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      for (const b of await mobile.listBundles()) await mobile.removeBundle(b.id);
      for (const p of await p2p.peers()) await p2p.forget(p.id);
      await datasets.remove(ds.id);
      root.remove();
    }
  }, 60000);

  test('mobile: a plain file and a bundle are described from their contents', async (assert) => {
    const plain = await mobile.describe(new Blob(['a;b\n1;2\n'], { type: 'text/csv' }), 'tabell.csv');
    assert.equal(plain.kind, 'file');
    assert.equal(plain.datasets.length, 0);
    const zip = D.require('platform/storage/zip');
    const blob = await zip.createZip({ 'manifest.json': JSON.stringify({ app: 'Dataspatium', kind: 'bundle', name: 'Litet paket', author: 'A', message: 'M', datasets: [{ id: 'x', name: 'X', rowCount: 2, columnCount: 1, file: 'datasets/x.sqlite' }], charts: [{ id: 'c' }] }), 'datasets/x.sqlite': new Uint8Array([1, 2, 3]) });
    const described = await mobile.describe(blob, 'paket.zip');
    assert.equal(described.kind, 'bundle');
    assert.equal(described.title, 'Litet paket');
    assert.equal(described.datasets.length, 1);
    assert.equal(described.counts.charts, 1);
    const missing = await zip.createZip({ 'manifest.json': JSON.stringify({ datasets: [{ id: 'y', name: 'Y', file: 'datasets/y.sqlite' }] }) });
    assert.equal((await mobile.describe(missing, 'trasigt.zip')).datasets.length, 0, 'datasets without a file in the zip are left out');
    return 'ok';
  });
})();
