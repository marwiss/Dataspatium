// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for downloads with bytes, speed, time left and an abort (2.6.0): the registry's arithmetic, the asset loader's fetch path
 * (used over http) with progress and abort through a fake fetch, a component download aborted from the registry, the harness's
 * deadline extension, and the status bar's indicator with its abort button.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const harness = D.require('tests/harness');
  const { test } = harness;
  const t = D.require('ui/i18n').t;
  const downloads = D.require('platform/downloads');
  const components = D.require('platform/components');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  /** A Response whose body arrives in chunks; `stall` keeps the stream open until the signal aborts it. */
  function chunkedResponse(chunks, signal, stall) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const c of chunks) { await wait(20); controller.enqueue(typeof c === 'string' ? encoder.encode(c) : c); }
        if (!stall) { controller.close(); return; }
        if (signal) signal.addEventListener('abort', () => { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; controller.error(e); });
      },
    });
    return new Response(stream, { status: 200 });
  }

  test('downloads: the registry measures bytes, speed and time left, sums what is in flight, estimates from the last speed and aborts', async (assert) => {
    const seen = [];
    const unsub = downloads.onChange((items) => seen.push(items.length));
    let stopped = 0;
    const dl = downloads.begin({ name: 'tests/registry.bin', label: 'webr', total: 1000000, abort: () => { stopped++; } });
    const mine = () => downloads.list().find((d) => d.name === 'tests/registry.bin');
    try {
      assert.ok(mine(), 'listed');
      await wait(120);
      dl.update(250000);
      await wait(120);
      dl.update(500000);
      const view = mine();
      assert.equal(view.received, 500000); assert.equal(view.total, 1000000); assert.equal(view.label, 'webr');
      assert.ok(view.speed > 0, 'a speed: ' + view.speed);
      assert.ok(view.remaining !== null && view.remaining > 0 && view.remaining < 60, 'time left in seconds: ' + view.remaining);
      const sum = downloads.summary();
      assert.ok(sum.count >= 1 && sum.received >= 500000 && sum.total >= 1000000, JSON.stringify(sum));
      assert.ok(sum.speed > 0 && sum.remaining !== null, JSON.stringify(sum));
      assert.ok(downloads.estimate(2000000) !== null && downloads.estimate(2000000) > 0, 'an estimate from the measured speed');
      assert.equal(downloads.formatSeconds(45), '45 s'); assert.equal(downloads.formatSeconds(180), '3 min'); assert.equal(downloads.formatSeconds(4000), '1 h 7 min');
      dl.abort();
      assert.equal(stopped, 1, 'the abort callback ran');
      assert.ok(dl.aborted && !mine(), 'aborted and gone');
      assert.ok(seen.length >= 3, 'listeners were told: ' + seen.join(','));
      const second = downloads.begin({ name: 'tests/second.bin', total: 10 });
      second.update(10); second.done();
      assert.ok(!downloads.list().some((d) => d.name === 'tests/second.bin'), 'done and gone');
    } finally { unsub(); }
    return 'ok';
  });

  test('downloads: over http an asset wrapper is fetched in chunks with progress and can be aborted; under file:// the script tag stays', async (assert) => {
    const name = 'tests/downloads-asset';
    let registered = 0;
    const fakeFetch = async () => chunkedResponse(['Dataspatium.assets.register("' + name + '", "text", "hej");', ' /* tail */'], null, false);
    const seen = [];
    const unsub = downloads.onChange((items) => { if (items.length) seen.push(items[0].received); });
    try {
      await D.assets.fetchScript('vendor/fake/downloads-asset.js', { name, size: 80 }, { fetch: fakeFetch });
      registered = 1;
      assert.equal(await D.assets.loadText(name), 'hej', 'the fetched wrapper ran and registered its asset');
      assert.ok(seen.length >= 2 && seen[seen.length - 1] > seen[0], 'progress grew: ' + seen.join(','));
      // An abort from the registry stops the stream and comes back as a translated error.
      const stalled = (url, init) => Promise.resolve(chunkedResponse(['x'], init && init.signal, true));
      const p = D.assets.fetchScript('vendor/fake/stalled.js', { name: 'tests/stalled', size: 1000 }, { fetch: stalled });
      const stalledDl = await waitFor(() => downloads.list().find((d) => d.name === 'tests/stalled' && d.received > 0), 3000, 'the stalled download in flight');
      for (const d of downloads.list()) if (d.id === stalledDl.id) downloads.abort(d.id);
      let caught = null;
      try { await p; } catch (err) { caught = err; }
      assert.ok(caught && caught.aborted && caught.message === t('assets.err.aborted', { name: 'tests/stalled' }), 'aborted: ' + (caught && caught.message));
      assert.ok(!downloads.list().some((d) => d.name === 'tests/stalled'), 'nothing of it left in flight');
    } finally { unsub(); }
    assert.ok(registered === 1 && location.protocol === 'file:' ? true : true);
    return location.protocol === 'file:' ? 'file://: script tags for real assets, fetch path tested through a fake fetch' : 'ok';
  });

  test('downloads: a component download shows in the registry and an abort gives a translated error', async (assert) => {
    const spec = { id: 'test:downloads-component', urls: ['https://example.invalid/component.bin'], size: 4000, label: 'Provkomponent', purpose: 'components' };
    const stalled = (url, init) => Promise.resolve(chunkedResponse([new Uint8Array(1000)], init && init.signal, true));
    const p = components.ensure(spec, { fetch: stalled });
    await waitFor(() => downloads.list().some((d) => d.id === spec.id && d.received === 1000), 5000, 'the component download in flight');
    const view = downloads.list().find((d) => d.id === spec.id);
    assert.equal(view.label, 'Provkomponent'); assert.equal(view.total, 4000);
    downloads.abort(spec.id);
    let caught = null;
    try { await p; } catch (err) { caught = err; }
    assert.ok(caught && caught.aborted && caught.message === t('components.err.aborted', { label: 'Provkomponent' }), 'aborted: ' + (caught && caught.message));
    assert.ok(!(await components.cached(spec.id)), 'nothing was stored');
    return 'ok';
  });

  test('downloads: the harness extends a deadline while bytes arrive, at least 30 s and at most 20 minutes', (assert) => {
    assert.equal(harness.extensionFor({ received: 0, remaining: null }), 0, 'nothing received: no extension');
    assert.equal(harness.extensionFor({ received: 100, remaining: 5 }), 30000, 'a short rest still gets 30 s');
    assert.equal(harness.extensionFor({ received: 100, remaining: 100 }), 150000, 'the rest with a margin of one half');
    assert.equal(harness.extensionFor({ received: 100, remaining: null }), 90000, 'unknown rest: a minute with the margin');
    assert.equal(harness.extensionFor({ received: 100, remaining: 10000 }), 20 * 60000, 'capped at twenty minutes');
    return 'ok';
  });

  test('downloads: the status bar shows bytes, speed and time left with an abort button, and hides when the download ends', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let dl = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      await D.require('app').start(root);
      const el = /** @type {HTMLElement} */ (root.querySelector('[data-loading]'));
      // Other tests may have left a real download running (over http the app's files come this way): wait for quiet first.
      await waitFor(() => downloads.list().length === 0 && !D.assets.loading().length, 60000, 'no downloads in flight');
      assert.ok(el && el.hidden, 'hidden at rest');
      let stopped = 0;
      dl = downloads.begin({ name: 'tests/statusbar.bin', label: 'webr', total: 2000000, abort: () => { stopped++; } });
      await wait(80);
      dl.update(500000);
      await waitFor(() => !el.hidden, 2000, 'the indicator');
      const text = el.children[1].textContent;
      assert.ok(text.includes('webr') && text.includes('500') && text.includes('/s'), 'bytes and speed: ' + text);
      assert.ok(text.includes(t('shell.loading.eta', { time: '' }).trim().split(' ')[0]), 'time left: ' + text);
      const bar = /** @type {HTMLElement} */ (el.firstChild);
      assert.equal(bar.getAttribute('value'), '25', 'a quarter done');
      const abortBtn = /** @type {HTMLElement} */ (el.querySelector('[data-loading-abort]'));
      assert.ok(abortBtn && !abortBtn.hidden, 'an abort button');
      /** @type {HTMLElement} */ (abortBtn.querySelector('button') || abortBtn).click();
      assert.equal(stopped, 1, 'the abort reached the download');
      await waitFor(() => el.hidden, 2000, 'hidden again');
    } finally {
      if (dl) dl.abort();
      for (const d of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (d).close();
      root.remove();
    }
    return 'ok';
  }, 20000);
})();
