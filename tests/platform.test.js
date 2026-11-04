// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the platform layer: registry, asset decoding, worker shim. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');

  test('registry: define/require resolves dependencies lazily', (assert) => {
    let built = 0;
    D.define('tests/tmp/a', [], () => { built++; return { value: 1 }; });
    D.define('tests/tmp/b', ['tests/tmp/a'], (a) => ({ value: a.value + 1 }));
    assert.equal(built, 0, 'factory must not run before require');
    assert.equal(D.require('tests/tmp/b').value, 2);
    assert.equal(built, 1);
    D.require('tests/tmp/b');
    assert.equal(built, 1, 'factory runs once');
  });

  test('registry: circular dependencies are reported', async (assert) => {
    D.define('tests/tmp/c1', ['tests/tmp/c2'], () => ({}));
    D.define('tests/tmp/c2', ['tests/tmp/c1'], () => ({}));
    await assert.throws(() => D.require('tests/tmp/c1'), /Circular/);
  });

  test('assets: base64 and gzip decoding', async (assert) => {
    assert.equal(new TextDecoder().decode(D.assets.decodeBase64('aGVsbG8=')), 'hello');
    const gz = D.assets.decodeBase64('H4sIAAAAAAAAA8tIzcnJBwCGphA2BQAAAA==');
    assert.equal(new TextDecoder().decode(await D.assets.gunzip(gz)), 'hello');
  });

  test('assets: manifest lists the embedded libraries', (assert) => {
    const libs = Object.keys(D.assets.libraries());
    assert.ok(libs.includes('webr') && libs.includes('sqljs'), 'webr and sqljs present: ' + libs.join(','));
    assert.ok(D.assets.names('webr/').length > 100, 'webr assets: ' + D.assets.names('webr/').length);
    return libs.join(', ');
  });

  test('net: assetName and URL patch', (assert) => {
    assert.equal(D.net.assetName('dataspatium-asset://webr//R.wasm?x=1'), 'webr/R.wasm');
    assert.equal(D.net.assetName('https://example.org/x'), null);
    const u = new URL('dataspatium-asset://webr/', location.origin);
    assert.equal(u.protocol, 'dataspatium-asset:');
  });

  test('worker shim: importScripts, fetch, sync XHR, HEAD, Range, misses and message gating', async (assert) => {
    D.workers.provider('tests-shim', {
      initial: async () => [
        { name: 'tests-shim/lib.js', kind: 'text', data: 'self.__libLoaded = 42;' },
        { name: 'tests-shim/data.bin', kind: 'binary', data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer },
        { name: 'tests-shim/text.txt', kind: 'text', data: 'hej världen' },
      ],
      request: async (name) => name === 'tests-shim/late.txt',
    });
    // A late asset is answered through asset-request -> provider.request -> assets.decode; register it as virtual via a fake decode.
    const realDecode = D.assets.decode;
    D.assets.decode = async (name) => name === 'tests-shim/late.txt' ? { kind: 'text', data: 'late' } : realDecode(name);
    try {
      const worker = D.workers.create({
        namespace: 'tests-shim',
        source: D.workers.functionSource(function dataspatiumShimTestWorker() {
          var out = {};
          self.onmessage = function (ev) {
            var dm = self.__dataspatium;
            try {
              out.gated = ev.data; // arrives only after assets are final
              importScripts('dataspatium-asset://tests-shim/lib.js');
              out.lib = self.__libLoaded;
              var x = new XMLHttpRequest(); x.open('GET', 'dataspatium-asset://tests-shim/data.bin', false); x.responseType = 'arraybuffer'; x.send();
              out.syncStatus = x.status; out.syncLen = x.response.byteLength;
              var h = new XMLHttpRequest(); h.open('HEAD', 'dataspatium-asset://tests-shim/data.bin', false); h.send();
              out.headLen = h.getResponseHeader('Content-Length'); out.acceptRanges = h.getResponseHeader('Accept-Ranges');
              var r = new XMLHttpRequest(); r.open('GET', 'dataspatium-asset://tests-shim/data.bin', false); r.setRequestHeader('Range', 'bytes=2-4'); r.responseType = 'arraybuffer'; r.send();
              out.rangeStatus = r.status; out.rangeBytes = Array.from(new Uint8Array(r.response)); out.contentRange = r.getResponseHeader('Content-Range');
              var t = new XMLHttpRequest(); t.open('GET', 'dataspatium-asset://tests-shim/text.txt', false); t.send();
              out.text = t.responseText;
              var miss = new XMLHttpRequest(); miss.open('GET', 'dataspatium-asset://tests-shim/nope.txt', false); miss.send();
              out.missStatus = miss.status;
              Promise.all([
                fetch('dataspatium-asset://tests-shim/data.bin').then(function (res) { return res.arrayBuffer(); }).then(function (b) { out.fetchLen = b.byteLength; }),
                fetch('dataspatium-asset://tests-shim/late.txt').then(function (res) { return res.text(); }).then(function (s) { out.late = s; }),
                fetch('dataspatium-asset://tests-shim/missing.txt').then(function (res) { out.missingFetch = res.status; }),
                dm.getAsync('tests-shim/also-missing.txt').then(function () { out.asyncMiss = 'resolved'; }, function () { out.asyncMiss = 'rejected'; }),
              ]).then(function () { self.postMessage(out); });
            } catch (e) { out.error = String(e && e.stack || e); self.postMessage(out); }
          };
        }),
      });
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (ev) => resolve(ev.data);
        worker.onerror = (ev) => reject(new Error('worker error: ' + ev.message));
        worker.postMessage({ hello: 'world' }); // sent before assets are final; must be queued
        setTimeout(() => reject(new Error('worker timeout')), 15000);
      });
      worker.terminate();
      if (result.error) throw new Error(result.error);
      assert.deepEqual(result.gated, { hello: 'world' });
      assert.equal(result.lib, 42, 'importScripts');
      assert.equal(result.syncStatus, 200); assert.equal(result.syncLen, 10, 'sync XHR arraybuffer');
      assert.equal(result.headLen, '10', 'HEAD content-length'); assert.equal(result.acceptRanges, null);
      assert.equal(result.rangeStatus, 206); assert.deepEqual(result.rangeBytes, [3, 4, 5]); assert.equal(result.contentRange, 'bytes 2-4/10');
      assert.equal(result.text, 'hej världen');
      assert.equal(result.missStatus, 404, 'sync miss');
      assert.equal(result.fetchLen, 10, 'fetch');
      assert.equal(result.late, 'late', 'late asset via asset-request');
      assert.equal(result.missingFetch, 404, 'fetch miss');
      assert.equal(result.asyncMiss, 'rejected');
    } finally {
      D.assets.decode = realDecode;
    }
  }, 30000);

  test('platform: two workers asking for the same binary asset at once each get a copy (no detached transfer)', async (assert) => {
    // Two SQLite engines opening together share one decode of sql-wasm.wasm; the second send must not transfer the
    // buffer the first one detached (it used to fail with DataCloneError and the second engine never started).
    const name = D.assets.names('sqljs/').find((n) => n.endsWith('.wasm'));
    assert.ok(name, 'sql.js wasm asset');
    const src = 'self.onmessage = function (ev) { var d = ev.data; if (d && d.type === "assets") self.postMessage(d.entries.map(function (e) { return e.data.byteLength; })); };';
    const make = () => new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const w1 = make(); const w2 = make();
    const reply = (w) => new Promise((resolve, reject) => { w.onmessage = (ev) => resolve(ev.data); w.onerror = (ev) => reject(new Error(ev.message || 'worker error')); });
    const replies = Promise.all([reply(w1), reply(w2)]);
    try {
      await Promise.all([D.workers.sendAssets(w1, [name], true), D.workers.sendAssets(w2, [name], true)]);
      const [a, b] = await Promise.race([replies, new Promise((_, rej) => setTimeout(() => rej(new Error('no reply from the workers')), 10000))]);
      assert.ok(a[0] > 100000 && a[0] === b[0], 'both workers received the full buffer: ' + a[0] + ' / ' + b[0]);
      // A later consumer still gets the asset (the wrapper is injected again after the transfers).
      assert.ok((await D.assets.load(name)).byteLength === a[0], 'asset available again on the main thread');
      return a[0] + ' bytes to each worker';
    } finally { w1.terminate(); w2.terminate(); }
  }, 30000);
})();
