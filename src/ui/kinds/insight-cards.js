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
      const state = { checking: false, result: null, error: '', fetching: false };
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
            ds.kind === 'model' ? ui.button({ label: t('issues.title'), icon: 'message-square', size: 'sm', title: t('cde.issues.hint'), onClick: () => { store.set({ selectedId: ds.id, openModelIssues: { datasetId: ds.id } }); ctx.shell.activate('bearbeta'); } }) : null,
            ds.kind === 'model' && !D.require('data/model').isDxf(ds) ? ui.button({ label: t('ifcgraph.title'), icon: 'network', size: 'sm', title: t('ifcgraph.open.hint'), 'data-cde-graph': '', onClick: async () => { if (!(await D.require('api/graph-source').open(ctx, ds))) ui.toast.show(t('cde.err.noconnector', { host: cde.host }), { kind: 'warn' }); } }) : null),
          r && r.newer ? h('div', { class: 'dm-row-wrap', 'data-cde-newer': '' }, h('span', { class: 'dm-warn', text: t('cde.newer', { have: String(r.have), latest: String(r.version.version_index) }) }), ui.button({ label: t('cde.fetch.version', { n: String(r.version.version_number || r.version.version_index) }), icon: 'download', size: 'sm', variant: 'primary', loading: state.fetching, onClick: fetchNew })) : null,
          r && !r.newer && r.version ? h('p', { class: 'dm-help dm-small', 'data-cde-current': '', text: t('cde.current') }) : null,
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

    return { facetCard, healthCard, codeListCard, cdeCard, bcfCard, filesCard };
  });
})();
