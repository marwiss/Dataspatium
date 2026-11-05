// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Guides in Inhämta: a list, and for the chosen guide what it does, what can be chosen, how far it has come and the way on to
 * what it left behind: a chart, a table and the steps that made it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/guides/guides-view', ['ui/base', 'data/guides'], (base, guides) => {
    const { h, t, replace } = base;
    const STEPS = ['fetch', 'clean', 'chart'];

    /** @param {any} ctx shell context @param {{connector?: Function}} [options] */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { guide: null, values: {}, step: null, result: null, error: '', running: false };
      let center = null;

      const fieldLabel = (guide, f) => t(`guide.${guide.id}.field.${f.name}`);
      function field(guide, f) {
        if (s.values[f.name] === undefined) s.values[f.name] = f.default;
        if (f.type === 'select') {
          const el = /** @type {any} */ (h('dm-select', { label: fieldLabel(guide, f) }));
          el.options = f.options;
          el.value = s.values[f.name];
          el.addEventListener('change', () => { s.values[f.name] = el.value; });
          return el;
        }
        const el = /** @type {any} */ (h('dm-input', { label: fieldLabel(guide, f), type: f.type === 'number' ? 'number' : 'text', help: t(`guide.${guide.id}.field.${f.name}.help`) }));
        el.value = s.values[f.name];
        el.addEventListener('input', () => { s.values[f.name] = el.value; });
        return el;
      }
      async function start() {
        if (s.running) return;
        s.running = true; s.error = ''; s.result = null; s.step = 'fetch';
        draw();
        try {
          s.result = await guides.run(s.guide.id, s.values, { connector: options.connector, onStep: (step) => { s.step = step; draw(); } });
          shell.log(t('guide.done', { name: s.result.dataset.name }), 'ok');
        } catch (err) {
          s.error = t('guide.failed', { message: String((err && err.message) || err) });
          shell.log(s.error, 'error');
        }
        s.running = false;
        draw();
      }
      function stepsList() {
        const at = s.step === 'done' ? STEPS.length : STEPS.indexOf(s.step);
        return h('ol', { class: 'dm-stack-xs dm-guide-steps' }, STEPS.map((id, i) => h('li', { class: i < at ? 'dm-guide-done' : i === at && s.running ? 'dm-guide-now' : '', text: t('guide.step.' + id) })));
      }
      function resultPart() {
        const { dataset, chart } = s.result;
        return h('div', { class: 'dm-success dm-stack' },
          h('h2', null, ui.icon('circle-check', 20), ' ', t('guide.done', { name: dataset.name })),
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('guide.open.chart'), icon: 'chart-column', variant: 'primary', onClick: () => { store.set({ selectedId: dataset.id, openChartId: chart.id }); shell.activate('visualisera'); } }),
            ui.button({ label: t('guide.open.table'), icon: 'table', onClick: () => { store.set({ selectedId: dataset.id }); shell.activate('bearbeta'); } })),
          h('p', { class: 'dm-help', text: t('guide.onward') }));
      }
      function draw() {
        if (!center) return;
        if (!s.guide) {
          replace(center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('graduation-cap', 20), t('guides.title'))),
            h('p', { class: 'dm-help', text: t('guides.help') }),
            h('div', { class: 'dm-stack-sm' }, guides.GUIDES.map((g) => h('button', { type: 'button', class: 'dm-op-tile', 'data-guide': g.id, onclick: () => { s.guide = g; s.values = {}; s.result = null; s.error = ''; s.step = null; draw(); } },
              h('strong', { text: t(`guide.${g.id}.title`) }), h('span', { class: 'dm-help', text: t(`guide.${g.id}.about`) })))));
          return;
        }
        const g = s.guide;
        replace(center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon(g.icon, 20), t(`guide.${g.id}.title`))),
          h('p', { class: 'dm-help', text: t(`guide.${g.id}.about`) }),
          h('p', { class: 'dm-help dm-small', text: t('guide.source', { name: g.source }) }),
          h('div', { class: 'dm-form-grid' }, g.fields.map((f) => field(g, f))),
          s.step ? stepsList() : null,
          s.error ? h('p', { class: 'dm-error dm-small', text: s.error }) : null,
          s.result ? resultPart() : h('div', { class: 'dm-row' },
            ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: s.running, onClick: () => { s.guide = null; draw(); } }),
            ui.button({ label: t('guide.run'), icon: 'play', variant: 'primary', loading: s.running, title: t('guide.run.hint'), onClick: start })));
      }
      return {
        /** @param {HTMLElement} target */
        render(target) { center = target; draw(); },
        destroy() { center = null; },
        get state() { return s; },
      };
    }

    return { create };
  });
})();
