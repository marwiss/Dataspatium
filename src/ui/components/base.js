// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Shared helpers for the dm-* component library: a small DOM builder, a base element class with
 * event helpers, and safe custom-element registration. Components use light DOM (no shadow roots) so
 * that the design tokens and component stylesheet apply everywhere without duplication.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/base', ['ui/i18n'], (i18n) => {
    /**
     * Build an element: `h('button', {class: 'x', onclick: fn, text: 'Spara'}, child, ...)`.
     * Children may be nodes, strings (text nodes), arrays, or null/false (skipped). Text is always
     * inserted as text nodes, never as HTML.
     * @param {string} tag
     * @param {Record<string, any>|null} [attrs]
     * @param {...any} children
     */
    function h(tag, attrs, ...children) {
      const el = document.createElement(tag);
      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value === null || value === undefined || value === false) continue;
          if (key === 'class') el.className = String(value);
          else if (key === 'text') el.textContent = String(value);
          else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
          else if (key === 'data' && typeof value === 'object') for (const [k, v] of Object.entries(value)) el.dataset[k] = String(v);
          else if (key === 'props' && typeof value === 'object') Object.assign(el, value);
          else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
          else if (value === true) el.setAttribute(key, '');
          else el.setAttribute(key, String(value));
        }
      }
      append(el, children);
      return el;
    }

    function append(parent, children) {
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (Array.isArray(child)) append(parent, child);
        else if (child instanceof Node) parent.appendChild(child);
        else parent.appendChild(document.createTextNode(String(child)));
      }
      return parent;
    }

    /** Replace all children. */
    function replace(parent, ...children) { parent.replaceChildren(); return append(parent, children); }

    class DmElement extends HTMLElement {
      /** Dispatch a bubbling, composed custom event. */
      emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
      }
      /** Attribute value with fallback. */
      attr(name, fallback = '') { const v = this.getAttribute(name); return v === null ? fallback : v; }
      /** Reflect a boolean attribute. */
      setFlag(name, on) { if (on) this.setAttribute(name, ''); else this.removeAttribute(name); }
      hasFlag(name) { return this.hasAttribute(name); }
    }

    /** Register a custom element once (test pages may load the library twice). */
    function define(name, cls) { if (!customElements.get(name)) customElements.define(name, cls); }

    let seq = 0;
    /** Unique id for label/control association. */
    function uid(prefix = 'dm') { return `${prefix}-${++seq}`; }

    return { h, append, replace, DmElement, define, uid, t: i18n.t, i18n };
  });
})();
