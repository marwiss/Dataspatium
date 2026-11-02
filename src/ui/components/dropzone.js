// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-dropzone accept=".csv,.xlsx" multiple text="Släpp filer här" hint="CSV, Excel …">
 * Emits `dm-files` with {files: File[]} on drop or after the picker closes.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dropzone', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, DmElement, define } = base;

    class DmDropzone extends DmElement {
      connectedCallback() {
        if (this.input) return;
        this.input = /** @type {HTMLInputElement} */ (h('input', { type: 'file', accept: this.getAttribute('accept'), multiple: this.hasAttribute('multiple') }));
        this.input.addEventListener('change', () => { this.deliver(Array.from(this.input.files || [])); this.input.value = ''; });
        this.setAttribute('role', 'button');
        this.setAttribute('tabindex', '0');
        this.append(
          icons.icon(this.attr('icon', 'upload'), 28),
          h('div', { text: this.attr('text') }),
          this.getAttribute('hint') ? h('div', { class: 'dm-help', text: this.attr('hint') }) : null,
          this.input,
        );
        this.addEventListener('click', () => this.input.click());
        this.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.input.click(); } });
        this.addEventListener('dragover', (e) => { e.preventDefault(); this.setFlag('dragover', true); });
        this.addEventListener('dragleave', () => this.setFlag('dragover', false));
        this.addEventListener('drop', (e) => {
          e.preventDefault(); this.setFlag('dragover', false);
          const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
          this.deliver(this.hasAttribute('multiple') ? files : files.slice(0, 1));
        });
      }
      deliver(files) { if (files.length) this.emit('dm-files', { files }); }
    }
    define('dm-dropzone', DmDropzone);
    return { DmDropzone };
  });
})();
