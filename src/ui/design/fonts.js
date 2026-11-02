// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Loads the embedded Inter font through the FontFace API. CSS @font-face cannot be used because
 * browsers fetch fonts in CORS mode, which fails for file:// pages; ArrayBuffers have no such limit.
 * The page renders with the system fallback until the fonts arrive, then switches without reflow jank
 * because Inter and the fallback have similar metrics.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/fonts', [], () => {
    const WEIGHTS = ['400', '500', '600'];
    let loading = null;

    /** Load all weights once; resolves when they are usable. Failures are logged, never fatal. */
    function loadFonts() {
      if (loading) return loading;
      if (typeof FontFace !== 'function' || !document.fonts) return Promise.resolve(false);
      loading = Promise.all(WEIGHTS.map(async (weight) => {
        try {
          const buffer = /** @type {ArrayBuffer} */ (await D.assets.load(`fonts/inter-latin-${weight}-normal.woff2`));
          const face = new FontFace('Inter', buffer, { weight, style: 'normal', display: 'swap' });
          document.fonts.add(await face.load());
          return true;
        } catch (err) {
          D.log('fonts', 'could not load Inter', weight, err);
          return false;
        }
      })).then((results) => results.every(Boolean));
      return loading;
    }
    return { loadFonts };
  });
})();
