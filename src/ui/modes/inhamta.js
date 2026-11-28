// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Inhämta": import wizard for files and pasted text (steps: file, options with preview, columns,
 * done) and open APIs (connector presets and imported configurations, see src/ui/api/api-view.js).
 *
 * The left column is a tree of groups of sources (B-81, ui/tree in the simple mode), folded per browser; everything a source
 * shows, also the forms that add a source, is drawn in the workspace (F126 a). A source is a post in GROUPS: its id is the
 * deep link #/inhamta/<id> and its command in the palette.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/inhamta', ['ui/base', 'data/encoding', 'data/types', 'api/connectors', 'api/bridge', 'data/linked', 'data/kinds', 'viz/leaflet', 'ui/kinds/sketches', 'platform/tier', 'ui/settings/tier', 'ui/tree', 'ui/import/source-forms', 'ui/field/mobile-source'], (base, encoding, types, connectors, bridge, linked, kinds, leaflet, sketches, tier, tierUi, treeMod, sourceForms, mobileSource) => {
    const { h, t, i18n, replace } = base;
    const STEPS = [{ id: 'file', label: t('import.step.file') }, { id: 'options', label: t('import.step.options') }, { id: 'columns', label: t('import.step.columns') }, { id: 'done', label: t('import.step.done') }];
    const DECIMALS = [{ value: 'auto', label: t('import.decimal.auto') }, { value: 'comma', label: t('import.decimal.comma') }, { value: 'point', label: t('import.decimal.point') }];
    const FORMATS = ['csv', 'fixed', 'excel', 'tables', 'json', 'xml', 'sqlite', 'access', 'shapefile', 'geo', 'raster', 'detaljplan', 'planarchive', 'opdelivery', 'graph', 'model', 'bcf', 'datapackage', 'r', 'documents', 'images'];
    /** Formats without a header-row switch (structure carries the names). */
    const NO_HEADER = ['json', 'xml', 'sqlite', 'access', 'shapefile', 'geo', 'raster', 'detaljplan', 'planarchive', 'opdelivery', 'graph', 'model', 'datapackage', 'r', 'documents', 'images'];
    /** Formats whose values are already typed (no decimal-separator choice). */
    const TYPED = ['sqlite', 'access', 'shapefile', 'raster', 'detaljplan', 'planarchive', 'opdelivery', 'graph', 'model', 'datapackage', 'r', 'documents', 'images'];
    /** Formats with fixed columns where one or many files become one dataset (no column step): documents, rasters and pictures. */
    const COLLECTIONS = ['documents', 'raster', 'images'];
    /** What the file picker offers: every extension an importer reads by the file's name (tests/io.test.js keeps them together). */
    const ACCEPT = '.bcf,.bcfzip,.csv,.tsv,.txt,.tab,.dat,.fwf,.prn,.xlsx,.xlsm,.xls,.xlsb,.ods,.fods,.dbf,.slk,.sylk,.dif,.wk1,.wk3,.wk4,.wks,.wq1,.wq2,.wb1,.wb2,.wb3,.qpw,'
      + '.html,.htm,.xhtml,.md,.markdown,.docx,.tex,.json,.ndjson,.jsonl,.geojson,.topojson,.kml,.kmz,.gpx,.xml,.sqlite,.sqlite3,.db,.s3db,.gpkg,.sql,'
      + '.shp,.zip,.sav,.zsav,.por,.dta,.sas7bdat,.xpt,.px,.rds,.rda,.RData,.parquet,.mdb,.accdb,'
      + '.pdf,.odt,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.tif,.tiff,.gtiff,.qgs,.qgz,.graphml,.gexf,.cypher,.cql,.cyp,.ifc,.ifczip,.dxf';
    /**
     * The left column, group by group in this order (B-81): each source has an id (the deep link #/inhamta/<id>), an icon, its
     * name and the line under it (keys, or a function), and the tier's feature that shows it. Tillagda källor lists what the
     * person has added. A new source is one more post here and a branch in renderCenter.
     */
    const GROUPS = [
      { id: 'create', label: 'import.sources.create', items: [
        { id: 'newmodel', icon: 'box', label: 'import.sources.newmodel', sub: 'import.sources.newmodel.hint', feature: 'source:newmodel' },
        { id: 'newplan', icon: 'layers', label: 'import.sources.newplan', sub: 'import.sources.newplan.hint' }] },
      { id: 'common', label: 'import.sources.common', items: [
        { id: 'file', icon: 'folder-open', label: 'import.sources.files', sub: 'import.sources.files.hint' },
        { id: 'paste', icon: 'clipboard-paste', label: 'import.sources.paste', sub: 'import.sources.paste.hint' },
        { id: 'url', icon: 'link', label: 'import.sources.url', sub: 'import.sources.url.hint' },
        { id: 'opencde', icon: 'building-2', label: 'families.opencde.add', sub: 'families.opencde.add.hint' },
        { id: 'mobile', icon: 'smartphone', label: 'import.sources.mobile', sub: 'import.sources.mobile.hint' }] },
      { id: 'databases', label: 'import.sources.databases', items: [
        { id: 'database', icon: 'database', label: 'families.add.short', sub: 'import.sources.database.hint' },
        { id: 'bridge', icon: 'hard-drive', label: 'bridge.title', sub: 'bridge.hint' },
        { id: 'neo4j', icon: 'share-2', label: 'families.neo4j.add', sub: 'families.neo4j.add.hint' }] },
      { id: 'apis', label: 'import.sources.apis', items: [
        { id: 'catalog', icon: 'globe', label: 'api.sources', sub: 'api.catalog.hint' },
        { id: 'apifile', icon: 'file-json', label: 'api.add.file.short', sub: 'import.sources.api.hint' }] },
      { id: 'geodata', label: 'import.sources.geodata', items: [
        { id: 'geodata', icon: 'map', label: 'geodata.add.short', sub: 'geodata.add.hint', feature: 'source:geodata' },
        { id: 'boundaries', icon: 'grid-2x2', label: 'presets.geo.label', sub: 'import.sources.boundaries.hint' }] },
      { id: 'added', label: 'import.sources.added', items: [] },
      { id: 'other', label: 'import.sources.other', items: [
        { id: 'saved', icon: 'refresh-cw', label: 'api.saved.title', sub: 'api.saved.hint' },
        { id: 'examples', icon: 'sparkles', label: 'examples.title', sub: 'examples.hint' },
        { id: 'guides', icon: 'graduation-cap', label: 'guides.title', sub: 'guides.hint' }] },
    ];
    /** Deep links to sources that moved: Insamling i fält is a part of Mobilen, Databaskälla is Extern databas. */
    const MOVED = { field: 'mobile', family: 'database' };
    /** The sources whose form adds a source of a family (ui/api/family-dialog), with the form's options and its lead. */
    const FAMILY_FORMS = {
      database: { options: { group: 'databases' }, lead: 'families.database.lead' },
      opencde: { options: { family: 'opencde' }, lead: 'families.opencde.add.hint' },
      neo4j: { options: { family: 'neo4j' }, lead: 'families.neo4j.add.hint' },
      geodata: { options: { group: 'geodata' }, lead: 'geodata.add.hint' },
    };
    /** Under this key the tree keeps which groups are folded, per browser (ui/tree memory). */
    const GROUPS_KEY = 'inhamta.groups';
    /** @param {string} id */
    const itemOf = (id) => { for (const g of GROUPS) { const it = g.items.find((x) => x.id === id); if (it) return it; } return null; };

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null;
      let source = 'file';
      const wiz = reset();
      let previewTimer = 0;
      let connectorList = [];
      /** @type {(() => void)|null} */ let unsubBridge = null;
      let unsubConnectors = null;
      /** @type {any} */ let apiUi = null;
      let apiId = null;
      /** @type {any} */ let bridgeUi = null;
      /** @type {any} */ let guidesUi = null;
      /** Mobilen (ui/field/mobile-source), kept while it is the source. @type {any} */ let mobileUi = null;
      /** Exempeldata (ui/import/source-forms). @type {any} */ let examplesUi = null;
      /** The form in the workspace that adds a source: {id, el, title}, built once per opening. @type {any} */ let formUi = null;
      /** What a deep link asks of the next form: {id, values, after(connector)}. @type {any} */ let formWanted = null;
      /** The tree of the left column (ui/tree), kept while the mode is active. @type {any} */ let leftTree = null;
      /** The importers' modules, set once the group 'import' has loaded (importersReady). @type {any} */
      let csv = null; /** @type {any} */ let qgis = null; /** @type {any} */ let fileSense = null;

      /**
       * `hidden`: the entry of a file the tier does not read (platform/tier), shown as the tier's notice in place of an error;
       * `refused`: the files of a raster that its preview passed over, with their words ({file, message}); the import leaves them out.
       */
      function reset() { return { step: 'file', answers: {}, sorted: null, results: null, file: null, files: [], progress: null, project: null, handle: null, text: '', url: '', options: { format: '', encoding: '', delimiter: 'auto', header: undefined, sheet: '', path: '', decimal: 'auto', recordTag: '', table: '', layer: '', simplify: 0, breaks: '' }, preview: null, specs: [], name: '', busy: false, result: null, error: '', hidden: '', refused: [] }; }
      /** What went wrong with the file chosen: the tier's notice for a file the tier does not read, else the error. */
      const problem = () => (wiz.hidden ? tierUi.notice(ctx, wiz.hidden) : wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null);
      function restart() { freeThumbs(); Object.assign(wiz, reset()); render(); }
      /** Pictures chosen but not yet read, shown from the files themselves. @type {Map<File, string>} */
      const thumbs = new Map();
      function thumbOf(file) {
        if (!thumbs.has(file)) thumbs.set(file, URL.createObjectURL(file));
        return thumbs.get(file);
      }
      function freeThumbs() { for (const url of thumbs.values()) URL.revokeObjectURL(url); thumbs.clear(); }
      /**
       * The importers load with the groups plan and import (src/boot.js), as services.importer.ready() loads them: Inhämta waits
       * for them before it reads a file, a text, an address or an example. False, with the shell's notice, when they could not load.
       * @returns {Promise<boolean>}
       */
      async function importersReady() {
        if (csv) return true;
        const waiting = !D.groups.loaded('import');
        if (waiting) { wiz.busy = true; render(); }
        try {
          await D.ensure(['import'], () => { csv = D.require('io/importers/csv'); qgis = D.require('io/importers/qgis'); fileSense = D.require('io/file-sense'); });
          return true;
        } catch (err) { shell.partFailed(err); return false; } finally { if (waiting) { wiz.busy = false; if (!csv) render(); } }
      }

      let unsubStore = null;
      function activate(s) {
        slots = s;
        unsubConnectors = connectors.subscribe(reloadConnectors);
        unsubBridge = bridge.subscribe(() => { reloadConnectors(); });
        // The saved fetches follow the datasets (count in the source list, rows and times in the view).
        unsubStore = store.subscribe((state, changed) => {
          if (changed.includes('pendingSource') && state.pendingSource && slots) { consumePendingSource(state); return; }
          if (changed.includes('pendingImportSource') && state.pendingImportSource && slots) { consumeRoute(state); return; }
          if (!changed.includes('datasets') || !slots) return;
          renderLeft();
          if (source === 'saved') renderSaved();
          if (source === 'examples' && examplesUi) examplesUi.render(slots.center);
        });
        if (store.get().pendingImportSource) consumeRoute(store.get());
        if (store.get().pendingSource) consumePendingSource(store.get());
        reloadConnectors();
        render();
        services.importer.loadAhead();
      }
      function deactivate() {
        slots = null;
        freeThumbs();
        if (unsubConnectors) unsubConnectors();
        if (unsubBridge) { unsubBridge(); unsubBridge = null; }
        if (unsubStore) { unsubStore(); unsubStore = null; }
        if (apiUi) { apiUi.destroy(); apiUi = null; apiId = null; }
        if (bridgeUi) { bridgeUi.destroy(); bridgeUi = null; }
        if (guidesUi) { guidesUi.destroy(); guidesUi = null; }
        if (mobileUi) { mobileUi.destroy(); mobileUi = null; }
        if (examplesUi) { examplesUi.destroy(); examplesUi = null; }
        if (leftTree) { leftTree.destroy(); leftTree = null; }
        formUi = null;
      }
      /** The tab Mobilen opens at next, when a deep link names Insamling i fält. */
      let mobileTab = '';
      /**
       * A source asked for by its id: a deep link (#/inhamta/<id>, through the store), a command in the palette, or a link.
       * @param {string} id @returns {boolean} false when there is no such source, or the tier hides it
       */
      function openSource(id) {
        const wanted = MOVED[id] || id;
        if (!itemOf(wanted) || !shownItem(itemOf(wanted))) return false;
        if (id === 'field') mobileTab = 'field';
        if (store.get().mode !== 'inhamta' || !slots) { source = wanted; shell.activate('inhamta'); return true; }
        choose(wanted);
        return true;
      }
      function consumeRoute(state) {
        const id = String(state.pendingImportSource || '');
        store.set({ pendingImportSource: null });
        openSource(id);
      }
      /** The presets the user has added; the other presets wait in the catalogue of open APIs. */
      let addedPresets = new Set();
      /** Databases opened through the bridge, remembered without secrets. */
      let bridgeSources = [];
      async function reloadConnectors() {
        connectorList = await connectors.list();
        addedPresets = await connectors.added();
        try { bridgeSources = await bridge.remembered(); } catch (_e) { bridgeSources = []; }
        if (slots) renderLeft();
      }
      const isAddedConnector = (c) => !c.preset || addedPresets.has(c.id);
      // The sources of a family or a preset the tier hides (platform/tier) are kept and left out of the lists.
      const addedConnectors = () => connectorList.filter((c) => isAddedConnector(c) && tier.showsConnector(c));
      const catalogueConnectors = () => connectorList.filter((c) => c.preset && !addedPresets.has(c.id) && tier.showsConnector(c));

      function render() {
        if (!slots) return;
        // A source the tier now hides (after the tier was lowered) gives way to the files.
        const hiddenApi = source.startsWith('api:') && connectorList.some((c) => c.id === source.slice(4) && !tier.showsConnector(c));
        const item = itemOf(source);
        if (hiddenApi || (item && !shownItem(item))) source = 'file';
        // A file the tier did not read: once the tier is raised the notice goes, with the refusal it stood for, and the file can be
        // chosen again.
        if (wiz.hidden && tier.shows(wiz.hidden)) { wiz.hidden = ''; wiz.error = ''; }
        if (wiz.project && !tier.shows('import:qgis')) { wiz.project = null; wiz.step = 'file'; wiz.hidden = 'import:qgis'; }
        renderLeft(); renderCenter(); renderRight();
      }

      // ---- left: the groups of sources, a tree in the simple mode (B-81) ----
      /** @param {any} item a post of GROUPS */
      const shownItem = (item) => !item.feature || tier.shows(item.feature);
      /** The line under a source's name. @param {any} item */
      const subOf = (item) => (item.id === 'saved' ? t(item.sub, { n: apiDatasets().length }) : t(item.sub));
      function sourceNode(item) {
        const id = item.id;
        return { id, label: t(item.label), sub: subOf(item), icon: item.icon, mainAttrs: { 'data-source': id, 'data-course': id === 'examples' ? 'example' : null, onpointerenter: () => loadAhead(id), onfocus: () => loadAhead(id) } };
      }
      /** An added source, with a button at the end of its row that takes it out of the list. */
      function addedNode(id, icon, label, sub, onRemove) {
        return {
          id, label, sub, icon, rowAttrs: { 'data-added': id }, mainAttrs: { 'data-source': id, onpointerenter: () => loadAhead(id), onfocus: () => loadAhead(id) },
          trailing: ui.button({ label: t('common.delete'), icon: 'x', size: 'sm', 'icon-only': true, variant: 'ghost', title: t('import.sources.remove.hint'), 'data-remove-source': id, onClick: onRemove }),
        };
      }
      function addedNodes() {
        const list = bridgeSources.map((b, i) => addedNode('bridge:' + i, 'database', b.label, t('bridge.added.sub'), () => forgetBridge(b)))
          .concat(addedConnectors().map((c) => addedNode('api:' + c.id, connectorIcon(c), c.name, connectorSub(c), () => removeConnector(c))));
        return list.length ? list : [{ id: 'added:none', label: t('import.sources.added.none'), icon: 'info', mainClass: 'dm-tree-note', mainAttrs: { 'data-added-sources': 'empty' } }];
      }
      /** The tree's nodes: a group per post of GROUPS with the sources the tier shows; a group without any is left out. */
      function leftNodes() {
        const nodes = [];
        for (const g of GROUPS) {
          const children = g.id === 'added' ? addedNodes() : g.items.filter(shownItem).map(sourceNode);
          if (children.length) nodes.push({ id: 'group:' + g.id, label: t(g.label), icon: false, mainClass: 'dm-tree-heading', mainAttrs: { 'data-source-group': g.id }, children });
        }
        return nodes;
      }
      function renderLeft() {
        if (!slots) return;
        const nodes = leftNodes();
        if (!leftTree) {
          leftTree = treeMod.create({ label: t('import.sources'), simple: true, memory: GROUPS_KEY, nodes, activeId: source, onActivate: activateNode });
          leftTree.el.classList.add('dm-source-tree');
        } else leftTree.update({ nodes, activeId: source });
        if (leftTree.el.parentNode !== slots.left) replace(slots.left, leftTree.el);
      }
      /** A tap on a group folds it; one on a source opens it (and closes the column when it is a sheet). */
      function activateNode(node) {
        if (node.id.startsWith('group:')) return false;
        if (node.id === 'added:none') return true;
        choose(node.id);
        if (slots) slots.left.dispatchEvent(new CustomEvent('dm-choose', { bubbles: true }));
        return true;
      }
      /** @param {string} id */
      function choose(id) {
        source = id;
        if (!id.startsWith('api:') && wiz.step !== 'file') restart(); else render();
      }

      /** A preset goes back to the catalogue; a source of the user's own is deleted with its keys. */
      async function removeConnector(c) {
        const preset = !!c.preset;
        const ok = await ui.dialog.confirm(t(preset ? 'import.sources.remove.preset.confirm' : 'import.sources.remove.confirm', { name: c.name }), { okLabel: t('common.delete'), danger: !preset });
        if (!ok) return;
        if (preset) await connectors.setAdded(c.id, false);
        else { await connectors.remove(c.id); await D.require('api/secrets').forget(c.id); }
        if (source === 'api:' + c.id) { if (apiUi) { apiUi.destroy(); apiUi = null; apiId = null; } source = preset ? 'catalog' : 'file'; }
        shell.log(t('import.sources.removed', { name: c.name }), 'ok');
        await reloadConnectors(); render();
      }
      /** A remembered bridge database is forgotten; the datasets fetched from it stay. */
      async function forgetBridge(b) {
        if (!(await ui.dialog.confirm(t('bridge.forget.confirm', { name: b.label }), { okLabel: t('common.delete') }))) return;
        await bridge.forget(b.label);
        if (source.startsWith('bridge:')) source = 'bridge';
        shell.log(t('import.sources.removed', { name: b.label }), 'ok');
        await reloadConnectors(); render();
      }
      /** A preset from the catalogue of open APIs becomes an added source and opens. */
      async function addPreset(c) {
        await connectors.setAdded(c.id, true);
        shell.log(t('api.added', { name: c.name }), 'ok');
        await reloadConnectors();
        source = 'api:' + c.id; render();
      }

      // ---- the catalogue of open APIs, in the workspace: country chips, a search, and Lägg till per preset ----
      let catalogFilter = '';
      function renderCatalog() {
        const listEl = h('div', { class: 'dm-list dm-catalog', 'data-api-catalog': '' });
        const draw = () => {
          const q = catalogFilter.trim().toLowerCase();
          const list = catalogueConnectors().filter((c) => !countryFilter || !c.country || countryFilter.has(c.country)).filter((c) => !q || [c.name, c.publisher, c.description].join(' ').toLowerCase().includes(q));
          replace(listEl, list.length ? list.map((c) => h('div', { class: 'dm-list-row', 'data-catalog': c.id },
            h('div', { class: 'dm-list-item dm-list-item-static' }, ui.icon(connectorIcon(c), 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.name }), h('span', { class: 'dm-list-sub dm-truncate', text: connectorSub(c) }))),
            ui.button({ label: t('api.catalog.add'), icon: 'plus', size: 'sm', 'data-catalog-add': c.id, onClick: () => addPreset(c) }))) : h('p', { class: 'dm-help', text: t('api.catalog.none') }));
        };
        const search = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('api.catalog.search'), 'aria-label': t('api.catalog.search'), inline: true }));
        search.value = catalogFilter;
        search.addEventListener('input', () => { catalogFilter = search.value; draw(); });
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('globe', 20), t('api.sources'))),
          h('p', { class: 'dm-help', text: t('api.catalog.hint') }),
          h('div', { class: 'dm-row-wrap' }, search, renderCountryChips()),
          listEl);
        draw();
      }
      /** The line under a source's name: where it comes from, or at least its address. */
      function connectorSub(c) {
        const reason = D.require('api/reach').blocked(c);
        const parts = [c.country ? t('country.' + c.country) : '', c.publisher, c.level === 2 ? t('api.level2') : '', reason ? D.require('api/reach').label(reason) : ''].filter(Boolean);
        if (parts.length) return parts.join(' · ');
        try { return new URL(c.baseUrl).host || c.baseUrl; } catch (_err) { return c.baseUrl || c.name; }
      }
      /** The same mark for the same kind of source, wherever it came from. */
      function connectorIcon(c) {
        const type = c.family && c.family.type;
        if (type === 'geodata' || type === 'geoportal') return 'map';
        if (type === 'neo4j') return 'share-2';
        if (type === 'opencde') return 'building-2';
        return connectors.isDatabase(c) ? 'database' : 'globe';
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
        renderCenter();
      }
      function renderCountryChips() {
        const all = availableCountries();
        if (all.length < 2) return null;
        const chip = (label, pressed, onclick) => h('button', { type: 'button', class: 'dm-chip', 'aria-pressed': pressed ? 'true' : 'false', onclick }, label);
        return h('div', { class: 'dm-chips', role: 'group', 'aria-label': t('api.countries'), title: t('api.countries.hint') },
          chip(t('api.countries.all'), !countryFilter, () => { countryFilter = null; saveCountryFilter(); renderCenter(); }),
          all.map((code) => chip(t('country.' + code), !countryFilter || countryFilter.has(code), () => toggleCountry(code))));
      }
      /**
       * The scripts a source's view needs, loaded ahead when the pointer or the focus reaches its item: the views of the sources
       * (the group 'sources', with the families it needs) for an API source, the forms that add one, the bridge and the guides, the
       * families for the saved fetches, the group plan for a new plan and the group dela (the panel for devices) for Mobilen
       * (src/boot.js). Loading them asks nothing and sends nothing to a source.
       * @param {string} id
       */
      function loadAhead(id) {
        const sources = id.startsWith('api:') || id.startsWith('bridge') || id === 'guides' || !!FAMILY_FORMS[id];
        const wanted = sources ? D.ensure(['sources']) : id === 'saved' ? D.ensure(['families']) : id === 'newplan' ? D.ensure(['plan']) : id === 'mobile' ? D.ensure(['dela']) : null;
        if (wanted) wanted.catch((err) => D.log('inhamta', 'load ahead', id, err));
      }

      // ---- centre ----
      function renderCenter() {
        // What a source keeps while it is shown goes when another one is chosen.
        if (source !== 'mobile' && mobileUi) { mobileUi.destroy(); mobileUi = null; }
        if (source !== 'examples' && examplesUi) { examplesUi.destroy(); examplesUi = null; }
        if (formUi && formUi.id !== source) formUi = null;
        if (source === 'catalog') { renderCatalog(); return; }
        if (source.startsWith('bridge:')) { renderBridge(bridgeSources[Number(source.slice(7))]); return; }
        if (source.startsWith('api:')) { renderApi(); return; }
        if (source === 'saved') { renderSaved(); return; }
        if (source === 'bridge') { renderBridge(); return; }
        if (source === 'mobile') { renderMobile(); return; }
        if (source === 'guides') { renderGuides(); return; }
        if (source === 'newmodel') { renderNewModel(); return; }
        if (source === 'newplan') { renderNewPlan(); return; }
        if (source === 'examples') { renderExamples(); return; }
        if (source === 'boundaries' || source === 'apifile' || FAMILY_FORMS[source]) { renderForm(); return; }
        const stepper = /** @type {any} */ (h('dm-stepper'));
        stepper.steps = STEPS; stepper.active = wiz.step === 'sort' ? 'options' : wiz.step;
        const body = wiz.project ? stepProject() : wiz.step === 'file' ? stepFile() : wiz.step === 'sort' ? stepSort() : wiz.step === 'options' ? stepOptions() : wiz.step === 'columns' ? stepColumns() : stepDone();
        replace(slots.center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('download', 20), t('import.title')), stepper), body);
      }

      // ---- saved fetches: every dataset from an API, updated with one click; those whose source the tier hides are left out ----
      const apiDatasets = () => store.get().datasets.filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge') && !connectors.hiddenBy(d.source, connectorList.find((c) => c.id === d.source.connectorId)));
      /** api/runner, which updates them; it loads with the group 'families' (src/boot.js) on the first update. */
      const runnerOf = () => D.ensure(['families'], () => D.require('api/runner'));
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
          const res = await (await runnerOf()).refreshDataset(d.id);
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
          const results = await (await runnerOf()).refreshAll();
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
        if (!sourcesReady()) return;
        if (!apiUi || apiId !== id) {
          if (apiUi) apiUi.destroy();
          apiId = id;
          apiUi = D.require('ui/api/api-view').create(ctx, connector, {
            onDataset: () => {},
            onRemoved: () => { apiUi = null; apiId = null; source = 'file'; reloadConnectors().then(render); },
            // A geodata source added from a catalogue search opens in place of the search.
            onConnector: (c) => openConnector(c),
          });
          apiUi.start();
        }
        replace(slots.center, apiUi.el);
      }

      /**
       * The views of the sources are a group of scripts (src/boot.js, 'sources'): true when it is loaded; otherwise the
       * workspace says that it is loading, and the centre is drawn again once it has, unless another source was chosen.
       */
      function sourcesReady() { return groupReady('sources', () => D.ensure(['sources'])); }
      /** Like sourcesReady, for the group `name` that `load` loads. @param {string} name @param {() => Promise<any>} load */
      function groupReady(name, load) {
        if (D.groups.loaded(name)) return true;
        const wanted = source;
        replace(slots.center, h('p', { class: 'dm-help', text: t('common.loading') }));
        load().then(() => { if (slots && source === wanted) renderCenter(); }, (err) => shell.partFailed(err));
        return false;
      }
      /**
       * A server handed over by a deep link (#/inhamta/opencde?server=…&project=…&document=…&version=…) or by a model's IFC graph: a
       * server the workspace already has as a source opens directly, a new one opens the source's form with the address filled in.
       * A named project and document wait in the store for the source's view (ui/api/opencde-view), which chooses and fetches them.
       */
      async function consumePendingSource(state) {
        const p = state.pendingSource;
        store.set({ pendingSource: null });
        if (!p || !p.baseUrl) return;
        const family = p.family || 'opencde';
        const same = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
        const known = (await connectors.list()).find((c) => c.family && c.family.type === family && same(c.baseUrl) === same(p.baseUrl));
        const then = (connector) => {
          if (p.projectId || p.documentId) store.set({ pendingCde: { connectorId: connector.id, projectId: p.projectId || null, documentId: p.documentId || null, versionIndex: p.versionIndex == null ? null : p.versionIndex, at: Date.now() } });
        };
        if (known) { then(known); await openConnector(known); return; }
        const id = FAMILY_FORMS[family] ? family : 'database';
        formWanted = { id, values: { baseUrl: p.baseUrl }, family, after: then };
        formUi = null;
        if (slots) choose(id); else source = id;
      }
      /** Show a connector that was just created or added. */
      async function openConnector(connector) {
        await reloadConnectors();
        source = 'api:' + connector.id;
        render();
      }

      // ---- the forms that add a source, in the workspace with their help (F126 a) ----
      /**
       * The form of the source chosen, built once per opening: Extern databas, OpenCDE, Neo4j and Geodatakälla (ui/api/family-dialog
       * in the group 'sources'), API från fil and Gränser för kartor (ui/import/source-forms). The same forms open as dialogs from
       * other places. A form that adds a source opens the source when it is saved.
       */
      function renderForm() {
        const id = source;
        const family = FAMILY_FORMS[id];
        if (family && !sourcesReady()) return;
        if (!formUi) {
          const wanted = formWanted && formWanted.id === id ? formWanted : null;
          formWanted = null;
          const f = family
            ? D.require('ui/api/family-dialog').form(ctx, Object.assign({}, family.options, wanted ? { values: wanted.values } : {}, wanted && wanted.family !== id && id === 'database' ? { family: wanted.family } : {}))
            : id === 'apifile' ? sourceForms.apiFileForm.form(ctx) : sourceForms.boundariesForm.form(ctx);
          const mine = { id, el: f.el, title: f.title };
          formUi = mine;
          if (id !== 'boundaries') {
            f.done.then((connector) => {
              if (!connector) return;
              if (wanted && wanted.after) wanted.after(connector);
              if (formUi === mine) formUi = null;
              return openConnector(connector);
            }).catch((err) => shell.log(String((err && err.message) || err), 'error'));
          }
        }
        const item = itemOf(id);
        const lead = family ? family.lead : id === 'apifile' ? 'apifile.lead' : 'boundaries.lead';
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon(item.icon, 20), t(item.label))),
          h('p', { class: 'dm-help', 'data-source-lead': id, text: t(lead) }),
          id === 'database' ? h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('bridge.title'), icon: 'hard-drive', size: 'sm', title: t('bridge.hint'), 'data-open-source': 'bridge', onClick: () => choose('bridge') })) : null,
          h('div', { class: 'dm-source-form', 'data-source-form': id }, formUi.el));
      }
      function renderExamples() {
        if (!examplesUi) examplesUi = sourceForms.examplesView(ctx);
        examplesUi.render(slots.center);
      }
      function renderMobile() {
        if (!mobileUi) mobileUi = mobileSource.create(ctx);
        if (mobileTab) { mobileUi.setTab(mobileTab); mobileTab = ''; }
        mobileUi.render({ center: slots.center, right: slots.right });
      }
      /** The local database bridge (api/bridge): connection, source, tables, preview, own SQL and import. */
      // ---- a new, empty building model (OB-06 Schemaval för nya modeller) ----
      const newModel = { schema: '', values: {}, party: {}, busy: false, error: '', result: null };
      /**
       * The optional designations of a new model (data/ifc-new identity: property designation, building number and name, national
       * building id, the first storey's description, and the header's author and organisation), folded under their own heading.
       * @param {(key: string, extra?: any) => any} field the form's field maker
       */
      function newModelIdentity(field) {
        const keys = D.require('data/ifc-new').IDENTITY_FIELDS;
        const filled = keys.some((key) => String(newModel.values[key] || '').trim());
        return h('details', { class: 'dm-more', open: filled ? '' : null, 'data-newmodel-identity': '' },
          h('summary', { text: t('newmodel.identity') }),
          h('div', { class: 'dm-stack' },
            h('p', { class: 'dm-help dm-xs', text: t('newmodel.identity.lead') }),
            keys.map((key) => field(key, { placeholder: t('newmodel.' + key + '.placeholder'), help: t('newmodel.' + key + '.help') }))));
      }
      /**
       * The new model's responsible party (ui/bearbeta/party form: organisation, role, designation, contact), folded under its own
       * heading; written by the wheel's set_responsible_party with the model. @returns {{el: HTMLElement, check: () => string}}
       */
      function newModelParty() {
        const f = D.require('ui/bearbeta/party').form(newModel.party);
        const keep = () => { newModel.party = f.values(); };
        for (const input of Object.values(f.inputs)) { input.addEventListener('input', keep); input.addEventListener('change', keep); }
        const filled = Object.keys(newModel.party).length > 0;
        const el = h('details', { class: 'dm-more', open: filled ? '' : null, 'data-newmodel-party': '' },
          h('summary', { text: t('newmodel.party') }),
          h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help dm-xs', text: t('party.lead') }), ...f.nodes));
        return { el, check: () => (Object.keys(newModel.party).length ? f.check() : '') };
      }
      function renderNewModel() {
        const ifcNew = D.require('data/ifc-new');
        const field = (key, extra) => {
          const el = /** @type {any} */ (h('dm-input', Object.assign({ label: t('newmodel.' + key), 'data-newmodel': key, value: newModel.values[key] || '' }, extra || {})));
          el.addEventListener('input', () => { newModel.values[key] = el.value; });
          return el;
        };
        const schema = /** @type {any} */ (h('dm-select', { label: t('newmodel.schema'), help: t('newmodel.schema.hint'), 'data-newmodel': 'schema' }));
        schema.options = ifcNew.SCHEMAS.map((s) => ({ value: s, label: t('newmodel.schema.' + s.toLowerCase()) }));
        schema.value = newModel.schema || ifcNew.DEFAULT_SCHEMA;
        schema.addEventListener('change', () => { newModel.schema = schema.value; });
        const party = newModelParty();
        const create = async () => {
          if (newModel.busy) return;
          const missing = party.check();
          if (missing) { newModel.error = missing; renderNewModel(); return; }
          newModel.busy = true; newModel.error = ''; newModel.result = null; renderNewModel();
          try {
            const res = await ifcNew.create(Object.assign({}, newModel.values, { schema: newModel.schema || ifcNew.DEFAULT_SCHEMA, party: newModel.party }));
            newModel.result = res.dataset;
            const msg = t('newmodel.done', { name: res.dataset.name, schema: (res.dataset.source && res.dataset.source.schema) || '' });
            shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
          } catch (err) {
            newModel.error = (err && err.message) || String(err);
            shell.log(t('newmodel.error', { message: newModel.error }), 'error');
          }
          newModel.busy = false; renderNewModel();
        };
        const done = newModel.result;
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('box', 20), t('newmodel.title'))),
          h('div', { class: 'dm-stack', 'data-newmodel-form': '' },
            h('p', { class: 'dm-help', text: t('newmodel.lead') }),
            field('name', { placeholder: t('newmodel.default.project') }), schema,
            field('project', { placeholder: t('newmodel.default.project') }), field('site', { placeholder: t('newmodel.default.site') }),
            field('building', { placeholder: t('newmodel.default.building') }), field('storey', { placeholder: t('newmodel.default.storey') }),
            field('elevation', { type: 'number', placeholder: '0' }),
            newModelIdentity(field),
            party.el,
            field('brief', { type: 'textarea', rows: '5', placeholder: t('newmodel.brief.placeholder'), help: t('newmodel.brief.help') }),
            newModel.error ? h('p', { class: 'dm-error dm-small', 'data-newmodel-error': '', text: newModel.error }) : null,
            h('div', { class: 'dm-row' }, ui.button({ label: newModel.busy ? t('newmodel.creating') : t('newmodel.create'), icon: 'box', variant: 'primary', loading: newModel.busy, title: t('newmodel.create.hint'), 'data-newmodel-create': '', onClick: create })),
            h('p', { class: 'dm-help dm-xs', text: t('newmodel.python') }),
            done ? h('div', { class: 'dm-success dm-stack', 'data-newmodel-done': '' },
              h('p', { text: t('newmodel.done', { name: done.name, schema: (done.source && done.source.schema) || '' }) }),
              h('div', { class: 'dm-row' },
                String(newModel.values.brief || '').trim() ? ui.button({ label: t('newmodel.build'), icon: 'cpu', variant: 'primary', title: t('newmodel.build.hint'), 'data-newmodel-build': '', onClick: () => { store.set({ selectedId: done.id, openModelAi: { datasetId: done.id, mode: 'build', brief: String(newModel.values.brief || '').trim() } }); shell.activate('bearbeta'); } }) : null,
                ui.button({ label: t('newmodel.open'), icon: 'pencil', title: t('newmodel.open.hint'), onClick: () => { store.set({ selectedId: done.id }); shell.activate('bearbeta'); } }))) : null));
      }

      // ---- a new, empty digital comprehensive plan (B-78) ----
      const newPlan = { values: { crs: 'EPSG:3006', boundary: true }, municipalities: /** @type {any[]|null} */ (null), busy: false, error: '', result: null };
      function renderNewPlan() {
        // data/plan-new loads with the group 'plan' (src/boot.js).
        if (!groupReady('plan', () => D.ensure(['plan']))) return;
        const planNew = D.require('data/plan-new');
        const geo = D.require('data/geo');
        // The municipalities ship with the app (data/boundaries); they are read once, then the form is drawn again.
        if (!newPlan.municipalities) {
          newPlan.municipalities = [];
          planNew.municipalities().then((list) => { newPlan.municipalities = list; if (source === 'newplan' && slots) renderNewPlan(); }).catch((err) => D.log('inhamta', 'municipalities', err));
        }
        const v = newPlan.values;
        const name = /** @type {any} */ (h('dm-input', { label: t('newplan.name'), placeholder: v.kommun ? t('newplan.default.name.kommun', { kommun: v.kommun }) : t('newplan.default.name'), 'data-newplan': 'name' }));
        name.value = v.name || '';
        name.addEventListener('input', () => { v.name = name.value; });
        const kommun = /** @type {any} */ (h('dm-select', { label: t('newplan.kommun'), help: t('newplan.kommun.help'), 'data-newplan': 'kommun' }));
        kommun.options = [{ value: '', label: t('newplan.kommun.none') }].concat(newPlan.municipalities.map((m) => ({ value: m.code, label: `${m.name} (${m.code})` })));
        kommun.value = v.kommunkod || '';
        kommun.addEventListener('change', () => { const m = newPlan.municipalities.find((x) => x.code === kommun.value); v.kommunkod = m ? m.code : ''; v.kommun = m ? m.name : ''; renderNewPlan(); });
        const boundary = /** @type {any} */ (h('dm-switch', { label: t('newplan.boundary'), title: t('newplan.boundary.hint'), 'data-newplan': 'boundary' }));
        boundary.checked = v.boundary !== false;
        boundary.addEventListener('change', () => { v.boundary = !!boundary.checked; });
        const crs = /** @type {any} */ (h('dm-select', { label: t('newplan.crs'), help: t('newplan.crs.help'), 'data-newplan': 'crs' }));
        crs.options = planNew.CRS.map((code) => ({ value: 'EPSG:' + code, label: geo.crsText(code) }));
        crs.value = v.crs || 'EPSG:3006';
        crs.addEventListener('change', () => { v.crs = crs.value; });
        const description = /** @type {any} */ (h('dm-input', { label: t('newplan.description.label'), rows: '5', placeholder: t('newplan.description.placeholder'), help: t('newplan.description.help'), 'data-newplan': 'description' }));
        description.value = v.description || '';
        description.addEventListener('input', () => { v.description = description.value; });
        const create = async () => {
          if (newPlan.busy) return;
          newPlan.busy = true; newPlan.error = ''; newPlan.result = null; renderNewPlan();
          try {
            newPlan.result = await planNew.create(Object.assign({}, v));
            const msg = t('newplan.done', { name: newPlan.result.name });
            shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
          } catch (err) {
            newPlan.error = (err && err.message) || String(err);
            shell.log(t('newplan.error', { message: newPlan.error }), 'error');
          }
          newPlan.busy = false; renderNewPlan();
        };
        const done = newPlan.result;
        const brief = String(v.description || '').trim();
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('layers', 20), t('newplan.title'))),
          h('div', { class: 'dm-stack', 'data-newplan-form': '' },
            h('p', { class: 'dm-help', text: t('newplan.lead') }),
            name, kommun, v.kommunkod ? boundary : null, crs, description,
            newPlan.error ? h('p', { class: 'dm-error dm-small', 'data-newplan-error': '', text: newPlan.error }) : null,
            h('div', { class: 'dm-row' }, ui.button({ label: newPlan.busy ? t('newplan.creating') : t('newplan.create'), icon: 'layers', variant: 'primary', loading: newPlan.busy, title: t('newplan.create.hint'), 'data-newplan-create': '', onClick: create })),
            done ? h('div', { class: 'dm-success dm-stack', 'data-newplan-done': '' },
              h('p', { text: t('newplan.done', { name: done.name }) }),
              h('div', { class: 'dm-row' },
                tier.shows('ai.panel') ? ui.button({ label: t('newplan.build'), icon: 'cpu', title: t('newplan.build.hint'), 'data-newplan-build': '', onClick: () => { store.set({ selectedId: done.id, openPlanAi: { datasetId: done.id, mode: 'build', brief } }); shell.activate('bearbeta'); } }) : null,
                ui.button({ label: t('newplan.open'), icon: 'pencil', title: t('newplan.open.hint'), 'data-newplan-open': '', onClick: () => { store.set({ selectedId: done.id }); shell.activate('bearbeta'); } }))) : null));
      }

      function renderGuides() {
        // The guides fetch through the families and are part of the group 'sources' (src/boot.js).
        if (!sourcesReady()) return;
        if (!guidesUi) guidesUi = D.require('ui/guides/guides-view').create(ctx);
        guidesUi.render(slots.center);
      }
      function renderBridge(remembered) {
        if (!sourcesReady()) return;
        if (!bridgeUi) { bridgeUi = D.require('ui/api/bridge-view').create(ctx, remembered ? { source: remembered.source } : {}); bridgeUi.start(); }
        else if (remembered) bridgeUi.select(remembered.source).catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' }));
        replace(slots.center, bridgeUi.el);
      }
      /** Fetch a web address: configurations are added directly, data files continue in the wizard. */
      async function fetchUrl(url) {
        wiz.url = url;
        if (!(await importersReady())) return;
        wiz.busy = true; wiz.error = ''; render();
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
            problem(),
            h('p', { class: 'dm-help', text: t('import.url.help') }));
        }
        if (source === 'paste') {
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '12', label: t('import.paste.label'), mono: true }));
          ta.value = wiz.text;
          // A picture of a table becomes text in the box first, so that it can be corrected before the import reads it.
          const fromPicture = async (file) => {
            const res = await D.require('ui/kinds/ocr-dialog').open(ctx, { title: t('import.paste.picture'), lead: t('ocr.lead.table'), pick: !file, file, progress: () => t('ocr.running'), run: (o, f) => D.require('data/ocr').readTable(f, { language: o.language }) });
            if (!res) return;
            ta.value = res.text; wiz.text = res.text;
            ui.toast.show(t('ocr.table.done', { confidence: i18n.formatNumber(res.confidence) }), { kind: 'ok', timeout: 8000 });
          };
          ta.addEventListener('paste', (e) => {
            const item = Array.from(/** @type {any} */ (e).clipboardData ? /** @type {any} */ (e).clipboardData.items : []).find((/** @type {any} */ x) => x.type.startsWith('image/'));
            if (!item) return;
            e.preventDefault();
            fromPicture(/** @type {any} */ (item).getAsFile());
          });
          return h('div', { class: 'dm-stack' }, ta, h('div', { class: 'dm-row' }, ui.button({ label: t('import.paste.picture'), icon: 'scan-line', title: t('import.paste.picture.hint'), onClick: () => fromPicture(null) }), ui.button({ label: t('import.paste.use'), variant: 'primary', icon: 'check', onClick: async () => { wiz.text = ta.value; if (!wiz.text.trim()) return; wiz.file = null; await runPreview(); } })));
        }
        const dz = h('dm-dropzone', { text: t('import.drop'), hint: t('import.drop.hint'), accept: ACCEPT, multiple: true });
        dz.addEventListener('dm-files', (e) => chooseFiles(/** @type {any} */ (e).detail.files));
        // An empty workspace (the first start) points at the examples (F128 a).
        const first = store.get().datasets.length ? null : h('div', { class: 'dm-card dm-row-wrap', 'data-first-examples': '' },
          h('p', { class: 'dm-grow', text: t('examples.first') }),
          ui.button({ label: t('examples.first.open'), icon: 'sparkles', 'data-course': 'example', onClick: () => choose('examples') }));
        return h('div', { class: 'dm-stack' }, first, dz,
          problem(),
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('import.folder'), icon: 'folder', title: t('import.folder.hint'), onClick: async () => chooseFiles(await services.files.pick({ directory: true })) })),
          linked.supported() ? h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('linked.pick'), icon: 'link', onClick: pickLinked }), h('span', { class: 'dm-help', text: t('linked.pick.hint') })) : null);
      }

      /**
       * Files from the drop zone. Several documents, or several pictures, become one collection with fixed
       * columns; any other choice of several files takes the first one through the wizard as before.
       */
      async function chooseFiles(list) {
        if (!list || !list.length || !(await importersReady())) return;
        // A file whose name has no extension the app knows is recognised by its contents first (io/import recognise, F83 a);
        // the files of an archive package keep their paths, which its checksums name (io/import sortFiles reads the rest).
        if (!D.require('io/importers/plan-archive').isPackage(list)) list = await Promise.all(Array.from(list).map((f) => services.importer.recognise(f)));
        // A form or rows from the field are not a table to read: they go where bundles go.
        if (list.length === 1 && /\.(insamling|formular)\.zip$/i.test(list[0].name)) { await D.require('ui/share/bundle').receiveFile(ctx, list[0]); return; }
        // A QGIS project (with or without its data files) becomes a map view, not a dataset; the map view belongs to BIM och GIS.
        wiz.hidden = '';
        const projectFile = list.find((f) => qgis.detect(f));
        if (projectFile && !tier.shows('import:qgis')) { wiz.error = ''; wiz.hidden = 'import:qgis'; render(); return; }
        if (projectFile) { await openProject(projectFile, list.filter((f) => f !== projectFile)); return; }
        // A ZIP with a digital översiktsplan (GeoPackages with Word files, manifest.xml or metadata.xml) is sorted like a folder.
        const deliveryImp = D.require('io/importers/plan-delivery');
        if (list.length === 1 && /\.zip$/i.test(list[0].name) && await deliveryImp.sniff(list[0])) { await sortChosen(await deliveryImp.filesOfZip(list[0])); return; }
        const collection = services.importer.collectionFor(list);
        if (list.length > 1 && !collection) { await sortChosen(list); return; }
        wiz.answers = {}; wiz.sorted = null; wiz.results = null;
        wiz.files = collection && list.length > 1 ? list : [];
        wiz.file = list[0]; wiz.handle = null; wiz.text = ''; wiz.name = '';
        wiz.options.format = wiz.files.length ? collection.id : ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined; wiz.options.plan = undefined; wiz.options.layers = undefined; wiz.nameFromPlan = false;
        if (wiz.files.length) wiz.name = services.importer.folderOf(list) || t('import.collection.' + collection.id, { n: list.length });
        await runPreview();
      }
      /** A mixed choice: one kind of files goes on as usual; anything else is shown sorted before it is read. */
      async function sortChosen(list) {
        wiz.busy = true; wiz.error = ''; render();
        const sorted = await services.importer.sortFiles(list);
        wiz.busy = false;
        const only = sorted.groups.length === 1 && !sorted.skipped.length && !sorted.delivery ? sorted.groups[0] : null;
        if (only) { await chooseFiles(only.files); return; }
        if (!sorted.groups.length && !sorted.delivery) { wiz.error = t('import.sort.none'); render(); return; }
        sorted.groups.forEach((g) => { g.include = true; });
        // A digital översiktsplan in several files: one plan by default when a GeoPackage follows the ÖP model.
        if (sorted.delivery) sorted.delivery.include = !!sorted.delivery.op;
        wiz.sorted = sorted; wiz.results = null; wiz.step = 'sort';
        render();
      }
      const KIND_OF_IMPORTER = { images: 'images', documents: 'document', raster: 'raster', detaljplan: 'plan', planarchive: 'plan', opdelivery: 'plan', graph: 'graph', model: 'model' };
      /** The groups a sorted choice imports: the delivery as one plan when it is chosen, else the groups that are on. */
      function sortedChoice() {
        const d = wiz.sorted.delivery;
        return d && d.include ? [d] : wiz.sorted.groups.filter((g) => g.include);
      }
      function stepSort() {
        const { groups, skipped } = wiz.sorted;
        const row = (g) => {
          const sw = /** @type {any} */ (h('dm-switch', { 'aria-label': t('import.sort.include') }));
          sw.checked = g.include;
          sw.addEventListener('change', () => { g.include = sw.checked; render(); });
          const title = g.collection ? g.name : g.files[0].name;
          const icon = kinds.PROFILES[KIND_OF_IMPORTER[g.importer]] ? kinds.PROFILES[KIND_OF_IMPORTER[g.importer]].icon : 'table';
          return h('div', { class: 'dm-card dm-sort-row' }, ui.icon(icon, 18),
            h('div', { class: 'dm-list-main' }, h('strong', { class: 'dm-truncate', text: title }),
              h('span', { class: 'dm-list-sub dm-truncate', text: g.collection ? g.files.map((f) => f.name).slice(0, 6).join(', ') : t('import.format.' + g.importer) })),
            sw);
        };
        const chosen = sortedChoice();
        // A delivery (data/plan-delivery): every file as one digital översiktsplan, or each file on its own as before.
        const delivery = wiz.sorted.delivery;
        let whole = null;
        if (delivery) {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('plan.delivery.switch'), 'data-import-delivery': '' }));
          sw.checked = !!delivery.include;
          sw.addEventListener('change', () => { delivery.include = sw.checked; render(); });
          whole = h('div', { class: 'dm-stack-xs' }, sw, h('p', { class: 'dm-help dm-small', text: t(delivery.op ? 'plan.delivery.switch.hint.op' : 'plan.delivery.switch.hint') }));
        }
        const one = !!(delivery && delivery.include);
        return h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: t('import.sort.help', { n: i18n.formatNumber(chosen.reduce((sum, g) => sum + g.files.length, 0)) }) }),
          whole,
          one ? row(delivery) : groups.map(row),
          skipped.length && !one ? h('p', { class: 'dm-help dm-small', text: t('import.sort.skipped', { list: skipped.map((f) => f.name).slice(0, 8).join(', ') }) }) : null,
          wiz.busy ? progressNode() : null,
          h('div', { class: 'dm-row' },
            ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: restart }),
            ui.button({ label: t('import.sort.run'), icon: 'check', variant: 'primary', loading: wiz.busy, disabled: !chosen.length, onClick: runSortedChoice })));
      }
      async function runSortedChoice() {
        if (wiz.busy) return;
        wiz.busy = true; wiz.progress = null; render();
        const results = await services.importer.runSorted(sortedChoice(), (p) => { wiz.progress = p; render(); });
        for (const r of results) {
          if (r.meta) { shell.log(doneText(r.meta), 'ok'); for (const line of leftOut(r.meta)) shell.log(line, 'warn'); }
          else shell.log(t('import.error', { message: `${r.group.files[0].name}: ${r.error}` }), 'error');
        }
        wiz.results = results; wiz.step = 'done'; wiz.busy = false; render();
      }
      /**
       * A QGIS project: read the layers, match them to datasets in the workspace or to the files dropped with it, and
       * offer to create a map view (io/importers/qgis).
       */
      async function openProject(file, companions) {
        if (!(await importersReady())) return;
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
          h('ul', { class: 'dm-list dm-import-files' }, shown.map((f) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(wiz.options.format === 'images' || wiz.options.format === 'raster' ? 'image' : 'file-text', 14), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: f.name }), h('span', { class: 'dm-list-sub', text: i18n.formatBytes(f.size) }))))),
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
          if (!(await importersReady())) return;
          wiz.file = await services.importer.recognise(file); wiz.files = []; wiz.handle = handle; wiz.text = ''; wiz.options.format = ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined; wiz.options.plan = undefined; wiz.options.layers = undefined; wiz.nameFromPlan = false;
          await runPreview();
        } catch (err) { if (!err || err.name !== 'AbortError') { wiz.error = (err && err.message) || String(err); render(); } }
      }

      /**
       * The preview of the chosen file. In a raster of several files a file refused in the person's words (one without a place, a
       * rotated one) gives way to the next, and its words are kept in `wiz.refused`: the import leaves such files out and imports
       * the others (data/raster importFiles). The first refusal stands only when every file is refused.
       */
      async function previewFile(opts) {
        wiz.refused = [];
        const list = wiz.options.format === 'raster' && wiz.files.length > 1 ? wiz.files : [wiz.file];
        let first = null;
        for (const file of list) {
          try {
            const p = await services.importer.preview(file, opts);
            wiz.file = file;
            return p;
          } catch (err) {
            if (list.length < 2 || !err || typeof err.code !== 'string' || err.tierFeature) { wiz.refused = []; throw err; }
            first = first || err;
            wiz.refused.push({ file, message: String(err.message || err) });
          }
        }
        wiz.refused = []; wiz.file = list[0];
        throw first;
      }
      async function runPreview() {
        if (!(await importersReady())) return;
        wiz.busy = true; wiz.error = ''; wiz.hidden = ''; wiz.refused = []; render();
        try {
          const opts = cleanOptions();
          wiz.preview = wiz.file ? await previewFile(opts) : await services.importer.previewText(wiz.text, opts);
          wiz.options.format = wiz.preview.importer;
          if (wiz.preview.encoding && !wiz.options.encoding) wiz.options.encoding = wiz.preview.encoding;
          if (wiz.preview.sheet !== undefined) wiz.options.sheet = wiz.preview.sheet;
          if (wiz.options.header === undefined) wiz.options.header = wiz.preview.header;
          wiz.specs = wiz.preview.inferred.map((c) => Object.assign({}, c));
          wiz.answers = {};
          if (!wiz.name) wiz.name = wiz.file ? services.importer.baseName(wiz.file.name) : t('import.paste.name');
          wiz.step = wiz.step === 'file' ? 'options' : wiz.step;
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          // A file the tier does not read (a BCF file below BIM och GIS) shows the tier's notice, with the way to raise it.
          if (err && err.tierFeature) { wiz.hidden = err.tierFeature; wiz.step = 'file'; }
          shell.log(t('import.error', { message: wiz.error }), wiz.hidden ? 'info' : 'error');
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
        // A file recognised by its contents, since its name has no extension the app knows (F83 a).
        if (wiz.file && p && p.recognised) left.appendChild(h('p', { class: 'dm-help dm-small', 'data-import-recognised': '', text: p.recognisedText ? t('import.recognised.text') : t('import.recognised', { format: p.recognised }) }));
        const sense = p ? senseCard(p) : null;
        if (sense) left.appendChild(sense);
        // A coordinate system the app cannot convert: said before the import (the places would otherwise land in the wrong place).
        if (p && p.crsUnknown) left.appendChild(h('p', { class: 'dm-error dm-small', 'data-import-crs-unknown': '', text: t('import.crs.unknown', { crs: p.crsUnknown }) }));
        const collection = COLLECTIONS.includes(wiz.options.format);
        const format = select(t('import.format'), FORMATS.map((f) => ({ value: f, label: t('import.format.' + f) })), wiz.options.format, (v) => { wiz.options.format = v; wiz.options.header = undefined; wiz.options.recordTag = ''; wiz.options.table = ''; schedulePreview(); });
        // Several files are always one collection, so the format is fixed then.
        if (wiz.file && wiz.files.length < 2) left.appendChild(format);
        if (wiz.files.length > 1) left.appendChild(fileList());
        // The files of a raster that are refused: named with what to do, before the others are imported.
        if (wiz.refused.length) left.appendChild(h('div', { class: 'dm-stack-xs', 'data-import-refused': '' }, h('p', { class: 'dm-help dm-small', text: t('raster.refused') }), wiz.refused.map((r) => h('p', { class: 'dm-warn dm-small', text: r.message }))));
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
          else {
            // A GeoPackage in Boverket's ÖP model: the whole comprehensive plan as one plan dataset, or one table.
            if (p.planGpkg) {
              if (wiz.options.plan === undefined) wiz.options.plan = true;
              const op = p.planGpkg === 'oversiktsplan';
              const sw = /** @type {any} */ (h('dm-switch', { label: t(op ? 'plan.import.op' : 'plan.import.whole') }));
              sw.checked = !!wiz.options.plan;
              sw.addEventListener('change', () => { wiz.options.plan = sw.checked; render(); });
              left.appendChild(sw);
              left.appendChild(h('p', { class: 'dm-help dm-small', text: op ? t('plan.import.op.hint') : t('plan.import.whole.hint', { format: t('plan.gpkg.' + p.planGpkg) }) }));
            }
            // Any GeoPackage with several layers: all of them as one dataset (kind layers), the layers chosen for display afterwards.
            if (p.gpkg && !wiz.options.plan && (p.layerCount || 0) > 1) {
              const sw = /** @type {any} */ (h('dm-switch', { label: t('layers.import.whole'), 'data-import-layers': '' }));
              sw.checked = !!wiz.options.layers;
              sw.addEventListener('change', () => { wiz.options.layers = sw.checked; render(); });
              left.appendChild(sw);
              left.appendChild(h('p', { class: 'dm-help dm-small', text: t('layers.import.whole.hint', { n: i18n.formatNumber(p.layerCount) }) }));
            }
            if (!wiz.options.plan && !wiz.options.layers && p.tables && p.tables.length) left.appendChild(select(t('import.table'), p.tables.map((s) => ({ value: s, label: s })), wiz.options.table || p.table, (v) => { wiz.options.table = v; schedulePreview(); }));
          }
        }
        // A plan file or an archive package (a ZIP with metadata/PREMIS.xml): the plan's facts and Import without the column step.
        const planFile = !!(p && p.kind === 'plan' && (wiz.options.format === 'detaljplan' || wiz.options.format === 'planarchive' || wiz.options.format === 'opdelivery'));
        if (planFile) {
          const info = p.plan || {};
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('plan.field.slag'), value: t('plan.slag.' + (info.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan')) },
            info.namn ? { label: t('common.name'), value: info.namn } : null,
            info.beteckning ? { label: t('plan.field.beteckning'), value: info.beteckning } : null,
            info.kommun || info.kommunkod ? { label: t('plan.field.kommun'), value: [info.kommun, info.kommunkod].filter(Boolean).join(' ') } : null,
            info.status ? { label: t('plan.field.status'), value: info.status } : null,
            { label: t('plan.field.objects'), value: i18n.formatNumber(p.totalRows || 0) },
            { label: t('plan.field.format'), value: t('plan.format.' + (p.planFormat || 'detaljplan')) },
            info.crs ? { label: t('plan.field.crs'), value: D.require('data/geo').crsText(info.crs) } : null,
            info.arkivpaket ? { label: t('plan.archive.title'), value: info.arkivpaket.andrade.length + info.arkivpaket.saknas.length ? t('plan.archive.bad', { n: info.arkivpaket.andrade.length + info.arkivpaket.saknas.length }) : t('plan.archive.ok', { n: info.arkivpaket.stammer }) } : null,
            info.leverans ? { label: t('plan.delivery.files'), value: info.leverans.filer.map((f) => `${f.namn} (${t('plan.files.role.' + f.roll)})`).join(', ') } : null,
            info.leverans && p.sections ? { label: t('plan.delivery.sections'), value: t('plan.delivery.sections.n', { n: i18n.formatNumber(p.sections), links: i18n.formatNumber(p.links || 0) }) } : null,
          ].filter(Boolean);
          left.appendChild(h('div', { class: 'dm-card', 'data-plan-preview': '' }, kv));
          // What a delivery's check found (a bookmark missing in the text document, a checksum that does not match), as text.
          const warnings = info.leverans && Array.isArray(info.leverans.varningar) ? info.leverans.varningar : [];
          if (warnings.length) left.appendChild(h('div', { class: 'dm-stack-xs', 'data-plan-warnings': '' }, warnings.slice(0, 8).map((w) => h('p', { class: 'dm-warn dm-small', text: String(w) }))));
          left.appendChild(h('p', { class: 'dm-help dm-small', text: t('plan.import.hint') }));
        }
        const opPlan = !!(wiz.options.format === 'sqlite' && p && ((p.planGpkg && wiz.options.plan) || (p.gpkg && wiz.options.layers && !wiz.options.plan)));
        // A graph file: the graph's facts (nodes, edges, labels, types) and one Import button; the nodes are the preview table.
        const graphFile = !!(p && p.kind === 'graph' && wiz.options.format === 'graph');
        if (graphFile) {
          const g = p.graph || {};
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('plan.field.format'), value: t('graph.format.' + (p.graphFormat || 'nodelink')) },
            { label: t('graph.nodes'), value: i18n.formatNumber(g.nodes || 0) },
            { label: t('graph.edges'), value: i18n.formatNumber(g.edges || 0) },
            { label: t('graph.directed'), value: g.directed === false ? t('common.no') : t('common.yes') },
            g.labels && g.labels.length ? { label: t('graph.labels'), value: g.labels.slice(0, 12).map((l) => `${l.name || t('graph.nolabel')} (${i18n.formatNumber(l.count)})`).join(', ') } : null,
            g.types && g.types.length ? { label: t('graph.types'), value: g.types.slice(0, 12).map((l) => `${l.name || t('graph.notype')} (${i18n.formatNumber(l.count)})`).join(', ') } : null,
          ].filter(Boolean);
          left.appendChild(h('div', { class: 'dm-card' }, kv));
          left.appendChild(h('p', { class: 'dm-help dm-small', text: t('graph.import.hint') }));
        }
        // A building model or drawing: the file's facts and one Import button; the counts per type are the preview table.
        const modelFile = !!(p && p.kind === 'model' && wiz.options.format === 'model') || !!(p && p.kind === 'package');
        if (modelFile) {
          const m = p.model || {};
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = (m.format === 'dxf' ? [
            { label: t('model.field.format'), value: 'DXF' + (m.version ? ' · ' + m.version : '') },
            m.units ? { label: t('model.field.units'), value: m.units } : null,
            { label: t('model.field.entities'), value: i18n.formatNumber(m.entities || 0) },
            { label: t('model.layers'), value: i18n.formatNumber((m.layers || []).length) },
          ] : [
            { label: t('model.field.format'), value: m.schema || 'IFC' },
            m.project ? { label: t('model.field.project'), value: m.project } : null,
            m.building ? { label: t('model.field.building'), value: m.building } : null,
            m.application ? { label: t('model.field.application'), value: m.application } : null,
            { label: t('model.field.storeys'), value: i18n.formatNumber((m.storeys || []).length) },
            { label: t('model.field.entities'), value: i18n.formatNumber(m.entities || 0) },
          ]).filter(Boolean);
          left.appendChild(h('div', { class: 'dm-card' }, kv));
          left.appendChild(h('p', { class: 'dm-help dm-small', text: t('model.import.hint') }));
        }
        // A GeoTIFF: the raster's facts as Hantera will show them (system, resolution, pixels, bands and data type, what becomes
        // of the original, the attribution); several files make one raster, and the first one speaks for them here.
        if (p && p.kind === 'raster' && wiz.options.format === 'raster') {
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = kinds.facts({ kind: 'raster', raster: p.raster, rowCount: p.totalRows });
          left.appendChild(h('div', { class: 'dm-card', 'data-import-raster': '' }, kv));
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
        if (viaR || collection || planFile || opPlan || graphFile || modelFile) {
          // No column step: R reads the file and dm_write() sets the types; documents, pictures and plans have fixed columns.
          if ((planFile || opPlan || graphFile || modelFile) && !wiz.nameFromPlan && p && p.datasetName) { wiz.name = p.datasetName; wiz.nameFromPlan = true; }
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
          (viaR || collection || planFile || opPlan || graphFile || modelFile) ? ui.button({ label: t('common.import'), icon: 'check', variant: 'primary', loading: wiz.busy, onClick: runImport })
            : ui.button({ label: t('common.next'), icon: 'chevron-right', variant: 'primary', disabled: !p || !p.columns.length || wiz.busy, onClick: () => { wiz.step = 'columns'; render(); } })));
        const right = h('div', { class: 'dm-table-wrap' },
          p ? kindPreview(p) : null,
          h('h3', { text: t('import.preview', { n: p ? p.dataRows.length : 0 }) }),
          p && p.columns.length ? previewTable(p) : h('p', { class: 'dm-help', text: wiz.busy ? t('common.loading') : viaR ? t('import.r.nopreview') : t('import.no.rows') }));
        return h('div', { class: 'dm-two-col' }, left, right);
      }

      /** What the file is, and what is worth asking about it. */
      function senseCard(p) {
        const sense = fileSense.describe(p, { files: wiz.files.filter((f) => !wiz.refused.some((r) => r.file === f)) });
        if (!sense) return null;
        const answers = wiz.answers;
        const coords = fileSense.coordinates(p);
        const parts = fileSense.questions(p).filter((q) => !(q.id === 'graph' && wiz.handle)).map((q) => {
          if (q.id === 'crs') {
            const sel = /** @type {any} */ (h('dm-select', { label: t('import.q.crs'), help: t(q.hint) }));
            sel.options = fileSense.SYSTEMS;
            sel.value = answers.crs || q.system;
            sel.addEventListener('change', () => { answers.crs = sel.value; render(); });
            return sel;
          }
          const sw = /** @type {any} */ (h('dm-switch', { label: t('import.q.' + q.id, q.params) }));
          sw.checked = !!answers[q.id];
          sw.addEventListener('change', () => {
            answers[q.id] = sw.checked;
            if (q.id === 'swap') fileSense.swapNames(wiz.specs, coords.lon, coords.lat);
            render();
          });
          return h('div', { class: 'dm-stack-sm' }, sw, h('p', { class: 'dm-help dm-small', text: t(q.hint, q.params) }));
        });
        return h('div', { class: 'dm-card dm-sense dm-stack-sm' },
          h('div', { class: 'dm-sense-head' }, ui.icon(sense.icon, 18), h('strong', { text: t(sense.key, sense.params) })),
          parts);
      }
      /** The file in its own form, above the rows: a map, pictures, a network, a drawing, a first page. */
      function kindPreview(p) {
        if (p.importer === 'images') {
          const list = wiz.files.length ? wiz.files : (wiz.file ? [wiz.file] : []);
          return h('div', { class: 'dm-photos dm-import-photos' }, list.slice(0, 12).map((f) => h('img', { src: thumbOf(f), alt: f.name, class: 'dm-import-photo' })));
        }
        // A GeoTIFF the browser cannot draw: the picture data/raster made of it in its own grid, when it is small enough to read
        // quickly (a large file without overviews has none before the import).
        if (p.importer === 'raster') {
          const shots = Array.isArray(p.pictures) ? p.pictures.filter((src) => /^data:image\//.test(String(src))) : [];
          const files = (p.raster && Array.isArray(p.raster.files)) ? p.raster.files : [];
          return shots.length ? h('div', { class: 'dm-photos dm-import-photos' }, shots.map((src, i) => h('img', { src, alt: (files[i] && files[i].name) || t('datasets.picture.raster'), class: 'dm-import-photo', 'data-import-raster-picture': '' }))) : null;
        }
        if (p.sample) return h('div', { class: 'dm-ds-picture' }, sketches.network(sketches.networkOf(p.sample.nodes, p.sample.edges), t('datasets.picture.graph')));
        if (p.drawing) return h('div', { class: 'dm-ds-picture' }, sketches.imageOfSvg(p.drawing, t('datasets.picture.drawing')));
        if (p.importer === 'documents' && wiz.file && /\.pdf$/i.test(wiz.file.name)) return firstPage(wiz.file);
        const table = fileSense.mapTable(p, wiz.answers);
        const text = table ? leaflet.tableSvg(table, { width: 640, height: 240, limit: 5000 }) : null;
        if (!text) return null;
        const note = h('p', { class: 'dm-help dm-small' });
        if (table.columns[0] === 'lon' && table.columns.length === 2) {
          fileSense.placeName(table.rows).then((name) => { note.textContent = name ? t('import.sense.where', { name }) : t('import.sense.where.none'); }).catch((err) => D.log('import', err));
        }
        return h('div', { class: 'dm-stack-sm' }, h('div', { class: 'dm-api-map' }, new DOMParser().parseFromString(text, 'image/svg+xml').documentElement), note);
      }
      function firstPage(file) {
        const holder = h('div', { class: 'dm-ds-picture' });
        const cached = wiz.page && wiz.page.file === file ? wiz.page.url : null;
        if (cached) { holder.appendChild(h('img', { src: cached, alt: t('datasets.picture.page'), class: 'dm-ds-page' })); return holder; }
        file.arrayBuffer().then(async (buffer) => {
          const pdf = D.require('engines/pdf');
          const doc = await pdf.open(new Uint8Array(buffer));
          try {
            const canvas = document.createElement('canvas');
            await pdf.render(doc, 1, canvas, { width: 220 });
            wiz.page = { file, url: canvas.toDataURL('image/png') };
            holder.appendChild(h('img', { src: wiz.page.url, alt: t('datasets.picture.page'), class: 'dm-ds-page' }));
          } finally { await doc.destroy(); }
        }).catch((err) => { D.log('import', err); holder.remove(); });
        return holder;
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

      /** What was fetched, in the dataset's own terms: pages, pictures and nodes rather than rows and columns. */
      function doneText(m) {
        if (!kinds.isCollection(m)) return t('import.done', { name: m.name, rows: i18n.formatNumber(m.rowCount), cols: m.columnCount });
        return t('import.done.kind', { name: m.name, summary: kinds.summary(m) });
      }
      /**
       * What a raster's import left out, one line each with its words (data/raster importFiles): a refused file says what to do, and
       * the files over the number a raster holds are named together.
       * @returns {string[]}
       */
      function leftOut(m) {
        const list = m && m.raster && Array.isArray(m.raster.skipped) ? m.raster.skipped.filter(Boolean) : [];
        const many = list.filter((s) => s.code === 'many');
        const lines = list.filter((s) => s.code !== 'many').map((s) => (String(s.error).includes(String(s.name)) ? String(s.error) : `${s.name}: ${s.error}`));
        if (many.length) lines.push(`${many[0].error} ${many.slice(0, 8).map((s) => s.name).join(', ')}${many.length > 8 ? ' …' : ''}`);
        return lines;
      }
      /** The lines of `leftOut` under a result, or nothing. */
      function leftOutNode(m) {
        const lines = leftOut(m);
        return lines.length ? h('div', { class: 'dm-stack-xs', 'data-import-skipped': '' }, h('p', { class: 'dm-help dm-small', text: t('raster.skipped.done') }), lines.map((line) => h('p', { class: 'dm-warn dm-small', text: line }))) : null;
      }
      /** The way on from an import: read, look at, or work in the table (a kind whose own views the tier hides opens as a table). */
      function openAfter(m) {
        const own = kinds.shown(m) ? kinds.of(m).open : null;
        return own ? { label: t(own.label), icon: own.icon } : { label: t('import.open.bearbeta'), icon: 'pencil' };
      }
      async function runImport() {
        if (wiz.busy) return;
        wiz.busy = true; wiz.error = ''; wiz.progress = null; render();
        const t0 = performance.now();
        try {
          const opts = cleanOptions();
          if (wiz.handle) opts.linked = true;
          const reproject = wiz.preview ? fileSense.reprojectOption(wiz.preview, wiz.answers) : null;
          if (reproject) opts.reproject = reproject;
          const specs = wiz.specs.map((s) => ({ name: s.name, type: s.type, include: s.include !== false, decimal: s.decimal, label: s.label || s.name }));
          // Large delimited files are streamed; the progress callback shows the rows read so far.
          const onProgress = (p) => { wiz.progress = p; render(); };
          const meta = wiz.files.length > 1 ? await services.importer.runFiles(wiz.files, opts, wiz.name, onProgress)
            : wiz.file ? await services.importer.run(wiz.file, opts, specs, wiz.name, onProgress) : await services.importer.runText(wiz.text, opts, specs, wiz.name);
          if (wiz.handle) await linked.link(meta.id, wiz.handle);
          const network = wiz.answers.graph ? fileSense.questions(wiz.preview).find((q) => q.id === 'graph') : null;
          const result = network ? await fileSense.toGraph(meta, network.params) : meta;
          wiz.result = result; wiz.step = 'done';
          shell.log(doneText(result) + ` (${Math.round(performance.now() - t0)} ms)`, 'ok');
          for (const line of leftOut(result)) shell.log(line, 'warn');
          ui.toast.show(doneText(result), { kind: 'ok' });
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function stepDone() {
        if (wiz.results) {
          const open = (m) => { store.set({ selectedId: m.id }); shell.activate('bearbeta'); };
          return h('div', { class: 'dm-success dm-stack' },
            h('h2', null, ui.icon('circle-check', 20), ' ', t('import.sort.done', { n: i18n.formatNumber(wiz.results.filter((r) => r.meta).length) })),
            wiz.results.map((r) => (r.meta
              ? h('div', { class: 'dm-stack-xs' }, h('div', { class: 'dm-row' }, h('span', { class: 'dm-list-main dm-truncate', text: doneText(r.meta) }), ui.button(Object.assign(openAfter(r.meta), { size: 'sm', onClick: () => open(r.meta) }))), leftOutNode(r.meta))
              : h('p', { class: 'dm-error dm-small', text: `${r.group.files[0].name}: ${r.error}` }))),
            h('div', { class: 'dm-row' }, ui.button({ label: t('import.another'), icon: 'plus', onClick: restart })));
        }
        const m = wiz.result;
        return h('div', { class: 'dm-success' },
          h('h2', null, ui.icon('circle-check', 20), ' ', doneText(m)),
          leftOutNode(m),
          h('div', { class: 'dm-row' },
            ui.button(Object.assign(openAfter(m), { variant: 'primary', onClick: () => { store.set({ selectedId: m.id }); shell.activate('bearbeta'); } })),
            ui.button({ label: t('import.another'), icon: 'plus', onClick: restart })));
      }

      // ---- right ----
      function renderRight() {
        if (source === 'mobile') return;
        if (source === 'examples') { if (examplesUi) examplesUi.renderRight(slots.right); return; }
        if (source === 'boundaries') { replace(slots.right, h('h4', { text: t('presets.geo.label') }), h('p', { class: 'dm-help', text: t('boundaries.right') })); return; }
        if (source === 'apifile' || FAMILY_FORMS[source]) { replace(slots.right, h('h4', { text: t(itemOf(source).label) }), h('p', { class: 'dm-help', text: t('import.form.right') })); return; }
        if (source === 'guides') { replace(slots.right, h('h4', { text: t('guides.title') }), h('p', { class: 'dm-help', text: t('guides.right') })); return; }
        if (source === 'newmodel') { replace(slots.right, h('h4', { text: t('newmodel.title') }), h('p', { class: 'dm-help', text: t('newmodel.right') })); return; }
        if (source === 'newplan') { replace(slots.right, h('h4', { text: t('newplan.title') }), h('p', { class: 'dm-help', text: t('newplan.right') })); return; }
        if (source.startsWith('api:')) { if (apiUi) apiUi.renderRight(slots.right); else replace(slots.right); return; }
        if (source === 'saved') { replace(slots.right, h('h4', { text: t('api.saved.title') }), h('p', { class: 'dm-help', text: t('api.saved.help') })); return; }
        if (source === 'catalog') { replace(slots.right, h('h4', { text: t('api.sources') }), h('p', { class: 'dm-help', text: t('api.catalog.hint') })); return; }
        if (source === 'bridge' || source.startsWith('bridge:')) { replace(slots.right, h('h4', { text: t('bridge.title') }), h('p', { class: 'dm-help', text: t('bridge.help') })); return; }
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
            { label: t('import.format'), value: FORMATS.includes(p.importer) ? t('import.format.' + p.importer) : p.importer },
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

      // The palette finds every source the tier shows, as the deep links do (#/inhamta/<id>).
      if (ctx.palette) {
        ctx.palette.register(() => GROUPS.flatMap((g) => g.items.filter(shownItem).map((item) => ({
          id: 'source:' + item.id, label: t(item.label), hint: subOf(item), group: t('palette.group.sources'), icon: item.icon, keywords: [t('mode.inhamta'), t(g.label)],
          run: () => openSource(item.id),
        }))));
      }

      // The pane head has no heading in Inhämta (B-81.1): every group says that it holds sources. `leftLabel` names the column.
      return { id: 'inhamta', leftTitle: '', leftLabel: 'import.sources', activate, deactivate, openSource, get bridgeView() { return bridgeUi; }, get mobileView() { return mobileUi; }, get sourceTree() { return leftTree; } };
    }
    return { createMode, GROUPS };
  });
})();
