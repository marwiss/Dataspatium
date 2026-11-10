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
      const s = { id: null, filter: { typ: '', vaning: '', lager: '', search: '' }, selected: null, count: 0, hidden: new Set(), error: '', progress: null, preview: null };
      let ds = null; let slots = null; let handle = null; let host = null; let table = null; let seq = 0; let searchTimer = 0;
      let svgEl = null; let box = null; let removeDrag = null;
      /** The button for the orthographic view, whose state follows the view (the key O changes it too). */ let orthoBtn = null;
      /** The button Visa bara markerade. */ let isolateBtn = null;
      /** The button Snitt and the section panel in the inspector, when open. */ let sectionBtn = null; let sectionEl = null;
      /** The issues panel, when open. */ let issues = null;
      /** The panel Fråga AI, when open. */ let ai = null;
      /** The panel Jämför versioner, when open. */ let compare = null;

      const isDxf = () => model.isDxf(ds);
      const whereSql = () => model.whereOf(s.filter, isDxf());
      const facts = () => (ds && ds.model) || {};
      const fmt = (v, digits = 2) => (typeof v === 'number' ? i18n.formatNumber(Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits)) : String(v === null || v === undefined ? '' : v));

      function destroy() {
        seq++;
        clearTimeout(searchTimer);
        if (handle) { handle.destroy(); handle = null; }
        if (removeDrag) { removeDrag(); removeDrag = null; }
        if (issues) { issues.destroy(); issues = null; } if (ai) { ai.destroy(); ai = null; } if (compare) { compare.destroy(); compare = null; }
        slots = null; host = null; table = null; svgEl = null;
      }

      /** @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target */
      async function render(dataset, target) {
        // A new drawing of the same model (a store update, a saved table) keeps the camera, its projection and its section.
        if (handle) { if (s.id === dataset.id && !(s.preview && s.preview.bytes)) s.lastView = handle.view(); handle.destroy(); handle = null; }
        if (removeDrag) { removeDrag(); removeDrag = null; }
        slots = target;
        const my = ++seq;
        if (s.id !== dataset.id) { s.id = dataset.id; s.filter = { typ: '', vaning: '', lager: '', search: '' }; s.selected = null; s.hidden = new Set(); s.preview = null; s.isolated = null; s.sectionOpen = false; s.sectionPlanes = null; s.lastView = null; s.pendingViewpoint = null; if (issues) { issues.destroy(); issues = null; } if (ai) { ai.destroy(); ai = null; } if (compare) { compare.destroy(); compare = null; } }
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
              isDxf() ? null : ui.button({ label: t('ai.button'), icon: 'cpu', title: t('ai.button.hint'), 'data-model-ai-toggle': '', onClick: toggleAi }),
              isDxf() ? null : ui.button({ label: t('compare.button'), icon: 'history', title: t('compare.button.hint'), 'data-model-compare-toggle': '', onClick: toggleCompare }),
              selects, search,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('model.fit.hint'), onClick: fitAll }),
              ui.button({ label: t('model.zoom.marked'), icon: 'circle-dot', 'icon-only': true, title: t('model.zoom.marked.hint'), 'data-model-zoom-marked': '', onClick: () => { if (handle) handle.fit(handle.marked()); else if (!zoomDxfTo(s.selected)) fitAll(); } }),
              isDxf() ? null : (isolateBtn = ui.button({ label: t('model.isolate'), icon: 'eye', 'icon-only': true, title: t('model.isolate.hint'), 'data-model-isolate': '', onClick: () => toggleIsolate().catch((err) => shell.log(String((err && err.message) || err), 'error')) })),
              isDxf() ? null : (sectionBtn = ui.button({ label: t('model.section'), icon: 'layers', 'icon-only': true, title: t('model.section.hint'), 'data-model-section': '', onClick: toggleSection })),
              isDxf() ? null : (orthoBtn = ui.button({ label: t('model.ortho'), icon: 'square', 'icon-only': true, title: t('model.ortho.hint'), 'data-model-ortho': '', onClick: () => { if (handle) handle.setProjection(handle.projection() === 'orthographic' ? 'perspective' : 'orthographic'); } })),
              ui.button({ label: t('viz.save.as.chart'), icon: 'chart-column', title: t('model.chart.save.hint'), onClick: saveChart }),
              options.onActions && !isDxf() ? ui.button({ label: t('bearbeta.actions'), icon: 'sparkles', title: t('model.actions.hint'), 'data-model-actions': '', onClick: () => options.onActions() }) : null,
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
          camera: (vp) => { if (handle) return handle.setViewpoint(vp); s.pendingViewpoint = vp; return true; },
          view: () => {
            if (!handle) return null;
            const v = handle.view();
            // The camera also in the model's own coordinates, for BCF: other clients put it where the view had it.
            return Object.assign(v, { fov: handle.camera && handle.camera.fov ? handle.camera.fov : 45, aspect: handle.camera ? Math.round(handle.camera.aspect * 100) / 100 : 1.6 }, handle.toIfc ? { ifc: { position: handle.toIfc(v.position), target: handle.toIfc(v.target) } } : {});
          },
          png: () => (handle ? handle.png() : ''),
          marked: () => (handle ? handle.marked() : (s.selected ? [s.selected] : [])),
          setColors: (groups) => { if (handle) handle.setColors(groups || []); },
        });
        issues.start().catch((err) => shell.log(String((err && err.message) || err), 'error'));
      }
      function toggleIssues() {
        if (issues) { issues.destroy(); issues = null; if (handle) handle.setColors([]); } else openIssues();
        renderInspector();
      }
      /**
       * The change set's preview from the AI panel: the candidate file drawn instead of the model with its colours, or only colours on
       * the model (no redraw), or nothing. The dataset is untouched; an approved change set reaches the view as a new version.
       * @param {{bytes?: Uint8Array|null, colors?: Array<{color: string, ids: number[]}>}|null} preview
       */
      async function setPreview(preview) {
        const hadBytes = !!(s.preview && s.preview.bytes);
        s.preview = preview || null;
        if (isDxf() || !host) return;
        if (!hadBytes && !(preview && preview.bytes)) { if (handle) handle.setColors(preview && preview.colors ? preview.colors : []); return; }
        if (handle) { handle.destroy(); handle = null; }
        await drawIfc(++seq);
      }
      /** The panel Fråga AI om modellen, in the inspector; the elements of an answer are marked through data/selection. */
      function toggleAi() {
        if (ai) { ai.destroy(); ai = null; } else ai = D.require('ui/bearbeta/ai-panel').create(ctx, { datasetId: ds.id, preview: setPreview });
        renderInspector();
      }
      /** The panel Jämför versioner, in the inspector; it colours the model or draws the other version through setPreview. */
      function toggleCompare() {
        if (compare) { compare.destroy(); compare = null; } else compare = D.require('ui/bearbeta/model-compare').create(ctx, ds, { preview: setPreview });
        renderInspector();
      }
      function setIsolated(ids) {
        s.isolated = ids && ids.length ? ids.slice() : null;
        if (isolateBtn) isolateBtn.toggleAttribute('active', !!s.isolated);
      }
      /** Visa bara markerade: only the marked elements, with the view turning about them; again shows what the filter shows. */
      async function toggleIsolate() {
        if (!handle) return;
        if (s.isolated) {
          setIsolated(null);
          const where = whereSql();
          if (!where) handle.setVisible(null);
          else { const res = await (await datasets.ensureOpen(ds.id)).engine.exec(`select id from data${where}`); if (handle) handle.setVisible(res[0] ? res[0].values.map((r) => Number(r[0])) : []); }
          handle.fit();
          return;
        }
        const ids = handle.marked();
        if (!ids.length) { ui.toast.show(t('model.isolate.none'), { kind: 'info' }); return; }
        setIsolated(ids);
        handle.setVisible(ids);
        handle.fit(ids);
      }
      function toggleSection() {
        s.sectionOpen = !s.sectionOpen;
        sectionEl = s.sectionOpen && handle ? sectionPanel() : null;
        renderInspector();
      }
      /**
       * The panel Snitt: a section box with two sliders per axis of the model (east–west, south–north, height), a cut at a storey
       * from its floor up to 1.2 m (a plan), and the button that takes the section away. The box is in the model's own coordinates.
       */
      function sectionPanel() {
        const bounds = handle.boundsIfc(null);
        const lo = bounds.min.map((v, k) => v - Math.max((bounds.max[k] - bounds.min[k]) * 0.02, 0.1));
        const hi = bounds.max.map((v, k) => v + Math.max((bounds.max[k] - bounds.min[k]) * 0.02, 0.1));
        const box = draw.boxOfPlanes(handle.section(), { min: lo, max: hi });
        const el = h('div', { class: 'dm-stack-sm', 'data-model-section-panel': '' }, h('h4', { text: t('model.section.title') }));
        const rebuild = () => { sectionEl = sectionPanel(); renderInspector(); };
        const clear = ui.button({ label: t('model.section.clear'), icon: 'x', size: 'sm', title: t('model.section.clear.hint'), 'data-model-section-clear': '', onClick: () => { if (handle) handle.setSection([]); rebuild(); } });
        if (!box) {
          el.append(h('p', { class: 'dm-help', text: t('model.section.other') }), clear);
          return el;
        }
        const fmt2 = (v) => i18n.formatNumber(Math.round(v * 100) / 100);
        const apply = () => { if (handle) handle.setSection(draw.boxPlanes(box)); };
        const storeys = (facts().storeys || []).slice().reverse();
        if (storeys.length) {
          const pick = /** @type {any} */ (h('dm-select', { label: t('model.section.storey'), help: t('model.section.storey.help'), 'data-model-section-storey': '' }));
          pick.options = [{ value: '', label: t('model.section.storey.none') }].concat(storeys.map((x) => ({ value: x.name, label: x.name })));
          pick.addEventListener('change', async () => {
            if (!pick.value || !handle) return;
            const res = await (await datasets.ensureOpen(ds.id)).engine.exec('select id from data where vaning = ?', [pick.value]);
            const ids = res[0] ? res[0].values.map((r) => Number(r[0])) : [];
            if (!ids.length || !handle) return;
            const floor = handle.boundsIfc(ids).min[2];
            box.min = lo.slice(); box.max = hi.slice();
            box.min[2] = floor - 0.05; box.max[2] = floor + 1.2;
            apply();
            rebuild();
          });
          el.append(pick);
        }
        el.append(h('p', { class: 'dm-help', text: t('model.section.help') }));
        for (let k = 0; k < 3; k++) {
          const axis = t('model.section.axis.' + 'xyz'[k]);
          const text = h('span', { class: 'dm-help' });
          const show = () => { text.textContent = t('model.section.range', { from: fmt2(box.min[k]), to: fmt2(box.max[k]) }); };
          const slider = (which) => {
            const input = /** @type {any} */ (h('dm-input', { type: 'range', min: '0', max: '100', step: '0.1', 'aria-label': t('model.section.' + which, { axis }), ['data-model-section-' + which + '-' + 'xyz'[k]]: '' }));
            const at = which === 'from' ? box.min[k] : box.max[k];
            input.value = String(Math.round(Math.max(0, Math.min(1, (at - lo[k]) / (hi[k] - lo[k]))) * 1000) / 10);
            input.addEventListener('input', () => {
              const v = lo[k] + (hi[k] - lo[k]) * Number(input.value) / 100;
              if (which === 'from') box.min[k] = Math.min(v, box.max[k] - 0.01); else box.max[k] = Math.max(v, box.min[k] + 0.01);
              show();
              apply();
            });
            return input;
          };
          show();
          el.append(h('div', { class: 'dm-stack-sm dm-model-section-axis' }, h('strong', { text: axis }), slider('from'), slider('to'), text));
        }
        el.append(h('div', { class: 'dm-row-wrap' }, clear));
        return el;
      }
      function applyDxfBox() { if (svgEl && box) svgEl.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`); }
      /** The drawing zoomed to an element with room around it; false when it is not drawn (a hidden layer, an unknown id). */
      function zoomDxfTo(id) {
        if (!svgEl || !box || !id) return false;
        const el = svgEl.querySelector(`[data-id="${Number(id)}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect(); const sr = svgEl.getBoundingClientRect();
        if (!sr.width || !sr.height || (!r.width && !r.height)) return false;
        // The viewBox is drawn with "meet": one scale for both axes and the rest as margins.
        const k = Math.min(sr.width / box.w, sr.height / box.h);
        const ox = (sr.width - box.w * k) / 2; const oy = (sr.height - box.h * k) / 2;
        const cx = box.x + (r.left - sr.left - ox + r.width / 2) / k; const cy = box.y + (r.top - sr.top - oy + r.height / 2) / k;
        const home = svgEl.dmHome || box;
        const w = Math.max(r.width / k * 1.6, home.w * 0.02); const h = Math.max(r.height / k * 1.6, home.h * 0.02);
        box = { x: cx - w / 2, y: cy - h / 2, w, h };
        applyDxfBox();
        return true;
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
      /** Filters narrow the table and the drawing together; a new filter ends an isolation. */
      async function applyFilter() {
        setIsolated(null);
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
        if (svgEl && from === 'table' && id) zoomDxfTo(id);
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
          const candidate = s.preview && s.preview.bytes ? s.preview.bytes : null;
          // A candidate holds elements the table does not know yet, so a filter cannot narrow it.
          if (where && !candidate) { const res = await (await datasets.ensureOpen(ds.id)).engine.exec(`select id from data${where}`); visible = res[0] ? res[0].values.map((r) => Number(r[0])) : []; }
          if (s.isolated && !candidate) visible = s.isolated;
          const kept = !candidate && s.lastView ? s.lastView : null;
          s.lastView = null;
          const hd = await draw.render(host, { datasetId: ds.id, visible, selected: s.selected ? [s.selected] : [], bytes: candidate, colors: s.preview && s.preview.colors ? s.preview.colors : null, view: kept }, {
            navigation: true,
            label: t('model.canvas'),
            onProjection: (kind) => { if (orthoBtn) orthoBtn.toggleAttribute('active', kind === 'orthographic'); },
            onSection: (planes) => { s.sectionPlanes = planes.length ? planes : null; if (sectionBtn) sectionBtn.toggleAttribute('active', planes.length > 0); },
            onSelect: (id) => selectElement(id, 'draw'),
            onProgress: (n) => { if (my === seq) note.textContent = t('model.loading.n', { n: i18n.formatNumber(n) }); },
          });
          if (my !== seq || !host) { hd.destroy(); return; }
          host.querySelector('.dm-model-loading')?.remove();
          handle = hd;
          if (s.pendingViewpoint) { hd.setViewpoint(s.pendingViewpoint); s.pendingViewpoint = null; }
          if (orthoBtn) orthoBtn.toggleAttribute('active', hd.projection() === 'orthographic');
          // A new drawing of the same model (a preview) keeps the section.
          if (s.sectionPlanes && !candidate) hd.setSection(s.sectionPlanes);
          if (sectionBtn) sectionBtn.toggleAttribute('active', hd.section().length > 0);
          if (s.sectionOpen) sectionEl = sectionPanel();
          if (isolateBtn) isolateBtn.toggleAttribute('active', !!s.isolated);
          // The view cube turns with the camera and takes it to the standard views.
          const cube = /** @type {any} */ (h('dm-viewcube'));
          host.appendChild(cube);
          cube.addEventListener('dm-view', (ev) => { if (handle) handle.standardView(ev.detail.view); });
          hd.onView((cam) => { cube.orientation = cam.matrixWorldInverse.elements; });
          // A new drawing of the same model keeps the issue colours the panel chose.
          if (issues && issues.currentColors) { const groups = issues.currentColors(); if (groups.length) hd.setColors(groups); }
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
        const setBox = applyDxfBox;
        const scaleOf = () => { const r = host.getBoundingClientRect(); return Math.max(box.w / Math.max(r.width, 1), box.h / Math.max(r.height, 1)); };
        /** Zooms by k (below 1 comes closer) about a point of the screen. */
        const zoomAt = (clientX, clientY, k) => {
          const r = host.getBoundingClientRect();
          const px = (clientX - r.left) / Math.max(r.width, 1); const py = (clientY - r.top) / Math.max(r.height, 1);
          const nw = box.w * k; const nh = box.h * k;
          box.x += (box.w - nw) * px; box.y += (box.h - nh) * py; box.w = nw; box.h = nh;
          setBox();
        };
        const onWheel = (ev) => { ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, ev.deltaY > 0 ? 1.2 : 1 / 1.2); };
        // One pointer pans; two pinch to zoom about their middle (a touch screen).
        /** @type {Map<number, number[]>} */ const pointers = new Map();
        let down = null; let pinch = 0;
        const onDown = (ev) => {
          pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
          if (pointers.size === 2) {
            const [a, b] = Array.from(pointers.values());
            pinch = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1);
            if (down) down.moved = true;
            return;
          }
          down = { x: ev.clientX, y: ev.clientY, sx: box.x, sy: box.y, moved: false };
        };
        const onMove = (ev) => {
          if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
          if (pinch && pointers.size === 2) {
            const [a, b] = Array.from(pointers.values());
            const d = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1);
            zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch / d);
            pinch = d;
            return;
          }
          if (!down) return;
          const k = scaleOf();
          if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 3) down.moved = true;
          box.x = down.sx - (ev.clientX - down.x) * k; box.y = down.sy - (ev.clientY - down.y) * k;
          setBox();
        };
        const onUp = (ev) => {
          pointers.delete(ev.pointerId);
          if (pointers.size < 2) pinch = 0;
          if (pointers.size) {
            // A finger left after a pinch pans on from where it is, and is no click.
            const [p] = Array.from(pointers.values());
            down = { x: p[0], y: p[1], sx: box.x, sy: box.y, moved: true };
            return;
          }
          const wasClick = down && !down.moved;
          down = null;
          if (!wasClick) return;
          const target = /** @type {Element} */ (ev.target);
          const hit = target && target.closest ? target.closest('[data-id]') : null;
          selectElement(hit ? Number(hit.getAttribute('data-id')) : null, 'draw');
        };
        // The keys, while the drawing has focus: the arrows move, + and − zoom, Home shows all and F the marked object.
        const onKey = (ev) => {
          if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
          const k = ev.key;
          let done = true;
          if (k === 'ArrowLeft') box.x -= box.w * 0.1;
          else if (k === 'ArrowRight') box.x += box.w * 0.1;
          else if (k === 'ArrowUp') box.y -= box.h * 0.1;
          else if (k === 'ArrowDown') box.y += box.h * 0.1;
          else if (k === '+' || k === '=' || k === '-' || k === '_') { const r = host.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, k === '+' || k === '=' ? 1 / 1.2 : 1.2); }
          else if (k === 'Home') box = Object.assign({}, svgEl.dmHome);
          else if (k === 'f' || k === 'F') { if (!zoomDxfTo(s.selected)) box = Object.assign({}, svgEl.dmHome); }
          else done = false;
          if (done) { ev.preventDefault(); setBox(); }
        };
        host.tabIndex = 0;
        host.addEventListener('keydown', onKey);
        host.addEventListener('wheel', onWheel, { passive: false });
        host.addEventListener('pointerdown', onDown);
        globalThis.addEventListener('pointermove', onMove);
        globalThis.addEventListener('pointerup', onUp);
        globalThis.addEventListener('pointercancel', onUp);
        removeDrag = () => { globalThis.removeEventListener('pointermove', onMove); globalThis.removeEventListener('pointerup', onUp); globalThis.removeEventListener('pointercancel', onUp); };
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
        if (s.sectionOpen && sectionEl && !isDxf()) parts.unshift(sectionEl);
        if (ai) parts.unshift(ai.el);
        if (compare) parts.unshift(compare.el);
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
        // A model from a CDE has a graph on the server: the element's neighbours there are one click away.
        if (ds.source && ds.source.cde && e.guid) out.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('ifcgraph.title'), icon: 'network', size: 'sm', title: t('ifcgraph.open.element.hint'), 'data-model-graph': '', onClick: async () => { if (!(await D.require('api/graph-source').open(ctx, ds, { guid: e.guid }))) ui.toast.show(t('cde.err.noconnector', { host: ds.source.cde.host }), { kind: 'warn' }); } })));
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
