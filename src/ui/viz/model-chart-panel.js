// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Editor for the chart kind "model" in Visualisera: a saved picture of an IFC model or a DXF drawing with its filter
 * and camera. The chart keeps which elements show and from where the camera looks; export and dashboards draw it
 * again through viz/model-draw.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/model-chart-panel', ['ui/base', 'ui/basic', 'viz/model-draw', 'data/model', 'data/datasets'], (base, basic, draw, model, datasets) => {
    const { h, t, i18n, replace } = base;
    function select(label, opts, value, onChange) { const el = /** @type {any} */ (h('dm-select', { label })); el.options = opts; el.value = value; el.addEventListener('change', () => onChange(el.value)); return el; }

    /** @param {{chart: any, onChange: (def: any) => void, log: Function, onInspect?: () => void}} options */
    function create(options) {
      const { chart } = options;
      if (!chart.model) chart.model = { datasetId: chart.datasetId, visible: null, filter: { typ: '', vaning: '', lager: '', search: '' }, view: null };
      const def = chart.model;
      if (!def.datasetId) def.datasetId = chart.datasetId;
      if (!def.filter) def.filter = { typ: '', vaning: '', lager: '', search: '' };
      const el = h('div', { class: 'dm-viz-layout' });
      const side = h('div', { class: 'dm-viz-side dm-stack' });
      const preview = h('div', { class: 'dm-chart-preview dm-model-host dm-model-preview' });
      const info = h('p', { class: 'dm-help' });
      replace(el, side, h('div', { class: 'dm-viz-main' }, preview, info));
      let handle = null; let seq = 0; let meta = null; let models = [];
      const changed = () => options.onChange(def);

      async function drawNow() {
        const my = ++seq;
        if (handle) { handle.destroy(); handle = null; }
        if (!def.datasetId) { replace(preview, h('p', { class: 'dm-help', text: t('model.chart.pick') })); return; }
        meta = await datasets.get(def.datasetId);
        if (my !== seq) return;
        renderSide();
        if (model.isDxf(meta)) {
          const blob = await draw.toBlob(chart, 'svg', {});
          if (my !== seq) return;
          const doc = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
          const svg = document.importNode(doc.documentElement, true);
          svg.setAttribute('class', 'dm-dxf-svg');
          replace(preview, svg);
          info.textContent = t('model.entities.n', { n: i18n.formatNumber((meta && meta.rowCount) || 0) });
          return;
        }
        replace(preview, h('dm-progress', { indeterminate: true, label: t('model.loading') }));
        try {
          const hd = await draw.render(preview, { datasetId: def.datasetId, visible: def.visible || null, view: def.view || null }, {});
          if (my !== seq) { hd.destroy(); return; }
          preview.querySelector('dm-progress')?.remove();
          handle = hd;
          info.textContent = `${t('model.field.triangles')}: ${i18n.formatNumber(hd.info.triangles)}`;
          // The camera is part of the chart: it is kept when the user looks around.
          hd.renderer.domElement.addEventListener('pointerup', () => { def.view = hd.view(); changed(); });
          hd.renderer.domElement.addEventListener('wheel', () => { def.view = hd.view(); changed(); }, { passive: true });
        } catch (err) { replace(preview, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); options.log(String((err && err.message) || err), 'error'); }
      }
      async function refilter() {
        const where = model.whereOf(def.filter, model.isDxf(meta));
        if (!where) { def.visible = null; if (handle) handle.setVisible(null); changed(); return; }
        const res = await (await datasets.ensureOpen(def.datasetId)).engine.exec(`select id from data${where}`);
        def.visible = res[0] ? res[0].values.map((r) => Number(r[0])) : [];
        if (handle) handle.setVisible(def.visible);
        changed();
      }
      function renderSide() {
        const facts = (meta && meta.model) || {};
        const nodes = [select(t('model.chart.dataset'), [{ value: '', label: '–' }].concat(models.map((m) => ({ value: m.id, label: m.name }))), def.datasetId || '', (v) => { def.datasetId = v; def.visible = null; def.view = null; def.filter = { typ: '', vaning: '', lager: '', search: '' }; chart.datasetId = v; const ds = models.find((m) => m.id === v); chart.datasetName = ds ? ds.name : ''; changed(); drawNow(); })];
        if (!model.isDxf(meta)) {
          if ((facts.elementTypes || []).length) nodes.push(select(t('model.filter.type'), [{ value: '', label: t('model.filter.type') }].concat(facts.elementTypes.map((x) => ({ value: x.name, label: `${x.name} (${i18n.formatNumber(x.count)})` }))), def.filter.typ, (v) => { def.filter.typ = v; refilter(); }));
          if ((facts.storeys || []).length) nodes.push(select(t('model.filter.storey'), [{ value: '', label: t('model.filter.storey') }].concat(facts.storeys.slice().reverse().map((x) => ({ value: x.name, label: x.name }))), def.filter.vaning, (v) => { def.filter.vaning = v; refilter(); }));
          nodes.push(basic.button({ label: t('map.fit'), icon: 'scan-line', size: 'sm', title: t('model.fit.hint'), onClick: () => { if (handle) { handle.fit(); def.view = null; changed(); } } }));
        }
        nodes.push(h('p', { class: 'dm-help dm-xs', text: t('model.chart.hint') }));
        replace(side, nodes);
      }
      datasets.list().then((list) => { models = list.filter((d) => d.kind === 'model'); renderSide(); }).catch(() => {});
      async function exportBlob(format, opts = {}) { return draw.toBlob(chart, format, opts); }
      async function thumbnail() {
        try {
          const blob = await draw.toBlob(chart, 'png', { width: 480, height: 300 });
          return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
        } catch (_e) { return chart.thumbnail || null; }
      }
      function inspector() { return h('p', { class: 'dm-help', text: t('model.chart.about') }); }
      function destroy() { seq++; if (handle) { handle.destroy(); handle = null; } }
      drawNow();
      return { el, exportBlob, thumbnail, inspector, destroy, redraw: drawNow };
    }
    return { create };
  });
})();
