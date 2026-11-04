// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Gallery view in Bearbeta for datasets of kind "images": the thumbnails in a grid with file name and date,
 * a filter and sort order, a larger preview on click with the picture's details (size, camera, position,
 * description) in the inspector, where the description can be edited as a logged recipe step.
 * The table view stays one click away.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/gallery-view', ['ui/base', 'data/datasets', 'data/dataset-files', 'data/recipes', 'analysis/images', 'platform/files'], (base, datasets, dsFiles, recipes, imageAnalysis, files) => {
    const { h, t, i18n, replace } = base;
    const PAGE = 120;
    const SORTS = [{ value: 'name', label: 'gallery.sort.name' }, { value: 'date', label: 'gallery.sort.date' }, { value: 'size', label: 'gallery.sort.size' }];

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void, onChanged?: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell } = ctx;
      const s = { id: null, search: '', sort: 'name', shown: PAGE, selected: null };
      let ds = null; let columns = []; let idx = null; let rows = [];
      let gridEl = null; let slots = null; let countEl = null;
      let seq = 0; let searchTimer = 0;

      async function load(dataset) {
        ds = dataset;
        if (s.id !== dataset.id) { Object.assign(s, { id: dataset.id, search: '', sort: 'name', shown: PAGE, selected: null }); }
        columns = await datasets.columns(dataset.id);
        idx = imageAnalysis.indexes(columns);
        const sortCol = s.sort === 'date' ? columns[idx.dateIndex] : s.sort === 'size' ? columns[idx.sizeIndex] : columns[idx.fileIndex];
        rows = await datasets.query(dataset.id, { search: s.search || undefined, orderBy: sortCol ? sortCol.name : undefined, dir: s.sort === 'name' ? 'asc' : 'desc', withRowId: true, limit: 20000 });
      }

      /**
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target
       */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        await load(dataset);
        if (my !== seq || !slots) return;
        const searchInput = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('gallery.search.placeholder'), 'aria-label': t('common.filter'), inline: true }));
        searchInput.value = s.search;
        searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { s.search = searchInput.value.trim(); s.shown = PAGE; refresh(); }, 300); });
        const sortSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('gallery.sort'), inline: true }));
        sortSel.options = SORTS.map((o) => ({ value: o.value, label: t(o.label) }));
        sortSel.value = s.sort;
        sortSel.addEventListener('change', () => { s.sort = sortSel.value; refresh(); });
        countEl = h('dm-badge', { text: '' });
        gridEl = h('div', { class: 'dm-photos dm-center-fill', 'aria-label': t('gallery.view') });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('images', 20), dataset.name),
            h('div', { class: 'dm-toolbar' }, searchInput, sortSel, countEl,
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          h('p', { class: 'dm-help', text: t('gallery.hint') }),
          gridEl);
        renderGrid(); renderInspector();
      }
      async function refresh() {
        if (!ds) return;
        const my = ++seq;
        await load(ds);
        if (my !== seq) return;
        renderGrid();
      }

      async function renderGrid() {
        if (!gridEl || !ds) return;
        const my = seq;
        countEl.textContent = s.search ? t('table.rows.shown', { shown: i18n.formatNumber(rows.length), total: i18n.formatNumber(ds.rowCount || rows.length) }) : t('gallery.count', { n: i18n.formatNumber(rows.length) });
        if (!rows.length) { replace(gridEl, h('dm-empty-state', { icon: 'image', heading: t('gallery.empty'), text: s.search ? t('gallery.empty.search') : t('gallery.empty.hint') })); return; }
        const items = [];
        for (const r of rows.slice(0, s.shown)) items.push(await itemNode(r));
        if (my !== seq || !gridEl) return;
        replace(gridEl, items, rows.length > s.shown ? h('div', { class: 'dm-photos-more' }, ui.button({ label: t('gallery.more', { n: i18n.formatNumber(rows.length - s.shown) }), icon: 'chevron-down', onClick: () => { s.shown += PAGE; renderGrid(); } })) : null);
      }
      async function itemNode(r) {
        const rowid = r[0]; const row = r.slice(1);
        const name = String(row[idx.fileIndex] || '');
        const url = await dsFiles.url(ds.id, name, 'thumb').catch(() => null);
        const img = url ? h('img', { src: url, alt: name, loading: 'lazy', decoding: 'async' }) : h('div', { class: 'dm-photos-missing' }, ui.icon('image', 24));
        const date = row[idx.dateIndex] ? String(row[idx.dateIndex]).slice(0, 10) : '';
        const el = h('button', { type: 'button', class: 'dm-photos-item', 'aria-current': s.selected && s.selected.rowid === rowid ? 'true' : null, 'data-tip': [name, date, row[idx.cameraIndex] || ''].filter(Boolean).join(' · ') },
          h('span', { class: 'dm-photos-thumb' }, img),
          h('span', { class: 'dm-photos-caption' }, h('span', { class: 'dm-truncate', text: name }), h('span', { class: 'dm-list-sub', text: date || `${row[idx.widthIndex] || '?'} × ${row[idx.heightIndex] || '?'}` })));
        el.addEventListener('click', () => select(rowid, row, el));
        el.addEventListener('dblclick', () => openPreview(row));
        return el;
      }
      function select(rowid, row, el) {
        s.selected = { rowid, row };
        if (gridEl) for (const other of gridEl.querySelectorAll('[aria-current]')) other.removeAttribute('aria-current');
        if (el) el.setAttribute('aria-current', 'true');
        renderInspector();
      }
      async function openPreview(row) {
        const name = String(row[idx.fileIndex] || '');
        const url = await dsFiles.url(ds.id, name, 'preview').catch(() => null);
        if (!url) { ui.toast.show(t('gallery.preview.missing'), { kind: 'warn' }); return; }
        await ui.dialog.open({ title: name, size: 'lg', body: h('div', { class: 'dm-photos-preview' }, h('img', { src: url, alt: row[idx.descIndex] || name })), actions: [{ label: t('common.close'), value: true, primary: true }] });
      }

      async function renderInspector() {
        if (!slots) return;
        if (!s.selected) { replace(slots.right, h('p', { class: 'dm-help', text: t('gallery.help') })); return; }
        const row = s.selected.row; const rowid = s.selected.rowid;
        const name = String(row[idx.fileIndex] || '');
        const url = await dsFiles.url(ds.id, name, 'preview').catch(() => null);
        if (!slots || !s.selected || s.selected.rowid !== rowid) return;
        const kv = /** @type {any} */ (h('dm-kv'));
        const lon = row[idx.lonIndex]; const lat = row[idx.latIndex];
        kv.items = [
          { label: t('common.type'), value: String(row[idx.typeIndex] || '') },
          { label: t('common.size'), value: i18n.formatBytes(Number(row[idx.sizeIndex]) || 0) },
          { label: t('gallery.dimensions'), value: `${row[idx.widthIndex] || '?'} × ${row[idx.heightIndex] || '?'}` },
          row[idx.dateIndex] ? { label: t('gallery.date'), value: String(row[idx.dateIndex]) } : null,
          row[idx.cameraIndex] ? { label: t('gallery.camera'), value: String(row[idx.cameraIndex]) } : null,
          typeof lon === 'number' && typeof lat === 'number' ? { label: t('gallery.position'), value: `${i18n.formatNumber(lat, { maximumFractionDigits: 5 })}, ${i18n.formatNumber(lon, { maximumFractionDigits: 5 })}` } : null,
          typeof row[idx.altIndex] === 'number' ? { label: t('gallery.altitude'), value: i18n.formatNumber(row[idx.altIndex], { maximumFractionDigits: 1 }) + ' m' } : null,
        ].filter(Boolean);
        const desc = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('gallery.description') }));
        desc.value = row[idx.descIndex] ? String(row[idx.descIndex]) : '';
        const save = ui.button({ label: t('common.save'), icon: 'save', size: 'sm', onClick: async () => {
          try {
            const result = await recipes.apply(ds.id, 'edit_cell', { rowid, column: columns[idx.descIndex].name, value: desc.value.trim() || null });
            row[idx.descIndex] = result.value;
            shell.log(t('bearbeta.cell.saved', { column: columns[idx.descIndex].name }), 'ok');
            if (options.onChanged) options.onChanged();
          } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        } });
        replace(slots.right,
          h('h4', { text: name }),
          url ? h('button', { type: 'button', class: 'dm-photos-inspector-preview', 'aria-label': t('gallery.open.large'), onclick: () => openPreview(row) }, h('img', { src: url, alt: '' })) : null,
          kv,
          h('div', { class: 'dm-stack' }, desc, h('div', { class: 'dm-row-wrap' }, save,
            ui.button({ label: t('gallery.open.large'), icon: 'eye', size: 'sm', onClick: () => openPreview(row) }),
            ui.button({ label: t('gallery.download'), icon: 'download', size: 'sm', title: t('gallery.download.hint'), onClick: () => downloadPreview(name) }))));
      }
      async function downloadPreview(name) {
        try {
          const file = await dsFiles.read(ds.id, name, 'preview');
          if (!file) throw new Error(t('gallery.preview.missing'));
          files.download(new Blob([file.bytes], { type: file.type }), name.replace(/\.[^.]+$/, '') + (file.type === 'image/png' ? '.png' : '.jpg'));
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function destroy() { seq++; clearTimeout(searchTimer); gridEl = null; slots = null; countEl = null; }
      return { render, destroy, state: s };
    }
    return { create, SORTS };
  });
})();
