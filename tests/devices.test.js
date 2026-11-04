// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the Enheter tab in Dela: the QR offer, a phone (second session in the page) connecting with its code,
 * the incoming-transfer dialog, import of a received file, and pairing.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  const p2p = D.require('platform/p2p');

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

  test('dela: the Enheter tab shows a QR offer, a device connects with its code, a file is received and the device is paired', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const datasets = shell.ctx.services.datasets;
    const before = new Set((await datasets.list()).map((d) => d.id));
    let phone = null;
    try {
      shell.activate('dela');
      const tab = await waitFor(() => Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((el) => el.textContent.trim() === t('dela.tabs.devices')), 5000, 'devices tab');
      /** @type {HTMLElement} */ (tab).click();
      const mode = shell.modes.get('dela');
      const panel = await waitFor(() => mode.devicesPanel, 5000, 'devices panel');
      assert.ok(root.querySelector('.dm-center .dm-devices-identity'), 'the device code is shown');
      await panel.startOffer();
      await waitFor(() => panel.session && panel.session.offerPayload, 10000, 'offer payload');
      await waitFor(() => root.querySelector('.dm-center .dm-devices-qr svg'), 5000, 'QR code drawn');
      assert.ok(root.textContent.includes(t('devices.status.waiting')), 'waiting status shown');
      // A new phone: its own certificate; it answers and shows its code, which the user types into the computer.
      const certB = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' });
      phone = p2p.answer(panel.session.offerPayload, { certificate: certB });
      await waitFor(() => phone.answerCode, 10000, 'phone code');
      await panel.connectWithAnswer(phone.answerCode);
      await waitFor(() => panel.session.state === 'connected' && phone.state === 'connected' && panel.session.peerInfo && phone.peerInfo, 15000, 'connected both ways');
      await waitFor(() => root.querySelector('.dm-center .dm-devices-code'), 3000, 'verification code shown');
      assert.equal(root.querySelector('.dm-center .dm-devices-code').textContent, panel.session.code, 'the code on screen is the session code');
      assert.equal(phone.code, panel.session.code, 'the phone shows the same code');
      // The phone sends a CSV; the computer asks, the user accepts, and the file becomes a dataset.
      const sending = phone.send([{ name: 'telefon-data.csv', type: 'text/csv', data: new Blob(['a;b\n1;2\n3;4\n'], { type: 'text/csv' }), kind: 'file' }]);
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 8000, 'incoming dialog');
      assert.ok(dlg.textContent.includes('telefon-data.csv'), 'dialog names the file');
      assert.ok(dlg.textContent.includes(panel.session.code), 'dialog shows the verification code');
      const accept = Array.from(dlg.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === t('devices.incoming.accept'));
      /** @type {HTMLElement} */ (accept.querySelector('button')).click();
      const res = await sending;
      assert.equal(res.confirmed.length, 1, 'phone got the confirmation');
      const imported = await waitFor(() => (shell.store.get().datasets || []).find((d) => !before.has(d.id) && /telefon/i.test(d.name)), 10000, 'imported dataset');
      assert.equal(imported.rowCount, 2, 'two rows imported');
      // Pairing: the computer remembers the phone; the phone stores the secret when told.
      await panel.pairNow();
      await waitFor(async () => (await p2p.peers()).some((p) => p.id === phone.fingerprint), 5000, 'phone paired on the computer');
      await waitFor(() => phone.paired, 5000, 'phone paired too');
      assert.ok(root.textContent.includes(t('devices.peers.title')), 'paired devices listed');
      return 'ok';
    } finally {
      if (phone) phone.close();
      shell.activate('hantera');
      for (const d of await datasets.list()) if (!before.has(d.id)) await datasets.remove(d.id);
      for (const p of await p2p.peers()) await p2p.forget(p.id);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 60000);
})();
