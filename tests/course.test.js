// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the beginner's course (Grundkurs): texts, start rules, progress and the "do it for me" actions. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  const courseMod = D.require('ui/course');
  D.require('ui/components');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      if (await fn()) return;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }
  /** Run `fn` with the saved course progress replaced, and put the original back afterwards. */
  async function withSavedState(value, fn) {
    const before = localStorage.getItem(courseMod.KEY);
    if (value === null) localStorage.removeItem(courseMod.KEY); else localStorage.setItem(courseMod.KEY, JSON.stringify(value));
    try { return await fn(); } finally { if (before === null) localStorage.removeItem(courseMod.KEY); else localStorage.setItem(courseMod.KEY, before); }
  }
  /** Poll the course until the task of step `id` counts as done. */
  async function settle(course, id) { await waitFor(async () => { await course.tick(); return course.isDone(id); }, 8000, id + ' done'); }
  /** A shell stand-in with a real store; enough for opening, navigating and the start rules. */
  function fakeShell(datasets) {
    const store = D.require('ui/state').createStore({ mode: 'inhamta', datasets, selectedId: null, lastRun: null, lastExport: null });
    const toasts = [];
    return { store, toasts, activate(id) { store.set({ mode: id }); }, log() {}, toast(message, options) { toasts.push({ message, options }); } };
  }

  test('course: every step has its texts in all six languages', (assert) => {
    assert.equal(courseMod.STEPS.length, 9);
    assert.deepEqual(courseMod.STEPS.map((s) => s.id), ['welcome', 'import', 'manage', 'process', 'sql', 'r', 'viz', 'export', 'finish']);
    for (const lang of i18n.LANGUAGES.map((l) => l.code)) {
      for (const step of courseMod.STEPS) {
        for (const part of ['title', 'p1']) {
          const key = `course.${step.id}.${part}`;
          assert.ok(i18n.tIn(lang, key) !== key, `${lang} ${key}`);
        }
        if (step.mode) for (const part of ['task', 'done']) assert.ok(i18n.tIn(lang, `course.${step.id}.${part}`) !== `course.${step.id}.${part}`, `${lang} ${step.id}.${part}`);
      }
      // The column the course creates must be a plain identifier in SQL and R.
      assert.ok(/^[a-z][a-z0-9_]*$/.test(i18n.tIn(lang, 'course.process.column')), lang + ' column name');
    }
    return courseMod.STEPS.length + ' steps';
  });

  test('course: opens at the first start, remembers closing and finishing, is offered once to existing users', async (assert) => {
    await withSavedState(null, async () => {
      const shell = fakeShell([]);
      const course = courseMod.create(shell);
      course.autoStart();
      assert.ok(course.isOpen(), 'opened for an empty workspace');
      assert.equal(course.step, 'welcome');
      const panel = document.querySelector('.dm-floating');
      assert.ok(panel, 'floating panel in the page');
      assert.equal(panel.querySelector('.dm-floating-title').textContent, t('course.welcome.title'));
      assert.ok(panel.querySelector('.dm-floating-meta').textContent.includes(t('course.step', { n: 1, total: 9 })), 'step counter');
      course.next();
      assert.equal(course.step, 'import');
      assert.ok(panel.querySelector('.dm-course-task'), 'task box');
      assert.ok(panel.textContent.includes(t('presets.try')), 'task names the button to click');
      assert.equal(courseMod.load().status, 'open');
      // Until the user is in the step's mode, that mode's button is highlighted.
      course.next();
      assert.equal(course.step, 'manage');
      const btn = document.createElement('button');
      btn.className = 'dm-mode-btn'; btn.setAttribute('data-mode', 'hantera'); document.body.appendChild(btn);
      shell.store.set({ mode: 'inhamta' });
      await course.tick();
      assert.ok(btn.classList.contains('dm-course-target'), 'mode button highlighted');
      course.panel().collapse(true);
      await course.tick();
      assert.ok(!btn.classList.contains('dm-course-target'), 'no highlight while minimised');
      btn.remove();
      course.close();
      assert.ok(!course.isOpen() && !document.querySelector('.dm-floating'), 'closed');
      assert.deepEqual(courseMod.load(), { status: 'closed', step: 2 });
      // A closed course stays closed at the next start, and opening it again resumes where the user left off.
      course.autoStart();
      assert.ok(!course.isOpen(), 'not reopened automatically');
      course.open();
      assert.equal(course.step, 'manage');
      course.open(courseMod.STEPS.length - 1);
      assert.equal(course.step, 'finish');
      course.finish();
      assert.equal(courseMod.load().status, 'done');
      course.open();
      assert.equal(course.step, 'welcome', 'a finished course starts from the beginning');
      course.close();
    });
    await withSavedState(null, async () => {
      const shell = fakeShell([{ id: 'x', name: 'Befintlig' }]);
      const course = courseMod.create(shell);
      course.autoStart();
      assert.ok(!course.isOpen(), 'not opened over an existing workspace');
      assert.equal(shell.toasts.length, 1);
      assert.equal(shell.toasts[0].message, t('course.offer'));
      assert.equal(courseMod.load().status, 'offered');
      course.autoStart();
      assert.equal(shell.toasts.length, 1, 'offered only once');
    });
    return 'ok';
  });

  test('course: "Do it for me" imports the example, adds a column, runs SQL and makes a chart in the real app', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const datasets = D.require('data/datasets');
    const charts = D.require('viz/charts');
    const before = new Set((await datasets.list()).map((d) => d.id));
    let shell = null;
    try {
      await withSavedState({ status: 'closed', step: 0 }, async () => {
        history.replaceState(null, '', location.pathname + location.search);
        shell = await D.require('app').start(root);
        const course = shell.course;
        course.open(1);
        await course.perform('import');
        const example = await courseMod.findExample();
        assert.ok(example, 'example dataset exists');
        await settle(course, 'import');
        assert.equal(shell.store.get().selectedId, example.id, 'example selected');

        course.open(3);
        await course.perform('process');
        assert.equal(shell.store.get().mode, 'bearbeta');
        await settle(course, 'process');
        assert.ok((await datasets.columns(example.id)).some((c) => c.name === t('course.process.column')), 'column added');

        course.open(4);
        await course.perform('sql');
        assert.equal(shell.store.get().mode, 'analysera');
        await waitFor(() => { const r = shell.store.get().lastRun; return r && r.lang === 'sql'; }, 10000, 'SQL run');
        await settle(course, 'sql');
        await waitFor(() => root.querySelector('.dm-center dm-table'), 5000, 'SQL result table');
        const counties = await D.require('data/query').select(example.id, 'select count(distinct lan) as n from data', { limit: 10 });
        assert.equal(Number(counties.values[0][0]), 21, 'the query groups 21 counties');

        // Highlight: in Analysera the R step needs no mode button; elsewhere the mode button is marked.
        course.open(5);
        shell.activate('hantera');
        await course.tick();
        assert.ok(root.querySelector('.dm-mode-btn[data-mode="analysera"]').classList.contains('dm-course-target'), 'Analysera highlighted');

        course.open(6);
        await course.perform('viz');
        assert.equal(shell.store.get().mode, 'visualisera');
        await settle(course, 'viz');
        const made = await charts.list(example.id);
        assert.equal(made.length, 1);
        assert.equal(made[0].vega.type, 'barh');
        assert.equal(made[0].vega.state.x.field, 'lan');

        course.open(7);
        await course.perform('export');
        assert.equal(shell.store.get().mode, 'exportera');
        await course.tick();
        assert.ok(!course.isDone('export'), 'export not done before a file is exported');
        shell.store.set({ lastExport: { at: Date.now() } });
        await settle(course, 'export');

        course.open(2);
        await course.perform('manage');
        await settle(course, 'manage');
        course.close();
      });
      return 'ok';
    } finally {
      for (const d of await datasets.list()) {
        if (before.has(d.id)) continue;
        for (const c of await charts.list(d.id)) await charts.remove(c.id);
        await datasets.remove(d.id);
      }
      for (const el of Array.from(document.querySelectorAll('.dm-floating'))) el.remove();
      root.remove();
    }
  }, 90000);
})();
