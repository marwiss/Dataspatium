// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * För in en byggnad från en annan modell (Dataregium's ifc_merge, F27 a): a building of model B comes into model A as the next
 * version of A's document, on the server. The dialog asks for B and its building, shows the server's report (what comes along,
 * the objects both have and which of them differ), takes a choice for each that differs, prepares B when its schema or length
 * unit is not A's, and starts the merge, which a manager of A's project may do. Nothing is asked of the server before the user
 * presses a button, and neither model changes.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/merge-dialog', ['ui/base', 'api/connectors', 'api/families/opencde', 'data/datasets', 'data/model'], (base, connectors, opencde, datasets, model) => {
    const { h, t, i18n, replace } = base;
    const CHOICES = ['a', 'b', 'new'];

    /** The models of the same server that can be B: converted versions from a CDE, other than A. */
    function candidates(store, ds) {
      const cde = ds.source.cde;
      return store.get().datasets.filter((d) => d.id !== ds.id && d.kind === 'model' && !model.isDxf(d) && d.source && d.source.cde
        && d.source.cde.connectorId === cde.connectorId && d.source.cde.documentId && d.source.cde.versionIndex);
    }
    /** The buildings of a model (IfcBuilding rows) as {guid, name}. */
    async function buildings(id) {
      const cols = await datasets.columns(id);
      const at = (n) => cols.findIndex((c) => c.name === n);
      if (at('typ') < 0 || at('guid') < 0) return [];
      const rows = await datasets.query(id, { where: { sql: '"typ" = ?', params: ['IfcBuilding'] }, limit: 200 });
      return rows.map((r) => ({ guid: String(r[at('guid')] || ''), name: at('namn') >= 0 && r[at('namn')] ? String(r[at('namn')]) : '' })).filter((b) => b.guid);
    }

    /**
     * Open the dialog for model A (a dataset from a CDE).
     * @param {any} ctx @param {any} ds @returns {Promise<void>}
     */
    async function open(ctx, ds) {
      const { ui, store, shell } = ctx;
      const cde = ds.source.cde;
      const state = { other: '', building: '', builds: [], report: null, choices: {}, def: '', prepared: null, busy: '', note: '', error: '', done: null };
      const body = h('div', { class: 'dm-stack', 'data-merge': '' });
      const connected = async () => {
        const connector = await connectors.get(cde.connectorId);
        if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
        if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
        return connector;
      };
      const otherDs = () => candidates(store, ds).find((d) => d.id === state.other) || null;
      const request = () => {
        const b = otherDs().source.cde;
        const other = { project_id: b.projectId, document_id: b.documentId, version_index: Number(b.versionIndex) };
        if (state.prepared) other.prepared = state.prepared.merge_id;
        const choices = {};
        for (const [guid, c] of Object.entries(state.choices)) if (c) choices[guid] = c;
        return Object.assign({ base: { document_id: cde.documentId, version_index: Number(cde.versionIndex) }, other, building: state.building, choices }, state.def ? { default: state.def } : {});
      };
      async function step(name, fn) {
        state.busy = name; state.error = ''; state.note = ''; draw();
        try { await fn(); } catch (err) {
          const status = err && err.status;
          state.error = status === 412 ? t('merge.err.latest') : String((err && (err.detail || err.message)) || err);
          if (status === 422) state.unprepared = true;
        }
        state.busy = ''; draw();
      }
      const pickOther = async (id) => {
        state.other = id; state.building = ''; state.builds = []; state.report = null; state.choices = {}; state.prepared = null; state.unprepared = false;
        if (id) state.builds = await buildings(id).catch(() => []);
        if (state.builds.length === 1) state.building = state.builds[0].guid;
        draw();
      };
      const report = () => step('report', async () => {
        state.unprepared = false;
        state.report = await opencde.mergeReport(await connected(), cde.projectId, request());
      });
      const prepare = () => step('prepare', async () => {
        const job = await opencde.prepareMerge(await connected(), cde.projectId, request(), { onState: (j) => { state.note = t('merge.state.' + (j && j.state === 'running' ? 'running' : 'queued')); draw(); } });
        if (!job || job.state !== 'done') throw new Error(t('merge.failed', { reason: (job && (job.error || job.state)) || '' }));
        state.prepared = job; state.unprepared = false;
        state.report = await opencde.mergeReport(await connected(), cde.projectId, request());
      });
      const run = () => step('merge', async () => {
        const b = otherDs();
        const building = state.builds.find((x) => x.guid === state.building);
        const ok = await ui.dialog.confirm(t('merge.confirm', { building: (building && building.name) || state.building, other: b.name, name: ds.name }), { okLabel: t('merge.run') });
        if (!ok) return;
        const job = await opencde.merge(await connected(), cde.projectId, request(), { onState: (j) => { state.note = t('merge.state.' + (j && j.state === 'running' ? 'running' : 'queued')); draw(); } });
        if (job.state === 'done') {
          state.done = job;
          const msg = t('merge.done', { version: String(job.version_index), name: ds.name });
          shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
        } else if (job.state === 'conflict') {
          const open = ((job.report && job.report.collisions) || []).filter((c) => !c.choice).map((c) => c.global_id);
          throw new Error(t('merge.conflict', { n: i18n.formatNumber(open.length), list: open.slice(0, 5).join(', ') }));
        } else throw new Error(t('merge.failed', { reason: job.error || job.state || '' }));
      });

      function reportPart() {
        const r = state.report;
        if (!r) return null;
        const collisions = Array.isArray(r.collisions) ? r.collisions : [];
        const differ = collisions.filter((c) => !c.same);
        const summary = h('p', { class: 'dm-small', 'data-merge-summary': '', text: t('merge.report.summary', { objects: i18n.formatNumber(r.objects || 0), instances: i18n.formatNumber(r.instances || 0), collisions: i18n.formatNumber(collisions.length), differ: i18n.formatNumber(differ.length), left: i18n.formatNumber((r.left_out || []).length) }) });
        const opts = [{ value: '', label: t('merge.choice.none') }].concat(CHOICES.map((c) => ({ value: c, label: t('merge.choice.' + c) })));
        const defSel = /** @type {any} */ (h('dm-select', { label: t('merge.default'), 'data-merge-default': '' }));
        defSel.options = opts; defSel.value = state.def;
        defSel.addEventListener('change', () => { state.def = defSel.value; });
        const rows = differ.slice(0, 50).map((c) => {
          const sel = /** @type {any} */ (h('dm-select', { 'aria-label': c.global_id, inline: true, 'data-merge-choice': c.global_id }));
          sel.options = opts; sel.value = state.choices[c.global_id] || '';
          sel.addEventListener('change', () => { state.choices[c.global_id] = sel.value; });
          return h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-mono dm-small dm-grow', text: `${c.ifc_class || ''} ${c.global_id}` }), sel);
        });
        return h('div', { class: 'dm-stack-sm', 'data-merge-report': '' }, summary, differ.length ? defSel : null, rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null,
          differ.length > 50 ? h('p', { class: 'dm-help dm-small', text: t('merge.more', { n: i18n.formatNumber(differ.length - 50) }) }) : null);
      }
      function draw() {
        const others = candidates(store, ds);
        const otherSel = /** @type {any} */ (h('dm-select', { label: t('merge.other'), 'data-merge-other': '' }));
        otherSel.options = [{ value: '', label: t('merge.other.pick') }].concat(others.map((d) => ({ value: d.id, label: d.name })));
        otherSel.value = state.other;
        otherSel.addEventListener('change', () => { pickOther(otherSel.value); });
        const buildSel = /** @type {any} */ (h('dm-select', { label: t('merge.building'), 'data-merge-building': '' }));
        buildSel.options = state.builds.map((b) => ({ value: b.guid, label: b.name ? `${b.name} (${b.guid})` : b.guid }));
        buildSel.value = state.building;
        buildSel.addEventListener('change', () => { state.building = buildSel.value; state.report = null; draw(); });
        const ready = !!(state.other && state.building);
        replace(body,
          h('p', { class: 'dm-help', text: t('merge.help') }),
          others.length ? h('div', { class: 'dm-form-grid' }, otherSel, state.other ? (state.builds.length ? buildSel : h('p', { class: 'dm-help dm-small', text: t('merge.building.none') })) : null)
            : h('p', { class: 'dm-help dm-small', text: t('merge.other.none') }),
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('merge.report'), icon: 'list-checks', size: 'sm', disabled: !ready || !!state.busy, loading: state.busy === 'report', title: t('merge.report.hint'), 'data-merge-show': '', onClick: report }),
            state.unprepared ? ui.button({ label: t('merge.prepare'), icon: 'refresh-cw', size: 'sm', disabled: !!state.busy, loading: state.busy === 'prepare', title: t('merge.prepare.hint'), 'data-merge-prepare': '', onClick: prepare }) : null,
            state.report && !state.done ? ui.button({ label: t('merge.run'), icon: 'circle-check', size: 'sm', variant: 'primary', disabled: !!state.busy, loading: state.busy === 'merge', title: t('merge.run.hint'), 'data-merge-run': '', onClick: run }) : null),
          state.prepared && state.prepared.expires_at ? h('p', { class: 'dm-help dm-small', text: t('merge.prepared', { date: i18n.formatDateTime(state.prepared.expires_at) }) }) : null,
          reportPart(),
          state.note && state.busy ? h('p', { class: 'dm-help dm-small', text: state.note }) : null,
          state.done ? h('p', { class: 'dm-small', 'data-merge-done': '', text: t('merge.done', { version: String(state.done.version_index), name: ds.name }) }) : null,
          state.error ? h('p', { class: 'dm-error dm-small', 'data-merge-error': '', text: state.error }) : null);
      }
      draw();
      await ui.dialog.open({ title: t('merge.title'), body, actions: [{ label: t('common.close'), value: null }], size: 'lg' });
    }

    return { open, candidates, buildings };
  });
})();
