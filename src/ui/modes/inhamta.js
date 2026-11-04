// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Inhämta": import wizard for files and pasted text (steps: file, options with preview, columns,
 * done) and open APIs (connector presets and imported configurations, see src/ui/api/api-view.js).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/inhamta', ['ui/base', 'io/importers/csv', 'data/encoding', 'data/types', 'api/connectors', 'ui/api/api-view', 'platform/files', 'ui/api/bridge-view', 'ui/api/family-dialog', 'data/linked', 'io/importers/qgis'], (base, csv, encoding, types, connectors, apiView, files, bridgeView, familyDialog, linked, qgis) => {
    const { h, t, i18n, replace } = base;
    const STEPS = [{ id: 'file', label: t('import.step.file') }, { id: 'options', label: t('import.step.options') }, { id: 'columns', label: t('import.step.columns') }, { id: 'done', label: t('import.step.done') }];
    const DECIMALS = [{ value: 'auto', label: t('import.decimal.auto') }, { value: 'comma', label: t('import.decimal.comma') }, { value: 'point', label: t('import.decimal.point') }];
    const FORMATS = ['csv', 'fixed', 'excel', 'tables', 'json', 'xml', 'sqlite', 'access', 'shapefile', 'geo', 'r', 'documents', 'images'];
    /** Formats without a header-row switch (structure carries the names). */
    const NO_HEADER = ['json', 'xml', 'sqlite', 'access', 'shapefile', 'geo', 'r', 'documents', 'images'];
    /** Formats whose values are already typed (no decimal-separator choice). */
    const TYPED = ['sqlite', 'access', 'shapefile', 'r', 'documents', 'images'];
    /** Formats with fixed columns where one or many files become one dataset (no column step). */
    const COLLECTIONS = ['documents', 'images'];
    const ACCEPT = '.csv,.tsv,.txt,.tab,.dat,.fwf,.prn,.xlsx,.xlsm,.xls,.xlsb,.ods,.fods,.dbf,.slk,.sylk,.dif,.wk1,.wk3,.wk4,.wks,.wq1,.wq2,.wb1,.wb2,.wb3,.qpw,'
      + '.html,.htm,.xhtml,.md,.markdown,.docx,.tex,.json,.ndjson,.jsonl,.geojson,.topojson,.kml,.kmz,.gpx,.xml,.sqlite,.sqlite3,.db,.gpkg,.sql,'
      + '.shp,.zip,.sav,.zsav,.por,.dta,.sas7bdat,.xpt,.px,.rds,.rda,.RData,.parquet,.mdb,.accdb,'
      + '.pdf,.odt,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.qgs,.qgz';

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null;
      let source = 'file';
      const wiz = reset();
      let previewTimer = 0;
      let connectorList = [];
      let unsubConnectors = null;
      /** @type {any} */ let apiUi = null;
      let apiId = null;
      /** @type {any} */ let bridgeUi = null;

      function reset() { return { step: 'file', file: null, files: [], progress: null, project: null, handle: null, text: '', url: '', options: { format: '', encoding: '', delimiter: 'auto', header: undefined, sheet: '', path: '', decimal: 'auto', recordTag: '', table: '', layer: '', simplify: 0, breaks: '' }, preview: null, specs: [], name: '', busy: false, result: null, error: '' }; }
      function restart() { Object.assign(wiz, reset()); render(); }

      let unsubStore = null;
      function activate(s) {
        slots = s;
        unsubConnectors = connectors.subscribe(reloadConnectors);
        // The saved fetches follow the datasets (count in the source list, rows and times in the view).
        unsubStore = store.subscribe((state, changed) => { if (!changed.includes('datasets') || !slots) return; renderLeft(); if (source === 'saved') renderSaved(); });
        reloadConnectors();
        render();
      }
      function deactivate() {
        slots = null;
        if (unsubConnectors) unsubConnectors();
        if (unsubStore) { unsubStore(); unsubStore = null; }
        if (apiUi) { apiUi.destroy(); apiUi = null; apiId = null; }
        if (bridgeUi) { bridgeUi.destroy(); bridgeUi = null; }
      }
      async function reloadConnectors() {
        connectorList = await connectors.list();
        if (slots) renderLeft();
      }

      function render() {
        if (!slots) return;
        renderLeft(); renderCenter(); renderRight();
      }

      // ---- left: sources ----
      function renderLeft() {
        replace(slots.left,
          h('h4', { text: t('import.sources') }),
          h('div', { class: 'dm-list' },
            sourceItem('file', 'folder-open', t('import.sources.files'), null),
            sourceItem('paste', 'clipboard-paste', t('import.sources.paste'), t('import.sources.paste.hint')),
            sourceItem('url', 'link', t('import.sources.url'), t('import.sources.url.hint')),
            sourceItem('saved', 'refresh-cw', t('api.saved.title'), t('api.saved.hint', { n: apiDatasets().length }))),
          h('h4', { text: t('api.sources') }),
          renderCountryChips(),
          h('div', { class: 'dm-list' }, visibleConnectors().map((c) => sourceItem('api:' + c.id, 'globe', c.name, [c.country ? t('country.' + c.country) : '', c.publisher, c.level === 2 ? t('api.level2') : ''].filter(Boolean).join(' · ')))),
          visibleConnectors().length ? null : h('p', { class: 'dm-help dm-xs', text: t('api.countries.none') }),
          h('div', { class: 'dm-row' }, ui.button({ label: t('api.add.file'), icon: 'upload', size: 'sm', onClick: addConnector })),
          h('p', { class: 'dm-help dm-xs', text: t('import.sources.api.hint') }),
          h('h4', { text: t('bridge.sources') }),
          h('div', { class: 'dm-list' }, sourceItem('bridge', 'database', t('bridge.title'), t('bridge.hint'))),
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('families.add.source'), icon: 'plus', size: 'sm', onClick: () => addFamily() }),
            ui.button({ label: t('geodata.add.source'), icon: 'map', size: 'sm', title: t('geodata.add.hint'), onClick: () => addFamily('geodata') })),
          h('p', { class: 'dm-help dm-xs', text: t('families.hint') }));
      }

      // ---- country filter for the API sources (remembered per browser) ----
      const COUNTRY_KEY = 'dataspatium.api.countries';
      /** @type {Set<string>|null} null means every country */
      let countryFilter = loadCountryFilter();
      function loadCountryFilter() {
        try { const raw = localStorage.getItem(COUNTRY_KEY); const arr = raw ? JSON.parse(raw) : null; return Array.isArray(arr) ? new Set(arr) : null; } catch (_e) { return null; }
      }
      function saveCountryFilter() {
        try { if (countryFilter) localStorage.setItem(COUNTRY_KEY, JSON.stringify(Array.from(countryFilter))); else localStorage.removeItem(COUNTRY_KEY); } catch (_e) { /* storage may be unavailable */ }
      }
      function availableCountries() { return connectors.COUNTRIES.filter((code) => connectorList.some((c) => c.country === code)); }
      function visibleConnectors() { return connectorList.filter((c) => !countryFilter || !c.country || countryFilter.has(c.country)); }
      function toggleCountry(code) {
        const all = availableCountries();
        if (!countryFilter) countryFilter = new Set(all.filter((c) => c !== code));
        else if (countryFilter.has(code)) countryFilter.delete(code);
        else countryFilter.add(code);
        if (all.every((c) => countryFilter.has(c))) countryFilter = null;
        saveCountryFilter();
        renderLeft();
      }
      function renderCountryChips() {
        const all = availableCountries();
        if (all.length < 2) return null;
        const chip = (label, pressed, onclick) => h('button', { type: 'button', class: 'dm-chip', 'aria-pressed': pressed ? 'true' : 'false', onclick }, label);
        return h('div', { class: 'dm-chips', role: 'group', 'aria-label': t('api.countries'), title: t('api.countries.hint') },
          chip(t('api.countries.all'), !countryFilter, () => { countryFilter = null; saveCountryFilter(); renderLeft(); }),
          all.map((code) => chip(t('country.' + code), !countryFilter || countryFilter.has(code), () => toggleCountry(code))));
      }
      function sourceItem(id, icon, label, sub) {
        return h('button', { type: 'button', class: 'dm-list-item', 'aria-current': source === id ? 'true' : null, onclick: () => { source = id; if (!id.startsWith('api:') && wiz.step !== 'file') restart(); else render(); } },
          ui.icon(icon, 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: label }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      async function addConnector() {
        const [file] = await files.pick({ accept: '.json,application/json' });
        if (!file) return;
        try {
          const c = await connectors.importJson(await file.text());
          shell.log(t('api.added', { name: c.name }), 'ok');
          ui.toast.show(t('api.added', { name: c.name }), { kind: 'ok' });
          await reloadConnectors();
          source = 'api:' + c.id;
          render();
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
      }

      // ---- centre ----
      function renderCenter() {
        if (source.startsWith('api:')) { renderApi(); return; }
        if (source === 'saved') { renderSaved(); return; }
        if (source === 'bridge') { renderBridge(); return; }
        const stepper = /** @type {any} */ (h('dm-stepper'));
        stepper.steps = STEPS; stepper.active = wiz.step;
        const body = wiz.project ? stepProject() : wiz.step === 'file' ? stepFile() : wiz.step === 'options' ? stepOptions() : wiz.step === 'columns' ? stepColumns() : stepDone();
        replace(slots.center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('download', 20), t('import.title')), stepper), body);
      }

      // ---- saved fetches: every dataset from an API, updated with one click ----
      const apiDatasets = () => store.get().datasets.filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge'));
      /** Ids being updated; '*' while everything is. */
      const updating = new Set();
      function renderSaved() {
        if (!slots) return;
        const list = apiDatasets();
        const busy = updating.size > 0;
        const head = h('div', { class: 'dm-page-head' },
          h('h1', null, ui.icon('refresh-cw', 20), t('api.saved.title')),
          h('div', { class: 'dm-row' }, list.length ? ui.button({ label: t('api.saved.update.all', { n: list.length }), icon: 'refresh-cw', variant: 'primary', loading: updating.has('*'), disabled: busy && !updating.has('*'), onClick: updateAll }) : null));
        if (!list.length) { replace(slots.center, head, h('dm-empty-state', { icon: 'globe', heading: t('api.saved.empty'), text: t('api.saved.empty.hint') })); return; }
        const where = (src) => src.kind === 'bridge' ? (src.label || t('bridge.title')) : [src.connectorName, src.table && src.table.title ? src.table.title : src.endpointName].filter(Boolean).join(' · ');
        const rows = list.map((d) => h('tr', null,
          h('td', null, h('div', { text: d.name }), h('code', { class: 'dm-list-code', text: d.shortName || '' })),
          h('td', { text: where(d.source) }),
          h('td', { text: d.source.fetchedAt ? i18n.formatDateTime(d.source.fetchedAt) : '–' }),
          h('td', { class: 'dm-num', text: i18n.formatNumber(d.rowCount || 0) }),
          h('td', null, ui.button({ label: t('api.saved.update'), icon: 'refresh-cw', size: 'sm', loading: updating.has(d.id), disabled: busy && !updating.has(d.id), onClick: () => updateOne(d) }))));
        replace(slots.center, head,
          h('p', { class: 'dm-help', text: t('api.saved.intro') }),
          h('div', { class: 'dm-table-wrap' }, h('table', { class: 'dm-columns-table' },
            h('thead', null, h('tr', null, ...['api.saved.col.dataset', 'api.saved.col.source', 'api.saved.col.fetched', 'api.saved.col.rows', ''].map((k, i) => h('th', { class: i === 3 ? 'dm-num' : null, text: k ? t(k) : '' })))),
            h('tbody', null, ...rows))));
      }
      async function updateOne(d) {
        updating.add(d.id); renderSaved();
        try {
          const res = await D.require('api/runner').refreshDataset(d.id);
          const text = res.steps ? t('api.refresh.done.steps', { name: d.name, rows: i18n.formatNumber(res.rows), steps: res.steps }) : t('api.refresh.done', { name: d.name, rows: i18n.formatNumber(res.rows) });
          shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
        } catch (err) {
          const message = (err && err.message) || String(err);
          shell.log(`${d.name}: ${message}`, 'error'); ui.toast.show(`${d.name}: ${message}`, { kind: 'error', timeout: 12000 });
        } finally { updating.delete(d.id); renderSaved(); }
      }
      async function updateAll() {
        updating.add('*'); renderSaved();
        try {
          const results = await D.require('api/runner').refreshAll();
          for (const r of results) shell.log(r.ok ? t('api.refresh.done', { name: r.name, rows: i18n.formatNumber(r.rows || 0) }) : `${r.name}: ${r.error}`, r.ok ? 'ok' : 'error');
          const ok = results.filter((r) => r.ok).length;
          ui.toast.show(t('api.refresh.all.done', { ok, failed: results.length - ok }), { kind: ok === results.length ? 'ok' : 'warn', timeout: 10000 });
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
        finally { updating.delete('*'); renderSaved(); }
      }

      function renderApi() {
        const id = source.slice(4);
        const connector = connectorList.find((c) => c.id === id);
        if (!connector) { replace(slots.center, h('p', { class: 'dm-help', text: t('common.loading') })); return; }
        if (!apiUi || apiId !== id) {
          if (apiUi) apiUi.destroy();
          apiId = id;
          apiUi = apiView.create(ctx, connector, {
            onDataset: () => {},
            onRemoved: () => { apiUi = null; apiId = null; source = 'file'; reloadConnectors().then(render); },
            // A geodata source added from a catalogue search opens in place of the search.
            onConnector: (c) => openConnector(c),
          });
          apiUi.start();
        }
        replace(slots.center, apiUi.el);
      }

      /** A connector for a database family (PostgREST, OData, ...) or a geodata service (WFS, OGC API Features, ArcGIS) from an address and a key; it opens when created. */
      async function addFamily(group) {
        const connector = await familyDialog.open(ctx, group ? { group } : {});
        if (!connector) return;
        await openConnector(connector);
      }
      /** Show a connector that was just created or added. */
      async function openConnector(connector) {
        await reloadConnectors();
        source = 'api:' + connector.id;
        render();
      }
      /** The local database bridge (api/bridge): connection, source, tables, preview, own SQL and import. */
      function renderBridge() {
        if (!bridgeUi) { bridgeUi = bridgeView.create(ctx); bridgeUi.start(); }
        replace(slots.center, bridgeUi.el);
      }
      /** Fetch a web address: configurations are added directly, data files continue in the wizard. */
      async function fetchUrl(url) {
        wiz.url = url; wiz.busy = true; wiz.error = ''; render();
        try {
          const urlImport = D.require('io/url-import');
          const file = await urlImport.fetchFile(url);
          if (/\.json$/i.test(file.name) || /json/.test(file.type)) {
            const text = await file.text();
            if (urlImport.configFormat(text)) {
              const res = await urlImport.importConfig(text);
              const msg = t('import.url.config.done', { kind: t('import.url.kind.' + res.kind), name: res.record && res.record.name ? res.record.name : file.name });
              shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
              if (res.kind === 'api') await reloadConnectors();
              wiz.busy = false; render();
              return;
            }
          }
          wiz.file = file; wiz.files = []; wiz.text = ''; wiz.options.format = ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined;
          wiz.busy = false;
          await runPreview();
          return;
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function stepFile() {
        if (source === 'url') {
          const input = /** @type {any} */ (h('dm-input', { type: 'url', label: t('import.url.label'), placeholder: 'https://', value: wiz.url || '' }));
          input.addEventListener('keydown', (e) => { if (/** @type {any} */ (e).key === 'Enter') fetchUrl(input.value.trim()); });
          return h('div', { class: 'dm-stack' }, input,
            h('div', { class: 'dm-row' }, ui.button({ label: t('import.url.fetch'), variant: 'primary', icon: 'download', loading: wiz.busy, onClick: () => fetchUrl(input.value.trim()) })),
            wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null,
            h('p', { class: 'dm-help', text: t('import.url.help') }));
        }
        if (source === 'paste') {
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '12', label: t('import.paste.label'), mono: true }));
          ta.value = wiz.text;
          return h('div', { class: 'dm-stack' }, ta, h('div', { class: 'dm-row' }, ui.button({ label: t('import.paste.use'), variant: 'primary', icon: 'check', onClick: async () => { wiz.text = ta.value; if (!wiz.text.trim()) return; wiz.file = null; await runPreview(); } })));
        }
        const dz = h('dm-dropzone', { text: t('import.drop'), hint: t('import.drop.hint'), accept: ACCEPT, multiple: true });
        dz.addEventListener('dm-files', (e) => chooseFiles(/** @type {any} */ (e).detail.files));
        // Bundled data: the example table as a button, the boundaries for maps in a list.
        const examples = D.require('presets').examples;
        const tables = examples.filter((p) => p.format !== 'geojson');
        const boundaries = examples.filter((p) => p.format === 'geojson');
        const pick = /** @type {any} */ (h('dm-select', { label: t('presets.geo.label') }));
        pick.options = boundaries.map((p) => ({ value: p.id, label: p.nameKey ? t(p.nameKey) : p.name }));
        pick.value = wiz.boundary || boundaries[0].id;
        pick.addEventListener('change', () => { wiz.boundary = pick.value; });
        return h('div', { class: 'dm-stack' }, dz,
          linked.supported() ? h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('linked.pick'), icon: 'link', onClick: pickLinked }), h('span', { class: 'dm-help', text: t('linked.pick.hint') })) : null,
          h('div', { class: 'dm-row-wrap' }, tables.map((p, i) => ui.button({ label: i === 0 ? t('presets.try') : (p.nameKey ? t(p.nameKey) : p.name), 'data-course': i === 0 ? 'example' : null, icon: 'sparkles', onClick: () => importPreset(p) }))),
          h('div', { class: 'dm-row-end' }, pick, ui.button({ label: t('presets.geo.import'), icon: 'globe', onClick: () => importPreset(boundaries.find((p) => p.id === pick.value) || boundaries[0]) })),
          h('span', { class: 'dm-help', text: t('presets.geo.hint') }));
      }

      /**
       * Files from the drop zone. Several documents, or several pictures, become one collection with fixed
       * columns; any other choice of several files takes the first one through the wizard as before.
       */
      async function chooseFiles(list) {
        if (!list || !list.length) return;
        // A QGIS project (with or without its data files) becomes a map view, not a dataset.
        const projectFile = list.find((f) => qgis.detect(f));
        if (projectFile) { await openProject(projectFile, list.filter((f) => f !== projectFile)); return; }
        const collection = services.importer.collectionFor(list);
        if (list.length > 1 && !collection) ui.toast.show(t('import.multi.first', { name: list[0].name }), { kind: 'info', timeout: 8000 });
        wiz.files = collection && list.length > 1 ? list : [];
        wiz.file = list[0]; wiz.handle = null; wiz.text = ''; wiz.name = '';
        wiz.options.format = wiz.files.length ? collection.id : ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined;
        if (wiz.files.length) wiz.name = t('import.collection.' + collection.id, { n: list.length });
        await runPreview();
      }
      /**
       * A QGIS project: read the layers, match them to datasets in the workspace or to the files dropped with it, and
       * offer to create a map view (io/importers/qgis).
       */
      async function openProject(file, companions) {
        wiz.busy = true; wiz.error = ''; render();
        try {
          const project = await qgis.parseFile(file);
          const matches = qgis.matchDatasets(project, store.get().datasets);
          const lower = (s) => String(s || '').toLowerCase();
          const plan = project.layers.map((layer) => {
            if (layer.type !== 'vector') return { layer, status: 'raster' };
            if (matches.has(layer.id)) return { layer, status: 'matched', dataset: matches.get(layer.id) };
            const companion = companions.find((f) => lower(f.name) === lower(layer.source.file));
            return companion ? { layer, status: 'import', file: companion } : { layer, status: 'missing' };
          });
          wiz.project = { file, project, matches, plan, name: project.title || services.importer.baseName(file.name), result: null };
          wiz.step = 'options';
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }
      /** Import the dropped data files of the project, build the map layers and save the map view. */
      async function createProjectMap() {
        const p = wiz.project;
        if (!p || wiz.busy) return;
        wiz.busy = true; wiz.error = ''; render();
        try {
          for (const item of p.plan) {
            if (item.status !== 'import') continue;
            wiz.progress = { file: item.file.name }; render();
            const opts = item.layer.source.layer ? { table: item.layer.source.layer, layer: item.layer.source.layer } : {};
            const meta = await services.importer.run(item.file, opts, null, item.layer.name);
            p.matches.set(item.layer.id, meta); item.status = 'matched'; item.dataset = meta;
          }
          const { layers, missing } = await qgis.toMapLayers(p.project, p.matches, (id) => services.datasets.columns(id));
          if (!layers.length) throw new Error(t('import.project.none'));
          const charts = D.require('viz/charts'); const leaflet = D.require('viz/leaflet');
          const first = layers.find((l) => l.kind === 'dataset');
          const base = first ? { id: first.datasetId, name: first.datasetName, shortName: first.datasetShort } : null;
          const chart = charts.create('map', base, wiz.name || p.name);
          chart.map = leaflet.defaultMap([], null);
          chart.map.layers = layers;
          chart.thumbnail = await leaflet.thumbnail(chart);
          const saved = await charts.save(chart);
          p.result = { chart: saved, layers: layers.length, missing };
          shell.log(t('import.project.created', { name: saved.name, n: layers.length }), 'ok');
          ui.toast.show(t('import.project.created', { name: saved.name, n: layers.length }), { kind: 'ok' });
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; wiz.progress = null; render();
      }
      function stepProject() {
        const p = wiz.project;
        if (p.result) {
          return h('div', { class: 'dm-success' },
            h('h2', null, ui.icon('circle-check', 20), ' ', t('import.project.created', { name: p.result.chart.name, n: p.result.layers })),
            p.result.missing.length ? h('p', { class: 'dm-help', text: t('import.project.skipped', { n: p.result.missing.length, names: p.result.missing.map((m) => m.layer.name).join(', ') }) }) : null,
            h('div', { class: 'dm-row' },
              ui.button({ label: t('import.project.open'), variant: 'primary', icon: 'map', onClick: () => { store.set({ openChartId: p.result.chart.id }); shell.activate('visualisera'); } }),
              ui.button({ label: t('import.another'), icon: 'plus', onClick: restart })));
        }
        const name = /** @type {any} */ (h('dm-input', { label: t('import.project.name'), value: wiz.name || p.name }));
        name.addEventListener('input', () => { wiz.name = name.value; });
        const statusText = (item) => item.status === 'matched' ? t('import.project.layer.matched', { name: item.dataset.name }) : item.status === 'import' ? t('import.project.layer.import', { file: item.file.name }) : item.status === 'raster' ? t('import.project.layer.raster') : t('import.project.layer.missing', { file: item.layer.source.file || item.layer.source.raw });
        const statusKind = (item) => (item.status === 'matched' || item.status === 'import' ? 'ok' : item.status === 'raster' ? null : 'warn');
        const usable = p.plan.filter((i) => i.status === 'matched' || i.status === 'import').length;
        return h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: t('import.project.hint') }),
          h('div', { class: 'dm-form-grid' }, name),
          h('h3', { text: t('import.project.layers', { n: p.plan.length }) }),
          h('ul', { class: 'dm-list' }, p.plan.map((item) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(item.status === 'raster' ? 'image' : 'map', 14),
            h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: item.layer.name + (item.layer.visible ? '' : ' · ' + t('import.project.layer.hidden')) }), h('span', { class: 'dm-list-sub dm-truncate', text: statusText(item) })),
            h('dm-badge', Object.assign({ text: t('import.project.status.' + item.status) }, statusKind(item) ? { kind: statusKind(item) } : {}))))),
          wiz.busy ? h('dm-progress', { indeterminate: true, label: wiz.progress && wiz.progress.file ? t('import.project.importing', { file: wiz.progress.file }) : t('import.running') }) : null,
          wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null,
          !usable ? h('p', { class: 'dm-help dm-small', text: t('import.project.none') }) : null,
          h('div', { class: 'dm-row' },
            ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: restart }),
            ui.button({ label: t('import.project.create'), icon: 'map', variant: 'primary', loading: wiz.busy, disabled: !usable, onClick: createProjectMap })));
      }
      /** The chosen files of a collection, with their sizes. */
      function fileList() {
        const shown = wiz.files.slice(0, 40);
        const total = wiz.files.reduce((n, f) => n + f.size, 0);
        return h('div', { class: 'dm-stack-sm' },
          h('p', { class: 'dm-help', text: t('import.files.summary', { n: wiz.files.length, size: i18n.formatBytes(total) }) }),
          h('ul', { class: 'dm-list dm-import-files' }, shown.map((f) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(wiz.options.format === 'images' ? 'image' : 'file-text', 14), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: f.name }), h('span', { class: 'dm-list-sub', text: i18n.formatBytes(f.size) }))))),
          wiz.files.length > shown.length ? h('p', { class: 'dm-help dm-xs', text: t('import.files.more', { n: wiz.files.length - shown.length }) }) : null);
      }
      /** Progress of a collection import: file by file, and page by page inside a PDF. */
      function progressNode() {
        const p = wiz.progress;
        if (!p || p.total === undefined) return h('dm-progress', { indeterminate: true, label: t('import.running') });
        const pct = Math.round(((p.index || 0) + (p.pages ? Math.min(1, (p.page || 0) / p.pages) : 0)) / Math.max(1, p.total) * 100);
        const label = p.pages ? t('import.progress.pages', { file: p.file, page: p.page, pages: p.pages }) : t('import.progress.files', { done: (p.index || 0) + 1, total: p.total, file: p.file });
        return h('div', { class: 'dm-stack-sm' }, h('dm-progress', { value: String(pct), label }), h('p', { class: 'dm-help dm-small', text: label }));
      }

      /** A file chosen with the File System Access picker stays linked: the dataset can be read again from disk. */
      async function pickLinked() {
        try {
          const { handle, file } = await linked.pick();
          wiz.file = file; wiz.files = []; wiz.handle = handle; wiz.text = ''; wiz.options.format = ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined;
          await runPreview();
        } catch (err) { if (!err || err.name !== 'AbortError') { wiz.error = (err && err.message) || String(err); render(); } }
      }
      async function importPreset(preset) {
        wiz.busy = true; render();
        try {
          const meta = await services.importer.runPreset(preset);
          wiz.result = meta; wiz.step = 'done'; wiz.name = meta.name;
          shell.log(t('presets.done', { name: meta.name }), 'ok');
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      async function runPreview() {
        wiz.busy = true; wiz.error = ''; render();
        try {
          const opts = cleanOptions();
          wiz.preview = wiz.file ? await services.importer.preview(wiz.file, opts) : await services.importer.previewText(wiz.text, opts);
          wiz.options.format = wiz.preview.importer;
          if (wiz.preview.encoding && !wiz.options.encoding) wiz.options.encoding = wiz.preview.encoding;
          if (wiz.preview.sheet !== undefined) wiz.options.sheet = wiz.preview.sheet;
          if (wiz.options.header === undefined) wiz.options.header = wiz.preview.header;
          wiz.specs = wiz.preview.inferred.map((c) => Object.assign({}, c));
          if (!wiz.name) wiz.name = wiz.file ? services.importer.baseName(wiz.file.name) : t('import.paste.name');
          wiz.step = wiz.step === 'file' ? 'options' : wiz.step;
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function cleanOptions() {
        const o = Object.assign({}, wiz.options);
        if (!o.format) delete o.format;
        if (!o.encoding) delete o.encoding;
        if (!o.sheet) delete o.sheet;
        if (!o.path) delete o.path;
        if (!o.recordTag) delete o.recordTag;
        if (!o.table) delete o.table;
        if (!o.layer) delete o.layer;
        if (!o.simplify) delete o.simplify;
        if (!o.breaks) delete o.breaks;
        if (o.decimal === 'auto') delete o.decimal;
        return o;
      }

      function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(() => runPreview(), 250); }

      function stepOptions() {
        const p = wiz.preview;
        const left = h('div', { class: 'dm-stack' });
        if (wiz.file) left.appendChild(h('p', { class: 'dm-help', text: t('import.file', { name: wiz.file.name, size: i18n.formatBytes(wiz.file.size) }) }));
        const collection = COLLECTIONS.includes(wiz.options.format);
        const format = select(t('import.format'), FORMATS.map((f) => ({ value: f, label: t('import.format.' + f) })), wiz.options.format, (v) => { wiz.options.format = v; wiz.options.header = undefined; wiz.options.recordTag = ''; wiz.options.table = ''; schedulePreview(); });
        // Several files are always one collection, so the format is fixed then.
        if (wiz.file && wiz.files.length < 2) left.appendChild(format);
        if (wiz.files.length > 1) left.appendChild(fileList());
        if (wiz.options.format === 'csv' || wiz.options.format === 'fixed') {
          const encOptions = encoding.ENCODINGS.map((e) => ({ value: e.value, label: e.label + (p && p.encodingDetected && p.encodingDetected.encoding === e.value ? t('import.encoding.detected') : '') }));
          if (wiz.file) left.appendChild(select(t('import.encoding'), encOptions, wiz.options.encoding || 'utf-8', (v) => { wiz.options.encoding = v; schedulePreview(); }));
          if (wiz.options.format === 'csv') left.appendChild(select(t('import.delimiter'), csv.DELIMITERS.map((d) => ({ value: d.value, label: d.value === 'auto' ? t('import.delimiter.auto') + (p && p.delimiter ? ` (${describeDelimiter(p.delimiter)})` : '') : t(d.key) })), wiz.options.delimiter, (v) => { wiz.options.delimiter = v; schedulePreview(); }));
          else {
            const breaks = /** @type {any} */ (h('dm-input', { label: t('import.breaks'), help: t('import.breaks.help'), placeholder: p && p.breaksText ? p.breaksText : '0, 12, 20' }));
            breaks.value = wiz.options.breaks || '';
            breaks.addEventListener('change', () => { wiz.options.breaks = breaks.value; schedulePreview(); });
            left.appendChild(breaks);
          }
        }
        if (wiz.options.format === 'excel' && p && p.sheets) {
          left.appendChild(select(t('import.sheet'), p.sheets.map((s) => ({ value: s, label: s })), wiz.options.sheet || p.sheet, (v) => { wiz.options.sheet = v; wiz.options.header = undefined; schedulePreview(); }));
        }
        if (wiz.options.format === 'json') {
          const path = /** @type {any} */ (h('dm-input', { label: t('import.jsonpath'), placeholder: p && p.pathSuggestions && p.pathSuggestions.length ? p.pathSuggestions.join(', ') : 'data.items', value: wiz.options.path }));
          path.addEventListener('change', () => { wiz.options.path = path.value; schedulePreview(); });
          left.appendChild(path);
        }
        if (wiz.options.format === 'json' && p && p.jsonStat) left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.jsonstat') }));
        if (wiz.options.format === 'xml' && p && p.pathSuggestions && p.pathSuggestions.length) {
          left.appendChild(select(t('import.recordtag'), p.pathSuggestions.map((s) => ({ value: s, label: s })), wiz.options.recordTag || p.recordTag, (v) => { wiz.options.recordTag = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'sqlite' && p) {
          if (p.dataspatium) left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.sqlite.dataspatium') }));
          else if (p.tables && p.tables.length) left.appendChild(select(t('import.table'), p.tables.map((s) => ({ value: s, label: s })), wiz.options.table || p.table, (v) => { wiz.options.table = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'access' && p && p.tables && p.tables.length) {
          left.appendChild(select(t('import.table'), p.tables.map((s) => ({ value: s, label: s })), wiz.options.table || p.table, (v) => { wiz.options.table = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'tables' && p && p.tables && p.tables.length > 1) {
          left.appendChild(select(t('import.table'), p.tables.map((s) => ({ value: s, label: s })), wiz.options.table || p.table, (v) => { wiz.options.table = v; wiz.options.header = undefined; schedulePreview(); }));
        }
        if (wiz.options.format === 'geo' && p && p.layers && p.layers.length > 1) {
          left.appendChild(select(t('import.geo.layer'), p.layers.map((s) => ({ value: s, label: s })), wiz.options.layer || p.layer, (v) => { wiz.options.layer = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'shapefile' && p) {
          if (p.layers && p.layers.length > 1) left.appendChild(select(t('import.layer'), p.layers.map((s) => ({ value: s, label: s })), wiz.options.layer || p.layer, (v) => { wiz.options.layer = v; schedulePreview(); }));
          const simp = /** @type {any} */ (h('dm-input', { type: 'number', label: t('import.simplify'), help: t('import.simplify.help'), min: '0' }));
          simp.value = String(wiz.options.simplify || 0);
          simp.addEventListener('change', () => { wiz.options.simplify = Number(simp.value) || 0; schedulePreview(); });
          left.appendChild(simp);
          left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.shapefile.info', { crs: p.crs || t('import.shapefile.crs.unknown'), points: i18n.formatNumber(p.points || 0) }) }));
        }
        const viaR = !!(p && p.viaR);
        if (viaR) left.appendChild(h('p', { class: 'dm-help', text: t('import.r.hint', { pkg: p.pkg, reader: p.reader }) }));
        if (!NO_HEADER.includes(wiz.options.format)) {
          const header = /** @type {any} */ (h('dm-switch', { label: t('import.header') }));
          header.checked = !!wiz.options.header;
          header.addEventListener('change', () => { wiz.options.header = header.checked; schedulePreview(); });
          left.appendChild(header);
        }
        if (!TYPED.includes(wiz.options.format)) left.appendChild(select(t('import.decimal'), DECIMALS, wiz.options.decimal, (v) => { wiz.options.decimal = v; schedulePreview(); }));
        if (viaR || collection) {
          // No column step: R reads the file and dm_write() sets the types; documents and pictures have fixed columns.
          const name = /** @type {any} */ (h('dm-input', { label: t('import.name'), value: wiz.name }));
          name.addEventListener('input', () => { wiz.name = name.value; });
          left.appendChild(name);
          // SPSS, Stata and SAS keep their value labels as column metadata; the column holds labels or codes.
          if (viaR && /^(spss|stata|sas)/.test(p.format || '')) {
            left.appendChild(select(t('import.valuelabels'), [{ value: 'labels', label: t('import.valuelabels.labels') }, { value: 'codes', label: t('import.valuelabels.codes') }], wiz.options.valueLabels || 'labels', (v) => { wiz.options.valueLabels = v; }));
          }
          if (collection) left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.collection.hint.' + wiz.options.format) }));
          if (wiz.busy) left.appendChild(viaR ? h('dm-progress', { indeterminate: true, label: t('import.r.running') }) : progressNode());
        }
        if (wiz.error) left.appendChild(h('p', { class: 'dm-error dm-small', text: wiz.error }));
        left.appendChild(h('div', { class: 'dm-row' },
          ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: restart }),
          (viaR || collection) ? ui.button({ label: t('common.import'), icon: 'check', variant: 'primary', loading: wiz.busy, onClick: runImport })
            : ui.button({ label: t('common.next'), icon: 'chevron-right', variant: 'primary', disabled: !p || !p.columns.length || wiz.busy, onClick: () => { wiz.step = 'columns'; render(); } })));
        const right = h('div', { class: 'dm-table-wrap' },
          h('h3', { text: t('import.preview', { n: p ? p.dataRows.length : 0 }) }),
          p && p.columns.length ? previewTable(p) : h('p', { class: 'dm-help', text: wiz.busy ? t('common.loading') : viaR ? t('import.r.nopreview') : t('import.no.rows') }));
        return h('div', { class: 'dm-two-col' }, left, right);
      }

      function describeDelimiter(d) { return d === ';' ? t('import.delimiter.semicolon') : d === ',' ? t('import.delimiter.comma') : d === '\t' ? t('import.delimiter.tab') : d === '|' ? t('import.delimiter.pipe') : JSON.stringify(d); }

      function previewTable(p) {
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-preview' }));
        const rows = p.dataRows.map((r) => r.map((v) => (v instanceof Date ? types.parseDateTime(v) : v)));
        requestAnimationFrame(() => table.setData({
          columns: p.columns.map((name, i) => ({ key: name, label: name, type: p.inferred && p.inferred[i] ? p.inferred[i].type : 'text' })),
          rowCount: rows.length,
          rowProvider: async (start, count) => rows.slice(start, start + count),
        }));
        return table;
      }

      function select(label, options, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = options; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }

      function stepColumns() {
        const name = /** @type {any} */ (h('dm-input', { label: t('import.name'), value: wiz.name }));
        name.addEventListener('input', () => { wiz.name = name.value; });
        const rows = wiz.specs.map((spec, i) => {
          const include = /** @type {any} */ (h('dm-switch', { label: '' }));
          include.checked = spec.include !== false;
          include.addEventListener('change', () => { spec.include = include.checked; });
          const nameIn = /** @type {any} */ (h('dm-input', { value: spec.name, 'aria-label': t('common.name') }));
          nameIn.addEventListener('change', () => { spec.name = nameIn.value.trim() || spec.name; spec.label = spec.name; });
          const typeSel = select('', types.TYPES.map((ty) => ({ value: ty, label: t('type.' + ty) })), spec.type, (v) => { spec.type = v; });
          typeSel.setAttribute('aria-label', t('common.type'));
          const sample = (wiz.preview.dataRows.slice(0, 3).map((r) => r[i]).filter((v) => v !== null && v !== undefined && String(v) !== '').map(String).join(', ')).slice(0, 60);
          return h('tr', null, h('td', null, include), h('td', null, nameIn), h('td', null, typeSel), h('td', { class: 'dm-muted dm-small', text: sample }), h('td', { class: 'dm-faint dm-xs', text: spec.reason === 'leading-zero' ? t('import.reason.leading') : '' }));
        });
        const importBtn = ui.button({ label: t('common.import'), icon: 'check', variant: 'primary', loading: wiz.busy, onClick: runImport });
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-form-grid' }, name),
          h('p', { class: 'dm-help', text: t('import.columns.help') }),
          h('table', { class: 'dm-columns-table' }, h('thead', null, h('tr', null, h('th', { text: t('import.column.include') }), h('th', { text: t('common.name') }), h('th', { text: t('common.type') }), h('th', { text: t('import.column.sample') }), h('th'))), h('tbody', null, rows)),
          wiz.busy ? h('dm-progress', { indeterminate: true, label: wiz.progress ? t('import.progress', { rows: i18n.formatNumber(wiz.progress.rows) }) : t('import.running') }) : null,
          wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null,
          h('div', { class: 'dm-row' }, ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: () => { wiz.step = 'options'; render(); } }), importBtn));
      }

      async function runImport() {
        if (wiz.busy) return;
        wiz.busy = true; wiz.error = ''; wiz.progress = null; render();
        const t0 = performance.now();
        try {
          const opts = cleanOptions();
          if (wiz.handle) opts.linked = true;
          const specs = wiz.specs.map((s) => ({ name: s.name, type: s.type, include: s.include !== false, decimal: s.decimal, label: s.label || s.name }));
          // Large delimited files are streamed; the progress callback shows the rows read so far.
          const onProgress = (p) => { wiz.progress = p; render(); };
          const meta = wiz.files.length > 1 ? await services.importer.runFiles(wiz.files, opts, wiz.name, onProgress)
            : wiz.file ? await services.importer.run(wiz.file, opts, specs, wiz.name, onProgress) : await services.importer.runText(wiz.text, opts, specs, wiz.name);
          if (wiz.handle) await linked.link(meta.id, wiz.handle);
          wiz.result = meta; wiz.step = 'done';
          shell.log(t('import.done', { name: meta.name, rows: i18n.formatNumber(meta.rowCount), cols: meta.columnCount }) + ` (${Math.round(performance.now() - t0)} ms)`, 'ok');
          ui.toast.show(t('import.done', { name: meta.name, rows: i18n.formatNumber(meta.rowCount), cols: meta.columnCount }), { kind: 'ok' });
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function stepDone() {
        const m = wiz.result;
        return h('div', { class: 'dm-success' },
          h('h2', null, ui.icon('circle-check', 20), ' ', t('import.done', { name: m.name, rows: i18n.formatNumber(m.rowCount), cols: m.columnCount })),
          h('div', { class: 'dm-row' },
            ui.button({ label: t('import.open.bearbeta'), variant: 'primary', icon: 'pencil', onClick: () => { store.set({ selectedId: m.id }); shell.activate('bearbeta'); } }),
            ui.button({ label: t('import.another'), icon: 'plus', onClick: restart })));
      }

      // ---- right ----
      function renderRight() {
        if (source.startsWith('api:')) { if (apiUi) apiUi.renderRight(slots.right); else replace(slots.right); return; }
        if (source === 'saved') { replace(slots.right, h('h4', { text: t('api.saved.title') }), h('p', { class: 'dm-help', text: t('api.saved.help') })); return; }
        if (source === 'bridge') { replace(slots.right, h('h4', { text: t('bridge.title') }), h('p', { class: 'dm-help', text: t('bridge.help') })); return; }
        const items = [];
        if (wiz.project) {
          const p = wiz.project;
          items.push(h('h4', { text: t('import.project.title') }));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.name'), value: p.file.name },
            p.project.title ? { label: t('document.title'), value: p.project.title } : null,
            p.project.version ? { label: t('import.project.version'), value: p.project.version } : null,
            p.project.crs ? { label: t('import.project.crs'), value: p.project.crs } : null,
            { label: t('map.layers'), value: `${p.plan.filter((i) => i.status === 'matched' || i.status === 'import').length} / ${p.plan.length}` },
          ].filter(Boolean);
          items.push(kv, h('p', { class: 'dm-help', text: t('import.project.help') }));
          replace(slots.right, items);
          return;
        }
        if (wiz.files.length > 1) {
          items.push(h('h4', { text: t('import.step.file') }));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('import.files.count'), value: i18n.formatNumber(wiz.files.length) },
            { label: t('common.size'), value: i18n.formatBytes(wiz.files.reduce((n, f) => n + f.size, 0)) },
            { label: t('import.format'), value: t('import.format.' + wiz.options.format + '.short') },
          ];
          items.push(kv);
        } else if (wiz.file) {
          items.push(h('h4', { text: t('import.step.file') }));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.name'), value: wiz.file.name },
            { label: t('common.size'), value: i18n.formatBytes(wiz.file.size) },
            { label: t('common.type'), value: wiz.file.type || wiz.file.name.split('.').pop() },
            { label: t('common.updated'), value: wiz.file.lastModified ? i18n.formatDateTime(new Date(wiz.file.lastModified)) : '' },
          ];
          items.push(kv);
        }
        if (wiz.preview) {
          items.push(h('h4', { text: t('import.step.options') }));
          const kv2 = /** @type {any} */ (h('dm-kv'));
          const p = wiz.preview;
          kv2.items = [
            { label: t('import.format'), value: p.importer },
            p.reader ? { label: t('import.r.reader'), value: `${p.reader} (${p.pkg})` } : null,
            p.encoding ? { label: t('import.encoding'), value: p.encoding + (p.encodingDetected ? ` (${p.encodingDetected.confidence})` : '') } : null,
            p.delimiter ? { label: t('import.delimiter'), value: describeDelimiter(p.delimiter) } : null,
            { label: t('datasets.columns'), value: String(p.columns.length) },
            p.totalRows !== undefined ? { label: t('datasets.rows'), value: i18n.formatNumber(p.totalRows) } : null,
            // A document: pages, words, title and author of the first file.
            p.document ? { label: t('document.pages'), value: i18n.formatNumber(p.document.pages || 1) } : null,
            p.document && p.document.words !== undefined ? { label: t('document.words'), value: i18n.formatNumber(p.document.words) } : null,
            p.document && p.document.title ? { label: t('document.title'), value: p.document.title } : null,
            p.document && p.document.author ? { label: t('document.author'), value: p.document.author } : null,
          ].filter(Boolean);
          items.push(kv2);
        }
        if (!items.length) items.push(h('p', { class: 'dm-help', text: t('mode.inhamta.desc') }));
        replace(slots.right, items);
      }

      return { id: 'inhamta', activate, deactivate, get bridgeView() { return bridgeUi; } };
    }
    return { createMode };
  });
})();
