// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataspatium boot loader.
 *
 * Loads every application script as a classic <script> tag in dependency order and then
 * dispatches the `dataspatium:ready` event. Pages opened via file:// cannot use ES modules or
 * fetch() against local files, so this is the only loading mechanism that works everywhere.
 *
 * `script.async = false` keeps insertion order while letting the browser prefetch in parallel.
 */
(function () {
  'use strict';
  const scripts = [
    // Platform
    'src/platform/registry.js',
    'src/platform/capabilities.js',
    'src/platform/sync.js',
    'src/platform/assets.js',
    'vendor/manifest.js',
    'presets/local-assets.js',
    'presets/presets.js',
    'src/platform/worker-shim.js',
    'src/platform/net-shim.js',
    'src/platform/workers.js',
    'src/platform/storage/idb-store.js',
    'src/platform/storage/zip-bundle.js',
    'src/platform/storage/files.js',
    'src/platform/storage/folder-store.js',
    'src/platform/updates.js',
    // Engines
    'src/engines/sqlite/sqlite-worker.js',
    'src/engines/sqlite/sqlite-engine.js',
    'src/engines/r/package-index.js',
    'src/engines/r/r-engine.js',
    // Data
    'src/data/encoding.js',
    'src/data/types.js',
    'src/data/geo.js',
    'src/data/boundaries.js',
    'src/data/datasets.js',
    'src/data/operations.js',
    'src/data/recipes.js',
    'src/data/derive.js',
    'src/data/profile.js',
    'src/data/rules.js',
    'src/data/workspace.js',
    'src/data/r-bridge.js',
    // Import and export
    'src/io/importers/csv.js',
    'src/io/importers/excel.js',
    'src/io/importers/json.js',
    'src/io/importers/xml.js',
    'src/io/importers/sqlite.js',
    'src/io/importers/r-formats.js',
    'src/io/importers/shapefile.js',
    'src/io/importers/fixed-width.js',
    'src/io/import.js',
    'src/io/export.js',
    'src/io/url-import.js',
    // API connectors
    'src/api/schema.js',
    'src/api/secrets.js',
    'src/api/http.js',
    'src/api/auth.js',
    'src/api/jsonstat.js',
    'src/api/parsers.js',
    'src/api/request.js',
    'src/api/pagination.js',
    'src/api/connectors.js',
    'src/api/families/pxweb.js',
    'src/api/families/socialstyrelsen.js',
    'src/api/runner.js',
    // Visualisation
    'src/viz/locale.js',
    'src/viz/theme.js',
    'src/viz/data.js',
    'src/viz/vega-builder.js',
    'src/viz/vega-render.js',
    'src/viz/d3-templates.js',
    'src/viz/export.js',
    'src/viz/charts.js',
    'src/viz/render.js',
    'src/viz/batch.js',
    'src/viz/pptx.js',
    'src/viz/dashboards.js',
    // Documents
    'src/docgen/template.js',
    'src/docgen/markdown.js',
    'src/docgen/builders.js',
    'src/docgen/builders-office.js',
    'src/docgen/documents.js',
    'src/docgen/generate.js',
    'src/analysis/notebooks.js',
    // UI: language, design, components
    'src/ui/i18n/sv.js',
    'src/ui/i18n/i18n.js',
    'src/ui/design/theme.js',
    'src/ui/design/fonts.js',
    'src/ui/design/icons.js',
    'src/ui/components/base.js',
    'src/ui/components/basic.js',
    'src/ui/components/fields.js',
    'src/ui/components/layout.js',
    'src/ui/components/overlays.js',
    'src/ui/components/dropzone.js',
    'src/ui/components/table.js',
    'src/ui/components/code-editor.js',
    'src/ui/components/index.js',
    // UI: shell and modes
    'src/ui/shell/state.js',
    'src/ui/shell/dataset-list.js',
    'src/ui/shell/command-palette.js',
    'src/ui/shell/shell.js',
    'src/ui/op-dialog.js',
    'src/ui/dialogs.js',
    'src/ui/api/variable-picker.js',
    'src/ui/api/auth-panel.js',
    'src/ui/api/endpoint-form.js',
    'src/ui/api/pxweb-view.js',
    'src/ui/api/sos-view.js',
    'src/ui/api/api-view.js',
    'src/ui/viz/export-dialog.js',
    'src/ui/viz/vega-controls.js',
    'src/ui/viz/d3-controls.js',
    'src/ui/viz/r-panel.js',
    'src/ui/viz/gallery.js',
    'src/ui/viz/dashboard-view.js',
    'src/ui/docs/document-panel.js',
    'src/ui/analysis/notebook-panel.js',
    'src/ui/modes/inhamta.js',
    'src/ui/modes/hantera.js',
    'src/ui/modes/bearbeta.js',
    'src/ui/modes/analysera.js',
    'src/ui/modes/visualisera.js',
    'src/ui/modes/exportera.js',
    'src/app.js',
  ];
  // The page may live anywhere; resolve paths relative to this script's own src attribute.
  const current = /** @type {HTMLScriptElement|null} */ (document.currentScript);
  const src = (current && current.getAttribute('src')) || 'src/boot.js';
  const base = src.replace(/src\/boot\.js(\?.*)?$/, '');
  globalThis.DATASPATIUM_BASE = base;
  let index = 0;
  function next() {
    if (index >= scripts.length) {
      document.dispatchEvent(new CustomEvent('dataspatium:ready'));
      return;
    }
    const path = scripts[index++];
    const el = document.createElement('script');
    el.src = base + path;
    el.async = false;
    el.onload = next;
    el.onerror = function () {
      console.error('[boot] failed to load', el.src);
      document.dispatchEvent(new CustomEvent('dataspatium:boot-error', { detail: path }));
    };
    document.head.appendChild(el);
  }
  next();
})();
