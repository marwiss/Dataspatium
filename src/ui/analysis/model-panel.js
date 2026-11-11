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
  D.define('ui/analysis/model-panel', ['ui/base', 'ui/basic', 'data/datasets', 'data/model', 'analysis/model', 'data/issues'], (base, basic, datasets, model, analysis, issuesLogic) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 2000;
    const IFC_TOOLS = ['summary', 'quantities', 'list', 'properties', 'entities', 'issues', 'validate', 'ids', 'clash', 'structure', 'psets', 'select', 'geometry'];
    const DXF_TOOLS = ['summary', 'quantities', 'entities'];

    /** @param {any} ctx shell context @param {{rerenderRight?: () => void}} [options] */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'summary', group1: 'typ', group2: '', source: 'file', category: 'byggdel', property: '', layer1: 'lager', layer2: '', issuesId: '', igroup1: 'topic_status', igroup2: 'element_typ', express: false, ifcClass: 'IfcElement', qtos: false, query: '', ids: null,
        clash: { typeA: '', other: '', typeB: '', mode: 'intersection', tolerance: 2, clearance: 50, busy: false, progress: '', error: '', result: null, resultFor: '', where: 'here' } };
      let fieldsEl = null; let resultEl = null; let seq = 0;
      /** @type {{id: string, list: any[]}|null} */ let names = null;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'model';
      const toolsFor = (ds) => (model.isDxf(ds) ? DXF_TOOLS : IFC_TOOLS);

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('ruler', 20), t('model.tool.title')));
        const tabs = /** @type {any} */ (h('dm-tabs'));
        const list = toolsFor(selected());
        const asked = store.get().openModelTool;
        if (asked) {
          store.set({ openModelTool: null });
          if (selected() && asked.datasetId === selected().id && list.includes(asked.tool)) s.tool = asked.tool;
        }
        if (!list.includes(s.tool)) s.tool = 'summary';
        tabs.tabs = list.map((id) => ({ id, label: t('model.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; renderFields(); run(); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); run();
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      const select = basic.select;
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
        } else if (s.tool === 'validate') {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('model.validate.express'), 'data-ifc-express': '' }));
          sw.checked = s.express;
          sw.addEventListener('change', () => { s.express = sw.checked; run(); });
          parts.push(h('div', { class: 'dm-row-wrap' }, sw, h('span', { class: 'dm-help', text: t('model.ifc.python.note') })));
        } else if (s.tool === 'ids') {
          // The IDS file stays in the browser: it is written into Python's file system when the check runs.
          const input = /** @type {any} */ (h('input', { type: 'file', accept: '.ids,.xml', hidden: '', 'data-ifc-ids-input': '' }));
          input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            s.ids = { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
            renderFields(); run();
          });
          parts.push(h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('model.ids.pick'), icon: 'folder-open', size: 'sm', 'data-ifc-ids-pick': '', onClick: () => input.click() }),
            h('span', { class: 'dm-help', text: s.ids ? t('model.ids.file', { name: s.ids.name }) : t('model.ids.none') }),
            s.ids ? ui.button({ label: t('model.ids.run'), icon: 'circle-check', size: 'sm', 'data-ifc-ids-run': '', onClick: () => run() }) : null,
            h('span', { class: 'dm-help', text: t('model.ifc.python.note') }), input));
        } else if (s.tool === 'clash') {
          parts.push(...clashFields(ds));
        } else if (s.tool === 'psets' || s.tool === 'geometry') {
          const classes = ['IfcElement', 'IfcProduct'].concat(((ds.model && ds.model.elementTypes) || []).map((x) => String(x.name))).filter((v, i, a) => a.indexOf(v) === i);
          if (!classes.includes(s.ifcClass)) s.ifcClass = 'IfcElement';
          const qtos = /** @type {any} */ (h('dm-switch', { label: t('model.psets.qtos') }));
          qtos.checked = s.qtos;
          qtos.addEventListener('change', () => { s.qtos = qtos.checked; run(); });
          parts.push(h('div', { class: 'dm-row-wrap' },
            select(t('model.psets.class'), classes.map((c) => ({ value: c, label: c })), s.ifcClass, (v) => { s.ifcClass = v; run(); }, { 'data-ifc-class': '' }),
            s.tool === 'psets' ? qtos : null, h('span', { class: 'dm-help', text: t('model.ifc.python.note') })));
        } else if (s.tool === 'select') {
          const input = /** @type {any} */ (h('dm-input', { label: t('model.select.query'), placeholder: t('model.select.placeholder'), mono: true, help: t('model.select.help'), 'data-ifc-query': '' }));
          input.value = s.query;
          input.addEventListener('keydown', (e) => { if (/** @type {any} */ (e).key === 'Enter') { s.query = input.value; run(); } });
          parts.push(h('div', { class: 'dm-row-wrap' }, input, ui.button({ label: t('model.select.run'), icon: 'search', size: 'sm', 'data-ifc-select': '', onClick: () => { s.query = input.value; run(); } })));
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
        // Clash detection is heavy, so it runs on the button, not on choosing the tool.
        if (s.tool === 'clash') { renderClash(ds); return; }
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
          } else if (analysis.IFC_TOOLS.includes(s.tool)) {
            // In Python with IfcOpenShell: the first time Python starts and the wheels are fetched after consent.
            if (s.tool === 'select' && !s.query.trim()) out = { columns: [], rows: [], note: t('model.select.empty') };
            else if (s.tool === 'ids' && !s.ids) out = { columns: [], rows: [], note: t('model.ids.empty') };
            else {
              const catalog = D.require('engines/python/catalog');
              replace(resultEl, h('dm-progress', { indeterminate: true, label: t('model.ifc.loading', { mb: Math.round((catalog.RUNTIME_SIZE + catalog.IFC_SIZE) / 1048576) }) }));
              let params = s.tool === 'validate' ? { express: s.express } : s.tool === 'psets' ? { ifc_class: s.ifcClass, qtos: s.qtos } : s.tool === 'geometry' ? { ifc_class: s.ifcClass } : s.tool === 'select' ? { query: s.query } : {};
              if (s.tool === 'ids') {
                const path = '/data/ids/' + s.ids.name.replace(/[^\w.-]+/g, '_');
                await D.require('data/python-bridge').bridge.writeFile(path, s.ids.bytes.slice());
                params = { ids: path };
              }
              out = await analysis.ifcTool(ds.id, s.tool, params);
              // The latest result shows on the card Validera modellen in Hantera; keeping it changes nothing in the dataset.
              if (s.tool === 'validate' || s.tool === 'ids') {
                const validation = D.require('data/ifc-validation');
                validation.record(ds.id, s.tool === 'ids' ? 'ids' : 'schema', validation.localResult(s.tool, out, { file: s.ids ? s.ids.name : '', express: s.express })).catch((err) => D.log('validation', err));
              }
              const sum = out.summary;
              out.note = s.tool === 'ids' && sum
                ? t('model.ids.note', { specs: i18n.formatNumber(sum.specifications || 0), checks: i18n.formatNumber(sum.checks || 0), pass: i18n.formatNumber(sum.checks_pass || 0), fail: i18n.formatNumber(sum.checks_fail || 0) })
                : t('model.ifc.note.' + s.tool, { n: i18n.formatNumber(out.total) });
            }
          }
          if (my !== seq || !resultEl) return;
          out.name = `${ds.name}: ${t('model.tool.' + s.tool)}`;
          showTable(out);
        } catch (err) {
          if (my !== seq || !resultEl) return;
          // A Python traceback ends with the line that matters; the whole text goes to the log.
          const text = String((err && err.message) || err).trim();
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: text.split('\n').pop() || text }));
          shell.log(text, 'error');
        }
      }
      // ---- clash detection ------------------------------------------------------------------------------------
      const typeOptions = (d) => [{ value: '', label: t('clash.set.all') }].concat(((d && d.model && d.model.elementTypes) || []).map((x) => ({ value: String(x.name), label: `${x.name} (${i18n.formatNumber(x.count || 0)})` })));
      /** A model from a CDE: the server can check it, with another version of the same project. */
      const onServer = (d) => { const cde = d && d.source && d.source.cde; return !!(cde && cde.connectorId && cde.projectId && cde.documentId && cde.versionIndex); };
      function clashFields(ds) {
        const c = s.clash;
        if (!onServer(ds)) c.where = 'here';
        const server = c.where === 'server';
        const sameProject = (d) => onServer(d) && d.source.cde.connectorId === ds.source.cde.connectorId && d.source.cde.projectId === ds.source.cde.projectId;
        const models = store.get().datasets.filter((d) => d.kind === 'model' && !model.isDxf(d) && d.id !== ds.id && (!server || sameProject(d)));
        if (c.other && !models.some((d) => d.id === c.other)) { c.other = ''; c.typeB = ''; }
        const other = c.other ? models.find((d) => d.id === c.other) : ds;
        const clearance = c.mode === 'clearance';
        const amount = /** @type {any} */ (h('dm-input', { type: 'number', min: '0', step: '1', label: t(clearance ? 'clash.clearance' : 'clash.tolerance'), help: t(clearance ? 'clash.clearance.help' : 'clash.tolerance.help'), 'data-clash-amount': '' }));
        amount.value = String(clearance ? c.clearance : c.tolerance);
        amount.addEventListener('change', () => { const v = Math.max(0, Number(amount.value) || 0); if (clearance) c.clearance = v; else c.tolerance = v; });
        return [
          h('div', { class: 'dm-row-wrap' },
            select(t('clash.set.a'), typeOptions(ds), c.typeA, (v) => { c.typeA = v; }, { 'data-clash-a': '' }),
            select(t('clash.against'), [{ value: '', label: t('clash.same') }].concat(models.map((d) => ({ value: d.id, label: d.name }))), c.other, (v) => { c.other = v; c.typeB = ''; renderFields(); }, { 'data-clash-model': '' }),
            select(t('clash.set.b'), typeOptions(other), c.typeB, (v) => { c.typeB = v; }, { 'data-clash-b': '' })),
          h('div', { class: 'dm-row-wrap' },
            onServer(ds) ? select(t('clash.where'), [{ value: 'here', label: t('clash.where.here') }, { value: 'server', label: t('clash.where.server', { host: ds.source.cde.host || '' }) }], c.where, (v) => { c.where = v; renderFields(); }, { 'data-clash-where': '', title: t('clash.where.hint') }) : null,
            select(t('clash.mode'), ['intersection', 'clearance'].map((m) => ({ value: m, label: t('clash.mode.' + m) })), c.mode, (v) => { c.mode = v; renderFields(); }, { 'data-clash-mode': '' }),
            amount,
            ui.button({ label: t('clash.run'), icon: 'scan-line', size: 'sm', loading: c.busy, title: t('clash.run.hint'), 'data-clash-run': '', onClick: () => runClash() })),
        ];
      }
      async function runClash() {
        const ds = selected();
        const c = s.clash;
        if (!usable(ds) || c.busy) return;
        const clash = D.require('analysis/clash');
        c.busy = true; c.error = ''; c.progress = t('clash.progress.start');
        renderFields(); renderClash(ds);
        if (c.where === 'server' && onServer(ds)) { await runServerClash(ds); return; }
        try {
          const result = await clash.run({
            a: { datasetId: ds.id, types: c.typeA ? [c.typeA] : null }, b: { datasetId: c.other || ds.id, types: c.typeB ? [c.typeB] : null },
            mode: c.mode, tolerance: c.tolerance / 1000, clearance: c.clearance / 1000,
          }, { onProgress: (p) => {
            c.progress = p.phase === 'geometry' ? t('clash.progress.geometry', { n: i18n.formatNumber(p.done) })
              : p.total ? t('clash.progress.pairs', { done: i18n.formatNumber(p.done), total: i18n.formatNumber(p.total) }) : t('clash.progress.start');
            const bar = resultEl && resultEl.querySelector('[data-clash-progress]');
            if (bar) bar.setAttribute('label', c.progress);
          } });
          c.result = result; c.resultFor = ds.id;
          D.require('data/ifc-validation').record(ds.id, 'clash', clash.summaryOf(result)).catch((err) => D.log('validation', err));
          shell.log(t('clash.done', { n: i18n.formatNumber(result.clashes.length), pairs: i18n.formatNumber(result.pairs), s: i18n.formatNumber(result.seconds) }), 'ok');
        } catch (err) {
          c.error = String((err && err.message) || err);
          shell.log(c.error, 'error');
        }
        c.busy = false;
        if (selected() && selected().id === ds.id) { renderFields(); renderClash(ds); }
      }
      /**
       * The same check on the server (Dataregium's ifc_clash): the two versions, the sets and the mode go there, the job is waited
       * for, and its report is shown as a check run here. Nothing is asked of the server before the user presses the button.
       */
      async function runServerClash(ds) {
        const c = s.clash;
        const cde = ds.source.cde;
        const other = c.other ? store.get().datasets.find((d) => d.id === c.other) : ds;
        const sideOf = (d, type) => Object.assign({ document_id: d.source.cde.documentId, version_index: Number(d.source.cde.versionIndex) }, type ? { types: [type] } : {});
        const opencde = D.require('api/families/opencde');
        try {
          const connector = await D.require('api/connectors').get(cde.connectorId);
          if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
          if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
          const report = await opencde.serverClash(connector, cde.projectId, {
            a: sideOf(ds, c.typeA), b: sideOf(other, c.typeB), mode: c.mode, tolerance: c.tolerance / 1000, clearance: Math.max(0.001, c.clearance / 1000),
          }, { onState: (job) => {
            c.progress = t('clash.server.state.' + (job && job.state === 'running' ? 'running' : 'queued'), { host: cde.host });
            const bar = resultEl && resultEl.querySelector('[data-clash-progress]');
            if (bar) bar.setAttribute('label', c.progress);
          } });
          if (report.state !== 'done') throw new Error(t('clash.server.failed', { reason: report.error || report.state || '' }));
          const models = [ds, other].map((d) => ({ datasetId: d.id, documentId: d.source.cde.documentId, versionIndex: Number(d.source.cde.versionIndex) }));
          c.result = D.require('analysis/clash').fromServer(report, models); c.resultFor = ds.id;
          D.require('data/ifc-validation').record(ds.id, 'clash', D.require('analysis/clash').summaryOf(c.result)).catch((err) => D.log('validation', err));
          shell.log(t('clash.server.done', { n: i18n.formatNumber(c.result.clashes.length), host: cde.host, s: i18n.formatNumber(c.result.seconds) }), 'ok');
        } catch (err) {
          c.error = String((err && err.message) || err);
          shell.log(c.error, 'error');
        }
        c.busy = false;
        if (selected() && selected().id === ds.id) { renderFields(); renderClash(ds); }
      }
      function clashColors() {
        const tk = D.require('viz/theme').tokens();
        const hex = (v) => String(v || '').replace(/^#/, '').toUpperCase();
        return { a: hex(tk.error), b: hex(tk.warn) };
      }
      function renderClash(ds) {
        if (!resultEl) return;
        const c = s.clash;
        if (c.busy) { replace(resultEl, h('dm-progress', { indeterminate: true, label: c.progress, 'data-clash-progress': '' })); return; }
        if (c.error) { replace(resultEl, h('p', { class: 'dm-error dm-small', text: c.error })); return; }
        const r = c.result && c.resultFor === ds.id ? c.result : null;
        if (!r) { replace(resultEl, h('p', { class: 'dm-help', text: t('clash.hint') })); return; }
        const clash = D.require('analysis/clash');
        const out = clash.tableOf(r);
        out.columns = out.columns.map((col) => Object.assign(col, { label: t('clash.col.' + col.name) }));
        out.rows = out.rows.map((row) => { const copy = row.slice(); copy[8] = t('clash.kind.' + row[8]); return copy; });
        out.name = `${ds.name}: ${t('model.tool.clash')}`;
        out.note = (r.server ? t('clash.server.note', { n: i18n.formatNumber(r.clashes.length), a: i18n.formatNumber(r.setA), b: i18n.formatNumber(r.setB), s: i18n.formatNumber(r.seconds), host: (ds.source && ds.source.cde && ds.source.cde.host) || '' }) + (r.truncated ? ' ' + t('clash.server.truncated') : '')
          : t('clash.note', { n: i18n.formatNumber(r.clashes.length), pairs: i18n.formatNumber(r.pairs), a: i18n.formatNumber(r.setA), b: i18n.formatNumber(r.setB), s: i18n.formatNumber(r.seconds) }))
          + (r.missing ? ' ' + t('clash.missing', { n: i18n.formatNumber(r.missing) }) : '');
        const cde = ds.source && ds.source.cde;
        const none = !r.clashes.length;
        replace(resultEl,
          h('div', { class: 'dm-row-wrap', 'data-clash-result': '' }, h('span', { class: 'dm-help dm-grow', text: out.note }),
            ui.button({ label: t('clash.mark'), icon: 'scan-line', size: 'sm', title: t('clash.mark.hint'), disabled: none, 'data-clash-mark': '', onClick: () => markClashes(ds, r) }),
            ui.button({ label: t('clash.bcf'), icon: 'download', size: 'sm', title: t('clash.bcf.hint'), disabled: none, 'data-clash-bcf': '', onClick: () => saveBcf(ds, r) }),
            cde && cde.connectorId && cde.projectId ? ui.button({ label: t('clash.send'), icon: 'upload', size: 'sm', title: t('clash.send.hint'), disabled: none, 'data-clash-send': '', onClick: () => sendTopics(ds, r) }) : null,
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: none, onClick: () => createDataset(out) })),
          h('div', { class: 'dm-table-wrap' }, (() => {
            const table = /** @type {any} */ (h('dm-table'));
            requestAnimationFrame(() => {
              if (!table.isConnected) return;
              table.setData({ columns: out.columns.map((col) => ({ key: col.name, label: col.label, type: col.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count) });
            });
            return table;
          })()));
      }
      async function markClashes(ds, r) {
        const where = D.require('analysis/clash').whereOf(r, ds.id);
        const made = where ? await D.require('data/selection').setFromWhere(ds.id, where, [], t('model.tool.clash')) : null;
        if (!made) { ui.toast.show(t('selection.none'), { kind: 'info' }); return; }
        ui.toast.show(t('selection.made', { n: i18n.formatNumber(made.rowids.length) }), { kind: 'ok' });
        store.set({ selectedId: ds.id });
        shell.activate('bearbeta');
      }
      async function saveBcf(ds, r) {
        try {
          const blob = await D.require('analysis/clash').bcfFile(r, { t, projectName: ds.name, colors: clashColors() });
          const name = `${ds.name.replace(/[\\/:*?"<>|]+/g, '_')} ${t('model.tool.clash').toLowerCase()}.bcfzip`;
          D.require('platform/files').download(blob, name);
          shell.log(t('clash.bcf.saved', { n: i18n.formatNumber(r.clashes.length), name }), 'ok');
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function sendTopics(ds, r) {
        const cde = ds.source.cde;
        const opencde = D.require('api/families/opencde');
        const clash = D.require('analysis/clash');
        try {
          const connector = await D.require('api/connectors').get(cde.connectorId);
          if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
          const ok = await ui.dialog.confirm(t('clash.send.confirm', { n: i18n.formatNumber(r.clashes.length), project: cde.projectName || cde.projectId, host: cde.host }), { okLabel: t('clash.send') });
          if (!ok) return;
          if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
          // The server's own report makes its topics itself, with a viewpoint each.
          if (r.server) {
            const made = await opencde.serverClashTopics(connector, cde.projectId, r.server.id, r.clashes.map((x) => x.index));
            const done = t('clash.send.done', { n: i18n.formatNumber(made.length), project: cde.projectName || cde.projectId });
            shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
            return;
          }
          const ext = (await opencde.extensions(connector, cde.projectId).catch(() => null)) || {};
          const pick = (list, wanted) => { const l = Array.isArray(list) ? list : []; return l.find((x) => wanted.test(String(x))) || l[0] || null; };
          const type = pick(ext.topic_type, /clash|kollision/i); const status = pick(ext.topic_status, /open|öppen/i);
          const colors = clashColors();
          let sent = 0;
          for (const c of r.clashes) {
            const text = clash.topicText(c, t);
            const body = { title: text.title, description: text.description };
            if (type) body.topic_type = type;
            if (status) body.topic_status = status;
            const topic = await opencde.createTopic(connector, cde.projectId, body);
            await opencde.createViewpoint(connector, cde.projectId, topic.guid, clash.viewpointOf(c, colors));
            sent++;
            if (sent % 5 === 0) shell.log(t('clash.send.progress', { done: i18n.formatNumber(sent), total: i18n.formatNumber(r.clashes.length) }), 'info');
          }
          const done = t('clash.send.done', { n: i18n.formatNumber(sent), project: cde.projectName || cde.projectId });
          shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
        } catch (err) {
          const msg = String((err && err.message) || err);
          shell.log(msg, 'error'); ui.toast.show(msg, { kind: 'error' });
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
          table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label && c.label !== c.name ? c.label : (i18n.has('model.col.' + c.name) ? t('model.col.' + c.name) : c.name), type: c.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count) });
        });
      }
      async function createDataset(out) {
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: out.name });
        if (!name) return;
        try {
          const label = (c) => (c.label && c.label !== c.name ? c.label : (i18n.has('model.col.' + c.name) ? t('model.col.' + c.name) : c.name));
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: label(c) })), rows: out.rows, description: out.note || '', source: { kind: 'derived' } });
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
