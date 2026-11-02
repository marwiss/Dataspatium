// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * ZIP creation and extraction with fflate. Used for workspace backups and `.dataspatium.zip` bundles.
 * Synchronous for now (fast enough for tens of megabytes); large archives move to a worker later.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/storage/zip', [], () => {
    async function lib() {
      await D.assets.loadVendorScript('vendor/fflate/fflate.min.js');
      return /** @type {any} */ (globalThis).fflate;
    }
    /**
     * @param {Record<string, Uint8Array|ArrayBuffer|string>} files path -> content
     * @param {{level?: number}} [options]
     * @returns {Promise<Blob>}
     */
    async function createZip(files, options = {}) {
      const f = await lib();
      /** @type {Record<string, Uint8Array>} */
      const input = {};
      for (const [path, content] of Object.entries(files)) {
        input[path] = typeof content === 'string' ? f.strToU8(content) : content instanceof Uint8Array ? content : new Uint8Array(content);
      }
      const zipped = f.zipSync(input, { level: options.level === undefined ? 6 : options.level });
      return new Blob([zipped], { type: 'application/zip' });
    }
    /**
     * @param {Blob|ArrayBuffer|Uint8Array} source
     * @returns {Promise<Record<string, Uint8Array>>} path -> bytes
     */
    async function readZip(source) {
      const f = await lib();
      const bytes = source instanceof Uint8Array ? source : new Uint8Array(source instanceof Blob ? await source.arrayBuffer() : source);
      return f.unzipSync(bytes);
    }
    function text(bytes) { return new TextDecoder().decode(bytes); }
    return { createZip, readZip, text };
  });
})();
