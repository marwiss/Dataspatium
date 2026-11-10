// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Aggregates the component library so that requiring `ui/components` registers every dm-* element.
 * Custom elements must be defined before views create them with document.createElement.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/components', ['ui/base', 'ui/icons', 'ui/basic', 'ui/fields', 'ui/layout', 'ui/overlays', 'ui/dropzone', 'ui/table', 'ui/code-editor', 'ui/tooltip', 'ui/viewcube'],
    (base, icons, basic, fields, layout, overlays, dropzone, table, codeEditor, tooltip, viewcube) => {
      tooltip.install();
      return Object.assign({}, { base, icons, basic, fields, layout, overlays, dropzone, table, codeEditor, tooltip, viewcube });
    });
})();
