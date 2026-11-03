// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tooltips: one floating element for the whole page. Any element with `data-tip` (or a `title`, which is
 * turned into `data-tip` the first time it is pointed at, so that the browser's own tooltip never shows twice)
 * gets the text after 400 ms of hovering, at once on keyboard focus, and after a long press on touch screens.
 * The tooltip is never the only carrier of information: icon-only buttons keep their aria-label, and an element
 * whose title was its only name gets that text as aria-label when the title is converted.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/tooltip', ['ui/base'], (base) => {
    const { h } = base;
    const HOVER_DELAY = 400;
    const PRESS_DELAY = 500;
    const ID = 'dm-tooltip';
    let el = null;
    let current = null;
    /** @type {HTMLElement|null} element whose tooltip is scheduled but not yet shown */
    let pending = null;
    let timer = 0;
    let installed = false;

    function element() {
      if (!el) el = h('div', { class: 'dm-tooltip', id: ID, role: 'tooltip', hidden: true });
      return el;
    }

    /** The text an element shows as its tooltip; converts a `title` into `data-tip` on first use. */
    function textFor(target) {
      if (!target || !target.getAttribute) return '';
      if (target.hasAttribute('title')) {
        const title = target.getAttribute('title') || '';
        target.removeAttribute('title');
        if (title && !target.hasAttribute('data-tip')) target.setAttribute('data-tip', title);
        // An element whose title was its only name keeps that name for assistive technology.
        if (title && !target.getAttribute('aria-label') && !(target.textContent || '').trim() && !target.getAttribute('aria-labelledby')) target.setAttribute('aria-label', title);
      }
      return target.getAttribute('data-tip') || '';
    }

    function targetOf(node) {
      const start = node && node.nodeType === 1 ? node : (node && node.parentElement) || null;
      return start ? /** @type {HTMLElement|null} */ (start.closest('[data-tip], [title]')) : null;
    }

    /** Show the tooltip for an element now (if it has text). */
    function show(target) {
      const text = textFor(target);
      if (!text) { hide(); return false; }
      const tip = element();
      tip.textContent = text;
      // Inside a modal dialog the tooltip must live in the dialog, which renders in the top layer.
      const host = /** @type {HTMLElement} */ (target.closest('dialog') || document.body);
      if (tip.parentElement !== host) host.appendChild(tip);
      tip.hidden = false;
      tip.style.left = '0px'; tip.style.top = '0px';
      const r = target.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      const margin = 8;
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(margin, Math.min(window.innerWidth - margin - tr.width, left));
      let top = r.bottom + 6;
      if (top + tr.height > window.innerHeight - margin) top = r.top - tr.height - 6;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(Math.max(margin, top)) + 'px';
      if (current && current !== target) current.removeAttribute('aria-describedby');
      current = target;
      target.setAttribute('aria-describedby', ID);
      return true;
    }

    function hide() {
      clearTimeout(timer); timer = 0; pending = null;
      if (current) { current.removeAttribute('aria-describedby'); current = null; }
      if (el) el.hidden = true;
    }

    function schedule(target, delay) {
      clearTimeout(timer);
      pending = target;
      timer = setTimeout(() => { timer = 0; pending = null; if (target.isConnected) show(target); }, delay);
    }

    /** Install the global listeners once. */
    function install() {
      if (installed || typeof document === 'undefined') return;
      installed = true;
      document.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const target = targetOf(/** @type {any} */ (e.target));
        if (!target) return;
        if (target === current) return;
        if (!textFor(target)) return;
        schedule(target, HOVER_DELAY);
      }, true);
      document.addEventListener('pointerout', (e) => {
        const target = targetOf(/** @type {any} */ (e.target));
        if (!target) return;
        const to = /** @type {any} */ (e.relatedTarget);
        if (to && target.contains(to)) return;
        // Only the element that is shown or scheduled cancels; pointerout elsewhere (Firefox synthesises
        // mouse events when the page changes under a resting pointer) leaves a pending tooltip alone.
        if (target === current || target === pending) hide();
      }, true);
      document.addEventListener('focusin', (e) => {
        const target = targetOf(/** @type {any} */ (e.target));
        if (target && textFor(target)) { clearTimeout(timer); show(target); }
      }, true);
      document.addEventListener('focusout', (e) => { const target = targetOf(/** @type {any} */ (e.target)); if (target && target === current) hide(); }, true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) hide(); }, true);
      document.addEventListener('scroll', () => { if (current) hide(); }, true);
      // Touch: a long press shows the tooltip, lifting the finger hides it a moment later.
      document.addEventListener('pointerdown', (e) => {
        const target = targetOf(/** @type {any} */ (e.target));
        if (e.pointerType === 'touch' && target && textFor(target)) { schedule(target, PRESS_DELAY); return; }
        hide();
      }, true);
      document.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') { clearTimeout(timer); timer = 0; if (current) setTimeout(hide, 1500); } }, true);
      document.addEventListener('pointercancel', () => hide(), true);
    }

    return { install, show, hide, textFor, element, HOVER_DELAY, PRESS_DELAY, ID };
  });
})();
