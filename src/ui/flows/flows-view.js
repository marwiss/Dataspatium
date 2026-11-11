// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Flows and watches in Hantera. Flöden: the saved flows with their last run, and an editor where steps are added and
 * filled in. Bevakningar: the datasets whose source can be read again, whether they are watched, and what has changed.
 * The logic lives in data/flows and data/watches; running a flow shows in the status bar and in the log. Steps that hold other
 * steps (if, each, repeat) show them indented under their branches, each with its own place to add a step.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/flows/flows-view', ['ui/base', 'ui/basic', 'data/flows', 'data/watches', 'data/lists', 'viz/charts', 'viz/dashboards', 'docgen/documents', 'platform/storage/idb', 'platform/files', 'data/conditions'], (base, basic, flows, watches, lists, charts, dashboards, documents, idb, files, conditions) => {
    const { h, t, i18n, replace } = base;

    /** @param {any} ctx shell context */
    function create(ctx) {
      const { ui, store, shell } = ctx;
      const s = { tab: 'flows', editing: null, selected: null, options: null, checking: false };
      let slots = null; let unsubFlows = null; let unsubWatches = null; let seq = 0;

      /** @param {{center: HTMLElement, right: HTMLElement}} target */
      function render(target) {
        slots = target;
        if (!unsubFlows) unsubFlows = flows.subscribe((type) => { if (slots && !s.editing && (type === 'saved' || type === 'deleted' || type === 'end')) draw(); });
        if (!unsubWatches) unsubWatches = watches.subscribe(() => { if (slots && s.tab === 'watches') draw(); });
        if (store.get().flowsTab) { s.tab = store.get().flowsTab; store.set({ flowsTab: null }); }
        draw();
      }
      function destroy() { seq++; slots = null; if (unsubFlows) { unsubFlows(); unsubFlows = null; } if (unsubWatches) { unsubWatches(); unsubWatches = null; } }

      async function draw() {
        if (!slots) return;
        const my = ++seq;
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = [{ id: 'flows', label: t('flows.tab.flows'), icon: 'play' }, { id: 'watches', label: t('flows.tab.watches'), icon: 'eye' }];
        tabs.active = s.tab;
        tabs.addEventListener('dm-change', (e) => { s.tab = /** @type {any} */ (e).detail.id; s.editing = null; draw(); });
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('play', 20), t('flows.title')));
        const body = s.tab === 'watches' ? await watchesBody() : (s.editing ? await editorBody() : await flowsBody());
        if (my !== seq || !slots) return;
        replace(slots.center, head, tabs, body);
        replace(slots.right, ...await inspector());
      }

      // ---- the list of flows ----------------------------------------------------------------------------------
      async function flowsBody() {
        const all = await flows.list();
        if (!all.length) {
          return h('dm-empty-state', { icon: 'play', heading: t('flows.empty'), text: t('flows.empty.hint') },
            ui.button({ label: t('flows.new'), icon: 'plus', variant: 'primary', onClick: () => edit(flows.blank()) }));
        }
        const running = flows.current();
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-row' }, h('span', { class: 'dm-grow' }), ui.button({ label: t('flows.new'), icon: 'plus', variant: 'primary', onClick: () => edit(flows.blank()) })),
          all.map((flow) => {
            const last = flow.lastRun;
            const lastText = last ? t(last.ok ? 'flows.last.ok' : (last.aborted ? 'flows.last.aborted' : 'flows.last.failed'), { when: i18n.formatDateTime(last.endedAt) }) : t('flows.last.never');
            const busy = !!running && running.id === flow.id;
            return h('div', { class: 'dm-card dm-stack-sm dm-flow-card', 'data-flow': flow.id },
              h('div', { class: 'dm-row-wrap' },
                h('strong', { class: 'dm-grow', text: flow.name }),
                flow.onStart ? h('dm-badge', { text: t('flows.onstart.badge') }) : null,
                busy ? ui.button({ label: t('flows.cancel'), icon: 'x', title: t('flows.cancel.hint'), onClick: () => flows.cancel() })
                  : ui.button({ label: t('flows.run'), icon: 'play', title: t('flows.run.hint'), disabled: !!running || !flow.steps.length, onClick: () => runFlow(flow) }),
                flows.hasOutput(flow.id) ? ui.button({ label: t('flows.fetch'), icon: 'download', title: t('flows.fetch.hint'), onClick: () => fetchOutput(flow.id) }) : null,
                ui.button({ label: t('flows.edit'), icon: 'pencil', title: t('flows.edit.hint'), onClick: () => edit(flow) }),
                ui.button({ label: t('flows.remove'), icon: 'trash-2', 'icon-only': true, variant: 'ghost', title: t('flows.remove.hint'), onClick: () => removeFlow(flow) })),
              flow.description ? h('p', { class: 'dm-help', text: flow.description }) : null,
              h('p', { class: 'dm-help dm-small', text: `${t('flows.steps.n', { n: flow.steps.length })} · ${flow.steps.map((x) => t('flows.step.' + x.type)).join(', ') || '–'}` }),
              ui.button({ label: lastText, variant: 'ghost', size: 'sm', title: t('flows.run.hint'), onClick: () => { s.selected = flow.id; draw(); } }));
          }));
      }
      async function runFlow(flow) {
        s.selected = flow.id;
        try {
          const p = flows.run(flow);
          draw();
          await p;
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function fetchOutput(id) {
        const out = await flows.output(id);
        if (out) files.download(out.blob, out.name);
      }
      async function removeFlow(flow) {
        const yes = await ui.dialog.confirm(t('flows.remove.confirm', { name: flow.name }), { title: t('flows.remove'), danger: true });
        if (yes) { await flows.remove(flow.id); if (s.selected === flow.id) s.selected = null; }
      }

      // ---- the editor -----------------------------------------------------------------------------------------
      function edit(flow) { s.editing = JSON.parse(JSON.stringify(flow)); s.options = null; draw(); }
      /** Everything the step fields can point at. */
      async function loadOptions() {
        if (s.options) return s.options;
        const datasetsList = store.get().datasets;
        const named = (x) => ({ value: x.id, label: x.name });
        const scripts = (await idb.listScripts()).filter((x) => x.language === 'r' || x.language === 'python').map((x) => ({ value: x.id, label: `${x.name} (${x.language === 'r' ? 'R' : 'Python'})` }));
        s.options = {
          dataset: datasetsList.map(named),
          refreshable: datasetsList.filter(watches.watchable).map(named),
          script: scripts,
          list: (await lists.list()).map(named),
          chart: (await charts.list()).map(named),
          dashboard: (await dashboards.list()).map(named),
          document: (await documents.list()).map(named),
        };
        return s.options;
      }
      const select = basic.select;
      function fieldOf(field, step) {
        const label = t('flows.field.' + (step.type === 'recipe' ? 'recipe.' : '') + field.name);
        const value = step.params[field.name];
        const set = (v) => { step.params[field.name] = v; };
        if (field.type === 'number') {
          const el = /** @type {any} */ (h('dm-input', { label, type: 'number', help: t('flows.field.' + field.name + '.help') }));
          el.value = value === undefined || value === null ? '' : String(value);
          el.addEventListener('input', () => { const n = Number(el.value); if (el.value === '' || !Number.isFinite(n)) delete step.params[field.name]; else set(n); });
          return el;
        }
        if (field.type === 'condition' || field.type === 'json') {
          const json = field.type === 'json';
          const el = /** @type {any} */ (h('dm-input', json ? { label, type: 'textarea', rows: '3', mono: '', help: t('flows.field.' + field.name + '.help') } : { label, mono: '', help: t('flows.field.' + field.name + '.help') }));
          el.value = value && typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '');
          // What does not read is told at once; the flow can still be saved and says so again when it runs.
          const verify = () => {
            const text = String(el.value || '').trim();
            let problem = '';
            if (text && json) { try { const v = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) problem = t('flows.err.args'); } catch (_e) { problem = t('flows.err.args'); } }
            else if (text) problem = conditions.check(text) || '';
            if (problem) el.setAttribute('error', problem); else el.removeAttribute('error');
          };
          el.addEventListener('input', () => { set(el.value); verify(); });
          verify();
          return el;
        }
        if (field.type === 'lines') {
          const el = /** @type {any} */ (h('dm-input', { label, type: 'textarea', rows: '4', help: t('flows.field.' + field.name + '.help') }));
          el.value = value || '';
          el.addEventListener('input', () => set(el.value));
          return el;
        }
        if (field.type === 'switch') {
          const el = /** @type {any} */ (h('dm-switch', { label }));
          el.checked = !!value;
          el.addEventListener('change', () => set(!!el.checked));
          return el;
        }
        if (field.type === 'command') return select(label, [{ value: '', label: '–' }].concat(D.require('data/commands').list().map((c) => ({ value: c.name, label: c.name }))), value || '', set);
        if (field.type === 'text') {
          const el = /** @type {any} */ (h('dm-input', { label, help: t('flows.field.' + field.name + '.help') }));
          el.value = value || '';
          el.addEventListener('input', () => set(el.value));
          return el;
        }
        if (field.type === 'select') return select(label, field.options.map((o) => ({ value: o, label: o.toUpperCase() })), value || field.options[0], set);
        const opts = s.options[field.type] || [];
        const first = field.optional && field.type === 'refreshable' ? [{ value: '', label: t('flows.field.datasetId.all') }] : [{ value: '', label: '–' }];
        return select(label, first.concat(opts), value, set);
      }
      async function editorBody() {
        await loadOptions();
        const flow = s.editing;
        const name = /** @type {any} */ (h('dm-input', { label: t('flows.name') }));
        name.value = flow.name;
        name.addEventListener('input', () => { flow.name = name.value; });
        const desc = /** @type {any} */ (h('dm-input', { label: t('flows.description') }));
        desc.value = flow.description;
        desc.addEventListener('input', () => { flow.description = desc.value; });
        const onStart = /** @type {any} */ (h('dm-switch', { label: t('flows.onstart') }));
        onStart.checked = !!flow.onStart;
        onStart.addEventListener('change', () => { flow.onStart = onStart.checked; });
        const goOn = /** @type {any} */ (h('dm-switch', { label: t('flows.continue') }));
        goOn.checked = !!flow.continueOnError;
        goOn.addEventListener('change', () => { flow.continueOnError = goOn.checked; });
        let addType = 'refresh';
        const add = select(t('flows.add.type'), flows.STEP_TYPES.map((x) => ({ value: x, label: t('flows.step.' + x) })), addType, (v) => { addType = v; });
        const steps = stepCards(flow.steps, 0);
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-card dm-stack-sm' }, name, desc, onStart, h('p', { class: 'dm-help dm-small', text: t('flows.onstart.help') }), goOn),
          steps.length ? h('div', { class: 'dm-stack-sm' }, steps) : h('p', { class: 'dm-help', text: t('flows.steps.none') }),
          h('div', { class: 'dm-row-wrap dm-flow-add' }, add, ui.button({ label: t('flows.add'), icon: 'plus', title: t('flows.add.hint'), onClick: () => { flow.steps.push({ type: addType, params: {} }); draw(); } })),
          h('div', { class: 'dm-row' },
            ui.button({ label: t('common.save'), icon: 'save', variant: 'primary', onClick: saveEditing }),
            ui.button({ label: t('common.cancel'), onClick: () => { s.editing = null; draw(); } })));
      }
      /** The cards of a list of steps; a step that holds others shows its branches indented, each with a place to add a step. */
      function stepCards(list, depth) {
        const flow = s.editing;
        void flow;
        return list.map((step, i) => {
          const def = flows.STEPS[step.type];
          const named = step.type !== 'if' && step.type !== 'stop';
          const idField = named ? /** @type {any} */ (h('dm-input', { label: t('flows.field.id'), help: t('flows.field.id.help') })) : null;
          if (idField) { idField.value = step.id || ''; idField.addEventListener('input', () => { const v = String(idField.value || '').trim(); if (v) step.id = v; else delete step.id; }); }
          const branches = (def.branches || []).map((b) => {
            if (!Array.isArray(step[b])) step[b] = [];
            return h('div', { class: 'dm-stack-sm dm-flow-branch', 'data-branch': b },
              h('p', { class: 'dm-small dm-flow-branch-title', text: t('flows.branch.' + (step.type === 'if' ? b : 'loop')) }),
              step[b].length ? stepCards(step[b], depth + 1) : h('p', { class: 'dm-help dm-small', text: t('flows.steps.none') }),
              addRow(step[b], 'dm-flow-add-in'));
          });
          return h('div', { class: 'dm-card dm-stack-sm dm-flow-step', 'data-depth': String(depth) },
            h('div', { class: 'dm-row' },
              ui.icon(def.icon, 16),
              h('strong', { class: 'dm-grow', text: `${i + 1}. ${t('flows.step.' + step.type)}` }),
              ui.button({ label: t('flows.step.up'), icon: 'arrow-up', 'icon-only': true, variant: 'ghost', size: 'sm', title: t('flows.step.up'), disabled: i === 0, onClick: () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); draw(); } }),
              ui.button({ label: t('flows.step.down'), icon: 'arrow-down', 'icon-only': true, variant: 'ghost', size: 'sm', title: t('flows.step.down'), disabled: i === list.length - 1, onClick: () => { list.splice(i + 1, 0, list.splice(i, 1)[0]); draw(); } }),
              ui.button({ label: t('flows.step.remove'), icon: 'trash-2', 'icon-only': true, variant: 'ghost', size: 'sm', title: t('flows.step.remove'), onClick: () => { list.splice(i, 1); draw(); } })),
            h('p', { class: 'dm-help dm-small', text: t('flows.step.' + step.type + '.hint') }),
            h('div', { class: 'dm-row-wrap' }, def.fields.map((f) => fieldOf(f, step)), idField),
            branches);
        });
      }
      /** The place to add a step inside a branch or a loop. */
      function addRow(list, cls) {
        let type = 'command';
        const pick = select(t('flows.add.type'), flows.STEP_TYPES.map((x) => ({ value: x, label: t('flows.step.' + x) })), type, (v) => { type = v; });
        return h('div', { class: 'dm-row-wrap ' + cls }, pick, ui.button({ label: t('flows.add.here'), icon: 'plus', size: 'sm', title: t('flows.add.hint'), onClick: () => { list.push({ type, params: {} }); draw(); } }));
      }
      async function saveEditing() {
        try {
          const saved = await flows.save(s.editing);
          s.selected = saved.id; s.editing = null;
          shell.log(t('flows.saved', { name: saved.name }), 'ok');
          draw();
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      // ---- watches --------------------------------------------------------------------------------------------
      async function watchesBody() {
        const all = store.get().datasets.filter(watches.watchable);
        const onStart = /** @type {any} */ (h('dm-switch', { label: t('watch.onstart') }));
        onStart.checked = await watches.checksOnStart();
        onStart.addEventListener('change', () => watches.setChecksOnStart(onStart.checked));
        if (!all.length) return h('dm-empty-state', { icon: 'eye', heading: t('watch.empty'), text: t('watch.empty.hint') });
        const rows = [];
        for (const ds of all) {
          const w = await watches.get(ds.id);
          const sw = /** @type {any} */ (h('dm-switch', { label: ds.name }));
          sw.checked = !!w;
          sw.addEventListener('change', async () => {
            try { await watches.setWatched(ds.id, sw.checked); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
            draw();
          });
          rows.push(h('div', { class: 'dm-card dm-stack-sm dm-watch', 'data-watch': ds.id },
            h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-grow' }, sw), w ? stateBadge(w) : null,
              w && w.state === 'new' ? ui.button({ label: t('watch.update'), icon: 'refresh-cw', title: t('watch.update.hint'), onClick: () => updateDataset(ds) }) : null),
            w && w.summary ? h('p', { class: 'dm-small', text: summaryText(w.summary) }) : null,
            w && w.error ? h('p', { class: 'dm-error dm-small', text: w.error }) : null,
            w && w.lastCheck ? h('p', { class: 'dm-help dm-small', text: t('watch.checked', { when: i18n.formatDateTime(w.lastCheck) }) }) : null));
        }
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-row-wrap' }, h('p', { class: 'dm-help dm-grow', text: t('watch.about') }),
            ui.button({ label: t('watch.check'), icon: 'refresh-cw', variant: 'primary', loading: s.checking, title: t('watch.check.hint'), onClick: checkNow })),
          h('div', { class: 'dm-card dm-stack-sm' }, onStart, h('p', { class: 'dm-help dm-small', text: t('watch.onstart.help') })),
          rows);
      }
      function stateBadge(w) {
        const kind = w.state === 'new' ? 'accent' : (w.state === 'error' ? 'error' : null);
        return h('dm-badge', { kind, text: t('watch.state.' + w.state) });
      }
      function summaryText(sum) {
        const parts = [t('watch.summary.rows', { before: i18n.formatNumber(sum.rowsBefore), now: i18n.formatNumber(sum.rowsNow) })];
        if (sum.added || sum.removed) parts.push(t('watch.summary.changed', { added: i18n.formatNumber(sum.added), removed: i18n.formatNumber(sum.removed) }));
        if (sum.columnsAdded && sum.columnsAdded.length) parts.push(t('watch.summary.columns.added', { names: sum.columnsAdded.join(', ') }));
        if (sum.columnsRemoved && sum.columnsRemoved.length) parts.push(t('watch.summary.columns.removed', { names: sum.columnsRemoved.join(', ') }));
        return parts.join(' · ');
      }
      async function checkNow() {
        s.checking = true; draw();
        try {
          const out = await watches.checkAll();
          const news = out.filter((w) => w.state === 'new').length;
          shell.log(t('watch.checked.log', { n: out.length, news }), news ? 'ok' : 'info');
        } finally { s.checking = false; draw(); }
      }
      async function updateDataset(ds) {
        try {
          const res = await watches.update(ds.id);
          shell.log(t('watch.updated', { name: ds.name, rows: i18n.formatNumber(res.rows) }), 'ok');
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        draw();
      }

      // ---- the inspector --------------------------------------------------------------------------------------
      async function inspector() {
        if (s.tab === 'watches') return [h('h4', { text: t('flows.tab.watches') }), h('p', { class: 'dm-help', text: t('watch.inspector') })];
        if (s.editing) return [h('h4', { text: t('flows.editing') }), h('p', { class: 'dm-help', text: t('flows.editing.hint') })];
        const flow = s.selected ? await flows.get(s.selected) : null;
        if (!flow) return [h('h4', { text: t('flows.tab.flows') }), h('p', { class: 'dm-help', text: t('flows.inspector') })];
        const parts = [h('h4', { text: flow.name })];
        const last = flow.lastRun;
        if (!last) { parts.push(h('p', { class: 'dm-help', text: t('flows.last.never') })); return parts; }
        parts.push(h('p', { class: 'dm-help', text: i18n.formatDateTime(last.endedAt) }));
        parts.push(h('ul', { class: 'dm-stack-sm dm-flow-log' }, last.steps.map((x) => h('li', { class: x.ok ? '' : 'dm-error' },
          h('strong', { text: (x.path ? x.path + ' ' : '') + t('flows.step.' + x.type) + ': ' }), h('span', { text: x.message })))));
        if (last.cut) parts.push(h('p', { class: 'dm-help dm-small', text: t('flows.log.cut', { n: i18n.formatNumber(last.cut) }) }));
        if (last.stopped) parts.push(h('p', { class: 'dm-help', text: last.stopped }));
        if (last.aborted) parts.push(h('p', { class: 'dm-help', text: t('flows.last.aborted.note') }));
        return parts;
      }
      return { render, destroy, state: s };
    }
    return { create };
  });
})();
