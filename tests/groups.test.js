// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests of the groups of scripts (src/boot.js GROUPS, PLAN 4 step 2): a group loads once, in order, after the groups it needs,
 * and one that fails is tried again; a mode of a group activates only after its group has run, and a mode asked for meanwhile
 * wins; a deep link waits for the group; the start list leaves the groups out, and the test page loads them all. The test page
 * has every group of the app loaded, so the loading itself is tried with the tests' own groups (tests/fixtures/groups/).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  /** What the fixture scripts note when they run, in order, and the mode they define (it counts its activations). */
  const support = {
    /** @type {string[]} */ log: [],
    /** @param {string} id */
    fakeMode: (id) => ({
      createMode(ctx) {
        const mode = { id, activations: 0, activate(slots) { mode.activations += 1; slots.center.append(ctx.ui.h('p', { 'data-fake-mode': id, text: id })); }, deactivate() {} };
        return mode;
      },
    }),
  };
  D.define('tests/groups/support', () => support);
  const FIX = 'tests/fixtures/groups/';
  /** A group of the tests' own, added once (the page keeps its groups). @param {string} name @param {string[]} files @param {string[]} [needs] */
  function group(name, files, needs) {
    if (!D.groups.list().some((g) => g.name === name)) D.groups.add({ name, needs, scripts: files.map((f) => FIX + f) });
    return name;
  }
  /** The app in a hidden root, at the address `hash`. @param {string} [hash] */
  async function startShell(hash) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search + (hash || ''));
    const shell = await D.require('app').start(root);
    return { root, shell };
  }
  const stop = (root) => { history.replaceState(null, '', location.pathname + location.search); root.remove(); };

  test('groups: a group loads once, in order, after the groups it needs, and ensure runs at once when it is loaded', async (assert) => {
    const a = group('tests-a', ['a1.js', 'a2.js']);
    const b = group('tests-b', ['b.js'], ['tests-a']);
    const ran = () => support.log.filter((x) => /^(a1|a2|b)$/.test(x));
    assert.ok(!D.groups.loaded(a) && !D.groups.loaded(b) && !D.has('tests/groups/a1'), 'not loaded before');
    const first = D.loadGroup(b);
    assert.ok(D.loadGroup(b) === first, 'the same promise while it loads');
    const both = D.ensure([a, b]);
    assert.ok(!D.groups.loaded(b), 'still on its way');
    await Promise.all([first, both]);
    assert.deepEqual(ran(), ['a1', 'a2', 'b'], 'the group it needs first, each script in its order');
    assert.ok(D.groups.loaded(a) && D.groups.loaded(b), 'both loaded');
    assert.equal(D.require('tests/groups/b').after, 'a2', 'the modules resolve across the groups');
    await D.loadGroup(b);
    await D.ensure(a);
    assert.deepEqual(ran(), ['a1', 'a2', 'b'], 'nothing runs twice');
    assert.equal(document.querySelectorAll('script[src$="' + FIX + 'a1.js"]').length, 1, 'one script element per file');
    let now = false;
    const value = D.ensure([b], () => { now = true; return 7; });
    assert.ok(now, 'then runs in the same task for a loaded group');
    assert.equal(await value, 7, 'and its result comes back');
    await assert.throws(() => D.loadGroup('tests-no-such-group'), /Unknown group/);
    return 'ok';
  });

  test('groups: ?inflight= sets the scripts on their way at once, a whole number from 1 to 32, else eight', (assert) => {
    const of = D.boot.inFlightOf;
    assert.equal(of('?inflight=16'), 16);
    for (const search of ['', '?inflight=0', '?inflight=x']) assert.equal(of(search), 8, 'eight for ' + JSON.stringify(search));
    for (const [search, n] of [['?inflight=1', 1], ['?inflight=32', 32], ['?inflight=33', 8], ['?inflight=2.5', 8], ['?inflight=-4', 8], ['?lang=sv&inflight=12&profil=start', 12]]) assert.equal(of(search), n, search);
    assert.equal(D.boot.inFlight, of(location.search), 'the loader of this page uses it');
    return D.boot.inFlight + ' at a time';
  });

  test('groups: a group whose file does not load fails with its path and is tried again on the next call', async (assert) => {
    const name = group('tests-missing', ['no-such-file.js']);
    /** @type {any} */ let err = null;
    try { await D.loadGroup(name); } catch (e) { err = e; }
    assert.ok(err && err.path === FIX + 'no-such-file.js', 'the path of the file: ' + (err && err.message));
    assert.ok(!D.groups.loaded(name), 'not loaded');
    assert.equal(document.querySelectorAll('script[src$="no-such-file.js"]').length, 0, 'the failed element is gone');
    err = null;
    try { await D.ensure([name]); } catch (e) { err = e; }
    assert.ok(err && err.path === FIX + 'no-such-file.js', 'tried again, and fails again');
    return 'ok';
  });

  test('groups: a mode of a group activates only after its group has run, and the mode asked for meanwhile wins', async (assert) => {
    const { root, shell } = await startShell();
    try {
      shell.registerLazyMode('tests-lazy', group('tests-lazy', ['mode-lazy.js']), 'tests/groups/mode-lazy');
      assert.ok(!shell.modes.has('tests-lazy'), 'not created before its group');
      const shown = shell.activate('tests-lazy');
      assert.ok(root.querySelector('.dm-center [data-mode-loading="tests-lazy"]'), 'the workspace says that the mode loads');
      assert.ok(!shell.modes.has('tests-lazy') && shell.store.get().mode !== 'tests-lazy', 'not active while its group loads');
      await shown;
      const mode = shell.modes.get('tests-lazy');
      assert.ok(mode && mode.activations === 1, 'created and activated once, after its group');
      assert.equal(shell.store.get().mode, 'tests-lazy');
      assert.equal(location.hash, '#/tests-lazy');
      assert.ok(root.querySelector('.dm-center [data-fake-mode="tests-lazy"]') && !root.querySelector('[data-mode-loading]'), 'drawn in place of the loading state');
      // Loaded once, the mode opens in the same task, like the modes of the start.
      shell.activate('hantera');
      shell.activate('tests-lazy');
      assert.equal(mode.activations, 2, 'at once the second time');
      // Asked for and left before its group has run: the mode asked for last stays.
      shell.registerLazyMode('tests-late', group('tests-late', ['mode-late.js']), 'tests/groups/mode-late');
      const late = shell.activate('tests-late');
      shell.activate('hantera');
      await late;
      assert.equal(shell.store.get().mode, 'hantera', 'Hantera, asked for last');
      const lateMode = shell.modes.get('tests-late');
      assert.ok(lateMode && lateMode.activations === 0, 'the late mode is created but not opened');
      assert.ok(!root.querySelector('[data-mode-loading]'), 'no loading state left');
      return 'ok';
    } finally { stop(root); }
  });

  test('groups: a deep link to a mode of a group opens it with its object, and openRoute waits for the group', async (assert) => {
    /** @type {any} */ let meta = null;
    /** @type {HTMLElement|null} */ let root = null;
    try {
      meta = await datasets.create({ name: 'Grupper länk', columns: [{ name: 'a', type: 'integer' }], rows: [[1]] });
      const link = '#/kontrollera/' + encodeURIComponent(meta.shortName);
      const started = await startShell(link);
      root = started.root;
      const shell = started.shell;
      await waitFor(() => shell.store.get().selectedId === meta.id, 5000, 'the dataset of the link');
      assert.equal(shell.store.get().mode, 'kontrollera', 'the mode of the link');
      assert.equal(location.hash, link, 'the link stays in the address');
      // A mode whose group has not run: the route loads the group and creates the mode before it chooses the object.
      shell.registerLazyMode('tests-route', group('tests-route', ['mode-route.js']), 'tests/groups/mode-route');
      shell.store.set({ selectedId: null });
      assert.ok(!shell.modes.has('tests-route'), 'not created yet');
      await shell.openRoute({ mode: 'tests-route', object: meta.shortName });
      assert.ok(D.groups.loaded('tests-route') && shell.modes.has('tests-route'), 'the group loaded and the mode created');
      assert.equal(shell.store.get().selectedId, meta.id, 'the object chosen');
      assert.equal(location.hash, '#/tests-route/' + encodeURIComponent(meta.shortName), 'the address of the route');
      return 'ok';
    } finally {
      if (meta) await datasets.remove(meta.id);
      if (root) stop(root);
    }
  });

  test('groups: the start list leaves the groups out, the seven modes are groups of their own, and the test page loads every group', (assert) => {
    const start = D.groups.start();
    const groups = D.groups.list().filter((g) => !g.name.startsWith('tests-'));
    const lazy = groups.flatMap((g) => g.scripts);
    assert.ok(groups.length >= 7 && lazy.length > 0, 'the app has groups');
    for (const p of lazy) assert.ok(!start.includes(p), p + ' is not loaded at start');
    assert.equal(new Set(lazy).size, lazy.length, 'each file in one group');
    for (const p of ['src/platform/registry.js', 'src/ui/i18n/i18n.js', 'src/ui/shell/shell.js', 'src/ui/modes/inhamta.js', 'src/ui/modes/hantera.js', 'src/app.js']) assert.ok(start.includes(p), p + ' at start');
    const lazyModes = D.require('app').LAZY_MODES;
    for (const id of lazyModes) {
      const g = groups.find((x) => x.name === id);
      assert.ok(g && g.scripts.includes('src/ui/modes/' + id + '.js'), id + ' is a group of its own name');
    }
    assert.deepEqual(['inhamta', 'hantera'].concat(lazyModes).sort(), D.require('ui/shell').MODES.slice().sort(), 'every mode in the start or a group');
    groups.forEach((g, i) => { for (const n of g.needs) assert.ok(groups.slice(0, i).some((x) => x.name === n), g.name + ' needs ' + n + ', an earlier group'); });
    assert.ok(D.groups.everything, 'the test page loads every group at start');
    for (const g of groups) assert.ok(D.groups.loaded(g.name), g.name + ' is loaded');
    for (const name of ['ui/modes/analysera', 'ui/bearbeta/ai-panel', 'ui/assistant', 'ui/api/api-view', 'mobile/app']) assert.ok(D.has(name), name + ' is there');
    return start.length + ' scripts at start, ' + lazy.length + ' in ' + groups.length + ' groups';
  });
})();
