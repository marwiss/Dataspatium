// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tier in the app's settings (Hantera's workspace page): the card Nivå with the three tiers, each with a line on what it
 * holds, the one in effect marked, and what caps the choice (the deployment's ceiling). And the notice a mode shows where a
 * function is hidden by the tier, a deep link to it included: the function's name, the tier it belongs to, and a button that
 * raises the tier unless the deployment or the server caps it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/settings/tier', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'platform/tier'], (base, basic, overlays, icons, tier) => {
    const { h, t } = base;
    /** @param {number} n @returns {string} the tier's name, e.g. "BIM och GIS" */
    const nameOf = (n) => t('tier.' + tier.keyOf(n));

    /**
     * Choose a tier, with the outcome in the log and a toast; the modes redraw through tier.subscribe (the shell).
     * @param {any} ctx @param {number} n
     */
    async function choose(ctx, n) {
      try {
        const now = await tier.set(n);
        const text = t('tier.changed', { tier: nameOf(now) });
        if (ctx && ctx.shell) ctx.shell.log(text, 'ok');
        overlays.toast.show(text, { kind: 'ok' });
      } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
    }

    /**
     * The card Nivå.
     * @param {any} ctx @returns {HTMLElement}
     */
    function tierCard(ctx) {
      const now = tier.current();
      const top = tier.ceiling();
      const items = tier.TIERS.map((x) => {
        const capped = x.n > top;
        return h('button', {
          type: 'button', class: 'dm-list-item', role: 'radio', 'data-tier': x.key, 'aria-checked': x.n === now ? 'true' : 'false', 'aria-current': x.n === now ? 'true' : null,
          disabled: capped ? true : null, title: capped ? t('tier.capped.deployment', { tier: nameOf(top) }) : t('tier.choose.hint', { tier: nameOf(x.n) }),
          onclick: () => { if (x.n !== now) choose(ctx, x.n); },
        }, icons.icon(x.icon, 16), h('span', { class: 'dm-list-main' },
          h('span', { text: t('tier.number', { n: x.n }) + ' · ' + nameOf(x.n) + (tier.choice() === null && x.n === tier.DEFAULT ? ' (' + t('tier.default') + ')' : '') }),
          h('span', { class: 'dm-list-sub', text: t('tier.' + x.key + '.desc') })));
      });
      return h('div', { class: 'dm-card dm-stack', 'data-settings': 'tier', 'data-tier-current': tier.keyOf(now) },
        h('h3', null, icons.icon('layers', 18), ' ', t('tier.title')),
        h('p', { class: 'dm-help', text: t('tier.hint') }),
        h('div', { class: 'dm-list', role: 'radiogroup', 'aria-label': t('tier.title') }, items),
        top < tier.TIERS.length ? h('p', { class: 'dm-help dm-small', 'data-tier-capped': 'deployment', text: t('tier.capped.deployment', { tier: nameOf(top) }) }) : null,
        h('p', { class: 'dm-help dm-small', text: t('tier.server.hint') }));
    }

    /**
     * The notice where a function is hidden by the tier: what it is, the tier it belongs to and the one in effect, and a button
     * that raises the tier; where the deployment or the server caps it, the reason instead of the button.
     * @param {any} ctx @param {string} feature a feature or an entry of platform/tier @param {{server?: string}} [options]
     * @returns {HTMLElement}
     */
    function notice(ctx, feature, options = {}) {
      const w = tier.why(feature, options);
      const what = t('tier.feature.' + w.feature);
      return h('div', { class: 'dm-card dm-stack-sm', role: 'status', 'data-tier-hidden': w.feature, 'data-tier-needs': tier.keyOf(w.needs) },
        h('p', { text: t('tier.hidden', { feature: what, tier: nameOf(w.needs), current: nameOf(w.current) }) }),
        w.canRaise
          ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('tier.raise', { tier: nameOf(w.needs) }), icon: 'arrow-up', size: 'sm', title: t('tier.raise.hint', { tier: nameOf(w.needs) }), 'data-tier-raise': tier.keyOf(w.needs), onClick: () => choose(ctx, w.needs) }))
          : h('p', { class: 'dm-help dm-small', 'data-tier-capped': w.cap, text: w.cap === 'server' ? t('tier.capped.server', { tier: nameOf(w.current) }) : t('tier.capped.deployment', { tier: nameOf(tier.ceiling()) }) }));
    }

    return { tierCard, notice, choose, nameOf };
  });
})();
