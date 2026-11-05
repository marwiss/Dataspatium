// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Dela": data to other people and devices. Tabs: Paket (sharing bundles), GitHub (workspace sync),
 * Delningsmeny (the system share sheet), Publicera (standalone HTML) and Ta emot (bundles from a file or a
 * web address). Enheter (direct transfer between devices) is added in 2.1.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/dela', ['ui/base', 'ui/share/bundle', 'ui/share/github', 'ui/share/devices'], (base, share, github, devices) => {
    const { h, t, i18n, replace } = base;
    const TABS = ['paket', 'github', 'devices', 'share', 'publish', 'receive'];
    const TAB_ICONS = { paket: 'package', github: 'git-branch', devices: 'smartphone', share: 'share-2', publish: 'globe', receive: 'download' };
    /** Formats offered in the share sheet (the ones other apps open directly). */
    const SHARE_FORMATS = ['csv', 'xlsx', 'ods', 'json'];

    /** @param {any} ctx */
    function createMode(ctx) {
      const { store, ui, services, shell } = ctx;
      let slots = null;
      let unsubscribe = null;
      let tab = 'paket';
      let githubCard = null;
      let devicesPanel = null;
      const dropGithub = () => { if (githubCard) { githubCard.destroy(); githubCard = null; } };
      const dropDevices = () => { if (devicesPanel) { devicesPanel.destroy(); devicesPanel = null; } };
      const selected = () => { const s = store.get(); return s.datasets.find((d) => d.id === s.selectedId) || null; };
      const fail = (err) => { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((_state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) render(); });
        render();
      }
      function deactivate() { slots = null; if (unsubscribe) { unsubscribe(); unsubscribe = null; } dropGithub(); dropDevices(); }

      function render() {
        if (!slots) return;
        const state = store.get();
        // Another part of the app can open a tab here, as Insamling i fält does with Enheter.
        if (state.delaTab) { tab = state.delaTab; store.set({ delaTab: null }); }
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        const tabsEl = /** @type {any} */ (h('dm-tabs'));
        tabsEl.tabs = TABS.map((id) => ({ id, label: t('dela.tabs.' + id), icon: TAB_ICONS[id] }));
        tabsEl.active = tab;
        tabsEl.addEventListener('dm-change', (e) => { tab = /** @type {CustomEvent} */ (e).detail.id; render(); });
        const body = h('div', { class: 'dm-stack' });
        replace(slots.center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('share-2', 20), t('dela.title'))), tabsEl, body);
        dropGithub();
        if (tab !== 'devices') dropDevices();
        const fill = { paket: renderPaket, github: renderGithub, devices: renderDevices, share: renderShare, publish: renderPublish, receive: renderReceive }[tab];
        Promise.resolve(fill(body)).catch(fail);
        renderInspector().catch(fail);
      }

      function renderPaket(body) {
        const ds = selected();
        replace(body, h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('bundle.title') }),
          h('p', { class: 'dm-help', text: t('bundle.card.hint') }),
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('bundle.create'), icon: 'package', variant: 'primary', onClick: () => share.shareBundle(ctx) }),
            ds ? ui.button({ label: t('dela.paket.selected', { name: ds.name }), icon: 'package', onClick: () => share.shareBundle(ctx, { datasetIds: [ds.id] }) }) : null)));
      }

      async function renderGithub(body) {
        githubCard = await github.create(ctx, { onChanged: () => render() });
        replace(body, githubCard.el);
      }

      /** Direct transfer between devices; the panel keeps its session while the tab is open. */
      async function renderDevices(body) {
        if (!devicesPanel) devicesPanel = await devices.create(ctx, { onChanged: () => renderInspector().catch(fail) });
        else devicesPanel.render();
        replace(body, devicesPanel.el);
      }

      /** The share sheet of the operating system (Web Share API); browsers without it save the file instead. */
      function renderShare(body) {
        const canFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [new File(['a;b\n'], 'probe.csv', { type: 'text/csv' })] });
        const what = /** @type {any} */ (h('dm-select', { label: t('dela.share.what') }));
        what.options = [{ value: 'dataset', label: t('dela.share.what.dataset') }, { value: 'bundle', label: t('dela.share.what.bundle') }];
        what.value = 'dataset';
        const format = /** @type {any} */ (h('dm-select', { label: t('dela.share.format') }));
        format.options = services.exporter.FORMATS.filter((f) => SHARE_FORMATS.includes(f.id)).map((f) => ({ value: f.id, label: t(f.key) }));
        format.value = 'csv';
        what.addEventListener('change', () => { format.disabled = what.value === 'bundle'; });
        const btn = ui.button({ label: canFiles ? t('dela.share.button') : t('dela.share.save'), icon: canFiles ? 'share-2' : 'download', variant: 'primary', onClick: () => shareNow(what.value, format.value, btn) });
        replace(body, h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('dela.share.title') }),
          h('p', { class: 'dm-help', text: t('dela.share.hint') }),
          canFiles ? null : h('p', { class: 'dm-muted dm-small', text: t('dela.share.unsupported') }),
          h('div', { class: 'dm-form-grid' }, what, format),
          h('div', null, btn)));
      }

      /** One dataset in a file format, from the reviewed copy when the review changed anything. */
      async function exportReviewed(ds, formatId, transform) {
        const shareScan = D.require('data/share-scan');
        return shareScan.changes(transform) ? shareScan.exportCopy(ds, formatId, transform) : services.exporter.exportDataset(ds.id, formatId);
      }
      async function shareNow(what, formatId, btn) {
        const ds = selected();
        if (what === 'dataset' && !ds) { ui.toast.show(t('dela.share.nodataset'), { kind: 'warn' }); return; }
        btn.loading = true;
        try {
          let file;
          const reviewModule = D.require('ui/share/review');
          const ids = what === 'dataset' ? [ds.id] : store.get().datasets.map((d) => d.id);
          const reviewed = await reviewModule.review(ctx, ids);
          if (!reviewed) return;
          const note = reviewModule.summary(reviewed.transform);
          if (what === 'dataset') {
            const res = await exportReviewed(ds, formatId, reviewed.transform[ds.id]);
            file = new File([res.blob], res.filename, { type: res.blob.type || 'application/octet-stream' });
          } else {
            const state = store.get();
            const name = t('bundle.default.name');
            const res = await services.workspace.bundle({ transform: reviewed.transform, name, datasetIds: state.datasets.map((d) => d.id), include: { charts: true, dashboards: true, documents: true, notebooks: true, scripts: true }, author: await D.require('data/comments').author(), message: '' });
            file = new File([res.blob], services.files.safeName(name, 'dataspatium.zip'), { type: 'application/zip' });
          }
          if (note) shell.log(note, 'info');
          if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: file.name });
              shell.log(t('dela.share.done', { name: file.name }), 'ok');
            } catch (err) { if (!err || err.name !== 'AbortError') throw err; }
          } else {
            services.files.download(file, file.name);
            shell.log(t('dela.share.saved', { name: file.name }), 'ok');
          }
        } catch (err) { fail(err); }
        btn.loading = false;
      }

      /** Standalone HTML files of dashboards and documents (documents are filled with the selected dataset). */
      async function renderPublish(body) {
        const dashboards = D.require('viz/dashboards');
        const documents = D.require('docgen/documents');
        const [dashes, docs] = await Promise.all([dashboards.list(), documents.list()]);
        const ds = selected();
        const row = (label, onClick) => h('div', { class: 'dm-row' }, h('span', { class: 'dm-grow dm-truncate', text: label }), ui.button({ label: t('dela.publish.html'), icon: 'globe', size: 'sm', onClick }));
        const dashRows = dashes.map((d) => row(d.name, async () => {
          try { services.files.download(await dashboards.toHtml(d), services.files.safeName(d.name, 'html')); shell.log(t('dela.publish.done', { name: d.name }), 'ok'); } catch (err) { fail(err); }
        }));
        // A dataset as a page of its own. It leaves the app, so it goes through the review, on a copy.
        const datasetRows = store.get().datasets.map((d) => row(d.name, async () => {
          try {
            const reviewed = await D.require('ui/share/review').review(ctx, [d.id]);
            if (!reviewed) return;
            const copy = await services.datasets.importBytes(await D.require('data/share-scan').copy(d.id, reviewed.transform[d.id] || {}), { name: d.name }, { quiet: true });
            try { services.files.download(await D.require('docgen/viewers').pageFor(copy.id), services.files.safeName(d.name, 'html')); } finally { await services.datasets.remove(copy.id, { quiet: true }); }
            shell.log(t('dela.publish.done', { name: d.name }), 'ok');
          } catch (err) { fail(err); }
        }));
        const docRows = docs.map((doc) => row(doc.name, async () => {
          if (!ds) { ui.toast.show(t('dela.publish.needs.dataset'), { kind: 'warn' }); return; }
          try { const res = await D.require('docgen/generate').generate(doc, ds.id, 'html'); services.files.download(res.blob, res.filename); shell.log(t('dela.publish.done', { name: doc.name }), 'ok'); } catch (err) { fail(err); }
        }));
        replace(body, h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('dela.publish.title') }),
          h('p', { class: 'dm-help', text: t('dela.publish.hint') }),
          h('h4', { text: t('shell.datasets') }),
          h('p', { class: 'dm-help dm-small', text: t('dela.publish.datasets.help') }),
          datasetRows.length ? h('div', { class: 'dm-stack-sm' }, datasetRows) : h('p', { class: 'dm-help', text: t('dela.publish.none') }),
          h('h4', { text: t('dela.publish.dashboards') }),
          dashRows.length ? h('div', { class: 'dm-stack-sm' }, dashRows) : h('p', { class: 'dm-help', text: t('dela.publish.none') }),
          h('h4', { text: t('dela.publish.documents') }),
          docRows.length ? h('div', { class: 'dm-stack-sm' }, docRows) : h('p', { class: 'dm-help', text: t('dela.publish.none') })));
      }

      function renderReceive(body) {
        const zone = h('dm-dropzone', { text: t('dela.receive.drop'), hint: t('datasets.restore.hint'), accept: '.zip', icon: 'package' });
        zone.addEventListener('dm-files', (e) => { share.receiveFile(ctx, /** @type {any} */ (e).detail.files[0]); });
        const urlIn = /** @type {any} */ (h('dm-input', { label: t('dela.receive.url'), placeholder: 'https://' }));
        const fetchBtn = ui.button({ label: t('dela.receive.fetch'), icon: 'download', onClick: async () => {
          fetchBtn.loading = true;
          try { await share.receiveFile(ctx, await D.require('io/url-import').fetchFile(urlIn.value)); } catch (err) { fail(err); }
          fetchBtn.loading = false;
        } });
        replace(body, h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('dela.receive.title') }),
          h('p', { class: 'dm-help', text: t('dela.receive.hint') }),
          zone,
          h('div', { class: 'dm-row-wrap' }, urlIn, fetchBtn)));
      }

      /** The inspector describes the active tab: what a bundle holds, the GitHub settings, share support. */
      async function renderInspector() {
        if (!slots) return;
        if (tab === 'paket') {
          const [charts, dashes, docs, notebooks, scripts] = await Promise.all([
            D.require('viz/charts').list(), D.require('viz/dashboards').list(), D.require('docgen/documents').list(), D.require('analysis/notebooks').list(), services.idb.listScripts(),
          ]);
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('shell.datasets'), value: String(store.get().datasets.length) },
            { label: t('bundle.include.charts'), value: String(charts.length) },
            { label: t('bundle.include.dashboards'), value: String(dashes.length) },
            { label: t('bundle.include.documents'), value: String(docs.length) },
            { label: t('bundle.include.notebooks'), value: String(notebooks.length) },
            { label: t('bundle.include.scripts'), value: String(scripts.length) },
          ];
          if (!slots || tab !== 'paket') return;
          replace(slots.right, h('h4', { text: t('dela.counts.title') }), kv, h('p', { class: 'dm-help', text: t('dela.inspector.paket') }));
        } else if (tab === 'github') {
          const cfg = await services.workspace.githubConfig();
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('github.repo'), value: cfg.repo || null },
            { label: t('github.branch'), value: cfg.branch || null },
            { label: t('github.path'), value: cfg.path || null },
            { label: t('github.last.push.label'), value: cfg.lastPush ? i18n.formatDateTime(cfg.lastPush) : null },
            { label: t('github.last.pull.label'), value: cfg.lastPull ? i18n.formatDateTime(cfg.lastPull) : null },
          ];
          if (!slots || tab !== 'github') return;
          replace(slots.right, h('h4', { text: t('github.title') }), kv, h('p', { class: 'dm-help', text: t('dela.inspector.github') }));
        } else if (tab === 'devices') {
          const peers = await D.require('platform/p2p').peers();
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [{ label: t('devices.peers.title'), value: String(peers.length) }];
          if (!slots || tab !== 'devices') return;
          replace(slots.right, h('h4', { text: t('dela.tabs.devices') }), kv, h('p', { class: 'dm-help', text: t('dela.inspector.devices') }));
        } else if (tab === 'share') {
          const ok = typeof navigator.share === 'function';
          replace(slots.right, h('p', { class: 'dm-help', text: ok ? t('dela.inspector.share.ok') : t('dela.inspector.share.no') }));
        } else {
          replace(slots.right, h('p', { class: 'dm-help', text: t(tab === 'publish' ? 'dela.inspector.publish' : 'dela.inspector.receive') }));
        }
      }

      // Command palette: create a bundle from anywhere.
      if (ctx.palette) {
        ctx.palette.register(() => [{ id: 'bundle', label: t('bundle.title'), hint: t('bundle.create'), group: t('palette.group.actions'), icon: 'package', run: () => share.shareBundle(ctx) }]);
      }

      return { id: 'dela', activate, deactivate, get devicesPanel() { return devicesPanel; } };
    }
    return { createMode, TABS };
  });
})();
