// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Model view in Bearbeta for datasets of kind "model". An IFC model is drawn in 3D (viz/model-draw) above a table of
 * its elements; a DXF drawing is shown as its SVG above a table of its entities. Selection follows in both directions:
 * a row marks the element in the drawing, a click in the drawing selects the row, and the inspector shows the element
 * with its properties and quantities. Filters on type, storey or layer and a text search narrow the table and the
 * drawing together. The whole dataset as an ordinary table is one button away.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/model-view', ['ui/base', 'data/datasets', 'data/model', 'viz/model-draw', 'viz/charts'], (base, datasets, model, draw, charts) => {
    const { h, t, i18n, replace } = base;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

    /**
     * @param {any} ctx shell context @param {{onTable: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, filter: { typ: '', vaning: '', lager: '', search: '' }, selected: null, count: 0, hidden: new Set(), error: '', progress: null };
      let ds = null; let slots = null; let handle = null; let host = null; let table = null; let seq = 0; let searchTimer = 0;
      let svgEl = null; let box = null; let removeDrag = null;
      /** The issues panel, when open. */ let issues = null;

      const isDxf = () => model.isDxf(ds);
      const whereSql = () => model.whereOf(s.filter, isDxf());
      const facts = () => (ds && ds.model) || {};
      const fmt = (v, digits = 2) => (typeof v === 'number' ? i18n.formatNumber(Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits)) : String(v === null || v === undefined ? '' : v));

      function destroy() {
        seq++;
        clearTimeout(searchTimer);
        if (handle) { handle.destroy(); handle = null; }
        if (removeDrag) { removeDrag(); removeDrag = null; }
        if (issues) { issues.destroy(); issues = null; }
        slots = null; host = null; table = null; svgEl = null;
      }

      /** @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target */
      async function render(dataset, target) {
        if (handle) { handle.destroy(); handle = null; }
        if (removeDrag) { removeDrag(); removeDrag = null; }
        slots = target;
        const my = ++seq;
        if (s.id !== dataset.id) { s.id = dataset.id; s.filter = { typ: '', vaning: '', lager: '', search: '' }; s.selected = null; s.hidden = new Set(); if (issues) { issues.destroy(); issues = null; } }
        ds = dataset;
        // Hantera asks for the issues of the model; the panel opens with the view.
        const askedIssues = ctx.store.get().openModelIssues;
        if (askedIssues && askedIssues.datasetId === dataset.id) { ctx.store.set({ openModelIssues: null }); if (!issues && !isDxf()) openIssues(); }
        s.error = '';
        // A search hit: the element chosen, whatever a filter would have hidden.
        const pending = ctx.store.get().openElement;
        if (pending && pending.datasetId === dataset.id) {
          ctx.store.set({ openElement: null });
          s.filter = { typ: '', vaning: '', lager: '', search: '' };
          s.selected = Number(pending.id);
          s.showSelected = true;
        }
        const dxfView = isDxf();
        const selects = [];
        const addFilter = (key, labelKey, list) => {
          if (!list.length) return;
          const el = /** @type {any} */ (h('dm-select', { 'aria-label': t(labelKey), inline: true }));
          el.options = [{ value: '', label: t(labelKey) }].concat(list.map((x) => ({ value: x.name, label: `${x.name} (${i18n.formatNumber(x.count || 0)})` })));
          el.value = s.filter[key];
          el.addEventListener('change', () => { s.filter[key] = el.value; applyFilter(); });
          selects.push(el);
        };
        if (dxfView) { addFilter('lager', 'model.filter.layer', facts().layers || []); addFilter('typ', 'model.filter.type', facts().types || []); }
        else { addFilter('typ', 'model.filter.type', facts().elementTypes || []); addFilter('vaning', 'model.filter.storey', (facts().storeys || []).slice().reverse()); }
        const search = /** @type {any} */ (h('dm-input', { 'aria-label': t('model.filter.search'), placeholder: t('model.filter.search') }));
        search.value = s.filter.search;
        search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { s.filter.search = search.value; applyFilter(); }, 300); });
        host = h('div', { class: dxfView ? 'dm-model-host dm-dxf-host' : 'dm-model-host', 'aria-label': t(dxfView ? 'model.view.dxf' : 'model.view.ifc') });
        // The filtered elements can follow to the other modes.
        const classify = isDxf() ? null : ui.button({ label: t('model.classify'), icon: 'tag', title: t('model.classify.hint'), onClick: () => classifyShown().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) });
        const useBtn = ui.button({ label: t('selection.use'), icon: 'list-checks', title: t('selection.use.hint'), onClick: async () => {
          const made = await D.require('data/selection').setFromWhere(ds.id, whereSql().replace(/^\s*where\s*/i, ''));
          ui.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
        } });
        table = /** @type {any} */ (h('dm-table', { class: 'dm-model-table' }));
        table.addEventListener('dm-row', (ev) => { const row = ev.detail.row; if (row && Number(row[0]) !== s.selected) selectElement(Number(row[0]), 'table'); });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('box', 20), dataset.name, ' ', h('dm-badge', { text: t(dxfView ? 'model.entities.n' : 'model.elements.n', { n: i18n.formatNumber(dxfView ? (dataset.rowCount || 0) : (facts().elements || 0)) }) })),
            h('div', { class: 'dm-toolbar' }, classify, useBtn,
              isDxf() ? null : ui.button({ label: t('issues.title'), icon: 'message-square', title: t('issues.button.hint'), 'data-model-issues-toggle': '', onClick: toggleIssues }),
              selects, search,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('model.fit.hint'), onClick: fitAll }),
              ui.button({ label: t('viz.save.as.chart'), icon: 'chart-column', title: t('model.chart.save.hint'), onClick: saveChart }),
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('model.table.hint'), onClick: options.onTable }))),
          h('div', { class: 'dm-model-layout dm-center-fill' }, host, h('div', { class: 'dm-table-wrap dm-model-table-wrap' }, table)));
        renderInspector();
        fillTable();
        if (dxfView) await drawDxf(my); else await drawIfc(my);
      }

      /** The issues from the CDE, in the inspector; the same panel until the dataset changes. */
      function openIssues() {
        if (issues) return;
        issues = D.require('ui/bearbeta/model-issues').create(ctx, ds, {
          select: (ids, fit) => { if (handle) handle.select(ids, { fit }); },
          view: () => (handle ? Object.assign(handle.view(), { fov: handle.camera ? handle.camera.fov : 45, aspect: handle.camera ? Math.round(handle.camera.aspect * 100) / 100 : 1.6 }) : null),
          png: () => (handle ? handle.png() : ''),
          marked: () => (handle ? handle.marked() : (s.selected ? [s.selected] : [])),
        });
        issues.start().catch((err) => shell.log(String((err && err.message) || err), 'error'));
      }
      function toggleIssues() {
        if (issues) { issues.destroy(); issues = null; } else openIssues();
        renderInspector();
      }
      function fitAll() {
        if (handle) handle.fit();
        else if (svgEl && box) { box = Object.assign({}, svgEl.dmHome); svgEl.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`); }
      }

      // ---- the table ------------------------------------------------------------------------------------------
      async function fillTable() {
        const my = seq;
        const where = whereSql();
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        const counted = await engine.exec(`select count(*) from data${where}`);
        if (my !== seq || !table) return;
        s.count = Number(counted[0].values[0][0]);
        const keys = isDxf() ? [['id', 'integer'], ['typ', 'text'], ['lager', 'text'], ['langd', 'number'], ['area', 'number'], ['text', 'text']] : [['id', 'integer'], ['typ', 'text'], ['namn', 'text'], ['vaning', 'text'], ['material', 'text'], ['tagg', 'text']];
        table.setData({
          columns: keys.map(([key, type]) => ({ key, label: t('model.col.' + key), type })),
          rowCount: s.count,
          rowProvider: async (start, count) => {
            const res = await engine.exec(`select ${keys.map(([k]) => q(k)).join(', ')} from data${where} order by id limit ${Number(count)} offset ${Number(start)}`);
            return res[0] ? res[0].values : [];
          },
        });
      }
      /** Filters narrow the table and the drawing together. */
      async function applyFilter() {
        fillTable();
        if (isDxf()) { applyLayers(); return; }
        if (!handle) return;
        const where = whereSql();
        if (!where) { handle.setVisible(null); return; }
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        const res = await engine.exec(`select id from data${where}`);
        if (handle) handle.setVisible(res[0] ? res[0].values.map((r) => Number(r[0])) : []);
      }

      // ---- selection ------------------------------------------------------------------------------------------
      async function selectElement(id, from) {
        s.selected = id;
        if (handle && from !== 'draw') handle.select(id ? [id] : [], { fit: from === 'table' && !!id });
        if (svgEl) markDxf(id);
        if (from === 'draw' && id && table) {
          const engine = (await datasets.ensureOpen(ds.id)).engine;
          const where = whereSql();
          const res = await engine.exec(`select count(*) from data${where ? where + ' and' : ' where'} id < ${Number(id)}`);
          if (table && s.selected === id) table.selectRow(Number(res[0].values[0][0]), true);
        }
        renderInspector();
      }

      // ---- IFC ------------------------------------------------------------------------------------------------
      async function drawIfc(my) {
        const progress = h('dm-progress', { indeterminate: true, label: t('model.loading') });
        const note = h('p', { class: 'dm-help dm-small', text: t('model.loading.hint') });
        replace(host, h('div', { class: 'dm-stack-sm dm-model-loading' }, progress, note));
        try {
          const where = whereSql();
          let visible = null;
          if (where) { const res = await (await datasets.ensureOpen(ds.id)).engine.exec(`select id from data${where}`); visible = res[0] ? res[0].values.map((r) => Number(r[0])) : []; }
          const hd = await draw.render(host, { datasetId: ds.id, visible, selected: s.selected ? [s.selected] : [] }, {
            onSelect: (id) => selectElement(id, 'draw'),
            onProgress: (n) => { if (my === seq) note.textContent = t('model.loading.n', { n: i18n.formatNumber(n) }); },
          });
          if (my !== seq || !host) { hd.destroy(); return; }
          host.querySelector('.dm-model-loading')?.remove();
          handle = hd;
          s.error = '';
          // A selection made elsewhere shows here: the walls found in Söka, marked in the model.
          const chosen = D.require('data/selection').whereOf(ds.id);
          if (chosen && !s.showSelected) {
            const engine = (await datasets.ensureOpen(ds.id)).engine;
            const r = await engine.exec(`select id from data where ${chosen.sql}`);
            hd.select((r[0] ? r[0].values : []).map((row) => Number(row[0])), { fit: true });
          }
          if (s.showSelected && s.selected) { s.showSelected = false; hd.select([s.selected], { fit: true }); selectElement(s.selected, 'draw').catch((err) => D.log('model', err)); }
          renderInspector();
        } catch (err) {
          if (my !== seq || !host) return;
          s.error = String((err && err.message) || err);
          replace(host, h('p', { class: 'dm-error dm-small', text: s.error }));
          shell.log(s.error, 'error');
        }
      }

      // ---- DXF ------------------------------------------------------------------------------------------------
      async function drawDxf(my) {
        const text = await model.drawing(ds.id);
        if (my !== seq || !host) return;
        if (!text) { replace(host, h('p', { class: 'dm-error dm-small', text: t('model.err.nofile') })); return; }
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        svgEl = /** @type {any} */ (document.importNode(doc.documentElement, true));
        svgEl.setAttribute('class', 'dm-dxf-svg');
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const parts = String(svgEl.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
        box = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        svgEl.dmHome = Object.assign({}, box);
        replace(host, svgEl);
        applyLayers();
        if (s.selected) markDxf(s.selected);
        const setBox = () => svgEl.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
        const scaleOf = () => { const r = host.getBoundingClientRect(); return Math.max(box.w / Math.max(r.width, 1), box.h / Math.max(r.height, 1)); };
        const onWheel = (ev) => {
          ev.preventDefault();
          const r = host.getBoundingClientRect();
          const k = ev.deltaY > 0 ? 1.2 : 1 / 1.2;
          const px = (ev.clientX - r.left) / Math.max(r.width, 1); const py = (ev.clientY - r.top) / Math.max(r.height, 1);
          const nw = box.w * k; const nh = box.h * k;
          box.x += (box.w - nw) * px; box.y += (box.h - nh) * py; box.w = nw; box.h = nh;
          setBox();
        };
        let down = null;
        const onDown = (ev) => { down = { x: ev.clientX, y: ev.clientY, sx: box.x, sy: box.y, moved: false }; };
        const onMove = (ev) => {
          if (!down) return;
          const k = scaleOf();
          if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 3) down.moved = true;
          box.x = down.sx - (ev.clientX - down.x) * k; box.y = down.sy - (ev.clientY - down.y) * k;
          setBox();
        };
        const onUp = (ev) => {
          const wasClick = down && !down.moved;
          down = null;
          if (!wasClick) return;
          const target = /** @type {Element} */ (ev.target);
          const hit = target && target.closest ? target.closest('[data-id]') : null;
          selectElement(hit ? Number(hit.getAttribute('data-id')) : null, 'draw');
        };
        host.addEventListener('wheel', onWheel, { passive: false });
        host.addEventListener('pointerdown', onDown);
        globalThis.addEventListener('pointermove', onMove);
        globalThis.addEventListener('pointerup', onUp);
        removeDrag = () => { globalThis.removeEventListener('pointermove', onMove); globalThis.removeEventListener('pointerup', onUp); };
      }
      function applyLayers() {
        if (!svgEl) return;
        for (const g of svgEl.querySelectorAll('[data-layer]')) {
          const name = g.getAttribute('data-layer');
          const hide = s.hidden.has(name) || (s.filter.lager && s.filter.lager !== name);
          g.style.display = hide ? 'none' : '';
        }
      }
      function markDxf(id) {
        for (const el of svgEl.querySelectorAll('.dm-dxf-selected')) el.classList.remove('dm-dxf-selected');
        if (!id) return;
        const el = svgEl.querySelector(`[data-id="${Number(id)}"]`);
        if (el) el.classList.add('dm-dxf-selected');
      }

      // ---- the inspector --------------------------------------------------------------------------------------
      function kv(items) { const el = /** @type {any} */ (h('dm-kv')); el.items = items.filter(Boolean); return el; }
      async function renderInspector() {
        if (!slots) return;
        const my = seq;
        const f = facts();
        const parts = [];
        if (isDxf()) {
          parts.push(h('h4', { text: t('model.facts') }), kv([
            { label: t('model.field.format'), value: 'DXF' + (f.version ? ' · ' + f.version : '') },
            f.units ? { label: t('model.field.units'), value: f.units } : null,
            { label: t('model.field.entities'), value: i18n.formatNumber(f.entities || 0) },
            { label: t('model.field.blocks'), value: i18n.formatNumber(f.blocks || 0) },
          ]));
          parts.push(h('h4', { text: t('model.layers') }), h('div', { class: 'dm-stack-sm' }, (f.layers || []).map((l) => {
            const sw = /** @type {any} */ (h('dm-switch', { label: `${l.name} (${i18n.formatNumber(l.count)})` }));
            sw.checked = !s.hidden.has(l.name);
            sw.addEventListener('change', () => { if (sw.checked) s.hidden.delete(l.name); else s.hidden.add(l.name); applyLayers(); });
            return sw;
          })));
        } else {
          parts.push(h('h4', { text: t('model.facts') }), kv([
            { label: t('model.field.format'), value: f.schema || 'IFC' },
            f.project ? { label: t('model.field.project'), value: f.project } : null,
            f.building ? { label: t('model.field.building'), value: f.building } : null,
            f.application ? { label: t('model.field.application'), value: f.application } : null,
            { label: t('model.field.elements'), value: i18n.formatNumber(f.elements || 0) },
            f.units && f.units.LENGTHUNIT ? { label: t('model.field.units'), value: f.units.LENGTHUNIT } : null,
            handle ? { label: t('model.field.triangles'), value: i18n.formatNumber(handle.info.triangles) } : null,
          ]));
        }
        const selected = s.selected ? await model.element(ds.id, s.selected) : null;
        if (my !== seq || !slots) return;
        if (issues) parts.unshift(issues.el);
        if (selected) {
          parts.push(...(isDxf() ? dxfSelected(selected) : await ifcSelected(selected)));
          const block = D.require('ui/kinds/comment-block');
          parts.push(block.create(ctx, ds, block.targetOf(ds, `element:${s.selected}`, selected.namn || `${selected.typ} ${s.selected}`, () => s.selected)));
        }
        else parts.push(h('p', { class: 'dm-help', text: t('model.select.hint') }));
        if (my !== seq || !slots) return;
        replace(slots.right, ...parts);
      }
      function dxfSelected(e) {
        return [h('h4', { text: t('model.selected') }), kv([
          { label: t('model.col.typ'), value: e.typ }, { label: t('model.col.lager'), value: e.lager },
          e.langd ? { label: t('model.col.langd'), value: fmt(e.langd, 3) } : null, e.area ? { label: t('model.col.area'), value: fmt(e.area, 3) } : null,
          e.text ? { label: t('model.col.text'), value: e.text } : null,
          e.x !== null ? { label: t('model.field.position'), value: `${fmt(e.x, 3)}, ${fmt(e.y, 3)}` } : null,
        ])];
      }
      /** A classification on the elements that show, for example everything of one type on one storey. */
      async function classifyShown() {
        const where = whereSql().replace(/^\s*where\s*/i, '') || '1 = 1';
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        const n = Number((await engine.exec(`select count(*) from data where ${where}`))[0].values[0][0]);
        const value = await ui.dialog.prompt(t('model.classify.prompt', { n: i18n.formatNumber(n) }), { title: t('model.classify'), value: '' });
        if (value === null || value === undefined) return;
        const result = await D.require('data/recipes').apply(ds.id, 'set_on_rows', { column: 'klassificering', value: String(value).trim(), where });
        const text = t('model.classify.done', { n: i18n.formatNumber(result.rows || 0), value: String(value).trim() || '–' });
        shell.log(text, 'ok');
        ui.toast.show(text, { kind: 'ok' });
        if (s.selected) renderInspector();
      }
      async function ifcSelected(e) {
        const out = [h('h4', { text: t('model.selected') }), kv([
          { label: t('model.col.typ'), value: e.typ }, e.namn ? { label: t('model.col.namn'), value: e.namn } : null,
          e.beskrivning ? { label: t('model.field.description'), value: e.beskrivning } : null,
          e.vaning ? { label: t('model.col.vaning'), value: e.vaning } : null, e.typnamn ? { label: t('model.field.typename'), value: e.typnamn } : null,
          e.material ? { label: t('model.col.material'), value: e.material } : null, e.klassificering ? { label: t('model.field.classification'), value: e.klassificering } : null,
          e.tagg ? { label: t('model.col.tagg'), value: e.tagg } : null, { label: t('model.field.guid'), value: e.guid },
        ])];
        const st = handle && handle.meshes.stats.get(Number(e.id));
        if (st) out.push(h('h4', { text: t('model.measured') }), kv([{ label: t('model.measured.area'), value: fmt(st.area) + ' m²' }, { label: t('model.measured.volume'), value: fmt(st.volume, 3) + ' m³' }]));
        const group = (rows, valueOf) => {
          const sets = new Map();
          for (const r of rows) { if (!sets.has(r.uppsattning)) sets.set(r.uppsattning, []); sets.get(r.uppsattning).push({ label: r.namn, value: valueOf(r) }); }
          return Array.from(sets.entries()).map(([name, items]) => h('details', { class: 'dm-more', open: sets.size <= 3 ? true : null }, h('summary', { text: name || t('model.unnamed') }), kv(items)));
        };
        const quantities = await model.quantities(ds.id, e.id);
        if (quantities.length) out.push(h('h4', { text: t('model.quantities') }), ...group(quantities, (r) => fmt(r.varde, 3) + (r.enhet ? ' ' + r.enhet : '')));
        const properties = await model.properties(ds.id, e.id);
        if (properties.length) out.push(h('h4', { text: t('model.properties') }), ...group(properties, (r) => {
          const shown = r.varde === 'true' ? t('common.yes') : (r.varde === 'false' ? t('common.no') : (r.tal !== null ? fmt(r.tal, 3) : (r.varde === null ? '' : r.varde)));
          return shown + (r.enhet ? ' ' + r.enhet : '') + (r.kalla === 'typ' ? ' ' + t('model.from.type') : '');
        }));
        return out;
      }

      // ---- save as a chart ------------------------------------------------------------------------------------
      async function saveChart() {
        const name = await ui.dialog.prompt(t('viz.name'), { title: t('viz.save.as.chart'), value: t('model.chart.default', { name: ds.name }) });
        if (!name) return;
        try {
          const record = charts.create('model', ds, name.trim());
          const where = whereSql();
          let visible = null;
          if (where) { const res = await (await datasets.ensureOpen(ds.id)).engine.exec(`select id from data${where}`); visible = res[0] ? res[0].values.map((r) => Number(r[0])) : []; }
          record.model = { datasetId: ds.id, visible, filter: Object.assign({}, s.filter), hiddenLayers: Array.from(s.hidden), view: handle ? handle.view() : null };
          if (handle) record.thumbnail = handle.png();
          const saved = await charts.save(record);
          shell.log(t('viz.saved.toast', { name: saved.name }), 'ok');
          ui.toast.show(t('viz.saved.toast', { name: saved.name }), { kind: 'ok', action: { label: t('map.open.visualisera'), onClick: () => { store.set({ openChartId: saved.id }); shell.activate('visualisera'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      return { render, destroy, state: s, get handle() { return handle; } };
    }
    return { create };
  });
})();
