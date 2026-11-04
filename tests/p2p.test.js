// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for platform/p2p: payload codes, the SDP template, derived credentials, and loopback transfers between two
 * sessions in the same page (first contact with the fingerprint code, pairing, one-scan reconnect, resumption).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const p2p = D.require('platform/p2p');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 10000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }
  const untilState = async (s, state, ms = 15000) => {
    const t0 = performance.now();
    while (s.state !== state) {
      if (s.state === 'failed') throw new Error(s.role + ' failed: ' + s.error);
      if (performance.now() - t0 > ms) throw new Error(`timeout waiting for ${state} (${s.role}, now ${s.state}, pc ${s.pc ? s.pc.connectionState + '/' + s.pc.iceConnectionState : 'none'})`);
      await wait(50);
    }
  };
  /** Receives everything offered; resolves with the items when `count` have arrived. */
  function collector(session, count) {
    const items = [];
    session.on('offer', (o) => o.accept());
    return { items, done: new Promise((resolve, reject) => { session.on('item', (it) => { items.push(it); if (items.length >= count) resolve(items); }); session.on('error', reject); }) };
  }
  const bytes = (n, seed = 1) => { const a = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; a[i] = x >>> 16; } return a; };

  test('p2p: codes, base32, the SDP template and derived credentials', async (assert) => {
    assert.ok(p2p.supported(), 'WebRTC with certificates and WebCrypto available');
    const fp = new Uint8Array(32).map((_v, i) => i * 7 + 1);
    const code = p2p.toBase32(fp);
    assert.equal(code.length, 52);
    assert.deepEqual(Array.from(p2p.fromBase32(p2p.groupCode(code).toLowerCase())), Array.from(fp), 'base32 round trip ignores dashes and case');
    assert.equal(p2p.groupCode(code).split('-').length, 13, '13 groups of four');
    const offer = { v: 1, t: 'o', s: 'abcdefgh', u: 'ufragAB1', p: 'pwd0123456789abcdefghijk', f: 'AAAA', c: [['abc.local', 50000]], n: 'Dator' };
    const payload = p2p.encodePayload(offer);
    assert.deepEqual(p2p.decodePayload(payload), offer, 'payload round trip');
    assert.deepEqual(p2p.decodePayload('https://example.org/m/#o=' + payload), offer, 'payload taken from a URL');
    const typed = p2p.decodePayload(p2p.groupCode(code));
    assert.equal(typed.t, 'a');
    assert.deepEqual(Array.from(p2p.fromBase32(code)), Array.from(fp));
    await assert.throws(() => Promise.resolve().then(() => p2p.decodePayload('not a code')), /./);
    const sdp = p2p.buildSdp({ ufrag: 'u1', pwd: 'p1', fingerprint: 'ab'.repeat(32), candidates: [['10.0.0.5', 1234]], setup: 'actpass' });
    assert.ok(sdp.includes('m=application 9 UDP/DTLS/SCTP webrtc-datachannel'), 'data channel m-line');
    assert.ok(sdp.includes('a=fingerprint:sha-256 AB:AB:'), 'fingerprint with colons');
    assert.ok(sdp.includes('a=candidate:1 1 udp 2113937151 10.0.0.5 1234 typ host'), 'candidate line');
    assert.ok(sdp.includes('a=end-of-candidates'), 'end of candidates when there are candidates');
    assert.ok(!p2p.buildSdp({ ufrag: 'u', pwd: 'p', fingerprint: 'ab'.repeat(32), candidates: [], setup: 'active' }).includes('end-of-candidates'));
    assert.deepEqual(p2p.hostCandidates('a=candidate:1 1 udp 2113937151 abc.local 5000 typ host generation 0\r\na=candidate:2 1 tcp 1 10.0.0.1 9 typ host tcptype active\r\na=candidate:3 1 udp 1 1.2.3.4 6000 typ srflx\r\n'), [['abc.local', 5000]], 'only udp host candidates');
    const secret = new Uint8Array(16).fill(3);
    const a = await p2p.deriveCredentials(secret, 'session1');
    const b = await p2p.deriveCredentials(secret, 'session1');
    const c = await p2p.deriveCredentials(secret, 'session2');
    assert.deepEqual(a, b, 'deterministic');
    assert.ok(a.ufrag !== c.ufrag && a.pwd !== c.pwd, 'differs per session');
    assert.ok(/^[A-Za-z0-9]{8}$/.test(a.ufrag) && /^[A-Za-z0-9]{24}$/.test(a.pwd), 'ICE characters only');
    const code1 = await p2p.verificationCode('aa', 'bb', 's');
    assert.equal(code1, await p2p.verificationCode('bb', 'aa', 's'), 'verification code is symmetric');
    assert.ok(/^\d{6}$/.test(code1));
    return 'ok';
  });

  test('p2p: the device identity is stored and reused', async (assert) => {
    const first = await p2p.identity();
    assert.ok(/^[0-9a-f]{64}$/.test(first.fingerprint), 'sha-256 fingerprint ' + first.fingerprint);
    assert.equal(first.code.replace(/-/g, '').length, 52);
    assert.ok(first.name, 'has a name');
    const second = await p2p.identity();
    assert.equal(second.fingerprint, first.fingerprint, 'same certificate again');
    await p2p.setDeviceName('Testdator');
    assert.equal((await p2p.identity()).name, 'Testdator');
    return first.fingerprint.slice(0, 12);
  });

  test('p2p: first contact with the fingerprint code, transfer with checksums, pairing, then one scan and resumption', async (assert) => {
    const certB = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' });
    const sessions = [];
    const open = (s) => { sessions.push(s); return s; };
    // Progress marks in the browser console: a hang shows the last step reached and every session's state.
    const step = (label) => console.log('[p2p-test] ' + label + ' | ' + sessions.map((s) => s.role + ':' + s.state + (s.pc ? '/' + s.pc.connectionState : '')).join(' '));
    const watchdog = setInterval(() => step('tick'), 5000);
    try {
      // 1. Computer A offers; new phone B answers; A gets B's fingerprint as the typed code.
      const a = open(p2p.offer());
      await untilState(a, 'waiting');
      assert.ok(a.offerPayload, 'offer payload');
      const url = await a.offerUrl();
      assert.ok(url.includes('/m/#o='), 'mobile URL carries the offer: ' + url.slice(0, 40));
      const decoded = p2p.decodePayload(url);
      assert.ok(decoded.k && decoded.c.length >= 0 && decoded.u.length === 8, 'offer has bootstrap secret and credentials');
      const b = open(p2p.answer(url, { certificate: certB }));
      await waitFor(() => b.answerCode, 10000, 'answer code');
      assert.equal(b.answerCode.replace(/-/g, '').length, 52, 'typed code is the fingerprint');
      step('answer code');
      await a.acceptAnswer(b.answerCode);
      await untilState(a, 'connected');
      await untilState(b, 'connected');
      step('connected');
      await waitFor(() => a.peerInfo && b.peerInfo, 5000, 'hello both ways');
      step('hello');
      assert.equal(a.code, b.code, 'same verification code on both devices: ' + a.code);
      assert.equal(a.peerInfo.fingerprint, b.fingerprint);
      assert.equal(b.peerInfo.name, 'Testdator');
      // 2. B sends two items; A accepts; checksums verified.
      const big = bytes(1024 * 1024 + 123, 7);
      const got = collector(a, 2);
      const progress = [];
      a.on('progress', (p) => progress.push(p));
      const res = await b.send([{ name: 'hej.txt', data: new Blob(['hej från telefonen'], { type: 'text/plain' }), kind: 'file' }, { name: 'stor.bin', data: big.buffer, kind: 'file', meta: { x: 1 } }]);
      step('sent two items');
      assert.equal(res.confirmed.length, 2, 'both confirmed');
      const items = await got.done;
      step('received two items');
      assert.equal(items[0].name, 'hej.txt');
      assert.equal(await items[0].blob.text(), 'hej från telefonen');
      assert.equal(items[1].size, big.byteLength);
      assert.deepEqual(items[1].meta, { x: 1 });
      const back = new Uint8Array(await items[1].blob.arrayBuffer());
      assert.ok(back.every((v, i) => v === big[i]), 'content intact');
      assert.ok(progress.some((p) => p.direction === 'in' && p.received > 0 && p.size === big.byteLength), 'progress reported');
      // 3. Pairing after the code was compared: both remember each other with the shared secret.
      const pairedOnB = new Promise((r) => b.on('paired', r));
      await a.pairPeer();
      await pairedOnB;
      await b.pairPeer();
      step('paired');
      const peerOfA = await p2p.peerById(b.fingerprint);
      const peerOfB = await p2p.peerById(a.fingerprint);
      assert.ok(peerOfA && peerOfB && peerOfA.secret === peerOfB.secret, 'same secret stored on both sides');
      a.close(); b.close();
      // 4. One scan: A offers to the paired phone and synthesises the answer at once; B connects without sending anything back.
      const a2 = open(p2p.offer({ peer: peerOfA }));
      await untilState(a2, 'connecting');
      assert.ok(!p2p.decodePayload(a2.offerPayload).k, 'no bootstrap secret for a paired peer');
      const b2 = open(p2p.answer(a2.offerPayload, { certificate: certB }));
      await untilState(a2, 'connected');
      await untilState(b2, 'connected');
      assert.ok(b2.paired, 'phone recognised the paired computer');
      step('one-scan connected');
      const got2 = collector(b2, 1);
      await a2.send([{ name: 'paket.zip', data: new Blob([bytes(70000, 3)], { type: 'application/zip' }), kind: 'bundle' }]);
      const [item2] = await got2.done;
      step('one-scan item received');
      assert.equal(item2.kind, 'bundle');
      assert.equal(item2.size, 70000);
      // 5. Resumption: the receiver drops the connection mid-way; the next session continues from the bytes it kept.
      const payload = bytes(600 * 1024, 11);
      const a3 = open(p2p.offer({ peer: peerOfA }));
      await untilState(a3, 'connecting');
      const b3 = open(p2p.answer(a3.offerPayload, { certificate: certB }));
      await untilState(a3, 'connected'); await untilState(b3, 'connected');
      let have = 0;
      b3.on('offer', (o) => o.accept());
      b3.on('progress', (p) => { if (p.direction === 'in' && p.received >= 200 * 1024 && b3.state === 'connected') { have = p.received; b3.close(); } });
      step('resume: sessions connected');
      await a3.send([{ id: 'resume1', name: 'resume.bin', data: payload.buffer }]).catch((err) => step('interrupted send rejected: ' + err.message));
      await waitFor(() => have > 0, 10000, 'interrupted after some bytes');
      a3.close();
      step('resume: interrupted at ' + have);
      const a4 = open(p2p.offer({ peer: peerOfA }));
      await untilState(a4, 'connecting');
      const b4 = open(p2p.answer(a4.offerPayload, { certificate: certB }));
      await untilState(a4, 'connected'); await untilState(b4, 'connected');
      let offeredHave = -1; let firstIn = -1;
      b4.on('offer', (o) => { offeredHave = o.items[0].have; o.accept(); });
      b4.on('progress', (p) => { if (p.direction === 'in' && firstIn < 0) firstIn = p.received; });
      const got4 = new Promise((r) => b4.on('item', r));
      step('resume: second session connected');
      await a4.send([{ id: 'resume1', name: 'resume.bin', data: payload.buffer }]);
      const item4 = await got4;
      step('resume: completed');
      assert.ok(offeredHave >= have && offeredHave < payload.byteLength, 'receiver reported what it already had: ' + offeredHave);
      assert.ok(firstIn > offeredHave, 'transfer continued after the kept bytes');
      const back4 = new Uint8Array(await item4.blob.arrayBuffer());
      assert.ok(back4.length === payload.length && back4.every((v, i) => v === payload[i]), 'resumed file intact');
      return 'code ' + a.code;
    } finally {
      clearInterval(watchdog);
      for (const s of sessions) { try { s.close(); } catch (_err) { /* ignore */ } }
      const ids = (await p2p.peers()).map((p) => p.id);
      for (const id of ids) await p2p.forget(id);
    }
  }, 60000);
})();
