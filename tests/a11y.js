// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Accessibility checks for the tests, without third-party code: every interactive element has an
 * accessible name, form fields have labels, ids are unique and the ids that ARIA attributes point to exist,
 * dialogs have names, roles are valid, no positive tabindex, no interactive element inside another, headings
 * are not empty, and images have text alternatives. `contrast` computes WCAG contrast ratios.
 * The name computation follows the order of the accessible-name specification in simplified form.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/a11y', [], () => {
    const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
    const ROLES = new Set(['alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
      // WAI-ARIA Graphics Module, used by Vega for charts.
      'graphics-document', 'graphics-object', 'graphics-symbol']);

    /** Whether an element takes part in the accessibility tree (not hidden, not inside aria-hidden). */
    function exposed(el) {
      if (el.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
      if (!el.getClientRects().length) return false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (n.tagName === 'DETAILS' && !n.hasAttribute('open') && n !== el && !el.closest('summary')) return false;
      }
      return true;
    }
    /** Visible text of a subtree, with the text alternatives of images; aria-hidden parts are skipped. */
    function textOf(node) {
      let out = '';
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += child.textContent;
        else if (child.nodeType === 1) {
          const el = /** @type {Element} */ (child);
          if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) continue;
          if (el.tagName === 'IMG') out += ' ' + (el.getAttribute('alt') || '');
          else if (el.getAttribute('aria-label')) out += ' ' + el.getAttribute('aria-label');
          else out += ' ' + textOf(el);
        }
      }
      return out.replace(/\s+/g, ' ').trim();
    }
    /** Accessible name in simplified form. */
    function nameOf(el) {
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const text = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => textOf(n)).join(' ').trim();
        if (text) return text;
      }
      const label = (el.getAttribute('aria-label') || '').trim();
      if (label) return label;
      if (el.labels && el.labels.length) {
        const text = Array.from(el.labels).map((l) => textOf(l)).join(' ').trim();
        if (text) return text;
      }
      if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
      if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
        const text = textOf(el);
        if (text) return text;
      }
      return (el.getAttribute('title') || '').trim();
    }
    /** A short description of an element for messages: tag, id, classes and text. */
    function describe(el) {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      const host = el.closest('dm-button, dm-input, dm-select, dm-switch, dm-tabs, dm-table, dm-code');
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${host && host !== el ? ' in ' + host.tagName.toLowerCase() : ''}${text ? ' "' + text + '"' : ''}`;
    }

    /**
     * Check a part of the page. Returns problems as {rule, element}; `ignore` filters known exceptions.
     * @param {ParentNode} root
     * @param {{ignore?: (problem: {rule: string, element: string, el: Element}) => boolean}} [options]
     */
    function audit(root, options = {}) {
      const problems = [];
      const add = (rule, el) => { const p = { rule, element: describe(el), el }; if (!options.ignore || !options.ignore(p)) problems.push(p); };
      const all = Array.from(root.querySelectorAll('*'));
      for (const el of root.querySelectorAll(INTERACTIVE)) {
        if (!exposed(el)) continue;
        if (!nameOf(el)) add(/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? 'label' : 'name', el);
        const tabindex = Number(el.getAttribute('tabindex'));
        if (tabindex > 0) add('tabindex', el);
        const outer = el.parentElement && el.parentElement.closest('button, a[href], [role="button"], [role="link"]');
        if (outer && root.contains(outer)) add('nested-interactive', el);
      }
      // Ids: unique within the document, and the ids that ARIA attributes and labels point to exist.
      const seen = new Map();
      for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
      for (const el of all) {
        if (el.id && seen.get(el.id) > 1 && exposed(el)) add('duplicate-id', el);
        for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
          const v = el.getAttribute(attr);
          if (v && v.split(/\s+/).some((id) => !document.getElementById(id))) add('missing-ref', el);
        }
        if (el.tagName === 'LABEL' && el.getAttribute('for') && !document.getElementById(el.getAttribute('for'))) add('missing-ref', el);
        const role = el.getAttribute('role');
        if (role && !role.split(/\s+/).every((r) => ROLES.has(r))) add('role', el);
        if (/^H[1-6]$/.test(el.tagName) && exposed(el) && !textOf(el) && !el.querySelector('input, dm-input')) add('empty-heading', el);
        if (el.tagName === 'IMG' && !el.hasAttribute('alt')) add('img-alt', el);
        if ((el.tagName === 'DIALOG' || role === 'dialog' || role === 'alertdialog') && exposed(el) && !nameOf(el)) add('dialog-name', el);
      }
      return problems;
    }

    /** Relative luminance of a colour given as #rrggbb or rgb(r, g, b). */
    function luminance(color) {
      const s = String(color).trim();
      let rgb;
      const hex = /^#([0-9a-f]{6})$/i.exec(s);
      if (hex) rgb = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
      else { const m = /rgba?\(([^)]+)\)/.exec(s); rgb = m ? m[1].split(/[ ,/]+/).slice(0, 3).map(Number) : [0, 0, 0]; }
      const lin = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    }
    /** WCAG contrast ratio of two colours. */
    function contrast(a, b) {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    return { audit, nameOf, exposed, contrast, luminance };
  });
})();
