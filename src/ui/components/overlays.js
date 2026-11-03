// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Overlays: modal dialogs (confirm, prompt, custom) built on <dialog>, toasts and a non-modal floating panel.
 * Usage:
 *   const ok = await dialog.confirm('Ta bort datamängden?', {danger: true});
 *   const name = await dialog.prompt('Nytt namn', {value: 'Befolkning'});
 *   const result = await dialog.open({title, body: node, actions: [{label, variant, value}]});
 *   toast.show('Sparat', {kind: 'ok'});
 *   const panel = floating({onClose}); panel.update({title, meta, body: [nodes], actions: [buttons]});
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/overlays', ['ui/base', 'ui/icons', 'ui/basic', 'ui/fields'], (base, icons, basic) => {
    const { h, t, replace } = base;

    /**
     * A body given as a function receives `done(value)`, which closes the dialog with that value (choices made
     * inside the body, such as a list of languages).
     * @param {{title?: string, body?: Node|string|((done: (value?: any) => void) => Node), actions?: Array<{label: string, variant?: string, value?: any, primary?: boolean, close?: boolean}>, size?: string, closable?: boolean}} options
     * @returns {Promise<any>} resolves with the chosen action's value (undefined when dismissed)
     */
    function open(options) {
      return new Promise((resolve) => {
        const dlg = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'dm-dialog', 'data-size': options.size || 'md', 'aria-labelledby': 'dm-dialog-title' }));
        let settled = false;
        const finish = (value) => { if (settled) return; settled = true; dlg.close(); dlg.remove(); resolve(value); };
        const actions = options.actions || [{ label: t('common.ok'), variant: 'primary', value: true }];
        const actionEls = actions.map((a) => basic.button({ label: a.label, variant: a.variant || 'default', onClick: () => finish(a.value) }));
        dlg.append(
          h('div', { class: 'dm-dialog-head' },
            h('h2', { id: 'dm-dialog-title', text: options.title || '' }),
            options.closable === false ? null : basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, variant: 'ghost', onClick: () => finish(undefined) })),
          h('div', { class: 'dm-dialog-body' }, (typeof options.body === 'function' ? options.body(finish) : options.body) || null),
          h('div', { class: 'dm-dialog-actions' }, actionEls),
        );
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (options.closable !== false) finish(undefined); });
        dlg.addEventListener('click', (e) => { if (e.target === dlg && options.closable !== false) finish(undefined); });
        // A dialog closed in any other way still settles its promise.
        dlg.addEventListener('close', () => finish(undefined));
        document.body.appendChild(dlg);
        dlg.showModal();
        const primary = actionEls.find((_, i) => actions[i].primary || actions[i].variant === 'primary');
        (primary || actionEls[0])?.focus();
      });
    }

    /**
     * @param {string} message
     * @param {{title?: string, okLabel?: string, cancelLabel?: string, danger?: boolean}} [opts]
     * @returns {Promise<boolean>}
     */
    async function confirm(message, opts = {}) {
      const result = await open({
        title: opts.title || t('dialog.confirm.title'),
        body: h('p', { text: message }),
        actions: [
          { label: opts.cancelLabel || t('common.cancel'), value: false },
          { label: opts.okLabel || t('common.ok'), variant: opts.danger ? 'danger' : 'primary', value: true, primary: true },
        ],
      });
      return result === true;
    }

    /**
     * @param {string} label
     * @param {{title?: string, value?: string, placeholder?: string, okLabel?: string}} [opts]
     * @returns {Promise<string|null>}
     */
    async function prompt(label, opts = {}) {
      const input = /** @type {any} */ (h('dm-input', { label, placeholder: opts.placeholder || '', value: opts.value || '' }));
      const p = open({
        title: opts.title || t('dialog.prompt.title'),
        body: input,
        actions: [{ label: t('common.cancel'), value: null }, { label: opts.okLabel || t('common.ok'), variant: 'primary', value: 'ok', primary: true }],
      });
      setTimeout(() => { input.focus(); input.select(); }, 0);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const dlg = input.closest('dialog'); dlg?.querySelector('.dm-dialog-actions dm-button[variant="primary"] button')?.click(); } });
      const result = await p;
      return result === 'ok' ? input.value : null;
    }

    // ---- toasts ----
    let container = null;
    const ICONS = { info: 'info', ok: 'circle-check', warn: 'triangle-alert', error: 'circle-alert' };
    /**
     * @param {string} text
     * @param {{kind?: 'info'|'ok'|'warn'|'error', timeout?: number, action?: {label: string, onClick: Function}}} [opts]
     */
    function show(text, opts = {}) {
      if (!container) { container = h('div', { class: 'dm-toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(container); }
      const kind = opts.kind || 'info';
      const el = h('div', { class: 'dm-toast', 'data-kind': kind },
        icons.icon(ICONS[kind] || 'info', 16),
        h('div', { class: 'dm-toast-text', text }),
        opts.action ? basic.button({ label: opts.action.label, size: 'sm', onClick: () => { opts.action.onClick(); el.remove(); } }) : null,
        basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => el.remove() }));
      container.appendChild(el);
      const timeout = opts.timeout === undefined ? (kind === 'error' ? 9000 : 4500) : opts.timeout;
      if (timeout > 0) setTimeout(() => el.remove(), timeout);
      return el;
    }

    // ---- floating panel ----
    /**
     * Non-modal panel docked at the bottom right (the beginner's course). The page stays usable behind it,
     * and the panel can be collapsed to its header.
     * @param {{label?: string, collapseLabel?: string, expandLabel?: string, onClose?: Function}} [options]
     * @returns {{el: HTMLElement, update: (content: {title?: string, meta?: string, body?: Array<Node|string>, actions?: Node[]}) => void, collapse: (on: boolean) => void, collapsed: () => boolean, focus: () => void, close: () => void}}
     */
    function floating(options = {}) {
      const titleEl = h('h2', { class: 'dm-floating-title', id: 'dm-floating-title', tabindex: '-1' });
      const metaEl = h('span', { class: 'dm-floating-meta' });
      const body = h('div', { class: 'dm-floating-body' });
      const actions = h('div', { class: 'dm-floating-actions' });
      let collapsed = false; let closed = false;
      const collapseLabel = options.collapseLabel || t('floating.collapse');
      const toggle = basic.button({ label: collapseLabel, icon: 'chevron-down', 'icon-only': true, variant: 'ghost', size: 'sm', onClick: () => collapse(!collapsed) });
      const el = h('section', { class: 'dm-floating', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'dm-floating-title' },
        h('div', { class: 'dm-floating-head' },
          h('div', { class: 'dm-floating-titles' }, metaEl, titleEl),
          toggle,
          basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, variant: 'ghost', size: 'sm', onClick: () => close() })),
        body, actions);
      function update(content) {
        const hadFocus = el.contains(document.activeElement);
        if (content.title !== undefined) titleEl.textContent = content.title;
        if (content.meta !== undefined) metaEl.textContent = content.meta;
        if (content.body) replace(body, content.body);
        if (content.actions) replace(actions, content.actions);
        // Re-rendered buttons lose focus; keep keyboard users inside the panel.
        if (hadFocus && !el.contains(document.activeElement)) titleEl.focus();
      }
      function collapse(on) {
        collapsed = !!on;
        el.toggleAttribute('data-collapsed', collapsed);
        toggle.setAttribute('icon', collapsed ? 'chevron-up' : 'chevron-down');
        toggle.setAttribute('label', collapsed ? (options.expandLabel || t('floating.expand')) : collapseLabel);
      }
      function close() { if (closed) return; closed = true; el.remove(); if (options.onClose) options.onClose(); }
      document.body.appendChild(el);
      return { el, update, collapse, collapsed: () => collapsed, focus: () => titleEl.focus(), close };
    }

    return { dialog: { open, confirm, prompt }, toast: { show }, floating };
  });
})();
