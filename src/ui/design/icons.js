// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-icon name="search" size="16"> renders a Lucide icon (ISC licence, vendor/lucide) as inline SVG.
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

    /** @param {string} name @returns {Promise<SVGElement|null>} */
    function loadIcon(name) {
      let p = cache.get(name);
      if (!p) {
        p = D.assets.loadText(`lucide/icons/${name}.svg`).then((text) => {
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
