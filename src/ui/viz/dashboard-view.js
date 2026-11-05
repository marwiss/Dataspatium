// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dashboard view: a filter bar (shared columns) above a grid of live charts, with controls to add,
 * reorder, widen and remove charts, and export as HTML, PowerPoint or a shareable file. Changes are
 * saved automatically; there is no separate save step.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/dashboard-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/overlays', 'viz/render', 'viz/dashboards', 'viz/charts', 'viz/data', 'platform/files', 'ui/viz/present'], (base, basic, icons, overlays, render, dashboards, charts, vizData, files, present) => {
    const { h, t, i18n, replace } = base;

    /**
     * @param {{dashboard: any, onOpenChart: (chart: any) => void, onDeleted: () => void, log: (message: string, kind?: string) => void}} options
     */
    function create(options) {
      let dash = JSON.parse(JSON.stringify(options.dashboard));
      let values = {};
      let resolved = []; let shared = [];
      const handles = [];
      let renderSeq = 0; let saveTimer = 0; let nameInput = null;
      const el = h('div', { class: 'dm-stack dm-dashboard' });
      const headEl = h('div', { class: 'dm-page-head' });
      const filterBar = h('div', { class: 'dm-row-wrap dm-dashboard-filters' });
      const gridEl = h('div', { class: 'dm-gallery dm-dashboard-grid' });
      el.append(headEl, filterBar, gridEl);

      function destroy() { clearTimeout(saveTimer); for (const hd of handles) { try { hd.finalize(); } catch (_e) { /* ignore */ } } handles.length = 0; }
      const extraFilters = () => dashboards.toExtraFilters(values);
      /** A click on a bar narrows the other charts, the ones that have the column. @type {{column: string, value: any, chartId: any}|null} */
      let cross = null;
      const crossFilter = () => (cross ? [{ field: cross.column, op: '=', value: cross.value }] : []);
      /** What a chart is narrowed by. The chart that was clicked stays whole, so that another bar can be chosen. */
      const filtersFor = (chart) => extraFilters().concat(cross && cross.chartId !== chart.id ? crossFilter() : []);
      /** The column a mark of this chart stands for, when it stands for one value. */
      function pickedColumn(chart) {
        const state = chart.vega && chart.vega.state;
        const x = state && state.x;
        return x && x.field && !x.bin && (x.type === 'nominal' || x.type === 'ordinal') && !chart.vega.table ? x.field : null;
      }
      function pick(chart, datum) {
        const column = pickedColumn(chart);
        if (!column || datum[column] === undefined) return;
        const same = cross && cross.column === column && cross.value === datum[column] && cross.chartId === chart.id;
        cross = same ? null : { column, value: datum[column], chartId: chart.id };
        renderFilters().catch((err) => D.log('dashboard', err));
        renderGrid();
      }

      /** Persist shortly after a change. */
      function changed(immediate = false) {
        clearTimeout(saveTimer);
        const doSave = async () => {
          try { const saved = await dashboards.save(dash); dash.id = saved.id; dash.updatedAt = saved.updatedAt; dash.createdAt = saved.createdAt; }
          catch (err) { options.log(String((err && err.message) || err), 'error'); }
        };
        if (immediate) return doSave();
        saveTimer = setTimeout(doSave, 400);
        return Promise.resolve();
      }

      async function start() { await reload(); renderHead(); }
      async function reload() {
        resolved = await dashboards.resolveCharts(dash);
        // Items whose chart was deleted are dropped so that positions stay in step with the cards.
        if (resolved.length !== (dash.items || []).length) { dash.items = resolved.map((r) => r.item); changed(); }
        shared = await dashboards.sharedColumns(dash);
        await renderFilters();
        renderGrid();
      }

      function renderHead() {
        nameInput = /** @type {any} */ (h('dm-input', { 'aria-label': t('viz.name'), placeholder: t('dash.new.prompt'), inline: true }));
        nameInput.value = dash.name || '';
        nameInput.addEventListener('change', () => { dash.name = nameInput.value.trim() || dash.name; changed(); });
        replace(headEl,
          h('h1', null, icons.icon('layout-grid', 20), nameInput, h('dm-badge', { text: t('viz.count', { n: resolved.length }) })),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('dash.add'), icon: 'plus', onClick: addCharts }),
            basic.button({ label: t('dash.filters'), icon: 'filter', onClick: configureFilters }),
            basic.button({ label: t('present.open'), icon: 'monitor', title: t('present.keys'), onClick: () => present.open(dash, { log: options.log }).catch((err) => options.log(String((err && err.message) || err), 'error')) }),
            basic.button({ label: t('dash.export.html'), icon: 'file-text', onClick: () => exportAs('html') }),
            basic.button({ label: t('dash.export.pptx'), icon: 'file-output', onClick: () => exportAs('pptx') }),
            basic.button({ label: t('dash.export.json'), icon: 'upload', variant: 'ghost', onClick: shareJson }),
            basic.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: removeDash })));
      }

      async function renderFilters() {
        const items = [];
        const dsId = resolved.length ? resolved[0].chart.datasetId : null;
        for (const f of dash.filters || []) {
          const col = shared.find((c) => c.name === f.column);
          if (!col) continue;
          const sel = /** @type {any} */ (h('dm-select', { label: col.label || col.name, inline: true }));
          let opts = [];
          if (dsId) { try { opts = await vizData.distinctValues(dsId, f.column, 500); } catch (_err) { opts = []; } }
          sel.options = [{ value: '', label: t('dash.filter.all') }].concat(opts.map((v) => ({ value: String(v), label: String(v) })));
          sel.value = values[f.column] === undefined || values[f.column] === '' ? '' : String(values[f.column]);
          sel.addEventListener('change', () => { values[f.column] = sel.value === '' ? '' : vizData.coerce(sel.value, col.type); renderGrid(); });
          items.push(sel);
        }
        if (cross) items.push(h('span', { class: 'dm-cross-filter' }, h('dm-badge', { text: t('dash.cross.active', { column: cross.column, value: String(cross.value) }) }), basic.button({ label: t('dash.cross.clear'), icon: 'x', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => { cross = null; renderFilters().catch((err) => D.log('dashboard', err)); renderGrid(); } })));
        if (items.length) items.push(basic.button({ label: t('dash.filter.clear'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { cross = null; values = {}; renderFilters().then(renderGrid); } }));
        replace(filterBar, items);
        filterBar.hidden = !items.length;
      }

      function renderGrid() {
        destroy();
        const seq = ++renderSeq;
        const cols = dash.columns || 2;
        if (!resolved.length) {
          gridEl.style.gridTemplateColumns = '';
          replace(gridEl, h('dm-empty-state', { icon: 'layout-grid', heading: dash.name || t('dash.title'), text: t('dash.empty') }, basic.button({ label: t('dash.add'), icon: 'plus', variant: 'primary', onClick: addCharts })));
          return;
        }
        gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        replace(gridEl, resolved.map(({ item, chart }, index) => {
          const holder = h('div', { class: 'dm-chart-preview' });
          const card = h('article', { class: 'dm-gallery-card dm-card', style: { gridColumn: `span ${Math.min(item.span || 1, cols)}` } },
            h('div', { class: 'dm-gallery-head' },
              h('div', { class: 'dm-stack-sm' }, h('strong', { class: 'dm-truncate', text: chart.name }), h('span', { class: 'dm-help dm-truncate', text: chart.datasetName || '' })),
              h('div', { class: 'dm-row' },
                basic.button({ label: t('dash.item.wider'), icon: 'columns-3', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => { item.span = (item.span || 1) >= cols ? 1 : (item.span || 1) + 1; changed(); renderGrid(); } }),
                basic.button({ label: t('dash.item.up'), icon: 'arrow-up', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index === 0, onClick: () => move(index, -1) }),
                basic.button({ label: t('dash.item.down'), icon: 'arrow-down', size: 'sm', variant: 'ghost', 'icon-only': true, disabled: index === resolved.length - 1, onClick: () => move(index, 1) }),
                basic.button({ label: t('viz.gallery.open'), icon: 'pencil', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => options.onOpenChart(chart) }),
                basic.button({ label: t('dash.item.remove'), icon: 'x', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: () => { dash.items.splice(index, 1); changed(); reload().then(renderHead); } }))),
            holder);
          // Code charts show their saved image; a Python chart with a plotly figure is drawn live by plotly.js.
          if (chart.kind === 'map') holder.style.height = '360px';
          if (chart.kind === 'python' && chart.python && chart.python.plotly) { holder.style.height = '360px'; D.require('viz/plotly').render(holder, chart.python.plotly).then((hd) => { if (seq === renderSeq) handles.push(hd); else hd.finalize(); }).catch((err) => replace(holder, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }))); }
          else if (D.require('viz/code-charts').isCode(chart.kind)) replace(holder, chart.thumbnail ? h('img', { class: 'dm-gallery-thumb', src: chart.thumbnail, alt: chart.name }) : h('p', { class: 'dm-help', text: t('dash.code.note') }));
          else render.renderInto(chart, holder, { extraFilters: filtersFor(chart), onPick: pickedColumn(chart) ? (datum) => pick(chart, datum) : undefined }).then((hd) => { if (seq === renderSeq) handles.push(hd); else hd.finalize(); }).catch((err) => replace(holder, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })));
          return card;
        }));
      }

      function move(index, delta) {
        const j = index + delta;
        if (j < 0 || j >= dash.items.length) return;
        const items = dash.items;
        [items[index], items[j]] = [items[j], items[index]];
        changed();
        reload();
      }

      async function addCharts() {
        const all = await charts.list();
        const have = new Set((dash.items || []).map((it) => it.chartId));
        const candidates = all.filter((c) => !have.has(c.id));
        if (!candidates.length) { overlays.toast.show(all.length ? t('dash.add.none.left') : t('dash.add.none'), { kind: 'info' }); return; }
        const chosen = new Set();
        const body = h('div', { class: 'dm-stack-sm' }, candidates.map((c) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: `${c.name} (${c.datasetName || t('viz.kind.badge.' + c.kind)})` }));
          sw.addEventListener('change', () => { if (sw.checked) chosen.add(c.id); else chosen.delete(c.id); });
          return sw;
        }));
        const ok = await overlays.dialog.open({ title: t('dash.add.title'), help: 'visualisera#dashboards', body, actions: [{ label: t('common.cancel'), value: false }, { label: t('dash.add'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true || !chosen.size) return;
        for (const id of chosen) dash.items.push({ chartId: id, span: 1 });
        await changed(true);
        await reload();
        renderHead();
      }

      async function configureFilters() {
        if (!shared.length) { overlays.toast.show(t('dash.filters.none'), { kind: 'info' }); return; }
        const selected = new Set((dash.filters || []).map((f) => f.column));
        const body = h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('dash.filters.help') }), shared.map((c) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: `${c.name} (${t('type.' + c.type)})` }));
          sw.checked = selected.has(c.name);
          sw.addEventListener('change', () => { if (sw.checked) selected.add(c.name); else selected.delete(c.name); });
          return sw;
        }));
        const ok = await overlays.dialog.open({ title: t('dash.filters.title'), help: 'visualisera#dashboards', body, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.ok'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        dash.filters = shared.filter((c) => selected.has(c.name)).map((c) => ({ column: c.name }));
        values = Object.fromEntries(Object.entries(values).filter(([k]) => selected.has(k)));
        await changed(true);
        await renderFilters();
        renderGrid();
      }

      async function exportAs(kind) {
        const toast = overlays.toast.show(t('common.loading'), { kind: 'info', timeout: 0 });
        try {
          const opts = { extraFilters: extraFilters().concat(crossFilter()), filtersLabel: t('dash.filters.label'), generatedText: t('dash.html.generated', { date: i18n.formatDateTime(new Date()) }) };
          if (kind === 'html') {
            const blob = await dashboards.toHtml(dash, opts);
            const name = files.safeName(dash.name || 'dashboard', 'html');
            files.download(blob, name);
            overlays.toast.show(t('dash.exported', { name }), { kind: 'ok' });
          } else {
            const res = await dashboards.toPptx(dash, opts);
            const name = files.safeName(dash.name || 'dashboard', 'pptx');
            files.download(res.blob, name);
            overlays.toast.show(t('viz.export.pptx.done', { name, n: res.count }), { kind: 'ok' });
          }
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 10000 }); }
        finally { toast.remove(); }
      }

      async function shareJson() {
        const json = await dashboards.exportJson(dash);
        const name = files.safeName(dash.name || 'dashboard', 'dash.json');
        files.download(new Blob([json], { type: 'application/json' }), name);
        overlays.toast.show(t('dash.exported', { name }), { kind: 'ok' });
      }

      async function removeDash() {
        if (!(await overlays.dialog.confirm(t('dash.delete.confirm', { name: dash.name }), { okLabel: t('common.delete'), danger: true }))) return;
        clearTimeout(saveTimer);
        if (dash.id) await dashboards.remove(dash.id);
        options.log(t('dash.deleted'), 'ok');
        options.onDeleted();
      }

      /** Right-panel nodes: description, grid width and a summary. */
      function inspector() {
        const desc = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('dash.description') }));
        desc.value = dash.description || '';
        desc.addEventListener('change', () => { dash.description = desc.value; changed(); });
        const cols = /** @type {any} */ (h('dm-select', { label: t('dash.columns') }));
        cols.options = [1, 2, 3].map((n) => ({ value: String(n), label: String(n) }));
        cols.value = String(dash.columns || 2);
        cols.addEventListener('change', () => { dash.columns = Number(cols.value); changed(); renderGrid(); });
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('viz.saved'), value: String(resolved.length) },
          { label: t('dash.filters'), value: (dash.filters || []).map((f) => f.column).join(', ') || '–' },
          dash.updatedAt ? { label: t('common.updated'), value: i18n.formatDateTime(dash.updatedAt) } : null,
        ].filter(Boolean);
        return [h('h4', { text: dash.name || t('dash.title') }), desc, cols, kv, h('p', { class: 'dm-help', text: t('dash.inspector.help') })];
      }

      return {
        el, start, reload, destroy, inspector,
        get dashboard() { return dash; },
        setFilter(column, value) { values[column] = value; renderGrid(); },
        filters: () => extraFilters(),
        rendered: () => handles.length,
      };
    }
    return { create };
  });
})();
