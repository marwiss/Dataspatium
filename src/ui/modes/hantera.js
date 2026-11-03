// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Hantera": datasets (overview, columns, comments, history, rename, delete) and the workspace
 * (storage status, backup and restore as ZIP, sharing bundles, the portable folder and GitHub sync).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/hantera', ['ui/base', 'platform/storage/folder'], (base, folder) => {
    const { h, t, i18n, replace } = base;
    const WORKSPACE = '__workspace';
    /** Key-store id of the GitHub token (api/secrets; encrypted when saved). */
    const GITHUB_KEY = 'workspace.github';

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let tab = 'overview'; let unsubscribe = null; let unsubFolder = null;
      /** The GitHub card's credentials panel (it listens to the key store until it is replaced). */
      let githubPanel = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) render(); });
        // Re-render the workspace view when the portable folder finishes an automatic save.
        unsubFolder = services.workspace.onFolder((status) => { if (slots && !status.busy && store.get().selectedId === WORKSPACE) render(); });
        render();
      }
      function deactivate() { slots = null; if (unsubscribe) unsubscribe(); if (unsubFolder) unsubFolder(); dropGithubPanel(); }
      function dropGithubPanel() { if (githubPanel) { githubPanel.destroy(); githubPanel = null; } }

      function render() {
        if (!slots) return;
        const state = store.get();
        ui.datasetList.render(slots.left, {
          datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }),
          extra: [{ id: WORKSPACE, label: t('datasets.storage.title'), icon: 'hard-drive', sub: t('datasets.backup') }],
        });
        const selected = state.datasets.find((d) => d.id === state.selectedId);
        if (state.selectedId === WORKSPACE) { renderWorkspace(); renderWorkspaceInspector(); }
        else if (selected) {
          // The dataset can be removed (here or in another tab) while its views load; only report other errors.
          renderDataset(selected).catch(async (err) => { if (await services.datasets.get(selected.id)) shell.log(String((err && err.message) || err), 'error'); });
          renderInspector(selected);
        }
        else { renderEmpty(); replace(slots.right, h('p', { class: 'dm-help', text: t('mode.hantera.desc') })); }
      }

      function renderEmpty() {
        if (store.get().datasets.length) {
          replace(slots.center, h('dm-empty-state', { icon: 'database', heading: t('datasets.choose'), text: t('shell.select.dataset') },
            ui.button({ label: t('datasets.storage.title'), icon: 'hard-drive', onClick: () => store.set({ selectedId: WORKSPACE }) })));
          return;
        }
        replace(slots.center, h('dm-empty-state', { icon: 'database', heading: t('datasets.empty'), text: t('datasets.empty.hint') },
          ui.button({ label: t('mode.inhamta'), icon: 'download', variant: 'primary', onClick: () => shell.activate('inhamta') }),
          ui.button({ label: t('presets.try'), icon: 'sparkles', onClick: async () => {
            try { const meta = await services.importer.runPreset(D.require('presets').examples[0]); shell.log(t('presets.done', { name: meta.name }), 'ok'); }
            catch (err) { shell.log(String((err && err.message) || err), 'error'); }
          } }),
          ui.button({ label: t('datasets.storage.title'), icon: 'hard-drive', onClick: () => store.set({ selectedId: WORKSPACE }) })));
      }

      async function renderDataset(ds) {
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = [{ id: 'overview', label: t('datasets.overview'), icon: 'info' }, { id: 'columns', label: t('datasets.columns'), icon: 'columns-3' }, { id: 'comments', label: t('comments.title'), icon: 'message-square' }, { id: 'log', label: t('datasets.log'), icon: 'history' }];
        tabs.active = tab;
        tabs.addEventListener('dm-change', (e) => { tab = /** @type {any} */ (e).detail.id; render(); });
        const body = h('div', { class: 'dm-center-fill' });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('table', 20), ds.name, ' ', h('dm-badge', { text: t('common.rows', { n: i18n.formatNumber(ds.rowCount || 0) }) }), ' ', h('dm-badge', { text: t('common.columns', { n: ds.columnCount || 0 }) })),
            h('div', { class: 'dm-row' },
              ds.source && ds.source.kind === 'api' ? ui.button({ label: t('api.refetch'), icon: 'refresh-cw', onClick: () => refetch(ds) }) : null,
              ui.button({ label: t('bearbeta.versions'), icon: 'history', onClick: async () => D.require('ui/dialogs').versionsDialog({ datasetId: ds.id, columns: await services.datasets.columns(ds.id), onApplied: () => render() }) }),
              ui.button({ label: t('common.rename'), icon: 'pencil', onClick: () => rename(ds) }),
              ui.button({ label: t('common.export'), icon: 'file-output', onClick: () => shell.activate('exportera') }),
              ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'danger', onClick: () => remove(ds) }))),
          tabs, body);
        if (tab === 'overview') {
          const kv = /** @type {any} */ (h('dm-kv'));
          const src = ds.source || {};
          kv.items = [
            { label: t('common.name'), value: ds.name },
            { label: t('datasets.shortname'), value: ds.shortName || '' },
            { label: t('common.description'), value: ds.description },
            { label: t('common.created'), value: i18n.formatDateTime(ds.createdAt) },
            { label: t('common.updated'), value: i18n.formatDateTime(ds.updatedAt) },
            { label: t('datasets.rows'), value: i18n.formatNumber(ds.rowCount || 0) },
            { label: t('datasets.columns'), value: String(ds.columnCount || 0) },
            { label: t('common.size'), value: i18n.formatBytes(ds.byteSize || 0) },
            { label: t('common.source'), value: describeSource(src) },
          ];
          replace(body, h('div', { class: 'dm-card' }, kv));
        } else if (tab === 'columns') {
          const cols = await services.datasets.columns(ds.id);
          const table = /** @type {any} */ (h('dm-table'));
          replace(body, h('div', { class: 'dm-table-wrap' }, table));
          table.setData({ columns: [{ key: 'position', label: '#', type: 'integer', width: 70 }, { key: 'name', label: t('common.name'), type: 'text', width: 220 }, { key: 'type', label: t('common.type'), type: 'text', width: 130 }, { key: 'label', label: t('param.label'), type: 'text', width: 220 }, { key: 'description', label: t('column.description'), type: 'text', width: 280 }, { key: 'unit', label: t('column.unit'), type: 'text', width: 120 }, { key: 'valueLabels', label: t('column.valuelabels'), type: 'text', width: 240 }, { key: 'source', label: t('common.source'), type: 'text', width: 200 }],
            rowCount: cols.length, rowProvider: async (start, count) => cols.slice(start, start + count).map((c) => [c.position + 1, c.name, t('type.' + c.type), c.label, c.description || '', c.unit || '', services.datasets.valueLabelsText(c.valueLabels), c.sourceName]) });
        } else if (tab === 'comments') {
          await renderComments(ds, body);
        } else {
          const log = await services.datasets.log(ds.id);
          const changelog = D.require('data/changelog');
          replace(body, h('ul', { class: 'dm-list' }, log.map((e) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(e.action === 'comment' ? 'message-square' : 'history', 14),
            h('span', { class: 'dm-list-main' }, h('span', { text: `${i18n.formatDateTime(e.ts)} · ${changelog.actionLabel(e.action)}` }), h('span', { class: 'dm-list-sub dm-truncate', text: changelog.describe(e) }))))));
        }
      }

      /** Comments on the dataset and its columns: the list (resolve, delete) and a form for a new one. */
      async function renderComments(ds, body) {
        const comments = D.require('data/comments');
        const [list, cols, author] = await Promise.all([comments.list(ds.id), services.datasets.columns(ds.id), comments.author()]);
        const again = () => renderComments(ds, body).catch((err) => shell.log(String((err && err.message) || err), 'error'));
        const text = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('comments.new') }));
        const column = /** @type {any} */ (h('dm-select', { label: t('comments.column') }));
        column.options = [{ value: '', label: t('comments.column.all') }].concat(cols.map((c) => ({ value: c.name, label: c.label && c.label !== c.name ? `${c.name} (${c.label})` : c.name })));
        column.value = '';
        const name = /** @type {any} */ (h('dm-input', { label: t('comments.author'), help: t('comments.author.help') }));
        name.value = author;
        async function add() {
          try {
            if (name.value.trim() !== author) await comments.setAuthor(name.value);
            await comments.add(ds.id, { text: text.value, column: column.value || null });
            shell.log(t('comments.added'), 'ok');
            again();
          } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }
        const items = list.map((c) => h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(c.resolved ? 'check' : 'message-square', 14),
          h('span', { class: 'dm-list-main' + (c.resolved ? ' dm-muted' : '') },
            h('span', { class: 'dm-small', text: [c.author || t('comments.anonymous'), i18n.formatDateTime(c.ts), c.column, c.resolved ? t('comments.resolved') : ''].filter(Boolean).join(' · ') }),
            h('span', { text: c.text })),
          ui.button({ label: c.resolved ? t('comments.reopen') : t('comments.resolve'), variant: 'ghost', onClick: async () => { await comments.setResolved(ds.id, c.id, !c.resolved); again(); } }),
          ui.button({ label: t('common.delete'), icon: 'trash-2', 'icon-only': true, variant: 'ghost', onClick: async () => {
            if (await ui.dialog.confirm(t('comments.delete.confirm'), { okLabel: t('common.delete'), danger: true })) { await comments.remove(ds.id, c.id); again(); }
          } })));
        replace(body, h('div', { class: 'dm-stack' },
          list.length ? h('ul', { class: 'dm-list' }, items) : h('p', { class: 'dm-help', text: t('comments.empty') }),
          h('div', { class: 'dm-card dm-stack' }, text, h('div', { class: 'dm-form-grid' }, column, name),
            h('div', null, ui.button({ label: t('comments.add'), icon: 'message-square', variant: 'primary', onClick: add })))));
      }

      /** Fetch a dataset again from the API it came from (append or replace rows). */
      async function refetch(ds) {
        const choice = await ui.dialog.open({
          title: t('api.refetch.title', { name: ds.source.connectorName || '' }),
          body: h('p', { text: t('api.refetch.text') }),
          actions: [{ label: t('common.cancel'), value: null }, { label: t('api.into.mode.append'), value: 'append' }, { label: t('api.saved.update'), variant: 'primary', value: 'update', primary: true }],
        });
        if (!choice) return;
        const runner = D.require('api/runner');
        shell.log(t('api.refetch.running', { name: ds.name }));
        try {
          let text;
          if (choice === 'update') {
            // The rows are replaced and the dataset's recipe is replayed (see api/runner refreshDataset).
            const res = await runner.refreshDataset(ds.id);
            text = res.steps ? t('api.refresh.done.steps', { name: ds.name, rows: i18n.formatNumber(res.rows), steps: res.steps }) : t('api.refresh.done', { name: ds.name, rows: i18n.formatNumber(res.rows) });
          } else {
            const table = await runner.refetch(ds.source);
            const res = await runner.intoDataset(ds.id, table, { mode: 'append', source: Object.assign({}, ds.source, { fetchedAt: new Date().toISOString(), rows: table.rows.length }) });
            text = t('api.into.appended', { name: ds.name, rows: i18n.formatNumber(res.rows) });
          }
          shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
          render();
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
      }

      /** Human-readable origin of a dataset. */
      function describeSource(src) {
        if (!src) return '';
        if (src.kind === 'api') return [src.connectorName, src.table && src.table.title ? src.table.title : src.endpointName, src.fetchedAt ? t('api.fetched.at', { date: i18n.formatDateTime(src.fetchedAt) }) : '', src.license ? `(${src.license})` : ''].filter(Boolean).join(' · ');
        if (src.publisher) return [src.publisher, src.table, src.license ? `(${src.license})` : ''].filter(Boolean).join(' · ');
        if (src.fileName) return `${src.fileName}${src.format ? ` (${src.format})` : ''}`;
        if (src.kind === 'paste') return t('import.sources.paste');
        return src.kind || '';
      }

      function renderInspector(ds) {
        const desc = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '4', label: t('common.description') }));
        desc.value = ds.description || '';
        desc.addEventListener('change', async () => { await services.datasets.updateMeta(ds.id, { description: desc.value }); shell.log(t('datasets.saved'), 'ok'); });
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [{ label: t('common.id'), value: h('code', { text: ds.id }) }, { label: t('common.size'), value: i18n.formatBytes(ds.byteSize || 0) }];
        replace(slots.right, desc, kv);
      }

      async function rename(ds) {
        // Name and short name together: the short name is what SQL, R and chart files refer to.
        const nameIn = /** @type {any} */ (h('dm-input', { label: t('common.name') })); nameIn.value = ds.name;
        const shortIn = /** @type {any} */ (h('dm-input', { label: t('datasets.shortname'), help: t('datasets.shortname.help'), mono: true })); shortIn.value = ds.shortName || '';
        const ok = await ui.dialog.open({ title: t('common.rename'), body: h('div', { class: 'dm-stack' }, nameIn, shortIn), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        const patch = {};
        if (nameIn.value.trim() && nameIn.value.trim() !== ds.name) patch.name = nameIn.value.trim();
        if (shortIn.value.trim() && shortIn.value.trim() !== (ds.shortName || '')) patch.shortName = shortIn.value.trim();
        if (!Object.keys(patch).length) return;
        try { await services.datasets.updateMeta(ds.id, patch); shell.log(t('datasets.renamed'), 'ok'); }
        catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      async function remove(ds) {
        if (await ui.dialog.confirm(t('datasets.delete.confirm', { name: ds.name }), { okLabel: t('common.delete'), danger: true })) {
          await services.datasets.remove(ds.id);
          shell.log(t('datasets.deleted', { name: ds.name }), 'ok');
          ui.toast.show(t('datasets.deleted', { name: ds.name }), { kind: 'ok' });
        }
      }

      async function renderWorkspace() {
        const est = await services.idb.estimate();
        const persisted = await services.idb.persisted();
        const folderEl = await folderCard();
        const restoreZone = h('dm-dropzone', { text: t('datasets.restore'), hint: t('datasets.restore.hint'), accept: '.zip', icon: 'package' });
        restoreZone.addEventListener('dm-files', async (e) => {
          const file = /** @type {any} */ (e).detail.files[0];
          try {
            const opened = await services.workspace.inspect(file);
            let replaceIds = [];
            // A bundle shows its message and changes first; datasets that already exist can take its version.
            if (opened.manifest && opened.manifest.kind === 'bundle') {
              const choice = await incomingSummary(opened, t('bundle.open.title', { name: opened.manifest.name || t('bundle.default.name') }));
              if (!choice) return;
              replaceIds = choice.replaceIds;
            }
            reportRestore(await services.workspace.restore(opened, { replaceIds }));
          } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(t('common.error') + ': ' + ((err && err.message) || err), { kind: 'error' }); }
        });
        replace(slots.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('hard-drive', 20), t('datasets.storage.title'))),
          h('div', { class: 'dm-card dm-stack' },
            h('p', { text: t('datasets.storage.text') }),
            h('div', { class: 'dm-stats-grid' },
              stat(i18n.formatBytes(est && est.usage || 0), t('datasets.storage.used')),
              stat(est && est.quota ? i18n.formatBytes(est.quota) : '–', t('datasets.storage.quota')),
              stat(String(store.get().datasets.length), t('shell.datasets')),
              stat(persisted ? t('datasets.persist.granted') : t('datasets.persist.denied'), t('datasets.persist.label'))),
            h('div', { class: 'dm-row-wrap' },
              persisted ? null : ui.button({ label: t('datasets.persist.request'), icon: 'lock', onClick: async () => { const ok = await services.idb.requestPersist(); shell.log(t('datasets.persist', { state: ok ? t('datasets.persist.granted') : t('datasets.persist.denied') }), ok ? 'ok' : 'warn'); render(); } }),
              apiDatasets().length ? ui.button({ label: t('api.refresh.all', { n: apiDatasets().length }), icon: 'refresh-cw', onClick: refreshAllApi }) : null)),
          h('div', { class: 'dm-form-grid' },
            h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('datasets.backup') }), h('p', { class: 'dm-help', text: t('datasets.backup.hint') }),
              h('div', null, ui.button({ label: t('datasets.backup'), icon: 'download', variant: 'primary', onClick: backup })),
              backupInfo()),
            h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('datasets.restore') }), restoreZone),
            h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('bundle.title') }), h('p', { class: 'dm-help', text: t('bundle.card.hint') }),
              h('div', null, ui.button({ label: t('bundle.create'), icon: 'package', onClick: shareBundle })))),
          folderEl, await githubCard());
      }

      /** Log and announce what a restore brought in. */
      function reportRestore(res) {
        const text = res.replaced && res.replaced.length ? t('datasets.restore.done.replaced', { n: res.imported.length, replaced: res.replaced.length }) : t('datasets.restore.done', { n: res.imported.length });
        shell.log(text, 'ok');
        ui.toast.show(text, { kind: 'ok' });
        if (res.existing) shell.log(t('datasets.restore.existing', { n: res.existing }), 'info');
        for (const s of res.skipped) shell.log(s, 'warn');
      }

      /**
       * What a bundle or a GitHub folder brings: sender, message, the changes per dataset and, for datasets that already
       * exist here, whether to take the incoming version. Resolves with {replaceIds} or null when cancelled.
       */
      async function incomingSummary(opened, title) {
        const manifest = opened.manifest || {};
        const existing = new Map((opened.existing || []).map((d) => [d.id, d]));
        const replace = new Set();
        const changes = new Map((manifest.changes || []).map((c) => [c.id, c]));
        const sender = [manifest.author || t('comments.anonymous'), manifest.created ? i18n.formatDateTime(manifest.created) : ''].filter(Boolean).join(', ');
        const sections = (manifest.datasets || []).map((d) => {
          const here = existing.get(d.id);
          const steps = (changes.get(d.id) || { entries: [] }).entries;
          const nodes = [h('h4', null, d.name, ' ', h('dm-badge', { kind: here ? 'warn' : 'ok', text: here ? t('bundle.open.exists') : t('bundle.open.new') }))];
          if (steps.length) {
            nodes.push(h('ul', { class: 'dm-help' }, steps.slice(-8).map((s) => h('li', { text: `${i18n.formatDateTime(s.ts)}: ${s.text}` }))));
            if (steps.length > 8) nodes.push(h('p', { class: 'dm-help', text: t('bundle.open.more', { n: steps.length - 8 }) }));
          }
          if (here) {
            const sw = /** @type {any} */ (h('dm-switch', { label: t('bundle.open.replace', { name: here.local }) }));
            sw.addEventListener('change', () => { if (sw.checked) replace.add(d.id); else replace.delete(d.id); });
            nodes.push(sw);
          }
          return h('div', { class: 'dm-stack-sm' }, nodes);
        });
        const body = h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: t('bundle.open.from', { sender }) }),
          manifest.message ? h('div', { class: 'dm-card' }, h('p', { text: manifest.message })) : null,
          sections.length ? h('div', { class: 'dm-stack' }, sections) : h('p', { class: 'dm-help', text: t('bundle.open.nodatasets') }),
          existing.size ? h('p', { class: 'dm-help', text: t('bundle.open.replace.help') }) : null);
        const ok = await ui.dialog.open({ title, body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('bundle.open.ok'), variant: 'primary', value: true, primary: true }] });
        return ok === true ? { replaceIds: Array.from(replace) } : null;
      }

      /** GitHub card: repository, branch and folder, the key, and push or pull of the whole workspace. */
      async function githubCard() {
        dropGithubPanel();
        const cfg = await services.workspace.githubConfig();
        const secrets = D.require('api/secrets');
        const connector = { id: GITHUB_KEY, name: 'GitHub', auth: { type: 'bearer', help: t('github.token.help') } };
        const repoIn = /** @type {any} */ (h('dm-input', { label: t('github.repo'), placeholder: t('github.repo.placeholder'), value: cfg.repo }));
        const branchIn = /** @type {any} */ (h('dm-input', { label: t('github.branch'), value: cfg.branch }));
        const pathIn = /** @type {any} */ (h('dm-input', { label: t('github.path'), help: t('github.path.help'), value: cfg.path }));
        const saveConfig = () => services.workspace.setGithubConfig({ repo: repoIn.value.trim(), branch: branchIn.value.trim() || 'main', path: pathIn.value.trim() });
        for (const input of [repoIn, branchIn, pathIn]) input.addEventListener('change', () => { saveConfig().catch((err) => shell.log(String((err && err.message) || err), 'error')); });
        githubPanel = D.require('ui/api/auth-panel').create(connector, { quiet: true });
        const token = () => { const values = secrets.get(GITHUB_KEY); return values ? values.token : ''; };
        const status = [cfg.lastPush ? t('github.last.push', { date: i18n.formatDateTime(cfg.lastPush) }) : '', cfg.lastPull ? t('github.last.pull', { date: i18n.formatDateTime(cfg.lastPull) }) : ''].filter(Boolean).join(' · ');
        async function push() {
          const message = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('github.commit.message'), help: t('github.commit.help') }));
          message.value = t('github.commit.default');
          const ok = await ui.dialog.open({ title: t('github.push'), body: message, actions: [{ label: t('common.cancel'), value: false }, { label: t('github.push'), variant: 'primary', value: true, primary: true }] });
          if (ok !== true) return;
          await saveConfig();
          shell.setStatus('saving');
          try {
            const res = await services.workspace.pushToGitHub({ token: token(), message: message.value.trim() || t('github.commit.default') });
            const text = res.commit ? t('github.pushed', { written: res.written, removed: res.removed }) : t('github.pushed.none');
            shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' });
            render();
          } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
          shell.setStatus('saved');
        }
        async function pull() {
          await saveConfig();
          try {
            const fetched = await services.workspace.fetchFromGitHub({ token: token() });
            const choice = await incomingSummary(fetched, t('github.pull.title', { repo: repoIn.value.trim() }));
            if (!choice) return;
            reportRestore(await services.workspace.restoreFromGitHub(fetched, { replaceIds: choice.replaceIds }));
            render();
          } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
        }
        const repo = D.require('platform/storage/github').parseRepo(cfg.repo);
        return h('div', { class: 'dm-card dm-stack' },
          h('h3', null, ui.icon('git-branch', 18), ' ', t('github.title')),
          h('p', { class: 'dm-help', text: t('github.hint') }),
          h('div', { class: 'dm-form-grid' }, repoIn, branchIn, pathIn),
          githubPanel.el,
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('github.push'), icon: 'upload', onClick: push }),
            ui.button({ label: t('github.pull'), icon: 'download', onClick: pull }),
            repo && cfg.lastCommit ? h('a', { href: D.require('platform/storage/github').webUrl(Object.assign({}, repo, { branch: cfg.branch, path: cfg.path }), cfg.lastCommit), target: '_blank', rel: 'noopener noreferrer', text: t('github.open') }) : null),
          status ? h('p', { class: 'dm-help', text: status }) : null);
      }

      function apiDatasets() { return store.get().datasets.filter((d) => d.source && d.source.kind === 'api'); }

      /** Re-fetch every API-sourced dataset (replace mode), one after the other, with progress in a toast. */
      async function refreshAllApi() {
        const runner = D.require('api/runner');
        const abort = new AbortController();
        const toast = ui.toast.show(t('api.refresh.all.running', { name: '', done: 0, total: apiDatasets().length }), { kind: 'info', timeout: 0, action: { label: t('api.cancel'), onClick: () => abort.abort() } });
        try {
          const results = await runner.refreshAll({ signal: abort.signal, onProgress: (p) => { const el = toast.querySelector('.dm-toast-text'); if (el) el.textContent = t('api.refresh.all.running', { name: p.name, done: p.done, total: p.total }); } });
          const ok = results.filter((r) => r.ok).length; const failed = results.length - ok;
          for (const r of results) shell.log(r.ok ? t('api.into.replaced', { name: r.name, rows: i18n.formatNumber(r.rows || 0) }) : `${r.name}: ${r.error}`, r.ok ? 'ok' : 'error');
          ui.toast.show(t('api.refresh.all.done', { ok, failed }), { kind: failed ? 'warn' : 'ok', timeout: 10000 });
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
        finally { toast.remove(); }
      }

      /** Selective sharing bundle: chosen datasets plus charts, dashboards, templates and notebooks. */
      async function shareBundle() {
        const list = store.get().datasets;
        const comments = D.require('data/comments');
        const author = await comments.author();
        const name = /** @type {any} */ (h('dm-input', { label: t('bundle.name'), value: t('bundle.default.name') }));
        const authorIn = /** @type {any} */ (h('dm-input', { label: t('comments.author'), help: t('bundle.author.help') }));
        authorIn.value = author;
        const message = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('bundle.message'), help: t('bundle.message.help') }));
        const chosen = new Set(list.map((d) => d.id));
        const switches = list.map((d) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: `${d.name} (${t('common.rows', { n: i18n.formatNumber(d.rowCount || 0) })})` }));
          sw.checked = true;
          sw.addEventListener('change', () => { if (sw.checked) chosen.add(d.id); else chosen.delete(d.id); });
          return sw;
        });
        const inc = { charts: true, dashboards: true, documents: true, notebooks: true, scripts: true };
        const incSwitches = Object.keys(inc).map((k) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('bundle.include.' + k) }));
          sw.checked = true;
          sw.addEventListener('change', () => { inc[k] = sw.checked; });
          return sw;
        });
        const body = h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: t('bundle.help') }), name, message, authorIn,
          h('h4', { text: t('shell.datasets') }), list.length ? h('div', { class: 'dm-stack-sm' }, switches) : h('p', { class: 'dm-help', text: t('datasets.empty') }),
          h('h4', { text: t('bundle.include') }), h('div', { class: 'dm-row-wrap' }, incSwitches));
        const ok = await ui.dialog.open({ title: t('bundle.title'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('bundle.create'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        try {
          shell.setStatus('saving');
          const label = name.value.trim() || t('bundle.default.name');
          if (authorIn.value.trim() !== author) await comments.setAuthor(authorIn.value);
          const res = await services.workspace.bundle({ name: label, datasetIds: Array.from(chosen), include: inc, author: authorIn.value.trim(), message: message.value });
          const file = services.files.safeName(label, 'dataspatium.zip');
          services.files.download(res.blob, file);
          shell.log(t('bundle.done', { name: file, n: res.counts.datasets }), 'ok');
          ui.toast.show(t('bundle.done', { name: file, n: res.counts.datasets }), { kind: 'ok' });
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        shell.setStatus('saved');
      }

      /** Portable folder card (File System Access; Chromium only, see platform/storage/folder-store.js). */
      async function folderCard() {
        const items = [h('h3', { text: t('folder.title') }), h('p', { class: 'dm-help', text: t('folder.text') })];
        if (!folder.supported()) {
          items.push(h('p', { class: 'dm-muted dm-small', text: t('folder.unsupported') }));
          return h('div', { class: 'dm-card dm-stack' }, items);
        }
        const root = await folder.current();
        const perm = await folder.permission(root);
        const status = services.workspace.folderStatus();
        const auto = await services.workspace.autoSaveSetting();
        items.push(h('p', { class: 'dm-small', text: root ? t('folder.current', { name: root.name }) : t('folder.none') }));
        if (root && perm !== 'granted') items.push(h('p', { class: 'dm-muted dm-small', text: t('folder.permission.prompt') }));
        if (status.lastSync) items.push(h('p', { class: 'dm-faint dm-xs', text: t('folder.last', { time: i18n.formatDateTime(status.lastSync) }) }));
        if (status.error) items.push(h('p', { class: 'dm-error dm-small', text: t('folder.error', { message: status.error }) }));
        const fail = (err) => {
          if (err && err.name === 'AbortError') return;
          const text = t('folder.error', { message: String((err && err.message) || err) });
          shell.log(text, 'error'); ui.toast.show(text, { kind: 'error', timeout: 12000 });
          render();
        };
        const done = (text) => { shell.log(text, 'ok'); ui.toast.show(text, { kind: 'ok' }); render(); };
        items.push(h('div', { class: 'dm-row' },
          ui.button({ label: root ? t('folder.change') : t('folder.choose'), icon: 'folder', onClick: () => folder.choose().then(() => render()).catch(fail) }),
          root && perm !== 'granted' ? ui.button({ label: t('folder.reconnect'), icon: 'refresh-cw', onClick: () => folder.permission(root, true).then(() => render()).catch(fail) }) : null,
          root && perm === 'granted' ? ui.button({ label: t('folder.save'), icon: 'save', loading: status.busy, onClick: () => services.workspace.saveToFolder(root, { force: true }).then((res) => done(t('folder.saved', { n: res.datasets, name: root.name }))).catch(fail) }) : null,
          root && perm === 'granted' ? ui.button({ label: t('folder.load'), icon: 'upload', onClick: () => services.workspace.loadFromFolder(root).then((res) => { for (const s of res.skipped) shell.log(s, 'warn'); done(t('folder.loaded', { n: res.imported.length, skipped: res.existing })); }).catch(fail) }) : null,
          root ? ui.button({ label: t('folder.disconnect'), icon: 'x', onClick: () => services.workspace.setAutoSaveSetting(false).then(() => folder.disconnect()).then(() => render()).catch(fail) }) : null));
        if (root) {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('folder.autosave') }));
          sw.checked = auto;
          sw.addEventListener('change', () => {
            services.workspace.setAutoSaveSetting(sw.checked)
              .then(() => (sw.checked && perm === 'granted' ? services.workspace.saveToFolder(root).then(() => render()) : null))
              .catch(fail);
          });
          items.push(sw);
        }
        return h('div', { class: 'dm-card dm-stack' }, items);
      }

      function stat(value, label) { return h('div', { class: 'dm-stat' }, h('span', { class: 'dm-stat-value', text: value }), h('span', { class: 'dm-stat-label', text: label })); }

      async function backup() {
        try {
          shell.setStatus('saving');
          const { blob, count } = await services.workspace.backup();
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
          services.files.download(blob, t('datasets.backup.file', { stamp }));
          shell.log(t('datasets.backup.done') + ' ' + t('datasets.backup.stats', { count, size: i18n.formatBytes(blob.size) }), 'ok');
        } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
        shell.setStatus('saved');
        render();
      }

      /** Last backup time and the reminder interval (filled in asynchronously). */
      function backupInfo() {
        const el = h('div', { class: 'dm-stack-sm' });
        services.workspace.backupStatus().then((st) => {
          const sel = /** @type {any} */ (h('dm-select', { label: t('backup.remind') }));
          sel.options = [{ value: '0', label: t('backup.remind.off') }].concat([7, 14, 30, 90].map((n) => ({ value: String(n), label: t('backup.remind.days', { n }) })));
          sel.value = String(st.remindDays);
          sel.addEventListener('change', () => { services.workspace.setRemindDays(Number(sel.value)); });
          const when = st.lastAt ? new Date(st.lastAt).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
          replace(el, h('p', { class: st.due ? 'dm-warn dm-small' : 'dm-help', text: st.lastAt ? t('backup.last', { when }) : t('backup.last.never') }), sel);
        }).catch(() => {});
        return el;
      }

      function renderWorkspaceInspector() {
        const c = D.capabilities;
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('env.protocol'), value: c.protocol },
          { label: t('env.browser'), value: c.isFirefox ? 'Firefox' : c.isChromium ? 'Chromium' : t('env.browser.unknown') },
          { label: t('env.indexeddb'), value: c.indexedDB ? t('common.yes') : t('common.no') },
          { label: t('env.folder'), value: c.fileSystemAccess ? t('common.yes') : t('common.no') },
          { label: t('env.sab'), value: c.sharedArrayBuffer ? t('common.yes') : t('common.no') },
        ];
        replace(slots.right, h('h4', { text: t('env.title') }), kv);
      }

      // Command palette: re-fetch API datasets and share a bundle.
      if (ctx.palette) {
        ctx.palette.register(() => {
          const cmds = [{ id: 'bundle', label: t('bundle.title'), hint: t('bundle.create'), group: t('palette.group.actions'), icon: 'package', run: () => shareBundle() }];
          if (apiDatasets().length) cmds.push({ id: 'api:refresh', label: t('api.refresh.all', { n: apiDatasets().length }), group: t('palette.group.actions'), icon: 'refresh-cw', run: () => refreshAllApi() });
          return cmds;
        });
      }

      return { id: 'hantera', activate, deactivate };
    }
    return { createMode, WORKSPACE };
  });
})();
