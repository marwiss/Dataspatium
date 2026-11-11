// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for plans in flows (F31 a, F33 b, F34 a): command steps whose answers later steps read, if with its two branches, each over
 * a list and a number, repeat until a condition, the limits in rounds and seconds, Stoppa during a pause, stop with a message, the
 * question to the person (ui/ask, shown as text only) and its step, the nested form through save and file, and the editor's branches.
 * Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const flows = D.require('data/flows');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const created = []; const flowIds = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  async function table(name) {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }], rows: [['Ale', 10], ['Bollebygd', 20], ['Ale', 5]] });
    created.push(meta.id);
    return meta;
  }
  const saved = async (input) => { const f = await flows.save(input); flowIds.push(f.id); return f; };
  const cmd = (id, command, args) => Object.assign({ type: 'command', params: { command, args } }, id ? { id } : {});

  test('plans: a command\'s answer chooses the branch of if, and stop ends the flow with its message', async (assert) => {
    const meta = await table('Planprov if');
    const plan = (limit) => ({ name: 'Planprov if ' + limit, steps: [
      cmd('antal', 'run_sql', { dataset: meta.id, sql: 'select count(*) as n from data' }),
      { type: 'if', params: { condition: `antal.rows[0][0] > ${limit}` },
        steps: [cmd('ut', 'export_dataset', { dataset: meta.id, format: 'csv' })],
        otherwise: [{ type: 'stop', params: { message: 'Bara {{antal.rows[0][0]}} rader' } }] },
      cmd(null, 'list_datasets', {}),
    ] });
    const yes = await flows.run(await saved(plan(2)));
    assert.ok(yes.ok, JSON.stringify(yes.steps));
    assert.equal(yes.files.length, 1, 'the export in the branch Then');
    assert.ok(yes.steps.some((s) => s.type === 'if' && s.message === t('flows.done.if.then', { condition: 'antal.rows[0][0] > 2' })), 'the log says the condition held');
    assert.deepEqual(yes.steps.map((s) => s.path), ['1', '2', '2.1', '3'], 'paths in the log');
    const no = await flows.run(await saved(plan(5)));
    assert.ok(no.ok, 'stopping is not a failure');
    assert.equal(no.stopped, 'Bara 3 rader', 'the message with the answer filled in');
    assert.ok(!no.steps.some((s) => s.path === '3'), 'nothing after stop');
    const bad = await flows.run(await saved({ name: 'Planprov fel villkor', steps: [{ type: 'if', params: { condition: 'antal >' }, steps: [] }] }));
    assert.equal(bad.ok, false, 'a condition that does not read fails the step');
    return 'ok';
  });

  test('plans: each runs once per value of an answer or up to a number, and stops at max_rounds', async (assert) => {
    const meta = await table('Planprov each');
    const flow = await saved({ name: 'Planprov each', steps: [
      cmd('k', 'run_sql', { dataset: meta.id, sql: 'select kommun, sum(antal) from data group by kommun order by kommun' }),
      { type: 'each', id: 'varv', params: { items: 'k.rows', as: 'rad' }, steps: [cmd('r', 'read_rows', { dataset: meta.id, columns: ['antal'], filters: [{ column: 'kommun', op: '=', value: '{{rad[0]}}' }], order_by: null, descending: null, limit: null, offset: null })] },
      { type: 'if', params: { condition: 'varv.rounds = 2 and varv.reason = \'done\' and r.total = 1' }, steps: [], otherwise: [{ type: 'stop', params: { message: 'fel' } }] },
      { type: 'each', id: 'tal', params: { items: '3' }, steps: [] },
      { type: 'each', id: 'tak', params: { items: '50', max_rounds: 4 }, steps: [] },
      { type: 'if', params: { condition: "tal.rounds = 3 and tak.rounds = 4 and tak.reason = 'rounds'" }, steps: [], otherwise: [{ type: 'stop', params: { message: 'fel tak' } }] },
    ] });
    const r = await flows.run(flow);
    assert.ok(r.ok && !r.stopped, JSON.stringify(r.steps.slice(-4)) + ' ' + r.stopped);
    assert.ok(r.steps.some((s) => s.path === '2#1.1') && r.steps.some((s) => s.path === '2#2.1'), 'a log line per round');
    return 'ok';
  });

  test('plans: repeat until a condition, a time limit in seconds, and Stoppa that ends a pause at once', async (assert) => {
    const until = await flows.run(await saved({ name: 'Planprov repeat', steps: [
      { type: 'repeat', id: 'u', params: { until: 'round >= 3' }, steps: [cmd('l', 'list_datasets', {})] },
      { type: 'if', params: { condition: "u.rounds = 3 and u.reason = 'until'" }, steps: [], otherwise: [{ type: 'stop', params: { message: 'fel' } }] },
    ] }));
    assert.ok(until.ok && !until.stopped, JSON.stringify(until.steps.slice(-3)));
    const t0 = performance.now();
    const timed = await flows.run(await saved({ name: 'Planprov tid', steps: [
      { type: 'repeat', id: 'tid', params: { until: 'false', wait_seconds: 0.1, max_seconds: 0.5 }, steps: [] },
      { type: 'if', params: { condition: "tid.reason = 'time'" }, steps: [], otherwise: [{ type: 'stop', params: { message: 'fel' } }] },
    ] }));
    assert.ok(timed.ok && !timed.stopped, JSON.stringify(timed.steps));
    assert.ok(performance.now() - t0 < 3000, 'the time limit holds');
    const slow = await saved({ name: 'Planprov stoppa', steps: [{ type: 'repeat', params: { until: 'false', wait_seconds: 30 }, steps: [cmd(null, 'list_datasets', {})] }] });
    const t1 = performance.now();
    const running = flows.run(slow);
    await waitFor(() => flows.current(), 3000, 'the flow running');
    await wait(300);
    flows.cancel();
    const stopped = await running;
    assert.ok(performance.now() - t1 < 5000, 'the pause ended at once');
    assert.equal(stopped.aborted, true);
    assert.ok(stopped.steps.some((s) => s.message === t('flows.stopped.round', { n: 1, total: flows.DEFAULT_ROUNDS })), 'the round it stopped in: ' + JSON.stringify(stopped.steps));
    return 'ok';
  });

  test('plans: the step ask waits for the answer, which later steps read; a flow that asks never runs at start', async (assert) => {
    const asked = [];
    flows.setAsker(async (q) => { asked.push(q); return { answer: 'Ja', index: 0, free: false }; });
    try {
      const flow = await saved({ name: 'Planprov fråga', steps: [
        cmd('n', 'list_datasets', {}),
        { type: 'ask', id: 'svar', params: { question: 'Fortsätta med {{n.datasets.length}} datamängder?', options: 'Ja | Gör exporten\nNej' } },
        { type: 'if', params: { condition: "svar.answer = 'Ja' and svar.index = 0" }, steps: [], otherwise: [{ type: 'stop', params: { message: 'nej' } }] },
      ] });
      const r = await flows.run(flow);
      assert.ok(r.ok && !r.stopped, JSON.stringify(r.steps));
      assert.ok(/^Fortsätta med \d+ datamängder\?$/.test(asked[0].question), 'the answer filled into the question: ' + asked[0].question);
      assert.deepEqual(asked[0].options, [{ label: 'Ja', description: 'Gör exporten' }, { label: 'Nej' }], 'one answer per line');
      assert.ok((await flows.blockers(flow)).includes(t('flows.block.ask')), 'start never asks');
      flows.setAsker(async () => null);
      const closed = await flows.run(flow);
      assert.equal(closed.aborted, true, 'closing the question stops the flow');
      flows.setAsker(null);
      const nobody = await flows.run(flow);
      assert.equal(nobody.ok, false, 'nobody to ask');
    } finally {
      flows.setAsker((q) => D.require('ui/ask').ask(q));
    }
    return 'ok';
  });

  test('plans: the question shows text only and answers with the choice or an own text', async (assert) => {
    const ui = D.require('ui/ask');
    const p = ui.ask({ question: '<b>Fet?</b>', options: [{ label: 'Ett', description: '<i>a</i>' }, { label: 'Två' }], free: true });
    const dlg = await waitFor(() => document.querySelector('dialog[open] [data-ask]'), 3000, 'the question');
    assert.equal(dlg.querySelector('b'), null, 'no HTML from the question');
    assert.equal(dlg.querySelector('.dm-ask-question').textContent, '<b>Fet?</b>');
    assert.equal(dlg.querySelector('i'), null, 'no HTML from a description');
    /** @type {HTMLElement} */ (dlg.querySelector('[data-ask-option="1"] button')).click();
    assert.deepEqual(await p, { answer: 'Två', index: 1, free: false });
    const q = ui.ask({ question: 'Namn?', options: [], free: true });
    const d2 = await waitFor(() => document.querySelector('dialog[open] [data-ask]'), 3000, 'the second question');
    const input = /** @type {any} */ (d2.querySelector('dm-input'));
    input.value = 'Eget'; input.dispatchEvent(new Event('input'));
    /** @type {HTMLElement} */ (Array.from(d2.querySelectorAll('.dm-ask-free dm-button button')).pop()).click();
    assert.deepEqual(await q, { answer: 'Eget', index: null, free: true });
    const ctl = new AbortController();
    const gone = ui.ask({ question: 'Stängs', options: [{ label: 'A' }], signal: ctl.signal });
    await waitFor(() => document.querySelector('dialog[open] [data-ask]'), 3000, 'the third question');
    ctl.abort();
    assert.equal(await gone, null, 'a stopped flow closes its question');
    return 'ok';
  });

  test('plans: the nested form survives saving and a file; bad names and deep nesting are cut', async (assert) => {
    let deep = { type: 'stop', params: {} };
    for (let i = 0; i < 12; i++) deep = { type: 'if', params: { condition: 'true' }, steps: [deep], otherwise: [] };
    const f = await saved({ name: 'Planprov form', steps: [
      { type: 'each', id: 'bra_namn', params: { items: '2', max_rounds: 5 }, steps: [cmd('inne', 'list_datasets', {})] },
      { type: 'repeat', id: 'inte ett namn', params: { until: 'true' }, steps: [] },
      deep,
    ] });
    const back = await flows.get(f.id);
    assert.equal(back.steps[0].id, 'bra_namn');
    assert.equal(back.steps[0].steps[0].params.command, 'list_datasets', 'a step inside a loop');
    assert.equal(back.steps[1].id, undefined, 'a name with a space is dropped');
    let depth = 0; let s = back.steps[2];
    while (s && s.steps && s.steps.length) { depth++; s = s.steps[0]; }
    assert.ok(depth <= 9, 'nesting is cut: ' + depth);
    const again = await flows.importJson(flows.exportJson(back));
    flowIds.push(again.id);
    assert.deepEqual(again.steps[0].steps, back.steps[0].steps, 'the same steps through a file');
    return 'ok';
  });

  test('plans: the editor shows the branches of if indented, each with its own place to add a step', async (assert) => {
    const flow = await saved({ name: 'Planprov redigerare', steps: [{ type: 'if', params: { condition: 'true' }, steps: [cmd(null, 'list_datasets', {})], otherwise: [] }] });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('hantera');
      shell.store.set({ selectedId: '__flows' });
      const card = await waitFor(() => root.querySelector(`[data-flow="${flow.id}"]`), 8000, 'the flow card');
      /** @type {HTMLElement} */ (Array.from(card.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('flows.edit')).querySelector('button')).click();
      await waitFor(() => root.querySelectorAll('.dm-flow-branch').length === 2, 5000, 'two branches');
      assert.equal(root.querySelectorAll('.dm-flow-add-in').length, 2, 'a place to add in each branch');
      assert.ok(root.querySelector('.dm-flow-branch .dm-flow-step[data-depth="1"]'), 'the step inside, one level in');
      const cond = Array.from(root.querySelectorAll('dm-input')).find((e) => e.getAttribute('label') === t('flows.field.condition'));
      /** @type {any} */ (cond).value = 'a >'; cond.dispatchEvent(new Event('input'));
      assert.ok(cond.getAttribute('error'), 'a condition that does not read is told at once');
      return 'ok';
    } finally { root.remove(); }
  }, 60000);

  test('plans: cleanup', async (assert) => {
    for (const id of flowIds) await flows.remove(id).catch(() => {});
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
