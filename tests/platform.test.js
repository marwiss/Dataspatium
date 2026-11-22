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

  /** Runs in a shimmed worker: what the hosted code finds of the internet. Port 9 is refused by browsers, so a broken block reaches nothing. */
  function dataspatiumNetProbeWorker() {
    var out = { types: {}, under: {}, refusedBy: {}, refusedUrls: [], fetches: {} };
    var KEYS = ['WebSocket', 'WebSocketStream', 'WebTransport', 'EventSource', 'Worker', 'SharedWorker', 'BroadcastChannel', 'Notification', 'caches', 'indexedDB'];
    var NAV = ['storage', 'storageBuckets', 'locks', 'serviceWorker'];
    function message(call) { try { call(); return null; } catch (e) { return String(e && e.message); } }
    function xhr(url, async) { var x = new XMLHttpRequest(); x.open('GET', url, async); x.send(); return x; }
    /** What every level of the prototype chain hands out for key: a getter there could give the native object back. */
    function underneath(obj, key) {
      var seen = [];
      for (var o = obj; o; o = Object.getPrototypeOf(o)) {
        var d = Object.getOwnPropertyDescriptor(o, key);
        if (d) { try { seen.push(d.get ? typeof d.get.call(obj) : d.value); } catch (e) { seen.push('refuses this receiver'); } }
      }
      return seen;
    }
    self.onmessage = function (ev) {
      if (ev.data !== 'go') return;
      var mode = self.__dataspatium.config.net || '';
      KEYS.forEach(function (k) { out.types[k] = typeof self[k]; });
      NAV.forEach(function (k) { out.types['navigator.' + k] = typeof self.navigator[k]; });
      ['indexedDB', 'caches'].forEach(function (k) { out.under[k] = underneath(self, k).join(' '); });
      // The real navigator's prototype, where a second set of pins lives (its getters refuse any other receiver).
      if (self.WorkerNavigator) NAV.forEach(function (k) { out.under['WorkerNavigator.' + k] = underneath(self.WorkerNavigator.prototype, k).join(' '); });
      var navs = [];
      for (var o = self; o; o = Object.getPrototypeOf(o)) { var nd = Object.getOwnPropertyDescriptor(o, 'navigator'); if (nd && nd.get) navs.push(nd.get.call(self)); }
      out.navigator = [typeof self.navigator.userAgent, Object.isFrozen(self.navigator), Object.getPrototypeOf(self.navigator) === Object.prototype,
        navs.every(function (n) { return n === self.navigator; })].join(' ');
      out.hasCache = typeof Cache === 'function';
      var fetches = underneath(self, 'fetch');
      out.fetchLevels = fetches.length;
      out.nativeFetches = fetches.filter(function (f) { return f !== self.fetch; }).length;
      try { self.WebSocket = function () {}; out.assigned = typeof self.WebSocket; } catch (e) { out.assigned = 'threw ' + e.message; }
      var asset = xhr('dataspatium-asset://tests-net/a.txt', false);
      out.asset = asset.status + ' ' + asset.responseText;
      var blob = URL.createObjectURL(new Blob(['self.__blobScript = 7;'], { type: 'text/javascript' }));
      out.importBlob = message(function () { importScripts(blob); }) || self.__blobScript;
      var tries = { blob: function () { return fetch(blob); } };
      if (mode) {
        out.sync = message(function () { xhr('http://127.0.0.1:9/sync', false); });
        out.async = message(function () { xhr('http://127.0.0.1:9/async', true); });
        out.blobXhr = message(function () { xhr(blob, false); });
        out.importScripts = message(function () { importScripts('http://127.0.0.1:9/x.js'); });
        out.importProto = message(function () { WorkerGlobalScope.prototype.importScripts.call(self, 'http://127.0.0.1:9/proto.js'); });
        // Each one names a local address where the old check looked and the internet where fetch looks.
        tries.plain = function () { return fetch('http://127.0.0.1:9/fetch'); };
        tries.ownUrl = function () { return fetch(Object.defineProperty(new Request('http://127.0.0.1:9/own'), 'url', { value: 'blob:x' })); };
        tries.subclass = function () { class LocalLooking extends Request { get url() { return 'data:,'; } } return fetch(new LocalLooking('http://127.0.0.1:9/sub')); };
        tries.toString = function () { return fetch({ url: 'data:,', toString: function () { return 'http://127.0.0.1:9/str'; } }); };
        tries.prototype = function () { return (WorkerGlobalScope.prototype.fetch || self.fetch).call(self, 'http://127.0.0.1:9/proto'); };
        // Cache.add fetches inside the browser; any Cache will do, since the refusal comes before the browser's own checks.
        if (out.hasCache) tries.cacheAdd = function () { return Cache.prototype.add.call(Object.create(Cache.prototype), 'http://127.0.0.1:9/cache'); };
      }
      if (mode === 'fetch') {
        // A real worker from this blob would answer at once; the stand-in starts nothing and fails on the next task.
        var echo = URL.createObjectURL(new Blob(['postMessage("started");'], { type: 'text/javascript' }));
        var w = new Worker(echo);
        w.onmessage = function () { out.workerAnswered = true; };
        w.onerror = function (e) { out.workerError = e.message; };
        w.postMessage('hi');
        out.workerNative = /\[native code\]/.test(String(Worker)) || /\[native code\]/.test(String(SharedWorker));
      }
      Promise.all(Object.keys(tries).map(function (k) {
        return tries[k]().then(function (r) { return r.text(); }).then(function (t) { out.fetches[k] = 'read ' + t.length; }, function (e) { out.fetches[k] = e.message; });
      })).then(function () { return new Promise(function (r) { setTimeout(r, 300); }); }).then(function () {
        self.__dataspatium.refused().forEach(function (r) { out.refusedBy[r.api] = (out.refusedBy[r.api] || 0) + 1; out.refusedUrls.push(r.url); });
        self.postMessage(out);
      });
    };
  }

  /**
   * Create a shimmed worker, send it 'go' and resolve with its first answer. `inspect(answer)` runs while the worker is still alive,
   * before terminate(), which itself closes whatever the worker left open in the network log.
   */
  async function askWorker(options, inspect) {
    const worker = D.workers.create(options);
    try {
      const answer = await new Promise((resolve, reject) => {
        worker.onmessage = (ev) => resolve(ev.data);
        worker.onerror = (ev) => reject(new Error('worker error: ' + ev.message));
        worker.postMessage('go');
        setTimeout(() => reject(new Error('worker timeout')), 15000);
      });
      if (inspect) await inspect(answer);
      return answer;
    } finally { worker.terminate(); }
  }
  const CRAFTED = { plain: 'http://127.0.0.1:9/fetch', ownUrl: 'http://127.0.0.1:9/own', subclass: 'http://127.0.0.1:9/sub', toString: 'http://127.0.0.1:9/str', prototype: 'http://127.0.0.1:9/proto' };

  /** Every level of the prototype chain that holds the name reads as undefined (none holding it is fine too). */
  const hiddenEverywhere = (under) => under === '' || under.split(' ').every((x) => x === 'undefined');

  test('worker shim: with net none, fetch, XMLHttpRequest, importScripts and Cache.add refuse the internet, also for a Request with its own url, a Request subclass, an object whose toString differs from its url and the native functions on WorkerGlobalScope.prototype; sockets, workers, caches, IndexedDB, BroadcastChannel and Notification are gone, and navigator is a frozen copy without storage, storageBuckets, locks or serviceWorker; without net nothing changes', async (assert) => {
    D.workers.provider('tests-net', { initial: async () => [{ name: 'tests-net/a.txt', kind: 'text', data: 'hej' }] });
    const text = (api) => 'Testarbetaren har inget internet (' + api + ').';
    const out = await askWorker({ namespace: 'tests-net', source: D.workers.functionSource(dataspatiumNetProbeWorker), net: 'none', netText: 'Testarbetaren har inget internet ({api}).' });
    for (const k of Object.keys(out.types)) assert.equal(out.types[k], 'undefined', 'none: ' + k);
    for (const k of Object.keys(out.under)) assert.ok(hiddenEverywhere(out.under[k]), k + ' reads as undefined on every level of the prototype chain: ' + out.under[k]);
    assert.equal(out.navigator, 'string true true true', 'navigator is a frozen plain copy on every level, with its userAgent');
    assert.equal(out.nativeFetches, 0, 'no level of the prototype chain holds the native fetch, so deleting self.fetch reaches none');
    assert.equal(out.assigned, 'undefined', 'an assignment neither throws nor brings WebSocket back');
    assert.equal(out.asset, '200 hej', 'assets still load through XMLHttpRequest');
    assert.equal(out.importBlob, 7, 'a blob script still loads');
    assert.equal(out.fetches.blob, 'read 22', 'fetch of a blob still works');
    assert.equal(out.sync, text('XMLHttpRequest'), 'sync XMLHttpRequest refused at send()');
    assert.equal(out.async, text('XMLHttpRequest'), 'async XMLHttpRequest refused at send()');
    assert.equal(out.blobXhr, text('XMLHttpRequest'), 'no real XMLHttpRequest even for a blob');
    assert.equal(out.importScripts, text('importScripts'), 'importScripts refused');
    assert.equal(out.importProto, text('importScripts'), 'importScripts on WorkerGlobalScope.prototype refused');
    for (const [k, url] of Object.entries(CRAFTED)) {
      assert.equal(out.fetches[k], text('fetch'), k + ' refused');
      assert.ok(out.refusedUrls.includes(url), k + ' recorded with the address fetch would have used: ' + out.refusedUrls.join(' '));
    }
    if (out.hasCache) assert.ok(out.fetches.cacheAdd === text('Cache.add') && out.refusedUrls.includes('http://127.0.0.1:9/cache'), 'Cache.add refused: ' + out.fetches.cacheAdd);
    assert.deepEqual(out.refusedBy, Object.assign({ XMLHttpRequest: 3, importScripts: 2, fetch: 5 }, out.hasCache ? { 'Cache.add': 1 } : {}), 'the refusals are recorded');
    const plain = await askWorker({ namespace: 'tests-net', source: D.workers.functionSource(dataspatiumNetProbeWorker) });
    assert.ok(plain.types.WebSocket === 'function' && plain.types.Worker === 'function' && plain.types.indexedDB === 'object' && plain.assigned === 'function', 'without net the constructors and IndexedDB stay: ' + JSON.stringify(plain.types));
    assert.ok(/^string false false/.test(plain.navigator), 'without net the real navigator stays: ' + plain.navigator);
    assert.equal(plain.nativeFetches, plain.fetchLevels - 1, 'without net only self.fetch is the shim\'s');
    assert.equal(plain.asset, '200 hej');
    assert.deepEqual(plain.refusedBy, {}, 'nothing refused without net');
    return 'none refuses ' + out.refusedUrls.length + '; fetch found on ' + plain.fetchLevels + ' levels, indexedDB on ' + plain.under.indexedDB.split(' ').length + ' (plain)';
  }, 30000);

  /** Runs under net 'fetch': tries to answer its own question about the internet, and to ask about another address. */
  function dataspatiumNetGateWorker() {
    self.onmessage = function (ev) {
      if (ev.data !== 'go') return;
      var out = {};
      var target = 'http://127.0.0.1:9/target';
      var decoy = 'http://127.0.0.1:9/decoy';
      // A gate that waited with .then() would be handed true.
      var realThen = Promise.prototype.then;
      Promise.prototype.then = function (a, b) { return realThen.call(this, function () { return a ? a(true) : true; }, b); };
      var question = fetch(target);
      Promise.prototype.then = realThen;
      // A MessageChannel hands out trusted events with data of the worker's choice.
      var channel = new MessageChannel();
      channel.port2.onmessage = function (e) { out.portTrusted = e.isTrusted; setTimeout(function () { self.dispatchEvent(e); }, 0); };
      for (var id = 1; id <= 10; id++) {
        var forged = { __dm: true, type: 'net-reply', id: id, url: target, ok: true, ticket: 1 };
        self.onmessage({ data: forged });
        self.dispatchEvent(new MessageEvent('message', { data: forged }));
        channel.port1.postMessage(forged);
        self.postMessage({ __dm: true, type: 'net', id: id, url: decoy });
      }
      // Questions the shim never sends: an id that could not be sent back, an object, a long string, an address that is no string.
      var port = new MessageChannel().port1;
      self.postMessage({ __dm: true, type: 'net', id: port, url: decoy }, [port]);
      self.postMessage({ __dm: true, type: 'net', id: { n: 1 }, url: decoy });
      self.postMessage({ __dm: true, type: 'net', id: new Array(100).join('x'), url: decoy });
      self.postMessage({ __dm: true, type: 'net', id: 99, url: { href: decoy } });
      question.then(function () { out.target = 'fetched'; }, function (e) { out.target = e.message; })
        .then(function () { return fetch(decoy).then(function () { out.decoy = 'fetched'; }, function (e) { out.decoy = e.message; }); })
        .then(function () { return fetch(Object.defineProperty(new Request(target), 'url', { value: decoy })).then(function () { out.dressed = 'fetched'; }, function (e) { out.dressed = e.message; }); })
        .then(function () { self.postMessage(out); });
    };
  }

  test('worker shim: with net fetch, fetch asks the main thread about the address it fetches and goes out only on a trusted answer for that address, an allowed call shows in the network log, and Worker is a stand-in that starts nothing', async (assert) => {
    const target = 'http://127.0.0.1:9/target';
    const decoy = 'http://127.0.0.1:9/decoy';
    const asked = [];
    const t0 = Date.now();
    const active = D.net.active;
    // The answer about the target waits a little, so that every forgery lands while its question is open.
    D.workers.provider('tests-gate', { initial: async () => [], net: async (url) => { asked.push(url); if (url === target) await new Promise((r) => setTimeout(r, 200)); return url === decoy; } });
    // The worker's net-done messages come before its answer on the same port, so the log is checked as the answer arrives.
    let alive = null;
    const out = await askWorker({ namespace: 'tests-gate', source: D.workers.functionSource(dataspatiumNetGateWorker), net: 'fetch', netText: 'Ingen internet ({api}).' }, () => {
      const entries = D.net.log().filter((e) => e.at >= t0 && e.url.startsWith('http://127.0.0.1:9/'));
      alive = { active: D.net.active, open: entries.filter((e) => e.ms === null).length, decoys: entries.filter((e) => e.url === decoy).length };
    });
    assert.equal(out.portTrusted, true, 'the MessageChannel gave the worker a trusted event, which it dispatched here');
    assert.equal(out.target, 'Dataspatium: internet access was not allowed for ' + target, 'only the main thread\'s answer about the target counts, not the forged ones');
    assert.equal(asked.filter((u) => u === target).length, 2, 'asked about the target twice: by its fetch and by the Request dressed as the decoy');
    assert.equal(out.dressed, 'Dataspatium: internet access was not allowed for ' + target, 'a Request with the decoy as its own url is asked about, and refused, as the target');
    assert.ok(asked.filter((u) => u === decoy).length === 11, 'the ten questions the worker posted itself and its fetch of the decoy were answered, the four the shim never sends were not: ' + asked.length);
    assert.ok(out.decoy !== 'fetched' && !/not allowed/.test(out.decoy), 'the allowed decoy went to the browser, which refuses port 9: ' + out.decoy);
    const logged = D.net.log().filter((e) => e.at >= t0 && e.url.startsWith('http://127.0.0.1:9/'));
    assert.ok(logged.some((e) => e.url === decoy && e.method === 'GET'), 'the allowed call is in the network log: ' + JSON.stringify(logged));
    assert.ok(!logged.some((e) => e.url === target), 'the refused one is not');
    assert.deepEqual(alive, { active, open: 0, decoys: 11 }, 'while the worker still ran, every allowed call had ended in the log, the forged questions too');
    D.workers.provider('tests-net', { initial: async () => [{ name: 'tests-net/a.txt', kind: 'text', data: 'hej' }], net: async (url) => { asked.push('probe ' + url); return false; } });
    const probe = await askWorker({ namespace: 'tests-net', source: D.workers.functionSource(dataspatiumNetProbeWorker), net: 'fetch', netText: 'Ingen internet ({api}).' });
    assert.ok(probe.types.Worker === 'function' && probe.types.SharedWorker === 'function' && probe.workerNative === false, 'Worker and SharedWorker are stand-ins, not the native ones');
    for (const k of Object.keys(probe.types)) if (k !== 'Worker' && k !== 'SharedWorker') assert.equal(probe.types[k], 'undefined', 'fetch: ' + k);
    for (const k of Object.keys(probe.under)) assert.ok(hiddenEverywhere(probe.under[k]), 'fetch: ' + k + ' on every level: ' + probe.under[k]);
    assert.equal(probe.navigator, 'string true true true', 'fetch: navigator is the frozen copy');
    assert.equal(probe.nativeFetches, 0, 'fetch: no native fetch on the prototype chain');
    if (probe.hasCache) assert.equal(probe.fetches.cacheAdd, 'Ingen internet (Cache.add).', 'fetch: Cache.add refused, not asked about');
    assert.ok(probe.workerAnswered === undefined && probe.workerError === 'Ingen internet (Worker).', 'the stand-in started nothing and failed with the refusal: ' + JSON.stringify([probe.workerAnswered, probe.workerError]));
    for (const [k, url] of Object.entries(CRAFTED)) {
      assert.equal(probe.fetches[k], 'Dataspatium: internet access was not allowed for ' + url, k + ' asked about the address fetch would use');
      assert.ok(asked.includes('probe ' + url), k + ' reached the main thread as ' + url);
    }
    assert.deepEqual(probe.refusedBy, Object.assign({ XMLHttpRequest: 3, importScripts: 2, Worker: 1 }, probe.hasCache ? { 'Cache.add': 1 } : {}), 'the refusals are recorded');
    return 'asked ' + asked.length + ', logged ' + logged.length;
  }, 30000);

  // ================================================================================================================================
  // REVIEWED WORKER GLOBALS: every name a restricted worker (net 'none' or 'fetch') may show on self and its prototype chain, and as
  // navigator.<name> on its navigator. A name is reviewed when it reaches neither the network nor the app's storage or tabs, or when
  // platform/worker-shim pins or replaces it. A browser that adds a name fails the test below, which lists every new name: review
  // each one, then pin it in the shim or add it here. Built from TypeScript 6.0.3's lib.webworker.d.ts (what two engines expose to
  // workers) and the Edge and Firefox additions known here; not yet compared with a list taken from a real Edge or Firefox.
  // ================================================================================================================================
  const REVIEWED_WORKER_GLOBALS = new Set([
    // ECMAScript and Object.prototype
    'AggregateError Array ArrayBuffer AsyncDisposableStack Atomics BigInt BigInt64Array BigUint64Array Boolean DataView',
    'Date DisposableStack Error EvalError FinalizationRegistry Float16Array Float32Array Float64Array Function Infinity',
    'Int16Array Int32Array Int8Array InternalError Intl Iterator JSON Map Math NaN Number Object Promise Proxy RangeError',
    'ReferenceError Reflect RegExp Set SharedArrayBuffer String SuppressedError Symbol SyntaxError Temporal TypeError',
    'URIError Uint16Array Uint32Array Uint8Array Uint8ClampedArray WeakMap WeakRef WeakSet WebAssembly __defineGetter__',
    '__defineSetter__ __lookupGetter__ __lookupSetter__ __proto__ console constructor decodeURI decodeURIComponent',
    'encodeURI encodeURIComponent escape eval globalThis hasOwnProperty isFinite isNaN isPrototypeOf parseFloat parseInt',
    'propertyIsEnumerable toLocaleString toString undefined unescape valueOf',
    // replaced or pinned by platform/worker-shim, or answered on the main thread (postMessage)
    'BroadcastChannel Cache CacheStorage EventSource Notification SharedWorker WebSocket WebSocketStream WebTransport',
    'Worker XMLHttpRequest addEventListener caches fetch importScripts indexedDB navigator onmessage postMessage',
    'removeEventListener webkitRequestFileSystem webkitRequestFileSystemSync webkitResolveLocalFileSystemSyncURL',
    'webkitResolveLocalFileSystemURL',
    // fetches only from the app's own origin (the page's CSP allows fonts from 'self' file: data: blob:)
    'FontFace FontFaceSet FontFaceSetLoadEvent fonts',
    // the worker's own scope
    'PERSISTENT TEMPORARY atob btoa cancelAnimationFrame clearInterval clearTimeout close createImageBitmap',
    'crossOriginIsolated crypto dispatchEvent dump isSecureContext location name onerror onlanguagechange onmessageerror',
    'onoffline ononline onrejectionhandled onrtctransform onunhandledrejection origin performance queueMicrotask',
    'reportError requestAnimationFrame scheduler self setInterval setTimeout structuredClone trustedTypes when',
    // objects of these come only through what the shim hides (navigator, caches, indexedDB, service workers) or from the page
    'BackgroundFetchManager BackgroundFetchRecord BackgroundFetchRegistration Client Clients ContentIndex CookieStore',
    'CookieStoreManager ExtendableCookieChangeEvent ExtendableEvent ExtendableMessageEvent FetchEvent',
    'FileSystemDirectoryHandle FileSystemFileHandle FileSystemHandle FileSystemObserver FileSystemSyncAccessHandle',
    'FileSystemWritableFileStream GPU GPUAdapter GPUAdapterInfo GPUDevice HID HIDConnectionEvent HIDDevice',
    'HIDInputReportEvent IDBCursor IDBCursorWithValue IDBDatabase IDBFactory IDBIndex IDBKeyRange IDBObjectStore',
    'IDBOpenDBRequest IDBRecord IDBRequest IDBTransaction IDBVersionChangeEvent Lock LockManager MediaCapabilities',
    'MediaStreamTrackProcessor NavigationPreloadManager NavigatorUAData NetworkInformation NotificationEvent',
    'PeriodicSyncManager PermissionStatus Permissions PushEvent PushManager PushMessageData PushSubscription',
    'PushSubscriptionChangeEvent PushSubscriptionOptions RTCDataChannel Serial SerialPort ServiceWorker',
    'ServiceWorkerContainer ServiceWorkerGlobalScope ServiceWorkerRegistration SharedWorkerGlobalScope StorageBucket',
    'StorageBucketManager StorageManager SyncManager USB USBAlternateInterface USBConfiguration USBConnectionEvent',
    'USBDevice USBEndpoint USBInTransferResult USBInterface USBIsochronousInTransferPacket USBIsochronousInTransferResult',
    'USBIsochronousOutTransferPacket USBIsochronousOutTransferResult USBOutTransferResult VideoTrackGenerator',
    'WindowClient WorkerNavigator',
    // no network and no storage of their own
    'AbortController AbortSignal AudioData AudioDecoder AudioEncoder BarcodeDetector Blob ByteLengthQueuingStrategy',
    'CSPViolationReportBody CSSImageValue CSSKeywordValue CSSMathClamp CSSMathInvert CSSMathMax CSSMathMin CSSMathNegate',
    'CSSMathProduct CSSMathSum CSSMathValue CSSMatrixComponent CSSNumericArray CSSNumericValue CSSPerspective CSSRotate',
    'CSSScale CSSSkew CSSSkewX CSSSkewY CSSStyleValue CSSTransformComponent CSSTransformValue CSSTranslate CSSUnitValue',
    'CSSUnparsedValue CSSVariableReferenceValue CanvasGradient CanvasPattern CloseEvent CompressionStream',
    'CountQueuingStrategy Crypto CryptoKey CustomEvent DOMException DOMMatrix DOMMatrixReadOnly DOMPoint DOMPointReadOnly',
    'DOMQuad DOMRect DOMRectReadOnly DOMStringList DecompressionStream DedicatedWorkerGlobalScope DeprecationReportBody',
    'EncodedAudioChunk EncodedVideoChunk ErrorEvent Event EventTarget File FileList FileReader FileReaderSync FormData',
    'GPUBindGroup GPUBindGroupLayout GPUBuffer GPUCanvasContext GPUCommandBuffer GPUCommandEncoder GPUCompilationInfo',
    'GPUCompilationMessage GPUComputePassEncoder GPUComputePipeline GPUDeviceLostInfo GPUError GPUExternalTexture',
    'GPUInternalError GPUOutOfMemoryError GPUPipelineError GPUPipelineLayout GPUQuerySet GPUQueue GPURenderBundle',
    'GPURenderBundleEncoder GPURenderPassEncoder GPURenderPipeline GPUSampler GPUShaderModule GPUSupportedFeatures',
    'GPUSupportedLimits GPUTexture GPUTextureView GPUUncapturedErrorEvent GPUValidationError Headers ImageBitmap',
    'ImageBitmapRenderingContext ImageData ImageDecoder ImageTrack ImageTrackList InterventionReportBody MediaSource',
    'MediaSourceHandle MessageChannel MessageEvent MessagePort Observable OffscreenCanvas',
    'OffscreenCanvasRenderingContext2D Path2D Performance PerformanceEntry PerformanceMark PerformanceMeasure',
    'PerformanceObserver PerformanceObserverEntryList PerformanceResourceTiming PerformanceServerTiming ProgressEvent',
    'PromiseRejectionEvent RTCEncodedAudioFrame RTCEncodedVideoFrame RTCRtpScriptTransformer RTCTransformEvent',
    'ReadableByteStreamController ReadableStream ReadableStreamBYOBReader ReadableStreamBYOBRequest',
    'ReadableStreamDefaultController ReadableStreamDefaultReader ReportingObserver Request Response Scheduler',
    'SecurityPolicyViolationEvent SourceBuffer SourceBufferList StylePropertyMapReadOnly Subscriber SubtleCrypto',
    'TaskController TaskPriorityChangeEvent TaskSignal TextDecoder TextDecoderStream TextEncoder TextEncoderStream',
    'TextMetrics TransformStream TransformStreamDefaultController URL URLPattern URLSearchParams VideoColorSpace',
    'VideoDecoder VideoEncoder VideoFrame WGSLLanguageFeatures WebGL2RenderingContext WebGLActiveInfo WebGLBuffer',
    'WebGLContextEvent WebGLFramebuffer WebGLProgram WebGLQuery WebGLRenderbuffer WebGLRenderingContext WebGLSampler',
    'WebGLShader WebGLShaderPrecisionFormat WebGLSync WebGLTexture WebGLTransformFeedback WebGLUniformLocation',
    'WebGLVertexArrayObject WebSocketError WebTransportBidirectionalStream WebTransportDatagramDuplexStream',
    'WebTransportError WorkerGlobalScope WorkerLocation WritableStream WritableStreamDefaultController',
    'WritableStreamDefaultWriter XMLHttpRequestEventTarget XMLHttpRequestUpload',
    // the app's own: the shim and this test's probe
    '__dataspatium dataspatiumGlobalsProbeWorker dataspatiumMakeXHR dataspatiumWorkerShim',
    // navigator: the shim's frozen copy
    'navigator.hardwareConcurrency navigator.language navigator.languages navigator.maxTouchPoints navigator.onLine',
    'navigator.platform navigator.userAgent',
  ].join(' ').split(' '));

  /** Runs in a restricted worker: every name on self, its prototype chain and its navigator. */
  function dataspatiumGlobalsProbeWorker() {
    self.onmessage = function (ev) {
      if (ev.data !== 'go') return;
      var names = Object.create(null);
      for (var o = self; o; o = Object.getPrototypeOf(o)) Object.getOwnPropertyNames(o).forEach(function (n) { names[n] = 1; });
      for (var p = self.navigator; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) Object.getOwnPropertyNames(p).forEach(function (n) { names['navigator.' + n] = 1; });
      self.postMessage(Object.keys(names));
    };
  }

  test('worker shim: a restricted worker shows only reviewed globals, under net none and fetch, and nothing of the real navigator', async (assert) => {
    D.workers.provider('tests-globals', { initial: async () => [] });
    const unknown = new Set();
    let count = 0;
    for (const net of ['none', 'fetch']) {
      const names = await askWorker({ namespace: 'tests-globals', source: D.workers.functionSource(dataspatiumGlobalsProbeWorker), net, netText: 'Ingen internet ({api}).' });
      count = Math.max(count, names.length);
      for (const n of names) if (!REVIEWED_WORKER_GLOBALS.has(n)) unknown.add(n);
    }
    assert.ok(unknown.size === 0, unknown.size + ' names not reviewed; pin each in platform/worker-shim or add it to REVIEWED_WORKER_GLOBALS: ' + Array.from(unknown).sort().join(' '));
    return count + ' names, all reviewed';
  }, 30000);

  test('workers: an allowed answer about the internet that comes after its worker ended records nothing in the network log', async (assert) => {
    const url = 'http://127.0.0.1:9/late';
    const t0 = Date.now();
    const active = D.net.active;
    let answer = null;
    D.workers.provider('tests-late', { initial: async () => [], net: () => new Promise((resolve) => { answer = resolve; }) });
    const worker = D.workers.create({
      namespace: 'tests-late', net: 'fetch', netText: 'Ingen internet ({api}).',
      source: D.workers.functionSource(function dataspatiumLateTestWorker() {
        self.onmessage = function (ev) { if (ev.data === 'go') fetch('http://127.0.0.1:9/late').catch(function () {}); };
      }),
    });
    try {
      worker.postMessage('go');
      const t1 = performance.now();
      while (!answer && performance.now() - t1 < 10000) await new Promise((r) => setTimeout(r, 20));
      assert.ok(answer, 'the worker asked about ' + url);
    } finally { worker.terminate(); }
    answer(true);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(D.net.active, active, 'nothing is counted as active');
    assert.ok(!D.net.log().some((e) => e.at >= t0 && e.url === url), 'and nothing is in the log');
    return 'ok';
  }, 15000);

  test('workers: a worker asking for an asset gets only its own namespace\'s unless its provider allows more, and another engine\'s stays in memory', async (assert) => {
    D.assets.provide('tests-own/mine.txt', 'text', 'mine');
    D.assets.provide('tests-other/theirs.bin', 'binary', new Uint8Array([1, 2, 3]).buffer);
    D.workers.provider('tests-own', { initial: async () => [] });
    try {
      const out = await askWorker({
        namespace: 'tests-own',
        source: D.workers.functionSource(function dataspatiumOwnAssetsTestWorker() {
          self.onmessage = function (ev) {
            if (ev.data !== 'go') return;
            var get = function (name) { return self.__dataspatium.getAsync(name).then(function (e) { return e.kind; }, function () { return 'missing'; }); };
            Promise.all([get('tests-own/mine.txt'), get('tests-other/theirs.bin')]).then(function (r) { self.postMessage(r); });
          };
        }),
      });
      assert.deepEqual(out, ['text', 'missing'], 'its own asset comes, another namespace\'s does not');
      assert.ok(D.assets.peek('tests-other/theirs.bin'), 'and that one was not taken from this thread');
    } finally { D.assets.take('tests-own/mine.txt'); D.assets.take('tests-other/theirs.bin'); }
    return 'ok';
  }, 15000);

  test('workers: a namespace screens what its worker sends here, and the worker cannot rename itself past the screen', async (assert) => {
    const screened = [];
    D.workers.provider('tests-screen', { initial: async () => [], screen: (d) => { screened.push(d && d.n); return !(d && d.drop); } });
    D.workers.provider('tests-screen-other', { initial: async () => [] });
    const worker = D.workers.create({
      namespace: 'tests-screen',
      source: D.workers.functionSource(function dataspatiumScreenTestWorker() {
        self.onmessage = function () {
          self.postMessage({ n: 1, drop: true });
          self.postMessage({ n: 2 });
          self.postMessage({ __dm: true, type: 'hello', namespace: 'tests-screen-other' });
          self.postMessage({ n: 3, drop: true });
          self.postMessage({ n: 4, last: true });
        };
      }),
    });
    try {
      const seen = await new Promise((resolve, reject) => {
        const got = [];
        worker.onmessage = (ev) => { got.push(ev.data.n); if (ev.data.last) resolve(got); };
        worker.onerror = (ev) => reject(new Error('worker error: ' + ev.message));
        worker.postMessage('go');
        setTimeout(() => reject(new Error('worker timeout')), 10000);
      });
      assert.deepEqual(seen, [2, 4], 'the dropped messages never reach the hosted code\'s handler');
      assert.deepEqual(screened, [1, 2, 3, 4], 'every message passes the screen, also after a second hello');
      assert.equal(/** @type {any} */ (worker).dmNamespace, 'tests-screen', 'the first hello names the worker');
    } finally { worker.terminate(); }
    return 'ok';
  }, 15000);

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
