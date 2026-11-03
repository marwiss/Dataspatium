// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Actions on one or several datasets (Hantera): organise (folder and tags), move by drag and drop, and the
 * batch dialog for the selected datasets: organise, delete, export as a ZIP of CSV files, bundle, refresh from
 * the API and run another dataset's recipe on them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/batch-actions', ['ui/base', 'ui/share/bundle'], (base, share) => {
    const { h, t, i18n } = base;

    const chosenOf = (ctx, ids) => { const set = new Set(ids); return ctx.store.get().datasets.filter((d) => set.has(d.id)); };
    const fail = (ctx, err) => { ctx.shell.log(String((err && err.message) || err), 'error'); ctx.ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };
    const done = (ctx, text) => { ctx.shell.log(text, 'ok'); ctx.ui.toast.show(text, { kind: 'ok' }); };

    /** Move datasets to a folder ('' is the root), for example after a drop. */
    async function move(ctx, ids, folder) {
      const target = ctx.services.datasets.normalizeFolder(folder);
      let n = 0;
      try {
        for (const d of chosenOf(ctx, ids)) { if ((d.folder || '') !== target) { await ctx.services.datasets.updateMeta(d.id, { folder: target }); n++; } }
      } catch (err) { fail(ctx, err); return n; }
      if (n) done(ctx, target ? t('datasets.moved', { n, folder: target }) : t('datasets.moved.root', { n }));
      return n;
    }

    /** Folder and tags for one or several datasets. Resolves true when something was saved. */
    async function organize(ctx, ids) {
      const { ui, services } = ctx;
      const chosen = chosenOf(ctx, ids);
      if (!chosen.length) return false;
      const folders = services.datasets.folderPaths(ctx.store.get().datasets);
      const sameFolder = new Set(chosen.map((d) => d.folder || '')).size === 1 ? (chosen[0].folder || '') : null;
      const folderSel = /** @type {any} */ (h('dm-select', { label: t('datasets.folder'), help: sameFolder === null ? t('datasets.folder.mixed') : undefined }));
      folderSel.options = [{ value: '', label: t('datasets.folder.root') }].concat(folders.map((f) => ({ value: f, label: f })));
      folderSel.value = sameFolder === null ? '' : sameFolder;
      let folderTouched = false;
      folderSel.addEventListener('change', () => { folderTouched = true; });
      // A new folder (typed) wins over the choice among the existing ones.
      const newIn = /** @type {any} */ (h('dm-input', { label: t('datasets.folder.new'), placeholder: 'Projekt/2026', help: t('datasets.folder.help') }));
      const tagsIn = /** @type {any} */ (h('dm-input', { label: t('datasets.tags'), help: t('datasets.tags.help') }));
      tagsIn.value = chosen.length === 1 ? (chosen[0].tags || []).join(', ') : '';
      const tagMode = /** @type {any} */ (h('dm-select', { label: t('datasets.tags.mode') }));
      tagMode.options = [{ value: 'replace', label: t('datasets.tags.replace') }, { value: 'add', label: t('datasets.tags.add') }, { value: 'remove', label: t('datasets.tags.remove') }];
      tagMode.value = chosen.length === 1 ? 'replace' : 'add';
      const ok = await ui.dialog.open({
        title: chosen.length === 1 ? t('datasets.organize.one', { name: chosen[0].name }) : t('datasets.organize.many', { n: chosen.length }),
        body: h('div', { class: 'dm-stack' }, folderSel, newIn, h('div', { class: 'dm-form-grid' }, tagsIn, tagMode)),
        actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }],
      });
      if (ok !== true) return false;
      const typed = services.datasets.normalizeFolder(newIn.value);
      const folder = typed || folderSel.value;
      const folderChosen = !!typed || folderTouched || chosen.length === 1;
      const tags = services.datasets.normalizeTags(tagsIn.value);
      let n = 0;
      try {
        for (const d of chosen) {
          const patch = {};
          if (folderChosen && folder !== (d.folder || '')) patch.folder = folder;
          const current = d.tags || [];
          let next = current;
          if (tagMode.value === 'replace' && (chosen.length === 1 || tags.length)) next = tags;
          else if (tagMode.value === 'add' && tags.length) next = current.concat(tags.filter((x) => !current.includes(x)));
          else if (tagMode.value === 'remove' && tags.length) next = current.filter((x) => !tags.includes(x));
          if (next !== current && JSON.stringify(next) !== JSON.stringify(current)) patch.tags = next;
          if (Object.keys(patch).length) { await services.datasets.updateMeta(d.id, patch); n++; }
        }
      } catch (err) { fail(ctx, err); return false; }
      if (n) done(ctx, t('datasets.organized', { n }));
      return true;
    }

    /** The batch dialog: one action for all selected datasets. */
    async function open(ctx, ids) {
      const { ui, services, shell, store } = ctx;
      const chosen = chosenOf(ctx, ids);
      if (!chosen.length) return;
      const ACTIONS = [
        { id: 'organize', label: 'datasets.organize', icon: 'folder' },
        { id: 'bundle', label: 'datasets.batch.bundle', icon: 'package' },
        { id: 'export', label: 'datasets.batch.export', icon: 'file-output' },
        { id: 'refresh', label: 'datasets.batch.refresh', icon: 'refresh-cw' },
        { id: 'recipe', label: 'datasets.batch.recipe', icon: 'wand-sparkles' },
        { id: 'delete', label: 'datasets.batch.delete', icon: 'trash-2' },
      ];
      const choice = await ui.dialog.open({
        title: t('datasets.batch.title', { n: chosen.length }),
        body: (finish) => h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: chosen.map((d) => d.name).join(', ') }),
          h('div', { class: 'dm-stack-sm' }, ACTIONS.map((a) => ui.button({ label: t(a.label), icon: a.icon, variant: a.id === 'delete' ? 'danger' : 'default', onClick: () => finish(a.id) })))),
        actions: [{ label: t('common.cancel'), value: false }],
      });
      if (!choice) return;
      try {
        if (choice === 'organize') await organize(ctx, ids);
        else if (choice === 'bundle') await share.shareBundle(ctx, { datasetIds: ids });
        else if (choice === 'delete') {
          if (!(await ui.dialog.confirm(t('datasets.batch.delete.confirm', { n: chosen.length }), { okLabel: t('common.delete'), danger: true }))) return;
          for (const d of chosen) await services.datasets.remove(d.id);
          store.set({ selectedIds: [] });
          done(ctx, t('datasets.batch.deleted', { n: chosen.length }));
        } else if (choice === 'export') {
          const files = {};
          for (const d of chosen) {
            const res = await services.exporter.exportDataset(d.id, 'csv');
            files[res.filename] = new Uint8Array(await res.blob.arrayBuffer());
          }
          const blob = await D.require('platform/storage/zip-bundle').createZip(files, { level: 6 });
          services.files.download(blob, services.files.safeName(t('datasets.batch.export.file'), 'zip'));
          done(ctx, t('datasets.batch.exported', { n: chosen.length }));
        } else if (choice === 'refresh') {
          const api = chosen.filter((d) => d.source && d.source.kind === 'api');
          if (!api.length) { ui.toast.show(t('datasets.batch.refresh.none'), { kind: 'warn' }); return; }
          const runner = D.require('api/runner');
          let ok = 0;
          for (const d of api) { try { await runner.refreshDataset(d.id); ok++; shell.log(t('api.into.replaced', { name: d.name, rows: i18n.formatNumber(((await services.datasets.get(d.id)) || {}).rowCount || 0) }), 'ok'); } catch (err) { shell.log(`${d.name}: ${(err && err.message) || err}`, 'error'); } }
          ui.toast.show(t('api.refresh.all.done', { ok, failed: api.length - ok }), { kind: ok === api.length ? 'ok' : 'warn' });
        } else if (choice === 'recipe') await runRecipe(ctx, chosen);
      } catch (err) { fail(ctx, err); }
    }

    /** Replay the recipe of one dataset on the selected ones. */
    async function runRecipe(ctx, chosen) {
      const { ui, store, shell } = ctx;
      const recipes = D.require('data/recipes');
      const sources = store.get().datasets;
      const sel = /** @type {any} */ (h('dm-select', { label: t('datasets.batch.recipe.source') }));
      sel.options = sources.map((d) => ({ value: d.id, label: d.name }));
      sel.value = sources[0] ? sources[0].id : '';
      const ok = await ui.dialog.open({ title: t('datasets.batch.recipe'), body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('datasets.batch.recipe.help') }), sel), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.run'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return;
      const steps = await recipes.steps(sel.value);
      if (!steps.length) { ui.toast.show(t('datasets.batch.recipe.none'), { kind: 'warn' }); return; }
      const targets = chosen.filter((d) => d.id !== sel.value);
      let good = 0;
      for (const d of targets) {
        try { await recipes.replay(d.id, steps); good++; shell.log(t('datasets.batch.recipe.one', { name: d.name }), 'ok'); }
        catch (err) { shell.log(`${d.name}: ${(err && err.message) || err}`, 'error'); }
      }
      done(ctx, t('datasets.batch.recipe.done', { ok: good, n: targets.length }));
    }

    return { open, organize, move };
  });
})();
