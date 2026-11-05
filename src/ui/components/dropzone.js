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
    /** Everything in dropped folders. A reader gives its entries in parts, until a part is empty. */
    async function filesIn(entries) {
      const out = [];
      const visit = async (entry, path) => {
        if (entry.isFile) {
          const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
          file.dmPath = path + file.name;
          out.push(file);
          return;
        }
        const reader = entry.createReader();
        for (;;) {
          const part = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (!part.length) break;
          for (const child of part) await visit(child, `${path}${entry.name}/`);
        }
      };
      for (const entry of entries) await visit(entry, '');
      return out;
    }
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
          const transfer = e.dataTransfer;
          const files = Array.from((transfer && transfer.files) || []);
          if (!this.hasAttribute('multiple')) { this.deliver(files.slice(0, 1)); return; }
          // The entries have to be taken before the event ends.
          const entries = Array.from((transfer && transfer.items) || []).map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
          if (!entries.some((x) => x.isDirectory)) { this.deliver(files); return; }
          filesIn(entries).then((all) => this.deliver(all)).catch((err) => D.log('dropzone', err));
        });
      }
      deliver(files) { if (files.length) this.emit('dm-files', { files }); }
    }
    define('dm-dropzone', DmDropzone);
    return { DmDropzone };
  });
})();
