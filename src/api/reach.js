// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Whether a source can be reached from where the app runs (F14 a Källorna efter läge). A browser reads an answer from another
 * address only when the service allows the page's origin (CORS): `null` when the app is opened from a folder (file://), the
 * address of the web version otherwise. A preset or ready service may carry what was measured for it as `cors: {file, web}`;
 * a missing field, or a missing side, means that it works there. The source lists mark what does not work in this mode.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/reach', ['platform/capabilities'], (caps) => {
    /** Where the app runs: 'file' when opened from a folder, 'web' when served over http or https. */
    const mode = () => (caps.isFileProtocol ? 'file' : 'web');

    /**
     * Null when the source can be reached here, or why not: 'web' (only from the web version or a local server), 'file' (only
     * when opened from a folder) or 'bridge' (from neither; only a go-between such as the bridge on this computer helps).
     * @param {{cors?: {file?: boolean, web?: boolean}}|null|undefined} entry @param {string} [here] @returns {string|null}
     */
    function blocked(entry, here = mode()) {
      const c = entry && entry.cors;
      if (!c || c[here] !== false) return null;
      const other = here === 'file' ? 'web' : 'file';
      return c[other] === false ? 'bridge' : other;
    }

    /** The text that explains a reason from blocked(), for a badge and its tip. @param {string} reason */
    function label(reason) { return D.t('reach.' + reason); }
    /** @param {string} reason */
    function hint(reason) { return D.t('reach.' + reason + '.hint'); }

    return { mode, blocked, label, hint };
  });
})();
