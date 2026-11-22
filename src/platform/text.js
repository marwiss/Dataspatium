// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Small text helpers shared by builders and viewers, so that every module that writes markup escapes the same way, and
 * draws pictures from the same kind of address.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/text', [], () => {
    const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    /**
     * Escapes &, <, > and " so that any value can sit in an HTML or XML text node or a double-quoted attribute.
     * null and undefined become ''.
     * @param {any} v @returns {string}
     */
    function escapeHtml(v) { return String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, (c) => MAP[c]); }

    /**
     * The address of a picture that comes from a file, a worker or storage (a notebook's output, a chart's thumbnail), for
     * an img src, an SVG image or a CSS url(): only a data:image/ address is kept, so that drawing it never fetches. Anything
     * else (a web address, a relative path, a blob: the app did not make) gives '' and a line in the console. Code that makes
     * a blob: address itself sets it directly and never passes it here.
     * @param {any} value @returns {string}
     */
    function imageSource(value) {
      if (typeof value === 'string' && /^data:image\//i.test(value)) return value;
      if (value) console.warn('[images] left out a picture whose address is not data:image/: ' + String(value).slice(0, 80));
      return '';
    }
    return { escapeHtml, imageSource };
  });
})();
