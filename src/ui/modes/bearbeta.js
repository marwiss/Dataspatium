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
  D.define('ui/modes/bearbeta', ['ui/base', 'ui/dialogs', 'data/recipes'], (base, dialogs, recipes) => {
    const { h, t, i18n, replace } = base;
    const QUICK = [
      { op: 'rename_column', icon: 'pencil' }, { op: 'set_label', icon: 'info' }, { op: 'set_type', icon: 'braces' }, { op: 'trim', icon: 'wand-sparkles', textOnly: true },
      { op: 'replace_text', icon: 'search', textOnly: true }, { op: 'change_case', icon: 'file-text', textOnly: true }, { op: 'fix_encoding', icon: 'refresh-cw', textOnly: true },
      { op: 'clusters', icon: 'layers', textOnly: true }, { op: 'replace_value', icon: 'pencil' }, { op: 'fill_missing', icon: 'rows-3' }, { op: 'pseudonymize', icon: 'key-round' }, { op: 'split_column', icon: 'columns-3', textOnly: true }, { op: 'drop_columns', icon: 'trash-2' },
    ];

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubscribe = null; let table = null; let search = ''; let searchTimer = 0; let currentId = null;
      /** @type {Map<number, number>} table row index -> SQLite rowid */
      let rowIds = new Map();
      let undoBtn = null; let selectedColumn = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) render(); });
        render();
      }
      function deactivate() { slots = null; table = null; if (unsubscribe) unsubscribe(); }

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
        if (currentId !== ds.id) { search = ''; selectedColumn = null; currentId = ds.id; renderTable(ds); renderInspector(ds); }
        else if (table) { refresh(ds); updateUndo(); }
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
        const searchInput = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('table.filter.placeholder'), 'aria-label': t('common.filter'), inline: true }));
        searchInput.value = search;
        searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { search = searchInput.value.trim(); refresh(current()); }, 300); });
        const countBadge = h('dm-badge', { text: '' });
        undoBtn = ui.button({ label: t('common.undo'), icon: 'history', onClick: async () => { try { const label = await recipes.undo(ds.id); shell.log(t('bearbeta.undone', { label }), 'ok'); refresh(current()); if (selectedColumn) showStats(current(), selectedColumn); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'warn' }); } updateUndo(); } });
        table = /** @type {any} */ (h('dm-table'));
        table.editable = true;
        table.addEventListener('dm-column', (e) => { selectedColumn = /** @type {any} */ (e).detail.column.key; showStats(ds, selectedColumn); });
        table.addEventListener('dm-cell-commit', (e) => commitCell(ds, /** @type {any} */ (e).detail));
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('wand-sparkles', 20), ds.name),
            h('div', { class: 'dm-toolbar' },
              searchInput, countBadge,
              ui.button({ label: t('bearbeta.actions'), icon: 'sparkles', variant: 'primary', 'data-course': 'actions', onClick: async () => dialogs.palette(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              undoBtn,
              ui.button({ label: t('bearbeta.profile'), icon: 'circle-check', onClick: async () => dialogs.profileDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.rules'), icon: 'circle-alert', onClick: async () => dialogs.rulesDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.versions'), icon: 'history', onClick: async () => dialogs.versionsDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }),
              ui.button({ label: t('bearbeta.recipe'), icon: 'list', onClick: async () => dialogs.recipeDialog(dialogCtx(current(), await services.datasets.columns(ds.id))) }))),
          h('p', { class: 'dm-help', text: t('bearbeta.edit.hint') }),
          h('div', { class: 'dm-table-wrap dm-center-fill' }, table));
        table.countBadge = countBadge;
        await refresh(ds);
        updateUndo();
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
        const cols = await services.datasets.columns(ds.id);
        const total = await services.datasets.count(ds.id, { search });
        rowIds = new Map();
        table.countBadge.textContent = search ? t('table.rows.shown', { shown: i18n.formatNumber(total), total: i18n.formatNumber(ds.rowCount) }) : t('common.rows', { n: i18n.formatNumber(total) });
        const data = {
          columns: cols.map((c) => ({ key: c.name, label: c.label || c.name, type: c.type, description: c.description, unit: c.unit })),
          rowCount: total,
          rowProvider: async (start, count, sort) => {
            const rows = await services.datasets.query(ds.id, { limit: count, offset: start, search, orderBy: sort ? sort.key : undefined, dir: sort ? sort.dir : undefined, withRowId: true });
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
          const fmt = (v) => (v === null || v === undefined ? '–' : (typeof v === 'number' ? i18n.formatNumber(v, { maximumFractionDigits: 4 }) : String(v)));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.type'), value: t('type.' + s.column.type) },
            column.description ? { label: t('column.description'), value: column.description } : null,
            column.unit ? { label: t('column.unit'), value: column.unit } : null,
            { label: t('table.stats.count'), value: i18n.formatNumber(s.total) },
            { label: t('table.stats.nulls'), value: i18n.formatNumber(s.nulls) },
            { label: t('table.stats.distinct'), value: i18n.formatNumber(s.distinct) },
            { label: t('table.stats.min'), value: fmt(s.min) },
            { label: t('table.stats.max'), value: fmt(s.max) },
            s.mean !== null && s.mean !== undefined ? { label: t('table.stats.mean'), value: fmt(s.mean) } : null,
            s.sum !== null && s.sum !== undefined ? { label: t('table.stats.sum'), value: fmt(s.sum) } : null,
          ].filter(Boolean);
          const actions = QUICK.filter((a) => !a.textOnly || column.type === 'text').map((a) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => dialogs.run(dialogCtx(ds, cols), a.op, presetFor(a.op, column)) }, ui.icon(a.icon, 14), h('span', { class: 'dm-list-main', text: t('op.' + a.op) })));
          replace(slots.right,
            h('h4', { text: column.label || column.name }), kv,
            h('h4', { text: t('bearbeta.quick') }), h('div', { class: 'dm-list' }, actions),
            h('h4', { text: t('table.stats.top') }),
            h('ul', { class: 'dm-top-values' }, s.top.map(([v, n]) => h('li', null, h('span', { class: 'dm-truncate', text: String(v) }), h('span', { class: 'dm-muted dm-num', text: i18n.formatNumber(n) })))));
        } catch (err) { replace(slots.right, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); }
      }

      function presetFor(opId, column) {
        if (['trim', 'replace_text', 'change_case', 'fix_encoding', 'drop_columns'].includes(opId)) return { columns: [column.name] };
        if (opId === 'set_label') return { column: column.name, label: column.label || column.name, description: column.description || '', unit: column.unit || '' };
        return { column: column.name };
      }

      return { id: 'bearbeta', activate, deactivate };
    }
    return { createMode };
  });
})();
