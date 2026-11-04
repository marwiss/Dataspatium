// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Form fields: dm-input, dm-select, dm-switch. All expose a `value` (or `checked`) property and let
 * the native `input` / `change` events bubble from the inner control.
 *
 * <dm-input label="Namn" placeholder="…" help="…" error="…" type="text|number|search|textarea" rows="4" mono inline>
 * <dm-select label="Format"> with `options` property [{value, label}] or <option> children
 * <dm-switch label="Första raden är rubriker" checked>
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/fields', ['ui/base'], (base) => {
    const { h, DmElement, define, uid } = base;

    class DmInput extends DmElement {
      static get observedAttributes() { return ['label', 'placeholder', 'help', 'error', 'disabled', 'required', 'min', 'max', 'step']; }
      connectedCallback() {
        if (!this.control) {
          const id = uid('inp');
          const type = this.attr('type', 'text');
          const isTextarea = type === 'textarea' || this.hasAttribute('rows');
          this.labelEl = h('label', { class: 'dm-label', for: id });
          this.control = isTextarea
            ? h('textarea', { class: 'dm-field', id, rows: this.attr('rows', '4') })
            : h('input', { class: 'dm-field', id, type });
          if (this.hasAttribute('value')) this.control.value = this.attr('value');
          if (this.hasAttribute('name')) this.control.name = this.attr('name');
          if (this.hasAttribute('inputmode')) this.control.setAttribute('inputmode', this.attr('inputmode'));
          if (this.hasFlag('mono')) this.control.style.fontFamily = 'var(--dm-font-mono)';
          this.helpEl = h('div', { class: 'dm-help' });
          this.errorEl = h('div', { class: 'dm-field-error', role: 'alert' });
          this.append(this.labelEl, this.control, this.helpEl, this.errorEl);
        }
        this.sync();
      }
      attributeChangedCallback() { if (this.control) this.sync(); }
      sync() {
        const label = this.getAttribute('label');
        this.labelEl.textContent = label || '';
        this.labelEl.hidden = !label;
        if (!label && this.hasAttribute('aria-label')) this.control.setAttribute('aria-label', this.attr('aria-label'));
        this.control.placeholder = this.attr('placeholder');
        this.control.disabled = this.hasFlag('disabled');
        this.control.required = this.hasFlag('required');
        for (const a of ['min', 'max', 'step']) { if (this.hasAttribute(a)) this.control.setAttribute(a, this.attr(a)); }
        const help = this.getAttribute('help'); this.helpEl.textContent = help || ''; this.helpEl.hidden = !help;
        const error = this.getAttribute('error'); this.errorEl.textContent = error || ''; this.errorEl.hidden = !error;
        this.control.setAttribute('aria-invalid', error ? 'true' : 'false');
      }
      get value() { return this.control ? this.control.value : this.attr('value'); }
      set value(v) { if (this.control) this.control.value = v === null || v === undefined ? '' : String(v); else this.setAttribute('value', String(v)); }
      get valueAsNumber() { const n = Number(this.value); return Number.isFinite(n) ? n : NaN; }
      set error(msg) { if (msg) this.setAttribute('error', msg); else this.removeAttribute('error'); }
      focus() { this.control?.focus(); }
      select() { this.control?.select?.(); }
    }
    define('dm-input', DmInput);

    class DmSelect extends DmElement {
      static get observedAttributes() { return ['label', 'help', 'disabled']; }
      connectedCallback() {
        if (!this.control) {
          const id = uid('sel');
          this.labelEl = h('label', { class: 'dm-label', for: id });
          this.control = h('select', { class: 'dm-field', id });
          const existing = Array.from(this.querySelectorAll('option'));
          for (const o of existing) this.control.appendChild(o);
          this.helpEl = h('div', { class: 'dm-help' });
          this.replaceChildren(this.labelEl, this.control, this.helpEl);
          if (this.pendingOptions) { this.options = this.pendingOptions; this.pendingOptions = null; }
          if (this.pendingValue !== undefined) { this.value = this.pendingValue; this.pendingValue = undefined; }
        }
        this.sync();
      }
      attributeChangedCallback() { if (this.control) this.sync(); }
      sync() {
        const label = this.getAttribute('label');
        this.labelEl.textContent = label || ''; this.labelEl.hidden = !label;
        if (!label && this.hasAttribute('aria-label')) this.control.setAttribute('aria-label', this.attr('aria-label'));
        this.control.disabled = this.hasFlag('disabled');
        const help = this.getAttribute('help'); this.helpEl.textContent = help || ''; this.helpEl.hidden = !help;
      }
      /** @param {Array<{value: string, label: string}>} list */
      set options(list) {
        if (!this.control) { this.pendingOptions = list; return; }
        const current = this.control.value;
        this.control.replaceChildren(...list.map((o) => h('option', { value: o.value, text: o.label })));
        if (list.some((o) => o.value === current)) this.control.value = current;
      }
      get options() { return this.control ? Array.from(this.control.options).map((o) => ({ value: o.value, label: o.textContent || '' })) : (this.pendingOptions || []); }
      get value() { return this.control ? this.control.value : (this.pendingValue ?? ''); }
      set value(v) { if (this.control) this.control.value = String(v); else this.pendingValue = String(v); }
      focus() { this.control?.focus(); }
    }
    define('dm-select', DmSelect);

    class DmSwitch extends DmElement {
      static get observedAttributes() { return ['label', 'checked', 'disabled']; }
      connectedCallback() {
        if (!this.control) {
          this.control = h('input', { type: 'checkbox', role: 'switch' });
          this.control.checked = this.hasAttribute('checked');
          this.textEl = h('span');
          this.appendChild(h('label', null, this.control, h('span', { class: 'dm-switch-track', 'aria-hidden': 'true' }), this.textEl));
        }
        this.sync();
      }
      attributeChangedCallback(name) {
        if (!this.control) return;
        if (name === 'checked') this.control.checked = this.hasAttribute('checked');
        this.sync();
      }
      sync() { this.textEl.textContent = this.attr('label'); this.control.disabled = this.hasFlag('disabled'); }
      get checked() { return this.control ? this.control.checked : this.hasAttribute('checked'); }
      set checked(v) { if (this.control) this.control.checked = !!v; this.setFlag('checked', !!v); }
    }
    define('dm-switch', DmSwitch);

    return { DmInput, DmSelect, DmSwitch };
  });
})();
