// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Mängder tab in Analysera for datasets of kind "model": a summary of the model, quantities per type, storey and
 * material (from the file's quantity sets or measured on the geometry), every quantity name, the values of a property
 * and the entity types of the file. For a DXF drawing: count, length and area per layer and type. Every result can be
 * saved as a dataset. The logic lives in analysis/model. The tool Ärenden counts the issues of a saved issue table (from the
 * model view's panel) per status, type, element type or storey; data/issues does the counting.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/model-panel', ['ui/base', 'data/datasets', 'data/model', 'analysis/model', 'data/issues'], (base, datasets, model, analysis, issuesLogic) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 2000;
    const IFC_TOOLS = ['summary', 'quantities', 'list', 'properties', 'entities', 'issues'];
    const DXF_TOOLS = ['summary', 'quantities', 'entities'];

    /** @param {any} ctx shell context @param {{rerenderRight?: () => void}} [options] */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'summary', group1: 'typ', group2: '', source: 'file', category: 'byggdel', property: '', layer1: 'lager', layer2: '', issuesId: '', igroup1: 'topic_status', igroup2: 'element_typ' };
      let fieldsEl = null; let resultEl = null; let seq = 0;
      /** @type {{id: string, list: any[]}|null} */ let names = null;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'model';
      const toolsFor = (ds) => (model.isDxf(ds) ? DXF_TOOLS : IFC_TOOLS);

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('ruler', 20), t('model.tool.title')));
        const tabs = /** @type {any} */ (h('dm-tabs'));
        const list = toolsFor(selected());
        if (!list.includes(s.tool)) s.tool = 'summary';
        tabs.tabs = list.map((id) => ({ id, label: t('model.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; renderFields(); run(); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); run();
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      function select(label, opts, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = opts; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }
      const groupOptions = (list, none) => (none ? [{ value: '', label: t('map.none') }] : []).concat(list.map((g) => ({ value: g, label: t('model.col.' + g) })));

      async function renderFields() {
        if (!fieldsEl) return;
        const ds = selected();
        if (!usable(ds)) { replace(fieldsEl); return; }
        const parts = [];
        if (s.tool === 'quantities' && !model.isDxf(ds)) {
          parts.push(h('div', { class: 'dm-row-wrap' },
            select(t('model.group.first'), groupOptions(analysis.IFC_GROUPS), s.group1, (v) => { s.group1 = v; run(); }),
            select(t('model.group.second'), groupOptions(analysis.IFC_GROUPS, true), s.group2, (v) => { s.group2 = v; run(); }),
            select(t('model.source'), [{ value: 'file', label: t('model.source.file') }, { value: 'geometry', label: t('model.source.geometry') }], s.source, (v) => { s.source = v; run(); if (options.rerenderRight) options.rerenderRight(); }),
            select(t('model.category'), ['byggdel', 'rum', ''].map((c) => ({ value: c, label: t('model.category.' + (c || 'all')) })), s.category, (v) => { s.category = v; run(); })));
        } else if (s.tool === 'quantities') {
          parts.push(h('div', { class: 'dm-row-wrap' },
            select(t('model.group.first'), groupOptions(analysis.DXF_GROUPS), s.layer1, (v) => { s.layer1 = v; run(); }),
            select(t('model.group.second'), groupOptions(analysis.DXF_GROUPS, true), s.layer2, (v) => { s.layer2 = v; run(); })));
        } else if (s.tool === 'issues') {
          const tables = issuesLogic.tablesFor(store.get().datasets, ds);
          if (!tables.length) {
            parts.push(h('p', { class: 'dm-help', text: t('model.issues.none') }),
              h('div', null, ui.button({ label: t('issues.title'), icon: 'message-square', size: 'sm', title: t('model.issues.open.hint'), onClick: () => { store.set({ selectedId: ds.id, openModelIssues: { datasetId: ds.id } }); shell.activate('bearbeta'); } })));
          } else {
            if (!tables.some((x) => x.id === s.issuesId)) s.issuesId = tables[0].id;
            const groupOpts = (none) => (none ? [{ value: '', label: t('map.none') }] : []).concat(issuesLogic.SUMMARY_GROUPS.map((g) => ({ value: g, label: t('issues.field.' + g) })));
            parts.push(h('div', { class: 'dm-row-wrap' },
              select(t('model.issues.table'), tables.map((x) => ({ value: x.id, label: x.name })), s.issuesId, (v) => { s.issuesId = v; run(); }),
              select(t('model.group.first'), groupOpts(false), s.igroup1, (v) => { s.igroup1 = v; run(); }),
              select(t('model.group.second'), groupOpts(true), s.igroup2, (v) => { s.igroup2 = v; run(); })));
          }
        } else if (s.tool === 'properties') {
          if (!names || names.id !== ds.id) names = { id: ds.id, list: await analysis.propertyNames(ds.id) };
          if (!fieldsEl) return;
          if (!s.property && names.list.length) s.property = JSON.stringify([names.list[0].set, names.list[0].name]);
          parts.push(select(t('model.property'), names.list.map((p) => ({ value: JSON.stringify([p.set, p.name]), label: `${p.set} · ${p.name} (${i18n.formatNumber(p.count)})` })), s.property, (v) => { s.property = v; run(); }));
        }
        replace(fieldsEl, ...parts);
      }

      async function run() {
        if (!resultEl) return;
        const ds = selected();
        const my = ++seq;
        if (!usable(ds)) { replace(resultEl, h('p', { class: 'dm-help', text: t('model.tool.needs') })); return; }
        const facts = ds.model || {};
        try {
          let out;
          if (s.tool === 'summary') out = summary(ds);
          else if (s.tool === 'entities') out = Object.assign(analysis.entityTypes(ds), { note: t('model.entities.note', { n: i18n.formatNumber(facts.entities || 0) }) });
          else if (s.tool === 'quantities' && model.isDxf(ds)) out = await analysis.drawing(ds.id, [s.layer1, s.layer2]);
          else if (s.tool === 'quantities') {
            const groups = [s.group1, s.group2];
            if (s.source === 'geometry') {
              replace(resultEl, h('dm-progress', { indeterminate: true, label: t('model.loading') }));
              out = await analysis.fromGeometry(ds.id, { groups, category: s.category });
              out.note = t('model.source.geometry.note');
            } else {
              out = await analysis.fromFile(ds.id, { groups, category: s.category });
              out.note = (facts.quantities ? t('model.source.file.note') : t('model.source.file.none'));
            }
          } else if (s.tool === 'issues') {
            const tables = issuesLogic.tablesFor(store.get().datasets, ds);
            if (!tables.some((x) => x.id === s.issuesId)) s.issuesId = tables[0] ? tables[0].id : '';
            if (!s.issuesId) out = { columns: [], rows: [], note: t('model.issues.none') };
            else {
              out = await issuesLogic.summary(s.issuesId, [s.igroup1, s.igroup2]);
              out.columns = out.columns.map((c) => Object.assign({}, c, { label: t(issuesLogic.SUMMARY_GROUPS.includes(c.name) ? 'issues.field.' + c.name : 'model.issues.col.' + c.name) }));
              out.note = t('model.issues.note', { name: (tables.find((x) => x.id === s.issuesId) || {}).name || '' });
            }
          } else if (s.tool === 'list') {
            out = await analysis.quantityList(ds.id);
            out.note = out.rows.length ? t('model.list.note') : t('model.source.file.none');
          } else if (s.tool === 'properties') {
            if (!s.property) out = { columns: [], rows: [], note: t('model.properties.none') };
            else { const [set, name] = JSON.parse(s.property); out = await analysis.propertyValues(ds.id, set, name); out.note = `${set} · ${name}`; }
          }
          if (my !== seq || !resultEl) return;
          out.name = `${ds.name}: ${t('model.tool.' + s.tool)}`;
          showTable(out);
        } catch (err) {
          if (my !== seq || !resultEl) return;
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log(String((err && err.message) || err), 'error');
        }
      }
      function summary(ds) {
        const f = ds.model || {};
        const col = (name) => ({ name, type: 'text', label: t('model.summary.' + name) });
        const rows = model.isDxf(ds)
          ? [[t('model.field.format'), 'DXF ' + (f.version || '')], [t('model.field.units'), f.units || '–'], [t('model.field.entities'), i18n.formatNumber(f.entities || 0)], [t('model.field.blocks'), i18n.formatNumber(f.blocks || 0)], [t('model.layers'), i18n.formatNumber((f.layers || []).length)], [t('model.field.file'), f.file || '']]
          : [[t('model.field.format'), f.schema || ''], [t('model.field.project'), f.project || ''], [t('model.field.building'), f.building || ''], [t('model.field.application'), f.application || ''], [t('model.field.elements'), i18n.formatNumber(f.elements || 0)], [t('model.field.rooms'), i18n.formatNumber(f.rooms || 0)], [t('model.field.storeys'), (f.storeys || []).map((x) => x.name).join(', ')], [t('model.properties'), i18n.formatNumber(f.properties || 0)], [t('model.quantities'), i18n.formatNumber(f.quantities || 0)], [t('model.field.entities'), i18n.formatNumber(f.entities || 0)], [t('model.field.units'), f.units ? f.units.LENGTHUNIT : ''], [t('model.field.file'), f.file || '']];
        return { columns: [col('field'), col('value')], rows: rows.filter((r) => r[1] !== ''), note: t('model.tool.about.summary') };
      }
      function showTable(out) {
        const table = /** @type {any} */ (h('dm-table'));
        replace(resultEl,
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-grow', text: out.note || '' }),
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, onClick: () => createDataset(out) })),
          h('div', { class: 'dm-table-wrap' }, table));
        requestAnimationFrame(() => {
          if (!table.isConnected) return;
          table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label && c.label !== c.name ? c.label : t('model.col.' + c.name), type: c.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count) });
        });
      }
      async function createDataset(out) {
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: out.name });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })), rows: out.rows, description: out.note || '', source: { kind: 'derived' } });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok', action: { label: t('import.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      function inspector() {
        const ds = selected();
        const items = [h('h4', { text: t('model.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('model.tool.about.' + s.tool) })];
        if (usable(ds)) items.push(h('p', { class: 'dm-help', text: ds.name }));
        return items;
      }
      function datasetChanged() { names = null; if (fieldsEl) { renderFields(); run(); } }
      function destroy() { seq++; fieldsEl = null; resultEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s };
    }
    return { create };
  });
})();
