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
  const LANGUAGES = ['sv', 'da', 'nb', 'nn', 'fi', 'is', 'en'];
  function chosenLanguages() {
    let chosen = null;
    try { chosen = new URLSearchParams(location.search).get('lang') || localStorage.getItem('dataspatium.lang'); } catch (_e) { chosen = null; }
    if (!chosen || LANGUAGES.indexOf(chosen) < 0) return LANGUAGES.slice();
    return chosen === 'sv' ? ['sv'] : ['sv', chosen];
  }
  const languageScripts = chosenLanguages().map((code) => 'src/ui/i18n/' + code + '.js');
  /**
   * Dataspatium Mobil (m/index.html sets DATASPATIUM_PROFILE = 'mobile') loads only what a phone needs: the
   * platform, the SQLite engine for viewing, the components, the transfer module and the mobile app. No R, no
   * importers, no modes.
   */
  const MOBILE = [
    'src/platform/registry.js',
    'src/platform/capabilities.js',
    'src/platform/downloads.js',
  ].concat(languageScripts, [
    'src/ui/i18n/i18n.js',
    'src/platform/sync.js',
    'src/platform/assets.js',
    'vendor/manifest.js',
    'src/platform/worker-shim.js',
    'src/platform/net-shim.js',
    'src/platform/workers.js',
    'src/platform/storage/idb-store.js',
    'src/platform/consent.js',
    'src/platform/storage/zip-bundle.js',
    'src/platform/storage/files.js',
    'src/platform/text.js',
    'src/platform/p2p.js',
    'src/engines/sqlite/sqlite-worker.js',
    'src/engines/sqlite/sqlite-engine.js',
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
    'src/ui/components/viewcube.js',
    'src/ui/components/index.js',
    'src/ui/share/qr.js',
    'src/data/field-form.js',
    'src/mobile/kind-views.js',
    'src/mobile/field.js',
    'src/mobile/app.js',
  ]);
  const full = [
    // Platform
    'src/platform/registry.js',
    'src/platform/capabilities.js',
    'src/platform/downloads.js',
    // Languages first: every later module may build user-facing text with Dataspatium.t at load time.
  ].concat(languageScripts, [
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
    'src/platform/text.js',
    'src/platform/storage/folder-store.js',
    'src/platform/storage/github-store.js',
    'src/platform/updates.js',
    'src/platform/p2p.js',
    // Engines
    'src/engines/sqlite/sqlite-worker.js',
    'src/engines/sqlite/sqlite-engine.js',
    'src/engines/r/package-index.js',
    'src/engines/r/remote-packages.js',
    'src/engines/r/r-engine.js',
    'src/engines/python/catalog.js',
    'src/engines/python/python-engine.js',
    'src/engines/pdf/pdf-engine.js',
    // Data
    'src/data/encoding.js',
    'src/data/types.js',
    'src/data/regex-syntax.js',
    'src/data/geo.js',
    'src/data/boundaries.js',
    'src/data/plan-catalog.js',
    'src/data/plan-nordic.js',
    'src/data/plan.js',
    'src/data/graph.js',
    'src/data/ifc-step.js',
    'src/data/dxf.js',
    'src/data/model.js',
    'src/data/datasets.js',
    'src/analysis/regex.js',
    'src/analysis/text.js',
    'src/analysis/images.js',
    'src/data/query.js',
    'src/data/operations.js',
    'src/data/operations-extra.js',
    'src/data/operations-regex.js',
    'src/data/code-steps.js',
    'src/data/operations-timeseries.js',
    'src/data/operations-kinds.js',
    'src/data/ifc-ops.js',
    'src/data/ifc-new.js',
    'src/data/models.js',
    'src/data/graph-ops.js',
    'src/data/recipes.js',
    'src/data/derive.js',
    'src/data/profile.js',
    'src/data/rules.js',
    'src/analysis/search.js',
    'src/analysis/querybuilder.js',
    'src/data/lists.js',
    'src/data/changelog.js',
    'src/data/comments.js',
    'src/data/workspace.js',
    'src/data/r-bridge.js',
    'src/data/python-bridge.js',
    'src/data/exif.js',
    'src/data/dataset-files.js',
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
    'src/io/importers/access.js',
    'src/io/importers/documents.js',
    'src/io/importers/images.js',
    'src/io/importers/detaljplan.js',
    'src/io/importers/plan-archive.js',
    'src/io/importers/graph.js',
    'src/io/importers/model.js',
    'src/io/importers/bcf.js',
    'src/io/importers/qgis.js',
    'src/io/import.js',
    'src/data/linked-files.js',
    'src/io/export.js',
    'src/io/url-import.js',
    // API connectors
    'src/api/schema.js',
    'src/api/secrets.js',
    'src/api/http.js',
    'src/api/bsdd.js',
    'src/api/websocket.js',
    'src/api/auth.js',
    'src/api/jsonstat.js',
    'src/api/sdmx.js',
    'src/api/parsers.js',
    'src/api/request.js',
    'src/api/pagination.js',
    'src/api/reach.js',
    'src/api/files.js',
    'src/api/heights.js',
    'src/api/connectors.js',
    'src/api/families/common.js',
    'src/api/families/pxweb.js',
    'src/api/families/socialstyrelsen.js',
    'src/api/families/statbank.js',
    'src/api/families/fhi.js',
    'src/api/families/databases.js',
    'src/data/ifc-graph.js',
    'src/api/families/neo4j.js',
    'src/api/cde-log.js',
    'src/api/families/opencde.js',
    'src/api/families/opencde-admin.js',
    'src/api/families/opencde-manage.js',
    'src/api/graph-source.js',
    'src/api/families/geodata.js',
    'src/api/runner.js',
    'src/api/bridge.js',
    // Visualisation
    'src/viz/locale.js',
    'src/viz/theme.js',
    'src/viz/data.js',
    'src/viz/vega-builder.js',
    'src/viz/vega-render.js',
    'src/viz/d3-templates.js',
    'src/viz/export.js',
    'src/viz/charts.js',
    'src/viz/leaflet.js',
    'src/viz/graph-draw.js',
    'src/analysis/clash-core.js',
    'src/engines/ifc/ifc-engine.js',
    'src/engines/gltf.js',
    'src/data/model-server.js',
    'src/engines/ocr/ocr-engine.js',
    'src/viz/model-draw.js',
    'src/analysis/model.js',
    'src/analysis/geo.js',
    'src/analysis/graph.js',
    'src/analysis/cypher.js',
    'src/analysis/cypher-write.js',
    'src/viz/render.js',
    'src/viz/plotly.js',
    'src/viz/code-charts.js',
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
    'src/ui/ask.js',
    'src/ui/components/dropzone.js',
    'src/ui/components/table.js',
    'src/ui/components/code-editor.js',
    'src/ui/components/tooltip.js',
    'src/ui/components/viewcube.js',
    'src/ui/components/index.js',
    // UI: shell and modes
    'src/ui/shell/state.js',
    'src/ui/shell/dataset-list.js',
    'src/ui/shell/command-palette.js',
    'src/ui/help/help-panel.js',
    'src/ui/shell/course.js',
    'src/data/flows.js',
    'src/data/conditions.js',
    'src/data/commands.js',
    'src/api/remote.js',
    'src/data/field-collect.js',
    'src/data/watches.js',
    'src/ui/shell/shell.js',
    'src/ui/op-dialog.js',
    'src/ui/dialogs.js',
    'src/ui/api/variable-picker.js',
    'src/ui/api/auth-panel.js',
    'src/ui/api/endpoint-form.js',
    'src/ui/api/merge-dialog.js',
    'src/ui/api/pxweb-view.js',
    'src/ui/api/sos-view.js',
    'src/ui/api/geodata-view.js',
    'src/ui/api/geoportal-view.js',
    'src/ui/api/graph-workbench.js',
    'src/ui/api/neo4j-view.js',
    'src/ui/api/cde-log-card.js',
    'src/ui/api/admin-panel.js',
    'src/ui/api/manage-panel.js',
    'src/ui/api/opencde-view.js',
    'src/ui/api/api-view.js',
    'src/ui/api/bridge-view.js',
    'src/ui/api/family-dialog.js',
    'src/ui/viz/export-dialog.js',
    'src/ui/viz/vega-controls.js',
    'src/ui/viz/d3-controls.js',
    'src/ui/viz/r-panel.js',
    'src/ui/viz/python-panel.js',
    'src/ui/viz/map-panel.js',
    'src/ui/viz/graph-chart-panel.js',
    'src/ui/viz/model-chart-panel.js',
    'src/ui/viz/gallery.js',
    'src/ui/viz/present.js',
    'src/ui/viz/dashboard-view.js',
    'src/ui/docs/document-panel.js',
    'src/ui/analysis/notebook-panel.js',
    'src/ui/analysis/regex-panel.js',
    'src/analysis/stats.js',
    'src/ui/analysis/stats-panel.js',
    'src/ui/analysis/text-panel.js',
    'src/ui/analysis/images-panel.js',
    'src/ui/analysis/geo-panel.js',
    'src/ui/analysis/plan-panel.js',
    'src/ui/analysis/graph-panel.js',
    'src/ui/analysis/model-panel.js',
    'src/ui/bearbeta/document-view.js',
    'src/ui/bearbeta/gallery-view.js',
    'src/ui/bearbeta/map-view.js',
    'src/ui/bearbeta/plan-view.js',
    'src/ui/bearbeta/graph-view.js',
    'src/data/issues.js',
    'src/data/ifc-validation.js',
    'src/ui/bearbeta/model-issues.js',
    'src/ui/bearbeta/model-compare.js',
    'src/ui/bearbeta/model-view.js',
    'src/ui/share/review.js',
    'src/ui/share/devices-panel.js',
    'src/data/kinds.js',
    'src/data/selection.js',
    // Fråga AI om modellen: the providers, the read tools and the agent loop; the panel lives in Bearbeta's model view
    'src/ai/providers.js',
    'src/ai/model-tools.js',
    'src/ai/build-input.js',
    'src/ai/ids-writer.js',
    'src/ui/api/profile-card.js',
    'src/ai/write-tools.js',
    'src/ai/agent.js',
    'src/ai/assistant.js',
    'src/ui/bearbeta/ai-panel.js',
    'src/ui/assistant/assistant-panel.js',
    'src/data/spatial-search.js',
    'src/data/media.js',
    'src/data/facets.js',
    'src/io/file-sense.js',
    'src/data/version-diff.js',
    'src/data/model-diff.js',
    'src/ui/kinds/sketches.js',
    'src/ui/kinds/dataset-picture.js',
    'src/data/ocr.js',
    'src/data/bcf-xml.js',
    'src/analysis/clash.js',
    'src/data/collab.js',
    'src/data/provenance.js',
    'src/data/library.js',
    'src/data/codelists.js',
    'src/data/dcat.js',
    'src/io/datapackage.js',
    'src/docgen/quality.js',
    'src/data/guides.js',
    'src/ui/guides/guides-view.js',
    'src/analysis/starters.js',
    'src/docgen/viewers.js',
    'src/docgen/site.js',
    'src/viz/plan-map.js',
    'src/io/export-kinds.js',
    'src/viz/suggest.js',
    'src/viz/profile.js',
    'src/ui/soka/place-form.js',
    'src/ui/kinds/ocr-dialog.js',
    'src/ui/kinds/provenance-view.js',
    'src/ui/library/library-view.js',
    'src/ui/share/github-merge.js',
    'src/ui/share/cde-send.js',
    'src/ui/kinds/comment-block.js',
    'src/ui/kinds/row-pictures.js',
    'src/data/kind-health.js',
    'src/ui/kinds/insight-cards.js',
    'src/data/share-scan.js',
    'src/data/protected-columns.js',
    'src/ui/share/bundle-dialog.js',
    'src/ui/share/github-card.js',
    'src/ui/share/qr.js',
    'src/ui/datasets/batch-actions.js',
    'src/ui/settings/network-card.js',
    'src/ui/field/field-view.js',
    'src/ui/field/receive.js',
    'src/ui/modes/inhamta.js',
    'src/ui/flows/flows-view.js',
    'src/ui/modes/hantera.js',
    'src/ui/soka/query-tab.js',
    'src/ui/modes/soka.js',
    'src/ui/modes/bearbeta.js',
    'src/ui/modes/analysera.js',
    'src/ui/viz/profile-dialog.js',
    'src/ui/modes/visualisera.js',
    'src/ui/modes/exportera.js',
    'src/ui/modes/dela.js',
    'src/app.js',
    // The mobile app is small and part of the test page; m/index.html loads it through the MOBILE list above.
    'src/data/field-form.js',
    'src/mobile/kind-views.js',
    'src/mobile/field.js',
    'src/mobile/app.js',
  ]);
  const scripts = globalThis.DATASPATIUM_PROFILE === 'mobile' ? MOBILE : full;  // The page may live anywhere; resolve paths relative to this script's own src attribute.
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
