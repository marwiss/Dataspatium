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
  /**
   * Languages: Swedish (the source language) always, plus the chosen one. The choice lives in localStorage
   * (`dataspatium.lang`) or in a ?lang= parameter. Before the first choice every language is loaded, so that the
   * first-start chooser can show each language in itself; afterwards other languages load on demand through
   * Dataspatium.require('ui/i18n').loadLanguage(code).
   */
  const LANGUAGES = ['sv', 'da', 'nb', 'fi', 'is', 'en'];
  function chosenLanguages() {
    let chosen = null;
    try { chosen = new URLSearchParams(location.search).get('lang') || localStorage.getItem('dataspatium.lang'); } catch (_e) { chosen = null; }
    if (!chosen || LANGUAGES.indexOf(chosen) < 0) return LANGUAGES.slice();
    return chosen === 'sv' ? ['sv'] : ['sv', chosen];
  }
  const scripts = [
    // Platform
    'src/platform/registry.js',
    'src/platform/capabilities.js',
    // Languages first: every later module may build user-facing text with Dataspatium.t at load time.
  ].concat(chosenLanguages().map((code) => 'src/ui/i18n/' + code + '.js'), [
    'src/ui/i18n/i18n.js',
    'src/platform/sync.js',
    'src/platform/assets.js',
    'vendor/manifest.js',
    'presets/local-assets.js',
    'presets/presets.js',
    'src/platform/worker-shim.js',
    'src/platform/net-shim.js',
    'src/platform/workers.js',
    'src/platform/storage/idb-store.js',
    'src/platform/consent.js',
    'src/platform/components.js',
    'src/platform/storage/zip-bundle.js',
    'src/platform/storage/files.js',
    'src/platform/storage/folder-store.js',
    'src/platform/storage/github-store.js',
    'src/platform/updates.js',
    // Engines
    'src/engines/sqlite/sqlite-worker.js',
    'src/engines/sqlite/sqlite-engine.js',
    'src/engines/r/package-index.js',
    'src/engines/r/remote-packages.js',
    'src/engines/r/r-engine.js',
    // Data
    'src/data/encoding.js',
    'src/data/types.js',
    'src/data/regex-syntax.js',
    'src/data/geo.js',
    'src/data/boundaries.js',
    'src/data/datasets.js',
    'src/analysis/regex.js',
    'src/data/query.js',
    'src/data/operations.js',
    'src/data/operations-extra.js',
    'src/data/operations-regex.js',
    'src/data/recipes.js',
    'src/data/derive.js',
    'src/data/profile.js',
    'src/data/rules.js',
    'src/analysis/search.js',
    'src/data/lists.js',
    'src/data/changelog.js',
    'src/data/comments.js',
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
    'src/io/importers/tables.js',
    'src/io/importers/geo.js',
    'src/io/import.js',
    'src/io/export.js',
    'src/io/url-import.js',
    // API connectors
    'src/api/schema.js',
    'src/api/secrets.js',
    'src/api/http.js',
    'src/api/auth.js',
    'src/api/jsonstat.js',
    'src/api/sdmx.js',
    'src/api/parsers.js',
    'src/api/request.js',
    'src/api/pagination.js',
    'src/api/connectors.js',
    'src/api/families/pxweb.js',
    'src/api/families/socialstyrelsen.js',
    'src/api/families/statbank.js',
    'src/api/families/fhi.js',
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
    'src/ui/components/tooltip.js',
    'src/ui/components/index.js',
    // UI: shell and modes
    'src/ui/shell/state.js',
    'src/ui/shell/dataset-list.js',
    'src/ui/shell/command-palette.js',
    'src/ui/shell/course.js',
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
    'src/ui/analysis/regex-panel.js',
    'src/ui/share/bundle-dialog.js',
    'src/ui/share/github-card.js',
    'src/ui/datasets/batch-actions.js',
    'src/ui/settings/network-card.js',
    'src/ui/modes/inhamta.js',
    'src/ui/modes/hantera.js',
    'src/ui/modes/soka.js',
    'src/ui/modes/bearbeta.js',
    'src/ui/modes/analysera.js',
    'src/ui/modes/visualisera.js',
    'src/ui/modes/exportera.js',
    'src/ui/modes/dela.js',
    'src/app.js',
  ]);
  // The page may live anywhere; resolve paths relative to this script's own src attribute.
  const current = /** @type {HTMLScriptElement|null} */ (document.currentScript);
  const src = (current && current.getAttribute('src')) || 'src/boot.js';
  const base = src.replace(/src\/boot\.js(\?.*)?$/, '');
  globalThis.DATASPATIUM_BASE = base;

  /**
   * Served over http(s) from a web server, the page is made cross-origin isolated by the service worker sw-coi.js
   * (it adds the COOP and COEP headers), so that SharedArrayBuffer works and R code can be interrupted. The worker
   * is registered once and the page reloads when it takes over; nothing happens on file://, when the page is
   * already isolated, or when the browser has no service workers. Loading continues without isolation if the
   * worker does not take over within a few seconds.
   */
  function isolate() {
    const w = /** @type {any} */ (globalThis);
    if (!/^https?:$/.test(location.protocol) || w.crossOriginIsolated || !w.isSecureContext || !('serviceWorker' in navigator)) return Promise.resolve();
    const FLAG = 'dataspatium.isolation.reload';
    const reloadOnce = () => {
      let done = false;
      try { done = sessionStorage.getItem(FLAG) === '1'; sessionStorage.setItem(FLAG, '1'); } catch (_e) { done = true; }
      if (done) return Promise.resolve();
      location.reload();
      return new Promise(() => {});
    };
    const scope = new URL(base || './', location.href).href;
    return navigator.serviceWorker.register(new URL('sw-coi.js', scope).href, { scope }).then(() => {
      if (navigator.serviceWorker.controller) return reloadOnce();
      return new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => { reloadOnce().then(resolve); }, { once: true });
        setTimeout(resolve, 4000);
      });
    }).catch((err) => { console.warn('[boot] cross-origin isolation unavailable', err); });
  }

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
  isolate().then(next);
})();
