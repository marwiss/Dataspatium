// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Actions on one or several datasets (Hantera): organise (folder and tags), move by drag and drop, and the
 * batch dialog for the selected datasets: what they can do together (one map, one table, one collection), organise,
 * delete, export each in its own form, bundle, refresh from the API and run another dataset's recipe on them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/batch-actions', ['ui/base', 'ui/share/bundle'], (base, share) => {
    const { h, t, i18n } = base;

    const chosenOf = (ctx, ids) => { const set = new Set(ids); return ctx.store.get().datasets.filter((d) => set.has(d.id)); };
    const fail = (ctx, err) => { ctx.shell.log(String((err && err.message) || err), 'error'); ctx.ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };
    const done = (ctx, text) => { ctx.shell.log(text, 'ok'); ctx.ui.toast.show(text, { kind: 'ok' }); };

    /** Asking more datasets than this what they can do takes longer than it is worth. */
    const MAX_ASKED = 12;
    /**
     * What all the chosen datasets can do together.
     * @param {any[]} chosen @returns {Promise<Array<{id: string, label: string, hint: string, icon: string}>>}
     */
    async function abilities(chosen) {
      if (chosen.length < 2 || chosen.length > MAX_ASKED) return [];
      const kinds = D.require('data/kinds');
      const datasets = D.require('data/datasets');
      const facets = D.require('data/facets');
      const out = [];
      const spatial = await Promise.all(chosen.map((d) => facets.has(d.id, 'spatial').catch(() => false)));
      if (spatial.every(Boolean)) out.push({ id: 'map', label: 'datasets.batch.map', hint: 'datasets.batch.map.hint', icon: 'map' });
      if (chosen.every((d) => !kinds.isCollection(d))) {
        const shapes = await Promise.all(chosen.map(async (d) => (await datasets.columns(d.id)).map((c) => c.name).join('\u0000')));
        if (shapes.every((x) => x === shapes[0])) out.push({ id: 'append', label: 'datasets.batch.append', hint: 'datasets.batch.append.hint', icon: 'rows-3' });
      }
      const merge = kinds.of(chosen[0]).merge;
      if (merge && chosen.every((d) => kinds.of(d).merge === merge)) out.push({ id: 'merge', label: 'datasets.batch.merge.' + merge.as, hint: 'datasets.batch.merge.hint', icon: kinds.of(chosen[0]).icon });
      return out;
    }
    /** All the chosen datasets as layers of one map view, opened in Visualisera. */
    async function oneMap(ctx, chosen) {
      const leaflet = D.require('viz/leaflet');
      const charts = D.require('viz/charts');
      const datasets = D.require('data/datasets');
      const record = charts.create('map', chosen[0], t('datasets.batch.map.name', { n: chosen.length }));
      record.map = leaflet.defaultMap(await datasets.columns(chosen[0].id), chosen[0]);
      for (let i = 1; i < chosen.length; i++) {
        const layer = leaflet.layerFor(await datasets.columns(chosen[i].id), chosen[i], i);
        if (layer) record.map.layers.push(layer);
      }
      const saved = await charts.save(record);
      ctx.store.set({ openChartId: saved.id });
      ctx.shell.activate('visualisera');
    }
    /**
     * One collection from several. Rows and files are copied rather than read again, because a picture collection keeps what
     * was read from the original (date, place) but not the original itself. The datasets chosen stay as they are.
     */
    async function mergeCollections(ctx, chosen) {
      const kinds = D.require('data/kinds');
      const dsFiles = D.require('data/dataset-files');
      const datasets = D.require('data/datasets');
      const merge = kinds.of(chosen[0]).merge;
      const columns = await datasets.columns(chosen[0].id);
      const at = columns.findIndex((c) => c.name === merge.column);
      const rows = []; const files = []; const documents = [];
      const taken = new Set();
      for (const d of chosen) {
        // The same name in two collections is two files, kept apart everywhere the name is used.
        const renamed = new Map();
        const nameFor = (name) => {
          if (!renamed.has(name)) {
            let out = name;
            for (let n = 2; taken.has(out); n++) out = name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
            taken.add(out);
            renamed.set(name, out);
          }
          return renamed.get(name);
        };
        for (const row of await datasets.allRows(d.id)) { const copy = row.slice(); copy[at] = nameFor(row[at]); rows.push(copy); }
        for (const sort of merge.files) {
          for (const f of await dsFiles.list(d.id, sort)) {
            const got = await dsFiles.read(d.id, f.name, sort);
            if (got) files.push({ name: nameFor(f.name), kind: sort, type: got.type, bytes: got.bytes });
          }
        }
        for (const doc of d.documents || []) documents.push(Object.assign({}, doc, { name: nameFor(doc.name) }));
      }
      const meta = await dsFiles.createDataset({
        name: t('import.collection.' + merge.as, { n: taken.size }), kind: chosen[0].kind, columns, rows, files,
        source: { kind: 'derived', from: chosen.map((d) => d.id) }, meta: documents.length ? { documents } : {},
      });
      ctx.store.set({ selectedIds: [], selectedId: meta.id });
      done(ctx, t('datasets.batch.created', { name: meta.name }));
    }
    /** The dataset in its own form when it has one, otherwise as a table. */
    async function exportWhole(ctx, d, files) {
      const kinds = D.require('data/kinds');
      const own = kinds.of(d).wholeFormat || 'csv';
      const res = await ctx.services.exporter.exportDataset(d.id, own).catch((err) => {
        ctx.shell.log(t('datasets.batch.export.fallback', { name: d.name, message: String((err && err.message) || err) }), 'warn');
        return ctx.services.exporter.exportDataset(d.id, 'csv');
      });
      let name = res.filename;
      for (let n = 2; files[name]; n++) name = res.filename.replace(/(\.[^.]*)?$/, ` (${n})$1`);
      files[name] = new Uint8Array(await res.blob.arrayBuffer());
    }

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
      const together = await abilities(chosen);
      const choice = await ui.dialog.open({
        title: t('datasets.batch.title', { n: chosen.length }),
        help: 'lagen#hantera',
        body: (finish) => h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: chosen.map((d) => d.name).join(', ') }),
          together.length ? h('div', { class: 'dm-stack-sm' }, h('h4', { text: t('datasets.batch.together') }), together.map((a) => ui.button({ label: t(a.label), icon: a.icon, title: t(a.hint), onClick: () => finish(a.id) }))) : null,
          together.length ? h('h4', { text: t('datasets.batch.each') }) : null,
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
          for (const d of chosen) await exportWhole(ctx, d, files);
          const blob = await D.require('platform/storage/zip').createZip(files, { level: 6 });
          services.files.download(blob, services.files.safeName(t('datasets.batch.export.file'), 'zip'));
          done(ctx, t('datasets.batch.exported', { n: chosen.length }));
        } else if (choice === 'refresh') {
          const api = chosen.filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge'));
          if (!api.length) { ui.toast.show(t('datasets.batch.refresh.none'), { kind: 'warn' }); return; }
          const runner = D.require('api/runner');
          let ok = 0;
          for (const d of api) { try { await runner.refreshDataset(d.id); ok++; shell.log(t('api.into.replaced', { name: d.name, rows: i18n.formatNumber(((await services.datasets.get(d.id)) || {}).rowCount || 0) }), 'ok'); } catch (err) { shell.log(`${d.name}: ${(err && err.message) || err}`, 'error'); } }
          ui.toast.show(t('api.refresh.all.done', { ok, failed: api.length - ok }), { kind: ok === api.length ? 'ok' : 'warn' });
        } else if (choice === 'recipe') await runRecipe(ctx, chosen);
        else if (choice === 'map') await oneMap(ctx, chosen);
        else if (choice === 'merge') await mergeCollections(ctx, chosen);
        else if (choice === 'append') {
          const meta = await D.require('data/derive').append(chosen.map((d) => d.id), t('datasets.batch.append.name', { n: chosen.length }));
          store.set({ selectedIds: [], selectedId: meta.id });
          done(ctx, t('datasets.batch.created', { name: meta.name }));
        }
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
      const ok = await ui.dialog.open({ title: t('datasets.batch.recipe'), help: 'bearbeta#recept', body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('datasets.batch.recipe.help') }), sel), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.run'), variant: 'primary', value: true, primary: true }] });
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

    return { abilities, open, organize, move };
  });
})();
