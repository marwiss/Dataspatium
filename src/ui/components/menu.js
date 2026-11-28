// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Menus: a popup list of actions (role menu) for a tree's snabbmeny and for Fler alternativ, <dm-menu-button> (a dm-button
 * that opens one) and a toolbar that moves the buttons that do not fit into its Fler alternativ.
 *
 *   const m = menu.open({items: [{id, label, icon?, hint?, disabled?, danger?, onSelect}], anchor?, x?, y?, label?});  m.close();
 *   <dm-menu-button icon="more-horizontal" label="Fler alternativ" icon-only>, with `el.items` an array or a function
 *   menu.overflow(toolbar, moreButton): the toolbar's dm-buttons that do not fit are hidden and listed in moreButton's menu
 *
 * Keys in a menu: the arrows, Home and End move, Enter and Space choose, a letter jumps, Escape and Tab close; the focus goes
 * back where it was. A press outside, a scroll outside or the window losing focus closes it too. One menu is open at a time.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/menu', ['ui/base', 'ui/icons', 'ui/basic'], (base, icons, basic) => {
    const { h, define } = base;
    /** @type {{el: HTMLElement, close: (refocus?: boolean) => void}|null} */
    let current = null;

    /**
     * @typedef {{id?: string, label: string, icon?: string, hint?: string, disabled?: boolean, danger?: boolean, separator?: boolean, onSelect?: () => void}} MenuItem
     */
    /**
     * Open a menu at an element (below it) or at a point.
     * @param {{items: Array<MenuItem|null|false>, anchor?: Element, x?: number, y?: number, label?: string, onClose?: () => void}} options
     * @returns {{el: HTMLElement, close: (refocus?: boolean) => void}}
     */
    function open(options) {
      if (current) current.close(false);
      const returnTo = /** @type {HTMLElement|null} */ (document.activeElement);
      const items = /** @type {MenuItem[]} */ (options.items.filter(Boolean));
      const el = h('div', { class: 'dm-menu', role: 'menu', tabindex: '-1', 'aria-label': options.label || null });
      /** @type {HTMLElement[]} */
      const buttons = [];
      for (const it of items) {
        if (it.separator) { el.appendChild(h('div', { class: 'dm-menu-sep', role: 'separator' })); continue; }
        const b = h('button', {
          type: 'button', class: 'dm-menu-item' + (it.danger ? ' dm-menu-danger' : ''), role: 'menuitem', tabindex: '-1',
          'aria-disabled': it.disabled ? 'true' : null, 'data-menu-item': it.id || null,
        }, it.icon ? icons.icon(it.icon, 16) : h('span', { class: 'dm-menu-gap', 'aria-hidden': 'true' }),
        h('span', { class: 'dm-menu-label', text: it.label }), it.hint ? h('span', { class: 'dm-menu-hint', text: it.hint }) : null);
        b.addEventListener('click', (e) => { e.preventDefault(); choose(it); });
        el.appendChild(b);
        buttons.push(b);
      }
      let closed = false;
      const outside = (e) => { if (!el.contains(/** @type {Node} */ (e.target))) close(false); };
      const scrolled = (e) => { if (!el.contains(/** @type {Node} */ (e.target))) close(false); };
      const blurred = () => close(false);
      function close(refocus = true) {
        if (closed) return;
        closed = true;
        el.remove();
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('scroll', scrolled, true);
        window.removeEventListener('blur', blurred);
        window.removeEventListener('resize', blurred);
        if (current && current.el === el) current = null;
        if (refocus && returnTo && returnTo.isConnected) returnTo.focus();
        if (options.onClose) options.onClose();
      }
      function choose(it) {
        if (it.disabled) return;
        close(true);
        if (it.onSelect) it.onSelect();
      }
      const focusAt = (i) => { if (!buttons.length) { el.focus(); return; } const n = buttons.length; buttons[((i % n) + n) % n].focus(); };
      const at = () => buttons.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      el.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowDown') focusAt(at() + 1);
        else if (k === 'ArrowUp') focusAt(at() < 0 ? -1 : at() - 1);
        else if (k === 'Home') focusAt(0);
        else if (k === 'End') focusAt(-1);
        else if (k === 'Escape') close(true);
        else if (k === 'Tab') close(true);
        else if (k === 'Enter' || k === ' ') { const i = at(); if (i >= 0) choose(items.filter((x) => !x.separator)[i]); }
        else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const ch = k.toLowerCase();
          const list = items.filter((x) => !x.separator);
          for (let s = 1; s <= list.length; s++) { const i = (Math.max(at(), 0) + s) % list.length; if (list[i].label.toLowerCase().startsWith(ch)) { focusAt(i); break; } }
        } else return;
        e.preventDefault();
        e.stopPropagation();
      });
      // The menu key and Shift+F10 that opened the menu reach it as a contextmenu event: not the browser's own menu on top.
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      // A menu opened from inside a modal dialog lives in the dialog, which renders in the top layer.
      const host = /** @type {HTMLElement} */ ((options.anchor && options.anchor.closest('dialog')) || document.body);
      host.appendChild(el);
      place(el, options);
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('scroll', scrolled, true);
      window.addEventListener('blur', blurred);
      window.addEventListener('resize', blurred);
      current = { el, close };
      const first = buttons.findIndex((b) => b.getAttribute('aria-disabled') !== 'true');
      focusAt(first < 0 ? 0 : first);
      return current;
    }

    /** Below the anchor (above it when there is no room), or at the point; always inside the window. */
    function place(el, options) {
      const margin = 8;
      el.style.left = '0px'; el.style.top = '0px';
      const box = el.getBoundingClientRect();
      let left; let top;
      if (options.anchor) {
        const r = options.anchor.getBoundingClientRect();
        left = r.left; top = r.bottom + 2;
        if (top + box.height > window.innerHeight - margin) top = r.top - box.height - 2;
      } else { left = options.x || 0; top = options.y || 0; if (top + box.height > window.innerHeight - margin) top = top - box.height; }
      left = Math.max(margin, Math.min(window.innerWidth - margin - box.width, left));
      top = Math.max(margin, Math.min(window.innerHeight - margin - box.height, top));
      el.style.left = Math.round(left) + 'px';
      el.style.top = Math.round(top) + 'px';
    }

    /** The menu that is open, or null. */
    const openMenu = () => current;

    /**
     * <dm-menu-button>: a dm-button that opens a menu of `items` (an array, or a function called when it opens). The arrow
     * down opens it too.
     */
    class DmMenuButton extends basic.DmButton {
      connectedCallback() {
        super.connectedCallback();
        if (this.wired) return;
        this.wired = true;
        this.btn.setAttribute('aria-haspopup', 'menu');
        this.btn.setAttribute('aria-expanded', 'false');
        let closedAt = 0;
        const show = () => {
          const list = typeof this.items === 'function' ? this.items() : (this.items || []);
          this.btn.setAttribute('aria-expanded', 'true');
          open({ items: list, anchor: this.btn, label: this.getAttribute('label') || '', onClose: () => { closedAt = performance.now(); if (this.btn) this.btn.setAttribute('aria-expanded', 'false'); } });
        };
        // A press on the button while its menu is open closes the menu (a press outside it); the click that follows must not
        // open it again.
        this.btn.addEventListener('click', () => { if (performance.now() - closedAt > 250) show(); });
        this.btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); show(); } });
      }
    }
    define('dm-menu-button', DmMenuButton);

    /**
     * Keep a toolbar on one line: the dm-buttons that do not fit are hidden, and `more` (a dm-menu-button at its end) lists
     * them, enabled and disabled as they are. Measures again when the toolbar changes size.
     * @param {HTMLElement} bar @param {any} more @returns {{update: () => void, disconnect: () => void}}
     */
    function overflow(bar, more) {
      const tools = () => /** @type {any[]} */ (Array.from(bar.querySelectorAll(':scope > dm-button')));
      function update() {
        const list = tools();
        for (const b of list) b.hidden = false;
        more.hidden = true;
        const room = bar.clientWidth;
        if (!room) return;
        const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
        const width = (el) => el.getBoundingClientRect().width;
        let used = list.reduce((sum, b, i) => sum + width(b) + (i ? gap : 0), 0);
        if (used <= room + 0.5) return;
        more.hidden = false;
        const reserve = width(more) + gap;
        for (let i = list.length - 1; i >= 0 && used + reserve > room + 0.5; i--) {
          used -= width(list[i]) + (i ? gap : 0);
          list[i].hidden = true;
        }
      }
      more.items = () => tools().filter((b) => b.hidden).map((b) => ({
        id: b.getAttribute('data-tool') || undefined, label: b.getAttribute('label') || '', icon: b.getAttribute('icon') || undefined,
        disabled: !!(b.btn && b.btn.disabled), danger: b.getAttribute('variant') === 'danger', onSelect: () => { if (b.btn) b.btn.click(); },
      }));
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => update()) : null;
      if (ro) ro.observe(bar);
      return { update, disconnect: () => { if (ro) ro.disconnect(); } };
    }

    return { open, overflow, current: openMenu, DmMenuButton };
  });
})();
