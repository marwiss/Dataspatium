// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Two cards in Hantera: what the app sees in the dataset, each with its reason and a switch for when it is wrong, and how
 * the dataset is doing in its own terms. Both are drawn after the page, because they take a look at the data.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/insight-cards', ['ui/base', 'data/facets', 'data/kind-health'], (base, facets, health) => {
    const { h, t, i18n, replace } = base;

    /**
     * What the app sees. Shows nothing when it sees nothing.
     * @param {any} ctx @param {any} ds @param {{onChanged?: () => void}} [hooks] @returns {HTMLElement}
     */
    function facetCard(ctx, ds, hooks = {}) {
      const el = h('div');
      const draw = async () => {
        const list = await facets.detect(ds.id);
        if (!list.length) { replace(el); return; }
        const rows = list.map((f) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('facets.' + f.id), 'data-facet': f.id }));
          sw.checked = f.on;
          sw.addEventListener('change', async () => {
            // Back to what the app itself found when the user agrees with it; otherwise the user's word is kept.
            await facets.set(ds.id, f.id, sw.checked === f.auto ? null : sw.checked);
            await draw();
            if (hooks.onChanged) hooks.onChanged();
          });
          const why = f.reason ? t(f.reason, f.params || {}) : t('facets.reason.user');
          return h('div', { class: 'dm-stack-xs' }, sw, h('p', { class: 'dm-help dm-small', text: why }),
            f.on && f.id === 'network' ? h('div', null, ctx.ui.button({ label: t('graph.from.button'), icon: 'share-2', size: 'sm', title: t('graph.from.button.hint'), onClick: () => D.require('ui/analysis/graph-panel').fromTablesDialog(ctx, ds.id).then((meta) => { if (meta) { ctx.store.set({ selectedId: meta.id }); ctx.shell.activate('hantera'); } }) })) : null);
        });
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'facets' }, h('h3', { text: t('facets.title') }), h('p', { class: 'dm-help', text: t('facets.help') }), rows));
      };
      draw().catch((err) => D.log('facets', err));
      return el;
    }

    /**
     * How the dataset is doing. Shows nothing when there is nothing to say, since a green tick would be a promise.
     * @param {any} ds @returns {HTMLElement}
     */
    function healthCard(ds) {
      const el = h('div');
      health.check(ds.id).then((found) => {
        if (!found.length) return;
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'health' }, h('h3', { text: t('health.title') }),
          h('ul', { class: 'dm-stack-xs' }, found.map((f) => h('li', { class: f.level === 'warn' ? 'dm-warn' : 'dm-help', 'data-health': f.key, text: t(f.key, { n: i18n.formatNumber(f.n) }) })))));
      }).catch((err) => D.log('health', err));
      return el;
    }

    /**
     * Columns that hold a list the app knows, with the labels one click away.
     * @param {any} ctx @param {any} ds @param {{onChanged?: () => void}} [hooks] @returns {HTMLElement}
     */
    function codeListCard(ctx, ds, hooks = {}) {
      const el = h('div');
      const codelists = D.require('data/codelists');
      const draw = async () => {
        const found = await codelists.suggest(ds.id);
        if (!found.length) { replace(el); return; }
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'codelists' }, h('h3', { text: t('codelists.title') }), h('p', { class: 'dm-help', text: t('codelists.help') }),
          found.map((f) => h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-grow', text: t('codelists.found', { column: f.column, list: f.name, share: i18n.formatNumber(f.coverage, { style: 'percent', maximumFractionDigits: 0 }) }) }),
            ctx.ui.button({ label: t('codelists.apply'), icon: 'tags', size: 'sm', title: t('codelists.apply.hint'), onClick: async () => {
              try {
                await codelists.apply(ds.id, f.column, f.list);
                ctx.shell.log(t('codelists.applied', { column: f.column, list: f.name }), 'ok');
                await draw();
                if (hooks.onChanged) hooks.onChanged();
              } catch (err) { ctx.ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
            } })))));
      };
      draw().catch((err) => D.log('codelists', err));
      return el;
    }

    /**
     * Where a file from a CDE came from, whether the server has a newer version, and the way to the model's issues.
     * @param {any} ctx @param {any} ds @returns {HTMLElement|null}
     */
    function cdeCard(ctx, ds) {
      const cde = ds.source && ds.source.cde;
      if (!cde) return null;
      const { ui, store, shell } = ctx;
      const opencde = D.require('api/families/opencde');
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'cde' });
      const state = { checking: false, result: null, error: '', fetching: false, pub: null, pubBusy: '' };
      const connectorOf = async () => (await D.require('api/connectors').get(cde.connectorId)) || null;
      async function check() {
        state.checking = true; state.error = ''; state.result = null; draw();
        try {
          const connector = await connectorOf();
          if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
          if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
          state.result = await opencde.newerVersion(connector, ds);
        } catch (err) { state.error = String((err && err.message) || err); }
        state.checking = false; draw();
      }
      async function fetchNew() {
        const v = state.result && state.result.version;
        if (!v) return;
        state.fetching = true; draw();
        try {
          const connector = await connectorOf();
          const entry = { filename: (v.file_description && v.file_description.name) || v.title || cde.reference.split('/').pop(), reference: v.links && v.links.document_version_download ? v.links.document_version_download.url : cde.reference, documentId: v.document_id, versionIndex: Number(v.version_index), ifcProject: cde.ifcProject, source: 'Documents API' };
          const meta = await opencde.importFile(connector, { project_id: cde.projectId, name: cde.projectName }, entry, { name: `${ds.name} (v${v.version_number || v.version_index})` });
          shell.log(t('cde.fetched.version', { name: meta.name }), 'ok');
          ui.toast.show(t('cde.fetched.version', { name: meta.name }), { kind: 'ok' });
          store.set({ selectedId: meta.id });
        } catch (err) { state.error = String((err && err.message) || err); }
        state.fetching = false; draw();
      }
      async function connected() {
        const connector = await connectorOf();
        if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
        if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
        return connector;
      }
      async function pubStep(name, fn) {
        state.pubBusy = name; state.error = ''; draw();
        try { await fn(); } catch (err) { state.error = String((err && err.message) || err); }
        state.pubBusy = ''; draw();
      }
      // Publicering (Dataregium's publication): the status for every member; publishing for a manager, once, after a confirmation.
      const loadPublication = () => pubStep('load', async () => {
        const connector = await connected();
        if (!(await opencde.canPublish(connector))) { state.pub = { unsupported: true }; return; }
        state.pub = (await opencde.publication(connector, cde.documentId, cde.versionIndex)) || { none: true };
      });
      const doPublish = () => pubStep('publish', async () => {
        const ok = await ui.dialog.confirm(t('cde.publication.confirm', { name: ds.name, version: String(cde.versionIndex), host: cde.host }), { okLabel: t('cde.publication.publish') });
        if (!ok) return;
        state.pub = await opencde.publish(await connected(), cde.documentId, cde.versionIndex);
        const done = t('cde.publication.done', { name: ds.name, date: i18n.formatDateTime(state.pub.published_at) });
        shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
      });
      const saveArchive = () => pubStep('download', async () => {
        const file = await opencde.publicationFile(await connected(), cde.documentId, cde.versionIndex, state.pub.file_name);
        D.require('platform/files').download(file, file.name);
      });
      function publicationPart() {
        if (!cde.documentId || !cde.versionIndex) return null;
        const p = state.pub;
        if (!p) return h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('cde.publication'), icon: 'circle-check', size: 'sm', loading: state.pubBusy === 'load', title: t('cde.publication.hint'), 'data-cde-publication': '', onClick: loadPublication }));
        if (p.unsupported) return h('p', { class: 'dm-help dm-small', text: t('cde.publication.unsupported') });
        if (p.none) return h('div', { class: 'dm-row-wrap', 'data-cde-unpublished': '' }, h('span', { class: 'dm-help dm-small', text: t('cde.publication.none') }),
          ui.button({ label: t('cde.publication.publish'), icon: 'circle-check', size: 'sm', loading: state.pubBusy === 'publish', title: t('cde.publication.publish.hint'), 'data-cde-publish': '', onClick: doPublish }));
        return h('div', { class: 'dm-stack-xs', 'data-cde-published': '' },
          h('span', { class: 'dm-small', text: t('cde.publication.status', { date: i18n.formatDateTime(p.published_at), user: p.published_by || '', file: p.file_name || '' }) }),
          p.sha256 ? h('span', { class: 'dm-help dm-small dm-mono', text: 'SHA-256 ' + p.sha256 }) : null,
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('cde.publication.download'), icon: 'download', size: 'sm', loading: state.pubBusy === 'download', title: t('cde.publication.download.hint'), 'data-cde-archive': '', onClick: saveArchive })));
      }
      function draw() {
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('cde.server'), value: cde.host || '' },
          cde.projectName ? { label: t('opencde.project'), value: cde.projectName } : null,
          cde.modelName ? { label: t('cde.model'), value: cde.modelName } : null,
          { label: t('common.type'), value: t(cde.kind === 'document' ? 'cde.kind.document' : cde.kind === 'issues' ? 'cde.kind.issues' : 'cde.kind.bcf') },
          cde.versionIndex ? { label: t('cde.version'), value: String(cde.versionIndex) } : null,
          cde.fetchedAt ? { label: t('cde.fetched'), value: i18n.formatDateTime(cde.fetchedAt) } : null,
        ].filter(Boolean);
        const r = state.result;
        replace(el,
          h('h3', { text: t('cde.title') }),
          kv,
          h('div', { class: 'dm-row-wrap' },
            cde.documentId ? ui.button({ label: t('cde.check'), icon: 'refresh-cw', size: 'sm', loading: state.checking, title: t('cde.check.hint'), 'data-cde-check': '', onClick: check }) : null,
            ds.kind === 'model' && cde.documentId && !D.require('data/model').isDxf(ds) ? ui.button({ label: t('merge.button'), icon: 'layers', size: 'sm', title: t('merge.button.hint'), 'data-cde-merge': '', onClick: () => D.require('ui/api/merge-dialog').open(ctx, ds).catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) }) : null,
            ds.kind === 'model' ? ui.button({ label: t('issues.title'), icon: 'message-square', size: 'sm', title: t('cde.issues.hint'), onClick: () => { store.set({ selectedId: ds.id, openModelIssues: { datasetId: ds.id } }); ctx.shell.activate('bearbeta'); } }) : null,
            ds.kind === 'model' && !D.require('data/model').isDxf(ds) ? ui.button({ label: t('ifcgraph.title'), icon: 'network', size: 'sm', title: t('ifcgraph.open.hint'), 'data-cde-graph': '', onClick: async () => { if (!(await D.require('api/graph-source').open(ctx, ds))) ui.toast.show(t('cde.err.noconnector', { host: cde.host }), { kind: 'warn' }); } }) : null),
          r && r.newer ? h('div', { class: 'dm-row-wrap', 'data-cde-newer': '' }, h('span', { class: 'dm-warn', text: t('cde.newer', { have: String(r.have), latest: String(r.version.version_index) }) }), ui.button({ label: t('cde.fetch.version', { n: String(r.version.version_number || r.version.version_index) }), icon: 'download', size: 'sm', variant: 'primary', loading: state.fetching, onClick: fetchNew })) : null,
          r && !r.newer && r.version ? h('p', { class: 'dm-help dm-small', 'data-cde-current': '', text: t('cde.current') }) : null,
          publicationPart(),
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null);
      }
      draw();
      return el;
    }

    /**
     * The files a search result points at (Lantmäteriet's STAC with a key): fetch the vector files and read them in as datasets,
     * or save the others on the computer. Shows nothing for datasets from other sources.
     * @param {any} ctx @param {any} ds @returns {HTMLElement}
     */
    function filesCard(ctx, ds) {
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'files', hidden: true });
      const files = D.require('api/files');
      const state = { found: null, busy: '', progress: '', message: '', error: '' };
      async function run(save) {
        const found = state.found;
        const list = found.files.filter((f) => (save ? !f.importable : f.importable));
        state.busy = save ? 'save' : 'import'; state.message = ''; state.error = ''; draw();
        try {
          const res = await files.fetchAll(found.connector, list, { save, onProgress: (p) => { state.progress = t('files.progress', { i: p.i, n: p.n, name: p.name }); draw(); } });
          state.message = save ? t('files.saved', { n: res.saved }) : t('files.done', { n: res.datasets.length });
          if (res.errors.length) state.error = t('files.err.some', { n: res.errors.length, message: res.errors[0] });
          ctx.shell.log(state.message, res.errors.length ? 'warn' : 'ok');
          if (res.datasets.length) ctx.store.set({ selectedId: res.datasets[res.datasets.length - 1].id });
        } catch (err) { state.error = String((err && err.message) || err); }
        state.busy = ''; state.progress = ''; draw();
      }
      function draw() {
        const found = state.found;
        if (!found || !found.files.length) { el.hidden = true; return; }
        el.hidden = false;
        const importable = found.files.filter((f) => f.importable).length;
        const others = found.files.length - importable;
        replace(el,
          h('h3', { text: t('files.title') }),
          h('p', { class: 'dm-help dm-small', text: t('files.count', { n: found.files.length, importable }) }),
          found.files.length > files.MAX_FILES ? h('p', { class: 'dm-help dm-small', text: t('files.more', { max: files.MAX_FILES }) }) : null,
          h('div', { class: 'dm-row-wrap' },
            importable ? ctx.ui.button({ label: t('files.import', { n: Math.min(importable, files.MAX_FILES) }), icon: 'download', size: 'sm', title: t('files.import.hint'), loading: state.busy === 'import', disabled: !!state.busy, 'data-files-import': '', onClick: () => run(false) }) : null,
            others ? ctx.ui.button({ label: t('files.save', { n: Math.min(others, files.MAX_FILES) }), icon: 'save', size: 'sm', title: t('files.save.hint'), loading: state.busy === 'save', disabled: !!state.busy, 'data-files-save': '', onClick: () => run(true) }) : null),
          state.progress ? h('p', { class: 'dm-help dm-small', text: state.progress }) : null,
          state.message ? h('p', { class: 'dm-help dm-small', 'data-files-message': '', text: state.message }) : null,
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null);
      }
      files.of(ds).then((found) => { state.found = found; draw(); }, (err) => D.log('files', 'could not list the files', err));
      return el;
    }

    /**
     * Issues from a CDE: how they stand, the board Ärendeläge, and the model they point at. Shows nothing for other tables.
     * @param {any} ctx @param {any} ds @returns {HTMLElement|null}
     */
    function bcfCard(ctx, ds) {
      if (!ds || ds.kind !== 'table') return null;
      const { ui, store, shell } = ctx;
      const issues = D.require('data/issues');
      const el = h('div');
      const state = { busy: false, error: '' };
      const badge = (status) => { const k = D.require('ui/bearbeta/model-issues').badgeKind(status); return k ? { kind: k } : {}; };
      async function draw() {
        if (!(await facets.has(ds.id, 'bcf'))) { replace(el); return; }
        const datasets = D.require('data/datasets');
        const res = await (await datasets.ensureOpen(ds.id)).engine.exec('select topic_status, count(distinct guid) from data group by topic_status order by 2 desc');
        const counts = (res[0] ? res[0].values : []).map((r) => ({ status: r[0], n: Number(r[1]) }));
        const total = counts.reduce((a, c) => a + c.n, 0);
        const open = counts.filter((c) => issues.rank(c.status) < 2).reduce((a, c) => a + c.n, 0);
        const cde = ds.source && ds.source.cde;
        const modelId = cde && cde.modelId && store.get().datasets.some((d) => d.id === cde.modelId) ? cde.modelId : null;
        replace(el, h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'bcf' }, h('h3', { text: t('bcf.card.title') }),
          h('p', { class: 'dm-help', text: t('bcf.card.summary', { n: i18n.formatNumber(total), open: i18n.formatNumber(open) }) }),
          h('div', { class: 'dm-row-wrap' }, counts.slice(0, 8).map((c) => h('dm-badge', Object.assign({ text: `${c.status || t('issues.status.none')} · ${i18n.formatNumber(c.n)}` }, badge(c.status))))),
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('bcf.card.board'), icon: 'layout-grid', size: 'sm', variant: 'primary', loading: state.busy, title: t('bcf.card.board.hint'), 'data-bcf-board': '', onClick: board }),
            modelId ? ui.button({ label: t('bcf.card.model'), icon: 'box', size: 'sm', title: t('bcf.card.model.hint'), 'data-bcf-model': '', onClick: () => { store.set({ selectedId: modelId, openModelIssues: { datasetId: modelId } }); shell.activate('bearbeta'); } }) : null),
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null));
      }
      async function board() {
        state.busy = true; state.error = ''; await draw();
        try {
          const dash = await D.require('viz/suggest').issueBoard(ds);
          shell.log(t('bcf.card.board.done', { name: dash.name }), 'ok');
          store.set({ openDashboardId: dash.id });
          shell.activate('visualisera');
        } catch (err) { state.error = String((err && err.message) || err); }
        state.busy = false; await draw();
      }
      draw().catch((err) => D.log('bcf', err));
      return el;
    }

    /**
     * Validera modellen: the server's check of the file (for a version from a CDE) and the checks run here, each with its
     * latest result. The server is asked only when the user presses the button, and the report on a second press.
     * @param {any} ctx @param {any} ds @returns {HTMLElement|null} null for anything but an IFC model
     */
    function validationCard(ctx, ds) {
      if (!ds || ds.kind !== 'model' || D.require('data/model').isDxf(ds)) return null;
      const { ui, store, shell } = ctx;
      const validation = D.require('data/ifc-validation');
      const cde = ds.source && ds.source.cde;
      const onServer = !!(cde && cde.documentId && cde.versionIndex);
      const SHOWN = 5;
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'validation' });
      const state = { results: /** @type {any} */ ({}), busy: '', error: '', report: null, rule: '' };
      const when = (iso) => (iso ? i18n.formatDateTime(iso) : '');
      async function signedIn() {
        const connector = (await D.require('api/connectors').get(cde.connectorId)) || null;
        if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
        const opencde = D.require('api/families/opencde');
        if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
        return connector;
      }
      async function step(name, fn) {
        state.busy = name; state.error = ''; draw();
        try { await fn(); } catch (err) { state.error = String((err && err.message) || err); }
        state.busy = ''; draw();
      }
      const fetchServer = () => step('fetch', async () => {
        state.report = null;
        const entries = await D.require('api/families/opencde').versionMetadata(await signedIn(), cde.documentId, cde.versionIndex);
        state.results = await validation.record(ds.id, 'server', validation.fromMetadata(entries) || { status: null });
      });
      const fetchReport = () => step('report', async () => {
        state.report = await D.require('api/families/opencde').validationReport(await signedIn(), cde.documentId, cde.versionIndex);
        if (!state.report) throw new Error(t('validation.status.none'));
      });
      async function mark() {
        // One of the server's rules at a time, when chosen (F41 a): the elements that rule hits.
        const report = state.rule && state.report ? Object.assign({}, state.report, { issues: (state.report.issues || []).filter((i) => String(i.rule || '') === state.rule) }) : state.report;
        const where = validation.whereOf(report);
        const made = where ? await D.require('data/selection').setFromWhere(ds.id, where, [], t('validation.title')) : null;
        if (!made || !made.rowids.length) { ui.toast.show(t('validation.mark.none'), { kind: 'info' }); return; }
        ui.toast.show(t('selection.made', { n: i18n.formatNumber(made.rowids.length) }), { kind: 'ok' });
        store.set({ selectedId: ds.id });
        shell.activate('bearbeta');
      }
      const saveTable = () => step('table', async () => {
        const table = validation.tableOf(state.report);
        const ruleset = (state.report && state.report.ruleset) || (state.results.server && state.results.server.ruleset) || '';
        const meta = await D.require('data/datasets').create({
          name: t('validation.table.name', { model: ds.name }),
          description: t('validation.table.description', { model: ds.name, host: cde.host, ruleset }),
          columns: table.columns.map((c) => Object.assign({ label: t('validation.col.' + c.name) }, c)),
          rows: table.rows,
          source: { kind: 'derived', cde: Object.assign({}, cde, { kind: 'validation', modelId: ds.id, fetchedAt: new Date().toISOString() }) },
        });
        const done = t('validation.table.saved', { n: i18n.formatNumber(table.rows.length), name: meta.name });
        shell.log(done, 'ok');
        ui.toast.show(done, { kind: 'ok', action: { label: t('import.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
      });
      const openTool = (tool) => { store.set({ selectedId: ds.id, openModelTool: { datasetId: ds.id, tool } }); shell.activate('analysera'); };
      // What the server's check graph finds out of reach can be proposed for removal: a topic whose change set is tried and
      // approved like any other, so this version keeps the instances.
      const unreachable = () => step('unreachable', async () => {
        const connector = await signedIn();
        const ok = await ui.dialog.confirm(t('validation.unreachable.confirm', { name: ds.name, version: String(cde.versionIndex) }), { okLabel: t('validation.unreachable') });
        if (!ok) return;
        let res = null;
        try { res = await D.require('api/families/opencde').proposeUnreachable(connector, cde.projectId, cde.documentId, cde.versionIndex); }
        catch (err) { if (err && err.status === 409) { ui.toast.show(t('validation.unreachable.nothing'), { kind: 'info' }); return; } throw err; }
        if (!res) throw new Error(t('validation.unreachable.unsupported'));
        const done = t('validation.unreachable.done', { n: i18n.formatNumber(res.changes || 0), title: res.title || res.topic_guid });
        shell.log(done, 'ok');
        ui.toast.show(done, { kind: 'ok', action: { label: t('issues.title'), onClick: () => { store.set({ selectedId: ds.id, openModelIssues: { datasetId: ds.id } }); shell.activate('bearbeta'); } } });
      });
      const reachCheck = (report) => validation.checksOf(report).some((c) => c.name === 'graph' && c.findings > 0);
      /** The rules the report names, with counts, to mark one at a time; nothing when the report names none. */
      function ruleSelect(issues) {
        const counts = new Map();
        for (const i of issues) { const r = String(i.rule || ''); if (r) counts.set(r, (counts.get(r) || 0) + 1); }
        if (!counts.size) return null;
        const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('validation.rule'), inline: true, 'data-validation-rule': '' }));
        sel.options = [{ value: '', label: t('validation.rule.all') }].concat(Array.from(counts, ([r, n]) => ({ value: r, label: `${r} · ${i18n.formatNumber(n)}` })));
        sel.value = counts.has(state.rule) ? state.rule : '';
        sel.addEventListener('change', () => { state.rule = sel.value; });
        return sel;
      }

      function serverPart() {
        const server = state.results.server;
        const status = server ? server.status : undefined;
        const said = !server ? t('validation.server.never') : !status ? t('validation.status.none')
          : status === 'issues' || status === 'warnings' ? t('validation.status.' + status, { n: i18n.formatNumber(server.issues || 0) }) : t('validation.status.' + status);
        const kind = status ? validation.badgeKind(status) : '';
        const report = state.report;
        const issues = report && Array.isArray(report.issues) ? report.issues : [];
        const counted = report ? validation.counts(report) : null;
        const checks = report ? validation.checksOf(report) : [];
        const checkLabel = (name) => (i18n.has('validation.check.' + name) ? t('validation.check.' + name) : name);
        const checkLine = (c) => `${checkLabel(c.name)}: ${c.state === 'failed' ? t('validation.check.failed', { ruleset: c.ruleset || c.name }) : t('validation.check.result', { n: i18n.formatNumber(c.findings) })}`
          + (c.notRun.length ? ' ' + t('validation.not_run', { rules: c.notRun.join(', ') }) : '');
        // The check against the project's IDS documents: the verdicts counted, and the specifications that failed by name.
        const specsOf = (c) => {
          if (!c.specifications) return null;
          const s = validation.specsSummary(c);
          const failed = c.specifications.filter((x) => x.status === 'failed');
          return h('div', { class: 'dm-stack-xs', 'data-validation-ids-specs': '' },
            h('span', { class: 'dm-help dm-small', text: t('validation.ids.summary', { n: i18n.formatNumber(s.total), docs: i18n.formatNumber(s.documents), passed: i18n.formatNumber(s.passed), failed: i18n.formatNumber(s.failed), na: i18n.formatNumber(s.notApplicable) }) }),
            failed.length ? h('ul', { class: 'dm-stack-xs' }, failed.map((x) => h('li', { class: 'dm-small', 'data-validation-spec': x.identifier || x.name, text: t('validation.ids.spec', { name: x.identifier ? `${x.identifier} ${x.name}` : x.name, document: x.document, n: i18n.formatNumber(x.issues) }) }))) : null);
        };
        return [
          h('h4', { text: t('validation.server') }),
          h('div', { class: 'dm-row-wrap' }, h('dm-badge', Object.assign({ text: said, 'data-validation-status': status || '' }, kind ? { kind } : {})),
            server && server.at ? h('span', { class: 'dm-help dm-small', text: t('validation.fetched', { date: when(server.at) }) }) : null),
          server && server.checkedAt ? h('p', { class: 'dm-help dm-small', text: t('validation.checked', { date: when(server.checkedAt), ruleset: server.ruleset || '' }) }) : null,
          status === 'pending' ? h('p', { class: 'dm-help dm-small', text: t('validation.pending.hint') }) : null,
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('validation.fetch'), icon: 'refresh-cw', size: 'sm', loading: state.busy === 'fetch', title: t('validation.fetch.hint'), 'data-validation-fetch': '', onClick: fetchServer }),
            status === 'issues' ? ui.button({ label: t('validation.report'), icon: 'file-text', size: 'sm', loading: state.busy === 'report', title: t('validation.report.hint'), 'data-validation-report': '', onClick: fetchReport }) : null),
          report ? h('div', { class: 'dm-stack-xs', 'data-validation-issues': '' },
            h('p', { class: 'dm-help dm-small', 'data-validation-counts': '', text: t('validation.report.counts', { n: i18n.formatNumber(counted.findings), errors: i18n.formatNumber(counted.errors) }) }),
            checks.length ? h('ul', { class: 'dm-stack-xs', 'data-validation-checks': '' }, checks.map((c) => h('li', { class: 'dm-small' }, h('span', { text: checkLine(c) }), specsOf(c)))) : null,
            h('div', { class: 'dm-row-wrap' }, validation.byKind(report).map((k) => h('dm-badge', { text: `${i18n.has('validation.kind.' + k.kind) ? t('validation.kind.' + k.kind) : k.kind} · ${i18n.formatNumber(k.n)}` }))),
            h('ul', { class: 'dm-stack-xs' }, issues.slice(0, SHOWN).map((i) => {
              const line = validation.lineOf(i);
              return h('li', { class: 'dm-small', 'data-validation-issue': '' }, h('span', { class: 'dm-mono', text: [line.instance, line.cls, i.rule, i.global_id].filter(Boolean).join(' · ') }), h('br'), h('span', { text: line.text }));
            })),
            report.truncated || Number(report.issue_count) > issues.length ? h('p', { class: 'dm-help dm-small', text: t('validation.report.truncated', { listed: i18n.formatNumber(issues.length), n: i18n.formatNumber(Number(report.issue_count) || issues.length) }) })
              : issues.length > SHOWN ? h('p', { class: 'dm-help dm-small', text: t('validation.report.shown', { shown: i18n.formatNumber(SHOWN), n: i18n.formatNumber(issues.length) }) }) : null,
            h('div', { class: 'dm-row-wrap' },
              ruleSelect(issues),
              ui.button({ label: t('validation.mark'), icon: 'scan-line', size: 'sm', title: t('validation.mark.hint'), 'data-validation-mark': '', disabled: !issues.length, onClick: () => mark().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) }),
              ui.button({ label: t('validation.table'), icon: 'table', size: 'sm', loading: state.busy === 'table', title: t('validation.table.hint'), 'data-validation-table': '', disabled: !issues.length, onClick: saveTable }),
              reachCheck(report) ? ui.button({ label: t('validation.unreachable'), icon: 'trash-2', size: 'sm', loading: state.busy === 'unreachable', title: t('validation.unreachable.hint'), 'data-validation-unreachable': '', onClick: unreachable }) : null)) : null,
        ];
      }
      function localPart() {
        const schema = state.results.schema; const ids = state.results.ids; const clash = state.results.clash;
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('validation.local.schema'), value: schema ? t('validation.local.schema.result', { n: i18n.formatNumber(schema.findings || 0), date: when(schema.at) }) : t('validation.local.never') },
          { label: t('validation.local.ids'), value: ids ? t('validation.local.ids.result', { file: ids.file || 'IDS', pass: i18n.formatNumber(ids.pass || 0), checks: i18n.formatNumber(ids.checks || 0), date: when(ids.at) }) : t('validation.local.never') },
          { label: t('validation.local.clash'), value: clash ? t('validation.local.clash.result' + (clash.server ? '.server' : ''), { n: i18n.formatNumber(clash.count || 0), mode: t('clash.mode.' + (clash.mode || 'intersection')), date: when(clash.at) }) : t('validation.local.never') },
        ];
        return [
          h('h4', { text: t('validation.local') }), kv,
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('validation.local.schema.run'), icon: 'circle-check', size: 'sm', title: t('validation.local.schema.run.hint'), 'data-validation-local': '', onClick: () => openTool('validate') }),
            ui.button({ label: t('validation.local.ids.run'), icon: 'list-checks', size: 'sm', title: t('validation.local.ids.run.hint'), 'data-validation-ids': '', onClick: () => openTool('ids') }),
            ui.button({ label: t('validation.local.clash.run'), icon: 'scan-line', size: 'sm', title: t('validation.local.clash.run.hint'), 'data-validation-clash': '', onClick: () => openTool('clash') })),
        ];
      }
      function draw() {
        replace(el,
          h('h3', { text: t('validation.title') }),
          h('p', { class: 'dm-help', text: t('validation.help') }),
          onServer ? serverPart() : null,
          localPart(),
          state.error ? h('p', { class: 'dm-error dm-small', text: state.error }) : null);
      }
      draw();
      validation.results(ds.id).then((r) => { state.results = r; draw(); }).catch((err) => D.log('validation', err));
      return el;
    }

    return { facetCard, healthCard, codeListCard, cdeCard, bcfCard, validationCard, filesCard };
  });
})();
