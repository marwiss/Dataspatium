// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests of internet access by consent, components fetched on demand (hash, cache, removal) and remote R packages. */
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
