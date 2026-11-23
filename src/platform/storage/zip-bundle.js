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
    const bytesOf = async (source) => (source instanceof Uint8Array ? source : new Uint8Array(source instanceof Blob ? await source.arrayBuffer() : source));
    /**
     * The entries of a ZIP, or only those `options.filter` keeps (it sees each entry's name and sizes before it is unpacked).
     * @param {Blob|ArrayBuffer|Uint8Array} source
     * @param {{filter?: (entry: {name: string, size: number, originalSize: number}) => boolean}} [options]
     * @returns {Promise<Record<string, Uint8Array>>} path -> bytes
     */
    async function readZip(source, options = {}) {
      const f = await lib();
      const bytes = await bytesOf(source);
      return options.filter ? f.unzipSync(bytes, { filter: options.filter }) : f.unzipSync(bytes);
    }
    /**
     * The names and sizes of a ZIP's entries, without unpacking any.
     * @param {Blob|ArrayBuffer|Uint8Array} source @returns {Promise<Array<{name: string, size: number, compressed: number}>>}
     */
    async function listZip(source) {
      const f = await lib();
      const out = [];
      f.unzipSync(await bytesOf(source), { filter: (e) => { out.push({ name: e.name, size: e.originalSize, compressed: e.size }); return false; } });
      return out;
    }
    function text(bytes) { return new TextDecoder().decode(bytes); }
    return { createZip, readZip, listZip, text };
  });
})();
