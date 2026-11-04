// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for presentation mode (ui/viz/present): a dashboard fills the window, steps through its charts with keys and keeps the shared filters. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const importer = D.require('io/import');
  const datasets = D.require('data/datasets');
  const charts = D.require('viz/charts');
  const dashboards = D.require('viz/dashboards');
  const builder = D.require('viz/vega-builder');
  const render = D.require('viz/render');
  const present = D.require('ui/viz/present');

  function waitFor(fn, ms, what) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      (function tick() { let v; try { v = fn(); } catch (_e) { v = null; } if (v) return resolve(v); if (performance.now() - t0 > ms) return reject(new Error('timeout: ' + what)); setTimeout(tick, 100); })();
    });
  }
  const key = (k) => new KeyboardEvent('keydown', { key: k, cancelable: true });

  test('present: a dashboard fills the window, steps through its charts with keys and keeps the shared filters', async (assert) => {
    const csv = 'kommun;lan;ar;befolkning\nStockholm;Stockholms län;2023;980000\nStockholm;Stockholms län;2024;984748\nMalmö;Skåne län;2023;360000\nMalmö;Skåne län;2024;362133\nLund;Skåne län;2023;128000\nLund;Skåne län;2024;130000\n';
    const meta = await importer.run(new File([csv], 'present.csv', { type: 'text/csv' }), {}, null, 'Presentationstest');
    const columns = await datasets.columns(meta.id);
    const c1 = charts.create('vega', meta, 'Befolkning per kommun'); c1.vega.state = builder.defaultState('bar', columns);
    const c2 = charts.create('vega', meta, 'Befolkning per år'); c2.vega.state = builder.defaultState('line', columns);
    const s1 = await charts.save(c1); const s2 = await charts.save(c2);
    const dash = await dashboards.save(Object.assign(dashboards.create('Presentationspanel'), { items: [{ chartId: s1.id, span: 1 }, { chartId: s2.id, span: 1 }], filters: [{ column: 'lan' }] }));
    let ctl = null;
    try {
      ctl = await present.open(dash, { log: () => {} });
      assert.ok(document.body.contains(ctl.el) && document.body.classList.contains('dm-presenting'), 'overlay shown');
      assert.equal(present.current(), ctl);
      assert.equal(ctl.steps().length, 3, 'overview plus two charts');
      assert.equal(ctl.el.getAttribute('role'), 'dialog');
      await waitFor(() => ctl.rendered() === 2, 20000, 'overview rendered');
      assert.equal(ctl.el.querySelectorAll('.dm-present-card').length, 2);
      assert.equal(ctl.el.querySelectorAll('.dm-present-filters dm-select').length, 1, 'the shared filter is in the bar');
      // Keys step through the charts and back to the overview.
      ctl.onKey(key('ArrowRight'));
      assert.equal(ctl.state.step, 1);
      await waitFor(() => ctl.rendered() === 1, 20000, 'single chart rendered');
      assert.equal(ctl.el.querySelectorAll('.dm-present-card').length, 1);
      assert.equal(ctl.el.querySelector('.dm-present-card h2').textContent, 'Befolkning per kommun');
      assert.ok(ctl.el.querySelector('.dm-present-step').textContent.includes('Befolkning per kommun'), 'step shown in the bar');
      ctl.next(); assert.equal(ctl.state.step, 2);
      ctl.next(); assert.equal(ctl.state.step, 0, 'wraps to the overview');
      ctl.prev(); assert.equal(ctl.state.step, 2, 'back to the last chart');
      ctl.onKey(key('Home')); assert.equal(ctl.state.step, 0);
      ctl.onKey(key('End')); assert.equal(ctl.state.step, 2);
      ctl.goto(0);
      // The shared filter narrows every chart; the select in the bar follows.
      ctl.setFilter('lan', 'Skåne län');
      await waitFor(() => ctl.rendered() === 2, 20000, 're-rendered with the filter');
      const prep = await render.prepareVega(s1, { extraFilters: dashboards.toExtraFilters(ctl.state.values) });
      assert.equal(prep.data.rows.length, 4, 'only the Skåne rows reach the chart');
      assert.equal(/** @type {any} */ (ctl.el.querySelector('.dm-present-filters dm-select')).value, 'Skåne län', 'select follows the state');
      // Escape ends the presentation (outside full screen).
      ctl.onKey(key('Escape'));
      assert.ok(!document.body.contains(ctl.el) && !present.current() && !document.body.classList.contains('dm-presenting'), 'closed');
      ctl = null;
      // A new presentation replaces an open one, and can start at a step.
      const a = await present.open(dash, { log: () => {} });
      const b = await present.open(dash, { log: () => {}, step: 2 });
      assert.ok(!document.body.contains(a.el) && document.body.contains(b.el) && b.state.step === 2, 'only the latest presentation is shown');
      b.close();
      assert.ok(!present.current(), 'nothing open');
      return 'ok';
    } finally {
      if (ctl) ctl.close();
      if (present.current()) present.current().close();
      await dashboards.remove(dash.id);
      await charts.remove(s1.id); await charts.remove(s2.id);
      await datasets.remove(meta.id);
    }
  }, 60000);
})();
