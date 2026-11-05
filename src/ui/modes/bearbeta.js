// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Bearbeta": the editable table (double-click a cell), text filter and sorting, column
 * statistics with quick actions, the operations palette, undo, data-quality profile, versions and
 * the recipe view. Every change is a logged recipe step that can be undone.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/bearbeta', ['ui/base', 'ui/dialogs', 'data/recipes', 'ui/bearbeta/document-view', 'ui/bearbeta/gallery-view', 'ui/bearbeta/map-view', 'ui/bearbeta/plan-view', 'ui/bearbeta/graph-view', 'ui/bearbeta/model-view', 'viz/leaflet', 'data/kinds'], (base, dialogs, recipes, documentViewModule, galleryViewModule, mapViewModule, planViewModule, graphViewModule, modelViewModule, leaflet, kinds) => {
    const { h, t, i18n, replace } = base;
    /**
     * Views of their own: document collections, image collections and (for tables with geometry) the map; the table
     * is one click away. Keyed by view id: the dataset kind, or 'map' for a table with geometry or coordinates.
     */
    const KIND_VIEWS = { document: documentViewModule, images: galleryViewModule, map: mapViewModule, plan: planViewModule, graph: graphViewModule, model: modelViewModule };
    const VIEW_ICONS = { document: 'file-text', images: 'images', map: 'map', plan: 'layers', graph: 'share-2', model: 'box' };
    const QUICK = [
      { op: 'rename_column', icon: 'pencil' }, { op: 'set_label', icon: 'info' }, { op: 'set_value_labels', icon: 'list-ordered' }, { op: 'apply_value_labels', icon: 'arrow-up-down', labelled: true }, { op: 'set_type', icon: 'braces' }, { op: 'trim', icon: 'wand-sparkles', textOnly: true },
      { op: 'replace_text', icon: 'search', textOnly: true }, { op: 'change_case', icon: 'file-text', textOnly: true }, { op: 'fix_encoding', icon: 'refresh-cw', textOnly: true },
      { op: 'clusters', icon: 'layers', textOnly: true }, { op: 'replace_value', icon: 'pencil' }, { op: 'fill_missing', icon: 'rows-3' }, { op: 'pseudonymize', icon: 'key-round' }, { op: 'split_column', icon: 'columns-3', textOnly: true }, { op: 'drop_columns', icon: 'trash-2' },
    ];

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubscribe = null; let table = null; let search = ''; let searchTimer = 0; let currentId = null;
      /** A saved list (Söka) that narrows the table, and its WHERE clause. */
      let activeList = null; let listWhere = null; let usingSelection = false;
      /** @type {Map<number, number>} table row index -> SQLite rowid */
      let rowIds = new Map();
      let undoBtn = null; let selectedColumn = null;
      /** Table or kind view for the current dataset; the kind view is created once per view id. */
      let showTable = true; let kindView = null; let kindViewFor = null; let lastUpdated = null; let viewId = null;
      /** The view a dataset opens in by default: its kind's view, the map for tables with geometry or longitude/latitude, else null. */
      async function defaultView(ds) {
        if (kinds.of(ds).view) return kinds.of(ds).view;
        { const cols = await services.datasets.columns(ds.id).catch(() => []); if (leaflet.mapDefault(cols) && await leaflet.drawable(ds.id).catch(() => false)) return 'map'; }
        return null;
      }

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) render(); });
        render();
      }
      function deactivate() { slots = null; table = null; currentId = null; if (unsubscribe) unsubscribe(); if (kindView) { kindView.destroy(); kindView = null; kindViewFor = null; } }

      function current() { const state = store.get(); return state.datasets.find((d) => d.id === state.selectedId) || null; }

      function render() {
        if (!slots) return;
        const state = store.get();
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        const ds = current();
        if (!ds) {
          currentId = null;
          replace(slots.center, h('dm-empty-state', { icon: 'wand-sparkles', heading: t('bearbeta.empty'), text: state.datasets.length ? t('shell.select.dataset') : t('shell.no.datasets.hint') },
            state.datasets.length ? null : ui.button({ label: t('mode.inhamta'), icon: 'download', variant: 'primary', onClick: () => shell.activate('inhamta') })));
          replace(slots.right, h('p', { class: 'dm-help', text: t('bearbeta.empty.hint') }));
          return;
        }
        if (currentId !== ds.id) {
          search = ''; selectedColumn = null; activeList = null; listWhere = null; usingSelection = false; currentId = ds.id; lastUpdated = ds.updatedAt;
          defaultView(ds).then((id) => { if (currentId !== ds.id || !slots) return; viewId = id; showTable = !id; renderMain(ds); });
        } else if (showTable) { if (table) { refresh(ds); updateUndo(); } }
        else if (ds.updatedAt !== lastUpdated) { lastUpdated = ds.updatedAt; renderMain(ds); }
      }

      /** The table, or the document, gallery or map view. */
      function renderMain(ds) {
        const mod = viewId ? KIND_VIEWS[viewId] : null;
        if (showTable || !mod) { renderTable(ds); renderInspector(ds); return; }
        table = null;
        if (kindView && kindViewFor !== viewId) { kindView.destroy(); kindView = null; }
        if (!kindView) {
          kindView = mod.create(ctx, {
            onTable: () => { showTable = true; const d = current(); if (d) renderMain(d); },
            onChanged: () => updateUndo(),
            // A collection with places can also be seen on a map, and go back to its own view from there.
            onMap: () => { viewId = 'map'; const d = current(); if (d) renderMain(d); },
            onOwnView: viewId === 'map' && kinds.of(ds).view ? () => { viewId = kinds.of(ds).view; const d = current(); if (d) renderMain(d); } : null,
          });
          kindViewFor = viewId;
        }
        kindView.render(ds, slots).catch((err) => shell.log(String((err && err.message) || err), 'error'));
      }

      function dialogCtx(ds, columns) {
        return {
          datasetId: ds.id, columns,
          onApplied: () => { const d = current(); if (d) { refresh(d); if (selectedColumn) showStats(d, selectedColumn); } },
          onDerived: (meta) => { store.set({ selectedId: meta.id }); },
        };
      }

      // Command palette: every operation, run on the selected dataset.
      if (ctx.palette) {
        ctx.palette.register(async () => {
          const ds = current();
          if (!ds) return [];
          const cmds = [];
          for (const g of dialogs.GROUPS) {
            for (const id of g.ops) {
              cmds.push({
                id: 'op:' + id, label: t('op.' + id), hint: t('palette.op.hint', { name: ds.name }), group: t('palette.group.ops'), icon: 'wand-sparkles', keywords: [t('op.group.' + g.id)],
                run: async () => { shell.activate('bearbeta'); const cols = await services.datasets.columns(ds.id); await dialogs.run(dialogCtx(ds, cols), id); },
              });
            }
          }
          cmds.push({ id: 'rules', label: t('bearbeta.rules'), hint: t('palette.op.hint', { name: ds.name }), group: t('palette.group.ops'), icon: 'circle-alert', run: async () => { shell.activate('bearbeta'); const cols = await services.datasets.columns(ds.id); await dialogs.rulesDialog(dialogCtx(ds, cols)); } });
          cmds.push({ id: 'profile', label: t('bearbeta.profile'), hint: t('palette.op.hint', { name: ds.name }), group: t('palette.group.ops'), icon: 'circle-check', run: async () => { shell.activate('bearbeta'); const cols = await services.datasets.columns(ds.id); await dialogs.profileDialog(dialogCtx(ds, cols)); } });
          return cmds;
        });
      }

      async function renderTable(ds) {
        const cols = await services.datasets.columns(ds.id);
        const ownView = await viewFor(ds, cols);
        const searchInput = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('table.filter.placeholder'), 'aria-label': t('common.filter'), inline: true }));
        searchInput.value = search;
        searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { search = searchInput.value.trim(); refresh(current()); }, 300); });
        const countBadge = h('dm-badge', { text: '' });
        // Lists saved in Söka for this dataset narrow the table (search lists; query lists live in Fråga).
        const listsMod = D.require('data/lists');
        const selectionMod = D.require('data/selection');
        const myLists = (await listsMod.list()).filter((l) => l.datasetId === ds.id && (l.kind || 'search') !== 'query');
        const chosen = selectionMod.whereOf(ds.id);
        const listSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('bearbeta.list'), inline: true }));
        listSel.options = [{ value: '', label: t('bearbeta.list.none') }].concat(chosen ? [{ value: '__selection', label: t('selection.option', { n: i18n.formatNumber(selectionMod.get().rowids.length) }) }] : [], myLists.map((l) => ({ value: l.id, label: t('bearbeta.list.option', { name: l.name }) })));
        listSel.value = activeList ? activeList.id : (usingSelection && chosen ? '__selection' : '');
        listSel.addEventListener('change', () => {
          usingSelection = listSel.value === '__selection';
          activeList = myLists.find((l) => l.id === listSel.value) || null;
          listWhere = usingSelection ? selectionMod.whereOf(ds.id) : activeList ? listsMod.whereOf(activeList, cols, kinds.of(ds).sideSearch || null) : null;
          refresh(current());
        });
        // What the table now shows can follow to the other modes.
        const useBtn = ui.button({ label: t('selection.use'), icon: 'list-checks', title: t('selection.use.hint'), onClick: async () => {
          const parts = [];
          const params = [];
          if (search) { const w = D.require('analysis/search').where(cols, search, []); parts.push(w.sql); params.push(...w.params); }
          if (listWhere) { parts.push(listWhere.sql); params.push(...listWhere.params); }
          const made = await selectionMod.setFromWhere(ds.id, parts.map((p) => `(${p})`).join(' and '), params);
          ui.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
          renderTable(current());
        } });
        undoBtn = ui.button({ label: t('common.undo'), icon: 'history', onClick: async () => { try { const label = await recipes.undo(ds.id); shell.log(t('bearbeta.undone', { label }), 'ok'); refresh(current()); if (selectedColumn) showStats(current(), selectedColumn); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'warn' }); } updateUndo(); } });
        table = /** @type {any} */ (h('dm-table'));
        table.editable = true;
        table.addEventListener('dm-column', (e) => { selectedColumn = /** @type {any} */ (e).detail.column.key; showStats(ds, selectedColumn); });
        table.addEventListener('dm-cell-commit', (e) => commitCell(ds, /** @type {any} */ (e).detail));
        table.addEventListener('dm-row', (e) => showRowPictures(ds, /** @type {any} */ (e).detail.row).catch((err) => D.log('bearbeta', err)));
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('wand-sparkles', 20), ds.name),
            h('div', { class: 'dm-toolbar' },
              searchInput, myLists.length || chosen ? listSel : null, countBadge, useBtn,
              ui.button({ label: t('bearbeta.actions'), icon: 'sparkles', variant: 'primary', 'data-course': 'actions', onClick: async () => dialogs.palette(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              undoBtn,
              // Back to the dataset's own view: documents, pictures, or the map for a table with geometry or coordinates.
              ownView ? ui.button({ label: t('bearbeta.view.' + ownView), icon: VIEW_ICONS[ownView], title: t('bearbeta.view.' + ownView + '.hint'), onClick: () => { viewId = ownView; showTable = false; const d = current(); if (d) renderMain(d); } }) : null,
              ui.button({ label: t('bearbeta.profile'), icon: 'circle-check', onClick: async () => dialogs.profileDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.rules'), icon: 'circle-alert', onClick: async () => dialogs.rulesDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.versions'), icon: 'history', onClick: async () => dialogs.versionsDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.recipe'), icon: 'list', onClick: async () => dialogs.recipeDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }))),
          h('p', { class: 'dm-help', text: t('bearbeta.edit.hint') }),
          h('div', { class: 'dm-table-wrap dm-center-fill' }, table));
        table.countBadge = countBadge;
        await refresh(ds);
        updateUndo();
        // A search hit in a plain table: the row is chosen and in view.
        const pending = store.get().openRow;
        if (pending && pending.datasetId === ds.id && table) {
          store.set({ openRow: null });
          const engine = (await services.datasets.ensureOpen(ds.id)).engine;
          const before = await engine.exec('select count(*) from data where rowid < ?', [Number(pending.rowid)]);
          if (table) table.selectRow(Number(before[0].values[0][0]), true);
        }
      }

      /** The own view a dataset can switch to from the table (any table with geometry or coordinates gets the map). */
      async function viewFor(ds, cols) {
        if (kinds.of(ds).view) return kinds.of(ds).view;
        return leaflet.mappable(cols) && await leaflet.drawable(ds.id).catch(() => false) ? 'map' : null;
      }

      function updateUndo() {
        const ds = current();
        if (!undoBtn || !ds) return;
        const can = recipes.canUndo(ds.id);
        undoBtn.disabled = !can;
        undoBtn.setAttribute('title', can ? t('bearbeta.undo.title', { label: recipes.undoLabel(ds.id) }) : t('bearbeta.undo.none'));
      }

      async function refresh(ds) {
        if (!table || !ds) return;
        let cols; let total;
        try {
          cols = await services.datasets.columns(ds.id);
          total = await services.datasets.count(ds.id, { search, where: listWhere || undefined });
        } catch (err) {
          // The dataset can be removed (here or in another tab) while the table reloads; only report other errors.
          if (await services.datasets.get(ds.id)) shell.log(String((err && err.message) || err), 'error');
          return;
        }
        rowIds = new Map();
        table.countBadge.textContent = (search || listWhere) ? t('table.rows.shown', { shown: i18n.formatNumber(total), total: i18n.formatNumber(ds.rowCount) }) : t('common.rows', { n: i18n.formatNumber(total) });
        const data = {
          columns: cols.map((c) => ({ key: c.name, label: c.label || c.name, type: c.type, description: c.description, unit: c.unit })),
          rowCount: total,
          rowProvider: async (start, count, sort) => {
            const rows = await services.datasets.query(ds.id, { limit: count, offset: start, search, where: listWhere || undefined, orderBy: sort ? sort.key : undefined, dir: sort ? sort.dir : undefined, withRowId: true });
            return rows.map((r, i) => { rowIds.set(start + i, r[0]); return r.slice(1); });
          },
        };
        // After the first load, keep the scroll position and selection (saves happen 1.5 s after an edit).
        if (table.loaded) table.updateData(data); else { table.setData(data); table.loaded = true; }
      }

      async function commitCell(ds, detail) {
        const rowid = rowIds.get(detail.rowIndex);
        if (rowid === undefined) return;
        try {
          const result = await recipes.apply(ds.id, 'edit_cell', { rowid, column: detail.column.key, value: detail.value });
          table.setCell(detail.rowIndex, detail.colIndex, result.value);
          shell.log(t('bearbeta.cell.saved', { column: detail.column.key }), 'ok');
        } catch (err) {
          ui.toast.show(String((err && err.message) || err), { kind: 'error' });
          table.setCell(detail.rowIndex, detail.colIndex, detail.original);
        }
        updateUndo();
      }

      /** A row that names pictures shows them; other rows leave the inspector as it is. */
      async function showRowPictures(ds, row) {
        if (!row) return;
        const cols = await services.datasets.columns(ds.id);
        const value = (name) => row[cols.findIndex((c) => c.name === name)];
        const open = (albumId, name) => store.set({ selectedId: albumId, openImage: { datasetId: albumId, name } });
        const pictures = await D.require('ui/kinds/row-pictures').create(ds.id, value, open);
        if (pictures && slots) replace(slots.right, h('h4', { text: t('table.row.pictures') }), pictures);
      }
      function renderInspector(ds) {
        replace(slots.right, h('p', { class: 'dm-help', text: t('table.select.column') }));
      }

      async function showStats(ds, columnName) {
        replace(slots.right, h('h4', { text: t('table.column.stats') }), h('p', { class: 'dm-help', text: t('common.loading') }));
        try {
          const cols = await services.datasets.columns(ds.id);
          const column = cols.find((c) => c.name === columnName);
          if (!column) { renderInspector(ds); return; }
          const s = await services.datasets.columnStats(ds.id, columnName);
          const notes = (await D.require('data/comments').list(ds.id)).filter((c) => c.column === columnName);
          const fmt = (v) => (v === null || v === undefined ? '–' : (typeof v === 'number' ? i18n.formatNumber(v, { maximumFractionDigits: 4 }) : String(v)));
          // Codes are shown with their value label, as in "1 = Man".
          const labelOf = new Map(column.valueLabels && column.valueLabels.values === 'codes' ? column.valueLabels.labels.map(([code, label]) => [String(code), label]) : []);
          const codeLabel = (v) => (labelOf.has(String(v)) ? `${v} = ${labelOf.get(String(v))}` : String(v));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.type'), value: t('type.' + s.column.type) },
            column.description ? { label: t('column.description'), value: column.description } : null,
            column.unit ? { label: t('column.unit'), value: column.unit } : null,
            column.valueLabels ? { label: t('column.valuelabels'), value: services.datasets.valueLabelsText(column.valueLabels) } : null,
            { label: t('table.stats.count'), value: i18n.formatNumber(s.total) },
            { label: t('table.stats.nulls'), value: i18n.formatNumber(s.nulls) },
            { label: t('table.stats.distinct'), value: i18n.formatNumber(s.distinct) },
            { label: t('table.stats.min'), value: fmt(s.min) },
            { label: t('table.stats.max'), value: fmt(s.max) },
            s.mean !== null && s.mean !== undefined ? { label: t('table.stats.mean'), value: fmt(s.mean) } : null,
            s.sum !== null && s.sum !== undefined ? { label: t('table.stats.sum'), value: fmt(s.sum) } : null,
          ].filter(Boolean);
          const actions = QUICK.filter((a) => (!a.textOnly || column.type === 'text') && (!a.labelled || column.valueLabels)).map((a) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => dialogs.run(dialogCtx(ds, cols), a.op, presetFor(a.op, column)) }, ui.icon(a.icon, 14), h('span', { class: 'dm-list-main', text: t('op.' + a.op) })));
          replace(slots.right,
            h('h4', { text: column.label || column.name }), kv,
            h('h4', { text: t('bearbeta.quick') }), h('div', { class: 'dm-list' }, actions),
            h('h4', { text: t('table.stats.top') }),
            h('ul', { class: 'dm-top-values' }, s.top.map(([v, n]) => h('li', null, h('span', { class: 'dm-truncate', text: codeLabel(v) }), h('span', { class: 'dm-muted dm-num', text: i18n.formatNumber(n) })))),
            h('h4', { text: t('comments.title') }),
            notes.length ? h('ul', { class: 'dm-list' }, notes.map((c) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(c.resolved ? 'check' : 'message-square', 14),
              h('span', { class: 'dm-list-main' + (c.resolved ? ' dm-muted' : '') }, h('span', { class: 'dm-small', text: `${c.author || t('comments.anonymous')} · ${i18n.formatDateTime(c.ts)}` }), h('span', { text: c.text }))))) : h('p', { class: 'dm-help', text: t('comments.column.none') }),
            h('div', null, ui.button({ label: t('comments.add.column'), icon: 'message-square', onClick: () => commentDialog(ds, column) })));
        } catch (err) { replace(slots.right, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); }
      }

      /** A comment on a column, from the inspector; it is also listed under Hantera > Comments. */
      async function commentDialog(ds, column) {
        const comments = D.require('data/comments');
        const author = await comments.author();
        const text = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '4', label: t('comments.new') }));
        const name = /** @type {any} */ (h('dm-input', { label: t('comments.author'), help: t('comments.author.help') }));
        name.value = author;
        const ok = await ui.dialog.open({ title: t('comments.add.title', { column: column.label || column.name }), body: h('div', { class: 'dm-stack' }, text, name), actions: [{ label: t('common.cancel'), value: false }, { label: t('comments.add'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        try {
          if (name.value.trim() !== author) await comments.setAuthor(name.value);
          await comments.add(ds.id, { text: text.value, column: column.name });
          shell.log(t('comments.added'), 'ok');
          showStats(ds, column.name);
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function presetFor(opId, column) {
        if (['trim', 'replace_text', 'change_case', 'fix_encoding', 'drop_columns'].includes(opId)) return { columns: [column.name] };
        if (opId === 'set_label') return { column: column.name, label: column.label || column.name, description: column.description || '', unit: column.unit || '' };
        if (opId === 'apply_value_labels') return { column: column.name, direction: column.valueLabels && column.valueLabels.values === 'labels' ? 'codes' : 'labels' };
        return { column: column.name };
      }

      return { id: 'bearbeta', activate, deactivate };
    }
    return { createMode };
  });
})();
