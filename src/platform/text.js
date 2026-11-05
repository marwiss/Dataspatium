// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Small text helpers shared by builders and viewers, so that every module that writes markup escapes the same way.
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
    return { escapeHtml };
  });
})();
