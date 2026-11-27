// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of internet access by consent, components fetched on demand (hash, cache, a changed cached copy, removal, MD5) and remote R
 * packages (the pinned index, each package's sum). Nothing reaches the network: fetches are stand-ins.
 */
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
  const t = (key, params) => D.t(key, params);

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

  /** Run with the purposes' states and their kept hosts put back afterwards. */
  async function keepingHosts(purposes, fn) {
    const saved = [];
    for (const p of purposes) saved.push([p, await consent.state(p), await consent.hosts(p)]);
    try { return await fn(); } finally {
      consent.setAsker(null);
      for (const [p, v, list] of saved) {
        await consent.set(p, v);
        for (const x of await consent.hosts(p)) await consent.setHost(p, x.host, null);
        for (const x of list) await consent.setHost(p, x.host, x.state);
      }
    }
  }

  test('consent per host (F102 a, F103 a): Python code is asked once per host and the answer is kept per host, a refused host stays refused, a yes for the purpose covers no host chosen by content, a removed answer is asked again, and ask: false asks nothing', async (assert) => {
    await withoutOverride(() => keepingHosts(['python', 'url'], async () => {
      const asked = [];
      let answer = { allow: true, remember: true };
      const settle = (p) => p.then(() => 'allowed', (e) => e.name + ':' + e.reason);
      for (const p of ['python', 'url']) { await consent.set(p, null); for (const x of await consent.hosts(p)) await consent.setHost(p, x.host, null); }
      consent.setAsker(async (purpose, info) => { asked.push([purpose, info.host, !!info.perHost]); return answer; });
      const py = (host, extra) => settle(consent.require('python', Object.assign({ host, label: 'https://' + host + '/x' }, extra || {})));
      assert.equal(await py('a.example.invalid'), 'allowed');
      assert.equal(await py('A.example.invalid'), 'allowed', 'the same host, whatever its case');
      assert.deepEqual(asked, [['python', 'a.example.invalid', true]], 'asked once, per host');
      assert.equal(await consent.hostState('python', 'a.example.invalid'), 'granted', 'kept for that host');
      assert.equal(await consent.state('python'), null, 'not for the purpose');
      answer = { allow: false, remember: true };
      assert.equal(await py('b.example.invalid'), 'ConsentError:denied', 'another host is asked, and refused');
      assert.equal(await py('b.example.invalid'), 'ConsentError:denied', 'and stays refused');
      assert.equal(asked.length, 2, 'without asking again');
      answer = { allow: true, remember: true };
      assert.equal(await py('c.example.invalid', { ask: false }), 'ConsentError:unattended', 'ask: false (a flow at start) asks nothing for a new host');
      assert.equal(await py('a.example.invalid', { ask: false }), 'allowed', 'and lets a host kept for good through');
      assert.equal(asked.length, 2);
      assert.deepEqual(await consent.hosts('python'), [{ host: 'a.example.invalid', state: 'granted' }, { host: 'b.example.invalid', state: 'denied' }], 'the hosts are listed with their answers');
      await consent.setHost('python', 'b.example.invalid', null);
      answer = { allow: true, remember: false };
      assert.equal(await py('b.example.invalid'), 'allowed', 'a removed answer is asked again');
      assert.equal(await consent.hostState('python', 'b.example.invalid'), null, 'a yes for once keeps nothing');
      assert.equal(await settle(consent.require('python', { host: '' })), 'ConsentError:denied', 'a request without a host is refused');
      await consent.set('python', 'denied');
      assert.equal(await py('a.example.invalid'), 'ConsentError:denied', 'a refused purpose refuses a host kept for good');
      // url: what the person types stays per purpose, what content chooses is per host.
      await consent.set('url', 'granted');
      asked.length = 0;
      assert.equal(await settle(consent.require('url', { host: 'typed.example.invalid' })), 'allowed');
      assert.equal(asked.length, 0, 'an address the person typed is covered by the purpose');
      assert.equal(await settle(consent.require('url', { host: 'figure.example.invalid', perHost: true })), 'allowed');
      assert.deepEqual(asked, [['url', 'figure.example.invalid', true]], 'a host chosen by content is asked about all the same');
      return 'ok';
    }));
  });

  test('consent per host: many hosts in one question name only those not yet answered, keep the answer for each, and a refused purpose or ask: false allows only what is kept', async (assert) => {
    await withoutOverride(() => keepingHosts(['basemaps'], async () => {
      const asked = [];
      let answer = { allow: true, remember: true };
      await consent.set('basemaps', null);
      for (const x of await consent.hosts('basemaps')) await consent.setHost('basemaps', x.host, null);
      consent.setAsker(async (purpose, info) => { asked.push(info.hosts.slice()); return answer; });
      const hosts = (list, info) => consent.allowHosts('basemaps', list, info).then((s) => Array.from(s).sort());
      assert.deepEqual(await hosts(['a.example.invalid', 'b.example.invalid']), ['a.example.invalid', 'b.example.invalid']);
      answer = { allow: false, remember: true };
      assert.deepEqual(await hosts(['a.example.invalid', 'c.example.invalid', 'd.example.invalid']), ['a.example.invalid'], 'the kept host passes, the refused ones do not');
      assert.deepEqual(asked, [['a.example.invalid', 'b.example.invalid'], ['c.example.invalid', 'd.example.invalid']], 'each question named only the hosts not yet answered');
      assert.deepEqual(await hosts(['c.example.invalid', 'e.example.invalid'], { ask: false }), [], 'ask: false asks nothing and allows no new host');
      assert.equal(asked.length, 2);
      await consent.set('basemaps', 'denied');
      assert.deepEqual(await hosts(['a.example.invalid']), [], 'a refused purpose allows none');
      await consent.set('basemaps', 'granted');
      answer = { allow: true, remember: false };
      assert.deepEqual(await hosts(['a.example.invalid', 'f.example.invalid']), ['a.example.invalid', 'f.example.invalid'], 'a yes for the purpose still asks about a new host');
      assert.deepEqual(asked[2], ['f.example.invalid']);
      assert.equal(await consent.hostState('basemaps', 'f.example.invalid'), null, 'a yes for once keeps nothing');
      return 'ok';
    }));
  });

  test('consent per host: Internetåtkomst has a row for Python code reaching the internet that asks per host or is denied, lists the hosts kept per purpose, and removing one asks again', async (assert) => {
    await withoutOverride(() => keepingHosts(['python', 'url'], async () => {
      await consent.setHost('python', 'data.example.invalid', 'granted');
      await consent.setHost('url', 'pic.example.invalid', 'denied');
      const logged = [];
      let rerendered = 0;
      const ctx = { ui: { icon: () => document.createElement('span'), toast: { show() {} }, button: D.require('ui/basic').button }, shell: { log: (text) => logged.push(text) } };
      const card = await D.require('ui/settings/network').networkCard(ctx, () => { rerendered++; });
      const row = /** @type {any} */ (Array.from(card.querySelectorAll('dm-select')).find((s) => s.getAttribute('label') === D.t('consent.purpose.python')));
      assert.ok(row, 'a row for the new purpose');
      assert.deepEqual(row.options.map((o) => o.value), ['ask', 'denied'], 'it asks per host or is denied, never allowed for every host');
      assert.equal(row.options[0].label, D.t('consent.state.perhost'));
      const listed = Array.from(card.querySelectorAll('[data-consent-host]')).map((el) => el.getAttribute('data-consent-host'));
      assert.ok(listed.includes('python data.example.invalid') && listed.includes('url pic.example.invalid'), 'the kept hosts are listed: ' + listed.join(', '));
      const remove = /** @type {any} */ (card.querySelector('[data-consent-host="python data.example.invalid"] dm-button'));
      remove.click();
      const t0 = performance.now();
      while (!rerendered && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 20));
      assert.equal(await consent.hostState('python', 'data.example.invalid'), null, 'removed');
      assert.equal(await consent.hostState('url', 'pic.example.invalid'), 'denied', 'the other stays');
      assert.ok(logged.includes(D.t('consent.hosts.removed', { host: 'data.example.invalid', purpose: D.t('consent.purpose.python') })), 'and the log says so');
      const asked = [];
      consent.setAsker(async (purpose, info) => { asked.push(info.host); return { allow: false, remember: false }; });
      let err = null;
      try { await consent.require('python', { host: 'data.example.invalid' }); } catch (e) { err = e; }
      assert.ok(err && err.name === 'ConsentError' && asked[0] === 'data.example.invalid', 'the next request asks again');
      return 'ok';
    }));
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
      try { await components.ensure({ id: 'test:bad', urls: ['https://example.invalid/x', 'https://example.invalid/y'], sha256: '0'.repeat(64), label: 'Fel' }, { fetch: () => response(enc('tampered')) }); } catch (e) { err = e; }
      assert.ok(err && /Fel/.test(err.message), 'hash mismatch reported: ' + (err && err.message));
      assert.ok(!(await components.meta('test:bad')), 'nothing cached for the bad component');
      // A failing first source falls back to the second.
      let n = 0;
      const got2 = await components.ensure({ id: 'test:second', urls: ['https://example.invalid/down', 'https://example.invalid/up'], sha256: await components.sha256Hex(enc('second')) }, { fetch: () => (++n === 1 ? response(enc('x'), 503) : response(enc('second'))) });
      assert.equal(new TextDecoder().decode(got2), 'second');
      // A component without a pinned digest is refused before anything is asked or fetched (F118 a).
      let fetchedNone = 0; let none = null;
      try { await components.ensure({ id: 'test:nodigest', urls: ['https://example.invalid/n'], label: 'Utan summa' }, { fetch: () => { fetchedNone++; return response(enc('n')); } }); } catch (e) { none = e; }
      assert.ok(none && none.message === t('components.err.nodigest', { label: 'Utan summa' }) && fetchedNone === 0, 'no digest, no fetch: ' + (none && none.message));
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

  /** A stand-in for webR's index with the MD5 sums of the given package files, and its pin (the tests never reach the repository). */
  async function fakeIndex(bundled, sums = {}) {
    const md5 = async (name) => (sums[name] === null ? '' : `MD5sum: ${sums[name] || await components.md5Hex(enc(name === 'fakepkg' ? 'PKG1' : name === 'fakedep' ? 'DEP' : name))}\n`);
    const text = `Package: ${bundled}\nVersion: 9.9.9\nDepends: R (>= 4.0)\n\nPackage: fakepkg\nVersion: 1.2.3\nImports: ${bundled}, fakedep\n${await md5('fakepkg')}\nPackage: fakedep\nVersion: 0.1.0\n${await md5('fakedep')}\nPackage: other\nVersion: 2.0.0\n`;
    return { text, pin: { sha256: await components.sha256Hex(enc(text)) } };
  }
  const R_IDS = ['webr-repo:PACKAGES', 'webr-repo:fakepkg_1.2.3.tgz', 'webr-repo:fakedep_0.1.0.tgz'];

  test('remote R packages: the webR index is fetched once, only packages that are not bundled are downloaded, and the worker index is extended', async (assert) => {
    await packages.load();
    const bundled = packages.all()[0];
    const { text: indexText, pin } = await fakeIndex(bundled);
    const urls = [];
    const fetcher = (url) => { urls.push(url); if (/PACKAGES$/.test(url)) return response(enc(indexText)); if (/fakepkg_1\.2\.3\.tgz$/.test(url)) return response(enc('PKG1')); if (/fakedep_0\.1\.0\.tgz$/.test(url)) return response(enc('DEP')); return response(enc(''), 404); };
    for (const id of R_IDS) await components.remove(id).catch(() => {});
    remote.reset({ pin });
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
      for (const id of R_IDS) await components.remove(id).catch(() => {});
      // The index asset goes back to the bundled text on the next load (the provided copy is dropped).
      D.assets.take(packages.indexAssetName());
    }
  });

  test('components: MD5 matches RFC 1321 across block edges and slices', async (assert) => {
    const a = (n) => enc('a'.repeat(n));
    assert.equal(await components.md5Hex(new Uint8Array(0)), 'd41d8cd98f00b204e9800998ecf8427e');
    assert.equal(await components.md5Hex(enc('abc')), '900150983cd24fb0d6963f7d28e17f72');
    assert.equal(await components.md5Hex(enc('The quick brown fox jumps over the lazy dog').buffer), '9e107d9d372bb6826bd81d3542a419d6', 'an ArrayBuffer too');
    assert.equal(await components.md5Hex(a(55)), 'ef1772b6dff9a122358552954ad0df65');
    assert.equal(await components.md5Hex(a(56)), '3b0c8ac703f828b04c6c197006d17218', 'the length spills into a second block');
    assert.equal(await components.md5Hex(a(64)), '014842d480b571495a4a0363793f7367');
    assert.equal(await components.md5Hex(a(2000000)), '2a915e52d86d42e58e580f4073120a6b', 'over two slices');
    return 'ok';
  });

  test('remote R packages: the index must have its pinned SHA-256 and each package the MD5 it lists, downloaded and from the cache; one without a sum, or an R version without a pin, is refused', async (assert) => {
    const idb = D.require('platform/storage/idb');
    await packages.load();
    const bundled = packages.all()[0];
    const pinned = remote.INDEX_PINS[remote.rVersion()];
    assert.ok(pinned && /^[0-9a-f]{64}$/.test(pinned.sha256), 'the bundled R version ' + remote.rVersion() + ' has a pinned index: move the pin with webR (tools/webr_repo_pin.py)');
    const good = await fakeIndex(bundled);
    let pkgBytes = 'PKG1';
    const urls = [];
    const fetcherFor = (indexText) => (url) => { urls.push(url); if (/PACKAGES$/.test(url)) return response(enc(indexText)); if (/fakepkg_1\.2\.3\.tgz$/.test(url)) return response(enc(pkgBytes)); if (/fakedep_0\.1\.0\.tgz$/.test(url)) return response(enc('DEP')); return response(enc(''), 404); };
    const failure = async (p) => { try { await p; return null; } catch (e) { return e; } };
    const clear = async () => { for (const id of R_IDS) await components.remove(id).catch(() => {}); D.assets.take(packages.indexAssetName()); };
    const realContrib = packages.contrib;
    try {
      await clear();
      // 1. An index that is not the pinned one is never used or kept.
      remote.reset({ pin: { sha256: '0'.repeat(64) } });
      let err = await failure(remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text) }));
      assert.ok(err && err.integrity && err.message === t('r.remote.index.changed', { version: remote.rVersion() }), 'refused: ' + (err && err.message));
      assert.equal(await components.meta('webr-repo:PACKAGES'), null, 'nothing kept');
      // 2. A package whose bytes lack the listed sum is neither kept nor provided.
      remote.reset({ pin: good.pin });
      pkgBytes = 'EVIL';
      err = await failure(remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text) }));
      assert.ok(err && err.integrity && err.message === t('components.err.hash', { label: 'fakepkg' }), 'refused: ' + (err && err.message));
      assert.equal(await components.meta('webr-repo:fakepkg_1.2.3.tgz'), null, 'the wrong file is not kept');
      assert.ok(!remote.provided().includes('fakepkg'), 'nor provided');
      // 3. The right bytes go through; a cached copy changed afterwards counts as not cached, is removed and is fetched again.
      pkgBytes = 'PKG1';
      const res = await remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text) });
      assert.deepEqual(res.packages.sort(), ['fakedep', 'fakepkg']);
      remote.reset({ pin: good.pin });
      assert.equal(await remote.cached(['fakepkg']), true, 'the pinned index and both files from the cache');
      await idb.saveBlob('component:webr-repo:fakepkg_1.2.3.tgz', enc('EVIL').buffer);
      remote.reset({ pin: good.pin });
      assert.equal(await remote.cached(['fakepkg']), false, 'the bytes count, not the row');
      assert.equal(await components.meta('webr-repo:fakepkg_1.2.3.tgz'), null, 'and the changed copy is removed');
      urls.length = 0;
      const again = await remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text) });
      assert.ok(urls.some((u) => /fakepkg_1\.2\.3\.tgz$/.test(u)) && !urls.some((u) => /PACKAGES$/.test(u)), 'only the package is fetched again: ' + urls.join(' '));
      assert.equal(new TextDecoder().decode(new Uint8Array(D.assets.peek(again.assets.find((x) => /fakepkg/.test(x))).data)), 'PKG1');
      // The pinned index never goes stale: one fetched a month ago is used as it is, also by a run at start, and nothing is fetched.
      const row = await components.meta('webr-repo:PACKAGES');
      await idb.setSetting('component:webr-repo:PACKAGES', Object.assign({}, row, { fetchedAt: new Date(Date.now() - 30 * 86400000).toISOString() }));
      remote.reset({ pin: good.pin });
      urls.length = 0;
      const old = await remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text), ask: false });
      assert.deepEqual(old.packages.sort(), ['fakedep', 'fakepkg']);
      assert.deepEqual(urls, [], 'nothing fetched for an index a month old');
      // 4. A package the index gives no sum is refused before anything is downloaded.
      await clear();
      const bare = await fakeIndex(bundled, { fakepkg: null });
      remote.reset({ pin: bare.pin });
      urls.length = 0;
      err = await failure(remote.ensure(['fakepkg'], { fetch: fetcherFor(bare.text) }));
      assert.ok(err && err.integrity && err.message === t('r.remote.nodigest', { name: 'fakepkg' }), 'refused: ' + (err && err.message));
      assert.ok(!urls.some((u) => /\.tgz$/.test(u)), 'no package fetched: ' + urls.join(' '));
      assert.equal(await remote.cached(['fakepkg']), false);
      // 5. An R version without a pinned index uses nothing, and R says why before any code runs.
      remote.reset();
      /** @type {any} */ (packages).contrib = () => 'webr-repo/bin/emscripten/contrib/9.9/';
      err = await failure(remote.ensure(['fakepkg'], { fetch: fetcherFor(good.text) }));
      assert.ok(err && err.integrity && err.message === t('r.remote.unpinned', { version: '9.9' }), 'refused: ' + (err && err.message));
      err = await failure(D.require('data/r-bridge').bridge.ensureRemote(['fakepkg']));
      assert.ok(err && err.integrity, 'the R run fails with the reason: ' + (err && err.message));
      assert.equal(await remote.cached(['fakepkg']), false);
      return 'ok';
    } finally {
      /** @type {any} */ (packages).contrib = realContrib;
      remote.reset();
      await clear();
    }
  });
})();
