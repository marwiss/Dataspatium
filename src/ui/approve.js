// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The approval of a writing command in the app's own dialog, with the command and its arguments as text: the AI assistant's and
 * the bridge's (styrning utifrån, DS-26). It is in the start list, so that the bridge's approval, which belongs to Dokument, needs
 * neither the assistant's group (Experimentell) nor a network; an installed app under a lower ceiling never loads that group.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/approve', ['ui/base', 'ui/overlays'], (base, overlays) => {
    const { h, t } = base;

    /**
     * Ask the person to approve a writing command; `source` names who asks ('bridge' for a program on the computer).
     * @param {{name: string}} cmd @param {any} args @param {{source?: string}} [options] @returns {Promise<boolean>}
     */
    async function approve(cmd, args, options = {}) {
      let shown = '';
      try { shown = JSON.stringify(args, null, 2); } catch (_e) { shown = String(args); }
      const op = cmd.name === 'apply_operation' && args && args.operation ? t('op.' + args.operation) : '';
      const yes = await overlays.dialog.open({
        title: t('assistant.approve.title'),
        body: h('div', { class: 'dm-stack-sm', 'data-assistant-approve': cmd.name },
          h('p', { text: t(options.source === 'bridge' ? 'remote.approve.text' : 'assistant.approve.text', { name: cmd.name }) }),
          op && op !== 'op.' + args.operation ? h('p', null, h('strong', { text: op })) : null,
          h('pre', { class: 'dm-help-code', text: shown.length > 4000 ? shown.slice(0, 4000) + '…' : shown }),
          h('p', { class: 'dm-help dm-small', text: t('assistant.approve.hint') })),
        actions: [{ label: t('common.cancel'), value: false }, { label: t('assistant.approve.ok'), variant: 'primary', value: true, primary: true }],
      });
      return yes === true;
    }

    return { approve };
  });
})();
