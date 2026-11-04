// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the WebSocket transport (api/websocket) against a fake socket: open, JSON requests paired by id, errors, timeouts, close. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const websocket = D.require('api/websocket');
  const t = D.require('ui/i18n').t;

  /** A socket that opens on the next tick and answers JSON requests by id; `silent` requests get no reply. */
  class FakeSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = url; this.protocols = protocols; this.readyState = 0; this.sent = [];
      FakeSocket.instances.push(this);
      setTimeout(() => { if (url.includes('refuse')) { this.dispatchEvent(new Event('error')); return; } this.readyState = 1; this.dispatchEvent(new Event('open')); }, 0);
    }
    send(data) {
      this.sent.push(data);
      let msg = null;
      try { msg = JSON.parse(data); } catch (_e) { msg = null; }
      if (!msg || msg.silent) return;
      const reply = msg.fail ? { id: msg.id, error: { message: 'nope' } } : { id: msg.id, ok: true, echo: msg.q };
      setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(reply) })), 0);
    }
    push(text) { this.dispatchEvent(new MessageEvent('message', { data: text })); }
    close(code, reason) { this.readyState = 3; setTimeout(() => this.dispatchEvent(new CloseEvent('close', { code: code || 1000, reason: reason || '' })), 0); }
  }
  FakeSocket.instances = [];

  test('websocket: connect, requests paired by id, server errors, timeouts, unsolicited messages and close', async (assert) => {
    websocket.setFactory(FakeSocket);
    try {
      const session = await websocket.connect('wss://example.test/bolt', { protocols: ['v1'], purpose: 'databases' });
      assert.equal(session.state, 1, 'open');
      assert.deepEqual(FakeSocket.instances[FakeSocket.instances.length - 1].protocols, ['v1']);
      const reply = await session.request({ q: 'MATCH (n) RETURN n' });
      assert.equal(reply.ok, true);
      assert.equal(reply.echo, 'MATCH (n) RETURN n');
      assert.equal(reply.id, 1, 'ids are numbered');
      const custom = await session.request({ id: 'abc', q: 'x' });
      assert.equal(custom.id, 'abc', 'a given id is kept');
      let err = null;
      try { await session.request({ q: 'bad', fail: true }); } catch (e) { err = e; }
      assert.equal(err && err.message, 'nope', 'a reply with error rejects');
      err = null;
      try { await session.request({ q: 'slow', silent: true }, 40); } catch (e) { err = e; }
      assert.equal(err && err.message, t('ws.err.timeout'));
      assert.equal(session.pending, 0, 'nothing left pending');
      const seen = [];
      session.on('message', (m) => seen.push(m));
      session.ws.push('{"event":"tick"}');
      session.ws.push('plain text');
      assert.deepEqual(seen, [{ event: 'tick' }, 'plain text']);
      session.send('raw');
      assert.equal(session.ws.sent[session.ws.sent.length - 1], 'raw', 'strings go as they are');
      const closed = new Promise((resolve) => session.on('close', resolve));
      const hanging = session.request({ q: 'never', silent: true }, 5000);
      session.close(1000, 'done');
      const info = await closed;
      assert.equal(info.code, 1000);
      err = null;
      try { await hanging; } catch (e) { err = e; }
      assert.equal(err && err.message, t('ws.err.closed'), 'pending requests fail on close');
      err = null;
      try { await websocket.connect('wss://refuse.test/'); } catch (e) { err = e; }
      assert.equal(err && err.message, t('ws.err.connection', { url: 'wss://refuse.test/' }));
      return 'ok';
    } finally {
      websocket.setFactory(null);
    }
  }, 20000);
})();
