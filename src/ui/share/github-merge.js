// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a fetch from GitHub would do, before it is done: each dataset that is here already says who has changed what, comments are
 * always kept, and where both have changed the data the user chooses. Nothing is lost by the default, which keeps both versions.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/github-merge', ['ui/base', 'data/collab'], (base, collab) => {
    const { h, t, i18n } = base;
    const BADGE = { same: 'ok', comments: 'ok', mine: 'ok', theirs: 'warn', both: 'warn' };

    /**
     * @param {any} ctx @param {any} fetched from workspace.fetchFromGitHub @param {string} title
     * @returns {Promise<{planned: any[], choices: Record<string, string>}|null>} null when cancelled
     */
    async function ask(ctx, fetched, title) {
      const { ui } = ctx;
      const manifest = fetched.manifest || {};
      const planned = await collab.plan(fetched);
      const known = new Map(planned.map((p) => [p.id, p]));
      const choices = {};
      const number = (n) => i18n.formatNumber(n);
      const sections = planned.map((p) => {
        const facts = [t(`collab.status.${p.status}`, { mine: number(p.steps.mine), theirs: number(p.steps.theirs) })];
        if (p.newComments) facts.push(t('collab.comments.new', { n: number(p.newComments) }));
        let choice = null;
        if (p.status === 'both') {
          choice = /** @type {any} */ (h('dm-select', { label: t('collab.choice'), 'data-collab-choice': p.id }));
          choice.options = ['both', 'mine', 'theirs'].map((value) => ({ value, label: t(`collab.choice.${value}`) }));
          choice.value = 'both';
          choices[p.id] = 'both';
          choice.addEventListener('change', () => { choices[p.id] = choice.value; });
        }
        return h('div', { class: 'dm-stack-sm', 'data-collab': p.status },
          h('h4', null, p.local, ' ', h('dm-badge', { kind: BADGE[p.status], text: t(`collab.badge.${p.status}`) })),
          h('p', { class: 'dm-help', text: facts.join(' ') }),
          choice);
      });
      const added = (manifest.datasets || []).filter((d) => !known.has(d.id));
      const sender = [manifest.author || t('comments.anonymous'), manifest.created ? i18n.formatDateTime(manifest.created) : ''].filter(Boolean).join(', ');
      const body = h('div', { class: 'dm-stack' },
        h('p', { class: 'dm-help', text: t('bundle.open.from', { sender }) }),
        manifest.message ? h('div', { class: 'dm-card' }, h('p', { text: manifest.message })) : null,
        sections.length ? h('div', { class: 'dm-stack' }, sections) : null,
        added.length ? h('div', { class: 'dm-stack-sm' }, h('h4', { text: t('collab.new.title') }), h('ul', { class: 'dm-help' }, added.map((d) => h('li', { text: d.name })))) : null,
        sections.length ? h('p', { class: 'dm-help', text: t('collab.help') }) : null);
      const ok = await ui.dialog.open({ title, body, size: 'lg', help: 'dela#samarbeta-via-github', actions: [{ label: t('common.cancel'), value: false }, { label: t('bundle.open.ok'), variant: 'primary', value: true, primary: true }] });
      return ok === true ? { planned, choices } : null;
    }
    /** What happened, for the log and a line on the screen. @param {any} ctx @param {{comments: number, replaced: any[], copies: any[], kept: any[]}} result */
    function report(ctx, result) {
      const parts = [];
      if (result.comments) parts.push(t('collab.done.comments', { n: i18n.formatNumber(result.comments) }));
      if (result.replaced.length) parts.push(t('collab.done.replaced', { n: i18n.formatNumber(result.replaced.length) }));
      if (result.copies.length) parts.push(t('collab.done.copies', { n: i18n.formatNumber(result.copies.length) }));
      if (result.kept.length) parts.push(t('collab.done.kept', { n: i18n.formatNumber(result.kept.length) }));
      if (!parts.length) return;
      const text = parts.join(' ');
      ctx.shell.log(text, 'ok');
      ctx.ui.toast.show(text, { kind: 'ok', timeout: 10000 });
    }

    return { ask, report };
  });
})();
