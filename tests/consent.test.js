// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of internet access by consent, components fetched on demand (hash, cache, a changed cached copy, removal) and remote R packages. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const consent = D.require('platform/consent');
  const components = D.require('platform/components');
  const remote = D.require('engines/r/remote-packages');
  const packages = D.require('engines/r/packages');
  const enc = (s) => new TextEncoder().encode(s);
  const response = (bytes, status = 200) => Promise.resolve(new Response(bytes, { status }));

  /** Run with the developer override off (the test page turns it on so that no dialog blocks the suite). */
  async function withoutOverride(fn) {
    const saved = localStorage.getItem('dataspatium.consent');
    localStorage.removeItem('dataspatium.consent');
    try { return await fn(); } finally { if (saved !== null) localStorage.setItem('dataspatium.consent', saved); }
  }

  test('consent: a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError', async (assert) => {
    await withoutOverride(async () => {
      const asked = [];
      const originalState = await consent.state('stun');
      try {
        await consent.set('stun', null);
        consent.setAsker(async (purpose, info) => { asked.push([purpose, info.host]); return { allow: asked.length === 1, remember: asked.length !== 1 }; });
        assert.equal(await consent.require('stun', { host: 'stun.example.org' }), true, 'allowed once without remembering');
        assert.equal(await consent.state('stun'), null, 'not remembered');
        let err = null;
        try { await consent.require('stun', { host: 'stun.example.org' }); } catch (e) { err = e; }
        assert.ok(err && err.name === 'ConsentError' && err.purpose === 'stun', 'second answer denies: ' + (err && err.message));
        assert.equal(await consent.state('stun'), 'denied', 'the denial is remembered');
        err = null;
        try { await consent.require('stun'); } catch (e) { err = e; }
        assert.ok(err && err.name === 'ConsentError', 'remembered denial does not ask again');
        assert.equal(asked.length, 2, 'asked exactly twice');
        await consent.set('stun', 'granted');
        assert.equal(await consent.require('stun'), true);
        assert.equal((await consent.all()).stun, 'granted');
        return 'ok';
      } finally { consent.setAsker(null); await consent.set('stun', originalState); }
    });
  });

  test('consent: a purpose has one question open at a time; the same question asked again shares its answer, a remembered answer settles the waiting ones, and a one-time yes never covers another host', async (assert) => {
    await withoutOverride(async () => {
      const originalState = await consent.state('stun');
      const asked = [];
      const answers = [];
      const settle = (p) => p.then(() => 'allowed', (e) => e.name);
      const askedBy = async (n) => {
        const t0 = performance.now();
        while (asked.length < n && performance.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 10));
        await new Promise((r) => setTimeout(r, 30)); // and no more than n
      };
      const q = (host) => consent.require('stun', { host, label: 'stun:' + host });
      try {
        consent.setAsker((purpose, info) => new Promise((resolve) => { asked.push(info.host); answers.push(resolve); }));
        await consent.set('stun', null);
        const same = [q('a.example'), q('a.example'), q('a.example')].map(settle);
        await askedBy(1);
        assert.deepEqual(asked, ['a.example'], 'three identical questions open one dialog');
        answers.shift()({ allow: true, remember: false });
        assert.deepEqual(await Promise.all(same), ['allowed', 'allowed', 'allowed'], 'and take its one answer');
        asked.length = 0;
        const a = settle(q('a.example'));
        const b = settle(q('b.example'));
        await askedBy(1);
        assert.deepEqual(asked, ['a.example'], 'a question for another host waits for the open one');
        answers.shift()({ allow: true, remember: false });
        assert.equal(await a, 'allowed');
        await askedBy(2);
        assert.deepEqual(asked, ['a.example', 'b.example'], 'a yes once does not cover the other host, which is asked next');
        answers.shift()({ allow: false, remember: false });
        assert.equal(await b, 'ConsentError', 'and has its own answer');
        asked.length = 0;
        const c = settle(q('c.example'));
        const d = settle(q('d.example'));
        await askedBy(1);
        answers.shift()({ allow: false, remember: true });
        assert.deepEqual([await c, await d], ['ConsentError', 'ConsentError'], 'a remembered no also refuses the question that waited');
        assert.deepEqual(asked, ['c.example'], 'without asking it');
        assert.equal(await consent.state('stun'), 'denied', 'the no is remembered');
        return 'ok';
      } finally { consent.setAsker(null); await consent.set('stun', originalState); }
    });
  });

  test('consent: one refusal, also a one-time one, refuses the burst of questions waiting behind it with one dialog, a later question is asked, and a question no longer wanted is never shown', async (assert) => {
    await withoutOverride(async () => {
      const originalState = await consent.state('stun');
      const asked = [];
      const answers = [];
      const settle = (p) => p.then(() => 'allowed', (e) => e.name);
      const askedBy = async (n) => {
        const t0 = performance.now();
        while (asked.length < n && performance.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 10));
        await new Promise((r) => setTimeout(r, 30)); // and no more than n
      };
      const q = (host, wanted) => consent.require('stun', { host, label: 'stun:' + host, wanted });
      try {
        consent.setAsker((purpose, info) => new Promise((resolve) => { asked.push(info.host); answers.push(resolve); }));
        await consent.set('stun', null);
        const burst = Array.from({ length: 12 }, (_, i) => settle(q('h' + i + '.example')));
        await askedBy(1);
        assert.deepEqual(asked, ['h0.example'], 'twelve questions for twelve hosts open one dialog');
        answers.shift()({ allow: false, remember: false });
        assert.deepEqual(await Promise.all(burst), Array(12).fill('ConsentError'), 'one no, not remembered, refuses all twelve');
        assert.deepEqual(asked, ['h0.example'], 'without asking the other eleven');
        assert.equal(await consent.state('stun'), null, 'and nothing is remembered');
        const later = settle(q('later.example'));
        await askedBy(2);
        assert.deepEqual(asked, ['h0.example', 'later.example'], 'a question that comes after the answer is asked');
        answers.shift()({ allow: true, remember: false });
        assert.equal(await later, 'allowed');
        asked.length = 0;
        const gone = settle(q('gone.example', () => false));
        const kept = settle(q('kept.example', () => true));
        await askedBy(1);
        assert.deepEqual(asked, ['kept.example'], 'a question no longer wanted is not shown');
        assert.equal(await gone, 'ConsentError', 'it is refused');
        answers.shift()({ allow: true, remember: false });
        assert.equal(await kept, 'allowed', 'and it refuses nothing else');
        return 'ok';
      } finally { consent.setAsker(null); await consent.set('stun', originalState); }
    });
  });

  test('components: fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable', async (assert) => {
    const id = 'test:component';
    let calls = 0;
    const bytes = enc('hello component');
    const digest = await components.sha256Hex(bytes);
    const fetcher = () => { calls++; return response(bytes.slice()); };
    try {
      const got = await components.ensure({ id, urls: ['https://example.invalid/a', 'https://example.invalid/b'], sha256: digest, label: 'Test' }, { fetch: fetcher });
      assert.equal(new TextDecoder().decode(got), 'hello component');
      assert.equal(calls, 1);
      const again = await components.ensure({ id, urls: ['https://example.invalid/a'], sha256: digest }, { fetch: fetcher });
      assert.equal(new TextDecoder().decode(again), 'hello component');
      assert.equal(calls, 1, 'served from the cache');
      const listed = (await components.list()).find((m) => m.id === id);
      assert.ok(listed && listed.size === bytes.byteLength && listed.sha256 === digest, 'listed with size and digest');
      // A wrong digest is refused, the second source is tried, and the cache is not poisoned.
      let err = null;
      try { await components.ensure({ id: 'test:bad', urls: ['https://example.invalid/x', 'https://example.invalid/y'], sha256: 'deadbeef', label: 'Fel' }, { fetch: () => response(enc('tampered')) }); } catch (e) { err = e; }
      assert.ok(err && /Fel/.test(err.message), 'hash mismatch reported: ' + (err && err.message));
      assert.ok(!(await components.meta('test:bad')), 'nothing cached for the bad component');
      // A failing first source falls back to the second.
      let n = 0;
      const got2 = await components.ensure({ id: 'test:second', urls: ['https://example.invalid/down', 'https://example.invalid/up'] }, { fetch: () => (++n === 1 ? response(enc('x'), 503) : response(enc('second'))) });
      assert.equal(new TextDecoder().decode(got2), 'second');
      await components.remove(id); await components.remove('test:second');
      assert.ok(!(await components.meta(id)), 'removed');
      return 'ok';
    } finally { for (const x of [id, 'test:bad', 'test:second']) await components.remove(x).catch(() => {}); }
  });

  test('components: a cached copy that fails its pinned digest is never used, even when its stored row carries that digest, and is fetched again after consent', async (assert) => {
    const idb = D.require('platform/storage/idb');
    const id = 'test:tampered';
    const good = enc('genuine component');
    const digest = await components.sha256Hex(good);
    const spec = { id, urls: ['https://example.invalid/component.js'], sha256: digest, label: 'Test' };
    const text = (bytes) => new TextDecoder().decode(new Uint8Array(bytes));
    let calls = 0;
    const fetcher = () => { calls++; return response(good.slice()); };
    // What code in a worker, or another page on the same origin, can write: other bytes under a row with the pinned digest.
    const tamper = async () => {
      await idb.saveBlob('component:' + id, enc('evil()').buffer);
      await idb.setSetting('component:' + id, { id, label: 'Test', sha256: digest, size: 6, fetchedAt: new Date().toISOString() });
    };
    return withoutOverride(async () => {
      const before = await consent.state('components');
      const asked = [];
      let allow = true;
      try {
        await consent.set('components', null);
        consent.setAsker(async (purpose, info) => { asked.push([purpose, info.host]); return { allow, remember: false }; });
        await tamper();
        assert.equal(text(await components.ensure(spec, { fetch: fetcher })), 'genuine component', 'the downloaded bytes, not the cached ones');
        assert.equal(calls, 1, 'fetched again');
        assert.deepEqual(asked, [['components', 'example.invalid']], 'through the consent');
        assert.equal(text(await idb.loadBlob('component:' + id)), 'genuine component', 'the cache holds the genuine bytes again');
        assert.equal(text(await components.ensure(spec, { fetch: fetcher })), 'genuine component');
        assert.equal(calls, 1, 'a sound copy is served from the cache');
        // Refused: the changed copy is not used, and it is gone.
        await tamper();
        allow = false;
        let err = null;
        try { await components.ensure(spec, { fetch: fetcher }); } catch (e) { err = e; }
        assert.ok(err && err.name === 'ConsentError', 'refused: ' + (err && err.message));
        assert.ok(!(await components.meta(id)), 'the changed copy is removed');
        assert.equal(calls, 1, 'nothing fetched without consent');
        // The bytes count, not the row: sound bytes under a wrong stored digest are used.
        await idb.saveBlob('component:' + id, good.slice().buffer);
        await idb.setSetting('component:' + id, { id, label: 'Test', sha256: 'deadbeef', size: good.byteLength, fetchedAt: new Date().toISOString() });
        assert.equal(text(await components.verified(spec)), 'genuine component');
        return 'ok';
      } finally {
        consent.setAsker(null);
        await consent.set('components', before);
        await components.remove(id).catch(() => {});
      }
    });
  });

  test('components: a copy over several chunks that fails its digest is removed, so is one that cannot be read, and with ask: false neither asks nor fetches', async (assert) => {
    const idb = D.require('platform/storage/idb');
    const id = 'test:chunks';
    const size = idb.CHUNK + 1024;
    const good = new Uint8Array(size);
    for (let i = 0; i < size; i++) good[i] = i % 251;
    const digest = await components.sha256Hex(good);
    const spec = { id, urls: ['https://example.invalid/chunks.js'], sha256: digest, label: 'Test' };
    const write = async (bytes) => {
      await idb.saveBlob('component:' + id, bytes.slice().buffer);
      await idb.setSetting('component:' + id, { id, label: 'Test', sha256: digest, size, fetchedAt: new Date().toISOString() });
    };
    const evil = good.slice();
    evil[size - 1] ^= 0xff;
    return withoutOverride(async () => {
      const before = await consent.state('components');
      const asked = [];
      let fetched = 0;
      const fetcher = () => { fetched++; return response(good.slice()); };
      try {
        await consent.set('components', null);
        consent.setAsker(async (purpose, info) => { asked.push([purpose, info.host]); return { allow: false, remember: false }; });
        await write(good);
        const whole = await components.verified(spec);
        assert.ok(whole && whole.byteLength === size, 'sound bytes over two chunks are read back whole');
        // Other bytes in the second chunk under a row that carries the pinned digest.
        await write(evil);
        assert.equal(await components.verified(spec), null, 'a changed second chunk fails its digest');
        assert.ok(!(await components.meta(id)), 'and the copy is removed');
        // A chunk that is not bytes: a miss as well, never a raw TypeError, and removed so that it can be fetched again.
        await write(good);
        const db = await idb.open();
        await db.blobs.put({ key: 'component:' + id + ':1', parent: 'component:' + id, index: 1, data: null });
        let thrown = null; let got;
        try { got = await components.verified(spec); } catch (e) { thrown = e; }
        assert.ok(!thrown && got === null, 'an unreadable copy is a miss: ' + (thrown && thrown.message));
        assert.ok(!(await components.meta(id)) && !(await idb.loadBlob('component:' + id)), 'and it is removed');
        // A flow at start (ask: false) meets a changed copy: refused, unasked and unfetched, in words that say how to allow it.
        await write(evil);
        let err = null;
        try { await components.ensure(spec, { ask: false, fetch: fetcher }); } catch (e) { err = e; }
        assert.ok(err && err.name === 'ConsentError' && err.reason === 'unattended', 'refused: ' + (err && err.message));
        assert.equal(err.message, D.t('consent.unattended', { purpose: D.t('consent.purpose.components') }));
        assert.equal(fetched, 0, 'nothing fetched');
        assert.deepEqual(asked, [], 'nothing asked');
        assert.ok(!(await components.meta(id)), 'the changed copy is removed');
        return 'ok';
      } finally {
        consent.setAsker(null);
        await consent.set('components', before);
        await components.remove(id).catch(() => {});
      }
    });
  });

  test('components: the Python runtime counts as cached only when its bytes have the pinned digests, and the yes holds until the cache changes', async (assert) => {
    const idb = D.require('platform/storage/idb');
    const catalog = D.require('engines/python/catalog');
    const real = components.verified;
    const calls = [];
    let refuse = '';
    // catalog looks verified() up on the module at every call, so a recorder sees what it checks.
    components.verified = async (spec) => { calls.push(spec); return spec.id === refuse ? null : new ArrayBuffer(1); };
    try {
      catalog.reset();
      assert.equal(await catalog.cachedRuntime(), true);
      assert.deepEqual(calls.map((s) => s.id), catalog.RUNTIME.map((f) => 'pyodide:' + f.file), 'every runtime file is checked by its bytes');
      assert.ok(calls.every((s, i) => s.sha256 === catalog.RUNTIME[i].sha256), 'against the digests pinned in the catalog');
      assert.equal(await catalog.cachedRuntime(), true);
      assert.equal(calls.length, catalog.RUNTIME.length, 'the yes is kept');
      await components.remove('test:none');
      refuse = 'pyodide:pyodide.asm.wasm';
      assert.equal(await catalog.cachedRuntime(), false, 'a change to the cache checks again, and a file that fails makes it false');
      assert.deepEqual(calls.slice(catalog.RUNTIME.length).map((s) => s.id), ['pyodide:pyodide.js', 'pyodide:pyodide.asm.js', 'pyodide:pyodide.asm.wasm'], 'stopping at that file');
    } finally { components.verified = real; catalog.reset(); }
    // Rows that carry the pinned digests over other bytes: only when no runtime file is cached, so a real cache is never touched.
    for (const f of catalog.RUNTIME) if (await components.meta('pyodide:' + f.file)) return 'ok (a runtime file is cached here: the rows are not rewritten)';
    try {
      for (const f of catalog.RUNTIME) {
        await idb.saveBlob('component:pyodide:' + f.file, enc('evil()').buffer);
        await idb.setSetting('component:pyodide:' + f.file, { id: 'pyodide:' + f.file, label: f.file, sha256: f.sha256, size: 6, fetchedAt: new Date().toISOString() });
      }
      catalog.reset();
      assert.equal(await catalog.cachedRuntime(), false, 'the bytes count, not the rows');
      assert.equal(await components.meta('pyodide:' + catalog.RUNTIME[0].file), null, 'and the changed copy is removed');
      assert.equal(await catalog.cachedPackages([]), false, 'so Python counts as not fetched at start');
      return 'ok';
    } finally {
      for (const f of catalog.RUNTIME) await components.remove('pyodide:' + f.file).catch(() => {});
      catalog.reset();
    }
  });

  test('remote R packages: the webR index is fetched once, only packages that are not bundled are downloaded, and the worker index is extended', async (assert) => {
    await packages.load();
    const bundled = packages.all()[0];
    const indexText = `Package: ${bundled}\nVersion: 9.9.9\nDepends: R (>= 4.0)\n\nPackage: fakepkg\nVersion: 1.2.3\nImports: ${bundled}, fakedep\n\nPackage: fakedep\nVersion: 0.1.0\n\nPackage: other\nVersion: 2.0.0\n`;
    const urls = [];
    const fetcher = (url) => { urls.push(url); if (/PACKAGES$/.test(url)) return response(enc(indexText)); if (/fakepkg_1\.2\.3\.tgz$/.test(url)) return response(enc('PKG1')); if (/fakedep_0\.1\.0\.tgz$/.test(url)) return response(enc('DEP')); return response(enc(''), 404); };
    remote.reset();
    try {
      assert.deepEqual(remote.missing([bundled, 'stats', 'fakepkg']), ['fakepkg'], 'bundled and base packages are not missing');
      const none = await remote.ensure([bundled], { fetch: fetcher });
      assert.deepEqual(none.assets, [], 'nothing to do for bundled packages');
      assert.equal(urls.length, 0, 'no network for bundled packages');
      const res = await remote.ensure(['fakepkg'], { fetch: fetcher });
      assert.deepEqual(res.packages.sort(), ['fakedep', 'fakepkg'], 'closure without the bundled dependency');
      assert.equal(res.assets.length, 2);
      assert.ok(res.assets.every((a) => a.startsWith(packages.contrib())), 'assets live under the contrib path: ' + res.assets[0]);
      assert.ok(urls.some((u) => u === remote.contribUrl() + 'PACKAGES'), 'index fetched from webR: ' + urls.join(' '));
      const provided = D.assets.peek(res.assets.find((a) => /fakepkg/.test(a)));
      assert.equal(new TextDecoder().decode(new Uint8Array(provided.data)), 'PKG1', 'the tgz is provided as an asset');
      const index = await D.assets.loadText(res.indexAsset);
      assert.ok(/Package: fakepkg\nVersion: 1\.2\.3/.test(index) && /Package: fakedep/.test(index), 'index extended');
      assert.ok(!/Package: other/.test(index), 'unrelated remote packages are not added');
      assert.ok(index.indexOf('Package: ' + bundled) >= 0, 'bundled entries kept');
      const again = await remote.ensure(['fakepkg'], { fetch: fetcher });
      assert.deepEqual(again.assets, [], 'already provided');
      return 'ok';
    } finally {
      remote.reset();
      for (const id of ['webr-repo:PACKAGES', 'webr-repo:fakepkg_1.2.3.tgz', 'webr-repo:fakedep_0.1.0.tgz']) await components.remove(id).catch(() => {});
      // The index asset goes back to the bundled text on the next load (the provided copy is dropped).
      D.assets.take(packages.indexAssetName());
    }
  });
})();
