// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * GitHub card (Dela): repository, branch and folder, the key, and push or pull of the whole workspace through
 * data/workspace and platform/storage/github-store.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/github', ['ui/base', 'ui/share/bundle'], (base, share) => {
    const { h, t, i18n } = base;
    /** Key-store id of the GitHub token (api/secrets; encrypted when saved). */
    const GITHUB_KEY = 'workspace.github';

    /**
     * @param {any} ctx the mode context
     * @param {{onChanged?: () => void}} [hooks] called after a push or pull so the caller can re-render
     * @returns {Promise<{el: HTMLElement, destroy: () => void}>}
     */
    async function create(ctx, hooks = {}) {
      const { ui, services, shell } = ctx;
      const onChanged = hooks.onChanged || (() => {});
      const cfg = await services.workspace.githubConfig();
      const secrets = D.require('api/secrets');
      const connector = { id: GITHUB_KEY, name: 'GitHub', auth: { type: 'bearer', help: t('github.token.help') } };
      const repoIn = /** @type {any} */ (h('dm-input', { label: t('github.repo'), placeholder: t('github.repo.placeholder'), value: cfg.repo }));
      const branchIn = /** @type {any} */ (h('dm-input', { label: t('github.branch'), value: cfg.branch }));
      const pathIn = /** @type {any} */ (h('dm-input', { label: t('github.path'), help: t('github.path.help'), value: cfg.path }));
      const saveConfig = () => services.workspace.setGithubConfig({ repo: repoIn.value.trim(), branch: branchIn.value.trim() || 'main', path: pathIn.value.trim() });
      for (const input of [repoIn, branchIn, pathIn]) input.addEventListener('change', () => { saveConfig().catch((err) => shell.log(String((err && err.message) || err), 'error')); });
      const panel = D.require('ui/api/auth-panel').create(connector, { quiet: true });
      const token = () => { const values = secrets.get(GITHUB_KEY); return values ? values.token : ''; };
      const status = [cfg.lastPush ? t('github.last.push', { date: i18n.formatDateTime(cfg.lastPush) }) : '', cfg.lastPull ? t('github.last.pull', { date: i18n.formatDateTime(cfg.lastPull) }) : ''].filter(Boolean).join(' · ');
      const fail = (err) => { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); };

      async function push() {
        const message = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('github.commit.message'), help: t('github.commit.help') }));
        message.value = t('github.commit.default');
        const ok = await ui.dialog.open({ title: t('github.push'), help: 'dela#github', body: message, actions: [{ label: t('common.cancel'), value: false }, { label: t('github.push'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        await saveConfig();
        shell.setStatus('saving');
        try {
          const res = await services.workspace.pushToGitHub({ token: token(), message: message.value.trim() || t('github.commit.default') });
          const text = res.commit ? t('github.pushed', { written: res.written, removed: res.removed }) : t('github.pushed.none');
          shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
          onChanged();
        } catch (err) { fail(err); }
        shell.setStatus('saved');
      }
      async function pull() {
        await saveConfig();
        try {
          const fetched = await services.workspace.fetchFromGitHub({ token: token() });
          const choice = await share.incomingSummary(ctx, fetched, t('github.pull.title', { repo: repoIn.value.trim() }));
          if (!choice) return;
          share.reportRestore(ctx, await services.workspace.restoreFromGitHub(fetched, { replaceIds: choice.replaceIds }));
          onChanged();
        } catch (err) { fail(err); }
      }
      const github = D.require('platform/storage/github');
      const repo = github.parseRepo(cfg.repo);
      const el = h('div', { class: 'dm-card dm-stack' },
        h('h3', null, ui.icon('git-branch', 18), ' ', t('github.title')),
        h('p', { class: 'dm-help', text: t('github.hint') }),
        h('div', { class: 'dm-form-grid' }, repoIn, branchIn, pathIn),
        panel.el,
        h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('github.push'), icon: 'upload', onClick: push }),
          ui.button({ label: t('github.pull'), icon: 'download', onClick: pull }),
          repo && cfg.lastCommit ? h('a', { href: github.webUrl(Object.assign({}, repo, { branch: cfg.branch, path: cfg.path }), cfg.lastCommit), target: '_blank', rel: 'noopener noreferrer', text: t('github.open') }) : null),
        status ? h('p', { class: 'dm-help', text: status }) : null);
      return { el, destroy: () => panel.destroy() };
    }

    return { create, GITHUB_KEY };
  });
})();
