// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser file helpers: trigger downloads and open the file picker. Both work under file://.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/files', [], () => {
    /** @param {Blob} blob @param {string} filename */
    function download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    /**
     * @param {{accept?: string, multiple?: boolean}} [options]
     * @returns {Promise<File[]>} empty when cancelled
     */
    function pick(options = {}) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (options.accept) input.accept = options.accept;
        input.multiple = !!options.multiple;
        input.style.display = 'none';
        input.addEventListener('change', () => { resolve(Array.from(input.files || [])); input.remove(); });
        input.addEventListener('cancel', () => { resolve([]); input.remove(); });
        document.body.appendChild(input);
        input.click();
      });
    }
    /** Safe file name from a dataset name. */
    function safeName(name, ext) {
      const base = String(name || 'dataspatium').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'dataspatium';
      return ext ? `${base}.${ext}` : base;
    }
    return { download, pick, safeName };
  });
})();
