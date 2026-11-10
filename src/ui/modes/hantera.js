// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Hantera": datasets (overview, columns, comments, history, rename, delete) and the workspace
 * (storage status, backup and restore as ZIP, the portable folder, API refresh). Sharing lives in Dela.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/hantera', ['ui/base', 'ui/flows/flows-view', 'data/watches', 'platform/storage/folder', 'ui/share/bundle', 'ui/batch-actions', 'ui/settings/network', 'ui/analysis/graph-panel', 'data/kinds'], (base, flowsView, watches, folder, share, batch, settings, graphPanel, kinds) => {
    const { h, t, i18n, replace } = base;
    const WORKSPACE = '__workspace';
    const FLOWS = '__flows';
    const LIBRARY = '__library';

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let tab = 'overview'; let unsubscribe = null; let unsubFolder = null;
      /** @type {any} */ let flowsUi = null; let libraryUi = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId') || changed.includes('selectedIds') || (changed.includes('flowsTab') && state.flowsTab)) render(); });
        // Re-render the workspace view when the portable folder finishes an automatic save.
        unsubFolder = services.workspace.onFolder((status) => { if (slots && !status.busy && store.get().selectedId === WORKSPACE) render(); });
        render();
      }
      function deactivate() { slots = null; if (libraryUi) { libraryUi.destroy(); libraryUi = null; } if (unsubscribe) unsubscribe(); if (unsubFolder) unsubFolder(); if (flowsUi) { flowsUi.destroy(); flowsUi = null; } }

      function render() {
        if (!slots) return;
        const state = store.get();
        const selectedIds = state.selectedIds || [];
        ui.datasetList.render(slots.left, {
          datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }),
          extra: [{ id: WORKSPACE, label: t('datasets.storage.title'), icon: 'hard-drive', sub: t('datasets.backup') }, { id: FLOWS, label: t('flows.title'), icon: 'play', sub: t('flows.sub') }, { id: LIBRARY, label: t('library.title'), icon: 'book-open', sub: t('library.sub') }],
          // Several datasets at once: check boxes, drag and drop into folders, and the batch actions.
          multi: true, selectedIds, onToggle: (ids) => store.set({ selectedIds: ids }),
          onMove: (ids, path) => batch.move(ctx, ids, path),
          tools: selectedIds.length ? [
            ui.button({ label: t('datasets.batch.button', { n: selectedIds.length }), icon: 'list-checks', variant: 'primary', 'data-course': 'batch', onClick: () => batch.open(ctx, selectedIds) }),
            ui.button({ label: t('datasets.batch.clear'), variant: 'ghost', size: 'sm', onClick: () => store.set({ selectedIds: [] }) }),
          ] : [],
        });
        const selected = state.datasets.find((d) => d.id === state.selectedId);
        if (state.selectedId !== FLOWS && flowsUi) { flowsUi.destroy(); flowsUi = null; }
        if (state.selectedId !== LIBRARY && libraryUi) { libraryUi.destroy(); libraryUi = null; }
        if (state.selectedId === LIBRARY) { if (!libraryUi) libraryUi = D.require('ui/library/library-view').create(ctx); libraryUi.render({ center: slots.center, right: slots.right }); }
        else if (state.selectedId === FLOWS) { if (!flowsUi) flowsUi = flowsView.create(ctx); flowsUi.render({ center: slots.center, right: slots.right }); }
        else if (state.selectedId === WORKSPACE) { renderWorkspace(); renderWorkspaceInspector(); }
        else if (selected) {
          // The dataset can be removed (here or in another tab) while its views load; only report other errors.
          renderDataset(selected).catch(async (err) => { if (await services.datasets.get(selected.id)) shell.log(String((err && err.message) || err), 'error'); });
          renderInspector(selected);
        }
        else { renderEmpty(); replace(slots.right, h('p', { class: 'dm-help', text: t('mode.hantera.desc') })); }
      }

      function renderEmpty() {
        if (store.get().datasets.length) {
          replace(slots.center, h('dm-empty-state', { icon: 'database', heading: t('datasets.choose'), text: t('shell.select.dataset') },
            ui.button({ label: t('datasets.storage.title'), icon: 'hard-drive', onClick: () => store.set({ selectedId: WORKSPACE }) })));
          return;
        }
        replace(slots.center, h('dm-empty-state', { icon: 'database', heading: t('datasets.empty'), text: t('datasets.empty.hint') },
          ui.button({ label: t('mode.inhamta'), icon: 'download', variant: 'primary', onClick: () => shell.activate('inhamta') }),
          ui.button({ label: t('presets.try'), icon: 'sparkles', onClick: async () => {
            try { const meta = await services.importer.runPreset(D.require('presets').examples[0]); shell.log(t('presets.done', { name: meta.name }), 'ok'); }
            catch (err) { shell.log(String((err && err.message) || err), 'error'); }
          } }),
          ui.button({ label: t('datasets.storage.title'), icon: 'hard-drive', onClick: () => store.set({ selectedId: WORKSPACE }) })));
      }

      async function renderDataset(ds) {
        // A tab asked for from elsewhere (the comments behind the status bar).
        const asked = store.get().datasetTab;
        if (asked) { tab = asked; store.set({ datasetTab: null }); }
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = [{ id: 'overview', label: t('datasets.overview'), icon: 'info' }, { id: 'columns', label: t('datasets.columns'), icon: 'columns-3' }, { id: 'comments', label: t('comments.title'), icon: 'message-square' }, { id: 'describe', label: t('dcat.tab'), icon: 'tag' }, { id: 'provenance', label: t('provenance.title'), icon: 'git-branch' }, { id: 'log', label: t('datasets.log'), icon: 'history' }];
        tabs.active = tab;
        tabs.addEventListener('dm-change', (e) => { tab = /** @type {any} */ (e).detail.id; render(); });
        const body = h('div', { class: 'dm-center-fill' });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon(ui.datasetList.kindIcon(ds.kind), 20), ds.name, ' ', ...kindBadges(ds)),
            h('div', { class: 'dm-row' },
              // A dataset with a view of its own opens there: the reading view, the gallery, the model.
              kinds.of(ds).open ? ui.button({ label: t(kinds.of(ds).open.label), icon: kinds.of(ds).open.icon, variant: 'primary', title: t(kinds.of(ds).open.hint), onClick: () => openView(ds) }) : null,
              // Two tables (nodes and edges) become a graph dataset.
              !kinds.isCollection(ds) ? ui.button({ label: t('graph.from.button'), icon: 'share-2', title: t('graph.from.button.hint'), onClick: () => graphPanel.fromTablesDialog(ctx, ds.id).then((meta) => { if (meta) { store.set({ selectedId: meta.id }); render(); } }) }) : null,
              ds.source && (ds.source.kind === 'api' || ds.source.kind === 'bridge') ? ui.button({ label: t('api.refetch'), icon: 'refresh-cw', onClick: () => refetch(ds) }) : null,
              watches.watchable(ds) ? watchButton(ds) : null,
              ds.source && ds.source.kind === 'file' && ds.source.linked ? ui.button({ label: t('linked.refresh'), icon: 'refresh-cw', onClick: () => refreshLinked(ds) }) : null,
              ui.button({ label: t('bearbeta.versions'), icon: 'history', onClick: async () => D.require('ui/dialogs').versionsDialog({ datasetId: ds.id, columns: await services.datasets.columns(ds.id), onApplied: () => render() }) }),
              ui.button({ label: t('common.rename'), icon: 'pencil', onClick: () => rename(ds) }),
              ui.button({ label: t('datasets.organize'), icon: 'folder', onClick: () => batch.organize(ctx, [ds.id]) }),
              ui.button({ label: t('common.export'), icon: 'file-output', onClick: () => shell.activate('exportera') }),
              ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'danger', onClick: () => remove(ds) }))),
          tabs, body);
        if (tab === 'overview') {
          const kv = /** @type {any} */ (h('dm-kv'));
          const src = ds.source || {};
          const collection = kinds.isCollection(ds);
          kv.items = [
            { label: t('common.name'), value: ds.name },
            { label: t('datasets.shortname'), value: ds.shortName || '' },
            { label: t('common.description'), value: ds.description },
            // Described in its own units; the paragraph or picture table is one view of it.
            ...kinds.facts(ds),
            { label: t('common.created'), value: i18n.formatDateTime(ds.createdAt) },
            { label: t('common.updated'), value: i18n.formatDateTime(ds.updatedAt) },
            collection ? null : { label: t('datasets.rows'), value: i18n.formatNumber(ds.rowCount || 0) },
            collection ? null : { label: t('datasets.columns'), value: String(ds.columnCount || 0) },
            { label: t('common.size'), value: i18n.formatBytes(ds.byteSize || 0) },
            { label: t('common.source'), value: describeSource(src) },
          ].filter(Boolean);
          const insight = D.require('ui/kinds/insight-cards');
          replace(body, D.require('ui/kinds/dataset-picture').create(ds), h('div', { class: 'dm-card' }, kv), insight.cdeCard(ctx, ds), insight.filesCard(ctx, ds), insight.bcfCard(ctx, ds), insight.facetCard(ctx, ds), insight.codeListCard(ctx, ds), insight.healthCard(ds), ds.kind === 'document' ? documentList(ds) : null, ds.kind === 'images' ? await imageGrid(ds) : null);
        } else if (tab === 'columns') {
          const cols = await services.datasets.columns(ds.id);
          const table = /** @type {any} */ (h('dm-table'));
          replace(body, h('div', { class: 'dm-table-wrap' }, table));
          table.setData({ columns: [{ key: 'position', label: '#', type: 'integer', width: 70 }, { key: 'name', label: t('common.name'), type: 'text', width: 220 }, { key: 'type', label: t('common.type'), type: 'text', width: 130 }, { key: 'label', label: t('param.label'), type: 'text', width: 220 }, { key: 'description', label: t('column.description'), type: 'text', width: 280 }, { key: 'unit', label: t('column.unit'), type: 'text', width: 120 }, { key: 'valueLabels', label: t('column.valuelabels'), type: 'text', width: 240 }, { key: 'source', label: t('common.source'), type: 'text', width: 200 }],
            rowCount: cols.length, rowProvider: async (start, count) => cols.slice(start, start + count).map((c) => [c.position + 1, c.name, t('type.' + c.type), c.label, c.description || '', c.unit || '', services.datasets.valueLabelsText(c.valueLabels), c.sourceName]) });
        } else if (tab === 'comments') {
          await renderComments(ds, body);
          D.require('data/collab').markRead(ds.id).catch((err) => D.log('collab', err));
        } else if (tab === 'describe') {
          renderDescription(ds, body);
        } else if (tab === 'provenance') {
          replace(body, D.require('ui/kinds/provenance-view').create(ctx, ds));
        } else {
          const log = await services.datasets.log(ds.id);
          const changelog = D.require('data/changelog');
          replace(body, h('ul', { class: 'dm-list' }, log.map((e) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(e.action === 'comment' ? 'message-square' : 'history', 14),
            h('span', { class: 'dm-list-main' }, h('span', { text: `${i18n.formatDateTime(e.ts)} · ${changelog.actionLabel(e.action)}` }), h('span', { class: 'dm-list-sub dm-truncate', text: changelog.describe(e) }))))));
        }
      }

      /** Comments on the dataset and its columns: the list (resolve, delete) and a form for a new one. */
      /** The description by DCAT-AP-SE: what a data portal asks of a dataset. */
      function renderDescription(ds, body) {
        const dcat = D.require('data/dcat');
        const d = dcat.of(ds);
        const input = (key, attrs = {}) => {
          const el = /** @type {any} */ (h('dm-input', Object.assign({ label: t('dcat.' + key) }, attrs)));
          el.value = d[key] || '';
          el.addEventListener('input', () => { d[key] = el.value; });
          return el;
        };
        const choice = (key, options) => {
          const el = /** @type {any} */ (h('dm-select', { label: t('dcat.' + key) }));
          el.options = [{ value: '', label: t('field.choose') }].concat(options);
          el.value = d[key] || '';
          el.addEventListener('change', () => { d[key] = el.value; });
          return el;
        };
        const keywords = /** @type {any} */ (h('dm-input', { label: t('dcat.keywords'), help: t('gallery.labels.help') }));
        keywords.value = (d.keywords || []).join(', ');
        keywords.addEventListener('input', () => { d.keywords = keywords.value.split(',').map((x) => x.trim()).filter(Boolean); });
        const missing = h('p', { class: 'dm-help dm-small' });
        const showMissing = () => {
          const left = dcat.missing(d);
          missing.textContent = left.length ? t('dcat.missing', { list: left.map((k) => t('dcat.' + k)).join(', ') }) : t('dcat.complete');
        };
        showMissing();
        const save = ui.button({ label: t('common.save'), icon: 'save', variant: 'primary', onClick: async () => {
          try { await dcat.save(ds.id, d); showMissing(); shell.log(t('dcat.saved'), 'ok'); ui.toast.show(t('dcat.saved'), { kind: 'ok' }); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        } });
        const read = ui.button({ label: t('dcat.read'), icon: 'upload', title: t('dcat.read.hint'), onClick: async () => {
          const [file] = await services.files.pick({ accept: '.rdf,.xml' });
          if (!file) return;
          try { await dcat.save(ds.id, Object.assign({}, d, dcat.fromRdf(await file.text()))); render(); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        } });
        replace(body, h('div', { class: 'dm-card dm-stack' }, h('p', { class: 'dm-help', text: t('dcat.help') }),
          h('div', { class: 'dm-form-grid' }, input('title'), input('publisher'), input('contactName'), input('contactEmail', { type: 'email' })),
          input('description', { type: 'textarea', rows: '4' }), keywords,
          h('div', { class: 'dm-form-grid' },
            choice('theme', dcat.THEMES.map((x) => ({ value: x, label: t('dcat.theme.' + x) }))),
            choice('frequency', dcat.FREQUENCIES.map((x) => ({ value: x, label: t('dcat.frequency.' + x) }))),
            choice('license', dcat.LICENSES),
            input('temporalFrom', { type: 'date' }), input('temporalTo', { type: 'date' }), input('landingPage', { type: 'url' })),
          missing, h('div', { class: 'dm-row-wrap' }, save, read,
            ui.button({ label: t('dcat.export'), icon: 'file-output', title: t('dcat.export.hint'), onClick: async () => {
              try { const res = await services.exporter.exportDataset(ds.id, 'dcat'); services.files.download(res.blob, res.filename); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
            } }))));
      }
      async function renderComments(ds, body) {
        const comments = D.require('data/comments');
        const [list, cols, author] = await Promise.all([comments.list(ds.id), services.datasets.columns(ds.id), comments.author()]);
        const again = () => renderComments(ds, body).catch((err) => shell.log(String((err && err.message) || err), 'error'));
        const text = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('comments.new') }));
        const column = /** @type {any} */ (h('dm-select', { label: t('comments.column') }));
        column.options = [{ value: '', label: t('comments.column.all') }].concat(cols.map((c) => ({ value: c.name, label: c.label && c.label !== c.name ? `${c.name} (${c.label})` : c.name })));
        column.value = '';
        const name = /** @type {any} */ (h('dm-input', { label: t('comments.author'), help: t('comments.author.help') }));
        name.value = author;
        async function add() {
          try {
            if (name.value.trim() !== author) await comments.setAuthor(name.value);
            await comments.add(ds.id, { text: text.value, column: column.value || null });
            shell.log(t('comments.added'), 'ok');
            again();
          } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }
        const block = D.require('ui/kinds/comment-block');
        const items = list.map((c) => block.line(ctx, ds, c, again, { showTarget: true }));
        replace(body, h('div', { class: 'dm-stack' },
          list.length ? h('ul', { class: 'dm-list' }, items) : h('p', { class: 'dm-help', text: t('comments.empty') }),
          h('div', { class: 'dm-card dm-stack' }, text, h('div', { class: 'dm-form-grid' }, column, name),
            h('div', null, ui.button({ label: t('comments.add'), icon: 'message-square', variant: 'primary', onClick: add })))));
      }

      /** Read a linked file again (File System Access): the same import options, the recipe replayed. */
      async function refreshLinked(ds) {
        try {
          const res = await D.require('api/runner').refreshDataset(ds.id);
          const text = t('linked.refresh.done', { name: ds.name, rows: i18n.formatNumber(res.rows), steps: res.steps });
          shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
        } catch (err) {
          const message = (err && err.message) || String(err);
          shell.log(message, 'error'); ui.toast.show(message, { kind: 'error', timeout: 10000 });
        }
      }
      /** Fetch a dataset again from the API it came from (append or replace rows). */
      async function refetch(ds) {
        const choice = await ui.dialog.open({
          title: t('api.refetch.title', { name: ds.source.connectorName || ds.source.label || '' }),
          help: 'api-konfiguration#uppdatera-en-hämtad-datamängd',
          body: h('p', { text: t('api.refetch.text') }),
          actions: [{ label: t('common.cancel'), value: null }, { label: t('api.into.mode.append'), value: 'append' }, { label: t('api.saved.update'), variant: 'primary', value: 'update', primary: true }],
        });
        if (!choice) return;
        const runner = D.require('api/runner');
        shell.log(t('api.refetch.running', { name: ds.name }));
        try {
          let text;
          if (choice === 'update') {
            // The rows are replaced and the dataset's recipe is replayed (see api/runner refreshDataset).
            const res = await runner.refreshDataset(ds.id);
            text = res.steps ? t('api.refresh.done.steps', { name: ds.name, rows: i18n.formatNumber(res.rows), steps: res.steps }) : t('api.refresh.done', { name: ds.name, rows: i18n.formatNumber(res.rows) });
          } else {
            const table = await runner.refetch(ds.source);
            const res = await runner.intoDataset(ds.id, table, { mode: 'append', source: Object.assign({}, ds.source, { fetchedAt: new Date().toISOString(), rows: table.rows.length }) });
            text = t('api.into.appended', { name: ds.name, rows: i18n.formatNumber(res.rows) });
          }
          shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
          render();
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
      }

      /** Badges in the head: documents and pages, pictures, or rows and columns. */
      /** Starts or stops watching a dataset's source; the button finds out by itself which it is. */
      function watchButton(ds) {
        const btn = ui.button({ label: t('watch.on'), icon: 'eye', title: t('watch.on.hint'), onClick: async () => {
          const on = !(await watches.get(ds.id));
          try {
            const w = await watches.setWatched(ds.id, on);
            shell.log(t(on ? 'watch.started' : 'watch.stopped', { name: ds.name }), 'ok');
            if (w && w.state === 'error') ui.toast.show(w.error, { kind: 'error' });
          } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
          render();
        } });
        watches.get(ds.id).then((w) => {
          if (!w) return;
          btn.setAttribute('label', t('watch.off'));
          btn.setAttribute('title', t('watch.off.hint'));
        });
        return btn;
      }
      function kindBadges(ds) {
        return kinds.badges(ds).flatMap((text, i) => (i ? [' ', h('dm-badge', { text })] : [h('dm-badge', { text })]));
      }
      /** Open a collection in Bearbeta's own view, at a document or picture when given. */
      function openView(ds, extra) {
        store.set(Object.assign({ selectedId: ds.id }, extra || {}));
        shell.activate('bearbeta');
      }
      /** The documents of a collection: click one to read it. */
      function documentList(ds) {
        const docs = Array.isArray(ds.documents) ? ds.documents : [];
        if (!docs.length) return null;
        const fmtDate = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d.getTime()) ? String(v) : i18n.formatDateTime(d); };
        return h('div', { class: 'dm-stack-sm' },
          h('h3', { text: t('hantera.documents.title') }),
          h('div', { class: 'dm-list' }, docs.map((d) => h('button', { type: 'button', class: 'dm-list-item', 'data-tip': t('hantera.read.one', { name: d.name }), onclick: () => openView(ds, { openDocument: { datasetId: ds.id, document: d.name } }) },
            ui.icon('file-text', 16),
            h('span', { class: 'dm-list-main' },
              h('span', { class: 'dm-truncate', text: d.title && d.title !== d.name ? `${d.title} (${d.name})` : d.name }),
              h('span', { class: 'dm-list-sub dm-truncate', text: [d.type ? String(d.type).toUpperCase() : '', d.pages ? t('document.pages.n', { n: i18n.formatNumber(d.pages) }) : '', d.words !== undefined ? t('hantera.documents.words', { n: i18n.formatNumber(d.words) }) : '', d.author || '', fmtDate(d.created || d.modified)].filter(Boolean).join(' · ') }))))));
      }
      /** The first pictures of a collection as thumbnails: click one to open it in the gallery. */
      async function imageGrid(ds) {
        const dsFiles = D.require('data/dataset-files');
        const rows = await services.datasets.query(ds.id, { limit: 24 });
        if (!rows.length) return null;
        const items = [];
        for (const r of rows) {
          const name = String(r[0] || '');
          const url = await dsFiles.url(ds.id, name, 'thumb').catch(() => null);
          items.push(h('button', { type: 'button', class: 'dm-photos-item', 'data-tip': name, onclick: () => openView(ds, { openImage: { datasetId: ds.id, name } }) },
            h('span', { class: 'dm-photos-thumb' }, url ? h('img', { src: url, alt: name, loading: 'lazy' }) : ui.icon('image', 24)),
            h('span', { class: 'dm-photos-caption' }, h('span', { class: 'dm-truncate', text: name }))));
        }
        const total = ds.images && ds.images.count ? ds.images.count : ds.rowCount || rows.length;
        return h('div', { class: 'dm-stack-sm' },
          h('h3', { text: t('hantera.images.title') }),
          h('div', { class: 'dm-photos dm-photos-preview-grid' }, items),
          total > rows.length ? h('p', { class: 'dm-help', text: t('hantera.images.more', { n: i18n.formatNumber(total - rows.length) }) }) : null);
      }

      /** Human-readable origin of a dataset. */
      function describeSource(src) {
        if (!src) return '';
        if (src.kind === 'bridge') return [t('bridge.title'), src.label, src.fetchedAt ? t('api.fetched.at', { date: i18n.formatDateTime(src.fetchedAt) }) : ''].filter(Boolean).join(' · ');
        if (src.kind === 'api') return [src.connectorName, src.table && src.table.title ? src.table.title : src.endpointName, src.fetchedAt ? t('api.fetched.at', { date: i18n.formatDateTime(src.fetchedAt) }) : '', src.license ? `(${src.license})` : ''].filter(Boolean).join(' · ');
        if (src.publisher) return [src.publisher, src.table, src.license ? `(${src.license})` : ''].filter(Boolean).join(' · ');
        if (src.fileName) return `${src.fileName}${src.format ? ` (${src.format})` : ''}${src.linked ? ' · ' + t('linked.label') : ''}`;
        if (src.kind === 'paste') return t('import.sources.paste');
        if (src.kind === 'files') return t('import.source.files', { n: Array.isArray(src.files) ? src.files.length : 0, format: src.format === 'images' ? t('import.format.images.short') : t('import.format.documents.short') });
        return src.kind || '';
      }

      function renderInspector(ds) {
        const desc = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '4', label: t('common.description') }));
        desc.value = ds.description || '';
        desc.addEventListener('change', async () => { await services.datasets.updateMeta(ds.id, { description: desc.value }); shell.log(t('datasets.saved'), 'ok'); });
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('datasets.folder'), value: ds.folder || null },
          { label: t('datasets.tags'), value: (ds.tags || []).length ? h('span', null, ds.tags.map((tag) => h('span', { class: 'dm-chip dm-chip-static', text: tag }))) : null },
          { label: t('common.id'), value: h('code', { text: ds.id }) }, { label: t('common.size'), value: i18n.formatBytes(ds.byteSize || 0) },
        ];
        replace(slots.right, desc, kv);
      }

      async function rename(ds) {
        // Name and short name together: the short name is what SQL, R and chart files refer to.
        const nameIn = /** @type {any} */ (h('dm-input', { label: t('common.name') })); nameIn.value = ds.name;
        const shortIn = /** @type {any} */ (h('dm-input', { label: t('datasets.shortname'), help: t('datasets.shortname.help'), mono: true })); shortIn.value = ds.shortName || '';
        const ok = await ui.dialog.open({ title: t('common.rename'), body: h('div', { class: 'dm-stack' }, nameIn, shortIn), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        const patch = {};
        if (nameIn.value.trim() && nameIn.value.trim() !== ds.name) patch.name = nameIn.value.trim();
        if (shortIn.value.trim() && shortIn.value.trim() !== (ds.shortName || '')) patch.shortName = shortIn.value.trim();
        if (!Object.keys(patch).length) return;
        try { await services.datasets.updateMeta(ds.id, patch); shell.log(t('datasets.renamed'), 'ok'); }
        catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function remove(ds) {
        if (await ui.dialog.confirm(t('datasets.delete.confirm', { name: ds.name }), { okLabel: t('common.delete'), danger: true })) {
          await services.datasets.remove(ds.id);
          shell.log(t('datasets.deleted', { name: ds.name }), 'ok');
          ui.toast.show(t('datasets.deleted', { name: ds.name }), { kind: 'ok' });
        }
      }

      async function renderWorkspace() {
        const est = await services.idb.estimate();
        const persisted = await services.idb.persisted();
        const folderEl = await folderCard();
        const restoreZone = h('dm-dropzone', { text: t('datasets.restore'), hint: t('datasets.restore.hint'), accept: '.zip', icon: 'package' });
        restoreZone.addEventListener('dm-files', async (e) => {
          const file = /** @type {any} */ (e).detail.files[0];
          try {
            const opened = await services.workspace.inspect(file);
            let replaceIds = [];
            // A bundle shows its message and changes first; datasets that already exist can take its version.
            if (opened.manifest && opened.manifest.kind === 'bundle') {
              const choice = await share.incomingSummary(ctx, opened, t('bundle.open.title', { name: opened.manifest.name || t('bundle.default.name') }));
              if (!choice) return;
              replaceIds = choice.replaceIds;
            }
            share.reportRestore(ctx, await services.workspace.restore(opened, { replaceIds }));
          } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(t('common.error') + ': ' + ((err && err.message) || err), { kind: 'error' }); }
        });
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('hard-drive', 20), t('datasets.storage.title'))),
          h('div', { class: 'dm-card dm-stack' },
            h('p', { text: t('datasets.storage.text') }),
            h('div', { class: 'dm-stats-grid' },
              stat(i18n.formatBytes(est && est.usage || 0), t('datasets.storage.used')),
              stat(est && est.quota ? i18n.formatBytes(est.quota) : '–', t('datasets.storage.quota')),
              stat(String(store.get().datasets.length), t('shell.datasets')),
              stat(persisted ? t('datasets.persist.granted') : t('datasets.persist.denied'), t('datasets.persist.label'))),
            h('div', { class: 'dm-row-wrap' },
              persisted ? null : ui.button({ label: t('datasets.persist.request'), icon: 'lock', onClick: async () => { const ok = await services.idb.requestPersist(); shell.log(t('datasets.persist', { state: ok ? t('datasets.persist.granted') : t('datasets.persist.denied') }), ok ? 'ok' : 'warn'); render(); } }),
              apiDatasets().length ? ui.button({ label: t('api.refresh.all', { n: apiDatasets().length }), icon: 'refresh-cw', onClick: refreshAllApi }) : null)),
          h('div', { class: 'dm-form-grid' },
            h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('datasets.backup') }), h('p', { class: 'dm-help', text: t('datasets.backup.hint') }),
              h('div', null, ui.button({ label: t('datasets.backup'), icon: 'download', variant: 'primary', onClick: backup })),
              backupInfo()),
            h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('datasets.restore') }), restoreZone)),
          folderEl,
          await settings.networkCard(ctx, render),
          await settings.componentsCard(ctx, render));
      }

      function apiDatasets() { return store.get().datasets.filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge')); }

      /** Re-fetch every API-sourced dataset (replace mode), one after the other, with progress in a toast. */
      async function refreshAllApi() {
        const runner = D.require('api/runner');
        const abort = new AbortController();
        const toast = ui.toast.show(t('api.refresh.all.running', { name: '', done: 0, total: apiDatasets().length }), { kind: 'info', timeout: 0, action: { label: t('api.cancel'), onClick: () => abort.abort() } });
        try {
          const results = await runner.refreshAll({ signal: abort.signal, onProgress: (p) => { const el = toast.querySelector('.dm-toast-text'); if (el) el.textContent = t('api.refresh.all.running', { name: p.name, done: p.done, total: p.total }); } });
          const ok = results.filter((r) => r.ok).length; const failed = results.length - ok;
          for (const r of results) shell.log(r.ok ? t('api.into.replaced', { name: r.name, rows: i18n.formatNumber(r.rows || 0) }) : `${r.name}: ${r.error}`, r.ok ? 'ok' : 'error');
          ui.toast.show(t('api.refresh.all.done', { ok, failed }), { kind: failed ? 'warn' : 'ok', timeout: 10000 });
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
        finally { toast.remove(); }
      }

      /** Portable folder card (File System Access; Chromium only, see platform/storage/folder-store.js). */
      async function folderCard() {
        const items = [h('h3', { text: t('folder.title') }), h('p', { class: 'dm-help', text: t('folder.text') })];
        if (!folder.supported()) {
          items.push(h('p', { class: 'dm-muted dm-small', text: t('folder.unsupported') }));
          return h('div', { class: 'dm-card dm-stack' }, items);
        }
        const root = await folder.current();
        const perm = await folder.permission(root);
        const status = services.workspace.folderStatus();
        const auto = await services.workspace.autoSaveSetting();
        items.push(h('p', { class: 'dm-small', text: root ? t('folder.current', { name: root.name }) : t('folder.none') }));
        if (root && perm !== 'granted') items.push(h('p', { class: 'dm-muted dm-small', text: t('folder.permission.prompt') }));
        if (status.lastSync) items.push(h('p', { class: 'dm-faint dm-xs', text: t('folder.last', { time: i18n.formatDateTime(status.lastSync) }) }));
        if (status.error) items.push(h('p', { class: 'dm-error dm-small', text: t('folder.error', { message: status.error }) }));
        const fail = (err) => {
          if (err && err.name === 'AbortError') return;
          const text = t('folder.error', { message: String((err && err.message) || err) });
          shell.log(text, 'error'); ui.toast.show(text, { kind: 'error', timeout: 12000 });
          render();
        };
        const done = (text) => { shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' }); render(); };
        items.push(h('div', { class: 'dm-row' },
          ui.button({ label: root ? t('folder.change') : t('folder.choose'), icon: 'folder', onClick: () => folder.choose().then(() => render()).catch(fail) }),
          root && perm !== 'granted' ? ui.button({ label: t('folder.reconnect'), icon: 'refresh-cw', onClick: () => folder.permission(root, true).then(() => render()).catch(fail) }) : null,
          root && perm === 'granted' ? ui.button({ label: t('folder.save'), icon: 'save', loading: status.busy, onClick: () => services.workspace.saveToFolder(root, { force: true }).then((res) => done(t('folder.saved', { n: res.datasets, name: root.name }))).catch(fail) }) : null,
          root && perm === 'granted' ? ui.button({ label: t('folder.load'), icon: 'upload', onClick: () => services.workspace.loadFromFolder(root).then((res) => { for (const s of res.skipped) shell.log(s, 'warn'); done(t('folder.loaded', { n: res.imported.length, skipped: res.existing })); }).catch(fail) }) : null,
          root ? ui.button({ label: t('folder.disconnect'), icon: 'x', onClick: () => services.workspace.setAutoSaveSetting(false).then(() => folder.disconnect()).then(() => render()).catch(fail) }) : null));
        if (root) {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('folder.autosave') }));
          sw.checked = auto;
          sw.addEventListener('change', () => {
            services.workspace.setAutoSaveSetting(sw.checked)
              .then(() => (sw.checked && perm === 'granted' ? services.workspace.saveToFolder(root).then(() => render()) : null))
              .catch(fail);
          });
          items.push(sw);
        }
        return h('div', { class: 'dm-card dm-stack' }, items);
      }

      function stat(value, label) { return h('div', { class: 'dm-stat' }, h('span', { class: 'dm-stat-value', text: value }), h('span', { class: 'dm-stat-label', text: label })); }

      async function backup() {
        try {
          shell.setStatus('saving');
          const { blob, count } = await services.workspace.backup();
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
          services.files.download(blob, t('datasets.backup.file', { stamp }));
          shell.log(t('datasets.backup.done') + ' ' + t('datasets.backup.stats', { count, size: i18n.formatBytes(blob.size) }), 'ok');
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
        shell.setStatus('saved');
        render();
      }

      /** Last backup time and the reminder interval (filled in asynchronously). */
      function backupInfo() {
        const el = h('div', { class: 'dm-stack-sm' });
        services.workspace.backupStatus().then((st) => {
          const sel = /** @type {any} */ (h('dm-select', { label: t('backup.remind') }));
          sel.options = [{ value: '0', label: t('backup.remind.off') }].concat([7, 14, 30, 90].map((n) => ({ value: String(n), label: t('backup.remind.days', { n }) })));
          sel.value = String(st.remindDays);
          sel.addEventListener('change', () => { services.workspace.setRemindDays(Number(sel.value)); });
          const when = st.lastAt ? new Date(st.lastAt).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
          replace(el, h('p', { class: st.due ? 'dm-warn dm-small' : 'dm-help', text: st.lastAt ? t('backup.last', { when }) : t('backup.last.never') }), sel);
        }).catch(() => {});
        return el;
      }

      function renderWorkspaceInspector() {
        const c = D.capabilities;
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('env.protocol'), value: c.protocol },
          { label: t('env.browser'), value: c.isFirefox ? 'Firefox' : c.isChromium ? 'Chromium' : t('env.browser.unknown') },
          { label: t('env.indexeddb'), value: c.indexedDB ? t('common.yes') : t('common.no') },
          { label: t('env.folder'), value: c.fileSystemAccess ? t('common.yes') : t('common.no') },
          { label: t('env.sab'), value: c.sharedArrayBuffer ? t('common.yes') : t('common.no') },
        ];
        replace(slots.right, h('h4', { text: t('env.title') }), kv);
      }

      // Command palette: re-fetch API datasets (sharing lives in Dela).
      if (ctx.palette) {
        ctx.palette.register(() => (apiDatasets().length ? [{ id: 'api:refresh', label: t('api.refresh.all', { n: apiDatasets().length }), group: t('palette.group.actions'), icon: 'refresh-cw', run: () => refreshAllApi() }] : []));
      }

      return { id: 'hantera', activate, deactivate };
    }
    return { createMode, WORKSPACE };
  });
})();
