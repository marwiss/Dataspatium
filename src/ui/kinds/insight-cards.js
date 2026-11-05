// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Two cards in Hantera: what the app sees in the dataset, each with its reason and a switch for when it is wrong, and how
 * the dataset is doing in its own terms. Both are drawn after the page, because they take a look at the data.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/insight-cards', ['ui/base', 'data/facets', 'data/kind-health'], (base, facets, health) => {
    const { h, t, i18n, replace } = base;

    /**
     * What the app sees. Shows nothing when it sees nothing.
     * @param {any} ctx @param {any} ds @param {{onChanged?: () => void}} [hooks] @returns {HTMLElement}
     */
    function facetCard(ctx, ds, hooks = {}) {
      const el = h('div');
      const draw = async () => {
        const list = await facets.detect(ds.id);
        if (!list.length) { replace(el); return; }
        const rows = list.map((f) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('facets.' + f.id), 'data-facet': f.id }));
          sw.checked = f.on;
          sw.addEventListener('change', async () => {
            // Back to what the app itself found when the user agrees with it; otherwise the user's word is kept.
            await facets.set(ds.id, f.id, sw.checked === f.auto ? null : sw.checked);
            await draw();
            if (hooks.onChanged) hooks.onChanged();
          });
          const why = f.reason ? t(f.reason, f.params || {}) : t('facets.reason.user');
          return h('div', { class: 'dm-stack-xs' }, sw, h('p', { class: 'dm-help dm-small', text: why }),
            f.on && f.id === 'network' ? h('div', null, ctx.ui.button({ label: t('graph.from.button'), icon: 'share-2', size: 'sm', title: t('graph.from.button.hint'), onClick: () => D.require('ui/analysis/graph-panel').fromTablesDialog(ctx, ds.id).then((meta) => { if (meta) { ctx.store.set({ selectedId: meta.id }); ctx.shell.activate('hantera'); } }) })) : null);
        });
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'facets' }, h('h3', { text: t('facets.title') }), h('p', { class: 'dm-help', text: t('facets.help') }), rows));
      };
      draw().catch((err) => D.log('facets', err));
      return el;
    }

    /**
     * How the dataset is doing. Shows nothing when there is nothing to say, since a green tick would be a promise.
     * @param {any} ds @returns {HTMLElement}
     */
    function healthCard(ds) {
      const el = h('div');
      health.check(ds.id).then((found) => {
        if (!found.length) return;
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'health' }, h('h3', { text: t('health.title') }),
          h('ul', { class: 'dm-stack-xs' }, found.map((f) => h('li', { class: f.level === 'warn' ? 'dm-warn' : 'dm-help', 'data-health': f.key, text: t(f.key, { n: i18n.formatNumber(f.n) }) })))));
      }).catch((err) => D.log('health', err));
      return el;
    }

    /**
     * Columns that hold a list the app knows, with the labels one click away.
     * @param {any} ctx @param {any} ds @param {{onChanged?: () => void}} [hooks] @returns {HTMLElement}
     */
    function codeListCard(ctx, ds, hooks = {}) {
      const el = h('div');
      const codelists = D.require('data/codelists');
      const draw = async () => {
        const found = await codelists.suggest(ds.id);
        if (!found.length) { replace(el); return; }
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'codelists' }, h('h3', { text: t('codelists.title') }), h('p', { class: 'dm-help', text: t('codelists.help') }),
          found.map((f) => h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-grow', text: t('codelists.found', { column: f.column, list: f.name, share: i18n.formatNumber(f.coverage, { style: 'percent', maximumFractionDigits: 0 }) }) }),
            ctx.ui.button({ label: t('codelists.apply'), icon: 'tags', size: 'sm', title: t('codelists.apply.hint'), onClick: async () => {
              try {
                await codelists.apply(ds.id, f.column, f.list);
                ctx.shell.log(t('codelists.applied', { column: f.column, list: f.name }), 'ok');
                await draw();
                if (hooks.onChanged) hooks.onChanged();
              } catch (err) { ctx.ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
            } })))));
      };
      draw().catch((err) => D.log('codelists', err));
      return el;
    }

    return { facetCard, healthCard, codeListCard };
  });
})();
