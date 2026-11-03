// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-icon name="search" size="16"> renders a Lucide icon (ISC licence, vendor/lucide), or one of the app's own glyphs, as inline SVG.
 * Icons are embedded as text assets and parsed once per name. Icons are decorative by default
 * (aria-hidden); pass `label` to make one meaningful to screen readers.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/icons', [], () => {
    /** @type {Map<string, Promise<SVGElement|null>>} */
    const cache = new Map();
    const parser = new DOMParser();
    /**
     * The app's own glyphs, drawn in the Lucide style (24 px grid, 2 px stroke). `dataspatium` is the mark:
     * Lucide's stacked sheets ("layers") with the left corner of each sheet cut off, so that together they form
     * a D; centred, with the original space between the sheets.
     */
    const OWN = {
      dataspatium: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.33 2.18a2 2 0 0 0-1.66 0L5.23 3.75 Q4.5 4.08 4.5 4.88 L4.5 9.12 Q4.5 9.92 5.23 10.25 L8.68 11.82a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M4.5 13.12 L4.5 14.12 Q4.5 14.92 5.23 15.25 L8.68 16.82 a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 19.5 12"/><path d="M4.5 18.12 L4.5 19.12 Q4.5 19.92 5.23 20.25 L8.68 21.82 a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 19.5 17"/></svg>',
    };

    /** @param {string} name @returns {Promise<SVGElement|null>} */
    function loadIcon(name) {
      let p = cache.get(name);
      if (!p) {
        p = (OWN[name] ? Promise.resolve(OWN[name]) : D.assets.loadText(`lucide/icons/${name}.svg`)).then((text) => {
          const doc = parser.parseFromString(text, 'image/svg+xml');
          const svg = doc.documentElement;
          if (!(svg instanceof SVGElement) || svg.nodeName !== 'svg') return null;
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.removeAttribute('class');
          return svg;
        }).catch((err) => { D.log('icons', 'missing icon', name, err); return null; });
        cache.set(name, p);
      }
      return p;
    }

    class DmIcon extends HTMLElement {
      static get observedAttributes() { return ['name', 'size', 'label']; }
      connectedCallback() { this.render(); }
      attributeChangedCallback() { if (this.isConnected) this.render(); }
      async render() {
        const name = this.getAttribute('name') || '';
        const size = this.getAttribute('size') || '16';
        const label = this.getAttribute('label');
        this.style.setProperty('--dm-icon-size', size + 'px');
        if (label) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); this.removeAttribute('aria-hidden'); }
        else { this.setAttribute('aria-hidden', 'true'); this.removeAttribute('role'); }
        const svg = await loadIcon(name);
        if (this.getAttribute('name') !== name) return; // changed while loading
        this.replaceChildren();
        if (svg) this.appendChild(/** @type {SVGElement} */ (svg.cloneNode(true)));
      }
    }
    if (!customElements.get('dm-icon')) customElements.define('dm-icon', DmIcon);

    /** Programmatic helper: `icon('search', 16)` returns a <dm-icon>. */
    function icon(name, size, label) {
      const el = document.createElement('dm-icon');
      el.setAttribute('name', name);
      if (size) el.setAttribute('size', String(size));
      if (label) el.setAttribute('label', label);
      return el;
    }
    return { icon, loadIcon };
  });
})();
