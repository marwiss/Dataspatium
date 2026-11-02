// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Basic components: dm-button, dm-badge, dm-progress.
 *
 * <dm-button variant="primary|default|ghost|danger" size="sm" icon="save" icon-only label="Spara"
 *            loading disabled block active>Spara</dm-button>
 * Clicks bubble as normal `click` events from the inner <button>.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/basic', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, DmElement, define } = base;

    class DmButton extends DmElement {
      static get observedAttributes() { return ['disabled', 'loading', 'icon', 'label', 'icon-only', 'type', 'title']; }
      connectedCallback() {
        if (!this.btn) {
          this.labelEl = h('span', { class: 'dm-btn-label' });
          while (this.firstChild) this.labelEl.appendChild(this.firstChild);
          this.btn = h('button', { type: this.attr('type', 'button') });
          this.btn.appendChild(this.labelEl);
          this.appendChild(this.btn);
        }
        this.sync();
      }
      attributeChangedCallback() { if (this.btn) this.sync(); }
      sync() {
        const loading = this.hasFlag('loading');
        this.btn.disabled = this.hasFlag('disabled') || loading;
        this.btn.type = this.attr('type', 'button');
        const iconName = loading ? 'loader-circle' : this.getAttribute('icon');
        if (iconName) {
          if (!this.iconEl) { this.iconEl = icons.icon(iconName); this.btn.insertBefore(this.iconEl, this.labelEl); }
          else if (this.iconEl.getAttribute('name') !== iconName) this.iconEl.setAttribute('name', iconName);
        } else if (this.iconEl) { this.iconEl.remove(); this.iconEl = null; }
        const label = this.getAttribute('label');
        if (label !== null) {
          if (this.hasFlag('icon-only')) { this.btn.setAttribute('aria-label', label); this.btn.title = this.attr('title', label); this.labelEl.textContent = ''; }
          else { this.labelEl.textContent = label; this.btn.removeAttribute('aria-label'); }
        }
        if (this.hasFlag('icon-only')) this.labelEl.hidden = true;
      }
      get label() { return this.getAttribute('label') || this.labelEl?.textContent || ''; }
      set label(v) { this.setAttribute('label', v); }
      get disabled() { return this.hasFlag('disabled'); }
      set disabled(v) { this.setFlag('disabled', !!v); }
      get loading() { return this.hasFlag('loading'); }
      set loading(v) { this.setFlag('loading', !!v); }
      focus() { this.btn?.focus(); }
    }
    define('dm-button', DmButton);

    /** <dm-badge kind="ok|warn|error|accent">Text</dm-badge> */
    class DmBadge extends DmElement {}
    define('dm-badge', DmBadge);

    /** <dm-progress value="40" label="Importerar"> or <dm-progress indeterminate> */
    class DmProgress extends DmElement {
      static get observedAttributes() { return ['value', 'indeterminate', 'label']; }
      connectedCallback() {
        if (!this.bar) { this.bar = h('span'); this.appendChild(this.bar); this.setAttribute('role', 'progressbar'); }
        this.sync();
      }
      attributeChangedCallback() { if (this.bar) this.sync(); }
      sync() {
        const v = Math.max(0, Math.min(100, Number(this.attr('value', '0')) || 0));
        this.bar.style.width = v + '%';
        this.setAttribute('aria-valuemin', '0'); this.setAttribute('aria-valuemax', '100');
        if (this.hasFlag('indeterminate')) this.removeAttribute('aria-valuenow'); else this.setAttribute('aria-valuenow', String(v));
        const label = this.getAttribute('label');
        if (label) this.setAttribute('aria-label', label);
      }
      get value() { return Number(this.attr('value', '0')); }
      set value(v) { this.setAttribute('value', String(v)); }
    }
    define('dm-progress', DmProgress);

    /**
     * Convenience: `button({label, icon, variant, onClick, ...})` returns a configured <dm-button>.
     * @param {Record<string, any>} options
     */
    function button(options) {
      const { onClick, label, ...rest } = options;
      const el = h('dm-button', Object.assign({ label }, rest));
      if (onClick) el.addEventListener('click', onClick);
      return el;
    }

    return { DmButton, DmBadge, DmProgress, button };
  });
})();
